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
  const entries = await listRanked();

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
        its chain. The name, ticker, logo and socials are read from DexScreener, so no bidoor can buy
        their way into editing what an entry says.
      </p>

      {target && (
        <p className="mt-4 rounded-card border border-line border-l-[5px] border-l-accent-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-muted">
          <span className="font-bold text-text">
            Aiming at #{target.rank}, held by {target.name} with {usd(target.totalUsd)}.
          </span>{" "}
          {/* The thing people get wrong: a rank is taken by paying for your own
              token, not by paying towards somebody else's. */}
          You take that spot by putting{" "}
          <span className="money font-bold text-text">{usd(target.priceToClaim)}</span> behind{" "}
          <span className="font-bold text-text">your own token</span>, not by bidding on{" "}
          {target.name}. Paste your contract below. If it is already on the board, this adds to its
          total instead of creating a second row.
        </p>
      )}

      <BidForm index={index} suggestedAmount={suggested} initialAddress={address ?? ""} />
    </div>
  );
}
