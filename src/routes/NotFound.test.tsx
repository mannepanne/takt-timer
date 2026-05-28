import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { NotFound } from './NotFound';
import { I18nProvider } from '@/i18n/context';

describe('NotFound', () => {
  it('renders an h1 and both top-bar and footer links back to Home', () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <NotFound />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/nothing here/i);
    const links = screen.getAllByRole('link', { name: 'Back to Home' });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/');
    }
  });

  it('wraps body in a main landmark', () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <NotFound />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
