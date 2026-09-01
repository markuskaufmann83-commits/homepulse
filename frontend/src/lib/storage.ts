import {
  FamilyMember,
  ShoppingItem,
  CalendarEvent,
  FeedPost,
  SubscriptionStatus,
  AuthSession
} from './types';
import {
  INITIAL_MEMBERS,
  INITIAL_SHOPPING_ITEMS,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_FEED_POSTS,
  INITIAL_SUBSCRIPTION
} from './mockData';

const CURRENT_STORAGE_VERSION = 'v4_clean_production';

const KEYS = {
  STORAGE_VERSION: 'homepulse_version',
  AUTH_SESSION: 'homepulse_auth_session_v4',
  MEMBERS: 'homepulse_members_v4',
  SHOPPING: 'homepulse_shopping_v4',
  CALENDAR: 'homepulse_calendar_v4',
  FEED: 'homepulse_feed_v4',
  SUBSCRIPTION: 'homepulse_subscription_v4',
  CURRENT_USER_ID: 'homepulse_current_user_v4'
};

// Automatic one-time purge of legacy demo cache while preserving active user login
export function checkAndPurgeLegacyCache() {
  if (typeof window === 'undefined') return;
  try {
    const version = localStorage.getItem(KEYS.STORAGE_VERSION);
    if (version !== CURRENT_STORAGE_VERSION) {
      // Find existing auth session from v2 or v3
      let existingSession: string | null = null;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.includes('auth_session')) {
          existingSession = localStorage.getItem(k);
          break;
        }
      }

      // Clear all legacy storage keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('homepulse_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Restore clean user session if existed
      if (existingSession) {
        localStorage.setItem(KEYS.AUTH_SESSION, existingSession);
        try {
          const parsed: AuthSession = JSON.parse(existingSession);
          if (parsed.member) {
            localStorage.setItem(KEYS.MEMBERS, JSON.stringify([parsed.member]));
            localStorage.setItem(KEYS.CURRENT_USER_ID, parsed.member.id);
          }
        } catch {}
      }

      // Explicitly initialize clean empty lists
      localStorage.setItem(KEYS.SHOPPING, JSON.stringify([]));
      localStorage.setItem(KEYS.CALENDAR, JSON.stringify([]));
      localStorage.setItem(KEYS.FEED, JSON.stringify([]));

      localStorage.setItem(KEYS.STORAGE_VERSION, CURRENT_STORAGE_VERSION);
    }
  } catch {}
}

checkAndPurgeLegacyCache();

export function dispatchDataChange(resource: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('homepulse-data-change', { detail: { resource } }));
  }
}

// Auth Session Management
export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEYS.AUTH_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.AUTH_SESSION, JSON.stringify(session));
  if (session.member) {
    saveMembers([session.member], false);
    setCurrentUser(session.member.id);
  }
  dispatchDataChange('auth');
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.AUTH_SESSION);
  localStorage.removeItem(KEYS.MEMBERS);
  localStorage.removeItem(KEYS.SHOPPING);
  localStorage.removeItem(KEYS.CALENDAR);
  localStorage.removeItem(KEYS.FEED);
  localStorage.removeItem(KEYS.CURRENT_USER_ID);
  dispatchDataChange('auth');
}

export function getActiveHouseholdId(): string {
  const session = getAuthSession();
  return session?.household?.id || 'default_household';
}

// Members
export function loadMembers(): FamilyMember[] {
  if (typeof window === 'undefined') return INITIAL_MEMBERS;
  try {
    const raw = localStorage.getItem(KEYS.MEMBERS);
    if (!raw) {
      const session = getAuthSession();
      if (session?.member) {
        const initial = [session.member];
        localStorage.setItem(KEYS.MEMBERS, JSON.stringify(initial));
        return initial;
      }
      return INITIAL_MEMBERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_MEMBERS;
  } catch {
    return INITIAL_MEMBERS;
  }
}

export function saveMembers(members: FamilyMember[], emitEvent = true) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.MEMBERS, JSON.stringify(members));
  if (emitEvent) {
    dispatchDataChange('members');
  }
}

export function getCurrentUser(): FamilyMember | null {
  const members = loadMembers();
  if (typeof window === 'undefined') return members[0] || null;
  const currentId = localStorage.getItem(KEYS.CURRENT_USER_ID);
  if (currentId) {
    const found = members.find(m => m.id === currentId);
    if (found) return found;
  }
  const session = getAuthSession();
  if (session?.member) return session.member;
  return members[0] || null;
}

export function setCurrentUser(memberId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.CURRENT_USER_ID, memberId);
  dispatchDataChange('currentUser');
}

// Shopping
export function loadShoppingItems(): ShoppingItem[] {
  if (typeof window === 'undefined') return INITIAL_SHOPPING_ITEMS;
  try {
    const raw = localStorage.getItem(KEYS.SHOPPING);
    if (!raw) return INITIAL_SHOPPING_ITEMS;
    return JSON.parse(raw);
  } catch {
    return INITIAL_SHOPPING_ITEMS;
  }
}

export function saveShoppingItems(items: ShoppingItem[], emitEvent = true) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.SHOPPING, JSON.stringify(items));
  if (emitEvent) {
    dispatchDataChange('shopping');
  }
}

// Calendar
export function loadCalendarEvents(): CalendarEvent[] {
  if (typeof window === 'undefined') return INITIAL_CALENDAR_EVENTS;
  try {
    const raw = localStorage.getItem(KEYS.CALENDAR);
    if (!raw) return INITIAL_CALENDAR_EVENTS;
    return JSON.parse(raw);
  } catch {
    return INITIAL_CALENDAR_EVENTS;
  }
}

export function saveCalendarEvents(events: CalendarEvent[], emitEvent = true) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.CALENDAR, JSON.stringify(events));
  if (emitEvent) {
    dispatchDataChange('calendar');
  }
}

// Feed
export function loadFeedPosts(): FeedPost[] {
  if (typeof window === 'undefined') return INITIAL_FEED_POSTS;
  try {
    const raw = localStorage.getItem(KEYS.FEED);
    if (!raw) return INITIAL_FEED_POSTS;
    return JSON.parse(raw);
  } catch {
    return INITIAL_FEED_POSTS;
  }
}

export function saveFeedPosts(posts: FeedPost[], emitEvent = true) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.FEED, JSON.stringify(posts));
  if (emitEvent) {
    dispatchDataChange('feed');
  }
}

// Subscription
export function loadSubscription(): SubscriptionStatus {
  if (typeof window === 'undefined') return INITIAL_SUBSCRIPTION;
  try {
    const raw = localStorage.getItem(KEYS.SUBSCRIPTION);
    if (!raw) {
      localStorage.setItem(KEYS.SUBSCRIPTION, JSON.stringify(INITIAL_SUBSCRIPTION));
      return INITIAL_SUBSCRIPTION;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_SUBSCRIPTION;
  }
}

export function saveSubscription(sub: SubscriptionStatus, emitEvent = true) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.SUBSCRIPTION, JSON.stringify(sub));
  if (emitEvent) {
    dispatchDataChange('subscription');
  }
}
