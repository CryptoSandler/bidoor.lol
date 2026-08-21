import { ImageResponse } from "next/og";

/**
 * Static link preview. The product is shared as a link at least as often as a
 * screenshot, and an empty preview card wastes that. A per-token image is a
 * later job; this is the one that stops the card being blank.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "BIDTAPE — pay-to-rank token leaderboard";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#fffdfa",
          color: "#282624",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
          BID<span style={{ color: "#e8502d" }}>TAPE</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 82,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.05,
          }}
        >
          Pay to rank.
        </div>
        <div style={{ display: "flex", fontSize: 82, fontWeight: 700, letterSpacing: -3, color: "#e8502d" }}>
          Rank is the bid.
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 30, color: "#67625d" }}>
          One board, every chain — Solana, Base, BNB, Ethereum, TON, TRON, Hyperliquid, Robinhood.
        </div>
      </div>
    ),
    size,
  );
}
