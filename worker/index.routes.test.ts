// ABOUT: Route dispatch tests for worker/index.ts — verifies each path/method reaches the right handler.

import { describe, expect, it, vi } from 'vitest';
import worker, { type Env } from './index';

// Stub all handlers so we test routing, not handler logic.
vi.mock('./api/auth/registration', () => ({
  registrationOptions: vi.fn(async () => Response.json({ mocked: 'reg-options' })),
  registrationVerify: vi.fn(async () => Response.json({ mocked: 'reg-verify' })),
}));
vi.mock('./api/auth/signin', () => ({
  signinOptions: vi.fn(async () => Response.json({ mocked: 'signin-options' })),
  signinVerify: vi.fn(async () => Response.json({ mocked: 'signin-verify' })),
}));
vi.mock('./api/auth/signout', () => ({
  signout: vi.fn(async () => Response.json({ mocked: 'signout' })),
}));
vi.mock('./api/auth/me', () => ({
  me: vi.fn(async () => Response.json({ mocked: 'me' })),
}));
vi.mock('./api/auth/delete-account', () => ({
  deleteAccount: vi.fn(async () => Response.json({ mocked: 'delete' })),
}));
vi.mock('./api/presets/list', () => ({
  presetsList: vi.fn(async () => Response.json({ mocked: 'list' })),
}));
vi.mock('./api/presets/create', () => ({
  presetsCreate: vi.fn(async () => Response.json({ mocked: 'create' })),
}));
vi.mock('./api/presets/update', () => ({
  presetsUpdate: vi.fn(async () => Response.json({ mocked: 'update' })),
}));
vi.mock('./api/presets/delete', () => ({
  presetsDelete: vi.fn(async () => Response.json({ mocked: 'delete' })),
}));
vi.mock('./api/presets/reorder', () => ({
  presetsReorder: vi.fn(async () => Response.json({ mocked: 'reorder' })),
}));
vi.mock('./api/sessions/append', () => ({
  sessionsAppend: vi.fn(async () => Response.json({ mocked: 'append' })),
}));
vi.mock('./api/sessions/list', () => ({
  sessionsList: vi.fn(async () => Response.json({ mocked: 'sessions-list' })),
}));
vi.mock('./api/voice/parse', () => ({
  parseVoice: vi.fn(async () => new Response('', { status: 200 })),
}));

import { registrationOptions, registrationVerify } from './api/auth/registration';
import { signinOptions, signinVerify } from './api/auth/signin';
import { signout } from './api/auth/signout';
import { me } from './api/auth/me';
import { deleteAccount } from './api/auth/delete-account';
import { presetsList } from './api/presets/list';
import { presetsCreate } from './api/presets/create';
import { presetsUpdate } from './api/presets/update';
import { presetsDelete } from './api/presets/delete';
import { presetsReorder } from './api/presets/reorder';
import { sessionsAppend } from './api/sessions/append';
import { sessionsList } from './api/sessions/list';

function makeEnv(): Env {
  return {
    ASSETS: {
      fetch: vi.fn(async () => new Response('spa', { status: 200 })),
    } as unknown as Fetcher,
    AI: { run: vi.fn() } as unknown as Ai,
    RATE_LIMITS: {} as KVNamespace,
    DB: {} as D1Database,
    SESSIONS: {} as KVNamespace,
    SESSION_COOKIE_SECRET: 'test',
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_ORIGIN: 'http://localhost:5173',
  };
}

function ctx() {
  return {} as ExecutionContext;
}

function req(path: string, method = 'GET', headers: Record<string, string> = {}) {
  return new Request(`https://takt.hultberg.org${path}`, { method, headers });
}

