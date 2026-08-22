import { ImageResponse } from "next/og";

/**
 * Static link preview. The product is shared as a link at least as often as a
 * screenshot, and an empty preview card wastes that. A per-token image is a
 * later job; this is the one that stops the card being blank.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "BIDOOR.LOL — pay-to-rank token leaderboard";

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
        <svg width="470" height="84" viewBox="-26 -10 700 120">
          <path d="M0.00,0.00 L58.00,0.00 L70.60,16.00 L66.35,36.00 L53.37,50.00 L60.40,64.00 L56.15,84.00 L36.74,100.00 L-21.26,100.00 Z M21.75,20.00 L43.75,20.00 L39.50,40.00 L17.50,40.00 Z M13.25,60.00 L35.25,60.00 L31.00,80.00 L9.00,80.00 Z M84.00,0.00 L110.00,0.00 L88.74,100.00 L62.74,100.00 Z" fill={INK} fillRule="evenodd" />
          <path d="M126.00,0.00 L184.00,0.00 L197.75,20.00 L185.00,80.00 L162.74,100.00 L104.74,100.00 Z M147.32,22.00 L171.32,22.00 L159.42,78.00 L135.42,78.00 Z M230.00,0.00 L270.00,0.00 L283.75,20.00 L271.00,80.00 L248.74,100.00 L208.74,100.00 L195.00,80.00 L207.75,20.00 Z M232.90,24.00 L256.90,24.00 L245.85,76.00 L221.85,76.00 Z M316.00,0.00 L356.00,0.00 L369.75,20.00 L357.00,80.00 L334.74,100.00 L294.74,100.00 L281.00,80.00 L293.75,20.00 Z M318.90,24.00 L342.90,24.00 L331.85,76.00 L307.85,76.00 Z M384.00,0.00 L442.00,0.00 L456.17,18.00 L451.50,40.00 L430.10,56.00 L438.74,100.00 L410.74,100.00 L405.67,58.00 L397.67,58.00 L388.74,100.00 L362.74,100.00 Z M405.75,20.00 L429.75,20.00 L425.92,38.00 L401.92,38.00 Z" fill={INK} fillRule="evenodd" />
          <path d="M500.92,38.00 L517.04,38.00 L507.29,83.88 L529.61,83.88 L526.18,100.00 L487.74,100.00 Z M556.72,38.00 L581.52,38.00 L590.05,50.40 L582.14,87.60 L568.34,100.00 L543.54,100.00 L535.02,87.60 L542.93,50.40 Z M558.52,52.88 L573.40,52.88 L566.55,85.12 L551.67,85.12 Z M598.88,38.00 L615.00,38.00 L605.25,83.88 L627.57,83.88 L624.14,100.00 L585.70,100.00 Z" fill={INK} fillRule="evenodd" />
          {/* The one accent in the lockup: the dot, kept round rather than
              leaned, because a skewed circle is an ellipse. */}
          <circle cx="461.51" cy="87" r="13" fill={SLIME} />
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
