import { randomUUID } from "node:crypto";
import { query, transaction } from "./db";
import { SEED } from "./seed-data";
import { launchpadVerifiedFor } from "./store";
import { contractKeyFor } from "./validation";

/**
 * Demo fixture for development and tests.
 *
 * Never loaded in production: the production board starts empty and fills only
 * with real, paid bids. Guarded twice — an explicit flag, and a refusal to run
 * under NODE_ENV=production at all — because a demo row on a board that claims
 * to show what people paid is a lie about money.
 */
export function demoSeedEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.LOAD_DEMO_SEED !== "false";
}

export type SeedOutcome = { loaded: boolean; entries: number; reason?: string };

export async function loadDemoSeed(): Promise<SeedOutcome> {
  if (!demoSeedEnabled()) {
    return { loaded: false, entries: 0, reason: "demo seed is disabled in this environment" };
  }

  const existing = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM entries WHERE delisted_at IS NULL`,
  );
  if (Number(existing[0]?.count ?? 0) > 0) {
    return { loaded: false, entries: 0, reason: "board is not empty" };
  }

  const now = Date.now();

  await transaction(async (client) => {
    for (const spec of SEED) {
      const entryId = `entry_${randomUUID()}`;
      const events = spec.bids
        .map(([amountUsd, ago]) => ({ amountUsd, at: new Date(now - ago) }))
        .sort((a, b) => a.at.getTime() - b.at.getTime());

      await client.query(
        `INSERT INTO entries
           (id, chain_id, contract, contract_key, name, ticker, logo_url, links,
            metadata_fetched_at, launchpad_url, launchpad_host, launchpad_verified,
            click_url, clicks, created_at, last_bid_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          entryId,
          spec.chainId,
          spec.contract,
          // The same canonical key the validator produces. Lowercasing blindly
          // would break every non-EVM chain, where case is significant.
          contractKeyFor(spec.chainId, spec.contract)!,
          spec.name,
          spec.ticker,
          spec.logoUrl ?? null,
          JSON.stringify(spec.links),
          new Date(now),
          spec.launchpadUrl ?? null,
          spec.launchpadUrl ? new URL(spec.launchpadUrl).hostname : null,
          launchpadVerifiedFor(spec.chainId, spec.launchpadUrl ?? null),
          spec.launchpadUrl ?? spec.links.website ?? null,
          spec.clicks,
          events[0].at,
          events[events.length - 1].at,
        ],
      );

      for (const event of events) {
        await client.query(
          `INSERT INTO entry_bids (id, entry_id, amount_usd, created_at) VALUES ($1,$2,$3,$4)`,
          [`bid_${randomUUID()}`, entryId, event.amountUsd, event.at],
        );
      }
    }
  });

  return { loaded: true, entries: SEED.length };
}

/** Wipes every table. Tests only — refuses to run outside them. */
export async function truncateAll(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("truncateAll must never run in production");
  }
  await query(`
    TRUNCATE entry_bids, entries, payments, consumed_signatures, unmatched_payments,
             accepted_bids, verification_attempts, pending_bids RESTART IDENTITY CASCADE
  `);
}
