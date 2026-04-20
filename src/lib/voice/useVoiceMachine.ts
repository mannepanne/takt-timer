// ABOUT: React hook wrapping the pure voice reducer — runs effects against the mic module,
// ABOUT: the NDJSON voice-client, the 8s cap timer, and the configure-route navigator.
// ABOUT: Pattern mirrors src/lib/timer/useTimerMachine.ts.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { initial, step } from './machine';
import {
  isMediaRecorderAvailable,
  setAudioCategory,
  startRecording as micStartRecording,
  type RecorderHandle,
} from './mic';
import type { Effect, VoiceEvent, VoiceState } from './types';
import { postVoice } from './voice-client';

const RECORDING_CAP_MS = 8_000;
const MIN_AUDIO_BYTES = 500;

type StopReason = 'user' | 'cap' | 'cancel';

export type VoiceApi = {
  state: VoiceState;
  micTap: () => void;
  userStop: () => void;
  cancel: () => void;
  retry: () => void;
};

export function useVoiceMachine(): VoiceApi {
  const [state, setState] = useState<VoiceState>(() => initial());
  const stateRef = useRef<VoiceState>(state);
  stateRef.current = state;

  const navigate = useNavigate();

  const recorderRef = useRef<RecorderHandle | null>(null);
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postAbortRef = useRef<AbortController | null>(null);
  const stopReasonRef = useRef<StopReason>('user');

  // sendRef lets effect handlers call send() without stale-closure issues.
  const sendRef = useRef<(event: VoiceEvent) => void>(() => {});

  const runEffect = useCallback(
    (effect: Effect) => {
      switch (effect.type) {
        case 'setAudioCategory':
          setAudioCategory(effect.category);
          return;

        case 'requestMic':
          void (async () => {
            try {
              const handle = await micStartRecording({
                onStop: (blob) => {
                  // Fires for every stop path: user-tap, cap timer, cancel. The
                  // stopReasonRef tells us which one triggered it.
                  const reason = stopReasonRef.current;
                  if (reason === 'cancel') return; // discard path — no dispatch.
                  if (reason === 'cap') {
                    sendRef.current({ type: 'recordingCap', blob });
                  } else {
                    sendRef.current({ type: 'recordingStopped', blob });
                  }
                  if (blob.size < MIN_AUDIO_BYTES) {
                    sendRef.current({ type: 'blobEmpty' });
                  } else {
                    sendRef.current({ type: 'uploadBegun' });
                  }
                },
                onError: () => {
                  sendRef.current({ type: 'errorArrived', reason: 'whisper-error' });
                },
              });
              recorderRef.current = handle;
              sendRef.current({ type: 'permissionGranted', now: performance.now() });
            } catch (err) {
              const name = (err as { name?: string } | null)?.name;
              if (name === 'NotAllowedError' || name === 'SecurityError') {
                sendRef.current({ type: 'permissionDenied' });
              } else {
                // Unsupported browser / no MIME / hardware error — same calm UI as
                // permission-denied. A richer split lands with Voice overlay copy.
                sendRef.current({ type: 'permissionDenied' });
              }
            }
          })();
          return;

        case 'startRecording':
          // mic.startRecording already started the recorder inside 'requestMic'. No-op.
          return;

        case 'stopRecording':
          // Cancel path from the machine (user cancelled mid-listen).
          stopReasonRef.current = 'cancel';
          recorderRef.current?.discard();
          recorderRef.current = null;
          return;

        case 'discardBlob':
          recorderRef.current?.discard();
          recorderRef.current = null;
          return;

        case 'schedule8sCap':
          if (capTimerRef.current) clearTimeout(capTimerRef.current);
          capTimerRef.current = setTimeout(() => {
            capTimerRef.current = null;
            if (stateRef.current.phase !== 'listening') return;
            stopReasonRef.current = 'cap';
            recorderRef.current?.stop();
          }, RECORDING_CAP_MS);
          return;

        case 'cancel8sCap':
          if (capTimerRef.current) {
            clearTimeout(capTimerRef.current);
            capTimerRef.current = null;
          }
          return;

        case 'postVoice':
          postAbortRef.current?.abort();
          postAbortRef.current = new AbortController();
          void postVoice(effect.blob, (e) => sendRef.current(e), {
            signal: postAbortRef.current.signal,
          });
          return;

        case 'cancelPost':
          postAbortRef.current?.abort();
          postAbortRef.current = null;
          return;

        case 'showRetryToast':
          // The overlay component owns the toast UI. The machine state carries the
          // signal (idle-post-blob-empty); the component observes and renders.
          return;

        case 'navigateToConfigure':
          navigate('/configure', { state: { session: effect.session } });
          return;
      }
    },
    [navigate],
  );

  const send = useCallback(
    (event: VoiceEvent) => {
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

  const micTap = useCallback(() => {
    stopReasonRef.current = 'user'; // Reset intent for this overlay session.
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    send({ type: 'micTap', online, supported: isMediaRecorderAvailable() });
  }, [send]);

  const userStop = useCallback(() => {
    if (stateRef.current.phase !== 'listening') return;
    stopReasonRef.current = 'user';
    recorderRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    send({ type: 'cancel' });
  }, [send]);

  const retry = useCallback(() => {
    send({ type: 'retry' });
  }, [send]);

  // Unmount cleanup — discard any in-flight recorder, abort any pending POST,
  // clear the cap timer, restore ambient audio.
  useEffect(
    () => () => {
      recorderRef.current?.discard();
      recorderRef.current = null;
      postAbortRef.current?.abort();
      postAbortRef.current = null;
      if (capTimerRef.current) {
        clearTimeout(capTimerRef.current);
        capTimerRef.current = null;
      }
      setAudioCategory('ambient');
    },
    [],
  );

  return { state, micTap, userStop, cancel, retry };
}
