import { ChainBadge } from "./ChainBadge";
import { TokenMark } from "./TokenMark";
import { compactCount, timeAgo, usd } from "@/lib/format";
import type { RankedEntry } from "@/lib/types";

/**
 * The two secondary modules from the reference layout: what is getting clicked,
 * and what just got paid. Trending ranks by clicks rather than money on
 * purpose — the people paying want the top spot, the people reading want what
 * is interesting, and mixing those into one score would make neither legible.
 */
export function ActivityPanels({ entries, now }: { entries: RankedEntry[]; now: number }) {
  const trending = [...entries].sort((a, b) => b.clicks - a.clicks).slice(0, 5);

  const latest = entries
    .flatMap((entry) => entry.bids.map((bid) => ({ entry, bid })))
    .sort((a, b) => Date.parse(b.bid.createdAt) - Date.parse(a.bid.createdAt))
    .slice(0, 5);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Panel title="Trending right now" dotClass="bg-muted">
        {trending.map((entry) => (
          <Line key={entry.id}>
            <TokenMark name={entry.name} logoUrl={entry.logoUrl} size="1.25rem" />
            <span className="truncate font-medium">{entry.name}</span>
            <ChainBadge chainId={entry.chainId} />
            <span className="num ml-auto shrink-0 text-2xs text-faint">
              {compactCount(entry.clicks)} clicks
            </span>
          </Line>
        ))}
      </Panel>

      <Panel title="Latest activity" dotClass="bg-faint">
        {latest.map(({ entry, bid }) => (
          <Line key={bid.id}>
            <TokenMark name={entry.name} logoUrl={entry.logoUrl} size="1.25rem" />
            <span className="truncate font-medium">{entry.name}</span>
            <span className="money shrink-0 text-2xs font-bold">{usd(bid.amountUsd)}</span>
            <span className="num ml-auto shrink-0 text-2xs text-faint">
              {timeAgo(bid.createdAt, now)}
            </span>
          </Line>
        ))}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  dotClass,
  children,
}: {
  title: string;
  dotClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-surface px-3 py-2.5">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-pill ${dotClass}`} />
        {title}
      </h2>
      <ul className="mt-1">{children}</ul>
    </section>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 border-b border-line py-2 text-sm last:border-b-0 last:pb-0">
      {children}
    </li>
  );
}
