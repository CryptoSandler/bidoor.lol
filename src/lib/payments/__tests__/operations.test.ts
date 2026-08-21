import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TokenMetadata } from "../../dexscreener";
import { listRanked, placeBid } from "../../store";
import type { NormalizedBid } from "../../validation";
import { USDC_MINT } from "../config";
import { db, resetDbForTests } from "../db";
import {
  createPendingBid,
  delistEntry,
  listAcceptedBids,
  listDelistings,
  listUnmatchedPayments,
  recordAcceptedBid,
  recordPayment,
  recordUnmatchedPayment,
  resolveUnmatchedPayment,
} from "../pending";
import { reconcileSettledPayments, type MetadataResolver } from "../reconcile";

const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const USDC_ADDR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIG = "5".repeat(87);

const metadata: TokenMetadata = {
  name: "Bonk",
  ticker: "BONK",
  links: {},
  fetchedAt: "2026-08-21T00:00:00.000Z",
};

function bidFor(contract: string, amountUsd: number): NormalizedBid {
  return {
    chainId: "solana",
    contract,
    contractKey: `solana:${contract}`,
    launchpadUrl: "https://pump.fun/coin/x",
    launchpadHost: "pump.fun",
    launchpadVerified: true,
    amountUsd,
    strippedParams: [],
  };
}

function resetAll() {
  resetDbForTests();
  delete (globalThis as { __board?: unknown }).__board;
}

beforeEach(resetAll);

describe("reconciling payments whose entry never landed", () => {
  /** Settles a payment the way the verify route does, but skips the board. */
  function settledButUnapplied(amountUsd: number, signature = SIG) {
    const pending = createPendingBid(bidFor(USDC_ADDR, amountUsd));
    // The payment is claimed; the DexScreener lookup that follows it failed, so
    // no accepted_bids row was ever written. This is the gap being repaired.
    recordPayment(pending.id, signature, pending.paymentBaseUnits);
    return pending;
  }

  const resolver: MetadataResolver = async () => metadata;

  it("applies a settled payment that never reached the board", async () => {
    const before = listRanked().length;
    const pending = settledButUnapplied(120);

    const outcome = await reconcileSettledPayments(resolver);

    expect(outcome.scanned).toBe(1);
    expect(outcome.applied).toHaveLength(1);
    expect(outcome.applied[0].bidId).toBe(pending.id);
    expect(listRanked()).toHaveLength(before + 1);
  });

  it("is idempotent: running it twice does not double anything", async () => {
    settledButUnapplied(120);

    const first = await reconcileSettledPayments(resolver);
    const boardAfterFirst = listRanked();
    const totalAfterFirst = boardAfterFirst.find((e) => e.contract === USDC_ADDR)!.totalUsd;

    const second = await reconcileSettledPayments(resolver);

    expect(first.applied).toHaveLength(1);
    expect(second.scanned).toBe(0);
    expect(second.applied).toHaveLength(0);
    expect(listRanked()).toHaveLength(boardAfterFirst.length);
    expect(listRanked().find((e) => e.contract === USDC_ADDR)!.totalUsd).toBe(totalAfterFirst);
    expect(listAcceptedBids()).toHaveLength(1);
  });

  it("does nothing when every payment is already applied", async () => {
    const pending = createPendingBid(bidFor(USDC_ADDR, 50));
    recordPayment(pending.id, SIG, pending.paymentBaseUnits);
    placeBid(bidFor(USDC_ADDR, 50), metadata);
    recordAcceptedBid(pending.id, bidFor(USDC_ADDR, 50), metadata);

    const outcome = await reconcileSettledPayments(resolver);
    expect(outcome.scanned).toBe(0);
    expect(listAcceptedBids()).toHaveLength(1);
  });

  it("leaves a still-unresolvable token alone so the next run retries it", async () => {
    settledButUnapplied(120);
    const failing: MetadataResolver = async () => null;

    const outcome = await reconcileSettledPayments(failing);
    expect(outcome.applied).toHaveLength(0);
    expect(outcome.failed).toHaveLength(1);
    expect(listAcceptedBids()).toHaveLength(0);

    // Once the source recovers, the same payment is picked up.
    const retry = await reconcileSettledPayments(resolver);
    expect(retry.applied).toHaveLength(1);
  });

  it("handles several orphans in one pass", async () => {
    settledButUnapplied(10, "5".repeat(87));
    settledButUnapplied(20, "4".repeat(87));
    settledButUnapplied(30, "3".repeat(87));

    const outcome = await reconcileSettledPayments(resolver);
    expect(outcome.applied).toHaveLength(3);
    expect((await reconcileSettledPayments(resolver)).applied).toHaveLength(0);
  });
});

