import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminConfigured,
  checkAdminLoginGate,
  checkStepUp,
  createAdminSession,
  identifyToken,
  listAdminAudit,
  recordAdminAction,
  recordLoginAttempt,
  resolveAdminSession,
  revokeAdminSession,
  stepUpConfigured,
} from "../admin";
import { query } from "../db";
import { ADMIN_LOGIN_LIMITS } from "../payments/config";
import { hashIp } from "../payments/limits";
import { truncateAll } from "../seed";

const IP = hashIp("203.0.113.7");
const OTHER_IP = hashIp("198.51.100.9");

beforeEach(async () => {
  vi.unstubAllEnvs();
  await truncateAll();
});

describe("token identification", () => {
  it("recognises the single-operator form", async () => {
    vi.stubEnv("ADMIN_TOKEN", "correct-horse-battery-staple");
    expect(adminConfigured()).toBe(true);
    expect(identifyToken("correct-horse-battery-staple")).toBe("admin");
    expect(identifyToken("wrong")).toBeNull();
  });

  it("names which operator acted when several tokens are configured", async () => {
    vi.stubEnv("ADMIN_TOKENS", "alice:alice-secret, bob:bob-secret");
    expect(identifyToken("alice-secret")).toBe("alice");
    expect(identifyToken("bob-secret")).toBe("bob");
    expect(identifyToken("carol-secret")).toBeNull();
  });

  it("reports nothing configured when no token is set", async () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    vi.stubEnv("ADMIN_TOKENS", "");
    expect(adminConfigured()).toBe(false);
    expect(identifyToken("anything")).toBeNull();
  });

  it("does not leak the secret's length through an early return", async () => {
    // The comparison is over SHA-256 digests, so both sides are always 32 bytes
    // and a wrong-length guess costs the same as a wrong-content one.
    vi.stubEnv("ADMIN_TOKEN", "a-fairly-long-admin-secret-value");
    expect(identifyToken("x")).toBeNull();
    expect(identifyToken("x".repeat(4096))).toBeNull();
    expect(identifyToken("a-fairly-long-admin-secret-valuX")).toBeNull();
  });
});

describe("login lockout", () => {
  it("allows attempts up to the limit", async () => {
    for (let i = 0; i < ADMIN_LOGIN_LIMITS.maxFailures - 1; i++) {
      expect((await checkAdminLoginGate(IP)).ok).toBe(true);
      await recordLoginAttempt(IP, null, false);
    }
    expect((await checkAdminLoginGate(IP)).ok).toBe(true);
  });

  it("locks out after enough failures, and says for how long", async () => {
    for (let i = 0; i < ADMIN_LOGIN_LIMITS.maxFailures; i++) {
      await recordLoginAttempt(IP, null, false);
    }

    const gate = await checkAdminLoginGate(IP);
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.message).toMatch(/Too many failed attempts/i);
    expect(gate.retryAfterSeconds).toBeGreaterThan(0);
    expect(gate.retryAfterSeconds).toBeLessThanOrEqual(ADMIN_LOGIN_LIMITS.lockoutMinutes * 60);
  });

  it("does not lock out a different caller", async () => {
    for (let i = 0; i < ADMIN_LOGIN_LIMITS.maxFailures; i++) {
      await recordLoginAttempt(IP, null, false);
    }
    expect((await checkAdminLoginGate(IP)).ok).toBe(false);
    expect((await checkAdminLoginGate(OTHER_IP)).ok).toBe(true);
  });

  it("clears the streak on a success", async () => {
    for (let i = 0; i < ADMIN_LOGIN_LIMITS.maxFailures - 1; i++) {
      await recordLoginAttempt(IP, null, false);
    }
    await recordLoginAttempt(IP, "admin", true);
    for (let i = 0; i < ADMIN_LOGIN_LIMITS.maxFailures - 1; i++) {
      await recordLoginAttempt(IP, null, false);
    }
    // Without the streak reset these would add up to a lockout.
    expect((await checkAdminLoginGate(IP)).ok).toBe(true);
  });

  it("releases the lockout once the window passes", async () => {
    for (let i = 0; i < ADMIN_LOGIN_LIMITS.maxFailures; i++) {
      await recordLoginAttempt(IP, null, false);
    }
    expect((await checkAdminLoginGate(IP)).ok).toBe(false);

    await query(
      `UPDATE admin_login_attempts SET attempted_at = $1 WHERE ip_hash = $2`,
      [new Date(Date.now() - (ADMIN_LOGIN_LIMITS.lockoutMinutes + 1) * 60_000), IP],
    );

    expect((await checkAdminLoginGate(IP)).ok).toBe(true);
  });
});

