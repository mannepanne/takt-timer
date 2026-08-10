// ABOUT: Tests for the Timer route — Start/Pause/Resume/Reset, and back navigation.

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/context';
import { isNativePlatform } from '@/lib/platform';
import { StopwatchProvider } from '@/lib/stopwatch/context';
import { persistState } from '@/lib/stopwatch/persistence';
import * as wakeLock from '@/lib/wakeLock';

import { Timer } from './Timer';

vi.mock('@/lib/platform', () => ({ isNativePlatform: vi.fn(() => false) }));

// A fake navigator.wakeLock for the integration test that exercises the real wakeLock module
// (owner set + reacquire) rather than spying its functions. Mirrors src/lib/wakeLock.test.ts.
function createFakeSentinel() {
  const listeners: Array<() => void> = [];
  return {
    released: false,
    release: vi.fn(async function (this: { released: boolean }) {
      this.released = true;
    }),
    addEventListener: vi.fn((_type: 'release', cb: () => void) => listeners.push(cb)),
    _fireRelease() {
      listeners.forEach((l) => l());
    },
  };
}

function installWakeLock(
  request: (type: 'screen') => Promise<ReturnType<typeof createFakeSentinel>>,
) {
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
}

function uninstallWakeLock() {
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <StopwatchProvider>{children}</StopwatchProvider>
    </I18nProvider>
  );
}

function LocationProbe() {
  const loc = useLocation();
  return <pre data-testid="path">{loc.pathname}</pre>;
}

function renderTimer() {
  return render(
    <MemoryRouter initialEntries={['/timer']}>
      <Routes>
        <Route path="/timer" element={<Timer />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
    { wrapper },
  );
}

describe('Timer route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(isNativePlatform).mockReturnValue(false);
    vi.useRealTimers();
    localStorage.clear();
    wakeLock.__resetWakeLockForTest();
    uninstallWakeLock();
  });

  it('shows 0:00 and a Start button when idle', () => {
    renderTimer();
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('Start begins counting up', () => {
    vi.useFakeTimers();
    renderTimer();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('0:05')).toBeInTheDocument();
  });

  it('Pause freezes the display exactly where it was', () => {
    vi.useFakeTimers();
    renderTimer();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    act(() => vi.advanceTimersByTime(7000));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    expect(screen.getByText('0:07')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(13_000));
    expect(screen.getByText('0:07')).toBeInTheDocument();
  });

  it('Resume continues from the paused value, not from 0', () => {
    vi.useFakeTimers();
    renderTimer();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    act(() => vi.advanceTimersByTime(7000));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    act(() => vi.advanceTimersByTime(23_000)); // time passes while paused, elapsed unaffected
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Resume' })));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('0:08')).toBeInTheDocument();
  });

  it('Reset returns to 0:00 idle from a running state', () => {
    vi.useFakeTimers();
    renderTimer();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    act(() => vi.advanceTimersByTime(12_000));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Reset' })));
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('Reset returns to 0:00 idle from a paused state', () => {
    vi.useFakeTimers();
    renderTimer();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    act(() => vi.advanceTimersByTime(12_000));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Reset' })));
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('the back chevron navigates to Home', async () => {
    const user = userEvent.setup();
    renderTimer();
    await user.click(screen.getByRole('link', { name: 'Back to Home' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/');
  });

  it('the progress ring is decorative (aria-hidden)', () => {
    renderTimer();
    expect(document.querySelector('svg.progress-ring')).toHaveAttribute('aria-hidden', 'true');
  });

  it('elapsed digits are not aria-live', () => {
    renderTimer();
    expect(screen.getByText('0:00')).not.toHaveAttribute('aria-live');
  });

  describe('screen keep-awake while the Timer screen is shown (07e native, #131 web)', () => {
    // Platform-independent: the Timer.tsx screen-scoped hold is no longer gated on isNativePlatform,
    // so these run on the default (web) path — the case #131 fixes. Native behaves identically (the
    // keep-awake backing is covered in wakeLock-platform-native.test.ts).

    it('holds the screen on mount when the stopwatch is ALREADY running (rehydrated), with no click', () => {
      // The load-bearing path: the launch re-acquire in useStopwatchMachine is gone, so when the
      // user reopens the app to a still-running stopwatch and lands on the Timer screen, Timer.tsx's
      // mount effect is the ONLY thing keeping the screen on. If this regresses the screen sleeps
      // mid-set and the suite would otherwise stay green.
      persistState({ phase: 'running', accumulatedMs: 0, startedAtMs: 0 });
      const acquireSpy = vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
      renderTimer();
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument(); // rehydrated running
      expect(acquireSpy).toHaveBeenCalledWith('stopwatch-screen');
    });

    it('holds the screen (stopwatch-screen owner) while running on this screen, releasing on leave', () => {
      const acquireSpy = vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
      const releaseSpy = vi.spyOn(wakeLock, 'release').mockResolvedValue();
      const { unmount } = renderTimer();

      act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
      expect(acquireSpy).toHaveBeenCalledWith('stopwatch-screen');

      // Leaving the Timer screen must drop the screen-scoped hold so a running stopwatch can't
      // pin the screen awake on Home/Settings/presets.
      releaseSpy.mockClear();
      unmount();
      expect(releaseSpy).toHaveBeenCalledWith('stopwatch-screen');
    });

    it('releases the screen hold when the running stopwatch is paused on this screen', () => {
      vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
      const releaseSpy = vi.spyOn(wakeLock, 'release').mockResolvedValue();
      renderTimer();
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
      releaseSpy.mockClear();
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
      expect(releaseSpy).toHaveBeenCalledWith('stopwatch-screen');
    });

    it('web now scopes the hold to the Timer screen — the #131 fix (was: web never touched it)', () => {
      // Before #131 the web Timer made no stopwatch-screen calls and relied on the launch
      // re-acquire, which pinned the screen on Home. Now web uses the same screen-scoped owner as
      // native, so starting a stopwatch here acquires it and leaving releases it.
      const acquireSpy = vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
      const releaseSpy = vi.spyOn(wakeLock, 'release').mockResolvedValue();
      const { unmount } = renderTimer();
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
      expect(acquireSpy).toHaveBeenCalledWith('stopwatch-screen');
      unmount();
      expect(releaseSpy).toHaveBeenCalledWith('stopwatch-screen');
    });

    it('a rehydrated running stopwatch reacquires the screen lock on hide→visible (via stopwatch-screen)', async () => {
      // The one place web ≠ native: navigator.wakeLock auto-releases on tab-hide (keep-awake never
      // does). With the launch re-acquire gone, the reacquire-on-return is carried SOLELY by the
      // stopwatch-screen owner. This exercises the real wakeLock module (owner set + reacquire),
      // not a spy, to prove the owner is present so the reacquire actually re-requests the lock.
      let calls = 0;
      const first = createFakeSentinel();
      const second = createFakeSentinel();
      installWakeLock(async () => (calls++ === 0 ? first : second));
      persistState({ phase: 'running', accumulatedMs: 0, startedAtMs: 0 });
      renderTimer();

      // Mount acquired the screen lock once (rehydrated running, shown on Timer).
      await act(async () => {});
      expect(calls).toBe(1);

      // Browser auto-releases on hide, then the tab returns to visible.
      act(() => first._fireRelease());
      await act(async () => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(calls).toBe(2); // reacquired because stopwatch-screen is still an owner
    });
  });
});
