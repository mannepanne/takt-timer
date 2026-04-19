import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sparkline } from './Sparkline';
import type { CompletedSession } from '@/lib/timer/types';

function entry(totalSec: number, completedAt: number): CompletedSession {
  return { completedAt, totalSec, sets: 3, workSec: 60, restSec: 30 };
}

describe('Sparkline', () => {
  it('renders one bar per entry up to `take`', () => {
    const { container } = render(
      <Sparkline entries={[entry(60, 1), entry(120, 2), entry(90, 3)]} />,
    );
    const bars = container.querySelectorAll('.sparkline > span');
    expect(bars).toHaveLength(3);
  });

  it('caps at the most recent N entries when take is set', () => {
    const { container } = render(
      <Sparkline entries={[entry(10, 1), entry(20, 2), entry(30, 3), entry(40, 4)]} take={2} />,
    );
    const bars = container.querySelectorAll('.sparkline > span');
    expect(bars).toHaveLength(2);
  });

  it('scales bar heights relative to the max duration', () => {
    const { container } = render(<Sparkline entries={[entry(60, 1), entry(120, 2)]} />);
    const bars = container.querySelectorAll<HTMLElement>('.sparkline > span');
    // 60 → half of 12px = 6px; 120 → max = 12px
    expect(bars[0].style.height).toBe('6px');
    expect(bars[1].style.height).toBe('12px');
  });

  it('renders nothing visible when entries is empty', () => {
    const { container } = render(<Sparkline entries={[]} />);
    const bars = container.querySelectorAll('.sparkline > span');
    expect(bars).toHaveLength(0);
  });
});
