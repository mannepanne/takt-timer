// ABOUT: localStorage persistence for the stopwatch's state, so it survives a page
// ABOUT: reload or the browser restarting — not just navigating within the app.

import type { MachineState, Phase } from './types';

const STORAGE_KEY = 'takt.stopwatch.v1';

function isPhase(value: unknown): value is Phase {
  return value === 'idle' || value === 'running' || value === 'paused';
}

function isMachineState(value: unknown): value is MachineState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    isPhase(v.phase) &&
    typeof v.accumulatedMs === 'number' &&
    Number.isFinite(v.accumulatedMs) &&
    (v.startedAtMs === null ||
      (typeof v.startedAtMs === 'number' && Number.isFinite(v.startedAtMs)))
  );
}

export function readPersistedState(): MachineState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isMachineState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function persistState(state: MachineState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort — private browsing / quota exceeded / storage disabled.
  }
}
