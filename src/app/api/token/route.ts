import { NextResponse } from "next/server";
import { checkAddress } from "@/lib/addresses";
import { getChain } from "@/lib/chains";
import { fetchTokenMetadata } from "@/lib/dexscreener";

/**
 * Metadata preview for the bid form. Lets someone see exactly which token they
 * are about to pay for — name, ticker and logo — before spending anything,
 * which matters a lot more now that they cannot type those fields themselves.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get("chain") ?? "";
  const address = searchParams.get("address") ?? "";

  const chain = getChain(chainId);
  if (!chain) {
    return NextResponse.json({ ok: false, message: "Unknown chain." }, { status: 400 });
  }

  const checked = checkAddress(chain.family, address);
  if (!checked.ok) {
    return NextResponse.json({ ok: false, message: checked.reason }, { status: 400 });
  }

  const result = await fetchTokenMetadata(chain, checked.display);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.kind === "not_found" ? 404 : 503 },
    );
  }

  return NextResponse.json({ ok: true, ...result.metadata });
}
