// ABOUT: Tests for the stopwatch's localStorage persistence — round-trip, and defensive
// ABOUT: parsing of missing/malformed/invalid-shaped stored data.

import { afterEach, describe, expect, it } from 'vitest';

import { persistState, readPersistedState } from './persistence';
import type { MachineState } from './types';

const STORAGE_KEY = 'takt.stopwatch.v1';

describe('stopwatch persistence', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('readPersistedState returns null when nothing is stored', () => {
    expect(readPersistedState()).toBeNull();
  });

  it('round-trips an idle state', () => {
    const state: MachineState = { phase: 'idle', accumulatedMs: 0, startedAtMs: null };
    persistState(state);
    expect(readPersistedState()).toEqual(state);
  });

  it('round-trips a running state', () => {
    const state: MachineState = { phase: 'running', accumulatedMs: 5000, startedAtMs: 1_700_000 };
    persistState(state);
    expect(readPersistedState()).toEqual(state);
  });

  it('round-trips a paused state', () => {
    const state: MachineState = { phase: 'paused', accumulatedMs: 12_345, startedAtMs: null };
    persistState(state);
    expect(readPersistedState()).toEqual(state);
  });

  it('falls back to null on malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json{{{');
    expect(readPersistedState()).toBeNull();
  });

  it('falls back to null on a valid JSON value that is not an object', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify('running'));
    expect(readPersistedState()).toBeNull();
  });

  it('falls back to null when phase is not a recognised value', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ phase: 'bogus', accumulatedMs: 0, startedAtMs: null }),
    );
    expect(readPersistedState()).toBeNull();
  });

  it('falls back to null when accumulatedMs is missing or not a finite number', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ phase: 'idle', accumulatedMs: 'NaN', startedAtMs: null }),
    );
    expect(readPersistedState()).toBeNull();
  });

  it('falls back to null when startedAtMs is neither null nor a finite number', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ phase: 'running', accumulatedMs: 0, startedAtMs: 'not-a-number' }),
    );
    expect(readPersistedState()).toBeNull();
  });

  it('persistState does not throw when localStorage.setItem throws (quota exceeded)', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() =>
        persistState({ phase: 'idle', accumulatedMs: 0, startedAtMs: null }),
      ).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
