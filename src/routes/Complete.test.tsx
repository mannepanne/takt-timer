import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/session', () => ({
  useSession: vi.fn(() => ({
    session: { status: 'unauthenticated' },
    refresh: vi.fn(),
    login: vi.fn(),
  })),
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
  register: vi.fn(async () => ({ userHandle: 'u1', isAdmin: false })),
}));
vi.mock('@/lib/auth/local-hint', () => ({
  hasRegisteredBefore: vi.fn(() => false),
  markRegistered: vi.fn(),
}));

import { useSession } from '@/lib/auth/session';
import { lastSession } from '@/lib/history';
import { pushSession } from '@/lib/history-sync';
import { hasRegisteredBefore } from '@/lib/auth/local-hint';
import { Complete } from './Complete';
import { I18nProvider } from '@/i18n/context';

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
    <I18nProvider>
      <MemoryRouter initialEntries={[{ pathname: '/complete', state: initialState }]}>
        <Routes>
          <Route path="/" element={<HomeMarker />} />
          <Route path="/complete" element={<Complete />} />
          <Route path="/run" element={<RunProbe />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

// The complete-actions buttons are guarded by pointer-events:none for 400ms after mount to
// prevent iOS ghost-taps from the Run → Complete navigation. Wrap the first click in waitFor
// so the test retries until the guard clears without needing fake timers.
async function clickWhenReady(name: string | RegExp) {
  await waitFor(async () => userEvent.click(screen.getByRole('button', { name })), {
    timeout: 600,
  });
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
    await clickWhenReady(/run it again/i);
    const runState = JSON.parse(screen.getByTestId('run-state').textContent ?? '{}');
    expect(runState.session).toEqual(state.session);
  });

  it('Done navigates to Home', async () => {
    renderComplete(state);
    await clickWhenReady('Done');
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
      login: vi.fn(),
    });
    renderComplete(state);
    expect(screen.getByRole('button', { name: /save as preset/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in to save/i })).toBeNull();
  });

  it('calls pushSession on mount when authenticated and lastSession matches', async () => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh: vi.fn(),
      login: vi.fn(),
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
      login: vi.fn(),
    });
    renderComplete(state);
    await clickWhenReady(/save as preset/i);
    await userEvent.type(screen.getByRole('textbox'), 'Leg day');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument());
  });

  it('PasskeyPrompt uses register mode for first-time users (no hint)', async () => {
    vi.mocked(hasRegisteredBefore).mockReturnValue(false);
    const login = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'unauthenticated' },
      refresh: vi.fn(),
      login,
    });
    renderComplete(state);
    await clickWhenReady(/sign in to save/i);
    // register mode shows "Create account with passkey"
    expect(
      screen.getByRole('button', { name: /create account with passkey/i }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /create account with passkey/i }));
    await waitFor(() => expect(login).toHaveBeenCalledWith({ userHandle: 'u1', isAdmin: false }));
  });

  it('PasskeyPrompt uses signin mode for returning users (hint present)', async () => {
    vi.mocked(hasRegisteredBefore).mockReturnValue(true);
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'unauthenticated' },
      refresh: vi.fn(),
      login: vi.fn(),
    });
    renderComplete(state);
    await clickWhenReady(/sign in to save/i);
    // signin mode shows "Sign in with passkey"
    expect(screen.getByRole('button', { name: /sign in with passkey/i })).toBeInTheDocument();
  });
});
