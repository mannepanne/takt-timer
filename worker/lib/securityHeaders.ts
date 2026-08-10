// ABOUT: Applies a baseline security header set to every outbound response.
// ABOUT: Tightened further in Phase 6; this set is safe for a content-only shell.

const CSP_DIRECTIVES: Array<[string, string]> = [
  ['default-src', "'self'"],
  ['script-src', "'self' https://static.cloudflareinsights.com"],
  // No 'unsafe-inline': the app's React style={{…}} props set styles via the CSSOM, which
  // style-src does not police; the only literal style= attributes were the <noscript> fallback in
  // index.html, now ported to CSS classes. fonts.googleapis.com is the external font stylesheet.
  ['style-src', "'self' https://fonts.googleapis.com"],
  ['font-src', "'self' https://fonts.gstatic.com"],
  ['img-src', "'self' data:"],
  ['connect-src', "'self' https://cloudflareinsights.com"],
  ['frame-ancestors', "'none'"],
  ['base-uri', "'self'"],
  ['form-action', "'self'"],
  ['object-src', "'none'"],
];

const BASELINE_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP_DIRECTIVES.map(([k, v]) => `${k} ${v}`).join('; '),
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
};

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASELINE_HEADERS)) {
    if (!headers.has(name)) {
      headers.set(name, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
