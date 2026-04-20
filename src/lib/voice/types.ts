// ABOUT: Voice overlay state machine — type definitions.
// ABOUT: States, events, effects. Mirrors src/lib/timer/types.ts per the reducer-plus-effects ADR.

export type ParsedSession = { sets: number; workSec: number; restSec: number };

export type SupportedLanguage = 'en' | 'sv' | 'is' | 'no' | 'nn' | 'nb' | 'da';

export type ErrorReason =
  | 'upload-empty'
  | 'upload-too-large'
  | 'origin-not-allowed'
  | 'empty-transcript'
  | 'language-unsupported'
  | 'whisper-error'
  | 'llama-error'
  | 'not-a-session'
  | 'schema-failed'
  | 'method-not-allowed'
  | 'rate-limited'
  | 'network-error'
  | 'malformed-stream';

export type VoiceState =
  | { phase: 'idle' }
  | { phase: 'requesting-permission' }
  | { phase: 'listening'; startedAtMs: number }
  | { phase: 'uploading'; blob: Blob }
  | { phase: 'transcribing' }
  | { phase: 'parsing'; transcript: string; language?: string }
  | { phase: 'rate-limited'; retryAfterSec: number }
  | { phase: 'language-mismatch'; detected: string }
  | { phase: 'parse-error'; reason: ErrorReason; transcript?: string }
  | { phase: 'offline' }
  | { phase: 'permission-denied' }
  | { phase: 'browser-unsupported' };

export type VoiceEvent =
  | { type: 'micTap'; online: boolean; supported: boolean }
  | { type: 'permissionGranted'; now: number }
  | { type: 'permissionDenied' }
  | { type: 'recordingStopped'; blob: Blob }
  | { type: 'recordingCap'; blob: Blob }
  | { type: 'blobEmpty' }
  | { type: 'uploadBegun' }
  | { type: 'transcriptArrived'; transcript: string; language?: string }
  | { type: 'sessionArrived'; session: ParsedSession }
  | { type: 'errorArrived'; reason: ErrorReason; retryAfterSec?: number; detectedLanguage?: string }
  | { type: 'cancel' }
  | { type: 'retry' };

// Effects the machine asks the host (React hook, test harness) to execute.
// iOS audioSession toggling lives here — Phase 2 sets 'ambient' for music coexistence;
// capture requires 'play-and-record'. The machine flips the category on every entry/exit.
export type AudioCategory = 'ambient' | 'play-and-record';

export type Effect =
  | { type: 'setAudioCategory'; category: AudioCategory }
  | { type: 'requestMic' }
  | { type: 'startRecording' }
  | { type: 'stopRecording' }
  | { type: 'discardBlob' }
  | { type: 'schedule8sCap' }
  | { type: 'cancel8sCap' }
  | { type: 'postVoice'; blob: Blob }
  | { type: 'cancelPost' }
  | { type: 'showRetryToast' }
  | { type: 'navigateToConfigure'; session: ParsedSession };

export type StepResult = { next: VoiceState; effects: Effect[] };
