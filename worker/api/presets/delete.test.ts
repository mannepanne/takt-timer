// ABOUT: Tests for DELETE /api/presets/:id — deletes a preset owned by the authenticated user.

import { describe, expect, it, vi } from 'vitest';
import { presetsDelete } from './delete';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({ getSession: vi.fn() }));
vi.mock('../../db/queries', () => ({
  getPreset: vi.fn(),
  deletePreset: vi.fn(async () => {}),
}));

import { getSession } from '../../lib/sessionStore';
import { getPreset, deletePreset } from '../../db/queries';

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

function makeRequest(id = 'preset-1') {
  return new Request(`https://takt.hultberg.org/api/presets/${id}`, {
    method: 'DELETE',
    headers: { Cookie: 'session=signed' },
  });
}

const EXISTING = {
  id: 'preset-1',
  user_handle: 'u1',
  name: 'Legs',
  sets: 3,
  work_sec: 60,
  rest_sec: 30,
  pinned: 0,
  order_index: 0,
  created_at: 1000,
};

describe('presetsDelete', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await presetsDelete(makeRequest(), makeEnv(), 'preset-1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when preset not found', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getPreset).mockResolvedValueOnce(null);
    const res = await presetsDelete(makeRequest(), makeEnv(), 'preset-1');
    expect(res.status).toBe(404);
  });

  it('returns 200 with ok:true on success', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getPreset).mockResolvedValueOnce(EXISTING as any);
    const res = await presetsDelete(makeRequest(), makeEnv(), 'preset-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('calls deletePreset with correct id and userHandle', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getPreset).mockResolvedValueOnce(EXISTING as any);
    await presetsDelete(makeRequest(), makeEnv(), 'preset-1');
    expect(vi.mocked(deletePreset)).toHaveBeenCalledWith(expect.anything(), 'preset-1', 'u1');
  });
});
