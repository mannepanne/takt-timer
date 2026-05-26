// ABOUT: Tests for POST /api/presets — creates a new preset for the authenticated user.

import { describe, expect, it, vi } from 'vitest';
import { presetsCreate } from './create';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({ getSession: vi.fn() }));
vi.mock('../../db/queries', () => ({
  insertPreset: vi.fn(async () => {}),
  getMaxOrderIndex: vi.fn(async () => ({ max_idx: -1 })),
}));

import { getSession } from '../../lib/sessionStore';
import { insertPreset, getMaxOrderIndex } from '../../db/queries';

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
  return new Request('https://takt.hultberg.org/api/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'session=signed' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { name: 'Legs', sets: 3, work_sec: 60, rest_sec: 30 };

describe('presetsCreate', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await presetsCreate(makeRequest(VALID_BODY), makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await presetsCreate(makeRequest({ name: '', sets: 0 }), makeEnv());
    expect(res.status).toBe(400);
  });

  it('returns 201 with the created preset', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getMaxOrderIndex).mockResolvedValueOnce({ max_idx: 1 } as any);
    const res = await presetsCreate(makeRequest(VALID_BODY), makeEnv());
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body).toMatchObject({
      name: 'Legs',
      sets: 3,
      work_sec: 60,
      rest_sec: 30,
      order_index: 2,
    });
    expect(typeof body.id).toBe('string');
  });

  it('inserts preset at order_index 0 when no existing presets', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getMaxOrderIndex).mockResolvedValueOnce({ max_idx: -1 } as any);
    const res = await presetsCreate(makeRequest(VALID_BODY), makeEnv());
    const body = (await res.json()) as any;
    expect(body.order_index).toBe(0);
  });

  it('sets pinned=0 by default', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await presetsCreate(makeRequest(VALID_BODY), makeEnv());
    const body = (await res.json()) as any;
    expect(body.pinned).toBe(0);
  });

  it('accepts pinned=1 in the body', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await presetsCreate(makeRequest({ ...VALID_BODY, pinned: 1 }), makeEnv());
    const body = (await res.json()) as any;
    expect(body.pinned).toBe(1);
  });

  it('calls insertPreset with the user_handle', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u99', isAdmin: false });
    await presetsCreate(makeRequest(VALID_BODY), makeEnv());
    expect(vi.mocked(insertPreset)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user_handle: 'u99' }),
    );
  });
});
