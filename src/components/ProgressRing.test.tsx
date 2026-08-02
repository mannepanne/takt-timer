import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgressRing } from './ProgressRing';

describe('ProgressRing', () => {
  it('is aria-hidden — decorative, not informational', () => {
    const { container } = render(<ProgressRing progress={0.5} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('at progress=0 the fill circle is offset by the full circumference (empty ring)', () => {
    const { container } = render(<ProgressRing progress={0} size={100} strokeWidth={10} />);
    const [, fill] = container.querySelectorAll('circle');
    const radius = (100 - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference, 5);
  });

  it('at progress=1 the fill circle has zero offset (full ring)', () => {
    const { container } = render(<ProgressRing progress={1} size={100} strokeWidth={10} />);
    const [, fill] = container.querySelectorAll('circle');
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  });

  it('at progress=0.5 the fill circle is offset by half the circumference', () => {
    const { container } = render(<ProgressRing progress={0.5} size={100} strokeWidth={10} />);
    const [, fill] = container.querySelectorAll('circle');
    const radius = (100 - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference / 2, 5);
  });

  it('clamps progress above 1 down to a full ring', () => {
    const { container } = render(<ProgressRing progress={1.5} size={100} strokeWidth={10} />);
    const [, fill] = container.querySelectorAll('circle');
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  });

  it('clamps negative progress down to an empty ring', () => {
    const { container } = render(<ProgressRing progress={-0.2} size={100} strokeWidth={10} />);
    const [, fill] = container.querySelectorAll('circle');
    const radius = (100 - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference, 5);
  });

  it('renders two circles: track and fill', () => {
    const { container } = render(<ProgressRing progress={0.3} />);
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });
});
