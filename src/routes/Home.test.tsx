// ABOUT: Tests for the Home screen — mic button, Configure CTA, sparkline, last-session card, presets.

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/session', () => ({
  useSession: vi.fn(() => ({
    session: { status: 'unauthenticated' },
    refresh: vi.fn(),
    login: vi.fn(),
  })),
}));
vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/platform', () => ({ isNativePlatform: vi.fn(() => false) }));
vi.mock('@/components/PresetsDrawer', () => ({
  PresetsDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="presets-drawer" /> : null,
}));

import { useSession } from '@/lib/auth/session';
import { apiFetch } from '@/lib/apiFetch';
import { isNativePlatform } from '@/lib/platform';
import { Home } from './Home';
import { I18nProvider } from '@/i18n/context';
import { StopwatchProvider, useStopwatch } from '@/lib/stopwatch/context';

function LocProbe() {
  const loc = useLocation();
  return (
    <div data-testid="loc">
      {loc.pathname}
      {loc.state ? ':' + JSON.stringify(loc.state) : ''}
    </div>
  );
}

function renderHome() {
  return render(
    <I18nProvider>
      <StopwatchProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/configure" element={<div data-testid="config">configure</div>} />
            <Route path="/timer" element={<div data-testid="timer">timer</div>} />
            <Route path="/run" element={<LocProbe />} />
          </Routes>
        </MemoryRouter>
      </StopwatchProvider>
    </I18nProvider>,
  );
}

describe('Home', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(isNativePlatform).mockReturnValue(false);
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'unauthenticated' },
      refresh: vi.fn(),
      login: vi.fn(),
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('renders the prompt and mic button', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: /what cadence do you need/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start voice input/i })).toBeInTheDocument();
  });

  it('Configure CTA navigates to /configure', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('link', { name: /no voice/i }));
    expect(screen.getByTestId('config')).toBeInTheDocument();
  });

  it('Timer link navigates to /timer and shows the plain label while idle', async () => {
    renderHome();
    const link = screen.getByRole('link', { name: 'Timer' });
    expect(link).toBeInTheDocument();
    await userEvent.click(link);
    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });

  it('Timer link shows and advances the running elapsed time while non-idle', () => {
    function StartsStopwatch() {
      const { start } = useStopwatch();
      useEffect(() => start(), [start]);
      return null;
    }

    vi.useFakeTimers();
    render(
      <I18nProvider>
        <StopwatchProvider>
          <StartsStopwatch />
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<Home />} />
            </Routes>
          </MemoryRouter>
        </StopwatchProvider>
      </I18nProvider>,
    );

    expect(screen.getByRole('link', { name: 'Timer · 0:00' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('link', { name: 'Timer · 0:04' })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('without any history, does not render the last-session card or sparkline', () => {
    renderHome();
    expect(screen.queryByText(/last session/i)).toBeNull();
    expect(screen.queryByText(/sessions so far/i)).toBeNull();
  });

  it('with history, renders sparkline chip and last-session card', () => {
    localStorage.setItem(
      'takt.history.v1',
      JSON.stringify([{ completedAt: 1, totalSec: 180, sets: 3, workSec: 60, restSec: 0 }]),
    );
    renderHome();
    expect(screen.getByText(/1 session so far/i)).toBeInTheDocument();
    expect(screen.getByText(/last session/i)).toBeInTheDocument();
  });

  it('tapping the last-session card re-runs that session via /run', async () => {
    localStorage.setItem(
      'takt.history.v1',
      JSON.stringify([{ completedAt: 1, totalSec: 180, sets: 3, workSec: 60, restSec: 30 }]),
    );
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /last session/i }));
    const probe = screen.getByTestId('loc');
    expect(probe.textContent).toContain('/run');
    expect(probe.textContent).toContain('"sets":3');
  });

  it('Privacy link is present in the footer', () => {
    renderHome();
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
  });

  it('settings link is always visible in the top bar', () => {
    renderHome();
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
  });

  it('fetches last session for authenticated users', async () => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh: vi.fn(),
      login: vi.fn(),
    });
    const serverSession = {
      completed_at: 1700000000,
      total_sec: 300,
      sets: 3,
      work_sec: 60,
      rest_sec: 30,
    };
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => serverSession,
    } as Response);
    renderHome();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/sessions?latest=1'));
  });

  it('never fetches on native, even in the impossible native-and-authenticated state (07c gate)', async () => {
    // Forces the platform gate to matter: without `isNativePlatform() ||`, an authenticated session
    // would fire the fetch — so this test fails if that guard is removed (non-vacuous).
    vi.mocked(isNativePlatform).mockReturnValue(true);
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh: vi.fn(),
      login: vi.fn(),
    });
    vi.mocked(apiFetch).mockClear(); // beforeEach doesn't clear call history; ignore prior tests' calls
    renderHome();
    await Promise.resolve();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('surfaces the presets entry on native even when unauthenticated (07d)', () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    // useSession stays unauthenticated (beforeEach) — presets are device-local, no auth gate.
    renderHome();
    expect(screen.getByRole('button', { name: /open presets/i })).toBeInTheDocument();
  });

  it('hides the presets entry on web when unauthenticated', () => {
    renderHome();
    expect(screen.queryByRole('button', { name: /open presets/i })).not.toBeInTheDocument();
  });

  it('does not show sparkline for authenticated users (server source instead)', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh: vi.fn(),
      login: vi.fn(),
    });
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: false } as Response);
    localStorage.setItem(
      'takt.history.v1',
      JSON.stringify([{ completedAt: 1, totalSec: 180, sets: 3, workSec: 60, restSec: 0 }]),
    );
    renderHome();
    expect(screen.queryByText(/sessions so far/i)).toBeNull();
  });

  it('authenticated users see an Open presets button', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh: vi.fn(),
      login: vi.fn(),
    });
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: false } as Response);
    renderHome();
    expect(screen.getByRole('button', { name: /open presets/i })).toBeInTheDocument();
  });

  it('Open presets button renders the PresetsDrawer', async () => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh: vi.fn(),
      login: vi.fn(),
    });
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: false } as Response);
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /open presets/i }));
    expect(screen.getByTestId('presets-drawer')).toBeInTheDocument();
  });

  it('unauthenticated users do not see the presets button', () => {
    renderHome();
    expect(screen.queryByRole('button', { name: /open presets/i })).toBeNull();
  });
});