describe("delisting", () => {
  it("removes the entry from the board without deleting the record", () => {
    const target = listRanked()[0];
    const before = listRanked().length;

    delistEntry(target.contractKey, "Confirmed rug");
    // Only the in-memory board is dropped: the delisting lives in the database
    // and must survive the rebuild, which is the whole point.
    delete (globalThis as { __board?: unknown }).__board;

    const after = listRanked();
    expect(after).toHaveLength(before - 1);
    expect(after.some((entry) => entry.contractKey === target.contractKey)).toBe(false);
  });

  it("keeps the delisting and its reason for the audit trail", () => {
    const target = listRanked()[0];
    delistEntry(target.contractKey, "Confirmed rug");

    const delistings = listDelistings();
    expect(delistings).toHaveLength(1);
    expect(delistings[0].reason).toBe("Confirmed rug");
    expect(delistings[0].contractKey).toBe(target.contractKey);
  });

  it("frees the rank: a relisting starts from zero, not from the old total", () => {
    // Pay for a token, then delist it.
    const pending = createPendingBid(bidFor(USDC_ADDR, 5000));
    recordPayment(pending.id, SIG, pending.paymentBaseUnits);
    placeBid(bidFor(USDC_ADDR, 5000), metadata);
    recordAcceptedBid(pending.id, bidFor(USDC_ADDR, 5000), metadata);

    expect(listRanked().find((e) => e.contract === USDC_ADDR)!.totalUsd).toBe(5000);

    delistEntry(`solana:${USDC_ADDR}`, "Rug");
    delete (globalThis as { __board?: unknown }).__board;
    expect(listRanked().some((e) => e.contract === USDC_ADDR)).toBe(false);

    // Relisting pays again — and the $5,000 does not come back.
    const relist = createPendingBid(bidFor(USDC_ADDR, 25));
    recordPayment(relist.id, "4".repeat(87), relist.paymentBaseUnits);
    placeBid(bidFor(USDC_ADDR, 25), metadata);
    recordAcceptedBid(relist.id, bidFor(USDC_ADDR, 25), metadata);

    delete (globalThis as { __board?: unknown }).__board;
    const relisted = listRanked().find((e) => e.contract === USDC_ADDR)!;
    expect(relisted.totalUsd).toBe(25);
  });

  it("does not refund: the payment record survives the delisting", () => {
    const pending = createPendingBid(bidFor(USDC_ADDR, 500));
    recordPayment(pending.id, SIG, pending.paymentBaseUnits);
    delistEntry(`solana:${USDC_ADDR}`, "Rug");

    const payments = db().prepare(`SELECT COUNT(*) AS c FROM payments`).get() as { c: number };
    expect(payments.c).toBe(1);
  });
});

describe("the unmatched payment queue", () => {
  function stray(received: bigint, expected: bigint, signature = SIG) {
    const pending = createPendingBid(bidFor(BONK, Number(expected / 1_000_000n)));
    recordUnmatchedPayment({
      signature,
      bidId: pending.id,
      receivedBaseUnits: received,
      expectedBaseUnits: expected,
      reason: "overpaid",
    });
    return pending;
  }

  it("files a stray payment as open, without consuming the signature", () => {
    stray(100_005_000n, 100_004_100n);

    const open = listUnmatchedPayments("open");
    expect(open).toHaveLength(1);
    expect(open[0].status).toBe("open");

    // The signature is still spendable, which is what makes a retry possible.
    const payments = db().prepare(`SELECT COUNT(*) AS c FROM payments`).get() as { c: number };
    expect(payments.c).toBe(0);
  });

  it("records only one row per signature however many times it is retried", () => {
    stray(100_005_000n, 100_004_100n);
    recordUnmatchedPayment({
      signature: SIG,
      bidId: null,
      receivedBaseUnits: 100_005_000n,
      expectedBaseUnits: 100_004_100n,
      reason: "overpaid",
    });
    expect(listUnmatchedPayments()).toHaveLength(1);
  });

  it("moves out of the open queue once resolved, and keeps the reason", () => {
    stray(100_005_000n, 100_004_100n);
    const payment = listUnmatchedPayments("open")[0];

    resolveUnmatchedPayment(payment.id, "discarded", "Sender unreachable after 30 days");

    expect(listUnmatchedPayments("open")).toHaveLength(0);
    const resolved = listUnmatchedPayments()[0];
    expect(resolved.status).toBe("discarded");
    expect(resolved.resolutionNote).toMatch(/unreachable/);
    expect(resolved.resolvedAt).toBeTruthy();
  });

  it("still cannot spend one signature on two bids, even via the operator path", () => {
    const first = stray(100_004_100n, 100_004_100n);
    const second = createPendingBid(bidFor(BONK, 100));

    expect(recordPayment(first.id, SIG, 100_004_100n).ok).toBe(true);
    expect(recordPayment(second.id, SIG, 100_004_100n).ok).toBe(false);
  });
});

describe("RPC resilience", () => {
  it("retries across endpoints before giving up", async () => {
    vi.stubEnv("SOLANA_RPC_URL", "https://first.example, https://second.example");
    const seen: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      seen.push(url);
      throw new Error("node down");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { verifyPayment } = await import("../solana");
    const result = await verifyPayment({
      signature: SIG,
      expectedBaseUnits: 100_000_000n,
      wallet: "8vQ2mQ6xkYPfJ7BFhCGDVzWJ1uYTLDXQoK4Vn5wCq3Rt",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("rpc_unavailable");
    // More than one attempt, and both configured endpoints were tried.
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(2);

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }, 20_000);
});

describe("USDC mint is not configurable", () => {
  it("is the real mainnet mint", () => {
    // Anyone can deploy a token called USDC; only this one counts.
    expect(USDC_MINT).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  });
});
