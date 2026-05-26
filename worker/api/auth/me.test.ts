// ABOUT: Tests for GET /api/auth/me — returns current session data or null.

import { describe, expect, it, vi } from 'vitest';
import { me } from './me';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({
  getSession: vi.fn(),
}));

import { getSession } from '../../lib/sessionStore';

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

function makeRequest(cookie?: string) {
  return new Request('https://takt.hultberg.org/api/auth/me', {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

describe('me', () => {
  it('returns null when no session', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await me(makeRequest(), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('returns userHandle and isAdmin when session is valid', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'abc123', isAdmin: false });
    const res = await me(makeRequest('session=signed'), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userHandle: 'abc123', isAdmin: false });
  });

  it('returns isAdmin=true for admin sessions', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'admin01', isAdmin: true });
    const res = await me(makeRequest('session=signed'), makeEnv());
    expect(await res.json()).toMatchObject({ isAdmin: true });
  });
});
