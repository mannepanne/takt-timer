// ABOUT: Grid of colour swatches for choosing the accent colour.
// ABOUT: Each swatch emits the chosen AccentId via onChange; aria-checked tracks selection.

import { useI18n } from '@/i18n/context';
import { ACCENTS, type AccentId } from '@/lib/settings/accents';
import type { StringKey } from '@/i18n/strings';

type Props = {
  value: AccentId;
  onChange: (id: AccentId) => void;
};

export function AccentPicker({ value, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div className="accent-picker" role="radiogroup" aria-label={t('settings.accent')}>
      {ACCENTS.map((accent) => {
        const labelKey = `settings.accent.${accent.id}` as StringKey;
        const label = t(labelKey);
        return (
          <button
            key={accent.id}
            type="button"
            role="radio"
            aria-checked={value === accent.id}
            aria-label={label}
            title={label}
            className={`accent-swatch${value === accent.id ? ' selected' : ''}`}
            style={{ '--swatch-color': accent.main } as React.CSSProperties}
            onClick={() => onChange(accent.id)}
          />
        );
      })}
    </div>
  );
}
