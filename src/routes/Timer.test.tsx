// ABOUT: Tests for the Timer route — Start/Pause/Resume/Reset, and back navigation.

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/context';
import { StopwatchProvider } from '@/lib/stopwatch/context';

import { Timer } from './Timer';

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
});
