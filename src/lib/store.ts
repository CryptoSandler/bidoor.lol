import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getChain, isKnownLaunchpad } from "./chains";
import { isUniqueViolation, query, transaction } from "./db";
import type { TokenMetadata } from "./dexscreener";
import { rankEntries } from "./ranking";
import type { BidEvent, Entry, EntryLinks, RankedEntry } from "./types";
import type { NormalizedBid } from "./validation";

/**
 * The board, in Postgres.
 *
 * The `entries` table IS the board — it is not rebuilt at boot by replaying the
 * payment history. `accepted_bids` and `payments` are the audit trail and the
 * input to reconciliation; nothing derives the live board from them at runtime.
 * That was the right shape when the board was a demo fixture in memory and the
 * wrong one the moment a restart could change what people had paid for.
 */

type EntryRow = {
  id: string;
  chain_id: string;
  contract: string;
  contract_key: string;
  name: string;
  ticker: string;
  logo_url: string | null;
  banner_url: string | null;
  links: EntryLinks;
  metadata_fetched_at: Date;
  launchpad_url: string | null;
  launchpad_host: string | null;
  launchpad_verified: boolean;
  click_url: string | null;
  clicks: number;
  created_at: Date;
  last_bid_at: Date;
};

type BidRow = { id: string; entry_id: string; amount_usd: number; created_at: Date };

const ENTRY_COLUMNS = `
  id, chain_id, contract, contract_key, name, ticker, logo_url, banner_url, links,
  metadata_fetched_at, launchpad_url, launchpad_host, launchpad_verified,
  click_url, clicks, created_at, last_bid_at
`;

function toEntry(row: EntryRow, bids: BidEvent[]): Entry {
  return {
    id: row.id,
    chainId: row.chain_id as Entry["chainId"],
    contract: row.contract,
    contractKey: row.contract_key,
    name: row.name,
    ticker: row.ticker,
    logoUrl: row.logo_url ?? undefined,
    bannerUrl: row.banner_url ?? undefined,
    links: row.links ?? {},
    metadataFetchedAt: row.metadata_fetched_at.toISOString(),
    launchpadUrl: row.launchpad_url,
    launchpadHost: row.launchpad_host,
    launchpadVerified: row.launchpad_verified,
    clickUrl: row.click_url,
    clicks: row.clicks,
    createdAt: row.created_at.toISOString(),
    lastBidAt: row.last_bid_at.toISOString(),
    bids,
  };
}

/** Attaches each entry's dated bid events, which ranking and decay both need. */
async function withBids(rows: EntryRow[]): Promise<Entry[]> {
  if (rows.length === 0) return [];

  const bidRows = await query<BidRow>(
    `SELECT id, entry_id, amount_usd, created_at
       FROM entry_bids
      WHERE entry_id = ANY($1::text[])
      ORDER BY created_at ASC`,
    [rows.map((row) => row.id)],
  );

  const byEntry = new Map<string, BidEvent[]>();
  for (const bid of bidRows) {
    const list = byEntry.get(bid.entry_id) ?? [];
    list.push({ id: bid.id, amountUsd: bid.amount_usd, createdAt: bid.created_at.toISOString() });
    byEntry.set(bid.entry_id, list);
  }

  return rows.map((row) => toEntry(row, byEntry.get(row.id) ?? []));
}

async function liveEntries(): Promise<Entry[]> {
  const rows = await query<EntryRow>(
    `SELECT ${ENTRY_COLUMNS} FROM entries WHERE delisted_at IS NULL`,
  );
  return withBids(rows);
}

export async function listRanked(): Promise<RankedEntry[]> {
  // Ranking stays in the tested pure function rather than being re-expressed in
  // SQL: the tie-break rules and the decay hook live there, and having two
  // implementations of "who is #1" is how they drift. Fine at this board size;
  // if the board reaches thousands of rows this becomes a windowed query.
  return rankEntries(await liveEntries());
}

