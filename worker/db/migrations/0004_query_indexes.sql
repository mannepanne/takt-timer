-- Indexes for dashboard time-range queries to avoid full table scans as data grows.
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_completed_at ON sessions (completed_at);
