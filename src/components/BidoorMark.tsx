/**
 * The BIDOOR mark: an arch with a chevron rising inside it — the doorway and
 * "up only" as one shape.
 *
 * It paints in `currentColor` rather than slime. Standing alone on dark, in the
 * favicon and on the link-preview card, the mark is slime; in the header it is
 * not, because the header already spends its slime on the Bid button. That is
 * the same argument that made the wordmark a single colour, and it does not
 * stop being true just because the thing next to the wordmark is a logo.
 */
export function BidoorMark({ size = "1.5rem", className = "" }: { size?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <path
        d="M14 58 L14 26 A18 18 0 0 1 50 26 L50 58"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path
        d="M23 40 L32 30 L41 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="28" y="34" width="8" height="18" rx="2" fill="currentColor" />
    </svg>
  );
}
