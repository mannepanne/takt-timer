import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Interpretation } from './Interpretation';

const session = { sets: 3, workSec: 60, restSec: 30 };

describe('Interpretation', () => {
  it('renders three chips showing sets, work, and rest', () => {
    const { container } = render(<Interpretation value={session} onChange={() => {}} />);
    const chips = container.querySelectorAll('.interpretation-chips .chip');
    expect(chips).toHaveLength(3);
    expect(chips[0]).toHaveTextContent('3');
    expect(chips[0]).toHaveTextContent('Sets');
    expect(chips[1]).toHaveTextContent('1:00');
    expect(chips[1]).toHaveTextContent('Work');
    expect(chips[2]).toHaveTextContent('0:30');
    expect(chips[2]).toHaveTextContent('Rest');
  });

  it('tapping the sets chip opens the stepper sheet and editing commits through onChange', async () => {
    const onChange = vi.fn();
    render(<Interpretation value={session} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /3 sets/i }));
    // The sheet is now open with Sets label — pick preset 5.
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onChange).toHaveBeenCalledWith({ ...session, sets: 5 });
  });

  it('tapping the rest chip opens the stepper sheet with Rest-specific presets', async () => {
    render(<Interpretation value={session} onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /0:30 rest/i }));
    // Rest presets include 0:00.
    expect(screen.getByRole('button', { name: '0:00' })).toBeInTheDocument();
  });
});
