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
vi.mock('@/lib/history-sync', () => ({ importLocalHistory: vi.fn().mockResolvedValue(0) }));
vi.mock('@/components/PasskeyPrompt', () => ({
  PasskeyPrompt: ({
    open,
    mode,
    onSuccess,
  }: {
    open: boolean;
    mode: string;
    onSuccess: (u: unknown) => void;
  }) =>
    open ? (
      <div data-testid="passkey-prompt" data-mode={mode}>
        <button onClick={() => onSuccess({ userHandle: 'u1', isAdmin: false })}>confirm</button>
      </div>
    ) : null,
}));
vi.mock('@/components/PresetsDrawer', () => ({
  PresetsDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="presets-drawer" /> : null,
}));

import { useSession } from '@/lib/auth/session';
import { apiFetch } from '@/lib/apiFetch';
import { importLocalHistory } from '@/lib/history-sync';
import { Home } from './Home';

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
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/configure" element={<div data-testid="config">configure</div>} />
        <Route path="/run" element={<LocProbe />} />
      </Routes>
    </MemoryRouter>,
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

  it('shows account link and fetches last session for authenticated users', async () => {
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
    expect(screen.getByRole('link', { name: /account/i })).toBeInTheDocument();
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

  it('unauthenticated users see a sign in or create account button', () => {
    renderHome();
    expect(screen.getByRole('button', { name: /sign in or create account/i })).toBeInTheDocument();
  });

  it('auth button opens PasskeyPrompt in discover mode', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /sign in or create account/i }));
    expect(screen.getByTestId('passkey-prompt')).toHaveAttribute('data-mode', 'discover');
  });

  it('on register success calls login immediately then imports history in background', async () => {
    const login = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'unauthenticated' },
      refresh: vi.fn(),
      login,
    });
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /sign in or create account/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(login).toHaveBeenCalledWith({ userHandle: 'u1', isAdmin: false });
    await waitFor(() => expect(importLocalHistory).toHaveBeenCalled());
  });

  it('on register success calls login even when importLocalHistory throws', async () => {
    const login = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'unauthenticated' },
      refresh: vi.fn(),
      login,
    });
    vi.mocked(importLocalHistory).mockRejectedValueOnce(new Error('network'));
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /sign in or create account/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(login).toHaveBeenCalledWith({ userHandle: 'u1', isAdmin: false });
    await waitFor(() => expect(importLocalHistory).toHaveBeenCalled());
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
});
