// ABOUT: Home screen — mic button, Configure CTA, optional last-session card, sparkline chip.
// ABOUT: For authenticated users, last session is fetched from the server.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { LastSessionCard } from '@/components/LastSessionCard';
import { MicButton } from '@/components/MicButton';
import { PasskeyPrompt } from '@/components/PasskeyPrompt';
import { PresetsDrawer } from '@/components/PresetsDrawer';
import { Sparkline } from '@/components/Sparkline';
import { TopBar } from '@/components/TopBar';
import { type AuthUser } from '@/lib/auth/client';
import { useSession } from '@/lib/auth/session';
import { apiFetch } from '@/lib/apiFetch';
import { readHistory } from '@/lib/history';
import { importLocalHistory } from '@/lib/history-sync';
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
  const [history, setHistory] = useState<CompletedSession[]>([]);
  const [serverLast, setServerLast] = useState<CompletedSession | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const navigate = useNavigate();
  const { session: authSession, login } = useSession();

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

  async function handleRegisterSuccess(user: AuthUser) {
    try {
      await importLocalHistory();
    } catch {
      // import failure is non-fatal — account is created regardless
    }
    login(user);
    setRegisterOpen(false);
  }

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

  return (
    <div className="screen">
      <TopBar
        left={
          isAuthenticated ? (
            <button
              className="icon-btn"
              aria-label="Open presets"
              type="button"
              onClick={() => setPresetsOpen(true)}
            >
              <Icon.List size={20} />
            </button>
          ) : undefined
        }
        right={
          isAuthenticated ? (
            <Link to="/account" className="icon-btn" aria-label="Account">
              <Icon.User size={20} />
            </Link>
          ) : (
            <button
              className="icon-btn"
              aria-label="Create account"
              type="button"
              onClick={() => setRegisterOpen(true)}
            >
              <Icon.User size={20} />
            </button>
          )
        }
      />

      {sessionCount > 0 && !isAuthenticated && (
        <div className="home-history-chip-row">
          <div className="history-chip">
            <Sparkline entries={history} />
            <span>
              {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'} so far
            </span>
          </div>
        </div>
      )}

      <div className="home-spacer home-spacer-top" />

      <main className="home-hero">
        <div className="home-prompt-block">
          <div className="eyebrow home-prompt-eyebrow">Ready</div>
          <h1 className="home-prompt-title">What cadence do you need?</h1>
          <p className="home-prompt-example">
            <em>&ldquo;3 sets of 1 minute, 30 seconds rest between each&rdquo;</em>
          </p>
        </div>

        <MicButton />
      </main>

      <div className="home-spacer" />

      <div className="home-cta-row">
        <Link to="/configure" className="btn btn-primary">
          <Icon.Play size={18} color="var(--paper)" />
          Configure a session
        </Link>
      </div>

      {last && (
        <div className="last-session-card-wrap">
          <LastSessionCard session={last} onRun={runLast} />
        </div>
      )}

      <div className="home-footer">
        <Link to="/privacy">Privacy</Link>
      </div>

      {isAuthenticated && (
        <PresetsDrawer open={presetsOpen} onClose={() => setPresetsOpen(false)} />
      )}
      <PasskeyPrompt
        open={registerOpen}
        mode="register"
        onSuccess={handleRegisterSuccess}
        onClose={() => setRegisterOpen(false)}
      />
    </div>
  );
}
