import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MicButton } from './MicButton';

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('MicButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders an actionable mic button (no longer aria-disabled)', () => {
    render(<MicButton />, { wrapper });
    const btn = screen.getByRole('button', { name: /start voice input/i });
    expect(btn).not.toHaveAttribute('aria-disabled');
    expect(btn).not.toHaveAttribute('tabindex', '-1');
  });

  it('clicking the mic opens the Voice overlay', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    vi.stubGlobal('navigator', { ...navigator, onLine: true });
    render(<MicButton />, { wrapper });
    const btn = screen.getByRole('button', { name: /start voice input/i });
    await userEvent.click(btn);
    // Without MediaRecorder we land in browser-unsupported — overlay opens.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('when offline, tapping the mic shows the offline overlay state', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    vi.stubGlobal('MediaRecorder', class {});
    render(<MicButton />, { wrapper });
    const btn = screen.getByRole('button', { name: /start voice input/i });
    await userEvent.click(btn);
    expect(screen.getByRole('heading', { name: /offline/i })).toBeInTheDocument();
  });
});
