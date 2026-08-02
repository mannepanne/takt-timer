// ABOUT: Tests for useStopwatchMachine — the reducer wired to the wake-lock effect runner
// ABOUT: and the visibility-reacquire listener.

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as wakeLock from '@/lib/wakeLock';

import { persistState } from './persistence';
import { useStopwatchMachine } from './useStopwatchMachine';

describe('useStopwatchMachine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useStopwatchMachine());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.getElapsedMs()).toBe(0);
  });

  it('dispatching a no-op event does not re-run effects (e.g. start() while already running)', () => {
    const acquireSpy = vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
    const { result } = renderHook(() => useStopwatchMachine());
    act(() => result.current.start());
    expect(acquireSpy).toHaveBeenCalledTimes(1);
    act(() => result.current.start());
    expect(result.current.state.phase).toBe('running');
    expect(acquireSpy).toHaveBeenCalledTimes(1);
  });

  it('start() transitions to running and acquires the wake lock under the stopwatch owner', () => {
    const acquireSpy = vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
    const { result } = renderHook(() => useStopwatchMachine());
    act(() => result.current.start());
    expect(result.current.state.phase).toBe('running');
    expect(acquireSpy).toHaveBeenCalledWith('stopwatch');
  });

  it('pause() freezes elapsed and releases the wake lock', () => {
    const releaseSpy = vi.spyOn(wakeLock, 'release').mockResolvedValue();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { result } = renderHook(() => useStopwatchMachine());
    act(() => result.current.start());
    vi.setSystemTime(5000);
    act(() => result.current.pause());
    expect(result.current.state.phase).toBe('paused');
    expect(result.current.getElapsedMs()).toBe(5000);
    expect(releaseSpy).toHaveBeenCalledWith('stopwatch');
  });

  it('resume() continues from the paused elapsed value, not from 0', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { result } = renderHook(() => useStopwatchMachine());
    act(() => result.current.start());
    vi.setSystemTime(5000);
    act(() => result.current.pause());
    vi.setSystemTime(9000);
    act(() => result.current.resume());
    expect(result.current.state.phase).toBe('running');
    expect(result.current.getElapsedMs()).toBe(5000);
    vi.setSystemTime(11_000);
    expect(result.current.getElapsedMs()).toBe(7000);
  });

  it('reset() returns to idle from any phase', () => {
    const { result } = renderHook(() => useStopwatchMachine());
    act(() => result.current.start());
    act(() => result.current.reset());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.getElapsedMs()).toBe(0);
  });

  it('getElapsedMs reflects a simulated backgrounding gap without any tick being dispatched', () => {
    // No rAF loop exists at this tier — elapsed must be correct purely from timestamps,
    // simulating the phone being locked and the JS event loop suspended for a while.
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { result } = renderHook(() => useStopwatchMachine());
    act(() => result.current.start());
    // Jump the clock forward without advancing timers/intervals — nothing "ticked".
    vi.setSystemTime(120_000);
    expect(result.current.getElapsedMs()).toBe(120_000);
  });

  it('reacquires the wake lock on visibilitychange → visible', () => {
    const reacquireSpy = vi.spyOn(wakeLock, 'reacquireIfNeeded').mockResolvedValue();
    renderHook(() => useStopwatchMachine());
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(reacquireSpy).toHaveBeenCalled();
  });

  it('does not reacquire on visibilitychange → hidden', () => {
    const reacquireSpy = vi.spyOn(wakeLock, 'reacquireIfNeeded').mockResolvedValue();
    renderHook(() => useStopwatchMachine());
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(reacquireSpy).not.toHaveBeenCalled();
  });

  it('releases the wake lock ownership on unmount without throwing', () => {
    const releaseSpy = vi.spyOn(wakeLock, 'release').mockResolvedValue();
    const { result, unmount } = renderHook(() => useStopwatchMachine());
    act(() => result.current.start());
    expect(() => unmount()).not.toThrow();
    expect(releaseSpy).toHaveBeenCalledWith('stopwatch');
  });

  describe('rehydrating from localStorage (simulates a page reload)', () => {
    it('rehydrates a running state and resumes counting from the correct elapsed time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(10_000);
      persistState({ phase: 'running', accumulatedMs: 3000, startedAtMs: 5000 });
      const { result } = renderHook(() => useStopwatchMachine());
      expect(result.current.state.phase).toBe('running');
      // accumulatedMs(3000) + (now(10_000) - startedAtMs(5000)) = 8000
      expect(result.current.getElapsedMs()).toBe(8000);
    });

    it('rehydrates a paused state frozen at the correct elapsed time', () => {
      persistState({ phase: 'paused', accumulatedMs: 42_000, startedAtMs: null });
      const { result } = renderHook(() => useStopwatchMachine());
      expect(result.current.state.phase).toBe('paused');
      expect(result.current.getElapsedMs()).toBe(42_000);
    });

    it('rehydrates an idle state as idle', () => {
      persistState({ phase: 'idle', accumulatedMs: 0, startedAtMs: null });
      const { result } = renderHook(() => useStopwatchMachine());
      expect(result.current.state.phase).toBe('idle');
      expect(result.current.getElapsedMs()).toBe(0);
    });

    it('falls back to a fresh idle state when nothing is persisted', () => {
      const { result } = renderHook(() => useStopwatchMachine());
      expect(result.current.state.phase).toBe('idle');
    });

    it('re-acquires the wake lock on mount when the rehydrated phase is running', () => {
      const acquireSpy = vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
      persistState({ phase: 'running', accumulatedMs: 0, startedAtMs: 0 });
      renderHook(() => useStopwatchMachine());
      expect(acquireSpy).toHaveBeenCalledWith('stopwatch');
    });

    it('does not acquire the wake lock on mount when the rehydrated phase is paused', () => {
      const acquireSpy = vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
      persistState({ phase: 'paused', accumulatedMs: 1000, startedAtMs: null });
      renderHook(() => useStopwatchMachine());
      expect(acquireSpy).not.toHaveBeenCalled();
    });

    it('does not acquire the wake lock on mount when the rehydrated phase is idle', () => {
      const acquireSpy = vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
      persistState({ phase: 'idle', accumulatedMs: 0, startedAtMs: null });
      renderHook(() => useStopwatchMachine());
      expect(acquireSpy).not.toHaveBeenCalled();
    });

    it('resetting then reloading stays idle — a stale running/paused state does not resurrect', () => {
      const { result, unmount } = renderHook(() => useStopwatchMachine());
      act(() => result.current.start());
      act(() => result.current.reset());
      unmount();

      const { result: reloaded } = renderHook(() => useStopwatchMachine());
      expect(reloaded.current.state.phase).toBe('idle');
      expect(reloaded.current.getElapsedMs()).toBe(0);
    });
  });
});
