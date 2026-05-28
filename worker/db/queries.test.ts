// ABOUT: Unit tests for D1 query helpers — verifies correct SQL and argument binding.

import { describe, expect, it, vi } from 'vitest';
import {
  getUserByHandle,
  insertUser,
  updateUserCounter,
  getUserSettings,
  updateUserSettings,
  deleteUserCascade,
  listPresets,
  getPreset,
  insertPreset,
  updatePreset,
  deletePreset,
  reorderPresets,
  getMaxOrderIndex,
  listSessions,
  insertSessions,
  getLatestSession,
  insertVoiceCall,
  insertPurgeRun,
  insertAdminLog,
  getUserByHandleAdmin,
  pruneInactiveUsers,
} from './queries';

function makeStmt(returnVal?: unknown) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(async () => returnVal ?? null),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    all: vi.fn(async () => ({ results: Array.isArray(returnVal) ? returnVal : [] })),
  };
  return stmt;
}

function makeD1(returnVal?: unknown) {
  const stmt = makeStmt(returnVal);
  const db = {
    prepare: vi.fn(() => stmt),
    batch: vi.fn(async (stmts: any[]) =>
      stmts.map(() => ({ success: true, meta: { changes: 1 } })),
    ),
    exec: vi.fn(),
    dump: vi.fn(),
  } as unknown as D1Database;
  return { db, stmt };
}

const USER = {
  user_handle: 'aabb1122334455667788aabbccddeeff',
  public_key: 'base64key',
  counter: 0,
  is_admin: 0,
  created_at: 1000,
  language: 'en',
  accent_colour: 'lichen',
  sound_on: 1,
};

const PRESET = {
  id: crypto.randomUUID(),
  user_handle: 'u1',
  name: 'Legs',
  sets: 3,
  work_sec: 60,
  rest_sec: 30,
  pinned: 0,
  order_index: 0,
  created_at: 1000,
};

const SESSION = {
  id: crypto.randomUUID(),
  user_handle: 'u1',
  completed_at: 1700000000,
  total_sec: 300,
  sets: 3,
  work_sec: 60,
  rest_sec: 30,
};

describe('getUserByHandle', () => {
  it('prepares SELECT query and binds userHandle', async () => {
    const { db, stmt } = makeD1(USER);
    await getUserByHandle(db, 'aabb');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM users'));
    expect(stmt.bind).toHaveBeenCalledWith('aabb');
    expect(stmt.first).toHaveBeenCalled();
  });
});

describe('insertUser', () => {
  it('prepares INSERT and binds all user fields', async () => {
    const { db, stmt } = makeD1();
    await insertUser(db, USER);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'));
    expect(stmt.bind).toHaveBeenCalledWith(
      USER.user_handle,
      USER.public_key,
      USER.counter,
      USER.is_admin,
      USER.created_at,
      USER.language,
      USER.accent_colour,
      USER.sound_on,
    );
  });

  it('defaults is_admin to 0 when omitted', async () => {
    const { db, stmt } = makeD1();
    const { is_admin: _, ...withoutAdmin } = USER;
    await insertUser(db, withoutAdmin);
    const bindArgs = (stmt.bind as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(bindArgs[3]).toBe(0);
  });
});

describe('getUserSettings', () => {
  it('prepares SELECT query and binds userHandle', async () => {
    const { db, stmt } = makeD1({ language: 'en', accent_colour: 'lichen', sound_on: 1 });
    await getUserSettings(db, 'u1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT language'));
    expect(stmt.bind).toHaveBeenCalledWith('u1');
  });
});

describe('updateUserSettings', () => {
  it('prepares UPDATE query and binds all settings fields', async () => {
    const { db, stmt } = makeD1();
    const settings = { language: 'sv', accent_colour: 'coral', sound_on: 0 };
    await updateUserSettings(db, 'u1', settings);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET language'));
    expect(stmt.bind).toHaveBeenCalledWith('sv', 'coral', 0, 'u1');
  });
});

describe('updateUserCounter', () => {
  it('prepares UPDATE query and binds counter + userHandle', async () => {
    const { db, stmt } = makeD1();
    await updateUserCounter(db, 'aabb', 5);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET counter'));
    expect(stmt.bind).toHaveBeenCalledWith(5, 'aabb');
  });
});

