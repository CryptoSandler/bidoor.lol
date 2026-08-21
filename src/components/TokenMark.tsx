/**
 * Token avatar. Logos come from DexScreener; when a token has none we fall back
 * to its initials on a plain surface, so a row never renders as an empty hole.
 */
export function TokenMark({
  name,
  logoUrl,
  size,
}: {
  name: string;
  logoUrl?: string;
  /** A CSS length, always passed as a token (e.g. var(--bd-podium-logo)). */
  size: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-pill bg-surface-2 text-xs font-bold text-muted"
      style={{ width: size, height: size }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
