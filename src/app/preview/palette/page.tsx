import type { Metadata } from "next";
import type { CSSProperties } from "react";

/**
 * Palette exploration, round two.
 *
 * Round one landed on a single sheet of blue: correct by the numbers, flat on
 * the screen, and the pale-green headline competed with the slime CTA instead
 * of pointing at it. These four are directions, not shades of the same one.
 * They disagree about depth, about where the slime lives, about how warm the
 * blue is and about how much green there is in total.
 *
 * The brief still holds: two families, blue and green, and no neutral anywhere.
 * Every ratio below is measured, not eyeballed, and every ink clears 4.5:1
 * against BOTH the page and the card it can sit on — round one only checked the
 * page, which is how the chain chips ended up invisible.
 *
 * Nothing here touches tokens.css or the live board. Delete once a variant is chosen.
 */
export const metadata: Metadata = {
  title: "Palette round 2 — BIDOOR",
  robots: { index: false, follow: false },
};

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';

/** Chain identity survives every direction; the chip tint is the page's floor. */
const CHAIN_INK: Record<string, string> = {
  SOL: "#5fe9c4",
  BASE: "#8aa2ff",
  BNB: "#f0b90b",
  ETH: "#a2a0f0",
};

type Variant = {
  key: string;
  name: string;
  reference: string;
  /** What this direction argues, in one line. */
  thesis: string;
  /** The axis positions, so the four can be compared rather than just liked. */
  axes: { depth: string; slime: string; blue: string; green: string };
  floor: string;
  bg: string;
  card: string;
  lift: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  money: string;
  slime: string;
  slimeInk: string;
  nav: string;
  /** Slime headline is the whole point of three of these; A had a green one. */
  headline: string;
  radius: number;
  /** How a card leaves the page. The real difference between these four. */
  lift3d: (leader: boolean) => CSSProperties;
  moneyAsChip?: boolean;
  /** The leader row as a solid slab of slime, rather than a tinted row. */
  leaderFlood?: boolean;
  contrast: [string, string][];
};

