import Link from "next/link";
import { BoardRow } from "@/components/BoardRow";
import { BOARD } from "@/lib/config";
import { usd, usdCompact } from "@/lib/format";
import { getBoard } from "@/lib/store";

// Mock data mutates in memory, so never cache this route.
export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  const { entries, now, potUsd } = getBoard();
  const leader = entries[0];
  const priceForFirst = leader ? leader.totalUsd + BOARD.topSpotGapUsd : BOARD.minBidUsd;

  return (
    <>
      {/*
        The hero is a price tag, not a slogan. The first thing anyone sees —
        including in a screenshot — is what #1 costs right now.
      */}
      <section className="tape border-b border-line px-3 pt-5 pb-4 sm:px-4 sm:pt-7 sm:pb-6">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-2 uppercase">
          Claim #1 for
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="num text-[40px] leading-none font-bold tracking-tight text-gold sm:text-6xl">
            {usd(priceForFirst)}
          </span>
          <Link
            href="/bid?rank=1"
            className="rounded-[4px] bg-accent px-3 py-1.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Outbid the board
          </Link>
        </div>
        <p className="mt-2.5 max-w-lg text-[12.5px] leading-snug text-muted sm:text-sm">
          Entries start at {usd(BOARD.minBidUsd)}. Pay less than #1 and you still land on the board,
          at whatever rank your total buys. Every chain competes in one list.
        </p>
      </section>

      <section className="flex items-center justify-between border-b border-line px-3 py-2 text-[11px] text-muted-2 sm:px-4">
        <span className="num">
          {entries.length} tokens · {usdCompact(potUsd)} bid to date
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-up" />
          Ranked by total paid
        </span>
      </section>

      <ol>
        {entries.map((entry) => (
          <BoardRow key={entry.id} entry={entry} now={now} />
        ))}
      </ol>

      <div className="px-3 py-6 text-center sm:px-4">
        <Link
          href="/bid"
          className="inline-block rounded-[4px] border border-line-bright px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Put a token on the board
        </Link>
        <p className="mt-2 text-[11px] text-muted-2">
          Already listed? Bidding again on the same contract adds to its total.
        </p>
      </div>
    </>
  );
}
