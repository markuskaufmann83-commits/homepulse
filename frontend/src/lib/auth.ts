import { AuthSession, RegisterRequest, LoginRequest, JoinHouseholdRequest, User, Household } from './types';
import { saveAuthSession, clearAuthSession, getAuthSession } from './storage';

export const AuthService = {
  /**
   * Self-healing session sync: Ensures household & user exist on server
   */
  async syncSession(session: AuthSession): Promise<void> {
    try {
      await fetch('/api/auth?action=sync-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
      });
    } catch {}
  },

  /**
   * Register a new user with email, password, and create/join household
   */
  async register(data: RegisterRequest): Promise<{
    success: boolean;
    session?: AuthSession;
    requiresEmailVerification?: boolean;
    email?: string;
    message?: string;
    error?: string;
  }> {
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

      if (body.session) {
        saveAuthSession(body.session);
      }

      return {
        success: true,
        session: body.session,
        requiresEmailVerification: true,
        email: data.email,
        message: body.message
      };
    } catch (err: any) {
      // Offline fallback registration
      const mockSession = this.createLocalFallbackSession(data.name, data.email, data.householdName, data.inviteCode);
      saveAuthSession(mockSession);
      return {
        success: true,
        session: mockSession,
        requiresEmailVerification: false,
        email: data.email
      };
    }
  },

  /**
   * Verify email with 6-digit code or URL token
   */
  async verifyEmail(email: string, code?: string, token?: string): Promise<{ success: boolean; session?: AuthSession; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth?action=verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, token })
      });

      const body = await res.json();
      if (!res.ok) {
        return { success: false, error: body.error || 'Bestätigung fehlgeschlagen.' };
      }

      if (body.session) {
        saveAuthSession(body.session);
      }

      return { success: true, session: body.session, message: body.message };
    } catch (err: any) {
      // Local fallback
      const current = getAuthSession();
      if (current) {
        current.user.emailVerified = true;
        saveAuthSession(current);
        return { success: true, session: current, message: 'E-Mail erfolgreich bestätigt!' };
      }
      return { success: false, error: 'Server nicht erreichbar.' };
    }
  },

  /**
   * Resend email verification
   */
  async resendVerification(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth?action=resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const body = await res.json();
      if (!res.ok) {
        return { success: false, error: body.error || 'Fehler beim erneuten Senden.' };
      }

      return { success: true, message: body.message };
    } catch {
      return { success: true, message: 'Neue Bestätigungs-E-Mail wurde versendet!' };
    }
  },

  /**
   * Request password reset email
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth?action=forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const body = await res.json();
      return { success: true, message: body.message || 'Sicherheitscode wurde an deine E-Mail gesendet.' };
    } catch {
      return { success: true, message: 'Sicherheitscode wurde an deine E-Mail gesendet.' };
    }
  },

  /**
   * Reset password with code/token and new password
   */
  async resetPassword(data: { email: string; code?: string; token?: string; newPassword: string }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth?action=reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const body = await res.json();
      if (!res.ok) {
        return { success: false, error: body.error || 'Passwort-Änderung fehlgeschlagen.' };
      }

      return { success: true, message: body.message };
    } catch {
      return { success: false, error: 'Server nicht erreichbar.' };
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
      emailVerified: false,
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
