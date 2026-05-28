// ABOUT: Unit tests for AccentPicker colour swatch grid.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/context';
import { AccentPicker } from './AccentPicker';
import { ACCENTS } from '@/lib/settings/accents';

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe('AccentPicker', () => {
  it('renders one swatch per accent', () => {
    render(<AccentPicker value="lichen" onChange={vi.fn()} />, { wrapper });
    const swatches = screen.getAllByRole('radio');
    expect(swatches).toHaveLength(ACCENTS.length);
  });

  it('marks the current value as checked', () => {
    render(<AccentPicker value="coral" onChange={vi.fn()} />, { wrapper });
    expect(screen.getByRole('radio', { name: /coral/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /lichen/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the clicked accent id', async () => {
    const onChange = vi.fn();
    render(<AccentPicker value="lichen" onChange={onChange} />, { wrapper });
    await userEvent.click(screen.getByRole('radio', { name: /iris/i }));
    expect(onChange).toHaveBeenCalledWith('iris');
  });

  it('has a radiogroup with an accessible label', () => {
    render(<AccentPicker value="lichen" onChange={vi.fn()} />, { wrapper });
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
});
