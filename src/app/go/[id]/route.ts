import { NextResponse } from "next/server";
import { registerClick } from "@/lib/store";

/**
 * Outbound click handler. Counts the click and sends the visitor to the stored
 * launchpad URL — which was already stripped of query parameters on submission,
 * so nobody's referral or tracking tag rides along.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = registerClick(id);
  if (!entry) return NextResponse.redirect(new URL("/", request.url));

  return NextResponse.redirect(entry.launchpadUrl, {
    headers: { "Referrer-Policy": "no-referrer" },
  });
}
