-- ===========================================================================
-- MIGRATION 07 - STOCK EVENTS AND THE DERIVED-COUNT TRIGGERS
--
-- Source: ADU-DB-01 v1.10 section 28 item 7. Transcribed from sections 10.1
-- and 10.2.
--
-- ONE OF THE THREE MIGRATIONS TO READ BY HAND, and the concurrency-critical
-- one. Section 28: "Migration 7's stock triggers are the concurrency-critical
-- path ADU-PROJ-01 section 13.5 flags... Everywhere else, a mistake raises an
-- exception; in those two, IT PRODUCES WRONG DATA."
--
-- Section 10.1 calls this pair "the single most important pair of triggers in
-- the schema": ADU-PROJ-01 section 13.5 names "AI-generated code wrong under
-- concurrency" as a live risk, and stock decrement under concurrency is where
-- it would first show.
--
-- One table (append-only), two trigger functions, one view.
--
-- A3.1 - THE TRIGGER IS BEFORE INSERT, AND THE AMENDMENT RATIFIES IT.
--
-- Section 10.1's prose says AFTER INSERT. The function body it then gives
-- assigns NEW.resulting_count and returns NEW, and BOTH ARE INERT IN AN AFTER
-- TRIGGER: resulting_count would have been NULL on every stock event ever
-- written, and NOTHING WOULD HAVE RAISED - the column is nullable and no
-- constraint reads it. The previous revision of this migration used BEFORE and
-- reported the contradiction; A3.1 confirms it and corrects section 10.1.
--
-- A3.1 ADDS AN ARGUMENT THIS MIGRATION DID NOT HAVE, and it is the better one:
--
--   "BEFORE is not merely what the body needs; it is what the DESIGN needs. The
--    UPDATE on product_variant fires before the event row is written, so
--    CHECK (stock_count >= 0) raises BEFORE a stock event exists claiming a
--    decrement that did not happen. Under AFTER, the event row is already in
--    flight when the constraint fires - same transaction, same rollback, but
--    the ordering that makes the audit trail trustworthy is the BEFORE one."
--
-- What the defect actually was: resulting_count exists so that a stock event
-- carries the count it produced, which is what makes the log auditable without
-- replaying it. A silent NULL there is the same class of failure as the
-- materialized view - it works, it is fast, and the property it was built for
-- is absent.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.stock_event (section 10.1) - APPEND-ONLY
--
-- order_id AND reservation_id ARE BARE uuid WITH NO FOREIGN KEY, and unlike the
-- register's D1 and D2 this one is temporary: core."order" and
-- core.reservation arrive in migration 09, which ADDS both constraints. The
-- columns are declared here because the table is, and the integrity is deferred
-- by exactly two migrations rather than abandoned.
-- ---------------------------------------------------------------------------
CREATE TABLE core.stock_event (
  id               uuid PRIMARY KEY,
  variant_id       uuid NOT NULL,
  seller_id        uuid NOT NULL,
  delta            int NOT NULL,
  reason           core.stock_event_reason NOT NULL,
  order_id         uuid NULL,     -- FK added by migration 09
  reservation_id   uuid NULL,     -- FK added by migration 09
  actor_account_id uuid NULL REFERENCES core.account(id),
  resulting_count  int NULL,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- THIS COMPOSITE FK IS THIS MIGRATION'S, NOT THE DOCUMENT'S. Section 10.1
  -- lists variant_id and seller_id and states no relationship between them.
  -- Every other seller-scoped table in sections 9-12 anchors on
  -- UNIQUE (id, seller_id) for exactly this reason, and a stock event whose
  -- seller disagrees with its variant's is a cross-seller write that no later
  -- check would notice. It cannot reject correct data. Reported.
  CONSTRAINT stock_event_variant_seller
    FOREIGN KEY (variant_id, seller_id) REFERENCES core.product_variant (id, seller_id)
);

-- Section 27, hot writes.
CREATE INDEX idx_stock_event_variant ON core.stock_event (variant_id, occurred_at DESC);
CREATE INDEX idx_stock_event_order   ON core.stock_event (order_id) WHERE order_id IS NOT NULL;

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.stock_event
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

COMMENT ON TABLE core.stock_event IS
  'INVARIANT (section 10.1, PRD section 7) - stock is NEVER mutated without a '
  'corresponding StockEvent row. The strongest available form of that is used: '
  'product_variant.stock_count is not writable at all, so the event is not a '
  'record OF the change, it is the CAUSE of it.';

COMMENT ON COLUMN core.stock_event.resulting_count IS
  'Written by core.fn_apply_stock_event as the count AFTER this event, which is '
  'what makes the log auditable without replaying it. It is populated only '
  'because the trigger is BEFORE INSERT - see this migration''s header.';

-- ---------------------------------------------------------------------------
-- 2. The pair (section 10.1, both bodies transcribed verbatim)
--
-- fn_apply_stock_event is the only writer of stock_count. fn_guard_stock_count
-- refuses every other one, and the two communicate through a transaction-local
-- setting rather than a column, so nothing durable records that a write was
-- "allowed" and no row can be forged into looking allowed.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_apply_stock_event() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('adulis.stock_write', 'on', true);
  UPDATE core.product_variant
     SET stock_count = stock_count + NEW.delta
   WHERE id = NEW.variant_id
   RETURNING stock_count INTO NEW.resulting_count;
  PERFORM set_config('adulis.stock_write', 'off', true);
  RETURN NEW;
END $fn$;

