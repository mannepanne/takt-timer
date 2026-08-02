// ABOUT: Timer route — a count-up stopwatch for rep-based exercises with no fixed duration.
// ABOUT: Reachable from Home and back; state lives in StopwatchProvider so it survives
// ABOUT: navigating away and returning, per SPECIFICATIONS/timer-mode.md.

import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { ProgressRing } from '@/components/ProgressRing';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
import { fmtTime } from '@/lib/format';
import { ringProgress } from '@/lib/stopwatch/machine';
import { useElapsedMs, useStopwatch } from '@/lib/stopwatch/context';

// The ring needs smoother motion than a once-a-second digit update would give.
const RING_POLL_MS = 200;

export function Timer() {
  const { t } = useI18n();
  const { phase, start, pause, resume, reset } = useStopwatch();
  const elapsed = useElapsedMs(RING_POLL_MS);

  const running = phase === 'running';
  const paused = phase === 'paused';
  const toggle = running ? pause : paused ? resume : start;
  const toggleLabel = running ? t('timer.pause') : paused ? t('timer.resume') : t('timer.start');

  return (
    <div className="screen timer-screen">
      <TopBar
        left={
          <Link to="/" className="icon-btn" aria-label={t('nav.backToHome')}>
            <Icon.ChevronLeft />
          </Link>
        }
      />

      <main className="timer-body">
        <div className="timer-ring-wrap">
          <ProgressRing progress={ringProgress(elapsed)} />
          <div className="mono timer-display timer-digits">{fmtTime(elapsed / 1000)}</div>
        </div>
      </main>

      <div className="timer-controls">
        <button
          className="btn btn-ghost"
          onClick={reset}
          aria-label={t('timer.reset')}
          type="button"
        >
          <Icon.Refresh size={18} />
          {t('timer.reset')}
        </button>
        <button className="btn btn-primary" onClick={toggle} aria-label={toggleLabel} type="button">
          {toggleLabel}
        </button>
      </div>
    </div>
  );
}
