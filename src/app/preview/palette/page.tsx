import type { Metadata } from "next";

/**
 * Palette preview. Touches nothing the real board uses — every colour here is a
 * local constant, and tokens.css is untouched. Delete this route once a variant
 * is chosen.
 */
export const metadata: Metadata = {
  title: "Palette preview — BIDOOR",
  robots: { index: false, follow: false },
};

type Palette = {
  key: string;
  name: string;
  note: string;
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  /** Money and action. */
  slime: string;
  slimeInk: string;
  slimeTint: string;
  /** Navigation and information. */
  sky: string;
  skyTint: string;
};

const VARIANTS: Palette[] = [
  {
    key: "acid",
    name: "1 · Full acid",
    note: "Maximum voltage. The green is the brightest of the three and reads as lit rather than painted.",
    bg: "#141210",
    surface: "#1e1a17",
    surface2: "#282320",
    text: "#f5f3f0",
    muted: "#a8a29b",
    faint: "#7c766f",
    border: "#ffffff1f",
    slime: "#C6FF00",
    slimeInk: "#0A0F00",
    slimeTint: "#232a05",
    sky: "#00A8F0",
    skyTint: "#06222e",
  },
  {
    key: "deep",
    name: "2 · Deep",
    note: "Green pulled toward olive, blue softened. Less shouty, holds up better on a big surface.",
    bg: "#141210",
    surface: "#1e1a17",
    surface2: "#282320",
    text: "#f5f3f0",
    muted: "#a8a29b",
    faint: "#7c766f",
    border: "#ffffff1f",
    slime: "#AEEA00",
    slimeInk: "#0A0F00",
    slimeTint: "#1f2605",
    sky: "#29B6F6",
    skyTint: "#0a2430",
  },
  {
    key: "washed",
    name: "3 · Washed",
    note: "Both accents lifted toward pastel. Calmest, and the furthest from the reference's register.",
    bg: "#141210",
    surface: "#1e1a17",
    surface2: "#282320",
    text: "#f5f3f0",
    muted: "#a8a29b",
    faint: "#7c766f",
    border: "#ffffff1f",
    slime: "#B2FF59",
    slimeInk: "#0A1200",
    slimeTint: "#22300f",
    sky: "#41C6F0",
    skyTint: "#0c2833",
  },
];

const CHAINS = [
  { short: "SOL", tintOn: true },
  { short: "BASE", tintOn: true },
  { short: "BNB", tintOn: true },
];

