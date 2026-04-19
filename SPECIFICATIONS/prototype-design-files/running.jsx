// running.jsx — Running session (work/rest) + Complete screen

function SetDots({ total, currentIdx, phase }) {
  return (
    <div className="set-dots">
      {Array.from({ length: total }).map((_, i) => {
        let cls = 'dot';
        if (i < currentIdx) cls += ' done';
        else if (i === currentIdx) cls += phase === 'rest' ? ' rest' : ' active';
        return <div key={i} className={cls} />;
      })}
    </div>
  );
}

function Running({ session, onStop, onPause, onResume, onSkip, onRepeatSet, paused, currentIdx, phase, secondsLeft, phaseTotal, cueFlash, countIn, soundOn }) {
  const progress = phaseTotal > 0 ? 1 - secondsLeft / phaseTotal : 0;
  const showCountdownPip = phaseTotal > 0 && secondsLeft > 0 && secondsLeft <= 3 && countIn == null;

  return (
    <div className="screen" style={{ background: phase === 'rest' ? '#EDEFF4' : 'var(--paper)', transition: 'background 300ms var(--ease)' }}>
      {/* progress bar */}
      <div className={`run-bar ${phase === 'rest' ? 'rest' : ''}`}>
        <div className="fill" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <div className="topbar" style={{ paddingTop: 22 }}>
        <button className="icon-btn" onClick={onStop} aria-label="Stop"><Icon.Close /></button>
        <SetDots total={session.sets} currentIdx={currentIdx} phase={phase} />
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', position: 'relative' }}>
        {/* phase label + tiny countdown pip */}
        <div className="eyebrow" style={{ color: phase === 'rest' ? 'var(--accent-deep)' : 'var(--ink-3)', marginBottom: 18, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span>{phase === 'rest' ? 'Rest' : 'Work'} &nbsp;·&nbsp; Set {currentIdx + 1} / {session.sets}</span>
          {showCountdownPip && soundOn && (
            <span
              key={secondsLeft}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'var(--accent-soft)',
                color: 'var(--accent-deep)',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                animation: 'flashIn 900ms var(--ease)',
              }}
            >
              <Icon.Volume size={10} color="var(--accent-deep)" /> {secondsLeft}
            </span>
          )}
        </div>

        {/* big numerals or count-in */}
        {countIn != null ? (
          <div className="mono timer-display" style={{ fontSize: 200, color: 'var(--ink)', fontWeight: 200 }}>
            {countIn}
          </div>
        ) : (
          <div
            key={`${phase}-${currentIdx}`}
            className="mono timer-display fade-enter-active"
            style={{ fontSize: 120, color: 'var(--ink)', fontWeight: 300 }}
          >
            {Takt.fmtTime(Math.max(0, secondsLeft))}
          </div>
        )}

        {/* transition cue caption chip — fixed-height slot so timer doesn't shift */}
        <div style={{ marginTop: 30, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cueFlash && (
            <div style={{
              padding: '8px 16px',
              background: 'var(--ink)',
              color: 'var(--paper)',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '-0.1px',
              animation: 'flashIn 1.6s var(--ease)',
            }}>
              <Icon.Volume size={14} color="var(--paper)" /> {cueFlash}
            </div>
          )}
        </div>
      </div>

      {/* controls */}
      <div style={{ padding: '0 24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <button
          onClick={onRepeatSet}
          disabled={currentIdx === 0 && phase === 'work' && progress < 0.05}
          style={{
            width: 56, height: 56, borderRadius: 999,
            background: '#fff', color: 'var(--ink-2)',
            border: '1px solid var(--rule)',
            display: 'grid', placeItems: 'center',
            opacity: (currentIdx === 0 && phase === 'work' && progress < 0.05) ? 0.4 : 1,
          }}
          aria-label="Repeat set"
          title="Repeat this set"
        >
          <Icon.SkipBack size={20} />
        </button>
        <button
          onClick={paused ? onResume : onPause}
          style={{
            width: 76, height: 76, borderRadius: 999,
            background: 'var(--ink)', color: 'var(--paper)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 12px 32px rgba(14,17,22,0.18)',
          }}
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          {paused ? <Icon.Play size={30} color="var(--paper)" /> : <Icon.Pause size={30} color="var(--paper)" />}
        </button>
        <button
          onClick={onSkip}
          style={{
            width: 56, height: 56, borderRadius: 999,
            background: '#fff', color: 'var(--ink-2)',
            border: '1px solid var(--rule)',
            display: 'grid', placeItems: 'center',
          }}
          aria-label="Skip"
          title="Skip this phase"
        >
          <Icon.Skip size={20} />
        </button>
      </div>
    </div>
  );
}

function Complete({ session, totalSec, onDone, onRepeat, onSaveAsPreset }) {
  return (
    <div className="screen" style={{ background: 'var(--paper)' }}>
      <TopBar left={<button className="icon-btn" onClick={onDone}><Icon.Close /></button>} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 32px' }}>
        <div style={{ color: 'var(--accent-deep)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon.Check size={20} color="var(--accent)" />
          <span className="eyebrow" style={{ color: 'var(--accent-deep)' }}>Complete</span>
        </div>
        <div style={{ fontSize: 42, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, lineHeight: 1.15, textWrap: 'balance' }}>
          Nicely done.
        </div>
        <div style={{ fontSize: 15, color: 'var(--mute)', marginTop: 8, lineHeight: 1.5 }}>
          {session.sets} sets · {Takt.fmtTime(session.workSec)} work each
        </div>

        <div style={{ height: 1, background: 'var(--rule)', margin: '32px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div className="eyebrow">Total time</div>
            <div className="mono" style={{ fontSize: 34, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 6 }}>
              {Takt.fmtTime(totalSec)}
            </div>
          </div>
          <div>
            <div className="eyebrow">Work time</div>
            <div className="mono" style={{ fontSize: 34, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 6 }}>
              {Takt.fmtTime(session.sets * session.workSec)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn btn-primary" onClick={onRepeat} style={{ width: '100%' }}>
          <Icon.Play size={18} color="var(--paper)" />
          Run it again
        </button>
        {!session.name && (
          <button className="btn btn-ghost" onClick={onSaveAsPreset} style={{ width: '100%' }}>
            Save as preset
          </button>
        )}
        <button className="btn btn-ghost" onClick={onDone} style={{ width: '100%', border: 'none' }}>
          Done
        </button>
      </div>
    </div>
  );
}

window.TaktScreens.Running = Running;
window.TaktScreens.Complete = Complete;
window.TaktScreens.SetDots = SetDots;
