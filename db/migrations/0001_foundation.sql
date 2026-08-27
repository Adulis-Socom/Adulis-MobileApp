-- ===========================================================================
-- MIGRATION 01 - FOUNDATION
--
-- Source: ADU-DB-01 v1.10 section 28 item 1 -
--   "Extensions, roles, schemas, domains, all enum types (Appendix A),
--    shared trigger functions"
--
-- Transcribed from sections 3 (schemas, roles), 3.1 (extensions), 4 (domains
-- and the append-only mechanism) and Appendix A (the enum catalogue).
--
-- Nothing here is designed. Every object below is named in ADU-DB-01 v1.10.
-- Two counting defects found in that document while transcribing it are noted
-- inline and recorded in the Tier 1 report.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. Extensions (section 3.1)
--
-- ADU-DB-01 section 29 makes these a hosting-selection criterion rather than a
-- convenience: "without the first the chatbot cascade has no layer 3; without
-- the second section 9.1's duplicate-reservation invariant has no
-- implementation." ADU-CON-02 v3.0 section 18 makes creating all four step 1 of
-- provider verification, and any provider that cannot is disqualified that day.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- HMAC for the keyed ID hash, gen_random_uuid
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE constraints mixing = and &&
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- seller lookup and storefront search (7.5, 7.6)
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector, cascade layer 3 (15.1)

-- ---------------------------------------------------------------------------
-- 2. The six roles (section 3)
--
-- Created NOLOGIN. Granting LOGIN and a password is a PROVISIONING step, never
-- a migration: a password in a migration is a secret in git, and ADU-CON-02
-- section 12 requires that the real .env never enters the repository.
--
-- Guarded, because a managed provider may pre-create a role of the same name
-- and ADU-CON-02 section 18 requires migration 1 to run on a provider trial
-- instance whose bootstrap user we do not control. An unguarded CREATE ROLE
-- would disqualify a provider for the wrong reason.
--
-- INVARIANT - adulis_app is not a superuser and must never be made one. A
-- superuser bypasses every privilege check in PostgreSQL, which would make the
-- verification and financial boundaries unenforceable and every boundary test
-- in this repository vacuous while still green.
-- ---------------------------------------------------------------------------
DO $roles$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'adulis_app',
    'adulis_verification',
    'adulis_financial',
    'adulis_jobs',
    'adulis_migrate',
    'adulis_readonly'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END
$roles$;

-- ---------------------------------------------------------------------------
-- 3. Schemas (section 3)
--
-- COUNTING DEFECT, REPORTED NOT RESOLVED. Section 3 heads its table "Nine
-- schemas in one Postgres cluster" and lists core, verification, financial,
-- chat, nlu, billing, ledger, analytics and jobs. Appendix B's manifest instead
-- lists waitlist and omits jobs. Appendix A places an enum type at
-- `waitlist.platform` while stating that ALL enum types are created in
-- migration 1, so the waitlist schema must exist here. Ten schemas are
-- therefore required and section 3's "nine" is wrong. See the Tier 1 report.
--
-- verification and financial are owned by their own roles from the moment they
-- exist, so that the SECURITY DEFINER functions added in migrations 4 and 10
-- run as those roles rather than as whoever ran the migration. Their tables
-- arrive in those migrations; the schemas exist here only because Appendix A's
-- enum types live in them.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS core         AUTHORIZATION adulis_migrate;
CREATE SCHEMA IF NOT EXISTS verification AUTHORIZATION adulis_verification;
CREATE SCHEMA IF NOT EXISTS financial    AUTHORIZATION adulis_financial;
CREATE SCHEMA IF NOT EXISTS chat         AUTHORIZATION adulis_migrate;
CREATE SCHEMA IF NOT EXISTS nlu          AUTHORIZATION adulis_migrate;
CREATE SCHEMA IF NOT EXISTS billing      AUTHORIZATION adulis_migrate;
CREATE SCHEMA IF NOT EXISTS ledger       AUTHORIZATION adulis_migrate;
CREATE SCHEMA IF NOT EXISTS analytics    AUTHORIZATION adulis_migrate;
CREATE SCHEMA IF NOT EXISTS jobs         AUTHORIZATION adulis_jobs;
CREATE SCHEMA IF NOT EXISTS waitlist     AUTHORIZATION adulis_migrate;

-- The two isolated boundaries carry no grant to the application role.
-- Appendix C check 10 watches this from here on. USAGE is granted to adulis_app
-- in migration 4 (and 10) because PostgreSQL requires USAGE before any role may
-- CALL a function in a schema; USAGE conveys no data access, and this was
-- verified empirically rather than assumed - see the Tier 1 report.
REVOKE ALL ON SCHEMA verification FROM PUBLIC;
REVOKE ALL ON SCHEMA financial    FROM PUBLIC;
REVOKE ALL ON SCHEMA verification FROM adulis_app;
REVOKE ALL ON SCHEMA financial    FROM adulis_app;

