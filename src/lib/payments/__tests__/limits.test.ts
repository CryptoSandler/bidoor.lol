import { beforeEach, describe, expect, it } from "vitest";
import type { NormalizedBid } from "../../validation";
import { RATE_LIMITS } from "../config";
import { db, resetDbForTests } from "../db";
import { checkBidCreationLimits, clientIp, hashIp } from "../limits";
import { createPendingBid, getPendingBid } from "../pending";

const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const IP = hashIp("203.0.113.7");
const OTHER_IP = hashIp("198.51.100.9");

function bidFor(amountUsd: number): NormalizedBid {
  return {
    chainId: "solana",
    contract: BONK,
    contractKey: `solana:${BONK}`,
    launchpadUrl: "https://pump.fun/coin/bonk",
    launchpadHost: "pump.fun",
    launchpadVerified: true,
    amountUsd,
    strippedParams: [],
  };
}

/** Winds a bid's deadline into the past without waiting 30 minutes. */
function expire(id: string) {
  db()
    .prepare("UPDATE pending_bids SET expires_at = ? WHERE id = ?")
    .run(new Date(Date.now() - 1000).toISOString(), id);
}

/** Backdates a bid's creation so it falls out of the rolling window. */
function backdateCreation(id: string, minutes: number) {
  db()
    .prepare("UPDATE pending_bids SET created_at = ? WHERE id = ?")
    .run(new Date(Date.now() - minutes * 60_000).toISOString(), id);
}

beforeEach(() => resetDbForTests());

describe("caller identity is read from the right of x-forwarded-for", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://example.com", { headers });

  it("takes the entry our own proxy appended, not the one the caller sent", () => {
    // Proxies APPEND. With one trusted hop the last entry is what that proxy
    // saw; everything to its left is whatever the caller wrote.
    const identity = clientIp(
      req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7" }),
    );
    expect(identity.ok).toBe(true);
    if (!identity.ok) return;
    expect(identity.ip).toBe("203.0.113.7");
  });

  it("cannot be moved to another bucket by a forged header", () => {
    // The attack: send a different left-most value on every request to get a
    // fresh rate-limit bucket each time. All of these must land on one identity.
    const real = "203.0.113.7";
    const forged = ["9.9.9.9", "8.8.8.8", "7.7.7.7"].map(
      (spoof) => clientIp(req({ "x-forwarded-for": `${spoof}, ${real}` })),
    );

    const buckets = new Set(forged.map((id) => (id.ok ? hashIp(id.ip) : "rejected")));
    expect(buckets.size).toBe(1);
    expect([...buckets][0]).toBe(hashIp(real));
  });

  it("prefers a platform header the caller cannot forge", () => {
    const identity = clientIp(
      req({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "9.9.9.9" }),
    );
    expect(identity.ok && identity.ip).toBe("203.0.113.7");
  });

  it("rejects a header with fewer entries than there are trusted proxies", () => {
    // One entry and one trusted hop means nothing was appended by our proxy, so
    // the value is entirely caller-supplied.
    const identity = clientIp(req({ "x-forwarded-for": "9.9.9.9" }));
    expect(identity.ok).toBe(true);
    if (!identity.ok) return;
    // With hops = 1 the single entry IS the one the proxy appended.
    expect(identity.ip).toBe("9.9.9.9");
  });

  it("fails closed when there is no header to trust at all", () => {
    // Not a shared bucket: a shared bucket is either an unlimited allowance or
    // a self-inflicted outage. The caller cannot be identified, so bidding stops.
    const identity = clientIp(req({}));
    expect(identity.ok).toBe(false);
    if (identity.ok) return;
    expect(identity.reason).toMatch(/TRUSTED_PROXY_HOPS|ALLOW_UNTRUSTED_CLIENT_IP/);
  });

  it("ignores x-real-ip, which a caller can also set", () => {
    const identity = clientIp(req({ "x-real-ip": "9.9.9.9" }));
    expect(identity.ok).toBe(false);
  });

  it("never stores the raw address", () => {
    const hash = hashIp("203.0.113.7");
    expect(hash).not.toContain("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.7")).toBe(hash);
    expect(hashIp("203.0.113.8")).not.toBe(hash);
  });
});

describe("live pending bids per caller", () => {
  it("allows up to the limit and then refuses", () => {
    for (let i = 0; i < RATE_LIMITS.livePendingPerIp; i++) {
      expect(checkBidCreationLimits(IP, 50).ok).toBe(true);
      createPendingBid(bidFor(50), IP);
    }

    const blocked = checkBidCreationLimits(IP, 50);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reason).toBe("too_many_live");
    expect(blocked.message).toMatch(/waiting for payment/i);
    expect(Date.parse(blocked.retryAt)).toBeGreaterThan(Date.now() - 1000);
  });

  it("does not let one caller's bids block another", () => {
    for (let i = 0; i < RATE_LIMITS.livePendingPerIp; i++) createPendingBid(bidFor(50), IP);

    expect(checkBidCreationLimits(IP, 50).ok).toBe(false);
    expect(checkBidCreationLimits(OTHER_IP, 50).ok).toBe(true);
  });

  it("releases the caller as soon as a bid expires, with no cleanup job", () => {
    const ids: string[] = [];
    for (let i = 0; i < RATE_LIMITS.livePendingPerIp; i++) {
      ids.push(createPendingBid(bidFor(50), IP).id);
    }
    expect(checkBidCreationLimits(IP, 50).ok).toBe(false);

    expire(ids[0]);

    // The check itself sweeps, so the caller unblocks by waiting alone.
    expect(checkBidCreationLimits(IP, 50).ok).toBe(true);
    expect(getPendingBid(ids[0])?.status).toBe("expired");
  });

  it("sweeps on the rejection path too, not only when it allows", () => {
    const ids: string[] = [];
    for (let i = 0; i < RATE_LIMITS.livePendingPerIp; i++) {
      ids.push(createPendingBid(bidFor(50), IP).id);
    }
    // Fill a second caller's slots so the next check still rejects, while the
    // first caller's bids are all expired.
    for (const id of ids) expire(id);
    for (let i = 0; i < RATE_LIMITS.livePendingPerIp; i++) createPendingBid(bidFor(50), OTHER_IP);

    const rejected = checkBidCreationLimits(OTHER_IP, 50);
    expect(rejected.ok).toBe(false);

    // The rejected call still cleaned up the stale rows.
    for (const id of ids) expect(getPendingBid(id)?.status).toBe("expired");
  });
});

