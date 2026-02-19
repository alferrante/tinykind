import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  type AllowedReactionEmoji,
  ALLOWED_REACTIONS,
  type Channel,
  type Reaction,
  type TinyKindMessage,
  type UnwrapStyle,
} from "@/lib/types";

interface TinyKindDb {
  messages: TinyKindMessage[];
  reactions: Reaction[];
}

const DATA_DIR = process.env.TINYKIND_DATA_DIR
  ? path.resolve(process.env.TINYKIND_DATA_DIR)
  : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "tinykind.json");
const EMPTY_DB: TinyKindDb = { messages: [], reactions: [] };

const STYLE_OPTIONS: UnwrapStyle[] = ["A", "B", "C"];

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

async function readDb(): Promise<TinyKindDb> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw) as Partial<TinyKindDb>;
  const messages = (parsed.messages ?? []).map((message) => ({
    ...message,
    senderNotifyEmail: message.senderNotifyEmail ?? null,
    deletedAt: message.deletedAt ?? null,
  })) as TinyKindMessage[];
  return {
    messages,
    reactions: parsed.reactions ?? [],
  };
}

async function writeDb(db: TinyKindDb): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

function trimAndSingleSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimAndLower(value: string): string {
  return value.trim().toLowerCase();
}

function validateBody(body: string): string {
  const cleaned = body.trim();
  if (!cleaned) {
    throw new Error("Message body is required.");
  }
  if (cleaned.length > 240) {
    throw new Error("Message body must be 240 characters or fewer.");
  }
  return cleaned;
}

function validateOptionalEmail(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  const cleaned = trimAndLower(value);
  if (!cleaned) {
    return null;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    throw new Error("senderNotifyEmail must be a valid email address.");
  }
  return cleaned;
}

function generateSlug(): string {
  return randomBytes(6).toString("base64url");
}

function randomStyle(): UnwrapStyle {
  const index = Math.floor(Math.random() * STYLE_OPTIONS.length);
  return STYLE_OPTIONS[index];
}

function isAllowedReaction(value: string): value is AllowedReactionEmoji {
  return ALLOWED_REACTIONS.includes(value as AllowedReactionEmoji);
}

export function makeRecipientFingerprint(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 20);
}

export interface CreateMessageInput {
  senderName: string;
  senderNotifyEmail?: string | null;
  recipientName: string;
  recipientContact: string;
  body: string;
  channel?: Channel;
  unwrapStyle?: UnwrapStyle;
  rawText?: string | null;
  voiceUrl?: string | null;
  voiceDurationSeconds?: number | null;
  transcriptRaw?: string | null;
  transcriptCleaned?: string | null;
}

export async function createMessage(input: CreateMessageInput): Promise<TinyKindMessage> {
  const senderName = trimAndSingleSpace(input.senderName);
  const senderNotifyEmail = validateOptionalEmail(input.senderNotifyEmail);
  const recipientName = trimAndSingleSpace(input.recipientName);
  const recipientContact = trimAndSingleSpace(input.recipientContact);

  if (!senderName) {
    throw new Error("senderName is required.");
  }
  if (!recipientName) {
    throw new Error("recipientName is required.");
  }
  if (!recipientContact) {
    throw new Error("recipientContact is required.");
  }

  const db = await readDb();
  let slug = generateSlug();
  while (db.messages.some((message) => message.shortLinkSlug === slug)) {
    slug = generateSlug();
  }

  const now = new Date().toISOString();
  const message: TinyKindMessage = {
    id: randomUUID(),
    userId: "local-dev-user",
    recipientId: randomUUID(),
    senderName,
    senderNotifyEmail,
    recipientName,
    recipientContact,
    channel: input.channel ?? "sms",
    createdAt: now,
    rawText: input.rawText ?? null,
    voiceUrl: input.voiceUrl ?? null,
    voiceDurationSeconds: input.voiceDurationSeconds ?? null,
    transcriptRaw: input.transcriptRaw ?? null,
    transcriptCleaned: input.transcriptCleaned ?? null,
    body: validateBody(input.body),
    unwrapStyle: input.unwrapStyle ?? randomStyle(),
    shortLinkSlug: slug,
    status: "sent",
    deletedAt: null,
  };

  db.messages.push(message);
  await writeDb(db);
  return message;
}

