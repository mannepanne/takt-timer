import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the Home route at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Takt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy/i })).toBeInTheDocument();
  });

  it('renders the Privacy route at /privacy', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /no email\. no phone\. no personal details\./i }),
    ).toBeInTheDocument();
  });

  it('renders the NotFound route for unknown paths', () => {
    render(
      <MemoryRouter initialEntries={['/some/unknown/path']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /nothing here/i })).toBeInTheDocument();
  });
});
