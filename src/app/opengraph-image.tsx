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
        {/* The wordmark itself is the mark now. Coordinates are pre-skewed
            rather than transformed, because the card is rendered by Satori and
            a transform on a group is not something to bet the brand on. */}
        <svg width="418" height="100" viewBox="-26 -10 502 120">
          <path d="M0.00,0 L58.00,0 L70.60,16 L66.35,36 L53.37,50 L60.40,64 L56.15,84 L36.74,100 L-21.26,100 Z M21.75,20 L43.75,20 L39.50,40 L17.50,40 Z M13.25,60 L35.25,60 L31.00,80 L9.00,80 Z M84.00,0 L110.00,0 L88.74,100 L62.74,100 Z" fill={INK} fillRule="evenodd" />
          <path d="M126.00,0 L184.00,0 L197.75,20 L185.00,80 L162.74,100 L104.74,100 Z M147.32,22 L171.32,22 L159.42,78 L135.42,78 Z M230.00,0 L270.00,0 L283.75,20 L271.00,80 L248.74,100 L208.74,100 L195.00,80 L207.75,20 Z M232.90,24 L256.90,24 L245.85,76 L221.85,76 Z M316.00,0 L356.00,0 L369.75,20 L357.00,80 L334.74,100 L294.74,100 L281.00,80 L293.75,20 Z M318.90,24 L342.90,24 L331.85,76 L307.85,76 Z M384.00,0 L442.00,0 L456.17,18 L451.50,40 L430.10,56 L438.74,100 L410.74,100 L405.67,58 L397.67,58 L388.74,100 L362.74,100 Z M405.75,20 L429.75,20 L425.92,38 L401.92,38 Z" fill={SLIME} fillRule="evenodd" />
        </svg>

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
