// ABOUT: Admin users page — all users list with delete actions and retention purge dry-run.

import type { Env } from '../index';
import { requireAdminAuth } from './auth';
import { adminLayout, escHtml } from './views/layout';
import { listAllUsersAdmin, pruneInactiveUsers } from '../db/queries';
import type { AdminUserRow } from '../db/schema';
import { RETENTION_DAYS } from '../cron/purge';

function formatDate(ms: number | null): string {
  if (ms === null) return 'never';
  return new Date(ms).toISOString().slice(0, 10);
}

function renderPurgeSection(handles: string[]): string {
  const count = handles.length;
  const listItems = handles.map((h) => `<li><code>${escHtml(h)}</code></li>`).join('\n');
  return `
<h2 style="font-size:1.2rem">Retention purge</h2>
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

function renderUserTable(users: AdminUserRow[]): string {
  if (users.length === 0) {
    return '<p>No users yet.</p>';
  }
  const rows = users
    .map(
      (u) => `
  <tr>
    <td><code>${escHtml(u.user_handle)}</code></td>
    <td>${formatDate(u.created_at)}</td>
    <td>${u.session_count} (last: ${formatDate(u.last_session_at)})</td>
    <td>${u.preset_count}</td>
    <td>
      <form method="POST" action="/admin/user-delete" style="margin:0">
        <input type="hidden" name="handle" value="${escHtml(u.user_handle)}">
        <button type="submit" class="btn btn-danger btn-sm">Delete…</button>
      </form>
    </td>
  </tr>`,
    )
    .join('');
  return `
<table>
  <thead>
    <tr>
      <th>Handle</th>
      <th>Created</th>
      <th>Sessions</th>
      <th>Presets</th>
      <th></th>
    </tr>
  </thead>
  <tbody>${rows}
  </tbody>
</table>`;
}

export async function handleUserLookup(request: Request, env: Env): Promise<Response> {
  const auth = requireAdminAuth(request, env);
  if (auth instanceof Response) return auth;

  const thresholdMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const [{ userHandles }, { results: users }] = await Promise.all([
    pruneInactiveUsers(env.DB, thresholdMs, true),
    listAllUsersAdmin(env.DB),
  ]);

  const html = `
<h1>Users</h1>
${renderPurgeSection(userHandles)}
<h2 style="margin-top:2rem;font-size:1.2rem">All users (${users.length})</h2>
${renderUserTable(users)}`;

  return adminLayout('Users', html);
}
