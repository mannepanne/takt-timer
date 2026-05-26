import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/session', () => ({
  useSession: vi.fn(() => ({ session: { status: 'unauthenticated' }, refresh: vi.fn() })),
}));
vi.mock('@/lib/history', () => ({
  lastSession: vi.fn(() => null),
  appendHistory: vi.fn(),
  readHistory: vi.fn(() => []),
  clearHistory: vi.fn(),
  setHistory: vi.fn(),
}));
vi.mock('@/lib/history-sync', () => ({ pushSession: vi.fn(async () => {}) }));
vi.mock('@/lib/presets', () => ({ createPreset: vi.fn(async () => ({})) }));
vi.mock('@/lib/auth/client', () => ({
  signIn: vi.fn(async () => ({ userHandle: 'u1', isAdmin: false })),
  register: vi.fn(),
}));

import { useSession } from '@/lib/auth/session';
import { lastSession } from '@/lib/history';
import { pushSession } from '@/lib/history-sync';
import { Complete } from './Complete';

beforeEach(() => vi.clearAllMocks());

function HomeMarker() {
  return <div data-testid="home">Home</div>;
}

function RunProbe() {
  const loc = useLocation();
  return <div data-testid="run-state">{JSON.stringify(loc.state)}</div>;
}

const state = {
  totalSec: 210,
  completedAt: 1_700_000_000_000,
  session: { sets: 3, workSec: 60, restSec: 30 },
};

function renderComplete(initialState: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/complete', state: initialState }]}>
      <Routes>
        <Route path="/" element={<HomeMarker />} />
        <Route path="/complete" element={<Complete />} />
        <Route path="/run" element={<RunProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Complete route', () => {
  it('without router state, redirects to Home', () => {
    renderComplete(null);
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('renders totals and work time from router state', () => {
    renderComplete(state);
    expect(screen.getByRole('heading', { name: /nicely done/i })).toBeInTheDocument();
    expect(screen.getByText(/3 sets · 1:00 work each/i)).toBeInTheDocument();
    expect(screen.getByText('3:30')).toBeInTheDocument(); // totalSec 210
    expect(screen.getByText('3:00')).toBeInTheDocument(); // work total 180
  });

  it('Run it again navigates to /run with the same session', async () => {
    renderComplete(state);
    await userEvent.click(screen.getByRole('button', { name: /run it again/i }));
    const runState = JSON.parse(screen.getByTestId('run-state').textContent ?? '{}');
    expect(runState.session).toEqual(state.session);
  });

  it('Done navigates to Home', async () => {
    renderComplete(state);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('Close button (top bar) also navigates to Home', async () => {
    renderComplete(state);
    await userEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('shows "Save as preset" for authenticated users, not "Sign in to save"', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh: vi.fn(),
    });
    renderComplete(state);
    expect(screen.getByRole('button', { name: /save as preset/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in to save/i })).toBeNull();
  });

  it('calls pushSession on mount when authenticated and lastSession matches', async () => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh: vi.fn(),
    });
    vi.mocked(lastSession).mockReturnValue({
      completedAt: state.completedAt,
      totalSec: state.totalSec,
      sets: state.session.sets,
      workSec: state.session.workSec,
      restSec: state.session.restSec,
    });
    renderComplete(state);
    await waitFor(() => expect(pushSession).toHaveBeenCalled());
  });

  it('onSaved closes the sheet and navigates home', async () => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh: vi.fn(),
    });
    renderComplete(state);
    await userEvent.click(screen.getByRole('button', { name: /save as preset/i }));
    await userEvent.type(screen.getByRole('textbox'), 'Leg day');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument());
  });

  it('PasskeyPrompt onSuccess calls refresh and closes the prompt', async () => {
    const refresh = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'unauthenticated' },
      refresh,
    });
    renderComplete(state);
    await userEvent.click(screen.getByRole('button', { name: /sign in to save/i }));
    await userEvent.click(screen.getByRole('button', { name: /sign in with passkey/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
