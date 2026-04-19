// ABOUT: Parsed-intent summary — three tappable chips (sets / work / rest) that open
// ABOUT: the StepperSheet for editing. Used by the Configure route.

import { useState } from 'react';

import { StepperSheet, type StepperMode } from '@/components/StepperSheet';
import { fmtTime } from '@/lib/format';
import type { Session } from '@/lib/timer/types';

type Props = {
  value: Session;
  onChange: (next: Session) => void;
};

type EditTarget = {
  field: 'sets' | 'workSec' | 'restSec';
  label: string;
  mode: StepperMode;
  min: number;
  max: number;
};

const TARGETS: Record<EditTarget['field'], EditTarget> = {
  sets: { field: 'sets', label: 'Sets', mode: 'int', min: 1, max: 99 },
  workSec: { field: 'workSec', label: 'Work', mode: 'duration', min: 5, max: 3600 },
  restSec: { field: 'restSec', label: 'Rest', mode: 'duration', min: 0, max: 3600 },
};

export function Interpretation({ value, onChange }: Props) {
  const [editing, setEditing] = useState<EditTarget['field'] | null>(null);

  const target = editing ? TARGETS[editing] : null;
  const currentValue = editing ? value[editing] : 0;

  const commit = (field: EditTarget['field'], v: number) => {
    onChange({ ...value, [field]: v });
  };

  return (
    <>
      <div className="interpretation-chips">
        <button
          type="button"
          className={`chip ${editing === 'sets' ? 'editing' : ''}`}
          onClick={() => setEditing('sets')}
        >
          <span className="chip-val">{value.sets}</span>
          <span className="chip-label">Sets</span>
        </button>
        <button
          type="button"
          className={`chip ${editing === 'workSec' ? 'editing' : ''}`}
          onClick={() => setEditing('workSec')}
        >
          <span className="chip-val mono">{fmtTime(value.workSec)}</span>
          <span className="chip-label">Work</span>
        </button>
        <button
          type="button"
          className={`chip ${editing === 'restSec' ? 'editing' : ''}`}
          onClick={() => setEditing('restSec')}
        >
          <span className="chip-val mono">{fmtTime(value.restSec)}</span>
          <span className="chip-label">Rest</span>
        </button>
      </div>

      <StepperSheet
        open={editing !== null}
        mode={target?.mode ?? 'int'}
        label={target?.label ?? ''}
        value={currentValue}
        min={target?.min}
        max={target?.max}
        onChange={(v) => editing && commit(editing, v)}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
