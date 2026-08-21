import Link from "next/link";
import { BidForm, type ListingIndex } from "./BidForm";
import { BOARD } from "@/lib/config";
import { usd } from "@/lib/format";
import { listRanked } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BidPage({
  searchParams,
}: {
  searchParams: Promise<{ rank?: string; address?: string }>;
}) {
  const { rank, address } = await searchParams;
  const entries = listRanked();

  // Shipped to the client so the form can tell you, as you type the address,
  // that the token is already on the board and your money will stack onto it.
  const index: ListingIndex = Object.fromEntries(
    entries.map((entry) => [
      entry.contractKey,
      { name: entry.name, rank: entry.rank, totalUsd: entry.totalUsd },
    ]),
  );

  const target = rank ? entries.find((entry) => entry.rank === Number(rank)) : undefined;
  // Only prefill an amount when the visitor aimed at a specific rank. A blank
  // form pre-loaded with the price of #1 reads as a paywall.
  const suggested = target?.priceToClaim ?? BOARD.minBidUsd;

  return (
    <div className="shell py-6 sm:py-8">
      <Link href="/" className="text-xs text-faint transition-colors hover:text-text">
        ← Back to the board
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">Put a token on the board</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        Any token tradeable on DexScreener can be listed. All you need is the contract address and
        its chain — the name, ticker, logo and socials are read from DexScreener, so nobody can buy
        their way into editing what an entry says.
      </p>

      {target && (
        <p className="mt-4 rounded-card border border-line bg-surface px-3.5 py-2.5 text-sm text-muted">
          Aiming at <span className="font-bold text-text">#{target.rank}</span> ({target.name}).
          Taking that spot costs{" "}
          <span className="money font-bold text-accent">{usd(target.priceToClaim)}</span>.
        </p>
      )}

      <BidForm index={index} suggestedAmount={suggested} initialAddress={address ?? ""} />
    </div>
  );
}
