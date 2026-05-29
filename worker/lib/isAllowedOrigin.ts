// ABOUT: Origin allowlist helper for same-origin-only API routes.
// ABOUT: Blocks third-party sites from calling paid-inference endpoints via a visitor's browser.

const PRODUCTION_ORIGINS = ['https://takt.hultberg.org', 'https://takt.herrings.workers.dev'];

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:5177',
  'http://127.0.0.1:5178',
  'http://127.0.0.1:8787',
];

// Read-only methods omit Origin in same-origin requests — safe to allow without it.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    // Safe (read-only) methods legitimately omit Origin for same-origin requests.
    // State-changing methods always include Origin for cross-origin requests; a missing
    // Origin on these means a proxy stripped it or a non-browser client — reject to
    // close the bypass window described in issue #56.
    return SAFE_METHODS.has(request.method.toUpperCase());
  }
  return PRODUCTION_ORIGINS.includes(origin) || DEV_ORIGINS.includes(origin);
}
