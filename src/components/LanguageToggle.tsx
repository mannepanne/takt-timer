// ABOUT: Segmented control for switching between English and Swedish.
// ABOUT: Renders each language label in its own tongue; calls onChange only when switching.

import { useI18n } from '@/i18n/context';
import type { Lang } from '@/i18n/strings';

type Props = {
  onChange?: (lang: Lang) => void;
};

export function LanguageToggle({ onChange }: Props) {
  const { lang, t } = useI18n();

  function handleClick(next: Lang) {
    if (next !== lang) onChange?.(next);
  }

  return (
    <div className="lang-toggle" role="group" aria-label={t('settings.language')}>
      <button
        type="button"
        className={`lang-toggle-btn${lang === 'en' ? ' active' : ''}`}
        onClick={() => handleClick('en')}
        aria-pressed={lang === 'en'}
      >
        {t('settings.language.en')}
      </button>
      <button
        type="button"
        className={`lang-toggle-btn${lang === 'sv' ? ' active' : ''}`}
        onClick={() => handleClick('sv')}
        aria-pressed={lang === 'sv'}
      >
        {t('settings.language.sv')}
      </button>
    </div>
  );
}
