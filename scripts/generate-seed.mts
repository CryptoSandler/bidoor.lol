/**
 * Regenerates the seed metadata snapshot in src/lib/seed-data.ts.
 *
 * Seed rows use real contract addresses so the demo board shows real
 * DexScreener metadata, but the board must boot without a network call — so we
 * capture the lookup once, here, through the exact same resolver the live bid
 * path uses. Bid amounts and click counts are invented.
 *
 *   npx tsx scripts/generate-seed.ts
 */
import { writeFileSync } from "node:fs";
import { getChain, type ChainId } from "../src/lib/chains";
import { fetchTokenMetadata } from "../src/lib/dexscreener";

type Candidate = {
  chainId: ChainId;
  contract: string;
  launchpadUrl: string;
  clicks: number;
  bids: [number, number][];
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MIN = 60_000;

const CANDIDATES: Candidate[] = [
  { chainId: "solana", contract: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", launchpadUrl: "https://pump.fun/coin/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", clicks: 18420, bids: [[4200, 9 * DAY], [3100, 3 * DAY], [1450, 41 * MIN]] },
  { chainId: "base", contract: "0x532f27101965dd16442E59d40670FaF5eBB142E4", launchpadUrl: "https://clanker.world/clanker/0x532f27101965dd16442E59d40670FaF5eBB142E4", clicks: 12980, bids: [[5200, 6 * DAY], [2100, 2 * HOUR]] },
  { chainId: "bnb", contract: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", launchpadUrl: "https://four.meme/token/0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", clicks: 9310, bids: [[3000, 5 * DAY], [2400, 30 * HOUR], [900, 3 * HOUR]] },
  { chainId: "ethereum", contract: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", launchpadUrl: "https://zora.co/coin/0x6982508145454Ce325dDbE47a25d4ec3d2311933", clicks: 7740, bids: [[4800, 4 * DAY], [820, 11 * HOUR]] },
  { chainId: "ton", contract: "EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT", launchpadUrl: "https://gaspump.tg/token/notcoin", clicks: 6150, bids: [[2600, 7 * DAY], [1900, 20 * HOUR]] },
  { chainId: "tron", contract: "TXL6rJbvmjD46zeN1JssfgxvSo99qC8MRT", launchpadUrl: "https://sunpump.meme/token/TXL6rJbvmjD46zeN1JssfgxvSo99qC8MRT", clicks: 5480, bids: [[4100, 12 * DAY]] },
  { chainId: "hyperliquid", contract: "0xBe6727B535545C67d5cAa73dEa54865B92CF7907", launchpadUrl: "https://hypurr.fun/token/0xBe6727B535545C67d5cAa73dEa54865B92CF7907", clicks: 4890, bids: [[1800, 8 * DAY], [1500, 26 * HOUR], [500, 55 * MIN]] },
  { chainId: "robinhood", contract: "0x3529E5B86e8749c8487a11ddc239C412228A40cc", launchpadUrl: "https://hood.fun/token/0x3529E5B86e8749c8487a11ddc239C412228A40cc", clicks: 3620, bids: [[2900, 2 * DAY], [400, 6 * HOUR]] },
  { chainId: "solana", contract: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", launchpadUrl: "https://pump.fun/coin/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", clicks: 3110, bids: [[3000, 10 * DAY]] },
  { chainId: "base", contract: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", launchpadUrl: "https://flaunch.gg/base/coin/0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", clicks: 2740, bids: [[1200, 3 * DAY], [900, 14 * HOUR], [420, 20 * MIN]] },
  { chainId: "solana", contract: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", launchpadUrl: "https://letsbonk.fun/token/7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", clicks: 2180, bids: [[1600, 5 * DAY], [380, 4 * HOUR]] },
  { chainId: "ethereum", contract: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", launchpadUrl: "https://zora.co/coin/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", clicks: 1640, bids: [[980, 6 * DAY], [420, 9 * HOUR]] },
  { chainId: "bnb", contract: "0xfb5B838b6cfEEdC2873aB27866079AC55363D37E", launchpadUrl: "https://flap.sh/token/0xfb5B838b6cfEEdC2873aB27866079AC55363D37E", clicks: 1290, bids: [[880, 4 * DAY]] },
  { chainId: "ton", contract: "EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS", launchpadUrl: "https://tonup.io/token/dogs", clicks: 980, bids: [[540, 2 * DAY], [180, 7 * HOUR]] },
  { chainId: "robinhood", contract: "0x79Fe86b963255Ce884bdcaC6388C50a599Ba277f", launchpadUrl: "https://hood.fun/token/0x79Fe86b963255Ce884bdcaC6388C50a599Ba277f", clicks: 610, bids: [[300, 3 * DAY], [95, 2 * HOUR]] },
  { chainId: "solana", contract: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", launchpadUrl: "https://pump.fun/coin/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", clicks: 340, bids: [[120, 30 * HOUR], [40, 90 * MIN]] },
];

const rows: string[] = [];
const failures: string[] = [];

for (const candidate of CANDIDATES) {
  const chain = getChain(candidate.chainId)!;
  const result = await fetchTokenMetadata(chain, candidate.contract);
  if (!result.ok) {
    failures.push(`${candidate.chainId} ${candidate.contract} -> ${result.kind}`);
    continue;
  }
  const meta = result.metadata;
  console.log(`ok  ${candidate.chainId.padEnd(12)} ${meta.ticker.padEnd(10)} ${meta.name}`);
  rows.push(
    `  {\n` +
      `    chainId: ${JSON.stringify(candidate.chainId)},\n` +
      `    contract: ${JSON.stringify(candidate.contract)},\n` +
      `    name: ${JSON.stringify(meta.name)},\n` +
      `    ticker: ${JSON.stringify(meta.ticker)},\n` +
      (meta.logoUrl ? `    logoUrl: ${JSON.stringify(meta.logoUrl)},\n` : "") +
      `    launchpadUrl: ${JSON.stringify(candidate.launchpadUrl)},\n` +
      `    links: ${JSON.stringify(meta.links)},\n` +
      `    clicks: ${candidate.clicks},\n` +
      `    bids: ${JSON.stringify(candidate.bids)},\n` +
      `  },`,
  );
}

if (failures.length) console.log(`\nskipped ${failures.length}:\n  ${failures.join("\n  ")}`);

const file = `// GENERATED by scripts/generate-seed.ts — do not edit by hand.
//
// Real contract addresses with metadata captured from DexScreener, so the demo
// board boots without a network call while live bids still resolve against the
// API. Bid amounts and click counts are invented: nothing here says any of
// these projects paid for anything.
import type { SeedSpec } from "./store";

export const SEED: SeedSpec[] = [
${rows.join("\n")}
];
`;
writeFileSync("src/lib/seed-data.ts", file);
console.log(`\nwrote src/lib/seed-data.ts with ${rows.length} entries`);
