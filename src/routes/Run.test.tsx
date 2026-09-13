import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Run } from './Run';
import { __resetAudioForTest } from '@/lib/audio';
import { I18nProvider } from '@/i18n/context';
import { SessionProvider } from '@/lib/auth/session';
import { SettingsProvider } from '@/lib/settings/context';

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
    <I18nProvider>
      <SessionProvider>
        <SettingsProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route path="/" element={<HomeMarker />} />
              <Route path="/run" element={<Run />} />
              <Route path="/complete" element={<CompleteMarker />} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </SettingsProvider>
      </SessionProvider>
    </I18nProvider>,
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

  it('count-in shows "Get ready" and no set fraction', async () => {
    renderRoute([{ pathname: '/run', state: { session } }]);
    expect(await screen.findByText('Get ready')).toBeInTheDocument();
    // No "n / n" fraction during count-in.
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  it('work phase shows the "Work" word and the set fraction', async () => {
    renderRoute([{ pathname: '/run', state: { session } }]);
    await userEvent.click(await screen.findByLabelText('Skip phase')); // countIn → work (set 1)
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('rest phase shows the "Rest" word, the fraction, and the accent bar', async () => {
    renderRoute([{ pathname: '/run', state: { session } }]);
    await userEvent.click(await screen.findByLabelText('Skip phase')); // countIn → work
    await userEvent.click(screen.getByLabelText('Skip phase')); // work → rest
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(document.querySelector('.run-bar.accent')).toBeInTheDocument();
  });

  it('a single-set session renders no fraction', async () => {
    renderRoute([{ pathname: '/run', state: { session: { sets: 1, workSec: 10, restSec: 5 } } }]);
    await userEvent.click(await screen.findByLabelText('Skip phase')); // countIn → work
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  it('the live region holds the word and fraction but not the clock', async () => {
    const { container } = renderRoute([{ pathname: '/run', state: { session } }]);
    await userEvent.click(await screen.findByLabelText('Skip phase')); // countIn → work
    const live = container.querySelector('.run-phase-live')!;
    expect(live).toHaveAttribute('aria-live', 'polite');
    // aria-atomic so the whole "Work 1 / 2" is announced on a phase change even when only the word
    // text mutated (e.g. work → rest at the same set index).
    expect(live).toHaveAttribute('aria-atomic', 'true');
    expect(live.textContent).toContain('Work');
    expect(live.textContent).toContain('1 / 2');
    // The clock (the only element with a colon) must sit outside the live region.
    expect(live.textContent).not.toMatch(/:/);
  });
});
