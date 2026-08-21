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
      launchpad_verified INTEGER NOT NULL DEFAULT 0,
      amount_usd     INTEGER NOT NULL,
      -- Salted hash of the caller's IP. Raw addresses are never stored; this
      -- exists only to count bids per caller for rate limiting.
      ip_hash        TEXT,
      -- The exact amount, in USDC base units, that this bid must be paid with:
      -- the bid plus its own random fraction. This is what ties an incoming
      -- transfer to a bid.
      payment_micros INTEGER,
      status         TEXT    NOT NULL DEFAULT 'pending',
      failure_reason TEXT,
      created_at     TEXT    NOT NULL,
      expires_at     TEXT    NOT NULL,
      paid_at        TEXT
    );

    CREATE INDEX IF NOT EXISTS pending_bids_ip ON pending_bids (ip_hash, created_at);
    CREATE INDEX IF NOT EXISTS pending_bids_amount ON pending_bids (amount_usd, status);

    -- Two bids waiting for payment can never ask for the same amount, because
    -- then a transfer matching that amount would be attributable to either.
    -- Enforced here rather than by a lookup in application code, so two bids
    -- created at the same instant cannot both take the same fraction.
    -- Scoped to 'pending': once a bid is paid or expired its amount is free.
    CREATE UNIQUE INDEX IF NOT EXISTS pending_bids_payment_unique
      ON pending_bids (payment_micros) WHERE status = 'pending';

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
      launchpad_verified INTEGER NOT NULL DEFAULT 0,
      amount_usd     INTEGER NOT NULL,
      metadata_json  TEXT    NOT NULL,
      created_at     TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS accepted_bids_created ON accepted_bids (created_at);

    -- A confirmed transfer that reached our wallet but did not match any bid's
    -- exact amount. Recorded rather than discarded: somebody's money arrived,
    -- and support needs to be able to find it. The signature is NOT consumed
    -- here, so a correctly-matched retry is still possible.
    CREATE TABLE IF NOT EXISTS unmatched_payments (
      id                TEXT PRIMARY KEY,
      signature         TEXT    NOT NULL UNIQUE,
      bid_id            TEXT,
      received_base_units TEXT  NOT NULL,
      expected_base_units TEXT  NOT NULL,
      reason            TEXT    NOT NULL,
      created_at        TEXT    NOT NULL
    );
  `);

  migrate(database);

  globalRef.__paymentsDb = database;
  return database;
}

/**
 * Additive migrations for databases created before a column existed. Kept
 * explicit rather than clever: CREATE TABLE IF NOT EXISTS silently does nothing
 * on an existing table, so a new column would otherwise never appear.
 */
function migrate(database: DatabaseSync): void {
  const columns = database.prepare(`PRAGMA table_info(pending_bids)`).all() as { name: string }[];
  if (!columns.some((column) => column.name === "payment_micros")) {
    database.exec(`ALTER TABLE pending_bids ADD COLUMN payment_micros INTEGER`);
  }
  if (!columns.some((column) => column.name === "launchpad_verified")) {
    database.exec(
      `ALTER TABLE pending_bids ADD COLUMN launchpad_verified INTEGER NOT NULL DEFAULT 0`,
    );
  }
  if (!columns.some((column) => column.name === "ip_hash")) {
    database.exec(`ALTER TABLE pending_bids ADD COLUMN ip_hash TEXT`);
  }
}

/** Test helper: drop the cached handle so the next call opens a fresh database. */
export function resetDbForTests(): void {
  globalRef.__paymentsDb?.close();
  delete globalRef.__paymentsDb;
}
