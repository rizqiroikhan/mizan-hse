ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));
ALTER TABLE users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1));
ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT NOT NULL DEFAULT '';

ALTER TABLE sessions ADD COLUMN revoked_at TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN csrf_token TEXT NOT NULL DEFAULT '';

UPDATE users SET is_demo=1 WHERE id IN ('staff','manager','supervisor','management');
UPDATE sessions SET last_seen_at=created_at WHERE last_seen_at='';

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active, role);
