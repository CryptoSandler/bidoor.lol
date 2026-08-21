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

  // Frozen at creation. Deliberately NOT recomputed from the entry's current
  // links: the token's deployer controls those, and following them would let a
  // listed row be repointed after the fact.
  const target = entry?.clickUrl ?? null;
  if (!target) return NextResponse.redirect(new URL("/", request.url));

  return NextResponse.redirect(target, {
    headers: { "Referrer-Policy": "no-referrer" },
  });
}
