-- ---------------------------------------------------------------------------
-- 0043 -- the schema ADU-AUTH-01 v2.6 requires (its S12.3), transcribed.
--
-- WORK ORDER T13 S1. v2.6 arrived and unblocks register D-176, where T12
-- Phases 2-4 stopped: the order then named three of S12.2's six delivery
-- statuses and cited the rest by section number, and a schema transcribed
-- from fragments is designed, not transcribed.
--
-- SOURCES, section by section:
--   S12.1  core.otp_delivery_attempt, its fields and its UNIQUE
--   S12.2  the six delivery statuses, in full
--   S5.6   the three send classifications (ACCEPTED / DEFINITIVE_NOT_SENT /
--          DELIVERY_UNKNOWN) -- classifications of a SEND, which is why they
--          are not the same list as S12.2's row statuses
--   S6     the four provider implementations (the two "future only when
--          justified" providers are NOT added -- adding an enum value for a
--          provider nobody has integrated is designing ahead)
--   S9.1   market configuration
--   S9.2   the seven activation states
--   S10.1  the four sender modes
--   S10.2  the four sender-registration states
--   S16    the global OTP budget
--   S30    the event catalogue (nineteen absent names, seeded below)
--
-- WHAT IS DELIBERATELY *NOT* HERE, each registered rather than invented:
--   * `failure_class` and `sms_compliance_status` are TEXT. S12.1 and S9.1
--     name both fields and NEITHER enumerates its values; an enum invented
--     here would become the binding shape v1.14 then has to match (D-181).
--   * S7.1's provider lifecycle (CANDIDATE -> ACCEPTANCE_TESTING -> APPROVED
--     -> PRODUCTION_FALLBACK) gets no table. Ethiopia's state today is
--     "Fallback = NONE" (S7.1), which is sms_fallback_provider IS NULL, and
--     that is the whole of what the schema must express now (D-182).
--   * `core.market.is_live` is NOT retired, folded, or redefined. v2.6 never
--     mentions it, and it now sits beside activation_state describing an
--     overlapping fact -- registered as D-183, needing a ruling, because
--     collapsing two truths about one thing is exactly the judgement call
--     "transcribe, do not design" forbids.
--
-- DELIVERY STATUS IS AN ENUM, AND THAT BREAKS THE T6 PATTERN DELIBERATELY.
-- billing.purchase_intent and core.seller_ownership_transfer carried state as
-- timestamps to avoid a document amendment when none was planned. One IS
-- planned here (v1.14). And the six values are not stages a timestamp can
-- express: DEFINITIVE_NOT_SENT and DELIVERY_UNKNOWN are terminal
-- CLASSIFICATIONS of an attempt, not points on its timeline.
-- ---------------------------------------------------------------------------

-- ------------------------------------------------------------------- 1. enums

-- S6's four initial implementations, and only those.
CREATE TYPE core.sms_provider AS ENUM (
  'AFROMESSAGE', 'SMSETHIOPIA', 'INFOBIP', 'TWILIO'
);

COMMENT ON TYPE core.sms_provider IS
  'ADU-AUTH-01 v2.6 S6. Africa''s Talking and Unifonic are S6/S8.2/S8.3 '
  'deferrals and are absent on purpose: an enum value for an unintegrated '
  'provider is a route the router could be told to take.';

-- S12.2, all six.
CREATE TYPE core.otp_delivery_status AS ENUM (
  'PENDING', 'ACCEPTED', 'DELIVERED',
  'DEFINITIVE_NOT_SENT', 'DELIVERY_UNKNOWN', 'FAILED_FINAL'
);

COMMENT ON TYPE core.otp_delivery_status IS
  'ADU-AUTH-01 v2.6 S12.2. INVARIANT (S12.2): "Security code validity is not '
  'derived from these statuses." A delivered code and a verifiable code are '
  'different facts -- core.otp_challenge owns the second one.';

