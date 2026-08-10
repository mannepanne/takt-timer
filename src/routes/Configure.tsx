// ABOUT: Configure route — edit a session's sets/work/rest via the Interpretation chips.
// ABOUT: Accepts a pre-populated session via location.state.session (voice handoff), plus an
// ABOUT: optional location.state.transcript rendered as a native-only "Heard: …" hint, and
// ABOUT: falls back to DEFAULT_SESSION when opened directly from Home. Start navigates to /run.

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { Interpretation } from '@/components/Interpretation';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
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

// Native voice passes the heard transcript alongside the session so we can show a "Heard: …" hint
// — the mitigation for a confident-but-misheard parse the parser can't catch. Validate it to a
// bounded, non-empty string (React escapes it; the cap keeps a runaway dictation from pushing the
// chips off a small screen). Web never passes it, so the hint is native-only in practice.
const TRANSCRIPT_MAX = 120;
function asTranscript(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.length > TRANSCRIPT_MAX ? `${text.slice(0, TRANSCRIPT_MAX)}…` : text;
}

export function Configure() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  // Voice handoff lands a parsed session in location.state. Clamp happens inside
  // Interpretation's Stepper bounds — zod enforced the server-side envelope already.
  const state = location.state as { session?: unknown; transcript?: unknown } | null;
  const handoffSession = asSession(state?.session);
  const initialSession = handoffSession ?? DEFAULT_SESSION;
  const [session, setSession] = useState<Session>(initialSession);
  // Gate the hint on a valid handed-off session: showing "Heard: …" above the DEFAULT_SESSION
  // chips (when the session was malformed) would misattribute defaults to the utterance.
  const heard = handoffSession ? asTranscript(state?.transcript) : null;

  const start = () => {
    // Unlock audio on this user gesture so the first beep works on iOS Safari.
    prepareAudio();
    navigate('/run', { state: { session } });
  };

  return (
    <div className="screen">
      <TopBar
        left={
          <Link to="/" className="icon-btn" aria-label={t('nav.backToHome')}>
            <Icon.ChevronLeft />
          </Link>
        }
      />

      <main className="configure-screen-body">
        <div className="configure-intro">
          <div className="eyebrow configure-intro-eyebrow">{t('configure.title')}</div>
          <h1 className="configure-intro-title">{t('configure.heading')}</h1>
          <p className="configure-intro-hint">{t('configure.hint')}</p>
          {heard && (
            <p className="configure-heard">
              {t('configure.heard')} <span className="configure-heard-text">{heard}</span>
            </p>
          )}
        </div>

        <Interpretation value={session} onChange={setSession} />
      </main>

      <div className="configure-actions">
        <button type="button" className="btn btn-primary" onClick={start}>
          <Icon.Play size={18} color="var(--paper)" />
          {t('configure.start')}
        </button>
      </div>
    </div>
  );
}
