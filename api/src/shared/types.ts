export type MemberStatus = 'home' | 'away' | 'work' | 'school' | 'vacation';

export interface User {
  id: string;
  email: string;
  name: string;
  householdId: string;
  role: 'admin' | 'member';
  emailVerified: boolean;
  verificationCode?: string;
  verificationToken?: string;
  verificationExpiresAt?: string;
  resetPasswordCode?: string;
  resetPasswordToken?: string;
  resetPasswordExpiresAt?: string;
  passwordHash?: string;
  createdAt: string;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  householdId: string;
  userId?: string;
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
  householdId: string;
  title: string;
  category: ShoppingCategory;
  quantity?: number;
  unit?: string;
  assignedMemberId?: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CalendarEvent {
  id: string;
  householdId: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  assignedMemberIds: string[]; // Member IDs or ['all']
  category: 'Familie' | 'Arbeit' | 'Schule' | 'Freizeit' | 'Arzt' | 'Sonstiges';
  isAllDay?: boolean;
  createdAt: string;
  // Google Sync metadata
  isGoogleSynced?: boolean;
  googleEventId?: string;
  externalSource?: 'google' | 'google_calendar' | 'manual' | 'ai';
}

export interface GoogleCalendarConfig {
  memberId: string;
  iCalUrl?: string;
  autoSync: boolean;
  lastSync?: string;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

export type FeedPostType = 'photo' | 'note' | 'announcement' | 'achievement' | 'status' | 'meal' | 'alert';

export interface FeedComment {
  id: string;
  authorId: string;
  content: string;
  timestamp: string;
}

export interface FeedPost {
  id: string;
  householdId: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  type: FeedPostType;
  timestamp: string;
  reactions: Record<string, string[]>; // emoji -> memberIds[]
  comments: FeedComment[];
  pinned?: boolean;
}

// Authentication API Types
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  householdName?: string;
  inviteCode?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface JoinHouseholdRequest {
  inviteCode: string;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    householdId: string;
    role: 'admin' | 'member';
    emailVerified: boolean;
  };
  household: Household;
  member: FamilyMember;
  token: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  session?: AuthSession;
  requiresEmailVerification?: boolean;
  email?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  session?: AuthSession;
}

export interface VerifyEmailRequest {
  email: string;
  code?: string;
  token?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code?: string;
  token?: string;
  newPassword: string;
}

// AI Action Types
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
  date: string;
  time?: string;
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
