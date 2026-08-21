import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

/**
 * Tests run against a real Postgres, never a mock and never SQLite: every
 * guarantee this project makes is a database constraint, and a fake that always
 * says yes would test nothing.
 *
 * The connection comes from TEST_DATABASE_URL, deliberately a different
 * variable from the runtime DATABASE_URL. The suite truncates every table
 * between tests, so pointing it at a database anyone cares about would be
 * destructive — the separation is the safety rail, and the check below is the
 * belt on top of it.
 */
const testUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set.\n\n" +
      "Start a local database with:  docker compose up -d\n" +
      "then put this in .env.local:  TEST_DATABASE_URL=postgres://bidoor:bidoor@localhost:55432/bidoor\n\n" +
      "Or point it at a dedicated Neon branch. Never at a database with real data:\n" +
      "the suite truncates every table.",
  );
}

const runtimeUrl = process.env.DATABASE_URL?.trim();
if (runtimeUrl && runtimeUrl === testUrl) {
  throw new Error(
    "TEST_DATABASE_URL is the same as DATABASE_URL. Refusing to run: the suite " +
      "truncates every table, which would wipe the database the app is using.",
  );
}

// App code reads DATABASE_URL. Sourcing it from TEST_DATABASE_URL here means a
// test process can only ever reach the test database.
process.env.DATABASE_URL = testUrl;

export async function setup() {
  const pool = new Pool({ connectionString: testUrl });
  try {
    for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
      await pool.query(readFileSync(join("migrations", file), "utf8"));
    }
  } finally {
    await pool.end();
  }
}
