// presets-settings.jsx — Presets drawer, Settings screen, Onboarding, SavePresetSheet

const { useState: useStatePS, useEffect: useEffectPS, useRef: useRefPS } = React;

function PresetsDrawer({ open, presets, onClose, onRun, onEdit, onDelete, onCreate, onTogglePin, onDuplicate, onReorder }) {
  const [confirmId, setConfirmId] = useStatePS(null);
  const [dragId, setDragId] = useStatePS(null);
  const [dragY, setDragY] = useStatePS(0);
  const dragStartRef = useRefPS(null);
  const longPressTimer = useRefPS(null);
  const cardRefs = useRefPS({});

  useEffectPS(() => { if (!open) { setConfirmId(null); setDragId(null); } }, [open]);

  // Sort: pinned first, preserve insertion order within groups
  const sorted = [...presets].sort((a, b) => {
    if (!!a.pinned === !!b.pinned) return 0;
    return a.pinned ? -1 : 1;
  });

  const onPointerDownCard = (e, p) => {
    if (confirmId) return;
    // Only start drag on grip / long-press on card
    const startY = e.clientY;
    dragStartRef.current = { y: startY, id: p.id, moved: false };
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setDragId(p.id);
      setDragY(0);
      try { navigator.vibrate && navigator.vibrate(12); } catch {}
    }, 420);
  };
  const onPointerMoveCard = (e) => {
    if (!dragStartRef.current) return;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dy) > 6) dragStartRef.current.moved = true;
    if (dragId) {
      setDragY(dy);
    }
  };
  const endDrag = () => {
    clearTimeout(longPressTimer.current);
    if (dragId != null && onReorder) {
      // determine new index based on dragY and card height (estimate)
      const cardH = 96; // approx card height
      const delta = Math.round(dragY / cardH);
      const idxInSorted = sorted.findIndex(p => p.id === dragId);
      if (delta !== 0 && idxInSorted !== -1) {
        const newIdx = Math.max(0, Math.min(sorted.length - 1, idxInSorted + delta));
        onReorder(dragId, sorted[newIdx].id);
      }
    }
    setDragId(null);
    setDragY(0);
    dragStartRef.current = null;
  };

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`drawer ${open ? 'open' : ''}`}>
        <div className="drawer-handle" />
        <div style={{ padding: '0 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.4px' }}>Presets</div>
            <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>Tap star to pin · hold card to reorder</div>
          </div>
          <button className="icon-btn" onClick={onCreate} aria-label="New preset">
            <Icon.Plus />
          </button>
        </div>
        <div
          className="scroll"
          style={{ padding: '8px 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}
          onPointerMove={onPointerMoveCard}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onPointerCancel={endDrag}
        >
          {presets.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--mute)', fontSize: 14, lineHeight: 1.6 }}>
              No presets yet.<br/>
              <span style={{ fontSize: 13 }}>Say “save as preset called [name]” after a session.</span>
            </div>
          )}
          {sorted.map((p) => {
            const confirming = confirmId === p.id;
            const dragging = dragId === p.id;
            return (
              <div
                key={p.id}
                ref={(el) => { cardRefs.current[p.id] = el; }}
                className={`preset-card${p.pinned ? ' pinned' : ''}${dragging ? ' dragging' : ''}`}
                style={dragging ? { transform: `translateY(${dragY}px) scale(1.02)` } : undefined}
                onPointerDown={(e) => onPointerDownCard(e, p)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <button
                    className={`icon-btn star-btn${p.pinned ? ' on' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onTogglePin && onTogglePin(p.id); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ width: 32, height: 32 }}
                    aria-label={p.pinned ? 'Unpin' : 'Pin'}
                  >
                    <Icon.Star size={16} color={p.pinned ? 'var(--accent)' : 'var(--mute)'} filled={p.pinned} />
                  </button>
                  <div style={{ flex: 1 }}>
                    <div className="title">{p.name}</div>
                    <div className="meta" style={{ marginTop: 4 }}>
                      {p.sets} × {Takt.fmtTime(p.workSec)} · rest {Takt.fmtTime(p.restSec)}
                    </div>
                  </div>
                  {!confirming && (
                    <>
                      <button
                        className="icon-btn"
                        onClick={(e) => { e.stopPropagation(); onDuplicate && onDuplicate(p.id); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ width: 32, height: 32 }}
                        aria-label="Duplicate"
                        title="Duplicate"
                      >
                        <Icon.Copy size={15} color="var(--mute)" />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={(e) => { e.stopPropagation(); setConfirmId(p.id); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ width: 32, height: 32 }}
                        aria-label="Delete"
                      >
                        <Icon.Trash size={16} color="var(--mute)" />
                      </button>
                    </>
                  )}
                </div>
                {confirming ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                      Delete this preset?
                    </div>
                    <button
                      onClick={() => setConfirmId(null)}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        height: 42, padding: '0 16px', borderRadius: 999,
                        background: 'transparent', color: 'var(--ink-2)',
                        fontSize: 14, fontWeight: 500,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { onDelete(p.id); setConfirmId(null); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        height: 42, padding: '0 18px', borderRadius: 999,
                        background: '#B3261E', color: '#fff',
                        fontSize: 14, fontWeight: 600,
                        border: 'none',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => onRun(p)}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ flex: 1, height: 42, fontSize: 14 }}
                    >
                      <Icon.Play size={14} color="var(--paper)" /> Run
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Settings({ open, settings, onChange, onClose, accentOptions, onAccentChange, onOnboardingReplay }) {
  if (!open) return null;
  const Toggle = ({ label, icon, value, onToggle, hint }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '16px 20px',
      borderBottom: '1px solid var(--rule)',
    }}>
      <div style={{ color: 'var(--ink-3)' }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.2px' }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div className={`switch ${value ? 'on' : ''}`} onClick={onToggle}>
        <div className="knob" />
      </div>
    </div>
  );

  return (
    <div className="screen" style={{ background: 'var(--paper)', zIndex: 70 }}>
      <TopBar left={<button className="icon-btn" onClick={onClose}><Icon.ChevronLeft /></button>} />

      <div className="scroll" style={{ flex: 1, padding: '8px 0 24px' }}>
        <div style={{ padding: '0 24px 22px' }}>
          <div className="eyebrow">Preferences</div>
          <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.4px', marginTop: 8 }}>Settings</div>
        </div>

        <div style={{ padding: '0 4px' }}>
          <div style={{ padding: '10px 20px 6px', fontSize: 12, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Cues</div>
          <div style={{ background: '#fff', margin: '0 16px', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--rule)' }}>
            <Toggle
              label="Sound"
              hint="Beeps on transitions, 3·2·1 before each phase"
              icon={<Icon.Volume size={18} />}
              value={settings.sound}
              onToggle={() => onChange({ sound: !settings.sound })}
            />
            <Toggle
              label="Count-in 3·2·1"
              hint="Big numerals before starting"
              icon={<Icon.Sparkle size={18} />}
              value={settings.countIn}
              onToggle={() => onChange({ countIn: !settings.countIn })}
            />
            <Toggle
              label="Voice callouts"
              hint="“Rest”, “Work, set 2”"
              icon={<Icon.Volume size={18} />}
              value={settings.voiceCues}
              onToggle={() => onChange({ voiceCues: !settings.voiceCues })}
            />
            <Toggle
              label="Haptics"
              hint="Buzz on transitions (mobile)"
              icon={<Icon.Vibrate size={18} />}
              value={settings.haptic}
              onToggle={() => onChange({ haptic: !settings.haptic })}
            />
          </div>

          <div style={{ padding: '22px 20px 6px', fontSize: 12, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Session</div>
          <div style={{ background: '#fff', margin: '0 16px', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--rule)' }}>
            <Toggle
              label="Keep screen awake"
              hint="Prevent dimming during a session"
              icon={<Icon.Sparkle size={18} />}
              value={settings.wakeLock}
              onToggle={() => onChange({ wakeLock: !settings.wakeLock })}
            />
          </div>

          <div style={{ padding: '22px 20px 6px', fontSize: 12, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Accent</div>
          <div style={{ background: '#fff', margin: '0 16px', borderRadius: 16, padding: 18, border: '1px solid var(--rule)' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {accentOptions.map((a) => (
                <button key={a.color} onClick={() => onAccentChange(a.color)}
                  style={{
                    width: 36, height: 36, borderRadius: 999,
                    background: a.color,
                    border: settings.accent === a.color ? '2px solid var(--ink)' : '2px solid transparent',
                    transition: 'all 160ms var(--ease)',
                    transform: settings.accent === a.color ? 'scale(1.06)' : 'scale(1)',
                  }}
                  aria-label={a.name} />
              ))}
            </div>
          </div>

          <div style={{ padding: '22px 20px 6px', fontSize: 12, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>About</div>
          <div style={{ background: '#fff', margin: '0 16px', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--rule)' }}>
            <button onClick={onOnboardingReplay} style={{ width: '100%', textAlign: 'left', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--rule)' }}>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>Replay intro</div>
              <Icon.ChevronRight size={16} color="var(--mute)" />
            </button>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>Version</div>
              <div style={{ fontSize: 13, color: 'var(--mute)' }} className="mono">1.0.0</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Onboarding({ onDone }) {
  const [page, setPage] = useStatePS(0);
  const pages = [
    {
      eyebrow: 'Takt',
      title: 'Keep the beat.',
      body: 'A timer for sessions that repeat — work, rest, repeat.',
      art: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: 'JetBrains Mono, monospace' }}>
          <div style={{ fontSize: 72, fontWeight: 200, color: 'var(--ink)', letterSpacing: '-0.04em' }}>01:00</div>
        </div>
      ),
    },
    {
      eyebrow: 'Voice first',
      title: 'Just say it.',
      body: '“3 sets of 1 minute, 30 seconds rest.” Tap the mic and speak.',
      art: (
        <div style={{ position: 'relative', width: 96, height: 96 }}>
          <div className="mic-pulse-ring" />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--ink)', display: 'grid', placeItems: 'center', color: 'var(--paper)' }}>
            <Icon.Mic size={32} />
          </div>
        </div>
      ),
    },
    {
      eyebrow: 'Your routines',
      title: 'Save &amp; recall.',
      body: '“Save this as basic rehab pattern.” Later: “Run basic rehab pattern.”',
      art: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 260 }}>
          {['Basic rehab', 'Tabata', 'Cooldown'].map((n, i) => (
            <div key={n} style={{
              padding: '12px 16px', borderRadius: 12,
              background: '#fff', border: '1px solid var(--rule)',
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: 1 - i * 0.25,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>{n}</div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const p = pages[page];
  return (
    <div className="screen" style={{ background: 'var(--paper)', zIndex: 80 }}>
      <div style={{ padding: '24px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onDone} style={{ fontSize: 14, color: 'var(--mute)', padding: 8 }}>Skip</button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center', gap: 40 }}>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 140 }}>
          {p.art}
        </div>
        <div>
          <div className="eyebrow">{p.eyebrow}</div>
          <div style={{ fontSize: 34, fontWeight: 500, letterSpacing: '-0.4px', marginTop: 10, lineHeight: 1.15, textWrap: 'balance' }} dangerouslySetInnerHTML={{ __html: p.title }} />
          <div style={{ fontSize: 15, color: 'var(--mute)', marginTop: 14, lineHeight: 1.55, maxWidth: 320, textWrap: 'balance', margin: '14px auto 0' }}>{p.body}</div>
        </div>
      </div>
      <div style={{ padding: '0 24px 36px', display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}>
        <div className="pager">
          {pages.map((_, i) => <div key={i} className={`pd ${i === page ? 'active' : ''}`} />)}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => page < pages.length - 1 ? setPage(page + 1) : onDone()}
          style={{ width: '100%' }}
        >
          {page < pages.length - 1 ? 'Next' : 'Get started'}
        </button>
      </div>
    </div>
  );
}

function SavePresetSheet({ open, onClose, onSave, defaultName = '' }) {
  const [name, setName] = useStatePS(defaultName);
  const [mode, setMode] = useStatePS('voice'); // 'voice' | 'type' | 'listening'
  const inputRef = useRefPS(null);
  const listenTimer = useRefPS(null);

  useEffectPS(() => {
    if (!open) return;
    setName(defaultName);
    setMode('listening');
    clearTimeout(listenTimer.current);
    const target = EXAMPLE_NAMES[Math.floor(Math.random() * EXAMPLE_NAMES.length)];
    listenTimer.current = setTimeout(() => {
      setName(target);
      listenTimer.current = setTimeout(() => {
        onSave(target);
      }, 900);
    }, 1500);
    return () => clearTimeout(listenTimer.current);
  }, [open]);
  useEffectPS(() => {
    if (open && mode === 'type' && inputRef.current) setTimeout(() => inputRef.current.focus(), 150);
  }, [open, mode]);

  const EXAMPLE_NAMES = [
    'basic rehab pattern',
    'morning mobility',
    'quick tabata',
    'knee recovery',
    'breath work',
  ];

  const startListen = () => {
    setMode('listening');
    setName('');
    clearTimeout(listenTimer.current);
    const target = EXAMPLE_NAMES[Math.floor(Math.random() * EXAMPLE_NAMES.length)];
    listenTimer.current = setTimeout(() => {
      setName(target);
      listenTimer.current = setTimeout(() => {
        onSave(target);
      }, 900);
    }, 1500);
  };

  const cancelListen = () => {
    clearTimeout(listenTimer.current);
    setMode('voice');
    setName('');
  };

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'open' : ''}`} onClick={onClose} style={{ zIndex: 90 }} />
      <div className={`drawer ${open ? 'open' : ''}`} style={{ maxHeight: '70%', zIndex: 91 }}>
        <div className="drawer-handle" />
        <div style={{ padding: '0 24px 28px' }}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px' }}>Save as preset</div>
          <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 4 }}>
            {mode === 'listening' ? 'Listening for a name…' : mode === 'type' ? 'Type a name for this session.' : 'Speak a name, or type it.'}
          </div>

          {(mode === 'voice' || mode === 'listening') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0 8px' }}>
              <div style={{ position: 'relative', width: 88, height: 88, marginBottom: 18 }}>
                {mode === 'listening' && <div className="mic-pulse-ring" />}
                {mode === 'listening' && <div className="mic-pulse-ring" style={{ animationDelay: '0.5s' }} />}
                <div
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 999,
                    background: 'var(--ink)', color: 'var(--paper)',
                    display: 'grid', placeItems: 'center',
                    boxShadow: '0 14px 30px rgba(14,17,22,0.16)',
                  }}
                >
                  <Icon.Mic size={30} />
                </div>
              </div>
              <div style={{
                minHeight: 28, fontSize: 18, fontWeight: 500, color: 'var(--ink)',
                letterSpacing: '-0.2px', textAlign: 'center',
              }}>
                {name ? `“${name}”` : (
                  <span style={{ color: 'var(--mute)', fontWeight: 400, fontSize: 14 }}>
                    Listening…
                  </span>
                )}
              </div>
            </div>
          )}

          {mode === 'type' && (
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSave(name.trim())}
              placeholder="e.g. basic rehab pattern"
              style={{
                width: '100%', marginTop: 20,
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--rule-strong)',
                background: '#fff',
                fontSize: 16,
                fontFamily: 'inherit',
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
          )}

          {(mode === 'voice' || mode === 'listening') && (
            <button
              onClick={() => { clearTimeout(listenTimer.current); setMode('type'); setName(''); }}
              style={{
                width: '100%', marginTop: 4, padding: '10px 0',
                fontSize: 13, color: 'var(--mute)', fontWeight: 500,
                textDecoration: 'underline', textUnderlineOffset: 3,
              }}
            >
              Type a name instead
            </button>
          )}

          {mode === 'type' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim()} style={{ flex: 1, opacity: name.trim() ? 1 : 0.5 }}>
                Save
              </button>
            </div>
          )}

          {false && mode === 'listening' && (
            <button className="btn btn-ghost" onClick={cancelListen} style={{ width: '100%', marginTop: 18 }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </>
  );
}

window.TaktScreens.PresetsDrawer = PresetsDrawer;
window.TaktScreens.Settings = Settings;
window.TaktScreens.Onboarding = Onboarding;
window.TaktScreens.SavePresetSheet = SavePresetSheet;
