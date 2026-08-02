// ABOUT: Home screen — mic button, Configure CTA, optional last-session card, sparkline chip.
// ABOUT: For authenticated users, last session is fetched from the server.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { LastSessionCard } from '@/components/LastSessionCard';
import { MicButton } from '@/components/MicButton';
import { PresetsDrawer } from '@/components/PresetsDrawer';
import { Sparkline } from '@/components/Sparkline';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
import { useSession } from '@/lib/auth/session';
import { apiFetch } from '@/lib/apiFetch';
import { fmtTime } from '@/lib/format';
import { readHistory } from '@/lib/history';
import { useElapsedMs, useStopwatch } from '@/lib/stopwatch/context';
import type { CompletedSession } from '@/lib/timer/types';

type SessionRow = {
  completed_at: number;
  total_sec: number;
  sets: number;
  work_sec: number;
  rest_sec: number;
};

function rowToSession(row: SessionRow): CompletedSession {
  return {
    completedAt: row.completed_at,
    totalSec: row.total_sec,
    sets: row.sets,
    workSec: row.work_sec,
    restSec: row.rest_sec,
  };
}

export function Home() {
  const { t } = useI18n();
  const [history, setHistory] = useState<CompletedSession[]>([]);
  const [serverLast, setServerLast] = useState<CompletedSession | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const navigate = useNavigate();
  const { session: authSession } = useSession();
  const { phase: stopwatchPhase } = useStopwatch();
  const stopwatchElapsedMs = useElapsedMs(1000);

  const isAuthenticated = authSession.status === 'authenticated';

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiFetch('/api/sessions?latest=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((row: SessionRow | null) => {
        setServerLast(row ? rowToSession(row) : null);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const sessionCount = history.length;
  const last = isAuthenticated ? serverLast : sessionCount > 0 ? history[sessionCount - 1] : null;

  const runLast = () => {
    if (!last) return;
    navigate('/run', {
      state: {
        session: {
          sets: last.sets,
          workSec: last.workSec,
          restSec: last.restSec,
          name: last.name,
        },
      },
    });
  };

  const sessionCountLabel =
    sessionCount === 1 ? t('home.sessions.one') : t('home.sessions.many', { count: sessionCount });

  const timerLabel =
    stopwatchPhase === 'idle'
      ? t('home.timer')
      : t('home.timerRunning', { time: fmtTime(stopwatchElapsedMs / 1000) });

  return (
    <div className="screen">
      <TopBar
        left={
          isAuthenticated ? (
            <button
              className="icon-btn"
              aria-label={t('home.openPresets')}
              type="button"
              onClick={() => setPresetsOpen(true)}
            >
              <Icon.List size={20} />
            </button>
          ) : null
        }
        right={
          <Link to="/settings" className="icon-btn" aria-label={t('home.settings')}>
            <Icon.Settings size={20} />
          </Link>
        }
      />

      {sessionCount > 0 && !isAuthenticated && (
        <div className="home-history-chip-row">
          <div className="history-chip">
            <Sparkline entries={history} />
            <span>{sessionCountLabel}</span>
          </div>
        </div>
      )}

      <div className="home-spacer home-spacer-top" />

      <main className="home-hero">
        <div className="home-prompt-block">
          <div className="eyebrow home-prompt-eyebrow">{t('home.ready')}</div>
          <h1 className="home-prompt-title">{t('home.prompt')}</h1>
          <p className="home-prompt-example">
            <em>{t('home.example')}</em>
          </p>
        </div>

        <MicButton />
      </main>

      <div className="home-spacer" />

      <div className="home-cta-row">
        <Link to="/configure" className="btn btn-ghost">
          {t('home.configure')}
        </Link>
        <Link to="/timer" className="btn btn-ghost">
          {timerLabel}
        </Link>
      </div>

      {last && (
        <div className="last-session-card-wrap">
          <LastSessionCard session={last} onRun={runLast} />
        </div>
      )}

      <div className="home-footer">
        <Link to="/privacy">{t('home.privacy')}</Link>
      </div>

      {isAuthenticated && (
        <PresetsDrawer open={presetsOpen} onClose={() => setPresetsOpen(false)} />
      )}
    </div>
  );
}
