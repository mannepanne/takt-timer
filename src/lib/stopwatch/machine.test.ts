// ABOUT: Exhaustive tests for the stopwatch state machine.
// ABOUT: Every cell of the event×state matrix in SPECIFICATIONS/timer-mode.md has a test here.

import { describe, expect, it } from 'vitest';

import { elapsedMs, initial, ringProgress, step } from './machine';
import type { MachineState } from './types';

const idle = (): MachineState => initial();
const running = (accumulatedMs: number, startedAtMs: number): MachineState => ({
  phase: 'running',
  accumulatedMs,
  startedAtMs,
});
const paused = (accumulatedMs: number): MachineState => ({
  phase: 'paused',
  accumulatedMs,
  startedAtMs: null,
});

describe('initial()', () => {
  it('returns an idle, zeroed state', () => {
    expect(initial()).toEqual({ phase: 'idle', accumulatedMs: 0, startedAtMs: null });
  });
});

describe('start', () => {
  it('idle → running, startedAtMs = now, accumulatedMs = 0', () => {
    const { next, effects } = step(idle(), { type: 'start', now: 1000 });
    expect(next).toEqual({ phase: 'running', accumulatedMs: 0, startedAtMs: 1000 });
    expect(effects).toEqual([{ type: 'acquireWakeLock' }]);
  });

  it('running → no-op', () => {
    const state = running(500, 1000);
    const { next, effects } = step(state, { type: 'start', now: 2000 });
    expect(next).toBe(state);
    expect(effects).toEqual([]);
  });

  it('paused → no-op (unreachable in the UI, but specified rather than left undefined)', () => {
    const state = paused(500);
    const { next, effects } = step(state, { type: 'start', now: 2000 });
    expect(next).toBe(state);
    expect(effects).toEqual([]);
  });
});

describe('pause', () => {
  it('idle → no-op', () => {
    const state = idle();
    const { next, effects } = step(state, { type: 'pause', now: 1000 });
    expect(next).toBe(state);
    expect(effects).toEqual([]);
  });

  it('running → paused, accumulatedMs += now - startedAtMs', () => {
    const state = running(0, 1000);
    const { next, effects } = step(state, { type: 'pause', now: 4000 });
    expect(next).toEqual({ phase: 'paused', accumulatedMs: 3000, startedAtMs: null });
    expect(effects).toEqual([{ type: 'releaseWakeLock' }]);
  });

  it('running with prior accumulated time → folds both together', () => {
    const state = running(10_000, 20_000);
    const { next } = step(state, { type: 'pause', now: 25_000 });
    expect(next).toEqual({ phase: 'paused', accumulatedMs: 15_000, startedAtMs: null });
  });

  it('paused → no-op', () => {
    const state = paused(3000);
    const { next, effects } = step(state, { type: 'pause', now: 5000 });
    expect(next).toBe(state);
    expect(effects).toEqual([]);
  });
});

describe('resume', () => {
  it('idle → no-op', () => {
    const state = idle();
    const { next, effects } = step(state, { type: 'resume', now: 1000 });
    expect(next).toBe(state);
    expect(effects).toEqual([]);
  });

  it('running → no-op', () => {
    const state = running(0, 1000);
    const { next, effects } = step(state, { type: 'resume', now: 2000 });
    expect(next).toBe(state);
    expect(effects).toEqual([]);
  });

  it('paused → running, continues from the paused accumulatedMs, not 0', () => {
    const state = paused(3000);
    const { next, effects } = step(state, { type: 'resume', now: 9000 });
    expect(next).toEqual({ phase: 'running', accumulatedMs: 3000, startedAtMs: 9000 });
    expect(effects).toEqual([{ type: 'acquireWakeLock' }]);
  });
});

describe('reset', () => {
  it('idle → no-op (already idle)', () => {
    const state = idle();
    const { next, effects } = step(state, { type: 'reset' });
    expect(next).toBe(state);
    expect(effects).toEqual([]);
  });

  it('running → idle, zeroed, releases the wake lock', () => {
    const state = running(10_000, 20_000);
    const { next, effects } = step(state, { type: 'reset' });
    expect(next).toEqual({ phase: 'idle', accumulatedMs: 0, startedAtMs: null });
    expect(effects).toEqual([{ type: 'releaseWakeLock' }]);
  });

  it('paused → idle, zeroed, no further wake-lock effect (already released on pause)', () => {
    const state = paused(45_000);
    const { next, effects } = step(state, { type: 'reset' });
    expect(next).toEqual({ phase: 'idle', accumulatedMs: 0, startedAtMs: null });
    expect(effects).toEqual([]);
  });
});

describe('elapsedMs — clamp at zero on a backwards clock step', () => {
  it('is accumulatedMs + (now - startedAtMs) while running', () => {
    expect(elapsedMs(running(1000, 5000), 8000)).toBe(4000);
  });

  it('clamps to zero rather than going negative when now < startedAtMs', () => {
    // Simulates an NTP/manual clock correction stepping the clock backwards mid-run.
    expect(elapsedMs(running(0, 10_000), 3_000)).toBe(0);
  });

  it('clamps only the current stint, preserving accumulatedMs from a prior pause/resume', () => {
    // A backward jump big enough to make (now - startedAtMs) more negative than
    // accumulatedMs must not wipe out real elapsed time earned before this stint.
    expect(elapsedMs(running(100_000, 500_000), 300_000)).toBe(100_000);
  });

  it('is just accumulatedMs while paused (startedAtMs is null)', () => {
    expect(elapsedMs(paused(12_345), 99_999)).toBe(12_345);
  });

  it('is 0 while idle', () => {
    expect(elapsedMs(idle(), 5000)).toBe(0);
  });
});

describe('ringProgress — one revolution per hour, wraps past 60:00', () => {
  it('is 0 at 0:00', () => {
    expect(ringProgress(0)).toBe(0);
  });

  it('is 0.5 at 30:00', () => {
    expect(ringProgress(30 * 60 * 1000)).toBe(0.5);
  });

  it('wraps to a new revolution past 60:00 rather than exceeding 1', () => {
    const oneHourOneMinute = (60 + 1) * 60 * 1000;
    expect(ringProgress(oneHourOneMinute)).toBeCloseTo(1 / 60, 10);
  });

  it('wraps again past two full hours', () => {
    const twoHoursFifteen = (120 + 15) * 60 * 1000;
    expect(ringProgress(twoHoursFifteen)).toBeCloseTo(15 / 60, 10);
  });
});
