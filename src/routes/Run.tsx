// ABOUT: Run route — drives the session to completion via useTimerMachine.
// ABOUT: Reads Session from router state; without state, navigates back to Home.

import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { SetDots } from '@/components/SetDots';
import { setMuted } from '@/lib/audio';
import { fmtTime } from '@/lib/format';
import { useTimerMachine } from '@/lib/timer/useTimerMachine';
import type { Session } from '@/lib/timer/types';

const SOUND_KEY = 'takt.sound.v1';

function readInitialSound(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    if (raw === null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

type LocationState = { session?: Session } | null;

export function Run() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;
  const session = state?.session;

  // Without a session (e.g. direct URL load or refresh), go back to Home.
  if (!session) {
    return <Navigate to="/" replace />;
  }
  return (
    <RunInner
      session={session}
      onComplete={(totals) => navigate('/complete', { replace: true, state: totals })}
    />
  );
}

type RunInnerProps = {
  session: Session;
  onComplete: (totals: { totalSec: number; completedAt: number; session: Session }) => void;
};

function RunInner({ session, onComplete }: RunInnerProps) {
  const navigate = useNavigate();
  const api = useTimerMachine(session);
  const { state } = api;

  const [soundOn, setSoundOn] = useState<boolean>(readInitialSound);

  useEffect(() => {
    setMuted(!soundOn);
  }, [soundOn]);

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
    } catch {
      // Best-effort.
    }
  }, [soundOn]);

  // Auto-start on mount.
  const started = useStartedOnce(api.start);

  // On complete, navigate to /complete.
  useEffect(() => {
    if (state.phase === 'complete') {
      onComplete({
        totalSec: state.totalSec,
        completedAt: state.completedAt,
        session: state.session,
      });
    }
  }, [state, onComplete]);

  // Before start, show a blank screen.
  if (!started || state.phase === 'idle' || state.phase === 'complete') {
    return <div className="screen" aria-busy="true" />;
  }

  const paused = state.phase === 'paused';
  const countingIn = state.phase === 'countIn' || (paused && state.resumePhase === 'countIn');
  const phaseForUi = paused ? state.resumePhase : (state.phase as 'work' | 'rest' | 'countIn');
  const currentIdx = state.currentIdx;

  const showPip = api.secondsLeft > 0 && api.secondsLeft <= 3 && !countingIn && soundOn;

  return (
    <div className={`screen run-screen ${phaseForUi === 'rest' ? 'rest' : 'work'}`}>
      <div className={`run-bar ${phaseForUi === 'rest' ? 'rest' : ''}`}>
        <div className="fill" style={{ transform: `scaleX(${api.progress})` }} />
      </div>

      <div className="topbar run-header">
        <button
          className="icon-btn"
          onClick={() => {
            api.stop();
            navigate('/');
          }}
          aria-label="Stop session"
          type="button"
        >
          <Icon.Close />
        </button>
        <SetDots
          total={session.sets}
          currentIdx={currentIdx}
          phase={phaseForUi === 'rest' ? 'rest' : 'work'}
        />
        <button
          className={`run-sound-toggle ${soundOn ? '' : 'off'}`}
          onClick={() => setSoundOn((s) => !s)}
          aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}
          aria-pressed={!soundOn}
          type="button"
        >
          <Icon.Volume size={20} />
        </button>
      </div>

      <div className="run-body">
        <div
          className={`eyebrow run-phase-label ${phaseForUi === 'rest' ? 'rest' : ''}`}
          aria-live="polite"
        >
          <span>
            {countingIn
              ? 'Get ready'
              : `${phaseForUi === 'rest' ? 'Rest' : 'Work'} · Set ${currentIdx + 1} / ${session.sets}`}
          </span>
          {showPip && (
            <span className="run-pip-chip">
              <Icon.Volume size={10} color="var(--accent-deep)" /> {api.secondsLeft}
            </span>
          )}
        </div>

        {countingIn ? (
          <div className="mono run-timer-countin">{Math.max(1, api.secondsLeft)}</div>
        ) : (
          <div className="mono timer-display run-timer-big">{fmtTime(api.secondsLeft)}</div>
        )}
      </div>

      <div className="run-controls">
        <button
          className="run-ctrl-secondary"
          onClick={api.repeatSet}
          disabled={api.progress < 0.05 || countingIn}
          aria-label="Repeat set"
          title="Repeat this set"
          type="button"
        >
          <Icon.SkipBack size={20} />
        </button>
        <button
          className="run-ctrl-primary"
          onClick={paused ? api.resume : api.pause}
          aria-label={paused ? 'Resume' : 'Pause'}
          type="button"
        >
          {paused ? (
            <Icon.Play size={30} color="var(--paper)" />
          ) : (
            <Icon.Pause size={30} color="var(--paper)" />
          )}
        </button>
        <button
          className="run-ctrl-secondary"
          onClick={api.skip}
          aria-label="Skip phase"
          title="Skip this phase"
          type="button"
        >
          <Icon.Skip size={20} />
        </button>
      </div>

      {paused && state.phase === 'paused' && state.wasVisibilityPause && (
        <div className="pause-toast-dialog" role="alertdialog" aria-labelledby="pause-toast-title">
          <div className="pause-toast-card">
            <h2 id="pause-toast-title">Session paused</h2>
            <p>
              Your phone was locked or the tab went to the background. Ready to pick up where you
              left off?
            </p>
            <button type="button" className="btn btn-primary" onClick={api.resume}>
              <Icon.Play size={18} color="var(--paper)" />
              Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Start the machine once per mount (avoids double-start under StrictMode dev double-render).
function useStartedOnce(start: () => void): boolean {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!started) {
      start();
      setStarted(true);
    }
  }, [started, start]);
  return started;
}
