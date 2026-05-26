// ABOUT: Updates name, sets, work_sec, rest_sec, or pinned for a preset owned by the authenticated user.

import { z } from 'zod';
import type { Env } from '../../index';
import { getSession } from '../../lib/sessionStore';
import { updatePreset, getPreset } from '../../db/queries';

const Body = z.object({
  name: z.string().min(1).max(100).optional(),
  sets: z.number().int().min(1).max(99).optional(),
  work_sec: z.number().int().min(5).max(3600).optional(),
  rest_sec: z.number().int().min(0).max(3600).optional(),
  pinned: z.number().int().min(0).max(1).optional(),
});

export async function presetsUpdate(request: Request, env: Env, id: string): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: 'invalid-request' }, { status: 400 });
  }

  const existing = await getPreset(env.DB, id, session.userHandle);
  if (!existing) return Response.json({ error: 'not-found' }, { status: 404 });

  await updatePreset(env.DB, id, session.userHandle, body);
  return Response.json({ ...existing, ...body });
}
