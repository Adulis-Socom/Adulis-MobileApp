-- ============================================================================
-- 0063 -- Retire the legacy Reservation model and the financial flows built on
--         it (WORK ORDERS RES-RETIRE-01, RES-DB-01, BE-SAFE-01, BE-READY-01;
--         founder pre-launch architectural authorization of 2026-11-25)
--
-- Adulis has not launched. The founder retired the legacy Reservation model
-- from the active architecture outright (no quarantine, no compatibility
-- layer). The governing Order design (ADU-ORDER-01 v3.3) has no Reservation
-- entity, and live Order creation stays deferred while payment authority is
-- unresolved, so nothing replaces what is removed here.
--
-- REMOVED
--   * core.reservation, its state machine (core.reservation_state_transition_legal,
--     core.reservation_state) and its five triggers; core.refund (a refund was
--     a Reservation line's); the reservation_id columns on core.stock_event and
--     core.claim with their constraints; the Reservation counters on
--     core.seller_public_stats; core.timing_config.reservation_window.
--   * core.fn_create_order (created Reservations and stock holds) and every
--     function that existed only for the retired order, payment, refund,
--     handoff, payout-change and subscription-purchase flows.
--   * PAYOUT_DETAILS as a publication-readiness item (Payout Option A).
--   * The thirteen permissions that only those flows checked (orders, order
--     readiness, payment confirmation and evidence, reissue, refunds, claims,
--     handoff, payout), with their role grants -- docs/amendments/
--     ADU-AUTH-01_v2_4_permission_seed.sql and the ADU-AUTH-01 matrix move with it.
--   * The financial-boundary functions that collected or disclosed payment
--     evidence, payment instructions and payout credentials. The purges stay.
--   * Every app and worker write on the inert legacy order-family tables; the
--     order stock reasons, refused by CHECK.
--
-- REWRITTEN (from the live definitions; only the retired term is removed)
--   fn_delete_account (no Reservation release loop), fn_publication_readiness
--   (no PAYOUT_DETAILS), fn_guard_market_live (no Reservation state machine),
--   fn_ladder_cancellation_rate (NULL: not measured, never a fabricated zero),
--   fn_deletion_blockers (only the subscription blocker remains).
--
-- KEPT, deliberately
--   core.stock_event and every stock invariant (non-negative stock, the ledger,
--   its append-only rule); the legacy ORDER_CREATED / ORDER_EXPIRED /
--   LINE_CANCELLED enum labels (PostgreSQL cannot drop an enum label, and
--   nothing can write them any more); core."order" and the payment, handoff
--   and payout tables as inert structures with no writer and no API (their
--   physical removal is a separately scoped change); the payment-evidence
--   purge and the payout-credential purge (privacy protections).
--
-- DATA. This migration deletes no commerce, stock or audit row (only the thirteen
-- permission catalogue entries above, which are configuration). Section 1 refuses to run on a database
-- that holds any Reservation, Order, refund or open purchase intent, because
-- dropping those structures would destroy that history or strand held stock.
-- Such a database needs an explicit export-or-rebuild decision first
-- (ops/runbooks/legacy-reservation-retirement.md). A fresh or verified
-- disposable database passes.
-- ============================================================================

-- Up Migration

-- 1. Refuse rather than destroy. The lock first, so no writer can commit a row
-- between the count and the DROP below.
LOCK TABLE core.reservation, core."order", core.refund, billing.purchase_intent,
  billing.collection_record, core.payout_details IN ACCESS EXCLUSIVE MODE;
DO $guard$
DECLARE
  v_res int; v_ord int; v_ref int; v_int int; v_col int; v_pay int;
BEGIN
  SELECT count(*) INTO v_res FROM core.reservation;
  SELECT count(*) INTO v_ord FROM core."order";
  SELECT count(*) INTO v_ref FROM core.refund;
  SELECT count(*) INTO v_int FROM billing.purchase_intent
   WHERE reconciled_at IS NULL AND cancelled_at IS NULL;
  -- An open collection record (a seller may already have said they paid) and a pending
  -- payout change both lose the only functions that could resolve them, below.
  SELECT count(*) INTO v_col FROM billing.collection_record
   WHERE reconciled_at IS NULL AND voided_at IS NULL;
  SELECT count(*) INTO v_pay FROM core.payout_details WHERE state = 'PENDING';
  IF v_res + v_ord + v_ref + v_int + v_col + v_pay > 0 THEN
    RAISE EXCEPTION
      'legacy commerce rows present (reservations %, orders %, refunds %, open purchase intents %, '
      'open collection records %, pending payout changes %): '
      'export or rebuild first, see ops/runbooks/legacy-reservation-retirement.md',
      v_res, v_ord, v_ref, v_int, v_col, v_pay
      USING ERRCODE = 'restrict_violation';
  END IF;
END
$guard$;

-- Functions that existed only for the retired flows. No CASCADE anywhere: a
-- dependency this migration did not name fails it instead of vanishing.
DROP TRIGGER trg_handoff_scan_effects ON core.handoff_scan;
DROP FUNCTION core.fn_handoff_scan_effects();
DROP FUNCTION core.fn_create_order(uuid, uuid, uuid, jsonb);
DROP FUNCTION core.fn_cancel_line(uuid, uuid, uuid, boolean);
DROP FUNCTION core.fn_report_refund(uuid, uuid, uuid, bigint, text);
DROP FUNCTION core.fn_acknowledge_refund(uuid, uuid);
DROP FUNCTION core.fn_reject_payment(uuid, uuid, uuid, text);
DROP FUNCTION core.fn_confirm_payment(uuid, uuid, uuid);
DROP FUNCTION core.fn_confirmation_window_lapse(uuid);
DROP FUNCTION core.fn_confirm_receipt(uuid, uuid);
DROP FUNCTION core.fn_mark_order_ready(uuid, uuid, uuid);
DROP FUNCTION core.fn_reissue_instructions(uuid, uuid, uuid, uuid);
DROP FUNCTION core.fn_assert_no_cooldown(uuid, uuid);
DROP FUNCTION core.fn_release_reservation_stock(uuid, uuid, core.stock_event_reason);
DROP FUNCTION core.fn_request_payout_change(uuid, uuid, text, text, uuid, uuid, uuid);
DROP FUNCTION core.fn_cancel_payout_change(uuid, uuid);
DROP FUNCTION core.fn_activate_due_payout(uuid);
DROP FUNCTION billing.fn_open_purchase_intent(uuid, uuid, core.session_audience,
  billing.subscription_tier, billing.subscription_term, uuid);
DROP FUNCTION billing.fn_reconcile_purchase(uuid, uuid, text);
DROP FUNCTION billing.fn_close_stale_collections();
DROP FUNCTION billing.fn_close_intent(uuid, text);

-- The Reservation's relationships, then the entity itself.
ALTER TABLE core.stock_event
  DROP CONSTRAINT release_has_a_line,
  DROP CONSTRAINT stock_event_reservation,
  DROP COLUMN reservation_id;
-- The release rules died with the column (release_has_a_line, and the stock_release_once
-- index). Without an order there is no order stock reason, so the database refuses all
-- three rather than trusting that no code writes them: a positive ORDER_EXPIRED row would
-- otherwise invent inventory. Validates: section 1 proved no order exists.
ALTER TABLE core.stock_event ADD CONSTRAINT stock_event_no_order_reason
  CHECK (reason NOT IN ('ORDER_CREATED', 'ORDER_EXPIRED', 'LINE_CANCELLED'));
-- The column takes the claim_one_open_per_scope expression index with it; claims are
-- unwritable after the REVOKE at the end of this migration, so nothing is left to deduplicate.
ALTER TABLE core.claim
  DROP CONSTRAINT claim_line_belongs_to_order,
  DROP COLUMN reservation_id;
DROP TABLE core.refund;
DROP TABLE core.reservation;  -- its triggers, indexes and grants go with it
DROP FUNCTION core.fn_reservation_price_write_once();
DROP FUNCTION core.fn_guard_reservation_transition();
DROP FUNCTION core.fn_derive_order_state();
DROP FUNCTION core.fn_penalty_exempt();
DROP FUNCTION core.fn_stats_on_reservation();
DROP TABLE core.reservation_state_transition_legal;
DROP TYPE core.reservation_state;
ALTER TABLE core.seller_public_stats
  DROP COLUMN reservations_cancelled_count,
  DROP COLUMN reservations_terminal_count;
ALTER TABLE core.timing_config DROP COLUMN reservation_window;

-- Capabilities that only the retired flows checked. Grants first (FK).
DELETE FROM core.role_permission WHERE permission_code = ANY (ARRAY[
  'seller.orders:read', 'seller.orders:respond', 'seller.orders:reissue_instructions',
  'seller.order_ready:update', 'seller.payment:confirm', 'seller.payment_evidence:read',
  'seller.refunds:report', 'seller.claims:read', 'seller.claims:respond',
  'seller.handoff:read', 'seller.handoff:custody_transfer',
  'seller.payout:read', 'seller.payout:update']);
DELETE FROM core.permission WHERE code = ANY (ARRAY[
  'seller.orders:read', 'seller.orders:respond', 'seller.orders:reissue_instructions',
  'seller.order_ready:update', 'seller.payment:confirm', 'seller.payment_evidence:read',
  'seller.refunds:report', 'seller.claims:read', 'seller.claims:respond',
  'seller.handoff:read', 'seller.handoff:custody_transfer',
  'seller.payout:read', 'seller.payout:update']);

-- Financial-boundary collection and disclosure (payment evidence, payment instructions,
-- payout credentials). purge_payment_evidence, purge_payout_credential and
-- list_purgeable_evidence stay: deleting what may already be stored is a privacy duty.
DROP FUNCTION financial.read_payment_evidence(uuid, uuid, text);
DROP FUNCTION financial.write_payment_evidence(uuid, text, text, integer, integer);
DROP FUNCTION financial.render_payment_instructions(uuid, uuid);
DROP FUNCTION financial.write_payout_credential(uuid, bytea, bytea, text);

-- The legacy order family stays as inert structure, and inert means unwritable: the app and
-- worker roles lose every write on it, so no path can recreate an order, claim, handoff,
-- review, payout change or collection record outside a future approved design. SECURITY
-- DEFINER functions that still touch these tables (deletion, anonymisation) run as owner.
REVOKE INSERT, UPDATE, DELETE ON core."order", core.order_state_transition, core.order_qr_token,
  core.order_courier_assignment, core.order_confirmation, core.courier_custody_transfer,
  core.handoff_scan, core.payment_submission, core.payment_instruction_reissue,
  core.evidence_export, core.claim, core.claim_evidence_item, core.review,
  core.review_item_rating, core.payout_details, billing.collection_record
  FROM adulis_app, adulis_jobs;

-- 2. Rewritten, from the live definitions: each loses only its Reservation, refund or payout term.
CREATE OR REPLACE FUNCTION core.fn_delete_account(p_account_id uuid, p_otp_challenge_id uuid, p_phone_hash bytea)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core'
AS $function$
DECLARE
  v_account core.account;
  v_seller  record;
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
  -- Collections (0061): private preference data (ADU-PRV-01 v3.3 S36,
  -- PRV-INV-020): the Account's Collection rows and private names; their
  -- memberships go with them (ON DELETE CASCADE). Canonical Products and
  -- Scenes are untouched.
  DELETE FROM core.collection WHERE owner_account_id = p_account_id;

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

CREATE OR REPLACE FUNCTION core.fn_publication_readiness(p_seller_id uuid)
 RETURNS TABLE(item text, satisfied boolean, resolving_action text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core'
AS $function$
DECLARE
  v_seller   core.seller;
  v_eval     core.seller_eligibility_evaluation;
  v_idreq    boolean;
  v_person   uuid;
  v_items    jsonb := '[]';
  v_blocked  text[] := '{}';
  r          record;
BEGIN
  SELECT * INTO v_seller FROM core.seller WHERE id = p_seller_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  SELECT e.* INTO v_eval
    FROM core.seller_eligibility_evaluation e
   WHERE e.seller_id = p_seller_id
   ORDER BY e.evaluated_at DESC LIMIT 1;

  SELECT ic.identity_required INTO v_idreq
    FROM core.identity_config ic
   WHERE ic.market_id = v_seller.market_id AND ic.effective @> now();

  v_person := core.fn_seller_attestation_person(p_seller_id);

  -- The nine items, in the ratified order. IDENTITY_VERIFIED is satisfied
  -- when an attestation exists OR when the market does not require one AND
  -- the seller's path is not IDENTITY - the identity path holds a full
  -- attestation before the first listing goes live, no grace period, no
  -- bypass column (S4.2/S7.4). Absent identity_config fails closed to
  -- "required".
  FOR r IN
    SELECT * FROM (VALUES
      ('ACCOUNT_CREATED',
        true,
        'NONE'),
      ('SELLER_TYPE_DECLARED',
        v_seller.entity_type IS NOT NULL,
        'DECLARE_SELLER_TYPE'),
      ('ELIGIBILITY_SATISFIED',
        coalesce(v_eval.outcome = 'SATISFIED', false),
        'COMPLETE_ELIGIBILITY'),
      ('IDENTITY_VERIFIED',
        (v_person IS NOT NULL AND verification.has_attestation(v_person))
          OR (NOT coalesce(v_idreq, true)
              AND coalesce(v_eval.path <> 'IDENTITY', true)),
        'COMPLETE_IDENTITY_VERIFICATION'),
      ('COMPANY_DETAILS',
        v_seller.entity_type <> 'COMPANY'
          OR EXISTS (SELECT 1 FROM core.seller_company_detail d
                      WHERE d.seller_id = p_seller_id),
        'PROVIDE_COMPANY_DETAILS'),
      ('STORE_PROFILE',
        nullif(trim(v_seller.store_name), '') IS NOT NULL
          AND nullif(trim(coalesce(v_seller.description, '')), '') IS NOT NULL
          AND v_seller.category_id IS NOT NULL,
        'COMPLETE_STORE_PROFILE'),
      ('FULFILMENT_CONFIG',
        EXISTS (SELECT 1 FROM core.seller_fulfilment_method fm
                 WHERE fm.seller_id = p_seller_id AND fm.is_active),
        'ADD_FULFILMENT_METHOD'),
      ('AT_LEAST_ONE_PRODUCT',
        EXISTS (SELECT 1 FROM core.product p WHERE p.seller_id = p_seller_id),
        'ADD_A_PRODUCT')
    ) AS t(item, satisfied, resolving_action)
  LOOP
    IF NOT r.satisfied THEN
      v_blocked := array_append(v_blocked, r.item);
    END IF;
    item := r.item;
    satisfied := r.satisfied;
    resolving_action := CASE WHEN r.satisfied THEN NULL ELSE r.resolving_action END;
    RETURN NEXT;
  END LOOP;

  -- The funnel event (S4.6/S9.4). Register D-21a: eligibility_path is a
  -- NOT NULL cohort column on every seller-scoped event, and a seller with
  -- no evaluation yet HAS no path - that event travels without seller_id,
  -- carrying the seller in the payload, rather than inventing a cohort.
  IF cardinality(v_blocked) > 0 THEN
    INSERT INTO analytics.event
      (name, version, market_id, seller_id, eligibility_path, seller_level,
       seller_type, payload)
    VALUES
      ('seller_publication_blocked', 1, v_seller.market_id,
       CASE WHEN v_eval.path IS NOT NULL THEN p_seller_id END,
       v_eval.path,
       (SELECT level FROM core.seller_level_state WHERE seller_id = p_seller_id),
       v_seller.entity_type::text,
       jsonb_build_object('reasons', to_jsonb(v_blocked),
                          'seller', p_seller_id));
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION core.fn_guard_market_live()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 12.2.1, now keyed on activation_state: a market may not ENTER 'ACTIVE'
  -- while any transition row is unratified. A review that blocks a release is
  -- a gate; a review that is merely scheduled is a hope.
  IF NEW.activation_state = 'ACTIVE' AND OLD.activation_state IS DISTINCT FROM 'ACTIVE'
     AND EXISTS (SELECT 1 FROM core.order_state_transition_legal WHERE ratified_at IS NULL) THEN
    RAISE EXCEPTION 'State machine not ratified; market cannot go ACTIVE'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION core.fn_ladder_cancellation_rate(p_seller uuid, p_window interval)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'core'
AS $function$
  -- The rate counted Reservation rows (S12.5). With the Reservation model retired there is
  -- no evidence to count, and NULL is the ladder's existing "not measured" value -- never a
  -- fabricated zero, which would read as a perfect record.
  SELECT NULL::numeric
$function$;

CREATE OR REPLACE FUNCTION core.fn_deletion_blockers(p_seller_id uuid)
 RETURNS TABLE(blocker text, count integer, resolving_action text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'core'
AS $function$
  -- The Reservation, payment-confirmation, handoff, refund and claim blockers counted rows
  -- of the retired order flow, which section 1 proved empty and nothing can write again.
  SELECT * FROM (
    SELECT 'SUBSCRIPTION_PAST_DUE'::text, count(*)::int,
           'SETTLE_SUBSCRIPTION_BALANCE'::text
      FROM billing.subscription s
     WHERE s.seller_id = p_seller_id AND s.state = 'PAST_DUE'
  ) checks (b, c, r)
  WHERE checks.c > 0
$function$;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
