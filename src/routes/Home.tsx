// ABOUT: Home screen — demo mic button (Phase 3 arrives), Configure CTA,
// ABOUT: optional last-session quick-start card, optional sparkline chip.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { LastSessionCard } from '@/components/LastSessionCard';
import { MicButton } from '@/components/MicButton';
import { Sparkline } from '@/components/Sparkline';
import { TopBar } from '@/components/TopBar';
import { readHistory } from '@/lib/history';
import type { CompletedSession } from '@/lib/timer/types';

export function Home() {
  const [history, setHistory] = useState<CompletedSession[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const sessionCount = history.length;
  const last = sessionCount > 0 ? history[sessionCount - 1] : null;

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
      <TopBar />

      {sessionCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          <div className="history-chip">
            <Sparkline entries={history} />
            <span>
              {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'} so far
            </span>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 20 }} />

      <main className="home-hero">
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow home-prompt-eyebrow" style={{ color: 'var(--ink-3)' }}>
            Ready
          </div>
          <h1 className="home-prompt-title">What cadence do you need?</h1>
          <p className="home-prompt-example">
            <em>&ldquo;3 sets of 1 minute, 30 seconds rest between each&rdquo;</em>
          </p>
        </div>

        <MicButton />
      </main>

      <div style={{ flex: 1 }} />

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
    </div>
  );
}
