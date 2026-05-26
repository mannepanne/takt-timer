// ABOUT: Tests for the PasskeyPrompt component — register, sign-in, and discover modes.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PasskeyPrompt } from './PasskeyPrompt';

vi.mock('@/lib/auth/client', () => ({
  register: vi.fn(),
  signIn: vi.fn(),
}));

import { register, signIn } from '@/lib/auth/client';

const USER = { userHandle: 'aabb', isAdmin: false };

beforeEach(() => vi.clearAllMocks());

function renderPrompt(mode: 'register' | 'signin' | 'discover', open = true) {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  render(<PasskeyPrompt open={open} mode={mode} onSuccess={onSuccess} onClose={onClose} />);
  return { onSuccess, onClose };
}

describe('PasskeyPrompt', () => {
  it('shows create account heading in register mode', () => {
    renderPrompt('register');
    expect(screen.getByRole('heading')).toHaveTextContent('Create an account');
  });

  it('shows sign in heading in signin mode', () => {
    renderPrompt('signin');
    expect(screen.getByRole('heading')).toHaveTextContent('Sign in');
  });

  it('shows cross-platform note in register mode', () => {
    renderPrompt('register');
    expect(screen.getByText(/different platforms/)).toBeTruthy();
  });

  it('calls register() and onSuccess on register mode action', async () => {
    vi.mocked(register).mockResolvedValueOnce(USER);
    const { onSuccess } = renderPrompt('register');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(USER));
  });

  it('calls signIn() and onSuccess on signin mode action', async () => {
    vi.mocked(signIn).mockResolvedValueOnce(USER);
    const { onSuccess } = renderPrompt('signin');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(USER));
  });

  it('displays error message on failure', async () => {
    vi.mocked(register).mockRejectedValueOnce(new Error('Passkey cancelled'));
    renderPrompt('register');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(screen.getByText('Passkey cancelled')).toBeTruthy());
  });

  it('calls onClose when Cancel is clicked', () => {
    const { onClose } = renderPrompt('register');
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  describe('discover mode', () => {
    it('shows "Continue with passkey" heading initially', () => {
      renderPrompt('discover');
      expect(screen.getByRole('heading')).toHaveTextContent('Continue with passkey');
    });

    it('calls signIn() when the continue button is clicked', async () => {
      vi.mocked(signIn).mockResolvedValueOnce(USER);
      renderPrompt('discover');
      fireEvent.click(screen.getByRole('button', { name: /continue with passkey/i }));
      await waitFor(() => expect(signIn).toHaveBeenCalled());
    });

    it('calls onSuccess when signIn succeeds', async () => {
      vi.mocked(signIn).mockResolvedValueOnce(USER);
      const { onSuccess } = renderPrompt('discover');
      fireEvent.click(screen.getByRole('button', { name: /continue with passkey/i }));
      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(USER));
    });

    it('falls back to register UI when signIn fails', async () => {
      vi.mocked(signIn).mockRejectedValueOnce(new Error('NotAllowedError'));
      renderPrompt('discover');
      fireEvent.click(screen.getByRole('button', { name: /continue with passkey/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading')).toHaveTextContent('Create an account'),
      );
      expect(
        screen.getByRole('button', { name: /create account with passkey/i }),
      ).toBeInTheDocument();
    });

    it('shows no-passkey-found copy (not generic error) on signIn failure', async () => {
      vi.mocked(signIn).mockRejectedValueOnce(new Error('NotAllowedError'));
      renderPrompt('discover');
      fireEvent.click(screen.getByRole('button', { name: /continue with passkey/i }));
      await waitFor(() => expect(screen.getByText(/no passkey found/i)).toBeInTheDocument());
      expect(screen.queryByText('NotAllowedError')).toBeNull();
    });

    it('calls register() when create account is clicked in fallback state', async () => {
      vi.mocked(signIn).mockRejectedValueOnce(new Error('no cred'));
      vi.mocked(register).mockResolvedValueOnce(USER);
      const { onSuccess } = renderPrompt('discover');
      fireEvent.click(screen.getByRole('button', { name: /continue with passkey/i }));
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /create account with passkey/i }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole('button', { name: /create account with passkey/i }));
      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(USER));
    });

    it('does not show cross-platform note in discover fallback state', async () => {
      vi.mocked(signIn).mockRejectedValueOnce(new Error('no cred'));
      renderPrompt('discover');
      fireEvent.click(screen.getByRole('button', { name: /continue with passkey/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading')).toHaveTextContent('Create an account'),
      );
      expect(screen.queryByText(/different platforms/)).toBeNull();
    });
  });
});
