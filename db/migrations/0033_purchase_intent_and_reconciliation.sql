-- 0033 -- G1.7: the subscription lifecycle gets an intent, and the
--         collection record that no path closed gets three paths that close it.
--
-- ADU-API-01 v1.7 S12.12 (G1.7)  -  ADU-DB-01 v1.12 S18.5
-- WORK ORDER T6 S3.
--
-- THE RULING, VERBATIM: "Three rules: an intent expires after 24 hours; a
-- subscription becomes ACTIVE only on a payment reconciled against a live
-- intent, never on the intent alone; and the rate is locked at intent
-- creation, so the price shown is the price charged. Nothing depends on this
-- today -- beta sellers pay nothing -- but v1.6's endpoints opened a
-- collection record that no path closed."
--
-- ------------------------------------------------------------------------
-- WHY A NEW TABLE RATHER THAN COLUMNS ON collection_record.
--
-- The obvious move is to treat the collection record AS the intent: it is
-- what /v1/billing/purchase-intent creates, and the URL says "intent". It is
-- not one. billing.collection_record (S18.5) is the RECONCILIATION artifact
-- -- the row an operator matches a real bank transfer against. Expiring it
-- would void, under an operator's hands, the record they are mid-way through
-- matching. The two objects have opposite lifetimes: an intent is a quote
-- that goes stale in a day; a collection record is an obligation that stands
-- until money arrives or somebody says it will not.
--
-- So: one intent, one record, `collection_record_id UNIQUE`, and expiry acts
-- on the intent. Voiding the record is a SEPARATE decision the expiry path
-- takes only when the seller has NOT asserted a transfer against it.
--
-- NO NEW ENUM, DELIBERATELY. Appendix C check 16 compares enum names AND
-- values against db/checks/fixtures/appendix-a.json, which is a transcription
-- of ADU-DB-01 Appendix A -- "the specification, not the schema". An
-- intent-state enum would fail that check until the document is amended, and
-- the state here is fully expressed by three timestamps and a clock. A row
-- is LIVE when reconciled_at IS NULL AND cancelled_at IS NULL AND
-- expires_at > now(). Expiry is a FACT ABOUT THE ROW, not an event somebody
-- has to remember to fire.
--
-- THE TABLE COUNT. Appendix B does not list billing.purchase_intent, because
-- no document gives the intent a table at all -- ADU-API-01 v1.7 states the
-- three rules and ADU-DB-01 v1.12 S18.5 stops at the collection record. This
-- is exactly register D-40's mechanism (ADU-API-01 gave notification
-- preferences two endpoints and no document gave them a table), so it is
-- handled the same way: pinned BY NAME in check 14's BODY_OVER_MANIFEST and
-- registered as a row Appendix B owes. Register D-68.
-- ------------------------------------------------------------------------

-- ===========================================================================
-- PART 1 - the collection record learns how to close unpaid.
-- ===========================================================================
--
-- reconciled_at means MONEY ARRIVED. There was no way to say "this will not
-- be paid" without lying in that column, so nothing ever said it, so
-- subscription.collect_reminder's exit condition was a column no code wrote
-- and the reminder ran every seven days forever. voided_at is the missing
-- half of the pair, and the CHECK makes the two mutually exclusive so no row
-- can ever claim both.
ALTER TABLE billing.collection_record
  ADD COLUMN voided_at   timestamptz NULL,
  ADD COLUMN void_reason text        NULL;

ALTER TABLE billing.collection_record
  ADD CONSTRAINT collection_record_one_terminal
    CHECK (voided_at IS NULL OR reconciled_at IS NULL),
  ADD CONSTRAINT collection_record_void_names_reason
    CHECK ((voided_at IS NULL) = (void_reason IS NULL));

COMMENT ON COLUMN billing.collection_record.voided_at IS
  'G1.7. The record is closed and no money is owed against it. Distinct from '
  'reconciled_at, which asserts money ARRIVED - a closed-unpaid record '
  'written as reconciled is a false financial statement, and a record left '
  'open forever is an SMS every seven days forever.';

