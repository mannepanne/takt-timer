// ABOUT: Tests for worker/lib/rate-limit.ts — IP-based hourly and user-based daily limiters.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAndIncrementIpHourly, checkAndIncrementUserDaily } from './rate-limit';

function makeKv(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  const get = vi.fn(async (key: string) => store.get(key) ?? null);
  const put = vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  });
  return {
    get,
    put,
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function makeRequest(ip: string = '203.0.113.1'): Request {
  return new Request('https://takt.hultberg.org/api/auth/registration/options', {
    method: 'POST',
    headers: { 'cf-connecting-ip': ip },
  });
}

describe('checkAndIncrementIpHourly', () => {
  describe('basic counting', () => {
    it('allows the first call', async () => {
      const result = await checkAndIncrementIpHourly(makeKv(), makeRequest(), {
        namespace: 'auth',
        cap: 20,
      });
      expect(result).toEqual({ allowed: true, remaining: 19 });
    });

    it('decrements remaining on each call up to the cap', async () => {
      const kv = makeKv();
      const req = makeRequest();
      const a = await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 3 });
      const b = await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 3 });
      const c = await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 3 });
      expect(a).toEqual({ allowed: true, remaining: 2 });
      expect(b).toEqual({ allowed: true, remaining: 1 });
      expect(c).toEqual({ allowed: true, remaining: 0 });
    });

    it('rejects once the cap is reached', async () => {
      const kv = makeKv();
      const req = makeRequest();
      for (let i = 0; i < 3; i++) {
        await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 3 });
      }
      const result = await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 3 });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfterSec).toBeGreaterThan(0);
        expect(result.retryAfterSec).toBeLessThanOrEqual(60 * 60);
      }
    });

    it('uses separate counters for different IPs', async () => {
      const kv = makeKv();
      const a = await checkAndIncrementIpHourly(kv, makeRequest('1.2.3.4'), {
        namespace: 'auth',
        cap: 20,
      });
      const b = await checkAndIncrementIpHourly(kv, makeRequest('5.6.7.8'), {
        namespace: 'auth',
        cap: 20,
      });
      expect(a).toEqual({ allowed: true, remaining: 19 });
      expect(b).toEqual({ allowed: true, remaining: 19 });
    });
  });

  describe('key structure', () => {
    it('keys on hashed IP under the given namespace and current UTC hour', async () => {
      const kv = makeKv();
      await checkAndIncrementIpHourly(kv, makeRequest('198.51.100.42'), {
        namespace: 'auth',
        cap: 20,
      });
      const key = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(key).not.toContain('198.51.100.42');
      expect(key).toMatch(/^ratelimit:auth:[0-9a-f]{16}:\d{4}-\d{2}-\d{2}-\d{2}$/);
    });

    it('namespaces are isolated — auth and settings counters never collide', async () => {
      const kv = makeKv();
      const req = makeRequest('1.2.3.4');
      await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 20 });
      await checkAndIncrementIpHourly(kv, req, { namespace: 'other', cap: 20 });
      const calls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).not.toBe(calls[1][0]);
    });

    it('sets a TTL of ~2 hours so counters expire shortly after the hour rolls over', async () => {
      const kv = makeKv();
      await checkAndIncrementIpHourly(kv, makeRequest(), { namespace: 'auth', cap: 20 });
      const opts = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0][2] as {
        expirationTtl?: number;
      };
      expect(opts?.expirationTtl).toBeGreaterThanOrEqual(60 * 60);
      expect(opts?.expirationTtl).toBeLessThanOrEqual(3 * 60 * 60);
    });

    it('falls back to x-real-ip when cf-connecting-ip is absent', async () => {
      const kv = makeKv();
      const req = new Request('https://takt.hultberg.org/api/auth/registration/options', {
        method: 'POST',
        headers: { 'x-real-ip': '192.0.2.5' },
      });
      const result = await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 20 });
      expect(result).toMatchObject({ allowed: true });
    });
  });

  describe('hour rollover', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('resets the counter at the top of each UTC hour', async () => {
      const kv = makeKv();
      vi.setSystemTime(new Date('2026-05-29T12:59:00Z'));
      const req = makeRequest();
      for (let i = 0; i < 3; i++) {
        await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 3 });
      }

      vi.setSystemTime(new Date('2026-05-29T13:00:01Z'));
      const result = await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 3 });
      expect(result).toEqual({ allowed: true, remaining: 2 });
    });

    it('retryAfterSec is roughly seconds until the next UTC hour', async () => {
      const kv = makeKv();
      vi.setSystemTime(new Date('2026-05-29T12:30:00Z'));
      const req = makeRequest();
      for (let i = 0; i < 3; i++) {
        await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 3 });
      }
      const result = await checkAndIncrementIpHourly(kv, req, { namespace: 'auth', cap: 3 });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        // 30 minutes = 1800 s. Allow ±1s for rounding.
        expect(result.retryAfterSec).toBeGreaterThanOrEqual(1799);
        expect(result.retryAfterSec).toBeLessThanOrEqual(1801);
      }
    });
  });

  describe('bypass', () => {
    it('skips KV entirely when bypass is true', async () => {
      const kv = makeKv();
      const result = await checkAndIncrementIpHourly(kv, makeRequest(), {
        namespace: 'auth',
        cap: 20,
        bypass: true,
      });
      expect(result.allowed).toBe(true);
      expect(kv.get as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
      expect(kv.put as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    });

    it('returns infinite remaining when bypassed', async () => {
      const result = await checkAndIncrementIpHourly(makeKv(), makeRequest(), {
        namespace: 'auth',
        cap: 20,
        bypass: true,
      });
      if (result.allowed) expect(result.remaining).toBe(Number.POSITIVE_INFINITY);
    });
  });
});

