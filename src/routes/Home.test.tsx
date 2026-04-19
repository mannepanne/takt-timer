import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Home } from './Home';

describe('Home (Phase 1 placeholder)', () => {
  it('renders the wordmark and a link to the privacy page', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Takt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
  });

  it('has a top-level heading so screen readers can orient', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /takt is under construction/i,
    );
  });

  it('wraps the primary content in a main landmark', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('disables the presets and settings buttons until later phases', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Presets' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeDisabled();
  });
});
