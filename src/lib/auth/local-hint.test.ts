// ABOUT: Unit tests for the localStorage registration hint helpers.

import { describe, expect, it, beforeEach } from 'vitest';
import { markRegistered, hasRegisteredBefore } from './local-hint';

beforeEach(() => localStorage.clear());

describe('local-hint', () => {
  it('hasRegisteredBefore returns false when the key is absent', () => {
    expect(hasRegisteredBefore()).toBe(false);
  });

  it('hasRegisteredBefore returns true after markRegistered is called', () => {
    markRegistered();
    expect(hasRegisteredBefore()).toBe(true);
  });

  it('markRegistered is idempotent', () => {
    markRegistered();
    markRegistered();
    expect(hasRegisteredBefore()).toBe(true);
  });
});
