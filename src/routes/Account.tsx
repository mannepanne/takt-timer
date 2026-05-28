// ABOUT: Account route — sign out and account deletion for authenticated users.
// ABOUT: Shows a passkey sign-in prompt for unauthenticated visitors.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { PasskeyPrompt } from '@/components/PasskeyPrompt';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
import { signOut, type AuthUser } from '@/lib/auth/client';
import { apiFetch } from '@/lib/apiFetch';
import { useSession } from '@/lib/auth/session';
import { clearHistory } from '@/lib/history';
import { markUnregistered, hasRegisteredBefore } from '@/lib/auth/local-hint';

export function Account() {
  const { session } = useSession();
  return session.status === 'authenticated' ? <AccountAuth /> : <AccountAnon />;
}

function AccountAuth() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    refresh();
    navigate('/');
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/delete', { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      clearHistory();
      markUnregistered();
      refresh();
      navigate('/');
    } catch {
      setError(t('account.deleteError'));
      setDeleting(false);
    }
  }

  const deleteButtonLabel = deleting
    ? t('account.deleting')
    : confirmDelete
      ? t('account.deleteConfirm')
      : t('account.delete');

  return (
    <div className="screen">
      <TopBar
        left={
          <button
            className="icon-btn"
            aria-label={t('nav.backToHome')}
            onClick={() => navigate(-1)}
            type="button"
          >
            <Icon.Close />
          </button>
        }
      />

      <main className="account-body">
        <h1 className="account-title">{t('account.title')}</h1>
        <p className="account-description">{t('account.description')}</p>

        <div className="account-actions">
          <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
            {t('account.signOut')}
          </button>

          {error && <p className="account-error">{error}</p>}

          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleteButtonLabel}
          </button>
          {confirmDelete && !deleting && (
            <>
              <p className="account-delete-warning">{t('account.deleteWarning')}</p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(false)}
              >
                {t('account.cancel')}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function AccountAnon() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [promptOpen, setPromptOpen] = useState(false);

  function handleAuthSuccess(_user: AuthUser) {
    refresh();
    setPromptOpen(false);
    navigate('/');
  }

  return (
    <div className="screen">
      <TopBar
        left={
          <button
            className="icon-btn"
            aria-label={t('nav.backToHome')}
            onClick={() => navigate(-1)}
            type="button"
          >
            <Icon.Close />
          </button>
        }
      />

      <main className="account-body">
        <h1 className="account-title">{t('account.title')}</h1>
        <p className="account-description">{t('account.unauthDescription')}</p>

        <div className="account-actions">
          <button type="button" className="btn btn-primary" onClick={() => setPromptOpen(true)}>
            {t('passkey.button.discover')}
          </button>
        </div>
      </main>

      <PasskeyPrompt
        open={promptOpen}
        mode={hasRegisteredBefore() ? 'discover' : 'register'}
        onSuccess={handleAuthSuccess}
        onClose={() => setPromptOpen(false)}
      />
    </div>
  );
}
