import { randomInt, randomUUID } from "node:crypto";
import type { TokenMetadata } from "../dexscreener";
import type { NormalizedBid } from "../validation";
import {
  FRACTION_MAX,
  FRACTION_MIN,
  PAYMENT_WINDOW_MINUTES,
  paymentBaseUnits,
} from "./config";
import { db } from "./db";

export type PendingStatus = "pending" | "paid" | "expired" | "failed";

export type PendingBid = {
  id: string;
  chainId: string;
  contract: string;
  contractKey: string;
  launchpadUrl: string;
  launchpadHost: string;
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
  launchpad_url: string;
  launchpad_host: string;
  launchpad_verified: number;
  amount_usd: number;
  payment_micros: number | null;
  status: string;
  failure_reason: string | null;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
};

function toBid(row: Row): PendingBid {
  return {
    id: row.id,
    chainId: row.chain_id,
    contract: row.contract,
    contractKey: row.contract_key,
    launchpadUrl: row.launchpad_url,
    launchpadHost: row.launchpad_host,
    launchpadVerified: row.launchpad_verified === 1,
    amountUsd: row.amount_usd,
    // Legacy rows predate unique amounts; fall back to the plain bid amount.
    paymentBaseUnits: BigInt(row.payment_micros ?? row.amount_usd * 1_000_000),
    status: row.status as PendingStatus,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
  };
}

/**
 * Moves every pending bid whose window has closed to 'expired'.
 *
 * Run before allocating a new payment amount: the uniqueness index only covers
 * 'pending' rows, so sweeping first is what releases the fractions held by bids
 * nobody ever paid. Without this, abandoned bids would slowly consume the
 * fraction space for their amount.
 */
export function expireStalePendingBids(): number {
  const result = db()
    .prepare(
      `UPDATE pending_bids
         SET status = 'expired',
             failure_reason = 'This bid expired before a payment was confirmed.'
       WHERE status = 'pending' AND expires_at <= ?`,
    )
    .run(new Date().toISOString());
  return Number(result.changes ?? 0);
}

export class PaymentAmountUnavailable extends Error {
  constructor() {
    super("Could not allocate a unique payment amount. Try again in a moment.");
    this.name = "PaymentAmountUnavailable";
  }
}

/** How many fractions we try before giving up rather than looping forever. */
const FRACTION_ATTEMPTS = 40;

export function createPendingBid(bid: NormalizedBid): PendingBid {
  expireStalePendingBids();

  const id = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000);

  const insert = db().prepare(
    `INSERT INTO pending_bids
       (id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
        launchpad_verified, amount_usd, payment_micros, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  );

  // The fraction is drawn at random and offered to the database. If another
  // pending bid already holds that exact amount the unique index rejects it and
  // we draw again — the database decides, so two bids created in the same
  // instant cannot both take it.
  for (let attempt = 0; attempt < FRACTION_ATTEMPTS; attempt++) {
    const fraction = randomInt(FRACTION_MIN, FRACTION_MAX + 1);
    try {
      insert.run(
        id,
        bid.chainId,
        bid.contract,
        bid.contractKey,
        bid.launchpadUrl,
        bid.launchpadHost,
        bid.launchpadVerified ? 1 : 0,
        bid.amountUsd,
        paymentBaseUnits(bid.amountUsd, fraction),
        now.toISOString(),
        expires.toISOString(),
      );
      return getPendingBid(id)!;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new PaymentAmountUnavailable();
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string }).code ?? "";
  const message = (error as Error)?.message ?? "";
  return code === "ERR_SQLITE_ERROR" && /UNIQUE/i.test(message);
}

/**
 * Reads a bid, expiring it on the way out if its window has closed. Expiry is
 * evaluated on read rather than by a background job: there is no scheduler here,
 * and a bid nobody looks at does not need to have expired yet.
 */
export function getPendingBid(id: string): PendingBid | null {
  const row = db().prepare(`SELECT * FROM pending_bids WHERE id = ?`).get(id) as Row | undefined;
  if (!row) return null;

  const bid = toBid(row);
  if (bid.status === "pending" && Date.parse(bid.expiresAt) <= Date.now()) {
    markFailed(id, "expired", "This bid expired before a payment was confirmed.");
    return getPendingBid(id);
  }
  return bid;
}

export function markFailed(id: string, status: "expired" | "failed", reason: string): void {
  db()
    .prepare(`UPDATE pending_bids SET status = ?, failure_reason = ? WHERE id = ?`)
    .run(status, reason, id);
}

/** Puts a failed bid back in play so the payer can paste a different signature. */
export function reopen(id: string): void {
  db()
    .prepare(
      `UPDATE pending_bids SET status = 'pending', failure_reason = NULL
       WHERE id = ? AND status = 'failed' AND expires_at > ?`,
    )
    .run(id, new Date().toISOString());
}

export type RecordPaymentResult =
  | { ok: true }
  | { ok: false; reason: "signature_used" };

/**
 * Claims a signature for a bid. The UNIQUE constraint on payments.signature is
 * what actually prevents one transaction from paying for two bids — this is a
 * database guarantee, not a check-then-act in application code, so two requests
 * racing with the same signature cannot both win.
 */
export function recordPayment(
  bidId: string,
  signature: string,
  amountBaseUnits: bigint,
): RecordPaymentResult {
  try {
    db()
      .prepare(
        `INSERT INTO payments (id, signature, bid_id, amount_base_units, verified_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), signature.trim(), bidId, amountBaseUnits.toString(), new Date().toISOString());
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "signature_used" };
    throw error;
  }

  db()
    .prepare(`UPDATE pending_bids SET status = 'paid', paid_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), bidId);

  return { ok: true };
}

/** Records a paid bid so the board can be rebuilt after a restart. */
export function recordAcceptedBid(
  bidId: string,
  bid: NormalizedBid,
  metadata: TokenMetadata,
): void {
  db()
    .prepare(
      `INSERT INTO accepted_bids
       (id, bid_id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
        launchpad_verified, amount_usd, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      bidId,
      bid.chainId,
      bid.contract,
      bid.contractKey,
      bid.launchpadUrl,
      bid.launchpadHost,
      bid.launchpadVerified ? 1 : 0,
      bid.amountUsd,
      JSON.stringify(metadata),
      new Date().toISOString(),
    );
}

