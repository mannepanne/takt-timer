// ABOUT: Tests for the native voice reducer — the transcript → session routing and every
// ABOUT: fallback path. This is the risk surface 07f is team-reviewed for: a confident wrong
// ABOUT: parse must never navigate; only an exact parse does.

import { describe, expect, it } from 'vitest';

import { initial, step } from './machine-native';
import type { VoiceState } from './types';

const listening: VoiceState = { phase: 'listening', startedAtMs: 0 };

describe('machine-native', () => {
  it('starts idle', () => {
    expect(initial()).toEqual({ phase: 'idle' });
  });

  it('micTap begins the capture flow', () => {
    const { next, effects } = step(initial(), { type: 'micTap' });
    expect(next).toEqual({ phase: 'requesting-permission' });
    expect(effects).toEqual([{ type: 'startCapture' }]);
  });

  it('unavailable recogniser routes to the unsupported sheet (→ manual)', () => {
    const { next } = step({ phase: 'requesting-permission' }, { type: 'unavailable' });
    expect(next).toEqual({ phase: 'browser-unsupported' });
  });

  it('denied permission routes to the permission-denied sheet', () => {
    const { next } = step({ phase: 'requesting-permission' }, { type: 'permissionDenied' });
    expect(next).toEqual({ phase: 'permission-denied' });
  });

  it('listeningBegan moves to the listening affordance', () => {
    const { next } = step({ phase: 'requesting-permission' }, { type: 'listeningBegan', now: 123 });
    expect(next).toEqual({ phase: 'listening', startedAtMs: 123 });
  });

  it('a confident transcript navigates to Configure with the exact parsed session', () => {
    const { next, effects } = step(listening, {
      type: 'transcript',
      text: 'three sets of one minute, thirty seconds rest',
    });
    expect(next).toEqual({ phase: 'idle' });
    expect(effects).toEqual([
      { type: 'navigateToConfigure', session: { sets: 3, workSec: 60, restSec: 30 } },
    ]);
  });

  it('an unparseable transcript falls back to manual (never guesses), keeping the transcript', () => {
    const { next, effects } = step(listening, { type: 'transcript', text: 'hello there friend' });
    expect(next).toEqual({
      phase: 'parse-error',
      reason: 'not-a-session',
      transcript: 'hello there friend',
    });
    expect(effects).toEqual([]);
  });

  it('a partial transcript (missing rest) falls back rather than defaulting the missing field', () => {
    // The rejected prototype defaulted missing fields; this must not — a confident-looking wrong
    // pre-fill on the Configure screen gets tapped through.
    const { next } = step(listening, { type: 'transcript', text: 'three sets of one minute' });
    expect(next.phase).toBe('parse-error');
  });

  it('a null transcript (nothing heard) falls back as recognition-failed, not blaming the user', () => {
    const { next } = step(listening, { type: 'transcript', text: null });
    expect(next).toEqual({ phase: 'parse-error', reason: 'recognition-failed' });
  });

  it('a whitespace-only transcript falls back as recognition-failed', () => {
    const { next } = step(listening, { type: 'transcript', text: '   ' });
    expect(next).toEqual({ phase: 'parse-error', reason: 'recognition-failed' });
  });

  it('a recognition error falls back as recognition-failed (neutral — may be offline/no pack)', () => {
    const { next } = step(listening, { type: 'recognitionError' });
    expect(next).toEqual({ phase: 'parse-error', reason: 'recognition-failed' });
  });

  it('cancelling while listening stops the recogniser and returns to idle', () => {
    const { next, effects } = step(listening, { type: 'cancel' });
    expect(next).toEqual({ phase: 'idle' });
    expect(effects).toEqual([{ type: 'stopRecognition' }]);
  });

  it('cancelling during permission request stops the flow', () => {
    const { next, effects } = step({ phase: 'requesting-permission' }, { type: 'cancel' });
    expect(next).toEqual({ phase: 'idle' });
    expect(effects).toEqual([{ type: 'stopRecognition' }]);
  });

  it('openSettings deep-links from the permission sheet without leaving it', () => {
    const { next, effects } = step({ phase: 'permission-denied' }, { type: 'openSettings' });
    expect(next).toEqual({ phase: 'permission-denied' });
    expect(effects).toEqual([{ type: 'openAppSettings' }]);
  });

  it('retry from an error sheet returns to idle', () => {
    for (const phase of ['parse-error', 'permission-denied', 'browser-unsupported'] as const) {
      const state = { phase, reason: 'not-a-session' } as VoiceState;
      expect(step(state, { type: 'retry' }).next).toEqual({ phase: 'idle' });
    }
  });

  it('ignores events that do not apply to the current phase', () => {
    expect(step(initial(), { type: 'transcript', text: 'x' }).next).toEqual({ phase: 'idle' });
    expect(step(listening, { type: 'micTap' }).next).toEqual(listening);
  });
});
