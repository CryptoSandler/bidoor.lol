/**
 * Fills banner_url for entries that were created before the column existed.
 *
 *   npx tsx scripts/backfill-banners.mts            # against DATABASE_URL
 *   npx tsx scripts/backfill-banners.mts --test     # against TEST_DATABASE_URL
 *   npx tsx scripts/backfill-banners.mts --dry-run  # read, report, write nothing
 *
 * Without this, an entry only learns its banner on its next top-up, which for a
 * board that already has rows means the feature looks broken on exactly the
 * tokens people are looking at.
 *
 * Only banner_url is written. Name, ticker, logo and links are refreshed by a
 * top-up and nowhere else, and quietly rewriting them from a script would be a
 * second, invisible path to changing what an entry says.
 */
import { existsSync, readFileSync } from "node:fs";
import { Pool } from "pg";
import { getChain } from "../src/lib/chains";
import { fetchTokenMetadata } from "../src/lib/dexscreener";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const useTest = process.argv.includes("--test");
const dryRun = process.argv.includes("--dry-run");
const variable = useTest ? "TEST_DATABASE_URL" : "DATABASE_URL";
const url = process.env[variable]?.trim();

if (!url) {
  console.error(`${variable} is not set.`);
  process.exit(1);
}

const host = url.match(/ep-[a-z0-9-]*/)?.[0] ?? url.match(/localhost:\d+/)?.[0] ?? "unknown host";
console.log(`Backfilling banners on ${variable} (${host})${dryRun ? " — dry run" : ""}`);

const pool = new Pool({ connectionString: url });

const { rows } = await pool.query<{
  id: string;
  chain_id: string;
  contract: string;
  name: string;
}>(
  `SELECT id, chain_id, contract, name
     FROM entries
    WHERE banner_url IS NULL AND delisted_at IS NULL
    ORDER BY created_at`,
);

console.log(`${rows.length} entr${rows.length === 1 ? "y" : "ies"} without a banner.`);

let filled = 0;
let none = 0;
let failed = 0;

for (const row of rows) {
  const chain = getChain(row.chain_id);
  if (!chain) {
    console.log(`  ${row.name}: unknown chain ${row.chain_id}, skipped`);
    failed++;
    continue;
  }

  const result = await fetchTokenMetadata(chain, row.contract);
  if (!result.ok) {
    console.log(`  ${row.name}: ${result.kind}, left as is`);
    failed++;
    continue;
  }

  const banner = result.metadata.bannerUrl;
  if (!banner) {
    console.log(`  ${row.name}: no banner on DexScreener`);
    none++;
    continue;
  }

  if (!dryRun) {
    await pool.query(`UPDATE entries SET banner_url = $2 WHERE id = $1`, [row.id, banner]);
  }
  console.log(`  ${row.name}: ${banner}`);
  filled++;
}

console.log(`\nFilled ${filled}, no banner ${none}, could not read ${failed}.`);
await pool.end();
