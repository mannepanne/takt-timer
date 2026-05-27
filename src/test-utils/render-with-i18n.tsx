// ABOUT: Test helper that renders a component inside I18nProvider with a fixed language.

import { render, type RenderOptions } from '@testing-library/react';
import { I18nProvider } from '@/i18n/context';
import type { Lang } from '@/i18n/strings';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  lang?: Lang;
}

export function renderWithI18n(ui: React.ReactElement, { lang = 'en', ...opts }: Options = {}) {
  if (lang !== 'en') {
    localStorage.setItem('takt.lang.v1', lang);
  }
  return render(ui, {
    wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    ...opts,
  });
}
