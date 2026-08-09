// ABOUT: Tests for the native speech-recognition wrapper — availability, the RECORD_AUDIO
// ABOUT: permission mapping (granted / denied / permanently-denied), one-shot capture, and the
// ABOUT: settings deep link. The plugins are mocked; real capture is verified on-device.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const available = vi.fn();
const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const start = vi.fn();
const stop = vi.fn();
const openAndroid = vi.fn();

vi.mock('@capacitor-community/speech-recognition', () => ({
  SpeechRecognition: {
    available: () => available(),
    checkPermissions: () => checkPermissions(),
    requestPermissions: () => requestPermissions(),
    start: (opts: unknown) => start(opts),
    stop: () => stop(),
  },
}));
vi.mock('capacitor-native-settings', () => ({
  NativeSettings: { openAndroid: (opts: unknown) => openAndroid(opts) },
  AndroidSettings: { ApplicationDetails: 'application_details_settings' },
}));

import {
  ensurePermission,
  isRecognitionAvailable,
  openAppSettings,
  recognizeOnce,
  stopRecognition,
} from './recognizer';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isRecognitionAvailable', () => {
  it('returns the plugin availability flag', async () => {
    available.mockResolvedValue({ available: true });
    expect(await isRecognitionAvailable()).toBe(true);
    available.mockResolvedValue({ available: false });
    expect(await isRecognitionAvailable()).toBe(false);
  });

  it('treats a throwing availability check as unavailable (falls back, never crashes)', async () => {
    available.mockRejectedValue(new Error('no service'));
    expect(await isRecognitionAvailable()).toBe(false);
  });
});

describe('ensurePermission', () => {
  it('granted straight away needs no request', async () => {
    checkPermissions.mockResolvedValue({ speechRecognition: 'granted' });
    expect(await ensurePermission()).toBe('granted');
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('a pre-existing denied is permanent — routes to settings, does not re-prompt', async () => {
    checkPermissions.mockResolvedValue({ speechRecognition: 'denied' });
    expect(await ensurePermission()).toBe('permanently-denied');
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('prompt → request granted', async () => {
    checkPermissions.mockResolvedValue({ speechRecognition: 'prompt' });
    requestPermissions.mockResolvedValue({ speechRecognition: 'granted' });
    expect(await ensurePermission()).toBe('granted');
  });

  it('prompt → request denied is a re-askable denial', async () => {
    checkPermissions.mockResolvedValue({ speechRecognition: 'prompt-with-rationale' });
    requestPermissions.mockResolvedValue({ speechRecognition: 'denied' });
    expect(await ensurePermission()).toBe('denied');
  });
});

describe('recognizeOnce', () => {
  it('returns the best trimmed transcript', async () => {
    start.mockResolvedValue({ matches: ['  three sets of one minute  ', 'other'] });
    expect(await recognizeOnce()).toBe('three sets of one minute');
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en-US', partialResults: false, popup: false }),
    );
  });

  it('passes through a requested language', async () => {
    start.mockResolvedValue({ matches: ['x'] });
    await recognizeOnce('en-GB');
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ language: 'en-GB' }));
  });

  it('returns null when nothing usable was heard', async () => {
    start.mockResolvedValue({ matches: [] });
    expect(await recognizeOnce()).toBeNull();
    start.mockResolvedValue({ matches: ['   '] });
    expect(await recognizeOnce()).toBeNull();
    start.mockResolvedValue({});
    expect(await recognizeOnce()).toBeNull();
  });

  it('retries once when start fails fast (the post-recognition rebind race), then succeeds', async () => {
    // On-device, the first start() after a completed recognition can lose the speech-service
    // binding and fail in ~20ms. A real elapsed here is ~0, so recognizeOnce retries after the
    // settle and returns the retry's result — the fix that makes the 2nd+ tap usable.
    start
      .mockRejectedValueOnce(new Error('Didn’t understand, please try again.'))
      .mockResolvedValueOnce({ matches: ['three sets of one minute'] });
    expect(await recognizeOnce()).toBe('three sets of one minute');
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('does not retry a slow failure (real no-match / network error) — surfaces it', async () => {
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(2000);
    start.mockRejectedValue(new Error('Network error'));
    await expect(recognizeOnce()).rejects.toThrow('Network error');
    expect(start).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });

  it('skips the retry when the caller aborted during the settle (user cancelled)', async () => {
    start.mockRejectedValueOnce(new Error('Didn’t understand, please try again.'));
    expect(await recognizeOnce('en-US', () => true)).toBeNull();
    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe('stopRecognition', () => {
  it('stops the recogniser', async () => {
    stop.mockResolvedValue(undefined);
    await stopRecognition();
    expect(stop).toHaveBeenCalled();
  });

  it('swallows a stop error (stopping an already-stopped recogniser is not an error)', async () => {
    stop.mockRejectedValue(new Error('not listening'));
    await expect(stopRecognition()).resolves.toBeUndefined();
  });
});

describe('openAppSettings', () => {
  it('deep-links to the Android application-details settings page', async () => {
    openAndroid.mockResolvedValue(undefined);
    await openAppSettings();
    expect(openAndroid).toHaveBeenCalledWith({ option: 'application_details_settings' });
  });
});
