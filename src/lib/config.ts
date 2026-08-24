/** Economics of the board. One place, so the rules page and the form cannot drift. */
export const BOARD = {
  /** Floor for a brand-new listing. */
  minBidUsd: 1,
  /** Ceiling on a single payment. */
  maxBidUsd: 999_999,
  /** Smallest top-up on an entry that is already listed. */
  minTopUpUsd: 1,
  /** Bids are whole dollars — no cents anywhere in the UI or the maths. */
  step: 1,
  /** Entries rendered before the board asks you to load more. */
  pageSize: 50,
} as const;

export const MAX_NAME_LENGTH = 32;
export const MAX_TICKER_LENGTH = 12;
