-- BIDOOR — initial schema.
--
-- Runnable on an empty database: `npm run db:migrate`.
--
-- The constraints in here are not bookkeeping, they are the product's security
-- guarantees. Each one replaces a check-then-act in application code that would
-- lose to a concurrent request — and, now that this is Postgres rather than a
-- file on one machine's disk, they hold across every instance rather than per
-- process. That is the actual reason for this migration.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- The board. This table IS the truth: it is not derived from the payment
-- history at boot. accepted_bids and payments below are audit trail, not a
-- source the board is rebuilt from.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entries (
  id                  TEXT PRIMARY KEY,
  chain_id            TEXT        NOT NULL,
  contract            TEXT        NOT NULL,
  contract_key        TEXT        NOT NULL,

  -- Identity, owned by DexScreener and refreshed on every top-up.
  name                TEXT        NOT NULL,
  ticker              TEXT        NOT NULL,
  logo_url            TEXT,
  links               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  metadata_fetched_at TIMESTAMPTZ NOT NULL,

  -- Frozen by the first bid on the entry; a top-up never touches these.
  launchpad_url       TEXT,
  launchpad_host      TEXT,
  launchpad_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
  click_url           TEXT,

  clicks              INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL,
  last_bid_at         TIMESTAMPTZ NOT NULL,

  -- Delisting is a soft delete. The row stays forever: the board is a record of
  -- money taken, and deleting the evidence of a removal makes it unauditable.
  delisted_at         TIMESTAMPTZ,
  delisted_reason     TEXT
);

-- One live entry per contract. Partial, so a delisted row keeps its history
-- while the same token can be listed again — and the new row starts from zero,
-- because the old row's bids belong to the old row.
CREATE UNIQUE INDEX IF NOT EXISTS entries_contract_key_live
  ON entries (contract_key) WHERE delisted_at IS NULL;

CREATE INDEX IF NOT EXISTS entries_live ON entries (delisted_at);

-- Each payment kept as its own dated event rather than folded into a running
-- total: the board shows an audit trail, and time-decayed ranking (designed,
-- deliberately not switched on) would need each amount's own timestamp.
CREATE TABLE IF NOT EXISTS entry_bids (
  id         TEXT PRIMARY KEY,
  entry_id   TEXT        NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  amount_usd INTEGER     NOT NULL CHECK (amount_usd > 0),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS entry_bids_entry ON entry_bids (entry_id, created_at);

-- ---------------------------------------------------------------------------
-- Payment flow
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_bids (
  id                 TEXT PRIMARY KEY,
  chain_id           TEXT        NOT NULL,
  contract           TEXT        NOT NULL,
  contract_key       TEXT        NOT NULL,
  launchpad_url      TEXT,
  launchpad_host     TEXT,
  launchpad_verified BOOLEAN     NOT NULL DEFAULT FALSE,
  amount_usd         INTEGER     NOT NULL CHECK (amount_usd > 0),

  -- The exact amount, in USDC base units, this bid must be paid with: the bid
  -- plus its own random fraction. The fraction IS the attribution.
  payment_micros     BIGINT,

  -- Salted hash of the caller's address. Raw addresses are never stored; this
  -- exists only to count bids per caller for rate limiting.
  ip_hash            TEXT,

  status             TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
  failure_reason     TEXT,
  created_at         TIMESTAMPTZ NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  paid_at            TIMESTAMPTZ
);

-- Two bids waiting for payment can never ask for the same amount: a transfer
-- matching that amount would then be attributable to either. Scoped to
-- 'pending' so a paid or expired bid releases its amount.
CREATE UNIQUE INDEX IF NOT EXISTS pending_bids_payment_unique
  ON pending_bids (payment_micros) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS pending_bids_ip ON pending_bids (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS pending_bids_amount ON pending_bids (amount_usd, status);
CREATE INDEX IF NOT EXISTS pending_bids_status ON pending_bids (status, expires_at);

-- Every signature ever evaluated against the chain, whatever the verdict.
-- Claimed BEFORE the outcome is acted on, so a signature presented twice loses
-- the second time even if the first presentation did not match. This is what
-- stops an on-chain transfer being a bearer instrument anyone can spend.
CREATE TABLE IF NOT EXISTS consumed_signatures (
  signature   TEXT PRIMARY KEY,
  bid_id      TEXT REFERENCES pending_bids (id),
  outcome     TEXT        NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id                TEXT PRIMARY KEY,
  signature         TEXT        NOT NULL UNIQUE,
  bid_id            TEXT        NOT NULL REFERENCES pending_bids (id),
  amount_base_units TEXT        NOT NULL,
  verified_at       TIMESTAMPTZ NOT NULL
);

-- One bid can only ever have one payment applied to it. The status check in the
-- verify route is a check-then-act and loses to a concurrent request; this does not.
CREATE UNIQUE INDEX IF NOT EXISTS payments_bid_unique ON payments (bid_id);

-- Bids that were paid for and applied to the board. History and reconciliation
-- input — NOT the source the board is derived from.
CREATE TABLE IF NOT EXISTS accepted_bids (
  id             TEXT PRIMARY KEY,
  bid_id         TEXT        NOT NULL REFERENCES pending_bids (id),
  entry_id       TEXT        REFERENCES entries (id),
  chain_id       TEXT        NOT NULL,
  contract       TEXT        NOT NULL,
  contract_key   TEXT        NOT NULL,
  launchpad_url  TEXT,
  launchpad_host TEXT,
  launchpad_verified BOOLEAN  NOT NULL DEFAULT FALSE,
  amount_usd     INTEGER     NOT NULL,
  metadata       JSONB       NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS accepted_bids_bid_unique ON accepted_bids (bid_id);
CREATE INDEX IF NOT EXISTS accepted_bids_created ON accepted_bids (created_at);

-- A confirmed transfer that reached our wallet but matched no bid's exact
-- amount. Recorded rather than discarded: somebody's money arrived, and support
-- needs to find it.
CREATE TABLE IF NOT EXISTS unmatched_payments (
  id                  TEXT PRIMARY KEY,
  signature           TEXT        NOT NULL UNIQUE,
  bid_id              TEXT        REFERENCES pending_bids (id),
  received_base_units TEXT        NOT NULL,
  expected_base_units TEXT        NOT NULL,
  reason              TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'applied', 'discarded')),
  resolved_at         TIMESTAMPTZ,
  resolution_note     TEXT,
  applied_bid_id      TEXT REFERENCES pending_bids (id)
);

CREATE INDEX IF NOT EXISTS unmatched_payments_status ON unmatched_payments (status, created_at);

-- Verification attempts, for rate limiting. Rows outside the window are swept:
-- this is a counter, not an audit log.
CREATE TABLE IF NOT EXISTS verification_attempts (
  id           TEXT PRIMARY KEY,
  bid_id       TEXT        NOT NULL,
  ip_hash      TEXT,
  attempted_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS verification_attempts_bid ON verification_attempts (bid_id, attempted_at);
CREATE INDEX IF NOT EXISTS verification_attempts_ip ON verification_attempts (ip_hash, attempted_at);

INSERT INTO schema_migrations (version) VALUES ('001_initial')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
