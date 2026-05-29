// ABOUT: Tests for the admin router — verifies each path/method pair dispatches correctly.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { handleAdmin } from './router';
import type { Env } from '../index';

vi.mock('./dashboard', () => ({ handleDashboard: vi.fn() }));
vi.mock('./user-lookup', () => ({ handleUserLookup: vi.fn() }));
vi.mock('./delete-user', () => ({
  handleDeleteUserConfirmPage: vi.fn(),
  handleDeleteUserExecute: vi.fn(),
}));
vi.mock('./purge', () => ({ handlePurgeRun: vi.fn() }));

import { handleDashboard } from './dashboard';
import { handleUserLookup } from './user-lookup';
import { handleDeleteUserConfirmPage, handleDeleteUserExecute } from './delete-user';
import { handlePurgeRun } from './purge';

const ok = new Response('ok', { status: 200 });
const env = {} as unknown as Env;

beforeEach(() => {
  vi.mocked(handleDashboard).mockResolvedValue(ok);
  vi.mocked(handleUserLookup).mockResolvedValue(ok);
  vi.mocked(handleDeleteUserConfirmPage).mockResolvedValue(ok);
  vi.mocked(handleDeleteUserExecute).mockResolvedValue(ok);
  vi.mocked(handlePurgeRun).mockResolvedValue(ok);
});

describe('handleAdmin', () => {
  it('routes GET /admin to handleDashboard', async () => {
    const req = new Request('https://takt.hultberg.org/admin', { method: 'GET' });
    await handleAdmin(req, env);
    expect(handleDashboard).toHaveBeenCalledWith(req, env);
  });

  it('routes GET /admin/ to handleDashboard', async () => {
    const req = new Request('https://takt.hultberg.org/admin/', { method: 'GET' });
    await handleAdmin(req, env);
    expect(handleDashboard).toHaveBeenCalledWith(req, env);
  });

  it('routes GET /admin/user to handleUserLookup', async () => {
    const req = new Request('https://takt.hultberg.org/admin/user', { method: 'GET' });
    await handleAdmin(req, env);
    expect(handleUserLookup).toHaveBeenCalledWith(req, env);
  });

  it('routes POST /admin/user-delete to handleDeleteUserConfirmPage', async () => {
    const req = new Request('https://takt.hultberg.org/admin/user-delete', { method: 'POST' });
    await handleAdmin(req, env);
    expect(handleDeleteUserConfirmPage).toHaveBeenCalledWith(req, env);
  });

  it('routes POST /admin/user-delete/confirm to handleDeleteUserExecute', async () => {
    const req = new Request('https://takt.hultberg.org/admin/user-delete/confirm', {
      method: 'POST',
    });
    await handleAdmin(req, env);
    expect(handleDeleteUserExecute).toHaveBeenCalledWith(req, env);
  });

  it('returns 404 for GET /admin/purge (standalone page removed)', async () => {
    const req = new Request('https://takt.hultberg.org/admin/purge', { method: 'GET' });
    const res = await handleAdmin(req, env);
    expect(res.status).toBe(404);
  });

  it('routes POST /admin/purge/run to handlePurgeRun', async () => {
    const req = new Request('https://takt.hultberg.org/admin/purge/run', { method: 'POST' });
    await handleAdmin(req, env);
    expect(handlePurgeRun).toHaveBeenCalledWith(req, env);
  });

  it('returns 404 for unknown path', async () => {
    const req = new Request('https://takt.hultberg.org/admin/unknown', { method: 'GET' });
    const res = await handleAdmin(req, env);
    expect(res.status).toBe(404);
  });

  it('returns 404 for wrong method on known path', async () => {
    const req = new Request('https://takt.hultberg.org/admin', { method: 'POST' });
    const res = await handleAdmin(req, env);
    expect(res.status).toBe(404);
  });
});
