// Integration test — end-to-end Configure → Run → Complete flow.
// Uses `skip` to blaze through phases; the reducer's tick-based progression is
// covered exhaustively in src/lib/timer/machine.test.ts.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App';
import { __resetAudioForTest } from '@/lib/audio';

describe('Integration — Configure → Run → Complete', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetAudioForTest();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('navigates from Home → Configure → Run → Complete and appends to history', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    // Home → Configure
    expect(screen.getByRole('heading', { name: /what cadence do you need/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /configure a session/i }));

    // Configure → Start (with default 3 × 1:00 / 0:30)
    expect(await screen.findByRole('heading', { name: /build a session/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^start$/i }));

    // Run → skip through count-in, 3 × (work + rest), ending on the final work.
    // Order: countIn → work(0) → rest(0) → work(1) → rest(1) → work(2) → complete
    const skip = await screen.findByLabelText('Skip phase');
    await userEvent.click(skip); // countIn → work(0)
    await userEvent.click(screen.getByLabelText('Skip phase')); // work(0) → rest(0)
    await userEvent.click(screen.getByLabelText('Skip phase')); // rest(0) → work(1)
    await userEvent.click(screen.getByLabelText('Skip phase')); // work(1) → rest(1)
    await userEvent.click(screen.getByLabelText('Skip phase')); // rest(1) → work(2)
    await userEvent.click(screen.getByLabelText('Skip phase')); // work(2) → complete

    // Landed on Complete route.
    expect(await screen.findByRole('heading', { name: /nicely done/i })).toBeInTheDocument();

    // History was appended.
    const stored = localStorage.getItem('takt.history.v1');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ sets: 3, workSec: 60, restSec: 30 });

    // "Run it again" goes back to /run.
    await userEvent.click(screen.getByRole('button', { name: /run it again/i }));
    expect(await screen.findByLabelText('Stop session')).toBeInTheDocument();
  });

  it('last-session card on Home re-runs the session in one tap', async () => {
    // Seed a completed session.
    localStorage.setItem(
      'takt.history.v1',
      JSON.stringify([{ completedAt: 1, totalSec: 240, sets: 3, workSec: 60, restSec: 30 }]),
    );
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText(/last session/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /last session/i }));
    expect(await screen.findByLabelText('Stop session')).toBeInTheDocument();
  });
});
