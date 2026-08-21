import { beforeEach, describe, expect, it } from "vitest";
import type { TokenMetadata } from "../../dexscreener";
import { listRanked, placeBid } from "../../store";
import type { NormalizedBid } from "../../validation";
import { VERIFY_LIMITS } from "../config";
import { query } from "../../db";
import { loadDemoSeed, truncateAll } from "../../seed";
import { checkVerificationLimits, hashIp } from "../limits";
import { createPendingBid, recordPayment, recordVerificationAttempt } from "../pending";

const USDC_ADDR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const IP = hashIp("203.0.113.7");
const OTHER_IP = hashIp("198.51.100.9");

function meta(overrides: Partial<TokenMetadata> = {}): TokenMetadata {
  return {
    name: "Token",
    ticker: "TKN",
    links: {},
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function bidFor(contract: string, amountUsd: number, launchpadUrl: string | null): NormalizedBid {
  return {
    chainId: "solana",
    contract,
    contractKey: `solana:${contract}`,
    launchpadUrl,
    launchpadHost: launchpadUrl ? new URL(launchpadUrl).hostname : null,
    launchpadVerified: launchpadUrl?.includes("pump.fun") ?? false,
    amountUsd,
    strippedParams: [],
  };
}

async function reset() {
  await truncateAll();
  await loadDemoSeed();
}

beforeEach(reset);

/**
 * A-1: the click destination is fixed when the entry is created.
 *
 * The fallback source is the token's website on DexScreener, which the token's
 * own deployer edits. Recomputing it on every top-up would let a listing that
 * looked clean be repointed at a drainer afterwards — the same mutable
 * destination problem that gets URL shorteners rejected.
 */
describe("the click destination is frozen at creation", () => {
  it("uses the launch link when one was given", async () => {
    const outcome = await placeBid(
      bidFor(USDC_ADDR, 10, "https://pump.fun/coin/first"),
      meta({ links: { website: "https://example.com" } }),
    );
    expect(outcome.entry.clickUrl).toBe("https://pump.fun/coin/first");
  });

  it("falls back to the website only at creation time", async () => {
    const outcome = await placeBid(
      bidFor(USDC_ADDR, 10, null),
      meta({ links: { website: "https://honest-project.example" } }),
    );
    expect(outcome.entry.clickUrl).toBe("https://honest-project.example");
  });

  it("a top-up cannot repoint the destination, even when DexScreener changed", async () => {
    await placeBid(
      bidFor(USDC_ADDR, 10, null),
      meta({ links: { website: "https://honest-project.example" } }),
    );

    // The deployer swaps the website on DexScreener for a drainer, then pays $1
    // to force a refresh.
    const after = await placeBid(
      bidFor(USDC_ADDR, 1, null),
      meta({ links: { website: "https://wallet-drainer.example" } }),
    );

    expect(after.toppedUp).toBe(true);
    expect(after.entry.clickUrl).toBe("https://honest-project.example");
    // The displayed link list does refresh — only where a click GOES is frozen.
    expect(after.entry.links.website).toBe("https://wallet-drainer.example");
  });

  it("a top-up cannot repoint it when the entry had a launch link either", async () => {
    await placeBid(bidFor(USDC_ADDR, 10, "https://pump.fun/coin/original"), meta());
    const after = await placeBid(
      bidFor(USDC_ADDR, 1, "https://pump.fun/coin/attacker"),
      meta({ links: { website: "https://wallet-drainer.example" } }),
    );
    expect(after.entry.clickUrl).toBe("https://pump.fun/coin/original");
  });

  it("an entry created with nowhere to point never adopts a website later", async () => {
    // No launch link and no website at creation: the row stays unclickable
    // rather than becoming a link once the deployer adds one.
    const created = await placeBid(bidFor(USDC_ADDR, 10, null), meta({ links: {} }));
    expect(created.entry.clickUrl).toBeNull();

    const after = await placeBid(
      bidFor(USDC_ADDR, 1, null),
      meta({ links: { website: "https://appeared-later.example" } }),
    );
    expect(after.entry.clickUrl).toBeNull();
  });

  it("seeded entries get a destination too", async () => {
    for (const entry of await listRanked()) {
      if (entry.launchpadUrl) expect(entry.clickUrl).toBe(entry.launchpadUrl);
    }
  });
});

/**
 * A-4: verification was unlimited, so a single bid id could drive unbounded RPC
 * calls and drain the node quota — taking down the only path that collects money.
 */
describe("verification is rate limited", () => {
  /**
   * Records attempts and ages them past the minimum-interval check, so the
   * assertion is about the count rather than the gap between two clicks.
   */
  async function attempts(bidId: string, ipHash: string, count: number) {
    for (let i = 0; i < count; i++) await recordVerificationAttempt(bidId, ipHash);
    query(`UPDATE verification_attempts SET attempted_at = $1 WHERE bid_id = $2`, [new Date(Date.now() - 10_000).toISOString(), bidId]);
  }

  it("caps attempts against a single bid", async () => {
    await attempts("bid-a", IP, VERIFY_LIMITS.perBid);

    const decision = await checkVerificationLimits("bid-a", IP);
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toBe("too_many_for_bid");
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("caps attempts from one caller across different bids", async () => {
    // Creating more bids must not buy more RPC calls.
    for (let i = 0; i < VERIFY_LIMITS.perIp; i++) await recordVerificationAttempt(`bid-${i}`, IP);
    query(`UPDATE verification_attempts SET attempted_at = $1`, [new Date(Date.now() - 10_000).toISOString()]);

    const decision = await checkVerificationLimits("bid-fresh", IP);
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toBe("too_many_for_ip");
  });

  it("enforces a minimum gap between attempts on one bid", async () => {
    await recordVerificationAttempt("bid-b", IP);
    const decision = await checkVerificationLimits("bid-b", IP);
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toBe("too_fast");
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(VERIFY_LIMITS.minIntervalSeconds);
  });

  it("does not let one caller's attempts block another", async () => {
    await attempts("bid-c", IP, VERIFY_LIMITS.perBid);
    expect((await checkVerificationLimits("bid-c", IP)).ok).toBe(false);
    expect((await checkVerificationLimits("bid-d", OTHER_IP)).ok).toBe(true);
  });

  it("allows a first attempt on a fresh bid", async () => {
    expect((await checkVerificationLimits("brand-new", IP)).ok).toBe(true);
  });
});

/**
 * M-5: the status check in the verify route is a check-then-act and loses to a
 * concurrent request. The constraint does not.
 */
describe("one bid can only ever have one payment applied", () => {
  async function pending(amountUsd = 100) {
    return await createPendingBid(bidFor(BONK, amountUsd, "https://pump.fun/coin/x"));
  }

  it("refuses a second payment on the same bid, with a different signature", async () => {
    const bid = await pending();
    expect((await recordPayment(bid.id, "5".repeat(87), 100_000_000n)).ok).toBe(true);

    const second = await recordPayment(bid.id, "4".repeat(87), 100_000_000n);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe("bid_already_paid");
  });

  it("still distinguishes a reused signature from a double-paid bid", async () => {
    const first = await pending();
    const second = await pending();
    await recordPayment(first.id, "5".repeat(87), 100_000_000n);

    const reuse = await recordPayment(second.id, "5".repeat(87), 100_000_000n);
    expect(reuse.ok).toBe(false);
    if (reuse.ok) return;
    expect(reuse.reason).toBe("signature_used");
  });

  it("lets two different bids each take their own payment", async () => {
    const first = await pending();
    const second = await pending();
    expect((await recordPayment(first.id, "5".repeat(87), 100_000_000n)).ok).toBe(true);
    expect((await recordPayment(second.id, "4".repeat(87), 100_000_000n)).ok).toBe(true);
  });
});
