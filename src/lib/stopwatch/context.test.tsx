// ABOUT: Unit tests for StopwatchProvider, useStopwatch, and useElapsedMs.

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StopwatchProvider, useElapsedMs, useStopwatch } from './context';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StopwatchProvider>{children}</StopwatchProvider>
);

describe('useStopwatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('throws when used outside StopwatchProvider', () => {
    expect(() => renderHook(() => useStopwatch())).toThrow(
      'useStopwatch must be used inside StopwatchProvider',
    );
  });

  it('exposes phase and controls', () => {
    const { result } = renderHook(() => useStopwatch(), { wrapper });
    expect(result.current.phase).toBe('idle');
    act(() => result.current.start());
    expect(result.current.phase).toBe('running');
    act(() => result.current.pause());
    expect(result.current.phase).toBe('paused');
    act(() => result.current.reset());
    expect(result.current.phase).toBe('idle');
  });
});

describe('useElapsedMs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('is 0 before the stopwatch starts', () => {
    const { result } = renderHook(() => useElapsedMs(1000), { wrapper });
    expect(result.current).toBe(0);
  });

  it('polls at the given cadence while running', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { result } = renderHook(
      () => {
        const sw = useStopwatch();
        const elapsed = useElapsedMs(1000);
        return { sw, elapsed };
      },
      { wrapper },
    );
    act(() => result.current.sw.start());
    act(() => {
      vi.setSystemTime(2500);
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.elapsed).toBeGreaterThanOrEqual(1000);
  });

  it('freezes immediately on pause rather than waiting for the next poll', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { result } = renderHook(
      () => {
        const sw = useStopwatch();
        const elapsed = useElapsedMs(1000);
        return { sw, elapsed };
      },
      { wrapper },
    );
    act(() => result.current.sw.start());
    act(() => {
      vi.setSystemTime(3000);
      result.current.sw.pause();
    });
    expect(result.current.elapsed).toBe(3000);
    act(() => {
      vi.setSystemTime(9000);
      vi.advanceTimersByTime(2000);
    });
    // No interval runs while paused, so the value stays frozen even as time passes.
    expect(result.current.elapsed).toBe(3000);
  });

  it('resyncs to 0 immediately on reset rather than waiting for the next poll', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { result } = renderHook(
      () => {
        const sw = useStopwatch();
        const elapsed = useElapsedMs(1000);
        return { sw, elapsed };
      },
      { wrapper },
    );
    act(() => result.current.sw.start());
    act(() => vi.setSystemTime(4000));
    act(() => result.current.sw.reset());
    expect(result.current.elapsed).toBe(0);
  });
});
