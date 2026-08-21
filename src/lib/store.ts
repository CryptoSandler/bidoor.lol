import { rankEntries } from "./ranking";
import type { BidEvent, Entry, RankedEntry } from "./types";
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

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type SeedSpec = {
  chainId: Entry["chainId"];
  contract: string;
  name: string;
  ticker: string;
  launchpadUrl: string;
  links: Entry["links"];
  clicks: number;
  /** [amount, how long ago it landed] — several entries built their total up. */
  bids: [number, number][];
};

const SEED: SeedSpec[] = [
  {
    chainId: "solana", contract: "6FkMUjfi7ZbnTHWGLc4MsGyJ1ynUdvG48grzSFFfH1Ro",
    name: "Hyperfrog", ticker: "HFROG", launchpadUrl: "https://pump.fun/coin/hyperfrog",
    links: { x: "https://x.com/hyperfrogsol", telegram: "https://t.me/hyperfrog", website: "https://hyperfrog.xyz" },
    clicks: 18420, bids: [[4200, 9 * DAY], [3100, 3 * DAY], [1450, 41 * MINUTE]],
  },
  {
    chainId: "base", contract: "0x66220e71591b2d933c0e935c138ebfd60710b91f",
    name: "Clank Machine", ticker: "CLANK", launchpadUrl: "https://clanker.world/clanker/clank-machine",
    links: { x: "https://x.com/clankmachine", website: "https://clankmachine.fun" },
    clicks: 12980, bids: [[5200, 6 * DAY], [2100, 2 * HOUR]],
  },
  {
    chainId: "bnb", contract: "0x2f5da6e9921baa794759ee9f4b362555bcb3c164",
    name: "Four Kings", ticker: "4KING", launchpadUrl: "https://four.meme/token/fourkings",
    links: { x: "https://x.com/fourkingsbnb", telegram: "https://t.me/fourkings" },
    clicks: 9310, bids: [[3000, 5 * DAY], [2400, 30 * HOUR], [900, 3 * HOUR]],
  },
  {
    chainId: "hyperliquid", contract: "0xf28d5b0d6f8be0da8446dabe79044cb9ed0ffa31",
    name: "Purr Machine", ticker: "PURRM", launchpadUrl: "https://hypurr.fun/token/purr-machine",
    links: { x: "https://x.com/purrmachine", website: "https://purrmachine.wtf" },
    clicks: 7740, bids: [[4800, 4 * DAY], [820, 11 * HOUR]],
  },
  {
    chainId: "solana", contract: "9U27YCezrhLb2E7Bm8iDCp3j4mWZhDcfP8svzkjoGVuc",
    name: "Bonk Butler", ticker: "BUTLER", launchpadUrl: "https://letsbonk.fun/token/bonk-butler",
    links: { x: "https://x.com/bonkbutler", telegram: "https://t.me/bonkbutler" },
    clicks: 6150, bids: [[2600, 7 * DAY], [1900, 20 * HOUR]],
  },
  {
    chainId: "ethereum", contract: "0x56f8921507e0f67c48d43947aedb1470fd561233",
    name: "Gas Ghost", ticker: "GHOST", launchpadUrl: "https://zora.co/coin/gas-ghost",
    links: { x: "https://x.com/gasghosteth", website: "https://gasghost.eth.limo" },
    clicks: 5480, bids: [[4100, 12 * DAY]],
  },
  {
    chainId: "ton", contract: "EQB1xHse92ejDrOc202WRiNQ-0tZKUJs54PQDA4TI5jJsukH",
    name: "Durov's Cat", ticker: "DCAT", launchpadUrl: "https://gaspump.tg/token/durovs-cat",
    links: { x: "https://x.com/durovscat", telegram: "https://t.me/durovscat" },
    clicks: 4890, bids: [[1800, 8 * DAY], [1500, 26 * HOUR], [500, 55 * MINUTE]],
  },
  {
    chainId: "robinhood", contract: "0x0b227dd238234a0b1a29605d2857ea067969f6bd",
    name: "Hood Rat", ticker: "HOOD", launchpadUrl: "https://robinhood.com/chain/token/hood-rat",
    links: { x: "https://x.com/hoodratrhc" },
    clicks: 3620, bids: [[2900, 2 * DAY], [400, 6 * HOUR]],
  },
  {
    chainId: "tron", contract: "TENjPiVxkLdL9Me4oi2dmvgUKC8LmX1YSF",
    name: "Sun Dial", ticker: "SUNDL", launchpadUrl: "https://sunpump.meme/token/sun-dial",
    links: { x: "https://x.com/sundialtrx", telegram: "https://t.me/sundial" },
    clicks: 3110, bids: [[3000, 10 * DAY]],
  },
  {
    chainId: "base", contract: "0x1a070b69fe26e7da07820cf0479030b1c11c753f",
    name: "Flaunt Dog", ticker: "FDOG", launchpadUrl: "https://flaunch.gg/base/coin/flaunt-dog",
    links: { x: "https://x.com/flauntdog" },
    clicks: 2740, bids: [[1200, 3 * DAY], [900, 14 * HOUR], [420, 20 * MINUTE]],
  },
  {
    chainId: "solana", contract: "BW86wUMY2WS7UVqWsHjXMmeNeYet5F1hEjbTvQpWHBE1",
    name: "Believe Bear", ticker: "BBEAR", launchpadUrl: "https://believe.app/coin/believe-bear",
    links: { x: "https://x.com/believebear", website: "https://believebear.io" },
    clicks: 2180, bids: [[1600, 5 * DAY], [380, 4 * HOUR]],
  },
  {
    chainId: "bnb", contract: "0x1d5b1d0bc460ae40dd3383c602b3dac7aab32e1f",
    name: "Flap Jack", ticker: "FLAP", launchpadUrl: "https://flap.sh/token/flap-jack",
    links: { x: "https://x.com/flapjackbnb" },
    clicks: 1640, bids: [[980, 6 * DAY], [420, 9 * HOUR]],
  },
  {
    chainId: "hyperliquid", contract: "0xb5529fbc65bf00ae4e0c7e5b3ebb8674efd3b6d2",
    name: "Liquid Lad", ticker: "LLAD", launchpadUrl: "https://liquidlaunch.app/token/liquid-lad",
    links: { x: "https://x.com/liquidlad" },
    clicks: 1290, bids: [[880, 4 * DAY]],
  },
  {
    chainId: "ethereum", contract: "0xf28d5b0d6f8be0da8446dabe79044cb9ed0ffa32",
    name: "Zora Zebra", ticker: "ZEBRA", launchpadUrl: "https://zora.co/coin/zora-zebra",
    links: { x: "https://x.com/zorazebra" },
    clicks: 980, bids: [[540, 2 * DAY], [180, 7 * HOUR]],
  },
  {
    chainId: "ton", contract: "EQA7fp2i313pUjKCQkZWpRzjk1I4ZvkXn5OpJ0Q1Otdsuomu",
    name: "Toncoin Toad", ticker: "TTOAD", launchpadUrl: "https://tonup.io/token/toncoin-toad",
    links: { telegram: "https://t.me/toncointoad" },
    clicks: 610, bids: [[300, 3 * DAY], [95, 2 * HOUR]],
  },
  {
    chainId: "tron", contract: "TCbQhz1gB32mysM68r2iKykYSoUjbiAJKH",
    name: "Justin's Pet", ticker: "JPET", launchpadUrl: "https://sunpump.meme/token/justins-pet",
    links: { x: "https://x.com/justinspet" },
    clicks: 340, bids: [[120, 30 * HOUR], [40, 90 * MINUTE]],
  },
  {
    chainId: "robinhood", contract: "0x9d3e1a70c8f4b2d6e5a081c37f42b9ae6d1c05f8",
    name: "Chain Chicken", ticker: "CHICK", launchpadUrl: "https://robinhood.com/chain/token/chain-chicken",
    links: {},
    clicks: 210, bids: [[60, 18 * HOUR], [15, 25 * MINUTE]],
  },
];

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
 * already listed adds to its running total. It never creates a second row, no
 * matter what name, ticker or links came with this particular payment.
 */
export function placeBid(bid: NormalizedBid): BidOutcome {
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
    // Metadata is refreshed from the newest payment — a project that rebrands
    // or fixes a broken link should not have to create a second entry.
    existing.name = bid.name;
    existing.ticker = bid.ticker;
    existing.launchpadUrl = bid.launchpadUrl;
    existing.launchpadHost = bid.launchpadHost;
    existing.links = { ...existing.links, ...bid.links };
    if (bid.logoUrl) existing.logoUrl = bid.logoUrl;

    const after = listRanked();
    const row = after.find((item) => item.id === existing.id)!;
    return { entry: existing, toppedUp: true, previousRank, newRank: row.rank, totalUsd: row.totalUsd };
  }

  const entry: Entry = {
    id: `entry_${state.entries.size + 1}`,
    chainId: bid.chainId,
    contract: bid.contract,
    contractKey: bid.contractKey,
    name: bid.name,
    ticker: bid.ticker,
    logoUrl: bid.logoUrl,
    launchpadUrl: bid.launchpadUrl,
    launchpadHost: bid.launchpadHost,
    links: bid.links,
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
