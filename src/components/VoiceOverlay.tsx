// ABOUT: Voice capture overlay — renders the state-specific UI for each VoiceState phase.
// ABOUT: Purely presentational; the stateful machine lives in useVoiceMachine.

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { useI18n, type TFunc } from '@/i18n/context';
import { isNativePlatform } from '@/lib/platform';
import type { ErrorReason, VoiceState } from '@/lib/voice/types';

type Props = {
  state: VoiceState;
  onUserStop: () => void;
  onCancel: () => void;
  onRetry: () => void;
  // Native-only: opens the app's settings page from the permission-denied sheet (07f). Undefined
  // on web, where the sheet never renders a settings control.
  onOpenSettings?: () => void;
};

const OVERLAY_BODY_ID = 'voice-overlay-body';

function formatRetryAfter(retryAfterSec: number, t: TFunc): string {
  if (!Number.isFinite(retryAfterSec) || retryAfterSec <= 0) {
    return t('voice.rateLimit.noTime');
  }
  // Under 2h shows in minutes so 61–119min doesn't get over-promised as "2 hours".
  // Math.floor would under-promise (61min → "1 hour" → retry rejected); Math.ceil
  // on minutes keeps direction-honesty without inflating the wait.
  const totalMinutes = Math.ceil(retryAfterSec / 60);
  if (totalMinutes < 120) {
    if (totalMinutes === 1) return t('voice.rateLimit.oneMinute');
    return t('voice.rateLimit.minutes', { count: totalMinutes });
  }
  const hours = Math.ceil(retryAfterSec / 3600);
  // The singular branch is structurally unreachable: this arm only runs when
  // totalMinutes ≥ 120, which forces hours ≥ 2. The ternary stays as defensive
  // code in case the 120-minute threshold ever changes.
  /* v8 ignore next */
  return t('voice.rateLimit.hours', { count: hours });
}

