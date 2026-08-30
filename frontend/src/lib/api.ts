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

async function fetchWithFallback<T>(
  url: string,
  options?: RequestInit,
  fallbackFn?: () => T | Promise<T>
): Promise<T> {
  if (FORCE_MOCK && fallbackFn) {
    return fallbackFn();
  }

  try {
    const res = await fetch(url, options);
    if (res.ok) {
      const data = (await res.json()) as T;
      if (Array.isArray(data)) {
        if (data.length > 0) {
          return data;
        } else if (fallbackFn) {
          return fallbackFn();
        }
      }
      return data;
    }
  } catch (error) {
    console.info(`API call to ${url} failed or offline, using fallback storage:`, error);
  }

  if (fallbackFn) {
    return fallbackFn();
  }
  throw new Error(`API request to ${url} failed and no fallback provided.`);
}

export const Api = {
  // Seed / Reset all data on Azure Cosmos DB & LocalStorage
  async seedData(): Promise<{ success: boolean; message: string }> {
    try {
      await fetch('/api/seed', { method: 'POST' });
    } catch {}
    storage.resetAllToMockData();
    return { success: true, message: 'Daten erfolgreich auf Standard-Beispieldaten zurückgesetzt!' };
  },

  // Members
  async getMembers(): Promise<FamilyMember[]> {
    const mems = await fetchWithFallback('/api/members', { method: 'GET' }, () => storage.loadMembers());
    if (mems && mems.length > 0) {
      storage.saveMembers(mems);
    }
    return mems;
  },

  async updateMember(member: FamilyMember): Promise<FamilyMember> {
    const members = storage.loadMembers();
    const idx = members.findIndex(m => m.id === member.id);
    if (idx >= 0) members[idx] = member;
    else members.push(member);
    storage.saveMembers(members);

    fetchWithFallback(
      '/api/members',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member)
      },
      () => member
    ).catch(() => {});

    return member;
  },

  async addMember(member: Partial<FamilyMember>): Promise<FamilyMember> {
    const newM: FamilyMember = {
      id: member.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
        headers: { 'Content-Type': 'application/json' },
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
    if (items && items.length > 0) {
      storage.saveShoppingItems(items);
    }
    return items;
  },

  async addShoppingItem(item: Partial<ShoppingItem>): Promise<ShoppingItem> {
    const newItem: ShoppingItem = {
      id: item.id || `shop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    if (events && events.length > 0) {
      // Normalize dates to YYYY-MM-DD
      const normalized = events.map(e => ({
        ...e,
        date: (e.date || '').split('T')[0]
      }));
      storage.saveCalendarEvents(normalized);
      return normalized;
    }
    return storage.loadCalendarEvents();
  },

  async addCalendarEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const normalizedDate = (event.date || new Date().toISOString()).split('T')[0];
    const newEvent: CalendarEvent = {
      id: event.id || `cal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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

    // Save immediately to local storage and trigger instant UI update
    const events = storage.loadCalendarEvents();
    events.push(newEvent);
    // Sort by date and time
    events.sort((a, b) => {
      const dComp = a.date.localeCompare(b.date);
      if (dComp !== 0) return dComp;
      return (a.time || '').localeCompare(b.time || '');
    });
    storage.saveCalendarEvents(events);

    // Also sync to Cosmos DB
    fetchWithFallback(
      '/api/calendar',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent)
      },
      () => newEvent
    ).catch(err => {
      console.warn('Background sync of calendar event to backend skipped/failed:', err);
    });

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
        headers: { 'Content-Type': 'application/json' },
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
    if (posts && posts.length > 0) {
      storage.saveFeedPosts(posts);
    }
    return posts;
  },

  async addFeedPost(post: Partial<FeedPost>): Promise<FeedPost> {
    const newPost: FeedPost = {
      id: post.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      authorId: post.authorId || 'mem_1',
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post)
      },
      () => post
    ).catch(() => {});

    return post;
  },

  // AI Parser Endpoint
  async parseAiPrompt(prompt: string, memberNames: string[] = ['Papa', 'Mama', 'Mia', 'Jonas', 'Papa Thomas', 'Mama Lisa']): Promise<AiParseResponse> {
    try {
      const res = await fetch('/api/ai-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, memberNames })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('AI Azure Function offline or slow, running local client parser:', err);
    }

    // High-precision client-side NLP parser
    const localActions = parseGermanTextLocally(prompt, memberNames);
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