-- S9.2's seven.
CREATE TYPE core.market_activation_state AS ENUM (
  'UNREVIEWED', 'COMPLIANCE_REVIEW', 'SENDER_PENDING', 'TESTING',
  'ACTIVE', 'SUSPENDED', 'BLOCKED'
);

COMMENT ON TYPE core.market_activation_state IS
  'ADU-AUTH-01 v2.6 S9.2. Only ACTIVE markets may receive ordinary new OTP '
  'issuance (S9). Default UNREVIEWED: S9 denies by default, so a market row '
  'created with no review has OTP off without anyone deciding so.';

-- S10.1's four.
CREATE TYPE core.sms_sender_mode AS ENUM (
  'ALPHANUMERIC_SENDER', 'PHONE_NUMBER_SENDER',
  'PROVIDER_MANAGED_SENDER', 'OTHER_APPROVED_SENDER'
);

-- S10.2's four.
CREATE TYPE core.sender_registration_status AS ENUM (
  'NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'
);

COMMENT ON TYPE core.sender_registration_status IS
  'ADU-AUTH-01 v2.6 S10.2. Where registration is mandatory, status != '
  'APPROVED forces otp_enabled = false unless an approved alternative route '
  'exists -- enforced in the router, not by a CHECK, because "where '
  'mandatory" is per-market configuration this schema does not carry.';

-- ------------------------------------------ 2. otp_challenge.audience (S5.2)
--
-- S12.3 asks for this "if not already present". IT IS NOT PRESENT: the column
-- list at 0043 is id, purpose, phone_e164, code_hash, attempt_count,
-- expires_at, consumed_at, step_up_action, created_at.
--
-- R39/S5.2 fix the audience AT CHALLENGE CREATION, and today the audience
-- arrives in the VERIFY body instead (auth.schemas.ts). That is a real
-- divergence from the ruled model and it is registered as D-180; this column
-- is the schema half. NULLABLE for now, deliberately: existing live
-- challenges have no audience, and a NOT NULL here would fail the migration
-- against any database with one in flight. The service half (writing it at
-- request, refusing a mismatch at verify) rides D-180's fix.
ALTER TABLE core.otp_challenge
  ADD COLUMN audience core.session_audience NULL;

COMMENT ON COLUMN core.otp_challenge.audience IS
  'ADU-AUTH-01 v2.6 S5.2/R39 - persisted at challenge creation. INVARIANT: a '
  'MOBILE challenge mints a MOBILE session only; a CONSOLE challenge mints a '
  'CONSOLE session only. NULL means a challenge created before this column '
  'existed (register D-180).';

-- --------------------------------------------- 3. core.otp_delivery_attempt
--
-- S12.1's fields, verbatim, in its order.
CREATE TABLE core.otp_delivery_attempt (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  otp_challenge_id    uuid NOT NULL REFERENCES core.otp_challenge(id) ON DELETE CASCADE,
  attempt_no          int NOT NULL CHECK (attempt_no >= 1),
  provider            core.sms_provider NOT NULL,
  provider_message_id text NULL,
  status              core.otp_delivery_status NOT NULL DEFAULT 'PENDING',
  failure_class       text NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  accepted_at         timestamptz NULL,
  finalized_at        timestamptz NULL,

  -- S12.1, verbatim.
  CONSTRAINT otp_delivery_attempt_no UNIQUE (otp_challenge_id, attempt_no)
);

COMMENT ON TABLE core.otp_delivery_attempt IS
  'ADU-AUTH-01 v2.6 S12/S12.1 - TRANSPORT STATE, SEPARATE FROM SECURITY '
  'STATE. One challenge may have several attempts (primary then fallback, '
  'S12); the OTP itself, its expiry and its attempt budget stay in '
  'core.otp_challenge. NO OTP PLAINTEXT (S12.1), and nothing here can extend '
  'code validity (S5.8).';

COMMENT ON COLUMN core.otp_delivery_attempt.failure_class IS
  'TEXT, not an enum: S12.1 names this field and enumerates no values. The '
  'send CLASSIFICATIONS of S5.6 (ACCEPTED / DEFINITIVE_NOT_SENT / '
  'DELIVERY_UNKNOWN) are carried by `status`; what belongs here is the '
  'provider-specific reason each adapter documents (S5.6, last line). '
  'Register D-181.';

