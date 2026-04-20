import { describe, expect, it, vi } from 'vitest';

import { checkAndIncrementRateLimit } from './rate-limit';

function makeKv(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  const get = vi.fn(async (key: string) => store.get(key) ?? null);
  const put = vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  });
  const del = vi.fn(async (key: string) => {
    store.delete(key);
  });
  return {
    get,
    put,
    delete: del,
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function makeRequest(ip: string = '203.0.113.1'): Request {
  return new Request('https://takt.hultberg.org/api/voice/parse', {
    method: 'POST',
    headers: { 'cf-connecting-ip': ip },
  });
}

describe('rate limiter (minimum-viable, 20/day/IP)', () => {
  it('allows the first call for a new IP', async () => {
    const kv = makeKv();
    const result = await checkAndIncrementRateLimit(kv, makeRequest());
    expect(result).toEqual({ allowed: true, remaining: 19 });
  });

  it('decrements remaining on subsequent calls', async () => {
    const kv = makeKv();
    await checkAndIncrementRateLimit(kv, makeRequest());
    await checkAndIncrementRateLimit(kv, makeRequest());
    const third = await checkAndIncrementRateLimit(kv, makeRequest());
    expect(third).toEqual({ allowed: true, remaining: 17 });
  });

  it('rejects with retryAfterSec once the daily cap is reached', async () => {
    const kv = makeKv();
    // Simulate 20 prior calls. Any key for this IP hash — we just seed any value ≥ cap.
    const req = makeRequest();
    // Probe the actual key by calling once, then rewind.
    await checkAndIncrementRateLimit(kv, req);
    // Grab the key our code wrote and set it to the cap.
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const key = putCalls[0][0] as string;
    await kv.put(key, '20', { expirationTtl: 60 });

    const result = await checkAndIncrementRateLimit(kv, req);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSec).toBeGreaterThan(0);
      expect(result.retryAfterSec).toBeLessThanOrEqual(24 * 60 * 60);
    }
  });

  it('uses different counters for different IPs', async () => {
    const kv = makeKv();
    const a = await checkAndIncrementRateLimit(kv, makeRequest('1.2.3.4'));
    const b = await checkAndIncrementRateLimit(kv, makeRequest('5.6.7.8'));
    expect(a).toEqual({ allowed: true, remaining: 19 });
    expect(b).toEqual({ allowed: true, remaining: 19 });
  });

  it('hashes IPs — raw IP does not appear in the KV key', async () => {
    const kv = makeKv();
    await checkAndIncrementRateLimit(kv, makeRequest('198.51.100.42'));
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const key = putCalls[0][0] as string;
    expect(key).not.toContain('198.51.100.42');
    expect(key).toMatch(/^ratelimit:anon:[0-9a-f]{16}:\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to x-real-ip when cf-connecting-ip is absent', async () => {
    const kv = makeKv();
    const req = new Request('https://takt.hultberg.org/api/voice/parse', {
      method: 'POST',
      headers: { 'x-real-ip': '192.0.2.5' },
    });
    const result = await checkAndIncrementRateLimit(kv, req);
    expect(result).toMatchObject({ allowed: true });
  });

  it('sets a TTL so counters auto-expire after the day rolls over', async () => {
    const kv = makeKv();
    await checkAndIncrementRateLimit(kv, makeRequest());
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const options = putCalls[0][2] as { expirationTtl?: number } | undefined;
    expect(options?.expirationTtl).toBeGreaterThan(24 * 60 * 60); // > 24h
    expect(options?.expirationTtl).toBeLessThanOrEqual(27 * 60 * 60); // ≤ 27h
  });
});
