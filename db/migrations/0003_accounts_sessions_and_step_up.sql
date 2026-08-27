-- ===========================================================================
-- MIGRATION 03 - ACCOUNTS, PERSONS, DEVICES, SESSIONS, STEP-UP, RECOVERY
--
-- Source: ADU-DB-01 v1.10 section 28 item 3 - "Accounts, persons, devices,
-- account_device (R17), OTP, sessions, step-up, recovery".
--
-- Transcribed from sections 6.1 through 6.8, plus ADU-AUTH-01 v2.4 section 13
-- for the age declaration.
--
-- Nine tables. One append-only (account_recovery_case, Appendix B).
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.person (section 6.2)
--
-- Created BEFORE account, because account.person_id references it.
--
-- The natural person, distinct from the account, "because section 4.4 requires
-- the keyed ID hash stored once per person and referenced by each seller
-- account, and section 16.9 requires it to survive deletion. A person-scoped
-- row is what survives when every account of theirs is scrubbed."
-- ---------------------------------------------------------------------------
CREATE TABLE core.person (
  id                  uuid PRIMARY KEY,
  id_hash             bytea NULL UNIQUE,
  id_hash_key_version int NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.person IS
  'INVARIANT (section 6.2) - person is NEVER deleted. No DELETE grant. '
  'Duplicate-identity detection across accounts (sections 4.4, 13.2) is '
  'SELECT ... WHERE id_hash = $1, and it must still work after the seller '
  'closed the account. A keyed hash rather than a per-record salt, exactly as '
  'section 13.1 states: the purpose is detecting the same ID across accounts, '
  'and a per-record salt makes that impossible.';

-- ---------------------------------------------------------------------------
-- 2. core.account (section 6.1)
--
-- "One phone number, one account." Roles are relationships, not accounts
-- (section 6.3): buyer_profile, seller, seller_team_member and seller_courier
-- all reference account. One person holding all four roles on one number is
-- the ordinary case and requires no special handling.
-- ---------------------------------------------------------------------------
CREATE TABLE core.account (
  id                    uuid PRIMARY KEY,
  phone_e164            core.e164 NOT NULL UNIQUE,
  market_id             uuid NOT NULL REFERENCES core.market(id),
  person_id             uuid NULL REFERENCES core.person(id),
  status                core.account_status NOT NULL DEFAULT 'ACTIVE',
  -- ADU-AUTH-01 v2.4 section 13. "Store the confirmation, not the date."
  -- Adulis sells no age-graded product, so a date of birth would be data
  -- collected for no purpose, and data minimisation is a live obligation
  -- rather than a preference.
  age_declared_over_18  boolean NULL,
  age_declared_at       timestamptz NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  scrubbed_at           timestamptz NULL
);

COMMENT ON COLUMN core.account.phone_e164 IS
  'INVARIANT (ADU-AUTH-01 section 2) - a seller account is bound to one phone '
  'number, and that number IS the authentication factor. The bound number '
  'changes only through section 9 recovery, never through settings.';

-- ---------------------------------------------------------------------------
-- 3. core.buyer_profile (section 6.3)
--
-- UNDER-SPECIFIED, AND BUILT AS THE ANCHOR ONLY. Section 6.3 reads in full:
-- "One per account, created at first reserve. Reservation history,
-- confirmation rate, cancellation history, claims filed and claims upheld are
-- derived views, not stored counters - except the cancellation cooldown state
-- in section 12.7, which needs a decaying window."
--
-- Every attribute it names is explicitly NOT a column here, and the one
-- exception lives in core.buyer_cancellation_counter (migration 9). So the
-- table is the account-scoped anchor the model requires and nothing else. That
-- is a faithful transcription rather than an omission, but it is flagged in the
-- Tier 1 report because a table with no payload is worth confirming.
-- ---------------------------------------------------------------------------
CREATE TABLE core.buyer_profile (
  id         uuid PRIMARY KEY,
  account_id uuid NOT NULL UNIQUE REFERENCES core.account(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. core.device (section 6.4)
--
-- "Anonymous, app-generated, registered on first launch. Required by C6 for
-- the pre-identity cart, and by section 17.3 for the notification-permission
-- fallback."
-- ---------------------------------------------------------------------------
CREATE TABLE core.device (
  id                      uuid PRIMARY KEY,
  platform                core.device_platform NOT NULL,
  push_token              text NULL,
  notification_permission core.notification_permission NOT NULL DEFAULT 'NOT_ASKED',
  account_id              uuid NULL REFERENCES core.account(id),
  first_seen_at           timestamptz NOT NULL DEFAULT now(),
  last_seen_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.device IS
  'Section 6.4 - a device row carries NO personal data. It holds a push token '
  'and a permission state, both properties of an app installation rather than '
  'of a person. That is what makes it safe as the anonymous cart key, and why '
  'the purge in section 11 is unremarkable rather than a data-protection '
  'event. account_id is bound at identity creation, never before.';

-- ---------------------------------------------------------------------------
-- 5. core.otp_challenge (section 6.5)
-- ---------------------------------------------------------------------------
CREATE TABLE core.otp_challenge (
  id             uuid PRIMARY KEY,
  purpose        core.otp_purpose NOT NULL,
  phone_e164     core.e164 NOT NULL,
  code_hash      bytea NOT NULL,
  attempt_count  int NOT NULL DEFAULT 0,
  expires_at     timestamptz NOT NULL,
  consumed_at    timestamptz NULL,
  step_up_action core.step_up_action NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN core.otp_challenge.code_hash IS
  'ADU-AUTH-01 section 4.1 - hash only, never plaintext, compared in constant '
  'time. A timing oracle on a 6-digit code is a real one.';

COMMENT ON COLUMN core.otp_challenge.step_up_action IS
  'NULL, or which section 6.5 action this authorises. core.step_up_action '
  'carries EIGHT values, one per step-up permission of ADU-AUTH-01 v2.4 '
  'section 16.3. It carried six through v1.9, so seller.identity:manage and '
  'seller.ownership:transfer - the two most dangerous actions in the system - '
  'were the two whose challenge could not be recorded. Closed by A1.2, '
  'absorbed into v1.10; the one-to-one correspondence is asserted in migration '
  '05b and again by test.';

-- ---------------------------------------------------------------------------
-- 6. core.account_device (section 6.6a) - remembered console devices, R17
--
-- Created before session, because session.account_device_id references it.
-- Its own revoked_by_session_id reference is added after session exists.
-- ---------------------------------------------------------------------------
CREATE TABLE core.account_device (
  id                    uuid PRIMARY KEY,
  account_id            uuid NOT NULL REFERENCES core.account(id),
  device_id             uuid NOT NULL REFERENCES core.device(id),
  token_hash            bytea NOT NULL UNIQUE,
  label                 text NULL,
  remembered_at         timestamptz NOT NULL DEFAULT now(),
  last_used_at          timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL,
  revoked_at            timestamptz NULL,
  revoked_by_session_id uuid NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN core.account_device.token_hash IS
  'Section 6.6a - the token is stored HASHED, never in the clear. A '
  'core.account_device row is not a credential; it is the record of one. The '
  'browser holds __Host-adulis_device; the database holds its hash, exactly as '
  'session holds an opaque token it can revoke.';

-- ---------------------------------------------------------------------------
-- 7. core.session (section 6.6)
-- ---------------------------------------------------------------------------
CREATE TABLE core.session (
  id                    uuid PRIMARY KEY,
  account_id            uuid NOT NULL REFERENCES core.account(id),
  audience              core.session_audience NOT NULL,
  device_id             uuid NULL REFERENCES core.device(id),
  account_device_id     uuid NULL REFERENCES core.account_device(id),
  first_seen_at         timestamptz NOT NULL DEFAULT now(),
  last_activity_at      timestamptz NOT NULL DEFAULT now(),
  approx_location       text NULL,
  expires_at            timestamptz NOT NULL,
  revoked_at            timestamptz NULL,
  revoked_by_session_id uuid NULL REFERENCES core.session(id),
  created_from_otp_id   uuid NULL REFERENCES core.otp_challenge(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  -- A remembered device is a console concept. R17 gives MOBILE no remembered
  -- lifetime, and section 6.6a's table has two console rows and no mobile row.
  CONSTRAINT remembered_device_is_console CHECK (
    account_device_id IS NULL OR audience = 'CONSOLE'
  )
);

ALTER TABLE core.account_device
  ADD CONSTRAINT account_device_revoked_by_session
  FOREIGN KEY (revoked_by_session_id) REFERENCES core.session(id);

COMMENT ON TABLE core.session IS
  'INVARIANT (section 6.6) - revocation takes effect server-side IMMEDIATELY, '
  'not at next token refresh. Consequence: the session row is read on every '
  'authenticated request. No stateless JWT whose validity outlives its row. '
  'This is a real cost - one indexed primary-key lookup per request - and it '
  'is the price of the invariant. It is affordable because Postgres is the '
  'sole datastore and this is its cheapest possible query.';

-- INVARIANT (section 6.5) - no session may be created from an OTP challenge
-- whose purpose is ACCOUNT_DELETION. "Enforced by a trigger in the database
-- (ADU-AUTH-01 section 11), not by remembering not to."
--
-- Body transcribed verbatim from section 6.5.
CREATE FUNCTION core.fn_session_otp_purpose() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE p core.otp_purpose;
BEGIN
  IF NEW.created_from_otp_id IS NULL THEN RETURN NEW; END IF;
  SELECT purpose INTO p FROM core.otp_challenge WHERE id = NEW.created_from_otp_id;
  IF p <> 'SIGN_IN' THEN
    RAISE EXCEPTION 'OTP purpose % cannot issue a session', p
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_session_otp_purpose
  BEFORE INSERT ON core.session
  FOR EACH ROW EXECUTE FUNCTION core.fn_session_otp_purpose();

-- NOT BUILT HERE, AND DELIBERATELY. Section 6.6 also requires: "a new-device
-- sign-in on a seller, team member or courier account notifies the registered
-- number and is not suppressible. A trigger on session insert enqueues the
-- notification when no prior session exists for that (account_id, device_id)."
--
-- The trigger enqueues into core.notification, which section 28 item 14
-- creates in migration 14, and it must test for a seller relationship against
-- core.seller_team_member and core.seller_courier, which migration 5 creates.
-- Writing it now would be a trigger that raises on every sign-in.
--
-- It belongs to migration 14 and is recorded in the Tier 1 report so that it
-- is not lost between the two.

-- ---------------------------------------------------------------------------
-- 8. core.step_up_challenge (section 6.7)
-- ---------------------------------------------------------------------------
CREATE TABLE core.step_up_challenge (
  id               uuid PRIMARY KEY,
  account_id       uuid NOT NULL REFERENCES core.account(id),
  action           core.step_up_action NOT NULL,
  target_ref       uuid NULL,
  otp_challenge_id uuid NOT NULL REFERENCES core.otp_challenge(id),
  satisfied_at     timestamptz NULL,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.step_up_challenge IS
  'INVARIANT (section 6.7) - the section 6.5 actions require a fresh challenge '
  'regardless of an active session, enforced server-side including on direct '
  'API calls. Every mutation implementing one takes a step_up_challenge_id '
  'ARGUMENT and the writing function verifies satisfied_at is within the '
  'freshness window. Not middleware - a parameter, so a code path that omits '
  'it does not compile. ADU-AUTH-01 section 9.2 adds that the challenge binds '
  'to the action AND the target_ref: one satisfied for order A cannot '
  'authorise order B.';

-- ---------------------------------------------------------------------------
-- 9. core.account_recovery_case (section 6.8) - APPEND-ONLY
-- ---------------------------------------------------------------------------
CREATE TABLE core.account_recovery_case (
  id                  uuid PRIMARY KEY,
  account_id          uuid NOT NULL REFERENCES core.account(id),
  requested_at        timestamptz NOT NULL DEFAULT now(),
  reason              text NULL,
  operator_account_id uuid NULL REFERENCES core.account(id),
  evidence_relied_on  jsonb NULL,
  decision            core.recovery_decision NULL,
  decided_at          timestamptz NULL,
  payout_locked_until timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.account_recovery_case IS
  'INVARIANT (section 6.8) - payout details cannot be changed for the cooling '
  'period after any recovery. payout_locked_until is written by the SAME '
  'statement that approves the recovery. One transaction, two effects: the '
  'attack is "recover the account, then immediately change the bank details", '
  'and the two writes must not be separable.';

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.account_recovery_case
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

-- ---------------------------------------------------------------------------
-- 10. Indexes
-- ---------------------------------------------------------------------------
-- Section 6.6: the session row is read on every authenticated request. The
-- primary key covers that. These cover the other two hot paths.
CREATE INDEX idx_session_account_active ON core.session (account_id)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_otp_challenge_phone_purpose ON core.otp_challenge (phone_e164, purpose)
  WHERE consumed_at IS NULL;
CREATE INDEX idx_device_account ON core.device (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_account_device_account ON core.account_device (account_id)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 11. Grants
--
-- Section 3: core is "Full DML" for adulis_app - EXCEPT that section 4's
-- append-only mechanism is two mechanisms, "because the first is invisible in
-- a migration diff and the second is invisible in a permissions audit".
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  core.person,
  core.account,
  core.buyer_profile,
  core.device,
  core.otp_challenge,
  core.account_device,
  core.session,
  core.step_up_challenge,
  core.account_recovery_case
TO adulis_app;

-- INVARIANT (section 6.2) - person is never deleted.
REVOKE DELETE ON core.person FROM adulis_app;

-- Append-only (Appendix B, section 4).
REVOKE UPDATE, DELETE ON core.account_recovery_case FROM adulis_app;

GRANT SELECT ON
  core.person,
  core.account,
  core.buyer_profile,
  core.device,
  core.session,
  core.account_device,
  core.step_up_challenge,
  core.account_recovery_case
TO adulis_readonly;

-- Down Migration

DO $$
BEGIN
  RAISE EXCEPTION
    'Migration 03 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $$;
