-- Admin hardening: revocable sessions, login throttling, and an audit trail.
--
-- Addresses M-1, M-2 and M-3 from AUDITORIA-SEGURIDAD.md. The theme is that the
-- admin token was the master secret and behaved like one: it sat in the cookie
-- in clear, could be brute-forced without limit or trace, and leaked its length
-- through an early-returning comparison.

BEGIN;

-- Sessions, so the cookie carries a revocable identifier instead of the secret
-- itself. Logging out, or an operator leaving, is now a row change rather than
-- a redeploy with a new environment variable.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id          TEXT PRIMARY KEY,
  token_label TEXT        NOT NULL,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_sessions_live ON admin_sessions (expires_at, revoked_at);

-- Every attempt to authenticate, successful or not. Failures drive the lockout;
-- successes are kept because "when did this token last work" is the first
-- question asked when something looks wrong.
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id           TEXT PRIMARY KEY,
  ip_hash      TEXT        NOT NULL,
  token_label  TEXT,
  succeeded    BOOLEAN     NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_login_attempts_ip
  ON admin_login_attempts (ip_hash, attempted_at);

-- The audit trail. Append-only, enforced below.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          TEXT PRIMARY KEY,
  actor       TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created ON admin_audit_log (created_at DESC);

-- Append-only as a database rule rather than a convention. An audit log that the
-- application can quietly rewrite is not an audit log, and "we only ever INSERT"
-- is a promise about code that changes, not about data that already exists.
CREATE OR REPLACE FUNCTION admin_audit_log_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_audit_log_no_mutation ON admin_audit_log;
CREATE TRIGGER admin_audit_log_no_mutation
  BEFORE UPDATE OR DELETE OR TRUNCATE ON admin_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION admin_audit_log_is_append_only();

INSERT INTO schema_migrations (version) VALUES ('002_admin_hardening')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
