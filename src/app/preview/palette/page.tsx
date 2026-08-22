import type { Metadata } from "next";
import type { CSSProperties } from "react";

/**
 * Neutral base, two themes, slime and sky as decoration only.
 *
 * The duotone rounds failed for the same underlying reason twice: making the
 * accents carry the whole page left nothing for them to stand out against. Here
 * the base is neutral and the two accents are spent deliberately —
 *
 *   slime #C6FF00 = money and action   (headline figure, amounts, CTA, the #1)
 *   sky   #00A8F0 = navigation and info (links, the wordmark's OOR, dots)
 *
 * The one rule that cannot bend: slime is never a text colour on cream. It sits
 * at 1.17:1 there, which is not a contrast problem to be tuned but a colour
 * that is invisible on that ground. In the light theme it appears only as FILL
 * with dark ink on top — button, chip, marker, slab.
 *
 * Sky has the same problem in light, less obviously: #00A8F0 on cream is 2.63.
 * See the note the page prints under the light theme.
 *
 * Nothing here touches tokens.css or the board. Delete once a variant is chosen.
 */
export const metadata: Metadata = {
  title: "Neutral base preview — BIDOOR",
  robots: { index: false, follow: false },
};

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const SANS = "ui-sans-serif, system-ui, sans-serif";

const SLIME = "#C6FF00";
/** The ink that goes on top of slime, in both themes. 15.76 against it. */
const SLIME_INK = "#141210";

const CHAIN_DARK: Record<string, string> = {
  SOL: "#5fe9c4",
  BASE: "#8aa2ff",
  BNB: "#f0b90b",
  ETH: "#a2a0f0",
};
/** Cream needs its own set: the bright inks sit at 1.26 on a light chip. */
const CHAIN_LIGHT: Record<string, string> = {
  SOL: "#307663",
  BASE: "#5867a2",
  BNB: "#846606",
  ETH: "#666597",
};

type Theme = {
  key: string;
  name: string;
  role: string;
  note: string;
  bg: string;
  card: string;
  lift: string;
  chip: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  /** Navigation and info. Darkened in light, because #00A8F0 is 2.63 on cream. */
  sky: string;
  skyOnCard: string;
  /** Dark themes can print money in slime; cream cannot, and fills instead. */
  moneyAsFill: boolean;
  cardShadow: string;
  chains: Record<string, string>;
  contrast: [string, string][];
};

