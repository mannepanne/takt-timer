import { describe, expect, it } from 'vitest';

import { initial, step } from './machine';
import type { Effect, ParsedSession, VoiceEvent, VoiceState } from './types';

function expectEffects(effects: Effect[], ...types: Array<Effect['type']>) {
  expect(effects.map((e) => e.type)).toEqual(types);
}

const SAMPLE_SESSION: ParsedSession = { sets: 3, workSec: 60, restSec: 30 };
const SAMPLE_BLOB = new Blob(['audio-bytes'], { type: 'audio/webm' });

describe('voice machine', () => {
  it('starts in idle', () => {
    expect(initial()).toEqual({ phase: 'idle' });
  });

  describe('from idle', () => {
    it('micTap → requesting-permission when online and supported', () => {
      const { next, effects } = step(initial(), {
        type: 'micTap',
        online: true,
        supported: true,
      });
      expect(next).toEqual({ phase: 'requesting-permission' });
      expectEffects(effects, 'setAudioCategory', 'requestMic');
      expect(effects[0]).toEqual({ type: 'setAudioCategory', category: 'play-and-record' });
    });

    it('micTap → offline when navigator reports offline', () => {
      const { next, effects } = step(initial(), {
        type: 'micTap',
        online: false,
        supported: true,
      });
      expect(next).toEqual({ phase: 'offline' });
      expect(effects).toEqual([]);
    });

    it('micTap → browser-unsupported when MediaRecorder is absent', () => {
      const { next, effects } = step(initial(), {
        type: 'micTap',
        online: true,
        supported: false,
      });
      expect(next).toEqual({ phase: 'browser-unsupported' });
      expect(effects).toEqual([]);
    });

    it('ignores unrelated events', () => {
      const { next, effects } = step(initial(), { type: 'cancel' });
      expect(next).toEqual({ phase: 'idle' });
      expect(effects).toEqual([]);
    });
  });

  describe('from requesting-permission', () => {
    const state: VoiceState = { phase: 'requesting-permission' };

    it('permissionGranted → listening, starts recording and schedules cap', () => {
      const { next, effects } = step(state, { type: 'permissionGranted', now: 1000 });
      expect(next).toEqual({ phase: 'listening', startedAtMs: 1000 });
      expectEffects(effects, 'startRecording', 'schedule8sCap');
    });

    it('permissionDenied → permission-denied, restores ambient audio', () => {
      const { next, effects } = step(state, { type: 'permissionDenied' });
      expect(next).toEqual({ phase: 'permission-denied' });
      expectEffects(effects, 'setAudioCategory');
      expect(effects[0]).toEqual({ type: 'setAudioCategory', category: 'ambient' });
    });

    it('cancel → idle, restores ambient', () => {
      const { next, effects } = step(state, { type: 'cancel' });
      expect(next).toEqual({ phase: 'idle' });
      expectEffects(effects, 'setAudioCategory');
    });

    it('hardwareUnavailable → browser-unsupported, restores ambient', () => {
      // Hardware missing / busy / unsupported MIME / constraint reject — the user
      // can't fix this from browser settings, so the sheet shows unsupported copy.
      const { next, effects } = step(state, { type: 'hardwareUnavailable' });
      expect(next).toEqual({ phase: 'browser-unsupported' });
      expectEffects(effects, 'setAudioCategory');
    });
  });

  describe('from listening', () => {
    const state: VoiceState = { phase: 'listening', startedAtMs: 0 };

    it('recordingStopped (user tap) → uploading, cancels cap', () => {
      const { next, effects } = step(state, { type: 'recordingStopped', blob: SAMPLE_BLOB });
      expect(next).toEqual({ phase: 'uploading', blob: SAMPLE_BLOB });
      expectEffects(effects, 'cancel8sCap');
    });

    it('recordingCap (8s timer) → uploading', () => {
      const { next, effects } = step(state, { type: 'recordingCap', blob: SAMPLE_BLOB });
      expect(next).toEqual({ phase: 'uploading', blob: SAMPLE_BLOB });
      expectEffects(effects, 'cancel8sCap');
    });

    it('cancel → idle, stops recording, cancels cap, discards blob, restores ambient', () => {
      const { next, effects } = step(state, { type: 'cancel' });
      expect(next).toEqual({ phase: 'idle' });
      expectEffects(effects, 'stopRecording', 'cancel8sCap', 'discardBlob', 'setAudioCategory');
    });
  });

  describe('from uploading', () => {
    const state: VoiceState = { phase: 'uploading', blob: SAMPLE_BLOB };

    it('blobEmpty (iOS first-grab) → idle, shows retry toast, restores ambient, no quota charge', () => {
      const { next, effects } = step(state, { type: 'blobEmpty' });
      expect(next).toEqual({ phase: 'idle' });
      expectEffects(effects, 'showRetryToast', 'setAudioCategory');
    });

    it('uploadBegun → transcribing, posts the blob', () => {
      const { next, effects } = step(state, { type: 'uploadBegun' });
      expect(next).toEqual({ phase: 'transcribing' });
      expect(effects).toEqual([{ type: 'postVoice', blob: SAMPLE_BLOB }]);
    });

    it('cancel → idle, discards blob and restores ambient', () => {
      const { next, effects } = step(state, { type: 'cancel' });
      expect(next).toEqual({ phase: 'idle' });
      expectEffects(effects, 'discardBlob', 'setAudioCategory');
    });
  });

  describe('from transcribing', () => {
    const state: VoiceState = { phase: 'transcribing' };

    it('transcriptArrived → parsing with transcript + language', () => {
      const { next, effects } = step(state, {
        type: 'transcriptArrived',
        transcript: 'three sets of one minute',
        language: 'en',
      });
      expect(next).toEqual({
        phase: 'parsing',
        transcript: 'three sets of one minute',
        language: 'en',
      });
      expect(effects).toEqual([]);
    });

    it('transcriptArrived with language omitted → parsing with language undefined (pass-through policy)', () => {
      // ADR 2026-04-20 Option C: when Whisper returns no language, pass through to Llama
      // rather than rejecting. The machine preserves undefined so the UI can log or surface it.
      const { next } = step(state, { type: 'transcriptArrived', transcript: 'some audio' });
      expect(next).toEqual({ phase: 'parsing', transcript: 'some audio', language: undefined });
    });

    it('errorArrived(empty-transcript) → parse-error (Whisper returned no text)', () => {
      const { next } = step(state, { type: 'errorArrived', reason: 'empty-transcript' });
      expect(next).toEqual({
        phase: 'parse-error',
        reason: 'empty-transcript',
        transcript: undefined,
      });
    });

    it('errorArrived(rate-limited) without retryAfterSec defaults to 0 (intentional fallback)', () => {
      // Server contract requires retryAfterSec on rate-limited per ADR 2026-04-20. If it's
      // missing we default to 0 rather than throwing — visible as "0 seconds" in the UI, which
      // is an honest signal that the server response was malformed rather than a silent crash.
      const { next } = step(state, { type: 'errorArrived', reason: 'rate-limited' });
      expect(next).toEqual({ phase: 'rate-limited', retryAfterSec: 0 });
    });

    it('errorArrived(language-unsupported) without detectedLanguage defaults to empty string', () => {
      // Same fallback shape as retryAfterSec above — an empty detected tag is an honest signal
      // that the server omitted the field, not a silent crash.
      const { next } = step(state, { type: 'errorArrived', reason: 'language-unsupported' });
      expect(next).toEqual({ phase: 'language-mismatch', detected: '' });
    });

    it('errorArrived(whisper-error) → parse-error', () => {
      const { next, effects } = step(state, { type: 'errorArrived', reason: 'whisper-error' });
      expect(next).toEqual({
        phase: 'parse-error',
        reason: 'whisper-error',
        transcript: undefined,
      });
      expectEffects(effects, 'setAudioCategory');
    });

    it('errorArrived(rate-limited) → rate-limited with retryAfterSec', () => {
      const { next } = step(state, {
        type: 'errorArrived',
        reason: 'rate-limited',
        retryAfterSec: 3600,
      });
      expect(next).toEqual({ phase: 'rate-limited', retryAfterSec: 3600 });
    });

    it('errorArrived(language-unsupported) → language-mismatch with detected tag', () => {
      const { next } = step(state, {
        type: 'errorArrived',
        reason: 'language-unsupported',
        detectedLanguage: 'fr',
      });
      expect(next).toEqual({ phase: 'language-mismatch', detected: 'fr' });
    });

    it('cancel → idle, cancels the in-flight POST and restores ambient', () => {
      const { next, effects } = step(state, { type: 'cancel' });
      expect(next).toEqual({ phase: 'idle' });
      expectEffects(effects, 'cancelPost', 'setAudioCategory');
    });
  });

  describe('from parsing', () => {
    const state: VoiceState = {
      phase: 'parsing',
      transcript: 'three sets of one minute',
      language: 'en',
    };

    it('sessionArrived → idle, navigates to /configure with session', () => {
      const { next, effects } = step(state, { type: 'sessionArrived', session: SAMPLE_SESSION });
      expect(next).toEqual({ phase: 'idle' });
      expect(effects[0]).toEqual({ type: 'navigateToConfigure', session: SAMPLE_SESSION });
      expectEffects(effects, 'navigateToConfigure', 'setAudioCategory');
    });

    it('errorArrived(not-a-session) → parse-error, transcript preserved', () => {
      const { next } = step(state, { type: 'errorArrived', reason: 'not-a-session' });
      expect(next).toEqual({
        phase: 'parse-error',
        reason: 'not-a-session',
        transcript: 'three sets of one minute',
      });
    });

    it('errorArrived(schema-failed) → parse-error, transcript preserved', () => {
      const { next } = step(state, { type: 'errorArrived', reason: 'schema-failed' });
      expect(next).toEqual({
        phase: 'parse-error',
        reason: 'schema-failed',
        transcript: 'three sets of one minute',
      });
    });

    it('cancel → idle, cancels POST and restores ambient', () => {
      const { next, effects } = step(state, { type: 'cancel' });
      expect(next).toEqual({ phase: 'idle' });
      expectEffects(effects, 'cancelPost', 'setAudioCategory');
    });
  });

  describe('from terminal states', () => {
    const terminalStates: VoiceState[] = [
      { phase: 'rate-limited', retryAfterSec: 3600 },
      { phase: 'language-mismatch', detected: 'fr' },
      { phase: 'parse-error', reason: 'not-a-session' },
      { phase: 'offline' },
      { phase: 'permission-denied' },
      { phase: 'browser-unsupported' },
    ];

    it.each(terminalStates)('$phase: cancel → idle', (s) => {
      const { next, effects } = step(s, { type: 'cancel' });
      expect(next).toEqual({ phase: 'idle' });
      expect(effects).toEqual([]);
    });

    it.each(terminalStates)('$phase: retry → idle', (s) => {
      const { next, effects } = step(s, { type: 'retry' });
      expect(next).toEqual({ phase: 'idle' });
      expect(effects).toEqual([]);
    });

    it('ignores unrelated events', () => {
      const s: VoiceState = { phase: 'parse-error', reason: 'not-a-session' };
      const result = step(s, { type: 'sessionArrived', session: SAMPLE_SESSION });
      expect(result.next).toEqual(s);
      expect(result.effects).toEqual([]);
    });
  });

  describe("ignored events (invariant — unhandled events don't mutate state)", () => {
    const invariantCases: Array<{ state: VoiceState; event: VoiceEvent }> = [
      { state: { phase: 'idle' }, event: { type: 'permissionGranted', now: 0 } },
      {
        state: { phase: 'requesting-permission' },
        event: { type: 'recordingStopped', blob: SAMPLE_BLOB },
      },
      {
        state: { phase: 'listening', startedAtMs: 0 },
        event: { type: 'sessionArrived', session: SAMPLE_SESSION },
      },
      {
        state: { phase: 'uploading', blob: SAMPLE_BLOB },
        event: { type: 'transcriptArrived', transcript: 'x' },
      },
      {
        state: { phase: 'transcribing' },
        event: { type: 'permissionGranted', now: 0 },
      },
    ];

    it.each(invariantCases)('$state.phase ignores $event.type', ({ state, event }) => {
      const result = step(state, event);
      expect(result.next).toEqual(state);
      expect(result.effects).toEqual([]);
    });
  });

  describe('full happy path', () => {
    it('idle → requesting-permission → listening → uploading → transcribing → parsing → idle (navigated)', () => {
      let s = initial();
      let r = step(s, { type: 'micTap', online: true, supported: true });
      expect(r.next.phase).toBe('requesting-permission');
      s = r.next;

      r = step(s, { type: 'permissionGranted', now: 100 });
      expect(r.next.phase).toBe('listening');
      s = r.next;

      r = step(s, { type: 'recordingStopped', blob: SAMPLE_BLOB });
      expect(r.next.phase).toBe('uploading');
      s = r.next;

      r = step(s, { type: 'uploadBegun' });
      expect(r.next.phase).toBe('transcribing');
      s = r.next;

      r = step(s, { type: 'transcriptArrived', transcript: 'three sets', language: 'en' });
      expect(r.next.phase).toBe('parsing');
      s = r.next;

      r = step(s, { type: 'sessionArrived', session: SAMPLE_SESSION });
      expect(r.next.phase).toBe('idle');
      const effectTypes = r.effects.map((e) => e.type);
      expect(effectTypes).toContain('navigateToConfigure');
    });
  });
});
