// ABOUT: React hook wrapping the pure timer reducer with an rAF loop and effect runner.
// ABOUT: Wires lib/audio, lib/haptics, lib/wakeLock, lib/history into the machine's effects.

import { useCallback, useEffect, useRef, useState } from 'react';

import { beep, prepareAudio } from '@/lib/audio';
import { haptic } from '@/lib/haptics';
import { appendHistory } from '@/lib/history';
import { acquire, reacquireIfNeeded, release } from '@/lib/wakeLock';

import { initial, progress, secondsLeft, step } from './machine';
import type { Effect, MachineEvent, MachineState, Session } from './types';

function runEffects(effects: Effect[]): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'beep':
        beep(effect.kind);
        break;
      case 'haptic':
        haptic(effect.kind);
        break;
      case 'prepareAudio':
        prepareAudio();
        break;
      case 'acquireWakeLock':
        void acquire();
        break;
      case 'releaseWakeLock':
        void release();
        break;
      case 'appendHistory':
        appendHistory(effect.entry);
        break;
    }
  }
}

export type TimerApi = {
  state: MachineState;
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  repeatSet: () => void;
  secondsLeft: number;
  progress: number;
};

export function useTimerMachine(session: Session): TimerApi {
  const [state, setState] = useState<MachineState>(() => initial(session));
  const stateRef = useRef<MachineState>(state);
  stateRef.current = state;

  // `now` re-renders the component every rAF frame while running, so derived values refresh.
  const [now, setNow] = useState(() => performance.now());

  const send = useCallback((event: MachineEvent) => {
    const current = stateRef.current;
    const { next, effects } = step(current, event);
    runEffects(effects);
    if (next !== current) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  const start = useCallback(() => send({ type: 'start', now: performance.now() }), [send]);
  const stop = useCallback(() => send({ type: 'stop' }), [send]);
  const pause = useCallback(() => send({ type: 'pause', now: performance.now() }), [send]);
  const resume = useCallback(() => send({ type: 'resume', now: performance.now() }), [send]);
  const skip = useCallback(() => send({ type: 'skip', now: performance.now() }), [send]);
  const repeatSet = useCallback(() => send({ type: 'repeatSet', now: performance.now() }), [send]);

  const running = state.phase === 'countIn' || state.phase === 'work' || state.phase === 'rest';

  // rAF loop — dispatch tick + bump `now` to force re-render while active.
  useEffect(() => {
    if (!running) return;
    let rafId: number | null = null;
    const loop = () => {
      const t = performance.now();
      setNow(t);
      send({ type: 'tick', now: t });
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [running, send]);

  // Visibility → pause/resume-audio-and-reacquire.
  useEffect(() => {
    const handler = () => {
      const t = performance.now();
      if (document.visibilityState === 'hidden') {
        send({ type: 'visibilityHidden', now: t });
      } else {
        send({ type: 'visibilityVisible', now: t });
        void reacquireIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [send]);

  // Safari bfcache: a `pageshow` with `event.persisted` means the page was restored from
  // the back-forward cache. Any in-flight session state is stale — no live Wake Lock, no
  // resumable AudioContext, no rAF history. Stop cleanly so the user sees Home on return.
  useEffect(() => {
    const handler = (event: PageTransitionEvent) => {
      if (event.persisted) {
        send({ type: 'stop' });
      }
    };
    window.addEventListener('pageshow', handler);
    return () => window.removeEventListener('pageshow', handler);
  }, [send]);

  // Release the wake lock on unmount.
  useEffect(
    () => () => {
      void release();
    },
    [],
  );

  const derived =
    state.phase === 'countIn' || state.phase === 'work' || state.phase === 'rest'
      ? { secondsLeft: secondsLeft(state, now), progress: progress(state, now) }
      : { secondsLeft: 0, progress: 0 };

  return {
    state,
    start,
    stop,
    pause,
    resume,
    skip,
    repeatSet,
    secondsLeft: derived.secondsLeft,
    progress: derived.progress,
  };
}
