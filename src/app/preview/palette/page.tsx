import type { Metadata } from "next";

/**
 * Duotone palette preview — blue family + green family, no neutral anywhere.
 *
 * Every colour on this page comes from one of two ramps. There is no black,
 * grey, white or cream: the "dark" role is played by a deep blue and the
 * "light" role by a pale green, so the two families carry the whole page
 * including the parts a neutral would normally do quietly.
 *
 * Touches nothing the real board uses — every value is a local constant and
 * tokens.css is untouched. Delete this route once a variant is chosen.
 */
export const metadata: Metadata = {
  title: "Palette preview — BIDOOR",
  robots: { index: false, follow: false },
};

const BLUE = {
  deepest: "#001A40",
  deep: "#002B66",
  mid: "#003D80",
  lift: "#004A99",
  strong: "#0071C5",
  sky: "#00A8F0",
  light: "#41C6F0",
  pale: "#7FDCF7",
  palest: "#B8ECFB",
};

const GREEN = {
  darkest: "#2E3D00",
  deep: "#8FBF00",
  strong: "#AEEA00",
  slime: "#C6FF00",
  light: "#D7FF57",
  pale: "#E8FFA8",
  palest: "#F2FFD6",
};

type Palette = {
  key: string;
  name: string;
  note: string;
  caveat?: string;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  /** Money. Green family wherever the ground allows it. */
  money: string;
  /** Money rendered as a filled chip, where flat text cannot carry the accent. */
  moneyChip?: { bg: string; ink: string };
  actionBg: string;
  actionInk: string;
  nav: string;
  leaderTint: string;
  leaderBorder: string;
  /** Measured ratios, shown on the page. */
  contrast: [string, string][];
};

const VARIANTS: Palette[] = [
  {
    key: "A",
    name: "A · Deep blue ground",
    note: "The most Mega Man. Deep blue carries the page, pale green does the reading, and pure slime is reserved for money and the one button that matters.",
    bg: BLUE.deep,
    surface: BLUE.mid,
    surface2: BLUE.lift,
    border: BLUE.strong,
    text: GREEN.pale,
    muted: BLUE.pale,
    faint: BLUE.light,
    money: GREEN.slime,
    actionBg: GREEN.slime,
    actionInk: BLUE.deep,
    nav: BLUE.pale,
    leaderTint: BLUE.mid,
    leaderBorder: GREEN.slime,
    contrast: [
      ["body text on ground", "12.55"],
      ["muted on ground", "8.77"],
      ["faint on ground", "6.87"],
      ["nav link on ground", "8.77"],
      ["money on ground", "11.52"],
      ["money on card", "8.95"],
      ["button ink on slime", "11.52"],
    ],
  },
  {
    key: "B",
    name: "B · Mid sky ground",
    note: "Blue moves to the foreground as the ground itself. Structure and text are deep blue; the action stays slime.",
    caveat:
      "The compromise: on a mid sky ground the green family has no member that is both readable and still recognisably green — anything bright enough to read as slime is too light against sky. So flat amounts fall back to a dark olive (5.92:1), and money keeps its slime identity through filled chips instead. This is the variant where the money accent is structurally weakest.",
    bg: BLUE.light,
    surface: BLUE.pale,
    surface2: BLUE.palest,
    border: BLUE.strong,
    text: BLUE.deepest,
    muted: BLUE.deep,
    faint: BLUE.mid,
    money: GREEN.darkest,
    moneyChip: { bg: GREEN.slime, ink: BLUE.deep },
    actionBg: GREEN.slime,
    actionInk: BLUE.deep,
    nav: BLUE.deepest,
    leaderTint: GREEN.pale,
    leaderBorder: GREEN.strong,
    contrast: [
      ["body text on ground", "8.64"],
      ["muted on ground", "6.87"],
      ["faint on ground", "5.34"],
      ["nav link on ground", "8.64"],
      ["money on ground", "5.92"],
      ["money chip ink on slime", "11.52"],
      ["button ink on slime", "11.52"],
    ],
  },
  {
    key: "C",
    name: "C · Pale slime ground",
    note: "Daytime Nickelodeon. Pale green carries the page, deep blue does the reading, and saturated sky is the action.",
    caveat:
      "Putting slime on the ground inverts the rule you set: green cannot also be the money accent when green is the background, so here money and action are both blue — sky for the button, deep blue for amounts. That is inherent to the choice, not a detail to fix.",
    bg: GREEN.pale,
    surface: GREEN.palest,
    surface2: GREEN.light,
    border: GREEN.deep,
    text: BLUE.deep,
    muted: BLUE.mid,
    faint: BLUE.lift,
    money: "#00539E",
    actionBg: BLUE.sky,
    actionInk: BLUE.deepest,
    nav: BLUE.strong,
    leaderTint: GREEN.light,
    leaderBorder: BLUE.sky,
    contrast: [
      ["body text on ground", "12.55"],
      ["muted on ground", "9.75"],
      ["faint on ground", "7.91"],
      ["nav link on ground", "4.63"],
      ["money on ground", "7.07"],
      ["money on card", "7.34"],
      ["button ink on sky", "6.43"],
    ],
  },
];

