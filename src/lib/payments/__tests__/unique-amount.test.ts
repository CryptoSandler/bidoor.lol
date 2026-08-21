import { beforeEach, describe, expect, it } from "vitest";
import type { NormalizedBid } from "../../validation";
import { FRACTION_MAX, FRACTION_MIN, USDC_DECIMALS } from "../config";
import { db, resetDbForTests } from "../db";
import {
  createPendingBid,
  expireStalePendingBids,
  getPendingBid,
  recordPayment,
} from "../pending";
import { formatUsdc } from "../solana";

const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

function bidFor(amountUsd: number): NormalizedBid {
  return {
    chainId: "solana",
    contract: BONK,
    contractKey: `solana:${BONK}`,
    launchpadUrl: "https://pump.fun/coin/bonk",
    launchpadHost: "pump.fun",
    amountUsd,
    strippedParams: [],
  };
}

/** The fraction, in ten-thousandths of a dollar, that a bid was given. */
function fractionOf(paymentBaseUnits: bigint, amountUsd: number): number {
  return Number(paymentBaseUnits - BigInt(amountUsd) * 10n ** BigInt(USDC_DECIMALS)) / 100;
}

function expire(id: string) {
  db()
    .prepare("UPDATE pending_bids SET expires_at = ? WHERE id = ?")
    .run(new Date(Date.now() - 1000).toISOString(), id);
}

beforeEach(() => resetDbForTests());

describe("every pending bid gets its own amount", () => {
  it("adds a non-zero four-decimal fraction to the bid", () => {
    const bid = createPendingBid(bidFor(50));
    const fraction = fractionOf(bid.paymentBaseUnits, 50);

    expect(Number.isInteger(fraction)).toBe(true);
    expect(fraction).toBeGreaterThanOrEqual(FRACTION_MIN);
    expect(fraction).toBeLessThanOrEqual(FRACTION_MAX);
    // A round amount is exactly the one that cannot be attributed.
    expect(fraction).not.toBe(0);
  });

  it("renders as a short, re-typeable amount", () => {
    const bid = createPendingBid(bidFor(50));
    expect(formatUsdc(bid.paymentBaseUnits)).toMatch(/^50\.\d{1,4}$/);
  });

  it("keeps the bid amount itself round, because ranking uses that", () => {
    const bid = createPendingBid(bidFor(50));
    expect(bid.amountUsd).toBe(50);
    expect(bid.paymentBaseUnits).toBeGreaterThan(50_000_000n);
    expect(bid.paymentBaseUnits).toBeLessThan(51_000_000n);
  });
});

describe("two pending bids can never ask for the same amount", () => {
  it("gives two simultaneous bids of the same base amount different fractions", () => {
    const first = createPendingBid(bidFor(50));
    const second = createPendingBid(bidFor(50));

    expect(first.amountUsd).toBe(second.amountUsd);
    expect(first.paymentBaseUnits).not.toBe(second.paymentBaseUnits);
  });

  it("keeps every amount distinct across many concurrent bids", () => {
    const amounts = new Set<string>();
    for (let i = 0; i < 60; i++) {
      amounts.add(createPendingBid(bidFor(50)).paymentBaseUnits.toString());
    }
    expect(amounts.size).toBe(60);
  });

  it("lets different base amounts share a fraction, which is not a collision", () => {
    // $50.0041 and $100.0041 are different totals, so both are attributable.
    const fifty = createPendingBid(bidFor(50));
    const hundred = createPendingBid(bidFor(100));
    expect(fifty.paymentBaseUnits).not.toBe(hundred.paymentBaseUnits);
  });

  it("is the database enforcing it, not a lookup in application code", () => {
    const existing = createPendingBid(bidFor(50));

    // Forcing a duplicate amount straight into the table must be impossible.
    expect(() =>
      db()
        .prepare(
          `INSERT INTO pending_bids
             (id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
              amount_usd, payment_micros, status, created_at, expires_at)
           VALUES ('forced', 'solana', ?, ?, 'https://pump.fun/coin/x', 'pump.fun',
                   50, ?, 'pending', ?, ?)`,
        )
        .run(
          BONK,
          `solana:${BONK}`,
          Number(existing.paymentBaseUnits),
          new Date().toISOString(),
          new Date(Date.now() + 600_000).toISOString(),
        ),
    ).toThrow(/UNIQUE/i);
  });
});

describe("an amount is only reserved while the bid is live", () => {
  it("frees the fraction when the bid expires", () => {
    const first = createPendingBid(bidFor(50));
    const amount = first.paymentBaseUnits;

    expire(first.id);
    expect(expireStalePendingBids()).toBeGreaterThan(0);
    expect(getPendingBid(first.id)?.status).toBe("expired");

    // The freed amount can now be handed to a new bid.
    db()
      .prepare(
        `INSERT INTO pending_bids
           (id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
            amount_usd, payment_micros, status, created_at, expires_at)
         VALUES ('reused', 'solana', ?, ?, 'https://pump.fun/coin/x', 'pump.fun',
                 50, ?, 'pending', ?, ?)`,
      )
      .run(
        BONK,
        `solana:${BONK}`,
        Number(amount),
        new Date().toISOString(),
        new Date(Date.now() + 600_000).toISOString(),
      );

    expect(getPendingBid("reused")?.paymentBaseUnits).toBe(amount);
  });

  it("sweeps stale bids before allocating, so abandoned ones stop holding amounts", () => {
    const stale = createPendingBid(bidFor(50));
    expire(stale.id);

    createPendingBid(bidFor(50));

    expect(getPendingBid(stale.id)?.status).toBe("expired");
  });

  it("frees the amount once the bid is paid", () => {
    const bid = createPendingBid(bidFor(50));
    recordPayment(bid.id, "5".repeat(87), bid.paymentBaseUnits);
    expect(getPendingBid(bid.id)?.status).toBe("paid");

    const held = db()
      .prepare(`SELECT COUNT(*) AS c FROM pending_bids WHERE status = 'pending' AND payment_micros = ?`)
      .get(Number(bid.paymentBaseUnits)) as { c: number };
    expect(held.c).toBe(0);
  });
});