CREATE FUNCTION core.fn_guard_stock_count() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.stock_count IS DISTINCT FROM OLD.stock_count
     AND coalesce(current_setting('adulis.stock_write', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'stock_count is derived from core.stock_event'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $fn$;

-- BEFORE INSERT, not AFTER - see the header. RETURNING ... INTO NEW.* is only
-- meaningful while the row is still being formed.
CREATE TRIGGER trg_apply_stock_event
  BEFORE INSERT ON core.stock_event
  FOR EACH ROW EXECUTE FUNCTION core.fn_apply_stock_event();

CREATE TRIGGER trg_guard_stock_count
  BEFORE UPDATE ON core.product_variant
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_stock_count();

COMMENT ON FUNCTION core.fn_apply_stock_event IS
  'The ONLY writer of core.product_variant.stock_count. Two properties are '
  'worth naming because neither is obvious from the four lines of body. '
  'FIRST, CONCURRENCY: "stock_count = stock_count + NEW.delta" is read and '
  'written inside one UPDATE, which takes a row lock, so two concurrent '
  'decrements serialise rather than interleave - a read-then-write in the '
  'application is the lost update this shape does not admit. '
  'SECOND, OVERSELLING IS A TRANSACTION FAILURE: CHECK (stock_count >= 0) on '
  'the variant fires inside this UPDATE, so the losing transaction rolls back '
  'whole rather than leaving a negative count or a phantom event.';

COMMENT ON FUNCTION core.fn_guard_stock_count IS
  'Refuses any change to stock_count that did not come from '
  'fn_apply_stock_event. The permission travels as a TRANSACTION-LOCAL setting '
  '- set_config(..., true) - so it cannot leak between pooled connections and '
  'cannot be forged by a row. Section 6.1 uses the same mechanism for the RLS '
  'context, and for the same reason.';

-- ---------------------------------------------------------------------------
-- 3. core.v_stock_confidence (section 10.2, transcribed verbatim)
--
-- "A view rather than a column because a stored level drifts the moment a job
-- misses a run, and section 13.3's graduated consequences - up to blocking
-- broadcasts - would then fire against a stale number."
--
-- ADU-VAL-01 item 3.6 records that the four intervals are HARD-CODED here while
-- every comparable interval is a timing_config column, and asks for either a
-- move or a reason. They are transcribed as literals because that is what
-- section 10.2 gives; the register already holds the question, so per work
-- order T2 section 1.1 it is not reported again as a gap.
-- ---------------------------------------------------------------------------
CREATE VIEW core.v_stock_confidence AS
SELECT v.id AS variant_id,
       v.stock_confirmed_at,
       CASE
         WHEN now() - v.stock_confirmed_at < interval '24 hours' THEN 1
         WHEN now() - v.stock_confirmed_at < interval '48 hours' THEN 2
         WHEN now() - v.stock_confirmed_at < interval '72 hours' THEN 3
         WHEN now() - v.stock_confirmed_at < interval '7 days'  THEN 4
         ELSE 5
       END AS confidence_level
FROM core.product_variant v;

-- ---------------------------------------------------------------------------
-- 4. THE RELEASE INDEX IS DEFERRED TO MIGRATION 09 - A3.2
--
-- Section 12.4: "INVARIANT - stock release on expiry is idempotent. A PARTIAL
-- UNIQUE INDEX ON (order_id, reason) for release reasons."
--
-- The previous revision reported that scope as unworkable. A3.2 confirms it,
-- AND FINDS IT WORSE THAN A BROKEN CONSTRAINT:
--
--   "Section 12.5 requires that each cancelled line writes its own stock_event
--    and that cancelling two of three lines is two cancellations. On a
--    three-line order the second line's release would collide - and IF THE JOB
--    RELEASES WITH ON CONFLICT DO NOTHING, AS AN IDEMPOTENT JOB SHOULD, IT
--    WOULD SILENTLY NOT RETURN THE STOCK. Goods cancelled, stock never
--    released, and no error anywhere."
--
-- RULING A3.2 - the index is (reservation_id, reason) over release reasons,
-- AND A CHECK REQUIRES THE ANCHOR:
--
--   CREATE UNIQUE INDEX stock_release_once
--     ON core.stock_event (reservation_id, reason)
--    WHERE reason IN ( /* release reasons */ );
--
--   ALTER TABLE core.stock_event ADD CONSTRAINT release_has_a_line CHECK (
--     reason NOT IN ( /* release reasons */ ) OR reservation_id IS NOT NULL
--   );
--
-- THE CHECK IS THE PART THIS MIGRATION'S PROPOSED SCOPE DID NOT HAVE, and it
-- is the half that matters: reservation_id is nullable - a seller's manual
-- adjustment has no line - and A PARTIAL UNIQUE INDEX DOES NOT CONSTRAIN ROWS
-- WHOSE INDEXED COLUMN IS NULL. Without the CHECK, a release reason written
-- with a null reservation_id escapes the index entirely, and the idempotency
-- guarantee has a hole exactly where it matters.
--
-- Both land in MIGRATION 09, together, because core.reservation does not exist
-- until then. Recorded here so the deferral cannot be lost between migrations.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. Grants
--
-- Append-only: the trigger above AND the REVOKE below, "two mechanisms because
-- the first is invisible in a migration diff and the second is invisible in a
-- permissions audit" (section 4).
--
-- NOTE that adulis_app keeps UPDATE on core.product_variant - it must, to write
-- price, status and stock_confirmed_at. stock_count is protected by the guard
-- trigger rather than by the grant, because a column-level REVOKE would also
-- have to be maintained against every future column.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT ON core.stock_event TO adulis_app;
REVOKE UPDATE, DELETE ON core.stock_event FROM adulis_app;

GRANT SELECT ON core.stock_event, core.v_stock_confidence TO adulis_readonly;
GRANT SELECT ON core.v_stock_confidence TO adulis_app;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 07 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
