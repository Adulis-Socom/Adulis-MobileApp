-- ===========================================================================
-- MIGRATION 02 - MARKETS AND ALL CONFIGURATION TABLES
--
-- Source: ADU-DB-01 v1.10 section 28 item 2 - "Markets and all configuration
-- tables". Transcribed from sections 5.1, 5.2, 5.3, 5.4 and 5.5.
--
-- v1.10 closes register items C1, C2, C6 and C7, all of which land here:
--   C6  market_phase_gate is THIRTEEN columns, not six - attestation is per
--       CONDITION, because section 5.2 said "each with" and meant it.
--   C1  ladder_config gains its sixteen columns. The COLUMNS are named here;
--       the VALUES are deferred to ADU-VAL-01 Groups A, B and C.
--   C2  timing_config gains the cancellation-penalty ladder, which was never
--       open - ADU-PRD-01 section 9.5 had it all along and nobody transcribed it.
--   C7  buyer_session_lifetime becomes mobile_session_lifetime, and
--       seller_session_lifetime is DROPPED. R2 collapsed the audiences, so the
--       column described an audience that no longer exists.
--
-- Eight tables. Six carry the section 4 effective-range pattern, which is what
-- Appendix C check 7 counts.
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
  'resolve an override date in the market timezone rather than in UTC.';

-- ---------------------------------------------------------------------------
-- 2. core.market_phase_gate (section 5.2) - C6, THIRTEEN COLUMNS
--
-- "Per condition, not per row, and the difference is the whole point. One
--  attestation pair for the row records that SOMEBODY SIGNED OFF ON SOMETHING.
--  Four pairs record WHO ATTESTED WHICH GATE AND WHEN - which is the question
--  asked when a market went live and one of the four turns out not to have
--  been true."
--
-- The previous revision of this migration read "each with" the other way and
-- built one pair on the row, because that invented no column name. v1.10 names
-- all twelve, so the reading is settled and the row-level version is discarded.
--
-- attested_by is a BARE uuid with no foreign key: core.account is migration 3
-- and this is migration 2. Register deferral D1, same as created_by_account_id.
-- ---------------------------------------------------------------------------
CREATE TABLE core.market_phase_gate (
  market_id                          uuid PRIMARY KEY REFERENCES core.market(id),

  v3_discovery_live                  boolean NOT NULL DEFAULT false,
  v3_discovery_live_attested_by      uuid NULL,
  v3_discovery_live_attested_at      timestamptz NULL,

  kyc_vendor_integrated              boolean NOT NULL DEFAULT false,
  kyc_vendor_integrated_attested_by  uuid NULL,
  kyc_vendor_integrated_attested_at  timestamptz NULL,

  ladder_operating                   boolean NOT NULL DEFAULT false,
  ladder_operating_attested_by       uuid NULL,
  ladder_operating_attested_at       timestamptz NULL,

  dpia_revisited_at                  timestamptz NULL,
  dpia_revisited_attested_by         uuid NULL,
  dpia_revisited_attested_at         timestamptz NULL,

  created_at                         timestamptz NOT NULL DEFAULT now(),
  updated_at                         timestamptz NOT NULL DEFAULT now(),

  -- "A CHECK requires the attestation pair to be non-null whenever its
  -- condition is set." An unattested gate condition is an assertion with
  -- nobody's name on it, which is the thing section 5.2 exists to prevent.
  CONSTRAINT v3_discovery_live_attested CHECK (
    NOT v3_discovery_live
    OR (v3_discovery_live_attested_by IS NOT NULL AND v3_discovery_live_attested_at IS NOT NULL)
  ),
  CONSTRAINT kyc_vendor_integrated_attested CHECK (
    NOT kyc_vendor_integrated
    OR (kyc_vendor_integrated_attested_by IS NOT NULL AND kyc_vendor_integrated_attested_at IS NOT NULL)
  ),
  CONSTRAINT ladder_operating_attested CHECK (
    NOT ladder_operating
    OR (ladder_operating_attested_by IS NOT NULL AND ladder_operating_attested_at IS NOT NULL)
  ),
  CONSTRAINT dpia_revisited_attested CHECK (
    dpia_revisited_at IS NULL
    OR (dpia_revisited_attested_by IS NOT NULL AND dpia_revisited_attested_at IS NOT NULL)
  )
);

