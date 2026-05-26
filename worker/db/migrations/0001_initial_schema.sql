-- Phase 4: initial schema — users, presets, sessions.
-- NOTE: ON DELETE CASCADE declarations are advisory. D1 does not honour FK constraints
-- without PRAGMA foreign_keys = ON, which cannot be set per-connection via the HTTP API.
-- Account deletion must be performed as an explicit multi-statement transaction in the
-- delete handler (sessions → presets → users). See ADR 2026-05-26-phase-4-auth-architecture.md.

CREATE TABLE users (
  user_handle TEXT PRIMARY KEY,            -- random 16-byte, hex-encoded
  public_key  TEXT NOT NULL,               -- base64url-encoded COSE public key
  counter     INTEGER NOT NULL DEFAULT 0,
  is_admin    INTEGER NOT NULL DEFAULT 0,  -- 0/1, set manually until phase 6
  created_at  INTEGER NOT NULL             -- unix ms
);

CREATE TABLE presets (
  id          TEXT PRIMARY KEY,            -- uuid v4
  user_handle TEXT NOT NULL REFERENCES users(user_handle) ON DELETE CASCADE,
  name        TEXT NOT NULL,               -- max 100 chars, non-empty
  sets        INTEGER NOT NULL,            -- 1–99
  work_sec    INTEGER NOT NULL,            -- 5–3600
  rest_sec    INTEGER NOT NULL,            -- 0–3600
  pinned      INTEGER NOT NULL DEFAULT 0,  -- 0/1
  order_index INTEGER NOT NULL,
  created_at  INTEGER NOT NULL             -- unix ms
);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,           -- uuid v4, stable for idempotent import
  user_handle  TEXT NOT NULL REFERENCES users(user_handle) ON DELETE CASCADE,
  completed_at INTEGER NOT NULL,           -- unix ms
  total_sec    INTEGER NOT NULL,
  sets         INTEGER NOT NULL,
  work_sec     INTEGER NOT NULL,
  rest_sec     INTEGER NOT NULL
);

CREATE INDEX idx_presets_user ON presets(user_handle, order_index);
CREATE INDEX idx_sessions_user_completed ON sessions(user_handle, completed_at DESC);
