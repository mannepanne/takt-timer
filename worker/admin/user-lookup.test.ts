// ABOUT: Tests for admin user lookup handler — form render, found user, not-found case.

import { describe, expect, it, vi } from 'vitest';
import { handleUserLookup } from './user-lookup';
import type { Env } from '../index';

function makeStmt(returnVal?: unknown) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(async () => returnVal ?? null),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    all: vi.fn(async () => ({ results: [] })),
  };
}

function makeD1(returnVal?: unknown) {
  const stmt = makeStmt(returnVal);
  const db = {
    prepare: vi.fn(() => stmt),
    batch: vi.fn(async () => []),
  } as unknown as D1Database;
  return { db, stmt };
}

function makeEnv(db: D1Database): Pick<Env, 'DB' | 'ALLOW_ADMIN_BYPASS'> {
  return { DB: db, ALLOW_ADMIN_BYPASS: '1' };
}

const ADMIN_USER = {
  user_handle: 'aabb1122',
  created_at: 1700000000000,
  session_count: 5,
  last_session_at: 1700500000000,
  preset_count: 2,
};

describe('handleUserLookup', () => {
  it('renders the lookup form with no results when no handle is provided', async () => {
    const { db } = makeD1();
    const req = new Request('https://takt.hultberg.org/admin/user');
    const res = await handleUserLookup(req, makeEnv(db) as unknown as Env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const text = await res.text();
    expect(text).toContain('User lookup');
    expect(text).toContain('<form');
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('returns 200 with user details when handle is found', async () => {
    const { db } = makeD1(ADMIN_USER);
    const req = new Request('https://takt.hultberg.org/admin/user?handle=aabb1122');
    const res = await handleUserLookup(req, makeEnv(db) as unknown as Env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('aabb1122');
    expect(text).toContain('Sessions');
    expect(text).toContain('5');
    expect(text).toContain('Delete user');
    // Delete button form points to /admin/user-delete
    expect(text).toContain('/admin/user-delete');
  });

  it('shows not-found message and re-renders form when handle is unknown', async () => {
    const { db } = makeD1(null);
    const req = new Request('https://takt.hultberg.org/admin/user?handle=unknown');
    const res = await handleUserLookup(req, makeEnv(db) as unknown as Env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('No user found');
    expect(text).toContain('unknown');
    // Should not show delete button
    expect(text).not.toContain('/admin/user-delete');
  });

  it('returns 403 when not authenticated', async () => {
    const { db } = makeD1();
    const req = new Request('https://takt.herrings.workers.dev/admin/user');
    const res = await handleUserLookup(req, {
      DB: db,
      ALLOW_ADMIN_BYPASS: undefined,
    } as unknown as Env);
    expect(res.status).toBe(403);
  });
});
