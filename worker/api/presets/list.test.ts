// ABOUT: Tests for GET /api/presets — lists presets for authenticated user.

import { describe, expect, it, vi } from 'vitest';
import { presetsList } from './list';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({ getSession: vi.fn() }));
vi.mock('../../db/queries', () => ({ listPresets: vi.fn() }));

import { getSession } from '../../lib/sessionStore';
import { listPresets } from '../../db/queries';

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

const GET = new Request('https://takt.hultberg.org/api/presets');

describe('presetsList', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await presetsList(GET, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns empty array when user has no presets', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(listPresets).mockResolvedValueOnce({ results: [] } as any);
    const res = await presetsList(GET, makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns presets ordered as returned by DB', async () => {
    const preset = {
      id: 'p1',
      name: 'Heavy',
      sets: 4,
      work_sec: 60,
      rest_sec: 30,
      pinned: 0,
      order_index: 0,
      user_handle: 'u1',
      created_at: 1000,
    };
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(listPresets).mockResolvedValueOnce({ results: [preset] } as any);
    const res = await presetsList(GET, makeEnv());
    expect(await res.json()).toEqual([preset]);
  });
});
