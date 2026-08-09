// ABOUT: Voice overlay state machine — type definitions.
// ABOUT: States, events, effects. Mirrors src/lib/timer/types.ts per the reducer-plus-effects ADR.

export type ParsedSession = { sets: number; workSec: number; restSec: number };

export type ErrorReason =
  | 'upload-empty'
  | 'upload-too-large'
  | 'origin-not-allowed'
  | 'empty-transcript'
  | 'language-unsupported'
  | 'whisper-error'
  | 'llama-error'
  | 'not-a-session'
  | 'recognition-failed' // native (07f): recogniser threw or heard nothing — a neutral "voice
  // didn't work" rather than "not-a-session", which would wrongly blame the user for a failure
  // that may be offline / no language pack.
  | 'schema-failed'
  | 'method-not-allowed'
  | 'rate-limited'
  | 'network-error'
  | 'malformed-stream'
  | 'cold-start-timeout';

export type VoiceState =
  | { phase: 'idle' }
  | { phase: 'requesting-permission' }
  | { phase: 'listening'; startedAtMs: number }
  | { phase: 'uploading'; blob: Blob }
  | { phase: 'transcribing' }
  | { phase: 'parsing'; transcript: string; language?: string }
  | { phase: 'rate-limited'; retryAfterSec: number }
  | { phase: 'language-mismatch'; detected: string; transcript?: string }
  | { phase: 'parse-error'; reason: ErrorReason; transcript?: string }
  | { phase: 'offline' }
  | { phase: 'permission-denied' }
  | { phase: 'browser-unsupported' };

export type VoiceEvent =
  | { type: 'micTap'; online: boolean; supported: boolean }
  | { type: 'permissionGranted'; now: number }
  | { type: 'permissionDenied' }
  | { type: 'hardwareUnavailable' }
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
// iOS audioSession toggling lives here — the timer keeps the category on 'ambient' so
// background music coexists; mic capture requires 'play-and-record'. The machine flips
// the category on every overlay entry/exit.
export type AudioCategory = 'ambient' | 'play-and-record';

export type Effect =
  | { type: 'setAudioCategory'; category: AudioCategory }
  | { type: 'requestMic' }
  | { type: 'stopRecording' }
  | { type: 'discardBlob' }
  | { type: 'schedule8sCap' }
  | { type: 'cancel8sCap' }
  | { type: 'postVoice'; blob: Blob }
  | { type: 'cancelPost' }
  | { type: 'showRetryToast' }
  | { type: 'navigateToConfigure'; session: ParsedSession };

export type StepResult = { next: VoiceState; effects: Effect[] };
