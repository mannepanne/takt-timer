// ABOUT: KV-backed daily-cap rate limiter for /api/voice/parse.
// ABOUT: 3 calls per UTC day, keyed by hashed IP for anonymous callers and by user ID
// ABOUT: when one is supplied (Phase 4 plugs in session→userId resolution). A bypass flag
// ABOUT: short-circuits the counter under `wrangler dev`. Read-then-write — see ADR
// ABOUT: 2026-05-12-kv-rate-limiter.md for the race-window trade-off.

const ANON_DAILY_CAP = 3;
const AUTH_DAILY_CAP = 30;
const TTL_SECONDS = 26 * 60 * 60; // 26 hours — covers TZ drift around the UTC-day boundary.

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number };

export type RateLimitOptions = {
  userId?: string;
  bypass?: boolean;
};

/** UTC midnight → now, in seconds. */
function secondsUntilNextUtcMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.max(1, Math.round((tomorrow.getTime() - now.getTime()) / 1000));
}

function utcDayKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** SHA-256 over the IP string, truncated to 16 hex chars. Cheap, stable, non-reversible. */
async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 16);
}

function ipFromRequest(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? 'unknown';
}

async function resolveKey(request: Request, userId: string | undefined): Promise<string> {
  const day = utcDayKey();
  if (userId) {
    return `ratelimit:user:${userId}:${day}`;
  }
  const ipHash = await hashIp(ipFromRequest(request));
  return `ratelimit:anon:${ipHash}:${day}`;
}

/**
 * Increments-then-checks the daily counter. Increment happens before inference so that
 * cancelled uploads and failed parses still consume quota — caps total Workers AI spend.
 * When `bypass` is set the counter is neither read nor written; intended for `wrangler dev`.
 */
export async function checkAndIncrementRateLimit(
  kv: KVNamespace,
  request: Request,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  if (options.bypass) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY };
  }

  const key = await resolveKey(request, options.userId);
  const cap = options.userId ? AUTH_DAILY_CAP : ANON_DAILY_CAP;

  const currentRaw = await kv.get(key);
  const current = currentRaw ? Number(currentRaw) : 0;

  if (current >= cap) {
    return { allowed: false, retryAfterSec: secondsUntilNextUtcMidnight() };
  }

  const next = current + 1;
  await kv.put(key, String(next), { expirationTtl: TTL_SECONDS });

  return { allowed: true, remaining: cap - next };
}
