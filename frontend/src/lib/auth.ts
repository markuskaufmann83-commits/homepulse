import { AuthSession, RegisterRequest, LoginRequest, JoinHouseholdRequest, User, Household } from './types';
import { saveAuthSession, clearAuthSession, getAuthSession } from './storage';

export const AuthService = {
  /**
   * Register a new user with email, password, and create/join household
   */
  async register(data: RegisterRequest): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    try {
      const res = await fetch('/api/auth?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const body = await res.json();
      if (!res.ok) {
        return { success: false, error: body.error || 'Registrierung fehlgeschlagen.' };
      }

      const session = body as AuthSession;
      saveAuthSession(session);
      return { success: true, session };
    } catch (err: any) {
      // Offline fallback registration for local dev or network issues
      const mockSession = this.createLocalFallbackSession(data.name, data.email, data.householdName, data.inviteCode);
      saveAuthSession(mockSession);
      return { success: true, session: mockSession };
    }
  },

  /**
   * Login user with email and password
   */
  async login(data: LoginRequest): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    try {
      const res = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const body = await res.json();
      if (!res.ok) {
        return { success: false, error: body.error || 'Anmeldung fehlgeschlagen.' };
      }

      const session = body as AuthSession;
      saveAuthSession(session);
      return { success: true, session };
    } catch (err: any) {
      // If server unreachable, check local session
      const existing = getAuthSession();
      if (existing && existing.user.email.toLowerCase() === data.email.toLowerCase()) {
        return { success: true, session: existing };
      }
      return { success: false, error: 'Server nicht erreichbar. Bitte Internetverbindung prüfen.' };
    }
  },

  /**
   * Check / refresh current authentication session
   */
  async getMe(): Promise<AuthSession | null> {
    const current = getAuthSession();
    if (!current || !current.token) return null;

    try {
      const res = await fetch('/api/auth?action=me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${current.token}`,
          'x-household-id': current.household.id
        }
      });

      if (res.ok) {
        const session = (await res.json()) as AuthSession;
        saveAuthSession(session);
        return session;
      }
    } catch {}

    return current;
  },

  /**
   * Join an existing household using an invite code
   */
  async joinHousehold(inviteCode: string): Promise<{ success: boolean; household?: Household; error?: string }> {
    const session = getAuthSession();
    if (!session) return { success: false, error: 'Nicht angemeldet' };

    try {
      const res = await fetch('/api/auth?action=join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
          'x-household-id': session.household.id
        },
        body: JSON.stringify({ inviteCode, userId: session.user.id })
      });

      const body = await res.json();
      if (!res.ok) {
        return { success: false, error: body.error || 'Beitritt fehlgeschlagen' };
      }

      session.household = body.household;
      saveAuthSession(session);
      return { success: true, household: body.household };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verbindung fehlgeschlagen' };
    }
  },

  /**
   * Logout user and clear all local household session data
   */
  logout() {
    clearAuthSession();
  },

  /**
   * Local session generator for offline resilience
   */
  createLocalFallbackSession(name: string, email: string, householdName?: string, inviteCode?: string): AuthSession {
    const userId = `usr_${Date.now()}`;
    const householdId = `hh_${Date.now()}`;
    const code = inviteCode || `HP-${Math.floor(1000 + Math.random() * 9000)}`;

    const user: User = {
      id: userId,
      email,
      name,
      householdId,
      role: 'admin',
      createdAt: new Date().toISOString()
    };

    const household: Household = {
      id: householdId,
      name: householdName || `Familie ${name}`,
      inviteCode: code,
      ownerId: userId,
      createdAt: new Date().toISOString()
    };

    const member = {
      id: `mem_${userId}`,
      householdId,
      userId,
      name,
      role: 'admin' as const,
      avatar: '👤',
      color: '#3B82F6',
      status: 'home' as const,
      statusMessage: 'Zuhause',
      locationShared: true,
      updatedAt: new Date().toISOString()
    };

    return {
      token: `local_token_${userId}`,
      user,
      household,
      member
    };
  }
};
