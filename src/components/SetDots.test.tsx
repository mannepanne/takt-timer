import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SetDots } from './SetDots';

describe('SetDots', () => {
  it('renders one dot per set', () => {
    render(<SetDots total={3} currentIdx={0} phase="work" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('marks dots before currentIdx as done', () => {
    render(<SetDots total={3} currentIdx={2} phase="work" />);
    const dots = screen.getAllByRole('listitem');
    expect(dots[0]).toHaveClass('done');
    expect(dots[1]).toHaveClass('done');
    expect(dots[2]).toHaveClass('active');
  });

  it('marks the current dot as rest when phase=rest', () => {
    render(<SetDots total={3} currentIdx={1} phase="rest" />);
    const dots = screen.getAllByRole('listitem');
    expect(dots[1]).toHaveClass('rest');
    expect(dots[1]).not.toHaveClass('active');
  });
});
