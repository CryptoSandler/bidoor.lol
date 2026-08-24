import { ImageResponse } from "next/og";
import { usd } from "@/lib/format";
import { OG_SIZE, OgGeneric, OgToken } from "@/lib/og";
import { listRanked } from "@/lib/store";

/**
 * The link preview for one row.
 *
 * When a community shares its own position, the card in the tweet should be its
 * rank rather than our generic pitch — that is the whole point of the share
 * button on the row. The home page points here through generateMetadata when
 * the URL names a token.
 *
 * An image endpoint, not a page: the shared URL is still the board.
 *
 * Rank is read at request time and never baked in. A card that keeps claiming
 * #1 after the row has been outbid would be a lie with our name on it, so the
 * cache is short and the number is whatever the board says when the scraper
 * asks.
 */
export const contentType = "image/png";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const entry = (await listRanked()).find((candidate) => candidate.id === id);

  // No such row, or nothing to draw it with. The generic card is the fallback
  // in both cases: it says something true about the product, which beats a
  // half-empty card about a token or a broken image in the tweet.
  const card =
    entry && entry.logoUrl ? (
      <OgToken
        name={entry.name}
        ticker={entry.ticker}
        logoUrl={entry.logoUrl}
        rank={entry.rank}
        totalUsd={usd(entry.totalUsd)}
        priceToClaim={usd(entry.priceToClaim)}
      />
    ) : (
      <OgGeneric />
    );

  return new ImageResponse(card, {
    ...OG_SIZE,
    headers: {
      // Long enough that a burst of shares does not re-render it per scrape,
      // short enough that the rank on the card is not stale for long.
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
