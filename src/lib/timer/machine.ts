// ABOUT: Timer state machine reducer — pure, deterministic, test-friendly.
// ABOUT: Maps (MachineState, MachineEvent) → { next state, list of side-effects to run }.

import type {
  ActiveState,
  CompletedSession,
  Effect,
  IdleState,
  MachineEvent,
  MachineState,
  PausedState,
  Session,
  StepResult,
} from './types';
import { phaseTotalSec, progress, secondsLeft } from './types';

export function initial(session: Session): IdleState {
  return { phase: 'idle', session };
}

function enterActive(
  session: Session,
  phase: 'countIn' | 'work' | 'rest',
  currentIdx: number,
  now: number,
): ActiveState {
  return {
    phase,
    session,
    currentIdx,
    phaseStartMs: now,
    pausedAccumulatedMs: 0,
    lastPipSecond: null,
  };
}

function toCompletedEntry(
  session: Session,
  totalSec: number,
  completedAt: number,
): CompletedSession {
  return {
    completedAt,
    totalSec,
    sets: session.sets,
    workSec: session.workSec,
    restSec: session.restSec,
    name: session.name,
  };
}

function computeTotalSec(session: Session): number {
  // Work is `sets × workSec`. Rest is between sets, so (sets - 1) × restSec.
  // Count-in is not counted as session time.
  const work = session.sets * session.workSec;
  const rest = Math.max(0, session.sets - 1) * session.restSec;
  return work + rest;
}

function completeSession(
  session: Session,
  now: number,
): {
  next: MachineState;
  effects: Effect[];
} {
  const totalSec = computeTotalSec(session);
  const completedAt = now;
  return {
    next: { phase: 'complete', session, totalSec, completedAt },
    effects: [
      { type: 'beep', kind: 'complete' },
      { type: 'haptic', kind: 'complete' },
      { type: 'releaseWakeLock' },
      { type: 'appendHistory', entry: toCompletedEntry(session, totalSec, completedAt) },
    ],
  };
}

function stepActive(state: ActiveState, event: MachineEvent): StepResult {
  const { session, currentIdx, phase } = state;
  const isLastSet = currentIdx >= session.sets - 1;

  switch (event.type) {
    case 'tick': {
      const left = secondsLeft(state, event.now);

      // Emit pip on final three seconds, once per integer second.
      const effects: Effect[] = [];
      if (left > 0 && left <= 3 && left !== state.lastPipSecond) {
        effects.push({ type: 'beep', kind: 'pip' });
      }

      if (left > 0) {
        // Still in the current phase.
        return {
          next: {
            ...state,
            lastPipSecond: left !== state.lastPipSecond ? left : state.lastPipSecond,
          },
          effects,
        };
      }

      // Phase ended — transition.
      if (phase === 'countIn') {
        return {
          next: enterActive(session, 'work', 0, event.now),
          effects: [
            { type: 'beep', kind: 'phase-work' },
            { type: 'haptic', kind: 'phase' },
          ],
        };
      }
      if (phase === 'work') {
        if (isLastSet) {
          return completeSession(session, event.now);
        }
        // 0-second rest: skip straight to next work phase, transition flash only (no beep).
        if (session.restSec === 0) {
          return {
            next: enterActive(session, 'work', currentIdx + 1, event.now),
            effects: [{ type: 'haptic', kind: 'phase' }],
          };
        }
        return {
          next: enterActive(session, 'rest', currentIdx, event.now),
          effects: [
            { type: 'beep', kind: 'phase-rest' },
            { type: 'haptic', kind: 'phase' },
          ],
        };
      }
      // phase === 'rest'
      return {
        next: enterActive(session, 'work', currentIdx + 1, event.now),
        effects: [
          { type: 'beep', kind: 'phase-work' },
          { type: 'haptic', kind: 'phase' },
        ],
      };
    }

    case 'skip': {
      if (phase === 'countIn') {
        return {
          next: enterActive(session, 'work', 0, event.now),
          effects: [
            { type: 'beep', kind: 'phase-work' },
            { type: 'haptic', kind: 'phase' },
          ],
        };
      }
      if (phase === 'work') {
        if (isLastSet) {
          return completeSession(session, event.now);
        }
        if (session.restSec === 0) {
          return {
            next: enterActive(session, 'work', currentIdx + 1, event.now),
            effects: [{ type: 'haptic', kind: 'phase' }],
          };
        }
        return {
          next: enterActive(session, 'rest', currentIdx, event.now),
          effects: [
            { type: 'beep', kind: 'phase-rest' },
            { type: 'haptic', kind: 'phase' },
          ],
        };
      }
      // phase === 'rest'
      return {
        next: enterActive(session, 'work', currentIdx + 1, event.now),
        effects: [
          { type: 'beep', kind: 'phase-work' },
          { type: 'haptic', kind: 'phase' },
        ],
      };
    }

    case 'repeatSet': {
      // Only enabled when progress ≥ 0.05; otherwise no-op.
      if (progress(state, event.now) < 0.05) {
        return { next: state, effects: [] };
      }
      // From either work or rest, repeat-set goes back to the current set's work phase.
      // During count-in, repeat-set is a no-op (there's no "previous set" to repeat).
      if (phase === 'countIn') {
        return { next: state, effects: [] };
      }
      return {
        next: enterActive(session, 'work', currentIdx, event.now),
        effects: [{ type: 'haptic', kind: 'repeat' }],
      };
    }

    case 'pause':
    case 'visibilityHidden': {
      const paused: PausedState = {
        phase: 'paused',
        session,
        resumePhase: phase,
        currentIdx,
        phaseStartMs: state.phaseStartMs,
        pausedAccumulatedMs: state.pausedAccumulatedMs,
        pausedAtMs: event.now,
        lastPipSecond: state.lastPipSecond,
        wasVisibilityPause: event.type === 'visibilityHidden',
      };
      return {
        next: paused,
        effects: [{ type: 'releaseWakeLock' }],
      };
    }

    case 'stop': {
      return {
        next: { phase: 'idle', session },
        effects: [{ type: 'releaseWakeLock' }],
      };
    }

    case 'visibilityVisible':
      // No-op when already active; defensively prepare audio so the next beep works.
      return { next: state, effects: [{ type: 'prepareAudio' }] };

    default:
      return { next: state, effects: [] };
  }
}

