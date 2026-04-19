// ABOUT: Phase 2 demo mic button — visibly non-interactive, `aria-disabled`.
// ABOUT: Real voice capture wiring lands in Phase 3; this renders the affordance so
// ABOUT: visitors can see where voice will live.

import { Icon } from '@/components/icons';

export function MicButton() {
  return (
    <div className="mic-button-demo" role="presentation">
      <button
        type="button"
        className="mic-button-demo-dot"
        aria-disabled="true"
        aria-label="Voice input — available in Phase 3"
        tabIndex={-1}
        onClick={(e) => e.preventDefault()}
      >
        <Icon.Mic size={34} />
      </button>
      <p className="mic-button-demo-hint">Voice in Phase 3 — tap Configure to build a session</p>
    </div>
  );
}
