import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { delistEntry } from "@/lib/payments/pending";
import { removeEntryFromBoard } from "@/lib/store";

/**
 * Removes an entry from the board. Nothing is deleted: the delisting is
 * recorded, the payments stay, and the board rebuild simply stops counting bids
 * from before it. Money is not returned — bids are non-refundable, and a
 * delisting is a consequence, not a cancelled order.
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, message: "Not authorised." }, { status: 401 });
  }

  const body = (await request.json()) as { contractKey?: string; reason?: string };
  const contractKey = (body.contractKey ?? "").trim();
  const reason = (body.reason ?? "").trim();

  if (!contractKey) {
    return NextResponse.json({ ok: false, message: "Which entry?" }, { status: 422 });
  }
  if (!reason) {
    return NextResponse.json(
      { ok: false, message: "A reason is required to delist an entry." },
      { status: 422 },
    );
  }

  const delisting = delistEntry(contractKey, reason);
  const removed = removeEntryFromBoard(contractKey);

  return NextResponse.json({ ok: true, removed, delistedAt: delisting.delistedAt });
}
