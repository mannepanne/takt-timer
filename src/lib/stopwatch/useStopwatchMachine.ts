// ABOUT: React hook wrapping the pure stopwatch reducer with an effect runner.
// ABOUT: No rAF loop here — reducer-driven phase transitions already trigger React's
// ABOUT: own re-render; live elapsed reads happen via useElapsedMs, at whichever
// ABOUT: cadence the consuming screen needs.

import { useCallback, useEffect, useRef, useState } from 'react';

import { acquire, reacquireIfNeeded, release } from '@/lib/wakeLock';

import { elapsedMs, initial, step } from './machine';
import type { Effect, MachineEvent, MachineState } from './types';

const WAKE_LOCK_OWNER = 'stopwatch';

function runEffects(effects: Effect[]): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'acquireWakeLock':
        void acquire(WAKE_LOCK_OWNER);
        break;
      case 'releaseWakeLock':
        void release(WAKE_LOCK_OWNER);
        break;
    }
  }
}

export type StopwatchMachineApi = {
  state: MachineState;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  getElapsedMs: () => number;
};

export function useStopwatchMachine(): StopwatchMachineApi {
  const [state, setState] = useState<MachineState>(() => initial());
  const stateRef = useRef<MachineState>(state);
  stateRef.current = state;

  const send = useCallback((event: MachineEvent) => {
    const current = stateRef.current;
    const { next, effects } = step(current, event);
    runEffects(effects);
    if (next !== current) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  const start = useCallback(() => send({ type: 'start', now: Date.now() }), [send]);
  const pause = useCallback(() => send({ type: 'pause', now: Date.now() }), [send]);
  const resume = useCallback(() => send({ type: 'resume', now: Date.now() }), [send]);
  const reset = useCallback(() => send({ type: 'reset' }), [send]);

  // No visibility-driven *state* transitions — this machine is explicitly meant to keep
  // running while backgrounded. It does need the wake lock reacquired on return, though,
  // since the platform auto-releases it on hide.
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        void reacquireIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // The provider only unmounts on a real page unload, but release our ownership anyway.
  useEffect(
    () => () => {
      void release(WAKE_LOCK_OWNER);
    },
    [],
  );

  const getElapsedMs = useCallback(() => elapsedMs(stateRef.current, Date.now()), []);

  return { state, start, pause, resume, reset, getElapsedMs };
}
