-- ===========================================================================
-- MIGRATION 10 - THE FINANCIAL BOUNDARY, PAYMENT SUBMISSIONS, PAYOUTS
--
-- Source: ADU-DB-01 v1.10 section 28 item 10. Transcribed from sections 13.2
-- through 13.6. (File 0012; see 0010's header for the numbering offset.)
--
-- T3 trap 4: A WRONG GRANT HERE DOES NOT FAIL. IT WORKS. Check 10 is a
-- privilege query, and it only means anything because adulis_app is not a
-- superuser. The whole section is the m04 pattern again, one schema over:
-- its own owning role, no app-role table access, and read paths that are
-- SECURITY DEFINER functions writing the access log IN THE SAME TRANSACTION
-- as the read - you cannot read the evidence without logging the read,
-- because there is no other way to read it.
--
-- Two secrets, one log, OPPOSITE LIFECYCLES: a payment screenshot dies the
-- moment the payment validates; a payout credential lives as long as the
-- seller. The purge job is scoped BY TABLE NAME, never by schema - a
-- schema-scoped purge would destroy every seller's bank details on its first
-- run (section 13.3's own warning).
--
-- ALSO LANDS HERE, deferred from migration 09 (see 0011's header):
-- fn_create_order - it writes the payout snapshot, so it could not exist
-- before this migration's tables.
--
-- DEFERRED OUT of this migration:
--   - the payout-change notification trigger (unsuppressible, section 13.4)
--     -> migration 14, with core.notification and D5's new-device trigger;
--   - fn_request_payout_change / fn_cancel_payout_change -> Phase C4
--     (register D-07): their bodies are not printed and their step-up
--     parameter contract is the API tier's.
--
-- ONE FUNCTION HERE IS THIS MIGRATION'S, NOT THE DOCUMENT'S - register D-16.
-- financial.write_payment_evidence: the evidence COMMIT path. The document
-- names read paths only; an upload that cannot be committed is D4 all over
-- again (write_attestation, named-but-never-defined), and D4's fix was to
-- define it. Same shape: narrow, definer, no log entry - the access log
-- records READS, and a write is already evidenced by the row it produces.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. The financial schema's three tables (sections 13.3, 13.6)
-- ---------------------------------------------------------------------------
CREATE TABLE financial.payment_evidence (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL,          -- bare: no FK across the boundary
  object_key          text NOT NULL,
  encryption_key_ref  text NOT NULL,
  frame_size_bytes    int  NOT NULL DEFAULT 65536,
  frame_count         int  NULL,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  validated_at        timestamptz NULL,
  deleted_at          timestamptz NULL,
  retention_reason    financial.retention_reason NULL
);

COMMENT ON TABLE financial.payment_evidence IS
  'Section 13.3. R18: encrypted as ~64KB AEAD frames, never one object - '
  'whole-object AES-GCM must buffer entirely to verify its tag, and 5MB times '
  'concurrent viewers exhausts an instance. frame_size_bytes and frame_count '
  'are set at write and never updated, so a reader knows the framing without '
  'parsing the object. The purge selects validated_at IS NOT NULL AND '
  'retention_reason IS NULL, FROM THIS TABLE BY NAME.';

CREATE TABLE financial.payout_credential (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_details_id       uuid NOT NULL UNIQUE,   -- bare: no FK across the boundary
  account_ciphertext      bytea NOT NULL,
  account_name_ciphertext bytea NOT NULL,
  encryption_key_ref      text NOT NULL,
  written_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE financial.payout_credential IS
  'Section 13.6. Write-once: changing a bank account writes a NEW '
  'core.payout_details row with its own credential. R15: key material never '
  'enters PostgreSQL - encryption_key_ref names a key version in the '
  'deployment secret store, which is what makes rotation an added _V2 and a '
  're-encrypt job rather than a migration.';

-- Write-once, mechanically.
CREATE TRIGGER trg_credential_write_once
  BEFORE UPDATE ON financial.payout_credential
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE TABLE financial.access_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind     financial.secret_subject_kind NOT NULL,
  subject_id       uuid NOT NULL,
  actor_account_id uuid NOT NULL,
  actor_role       text NOT NULL,
  order_id         uuid NULL,
  reason           text NULL,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN financial.access_log.actor_role IS
  'R5 - DERIVED inside the reading function from actual grants, never a '
  'parameter. The most contested field in the audit row must not be the one '
  'the reader supplies about themselves. reason is nullable because a seller '
  'reading evidence on their own order needs no justification while still '
  'being recorded identically (section 13.3).';

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON financial.access_log
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE INDEX idx_financial_access_log_subject
  ON financial.access_log (subject_kind, subject_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- 2. core-side payment and payout tables (sections 13.2, 13.4, 13.5)
-- ---------------------------------------------------------------------------
CREATE TABLE core.payment_submission (
  id                     uuid PRIMARY KEY,
  order_id               uuid NOT NULL REFERENCES core."order"(id),
  submitted_at           timestamptz NOT NULL DEFAULT now(),
  evidence_ref           uuid NOT NULL,   -- opaque handle into financial; no FK across the boundary
  state                  core.payment_submission_state NOT NULL DEFAULT 'SUBMITTED',
  decided_by_account_id  uuid NULL REFERENCES core.account(id),
  decided_at             timestamptz NULL,
  rejection_reason       text NULL,
  sla_deadline           timestamptz NULL
);

CREATE INDEX idx_payment_submission_by_order ON core.payment_submission (order_id);

COMMENT ON TABLE core.payment_submission IS
  'Section 13.2. Adulis NEVER asserts a payment is genuine: no '
  'verified_by_adulis column, no automated confirmation path. The seller is '
  'the verifier, and the ACTING team member is recorded, never the owner by '
  'default. R7(a): no active_hours_version_id - the SLA is wall-clock.';

CREATE TABLE core.payout_details (
  id                      uuid PRIMARY KEY,
  seller_id               uuid NOT NULL REFERENCES core.seller(id),
  bank_code               text NOT NULL,
  account_last4           char(4) NOT NULL,
  state                   core.payout_state NOT NULL DEFAULT 'PENDING',
  requested_at            timestamptz NOT NULL DEFAULT now(),
  activates_at            timestamptz NULL,
  activated_at            timestamptz NULL,
  requested_by_account_id uuid NOT NULL REFERENCES core.account(id),
  step_up_challenge_id    uuid NULL REFERENCES core.step_up_challenge(id),

  -- Section 13.4: step-up is NOT NULL on any row entering PENDING.
  CONSTRAINT payout_pending_requires_step_up CHECK (
    state <> 'PENDING' OR step_up_challenge_id IS NOT NULL
  )
);

-- At most one ACTIVE payout row per seller; during PENDING the previous
-- ACTIVE row is the one order creation reads.
CREATE UNIQUE INDEX payout_one_active_per_seller
  ON core.payout_details (seller_id) WHERE state = 'ACTIVE';

COMMENT ON TABLE core.payout_details IS
  'Section 13.4. THE ACCOUNT NUMBER IS NOT IN THIS TABLE - core holds '
  'account_last4 and nothing more, so every seller/team/support/admin surface '
  'reads a masked value because that is the only value present, not because '
  'it remembered to mask. The full value lives across the boundary in '
  'financial.payout_credential.';

CREATE TABLE core.payout_change_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         uuid NOT NULL REFERENCES core.seller(id),
  actor_account_id  uuid NOT NULL,
  session_id        uuid NULL,
  device_id         uuid NULL,
  previous_last4    char(4) NULL,
  new_last4         char(4) NULL,
  outcome           text NOT NULL,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.payout_change_log
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE TABLE core.order_payout_snapshot (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         uuid NOT NULL REFERENCES core.seller(id),
  payout_details_id uuid NOT NULL REFERENCES core.payout_details(id),
  bank_code         text NOT NULL,
  account_last4     char(4) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Write-once (section 13.5): without this, a payout change mid-order would
-- silently reroute payment for every order already placed - the exact
-- outcome a session-compromise attacker wants, invisible to everyone.
CREATE TRIGGER trg_snapshot_write_once
  BEFORE UPDATE ON core.order_payout_snapshot
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

-- The order's reference, deferred from migration 09.
ALTER TABLE core."order"
  ADD CONSTRAINT order_payout_snapshot
  FOREIGN KEY (payout_snapshot_id) REFERENCES core.order_payout_snapshot(id);

CREATE TABLE core.payment_instruction_reissue (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES core."order"(id),
  previous_snapshot_id uuid NOT NULL REFERENCES core.order_payout_snapshot(id),
  new_snapshot_id      uuid NOT NULL REFERENCES core.order_payout_snapshot(id),
  actor_account_id     uuid NOT NULL REFERENCES core.account(id),
  step_up_challenge_id uuid NOT NULL REFERENCES core.step_up_challenge(id),
  buyer_notified_at    timestamptz NULL,
  sla_reset_at         timestamptz NULL,
  occurred_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.payment_instruction_reissue
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

COMMENT ON TABLE core.payment_instruction_reissue IS
  'Section 13.5 - the ONE controlled path after the snapshot. Single-order '
  'only: no bulk path exists in any function signature, so a compromised '
  'session cannot reroute every in-flight order at once.';

-- ---------------------------------------------------------------------------
-- 3. The boundary functions (sections 13.3, 13.6, 20.2/R5)
-- ---------------------------------------------------------------------------

-- The evidence read. Role is DERIVED: an operator grant, or the seller
-- relationship on the evidence's order. No grant, no row - the query that
-- logs is the query that authorises.
CREATE FUNCTION financial.read_payment_evidence(
  p_evidence_id uuid, p_actor uuid, p_reason text DEFAULT NULL
) RETURNS financial.payment_evidence
LANGUAGE plpgsql SECURITY DEFINER SET search_path = financial, core AS $fn$
DECLARE r financial.payment_evidence;
        v_role text;
        v_seller uuid;
BEGIN
  SELECT * INTO r FROM financial.payment_evidence WHERE id = p_evidence_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such evidence' USING ERRCODE = 'U0002';
  END IF;

  -- Operator path. Which operator roles may read payment evidence is not
  -- printed anywhere; CLAIM_REVIEWER (claim review needs it), SUPPORT
  -- (section 20.3: support reads through the same logged functions) and ADMIN
  -- - register D-16. IDENTITY_REVIEWER and MODERATOR are deliberately absent.
  SELECT g.role::text INTO v_role
    FROM core.operator_grant g
   WHERE g.account_id = p_actor
     AND g.role IN ('CLAIM_REVIEWER', 'SUPPORT', 'ADMIN')
     AND g.revoked_at IS NULL
   ORDER BY g.granted_at LIMIT 1;

  IF v_role IS NULL THEN
    -- Seller path: the owner, or a team member in good standing whose role
    -- carries seller.payment_evidence:read. Surface gating is the endpoint's
    -- fn_has_permission; the boundary re-derives the RELATIONSHIP so that no
    -- caller can log a read it was not entitled to make.
    SELECT o.seller_id INTO v_seller FROM core."order" o WHERE o.id = r.order_id;
    IF EXISTS (SELECT 1 FROM core.seller s
                WHERE s.id = v_seller AND s.owner_account_id = p_actor)
       OR EXISTS (SELECT 1
                    FROM core.seller_team_member tm
                    JOIN core.role_permission rp ON rp.role = tm.role
                   WHERE tm.seller_id = v_seller AND tm.account_id = p_actor
                     AND tm.suspended_at IS NULL AND tm.revoked_at IS NULL
                     AND rp.permission_code = 'seller.payment_evidence:read') THEN
      v_role := 'SELLER';
    END IF;
  END IF;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'no grant permits reading payment evidence'
      USING ERRCODE = 'U0001';
  END IF;

  INSERT INTO financial.access_log
    (subject_kind, subject_id, actor_account_id, actor_role, order_id, reason)
  VALUES ('PAYMENT_EVIDENCE', r.id, p_actor, v_role, r.order_id, p_reason);
  RETURN r;   -- object_key + encryption_key_ref out; THE API DECRYPTS (R15/R18)
END $fn$;

-- The C3 disclosure path. Verifies the caller is the buyer on a payable
-- order, reads THE SNAPSHOT, logs, and returns CIPHERTEXT - R15: it does not
-- decrypt, so a live database connection yields nothing readable.
CREATE FUNCTION financial.render_payment_instructions(p_order_id uuid, p_actor uuid)
RETURNS TABLE (bank_code text,
               account_ciphertext bytea,
               account_name_ciphertext bytea,
               encryption_key_ref text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = financial, core AS $fn$
DECLARE v_order core."order";
        v_snap  core.order_payout_snapshot;
        v_cred  financial.payout_credential;
BEGIN
  -- 1. The buyer on this order, and no one else. A non-buyer gets U0002: an
  --    actor with no relationship must not learn the order exists.
  SELECT * INTO v_order FROM core."order" o
   WHERE o.id = p_order_id AND o.buyer_account_id = p_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  -- 2. A payable state: before confirmation, including resubmission after a
  --    rejection. Confirmed, handed off, completed, cancelled and expired
  --    orders have nothing left to pay.
  IF v_order.state NOT IN ('CREATED', 'NOTIFIED', 'PAYMENT_SUBMITTED') THEN
    RAISE EXCEPTION 'order is not in a payable state (%)', v_order.state
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- 3. The snapshot captured at creation - NEVER the seller's current record.
  SELECT s.* INTO v_snap FROM core.order_payout_snapshot s
   WHERE s.id = v_order.payout_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order carries no payout snapshot' USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT c.* INTO v_cred FROM financial.payout_credential c
   WHERE c.payout_details_id = v_snap.payout_details_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no credential for snapshot' USING ERRCODE = 'restrict_violation';
  END IF;

  -- 4. The log, in this transaction. The buyer is a legitimate reader logged
  --    like any other.
  INSERT INTO financial.access_log
    (subject_kind, subject_id, actor_account_id, actor_role, order_id)
  VALUES ('PAYOUT_CREDENTIAL', v_cred.id, p_actor, 'BUYER', p_order_id);

  -- 5. Ciphertext plus the key reference. DO NOT DECRYPT - R15.
  RETURN QUERY SELECT v_snap.bank_code, v_cred.account_ciphertext,
                      v_cred.account_name_ciphertext, v_cred.encryption_key_ref;
END $fn$;

-- The evidence COMMIT (register D-16, the D4 pattern). Narrow: it writes the
-- evidence row and nothing else; the caller (order payment-evidence endpoint)
-- pairs it with core.payment_submission in the same transaction. No log
-- entry: the access log records reads, and the write is evidenced by the row.
CREATE FUNCTION financial.write_payment_evidence(
  p_order_id uuid,
  p_object_key text,
  p_encryption_key_ref text,
  p_frame_size_bytes int,
  p_frame_count int
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = financial AS $fn$
DECLARE v_id uuid;
BEGIN
  INSERT INTO financial.payment_evidence
    (order_id, object_key, encryption_key_ref, frame_size_bytes, frame_count)
  VALUES (p_order_id, p_object_key, p_encryption_key_ref,
          coalesce(p_frame_size_bytes, 65536), p_frame_count)
  RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

-- Retention marker for migration 12's claim trigger: opening a claim sets
-- retention_reason = 'OPEN_CLAIM' on the evidence IN THE SAME TRANSACTION, so
-- the purge job cannot destroy the only proof. A narrow definer function
-- because the trigger runs as the app role, which holds no financial
-- privilege at all.
CREATE FUNCTION financial.fn_mark_evidence_retained(p_evidence uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = financial AS $fn$
BEGIN
  UPDATE financial.payment_evidence
     SET retention_reason = 'OPEN_CLAIM'
   WHERE id = p_evidence AND retention_reason IS NULL;
END $fn$;

-- ---------------------------------------------------------------------------
-- 4. fn_create_order (section 12.3) - deferred here from migration 09
--
-- One function, one transaction. Per line: sufficient stock, product still
-- published, variant still exists and is active, price unchanged, seller
-- still eligible to receive orders, New-level transaction cap. ON ANY
-- FAILURE it raises with a structured payload naming EVERY failing line -
-- SQLSTATE U0003, the first use of the reserved band (register D-16): the
-- API maps it to 409 CART_REVALIDATION_FAILED and passes DETAIL to items[].
--
-- THE SYSTEM NEVER SILENTLY ALTERS A CART: no code path here writes
-- cart_line. Price-unchanged is checked against the caller's expected prices
-- (p_expected: [{variant_id, unit_price_minor}]) because the cart stores no
-- price - a cart is a draft, and the agreement happens at this boundary.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_create_order(
  p_cart_id uuid,
  p_buyer uuid,
  p_order_id uuid,
  p_expected jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
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
    IF v_total > v_cap THEN
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
END $fn$;

-- ---------------------------------------------------------------------------
-- 5. Confirmation-rate stats (R16, the payment_submission slice)
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_stats_on_payment_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_seller uuid;
BEGIN
  IF NEW.state IN ('CONFIRMED', 'REJECTED') AND OLD.state = 'SUBMITTED' THEN
    SELECT seller_id INTO v_seller FROM core."order" WHERE id = NEW.order_id;
    UPDATE core.seller_public_stats
       SET payments_decided_count   = payments_decided_count + 1,
           payments_confirmed_count = payments_confirmed_count
             + CASE WHEN NEW.state = 'CONFIRMED' THEN 1 ELSE 0 END,
           confirmation_rate = round(
             (payments_confirmed_count + CASE WHEN NEW.state = 'CONFIRMED' THEN 1 ELSE 0 END)::numeric
             / (payments_decided_count + 1), 4),
           updated_at = now()
     WHERE seller_id = v_seller;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_stats_on_payment_decision
  AFTER UPDATE OF state ON core.payment_submission
  FOR EACH ROW EXECUTE FUNCTION core.fn_stats_on_payment_decision();

-- ---------------------------------------------------------------------------
-- 6. Ownership and grants - the boundary itself
-- ---------------------------------------------------------------------------
ALTER TABLE financial.payment_evidence  OWNER TO adulis_financial;
ALTER TABLE financial.payout_credential OWNER TO adulis_financial;
ALTER TABLE financial.access_log        OWNER TO adulis_financial;

ALTER FUNCTION financial.read_payment_evidence(uuid, uuid, text) OWNER TO adulis_financial;
ALTER FUNCTION financial.render_payment_instructions(uuid, uuid) OWNER TO adulis_financial;
ALTER FUNCTION financial.write_payment_evidence(uuid, text, text, int, int) OWNER TO adulis_financial;
ALTER FUNCTION financial.fn_mark_evidence_retained(uuid) OWNER TO adulis_financial;

-- The definer functions cross into core to derive roles and read snapshots.
GRANT USAGE ON SCHEMA core TO adulis_financial;
GRANT SELECT ON core.operator_grant, core.seller, core.seller_team_member,
                core.role_permission, core."order", core.order_payout_snapshot
  TO adulis_financial;
-- RLS on core."order" applies to adulis_financial too.
CREATE POLICY order_financial_select ON core."order"
  FOR SELECT TO adulis_financial USING (true);

GRANT USAGE ON SCHEMA financial TO adulis_app;
GRANT EXECUTE ON FUNCTION financial.read_payment_evidence(uuid, uuid, text)        TO adulis_app;
GRANT EXECUTE ON FUNCTION financial.render_payment_instructions(uuid, uuid)        TO adulis_app;
GRANT EXECUTE ON FUNCTION financial.write_payment_evidence(uuid, text, text, int, int) TO adulis_app;
GRANT EXECUTE ON FUNCTION financial.fn_mark_evidence_retained(uuid)                TO adulis_app;

REVOKE ALL ON financial.payment_evidence, financial.payout_credential,
              financial.access_log
  FROM adulis_app, PUBLIC;

-- The purge job reads and updates ONE TABLE BY NAME (section 13.3).
GRANT USAGE ON SCHEMA financial TO adulis_jobs;
GRANT SELECT, UPDATE ON financial.payment_evidence TO adulis_jobs;

-- THE STOCK-APPLY TRIGGER BECOMES SECURITY DEFINER - found by the CP-6
-- smoke, loudly. fn_apply_stock_event (migration 07, merged - so ALTERed
-- here, never edited) executes as the INSERTING role, and its UPDATE of
-- product_variant.stock_count therefore required every inserter to hold
-- UPDATE on the variant table: fn_create_order (as adulis_migrate) failed
-- outright, and the expiry sweep (adulis_jobs) would have failed at its
-- first release. Definer-izing the trigger function is NARROWER, not wider:
-- an inserter now needs INSERT on stock_event and nothing else, the
-- column-level UPDATE lives with adulis_migrate alone, and the guard trigger
-- still refuses every write that did not come through the apply path.
ALTER FUNCTION core.fn_apply_stock_event() SECURITY DEFINER SET search_path = core;
ALTER FUNCTION core.fn_apply_stock_event() OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_guard_stock_count() SET search_path = core;
GRANT SELECT, UPDATE (stock_count) ON core.product_variant TO adulis_migrate;

-- fn_create_order runs as adulis_migrate.
ALTER FUNCTION core.fn_create_order(uuid, uuid, uuid, jsonb) OWNER TO adulis_migrate;
GRANT SELECT, UPDATE ON core.cart                   TO adulis_migrate;
GRANT SELECT         ON core.cart_line, core.timing_config, core.market,
                        core.product, core.product_variant, core.payout_details
  TO adulis_migrate;
-- INSERT ... RETURNING reads the returned columns, so the snapshot INSERT
-- needs SELECT as well - found by the CP-6 smoke, loudly, as a permission
-- denial inside the function's first real call.
GRANT INSERT         ON core."order", core.reservation TO adulis_migrate;
GRANT SELECT, INSERT ON core.order_payout_snapshot     TO adulis_migrate;
GRANT SELECT, INSERT ON core.stock_event            TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_create_order(uuid, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_create_order(uuid, uuid, uuid, jsonb) TO adulis_app;

ALTER FUNCTION core.fn_stats_on_payment_decision() OWNER TO adulis_migrate;

-- core-side app grants.
GRANT SELECT, INSERT, UPDATE ON core.payment_submission, core.payout_details
  TO adulis_app;
GRANT SELECT, INSERT ON core.payout_change_log, core.order_payout_snapshot,
                        core.payment_instruction_reissue
  TO adulis_app;
REVOKE UPDATE, DELETE ON core.payout_change_log        FROM adulis_app;
REVOKE UPDATE, DELETE ON core.payment_instruction_reissue FROM adulis_app;
REVOKE UPDATE, DELETE ON core.order_payout_snapshot    FROM adulis_app;

GRANT SELECT ON core.payment_submission, core.payout_details,
                core.payout_change_log, core.order_payout_snapshot,
                core.payment_instruction_reissue
  TO adulis_readonly;

GRANT SELECT, UPDATE ON core.payment_submission TO adulis_jobs;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 10 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
