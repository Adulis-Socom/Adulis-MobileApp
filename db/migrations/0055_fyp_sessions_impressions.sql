-- ============================================================================
-- 0055 -- For You: algorithm versions, feed sessions, served impressions
--         (WORK ORDER WO-DISC-002; ADU-REC-01 v3.2 S12, S45-S47, S52-S55,
--          S71-S72, S75; overnight batch of 10 November 2026)
--
-- GET /v1/fyp serves Scene units only, from the one public read gate of 0054
-- (core.v_scene_post_public). This migration adds only what REC-01 says must be
-- persisted for that: the immutable algorithm configurations (S45, S75), the
-- bounded feed session (S52, S71) and the served-impression record (S55, S72).
-- No affinity, trending, projection or experiment table: none of those features
-- exists yet, and REC-01 S70 keeps projections rebuildable, not canonical.
--
-- Recommendation never writes Content, Catalogue or Seller state (S8, S9).
--
-- LIFECYCLE. A guest's sessions go with its device (ON DELETE CASCADE, so
-- device.purge_unbound is never pinned); an Account's go at account deletion
-- (core.fn_delete_account, patched below by the D-62 method). No retention
-- period is set for live sessions: ADU-DPIA-01 PA-06 leaves it to legal review.
--
-- A SERVED impression, not a qualified one. A row here records that a unit was
-- delivered at a position, from a source, under an algorithm version, for an
-- exact Scene revision. It is not a view: REC-01 S35 qualifies an impression only
-- after a visible-area and time threshold, which is client telemetry and later
-- work.
--
-- ENUM-SHAPED TEXT, as in 0054: vocabularies are text with CHECK constraints so
-- Appendix A does not change.
-- ============================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- core.fyp_algorithm_version -- immutable ranking configuration (S45, S75)
-- ---------------------------------------------------------------------------
CREATE TABLE core.fyp_algorithm_version (
  id                   text PRIMARY KEY,
  schema_version       int NOT NULL,
  -- Weights, thresholds, caps and source budgets (S45). Validated by the API
  -- before it serves (FypConfig); the database guarantees only its shape.
  config               jsonb NOT NULL,
  status               text NOT NULL DEFAULT 'RETIRED',
  -- Whether this version may serve in production. A technical baseline is not
  -- product-tuned ranking and stays false until the founder approves one.
  production_approved  boolean NOT NULL DEFAULT false,
  description          text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  activated_at         timestamptz NULL,

  CONSTRAINT fyp_algorithm_version_id_format CHECK (id ~ '^[a-z0-9][a-z0-9.-]{2,63}$'),
  CONSTRAINT fyp_algorithm_version_schema CHECK (schema_version >= 1),
  CONSTRAINT fyp_algorithm_version_config_object CHECK (jsonb_typeof(config) = 'object'),
  CONSTRAINT fyp_algorithm_version_status CHECK (status IN ('ACTIVE', 'RETIRED')),
  CONSTRAINT fyp_algorithm_version_activated CHECK (status <> 'ACTIVE' OR activated_at IS NOT NULL)
);

-- At most one version serves new sessions at a time.
CREATE UNIQUE INDEX fyp_algorithm_version_one_active
  ON core.fyp_algorithm_version (status) WHERE status = 'ACTIVE';

-- "Do not silently mutate an active version" (S75): a version's identity and
-- configuration never change; a changed configuration is a new row.
CREATE FUNCTION core.fn_guard_fyp_algorithm_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = core AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'algorithm versions are retained for replay (S75)'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
     OR NEW.config IS DISTINCT FROM OLD.config OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'an algorithm version is immutable; a changed configuration is a new version'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_guard_fyp_algorithm_version
  BEFORE UPDATE OR DELETE ON core.fyp_algorithm_version
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_fyp_algorithm_version();

COMMENT ON TABLE core.fyp_algorithm_version IS
  'ADU-REC-01 v3.2 S45/S75: immutable For You ranking configurations. '
  'adulis_app reads only; versions are added and activated by migration. '
  'production_approved gates serving in production.';

-- The one configuration this repository can honestly run today: the RECENT
-- source over the public gate, deterministic seeded tie-breaking, no feature
-- weights (no feature data exists), diversity controls present but OFF (no
-- approved thresholds). Every number below is a technical safety bound, not a
-- product rule. Not approved for production.
INSERT INTO core.fyp_algorithm_version
  (id, schema_version, config, status, production_approved, description, activated_at)
