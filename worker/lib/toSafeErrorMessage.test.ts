import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toSafeErrorMessage } from './toSafeErrorMessage';

describe('toSafeErrorMessage', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('logs the reason and detail for an Error instance', () => {
    toSafeErrorMessage(new TypeError('boom'), 'whisper-error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, payload] = errorSpy.mock.calls[0];
    expect(JSON.parse(payload as string)).toEqual({
      reason: 'whisper-error',
      detail: 'TypeError: boom',
    });
  });

  it('logs non-Error throws via String coercion', () => {
    toSafeErrorMessage('something went wrong', 'llama-error');
    const [, payload] = errorSpy.mock.calls[0];
    expect(JSON.parse(payload as string)).toMatchObject({
      reason: 'llama-error',
      detail: 'something went wrong',
    });
  });

  it('includes optional log context', () => {
    toSafeErrorMessage(new Error('bad'), 'schema-failed', { attempt: 2, latencyMs: 543 });
    const [, payload] = errorSpy.mock.calls[0];
    expect(JSON.parse(payload as string)).toMatchObject({
      reason: 'schema-failed',
      attempt: 2,
      latencyMs: 543,
    });
  });

  it('does not return the detail string — detail is server-side only', () => {
    const result = toSafeErrorMessage(new Error('secret'), 'llama-error');
    expect(result).toBeUndefined();
  });
});
