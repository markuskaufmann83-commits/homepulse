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
      // If array is returned and not empty, or non-array
      if (Array.isArray(data)) {
        if (data.length > 0) {
          return data;
        } else if (fallbackFn) {
          // If empty array, fallback to default initial local data
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
    return fetchWithFallback('/api/members', { method: 'GET' }, () => storage.loadMembers());
  },

  async updateMember(member: FamilyMember): Promise<FamilyMember> {
    return fetchWithFallback(
      '/api/members',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member)
      },
      () => {
        const members = storage.loadMembers();
        const idx = members.findIndex(m => m.id === member.id);
        if (idx >= 0) members[idx] = member;
        else members.push(member);
        storage.saveMembers(members);
        return member;
      }
    );
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

    return fetchWithFallback(
      '/api/members',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newM)
      },
      () => {
        const members = storage.loadMembers();
        members.push(newM);
        storage.saveMembers(members);
        return newM;
      }
    );
  },

  async deleteMember(id: string): Promise<boolean> {
    return fetchWithFallback(
      `/api/members?id=${id}`,
      { method: 'DELETE' },
      () => {
        const members = storage.loadMembers().filter(m => m.id !== id);
        storage.saveMembers(members);
        return true;
      }
    );
  },

  // Shopping Items
  async getShoppingItems(): Promise<ShoppingItem[]> {
    return fetchWithFallback('/api/shopping', { method: 'GET' }, () => storage.loadShoppingItems());
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

    return fetchWithFallback(
      '/api/shopping',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      },
      () => {
        const items = storage.loadShoppingItems();
        items.unshift(newItem);
        storage.saveShoppingItems(items);
        return newItem;
      }
    );
  },

  async updateShoppingItem(item: ShoppingItem): Promise<ShoppingItem> {
    return fetchWithFallback(
      '/api/shopping',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      },
      () => {
        const items = storage.loadShoppingItems();
        const idx = items.findIndex(i => i.id === item.id);
        if (idx >= 0) items[idx] = item;
        storage.saveShoppingItems(items);
        return item;
      }
    );
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

    return fetchWithFallback(
      '/api/shopping',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      },
      () => {
        storage.saveShoppingItems(items);
        return item;
      }
    );
  },

  async deleteShoppingItem(id: string): Promise<boolean> {
    return fetchWithFallback(
      `/api/shopping?id=${id}`,
      { method: 'DELETE' },
      () => {
        const items = storage.loadShoppingItems().filter(i => i.id !== id);
        storage.saveShoppingItems(items);
        return true;
      }
    );
  },

  async clearCompletedShoppingItems(): Promise<boolean> {
    return fetchWithFallback(
      '/api/shopping?action=clear_completed',
      { method: 'DELETE' },
      () => {
        const items = storage.loadShoppingItems().filter(i => !i.completed);
        storage.saveShoppingItems(items);
        return true;
      }
    );
  },

  // Calendar Events
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    return fetchWithFallback('/api/calendar', { method: 'GET' }, () => storage.loadCalendarEvents());
  },

  async addCalendarEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const newEvent: CalendarEvent = {
      id: event.id || `cal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: event.title!,
      description: event.description,
      date: event.date!,
      time: event.time,
      endTime: event.endTime,
      location: event.location,
      assignedMemberIds: event.assignedMemberIds || ['all'],
      category: event.category || 'Familie',
      isAllDay: !!event.isAllDay,
      createdAt: new Date().toISOString(),
      isGoogleSynced: !!event.isGoogleSynced,
      googleEventId: event.googleEventId,
      externalSource: event.externalSource || 'manual'
    };

    return fetchWithFallback(
      '/api/calendar',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent)
      },
      () => {
        const events = storage.loadCalendarEvents();
        events.push(newEvent);
        storage.saveCalendarEvents(events);
        return newEvent;
      }
    );
  },

  async updateCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    return fetchWithFallback(
      '/api/calendar',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      },
      () => {
        const events = storage.loadCalendarEvents();
        const idx = events.findIndex(e => e.id === event.id);
        if (idx >= 0) events[idx] = event;
        storage.saveCalendarEvents(events);
        return event;
      }
    );
  },

  async deleteCalendarEvent(id: string): Promise<boolean> {
    return fetchWithFallback(
      `/api/calendar?id=${id}`,
      { method: 'DELETE' },
      () => {
        const events = storage.loadCalendarEvents().filter(e => e.id !== id);
        storage.saveCalendarEvents(events);
        return true;
      }
    );
  },

  // Feed Posts
  async getFeedPosts(): Promise<FeedPost[]> {
    return fetchWithFallback('/api/feed', { method: 'GET' }, () => storage.loadFeedPosts());
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

    return fetchWithFallback(
      '/api/feed',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost)
      },
      () => {
        const posts = storage.loadFeedPosts();
        posts.unshift(newPost);
        storage.saveFeedPosts(posts);
        return newPost;
      }
    );
  },

  async addFeedComment(postId: string, content: string, authorId: string): Promise<FeedPost | null> {
    const newComment: FeedComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      authorId,
      content,
      timestamp: new Date().toISOString()
    };

    return fetchWithFallback(
      '/api/feed?action=comment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, content, authorId })
      },
      () => {
        const posts = storage.loadFeedPosts();
        const post = posts.find(p => p.id === postId);
        if (post) {
          if (!post.comments) post.comments = [];
          post.comments.push(newComment);
          storage.saveFeedPosts(posts);
        }
        return post || null;
      }
    );
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

    return fetchWithFallback(
      '/api/feed',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post)
      },
      () => {
        storage.saveFeedPosts(posts);
        return post;
      }
    );
  },

  // AI Parser Endpoint
  async parseAiPrompt(prompt: string, memberNames: string[] = ['Papa', 'Mama', 'Mia', 'Jonas']): Promise<AiParseResponse> {
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
      console.warn('AI Azure Function offline, running local client parser:', err);
    }

    // Client-side local NLP fallback simulation
    return {
      rawText: prompt,
      actions: [
        {
          type: 'SHOPPING_ADD',
          item: prompt.replace(/^(setze|kauf|pack|schreib)\s+/i, '').trim() || 'Einkaufsartikel',
          category: 'Vorrat',
          assignedTo: 'Papa'
        }
      ],
      summary: '1 Aktion lokal erkannt (Offline-Modus)',
      source: 'rule_based'
    };
  },

  // Subscription Status
  async getSubscription(): Promise<SubscriptionStatus> {
    return fetchWithFallback('/api/billing', { method: 'GET' }, () => storage.loadSubscription());
  }
};
