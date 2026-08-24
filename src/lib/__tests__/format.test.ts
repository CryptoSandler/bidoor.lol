import { describe, expect, it } from "vitest";
import { timeAgoLong, truncateAddress } from "../format";

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

describe("spelling out how long ago something happened", () => {
  const now = Date.parse("2026-08-24T12:00:00Z");
  const ago = (ms: number) => timeAgoLong(new Date(now - ms).toISOString(), now);

  it("says just now for under a minute", () => {
    expect(ago(0)).toBe("just now");
    expect(ago(59_000)).toBe("just now");
  });

  it("counts minutes, hours, days and months in words", () => {
    expect(ago(4 * 60_000)).toBe("4 minutes ago");
    expect(ago(3 * 3_600_000)).toBe("3 hours ago");
    expect(ago(2 * 86_400_000)).toBe("2 days ago");
    expect(ago(60 * 86_400_000)).toBe("2 months ago");
  });

  it("does not say 1 minutes", () => {
    expect(ago(60_000)).toBe("1 minute ago");
    expect(ago(3_600_000)).toBe("1 hour ago");
    expect(ago(86_400_000)).toBe("1 day ago");
  });

  it("never reads as the future when a clock is a little ahead", () => {
    expect(timeAgoLong(new Date(now + 5_000).toISOString(), now)).toBe("just now");
  });
});
