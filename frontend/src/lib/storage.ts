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

const CURRENT_STORAGE_VERSION = 'v3_clean_auth';

const KEYS = {
  STORAGE_VERSION: 'homepulse_version',
  AUTH_SESSION: 'homepulse_auth_session_v3',
  MEMBERS: 'homepulse_members_v3',
  SHOPPING: 'homepulse_shopping_v3',
  CALENDAR: 'homepulse_calendar_v3',
  FEED: 'homepulse_feed_v3',
  SUBSCRIPTION: 'homepulse_subscription_v3',
  CURRENT_USER_ID: 'homepulse_current_user_v3'
};

// Automatic one-time purge of legacy demo cache
export function checkAndPurgeLegacyCache() {
  if (typeof window === 'undefined') return;
  try {
    const version = localStorage.getItem(KEYS.STORAGE_VERSION);
    if (version !== CURRENT_STORAGE_VERSION) {
      // Clear all legacy keys from v1 and v2
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('homepulse_') && k !== KEYS.STORAGE_VERSION) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(KEYS.STORAGE_VERSION, CURRENT_STORAGE_VERSION);
    }
  } catch {}
}

// Run check immediately
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
    saveMembers([session.member]);
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

export function saveMembers(members: FamilyMember[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.MEMBERS, JSON.stringify(members));
  dispatchDataChange('members');
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

export function saveShoppingItems(items: ShoppingItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.SHOPPING, JSON.stringify(items));
  dispatchDataChange('shopping');
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

export function saveCalendarEvents(events: CalendarEvent[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.CALENDAR, JSON.stringify(events));
  dispatchDataChange('calendar');
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

export function saveFeedPosts(posts: FeedPost[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.FEED, JSON.stringify(posts));
  dispatchDataChange('feed');
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

export function saveSubscription(sub: SubscriptionStatus) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.SUBSCRIPTION, JSON.stringify(sub));
  dispatchDataChange('subscription');
}
