import { NextResponse } from "next/server";
import { registerClick } from "@/lib/store";

/**
 * Outbound click handler. Counts the click and sends the visitor on, carrying
 * no referrer. Both possible targets were stripped of query parameters when
 * they were stored, so nobody's referral or tracking tag rides along.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = registerClick(id);

  // The launch link is optional, so fall back to the token's own site before
  // giving up on having anywhere to send the visitor.
  const target = entry?.launchpadUrl ?? entry?.links.website ?? null;
  if (!target) return NextResponse.redirect(new URL("/", request.url));

  return NextResponse.redirect(target, {
    headers: { "Referrer-Policy": "no-referrer" },
  });
}
