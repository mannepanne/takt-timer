// interpretation.jsx — parsed-intent confirmation screen with editable chips
const { useState: useStateI, useEffect: useEffectI, useRef: useRefI } = React;

// ───────── Stepper sheet: big tap targets for editing numeric values ─────────
function StepperSheet({ open, mode, label, value, onChange, onClose, min = 0, max = 9999 }) {
  // mode: 'int' or 'duration' (seconds)
  const [draft, setDraft] = useStateI(value);
  useEffectI(() => { if (open) setDraft(value); }, [open, value]);

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const holdRef = useRefI(null);
  const startHold = (dir, step) => {
    clearInterval(holdRef.current);
    // initial change, then accelerate after 350ms
    setDraft((d) => clamp(d + dir * step, min, max));
    const begin = Date.now();
    holdRef.current = setInterval(() => {
      const elapsed = Date.now() - begin;
      const rate = elapsed > 1500 ? 8 : elapsed > 700 ? 3 : 1;
      setDraft((d) => clamp(d + dir * step * rate, min, max));
    }, 120);
  };
  const endHold = () => clearInterval(holdRef.current);
  useEffectI(() => () => clearInterval(holdRef.current), []);

  const commit = () => { onChange(draft); onClose(); };

  const display = mode === 'duration' ? Takt.fmtTime(draft) : String(draft);

  // Quick presets
  const presets = mode === 'int'
    ? [1, 2, 3, 4, 5, 8, 10, 15]
    : label === 'Rest'
      ? [0, 15, 30, 45, 60, 90]
      : [15, 30, 45, 60, 90, 120];

  const step = mode === 'duration' ? 5 : 1;

  return (
    <>
      <div
        className={`drawer-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        style={{ zIndex: 100 }}
      />
      <div className={`drawer ${open ? 'open' : ''}`} data-stepper="1" style={{ zIndex: 102 }}>
        <div className="drawer-handle" />
        <div style={{ padding: '0 24px 28px' }}>
          <div style={{ fontSize: 13, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
            {label}
          </div>

          {/* Big stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
            <button
              className="stepper-btn"
              onPointerDown={() => startHold(-1, step)}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              aria-label="Decrease"
            >
              <span style={{ fontSize: 28, fontWeight: 300, lineHeight: 1 }}>−</span>
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 56, fontWeight: 300, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
                {display}
              </div>
              {mode === 'duration' && (
                <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  min : sec
                </div>
              )}
            </div>
            <button
              className="stepper-btn"
              onPointerDown={() => startHold(1, step)}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              aria-label="Increase"
            >
              <span style={{ fontSize: 28, fontWeight: 300, lineHeight: 1 }}>+</span>
            </button>
          </div>

          {/* Preset pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24, justifyContent: 'center' }}>
            {presets.map((p, i) => (
              <React.Fragment key={p}>
                <button
                  onClick={() => setDraft(clamp(p, min, max))}
                  className={`quick-pill${mode === 'duration' ? ' wide' : ''}`}
                  style={{
                    background: draft === p ? 'var(--ink)' : 'var(--paper-2)',
                    color: draft === p ? 'var(--paper)' : 'var(--ink)',
                    border: `1px solid ${draft === p ? 'var(--ink)' : 'var(--rule-strong)'}`,
                  }}
                >
                  {mode === 'duration' ? Takt.fmtTime(p) : p}
                </button>
                {mode === 'int' && p === 5 && <div style={{ flexBasis: '100%', height: 0 }} />}
              </React.Fragment>
            ))}
          </div>

          <button className="btn btn-primary" onClick={commit} style={{ width: '100%', marginTop: 26 }}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}

function Chip({ label, display, onOpen }) {
  return (
    <button className="chip" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <span className="chip-label">{label}</span>
      <span className="chip-val mono">{display}</span>
    </button>
  );
}

function Interpretation({ open, parsed, onConfirm, onCancel, onUpdate, onSaveAsPreset, onStartOver, onEditField, transcript }) {
  if (!open || !parsed) return null;
  const { sets, workSec, restSec } = parsed;
  const workTotal = sets * workSec;
  const restTotal = Math.max(0, sets - 1) * restSec;
  const totalSec = workTotal + restTotal;

  return (
    <div className="screen" style={{ background: 'var(--paper)', zIndex: 60 }}>
      <TopBar
        left={<button className="icon-btn" onClick={onCancel} aria-label="Cancel"><Icon.Close /></button>}
      />

      <div className="scroll" style={{ flex: 1, padding: '12px 28px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div className="eyebrow">I heard</div>
          {transcript && onStartOver && (
            <button
              onClick={onStartOver}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 8px',
                fontSize: 12, fontWeight: 500, color: 'var(--mute)',
                textDecoration: 'underline', textUnderlineOffset: 3,
              }}
              aria-label="Not right, try again"
            >
              <Icon.Refresh size={12} color="var(--mute)" />
              Not right?
            </button>
          )}
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.3px', marginTop: 12, color: 'var(--ink-2)', lineHeight: 1.35, textWrap: 'balance' }}>
          “{transcript}”
        </div>

        <div style={{ height: 1, background: 'var(--rule)', margin: '32px 0 28px' }} />

        <div className="eyebrow" style={{ marginBottom: 14 }}>Session</div>

        {/* Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Sets" display={String(sets)} onOpen={() => onEditField('sets')} />
          <Chip label="Work" display={Takt.fmtTime(workSec)} onOpen={() => onEditField('work')} />
          <Chip label="Rest" display={Takt.fmtTime(restSec)} onOpen={() => onEditField('rest')} />
        </div>

        {/* Summary */}
        <div style={{ marginTop: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Total time</div>
          <div className="mono" style={{ fontSize: 52, fontWeight: 300, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
            {Takt.fmtTime(totalSec)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 8 }}>
            {Takt.fmtTime(workTotal)} work {restTotal > 0 && <>· {Takt.fmtTime(restTotal)} rest</>}
          </div>
        </div>

        <div style={{ height: 16 }} />
      </div>

      {/* Thumb-zone primary */}
      <div style={{ padding: '14px 24px 22px', borderTop: '1px solid var(--rule)', background: 'var(--paper)' }}>
        <button className="btn btn-primary" onClick={onConfirm} style={{ width: '100%', height: 58, fontSize: 17 }}>
          <Icon.Play size={18} color="var(--paper)" />
          Start
        </button>
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 12 }}>
          <button
            onClick={onSaveAsPreset}
            style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, padding: 8 }}
          >
            Save as preset
          </button>
          <span style={{ color: 'var(--rule-strong)' }}>·</span>
          <button
            onClick={onCancel}
            style={{ fontSize: 13, color: 'var(--mute)', fontWeight: 500, padding: 8 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

window.TaktScreens.StepperSheet = StepperSheet;

window.TaktScreens.Interpretation = Interpretation;
