// ABOUT: Device-scoped presets store for the native (Android) build — localStorage-backed.
// ABOUT: Mirrors presets.ts's async surface but surfaces write failures and never silently evicts.

const STORAGE_KEY = 'takt.presets.v1';

// The Preset shape the drawer reads, minus the server-only `user_handle` (there are no
// accounts on native). No usage counters either — they were considered and dropped for web
// parity, since the web Preset has none.
export type Preset = {
  id: string;
  name: string;
  sets: number;
  work_sec: number;
  rest_sec: number;
  pinned: number;
  order_index: number;
  created_at: number;
};

// Identical to presets.ts's PresetInput — the shape SavePresetSheet/PresetsDrawer pass to create.
export type PresetInput = {
  name: string;
  sets: number;
  work_sec: number;
  rest_sec: number;
};

function isPreset(value: unknown): value is Preset {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.sets === 'number' &&
    typeof v.work_sec === 'number' &&
    typeof v.rest_sec === 'number' &&
    typeof v.pinned === 'number' &&
    typeof v.order_index === 'number' &&
    typeof v.created_at === 'number'
  );
}

// Reading is tolerant: a missing/blocked store or corrupt JSON yields an empty list rather
// than throwing, because a read miss is non-fatal (the drawer just shows no presets).
// `getItem` is inside the try because it can itself throw when DOM storage is disabled, and
// per-item shape filtering stops a malformed entry from poisoning order_index maths in
// createPreset. This is the ONE place we swallow an error — writes below deliberately do not.
function read(): Preset[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPreset) : [];
  } catch {
    return [];
  }
}

// Writing is NOT tolerant: if localStorage rejects the write (quota exceeded, storage
// disabled), the error propagates to the caller so "Save as preset" can show a real
// failure instead of a false success. Unlike history.ts, this never drops data to fit.
function write(presets: Preset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

// All four are `async` so that any synchronous throw from `write()` (a rejected localStorage
// write) surfaces as a rejected promise, matching presets.ts's network-backed contract — a
// caller doing `await createPreset(...)` in a try/catch sees the failure either way.

export async function listPresets(): Promise<Preset[]> {
  // Pinned first, then by order_index — mirrors the server's `ORDER BY pinned DESC,
  // order_index ASC`, because PresetsDrawer trusts this order on load and doesn't re-sort.
  return read().sort((a, b) => b.pinned - a.pinned || a.order_index - b.order_index);
}

// No bounds validation here (the server enforces sets 1–99, work_sec 5–3600, etc. via zod).
// On native this module is the only persistence layer, but callers pass values already
// validated by SavePresetSheet and the timer session, so we trust the input. A future caller
// writing presets from elsewhere must not assume this function guards its bounds.
export async function createPreset(input: PresetInput): Promise<Preset> {
  const presets = read();
  const preset: Preset = {
    id: crypto.randomUUID(),
    name: input.name,
    sets: input.sets,
    work_sec: input.work_sec,
    rest_sec: input.rest_sec,
    pinned: 0,
    // Append after the current highest index (−1 + 1 = 0 when the list is empty).
    order_index: presets.reduce((max, p) => Math.max(max, p.order_index), -1) + 1,
    created_at: Date.now(),
  };
  write([...presets, preset]); // may throw — becomes a promise rejection
  return preset;
}

export async function updatePreset(
  id: string,
  patch: Partial<PresetInput & { pinned: number }>,
): Promise<Preset> {
  const presets = read();
  const index = presets.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Preset not found');
  const updated: Preset = { ...presets[index], ...patch };
  const next = [...presets];
  next[index] = updated;
  write(next); // may throw
  return updated;
}

export async function deletePreset(id: string): Promise<void> {
  const presets = read();
  const next = presets.filter((p) => p.id !== id);
  // Only write when something actually changed, so a delete of an unknown id can't
  // fail on a full store for no reason.
  if (next.length !== presets.length) write(next); // may throw
}
