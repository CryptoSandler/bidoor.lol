import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { adminToken } from "./payments/config";

/**
 * Admin access. One shared secret from the environment, with no default — an
 * admin console that falls back to a known token is worse than no console.
 */
export const ADMIN_COOKIE = "bidoor_admin";

export function checkToken(candidate: string): boolean {
  const expected = adminToken();
  if (!expected) return false;

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  // Length is compared separately because timingSafeEqual throws on a mismatch.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** For server components. */
export async function isAdminSession(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;
  return value ? checkToken(value) : false;
}

/**
 * For route handlers. Accepts the session cookie or an explicit header, so the
 * same secret drives both the console and an external cron caller.
 */
export function isAdminRequest(request: Request): boolean {
  const header =
    request.headers.get("x-admin-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  if (header && checkToken(header)) return true;

  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);

  return cookie ? checkToken(decodeURIComponent(cookie)) : false;
}
