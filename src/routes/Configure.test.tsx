import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Configure } from './Configure';
import { I18nProvider } from '@/i18n/context';

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

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
      { wrapper },
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
      { wrapper },
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
      { wrapper },
    );
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });

  it('pre-populates the session from location.state (voice handoff)', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/configure',
            state: { session: { sets: 5, workSec: 45, restSec: 15 } },
          },
        ]}
      >
        <Routes>
          <Route path="/configure" element={<Configure />} />
          <Route path="/run" element={<RunStateProbe />} />
        </Routes>
      </MemoryRouter>,
      { wrapper },
    );
    await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
    const state = JSON.parse(screen.getByTestId('nav-state').textContent ?? '{}');
    expect(state.session).toMatchObject({ sets: 5, workSec: 45, restSec: 15 });
  });

  it('ignores malformed location.state and falls back to defaults', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/configure',
            state: { session: { sets: 'bogus' } },
          },
        ]}
      >
        <Routes>
          <Route path="/configure" element={<Configure />} />
          <Route path="/run" element={<RunStateProbe />} />
        </Routes>
      </MemoryRouter>,
      { wrapper },
    );
    await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
    const state = JSON.parse(screen.getByTestId('nav-state').textContent ?? '{}');
    expect(state.session).toEqual({ sets: 3, workSec: 60, restSec: 30 });
  });

  it.each([
    { label: 'NaN', session: { sets: Number.NaN, workSec: 60, restSec: 30 } },
    { label: 'Infinity', session: { sets: Infinity, workSec: 60, restSec: 30 } },
    { label: 'negative', session: { sets: -1, workSec: 60, restSec: 30 } },
    { label: 'float', session: { sets: 3.7, workSec: 60, restSec: 30 } },
    { label: 'out-of-range high', session: { sets: 3, workSec: 99999, restSec: 30 } },
    { label: 'out-of-range low', session: { sets: 3, workSec: 0, restSec: 30 } },
    { label: 'zero sets', session: { sets: 0, workSec: 60, restSec: 30 } },
  ])('rejects $label and falls back to defaults', async ({ session: bad }) => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/configure', state: { session: bad } }]}>
        <Routes>
          <Route path="/configure" element={<Configure />} />
          <Route path="/run" element={<RunStateProbe />} />
        </Routes>
      </MemoryRouter>,
      { wrapper },
    );
    await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
    const state = JSON.parse(screen.getByTestId('nav-state').textContent ?? '{}');
    expect(state.session).toEqual({ sets: 3, workSec: 60, restSec: 30 });
  });

  it('strips unexpected fields (e.g. name) from location.state — Phase 3 never emits them', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/configure',
            state: { session: { sets: 5, workSec: 45, restSec: 15, name: 'bogus' } },
          },
        ]}
      >
        <Routes>
          <Route path="/configure" element={<Configure />} />
          <Route path="/run" element={<RunStateProbe />} />
        </Routes>
      </MemoryRouter>,
      { wrapper },
    );
    await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
    const state = JSON.parse(screen.getByTestId('nav-state').textContent ?? '{}');
    expect(state.session).toEqual({ sets: 5, workSec: 45, restSec: 15 });
    expect(state.session.name).toBeUndefined();
  });

  describe('heard transcript hint (native voice handoff)', () => {
    function renderWithState(state: unknown) {
      render(
        <MemoryRouter initialEntries={[{ pathname: '/configure', state }]}>
          <Routes>
            <Route path="/configure" element={<Configure />} />
          </Routes>
        </MemoryRouter>,
        { wrapper },
      );
    }

    it('shows "Heard: …" when a valid session and transcript are handed off', () => {
      renderWithState({
        session: { sets: 3, workSec: 60, restSec: 30 },
        transcript: 'three sets of one minute, thirty seconds rest',
      });
      expect(screen.getByText(/heard:/i)).toBeInTheDocument();
      expect(screen.getByText('three sets of one minute, thirty seconds rest')).toBeInTheDocument();
    });

    it('does not show the hint when the session is malformed (would misattribute defaults)', () => {
      renderWithState({ session: { sets: 'bogus' }, transcript: 'three sets of one minute' });
      expect(screen.queryByText(/heard:/i)).not.toBeInTheDocument();
    });

    it('does not show the hint when no transcript is present (web path)', () => {
      renderWithState({ session: { sets: 3, workSec: 60, restSec: 30 } });
      expect(screen.queryByText(/heard:/i)).not.toBeInTheDocument();
    });

    it('ignores a non-string transcript', () => {
      renderWithState({ session: { sets: 3, workSec: 60, restSec: 30 }, transcript: { evil: 1 } });
      expect(screen.queryByText(/heard:/i)).not.toBeInTheDocument();
    });

    it('ignores a whitespace-only transcript (defensive against a forged state)', () => {
      renderWithState({ session: { sets: 3, workSec: 60, restSec: 30 }, transcript: '   ' });
      expect(screen.queryByText(/heard:/i)).not.toBeInTheDocument();
    });

    it('caps a runaway transcript at 120 chars with an ellipsis', () => {
      const long = 'word '.repeat(60).trim(); // 299 chars
      renderWithState({ session: { sets: 3, workSec: 60, restSec: 30 }, transcript: long });
      const shown = screen.getByText(/^word .*…$/);
      // 120 kept chars + the ellipsis.
      expect(shown.textContent).toHaveLength(121);
    });
  });
});
