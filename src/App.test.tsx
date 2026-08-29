// ABOUT: Smoke tests for top-level route rendering.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/client', () => ({ getMe: vi.fn(async () => null) }));

import { App } from './App';

describe('App', () => {
  it('renders the Privacy route at /privacy', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /no email\. no phone\. no personal details\./i }),
    ).toBeInTheDocument();
  });

  it('redirects /privacy to the web policy variant', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <App />
      </MemoryRouter>,
    );
    // The web variant is what renders after the redirect — it cross-links to the Android policy.
    expect(screen.getByRole('link', { name: /Takt Android app privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy/android',
    );
  });

  it('renders the Android privacy policy at /privacy/android', () => {
    render(
      <MemoryRouter initialEntries={['/privacy/android']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /voice input/i })).toBeInTheDocument();
  });

  it('renders the Timer route at /timer', () => {
    render(
      <MemoryRouter initialEntries={['/timer']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('renders the NotFound route for unknown paths', () => {
    render(
      <MemoryRouter initialEntries={['/some/unknown/path']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /nothing here/i })).toBeInTheDocument();
  });

  it('shows onboarding on first visit at /', () => {
    localStorage.clear();
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    // Onboarding slide 1 has a heading with "Takt"
    expect(screen.getByRole('heading', { name: /takt/i })).toBeInTheDocument();
  });

  it('shows Home when onboarding already seen', () => {
    localStorage.setItem('takt.onboarding.v1', '1');
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /privacy/i })).toBeInTheDocument();
  });
});
