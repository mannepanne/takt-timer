// ABOUT: Session history sync between localStorage and the server.
// ABOUT: importLocalHistory runs once on register; pushSession runs after each completed session.

import { apiFetch } from '@/lib/apiFetch';
import { readHistory, setHistory, clearHistory } from '@/lib/history';
import { isNativePlatform } from '@/lib/platform';
import type { CompletedSession } from '@/lib/timer/types';

type SessionRow = {
  id: string;
  completed_at: number;
  total_sec: number;
  sets: number;
  work_sec: number;
  rest_sec: number;
};

function toRow(s: CompletedSession & { id: string }): SessionRow {
  return {
    id: s.id,
    completed_at: s.completedAt,
    total_sec: s.totalSec,
    sets: s.sets,
    work_sec: s.workSec,
    rest_sec: s.restSec,
  };
}

export async function importLocalHistory(): Promise<number> {
  // Native has no server to import to (07c) — history lives only in localStorage.
  if (isNativePlatform()) return 0;
  const sessions = readHistory();
  if (sessions.length === 0) return 0;

  // Ensure stable UUIDs before sending so retries are idempotent.
  const enriched = sessions.map((s): CompletedSession & { id: string } => ({
    ...s,
    id: s.id ?? crypto.randomUUID(),
  }));
  setHistory(enriched);

  const res = await apiFetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessions: enriched.map(toRow) }),
  });

  if (!res.ok) throw new Error('Import failed');
  const { imported } = (await res.json()) as { imported: number };

  if (imported === enriched.length) {
    clearHistory();
  }

  return imported;
}

export async function pushSession(session: CompletedSession): Promise<void> {
  // No D1 sync on native (07c) — the completed session is already in localStorage.
  if (isNativePlatform()) return;
  const id = session.id ?? crypto.randomUUID();
  const row = toRow({ ...session, id });
  await apiFetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessions: [row] }),
  });
}