COMMENT ON COLUMN core.otp_delivery_attempt.attempt_no IS
  'Per challenge, from 1. NOT the OTP attempt budget -- that is '
  'core.otp_challenge.attempt_count, and conflating a transport retry with a '
  'burned verification attempt is the S5.5/S5.7 confusion in column form.';

CREATE INDEX otp_delivery_attempt_by_challenge
  ON core.otp_delivery_attempt (otp_challenge_id, attempt_no);

-- The metrics of S32 are read by provider and by status.
CREATE INDEX otp_delivery_attempt_by_provider
  ON core.otp_delivery_attempt (provider, status, created_at);

-- --------------------------------------------------- 4. market configuration
--
-- S9.1's `market_config`. Its field list OVERLAPS core.market -- market_code,
-- default_currency, default_timezone are core.market's code,
-- display_currency, display_timezone -- so the new fields extend that row
-- rather than starting a second table that would carry a stale copy of three
-- values (the root CLAUDE.md's "a rule kept in two places grows a stale
-- copy"). The per-concern config tables beside it (timing, eligibility,
-- ladder) exist because they carry EFFECTIVE RANGES; none of S9.1 is
-- time-varying.
ALTER TABLE core.market
  ADD COLUMN activation_state core.market_activation_state NOT NULL DEFAULT 'UNREVIEWED',
  ADD COLUMN registration_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN buyer_registration_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN seller_registration_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN otp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_primary_provider core.sms_provider NULL,
  ADD COLUMN sms_fallback_provider core.sms_provider NULL,
  ADD COLUMN sender_mode core.sms_sender_mode NULL,
  ADD COLUMN sender_id text NULL,
  ADD COLUMN sender_registration_status core.sender_registration_status NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN sms_compliance_status text NULL,
  ADD COLUMN otp_daily_soft_limit int NULL CHECK (otp_daily_soft_limit IS NULL OR otp_daily_soft_limit > 0),
  ADD COLUMN otp_daily_hard_limit int NULL CHECK (otp_daily_hard_limit IS NULL OR otp_daily_hard_limit > 0);

-- S9: "OTP sending is denied by default for unreviewed international
-- markets." A market that is not ACTIVE cannot have OTP enabled, and the
-- database holds it rather than the router alone.
ALTER TABLE core.market
  ADD CONSTRAINT market_otp_requires_active
    CHECK (NOT otp_enabled OR activation_state = 'ACTIVE');

-- A fallback that is the primary is not a fallback.
ALTER TABLE core.market
  ADD CONSTRAINT market_fallback_differs
    CHECK (sms_fallback_provider IS NULL
           OR sms_fallback_provider IS DISTINCT FROM sms_primary_provider);

-- Soft must precede hard, or the soft alert is unreachable.
ALTER TABLE core.market
  ADD CONSTRAINT market_otp_budget_ordered
    CHECK (otp_daily_soft_limit IS NULL OR otp_daily_hard_limit IS NULL
           OR otp_daily_soft_limit <= otp_daily_hard_limit);

COMMENT ON COLUMN core.market.activation_state IS
  'ADU-AUTH-01 v2.6 S9.2. Only ACTIVE issues new OTP (S9). NOTE: this sits '
  'beside is_live, which v2.6 never mentions and which bootstrap uses to '
  'choose a device''s market -- two overlapping truths about one market, '
  'registered as D-183 and NOT collapsed here.';

COMMENT ON COLUMN core.market.sms_fallback_provider IS
  'NULL means "no fallback route", which is Ethiopia''s state today: S7.1 '
  'makes SMSEthiopia a CANDIDATE, not a route, until S7.2''s acceptance '
  'checklist passes. S7.1''s four-state provider lifecycle has no schema '
  'home and needs none yet (register D-182).';

