/**
 * The share link on a row.
 *
 * A row is the unit people actually care about — their token, their position —
 * so sharing is per row rather than per site, and the text is written for them
 * to post as is. The claim price is in it on purpose: the tweet is an
 * invitation to be outbid, which is the part that makes it circulate.
 */

/**
 * Where a shared row points once the short link has bounced.
 *
 * Named `token`, not `t`: `t` and `s` are X's own tracking parameters, and a
 * URL carrying one is liable to be normalised away — which is the best
 * explanation we have for a shared row unfurling as the generic card. `t` is
 * still read on the way in so links posted before this keep working.
 */
export const SHARE_PARAM = "token";
export const LEGACY_SHARE_PARAM = "t";

/** The row's anchor on the board, so a shared link lands on it. */
export function rowAnchor(id: string): string {
  return `row-${id}`;
}

/**
 * The URL a share posts: short, and a path rather than a query.
 *
 * It was /?t=<uuid>#row-<uuid>, about a hundred characters with the same UUID
 * in it twice, which is what the composer showed before the sharer had typed a
 * word. /t/<slug> is the canonical address of a token here.
 *
 * Relative when no site URL is configured, which is local development; the
 * intent needs an absolute one, so callers pass the origin in.
 */
export function shareUrl(slug: string, origin: string): string {
  const path = `/t/${encodeURIComponent(slug)}`;
  if (!origin) return path;
  return `${origin.replace(/\/+$/, "")}${path}`;
}

export function shareText(ticker: string, rank: number, priceToClaim: string): string {
  // The ticker carries the $ that trading posts use; the rest is plain. Two
  // sentences rather than one joined by a dash: the same rule the rest of the
  // copy follows, and this template had been missed by that sweep.
  const tag = ticker.startsWith("$") ? ticker : `$${ticker}`;
  return `${tag} is #${rank} on bidoor.lol. Take the spot for ${priceToClaim}.`;
}

/**
 * X's post intent. Text and URL go as separate parameters because X counts and
 * shortens the URL itself, and appending it to the text would have it counted
 * twice.
 */
export function tweetIntent(params: {
  ticker: string;
  rank: number;
  priceToClaim: string;
  slug: string;
  origin: string;
}): string {
  const intent = new URL("https://x.com/intent/post");
  intent.searchParams.set("text", shareText(params.ticker, params.rank, params.priceToClaim));
  intent.searchParams.set("url", shareUrl(params.slug, params.origin));
  return intent.toString();
}
