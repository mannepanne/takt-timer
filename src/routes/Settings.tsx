// ABOUT: Settings route — language, accent colour, sound effects, account management, and about.
// ABOUT: Account management is inlined here; there is no separate /account route.

import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AccentPicker } from '@/components/AccentPicker';
import { Icon } from '@/components/icons';
import { LanguageToggle } from '@/components/LanguageToggle';
import { PasskeyPrompt } from '@/components/PasskeyPrompt';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
import type { Lang } from '@/i18n/strings';
import { type AuthUser, signOut } from '@/lib/auth/client';
import { hasRegisteredBefore, markUnregistered } from '@/lib/auth/local-hint';
import { clearOnboardingSeen } from '@/routes/Onboarding';
import { useSession } from '@/lib/auth/session';
import { apiFetch } from '@/lib/apiFetch';
import { isNativePlatform } from '@/lib/platform';
import { clearHistory } from '@/lib/history';
import { importLocalHistory } from '@/lib/history-sync';
import { useSettings } from '@/lib/settings/context';
import type { AccentId } from '@/lib/settings/accents';

export function Settings() {
  const { t, setLang } = useI18n();
  const { accentId, soundOn, setAccent, setSoundOn, putAllSettings } = useSettings();
  const { session, login, refresh } = useSession();
  const navigate = useNavigate();
  const [savedVisible, setSavedVisible] = useState(false);
  const [signedInVisible, setSignedInVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signedInTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthenticated = session.status === 'authenticated';
  const isAdmin = session.status === 'authenticated' && session.user.isAdmin;
  // Native has no accounts (07c) — hide the whole account block and the passkey prompt (07g).
  const showAccount = !isNativePlatform();

  function triggerSaved() {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedVisible(true);
    savedTimer.current = setTimeout(() => setSavedVisible(false), 1500);
  }

  function triggerSignedIn() {
    if (signedInTimer.current) clearTimeout(signedInTimer.current);
    setSignedInVisible(true);
    signedInTimer.current = setTimeout(() => setSignedInVisible(false), 2000);
  }

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
    setDeleteError(null);
    try {
      const res = await apiFetch('/api/auth/delete', { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      clearHistory();
      markUnregistered();
      refresh();
      navigate('/');
    } catch {
      setDeleteError(t('account.deleteError'));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function handleAuthSuccess(user: AuthUser) {
    login(user);
    setPromptOpen(false);
    importLocalHistory().catch(() => {});
    triggerSignedIn();
  }

  function handleLangChange(next: Lang) {
    setLang(next);
    putAllSettings({ language: next });
    triggerSaved();
  }

  function handleAccentChange(id: AccentId) {
    setAccent(id);
    triggerSaved();
  }

  function handleSoundToggle() {
    setSoundOn(!soundOn);
    triggerSaved();
  }

  function handleReplayOnboarding() {
    clearOnboardingSeen();
    navigate('/');
  }

  return (
    <div className="screen">
      <TopBar
        left={
          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate(-1)}
            aria-label={t('nav.backToHome')}
          >
            <Icon.ChevronLeft size={20} />
          </button>
        }
      />

      <div className="settings-body">
        <h1 className="settings-title">{t('settings.title')}</h1>

        <section className="settings-section">
          <div className="settings-row">
            <span className="settings-label">{t('settings.language')}</span>
            <LanguageToggle onChange={handleLangChange} />
          </div>
        </section>

        <div className="hairline" />

        <section className="settings-section">
          <div className="settings-row settings-row--stack">
            <span className="settings-label">{t('settings.accent')}</span>
            <AccentPicker value={accentId} onChange={handleAccentChange} />
          </div>
        </section>

        <div className="hairline" />

        <section className="settings-section">
          <div className="settings-row">
            <span className="settings-label">{t('settings.sound')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={soundOn}
              className={`settings-toggle${soundOn ? ' on' : ''}`}
              onClick={handleSoundToggle}
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>
        </section>

        {showAccount && (
          <>
            <div className="hairline" />

            <section className="settings-section">
              <div className="settings-row">
                <span className="settings-label">{t('settings.account')}</span>
                <span className="settings-value">
                  {isAuthenticated ? t('settings.signedIn') : t('settings.notSignedIn')}
                </span>
              </div>
              {isAuthenticated ? (
                <div className="settings-account-actions">
                  <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
                    {t('account.signOut')}
                  </button>
                  {deleteError && <p className="account-error">{deleteError}</p>}
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting
                      ? t('account.deleting')
                      : confirmDelete
                        ? t('account.deleteConfirm')
                        : t('account.delete')}
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
              ) : (
                <div className="settings-account-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setPromptOpen(true)}
                  >
                    {t('settings.signInCta')}
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        <div className="hairline" />

        <section className="settings-section">
          <div className="settings-row">
            <span className="settings-label">{t('settings.about')}</span>
          </div>
          <div className="settings-row" style={{ marginTop: 8 }}>
            <Link to="/privacy" className="settings-link">
              {t('settings.privacyPolicy')}
            </Link>
          </div>
          <div className="settings-row" style={{ marginTop: 8 }}>
            <button type="button" className="settings-link" onClick={handleReplayOnboarding}>
              {t('settings.replayOnboarding')}
            </button>
          </div>
          <div className="settings-row" style={{ marginTop: 8 }}>
            <span className="settings-value">
              {t('settings.version')} {__APP_VERSION__}
            </span>
            {isAdmin && (
              <a href="/admin" className="settings-link">
                {t('settings.admin')}
              </a>
            )}
          </div>
        </section>
      </div>

      <div
        className={`toast${savedVisible || signedInVisible ? ' show' : ''}`}
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {signedInVisible ? t('settings.signedIn') : savedVisible ? t('settings.saved') : ''}
      </div>

      {showAccount && (
        <PasskeyPrompt
          open={promptOpen}
          mode={hasRegisteredBefore() ? 'signin' : 'register'}
          onSuccess={handleAuthSuccess}
          onClose={() => setPromptOpen(false)}
        />
      )}
    </div>
  );
}
