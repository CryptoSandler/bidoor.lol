/**
 * Gives a slug to entries created before the column existed.
 *
 *   npx tsx scripts/backfill-slugs.mts            # against DATABASE_URL
 *   npx tsx scripts/backfill-slugs.mts --test     # against TEST_DATABASE_URL
 *   npx tsx scripts/backfill-slugs.mts --dry-run  # read, report, write nothing
 *
 * Order matters: oldest first, so the token that listed earliest keeps the bare
 * ticker. That is the same first-come rule the board runs on, and doing it in
 * any other order would hand /t/pepe to whoever happened to be scanned first.
 *
 * Slugs are never reissued once written. A link that has been posted has to
 * keep working, so this only ever fills a NULL.
 */
import { existsSync, readFileSync } from "node:fs";
import { Pool } from "pg";
import { slugCandidates } from "../src/lib/slug";

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
console.log(`Backfilling slugs on ${variable} (${host})${dryRun ? " — dry run" : ""}`);

const pool = new Pool({ connectionString: url });

const { rows } = await pool.query<{ id: string; ticker: string; name: string }>(
  `SELECT id, ticker, name FROM entries WHERE slug IS NULL ORDER BY created_at`,
);

console.log(`${rows.length} entr${rows.length === 1 ? "y" : "ies"} without a slug.`);

const taken = new Set<string>(
  (await pool.query<{ slug: string }>(`SELECT slug FROM entries WHERE slug IS NOT NULL`)).rows.map(
    (row) => row.slug,
  ),
);

let filled = 0;
for (const row of rows) {
  const slug = slugCandidates(row.ticker, row.id).find((candidate) => !taken.has(candidate));
  if (!slug) {
    console.log(`  ${row.name}: no free candidate, skipped`);
    continue;
  }
  if (!dryRun) {
    await pool.query(`UPDATE entries SET slug = $2 WHERE id = $1 AND slug IS NULL`, [row.id, slug]);
  }
  taken.add(slug);
  filled++;
  console.log(`  ${row.name.padEnd(22)} /t/${slug}`);
}

console.log(`\nFilled ${filled}.`);
await pool.end();
