-- Records who an unmatched payment came from.
--
-- A-3 from AUDITORIA-SEGURIDAD.md: the operator queue showed a stray payment
-- next to a bid id that was supplied by whoever pasted the signature. Applying
-- one meant trusting that association, which is a clean path to being talked
-- into paying an attacker's rank with somebody else's money. The sender is the
-- one fact the chain can give us that the claimant cannot forge.

BEGIN;

ALTER TABLE unmatched_payments ADD COLUMN IF NOT EXISTS sender_fee_payer TEXT;
ALTER TABLE unmatched_payments ADD COLUMN IF NOT EXISTS sender_debited JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO schema_migrations (version) VALUES ('003_unmatched_sender')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
