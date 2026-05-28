// ABOUT: Tests for PresetsDrawer — list, pin, rename, duplicate, delete, run.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nProvider } from '@/i18n/context';

function LocProbe() {
  const loc = useLocation();
  return (
    <div data-testid="loc">
      {loc.pathname}
      {loc.state ? ':' + JSON.stringify(loc.state) : ''}
    </div>
  );
}

function renderDrawerWithRoutes(open = true) {
  const onClose = vi.fn();
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <PresetsDrawer open={open} onClose={onClose} />
                <LocProbe />
              </>
            }
          />
          <Route path="/run" element={<LocProbe />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
  return { onClose };
}

vi.mock('@/lib/presets', () => ({
  listPresets: vi.fn(),
  updatePreset: vi.fn(),
  deletePreset: vi.fn(),
  createPreset: vi.fn(),
}));

import { listPresets, updatePreset, deletePreset, createPreset } from '@/lib/presets';
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
    <I18nProvider>
      <MemoryRouter>
        <PresetsDrawer open={open} onClose={onClose} />
      </MemoryRouter>
    </I18nProvider>,
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

  it('shows fetch error when listPresets fails', async () => {
    vi.mocked(listPresets).mockRejectedValueOnce(new Error('network'));
    renderDrawer();
    await waitFor(() => expect(screen.getByText(/could not load presets/i)).toBeTruthy());
  });

  it('rename button shows inline input, save commits the rename', async () => {
    vi.mocked(listPresets).mockResolvedValueOnce([PRESET]);
    vi.mocked(updatePreset).mockResolvedValueOnce({ ...PRESET, name: 'Quads' });
    renderDrawer();
    await waitFor(() => screen.getByText('Legs'));
    fireEvent.click(screen.getByRole('button', { name: /rename legs/i }));
    const input = screen.getByRole('textbox', { name: /rename preset/i });
    fireEvent.change(input, { target: { value: 'Quads' } });
    fireEvent.click(screen.getByRole('button', { name: /save rename/i }));
    await waitFor(() => expect(updatePreset).toHaveBeenCalledWith('p1', { name: 'Quads' }));
    expect(screen.getByText('Quads')).toBeTruthy();
  });

  it('clicking a preset card navigates to /run with session state', async () => {
    vi.mocked(listPresets).mockResolvedValueOnce([PRESET]);
    renderDrawerWithRoutes();
    await waitFor(() => screen.getByText('Legs'));
    fireEvent.click(screen.getByRole('button', { name: /run legs/i }));
    await waitFor(() => {
      const probe = screen.getByTestId('loc');
      expect(probe.textContent).toContain('/run');
      expect(probe.textContent).toContain('"sets":3');
    });
  });

  it('Enter key in rename input commits the rename', async () => {
    vi.mocked(listPresets).mockResolvedValueOnce([PRESET]);
    vi.mocked(updatePreset).mockResolvedValueOnce({ ...PRESET, name: 'Quads' });
    renderDrawer();
    await waitFor(() => screen.getByText('Legs'));
    fireEvent.click(screen.getByRole('button', { name: /rename legs/i }));
    const input = screen.getByRole('textbox', { name: /rename preset/i });
    fireEvent.change(input, { target: { value: 'Quads' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(updatePreset).toHaveBeenCalledWith('p1', { name: 'Quads' }));
  });

  it('Escape key in rename input cancels without saving', async () => {
    vi.mocked(listPresets).mockResolvedValueOnce([PRESET]);
    renderDrawer();
    await waitFor(() => screen.getByText('Legs'));
    fireEvent.click(screen.getByRole('button', { name: /rename legs/i }));
    expect(screen.getByRole('textbox', { name: /rename preset/i })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox', { name: /rename preset/i }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: /rename preset/i })).toBeNull();
    expect(updatePreset).not.toHaveBeenCalled();
  });
});
