// ABOUT: Origin allowlist helper for same-origin-only API routes.
// ABOUT: Blocks third-party sites from calling paid-inference endpoints via a visitor's browser.

const PRODUCTION_ORIGINS = ['https://takt.hultberg.org', 'https://takt.herrings.workers.dev'];

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:8787',
];

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  // Same-origin requests in some browsers (notably direct navigations and certain fetches) omit
  // the Origin header entirely. Treat as allowed — the request cannot have been cross-site.
  if (!origin) return true;
  return PRODUCTION_ORIGINS.includes(origin) || DEV_ORIGINS.includes(origin);
}
