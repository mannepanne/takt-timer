// ABOUT: Bottom-sheet numeric editor with big +/- targets and hold-to-accelerate.
// ABOUT: Used by Interpretation to edit sets / work / rest values.

import { useEffect, useRef, useState } from 'react';

import { fmtTime } from '@/lib/format';

export type StepperMode = 'int' | 'duration';

type Props = {
  open: boolean;
  mode: StepperMode;
  label: string;
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
  min?: number;
  max?: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function quickPresets(mode: StepperMode, label: string): number[] {
  if (mode === 'int') return [1, 2, 3, 4, 5, 8, 10, 15];
  if (label.toLowerCase() === 'rest') return [0, 15, 30, 45, 60, 90];
  return [15, 30, 45, 60, 90, 120];
}

export function StepperSheet({
  open,
  mode,
  label,
  value,
  onChange,
  onClose,
  min = 0,
  max = 9999,
}: Props) {
  const [draft, setDraft] = useState(value);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(
    () => () => {
      if (holdTimer.current) clearInterval(holdTimer.current);
    },
    [],
  );

  const step = mode === 'duration' ? 5 : 1;

  const startHold = (dir: 1 | -1) => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    setDraft((d) => clamp(d + dir * step, min, max));
    const begin = Date.now();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - begin;
      const rate = elapsed > 1500 ? 8 : elapsed > 700 ? 3 : 1;
      setDraft((d) => clamp(d + dir * step * rate, min, max));
    }, 120);
  };

  const endHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
  };

  const commit = () => {
    onChange(draft);
    onClose();
  };

  const display = mode === 'duration' ? fmtTime(draft) : String(draft);
  const presets = quickPresets(mode, label);

  return (
    <>
      <div
        className={`drawer-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
        data-testid="stepper-backdrop"
      />
      <div
        className={`drawer stepper-sheet ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal={open}
        aria-label={`Edit ${label}`}
      >
        <div className="drawer-handle" />
        <div className="stepper-sheet-body">
          <div className="eyebrow stepper-sheet-label">{label}</div>

          <div className="stepper-sheet-row">
            <button
              type="button"
              className="stepper-btn"
              onPointerDown={() => startHold(-1)}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              aria-label={`Decrease ${label}`}
              disabled={draft <= min}
            >
              <span className="stepper-btn-glyph">−</span>
            </button>
            <div className="stepper-sheet-display" aria-live="polite">
              <div className="mono stepper-sheet-value">{display}</div>
              {mode === 'duration' && <div className="stepper-sheet-unit">min : sec</div>}
            </div>
            <button
              type="button"
              className="stepper-btn"
              onPointerDown={() => startHold(1)}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              aria-label={`Increase ${label}`}
              disabled={draft >= max}
            >
              <span className="stepper-btn-glyph">+</span>
            </button>
          </div>

          <div className="stepper-sheet-presets">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                className={`quick-pill ${draft === p ? 'active' : ''}`}
                onClick={() => setDraft(p)}
              >
                {mode === 'duration' ? fmtTime(p) : p}
              </button>
            ))}
          </div>

          <div className="stepper-sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={commit}>
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
