import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChain } from "../chains";
import { fetchTokenMetadata } from "../dexscreener";

const SOLANA = getChain("solana")!;
const BASE = getChain("base")!;
const MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

type Pair = Record<string, unknown>;

function pair(overrides: Pair = {}): Pair {
  return {
    chainId: "solana",
    url: "https://dexscreener.com/solana/abc",
    baseToken: { address: MINT, name: "Bonk", symbol: "Bonk" },
    quoteToken: { address: "So11111111111111111111111111111111111111112", symbol: "SOL" },
    liquidity: { usd: 100_000 },
    info: { imageUrl: "https://cdn.dexscreener.com/cms/images/abc?width=800" },
    ...overrides,
  };
}

/** Serves the chain-scoped endpoint first, then the wider fallback. */
function serve(scoped: Pair[], wide: Pair[] = []) {
  return vi.fn(async (url: string) =>
    url.includes("/tokens/v1/")
      ? new Response(JSON.stringify(scoped), { status: 200 })
      : new Response(JSON.stringify({ pairs: wide }), { status: 200 }),
  );
}

beforeEach(async () => {
  delete (globalThis as { __dexCache?: unknown }).__dexCache;
});
afterEach(() => vi.unstubAllGlobals());

describe("resolving a token", () => {
  it("reads name, ticker and logo from the matching pair", async () => {
    vi.stubGlobal("fetch", serve([pair()]));
    const result = await fetchTokenMetadata(SOLANA, MINT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.name).toBe("Bonk");
    expect(result.metadata.ticker).toBe("BONK");
    expect(result.metadata.logoUrl).toContain("cdn.dexscreener.com");
  });

  it("keeps the logo's query string, which the CDN needs for sizing", async () => {
    vi.stubGlobal("fetch", serve([pair()]));
    const result = await fetchTokenMetadata(SOLANA, MINT);
    expect(result.ok && result.metadata.logoUrl).toContain("?width=800");
  });
});

describe("the token must be the base token of the pair", () => {
  it("rejects a pair where our address is only the quote side", async () => {
    // Real behaviour: query WHYPE and the top pair comes back with USDC as
    // base. Reading baseToken blindly would list the wrong token entirely.
    const wrong = pair({
      baseToken: { address: "SomeOtherMint1111111111111111111111111111111", name: "USDC", symbol: "USDC" },
      quoteToken: { address: MINT, symbol: "Bonk" },
    });
    vi.stubGlobal("fetch", serve([wrong], [wrong]));
    const result = await fetchTokenMetadata(SOLANA, MINT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("not_found");
  });

  it("falls back to the wider lookup when the scoped one is unusable", async () => {
    const wrong = pair({
      baseToken: { address: "SomeOtherMint1111111111111111111111111111111", name: "USDC", symbol: "USDC" },
    });
    vi.stubGlobal("fetch", serve([wrong], [pair()]));
    const result = await fetchTokenMetadata(SOLANA, MINT);
    expect(result.ok && result.metadata.name).toBe("Bonk");
  });
});

describe("the token must be on the selected chain", () => {
  it("rejects a pair from a different chain", async () => {
    vi.stubGlobal("fetch", serve([pair({ chainId: "pulsechain" })], [pair({ chainId: "pulsechain" })]));
    const result = await fetchTokenMetadata(SOLANA, MINT);
    expect(result.ok).toBe(false);
  });

  it("uses the chain's DexScreener id, not our own", async () => {
    const fetchMock = serve([]);
    vi.stubGlobal("fetch", fetchMock);
    await fetchTokenMetadata(getChain("hyperliquid")!, "0xdAC17F958D2ee523a2206206994597C13D831ec7");
    // Hyperliquid is "hyperevm" on DexScreener; querying "hyperliquid" silently
    // returns nothing forever.
    expect(fetchMock.mock.calls[0][0]).toContain("/tokens/v1/hyperevm/");
  });
});

describe("links", () => {
  it("strips tracking params and normalizes twitter.com to x.com", async () => {
    vi.stubGlobal(
      "fetch",
      serve([
        pair({
          info: {
            websites: [{ url: "https://bonkcoin.com/?utm_source=dex" }],
            socials: [
              { type: "twitter", url: "https://twitter.com/bonk_inu?s=21" },
              { type: "telegram", url: "https://t.me/Official_Bonk_Inu" },
            ],
          },
        }),
      ]),
    );
    const result = await fetchTokenMetadata(SOLANA, MINT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A root path keeps its slash; only deeper paths get trimmed.
    expect(result.metadata.links.website).toBe("https://bonkcoin.com/");
    expect(result.metadata.links.x).toBe("https://x.com/bonk_inu");
    expect(result.metadata.links.telegram).toBe("https://t.me/Official_Bonk_Inu");
  });

  it("drops a social that fails our own link rules rather than failing the bid", async () => {
    vi.stubGlobal(
      "fetch",
      serve([pair({ info: { socials: [{ type: "twitter", url: "https://bit.ly/whatever" }] } })]),
    );
    const result = await fetchTokenMetadata(SOLANA, MINT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.links.x).toBeUndefined();
  });

  it("drops a logo hosted anywhere other than DexScreener's CDN", async () => {
    vi.stubGlobal(
      "fetch",
      serve([pair({ info: { imageUrl: "https://tracker.example.com/pixel.png" } })]),
    );
    const result = await fetchTokenMetadata(SOLANA, MINT);
    expect(result.ok && result.metadata.logoUrl).toBeUndefined();
  });
});

describe("failure modes", () => {
  it("reports not_found when nothing matches", async () => {
    vi.stubGlobal("fetch", serve([], []));
    const result = await fetchTokenMetadata(BASE, "0xdAC17F958D2ee523a2206206994597C13D831ec7");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("not_found");
    expect(result.message).toMatch(/not found/i);
  });

  it("reports unavailable when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const result = await fetchTokenMetadata(SOLANA, MINT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("unavailable");
  });

  it("never invents an identity for a token with no name", async () => {
    vi.stubGlobal("fetch", serve([pair({ baseToken: { address: MINT, name: "", symbol: "" } })]));
    expect((await fetchTokenMetadata(SOLANA, MINT)).ok).toBe(false);
  });

  it("does not cache a transient outage", async () => {
    const failing = vi.fn(async () => { throw new Error("down"); });
    vi.stubGlobal("fetch", failing);
    await fetchTokenMetadata(SOLANA, MINT);

    vi.stubGlobal("fetch", serve([pair()]));
    const retry = await fetchTokenMetadata(SOLANA, MINT);
    expect(retry.ok).toBe(true);
  });
});