const VARIANTS: Variant[] = [
  {
    key: "D1",
    name: "D1 · Mega Man",
    reference: "Mega Man NES · hard bevels, no blur",
    thesis:
      "Electric ultramarine, and the headline is slime. Depth comes from a hard NES bevel — a bright top edge and a dark bottom edge, zero blur — so cards read as pressed metal rather than as a gradient.",
    axes: {
      depth: "hard bevel, 1.47 between page and card",
      slime: "headline + money + CTA",
      blue: "electric ultramarine",
      green: "low — three places only",
    },
    floor: "#000A2E",
    bg: "#000A2E",
    card: "#001F8F",
    lift: "#0033D6",
    border: "#0033D6",
    text: "#A8DCFF",
    muted: "#7CC0FF",
    faint: "#66B0FF",
    money: "#C6FF00",
    slime: "#C6FF00",
    slimeInk: "#000A2E",
    nav: "#7CC0FF",
    headline: "#C6FF00",
    radius: 5,
    lift3d: (leader) => ({
      borderTop: `2px solid ${leader ? "#C6FF00" : "#0033D6"}`,
      borderLeft: `1px solid #0033D6`,
      borderRight: `1px solid #000A2E`,
      borderBottom: `3px solid #000617`,
    }),
    contrast: [
      ["headline slime / page", "16.35"],
      ["body / page", "13.25"],
      ["body / card", "9.01"],
      ["muted / card", "6.81"],
      ["faint / card", "5.79"],
      ["money / card", "11.12"],
      ["ink / slime", "16.35"],
      ["page→card", "1.47"],
    ],
  },
  {
    key: "D2",
    name: "D2 · Game Boy",
    reference: "Game Boy DMG · one family does almost everything",
    thesis:
      "Invert the ratio: green is the world, blue is the spark. The page, the cards and the text are all green at four separated values; blue appears only where you navigate. Money becomes a lit chip because in a green world green text is not special.",
    axes: {
      depth: "3px pixel drop shadow, no blur",
      slime: "headline + money chip + CTA",
      blue: "almost absent — nav only",
      green: "maximum — it is the ground",
    },
    floor: "#0D2B08",
    bg: "#0D2B08",
    card: "#1B4A11",
    lift: "#2A6B1B",
    border: "#2A6B1B",
    text: "#B6DC3D",
    muted: "#A3C92B",
    faint: "#95BC1F",
    money: "#D7FF57",
    slime: "#C6FF00",
    slimeInk: "#0D2B08",
    nav: "#5FD9F5",
    headline: "#C6FF00",
    radius: 3,
    lift3d: (leader) => ({
      border: `1px solid ${leader ? "#C6FF00" : "#2A6B1B"}`,
      boxShadow: `3px 3px 0 #061703`,
    }),
    moneyAsChip: true,
    contrast: [
      ["headline slime / page", "12.96"],
      ["body / page", "9.73"],
      ["body / card", "6.54"],
      ["muted / card", "5.38"],
      ["faint / card", "4.67"],
      ["money / card", "9.01"],
      ["nav blue / page", "9.32"],
      ["page→card", "1.49"],
    ],
  },
  {
    key: "D3",
    name: "D3 · Vaporwave",
    reference: "vaporwave duotone · violet blue, lit edges",
    thesis:
      "Push the blue into violet and let the cards actually float — a deep cast underneath and a lit slime hairline along the top edge, so the light source is the accent itself. The most generous with green after D2.",
    axes: {
      depth: "cards float, cast + lit top edge",
      slime: "headline + money + card edge + CTA",
      blue: "violet indigo",
      green: "medium-high, spread as light",
    },
    floor: "#12073D",
    bg: "#12073D",
    card: "#2E1F80",
    lift: "#4A34B8",
    border: "#4A34B8",
    text: "#D4C6FF",
    muted: "#B9A4FF",
    faint: "#A98FFF",
    money: "#C6FF00",
    slime: "#C6FF00",
    slimeInk: "#12073D",
    nav: "#8AD8FF",
    headline: "#C6FF00",
    radius: 18,
    lift3d: (leader) => ({
      border: `1px solid ${leader ? "#C6FF00" : "#4A34B8"}`,
      boxShadow: leader
        ? `0 14px 34px #08021F, inset 0 1px 0 #C6FF00`
        : `0 12px 30px #08021F, inset 0 1px 0 #6B52D6`,
    }),
    contrast: [
      ["headline slime / page", "15.76"],
      ["body / page", "11.86"],
      ["body / card", "8.20"],
      ["muted / card", "6.05"],
      ["faint / card", "4.96"],
      ["money / card", "10.90"],
      ["ink / slime", "15.76"],
      ["page→card", "1.45"],
    ],
  },
  {
    key: "D4",
    name: "D4 · Slime flood",
    reference: "Nickelodeon slime · green as material, not ink",
    thesis:
      "Cyan page, and the green stops being a text colour: the leader is a solid slab of slime with deep ink on it. One big pour at the top instead of green sprinkled everywhere — the #1 row becomes the thing you see first in a screenshot.",
    axes: {
      depth: "slab hierarchy — the leader is a different material",
      slime: "the entire #1 row, plus headline + CTA",
      blue: "cyan",
      green: "high but concentrated in one block",
    },
    floor: "#001F33",
    bg: "#001F33",
    card: "#003D5C",
    lift: "#00587F",
    border: "#00587F",
    text: "#A8ECFF",
    muted: "#7FDCF7",
    faint: "#5CC9EB",
    money: "#C6FF00",
    slime: "#C6FF00",
    slimeInk: "#001F33",
    nav: "#5CC9EB",
    headline: "#C6FF00",
    radius: 12,
    lift3d: (leader) =>
      leader
        ? { border: `1px solid #C6FF00`, boxShadow: `0 10px 26px #00101B` }
        : { borderTop: `1px solid #00789E`, border: `1px solid #00587F`, boxShadow: `0 6px 18px #00101B` },
    leaderFlood: true,
    contrast: [
      ["headline slime / page", "14.23"],
      ["body / page", "12.95"],
      ["body / card", "8.84"],
      ["muted / card", "7.40"],
      ["faint / card", "6.04"],
      ["ink / slime slab", "14.23"],
      ["money / card", "9.72"],
      ["page→card", "1.46"],
    ],
  },
];

