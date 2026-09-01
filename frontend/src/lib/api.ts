import {
  FamilyMember,
  ShoppingItem,
  CalendarEvent,
  FeedPost,
  FeedComment,
  AiParseResponse,
  SubscriptionStatus
} from './types';
import * as storage from './storage';
import { parseGermanTextLocally } from './nlpParser';

const FORCE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

function getAuthHeaders(): Record<string, string> {
  const session = storage.getAuthSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (session?.household?.id) {
    headers['x-household-id'] = session.household.id;
  }
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  return headers;
}

async function fetchWithFallback<T>(
  url: string,
  options?: RequestInit,
  fallbackFn?: () => T | Promise<T>
): Promise<T> {
  if (FORCE_MOCK && fallbackFn) {
    return fallbackFn();
  }

  try {
    const authHeaders = getAuthHeaders();
    const mergedHeaders = {
      ...authHeaders,
      ...(options?.headers as Record<string, string> || {})
    };

    const res = await fetch(url, {
      ...options,
      headers: mergedHeaders
    });

    if (res.ok) {
      const data = (await res.json()) as T;
      return data;
    }
  } catch (error) {
    console.info(`API call to ${url} offline or fallback:`, error);
  }

  if (fallbackFn) {
    return fallbackFn();
  }
  throw new Error(`API request to ${url} failed and no fallback provided.`);
}

