-- voice_calls: tracks each successful /api/voice/parse call for dashboard metrics
CREATE TABLE IF NOT EXISTS voice_calls (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_handle TEXT,              -- null for anonymous
  called_at   INTEGER NOT NULL   -- Unix timestamp (ms)
);
CREATE INDEX IF NOT EXISTS idx_voice_calls_called_at ON voice_calls(called_at);

-- purge_runs: audit log for retention purge cron runs
CREATE TABLE IF NOT EXISTS purge_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at        INTEGER NOT NULL,   -- Unix timestamp (ms)
  users_deleted INTEGER NOT NULL
);

-- admin_log: audit trail for state-mutating admin actions (non-PII)
CREATE TABLE IF NOT EXISTS admin_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  action     TEXT    NOT NULL,
  actor      TEXT    NOT NULL,   -- CF-Access-Authenticated-User-Email
  target     TEXT,               -- userHandle when applicable
  logged_at  INTEGER NOT NULL    -- Unix timestamp (ms)
);
