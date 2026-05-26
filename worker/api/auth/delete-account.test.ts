// ABOUT: Tests for DELETE /api/auth/delete — hard-deletes user, presets, sessions.

import { describe, expect, it, vi } from 'vitest';
import { deleteAccount } from './delete-account';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({
  getSession: vi.fn(),
  deleteSession: vi.fn(async () => {}),
  clearCookieValue: vi.fn(() => 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'),
}));

vi.mock('../../db/queries', () => ({
  deleteUserCascade: vi.fn(async () => {}),
}));

import { getSession } from '../../lib/sessionStore';
import { deleteUserCascade } from '../../db/queries';

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
  return new Request('https://takt.hultberg.org/api/auth/delete', {
    method: 'DELETE',
    headers: cookie ? { Cookie: cookie } : {},
  });
}

describe('deleteAccount', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await deleteAccount(makeRequest(), makeEnv());
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'unauthenticated' });
  });

  it('calls deleteUserCascade with the userHandle', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'user123', isAdmin: false });
    await deleteAccount(makeRequest('session=signed'), makeEnv());
    expect(vi.mocked(deleteUserCascade)).toHaveBeenCalledWith(expect.anything(), 'user123');
  });

  it('returns 200 with ok:true on success', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'user123', isAdmin: false });
    const res = await deleteAccount(makeRequest('session=signed'), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('clears the session cookie in the response', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'user123', isAdmin: false });
    const res = await deleteAccount(makeRequest('session=signed'), makeEnv());
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
