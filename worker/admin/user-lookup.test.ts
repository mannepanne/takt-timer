// ABOUT: Tests for admin users page — all-user list, retention section, delete actions.

import { describe, expect, it, vi } from 'vitest';
import { handleUserLookup } from './user-lookup';
import type { Env } from '../index';

const USERS = [
  {
    user_handle: 'aabb1122',
    created_at: 1700000000000,
    session_count: 5,
    last_session_at: 1700500000000,
    preset_count: 2,
  },
  {
    user_handle: 'ccdd3344',
    created_at: 1699000000000,
    session_count: 0,
    last_session_at: null,
    preset_count: 0,
  },
];

function makeD1(purgeHandles: string[] = [], users = USERS) {
  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => null),
      run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      all: vi.fn(async () => {
        if (sql.includes('ORDER BY u.created_at')) {
          return { results: users };
        }
        return { results: purgeHandles.map((h) => ({ user_handle: h })) };
      }),
    })),
    batch: vi.fn(async () => []),
  } as unknown as D1Database;
  return db;
}

function makeEnv(db: D1Database): Env {
  return { DB: db, ALLOW_ADMIN_BYPASS: '1' } as unknown as Env;
}

describe('handleUserLookup', () => {
  it('renders retention section above user table', async () => {
    const db = makeD1();
    const req = new Request('https://takt.hultberg.org/admin/user');
    const res = await handleUserLookup(req, makeEnv(db));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const text = await res.text();
    expect(text).toContain('Users');
    expect(text).toContain('Retention purge');
    expect(text).toContain('Nothing to purge');
    expect(text).toContain('All users');
    // Retention section appears before user table
    expect(text.indexOf('Retention purge')).toBeLessThan(text.indexOf('All users'));
  });

  it('lists all users with handle, dates, session count, and preset count', async () => {
    const db = makeD1();
    const req = new Request('https://takt.hultberg.org/admin/user');
    const res = await handleUserLookup(req, makeEnv(db));
    const text = await res.text();
    expect(text).toContain('aabb1122');
    expect(text).toContain('ccdd3344');
    expect(text).toContain('All users (2)');
  });

  it('renders a delete form for each user', async () => {
    const db = makeD1();
    const req = new Request('https://takt.hultberg.org/admin/user');
    const res = await handleUserLookup(req, makeEnv(db));
    const text = await res.text();
    const deleteFormCount = (text.match(/\/admin\/user-delete/g) ?? []).length;
    expect(deleteFormCount).toBe(USERS.length);
  });

  it('shows purge-eligible handles and run button when candidates exist', async () => {
    const db = makeD1(['stale1', 'stale2']);
    const req = new Request('https://takt.hultberg.org/admin/user');
    const res = await handleUserLookup(req, makeEnv(db));
    const text = await res.text();
    expect(text).toContain('stale1');
    expect(text).toContain('stale2');
    expect(text).toContain('Run purge (2 users)');
  });

  it('shows no search form', async () => {
    const db = makeD1();
    const req = new Request('https://takt.hultberg.org/admin/user');
    const res = await handleUserLookup(req, makeEnv(db));
    const text = await res.text();
    expect(text).not.toContain('User handle');
    expect(text).not.toContain('type="text"');
  });

  it('shows "No users yet" when there are no users', async () => {
    const db = makeD1([], []);
    const req = new Request('https://takt.hultberg.org/admin/user');
    const res = await handleUserLookup(req, makeEnv(db));
    const text = await res.text();
    expect(text).toContain('No users yet');
    expect(text).toContain('All users (0)');
  });

  it('returns 403 when not authenticated', async () => {
    const db = makeD1();
    const req = new Request('https://takt.herrings.workers.dev/admin/user');
    const res = await handleUserLookup(req, {
      DB: db,
      ALLOW_ADMIN_BYPASS: undefined,
    } as unknown as Env);
    expect(res.status).toBe(403);
  });
});
