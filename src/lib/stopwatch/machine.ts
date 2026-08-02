// ABOUT: Stopwatch state machine reducer — pure, deterministic, test-friendly.
// ABOUT: Maps (MachineState, MachineEvent) → { next state, list of side-effects to run }.
// ABOUT: Every event is safe to fire in any phase; unhandled combinations are no-ops.

import { elapsedMs } from './types';
import type { Effect, MachineEvent, MachineState, StepResult } from './types';

export function initial(): MachineState {
  return { phase: 'idle', accumulatedMs: 0, startedAtMs: null };
}

function noop(state: MachineState): StepResult {
  return { next: state, effects: [] };
}

export function step(state: MachineState, event: MachineEvent): StepResult {
  switch (event.type) {
    case 'start': {
      if (state.phase !== 'idle') return noop(state);
      return {
        next: { phase: 'running', accumulatedMs: 0, startedAtMs: event.now },
        effects: [{ type: 'acquireWakeLock' }],
      };
    }

    case 'pause': {
      if (state.phase !== 'running') return noop(state);
      return {
        next: { phase: 'paused', accumulatedMs: elapsedMs(state, event.now), startedAtMs: null },
        effects: [{ type: 'releaseWakeLock' }],
      };
    }

    case 'resume': {
      if (state.phase !== 'paused') return noop(state);
      return {
        next: { phase: 'running', accumulatedMs: state.accumulatedMs, startedAtMs: event.now },
        effects: [{ type: 'acquireWakeLock' }],
      };
    }

    case 'reset': {
      if (state.phase === 'idle') return noop(state);
      // Paused already released the wake lock on entering that phase; only a reset
      // from running actually holds one to release.
      const effects: Effect[] = state.phase === 'running' ? [{ type: 'releaseWakeLock' }] : [];
      return { next: { phase: 'idle', accumulatedMs: 0, startedAtMs: null }, effects };
    }
  }
}

// Re-export type helpers for consumers.
export { elapsedMs, ringProgress } from './types';
