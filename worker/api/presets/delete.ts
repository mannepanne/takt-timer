// ABOUT: Deletes a preset owned by the authenticated user.

import type { Env } from '../../index';
import { getSession } from '../../lib/sessionStore';
import { deletePreset, getPreset } from '../../db/queries';

export async function presetsDelete(request: Request, env: Env, id: string): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const existing = await getPreset(env.DB, id, session.userHandle);
  if (!existing) return Response.json({ error: 'not-found' }, { status: 404 });

  await deletePreset(env.DB, id, session.userHandle);
  return Response.json({ ok: true });
}
