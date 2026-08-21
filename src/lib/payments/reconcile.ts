import { getChain } from "../chains";
import { fetchTokenMetadata, type TokenMetadata } from "../dexscreener";
import { placeBid } from "../store";
import type { NormalizedBid } from "../validation";
import { query } from "../db";
import { getPendingBid, recordAcceptedBid } from "./pending";

/**
 * Repairs bids that were paid for but never reached the board.
 *
 * The gap is real and narrow: a payment is verified and its signature claimed,
 * and then the DexScreener lookup that supplies the entry's identity fails. The
 * money is recorded, the rank is not. Nothing in the request path can fix that
 * — the request is already over — so this runs separately and picks up the
 * pieces.
 *
 * Idempotent by construction: the work list is "settled payments with no
 * accepted_bids row", so anything already applied is invisible to the next run.
 */
export type ReconcileOutcome = {
  scanned: number;
  applied: { bidId: string; rank: number; name: string }[];
  failed: { bidId: string; reason: string }[];
};

export type MetadataResolver = (
  chainId: string,
  contract: string,
) => Promise<TokenMetadata | null>;

const liveResolver: MetadataResolver = async (chainId, contract) => {
  const chain = getChain(chainId);
  if (!chain) return null;
  const result = await fetchTokenMetadata(chain, contract);
  return result.ok ? result.metadata : null;
};

export async function reconcileSettledPayments(
  resolveMetadata: MetadataResolver = liveResolver,
): Promise<ReconcileOutcome> {
  // A settled payment with no accepted_bids row is, by definition, money we
  // took without giving a rank.
  const orphans = await query<{ bid_id: string }>(
    `SELECT p.bid_id AS bid_id
       FROM payments p
       LEFT JOIN accepted_bids a ON a.bid_id = p.bid_id
      WHERE a.id IS NULL
      ORDER BY p.verified_at ASC`,
  );

  const outcome: ReconcileOutcome = { scanned: orphans.length, applied: [], failed: [] };

  for (const orphan of orphans) {
    const bid = await getPendingBid(orphan.bid_id);
    if (!bid) {
      outcome.failed.push({ bidId: orphan.bid_id, reason: "pending bid no longer exists" });
      continue;
    }

    const metadata = await resolveMetadata(bid.chainId, bid.contract);
    if (!metadata) {
      // Still unresolvable. Left alone so the next run tries again.
      outcome.failed.push({ bidId: bid.id, reason: "token still unresolvable" });
      continue;
    }

    const normalized: NormalizedBid = {
      chainId: bid.chainId as NormalizedBid["chainId"],
      contract: bid.contract,
      contractKey: bid.contractKey,
      launchpadUrl: bid.launchpadUrl,
      launchpadHost: bid.launchpadHost,
      launchpadVerified: bid.launchpadVerified,
      amountUsd: bid.amountUsd,
      strippedParams: [],
    };

    const applied = await placeBid(normalized, metadata);
    // Written after the board is updated, so a crash in between leaves the bid
    // orphaned and retryable rather than silently marked done.
    await recordAcceptedBid(bid.id, normalized, metadata, applied.entry.id);

    outcome.applied.push({ bidId: bid.id, rank: applied.newRank, name: applied.entry.name });
  }

  return outcome;
}
