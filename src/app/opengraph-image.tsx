import { ImageResponse } from "next/og";

/**
 * Static link preview. The product is shared as a link at least as often as a
 * screenshot, and an empty preview card wastes that. A per-token image is a
 * later job; this is the one that stops the card being blank.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "BIDOOR — pay-to-rank token leaderboard";

// Same duotone as the board: deep blue ground, pale green ink, slime for the
// line that carries the product, sky for the wordmark's second half.
const GROUND = "#002b66";
const SLIME = "#c6ff00";
const SKY = "#00a8f0";
const INK = "#e8ffa8";
const MUTED = "#7fdcf7";

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
          background: GROUND,
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* The same mark as the favicon: a bid stepping up off a floor. */}
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              borderRadius: 14,
              background: SLIME,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="64" height="64" viewBox="0 0 64 64">
              <path
                d="M14 34 L32 16 L50 34"
                fill="none"
                stroke={GROUND}
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="18" y="43" width="28" height="7" rx="3.5" fill={GROUND} opacity="0.75" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
            BID<span style={{ color: SKY }}>OOR</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 34,
            fontSize: 84,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.02,
          }}
        >
          Rank is the bid.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            letterSpacing: -3,
            color: SLIME,
            lineHeight: 1.02,
          }}
        >
          Nothing else.
        </div>

        <div style={{ display: "flex", marginTop: 34, fontSize: 29, color: MUTED }}>
          One board, every chain. The top bidoor sits at #1.
        </div>
      </div>
    ),
    size,
  );
}