describe("sessions", () => {
  it("resolves a session to the operator who created it", async () => {
    const session = await createAdminSession("alice", IP);
    expect(await resolveAdminSession(session.id)).toEqual({ label: "alice" });
  });

  it("carries an expiry rather than living forever", async () => {
    const session = await createAdminSession("alice", IP);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

    await query(`UPDATE admin_sessions SET expires_at = $1 WHERE id = $2`, [
      new Date(Date.now() - 1000),
      session.id,
    ]);
    expect(await resolveAdminSession(session.id)).toBeNull();
  });

  it("can be revoked server-side, so a leaked cookie is not a rotation", async () => {
    const session = await createAdminSession("alice", IP);
    await revokeAdminSession(session.id);
    expect(await resolveAdminSession(session.id)).toBeNull();
  });

  it("never stores the token itself", async () => {
    vi.stubEnv("ADMIN_TOKEN", "the-master-secret");
    await createAdminSession("admin", IP);

    const rows = await query<{ id: string; token_label: string }>(
      `SELECT id, token_label FROM admin_sessions`,
    );
    expect(rows[0].token_label).toBe("admin");
    // The id is what goes in the cookie; it must not be the secret.
    expect(rows[0].id).not.toBe("the-master-secret");
    expect(rows[0].id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects an unknown session id", async () => {
    expect(await resolveAdminSession("nope")).toBeNull();
  });
});

describe("audit trail", () => {
  it("records who did what, to which target", async () => {
    await recordAdminAction({
      actor: "alice",
      action: "entry.delist",
      targetType: "entry",
      targetId: "solana:abc",
      details: { reason: "rug" },
      ipHash: IP,
    });

    const entries = await listAdminAudit();
    expect(entries).toHaveLength(1);
    expect(entries[0].actor).toBe("alice");
    expect(entries[0].action).toBe("entry.delist");
    expect(entries[0].targetId).toBe("solana:abc");
    expect(entries[0].details).toEqual({ reason: "rug" });
  });

  it("is append-only: the database refuses UPDATE", async () => {
    await recordAdminAction({ actor: "alice", action: "entry.delist" });
    await expect(
      query(`UPDATE admin_audit_log SET actor = 'somebody-else'`),
    ).rejects.toThrow(/append-only/i);
  });

  it("is append-only: the database refuses DELETE", async () => {
    await recordAdminAction({ actor: "alice", action: "entry.delist" });
    await expect(query(`DELETE FROM admin_audit_log`)).rejects.toThrow(/append-only/i);
  });

  it("is append-only: the database refuses TRUNCATE", async () => {
    await recordAdminAction({ actor: "alice", action: "entry.delist" });
    await expect(query(`TRUNCATE admin_audit_log`)).rejects.toThrow(/append-only/i);
  });

  it("survives an attempt to erase it", async () => {
    await recordAdminAction({ actor: "alice", action: "payment.apply", targetId: "bid-1" });
    await query(`DELETE FROM admin_audit_log`).catch(() => {});
    expect(await listAdminAudit()).toHaveLength(1);
  });

  it("returns newest first", async () => {
    await recordAdminAction({ actor: "alice", action: "first" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await recordAdminAction({ actor: "bob", action: "second" });

    const entries = await listAdminAudit();
    expect(entries[0].action).toBe("second");
    expect(entries[1].action).toBe("first");
  });
});

describe("step-up secret for destructive actions", () => {
  it("is optional: unset, nothing has to be satisfied", async () => {
    vi.stubEnv("ADMIN_STEP_UP_SECRET", "");
    expect(stepUpConfigured()).toBe(false);
    expect(checkStepUp("")).toBe(true);
  });

  it("is required once set", async () => {
    vi.stubEnv("ADMIN_STEP_UP_SECRET", "second-factor");
    expect(stepUpConfigured()).toBe(true);
    expect(checkStepUp("second-factor")).toBe(true);
    expect(checkStepUp("wrong")).toBe(false);
    expect(checkStepUp("")).toBe(false);
  });
});
