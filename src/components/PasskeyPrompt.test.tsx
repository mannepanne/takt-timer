// ABOUT: Tests for the PasskeyPrompt component — register, sign-in, and discover modes.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PasskeyPrompt } from './PasskeyPrompt';
import { I18nProvider } from '@/i18n/context';

vi.mock('@/lib/auth/client', () => ({
  register: vi.fn(),
  signIn: vi.fn(),
}));

import { register, signIn } from '@/lib/auth/client';

const USER = { userHandle: 'aabb', isAdmin: false };

beforeEach(() => vi.clearAllMocks());

const i18nWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

function renderPrompt(mode: 'register' | 'signin' | 'discover', open = true) {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  render(<PasskeyPrompt open={open} mode={mode} onSuccess={onSuccess} onClose={onClose} />, {
    wrapper: i18nWrapper,
  });
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

  it('displays generic error for unknown error codes', async () => {
    vi.mocked(register).mockRejectedValueOnce(new Error('Passkey cancelled'));
    renderPrompt('register');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() =>
      expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy(),
    );
  });

  it('maps challenge-expired to friendly copy', async () => {
    vi.mocked(register).mockRejectedValueOnce(new Error('challenge-expired'));
    renderPrompt('register');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() =>
      expect(screen.getByText('The request timed out. Please try again.')).toBeTruthy(),
    );
  });

  it('maps verification-failed to friendly copy', async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new Error('verification-failed'));
    renderPrompt('signin');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(
        screen.getByText("Your device couldn't verify your identity. Please try again."),
      ).toBeTruthy(),
    );
  });

  it('maps user-not-found to friendly copy', async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new Error('user-not-found'));
    renderPrompt('signin');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText('No account found. Create an account to get started.')).toBeTruthy(),
    );
  });

  it('maps rate-limited to friendly copy', async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new Error('rate-limited'));
    renderPrompt('signin');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText('Too many attempts. Try again later.')).toBeTruthy(),
    );
  });

  it('calls onClose when Cancel is clicked', () => {
    const { onClose } = renderPrompt('register');
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel is enabled even while the action is in-flight', async () => {
    // signIn never resolves — simulates Android "Waiting…" hang
    vi.mocked(signIn).mockReturnValueOnce(new Promise(() => {}));
    const { onClose } = renderPrompt('signin');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    // Button text flips to "Waiting…" while in-flight
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /waiting/i })).toBeInTheDocument(),
    );
    const cancel = screen.getByRole('button', { name: /cancel/i });
    expect(cancel).not.toBeDisabled();
    fireEvent.click(cancel);
    expect(onClose).toHaveBeenCalled();
  });

  it('stale in-flight result is ignored after re-open', async () => {
    let resolveSignIn!: (u: typeof USER) => void;
    vi.mocked(signIn).mockReturnValueOnce(
      new Promise((res) => {
        resolveSignIn = res;
      }),
    );
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <PasskeyPrompt open={true} mode="signin" onSuccess={onSuccess} onClose={onClose} />,
      { wrapper: i18nWrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /waiting/i })).toBeInTheDocument(),
    );
    // Close then re-open (bumps generation)
    rerender(<PasskeyPrompt open={false} mode="signin" onSuccess={onSuccess} onClose={onClose} />);
    rerender(<PasskeyPrompt open={true} mode="signin" onSuccess={onSuccess} onClose={onClose} />);
    // Stale Promise resolves — should be discarded
    resolveSignIn(USER);
    await new Promise((r) => setTimeout(r, 0));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows "Already have an account?" link in register mode', () => {
    renderPrompt('register');
    expect(screen.getByRole('button', { name: /already have an account/i })).toBeInTheDocument();
  });

  it('"Already have an account?" link switches to sign-in UI', async () => {
    renderPrompt('register');
    fireEvent.click(screen.getByRole('button', { name: /already have an account/i }));
    expect(screen.getByRole('heading')).toHaveTextContent('Sign in');
    expect(screen.getByRole('button', { name: /sign in with passkey/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /already have an account/i })).toBeNull();
  });

  it('does not show "Already have an account?" in signin or discover mode', () => {
    renderPrompt('signin');
    expect(screen.queryByRole('button', { name: /already have an account/i })).toBeNull();
    renderPrompt('discover');
    expect(screen.queryByRole('button', { name: /already have an account/i })).toBeNull();
  });

  it('re-opening while loading resets the Waiting… button', async () => {
    vi.mocked(signIn).mockReturnValueOnce(new Promise(() => {}));
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <PasskeyPrompt open={true} mode="signin" onSuccess={onSuccess} onClose={onClose} />,
      { wrapper: i18nWrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /waiting/i })).toBeInTheDocument(),
    );
    rerender(<PasskeyPrompt open={false} mode="signin" onSuccess={onSuccess} onClose={onClose} />);
    rerender(<PasskeyPrompt open={true} mode="signin" onSuccess={onSuccess} onClose={onClose} />);
    expect(screen.getByRole('button', { name: /sign in with passkey/i })).not.toBeDisabled();
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

    it('re-opening after reaching fallback resets to discover-initial state', async () => {
      vi.mocked(signIn).mockRejectedValueOnce(new Error('no cred'));
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      const { rerender } = render(
        <PasskeyPrompt open={true} mode="discover" onSuccess={onSuccess} onClose={onClose} />,
        { wrapper: i18nWrapper },
      );
      fireEvent.click(screen.getByRole('button', { name: /continue with passkey/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading')).toHaveTextContent('Create an account'),
      );
      rerender(
        <PasskeyPrompt open={false} mode="discover" onSuccess={onSuccess} onClose={onClose} />,
      );
      rerender(
        <PasskeyPrompt open={true} mode="discover" onSuccess={onSuccess} onClose={onClose} />,
      );
      expect(screen.getByRole('heading')).toHaveTextContent('Continue with passkey');
    });
  });
});
