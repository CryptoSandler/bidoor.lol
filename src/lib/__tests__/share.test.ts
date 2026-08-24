import { describe, expect, it } from "vitest";
import { rowAnchor, shareText, shareUrl, tweetIntent } from "../share";

describe("the text of a shared row", () => {
  it("reads as the row does", () => {
    expect(shareText("ANSEM", 1, "$2.00")).toBe(
      "$ANSEM is #1 on bidoor.lol — take the spot for $2.00",
    );
  });

  it("does not double the dollar sign on a ticker that already has one", () => {
    expect(shareText("$SMOLCAT", 4, "$13.00")).toBe(
      "$SMOLCAT is #4 on bidoor.lol — take the spot for $13.00",
    );
  });
});

describe("the URL a shared row points at", () => {
  it("is the board, naming and anchoring the row", () => {
    const url = shareUrl("entry_123", "https://bidoor.lol");
    expect(url).toBe("https://bidoor.lol/?t=entry_123#row-entry_123");
  });

  it("does not invent a second slash when the origin carries one", () => {
    expect(shareUrl("entry_123", "https://bidoor.lol/")).toBe(
      "https://bidoor.lol/?t=entry_123#row-entry_123",
    );
  });

  it("falls back to a relative URL when no origin is known", () => {
    expect(shareUrl("entry_123", "")).toBe("/?t=entry_123#row-entry_123");
  });

  it("escapes an id rather than trusting it in a URL", () => {
    expect(shareUrl("a b&c", "https://bidoor.lol")).toContain("t=a%20b%26c");
  });

  it("anchors on the row", () => {
    expect(rowAnchor("entry_123")).toBe("row-entry_123");
  });
});

describe("the post intent", () => {
  const intent = tweetIntent({
    ticker: "ANSEM",
    rank: 1,
    priceToClaim: "$2.00",
    id: "entry_123",
    origin: "https://bidoor.lol",
  });

  it("goes to X with the text and the URL as separate parameters", () => {
    const url = new URL(intent);
    expect(url.origin + url.pathname).toBe("https://x.com/intent/post");
    // Separate, because X counts and shortens the URL itself; inside the text
    // it would be counted twice.
    expect(url.searchParams.get("text")).toBe(
      "$ANSEM is #1 on bidoor.lol — take the spot for $2.00",
    );
    expect(url.searchParams.get("url")).toBe("https://bidoor.lol/?t=entry_123#row-entry_123");
  });

  it("encodes the whole thing exactly once", () => {
    expect(intent).not.toContain("%2520");
    expect(intent).toContain("x.com/intent/post?text=");
  });
});