COMMENT ON TABLE core.market_phase_gate IS
  'Section 5.2 - one row per market, four conditions, each with its own '
  'attestation pair. Set by operator action under core.operator_grant, logged. '
  'The three boolean conditions gate PHASE_2; dpia_revisited_at is a date '
  'rather than a flag because the DPIA is revisited rather than completed.';

-- INVARIANT (section 5.1) - market.phase cannot be set to PHASE_2 unless the
-- three gate conditions are all satisfied. "ADU-PROJ-01 section 11 phase 5
-- makes those conditions build dependencies, not policy preferences; a trigger
-- is the difference between a dependency and a hope."
--
-- Note that dpia_revisited_at is NOT one of the three. Section 5.1 says "the
-- three gate conditions", and section 5.2 lists four columns of which one is a
-- timestamp rather than a condition. The DPIA revisit is recorded here and
-- gates nothing automatically.
CREATE FUNCTION core.fn_guard_market_phase() RETURNS trigger
LANGUAGE plpgsql AS $fn$
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
END $fn$;

CREATE TRIGGER trg_guard_market_phase
  BEFORE UPDATE ON core.market
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_market_phase();

-- ---------------------------------------------------------------------------
-- 3. The six versioned configuration tables (sections 5.3, 5.4, 5.5)
--
-- Section 4's effective-range mechanism, reproduced on each with its own scope
-- columns:
--
--   effective tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
--   EXCLUDE USING gist (market_id WITH =, effective WITH &&)
--
-- Doctrine 6: configuration is versioned rows with effective ranges, never
-- constants and never a settings singleton.
--
-- created_by_account_id IS A BARE uuid WITH NO FOREIGN KEY - register deferral
-- D1, now recorded in v1.10 section 28.1: "Configuration precedes accounts, and
-- the alternative is moving every config table after identity."
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
  'threshold. Not zero, which would read as "a threshold of zero exists". The '
  'VALUE is ADU-VAL-01 item 3.1 - "the number the beta exists to discover; do '
  'not guess it". Setting one later is an INSERT of a new effective row.';

