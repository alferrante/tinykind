import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";

function hasRedisRateLimitConfig(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

function nowMs(): number {
  return Date.now();
}

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const base = `${forwarded}|${userAgent}`;
  return createHash("sha256").update(base).digest("hex").slice(0, 24);
}

async function enforceWithRedis(
  key: string,
  options: { maxHits: number; windowMs: number },
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const endpoint = `${REDIS_URL.replace(/\/$/, "")}/pipeline`;
  const commands: string[][] = [
    ["INCR", key],
    ["PEXPIRE", key, String(options.windowMs), "NX"],
    ["PTTL", key],
  ];

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Rate limit backend error: ${response.status}`);
  }

  const payload = (await response.json()) as Array<{ result?: number | string }>;
  const count = Number(payload?.[0]?.result);
  const pttl = Number(payload?.[2]?.result);
  if (!Number.isFinite(count)) {
    throw new Error("Rate limit backend returned invalid counter value.");
  }

  if (count > options.maxHits) {
    const retryAfterSeconds = Number.isFinite(pttl) && pttl > 0
      ? Math.max(1, Math.ceil(pttl / 1000))
      : Math.max(1, Math.ceil(options.windowMs / 1000));
    return { ok: false, retryAfterSeconds };
  }

  return { ok: true };
}

function enforceInMemory(
  key: string,
  options: { maxHits: number; windowMs: number },
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const timestamp = nowMs();
  const windowStart = timestamp - options.windowMs;
  const existing = buckets.get(key) ?? { hits: [] };
  existing.hits = existing.hits.filter((hit) => hit >= windowStart);

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

export async function enforceRateLimit(
  request: NextRequest,
  options: { scope: string; maxHits: number; windowMs: number },
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const key = `${options.scope}:${getClientKey(request)}`;
  if (hasRedisRateLimitConfig()) {
    try {
      return await enforceWithRedis(key, options);
    } catch {
      // Fallback keeps APIs available if Redis is temporarily unavailable.
      return enforceInMemory(key, options);
    }
  }

  return enforceInMemory(key, options);
}
