// Exhaustive tests for the timer state machine.
// Every row of the transition table in SPECIFICATIONS/02-core-timer.md has at least one test here.

import { describe, expect, it } from 'vitest';

import { initial, phaseTotalSec, progress, secondsLeft, step } from './machine';
import type { ActiveState, CompleteState, MachineState, Session } from './types';

const baseSession: Session = { sets: 3, workSec: 60, restSec: 30 };
const singleSet: Session = { sets: 1, workSec: 60, restSec: 30 };
const noRest: Session = { sets: 2, workSec: 10, restSec: 0 };

function start(state: MachineState, now = 0): MachineState {
  return step(state, { type: 'start', now }).next;
}

function advanceTo(state: MachineState, phase: ActiveState['phase']): ActiveState {
  if (state.phase !== phase) {
    throw new Error(`expected ${phase}, got ${state.phase}`);
  }
  return state;
}

describe('initial()', () => {
  it('returns an idle state with the given session', () => {
    expect(initial(baseSession)).toEqual({ phase: 'idle', session: baseSession });
  });
});

describe('idle → start', () => {
  it('enters countIn at currentIdx=0 with effects', () => {
    const { next, effects } = step(initial(baseSession), { type: 'start', now: 100 });
    expect(next.phase).toBe('countIn');
    if (next.phase !== 'countIn') return;
    expect(next.currentIdx).toBe(0);
    expect(next.phaseStartMs).toBe(100);
    expect(next.pausedAccumulatedMs).toBe(0);
    expect(effects).toEqual([
      { type: 'prepareAudio' },
      { type: 'acquireWakeLock' },
      { type: 'haptic', kind: 'start' },
      { type: 'beep', kind: 'count' },
    ]);
  });

  it('ignores non-start events when idle', () => {
    const idle = initial(baseSession);
    expect(step(idle, { type: 'tick', now: 0 }).next).toBe(idle);
    expect(step(idle, { type: 'stop' }).next).toBe(idle);
  });
});

describe('countIn phase', () => {
  it('tick with time remaining stays in countIn and emits pip at 3,2,1', () => {
    let state = start(initial(baseSession), 0);
    expect(state.phase).toBe('countIn');
    // At t=0, secondsLeft=3; first tick emits a pip (3 is new).
    const t1 = step(state, { type: 'tick', now: 100 });
    expect(t1.next.phase).toBe('countIn');
    expect(t1.effects).toContainEqual({ type: 'beep', kind: 'pip' });
    state = t1.next;
    // Next tick still within second 3 — no duplicate pip.
    const t2 = step(state, { type: 'tick', now: 500 });
    expect(t2.effects).not.toContainEqual({ type: 'beep', kind: 'pip' });
  });

  it('tick at countIn end transitions to work with beep+haptic', () => {
    const started = start(initial(baseSession), 0);
    const { next, effects } = step(started, { type: 'tick', now: 3000 });
    expect(next.phase).toBe('work');
    if (next.phase !== 'work') return;
    expect(next.currentIdx).toBe(0);
    expect(next.phaseStartMs).toBe(3000);
    expect(effects).toEqual([
      { type: 'beep', kind: 'phase-work' },
      { type: 'haptic', kind: 'phase' },
    ]);
  });

  it('skip during countIn advances to work', () => {
    const started = start(initial(baseSession), 0);
    const { next, effects } = step(started, { type: 'skip', now: 1000 });
    expect(next.phase).toBe('work');
    if (next.phase !== 'work') return;
    expect(next.currentIdx).toBe(0);
    expect(next.phaseStartMs).toBe(1000);
    expect(effects).toEqual([
      { type: 'beep', kind: 'phase-work' },
      { type: 'haptic', kind: 'phase' },
    ]);
  });

  it('repeatSet during countIn is a no-op', () => {
    const started = start(initial(baseSession), 0);
    // Advance so progress ≥ 0.05 (3s phase, 5% = 150ms).
    const { next } = step(started, { type: 'repeatSet', now: 200 });
    expect(next).toBe(started);
  });
});

