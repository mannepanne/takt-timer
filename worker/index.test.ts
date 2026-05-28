import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker, { type Env } from './index';

function makeEnv(assetBody = 'spa bundle'): Env {
  return {
    ASSETS: {
      fetch: vi.fn(async () => new Response(assetBody, { status: 200 })),
    } as unknown as Fetcher,
    AI: { run: vi.fn(async () => ({ text: '' })) } as unknown as Ai,
    RATE_LIMITS: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      list: vi.fn(),
      getWithMetadata: vi.fn(),
    } as unknown as KVNamespace,
    DB: {} as D1Database,
    SESSIONS: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      list: vi.fn(),
      getWithMetadata: vi.fn(),
    } as unknown as KVNamespace,
    SESSION_COOKIE_SECRET: 'test-secret',
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_ORIGIN: 'http://localhost:5173',
  };
}

describe('Worker fetch handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('returns JSON from /api/health with security headers applied', async () => {
    const env = makeEnv();
    const response = await worker.fetch(
      new Request('https://takt.hultberg.org/api/health'),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=');
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('delegates all other paths to the static assets binding', async () => {
    const env = makeEnv('<!DOCTYPE html>…');
    const response = await worker.fetch(
      new Request('https://takt.hultberg.org/'),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<!DOCTYPE html>…');
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1);
  });

  it('logs API requests with method, path, status, and latencyMs', async () => {
    const env = makeEnv();
    await worker.fetch(
      new Request('https://takt.hultberg.org/api/health'),
      env,
      {} as ExecutionContext,
    );
    expect(logSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ method: 'GET', path: '/api/health', status: 200 });
    expect(typeof logged.latencyMs).toBe('number');
    expect(logged.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('does not log SPA asset requests', async () => {
    const env = makeEnv('<!DOCTYPE html>…');
    await worker.fetch(new Request('https://takt.hultberg.org/'), env, {} as ExecutionContext);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
