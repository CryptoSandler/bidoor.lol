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
        background: `var(--bd-chain-${token}-tint)`,
        color: `var(--bd-chain-${token}-ink)`,
      }}
      title={chain?.name ?? chainId}
    >
      {label}
    </span>
  );
}
