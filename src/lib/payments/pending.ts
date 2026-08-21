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
  /** Empty in the database, null here: the launch link is optional. */
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
    launchpadUrl: row.launchpad_url || null,
    launchpadHost: row.launchpad_host || null,
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

export function createPendingBid(bid: NormalizedBid, ipHash: string | null = null): PendingBid {
  expireStalePendingBids();

  const id = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000);

  const insert = db().prepare(
    `INSERT INTO pending_bids
       (id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
        launchpad_verified, amount_usd, ip_hash, payment_micros, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
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
        bid.launchpadUrl ?? "",
        bid.launchpadHost ?? "",
        bid.launchpadVerified ? 1 : 0,
        bid.amountUsd,
        ipHash,
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
      bid.launchpadUrl ?? "",
      bid.launchpadHost ?? "",
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
      launchpadUrl: (row.launchpad_url as string) || null,
      launchpadHost: (row.launchpad_host as string) || null,
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

export function listUnmatchedPayments(status?: UnmatchedStatus): UnmatchedPayment[] {
  const rows = (
    status
      ? db()
          .prepare(`SELECT * FROM unmatched_payments WHERE status = ? ORDER BY created_at DESC`)
          .all(status)
      : db().prepare(`SELECT * FROM unmatched_payments ORDER BY created_at DESC`).all()
  ) as Record<string, string | null>[];

  return rows.map((row) => ({
    id: row.id as string,
    signature: row.signature as string,
    bidId: row.bid_id,
    receivedBaseUnits: BigInt(row.received_base_units as string),
    expectedBaseUnits: BigInt(row.expected_base_units as string),
    reason: row.reason as string,
    createdAt: row.created_at as string,
    status: (row.status ?? "open") as UnmatchedStatus,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    appliedBidId: row.applied_bid_id,
  }));
}

export function getUnmatchedPayment(id: string): UnmatchedPayment | null {
  return listUnmatchedPayments().find((payment) => payment.id === id) ?? null;
}

export function resolveUnmatchedPayment(
  id: string,
  status: "applied" | "discarded",
  note: string,
  appliedBidId: string | null = null,
): void {
  db()
    .prepare(
      `UPDATE unmatched_payments
          SET status = ?, resolved_at = ?, resolution_note = ?, applied_bid_id = ?
        WHERE id = ?`,
    )
    .run(status, new Date().toISOString(), note, appliedBidId, id);
}

/**
 * Bids whose amount is closest to what actually arrived — the shortlist an
 * operator picks from when reuniting a stray transfer with its bid.
 */
export function candidateBidsForAmount(receivedBaseUnits: bigint, limit = 8): PendingBid[] {
  const rows = db()
    .prepare(
      `SELECT * FROM pending_bids
        WHERE status IN ('pending', 'expired', 'failed')
        ORDER BY ABS(COALESCE(payment_micros, amount_usd * 1000000) - ?) ASC
        LIMIT ?`,
    )
    .all(Number(receivedBaseUnits), limit) as Row[];
  return rows.map(toBid);
}

// --- Moderation -------------------------------------------------------------

export type Delisting = { contractKey: string; reason: string; delistedAt: string };

/**
 * Removes an entry from the board without deleting anything.
 *
 * The delisting is recorded with a timestamp, and the board rebuild ignores
 * every bid that predates it. That is what makes a relisting start from zero:
 * the old total is not erased, it simply no longer counts. Money is not
 * returned — the rules say bids are non-refundable, and a delisting is the
 * consequence of behaviour, not a cancelled order.
 */
export function delistEntry(contractKey: string, reason: string): Delisting {
  const delisting: Delisting = {
    contractKey,
    reason,
    delistedAt: new Date().toISOString(),
  };
  db()
    .prepare(`INSERT INTO delistings (id, contract_key, reason, delisted_at) VALUES (?, ?, ?, ?)`)
    .run(randomUUID(), delisting.contractKey, delisting.reason, delisting.delistedAt);
  return delisting;
}

/** Latest delisting per contract key. */
export function delistingsByKey(): Map<string, Delisting> {
  const rows = db()
    .prepare(`SELECT contract_key, reason, delisted_at FROM delistings ORDER BY delisted_at ASC`)
    .all() as { contract_key: string; reason: string; delisted_at: string }[];

  const latest = new Map<string, Delisting>();
  for (const row of rows) {
    latest.set(row.contract_key, {
      contractKey: row.contract_key,
      reason: row.reason,
      delistedAt: row.delisted_at,
    });
  }
  return latest;
}

export function listDelistings(): Delisting[] {
  return [...delistingsByKey().values()].sort((a, b) => b.delistedAt.localeCompare(a.delistedAt));
}