const THEMES: Theme[] = [
  {
    key: "dark-warm",
    name: "Oscuro A · marrón-negro cálido",
    role: "opción 1 para el default",
    note: "El #141210 que ya existía. El calor se nota sobre todo en las cards, no en el fondo — a ese valor un marrón y un negro son casi el mismo color, y la diferencia aparece cuando la capa sube.",
    bg: "#141210",
    card: "#3d3328",
    lift: "#5c4d3d",
    chip: "#241E17",
    border: "#4A3F32",
    text: "#F7F3EC",
    muted: "#D6CDBD",
    faint: "#BCB09B",
    sky: "#00A8F0",
    skyOnCard: "#41C6F0",
    moneyAsFill: false,
    cardShadow: "0 8px 20px #0A0806",
    chains: CHAIN_DARK,
    contrast: [
      ["bg→card", "1.52"],
      ["card→lift", "1.52"],
      ["texto / card", "11.15"],
      ["muted / card", "7.83"],
      ["faint / card", "5.77"],
      ["slime / card", "10.40"],
      ["celeste / bg", "6.99"],
      ["chips (mín)", "6.83"],
    ],
  },
  {
    key: "dark-cold",
    name: "Oscuro B · pizarra fría",
    role: "opción 2 para el default",
    note: "Mismo esqueleto, cast azulado. El celeste se integra más — es casi de la familia del fondo — y el slime queda más solo, que es exactamente lo que se quiere de él.",
    bg: "#0F1316",
    card: "#2c353f",
    lift: "#43505f",
    chip: "#1A2126",
    border: "#3A454F",
    text: "#F1F5F8",
    muted: "#C8D1D8",
    faint: "#AAB6BE",
    sky: "#00A8F0",
    skyOnCard: "#41C6F0",
    moneyAsFill: false,
    cardShadow: "0 8px 20px #05080A",
    chains: CHAIN_DARK,
    contrast: [
      ["bg→card", "1.50"],
      ["card→lift", "1.51"],
      ["texto / card", "11.35"],
      ["muted / card", "8.04"],
      ["faint / card", "6.01"],
      ["slime / card", "10.49"],
      ["celeste / bg", "6.99"],
      ["chips (mín)", "6.74"],
    ],
  },
  {
    key: "light",
    name: "Claro · crema #fffdfa",
    role: "el tema claro, para los dos oscuros",
    note: "Acá el slime NUNCA es letra: es relleno con tinta oscura encima — botón, chip del monto, marcador del título, barra del #1. El celeste sí es letra, pero oscurecido a #007DB3, porque el #00A8F0 sobre crema da 2.63.",
    bg: "#fffdfa",
    card: "#e9e3d9",
    lift: "#DBD3C5",
    chip: "#F0EADF",
    border: "#D5CCBC",
    text: "#1A1714",
    muted: "#4E4740",
    faint: "#6B6359",
    sky: "#007DB3",
    skyOnCard: "#00658F",
    moneyAsFill: true,
    cardShadow: "0 6px 16px #D8D0C2",
    chains: CHAIN_LIGHT,
    contrast: [
      ["bg→card", "1.26"],
      ["texto / card", "13.98"],
      ["muted / card", "7.16"],
      ["faint / card", "4.63"],
      ["tinta / slime", "15.76"],
      ["celeste / bg", "4.51"],
      ["celeste / card", "5.05"],
      ["chips (mín)", "4.50"],
    ],
  },
];

