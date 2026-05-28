// ABOUT: Bottom-sheet prompt for passkey registration and sign-in.
// ABOUT: discover mode tries sign-in first and falls back to registration if no passkey is found.

import { useEffect, useRef, useState } from 'react';

import { useI18n } from '@/i18n/context';
import { register, signIn, type AuthUser } from '@/lib/auth/client';

type Props = {
  open: boolean;
  mode: 'register' | 'signin' | 'discover';
  onSuccess: (user: AuthUser) => void;
  onClose: () => void;
};

export function PasskeyPrompt({ open, mode, onSuccess, onClose }: Props) {
  const { t } = useI18n();
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
        setError(err instanceof Error ? err.message : t('voice.error.generic'));
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }

  let title: string;
  let description: string;

  if (isDiscovering) {
    title = t('passkey.discover.title');
    description = t('passkey.discover.description');
  } else if (isRegister && mode === 'discover') {
    title = t('passkey.discoverFallback.title');
    description = t('passkey.discoverFallback.description');
  } else if (isRegister) {
    title = t('passkey.register.title');
    description = t('passkey.register.description');
  } else {
    title = t('passkey.signin.title');
    description = t('passkey.signin.description');
  }

  const showNote = isRegister && mode !== 'discover';

  const actionButtonLabel = loading
    ? t('passkey.waiting')
    : isDiscovering
      ? t('passkey.button.discover')
      : isRegister
        ? t('passkey.button.register')
        : t('passkey.button.signin');

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
          {showNote && <p className="passkey-prompt-note">{t('passkey.multiplatformNote')}</p>}
          {error && <p className="passkey-prompt-error">{error}</p>}
          <div className="passkey-prompt-actions">
            {isRegister && mode === 'discover' ? (
              // In discover fallback the safe path (cancel + go get the other device) is
              // styled as primary to reduce the risk of accidentally creating a duplicate account.
              <>
                <button type="button" className="btn btn-primary" onClick={onClose}>
                  {t('passkey.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleAction}
                  disabled={loading}
                >
                  {loading ? t('passkey.waiting') : t('passkey.button.discoverFallback')}
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
                  {actionButtonLabel}
                </button>
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  {t('passkey.cancel')}
                </button>
              </>
            )}
          </div>
          {mode === 'register' && effectiveMode === 'register' && (
            <button
              type="button"
              className="passkey-prompt-switch"
              onClick={() => setEffectiveMode('signin')}
            >
              {t('passkey.switchToSignIn')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
