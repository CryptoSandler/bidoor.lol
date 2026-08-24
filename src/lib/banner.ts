/**
 * Sizing for the row banner.
 *
 * The source was never too small: DexScreener serves these at 1500x500 for a
 * strip 224 CSS pixels wide. The question was which size renders sharpest once
 * the browser is done with it, and that turned out to be worth measuring rather
 * than reasoning about.
 *
 * Measured on all four banners on the board, rendered into the real 224x77 box
 * and scored by mean absolute Laplacian (higher = more detail retained):
 *
 *            1500    900    600    300
 *   DPR 1    44.6   49.6   40.7   40.8      (aura, representative of all four)
 *   DPR 2    29.0   32.9   26.6   14.6
 *
 * 900 wins on every banner at both pixel ratios. The intuitive answer — ask for
 * roughly what you paint, around 600 — is measurably *worse* than the 1500 it
 * would have replaced, and 300 collapses on retina because 448 device pixels
 * have to be invented from it. So this asks for 900 and nothing else: sharper
 * than what shipped, and about a third of its pixels on the wire.
 *
 * There is no srcset. With a fixed 900 there is nothing to choose between, and
 * offering the smaller variants would let a browser pick one of the sizes that
 * measured worse.
 *
 * The widths are not free choices either. DexScreener's resizer answers 422 to
 * anything outside its own allowlist — 750x250 and 1200x400 are both refused —
 * and 900x300 is one it serves for every banner on the board.
 */

/** The width every banner is requested at. Measured, not guessed — see above. */
export const BANNER_WIDTH = 900;

/** DexScreener's banners are 3:1, and asking in that ratio avoids a second crop. */
const ASPECT = 3;

export type BannerSources = { src: string };

/**
 * Rewrites DexScreener's own resize parameters to the width we render best at.
 *
 * Anything that is not one of their CMS image URLs is passed through untouched:
 * guessing at another host's resizing API would produce broken images, and the
 * plain URL still renders.
 */
export function bannerSources(url: string): BannerSources {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { src: url };
  }

  const host = parsed.hostname.toLowerCase();
  const resizable =
    (host === "cdn.dexscreener.com" || host === "dexscreener.com") &&
    parsed.searchParams.has("width");

  if (!resizable) return { src: url };

  parsed.searchParams.set("width", String(BANNER_WIDTH));
  parsed.searchParams.set("height", String(Math.round(BANNER_WIDTH / ASPECT)));
  return { src: parsed.toString() };
}
