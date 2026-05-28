// ABOUT: Tests for the Privacy policy page — bilingual content and navigation.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { I18nProvider } from '@/i18n/context';
import { Privacy } from './Privacy';

function renderPrivacy() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <Privacy />
      </I18nProvider>
    </MemoryRouter>,
  );
}

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
