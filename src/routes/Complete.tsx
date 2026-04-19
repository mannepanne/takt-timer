// ABOUT: Complete route — totals + "Run it again" / Done. Reads totals from router state.

import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { TopBar } from '@/components/TopBar';
import { fmtTime } from '@/lib/format';
import type { Session } from '@/lib/timer/types';

type CompleteState = {
  totalSec: number;
  completedAt: number;
  session: Session;
};

export function Complete() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CompleteState | null;

  if (!state) {
    return <Navigate to="/" replace />;
  }

  const { session, totalSec } = state;
  const runAgain = () => navigate('/run', { state: { session } });
  const done = () => navigate('/');

  const workTotal = session.sets * session.workSec;

  return (
    <div className="screen">
      <TopBar
        left={
          <button className="icon-btn" aria-label="Back to Home" onClick={done} type="button">
            <Icon.Close />
          </button>
        }
      />

      <main className="complete-screen-body">
        <div className="complete-eyebrow-row">
          <Icon.Check size={20} color="var(--accent)" />
          <span className="eyebrow" style={{ color: 'var(--accent-deep)' }}>
            Complete
          </span>
        </div>
        <h1 className="complete-title">Nicely done.</h1>
        <p className="complete-subtitle">
          {session.sets} sets · {fmtTime(session.workSec)} work each
        </p>

        <div className="complete-divider" />

        <div className="complete-totals">
          <div>
            <div className="eyebrow" style={{ color: 'var(--ink-3)' }}>
              Total time
            </div>
            <div className="mono complete-totals-value">{fmtTime(totalSec)}</div>
          </div>
          <div>
            <div className="eyebrow" style={{ color: 'var(--ink-3)' }}>
              Work time
            </div>
            <div className="mono complete-totals-value">{fmtTime(workTotal)}</div>
          </div>
        </div>
      </main>

      <div className="complete-actions">
        <button type="button" className="btn btn-primary" onClick={runAgain}>
          <Icon.Play size={18} color="var(--paper)" />
          Run it again
        </button>
        <button type="button" className="btn btn-ghost" onClick={done}>
          Done
        </button>
      </div>
    </div>
  );
}