export default function NeutralPreview() {
  return (
    <main style={{ background: "#1B1E21", minHeight: "100vh", padding: "26px 20px 56px", fontFamily: SANS }}>
      <div style={{ maxWidth: 1640, margin: "0 auto" }}>
        <h1 style={{ color: "#F1F5F8", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          Base neutra · dos temas · slime y celeste sólo como acento
        </h1>
        <p style={{ color: "#C8D1D8", fontSize: "0.875rem", marginTop: 8, lineHeight: 1.6, maxWidth: "76ch" }}>
          El fondo y el texto vuelven a ser neutros; los dos acentos se gastan a propósito.{" "}
          <span style={{ color: SLIME, fontWeight: 700 }}>Slime</span> es plata y acción,{" "}
          <span style={{ color: "#41C6F0", fontWeight: 700 }}>celeste</span> es navegación e info, y no
          comparten elemento. Las dos primeras columnas son las dos opciones de oscuro para el
          default; la tercera es el claro que las acompaña.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(470px, 1fr))", gap: 20, marginTop: 24 }}>
          {THEMES.map((t) => (
            <ThemePanel key={t.key} t={t} />
          ))}
        </div>
      </div>
    </main>
  );
}

function ThemePanel({ t }: { t: Theme }) {
  return (
    <section>
      <div style={{ marginBottom: 9 }}>
        <div style={{ color: "#F1F5F8", fontSize: "1rem", fontWeight: 700 }}>{t.name}</div>
        <div style={{ color: "#41C6F0", fontSize: "0.75rem", fontFamily: MONO, marginTop: 2 }}>{t.role}</div>
        <p style={{ color: "#C8D1D8", fontSize: "0.8125rem", marginTop: 6, lineHeight: 1.55 }}>{t.note}</p>
      </div>

      <div style={{ background: t.bg, borderRadius: 16, overflow: "hidden", border: `1px solid ${t.border}` }}>
        <Header t={t} />
        <Hero t={t} />
        <Panels t={t} />
        <Podium t={t} />
        <FlatRows t={t} />
      </div>

      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "3px 14px", fontFamily: MONO, fontSize: "0.6875rem", color: "#AAB6BE" }}>
        {t.contrast.map(([label, ratio]) => (
          <span key={label}>
            {label} <span style={{ color: SLIME }}>{ratio}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

/** A card that is actually a step off the page, not a tint of it. */
function card(t: Theme, extra: CSSProperties = {}): CSSProperties {
  return { background: t.card, border: `1px solid ${t.border}`, boxShadow: t.cardShadow, ...extra };
}

function Header({ t }: { t: Theme }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${t.border}` }}>
      <span style={{ color: t.text, fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
        BID<span style={{ color: t.sky }}>OOR</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "0.8125rem" }}>
        <span style={{ color: t.sky }}>Leaderboard</span>
        <span style={{ color: t.sky }}>Rules</span>
        {/* Action is slime fill in BOTH themes — this is the piece that stays identical. */}
        <span style={{ background: SLIME, color: SLIME_INK, padding: "5px 14px", borderRadius: 999, fontWeight: 700, fontSize: "0.8125rem" }}>
          Bid
        </span>
      </span>
    </div>
  );
}

function Hero({ t }: { t: Theme }) {
  return (
    <div style={{ padding: "22px 16px", textAlign: "center" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, ...card(t), boxShadow: "none", color: t.muted, padding: "6px 14px", borderRadius: 999, fontSize: "0.75rem", fontFamily: MONO }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: t.skyOnCard }} />
        42 tokens on the board · $54.7k bid to date
      </span>

      <div style={{ marginTop: 16, color: t.text, fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        Claim #1 for{" "}
        {/* Dark prints the figure in slime; cream can only highlight behind it. */}
        {t.moneyAsFill ? (
          <span style={{ background: SLIME, color: SLIME_INK, padding: "0 10px", borderRadius: 8, boxDecorationBreak: "clone" }}>$8,755</span>
        ) : (
          <span style={{ color: SLIME }}>$8,755</span>
        )}
      </div>

      <p style={{ color: t.muted, fontSize: "0.875rem", marginTop: 11, lineHeight: 1.6 }}>
        New listings start at $1. Paying less than #1 still puts you on the board, at whatever rank
        your total buys.
      </p>

      <div style={{ marginTop: 15, display: "flex", gap: 8, justifyContent: "center" }}>
        <span style={{ flex: "0 1 290px", ...card(t), boxShadow: "none", color: t.faint, padding: "10px 15px", borderRadius: 10, fontSize: "0.8125rem", textAlign: "left", fontFamily: MONO }}>
          Paste a token contract address
        </span>
        <span style={{ background: SLIME, color: SLIME_INK, padding: "11px 20px", borderRadius: 10, fontWeight: 700, fontSize: "0.875rem", whiteSpace: "nowrap" }}>
          Become the top bidoor
        </span>
      </div>
    </div>
  );
}

function Panels({ t }: { t: Theme }) {
  const panels = [
    { title: "Trending right now", rows: [["Bonk", "18k clicks"], ["Brett", "13k clicks"]] },
    { title: "Latest activity", rows: [["Degen", "$420"], ["Bonk", "$1,450"]] },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, padding: "0 16px 14px" }}>
      {panels.map((panel) => (
        <div key={panel.title} style={{ ...card(t), borderRadius: 12, padding: "9px 13px" }}>
          <div style={{ color: t.text, fontWeight: 700, fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: t.skyOnCard }} />
            {panel.title}
          </div>
          {panel.rows.map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${t.border}`, fontSize: "0.8125rem", color: t.text }}>
              <span>{label}</span>
              {value.startsWith("$") ? <Money t={t} amount={value} small /> : <span style={{ color: t.faint, fontFamily: MONO }}>{value}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * The whole light/dark difference in one component. On a dark ground the amount
 * is slime type; on cream the same amount is dark type on a slime fill, because
 * slime type on cream is 1.17 and simply is not there.
 */
function Money({ t, amount, big, small }: { t: Theme; amount: string; big?: boolean; small?: boolean }) {
  const size = big ? "1.25rem" : small ? "0.8125rem" : "1.0625rem";
  if (t.moneyAsFill) {
    return (
      <span style={{ background: SLIME, color: SLIME_INK, padding: small ? "0 6px" : "1px 8px", borderRadius: 6, fontWeight: 700, fontSize: size, fontVariantNumeric: "tabular-nums", fontFamily: small ? MONO : SANS }}>
        {amount}
      </span>
    );
  }
  return <span style={{ color: SLIME, fontWeight: 700, fontSize: size, fontVariantNumeric: "tabular-nums", fontFamily: small ? MONO : SANS }}>{amount}</span>;
}

function Podium({ t }: { t: Theme }) {
  const rows = [
    { rank: 1, name: "Bonk", ticker: "BONK", chain: "SOL", amount: "$8,750", leader: true },
    { rank: 2, name: "Brett", ticker: "BRETT", chain: "BASE", amount: "$7,300", leader: false },
    { rank: 3, name: "PancakeSwap", ticker: "CAKE", chain: "BNB", amount: "$6,300", leader: false },
  ];
  return (
    <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map((row) => (
        <div
          key={row.rank}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: 13,
            borderRadius: 12,
            ...card(t),
            // The leader is marked with a slime edge — decoration, identical in
            // both themes, and it never has to be legible as type.
            borderLeft: row.leader ? `5px solid ${SLIME}` : `1px solid ${t.border}`,
          }}
        >
          <span style={{ background: row.leader ? SLIME : t.lift, color: row.leader ? SLIME_INK : t.text, padding: "2px 9px", borderRadius: 999, fontWeight: 700, fontSize: "0.75rem", fontFamily: MONO }}>
            #{row.rank}
          </span>
          <span style={{ width: 38, height: 38, borderRadius: 999, background: t.lift, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: t.text, fontWeight: 700 }}>{row.name}</span>
              <span style={{ color: t.faint, fontSize: "0.6875rem", fontFamily: MONO }}>{row.ticker}</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
              <ChainChip t={t} name={row.chain} />
              <span style={{ color: t.faint, fontSize: "0.6875rem", fontFamily: MONO }}>18k clicks</span>
            </span>
          </span>
          <span style={{ textAlign: "right" }}>
            <span style={{ display: "block" }}>
              <Money t={t} amount={row.amount} big={row.leader} />
            </span>
            <span style={{ display: "inline-block", marginTop: 5, border: `1px solid ${t.border}`, color: t.skyOnCard, padding: "1px 8px", borderRadius: 999, fontSize: "0.6875rem", fontFamily: MONO }}>
              Take #{row.rank}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function FlatRows({ t }: { t: Theme }) {
  const rows = [
    { rank: 4, name: "Pepe", ticker: "PEPE", chain: "ETH", amount: "$5,620" },
    { rank: 5, name: "Notcoin", ticker: "NOT", chain: "SOL", amount: "$4,500" },
  ];
  return (
    <div style={{ padding: "0 16px 18px" }}>
      {rows.map((row) => (
        <div key={row.rank} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: `1px solid ${t.border}` }}>
          <span style={{ color: t.faint, width: 22, textAlign: "center", fontFamily: MONO, fontSize: "0.875rem" }}>{row.rank}</span>
          <span style={{ width: 30, height: 30, borderRadius: 999, background: t.card, border: `1px solid ${t.border}`, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            <span style={{ color: t.text, fontWeight: 700, fontSize: "0.9375rem" }}>{row.name}</span>{" "}
            <span style={{ color: t.faint, fontSize: "0.6875rem", fontFamily: MONO }}>{row.ticker}</span>
            <span style={{ display: "block", marginTop: 3 }}>
              <ChainChip t={t} name={row.chain} />
            </span>
          </span>
          <Money t={t} amount={row.amount} />
        </div>
      ))}
    </div>
  );
}

function ChainChip({ t, name }: { t: Theme; name: string }) {
  // Chain identity is the exception that survives every direction, but the ink
  // has to be re-derived per theme: the bright set sits at 1.26 on a light chip.
  return (
    <span style={{ background: t.chip, color: t.chains[name] ?? t.chains.ETH, padding: "1px 7px", borderRadius: 4, fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.02em" }}>
      {name}
    </span>
  );
}
