// ABOUT: Unit tests for KV-backed session store — signing, verification, create/get/delete.

import { describe, expect, it, vi } from 'vitest';
import {
  createSession,
  getSession,
  deleteSession,
  makeCookieValue,
  clearCookieValue,
  parseCookieHeader,
} from './sessionStore';

function makeKv(seed: Record<string, string> = {}): KVNamespace {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

const SECRET = 'test-hmac-secret-32-bytes-exactly!';

function makeEnv() {
  return { SESSIONS: makeKv(), SESSION_COOKIE_SECRET: SECRET };
}

describe('parseCookieHeader', () => {
  it('returns null for null input', () => {
    expect(parseCookieHeader(null)).toBeNull();
  });

  it('returns null when no session cookie present', () => {
    expect(parseCookieHeader('foo=bar; baz=qux')).toBeNull();
  });

  it('extracts the session cookie value', () => {
    expect(parseCookieHeader('session=abc.def; other=x')).toBe('abc.def');
  });

  it('handles session cookie with = in the value', () => {
    expect(parseCookieHeader('session=abc=def')).toBe('abc=def');
  });
});

describe('makeCookieValue', () => {
  it('includes session=, HttpOnly, Secure, SameSite=Lax, Path=/', () => {
    const val = makeCookieValue('signed.token');
    expect(val).toContain('session=signed.token');
    expect(val).toContain('HttpOnly');
    expect(val).toContain('Secure');
    expect(val).toContain('SameSite=Lax');
    expect(val).toContain('Path=/');
    expect(val).toContain('Max-Age=');
  });
});

describe('clearCookieValue', () => {
  it('sets Max-Age=0 to expire the cookie', () => {
    const val = clearCookieValue();
    expect(val).toContain('Max-Age=0');
    expect(val).toContain('session=');
  });
});

describe('createSession', () => {
  it('returns a signed token in format sessionId.signature', async () => {
    const env = makeEnv();
    const signed = await createSession(env, { userHandle: 'aabb', isAdmin: false });
    // UUID is 36 chars, followed by a dot and base64url signature
    expect(signed).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/);
  });

  it('stores the session data in KV', async () => {
    const env = makeEnv();
    await createSession(env, { userHandle: 'aabb', isAdmin: false });
    expect((env.SESSIONS.put as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});

describe('getSession', () => {
  it('returns session data for a valid signed cookie', async () => {
    const env = makeEnv();
    const data = { userHandle: 'aabbcc', isAdmin: true };
    const signed = await createSession(env, data);
    const result = await getSession(env, `session=${signed}`);
    expect(result).toEqual(data);
  });

  it('returns null for null cookie header', async () => {
    const env = makeEnv();
    expect(await getSession(env, null)).toBeNull();
  });

  it('returns null when no session cookie in header', async () => {
    const env = makeEnv();
    expect(await getSession(env, 'other=value')).toBeNull();
  });

  it('returns null for a tampered signature', async () => {
    const env = makeEnv();
    const signed = await createSession(env, { userHandle: 'x', isAdmin: false });
    const tampered = signed.slice(0, -4) + 'xxxx';
    expect(await getSession(env, `session=${tampered}`)).toBeNull();
  });

  it('returns null when KV entry has been deleted (simulated expiry)', async () => {
    const env = makeEnv();
    const signed = await createSession(env, { userHandle: 'gone', isAdmin: false });
    // Override get to simulate expiry
    (env.SESSIONS.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await getSession(env, `session=${signed}`)).toBeNull();
  });

  it('returns null for a signed value with no dot separator', async () => {
    const env = makeEnv();
    expect(await getSession(env, 'session=noseparatorhere')).toBeNull();
  });
});

describe('deleteSession', () => {
  it('removes the KV entry and subsequent getSession returns null', async () => {
    const env = makeEnv();
    const data = { userHandle: 'todelete', isAdmin: false };
    const signed = await createSession(env, data);
    const cookie = `session=${signed}`;
    await deleteSession(env, cookie);
    expect(await getSession(env, cookie)).toBeNull();
  });

  it('is a no-op for null cookie', async () => {
    const env = makeEnv();
    await expect(deleteSession(env, null)).resolves.toBeUndefined();
    expect((env.SESSIONS.delete as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('is a no-op when no session cookie in header', async () => {
    const env = makeEnv();
    await expect(deleteSession(env, 'other=value')).resolves.toBeUndefined();
    expect((env.SESSIONS.delete as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});
