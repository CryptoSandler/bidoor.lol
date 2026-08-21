/**
 * Token avatar. Falls back to initials on a colour derived from the contract
 * address, so an entry never renders as an empty box while still looking
 * deliberate — and two tokens with the same name still look different.
 */
export function TokenMark({
  name,
  contract,
  logoUrl,
  size = 40,
}: {
  name: string;
  contract: string;
  logoUrl?: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  let hash = 0;
  for (const char of contract) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;

  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(140deg, hsl(${hue} 46% 26%), hsl(${(hue + 40) % 360} 42% 16%))`,
        color: `hsl(${hue} 70% 78%)`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)",
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