/**
 * Chain chips keep their own colours: a documented exception to the two-family
 * rule, because the chip encodes which chain a token is on. That is functional
 * semantics, not decoration, and flattening it would cost a reader information
 * a screenshot cannot recover.
 */
const CHAIN_CHIPS: Record<string, { tint: string; ink: string }> = {
  SOL: { tint: "#0d3b2e", ink: "#5FE9C4" },
  BASE: { tint: "#12224a", ink: "#8AA2FF" },
  BNB: { tint: "#3a3006", ink: "#F0B90B" },
  ETH: { tint: "#231f42", ink: "#A2A0F0" },
};

const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

export default function PalettePreview() {
  return (
    <div style={{ background: BLUE.deepest, minHeight: "100dvh", padding: "32px 16px" }}>
      <div style={{ maxWidth: "76rem", margin: "0 auto" }}>
        <h1 style={{ color: GREEN.pale, fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          Duotone preview — blue + green, no neutrals
        </h1>
        <p style={{ color: BLUE.pale, fontSize: "0.875rem", marginTop: 8, maxWidth: "46rem", lineHeight: 1.7 }}>
          Every colour below comes from one of two ramps. No black, grey, white or cream: the
          &ldquo;dark&rdquo; role is a deep blue and the &ldquo;light&rdquo; role is a pale green, so
          the two families also carry the parts a neutral would normally do quietly.
        </p>
        <p style={{ color: BLUE.light, fontSize: "0.8125rem", marginTop: 10, maxWidth: "46rem", lineHeight: 1.7 }}>
          Every text ratio is measured and printed under each variant. The floor is 4.5:1. Chain
          chips keep their own colours as a documented exception — they encode which chain a token
          is on, which is functional semantics rather than palette.
        </p>

        {VARIANTS.map((p) => (
          <Variant key={p.key} p={p} />
        ))}
      </div>
    </div>
  );
}

function Variant({ p }: { p: Palette }) {
  return (
    <section style={{ marginTop: 44 }}>
      <h2 style={{ color: GREEN.pale, fontSize: "1.0625rem", fontWeight: 700 }}>{p.name}</h2>
      <p style={{ color: BLUE.pale, fontSize: "0.8125rem", marginTop: 4, maxWidth: "46rem", lineHeight: 1.6 }}>
        {p.note}
      </p>
      {p.caveat && (
        <p
          style={{
            color: GREEN.light,
            fontSize: "0.8125rem",
            marginTop: 8,
            maxWidth: "46rem",
            lineHeight: 1.6,
            borderLeft: `2px solid ${GREEN.deep}`,
            paddingLeft: 12,
          }}
        >
          {p.caveat}
        </p>
      )}

      <div
        style={{
          marginTop: 14,
          background: p.bg,
          border: `1px solid ${p.border}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <Header p={p} />
        <Hero p={p} />
        <Panels p={p} />
        <Podium p={p} />
        <FlatRows p={p} />
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 18px",
          fontFamily: MONO,
          fontSize: "0.6875rem",
          color: BLUE.light,
        }}
      >
        {p.contrast.map(([label, ratio]) => (
          <span key={label}>
            {label} <span style={{ color: GREEN.light }}>{ratio}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function Header({ p }: { p: Palette }) {
  return (
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
        BID<span style={{ color: p.actionBg }}>OOR</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 16, fontSize: "0.875rem" }}>
        <span style={{ color: p.nav }}>Leaderboard</span>
        <span style={{ color: p.nav }}>Rules</span>
        <span
          style={{
            background: p.actionBg,
            color: p.actionInk,
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
  );
}

function Hero({ p }: { p: Palette }) {
  return (
    <div style={{ padding: "24px 16px", textAlign: "center" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: p.surface,
          color: p.muted,
          padding: "6px 14px",
          borderRadius: 999,
          fontSize: "0.75rem",
          fontFamily: MONO,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 999, background: p.nav }} />
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
        Claim #1 for{" "}
        {p.moneyChip ? (
          <span
            style={{
              background: p.moneyChip.bg,
              color: p.moneyChip.ink,
              padding: "0 12px",
              borderRadius: 10,
            }}
          >
            $8,755
          </span>
        ) : (
          <span style={{ color: p.money }}>$8,755</span>
        )}
      </div>

      <p style={{ color: p.muted, fontSize: "0.875rem", marginTop: 12, lineHeight: 1.6 }}>
        <span style={{ color: p.money }}>New listings start at $1.</span> Paying less than #1 still
        puts you on the board, at whatever rank your total buys.
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
            fontFamily: MONO,
          }}
        >
          Paste a token contract address
        </span>
        <span
          style={{
            background: p.actionBg,
            color: p.actionInk,
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
  );
}

function Panels({ p }: { p: Palette }) {
  const panels = [
    { title: "Trending right now", rows: [["Bonk", "18k clicks"], ["Brett", "13k clicks"]] },
    { title: "Latest activity", rows: [["Degen", "$420"], ["Bonk", "$1,450"]] },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 16px 16px" }}>
      {panels.map((panel) => (
        <div
          key={panel.title}
          style={{ border: `1px solid ${p.border}`, background: p.surface, borderRadius: 14, padding: "10px 14px" }}
        >
          <div style={{ color: p.text, fontWeight: 700, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: p.nav }} />
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
              <span style={{ color: value.startsWith("$") ? p.money : p.faint, fontFamily: MONO }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Money({ p, amount, big }: { p: Palette; amount: string; big?: boolean }) {
  const size = big ? "1.25rem" : "1.125rem";
  if (p.moneyChip) {
    return (
      <span
        style={{
          background: p.moneyChip.bg,
          color: p.moneyChip.ink,
          padding: "1px 9px",
          borderRadius: 8,
          fontWeight: 700,
          fontSize: size,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {amount}
      </span>
    );
  }
  return (
    <span style={{ color: p.money, fontWeight: 700, fontSize: size, fontVariantNumeric: "tabular-nums" }}>
      {amount}
    </span>
  );
}

function Podium({ p }: { p: Palette }) {
  const rows = [
    { rank: 1, name: "Bonk", ticker: "BONK", chain: "SOL", amount: "$8,750", leader: true },
    { rank: 2, name: "Brett", ticker: "BRETT", chain: "BASE", amount: "$7,300", leader: false },
    { rank: 3, name: "PancakeSwap Token", ticker: "CAKE", chain: "BNB", amount: "$6,300", leader: false },
  ];
  return (
    <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((row) => (
        <div
          key={row.rank}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 14,
            borderRadius: 14,
            background: row.leader ? p.leaderTint : p.surface,
            border: `1px solid ${row.leader ? p.leaderBorder : p.border}`,
          }}
        >
          <span
            style={{
              background: p.actionBg,
              color: p.actionInk,
              padding: "2px 9px",
              borderRadius: 999,
              fontWeight: 700,
              fontSize: "0.75rem",
              fontFamily: MONO,
            }}
          >
            #{row.rank}
          </span>
          <span style={{ width: 40, height: 40, borderRadius: 999, background: p.surface2 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: row.leader && p.key === "B" ? BLUE.deepest : p.text, fontWeight: 700 }}>
                {row.name}
              </span>
              <span style={{ color: p.faint, fontSize: "0.6875rem", fontFamily: MONO }}>{row.ticker}</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <ChainChip name={row.chain} />
              <span style={{ color: p.faint, fontSize: "0.6875rem", fontFamily: MONO }}>18k clicks</span>
            </span>
          </span>
          <span style={{ textAlign: "right" }}>
            <span style={{ display: "block" }}>
              <Money p={p} amount={row.amount} big={row.leader} />
            </span>
            <span
              style={{
                display: "inline-block",
                marginTop: 5,
                border: `1px solid ${p.border}`,
                color: p.muted,
                padding: "1px 8px",
                borderRadius: 999,
                fontSize: "0.6875rem",
                fontFamily: MONO,
              }}
            >
              Take #{row.rank} · {row.amount}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function FlatRows({ p }: { p: Palette }) {
  const rows = [
    { rank: 4, name: "Pepe", ticker: "PEPE", chain: "ETH", amount: "$5,620" },
    { rank: 5, name: "Notcoin", ticker: "NOT", chain: "SOL", amount: "$4,500" },
  ];
  return (
    <div style={{ padding: "0 16px 20px" }}>
      {rows.map((row) => (
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
          <span style={{ color: p.faint, width: 24, textAlign: "center", fontFamily: MONO, fontSize: "0.875rem" }}>
            {row.rank}
          </span>
          <span style={{ width: 32, height: 32, borderRadius: 999, background: p.surface2 }} />
          <span style={{ flex: 1 }}>
            <span style={{ color: p.text, fontWeight: 700, fontSize: "0.9375rem" }}>{row.name}</span>{" "}
            <span style={{ color: p.faint, fontSize: "0.6875rem", fontFamily: MONO }}>{row.ticker}</span>
            <span style={{ display: "block", marginTop: 4 }}>
              <ChainChip name={row.chain} />
            </span>
          </span>
          <Money p={p} amount={row.amount} />
        </div>
      ))}
    </div>
  );
}

function ChainChip({ name }: { name: string }) {
  const chip = CHAIN_CHIPS[name] ?? CHAIN_CHIPS.ETH;
  return (
    <span
      style={{
        background: chip.tint,
        color: chip.ink,
        padding: "1px 7px",
        borderRadius: 4,
        fontSize: "0.6875rem",
        fontWeight: 500,
        letterSpacing: "0.02em",
      }}
    >
      {name}
    </span>
  );
}