describe('checkAndIncrementUserDaily', () => {
  describe('basic counting', () => {
    it('allows the first call', async () => {
      const result = await checkAndIncrementUserDaily(makeKv(), 'user-abc', {
        namespace: 'settings',
        cap: 60,
      });
      expect(result).toEqual({ allowed: true, remaining: 59 });
    });

    it('rejects once the cap is reached', async () => {
      const kv = makeKv();
      for (let i = 0; i < 3; i++) {
        await checkAndIncrementUserDaily(kv, 'user-abc', { namespace: 'settings', cap: 3 });
      }
      const result = await checkAndIncrementUserDaily(kv, 'user-abc', {
        namespace: 'settings',
        cap: 3,
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfterSec).toBeGreaterThan(0);
        expect(result.retryAfterSec).toBeLessThanOrEqual(26 * 60 * 60);
      }
    });

    it('uses separate counters for different users', async () => {
      const kv = makeKv();
      const a = await checkAndIncrementUserDaily(kv, 'user-1', { namespace: 'settings', cap: 60 });
      const b = await checkAndIncrementUserDaily(kv, 'user-2', { namespace: 'settings', cap: 60 });
      expect(a).toEqual({ allowed: true, remaining: 59 });
      expect(b).toEqual({ allowed: true, remaining: 59 });
    });
  });

  describe('key structure', () => {
    it('keys on userId under the given namespace and current UTC day', async () => {
      const kv = makeKv();
      await checkAndIncrementUserDaily(kv, 'user-abc', { namespace: 'settings', cap: 60 });
      const key = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(key).toMatch(/^ratelimit:settings:user-abc:\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('bypass', () => {
    it('skips KV entirely when bypass is true', async () => {
      const kv = makeKv();
      const result = await checkAndIncrementUserDaily(kv, 'user-abc', {
        namespace: 'settings',
        cap: 60,
        bypass: true,
      });
      expect(result.allowed).toBe(true);
      expect(kv.get as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    });
  });
});
