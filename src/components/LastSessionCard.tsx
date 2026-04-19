// ABOUT: Home screen card showing the most-recent completed session as a quick-start.
// ABOUT: Tapping runs that exact configuration — navigates directly to /run, no Configure stop.

import { Icon } from '@/components/icons';
import { fmtTime } from '@/lib/format';
import type { CompletedSession } from '@/lib/timer/types';

type Props = {
  session: CompletedSession;
  onRun: () => void;
};

export function LastSessionCard({ session, onRun }: Props) {
  return (
    <button className="last-session-card" type="button" onClick={onRun}>
      <div className="last-session-card-icon">
        <Icon.Play size={16} color="var(--accent-deep)" />
      </div>
      <div className="last-session-card-body">
        <div className="eyebrow last-session-card-eyebrow">Last session</div>
        <div className="last-session-card-text">
          {session.name ?? `${session.sets} × ${fmtTime(session.workSec)}`}
          <span className="last-session-card-meta">
            {' · rest '}
            {fmtTime(session.restSec)}
          </span>
        </div>
      </div>
      <Icon.ChevronRight size={18} color="var(--mute)" />
    </button>
  );
}
