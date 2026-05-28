// ABOUT: Admin purge handler — dry-run preview (GET) and execute (POST /run).
// ABOUT: GET shows eligible users and a confirmation form; POST runs the purge and records audit row.

import type { Env } from '../index';
import { requireAdminAuth, requireAdminAuthWithCsrf } from './auth';
import { adminLayout } from './views/layout.html';
import { pruneInactiveUsers, insertPurgeRun } from '../db/queries';
import { RETENTION_DAYS } from '../cron/purge';

function renderDryRun(handles: string[]): string {
  const count = handles.length;
  const listItems = handles.map((h) => `<li><code>${h}</code></li>`).join('\n');
  return `
<h1>Retention purge</h1>
<p>Users inactive for more than <strong>${RETENTION_DAYS} days</strong> with no sessions and no presets.</p>
<div class="alert alert-warning">
  <strong>${count} user${count === 1 ? '' : 's'} eligible for purge.</strong>
  ${count > 0 ? `<ul style="margin:0.5rem 0 0">${listItems}</ul>` : ''}
</div>
${
  count > 0
    ? `<form method="POST" action="/admin/purge/run">
  <button type="submit" class="btn btn-danger">Run purge (${count} user${count === 1 ? '' : 's'})</button>
</form>`
    : '<p>Nothing to purge.</p>'
}
<p style="margin-top:1rem"><a href="/admin" class="btn btn-secondary">Back to dashboard</a></p>`;
}

function renderResult(deleted: number): string {
  return `
<h1>Purge complete</h1>
<p><strong>${deleted}</strong> user${deleted === 1 ? '' : 's'} purged. Audit row recorded.</p>
<p><a href="/admin" class="btn btn-secondary">Back to dashboard</a></p>`;
}

export async function handlePurgeDryRun(request: Request, env: Env): Promise<Response> {
  const auth = requireAdminAuth(request, env);
  if (auth instanceof Response) return auth;

  const thresholdMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const { userHandles } = await pruneInactiveUsers(env.DB, thresholdMs, true);
  return adminLayout('Retention purge', renderDryRun(userHandles));
}

export async function handlePurgeRun(request: Request, env: Env): Promise<Response> {
  const auth = requireAdminAuthWithCsrf(request, env);
  if (auth instanceof Response) return auth;

  const now = Date.now();
  const thresholdMs = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const { deleted } = await pruneInactiveUsers(env.DB, thresholdMs, false);
  await insertPurgeRun(env.DB, now, deleted);
  return adminLayout('Purge complete', renderResult(deleted));
}
