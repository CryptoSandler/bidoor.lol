import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { execute, query, queryOne } from "./db";
import { ADMIN_LOGIN_LIMITS, ADMIN_SESSION_HOURS } from "./payments/config";
import { clientIp, hashIp } from "./payments/limits";

/**
 * Admin access.
 *
 * The shape here answers three findings. The cookie no longer carries the
 * master secret — it carries a revocable session id, so a leaked cookie is a
 * session to revoke rather than an environment variable to rotate. Failed
 * logins are counted and locked out, because an endpoint that answers
 * "is this the token?" without limit is a brute-force oracle. And the token
 * comparison is over fixed-length digests, so it cannot leak the secret's
 * length through an early return.
 */

export const ADMIN_COOKIE = "bidoor_admin";

/**
 * Configured tokens, each with a label so the audit trail can say *which*
 * operator acted. ADMIN_TOKENS takes "label:secret" pairs; ADMIN_TOKEN remains
 * as the single-operator form.
 */
export function adminTokens(): { label: string; secret: string }[] {
  const multi = process.env.ADMIN_TOKENS?.trim();
  if (multi) {
    return multi
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf(":");
        if (separator === -1) return { label: "admin", secret: entry };
        return {
          label: entry.slice(0, separator).trim() || "admin",
          secret: entry.slice(separator + 1).trim(),
        };
      })
      .filter((token) => token.secret.length > 0);
  }

  const single = process.env.ADMIN_TOKEN?.trim();
  return single ? [{ label: "admin", secret: single }] : [];
}

export function adminConfigured(): boolean {
  return adminTokens().length > 0;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Returns the label of the matching token, or null.
 *
 * Compares SHA-256 digests so both sides are always 32 bytes: the previous
 * version returned early on a length mismatch, which told an attacker how long
 * the secret was. Every configured token is checked even after a match, so the
 * time taken does not reveal which one it was.
 */
export function identifyToken(candidate: string): string | null {
  const tokens = adminTokens();
  if (tokens.length === 0) return null;

  const offered = digest(candidate);
  let matched: string | null = null;

  for (const token of tokens) {
    if (timingSafeEqual(offered, digest(token.secret))) matched ??= token.label;
  }

  return matched;
}

/** Optional second secret, required for destructive actions when it is set. */
export function stepUpConfigured(): boolean {
  return (process.env.ADMIN_STEP_UP_SECRET?.trim() ?? "").length > 0;
}

export function checkStepUp(candidate: string): boolean {
  const expected = process.env.ADMIN_STEP_UP_SECRET?.trim();
  if (!expected) return true; // not configured: nothing to satisfy
  return timingSafeEqual(digest(candidate), digest(expected));
}

// --- Sessions ----------------------------------------------------------------

export async function createAdminSession(
  label: string,
  ipHash: string | null,
): Promise<{ id: string; expiresAt: Date }> {
  const id = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_HOURS * 3_600_000);

  await execute(
    `INSERT INTO admin_sessions (id, token_label, ip_hash, created_at, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, label, ipHash, now, expiresAt],
  );

  return { id, expiresAt };
}

export async function resolveAdminSession(id: string): Promise<{ label: string } | null> {
  const row = await queryOne<{ token_label: string }>(
    `SELECT token_label FROM admin_sessions
      WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [id],
  );
  return row ? { label: row.token_label } : null;
}

export async function revokeAdminSession(id: string): Promise<void> {
  await execute(`UPDATE admin_sessions SET revoked_at = now() WHERE id = $1`, [id]);
}

// --- Login throttling --------------------------------------------------------

export type LoginGate =
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds: number };

