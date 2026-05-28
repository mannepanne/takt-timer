// ABOUT: Admin delete-user handlers — two-step confirmation before hard delete.
// ABOUT: Audit log row is inserted BEFORE cascade so a partial failure still leaves a trail.

import type { Env } from '../index';
import { requireAdminAuthWithCsrf } from './auth';
import { adminLayout, escHtml } from './views/layout.html';
import { getUserByHandleAdmin, insertAdminLog, deleteUserCascade } from '../db/queries';
import { deleteUserSessions } from '../lib/sessionStore';

function renderConfirmPage(handle: string, sessionCount: number, presetCount: number): string {
  return `
<h1>Delete user</h1>
<div class="alert alert-warning">
  <strong>This action is permanent and cannot be undone.</strong>
  All sessions, presets, and account data will be removed.
</div>
<table>
  <tr><th>Handle</th><td><code>${escHtml(handle)}</code></td></tr>
  <tr><th>Sessions</th><td>${sessionCount}</td></tr>
  <tr><th>Presets</th><td>${presetCount}</td></tr>
</table>
<p>
  <a href="/admin/user?handle=${encodeURIComponent(handle)}" class="btn btn-secondary">Cancel</a>
  &nbsp;
  <form method="POST" action="/admin/user-delete/confirm">
    <input type="hidden" name="handle" value="${escHtml(handle)}">
    <button type="submit" class="btn btn-danger">Confirm delete</button>
  </form>
</p>`;
}

export async function handleDeleteUserConfirmPage(request: Request, env: Env): Promise<Response> {
  const auth = requireAdminAuthWithCsrf(request, env);
  if (auth instanceof Response) return auth;

  const formData = await request.formData();
  const handle = (formData.get('handle') as string | null) ?? '';
  if (!handle)
    return new Response('Bad Request', { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const user = await getUserByHandleAdmin(env.DB, handle);
  if (!user)
    return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

  return adminLayout(
    `Delete ${handle}`,
    renderConfirmPage(handle, user.session_count, user.preset_count),
  );
}

export async function handleDeleteUserExecute(request: Request, env: Env): Promise<Response> {
  const auth = requireAdminAuthWithCsrf(request, env);
  if (auth instanceof Response) return auth;
  const { actor } = auth;

  const formData = await request.formData();
  const handle = (formData.get('handle') as string | null) ?? '';
  if (!handle)
    return new Response('Bad Request', { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const user = await getUserByHandleAdmin(env.DB, handle);
  if (!user)
    return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

  // Audit log first — ensures a record exists even if the cascade fails midway.
  await insertAdminLog(env.DB, 'delete_user', actor, handle, Date.now());
  await deleteUserSessions(env, handle);
  await deleteUserCascade(env.DB, handle);

  return adminLayout(
    'User deleted',
    `<h1>User deleted</h1>
<p>Handle <code>${escHtml(handle)}</code> and all associated data have been permanently removed.</p>
<p><a href="/admin" class="btn btn-secondary">Back to dashboard</a></p>`,
  );
}
