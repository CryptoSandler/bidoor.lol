import { NextResponse } from "next/server";
import { getChain } from "@/lib/chains";
import { fetchTokenMetadata } from "@/lib/dexscreener";
import { rankEntries } from "@/lib/ranking";
import { findByContractKey, listRanked, placeBid } from "@/lib/store";
import { contractKeyFor, validateBid, type BidInput } from "@/lib/validation";

/**
 * No payment step yet: a bid that validates and resolves is applied
 * immediately. When a processor is wired in, this handler becomes "create
 * intent" and the entry is only written on a settled webhook — a rank must
 * never exist unpaid.
 */
export async function POST(request: Request) {
  let body: BidInput;
  try {
    body = (await request.json()) as BidInput;
  } catch {
    return NextResponse.json({ ok: false, errors: { contract: "Malformed request." } }, { status: 400 });
  }

  // Look up the current total first: it decides whether this is a new listing
  // (board minimum applies) or a top-up (smaller minimum applies).
  const key = contractKeyFor(body.chainId, body.contract ?? "");
  const current = key ? findByContractKey(key) : undefined;
  const existing = current
    ? { contractKey: current.contractKey, totalUsd: rankEntries([current])[0].totalUsd }
    : null;

  const result = validateBid(body, existing);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });
  }

  // Identity comes from DexScreener, never from the payer. This doubles as the
  // existence check: an address no DEX has seen cannot be listed, which is a
  // guarantee address-format validation alone can never give.
  const chain = getChain(result.value.chainId)!;
  const metadata = await fetchTokenMetadata(chain, result.value.contract);
  if (!metadata.ok) {
    return NextResponse.json(
      { ok: false, errors: { contract: metadata.message } },
      // "Not found" is the caller's problem; "unavailable" is ours.
      { status: metadata.kind === "not_found" ? 422 : 503 },
    );
  }

  const outcome = placeBid(result.value, metadata.metadata);

  return NextResponse.json({
    ok: true,
    toppedUp: outcome.toppedUp,
    previousRank: outcome.previousRank,
    rank: outcome.newRank,
    totalUsd: outcome.totalUsd,
    name: outcome.entry.name,
    ticker: outcome.entry.ticker,
    strippedParams: result.value.strippedParams,
    boardSize: listRanked().length,
  });
}
