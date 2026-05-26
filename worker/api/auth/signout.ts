// ABOUT: Signs the user out by deleting the KV session and clearing the cookie.

import type { Env } from '../../index';
import { deleteSession, clearCookieValue } from '../../lib/sessionStore';

export async function signout(request: Request, env: Env): Promise<Response> {
  await deleteSession(env, request.headers.get('Cookie'));
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookieValue(),
    },
  });
}
