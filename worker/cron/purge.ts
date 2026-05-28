// ABOUT: Daily retention purge — deletes users inactive for >90 days with no sessions or presets.
// ABOUT: Called by the `scheduled` export in index.ts via ctx.waitUntil.

import { pruneInactiveUsers, pruneVoiceCalls, insertPurgeRun } from '../db/queries';

export const RETENTION_DAYS = 90;

export async function runPurge(db: D1Database, now = Date.now()): Promise<void> {
  const thresholdMs = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const { deleted } = await pruneInactiveUsers(db, thresholdMs, false);
  // Clean up anonymous (null user_handle) voice_calls rows older than the threshold.
  // Authenticated user rows are deleted by pruneInactiveUsers / deleteUserCascade above.
  await pruneVoiceCalls(db, thresholdMs);
  await insertPurgeRun(db, now, deleted);
}
