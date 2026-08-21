/** Economics of the board. One place, so the rules page and the form cannot drift. */
export const BOARD = {
  /** Floor for a brand-new listing. */
  minBidUsd: 5,
  /** Ceiling on a single payment. */
  maxBidUsd: 999_999,
  /** Smallest top-up on an entry that is already listed. */
  minTopUpUsd: 1,
  /**
   * Extra margin required to take #1, on top of simply matching it. Without
   * this the top spot flips on a $1 increment all day and the most valuable
   * position on the board becomes the cheapest to contest.
   */
  topSpotGapUsd: 5,
  /** Bids are whole dollars — no cents anywhere in the UI or the maths. */
  step: 1,
} as const;

export const MAX_NAME_LENGTH = 32;
export const MAX_TICKER_LENGTH = 12;
