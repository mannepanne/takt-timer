// ABOUT: Unit tests for the language segmented control (EN / SV).

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/context';
import { LanguageToggle } from './LanguageToggle';

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe('LanguageToggle', () => {
  it('renders two language buttons', () => {
    render(<LanguageToggle />, { wrapper });
    expect(screen.getByRole('button', { name: /english/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /svenska/i })).toBeInTheDocument();
  });

  it('marks the active language with aria-pressed=true', () => {
    render(<LanguageToggle />, { wrapper });
    // Default lang is 'en'
    expect(screen.getByRole('button', { name: /english/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /svenska/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onChange when a different language is clicked', async () => {
    const onChange = vi.fn();
    render(<LanguageToggle onChange={onChange} />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: /svenska/i }));
    expect(onChange).toHaveBeenCalledWith('sv');
  });

  it('does not call onChange when the active language is clicked again', async () => {
    const onChange = vi.fn();
    render(<LanguageToggle onChange={onChange} />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: /english/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