describe('work phase (not last set)', () => {
  function inWork(): ActiveState {
    const s = step(start(initial(baseSession), 0), { type: 'tick', now: 3000 }).next;
    return advanceTo(s, 'work');
  }

  it('tick during work stays in work', () => {
    const state = inWork();
    const { next } = step(state, { type: 'tick', now: 5000 });
    expect(next.phase).toBe('work');
  });

  it('pip fires for each of the final 3 seconds', () => {
    const state = inWork();
    // Phase ends at 3000 + 60000 = 63000. secondsLeft=3 at t≤60000.
    const t3 = step(state, { type: 'tick', now: 60000 });
    expect(t3.effects).toContainEqual({ type: 'beep', kind: 'pip' });
    const t2 = step(t3.next, { type: 'tick', now: 61000 });
    expect(t2.effects).toContainEqual({ type: 'beep', kind: 'pip' });
    const t1 = step(t2.next, { type: 'tick', now: 62000 });
    expect(t1.effects).toContainEqual({ type: 'beep', kind: 'pip' });
  });

  it('tick at end transitions to rest', () => {
    const state = inWork();
    const { next, effects } = step(state, { type: 'tick', now: 63000 });
    expect(next.phase).toBe('rest');
    if (next.phase !== 'rest') return;
    expect(next.currentIdx).toBe(0);
    expect(next.phaseStartMs).toBe(63000);
    expect(effects).toEqual([
      { type: 'beep', kind: 'phase-rest' },
      { type: 'haptic', kind: 'phase' },
    ]);
  });

  it('skip during work transitions to rest', () => {
    const state = inWork();
    const { next, effects } = step(state, { type: 'skip', now: 10000 });
    expect(next.phase).toBe('rest');
    expect(effects).toEqual([
      { type: 'beep', kind: 'phase-rest' },
      { type: 'haptic', kind: 'phase' },
    ]);
  });

  it('repeatSet below threshold is a no-op', () => {
    const state = inWork();
    // 5% of 60s = 3s; at t=3100 we're just below threshold (elapsed = 100ms).
    const { next } = step(state, { type: 'repeatSet', now: 3100 });
    expect(next).toBe(state);
  });

  it('repeatSet above threshold restarts current set work phase', () => {
    const state = inWork();
    const { next, effects } = step(state, { type: 'repeatSet', now: 10000 });
    expect(next.phase).toBe('work');
    if (next.phase !== 'work') return;
    expect(next.currentIdx).toBe(0);
    expect(next.phaseStartMs).toBe(10000);
    expect(next.pausedAccumulatedMs).toBe(0);
    expect(effects).toEqual([{ type: 'haptic', kind: 'repeat' }]);
  });
});

describe('work phase (last set)', () => {
  function inLastWork(): ActiveState {
    // Session has 3 sets. Advance through countIn → work(0) → rest(0) → work(1) → rest(1) → work(2).
    let s: MachineState = start(initial(baseSession), 0);
    s = step(s, { type: 'tick', now: 3000 }).next; // countIn → work(0)
    s = step(s, { type: 'tick', now: 63000 }).next; // work(0) end → rest(0)
    s = step(s, { type: 'tick', now: 93000 }).next; // rest(0) end → work(1)
    s = step(s, { type: 'tick', now: 153000 }).next; // work(1) end → rest(1)
    s = step(s, { type: 'tick', now: 183000 }).next; // rest(1) end → work(2)
    return advanceTo(s, 'work');
  }

  it('tick at end of last work completes the session', () => {
    const state = inLastWork();
    const { next, effects } = step(state, { type: 'tick', now: 243000 });
    expect(next.phase).toBe('complete');
    const complete = next as CompleteState;
    expect(complete.totalSec).toBe(3 * 60 + 2 * 30); // 3 work + 2 rest = 240
    expect(complete.completedAt).toBe(243000);
    expect(effects).toContainEqual({ type: 'beep', kind: 'complete' });
    expect(effects).toContainEqual({ type: 'releaseWakeLock' });
    const historyEffect = effects.find((e) => e.type === 'appendHistory');
    expect(historyEffect).toBeDefined();
  });

  it('skip during last work completes the session', () => {
    const state = inLastWork();
    const { next, effects } = step(state, { type: 'skip', now: 190000 });
    expect(next.phase).toBe('complete');
    expect(effects).toContainEqual({ type: 'beep', kind: 'complete' });
  });
});

describe('rest phase', () => {
  function inRest(): ActiveState {
    let s: MachineState = start(initial(baseSession), 0);
    s = step(s, { type: 'tick', now: 3000 }).next; // → work(0)
    s = step(s, { type: 'tick', now: 63000 }).next; // → rest(0)
    return advanceTo(s, 'rest');
  }

  it('tick at rest end advances to next work, currentIdx+1', () => {
    const state = inRest();
    const { next, effects } = step(state, { type: 'tick', now: 93000 });
    expect(next.phase).toBe('work');
    if (next.phase !== 'work') return;
    expect(next.currentIdx).toBe(1);
    expect(effects).toEqual([
      { type: 'beep', kind: 'phase-work' },
      { type: 'haptic', kind: 'phase' },
    ]);
  });

  it('skip during rest advances to next work', () => {
    const state = inRest();
    const { next } = step(state, { type: 'skip', now: 80000 });
    expect(next.phase).toBe('work');
    if (next.phase !== 'work') return;
    expect(next.currentIdx).toBe(1);
  });

  it('repeatSet above threshold returns to work of current set (same currentIdx)', () => {
    const state = inRest();
    const { next, effects } = step(state, { type: 'repeatSet', now: 80000 });
    expect(next.phase).toBe('work');
    if (next.phase !== 'work') return;
    expect(next.currentIdx).toBe(0);
    expect(effects).toEqual([{ type: 'haptic', kind: 'repeat' }]);
  });
});

