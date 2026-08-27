-- ===========================================================================
-- MIGRATION 12 - REVIEWS, CLAIMS, EVIDENCE
--
-- Source: ADU-DB-01 v1.10 section 28 item 12. Transcribed from sections 15
-- and 16, with W7 and section 12.4a. (File 0014; see 0010's header.)
--
-- WHAT IS ABSENT FROM review IS THE POINT: no hidden flag, no approved flag,
-- no visibility column, no seller-writable anything. A review, once
-- published, can be removed only by moderation action (migration 14's
-- moderation_event) - never by the seller it describes. The badge is
-- DERIVED by trigger from the order's confirmation tier and claim history;
-- the caller's input for it is overwritten unconditionally.
--
-- CLAIMS: one open claim per scope, enforced by a partial unique index that
-- must coalesce reservation_id - two open order-level claims (NULL,NULL)
-- would otherwise both survive, because NULLs never collide in a UNIQUE
-- index. The evidence bundle attaches BY TRIGGER AT OPEN, in the same
-- transaction - evidence gathered at decision time is evidence that had
-- time to change.
--
-- W7 settles what section 12.4a calls the lapse claim: the SLA_BREACH
-- trigger value means "payment SUBMITTED with no seller response within the
-- confirmation window" - the buyer acted, the seller went silent, the money
-- may be in flight. CONFIRMATION_WINDOW_LAPSED is that event's API code,
-- not an enum value; the catalogue is frozen (A1.1, check 16).
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.review (section 15)
-- ---------------------------------------------------------------------------
CREATE TABLE core.review (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL UNIQUE REFERENCES core."order"(id),
  buyer_account_id uuid NULL,
  seller_id        uuid NOT NULL REFERENCES core.seller(id),
  seller_rating    smallint NOT NULL CONSTRAINT review_rating_range CHECK (seller_rating BETWEEN 1 AND 5),
  body             text NULL,
  badge            core.review_badge NOT NULL,
  published_at     timestamptz NOT NULL DEFAULT now(),
  anonymised_at    timestamptz NULL,

  -- Only the buyer on the order reviews the order. Composite FK, MATCH
  -- SIMPLE: when anonymisation nulls buyer_account_id the FK stops binding,
  -- which is exactly the deletion semantics of section 22 - the review
  -- survives, attributed to no one.
  CONSTRAINT review_by_order_buyer
    FOREIGN KEY (order_id, buyer_account_id)
    REFERENCES core."order" (id, buyer_account_id),

  CONSTRAINT review_anonymised_shape CHECK (
    (anonymised_at IS NULL) = (buyer_account_id IS NOT NULL))
);

CREATE INDEX idx_review_by_seller ON core.review (seller_id, published_at DESC);

-- The badge is not the caller's to set (section 15's descending weights).
CREATE FUNCTION core.fn_review_derive_badge() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM core.claim c
              WHERE c.order_id = NEW.order_id AND c.outcome = 'UPHELD') THEN
    NEW.badge := 'CLAIM_UPHELD';
  ELSIF EXISTS (SELECT 1 FROM core.order_confirmation oc
                 WHERE oc.order_id = NEW.order_id AND oc.tier = 'VERIFIED_HANDOFF') THEN
    NEW.badge := 'VERIFIED_HANDOFF';
  ELSIF EXISTS (SELECT 1 FROM core.order_confirmation oc
                 WHERE oc.order_id = NEW.order_id AND oc.tier = 'CONFIRMED_BY_BUYER') THEN
    NEW.badge := 'CONFIRMED_BY_BUYER';
  ELSE
    NEW.badge := 'UNVERIFIED';
  END IF;
  NEW.published_at := now();
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_review_derive_badge
  BEFORE INSERT ON core.review
  FOR EACH ROW EXECUTE FUNCTION core.fn_review_derive_badge();

CREATE TABLE core.review_item_rating (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id  uuid NOT NULL REFERENCES core.review(id),
  product_id uuid NOT NULL REFERENCES core.product(id),
  rating     smallint NOT NULL CONSTRAINT item_rating_range CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT one_rating_per_product_per_review UNIQUE (review_id, product_id)
);

