import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminConfigured,
  checkAdminLoginGate,
  createAdminSession,
  identifyToken,
  recordAdminAction,
  recordLoginAttempt,
  resolveAdminSession,
  revokeAdminSession,
} from "@/lib/admin";
import { clientIp, hashIp } from "@/lib/payments/limits";

/**
 * Establishes an admin session.
 *
 * The cookie that comes out of here holds a session id, never the token: a
 * leaked cookie is then something to revoke rather than a secret to rotate
 * across every deployment.
 */
export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Admin access is not configured (ADMIN_TOKEN is unset)." },
      { status: 503 },
    );
  }

  const identity = clientIp(request);
  const ipHash = hashIp(identity.ok ? identity.ip : "unknown");

  const gate = await checkAdminLoginGate(ipHash);
  if (!gate.ok) {
    return NextResponse.redirect(new URL("/admin?error=locked", request.url), {
      status: 303,
      headers: { "Retry-After": String(gate.retryAfterSeconds) },
    });
  }

  const form = await request.formData();
  const label = identifyToken(String(form.get("token") ?? ""));

  await recordLoginAttempt(ipHash, label, label !== null);

  if (!label) {
    return NextResponse.redirect(new URL("/admin?error=1", request.url), { status: 303 });
  }

  const session = await createAdminSession(label, ipHash);
  await recordAdminAction({ actor: label, action: "admin.sign_in", ipHash });

  const response = NextResponse.redirect(new URL("/admin", request.url), { status: 303 });
  response.cookies.set(ADMIN_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "strict",
    // Always secure except on plain-HTTP localhost, so a staging deploy that
    // forgot to set NODE_ENV does not ship the session over the wire in clear.
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}

/** Signs out: revokes the session server-side, not just in the browser. */
export async function DELETE(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);

  if (cookie) {
    const id = decodeURIComponent(cookie);
    const session = await resolveAdminSession(id);
    await revokeAdminSession(id);
    if (session) {
      await recordAdminAction({ actor: session.label, action: "admin.sign_out" });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
