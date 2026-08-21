import { NextResponse } from "next/server";
import { getChain } from "@/lib/chains";
import { fetchTokenMetadata } from "@/lib/dexscreener";
import { paymentWallet } from "@/lib/payments/config";
import {
  getPendingBid,
  markFailed,
  recordAcceptedBid,
  recordPayment,
  recordUnmatchedPayment,
} from "@/lib/payments/pending";
import { verifyPayment } from "@/lib/payments/solana";
import { placeBid } from "@/lib/store";
import type { NormalizedBid } from "@/lib/validation";

/**
 * Settles a pending bid against a transaction signature.
 *
 * Order matters. The signature is claimed in the database BEFORE the board is
 * touched, so a signature can never pay for two bids even if two requests
 * arrive at the same instant — the UNIQUE constraint decides the winner.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const wallet = paymentWallet();
  if (!wallet.ok) {
    return NextResponse.json({ ok: false, message: wallet.message }, { status: 503 });
  }

  let signature = "";
  try {
    signature = String(((await request.json()) as { signature?: string }).signature ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const bid = getPendingBid(id);
  if (!bid) {
    return NextResponse.json({ ok: false, message: "Unknown bid." }, { status: 404 });
  }
  if (bid.status === "paid") {
    return NextResponse.json({ ok: false, message: "This bid is already paid." }, { status: 409 });
  }
  if (bid.status === "expired") {
    return NextResponse.json(
      { ok: false, message: "This bid expired. Start a new one — prices move.", status: "expired" },
      { status: 410 },
    );
  }

  const verified = await verifyPayment({
    signature,
    expectedBaseUnits: bid.paymentBaseUnits,
    wallet: wallet.wallet,
  });

  if (!verified.ok) {
    // Real money that reached us but matched no bid is filed rather than
    // dropped. The signature is deliberately NOT consumed: this is somebody's
    // funds, and support has to be able to apply them.
    if (verified.receivedBaseUnits !== undefined) {
      recordUnmatchedPayment({
        signature,
        bidId: id,
        receivedBaseUnits: verified.receivedBaseUnits,
        expectedBaseUnits: bid.paymentBaseUnits,
        reason: verified.reason,
      });
    }

    // A wrong paste is not a dead bid: the window is still open, so leave the
    // reason visible and let them try another signature.
    markFailed(id, "failed", verified.message);
    return NextResponse.json(
      { ok: false, message: verified.message, reason: verified.reason, status: "failed" },
      { status: 422 },
    );
  }

  const claimed = recordPayment(id, signature, verified.amountBaseUnits);
  if (!claimed.ok) {
    const message = "That transaction has already been used to pay for a bid.";
    markFailed(id, "failed", message);
    return NextResponse.json(
      { ok: false, message, reason: "signature_used", status: "failed" },
      { status: 409 },
    );
  }

  // Re-read identity at settlement so the board reflects the token as it is
  // now, not as it was when the bid was started up to 30 minutes ago.
  const chain = getChain(bid.chainId)!;
  const metadata = await fetchTokenMetadata(chain, bid.contract);
  if (!metadata.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your payment was confirmed, but the token could not be resolved just now. Reload this page in a moment — the payment is recorded and will not be lost.",
      },
      { status: 503 },
    );
  }

  const normalized: NormalizedBid = {
    chainId: bid.chainId as NormalizedBid["chainId"],
    contract: bid.contract,
    contractKey: bid.contractKey,
    launchpadUrl: bid.launchpadUrl,
    launchpadHost: bid.launchpadHost,
    amountUsd: bid.amountUsd,
    strippedParams: [],
  };

  const outcome = placeBid(normalized, metadata.metadata);
  recordAcceptedBid(id, normalized, metadata.metadata);

  return NextResponse.json({
    ok: true,
    rank: outcome.newRank,
    previousRank: outcome.previousRank,
    totalUsd: outcome.totalUsd,
    toppedUp: outcome.toppedUp,
    name: outcome.entry.name,
    ticker: outcome.entry.ticker,
  });
}
