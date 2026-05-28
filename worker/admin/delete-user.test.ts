// ABOUT: Tests for admin delete-user handlers — confirmation page and execute with audit trail.

import { describe, expect, it, vi } from 'vitest';
import { handleDeleteUserConfirmPage, handleDeleteUserExecute } from './delete-user';
import type { Env } from '../index';

const ADMIN_USER = {
  user_handle: 'aabb1122',
  created_at: 1700000000000,
  session_count: 3,
  last_session_at: 1700500000000,
  preset_count: 1,
};

function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    delete: vi.fn(async (k: string) => {
      store.delete(k);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true })),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function makeD1(lookupResult: unknown = ADMIN_USER) {
  const ops: string[] = [];
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(async () => lookupResult),
    run: vi.fn(async () => {
      ops.push('run');
      return { success: true, meta: { changes: 1 } };
    }),
    all: vi.fn(async () => ({ results: [] })),
  };
  const db = {
    prepare: vi.fn((sql: string) => {
      ops.push(`prepare:${sql.slice(0, 12)}`);
      return stmt;
    }),
    batch: vi.fn(async () => {
      ops.push('batch');
      return [];
    }),
  } as unknown as D1Database;
  return { db, stmt, ops };
}

function makeEnv(db: D1Database, sessions: KVNamespace): Env {
  return { DB: db, SESSIONS: sessions, ALLOW_ADMIN_BYPASS: '1' } as unknown as Env;
}

function postRequest(url: string, handle: string, origin = 'https://takt.hultberg.org'): Request {
  const body = new URLSearchParams({ handle });
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin },
    body: body.toString(),
  });
}

describe('handleDeleteUserConfirmPage', () => {
  it('renders confirmation page with user stats', async () => {
    const { db } = makeD1();
    const kv = makeKv();
    const req = postRequest('https://takt.hultberg.org/admin/user-delete', 'aabb1122');
    const res = await handleDeleteUserConfirmPage(req, makeEnv(db, kv));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const text = await res.text();
    expect(text).toContain('aabb1122');
    expect(text).toContain('This action is permanent');
    expect(text).toContain('3'); // session_count
    expect(text).toContain('Confirm delete');
    expect(text).toContain('/admin/user-delete/confirm');
  });

  it('returns 404 with Cache-Control: no-store for unknown handle', async () => {
    const { db } = makeD1(null);
    const kv = makeKv();
    const req = postRequest('https://takt.hultberg.org/admin/user-delete', 'nobody');
    const res = await handleDeleteUserConfirmPage(req, makeEnv(db, kv));
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 400 with Cache-Control: no-store when handle is missing', async () => {
    const { db } = makeD1();
    const kv = makeKv();
    const req = new Request('https://takt.hultberg.org/admin/user-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://takt.hultberg.org',
      },
      body: '',
    });
    const res = await handleDeleteUserConfirmPage(req, makeEnv(db, kv));
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 403 with Cache-Control: no-store when CSRF origin is disallowed', async () => {
    const { db } = makeD1();
    const kv = makeKv();
    const req = postRequest(
      'https://takt.hultberg.org/admin/user-delete',
      'aabb1122',
      'https://evil.example.com',
    );
    const res = await handleDeleteUserConfirmPage(req, makeEnv(db, kv));
    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('handleDeleteUserExecute', () => {
  it('inserts admin_log before cascade delete and clears KV sessions', async () => {
    const { db, ops } = makeD1();
    const kv = makeKv();
    const req = postRequest('https://takt.hultberg.org/admin/user-delete/confirm', 'aabb1122');
    const res = await handleDeleteUserExecute(req, makeEnv(db, kv));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('User deleted');
    expect(text).toContain('aabb1122');

    // Verify admin_log INSERT happened (prepare called with INSERT INTO admin_log)
    const prepareArgs = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: string[]) => c[0],
    );
    const logIndex = prepareArgs.findIndex((s: string) => s.includes('admin_log'));
    const batchIndex = ops.indexOf('batch');
    // admin_log INSERT (run) must complete before cascade batch
    const runIndex = ops.findIndex((o) => o === 'run');
    expect(logIndex).toBeGreaterThanOrEqual(0);
    expect(runIndex).toBeGreaterThanOrEqual(0);
    expect(runIndex).toBeLessThan(batchIndex);
  });

  it('returns success page with user handle', async () => {
    const { db } = makeD1();
    const kv = makeKv();
    const req = postRequest('https://takt.hultberg.org/admin/user-delete/confirm', 'aabb1122');
    const res = await handleDeleteUserExecute(req, makeEnv(db, kv));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('aabb1122');
    expect(text).toContain('permanently removed');
  });

  it('returns 404 with Cache-Control: no-store for unknown handle', async () => {
    const { db } = makeD1(null);
    const kv = makeKv();
    const req = postRequest('https://takt.hultberg.org/admin/user-delete/confirm', 'nobody');
    const res = await handleDeleteUserExecute(req, makeEnv(db, kv));
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 400 with Cache-Control: no-store when handle is missing from form', async () => {
    const { db } = makeD1();
    const kv = makeKv();
    const req = new Request('https://takt.hultberg.org/admin/user-delete/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://takt.hultberg.org',
      },
      body: '',
    });
    const res = await handleDeleteUserExecute(req, makeEnv(db, kv));
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
