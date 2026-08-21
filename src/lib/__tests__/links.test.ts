import { describe, expect, it } from "vitest";
import { normalizeLink, normalizeXHandle } from "../links";

describe("query params", () => {
  it("strips tracking params from a launchpad link", async () => {
    const result = normalizeLink(
      "https://pump.fun/coin/abc?utm_source=x&ref=someguy",
      "launchpad",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toBe("https://pump.fun/coin/abc");
    expect(result.strippedParams).toEqual(["utm_source", "ref"]);
  });

  it("collapses links that differ only by params into one canonical URL", async () => {
    const a = normalizeLink("https://four.meme/token/0xabc?ref=alice", "launchpad");
    const b = normalizeLink("https://four.meme/token/0xabc?ref=bob", "launchpad");
    expect(a.ok && b.ok && a.url === b.url).toBe(true);
  });

  it("keeps the path, which is what distinguishes two tokens on one launchpad", async () => {
    const a = normalizeLink("https://pump.fun/coin/aaa", "launchpad");
    const b = normalizeLink("https://pump.fun/coin/bbb", "launchpad");
    expect(a.ok && b.ok && a.url !== b.url).toBe(true);
  });

  it("normalizes www, casing and trailing slashes", async () => {
    const a = normalizeLink("https://WWW.Pump.Fun/coin/abc/", "launchpad");
    const b = normalizeLink("pump.fun/coin/abc", "launchpad");
    expect(a.ok && b.ok && a.url === b.url).toBe(true);
  });
});

describe("shorteners", () => {
  it.each(["bit.ly/abc", "https://t.co/xyz", "tinyurl.com/foo", "linktr.ee/proj"])(
    "rejects %s",
    (link) => {
      expect(normalizeLink(link, "website").ok).toBe(false);
    },
  );
});

describe("chat links", () => {
  it("rejects a telegram invite in the launchpad field", async () => {
    expect(normalizeLink("https://t.me/somegroup", "launchpad").ok).toBe(false);
  });

  it("rejects a discord invite in the website field", async () => {
    expect(normalizeLink("https://discord.gg/abc", "website").ok).toBe(false);
  });

  it("allows telegram in the telegram field", async () => {
    expect(normalizeLink("https://t.me/somegroup", "telegram").ok).toBe(true);
  });
});

describe("x handles", () => {
  it("accepts a bare @handle", async () => {
    const result = normalizeXHandle("@somebody");
    expect(result.ok && result.url).toBe("https://x.com/somebody");
  });

  it("maps twitter.com to x.com so both forms are one identity", async () => {
    const a = normalizeXHandle("https://twitter.com/somebody");
    const b = normalizeXHandle("https://x.com/somebody?s=21");
    expect(a.ok && b.ok && a.url === b.url).toBe(true);
  });

  it("rejects a non-X profile", async () => {
    expect(normalizeXHandle("https://facebook.com/somebody").ok).toBe(false);
  });
});
