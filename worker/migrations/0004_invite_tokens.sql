-- Migration 0004: invite tokens for user onboarding

CREATE TABLE invite_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_invite_tokens_user ON invite_tokens(user_id);
