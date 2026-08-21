import { beforeEach, describe, expect, it } from "vitest";
import type { TokenMetadata } from "../../dexscreener";
import { listRanked, placeBid } from "../../store";
import type { NormalizedBid } from "../../validation";
import { USDC_MINT } from "../config";
import { resetDbForTests } from "../db";
import {
  createPendingBid,
  getPendingBid,
  listAcceptedBids,
  recordAcceptedBid,
  recordPayment,
} from "../pending";
import { verifyPayment, type SolanaTransaction } from "../solana";

const WALLET = "8vQ2mQ6xkYPfJ7BFhCGDVzWJ1uYTLDXQoK4Vn5wCq3Rt";
const SIG = "5".repeat(87);
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

const metadata: TokenMetadata = {
  name: "Bonk",
  ticker: "BONK",
  links: {},
  fetchedAt: "2026-08-21T00:00:00.000Z",
};

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

function paidTx(baseUnits: string): SolanaTransaction {
  return {
    slot: 1,
    meta: {
      err: null,
      preTokenBalances: [
        { owner: WALLET, mint: USDC_MINT, uiTokenAmount: { amount: "0" } },
      ],
      postTokenBalances: [
        { owner: WALLET, mint: USDC_MINT, uiTokenAmount: { amount: baseUnits } },
      ],
    },
  };
}

/**
 * Walks the exact sequence the verify route performs. `pay` decides what the
 * transaction actually transferred, given the exact amount the bid asked for.
 */
async function settle(
  amountUsd: number,
  pay: (exact: bigint) => bigint = (exact) => exact,
  signature = SIG,
) {
  const pending = createPendingBid(bidFor(amountUsd));

  const verified = await verifyPayment({
    signature,
    expectedBaseUnits: pending.paymentBaseUnits,
    wallet: WALLET,
    fetchTransaction: async () => paidTx(pay(pending.paymentBaseUnits).toString()),
  });
  if (!verified.ok) return { pending, applied: false as const, verified };

  const claimed = recordPayment(pending.id, signature, verified.amountBaseUnits);
  if (!claimed.ok) return { pending, applied: false as const, claimed };

  const outcome = placeBid(bidFor(amountUsd), metadata);
  recordAcceptedBid(pending.id, bidFor(amountUsd), metadata);
  return { pending, applied: true as const, outcome };
}

describe("settling a verified payment", () => {
  beforeEach(() => {
    resetDbForTests();
    delete (globalThis as { __board?: unknown }).__board;
  });

  it("puts the bid on the board and marks it paid", async () => {
    const before = listRanked().find((entry) => entry.contract === BONK)!;

    const result = await settle(250);
    expect(result.applied).toBe(true);
    if (!result.applied) return;

    expect(result.outcome.totalUsd).toBe(before.totalUsd + 250);
    expect(getPendingBid(result.pending.id)?.status).toBe("paid");
  });

  it("does not touch the board when the payment is short", async () => {
    const before = listRanked().find((entry) => entry.contract === BONK)!;

    // The bid asked for its exact unique amount; $100 arrived instead.
    const result = await settle(250, () => 100_000_000n);
    expect(result.applied).toBe(false);

    const after = listRanked().find((entry) => entry.contract === BONK)!;
    expect(after.totalUsd).toBe(before.totalUsd);
  });

  it("records the paid bid so it survives a restart", async () => {
    await settle(250);

    const accepted = listAcceptedBids();
    expect(accepted).toHaveLength(1);
    expect(accepted[0].bid.amountUsd).toBe(250);
    expect(accepted[0].metadata.name).toBe("Bonk");

    // Rebuilding the in-memory board replays it on top of the seed.
    const seeded = listRanked().find((entry) => entry.contract === BONK)!.totalUsd;
    delete (globalThis as { __board?: unknown }).__board;
    const rebuilt = listRanked().find((entry) => entry.contract === BONK)!.totalUsd;
    expect(rebuilt).toBe(seeded);
  });

  it("cannot settle two bids with one signature", async () => {
    const first = await settle(250);
    expect(first.applied).toBe(true);

    const boardBefore = listRanked().find((entry) => entry.contract === BONK)!.totalUsd;

    // Same signature, second bid: the constraint stops it before the board moves.
    const second = await settle(250);
    expect(second.applied).toBe(false);

    const boardAfter = listRanked().find((entry) => entry.contract === BONK)!.totalUsd;
    expect(boardAfter).toBe(boardBefore);
    expect(listAcceptedBids()).toHaveLength(1);
  });
});
