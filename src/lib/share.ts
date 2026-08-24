/**
 * The share link on a row.
 *
 * A row is the unit people actually care about — their token, their position —
 * so sharing is per row rather than per site, and the text is written for them
 * to post as is. The claim price is in it on purpose: the tweet is an
 * invitation to be outbid, which is the part that makes it circulate.
 */

/** Where a shared row points: the board, with that row named and anchored. */
export const SHARE_PARAM = "t";

/** The row's anchor on the board, so a shared link lands on it. */
export function rowAnchor(id: string): string {
  return `row-${id}`;
}

/**
 * The board URL for one row. Relative when we have no site URL configured,
 * which is what local development is; the tweet intent needs an absolute one,
 * so callers pass the origin in.
 */
export function shareUrl(id: string, origin: string): string {
  const path = `/?${SHARE_PARAM}=${encodeURIComponent(id)}#${rowAnchor(id)}`;
  if (!origin) return path;
  return `${origin.replace(/\/+$/, "")}${path}`;
}

export function shareText(ticker: string, rank: number, priceToClaim: string): string {
  // The ticker carries the $ that trading posts use; the rest is plain.
  const tag = ticker.startsWith("$") ? ticker : `$${ticker}`;
  return `${tag} is #${rank} on bidoor.lol — take the spot for ${priceToClaim}`;
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
  id: string;
  origin: string;
}): string {
  const intent = new URL("https://x.com/intent/post");
  intent.searchParams.set("text", shareText(params.ticker, params.rank, params.priceToClaim));
  intent.searchParams.set("url", shareUrl(params.id, params.origin));
  return intent.toString();
}
