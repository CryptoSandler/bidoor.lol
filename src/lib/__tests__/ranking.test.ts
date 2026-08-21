import { describe, expect, it } from "vitest";
import { DECAY, rankEntries, scoreEntry, totalUsd } from "../ranking";
import type { Entry } from "../types";

const NOW = Date.parse("2026-01-30T00:00:00.000Z");
const DAY = 86_400_000;

function entry(id: string, bids: [number, number][]): Entry {
  const events = bids.map(([amountUsd, daysAgo], index) => ({
    id: `${id}_${index}`,
    amountUsd,
    createdAt: new Date(NOW - daysAgo * DAY).toISOString(),
  }));
  return {
    id, chainId: "solana", contract: id, contractKey: `solana:${id}`,
    name: id, ticker: id.toUpperCase(), launchpadUrl: "https://pump.fun/coin/" + id,
    launchpadHost: "pump.fun", links: {}, bids: events, clicks: 0,
    metadataFetchedAt: new Date(NOW).toISOString(),
    createdAt: events[0].createdAt,
    lastBidAt: events[events.length - 1].createdAt,
  };
}

describe("decay is designed but not switched on", () => {
  it("ships disabled", () => {
    expect(DECAY).toBeNull();
  });

  it("scores on lifetime total while disabled", () => {
    const old = entry("old", [[1000, 365]]);
    expect(scoreEntry(old, NOW)).toBe(totalUsd(old));
    expect(scoreEntry(old, NOW)).toBe(1000);
  });
});

describe("decay, when enabled", () => {
  const decay = { halfLifeDays: 30, floor: 0.05 };

  it("halves a payment's weight after one half-life", () => {
    const old = entry("old", [[1000, 30]]);
    expect(scoreEntry(old, NOW, decay)).toBeCloseTo(500, 5);
  });

  it("leaves a payment made right now at full weight", () => {
    const fresh = entry("fresh", [[1000, 0]]);
    expect(scoreEntry(fresh, NOW, decay)).toBeCloseTo(1000, 5);
  });

  it("never decays a payment below the floor", () => {
    const ancient = entry("ancient", [[1000, 3650]]);
    expect(scoreEntry(ancient, NOW, decay)).toBeCloseTo(50, 5);
  });

  it("lets steady spending overtake one big old payment", () => {
    const whale = entry("whale", [[10_000, 200]]);
    const grinder = entry("grinder", [[900, 4], [900, 3], [900, 2], [900, 1]]);

    const lifetime = rankEntries([whale, grinder], NOW, null);
    expect(lifetime[0].id).toBe("whale");

    const decayed = rankEntries([whale, grinder], NOW, decay);
    expect(decayed[0].id).toBe("grinder");
  });
});

describe("ties", () => {
  it("gives the higher rank to whoever got there first", () => {
    const early = entry("early", [[500, 10]]);
    const late = entry("late", [[500, 2]]);
    expect(rankEntries([late, early], NOW, null)[0].id).toBe("early");
  });
});
