// ABOUT: Tests for PATCH /api/presets/:id — updates a preset owned by the authenticated user.

import { describe, expect, it, vi } from 'vitest';
import { presetsUpdate } from './update';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({ getSession: vi.fn() }));
vi.mock('../../db/queries', () => ({
  getPreset: vi.fn(),
  updatePreset: vi.fn(async () => {}),
}));

import { getSession } from '../../lib/sessionStore';
import { getPreset, updatePreset } from '../../db/queries';

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

function makeRequest(body: unknown, id = 'preset-1') {
  return new Request(`https://takt.hultberg.org/api/presets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: 'session=signed' },
    body: JSON.stringify(body),
  });
}

const EXISTING = {
  id: 'preset-1',
  user_handle: 'u1',
  name: 'Old',
  sets: 3,
  work_sec: 60,
  rest_sec: 30,
  pinned: 0,
  order_index: 0,
  created_at: 1000,
};

describe('presetsUpdate', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await presetsUpdate(makeRequest({ name: 'New' }), makeEnv(), 'preset-1');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await presetsUpdate(makeRequest({ sets: -1 }), makeEnv(), 'preset-1');
    expect(res.status).toBe(400);
  });

  it('returns 404 when preset not found or not owned', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getPreset).mockResolvedValueOnce(null);
    const res = await presetsUpdate(makeRequest({ name: 'New' }), makeEnv(), 'preset-1');
    expect(res.status).toBe(404);
  });

  it('returns 200 with merged preset on success', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getPreset).mockResolvedValueOnce(EXISTING as any);
    const res = await presetsUpdate(makeRequest({ name: 'New Name' }), makeEnv(), 'preset-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: 'New Name', sets: 3 });
  });

  it('calls updatePreset with correct id and userHandle', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getPreset).mockResolvedValueOnce(EXISTING as any);
    await presetsUpdate(makeRequest({ sets: 5 }), makeEnv(), 'preset-1');
    expect(vi.mocked(updatePreset)).toHaveBeenCalledWith(expect.anything(), 'preset-1', 'u1', {
      sets: 5,
    });
  });
});
