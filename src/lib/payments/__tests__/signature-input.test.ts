import { describe, expect, it } from "vitest";
import { isSignatureShaped, parseSignatureInput } from "../signature-input";

// 64 bytes of base58 — the shape of a real Solana signature.
const SIG = "5".repeat(87);

describe("parseSignatureInput", () => {
  it("accepts a bare signature", () => {
    expect(parseSignatureInput(SIG)).toBe(SIG);
  });

  it("trims surrounding whitespace on a bare signature", () => {
    expect(parseSignatureInput(`  ${SIG}\n`)).toBe(SIG);
  });

  it("reads the signature out of a Solscan link", () => {
    expect(parseSignatureInput(`https://solscan.io/tx/${SIG}`)).toBe(SIG);
  });

  it("reads the signature out of a Solana.fm link", () => {
    expect(parseSignatureInput(`https://solana.fm/tx/${SIG}`)).toBe(SIG);
  });

  it("reads the signature out of an explorer.solana.com link", () => {
    expect(parseSignatureInput(`https://explorer.solana.com/tx/${SIG}`)).toBe(SIG);
  });

  it("ignores query params and hashes on an explorer link", () => {
    expect(parseSignatureInput(`https://explorer.solana.com/tx/${SIG}?cluster=mainnet-beta`)).toBe(SIG);
    expect(parseSignatureInput(`https://solana.fm/tx/${SIG}?cluster=mainnet-alpha#top`)).toBe(SIG);
  });

  it("accepts an explorer link pasted without its scheme, with www, or with a trailing slash", () => {
    expect(parseSignatureInput(`solscan.io/tx/${SIG}`)).toBe(SIG);
    expect(parseSignatureInput(`https://www.solscan.io/tx/${SIG}`)).toBe(SIG);
    expect(parseSignatureInput(`https://solscan.io/tx/${SIG}/`)).toBe(SIG);
    expect(parseSignatureInput(`  https://solscan.io/tx/${SIG}  `)).toBe(SIG);
  });

  it("rejects a URL that is not a known explorer", () => {
    expect(parseSignatureInput(`https://example.com/tx/${SIG}`)).toBeNull();
    // Lookalike host: the explorer's name as a prefix of somebody else's domain.
    expect(parseSignatureInput(`https://solscan.io.example.com/tx/${SIG}`)).toBeNull();
  });

  it("rejects an explorer URL that is not a transaction page", () => {
    expect(parseSignatureInput(`https://solscan.io/account/${SIG}`)).toBeNull();
    expect(parseSignatureInput("https://solscan.io/")).toBeNull();
    // Right host and path, but what sits in the tx slot is not a signature.
    expect(parseSignatureInput("https://solscan.io/tx/not-a-signature")).toBeNull();
  });

  it("rejects junk", () => {
    expect(parseSignatureInput("")).toBeNull();
    expect(parseSignatureInput("   ")).toBeNull();
    expect(parseSignatureInput("hello world")).toBeNull();
    // Base58-clean but the wrong length, which is how a truncated paste arrives.
    expect(parseSignatureInput("5".repeat(40))).toBeNull();
    // Contains characters outside the base58 alphabet (0, O, I, l).
    expect(parseSignatureInput("0OIl".repeat(22))).toBeNull();
  });
});

describe("isSignatureShaped", () => {
  it("accepts 64 base58-decoded bytes and rejects anything else", () => {
    expect(isSignatureShaped(SIG)).toBe(true);
    // 87 and 88 base58 characters both land on 64 bytes; length alone is not
    // the test, which is why this decodes rather than counting characters.
    expect(isSignatureShaped("5".repeat(88))).toBe(true);
    expect(isSignatureShaped("5".repeat(100))).toBe(false);
    expect(isSignatureShaped("")).toBe(false);
  });
});
