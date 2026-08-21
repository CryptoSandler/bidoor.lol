import { randomInt, randomUUID } from "node:crypto";
import { execute, isUniqueViolation, query, queryOne, violatedConstraint } from "../db";
import type { TokenMetadata } from "../dexscreener";
import type { NormalizedBid } from "../validation";
import { FRACTION_MAX, FRACTION_MIN, PAYMENT_WINDOW_MINUTES, paymentBaseUnits } from "./config";

export type PendingStatus = "pending" | "paid" | "expired" | "failed";

export type PendingBid = {
  id: string;
  chainId: string;
  contract: string;
  contractKey: string;
  launchpadUrl: string | null;
  launchpadHost: string | null;
  launchpadVerified: boolean;
  amountUsd: number;
  /**
   * The exact amount that must be transferred, in USDC base units. Differs from
   * amountUsd by a small unique fraction — that fraction is how an incoming
   * payment is attributed to this bid. Ranking still uses amountUsd.
   */
  paymentBaseUnits: bigint;
  status: PendingStatus;
  failureReason: string | null;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
};

type Row = {
  id: string;
  chain_id: string;
  contract: string;
  contract_key: string;
  launchpad_url: string | null;
  launchpad_host: string | null;
  launchpad_verified: boolean;
  amount_usd: number;
  payment_micros: string | null;
  status: string;
  failure_reason: string | null;
  created_at: Date;
  expires_at: Date;
  paid_at: Date | null;
};

function toBid(row: Row): PendingBid {
  return {
    id: row.id,
    chainId: row.chain_id,
    contract: row.contract,
    contractKey: row.contract_key,
    launchpadUrl: row.launchpad_url,
    launchpadHost: row.launchpad_host,
    launchpadVerified: row.launchpad_verified,
    amountUsd: row.amount_usd,
    // BIGINT comes back from pg as a string on purpose: the amount is in USDC
    // base units and has to stay exact.
    paymentBaseUnits: BigInt(row.payment_micros ?? row.amount_usd * 1_000_000),
    status: row.status as PendingStatus,
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
  };
}

/**
 * Moves every pending bid whose window has closed to 'expired'.
 *
 * Run before allocating a new payment amount: the uniqueness index only covers
 * 'pending' rows, so sweeping first is what releases the fractions held by bids
 * nobody ever paid.
 */
export async function expireStalePendingBids(): Promise<number> {
  return execute(
    `UPDATE pending_bids
        SET status = 'expired',
            failure_reason = 'This bid expired before a payment was confirmed.'
      WHERE status = 'pending' AND expires_at <= now()`,
  );
}

export class PaymentAmountUnavailable extends Error {
  constructor() {
    super("Could not allocate a unique payment amount. Try again in a moment.");
    this.name = "PaymentAmountUnavailable";
  }
}

/** How many fractions we try before giving up rather than looping forever. */
const FRACTION_ATTEMPTS = 40;