function stepPaused(state: PausedState, event: MachineEvent): StepResult {
  switch (event.type) {
    case 'resume': {
      const pausedDelta = event.now - state.pausedAtMs;
      const resumed: ActiveState = {
        phase: state.resumePhase,
        session: state.session,
        currentIdx: state.currentIdx,
        phaseStartMs: state.phaseStartMs,
        pausedAccumulatedMs: state.pausedAccumulatedMs + pausedDelta,
        lastPipSecond: state.lastPipSecond,
      };
      return {
        next: resumed,
        effects: [
          { type: 'prepareAudio' },
          { type: 'acquireWakeLock' },
          { type: 'haptic', kind: 'resume' },
        ],
      };
    }

    case 'stop':
      return {
        next: { phase: 'idle', session: state.session },
        effects: [],
      };

    case 'visibilityVisible':
      // Stay paused (user must explicitly tap resume). Prepare audio for when they do.
      return { next: state, effects: [{ type: 'prepareAudio' }] };

    default:
      return { next: state, effects: [] };
  }
}

function stepIdle(state: IdleState, event: MachineEvent): StepResult {
  if (event.type === 'start') {
    const active = enterActive(state.session, 'countIn', 0, event.now);
    return {
      next: active,
      effects: [
        { type: 'prepareAudio' },
        { type: 'acquireWakeLock' },
        { type: 'haptic', kind: 'start' },
        { type: 'beep', kind: 'count' },
      ],
    };
  }
  return { next: state, effects: [] };
}

function stepComplete(state: MachineState, event: MachineEvent): StepResult {
  if (event.type === 'stop' || event.type === 'start') {
    // Restart fresh from idle if user asks to run again or explicitly stops.
    return stepIdle({ phase: 'idle', session: state.session }, event);
  }
  return { next: state, effects: [] };
}

export function step(state: MachineState, event: MachineEvent): StepResult {
  switch (state.phase) {
    case 'idle':
      return stepIdle(state, event);
    case 'countIn':
    case 'work':
    case 'rest':
      return stepActive(state, event);
    case 'paused':
      return stepPaused(state, event);
    case 'complete':
      return stepComplete(state, event);
  }
}

// Re-export type helpers for consumers.
export { phaseTotalSec, progress, secondsLeft };
