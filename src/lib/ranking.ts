import { BOARD } from "./config";
import type { Entry, RankedEntry } from "./types";

/**
 * Time decay — designed for, deliberately not switched on yet.
 *
 * The board ranks on lifetime spend today, which means an entry that paid big
 * once outranks an entry paying steadily forever. That eventually freezes the
 * top of the board and kills the reason to keep bidding. The fix is to weight
 * each payment by its age, which is why bids are stored as dated events.
 *
 * Turning this on is a one-line change here plus a copy change on the rules
 * page. It is left off because changing how ranking works after people have
 * paid is a promise we should only make once, deliberately. See DECISIONES.md.
 */
export type DecayConfig = {
  /** Days for a payment to count half as much as it did when it landed. */
  halfLifeDays: number;
  /** Floor on the decay multiplier, so old spend never rounds to nothing. */
  floor: number;
};

export const DECAY: DecayConfig | null = null;

const DAY_MS = 86_400_000;

export function totalUsd(entry: Entry): number {
  return entry.bids.reduce((sum, bid) => sum + bid.amountUsd, 0);
}

export function scoreEntry(
  entry: Entry,
  now: number,
  decay: DecayConfig | null = DECAY,
): number {
  if (!decay) return totalUsd(entry);

  return entry.bids.reduce((sum, bid) => {
    const ageDays = Math.max(0, (now - Date.parse(bid.createdAt)) / DAY_MS);
    const weight = Math.max(decay.floor, 0.5 ** (ageDays / decay.halfLifeDays));
    return sum + bid.amountUsd * weight;
  }, 0);
}

/**
 * Sorts by score, then breaks ties by age: whoever reached the amount first
 * keeps the better rank. Without this, equal totals would order arbitrarily and
 * a rank someone paid for could shuffle on its own.
 */
export function rankEntries(
  entries: Entry[],
  now: number = Date.now(),
  decay: DecayConfig | null = DECAY,
): RankedEntry[] {
  const scored = entries.map((entry) => ({
    entry,
    score: scoreEntry(entry, now, decay),
    total: totalUsd(entry),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const byLastBid = Date.parse(a.entry.lastBidAt) - Date.parse(b.entry.lastBidAt);
    if (byLastBid !== 0) return byLastBid;
    return Date.parse(a.entry.createdAt) - Date.parse(b.entry.createdAt);
  });

  return scored.map(({ entry, score, total }, index) => ({
    ...entry,
    rank: index + 1,
    score,
    totalUsd: total,
    priceToClaim: priceToClaimRank(total),
  }));
}

/**
 * What a newcomer pays to land on a given position: one dollar more than the
 * token holding it, #1 included.
 *
 * #1 used to carry a $5 gap to stop the top spot flipping all day. That is
 * exactly what it stopped, and the flipping is the product — every change of
 * hands at the top is public drama, and the surcharge was buying silence.
 */
export function priceToClaimRank(occupantTotal: number): number {
  return Math.max(BOARD.minBidUsd, occupantTotal + BOARD.step);
}

/**
 * The floor for a specific submission. A newcomer must clear the board minimum;
 * an entry already listed only has to add to what it has, because its rank is
 * bought by its running total rather than by this one payment.
 */
export function minimumBidFor(existingTotal: number | null): number {
  return existingTotal === null ? BOARD.minBidUsd : BOARD.minTopUpUsd;
}
