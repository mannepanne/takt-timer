// ABOUT: Configure route — edit a session's sets/work/rest via the Interpretation chips.
// ABOUT: Start navigates to /run with the session as router state.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { Interpretation } from '@/components/Interpretation';
import { TopBar } from '@/components/TopBar';
import { prepareAudio } from '@/lib/audio';
import type { Session } from '@/lib/timer/types';

const DEFAULT_SESSION: Session = { sets: 3, workSec: 60, restSec: 30 };

export function Configure() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session>(DEFAULT_SESSION);

  const start = () => {
    // Unlock audio on this user gesture so the first beep works on iOS Safari.
    prepareAudio();
    navigate('/run', { state: { session } });
  };

  return (
    <div className="screen">
      <TopBar
        left={
          <Link to="/" className="icon-btn" aria-label="Back to Home">
            <Icon.ChevronLeft />
          </Link>
        }
      />

      <main className="configure-screen-body">
        <div style={{ padding: '0 28px', textAlign: 'center' }}>
          <div className="eyebrow" style={{ color: 'var(--ink-3)' }}>
            Configure
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              lineHeight: 1.2,
              margin: '12px 0 0',
              textWrap: 'balance',
            }}
          >
            Build a session
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--ink-3)',
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            Tap any chip to edit it.
          </p>
        </div>

        <Interpretation value={session} onChange={setSession} />
      </main>

      <div className="configure-actions">
        <button type="button" className="btn btn-primary" onClick={start}>
          <Icon.Play size={18} color="var(--paper)" />
          Start
        </button>
      </div>
    </div>
  );
}
