// ABOUT: Returns the 30 most recent sessions for the authenticated user.

import type { Env } from '../../index';
import { getSession } from '../../lib/sessionStore';
import { listSessions, getLatestSession } from '../../db/queries';

export async function sessionsList(request: Request, env: Env): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  if (url.searchParams.get('latest') === '1') {
    const latest = await getLatestSession(env.DB, session.userHandle);
    return Response.json(latest ?? null);
  }

  const result = await listSessions(env.DB, session.userHandle);
  return Response.json(result.results);
}
