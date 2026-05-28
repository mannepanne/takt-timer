// ABOUT: Settings route — language, accent colour, sound effects, account, and about.
// ABOUT: Available to all users; changes persist to D1 for authenticated users.

import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AccentPicker } from '@/components/AccentPicker';
import { Icon } from '@/components/icons';
import { LanguageToggle } from '@/components/LanguageToggle';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
import type { Lang } from '@/i18n/strings';
import { useSession } from '@/lib/auth/session';
import { useSettings } from '@/lib/settings/context';
import type { AccentId } from '@/lib/settings/accents';

export function Settings() {
  const { t, setLang } = useI18n();
  const { accentId, soundOn, setAccent, setSoundOn, putAllSettings } = useSettings();
  const { session } = useSession();
  const navigate = useNavigate();
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthenticated = session.status === 'authenticated';

  function triggerSaved() {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedVisible(true);
    savedTimer.current = setTimeout(() => setSavedVisible(false), 1500);
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
        <p className="settings-saved" aria-live="polite" aria-atomic="true">
          {savedVisible ? t('settings.saved') : ''}
        </p>

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

        <div className="hairline" />

        <section className="settings-section">
          <div className="settings-row">
            <span className="settings-label">{t('settings.account')}</span>
            <span className="settings-value">
              {isAuthenticated ? t('settings.signedIn') : t('settings.notSignedIn')}
            </span>
          </div>
          <div className="settings-row" style={{ marginTop: 8 }}>
            <Link to="/account" className="settings-link">
              {isAuthenticated ? t('settings.manageAccount') : t('settings.signInCta')}
            </Link>
          </div>
        </section>

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
            <span className="settings-value">
              {t('settings.version')} {__APP_VERSION__}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
