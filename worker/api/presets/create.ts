// ABOUT: Creates a new preset for the authenticated user.

import { z } from 'zod';
import type { Env } from '../../index';
import { getSession } from '../../lib/sessionStore';
import { insertPreset, getMaxOrderIndex } from '../../db/queries';

const Body = z.object({
  name: z.string().min(1).max(100),
  sets: z.number().int().min(1).max(99),
  work_sec: z.number().int().min(5).max(3600),
  rest_sec: z.number().int().min(0).max(3600),
  pinned: z.number().int().min(0).max(1).optional().default(0),
});

export async function presetsCreate(request: Request, env: Env): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: 'invalid-request' }, { status: 400 });
  }

  const maxRow = await getMaxOrderIndex(env.DB, session.userHandle);
  const order_index = (maxRow?.max_idx ?? -1) + 1;

  const preset = {
    id: crypto.randomUUID(),
    user_handle: session.userHandle,
    name: body.name,
    sets: body.sets,
    work_sec: body.work_sec,
    rest_sec: body.rest_sec,
    pinned: body.pinned,
    order_index,
    created_at: Date.now(),
  };

  await insertPreset(env.DB, preset);
  return Response.json(preset, { status: 201 });
}