export async function getMessageBySlug(slug: string): Promise<TinyKindMessage | null> {
  const db = await readDb();
  return db.messages.find((message) => message.shortLinkSlug === slug && !message.deletedAt) ?? null;
}

export async function getMessageById(messageId: string): Promise<TinyKindMessage | null> {
  const db = await readDb();
  return db.messages.find((message) => message.id === messageId && !message.deletedAt) ?? null;
}

export async function deleteMessageById(messageId: string): Promise<boolean> {
  const db = await readDb();
  const target = db.messages.find((message) => message.id === messageId && !message.deletedAt);
  if (!target) {
    return false;
  }
  target.deletedAt = new Date().toISOString();
  await writeDb(db);
  return true;
}

export async function listRecentMessages(limit = 20): Promise<TinyKindMessage[]> {
  const db = await readDb();
  return db.messages
    .filter((message) => !message.deletedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

export interface MessageWithLatestReaction {
  message: TinyKindMessage;
  latestReaction: Reaction | null;
}

export async function listRecentMessagesWithLatestReaction(
  limit = 200,
): Promise<MessageWithLatestReaction[]> {
  const db = await readDb();
  const messages = db.messages
    .filter((message) => !message.deletedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);

  const latestByMessageId = new Map<string, Reaction>();
  const reactions = [...db.reactions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const reaction of reactions) {
    if (!latestByMessageId.has(reaction.messageId)) {
      latestByMessageId.set(reaction.messageId, reaction);
    }
  }

  return messages.map((message) => ({
    message,
    latestReaction: latestByMessageId.get(message.id) ?? null,
  }));
}

interface UpsertReactionInput {
  slug: string;
  emoji: string;
  recipientFingerprint: string;
}

export interface UpsertReactionResult {
  reaction: Reaction;
  message: TinyKindMessage;
  changed: boolean;
}

export async function upsertReaction(input: UpsertReactionInput): Promise<UpsertReactionResult> {
  if (!isAllowedReaction(input.emoji)) {
    throw new Error("Unsupported emoji.");
  }

  const db = await readDb();
  const message = db.messages.find(
    (item) => item.shortLinkSlug === input.slug && item.status === "sent" && !item.deletedAt,
  );
  if (!message) {
    throw new Error("Message not found.");
  }

  const now = new Date().toISOString();
  const existing = db.reactions.find(
    (reaction) =>
      reaction.messageId === message.id &&
      reaction.recipientFingerprint === input.recipientFingerprint,
  );

  if (existing) {
    const changed = existing.emoji !== input.emoji;
    existing.emoji = input.emoji;
    existing.createdAt = now;
    await writeDb(db);
    return { reaction: existing, message, changed };
  }

  const reaction: Reaction = {
    id: randomUUID(),
    messageId: message.id,
    emoji: input.emoji,
    createdAt: now,
    recipientFingerprint: input.recipientFingerprint,
  };
  db.reactions.push(reaction);
  await writeDb(db);
  return { reaction, message, changed: true };
}

export async function getLatestReactionForMessage(messageId: string): Promise<Reaction | null> {
  const db = await readDb();
  const latest = db.reactions
    .filter((reaction) => reaction.messageId === messageId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  return latest ?? null;
}

export async function getMessageWithLatestReactionBySlug(
  slug: string,
): Promise<{ message: TinyKindMessage; latestReaction: Reaction | null } | null> {
  const db = await readDb();
  const message = db.messages.find((item) => item.shortLinkSlug === slug && !item.deletedAt) ?? null;
  if (!message) {
    return null;
  }

  const latestReaction =
    db.reactions
      .filter((reaction) => reaction.messageId === message.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
  return { message, latestReaction };
}
