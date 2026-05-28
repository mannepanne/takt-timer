// ABOUT: Admin user lookup handler — search by handle, display profile stats.

import type { Env } from '../index';
import { requireAdminAuth } from './auth';
import { adminLayout, escHtml } from './views/layout.html';
import { getUserByHandleAdmin } from '../db/queries';
import type { AdminUserRow } from '../db/schema';

function formatDate(ms: number | null): string {
  if (ms === null) return 'never';
  return new Date(ms).toISOString().slice(0, 10);
}

function renderLookupForm(handle: string, detail: string): string {
  return `
<h1>User lookup</h1>
<form method="GET" action="/admin/user">
  <input type="text" name="handle" value="${escHtml(handle)}" placeholder="User handle…" size="44">
  &nbsp;<button type="submit" class="btn btn-primary">Search</button>
</form>
${detail}`;
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

  if (!handle) {
    return adminLayout('User lookup', renderLookupForm('', ''));
  }

  const user = await getUserByHandleAdmin(env.DB, handle);
  if (!user) {
    return adminLayout(
      'User lookup',
      renderLookupForm(
        handle,
        `<p style="margin-top:1rem"><strong>No user found</strong> for handle: <code>${escHtml(handle)}</code></p>`,
      ),
    );
  }

  return adminLayout('User lookup', renderLookupForm(handle, renderUserDetail(user)));
}
