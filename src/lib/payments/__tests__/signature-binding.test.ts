import { beforeEach, describe, expect, it } from "vitest";
import type { NormalizedBid } from "../../validation";
import { USDC_MINT, paymentWallet } from "../config";
import { truncateAll } from "../../seed";
import {
  claimSignature,
  createPendingBid,
  listUnmatchedPayments,
  recordUnmatchedPayment,
  signatureWasConsumed,
} from "../pending";
import { verifyPayment, type SolanaTransaction } from "../solana";

/**
 * C-1 from AUDITORIA-SEGURIDAD.md: a transaction has to belong to the bid it
 * pays, and a signature is spent by being looked at.
 *
 * Together these stop an on-chain transfer being a bearer instrument. Before
 * them, any unspent transfer ever made to our wallet could be claimed by
 * whoever pasted its signature first — and unmatched payments deliberately left
 * their signatures unspent, so the wallet accumulated exactly that.
 */

const WALLET = "8vQ2mQ6xkYPfJ7BFhCGDVzWJ1uYTLDXQoK4Vn5wCq3Rt";
const OTHER_WALLET = "3nB8sQ1xkYPfJ7BFhCGDVzWJ1uYTLDXQoK4Vn5wCq3Rt";
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const SIG = "5".repeat(87);
const SIG_B = "4".repeat(87);

const MINUTE = 60_000;

/** A bid window: created 5 minutes ago, expiring 25 minutes from now. */
const CREATED_AT = Date.now() - 5 * MINUTE;
const EXPIRES_AT = CREATED_AT + 30 * MINUTE;
const AMOUNT = 100_004_100n; // $100.0041

function tx(atMs: number, amount = AMOUNT, owner = WALLET): SolanaTransaction {
  return {
    slot: 1,
    blockTime: Math.floor(atMs / 1000),
    meta: {
      err: null,
      preTokenBalances: [
        { owner, mint: USDC_MINT, uiTokenAmount: { amount: "0" } },
      ],
      postTokenBalances: [
        { owner, mint: USDC_MINT, uiTokenAmount: { amount: amount.toString() } },
      ],
    },
  };
}

function check(transaction: SolanaTransaction, signature = SIG) {
  return verifyPayment({
    signature,
    expectedBaseUnits: AMOUNT,
    wallet: WALLET,
    createdAtMs: CREATED_AT,
    expiresAtMs: EXPIRES_AT,
    fetchTransaction: async () => transaction,
  });
}

beforeEach(async () => {
  await truncateAll();
});

describe("a transaction must belong to the bid's own window", () => {
  it("accepts a transfer made during the bid", async () => {
    expect((await check(tx(CREATED_AT + MINUTE))).ok).toBe(true);
  });

  it("REJECTS a transfer made before the bid existed, even with the exact amount", async () => {
    // The whole attack in one line: an old transfer of the right amount, lifted
    // off the chain by someone who never sent it.
    const result = await check(tx(CREATED_AT - 10 * MINUTE));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("outside_bid_window");
  });

  it("rejects a transfer from long before, the realistic harvesting case", async () => {
    const monthsAgo = CREATED_AT - 90 * 24 * 60 * MINUTE;
    const result = await check(tx(monthsAgo));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("outside_bid_window");
  });

  it("rejects a transfer made after the bid expired", async () => {
    const result = await check(tx(EXPIRES_AT + 10 * MINUTE));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("outside_bid_window");
  });

  it("tolerates clock skew at both edges", async () => {
    // Our clock and the cluster's are not the same clock.
    expect((await check(tx(CREATED_AT - 60_000))).ok).toBe(true);
    expect((await check(tx(EXPIRES_AT + 60_000))).ok).toBe(true);
  });

  it("refuses to guess when the transaction has no block time", async () => {
    const withoutTime = tx(CREATED_AT + MINUTE);
    const result = await check({ ...withoutTime!, blockTime: null });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_block_time");
  });

  it("still rejects a transfer to somebody else, in window or not", async () => {
    const result = await check(tx(CREATED_AT + MINUTE, AMOUNT, OTHER_WALLET));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("wrong_destination");
  });

  it("still rejects the right amount at the wrong time to the wrong wallet", async () => {
    const result = await check(tx(CREATED_AT - MINUTE * 60, AMOUNT, OTHER_WALLET));
    expect(result.ok).toBe(false);
  });
});

