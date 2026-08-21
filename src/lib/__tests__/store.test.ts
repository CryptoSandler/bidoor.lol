import { beforeEach, describe, expect, it } from "vitest";
import { checkAddress } from "../addresses";
import { getChain } from "../chains";
import { hostMatches } from "../links";
import { listRanked, placeBid } from "../store";
import { validateBid } from "../validation";

function reset() {
  delete (globalThis as { __board?: unknown }).__board;
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

  it("every seeded launchpad link is on an allowed host for its chain", () => {
    for (const entry of listRanked()) {
      const chain = getChain(entry.chainId)!;
      const allowed = chain.launchpads.some((host) => hostMatches(entry.launchpadHost, host));
      expect(allowed, `${entry.name}: ${entry.launchpadHost} not valid for ${chain.name}`).toBe(true);
    }
  });

  it("covers all eight chains in one list", () => {
    const chains = new Set(listRanked().map((entry) => entry.chainId));
    expect(chains.size).toBe(8);
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
    const countBefore = before.length;

    const result = validateBid(
      {
        chainId: target.chainId,
        contract: target.contract,
        name: target.name,
        ticker: target.ticker,
        launchpadUrl: target.launchpadUrl,
        amountUsd: 100,
      },
      { contractKey: target.contractKey, totalUsd: target.totalUsd },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const outcome = placeBid(result.value);
    expect(outcome.toppedUp).toBe(true);
    expect(outcome.totalUsd).toBe(target.totalUsd + 100);
    expect(listRanked()).toHaveLength(countBefore);
  });

  it("treats a differently-cased EVM address as the same token", () => {
    const target = listRanked().find((entry) => entry.contract.startsWith("0x"))!;
    const upper = "0x" + target.contract.slice(2).toUpperCase();

    const result = validateBid(
      {
        chainId: target.chainId,
        contract: upper,
        name: "Renamed Token",
        ticker: "RENAME",
        launchpadUrl: target.launchpadUrl,
        amountUsd: 50,
      },
      { contractKey: target.contractKey, totalUsd: target.totalUsd },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const countBefore = listRanked().length;
    const outcome = placeBid(result.value);
    expect(outcome.toppedUp).toBe(true);
    expect(listRanked()).toHaveLength(countBefore);
    // A top-up refreshes metadata rather than forking a second row.
    expect(outcome.entry.name).toBe("Renamed Token");
  });

  it("a different name on the same contract does not create a second row", () => {
    const target = listRanked()[0];
    const countBefore = listRanked().length;
    placeBid({
      chainId: target.chainId,
      contract: target.contract,
      contractKey: target.contractKey,
      name: "Totally Different Name",
      ticker: "OTHER",
      launchpadUrl: target.launchpadUrl,
      launchpadHost: target.launchpadHost,
      links: {},
      amountUsd: 10,
      strippedParams: [],
    });
    expect(listRanked()).toHaveLength(countBefore);
  });

  it("creates a new entry for an address that is not listed", () => {
    const countBefore = listRanked().length;
    const outcome = placeBid({
      chainId: "solana",
      contract: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      contractKey: "solana:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      name: "Brand New",
      ticker: "NEW",
      launchpadUrl: "https://pump.fun/coin/brand-new",
      launchpadHost: "pump.fun",
      links: {},
      amountUsd: 5,
      strippedParams: [],
    });
    expect(outcome.toppedUp).toBe(false);
    expect(listRanked()).toHaveLength(countBefore + 1);
  });

  it("moves an entry up the board when the top-up is big enough", () => {
    const target = listRanked()[5];
    const leader = listRanked()[0];
    const outcome = placeBid({
      chainId: target.chainId,
      contract: target.contract,
      contractKey: target.contractKey,
      name: target.name,
      ticker: target.ticker,
      launchpadUrl: target.launchpadUrl,
      launchpadHost: target.launchpadHost,
      links: {},
      amountUsd: leader.totalUsd,
      strippedParams: [],
    });
    expect(outcome.newRank).toBe(1);
    expect(outcome.previousRank).toBe(6);
  });
});