export type Board = {
  entries: RankedEntry[];
  /** One timestamp for the whole page, so no two rows disagree about "now". */
  now: number;
  potUsd: number;
};

export async function getBoard(): Promise<Board> {
  const now = Date.now();
  const entries = rankEntries(await liveEntries(), now);
  return {
    entries,
    now,
    potUsd: entries.reduce((sum, entry) => sum + entry.totalUsd, 0),
  };
}

export async function findByContractKey(contractKey: string): Promise<Entry | undefined> {
  const rows = await query<EntryRow>(
    `SELECT ${ENTRY_COLUMNS} FROM entries WHERE contract_key = $1 AND delisted_at IS NULL`,
    [contractKey],
  );
  return (await withBids(rows))[0];
}

export async function findById(id: string): Promise<Entry | undefined> {
  const rows = await query<EntryRow>(
    `SELECT ${ENTRY_COLUMNS} FROM entries WHERE id = $1 AND delisted_at IS NULL`,
    [id],
  );
  return (await withBids(rows))[0];
}

export type BidOutcome = {
  entry: Entry;
  toppedUp: boolean;
  previousRank: number | null;
  newRank: number;
  totalUsd: number;
};

/**
 * Applies a paid bid to the board.
 *
 * Keying on the contract address is what makes a second bid a top-up rather
 * than a duplicate row. `metadata` always comes from DexScreener, never from
 * the payer, and is re-applied on every top-up — so buying into an entry moves
 * its total and nothing else.
 */
export async function placeBid(bid: NormalizedBid, metadata: TokenMetadata): Promise<BidOutcome> {
  const before = await listRanked();
  const previousRank = before.find((row) => row.contractKey === bid.contractKey)?.rank ?? null;

  const entryId = await transaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM entries WHERE contract_key = $1 AND delisted_at IS NULL FOR UPDATE`,
      [bid.contractKey],
    );

    if (existing.rows[0]) {
      return topUp(client, existing.rows[0].id, bid, metadata);
    }

    try {
      return await createEntry(client, bid, metadata);
    } catch (error) {
      // Lost a race to another first bid on the same contract. The partial
      // unique index is the arbiter; the loser becomes a top-up, which is what
      // it would have been a millisecond later anyway.
      if (!isUniqueViolation(error)) throw error;
      throw new ConcurrentFirstBid();
    }
  }).catch(async (error) => {
    if (!(error instanceof ConcurrentFirstBid)) throw error;
    return transaction(async (client) => {
      const row = await client.query<{ id: string }>(
        `SELECT id FROM entries WHERE contract_key = $1 AND delisted_at IS NULL FOR UPDATE`,
        [bid.contractKey],
      );
      if (!row.rows[0]) throw error;
      return topUp(client, row.rows[0].id, bid, metadata);
    });
  });

  const after = await listRanked();
  const row = after.find((item) => item.id === entryId)!;

  return {
    entry: row,
    toppedUp: previousRank !== null,
    previousRank,
    newRank: row.rank,
    totalUsd: row.totalUsd,
  };
}

class ConcurrentFirstBid extends Error {}

async function createEntry(
  client: PoolClient,
  bid: NormalizedBid,
  metadata: TokenMetadata,
): Promise<string> {
  const id = `entry_${randomUUID()}`;
  const now = new Date();

  await client.query(
    `INSERT INTO entries
       (id, chain_id, contract, contract_key, name, ticker, logo_url, banner_url,
        links, metadata_fetched_at, launchpad_url, launchpad_host,
        launchpad_verified, click_url, clicks, created_at, last_bid_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,$15,$15)`,
    [
      id,
      bid.chainId,
      bid.contract,
      bid.contractKey,
      metadata.name,
      metadata.ticker,
      metadata.logoUrl ?? null,
      metadata.bannerUrl ?? null,
      JSON.stringify(metadata.links),
      new Date(metadata.fetchedAt),
      bid.launchpadUrl,
      bid.launchpadHost,
      bid.launchpadVerified,
      // Fixed here, at creation, and never recomputed. The fallback source is
      // the token's website on DexScreener, which its deployer edits.
      bid.launchpadUrl ?? metadata.links.website ?? null,
      now,
    ],
  );

  await insertBid(client, id, bid.amountUsd, now);
  return id;
}

async function topUp(
  client: PoolClient,
  entryId: string,
  bid: NormalizedBid,
  metadata: TokenMetadata,
): Promise<string> {
  const now = new Date();
  await insertBid(client, entryId, bid.amountUsd, now);

  // Identity is refreshed from DexScreener, so a rebrand follows the token.
  // Replaced wholesale rather than merged: if the token drops a social link,
  // the board drops it too.
  //
  // launchpad_url, launchpad_host, launchpad_verified and click_url are
  // deliberately absent: frozen by the first bid, so neither a later bidder nor
  // the token's deployer can repoint where the row sends clicks.
  await client.query(
    `UPDATE entries
        SET name = $2, ticker = $3, logo_url = $4, banner_url = $5, links = $6,
            metadata_fetched_at = $7, last_bid_at = $8
      WHERE id = $1`,
    [
      entryId,
      metadata.name,
      metadata.ticker,
      metadata.logoUrl ?? null,
      metadata.bannerUrl ?? null,
      JSON.stringify(metadata.links),
      new Date(metadata.fetchedAt),
      now,
    ],
  );

  return entryId;
}

async function insertBid(
  client: PoolClient,
  entryId: string,
  amountUsd: number,
  at: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO entry_bids (id, entry_id, amount_usd, created_at) VALUES ($1,$2,$3,$4)`,
    [`bid_${randomUUID()}`, entryId, amountUsd, at],
  );
}