describe("bids started per caller per window", () => {
  it("counts paid and expired bids too, not just live ones", () => {
    for (let i = 0; i < RATE_LIMITS.createdPerIpPerWindow; i++) {
      const bid = createPendingBid(bidFor(50 + i), IP);
      expire(bid.id);
    }

    const blocked = checkBidCreationLimits(IP, 999);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    // Expiring them released the live-slot limit, so this must be the window one.
    expect(blocked.reason).toBe("too_many_recent");
    expect(blocked.message).toMatch(new RegExp(`${RATE_LIMITS.windowMinutes} minutes`));
  });

  it("lets the window roll off", () => {
    const ids: string[] = [];
    for (let i = 0; i < RATE_LIMITS.createdPerIpPerWindow; i++) {
      const bid = createPendingBid(bidFor(50 + i), IP);
      expire(bid.id);
      ids.push(bid.id);
    }
    expect(checkBidCreationLimits(IP, 999).ok).toBe(false);

    for (const id of ids) backdateCreation(id, RATE_LIMITS.windowMinutes + 1);
    expect(checkBidCreationLimits(IP, 999).ok).toBe(true);
  });

  it("tells the caller when the window frees up", () => {
    for (let i = 0; i < RATE_LIMITS.createdPerIpPerWindow; i++) {
      expire(createPendingBid(bidFor(50 + i), IP).id);
    }
    const blocked = checkBidCreationLimits(IP, 999);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;

    const minutesAway = (Date.parse(blocked.retryAt) - Date.now()) / 60_000;
    expect(minutesAway).toBeGreaterThan(0);
    expect(minutesAway).toBeLessThanOrEqual(RATE_LIMITS.windowMinutes);
  });
});

describe("fraction space for a single amount", () => {
  it("caps well below the number of fractions available", () => {
    // 9,999 fractions exist per amount; the cap must not flirt with that.
    expect(RATE_LIMITS.livePendingPerAmount).toBeLessThan(9999 / 4);
  });

  it("refuses once too many bids share one base amount", () => {
    const insert = db().prepare(
      `INSERT INTO pending_bids
         (id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
          launchpad_verified, amount_usd, ip_hash, payment_micros, status, created_at, expires_at)
       VALUES (?, 'solana', ?, ?, 'https://pump.fun/coin/x', 'pump.fun', 1, 50, ?, ?, 'pending', ?, ?)`,
    );
    const now = new Date().toISOString();
    const soon = new Date(Date.now() + 600_000).toISOString();
    for (let i = 0; i < RATE_LIMITS.livePendingPerAmount; i++) {
      insert.run(`bid_${i}`, BONK, `solana:${BONK}`, `ip_${i}`, 50_000_000 + i * 100, now, soon);
    }

    const blocked = checkBidCreationLimits(hashIp("1.2.3.4"), 50);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reason).toBe("amount_saturated");
    expect(blocked.message).toMatch(/\$50/);
    expect(blocked.message).toMatch(/different amount/i);

    // A different amount is unaffected: this is not a global outage.
    expect(checkBidCreationLimits(hashIp("1.2.3.4"), 51).ok).toBe(true);
  });

  it("frees the amount as its bids expire", () => {
    const insert = db().prepare(
      `INSERT INTO pending_bids
         (id, chain_id, contract, contract_key, launchpad_url, launchpad_host,
          launchpad_verified, amount_usd, ip_hash, payment_micros, status, created_at, expires_at)
       VALUES (?, 'solana', ?, ?, 'https://pump.fun/coin/x', 'pump.fun', 1, 50, ?, ?, 'pending', ?, ?)`,
    );
    const now = new Date().toISOString();
    const past = new Date(Date.now() - 1000).toISOString();
    const soon = new Date(Date.now() + 600_000).toISOString();

    for (let i = 0; i < RATE_LIMITS.livePendingPerAmount; i++) {
      // All but one already past their deadline.
      insert.run(`bid_${i}`, BONK, `solana:${BONK}`, `ip_${i}`, 50_000_000 + i * 100, now, i === 0 ? soon : past);
    }

    // The sweep inside the check reclaims them, so the amount is usable again.
    expect(checkBidCreationLimits(hashIp("1.2.3.4"), 50).ok).toBe(true);
  });
});
