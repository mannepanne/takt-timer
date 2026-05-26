// ABOUT: Tests for POST /api/auth/registration/options and /verify.

import { describe, expect, it, vi } from 'vitest';
import { registrationOptions, registrationVerify } from './registration';
import type { Env } from '../../index';

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(async () => ({
    challenge: 'test-challenge',
    rp: { id: 'localhost', name: 'Takt' },
    user: { id: '', name: 'takt-user', displayName: 'Takt User' },
    pubKeyCredParams: [],
    timeout: 60000,
    attestation: 'none',
  })),
  verifyRegistrationResponse: vi.fn(),
}));

vi.mock('@simplewebauthn/server/helpers', () => ({
  isoBase64URL: { fromBuffer: vi.fn(() => 'base64key') },
}));

vi.mock('../../db/queries', () => ({
  getUserByHandle: vi.fn(async () => null),
  insertUser: vi.fn(async () => {}),
}));

vi.mock('../../lib/sessionStore', () => ({
  createSession: vi.fn(async () => 'signed.token'),
  makeCookieValue: vi.fn((s: string) => `session=${s}; HttpOnly`),
}));

import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getUserByHandle } from '../../db/queries';
import { createSession } from '../../lib/sessionStore';

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

describe('registrationOptions', () => {
  it('returns 200 with options and _token', async () => {
    const req = new Request('https://takt.hultberg.org/api/auth/registration/options', {
      method: 'POST',
    });
    const res = await registrationOptions(req, makeEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.challenge).toBe('test-challenge');
    expect(typeof body._token).toBe('string');
    expect(body._token.length).toBeGreaterThan(0);
  });

  it('stores challenge in SESSIONS KV under challenge:reg:{token}', async () => {
    const env = makeEnv();
    const req = new Request('https://takt.hultberg.org/api/auth/registration/options', {
      method: 'POST',
    });
    await registrationOptions(req, env);
    expect((env.SESSIONS.put as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(
      /^challenge:reg:/,
    );
  });
});

describe('registrationVerify', () => {
  function makeVerifyRequest(body: unknown) {
    return new Request('https://takt.hultberg.org/api/auth/registration/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 400 for invalid request body', async () => {
    const res = await registrationVerify(makeVerifyRequest({ bad: 'data' }), makeEnv());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-request' });
  });

  it('returns 400 when challenge token has expired', async () => {
    const env = makeEnv();
    // No challenge stored → expired
    const res = await registrationVerify(
      makeVerifyRequest({ token: 'missing-token', credential: { type: 'public-key' } }),
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'challenge-expired' });
  });

  it('returns 400 when verifyRegistrationResponse throws', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => JSON.stringify({ challenge: 'c', userHandle: 'aabb' }));
    vi.mocked(verifyRegistrationResponse).mockRejectedValueOnce(new Error('bad sig'));
    const res = await registrationVerify(
      makeVerifyRequest({ token: 'tok', credential: { type: 'public-key', id: 'cred' } }),
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'verification-failed' });
  });

  it('returns 400 when verified=false', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => JSON.stringify({ challenge: 'c', userHandle: 'aabb' }));
    vi.mocked(verifyRegistrationResponse).mockResolvedValueOnce({ verified: false } as any);
    const res = await registrationVerify(
      makeVerifyRequest({ token: 'tok', credential: { type: 'public-key', id: 'cred' } }),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 on userHandle collision', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => JSON.stringify({ challenge: 'c', userHandle: 'aabb' }));
    vi.mocked(verifyRegistrationResponse).mockResolvedValueOnce({
      verified: true,
      registrationInfo: { credential: { publicKey: new Uint8Array(65), counter: 0 } },
    } as any);
    vi.mocked(getUserByHandle).mockResolvedValueOnce({ user_handle: 'aabb' } as any);
    const res = await registrationVerify(
      makeVerifyRequest({ token: 'tok', credential: { type: 'public-key', id: 'cred' } }),
      env,
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'handle-collision' });
  });

  it('creates session and sets cookie on success', async () => {
    const env = makeEnv();
    const kv = env.SESSIONS as any;
    kv.get = vi.fn(async () => JSON.stringify({ challenge: 'c', userHandle: 'aabb' }));
    vi.mocked(verifyRegistrationResponse).mockResolvedValueOnce({
      verified: true,
      registrationInfo: { credential: { publicKey: new Uint8Array(65), counter: 0 } },
    } as any);
    vi.mocked(getUserByHandle).mockResolvedValueOnce(null);
    const res = await registrationVerify(
      makeVerifyRequest({ token: 'tok', credential: { type: 'public-key', id: 'cred' } }),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userHandle: 'aabb', isAdmin: false });
    expect(res.headers.get('Set-Cookie')).toContain('signed.token');
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(expect.anything(), {
      userHandle: 'aabb',
      isAdmin: false,
    });
  });
});
