// ABOUT: Tests for the native hardware back-button handler (07g) — confirm-before-leave on an
// ABOUT: active interval session, exit-app at root, navigate-back on deeper screens, and web no-op.

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/context';
import { isNativePlatform } from '@/lib/platform';

import { NativeBackButton } from './NativeBackButton';

vi.mock('@/lib/platform', () => ({ isNativePlatform: vi.fn(() => true) }));

let backHandler: (() => void) | null = null;
const exitApp = vi.fn();
vi.mock('@/lib/app-lifecycle', () => ({
  subscribeBackButton: (h: () => void) => {
    backHandler = h;
    return () => {
      backHandler = null;
    };
  },
  exitApp: () => exitApp(),
}));

const activeRef = { current: false };
vi.mock('@/lib/interval-active', () => ({ useIntervalActiveRef: () => activeRef }));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="path">{loc.pathname}</div>;
}

function renderAt(entries: string[], index = entries.length - 1) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={entries} initialIndex={index}>
        <NativeBackButton />
        <LocationProbe />
        <Routes>
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  backHandler = null;
  activeRef.current = false;
  vi.mocked(isNativePlatform).mockReturnValue(true);
  exitApp.mockClear();
});

function pressBack() {
  act(() => backHandler?.());
}

describe('NativeBackButton', () => {
  it('registers a back-button listener on native', () => {
    renderAt(['/']);
    expect(backHandler).toBeTypeOf('function');
  });

  it('does not register on web (no hardware back button)', () => {
    vi.mocked(isNativePlatform).mockReturnValue(false);
    renderAt(['/']);
    expect(backHandler).toBeNull();
  });

  it('at root with no active session, back exits the app', () => {
    renderAt(['/']);
    pressBack();
    expect(exitApp).toHaveBeenCalled();
  });

  it('on a deeper screen, back navigates back rather than exiting', () => {
    renderAt(['/', '/timer'], 1);
    expect(screen.getByTestId('path')).toHaveTextContent('/timer');
    pressBack();
    expect(screen.getByTestId('path')).toHaveTextContent('/');
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('with an active interval session, back opens a confirm dialog instead of leaving', () => {
    activeRef.current = true;
    renderAt(['/run']);
    pressBack();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/leave your session/i)).toBeInTheDocument();
    expect(exitApp).not.toHaveBeenCalled();
    expect(screen.getByTestId('path')).toHaveTextContent('/run'); // did not navigate yet
  });

  it('confirming "Leave session" navigates home', async () => {
    activeRef.current = true;
    renderAt(['/run']);
    pressBack();
    await userEvent.click(screen.getByRole('button', { name: /leave session/i }));
    expect(screen.getByTestId('path')).toHaveTextContent('/');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('"Keep going" dismisses the dialog and stays put', async () => {
    activeRef.current = true;
    renderAt(['/run']);
    pressBack();
    await userEvent.click(screen.getByRole('button', { name: /keep going/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/run');
  });

  it('back while the confirm dialog is open dismisses it (does not exit)', () => {
    activeRef.current = true;
    renderAt(['/run']);
    pressBack(); // opens dialog
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    pressBack(); // dismisses it
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(exitApp).not.toHaveBeenCalled();
    expect(screen.getByTestId('path')).toHaveTextContent('/run');
  });
});
