// ABOUT: Returns the current authenticated user (userHandle + isAdmin) or null.

import type { Env } from '../../index';
import { getSession } from '../../lib/sessionStore';

export async function me(request: Request, env: Env): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json(null);
  return Response.json({ userHandle: session.userHandle, isAdmin: session.isAdmin });
}
