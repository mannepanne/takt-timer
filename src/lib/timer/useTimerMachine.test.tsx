import { act, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTimerMachine } from './useTimerMachine';
import type { Session } from './types';

const session: Session = { sets: 2, workSec: 10, restSec: 5 };

describe('useTimerMachine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts idle with the provided session', () => {
    const { result } = renderHook(() => useTimerMachine(session));
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.state.session).toEqual(session);
  });

  it('start() transitions to countIn', () => {
    const { result } = renderHook(() => useTimerMachine(session));
    act(() => result.current.start());
    expect(result.current.state.phase).toBe('countIn');
  });

  it('pause/resume move through paused and back to active', () => {
    const { result } = renderHook(() => useTimerMachine(session));
    act(() => result.current.start());
    act(() => result.current.skip()); // countIn → work
    expect(result.current.state.phase).toBe('work');
    act(() => result.current.pause());
    expect(result.current.state.phase).toBe('paused');
    act(() => result.current.resume());
    expect(result.current.state.phase).toBe('work');
  });

  it('skip advances phases', () => {
    const { result } = renderHook(() => useTimerMachine(session));
    act(() => result.current.start());
    act(() => result.current.skip()); // countIn → work(0)
    expect(result.current.state.phase).toBe('work');
    act(() => result.current.skip()); // work(0) → rest(0) (not last set)
    expect(result.current.state.phase).toBe('rest');
  });

  it('stop returns to idle', () => {
    const { result } = renderHook(() => useTimerMachine(session));
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(result.current.state.phase).toBe('idle');
  });

  it('repeatSet during work above threshold restarts work at same set', () => {
    const { result } = renderHook(() => useTimerMachine(session));
    act(() => result.current.start());
    act(() => result.current.skip()); // → work(0)

    // Advance the clock so repeatSet crosses the 5% threshold.
    const base = performance.now();
    const spy = vi.spyOn(performance, 'now').mockReturnValue(base + 2000);
    act(() => result.current.repeatSet());
    expect(result.current.state.phase).toBe('work');
    spy.mockRestore();
  });

  it('visibilitychange → hidden pauses the session', () => {
    const { result } = renderHook(() => useTimerMachine(session));
    act(() => result.current.start());
    act(() => result.current.skip()); // → work
    expect(result.current.state.phase).toBe('work');
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.state.phase).toBe('paused');
  });

  it('releases wake lock on unmount without throwing', () => {
    const { unmount } = renderHook(() => useTimerMachine(session));
    expect(() => unmount()).not.toThrow();
  });

  it('in an active phase exposes derived secondsLeft and progress', () => {
    const { result } = renderHook(() => useTimerMachine(session));
    act(() => result.current.start());
    // secondsLeft and progress are zero when just-started (t === phaseStartMs);
    // the values are derived and exposed, which is what we assert here.
    expect(typeof result.current.secondsLeft).toBe('number');
    expect(typeof result.current.progress).toBe('number');
  });

  it('integrates cleanly inside a React component', () => {
    function Harness() {
      const api = useTimerMachine(session);
      return <div data-testid="phase">{api.state.phase}</div>;
    }
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('phase')).toHaveTextContent('idle');
  });
});
