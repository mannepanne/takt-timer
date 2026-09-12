// ABOUT: Unit tests for the appearance segmented control (System / Light / Dark).

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/context';
import { ThemeToggle } from './ThemeToggle';

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe('ThemeToggle', () => {
  it('renders a radiogroup with the three modes', () => {
    render(<ThemeToggle value="system" resolved="light" onChange={vi.fn()} />, { wrapper });
    expect(screen.getByRole('radiogroup', { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'System',
      'Light',
      'Dark',
    ]);
  });

  it('marks the current mode as checked', () => {
    render(<ThemeToggle value="dark" resolved="dark" onChange={vi.fn()} />, { wrapper });
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the clicked mode, and not for the current one', async () => {
    const onChange = vi.fn();
    render(<ThemeToggle value="system" resolved="light" onChange={onChange} />, { wrapper });
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
    await userEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('captions the resolved appearance under System only', () => {
    const { rerender } = render(<ThemeToggle value="system" resolved="dark" onChange={vi.fn()} />, {
      wrapper,
    });
    expect(screen.getByText('Currently dark')).toBeInTheDocument();
    rerender(
      <I18nProvider>
        <ThemeToggle value="dark" resolved="dark" onChange={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.queryByText(/currently/i)).not.toBeInTheDocument();
  });
});
