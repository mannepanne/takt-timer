// ABOUT: Tests for the Onboarding flow and localStorage helper functions.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/context';
import { hasSeenOnboarding, markOnboardingSeen, Onboarding } from './Onboarding';

vi.mock('@/lib/platform', () => ({ isNativePlatform: vi.fn(() => false) }));
import { isNativePlatform } from '@/lib/platform';

function renderOnboarding(onDone = vi.fn()) {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <Onboarding onDone={onDone} />
      </I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(isNativePlatform).mockReturnValue(false);
});

describe('native copy fork (07g)', () => {
  it('third slide shows device-local copy on native, not the passkey pitch', async () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/nothing leaves your phone/i)).toBeInTheDocument();
    expect(screen.queryByText(/sign in with a passkey/i)).not.toBeInTheDocument();
  });

  it('third slide shows the passkey pitch on web', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/sign in with a passkey/i)).toBeInTheDocument();
  });
});

describe('localStorage helpers', () => {
  it('hasSeenOnboarding returns false when key absent', () => {
    expect(hasSeenOnboarding()).toBe(false);
  });

  it('markOnboardingSeen sets the key', () => {
    markOnboardingSeen();
    expect(hasSeenOnboarding()).toBe(true);
  });
});

describe('Onboarding component', () => {
  it('shows slide 1 content by default', () => {
    renderOnboarding();
    expect(screen.getByRole('heading', { name: /takt/i })).toBeInTheDocument();
  });

  it('renders pager dots', () => {
    renderOnboarding();
    expect(screen.getByRole('navigation', { name: /slide progress/i })).toBeInTheDocument();
  });

  it('shows Skip button on first slide', () => {
    renderOnboarding();
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('shows Next button on first slide', () => {
    renderOnboarding();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('advances to slide 2 on Next click', async () => {
    renderOnboarding();
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/voice configured/i)).toBeInTheDocument();
  });

  it('shows privacy link on slide 3', async () => {
    renderOnboarding();
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument();
  });

  it('shows Get started on last slide', async () => {
    renderOnboarding();
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next|get started/i }));
    }
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('hides Skip button on last slide', async () => {
    renderOnboarding();
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next|get started/i }));
    }
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
  });

  it('calls onDone when Skip is clicked', async () => {
    const onDone = vi.fn();
    renderOnboarding(onDone);
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('calls onDone when Get started is clicked on last slide', async () => {
    const onDone = vi.fn();
    renderOnboarding(onDone);
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next|get started/i }));
    }
    await userEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('navigates with ArrowRight key', async () => {
    renderOnboarding();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByText(/voice configured/i)).toBeInTheDocument();
  });

  it('navigates back with ArrowLeft key', async () => {
    renderOnboarding();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('heading', { name: /takt/i })).toBeInTheDocument();
  });

  it('calls onDone on Escape key', async () => {
    const onDone = vi.fn();
    renderOnboarding(onDone);
    await userEvent.keyboard('{Escape}');
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('calls onDone when ArrowRight pressed on last slide', async () => {
    const onDone = vi.fn();
    renderOnboarding(onDone);
    for (let i = 0; i < 3; i++) {
      await userEvent.keyboard('{ArrowRight}');
    }
    await userEvent.keyboard('{ArrowRight}');
    expect(onDone).toHaveBeenCalledOnce();
  });
});
