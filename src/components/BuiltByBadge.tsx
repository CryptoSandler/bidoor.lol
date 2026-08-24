import Image from "next/image";

/**
 * Floating attribution pill, bottom left.
 *
 * The avatar is served from our own /public rather than hotlinked from
 * pbs.twimg.com: the CSP allows images from ourselves and DexScreener's CDN and
 * nothing else, and an X avatar URL rotates whenever the profile picture
 * changes. One file, checked in, no third-party request on every page view.
 */
export function BuiltByBadge() {
  return (
    <a
      href="https://x.com/CryptoSandlerr"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-3 left-3 z-40 inline-flex items-center gap-2 rounded-pill border border-line bg-surface py-1.5 pr-3.5 pl-1.5 text-xs text-muted shadow-card transition-colors hover:text-text sm:bottom-4 sm:left-4"
    >
      {/* next/image rather than the bare <img> the token logos use: those come
          from DexScreener's CDN, this one is a local file, so it can go through
          the optimizer without opening remotePatterns to a third party. */}
      <Image
        src="/cryptosandlerr.jpg"
        alt=""
        width={24}
        height={24}
        className="h-6 w-6 rounded-pill object-cover"
      />
      {/* The handle is what does not fit beside the board's own numbers at
          375px, so the handle is what goes. */}
      <span className="whitespace-nowrap">
        Built by<span className="hidden sm:inline"> @CryptoSandlerr</span>
      </span>
    </a>
  );
}