COMMENT ON COLUMN core.market.sms_compliance_status IS
  'TEXT: S9.1 names the field and enumerates no values (register D-181).';

-- ------------------------------------------------- 5. the global OTP budget
--
-- S16 gives Adulis platform-wide limits beside the per-market ones. No
-- platform-scoped configuration table existed -- every config table in this
-- schema is per-market with a market_id -- so this is the first, and the
-- single row is enforced rather than assumed.
CREATE TABLE core.platform_otp_budget (
  id                            boolean PRIMARY KEY DEFAULT true CHECK (id),
  otp_global_daily_soft_limit   int NOT NULL CHECK (otp_global_daily_soft_limit > 0),
  otp_global_daily_hard_limit   int NOT NULL CHECK (otp_global_daily_hard_limit > 0),
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT platform_otp_budget_ordered
    CHECK (otp_global_daily_soft_limit <= otp_global_daily_hard_limit)
);

COMMENT ON TABLE core.platform_otp_budget IS
  'ADU-AUTH-01 v2.6 S16 - the platform-wide OTP budget. ONE ROW, enforced by '
  'a boolean primary key CHECKed true: a second row is impossible rather '
  'than merely discouraged. S16.2: a hard limit blocks NEW anonymous '
  'issuance and does not invalidate live codes or log anyone out.';

-- ------------------------------------------------- 6. S30's event catalogue
--
-- NINETEEN names in S30 are absent from analytics.event_definition. S30.1
-- calls out four "at minimum" and the work order predicted six; the diff is
-- the instrument (T13 S1: "working from the list of four is how the fifth
-- fails closed at the first provider timeout").
--
-- TWO OF THESE COLLIDE WITH EXISTING NAMES AND ARE SEEDED ANYWAY, because
-- transcribing is the rule and choosing between a document's name and an
-- older one is a ruling (register D-184):
--   S30 `step_up_requested`  beside the catalogue's `step_up_challenged`
--   S30 `otp_delivered`      beside the catalogue's `otp_delivery_confirmed`
INSERT INTO analytics.event_definition (name, version, introduced_at)
SELECT unnest(ARRAY[
  'otp_generated',
  'otp_delivery_attempted',
  'otp_delivery_accepted',
  'otp_delivery_unknown',
  'otp_delivery_failed',
  'otp_delivered',
  'otp_provider_failover_started',
  'otp_provider_failover_completed',
  'otp_verified',
  'otp_market_soft_limit',
  'otp_market_hard_limit',
  'otp_global_soft_limit',
  'otp_global_hard_limit',
  'step_up_requested',
  'step_up_satisfied',
  'step_up_failed',
  'courier_invite_claimed',
  'social_account_verification_started',
  'social_account_verification_completed'
]), 1, '2026-08-31T00:00:00Z';

-- --------------------------------------------------------------- 7. grants
--
-- The app writes delivery attempts (the router records every send) and reads
-- market/budget configuration.
--
-- [!] AND IT CAN WRITE MARKET ACTIVATION, WHICH THIS COMMENT ONCE DENIED.
-- The first version asserted "it never writes market activation: S9.4 makes
-- activation a privileged founder-run operation". That is false in the
-- database this migration produces: migration 0002 grants adulis_app full
-- DML on core.market, nothing revokes it, no column-level REVOKE is issued
-- here, and core.market has no RLS. Folding S9.1's configuration INTO
-- core.market (D-187) inherited those grants -- a separate table would have
-- started with none. A COMMENT CANNOT REVOKE A GRANT. Registered as D-186
-- with three options, and deliberately not patched here: a privilege change
-- against the live application role belongs with D-185's withdrawal of
-- is_live, which rewrites who reads and writes this table anyway.
GRANT SELECT, INSERT, UPDATE ON core.otp_delivery_attempt TO adulis_app;
GRANT SELECT, INSERT, UPDATE ON core.otp_delivery_attempt TO adulis_jobs;
GRANT SELECT ON core.platform_otp_budget TO adulis_app;
GRANT SELECT ON core.platform_otp_budget TO adulis_jobs;
