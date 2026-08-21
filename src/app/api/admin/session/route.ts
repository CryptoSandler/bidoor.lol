import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkToken } from "@/lib/admin";
import { adminToken } from "@/lib/payments/config";

export async function POST(request: Request) {
  if (!adminToken()) {
    return NextResponse.json(
      { ok: false, message: "Admin access is not configured (ADMIN_TOKEN is unset)." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const token = String(form.get("token") ?? "");

  if (!checkToken(token)) {
    return NextResponse.redirect(new URL("/admin?error=1", request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/admin", request.url), { status: 303 });
  // The token never appears in a URL, so it stays out of history and referrers.
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true });
  void request;
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
