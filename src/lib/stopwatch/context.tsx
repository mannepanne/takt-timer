// ABOUT: StopwatchProvider mounts the count-up state machine once, at the app level, so
// ABOUT: it survives route changes rather than resetting on every mount of Timer.tsx.
// ABOUT: Exposes control actions plus two read paths: a plain getElapsedMs() for one-off
// ABOUT: reads, and useElapsedMs(intervalMs) for a polling value that stays live while running.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useStopwatchMachine } from './useStopwatchMachine';
import type { Phase } from './types';

export type StopwatchContextValue = {
  phase: Phase;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  getElapsedMs: () => number;
};

const StopwatchContext = createContext<StopwatchContextValue | null>(null);

export function StopwatchProvider({ children }: { children: React.ReactNode }) {
  const { state, start, pause, resume, reset, getElapsedMs } = useStopwatchMachine();

  const value = useMemo(
    () => ({ phase: state.phase, start, pause, resume, reset, getElapsedMs }),
    [state.phase, start, pause, resume, reset, getElapsedMs],
  );

  return <StopwatchContext.Provider value={value}>{children}</StopwatchContext.Provider>;
}

export function useStopwatch(): StopwatchContextValue {
  const ctx = useContext(StopwatchContext);
  if (!ctx) throw new Error('useStopwatch must be used inside StopwatchProvider');
  return ctx;
}

// Shared polling hook so neither the Timer screen nor the Home indicator has to
// hand-roll its own interval loop — each just picks its own cadence.
export function useElapsedMs(intervalMs: number): number {
  const { phase, getElapsedMs } = useStopwatch();
  const [elapsed, setElapsed] = useState(getElapsedMs);

  useEffect(() => {
    // Resync immediately on phase change (mounting mid-run, or the instant a pause/reset
    // freezes/zeroes the value) rather than waiting for the first interval tick.
    setElapsed(getElapsedMs());
    if (phase !== 'running') return;
    const id = setInterval(() => setElapsed(getElapsedMs()), intervalMs);
    return () => clearInterval(id);
  }, [phase, intervalMs, getElapsedMs]);

  return elapsed;
}
