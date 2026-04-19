// ABOUT: localStorage-backed session history for anonymous users.
// ABOUT: Capped at 30 entries; schema matches the future D1 sessions table for Phase 4 import.

import type { CompletedSession } from '@/lib/timer/types';

const STORAGE_KEY = 'takt.history.v1';
const MAX_ENTRIES = 30;

function safeGet(): CompletedSession[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCompletedSession);
  } catch {
    return [];
  }
}

function isCompletedSession(value: unknown): value is CompletedSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.completedAt === 'number' &&
    typeof v.totalSec === 'number' &&
    typeof v.sets === 'number' &&
    typeof v.workSec === 'number' &&
    typeof v.restSec === 'number'
  );
}

function safeSet(entries: CompletedSession[]): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      // Drop oldest and retry once.
      if (entries.length > 1) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(1)));
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  }
}

export function readHistory(): CompletedSession[] {
  return safeGet();
}

export function appendHistory(entry: CompletedSession): CompletedSession[] {
  const current = safeGet();
  const next = [...current, entry].slice(-MAX_ENTRIES);
  safeSet(next);
  return next;
}

export function lastSession(): CompletedSession | null {
  const all = safeGet();
  if (all.length === 0) return null;
  return all[all.length - 1];
}

export function clearHistory(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}
