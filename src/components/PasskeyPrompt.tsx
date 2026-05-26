// ABOUT: Bottom-sheet prompt for passkey registration and sign-in.
// ABOUT: discover mode tries sign-in first and falls back to registration if no passkey is found.

import { useEffect, useRef, useState } from 'react';

import { register, signIn, type AuthUser } from '@/lib/auth/client';

type Props = {
  open: boolean;
  mode: 'register' | 'signin' | 'discover';
  onSuccess: (user: AuthUser) => void;
  onClose: () => void;
};

export function PasskeyPrompt({ open, mode, onSuccess, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [effectiveMode, setEffectiveMode] = useState<'register' | 'signin'>(
    mode === 'discover' ? 'signin' : mode,
  );
  // Each time the drawer opens, bump the generation so any in-flight Promise
  // result that resolves after the user closed/re-opened is silently discarded.
  const genRef = useRef(0);

  useEffect(() => {
    if (open) {
      setEffectiveMode(mode === 'discover' ? 'signin' : mode);
      setError(null);
      setLoading(false);
      genRef.current++;
    }
  }, [open, mode]);

  const isRegister = effectiveMode === 'register';
  const isDiscovering = mode === 'discover' && effectiveMode === 'signin';

  async function handleAction() {
    if (loading) return;
    const gen = ++genRef.current;
    setError(null);
    setLoading(true);
    try {
      const user = isRegister ? await register() : await signIn();
      if (gen !== genRef.current) return;
      onSuccess(user);
    } catch (err) {
      if (gen !== genRef.current) return;
      if (isDiscovering) {
        // No passkey found on this device — offer registration instead
        setEffectiveMode('register');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }

  let title: string;
  let description: string;

  if (isDiscovering) {
    title = 'Continue with passkey';
    description =
      'If you have a passkey for Takt on this device, your phone will offer it. Otherwise you can create a new account.';
  } else if (isRegister && mode === 'discover') {
    title = 'Create an account';
    description =
      'No passkey found on this device. You can create a new account, or cancel and sign in on a device where your passkey is saved.';
  } else if (isRegister) {
    title = 'Create an account';
    description =
      'Your phone will ask you to use Face ID, Touch ID, or your device PIN. No password needed.';
  } else {
    title = 'Sign in';
    description =
      'Use the passkey you created when you registered. Your phone will verify your identity.';
  }

  const showNote = isRegister && mode !== 'discover';

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
          <h2 className="passkey-prompt-title">{title}</h2>
          <p className="passkey-prompt-description">{description}</p>
          {showNote && (
            <p className="passkey-prompt-note">
              If you use different platforms (e.g. Android phone + MacBook), you may need to add
              each device separately.
            </p>
          )}
          {error && <p className="passkey-prompt-error">{error}</p>}
          <div className="passkey-prompt-actions">
            {isRegister && mode === 'discover' ? (
              // In discover fallback the safe path (cancel + go get the other device) is
              // styled as primary to reduce the risk of accidentally creating a duplicate account.
              <>
                <button type="button" className="btn btn-primary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleAction}
                  disabled={loading}
                >
                  {loading ? 'Waiting…' : 'Create account with passkey'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAction}
                  disabled={loading}
                >
                  {loading
                    ? 'Waiting…'
                    : isDiscovering
                      ? 'Continue with passkey'
                      : isRegister
                        ? 'Create account with passkey'
                        : 'Sign in with passkey'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
