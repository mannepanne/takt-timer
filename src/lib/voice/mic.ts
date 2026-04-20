// ABOUT: MediaRecorder wrapper + iOS AudioSession category toggle for the voice overlay.
// ABOUT: The state machine (machine.ts) returns effects like 'startRecording' / 'setAudioCategory';
// ABOUT: this module is what the React hook calls to actually perform them.

import type { AudioCategory } from './types';

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

export function isMediaRecorderAvailable(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

export function supportedMimeTypes(): string[] {
  if (!isMediaRecorderAvailable()) return [];
  return MIME_CANDIDATES.filter((candidate) => {
    try {
      return MediaRecorder.isTypeSupported(candidate);
    } catch {
      return false;
    }
  });
}

export function preferredMimeType(): string {
  return supportedMimeTypes()[0] ?? '';
}

// iOS exposes `navigator.audioSession` as a read/write property controlling how the
// WebKit audio graph interacts with system audio. Phase 2 keeps it on 'ambient' so Spotify
// etc. keep playing; getUserMedia requires 'play-and-record'. This helper writes the
// category, swallowing errors on platforms that don't support the API.
type NavAudioSession = { type: AudioCategory | 'playback' | 'auto' };

export function setAudioCategory(category: AudioCategory): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as Navigator & { audioSession?: NavAudioSession };
  if (!nav.audioSession) return;
  try {
    nav.audioSession.type = category;
  } catch {
    // Non-fatal — some platforms ignore the assignment.
  }
}

export type RecorderHandle = {
  stop(): void;
  discard(): void;
};

export type RecorderCallbacks = {
  onStop(blob: Blob): void;
  onError(err: Error): void;
};

export type RecorderOptions = {
  mimeType?: string;
};

/**
 * Requests mic permission and constructs a MediaRecorder. Returns a handle with
 * `stop()` and `discard()` methods. The caller receives the recorded blob via
 * `callbacks.onStop` when recording ends (either via `stop()` or the browser's own
 * internal events). Throws synchronously on programmer errors (unsupported browser).
 */
export async function startRecording(
  callbacks: RecorderCallbacks,
  options: RecorderOptions = {},
): Promise<RecorderHandle> {
  if (!isMediaRecorderAvailable()) {
    throw new Error('MediaRecorder API not available in this browser');
  }
  const mimeType = options.mimeType ?? preferredMimeType();
  if (!mimeType) {
    throw new Error('No supported MediaRecorder MIME type found');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: BlobPart[] = [];

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch (err) {
    // Permission may have been granted but the MIME was rejected; free the mic before throwing.
    stream.getTracks().forEach((t) => t.stop());
    throw err instanceof Error ? err : new Error(String(err));
  }

  let discarded = false;

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = (event) => {
    const err = (event as unknown as { error?: Error }).error;
    callbacks.onError(err ?? new Error('MediaRecorder error'));
  };
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    if (discarded) return;
    const blob = new Blob(chunks, { type: mimeType });
    callbacks.onStop(blob);
  };

  recorder.start();

  return {
    stop() {
      if (recorder.state !== 'inactive') recorder.stop();
    },
    discard() {
      discarded = true;
      if (recorder.state !== 'inactive') recorder.stop();
    },
  };
}

export type PermissionOutcome = 'granted' | 'denied' | 'unavailable';

/**
 * Probe whether the mic permission has been granted without prompting. Uses the Permissions
 * API where available; returns 'unavailable' elsewhere. Most browsers still prompt on the
 * first actual getUserMedia call regardless.
 */
export async function queryMicPermission(): Promise<PermissionOutcome> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unavailable';
  }
  try {
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    if (status.state === 'granted') return 'granted';
    if (status.state === 'denied') return 'denied';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}
