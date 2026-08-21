/**
 * Applies every migration in ./migrations, in filename order, once each.
 *
 *   npm run db:migrate
 *
 * Each file is idempotent on its own (IF NOT EXISTS everywhere) and records
 * itself in schema_migrations, so running this against a database that is
 * already up to date does nothing.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set. See README for how to start a local Postgres.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const applied = new Set(
  (await pool.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map(
    (row) => row.version,
  ),
);

const files = readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();
let ran = 0;

for (const file of files) {
  const version = file.replace(/\.sql$/, "");
  if (applied.has(version)) {
    console.log(`  skip  ${version} (already applied)`);
    continue;
  }
  process.stdout.write(`  apply ${version} … `);
  await pool.query(readFileSync(join("migrations", file), "utf8"));
  console.log("ok");
  ran++;
}

console.log(ran === 0 ? "\nDatabase already up to date." : `\nApplied ${ran} migration(s).`);
await pool.end();
