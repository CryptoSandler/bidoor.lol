import { NextResponse } from "next/server";
import { getChain } from "@/lib/chains";
import { fetchTokenMetadata } from "@/lib/dexscreener";
import { paymentWallet, supportContact } from "@/lib/payments/config";
import { checkVerificationLimits, clientIp, hashIp } from "@/lib/payments/limits";
import {
  claimSignature,
  getPendingBid,
  markFailed,
  recordAcceptedBid,
  recordPayment,
  recordUnmatchedPayment,
  recordVerificationAttempt,
} from "@/lib/payments/pending";
import { SIGNATURE_INPUT_HELP, parseSignatureInput } from "@/lib/payments/signature-input";
import { verifyPayment } from "@/lib/payments/solana";
import { placeBid } from "@/lib/store";
import type { NormalizedBid } from "@/lib/validation";

/**
 * Settles a pending bid against a transaction signature.
 *
 * Two invariants drive the order of everything below.
 *
 * A transaction only counts if it landed inside this bid's own window, so a
 * transfer that predates the bid can never be lifted off the chain and used to
 * claim it. And a signature is burned the moment it is *evaluated*, matching or
 * not, so a mismatched transfer stops being a bearer instrument that the next
 * person to paste it can spend.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const wallet = paymentWallet();
  if (!wallet.ok) {
    return NextResponse.json({ ok: false, message: wallet.message }, { status: 503 });
  }

  const identity = clientIp(request);
  if (!identity.ok) {
    return NextResponse.json(
      { ok: false, message: "Payment checks are temporarily unavailable on this deployment." },
      { status: 503 },
    );
  }
  const ipHash = hashIp(identity.ip);

  let pasted = "";
  try {
    pasted = String(((await request.json()) as { signature?: string }).signature ?? "");
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  // An explorer link is unwrapped to the signature it points at, so pasting what
  // the explorer's copy button gives you works. Anything that is neither form is
  // refused here rather than downstream: it costs no RPC call, spends none of
  // the bid's verification attempts, and leaves the bid untouched — a typo is
  // not a failed payment.
  const signature = parseSignatureInput(pasted);
  if (!signature) {
    return NextResponse.json(
      { ok: false, message: SIGNATURE_INPUT_HELP, reason: "invalid_signature" },
      { status: 400 },
    );
  }

  const bid = await getPendingBid(id);
  if (!bid) {
    return NextResponse.json({ ok: false, message: "Unknown bid." }, { status: 404 });
  }
  if (bid.status === "paid") {
    return NextResponse.json({ ok: false, message: "This bid is already paid." }, { status: 409 });
  }
  if (bid.status === "expired") {
    return NextResponse.json(
      { ok: false, message: "This bid expired. Start a new one. Prices move.", status: "expired" },
      { status: 410 },
    );
  }

  // Before any outbound work: verification used to be unlimited, so one bid id
  // was enough to drive unbounded RPC calls and drain the node quota.
  const limit = await checkVerificationLimits(id, ipHash);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, message: limit.message, reason: limit.reason, status: "failed" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  await recordVerificationAttempt(id, ipHash);

  const verified = await verifyPayment({
    signature,
    expectedBaseUnits: bid.paymentBaseUnits,
    wallet: wallet.wallet,
    createdAtMs: Date.parse(bid.createdAt),
    expiresAtMs: Date.parse(bid.expiresAt),
  });

  // "We could not look" is not a verdict. Burning a signature because a node
  // was slow would destroy a real payment, so these two paths leave it intact.
  const inconclusive =
    !verified.ok &&
    (verified.reason === "rpc_unavailable" ||
      verified.reason === "not_confirmed" ||
      verified.reason === "no_block_time" ||
      verified.reason === "invalid_signature");

  if (inconclusive) {
    if (!verified.ok) await markFailed(id, "failed", verified.message);
    return NextResponse.json(
      { ok: false, message: (verified as { message: string }).message, status: "failed" },
      { status: 422 },
    );
  }

  // The chain gave a definitive answer, so the signature is spent either way.
  // Claimed before anything is acted on, so two concurrent requests cannot both
  // proceed and the loser is told plainly.
  const claimed = await claimSignature(signature, id, verified.ok ? "applied" : verified.reason);
  if (!claimed.ok) {
    const message = "That transaction has already been used. A payment can only be presented once.";
    await markFailed(id, "failed", message);
    return NextResponse.json(
      { ok: false, message, reason: "signature_used", status: "failed" },
      { status: 409 },
    );
  }

  if (!verified.ok) {
    // Real money that reached us but matched no bid is still filed for support.
    // The signature is now spent, so nobody else can claim it — recovering it is
    // an operator decision, not a race.
    if (verified.receivedBaseUnits !== undefined) {
      await recordUnmatchedPayment({
        signature,
        bidId: id,
        receivedBaseUnits: verified.receivedBaseUnits,
        expectedBaseUnits: bid.paymentBaseUnits,
        reason: verified.reason,
        // Recorded so the operator queue can show who actually paid, instead of
        // only the bid id that whoever pasted the signature chose.
        sender: verified.sender ?? null,
      });
    }

    // Points at a human, not at an automated recovery we do not have.
    const contact = supportContact();
    const message =
      verified.receivedBaseUnits !== undefined && contact
        ? `${verified.message} To have it applied, contact ${contact} with the transaction signature.`
        : verified.message;

    await markFailed(id, "failed", message);
    return NextResponse.json(
      { ok: false, message, reason: verified.reason, status: "failed" },
      { status: 422 },
    );
  }

  const payment = await recordPayment(id, signature, verified.amountBaseUnits);
  if (!payment.ok) {
    // payments.bid_id is UNIQUE, so this is the concurrent-settlement case: the
    // bid already has a payment applied.
    return NextResponse.json(
      { ok: false, message: "This bid already has a payment applied.", status: "failed" },
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
          "Your payment was confirmed, but the token could not be resolved just now. Reload this page in a moment. The payment is recorded and will not be lost.",
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
    launchpadVerified: bid.launchpadVerified,
    amountUsd: bid.amountUsd,
    strippedParams: [],
  };

  const outcome = await placeBid(normalized, metadata.metadata);
  await recordAcceptedBid(id, normalized, metadata.metadata, outcome.entry.id);

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