export async function createPendingBid(
  bid: NormalizedBid,
  ipHash: string | null = null,
): Promise<PendingBid> {
  await expireStalePendingBids();

  const id = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000);

  // The fraction is drawn at random and offered to the database. If another
  // pending bid already holds that exact amount the unique index rejects it and
  // we draw again — the database decides, so two bids created in the same
  // instant cannot both take it.
  for (let attempt = 0; attempt < FRACTION_ATTEMPTS; attempt++) {
    const fraction = randomInt(FRACTION_MIN, FRACTION_MAX + 1);
    try {
      await execute(
        `INSERT INTO pending_bids
           (id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
            launchpad_verified, amount_usd, ip_hash, payment_micros, status,
            created_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12)`,
        [
          id,
          bid.chainId,
          bid.contract,
          bid.contractKey,
          bid.launchpadUrl,
          bid.launchpadHost,
          bid.launchpadVerified,
          bid.amountUsd,
          ipHash,
          paymentBaseUnits(bid.amountUsd, fraction),
          now,
          expires,
        ],
      );
      return (await getPendingBid(id))!;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new PaymentAmountUnavailable();
}

/**
 * Reads a bid, expiring it on the way out if its window has closed. Expiry is
 * evaluated on read rather than by a background job: there is no scheduler here,
 * and a bid nobody looks at does not need to have expired yet.
 */
export async function getPendingBid(id: string): Promise<PendingBid | null> {
  const row = await queryOne<Row>(`SELECT * FROM pending_bids WHERE id = $1`, [id]);
  if (!row) return null;

  const bid = toBid(row);
  if (bid.status === "pending" && Date.parse(bid.expiresAt) <= Date.now()) {
    await markFailed(id, "expired", "This bid expired before a payment was confirmed.");
    return getPendingBid(id);
  }
  return bid;
}

export async function markFailed(
  id: string,
  status: "expired" | "failed",
  reason: string,
): Promise<void> {
  await execute(`UPDATE pending_bids SET status = $1, failure_reason = $2 WHERE id = $3`, [
    status,
    reason,
    id,
  ]);
}

/** Puts a failed bid back in play so the payer can present a different payment. */
export async function reopen(id: string): Promise<void> {
  await execute(
    `UPDATE pending_bids SET status = 'pending', failure_reason = NULL
      WHERE id = $1 AND status = 'failed' AND expires_at > now()`,
    [id],
  );
}

export type RecordPaymentResult =
  | { ok: true }
  | { ok: false; reason: "signature_used" | "bid_already_paid" };

/**
 * Records a settled payment against a bid.
 *
 * Two UNIQUE constraints guard this: payments.signature, so one transaction
 * cannot pay for two bids, and payments_bid_unique, so one bid cannot take two
 * payments. Both are database guarantees rather than check-then-act in
 * application code — and in Postgres they hold across every instance, which is
 * the whole reason for being here rather than on a local file.
 */
export async function recordPayment(
  bidId: string,
  signature: string,
  amountBaseUnits: bigint,
): Promise<RecordPaymentResult> {
  try {
    await execute(
      `INSERT INTO payments (id, signature, bid_id, amount_base_units, verified_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [randomUUID(), signature.trim(), bidId, amountBaseUnits.toString(), new Date()],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        reason: /bid/i.test(violatedConstraint(error)) ? "bid_already_paid" : "signature_used",
      };
    }
    throw error;
  }

  await execute(`UPDATE pending_bids SET status = 'paid', paid_at = $1 WHERE id = $2`, [
    new Date(),
    bidId,
  ]);

  return { ok: true };
}

/** Records a paid bid as history. The board is not derived from this. */
export async function recordAcceptedBid(
  bidId: string,
  bid: NormalizedBid,
  metadata: TokenMetadata,
  entryId: string | null = null,
): Promise<void> {
  await execute(
    `INSERT INTO accepted_bids
       (id, bid_id, entry_id, chain_id, contract, contract_key, launchpad_url,
        launchpad_host, launchpad_verified, amount_usd, metadata, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (bid_id) DO NOTHING`,
    [
      randomUUID(),
      bidId,
      entryId,
      bid.chainId,
      bid.contract,
      bid.contractKey,
      bid.launchpadUrl,
      bid.launchpadHost,
      bid.launchpadVerified,
      bid.amountUsd,
      JSON.stringify(metadata),
      new Date(),
    ],
  );
}

export type AcceptedBid = { bid: NormalizedBid; metadata: TokenMetadata; createdAt: string };

export async function listAcceptedBids(): Promise<AcceptedBid[]> {
  const rows = await query<{
    chain_id: string;
    contract: string;
    contract_key: string;
    launchpad_url: string | null;
    launchpad_host: string | null;
    launchpad_verified: boolean;
    amount_usd: number;
    metadata: TokenMetadata;
    created_at: Date;
  }>(`SELECT * FROM accepted_bids ORDER BY created_at ASC`);

  return rows.map((row) => ({
    bid: {
      chainId: row.chain_id as NormalizedBid["chainId"],
      contract: row.contract,
      contractKey: row.contract_key,
      launchpadUrl: row.launchpad_url,
      launchpadHost: row.launchpad_host,
      launchpadVerified: row.launchpad_verified,
      amountUsd: row.amount_usd,
      strippedParams: [],
    },
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
  }));
}

// --- Unmatched payments ------------------------------------------------------

export type UnmatchedStatus = "open" | "applied" | "discarded";

export type UnmatchedPayment = {
  id: string;
  signature: string;
  bidId: string | null;
  receivedBaseUnits: bigint;
  expectedBaseUnits: bigint;
  reason: string;
  createdAt: string;
  status: UnmatchedStatus;
  resolvedAt: string | null;
  resolutionNote: string | null;
  appliedBidId: string | null;
};

type UnmatchedRow = {
  id: string;
  signature: string;
  bid_id: string | null;
  received_base_units: string;
  expected_base_units: string;
  reason: string;
  created_at: Date;
  status: string;
  resolved_at: Date | null;
  resolution_note: string | null;
  applied_bid_id: string | null;
};

function toUnmatched(row: UnmatchedRow): UnmatchedPayment {
  return {
    id: row.id,
    signature: row.signature,
    bidId: row.bid_id,
    receivedBaseUnits: BigInt(row.received_base_units),
    expectedBaseUnits: BigInt(row.expected_base_units),
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
    status: row.status as UnmatchedStatus,
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    resolutionNote: row.resolution_note,
    appliedBidId: row.applied_bid_id,
  };
}

/**
 * Records a confirmed transfer that reached our wallet but matched no bid's
 * exact amount. The signature is burned separately, by claimSignature, so this
 * is purely the queue support works from.
 */
export async function recordUnmatchedPayment(params: {
  signature: string;
  bidId: string | null;
  receivedBaseUnits: bigint;
  expectedBaseUnits: bigint;
  reason: string;
}): Promise<void> {
  await execute(
    `INSERT INTO unmatched_payments
       (id, signature, bid_id, received_base_units, expected_base_units, reason, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (signature) DO NOTHING`,
    [
      randomUUID(),
      params.signature.trim(),
      params.bidId,
      params.receivedBaseUnits.toString(),
      params.expectedBaseUnits.toString(),
      params.reason,
      new Date(),
    ],
  );
}

export async function listUnmatchedPayments(status?: UnmatchedStatus): Promise<UnmatchedPayment[]> {
  const rows = status
    ? await query<UnmatchedRow>(
        `SELECT * FROM unmatched_payments WHERE status = $1 ORDER BY created_at DESC`,
        [status],
      )
    : await query<UnmatchedRow>(`SELECT * FROM unmatched_payments ORDER BY created_at DESC`);
  return rows.map(toUnmatched);
}

export async function getUnmatchedPayment(id: string): Promise<UnmatchedPayment | null> {
  const row = await queryOne<UnmatchedRow>(`SELECT * FROM unmatched_payments WHERE id = $1`, [id]);
  return row ? toUnmatched(row) : null;
}

export async function resolveUnmatchedPayment(
  id: string,
  status: "applied" | "discarded",
  note: string,
  appliedBidId: string | null = null,
): Promise<void> {
  await execute(
    `UPDATE unmatched_payments
        SET status = $2, resolved_at = $3, resolution_note = $4, applied_bid_id = $5
      WHERE id = $1`,
    [id, status, new Date(), note, appliedBidId],
  );
}

/**
 * Bids whose amount is closest to what actually arrived — the shortlist an
 * operator picks from when reuniting a stray transfer with its bid.
 */
export async function candidateBidsForAmount(
  receivedBaseUnits: bigint,
  limit = 8,
): Promise<PendingBid[]> {
  const rows = await query<Row>(
    `SELECT * FROM pending_bids
      WHERE status IN ('pending', 'expired', 'failed')
      ORDER BY ABS(COALESCE(payment_micros, amount_usd * 1000000) - $1) ASC
      LIMIT $2`,
    [receivedBaseUnits.toString(), limit],
  );
  return rows.map(toBid);
}

// --- Signature consumption ---------------------------------------------------

export type ClaimResult = { ok: true } | { ok: false; reason: "signature_used" };

/**
 * Burns a signature, whatever the verdict was.
 *
 * A signature is spent by being *evaluated*, not by matching. Leaving a
 * mismatched one reusable meant every stray transfer to our wallet stayed
 * claimable by whoever pasted it next, which is the same thing as leaving cash
 * on the pavement.
 *
 * Deliberately NOT called when the chain could not be reached or the
 * transaction is not confirmed yet: those are not verdicts, and burning on them
 * would let a flaky RPC destroy a legitimate payment.
 */
export async function claimSignature(
  signature: string,
  bidId: string | null,
  outcome: string,
): Promise<ClaimResult> {
  try {
    await execute(
      `INSERT INTO consumed_signatures (signature, bid_id, outcome, consumed_at)
       VALUES ($1,$2,$3,$4)`,
      [signature.trim(), bidId, outcome, new Date()],
    );
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "signature_used" };
    throw error;
  }
}

export async function signatureWasConsumed(signature: string): Promise<boolean> {
  const row = await queryOne<{ signature: string }>(
    `SELECT signature FROM consumed_signatures WHERE signature = $1`,
    [signature.trim()],
  );
  return row !== null;
}

// --- Verification attempts (rate limiting) -----------------------------------

export async function recordVerificationAttempt(
  bidId: string,
  ipHash: string | null,
): Promise<void> {
  await execute(
    `INSERT INTO verification_attempts (id, bid_id, ip_hash, attempted_at) VALUES ($1,$2,$3,$4)`,
    [randomUUID(), bidId, ipHash, new Date()],
  );
}

export async function countVerificationAttemptsForBid(bidId: string, since: Date): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM verification_attempts
      WHERE bid_id = $1 AND attempted_at > $2`,
    [bidId, since],
  );
  return Number(row?.count ?? 0);
}

export async function countVerificationAttemptsForIp(ipHash: string, since: Date): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM verification_attempts
      WHERE ip_hash = $1 AND attempted_at > $2`,
    [ipHash, since],
  );
  return Number(row?.count ?? 0);
}

export async function lastVerificationAttemptForBid(bidId: string): Promise<string | null> {
  const row = await queryOne<{ attempted_at: Date }>(
    `SELECT attempted_at FROM verification_attempts
      WHERE bid_id = $1 ORDER BY attempted_at DESC LIMIT 1`,
    [bidId],
  );
  return row ? row.attempted_at.toISOString() : null;
}

/** Drops attempt rows outside the counting window. This is a counter, not a log. */
export async function pruneVerificationAttempts(before: Date): Promise<void> {
  await execute(`DELETE FROM verification_attempts WHERE attempted_at <= $1`, [before]);
}
