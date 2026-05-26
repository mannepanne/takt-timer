// ABOUT: Complete route — totals, "Run it again" / Done, and "Save as preset" for signed-in users.

import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { PasskeyPrompt } from '@/components/PasskeyPrompt';
import { SavePresetSheet } from '@/components/SavePresetSheet';
import { TopBar } from '@/components/TopBar';
import { useSession } from '@/lib/auth/session';
import { fmtTime } from '@/lib/format';
import { lastSession } from '@/lib/history';
import { pushSession } from '@/lib/history-sync';
import type { Session } from '@/lib/timer/types';

type CompleteState = {
  totalSec: number;
  completedAt: number;
  session: Session;
};

export function Complete() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session: authSession, login } = useSession();
  const state = location.state as CompleteState | null;
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [signinOpen, setSigninOpen] = useState(false);

  const isAuthenticated = authSession.status === 'authenticated';

  useEffect(() => {
    if (!state || !isAuthenticated) return;
    const completed = lastSession();
    if (completed && completed.completedAt === state.completedAt) {
      pushSession(completed).catch(() => {
        // Best-effort; session already in localStorage.
      });
    }
  }, [state, isAuthenticated]);

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
          <span className="eyebrow complete-eyebrow-label">Complete</span>
        </div>
        <h1 className="complete-title">Nicely done.</h1>
        <p className="complete-subtitle">
          {session.sets} sets · {fmtTime(session.workSec)} work each
        </p>

        <div className="complete-divider" />

        <div className="complete-totals">
          <div>
            <div className="eyebrow complete-totals-label">Total time</div>
            <div className="mono complete-totals-value">{fmtTime(totalSec)}</div>
          </div>
          <div>
            <div className="eyebrow complete-totals-label">Work time</div>
            <div className="mono complete-totals-value">{fmtTime(workTotal)}</div>
          </div>
        </div>
      </main>

      <div className="complete-actions">
        <button type="button" className="btn btn-primary" onClick={runAgain}>
          <Icon.Play size={18} color="var(--paper)" />
          Run it again
        </button>
        {isAuthenticated ? (
          <button type="button" className="btn btn-ghost" onClick={() => setSaveSheetOpen(true)}>
            Save as preset
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setSigninOpen(true)}>
            Sign in to save
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={done}>
          Done
        </button>
      </div>

      <SavePresetSheet
        open={saveSheetOpen}
        session={session}
        onClose={() => setSaveSheetOpen(false)}
        onSaved={() => {
          setSaveSheetOpen(false);
          done();
        }}
      />

      <PasskeyPrompt
        open={signinOpen}
        mode="signin"
        onSuccess={(user) => {
          login(user);
          setSigninOpen(false);
        }}
        onClose={() => setSigninOpen(false)}
      />
    </div>
  );
}
