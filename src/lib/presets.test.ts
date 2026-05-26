// ABOUT: Unit tests for the presets API client.

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '@/lib/apiFetch';
import { listPresets, createPreset, updatePreset, deletePreset, reorderPresets } from './presets';

function mockRes(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

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

describe('listPresets', () => {
  it('GETs /api/presets and returns array', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes([PRESET]) as never);
    const result = await listPresets();
    expect(result).toEqual([PRESET]);
    expect(apiFetch).toHaveBeenCalledWith('/api/presets');
  });

  it('throws on failure', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}, 500) as never);
    await expect(listPresets()).rejects.toThrow('Failed to list presets');
  });
});

describe('createPreset', () => {
  it('POSTs to /api/presets with input', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes(PRESET) as never);
    const input = { name: 'Legs', sets: 3, work_sec: 60, rest_sec: 30 };
    const result = await createPreset(input);
    expect(result).toEqual(PRESET);
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/presets',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  });

  it('throws on failure', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}, 400) as never);
    await expect(createPreset({ name: '', sets: 1, work_sec: 30, rest_sec: 0 })).rejects.toThrow(
      'Failed to create preset',
    );
  });
});

describe('updatePreset', () => {
  it('PATCHes /api/presets/:id', async () => {
    const updated = { ...PRESET, name: 'Arms' };
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes(updated) as never);
    const result = await updatePreset('p1', { name: 'Arms' });
    expect(result).toEqual(updated);
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/presets/p1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('throws on failure', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}, 404) as never);
    await expect(updatePreset('bad', {})).rejects.toThrow('Failed to update preset');
  });
});

describe('deletePreset', () => {
  it('DELETEs /api/presets/:id', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes(null, 204) as never);
    await deletePreset('p1');
    expect(apiFetch).toHaveBeenCalledWith('/api/presets/p1', { method: 'DELETE' });
  });

  it('throws on failure', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}, 404) as never);
    await expect(deletePreset('bad')).rejects.toThrow('Failed to delete preset');
  });
});

describe('reorderPresets', () => {
  it('PATCHes /api/presets/reorder with ids', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}) as never);
    await reorderPresets(['a', 'b', 'c']);
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/presets/reorder',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ ids: ['a', 'b', 'c'] }),
      }),
    );
  });

  it('throws on failure', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}, 500) as never);
    await expect(reorderPresets([])).rejects.toThrow('Failed to reorder presets');
  });
});
