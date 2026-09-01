import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { queryItems, saveItem, getItemById } from '../shared/db';
import { User, Household, FamilyMember, AuthSession, RegisterRequest, LoginRequest, JoinHouseholdRequest } from '../shared/types';

const AUTH_SALT = process.env.AUTH_SECRET || 'homepulse-super-secret-salt-2026';

function hashPassword(password: string): string {
  return crypto.createHmac('sha256', AUTH_SALT).update(password).digest('hex');
}

function generateToken(userId: string, householdId: string): string {
  const payload = JSON.stringify({ userId, householdId, ts: Date.now() });
  const sig = crypto.createHmac('sha256', AUTH_SALT).update(payload).digest('hex');
  return Buffer.from(`${payload}:::${sig}`).toString('base64url');
}

function verifyToken(token: string): { userId: string; householdId: string } | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [payload, sig] = raw.split(':::');
    if (!payload || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', AUTH_SALT).update(payload).digest('hex');
    if (sig !== expectedSig) return null;
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function generateInviteCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `HP-${num}`;
}

export async function authHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = req.method;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-household-id'
  };

  if (method === 'OPTIONS') {
    return { status: 204, headers };
  }

  const action = req.query.get('action') || '';

  try {
    // 1. REGISTER
    if (method === 'POST' && (action === 'register' || req.url.includes('/register'))) {
      const body = (await req.json()) as RegisterRequest;
      const email = (body.email || '').trim().toLowerCase();
      const password = (body.password || '').trim();
      const name = (body.name || '').trim();

      if (!email || !password || !name) {
        return {
          status: 400,
          headers,
          body: JSON.stringify({ error: 'Name, E-Mail-Adresse und Passwort sind erforderlich.' })
        };
      }

      if (password.length < 6) {
        return {
          status: 400,
          headers,
          body: JSON.stringify({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' })
        };
      }

      // Check if user already exists
      const existingUsers = await queryItems<User & { passwordHash: string }>('users');
      const userFound = existingUsers.find(u => u.email.toLowerCase() === email);
      if (userFound) {
        return {
          status: 409,
          headers,
          body: JSON.stringify({ error: 'Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich an.' })
        };
      }

      let household: Household | null = null;
      let userRole: 'admin' | 'member' = 'admin';

      // Join existing household via invite code
      if (body.inviteCode && body.inviteCode.trim()) {
        const inviteClean = body.inviteCode.trim().toUpperCase();
        const households = await queryItems<Household>('households');
        household = households.find(h => h.inviteCode.toUpperCase() === inviteClean) || null;

        if (!household) {
          return {
            status: 404,
            headers,
            body: JSON.stringify({ error: `Der Einladungscode '${inviteClean}' wurde nicht gefunden.` })
          };
        }
        userRole = 'member';
      } else {
        // Create new Household
        const householdId = `hh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const hhName = body.householdName?.trim() || `Familie ${name}`;
        let inviteCode = generateInviteCode();

        // Ensure unique invite code
        const households = await queryItems<Household>('households');
        while (households.some(h => h.inviteCode === inviteCode)) {
          inviteCode = generateInviteCode();
        }

        household = {
          id: householdId,
          name: hhName,
          inviteCode,
          ownerId: '',
          createdAt: new Date().toISOString()
        };
      }

      const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      if (household.ownerId === '') {
        household.ownerId = userId;
      }
      await saveItem('households', household);

      // Create User
      const newUser: User & { passwordHash: string } = {
        id: userId,
        email,
        name,
        householdId: household.id,
        role: userRole,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
      };
      await saveItem('users', newUser);

      // Create FamilyMember profile
      const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const memberColors = ['#3B82F6', '#EC4899', '#10B981', '#8B5CF6', '#F59E0B', '#14B8A6'];
      const randomColor = memberColors[Math.floor(Math.random() * memberColors.length)];

      const newMember: FamilyMember = {
        id: memberId,
        householdId: household.id,
        userId: userId,
        name,
        role: userRole,
        avatar: '👤',
        color: randomColor,
        status: 'home',
        statusMessage: 'Neu registriert',
        locationShared: true,
        updatedAt: new Date().toISOString()
      };
      await saveItem('members', newMember);

      const token = generateToken(userId, household.id);
      const userPublic: User = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        householdId: newUser.householdId,
        role: newUser.role,
        createdAt: newUser.createdAt
      };

      const session: AuthSession = {
        token,
        user: userPublic,
        household,
        member: newMember
      };

      return { status: 201, headers, body: JSON.stringify(session) };
    }

    // 2. LOGIN
    if (method === 'POST' && (action === 'login' || req.url.includes('/login'))) {
      const body = (await req.json()) as LoginRequest;
      const email = (body.email || '').trim().toLowerCase();
      const password = (body.password || '').trim();

      if (!email || !password) {
        return {
          status: 400,
          headers,
          body: JSON.stringify({ error: 'E-Mail und Passwort sind erforderlich.' })
        };
      }

      const users = await queryItems<User & { passwordHash: string }>('users');
      const user = users.find(u => u.email.toLowerCase() === email);

      if (!user || user.passwordHash !== hashPassword(password)) {
        return {
          status: 401,
          headers,
          body: JSON.stringify({ error: 'Ungültige E-Mail-Adresse oder Passwort.' })
        };
      }

      const household = await getItemById<Household>('households', user.householdId);
      const members = await queryItems<FamilyMember>('members');
      const member = members.find(m => m.userId === user.id || (m.householdId === user.householdId && m.name === user.name)) || {
        id: `mem_${user.id}`,
        householdId: user.householdId,
        userId: user.id,
        name: user.name,
        role: user.role,
        avatar: '👤',
        color: '#3B82F6',
        status: 'home',
        locationShared: true,
        updatedAt: new Date().toISOString()
      };

      const token = generateToken(user.id, user.householdId);
      const userPublic: User = {
        id: user.id,
        email: user.email,
        name: user.name,
        householdId: user.householdId,
        role: user.role,
        createdAt: user.createdAt
      };

      const session: AuthSession = {
        token,
        user: userPublic,
        household: household || {
          id: user.householdId,
          name: 'Mein Haushalt',
          inviteCode: generateInviteCode(),
          ownerId: user.id,
          createdAt: new Date().toISOString()
        },
        member
      };

      return { status: 200, headers, body: JSON.stringify(session) };
    }

    // 3. GET CURRENT SESSION / ME
    if (method === 'GET' && (action === 'me' || action === '' || req.url.includes('/me'))) {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      if (!token) {
        return { status: 401, headers, body: JSON.stringify({ error: 'Nicht authentifiziert' }) };
      }

      const verified = verifyToken(token);
      if (!verified) {
        return { status: 401, headers, body: JSON.stringify({ error: 'Sitzung abgelaufen oder ungültig' }) };
      }

      const user = await getItemById<User>('users', verified.userId);
      if (!user) {
        return { status: 404, headers, body: JSON.stringify({ error: 'Benutzer nicht gefunden' }) };
      }

      const household = await getItemById<Household>('households', user.householdId);
      const members = await queryItems<FamilyMember>('members');
      const member = members.find(m => m.userId === user.id || (m.householdId === user.householdId && m.name === user.name));

      const session: AuthSession = {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          householdId: user.householdId,
          role: user.role,
          createdAt: user.createdAt
        },
        household: household || {
          id: user.householdId,
          name: 'Mein Haushalt',
          inviteCode: generateInviteCode(),
          ownerId: user.id,
          createdAt: new Date().toISOString()
        },
        member: member || {
          id: `mem_${user.id}`,
          householdId: user.householdId,
          userId: user.id,
          name: user.name,
          role: user.role,
          avatar: '👤',
          color: '#3B82F6',
          status: 'home',
          locationShared: true,
          updatedAt: new Date().toISOString()
        }
      };

      return { status: 200, headers, body: JSON.stringify(session) };
    }

    // 4. JOIN HOUSEHOLD
    if (method === 'POST' && (action === 'join' || req.url.includes('/join'))) {
      const body = (await req.json()) as JoinHouseholdRequest & { userId: string };
      const inviteCode = (body.inviteCode || '').trim().toUpperCase();

      if (!inviteCode || !body.userId) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Einladungscode und Benutzer-ID erforderlich' }) };
      }

      const households = await queryItems<Household>('households');
      const household = households.find(h => h.inviteCode.toUpperCase() === inviteCode);

      if (!household) {
        return { status: 404, headers, body: JSON.stringify({ error: 'Ungültiger Einladungscode' }) };
      }

      const user = await getItemById<User & { passwordHash: string }>('users', body.userId);
      if (user) {
        user.householdId = household.id;
        user.role = 'member';
        await saveItem('users', user);
      }

      return { status: 200, headers, body: JSON.stringify({ success: true, household }) };
    }

    return { status: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error: any) {
    context.error('Error in authHandler:', error);
    return { status: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
  }
}

app.http('auth', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth',
  handler: authHandler
});
