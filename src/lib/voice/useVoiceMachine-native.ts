// ABOUT: Native voice hook — aliased in for @/lib/voice/useVoiceMachine on the Android build.
// ABOUT: Drives machine-native (availability → permission → recognise → parse) against the
// ABOUT: on-device recogniser, exposing the same VoiceApi so MicButton/VoiceOverlay are unchanged.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ensurePermission,
  isRecognitionAvailable,
  openAppSettings,
  recognizeOnce,
  stopRecognition,
} from '@/lib/voice-local/recognizer';

import { initial, step, type NativeEffect, type NativeVoiceEvent } from './machine-native';
import type { VoiceState } from './types';
import type { VoiceApi as WebVoiceApi } from './useVoiceMachine';

// The parser is English-only (07f), so bias the recogniser toward English regardless of UI
// language — a Swedish-speaking user gets manual entry or English voice, per the umbrella spec.
const RECOGNITION_LANGUAGE = 'en-US';

// Defined by reference to the web VoiceApi so the shared fields can't drift, plus a REQUIRED
// openSettings (the web one has it optional). Required here is load-bearing: it's the permanent-
// denial recovery, and VoiceOverlay only shows the button when the callback is present.
export type VoiceApi = WebVoiceApi & { openSettings: () => void };

export function useVoiceMachine(): VoiceApi {
  const [state, setState] = useState<VoiceState>(() => initial());
  const stateRef = useRef<VoiceState>(state);
  stateRef.current = state;

  const navigate = useNavigate();

  // Cancellation sentinel for the in-flight capture flow. Flipped when the user cancels (or the
  // component unmounts) so the resolving recogniser promise stops dispatching stale events.
  const captureRef = useRef<{ cancelled: boolean } | null>(null);
  // True only while the recogniser is actively listening. Calling the plugin's stop() when it has
  // ALREADY finished leaves Android's speech service stuck "unbinding", so the next start() fails
  // instantly ("Client side error" / no-match). So every stop() is gated on this flag — stop only
  // an active session, never a completed one.
  const listeningRef = useRef(false);
  const sendRef = useRef<(event: NativeVoiceEvent) => void>(() => {});

  const stopActiveRecognition = useCallback(() => {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    void stopRecognition();
  }, []);

  const runEffect = useCallback(
    (effect: NativeEffect) => {
      switch (effect.type) {
        case 'startCapture': {
          const capture = { cancelled: false };
          captureRef.current = capture;
          void (async () => {
            try {
              if (!(await isRecognitionAvailable())) {
                if (!capture.cancelled) sendRef.current({ type: 'unavailable' });
                return;
              }
              const permission = await ensurePermission();
              if (capture.cancelled) return;
              if (permission !== 'granted') {
                sendRef.current({ type: 'permissionDenied' });
                return;
              }
              sendRef.current({ type: 'listeningBegan', now: performance.now() });
              listeningRef.current = true;
              const transcript = await recognizeOnce(RECOGNITION_LANGUAGE, () => capture.cancelled);
              listeningRef.current = false;
              if (capture.cancelled) return;
              sendRef.current({ type: 'transcript', text: transcript });
            } catch (err) {
              listeningRef.current = false;
              if (capture.cancelled) return;
              // The recogniser is online-only on many devices (no EXTRA_PREFER_OFFLINE), so a
              // "Network error" means voice can't run without a connection here — route to the
              // offline sheet ("you're offline, Configure manually") rather than the retry sheet,
              // which would just fail again. Anything else (no-match, client error) is genuinely
              // retryable.
              const message = (err as { message?: string } | null)?.message ?? '';
              sendRef.current({ type: 'recognitionError', offline: /network/i.test(message) });
            }
          })();
          return;
        }

        case 'stopRecognition':
          if (captureRef.current) captureRef.current.cancelled = true;
          stopActiveRecognition();
          return;

        case 'navigateToConfigure':
          navigate('/configure', { state: { session: effect.session } });
          return;

        case 'openAppSettings':
          void openAppSettings();
          return;
      }
    },
    [navigate, stopActiveRecognition],
  );

  const send = useCallback(
    (event: NativeVoiceEvent) => {
      const current = stateRef.current;
      const { next, effects } = step(current, event);
      if (next !== current) {
        stateRef.current = next;
        setState(next);
      }
      for (const effect of effects) runEffect(effect);
    },
    [runEffect],
  );

  sendRef.current = send;

  const micTap = useCallback(() => send({ type: 'micTap' }), [send]);
  const retry = useCallback(() => send({ type: 'retry' }), [send]);
  const openSettings = useCallback(() => send({ type: 'openSettings' }), [send]);

  const cancel = useCallback(() => {
    if (captureRef.current) captureRef.current.cancelled = true;
    send({ type: 'cancel' });
  }, [send]);

  // Stop listening early and use what was heard: stopping an ACTIVE recogniser makes the pending
  // recognizeOnce() resolve, which dispatches the 'transcript' event through the normal path.
  // Guarded so it never stops an already-finished session (see stopActiveRecognition).
  const userStop = useCallback(() => {
    stopActiveRecognition();
  }, [stopActiveRecognition]);

  // Unmount cleanup — cancel any in-flight capture and stop the recogniser ONLY if it's still
  // listening. Stopping a finished session here was the bug that wedged Android's speech service
  // ("unbinding"), breaking the next start().
  useEffect(
    () => () => {
      if (captureRef.current) captureRef.current.cancelled = true;
      stopActiveRecognition();
    },
    [stopActiveRecognition],
  );

  // Native has no blob-empty retry toast (that's a web MediaRecorder concern) — always false.
  return { state, micTap, userStop, cancel, retry, retryToastVisible: false, openSettings };
}

// Compile-time parity: consumers (MicButton) are typechecked against the web useVoiceMachine (the
// build alias is invisible to tsc/vitest), so the native return must stay assignable to the web
// VoiceApi. Type-only import — erased at build, so the web module isn't pulled into the native bundle.
const _apiParity: WebVoiceApi = null as unknown as ReturnType<typeof useVoiceMachine>;
void _apiParity;

// Pin openSettings as REQUIRED on the native return, independent of the VoiceApi type above. Because
// the web VoiceApi makes it optional, the _apiParity check alone would NOT catch openSettings being
// dropped from the native hook (required-satisfies-optional). Purely type-level (no runtime deref):
// resolves to 'ok' only when openSettings is required; a dropped/optional openSettings makes it
// `never` (or an index error), failing typecheck — the settings recovery is a silent-failure guard.
type _OpenSettingsIsRequired = undefined extends ReturnType<typeof useVoiceMachine>['openSettings']
  ? never
  : 'ok';
const _openSettingsPinned: _OpenSettingsIsRequired = 'ok';
void _openSettingsPinned;
