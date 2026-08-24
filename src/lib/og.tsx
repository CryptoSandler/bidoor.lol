/**
 * Shared furniture for the link-preview cards.
 *
 * Two cards use it: the site-wide one and the per-token one, which is what a
 * community shares when it posts its own row. They have to look like the same
 * product, so the ground, the type and the single accent live here rather than
 * being retyped in each.
 *
 * The board's own values: neutral slate ground, neutral type, one accent. Slime
 * is a fill with dark ink on it, never letters, so these obey the same contrast
 * rule as the page.
 */
export const OG_SIZE = { width: 1200, height: 630 };

export const GROUND = "#0f1316";
export const SLIME = "#c6ff00";
export const SLIME_INK = "#141210";
export const INK = "#f1f5f8";
export const MUTED = "#c8d1d8";
export const CARD = "#161b1f";
export const LINE = "#242c31";

/**
 * The wordmark, drawn at whatever width is asked for.
 *
 * Coordinates are pre-skewed rather than transformed, because these cards are
 * rendered by Satori and a transform on a group is not something to bet the
 * brand on.
 */
export function OgWordmark({ width = 430 }: { width?: number }) {
  return (
    <svg width={width} height={(width * 84) / 430} viewBox="-26 -10 680 120">
      <path
        d="M0.00,0 L26.00,0 L19.20,32 L51.20,32 L64.22,46 L55.72,86 L36.74,100 L-21.26,100 Z M14.95,52 L38.95,52 L33.00,80 L9.00,80 Z M83.15,4 L109.15,4 L104.47,26 L78.47,26 Z M77.20,32 L103.20,32 L88.74,100 L62.74,100 Z  M168.00,0 L194.00,0 L172.74,100 L114.74,100 L101.72,86 L110.22,46 L129.20,32 L161.20,32 Z M132.95,52 L156.95,52 L151.00,80 L127.00,80 Z M213.20,32 L255.20,32 L268.22,46 L259.72,86 L240.74,100 L198.74,100 L185.72,86 L194.22,46 Z M216.95,52 L242.95,52 L237.00,80 L211.00,80 Z M297.20,32 L339.20,32 L352.22,46 L343.72,86 L324.74,100 L282.74,100 L269.72,86 L278.22,46 Z M300.95,52 L326.95,52 L321.00,80 L295.00,80 Z M365.20,32 L419.20,32 L414.10,56 L386.10,56 L376.74,100 L350.74,100 Z"
        fill={INK}
        fillRule="evenodd"
      />
      <path
        d="M479.00,0 L505.00,0 L483.74,100 L457.74,100 Z  M524.20,32 L566.20,32 L579.22,46 L570.72,86 L551.74,100 L509.74,100 L496.72,86 L505.22,46 Z M527.95,52 L553.95,52 L548.00,80 L522.00,80 Z M599.00,0 L625.00,0 L603.74,100 L577.74,100 Z"
        fill={INK}
        fillRule="evenodd"
      />
      {/* The one accent in the lockup, kept round rather than leaned. */}
      <circle cx="429.51" cy="87" r="13" fill={SLIME} />
    </svg>
  );
}

/**
 * The site-wide card. Also the fallback for a token we cannot draw — a card
 * that says the right thing about the product beats a broken or half-empty one
 * about a token.
 */
export function OgGeneric() {
  return (
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
      <OgWordmark />

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
  );
}

/**
 * One token's card: its logo, where it sits, what it has paid, and what taking
 * the spot costs. The point is that a community sharing its own row gets its
 * own rank in the preview instead of our generic pitch.
 */
export function OgToken({
  name,
  ticker,
  logoUrl,
  rank,
  totalUsd,
  priceToClaim,
}: {
  name: string;
  ticker: string;
  logoUrl: string;
  rank: number;
  totalUsd: string;
  priceToClaim: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: GROUND,
        color: INK,
        fontFamily: "sans-serif",
      }}
    >
      <OgWordmark width={250} />

      <div style={{ display: "flex", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          width={168}
          height={168}
          style={{ width: 168, height: 168, borderRadius: 999, objectFit: "cover" }}
        />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 36, maxWidth: 800 }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div
              style={{
                display: "flex",
                fontSize: 60,
                fontWeight: 700,
                letterSpacing: -2,
                lineHeight: 1.05,
              }}
            >
              {name.length > 22 ? `${name.slice(0, 21)}…` : name}
            </div>
            <div style={{ display: "flex", marginLeft: 18, fontSize: 30, color: MUTED }}>
              {ticker}
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 14, alignItems: "center" }}>
            {/* Rank is the number the whole card exists to show, so it gets the
                slime slab — the one place it appears here. */}
            <div
              style={{
                display: "flex",
                fontSize: 56,
                fontWeight: 700,
                letterSpacing: -2,
                background: SLIME,
                color: SLIME_INK,
                padding: "0 16px",
                borderRadius: 12,
              }}
            >
              #{rank}
            </div>
            <div style={{ display: "flex", marginLeft: 20, fontSize: 40, color: MUTED }}>
              with {totalUsd} paid
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `2px solid ${LINE}`,
          paddingTop: 30,
        }}
      >
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
          Claim #{rank} for {priceToClaim}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: MUTED }}>bidoor.lol</div>
      </div>
    </div>
  );
}