export async function registerClick(id: string): Promise<Entry | undefined> {
  await query(`UPDATE entries SET clicks = clicks + 1 WHERE id = $1 AND delisted_at IS NULL`, [id]);
  return findById(id);
}

// --- Moderation --------------------------------------------------------------

export type Delisting = { contractKey: string; reason: string; delistedAt: string };

/**
 * Removes an entry from the board without deleting anything.
 *
 * A soft delete, so the row and its bids stay for audit. Relisting inserts a
 * fresh row — the partial unique index only covers live entries — and it starts
 * from zero, because the old total belongs to the old row.
 */
export async function delistEntry(contractKey: string, reason: string): Promise<Delisting | null> {
  const rows = await query<{ contract_key: string; delisted_reason: string; delisted_at: Date }>(
    `UPDATE entries
        SET delisted_at = now(), delisted_reason = $2
      WHERE contract_key = $1 AND delisted_at IS NULL
      RETURNING contract_key, delisted_reason, delisted_at`,
    [contractKey, reason],
  );

  const row = rows[0];
  if (!row) return null;
  return {
    contractKey: row.contract_key,
    reason: row.delisted_reason,
    delistedAt: row.delisted_at.toISOString(),
  };
}

export async function listDelistings(): Promise<Delisting[]> {
  const rows = await query<{ contract_key: string; delisted_reason: string; delisted_at: Date }>(
    `SELECT contract_key, delisted_reason, delisted_at
       FROM entries
      WHERE delisted_at IS NOT NULL
      ORDER BY delisted_at DESC`,
  );
  return rows.map((row) => ({
    contractKey: row.contract_key,
    reason: row.delisted_reason,
    delistedAt: row.delisted_at.toISOString(),
  }));
}

/** Recomputes the verified mark for a seeded entry. Used only by the fixture. */
export function launchpadVerifiedFor(chainId: string, launchpadUrl: string | null): boolean {
  const chain = getChain(chainId);
  if (!chain || !launchpadUrl) return false;
  return isKnownLaunchpad(chain, new URL(launchpadUrl).hostname);
}
