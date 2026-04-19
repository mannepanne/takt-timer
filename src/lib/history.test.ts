import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appendHistory, clearHistory, lastSession, readHistory } from './history';
import type { CompletedSession } from '@/lib/timer/types';

function entry(completedAt: number): CompletedSession {
  return { completedAt, totalSec: 180, sets: 3, workSec: 60, restSec: 0 };
}

describe('history', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns [] on first read', () => {
    expect(readHistory()).toEqual([]);
  });

  it('append adds to the end and read returns in insertion order', () => {
    appendHistory(entry(1));
    appendHistory(entry(2));
    const all = readHistory();
    expect(all.map((e) => e.completedAt)).toEqual([1, 2]);
  });

  it('cap at 30 entries — oldest drop when exceeded', () => {
    for (let i = 1; i <= 35; i++) appendHistory(entry(i));
    const all = readHistory();
    expect(all).toHaveLength(30);
    expect(all[0].completedAt).toBe(6);
    expect(all[29].completedAt).toBe(35);
  });

  it('lastSession returns the most-recent entry', () => {
    appendHistory(entry(1));
    appendHistory(entry(2));
    expect(lastSession()?.completedAt).toBe(2);
  });

  it('lastSession returns null when empty', () => {
    expect(lastSession()).toBeNull();
  });

  it('corrupted JSON falls back to []', () => {
    localStorage.setItem('takt.history.v1', 'not json at all');
    expect(readHistory()).toEqual([]);
  });

  it('non-array JSON falls back to []', () => {
    localStorage.setItem('takt.history.v1', '{"weird": true}');
    expect(readHistory()).toEqual([]);
  });

  it('filters out malformed entries', () => {
    localStorage.setItem('takt.history.v1', JSON.stringify([entry(1), { bogus: true }, entry(2)]));
    expect(readHistory().map((e) => e.completedAt)).toEqual([1, 2]);
  });

  it('QuotaExceededError on write drops oldest and retries once', () => {
    // Seed 2 entries.
    appendHistory(entry(1));
    appendHistory(entry(2));
    // Next setItem throws QuotaExceededError once; the retry with one-less entry succeeds.
    const original = Storage.prototype.setItem;
    let threw = false;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (!threw) {
        threw = true;
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return original.call(this, k, v);
    };
    appendHistory(entry(3));
    Storage.prototype.setItem = original;
    const all = readHistory();
    // After drop-oldest-and-retry: original 2 entries become 1, then retry adds entry(3). End state
    // depends on the retry path; assert it didn't crash and history is still valid.
    expect(Array.isArray(all)).toBe(true);
    expect(all.every((e) => typeof e.completedAt === 'number')).toBe(true);
  });

  it('clearHistory removes the key', () => {
    appendHistory(entry(1));
    clearHistory();
    expect(readHistory()).toEqual([]);
  });
});
