// ABOUT: Thin wrapper over the native speech-recognition plugin — availability, RECORD_AUDIO
// ABOUT: permission, one-shot capture+transcription, and the app-settings deep link. Deliberately
// ABOUT: kept thin: the risky logic (transcript → session) lives in the pure parser, not here.

import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { NativeSettings, AndroidSettings } from 'capacitor-native-settings';

// 'permanently-denied' is the "don't ask again" state: requestPermissions() won't re-prompt, so
// the only recovery is the app's system settings page (openAppSettings below).
export type PermissionOutcome = 'granted' | 'denied' | 'permanently-denied';

/** True when the device has a usable speech recogniser (language pack present, service reachable). */
export async function isRecognitionAvailable(): Promise<boolean> {
  try {
    const { available } = await SpeechRecognition.available();
    return available;
  } catch {
    // A throwing availability check means the recogniser can't be reached — treat as unavailable
    // so the caller falls back to manual entry rather than crashing.
    return false;
  }
}

/**
 * Ensures RECORD_AUDIO is granted, re-prompting once if it's re-askable.
 * A pre-existing 'denied' (before we ask) is Android's permanent "don't ask again" — route to
 * settings rather than firing a request that silently no-ops.
 */
export async function ensurePermission(): Promise<PermissionOutcome> {
  const check = await SpeechRecognition.checkPermissions();
  if (check.speechRecognition === 'granted') return 'granted';
  if (check.speechRecognition === 'denied') return 'permanently-denied';
  const req = await SpeechRecognition.requestPermissions();
  if (req.speechRecognition === 'granted') return 'granted';
  return 'denied';
}

/**
 * Captures one utterance and returns the best transcript, or null if nothing usable was heard.
 * Single-shot (no partialResults, no system popup): start() resolves with the final matches once
 * the user stops speaking or stopRecognition() is called.
 */
export async function recognizeOnce(language = 'en-US'): Promise<string | null> {
  const { matches } = await SpeechRecognition.start({
    language,
    maxResults: 1,
    partialResults: false,
    popup: false,
  });
  const transcript = matches?.[0]?.trim();
  return transcript ? transcript : null;
}

/** Stops an in-flight recognition; the pending recognizeOnce() resolves with what was heard so far. */
export async function stopRecognition(): Promise<void> {
  try {
    await SpeechRecognition.stop();
  } catch {
    // Best-effort — stopping a recogniser that already stopped is not an error worth surfacing.
  }
}

/** Deep-links to the app's Android settings page so the user can re-enable a permanently-denied mic. */
export async function openAppSettings(): Promise<void> {
  await NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails });
}