-- ---------------------------------------------------------------------------
-- 2. core.claim (section 16)
-- ---------------------------------------------------------------------------
CREATE TABLE core.claim (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES core."order"(id),
  reservation_id       uuid NULL,          -- NULL = the claim is order-scoped
  opened_by_kind       core.claim_opener_kind NOT NULL,
  opened_by_account_id uuid NULL REFERENCES core.account(id),
  trigger              core.claim_trigger NOT NULL,
  -- No default: the opener names the state. A buyer claim opens awaiting the
  -- seller's side; the catalogue (frozen, check 16) has no OPEN value.
  state                core.claim_state NOT NULL,
  severity             core.claim_severity NULL,
  remedy               core.claim_remedy NULL,
  opened_at            timestamptz NOT NULL DEFAULT now(),
  review_deadline      timestamptz NOT NULL DEFAULT now() + interval '2 days',
  outcome              core.claim_outcome NULL,
  outcome_reason       text NULL,
  -- An operator IS an account carrying an operator_grant (section 6.11);
  -- the grant check is the permission gate's, not a foreign key's.
  decided_by           uuid NULL REFERENCES core.account(id),
  decided_at           timestamptz NULL,

  -- A SYSTEM claim has no account; a BUYER claim always does.
  CONSTRAINT claim_opener_shape CHECK (
    (opened_by_kind = 'BUYER') = (opened_by_account_id IS NOT NULL)),

  CONSTRAINT claim_decided_shape CHECK (
    (outcome IS NULL) = (decided_at IS NULL)),

  -- RESOLVED is what having an outcome MEANS - the pair moves together.
  CONSTRAINT claim_resolved_shape CHECK (
    (outcome IS NOT NULL) = (state = 'RESOLVED')),

  -- A line-scoped claim must point at a line OF ITS OWN ORDER. Composite
  -- FK; MATCH SIMPLE lets the order-scoped (NULL) form pass unbound.
  CONSTRAINT claim_line_belongs_to_order
    FOREIGN KEY (order_id, reservation_id)
    REFERENCES core.reservation (order_id, id)
);

-- ONE OPEN CLAIM PER SCOPE. The coalesce is the load-bearing part: without
-- it, every order-level claim carries reservation_id NULL and the index
-- never fires, because NULL <> NULL in a unique index.
CREATE UNIQUE INDEX claim_one_open_per_scope
  ON core.claim (order_id, coalesce(reservation_id, '00000000-0000-0000-0000-000000000000'))
  WHERE outcome IS NULL;

CREATE INDEX idx_claim_by_order ON core.claim (order_id);
CREATE INDEX idx_claim_open_by_deadline ON core.claim (review_deadline)
  WHERE outcome IS NULL;

-- ---------------------------------------------------------------------------
-- 3. core.claim_evidence_item - APPEND-ONLY
-- ---------------------------------------------------------------------------
CREATE TABLE core.claim_evidence_item (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     uuid NOT NULL REFERENCES core.claim(id),
  kind         core.claim_evidence_kind NOT NULL,
  reference_id uuid NOT NULL,   -- what it points at depends on kind; bare by design
  attached_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_item_per_kind_per_reference UNIQUE (claim_id, kind, reference_id)
);

CREATE INDEX idx_evidence_by_claim ON core.claim_evidence_item (claim_id);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.claim_evidence_item
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

-- ---------------------------------------------------------------------------
-- 4. The bundle attaches at open (section 16) - AFTER INSERT ON claim
--
-- Register D-17: the document names the evidence kinds but not a
-- kind-per-trigger mapping. Transcription: attach every kind whose referent
-- EXISTS at open - a bundle can only over-include, never miss. Payment
-- evidence is simultaneously marked retained across the boundary, through
-- the financial-owned marker, in the same transaction (sections 13, 16).
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_claim_attach_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_seller uuid;
  v_ev     record;
