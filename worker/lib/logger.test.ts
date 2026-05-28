// ABOUT: Tests for the structured request logger.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logRequest } from './logger';

describe('logRequest', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emits a JSON line with ts and all required fields', () => {
    logRequest({ method: 'GET', path: '/api/health', status: 200, latencyMs: 5 });
    expect(logSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ method: 'GET', path: '/api/health', status: 200, latencyMs: 5 });
    expect(typeof parsed.ts).toBe('number');
  });

  it('includes optional fields when provided', () => {
    logRequest({
      method: 'POST',
      path: '/api/voice/parse',
      status: 200,
      latencyMs: 1234,
      authenticated: true,
      rateLimited: false,
      whisperMs: 400,
      llamaMs: 800,
    });
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      authenticated: true,
      rateLimited: false,
      whisperMs: 400,
      llamaMs: 800,
    });
  });

  it('does not throw when console.log throws', () => {
    logSpy.mockImplementation(() => {
      throw new Error('log failure');
    });
    expect(() =>
      logRequest({ method: 'GET', path: '/api/health', status: 200, latencyMs: 0 }),
    ).not.toThrow();
  });
});
