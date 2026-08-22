import { beforeEach, describe, expect, it } from "vitest";
import type { NormalizedBid } from "../../validation";
import { FRACTION_MAX, FRACTION_MIN, USDC_DECIMALS } from "../config";
import { query } from "../../db";
import { truncateAll } from "../../seed";
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
    launchpadVerified: true,
    amountUsd,
    strippedParams: [],
  };
}

/** The fraction, in micro-dollars, that a bid was given. */
function fractionOf(paymentBaseUnits: bigint, amountUsd: number): number {
  return Number(paymentBaseUnits - BigInt(amountUsd) * 10n ** BigInt(USDC_DECIMALS));
}

async function expire(id: string) {
  await query("UPDATE pending_bids SET expires_at = $1 WHERE id = $2", [
    new Date(Date.now() - 1000),
    id,
  ]);
}

beforeEach(async () => {
  await truncateAll();
});

describe("every pending bid gets its own amount", () => {
  it("adds a non-zero six-decimal fraction to the bid", async () => {
    const bid = await createPendingBid(bidFor(50));
    const fraction = fractionOf(bid.paymentBaseUnits, 50);

    expect(Number.isInteger(fraction)).toBe(true);
    expect(fraction).toBeGreaterThanOrEqual(FRACTION_MIN);
    expect(fraction).toBeLessThanOrEqual(FRACTION_MAX);
    // A round amount is exactly the one that cannot be attributed.
    expect(fraction).not.toBe(0);
  });

  it("renders as an exact amount inside the dollar", async () => {
    const bid = await createPendingBid(bidFor(50));
    expect(formatUsdc(bid.paymentBaseUnits)).toMatch(/^50\.\d{1,6}$/);
  });

  it("keeps the bid amount itself round, because ranking uses that", async () => {
    const bid = await createPendingBid(bidFor(50));
    expect(bid.amountUsd).toBe(50);
    expect(bid.paymentBaseUnits).toBeGreaterThan(50_000_000n);
    expect(bid.paymentBaseUnits).toBeLessThan(51_000_000n);
  });
});

describe("two pending bids can never ask for the same amount", () => {
  it("gives two simultaneous bids of the same base amount different fractions", async () => {
    const first = await createPendingBid(bidFor(50));
    const second = await createPendingBid(bidFor(50));

    expect(first.amountUsd).toBe(second.amountUsd);
    expect(first.paymentBaseUnits).not.toBe(second.paymentBaseUnits);
  });

  it("keeps every amount distinct across many concurrent bids", async () => {
    // Genuinely concurrent, which is what the name claims and what actually
    // exercises the unique index: sixty inserts racing, each redrawing its
    // fraction when the database rejects the one it picked.
    const bids = await Promise.all(
      Array.from({ length: 60 }, () => createPendingBid(bidFor(50))),
    );

    const amounts = new Set(bids.map((bid) => bid.paymentBaseUnits.toString()));
    expect(amounts.size).toBe(60);
  });

  it("lets different base amounts share a fraction, which is not a collision", async () => {
    // $50.0041 and $100.0041 are different totals, so both are attributable.
    const fifty = await createPendingBid(bidFor(50));
    const hundred = await createPendingBid(bidFor(100));
    expect(fifty.paymentBaseUnits).not.toBe(hundred.paymentBaseUnits);
  });

  it("is the database enforcing it, not a lookup in application code", async () => {
    const existing = await createPendingBid(bidFor(50));

    // Forcing a duplicate amount straight into the table must be impossible.
    await expect(
      query(`INSERT INTO pending_bids
             (id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
              amount_usd, payment_micros, status, created_at, expires_at)
           VALUES ('forced', 'solana', $1, $2, 'https://pump.fun/coin/x', 'pump.fun',
                   50, $3, 'pending', $4, $5)`,
        [
          BONK,
          `solana:${BONK}`,
          existing.paymentBaseUnits.toString(),
          new Date(),
          new Date(Date.now() + 600_000),
        ],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });
});

describe("an amount is only reserved while the bid is live", () => {
  it("frees the fraction when the bid expires", async () => {
    const first = await createPendingBid(bidFor(50));
    const amount = first.paymentBaseUnits;

    await expire(first.id);
    expect(await expireStalePendingBids()).toBeGreaterThan(0);
    expect((await getPendingBid(first.id))?.status).toBe("expired");

    // The freed amount can now be handed to a new bid.
    await query(`INSERT INTO pending_bids
           (id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
            amount_usd, payment_micros, status, created_at, expires_at)
         VALUES ('reused', 'solana', $1, $2, 'https://pump.fun/coin/x', 'pump.fun',
                 50, $3, 'pending', $4, $5)`,
      [BONK, `solana:${BONK}`, amount.toString(), new Date(), new Date(Date.now() + 600_000)],
    );

    expect((await getPendingBid("reused"))?.paymentBaseUnits).toBe(amount);
  });

  it("sweeps stale bids before allocating, so abandoned ones stop holding amounts", async () => {
    const stale = await createPendingBid(bidFor(50));
    await expire(stale.id);

    await createPendingBid(bidFor(50));

    expect((await getPendingBid(stale.id))?.status).toBe("expired");
  });

  it("frees the amount once the bid is paid", async () => {
    const bid = await createPendingBid(bidFor(50));
    await recordPayment(bid.id, "5".repeat(87), bid.paymentBaseUnits);
    expect((await getPendingBid(bid.id))?.status).toBe("paid");

    const held = await query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM pending_bids
        WHERE status = 'pending' AND payment_micros = $1`,
      [bid.paymentBaseUnits.toString()],
    );
    expect(Number(held[0].c)).toBe(0);
  });
});
