import { describe, expect, it } from "vitest";
import { BANNER_WIDTH, bannerSources } from "../banner";

const REAL =
  "https://cdn.dexscreener.com/cms/images/CDccAieupEUVPNwC?width=1500&height=500&quality=95&format=auto";

describe("sizing the row banner", () => {
  it("requests the width that measured sharpest, not the one it ships as", () => {
    // 900 beat 1500, 600 and 300 on every banner on the board, at both pixel
    // ratios. Guessing "about what we paint" would have been worse than doing
    // nothing, so this number is measured and the test pins it.
    const url = new URL(bannerSources(REAL).src);
    expect(url.searchParams.get("width")).toBe(String(BANNER_WIDTH));
    expect(BANNER_WIDTH).toBe(900);
  });

  it("keeps the banner's own 3:1 ratio, which the resizer requires", () => {
    // DexScreener answers 422 outside its allowlist: 750x250 and 1200x400 are
    // both refused, 900x300 is served for every banner we have.
    const url = new URL(bannerSources(REAL).src);
    expect(url.searchParams.get("height")).toBe("300");
  });

  it("never asks for more than the source holds", () => {
    const width = Number(new URL(bannerSources(REAL).src).searchParams.get("width"));
    expect(width).toBeLessThanOrEqual(1500);
  });

  it("keeps the rest of DexScreener's parameters", () => {
    const { src } = bannerSources(REAL);
    expect(src).toContain("quality=95");
    expect(src).toContain("format=auto");
  });

  it("passes through a host whose resizing API we do not know", () => {
    const other = "https://example.com/banner.png?width=1500";
    expect(bannerSources(other)).toEqual({ src: other });
  });

  it("passes through a DexScreener URL that carries no size parameters", () => {
    const bare = "https://cdn.dexscreener.com/cms/images/abc";
    expect(bannerSources(bare)).toEqual({ src: bare });
  });

  it("passes through something that is not a URL at all", () => {
    expect(bannerSources("not a url")).toEqual({ src: "not a url" });
  });
});
