import {
  FamilyMember,
  ShoppingItem,
  CalendarEvent,
  FeedPost,
  SubscriptionStatus,
  AuthSession,
  User,
  Household
} from './types';
import {
  INITIAL_MEMBERS,
  INITIAL_SHOPPING_ITEMS,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_FEED_POSTS,
  INITIAL_SUBSCRIPTION
} from './mockData';

const KEYS = {
  AUTH_SESSION: 'homepulse_auth_session_v2',
  MEMBERS: 'homepulse_members_v2',
  SHOPPING: 'homepulse_shopping_v2',
  CALENDAR: 'homepulse_calendar_v2',
  FEED: 'homepulse_feed_v2',
  SUBSCRIPTION: 'homepulse_subscription_v2',
  CURRENT_USER_ID: 'homepulse_current_user_v2'
};

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
  return members.find(m => m.id === currentId) || members[0] || null;
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
