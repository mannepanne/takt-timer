// ABOUT: Tests for PresetsDrawer — list, pin, duplicate, delete, run.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/presets', () => ({
  listPresets: vi.fn(),
  updatePreset: vi.fn(),
  deletePreset: vi.fn(),
  createPreset: vi.fn(),
  reorderPresets: vi.fn(),
}));

import {
  listPresets,
  updatePreset,
  deletePreset,
  createPreset,
  reorderPresets,
} from '@/lib/presets';
import { PresetsDrawer } from './PresetsDrawer';

const PRESET = {
  id: 'p1',
  user_handle: 'u1',
  name: 'Legs',
  sets: 3,
  work_sec: 60,
  rest_sec: 30,
  pinned: 0,
  order_index: 0,
  created_at: 1000,
};

beforeEach(() => vi.clearAllMocks());

function renderDrawer(open = true) {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <PresetsDrawer open={open} onClose={onClose} />
    </MemoryRouter>,
  );
  return { onClose };
}

describe('PresetsDrawer', () => {
  it('shows empty state when no presets', async () => {
    vi.mocked(listPresets).mockResolvedValueOnce([]);
    renderDrawer();
    await waitFor(() => expect(screen.getByText(/no presets yet/i)).toBeTruthy());
  });

  it('renders preset name and meta', async () => {
    vi.mocked(listPresets).mockResolvedValueOnce([PRESET]);
    renderDrawer();
    await waitFor(() => expect(screen.getByText('Legs')).toBeTruthy());
    expect(screen.getByText(/3 sets/)).toBeTruthy();
  });

  it('calls onClose when backdrop is clicked', async () => {
    vi.mocked(listPresets).mockResolvedValueOnce([]);
    const { onClose } = renderDrawer();
    // Backdrop is the first div with drawer-backdrop class
    const backdrop = document.querySelector('.drawer-backdrop');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles pin on star click', async () => {
    vi.mocked(listPresets).mockResolvedValueOnce([PRESET]);
    vi.mocked(updatePreset).mockResolvedValueOnce({ ...PRESET, pinned: 1 });
    renderDrawer();
    await waitFor(() => screen.getByText('Legs'));
    fireEvent.click(screen.getByRole('button', { name: /pin preset/i }));
    await waitFor(() => expect(updatePreset).toHaveBeenCalledWith('p1', { pinned: 1 }));
  });

  it('creates duplicate on copy click', async () => {
    vi.mocked(listPresets).mockResolvedValueOnce([PRESET]);
    vi.mocked(createPreset).mockResolvedValueOnce({ ...PRESET, id: 'p2', name: 'Legs copy' });
    renderDrawer();
    await waitFor(() => screen.getByText('Legs'));
    fireEvent.click(screen.getByRole('button', { name: /duplicate legs/i }));
    await waitFor(() => expect(createPreset).toHaveBeenCalled());
  });

  it('shows confirm on first delete click, deletes on second', async () => {
    vi.mocked(listPresets).mockResolvedValueOnce([PRESET]);
    vi.mocked(deletePreset).mockResolvedValueOnce();
    renderDrawer();
    await waitFor(() => screen.getByText('Legs'));
    fireEvent.click(screen.getByRole('button', { name: /delete legs/i }));
    expect(screen.getByRole('button', { name: /confirm delete/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    await waitFor(() => expect(deletePreset).toHaveBeenCalledWith('p1'));
  });

  it('does not fetch when closed', () => {
    renderDrawer(false);
    expect(listPresets).not.toHaveBeenCalled();
  });

  it('drag-and-drop reorders presets and calls reorderPresets', async () => {
    const p2 = { ...PRESET, id: 'p2', name: 'Arms', order_index: 1 };
    vi.mocked(listPresets).mockResolvedValueOnce([PRESET, p2]);
    vi.mocked(reorderPresets).mockResolvedValueOnce();
    renderDrawer();
    await waitFor(() => screen.getByText('Legs'));
    const cards = document.querySelectorAll('.preset-card');
    expect(cards).toHaveLength(2);
    fireEvent.dragStart(cards[0]);
    fireEvent.dragEnter(cards[1]);
    fireEvent.dragEnd(cards[0]);
    await waitFor(() => expect(reorderPresets).toHaveBeenCalledWith(['p2', 'p1']));
  });
});
