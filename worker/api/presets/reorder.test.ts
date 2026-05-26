// ABOUT: Tests for PATCH /api/presets/reorder — reorders user's presets by full ID array.

import { describe, expect, it, vi } from 'vitest';
import { presetsReorder } from './reorder';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({ getSession: vi.fn() }));
vi.mock('../../db/queries', () => ({ reorderPresets: vi.fn(async () => {}) }));

import { getSession } from '../../lib/sessionStore';
import { reorderPresets } from '../../db/queries';

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
  return new Request('https://takt.hultberg.org/api/presets/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: 'session=signed' },
    body: JSON.stringify(body),
  });
}

const UUID1 = crypto.randomUUID();
const UUID2 = crypto.randomUUID();

describe('presetsReorder', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await presetsReorder(makeRequest({ ids: [UUID1] }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (empty ids array)', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await presetsReorder(makeRequest({ ids: [] }), makeEnv());
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-UUID ids', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await presetsReorder(makeRequest({ ids: ['not-a-uuid'] }), makeEnv());
    expect(res.status).toBe(400);
  });

  it('returns 200 with ok:true on success', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await presetsReorder(makeRequest({ ids: [UUID1, UUID2] }), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('calls reorderPresets with userHandle and ids', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    await presetsReorder(makeRequest({ ids: [UUID1, UUID2] }), makeEnv());
    expect(vi.mocked(reorderPresets)).toHaveBeenCalledWith(expect.anything(), 'u1', [UUID1, UUID2]);
  });
});
