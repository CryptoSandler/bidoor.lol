import { createHash } from "node:crypto";
import { RATE_LIMITS, rateLimitSalt } from "./config";
import { db } from "./db";
import { expireStalePendingBids } from "./pending";

/**
 * Rate limiting on pending-bid creation.
 *
 * Every check sweeps expired bids first. That matters more than it looks: an
 * attacker who fills a limit must not be able to hold it past the expiry window,
 * and both the allow and the deny path go through the same sweep — so a blocked
 * caller unblocks itself simply by waiting, with no cleanup job involved.
 */

export type LimitReason = "too_many_live" | "too_many_recent" | "amount_saturated";

export type LimitDecision =
  | { ok: true }
  | { ok: false; reason: LimitReason; message: string; retryAt: string };

/** Raw IPs are never stored. This is only ever used as a counting key. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${rateLimitSalt()}:${ip}`).digest("hex");
}

/**
 * Best-effort caller identity. Behind a proxy the left-most entry of
 * x-forwarded-for is the client; with no proxy headers at all we fall back to a
 * shared bucket, which is deliberately strict rather than permissive.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function soonestExpiry(rows: { expires_at: string }[]): string {
  const earliest = rows
    .map((row) => Date.parse(row.expires_at))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b)[0];
  return earliest ? new Date(earliest).toISOString() : minutesFromNow(1);
}

function humanDelay(retryAt: string): string {
  const minutes = Math.max(1, Math.ceil((Date.parse(retryAt) - Date.now()) / 60_000));
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

export function checkBidCreationLimits(ipHash: string, amountUsd: number): LimitDecision {
  // Always first, on every path: a caller that hit a limit must be released by
  // expiry alone.
  expireStalePendingBids();

  const database = db();

  const live = database
    .prepare(
      `SELECT expires_at FROM pending_bids WHERE ip_hash = ? AND status = 'pending'`,
    )
    .all(ipHash) as { expires_at: string }[];

  if (live.length >= RATE_LIMITS.livePendingPerIp) {
    const retryAt = soonestExpiry(live);
    return {
      ok: false,
      reason: "too_many_live",
      retryAt,
      message: `You already have ${RATE_LIMITS.livePendingPerIp} bids waiting for payment. Pay one, or wait ${humanDelay(retryAt)} for the oldest to expire.`,
    };
  }

  const since = new Date(Date.now() - RATE_LIMITS.windowMinutes * 60_000).toISOString();
  const recent = database
    .prepare(
      `SELECT created_at FROM pending_bids WHERE ip_hash = ? AND created_at > ? ORDER BY created_at ASC`,
    )
    .all(ipHash, since) as { created_at: string }[];

  if (recent.length >= RATE_LIMITS.createdPerIpPerWindow) {
    // The window frees up when the oldest bid in it falls out.
    const retryAt = new Date(
      Date.parse(recent[0].created_at) + RATE_LIMITS.windowMinutes * 60_000,
    ).toISOString();
    return {
      ok: false,
      reason: "too_many_recent",
      retryAt,
      message: `You have started ${RATE_LIMITS.createdPerIpPerWindow} bids in the last ${RATE_LIMITS.windowMinutes} minutes. Try again in ${humanDelay(retryAt)}.`,
    };
  }

  const sharing = database
    .prepare(
      `SELECT expires_at FROM pending_bids WHERE amount_usd = ? AND status = 'pending'`,
    )
    .all(amountUsd) as { expires_at: string }[];

  if (sharing.length >= RATE_LIMITS.livePendingPerAmount) {
    // Every pending bid at one amount holds one of that amount's fractions.
    // Stopping well short of the 9,999 available keeps allocation fast and keeps
    // the space from ever being cornered.
    const retryAt = soonestExpiry(sharing);
    return {
      ok: false,
      reason: "amount_saturated",
      retryAt,
      message: `Too many bids of exactly $${amountUsd} are waiting for payment right now. Bid a different amount, or try again in ${humanDelay(retryAt)}.`,
    };
  }

  return { ok: true };
}
