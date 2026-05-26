// ABOUT: Tests for POST /api/sessions — idempotent session import.

import { describe, expect, it, vi } from 'vitest';
import { sessionsAppend } from './append';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({ getSession: vi.fn() }));
vi.mock('../../db/queries', () => ({ insertSessions: vi.fn(async () => 0) }));

import { getSession } from '../../lib/sessionStore';
import { insertSessions } from '../../db/queries';

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

function makeRequest(body: unknown) {
  return new Request('https://takt.hultberg.org/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'session=signed' },
    body: JSON.stringify(body),
  });
}

const SESSION_ENTRY = {
  id: crypto.randomUUID(),
  completed_at: 1700000000,
  total_sec: 300,
  sets: 3,
  work_sec: 60,
  rest_sec: 30,
};

describe('sessionsAppend', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await sessionsAppend(makeRequest({ sessions: [SESSION_ENTRY] }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await sessionsAppend(makeRequest({ sessions: [] }), makeEnv());
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required fields', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await sessionsAppend(makeRequest({ sessions: [{ id: 'bad' }] }), makeEnv());
    expect(res.status).toBe(400);
  });

  it('returns 200 with imported count', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(insertSessions).mockResolvedValueOnce(1);
    const res = await sessionsAppend(makeRequest({ sessions: [SESSION_ENTRY] }), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ imported: 1 });
  });

  it('appends user_handle to each row before inserting', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u99', isAdmin: false });
    vi.mocked(insertSessions).mockResolvedValueOnce(1);
    await sessionsAppend(makeRequest({ sessions: [SESSION_ENTRY] }), makeEnv());
    expect(vi.mocked(insertSessions)).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ user_handle: 'u99' }),
    ]);
  });

  it('returns imported=0 for duplicate sessions (idempotent)', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(insertSessions).mockResolvedValueOnce(0);
    const res = await sessionsAppend(makeRequest({ sessions: [SESSION_ENTRY] }), makeEnv());
    expect(await res.json()).toEqual({ imported: 0 });
  });
});
