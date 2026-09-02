import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { takeSuiteLock, type SuiteLock } from "./suite-lock";

// Loaded here so the connection string lives in .env.local rather than being
// exported into a shell where it would end up in history.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

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
  /*
    THE MACHINE-WIDE SUITE LOCK, before anything else this file does.

    Every repository on this machine takes the same lock, so a second suite
    QUEUES instead of competing for the cores. Measured in `milliondollarpage`
    on 2026-09-02: three runs of one commit took 1269s green, then 2883s with
    three failures, then 6249s with nine — every failure a dropped Postgres
    connection, from workers that waited for CPU longer than the database's idle
    timeout. `suite-lock.ts` carries the whole argument, and it is the same file
    in all six repositories on purpose.
  */
  const suiteLock: SuiteLock = await takeSuiteLock();

  const pool = new Pool({ connectionString: testUrl });
  try {
    for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
      await pool.query(readFileSync(join("migrations", file), "utf8"));
    }
  } finally {
    await pool.end();
  }

  // Vitest treats what `setup` returns as the teardown. This file had none;
  // it has one now, and its only job is to hand the machine lock on.
  return () => {
    suiteLock.release();
  };
}
