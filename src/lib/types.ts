export type UnwrapStyle = "A" | "B" | "C";

export type Channel = "sms" | "email";

export type MessageStatus = "draft" | "sent";

export const ALLOWED_REACTIONS = ["💛", "😊", "😭", "🥹", "😌", "🙏", "🫶", "✨"] as const;

export type AllowedReactionEmoji = (typeof ALLOWED_REACTIONS)[number];

export interface TinyKindMessage {
  id: string;
  userId: string;
  recipientId: string;
  senderName: string;
  senderNotifyEmail: string | null;
  recipientName: string;
  recipientContact: string;
  channel: Channel;
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

export interface Reaction {
  id: string;
  messageId: string;
  emoji: AllowedReactionEmoji;
  createdAt: string;
  recipientFingerprint: string;
}
