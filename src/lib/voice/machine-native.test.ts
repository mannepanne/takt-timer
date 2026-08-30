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

  it('a confident transcript navigates to Configure with the exact parsed session + transcript', () => {
    const { next, effects } = step(listening, {
      type: 'transcript',
      text: 'three sets of one minute, thirty seconds rest',
    });
    expect(next).toEqual({ phase: 'idle' });
    expect(effects).toEqual([
      {
        type: 'navigateToConfigure',
        session: { sets: 3, workSec: 60, restSec: 30 },
        transcript: 'three sets of one minute, thirty seconds rest',
      },
    ]);
  });

  it('carries the trimmed transcript, not the raw padded text', () => {
    const { effects } = step(listening, {
      type: 'transcript',
      text: '  three sets of one minute, thirty seconds rest  ',
    });
    expect(effects[0]).toMatchObject({
      type: 'navigateToConfigure',
      transcript: 'three sets of one minute, thirty seconds rest',
    });
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

  it('a clean transcript that omits rest defaults it to 60s and navigates to Configure', () => {
    // Rest is the one field with a natural default (ADR 2026-07-26 addendum) — a clean "sets + work"
    // phrase that just omits rest is completed, not rejected. The default is editable on Configure.
    const { next, effects } = step(listening, {
      type: 'transcript',
      text: 'three sets of one minute',
    });
    expect(next).toEqual({ phase: 'idle' });
    expect(effects).toEqual([
      {
        type: 'navigateToConfigure',
        session: { sets: 3, workSec: 60, restSec: 60 },
        transcript: 'three sets of one minute',
      },
    ]);
  });

  it('a half-understood transcript (dangling duration) still falls back rather than guessing', () => {
    // "one minute thirty seconds" without "and" leaves 30s unplaced — the phrase wasn't fully
    // understood, so no rest default; fall back rather than ship a confident-wrong pre-fill.
    const { next } = step(listening, {
      type: 'transcript',
      text: 'three sets of one minute thirty seconds',
    });
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

  it('a recognition error falls back as recognition-failed (neutral — retryable)', () => {
    const { next } = step(listening, { type: 'recognitionError' });
    expect(next).toEqual({ phase: 'parse-error', reason: 'recognition-failed' });
  });

  it('an OFFLINE recognition error routes to the offline sheet (retry would fail here)', () => {
    const { next } = step(listening, { type: 'recognitionError', offline: true });
    expect(next).toEqual({ phase: 'offline' });
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

  it('retry/cancel from any error sheet (incl. offline) returns to idle', () => {
    const states: VoiceState[] = [
      { phase: 'parse-error', reason: 'not-a-session' },
      { phase: 'permission-denied' },
      { phase: 'browser-unsupported' },
      { phase: 'offline' },
    ];
    for (const state of states) {
      expect(step(state, { type: 'retry' }).next).toEqual({ phase: 'idle' });
      expect(step(state, { type: 'cancel' }).next).toEqual({ phase: 'idle' });
    }
  });

  it('ignores events that do not apply to the current phase', () => {
    expect(step(initial(), { type: 'transcript', text: 'x' }).next).toEqual({ phase: 'idle' });
    expect(step(listening, { type: 'micTap' }).next).toEqual(listening);
  });
});
