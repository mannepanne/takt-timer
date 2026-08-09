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

// Android unbinds the speech service after each recognition; the plugin reuses one cached
// SpeechRecognizer and doesn't recreate it, so the FIRST start() after a completed recognition can
// lose the service connection and fail within tens of milliseconds — before the mic even opens —
// surfaced as a generic "Didn't understand". A real result or no-match only happens after seconds
// of listening, so a *fast* failure is that rebind race, not a real outcome. We retry once after a
// short settle (by which point the service has re-established), which is what makes voice usable on
// the second and subsequent taps. A slow failure (real no-match, or a network error that took a
// while) is surfaced as-is. Confirmed against on-device logcat (RemoteSpeechRecognitionService
// "Connection to speech recognition service lost" / "Service is unbinding").
const REBIND_RACE_MS = 1000;
const REBIND_RETRY_DELAY_MS = 250;

async function startOnce(language: string): Promise<string | null> {
  const { matches } = await SpeechRecognition.start({
    language,
    maxResults: 1,
    partialResults: false,
    popup: false,
  });
  const transcript = matches?.[0]?.trim();
  return transcript ? transcript : null;
}

/**
 * Captures one utterance and returns the best transcript, or null if nothing usable was heard.
 * Single-shot (no partialResults, no system popup): start() resolves with the final matches once
 * the user stops speaking or stopRecognition() is called. Retries once on a fast failure to absorb
 * the post-recognition service-rebind race (see the note above). `shouldAbort` lets the caller skip
 * the retry if the user cancelled during the settle delay.
 */
export async function recognizeOnce(
  language = 'en-US',
  shouldAbort: () => boolean = () => false,
): Promise<string | null> {
  const startedAt = performance.now();
  try {
    return await startOnce(language);
  } catch (err) {
    if (performance.now() - startedAt >= REBIND_RACE_MS) throw err; // slow failure — real, not the race
    await new Promise((resolve) => setTimeout(resolve, REBIND_RETRY_DELAY_MS));
    if (shouldAbort()) return null;
    return await startOnce(language);
  }
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
