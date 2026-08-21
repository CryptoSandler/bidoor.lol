import { getChain } from "@/lib/chains";

export function ChainBadge({ chainId, className = "" }: { chainId: string; className?: string }) {
  const chain = getChain(chainId);
  if (!chain) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[3px] px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase ${className}`}
      style={{ background: chain.tint, color: chain.ink }}
      title={chain.name}
    >
      {chain.short}
    </span>
  );
}
