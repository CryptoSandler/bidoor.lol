import { NextResponse } from "next/server";
import { SHARE_PARAM, rowAnchor } from "@/lib/share";
import { isSlugShaped } from "@/lib/slug";
import { findBySlug } from "@/lib/store";

/**
 * The short link a share produces: bidoor.lol/t/ansem.
 *
 * It bounces to the board with the row named and anchored. Two reasons it is a
 * path rather than the query parameter the first version used. A hundred
 * characters of UUID filled the X composer before the sharer had typed
 * anything; and `t` is one of X's own tracking parameters, which is the best
 * explanation we have for a shared link unfurling as the generic card — the
 * board's own metadata is correct and serves the token card to Twitterbot when
 * the parameter survives. A path cannot be stripped, and it is a URL X has
 * never cached.
 *
 * An unknown slug goes to the board rather than a 404: a link that was posted
 * somewhere should always land on the product, and a delisted token is exactly
 * the case where the row is gone but the tweet is not.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // 302 rather than Next's own 307: a share link is temporary by nature and
  // nothing about it should be cached by an intermediary or a scraper.
  const board = (to: string) => NextResponse.redirect(new URL(to, request.url), 302);

  if (!isSlugShaped(slug)) return board("/");

  const entry = await findBySlug(slug);
  if (!entry) return board("/");

  return board(`/?${SHARE_PARAM}=${entry.id}#${rowAnchor(entry.id)}`);
}