describe('deleteUserCascade', () => {
  it('calls db.batch with 3 statements (sessions, presets, users)', async () => {
    const { db } = makeD1();
    await deleteUserCascade(db, 'aabb');
    const batchArgs = (db.batch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(batchArgs).toHaveLength(3);
    // Verify order: sessions first, presets second, users third
    const sqls = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.map(
      (args: any[]) => args[0] as string,
    );
    expect(sqls[0]).toContain('DELETE FROM sessions');
    expect(sqls[1]).toContain('DELETE FROM presets');
    expect(sqls[2]).toContain('DELETE FROM users');
  });
});

describe('listPresets', () => {
  it('prepares SELECT with ORDER BY pinned DESC, order_index ASC', async () => {
    const { db, stmt } = makeD1([PRESET]);
    await listPresets(db, 'u1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY pinned DESC/));
    expect(stmt.bind).toHaveBeenCalledWith('u1');
    expect(stmt.all).toHaveBeenCalled();
  });
});

describe('getPreset', () => {
  it('prepares SELECT with id AND user_handle filter', async () => {
    const { db, stmt } = makeD1(PRESET);
    await getPreset(db, 'p1', 'u1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('user_handle = ?'));
    expect(stmt.bind).toHaveBeenCalledWith('p1', 'u1');
  });
});

describe('insertPreset', () => {
  it('prepares INSERT with all 9 preset columns', async () => {
    const { db, stmt } = makeD1();
    await insertPreset(db, PRESET);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO presets'));
    const bindArgs = (stmt.bind as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(bindArgs).toHaveLength(9);
  });
});

describe('updatePreset', () => {
  it('prepares dynamic UPDATE with provided fields', async () => {
    const { db, stmt } = makeD1();
    await updatePreset(db, 'p1', 'u1', { name: 'New', sets: 4 });
    const sql = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE presets SET');
    expect(sql).toContain('name = ?');
    expect(sql).toContain('sets = ?');
    expect(stmt.bind).toHaveBeenCalledWith('New', 4, 'p1', 'u1');
  });

  it('is a no-op when no fields are provided', async () => {
    const { db } = makeD1();
    await updatePreset(db, 'p1', 'u1', {});
    expect(db.prepare).not.toHaveBeenCalled();
  });
});

describe('deletePreset', () => {
  it('prepares DELETE with id and user_handle', async () => {
    const { db, stmt } = makeD1();
    await deletePreset(db, 'p1', 'u1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM presets'));
    expect(stmt.bind).toHaveBeenCalledWith('p1', 'u1');
  });
});

describe('reorderPresets', () => {
  it('calls db.batch with one UPDATE per id', async () => {
    const { db } = makeD1();
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    await reorderPresets(db, 'u1', ids);
    const batchArgs = (db.batch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(batchArgs).toHaveLength(2);
  });

  it('is a no-op for empty ids array', async () => {
    const { db } = makeD1();
    await reorderPresets(db, 'u1', []);
    expect(db.batch).not.toHaveBeenCalled();
  });
});

describe('getMaxOrderIndex', () => {
  it('prepares COALESCE MAX query', async () => {
    const { db, stmt } = makeD1({ max_idx: 3 });
    await getMaxOrderIndex(db, 'u1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('COALESCE(MAX(order_index)'));
    expect(stmt.bind).toHaveBeenCalledWith('u1');
  });
});

describe('listSessions', () => {
  it('prepares SELECT with ORDER BY completed_at DESC and LIMIT', async () => {
    const { db, stmt } = makeD1([SESSION]);
    await listSessions(db, 'u1');
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringMatching(/ORDER BY completed_at DESC LIMIT/),
    );
    expect(stmt.bind).toHaveBeenCalledWith('u1', 30);
    expect(stmt.all).toHaveBeenCalled();
  });
});

describe('insertSessions', () => {
  it('returns 0 for empty rows array without calling D1', async () => {
    const { db } = makeD1();
    const count = await insertSessions(db, []);
    expect(count).toBe(0);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('calls db.batch with INSERT OR IGNORE statements', async () => {
    const { db } = makeD1();
    await insertSessions(db, [SESSION]);
    expect(db.batch).toHaveBeenCalled();
    const stmts = (db.batch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(stmts).toHaveLength(1);
  });

  it('sums changes from batch results', async () => {
    const { db } = makeD1();
    // batch returns 1 change per statement (from makeD1 default)
    const count = await insertSessions(db, [SESSION, { ...SESSION, id: crypto.randomUUID() }]);
    expect(count).toBe(2);
  });
});

describe('getLatestSession', () => {
  it('prepares SELECT with ORDER BY completed_at DESC LIMIT 1', async () => {
    const { db, stmt } = makeD1(SESSION);
    await getLatestSession(db, 'u1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringMatching(/LIMIT 1/));
    expect(stmt.bind).toHaveBeenCalledWith('u1');
  });
});

describe('insertVoiceCall', () => {
  it('prepares INSERT with user_handle and called_at', async () => {
    const { db, stmt } = makeD1();
    await insertVoiceCall(db, 'u1', 1700000000000);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO voice_calls'));
    expect(stmt.bind).toHaveBeenCalledWith('u1', 1700000000000);
  });

  it('accepts null user_handle for anonymous calls', async () => {
    const { db, stmt } = makeD1();
    await insertVoiceCall(db, null, 1700000000000);
    expect(stmt.bind).toHaveBeenCalledWith(null, 1700000000000);
  });
});

describe('insertPurgeRun', () => {
  it('prepares INSERT with ran_at and users_deleted', async () => {
    const { db, stmt } = makeD1();
    await insertPurgeRun(db, 1700000000000, 5);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO purge_runs'));
    expect(stmt.bind).toHaveBeenCalledWith(1700000000000, 5);
  });
});

describe('insertAdminLog', () => {
  it('prepares INSERT with all 4 fields', async () => {
    const { db, stmt } = makeD1();
    await insertAdminLog(db, 'delete_user', 'admin@example.com', 'u1', 1700000000000);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO admin_log'));
    expect(stmt.bind).toHaveBeenCalledWith('delete_user', 'admin@example.com', 'u1', 1700000000000);
  });

  it('accepts null target', async () => {
    const { db, stmt } = makeD1();
    await insertAdminLog(db, 'purge_run', 'admin@example.com', null, 1700000000000);
    expect(stmt.bind).toHaveBeenCalledWith('purge_run', 'admin@example.com', null, 1700000000000);
  });
});

describe('getUserByHandleAdmin', () => {
  it('prepares correlated-subquery SELECT and binds userHandle', async () => {
    const adminUser = {
      user_handle: 'u1',
      created_at: 1000,
      session_count: 3,
      last_session_at: 2000,
      preset_count: 1,
    };
    const { db, stmt } = makeD1(adminUser);
    await getUserByHandleAdmin(db, 'u1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('session_count'));
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('preset_count'));
    expect(stmt.bind).toHaveBeenCalledWith('u1');
    expect(stmt.first).toHaveBeenCalled();
  });
});

describe('pruneInactiveUsers', () => {
  it('dry run returns handles without calling db.batch', async () => {
    const handles = [{ user_handle: 'u1' }, { user_handle: 'u2' }];
    const { db } = makeD1(handles);
    const result = await pruneInactiveUsers(db, 1000, true);
    expect(result.userHandles).toEqual(['u1', 'u2']);
    expect(result.deleted).toBe(0);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('returns empty result without batching when no eligible users', async () => {
    const { db } = makeD1([]);
    const result = await pruneInactiveUsers(db, 1000, false);
    expect(result.userHandles).toEqual([]);
    expect(result.deleted).toBe(0);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('batches 3N delete statements for N eligible users', async () => {
    const handles = [{ user_handle: 'u1' }, { user_handle: 'u2' }];
    const { db } = makeD1(handles);
    const result = await pruneInactiveUsers(db, 1000, false);
    expect(result.deleted).toBe(2);
    expect(db.batch).toHaveBeenCalledTimes(1);
    const stmts = (db.batch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(stmts).toHaveLength(6); // 2 users × 3 DELETEs
  });

  it('splits into multiple batches when user count exceeds chunk size (30)', async () => {
    const handles = Array.from({ length: 31 }, (_, i) => ({ user_handle: `u${i}` }));
    const { db } = makeD1(handles);
    const result = await pruneInactiveUsers(db, 1000, false);
    expect(result.deleted).toBe(31);
    expect(db.batch).toHaveBeenCalledTimes(2);
    const firstBatch = (db.batch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(firstBatch).toHaveLength(90); // 30 × 3
    const secondBatch = (db.batch as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(secondBatch).toHaveLength(3); // 1 × 3
  });

  it('binds thresholdMs as the SELECT filter parameter', async () => {
    const { db, stmt } = makeD1([]);
    await pruneInactiveUsers(db, 9_999_999_999, false);
    expect(stmt.bind).toHaveBeenCalledWith(9_999_999_999);
  });
});
