import Link from "next/link";
import { ActivityPanels } from "@/components/ActivityPanels";
import { BoardRow } from "@/components/BoardRow";
import { HeroSearch } from "@/components/HeroSearch";
import { BOARD } from "@/lib/config";
import { usd, usdCompact } from "@/lib/format";
import { getBoard } from "@/lib/store";

// Mock data mutates in memory, so never cache this route.
export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const { entries: allEntries, now, potUsd } = getBoard();

  // Top 50, then more on request. Server-rendered, so the board still works
  // without JavaScript and a shared link to "?show=100" shows what it says.
  const requested = Number(show);
  const visible = Number.isFinite(requested)
    ? Math.min(Math.max(requested, BOARD.pageSize), allEntries.length)
    : BOARD.pageSize;
  const entries = allEntries.slice(0, visible);
  const remaining = allEntries.length - entries.length;
  const leader = allEntries[0];
  const priceForFirst = leader ? leader.totalUsd + BOARD.topSpotGapUsd : BOARD.minBidUsd;

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="shell pt-4 pb-2 sm:pt-8">
      {/* Social proof first: it answers "does anyone actually look at this?",
          which is the only real objection before paying. */}
      <div className="flex justify-center">
        <p className="money inline-flex items-center gap-2 rounded-pill bg-surface-2 px-3.5 py-1.5 text-xs text-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-positive" />
          {allEntries.length} tokens on the board
          <span aria-hidden>·</span>
          {usdCompact(potUsd)} bid to date
        </p>
      </div>

      {/* The hero is a price tag, not a slogan: the biggest thing on the page is
          what #1 costs right now. */}
      <section className="mt-4 text-center sm:mt-7">
        {/* Deliberately NOT the mono face: at this size Geist Mono's wide comma
            advance renders "$8,755" as "$8 , 755". Tabular figures still keep
            the number from reflowing as the board updates. */}
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-balance tabular-nums sm:text-6xl">
          Claim #1 for <span className="text-accent">{usd(priceForFirst)}</span>
        </h1>
        <p className="mx-auto mt-2.5 max-w-xl text-xs leading-relaxed text-muted text-balance sm:mt-3 sm:text-sm">
          <span className="text-accent">New listings start at {usd(BOARD.minBidUsd)}.</span> Paying
          less than #1 still puts you on the board, at whatever rank your total buys. Every chain in
          one list, every bidoor in the same queue.
        </p>

        <div className="mx-auto max-w-xl">
          <HeroSearch />
          <p className="mt-2 text-2xs text-faint sm:text-xs">
            Already on the board? Bidding on the same contract adds to its total — it never creates
            a second row.
          </p>
        </div>
      </section>

      {/* Desktop keeps the reference's order: modules, then board. On phones they
          move below the board so the top three clear the fold. */}
      <div className="mt-7 hidden sm:block">
        <ActivityPanels entries={allEntries} now={now} />
      </div>

      <ol className="mt-5 flex flex-col sm:mt-6" style={{ gap: "var(--bd-podium-gap)" }}>
        {podium.map((entry) => (
          <BoardRow key={entry.id} entry={entry} now={now} />
        ))}
      </ol>

      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="rounded-pill border border-line px-2.5 py-0.5 text-2xs font-medium tracking-wide text-faint uppercase">
          Top 3
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <ol>
        {rest.map((entry) => (
          <BoardRow key={entry.id} entry={entry} now={now} />
        ))}
      </ol>

      {remaining > 0 && (
        <div className="mt-5 text-center">
          <Link
            href={`/?show=${visible + BOARD.pageSize}`}
            scroll={false}
            className="inline-block rounded-pill border border-line-strong px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Show more · {remaining} left
          </Link>
        </div>
      )}

      <div className="mt-7 sm:hidden">
        <ActivityPanels entries={allEntries} now={now} />
      </div>
    </div>
  );
}