-- ---------------------------------------------------------------------------
-- core.ladder_config - C1. Sixteen columns, from v1.10 section 5.5.
--
-- THE COLUMNS ARE NAMED HERE AND THE VALUES ARE NOT, AND THAT IS THE POINT.
-- v1.10: "an unnamed column blocks migration 8; an unseeded row blocks only
-- the market seed - so naming them now and deferring the values costs nothing
-- and unblocks the next two migrations."
--
-- Every value below is ADU-VAL-01 Group A (thresholds and demotion), Group B
-- (new-level caps) or Group C (anti-gaming). Per work order T2 section 1.1
-- those are DELIBERATE deferrals and are not reported as spec gaps.
--
-- RATES ARE numeric, NEVER float. "A claim rate compared against a threshold
-- decides whether a livelihood is restricted; binary floating point is the
-- wrong type for a comparison whose result someone will contest."
--
-- demotion_* is a SEPARATE set from established_*, deliberately: "a seller
-- demoted the instant they fall below the bar they climbed would oscillate on
-- a single bad week. The gap between the two sets is hysteresis."
-- ---------------------------------------------------------------------------
CREATE TABLE core.ladder_config (
  id                                uuid PRIMARY KEY,
  market_id                         uuid NOT NULL REFERENCES core.market(id),

  -- Group A - promotion to ESTABLISHED
  established_min_handoffs          int NOT NULL,
  established_window                interval NOT NULL,
  established_min_avg_rating        numeric(3,2) NOT NULL,
  established_max_claim_rate        numeric(5,4) NOT NULL,

  -- Group A - promotion to TRUSTED
  trusted_min_handoffs              int NOT NULL,
  trusted_window                    interval NOT NULL,
  trusted_min_scan_completion_rate  numeric(5,4) NOT NULL,
  trusted_max_claim_rate            numeric(5,4) NOT NULL,

  -- Group A - demotion. Hysteresis, not the promotion bar read backwards.
  demotion_max_claim_rate           numeric(5,4) NOT NULL,
  demotion_max_cancellation_rate    numeric(5,4) NOT NULL,
  demotion_min_scan_completion_rate numeric(5,4) NOT NULL,
  demotion_window                   interval NOT NULL,

  -- Group B - the two numbers a beta seller feels first
  new_level_product_cap             int NOT NULL,
  new_level_transaction_cap_minor   bigint NOT NULL,

  -- Group C - anti-gaming
  distinct_buyer_window             interval NOT NULL,
  distinct_buyer_max_count          int NOT NULL,

  effective                         tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
  created_by_account_id             uuid NULL,
  created_at                        timestamptz NOT NULL DEFAULT now(),

  -- Rates are proportions. A "maximum claim rate" of 3 is a typo, not a policy.
  CONSTRAINT ladder_rates_are_proportions CHECK (
    established_min_avg_rating        BETWEEN 1 AND 5
    AND established_max_claim_rate        BETWEEN 0 AND 1
    AND trusted_min_scan_completion_rate  BETWEEN 0 AND 1
    AND trusted_max_claim_rate            BETWEEN 0 AND 1
    AND demotion_max_claim_rate           BETWEEN 0 AND 1
    AND demotion_max_cancellation_rate    BETWEEN 0 AND 1
    AND demotion_min_scan_completion_rate BETWEEN 0 AND 1
  ),
  CONSTRAINT ladder_caps_non_negative CHECK (
    new_level_product_cap           >= 0
    AND new_level_transaction_cap_minor >= 0
    AND distinct_buyer_max_count        >= 1
  ),
  -- ADU-VAL-01 Group C: "Set the count above one. At one, you punish the
  -- loyal-customer pattern that a good small retailer actually has, and the
  -- false-positive lands on your best sellers." The constraint holds the floor
  -- the register argues for; the value itself is still Group C's to choose.
  EXCLUDE USING gist (market_id WITH =, effective WITH &&)
);

COMMENT ON TABLE core.ladder_config IS
  'INVARIANT (PRD section 5.1) - all thresholds are per-market configuration '
  'records, PUBLISHED TO SELLERS AND NEVER SECRET. A ladder whose rungs are '
  'hidden is indistinguishable from favouritism, and the product claim is that '
  'trust is earned by evidence rather than granted. Values: ADU-VAL-01 A, B, C.';

COMMENT ON COLUMN core.ladder_config.distinct_buyer_max_count IS
  'How many times one buyer''s handoffs may count toward one seller''s level '
  'inside distinct_buyer_window. NOTE: section 8.2 calls this column '
  'max_handoffs_per_buyer while section 5.5 names it distinct_buyer_max_count. '
  'Section 5.5 is the column definition and governs; reported for v1.11.';

