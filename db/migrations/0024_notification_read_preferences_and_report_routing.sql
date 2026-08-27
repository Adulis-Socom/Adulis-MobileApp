-- ===========================================================================
-- MIGRATION 0024 - NOTIFICATION READ STATE, PREFERENCES, REPORT ROUTING,
--                  AND THE TWO CLIENT-OBSERVED EVENT DEFINITIONS
--
-- Sources:
--   ADU-API-01 v1.6 S12.14 - "Read state syncs across surfaces - one list,
--     two clients"; GET/PATCH /v1/seller/notification-preferences; the
--     suppressible=false 422 invariant
--   ADU-API-01 v1.6 S12.15 + S13 - "insert core.content_report - the queue
--     trigger routes it" (the trigger did not exist; nothing routed)
--   ADU-API-01 v1.6 S12.16 / S11 - the closed allow-list of two
--     client-observed events, absent from migration 16's seeded set
--
-- Two cross-document gaps are resolved the D-27 way - the surface a later
-- binding contract requires must exist (both registered):
--   - ADU-DB-01 v1.10 S20's notification table has no read column, and
--     12.14 requires read state: read_at is added (D-41).
--   - No document gives notification preferences a table, and 12.14 gives
--     them two endpoints: core.notification_preference is added and pinned
--     in check 14 as a body-over-manifest exception, the D-18 mechanism
--     (D-40). Appendix B owes the row.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. Read state (12.14, D-41)
-- ---------------------------------------------------------------------------
ALTER TABLE core.notification ADD COLUMN read_at timestamptz NULL;

COMMENT ON COLUMN core.notification.read_at IS
  'ADU-API-01 v1.6 S12.14 - read state syncs across surfaces: one list, '
  'two clients. Absent from ADU-DB-01 v1.10 S20 (registered D-41); the '
  'wire contract requires it, so it exists.';

CREATE INDEX idx_notification_unread
  ON core.notification (recipient_account_id) WHERE read_at IS NULL;

GRANT UPDATE (read_at) ON core.notification TO adulis_app;

-- ---------------------------------------------------------------------------
-- 2. core.notification_preference (12.14, D-40)
--
-- Preferences are PERSONAL to the account within the seller context - a
-- team member silencing a class must not silence it for the owner. What a
-- preference can never do is silence an unsuppressible class: that word
-- lives on the notification row, the sender filters WHERE suppressible,
-- and the ENDPOINT refuses the toggle with 422 - three layers, one rule.
-- ---------------------------------------------------------------------------
CREATE TABLE core.notification_preference (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    uuid NOT NULL REFERENCES core.seller(id),
  account_id   uuid NOT NULL REFERENCES core.account(id),
  template_key text NOT NULL,
  enabled      boolean NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_preference_per_key UNIQUE (seller_id, account_id, template_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON core.notification_preference TO adulis_app;

-- ---------------------------------------------------------------------------
-- 3. The report routing trigger (12.15, S13's mapping)
--
-- "insert core.content_report - the queue trigger routes it." The queue
-- item is operator work under S18's policy; the report itself never hides
-- a review, delays publication, or notifies the seller.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_route_content_report() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
BEGIN
  INSERT INTO core.moderation_queue_item (kind, target_kind, target_id)
  VALUES ('REPORT', NEW.target_kind, NEW.target_id);
  RETURN NEW;
END $fn$;

ALTER FUNCTION core.fn_route_content_report() OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_route_content_report() FROM PUBLIC;
GRANT SELECT, INSERT ON core.moderation_queue_item TO adulis_migrate;

CREATE TRIGGER trg_route_content_report
  AFTER INSERT ON core.content_report
  FOR EACH ROW EXECUTE FUNCTION core.fn_route_content_report();

-- ---------------------------------------------------------------------------
-- 4. The two client-observed events (12.16, S11): everything else in
--    analytics.event is server-emitted; these two are what a client may
--    say, and the definition table must know them or the key-validation
--    trigger rightly refuses them. Append-only: INSERT at version 1.
-- ---------------------------------------------------------------------------
INSERT INTO analytics.event_definition (name, version, introduced_at)
VALUES ('notification_opened', 1, '2026-08-27T00:00:00Z'),
       ('payment_instructions_viewed', 1, '2026-08-27T00:00:00Z');

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
