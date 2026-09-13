// ABOUT: Timer route — a count-up stopwatch for rep-based exercises with no fixed duration.
// ABOUT: Reachable from Home and back; state lives in StopwatchProvider so it survives
// ABOUT: navigating away and returning, per SPECIFICATIONS/ARCHIVE/timer-mode.md.

import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
import { fmtTime } from '@/lib/format';
import { minuteProgress } from '@/lib/stopwatch/machine';
import { useElapsedMs, useStopwatch } from '@/lib/stopwatch/context';
import { acquire, release } from '@/lib/wakeLock';

// The bar advances continuously; a sub-second poll keeps both it and the digits from stepping. The
// same value drives the digits (fmtTime), so this can't slow to 1s without visibly stuttering them.
const BAR_POLL_MS = 200;

// A distinct wake-lock owner from the stopwatch reducer's 'stopwatch': this one tracks the Timer
// screen being on-screen, that one tracks an active session. Two independent wanters, one owner
// each — the owner set converges them (stale-lock policy).
const SCREEN_WAKE_LOCK_OWNER = 'stopwatch-screen';

export function Timer() {
  const { t } = useI18n();
  const { phase, start, pause, resume, reset } = useStopwatch();
  const elapsed = useElapsedMs(BAR_POLL_MS);
  const digits = fmtTime(elapsed / 1000);
  // The stopwatch has no hour rollover, so past 99:59 the display is six characters ("100:00") and
  // would clip at 120px in the ~400px body; step down one size at that point.
  const compact = digits.length > 5;

  const running = phase === 'running';
  const paused = phase === 'paused';
  const toggle = running ? pause : paused ? resume : start;
  const toggleLabel = running ? t('timer.pause') : paused ? t('timer.resume') : t('timer.start');

  // Hold the screen only while a running stopwatch is actually shown here, releasing on leave — so
  // a rehydrated `running` stopwatch the user forgot to reset can't pin the screen awake on
  // Home/Settings/presets. The launch re-acquire in useStopwatchMachine is deliberately gone, so
  // this screen-scoped hold is the only thing keeping the screen on for the rehydrated case; an
  // active session started this session is additionally covered by the reducer's `stopwatch` owner.
  // Same policy on web and native (07e native, #131 web): on native keep-awake isn't self-limiting,
  // and on web navigator.wakeLock, though auto-released on hide, is still granted on a visible
  // unrelated screen — so both needed the on-screen scoping.
  useEffect(() => {
    if (!running) return;
    void acquire(SCREEN_WAKE_LOCK_OWNER);
    return () => {
      void release(SCREEN_WAKE_LOCK_OWNER);
    };
  }, [running]);

  return (
    <div className="screen timer-screen">
      {/* Per-minute progress bar, same construction as the run screens' bar. Static fill (no CSS
          transition) so the once-a-minute wrap resets instantly instead of animating backwards.
          Decorative, like the ring it replaces — the digits carry the information. */}
      <div className="run-bar accent static" aria-hidden="true">
        <div className="fill" style={{ transform: `scaleX(${minuteProgress(elapsed)})` }} />
      </div>

      <TopBar
        left={
          <Link to="/" className="icon-btn" aria-label={t('nav.backToHome')}>
            <Icon.ChevronLeft />
          </Link>
        }
      />

      <main className="timer-body">
        <div className={`mono timer-display timer-digits ${compact ? 'compact' : ''}`}>
          {digits}
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
