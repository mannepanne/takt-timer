// ABOUT: Hard-deletes the authenticated user, presets, and sessions from D1.
// ABOUT: Explicit cascade transaction — D1 FK ON DELETE CASCADE is advisory only.

import type { Env } from '../../index';
import { getSession, deleteSession, clearCookieValue } from '../../lib/sessionStore';
import { deleteUserCascade } from '../../db/queries';

export async function deleteAccount(request: Request, env: Env): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  await deleteUserCascade(env.DB, session.userHandle);
  await deleteSession(env, request.headers.get('Cookie'));

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookieValue(),
    },
  });
}
