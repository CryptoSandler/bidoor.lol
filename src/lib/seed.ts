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

  // Built as two multi-row inserts rather than one query per row. Against a
  // local database the difference is invisible; against a hosted one it is the
  // difference between a fixture that loads in a round-trip and one that takes
  // ~46 of them, which is enough to time out every test that reloads it.
  const entryRows: unknown[] = [];
  const entryPlaceholders: string[] = [];
  const bidRows: unknown[] = [];
  const bidPlaceholders: string[] = [];

  SEED.forEach((spec, index) => {
    const entryId = `entry_${randomUUID()}`;
    const events = spec.bids
      .map(([amountUsd, ago]) => ({ amountUsd, at: new Date(now - ago) }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    const base = index * 16;
    entryPlaceholders.push(
      `(${Array.from({ length: 16 }, (_, i) => `$${base + i + 1}`).join(",")})`,
    );
    entryRows.push(
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
    );

    for (const event of events) {
      const bidBase = bidRows.length;
      bidPlaceholders.push(
        `($${bidBase + 1},$${bidBase + 2},$${bidBase + 3},$${bidBase + 4})`,
      );
      bidRows.push(`bid_${randomUUID()}`, entryId, event.amountUsd, event.at);
    }
  });

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO entries
         (id, chain_id, contract, contract_key, name, ticker, logo_url, links,
          metadata_fetched_at, launchpad_url, launchpad_host, launchpad_verified,
          click_url, clicks, created_at, last_bid_at)
       VALUES ${entryPlaceholders.join(",")}`,
      entryRows,
    );
    await client.query(
      `INSERT INTO entry_bids (id, entry_id, amount_usd, created_at)
       VALUES ${bidPlaceholders.join(",")}`,
      bidRows,
    );
  });

  return { loaded: true, entries: SEED.length };
}

/** Wipes every table. Tests only — refuses to run outside them. */
export async function truncateAll(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("truncateAll must never run in production");
  }
  // admin_audit_log refuses TRUNCATE by trigger — that is the point of it. Tests
  // still need a clean slate, so the trigger is lifted for this one statement
  // and put straight back. The production guard above is what keeps this honest.
  // One round-trip, not three: the whole thing runs as a single simple query,
  // which matters when the database is across a network.
  await query(`
    ALTER TABLE admin_audit_log DISABLE TRIGGER admin_audit_log_no_mutation;
    TRUNCATE entry_bids, entries, payments, consumed_signatures, unmatched_payments,
             accepted_bids, verification_attempts, pending_bids,
             admin_sessions, admin_login_attempts, admin_audit_log
    RESTART IDENTITY CASCADE;
    ALTER TABLE admin_audit_log ENABLE TRIGGER admin_audit_log_no_mutation;
  `);
}
