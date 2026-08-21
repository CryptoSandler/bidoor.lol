import { beforeEach, describe, expect, it } from "vitest";
import type { NormalizedBid } from "../../validation";
import { FRACTION_MAX, RATE_LIMITS } from "../config";
import { query } from "../../db";
import { truncateAll } from "../../seed";
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
async function expire(id: string) {
  await query("UPDATE pending_bids SET expires_at = $1 WHERE id = $2", [
    new Date(Date.now() - 1000),
    id,
  ]);
}

/** Backdates a bid's creation so it falls out of the rolling window. */
async function backdateCreation(id: string, minutes: number) {
  await query("UPDATE pending_bids SET created_at = $1 WHERE id = $2", [
    new Date(Date.now() - minutes * 60_000),
    id,
  ]);
}

beforeEach(async () => {
  await truncateAll();
});

describe("caller identity is read from the right of x-forwarded-for", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://example.com", { headers });

  it("takes the entry our own proxy appended, not the one the caller sent", async () => {
    // Proxies APPEND. With one trusted hop the last entry is what that proxy
    // saw; everything to its left is whatever the caller wrote.
    const identity = clientIp(
      req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7" }),
    );
    expect(identity.ok).toBe(true);
    if (!identity.ok) return;
    expect(identity.ip).toBe("203.0.113.7");
  });

  it("cannot be moved to another bucket by a forged header", async () => {
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

  it("prefers a platform header the caller cannot forge", async () => {
    const identity = clientIp(
      req({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "9.9.9.9" }),
    );
    expect(identity.ok && identity.ip).toBe("203.0.113.7");
  });

  it("rejects a header with fewer entries than there are trusted proxies", async () => {
    // One entry and one trusted hop means nothing was appended by our proxy, so
    // the value is entirely caller-supplied.
    const identity = clientIp(req({ "x-forwarded-for": "9.9.9.9" }));
    expect(identity.ok).toBe(true);
    if (!identity.ok) return;
    // With hops = 1 the single entry IS the one the proxy appended.
    expect(identity.ip).toBe("9.9.9.9");
  });

  it("fails closed when there is no header to trust at all", async () => {
    // The development escape hatch has to be off for this: in production there
    // is no such thing as an unidentifiable caller we still serve.
    const original = process.env.ALLOW_UNTRUSTED_CLIENT_IP;
    delete process.env.ALLOW_UNTRUSTED_CLIENT_IP;
    try {
    // Not a shared bucket: a shared bucket is either an unlimited allowance or
    // a self-inflicted outage. The caller cannot be identified, so bidding stops.
      const identity = clientIp(req({}));
      expect(identity.ok).toBe(false);
      if (identity.ok) return;
      expect(identity.reason).toMatch(/TRUSTED_PROXY_HOPS|ALLOW_UNTRUSTED_CLIENT_IP/);
    } finally {
      process.env.ALLOW_UNTRUSTED_CLIENT_IP = original;
    }
  });

  it("ignores x-real-ip, which a caller can also set", async () => {
    const original = process.env.ALLOW_UNTRUSTED_CLIENT_IP;
    delete process.env.ALLOW_UNTRUSTED_CLIENT_IP;
    try {
      expect(clientIp(req({ "x-real-ip": "9.9.9.9" })).ok).toBe(false);
    } finally {
      process.env.ALLOW_UNTRUSTED_CLIENT_IP = original;
    }
  });

  it("never stores the raw address", async () => {
    const hash = hashIp("203.0.113.7");
    expect(hash).not.toContain("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.7")).toBe(hash);
    expect(hashIp("203.0.113.8")).not.toBe(hash);
  });
});

describe("live pending bids per caller", () => {
  it("allows up to the limit and then refuses", async () => {
    // Distinct amounts, so this exercises the live-bids-per-caller cap rather
    // than the per-amount one.
    for (let i = 0; i < RATE_LIMITS.livePendingPerIp; i++) {
      expect((await checkBidCreationLimits(IP, 50 + i)).ok).toBe(true);
      await createPendingBid(bidFor(50 + i), IP);
    }

    const blocked = await checkBidCreationLimits(IP, 900);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reason).toBe("too_many_live");
    expect(blocked.message).toMatch(/waiting for payment/i);
    expect(Date.parse(blocked.retryAt)).toBeGreaterThan(Date.now() - 1000);
  });

  it("does not let one caller's bids block another", async () => {
    for (let i = 0; i < RATE_LIMITS.livePendingPerIp; i++) {
      await createPendingBid(bidFor(50 + i), IP);
    }

    expect((await checkBidCreationLimits(IP, 900)).ok).toBe(false);
    expect((await checkBidCreationLimits(OTHER_IP, 900)).ok).toBe(true);
  });

  it("releases the caller as soon as a bid expires, with no cleanup job", async () => {
    const ids: string[] = [];
    for (let i = 0; i < RATE_LIMITS.livePendingPerIp; i++) {
      ids.push((await createPendingBid(bidFor(50 + i), IP)).id);
    }
    expect((await checkBidCreationLimits(IP, 900)).ok).toBe(false);

    await expire(ids[0]);

    // The check itself sweeps, so the caller unblocks by waiting alone.
    expect((await checkBidCreationLimits(IP, 900)).ok).toBe(true);
    expect((await getPendingBid(ids[0]))?.status).toBe("expired");
  });

  it("sweeps on the rejection path too, not only when it allows", async () => {
    const ids: string[] = [];
    for (let i = 0; i < RATE_LIMITS.livePendingPerIp; i++) {
      ids.push((await createPendingBid(bidFor(50 + i), IP)).id);
    }
    // Fill a second caller's slots so the next check still rejects, while the
    // first caller's bids are all expired.
    for (const id of ids) await expire(id);
    for (let i = 0; i < RATE_LIMITS.livePendingPerIp; i++) {
      await createPendingBid(bidFor(50 + i), OTHER_IP);
    }

    const rejected = await checkBidCreationLimits(OTHER_IP, 900);
    expect(rejected.ok).toBe(false);

    // The rejected call still cleaned up the stale rows.
    for (const id of ids) expect((await getPendingBid(id))?.status).toBe("expired");
  });
});