BEGIN
  SELECT o.seller_id INTO v_seller FROM core."order" o WHERE o.id = NEW.order_id;

  -- ORDER_TRANSITIONS and STOCK_EVENTS and SELLER_LEVEL_AT_ORDER anchor on
  -- the order itself; the append-only logs are queried by order at review.
  INSERT INTO core.claim_evidence_item (claim_id, kind, reference_id)
  VALUES (NEW.id, 'ORDER_TRANSITIONS',      NEW.order_id),
         (NEW.id, 'STOCK_EVENTS',           NEW.order_id),
         (NEW.id, 'SELLER_LEVEL_AT_ORDER',  NEW.order_id);

  FOR v_ev IN SELECT pe.id FROM financial.payment_evidence pe
               WHERE pe.order_id = NEW.order_id LOOP
    INSERT INTO core.claim_evidence_item (claim_id, kind, reference_id)
    VALUES (NEW.id, 'PAYMENT_EVIDENCE', v_ev.id);
    PERFORM financial.fn_mark_evidence_retained(v_ev.id);
  END LOOP;

  FOR v_ev IN SELECT hs.id FROM core.handoff_scan hs
               WHERE hs.order_id = NEW.order_id LOOP
    INSERT INTO core.claim_evidence_item (claim_id, kind, reference_id)
    VALUES (NEW.id, 'SCAN_RECORD', v_ev.id);
  END LOOP;

  -- The acting team member: any transition on this order whose actor is a
  -- team member of the seller. The reference is the membership row - who
  -- was empowered, by whom, revocable when.
  FOR v_ev IN SELECT DISTINCT tm.id
                FROM core.order_state_transition ost
                JOIN core.seller_team_member tm
                  ON tm.seller_id = v_seller
                 AND tm.account_id = ost.actor_account_id
               WHERE ost.order_id = NEW.order_id LOOP
    INSERT INTO core.claim_evidence_item (claim_id, kind, reference_id)
    VALUES (NEW.id, 'ACTING_TEAM_MEMBER', v_ev.id);
  END LOOP;

  -- R16: the public unresolved count moves at open.
  UPDATE core.seller_public_stats
     SET unresolved_claim_count = unresolved_claim_count + 1, updated_at = now()
   WHERE seller_id = v_seller;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_claim_attach_evidence
  AFTER INSERT ON core.claim
  FOR EACH ROW EXECUTE FUNCTION core.fn_claim_attach_evidence();

-- ---------------------------------------------------------------------------
-- 5. Decision effects - AFTER UPDATE OF outcome
--
-- An UPHELD claim is the ladder's forced-demotion input (section 8.3): the
-- recompute runs with p_forced true, floor NEW, unconditionally. It also
-- rewrites the order's review badge to CLAIM_UPHELD - the one badge that
-- can change after publication, and only in this direction.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_claim_decision_effects() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_seller uuid;
  v_mod    uuid;
BEGIN
  IF NEW.outcome IS NOT NULL AND OLD.outcome IS NULL THEN
    SELECT o.seller_id INTO v_seller FROM core."order" o WHERE o.id = NEW.order_id;

    UPDATE core.seller_public_stats
       SET unresolved_claim_count = greatest(unresolved_claim_count - 1, 0),
           updated_at = now()
     WHERE seller_id = v_seller;

    IF NEW.outcome = 'UPHELD' THEN
      UPDATE core.review SET badge = 'CLAIM_UPHELD' WHERE order_id = NEW.order_id;
      -- moderation_change_is_logged (migration 8) refuses a MODERATION-
      -- sourced level change with no moderation_event behind it - found by
      -- the CP-7 test, loudly. The upheld decision IS the moderation act,
      -- so it is recorded as one, and the level event points at it:
      -- claim -> moderation_event -> seller_level_event, one audit chain.
      -- decided_by is NOT NULL by way of moderation_event.actor_account_id:
      -- an upheld claim with no decider fails here rather than demoting
      -- anonymously.
      INSERT INTO core.moderation_event
        (actor_account_id, target_kind, target_id, decision, reason)
      VALUES (NEW.decided_by, 'SELLER', v_seller, 'CLAIM_UPHELD',
              coalesce(NEW.outcome_reason, 'claim ' || NEW.id || ' upheld'))
      RETURNING id INTO v_mod;
      PERFORM core.fn_recompute_seller_level(v_seller, true, v_mod);
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_claim_decision_effects
  AFTER UPDATE OF outcome ON core.claim
  FOR EACH ROW EXECUTE FUNCTION core.fn_claim_decision_effects();

