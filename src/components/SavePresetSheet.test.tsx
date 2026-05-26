// ABOUT: Tests for SavePresetSheet — form validation, save, and cancel.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SavePresetSheet } from './SavePresetSheet';

vi.mock('@/lib/presets', () => ({ createPreset: vi.fn() }));
import { createPreset } from '@/lib/presets';

const SESSION = { sets: 3, workSec: 60, restSec: 30 };

beforeEach(() => vi.clearAllMocks());

function renderSheet(open = true) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<SavePresetSheet open={open} session={SESSION} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}

describe('SavePresetSheet', () => {
  it('shows session summary', () => {
    renderSheet();
    expect(screen.getByText(/3 sets/)).toBeTruthy();
  });

  it('shows error when saving with empty name', async () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText(/enter a name/i)).toBeTruthy());
    expect(createPreset).not.toHaveBeenCalled();
  });

  it('calls createPreset with trimmed name and session fields', async () => {
    vi.mocked(createPreset).mockResolvedValueOnce({} as never);
    const { onSaved } = renderSheet();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Leg day  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createPreset).toHaveBeenCalledWith({
      name: 'Leg day',
      sets: 3,
      work_sec: 60,
      rest_sec: 30,
    });
  });

  it('shows error on save failure', async () => {
    vi.mocked(createPreset).mockRejectedValueOnce(new Error('network'));
    renderSheet();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Legs' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText(/could not save/i)).toBeTruthy());
  });

  it('calls onClose when Cancel is clicked', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