describe('Auth routes', () => {
  it('POST /api/auth/registration/options → registrationOptions', async () => {
    await worker.fetch(req('/api/auth/registration/options', 'POST'), makeEnv(), ctx());
    expect(vi.mocked(registrationOptions)).toHaveBeenCalledOnce();
  });

  it('POST /api/auth/registration/verify → registrationVerify', async () => {
    await worker.fetch(req('/api/auth/registration/verify', 'POST'), makeEnv(), ctx());
    expect(vi.mocked(registrationVerify)).toHaveBeenCalledOnce();
  });

  it('POST /api/auth/signin/options → signinOptions', async () => {
    await worker.fetch(req('/api/auth/signin/options', 'POST'), makeEnv(), ctx());
    expect(vi.mocked(signinOptions)).toHaveBeenCalledOnce();
  });

  it('POST /api/auth/signin/verify → signinVerify', async () => {
    await worker.fetch(req('/api/auth/signin/verify', 'POST'), makeEnv(), ctx());
    expect(vi.mocked(signinVerify)).toHaveBeenCalledOnce();
  });

  it('POST /api/auth/signout → signout', async () => {
    await worker.fetch(req('/api/auth/signout', 'POST'), makeEnv(), ctx());
    expect(vi.mocked(signout)).toHaveBeenCalledOnce();
  });

  it('GET /api/auth/me → me', async () => {
    await worker.fetch(req('/api/auth/me', 'GET'), makeEnv(), ctx());
    expect(vi.mocked(me)).toHaveBeenCalledOnce();
  });

  it('DELETE /api/auth/delete → deleteAccount', async () => {
    await worker.fetch(req('/api/auth/delete', 'DELETE'), makeEnv(), ctx());
    expect(vi.mocked(deleteAccount)).toHaveBeenCalledOnce();
  });
});

describe('Presets routes', () => {
  it('GET /api/presets → presetsList', async () => {
    await worker.fetch(req('/api/presets'), makeEnv(), ctx());
    expect(vi.mocked(presetsList)).toHaveBeenCalledOnce();
  });

  it('POST /api/presets → presetsCreate', async () => {
    await worker.fetch(req('/api/presets', 'POST'), makeEnv(), ctx());
    expect(vi.mocked(presetsCreate)).toHaveBeenCalledOnce();
  });

  it('returns 405 for unsupported method on /api/presets', async () => {
    const res = await worker.fetch(req('/api/presets', 'DELETE'), makeEnv(), ctx());
    expect(res.status).toBe(405);
  });

  it('PATCH /api/presets/reorder → presetsReorder', async () => {
    await worker.fetch(req('/api/presets/reorder', 'PATCH'), makeEnv(), ctx());
    expect(vi.mocked(presetsReorder)).toHaveBeenCalledOnce();
  });

  it('returns 405 for unsupported method on /api/presets/reorder', async () => {
    const res = await worker.fetch(req('/api/presets/reorder', 'POST'), makeEnv(), ctx());
    expect(res.status).toBe(405);
  });

  it('PATCH /api/presets/:id → presetsUpdate', async () => {
    await worker.fetch(req('/api/presets/some-id', 'PATCH'), makeEnv(), ctx());
    expect(vi.mocked(presetsUpdate)).toHaveBeenCalledOnce();
  });

  it('DELETE /api/presets/:id → presetsDelete', async () => {
    await worker.fetch(req('/api/presets/some-id', 'DELETE'), makeEnv(), ctx());
    expect(vi.mocked(presetsDelete)).toHaveBeenCalledOnce();
  });

  it('returns 405 for unsupported method on /api/presets/:id', async () => {
    const res = await worker.fetch(req('/api/presets/some-id', 'POST'), makeEnv(), ctx());
    expect(res.status).toBe(405);
  });
});

describe('Sessions routes', () => {
  it('GET /api/sessions → sessionsList', async () => {
    await worker.fetch(req('/api/sessions'), makeEnv(), ctx());
    expect(vi.mocked(sessionsList)).toHaveBeenCalledOnce();
  });

  it('POST /api/sessions → sessionsAppend', async () => {
    await worker.fetch(req('/api/sessions', 'POST'), makeEnv(), ctx());
    expect(vi.mocked(sessionsAppend)).toHaveBeenCalledOnce();
  });

  it('returns 405 for unsupported method on /api/sessions', async () => {
    const res = await worker.fetch(req('/api/sessions', 'DELETE'), makeEnv(), ctx());
    expect(res.status).toBe(405);
  });
});

describe('Origin guard', () => {
  it('returns 403 for /api/presets with disallowed origin', async () => {
    const res = await worker.fetch(
      req('/api/presets', 'GET', { origin: 'https://evil.example.com' }),
      makeEnv(),
      ctx(),
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 for /api/sessions with disallowed origin', async () => {
    const res = await worker.fetch(
      req('/api/sessions', 'GET', { origin: 'https://evil.example.com' }),
      makeEnv(),
      ctx(),
    );
    expect(res.status).toBe(403);
  });
});
