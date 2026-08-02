-- Migration 0011: WebAuthn (Face ID / Touch ID) credentials

CREATE TABLE webauthn_credentials (
  id           TEXT PRIMARY KEY,        -- base64url credential ID
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key   TEXT NOT NULL,           -- base64url-encoded COSE public key
  counter      INTEGER NOT NULL DEFAULT 0,
  transports   TEXT,                    -- JSON array of AuthenticatorTransportFuture
  device_name  TEXT,
  created_at   TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX idx_webauthn_credentials_user ON webauthn_credentials(user_id);

-- One in-flight registration/authentication ceremony per user at a time
CREATE TABLE webauthn_challenges (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  challenge  TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('register', 'authenticate')),
  expires_at TEXT NOT NULL
);
