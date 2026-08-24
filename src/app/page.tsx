import type { Metadata } from "next";
import Link from "next/link";
import { ActivityPanels } from "@/components/ActivityPanels";
import { BoardRow } from "@/components/BoardRow";
import { visitorsSinceLaunch } from "@/lib/stats";
import { Heartbeat } from "@/components/Heartbeat";
import { HeroSearch } from "@/components/HeroSearch";
import { BOARD } from "@/lib/config";
import { priceToClaimRank } from "@/lib/ranking";
import { usd, usdCompact } from "@/lib/format";
import { SHARE_PARAM } from "@/lib/share";
import { getBoard, listRanked } from "@/lib/store";

// Mock data mutates in memory, so never cache this route.
export const dynamic = "force-dynamic";

/**
 * A link that names a row previews as that row.
 *
 * This is why the share button can point at the board instead of a page of its
 * own: the URL is still bidoor.lol, and the card in the tweet is the sharer's
 * own rank. An unknown or delisted id falls through to the site-wide card
 * rather than erroring — a bad link should still preview as the product.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const raw = (await searchParams)[SHARE_PARAM];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return {};

  const entry = (await listRanked()).find((candidate) => candidate.id === id);
  if (!entry) return {};

  const title = `${entry.name} is #${entry.rank} on bidoor.lol`;
  const description = `${entry.ticker} has ${usd(entry.totalUsd)} paid on it. Taking #${entry.rank} costs ${usd(entry.priceToClaim)}.`;

  return {
    title,
    description,
    openGraph: { title, description, images: [`/og/${entry.id}`] },
    twitter: { card: "summary_large_image", title, description, images: [`/og/${entry.id}`] },
  };
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; [key: string]: string | string[] | undefined }>;
}) {
  const { show, [SHARE_PARAM]: sharedParam } = await searchParams;
  const shared = Array.isArray(sharedParam) ? sharedParam[0] : sharedParam;
  const { entries: allEntries, now, potUsd } = await getBoard();

  // Top 50, then more on request. Server-rendered, so the board still works
  // without JavaScript and a shared link to "?show=100" shows what it says.
  const requested = Number(show);
  const asked = Number.isFinite(requested)
    ? Math.min(Math.max(requested, BOARD.pageSize), allEntries.length)
    : BOARD.pageSize;

  // A shared link has to land on its row even when that row is past the first
  // page. Without this the anchor points at nothing and the tweet sends people
  // to a board that does not visibly contain the token it was about.
  const sharedIndex = shared ? allEntries.findIndex((entry) => entry.id === shared) : -1;
  const visible = sharedIndex >= 0 ? Math.max(asked, sharedIndex + 1) : asked;
  const entries = allEntries.slice(0, visible);
  const remaining = allEntries.length - entries.length;
  const leader = allEntries[0];
  const priceForFirst = leader ? priceToClaimRank(leader.totalUsd) : BOARD.minBidUsd;

  const visitors = await visitorsSinceLaunch();
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="shell pt-4 pb-2 sm:pt-10 lg:pt-14">
      {/* Social proof first, and the live number is the strongest thing we
          have: it answers "does anyone actually look at this?", which is the
          only real objection before paying. The board's own totals are true but
          static, so they trade places and take the quieter line below. */}
      <div className="flex justify-center">
        <Heartbeat initialVisitors={visitors} />
      </div>

      {/* The hero is a price tag, not a slogan: the biggest thing on the page is
          what #1 costs right now. */}
      <section className="section-gap text-center">
        {/* Deliberately NOT the mono face: at this size Geist Mono's wide comma
            advance renders "$8,755" as "$8 , 755". Tabular figures still keep
            the number from reflowing as the board updates. */}
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-balance tabular-nums sm:text-6xl">
          Claim <span className="money-fill">#1</span> for{" "}<span className="headline-amount">{usd(priceForFirst)}</span>
        </h1>
        <p className="mx-auto mt-2.5 max-w-xl text-xs leading-relaxed text-muted text-balance sm:mt-3 sm:text-sm">
          <span className="money-fill font-bold">New listings start at {usd(BOARD.minBidUsd)}.</span> Paying
          less than #1 still puts you on the board, at whatever rank your total buys. Every chain in
          one list, every bidoor in the same queue.
        </p>

        <div className="mx-auto max-w-xl">
          <HeroSearch />
          <p className="money mt-3 text-center text-2xs text-faint sm:text-xs">
            {allEntries.length} tokens on the board
            <span aria-hidden> · </span>
            {usdCompact(potUsd)} bid to date
          </p>
          {/* Dropped on phones. The presence banner now renders from one person
              online, and those 29px came out of the 20px of slack the top-three
              requirement had left: something above the board had to go, and this
              line is the only one restated elsewhere — the bid form says it when
              you paste an address already listed, and Rules states it outright. */}
          <p className="mt-2 hidden text-2xs text-faint sm:block sm:text-xs">
            Already on the board? Bidding on the same contract adds to its total. It never creates
            a second row.
          </p>
        </div>
      </section>

      {/* The podium comes straight after the hero on every screen now. It is the
          thing the page is selling, and it used to open below a pair of modules
          on desktop and below the whole board on phones. */}
      <ol className="section-gap flex flex-col" style={{ gap: "var(--bd-podium-gap)" }}>
        {podium.map((entry) => (
          <BoardRow key={entry.id} entry={entry} now={now} highlighted={entry.id === shared} />
        ))}
      </ol>

      {/* One instance, between the podium and the rest, in the same place on
          every screen: it was two copies with opposite visibility before. It
          also does the job the "Top 3" rule used to do — the podium ends where
          the modules begin — so that divider is gone rather than restated. */}
      <div className="section-gap mb-5">
        <ActivityPanels entries={allEntries} now={now} />
      </div>

      <ol>
        {rest.map((entry) => (
          <BoardRow key={entry.id} entry={entry} now={now} highlighted={entry.id === shared} />
        ))}
      </ol>

      {remaining > 0 && (
        <div className="mt-5 text-center">
          <Link
            href={`/?show=${visible + BOARD.pageSize}`}
            scroll={false}
            className="inline-block rounded-pill border border-line-strong px-4 py-2 text-sm text-muted transition-colors hover:border-text hover:text-text"
          >
            Show more · {remaining} left
          </Link>
        </div>
      )}

    </div>
  );
}
