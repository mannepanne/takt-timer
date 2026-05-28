// ABOUT: Home-screen mic button. Opens the Voice overlay and drives it via useVoiceMachine.

import { Icon } from '@/components/icons';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import { useI18n } from '@/i18n/context';
import { useVoiceMachine } from '@/lib/voice/useVoiceMachine';

export function MicButton() {
  const { t } = useI18n();
  const { state, micTap, userStop, cancel, retry, retryToastVisible } = useVoiceMachine();

  return (
    <>
      <div className="mic-button" role="presentation">
        <button
          type="button"
          className="mic-button-dot"
          onClick={micTap}
          aria-label={t('mic.ariaLabel')}
        >
          <Icon.Mic size={34} />
        </button>
        <p className="mic-button-hint">{t('mic.tapToStart')}</p>
      </div>

      <VoiceOverlay state={state} onUserStop={userStop} onCancel={cancel} onRetry={retry} />

      {retryToastVisible && (
        <div className="mic-retry-toast" role="status" aria-live="polite">
          {t('voice.retryToast')}
        </div>
      )}
    </>
  );
}
