import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAINS } from "../chains";

/**
 * The chain chips are the one place colour carries meaning, and they are also
 * the one place this project has already shipped an unreadable contrast: an
 * earlier round put them on the page at 1.1:1 because it only checked them
 * against the page, not against the cards they actually sit on.
 *
 * So the ratios are not a comment to be trusted. This reads the tokens as
 * shipped, composites each chip the way the browser will, and recomputes every
 * pair against every surface in both themes.
 */
const TOKENS = readFileSync("src/app/tokens.css", "utf8");

/** Reads `--name: light-dark(a, b);` as [light, dark]. */
function themePair(name: string): [string, string] {
  const match = TOKENS.match(new RegExp(`--${name}:\\s*light-dark\\(\\s*([^,]+),\\s*([^)]+)\\)`));
  if (!match) throw new Error(`token --${name} not found, or not a light-dark pair`);
  return [match[1].trim(), match[2].trim()];
}

function single(name: string): string {
  const match = TOKENS.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`token --${name} not found`);
  return match[1].trim();
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** What the browser paints for `color-mix(in srgb, brand <alpha>, transparent)` over a surface. */
function tintOver(brand: string, alpha: number, surface: string): [number, number, number] {
  const [fr, fg, fb] = rgb(brand);
  const [br, bg, bb] = rgb(surface);
  return [fr * alpha + br * (1 - alpha), fg * alpha + bg * (1 - alpha), fb * alpha + bb * (1 - alpha)];
}

const ALPHA = Number(single("bd-chain-tint-alpha").replace("%", "")) / 100;

// Every surface a chip can land on: the page, a podium card, an activity panel.
const SURFACES = ["bd-bg", "bd-surface", "bd-surface-2"] as const;
const THEMES = [0, 1] as const;
const THEME_NAME = ["light", "dark"] as const;

/** Every chain in the registry, plus the fallback an unknown id renders. */
const CHIPS = [...CHAINS.map((chain) => chain.id), "unknown"];

describe("chain chips", () => {
  it("declares a brand colour and a per-theme ink for every chain", () => {
    for (const id of CHIPS) {
      expect(() => single(`bd-chain-brand-${id}`), id).not.toThrow();
      expect(() => themePair(`bd-chain-${id}`), id).not.toThrow();
    }
  });

  it("mixes the tint at the strength the design asks for", () => {
    // 15-20% of the brand over the card: enough to read as the chain's colour,
    // not enough to become a fill competing with the money accent.
    expect(ALPHA).toBeGreaterThanOrEqual(0.15);
    expect(ALPHA).toBeLessThanOrEqual(0.2);
  });

  it("clears AA text contrast on every surface, in both themes", () => {
    const failures: string[] = [];
    for (const id of CHIPS) {
      const brand = single(`bd-chain-brand-${id}`);
      const inks = themePair(`bd-chain-${id}`);
      for (const theme of THEMES) {
        for (const surfaceToken of SURFACES) {
          const surface = themePair(surfaceToken)[theme];
          const ratio = contrast(rgb(inks[theme]), tintOver(brand, ALPHA, surface));
          if (ratio < 4.5) {
            failures.push(`${id} ${THEME_NAME[theme]} on ${surfaceToken}: ${ratio.toFixed(2)}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps every chain's chip visibly its own", () => {
    // Two chains that read as the same colour tell a reader nothing, which is
    // the entire reason these are exempt from the neutral rule.
    const seen = new Map<string, string>();
    for (const id of CHIPS) {
      const brand = single(`bd-chain-brand-${id}`);
      const clash = [...seen.entries()].find(([, other]) => contrast(rgb(brand), rgb(other)) < 1.05);
      expect(clash, `${id} is indistinguishable from ${clash?.[0]}`).toBeUndefined();
      seen.set(id, brand);
    }
  });

  it("keeps the chips away from the money accent", () => {
    // Slime means money and action. A chain chip that reads as slime would put
    // a price colour on an identity, which is the confusion the accent rule
    // exists to prevent — Robinhood's own #ccff00 is why this is checked.
    const slime = rgb("#c6ff00");
    for (const id of CHIPS) {
      const brand = rgb(single(`bd-chain-brand-${id}`));
      const distance = Math.hypot(brand[0] - slime[0], brand[1] - slime[1], brand[2] - slime[2]);
      expect(distance, `${id} sits on top of the slime accent`).toBeGreaterThan(60);
    }
  });
});
