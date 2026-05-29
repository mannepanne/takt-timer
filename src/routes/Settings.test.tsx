// ABOUT: Integration tests for the Settings route — language, accent, sound, account management, about.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/context';
import { SettingsProvider } from '@/lib/settings/context';
import { Settings } from './Settings';

vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth/client', () => ({
  getMe: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/lib/auth/local-hint', () => ({
  hasRegisteredBefore: vi.fn(() => false),
  markUnregistered: vi.fn(),
}));
vi.mock('@/lib/history', () => ({ clearHistory: vi.fn() }));
vi.mock('@/lib/history-sync', () => ({ importLocalHistory: vi.fn().mockResolvedValue(0) }));
vi.mock('@/lib/auth/session', () => ({
  useSession: vi.fn(() => ({
    session: { status: 'unauthenticated' },
    refresh: vi.fn(),
    login: vi.fn(),
  })),
}));
vi.mock('@/components/PasskeyPrompt', () => ({
  PasskeyPrompt: ({
    open,
    mode,
    onSuccess,
  }: {
    open: boolean;
    mode: string;
    onSuccess: (u: { userHandle: string; isAdmin: boolean }) => void;
  }) =>
    open ? (
      <div data-testid="passkey-prompt" data-mode={mode}>
        <button onClick={() => onSuccess({ userHandle: 'u2', isAdmin: false })}>
          mock-auth-success
        </button>
      </div>
    ) : null,
}));

import { apiFetch } from '@/lib/apiFetch';
import { signOut } from '@/lib/auth/client';
import { hasRegisteredBefore } from '@/lib/auth/local-hint';
import { useSession } from '@/lib/auth/session';

function HomeMarker() {
  return <div data-testid="home">Home</div>;
}

function renderSettings() {
  return render(
    <I18nProvider>
      <SettingsProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route path="/" element={<HomeMarker />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </MemoryRouter>
      </SettingsProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
  vi.mocked(useSession).mockReturnValue({
    session: { status: 'unauthenticated' },
    refresh: vi.fn(),
    login: vi.fn(),
  });
});

describe('Settings route', () => {
  it('renders the settings heading', () => {
    renderSettings();
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders language, accent, and sound sections', () => {
    renderSettings();
    expect(screen.getByRole('group')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('back button navigates away from settings', async () => {
    render(
      <I18nProvider>
        <SettingsProvider>
          <MemoryRouter initialEntries={['/', '/settings']} initialIndex={1}>
            <Routes>
              <Route path="/" element={<HomeMarker />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </MemoryRouter>
        </SettingsProvider>
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('sound switch toggles on click', async () => {
    renderSettings();
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('accent swatch click updates selection', async () => {
    renderSettings();
    const irisBtn = screen.getByRole('radio', { name: /iris/i });
    await userEvent.click(irisBtn);
    expect(irisBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('language toggle click updates selection', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /svenska/i }));
    expect(screen.getByRole('button', { name: /svenska/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows privacy policy link in about section', () => {
    renderSettings();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  it('shows version indicator', () => {
    renderSettings();
    expect(screen.getByText(/version/i)).toBeInTheDocument();
  });

  it('does not show admin link when unauthenticated', () => {
    renderSettings();
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull();
  });

  it('shows saved toast after toggling sound', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('switch'));
    const toast = screen.getByRole('status');
    expect(toast).toHaveClass('show');
    expect(toast).toHaveTextContent(/saved/i);
  });
});

describe('Settings — unauthenticated account section', () => {
  it('shows Not signed in status', () => {
    renderSettings();
    expect(screen.getByText(/not signed in/i)).toBeInTheDocument();
  });

  it('shows a sign in button (not a navigation link)', () => {
    renderSettings();
    const btn = screen.getByRole('button', { name: /sign in or create account/i });
    expect(btn.tagName).toBe('BUTTON');
  });

  it('sign in button opens PasskeyPrompt in register mode for first-time users', async () => {
    vi.mocked(hasRegisteredBefore).mockReturnValue(false);
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /sign in or create account/i }));
    expect(screen.getByTestId('passkey-prompt')).toHaveAttribute('data-mode', 'register');
  });

  it('sign in button opens PasskeyPrompt in signin mode for returning users', async () => {
    vi.mocked(hasRegisteredBefore).mockReturnValue(true);
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /sign in or create account/i }));
    expect(screen.getByTestId('passkey-prompt')).toHaveAttribute('data-mode', 'signin');
  });

  it('successful auth calls login, closes prompt, and shows signed-in toast', async () => {
    const login = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'unauthenticated' },
      refresh: vi.fn(),
      login,
    });
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /sign in or create account/i }));
    await userEvent.click(screen.getByRole('button', { name: /mock-auth-success/i }));
    expect(login).toHaveBeenCalledWith({ userHandle: 'u2', isAdmin: false });
    expect(screen.queryByTestId('passkey-prompt')).toBeNull();
    const toast = screen.getByRole('status');
    expect(toast).toHaveClass('show');
    expect(toast).toHaveTextContent(/signed in/i);
  });
});

describe('Settings — authenticated account section', () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh: vi.fn(),
      login: vi.fn(),
    });
  });

  it('shows Signed in status', () => {
    renderSettings();
    expect(screen.getByText(/^signed in$/i)).toBeInTheDocument();
  });

  it('shows sign out and delete account buttons', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('sign out calls signOut, refreshes session, and navigates to /', async () => {
    const refresh = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh,
      login: vi.fn(),
    });
    vi.mocked(signOut).mockResolvedValueOnce(undefined);
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('first delete click shows confirmation prompt', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByRole('button', { name: /tap again to confirm/i })).toBeInTheDocument();
  });

  it('cancel button dismisses the confirmation', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('button', { name: /tap again to confirm/i })).toBeNull();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('second delete click calls DELETE /api/auth/delete and navigates to /', async () => {
    const refresh = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh,
      login: vi.fn(),
    });
    // SettingsProvider calls apiFetch('/api/me/settings') on mount — route by URL so that
    // call doesn't consume the success response meant for the delete endpoint.
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url === '/api/auth/delete') return { ok: true } as Response;
      return new Response(null, { status: 401 });
    });
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /tap again to confirm/i }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/api/auth/delete', { method: 'DELETE' }),
    );
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('shows error message on delete failure', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url === '/api/auth/delete') return { ok: false } as Response;
      return new Response(null, { status: 401 });
    });
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /tap again to confirm/i }));
    await waitFor(() => expect(screen.getByText(/could not delete/i)).toBeInTheDocument());
  });

  it('does not show admin link for non-admin users', () => {
    renderSettings();
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull();
  });
});

describe('Settings — admin link', () => {
  it('shows admin link for admin users', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: true } },
      refresh: vi.fn(),
      login: vi.fn(),
    });
    renderSettings();
    const link = screen.getByRole('link', { name: /admin/i });
    expect(link).toHaveAttribute('href', '/admin');
  });
});