-- Section 3 gives adulis_app "Full DML" on core, chat and billing, read+insert
-- on nlu, insert on ledger, insert+read on analytics. The MECHANISM is not
-- specified there, so table-level grants are issued by the migration that
-- creates each table - which keeps an append-only REVOKE visible in the same
-- diff as the GRANT it narrows.
GRANT USAGE ON SCHEMA core, chat, nlu, billing, ledger, analytics TO adulis_app;
GRANT USAGE ON SCHEMA core, analytics                             TO adulis_readonly;
GRANT USAGE ON SCHEMA jobs                                        TO adulis_jobs;

-- ---------------------------------------------------------------------------
-- 4. Shared domains (section 4)
-- ---------------------------------------------------------------------------
CREATE DOMAIN core.currency_code AS char(3)
  CHECK (VALUE ~ '^[A-Z]{3}$');

CREATE DOMAIN core.e164 AS text
  CHECK (VALUE ~ '^\+[1-9][0-9]{7,14}$');

CREATE DOMAIN core.locale_code AS text
  CHECK (VALUE IN ('en', 'am'));   -- extended per market by migration, never by data

-- ---------------------------------------------------------------------------
-- 5. Enum types (Appendix A)
--
-- "All created in migration 1, so no later migration invents a value."
--
-- Transcribed in Appendix A order so a reviewer can diff this block against the
-- document row by row. 66 types, 230 values.
--
-- COUNTING DEFECT, REPORTED NOT RESOLVED. Appendix A's own header reads "54
-- types"; sections 0.1 and 0.2 both state 56; the enumerated catalogue contains
-- 66. The enumeration is unambiguous and is what is transcribed here. Appendix
-- B states the document's own doctrine for exactly this case - "Recount it
-- whenever the manifest changes; it is not decorative" - so the list governs
-- and the summary figure is what needs correcting. Work order T1 Gate B's
-- figure of 56 inherits the same defect. Needs an amendment in ADU-DB-01 v1.9.
-- ---------------------------------------------------------------------------

