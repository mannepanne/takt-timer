import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Privacy } from './Privacy';

describe('Privacy (Phase 1 stub)', () => {
  it('renders the privacy promise heading', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /no email\. no phone\. no personal details\./i }),
    ).toBeInTheDocument();
  });

  it('shows a back-to-home affordance', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });
});
