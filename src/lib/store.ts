import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  type AllowedReactionEmoji,
  ALLOWED_REACTIONS,
  type Channel,
  type DeliveryMode,
  type MessageOpen,
  type Reaction,
  type ReminderSettings,
  type SenderProfile,
  type TinyKindEvent,
  type TinyKindEventType,
  type TinyKindMessage,
  type UnwrapStyle,
} from "@/lib/types";

interface TinyKindDb {
  messages: TinyKindMessage[];
  reactions: Reaction[];
  opens: MessageOpen[];
  senderProfiles: SenderProfile[];
  events: TinyKindEvent[];
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
const EMPTY_DB: TinyKindDb = {
  messages: [],
  reactions: [],
  opens: [],
  senderProfiles: [],
  events: [],
};

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
    deliveryMode: message.deliveryMode === "email" ? "email" : "link",
    deletedAt: message.deletedAt ?? null,
  })) as TinyKindMessage[];
  const senderProfiles = (parsed.senderProfiles ?? []).map((profile) => ({
    ...profile,
    displayName: profile.displayName ?? null,
    reminder: {
      enabled: profile.reminder?.enabled ?? false,
      weekday: Number(profile.reminder?.weekday ?? 0),
      hour: Number(profile.reminder?.hour ?? 15),
      minute: Number(profile.reminder?.minute ?? 0),
      timezone: profile.reminder?.timezone ?? "America/Los_Angeles",
      lastSentWeekKey: profile.reminder?.lastSentWeekKey ?? null,
    },
  })) as SenderProfile[];
  const events = (parsed.events ?? []) as TinyKindEvent[];
  const reactions = (parsed.reactions ?? []).map((reaction) => ({
    ...reaction,
    notifiedAt: reaction.notifiedAt ?? null,
  })) as Reaction[];
  const opens = (parsed.opens ?? []).map((entry) => ({
    ...entry,
    notifiedAt: entry.notifiedAt ?? null,
  })) as MessageOpen[];
  return {
    messages,
    reactions,
    opens,
    senderProfiles,
    events,
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

function defaultReminderSettings(): ReminderSettings {
  return {
    enabled: false,
    weekday: 0,
    hour: 15,
    minute: 0,
    timezone: "America/Los_Angeles",
    lastSentWeekKey: null,
  };
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

async function logEvent(
  db: TinyKindDb,
  type: TinyKindEventType,
  payload: {
    messageId?: string | null;
    senderEmail?: string | null;
    metadata?: Record<string, string | number | boolean | null | undefined>;
  } = {},
): Promise<void> {
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.metadata ?? {})) {
    if (value === null || value === undefined) {
      continue;
    }
    metadata[key] = String(value);
  }
  db.events.push({
    id: randomUUID(),
    type,
    createdAt: new Date().toISOString(),
    messageId: payload.messageId ?? null,
    senderEmail: payload.senderEmail ?? null,
    metadata,
  });
}

