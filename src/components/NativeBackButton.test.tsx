// ABOUT: Tests for the native hardware back-button handler (07g) — confirm-before-leave on an
// ABOUT: active interval session, exit-app at root, navigate-back on deeper screens, and web no-op.

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/context';
import { isNativePlatform } from '@/lib/platform';

import { NativeBackButton } from './NativeBackButton';

vi.mock('@/lib/platform', () => ({ isNativePlatform: vi.fn(() => true) }));

let backHandler: (() => void) | null = null;
const exitApp = vi.fn();
vi.mock('@/lib/app-lifecycle', () => ({
  subscribeBackButton: (h: () => void) => {
    backHandler = h;
    return () => {
      backHandler = null;
    };
  },
  exitApp: () => exitApp(),
}));

import type { RunSession } from '@/lib/interval-active';

const pause = vi.fn();
const resume = vi.fn();
const sessionRef: { current: RunSession | null } = { current: null };
vi.mock('@/lib/interval-active', () => ({ useRunSessionRef: () => sessionRef }));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="path">{loc.pathname}</div>;
}

function renderAt(entries: string[], index = entries.length - 1) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={entries} initialIndex={index}>
        <NativeBackButton />
        <LocationProbe />
        <Routes>
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  backHandler = null;
  sessionRef.current = null;
  pause.mockClear();
  resume.mockClear();
  vi.mocked(isNativePlatform).mockReturnValue(true);
  exitApp.mockClear();
});

const runningSession = (): RunSession => ({ running: true, pause, resume });
const pausedSession = (): RunSession => ({ running: false, pause, resume });

function pressBack() {
  act(() => backHandler?.());
}

describe('NativeBackButton', () => {
  it('registers a back-button listener on native', () => {
    renderAt(['/']);
    expect(backHandler).toBeTypeOf('function');
  });

  it('does not register on web (no hardware back button)', () => {
    vi.mocked(isNativePlatform).mockReturnValue(false);
    renderAt(['/']);
    expect(backHandler).toBeNull();
  });

  it('at root with no active session, back exits the app', () => {
    renderAt(['/']);
    pressBack();
    expect(exitApp).toHaveBeenCalled();
  });

  it('on a deeper screen, back navigates back rather than exiting', () => {
    renderAt(['/', '/timer'], 1);
    expect(screen.getByTestId('path')).toHaveTextContent('/timer');
    pressBack();
    expect(screen.getByTestId('path')).toHaveTextContent('/');
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('with a running interval session, back pauses it and opens a confirm dialog instead of leaving', () => {
    sessionRef.current = runningSession();
    renderAt(['/run']);
    pressBack();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/leave your session/i)).toBeInTheDocument();
    expect(pause).toHaveBeenCalledTimes(1); // paused so it doesn't advance/beep behind the dialog
    expect(exitApp).not.toHaveBeenCalled();
    expect(screen.getByTestId('path')).toHaveTextContent('/run'); // did not navigate yet
  });

  it('an already-paused session still confirms, but does not pause again', () => {
    sessionRef.current = pausedSession();
    renderAt(['/run']);
    pressBack();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(pause).not.toHaveBeenCalled();
  });

  it('confirming "Leave session" navigates home and does not resume', async () => {
    sessionRef.current = runningSession();
    renderAt(['/run']);
    pressBack();
    await userEvent.click(screen.getByRole('button', { name: /leave session/i }));
    expect(screen.getByTestId('path')).toHaveTextContent('/');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(resume).not.toHaveBeenCalled();
  });

  it('"Keep going" resumes the timer we paused and stays put', async () => {
    sessionRef.current = runningSession();
    renderAt(['/run']);
    pressBack();
    await userEvent.click(screen.getByRole('button', { name: /keep going/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/run');
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('"Keep going" does NOT resume a session that was already paused before back', async () => {
    sessionRef.current = pausedSession();
    renderAt(['/run']);
    pressBack();
    await userEvent.click(screen.getByRole('button', { name: /keep going/i }));
    expect(resume).not.toHaveBeenCalled();
  });

  it('back while the confirm dialog is open dismisses it and resumes (does not exit)', () => {
    sessionRef.current = runningSession();
    renderAt(['/run']);
    pressBack(); // opens dialog, pauses
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    pressBack(); // dismisses it, resumes
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(exitApp).not.toHaveBeenCalled();
    expect(screen.getByTestId('path')).toHaveTextContent('/run');
  });

  it('the interval confirm wins in the concurrent case (stopwatch running + interval active)', () => {
    // Only Run publishes the session, so a running stopwatch elsewhere is irrelevant here — the
    // presence of a session is what triggers the confirm, never a silent exit.
    sessionRef.current = runningSession();
    renderAt(['/run']);
    pressBack();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(exitApp).not.toHaveBeenCalled();
  });
});
