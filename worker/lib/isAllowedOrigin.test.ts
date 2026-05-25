import { describe, expect, it } from 'vitest';

import { isAllowedOrigin } from './isAllowedOrigin';

function makeRequest(origin?: string): Request {
  const headers: HeadersInit = origin ? { origin } : {};
  return new Request('https://takt.hultberg.org/api/voice/parse', {
    method: 'POST',
    headers,
  });
}

describe('isAllowedOrigin', () => {
  it('allows requests with no Origin header (same-origin or tooling)', () => {
    expect(isAllowedOrigin(makeRequest())).toBe(true);
  });

  it('allows the production origin', () => {
    expect(isAllowedOrigin(makeRequest('https://takt.hultberg.org'))).toBe(true);
  });

  it('allows the workers.dev origin (used as deploy URL)', () => {
    expect(isAllowedOrigin(makeRequest('https://takt.herrings.workers.dev'))).toBe(true);
  });

  it('allows wrangler dev + vite dev localhost origins (5173–5178 for port-conflict fallback)', () => {
    for (const port of [5173, 5174, 5175, 5176, 5177, 5178, 8787]) {
      expect(isAllowedOrigin(makeRequest(`http://localhost:${port}`))).toBe(true);
      expect(isAllowedOrigin(makeRequest(`http://127.0.0.1:${port}`))).toBe(true);
    }
  });

  it('rejects third-party origins', () => {
    expect(isAllowedOrigin(makeRequest('https://evil.example.com'))).toBe(false);
    expect(isAllowedOrigin(makeRequest('https://takt.evil.com'))).toBe(false);
  });

  it('rejects lookalike origins that would match a lax check', () => {
    // Substring match would let these through; exact match doesn't.
    expect(isAllowedOrigin(makeRequest('https://takt.hultberg.org.evil.com'))).toBe(false);
    expect(isAllowedOrigin(makeRequest('https://xtakt.hultberg.org'))).toBe(false);
  });

  it('rejects plain-http variants of the production origin', () => {
    expect(isAllowedOrigin(makeRequest('http://takt.hultberg.org'))).toBe(false);
  });
});
