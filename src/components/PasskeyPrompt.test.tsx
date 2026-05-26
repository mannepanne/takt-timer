// ABOUT: Tests for the PasskeyPrompt component — register and sign-in modes.

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

function renderPrompt(mode: 'register' | 'signin', open = true) {
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
});
