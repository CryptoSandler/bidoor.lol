import { getChain } from "@/lib/chains";

/**
 * Every row carries a chain badge, always. An entry whose chain is no longer in
 * the registry still renders one from its raw id rather than disappearing —
 * silently dropping the badge made rows look like they belonged to no chain at
 * all, which is the one thing this board can never be ambiguous about.
 */
export function ChainBadge({ chainId, className = "" }: { chainId: string; className?: string }) {
  const chain = getChain(chainId);
  const label = chain?.short ?? chainId.slice(0, 4).toUpperCase();
  const token = chain ? chain.id : "unknown";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-2xs font-medium tracking-wide uppercase ${className}`}
      style={{
        // The chain's own colour, twice over: a wash of the brand behind, the
        // readable form of it in front. The wash is mixed against whatever the
        // chip is sitting on rather than baked, so it composites the same on the
        // page, on a podium card and inside a panel.
        //
        // The ink is per-theme and derived, not picked: the bright brand values
        // are unreadable on cream, so each one is walked toward black or white
        // until it clears 4.5:1 on the worst surface. See tokens.css.
        background: `color-mix(in srgb, var(--bd-chain-brand-${token}) var(--bd-chain-tint-alpha), transparent)`,
        color: `var(--bd-chain-${token})`,
      }}
      title={chain?.name ?? chainId}
    >
      {label}
    </span>
  );
}
