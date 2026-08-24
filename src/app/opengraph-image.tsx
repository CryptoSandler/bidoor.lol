import { ImageResponse } from "next/og";
import { OG_SIZE, OgGeneric } from "@/lib/og";

/**
 * The site-wide link preview. The product is shared as a link at least as often
 * as a screenshot, and an empty preview card wastes that.
 *
 * A shared row gets its own card instead — see app/og/[id]/route.tsx, which the
 * home page points at when the URL names a token.
 */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "bidoor.lol · pay-to-rank token leaderboard";

export default function OpengraphImage() {
  return new ImageResponse(<OgGeneric />, size);
}
