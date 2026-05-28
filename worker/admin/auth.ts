// ABOUT: Admin authentication guard using Cloudflare Access headers.
// ABOUT: Hostname guard prevents workers.dev spoofing; ALLOW_ADMIN_BYPASS enables local dev.

import type { Env } from '../index';
import { isAllowedOrigin } from '../lib/isAllowedOrigin';

const PRODUCTION_HOSTNAME = 'takt.hultberg.org';
const DEV_ACTOR = 'dev@local';

export function getAdminActor(
  request: Request,
  env: Pick<Env, 'ALLOW_ADMIN_BYPASS'>,
): string | null {
  if (env.ALLOW_ADMIN_BYPASS === '1') return DEV_ACTOR;
  // workers.dev is reachable without Cloudflare Access — block it so the
  // CF-Access header cannot be forged by hitting the workers.dev subdomain.
  const hostname = new URL(request.url).hostname;
  if (hostname !== PRODUCTION_HOSTNAME) return null;
  return request.headers.get('CF-Access-Authenticated-User-Email');
}

export function requireAdminAuth(
  request: Request,
  env: Pick<Env, 'ALLOW_ADMIN_BYPASS'>,
): { actor: string } | Response {
  const actor = getAdminActor(request, env);
  if (!actor) return new Response('Forbidden', { status: 403 });
  return { actor };
}

export function requireAdminAuthWithCsrf(
  request: Request,
  env: Pick<Env, 'ALLOW_ADMIN_BYPASS'>,
): { actor: string } | Response {
  const actor = getAdminActor(request, env);
  if (!actor) return new Response('Forbidden', { status: 403 });
  if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
  return { actor };
}