-- ---------------------------------------------------------------------------
-- 6. The confirmation-window lapse (section 12.4a) - the jobs runner's body
--
-- PAYMENT_SUBMITTED has NO timeout edge (the deliberately absent transition,
-- T2's trap; see 0011). When the window passes unanswered the ORDER DOES NOT
-- MOVE: a SYSTEM claim opens (W7: trigger SLA_BREACH), evidence retention
-- follows from the attach trigger, the miss is counted, and stock stays
-- held - the buyer may genuinely have paid.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_confirmation_window_lapse(p_order uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_order  core."order";
  v_window interval;
BEGIN
  SELECT * INTO v_order FROM core."order" WHERE id = p_order FOR UPDATE;
  IF NOT FOUND OR v_order.state <> 'PAYMENT_SUBMITTED' THEN
    RETURN;   -- idempotent: the sweep may see an order twice
  END IF;

  SELECT tc.payment_confirmation_window INTO v_window
    FROM core.timing_config tc
   WHERE tc.market_id = v_order.market_id AND tc.effective @> now();
  -- Fail closed: no config in force, no lapse is declared.
  IF NOT FOUND OR v_window IS NULL THEN RETURN; END IF;

  IF now() < (SELECT max(t.occurred_at) FROM core.order_state_transition t
               WHERE t.order_id = p_order AND t.to_state = 'PAYMENT_SUBMITTED')
             + v_window THEN
    RETURN;   -- the window has not lapsed yet
  END IF;

  -- One open claim per scope makes THIS idempotent too.
  IF EXISTS (SELECT 1 FROM core.claim c
              WHERE c.order_id = p_order AND c.outcome IS NULL) THEN
    RETURN;
  END IF;

  INSERT INTO core.claim (order_id, opened_by_kind, trigger, state, severity)
  VALUES (p_order, 'SYSTEM', 'SLA_BREACH', 'AWAITING_SELLER_EVIDENCE', 'ORDINARY');

  UPDATE core.seller_public_stats
     SET missed_confirmation_windows = missed_confirmation_windows + 1,
         updated_at = now()
   WHERE seller_id = v_order.seller_id;
END $fn$;

-- ---------------------------------------------------------------------------
-- 7. core.evidence_export (section 16)
-- ---------------------------------------------------------------------------
CREATE TABLE core.evidence_export (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     uuid NULL REFERENCES core.claim(id),
  order_id     uuid NOT NULL REFERENCES core."order"(id),
  requested_by uuid NOT NULL REFERENCES core.account(id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  object_key   text NOT NULL,
  expires_at   timestamptz NOT NULL
);

-- ---------------------------------------------------------------------------
-- 8. Ownership and grants. 0010's promised SELECTs (review, claim) land.
-- ---------------------------------------------------------------------------
ALTER FUNCTION core.fn_review_derive_badge()             OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_claim_attach_evidence()           OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_claim_decision_effects()          OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_confirmation_window_lapse(uuid)   OWNER TO adulis_migrate;

GRANT SELECT ON core.review, core.claim TO adulis_migrate;
GRANT INSERT ON core.claim TO adulis_migrate;  -- the lapse function opens the SYSTEM claim
-- the decision trigger records the moderation act it demotes under
-- (moderation_event is migration 14's table; the grant is dormant DDL only
-- in the sense a GRANT cannot be - so it lives there, not here)
-- The attach trigger crosses the boundary with IDS ONLY: column-level SELECT,
-- no object key, no byte counts, and the retention marker stays
-- financial-owned - migrate may call it, not reimplement it.
GRANT USAGE ON SCHEMA financial TO adulis_migrate;
GRANT SELECT (id, order_id) ON financial.payment_evidence TO adulis_migrate;
GRANT EXECUTE ON FUNCTION financial.fn_mark_evidence_retained(uuid) TO adulis_migrate;
GRANT SELECT, INSERT ON core.claim_evidence_item TO adulis_migrate;
GRANT UPDATE (badge) ON core.review TO adulis_migrate;

GRANT SELECT, INSERT ON core.review, core.review_item_rating TO adulis_app;
GRANT UPDATE (buyer_account_id, anonymised_at) ON core.review TO adulis_app;
GRANT SELECT, INSERT, UPDATE ON core.claim TO adulis_app;
GRANT SELECT, INSERT ON core.claim_evidence_item TO adulis_app;
REVOKE UPDATE, DELETE ON core.claim_evidence_item FROM adulis_app;
GRANT SELECT, INSERT ON core.evidence_export TO adulis_app;

GRANT EXECUTE ON FUNCTION core.fn_confirmation_window_lapse(uuid) TO adulis_jobs;
GRANT SELECT ON core.claim TO adulis_jobs;

GRANT SELECT ON core.review, core.review_item_rating, core.claim,
                core.claim_evidence_item, core.evidence_export
  TO adulis_readonly;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 12 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
