// ABOUT: Branch test for the retryToastVisible rendering path in MicButton.
// ABOUT: Kept separate from MicButton.test.tsx which tests the integration path.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { MicButton } from './MicButton';
import { I18nProvider } from '@/i18n/context';
import type { VoiceApi } from '@/lib/voice/useVoiceMachine';

vi.mock('@/lib/voice/useVoiceMachine');
import { useVoiceMachine } from '@/lib/voice/useVoiceMachine';

const idleApi: VoiceApi = {
  state: { phase: 'idle' },
  micTap: vi.fn(),
  userStop: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  retryToastVisible: false,
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nProvider>
  );
}

describe('MicButton — retry toast', () => {
  it('does not show the toast when retryToastVisible is false', () => {
    vi.mocked(useVoiceMachine).mockReturnValue({ ...idleApi, retryToastVisible: false });
    render(<MicButton />, { wrapper });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the retry toast copy when retryToastVisible is true', () => {
    vi.mocked(useVoiceMachine).mockReturnValue({ ...idleApi, retryToastVisible: true });
    render(<MicButton />, { wrapper });
    expect(screen.getByRole('status')).toHaveTextContent(/didn.t catch that/i);
  });
});
