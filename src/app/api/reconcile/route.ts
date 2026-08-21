import { NextResponse } from "next/server";
import { adminConfigured, authenticateAdmin, recordAdminAction } from "@/lib/admin";
import { reconcileSettledPayments } from "@/lib/payments/reconcile";

/**
 * Called by an external scheduler. Retries payments that settled but whose
 * entry never made it onto the board — the DexScreener-was-down case.
 *
 * Safe to call as often as the host allows: the work list is derived from
 * state, so a run with nothing to do does nothing.
 */
export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Reconcile is not configured (ADMIN_TOKEN is unset)." },
      { status: 503 },
    );
  }
  const admin = await authenticateAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: "Not authorised." }, { status: 401 });
  }

  const outcome = await reconcileSettledPayments();

  // Only worth a trail when it actually did something; a cron that runs every
  // minute and finds nothing would otherwise bury the log.
  if (outcome.applied.length > 0 || outcome.failed.length > 0) {
    await recordAdminAction({
      actor: admin.label,
      action: "payments.reconcile",
      details: { applied: outcome.applied, failed: outcome.failed },
    });
  }

  return NextResponse.json({ ok: true, ...outcome });
}
