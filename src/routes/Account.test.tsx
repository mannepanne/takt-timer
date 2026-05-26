// ABOUT: Tests for the Account route — sign out and delete account flows.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/auth/client', () => ({ signOut: vi.fn() }));
vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({
  useSession: vi.fn(() => ({
    session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
    refresh: vi.fn(),
  })),
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
    <MemoryRouter>
      <Account />
    </MemoryRouter>,
  );
}

describe('Account', () => {
  it('renders the account title', () => {
    renderAccount();
    expect(screen.getByRole('heading', { name: /account/i })).toBeTruthy();
  });

  it('calls signOut and refreshes on sign out click', async () => {
    const refresh = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh,
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

  it('calls DELETE /api/auth/me on second delete click', async () => {
    const refresh = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      session: { status: 'authenticated', user: { userHandle: 'u1', isAdmin: false } },
      refresh,
    });
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}) as never);
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.click(screen.getByRole('button', { name: /tap again/i }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/api/auth/me', { method: 'DELETE' }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('shows error message on delete failure', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}, 500) as never);
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.click(screen.getByRole('button', { name: /tap again/i }));
    await waitFor(() => expect(screen.getByText(/could not delete/i)).toBeTruthy());
  });
});
