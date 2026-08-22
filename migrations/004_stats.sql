-- Traffic stats, aggregated at write time.
--
-- The whole design constraint is cost per request on serverless: a heartbeat
-- that INSERTs per ping is unbounded writes. Both tables here are keyed so that
-- repeated pings inside the same window collapse into one row, which turns
-- "N pings" into "at most one write" and lets ON CONFLICT DO NOTHING drop the
-- rest before they touch a page.

-- Presence: one row per (visitor, 60s bucket). The visitor id is ephemeral and
-- lives only in the client's memory — no cookie, no storage, no fingerprint —
-- so it cannot follow anybody between reloads. That is exactly what "who is
-- here right now" needs and nothing more.
-- ip_hash rides along so the endpoint can be capped per caller. It is the same
-- salted hash the rate limiter uses, never a raw address, and it is swept with
-- the row after ten minutes — a shorter life than any other identifier here.
CREATE TABLE IF NOT EXISTS presence (
  bucket  TIMESTAMPTZ NOT NULL,
  visitor TEXT        NOT NULL,
  ip_hash TEXT        NOT NULL,
  PRIMARY KEY (bucket, visitor)
);

CREATE INDEX IF NOT EXISTS presence_ip ON presence (ip_hash, bucket);

CREATE INDEX IF NOT EXISTS presence_bucket ON presence (bucket);

-- Unique visitors, deduped per day per caller. ip_hash is the same salted
-- SHA-256 the rate limiter uses, never a raw address, and it ages out with the
-- same retention.
CREATE TABLE IF NOT EXISTS visitors (
  day     DATE NOT NULL,
  ip_hash TEXT NOT NULL,
  PRIMARY KEY (day, ip_hash)
);

-- The rolled-up counter, so rendering "1,176,806 visitors" is one small read
-- rather than a count over every row ever written.
CREATE TABLE IF NOT EXISTS visitor_totals (
  day     DATE PRIMARY KEY,
  uniques INTEGER NOT NULL
);
