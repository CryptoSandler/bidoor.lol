/**
 * The short handle in a shared link: bidoor.lol/t/ansem.
 *
 * The first version of sharing pointed at /?t=<uuid>#row-<uuid>, which is about
 * a hundred characters, two of them the same UUID, and it filled the X composer
 * with noise before the sharer had typed anything.
 *
 * A ticker is what a community already calls itself, so it is the first choice.
 * Tickers are not unique — anyone can deploy a second $PEPE — so this returns an
 * ordered list of candidates and the caller takes the first one the database
 * will accept. Whoever lists first keeps the bare ticker; the next one carries a
 * suffix. That is first-come, which is the same rule the board itself runs on.
 */

/** Kept short enough to read and long enough not to collide by accident. */
const SUFFIX_LENGTH = 6;
const MAX_TICKER_LENGTH = 20;

/** Reserved by routes and by the shape of the URL space, never handed to a token. */
const RESERVED = new Set(["t", "og", "api", "bid", "go", "admin", "rules", "stats", "new"]);

/** The stable part of an entry id: `entry_<uuid>` -> the first hex of the uuid. */
function shortId(id: string): string {
  const hex = id.replace(/^entry_/, "").replace(/-/g, "");
  return hex.slice(0, SUFFIX_LENGTH).toLowerCase();
}

/**
 * Slug candidates for a token, best first. The caller writes the first one that
 * is free; the last is derived from the entry id, so it always exists and is
 * always unique.
 */
export function slugCandidates(ticker: string, id: string): string[] {
  const base = ticker
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, MAX_TICKER_LENGTH);
  const suffix = shortId(id);

  // A ticker that is only punctuation, or that collides with a route, never
  // gets to be the bare slug.
  if (!base || RESERVED.has(base)) return [suffix];
  return [base, `${base}-${suffix}`, suffix];
}

/** True when a string could be a slug we issued. Cheap guard before a lookup. */
export function isSlugShaped(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,29})$/.test(value);
}