-- ===========================================================================
-- PART 2 - billing.purchase_intent
-- ===========================================================================
CREATE TABLE billing.purchase_intent (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id           uuid NOT NULL REFERENCES billing.subscription(id),
  -- One record per intent, and the record cannot be shared: reconciling one
  -- payment must never activate two subscriptions.
  collection_record_id      uuid NOT NULL UNIQUE
                              REFERENCES billing.collection_record(id),
  -- WHAT WAS BOUGHT. collection_record carries neither, so between intent
  -- and reconciliation there was nowhere for the purchased tier and term to
  -- live, and reconciliation would have had to guess.
  tier                      billing.subscription_tier NOT NULL,
  term                      billing.subscription_term NOT NULL,
  -- THE RATE, LOCKED. Not a pointer to "the schedule effective now" - the
  -- schedule row that was effective AT CREATION, plus the arithmetic it
  -- produced. A price_schedule row's `effective` range closes and the next
  -- one opens; without this the seller is shown one price and charged the
  -- next one, which is precisely what "the price shown is the price charged"
  -- forbids.
  price_schedule_version_id uuid NOT NULL REFERENCES billing.price_schedule(id),
  amount_minor              bigint NOT NULL CHECK (amount_minor >= 0),
  currency                  char(3) NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  expires_at                timestamptz NOT NULL,
  reconciled_at             timestamptz NULL,
  cancelled_at              timestamptz NULL,
  cancel_reason             text NULL,

  CONSTRAINT purchase_intent_window CHECK (expires_at > created_at),
  CONSTRAINT purchase_intent_one_terminal
    CHECK (num_nonnulls(reconciled_at, cancelled_at) <= 1),
  CONSTRAINT purchase_intent_cancel_names_reason
    CHECK ((cancelled_at IS NULL) = (cancel_reason IS NULL))
);

-- AT MOST ONE OPEN INTENT PER SUBSCRIPTION, and this is the constraint that
-- kills the duplicate-record trap: v1.6's endpoint inserted a fresh
-- collection_record on every call with a fresh Idempotency-Key, so a seller
-- who tapped the button four times owed four indistinguishable amounts and
-- received four SMS every seven days. Note what is NOT in the predicate:
-- expires_at, because now() is not immutable and a partial index may not
-- call it. An EXPIRED-but-open intent therefore still occupies the slot, and
-- fn_open_purchase_intent closes it explicitly before inserting - which is
-- the right shape anyway, since closing it is a decision (does its record
-- get voided?) and not a side effect.
CREATE UNIQUE INDEX purchase_intent_one_open
  ON billing.purchase_intent (subscription_id)
  WHERE reconciled_at IS NULL AND cancelled_at IS NULL;

CREATE INDEX idx_purchase_intent_due
  ON billing.purchase_intent (expires_at)
  WHERE reconciled_at IS NULL AND cancelled_at IS NULL;

COMMENT ON TABLE billing.purchase_intent IS
  'ADU-API-01 v1.7 S12.12 (G1.7). A QUOTE WITH A CLOCK, not a payment. It '
  'expires after 24 hours, it carries the rate that was quoted, and a '
  'subscription becomes ACTIVE only when a payment is reconciled against one '
  'that is still live. No document gives this a table; Appendix B owes the '
  'row (register D-68).';

