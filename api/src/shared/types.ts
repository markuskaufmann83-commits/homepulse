export type MemberStatus = 'home' | 'away' | 'work' | 'school' | 'vacation';

export interface FamilyMember {
  id: string;
  name: string;
  role: 'admin' | 'member' | 'child';
  avatar: string; // Emoji or image URL
  color: string; // Hex color code
  status: MemberStatus;
  statusMessage?: string;
  locationShared: boolean;
  updatedAt: string;
}

export type ShoppingCategory =
  | 'Frische'
  | 'Vorrat'
  | 'Obst & Gemüse'
  | 'Drogerie'
  | 'Getränke'
  | 'Tiefkühl'
  | 'Sonstiges';

export interface ShoppingItem {
  id: string;
  title: string;
  category: ShoppingCategory;
  quantity?: number;
  unit?: string;
  assignedMemberId?: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  assignedMemberIds: string[]; // Member IDs or ['all']
  category?: 'Familie' | 'Schule' | 'Arbeit' | 'Freizeit' | 'Arzt' | 'Sonstiges';
  isAllDay?: boolean;
  createdAt: string;
  isGoogleSynced?: boolean;
  googleEventId?: string;
  externalSource?: 'google_calendar' | 'ical' | 'manual';
}

export interface FeedComment {
  id: string;
  authorId: string;
  content: string;
  timestamp: string;
}

export type FeedPostType = 'status' | 'note' | 'alert' | 'meal';

export interface FeedPost {
  id: string;
  authorId: string;
  content: string;
  type: FeedPostType;
  timestamp: string;
  pinned?: boolean;
  reactions?: Record<string, string[]>; // emoji -> array of memberIds
  comments?: FeedComment[];
}

// Google Calendar Sync Configuration
export interface GoogleCalendarConfig {
  memberId: string;
  iCalUrl?: string;
  autoSync: boolean;
  lastSync?: string;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

// AI Voice & Text Action Types
export type AiActionType = 'SHOPPING_ADD' | 'CALENDAR_ADD' | 'FEED_POST' | 'STATUS_UPDATE';

export interface ShoppingAddAction {
  type: 'SHOPPING_ADD';
  item: string;
  category?: ShoppingCategory;
  quantity?: number;
  unit?: string;
  assignedTo?: string;
}

export interface CalendarAddAction {
  type: 'CALENDAR_ADD';
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  endTime?: string;
  assignedTo?: string;
  location?: string;
}

export interface FeedPostAction {
  type: 'FEED_POST';
  content: string;
  postType?: FeedPostType;
  author?: string;
}

export interface StatusUpdateAction {
  type: 'STATUS_UPDATE';
  memberName: string;
  newStatus: MemberStatus;
  statusMessage?: string;
}

export type AiAction =
  | ShoppingAddAction
  | CalendarAddAction
  | FeedPostAction
  | StatusUpdateAction;

export interface AiParseResponse {
  rawText: string;
  actions: AiAction[];
  summary: string;
  source: 'gemini' | 'openai' | 'rule_based';
}

// Google Play In-App Billing Types
export type SubscriptionTier = 'free' | 'premium' | 'family_plus';

export interface GooglePlayProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  type: 'subs' | 'inapp';
  billingPeriod?: 'P1M' | 'P1Y' | 'lifetime';
  features: string[];
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  active: boolean;
  productId?: string;
  purchaseToken?: string;
  expiresAt?: string;
  isLifetime?: boolean;
  orderId?: string;
  features: string[];
  lastVerifiedAt: string;
}

export interface PurchaseVerificationRequest {
  purchaseToken: string;
  productId: string;
  packageName: string;
  householdId?: string;
}

export interface PurchaseVerificationResponse {
  success: boolean;
  message: string;
  subscription: SubscriptionStatus;
}
