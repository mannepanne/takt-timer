// ABOUT: Mini histogram of recent session durations, rendered as DOM bars.
// ABOUT: Shown on Home inside the "N sessions this week" chip.

import type { CompletedSession } from '@/lib/timer/types';

type Props = {
  entries: CompletedSession[];
  take?: number;
};

export function Sparkline({ entries, take = 7 }: Props) {
  const recent = entries.slice(-take);
  const maxDur = Math.max(1, ...recent.map((e) => e.totalSec));
  return (
    <span className="sparkline" aria-hidden="true">
      {recent.map((e, i) => (
        <span key={i} style={{ height: `${Math.max(2, (e.totalSec / maxDur) * 12)}px` }} />
      ))}
    </span>
  );
}
