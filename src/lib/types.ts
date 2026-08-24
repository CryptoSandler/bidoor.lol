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
  /**
   * DexScreener's banner for the token. Optional in the honest sense: most
   * tokens have none, and the expanded card is designed to look finished
   * without it rather than to show a gap where it would go.
   */
  bannerUrl?: string;
  links: EntryLinks;
  /** When the metadata above was last read from DexScreener. */
  metadataFetchedAt: string;
  /**
   * Optional, and frozen on the first bid. Top-ups do not touch it: it is a
   * claim about where the token came from, and that fact cannot change —
   * letting later bidders edit it would hand them the one field they control.
   */
  launchpadUrl: string | null;
  launchpadHost: string | null;
  /**
   * Where this row's clicks go. Frozen when the entry is created and never
   * recalculated, including on a top-up.
   *
   * It has to be frozen because the fallback source — the token's website on
   * DexScreener — is edited by whoever deployed the token. Recomputing it would
   * let a listing that passed review quietly repoint at a drainer later, which
   * is the exact mutable-destination problem the shortener rule exists to
   * prevent. An entry created with nowhere to point stays unclickable rather
   * than adopting a website that appears afterwards.
   */
  clickUrl: string | null;
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
