// ABOUT: Tests for admin dashboard handler — metrics batch query and HTML rendering.

import { describe, expect, it, vi } from 'vitest';
import { getDashboardMetrics, handleDashboard } from './dashboard';
import type { Env } from '../index';

const NOW = 1_748_000_000_000;

function makeBatchDb(values: number[]) {
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn(async () => ({})),
      first: vi.fn(async () => null),
      all: vi.fn(async () => ({ results: [] })),
    })),
    batch: vi.fn(async () => values.map((n) => ({ results: [{ n }], success: true, meta: {} }))),
  } as unknown as D1Database;
  return db;
}

function makeEnv(db: D1Database): Env {
  return { DB: db, ALLOW_ADMIN_BYPASS: '1' } as unknown as Env;
}

describe('getDashboardMetrics', () => {
  it('returns all eight metrics from the batch', async () => {
    const db = makeBatchDb([10, 2, 5, 8, 30, 90, 15, 42]);
    const m = await getDashboardMetrics(db, NOW);
    expect(m).toEqual({
      totalUsers: 10,
      newUsers7d: 2,
      activeUsers7d: 5,
      activeUsers30d: 8,
      sessions7d: 30,
      sessions30d: 90,
      voiceCalls7d: 15,
      voiceCalls30d: 42,
    });
  });

  it('defaults missing batch results to 0', async () => {
    // batch returns fewer rows than expected (simulates empty result sets)
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn(async () => ({})),
        first: vi.fn(async () => null),
        all: vi.fn(async () => ({ results: [] })),
      })),
      batch: vi.fn(async () => Array(8).fill({ results: [], success: true, meta: {} })),
    } as unknown as D1Database;
    const m = await getDashboardMetrics(db, NOW);
    expect(m.voiceCalls7d).toBe(0);
    expect(m.voiceCalls30d).toBe(0);
    expect(m.totalUsers).toBe(0);
  });

  it('issues exactly 8 statements in the batch', async () => {
    const stmts: unknown[] = [];
    const db = {
      prepare: vi.fn(() => {
        const stmt = {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn(async () => ({})),
          first: vi.fn(async () => null),
          all: vi.fn(async () => ({ results: [] })),
        };
        stmts.push(stmt);
        return stmt;
      }),
      batch: vi.fn(async (args: unknown[]) => {
        return args.map(() => ({ results: [{ n: 0 }], success: true, meta: {} }));
      }),
    } as unknown as D1Database;

    await getDashboardMetrics(db, NOW);
    expect(db.batch).toHaveBeenCalledTimes(1);
    const batchArgs = (db.batch as ReturnType<typeof vi.fn>).mock.calls[0][0] as unknown[];
    expect(batchArgs).toHaveLength(8);
  });
});

describe('handleDashboard', () => {
  it('returns 200 HTML with voice call metrics', async () => {
    const db = makeBatchDb([5, 1, 2, 3, 10, 40, 7, 20]);
    const req = new Request('https://takt.hultberg.org/admin');
    const res = await handleDashboard(req, makeEnv(db));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Voice calls');
    expect(text).toContain('7');
    expect(text).toContain('20');
  });

  it('includes a back-to-Takt link in the nav', async () => {
    const db = makeBatchDb([0, 0, 0, 0, 0, 0, 0, 0]);
    const req = new Request('https://takt.hultberg.org/admin');
    const res = await handleDashboard(req, makeEnv(db));
    const text = await res.text();
    expect(text).toContain('href="/"');
    expect(text).toContain('← Takt');
  });

  it('returns 403 when admin auth fails', async () => {
    const db = makeBatchDb([]);
    const env = { DB: db, ALLOW_ADMIN_BYPASS: undefined } as unknown as Env;
    const req = new Request('https://workers.dev/admin');
    const res = await handleDashboard(req, env);
    expect(res.status).toBe(403);
  });
});
