// ABOUT: Timer route — a count-up stopwatch for rep-based exercises with no fixed duration.
// ABOUT: Reachable from Home and back; state lives in StopwatchProvider so it survives
// ABOUT: navigating away and returning, per SPECIFICATIONS/ARCHIVE/timer-mode.md.

import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { ProgressRing } from '@/components/ProgressRing';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
import { fmtTime } from '@/lib/format';
import { isNativePlatform } from '@/lib/platform';
import { ringProgress } from '@/lib/stopwatch/machine';
import { useElapsedMs, useStopwatch } from '@/lib/stopwatch/context';
import { acquire, release } from '@/lib/wakeLock';

// The ring needs smoother motion than a once-a-second digit update would give.
const RING_POLL_MS = 200;

// A distinct wake-lock owner from the stopwatch reducer's 'stopwatch': this one tracks the Timer
// screen being on-screen, that one tracks an active session. Two independent wanters, one owner
// each — the owner set converges them (07e stale-lock policy).
const SCREEN_WAKE_LOCK_OWNER = 'stopwatch-screen';

export function Timer() {
  const { t } = useI18n();
  const { phase, start, pause, resume, reset } = useStopwatch();
  const elapsed = useElapsedMs(RING_POLL_MS);

  const running = phase === 'running';
  const paused = phase === 'paused';
  const toggle = running ? pause : paused ? resume : start;
  const toggleLabel = running ? t('timer.pause') : paused ? t('timer.resume') : t('timer.start');

  // Native only (07e): keep-awake is not self-limiting like navigator.wakeLock, so a rehydrated
  // `running` stopwatch must not pin the screen on at app launch (handled by skipping the launch
  // re-acquire in useStopwatchMachine). Instead, hold the screen only while the running stopwatch
  // is actually shown here, and release on leave — so a forgotten running stopwatch can't keep the
  // screen awake on Settings/presets. On web this is inert (isNativePlatform() is false), leaving
  // the existing navigator.wakeLock behaviour byte-identical.
  useEffect(() => {
    if (!isNativePlatform() || !running) return;
    void acquire(SCREEN_WAKE_LOCK_OWNER);
    return () => {
      void release(SCREEN_WAKE_LOCK_OWNER);
    };
  }, [running]);

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
