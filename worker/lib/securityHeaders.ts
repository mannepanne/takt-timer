// ABOUT: Applies a baseline security header set to every outbound response.
// ABOUT: Tightened further in Phase 6; this set is safe for a content-only shell.

const BASELINE_HEADERS: Record<string, string> = {
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
