import { beforeEach, describe, expect, it, vi } from "vitest";
import { query } from "../db";
import { RateLimitSaltMissing, ipHashRetentionDays, rateLimitSalt } from "../payments/config";
import { hashIp } from "../payments/limits";
import { createPendingBid, recordVerificationAttempt } from "../payments/pending";
import { createAdminSession, recordLoginAttempt } from "../admin";
import { purgeExpiredIdentifiers } from "../retention";
import { truncateAll } from "../seed";
import { requiredConfigProblems } from "../startup-check";
import type { NormalizedBid } from "../validation";

const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const IP = hashIp("203.0.113.7");

function bidFor(amountUsd: number): NormalizedBid {
  return {
    chainId: "solana",
    contract: BONK,
    contractKey: `solana:${BONK}`,
    launchpadUrl: "https://pump.fun/coin/x",
    launchpadHost: "pump.fun",
    launchpadVerified: true,
    amountUsd,
    strippedParams: [],
  };
}

/** Pushes every identifier-bearing row past the retention window. */
async function ageEverything(days: number) {
  const past = new Date(Date.now() - (days + 1) * 86_400_000);
  await query(`UPDATE pending_bids SET created_at = $1`, [past]);
  await query(`UPDATE admin_login_attempts SET attempted_at = $1`, [past]);
  await query(`UPDATE admin_sessions SET created_at = $1`, [past]);
  await query(`UPDATE verification_attempts SET attempted_at = $1`, [past]);
}

beforeEach(async () => {
  // Unstub first: a test that stubbed NODE_ENV=production would otherwise leave
  // it set, and truncateAll refuses to run under it — correctly.
  vi.unstubAllEnvs();
  await truncateAll();
});

describe("the salt fails closed in production", () => {
  it("throws when unset in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_SALT", "");
    expect(() => rateLimitSalt()).toThrow(RateLimitSaltMissing);
  });

  it("falls back to a fixed value outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RATE_LIMIT_SALT", "");
    expect(rateLimitSalt()).toBe("development-only-salt");
  });

  it("uses the configured value when set", async () => {
    vi.stubEnv("RATE_LIMIT_SALT", "a-real-salt");
    expect(rateLimitSalt()).toBe("a-real-salt");
  });

  it("is named in the startup check, with what breaks without it", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_SALT", "");
    const problems = requiredConfigProblems();
    const salt = problems.find((p) => p.variable === "RATE_LIMIT_SALT");
    expect(salt).toBeDefined();
    expect(salt!.consequence).toMatch(/reversible|brute force/i);
  });
});

describe("caller identifiers expire", () => {
  it("defaults to thirty days", async () => {
    expect(ipHashRetentionDays()).toBe(30);
  });

  it("drops the identifier but keeps the row", async () => {
    const bid = await createPendingBid(bidFor(50), IP);
    await ageEverything(ipHashRetentionDays());

    const outcome = await purgeExpiredIdentifiers();
    expect(outcome.pendingBids).toBe(1);

    const rows = await query<{ id: string; ip_hash: string | null; amount_usd: number }>(
      `SELECT id, ip_hash, amount_usd FROM pending_bids WHERE id = $1`,
      [bid.id],
    );
    // The payment record survives; only the thing that ties it to a visitor goes.
    expect(rows).toHaveLength(1);
    expect(rows[0].amount_usd).toBe(50);
    expect(rows[0].ip_hash).toBeNull();
  });

  it("leaves identifiers inside the window alone", async () => {
    const bid = await createPendingBid(bidFor(50), IP);

    const outcome = await purgeExpiredIdentifiers();
    expect(outcome.pendingBids).toBe(0);

    const rows = await query<{ ip_hash: string | null }>(
      `SELECT ip_hash FROM pending_bids WHERE id = $1`,
      [bid.id],
    );
    expect(rows[0].ip_hash).toBe(IP);
  });

  it("clears admin login attempts without losing the attempt itself", async () => {
    await recordLoginAttempt(IP, null, false);
    await ageEverything(ipHashRetentionDays());

    const outcome = await purgeExpiredIdentifiers();
    expect(outcome.loginAttempts).toBe(1);

    const rows = await query<{ ip_hash: string; succeeded: boolean }>(
      `SELECT ip_hash, succeeded FROM admin_login_attempts`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ip_hash).toBe("");
    expect(rows[0].succeeded).toBe(false);
  });

  it("clears the identifier on old admin sessions", async () => {
    await createAdminSession("alice", IP);
    await ageEverything(ipHashRetentionDays());

    await purgeExpiredIdentifiers();
    const rows = await query<{ ip_hash: string | null }>(`SELECT ip_hash FROM admin_sessions`);
    for (const row of rows) expect(row.ip_hash).toBeNull();
  });

  it("deletes stale verification counters outright", async () => {
    await recordVerificationAttempt("bid-1", IP);
    await ageEverything(ipHashRetentionDays());

    const outcome = await purgeExpiredIdentifiers();
    expect(outcome.verificationAttempts).toBe(1);
    expect(await query(`SELECT id FROM verification_attempts`)).toHaveLength(0);
  });

  it("honours a configured retention window", async () => {
    vi.stubEnv("IP_HASH_RETENTION_DAYS", "7");
    expect(ipHashRetentionDays()).toBe(7);

    await createPendingBid(bidFor(50), IP);
    await ageEverything(7);

    expect((await purgeExpiredIdentifiers()).pendingBids).toBe(1);
  });

  it("is safe to run repeatedly", async () => {
    await createPendingBid(bidFor(50), IP);
    await ageEverything(ipHashRetentionDays());

    expect((await purgeExpiredIdentifiers()).pendingBids).toBe(1);
    expect((await purgeExpiredIdentifiers()).pendingBids).toBe(0);
  });
});
