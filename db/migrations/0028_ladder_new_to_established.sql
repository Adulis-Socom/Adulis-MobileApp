-- 0028 -- G1.2: the NEW level gets an exit, and the ladder stops being inert.
--
-- ADU-DB-01 v1.12 S5.5 (RULING G1.2)  -  S12.3 (the transaction cap)
-- AMENDMENT A1 to ADU-RUL-01, A1.3 -- which is what makes this migration
-- correct rather than decorative.
--
-- WHY A REWIRE AND NOT A SEED. v1.12 says the ruling means "a seller can now
-- reach ESTABLISHED and no further". The built gate cannot deliver that:
--
--   ELSIF coalesce(v_handoffs_est >= v_cfg.established_min_handoffs
--                  AND v_avg_rating >= v_cfg.established_min_avg_rating
--                  AND v_claim_rate_est <= v_cfg.established_max_claim_rate, false)
--
-- established_min_avg_rating and established_max_claim_rate are ADU-VAL-01
-- Group A and stay NULL, and every arm is wrapped in coalesce(..., false) so
-- that NULL never promotes. Seeding tenure and orders BESIDE those arms
-- promotes nobody: the ladder would stay inert while looking configured.
-- A1.3 rules the two new arms REPLACE them:
--
--   NEW -> ESTABLISHED      new_to_established_min_tenure AND ..._min_orders
--   ESTABLISHED -> TRUSTED  trusted_* ONLY
--
-- A1.3 also removes the TRUSTED branch's coupling to established_min_handoffs
-- and established_min_avg_rating -- a cumulative "Trusted presumes
-- Established's bar" reading that made TRUSTED depend on values deferred for
-- a DIFFERENT transition. Registered.
--
-- The four established_* columns are RETAINED and read by nothing at MVP, so
-- that a richer NEW -> ESTABLISHED rule is a seed rather than a migration.
-- Their being unread is stated in the body, because a column with no reader
-- looks like a column somebody forgot.
--
-- NEITHER FUNCTION CHANGES SIGNATURE, so CREATE OR REPLACE preserves owner
-- and privileges and no re-grant is needed. That is the inverse of T5's trap
-- (0027): there the signature changed, which made a NEW object with
-- PostgreSQL's defaults. Both are owned by adulis_migrate and granted to
-- adulis_app (and adulis_jobs for the recompute); verified before writing.

-- 1. The two columns the ruling needs, at the values it sets ---------------
--
-- DEFAULTs rather than an INSERT: ladder_config is per-market versioned
-- configuration, and a migration cannot seed a row without inventing a
-- market. A default ships the value and leaves tuning to "an INSERT of a new
-- effective row" (S5.3), which is what this document says configuration is.
--
-- [!] CONSEQUENCE, STATED: there are ZERO ladder_config rows today, so the
-- ladder remains inert until a market seed inserts one. This migration makes
-- the ladder CAPABLE of moving a seller; the market seed is what starts it,
-- and ADU-VAL-01 Group A still blocks that seed on the other twelve values.
ALTER TABLE core.ladder_config
  ADD COLUMN new_to_established_min_tenure interval NOT NULL DEFAULT interval '60 days',
  ADD COLUMN new_to_established_min_orders int      NOT NULL DEFAULT 50;

COMMENT ON COLUMN core.ladder_config.new_to_established_min_tenure IS
  'G1.2. Measured from seller_level_state.since -- the moment the seller entered the ladder at NEW. No document defines tenure''s origin; registered as an open question. A demotion resets it, which is hysteresis.';
COMMENT ON COLUMN core.ladder_config.new_to_established_min_orders IS
  'G1.2. Lifetime count of core."order" rows in state COMPLETED for this seller. The ruling gives no window, so none is applied.';

-- The product cap becomes live at the same moment, and that is the half of
-- G1.2 that bites immediately: publication is the INTERSECTION of tier and
-- level, so an Assisted seller who was effectively uncapped is capped at 10
-- while NEW. Correct, and it will look like a bug.
ALTER TABLE core.ladder_config
  ALTER COLUMN new_level_product_cap SET DEFAULT 10;

