import Link from "next/link";
import { ChainBadge } from "./ChainBadge";
import { TokenMark } from "./TokenMark";
import { compactCount, timeAgo, usd, usdCompact } from "@/lib/format";
import type { RankedEntry } from "@/lib/types";

/**
 * One row of the board. Kept to a fixed two-line shape on mobile so the top
 * three always clear the fold on a phone — the whole product gets shared as a
 * screenshot, and a top three that needs scrolling is a top three nobody posts.
 */
export function BoardRow({ entry, now }: { entry: RankedEntry; now: number }) {
  const isLeader = entry.rank === 1;
  const isPodium = entry.rank <= 3;
  // A thin coloured edge on the podium: enough to read the top three at a glance
  // in a screenshot, not enough to turn the board into a medal ceremony.
  const edge = isLeader ? "var(--gold)" : entry.rank === 2 ? "#9aa4b2" : entry.rank === 3 ? "#b0794a" : null;

  return (
    <li
      className="relative flex items-center gap-2.5 border-b border-line px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3"
      style={isLeader ? { background: "linear-gradient(90deg, var(--gold-soft), transparent 60%)" } : undefined}
    >
      {edge && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px]" style={{ background: edge }} />}

      <span
        className={`num w-6 shrink-0 text-right text-[13px] font-semibold tabular-nums sm:w-9 sm:text-base ${
          isLeader ? "text-gold" : isPodium ? "text-text" : "text-muted-2"
        }`}
      >
        {entry.rank}
      </span>

      <TokenMark name={entry.name} contract={entry.contract} logoUrl={entry.logoUrl} size={isPodium ? 40 : 34} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <a
            href={`/go/${entry.id}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="truncate text-[15px] leading-tight font-semibold hover:text-accent sm:text-base"
          >
            {entry.name}
          </a>
          <span className="num shrink-0 text-[11px] text-muted-2 sm:text-xs">{entry.ticker}</span>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-2 sm:text-xs">
          <ChainBadge chainId={entry.chainId} />
          <span className="num truncate">{compactCount(entry.clicks)} clicks</span>
          <span aria-hidden className="text-line-bright">·</span>
          <span className="num truncate">{timeAgo(entry.lastBidAt, now)}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`num text-[15px] leading-none font-bold sm:text-lg ${isLeader ? "text-gold" : "text-text"}`}
          title={usd(entry.totalUsd)}
        >
          {usdCompact(entry.totalUsd)}
        </span>
        <Link
          href={`/bid?rank=${entry.rank}`}
          className="rounded-[3px] border border-line-bright px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-muted transition-colors hover:border-accent hover:text-accent sm:px-2 sm:py-1 sm:text-[11px]"
        >
          Take #{entry.rank} · {usdCompact(entry.priceToClaim)}
        </Link>
      </div>
    </li>
  );
}
