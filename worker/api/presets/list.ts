// ABOUT: Lists all presets for the authenticated user, ordered by pin then order_index.

import type { Env } from '../../index';
import { getSession } from '../../lib/sessionStore';
import { listPresets } from '../../db/queries';

export async function presetsList(request: Request, env: Env): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const result = await listPresets(env.DB, session.userHandle);
  return Response.json(result.results);
}