describe('pause and resume', () => {
  it('pause from work produces paused state and releases wake lock', () => {
    const s = step(start(initial(baseSession), 0), { type: 'tick', now: 3000 }).next;
    const { next, effects } = step(s, { type: 'pause', now: 10000 });
    expect(next.phase).toBe('paused');
    if (next.phase !== 'paused') return;
    expect(next.resumePhase).toBe('work');
    expect(next.pausedAtMs).toBe(10000);
    expect(next.wasVisibilityPause).toBe(false);
    expect(effects).toEqual([{ type: 'releaseWakeLock' }]);
  });

  it('resume from paused returns to active state with pausedAccumulatedMs advanced', () => {
    const s = step(start(initial(baseSession), 0), { type: 'tick', now: 3000 }).next;
    const paused = step(s, { type: 'pause', now: 10000 }).next;
    const { next, effects } = step(paused, { type: 'resume', now: 15000 });
    expect(next.phase).toBe('work');
    if (next.phase !== 'work') return;
    expect(next.pausedAccumulatedMs).toBe(5000);
    expect(next.phaseStartMs).toBe(3000); // unchanged
    expect(effects).toEqual([
      { type: 'prepareAudio' },
      { type: 'acquireWakeLock' },
      { type: 'haptic', kind: 'resume' },
    ]);
  });

  it('secondsLeft after pause/resume reflects only unpaused elapsed time', () => {
    // 60s work phase starting at t=3000. Pause at t=10000 (7s elapsed). Resume at t=15000 (5s paused).
    // After resume, tick at t=20000: effective elapsed = 20000 - 3000 - 5000 = 12000 → secondsLeft 48.
    let s: MachineState = start(initial(baseSession), 0);
    s = step(s, { type: 'tick', now: 3000 }).next;
    s = step(s, { type: 'pause', now: 10000 }).next;
    s = step(s, { type: 'resume', now: 15000 }).next;
    expect(s.phase).toBe('work');
    if (s.phase !== 'work') return;
    expect(secondsLeft(s, 20000)).toBe(48);
  });

  it('visibilityHidden is equivalent to pause but flagged as such', () => {
    const s = step(start(initial(baseSession), 0), { type: 'tick', now: 3000 }).next;
    const { next } = step(s, { type: 'visibilityHidden', now: 10000 });
    expect(next.phase).toBe('paused');
    if (next.phase !== 'paused') return;
    expect(next.wasVisibilityPause).toBe(true);
  });

  it('visibilityVisible on paused stays paused and prepares audio', () => {
    const s = step(start(initial(baseSession), 0), { type: 'tick', now: 3000 }).next;
    const paused = step(s, { type: 'visibilityHidden', now: 10000 }).next;
    const { next, effects } = step(paused, { type: 'visibilityVisible', now: 12000 });
    expect(next.phase).toBe('paused');
    expect(effects).toEqual([{ type: 'prepareAudio' }]);
  });

  it('stop from paused returns to idle', () => {
    const s = step(start(initial(baseSession), 0), { type: 'tick', now: 3000 }).next;
    const paused = step(s, { type: 'pause', now: 10000 }).next;
    const { next } = step(paused, { type: 'stop' });
    expect(next.phase).toBe('idle');
  });
});

describe('stop', () => {
  it('stop from any active phase returns to idle and releases wake lock', () => {
    const s = step(start(initial(baseSession), 0), { type: 'tick', now: 3000 }).next;
    const { next, effects } = step(s, { type: 'stop' });
    expect(next.phase).toBe('idle');
    expect(effects).toEqual([{ type: 'releaseWakeLock' }]);
  });
});

describe('complete state', () => {
  it('start from complete restarts a fresh countIn', () => {
    // Single-set session: countIn → work → complete.
    let s: MachineState = start(initial(singleSet), 0);
    s = step(s, { type: 'tick', now: 3000 }).next; // → work(0)
    s = step(s, { type: 'tick', now: 63000 }).next; // → complete
    expect(s.phase).toBe('complete');
    const { next } = step(s, { type: 'start', now: 100000 });
    expect(next.phase).toBe('countIn');
  });

  it('tick while complete is a no-op', () => {
    let s: MachineState = start(initial(singleSet), 0);
    s = step(s, { type: 'tick', now: 3000 }).next;
    s = step(s, { type: 'tick', now: 63000 }).next;
    const { next, effects } = step(s, { type: 'tick', now: 64000 });
    expect(next).toBe(s);
    expect(effects).toEqual([]);
  });
});

