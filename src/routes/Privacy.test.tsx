// ABOUT: Tests for the Privacy policy page — bilingual content and navigation.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/context';
import { Privacy } from './Privacy';

vi.mock('@/lib/platform', () => ({ isNativePlatform: vi.fn(() => false) }));
import { isNativePlatform } from '@/lib/platform';

function renderPrivacy() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <Privacy />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('native copy fork (07g)', () => {
  afterEach(() => vi.mocked(isNativePlatform).mockReturnValue(false));

  it('on native: local-only storage, a Voice input section, and no server/Cloudflare copy', () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    renderPrivacy();
    expect(screen.getByRole('heading', { name: /voice input/i })).toBeInTheDocument();
    expect(screen.getByText(/stored only on this device/i)).toBeInTheDocument();
    expect(screen.queryByText(/Cloudflare/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/passkey public key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Delete account/i)).not.toBeInTheDocument();
  });

  it('on web: keeps the server/Cloudflare/passkey copy and has no Voice input section', () => {
    renderPrivacy();
    expect(screen.getAllByText(/Cloudflare/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/passkey public key/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /voice input/i })).not.toBeInTheDocument();
  });
});

describe('forced variant (stable public URLs)', () => {
  afterEach(() => vi.mocked(isNativePlatform).mockReturnValue(false));

  function renderVariant(variant: 'web' | 'android') {
    return render(
      <MemoryRouter>
        <I18nProvider>
          <Privacy variant={variant} />
        </I18nProvider>
      </MemoryRouter>,
    );
  }

  it('variant="android" shows the on-device copy even when running on web', () => {
    vi.mocked(isNativePlatform).mockReturnValue(false);
    renderVariant('android');
    expect(screen.getByRole('heading', { name: /voice input/i })).toBeInTheDocument();
    expect(screen.getByText(/stored only on this device/i)).toBeInTheDocument();
    expect(screen.queryByText(/Cloudflare/i)).not.toBeInTheDocument();
  });

  it('variant="web" shows the server/Cloudflare copy even when running on native', () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    renderVariant('web');
    expect(screen.getAllByText(/Cloudflare/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /voice input/i })).not.toBeInTheDocument();
  });

  it('the android page cross-links to the web policy', () => {
    renderVariant('android');
    expect(screen.getByRole('link', { name: /Takt web app privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy/web',
    );
  });

  it('the web page cross-links to the android policy', () => {
    renderVariant('web');
    expect(screen.getByRole('link', { name: /Takt Android app privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy/android',
    );
  });

  it('renders no cross-link inside the native app (would show contradictory web copy)', () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    renderVariant('android');
    expect(screen.queryByRole('link', { name: /privacy policy\?/i })).not.toBeInTheDocument();
  });
});

describe('Privacy page', () => {
  it('renders the privacy promise heading', () => {
    renderPrivacy();
    expect(
      screen.getByRole('heading', { name: /no email\. no phone\. no personal details\./i }),
    ).toBeInTheDocument();
  });

  it('shows a back affordance', () => {
    renderPrivacy();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('renders all section headings in English', () => {
    renderPrivacy();
    expect(screen.getByRole('heading', { name: /what we store/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /what cloudflare sees/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /how to delete/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /contact/i })).toBeInTheDocument();
  });

  it('renders the contact email link', () => {
    renderPrivacy();
    expect(screen.getByRole('link', { name: /takt@hultberg\.org/i })).toHaveAttribute(
      'href',
      'mailto:takt@hultberg.org',
    );
  });
});