-- core
CREATE TYPE core.market_phase AS ENUM ('PHASE_1', 'PHASE_2');
CREATE TYPE core.platform AS ENUM ('TIKTOK', 'INSTAGRAM');
CREATE TYPE core.account_status AS ENUM ('ACTIVE', 'SUSPENDED', 'SCRUBBED');
CREATE TYPE core.device_platform AS ENUM ('ANDROID', 'IOS');
CREATE TYPE core.notification_permission AS ENUM ('GRANTED', 'DENIED', 'NOT_ASKED');
CREATE TYPE core.otp_purpose AS ENUM ('SIGN_IN', 'STEP_UP', 'ACCOUNT_DELETION', 'RECOVERY');
CREATE TYPE core.session_audience AS ENUM ('MOBILE', 'CONSOLE');
CREATE TYPE core.fulfilment_method AS ENUM (
  'BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY'
);
CREATE TYPE core.operator_role AS ENUM (
  'SUPPORT', 'MODERATOR', 'CLAIM_REVIEWER', 'IDENTITY_REVIEWER', 'ADMIN'
);
-- AMENDMENT A1.2 to ADU-DB-01 v1.9. Appendix A carried SIX values against the
-- EIGHT step-up permissions of ADU-AUTH-01 section 16.3, so
-- core.step_up_challenge.action could not record a challenge for
-- seller.identity:manage or seller.ownership:transfer - "the two most dangerous
-- actions in the system are the two that cannot be audited".
--
-- Added HERE, in migration 1 where enums are created, rather than by a later
-- ALTER TYPE: nothing is merged, so the type is rewritten rather than patched.
--
-- INVARIANT (A1.2) - core.step_up_action has exactly one value per permission
-- whose requires_step_up is true, and the two sets correspond ONE-TO-ONE. The
-- correspondence is asserted by test; A1.2 records it as a v1.10 candidate for
-- Appendix C, so a ninth step-up permission cannot be added without a value to
-- record its challenge.
CREATE TYPE core.step_up_action AS ENUM (
  'PAYOUT_CHANGE', 'REISSUE_INSTRUCTIONS', 'TEAM_CHANGE', 'SUBSCRIPTION_CHANGE',
  'SELLER_DELETION', 'REVOKE_ALL_SESSIONS', 'IDENTITY_CHANGE', 'OWNERSHIP_TRANSFER'
);
CREATE TYPE core.recovery_decision AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE core.team_role AS ENUM (
  'OWNER', 'ADMIN', 'SALES_SUPPORT', 'INVENTORY', 'ANALYST', 'CAMPAIGN_MANAGER'
);
CREATE TYPE core.seller_entity_type AS ENUM ('INDIVIDUAL', 'COMPANY');
CREATE TYPE core.seller_status AS ENUM (
  'DRAFT', 'ACTIVE', 'CLOSING', 'BILLING_SUSPENDED', 'SAFETY_SUSPENDED', 'DELETED'
);
CREATE TYPE core.social_verification_status AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');
CREATE TYPE core.follower_count_source AS ENUM ('PLATFORM_FETCH', 'MANUAL_FALLBACK');
CREATE TYPE core.eligibility_path AS ENUM ('AUDIENCE', 'IDENTITY');
CREATE TYPE core.eligibility_outcome AS ENUM ('SATISFIED', 'NOT_SATISFIED');
CREATE TYPE core.id_verification_requirement AS ENUM (
  'OPTIONAL', 'MANDATORY_WITHOUT_AUDIENCE', 'MANDATORY_ALL'
);
CREATE TYPE core.threshold_basis AS ENUM ('HIGHEST_SINGLE');
CREATE TYPE core.trust_level AS ENUM ('NEW', 'ESTABLISHED', 'TRUSTED');
CREATE TYPE core.level_change_source AS ENUM ('COMPUTED', 'MODERATION');
CREATE TYPE core.attribute_data_type AS ENUM ('TEXT', 'NUMBER', 'ENUM', 'BOOLEAN');
CREATE TYPE core.idempotency_actor_kind AS ENUM ('ACCOUNT', 'DEVICE');
CREATE TYPE core.rate_limit_subject_kind AS ENUM ('ACCOUNT', 'DEVICE', 'PHONE_HASH', 'IP_HASH');
CREATE TYPE core.product_visibility AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');
CREATE TYPE core.unpublished_reason AS ENUM (
  'SELLER', 'TIER_DOWNGRADE', 'LEVEL_DOWNGRADE', 'MODERATION'
);
CREATE TYPE core.media_class AS ENUM ('HOT', 'INFREQUENT');
CREATE TYPE core.social_post_status AS ENUM ('LIVE', 'UNAVAILABLE', 'UNKNOWN');
CREATE TYPE core.stock_event_reason AS ENUM (
  'SELLER_SET', 'ORDER_CREATED', 'ORDER_EXPIRED', 'LINE_CANCELLED', 'RECONCILIATION',
  'RESTOCK'
);
CREATE TYPE core.cart_status AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');
CREATE TYPE core.order_state AS ENUM (
  'CREATED', 'NOTIFIED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', 'HANDED_OFF', 'COMPLETED',
  'CANCELLED_BY_BUYER', 'CANCELLED_BY_SELLER', 'EXPIRED_UNCLAIMED'
);
CREATE TYPE core.reservation_state AS ENUM (
  'ACTIVE', 'FULFILLED', 'CANCELLED_BY_BUYER', 'CANCELLED_BY_SELLER', 'REFUNDED', 'EXPIRED'
);
CREATE TYPE core.cancelled_by AS ENUM ('BUYER', 'SELLER', 'SYSTEM');
CREATE TYPE core.payment_submission_state AS ENUM ('SUBMITTED', 'CONFIRMED', 'REJECTED');
CREATE TYPE core.payout_state AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED', 'SUPERSEDED');
CREATE TYPE core.scan_validity AS ENUM ('VALID', 'LATE', 'REJECTED_REPLAY', 'REJECTED_HORIZON');
CREATE TYPE core.confirmation_tier AS ENUM (
  'VERIFIED_HANDOFF', 'CONFIRMED_BY_BUYER', 'UNCONFIRMED'
);
CREATE TYPE core.review_badge AS ENUM (
  'CLAIM_UPHELD', 'VERIFIED_HANDOFF', 'CONFIRMED_BY_BUYER', 'UNVERIFIED'
);
CREATE TYPE core.claim_opener_kind AS ENUM ('BUYER', 'SYSTEM', 'MODERATION');
CREATE TYPE core.claim_trigger AS ENUM (
  'SLA_BREACH', 'STOCK_NOT_UPDATED', 'GOODS_NOT_RECEIVED', 'NOT_AS_DESCRIBED',
  'REFUND_NOT_DELIVERED'
);
CREATE TYPE core.claim_outcome AS ENUM ('UPHELD', 'NOT_UPHELD');
CREATE TYPE core.claim_evidence_kind AS ENUM (
  'CHAT_HISTORY', 'SCAN_RECORD', 'PAYMENT_EVIDENCE', 'BANK_RECORD', 'STOCK_EVENTS',
  'ORDER_TRANSITIONS', 'SELLER_LEVEL_AT_ORDER', 'ACTING_TEAM_MEMBER'
);
CREATE TYPE core.follow_state AS ENUM ('FOLLOWING', 'UNFOLLOWED');
CREATE TYPE core.seller_activity_kind AS ENUM (
  'NEW_PRODUCT', 'RESTOCK', 'BROADCAST', 'STOREFRONT_UPDATE'
);
CREATE TYPE core.broadcast_kind AS ENUM ('RESTOCK', 'DISCOUNT');
CREATE TYPE core.notification_channel AS ENUM ('PUSH', 'SMS', 'IN_APP');
CREATE TYPE core.actor_channel AS ENUM ('WEB', 'MOBILE', 'SYSTEM');
CREATE TYPE core.claim_state AS ENUM (
  'AWAITING_BUYER_EVIDENCE', 'AWAITING_SELLER_EVIDENCE', 'AWAITING_BANK_TRACE', 'UNDER_REVIEW',
  'RESOLVED'
);
CREATE TYPE core.claim_severity AS ENUM ('ORDINARY', 'PAYMENT_FRAUD');
CREATE TYPE core.claim_remedy AS ENUM ('REFUND', 'FULFIL', 'NONE');
CREATE TYPE core.notification_state AS ENUM (
  'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SUPPRESSED'
);
CREATE TYPE core.report_target_kind AS ENUM (
  'PRODUCT', 'REVIEW', 'MESSAGE', 'SELLER', 'STOREFRONT'
);
CREATE TYPE core.moderation_queue_kind AS ENUM (
  'PROHIBITED_KEYWORD', 'NEW_SELLER', 'NEW_LEVEL_FIRST_LISTING', 'SENSITIVE_CATEGORY',
  'POST_LINK_CONFLICT', 'DOUBLE_ALLOCATION', 'REPORT', 'VELOCITY'
);
CREATE TYPE core.active_orders_decision AS ENUM ('CONTINUE', 'TERMINATE');

