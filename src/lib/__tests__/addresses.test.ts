import { describe, expect, it } from "vitest";
import { base58Decode, base58Encode } from "../base58";
import { checkAddress } from "../addresses";

const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WSOL = "So11111111111111111111111111111111111111112";
const USDT_ETH = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TON_EQ = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
const TON_UQ = "UQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_p0p";

describe("base58", () => {
  it("round-trips a 32-byte mint", () => {
    const bytes = base58Decode(USDC_SOL)!;
    expect(bytes).toHaveLength(32);
    expect(base58Encode(bytes)).toBe(USDC_SOL);
  });

  it("preserves leading zero bytes", () => {
    const bytes = base58Decode(WSOL)!;
    expect(bytes).toHaveLength(32);
    expect(base58Encode(bytes)).toBe(WSOL);
  });
});

describe("solana addresses", () => {
  it("accepts real mints", () => {
    expect(checkAddress("solana", USDC_SOL).ok).toBe(true);
    expect(checkAddress("solana", WSOL).ok).toBe(true);
  });

  it("rejects an EVM address submitted as Solana", () => {
    expect(checkAddress("solana", USDT_ETH).ok).toBe(false);
  });

  it("rejects a mint that does not decode to 32 bytes", () => {
    expect(checkAddress("solana", USDC_SOL.slice(0, -2)).ok).toBe(false);
    expect(checkAddress("solana", USDC_SOL + "aa").ok).toBe(false);
  });

  // Documents a real limit: base58 is dense, so lopping one character off a
  // 44-char mint still decodes to 32 bytes. Format validation cannot catch it —
  // only an on-chain lookup can. See DECISIONES.md.
  it("cannot catch a single-character truncation", () => {
    expect(checkAddress("solana", USDC_SOL.slice(0, -1)).ok).toBe(true);
  });
});

describe("evm addresses", () => {
  it("accepts checksummed and lowercase forms", () => {
    expect(checkAddress("evm", USDT_ETH).ok).toBe(true);
    expect(checkAddress("evm", USDT_ETH.toLowerCase()).ok).toBe(true);
  });

  it("collapses casing into one canonical key", () => {
    const a = checkAddress("evm", USDT_ETH);
    const b = checkAddress("evm", USDT_ETH.toLowerCase());
    expect(a.ok && b.ok && a.canonical === b.canonical).toBe(true);
  });

  it("rejects a Solana mint submitted as EVM", () => {
    expect(checkAddress("evm", USDC_SOL).ok).toBe(false);
  });
});

describe("tron addresses", () => {
  it("accepts a real contract", () => {
    expect(checkAddress("tron", USDT_TRON).ok).toBe(true);
  });

  it("rejects a short address", () => {
    expect(checkAddress("tron", USDT_TRON.slice(0, -1)).ok).toBe(false);
  });
});

describe("ton addresses", () => {
  it("accepts user-friendly and raw forms", () => {
    expect(checkAddress("ton", TON_EQ).ok).toBe(true);
    expect(
      checkAddress("ton", "0:b113a994cd5025016719f691393928eb75959b0e28975902c51d0feccc3621d1").ok,
    ).toBe(true);
  });

  it("rejects a checksum typo", () => {
    expect(checkAddress("ton", TON_EQ.slice(0, -1) + "t").ok).toBe(false);
  });

  it("collapses bounceable and non-bounceable into one entry", () => {
    const eq = checkAddress("ton", TON_EQ);
    const uq = checkAddress("ton", TON_UQ);
    expect(eq.ok && uq.ok && eq.canonical === uq.canonical).toBe(true);
  });
});