-- 2. The transaction cap is NULL, and NULL has to be legal ------------------
--
-- v1.12 S5.5 prints this as "bigint NULL -- NULL = no cap", and S12.3 says
-- "G1.2 sets no cap at MVP, so the column is NULL and the check does not
-- fire". The BUILD had it NOT NULL, so the document's own ruling could not be
-- expressed. Registered as a build/document divergence -- and the document is
-- the one that is right, because the ruling depends on it.
ALTER TABLE core.ladder_config
  ALTER COLUMN new_level_transaction_cap_minor DROP NOT NULL;

COMMENT ON COLUMN core.ladder_config.new_level_transaction_cap_minor IS
  'G1.2: NULL, and NULL means NO CAP. Not zero, which would read as a cap of nothing. fn_create_order tests IS NOT NULL explicitly (S12.3).';

-- 2a. The TRUSTED deferral has to be expressible, or it is not a deferral --
--
-- A1.3: "All four stay NULL, so TRUSTED remains unreachable -- which is
-- intended and is the correct MVP shape", and "Test that the deferral is
-- real, not just believed."
--
-- THAT COULD NOT BE WRITTEN. Every threshold column on this table is NOT
-- NULL, so a ladder_config row MUST supply all four trusted_* values and
-- TRUSTED becomes reachable the moment any market is configured -- the
-- opposite of the ruling. The inertness that exists today comes from there
-- being NO ladder_config row at all (the IF NOT FOUND exit), not from NULL
-- thresholds, and that protection ends at the market seed.
--
-- The coalesce(..., false) guards in the recompute were therefore decorative
-- on these columns: they guard against a NULL the schema forbids. Dropping
-- NOT NULL is what makes them live, and it is the same argument that applies
-- to new_level_transaction_cap_minor above -- a ruling that says "deferred"
-- needs a way to say it.
--
-- SCOPE: the four trusted_* only, because A1.3 names them. Every OTHER
-- deferred threshold on this table -- established_*, demotion_*,
-- distinct_buyer_max_count, all marked OPEN in ADU-VAL-01 -- is still NOT
-- NULL, so a market seed must still invent values ADU-VAL-01 defers.
-- Registered; not fixed here, because no ruling covers them and inventing
-- the fix is the failure this project keeps writing down.
ALTER TABLE core.ladder_config
  ALTER COLUMN trusted_min_handoffs             DROP NOT NULL,
  ALTER COLUMN trusted_window                   DROP NOT NULL,
  ALTER COLUMN trusted_min_scan_completion_rate DROP NOT NULL,
  ALTER COLUMN trusted_max_claim_rate           DROP NOT NULL;

COMMENT ON COLUMN core.ladder_config.trusted_min_handoffs IS
  'ADU-VAL-01 Group A, deferred. NULL means the TRUSTED gate cannot be evaluated and nobody is promoted (A1.3). NOT NULL until T6, which made the deferral inexpressible.';

-- 3. NULL means no cap, said out loud ---------------------------------------
--
-- The body below is core.fn_create_order EXACTLY as it stands, extracted with
-- pg_get_functiondef and changed on ONE line. It is reproduced rather than
-- hand-rewritten because a 174-line function retyped from memory is a silent
-- behaviour change wearing a bug fix.

