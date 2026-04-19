import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Home } from './Home';

function LocProbe() {
  const loc = useLocation();
  return (
    <div data-testid="loc">
      {loc.pathname}
      {loc.state ? ':' + JSON.stringify(loc.state) : ''}
    </div>
  );
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/configure" element={<div data-testid="config">configure</div>} />
        <Route path="/run" element={<LocProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Home', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the prompt and demo mic button', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: /what cadence do you need/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /voice input — available in phase 3/i }),
    ).toBeInTheDocument();
  });

  it('Configure CTA navigates to /configure', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('link', { name: /configure a session/i }));
    expect(screen.getByTestId('config')).toBeInTheDocument();
  });

  it('without any history, does not render the last-session card or sparkline', () => {
    renderHome();
    expect(screen.queryByText(/last session/i)).toBeNull();
    expect(screen.queryByText(/sessions so far/i)).toBeNull();
  });

  it('with history, renders sparkline chip and last-session card', () => {
    localStorage.setItem(
      'takt.history.v1',
      JSON.stringify([{ completedAt: 1, totalSec: 180, sets: 3, workSec: 60, restSec: 0 }]),
    );
    renderHome();
    expect(screen.getByText(/1 session so far/i)).toBeInTheDocument();
    expect(screen.getByText(/last session/i)).toBeInTheDocument();
  });

  it('tapping the last-session card re-runs that session via /run', async () => {
    localStorage.setItem(
      'takt.history.v1',
      JSON.stringify([{ completedAt: 1, totalSec: 180, sets: 3, workSec: 60, restSec: 30 }]),
    );
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /last session/i }));
    const probe = screen.getByTestId('loc');
    expect(probe.textContent).toContain('/run');
    expect(probe.textContent).toContain('"sets":3');
  });

  it('Privacy link is present in the footer', () => {
    renderHome();
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
  });
});
