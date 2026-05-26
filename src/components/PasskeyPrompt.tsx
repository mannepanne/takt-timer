// ABOUT: Bottom-sheet prompt for passkey registration and sign-in.
// ABOUT: Shows register vs sign-in mode; calls back with the authenticated user on success.

import { useState } from 'react';

import { register, signIn, type AuthUser } from '@/lib/auth/client';

type Props = {
  open: boolean;
  mode: 'register' | 'signin';
  onSuccess: (user: AuthUser) => void;
  onClose: () => void;
};

export function PasskeyPrompt({ open, mode, onSuccess, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  async function handleAction() {
    setError(null);
    setLoading(true);
    try {
      const user = isRegister ? await register() : await signIn();
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className={`drawer-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`drawer${open ? ' open' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-handle" />
        <div className="passkey-prompt-body">
          <h2 className="passkey-prompt-title">{isRegister ? 'Create an account' : 'Sign in'}</h2>
          <p className="passkey-prompt-description">
            {isRegister
              ? 'Your phone will ask you to use Face ID, Touch ID, or your device PIN. No password needed.'
              : 'Use the passkey you created when you registered. Your phone will verify your identity.'}
          </p>
          {isRegister && (
            <p className="passkey-prompt-note">
              If you use different platforms (e.g. Android phone + MacBook), you may need to add
              each device separately.
            </p>
          )}
          {error && <p className="passkey-prompt-error">{error}</p>}
          <div className="passkey-prompt-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAction}
              disabled={loading}
            >
              {loading
                ? 'Waiting…'
                : isRegister
                  ? 'Create account with passkey'
                  : 'Sign in with passkey'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
