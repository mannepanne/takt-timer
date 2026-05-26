// ABOUT: API client for the /api/presets CRUD endpoints.

import { apiFetch } from '@/lib/apiFetch';

export type Preset = {
  id: string;
  user_handle: string;
  name: string;
  sets: number;
  work_sec: number;
  rest_sec: number;
  pinned: number;
  order_index: number;
  created_at: number;
};

export type PresetInput = {
  name: string;
  sets: number;
  work_sec: number;
  rest_sec: number;
};

export async function listPresets(): Promise<Preset[]> {
  const res = await apiFetch('/api/presets');
  if (!res.ok) throw new Error('Failed to list presets');
  return res.json() as Promise<Preset[]>;
}

export async function createPreset(input: PresetInput): Promise<Preset> {
  const res = await apiFetch('/api/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create preset');
  return res.json() as Promise<Preset>;
}

export async function updatePreset(
  id: string,
  patch: Partial<PresetInput & { pinned: number }>,
): Promise<Preset> {
  const res = await apiFetch(`/api/presets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update preset');
  return res.json() as Promise<Preset>;
}

export async function deletePreset(id: string): Promise<void> {
  const res = await apiFetch(`/api/presets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete preset');
}

export async function reorderPresets(ids: string[]): Promise<void> {
  const res = await apiFetch('/api/presets/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Failed to reorder presets');
}