export const Api = {
  // Members
  async getMembers(): Promise<FamilyMember[]> {
    const mems = await fetchWithFallback('/api/members', { method: 'GET' }, () => storage.loadMembers());
    if (mems) {
      storage.saveMembers(mems);
    }
    return mems || [];
  },

  async updateMember(member: FamilyMember): Promise<FamilyMember> {
    const householdId = storage.getActiveHouseholdId();
    const normalized = { ...member, householdId: member.householdId || householdId };

    const members = storage.loadMembers();
    const idx = members.findIndex(m => m.id === normalized.id);
    if (idx >= 0) members[idx] = normalized;
    else members.push(normalized);
    storage.saveMembers(members);

    fetchWithFallback(
      '/api/members',
      {
        method: 'PUT',
        body: JSON.stringify(normalized)
      },
      () => normalized
    ).catch(() => {});

    return normalized;
  },

  async addMember(member: Partial<FamilyMember>): Promise<FamilyMember> {
    const householdId = storage.getActiveHouseholdId();
    const newM: FamilyMember = {
      id: member.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      householdId: member.householdId || householdId,
      name: member.name || 'Neues Mitglied',
      role: member.role || 'member',
      avatar: member.avatar || '👤',
      color: member.color || '#3B82F6',
      status: member.status || 'home',
      statusMessage: member.statusMessage,
      locationShared: member.locationShared !== false,
      updatedAt: new Date().toISOString()
    };

    const members = storage.loadMembers();
    members.push(newM);
    storage.saveMembers(members);

    fetchWithFallback(
      '/api/members',
      {
        method: 'POST',
        body: JSON.stringify(newM)
      },
      () => newM
    ).catch(() => {});

    return newM;
  },

  async deleteMember(id: string): Promise<boolean> {
    const members = storage.loadMembers().filter(m => m.id !== id);
    storage.saveMembers(members);

    fetchWithFallback(`/api/members?id=${id}`, { method: 'DELETE' }, () => true).catch(() => {});
    return true;
  },

  // Shopping Items
  async getShoppingItems(): Promise<ShoppingItem[]> {
    const items = await fetchWithFallback('/api/shopping', { method: 'GET' }, () => storage.loadShoppingItems());
    if (items) {
      storage.saveShoppingItems(items);
    }
    return items || [];
  },

  async addShoppingItem(item: Partial<ShoppingItem>): Promise<ShoppingItem> {
    const householdId = storage.getActiveHouseholdId();
    const newItem: ShoppingItem = {
      id: item.id || `shop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      householdId: item.householdId || householdId,
      title: item.title!,
      category: item.category || 'Sonstiges',
      quantity: item.quantity,
      unit: item.unit,
      assignedMemberId: item.assignedMemberId,
      completed: !!item.completed,
      createdAt: new Date().toISOString()
    };

    const items = storage.loadShoppingItems();
    items.unshift(newItem);
    storage.saveShoppingItems(items);

    fetchWithFallback(
      '/api/shopping',
      {
        method: 'POST',
        body: JSON.stringify(newItem)
      },
      () => newItem
    ).catch(() => {});

    return newItem;
  },

  async updateShoppingItem(item: ShoppingItem): Promise<ShoppingItem> {
    const items = storage.loadShoppingItems();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    storage.saveShoppingItems(items);

    fetchWithFallback(
      '/api/shopping',
      {
        method: 'PUT',
        body: JSON.stringify(item)
      },
      () => item
    ).catch(() => {});

    return item;
  },

  async toggleShoppingItem(id: string, memberName?: string): Promise<ShoppingItem | null> {
    const items = storage.loadShoppingItems();
    const item = items.find(i => i.id === id);
    if (!item) return null;

    item.completed = !item.completed;
    if (item.completed) {
      item.completedBy = memberName || 'Jemand';
      item.completedAt = new Date().toISOString();
    } else {
      delete item.completedBy;
      delete item.completedAt;
    }

    storage.saveShoppingItems(items);

    fetchWithFallback(
      '/api/shopping',
      {
        method: 'PUT',
        body: JSON.stringify(item)
      },
      () => item
    ).catch(() => {});

    return item;
  },

  async deleteShoppingItem(id: string): Promise<boolean> {
    const items = storage.loadShoppingItems().filter(i => i.id !== id);
    storage.saveShoppingItems(items);

    fetchWithFallback(`/api/shopping?id=${id}`, { method: 'DELETE' }, () => true).catch(() => {});
    return true;
  },

  async clearCompletedShoppingItems(): Promise<boolean> {
    const items = storage.loadShoppingItems().filter(i => !i.completed);
    storage.saveShoppingItems(items);

    fetchWithFallback('/api/shopping?action=clear_completed', { method: 'DELETE' }, () => true).catch(() => {});
    return true;
  },

  // Calendar Events
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const events = await fetchWithFallback('/api/calendar', { method: 'GET' }, () => storage.loadCalendarEvents());
    if (events) {
      const normalized = events.map(e => ({
        ...e,
        date: (e.date || '').split('T')[0]
      }));
      storage.saveCalendarEvents(normalized);
      return normalized;
    }
    return storage.loadCalendarEvents() || [];
  },

  async addCalendarEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const householdId = storage.getActiveHouseholdId();
    const normalizedDate = (event.date || new Date().toISOString()).split('T')[0];
    const newEvent: CalendarEvent = {
      id: event.id || `cal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      householdId: event.householdId || householdId,
      title: event.title || 'Termin',
      description: event.description,
      date: normalizedDate,
      time: event.time,
      endTime: event.endTime,
      location: event.location,
      assignedMemberIds: event.assignedMemberIds && event.assignedMemberIds.length > 0 ? event.assignedMemberIds : ['all'],
      category: event.category || 'Familie',
      isAllDay: !!event.isAllDay,
      createdAt: new Date().toISOString(),
      isGoogleSynced: !!event.isGoogleSynced,
      googleEventId: event.googleEventId,
      externalSource: event.externalSource || 'manual'
    };

    const events = storage.loadCalendarEvents();
    events.push(newEvent);
    events.sort((a, b) => {
      const dComp = a.date.localeCompare(b.date);
      if (dComp !== 0) return dComp;
      return (a.time || '').localeCompare(b.time || '');
    });
    storage.saveCalendarEvents(events);

    fetchWithFallback(
      '/api/calendar',
      {
        method: 'POST',
        body: JSON.stringify(newEvent)
      },
      () => newEvent
    ).catch(() => {});

    return newEvent;
  },

  async updateCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const normalized = {
      ...event,
      date: (event.date || '').split('T')[0]
    };
    const events = storage.loadCalendarEvents();
    const idx = events.findIndex(e => e.id === normalized.id);
    if (idx >= 0) events[idx] = normalized;
    storage.saveCalendarEvents(events);

    fetchWithFallback(
      '/api/calendar',
      {
        method: 'PUT',
        body: JSON.stringify(normalized)
      },
      () => normalized
    ).catch(() => {});

    return normalized;
  },

  async deleteCalendarEvent(id: string): Promise<boolean> {
    const events = storage.loadCalendarEvents().filter(e => e.id !== id);
    storage.saveCalendarEvents(events);

    fetchWithFallback(`/api/calendar?id=${id}`, { method: 'DELETE' }, () => true).catch(() => {});
    return true;
  },

  // Feed Posts
  async getFeedPosts(): Promise<FeedPost[]> {
    const posts = await fetchWithFallback('/api/feed', { method: 'GET' }, () => storage.loadFeedPosts());
    if (posts) {
      storage.saveFeedPosts(posts);
    }
    return posts || [];
  },

  async addFeedPost(post: Partial<FeedPost>): Promise<FeedPost> {
    const householdId = storage.getActiveHouseholdId();
    const session = storage.getAuthSession();

    const newPost: FeedPost = {
      id: post.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      householdId: post.householdId || householdId,
      authorId: post.authorId || session?.member?.id || 'mem_1',
      content: post.content!,
      type: post.type || 'note',
      timestamp: new Date().toISOString(),
      pinned: !!post.pinned,
      reactions: {},
      comments: []
    };

    const posts = storage.loadFeedPosts();
    posts.unshift(newPost);
    storage.saveFeedPosts(posts);

    fetchWithFallback(
      '/api/feed',
      {
        method: 'POST',
        body: JSON.stringify(newPost)
      },
      () => newPost
    ).catch(() => {});

    return newPost;
  },

  async addFeedComment(postId: string, content: string, authorId: string): Promise<FeedPost | null> {
    const newComment: FeedComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      authorId,
      content,
      timestamp: new Date().toISOString()
    };

    const posts = storage.loadFeedPosts();
    const post = posts.find(p => p.id === postId);
    if (post) {
      if (!post.comments) post.comments = [];
      post.comments.push(newComment);
      storage.saveFeedPosts(posts);
    }

    fetchWithFallback(
      '/api/feed?action=comment',
      {
        method: 'POST',
        body: JSON.stringify({ postId, content, authorId })
      },
      () => post || null
    ).catch(() => {});

    return post || null;
  },

  async togglePostReaction(postId: string, emoji: string, memberId: string): Promise<FeedPost | null> {
    const posts = storage.loadFeedPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return null;

    if (!post.reactions) post.reactions = {};
    if (!post.reactions[emoji]) post.reactions[emoji] = [];

    const idx = post.reactions[emoji].indexOf(memberId);
    if (idx >= 0) {
      post.reactions[emoji].splice(idx, 1);
      if (post.reactions[emoji].length === 0) {
        delete post.reactions[emoji];
      }
    } else {
      post.reactions[emoji].push(memberId);
    }

    storage.saveFeedPosts(posts);

    fetchWithFallback(
      '/api/feed',
      {
        method: 'PUT',
        body: JSON.stringify(post)
      },
      () => post
    ).catch(() => {});

    return post;
  },

  // AI Parser with instant client parser & 1.8s timeout
  async parseAiPrompt(
    prompt: string,
    memberNames: string[] = []
  ): Promise<AiParseResponse> {
    const members = storage.loadMembers();
    const namesToUse = memberNames.length > 0 ? memberNames : members.map(m => m.name);
    const localActions = parseGermanTextLocally(prompt, namesToUse);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);

      const res = await fetch('/api/ai-parse', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ prompt, memberNames: namesToUse }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.actions && data.actions.length > 0) {
          return data;
        }
      }
    } catch {}

    return {
      rawText: prompt,
      actions: localActions,
      summary: `${localActions.length} Aktion(en) erkannt`,
      source: 'rule_based'
    };
  },

  // Subscription Status
  async getSubscription(): Promise<SubscriptionStatus> {
    return fetchWithFallback('/api/billing', { method: 'GET' }, () => storage.loadSubscription());
  }
};
