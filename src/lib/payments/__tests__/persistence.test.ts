import { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { closePool, query } from "../../db";
import { demoSeedEnabled, demoSeedSkipReason, loadDemoSeed, truncateAll } from "../../seed";
import { listRanked, placeBid } from "../../store";
import type { NormalizedBid } from "../../validation";
import { claimSignature, createPendingBid, recordPayment, signatureWasConsumed } from "../pending";

/**
 * The reason this project is on Postgres rather than a file on one machine.
 *
 * Every guarantee here is a UNIQUE constraint. On a file-per-instance database
 * those constraints are per instance: two app servers would each happily accept
 * the same transaction signature, and the anti-replay lock would be worth
 * nothing. These tests use a genuinely separate connection to stand in for a
 * second instance.
 */

const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const SIG = "5".repeat(87);

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

const metadata = {
  name: "Bonk",
  ticker: "BONK",
  links: {},
  fetchedAt: new Date().toISOString(),
};

/** A second, independent connection — a different instance for our purposes. */
async function otherInstance<T>(work: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}

beforeEach(async () => {
  await truncateAll();
});

describe("state survives a restart", () => {
  it("keeps a consumed signature after the pool is closed and reopened", async () => {
    const bid = await createPendingBid(bidFor(50));
    expect((await claimSignature(SIG, bid.id, "applied")).ok).toBe(true);
    expect(await signatureWasConsumed(SIG)).toBe(true);

    // Everything this process held in memory is gone.
    await closePool();

    expect(await signatureWasConsumed(SIG)).toBe(true);
  });

  it("keeps the board after the pool is closed and reopened", async () => {
    await placeBid(bidFor(750), metadata);
    const before = await listRanked();
    expect(before).toHaveLength(1);
    expect(before[0].totalUsd).toBe(750);

    await closePool();

    const after = await listRanked();
    expect(after).toHaveLength(1);
    expect(after[0].totalUsd).toBe(750);
    expect(after[0].contract).toBe(BONK);
  });

  it("keeps a settled payment after the pool is closed and reopened", async () => {
    const bid = await createPendingBid(bidFor(50));
    await recordPayment(bid.id, SIG, bid.paymentBaseUnits);

    await closePool();

    const rows = await query<{ signature: string }>(`SELECT signature FROM payments`);
    expect(rows).toHaveLength(1);
    expect(rows[0].signature).toBe(SIG);
  });
});

describe("the constraints are global, not per instance", () => {
  it("rejects from instance B a signature instance A already consumed", async () => {
    const bid = await createPendingBid(bidFor(50));
    expect((await claimSignature(SIG, bid.id, "applied")).ok).toBe(true);

    // Instance B has its own connection and its own memory. The only thing it
    // shares with A is the database, which is exactly the point.
    const rejected = await otherInstance(async (pool) => {
      try {
        await pool.query(
          `INSERT INTO consumed_signatures (signature, bid_id, outcome, consumed_at)
           VALUES ($1, $2, 'applied', now())`,
          [SIG, bid.id],
        );
        return false;
      } catch (error) {
        return (error as { code?: string }).code === "23505";
      }
    });

    expect(rejected).toBe(true);
  });

  it("rejects from instance B a second payment on a bid instance A already settled", async () => {
    const bid = await createPendingBid(bidFor(50));
    expect((await recordPayment(bid.id, SIG, bid.paymentBaseUnits)).ok).toBe(true);

    const rejected = await otherInstance(async (pool) => {
      try {
        await pool.query(
          `INSERT INTO payments (id, signature, bid_id, amount_base_units, verified_at)
           VALUES ('other-instance', $1, $2, '1', now())`,
          ["4".repeat(87), bid.id],
        );
        return false;
      } catch (error) {
        return (error as { code?: string }).code === "23505";
      }
    });

    expect(rejected).toBe(true);
  });

  it("rejects from instance B a pending amount instance A is already holding", async () => {
    const bid = await createPendingBid(bidFor(50));

    const rejected = await otherInstance(async (pool) => {
      try {
        await pool.query(
          `INSERT INTO pending_bids
             (id, chain_id, contract, contract_key, amount_usd, payment_micros,
              status, created_at, expires_at)
           VALUES ('other-instance', 'solana', $1, $2, 50, $3, 'pending', now(), now() + interval '30 minutes')`,
          [BONK, `solana:${BONK}`, bid.paymentBaseUnits.toString()],
        );
        return false;
      } catch (error) {
        return (error as { code?: string }).code === "23505";
      }
    });

    expect(rejected).toBe(true);
  });

  it("lets instance B see the board instance A wrote", async () => {
    await placeBid(bidFor(120), metadata);

    const seen = await otherInstance(async (pool) => {
      const result = await pool.query<{ contract: string; total: string }>(
        `SELECT e.contract, SUM(b.amount_usd)::text AS total
           FROM entries e JOIN entry_bids b ON b.entry_id = e.id
          WHERE e.delisted_at IS NULL
          GROUP BY e.contract`,
      );
      return result.rows;
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].contract).toBe(BONK);
    expect(Number(seen[0].total)).toBe(120);
  });
});

describe("the demo seed never loads in production", () => {
  it("refuses under NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(demoSeedEnabled()).toBe(false);
      const outcome = await loadDemoSeed();
      expect(outcome.loaded).toBe(false);
      expect(outcome.reason).toMatch(/disabled/i);
      expect(await listRanked()).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses even with the flag explicitly on, if NODE_ENV is production", async () => {
    // Two guards, and production wins: a demo row on a board that claims to
    // show what people paid is a lie about money.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOAD_DEMO_SEED", "true");
    try {
      expect(demoSeedEnabled()).toBe(false);
      expect((await loadDemoSeed()).loaded).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses when the flag is switched off", async () => {
    // vi.stubEnv restores the previous value rather than deleting the variable.
    // Deleting it here removed the suite's own LOAD_DEMO_SEED=force and left the
    // next test unable to seed.
    vi.stubEnv("LOAD_DEMO_SEED", "false");
    try {
      expect((await loadDemoSeed()).loaded).toBe(false);
      expect(await listRanked()).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses to seed a database that is not on this machine", async () => {
    // The hole that put the fixture into production: a dev process pointed at a
    // remote database. NODE_ENV describes the process; the database is what
    // matters.
    vi.stubEnv("LOAD_DEMO_SEED", "");
    vi.stubEnv("DATABASE_URL", "postgres://u:p@ep-something.neon.tech/neondb");
    try {
      expect(demoSeedEnabled()).toBe(false);
      expect(demoSeedSkipReason()).toMatch(/not point at a local database/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("allows a remote database only when forced", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://u:p@ep-something.neon.tech/neondb");
    vi.stubEnv("LOAD_DEMO_SEED", "force");
    try {
      expect(demoSeedEnabled()).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("loads for development and tests, and does not double-load", async () => {
    expect((await loadDemoSeed()).loaded).toBe(true);
    const size = (await listRanked()).length;
    expect(size).toBeGreaterThan(0);

    const again = await loadDemoSeed();
    expect(again.loaded).toBe(false);
    expect(again.reason).toMatch(/not empty/i);
    expect(await listRanked()).toHaveLength(size);
  });
});
