// ABOUT: Tests for admin purge handlers — dry-run preview and execute with audit row.

import { describe, expect, it, vi } from 'vitest';
import { handlePurgeDryRun, handlePurgeRun } from './purge';
import type { Env } from '../index';

function makeKv(): KVNamespace {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    list: vi.fn(async () => ({ keys: [], list_complete: true })),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

// Build a D1 stub that returns a fixed list of eligible handles on the SELECT.
function makeDb(eligibleHandles: string[] = [], recheckHandles?: string[]) {
  const ops: string[] = [];
  let callIdx = 0;
  const db = {
    prepare: vi.fn((sql: string) => {
      ops.push(`sql:${sql.trim().slice(0, 12)}`);
      return {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(async () => null),
        run: vi.fn(async () => {
          ops.push('run');
          return { success: true };
        }),
        all: vi.fn(async () => {
          // First call → initial eligibility SELECT; subsequent → recheck or reuse
          const results =
            callIdx++ === 0
              ? eligibleHandles.map((h) => ({ user_handle: h }))
              : (recheckHandles ?? eligibleHandles).map((h) => ({ user_handle: h }));
          return { results };
        }),
      };
    }),
    batch: vi.fn(async () => {
      ops.push('batch');
      return [];
    }),
  } as unknown as D1Database;
  return { db, ops };
}

function makeEnv(db: D1Database): Env {
  return {
    DB: db,
    SESSIONS: makeKv(),
    ALLOW_ADMIN_BYPASS: '1',
  } as unknown as Env;
}

const ORIGIN = 'https://takt.hultberg.org';

describe('handlePurgeDryRun (GET /admin/purge)', () => {
  it('shows zero-eligible message when no users match', async () => {
    const { db } = makeDb([]);
    const req = new Request(`${ORIGIN}/admin/purge`);
    const res = await handlePurgeDryRun(req, makeEnv(db));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('0 users eligible');
    expect(text).toContain('Nothing to purge');
    expect(text).not.toContain('Run purge');
  });

  it('lists eligible handles and shows Run purge button', async () => {
    const { db } = makeDb(['user-a', 'user-b']);
    const req = new Request(`${ORIGIN}/admin/purge`);
    const res = await handlePurgeDryRun(req, makeEnv(db));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('user-a');
    expect(text).toContain('user-b');
    expect(text).toContain('Run purge');
  });

  it('does NOT modify any data (dry-run only)', async () => {
    const { db, ops } = makeDb(['user-x']);
    const req = new Request(`${ORIGIN}/admin/purge`);
    await handlePurgeDryRun(req, makeEnv(db));
    expect(ops).not.toContain('batch');
    expect(ops.filter((o) => o === 'run')).toHaveLength(0);
  });

  it('returns 403 without admin auth', async () => {
    const { db } = makeDb([]);
    const env = { DB: db, ALLOW_ADMIN_BYPASS: undefined } as unknown as Env;
    const req = new Request('https://workers.dev/admin/purge');
    const res = await handlePurgeDryRun(req, env);
    expect(res.status).toBe(403);
  });
});

describe('handlePurgeRun (POST /admin/purge/run)', () => {
  it('runs purge and records a purge_runs audit row', async () => {
    const { db, ops } = makeDb(['user-a', 'user-b'], ['user-a', 'user-b']);
    const req = new Request(`${ORIGIN}/admin/purge/run`, {
      method: 'POST',
      headers: { Origin: ORIGIN },
    });
    const res = await handlePurgeRun(req, makeEnv(db));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Purge complete');
    // A batch should have fired for the cascaded deletes.
    expect(ops).toContain('batch');
    // And a purge_runs INSERT run() should have been called.
    expect(ops.filter((o) => o === 'run').length).toBeGreaterThanOrEqual(1);
  });

  it('records audit row even when nothing was purged', async () => {
    const { db, ops } = makeDb([]);
    const req = new Request(`${ORIGIN}/admin/purge/run`, {
      method: 'POST',
      headers: { Origin: ORIGIN },
    });
    const res = await handlePurgeRun(req, makeEnv(db));
    expect(res.status).toBe(200);
    // No batch (nothing to delete).
    expect(ops).not.toContain('batch');
    // purge_runs INSERT still fires.
    expect(ops.filter((o) => o === 'run').length).toBeGreaterThanOrEqual(1);
  });

  it('shows deleted count in the success page', async () => {
    const { db } = makeDb(['user-only-one'], ['user-only-one']);
    const req = new Request(`${ORIGIN}/admin/purge/run`, {
      method: 'POST',
      headers: { Origin: ORIGIN },
    });
    const res = await handlePurgeRun(req, makeEnv(db));
    const text = await res.text();
    // HTML wraps the count in <strong>, so check for the number and text separately.
    expect(text).toContain('1');
    expect(text).toContain('user purged');
  });

  it('returns 403 without admin auth', async () => {
    const { db } = makeDb([]);
    const env = { DB: db, ALLOW_ADMIN_BYPASS: undefined } as unknown as Env;
    const req = new Request('https://workers.dev/admin/purge/run', {
      method: 'POST',
      headers: { Origin: 'https://workers.dev' },
    });
    const res = await handlePurgeRun(req, env);
    expect(res.status).toBe(403);
  });

  it('returns 403 when a disallowed third-party Origin is sent (CSRF guard)', async () => {
    const { db } = makeDb([]);
    const req = new Request(`${ORIGIN}/admin/purge/run`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example.com' },
    });
    const res = await handlePurgeRun(req, makeEnv(db));
    expect(res.status).toBe(403);
  });
});
