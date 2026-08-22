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
          ? // The whole podium is edged in slime, and the leader's left edge is
            // thicker still. This is decoration and never the only signal: on
            // cream the slime edge is 1.08 against the card, so it is carried by
            // hue rather than by luminance, and the podium is already a shadowed
            // card against flat rows before any colour is involved.
            `group flex items-center gap-3 rounded-card border border-accent-line bg-surface shadow-card sm:gap-4 ${
              isLeader ? "border-l-[5px]" : ""
            }`
          : "group flex items-center gap-3 border-b border-line sm:gap-4"
      }
      style={
        isPodium
          ? { padding: "var(--bd-podium-pad)" }
          : { paddingBlock: "var(--bd-row-pad-y)" }
      }
    >
      <span
        className={
          // All three podium pills are filled now, not just the leader's: the
          // podium is the part of the board that is for sale, so it is the part
          // that carries the accent. Rows below stay neutral.
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
          {/* An entry can have nowhere to send a click — the destination is
              fixed when the entry is created and never adopted later. Those rows
              render as plain text rather than a link that goes nowhere. */}
          {entry.clickUrl ? (
            <a
              href={`/go/${entry.id}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={`truncate font-bold hover:underline ${isPodium ? "text-base" : "text-sm sm:text-base"}`}
            >
              {entry.name}
            </a>
          ) : (
            <span className={`truncate font-bold ${isPodium ? "text-base" : "text-sm sm:text-base"}`}>
              {entry.name}
            </span>
          )}
          <span className="num shrink-0 text-2xs text-faint">{entry.ticker}</span>
          {entry.launchpadVerified && (
            <span
              className="shrink-0 text-2xs leading-none font-bold text-muted"
              title={`Verified launchpad — launched on ${entry.launchpadHost}`}
              aria-label={`Verified launchpad: ${entry.launchpadHost}`}
            >
              ✓
            </span>
          )}
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
          // The podium's three totals are filled; everything below stays
          // ordinary type carrying weight. Filled rather than coloured even
          // here, because slime type on cream is 1.17 and would not be readable
          // — the ink is what carries the contrast, at 15.76.
          //
          // On a pointer device it steps aside on hover so the claim price can
          // take its place. The row swaps one number for another rather than
          // growing a second one, which is also why hovering never adds an
          // extra patch of slime to the page.
          className={`money font-bold sm:group-hover:hidden ${isPodium ? "money-fill" : ""} ${
            isLeader ? "text-xl" : isPodium ? "text-lg" : "text-base"
          }`}
          title={usd(entry.totalUsd)}
        >
          {usdCompact(entry.totalUsd)}
        </span>

        {/* What it costs to take this spot — the occupant's total plus the
            increment, never the total itself. Hidden until hover on a pointer
            device; on a phone there is no hover, so it simply stays. */}
        <Link
          href={`/bid?rank=${entry.rank}`}
          title={`Claim #${entry.rank} for ${usd(entry.priceToClaim)} — you bid on your own token`}
          className={`money hidden whitespace-nowrap sm:group-hover:inline-flex ${
            isLeader ? "sm:text-xl" : isPodium ? "sm:text-lg" : "sm:text-base"
          } items-center rounded-sm bg-accent px-1.5 font-bold text-accent-ink`}
        >
          <span className="hidden sm:inline">Claim #{entry.rank} for&nbsp;</span>
          {usdCompact(entry.priceToClaim)}
        </Link>

        {/* The phone version: always visible, and quieter, because there is no
            hover to reveal it and it must not shout over the total. */}
        <Link
          href={`/bid?rank=${entry.rank}`}
          className="money rounded-pill border border-line-strong px-2 py-0.5 text-2xs whitespace-nowrap text-muted sm:hidden"
        >
          <span aria-hidden>↑ </span>
          {usdCompact(entry.priceToClaim)}
        </Link>
      </div>
    </li>
  );
}
