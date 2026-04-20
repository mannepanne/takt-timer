// ABOUT: Voice overlay state machine reducer — pure, deterministic, test-friendly.
// ABOUT: Maps (VoiceState, VoiceEvent) → { next state, side-effects to run }.
// ABOUT: See src/lib/voice/types.ts for the state/event/effect shape, and the ADR
// ABOUT: 2026-04-19-reducer-plus-effects-pattern for the pattern this follows.

import type { Effect, StepResult, VoiceEvent, VoiceState } from './types';

export function initial(): VoiceState {
  return { phase: 'idle' };
}

function restoreAmbient(): Effect[] {
  return [{ type: 'setAudioCategory', category: 'ambient' }];
}

function stopAndRestore(): Effect[] {
  return [
    { type: 'stopRecording' },
    { type: 'cancel8sCap' },
    { type: 'discardBlob' },
    ...restoreAmbient(),
  ];
}

function cancelFromInFlight(): Effect[] {
  return [{ type: 'cancelPost' }, ...restoreAmbient()];
}

export function step(state: VoiceState, event: VoiceEvent): StepResult {
  switch (state.phase) {
    case 'idle':
      if (event.type === 'micTap') {
        if (!event.supported) return { next: { phase: 'browser-unsupported' }, effects: [] };
        if (!event.online) return { next: { phase: 'offline' }, effects: [] };
        return {
          next: { phase: 'requesting-permission' },
          effects: [
            { type: 'setAudioCategory', category: 'play-and-record' },
            { type: 'requestMic' },
          ],
        };
      }
      return { next: state, effects: [] };

    case 'requesting-permission':
      if (event.type === 'permissionGranted') {
        return {
          next: { phase: 'listening', startedAtMs: event.now },
          effects: [{ type: 'startRecording' }, { type: 'schedule8sCap' }],
        };
      }
      if (event.type === 'permissionDenied') {
        return { next: { phase: 'permission-denied' }, effects: restoreAmbient() };
      }
      if (event.type === 'cancel') {
        return { next: { phase: 'idle' }, effects: restoreAmbient() };
      }
      return { next: state, effects: [] };

    case 'listening':
      if (event.type === 'recordingStopped' || event.type === 'recordingCap') {
        return {
          next: { phase: 'uploading', blob: event.blob },
          effects: [{ type: 'cancel8sCap' }],
        };
      }
      if (event.type === 'cancel') {
        return { next: { phase: 'idle' }, effects: stopAndRestore() };
      }
      return { next: state, effects: [] };

    case 'uploading':
      if (event.type === 'blobEmpty') {
        return {
          next: { phase: 'idle' },
          effects: [{ type: 'showRetryToast' }, ...restoreAmbient()],
        };
      }
      if (event.type === 'uploadBegun') {
        return {
          next: { phase: 'transcribing' },
          effects: [{ type: 'postVoice', blob: state.blob }],
        };
      }
      if (event.type === 'cancel') {
        return { next: { phase: 'idle' }, effects: [{ type: 'discardBlob' }, ...restoreAmbient()] };
      }
      return { next: state, effects: [] };

    case 'transcribing':
      if (event.type === 'transcriptArrived') {
        return {
          next: { phase: 'parsing', transcript: event.transcript, language: event.language },
          effects: [],
        };
      }
      if (event.type === 'errorArrived') {
        return resolveErrorFromStream(event, undefined);
      }
      if (event.type === 'cancel') {
        return { next: { phase: 'idle' }, effects: cancelFromInFlight() };
      }
      return { next: state, effects: [] };

    case 'parsing':
      if (event.type === 'sessionArrived') {
        return {
          next: { phase: 'idle' },
          effects: [{ type: 'navigateToConfigure', session: event.session }, ...restoreAmbient()],
        };
      }
      if (event.type === 'errorArrived') {
        return resolveErrorFromStream(event, state.transcript);
      }
      if (event.type === 'cancel') {
        return { next: { phase: 'idle' }, effects: cancelFromInFlight() };
      }
      return { next: state, effects: [] };

    case 'rate-limited':
    case 'language-mismatch':
    case 'parse-error':
    case 'offline':
    case 'permission-denied':
    case 'browser-unsupported':
      if (event.type === 'cancel' || event.type === 'retry') {
        return { next: { phase: 'idle' }, effects: [] };
      }
      return { next: state, effects: [] };
  }
}

function resolveErrorFromStream(
  event: Extract<VoiceEvent, { type: 'errorArrived' }>,
  transcript: string | undefined,
): StepResult {
  if (event.reason === 'rate-limited') {
    return {
      next: { phase: 'rate-limited', retryAfterSec: event.retryAfterSec ?? 0 },
      effects: restoreAmbient(),
    };
  }
  if (event.reason === 'language-unsupported') {
    return {
      next: { phase: 'language-mismatch', detected: event.detectedLanguage ?? '' },
      effects: restoreAmbient(),
    };
  }
  return {
    next: { phase: 'parse-error', reason: event.reason, transcript },
    effects: restoreAmbient(),
  };
}
