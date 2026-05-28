// ABOUT: Integration tests for the Settings route — language, accent, sound, account, about.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/context';
import { SessionProvider } from '@/lib/auth/session';
import { SettingsProvider } from '@/lib/settings/context';
import { Settings } from './Settings';

vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth/client', () => ({ getMe: vi.fn() }));

import { apiFetch } from '@/lib/apiFetch';
import { getMe } from '@/lib/auth/client';

beforeEach(() => {
  localStorage.clear();
  vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
  vi.mocked(getMe).mockResolvedValue(null);
});

function HomeMarker() {
  return <div data-testid="home">Home</div>;
}

function renderSettings() {
  return render(
    <I18nProvider>
      <SessionProvider>
        <SettingsProvider>
          <MemoryRouter initialEntries={['/settings']}>
            <Routes>
              <Route path="/" element={<HomeMarker />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </MemoryRouter>
        </SettingsProvider>
      </SessionProvider>
    </I18nProvider>,
  );
}

describe('Settings route', () => {
  it('renders the settings heading', () => {
    renderSettings();
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders language, accent, and sound sections', () => {
    renderSettings();
    expect(screen.getByRole('group')).toBeInTheDocument(); // lang toggle group
    expect(screen.getByRole('radiogroup')).toBeInTheDocument(); // accent picker
    expect(screen.getByRole('switch')).toBeInTheDocument(); // sound toggle
  });

  it('back button navigates away from settings', async () => {
    render(
      <I18nProvider>
        <SessionProvider>
          <SettingsProvider>
            <MemoryRouter initialEntries={['/', '/settings']} initialIndex={1}>
              <Routes>
                <Route path="/" element={<HomeMarker />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </MemoryRouter>
          </SettingsProvider>
        </SessionProvider>
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('sound switch toggles on click', async () => {
    renderSettings();
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('accent swatch click updates selection', async () => {
    renderSettings();
    const irisBtn = screen.getByRole('radio', { name: /iris/i });
    await userEvent.click(irisBtn);
    expect(irisBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('language toggle click calls setLang', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /svenska/i }));
    expect(screen.getByRole('button', { name: /svenska/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows Not signed in when unauthenticated', () => {
    renderSettings();
    expect(screen.getByText(/not signed in/i)).toBeInTheDocument();
  });

  it('shows sign in CTA link when unauthenticated', () => {
    renderSettings();
    expect(screen.getByRole('link', { name: /sign in or create account/i })).toBeInTheDocument();
  });

  it('shows privacy policy link in about section', () => {
    renderSettings();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  it('shows version indicator', () => {
    renderSettings();
    expect(screen.getByText(/version/i)).toBeInTheDocument();
  });

  it('shows saved toast after toggling sound', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('switch'));
    const toast = screen.getByRole('status');
    expect(toast).toHaveClass('show');
    expect(toast).toHaveTextContent(/saved/i);
  });
});
