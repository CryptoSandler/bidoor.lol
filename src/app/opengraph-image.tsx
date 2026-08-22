import { ImageResponse } from "next/og";

/**
 * Static link preview. The product is shared as a link at least as often as a
 * screenshot, and an empty preview card wastes that. A per-token image is a
 * later job; this is the one that stops the card being blank.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "BIDOOR — pay-to-rank token leaderboard";

// The board's own values: neutral slate ground, neutral type, and one accent.
// Slime is a fill with dark ink on it — never letters — so the card obeys the
// same rule as the page, and it appears exactly once.
const GROUND = "#0f1316";
const SLIME = "#c6ff00";
const SLIME_INK = "#141210";
const INK = "#f1f5f8";
const MUTED = "#c8d1d8";

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
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* The lockup, exactly as the favicon draws it: the doorway is the
              podium. Slime here, because the mark is standing on the dark on its
              own — in the site header it goes neutral instead, since that row
              already spends its slime on the button. */}
          <svg width="72" height="72" viewBox="0 0 64 64">
            <path
              d="M14 58 L14 26 A18 18 0 0 1 50 26 L50 58"
              fill="none"
              stroke={SLIME}
              strokeWidth="8"
              strokeLinejoin="round"
            />
            <path
              d="M23 40 L32 30 L41 40"
              fill="none"
              stroke={SLIME}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="28" y="34" width="8" height="18" rx="2" fill={SLIME} />
          </svg>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
            BIDOOR
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
        {/* The payoff line is a slime slab, matching the headline figure on the
            board. Filled rather than coloured, like every other use of slime. */}
        <div style={{ display: "flex", marginTop: 6 }}>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1.02,
              background: SLIME,
              color: SLIME_INK,
              padding: "2px 18px",
              borderRadius: 12,
            }}
          >
            Nothing else.
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 34, fontSize: 29, color: MUTED }}>
          One board, every chain. The top bidoor sits at #1.
        </div>
      </div>
    ),
    size,
  );
}
