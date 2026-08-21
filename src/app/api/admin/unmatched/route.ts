import { NextResponse } from "next/server";
import {
  authenticateAdmin,
  checkStepUp,
  recordAdminAction,
  stepUpConfigured,
} from "@/lib/admin";
import { clientIp, hashIp } from "@/lib/payments/limits";
import { getChain } from "@/lib/chains";
import { fetchTokenMetadata } from "@/lib/dexscreener";
import {
  getPendingBid,
  getUnmatchedPayment,
  recordAcceptedBid,
  recordPayment,
  resolveUnmatchedPayment,
} from "@/lib/payments/pending";
import { placeBid } from "@/lib/store";
import type { NormalizedBid } from "@/lib/validation";

/**
 * Reunites a stray payment with a bid, or files it as unrecoverable.
 *
 * Applying goes through the same signature claim as a normal settlement, so the
 * UNIQUE constraint stays the arbiter: an operator cannot spend one transfer on
 * two bids by going through the console.
 */
export async function POST(request: Request) {
  const admin = await authenticateAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: "Not authorised." }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    action?: "apply" | "discard";
    bidId?: string;
    note?: string;
    stepUp?: string;
  };

  // Moving somebody else's money, so it sits behind the second secret too.
  if (stepUpConfigured() && !checkStepUp(String(body.stepUp ?? ""))) {
    return NextResponse.json(
      { ok: false, message: "This action needs the step-up secret." },
      { status: 403 },
    );
  }

  const identity = clientIp(request);
  const ipHash = identity.ok ? hashIp(identity.ip) : null;

  const payment = body.id ? await getUnmatchedPayment(body.id) : null;
  if (!payment) {
    return NextResponse.json({ ok: false, message: "Unknown payment." }, { status: 404 });
  }
  if (payment.status !== "open") {
    return NextResponse.json(
      { ok: false, message: `This payment is already ${payment.status}.` },
      { status: 409 },
    );
  }

  const note = (body.note ?? "").trim();

  if (body.action === "discard") {
    if (!note) {
      return NextResponse.json(
        { ok: false, message: "A reason is required to discard a payment." },
        { status: 422 },
      );
    }
    await resolveUnmatchedPayment(payment.id, "discarded", note);
    await recordAdminAction({
      actor: admin.label,
      action: "payment.discard",
      targetType: "unmatched_payment",
      targetId: payment.id,
      details: { note, signature: payment.signature, received: payment.receivedBaseUnits.toString() },
      ipHash,
    });
    return NextResponse.json({ ok: true, status: "discarded" });
  }

  const bid = body.bidId ? await getPendingBid(body.bidId) : null;
  if (!bid) {
    return NextResponse.json({ ok: false, message: "Unknown bid." }, { status: 404 });
  }
  if (bid.status === "paid") {
    return NextResponse.json({ ok: false, message: "That bid is already paid." }, { status: 409 });
  }

  const claimed = await recordPayment(bid.id, payment.signature, payment.receivedBaseUnits);
  if (!claimed.ok) {
    return NextResponse.json(
      { ok: false, message: "That signature has already been used to pay for a bid." },
      { status: 409 },
    );
  }

  const chain = getChain(bid.chainId);
  const metadata = chain ? await fetchTokenMetadata(chain, bid.contract) : null;
  if (!metadata || !metadata.ok) {
    // The payment is claimed; reconcile will finish the job once the token
    // resolves. Recorded as applied so it leaves the operator's queue.
    await resolveUnmatchedPayment(payment.id, "applied", note || "Applied; awaiting reconcile.", bid.id);
    return NextResponse.json({
      ok: true,
      status: "applied",
      pendingReconcile: true,
      message: "Payment claimed. The token could not be resolved yet — reconcile will finish it.",
    });
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
  await recordAcceptedBid(bid.id, normalized, metadata.metadata, outcome.entry.id);
  await resolveUnmatchedPayment(payment.id, "applied", note || "Applied by operator.", bid.id);
  await recordAdminAction({
    actor: admin.label,
    action: "payment.apply",
    targetType: "unmatched_payment",
    targetId: payment.id,
    details: {
      bidId: bid.id,
      entryId: outcome.entry.id,
      signature: payment.signature,
      received: payment.receivedBaseUnits.toString(),
      note,
    },
    ipHash,
  });

  return NextResponse.json({ ok: true, status: "applied", rank: outcome.newRank });
}
