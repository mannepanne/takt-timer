// ABOUT: Segmented control for the appearance mode — System / Light / Dark — as a radiogroup.
// ABOUT: Under System it captions which appearance the phone currently resolves to.

import { useI18n } from '@/i18n/context';
import type { StringKey } from '@/i18n/strings';
import { THEME_MODES, type ResolvedTheme, type ThemeMode } from '@/lib/settings/theme';

type Props = {
  value: ThemeMode;
  resolved: ResolvedTheme;
  onChange: (mode: ThemeMode) => void;
};

export function ThemeToggle({ value, resolved, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div className="theme-toggle-wrap">
      <div className="theme-toggle" role="radiogroup" aria-label={t('settings.theme')}>
        {THEME_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value === mode}
            className={`theme-toggle-btn${value === mode ? ' active' : ''}`}
            onClick={() => {
              if (mode !== value) onChange(mode);
            }}
          >
            {t(`settings.theme.${mode}` as StringKey)}
          </button>
        ))}
      </div>
      {value === 'system' && (
        <p className="theme-toggle-caption">
          {t(`settings.theme.currently.${resolved}` as StringKey)}
        </p>
      )}
    </div>
  );
}