-- ---------------------------------------------------------------------------
-- core.timing_config - C2 and C7.
--
-- C2 WAS NEVER OPEN. ADU-PRD-01 section 9.5 states the cancellation ladder in
-- full; section 5.3 described it and nobody transcribed it. These are SET,
-- not deferred - ADU-VAL-01 marks the row "SET, transcribe don't decide".
--
-- C7 - there is no seller_session_lifetime and there cannot be. R2 collapsed
-- the audiences to MOBILE and CONSOLE, so the lifetime columns are
-- mobile_session_lifetime plus section 6.6a's four console columns. The CHECK
-- now NAMES mobile_session_lifetime rather than inferring which column is the
-- mobile one, which is what the previous revision had to do.
-- ---------------------------------------------------------------------------
CREATE TABLE core.timing_config (
  id                          uuid PRIMARY KEY,
  market_id                   uuid NOT NULL REFERENCES core.market(id),

  -- PRD section 25 items, shipping at the PRD's stated defaults (ADU-VAL-01 s2)
  reservation_window          interval NOT NULL,   -- 48h
  payment_confirmation_window interval NOT NULL,   -- 24h, section 12.4a
  fulfilment_window           interval NOT NULL,   -- ADU-VAL-01 3.2, OPEN
  offline_sync_horizon        interval NOT NULL,   -- 7d
  payout_activation_delay     interval NOT NULL,   -- 24h
  recovery_cooling_period     interval NOT NULL,   -- 7d
  deleted_number_cooling_period interval NOT NULL, -- ADU-VAL-01 3.4, OPEN
  refund_ack_window           interval NOT NULL,   -- ADU-VAL-01 3.3, OPEN
  media_retention             interval NOT NULL,   -- ADU-VAL-01 3.5, OPEN
  level_credit_grace          interval NOT NULL,   -- 24h

  -- Session lifetimes. C7: mobile plus the four console columns, and nothing
  -- describing an audience that no longer exists.
  mobile_session_lifetime     interval NOT NULL,   -- 30 days
  console_session_lifetime    interval NOT NULL,   -- 12h
  console_idle_timeout        interval NOT NULL,   -- 30 min
  console_remembered_lifetime interval NOT NULL,   -- 7 days, R17
  console_remembered_idle     interval NOT NULL,   -- 8 hours, R17

  -- ADU-AUTH-01 sections 4.1, 7.2, 9.2, 25
  otp_ttl                     interval NOT NULL,   -- 5 min
  otp_max_attempts            int NOT NULL,        -- 5
  step_up_freshness           interval NOT NULL,   -- 5 min
  new_device_payout_lock      interval NOT NULL,   -- 24h

  -- C2 - the cancellation-penalty ladder, ADU-PRD-01 section 9.5
  same_seller_cancellation_threshold int NOT NULL,        -- 3
  same_seller_cooldown               interval NOT NULL,   -- 1 hour
  cross_seller_cooldown_ladder       interval[] NOT NULL, -- {1 day, 2 days, 4 days}
  cancellation_counter_decay         interval NOT NULL,   -- 30 days clean

  effective                   tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
  created_by_account_id       uuid NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),

  -- INVARIANT (sections 6.6, 6.6a) - the CHECK orders BOTH console pairs
  -- against the MOBILE lifetime, "so a configuration edit cannot make a
  -- console session outlive a mobile one in either mode". C7 is why the column
  -- is named rather than inferred.
  CONSTRAINT console_shorter_than_mobile CHECK (
    console_session_lifetime        < mobile_session_lifetime
    AND console_remembered_lifetime < mobile_session_lifetime
  ),
  -- An idle bound above its own absolute lifetime is a bound that never fires.
  CONSTRAINT console_idle_within_absolute CHECK (
    console_idle_timeout            <= console_session_lifetime
    AND console_remembered_idle     <= console_remembered_lifetime
  ),
  -- "The ladder is an interval[], indexed by offence count, and the final
  -- element repeats. An escalating penalty with no ceiling eventually bans a
  -- buyer permanently for cancelling, which is not what section 9.5 describes."
  CONSTRAINT cross_seller_ladder_not_empty CHECK (
    cardinality(cross_seller_cooldown_ladder) > 0
  ),
  CONSTRAINT same_seller_threshold_positive CHECK (same_seller_cancellation_threshold > 0),
  CONSTRAINT otp_max_attempts_positive CHECK (otp_max_attempts > 0),
  EXCLUDE USING gist (market_id WITH =, effective WITH &&)
);

COMMENT ON COLUMN core.timing_config.cross_seller_cooldown_ladder IS
  'PRD section 9.5 - a pattern across sellers costs 1 day, then 2 days, '
  'escalating. Indexed by offence count; THE FINAL ELEMENT REPEATS rather than '
  'the ladder growing without bound, because a terminal penalty inverts the '
  'doctrine that "cancelling actively is penalised less than letting an order '
  'expire silently".';

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

-- D8, section 5.4.
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

-- ADU-CON-02 section 19 doctrine is roll forward. A down migration that drops
-- configuration tables would drop every market's versioned history with them,
-- and the effective-range pattern exists so that history is retained rather
-- than overwritten. Recovery is a new migration.
DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 02 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
