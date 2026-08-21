import type { ChainId } from "./chains";

/**
 * Every payment is kept as its own event rather than folded into a running
 * total. Two reasons: the board has to show an audit trail of who paid what and
 * when, and time-decayed ranking (see ranking.ts) needs each amount's own
 * timestamp. Collapsing to a single number would throw that away permanently.
 */
export type BidEvent = {
  id: string;
  amountUsd: number;
  createdAt: string;
};

export type EntryLinks = {
  website?: string;
  x?: string;
  telegram?: string;
  discord?: string;
};

export type Entry = {
  id: string;
  chainId: ChainId;
  /** The address exactly as submitted — what we show. */
  contract: string;
  /** The de-duplication key. Same canonical + same chain = same entry, always. */
  contractKey: string;
  name: string;
  ticker: string;
  logoUrl?: string;
  launchpadUrl: string;
  launchpadHost: string;
  links: EntryLinks;
  bids: BidEvent[];
  clicks: number;
  createdAt: string;
  lastBidAt: string;
};

export type RankedEntry = Entry & {
  rank: number;
  totalUsd: number;
  score: number;
  /** What an outside bidder pays to take this exact position right now. */
  priceToClaim: number;
};