-- verification
CREATE TYPE verification.verifier_kind AS ENUM ('KYC_VENDOR', 'VIDEO_CALL');

-- financial
CREATE TYPE financial.retention_reason AS ENUM ('AWAITING_VALIDATION', 'OPEN_CLAIM');
CREATE TYPE financial.secret_subject_kind AS ENUM ('PAYMENT_EVIDENCE', 'PAYOUT_CREDENTIAL');

-- chat
CREATE TYPE chat.message_sender_kind AS ENUM ('BUYER', 'SELLER', 'TEAM_MEMBER', 'BOT');
CREATE TYPE chat.resolution_path AS ENUM (
  'STRUCTURE', 'CHIP', 'KEYWORD', 'EMBEDDING', 'CLASSIFIER', 'ESCALATED'
);

-- nlu
CREATE TYPE nlu.phrase_source AS ENUM ('SEED', 'HARVESTED');

-- billing
CREATE TYPE billing.subscription_state AS ENUM (
  'BETA', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'
);
CREATE TYPE billing.subscription_tier AS ENUM ('LISTED', 'ASSISTED', 'VERIFIED_PRO', 'BUSINESS');
CREATE TYPE billing.subscription_term AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- ledger
CREATE TYPE ledger.entry_direction AS ENUM ('DEBIT', 'CREDIT');

-- waitlist
CREATE TYPE waitlist.platform AS ENUM ('TIKTOK', 'INSTAGRAM');

-- ---------------------------------------------------------------------------
-- 6. Shared trigger functions (section 4)
--
-- The append-only mechanism, applied to every table marked append-only in
-- Appendix B and ALWAYS together with REVOKE UPDATE, DELETE - two mechanisms
-- "because the first is invisible in a migration diff and the second is
-- invisible in a permissions audit". Appendix C check 5 counts 22 of each and
-- compares the two table sets, not just the two totals.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'Table %.% is append-only; % is not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END
$fn$;

-- Down Migration

-- ADU-CON-02 v3.0 section 19: "a migration is never edited after it has run
-- anywhere - write a new one. Rollback: schema = ROLL FORWARD with a correcting
-- migration." A down-migration that quietly drops the foundation of the schema
-- is the opposite of that doctrine, so it refuses instead.
DO $down$
BEGIN
  RAISE EXCEPTION
    'Down-migrations are not used on Adulis. Roll forward with a correcting migration (ADU-CON-02 v3.0 section 19).'
    USING ERRCODE = 'restrict_violation';
END
$down$;