describe("a signature is spent by being evaluated", () => {
  async function pending(amountUsd = 100) {
    const bid: NormalizedBid = {
      chainId: "solana",
      contract: BONK,
      contractKey: `solana:${BONK}`,
      launchpadUrl: "https://pump.fun/coin/x",
      launchpadHost: "pump.fun",
      launchpadVerified: true,
      amountUsd,
      strippedParams: [],
    };
    return await createPendingBid(bid);
  }

  it("cannot be presented twice, even when the amount matches perfectly", async () => {
    const first = await pending();
    const second = await pending();

    expect((await claimSignature(SIG, first.id, "applied")).ok).toBe(true);

    const replay = await claimSignature(SIG, second.id, "applied");
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.reason).toBe("signature_used");
  });

  it("burns the signature on a MISMATCH too, not only on success", async () => {
    // This is the change from decision #42. A mismatched transfer used to stay
    // claimable, which left real money on the pavement for the next passer-by.
    const bid = await pending();
    expect((await claimSignature(SIG, bid.id, "overpaid")).ok).toBe(true);
    expect(await signatureWasConsumed(SIG)).toBe(true);

    // A stranger cannot now spend it on their own bid.
    const attacker = await pending();
    expect((await claimSignature(SIG, attacker.id, "applied")).ok).toBe(false);
  });

  it("still files the unmatched payment for support after burning it", async () => {
    const bid = await pending();
    await claimSignature(SIG, bid.id, "overpaid");
    await recordUnmatchedPayment({
      signature: SIG,
      bidId: bid.id,
      receivedBaseUnits: 100_005_000n,
      expectedBaseUnits: AMOUNT,
      reason: "overpaid",
    });

    const open = await listUnmatchedPayments("open");
    expect(open).toHaveLength(1);
    expect(open[0].signature).toBe(SIG);
    // Recorded for a person to resolve, but no longer a race anyone can win.
    expect(await signatureWasConsumed(SIG)).toBe(true);
  });

  it("cannot be slipped past with surrounding whitespace", async () => {
    const first = await pending();
    const second = await pending();
    await claimSignature(SIG, first.id, "applied");
    expect((await claimSignature(`  ${SIG}  `, second.id, "applied")).ok).toBe(false);
  });

  it("leaves a different signature usable", async () => {
    const first = await pending();
    const second = await pending();
    await claimSignature(SIG, first.id, "applied");
    expect((await claimSignature(SIG_B, second.id, "applied")).ok).toBe(true);
  });

  it("reports an unseen signature as unconsumed", async () => {
    expect(await signatureWasConsumed(SIG)).toBe(false);
  });
});

describe("what is deliberately NOT burned", () => {
  it("leaves the signature intact when the chain could not be reached", async () => {
    // Burning here would let a flaky node destroy a real payment.
    const result = await verifyPayment({
      signature: SIG,
      expectedBaseUnits: AMOUNT,
      wallet: WALLET,
      createdAtMs: CREATED_AT,
      expiresAtMs: EXPIRES_AT,
      fetchTransaction: async () => {
        throw new Error("node down");
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("rpc_unavailable");
    // The route treats this as inconclusive and does not claim.
    expect(await signatureWasConsumed(SIG)).toBe(false);
  });

  it("leaves it intact when the transaction is not confirmed yet", async () => {
    const result = await check(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_confirmed");
    expect(await signatureWasConsumed(SIG)).toBe(false);
  });
});

describe("payments only ever count for the configured wallet", () => {
  /**
   * The receiving address comes from PAYMENT_WALLET and nowhere else — there is
   * no default in the code, so a misconfigured deploy refuses to take bids
   * rather than collecting to an address nobody controls.
   */
  it("reads the wallet from the environment, with no fallback", async () => {
    const configured = paymentWallet();
    expect(configured.ok).toBe(true);
    if (!configured.ok) return;
    expect(configured.wallet).toBe(process.env.PAYMENT_WALLET);
  });

  it("refuses to take bids when the wallet is unset", async () => {
    const original = process.env.PAYMENT_WALLET;
    delete process.env.PAYMENT_WALLET;
    try {
      const configured = paymentWallet();
      expect(configured.ok).toBe(false);
      if (configured.ok) return;
      expect(configured.message).toMatch(/PAYMENT_WALLET is unset/);
    } finally {
      process.env.PAYMENT_WALLET = original;
    }
  });

  it("rejects an identical payment made to any other address", async () => {
    const configured = paymentWallet();
    expect(configured.ok).toBe(true);
    if (!configured.ok) return;

    // Same mint, same exact amount, same moment — only the destination differs.
    const result = await verifyPayment({
      signature: SIG,
      expectedBaseUnits: AMOUNT,
      wallet: configured.wallet,
      createdAtMs: CREATED_AT,
      expiresAtMs: EXPIRES_AT,
      fetchTransaction: async () => tx(CREATED_AT + MINUTE, AMOUNT, OTHER_WALLET),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("wrong_destination");
  });

  it("accepts the same payment once it is addressed to the configured wallet", async () => {
    const configured = paymentWallet();
    if (!configured.ok) return;
    const result = await verifyPayment({
      signature: SIG,
      expectedBaseUnits: AMOUNT,
      wallet: configured.wallet,
      createdAtMs: CREATED_AT,
      expiresAtMs: EXPIRES_AT,
      fetchTransaction: async () => tx(CREATED_AT + MINUTE, AMOUNT, configured.wallet),
    });
    expect(result.ok).toBe(true);
  });
});
