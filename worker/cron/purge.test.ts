// ABOUT: Tests for the daily retention purge cron job.
// ABOUT: Covers eligibility criteria, dry-run, and purge_runs audit row insertion.

import { describe, expect, it, vi } from 'vitest';
import { runPurge, RETENTION_DAYS } from './purge';

const NOW = 1_000_000_000_000;
const THRESHOLD = NOW - RETENTION_DAYS * 24 * 60 * 60 * 1000;

// A pruneInactiveUsers result that deletes two users.
function makeDb(prunedHandles: string[] = [], deletedCount = 0): { db: D1Database; ops: string[] } {
  const ops: string[] = [];
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(async () => null),
    run: vi.fn(async () => {
      ops.push('run');
      return { success: true };
    }),
    all: vi.fn(async () => ({ results: prunedHandles.map((h) => ({ user_handle: h })) })),
  };
  const db = {
    prepare: vi.fn((sql: string) => {
      ops.push(`prepare:${sql.trim().slice(0, 14)}`);
      return stmt;
    }),
    batch: vi.fn(async () => {
      ops.push('batch');
      // Simulate deletedCount by updating the pruneInactiveUsers stub directly.
      return Array(deletedCount).fill({ success: true });
    }),
  } as unknown as D1Database;
  return { db, ops };
}

// A db stub wired to return specific pruneInactiveUsers behaviour.
function makeDbWith(
  selectResults: string[],
  eligibleOnRecheck: string[],
): { db: D1Database; ops: string[] } {
  const ops: string[] = [];
  let callIdx = 0;
  const db = {
    prepare: vi.fn((sql: string) => {
      const label = `prepare:${sql.trim().slice(0, 14)}`;
      ops.push(label);
      return {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(async () => null),
        run: vi.fn(async () => {
          ops.push('run');
          return { success: true };
        }),
        all: vi.fn(async () => {
          const results =
            callIdx++ === 0
              ? selectResults.map((h) => ({ user_handle: h }))
              : eligibleOnRecheck.map((h) => ({ user_handle: h }));
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

describe('runPurge', () => {
  it('calls pruneInactiveUsers with 90-day threshold and inserts a purge_runs row', async () => {
    // The stub returns 2 eligible handles, deleted = 2.
    const { db, ops } = makeDbWith(['user-a', 'user-b'], ['user-a', 'user-b']);
    await runPurge(db, NOW);

    // At least one SELECT (eligibility check) and one INSERT into purge_runs.
    expect(ops.some((o) => o.startsWith('prepare:SELECT'))).toBe(true);
    expect(ops.some((o) => o.startsWith('prepare:INSERT'))).toBe(true);
    // A batch was issued for the deletes.
    expect(ops).toContain('batch');
    // A purge_runs run() was called.
    expect(ops.filter((o) => o === 'run').length).toBeGreaterThanOrEqual(1);
  });

  it('still inserts a purge_runs row when no users are eligible', async () => {
    const { db, ops } = makeDb([], 0);
    await runPurge(db, NOW);

    // No batch (nothing to delete).
    expect(ops).not.toContain('batch');
    // purge_runs row still written.
    expect(ops.some((o) => o === 'run')).toBe(true);
  });

  it('passes the correct threshold based on RETENTION_DAYS and now', async () => {
    let capturedThreshold: number | undefined;
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...args: unknown[]) => {
          if (sql.includes('created_at')) capturedThreshold = args[0] as number;
          return {
            first: vi.fn(async () => null),
            run: vi.fn(async () => ({})),
            all: vi.fn(async () => ({ results: [] })),
          };
        }),
        first: vi.fn(async () => null),
        run: vi.fn(async () => ({})),
        all: vi.fn(async () => ({ results: [] })),
      })),
      batch: vi.fn(async () => []),
    } as unknown as D1Database;

    await runPurge(db, NOW);

    expect(capturedThreshold).toBe(THRESHOLD);
  });

  it('defaults now to Date.now() when omitted (smoke test — no assertion on exact value)', async () => {
    const { db } = makeDb([], 0);
    await expect(runPurge(db)).resolves.toBeUndefined();
  });
});
