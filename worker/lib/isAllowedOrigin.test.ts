import { describe, expect, it } from 'vitest';

import { isAllowedOrigin } from './isAllowedOrigin';

function makeRequest(method: string, origin?: string): Request {
  const headers: HeadersInit = origin ? { origin } : {};
  return new Request('https://takt.hultberg.org/api/voice/parse', { method, headers });
}

describe('isAllowedOrigin', () => {
  describe('missing Origin header', () => {
    it('allows GET/HEAD/OPTIONS — browsers legitimately omit Origin for same-origin reads', () => {
      expect(isAllowedOrigin(makeRequest('GET'))).toBe(true);
      expect(isAllowedOrigin(makeRequest('HEAD'))).toBe(true);
      expect(isAllowedOrigin(makeRequest('OPTIONS'))).toBe(true);
    });

    it('rejects POST without Origin — state-changing requests always carry Origin from browsers', () => {
      expect(isAllowedOrigin(makeRequest('POST'))).toBe(false);
    });

    it('rejects PUT, PATCH, DELETE without Origin', () => {
      expect(isAllowedOrigin(makeRequest('PUT'))).toBe(false);
      expect(isAllowedOrigin(makeRequest('PATCH'))).toBe(false);
      expect(isAllowedOrigin(makeRequest('DELETE'))).toBe(false);
    });
  });

  describe('allowlisted origins', () => {
    it('allows the production origin', () => {
      expect(isAllowedOrigin(makeRequest('POST', 'https://takt.hultberg.org'))).toBe(true);
    });

    it('allows the workers.dev origin (used as deploy URL)', () => {
      expect(isAllowedOrigin(makeRequest('POST', 'https://takt.herrings.workers.dev'))).toBe(true);
    });

    it('allows wrangler dev + vite dev localhost origins (5173–5178 for port-conflict fallback)', () => {
      for (const port of [5173, 5174, 5175, 5176, 5177, 5178, 8787]) {
        expect(isAllowedOrigin(makeRequest('POST', `http://localhost:${port}`))).toBe(true);
        expect(isAllowedOrigin(makeRequest('POST', `http://127.0.0.1:${port}`))).toBe(true);
      }
    });
  });

  describe('rejected origins', () => {
    it('rejects third-party origins', () => {
      expect(isAllowedOrigin(makeRequest('POST', 'https://evil.example.com'))).toBe(false);
      expect(isAllowedOrigin(makeRequest('POST', 'https://takt.evil.com'))).toBe(false);
    });

    it('rejects lookalike origins that would match a lax check', () => {
      expect(isAllowedOrigin(makeRequest('POST', 'https://takt.hultberg.org.evil.com'))).toBe(
        false,
      );
      expect(isAllowedOrigin(makeRequest('POST', 'https://xtakt.hultberg.org'))).toBe(false);
    });

    it('rejects plain-http variants of the production origin', () => {
      expect(isAllowedOrigin(makeRequest('POST', 'http://takt.hultberg.org'))).toBe(false);
    });
  });
});