export async function recordLoginAttempt(
  ipHash: string,
  label: string | null,
  succeeded: boolean,
): Promise<void> {
  await execute(
    `INSERT INTO admin_login_attempts (id, ip_hash, token_label, succeeded, attempted_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [randomUUID(), ipHash, label, succeeded, new Date()],
  );
}

/**
 * Locks a caller out after repeated failures.
 *
 * Counted from the most recent failures rather than a fixed window start, so an
 * attacker cannot wait out the boundary and resume at full speed. A success
 * clears the streak.
 */
export async function checkAdminLoginGate(ipHash: string): Promise<LoginGate> {
  const since = new Date(Date.now() - ADMIN_LOGIN_LIMITS.windowMinutes * 60_000);

  const recent = await query<{ succeeded: boolean; attempted_at: Date }>(
    `SELECT succeeded, attempted_at FROM admin_login_attempts
      WHERE ip_hash = $1 AND attempted_at > $2
      ORDER BY attempted_at DESC
      LIMIT 50`,
    [ipHash, since],
  );

  let failures = 0;
  let newestFailure: Date | null = null;
  for (const attempt of recent) {
    if (attempt.succeeded) break; // a success ends the streak
    failures++;
    newestFailure ??= attempt.attempted_at;
  }

  if (failures < ADMIN_LOGIN_LIMITS.maxFailures) return { ok: true };

  const unlocksAt = new Date(
    (newestFailure?.getTime() ?? Date.now()) + ADMIN_LOGIN_LIMITS.lockoutMinutes * 60_000,
  );
  const seconds = Math.ceil((unlocksAt.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return { ok: true };

  return {
    ok: false,
    retryAfterSeconds: seconds,
    message: `Too many failed attempts. Locked for ${Math.ceil(seconds / 60)} more minute(s).`,
  };
}

// --- Audit trail -------------------------------------------------------------

export type AdminAction = {
  actor: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
  ipHash?: string | null;
};

/** Appends to the audit trail. The table refuses UPDATE, DELETE and TRUNCATE. */
export async function recordAdminAction(entry: AdminAction): Promise<void> {
  await execute(
    `INSERT INTO admin_audit_log (id, actor, action, target_type, target_id, details, ip_hash, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      randomUUID(),
      entry.actor,
      entry.action,
      entry.targetType ?? null,
      entry.targetId ?? null,
      JSON.stringify(entry.details ?? {}),
      entry.ipHash ?? null,
      new Date(),
    ],
  );
}

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export async function listAdminAudit(limit = 50): Promise<AuditEntry[]> {
  const rows = await query<{
    id: string;
    actor: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    details: Record<string, unknown>;
    created_at: Date;
  }>(`SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1`, [limit]);

  return rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details: row.details,
    createdAt: row.created_at.toISOString(),
  }));
}

// --- Request authentication --------------------------------------------------

export type AdminIdentity = { ok: true; label: string } | { ok: false };

function cookieFrom(request: Request): string | null {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
      ?.slice(ADMIN_COOKIE.length + 1) ?? null
  );
}

/**
 * For route handlers. A session cookie identifies a logged-in operator; a raw
 * token header is still accepted so one secret can drive an external cron
 * caller, and that path is labelled distinctly in the audit trail.
 */
export async function authenticateAdmin(request: Request): Promise<AdminIdentity> {
  const cookie = cookieFrom(request);
  if (cookie) {
    const session = await resolveAdminSession(decodeURIComponent(cookie));
    if (session) return { ok: true, label: session.label };
  }

  const header =
    request.headers.get("x-admin-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  if (header) {
    const identity = clientIp(request);
    const ipHash = identity.ok ? hashIp(identity.ip) : "unknown";

    // The header path is a login too: unlimited guesses here would make the
    // lockout on the form pointless.
    const gate = await checkAdminLoginGate(ipHash);
    if (!gate.ok) return { ok: false };

    const label = identifyToken(header);
    await recordLoginAttempt(ipHash, label, label !== null);
    if (label) return { ok: true, label: `${label} (token)` };
  }

  return { ok: false };
}

/** For server components. */
export async function adminSessionLabel(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;
  if (!value) return null;
  const session = await resolveAdminSession(value);
  return session?.label ?? null;
}
