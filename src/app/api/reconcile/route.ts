import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { adminToken } from "@/lib/payments/config";
import { reconcileSettledPayments } from "@/lib/payments/reconcile";

/**
 * Called by an external scheduler. Retries payments that settled but whose
 * entry never made it onto the board — the DexScreener-was-down case.
 *
 * Safe to call as often as the host allows: the work list is derived from
 * state, so a run with nothing to do does nothing.
 */
export async function POST(request: Request) {
  if (!adminToken()) {
    return NextResponse.json(
      { ok: false, message: "Reconcile is not configured (ADMIN_TOKEN is unset)." },
      { status: 503 },
    );
  }
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false, message: "Not authorised." }, { status: 401 });
  }

  const outcome = await reconcileSettledPayments();
  return NextResponse.json({ ok: true, ...outcome });
}
