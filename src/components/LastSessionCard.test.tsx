import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LastSessionCard } from './LastSessionCard';

const session = {
  completedAt: 1_700_000_000_000,
  totalSec: 210,
  sets: 3,
  workSec: 60,
  restSec: 30,
};

describe('LastSessionCard', () => {
  it('renders the session summary when no name is set', () => {
    render(<LastSessionCard session={session} onRun={() => {}} />);
    expect(screen.getByText(/last session/i)).toBeInTheDocument();
    expect(screen.getByText(/3 × 1:00/)).toBeInTheDocument();
    expect(screen.getByText(/rest 0:30/)).toBeInTheDocument();
  });

  it('prefers the session name when present', () => {
    render(
      <LastSessionCard session={{ ...session, name: 'basic rehab pattern' }} onRun={() => {}} />,
    );
    expect(screen.getByText(/basic rehab pattern/)).toBeInTheDocument();
  });

  it('calls onRun when tapped', async () => {
    const onRun = vi.fn();
    render(<LastSessionCard session={session} onRun={onRun} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onRun).toHaveBeenCalledTimes(1);
  });
});
