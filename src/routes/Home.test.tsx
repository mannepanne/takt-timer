// ABOUT: Tests for the Home screen — mic button, Configure CTA, sparkline, last-session card, presets.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
vi.mock('@/components/PresetsDrawer', () => ({
  PresetsDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="presets-drawer" /> : null,
}));

import { useSession } from '@/lib/auth/session';
import { apiFetch } from '@/lib/apiFetch';
import { Home } from './Home';
import { I18nProvider } from '@/i18n/context';

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
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/configure" element={<div data-testid="config">configure</div>} />
          <Route path="/run" element={<LocProbe />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('Home', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'unauthenticated' },
      refresh: vi.fn(),
      login: vi.fn(),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the prompt and mic button', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: /what cadence do you need/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start voice input/i })).toBeInTheDocument();
  });

  it('Configure CTA navigates to /configure', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('link', { name: /configure a session/i }));
    expect(screen.getByTestId('config')).toBeInTheDocument();
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
