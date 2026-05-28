// ABOUT: Tests for the Account route — sign out and delete account flows.
// ABOUT: Covers both authenticated (AccountAuth) and unauthenticated (AccountAnon) branches.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/context';

vi.mock('@/lib/auth/client', () => ({ signOut: vi.fn() }));
vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth/local-hint', () => ({
  hasRegisteredBefore: vi.fn(() => false),
  markUnregistered: vi.fn(),
}));
vi.mock('@/lib/auth/session', () => ({
  useSession: vi.fn(() => ({
    session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
    refresh: vi.fn(),
    login: vi.fn(),
  })),
}));
vi.mock('@/components/PasskeyPrompt', () => ({
  PasskeyPrompt: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess: (user: { userHandle: string; isAdmin: boolean }) => void;
  }) =>
    open ? (
      <div data-testid="passkey-prompt">
        <button onClick={() => onSuccess({ userHandle: 'u2', isAdmin: false })}>
          mock-auth-success
        </button>
      </div>
    ) : null,
}));

import { signOut } from '@/lib/auth/client';
import { apiFetch } from '@/lib/apiFetch';
import { useSession } from '@/lib/auth/session';
import { Account } from './Account';

function mockRes(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

beforeEach(() => vi.clearAllMocks());

function renderAccount() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <Account />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('Account — authenticated', () => {
  it('renders the account title', () => {
    renderAccount();
    expect(screen.getByRole('heading', { name: /account/i })).toBeTruthy();
  });

  it('calls signOut and refreshes on sign out click', async () => {
    const refresh = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh,
      login: vi.fn(),
    });
    vi.mocked(signOut).mockResolvedValueOnce();
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });

  it('shows confirmation prompt on first delete click', () => {
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByText(/tap again to confirm/i)).toBeTruthy();
  });

  it('calls DELETE /api/auth/delete on second delete click', async () => {
    const refresh = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh,
      login: vi.fn(),
    });
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}) as never);
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.click(screen.getByRole('button', { name: /tap again/i }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/api/auth/delete', { method: 'DELETE' }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('Cancel button in two-step confirm dismisses the confirmation', () => {
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByText(/tap again to confirm/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText(/tap again to confirm/i)).toBeNull();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeTruthy();
  });

  it('shows error message on delete failure', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}, 500) as never);
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.click(screen.getByRole('button', { name: /tap again/i }));
    await waitFor(() => expect(screen.getByText(/could not delete/i)).toBeTruthy());
  });
});

describe('Account — unauthenticated', () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'unauthenticated' },
      refresh: vi.fn(),
      login: vi.fn(),
    });
  });

  it('renders the account title', () => {
    renderAccount();
    expect(screen.getByRole('heading', { name: /account/i })).toBeInTheDocument();
  });

  it('shows the passkey sign-in CTA instead of sign-out/delete', () => {
    renderAccount();
    expect(screen.getByRole('button', { name: /continue with passkey/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete account/i })).toBeNull();
  });

  it('opens the passkey prompt on CTA click', () => {
    renderAccount();
    expect(screen.queryByTestId('passkey-prompt')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /continue with passkey/i }));
    expect(screen.getByTestId('passkey-prompt')).toBeInTheDocument();
  });

  it('closes the prompt and refreshes session on successful auth', () => {
    const refresh = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'unauthenticated' },
      refresh,
      login: vi.fn(),
    });
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /continue with passkey/i }));
    fireEvent.click(screen.getByRole('button', { name: /mock-auth-success/i }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByTestId('passkey-prompt')).toBeNull();
  });
});
