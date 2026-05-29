// ABOUT: Tests for POST /api/auth/signin/options and /verify.

import { describe, expect, it, vi } from 'vitest';
import { signinOptions, signinVerify } from './signin';
import type { Env } from '../../index';

vi.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: vi.fn(async () => ({
    challenge: 'auth-challenge',
    rpId: 'localhost',
    allowCredentials: [],
    userVerification: 'preferred',
    timeout: 60000,
  })),
  verifyAuthenticationResponse: vi.fn(),
}));

vi.mock('@simplewebauthn/server/helpers', () => ({
  isoBase64URL: { toBuffer: vi.fn(() => new Uint8Array(65)) },
}));

vi.mock('../../db/queries', () => ({
  getUserByHandle: vi.fn(),
  updateUserCounter: vi.fn(async () => {}),
}));

vi.mock('../../lib/sessionStore', () => ({
  createSession: vi.fn(async () => 'signed.token'),
  makeCookieValue: vi.fn((s: string) => `session=${s}; HttpOnly`),
}));

vi.mock('../../lib/rate-limit', () => ({
  checkAndIncrementIpHourly: vi.fn(async () => ({ allowed: true, remaining: 19 })),
}));

import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getUserByHandle, updateUserCounter } from '../../db/queries';
import { createSession } from '../../lib/sessionStore';
import { checkAndIncrementIpHourly } from '../../lib/rate-limit';

const USER_ROW = {
  user_handle: 'aabb1122334455667788aabbccddeeff',
  public_key: 'base64key',
  counter: 0,
  is_admin: 0,
  created_at: 1000,
};

