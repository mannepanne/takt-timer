import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Complete } from './Complete';

function HomeMarker() {
  return <div data-testid="home">Home</div>;
}

function RunProbe() {
  const loc = useLocation();
  return <div data-testid="run-state">{JSON.stringify(loc.state)}</div>;
}

const state = {
  totalSec: 210,
  completedAt: 1_700_000_000_000,
  session: { sets: 3, workSec: 60, restSec: 30 },
};

function renderComplete(initialState: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/complete', state: initialState }]}>
      <Routes>
        <Route path="/" element={<HomeMarker />} />
        <Route path="/complete" element={<Complete />} />
        <Route path="/run" element={<RunProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Complete route', () => {
  it('without router state, redirects to Home', () => {
    renderComplete(null);
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('renders totals and work time from router state', () => {
    renderComplete(state);
    expect(screen.getByRole('heading', { name: /nicely done/i })).toBeInTheDocument();
    expect(screen.getByText(/3 sets · 1:00 work each/i)).toBeInTheDocument();
    expect(screen.getByText('3:30')).toBeInTheDocument(); // totalSec 210
    expect(screen.getByText('3:00')).toBeInTheDocument(); // work total 180
  });

  it('Run it again navigates to /run with the same session', async () => {
    renderComplete(state);
    await userEvent.click(screen.getByRole('button', { name: /run it again/i }));
    const runState = JSON.parse(screen.getByTestId('run-state').textContent ?? '{}');
    expect(runState.session).toEqual(state.session);
  });

  it('Done navigates to Home', async () => {
    renderComplete(state);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('Close button (top bar) also navigates to Home', async () => {
    renderComplete(state);
    await userEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });
});
