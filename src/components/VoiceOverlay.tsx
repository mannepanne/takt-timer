// ABOUT: Voice capture overlay — renders the state-specific UI for each VoiceState phase.
// ABOUT: Purely presentational; the stateful machine lives in useVoiceMachine.

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import type { ErrorReason, VoiceState } from '@/lib/voice/types';

type Props = {
  state: VoiceState;
  onUserStop: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

const REQUESTING_COPY = 'Requesting microphone\u2026';
const LISTENING_COPY = 'Tap to stop when you\u2019re done';
const UPLOADING_COPY = 'Sending\u2026';
const TRANSCRIBING_COPY = 'Transcribing\u2026';
const PARSING_COPY = 'Building session\u2026';
const LANGUAGE_COPY =
  'Takt currently understands English and Swedish. Tap Configure to build a session manually.';
const PERMISSION_DENIED_COPY =
  'Microphone access is blocked for Takt. Tap Configure to build a session manually.';
const OFFLINE_COPY = 'You\u2019re offline. Tap Configure to build a session manually.';
const UNSUPPORTED_COPY =
  'This browser doesn\u2019t support voice input. Tap Configure to build a session manually.';
const PARSE_ERROR_COPY =
  'Couldn\u2019t understand that one. Tap Configure to build a session manually.';
const NOT_A_SESSION_COPY =
  'That didn\u2019t sound like a session. Try again, or tap Configure to build one manually.';
const COLD_START_TIMEOUT_COPY =
  'Voice took longer than expected. Try again, or tap Configure to build a session manually.';
const RATE_LIMIT_COPY_PREFIX = 'You\u2019ve used today\u2019s voice allowance';
const RATE_LIMIT_COPY_SUFFIX = 'Tap Configure to build a session manually.';

function formatRetryAfter(retryAfterSec: number): string {
  if (!Number.isFinite(retryAfterSec) || retryAfterSec <= 0) {
    return `${RATE_LIMIT_COPY_PREFIX}. ${RATE_LIMIT_COPY_SUFFIX}`;
  }
  // Under 2h shows in minutes so 61–119min doesn't get over-promised as "2 hours".
  // Math.floor would under-promise (61min → "1 hour" → retry rejected); Math.ceil
  // on minutes keeps direction-honesty without inflating the wait.
  const totalMinutes = Math.ceil(retryAfterSec / 60);
  if (totalMinutes < 120) {
    const unit = totalMinutes === 1 ? 'minute' : 'minutes';
    return `${RATE_LIMIT_COPY_PREFIX}. Try again in ${totalMinutes} ${unit}. ${RATE_LIMIT_COPY_SUFFIX}`;
  }
  const hours = Math.ceil(retryAfterSec / 3600);
  // The singular branch is structurally unreachable: this arm only runs when
  // totalMinutes ≥ 120, which forces hours ≥ 2. The ternary stays as defensive
  // code in case the 120-minute threshold ever changes.
  /* v8 ignore next */
  const unit = hours === 1 ? 'hour' : 'hours';
  return `${RATE_LIMIT_COPY_PREFIX}. Try again in ${hours} ${unit}. ${RATE_LIMIT_COPY_SUFFIX}`;
}

// Exhaustive over ErrorReason so the compiler flags any new reason that lands
// in `parse-error` without a conscious decision about overlay copy. The default
// arm is unreachable at runtime — `_exhaustive: never` is the type-level guard.
function parseErrorCopy(reason: ErrorReason): string {
  switch (reason) {
    case 'not-a-session':
      return NOT_A_SESSION_COPY;
    case 'cold-start-timeout':
      return COLD_START_TIMEOUT_COPY;
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
      return PARSE_ERROR_COPY;
    /* v8 ignore next 4 — unreachable; the `never`-typed default is a compile-time guard, not a runtime branch. */
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

export function VoiceOverlay({ state, onUserStop, onCancel, onRetry }: Props): React.ReactNode {
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
    <div className="voice-overlay-scrim" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="voice-overlay-sheet">
        {renderContent(state, titleId, onUserStop, onRetry)}

        <button
          type="button"
          className="btn btn-ghost voice-overlay-cancel"
          onClick={onCancel}
          ref={cancelBtnRef}
        >
          Cancel
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
): React.ReactNode {
  switch (state.phase) {
    case 'requesting-permission':
      return progressSheet(titleId, REQUESTING_COPY, 'pulse');
    case 'listening':
      return (
        <>
          <h2 id={titleId} className="voice-overlay-title">
            {LISTENING_COPY}
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
      return progressSheet(titleId, UPLOADING_COPY, 'spinner');
    case 'transcribing':
      return progressSheet(titleId, TRANSCRIBING_COPY, 'spinner');
    case 'parsing':
      return (
        <>
          <h2 id={titleId} className="voice-overlay-title">
            {PARSING_COPY}
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
        'Daily voice limit reached',
        formatRetryAfter(state.retryAfterSec),
        onRetry,
      );
    case 'language-mismatch':
      return errorSheet(titleId, 'Language not supported', LANGUAGE_COPY, onRetry);
    case 'parse-error':
      return errorSheet(
        titleId,
        'Let\u2019s try that again',
        parseErrorCopy(state.reason),
        onRetry,
        state.transcript,
      );
    case 'permission-denied':
      return errorSheet(titleId, 'Microphone blocked', PERMISSION_DENIED_COPY, onRetry);
    case 'offline':
      return errorSheet(titleId, 'Offline', OFFLINE_COPY, onRetry);
    case 'browser-unsupported':
      return errorSheet(titleId, 'Not supported', UNSUPPORTED_COPY, onRetry);
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
  transcript?: string,
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
      <p className="voice-overlay-body">{body}</p>
      <div className="voice-overlay-actions">
        <Link to="/configure" className="btn btn-primary">
          Configure manually
        </Link>
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Try again
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