export type AcceptedBid = { bid: NormalizedBid; metadata: TokenMetadata; createdAt: string };

export function listAcceptedBids(): AcceptedBid[] {
  const rows = db()
    .prepare(`SELECT * FROM accepted_bids ORDER BY created_at ASC`)
    .all() as Record<string, string | number>[];

  return rows.map((row) => ({
    bid: {
      chainId: row.chain_id as NormalizedBid["chainId"],
      contract: row.contract as string,
      contractKey: row.contract_key as string,
      launchpadUrl: row.launchpad_url as string,
      launchpadHost: row.launchpad_host as string,
      launchpadVerified: row.launchpad_verified === 1,
      amountUsd: row.amount_usd as number,
      strippedParams: [],
    },
    metadata: JSON.parse(row.metadata_json as string) as TokenMetadata,
    createdAt: row.created_at as string,
  }));
}

/**
 * Records a confirmed transfer that reached our wallet but matched no bid's
 * exact amount.
 *
 * Deliberately does NOT consume the signature in `payments`: the money is real
 * and the payer should be able to be made whole, and locking the signature here
 * would also block a legitimate retry. This table is the queue support works
 * from.
 */
export function recordUnmatchedPayment(params: {
  signature: string;
  bidId: string | null;
  receivedBaseUnits: bigint;
  expectedBaseUnits: bigint;
  reason: string;
}): void {
  try {
    db()
      .prepare(
        `INSERT INTO unmatched_payments
           (id, signature, bid_id, received_base_units, expected_base_units, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        params.signature.trim(),
        params.bidId,
        params.receivedBaseUnits.toString(),
        params.expectedBaseUnits.toString(),
        params.reason,
        new Date().toISOString(),
      );
  } catch (error) {
    // Already logged from an earlier attempt with the same signature; one row
    // per stray transfer is enough.
    if (!isUniqueViolation(error)) throw error;
  }
}

export type UnmatchedPayment = {
  signature: string;
  bidId: string | null;
  receivedBaseUnits: bigint;
  expectedBaseUnits: bigint;
  reason: string;
  createdAt: string;
};

export function listUnmatchedPayments(): UnmatchedPayment[] {
  const rows = db()
    .prepare(`SELECT * FROM unmatched_payments ORDER BY created_at DESC`)
    .all() as Record<string, string | null>[];

  return rows.map((row) => ({
    signature: row.signature as string,
    bidId: row.bid_id,
    receivedBaseUnits: BigInt(row.received_base_units as string),
    expectedBaseUnits: BigInt(row.expected_base_units as string),
    reason: row.reason as string,
    createdAt: row.created_at as string,
  }));
}
