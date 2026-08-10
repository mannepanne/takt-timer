// ABOUT: Native voice overlay reducer — pure, deterministic. Maps the on-device capture flow
// ABOUT: (availability → permission → recognise → parse) onto the shared VoiceState vocabulary so
// ABOUT: VoiceOverlay renders it unchanged. The parser decides ok-vs-fallback; this never guesses.

import { parseIntent } from '@/lib/voice-local/parser';

import type { ParsedSession, VoiceState } from './types';

// Native effects are distinct from the web machine's (no MediaRecorder, no HTTP). The host hook
// runs these against recognizer.ts.
export type NativeEffect =
  | { type: 'startCapture' } // availability → permission → recognise, dispatched back as events
  | { type: 'stopRecognition' } // user cancelled / stopped mid-listen
  | { type: 'navigateToConfigure'; session: ParsedSession; transcript: string }
  | { type: 'openAppSettings' };

export type NativeVoiceEvent =
  | { type: 'micTap' }
  | { type: 'unavailable' } // no recogniser / language pack
  | { type: 'permissionDenied' } // RECORD_AUDIO denied (re-askable or permanent — overlay offers both)
  | { type: 'listeningBegan'; now: number }
  | { type: 'transcript'; text: string | null } // recogniser returned (null = nothing heard)
  | { type: 'recognitionError'; offline?: boolean } // the plugin threw mid-capture (offline = no network)
  | { type: 'openSettings' } // user tapped "Open settings" on the permission sheet
  | { type: 'cancel' }
  | { type: 'retry' };

export type NativeStepResult = { next: VoiceState; effects: NativeEffect[] };

export function initial(): VoiceState {
  return { phase: 'idle' };
}

// Both fallbacks land on the overlay's 'parse-error' sheet (which offers "Configure manually" +
// "Try again") — never a silent guess. They differ only in copy, and the distinction is a UX
// honesty one:
// - notASession: we HEARD words but couldn't parse a session — show the transcript, "that didn't
//   sound like a session" is accurate.
// - recognitionFailed: the recogniser threw or heard nothing — a neutral "voice didn't work",
//   because blaming the user's phrasing would be wrong when the cause is offline / no language pack.
function notASession(transcript: string): VoiceState {
  return { phase: 'parse-error', reason: 'not-a-session', transcript };
}
function recognitionFailed(): VoiceState {
  return { phase: 'parse-error', reason: 'recognition-failed' };
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
        if (!text) return { next: recognitionFailed(), effects: [] }; // nothing heard
        const result = parseIntent(text);
        if (result.ok) {
          // Carry the heard transcript through so Configure can surface a "Heard: …" hint —
          // the confident-but-misheard parse (e.g. "fifty" for "fifteen") is the one gap the
          // parser can't catch, so the user needs a glimpse of what was heard to sanity-check.
          return {
            next: { phase: 'idle' },
            effects: [{ type: 'navigateToConfigure', session: result.session, transcript: text }],
          };
        }
        return { next: notASession(text), effects: [] }; // heard words, no session
      }
      if (event.type === 'recognitionError') {
        // Offline (no on-device recogniser + no network) → the offline sheet, which says "you're
        // offline, Configure manually" instead of inviting a retry that can't succeed here.
        if (event.offline) return { next: { phase: 'offline' }, effects: [] };
        return { next: recognitionFailed(), effects: [] };
      }
      if (event.type === 'cancel') {
        return { next: { phase: 'idle' }, effects: [{ type: 'stopRecognition' }] };
      }
      return { next: state, effects: [] };

    case 'parse-error':
    case 'permission-denied':
    case 'browser-unsupported':
    case 'offline':
      if (event.type === 'openSettings') {
        return { next: state, effects: [{ type: 'openAppSettings' }] };
      }
      if (event.type === 'cancel' || event.type === 'retry') {
        return { next: { phase: 'idle' }, effects: [] };
      }
      return { next: state, effects: [] };

    // States the native flow never enters (web-only: uploading/transcribing/parsing/rate-limited/
    // language-mismatch). Kept exhaustive so a future VoiceState addition is a compile error.
    case 'uploading':
    case 'transcribing':
    case 'parsing':
    case 'rate-limited':
    case 'language-mismatch':
      return { next: state, effects: [] };
  }
}
