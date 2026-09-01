import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { queryItems, saveItem, getItemById } from '../shared/db';
import {
  User,
  Household,
  FamilyMember,
  AuthSession,
  RegisterRequest,
  LoginRequest,
  VerifyEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest
} from '../shared/types';
import {
  sendWelcomeAndVerificationEmail,
  sendPasswordResetEmail
} from '../shared/email';

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

function normalizeInviteCode(code: string): string {
  let clean = code.trim().toUpperCase().replace(/[\s_]+/g, '-');
  if (/^\d{4}$/.test(clean)) {
    clean = `HP-${clean}`;
  } else if (/^HP\d{4}$/.test(clean)) {
    clean = `HP-${clean.substring(2)}`;
  }
  return clean;
}

function generateInviteCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `HP-${num}`;
}

function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateCryptoToken(): string {
  return crypto.randomBytes(32).toString('hex');
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
    // =========================================================================
    // 1. REGISTER (with Welcome & Email Verification dispatch)
    // =========================================================================
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
        const inviteClean = normalizeInviteCode(body.inviteCode);
        const households = await queryItems<Household>('households');
        household = households.find(h => normalizeInviteCode(h.inviteCode) === inviteClean) || null;

        if (!household) {
          return {
            status: 404,
            headers,
            body: JSON.stringify({ error: `Der Einladungscode '${inviteClean}' wurde nicht gefunden. Bitte prüfe die 4 Ziffern.` })
          };
        }
        userRole = 'member';
      } else {
        // Create new Household
        const householdId = `hh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const hhName = body.householdName?.trim() || `Familie ${name}`;
        let inviteCode = generateInviteCode();

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

      // Create Verification Tokens
      const verificationCode = generate6DigitCode();
      const verificationToken = generateCryptoToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

      // Create User
      const newUser: User = {
        id: userId,
        email,
        name,
        householdId: household.id,
        role: userRole,
        emailVerified: false,
        verificationCode,
        verificationToken,
        verificationExpiresAt: expiresAt,
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

      // Trigger Welcome & Verification Email in Background
      sendWelcomeAndVerificationEmail({
        to: email,
        name,
        verificationCode,
        verificationToken,
        householdName: household.name,
        inviteCode: household.inviteCode
      }).catch(err => context.warn('Failed to send verification email:', err));

      const token = generateToken(userId, household.id);
      const session: AuthSession = {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          householdId: newUser.householdId,
          role: newUser.role,
          emailVerified: false
        },
        household,
        member: newMember
      };

      return {
        status: 201,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Registrierung erfolgreich! Wir haben dir eine Bestätigungs-E-Mail gesendet.',
          session,
          requiresEmailVerification: true,
          email
        })
      };
    }

    // =========================================================================
    // 2. VERIFY EMAIL
    // =========================================================================
    if (method === 'POST' && action === 'verify-email') {
      const body = (await req.json()) as VerifyEmailRequest;
      const email = (body.email || '').trim().toLowerCase();
      const code = (body.code || '').trim();
      const verifyTokenStr = (body.token || '').trim();

      if (!email || (!code && !verifyTokenStr)) {
        return {
          status: 400,
          headers,
          body: JSON.stringify({ error: 'E-Mail-Adresse und Bestätigungscode oder Token sind erforderlich.' })
        };
      }

      const users = await queryItems<User>('users');
      const user = users.find(u => u.email.toLowerCase() === email);

      if (!user) {
        return { status: 404, headers, body: JSON.stringify({ error: 'Benutzer nicht gefunden.' }) };
      }

      const isCodeValid = code && user.verificationCode === code;
      const isTokenValid = verifyTokenStr && user.verificationToken === verifyTokenStr;

      if (!isCodeValid && !isTokenValid) {
        return {
          status: 400,
          headers,
          body: JSON.stringify({ error: 'Ungültiger oder abgelaufener Bestätigungscode.' })
        };
      }

      // Mark email as verified
      user.emailVerified = true;
      delete user.verificationCode;
      delete user.verificationToken;
      delete user.verificationExpiresAt;
      await saveItem('users', user);

      const household = await getItemById<Household>('households', user.householdId);
      const members = await queryItems<FamilyMember>('members');
      const member = members.find(m => m.userId === user.id || m.name === user.name);

      const token = generateToken(user.id, user.householdId);
      const session: AuthSession = {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          householdId: user.householdId,
          role: user.role,
          emailVerified: true
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
          name: user.name,
          role: user.role,
          avatar: '👤',
          color: '#3B82F6',
          status: 'home',
          locationShared: true,
          updatedAt: new Date().toISOString()
        }
      };

      return {
        status: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'E-Mail-Adresse erfolgreich bestätigt! Willkommen bei HomePulse.',
          session
        })
      };
    }

    // =========================================================================
    // 3. RESEND VERIFICATION EMAIL
    // =========================================================================
    if (method === 'POST' && action === 'resend-verification') {
      const body = (await req.json()) as { email: string };
      const email = (body.email || '').trim().toLowerCase();

      const users = await queryItems<User>('users');
      const user = users.find(u => u.email.toLowerCase() === email);

      if (!user) {
        return { status: 404, headers, body: JSON.stringify({ error: 'Benutzer nicht gefunden.' }) };
      }

      if (user.emailVerified) {
        return { status: 200, headers, body: JSON.stringify({ message: 'Diese E-Mail-Adresse ist bereits bestätigt.' }) };
      }

      const verificationCode = generate6DigitCode();
      const verificationToken = generateCryptoToken();
      user.verificationCode = verificationCode;
      user.verificationToken = verificationToken;
      user.verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await saveItem('users', user);

      const household = await getItemById<Household>('households', user.householdId);

      await sendWelcomeAndVerificationEmail({
        to: email,
        name: user.name,
        verificationCode,
        verificationToken,
        householdName: household?.name || 'Dein Haushalt',
        inviteCode: household?.inviteCode || 'HP-0000'
      });

      return {
        status: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Neue Bestätigungs-E-Mail wurde versendet!' })
      };
    }

    // =========================================================================
    // 4. FORGOT PASSWORD
    // =========================================================================
    if (method === 'POST' && action === 'forgot-password') {
      const body = (await req.json()) as ForgotPasswordRequest;
      const email = (body.email || '').trim().toLowerCase();

      const users = await queryItems<User>('users');
      const user = users.find(u => u.email.toLowerCase() === email);

      // Always return success for security (avoid enumeration)
      if (user) {
        const resetCode = generate6DigitCode();
        const resetToken = generateCryptoToken();
        user.resetPasswordCode = resetCode;
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
        await saveItem('users', user);

        sendPasswordResetEmail({
          to: email,
          name: user.name,
          resetCode,
          resetToken
        }).catch(err => context.warn('Failed to send password reset email:', err));
      }

      return {
        status: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Falls ein Konto mit dieser E-Mail existiert, haben wir einen Code zum Zurücksetzen gesendet.'
        })
      };
    }

    // =========================================================================
    // 5. RESET PASSWORD
    // =========================================================================
    if (method === 'POST' && action === 'reset-password') {
      const body = (await req.json()) as ResetPasswordRequest;
      const email = (body.email || '').trim().toLowerCase();
      const code = (body.code || '').trim();
      const token = (body.token || '').trim();
      const newPassword = (body.newPassword || '').trim();

      if (!email || (!code && !token) || !newPassword) {
        return {
          status: 400,
          headers,
          body: JSON.stringify({ error: 'E-Mail, Code/Token und neues Passwort sind erforderlich.' })
        };
      }

      if (newPassword.length < 6) {
        return {
          status: 400,
          headers,
          body: JSON.stringify({ error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.' })
        };
      }

      const users = await queryItems<User>('users');
      const user = users.find(u => u.email.toLowerCase() === email);

      if (!user) {
        return { status: 404, headers, body: JSON.stringify({ error: 'Benutzer nicht gefunden.' }) };
      }

      const isCodeValid = code && user.resetPasswordCode === code;
      const isTokenValid = token && user.resetPasswordToken === token;

      if (!isCodeValid && !isTokenValid) {
        return {
          status: 400,
          headers,
          body: JSON.stringify({ error: 'Ungültiger oder abgelaufener Sicherheitscode.' })
        };
      }

      // Update password
      user.passwordHash = hashPassword(newPassword);
      delete user.resetPasswordCode;
      delete user.resetPasswordToken;
      delete user.resetPasswordExpiresAt;
      await saveItem('users', user);

      return {
        status: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Passwort erfolgreich geändert! Bitte melde dich an.' })
      };
    }

    // ==========================================
    // ACTION: SYNC SESSION (Self-healing household & user sync)
    // ==========================================
    if (action === 'sync-session') {
      const session = (await req.json()) as AuthSession;
      if (session && session.household && session.household.id) {
        await saveItem<Household>('households', session.household);
        if (session.user && session.user.id) {
          const existingUser = await getItemById<User>('users', session.user.id);
          if (!existingUser) {
            await saveItem<User>('users', {
              id: session.user.id,
              email: session.user.email,
              name: session.user.name,
              householdId: session.household.id,
              role: session.user.role,
              emailVerified: session.user.emailVerified,
              createdAt: new Date().toISOString()
            });
          }
        }
        if (session.member && session.member.id) {
          await saveItem<FamilyMember>('members', session.member);
        }
        return { status: 200, headers, body: JSON.stringify({ success: true, household: session.household }) };
      }
      return { status: 400, headers, body: JSON.stringify({ error: 'Invalid session payload' }) };
    }

    // =========================================================================
    // 6. LOGIN
    // =========================================================================
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

      const users = await queryItems<User>('users');
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
      const session: AuthSession = {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          householdId: user.householdId,
          role: user.role,
          emailVerified: !!user.emailVerified
        },
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

    // =========================================================================
    // 7. GET CURRENT SESSION / ME
    // =========================================================================
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
          emailVerified: !!user.emailVerified
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
