import { NextResponse } from "next/server";
import {
  authenticateAdmin,
  checkStepUp,
  recordAdminAction,
  stepUpConfigured,
} from "@/lib/admin";
import { clientIp, hashIp } from "@/lib/payments/limits";
import { delistEntry } from "@/lib/store";

/**
 * Removes an entry from the board. Nothing is deleted: the delisting is
 * recorded, the payments stay, and the board rebuild simply stops counting bids
 * from before it. Money is not returned — bids are non-refundable, and a
 * delisting is a consequence, not a cancelled order.
 */
export async function POST(request: Request) {
  const admin = await authenticateAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: "Not authorised." }, { status: 401 });
  }

  const body = (await request.json()) as {
    contractKey?: string;
    reason?: string;
    stepUp?: string;
  };

  // Destructive, so it can be put behind a second secret. Optional by design:
  // unset, this is a no-op and nothing changes for a single-operator setup.
  if (stepUpConfigured() && !checkStepUp(String(body.stepUp ?? ""))) {
    return NextResponse.json(
      { ok: false, message: "This action needs the step-up secret." },
      { status: 403 },
    );
  }
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

  const delisting = await delistEntry(contractKey, reason);
  if (!delisting) {
    return NextResponse.json(
      { ok: false, message: "No live entry with that contract." },
      { status: 404 },
    );
  }

  const identity = clientIp(request);
  await recordAdminAction({
    actor: admin.label,
    action: "entry.delist",
    targetType: "entry",
    targetId: contractKey,
    details: { reason },
    ipHash: identity.ok ? hashIp(identity.ip) : null,
  });

  return NextResponse.json({ ok: true, removed: true, delistedAt: delisting.delistedAt });
}
