// ABOUT: GET /api/me/settings — returns persisted settings for the authenticated user.
// ABOUT: PUT /api/me/settings — replaces language, accent_colour, sound_on atomically.

import type { Env } from '../../index';
import { getSession } from '../../lib/sessionStore';
import { getUserSettings, updateUserSettings } from '../../db/queries';
import { checkAndIncrementUserDaily } from '../../lib/rate-limit';

const VALID_LANGUAGES = new Set(['en', 'sv']);
const VALID_ACCENTS = new Set(['lichen', 'coral', 'ocean', 'amber', 'iris', 'slate']);

export async function getSettings(request: Request, env: Env): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const row = await getUserSettings(env.DB, session.userHandle);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });

  return Response.json(row);
}

export async function putSettings(request: Request, env: Env): Promise<Response> {
  const session = await getSession(env, request.headers.get('Cookie'));
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  // Admin users and dev-bypass flag are exempt. 60/day is generous for a Settings screen while
  // capping the blast radius of a runaway client repeatedly hitting this authenticated endpoint.
  const rateCheck = await checkAndIncrementUserDaily(env.RATE_LIMITS, session.userHandle, {
    namespace: 'settings',
    cap: 60,
    bypass: env.ALLOW_RATE_LIMIT_BYPASS === '1' || session.isAdmin,
  });
  if (!rateCheck.allowed) {
    return Response.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { language, accent_colour, sound_on } = body as Record<string, unknown>;

  if (typeof language !== 'string' || !VALID_LANGUAGES.has(language)) {
    return Response.json({ error: 'invalid_language' }, { status: 400 });
  }
  if (typeof accent_colour !== 'string' || !VALID_ACCENTS.has(accent_colour)) {
    return Response.json({ error: 'invalid_accent_colour' }, { status: 400 });
  }
  if (sound_on !== 0 && sound_on !== 1) {
    return Response.json({ error: 'invalid_sound_on' }, { status: 400 });
  }

  const result = await updateUserSettings(env.DB, session.userHandle, {
    language,
    accent_colour,
    sound_on,
  });
  if (result.meta.changes === 0) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ ok: true });
}
