// ABOUT: Android hardware back-button handler (07g). One listener, native-only. Confirms before
// ABOUT: leaving a running/paused interval session; otherwise exits the app at the root or navigates
// ABOUT: back. Renders nothing on web (no hardware back button).

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useI18n } from '@/i18n/context';
import { exitApp, subscribeBackButton } from '@/lib/app-lifecycle';
import { useIntervalActiveRef } from '@/lib/interval-active';
import { isNativePlatform } from '@/lib/platform';

export function NativeBackButton() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const activeRef = useIntervalActiveRef();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // The back listener is registered once; these refs feed it the live location and confirm-open
  // state without re-subscribing (which would drop the native handle mid-press).
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const confirmOpenRef = useRef(confirmOpen);
  confirmOpenRef.current = confirmOpen;

  useEffect(() => {
    if (!isNativePlatform()) return;
    return subscribeBackButton(() => {
      // If the confirm dialog is already up, back dismisses it (stay in the session).
      if (confirmOpenRef.current) {
        setConfirmOpen(false);
        return;
      }
      // An active interval session (running or paused) → confirm before leaving. Wins over the
      // stopwatch in the concurrent case, since only Run publishes activeRef.
      if (activeRef?.current) {
        setConfirmOpen(true);
        return;
      }
      // Root → exit the app (the stopwatch, if running, persists and resumes on relaunch).
      // Deeper screens → go back. Decided from the router, not the plugin's unreliable canGoBack.
      if (pathRef.current === '/') {
        void exitApp();
      } else {
        navigate(-1);
      }
    });
  }, [navigate, activeRef]);

  if (!confirmOpen) return null;

  const leave = () => {
    setConfirmOpen(false);
    navigate('/');
  };

  return (
    <div
      className="pause-toast-dialog"
      role="alertdialog"
      aria-labelledby="leave-confirm-title"
      aria-describedby="leave-confirm-body"
    >
      <div className="pause-toast-card">
        <h2 id="leave-confirm-title">{t('run.leaveConfirm.title')}</h2>
        <p id="leave-confirm-body">{t('run.leaveConfirm.body')}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setConfirmOpen(false)}
          autoFocus
        >
          {t('run.leaveConfirm.stay')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={leave}>
          {t('run.leaveConfirm.leave')}
        </button>
      </div>
    </div>
  );
}
