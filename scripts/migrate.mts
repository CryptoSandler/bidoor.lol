/**
 * Applies every migration in ./migrations, in filename order, once each.
 *
 *   npm run db:migrate          # against DATABASE_URL
 *   npm run db:migrate -- --test  # against TEST_DATABASE_URL
 *
 * Each file is idempotent on its own (IF NOT EXISTS everywhere) and records
 * itself in schema_migrations, so running this against a database that is
 * already up to date does nothing.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

// Loaded here rather than relying on the shell, so the connection string never
// has to be typed on a command line where it would land in shell history.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const useTest = process.argv.includes("--test");
const variable = useTest ? "TEST_DATABASE_URL" : "DATABASE_URL";
const url = process.env[variable]?.trim();

if (!url) {
  console.error(`${variable} is not set. See README for how to configure it.`);
  process.exit(1);
}

const host = url.match(/ep-[a-z0-9-]*/)?.[0] ?? url.match(/localhost:\d+/)?.[0] ?? "unknown host";
console.log(`Migrating ${variable} (${host})`);

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
