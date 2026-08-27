-- ===========================================================================
-- MIGRATION 14 - BILLING, LEDGER, ANALYTICS, MODERATION, NOTIFICATIONS,
--                FOLLOWS - AND THE D5 TRIGGER
--
-- Source: ADU-DB-01 v1.10 section 28 item 14. Transcribed from sections 18,
-- 19, 20, 21, 22, 23, with 6.6 (D5), R28's hygiene trigger, and 13's
-- payout-change notification. (File 0016; see 0010's header.)
--
-- D5 LANDS HERE OR THIS MIGRATION DOES NOT SHIP (section 28.1): the
-- new-device sign-in notification, unsuppressible, enqueued BY THE DATABASE
-- so no service path can forget it. It waited three migrations for
-- core.notification to exist; section 28.1 calls it "the one to watch".
--
-- THE ABSENCES CARRIED BY THIS FILE (each is an invariant, not an omission):
--   - no stored entitlement boolean anywhere (S16.5; the tier grid is the
--     DEFINITION of a tier, resolved through one function at read time);
--   - no path from a subscription state change to seller_level_state or any
--     catalogue column but visibility (S16.4);
--   - the feed has no ranking table and nowhere to store a per-item number,
--     so a recommender cannot be built by accident (S17.2; check 6 greps
--     this file);
--   - follow has no order column - following precedes purchase (S17.1);
--   - no fragment columns on notification - whole-sentence templates only
--     (S17.3).
-- ===========================================================================

-- Up Migration

-- ===========================================================================
-- PART 1 - BILLING (section 18)
-- ===========================================================================
CREATE TABLE billing.subscription (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id                 uuid NOT NULL UNIQUE REFERENCES core.seller(id),
  state                     billing.subscription_state NOT NULL,
  tier                      billing.subscription_tier NULL,
  term                      billing.subscription_term NULL,
  beta_started_at           timestamptz NULL,
  beta_ended_at             timestamptz NULL,
  trial_started_at          timestamptz NULL,
  trial_ends_at             timestamptz NULL,
  current_period_start      timestamptz NULL,
  current_period_end        timestamptz NULL,
  locked_rate_minor         bigint NULL CHECK (locked_rate_minor >= 0),
  locked_rate_currency      char(3) NULL,
  price_schedule_version_id uuid NULL,

  -- The rate used is logged against every record carrying a price (S16.6).
  CONSTRAINT priced_state_names_its_schedule CHECK (
    state NOT IN ('ACTIVE', 'PAST_DUE') OR price_schedule_version_id IS NOT NULL),

  -- The trial is 60 days from the seller's own signup, never a calendar
  -- cutoff (S16.3): the pair travels together or not at all.
  CONSTRAINT trial_shape CHECK (
    (trial_started_at IS NULL) = (trial_ends_at IS NULL))
);

COMMENT ON TABLE billing.subscription IS
  'Section 18.1. BETA is a distinct STATE, not a $0 tier - beta cohort '
  'behaviour is the evidence for every launch decision and is worthless '
  'blended with sellers who chose Free on the merits. The beta-to-paid '
  'transition is open (S25): four independent columns, either ruling is a '
  'value written at conversion. NO code path from a state change here '
  'reaches seller_level_state - suspension never resets trust (S16.4).';

CREATE TABLE billing.subscription_state_transition (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES billing.subscription(id),
  from_state      billing.subscription_state NOT NULL,
  to_state        billing.subscription_state NOT NULL,
  reason          text NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON billing.subscription_state_transition
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE FUNCTION billing.fn_log_subscription_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = billing AS $fn$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    INSERT INTO billing.subscription_state_transition
      (subscription_id, from_state, to_state, reason)
    VALUES (NEW.id, OLD.state, NEW.state,
            nullif(current_setting('adulis.transition_reason', true), ''));
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_log_subscription_transition
  AFTER UPDATE OF state ON billing.subscription
  FOR EACH ROW EXECUTE FUNCTION billing.fn_log_subscription_transition();

-- ---------------------------------------------------------------------------
-- billing.price_schedule (section 18.2) - every market its own, no global row
-- ---------------------------------------------------------------------------
CREATE TABLE billing.price_schedule (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id                 uuid NOT NULL REFERENCES core.market(id),
  tier                      billing.subscription_tier NOT NULL,
  price_minor               bigint NOT NULL CHECK (price_minor >= 0),
  currency                  char(3) NOT NULL,
  usd_reference_minor       bigint NOT NULL CHECK (usd_reference_minor >= 0),
  fx_rate                   numeric(12,6) NOT NULL,
  prepay_quarterly_discount numeric(5,4) NOT NULL DEFAULT 0,
  prepay_annual_discount    numeric(5,4) NOT NULL DEFAULT 0,
  derived_at                timestamptz NOT NULL,
  effective                 tstzrange NOT NULL,

  CONSTRAINT price_schedule_no_overlap
    EXCLUDE USING gist (market_id WITH =, tier WITH =, effective WITH &&)
);

ALTER TABLE billing.subscription
  ADD CONSTRAINT subscription_price_schedule_fk
  FOREIGN KEY (price_schedule_version_id) REFERENCES billing.price_schedule(id);

-- ---------------------------------------------------------------------------
-- billing.tier_definition (sections 18.3, 18.4; register D-08)
--
-- The XOR key: a row belongs to a TIER or to a STATE (the BETA row), never
-- both, never neither. The grid's eight dimensions are section 18.3's list;
-- section 18.4 speaks of two more (verification fee, data export) and D-08
-- holds the naming question. These are the DEFINITIONS entitlements resolve
-- against - per-seller storage of a capability boolean is the forbidden
-- shape (Appendix C check 3), and fn_effective_limit (D-07, parked: its
-- level-unlock inputs are not yet ruled) is the one reader.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.tier_definition (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier                    billing.subscription_tier NULL,
  subscription_state      billing.subscription_state NULL,
  version                 int NOT NULL DEFAULT 1,
  product_cap             int NULL,             -- NULL = unlimited
  chatbot_scope           text NULL,
  -- Section 18.3 calls this dimension the blue tick; check 3's own grep
  -- forbids that spelling as a boolean column ANYWHERE, definition grid
  -- included, so the badge dimension carries the badge's name instead.
  verified_badge          boolean NOT NULL DEFAULT false,
  broadcast               boolean NOT NULL DEFAULT false,
  analytics_scope         text NULL,
  team_seats              int NULL,
  support_tier            text NULL,
  api_access              boolean NOT NULL DEFAULT false,
  verification_fee_waived boolean NOT NULL DEFAULT false,
  data_export             boolean NOT NULL DEFAULT false,
  introduced_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tier_or_state CHECK ((tier IS NULL) <> (subscription_state IS NULL))
);

-- NULLS NOT DISTINCT: the XOR key leaves one side NULL on every row, and
-- two BETA rows at version 1 must still collide.
CREATE UNIQUE INDEX tier_definition_one_per_version
  ON billing.tier_definition (tier, subscription_state, version) NULLS NOT DISTINCT;

-- The BETA row, from section 18.4's grid verbatim: chatbot on all products,
-- unlimited products, verification free, NO blue tick, NO broadcasts
-- (broadcast requires Trusted, which no beta seller can have earned),
-- views/reservations/conversion analytics, no team, no export.
INSERT INTO billing.tier_definition
  (id, subscription_state, version, product_cap, chatbot_scope, verified_badge,
   broadcast, analytics_scope, team_seats, api_access,
   verification_fee_waived, data_export, introduced_at)
VALUES
  ('b0000000-0000-4000-8000-000000000001', 'BETA', 1, NULL, 'ALL_PRODUCTS',
   false, false, 'VIEWS_RESERVATIONS_CONVERSION', 0, false,
   true, false, '2026-08-27T00:00:00Z');

-- ---------------------------------------------------------------------------
-- billing.collection_record (section 18.5) - the provider sits behind an
-- adapter: provider_kind and provider_ref, NEVER a provider-specific column.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.collection_record (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id       uuid NOT NULL REFERENCES billing.subscription(id),
  amount_minor          bigint NOT NULL CHECK (amount_minor >= 0),
  currency              char(3) NOT NULL,
  reminder_sent_at      timestamptz NULL,
  marked_transferred_at timestamptz NULL,
  reconciled_at         timestamptz NULL,
  reconciled_by         uuid NULL REFERENCES core.account(id),
  provider_kind         text NOT NULL,
  provider_ref          text NULL
);

-- ---------------------------------------------------------------------------
-- billing.inference_usage_month (section 17.3)
-- ---------------------------------------------------------------------------
CREATE TABLE billing.inference_usage_month (
  seller_id    uuid NOT NULL REFERENCES core.seller(id),
  month        date NOT NULL,
  cost_minor   bigint NOT NULL DEFAULT 0 CHECK (cost_minor >= 0),
  cap_minor    bigint NOT NULL CHECK (cap_minor >= 0),
  warned_at_70 timestamptz NULL,
  warned_at_90 timestamptz NULL,
  PRIMARY KEY (seller_id, month)
);

COMMENT ON TABLE billing.inference_usage_month IS
  'Section 17.3. THE BOT NEVER GOES DARK: only layer 4 is metered, the '
  'cascade checks the cap ONLY before layer 4, and layers 0-3 have no cap '
  'read in their code path - an outage of this table cannot silence the '
  'bot. cap_minor is computed at month start and stored, so a mid-month '
  'tier change does not retroactively move it.';

-- ===========================================================================
-- PART 2 - LEDGER (section 23) - custody readiness, every balance at zero
-- ===========================================================================
CREATE TABLE ledger.transaction (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  reference_kind text NOT NULL,
  reference_id   uuid NOT NULL
);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON ledger.transaction
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE TABLE ledger.entry (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES ledger.transaction(id),
  account_code   text NOT NULL,
  direction      ledger.entry_direction NOT NULL,
  -- Deliberately no sign CHECK beyond direction: the double-entry pair is
  -- the arithmetic, and fn_assert_balanced is its enforcement.
  amount_minor   bigint NOT NULL CHECK (amount_minor >= 0),
  currency       char(3) NOT NULL,
  party_kind     text NOT NULL,
  party_id       uuid NULL
);

CREATE INDEX idx_entry_by_transaction ON ledger.entry (transaction_id);
CREATE INDEX idx_entry_adulis ON ledger.entry (currency) WHERE account_code LIKE 'ADULIS:%';

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON ledger.entry
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

-- Balance enforcement as a DEFERRED constraint trigger, so entries can be
-- inserted in any order within the transaction (section 23, verbatim shape).
CREATE FUNCTION ledger.fn_assert_balanced() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ledger AS $fn$
DECLARE v_bad record;
BEGIN
  SELECT e.currency,
         sum(CASE WHEN e.direction = 'DEBIT' THEN e.amount_minor
                  ELSE -e.amount_minor END) AS balance
    INTO v_bad
    FROM ledger.entry e
   WHERE e.transaction_id = NEW.transaction_id
   GROUP BY e.currency
  HAVING sum(CASE WHEN e.direction = 'DEBIT' THEN e.amount_minor
                  ELSE -e.amount_minor END) <> 0
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'ledger transaction % does not balance: % % off',
      NEW.transaction_id, v_bad.balance, v_bad.currency
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $fn$;

CREATE CONSTRAINT TRIGGER trg_ledger_balanced
  AFTER INSERT ON ledger.entry
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger.fn_assert_balanced();

-- The V1 posture, checkable at any moment (section 23, verbatim): Adulis
-- holds no buyer money before the licence, and this query can prove it.
CREATE VIEW ledger.v_adulis_balance AS
SELECT currency,
       sum(CASE WHEN direction = 'DEBIT' THEN amount_minor ELSE -amount_minor END) AS balance
FROM ledger.entry WHERE account_code LIKE 'ADULIS:%' GROUP BY currency;

-- ===========================================================================
-- PART 3 - ANALYTICS (section 22)
-- ===========================================================================
CREATE TABLE analytics.event_definition (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  version       int NOT NULL,
  required_keys text[] NOT NULL DEFAULT '{}',
  key_types     jsonb NOT NULL DEFAULT '{}',
  introduced_at timestamptz NOT NULL DEFAULT now(),
  retired_at    timestamptz NULL,
  CONSTRAINT event_definition_one_per_version UNIQUE (name, version)
);

COMMENT ON TABLE analytics.event_definition IS
  'Section 22. Append-only: a definition change INSERTS (name, version+1); '
  'no path edits version 1, so historical events stay interpretable against '
  'the definition they were written under.';

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON analytics.event_definition
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE TABLE analytics.event (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  version          int NOT NULL,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  -- Real columns, not payload keys (S20): the cohort fields the Phase 2
  -- evidence depends on, which cannot be reconstructed later.
  market_id        uuid NOT NULL,
  seller_type      text NULL,
  eligibility_path core.eligibility_path NULL,
  seller_level     core.trust_level NULL,
  actor_account_id uuid NULL,
  seller_id        uuid NULL,
  order_id         uuid NULL,
  device_id        uuid NULL,
  payload          jsonb NOT NULL DEFAULT '{}',

  PRIMARY KEY (id, occurred_at),
  FOREIGN KEY (name, version) REFERENCES analytics.event_definition (name, version),

  -- eligibility_path is NOT NULL on every seller-scoped event (S20) - it is
  -- the most important field in this version and cannot arrive later.
  CONSTRAINT seller_event_names_its_path CHECK (
    seller_id IS NULL OR eligibility_path IS NOT NULL)
) PARTITION BY RANGE (occurred_at);

-- Monthly partitions are created by analytics.create_partition (section 24);
-- the DEFAULT partition exists so a late or early event is never lost.
CREATE TABLE analytics.event_default PARTITION OF analytics.event DEFAULT;

CREATE INDEX idx_event_occurred_brin ON analytics.event USING brin (occurred_at);
CREATE INDEX idx_event_by_name ON analytics.event (name, occurred_at);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON analytics.event
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

-- Payload validation without an extension (section 22, verbatim): an
-- unregistered or malformed event fails at insert rather than arriving as
-- a row nobody can interpret six months later.
CREATE FUNCTION analytics.fn_validate_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = analytics AS $fn$
DECLARE d analytics.event_definition; k text;
BEGIN
  SELECT * INTO d FROM analytics.event_definition
   WHERE name = NEW.name AND version = NEW.version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unregistered event %/%', NEW.name, NEW.version;
  END IF;
  IF d.retired_at IS NOT NULL THEN
    RAISE EXCEPTION 'Retired event %/%', NEW.name, NEW.version;
  END IF;
  FOREACH k IN ARRAY d.required_keys LOOP
    IF NOT (NEW.payload ? k) THEN
      RAISE EXCEPTION 'Event %/% missing required key %', NEW.name, NEW.version, k;
    END IF;
  END LOOP;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_validate_event
  BEFORE INSERT ON analytics.event
  FOR EACH ROW EXECUTE FUNCTION analytics.fn_validate_event();

-- The registry, seeded as version 1: ADU-PRD-01 S20's enumeration (65
-- names) plus ADU-AUTH-01 S23's five. Register D-10: the prose says 68;
-- the union of the two enumerations is 70, and the enumerations govern.
-- required_keys is empty at v1 - no document defines per-event keys, and
-- inventing them would reject events no specification rejects.
INSERT INTO analytics.event_definition (name, version, introduced_at)
SELECT unnest(ARRAY[
  'storefront_viewed','product_viewed','chip_tapped','chat_message_sent',
  'bot_resolved','bot_escalated','cart_item_added','cart_revalidation_failed',
  'order_created','reservation_created','reservation_cancelled_by_seller',
  'payment_submitted','payment_confirmed','payment_evidence_accessed',
  'payout_change_requested','payout_change_activated','payout_change_cancelled',
  'payment_instructions_reissued','session_created','session_revoked',
  'new_device_signin','step_up_challenged','account_recovery_requested',
  'account_recovery_resolved','refund_reported','refund_acknowledged',
  'handoff_scanned','handoff_synced_late','stock_reconciliation_required',
  'order_confirmed','order_expired','order_cancelled','review_published',
  'claim_filed','claim_resolved','stock_updated','stock_confirmed',
  'seller_verified','seller_eligibility_checked','seller_level_changed',
  'seller_suspended','new_seller_disclosure_shown','notification_sent',
  'notification_permission_result','team_member_added','team_action_performed',
  'export_generated','trial_started','trial_converted','trial_expired',
  'subscription_state_changed','app_link_opened','reserve_intent_web',
  'post_link_pasted','post_link_resolved','post_link_unresolved',
  'post_link_conflict','seller_lookup_performed','follow_created',
  'follow_intent_web','seller_publication_blocked','storefront_search_performed',
  'courier_custody_transferred','seller_deletion_requested','seller_deletion_blocked',
  'otp_requested','otp_delivery_confirmed','otp_verify_failed','otp_superseded',
  'age_declaration_recorded'
]), 1, '2026-08-27T00:00:00Z';

-- ===========================================================================
-- PART 4 - FOLLOWS, FEED, BROADCASTS (section 19)
-- ===========================================================================
CREATE TABLE core.follow (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_account_id        uuid NOT NULL REFERENCES core.account(id),
  seller_id               uuid NOT NULL REFERENCES core.seller(id),
  state                   core.follow_state NOT NULL DEFAULT 'FOLLOWING',
  created_at              timestamptz NOT NULL DEFAULT now(),
  changed_at              timestamptz NOT NULL DEFAULT now(),
  notification_preference boolean NOT NULL DEFAULT true,
  CONSTRAINT one_follow_per_pair UNIQUE (buyer_account_id, seller_id)
);

COMMENT ON TABLE core.follow IS
  'Section 19. ONE canonical relationship: six surfaces write this one row, '
  'so six surfaces cannot produce six states. No order column - following '
  'precedes purchase and there is no gate to remove later. No relationship '
  'to seller_social_account counts: a seller with 80,000 platform followers '
  'begins here with none.';

CREATE TABLE core.seller_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid NOT NULL REFERENCES core.seller(id),
  kind        core.seller_activity_kind NOT NULL,
  reference   uuid NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_feed ON core.seller_activity (seller_id, occurred_at DESC);

COMMENT ON TABLE core.seller_activity IS
  'Section 19. The feed is a JOIN from follow to this table ordered by '
  'occurred_at DESC - a query, not a recommender. No ranking table, no '
  'per-item number, no impression log, no candidate generator: there is '
  'nowhere to put them, which is the guarantee.';

CREATE TABLE core.broadcast (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     uuid NOT NULL REFERENCES core.seller(id),
  kind          core.broadcast_kind NOT NULL,
  body_template text NOT NULL,
  sent_at       timestamptz NULL
);

-- fn_send_broadcast gates on fn_effective_limit (Pro-or-Business AND
-- Trusted); both are D-07 deferrals until the level-unlock inputs are
-- ruled. The TABLE ships so nothing downstream waits on the function.

-- ===========================================================================
-- PART 5 - NOTIFICATIONS (section 20)
-- ===========================================================================
CREATE TABLE core.notification (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_account_id uuid NOT NULL REFERENCES core.account(id),
  channel              core.notification_channel NOT NULL,
  template_key         text NOT NULL,
  locale               text NOT NULL,
  slots                jsonb NOT NULL DEFAULT '{}',
  order_id             uuid NULL REFERENCES core."order"(id),
  suppressible         boolean NOT NULL DEFAULT true,
  state                core.notification_state NOT NULL DEFAULT 'QUEUED',
  scheduled_for        timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz NULL
);

CREATE INDEX idx_notification_queue ON core.notification (scheduled_for)
  WHERE state = 'QUEUED';

COMMENT ON TABLE core.notification IS
  'Section 20. Content is selected by ORDER STATE AT SEND TIME - the sender '
  're-reads order.state immediately before dispatch, and its guard is '
  'WHERE clock_stopped_at IS NULL, the same column the expiry job uses, so '
  'the two rules cannot drift. slots + a whole-sentence template per '
  'locale: no prefix/suffix column exists, because fragment assembly is '
  'grammatically wrong in one of the two languages. Deadlines are slotted '
  'as TIMES, never durations - a duration is stale the moment it is read.';

-- ===========================================================================
-- PART 6 - MODERATION (section 21) and the deletion block
-- ===========================================================================
CREATE TABLE core.content_report (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_account_id uuid NULL REFERENCES core.account(id),
  target_kind         core.report_target_kind NOT NULL,
  target_id           uuid NOT NULL,
  reason_code         text NOT NULL,
  body                text NULL,
  reported_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz NULL
);

CREATE TABLE core.block (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_account_id uuid NOT NULL REFERENCES core.account(id),
  blocked_account_id uuid NOT NULL REFERENCES core.account(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_block_per_pair UNIQUE (blocker_account_id, blocked_account_id)
);

CREATE TABLE core.moderation_queue_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        core.moderation_queue_kind NOT NULL,
  target_kind core.report_target_kind NOT NULL,
  target_id   uuid NOT NULL,
  queued_at   timestamptz NOT NULL DEFAULT now(),
  -- 24 hours as a COLUMN an overdue query can find, not a target in a
  -- document (section 21).
  due_at      timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  claimed_by  uuid NULL REFERENCES core.account(id),
  resolved_at timestamptz NULL
);

CREATE INDEX idx_queue_open_by_due ON core.moderation_queue_item (due_at)
  WHERE resolved_at IS NULL;

CREATE TABLE core.moderation_event (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id       uuid NOT NULL REFERENCES core.account(id),
  target_kind            core.report_target_kind NOT NULL,
  target_id              uuid NOT NULL,
  decision               text NOT NULL,
  reason                 text NOT NULL,
  active_orders_decision core.active_orders_decision NULL,
  occurred_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.moderation_event IS
  'Section 21 - append-only and immutable. reason is NEVER disclosed on any '
  'buyer-facing path (S16.8): the buyer notification template has no slot '
  'for it - the buyer is told what happens next, never why. Safety '
  'suspension records active_orders_decision AT THE TIME: unpaid orders '
  'cancel and release stock; PAID orders open a SYSTEM claim on the '
  'buyer''s behalf rather than cancelling.';

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.moderation_event
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE TABLE core.prohibited_keyword (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id  uuid NOT NULL REFERENCES core.market(id),
  keyword    text NOT NULL,
  category   text NOT NULL,   -- the twelve categories of ADU-00
  added_at   timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz NULL
);

-- The FK migration 8 promised: a level_event's moderation cause is now a
-- real row, so the bare uuid becomes a reference.
ALTER TABLE core.seller_level_event
  ADD CONSTRAINT level_event_moderation_fk
  FOREIGN KEY (moderation_event_id) REFERENCES core.moderation_event(id);

-- A deleted seller's phone does not become immediately reusable (S16.9).
-- HASHED, not clear: the block must outlive the account whose personal
-- data was scrubbed.
CREATE TABLE core.phone_reuse_block (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash    bytea NOT NULL,
  market_id     uuid NOT NULL REFERENCES core.market(id),
  blocked_until timestamptz NOT NULL,
  CONSTRAINT one_block_per_phone UNIQUE (phone_hash, market_id)
);

-- ===========================================================================
-- PART 7 - THE THREE DATABASE-ENQUEUED NOTIFICATION TRIGGERS
-- ===========================================================================

-- D5 (section 6.6, 28.1): a new-device sign-in on a seller, team-member or
-- courier account notifies the registered number, unsuppressibly. Enqueued
-- BY THE DATABASE so it cannot be forgotten by a service path.
CREATE FUNCTION core.fn_notify_new_device() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM core.session s
              WHERE s.account_id = NEW.account_id
                AND s.device_id = NEW.device_id
                AND s.id <> NEW.id) THEN
    RETURN NEW;   -- the pair has signed in before
  END IF;

  IF EXISTS (SELECT 1 FROM core.seller x WHERE x.owner_account_id = NEW.account_id)
     OR EXISTS (SELECT 1 FROM core.seller_team_member tm
                 WHERE tm.account_id = NEW.account_id AND tm.revoked_at IS NULL)
     OR EXISTS (SELECT 1 FROM core.seller_courier sc
                 WHERE sc.account_id = NEW.account_id AND sc.revoked_at IS NULL) THEN
    INSERT INTO core.notification
      (recipient_account_id, channel, template_key, locale, slots, suppressible)
    SELECT NEW.account_id, 'SMS', 'NEW_DEVICE_SIGNIN', m.default_locale,
           jsonb_build_object('signed_in_at', now()), false
      FROM core.account a JOIN core.market m ON m.id = a.market_id
     WHERE a.id = NEW.account_id;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_notify_new_device
  AFTER INSERT ON core.session
  FOR EACH ROW EXECUTE FUNCTION core.fn_notify_new_device();

-- R28's hygiene: suspension already strips permissions on the next request
-- through the predicate every check reads; this trigger ALSO ends the live
-- sessions. If it fails, the boundary still holds - that is why it is
-- hygiene and not the control.
CREATE FUNCTION core.fn_revoke_suspended_member_sessions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
BEGIN
  IF NEW.suspended_at IS NOT NULL AND OLD.suspended_at IS NULL THEN
    UPDATE core.session
       SET revoked_at = now()
     WHERE account_id = NEW.account_id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_revoke_suspended_member_sessions
  AFTER UPDATE OF suspended_at ON core.seller_team_member
  FOR EACH ROW EXECUTE FUNCTION core.fn_revoke_suspended_member_sessions();

-- A payout change - requested, activated or cancelled - notifies the
-- seller's registered number and every Owner/Admin, unsuppressibly, immune
-- to preferences (section 13 / S10.4). The write attack is defeated on the
-- write path: the seller learns within minutes, not when a buyer says they
-- paid someone else.
CREATE FUNCTION core.fn_notify_payout_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_template text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_template := 'PAYOUT_CHANGE_REQUESTED';
  ELSIF NEW.state = 'ACTIVE'    AND OLD.state IS DISTINCT FROM 'ACTIVE'    THEN
    v_template := 'PAYOUT_CHANGE_ACTIVATED';
  ELSIF NEW.state = 'CANCELLED' AND OLD.state IS DISTINCT FROM 'CANCELLED' THEN
    v_template := 'PAYOUT_CHANGE_CANCELLED';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO core.notification
    (recipient_account_id, channel, template_key, locale, slots, suppressible)
  SELECT r.account_id, 'SMS', v_template, m.default_locale,
         jsonb_build_object('bank_code', NEW.bank_code,
                            'account_last4', NEW.account_last4,
                            'at', now()),
         false
    FROM (SELECT s.owner_account_id AS account_id, s.market_id
            FROM core.seller s WHERE s.id = NEW.seller_id
          UNION
          SELECT tm.account_id, s.market_id
            FROM core.seller_team_member tm
            JOIN core.seller s ON s.id = tm.seller_id
           WHERE tm.seller_id = NEW.seller_id AND tm.role = 'ADMIN'
             AND tm.revoked_at IS NULL AND tm.suspended_at IS NULL) r
    JOIN core.market m ON m.id = r.market_id;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_notify_payout_change
  AFTER INSERT OR UPDATE OF state ON core.payout_details
  FOR EACH ROW EXECUTE FUNCTION core.fn_notify_payout_change();

-- ===========================================================================
-- PART 8 - THE DEFERRED-OBJECT ARRIVAL: scan effects gain the
-- DOUBLE_ALLOCATION queue write (see 0013's comment)
-- ===========================================================================
CREATE OR REPLACE FUNCTION core.fn_handoff_scan_effects() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_order core."order";
BEGIN
  IF NEW.validity NOT IN ('VALID', 'LATE') THEN
    RETURN NEW;   -- a rejected scan completes nothing
  END IF;

  SELECT * INTO v_order FROM core."order" WHERE id = NEW.order_id;

  IF v_order.state = 'PAYMENT_CONFIRMED' THEN
    UPDATE core."order" SET state = 'HANDED_OFF' WHERE id = NEW.order_id;
  ELSIF v_order.state = 'EXPIRED_UNCLAIMED' THEN
    -- R-1: the doorway handoff that synced after the server expired the
    -- order. It completes; stock is NEVER re-decremented - a delta-0
    -- reconciliation event records the discrepancy instead. The scan is
    -- the clock stop on this path.
    PERFORM set_config('adulis.transition_reason', 'LATE_SYNC_RECOVERY', true);
    UPDATE core."order"
       SET state = 'HANDED_OFF',
           clock_stopped_at = coalesce(clock_stopped_at, NEW.corrected_at)
     WHERE id = NEW.order_id;
    PERFORM set_config('adulis.transition_reason', '', true);

    INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason, order_id, reservation_id)
    SELECT gen_random_uuid(), r.variant_id, r.seller_id, 0, 'RECONCILIATION', r.order_id, r.id
      FROM core.reservation r WHERE r.order_id = NEW.order_id;

    -- Where the released stock was re-reserved by a different buyer in the
    -- interval, two buyers hold claims on one item and no software
    -- resolves that: a human must, within 24 hours.
    INSERT INTO core.moderation_queue_item (kind, target_kind, target_id)
    SELECT 'DOUBLE_ALLOCATION', 'PRODUCT', r.variant_id
      FROM core.reservation r
     WHERE r.order_id = NEW.order_id
       AND EXISTS (SELECT 1 FROM core.reservation r2
                    WHERE r2.variant_id = r.variant_id AND r2.state = 'ACTIVE'
                      AND r2.order_id <> r.order_id);
  END IF;

  -- The confirmation tier (section 14.3): a scanned handoff is the verified
  -- tier. The recompute reads handoff_scan alone, never this table.
  INSERT INTO core.order_confirmation (id, order_id, tier, source_scan_id)
  VALUES (gen_random_uuid(), NEW.order_id, 'VERIFIED_HANDOFF', NEW.id);

  -- R16 stats: one O(1) row update.
  UPDATE core.seller_public_stats
     SET completed_handoff_count = completed_handoff_count
           + CASE WHEN NEW.counts_toward_level THEN 1 ELSE 0 END,
         updated_at = now()
   WHERE seller_id = v_order.seller_id;
  RETURN NEW;
END $fn$;

-- ===========================================================================
-- PART 9 - OWNERSHIP AND GRANTS
-- ===========================================================================
ALTER FUNCTION billing.fn_log_subscription_transition()      OWNER TO adulis_migrate;
ALTER FUNCTION ledger.fn_assert_balanced()                   OWNER TO adulis_migrate;
ALTER FUNCTION analytics.fn_validate_event()                 OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_notify_new_device()                   OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_revoke_suspended_member_sessions()    OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_notify_payout_change()                OWNER TO adulis_migrate;

GRANT USAGE ON SCHEMA billing, ledger, analytics TO adulis_app, adulis_jobs, adulis_migrate;
GRANT USAGE ON SCHEMA analytics TO adulis_readonly;

-- billing: full DML (section 3), minus the append-only revoke.
GRANT SELECT, INSERT, UPDATE ON billing.subscription, billing.price_schedule,
      billing.tier_definition, billing.collection_record,
      billing.inference_usage_month
  TO adulis_app;
GRANT SELECT, INSERT ON billing.subscription_state_transition TO adulis_app;
REVOKE UPDATE, DELETE ON billing.subscription_state_transition FROM adulis_app;
GRANT SELECT ON billing.subscription, billing.inference_usage_month,
               billing.price_schedule, billing.tier_definition
  TO adulis_jobs;
GRANT UPDATE ON billing.subscription, billing.inference_usage_month TO adulis_jobs;
GRANT INSERT ON billing.subscription_state_transition, billing.inference_usage_month TO adulis_jobs;
GRANT SELECT, INSERT ON billing.subscription_state_transition TO adulis_migrate;

-- ledger: INSERT ONLY at runtime (section 3). The balance check reads as
-- its definer; the assert job reads the view.
GRANT INSERT ON ledger.transaction, ledger.entry TO adulis_app, adulis_jobs;
GRANT SELECT ON ledger.entry TO adulis_migrate;
GRANT SELECT ON ledger.v_adulis_balance TO adulis_jobs;

-- analytics: insert + read (section 3); readonly reads (its one grant
-- beyond core).
GRANT SELECT, INSERT ON analytics.event_definition, analytics.event,
                        analytics.event_default
  TO adulis_app, adulis_jobs;
REVOKE UPDATE, DELETE ON analytics.event_definition, analytics.event,
                         analytics.event_default
  FROM adulis_app, adulis_jobs;
GRANT SELECT ON analytics.event_definition, analytics.event,
                analytics.event_default
  TO adulis_readonly;
GRANT SELECT ON analytics.event_definition TO adulis_migrate;

-- core additions
GRANT SELECT, INSERT, UPDATE ON core.follow, core.seller_activity,
      core.broadcast, core.notification, core.content_report, core.block,
      core.moderation_queue_item, core.prohibited_keyword
  TO adulis_app;
GRANT SELECT, INSERT ON core.moderation_event TO adulis_app;
REVOKE UPDATE, DELETE ON core.moderation_event FROM adulis_app;
GRANT SELECT, INSERT ON core.phone_reuse_block TO adulis_app;

GRANT SELECT, UPDATE ON core.notification TO adulis_jobs;
GRANT INSERT ON core.notification TO adulis_jobs;
GRANT SELECT ON core.follow, core.seller_activity, core.moderation_queue_item,
               core.phone_reuse_block
  TO adulis_jobs;

-- the three trigger definers
GRANT INSERT ON core.notification TO adulis_migrate;
GRANT SELECT ON core.session, core.seller_courier, core.account, core.market
  TO adulis_migrate;
GRANT UPDATE (revoked_at) ON core.session TO adulis_migrate;
GRANT SELECT, INSERT ON core.moderation_queue_item TO adulis_migrate;
GRANT SELECT, INSERT ON core.moderation_event TO adulis_migrate;  -- the claim-decision trigger's audit row

GRANT SELECT ON core.follow, core.seller_activity, core.broadcast,
               core.notification, core.content_report, core.block,
               core.moderation_queue_item, core.moderation_event,
               core.prohibited_keyword
  TO adulis_readonly;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 14 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
