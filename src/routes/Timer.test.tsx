// ABOUT: Tests for the Timer route — Start/Pause/Resume/Reset, and back navigation.

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/context';
import { isNativePlatform } from '@/lib/platform';
import { StopwatchProvider } from '@/lib/stopwatch/context';
import * as wakeLock from '@/lib/wakeLock';

import { Timer } from './Timer';

vi.mock('@/lib/platform', () => ({ isNativePlatform: vi.fn(() => false) }));

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

  describe('native screen keep-awake (07e stale-lock policy)', () => {
    it('holds the screen (stopwatch-screen owner) while running on this screen, releasing on leave', () => {
      vi.mocked(isNativePlatform).mockReturnValue(true);
      const acquireSpy = vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
      const releaseSpy = vi.spyOn(wakeLock, 'release').mockResolvedValue();
      const { unmount } = renderTimer();

      act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
      expect(acquireSpy).toHaveBeenCalledWith('stopwatch-screen');

      // Leaving the Timer screen must drop the screen-scoped hold so a running stopwatch can't
      // pin the screen awake on Settings/presets.
      releaseSpy.mockClear();
      unmount();
      expect(releaseSpy).toHaveBeenCalledWith('stopwatch-screen');
    });

    it('releases the screen hold when the running stopwatch is paused on this screen', () => {
      vi.mocked(isNativePlatform).mockReturnValue(true);
      vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
      const releaseSpy = vi.spyOn(wakeLock, 'release').mockResolvedValue();
      renderTimer();
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
      releaseSpy.mockClear();
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
      expect(releaseSpy).toHaveBeenCalledWith('stopwatch-screen');
    });

    it('does not touch the screen-scoped owner on web — navigator.wakeLock path is unchanged', () => {
      // isNativePlatform() defaults to false (web); the Timer screen must make no stopwatch-screen
      // wake-lock calls, leaving the shared reducer/useStopwatchMachine path byte-identical.
      const acquireSpy = vi.spyOn(wakeLock, 'acquire').mockResolvedValue();
      const releaseSpy = vi.spyOn(wakeLock, 'release').mockResolvedValue();
      const { unmount } = renderTimer();
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
      unmount();
      expect(acquireSpy).not.toHaveBeenCalledWith('stopwatch-screen');
      expect(releaseSpy).not.toHaveBeenCalledWith('stopwatch-screen');
    });
  });
});
