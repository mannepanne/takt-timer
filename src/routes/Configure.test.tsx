import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Configure } from './Configure';

function RunStateProbe() {
  const loc = useLocation();
  return <pre data-testid="nav-state">{JSON.stringify(loc.state)}</pre>;
}

describe('Configure route', () => {
  it('renders with default 3 × 1:00 / 0:30', () => {
    render(
      <MemoryRouter initialEntries={['/configure']}>
        <Routes>
          <Route path="/configure" element={<Configure />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /build a session/i })).toBeInTheDocument();
    expect(screen.getByText('Sets')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Rest')).toBeInTheDocument();
  });

  it('Start navigates to /run with the session as state', async () => {
    render(
      <MemoryRouter initialEntries={['/configure']}>
        <Routes>
          <Route path="/configure" element={<Configure />} />
          <Route path="/run" element={<RunStateProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
    const state = JSON.parse(screen.getByTestId('nav-state').textContent ?? '{}');
    expect(state.session).toEqual({ sets: 3, workSec: 60, restSec: 30 });
  });

  it('Back link goes to Home', () => {
    render(
      <MemoryRouter initialEntries={['/configure']}>
        <Routes>
          <Route path="/configure" element={<Configure />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });
});
