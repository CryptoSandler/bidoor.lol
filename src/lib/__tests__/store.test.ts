import { beforeEach, describe, expect, it } from "vitest";
import { checkAddress } from "../addresses";
import { CHAINS, getChain, isKnownLaunchpad } from "../chains";
import type { TokenMetadata } from "../dexscreener";
import { listRanked, placeBid } from "../store";
import { validateBid } from "../validation";

function reset() {
  delete (globalThis as { __board?: unknown }).__board;
}

function meta(overrides: Partial<TokenMetadata> = {}): TokenMetadata {
  return {
    name: "Canonical Name",
    ticker: "CANON",
    links: { x: "https://x.com/canonical" },
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("seed integrity", () => {
  beforeEach(reset);

  it("every seeded entry has an address valid for its chain", () => {
    for (const entry of listRanked()) {
      const chain = getChain(entry.chainId)!;
      const check = checkAddress(chain.family, entry.contract);
      expect(check.ok, `${entry.name} (${entry.chainId}): ${entry.contract}`).toBe(true);
    }
  });

  it("marks each seeded entry according to whether its launchpad is recognised", () => {
    // The list is a trust signal now, not a gate — so this asserts the mark is
    // computed correctly, not that every entry has one.
    for (const entry of listRanked()) {
      const chain = getChain(entry.chainId)!;
      expect(entry.launchpadVerified, `${entry.name}: ${entry.launchpadHost}`).toBe(
        entry.launchpadHost ? isKnownLaunchpad(chain, entry.launchpadHost) : false,
      );
    }
  });

  it("every seeded entry has a name and a ticker", () => {
    for (const entry of listRanked()) {
      expect(entry.name.length, entry.contract).toBeGreaterThan(0);
      expect(entry.ticker.length, entry.contract).toBeGreaterThan(0);
    }
  });

  it("every seeded entry belongs to a chain the board still offers", () => {
    // A row whose chain is missing from the registry would render without a
    // chain badge, which is the one thing a multichain board cannot be vague about.
    const offered = new Set(CHAINS.map((chain) => chain.id));
    for (const entry of listRanked()) {
      expect(offered.has(entry.chainId), `${entry.name} on ${entry.chainId}`).toBe(true);
    }
  });

  it("covers all eight chains in one list", () => {
    expect(new Set(listRanked().map((entry) => entry.chainId)).size).toBe(8);
  });
});

describe("ranking", () => {
  beforeEach(reset);

  it("orders by accumulated total, descending", () => {
    const totals = listRanked().map((entry) => entry.totalUsd);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it("numbers ranks from 1 with no gaps", () => {
    const ranks = listRanked().map((entry) => entry.rank);
    expect(ranks).toEqual(ranks.map((_, index) => index + 1));
  });

  it("prices #1 above the leader's total, and lower ranks a dollar above theirs", () => {
    const [first, second] = listRanked();
    expect(first.priceToClaim).toBe(first.totalUsd + 5);
    expect(second.priceToClaim).toBe(second.totalUsd + 1);
  });
});

describe("bidding on an address already on the board", () => {
  beforeEach(reset);

  it("tops up the existing entry instead of creating a duplicate", () => {
    const before = listRanked();
    const target = before[3];

    const result = validateBid(
      {
        chainId: target.chainId,
        contract: target.contract,
        launchpadUrl: target.launchpadUrl ?? undefined,
        amountUsd: 100,
      },
      { contractKey: target.contractKey, totalUsd: target.totalUsd },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const outcome = placeBid(result.value, meta());
    expect(outcome.toppedUp).toBe(true);
    expect(outcome.totalUsd).toBe(target.totalUsd + 100);
    expect(listRanked()).toHaveLength(before.length);
  });

  it("treats a differently-cased EVM address as the same token", () => {
    const target = listRanked().find((entry) => entry.contract.startsWith("0x"))!;
    const upper = "0x" + target.contract.slice(2).toUpperCase();
    const before = listRanked().length;

    const result = validateBid(
      { chainId: target.chainId, contract: upper, launchpadUrl: target.launchpadUrl ?? undefined, amountUsd: 50 },
      { contractKey: target.contractKey, totalUsd: target.totalUsd },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(placeBid(result.value, meta()).toppedUp).toBe(true);
    expect(listRanked()).toHaveLength(before);
  });

  it("creates a new entry for an address that is not listed", () => {
    const before = listRanked().length;
    const outcome = placeBid(
      {
        chainId: "solana",
        contract: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        contractKey: "solana:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        launchpadUrl: "https://pump.fun/coin/brand-new",
        launchpadHost: "pump.fun",
        launchpadVerified: true,
        amountUsd: 5,
        strippedParams: [],
      },
      meta({ name: "Brand New", ticker: "NEW" }),
    );
    expect(outcome.toppedUp).toBe(false);
    expect(outcome.entry.name).toBe("Brand New");
    expect(listRanked()).toHaveLength(before + 1);
  });

  it("moves an entry up the board when the top-up is big enough", () => {
    const target = listRanked()[5];
    const leader = listRanked()[0];
    const outcome = placeBid(
      {
        chainId: target.chainId,
        contract: target.contract,
        contractKey: target.contractKey,
        launchpadUrl: target.launchpadUrl ?? null,
        launchpadHost: target.launchpadHost,
        launchpadVerified: target.launchpadVerified,
        amountUsd: leader.totalUsd,
        strippedParams: [],
      },
      meta(),
    );
    expect(outcome.newRank).toBe(1);
    expect(outcome.previousRank).toBe(6);
  });
});

describe("metadata ownership", () => {
  beforeEach(reset);

  it("takes name, ticker and links from the resolver, never from the bid", () => {
    const target = listRanked()[0];
    const outcome = placeBid(
      {
        chainId: target.chainId,
        contract: target.contract,
        contractKey: target.contractKey,
        launchpadUrl: target.launchpadUrl ?? null,
        launchpadHost: target.launchpadHost,
        launchpadVerified: target.launchpadVerified,
        amountUsd: 10,
        strippedParams: [],
      },
      meta({ name: "Renamed By Source", ticker: "SRC", links: { x: "https://x.com/source" } }),
    );
    expect(outcome.entry.name).toBe("Renamed By Source");
    expect(outcome.entry.ticker).toBe("SRC");
    expect(outcome.entry.links).toEqual({ x: "https://x.com/source" });
  });

  it("replaces links wholesale so a dropped social disappears from the board", () => {
    const target = listRanked().find((entry) => entry.links.telegram)!;
    const outcome = placeBid(
      {
        chainId: target.chainId,
        contract: target.contract,
        contractKey: target.contractKey,
        launchpadUrl: target.launchpadUrl ?? null,
        launchpadHost: target.launchpadHost,
        launchpadVerified: target.launchpadVerified,
        amountUsd: 10,
        strippedParams: [],
      },
      meta({ links: { x: "https://x.com/only" } }),
    );
    expect(outcome.entry.links.telegram).toBeUndefined();
  });

  it("freezes the launchpad link: a top-up cannot repoint where clicks go", () => {
    // Pick an entry whose launchpad is NOT the one the attacker will submit,
    // so the assertion actually proves the field was ignored.
    const target = listRanked().find((entry) => entry.launchpadHost !== "pump.fun")!;
    const original = target.launchpadUrl;
    const originalHost = target.launchpadHost;

    const outcome = placeBid(
      {
        chainId: target.chainId,
        contract: target.contract,
        contractKey: target.contractKey,
        launchpadUrl: "https://pump.fun/coin/attacker-controlled",
        launchpadHost: "pump.fun",
        launchpadVerified: true,
        amountUsd: 1,
        strippedParams: [],
      },
      meta(),
    );

    expect(outcome.toppedUp).toBe(true);
    expect(outcome.entry.launchpadUrl).toBe(original);
    expect(outcome.entry.launchpadHost).toBe(originalHost);
  });

  it("uses the supplied launchpad link when the entry is new", () => {
    const outcome = placeBid(
      {
        chainId: "solana",
        contract: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        contractKey: "solana:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        launchpadUrl: "https://pump.fun/coin/first-bid",
        launchpadHost: "pump.fun",
        launchpadVerified: true,
        amountUsd: 5,
        strippedParams: [],
      },
      meta(),
    );
    expect(outcome.entry.launchpadUrl).toBe("https://pump.fun/coin/first-bid");
  });
});
