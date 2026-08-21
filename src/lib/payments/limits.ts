import { createHash } from "node:crypto";
import {
  RATE_LIMITS,
  VERIFY_LIMITS,
  allowUntrustedClientIp,
  rateLimitSalt,
  trustedProxyHops,
} from "./config";
import { query } from "../db";
import {
  countVerificationAttemptsForBid,
  countVerificationAttemptsForIp,
  expireStalePendingBids,
  lastVerificationAttemptForBid,
  pruneVerificationAttempts,
} from "./pending";

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
 * Headers a platform sets itself and a caller cannot forge, because the edge
 * overwrites them. Checked before x-forwarded-for, which is append-only and
 * therefore partly caller-controlled.
 */
const PLATFORM_IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-vercel-forwarded-for",
  "fly-client-ip",
] as const;

export type ClientIdentity =
  | { ok: true; ip: string; source: string }
  | { ok: false; reason: string };

/**
 * Caller identity, read from the right of x-forwarded-for rather than the left.
 *
 * Proxies APPEND to that header, so the left-most entry is whatever the caller
 * sent — reading it let anyone pick their own rate-limit bucket with a forged
 * header. The trustworthy entry is the one our own proxy appended, counted from
 * the right by how many hops sit in front of us.
 *
 * Fails closed. If no header can be trusted we return an error rather than a
 * shared bucket: a shared bucket for every anonymous caller is either an
 * unlimited allowance or a self-inflicted outage, and neither is a limit.
 */
export function clientIp(request: Request): ClientIdentity {
  for (const header of PLATFORM_IP_HEADERS) {
    const value = request.headers.get(header)?.split(",")[0]?.trim();
    if (value) return { ok: true, ip: value, source: header };
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = trustedProxyHops();
    const entries = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    // With one proxy in front, entries[len-1] is what that proxy appended: the
    // address it actually saw. Anything further left the caller could have
    // written. Too few entries means the header did not come through our proxy.
    const index = entries.length - hops;
    if (index >= 0 && entries[index]) {
      return { ok: true, ip: entries[index], source: `x-forwarded-for[-${hops}]` };
    }
    return {
      ok: false,
      reason: `x-forwarded-for has ${entries.length} entries but ${hops} trusted proxies are configured.`,
    };
  }

  if (allowUntrustedClientIp()) {
    return { ok: true, ip: "untrusted-local", source: "development" };
  }

  return {
    ok: false,
    reason:
      "No trusted client address. Set TRUSTED_PROXY_HOPS to match the deployment, or ALLOW_UNTRUSTED_CLIENT_IP=true for local development.",
  };
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function soonestExpiry(rows: { expires_at: Date }[]): string {
  const earliest = rows
    .map((row) => row.expires_at.getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b)[0];
  return earliest ? new Date(earliest).toISOString() : minutesFromNow(1);
}

function humanDelay(retryAt: string): string {
  const minutes = Math.max(1, Math.ceil((Date.parse(retryAt) - Date.now()) / 60_000));
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

export async function checkBidCreationLimits(
  ipHash: string,
  amountUsd: number,
): Promise<LimitDecision> {
  // Always first, on every path: a caller that hit a limit must be released by
  // expiry alone.
  await expireStalePendingBids();

  const live = await query<{ expires_at: Date }>(
    `SELECT expires_at FROM pending_bids WHERE ip_hash = $1 AND status = 'pending'`,
    [ipHash],
  );

  if (live.length >= RATE_LIMITS.livePendingPerIp) {
    const retryAt = soonestExpiry(live);
    return {
      ok: false,
      reason: "too_many_live",
      retryAt,
      message: `You already have ${RATE_LIMITS.livePendingPerIp} bids waiting for payment. Pay one, or wait ${humanDelay(retryAt)} for the oldest to expire.`,
    };
  }

  const since = new Date(Date.now() - RATE_LIMITS.windowMinutes * 60_000);
  const recent = await query<{ created_at: Date }>(
    `SELECT created_at FROM pending_bids
      WHERE ip_hash = $1 AND created_at > $2 ORDER BY created_at ASC`,
    [ipHash, since],
  );

  if (recent.length >= RATE_LIMITS.createdPerIpPerWindow) {
    // The window frees up when the oldest bid in it falls out.
    const retryAt = new Date(
      recent[0].created_at.getTime() + RATE_LIMITS.windowMinutes * 60_000,
    ).toISOString();
    return {
      ok: false,
      reason: "too_many_recent",
      retryAt,
      message: `You have started ${RATE_LIMITS.createdPerIpPerWindow} bids in the last ${RATE_LIMITS.windowMinutes} minutes. Try again in ${humanDelay(retryAt)}.`,
    };
  }

  const sharing = await query<{ expires_at: Date }>(
    `SELECT expires_at FROM pending_bids WHERE amount_usd = $1 AND status = 'pending'`,
    [amountUsd],
  );

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

// --- Verification limits -----------------------------------------------------

export type VerifyLimitDecision =
  | { ok: true }
  | { ok: false; reason: "too_fast" | "too_many_for_bid" | "too_many_for_ip"; message: string; retryAfterSeconds: number };

/**
 * Caps verification, which was previously unlimited. One bid id used to be
 * enough to drive unbounded RPC calls: each attempt costs us up to three
 * outbound requests, so an attacker could exhaust the node quota and take down
 * the only path that collects money.
 */
export async function checkVerificationLimits(
  bidId: string,
  ipHash: string,
): Promise<VerifyLimitDecision> {
  const windowStart = new Date(Date.now() - VERIFY_LIMITS.windowMinutes * 60_000);
  await pruneVerificationAttempts(windowStart);

  const last = await lastVerificationAttemptForBid(bidId);
  if (last) {
    const elapsed = (Date.now() - Date.parse(last)) / 1000;
    if (elapsed < VERIFY_LIMITS.minIntervalSeconds) {
      const wait = Math.ceil(VERIFY_LIMITS.minIntervalSeconds - elapsed);
      return {
        ok: false,
        reason: "too_fast",
        retryAfterSeconds: wait,
        message: `Slow down — wait ${wait} second${wait === 1 ? "" : "s"} before checking again.`,
      };
    }
  }

  if ((await countVerificationAttemptsForBid(bidId, windowStart)) >= VERIFY_LIMITS.perBid) {
    return {
      ok: false,
      reason: "too_many_for_bid",
      retryAfterSeconds: VERIFY_LIMITS.windowMinutes * 60,
      message: `This bid has been checked ${VERIFY_LIMITS.perBid} times in the last ${VERIFY_LIMITS.windowMinutes} minutes. Wait, or contact support if you have paid.`,
    };
  }

  if ((await countVerificationAttemptsForIp(ipHash, windowStart)) >= VERIFY_LIMITS.perIp) {
    return {
      ok: false,
      reason: "too_many_for_ip",
      retryAfterSeconds: VERIFY_LIMITS.windowMinutes * 60,
      message: `Too many payment checks from here in the last ${VERIFY_LIMITS.windowMinutes} minutes. Try again shortly.`,
    };
  }

  return { ok: true };
}
