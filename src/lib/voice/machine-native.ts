// ABOUT: Native voice overlay reducer — pure, deterministic. Maps the on-device capture flow
// ABOUT: (availability → permission → recognise → parse) onto the shared VoiceState vocabulary so
// ABOUT: VoiceOverlay renders it unchanged. The parser decides ok-vs-fallback; this never guesses.

import { parseIntent } from '@/lib/voice-local/parser';

import type { VoiceState } from './types';

// Native effects are distinct from the web machine's (no MediaRecorder, no HTTP). The host hook
// runs these against recognizer.ts.
export type NativeEffect =
  | { type: 'startCapture' } // availability → permission → recognise, dispatched back as events
  | { type: 'stopRecognition' } // user cancelled / stopped mid-listen
  | { type: 'navigateToConfigure'; session: { sets: number; workSec: number; restSec: number } }
  | { type: 'openAppSettings' };

export type NativeVoiceEvent =
  | { type: 'micTap' }
  | { type: 'unavailable' } // no recogniser / language pack
  | { type: 'permissionDenied' } // RECORD_AUDIO denied (re-askable or permanent — overlay offers both)
  | { type: 'listeningBegan'; now: number }
  | { type: 'transcript'; text: string | null } // recogniser returned (null = nothing heard)
  | { type: 'recognitionError' } // the plugin threw mid-capture
  | { type: 'openSettings' } // user tapped "Open settings" on the permission sheet
  | { type: 'cancel' }
  | { type: 'retry' };

export type NativeStepResult = { next: VoiceState; effects: NativeEffect[] };

export function initial(): VoiceState {
  return { phase: 'idle' };
}

// Every failed/empty parse and every recognition error routes to the manual/Interpretation screen
// via the overlay's 'parse-error' sheet. 'not-a-session' is the closest existing copy ("that didn't
// sound like a session") and its sheet already offers "Configure manually" — never a silent guess.
function fallback(transcript?: string): VoiceState {
  return { phase: 'parse-error', reason: 'not-a-session', transcript };
}

export function step(state: VoiceState, event: NativeVoiceEvent): NativeStepResult {
  switch (state.phase) {
    case 'idle':
      if (event.type === 'micTap') {
        return { next: { phase: 'requesting-permission' }, effects: [{ type: 'startCapture' }] };
      }
      return { next: state, effects: [] };

    case 'requesting-permission':
      if (event.type === 'unavailable') {
        return { next: { phase: 'browser-unsupported' }, effects: [] };
      }
      if (event.type === 'permissionDenied') {
        return { next: { phase: 'permission-denied' }, effects: [] };
      }
      if (event.type === 'listeningBegan') {
        return { next: { phase: 'listening', startedAtMs: event.now }, effects: [] };
      }
      if (event.type === 'cancel') {
        return { next: { phase: 'idle' }, effects: [{ type: 'stopRecognition' }] };
      }
      return { next: state, effects: [] };

    case 'listening':
      if (event.type === 'transcript') {
        const text = event.text?.trim();
        if (!text) return { next: fallback(), effects: [] };
        const result = parseIntent(text);
        if (result.ok) {
          return {
            next: { phase: 'idle' },
            effects: [{ type: 'navigateToConfigure', session: result.session }],
          };
        }
        return { next: fallback(text), effects: [] };
      }
      if (event.type === 'recognitionError') {
        return { next: fallback(), effects: [] };
      }
      if (event.type === 'cancel') {
        return { next: { phase: 'idle' }, effects: [{ type: 'stopRecognition' }] };
      }
      return { next: state, effects: [] };

    case 'parse-error':
    case 'permission-denied':
    case 'browser-unsupported':
      if (event.type === 'openSettings') {
        return { next: state, effects: [{ type: 'openAppSettings' }] };
      }
      if (event.type === 'cancel' || event.type === 'retry') {
        return { next: { phase: 'idle' }, effects: [] };
      }
      return { next: state, effects: [] };

    // States the native flow never enters (web-only: uploading/transcribing/parsing/rate-limited/
    // language-mismatch/offline). Kept exhaustive so a future VoiceState addition is a compile error.
    case 'uploading':
    case 'transcribing':
    case 'parsing':
    case 'rate-limited':
    case 'language-mismatch':
    case 'offline':
      return { next: state, effects: [] };
  }
}
