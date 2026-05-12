import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('rate limiter — anonymous (3/day/IP)', () => {
  it('allows the first call for a new IP', async () => {
    const kv = makeKv();
    const result = await checkAndIncrementRateLimit(kv, makeRequest());
    expect(result).toEqual({ allowed: true, remaining: 2 });
  });

  it('decrements remaining on each call up to the cap', async () => {
    const kv = makeKv();
    const a = await checkAndIncrementRateLimit(kv, makeRequest());
    const b = await checkAndIncrementRateLimit(kv, makeRequest());
    const c = await checkAndIncrementRateLimit(kv, makeRequest());
    expect(a).toEqual({ allowed: true, remaining: 2 });
    expect(b).toEqual({ allowed: true, remaining: 1 });
    expect(c).toEqual({ allowed: true, remaining: 0 });
  });

  it('rejects with retryAfterSec on the fourth call', async () => {
    const kv = makeKv();
    const req = makeRequest();
    await checkAndIncrementRateLimit(kv, req);
    await checkAndIncrementRateLimit(kv, req);
    await checkAndIncrementRateLimit(kv, req);

    const fourth = await checkAndIncrementRateLimit(kv, req);
    expect(fourth.allowed).toBe(false);
    if (!fourth.allowed) {
      expect(fourth.retryAfterSec).toBeGreaterThan(0);
      expect(fourth.retryAfterSec).toBeLessThanOrEqual(24 * 60 * 60);
    }
  });

  it('uses different counters for different IPs', async () => {
    const kv = makeKv();
    const a = await checkAndIncrementRateLimit(kv, makeRequest('1.2.3.4'));
    const b = await checkAndIncrementRateLimit(kv, makeRequest('5.6.7.8'));
    expect(a).toEqual({ allowed: true, remaining: 2 });
    expect(b).toEqual({ allowed: true, remaining: 2 });
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
    expect(options?.expirationTtl).toBeGreaterThan(24 * 60 * 60);
    expect(options?.expirationTtl).toBeLessThanOrEqual(27 * 60 * 60);
  });
});

describe('rate limiter — UTC day rollover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes a new key (and resets remaining) after midnight UTC', async () => {
    const kv = makeKv();
    vi.setSystemTime(new Date('2026-05-12T23:59:00Z'));
    await checkAndIncrementRateLimit(kv, makeRequest());
    const dayOneKey = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(dayOneKey).toMatch(/:2026-05-12$/);

    vi.setSystemTime(new Date('2026-05-13T00:00:01Z'));
    const result = await checkAndIncrementRateLimit(kv, makeRequest());
    const dayTwoKey = (kv.put as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(dayTwoKey).toMatch(/:2026-05-13$/);
    expect(dayTwoKey).not.toBe(dayOneKey);
    expect(result).toEqual({ allowed: true, remaining: 2 });
  });

  it('retryAfterSec on cap-rejection equals seconds-until-midnight (±1)', async () => {
    const kv = makeKv();
    vi.setSystemTime(new Date('2026-05-12T22:00:00Z'));
    const req = makeRequest();
    await checkAndIncrementRateLimit(kv, req);
    await checkAndIncrementRateLimit(kv, req);
    await checkAndIncrementRateLimit(kv, req);
    const rejected = await checkAndIncrementRateLimit(kv, req);
    expect(rejected.allowed).toBe(false);
    if (!rejected.allowed) {
      // 2 hours = 7200s. Allow ±1s for date arithmetic.
      expect(rejected.retryAfterSec).toBeGreaterThanOrEqual(7199);
      expect(rejected.retryAfterSec).toBeLessThanOrEqual(7201);
    }
  });
});

describe('rate limiter — dev bypass', () => {
  it('does not touch KV when bypass is set', async () => {
    const kv = makeKv();
    const result = await checkAndIncrementRateLimit(kv, makeRequest(), { bypass: true });
    expect(result.allowed).toBe(true);
    expect(kv.get as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(kv.put as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('returns infinite remaining when bypass is set so the limiter can never reject', async () => {
    const kv = makeKv();
    const result = await checkAndIncrementRateLimit(kv, makeRequest(), { bypass: true });
    if (result.allowed) {
      expect(result.remaining).toBe(Number.POSITIVE_INFINITY);
    }
  });
});

describe('rate limiter — authenticated-tier key shape', () => {
  it('keys on userId (not IP) when userId is supplied', async () => {
    const kv = makeKv();
    await checkAndIncrementRateLimit(kv, makeRequest('203.0.113.7'), { userId: 'user-abc' });
    const key = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(key).toMatch(/^ratelimit:user:user-abc:\d{4}-\d{2}-\d{2}$/);
    expect(key).not.toContain('anon');
  });

  it('user-tier and anon-tier keys do not collide for the same caller', async () => {
    const kv = makeKv();
    const req = makeRequest('203.0.113.7');
    await checkAndIncrementRateLimit(kv, req);
    await checkAndIncrementRateLimit(kv, req, { userId: 'user-abc' });
    const calls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).not.toBe(calls[1][0]);
    expect(calls[0][0]).toMatch(/^ratelimit:anon:/);
    expect(calls[1][0]).toMatch(/^ratelimit:user:/);
  });
});
