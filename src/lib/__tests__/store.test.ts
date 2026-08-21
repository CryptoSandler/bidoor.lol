import { beforeEach, describe, expect, it } from "vitest";
import { checkAddress } from "../addresses";
import { CHAINS, getChain, isKnownLaunchpad } from "../chains";
import type { TokenMetadata } from "../dexscreener";
import { loadDemoSeed, truncateAll } from "../seed";
import { listRanked, placeBid } from "../store";
import { validateBid } from "../validation";

async function reset() {
  await truncateAll();
  await loadDemoSeed();
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

  it("every seeded entry has an address valid for its chain", async () => {
    for (const entry of await listRanked()) {
      const chain = getChain(entry.chainId)!;
      const check = checkAddress(chain.family, entry.contract);
      expect(check.ok, `${entry.name} (${entry.chainId}): ${entry.contract}`).toBe(true);
    }
  });

  it("marks each seeded entry according to whether its launchpad is recognised", async () => {
    // The list is a trust signal now, not a gate — so this asserts the mark is
    // computed correctly, not that every entry has one.
    for (const entry of await listRanked()) {
      const chain = getChain(entry.chainId)!;
      expect(entry.launchpadVerified, `${entry.name}: ${entry.launchpadHost}`).toBe(
        entry.launchpadHost ? isKnownLaunchpad(chain, entry.launchpadHost) : false,
      );
    }
  });

  it("every seeded entry has a name and a ticker", async () => {
    for (const entry of await listRanked()) {
      expect(entry.name.length, entry.contract).toBeGreaterThan(0);
      expect(entry.ticker.length, entry.contract).toBeGreaterThan(0);
    }
  });

  it("every seeded entry belongs to a chain the board still offers", async () => {
    // A row whose chain is missing from the registry would render without a
    // chain badge, which is the one thing a multichain board cannot be vague about.
    const offered = new Set(CHAINS.map((chain) => chain.id));
    for (const entry of await listRanked()) {
      expect(offered.has(entry.chainId), `${entry.name} on ${entry.chainId}`).toBe(true);
    }
  });

  it("covers all eight chains in one list", async () => {
    expect(new Set((await listRanked()).map((entry) => entry.chainId)).size).toBe(8);
  });
});

describe("ranking", () => {
  beforeEach(reset);

  it("orders by accumulated total, descending", async () => {
    const totals = (await listRanked()).map((entry) => entry.totalUsd);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it("numbers ranks from 1 with no gaps", async () => {
    const ranks = (await listRanked()).map((entry) => entry.rank);
    expect(ranks).toEqual(ranks.map((_, index) => index + 1));
  });

  it("prices #1 above the leader's total, and lower ranks a dollar above theirs", async () => {
    const [first, second] = await listRanked();
    expect(first.priceToClaim).toBe(first.totalUsd + 5);
    expect(second.priceToClaim).toBe(second.totalUsd + 1);
  });
});

describe("bidding on an address already on the board", () => {
  beforeEach(reset);

  it("tops up the existing entry instead of creating a duplicate", async () => {
    const before = await listRanked();
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

    const outcome = await placeBid(result.value, meta());
    expect(outcome.toppedUp).toBe(true);
    expect(outcome.totalUsd).toBe(target.totalUsd + 100);
    expect(await listRanked()).toHaveLength(before.length);
  });

  it("treats a differently-cased EVM address as the same token", async () => {
    const target = (await listRanked()).find((entry) => entry.contract.startsWith("0x"))!;
    const upper = "0x" + target.contract.slice(2).toUpperCase();
    const before = (await listRanked()).length;

    const result = validateBid(
      { chainId: target.chainId, contract: upper, launchpadUrl: target.launchpadUrl ?? undefined, amountUsd: 50 },
      { contractKey: target.contractKey, totalUsd: target.totalUsd },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect((await placeBid(result.value, meta())).toppedUp).toBe(true);
    expect(await listRanked()).toHaveLength(before);
  });

  it("creates a new entry for an address that is not listed", async () => {
    const before = (await listRanked()).length;
    const outcome = await placeBid(
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
    expect(await listRanked()).toHaveLength(before + 1);
  });

  it("moves an entry up the board when the top-up is big enough", async () => {
    const target = (await listRanked())[5];
    const leader = (await listRanked())[0];
    const outcome = await placeBid(
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

  it("takes name, ticker and links from the resolver, never from the bid", async () => {
    const target = (await listRanked())[0];
    const outcome = await placeBid(
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

  it("replaces links wholesale so a dropped social disappears from the board", async () => {
    const target = (await listRanked()).find((entry) => entry.links.telegram)!;
    const outcome = await placeBid(
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

  it("freezes the launchpad link: a top-up cannot repoint where clicks go", async () => {
    // Pick an entry whose launchpad is NOT the one the attacker will submit,
    // so the assertion actually proves the field was ignored.
    const target = (await listRanked()).find((entry) => entry.launchpadHost !== "pump.fun")!;
    const original = target.launchpadUrl;
    const originalHost = target.launchpadHost;

    const outcome = await placeBid(
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

  it("uses the supplied launchpad link when the entry is new", async () => {
    const outcome = await placeBid(
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
