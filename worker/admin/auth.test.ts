// ABOUT: Unit tests for admin authentication guard — hostname gate, Access header, CSRF check.

import { describe, expect, it } from 'vitest';
import { getAdminActor, requireAdminAuth, requireAdminAuthWithCsrf } from './auth';

function makeRequest(opts: { url?: string; origin?: string; accessEmail?: string }): Request {
  const url = opts.url ?? 'https://takt.hultberg.org/admin';
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers['Origin'] = opts.origin;
  if (opts.accessEmail !== undefined) {
    headers['CF-Access-Authenticated-User-Email'] = opts.accessEmail;
  }
  return new Request(url, { headers });
}

const PROD_ENV = { ALLOW_ADMIN_BYPASS: undefined as string | undefined };
const BYPASS_ENV = { ALLOW_ADMIN_BYPASS: '1' };

describe('getAdminActor', () => {
  it('returns null for workers.dev hostname even with Access header', () => {
    const req = makeRequest({
      url: 'https://takt.herrings.workers.dev/admin',
      accessEmail: 'a@b.com',
    });
    expect(getAdminActor(req, PROD_ENV)).toBeNull();
  });

  it('returns null for localhost hostname without bypass', () => {
    const req = makeRequest({
      url: 'http://localhost:8787/admin',
      accessEmail: 'a@b.com',
    });
    expect(getAdminActor(req, PROD_ENV)).toBeNull();
  });

  it('returns null when CF-Access header is missing on production hostname', () => {
    const req = makeRequest({ url: 'https://takt.hultberg.org/admin' });
    expect(getAdminActor(req, PROD_ENV)).toBeNull();
  });

  it('returns actor email when CF-Access header is present on production hostname', () => {
    const req = makeRequest({ accessEmail: 'magnus@example.com' });
    expect(getAdminActor(req, PROD_ENV)).toBe('magnus@example.com');
  });

  it('returns dev@local when ALLOW_ADMIN_BYPASS is "1"', () => {
    const req = makeRequest({ url: 'http://localhost:8787/admin' });
    expect(getAdminActor(req, BYPASS_ENV)).toBe('dev@local');
  });

  it('returns null when ALLOW_ADMIN_BYPASS is set to a non-"1" value', () => {
    const req = makeRequest({ url: 'http://localhost:8787/admin' });
    expect(getAdminActor(req, { ALLOW_ADMIN_BYPASS: 'true' })).toBeNull();
  });
});

describe('requireAdminAuth', () => {
  it('returns 403 Response when actor is null', () => {
    const req = makeRequest({ url: 'https://takt.herrings.workers.dev/admin' });
    const result = requireAdminAuth(req, PROD_ENV);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it('returns actor object when authenticated', () => {
    const req = makeRequest({ accessEmail: 'magnus@example.com' });
    const result = requireAdminAuth(req, PROD_ENV);
    expect(result).toEqual({ actor: 'magnus@example.com' });
  });

  it('returns actor object in bypass mode', () => {
    const req = makeRequest({ url: 'http://localhost:8787/admin' });
    const result = requireAdminAuth(req, BYPASS_ENV);
    expect(result).toEqual({ actor: 'dev@local' });
  });
});

describe('requireAdminAuthWithCsrf', () => {
  it('returns 403 when actor is null', () => {
    const req = makeRequest({
      url: 'https://takt.herrings.workers.dev/admin',
      origin: 'https://takt.hultberg.org',
    });
    const result = requireAdminAuthWithCsrf(req, PROD_ENV);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it('returns 403 when origin is disallowed', () => {
    const req = makeRequest({
      accessEmail: 'magnus@example.com',
      origin: 'https://evil.example.com',
    });
    const result = requireAdminAuthWithCsrf(req, PROD_ENV);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it('returns actor when authenticated and origin is allowed', () => {
    const req = makeRequest({
      accessEmail: 'magnus@example.com',
      origin: 'https://takt.hultberg.org',
    });
    const result = requireAdminAuthWithCsrf(req, PROD_ENV);
    expect(result).toEqual({ actor: 'magnus@example.com' });
  });

  it('returns actor when authenticated and no Origin header (same-origin navigation)', () => {
    const req = makeRequest({ accessEmail: 'magnus@example.com' });
    const result = requireAdminAuthWithCsrf(req, PROD_ENV);
    expect(result).toEqual({ actor: 'magnus@example.com' });
  });

  it('returns actor in bypass mode with localhost dev origin', () => {
    const req = makeRequest({
      url: 'http://localhost:8787/admin',
      origin: 'http://localhost:5173',
    });
    const result = requireAdminAuthWithCsrf(req, BYPASS_ENV);
    expect(result).toEqual({ actor: 'dev@local' });
  });
});