export default function PalettePreview() {
  return (
    <main style={{ background: "#001126", minHeight: "100vh", padding: "28px 20px 56px", fontFamily: SANS }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <h1 style={{ color: "#C6FF00", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          Palette round 2 — four directions
        </h1>
        <p style={{ color: "#8AD8FF", fontSize: "0.875rem", marginTop: 8, lineHeight: 1.6, maxWidth: "62ch" }}>
          Still two families and no neutral. These differ on four axes at once — depth, where the
          slime lives, how warm the blue is, and how much green there is in total — so they are
          alternatives rather than shades of one idea. Every ink clears 4.5:1 on both the page and
          the card. Ratios are printed under each.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(520px, 1fr))", gap: 22, marginTop: 26 }}>
          {VARIANTS.map((v) => (
            <Direction key={v.key} v={v} />
          ))}
        </div>
      </div>
    </main>
  );
}

function Direction({ v }: { v: Variant }) {
  return (
    <section>
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: "#C6FF00", fontSize: "1rem", fontWeight: 700 }}>{v.name}</div>
        <div style={{ color: "#5CC9EB", fontSize: "0.75rem", fontFamily: MONO, marginTop: 2 }}>{v.reference}</div>
        <p style={{ color: "#A8DCFF", fontSize: "0.8125rem", marginTop: 7, lineHeight: 1.55 }}>{v.thesis}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 14px", marginTop: 7, fontFamily: MONO, fontSize: "0.6875rem", color: "#7CC0FF" }}>
          {Object.entries(v.axes).map(([k, val]) => (
            <span key={k}>
              <span style={{ color: "#C6FF00" }}>{k}</span> {val}
            </span>
          ))}
        </div>
      </div>

      <div style={{ background: v.bg, borderRadius: v.radius + 4, overflow: "hidden", border: `1px solid ${v.border}` }}>
        <Header v={v} />
        <Hero v={v} />
        <Panels v={v} />
        <Podium v={v} />
        <FlatRows v={v} />
      </div>

      <div style={{ marginTop: 9, display: "flex", flexWrap: "wrap", gap: "3px 16px", fontFamily: MONO, fontSize: "0.6875rem", color: "#7CC0FF" }}>
        {v.contrast.map(([label, ratio]) => (
          <span key={label}>
            {label} <span style={{ color: "#C6FF00" }}>{ratio}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function Header({ v }: { v: Variant }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${v.border}` }}>
      <span style={{ color: v.text, fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
        BID<span style={{ color: v.slime }}>OOR</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "0.8125rem" }}>
        <span style={{ color: v.nav }}>Leaderboard</span>
        <span style={{ color: v.nav }}>Rules</span>
        <span style={{ background: v.slime, color: v.slimeInk, padding: "5px 14px", borderRadius: v.radius >= 12 ? 999 : v.radius, fontWeight: 700, fontSize: "0.8125rem" }}>
          Bid
        </span>
      </span>
    </div>
  );
}

function Hero({ v }: { v: Variant }) {
  return (
    <div style={{ padding: "22px 16px", textAlign: "center" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: v.card, color: v.muted, padding: "6px 14px", borderRadius: 999, fontSize: "0.75rem", fontFamily: MONO }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: v.nav }} />
        42 tokens on the board · $54.7k bid to date
      </span>

      {/* The headline is slime in all four — round one's pale-green title pulled
          the eye away from the button instead of handing it over. */}
      <div style={{ marginTop: 16, color: v.headline, fontSize: "2.75rem", fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1.05 }}>
        Claim #1 for $8,755
      </div>

      <p style={{ color: v.muted, fontSize: "0.875rem", marginTop: 11, lineHeight: 1.6 }}>
        New listings start at $1. Paying less than #1 still puts you on the board, at whatever rank
        your total buys.
      </p>

      <div style={{ marginTop: 15, display: "flex", gap: 8, justifyContent: "center" }}>
        <span style={{ flex: "0 1 300px", ...v.lift3d(false), background: v.card, color: v.faint, padding: "10px 15px", borderRadius: v.radius, fontSize: "0.8125rem", textAlign: "left", fontFamily: MONO }}>
          Paste a token contract address
        </span>
        <span style={{ background: v.slime, color: v.slimeInk, padding: "11px 20px", borderRadius: v.radius, fontWeight: 700, fontSize: "0.875rem", whiteSpace: "nowrap" }}>
          Become the top bidoor
        </span>
      </div>
    </div>
  );
}

function Panels({ v }: { v: Variant }) {
  const panels = [
    { title: "Trending right now", rows: [["Bonk", "18k clicks"], ["Brett", "13k clicks"]] },
    { title: "Latest activity", rows: [["Degen", "$420"], ["Bonk", "$1,450"]] },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, padding: "0 16px 14px" }}>
      {panels.map((panel) => (
        <div key={panel.title} style={{ ...v.lift3d(false), background: v.card, borderRadius: v.radius, padding: "9px 13px" }}>
          <div style={{ color: v.text, fontWeight: 700, fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: v.nav }} />
            {panel.title}
          </div>
          {panel.rows.map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${v.border}`, fontSize: "0.8125rem", color: v.text }}>
              <span>{label}</span>
              <span style={{ color: value.startsWith("$") ? v.money : v.faint, fontFamily: MONO }}>{value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Money({ v, amount, big, onFlood }: { v: Variant; amount: string; big?: boolean; onFlood?: boolean }) {
  const size = big ? "1.25rem" : "1.0625rem";
  if (onFlood) {
    return <span style={{ color: v.slimeInk, fontWeight: 700, fontSize: size, fontVariantNumeric: "tabular-nums" }}>{amount}</span>;
  }
  if (v.moneyAsChip) {
    return (
      <span style={{ background: v.slime, color: v.slimeInk, padding: "1px 8px", borderRadius: v.radius, fontWeight: 700, fontSize: size, fontVariantNumeric: "tabular-nums" }}>
        {amount}
      </span>
    );
  }
  return <span style={{ color: v.money, fontWeight: 700, fontSize: size, fontVariantNumeric: "tabular-nums" }}>{amount}</span>;
}

function Podium({ v }: { v: Variant }) {
  const rows = [
    { rank: 1, name: "Bonk", ticker: "BONK", chain: "SOL", amount: "$8,750", leader: true },
    { rank: 2, name: "Brett", ticker: "BRETT", chain: "BASE", amount: "$7,300", leader: false },
    { rank: 3, name: "PancakeSwap", ticker: "CAKE", chain: "BNB", amount: "$6,300", leader: false },
  ];
  return (
    <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((row) => {
        const flood = Boolean(v.leaderFlood && row.leader);
        const ink = flood ? v.slimeInk : v.text;
        const sub = flood ? v.slimeInk : v.faint;
        return (
          <div key={row.rank} style={{ display: "flex", alignItems: "center", gap: 11, padding: 13, borderRadius: v.radius, background: flood ? v.slime : v.card, ...v.lift3d(row.leader) }}>
            <span style={{ background: flood ? v.slimeInk : v.slime, color: flood ? v.slime : v.slimeInk, padding: "2px 9px", borderRadius: 999, fontWeight: 700, fontSize: "0.75rem", fontFamily: MONO }}>
              #{row.rank}
            </span>
            <span style={{ width: 38, height: 38, borderRadius: 999, background: flood ? v.slimeInk : v.lift, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ color: ink, fontWeight: 700 }}>{row.name}</span>
                <span style={{ color: sub, fontSize: "0.6875rem", fontFamily: MONO, opacity: flood ? 0.75 : 1 }}>{row.ticker}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                <ChainChip v={v} name={row.chain} onFlood={flood} />
                <span style={{ color: sub, fontSize: "0.6875rem", fontFamily: MONO, opacity: flood ? 0.75 : 1 }}>18k clicks</span>
              </span>
            </span>
            <span style={{ textAlign: "right" }}>
              <span style={{ display: "block" }}>
                <Money v={v} amount={row.amount} big={row.leader} onFlood={flood} />
              </span>
              <span style={{ display: "inline-block", marginTop: 5, border: `1px solid ${flood ? v.slimeInk : v.border}`, color: flood ? v.slimeInk : v.muted, padding: "1px 8px", borderRadius: 999, fontSize: "0.6875rem", fontFamily: MONO }}>
                Take #{row.rank}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FlatRows({ v }: { v: Variant }) {
  const rows = [
    { rank: 4, name: "Pepe", ticker: "PEPE", chain: "ETH", amount: "$5,620" },
    { rank: 5, name: "Notcoin", ticker: "NOT", chain: "SOL", amount: "$4,500" },
  ];
  return (
    <div style={{ padding: "0 16px 18px" }}>
      {rows.map((row) => (
        <div key={row.rank} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: `1px solid ${v.border}` }}>
          <span style={{ color: v.faint, width: 22, textAlign: "center", fontFamily: MONO, fontSize: "0.875rem" }}>{row.rank}</span>
          <span style={{ width: 30, height: 30, borderRadius: 999, background: v.card, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            <span style={{ color: v.text, fontWeight: 700, fontSize: "0.9375rem" }}>{row.name}</span>{" "}
            <span style={{ color: v.faint, fontSize: "0.6875rem", fontFamily: MONO }}>{row.ticker}</span>
            <span style={{ display: "block", marginTop: 3 }}>
              <ChainChip v={v} name={row.chain} />
            </span>
          </span>
          <Money v={v} amount={row.amount} />
        </div>
      ))}
    </div>
  );
}

function ChainChip({ v, name, onFlood }: { v: Variant; name: string; onFlood?: boolean }) {
  // The chip's tint is the page floor, so it reads recessed on every direction;
  // the chain's identity is the ink. On a slime slab the floor becomes the tint
  // instead, because a dark chip on green is the recessed one there.
  return (
    <span style={{ background: onFlood ? v.slimeInk : v.floor, color: CHAIN_INK[name] ?? CHAIN_INK.ETH, padding: "1px 7px", borderRadius: 4, fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.02em" }}>
      {name}
    </span>
  );
}
