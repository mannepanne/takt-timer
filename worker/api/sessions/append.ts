// ABOUT: Appends completed sessions for the authenticated user (import-on-register and live sync).
// ABOUT: Idempotent — INSERT OR IGNORE so re-submitting the same IDs is safe.

import { z } from 'zod';
import type { Env } from '../../index';
import { getSession } from '../../lib/sessionStore';
import { insertSessions } from '../../db/queries';

const SessionEntry = z.object({
  id: z.string().uuid(),
  completed_at: z.number().int().positive(),
  total_sec: z.number().int().min(0),
  sets: z.number().int().min(1).max(99),
  work_sec: z.number().int().min(5).max(3600),
  rest_sec: z.number().int().min(0).max(3600),
});

const Body = z.object({
  sessions: z.array(SessionEntry).min(1).max(500),
});

export async function sessionsAppend(request: Request, env: Env): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: 'invalid-request' }, { status: 400 });
  }

  const rows = body.sessions.map((s) => ({ ...s, user_handle: session.userHandle }));
  const imported = await insertSessions(env.DB, rows);

  return Response.json({ imported });
}