-- ===========================================================================
-- PART 3 - fn_open_purchase_intent
-- ===========================================================================
--
-- THE PRICE ARITHMETIC MOVES INTO THE DATABASE. It was JS `Number(...)` on a
-- numeric(5,4) discount followed by Math.round - double-precision arithmetic
-- on money, guarded by exactly one test whose numbers happen to agree in
-- both. numeric all the way through, rounded once, at the end.
CREATE FUNCTION billing.fn_open_purchase_intent(
  p_seller   uuid,
  p_actor    uuid,
  p_audience core.session_audience,
  p_tier     billing.subscription_tier,
  p_term     billing.subscription_term,
  p_step_up  uuid
) RETURNS TABLE (
  intent_id            uuid,
  collection_record_id uuid,
  amount_minor         bigint,
  currency             char(3),
  expires_at           timestamptz,
  tier                 billing.subscription_tier,
  term                 billing.subscription_term
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = billing, core AS $fn$
DECLARE
  v_status   core.seller_status;
  v_sub      billing.subscription;
  v_sched    billing.price_schedule;
  v_months   int;
  v_discount numeric(5,4);
  v_amount   bigint;
  v_open     billing.purchase_intent;
  v_cr       uuid;
  v_intent   uuid;
  v_expires  timestamptz;
BEGIN
  PERFORM core.fn_has_permission(p_actor, p_seller,
                                 'seller.subscription:update', p_audience);
  PERFORM core.fn_assert_step_up(p_step_up, p_actor, 'SUBSCRIPTION_CHANGE');

  -- GATE 0, the state check that sits above authorization and is not
  -- authorization (ADU-AUTH-01 v2.5 S14: "a SAFETY_SUSPENDED or CLOSING
  -- seller is blocked from forward-looking actions regardless of who is
  -- asking"). Buying a subscription is as forward-looking as an action gets,
  -- and until now the whole billing group read core.seller.status never.
  --
  -- BILLING_SUSPENDED IS DELIBERATELY NOT IN THIS LIST. It is the state a
  -- PAST_DUE subscription drives toward, and paying is how a seller leaves
  -- it; blocking the payment would be a trap with no exit. CLOSING is in the
  -- list, and a closing seller who needs to settle re-opens first
  -- (DELETE /v1/seller/closure) - closure is reversible by design, so the
  -- route out exists and stays one call long.
  SELECT s.status INTO v_status FROM core.seller s WHERE s.id = p_seller;
  IF v_status IN ('CLOSING', 'SAFETY_SUSPENDED', 'DELETED') THEN
    RAISE EXCEPTION 'seller is not purchasable'
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT * INTO v_sub FROM billing.subscription WHERE seller_id = p_seller
   FOR UPDATE;
  -- No subscription row is no purchase anchor: the beta cohort is
  -- provisioned with one and the self-serve path from nothing is written in
  -- no document (register D-36).
  IF NOT FOUND THEN RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002'; END IF;

  SELECT ps.* INTO v_sched
    FROM billing.price_schedule ps
    JOIN core.seller s ON s.market_id = ps.market_id
   WHERE s.id = p_seller AND ps.tier = p_tier AND ps.effective @> now();
  -- A tier with no scheduled price in this market cannot be bought - fail
  -- closed, the ladder precedent.
  IF NOT FOUND THEN RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002'; END IF;

  v_months   := CASE p_term WHEN 'ANNUAL' THEN 12 WHEN 'QUARTERLY' THEN 3 ELSE 1 END;
  v_discount := CASE p_term
                  WHEN 'ANNUAL'    THEN v_sched.prepay_annual_discount
                  WHEN 'QUARTERLY' THEN v_sched.prepay_quarterly_discount
                  ELSE 0 END;
  v_amount   := round(v_sched.price_minor::numeric * v_months * (1 - v_discount));

  -- --------------------------------------------------------------------
  -- The open slot. At most one row can be here (purchase_intent_one_open).
  -- --------------------------------------------------------------------
  SELECT * INTO v_open FROM billing.purchase_intent
   WHERE subscription_id = v_sub.id
     AND reconciled_at IS NULL AND cancelled_at IS NULL
   FOR UPDATE;

  IF FOUND THEN
    IF v_open.expires_at > now()
       AND v_open.tier = p_tier AND v_open.term = p_term THEN
      -- THE SAME PURCHASE, ASKED AGAIN. Return the standing quote rather
      -- than opening a second obligation. This IS the rate lock: two taps
      -- inside the window are one price, whatever the schedule did between
      -- them.
      RETURN QUERY SELECT v_open.id, v_open.collection_record_id,
                          v_open.amount_minor, v_open.currency,
                          v_open.expires_at, v_open.tier, v_open.term;
      RETURN;
    END IF;

    -- Superseded or stale. If the seller has already ASSERTED a transfer
    -- against its record, an operator may be matching a real bank line to
    -- it right now and it is not ours to void; refuse and let
    -- reconciliation finish.
    IF EXISTS (SELECT 1 FROM billing.collection_record cr
                WHERE cr.id = v_open.collection_record_id
                  AND cr.marked_transferred_at IS NOT NULL
                  AND cr.reconciled_at IS NULL AND cr.voided_at IS NULL) THEN
      RAISE EXCEPTION 'purchase intent pending reconciliation'
        USING ERRCODE = 'restrict_violation';
    END IF;

    PERFORM billing.fn_close_intent(
      v_open.id,
      CASE WHEN v_open.expires_at <= now() THEN 'EXPIRED' ELSE 'SUPERSEDED' END);
  END IF;

  v_expires := now() + interval '24 hours';
  INSERT INTO billing.collection_record
    (id, subscription_id, amount_minor, currency, provider_kind)
  VALUES (gen_random_uuid(), v_sub.id, v_amount, v_sched.currency, 'BANK_TRANSFER')
  RETURNING id INTO v_cr;

  INSERT INTO billing.purchase_intent
    (id, subscription_id, collection_record_id, tier, term,
     price_schedule_version_id, amount_minor, currency, expires_at)
  VALUES (gen_random_uuid(), v_sub.id, v_cr, p_tier, p_term,
          v_sched.id, v_amount, v_sched.currency, v_expires)
  RETURNING id INTO v_intent;

  RETURN QUERY SELECT v_intent, v_cr, v_amount, v_sched.currency,
                      v_expires, p_tier, p_term;
END $fn$;

-- ===========================================================================
-- PART 4 - fn_close_intent, the one place an intent stops being open
-- ===========================================================================
--
-- Cancelling an intent and voiding its record are ONE decision with one
-- exception, and putting them in one function is what stops the exception
-- being forgotten at the third call site: a record the seller has said they
-- paid stays OPEN, because an operator may be matching it. Everything else
-- closes.
CREATE FUNCTION billing.fn_close_intent(p_intent uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = billing AS $fn$
DECLARE v_cr uuid;
BEGIN
  UPDATE billing.purchase_intent
     SET cancelled_at = now(), cancel_reason = p_reason
   WHERE id = p_intent AND reconciled_at IS NULL AND cancelled_at IS NULL
   RETURNING collection_record_id INTO v_cr;
  IF v_cr IS NULL THEN RETURN; END IF;

  UPDATE billing.collection_record
     SET voided_at = now(), void_reason = p_reason
   WHERE id = v_cr
     AND reconciled_at IS NULL
     AND voided_at IS NULL
     AND marked_transferred_at IS NULL;
END $fn$;

-- ===========================================================================
-- PART 5 - fn_reconcile_purchase: the ONLY path to ACTIVE
-- ===========================================================================
--
-- WHO MAY CALL THIS. Reconciliation is operator work outside the API
-- contract (ADU-DB-01 S18.5, and register D-36) - there is no endpoint, and
-- this migration does not invent one. What it does invent is nothing: the
-- authority is derived exactly as T5's verification.write_attestation
-- derives it, from a live core.operator_grant, so the function refuses an
-- actor who is not an operator whatever session or role reached it. EXECUTE
-- is granted to NO runtime role, so today the only caller is the owner
-- itself - which is what "outside this contract" means, made literal.
-- ops/runbooks/billing-reconciliation.md is the surface.
CREATE FUNCTION billing.fn_reconcile_purchase(
  p_actor        uuid,
  p_record       uuid,
  p_provider_ref text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = billing, core AS $fn$
DECLARE
  v_cr     billing.collection_record;
  v_intent billing.purchase_intent;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.operator_grant og
                  WHERE og.account_id = p_actor
                    AND og.role = 'ADMIN'
                    AND og.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'U0001';
  END IF;

  SELECT * INTO v_cr FROM billing.collection_record
   WHERE id = p_record FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002'; END IF;
  IF v_cr.reconciled_at IS NOT NULL OR v_cr.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'collection record already closed'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- "ONLY on a payment reconciled against a LIVE intent, never on the intent
  -- alone" - and equally never on the payment alone. A record with no intent
  -- is money against an unknown purchase: it can be recorded, but it cannot
  -- decide a tier, a term or a rate, so it must not activate anything.
  SELECT * INTO v_intent FROM billing.purchase_intent
   WHERE collection_record_id = p_record FOR UPDATE;
  IF NOT FOUND
     OR v_intent.cancelled_at IS NOT NULL
     OR v_intent.reconciled_at IS NOT NULL
     OR v_intent.expires_at <= now() THEN
    RAISE EXCEPTION 'purchase intent is not live'
      USING ERRCODE = 'restrict_violation';
  END IF;

  UPDATE billing.collection_record
     SET reconciled_at = now(), reconciled_by = p_actor,
         provider_ref  = coalesce(p_provider_ref, provider_ref)
   WHERE id = p_record;

  UPDATE billing.purchase_intent SET reconciled_at = now() WHERE id = v_intent.id;

  -- THE LOCKED RATE IS COPIED, NOT RE-DERIVED. priced_state_names_its_schedule
  -- has never been exercised by production code because nothing ever set
  -- ACTIVE or PAST_DUE; the first path that does has to carry
  -- price_schedule_version_id or it raises at the worst possible moment -
  -- the point where a seller has paid real money. It is carried, from the
  -- intent, which is where it was locked.
  UPDATE billing.subscription
     SET state                     = 'ACTIVE',
         tier                      = v_intent.tier,
         term                      = v_intent.term,
         locked_rate_minor         = v_intent.amount_minor,
         locked_rate_currency      = v_intent.currency,
         price_schedule_version_id = v_intent.price_schedule_version_id,
         current_period_start      = now(),
         current_period_end        = now() + CASE v_intent.term
                                               WHEN 'ANNUAL'    THEN interval '12 months'
                                               WHEN 'QUARTERLY' THEN interval '3 months'
                                               ELSE interval '1 month' END
   WHERE id = v_intent.subscription_id;

  RETURN v_intent.subscription_id;
END $fn$;

-- ===========================================================================
-- PART 6 - fn_close_stale_collections: the sweep that gives the reminder an
--          exit condition
-- ===========================================================================
--
-- NOT A NEW JOB. ADU-DB-01 S24's table IS the job specification and the
-- registry asserts exactly its twenty names, so a 21st job would be a job
-- nobody can point at in a document. This is called by
-- subscription.collect_reminder, which is the right owner anyway: the job
-- whose termination condition was missing is the job that now enforces it.
CREATE FUNCTION billing.fn_close_stale_collections() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = billing, core AS $fn$
DECLARE v_n int := 0; v_id uuid;
BEGIN
  -- 1. Intents past their 24 hours.
  FOR v_id IN
    SELECT pi.id FROM billing.purchase_intent pi
     WHERE pi.reconciled_at IS NULL AND pi.cancelled_at IS NULL
       AND pi.expires_at <= now()
  LOOP
    PERFORM billing.fn_close_intent(v_id, 'EXPIRED');
    v_n := v_n + 1;
  END LOOP;

  -- 2. Records belonging to a subscription that has ended, or to a seller
  --    that has gone. core.fn_delete_seller_effects cancels the
  --    subscription and CANNOT touch collection_record (it holds no grant on
  --    it), so before this the reminder job kept matching a deleted seller's
  --    records forever - and core.fn_delete_account had by then rewritten
  --    that account's phone to a synthetic '+999...' number. The terminal
  --    state was an SMS provider called every seven days, in perpetuity,
  --    with a fabricated number, for an account that no longer exists.
  WITH closed AS (
    UPDATE billing.collection_record cr
       SET voided_at = now(), void_reason = 'SUBSCRIPTION_CLOSED'
      FROM billing.subscription sub
      JOIN core.seller s ON s.id = sub.seller_id
     WHERE cr.subscription_id = sub.id
       AND cr.reconciled_at IS NULL AND cr.voided_at IS NULL
       AND (sub.state = 'CANCELLED' OR s.status = 'DELETED')
     RETURNING cr.id)
  SELECT v_n + count(*)::int INTO v_n FROM closed;

  RETURN v_n;
END $fn$;

-- ===========================================================================
-- PART 7 - THE DEFINER DISCIPLINE (S4.4a): own it, revoke PUBLIC, grant by
--          name. All four steps, for each of the four functions.
-- ===========================================================================
--
-- THE GRANT THAT WOULD HAVE FAILED ON THE FIRST REAL CALL. adulis_migrate
-- owns every SECURITY DEFINER function in billing and held, before this
-- migration, NOTHING on billing.collection_record: SELECT on subscription,
-- UPDATE (state) on subscription, and SELECT/INSERT on
-- subscription_state_transition, and that is the complete list. A definer
-- function written the doctrine-correct way would have CREATEd cleanly,
-- migrated cleanly, passed every static check, and raised
-- 42501 "permission denied for table collection_record" the first time an
-- operator reconciled a real bank transfer. The grants below are that trap
-- closed, and the tests call every function so the closure is demonstrated
-- rather than asserted.
ALTER FUNCTION billing.fn_open_purchase_intent(
  uuid, uuid, core.session_audience, billing.subscription_tier,
  billing.subscription_term, uuid)                     OWNER TO adulis_migrate;
ALTER FUNCTION billing.fn_close_intent(uuid, text)     OWNER TO adulis_migrate;
ALTER FUNCTION billing.fn_reconcile_purchase(uuid, uuid, text)
                                                       OWNER TO adulis_migrate;
ALTER FUNCTION billing.fn_close_stale_collections()    OWNER TO adulis_migrate;

REVOKE ALL ON FUNCTION billing.fn_open_purchase_intent(
  uuid, uuid, core.session_audience, billing.subscription_tier,
  billing.subscription_term, uuid)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION billing.fn_close_intent(uuid, text)     FROM PUBLIC;
REVOKE ALL ON FUNCTION billing.fn_reconcile_purchase(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION billing.fn_close_stale_collections()    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION billing.fn_open_purchase_intent(
  uuid, uuid, core.session_audience, billing.subscription_tier,
  billing.subscription_term, uuid)                     TO adulis_app;
GRANT EXECUTE ON FUNCTION billing.fn_close_stale_collections() TO adulis_jobs;
-- fn_close_intent is an INTERNAL step of the other three and is granted to
-- no runtime role: a caller who can cancel an arbitrary intent by id can
-- void a seller's obligation without touching the seller.
--
-- fn_reconcile_purchase is granted to NO runtime role either, and that is
-- the whole of "operator work outside this contract". Granting it to
-- adulis_app would create the operator endpoint by accident.

-- What the definer needs, now that it does something.
GRANT SELECT, UPDATE ON billing.collection_record TO adulis_migrate;
GRANT INSERT         ON billing.collection_record TO adulis_migrate;
GRANT SELECT, INSERT, UPDATE ON billing.purchase_intent TO adulis_migrate;
GRANT SELECT ON billing.price_schedule TO adulis_migrate;
-- The operator derivation, T5's shape: the function reads the grant table
-- itself rather than trusting a role the caller declared.
GRANT SELECT ON core.operator_grant TO adulis_migrate;
GRANT UPDATE (state, tier, term, locked_rate_minor, locked_rate_currency,
              price_schedule_version_id, current_period_start,
              current_period_end)
  ON billing.subscription TO adulis_migrate;

-- THE API READS ITS OWN QUOTE AND WRITES NOTHING. SELECT only: every path
-- that creates, closes or reconciles an intent is a named function, so the
-- one-open index, the 24-hour clock and the locked rate cannot be worked
-- around by a second endpoint. GET /v1/billing/subscription needs the read
-- because a seller who closed the tab has no other way to find the amount
-- they were asked to transfer.
GRANT SELECT ON billing.purchase_intent TO adulis_app;
-- adulis_jobs gains NO new privilege on collection_record: the sweep runs as
-- the definer. Its existing UPDATE (reminder_sent_at) stays the whole of
-- what the worker may write there, which is what makes "the reminder cannot
-- close a record, only a named function can" true rather than intended.
