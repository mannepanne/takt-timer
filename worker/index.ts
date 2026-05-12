// ABOUT: Cloudflare Worker entry point.
// ABOUT: Serves the Vite-built SPA via Workers Assets and handles /api/* routes.

import { health } from './api/health';
import { parseVoice } from './api/voice/parse';
import { applySecurityHeaders } from './lib/securityHeaders';

export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  RATE_LIMITS: KVNamespace;
  // Set to "1" (or "true") in a gitignored `.dev.vars` file at the repo root to skip the
  // rate limiter under `wrangler dev`. Never set in production — `.dev.vars` is not
  // deployed, so the binding is undefined in prod. See ADR 2026-05-12-kv-rate-limiter.md.
  ALLOW_RATE_LIMIT_BYPASS?: string;
  // Additional bindings are declared here as they are activated per-phase.
  // The canonical list of planned bindings lives in wrangler.toml.
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return applySecurityHeaders(await health());
    }

    if (url.pathname === '/api/voice/parse') {
      return applySecurityHeaders(await parseVoice(request, env));
    }

    // Everything else is served from the static SPA bundle.
    const assetResponse = await env.ASSETS.fetch(request);
    return applySecurityHeaders(assetResponse);
  },
} satisfies ExportedHandler<Env>;
