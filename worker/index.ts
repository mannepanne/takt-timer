// ABOUT: Cloudflare Worker entry point.
// ABOUT: Serves the Vite-built SPA via Workers Assets and handles /api/* routes.

import { health } from './api/health';
import { registrationOptions, registrationVerify } from './api/auth/registration';
import { signinOptions, signinVerify } from './api/auth/signin';
import { signout } from './api/auth/signout';
import { me } from './api/auth/me';
import { deleteAccount } from './api/auth/delete-account';
import { getSettings, putSettings } from './api/me/settings';
import { presetsList } from './api/presets/list';
import { presetsCreate } from './api/presets/create';
import { presetsUpdate } from './api/presets/update';
import { presetsDelete } from './api/presets/delete';
import { presetsReorder } from './api/presets/reorder';
import { sessionsAppend } from './api/sessions/append';
import { sessionsList } from './api/sessions/list';
import { parseVoice } from './api/voice/parse';
import { applySecurityHeaders } from './lib/securityHeaders';
import { isAllowedOrigin } from './lib/isAllowedOrigin';
import { handleAdmin } from './admin/router';
import { runPurge } from './cron/purge';

export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  RATE_LIMITS: KVNamespace;
  // Phase 4 bindings.
  DB: D1Database;
  SESSIONS: KVNamespace;
  SESSION_COOKIE_SECRET: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_ORIGIN: string;
  // Set to "1" in a gitignored `.dev.vars` to skip the rate limiter under `wrangler dev`.
  // See ADR 2026-05-12-kv-rate-limiter.md.
  ALLOW_RATE_LIMIT_BYPASS?: string;
  // Set to "1" in `.dev.vars` to bypass Cloudflare Access auth on admin routes under `wrangler dev`.
  ALLOW_ADMIN_BYPASS?: string;
}

function methodNotAllowed(): Response {
  return new Response('Method Not Allowed', { status: 405 });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ── Health ───────────────────────────────────────────────────────────────
    if (path === '/api/health') {
      return applySecurityHeaders(await health());
    }

    // ── Voice ────────────────────────────────────────────────────────────────
    if (path === '/api/voice/parse') {
      return applySecurityHeaders(await parseVoice(request, env, ctx));
    }

    // ── Auth ─────────────────────────────────────────────────────────────────
    if (path === '/api/auth/registration/options' && method === 'POST') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      return applySecurityHeaders(await registrationOptions(request, env));
    }
    if (path === '/api/auth/registration/verify' && method === 'POST') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      return applySecurityHeaders(await registrationVerify(request, env));
    }
    if (path === '/api/auth/signin/options' && method === 'POST') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      return applySecurityHeaders(await signinOptions(request, env));
    }
    if (path === '/api/auth/signin/verify' && method === 'POST') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      return applySecurityHeaders(await signinVerify(request, env));
    }
    if (path === '/api/auth/signout' && method === 'POST') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      return applySecurityHeaders(await signout(request, env));
    }
    if (path === '/api/auth/me' && method === 'GET') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      return applySecurityHeaders(await me(request, env));
    }
    if (path === '/api/auth/delete' && method === 'DELETE') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      return applySecurityHeaders(await deleteAccount(request, env));
    }

    // ── User settings ─────────────────────────────────────────────────────────
    if (path === '/api/me/settings') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      if (method === 'GET') return applySecurityHeaders(await getSettings(request, env));
      if (method === 'PUT') return applySecurityHeaders(await putSettings(request, env));
      return methodNotAllowed();
    }

    // ── Presets ───────────────────────────────────────────────────────────────
    if (path === '/api/presets') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      if (method === 'GET') return applySecurityHeaders(await presetsList(request, env));
      if (method === 'POST') return applySecurityHeaders(await presetsCreate(request, env));
      return methodNotAllowed();
    }
    if (path === '/api/presets/reorder') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      if (method === 'PATCH') return applySecurityHeaders(await presetsReorder(request, env));
      return methodNotAllowed();
    }
    const presetMatch = path.match(/^\/api\/presets\/([^/]+)$/);
    if (presetMatch) {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      const id = presetMatch[1];
      if (method === 'PATCH') return applySecurityHeaders(await presetsUpdate(request, env, id));
      if (method === 'DELETE') return applySecurityHeaders(await presetsDelete(request, env, id));
      return methodNotAllowed();
    }

    // ── Sessions ──────────────────────────────────────────────────────────────
    if (path === '/api/sessions') {
      if (!isAllowedOrigin(request)) return new Response('Forbidden', { status: 403 });
      if (method === 'GET') return applySecurityHeaders(await sessionsList(request, env));
      if (method === 'POST') return applySecurityHeaders(await sessionsAppend(request, env));
      return methodNotAllowed();
    }

    // ── Admin ─────────────────────────────────────────────────────────────────
    if (path.startsWith('/admin')) {
      return applySecurityHeaders(await handleAdmin(request, env));
    }

    // ── SPA fallback ──────────────────────────────────────────────────────────
    const assetResponse = await env.ASSETS.fetch(request);
    return applySecurityHeaders(assetResponse);
  },
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runPurge(env.DB));
  },
} satisfies ExportedHandler<Env>;
