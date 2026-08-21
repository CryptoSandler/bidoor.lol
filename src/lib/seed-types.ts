import type { ChainId } from "./chains";
import type { EntryLinks } from "./types";

/**
 * Shape of a demo fixture row. Real addresses with metadata captured from
 * DexScreener; the bid amounts and click counts are invented, and this never
 * loads in production.
 */
export type SeedSpec = {
  chainId: ChainId;
  contract: string;
  name: string;
  ticker: string;
  logoUrl?: string;
  launchpadUrl?: string;
  links: EntryLinks;
  clicks: number;
  /** [amount, how long ago it landed] */
  bids: [number, number][];
};
