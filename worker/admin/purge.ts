// ABOUT: Admin purge handler — execute the retention purge (POST /run) and record audit row.

import type { Env } from '../index';
import { requireAdminAuthWithCsrf } from './auth';
import { adminLayout } from './views/layout';
import { pruneInactiveUsers, insertPurgeRun, insertAdminLog } from '../db/queries';
import { RETENTION_DAYS } from '../cron/purge';

function renderResult(deleted: number): string {
  return `
<h1>Purge complete</h1>
<p><strong>${deleted}</strong> user${deleted === 1 ? '' : 's'} purged. Audit row recorded.</p>
<p><a href="/admin/user" class="btn btn-secondary">Back to users</a></p>`;
}

export async function handlePurgeRun(request: Request, env: Env): Promise<Response> {
  const auth = requireAdminAuthWithCsrf(request, env);
  if (auth instanceof Response) return auth;

  const now = Date.now();
  const thresholdMs = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const { deleted } = await pruneInactiveUsers(env.DB, thresholdMs, false);
  await insertPurgeRun(env.DB, now, deleted);
  await insertAdminLog(env.DB, 'purge_run', auth.actor, null, now);
  return adminLayout('Purge complete', renderResult(deleted));
}
