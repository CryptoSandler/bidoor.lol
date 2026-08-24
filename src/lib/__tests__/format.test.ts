import { describe, expect, it } from "vitest";
import { truncateAddress } from "../format";

describe("truncating a contract address", () => {
  it("keeps both ends, which is what makes an address recognisable", () => {
    // The real one from the board: the token everybody checks this against.
    expect(truncateAddress("9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump")).toBe("9cRC…pump");
  });

  it("leaves an address that is already short alone", () => {
    // Shortening to something longer than the original would be worse than not
    // shortening at all.
    expect(truncateAddress("abcdefgh")).toBe("abcdefgh");
    expect(truncateAddress("EQAbc")).toBe("EQAbc");
  });

  it("takes the ends from the real string, not a fixed slice of an EVM address", () => {
    expect(truncateAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x12…5678");
  });

  it("honours a wider window when one is asked for", () => {
    expect(truncateAddress("9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump", 6, 6)).toBe(
      "9cRCn9…TGpump",
    );
  });
});
