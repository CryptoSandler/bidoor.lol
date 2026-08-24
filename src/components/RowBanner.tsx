import { bannerSources } from "@/lib/banner";

/**
 * The token's DexScreener banner, sitting in the empty middle of a row.
 *
 * Two things make it safe to put an image somebody else controls inside our
 * card. It occupies only the gap between the name block and the amount, so no
 * text of ours is ever on top of it; and it is masked to transparent at both
 * ends, so whatever colours the banner happens to carry dissolve into the card
 * instead of butting up against the name on one side and the total on the other.
 *
 * The fade is deliberately short. At a quarter of the strip per side it was
 * eating most of the image and reading as washed out rather than blended: it is
 * the transition edge, not the treatment.
 *
 * Hidden below `sm`, where that middle gap does not exist: on a phone the row is
 * already name against price with nothing to spare.
 */
export function RowBanner({ src, isPodium }: { src: string; isPodium: boolean }) {
  const fade = "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)";
  const sources = bannerSources(src);

  return (
    <div
      aria-hidden
      className="hidden shrink-0 self-stretch overflow-hidden sm:block sm:w-24 md:w-40 lg:w-56"
      style={{
        // Pulled out over the row's own padding so the strip is the full height
        // of the card rather than the height of the text inside it.
        marginBlock: `calc(${isPodium ? "var(--bd-podium-pad)" : "var(--bd-row-pad-y)"} * -1)`,
        maskImage: fade,
        WebkitMaskImage: fade,
      }}
    >
      {/* Hotlinked from DexScreener's CDN, the one image host img-src already
          allows besides ourselves — the same place the token logos come from.
          Requested at the width that measured sharpest in the real box, which
          is 900 rather than the 1500 it ships as or the ~600 you would guess.
          eslint-disable-next-line @next/next/no-img-element */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources.src}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
