import { describe, expect, it } from "vitest";
import { validateBid, type BidInput } from "../validation";

const SOL_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const EVM_ADDR = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

function bid(overrides: Partial<BidInput> = {}): BidInput {
  return {
    chainId: "solana",
    contract: SOL_MINT,
    launchpadUrl: "https://pump.fun/coin/abc",
    amountUsd: 50,
    ...overrides,
  };
}

describe("the bidder supplies only address, chain, launchpad and amount", () => {
  it("has no field for name, ticker or socials", () => {
    // Identity is read from DexScreener, so there is nothing here to hijack.
    const result = validateBid(bid(), null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value).sort()).toEqual(
      ["amountUsd", "chainId", "contract", "contractKey", "launchpadHost", "launchpadUrl", "strippedParams"],
    );
  });
});

describe("address must match the selected chain", () => {
  it("rejects an EVM address submitted as Solana", () => {
    const result = validateBid(bid({ contract: EVM_ADDR }), null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.contract).toMatch(/Solana/);
  });

  it("rejects a Solana mint submitted as Base", () => {
    const result = validateBid(
      bid({ chainId: "base", contract: SOL_MINT, launchpadUrl: "https://clanker.world/clanker/0x1" }),
      null,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts the same EVM address on any EVM chain as a distinct entry", () => {
    const onBase = validateBid(
      bid({ chainId: "base", contract: EVM_ADDR, launchpadUrl: "https://clanker.world/clanker/0x1" }),
      null,
    );
    const onBnb = validateBid(
      bid({ chainId: "bnb", contract: EVM_ADDR, launchpadUrl: "https://four.meme/token/0x1" }),
      null,
    );
    expect(onBase.ok && onBnb.ok).toBe(true);
    if (!onBase.ok || !onBnb.ok) return;
    expect(onBase.value.contractKey).not.toBe(onBnb.value.contractKey);
  });

  it("keys an EVM entry case-insensitively", () => {
    const upper = validateBid(
      bid({ chainId: "base", contract: EVM_ADDR, launchpadUrl: "https://clanker.world/c/1" }),
      null,
    );
    const lower = validateBid(
      bid({ chainId: "base", contract: EVM_ADDR.toLowerCase(), launchpadUrl: "https://clanker.world/c/1" }),
      null,
    );
    expect(upper.ok && lower.ok && upper.value.contractKey === lower.value.contractKey).toBe(true);
  });
});

describe("launchpad must match the chain", () => {
  it("rejects pump.fun for a BNB token", () => {
    const result = validateBid(
      bid({ chainId: "bnb", contract: EVM_ADDR, launchpadUrl: "https://pump.fun/coin/abc" }),
      null,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.launchpadUrl).toMatch(/four\.meme/);
  });

  it("accepts four.meme for a BNB token", () => {
    expect(
      validateBid(
        bid({ chainId: "bnb", contract: EVM_ADDR, launchpadUrl: "https://four.meme/token/0xabc" }),
        null,
      ).ok,
    ).toBe(true);
  });

  it("accepts hood.fun for a Robinhood Chain token", () => {
    expect(
      validateBid(
        bid({ chainId: "robinhood", contract: EVM_ADDR, launchpadUrl: "https://hood.fun/token/0xabc" }),
        null,
      ).ok,
    ).toBe(true);
  });

  it("rejects a random domain dressed up as a launchpad", () => {
    expect(validateBid(bid({ launchpadUrl: "https://my-token-site.xyz" }), null).ok).toBe(false);
  });

  it("rejects a shortener pointing at a launchpad", () => {
    expect(validateBid(bid({ launchpadUrl: "https://bit.ly/pumpfun-abc" }), null).ok).toBe(false);
  });
});

describe("amounts", () => {
  it("enforces the new-listing floor", () => {
    expect(validateBid(bid({ amountUsd: 4 }), null).ok).toBe(false);
    expect(validateBid(bid({ amountUsd: 5 }), null).ok).toBe(true);
  });

  it("lets an already-listed token top up by a smaller amount", () => {
    const existing = { contractKey: "solana:" + SOL_MINT, totalUsd: 800 };
    expect(validateBid(bid({ amountUsd: 1 }), existing).ok).toBe(true);
    expect(validateBid(bid({ amountUsd: 0 }), existing).ok).toBe(false);
  });

  it("rejects fractional and negative amounts", () => {
    expect(validateBid(bid({ amountUsd: 10.5 }), null).ok).toBe(false);
    expect(validateBid(bid({ amountUsd: -100 }), null).ok).toBe(false);
  });
});

describe("normalization", () => {
  it("strips params from the launchpad link and reports what it removed", () => {
    const result = validateBid(bid({ launchpadUrl: "https://pump.fun/coin/abc?ref=me&utm_source=x" }), null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.launchpadUrl).toBe("https://pump.fun/coin/abc");
    expect(result.value.strippedParams).toEqual(["ref", "utm_source"]);
  });
});
