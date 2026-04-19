// screens.jsx — main screen components for Takt
// Exposes Home, Running, Complete, Presets, Settings, Onboarding, VoiceOverlay, Interpretation

const { useState, useEffect, useRef } = React;

// ───────────────────────── Wordmark ─────────────────────────
function Wordmark({ size = 17 }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      takt<span className="bar" />
    </span>
  );
}

// ───────────────────────── TopBar ─────────────────────────
function TopBar({ left, right }) {
  return (
    <div className="topbar">
      <div style={{ minWidth: 40 }}>{left}</div>
      <Wordmark />
      <div style={{ minWidth: 40, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

// ───────────────────────── Home ─────────────────────────
function Home({ onVoiceTap, onVoiceHoldStart, onVoiceHoldEnd, onOpenPresets, onOpenSettings, onQuickStart, holding, lastSession, recentPresets, history }) {
  const [showPulse, setShowPulse] = useState(false);
  const [firstVisitHint, setFirstVisitHint] = useState(false);
  useEffect(() => {
    // one-shot pulse every time Home mounts — subtle mic affordance
    const t = setTimeout(() => setShowPulse(true), 400);
    const off = setTimeout(() => setShowPulse(false), 2600);
    // first-visit hint
    try {
      if (!localStorage.getItem('takt:firstMicHintShown')) {
        setFirstVisitHint(true);
      }
    } catch {}
    return () => { clearTimeout(t); clearTimeout(off); };
  }, []);

  // Sparkline of last 7 sessions (durations normalized)
  const weekHistory = (history || []).slice(-7);
  const streakCount = weekHistory.length;
  const maxDur = Math.max(1, ...weekHistory.map(h => h.totalSec || 0));

  return (
    <div className="screen" style={{ background: 'var(--paper)' }}>
      <TopBar
        left={<button className="icon-btn" onClick={onOpenPresets} aria-label="Presets"><Icon.List /></button>}
        right={<button className="icon-btn" onClick={onOpenSettings} aria-label="Settings"><Icon.Settings /></button>}
      />

      {/* Streak chip, if any */}
      {streakCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          <div className="history-chip">
            <div className="sparkline">
              {weekHistory.map((h, i) => (
                <span key={i} style={{ height: `${Math.max(2, (h.totalSec / maxDur) * 12)}px` }} />
              ))}
            </div>
            <span>{streakCount} {streakCount === 1 ? 'session' : 'sessions'} this week</span>
          </div>
        </div>
      )}

      {/* Spacer top */}
      <div style={{ flex: 1, minHeight: 20 }} />

      {/* Center card */}
      <div style={{ padding: '0 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Ready</div>
          <div style={{ fontSize: 34, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.15, maxWidth: 300, textWrap: 'balance' }}>
            What cadence do you need?
          </div>
          <div style={{ fontSize: 15, color: 'var(--mute)', marginTop: 14, maxWidth: 300, lineHeight: 1.5, textWrap: 'balance', margin: '14px auto 0' }}>
            {firstVisitHint ? (
              <>Try: <span style={{ color: 'var(--ink-2)' }}>“3 sets of 1 minute each, 30 seconds rest in between”</span></>
            ) : (
              <span>“3 sets of 1 minute each, 30 seconds rest in between”</span>
            )}
          </div>
        </div>

        {/* Mic button */}
        <div style={{ position: 'relative', width: 112, height: 112 }}>
          {holding && <div className="mic-pulse-ring" />}
          {holding && <div className="mic-pulse-ring" style={{ animationDelay: '0.6s' }} />}
          {!holding && showPulse && <div className="mic-pulse-once" />}
          <button
            onClick={() => {
              if (firstVisitHint) {
                try { localStorage.setItem('takt:firstMicHintShown', '1'); } catch {}
                setFirstVisitHint(false);
              }
              onVoiceTap();
            }}
            onMouseDown={onVoiceHoldStart}
            onMouseUp={onVoiceHoldEnd}
            onMouseLeave={onVoiceHoldEnd}
            onTouchStart={(e) => { e.preventDefault(); onVoiceHoldStart(); }}
            onTouchEnd={(e) => { e.preventDefault(); onVoiceHoldEnd(); }}
            style={{
              position: 'relative',
              width: 112, height: 112, borderRadius: 999,
              background: 'var(--ink)',
              color: 'var(--paper)',
              display: 'grid', placeItems: 'center',
              transition: 'transform 180ms var(--ease), background 240ms var(--ease)',
              transform: holding ? 'scale(1.08)' : 'scale(1)',
              boxShadow: '0 20px 40px rgba(14,17,22,0.18)',
            }}
            aria-label="Voice command"
          >
            <Icon.Mic size={34} />
          </button>
        </div>

      </div>

      <div style={{ flex: 1 }} />

      {/* Quick-start last session or recent */}
      {lastSession && (
        <div style={{ padding: '0 20px 24px' }}>
          <button
            onClick={() => onQuickStart(lastSession)}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px',
              borderRadius: 16,
              background: '#fff',
              border: '1px solid var(--rule)',
              textAlign: 'left',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--accent-deep)' }}>
              <Icon.Play size={16} color="var(--accent-deep)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--mute)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>Last session</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2, letterSpacing: '-0.2px' }}>
                {lastSession.name || `${lastSession.sets} × ${Takt.fmtTime(lastSession.workSec)}`}
                <span style={{ color: 'var(--mute)', fontWeight: 400 }}> · rest {Takt.fmtTime(lastSession.restSec)}</span>
              </div>
            </div>
            <Icon.ChevronRight size={18} color="var(--mute)" />
          </button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Voice Overlay ─────────────────────────
function VoiceOverlay({ open, transcript, onCancel, phase = 'listening' }) {
  const processing = phase === 'processing';
  return (
    <div className={`voice-layer ${open ? 'open' : ''}`}>
      <div style={{ flex: 1 }} />
      <div style={{ position: 'relative', width: 90, height: 90, marginBottom: 32 }}>
        {!processing && <div className="mic-pulse-ring" />}
        {!processing && <div className="mic-pulse-ring" style={{ animationDelay: '0.5s' }} />}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 999,
          background: processing ? 'var(--paper-2)' : 'var(--ink)',
          display: 'grid', placeItems: 'center',
          color: processing ? 'var(--ink-3)' : 'var(--paper)',
          transition: 'background 220ms var(--ease), color 220ms var(--ease)',
          border: processing ? '1px solid var(--rule-strong)' : 'none',
        }}>
          <Icon.Mic size={30} />
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--mute)', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {processing ? (
          <>
            <span>Thinking</span>
            <span className="proc-dots"><span className="pdot" /><span className="pdot" /><span className="pdot" /></span>
          </>
        ) : 'Listening'}
      </div>
      <div style={{
        padding: '0 36px', textAlign: 'center',
        fontSize: 22, fontWeight: 500, letterSpacing: '-0.4px', lineHeight: 1.35,
        color: processing ? 'var(--ink-3)' : 'var(--ink)',
        minHeight: 80, maxWidth: 380,
        textWrap: 'balance',
        transition: 'color 220ms var(--ease)',
      }}>
        {transcript ? `“${transcript}”` : <span style={{ color: 'var(--mute)', fontWeight: 400 }}>Speak when ready…</span>}
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn btn-ghost" onClick={onCancel} style={{ marginBottom: 40, background: '#fff' }}>
        Cancel
      </button>
    </div>
  );
}

window.TaktScreens = window.TaktScreens || {};
Object.assign(window.TaktScreens, { Home, VoiceOverlay, Wordmark, TopBar });
