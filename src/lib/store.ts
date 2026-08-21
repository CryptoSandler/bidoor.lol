import { rankEntries } from "./ranking";
import { SEED } from "./seed-data";
import type { TokenMetadata } from "./dexscreener";
import type { BidEvent, Entry, EntryLinks, RankedEntry } from "./types";
import type { NormalizedBid } from "./validation";

/**
 * Mock in-memory store. No database and no payments yet — a bid is accepted the
 * moment it validates. Everything is shaped so that swapping this for a real
 * store means implementing the same four functions against a table.
 *
 * Held on globalThis so the dev server's hot reload does not wipe the board.
 */
type Store = { entries: Map<string, Entry>; seq: number };

const globalRef = globalThis as unknown as { __board?: Store };

/**
 * Seed rows use real contract addresses with a metadata snapshot captured from
 * DexScreener (see scripts/generate-seed.ts). The board therefore boots without
 * a network call, while every live bid still resolves against the API. Bid
 * amounts and click counts are invented — this is a demo board, not a claim
 * that any of these projects paid for anything.
 */
export type SeedSpec = {
  chainId: Entry["chainId"];
  contract: string;
  name: string;
  ticker: string;
  logoUrl?: string;
  launchpadUrl: string;
  links: EntryLinks;
  clicks: number;
  /** [amount, how long ago it landed] — several entries built their total up. */
  bids: [number, number][];
};


function buildSeed(): Store {
  const now = Date.now();
  const store: Store = { entries: new Map(), seq: 0 };

  for (const spec of SEED) {
    const bids: BidEvent[] = spec.bids
      .map(([amountUsd, ago]) => ({
        id: `bid_${++store.seq}`,
        amountUsd,
        createdAt: new Date(now - ago).toISOString(),
      }))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

    const key = `${spec.chainId}:${spec.contract.toLowerCase()}`;
    store.entries.set(key, {
      id: `entry_${store.entries.size + 1}`,
      chainId: spec.chainId,
      contract: spec.contract,
      contractKey: key,
      name: spec.name,
      ticker: spec.ticker,
      logoUrl: spec.logoUrl,
      metadataFetchedAt: new Date(now).toISOString(),
      launchpadUrl: spec.launchpadUrl,
      launchpadHost: new URL(spec.launchpadUrl).hostname,
      links: spec.links,
      bids,
      clicks: spec.clicks,
      createdAt: bids[0].createdAt,
      lastBidAt: bids[bids.length - 1].createdAt,
    });
  }

  return store;
}

function store(): Store {
  globalRef.__board ??= buildSeed();
  return globalRef.__board;
}

export function listRanked(): RankedEntry[] {
  return rankEntries([...store().entries.values()]);
}

export type Board = {
  entries: RankedEntry[];
  /** One timestamp for the whole page, so no two rows disagree about "now". */
  now: number;
  /** Everything ever bid on the board. */
  potUsd: number;
};

export function getBoard(): Board {
  const now = Date.now();
  const entries = rankEntries([...store().entries.values()], now);
  return {
    entries,
    now,
    potUsd: entries.reduce((sum, entry) => sum + entry.totalUsd, 0),
  };
}

export function findByContractKey(contractKey: string): Entry | undefined {
  // Seed keys are lowercased; canonical Solana/TRON/TON keys are case-sensitive,
  // so check both forms rather than assuming one casing.
  const entries = store().entries;
  return entries.get(contractKey) ?? entries.get(contractKey.toLowerCase());
}

export function findById(id: string): Entry | undefined {
  return [...store().entries.values()].find((entry) => entry.id === id);
}

export type BidOutcome = {
  entry: Entry;
  /** True when the payment added to a token that was already on the board. */
  toppedUp: boolean;
  previousRank: number | null;
  newRank: number;
  totalUsd: number;
};

/**
 * The whole point of keying on the contract address: a bid for a token that is
 * already listed adds to its running total. It never creates a second row.
 *
 * `metadata` always comes from DexScreener, never from the payer, and is
 * re-applied on every top-up. That is what makes a rank un-hijackable: buying
 * into an entry moves its total and nothing else.
 */
export function placeBid(bid: NormalizedBid, metadata: TokenMetadata): BidOutcome {
  const state = store();
  const ranked = listRanked();
  const existing = findByContractKey(bid.contractKey);
  const now = new Date().toISOString();

  const event: BidEvent = {
    id: `bid_${++state.seq}`,
    amountUsd: bid.amountUsd,
    createdAt: now,
  };

  if (existing) {
    const previousRank = ranked.find((row) => row.id === existing.id)?.rank ?? null;
    existing.bids.push(event);
    existing.lastBidAt = now;

    // Refreshed from DexScreener, so a rebrand or a new logo follows the token
    // automatically. Replaced wholesale rather than merged: if the token drops
    // a social link, the board should drop it too.
    existing.name = metadata.name;
    existing.ticker = metadata.ticker;
    existing.logoUrl = metadata.logoUrl;
    existing.links = metadata.links;
    existing.metadataFetchedAt = metadata.fetchedAt;

    // launchpadUrl and launchpadHost are deliberately untouched: frozen by the
    // first bid, so later bidders cannot repoint where the row sends clicks.

    const after = listRanked();
    const row = after.find((item) => item.id === existing.id)!;
    return { entry: existing, toppedUp: true, previousRank, newRank: row.rank, totalUsd: row.totalUsd };
  }

  const entry: Entry = {
    id: `entry_${state.entries.size + 1}`,
    chainId: bid.chainId,
    contract: bid.contract,
    contractKey: bid.contractKey,
    name: metadata.name,
    ticker: metadata.ticker,
    logoUrl: metadata.logoUrl,
    links: metadata.links,
    metadataFetchedAt: metadata.fetchedAt,
    launchpadUrl: bid.launchpadUrl,
    launchpadHost: bid.launchpadHost,
    bids: [event],
    clicks: 0,
    createdAt: now,
    lastBidAt: now,
  };
  state.entries.set(bid.contractKey, entry);

  const after = listRanked();
  const row = after.find((item) => item.id === entry.id)!;
  return { entry, toppedUp: false, previousRank: null, newRank: row.rank, totalUsd: row.totalUsd };
}

export function registerClick(id: string): Entry | undefined {
  const entry = findById(id);
  if (entry) entry.clicks += 1;
  return entry;
}