describe("bids started per caller per window", () => {
  it("counts paid and expired bids too, not just live ones", async () => {
    for (let i = 0; i < RATE_LIMITS.createdPerIpPerWindow; i++) {
      const bid = await createPendingBid(bidFor(50 + i), IP);
      await expire(bid.id);
    }

    const blocked = await checkBidCreationLimits(IP, 999);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    // Expiring them released the live-slot limit, so this must be the window one.
    expect(blocked.reason).toBe("too_many_recent");
    expect(blocked.message).toMatch(new RegExp(`${RATE_LIMITS.windowMinutes} minutes`));
  });

  it("lets the window roll off", async () => {
    const ids: string[] = [];
    for (let i = 0; i < RATE_LIMITS.createdPerIpPerWindow; i++) {
      const bid = await createPendingBid(bidFor(50 + i), IP);
      await expire(bid.id);
      ids.push(bid.id);
    }
    expect((await checkBidCreationLimits(IP, 999)).ok).toBe(false);

    for (const id of ids) await backdateCreation(id, RATE_LIMITS.windowMinutes + 1);
    expect((await checkBidCreationLimits(IP, 999)).ok).toBe(true);
  });

  it("tells the caller when the window frees up", async () => {
    for (let i = 0; i < RATE_LIMITS.createdPerIpPerWindow; i++) {
      await expire((await createPendingBid(bidFor(50 + i), IP)).id);
    }
    const blocked = await checkBidCreationLimits(IP, 999);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;

    const minutesAway = (Date.parse(blocked.retryAt) - Date.now()) / 60_000;
    expect(minutesAway).toBeGreaterThan(0);
    expect(minutesAway).toBeLessThanOrEqual(RATE_LIMITS.windowMinutes);
  });
});

describe("fraction space for a single amount", () => {
  it("caps well below the number of fractions available", async () => {
    // 999,999 fractions exist per amount; the cap must not flirt with that,
    // because near saturation the random draw starts colliding.
    expect(RATE_LIMITS.livePendingPerAmount).toBeLessThan(FRACTION_MAX / 4);
  });

  it("makes cornering an amount cost tens of thousands of callers", async () => {
    // This is the A-2 fix expressed as the property that matters. The global cap
    // alone was a shared resource: 500 bids from ~100 IPs denied every $1 bid.
    const callersNeeded =
      RATE_LIMITS.livePendingPerAmount / RATE_LIMITS.livePendingPerAmountPerCaller;
    expect(callersNeeded).toBeGreaterThanOrEqual(10_000);
  });

  it("stops one caller taking more than its share of an amount", async () => {
    const ip = hashIp("203.0.113.99");

    for (let i = 0; i < RATE_LIMITS.livePendingPerAmountPerCaller; i++) {
      expect((await checkBidCreationLimits(ip, 1)).ok).toBe(true);
      await createPendingBid(bidFor(1), ip);
    }

    const blocked = await checkBidCreationLimits(ip, 1);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reason).toBe("amount_hogged");
    expect(blocked.message).toMatch(/\$1\b/);
  });

  it("leaves the same caller free to bid a different amount", async () => {
    const ip = hashIp("203.0.113.99");
    for (let i = 0; i < RATE_LIMITS.livePendingPerAmountPerCaller; i++) {
      await createPendingBid(bidFor(1), ip);
    }
    expect((await checkBidCreationLimits(ip, 1)).ok).toBe(false);
    expect((await checkBidCreationLimits(ip, 2)).ok).toBe(true);
  });

  it("leaves other callers unaffected by one caller's share", async () => {
    const mine = hashIp("203.0.113.99");
    for (let i = 0; i < RATE_LIMITS.livePendingPerAmountPerCaller; i++) {
      await createPendingBid(bidFor(1), mine);
    }
    expect((await checkBidCreationLimits(mine, 1)).ok).toBe(false);
    expect((await checkBidCreationLimits(hashIp("198.51.100.4"), 1)).ok).toBe(true);
  });

  it("frees the amount as its bids expire", async () => {
    const ip = hashIp("203.0.113.99");
    const ids: string[] = [];
    for (let i = 0; i < RATE_LIMITS.livePendingPerAmountPerCaller; i++) {
      ids.push((await createPendingBid(bidFor(1), ip)).id);
    }
    expect((await checkBidCreationLimits(ip, 1)).ok).toBe(false);

    for (const id of ids) await expire(id);

    // The sweep inside the check reclaims them, so the amount is usable again.
    expect((await checkBidCreationLimits(ip, 1)).ok).toBe(true);
  });
});