export default function PalettePreview() {
  return (
    <div style={{ background: "#0b0a09", minHeight: "100dvh", padding: "32px 16px" }}>
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
        <h1
          style={{
            color: "#f5f3f0",
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Palette preview
        </h1>
        <p style={{ color: "#a8a29b", fontSize: "0.875rem", marginTop: 8, maxWidth: "42rem", lineHeight: 1.6 }}>
          Three intensities of the same two-accent idea. <strong style={{ color: "#f5f3f0" }}>Slime is
          money and action</strong> — the wordmark, the CTA, every amount, and the #1 row.{" "}
          <strong style={{ color: "#f5f3f0" }}>Sky is navigation and information</strong> — links,
          chain chips, the activity dot, secondary state. They never appear on the same element.
        </p>
        <p style={{ color: "#7c766f", fontSize: "0.8125rem", marginTop: 12, maxWidth: "42rem", lineHeight: 1.6 }}>
          Rendered on a dark ground, which is what these accents need: every one of them fails
          contrast on the current cream background. Choosing any of these means the board becomes
          dark-first — see the note under the variants.
        </p>

        {VARIANTS.map((p) => (
          <Variant key={p.key} p={p} />
        ))}

        <Footnote />
      </div>
    </div>
  );
}

function Variant({ p }: { p: Palette }) {
  const mono =
    'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

  return (
    <section style={{ marginTop: 40 }}>
      <h2 style={{ color: "#f5f3f0", fontSize: "1rem", fontWeight: 700 }}>{p.name}</h2>
      <p style={{ color: "#a8a29b", fontSize: "0.8125rem", marginTop: 4 }}>{p.note}</p>
      <p style={{ color: "#7c766f", fontSize: "0.75rem", marginTop: 4, fontFamily: mono }}>
        slime {p.slime} · sky {p.sky} · ink {p.slimeInk}
      </p>

      <div
        style={{
          marginTop: 12,
          background: p.bg,
          border: `1px solid ${p.border}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: `1px solid ${p.border}`,
          }}
        >
          <span style={{ color: p.text, fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            BID<span style={{ color: p.slime }}>OOR</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 16, fontSize: "0.875rem" }}>
            <span style={{ color: p.sky }}>Leaderboard</span>
            <span style={{ color: p.sky }}>Rules</span>
            <span
              style={{
                background: p.slime,
                color: p.slimeInk,
                padding: "5px 14px",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: "0.8125rem",
              }}
            >
              Bid
            </span>
          </span>
        </div>

        {/* Hero */}
        <div style={{ padding: "24px 16px", textAlign: "center" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: p.surface2,
              color: p.muted,
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: "0.75rem",
              fontFamily: mono,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: p.sky }} />
            42 tokens on the board · $54.7k bid to date
          </span>

          <div
            style={{
              marginTop: 18,
              color: p.text,
              fontSize: "3rem",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Claim #1 for <span style={{ color: p.slime }}>$8,755</span>
          </div>

          <p style={{ color: p.muted, fontSize: "0.875rem", marginTop: 10, lineHeight: 1.6 }}>
            <span style={{ color: p.slime }}>New listings start at $1.</span> Paying less than #1
            still puts you on the board, at whatever rank your total buys.
          </p>

          <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
            <span
              style={{
                flex: "0 1 320px",
                border: `1px solid ${p.border}`,
                background: p.surface,
                color: p.faint,
                padding: "11px 16px",
                borderRadius: 999,
                fontSize: "0.875rem",
                textAlign: "left",
                fontFamily: mono,
              }}
            >
              Paste a token contract address
            </span>
            <span
              style={{
                background: p.slime,
                color: p.slimeInk,
                padding: "11px 22px",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: "0.875rem",
                whiteSpace: "nowrap",
              }}
            >
              Become the top bidoor
            </span>
          </div>
        </div>

        {/* Panels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 16px 16px" }}>
          {[
            { title: "Trending right now", dot: p.sky, rows: [["Bonk", "18k clicks"], ["Brett", "13k clicks"]] },
            { title: "Latest activity", dot: p.sky, rows: [["Degen", "$420"], ["Bonk", "$1,450"]] },
          ].map((panel) => (
            <div
              key={panel.title}
              style={{
                border: `1px solid ${p.border}`,
                background: p.surface,
                borderRadius: 14,
                padding: "10px 14px",
              }}
            >
              <div style={{ color: p.text, fontWeight: 700, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: panel.dot }} />
                {panel.title}
              </div>
              {panel.rows.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "7px 0",
                    borderBottom: `1px solid ${p.border}`,
                    fontSize: "0.8125rem",
                    color: p.text,
                  }}
                >
                  <span>{label}</span>
                  <span style={{ color: value.startsWith("$") ? p.slime : p.faint, fontFamily: mono }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Podium */}
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { rank: 1, name: "Bonk", ticker: "BONK", chain: 0, amount: "$8,750", leader: true },
            { rank: 2, name: "Brett", ticker: "BRETT", chain: 1, amount: "$7,300", leader: false },
            { rank: 3, name: "PancakeSwap Token", ticker: "CAKE", chain: 2, amount: "$6,300", leader: false },
          ].map((row) => (
            <div
              key={row.rank}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 14,
                background: row.leader ? p.slimeTint : p.surface,
                border: `1px solid ${row.leader ? p.slime + "55" : p.border}`,
              }}
            >
              <span
                style={{
                  background: p.slime,
                  color: p.slimeInk,
                  padding: "2px 9px",
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  fontFamily: mono,
                }}
              >
                #{row.rank}
              </span>
              <span style={{ width: 40, height: 40, borderRadius: 999, background: p.surface2 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: p.text, fontWeight: 700 }}>{row.name}</span>
                  <span style={{ color: p.faint, fontSize: "0.6875rem", fontFamily: mono }}>{row.ticker}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span
                    style={{
                      background: p.skyTint,
                      color: p.sky,
                      padding: "1px 7px",
                      borderRadius: 4,
                      fontSize: "0.6875rem",
                      fontWeight: 500,
                    }}
                  >
                    {CHAINS[row.chain].short}
                  </span>
                  <span style={{ color: p.faint, fontSize: "0.6875rem", fontFamily: mono }}>18k clicks</span>
                </span>
              </span>
              <span style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "block",
                    color: p.slime,
                    fontWeight: 700,
                    fontSize: row.leader ? "1.25rem" : "1.125rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.amount}
                </span>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 4,
                    border: `1px solid ${p.border}`,
                    color: p.muted,
                    padding: "1px 8px",
                    borderRadius: 999,
                    fontSize: "0.6875rem",
                    fontFamily: mono,
                  }}
                >
                  Take #{row.rank} · {row.amount}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Flat rows */}
        <div style={{ padding: "0 16px 20px" }}>
          {[
            { rank: 4, name: "Pepe", ticker: "PEPE", amount: "$5,620" },
            { rank: 5, name: "Notcoin", ticker: "NOT", amount: "$4,500" },
          ].map((row) => (
            <div
              key={row.rank}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: `1px solid ${p.border}`,
              }}
            >
              <span style={{ color: p.faint, width: 24, textAlign: "center", fontFamily: mono, fontSize: "0.875rem" }}>
                {row.rank}
              </span>
              <span style={{ width: 32, height: 32, borderRadius: 999, background: p.surface2 }} />
              <span style={{ flex: 1 }}>
                <span style={{ color: p.text, fontWeight: 700, fontSize: "0.9375rem" }}>{row.name}</span>{" "}
                <span style={{ color: p.faint, fontSize: "0.6875rem", fontFamily: mono }}>{row.ticker}</span>
                <span style={{ display: "block", marginTop: 3 }}>
                  <span
                    style={{
                      background: p.skyTint,
                      color: p.sky,
                      padding: "1px 7px",
                      borderRadius: 4,
                      fontSize: "0.6875rem",
                    }}
                  >
                    ETH
                  </span>
                </span>
              </span>
              <span style={{ color: p.slime, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {row.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footnote() {
  return (
    <div
      style={{
        marginTop: 40,
        padding: 18,
        borderRadius: 14,
        border: "1px solid #ffffff1f",
        background: "#1e1a17",
        color: "#a8a29b",
        fontSize: "0.8125rem",
        lineHeight: 1.7,
      }}
    >
      <p style={{ color: "#f5f3f0", fontWeight: 700 }}>Two things to decide with the colour</p>
      <p style={{ marginTop: 8 }}>
        <strong style={{ color: "#f5f3f0" }}>This makes the board dark-first.</strong> The site is
        currently cream by default, with dark only when the operating system asks for it. Every
        accent here fails contrast on cream badly — slime is 1.17:1 against it, where 4.5 is the
        floor for body text. There is no version of this palette that works on the current
        background, so choosing one means the default theme becomes dark.
      </p>
      <p style={{ marginTop: 8 }}>
        <strong style={{ color: "#f5f3f0" }}>The ground is still the warm brown-black</strong>{" "}
        (#141210) the site already uses. Acid green over a warm ground is a deliberate slight clash —
        it is what stops the palette looking like a stock terminal theme. If it reads muddy to you,
        a neutral or cool-shifted dark is a one-line change and worth trying before committing.
      </p>
      <p style={{ marginTop: 8 }}>
        Button text is near-black (#0A0F00) rather than white on every variant: white on slime is
        1.19:1, which is illegible. Near-black is 16.4:1.
      </p>
    </div>
  );
}