VALUES (
  'technical-baseline-recent-v1',
  1,
  '{
     "sources": { "RECENT": { "budget": 60 } },
     "page": { "default_limit": 10, "max_limit": 24 },
     "session": { "ttl_seconds": 3600, "max_items": 500 },
     "tie_break": "SEEDED_HASH",
     "diversity": { "seller_adjacency_max": null }
   }'::jsonb,
  'ACTIVE',
  false,
  'Technical cold-start baseline (WO-DISC-002): RECENT only, seeded deterministic tie-break, '
  'diversity off. Not tuned personalisation; not approved for production.',
  now()
);

-- ---------------------------------------------------------------------------
-- core.fyp_session -- one bounded For You session (S52, S53, S71)
-- ---------------------------------------------------------------------------
CREATE TABLE core.fyp_session (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The subject is server-derived (S11, S86): the signed-in Account, or for a
  -- guest the registered device. The caller never names it.
  subject_kind        text NOT NULL,
  account_id          uuid NULL REFERENCES core.account (id),
  -- ON DELETE CASCADE: device.purge_unbound (S11.5) deletes an unbound guest
  -- device after media_retention; its For You sessions and impressions go with
  -- it rather than pinning the device (the 23503 trap 0038/e4-retention record).
  device_id           uuid NULL REFERENCES core.device (id) ON DELETE CASCADE,
  market_id           uuid NOT NULL REFERENCES core.market (id),
  algorithm_version   text NOT NULL REFERENCES core.fyp_algorithm_version (id),
  -- The session-derived deterministic seed (S46, S47).
  seed                bigint NOT NULL,
  -- SHA-256 of the continuation secret inside the cursor; the secret itself is
  -- never stored (the session credential pattern of 0053).
  cursor_secret_hash  bytea NOT NULL,
  served_count        int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  last_served_at      timestamptz NULL,

  CONSTRAINT fyp_session_id_version UNIQUE (id, algorithm_version),
  CONSTRAINT fyp_session_subject CHECK (
    (subject_kind = 'ACCOUNT' AND account_id IS NOT NULL AND device_id IS NULL)
    OR (subject_kind = 'DEVICE' AND device_id IS NOT NULL AND account_id IS NULL)),
  CONSTRAINT fyp_session_cursor_secret CHECK (octet_length(cursor_secret_hash) = 32),
  CONSTRAINT fyp_session_served CHECK (served_count >= 0),
  CONSTRAINT fyp_session_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_fyp_session_account ON core.fyp_session (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_fyp_session_device ON core.fyp_session (device_id) WHERE device_id IS NOT NULL;
CREATE INDEX idx_fyp_session_expiry ON core.fyp_session (expires_at);

COMMENT ON TABLE core.fyp_session IS
  'ADU-REC-01 v3.2 S52/S71: subject, Market, algorithm version, seed, expiry and '
  'bounded continuation (served_count) of one For You session. Stores no browsing '
  'history beyond the served impressions it owns; never freezes eligibility.';

-- ---------------------------------------------------------------------------
-- core.fyp_impression -- one row per SERVED unit (S55, S72)
-- ---------------------------------------------------------------------------
CREATE TABLE core.fyp_impression (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid NOT NULL,
  scene_post_id      uuid NOT NULL,
  revision_id        uuid NOT NULL,
  algorithm_version  text NOT NULL,
  position           int NOT NULL,
  candidate_source   text NOT NULL,
  served_at          timestamptz NOT NULL DEFAULT now(),

  -- Bound to its session AND that session's algorithm version: an impression
  -- cannot claim a version its session was not served under.
  CONSTRAINT fyp_impression_session FOREIGN KEY (session_id, algorithm_version)
    REFERENCES core.fyp_session (id, algorithm_version) ON DELETE CASCADE,
  -- Bound to the exact served revision of the exact Scene.
  CONSTRAINT fyp_impression_revision FOREIGN KEY (revision_id, scene_post_id)
    REFERENCES core.scene_post_revision (id, scene_post_id),
  -- No Scene twice in one session; no two units at one position.
  CONSTRAINT fyp_impression_scene_once UNIQUE (session_id, scene_post_id),
  CONSTRAINT fyp_impression_position_once UNIQUE (session_id, position),
  CONSTRAINT fyp_impression_position CHECK (position >= 1),
  -- REC-01 S19's registry. Only RECENT is executable today (WO-DISC-002 record).
  CONSTRAINT fyp_impression_source CHECK (candidate_source IN (
    'ONBOARDING_INTEREST', 'CATEGORY_AFFINITY', 'SELLER_AFFINITY', 'FOLLOWING', 'RECENT',
    'TRENDING', 'NEW_SELLER', 'NEW_CONTENT', 'EXPLORATION'))
);

CREATE INDEX idx_fyp_impression_scene ON core.fyp_impression (scene_post_id);

COMMENT ON TABLE core.fyp_impression IS
  'ADU-REC-01 v3.2 S55/S72: a SERVED unit (session, exact revision, algorithm '
  'version, position, source, time). Not a qualified impression (S35). '
  'adulis_app may insert and read, never change or delete.';

-- ---------------------------------------------------------------------------
-- Account deletion purges the Account's For You sessions (ADU-PRV-01)
-- ---------------------------------------------------------------------------
-- METHOD (D-62, the standing rule, as in 0038): the body below is EXTRACTED
-- from the live database with pg_get_functiondef and patched at exactly one
-- site -- the DELETE FROM core.fyp_session after the account_device purge --
-- never retyped. Same signature, so CREATE OR REPLACE keeps the object, its
-- owner and its grants; all three are re-asserted below anyway. No backfill:
-- the tables are new in this migration, so no scrubbed Account has a session.
CREATE OR REPLACE FUNCTION core.fn_delete_account(p_account_id uuid, p_otp_challenge_id uuid, p_phone_hash bytea)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core'
AS $function$
DECLARE
  v_account core.account;
  v_seller  record;
  v_res     record;
  v_money   int;
  v_cooling interval;
BEGIN
  SELECT * INTO v_account FROM core.account
   WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND OR v_account.status = 'SCRUBBED' THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  -- The ticket: a consumed deletion challenge for THIS phone, still fresh.
  IF NOT EXISTS (
    SELECT 1 FROM core.otp_challenge c
     WHERE c.id = p_otp_challenge_id
       AND c.purpose = 'ACCOUNT_DELETION'
       AND c.phone_e164 = v_account.phone_e164
       AND c.consumed_at IS NOT NULL
       AND c.consumed_at > now() - interval '15 minutes'
  ) THEN
    RAISE EXCEPTION 'deletion ticket invalid' USING ERRCODE = 'U0001';
  END IF;

  -- Owned sellers: each must clear its S16.9 blockers, then each is deleted
  -- with the full effects, including its phone-reuse block.
  FOR v_seller IN
    SELECT id, market_id FROM core.seller
     WHERE owner_account_id = p_account_id AND status <> 'DELETED'
  LOOP
    IF EXISTS (SELECT 1 FROM core.fn_deletion_blockers(v_seller.id)) THEN
      RAISE EXCEPTION 'deletion blocked' USING ERRCODE = '23001';
    END IF;
  END LOOP;

  -- Buyer-side money gate (DECIDED, see header): an order whose payment is
  -- submitted or confirmed cannot be settled against a scrubbed account.
  SELECT count(*)::int INTO v_money
    FROM core."order" o
   WHERE o.buyer_account_id = p_account_id
     AND o.state IN ('PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED');
  IF v_money > 0 THEN
    RAISE EXCEPTION 'deletion blocked' USING ERRCODE = '23001';
  END IF;

  FOR v_seller IN
    SELECT id, market_id FROM core.seller
     WHERE owner_account_id = p_account_id AND status <> 'DELETED'
  LOOP
    PERFORM core.fn_delete_seller_effects(v_seller.id);
    SELECT tc.deleted_number_cooling_period INTO v_cooling
      FROM core.timing_config tc
     WHERE tc.market_id = v_seller.market_id AND tc.effective @> now();
    IF v_cooling IS NULL THEN
      RAISE EXCEPTION 'timing configuration absent for market %',
        v_seller.market_id USING ERRCODE = 'restrict_violation';
    END IF;
    INSERT INTO core.phone_reuse_block (phone_hash, market_id, blocked_until)
    VALUES (p_phone_hash, v_seller.market_id, now() + v_cooling)
    ON CONFLICT (phone_hash, market_id) DO UPDATE
       SET blocked_until = greatest(core.phone_reuse_block.blocked_until,
                                    EXCLUDED.blocked_until);
  END LOOP;

  -- Active reservations released (PRD section 21): the buyer-cancel path,
  -- reused, so the stock release, the order transition and the counters all
  -- happen exactly as they do for an ordinary cancellation. Only pre-payment
  -- orders reach here - the money gate above excluded the rest.
  FOR v_res IN
    SELECT r.id AS reservation_id, r.order_id
      FROM core.reservation r
      JOIN core."order" o ON o.id = r.order_id
     WHERE o.buyer_account_id = p_account_id AND r.state = 'ACTIVE'
       AND o.state IN ('CREATED', 'NOTIFIED')
  LOOP
    PERFORM core.fn_cancel_line(
      v_res.order_id, v_res.reservation_id, p_account_id, false);
  END LOOP;

  -- Sessions die with the status flip: authentication reads account status
  -- on every request and refuses anything but ACTIVE. Explicit revocation
  -- as well, so the sessions surface shows the truth immediately.
  UPDATE core.session SET revoked_at = now()
   WHERE account_id = p_account_id AND revoked_at IS NULL;
  -- T7 S3.4 (ADU-RUL-02 via D-64's residual): account_device rows are
  -- REMOVED, not stamped. A remembered-device row is a standing credential
  -- for an identity that no longer exists -- worse than the wedge D-64
  -- fixed, because that failed loudly in a log and this outlives its
  -- account silently. The session FK is unhooked first:
  -- core.session.account_device_id references these rows with NO ON DELETE
  -- action, and revoked session rows are retained, so a bare DELETE would
  -- raise 23503 for any account that ever remembered a CONSOLE device.
  -- Filtered by the REFERENCING column, not session.account_id -- the
  -- constraint does not guarantee the referencing session belongs to this
  -- account.
  UPDATE core.session SET account_device_id = NULL
   WHERE account_device_id IN (SELECT ad.id FROM core.account_device ad
                                WHERE ad.account_id = p_account_id);
  DELETE FROM core.account_device WHERE account_id = p_account_id;
  -- For You (0055): an Account's feed sessions are recommendation-personal
  -- data (ADU-PRV-01 S7 "ACCOUNT_DELETION_COMPLETED -> purge person
  -- profile/link"). Its served impressions go with them (ON DELETE CASCADE).
  DELETE FROM core.fyp_session WHERE account_id = p_account_id;

  -- Reviews this account wrote: anonymised, never deleted.
  UPDATE core.review
     SET buyer_account_id = NULL,
         anonymised_at = coalesce(anonymised_at, now())
   WHERE buyer_account_id = p_account_id;

  -- Identity scrubbed. The tombstone phone (header) satisfies core.e164,
  -- stays unique, and frees the real number. person survives (section 6.2).
  UPDATE core.account
     SET phone_e164 = '+999' || lpad(
           ((('x' || substr(replace(id::text, '-', ''), 1, 12))::bit(48)::bigint)
            % 1000000000000)::text, 12, '0'),
         status = 'SCRUBBED',
         scrubbed_at = now(),
         age_declared_over_18 = NULL,
         age_declared_at = NULL
   WHERE id = p_account_id;

  -- Devices: unbound, so the purge in section 11 treats them as anonymous.
  UPDATE core.device SET account_id = NULL, push_token = NULL
   WHERE account_id = p_account_id;
END $function$;

ALTER FUNCTION core.fn_delete_account(uuid, uuid, bytea) OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_delete_account(uuid, uuid, bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_delete_account(uuid, uuid, bytea) TO adulis_app;
-- The definer's one new need: DELETE with a WHERE reads the row, so SELECT
-- too (adulis_migrate holds explicit grants; it does not own core tables).
GRANT SELECT, DELETE ON core.fyp_session TO adulis_migrate;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
ALTER FUNCTION core.fn_guard_fyp_algorithm_version() OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_guard_fyp_algorithm_version() FROM PUBLIC;

GRANT SELECT ON core.fyp_algorithm_version TO adulis_app;
-- A session's subject, Market, version, seed and secret are fixed at creation;
-- the API may advance only its continuation.
GRANT SELECT, INSERT ON core.fyp_session TO adulis_app;
GRANT UPDATE (served_count, last_served_at) ON core.fyp_session TO adulis_app;
GRANT SELECT, INSERT ON core.fyp_impression TO adulis_app;
GRANT SELECT ON core.fyp_algorithm_version, core.fyp_session, core.fyp_impression TO adulis_readonly;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
