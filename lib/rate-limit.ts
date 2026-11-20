import "server-only";
import { createHash } from "node:crypto";

/**
 * Fixed-window rate limiting.
 *
 * With Upstash Redis configured (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or the
 * KV_REST_API_URL + KV_REST_API_TOKEN pair that Vercel's Upstash integration sets), counts are
 * shared by every server instance, so limits hold on Vercel's serverless functions.
 * Without it — or if Redis can't be reached — it falls back to per-instance memory.
 */

export interface Limit {
  /** Key prefix, e.g. "ip". */
  name: string;
  max: number;
  windowSeconds: number;
}

const TIMEOUT_MS = 3_000;

function redisConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.trim().replace(/\/+$/, "");
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)?.trim();
  return url && token ? { url, token } : null;
}

/** Hash identifiers (email, phone, IP) so no personal data is stored in Redis keys. */
function keyFor(limit: Limit, id: string): string {
  const hash = createHash("sha256").update(id).digest("base64url").slice(0, 22);
  return `aurelia:rl:${limit.name}:${hash}`;
}

async function redisCount(cfg: { url: string; token: string }, key: string, windowSeconds: number): Promise<number> {
  // SET NX starts the window with its expiry; INCR counts this request.
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["SET", key, "0", "EX", String(windowSeconds), "NX"],
      ["INCR", key],
    ]),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string }[];
  const count = Number(data?.[1]?.result);
  if (!Number.isFinite(count)) throw new Error(`Upstash error: ${data?.[1]?.error ?? "unexpected reply"}`);
  return count;
}

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryCount(key: string, windowSeconds: number): number {
  const now = Date.now();
  let entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    if (memory.size > 5000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
      if (memory.size > 5000) memory.clear(); // keep memory bounded
    }
    entry = { count: 0, resetAt: now + windowSeconds * 1000 };
    memory.set(key, entry);
  }
  entry.count += 1;
  return entry.count;
}

let warnedNoRedis = false;

/** Counts this request against `limit` for `id`. Returns true when the limit is exceeded. */
export async function isRateLimited(limit: Limit, id: string): Promise<boolean> {
  const key = keyFor(limit, id);
  const cfg = redisConfig();
  if (cfg) {
    try {
      return (await redisCount(cfg, key, limit.windowSeconds)) > limit.max;
    } catch (err) {
      console.error("[rate-limit] Redis unavailable, using in-memory limits:", (err as Error)?.message ?? err);
    }
  } else if (!warnedNoRedis && process.env.NODE_ENV === "production") {
    warnedNoRedis = true;
    console.warn("[rate-limit] Upstash Redis is not configured — rate limits are per server instance only.");
  }
  return memoryCount(key, limit.windowSeconds) > limit.max;
}
