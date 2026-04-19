import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Run } from './Run';
import { __resetAudioForTest } from '@/lib/audio';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function HomeMarker() {
  return <div data-testid="home">Home</div>;
}

function CompleteMarker() {
  const loc = useLocation();
  return <div data-testid="complete">{JSON.stringify(loc.state)}</div>;
}

const session = { sets: 2, workSec: 10, restSec: 5 };

function renderRoute(initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<HomeMarker />} />
        <Route path="/run" element={<Run />} />
        <Route path="/complete" element={<CompleteMarker />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('Run route', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetAudioForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('without router state, redirects to Home', () => {
    renderRoute([{ pathname: '/run', state: null }]);
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('with a session in router state, renders the run UI and auto-starts', async () => {
    renderRoute([{ pathname: '/run', state: { session } }]);
    // The machine auto-starts into countIn; phase label should render.
    expect(await screen.findByLabelText('Stop session')).toBeInTheDocument();
    expect(screen.getByLabelText('Repeat set')).toBeInTheDocument();
  });

  it('Stop button navigates to Home', async () => {
    renderRoute([{ pathname: '/run', state: { session } }]);
    await userEvent.click(await screen.findByLabelText('Stop session'));
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('sound toggle updates aria-pressed and persists to localStorage', async () => {
    renderRoute([{ pathname: '/run', state: { session } }]);
    const toggle = await screen.findByLabelText(/mute sounds/i);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(screen.getByLabelText(/unmute sounds/i)).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('takt.sound.v1')).toBe('0');
  });

  it('skip phase advances', async () => {
    renderRoute([{ pathname: '/run', state: { session } }]);
    const skip = await screen.findByLabelText('Skip phase');
    await userEvent.click(skip);
    // After skip from countIn we're in work; UI renders the Repeat Set + Skip + Pause controls.
    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
  });

  it('pause reveals Resume affordance', async () => {
    renderRoute([{ pathname: '/run', state: { session } }]);
    await userEvent.click(await screen.findByLabelText('Skip phase')); // countIn → work
    await userEvent.click(screen.getByLabelText('Pause'));
    expect(screen.getByLabelText('Resume')).toBeInTheDocument();
  });

  it('honours a previously stored sound preference', async () => {
    localStorage.setItem('takt.sound.v1', '0');
    renderRoute([{ pathname: '/run', state: { session } }]);
    // Initial render with sound off — toggle labelled "Unmute sounds".
    expect(await screen.findByLabelText(/unmute sounds/i)).toBeInTheDocument();
  });
});
