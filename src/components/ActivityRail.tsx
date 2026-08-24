import Link from "next/link";
import { TokenMark } from "./TokenMark";
import { timeAgoLong, usd } from "@/lib/format";
import { SHARE_PARAM, rowAnchor } from "@/lib/share";
import type { RankedEntry } from "@/lib/types";

/**
 * What just got paid, as a strip of chips between the podium and the rest.
 *
 * It was a vertical panel beside a "trending" one. Both were modules the board
 * had to be scrolled past, and trending was telling a story the board already
 * tells: the podium is what the money says, and every row carries its own click
 * count. One module, laid along the page instead of down it.
 *
 * Each chip names the rank the bid bought, because "$20 on Aura Farm Battles"
 * is a number without a stake and "at #1" is the thing being fought over.
 *
 * Chips scroll sideways when they do not fit, with no arrows: on a phone that
 * is the expected gesture, and on a pointer device the row simply runs to the
 * edge, which is its own invitation.
 */
export function ActivityRail({ entries, now }: { entries: RankedEntry[]; now: number }) {
  const latest = entries
    .flatMap((entry) => entry.bids.map((bid) => ({ entry, bid })))
    .sort((a, b) => Date.parse(b.bid.createdAt) - Date.parse(a.bid.createdAt))
    .slice(0, 8);

  if (latest.length === 0) return null;

  return (
    <section aria-labelledby="latest-activity">
      <h2
        id="latest-activity"
        className="flex items-center gap-2 text-2xs font-bold tracking-widest text-faint uppercase"
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-faint" />
        Latest activity
      </h2>

      {/* The scrollbar is hidden rather than styled: it would be the widest
          thing in a 44px strip. The chips are links, so the row is reachable by
          keyboard without it. */}
      <ul className="bd-rail mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
        {latest.map(({ entry, bid }) => (
          <li key={bid.id} className="shrink-0 snap-start">
            <Link
              href={`/?${SHARE_PARAM}=${entry.id}#${rowAnchor(entry.id)}`}
              className="flex items-center gap-2 rounded-pill border border-line bg-surface py-1.5 pr-3.5 pl-1.5 transition-colors hover:border-line-strong"
            >
              <TokenMark name={entry.name} logoUrl={entry.logoUrl} size="1.5rem" />
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="max-w-28 truncate text-xs font-bold text-text">{entry.name}</span>
                <span className="num text-2xs text-muted">
                  at #{entry.rank}
                  <span aria-hidden> · </span>
                  <span className="font-bold text-text">{usd(bid.amountUsd)}</span>
                </span>
                <span className="num text-2xs text-faint">{timeAgoLong(bid.createdAt, now)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
