/**
 * Removes board entries that nobody paid for.
 *
 * Exists because the demo fixture reached a production database once: a
 * `next dev` server without an inline DATABASE_URL picked up the production one
 * from .env.local, and `next dev` sets NODE_ENV=development, so the guard of the
 * day did not fire. The guard now also checks that the database is local; this
 * is the cleanup for a board that already has fixture rows on it.
 *
 *   npx tsx scripts/purge-demo-entries.mts            # dry run, lists only
 *   npx tsx scripts/purge-demo-entries.mts --confirm  # deletes
 *
 * Safe by construction: it will only ever delete an entry with no payment and
 * no accepted bid behind it. An entry somebody paid for is untouchable here,
 * whatever else is true about it. The schema is not modified.
 */
import { existsSync, readFileSync } from "node:fs";
import { Pool } from "pg";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const confirm = process.argv.includes("--confirm");
const host = url.match(/ep-[a-z0-9-]*/)?.[0] ?? url.match(/localhost:\d+/)?.[0] ?? "unknown host";
const pool = new Pool({ connectionString: url });

type Row = { id: string; name: string; ticker: string; chain_id: string; total: string };

// Unpaid means: no row in payments and none in accepted_bids for this entry.
// Both are checked because a payment can settle before the board row is written.
const UNPAID = `
  SELECT e.id, e.name, e.ticker, e.chain_id, COALESCE(SUM(b.amount_usd), 0)::text AS total
    FROM entries e
    LEFT JOIN entry_bids b ON b.entry_id = e.id
   WHERE NOT EXISTS (SELECT 1 FROM accepted_bids a WHERE a.entry_id = e.id)
     AND NOT EXISTS (
           SELECT 1 FROM accepted_bids a
            JOIN payments p ON p.bid_id = a.bid_id
           WHERE a.contract_key = e.contract_key)
   GROUP BY e.id
   ORDER BY 5 DESC
`;

try {
  console.log(`Database: ${host}`);

  const totals = await pool.query<{ entries: string; payments: string; accepted: string }>(`
    SELECT (SELECT count(*) FROM entries)::text        AS entries,
           (SELECT count(*) FROM payments)::text       AS payments,
           (SELECT count(*) FROM accepted_bids)::text  AS accepted
  `);
  const { entries, payments, accepted } = totals.rows[0];
  console.log(`Entries: ${entries} · payments: ${payments} · accepted bids: ${accepted}\n`);

  const unpaid = (await pool.query<Row>(UNPAID)).rows;

  if (unpaid.length === 0) {
    console.log("Nothing to remove: every entry has a payment behind it.");
    process.exit(0);
  }

  console.log(`Entries with no payment behind them (${unpaid.length}):`);
  for (const row of unpaid) {
    console.log(`  ${row.name.padEnd(22)} ${row.ticker.padEnd(10)} ${row.chain_id.padEnd(12)} $${row.total}`);
  }

  if (!confirm) {
    console.log(`\nDry run. Nothing was deleted.`);
    console.log(`Re-run with --confirm to delete these ${unpaid.length} entries and their bids.`);
    process.exit(0);
  }

  // entry_bids is ON DELETE CASCADE, so removing the entry removes its events.
  const deleted = await pool.query(
    `DELETE FROM entries WHERE id = ANY($1::text[])`,
    [unpaid.map((row) => row.id)],
  );

  const after = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM entries`);
  console.log(`\nDeleted ${deleted.rowCount} entries. ${after.rows[0].n} remain.`);
} finally {
  await pool.end();
}
