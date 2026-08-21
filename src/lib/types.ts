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
  /**
   * Identity fields below are owned by DexScreener, not by whoever paid. They
   * are refreshed from the same source on every top-up, so buying into an entry
   * can never rewrite what it says.
   */
  name: string;
  ticker: string;
  logoUrl?: string;
  links: EntryLinks;
  /** When the metadata above was last read from DexScreener. */
  metadataFetchedAt: string;
  /**
   * Frozen on the first bid. Top-ups do not touch it: the launchpad link is a
   * claim about where the token launched, and that fact cannot change — letting
   * later bidders edit it would hand them the one field they still control.
   */
  launchpadUrl: string;
  launchpadHost: string;
  /** Set with the link on the first bid: the host is one we recognise. */
  launchpadVerified: boolean;
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
