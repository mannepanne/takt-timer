// ABOUT: KV-backed rate limiters for auth and settings endpoints.
// ABOUT: IP-based hourly limiter for unauthenticated challenge endpoints; user-based daily for
// ABOUT: authenticated mutations. Voice endpoint has its own rate-limit.ts with daily windows.

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** SHA-256 over the IP string, truncated to 16 hex chars. Non-reversible. */
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

function utcHourKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}-${pad(now.getUTCHours())}`;
}

function secondsUntilNextUtcHour(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1),
  );
  return Math.max(1, Math.round((next.getTime() - now.getTime()) / 1000));
}

function utcDayKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

function secondsUntilNextUtcDay(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.max(1, Math.round((tomorrow.getTime() - now.getTime()) / 1000));
}

async function checkAndIncrement(
  kv: KVNamespace,
  key: string,
  cap: number,
  ttlSeconds: number,
  retryAfterSec: number,
): Promise<RateLimitResult> {
  const currentRaw = await kv.get(key);
  const current = currentRaw ? Number(currentRaw) : 0;

  if (current >= cap) {
    return { allowed: false, retryAfterSec };
  }

  const next = current + 1;
  await kv.put(key, String(next), { expirationTtl: ttlSeconds });
  return { allowed: true, remaining: cap - next };
}

/**
 * Per-IP hourly rate limit. For unauthenticated endpoints (auth challenge generation).
 * Runs before any KV writes so blocked calls incur no challenge-token cost.
 * Key pattern: ratelimit:{namespace}:{ipHash}:{hourKey}
 */
export async function checkAndIncrementIpHourly(
  kv: KVNamespace,
  request: Request,
  options: { namespace: string; cap: number; bypass?: boolean },
): Promise<RateLimitResult> {
  if (options.bypass) return { allowed: true, remaining: Number.POSITIVE_INFINITY };

  const ipHash = await hashIp(ipFromRequest(request));
  const key = `ratelimit:${options.namespace}:${ipHash}:${utcHourKey()}`;
  // TTL of 2 hours covers the current hour and ensures cleanup shortly after rollover.
  return checkAndIncrement(kv, key, options.cap, 2 * 60 * 60, secondsUntilNextUtcHour());
}

/**
 * Per-user daily rate limit. For authenticated endpoints (settings mutations).
 * Key pattern: ratelimit:{namespace}:{userId}:{dayKey}
 */
export async function checkAndIncrementUserDaily(
  kv: KVNamespace,
  userId: string,
  options: { namespace: string; cap: number; bypass?: boolean },
): Promise<RateLimitResult> {
  if (options.bypass) return { allowed: true, remaining: Number.POSITIVE_INFINITY };

  const key = `ratelimit:${options.namespace}:${userId}:${utcDayKey()}`;
  return checkAndIncrement(kv, key, options.cap, 26 * 60 * 60, secondsUntilNextUtcDay());
}
