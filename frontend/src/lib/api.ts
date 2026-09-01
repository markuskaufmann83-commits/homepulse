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

export const Api = {
  // ==========================================
  // MEMBERS
  // ==========================================
  async getMembers(): Promise<FamilyMember[]> {
    const local = storage.loadMembers();
    const session = storage.getAuthSession();
    if (!session) return local;

    try {
      const res = await fetch(`/api/members?householdId=${session.household.id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const serverItems = (await res.json()) as FamilyMember[];
        if (Array.isArray(serverItems) && serverItems.length > 0) {
          const map = new Map<string, FamilyMember>();
          local.forEach(m => map.set(m.id, m));
          serverItems.forEach(m => map.set(m.id, m));
          const merged = Array.from(map.values());
          storage.saveMembers(merged, false); // Don't trigger event loop
          return merged;
        }
      }
    } catch {}

    if (local.length > 0) return local;
    if (session?.member) {
      const init = [session.member];
      storage.saveMembers(init, false);
      return init;
    }
    return [];
  },

  async updateMember(member: FamilyMember): Promise<FamilyMember> {
    const householdId = storage.getActiveHouseholdId();
    const now = new Date().toISOString();
    const normalized = { ...member, householdId: member.householdId || householdId, updatedAt: now };

    const members = storage.loadMembers();
    const idx = members.findIndex(m => m.id === normalized.id);
    if (idx >= 0) members[idx] = normalized;
    else members.push(normalized);
    storage.saveMembers(members, true);

    fetch('/api/members', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(normalized)
    }).catch(() => {});

    return normalized;
  },

  async addMember(member: Partial<FamilyMember>): Promise<FamilyMember> {
    const householdId = storage.getActiveHouseholdId();
    const now = new Date().toISOString();
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
      updatedAt: now
    };

    const members = storage.loadMembers();
    members.push(newM);
    storage.saveMembers(members, true);

    fetch('/api/members', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newM)
    }).catch(() => {});

    return newM;
  },

  async deleteMember(id: string): Promise<boolean> {
    const members = storage.loadMembers().filter(m => m.id !== id);
    storage.saveMembers(members, true);

    fetch(`/api/members?id=${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).catch(() => {});

    return true;
  },

  // ==========================================
  // SHOPPING ITEMS
  // ==========================================
  async getShoppingItems(): Promise<ShoppingItem[]> {
    const local = storage.loadShoppingItems();
    const session = storage.getAuthSession();
    if (!session) return local;

    try {
      const res = await fetch(`/api/shopping?householdId=${session.household.id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const serverItems = (await res.json()) as ShoppingItem[];
        if (Array.isArray(serverItems)) {
          // Robust Union-Merge: Never delete locally existing items!
          const itemMap = new Map<string, ShoppingItem>();

          // 1. Put all local items in the map
          local.forEach(item => itemMap.set(item.id, item));

          // 2. Merge server items: update if server item is newer or local has no recent toggle
          serverItems.forEach(serverItem => {
            const localItem = itemMap.get(serverItem.id);
            if (!localItem) {
              itemMap.set(serverItem.id, serverItem);
            } else {
              const localTime = new Date(localItem.updatedAt || localItem.createdAt).getTime();
              const serverTime = new Date(serverItem.updatedAt || serverItem.createdAt).getTime();
              // Only overwrite local if server is explicitly newer and local was not changed in the last 15s
              if (serverTime > localTime && Date.now() - localTime > 15000) {
                itemMap.set(serverItem.id, serverItem);
              }
            }
          });

          const merged = Array.from(itemMap.values());
          // Sort uncompleted first, then by createdAt desc
          merged.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return b.createdAt.localeCompare(a.createdAt);
          });

          storage.saveShoppingItems(merged, false); // Don't trigger event loop
          return merged;
        }
      }
    } catch {}

    return local;
  },

  async addShoppingItem(item: Partial<ShoppingItem>): Promise<ShoppingItem> {
    const householdId = storage.getActiveHouseholdId();
    const now = new Date().toISOString();
    const newItem: ShoppingItem = {
      id: item.id || `shop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      householdId: item.householdId || householdId,
      title: item.title!,
      category: item.category || 'Sonstiges',
      quantity: item.quantity || 1,
      unit: item.unit,
      assignedMemberId: item.assignedMemberId,
      completed: !!item.completed,
      createdAt: now,
      updatedAt: now
    };

    // Save immediately locally and emit event to update UI
    const items = storage.loadShoppingItems();
    items.unshift(newItem);
    storage.saveShoppingItems(items, true);

    // Sync in background to Cosmos DB
    fetch('/api/shopping', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newItem)
    }).catch(() => {});

    return newItem;
  },

  async updateShoppingItem(item: ShoppingItem): Promise<ShoppingItem> {
    const now = new Date().toISOString();
    const updated = { ...item, updatedAt: now };

    const items = storage.loadShoppingItems();
    const idx = items.findIndex(i => i.id === updated.id);
    if (idx >= 0) items[idx] = updated;
    storage.saveShoppingItems(items, true);

    fetch('/api/shopping', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updated)
    }).catch(() => {});

    return updated;
  },

  async toggleShoppingItem(id: string, memberName?: string): Promise<ShoppingItem | null> {
    const items = storage.loadShoppingItems();
    const item = items.find(i => i.id === id);
    if (!item) return null;

    const now = new Date().toISOString();
    item.completed = !item.completed;
    item.updatedAt = now;

    if (item.completed) {
      item.completedBy = memberName || 'Jemand';
      item.completedAt = now;
    } else {
      delete item.completedBy;
      delete item.completedAt;
    }

    storage.saveShoppingItems(items, true);

    fetch('/api/shopping', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(item)
    }).catch(() => {});

    return item;
  },

  async deleteShoppingItem(id: string): Promise<boolean> {
    const items = storage.loadShoppingItems().filter(i => i.id !== id);
    storage.saveShoppingItems(items, true);

    fetch(`/api/shopping?id=${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).catch(() => {});

    return true;
  },

  async clearCompletedShoppingItems(): Promise<boolean> {
    const items = storage.loadShoppingItems().filter(i => !i.completed);
    storage.saveShoppingItems(items, true);

    fetch('/api/shopping?action=clear_completed', {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).catch(() => {});

    return true;
  },

  // ==========================================
  // CALENDAR EVENTS
  // ==========================================
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const local = storage.loadCalendarEvents();
    const session = storage.getAuthSession();
    if (!session) return local;

    try {
      const res = await fetch(`/api/calendar?householdId=${session.household.id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const events = (await res.json()) as CalendarEvent[];
        if (Array.isArray(events)) {
          const map = new Map<string, CalendarEvent>();

          // Put all local events in map
          local.forEach(e => {
            const cleanDate = (e.date || '').split('T')[0];
            map.set(e.id, { ...e, date: cleanDate });
          });

          // Merge server events without deleting local events
          events.forEach(serverEv => {
            const cleanDate = (serverEv.date || '').split('T')[0];
            const normalized = { ...serverEv, date: cleanDate };
            map.set(serverEv.id, normalized);
          });

          const merged = Array.from(map.values());
          merged.sort((a, b) => {
            const dComp = a.date.localeCompare(b.date);
            if (dComp !== 0) return dComp;
            return (a.time || '').localeCompare(b.time || '');
          });

          storage.saveCalendarEvents(merged, false); // Don't trigger event loop
          return merged;
        }
      }
    } catch {}

    return local;
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
    storage.saveCalendarEvents(events, true);

    fetch('/api/calendar', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newEvent)
    }).catch(() => {});

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
    storage.saveCalendarEvents(events, true);

    fetch('/api/calendar', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(normalized)
    }).catch(() => {});

    return normalized;
  },

  async deleteCalendarEvent(id: string): Promise<boolean> {
    const events = storage.loadCalendarEvents().filter(e => e.id !== id);
    storage.saveCalendarEvents(events, true);

    fetch(`/api/calendar?id=${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).catch(() => {});

    return true;
  },

  // ==========================================
  // FEED POSTS
  // ==========================================
  async getFeedPosts(): Promise<FeedPost[]> {
    const local = storage.loadFeedPosts();
    const session = storage.getAuthSession();
    if (!session) return local;

    try {
      const res = await fetch(`/api/feed?householdId=${session.household.id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const posts = (await res.json()) as FeedPost[];
        if (Array.isArray(posts)) {
          const map = new Map<string, FeedPost>();
          local.forEach(p => map.set(p.id, p));
          posts.forEach(p => map.set(p.id, p));
          const merged = Array.from(map.values());
          merged.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return b.timestamp.localeCompare(a.timestamp);
          });
          storage.saveFeedPosts(merged, false); // Don't trigger event loop
          return merged;
        }
      }
    } catch {}

    return local;
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
    storage.saveFeedPosts(posts, true);

    fetch('/api/feed', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newPost)
    }).catch(() => {});

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
      storage.saveFeedPosts(posts, true);
    }

    fetch('/api/feed?action=comment', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ postId, content, authorId })
    }).catch(() => {});

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

    storage.saveFeedPosts(posts, true);

    fetch('/api/feed', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(post)
    }).catch(() => {});

    return post;
  },

  // ==========================================
  // AI PARSER
  // ==========================================
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

  // ==========================================
  // BILLING
  // ==========================================
  async getSubscription(): Promise<SubscriptionStatus> {
    try {
      const res = await fetch('/api/billing', { headers: getAuthHeaders() });
      if (res.ok) {
        const sub = await res.json();
        storage.saveSubscription(sub, false);
        return sub;
      }
    } catch {}
    return storage.loadSubscription();
  }
};
