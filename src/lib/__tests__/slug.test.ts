import { describe, expect, it } from "vitest";
import { isSlugShaped, slugCandidates } from "../slug";

const ID = "entry_17e439cc-cfc7-4cd1-92d5-f73e98b0d236";

describe("choosing a token's short handle", () => {
  it("offers the ticker first, because that is what a community calls itself", () => {
    expect(slugCandidates("ANSEM", ID)[0]).toBe("ansem");
  });

  it("offers a suffixed form next, since tickers are not unique", () => {
    // Anyone can deploy a second $PEPE. First to list keeps the bare ticker.
    const [first, second, third] = slugCandidates("PEPE", ID);
    expect(first).toBe("pepe");
    expect(second).toBe("pepe-17e439");
    expect(third).toBe("17e439");
  });

  it("always ends with something derived from the entry id", () => {
    // The last candidate cannot collide, so a slug always exists.
    const candidates = slugCandidates("ANSEM", ID);
    expect(candidates[candidates.length - 1]).toBe("17e439");
  });

  it("strips whatever would not survive a URL", () => {
    expect(slugCandidates("Wrapped BTC!", ID)[0]).toBe("wrappedbtc");
    expect(slugCandidates("$PEPE 2.0", ID)[0]).toBe("pepe20");
  });

  it("falls back to the id when a ticker leaves nothing usable", () => {
    expect(slugCandidates("🚀🚀🚀", ID)).toEqual(["17e439"]);
    expect(slugCandidates("", ID)).toEqual(["17e439"]);
  });

  it("never hands out a slug that is already a route", () => {
    // /t/api or /t/admin would read as ours rather than a token's.
    for (const reserved of ["api", "admin", "bid", "rules", "stats", "go", "og", "t"]) {
      expect(slugCandidates(reserved, ID)).toEqual(["17e439"]);
    }
  });

  it("keeps a very long ticker to a readable length", () => {
    expect(slugCandidates("A".repeat(60), ID)[0]).toHaveLength(20);
  });
});

describe("recognising a slug", () => {
  it("accepts what we issue", () => {
    expect(isSlugShaped("ansem")).toBe(true);
    expect(isSlugShaped("pepe-17e439")).toBe(true);
    expect(isSlugShaped("17e439")).toBe(true);
  });

  it("rejects what we never issue, before it reaches the database", () => {
    expect(isSlugShaped("")).toBe(false);
    expect(isSlugShaped("-leading")).toBe(false);
    expect(isSlugShaped("has space")).toBe(false);
    expect(isSlugShaped("UPPER")).toBe(false);
    expect(isSlugShaped("../etc/passwd")).toBe(false);
    expect(isSlugShaped("a".repeat(40))).toBe(false);
  });
});
