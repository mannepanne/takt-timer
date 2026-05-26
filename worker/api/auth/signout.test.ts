// ABOUT: Tests for POST /api/auth/signout — deletes KV session, clears cookie.

import { describe, expect, it, vi } from 'vitest';
import { signout } from './signout';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({
  deleteSession: vi.fn(async () => {}),
  clearCookieValue: vi.fn(() => 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'),
}));

import { deleteSession } from '../../lib/sessionStore';

function makeEnv(): Env {
  return {
    ASSETS: {} as Fetcher,
    AI: {} as Ai,
    RATE_LIMITS: {} as KVNamespace,
    DB: {} as D1Database,
    SESSIONS: {} as KVNamespace,
    SESSION_COOKIE_SECRET: 'test',
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_ORIGIN: 'http://localhost:5173',
  };
}

describe('signout', () => {
  it('returns 200 with ok:true', async () => {
    const req = new Request('https://takt.hultberg.org/api/auth/signout', { method: 'POST' });
    const res = await signout(req, makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('calls deleteSession with the cookie header', async () => {
    const req = new Request('https://takt.hultberg.org/api/auth/signout', {
      method: 'POST',
      headers: { Cookie: 'session=signed.token' },
    });
    await signout(req, makeEnv());
    expect(vi.mocked(deleteSession)).toHaveBeenCalledWith(
      expect.anything(),
      'session=signed.token',
    );
  });

  it('sets a clearing Set-Cookie header', async () => {
    const req = new Request('https://takt.hultberg.org/api/auth/signout', { method: 'POST' });
    const res = await signout(req, makeEnv());
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