describe('edge cases', () => {
  it('1-set session completes on first work phase end, no trailing rest', () => {
    let s: MachineState = start(initial(singleSet), 0);
    s = step(s, { type: 'tick', now: 3000 }).next; // countIn → work
    expect(s.phase).toBe('work');
    s = step(s, { type: 'tick', now: 63000 }).next; // work end → complete (no rest)
    expect(s.phase).toBe('complete');
  });

  it('0-second rest skips directly from work to next work without a rest phase', () => {
    let s: MachineState = start(initial(noRest), 0);
    s = step(s, { type: 'tick', now: 3000 }).next; // → work(0)
    const { next, effects } = step(s, { type: 'tick', now: 13000 });
    expect(next.phase).toBe('work');
    if (next.phase !== 'work') return;
    expect(next.currentIdx).toBe(1);
    expect(effects).toContainEqual({ type: 'haptic', kind: 'phase' });
    expect(effects).not.toContainEqual({ type: 'beep', kind: 'phase-rest' });
  });

  it('skip during work with 0-second rest advances straight to next work', () => {
    let s: MachineState = start(initial(noRest), 0);
    s = step(s, { type: 'tick', now: 3000 }).next; // → work(0)
    const { next } = step(s, { type: 'skip', now: 5000 });
    expect(next.phase).toBe('work');
    if (next.phase !== 'work') return;
    expect(next.currentIdx).toBe(1);
  });

  it('pause during rest preserves resumePhase as rest', () => {
    let s: MachineState = start(initial(baseSession), 0);
    s = step(s, { type: 'tick', now: 3000 }).next;
    s = step(s, { type: 'tick', now: 63000 }).next; // → rest(0)
    const { next } = step(s, { type: 'pause', now: 70000 });
    expect(next.phase).toBe('paused');
    if (next.phase !== 'paused') return;
    expect(next.resumePhase).toBe('rest');
  });
});

describe('tick identity (bailout)', () => {
  it('returns the same state reference when not in the pip zone', () => {
    const s = step(start(initial(baseSession), 0), { type: 'tick', now: 3000 }).next; // → work
    // 60s work phase, at t=5000 secondsLeft = 58. Not in pip zone (≤3). Should bail out.
    const r1 = step(s, { type: 'tick', now: 5000 });
    expect(r1.next).toBe(s);
    const r2 = step(r1.next, { type: 'tick', now: 5500 });
    expect(r2.next).toBe(r1.next);
  });

  it('allocates a new state only when the pip second advances', () => {
    const s = step(start(initial(baseSession), 0), { type: 'tick', now: 3000 }).next;
    // t=60000 → secondsLeft=3, pip fires, new reference.
    const t3 = step(s, { type: 'tick', now: 60000 });
    expect(t3.next).not.toBe(s);
    // t=60500 → still secondsLeft=3, same reference.
    const t3b = step(t3.next, { type: 'tick', now: 60500 });
    expect(t3b.next).toBe(t3.next);
    // t=61000 → secondsLeft=2, new pip + new reference.
    const t2 = step(t3b.next, { type: 'tick', now: 61000 });
    expect(t2.next).not.toBe(t3.next);
  });
});

describe('derived helpers', () => {
  it('secondsLeft returns 0 when elapsed exceeds total', () => {
    let s: MachineState = start(initial(baseSession), 0);
    s = step(s, { type: 'tick', now: 3000 }).next; // → work
    if (s.phase !== 'work') throw new Error('expected work');
    expect(secondsLeft(s, 100000)).toBe(0);
  });

  it('progress clamps to [0, 1]', () => {
    let s: MachineState = start(initial(baseSession), 0);
    s = step(s, { type: 'tick', now: 3000 }).next;
    if (s.phase !== 'work') throw new Error('expected work');
    expect(progress(s, 3000)).toBe(0);
    expect(progress(s, 63000)).toBe(1);
    expect(progress(s, 100000)).toBe(1);
    expect(progress(s, 0)).toBe(0); // clamps negative
  });

  it('phaseTotalSec returns 3 for countIn, workSec for work, restSec for rest', () => {
    let s: MachineState = start(initial(baseSession), 0);
    expect(phaseTotalSec(s as ActiveState)).toBe(3);
    s = step(s, { type: 'tick', now: 3000 }).next;
    expect(phaseTotalSec(s as ActiveState)).toBe(60);
    s = step(s, { type: 'tick', now: 63000 }).next;
    expect(phaseTotalSec(s as ActiveState)).toBe(30);
  });
});