function getOrCreateSenderProfile(db: TinyKindDb, email: string, displayName?: string | null): SenderProfile {
  const normalized = trimAndLower(email);
  const existing = db.senderProfiles.find((profile) => profile.email === normalized);
  if (existing) {
    if (displayName) {
      const cleanedDisplayName = trimAndSingleSpace(displayName);
      if (cleanedDisplayName && existing.displayName !== cleanedDisplayName) {
        existing.displayName = cleanedDisplayName;
      }
    }
    return existing;
  }
  const now = new Date().toISOString();
  const cleanedDisplayName = displayName ? trimAndSingleSpace(displayName) : null;
  const created: SenderProfile = {
    id: randomUUID(),
    email: normalized,
    displayName: cleanedDisplayName || null,
    createdAt: now,
    updatedAt: now,
    reminder: defaultReminderSettings(),
  };
  db.senderProfiles.push(created);
  return created;
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
  deliveryMode?: DeliveryMode;
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
  const deliveryMode: DeliveryMode = input.deliveryMode === "email" ? "email" : "link";
  const channel: Channel = input.channel ?? (deliveryMode === "email" ? "email" : "sms");
  const message: TinyKindMessage = {
    id: randomUUID(),
    userId: "local-dev-user",
    recipientId: randomUUID(),
    senderName,
    senderNotifyEmail,
    recipientName,
    recipientContact: recipientContact || null,
    channel,
    deliveryMode,
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
  if (senderNotifyEmail) {
    const profile = getOrCreateSenderProfile(db, senderNotifyEmail, senderName);
    if (senderName && profile.displayName !== senderName) {
      profile.displayName = senderName;
    }
    profile.updatedAt = now;
  }
  await logEvent(db, "message_created", {
    messageId: message.id,
    senderEmail: senderNotifyEmail,
    metadata: {
      slug: message.shortLinkSlug,
      channel: message.channel,
      deliveryMode: message.deliveryMode,
    },
  });
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
  await logEvent(db, "message_deleted", {
    messageId: target.id,
    senderEmail: target.senderNotifyEmail,
    metadata: { slug: target.shortLinkSlug },
  });
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
    if (changed) {
      // Force notification attempt for the new reaction selection.
      existing.notifiedAt = null;
    }
    if (changed) {
      await logEvent(db, "reaction_saved", {
        messageId: message.id,
        senderEmail: message.senderNotifyEmail,
        metadata: { emoji: input.emoji, mode: "update" },
      });
    }
    await writeDb(db);
    return { reaction: existing, message, changed };
  }

  const reaction: Reaction = {
    id: randomUUID(),
    messageId: message.id,
    emoji: input.emoji,
    createdAt: now,
    recipientFingerprint: input.recipientFingerprint,
    notifiedAt: null,
  };
  db.reactions.push(reaction);
  await logEvent(db, "reaction_saved", {
    messageId: message.id,
    senderEmail: message.senderNotifyEmail,
    metadata: { emoji: input.emoji, mode: "create" },
  });
  await writeDb(db);
  return { reaction, message, changed: true };
}

export async function markReactionNotificationSent(reactionId: string): Promise<void> {
  const db = await readDb();
  const reaction = db.reactions.find((item) => item.id === reactionId);
  if (!reaction) {
    return;
  }
  reaction.notifiedAt = new Date().toISOString();
  await writeDb(db);
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

export async function listRecentEvents(limit = 200): Promise<TinyKindEvent[]> {
  const db = await readDb();
  return [...db.events].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
}

export async function addOperationalEvent(
  type: TinyKindEventType,
  payload: {
    messageId?: string | null;
    senderEmail?: string | null;
    metadata?: Record<string, string | number | boolean | null | undefined>;
  } = {},
): Promise<void> {
  const db = await readDb();
  await logEvent(db, type, payload);
  await writeDb(db);
}

export async function listMessagesBySenderEmail(
  senderEmail: string,
  limit = 200,
): Promise<MessageWithLatestReaction[]> {
  const normalized = trimAndLower(senderEmail);
  const rows = await listRecentMessagesWithLatestReaction(limit * 3);
  return rows
    .filter(({ message }) => (message.senderNotifyEmail ? message.senderNotifyEmail === normalized : false))
    .slice(0, limit);
}

export async function countSentBySenderEmail(senderEmail: string): Promise<number> {
  const normalized = trimAndLower(senderEmail);
  const db = await readDb();
  return db.messages.filter(
    (message) => !message.deletedAt && message.senderNotifyEmail && message.senderNotifyEmail === normalized,
  ).length;
}

export async function ensureSenderProfile(email: string, displayName?: string | null): Promise<SenderProfile> {
  const normalized = trimAndLower(email);
  const db = await readDb();
  const profile = getOrCreateSenderProfile(db, normalized, displayName);
  profile.updatedAt = new Date().toISOString();
  await writeDb(db);
  return profile;
}

export async function getSenderProfile(email: string): Promise<SenderProfile | null> {
  const normalized = trimAndLower(email);
  const db = await readDb();
  return db.senderProfiles.find((profile) => profile.email === normalized) ?? null;
}

export async function updateReminderSettings(
  email: string,
  input: {
    enabled: boolean;
    weekday: number;
    hour: number;
    minute: number;
    timezone: string;
  },
): Promise<SenderProfile> {
  const normalized = trimAndLower(email);
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) {
    throw new Error("weekday must be between 0 and 6.");
  }
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    throw new Error("hour must be between 0 and 23.");
  }
  if (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59) {
    throw new Error("minute must be between 0 and 59.");
  }
  const timezone = input.timezone.trim();
  if (!timezone) {
    throw new Error("timezone is required.");
  }

  const db = await readDb();
  const profile = getOrCreateSenderProfile(db, normalized);
  profile.reminder = {
    ...profile.reminder,
    enabled: input.enabled,
    weekday: input.weekday,
    hour: input.hour,
    minute: input.minute,
    timezone,
  };
  profile.updatedAt = new Date().toISOString();
  await logEvent(db, "reminder_settings_updated", {
    senderEmail: normalized,
    metadata: {
      enabled: input.enabled,
      weekday: input.weekday,
      hour: input.hour,
      minute: input.minute,
      timezone,
    },
  });
  await writeDb(db);
  return profile;
}

