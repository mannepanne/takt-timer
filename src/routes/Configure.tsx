// ABOUT: Configure route — edit a session's sets/work/rest via the Interpretation chips.
// ABOUT: Accepts a pre-populated session via location.state.session (voice handoff) and
// ABOUT: falls back to DEFAULT_SESSION when opened directly from Home. Start navigates to /run.

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { Interpretation } from '@/components/Interpretation';
import { TopBar } from '@/components/TopBar';
import { prepareAudio } from '@/lib/audio';
import type { Session } from '@/lib/timer/types';

const DEFAULT_SESSION: Session = { sets: 3, workSec: 60, restSec: 30 };

// Bounds match the worker-side zod envelope and the Interpretation Stepper limits.
// Any value outside these ranges — or NaN / Infinity / non-integer — falls back to
// DEFAULT_SESSION rather than reaching the Stepper, where Math.max(min, NaN) would
// propagate NaN into the run loop. `name` is stripped; Phase 3 voice never emits it
// and accepting it would widen the location.state trust boundary unnecessarily.
function isBoundedInt(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function asSession(value: unknown): Session | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (!isBoundedInt(obj.sets, 1, 99)) return null;
  if (!isBoundedInt(obj.workSec, 5, 3600)) return null;
  if (!isBoundedInt(obj.restSec, 0, 3600)) return null;
  return { sets: obj.sets, workSec: obj.workSec, restSec: obj.restSec };
}

export function Configure() {
  const navigate = useNavigate();
  const location = useLocation();
  // Voice handoff lands a parsed session in location.state. Clamp happens inside
  // Interpretation's Stepper bounds — zod enforced the server-side envelope already.
  const initialSession =
    asSession((location.state as { session?: unknown } | null)?.session) ?? DEFAULT_SESSION;
  const [session, setSession] = useState<Session>(initialSession);

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
        <div className="configure-intro">
          <div className="eyebrow configure-intro-eyebrow">Configure</div>
          <h1 className="configure-intro-title">Build a session</h1>
          <p className="configure-intro-hint">Tap any chip to edit it.</p>
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
