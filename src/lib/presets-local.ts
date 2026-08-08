// ABOUT: Device-scoped presets store for the native (Android) build — localStorage-backed.
// ABOUT: Mirrors presets.ts's async surface so PresetsDrawer/SavePresetSheet stay byte-identical,
// ABOUT: but surfaces write failures to the caller and never silently caps or evicts a user's presets.

const STORAGE_KEY = 'takt.presets.v1';

// The Preset shape the drawer reads, minus the server-only fields: no `user_handle`
// (there are no accounts on native) and no usage counts (dropped for web parity).
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

// Reading is tolerant: a missing key or corrupt JSON yields an empty list rather than
// throwing, because a read miss is non-fatal (the drawer just shows no presets). This is
// the ONE place we swallow an error — writes below deliberately do not.
function read(): Preset[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Preset[]) : [];
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
  return read().sort((a, b) => a.order_index - b.order_index);
}

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
