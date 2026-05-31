import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

interface Bucket {
  hits: number[];
  expiresAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;
let lastPrunedAt = 0;

function nowMs(): number {
  return Date.now();
}

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const base = forwarded || realIp || cloudflareIp || `ua:${userAgent}`;
  return createHash("sha256").update(base).digest("hex").slice(0, 24);
}

function pruneExpiredBuckets(timestamp: number): void {
  if (buckets.size < MAX_BUCKETS && timestamp - lastPrunedAt < 60_000) {
    return;
  }

  lastPrunedAt = timestamp;
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt <= timestamp) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  const overflow = buckets.size - MAX_BUCKETS;
  let deleted = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    deleted += 1;
    if (deleted >= overflow) {
      break;
    }
  }
}

export function enforceRateLimit(
  request: NextRequest,
  options: { scope: string; maxHits: number; windowMs: number; keySuffix?: string | null },
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const suffix = options.keySuffix ? `:${createHash("sha256").update(options.keySuffix).digest("hex").slice(0, 16)}` : "";
  const key = `${options.scope}:${getClientKey(request)}${suffix}`;
  const timestamp = nowMs();
  pruneExpiredBuckets(timestamp);
  const windowStart = timestamp - options.windowMs;
  const existing = buckets.get(key) ?? { hits: [], expiresAt: timestamp + options.windowMs };
  existing.hits = existing.hits.filter((hit) => hit >= windowStart);
  existing.expiresAt = timestamp + options.windowMs;

  if (existing.hits.length >= options.maxHits) {
    const oldest = existing.hits[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - timestamp) / 1000));
    buckets.set(key, existing);
    return { ok: false, retryAfterSeconds };
  }

  existing.hits.push(timestamp);
  buckets.set(key, existing);
  return { ok: true };
}
