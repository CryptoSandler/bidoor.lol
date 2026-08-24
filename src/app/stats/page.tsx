import type { Metadata } from "next";
import Link from "next/link";
import { listRanked } from "@/lib/store";
import { onlineNow, visitorsSinceLaunch } from "@/lib/stats";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stats · bidoor.lol",
  description: "What the board has taken and how many people are looking at it.",
};

/**
 * Everything here is a total. Nothing on this page is per-user, per-visit or
 * per-address, because nothing per-user is collected in the first place — the
 * presence id dies on reload and the visitor row is a salted hash.
 */
export default async function StatsPage() {
  const entries = await listRanked();
  const [online, visitors] = await Promise.all([onlineNow(), visitorsSinceLaunch()]);

  const bidCount = entries.reduce((n, e) => n + e.bids.length, 0);
  const potUsd = entries.reduce((n, e) => n + e.totalUsd, 0);
  const clicks = entries.reduce((n, e) => n + e.clicks, 0);

  const cells: [string, string, string][] = [
    ["Online right now", online.toLocaleString("en-US"), "Tabs open in the last two and a half minutes."],
    ["Visitors since launch", visitors.toLocaleString("en-US"), "Counted once per caller per day, never per pageview."],
    ["Tokens on the board", entries.length.toLocaleString("en-US"), "Live entries. Delisted rows are not counted."],
    ["Bids paid", bidCount.toLocaleString("en-US"), "Every settled payment, including top-ups."],
    ["Paid in total", usd(potUsd), "The sum of every live entry's total."],
    ["Clicks sent out", clicks.toLocaleString("en-US"), "Outbound clicks the board has sent to tokens."],
  ];

  return (
    <div className="shell pt-6 pb-10 sm:pt-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Stats</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        Totals only. There is no per-user data on this page because there is none in the database:
        presence is an id that dies when you reload, and a visitor is a salted hash that expires.
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {cells.map(([label, value, note]) => (
          <div key={label} className="rounded-card border border-line bg-surface shadow-card px-4 py-3.5">
            <dt className="text-2xs font-bold tracking-widest text-faint uppercase">{label}</dt>
            <dd className="money mt-1 text-2xl font-bold">{value}</dd>
            <dd className="mt-1 text-xs leading-snug text-muted">{note}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 text-xs text-faint">
        <Link href="/" className="underline hover:text-text">
          Back to the board
        </Link>
      </p>
    </div>
  );
}
