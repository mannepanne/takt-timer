// ABOUT: /api/health — returns 200 OK with a small JSON payload.
// ABOUT: Used by uptime checks and phase-1 smoke verification.

export async function health(): Promise<Response> {
  return Response.json({ ok: true, service: 'takt', version: '0.1.0' });
}
