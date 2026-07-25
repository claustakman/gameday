-- Migration 0010: password reset tokens

CREATE TABLE password_reset_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);
