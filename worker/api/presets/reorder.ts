// ABOUT: Reorders presets for the authenticated user by accepting the full ordered ID array.

import { z } from 'zod';
import type { Env } from '../../index';
import { getSession } from '../../lib/sessionStore';
import { reorderPresets } from '../../db/queries';

const Body = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export async function presetsReorder(request: Request, env: Env): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: 'invalid-request' }, { status: 400 });
  }

  await reorderPresets(env.DB, session.userHandle, body.ids);
  return Response.json({ ok: true });
}
