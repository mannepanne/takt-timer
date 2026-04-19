import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { MicButton } from './MicButton';

describe('MicButton (demo)', () => {
  it('renders an aria-disabled mic affordance with a "coming soon" hint', () => {
    render(<MicButton />);
    const btn = screen.getByRole('button', { name: /voice input — coming soon/i });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText(/voice input coming soon/i)).toBeInTheDocument();
  });

  it('clicking the demo mic does not throw (preventDefault no-op)', async () => {
    render(<MicButton />);
    const btn = screen.getByRole('button', { name: /voice input/i });
    await userEvent.click(btn);
    expect(btn).toBeInTheDocument();
  });
});
