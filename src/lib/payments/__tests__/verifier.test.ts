import { beforeEach, describe, expect, it } from "vitest";
import { USDC_MINT } from "../config";
import { db, resetDbForTests } from "../db";
import { createPendingBid, getPendingBid, recordPayment } from "../pending";
import { verifyPayment, type SolanaTransaction } from "../solana";
import type { NormalizedBid } from "../../validation";

const WALLET = "8vQ2mQ6xkYPfJ7BFhCGDVzWJ1uYTLDXQoK4Vn5wCq3Rt";
const OTHER_WALLET = "3nB8sQ1xkYPfJ7BFhCGDVzWJ1uYTLDXQoK4Vn5wCq3Rt";
const OTHER_MINT = "So11111111111111111111111111111111111111112";

// 64 bytes of base58 — the shape of a real Solana signature.
const SIG = "5".repeat(87);
const SIG_B = "4".repeat(87);

/** Builds a transaction whose token balance deltas say what we want to test. */
function tx(options: {
  err?: unknown;
  owner?: string;
  mint?: string;
  before?: string;
  after?: string;
  noMeta?: boolean;
}): SolanaTransaction {
  const owner = options.owner ?? WALLET;
  const mint = options.mint ?? USDC_MINT;
  if (options.noMeta) return { slot: 1, meta: null };

  return {
    slot: 1,
    meta: {
      err: options.err ?? null,
      preTokenBalances: [
        { accountIndex: 1, owner, mint, uiTokenAmount: { amount: options.before ?? "0" } },
      ],
      postTokenBalances: [
        { accountIndex: 1, owner, mint, uiTokenAmount: { amount: options.after ?? "0" } },
      ],
    },
  };
}

async function check(transaction: SolanaTransaction, amountUsd = 100, signature = SIG) {
  return verifyPayment({
    signature,
    expectedAmountUsd: amountUsd,
    wallet: WALLET,
    fetchTransaction: async () => transaction,
  });
}

describe("a payment that is good", () => {
  it("accepts an exact-amount USDC transfer to our wallet", async () => {
    // 100 USDC = 100_000_000 base units at 6 decimals.
    const result = await check(tx({ after: "100000000" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.amountBaseUnits).toBe(100_000_000n);
  });

  it("accepts an overpayment", async () => {
    expect((await check(tx({ after: "250000000" }))).ok).toBe(true);
  });

  it("measures the delta, not the balance, so a funded wallet still works", async () => {
    const result = await check(tx({ before: "5000000000", after: "5100000000" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.amountBaseUnits).toBe(100_000_000n);
  });
});

describe("insufficient amount", () => {
  it("rejects a transfer smaller than the bid", async () => {
    const result = await check(tx({ after: "99000000" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("insufficient_amount");
    expect(result.message).toMatch(/99/);
  });

  it("rejects a transfer one base unit short", async () => {
    const result = await check(tx({ after: "99999999" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("insufficient_amount");
  });
});

describe("wrong token", () => {
  it("rejects a token that is not the official USDC mint", async () => {
    // Anyone can deploy a token called USDC; only this mint counts.
    const result = await check(tx({ mint: OTHER_MINT, after: "100000000" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("wrong_token");
    expect(result.message).toMatch(/USDC/);
  });
});

describe("wrong destination", () => {
  it("rejects USDC sent to somebody else", async () => {
    const result = await check(tx({ owner: OTHER_WALLET, after: "100000000" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("wrong_destination");
  });
});

describe("transaction state", () => {
  it("rejects a transaction that is not confirmed or does not exist", async () => {
    const result = await check(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_confirmed");
  });

  it("rejects a transaction with no confirmed result yet", async () => {
    const result = await check(tx({ noMeta: true }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_confirmed");
  });

  it("rejects a transaction that failed on-chain", async () => {
    const result = await check(tx({ err: { InstructionError: [0, "Custom"] }, after: "100000000" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("failed_tx");
  });

  it("rejects a malformed signature without calling the chain", async () => {
    let called = false;
    const result = await verifyPayment({
      signature: "not-a-signature",
      expectedAmountUsd: 100,
      wallet: WALLET,
      fetchTransaction: async () => {
        called = true;
        return null;
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_signature");
    expect(called).toBe(false);
  });

  it("reports an unreachable RPC separately from a bad payment", async () => {
    const result = await verifyPayment({
      signature: SIG,
      expectedAmountUsd: 100,
      wallet: WALLET,
      fetchTransaction: async () => {
        throw new Error("node down");
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("rpc_unavailable");
  });
});

function pendingBid(amountUsd = 100) {
  const bid: NormalizedBid = {
    chainId: "solana",
    contract: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    contractKey: "solana:DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    launchpadUrl: "https://pump.fun/coin/x",
    launchpadHost: "pump.fun",
    amountUsd,
    strippedParams: [],
  };
  return createPendingBid(bid);
}

describe("a signature can only be spent once", () => {
  beforeEach(() => resetDbForTests());

  it("accepts a signature the first time", () => {
    const bid = pendingBid();
    expect(recordPayment(bid.id, SIG, 100_000_000n).ok).toBe(true);
    expect(getPendingBid(bid.id)?.status).toBe("paid");
  });

  it("refuses to reuse the same signature on a second bid", () => {
    const first = pendingBid();
    const second = pendingBid();

    expect(recordPayment(first.id, SIG, 100_000_000n).ok).toBe(true);

    const replay = recordPayment(second.id, SIG, 100_000_000n);
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.reason).toBe("signature_used");
    // The second bid must not have been marked paid off the back of it.
    expect(getPendingBid(second.id)?.status).toBe("pending");
  });

  it("cannot be slipped past with surrounding whitespace", () => {
    const first = pendingBid();
    const second = pendingBid();
    recordPayment(first.id, SIG, 100_000_000n);
    expect(recordPayment(second.id, `  ${SIG}  `, 100_000_000n).ok).toBe(false);
  });

  it("is the database enforcing it, not application code", () => {
    const bid = pendingBid();
    recordPayment(bid.id, SIG, 100_000_000n);
    // Going around the helper entirely still fails: the constraint is on the table.
    expect(() =>
      db()
        .prepare(
          `INSERT INTO payments (id, signature, bid_id, amount_base_units, verified_at)
           VALUES ('forced', ?, ?, '1', '2026-01-01T00:00:00.000Z')`,
        )
        .run(SIG, bid.id),
    ).toThrow(/UNIQUE/i);
  });

  it("still allows a different signature", () => {
    const first = pendingBid();
    const second = pendingBid();
    recordPayment(first.id, SIG, 100_000_000n);
    expect(recordPayment(second.id, SIG_B, 100_000_000n).ok).toBe(true);
  });
});

describe("expiry", () => {
  beforeEach(() => resetDbForTests());

  it("expires a bid whose window has closed, with a visible reason", () => {
    const bid = pendingBid();
    expect(getPendingBid(bid.id)?.status).toBe("pending");

    // Wind the deadline back rather than waiting 30 minutes.
    db()
      .prepare("UPDATE pending_bids SET expires_at = ? WHERE id = ?")
      .run(new Date(Date.now() - 1000).toISOString(), bid.id);

    const expired = getPendingBid(bid.id);
    expect(expired?.status).toBe("expired");
    expect(expired?.failureReason).toMatch(/expired/i);
  });

  it("gives a fresh bid the full window", () => {
    const bid = pendingBid();
    const window = Date.parse(bid.expiresAt) - Date.parse(bid.createdAt);
    expect(window).toBe(30 * 60_000);
  });
});
