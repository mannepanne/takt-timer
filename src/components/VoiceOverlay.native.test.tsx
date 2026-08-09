// ABOUT: Native-only VoiceOverlay tests (07f) — the permission-denied settings deep link and the
// ABOUT: native (non-"browser") copy for the blocked-mic and recognition-unavailable sheets.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VoiceOverlay } from './VoiceOverlay';
import type { VoiceState } from '@/lib/voice/types';
import { I18nProvider } from '@/i18n/context';
import { isNativePlatform } from '@/lib/platform';

vi.mock('@/lib/platform', () => ({ isNativePlatform: vi.fn(() => true) }));

function renderOverlay(state: VoiceState, onOpenSettings = vi.fn()) {
  const onUserStop = vi.fn();
  const onCancel = vi.fn();
  const onRetry = vi.fn();
  const utils = render(
    <I18nProvider>
      <MemoryRouter>
        <VoiceOverlay
          state={state}
          onUserStop={onUserStop}
          onCancel={onCancel}
          onRetry={onRetry}
          onOpenSettings={onOpenSettings}
        />
      </MemoryRouter>
    </I18nProvider>,
  );
  return { ...utils, onOpenSettings, onCancel, onRetry };
}

beforeEach(() => {
  vi.mocked(isNativePlatform).mockReturnValue(true);
});

describe('VoiceOverlay (native)', () => {
  it('permission-denied shows native copy, a Configure link, and an Open settings button', async () => {
    const { onOpenSettings } = renderOverlay({ phase: 'permission-denied' });
    // Native copy — no "browser".
    expect(screen.getByText(/open settings to enable it/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /configure manually/i })).toHaveAttribute(
      'href',
      '/configure',
    );
    await userEvent.click(screen.getByRole('button', { name: /open settings/i }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('recognition-unavailable (browser-unsupported phase) shows native copy, not the browser copy', () => {
    renderOverlay({ phase: 'browser-unsupported' });
    expect(screen.getByText(/isn’t available on this device/i)).toBeInTheDocument();
    expect(screen.queryByText(/this browser/i)).not.toBeInTheDocument();
  });

  it('without onOpenSettings, the permission sheet renders no settings button', () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <VoiceOverlay
            state={{ phase: 'permission-denied' }}
            onUserStop={vi.fn()}
            onCancel={vi.fn()}
            onRetry={vi.fn()}
          />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.queryByRole('button', { name: /open settings/i })).not.toBeInTheDocument();
  });

  it('parse-error (voice fallback) still offers Configure manually with the heard transcript', () => {
    renderOverlay({ phase: 'parse-error', reason: 'not-a-session', transcript: 'good morning' });
    expect(screen.getByText(/good morning/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /configure manually/i })).toBeInTheDocument();
  });
});
