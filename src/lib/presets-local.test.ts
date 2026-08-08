// ABOUT: Tests for the device-scoped local presets store.
// ABOUT: Covers CRUD, order_index assignment, tolerant reads, and — critically — that
// ABOUT: write failures surface to the caller and no preset is silently evicted.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { listPresets, createPreset, updatePreset, deletePreset } from './presets-local';

const KEY = 'takt.presets.v1';

const input = (name: string, sets = 3, work = 60, rest = 30) => ({
  name,
  sets,
  work_sec: work,
  rest_sec: rest,
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('presets-local — CRUD', () => {
  it('starts empty', async () => {
    expect(await listPresets()).toEqual([]);
  });

  it('creates a preset with a synthesised id, pinned=0, and created_at', async () => {
    const preset = await createPreset(input('Tabata'));
    expect(preset).toMatchObject({
      name: 'Tabata',
      sets: 3,
      work_sec: 60,
      rest_sec: 30,
      pinned: 0,
      order_index: 0,
    });
    expect(typeof preset.id).toBe('string');
    expect(preset.id.length).toBeGreaterThan(0);
    expect(typeof preset.created_at).toBe('number');
    expect(await listPresets()).toHaveLength(1);
  });

  it('assigns order_index as current max + 1', async () => {
    const a = await createPreset(input('A'));
    const b = await createPreset(input('B'));
    const c = await createPreset(input('C'));
    expect([a.order_index, b.order_index, c.order_index]).toEqual([0, 1, 2]);
  });

  it('returns presets sorted by order_index', async () => {
    await createPreset(input('first'));
    await createPreset(input('second'));
    const list = await listPresets();
    expect(list.map((p) => p.name)).toEqual(['first', 'second']);
    expect(list.map((p) => p.order_index)).toEqual([0, 1]);
  });

  it('updates a preset name (rename)', async () => {
    const preset = await createPreset(input('old'));
    const updated = await updatePreset(preset.id, { name: 'new' });
    expect(updated.name).toBe('new');
    expect((await listPresets())[0].name).toBe('new');
  });

  it('toggles pinned (pin)', async () => {
    const preset = await createPreset(input('p'));
    const pinned = await updatePreset(preset.id, { pinned: 1 });
    expect(pinned.pinned).toBe(1);
  });

  it('duplicates via create (new id, next order_index)', async () => {
    const original = await createPreset(input('dup', 5, 45, 15));
    const copy = await createPreset({
      name: `${original.name} copy`,
      sets: original.sets,
      work_sec: original.work_sec,
      rest_sec: original.rest_sec,
    });
    expect(copy.id).not.toBe(original.id);
    expect(copy.order_index).toBe(1);
    expect(copy).toMatchObject({ sets: 5, work_sec: 45, rest_sec: 15 });
  });

  it('deletes a preset', async () => {
    const preset = await createPreset(input('gone'));
    await deletePreset(preset.id);
    expect(await listPresets()).toEqual([]);
  });

  it('rejects updating an unknown id', async () => {
    await expect(updatePreset('does-not-exist', { name: 'x' })).rejects.toThrow('Preset not found');
  });

  it('deleting an unknown id is a no-op (no write, no throw)', async () => {
    await createPreset(input('keep'));
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    await expect(deletePreset('unknown')).resolves.toBeUndefined();
    expect(setSpy).not.toHaveBeenCalled();
    expect(await listPresets()).toHaveLength(1);
  });
});

describe('presets-local — pin-first ordering', () => {
  it('returns pinned presets first, then by order_index (matches the server order)', async () => {
    const a = await createPreset(input('a'));
    const b = await createPreset(input('b'));
    await createPreset(input('c'));
    await updatePreset(b.id, { pinned: 1 });
    expect((await listPresets()).map((p) => p.name)).toEqual(['b', 'a', 'c']);
    // The unpinned tail keeps order_index order.
    void a;
  });
});

describe('presets-local — tolerant reads', () => {
  it('returns [] on corrupt JSON rather than throwing', async () => {
    localStorage.setItem(KEY, '{not json');
    expect(await listPresets()).toEqual([]);
  });

  it('returns [] when the stored value is not an array', async () => {
    localStorage.setItem(KEY, JSON.stringify({ nope: true }));
    expect(await listPresets()).toEqual([]);
  });

  it('returns [] when getItem itself throws (DOM storage disabled)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('disabled', 'SecurityError');
    });
    expect(await listPresets()).toEqual([]);
  });

  it('returns [] when localStorage is entirely absent', async () => {
    vi.stubGlobal('localStorage', undefined);
    expect(await listPresets()).toEqual([]);
  });

  it('filters out malformed entries so they cannot poison order_index maths', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ junk: true }, { also: 'bad' }]));
    expect(await listPresets()).toEqual([]);
    // A subsequent create still gets order_index 0, not NaN.
    expect((await createPreset(input('fresh'))).order_index).toBe(0);
  });

  it('keeps valid entries and drops invalid ones in a mixed array', async () => {
    const valid = {
      id: 'x',
      name: 'keep',
      sets: 3,
      work_sec: 60,
      rest_sec: 30,
      pinned: 0,
      order_index: 0,
      created_at: 1,
    };
    localStorage.setItem(KEY, JSON.stringify([valid, { junk: true }]));
    const list = await listPresets();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('keep');
  });
});

describe('presets-local — write failures surface, never silent (the load-bearing contract)', () => {
  it('rejects createPreset when the store rejects the write', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    await expect(createPreset(input('too big'))).rejects.toThrow();
  });

  it('rejects updatePreset when the store rejects the write', async () => {
    const preset = await createPreset(input('p'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    await expect(updatePreset(preset.id, { name: 'x' })).rejects.toThrow();
  });

  it('does not cap or evict — a large number of presets all persist', async () => {
    for (let i = 0; i < 50; i++) await createPreset(input(`preset ${i}`));
    expect(await listPresets()).toHaveLength(50);
  });
});
