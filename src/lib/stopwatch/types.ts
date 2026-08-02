// ABOUT: Stopwatch state machine — type definitions.
// ABOUT: A count-up timer with no fixed duration; elapsed is always derived from
// ABOUT: wall-clock timestamps, never from an accumulated tick count.

export type Phase = 'idle' | 'running' | 'paused';

export type MachineState = {
  phase: Phase;
  accumulatedMs: number;
  startedAtMs: number | null;
};

export type MachineEvent =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'reset' };

export type Effect = { type: 'acquireWakeLock' } | { type: 'releaseWakeLock' };

export type StepResult = { next: MachineState; effects: Effect[] };

const MS_PER_HOUR = 3_600_000;

// Elapsed is always derived from timestamps rather than counted, so a backwards clock
// step (NTP correction is the realistic case) can produce a negative delta for the
// current running stint — clamped here rather than left to render as garbage. Only the
// delta is clamped, not the total: accumulatedMs already holds real elapsed time from
// before this stint (e.g. a prior pause/resume), and a backward jump big enough to make
// that sum negative must not discard it.
export function elapsedMs(state: MachineState, now: number): number {
  if (state.phase === 'running' && state.startedAtMs !== null) {
    return state.accumulatedMs + Math.max(0, now - state.startedAtMs);
  }
  return state.accumulatedMs;
}

// One full revolution per hour; wraps and starts a new revolution past 60:00 while the
// digit display keeps counting normally.
export function ringProgress(ms: number): number {
  return (ms % MS_PER_HOUR) / MS_PER_HOUR;
}
