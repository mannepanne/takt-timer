import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TopBar } from './TopBar';

describe('TopBar', () => {
  it('renders the wordmark regardless of slot content', () => {
    render(<TopBar />);
    expect(screen.getByLabelText('Takt')).toBeInTheDocument();
  });

  it('renders left and right slots when provided', () => {
    render(
      <TopBar
        left={<button type="button">left</button>}
        right={<button type="button">right</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'left' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'right' })).toBeInTheDocument();
  });
});
