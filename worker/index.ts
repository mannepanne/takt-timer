// ABOUT: Cloudflare Worker entry point.
// ABOUT: Serves the Vite-built SPA via Workers Assets and handles /api/* routes.

import { health } from './api/health';
import { applySecurityHeaders } from './lib/securityHeaders';

export interface Env {
  ASSETS: Fetcher;
  // Future bindings declared here as they are added in later phases:
  // DB: D1Database;
  // SESSIONS: KVNamespace;
  // RATE_LIMITS: KVNamespace;
  // AI: Ai;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return applySecurityHeaders(await health());
    }

    // Everything else is served from the static SPA bundle.
    const assetResponse = await env.ASSETS.fetch(request);
    return applySecurityHeaders(assetResponse);
  },
} satisfies ExportedHandler<Env>;
