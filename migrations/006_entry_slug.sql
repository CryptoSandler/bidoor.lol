-- A short, stable, human-readable handle for an entry, so a shared link can be
-- bidoor.lol/t/ansem instead of a hundred characters of UUID twice over.
--
-- Nullable because it is assigned in application code, where ticker collisions
-- are resolved: the first token to claim a ticker gets it, later ones get the
-- ticker plus a short suffix. The unique index is what makes that race-proof —
-- two settlements picking the same slug in the same instant, the loser retries.
--
-- Entries that predate the column get theirs from scripts/backfill-slugs.mts.
ALTER TABLE entries ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS entries_slug ON entries (slug) WHERE slug IS NOT NULL;
