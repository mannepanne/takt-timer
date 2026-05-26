// ABOUT: Unit tests for importLocalHistory and pushSession.

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/history', () => ({
  readHistory: vi.fn(),
  setHistory: vi.fn(),
  clearHistory: vi.fn(),
}));

import { apiFetch } from '@/lib/apiFetch';
import { readHistory, setHistory, clearHistory } from '@/lib/history';
import { importLocalHistory, pushSession } from './history-sync';

function mockRes(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

const SESSION = {
  id: crypto.randomUUID(),
  completedAt: 1700000000,
  totalSec: 300,
  sets: 3,
  workSec: 60,
  restSec: 30,
};

beforeEach(() => vi.clearAllMocks());

describe('importLocalHistory', () => {
  it('returns 0 without calling API when history is empty', async () => {
    vi.mocked(readHistory).mockReturnValueOnce([]);
    const count = await importLocalHistory();
    expect(count).toBe(0);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('POSTs sessions and returns imported count', async () => {
    vi.mocked(readHistory).mockReturnValueOnce([SESSION]);
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({ imported: 1 }) as never);
    const count = await importLocalHistory();
    expect(count).toBe(1);
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/sessions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('maps camelCase fields to snake_case for the API', async () => {
    vi.mocked(readHistory).mockReturnValueOnce([SESSION]);
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({ imported: 1 }) as never);
    await importLocalHistory();
    const body = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]!.body as string);
    expect(body.sessions[0]).toMatchObject({
      completed_at: SESSION.completedAt,
      total_sec: SESSION.totalSec,
      work_sec: SESSION.workSec,
      rest_sec: SESSION.restSec,
    });
  });

  it('clears history when imported count matches', async () => {
    vi.mocked(readHistory).mockReturnValueOnce([SESSION]);
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({ imported: 1 }) as never);
    await importLocalHistory();
    expect(clearHistory).toHaveBeenCalled();
  });

  it('does not clear history on count mismatch', async () => {
    vi.mocked(readHistory).mockReturnValueOnce([SESSION]);
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({ imported: 0 }) as never);
    await importLocalHistory();
    expect(clearHistory).not.toHaveBeenCalled();
  });

  it('generates and persists stable IDs for sessions without id', async () => {
    const noId = { ...SESSION };
    delete (noId as { id?: string }).id;
    vi.mocked(readHistory).mockReturnValueOnce([noId]);
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({ imported: 1 }) as never);
    await importLocalHistory();
    expect(setHistory).toHaveBeenCalledWith([expect.objectContaining({ id: expect.any(String) })]);
  });

  it('throws on API failure', async () => {
    vi.mocked(readHistory).mockReturnValueOnce([SESSION]);
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}, 500) as never);
    await expect(importLocalHistory()).rejects.toThrow('Import failed');
  });
});

describe('pushSession', () => {
  it('POSTs the session row to /api/sessions', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({ imported: 1 }) as never);
    await pushSession(SESSION);
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/sessions',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]!.body as string);
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]).toMatchObject({
      id: SESSION.id,
      completed_at: SESSION.completedAt,
      total_sec: SESSION.totalSec,
    });
  });

  it('uses a generated UUID when session has no id', async () => {
    const noId = { ...SESSION };
    delete (noId as { id?: string }).id;
    vi.mocked(apiFetch).mockResolvedValueOnce(mockRes({}) as never);
    await pushSession(noId);
    const body = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]!.body as string);
    expect(body.sessions[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
