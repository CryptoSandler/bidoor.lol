import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * SQLite, via Node's built-in driver — no native dependency to build.
 *
 * The database exists mainly to hold one guarantee that application code cannot
 * make on its own: a transaction signature can be spent exactly once. That is a
 * UNIQUE constraint on the payments table, enforced by the engine. Checking
 * "have we seen this signature?" in JavaScript would lose to two requests
 * arriving at the same time; the constraint cannot.
 */

const globalRef = globalThis as unknown as { __paymentsDb?: DatabaseSync };

function databasePath(): string {
  return process.env.DATABASE_PATH ?? "data/bidtape.db";
}

export function db(): DatabaseSync {
  if (globalRef.__paymentsDb) return globalRef.__paymentsDb;

  const path = databasePath();
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS pending_bids (
      id             TEXT PRIMARY KEY,
      chain_id       TEXT    NOT NULL,
      contract       TEXT    NOT NULL,
      contract_key   TEXT    NOT NULL,
      launchpad_url  TEXT    NOT NULL,
      launchpad_host TEXT    NOT NULL,
      amount_usd     INTEGER NOT NULL,
      status         TEXT    NOT NULL DEFAULT 'pending',
      failure_reason TEXT,
      created_at     TEXT    NOT NULL,
      expires_at     TEXT    NOT NULL,
      paid_at        TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id                TEXT PRIMARY KEY,
      -- The guarantee this whole table exists for: one signature, one bid, ever.
      signature         TEXT    NOT NULL UNIQUE,
      bid_id            TEXT    NOT NULL,
      amount_base_units TEXT    NOT NULL,
      verified_at       TEXT    NOT NULL,
      FOREIGN KEY (bid_id) REFERENCES pending_bids(id)
    );

    -- Bids that were paid for and applied to the board, so a settled payment
    -- survives a restart instead of living only in memory.
    CREATE TABLE IF NOT EXISTS accepted_bids (
      id             TEXT PRIMARY KEY,
      bid_id         TEXT    NOT NULL,
      chain_id       TEXT    NOT NULL,
      contract       TEXT    NOT NULL,
      contract_key   TEXT    NOT NULL,
      launchpad_url  TEXT    NOT NULL,
      launchpad_host TEXT    NOT NULL,
      amount_usd     INTEGER NOT NULL,
      metadata_json  TEXT    NOT NULL,
      created_at     TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS accepted_bids_created ON accepted_bids (created_at);
  `);

  globalRef.__paymentsDb = database;
  return database;
}

/** Test helper: drop the cached handle so the next call opens a fresh database. */
export function resetDbForTests(): void {
  globalRef.__paymentsDb?.close();
  delete globalRef.__paymentsDb;
}