function makeEnv(): Env {
  const kv = new Map<string, string>();
  const kvNs = {
    get: vi.fn(async (k: string) => kv.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => {
      kv.set(k, v);
    }),
    delete: vi.fn(async (k: string) => {
      kv.delete(k);
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
  return {
    ASSETS: {} as Fetcher,
    AI: {} as Ai,
    RATE_LIMITS: {} as KVNamespace,
    DB: {} as D1Database,
    SESSIONS: kvNs,
    SESSION_COOKIE_SECRET: 'test',
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_ORIGIN: 'http://localhost:5173',
  };
}

describe('signinOptions', () => {
  it('returns 200 with options and _token', async () => {
    const req = new Request('https://takt.hultberg.org/api/auth/signin/options', {
      method: 'POST',
    });
    const res = await signinOptions(req, makeEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.challenge).toBe('auth-challenge');
    expect(typeof body._token).toBe('string');
  });

  it('stores challenge in SESSIONS KV under challenge:auth:{token}', async () => {
    const env = makeEnv();
    const req = new Request('https://takt.hultberg.org/api/auth/signin/options', {
      method: 'POST',
    });
    await signinOptions(req, env);
    expect((env.SESSIONS.put as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(
      /^challenge:auth:/,
    );
  });

  it('returns 429 with Retry-After when rate limit is exceeded', async () => {
    vi.mocked(checkAndIncrementIpHourly).mockResolvedValueOnce({
      allowed: false,
      retryAfterSec: 900,
    });
    const req = new Request('https://takt.hultberg.org/api/auth/signin/options', {
      method: 'POST',
    });
    const res = await signinOptions(req, makeEnv());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('900');
    const body = (await res.json()) as any;
    expect(body.error).toBe('rate-limited');
  });
});

describe('signinVerify', () => {
  const VALID_HANDLE = 'aabb1122334455667788aabbccddeeff';

  function makeVerifyRequest(body: unknown) {
    return new Request('https://takt.hultberg.org/api/auth/signin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 400 for invalid request body', async () => {
    const res = await signinVerify(makeVerifyRequest({ bad: 'data' }), makeEnv());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-request' });
  });

  it('returns 400 when challenge has expired', async () => {
    const env = makeEnv();
    const res = await signinVerify(
      makeVerifyRequest({ token: 'missing', credential: {}, userHandle: VALID_HANDLE }),
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'challenge-expired' });
  });

  it('returns 404 when user not found', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => 'stored-challenge');
    vi.mocked(getUserByHandle).mockResolvedValueOnce(null);
    const res = await signinVerify(
      makeVerifyRequest({ token: 'tok', credential: {}, userHandle: VALID_HANDLE }),
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'user-not-found' });
  });

  it('returns 400 when verifyAuthenticationResponse throws', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => 'stored-challenge');
    vi.mocked(getUserByHandle).mockResolvedValueOnce(USER_ROW as any);
    vi.mocked(verifyAuthenticationResponse).mockRejectedValueOnce(new Error('bad assertion'));
    const res = await signinVerify(
      makeVerifyRequest({ token: 'tok', credential: { id: 'cred' }, userHandle: VALID_HANDLE }),
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'verification-failed' });
  });

  it('returns 403 for counter regression (non-synced passkey)', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => 'stored-challenge');
    vi.mocked(getUserByHandle).mockResolvedValueOnce({ ...USER_ROW, counter: 10 } as any);
    vi.mocked(verifyAuthenticationResponse).mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 5, credentialBackedUp: false },
    } as any);
    const res = await signinVerify(
      makeVerifyRequest({ token: 'tok', credential: { id: 'cred' }, userHandle: VALID_HANDLE }),
      env,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'counter-regression' });
  });

  it('skips counter regression check for synced (backed-up) passkeys', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => 'stored-challenge');
    // counter=0 with backed-up passkey (iCloud Keychain) — should NOT regress
    vi.mocked(getUserByHandle).mockResolvedValueOnce({ ...USER_ROW, counter: 5 } as any);
    vi.mocked(verifyAuthenticationResponse).mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 0, credentialBackedUp: true },
    } as any);
    const res = await signinVerify(
      makeVerifyRequest({ token: 'tok', credential: { id: 'cred' }, userHandle: VALID_HANDLE }),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userHandle: VALID_HANDLE, isAdmin: false });
  });

  it('creates session and sets cookie on success', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => 'stored-challenge');
    vi.mocked(getUserByHandle).mockResolvedValueOnce(USER_ROW as any);
    vi.mocked(verifyAuthenticationResponse).mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 1, credentialBackedUp: false },
    } as any);
    const res = await signinVerify(
      makeVerifyRequest({ token: 'tok', credential: { id: 'cred' }, userHandle: VALID_HANDLE }),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userHandle: VALID_HANDLE, isAdmin: false });
    expect(res.headers.get('Set-Cookie')).toContain('signed.token');
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(expect.anything(), {
      userHandle: VALID_HANDLE,
      isAdmin: false,
    });
  });

  it('updates counter when newCounter differs from stored', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => 'stored-challenge');
    vi.mocked(getUserByHandle).mockResolvedValueOnce({ ...USER_ROW, counter: 3 } as any);
    vi.mocked(verifyAuthenticationResponse).mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 4, credentialBackedUp: false },
    } as any);
    await signinVerify(
      makeVerifyRequest({ token: 'tok', credential: { id: 'cred' }, userHandle: VALID_HANDLE }),
      env,
    );
    expect(vi.mocked(updateUserCounter)).toHaveBeenCalledWith(expect.anything(), VALID_HANDLE, 4);
  });

  it('skips counter update when newCounter equals stored counter', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => 'stored-challenge');
    vi.mocked(getUserByHandle).mockResolvedValueOnce({ ...USER_ROW, counter: 0 } as any);
    vi.mocked(verifyAuthenticationResponse).mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 0, credentialBackedUp: true },
    } as any);
    vi.mocked(updateUserCounter).mockClear();
    await signinVerify(
      makeVerifyRequest({ token: 'tok', credential: { id: 'cred' }, userHandle: VALID_HANDLE }),
      env,
    );
    expect(vi.mocked(updateUserCounter)).not.toHaveBeenCalled();
  });
});
