import Link from "next/link";
import { BidForm, type ListingIndex } from "./BidForm";
import { BOARD } from "@/lib/config";
import { listRanked } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BidPage({
  searchParams,
}: {
  searchParams: Promise<{ rank?: string }>;
}) {
  const { rank } = await searchParams;
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
  // Only prefill an amount when the visitor arrived by tapping a specific rank.
  // Landing on a blank form pre-loaded with the price of #1 reads as a paywall.
  const suggested = target?.priceToClaim ?? BOARD.minBidUsd;

  return (
    <div className="px-3 py-5 sm:px-4 sm:py-7">
      <Link href="/" className="text-xs text-muted-2 transition-colors hover:text-text">
        ← Back to the board
      </Link>

      <h1 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">Put a token on the board</h1>
      <p className="mt-1.5 max-w-lg text-[12.5px] leading-snug text-muted sm:text-sm">
        Rank is the total paid on a contract address — nothing else. If this token is already
        listed, your bid stacks onto its total instead of creating a second row.
      </p>

      {target && (
        <p className="mt-3 rounded-[4px] border border-line bg-surface px-3 py-2 text-[12.5px] text-muted">
          Aiming at <span className="font-semibold text-text">#{target.rank}</span> ({target.name}).
          Taking that spot costs{" "}
          <span className="num font-semibold text-gold">${target.priceToClaim.toLocaleString("en-US")}</span>.
        </p>
      )}

      <BidForm index={index} suggestedAmount={suggested} />
    </div>
  );
}
