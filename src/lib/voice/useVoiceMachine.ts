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
const RETRY_TOAST_MS = 3_000;

type StopReason = 'user' | 'cap' | 'cancel';

// Non-permission getUserMedia / MediaRecorder construction errors. Distinct from
// permissionDenied because the user action required differs: "check browser settings"
// makes no sense when the mic hardware isn't available or the MIME is unsupported.
const NON_PERMISSION_ERROR_NAMES = new Set([
  'NotFoundError',
  'NotReadableError',
  'OverconstrainedError',
  'AbortError',
  'TypeError', // MediaRecorder constructor rejects invalid MIME as TypeError.
]);

export type VoiceApi = {
  state: VoiceState;
  micTap: () => void;
  userStop: () => void;
  cancel: () => void;
  retry: () => void;
  retryToastVisible: boolean;
};

export function useVoiceMachine(): VoiceApi {
  const [state, setState] = useState<VoiceState>(() => initial());
  const [retryToastVisible, setRetryToastVisible] = useState(false);
  const stateRef = useRef<VoiceState>(state);
  stateRef.current = state;

  const navigate = useNavigate();

  const recorderRef = useRef<RecorderHandle | null>(null);
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postAbortRef = useRef<AbortController | null>(null);
  const stopReasonRef = useRef<StopReason>('user');
  const retryToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cancellation sentinel for the in-flight requestMic effect. Set true when the user
  // taps Cancel while the OS permission dialog is showing, or when the component unmounts
  // before getUserMedia resolves. Guards against the recorder starting with no one tracking it.
  const pendingMicRef = useRef<{ cancelled: boolean } | null>(null);

  // sendRef lets effect handlers call send() without stale-closure issues.
  const sendRef = useRef<(event: VoiceEvent) => void>(() => {});

  const runEffect = useCallback(
    (effect: Effect) => {
      switch (effect.type) {
        case 'setAudioCategory':
          setAudioCategory(effect.category);
          return;

        case 'requestMic': {
          // Capture a fresh sentinel. If the user cancels during the permission prompt —
          // or the component unmounts — we flip .cancelled = true and the resolving
          // getUserMedia promise discards its handle instead of leaving a hot mic.
          const pending = { cancelled: false };
          pendingMicRef.current = pending;
          void (async () => {
            try {
              const handle = await micStartRecording({
                onStop: (blob) => {
                  const reason = stopReasonRef.current;
                  if (reason === 'cancel') return;
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
              if (pending.cancelled) {
                handle.discard();
                return;
              }
              recorderRef.current = handle;
              sendRef.current({ type: 'permissionGranted', now: performance.now() });
            } catch (err) {
              if (pending.cancelled) return;
              const name = (err as { name?: string } | null)?.name ?? '';
              if (name === 'NotAllowedError' || name === 'SecurityError') {
                sendRef.current({ type: 'permissionDenied' });
              } else if (NON_PERMISSION_ERROR_NAMES.has(name)) {
                // Hardware missing / busy / constraint-reject / unsupported MIME — the
                // user can't fix this from browser settings. Machine routes us to the
                // browser-unsupported sheet.
                sendRef.current({ type: 'hardwareUnavailable' });
              } else {
                sendRef.current({ type: 'permissionDenied' });
              }
            }
          })();
          return;
        }

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
          if (retryToastTimerRef.current) clearTimeout(retryToastTimerRef.current);
          setRetryToastVisible(true);
          retryToastTimerRef.current = setTimeout(() => {
            retryToastTimerRef.current = null;
            setRetryToastVisible(false);
          }, RETRY_TOAST_MS);
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
    // Flip the in-flight requestMic sentinel before the state transition. If the user
    // cancels while the OS permission prompt is up, the resolving getUserMedia promise
    // will see cancelled=true and discard its handle rather than leaving a live recorder.
    if (pendingMicRef.current) pendingMicRef.current.cancelled = true;
    send({ type: 'cancel' });
  }, [send]);

  const retry = useCallback(() => {
    send({ type: 'retry' });
  }, [send]);

  // Unmount cleanup — discard any in-flight recorder, abort any pending POST,
  // clear the cap timer and retry-toast timer, cancel any in-flight requestMic,
  // restore ambient audio.
  useEffect(
    () => () => {
      if (pendingMicRef.current) pendingMicRef.current.cancelled = true;
      recorderRef.current?.discard();
      recorderRef.current = null;
      postAbortRef.current?.abort();
      postAbortRef.current = null;
      if (capTimerRef.current) {
        clearTimeout(capTimerRef.current);
        capTimerRef.current = null;
      }
      if (retryToastTimerRef.current) {
        clearTimeout(retryToastTimerRef.current);
        retryToastTimerRef.current = null;
      }
      setAudioCategory('ambient');
    },
    [],
  );

  return { state, micTap, userStop, cancel, retry, retryToastVisible };
}
