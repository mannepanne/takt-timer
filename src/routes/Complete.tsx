// ABOUT: Complete route — totals, "Run it again" / Done, and "Save as preset" for signed-in users.

import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { PasskeyPrompt } from '@/components/PasskeyPrompt';
import { SavePresetSheet } from '@/components/SavePresetSheet';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
import { hasRegisteredBefore } from '@/lib/auth/local-hint';
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
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { session: authSession, login } = useSession();
  const state = location.state as CompleteState | null;
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [signinOpen, setSigninOpen] = useState(false);
  // Ghost-tap guard: Run → Complete navigation can produce a synthetic iOS click ~300ms
  // after touchend. Block pointer events for 400ms after mount so the click lands nowhere.
  const [interactable, setInteractable] = useState(false);

  const isAuthenticated = authSession.status === 'authenticated';

  useEffect(() => {
    const timerId = setTimeout(() => setInteractable(true), 400);
    return () => clearTimeout(timerId);
  }, []);

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
  const subtitle =
    session.sets === 1
      ? t('complete.subtitle.one', { workTime: fmtTime(session.workSec) })
      : t('complete.subtitle.many', { sets: session.sets, workTime: fmtTime(session.workSec) });

  return (
    <div className="screen">
      <TopBar
        left={
          <button
            className="icon-btn"
            aria-label={t('nav.backToHome')}
            onClick={done}
            type="button"
          >
            <Icon.Close />
          </button>
        }
      />

      <main className="complete-screen-body">
        <div className="complete-eyebrow-row">
          <Icon.Check size={20} color="var(--accent)" />
          <span className="eyebrow complete-eyebrow-label">{t('complete.title')}</span>
        </div>
        <h1 className="complete-title">{t('complete.heading')}</h1>
        <p className="complete-subtitle">{subtitle}</p>

        <div className="complete-divider" />

        <div className="complete-totals">
          <div>
            <div className="eyebrow complete-totals-label">{t('complete.totalTime')}</div>
            <div className="mono complete-totals-value">{fmtTime(totalSec)}</div>
          </div>
          <div>
            <div className="eyebrow complete-totals-label">{t('complete.workTime')}</div>
            <div className="mono complete-totals-value">{fmtTime(workTotal)}</div>
          </div>
        </div>
      </main>

      <div
        className="complete-actions"
        style={interactable ? undefined : { pointerEvents: 'none' }}
      >
        <button type="button" className="btn btn-primary" onClick={runAgain}>
          <Icon.Play size={18} color="var(--paper)" />
          {t('complete.runAgain')}
        </button>
        {isAuthenticated ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (interactable) setSaveSheetOpen(true);
            }}
          >
            {t('complete.savePreset')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (interactable) setSigninOpen(true);
            }}
          >
            {t('complete.signInToSave')}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={done}>
          {t('complete.done')}
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
        mode={hasRegisteredBefore() ? 'signin' : 'register'}
        onSuccess={(user) => {
          login(user);
          setSigninOpen(false);
        }}
        onClose={() => setSigninOpen(false)}
      />
    </div>
  );
}
