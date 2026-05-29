// ABOUT: Admin users page — user lookup by handle and retention purge dry-run.

import type { Env } from '../index';
import { requireAdminAuth } from './auth';
import { adminLayout, escHtml } from './views/layout';
import { getUserByHandleAdmin, pruneInactiveUsers } from '../db/queries';
import type { AdminUserRow } from '../db/schema';
import { RETENTION_DAYS } from '../cron/purge';

function formatDate(ms: number | null): string {
  if (ms === null) return 'never';
  return new Date(ms).toISOString().slice(0, 10);
}

function renderLookupForm(handle: string, detail: string): string {
  return `
<h1>Users</h1>
<form method="GET" action="/admin/user">
  <input type="text" name="handle" value="${escHtml(handle)}" placeholder="User handle…" size="44">
  &nbsp;<button type="submit" class="btn btn-primary">Search</button>
</form>
${detail}`;
}

function renderPurgeSection(handles: string[]): string {
  const count = handles.length;
  const listItems = handles.map((h) => `<li><code>${escHtml(h)}</code></li>`).join('\n');
  return `
<h2 style="margin-top:2rem;font-size:1.2rem">Retention purge</h2>
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
}`;
}

function renderUserDetail(user: AdminUserRow): string {
  // Delete form uses POST so the handle stays out of URL history and server access logs.
  return `
<table>
  <tr><th>Handle</th><td><code>${escHtml(user.user_handle)}</code></td></tr>
  <tr><th>Created</th><td>${formatDate(user.created_at)}</td></tr>
  <tr><th>Sessions</th><td>${user.session_count} (last: ${formatDate(user.last_session_at)})</td></tr>
  <tr><th>Presets</th><td>${user.preset_count}</td></tr>
</table>
<form method="POST" action="/admin/user-delete">
  <input type="hidden" name="handle" value="${escHtml(user.user_handle)}">
  <button type="submit" class="btn btn-danger">Delete user…</button>
</form>`;
}

export async function handleUserLookup(request: Request, env: Env): Promise<Response> {
  const auth = requireAdminAuth(request, env);
  if (auth instanceof Response) return auth;

  const handle = new URL(request.url).searchParams.get('handle') ?? '';
  const thresholdMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const { userHandles } = await pruneInactiveUsers(env.DB, thresholdMs, true);
  const purgeSection = renderPurgeSection(userHandles);

  if (!handle) {
    return adminLayout('Users', renderLookupForm('', '') + purgeSection);
  }

  const user = await getUserByHandleAdmin(env.DB, handle);
  if (!user) {
    return adminLayout(
      'Users',
      renderLookupForm(
        handle,
        `<p style="margin-top:1rem"><strong>No user found</strong> for handle: <code>${escHtml(handle)}</code></p>`,
      ) + purgeSection,
    );
  }

  return adminLayout('Users', renderLookupForm(handle, renderUserDetail(user)) + purgeSection);
}
