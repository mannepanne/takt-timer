// ABOUT: D1 query helpers for users, presets, sessions, and admin tables.
// ABOUT: Account deletion uses explicit cascading deletes — D1 FK constraints are advisory only.

import type { UserRow, UserSettings, PresetRow, SessionRow, AdminUserRow } from './schema';

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
      'INSERT INTO users (user_handle, public_key, counter, is_admin, created_at, language, accent_colour, sound_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      user.user_handle,
      user.public_key,
      user.counter,
      user.is_admin ?? 0,
      user.created_at,
      user.language,
      user.accent_colour,
      user.sound_on,
    )
    .run();
}

export function updateUserCounter(db: D1Database, userHandle: string, counter: number) {
  return db
    .prepare('UPDATE users SET counter = ? WHERE user_handle = ?')
    .bind(counter, userHandle)
    .run();
}

export function getUserSettings(db: D1Database, userHandle: string) {
  return db
    .prepare('SELECT language, accent_colour, sound_on FROM users WHERE user_handle = ?')
    .bind(userHandle)
    .first<UserSettings>();
}

export function updateUserSettings(db: D1Database, userHandle: string, settings: UserSettings) {
  return db
    .prepare('UPDATE users SET language = ?, accent_colour = ?, sound_on = ? WHERE user_handle = ?')
    .bind(settings.language, settings.accent_colour, settings.sound_on, userHandle)
    .run();
}

export async function deleteUserCascade(db: D1Database, userHandle: string) {
  // Explicit cascade — D1 does not honour FK ON DELETE CASCADE without PRAGMA.
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_handle = ?').bind(userHandle),
    db.prepare('DELETE FROM presets WHERE user_handle = ?').bind(userHandle),
    db.prepare('DELETE FROM voice_calls WHERE user_handle = ?').bind(userHandle),
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

// ── Admin / metrics ────────────────────────────────────────────────────────

export function insertVoiceCall(db: D1Database, userHandle: string | null, calledAt: number) {
  return db
    .prepare('INSERT INTO voice_calls (user_handle, called_at) VALUES (?, ?)')
    .bind(userHandle, calledAt)
    .run();
}

export function insertPurgeRun(db: D1Database, ranAt: number, usersDeleted: number) {
  return db
    .prepare('INSERT INTO purge_runs (ran_at, users_deleted) VALUES (?, ?)')
    .bind(ranAt, usersDeleted)
    .run();
}

export function insertAdminLog(
  db: D1Database,
  action: 'delete_user' | 'purge_run',
  actor: string,
  target: string | null,
  loggedAt: number,
) {
  return db
    .prepare('INSERT INTO admin_log (action, actor, target, logged_at) VALUES (?, ?, ?, ?)')
    .bind(action, actor, target, loggedAt)
    .run();
}

export function pruneVoiceCalls(db: D1Database, olderThanMs: number) {
  return db.prepare('DELETE FROM voice_calls WHERE called_at < ?').bind(olderThanMs).run();
}

// Correlated subqueries avoid cartesian product from JOIN-ing sessions and presets simultaneously.
export function listAllUsersAdmin(db: D1Database) {
  return db
    .prepare(
      `SELECT
         u.user_handle,
         u.created_at,
         (SELECT COUNT(*) FROM sessions WHERE sessions.user_handle = u.user_handle) AS session_count,
         (SELECT MAX(completed_at) FROM sessions WHERE sessions.user_handle = u.user_handle) AS last_session_at,
         (SELECT COUNT(*) FROM presets WHERE presets.user_handle = u.user_handle) AS preset_count
       FROM users u
       ORDER BY u.created_at DESC`,
    )
    .all<AdminUserRow>();
}

export function getUserByHandleAdmin(db: D1Database, userHandle: string) {
  return db
    .prepare(
      `SELECT
         u.user_handle,
         u.created_at,
         (SELECT COUNT(*) FROM sessions WHERE sessions.user_handle = u.user_handle) AS session_count,
         (SELECT MAX(completed_at) FROM sessions WHERE sessions.user_handle = u.user_handle) AS last_session_at,
         (SELECT COUNT(*) FROM presets WHERE presets.user_handle = u.user_handle) AS preset_count
       FROM users u
       WHERE u.user_handle = ?`,
    )
    .bind(userHandle)
    .first<AdminUserRow>();
}

// CHUNK_SIZE=24 → 96 statements per batch (4 DELETEs × 24 users), safely under D1's 100-stmt limit.
const PURGE_CHUNK_SIZE = 24;

export async function pruneInactiveUsers(
  db: D1Database,
  thresholdMs: number,
  dryRun: boolean,
): Promise<{ userHandles: string[]; deleted: number }> {
  const { results } = await db
    .prepare(
      `SELECT user_handle FROM users
       WHERE created_at < ?
         AND NOT EXISTS (SELECT 1 FROM sessions WHERE sessions.user_handle = users.user_handle)
         AND NOT EXISTS (SELECT 1 FROM presets WHERE presets.user_handle = users.user_handle)`,
    )
    .bind(thresholdMs)
    .all<{ user_handle: string }>();

  const handles = results.map((r) => r.user_handle);

  if (dryRun || handles.length === 0) {
    return { userHandles: handles, deleted: 0 };
  }

  let deleted = 0;
  for (let i = 0; i < handles.length; i += PURGE_CHUNK_SIZE) {
    const chunk = handles.slice(i, i + PURGE_CHUNK_SIZE);
    // Re-verify eligibility per chunk: a user could have created a session or preset
    // between the initial SELECT and this batch, so we must not delete them.
    const placeholders = chunk.map(() => '?').join(', ');
    const { results: stillEligible } = await db
      .prepare(
        `SELECT user_handle FROM users
         WHERE user_handle IN (${placeholders})
           AND NOT EXISTS (SELECT 1 FROM sessions WHERE sessions.user_handle = users.user_handle)
           AND NOT EXISTS (SELECT 1 FROM presets WHERE presets.user_handle = users.user_handle)`,
      )
      .bind(...chunk)
      .all<{ user_handle: string }>();
    const eligible = new Set(stillEligible.map((r) => r.user_handle));
    const safeChunk = chunk.filter((h) => eligible.has(h));
    if (safeChunk.length === 0) continue;
    deleted += safeChunk.length;
    await db.batch([
      ...safeChunk.map((h) => db.prepare('DELETE FROM sessions WHERE user_handle = ?').bind(h)),
      ...safeChunk.map((h) => db.prepare('DELETE FROM presets WHERE user_handle = ?').bind(h)),
      ...safeChunk.map((h) => db.prepare('DELETE FROM voice_calls WHERE user_handle = ?').bind(h)),
      ...safeChunk.map((h) => db.prepare('DELETE FROM users WHERE user_handle = ?').bind(h)),
    ]);
  }

  return { userHandles: handles, deleted };
}
