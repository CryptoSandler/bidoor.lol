import Link from "next/link";
import { ChainBadge } from "./ChainBadge";
import { TokenMark } from "./TokenMark";
import { compactCount, timeAgo, usd, usdCompact } from "@/lib/format";
import type { RankedEntry } from "@/lib/types";

/**
 * The board has two row treatments, and the contrast between them is the whole
 * design: the top three are tinted cards, everything below is a flat separated
 * row. That is what makes the podium read as a podium in a screenshot without
 * medals or confetti.
 */
export function BoardRow({ entry, now }: { entry: RankedEntry; now: number }) {
  const isPodium = entry.rank <= 3;
  const isLeader = entry.rank === 1;

  return (
    <li
      className={
        isPodium
          ? "flex items-center gap-3 rounded-card border border-accent-line bg-accent-tint sm:gap-4"
          : "flex items-center gap-3 border-b border-line sm:gap-4"
      }
      style={
        isPodium
          ? { padding: "var(--bd-podium-pad)" }
          : { paddingBlock: "var(--bd-row-pad-y)" }
      }
    >
      <span
        className={
          isPodium
            ? "num inline-flex shrink-0 items-center justify-center rounded-pill bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink"
            : "num w-7 shrink-0 text-center text-sm font-medium text-faint sm:w-8"
        }
      >
        {isPodium ? `#${entry.rank}` : entry.rank}
      </span>

      <TokenMark
        name={entry.name}
        logoUrl={entry.logoUrl}
        size={isPodium ? "var(--bd-podium-logo)" : "var(--bd-row-logo)"}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a
            href={`/go/${entry.id}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`truncate font-bold hover:text-accent ${isPodium ? "text-base" : "text-sm sm:text-base"}`}
          >
            {entry.name}
          </a>
          <span className="num shrink-0 text-2xs text-faint">{entry.ticker}</span>
        </div>

        {/* The chain badge lives on the meta line, not beside the name: on a
            narrow phone the badges were stealing the width and truncating
            names down to a single letter. */}
        <div className="num mt-1 flex items-center gap-1.5 text-2xs text-faint">
          <ChainBadge chainId={entry.chainId} />
          {/* On the narrowest phones the click count earns the space over the
              timestamp: it is the number a bidder is buying. */}
          <span className="hidden truncate sm:inline">{timeAgo(entry.lastBidAt, now)}</span>
          <span aria-hidden className="hidden sm:inline">·</span>
          <span className="truncate font-medium text-muted">
            {compactCount(entry.clicks)} clicks
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`money font-bold ${isLeader ? "text-gold" : "text-accent"} ${isPodium ? "text-lg" : "text-base"}`}
          title={usd(entry.totalUsd)}
        >
          {usdCompact(entry.totalUsd)}
        </span>
        <Link
          href={`/bid?rank=${entry.rank}`}
          className="money rounded-pill border border-line-strong px-2 py-0.5 text-2xs whitespace-nowrap text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <span className="hidden sm:inline">Take #{entry.rank} · </span>
          <span aria-hidden className="sm:hidden">↑ </span>
          {usdCompact(entry.priceToClaim)}
        </Link>
      </div>
    </li>
  );
}
