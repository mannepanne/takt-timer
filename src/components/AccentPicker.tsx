// ABOUT: Row of colour swatches for choosing the accent colour.
// ABOUT: Each swatch emits the chosen AccentId via onChange; the selected one shows its name beneath it.

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
        const label = t(`settings.accent.${accent.id}` as StringKey);
        const selected = value === accent.id;
        return (
          <div key={accent.id} className="accent-swatch-wrap">
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              className={`accent-swatch${selected ? ' selected' : ''}`}
              style={{ '--swatch-color': accent.main } as React.CSSProperties}
              onClick={() => onChange(accent.id)}
            />
            {selected && <span className="accent-swatch-name">{label}</span>}
          </div>
        );
      })}
    </div>
  );
}
