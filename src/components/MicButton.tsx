// ABOUT: Home-screen mic button. Opens the Voice overlay and drives it via useVoiceMachine.

import { Icon } from '@/components/icons';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import { useVoiceMachine } from '@/lib/voice/useVoiceMachine';

export function MicButton() {
  const { state, micTap, userStop, cancel, retry, retryToastVisible } = useVoiceMachine();

  return (
    <>
      <div className="mic-button" role="presentation">
        <button
          type="button"
          className="mic-button-dot"
          onClick={micTap}
          aria-label="Start voice input"
        >
          <Icon.Mic size={34} />
        </button>
        <p className="mic-button-hint">Tap to start</p>
      </div>

      <VoiceOverlay state={state} onUserStop={userStop} onCancel={cancel} onRetry={retry} />

      {retryToastVisible && (
        <div className="mic-retry-toast" role="status" aria-live="polite">
          Didn&rsquo;t catch that &mdash; tap the mic and try again.
        </div>
      )}
    </>
  );
}
