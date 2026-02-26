export type UnwrapStyle = "A" | "B" | "C";

export type Channel = "sms" | "email";

export type MessageStatus = "draft" | "sent";

export type DeliveryMode = "link" | "email";

export const ALLOWED_REACTIONS = ["❤️", "😊", "😭", "🥹", "😌", "🙏", "🫶", "✨"] as const;

export type AllowedReactionEmoji = (typeof ALLOWED_REACTIONS)[number];

export interface TinyKindMessage {
  id: string;
  userId: string;
  recipientId: string;
  senderName: string;
  senderNotifyEmail: string | null;
  recipientName: string;
  recipientContact: string | null;
  channel: Channel;
  deliveryMode: DeliveryMode;
  createdAt: string;
  rawText: string | null;
  voiceUrl: string | null;
  voiceDurationSeconds: number | null;
  transcriptRaw: string | null;
  transcriptCleaned: string | null;
  body: string;
  unwrapStyle: UnwrapStyle;
  shortLinkSlug: string;
  status: MessageStatus;
  deletedAt: string | null;
}

export interface MessageOpen {
  id: string;
  messageId: string;
  recipientFingerprint: string;
  openedAt: string;
  notifiedAt: string | null;
}

export interface Reaction {
  id: string;
  messageId: string;
  emoji: AllowedReactionEmoji;
  createdAt: string;
  recipientFingerprint: string;
  notifiedAt: string | null;
}

export type TinyKindEventType =
  | "message_created"
  | "message_deleted"
  | "reaction_saved"
  | "message_opened"
  | "reaction_notify_sent"
  | "reaction_notify_failed"
  | "open_notify_sent"
  | "open_notify_failed"
  | "auth_link_requested"
  | "auth_login_succeeded"
  | "reminder_settings_updated"
  | "reminder_email_sent"
  | "reminder_email_failed";

export interface TinyKindEvent {
  id: string;
  type: TinyKindEventType;
  createdAt: string;
  messageId: string | null;
  senderEmail: string | null;
  metadata: Record<string, string>;
}

export interface ReminderSettings {
  enabled: boolean;
  weekday: number; // 0-6 (Sun-Sat)
  hour: number; // 0-23
  minute: number; // 0-59
  timezone: string;
  lastSentWeekKey: string | null;
}

export interface SenderProfile {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
  reminder: ReminderSettings;
}
