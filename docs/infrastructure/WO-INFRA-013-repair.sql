-- WO-INFRA-013 -- repair of the development database's broken foreign keys.
--
-- NOT A MIGRATION. Never put this under db/migrations; never run it on any database but the local
-- development database, and only with the founder's approval. Procedure, archive and rollback:
-- docs/infrastructure/WO-INFRA-013-REPAIR-PLAN.md.
--
-- It removes the 192 rows that break five foreign keys (fk-audit, 13 November 2026), all of them
-- residue of API test runs against this database (WO-INFRA-013-DATABASE-INTEGRITY-AUDIT.md):
--   core.device              15  (market cccc6666-..., the c6-accounts fixture market, deleted)
--   core.notification         3  (account 26262626-...-030, the t26 fixture account, deleted)
--   core.order_state_transition 10 (their orders deleted by teardowns under replica)
--   core.claim_evidence_item  9  (their claim deleted likewise)
--   core.otp_delivery_attempt 155 (their challenges deleted by teardowns)
-- Nothing references these rows (checked below), so deleting them orphans nothing.
--
-- One transaction: any unexpected count or leftover raises and everything rolls back.
--   docker exec -i adulis-postgres psql -U adulis_bootstrap -d adulis -X -v ON_ERROR_STOP=1 < WO-INFRA-013-repair.sql
\set ON_ERROR_STOP on
BEGIN;

-- 1. The exact rows, frozen.
CREATE TEMP TABLE r_device ON COMMIT DROP AS
  SELECT d.id, d.market_id FROM core.device d WHERE NOT EXISTS (SELECT 1 FROM core.market m WHERE m.id = d.market_id);
CREATE TEMP TABLE r_notification ON COMMIT DROP AS
  SELECT n.id, n.recipient_account_id FROM core.notification n WHERE NOT EXISTS (SELECT 1 FROM core.account a WHERE a.id = n.recipient_account_id);
CREATE TEMP TABLE r_transition ON COMMIT DROP AS
  SELECT t.id FROM core.order_state_transition t WHERE NOT EXISTS (SELECT 1 FROM core."order" o WHERE o.id = t.order_id);
CREATE TEMP TABLE r_evidence ON COMMIT DROP AS
  SELECT e.id FROM core.claim_evidence_item e WHERE NOT EXISTS (SELECT 1 FROM core.claim c WHERE c.id = e.claim_id);
CREATE TEMP TABLE r_attempt ON COMMIT DROP AS
  SELECT a.id FROM core.otp_delivery_attempt a WHERE NOT EXISTS (SELECT 1 FROM core.otp_challenge c WHERE c.id = a.otp_challenge_id);

-- 2. They must be exactly what the audit found, and nothing may reference them.
DO $$
DECLARE
  expected CONSTANT jsonb := '{"device":15,"notification":3,"transition":10,"evidence":9,"attempt":155}';
  found jsonb := jsonb_build_object(
    'device', (SELECT count(*) FROM r_device), 'notification', (SELECT count(*) FROM r_notification),
    'transition', (SELECT count(*) FROM r_transition), 'evidence', (SELECT count(*) FROM r_evidence),
    'attempt', (SELECT count(*) FROM r_attempt));
BEGIN
  IF found <> expected THEN
    RAISE EXCEPTION 'orphan counts changed since the audit: expected %, found % -- re-run fk-audit and the plan', expected, found;
  END IF;
  IF EXISTS (SELECT 1 FROM r_device WHERE market_id <> 'cccc6666-3333-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'an orphaned device is not on the c6-accounts fixture market';
  END IF;
  IF EXISTS (SELECT 1 FROM r_notification WHERE recipient_account_id <> '26262626-2626-4000-8000-000000000030') THEN
    RAISE EXCEPTION 'an orphaned notification is not for the t26 fixture account';
  END IF;
  IF EXISTS (SELECT 1 FROM core.session s JOIN r_device r ON r.id = s.device_id)
     OR EXISTS (SELECT 1 FROM core.account_device x JOIN r_device r ON r.id = x.device_id)
     OR EXISTS (SELECT 1 FROM core.cart x JOIN r_device r ON r.id = x.device_id) THEN
    RAISE EXCEPTION 'a session, account_device or cart row references an orphaned device';
  END IF;
END $$;

-- 3. Delete, counted. order_state_transition and claim_evidence_item are append-only
--    (trg_append_only); replica skips that trigger for THIS transaction only (set_config(..., true)).
--    Deleting a child cannot orphan anything, and step 2 proved nothing references these rows.
DO $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  DELETE FROM core.device WHERE id IN (SELECT id FROM r_device);
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 15 THEN RAISE EXCEPTION 'device: deleted %, expected 15', n; END IF;
  DELETE FROM core.notification WHERE id IN (SELECT id FROM r_notification);
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 3 THEN RAISE EXCEPTION 'notification: deleted %, expected 3', n; END IF;
  DELETE FROM core.order_state_transition WHERE id IN (SELECT id FROM r_transition);
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 10 THEN RAISE EXCEPTION 'order_state_transition: deleted %, expected 10', n; END IF;
  DELETE FROM core.claim_evidence_item WHERE id IN (SELECT id FROM r_evidence);
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 9 THEN RAISE EXCEPTION 'claim_evidence_item: deleted %, expected 9', n; END IF;
  DELETE FROM core.otp_delivery_attempt WHERE id IN (SELECT id FROM r_attempt);
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 155 THEN RAISE EXCEPTION 'otp_delivery_attempt: deleted %, expected 155', n; END IF;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;

-- 4. Every one of the five relations must now hold; otherwise nothing above is kept.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM core.device d WHERE NOT EXISTS (SELECT 1 FROM core.market m WHERE m.id = d.market_id))
     OR EXISTS (SELECT 1 FROM core.notification n WHERE NOT EXISTS (SELECT 1 FROM core.account a WHERE a.id = n.recipient_account_id))
     OR EXISTS (SELECT 1 FROM core.order_state_transition t WHERE NOT EXISTS (SELECT 1 FROM core."order" o WHERE o.id = t.order_id))
     OR EXISTS (SELECT 1 FROM core.claim_evidence_item e WHERE NOT EXISTS (SELECT 1 FROM core.claim c WHERE c.id = e.claim_id))
     OR EXISTS (SELECT 1 FROM core.otp_delivery_attempt a WHERE NOT EXISTS (SELECT 1 FROM core.otp_challenge c WHERE c.id = a.otp_challenge_id)) THEN
    RAISE EXCEPTION 'an orphan remains after the repair';
  END IF;
END $$;

COMMIT;
\echo 'WO-INFRA-013 repair committed: 192 orphaned rows removed; run ops/scripts/fk-audit.mjs to confirm every key holds.'