// Exhaustive over ErrorReason so the compiler flags any new reason that lands
// in `parse-error` without a conscious decision about overlay copy. The default
// arm is unreachable at runtime — `_exhaustive: never` is the type-level guard.
function parseErrorCopy(reason: ErrorReason, t: TFunc): string {
  switch (reason) {
    case 'not-a-session':
      return t('voice.error.notASession');
    case 'cold-start-timeout':
      return t('voice.error.coldStartTimeout');
    case 'upload-empty':
    case 'upload-too-large':
    case 'origin-not-allowed':
    case 'empty-transcript':
    case 'language-unsupported':
    case 'whisper-error':
    case 'llama-error':
    case 'schema-failed':
    case 'method-not-allowed':
    case 'rate-limited':
    case 'network-error':
    case 'malformed-stream':
      return t('voice.error.genericBody');
    /* v8 ignore next 4 — unreachable; the `never`-typed default is a compile-time guard, not a runtime branch. */
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

export function VoiceOverlay({
  state,
  onUserStop,
  onCancel,
  onRetry,
  onOpenSettings,
}: Props): React.ReactNode {
  const { t } = useI18n();
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // Focus the Cancel button when an error state arrives — matches the Phase 2
  // pause-toast focus pattern. Stable focus target regardless of which buttons
  // the error variant renders.
  useEffect(() => {
    if (isErrorState(state.phase)) {
      cancelBtnRef.current?.focus();
    }
  }, [state.phase]);

  if (state.phase === 'idle') return null;

  const titleId = `voice-overlay-title-${state.phase}`;

  return (
    <div
      className="voice-overlay-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={isErrorState(state.phase) ? OVERLAY_BODY_ID : undefined}
    >
      <div className="voice-overlay-sheet">
        {renderContent(state, titleId, onUserStop, onRetry, t, isNativePlatform(), onOpenSettings)}

        <button
          type="button"
          className="btn btn-ghost voice-overlay-cancel"
          onClick={onCancel}
          ref={cancelBtnRef}
        >
          {t('voice.cancel')}
        </button>
      </div>
    </div>
  );
}

function renderContent(
  state: VoiceState,
  titleId: string,
  onUserStop: () => void,
  onRetry: () => void,
  t: TFunc,
  native: boolean,
  onOpenSettings?: () => void,
): React.ReactNode {
  switch (state.phase) {
    case 'requesting-permission':
      return progressSheet(titleId, t('voice.requesting'), 'pulse');
    case 'listening':
      return (
        <>
          <h2 id={titleId} className="voice-overlay-title">
            {t('voice.listening')}
          </h2>
          <button
            type="button"
            className="voice-overlay-mic voice-overlay-mic--pulse voice-overlay-mic--button"
            onClick={onUserStop}
            aria-label="Stop recording"
          >
            <Icon.Mic size={48} />
          </button>
        </>
      );
    case 'uploading':
      return progressSheet(titleId, t('voice.uploading'), 'spinner');
    case 'transcribing':
      return progressSheet(titleId, t('voice.transcribing'), 'spinner');
    case 'parsing':
      return (
        <>
          <h2 id={titleId} className="voice-overlay-title">
            {t('voice.parsing')}
          </h2>
          <p className="voice-overlay-transcript" aria-live="polite">
            &ldquo;{state.transcript}&rdquo;
          </p>
          <div className="voice-overlay-spinner" aria-hidden="true" />
        </>
      );
    case 'rate-limited':
      return errorSheet(
        titleId,
        t('voice.error.rateLimitHeading'),
        formatRetryAfter(state.retryAfterSec, t),
        onRetry,
        t,
      );
    case 'language-mismatch':
      return errorSheet(
        titleId,
        t('voice.error.languageMismatchHeading'),
        t('voice.error.languageMismatch'),
        onRetry,
        t,
        state.transcript,
      );
    case 'parse-error':
      return errorSheet(
        titleId,
        t('voice.error.tryAgainHeading'),
        parseErrorCopy(state.reason, t),
        onRetry,
        t,
        state.transcript,
      );
    case 'permission-denied':
      return errorSheet(
        titleId,
        t('voice.error.permissionDeniedHeading'),
        native
          ? t('voice.error.permissionDeniedBody.native')
          : t('voice.error.permissionDeniedBody'),
        onRetry,
        t,
        undefined,
        // Native permanent-denial recovery: the mic can only be re-enabled from the app's settings.
        native && onOpenSettings
          ? { label: t('voice.error.openSettings'), onClick: onOpenSettings }
          : undefined,
      );
    case 'offline':
      return errorSheet(
        titleId,
        t('voice.error.offlineHeading'),
        t('voice.error.offlineBody'),
        onRetry,
        t,
      );
    case 'browser-unsupported':
      return errorSheet(
        titleId,
        t('voice.error.unsupportedHeading'),
        native ? t('voice.error.unsupportedBody.native') : t('voice.error.unsupportedBody'),
        onRetry,
        t,
      );
  }
}

function progressSheet(
  titleId: string,
  copy: string,
  indicator: 'pulse' | 'spinner',
): React.ReactNode {
  return (
    <>
      <h2 id={titleId} className="voice-overlay-title">
        {copy}
      </h2>
      {indicator === 'pulse' ? (
        <div className="voice-overlay-mic voice-overlay-mic--pulse" aria-hidden="true">
          <Icon.Mic size={48} />
        </div>
      ) : (
        <div className="voice-overlay-spinner" aria-hidden="true" />
      )}
    </>
  );
}

function errorSheet(
  titleId: string,
  heading: string,
  body: string,
  onRetry: () => void,
  t: TFunc,
  transcript?: string,
  extraAction?: { label: string; onClick?: () => void },
): React.ReactNode {
  return (
    <>
      <h2 id={titleId} className="voice-overlay-title">
        {heading}
      </h2>
      {transcript && (
        <p className="voice-overlay-transcript" aria-live="polite">
          &ldquo;{transcript}&rdquo;
        </p>
      )}
      <p id={OVERLAY_BODY_ID} className="voice-overlay-body">
        {body}
      </p>
      <div className="voice-overlay-actions">
        <Link to="/configure" className="btn btn-primary">
          {t('voice.configureCta')}
        </Link>
        {extraAction && (
          <button type="button" className="btn btn-ghost" onClick={extraAction.onClick}>
            {extraAction.label}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          {t('voice.tryAgain')}
        </button>
      </div>
    </>
  );
}

function isErrorState(phase: VoiceState['phase']): boolean {
  return (
    phase === 'parse-error' ||
    phase === 'rate-limited' ||
    phase === 'language-mismatch' ||
    phase === 'permission-denied' ||
    phase === 'offline' ||
    phase === 'browser-unsupported'
  );
}
