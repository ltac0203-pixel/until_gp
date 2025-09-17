export type MessageStatus =
  | "pending"
  | "sending"
  | "sent"
  | "failed";

export type AttachmentType = "image" | "video";

export interface Attachment {
  id: string;
  uri: string;
  type: AttachmentType;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number; // For videos, in seconds
  thumbnailUri?: string; // For video thumbnails
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  timestamp: Date;
}

export interface Message {
  id: string;
  text: string;
  timestamp: Date;
  isOwnMessage: boolean;
  sender: string;
  status?: MessageStatus;
  deliveryTime?: Date;
  reactions?: MessageReaction[];
  attachments?: Attachment[]; // Media attachments
}

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
}

export type Theme = "light" | "dark";

export type GroupStatus = "active" | "expiring_soon" | "archived";

export type DisbandReason =
  | "time_expired"
  | "inactivity"
  | "message_limit"
  | "manual";

export type GroupLifespan =
  | "1_hour"
  | "24_hours"
  | "3_days"
  | "7_days"
  | "custom";

export interface GroupSettings {
  lifespan: GroupLifespan;
  expirationTime: Date; // Absolute time when group will disband
  inactivityThreshold?: number; // Days without activity before auto-disband
  messageLimit?: number; // Max messages before auto-disband
  warnBeforeExpiry: boolean; // Send notification before group expires
  allowExtension: boolean; // Allow members to extend group lifetime
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  members: ChatUser[];
  createdAt: Date;
  createdBy: string;
  lastMessage?: Message;
  lastActivity: Date;
  unreadCount: number;
  avatar?: string;
  messages: Message[];
  status: GroupStatus;
  settings: GroupSettings;
  messageCount: number;
  disbandedAt?: Date;
  disbandReason?: DisbandReason;
  archivedUntil?: Date; // When archived group will be permanently deleted
  inviteCode?: string; // Unique code for joining the group
  inviteCodeExpiresAt?: Date; // When the invite code expires
}

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  createdAt: Date;
}

export interface FlowGroupsSettings {
  theme: Theme;
  enableHaptics: boolean;
  enableTypingIndicator: boolean;
  defaultGroupLifespan: GroupLifespan;
  showExpirationWarnings: boolean;
  archiveRetentionDays: number; // How long to keep archived groups
  autoJoinSuggestions: boolean; // Suggest groups based on interests
  currentUser?: UserProfile; // Current user profile
}
