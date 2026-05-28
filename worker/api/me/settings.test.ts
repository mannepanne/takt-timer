// ABOUT: Tests for GET /api/me/settings and PUT /api/me/settings.

import { describe, expect, it, vi } from 'vitest';
import { getSettings, putSettings } from './settings';
import type { Env } from '../../index';

vi.mock('../../lib/sessionStore', () => ({ getSession: vi.fn() }));
vi.mock('../../db/queries', () => ({
  getUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
}));

import { getSession } from '../../lib/sessionStore';
import { getUserSettings, updateUserSettings } from '../../db/queries';

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

const GET_REQ = new Request('https://takt.hultberg.org/api/me/settings');

function putReq(body: unknown) {
  return new Request('https://takt.hultberg.org/api/me/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const DEFAULTS = { language: 'en', accent_colour: 'lichen', sound_on: 1 };

describe('getSettings', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await getSettings(GET_REQ, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns settings row for authenticated user', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getUserSettings).mockResolvedValueOnce(DEFAULTS);
    const res = await getSettings(GET_REQ, makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(DEFAULTS);
  });

  it('returns 404 when user row is missing', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(getUserSettings).mockResolvedValueOnce(null);
    const res = await getSettings(GET_REQ, makeEnv());
    expect(res.status).toBe(404);
  });
});

describe('putSettings', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await putSettings(putReq(DEFAULTS), makeEnv());
    expect(res.status).toBe(401);
  });

  it('saves valid settings and returns ok', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    vi.mocked(updateUserSettings).mockResolvedValueOnce({
      success: true,
      meta: { changes: 1 },
    } as any);
    const res = await putSettings(putReq(DEFAULTS), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateUserSettings).toHaveBeenCalledWith(expect.anything(), 'u1', DEFAULTS);
  });

  it('returns 404 when user row is missing (0 changes)', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'ghost', isAdmin: false });
    vi.mocked(updateUserSettings).mockResolvedValueOnce({
      success: true,
      meta: { changes: 0 },
    } as any);
    const res = await putSettings(putReq(DEFAULTS), makeEnv());
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'not_found' });
  });

  it('rejects unknown language', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await putSettings(
      putReq({ language: 'fr', accent_colour: 'lichen', sound_on: 1 }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_language' });
  });

  it('rejects unknown accent', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await putSettings(
      putReq({ language: 'en', accent_colour: 'magenta', sound_on: 1 }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_accent_colour' });
  });

  it('rejects invalid sound_on value', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await putSettings(
      putReq({ language: 'en', accent_colour: 'lichen', sound_on: 2 }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_sound_on' });
  });

  it('rejects malformed JSON', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const req = new Request('https://takt.hultberg.org/api/me/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await putSettings(req, makeEnv());
    expect(res.status).toBe(400);
  });

  it('rejects a non-object JSON body (null)', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userHandle: 'u1', isAdmin: false });
    const res = await putSettings(putReq(null), makeEnv());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body' });
  });
});
