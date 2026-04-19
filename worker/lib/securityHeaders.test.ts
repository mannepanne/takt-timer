import { describe, expect, it } from 'vitest';

import { applySecurityHeaders } from './securityHeaders';

describe('applySecurityHeaders', () => {
  it('adds HSTS, Referrer-Policy, nosniff, and Permissions-Policy to a response', () => {
    const out = applySecurityHeaders(new Response('hi'));
    expect(out.headers.get('Strict-Transport-Security')).toContain('max-age=');
    expect(out.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(out.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(out.headers.get('Permissions-Policy')).toContain('microphone');
  });

  it('does not overwrite headers that the upstream response already set', () => {
    const upstream = new Response('hi', {
      headers: { 'Referrer-Policy': 'no-referrer' },
    });
    const out = applySecurityHeaders(upstream);
    expect(out.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('preserves status and body', async () => {
    const upstream = new Response('payload', { status: 201 });
    const out = applySecurityHeaders(upstream);
    expect(out.status).toBe(201);
    expect(await out.text()).toBe('payload');
  });
});
