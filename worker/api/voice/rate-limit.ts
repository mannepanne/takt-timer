// ABOUT: Minimum-viable KV-backed daily-cap rate limiter for the voice endpoint.
// ABOUT: Coarse 20/day per IP-hash — a cost-control guard, not the Phase 3 proper limiter.
// ABOUT: See TD-017. Phase 3 proper replaces this with the full 3/day + dev-bypass + retryAfter
// ABOUT: UX + authenticated-tier design, alongside an ADR on KV vs native Rate Limiting.

const DAILY_CAP = 20;
const TTL_SECONDS = 26 * 60 * 60; // 26 hours — covers TZ drift around the UTC-day boundary.

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number };

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

/**
 * Increments-then-checks the daily counter. Increment happens before inference so that
 * cancelled uploads and failed parses still consume quota — caps total Workers AI spend.
 */
export async function checkAndIncrementRateLimit(
  kv: KVNamespace,
  request: Request,
): Promise<RateLimitResult> {
  const ip = ipFromRequest(request);
  const ipHash = await hashIp(ip);
  const key = `ratelimit:anon:${ipHash}:${utcDayKey()}`;

  const currentRaw = await kv.get(key);
  const current = currentRaw ? Number(currentRaw) : 0;

  if (current >= DAILY_CAP) {
    return { allowed: false, retryAfterSec: secondsUntilNextUtcMidnight() };
  }

  const next = current + 1;
  await kv.put(key, String(next), { expirationTtl: TTL_SECONDS });

  return { allowed: true, remaining: DAILY_CAP - next };
}
