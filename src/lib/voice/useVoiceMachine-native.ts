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

export type VoiceApi = {
  state: VoiceState;
  micTap: () => void;
  userStop: () => void;
  cancel: () => void;
  retry: () => void;
  retryToastVisible: boolean;
  openSettings: () => void;
};

export function useVoiceMachine(): VoiceApi {
  const [state, setState] = useState<VoiceState>(() => initial());
  const stateRef = useRef<VoiceState>(state);
  stateRef.current = state;

  const navigate = useNavigate();

  // Cancellation sentinel for the in-flight capture flow. Flipped when the user cancels (or the
  // component unmounts) so the resolving recogniser promise stops dispatching stale events.
  const captureRef = useRef<{ cancelled: boolean } | null>(null);
  const sendRef = useRef<(event: NativeVoiceEvent) => void>(() => {});

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
              const transcript = await recognizeOnce(RECOGNITION_LANGUAGE);
              if (capture.cancelled) return;
              sendRef.current({ type: 'transcript', text: transcript });
            } catch {
              if (!capture.cancelled) sendRef.current({ type: 'recognitionError' });
            }
          })();
          return;
        }

        case 'stopRecognition':
          if (captureRef.current) captureRef.current.cancelled = true;
          void stopRecognition();
          return;

        case 'navigateToConfigure':
          navigate('/configure', { state: { session: effect.session } });
          return;

        case 'openAppSettings':
          void openAppSettings();
          return;
      }
    },
    [navigate],
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

  // Stop listening early and use what was heard: stopRecognition() makes the pending recognizeOnce()
  // resolve, which dispatches the 'transcript' event through the normal path.
  const userStop = useCallback(() => {
    if (stateRef.current.phase !== 'listening') return;
    void stopRecognition();
  }, []);

  // Unmount cleanup — cancel any in-flight capture and stop the recogniser.
  useEffect(
    () => () => {
      if (captureRef.current) captureRef.current.cancelled = true;
      void stopRecognition();
    },
    [],
  );

  // Native has no blob-empty retry toast (that's a web MediaRecorder concern) — always false.
  return { state, micTap, userStop, cancel, retry, retryToastVisible: false, openSettings };
}

// Compile-time parity: consumers (MicButton) are typechecked against the web useVoiceMachine (the
// build alias is invisible to tsc/vitest), so the native return must stay assignable to the web
// VoiceApi. Type-only import — erased at build, so the web module isn't pulled into the native bundle.
const _apiParity: WebVoiceApi = null as unknown as ReturnType<typeof useVoiceMachine>;
void _apiParity;
