// ABOUT: Timer state machine — type definitions.
// ABOUT: Session shape, machine states, events, and the effects the reducer returns.

export type Session = {
  sets: number;
  workSec: number;
  restSec: number;
  name?: string;
};

export type CompletedSession = {
  completedAt: number;
  totalSec: number;
  sets: number;
  workSec: number;
  restSec: number;
  name?: string;
};

export type Phase = 'idle' | 'countIn' | 'work' | 'rest' | 'paused' | 'complete';

export type IdleState = {
  phase: 'idle';
  session: Session;
};

export type ActivePhase = 'countIn' | 'work' | 'rest';

export type ActiveState = {
  phase: ActivePhase;
  session: Session;
  currentIdx: number;
  phaseStartMs: number;
  pausedAccumulatedMs: number;
  lastPipSecond: number | null;
};

export type PausedState = {
  phase: 'paused';
  session: Session;
  resumePhase: ActivePhase;
  currentIdx: number;
  phaseStartMs: number;
  pausedAccumulatedMs: number;
  pausedAtMs: number;
  lastPipSecond: number | null;
  wasVisibilityPause: boolean;
};

export type CompleteState = {
  phase: 'complete';
  session: Session;
  totalSec: number;
  completedAt: number;
};

export type MachineState = IdleState | ActiveState | PausedState | CompleteState;

// Events the machine responds to.
export type MachineEvent =
  | { type: 'start'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'skip'; now: number }
  | { type: 'repeatSet'; now: number }
  | { type: 'stop' }
  | { type: 'visibilityHidden'; now: number }
  | { type: 'visibilityVisible'; now: number };

// Effects the machine asks the host to execute.
export type BeepKind = 'count' | 'pip' | 'phase-work' | 'phase-rest' | 'complete';
export type HapticKind = 'start' | 'phase' | 'repeat' | 'resume' | 'complete';

export type Effect =
  | { type: 'beep'; kind: BeepKind }
  | { type: 'haptic'; kind: HapticKind }
  | { type: 'acquireWakeLock' }
  | { type: 'releaseWakeLock' }
  | { type: 'appendHistory'; entry: CompletedSession }
  | { type: 'prepareAudio' };

export type StepResult = { next: MachineState; effects: Effect[] };

// Helpers.
export function phaseTotalSec(state: ActiveState | PausedState): number {
  const phase = state.phase === 'paused' ? state.resumePhase : state.phase;
  switch (phase) {
    case 'countIn':
      return 3;
    case 'work':
      return state.session.workSec;
    case 'rest':
      return state.session.restSec;
  }
}

export function secondsLeft(state: ActiveState, now: number): number {
  const totalMs = phaseTotalSec(state) * 1000;
  const elapsedMs = now - state.phaseStartMs - state.pausedAccumulatedMs;
  return Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));
}

export function progress(state: ActiveState, now: number): number {
  const totalMs = phaseTotalSec(state) * 1000;
  if (totalMs === 0) return 1;
  const elapsedMs = now - state.phaseStartMs - state.pausedAccumulatedMs;
  return Math.min(1, Math.max(0, elapsedMs / totalMs));
}
