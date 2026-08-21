import { NextResponse } from "next/server";
import { getChain } from "@/lib/chains";
import { fetchTokenMetadata } from "@/lib/dexscreener";
import { paymentWallet } from "@/lib/payments/config";
import { checkBidCreationLimits, clientIp, hashIp } from "@/lib/payments/limits";
import { createPendingBid } from "@/lib/payments/pending";
import { rankEntries } from "@/lib/ranking";
import { findByContractKey } from "@/lib/store";
import { contractKeyFor, validateBid, type BidInput } from "@/lib/validation";

/**
 * Starts a bid. This does NOT touch the board: it creates a pending bid with a
 * price, an id and a deadline, and hands back where to pay. Only a confirmed
 * on-chain payment puts anything on the leaderboard — a rank must never exist
 * unpaid.
 */
export async function POST(request: Request) {
  const wallet = paymentWallet();
  if (!wallet.ok) {
    return NextResponse.json({ ok: false, errors: { amountUsd: wallet.message } }, { status: 503 });
  }

  let body: BidInput;
  try {
    body = (await request.json()) as BidInput;
  } catch {
    return NextResponse.json({ ok: false, errors: { contract: "Malformed request." } }, { status: 400 });
  }

  // The current total decides whether this is a new listing (board minimum) or
  // a top-up (smaller minimum).
  const key = contractKeyFor(body.chainId, body.contract ?? "");
  const current = key ? findByContractKey(key) : undefined;
  const existing = current
    ? { contractKey: current.contractKey, totalUsd: rankEntries([current])[0].totalUsd }
    : null;

  const result = validateBid(body, existing);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });
  }

  // Fails closed: if we cannot identify the caller we cannot rate limit them,
  // and an unlimited allowance on the endpoint that reserves payment amounts is
  // not something to shrug at.
  const identity = clientIp(request);
  if (!identity.ok) {
    return NextResponse.json(
      {
        ok: false,
        errors: { amountUsd: "Bids are temporarily unavailable on this deployment." },
        reason: "untrusted_client",
      },
      { status: 503 },
    );
  }

  // Checked before the DexScreener lookup: a caller who is over their limit
  // should not be able to make us do outbound work on every request.
  const ipHash = hashIp(identity.ip);
  const limit = checkBidCreationLimits(ipHash, result.value.amountUsd);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, errors: { amountUsd: limit.message }, reason: limit.reason, retryAt: limit.retryAt },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((Date.parse(limit.retryAt) - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  // Resolve the token before taking anyone to a payment screen. Failing here
  // costs nothing; failing after they have sent USDC costs them money.
  const chain = getChain(result.value.chainId)!;
  const metadata = await fetchTokenMetadata(chain, result.value.contract);
  if (!metadata.ok) {
    return NextResponse.json(
      { ok: false, errors: { contract: metadata.message } },
      { status: metadata.kind === "not_found" ? 422 : 503 },
    );
  }

  const pending = createPendingBid(result.value, ipHash);

  return NextResponse.json({
    ok: true,
    id: pending.id,
    amountUsd: pending.amountUsd,
    expiresAt: pending.expiresAt,
    wallet: wallet.wallet,
    token: { name: metadata.metadata.name, ticker: metadata.metadata.ticker },
    strippedParams: result.value.strippedParams,
  });
}
