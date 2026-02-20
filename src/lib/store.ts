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

const PROD_DEFAULT_DATA_DIR = "/var/data";
const DATA_DIR = process.env.TINYKIND_DATA_DIR
  ? path.resolve(process.env.TINYKIND_DATA_DIR)
  : process.env.NODE_ENV === "production"
    ? PROD_DEFAULT_DATA_DIR
    : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "tinykind.json");
const BACKUP_DIR = process.env.TINYKIND_BACKUP_DIR
  ? path.resolve(process.env.TINYKIND_BACKUP_DIR)
  : path.join(DATA_DIR, "backups");
const BACKUP_ON_WRITE = process.env.TINYKIND_BACKUP_ON_WRITE !== "0";
const BACKUP_MAX_FILES = Number(process.env.TINYKIND_BACKUP_MAX_FILES ?? "400");
const BACKUP_RETENTION_DAYS = Number(process.env.TINYKIND_BACKUP_RETENTION_DAYS ?? "30");
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
    recipientContact: message.recipientContact ?? null,
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
  if (BACKUP_ON_WRITE) {
    void writeBackupSnapshot(db);
  }
}

function backupFileName(date: Date): string {
  const iso = date.toISOString().replace(/[:.]/g, "-");
  return `tinykind-${iso}.json`;
}

async function writeBackupSnapshot(db: TinyKindDb): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const filePath = path.join(BACKUP_DIR, backupFileName(new Date()));
    await fs.writeFile(filePath, JSON.stringify(db, null, 2), "utf8");
    await pruneBackups();
  } catch (error) {
    // Backups are best-effort; writes should not fail if backup storage has issues.
    console.error("[tinykind] backup snapshot failed", error);
  }
}

async function pruneBackups(): Promise<void> {
  const files = await fs.readdir(BACKUP_DIR);
  const full = await Promise.all(
    files
      .filter((name) => name.startsWith("tinykind-") && name.endsWith(".json"))
      .map(async (name) => {
        const filePath = path.join(BACKUP_DIR, name);
        const stat = await fs.stat(filePath);
        return { name, filePath, mtimeMs: stat.mtimeMs };
      }),
  );

  full.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const now = Date.now();
  const maxAgeMs = Math.max(BACKUP_RETENTION_DAYS, 1) * 24 * 60 * 60 * 1000;
  const toDelete = full.filter((item, index) => {
    const tooOld = now - item.mtimeMs > maxAgeMs;
    const tooMany = index >= Math.max(BACKUP_MAX_FILES, 20);
    return tooOld || tooMany;
  });

  await Promise.all(toDelete.map((item) => fs.unlink(item.filePath).catch(() => undefined)));
}

export async function createManualBackupSnapshot(): Promise<{
  path: string;
  count: number;
}> {
  const db = await readDb();
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const filePath = path.join(BACKUP_DIR, backupFileName(new Date()));
  await fs.writeFile(filePath, JSON.stringify(db, null, 2), "utf8");
  await pruneBackups();
  return { path: filePath, count: db.messages.filter((item) => !item.deletedAt).length };
}

export async function getStorageDiagnostics(): Promise<{
  dataDir: string;
  dataFile: string;
  backupDir: string;
  backupOnWrite: boolean;
  backupRetentionDays: number;
  backupMaxFiles: number;
  dataFileExists: boolean;
  backupCount: number;
  messageCount: number;
}> {
  let dataFileExists = false;
  try {
    await fs.access(DATA_FILE);
    dataFileExists = true;
  } catch {
    dataFileExists = false;
  }

  let backupCount = 0;
  try {
    const files = await fs.readdir(BACKUP_DIR);
    backupCount = files.filter((name) => name.startsWith("tinykind-") && name.endsWith(".json")).length;
  } catch {
    backupCount = 0;
  }

  const db = await readDb();
  return {
    dataDir: DATA_DIR,
    dataFile: DATA_FILE,
    backupDir: BACKUP_DIR,
    backupOnWrite: BACKUP_ON_WRITE,
    backupRetentionDays: BACKUP_RETENTION_DAYS,
    backupMaxFiles: BACKUP_MAX_FILES,
    dataFileExists,
    backupCount,
    messageCount: db.messages.filter((item) => !item.deletedAt).length,
  };
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
  if (cleaned.length > 500) {
    throw new Error("Message body must be 500 characters or fewer.");
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
  recipientContact?: string | null;
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
  const recipientContact = trimAndSingleSpace(input.recipientContact ?? "");

  if (!senderName) {
    throw new Error("senderName is required.");
  }
  if (!recipientName) {
    throw new Error("recipientName is required.");
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
    recipientContact: recipientContact || null,
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
