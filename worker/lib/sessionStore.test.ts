// ABOUT: Unit tests for KV-backed session store — signing, verification, create/get/delete.

import { describe, expect, it, vi } from 'vitest';
import {
  createSession,
  getSession,
  deleteSession,
  deleteUserSessions,
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
    list: vi.fn(async (opts?: { prefix?: string }) => {
      const prefix = opts?.prefix ?? '';
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
      return { keys, list_complete: true };
    }),
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

  it('stores the session data and reverse index in KV (2 puts)', async () => {
    const env = makeEnv();
    await createSession(env, { userHandle: 'aabb', isAdmin: false });
    const puts = (env.SESSIONS.put as ReturnType<typeof vi.fn>).mock.calls;
    expect(puts).toHaveLength(2);
    // First put: session data keyed by UUID
    expect(puts[0][0]).toMatch(/^[0-9a-f-]{36}$/);
    // Second put: reverse index key
    expect(puts[1][0]).toMatch(/^user-session:aabb:[0-9a-f-]{36}$/);
    expect(puts[1][1]).toBe('1');
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

describe('deleteUserSessions', () => {
  it('returns 0 when no reverse-index keys exist for user', async () => {
    const env = { SESSIONS: makeKv() };
    const count = await deleteUserSessions(env, 'nobody');
    expect(count).toBe(0);
    expect((env.SESSIONS.delete as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('deletes session and reverse-index entries and returns session count', async () => {
    const sessionId = crypto.randomUUID();
    const kv = makeKv({
      [sessionId]: JSON.stringify({ userHandle: 'u1', isAdmin: false }),
      [`user-session:u1:${sessionId}`]: '1',
    });
    const env = { SESSIONS: kv };
    const count = await deleteUserSessions(env, 'u1');
    expect(count).toBe(1);
    // 2 deletes: session key + reverse-index key
    expect((kv.delete as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    const deletedKeys = (kv.delete as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: string[]) => c[0],
    );
    expect(deletedKeys).toContain(sessionId);
    expect(deletedKeys).toContain(`user-session:u1:${sessionId}`);
  });

  it('handles multiple sessions for the same user', async () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const kv = makeKv({
      [id1]: JSON.stringify({ userHandle: 'u1', isAdmin: false }),
      [`user-session:u1:${id1}`]: '1',
      [id2]: JSON.stringify({ userHandle: 'u1', isAdmin: false }),
      [`user-session:u1:${id2}`]: '1',
    });
    const env = { SESSIONS: kv };
    const count = await deleteUserSessions(env, 'u1');
    expect(count).toBe(2);
    expect((kv.delete as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(4);
  });

  it('does not delete sessions belonging to a different user', async () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const kv = makeKv({
      [id1]: JSON.stringify({ userHandle: 'u1', isAdmin: false }),
      [`user-session:u1:${id1}`]: '1',
      [id2]: JSON.stringify({ userHandle: 'other', isAdmin: false }),
      [`user-session:other:${id2}`]: '1',
    });
    const env = { SESSIONS: kv };
    await deleteUserSessions(env, 'u1');
    const deletedKeys = (kv.delete as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: string[]) => c[0],
    );
    expect(deletedKeys).not.toContain(id2);
    expect(deletedKeys).not.toContain(`user-session:other:${id2}`);
  });
});