function getIsoWeekKey(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  return `${year}-${month}-${day}-${weekday}`;
}

function getLocalTimeParts(date: Date, timezone: string): { weekday: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekdayLabel = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    weekday: weekdayMap[weekdayLabel] ?? 0,
    hour,
    minute,
  };
}

export interface DueReminder {
  senderEmail: string;
  profileId: string;
}

export async function listDueReminders(now = new Date()): Promise<DueReminder[]> {
  const db = await readDb();
  const due: DueReminder[] = [];
  for (const profile of db.senderProfiles) {
    const reminder = profile.reminder ?? defaultReminderSettings();
    if (!reminder.enabled) {
      continue;
    }
    const local = getLocalTimeParts(now, reminder.timezone);
    if (local.weekday !== reminder.weekday) {
      continue;
    }
    const minuteDelta = Math.abs(local.hour * 60 + local.minute - (reminder.hour * 60 + reminder.minute));
    if (minuteDelta > 10) {
      continue;
    }
    const weekKey = getIsoWeekKey(now, reminder.timezone);
    if (reminder.lastSentWeekKey === weekKey) {
      continue;
    }
    due.push({ senderEmail: profile.email, profileId: profile.id });
  }
  return due;
}

export async function markReminderSent(senderEmail: string, at = new Date()): Promise<void> {
  const normalized = trimAndLower(senderEmail);
  const db = await readDb();
  const profile = db.senderProfiles.find((item) => item.email === normalized);
  if (!profile) {
    return;
  }
  const timezone = profile.reminder?.timezone || "America/Los_Angeles";
  const weekKey = getIsoWeekKey(at, timezone);
  profile.reminder = {
    ...(profile.reminder ?? defaultReminderSettings()),
    lastSentWeekKey: weekKey,
  };
  profile.updatedAt = at.toISOString();
  await writeDb(db);
}

interface RecordOpenInput {
  slug: string;
  recipientFingerprint: string;
}

export async function recordOpen(input: RecordOpenInput): Promise<{
  open: MessageOpen;
  message: TinyKindMessage;
  shouldNotify: boolean;
}> {
  const db = await readDb();
  const message = db.messages.find(
    (item) => item.shortLinkSlug === input.slug && item.status === "sent" && !item.deletedAt,
  );
  if (!message) {
    throw new Error("Message not found.");
  }

  const now = new Date();
  const cooldownMs = 30 * 60 * 1000;
  const lastNotifiedForFingerprint = db.opens
    .filter(
      (entry) =>
        entry.messageId === message.id &&
        entry.recipientFingerprint === input.recipientFingerprint &&
        entry.notifiedAt,
    )
    .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))[0];

  const shouldNotify =
    !lastNotifiedForFingerprint ||
    now.getTime() - new Date(lastNotifiedForFingerprint.notifiedAt as string).getTime() >= cooldownMs;

  const open: MessageOpen = {
    id: randomUUID(),
    messageId: message.id,
    recipientFingerprint: input.recipientFingerprint,
    openedAt: now.toISOString(),
    notifiedAt: null,
  };
  db.opens.push(open);
  await logEvent(db, "message_opened", {
    messageId: message.id,
    senderEmail: message.senderNotifyEmail,
    metadata: {
      slug: message.shortLinkSlug,
      fingerprint: input.recipientFingerprint,
    },
  });
  await writeDb(db);
  return { open, message, shouldNotify };
}

export async function markOpenNotificationSent(openId: string): Promise<void> {
  const db = await readDb();
  const open = db.opens.find((item) => item.id === openId);
  if (!open) {
    return;
  }
  open.notifiedAt = new Date().toISOString();
  await writeDb(db);
}
