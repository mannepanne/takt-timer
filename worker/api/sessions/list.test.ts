// ABOUT: Tests for GET /api/sessions — lists sessions or returns latest.

import { describe, expect, it, vi } from 'vitest';
import { sessionsList } from './list';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({ getSession: vi.fn() }));
vi.mock('../../db/queries', () => ({
  listSessions: vi.fn(),
  getLatestSession: vi.fn(),
}));

import { getSession } from '../../lib/sessionStore';
import { listSessions, getLatestSession } from '../../db/queries';

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

function makeRequest(search = '') {
  return new Request(`https://takt.hultberg.org/api/sessions${search}`);
}

const SESSION_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  user_handle: 'u1',
  completed_at: 1700000000,
  total_sec: 300,
  sets: 3,
  work_sec: 60,
  rest_sec: 30,
};

describe('sessionsList', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await sessionsList(makeRequest(), makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns list of sessions', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(listSessions).mockResolvedValueOnce({ results: [SESSION_ROW] } as any);
    const res = await sessionsList(makeRequest(), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([SESSION_ROW]);
  });

  it('returns empty array when no sessions', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(listSessions).mockResolvedValueOnce({ results: [] } as any);
    const res = await sessionsList(makeRequest(), makeEnv());
    expect(await res.json()).toEqual([]);
  });

  it('returns latest session when ?latest=1', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getLatestSession).mockResolvedValueOnce(SESSION_ROW as any);
    const res = await sessionsList(makeRequest('?latest=1'), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(SESSION_ROW);
  });

  it('returns null when ?latest=1 and no sessions exist', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getLatestSession).mockResolvedValueOnce(null);
    const res = await sessionsList(makeRequest('?latest=1'), makeEnv());
    expect(await res.json()).toBeNull();
  });
});
