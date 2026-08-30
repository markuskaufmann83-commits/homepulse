import {
  FamilyMember,
  ShoppingItem,
  CalendarEvent,
  FeedPost,
  FeedComment,
  SubscriptionStatus
} from './types';
import {
  INITIAL_MEMBERS,
  INITIAL_SHOPPING_ITEMS,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_FEED_POSTS,
  INITIAL_SUBSCRIPTION
} from './mockData';

const KEYS = {
  MEMBERS: 'homepulse_members_v1',
  SHOPPING: 'homepulse_shopping_v1',
  CALENDAR: 'homepulse_calendar_v1',
  FEED: 'homepulse_feed_v1',
  SUBSCRIPTION: 'homepulse_subscription_v1',
  CURRENT_USER_ID: 'homepulse_current_user_v1'
};

export function dispatchDataChange(resource: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('homepulse-data-change', { detail: { resource } }));
  }
}

// Members
export function loadMembers(): FamilyMember[] {
  if (typeof window === 'undefined') return INITIAL_MEMBERS;
  try {
    const raw = localStorage.getItem(KEYS.MEMBERS);
    if (!raw) {
      localStorage.setItem(KEYS.MEMBERS, JSON.stringify(INITIAL_MEMBERS));
      return INITIAL_MEMBERS;
    }
    const parsed = JSON.parse(raw);
    return parsed.length > 0 ? parsed : INITIAL_MEMBERS;
  } catch {
    return INITIAL_MEMBERS;
  }
}

export function saveMembers(members: FamilyMember[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.MEMBERS, JSON.stringify(members));
  dispatchDataChange('members');
}

export function getCurrentUser(): FamilyMember {
  const members = loadMembers();
  if (typeof window === 'undefined') return members[0];
  const currentId = localStorage.getItem(KEYS.CURRENT_USER_ID);
  return members.find(m => m.id === currentId) || members[0] || INITIAL_MEMBERS[0];
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
    if (!raw) {
      localStorage.setItem(KEYS.SHOPPING, JSON.stringify(INITIAL_SHOPPING_ITEMS));
      return INITIAL_SHOPPING_ITEMS;
    }
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
    if (!raw) {
      localStorage.setItem(KEYS.CALENDAR, JSON.stringify(INITIAL_CALENDAR_EVENTS));
      return INITIAL_CALENDAR_EVENTS;
    }
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
    if (!raw) {
      localStorage.setItem(KEYS.FEED, JSON.stringify(INITIAL_FEED_POSTS));
      return INITIAL_FEED_POSTS;
    }
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

export function resetAllToMockData() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.MEMBERS, JSON.stringify(INITIAL_MEMBERS));
  localStorage.setItem(KEYS.SHOPPING, JSON.stringify(INITIAL_SHOPPING_ITEMS));
  localStorage.setItem(KEYS.CALENDAR, JSON.stringify(INITIAL_CALENDAR_EVENTS));
  localStorage.setItem(KEYS.FEED, JSON.stringify(INITIAL_FEED_POSTS));
  localStorage.setItem(KEYS.SUBSCRIPTION, JSON.stringify(INITIAL_SUBSCRIPTION));
  dispatchDataChange('all');
}