CREATE OR REPLACE FUNCTION core.fn_create_order(p_cart_id uuid, p_buyer uuid, p_order_id uuid, p_expected jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core'
AS $function$
DECLARE
  v_cart      core.cart;
  v_market    core.market;
  v_window    interval;
  v_level     core.trust_level;
  v_cap       bigint;
  v_payout    core.payout_details;
  v_snap_id   uuid;
  v_total     bigint := 0;
  v_currency  core.currency_code := NULL;
  v_failures  jsonb := '[]'::jsonb;
  v_line      record;
  v_expected  bigint;
  v_res_id    uuid;
BEGIN
  SELECT * INTO v_cart FROM core.cart
   WHERE id = p_cart_id AND status = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND OR v_cart.buyer_account_id IS DISTINCT FROM p_buyer THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;
  IF v_cart.seller_id IS NULL THEN
    RAISE EXCEPTION 'cart is empty' USING ERRCODE = 'U0003',
      DETAIL = '[{"code":"CART_EMPTY"}]';
  END IF;

  SELECT * INTO v_market FROM core.market WHERE id = v_cart.market_id;

  -- Fail closed on absent timing configuration: an order whose expiry cannot
  -- be computed is not an order (rule 6 - never invent a deferred value).
  SELECT tc.reservation_window INTO v_window
    FROM core.timing_config tc
   WHERE tc.market_id = v_cart.market_id AND tc.effective @> now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no timing configuration in force for market %', v_market.code
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Seller still eligible to receive orders (forward-looking: ACTIVE only).
  IF NOT EXISTS (SELECT 1 FROM core.seller s
                  WHERE s.id = v_cart.seller_id AND s.status = 'ACTIVE') THEN
    RAISE EXCEPTION 'seller unavailable' USING ERRCODE = 'U0003',
      DETAIL = '[{"code":"SELLER_UNAVAILABLE"}]';
  END IF;

  v_level := coalesce((SELECT level FROM core.seller_level_state
                        WHERE seller_id = v_cart.seller_id), 'NEW');

  -- Per-line validation, EVERY failure collected (section 8.3's complete
  -- reconciliation, not one error at a time).
  FOR v_line IN
    SELECT cl.variant_id, cl.quantity,
           pv.price_minor, pv.price_currency, pv.stock_count, pv.status AS variant_status,
           p.visibility
      FROM core.cart_line cl
      LEFT JOIN core.product_variant pv ON pv.id = cl.variant_id
      LEFT JOIN core.product p ON p.id = pv.product_id
     WHERE cl.cart_id = p_cart_id
  LOOP
    IF v_line.price_minor IS NULL OR v_line.variant_status <> 'ACTIVE' THEN
      v_failures := v_failures || jsonb_build_object(
        'code', 'VARIANT_WITHDRAWN', 'variant_id', v_line.variant_id);
      CONTINUE;
    END IF;
    IF v_line.visibility <> 'PUBLISHED' THEN
      v_failures := v_failures || jsonb_build_object(
        'code', 'NO_LONGER_PUBLISHED', 'variant_id', v_line.variant_id);
    END IF;
    IF v_line.stock_count < v_line.quantity THEN
      v_failures := v_failures || jsonb_build_object(
        'code', CASE WHEN v_line.stock_count = 0 THEN 'SOLD_OUT' ELSE 'INSUFFICIENT_STOCK' END,
        'variant_id', v_line.variant_id,
        'requested', v_line.quantity, 'available', v_line.stock_count);
    END IF;
    v_expected := (SELECT (e->>'unit_price_minor')::bigint
                     FROM jsonb_array_elements(coalesce(p_expected, '[]'::jsonb)) e
                    WHERE (e->>'variant_id')::uuid = v_line.variant_id);
    IF v_expected IS NULL OR v_expected <> v_line.price_minor THEN
      v_failures := v_failures || jsonb_build_object(
        'code', 'PRICE_CHANGED', 'variant_id', v_line.variant_id,
        'was_minor', v_expected, 'now_minor', v_line.price_minor,
        'currency', v_line.price_currency);
    END IF;
    IF v_currency IS NULL THEN
      v_currency := v_line.price_currency;
    ELSIF v_currency <> v_line.price_currency THEN
      RAISE EXCEPTION 'mixed currencies in one cart' USING ERRCODE = 'restrict_violation';
    END IF;
    v_total := v_total + v_line.price_minor * v_line.quantity;
  END LOOP;

  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'cart is empty' USING ERRCODE = 'U0003',
      DETAIL = '[{"code":"CART_EMPTY"}]';
  END IF;

  -- New-level transaction cap (section 12.3). FAIL CLOSED on absent ladder
  -- config: for a NEW seller the cap is a risk control, and a control whose
  -- value is missing refuses rather than waves through.
  IF v_level = 'NEW' THEN
    SELECT lc.new_level_transaction_cap_minor INTO v_cap
      FROM core.ladder_config lc
     WHERE lc.market_id = v_cart.market_id AND lc.effective @> now();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'no ladder configuration in force for market %', v_market.code
        USING ERRCODE = 'restrict_violation';
    END IF;
    -- G1.2 / A1.3: a NULL cap is NO CAP, and it now says so. The previous
    -- form was `IF v_total > v_cap`, which reaches the same answer through
    -- three-valued logic rather than through a stated rule. S12.3: "the
    -- comparison must handle NULL explicitly rather than relying on a NULL
    -- comparison evaluating false by accident."
    IF v_cap IS NOT NULL AND v_total > v_cap THEN
      v_failures := v_failures || jsonb_build_object(
        'code', 'TRANSACTION_CAP_EXCEEDED', 'total_minor', v_total, 'cap_minor', v_cap);
    END IF;
  END IF;

  IF jsonb_array_length(v_failures) > 0 THEN
    RAISE EXCEPTION 'cart revalidation failed'
      USING ERRCODE = 'U0003', DETAIL = v_failures::text;
  END IF;

  -- FX (section 12.1): captured like price. One market, one currency today;
  -- a cross-currency order has no rate source anywhere in the schema, so it
  -- refuses rather than inventing one (register D-16).
  IF v_currency <> v_market.display_currency THEN
    RAISE EXCEPTION 'no fx source for % -> %', v_currency, v_market.display_currency
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- The payout snapshot (section 13.5): the details in effect NOW, frozen.
  SELECT * INTO v_payout FROM core.payout_details
   WHERE seller_id = v_cart.seller_id AND state = 'ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'seller has no active payout details' USING ERRCODE = 'restrict_violation';
  END IF;
  INSERT INTO core.order_payout_snapshot (seller_id, payout_details_id, bank_code, account_last4)
  VALUES (v_cart.seller_id, v_payout.id, v_payout.bank_code, v_payout.account_last4)
  RETURNING id INTO v_snap_id;

  INSERT INTO core."order"
    (id, market_id, seller_id, buyer_account_id, state, expires_at,
     total_minor, total_currency, display_currency, fx_rate, fx_rate_captured_at,
     payout_snapshot_id, seller_level_at_order)
  VALUES
    (p_order_id, v_cart.market_id, v_cart.seller_id, p_buyer, 'CREATED',
     now() + v_window, v_total, v_currency, v_market.display_currency, 1, now(),
     v_snap_id, v_level);

  -- One reservation and ONE STOCK EVENT PER LINE, inside this transaction
  -- (section 12.3). The event is the CAUSE of the decrement; concurrent
  -- overselling dies on the variant's CHECK, rolling this whole order back.
  FOR v_line IN
    SELECT cl.variant_id, cl.quantity, pv.price_minor, pv.price_currency
      FROM core.cart_line cl JOIN core.product_variant pv ON pv.id = cl.variant_id
     WHERE cl.cart_id = p_cart_id
  LOOP
    v_res_id := gen_random_uuid();
    INSERT INTO core.reservation
      (id, order_id, variant_id, seller_id, buyer_account_id, quantity,
       unit_price_minor, unit_price_currency)
    VALUES (v_res_id, p_order_id, v_line.variant_id, v_cart.seller_id, p_buyer,
            v_line.quantity, v_line.price_minor, v_line.price_currency);
    INSERT INTO core.stock_event
      (id, variant_id, seller_id, delta, reason, order_id, reservation_id, actor_account_id)
    VALUES (gen_random_uuid(), v_line.variant_id, v_cart.seller_id,
            -v_line.quantity, 'ORDER_CREATED', p_order_id, v_res_id, p_buyer);
  END LOOP;

  UPDATE core.cart SET status = 'CONVERTED', updated_at = now() WHERE id = p_cart_id;
  RETURN p_order_id;
END $function$;

-- 4. The gate itself, rewired per A1.3 --------------------------------------

CREATE OR REPLACE FUNCTION core.fn_recompute_seller_level(
  p_seller uuid,
  p_forced_demotion boolean DEFAULT false,
  p_moderation_event uuid DEFAULT NULL::uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'core' AS $function$
DECLARE
  v_state     core.seller_level_state;
  v_cfg       core.ladder_config;
  v_target    core.trust_level;
  v_tenure    interval;
  v_orders    int;
  v_handoffs_tru   int;
  v_claim_rate_tru numeric;
  v_claim_rate_dem numeric;
  v_cancel_rate    numeric;
  v_scan_rate_tru  numeric;
  v_scan_rate_dem  numeric;
BEGIN
  -- Lock the row: two concurrent recomputes must serialise, or two triggers
  -- firing together could each read the old level and both "demote once".
  SELECT * INTO v_state
    FROM core.seller_level_state
   WHERE seller_id = p_seller
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;   -- not on the ladder yet (eligibility not satisfied) - nothing to compute
  END IF;

  IF p_forced_demotion THEN
    -- Section 5.2 / 14: an upheld claim ALWAYS demotes, unconditionally --
    -- which is why it returns before the configuration read below. Unchanged.
    v_target := CASE v_state.level
                  WHEN 'TRUSTED'     THEN 'ESTABLISHED'::core.trust_level
                  WHEN 'ESTABLISHED' THEN 'NEW'::core.trust_level
                  ELSE 'NEW'::core.trust_level
                END;
    IF v_target <> v_state.level THEN
      INSERT INTO core.seller_level_event
        (seller_id, from_level, to_level, source, moderation_event_id)
      VALUES (p_seller, v_state.level, v_target, 'MODERATION', p_moderation_event);
      UPDATE core.seller_level_state
         SET level = v_target, since = now(), computed_at = now()
       WHERE seller_id = p_seller;
    ELSE
      UPDATE core.seller_level_state SET computed_at = now()
       WHERE seller_id = p_seller;
    END IF;
    RETURN;
  END IF;

  -- Configuration in force for the seller's market. ABSENT CONFIG IS THE
  -- FAIL-CLOSED EXIT, taken before a single evidence row is read: no
  -- thresholds means no promotion and no threshold demotion, whatever the
  -- evidence says. Unchanged.
  SELECT lc.* INTO v_cfg
    FROM core.ladder_config lc
    JOIN core.seller s ON s.market_id = lc.market_id
   WHERE s.id = p_seller
     AND lc.effective @> now();
  IF NOT FOUND THEN
    UPDATE core.seller_level_state SET computed_at = now()
     WHERE seller_id = p_seller;
    RETURN;
  END IF;

  -- ------------------------------------------------------------------ G1.2
  -- TENURE is measured from seller_level_state.since -- the moment this
  -- seller entered the ladder at NEW. No document defines tenure's origin
  -- (registered); `since` is the ladder's own clock, and seller.created_at
  -- would count time before the seller was even eligible.
  --
  -- ORDERS is the LIFETIME count of COMPLETED orders. The ruling gives no
  -- window, so none is applied -- a windowed count would drop a seller BACK
  -- to NEW after a quiet quarter, which no document asks for.
  --
  -- Neither arm reads handoff_scan.counts_toward_level, and that is worth
  -- knowing: that column is forced false by a BEFORE INSERT trigger whenever
  -- no ladder_config row is in force, and handoff_scan is append-only, so
  -- every scan recorded before a market was configured is PERMANENTLY
  -- non-counting. The transition that matters at MVP does not depend on it.
  v_tenure := now() - v_state.since;
  SELECT count(*) INTO v_orders
    FROM core."order" o
   WHERE o.seller_id = p_seller AND o.state = 'COMPLETED';

  -- TRUSTED evidence -- trusted_* ONLY (A1.3).
  SELECT count(*) INTO v_handoffs_tru
    FROM core.handoff_scan h
    JOIN core."order" o ON o.id = h.order_id
   WHERE o.seller_id = p_seller AND h.counts_toward_level
     AND h.received_at >= now() - v_cfg.trusted_window;

  -- Denominators recorded in register D-13:
  --   claim rate        = upheld claims / counting handoffs, per window
  --   cancellation rate = cancelled reservations / terminal reservations
  --   scan completion   = counting scans / completed orders, per window
  v_claim_rate_tru := core.fn_ladder_claim_rate(p_seller, v_cfg.trusted_window);
  v_claim_rate_dem := core.fn_ladder_claim_rate(p_seller, v_cfg.demotion_window);
  v_cancel_rate    := core.fn_ladder_cancellation_rate(p_seller, v_cfg.demotion_window);
  v_scan_rate_tru  := core.fn_ladder_scan_rate(p_seller, v_cfg.trusted_window);
  v_scan_rate_dem  := core.fn_ladder_scan_rate(p_seller, v_cfg.demotion_window);

  -- FAIL CLOSED: coalesce(_, false) on every gate. NULL never promotes.
  -- All four trusted_* are ADU-VAL-01 Group A and NULL, so TRUSTED is
  -- UNREACHABLE under every input -- intended, and asserted by test rather
  -- than believed.
  IF coalesce(
       v_handoffs_tru       >= v_cfg.trusted_min_handoffs
       AND v_scan_rate_tru  >= v_cfg.trusted_min_scan_completion_rate
       AND v_claim_rate_tru <= v_cfg.trusted_max_claim_rate,
     false)
  THEN
    v_target := 'TRUSTED';
  ELSIF coalesce(
       v_tenure     >= v_cfg.new_to_established_min_tenure
       AND v_orders >= v_cfg.new_to_established_min_orders,
     false)
  THEN
    v_target := 'ESTABLISHED';
  ELSE
    v_target := 'NEW';
  END IF;

  -- established_min_handoffs, established_window, established_min_avg_rating
  -- and established_max_claim_rate are READ BY NOTHING at MVP (A1.3). They
  -- are retained so a richer NEW -> ESTABLISHED rule is a seed rather than a
  -- migration, and named here so the next reader does not assume a column
  -- with no reader was forgotten.

  -- Hysteresis demotion: its own thresholds, one level down, floor NEW.
  -- Also fail-closed - an absent threshold never demotes on its own.
  IF v_state.level <> 'NEW' AND coalesce(
       v_claim_rate_dem > v_cfg.demotion_max_claim_rate
       OR v_cancel_rate  > v_cfg.demotion_max_cancellation_rate
       OR v_scan_rate_dem < v_cfg.demotion_min_scan_completion_rate,
     false)
  THEN
    v_target := CASE v_state.level
                  WHEN 'TRUSTED' THEN 'ESTABLISHED'::core.trust_level
                  ELSE 'NEW'::core.trust_level
                END;
  END IF;

  -- A recompute never promotes past the next rung a demotion just set; the
  -- CASE above already produced a single target. Apply it.
  IF v_target <> v_state.level THEN
    INSERT INTO core.seller_level_event
      (seller_id, from_level, to_level, source)
    VALUES (p_seller, v_state.level, v_target, 'COMPUTED');
    UPDATE core.seller_level_state
       SET level = v_target, since = now(), computed_at = now(),
           evidence_snapshot = jsonb_build_object(
             'tenure',                      v_tenure::text,
             'completed_orders',            v_orders,
             'handoffs_trusted_window',     v_handoffs_tru,
             'claim_rate_demotion_window',  v_claim_rate_dem,
             'cancellation_rate',           v_cancel_rate,
             'scan_completion_rate',        v_scan_rate_dem)
     WHERE seller_id = p_seller;
  ELSE
    UPDATE core.seller_level_state SET computed_at = now()
     WHERE seller_id = p_seller;
  END IF;
END $function$;
