// ABOUT: D1 query helpers for users, presets, and sessions.
// ABOUT: Account deletion uses explicit cascading deletes — D1 FK constraints are advisory only.

import type { UserRow, PresetRow, SessionRow } from './schema';

// ── Users ──────────────────────────────────────────────────────────────────

export function getUserByHandle(db: D1Database, userHandle: string) {
  return db.prepare('SELECT * FROM users WHERE user_handle = ?').bind(userHandle).first<UserRow>();
}

export function insertUser(
  db: D1Database,
  user: Omit<UserRow, 'is_admin'> & { is_admin?: number },
) {
  return db
    .prepare(
      'INSERT INTO users (user_handle, public_key, counter, is_admin, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(user.user_handle, user.public_key, user.counter, user.is_admin ?? 0, user.created_at)
    .run();
}

export function updateUserCounter(db: D1Database, userHandle: string, counter: number) {
  return db
    .prepare('UPDATE users SET counter = ? WHERE user_handle = ?')
    .bind(counter, userHandle)
    .run();
}

export async function deleteUserCascade(db: D1Database, userHandle: string) {
  // Explicit cascade — D1 does not honour FK ON DELETE CASCADE without PRAGMA.
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_handle = ?').bind(userHandle),
    db.prepare('DELETE FROM presets WHERE user_handle = ?').bind(userHandle),
    db.prepare('DELETE FROM users WHERE user_handle = ?').bind(userHandle),
  ]);
}

// ── Presets ────────────────────────────────────────────────────────────────

export function listPresets(db: D1Database, userHandle: string) {
  return db
    .prepare('SELECT * FROM presets WHERE user_handle = ? ORDER BY pinned DESC, order_index ASC')
    .bind(userHandle)
    .all<PresetRow>();
}

export function getPreset(db: D1Database, id: string, userHandle: string) {
  return db
    .prepare('SELECT * FROM presets WHERE id = ? AND user_handle = ?')
    .bind(id, userHandle)
    .first<PresetRow>();
}

export function insertPreset(db: D1Database, preset: PresetRow) {
  return db
    .prepare(
      'INSERT INTO presets (id, user_handle, name, sets, work_sec, rest_sec, pinned, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      preset.id,
      preset.user_handle,
      preset.name,
      preset.sets,
      preset.work_sec,
      preset.rest_sec,
      preset.pinned,
      preset.order_index,
      preset.created_at,
    )
    .run();
}

export function updatePreset(
  db: D1Database,
  id: string,
  userHandle: string,
  fields: Partial<Pick<PresetRow, 'name' | 'sets' | 'work_sec' | 'rest_sec' | 'pinned'>>,
) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return Promise.resolve();
  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  return db
    .prepare(`UPDATE presets SET ${setClauses} WHERE id = ? AND user_handle = ?`)
    .bind(...values, id, userHandle)
    .run();
}

export function deletePreset(db: D1Database, id: string, userHandle: string) {
  return db
    .prepare('DELETE FROM presets WHERE id = ? AND user_handle = ?')
    .bind(id, userHandle)
    .run();
}

export async function reorderPresets(
  db: D1Database,
  userHandle: string,
  ids: string[],
): Promise<void> {
  const statements = ids.map((id, index) =>
    db
      .prepare('UPDATE presets SET order_index = ? WHERE id = ? AND user_handle = ?')
      .bind(index, id, userHandle),
  );
  if (statements.length > 0) await db.batch(statements);
}

export function getMaxOrderIndex(db: D1Database, userHandle: string) {
  return db
    .prepare('SELECT COALESCE(MAX(order_index), -1) as max_idx FROM presets WHERE user_handle = ?')
    .bind(userHandle)
    .first<{ max_idx: number }>();
}

// ── Sessions ───────────────────────────────────────────────────────────────

export function listSessions(db: D1Database, userHandle: string, limit = 30) {
  return db
    .prepare('SELECT * FROM sessions WHERE user_handle = ? ORDER BY completed_at DESC LIMIT ?')
    .bind(userHandle, limit)
    .all<SessionRow>();
}

export async function insertSessions(db: D1Database, rows: SessionRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const statements = rows.map((s) =>
    db
      .prepare(
        'INSERT OR IGNORE INTO sessions (id, user_handle, completed_at, total_sec, sets, work_sec, rest_sec) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(s.id, s.user_handle, s.completed_at, s.total_sec, s.sets, s.work_sec, s.rest_sec),
  );
  const results = await db.batch(statements);
  return results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
}

export function getLatestSession(db: D1Database, userHandle: string) {
  return db
    .prepare('SELECT * FROM sessions WHERE user_handle = ? ORDER BY completed_at DESC LIMIT 1')
    .bind(userHandle)
    .first<SessionRow>();
}
