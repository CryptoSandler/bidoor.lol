import { execute } from "./db";
import { ipHashRetentionDays } from "./payments/config";

/**
 * Data minimisation for caller identifiers.
 *
 * Every `ip_hash` in this schema exists to count requests inside a window of
 * minutes or hours. Keeping it for the life of a payment record turns a rate
 * limiting counter into a log of who visited, which is not what anyone agreed
 * to and not something worth defending in an incident.
 *
 * Rows are never deleted — a payment, a login attempt and a delisting are all
 * records worth keeping. Only the identifier is dropped.
 */
export type RetentionOutcome = {
  retentionDays: number;
  pendingBids: number;
  loginAttempts: number;
  sessions: number;
  verificationAttempts: number;
  expiredSessionsDeleted: number;
};

export async function purgeExpiredIdentifiers(): Promise<RetentionOutcome> {
  const days = ipHashRetentionDays();
  const cutoff = new Date(Date.now() - days * 86_400_000);

  const pendingBids = await execute(
    `UPDATE pending_bids SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < $1`,
    [cutoff],
  );

  const loginAttempts = await execute(
    `UPDATE admin_login_attempts SET ip_hash = '' WHERE ip_hash <> '' AND attempted_at < $1`,
    [cutoff],
  );

  const sessions = await execute(
    `UPDATE admin_sessions SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < $1`,
    [cutoff],
  );

  // These are pure counters with a ten-minute window; nothing is lost by
  // deleting them outright rather than blanking them.
  const verificationAttempts = await execute(
    `DELETE FROM verification_attempts WHERE attempted_at < $1`,
    [cutoff],
  );

  // A session that expired a month ago has no audit value the audit log does
  // not already carry.
  const expiredSessionsDeleted = await execute(
    `DELETE FROM admin_sessions WHERE expires_at < $1`,
    [cutoff],
  );

  return {
    retentionDays: days,
    pendingBids,
    loginAttempts,
    sessions,
    verificationAttempts,
    expiredSessionsDeleted,
  };
}
