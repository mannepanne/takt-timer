// ABOUT: Settings route — language, accent colour, sound effects.
// ABOUT: Available to all users; changes persist to D1 for authenticated users.

import { useNavigate } from 'react-router-dom';

import { AccentPicker } from '@/components/AccentPicker';
import { Icon } from '@/components/icons';
import { LanguageToggle } from '@/components/LanguageToggle';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
import type { Lang } from '@/i18n/strings';
import { useSettings } from '@/lib/settings/context';
import type { AccentId } from '@/lib/settings/accents';

export function Settings() {
  const { t, setLang } = useI18n();
  const { accentId, soundOn, setAccent, setSoundOn, putAllSettings } = useSettings();
  const navigate = useNavigate();

  function handleLangChange(next: Lang) {
    setLang(next);
    putAllSettings({ language: next });
  }

  function handleAccentChange(id: AccentId) {
    setAccent(id);
  }

  function handleSoundToggle() {
    setSoundOn(!soundOn);
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
      </div>
    </div>
  );
}
