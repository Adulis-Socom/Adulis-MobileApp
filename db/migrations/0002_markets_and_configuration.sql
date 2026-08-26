-- ===========================================================================
-- MIGRATION 02 - MARKETS AND ALL CONFIGURATION TABLES
--
-- Source: ADU-DB-01 v1.9 section 28 item 2 - "Markets and all configuration
-- tables". Transcribed from sections 5.1, 5.2, 5.3 and 5.4.
--
-- Section 5.4 is new in v1.9 and is defect D8: locale_pack, identity_config
-- and legal_config were named in the manifest through v1.8 with not one column
-- defined anywhere. They are defined now, and this migration is the first that
-- could be written.
--
-- Eight tables. Six carry the section 4 effective-range pattern, which is what
-- Appendix C check 7 counts.
--
-- THREE PLACES WHERE THE DOCUMENT DESCRIBES A COLUMN WITHOUT NAMING IT are
-- marked "NOT NAMED" below and are omitted rather than invented. Work order T1
-- section 3: transcribe, do not design. They are itemised in the Tier 1 report.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.market (section 5.1)
-- ---------------------------------------------------------------------------
CREATE TABLE core.market (
  id                uuid PRIMARY KEY,
  code              text NOT NULL UNIQUE,              -- 'ET', 'KE', ...
  display_name      text NOT NULL,
  phase             core.market_phase NOT NULL,
  display_currency  core.currency_code NOT NULL,
  display_timezone  text NOT NULL,                     -- IANA name
  default_locale    core.locale_code NOT NULL,
  is_live           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN core.market.phase IS
  'INVARIANT (section 5.1) - phase is a column on the market, never a global '
  'flag. A mature home market may be PHASE_2 while a new market opens PHASE_1.';

COMMENT ON COLUMN core.market.display_timezone IS
  'IANA name. Read by core.fn_seller_availability_state (section 13.1b) to '
  'resolve an override date in the market timezone rather than in UTC. v1.8 '
  'read m.timezone here and did not compile; D5 in v1.9.';

-- ---------------------------------------------------------------------------
-- 2. core.market_phase_gate (section 5.2)
--
-- "One row per market. v3_discovery_live boolean, kyc_vendor_integrated
-- boolean, ladder_operating boolean, dpia_revisited_at timestamptz, each with
-- attested_by and attested_at. Set by admin action, logged."
--
-- READING TAKEN, AND IT IS A READING. "each with attested_by and attested_at"
-- admits two constructions: one attestation pair per condition (eight further
-- columns, none of them named), or one pair on the row. The row-level reading
-- is taken because it invents no column name; the per-condition reading cannot
-- be built without inventing eight. Recorded in the Tier 1 report.
-- ---------------------------------------------------------------------------
CREATE TABLE core.market_phase_gate (
  market_id             uuid PRIMARY KEY REFERENCES core.market(id),
  v3_discovery_live     boolean NOT NULL DEFAULT false,
  kyc_vendor_integrated boolean NOT NULL DEFAULT false,
  ladder_operating      boolean NOT NULL DEFAULT false,
  dpia_revisited_at     timestamptz NULL,
  attested_by           uuid NULL,      -- account; FK deferred, see the note below
  attested_at           timestamptz NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- INVARIANT (section 5.1) - market.phase cannot be set to PHASE_2 unless the
-- three gate conditions are all satisfied. "ADU-PROJ-01 section 11 phase 5
-- makes those conditions build dependencies, not policy preferences; a trigger
-- is the difference between a dependency and a hope."
CREATE FUNCTION core.fn_guard_market_phase() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE g core.market_phase_gate;
BEGIN
  IF NEW.phase = 'PHASE_2' AND OLD.phase IS DISTINCT FROM 'PHASE_2' THEN
    SELECT * INTO g FROM core.market_phase_gate WHERE market_id = NEW.id;
    IF NOT FOUND
       OR NOT g.v3_discovery_live
       OR NOT g.kyc_vendor_integrated
       OR NOT g.ladder_operating THEN
      RAISE EXCEPTION 'Market % cannot enter PHASE_2: gate conditions unsatisfied', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_guard_market_phase
  BEFORE UPDATE ON core.market
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_market_phase();

-- ---------------------------------------------------------------------------
-- 3. The six versioned configuration tables (sections 5.3, 5.4)
--
-- Section 4's effective-range mechanism, reproduced on each with its own scope
-- columns:
--
--   effective tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
--   EXCLUDE USING gist (market_id WITH =, effective WITH &&)
--
-- "Two versions of the same configuration can never be in force at the same
-- moment, and history is retained rather than overwritten."
--
-- Doctrine 6 (section 2): configuration is versioned rows with effective
-- ranges, never constants and never a settings singleton.
--
-- created_by_account_id IS A BARE uuid WITH NO FOREIGN KEY. core.account is
-- created by migration 3 (section 28 item 3) and these tables by migration 2,
-- so the reference the document describes cannot be expressed here. Adding the
-- constraint later is one ALTER; reordering the migrations is not, because
-- section 5.3's config rows are what migration 3's session lifetimes read.
-- Recorded in the Tier 1 report.
-- ---------------------------------------------------------------------------

CREATE TABLE core.eligibility_config (
  id                          uuid PRIMARY KEY,
  market_id                   uuid NOT NULL REFERENCES core.market(id),
  audience_required           boolean NOT NULL,
  follower_threshold          int NULL,
  counting_platforms          core.platform[] NOT NULL,
  threshold_basis             core.threshold_basis NOT NULL,
  permitted_seller_types      core.seller_entity_type[] NOT NULL,
  id_verification_requirement core.id_verification_requirement NOT NULL,
  effective                   tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
  created_by_account_id       uuid NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (market_id WITH =, effective WITH &&)
);

COMMENT ON COLUMN core.eligibility_config.follower_threshold IS
  'INVARIANT (section 5.3, PRD section 4.1) - nullable, and null means NO '
  'threshold. Not zero, which would read as "a threshold of zero exists". Not '
  'a magic sentinel. Setting a number later is an INSERT of a new effective '
  'row and touches no code.';

-- PARTIAL. Section 5.3 says ladder_config carries "Established/Trusted
-- thresholds, new_level_product_cap, new_level_transaction_cap_minor,
-- demotion rules, distinct-buyer window and count".
--
--   NAMED and built:     new_level_product_cap, new_level_transaction_cap_minor,
--                        distinct_buyer_window, max_handoffs_per_buyer
--                        (the last two from section 8.2, which names them)
--   NOT NAMED, omitted:  the Established and Trusted thresholds, and the
--                        demotion rules.
--
-- Section 8.1's fn_recompute_seller_level (migration 8) reads the thresholds,
-- so migration 8 cannot be written until v1.10 names them. Omitted rather than
-- guessed: a threshold column with an invented name is one the recompute
-- function will not find, and the failure surfaces as a seller who never
-- advances rather than as an error.
CREATE TABLE core.ladder_config (
  id                               uuid PRIMARY KEY,
  market_id                        uuid NOT NULL REFERENCES core.market(id),
  new_level_product_cap            int NOT NULL,
  new_level_transaction_cap_minor  bigint NOT NULL CHECK (new_level_transaction_cap_minor >= 0),
  distinct_buyer_window            interval NOT NULL,
  max_handoffs_per_buyer           int NOT NULL,
  effective                        tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
  created_by_account_id            uuid NULL,
  created_at                       timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (market_id WITH =, effective WITH &&)
);

-- Section 5.3, plus section 6.6a's four console columns (R17), section 12.4a's
-- payment_confirmation_window, and ADU-AUTH-01 v2.2 section 25's four OTP and
-- step-up columns.
--
-- NOT NAMED, omitted: the cancellation-penalty ladder. Section 5.3 lists it and
-- section 12.7 says "the escalation ladder is timing_config, not literals in a
-- service" - neither names a column. PRD section 9.5 describes the behaviour
-- (three consecutive cancellations with one seller, 1 hour; a pattern across
-- sellers, 1 day then 2 days escalating; decay after 30 days) but a ladder is
-- not obviously one column, and choosing between an interval[] and a set of
-- scalars is a design decision. Migration 9's buyer_cancellation_counter needs
-- it; migration 2 does not.
CREATE TABLE core.timing_config (
  id                          uuid PRIMARY KEY,
  market_id                   uuid NOT NULL REFERENCES core.market(id),

  -- PRD section 25 items, shipping at the PRD's stated defaults
  reservation_window          interval NOT NULL,   -- 48h
  fulfilment_window           interval NOT NULL,
  offline_sync_horizon        interval NOT NULL,   -- 7d
  payout_activation_delay     interval NOT NULL,   -- 24h
  recovery_cooling_period     interval NOT NULL,   -- 7d
  deleted_number_cooling_period interval NOT NULL,
  refund_ack_window           interval NOT NULL,
  media_retention             interval NOT NULL,
  level_credit_grace          interval NOT NULL,   -- 24h
  payment_confirmation_window interval NOT NULL,   -- 24h, section 12.4a

  -- Session lifetimes. buyer_session_lifetime and seller_session_lifetime are
  -- section 5.3's names and predate R2; console_* are R17's (section 6.6a).
  -- Both sets are carried because both are named in the document. The overlap
  -- between seller_session_lifetime and console_session_lifetime is recorded
  -- in the Tier 1 report - under R2 there is no SELLER audience for the first
  -- to describe.
  buyer_session_lifetime      interval NOT NULL,   -- MOBILE, 30 days
  seller_session_lifetime     interval NOT NULL,
  console_session_lifetime    interval NOT NULL,   -- 12h
  console_idle_timeout        interval NOT NULL,   -- 30 min
  console_remembered_lifetime interval NOT NULL,   -- 7 days
  console_remembered_idle     interval NOT NULL,   -- 8 hours

  -- ADU-AUTH-01 v2.2 sections 4.1, 7.2, 9.2 and 25
  otp_ttl                     interval NOT NULL,   -- 5 min
  otp_max_attempts            int NOT NULL,        -- 5
  step_up_freshness           interval NOT NULL,   -- 5 min
  new_device_payout_lock      interval NOT NULL,   -- 24h

  effective                   tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
  created_by_account_id       uuid NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),

  -- INVARIANT (sections 6.6, 6.6a) - the CHECK orders BOTH console pairs
  -- against the mobile lifetime, "so a configuration edit cannot make a console
  -- session outlive a mobile one in either mode". Stated in section 6.6 as
  -- "a CONSOLE session is shorter than a MOBILE one".
  CONSTRAINT console_shorter_than_mobile CHECK (
    console_session_lifetime    < buyer_session_lifetime
    AND console_remembered_lifetime < buyer_session_lifetime
  ),
  -- Idle must not exceed its own absolute lifetime, or the idle bound is dead.
  CONSTRAINT console_idle_within_absolute CHECK (
    console_idle_timeout    <= console_session_lifetime
    AND console_remembered_idle <= console_remembered_lifetime
  ),
  EXCLUDE USING gist (market_id WITH =, effective WITH &&)
);

-- D8, section 5.4.
CREATE TABLE core.locale_pack (
  id                          uuid PRIMARY KEY,
  market_id                   uuid NOT NULL REFERENCES core.market(id),
  default_locale              core.locale_code NOT NULL,
  available_locales           core.locale_code[] NOT NULL,
  machine_translation_enabled boolean NOT NULL,
  effective                   tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
  created_by_account_id       uuid NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT default_locale_is_available CHECK (default_locale = ANY(available_locales)),
  CONSTRAINT available_locales_not_empty CHECK (cardinality(available_locales) > 0),
  EXCLUDE USING gist (market_id WITH =, effective WITH &&)
);

COMMENT ON TABLE core.locale_pack IS
  'Section 5.4 - this is NOT the AM_ENABLED build flag. That flag governs '
  'whether the console renders a language switcher (ADU-CON-02 section 9); '
  'this row governs what the SERVER will accept and render. A locale is '
  'legitimately available here and hidden in the client, which is exactly the '
  'state while Amharic is machine-translated and awaiting human review.';

-- D8, section 5.4. verifier_kind is verification.verifier_kind, whose values
-- are one of the six types v1.9's Appendix A defines twice and inconsistently.
-- The carried-forward "Other schemas" table governs here - see migration 1 and
-- the Tier 1 report.
CREATE TABLE core.identity_config (
  id                       uuid PRIMARY KEY,
  market_id                uuid NOT NULL REFERENCES core.market(id),
  identity_required        boolean NOT NULL,
  verifier_kind            verification.verifier_kind NOT NULL,
  accepted_id_types        text[] NOT NULL,
  vendor_reference_pattern text NULL,
  effective                tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
  created_by_account_id    uuid NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  -- "a market that requires identity must say what it accepts"
  CONSTRAINT accepted_types_when_required CHECK (
    NOT identity_required OR cardinality(accepted_id_types) > 0
  ),
  EXCLUDE USING gist (market_id WITH =, effective WITH &&)
);

COMMENT ON TABLE core.identity_config IS
  'INVARIANT (section 5.4) - no vendor credential lives here. Endpoints and '
  'API keys are deployment secrets (ADU-CON-02 section 18). This row says '
  'WHICH vendor family and WHAT it must return, never how to reach it.';

-- D8, section 5.4. One row per market per version.
CREATE TABLE core.legal_config (
  id                              uuid PRIMARY KEY,
  market_id                       uuid NOT NULL REFERENCES core.market(id),
  terms_version                   text NOT NULL,
  terms_url                       text NOT NULL,
  privacy_version                 text NOT NULL,
  privacy_url                     text NOT NULL,
  seller_agreement_version        text NOT NULL,
  seller_agreement_url            text NOT NULL,
  requires_reacceptance           boolean NOT NULL,
  evidence_retention              interval NOT NULL,
  chat_retention                  interval NOT NULL,
  analytics_retention             interval NOT NULL,
  prohibited_categories           text[] NOT NULL,
  invoice_number_format           text NOT NULL,
  effective                       tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
  created_by_account_id           uuid NULL,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (market_id WITH =, effective WITH &&)
);

COMMENT ON TABLE core.legal_config IS
  'INVARIANT (section 5.4) - the legal TEXT is not stored in the database. '
  'Only a version label and a URL. The text is served from the public website '
  'and versioned there; holding a second copy here creates two texts that can '
  'disagree about what a person actually agreed to. An acceptance record '
  'points at terms_version, not at prose. Retention intervals are '
  'configuration, not constants - which is what stops a purge job hard-coding '
  'ninety days in one place and one hundred and eighty in another.';

-- ---------------------------------------------------------------------------
-- 4. Grants (section 3 - core is "Full DML" for the application role)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  core.market,
  core.market_phase_gate,
  core.eligibility_config,
  core.ladder_config,
  core.timing_config,
  core.locale_pack,
  core.identity_config,
  core.legal_config
TO adulis_app;

GRANT SELECT ON
  core.market,
  core.market_phase_gate,
  core.eligibility_config,
  core.ladder_config,
  core.timing_config,
  core.locale_pack,
  core.identity_config,
  core.legal_config
TO adulis_readonly;

-- Down Migration

-- ADU-DB-01 section 19 / ADU-CON-02 section 19 doctrine is roll forward. A
-- down migration that drops configuration tables would drop every market's
-- versioned history with them, and the effective-range pattern exists so that
-- history is retained rather than overwritten. Recovery is a new migration.
DO $$
BEGIN
  RAISE EXCEPTION
    'Migration 02 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $$;
