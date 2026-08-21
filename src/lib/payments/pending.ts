import { randomUUID } from "node:crypto";
import type { TokenMetadata } from "../dexscreener";
import type { NormalizedBid } from "../validation";
import { PAYMENT_WINDOW_MINUTES } from "./config";
import { db } from "./db";

export type PendingStatus = "pending" | "paid" | "expired" | "failed";

export type PendingBid = {
  id: string;
  chainId: string;
  contract: string;
  contractKey: string;
  launchpadUrl: string;
  launchpadHost: string;
  amountUsd: number;
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
  amount_usd: number;
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
    amountUsd: row.amount_usd,
    status: row.status as PendingStatus,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
  };
}

export function createPendingBid(bid: NormalizedBid): PendingBid {
  const id = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000);

  db()
    .prepare(
      `INSERT INTO pending_bids
       (id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
        amount_usd, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .run(
      id,
      bid.chainId,
      bid.contract,
      bid.contractKey,
      bid.launchpadUrl,
      bid.launchpadHost,
      bid.amountUsd,
      now.toISOString(),
      expires.toISOString(),
    );

  return getPendingBid(id)!;
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
    const code = (error as { code?: string }).code ?? "";
    const message = (error as Error).message ?? "";
    if (code === "ERR_SQLITE_ERROR" && /UNIQUE/i.test(message)) {
      return { ok: false, reason: "signature_used" };
    }
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
        amount_usd, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      bidId,
      bid.chainId,
      bid.contract,
      bid.contractKey,
      bid.launchpadUrl,
      bid.launchpadHost,
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
      amountUsd: row.amount_usd as number,
      strippedParams: [],
    },
    metadata: JSON.parse(row.metadata_json as string) as TokenMetadata,
    createdAt: row.created_at as string,
  }));
}
