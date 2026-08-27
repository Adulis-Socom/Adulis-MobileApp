-- ===========================================================================
-- MIGRATION 09 - CART, ORDERS, RESERVATIONS, THE TWO STATE MACHINES
--
-- Source: ADU-DB-01 v1.10 section 28 item 9. Transcribed from sections 11,
-- 12.1-12.7 and amendment A3.2. (File 0011; see 0010's header for the offset.)
--
-- ONE OF THE TWO CONCURRENCY-CRITICAL MIGRATIONS (section 28): "Migration 9's
-- state machine is where a wrong transition silently turns a paid order into
-- an expired one. Everywhere else, a mistake raises an exception; in those
-- two, it produces wrong data."
--
-- Eleven tables. The legal transition sets are SEEDED RATIFIED - 17 order
-- rows and 6 reservation rows (R8'), with fixed literal timestamps so two
-- clean builds carry identical data. The guards are FAIL-CLOSED: a transition
-- absent from the table is refused, an empty table means nothing moves, and
-- there is no permissive mode.
--
-- THE ABSENT ROW IS THE POINT (T3 trap 2): there is NO
-- PAYMENT_SUBMITTED -> EXPIRED_UNCLAIMED row. A submitted payment never
-- expires - the buyer has performed. Its replacement, section 12.4a's
-- confirmation-window lapse, opens a SYSTEM claim WITH STOCK STILL HELD; that
-- job function lands with core.claim in migration 12, and the absence here is
-- safe on its own because the guard refuses the expiry transition either way.
-- (Section 12.4a's note about seeding payment_confirmation_window: the COLUMN
-- exists since migration 02; timing_config carries no rows until the Tier 4
-- market seed, so there is nothing to seed here.)
--
-- A3.2 LANDS HERE, BOTH HALVES: the release-idempotency index scoped to
-- (reservation_id, reason), AND the CHECK requiring the anchor - a partial
-- unique index does not constrain rows whose indexed column is NULL, so
-- without the CHECK a release with no line escapes it entirely. Release
-- reasons are {ORDER_EXPIRED, LINE_CANCELLED} - register D-04.
--
-- DEFERRED OUT of this migration, with the section-28.1 precedent:
--   - fn_create_order -> migration 10. It writes the payout snapshot
--     (section 13.5), and order_payout_snapshot does not exist until then. A
--     function that raises "relation does not exist" at CP-5 is worse than a
--     documented one-migration deferral.
--   - order.payout_snapshot_id is a BARE uuid here; migration 10 adds the FK.
--   - the confirmation-window job function -> migration 12 (needs claim).
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.cart and core.cart_line (section 11.2) - C6: keyed by device
-- ---------------------------------------------------------------------------
CREATE TABLE core.cart (
  id               uuid PRIMARY KEY,
  device_id        uuid NOT NULL REFERENCES core.device(id),
  buyer_account_id uuid NULL REFERENCES core.account(id),
  seller_id        uuid NULL REFERENCES core.seller(id),
  market_id        uuid NOT NULL REFERENCES core.market(id),
  status           core.cart_status NOT NULL DEFAULT 'ACTIVE',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- The anchor for cart_line_single_seller.
  CONSTRAINT cart_id_seller UNIQUE (id, seller_id)
);

-- One ACTIVE cart per device.
CREATE UNIQUE INDEX cart_one_active_per_device
  ON core.cart (device_id) WHERE status = 'ACTIVE';

CREATE TABLE core.cart_line (
  id                     uuid PRIMARY KEY,
  cart_id                uuid NOT NULL,
  seller_id              uuid NOT NULL,
  variant_id             uuid NOT NULL,
  quantity               int  NOT NULL CHECK (quantity > 0),
  availability_checked_at timestamptz NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),

  -- INVARIANT (section 8.1 of the PRD, C6) - a cart contains items from
  -- exactly one seller, ENFORCED WHEN THE SECOND SELLER'S ITEM IS ADDED, as a
  -- pair of foreign keys rather than a service check a second endpoint could
  -- bypass.
  CONSTRAINT cart_line_single_seller
    FOREIGN KEY (cart_id, seller_id) REFERENCES core.cart (id, seller_id),
  CONSTRAINT cart_line_variant_seller
    FOREIGN KEY (variant_id, seller_id) REFERENCES core.product_variant (id, seller_id)
);

CREATE INDEX idx_cart_line_by_cart ON core.cart_line (cart_id);

-- cart.seller_id is set by a trigger on the first line and nulled when the
-- last is removed (section 11.2). BEFORE INSERT, so the composite FK's
-- end-of-statement check sees the updated parent: first line stamps the cart,
-- a second seller's line then fails cart_line_single_seller at INSERT.
CREATE FUNCTION core.fn_cart_first_line() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE core.cart SET seller_id = NEW.seller_id, updated_at = now()
   WHERE id = NEW.cart_id AND seller_id IS NULL;
  RETURN NEW;
END $fn$;

CREATE FUNCTION core.fn_cart_last_line() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE core.cart c SET seller_id = NULL, updated_at = now()
   WHERE c.id = OLD.cart_id
     AND NOT EXISTS (SELECT 1 FROM core.cart_line l WHERE l.cart_id = OLD.cart_id);
  RETURN OLD;
END $fn$;

CREATE TRIGGER trg_cart_first_line
  BEFORE INSERT ON core.cart_line
  FOR EACH ROW EXECUTE FUNCTION core.fn_cart_first_line();
CREATE TRIGGER trg_cart_last_line
  AFTER DELETE ON core.cart_line
  FOR EACH ROW EXECUTE FUNCTION core.fn_cart_last_line();

-- INVARIANT (section 11.2) - adding an item to the cart has NO effect on
-- stock. No trigger on cart_line touches stock_event. Stated because it is
-- the natural instinct when generating this code.

-- ---------------------------------------------------------------------------
-- 2. core."order" (section 12.1) - plus R12's ready_at
-- ---------------------------------------------------------------------------
CREATE TABLE core."order" (
  id                  uuid PRIMARY KEY,
  market_id           uuid NOT NULL REFERENCES core.market(id),
  seller_id           uuid NOT NULL REFERENCES core.seller(id),
  buyer_account_id    uuid NOT NULL REFERENCES core.account(id),
  state               core.order_state NOT NULL DEFAULT 'CREATED',
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  clock_stopped_at    timestamptz NULL,
  fulfilment_deadline timestamptz NULL,
  total_minor         bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  total_currency      core.currency_code NOT NULL,
  display_currency    core.currency_code NOT NULL,
  fx_rate             numeric NULL,
  fx_rate_captured_at timestamptz NULL,
  payout_snapshot_id  uuid NULL,          -- FK added by migration 10
  seller_level_at_order core.trust_level NOT NULL DEFAULT 'NEW',
  ready_at            timestamptz NULL,
  ready_marked_by_account_id uuid NULL REFERENCES core.account(id),

  -- Composite-FK anchors for the handoff and review rules (sections 14.2, 15).
  CONSTRAINT order_id_buyer  UNIQUE (id, buyer_account_id),
  CONSTRAINT order_id_seller UNIQUE (id, seller_id),

  -- INVARIANT (section 12.4) - the expiry clock stops permanently at
  -- PAYMENT_CONFIRMED, and a paid order is never in the expiry sweep's
  -- working set (clock_stopped_at IS NULL is the sweep's whole predicate).
  --
  -- NOT THE DOCUMENT'S PRINTED CHECK - register D-15. Section 12.4 prints a
  -- bidirectional equality, and the document's own ratified row 17
  -- (PAYMENT_CONFIRMED -> CANCELLED_BY_SELLER, R-3: every line REFUNDED)
  -- violates it: the cancelled order leaves the stopped-clock state set while
  -- its clock - correctly, permanently - stays stopped. Found by the CP-5
  -- smoke, loudly: the full-refund path raised on the constraint. The
  -- weakened form below keeps both real invariants (paid implies stopped;
  -- pre-payment and expired imply running) and lets the two terminal
  -- cancelled states carry either clock value, because both entry paths -
  -- before payment and after full refund - are ratified.
  CONSTRAINT order_clock_consistency CHECK (
    CASE
      WHEN state IN ('PAYMENT_CONFIRMED','HANDED_OFF','COMPLETED')
        THEN clock_stopped_at IS NOT NULL
      WHEN state IN ('CREATED','NOTIFIED','PAYMENT_SUBMITTED','EXPIRED_UNCLAIMED')
        THEN clock_stopped_at IS NULL
      ELSE true   -- CANCELLED_BY_BUYER / CANCELLED_BY_SELLER: both paths ratified
    END
  )
);

-- The expiry sweep's whole working set (section 27).
CREATE INDEX idx_order_expiry_sweep
  ON core."order" (expires_at) WHERE clock_stopped_at IS NULL;
CREATE INDEX idx_order_by_seller ON core."order" (seller_id, created_at DESC);
CREATE INDEX idx_order_by_buyer  ON core."order" (buyer_account_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. core.reservation (section 12.1)
-- ---------------------------------------------------------------------------
CREATE TABLE core.reservation (
  id                  uuid PRIMARY KEY,
  order_id            uuid NOT NULL,
  variant_id          uuid NOT NULL,
  seller_id           uuid NOT NULL,
  buyer_account_id    uuid NOT NULL,
  quantity            int NOT NULL CHECK (quantity > 0),
  unit_price_minor    bigint NOT NULL CHECK (unit_price_minor >= 0),
  unit_price_currency core.currency_code NOT NULL,
  state               core.reservation_state NOT NULL DEFAULT 'ACTIVE',
  cancelled_at        timestamptz NULL,
  cancelled_by        core.cancelled_by NULL,
  cancellation_reason text NULL,
  penalty_exempt      boolean NOT NULL DEFAULT false,
  active_window       tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- The anchor migration 12's claim_line_belongs_to_order needs.
  CONSTRAINT reservation_order_id UNIQUE (order_id, id),

  -- A line's seller and buyer are its order's seller and buyer, structurally.
  CONSTRAINT reservation_order_seller
    FOREIGN KEY (order_id, seller_id) REFERENCES core."order" (id, seller_id),
  CONSTRAINT reservation_order_buyer
    FOREIGN KEY (order_id, buyer_account_id) REFERENCES core."order" (id, buyer_account_id),
  CONSTRAINT reservation_variant_seller
    FOREIGN KEY (variant_id, seller_id) REFERENCES core.product_variant (id, seller_id),

  -- INVARIANT (section 12.1) - duplicate live reservations are structurally
  -- impossible. The PRD says "unique constraint"; a time window needs gist,
  -- which is why btree_gist is a hard hosting requirement.
  CONSTRAINT reservation_no_duplicate_active EXCLUDE USING gist (
    seller_id WITH =, buyer_account_id WITH =, variant_id WITH =,
    active_window WITH &&
  ) WHERE (state = 'ACTIVE')
);

CREATE INDEX idx_reservation_by_order ON core.reservation (order_id);

-- INVARIANT (section 12.1) - the captured unit price is immutable for the
-- life of the order. Price is the most common source of dispute, and the
-- buyer agreed to a specific number.
CREATE FUNCTION core.fn_reservation_price_write_once() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.unit_price_minor    IS DISTINCT FROM OLD.unit_price_minor
     OR NEW.unit_price_currency IS DISTINCT FROM OLD.unit_price_currency THEN
    RAISE EXCEPTION 'reservation price is captured at order creation and immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_reservation_price_write_once
  BEFORE UPDATE ON core.reservation
  FOR EACH ROW EXECUTE FUNCTION core.fn_reservation_price_write_once();

-- ---------------------------------------------------------------------------
-- 4. The legal transition tables, SEEDED RATIFIED (sections 12.2, 12.2.1)
--
-- Data-driven machines, writable only by adulis_migrate: a legal set the
-- application can INSERT into is a state machine that widens at runtime with
-- no migration and no diff.
--
-- ratified_at is a FIXED LITERAL - v1.10's baseline date - so two clean
-- builds are byte-identical; ratified_by names the ratifying ruling.
-- ---------------------------------------------------------------------------
CREATE TABLE core.order_state_transition_legal (
  from_state   core.order_state NOT NULL,
  to_state     core.order_state NOT NULL,
  written_by   text NOT NULL,
  ratified_at  timestamptz,
  ratified_by  text,
  PRIMARY KEY (from_state, to_state)
);

CREATE TABLE core.reservation_state_transition_legal (
  from_state   core.reservation_state NOT NULL,
  to_state     core.reservation_state NOT NULL,
  written_by   text NOT NULL,
  ratified_at  timestamptz,
  ratified_by  text,
  PRIMARY KEY (from_state, to_state)
);

INSERT INTO core.order_state_transition_legal
  (from_state, to_state, written_by, ratified_at, ratified_by) VALUES
  ('CREATED',           'NOTIFIED',            'seller notification job',                  '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('CREATED',           'PAYMENT_SUBMITTED',   'buyer uploads evidence',                   '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('NOTIFIED',          'PAYMENT_SUBMITTED',   'buyer uploads evidence',                   '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('CREATED',           'EXPIRED_UNCLAIMED',   'expiry sweep',                             '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('NOTIFIED',          'EXPIRED_UNCLAIMED',   'expiry sweep',                             '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED',   'seller confirms; sets clock_stopped_at',   '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('PAYMENT_SUBMITTED', 'NOTIFIED',            'seller rejects the evidence',              '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'' (W6)'),
  ('PAYMENT_CONFIRMED', 'HANDED_OFF',          'scan or tapped confirmation',              '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('HANDED_OFF',        'COMPLETED',           'settlement',                               '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('EXPIRED_UNCLAIMED', 'HANDED_OFF',          'late in-window scan (section 11.4)',       '2026-08-27T00:00:00Z', 'R-1 ratified'),
  ('CREATED',           'CANCELLED_BY_BUYER',  'derived from lines',                       '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('NOTIFIED',          'CANCELLED_BY_BUYER',  'derived from lines',                       '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('PAYMENT_SUBMITTED', 'CANCELLED_BY_BUYER',  'derived from lines',                       '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('CREATED',           'CANCELLED_BY_SELLER', 'derived from lines',                       '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('NOTIFIED',          'CANCELLED_BY_SELLER', 'derived from lines',                       '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('PAYMENT_SUBMITTED', 'CANCELLED_BY_SELLER', 'derived from lines',                       '2026-08-27T00:00:00Z', 'R-3 ratified'),
  ('PAYMENT_CONFIRMED', 'CANCELLED_BY_SELLER', 'derived - every line REFUNDED',            '2026-08-27T00:00:00Z', 'R-3 ratified');

INSERT INTO core.reservation_state_transition_legal
  (from_state, to_state, written_by, ratified_at, ratified_by) VALUES
  ('ACTIVE',  'FULFILLED',           'order reaches COMPLETED',                       '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('ACTIVE',  'CANCELLED_BY_BUYER',  'buyer cancels the line',                        '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('ACTIVE',  'CANCELLED_BY_SELLER', 'seller cancels before PAYMENT_CONFIRMED',       '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('ACTIVE',  'REFUNDED',            'seller cancels after PAYMENT_CONFIRMED (12.5)', '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('ACTIVE',  'EXPIRED',             'order expires unclaimed',                       '2026-08-27T00:00:00Z', 'ADU-CON-01 R8'''),
  ('EXPIRED', 'FULFILLED',           'late in-window scan',                           '2026-08-27T00:00:00Z', 'R-1 ratified');

-- THERE IS NO PAYMENT_SUBMITTED -> EXPIRED_UNCLAIMED ROW. Its absence is
-- load-bearing: a submitted payment never expires. Section 12.4a is what
-- happens instead, and rows 10 and 23 (EXPIRED_* -> completion) are R-1's
-- doorway-handoff recovery.

-- ---------------------------------------------------------------------------
-- 5. The guards - FAIL-CLOSED, both machines - and the transition log
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_guard_order_transition() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state
     AND NOT EXISTS (SELECT 1 FROM core.order_state_transition_legal
                      WHERE from_state = OLD.state AND to_state = NEW.state) THEN
    RAISE EXCEPTION 'Illegal order transition % -> %', OLD.state, NEW.state
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $fn$;

CREATE FUNCTION core.fn_guard_reservation_transition() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state
     AND NOT EXISTS (SELECT 1 FROM core.reservation_state_transition_legal
                      WHERE from_state = OLD.state AND to_state = NEW.state) THEN
    RAISE EXCEPTION 'Illegal reservation transition % -> %', OLD.state, NEW.state
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_guard_order_transition
  BEFORE UPDATE ON core."order"
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_order_transition();
CREATE TRIGGER trg_guard_reservation_transition
  BEFORE UPDATE ON core.reservation
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_reservation_transition();

-- Every transition writes the append-only log - the "order state transitions"
-- evidence section 16 attaches to a claim. actor and reason ride the
-- established transaction-local settings: the writer that needs a reason
-- (R-1's LATE_SYNC_RECOVERY) sets adulis.transition_reason with
-- set_config(..., true) in the same transaction. Unset reads as NULL, which
-- is the ordinary case.
CREATE TABLE core.order_state_transition (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES core."order"(id),
  from_state  core.order_state NOT NULL,
  to_state    core.order_state NOT NULL,
  actor_account_id uuid NULL,
  reason      text NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_transition_by_order
  ON core.order_state_transition (order_id, occurred_at);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.order_state_transition
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE FUNCTION core.fn_log_order_transition() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    INSERT INTO core.order_state_transition
      (order_id, from_state, to_state, actor_account_id, reason)
    VALUES (
      NEW.id, OLD.state, NEW.state,
      nullif(current_setting('adulis.account_id', true), '')::uuid,
      nullif(current_setting('adulis.transition_reason', true), '')
    );
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_log_order_transition
  AFTER UPDATE ON core."order"
  FOR EACH ROW EXECUTE FUNCTION core.fn_log_order_transition();

-- INVARIANT (section 12.2.1) - a market cannot go live while any transition
-- row is unratified. A review that blocks a release is a gate; a review that
-- is merely scheduled is a hope.
CREATE FUNCTION core.fn_guard_market_live() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.is_live AND NOT OLD.is_live
     AND EXISTS (SELECT 1 FROM core.order_state_transition_legal WHERE ratified_at IS NULL
                 UNION ALL
                 SELECT 1 FROM core.reservation_state_transition_legal WHERE ratified_at IS NULL) THEN
    RAISE EXCEPTION 'State machine not ratified; market cannot go live'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_guard_market_live
  BEFORE UPDATE ON core.market
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_market_live();

-- ---------------------------------------------------------------------------
-- 6. Derived order-level state, recalculated totals, automatic penalty
--    exemption (sections 12.2, 12.5)
--
-- Order-level terminal states are DERIVED from the line states, never written
-- independently. R-3's ruling: CANCELLED_BY_SELLER whenever any line was
-- seller-cancelled or refunded, because the seller's cancellation is what
-- caused the buyer's.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_derive_order_state() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_total    bigint;
  v_lines    int;
  v_terminal int;
  v_seller_caused int;
  v_order    core."order";
BEGIN
  IF NEW.state IS NOT DISTINCT FROM OLD.state THEN
    RETURN NEW;
  END IF;

  -- Recalculate the total from surviving lines on EVERY line state change.
  SELECT coalesce(sum(unit_price_minor * quantity) FILTER (WHERE state IN ('ACTIVE','FULFILLED')), 0),
         count(*),
         count(*) FILTER (WHERE state <> 'ACTIVE'),
         count(*) FILTER (WHERE state IN ('CANCELLED_BY_SELLER','REFUNDED'))
    INTO v_total, v_lines, v_terminal, v_seller_caused
    FROM core.reservation
   WHERE order_id = NEW.order_id;

  UPDATE core."order" SET total_minor = v_total WHERE id = NEW.order_id;

  -- Every line terminal in a CANCELLED direction -> the order follows.
  -- FULFILLED lines are terminal too, but a fully-fulfilled order's state is
  -- COMPLETED and is written by the settlement path, not derived here.
  IF v_terminal = v_lines THEN
    SELECT * INTO v_order FROM core."order" WHERE id = NEW.order_id;
    IF v_order.state NOT IN ('COMPLETED','HANDED_OFF','EXPIRED_UNCLAIMED',
                             'CANCELLED_BY_BUYER','CANCELLED_BY_SELLER')
       AND NOT EXISTS (SELECT 1 FROM core.reservation
                        WHERE order_id = NEW.order_id AND state = 'FULFILLED') THEN
      UPDATE core."order"
         SET state = CASE WHEN v_seller_caused > 0
                          THEN 'CANCELLED_BY_SELLER'::core.order_state
                          ELSE 'CANCELLED_BY_BUYER'::core.order_state END
       WHERE id = NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_derive_order_state
  AFTER UPDATE OF state ON core.reservation
  FOR EACH ROW EXECUTE FUNCTION core.fn_derive_order_state();

-- Section 12.5: the buyer may cancel the remainder WITHOUT PENALTY after a
-- seller cancellation on the same order. Automatic, never a support request.
CREATE FUNCTION core.fn_penalty_exempt() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.state = 'CANCELLED_BY_BUYER' AND OLD.state = 'ACTIVE'
     AND EXISTS (SELECT 1 FROM core.reservation
                  WHERE order_id = NEW.order_id AND id <> NEW.id
                    AND state IN ('CANCELLED_BY_SELLER','REFUNDED')) THEN
    NEW.penalty_exempt := true;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_penalty_exempt
  BEFORE UPDATE ON core.reservation
  FOR EACH ROW EXECUTE FUNCTION core.fn_penalty_exempt();

-- Cancellation-rate stats, O(1) per R16 (counters live on the stats row).
CREATE FUNCTION core.fn_stats_on_reservation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
BEGIN
  IF NEW.state <> 'ACTIVE' AND OLD.state = 'ACTIVE' THEN
    UPDATE core.seller_public_stats
       SET reservations_terminal_count  = reservations_terminal_count + 1,
           reservations_cancelled_count = reservations_cancelled_count
             + CASE WHEN NEW.state IN ('CANCELLED_BY_SELLER','REFUNDED') THEN 1 ELSE 0 END,
           cancellation_rate = CASE
             WHEN reservations_terminal_count + 1 = 0 THEN NULL
             ELSE round((reservations_cancelled_count
                    + CASE WHEN NEW.state IN ('CANCELLED_BY_SELLER','REFUNDED') THEN 1 ELSE 0 END)::numeric
                  / (reservations_terminal_count + 1), 4) END,
           updated_at = now()
     WHERE seller_id = NEW.seller_id;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_stats_on_reservation
  AFTER UPDATE OF state ON core.reservation
  FOR EACH ROW EXECUTE FUNCTION core.fn_stats_on_reservation();

-- ---------------------------------------------------------------------------
-- 7. Stock-event integrity that had to wait for these tables (migration 07's
--    header records the deferral), and A3.2 in full
-- ---------------------------------------------------------------------------
ALTER TABLE core.stock_event
  ADD CONSTRAINT stock_event_order
    FOREIGN KEY (order_id) REFERENCES core."order"(id),
  ADD CONSTRAINT stock_event_reservation
    FOREIGN KEY (reservation_id) REFERENCES core.reservation(id);

-- A3.2, both halves. Release reasons: {ORDER_EXPIRED, LINE_CANCELLED} - the
-- two whose semantic is stock returning from an order (register D-04).
CREATE UNIQUE INDEX stock_release_once
  ON core.stock_event (reservation_id, reason)
  WHERE reason IN ('ORDER_EXPIRED', 'LINE_CANCELLED');

ALTER TABLE core.stock_event ADD CONSTRAINT release_has_a_line CHECK (
  reason NOT IN ('ORDER_EXPIRED', 'LINE_CANCELLED') OR reservation_id IS NOT NULL
);

-- ---------------------------------------------------------------------------
-- 8. Remaining order-adjacent tables
-- ---------------------------------------------------------------------------
CREATE TABLE core.order_qr_token (
  id                  uuid PRIMARY KEY,
  order_id            uuid NOT NULL UNIQUE REFERENCES core."order"(id),
  nonce               uuid NOT NULL UNIQUE,
  signing_key_version int NOT NULL,
  issued_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.order_qr_token IS
  'Section 12.6 - one per order: one scan per order regardless of item count. '
  'The nonce UNIQUE is the replay rejection (section 14.2), the cheapest and '
  'most reliable available.';

CREATE TABLE core.refund (
  id                       uuid PRIMARY KEY,
  reservation_id           uuid NOT NULL REFERENCES core.reservation(id),
  amount_minor             bigint NOT NULL CHECK (amount_minor >= 0),
  amount_currency          core.currency_code NOT NULL,
  reported_by_seller_at    timestamptz NULL,
  acknowledged_by_buyer_at timestamptz NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN core.refund.amount_minor IS
  'Section 12.5 - THE CAPTURED AMOUNT, never a recomputed one. The seller '
  'owes the line''s price as agreed, not as it stands today.';

CREATE TABLE core.buyer_cancellation_counter (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_account_id uuid NOT NULL REFERENCES core.account(id),
  seller_id        uuid NULL REFERENCES core.seller(id),
  count            int NOT NULL DEFAULT 0,
  window_start     timestamptz NOT NULL DEFAULT now(),
  cooldown_until   timestamptz NULL
);

CREATE UNIQUE INDEX cancellation_counter_per_seller
  ON core.buyer_cancellation_counter (buyer_account_id, seller_id)
  WHERE seller_id IS NOT NULL;
CREATE UNIQUE INDEX cancellation_counter_cross_seller
  ON core.buyer_cancellation_counter (buyer_account_id)
  WHERE seller_id IS NULL;

COMMENT ON TABLE core.buyer_cancellation_counter IS
  'Section 12.7. The escalation ladder is timing_config, not literals; the '
  'expiry-vs-cancel multipliers are named as configuration and HAVE NO COLUMN '
  'ANYWHERE (register D-09) - the incrementing job cannot ship until they are '
  'ruled.';

-- D6's deferral lands: the courier assignment table, with the RLS policy it
-- belongs to.
CREATE TABLE core.order_courier_assignment (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES core."order"(id),
  courier_account_id uuid NOT NULL REFERENCES core.account(id),
  assigned_at        timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz NULL
);

CREATE INDEX idx_courier_assignment_by_courier
  ON core.order_courier_assignment (courier_account_id) WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- 9. Row-level security on core."order" (section 6.9)
--
-- The doc's SELECT policy is verbatim, and it FAILS CLOSED: with
-- adulis.actor_role unset, `NULL <> 'COURIER'` is NULL and no rows return.
-- That is correct - every request sets the three adulis.* settings
-- transaction-locally, and a request that did not is a request with no
-- business reading orders.
--
-- The write policies below are an implementation necessity the document does
-- not spell: once RLS is enabled, a command with NO applicable policy is
-- denied, so the app's INSERT/UPDATE and the worker's sweep each need one.
-- They deliberately add no predicate - writes are gated by the transition
-- guard and fn_has_permission, and a second gate here would be a second
-- place to get it wrong. NO second SELECT-capable policy exists for
-- adulis_app: permissive policies OR together, and a USING(true) FOR ALL
-- would hand couriers every order in the table.
-- ---------------------------------------------------------------------------
ALTER TABLE core."order" ENABLE ROW LEVEL SECURITY;

CREATE POLICY courier_assigned_orders ON core."order"
  FOR SELECT TO adulis_app
  USING (
    current_setting('adulis.actor_role', true) <> 'COURIER'
    OR EXISTS (
      SELECT 1 FROM core.order_courier_assignment a
      WHERE a.order_id = "order".id
        AND a.courier_account_id = current_setting('adulis.account_id', true)::uuid
        AND a.ended_at IS NULL
    )
  );

CREATE POLICY order_app_insert ON core."order"
  FOR INSERT TO adulis_app WITH CHECK (true);
CREATE POLICY order_app_update ON core."order"
  FOR UPDATE TO adulis_app USING (true) WITH CHECK (true);

CREATE POLICY order_ops_select ON core."order"
  FOR SELECT TO adulis_readonly, adulis_migrate, adulis_jobs USING (true);
CREATE POLICY order_jobs_update ON core."order"
  FOR UPDATE TO adulis_jobs USING (true) WITH CHECK (true);

-- The SECURITY DEFINER functions (fn_mark_order_ready here, fn_create_order in
-- migration 10) execute as adulis_migrate, and RLS denies any command with no
-- applicable policy - a definer function that cannot write the table it was
-- built to write fails at its first real call, not at review.
CREATE POLICY order_migrate_insert ON core."order"
  FOR INSERT TO adulis_migrate WITH CHECK (true);
CREATE POLICY order_migrate_update ON core."order"
  FOR UPDATE TO adulis_migrate USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 10. Mark ready - R12, body from section 12.6a
--
-- One departure from the printed body, REGISTER D-14: the doc's
-- `RETURNING ... INTO STRICT` raises NO_DATA_FOUND on a second call, while
-- its own invariant line says "marking ready is idempotent and the second
-- call is a no-op". The API contract (v1.6 section 12.11) agrees with the
-- invariant. The claim wins over the listing: a repeat call returns the
-- existing ready_at; a wrong-state call raises (the mapper's 409
-- ORDER_NOT_READYABLE).
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_mark_order_ready(p_order_id uuid, p_actor uuid, p_seller uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_ready timestamptz;
        v_state core.order_state;
BEGIN
  PERFORM core.fn_has_permission(p_actor, p_seller, 'seller.order_ready:update',
                                 current_setting('adulis.audience')::core.session_audience);

  SELECT state, ready_at INTO v_state, v_ready
    FROM core."order"
   WHERE id = p_order_id AND seller_id = p_seller
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';   -- not this seller's order
  END IF;
  IF v_ready IS NOT NULL THEN
    RETURN v_ready;                    -- idempotent: a second call is a no-op
  END IF;
  IF v_state NOT IN ('PAYMENT_CONFIRMED', 'HANDED_OFF') THEN
    RAISE EXCEPTION 'order is not in a readyable state (%)', v_state
      USING ERRCODE = 'restrict_violation';
  END IF;

  UPDATE core."order"
     SET ready_at = now(), ready_marked_by_account_id = p_actor
   WHERE id = p_order_id
  RETURNING ready_at INTO v_ready;
  -- Courier notification: enqueued by the notification machinery once
  -- migration 14 exists; marking ready never moves the order's state.
  RETURN v_ready;
END $fn$;

ALTER FUNCTION core.fn_mark_order_ready(uuid, uuid, uuid) OWNER TO adulis_migrate;
GRANT SELECT, UPDATE ON core."order" TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_mark_order_ready(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_mark_order_ready(uuid, uuid, uuid) TO adulis_app;

-- ---------------------------------------------------------------------------
-- 11. Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  core.cart, core.cart_line
TO adulis_app;

GRANT SELECT, INSERT, UPDATE ON
  core."order", core.reservation, core.buyer_cancellation_counter,
  core.order_courier_assignment
TO adulis_app;

GRANT SELECT, INSERT, UPDATE ON core.refund          TO adulis_app;
GRANT SELECT, INSERT         ON core.order_qr_token  TO adulis_app;

-- The transition log: insert-only for every writer, mutation forbidden twice.
GRANT SELECT, INSERT ON core.order_state_transition TO adulis_app, adulis_jobs;
REVOKE UPDATE, DELETE ON core.order_state_transition FROM adulis_app, adulis_jobs;

-- The legal tables: readable, never writable at runtime (section 12.2).
GRANT SELECT ON core.order_state_transition_legal,
                core.reservation_state_transition_legal
  TO adulis_app, adulis_readonly, adulis_jobs;
REVOKE INSERT, UPDATE, DELETE ON core.order_state_transition_legal       FROM adulis_app;
REVOKE INSERT, UPDATE, DELETE ON core.reservation_state_transition_legal FROM adulis_app;

-- The worker: expiry sweep and dispatch read/update orders and lines, write
-- release events.
GRANT SELECT, UPDATE ON core.reservation  TO adulis_jobs;
GRANT SELECT, INSERT ON core.stock_event  TO adulis_jobs;
GRANT SELECT         ON core.cart, core.cart_line, core.order_qr_token,
                        core.refund, core.buyer_cancellation_counter,
                        core.order_courier_assignment TO adulis_jobs;
GRANT SELECT, INSERT, UPDATE ON core.buyer_cancellation_counter TO adulis_jobs;

GRANT SELECT ON core.cart, core.cart_line, core."order", core.reservation,
                core.order_state_transition, core.order_qr_token, core.refund,
                core.buyer_cancellation_counter, core.order_courier_assignment
  TO adulis_readonly;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 09 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
