-- ===========================================================================
-- MIGRATION 05a - SELLERS, ELIGIBILITY, AVAILABILITY, FULFILMENT, OPERATORS
--
-- Source: ADU-DB-01 v1.10 section 28 item 5, first half - "Sellers, social
-- accounts, team, courier, eligibility, ladder-entry trigger,
-- seller_availability, seller_availability_override and
-- fn_seller_availability_state (R27), seller_fulfilment_method (R13),
-- operator_grant (F6)".
--
-- The permission catalogue - the second half of section 28 item 5 - is
-- migration 05b, split out because section 28 says migration 5 is one of the
-- three to review by hand and "a wrong surfaces array there is a surface
-- restriction that silently does not exist". A reviewer should be able to read
-- the seed on its own.
--
-- Twelve tables. Two append-only (seller_eligibility_evaluation,
-- operator_grant).
--
-- D5 IS CLOSED HERE. fn_seller_availability_state read m.timezone through v1.8
-- where core.market has display_timezone, so the function written to prevent
-- what section 13.1b calls "the single most likely defect in the feature" did
-- not compile. It compiles now.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.seller (section 7.1)
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller (
  id                      uuid PRIMARY KEY,
  market_id               uuid NOT NULL REFERENCES core.market(id),
  owner_account_id        uuid NOT NULL REFERENCES core.account(id),
  person_id               uuid NULL REFERENCES core.person(id),
  entity_type             core.seller_entity_type NOT NULL,
  store_name              text NOT NULL,
  handle                  text NOT NULL,
  description             text NULL,
  -- BARE uuid, NO FOREIGN KEY. core.category is created by migration 6
  -- (section 28 item 6) and this table by migration 5. The reference cannot be
  -- expressed here; adding it later is one ALTER. Reported.
  category_id             uuid NULL,
  status                  core.seller_status NOT NULL DEFAULT 'DRAFT',
  waitlist_follower_claim int NULL,
  published_at            timestamptz NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- "handle unique per market" (section 7.1)
  CONSTRAINT seller_handle_unique_per_market UNIQUE (market_id, handle),

  -- INVARIANT (section 7.1) - "UNIQUE (id, market_id) and
  -- UNIQUE (id, owner_account_id) exist on seller. These are the ANCHORS for
  -- the composite foreign keys used throughout sections 9-12 to make
  -- cross-seller and cross-buyer mistakes structurally impossible rather than
  -- merely unlikely."
  CONSTRAINT seller_id_market UNIQUE (id, market_id),
  CONSTRAINT seller_id_owner  UNIQUE (id, owner_account_id),

  -- Anchor for seller_company_detail's composite FK (section 7.1).
  CONSTRAINT seller_id_entity_type UNIQUE (id, entity_type)
);

COMMENT ON COLUMN core.seller.waitlist_follower_claim IS
  'Self-reported at waitlist, imported per section 25. NEVER blended with the '
  'verified count in seller_social_account.follower_count_at_verification: '
  'the difference between them is itself a signal, and ADU-PROJ-01 section 12 '
  'follower-count evidence gate depends on the verified number alone.';

-- Section 4 / section 27: pg_trgm GIN indexes for seller lookup (section 7.6)
-- and storefront search (section 7.5).
CREATE INDEX idx_seller_store_name_trgm ON core.seller USING gin (store_name gin_trgm_ops);
CREATE INDEX idx_seller_handle_trgm     ON core.seller USING gin (handle gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 2. core.seller_company_detail (section 7.1)
--
-- C3 - CONFIRMED IN v1.10. The previous revision had to render section 7.1's
-- prose list into snake_case itself and reported the guess; v1.10 section 7.1
-- now names all seven columns, and they are the ones below. ADU-API-01 v1.6
-- section 12.9 names the same five payload fields on
-- PATCH /v1/seller/company-details, so the contract agrees.
--
-- INVARIANT (section 7.1) - the representative is a person_id, and the identity
-- attestation attaches to THAT PERSON, not to the company. "Declaring company
-- does not add a second verification, it CHANGES WHOM THE EXISTING ONE IS
-- ABOUT, and a seller who discovers that mid-flow abandons it." 
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_company_detail (
  seller_id                   uuid PRIMARY KEY REFERENCES core.seller(id),
  entity_type                 core.seller_entity_type NOT NULL DEFAULT 'COMPANY',
  registration_identifier     text NULL,
  trade_licence_number        text NULL,
  tin                         text NULL,
  representative_person_id    uuid NULL REFERENCES core.person(id),
  representative_relationship text NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- "Company sellers only, enforced by a composite FK on
  -- (seller_id, entity_type)" (section 7.1). The CHECK pins this side to
  -- COMPANY; the composite FK makes the seller agree.
  CONSTRAINT company_detail_is_company CHECK (entity_type = 'COMPANY'),
  CONSTRAINT company_detail_seller_entity
    FOREIGN KEY (seller_id, entity_type) REFERENCES core.seller (id, entity_type)
);

-- ---------------------------------------------------------------------------
-- 3. core.seller_team_member (section 6.9)
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_team_member (
  id           uuid PRIMARY KEY,
  seller_id    uuid NOT NULL REFERENCES core.seller(id),
  account_id   uuid NOT NULL REFERENCES core.account(id),
  role         core.team_role NOT NULL,
  invited_by   uuid NULL REFERENCES core.account(id),
  suspended_at timestamptz NULL,
  revoked_at   timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- "Unique on (seller_id, account_id) where not revoked" (section 6.9).
CREATE UNIQUE INDEX seller_team_member_live
  ON core.seller_team_member (seller_id, account_id) WHERE revoked_at IS NULL;

-- AMENDMENT A1.3 - THE OWNER RULING, and it removes an index rather than adding one.
--
-- Through v1.9 the Owner could be read from two places: core.seller's
-- owner_account_id, and a core.seller_team_member row with role = 'OWNER'.
-- Nothing said which governed, and fn_has_permission could not be written until
-- something did.
--
--   "RULING - the Owner is core.seller.owner_account_id, and only that.
--    core.seller_team_member NEVER holds a row with role = 'OWNER'."
--
-- The seller row wins because it already had to: UNIQUE (id, owner_account_id)
-- is a composite-foreign-key anchor used throughout sections 9-12, so the Owner
-- cannot move to seller_team_member without breaking those anchors.
--
-- Two consequences, both good:
--   * Section 16's "exactly one Owner" becomes FREE - it is a single NOT NULL
--     column, not an index over a set. The partial unique index this constraint
--     replaces could only ever have detected a second Owner AFTER one was
--     written; the CHECK makes the first one impossible.
--   * "seller.staff:admin never permits changing the Owner" becomes
--     ENFORCEABLE, because staff administration writes seller_team_member and
--     ownership lives in a table it does not touch.
ALTER TABLE core.seller_team_member
  ADD CONSTRAINT team_member_is_never_owner CHECK (role <> 'OWNER');

COMMENT ON TABLE core.seller_team_member IS
  'INVARIANT (ADU-AUTH-01 section 16.5) - seller.staff:admin NEVER permits '
  'changing the Owner. Section 16.2 lets an Admin alter team membership; '
  'combined with the one-Owner invariant, an Admin could otherwise demote the '
  'Owner and promote themselves, acquiring the only two powers Admin lacks. '
  'Ownership transfer is its own permission, Owner alone, with step-up. '
  'Suspension DISABLES a team login (suspended_at); it never deletes the row '
  '(section 18.1).';

-- ---------------------------------------------------------------------------
-- 4. core.seller_courier (section 6.9)
--
-- core.order_courier_assignment is NOT created here. Section 6.9 defines it
-- alongside this table, but it references core."order", which section 28 item 9
-- creates in migration 9 - as does the courier row-level-security policy that
-- gives it its meaning. Both belong to migration 9. Reported so the pair is
-- not lost between the two migrations.
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_courier (
  id         uuid PRIMARY KEY,
  seller_id  uuid NOT NULL REFERENCES core.seller(id),
  account_id uuid NOT NULL REFERENCES core.account(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX seller_courier_live
  ON core.seller_courier (seller_id, account_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. core.seller_social_account (section 7.2)
--
-- "Account-control verification lives in core, not verification. Handles and
-- follower counts are public information the storefront displays; putting them
-- behind the isolated boundary would make its audit log too long for the paid
-- reviewer section 23 requires to read it in full."
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_social_account (
  id                             uuid PRIMARY KEY,
  seller_id                      uuid NOT NULL REFERENCES core.seller(id),
  platform                       core.platform NOT NULL,
  handle                         text NOT NULL,
  platform_account_id            text NULL,
  verified_at                    timestamptz NULL,
  follower_count_at_verification int NULL,
  follower_count_source          core.follower_count_source NULL,
  status                         core.social_verification_status NOT NULL DEFAULT 'PENDING',
  created_at                     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_social_account_unique UNIQUE (seller_id, platform)
);

-- INVARIANT (section 7.2) - follower count is recorded AT VERIFICATION with a
-- timestamp, and eligibility is NEVER re-evaluated retroactively. "Write-once:
-- an UPDATE trigger rejects a change to follower_count_at_verification or
-- verified_at. Re-verification writes a new row and supersedes the old."
CREATE FUNCTION core.fn_social_account_write_once() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.follower_count_at_verification IS NOT NULL
     AND NEW.follower_count_at_verification IS DISTINCT FROM OLD.follower_count_at_verification THEN
    RAISE EXCEPTION 'follower_count_at_verification is write-once (section 7.2)'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.verified_at IS NOT NULL
     AND NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    RAISE EXCEPTION 'verified_at is write-once (section 7.2)'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_social_account_write_once
  BEFORE UPDATE ON core.seller_social_account
  FOR EACH ROW EXECUTE FUNCTION core.fn_social_account_write_once();

COMMENT ON COLUMN core.seller_social_account.follower_count_source IS
  'INVARIANT (section 7.2) - each platform sits behind an adapter interface; a '
  'platform failure degrades to MANUAL_FALLBACK without affecting the others. '
  'The data-model expression is this column plus a nullable '
  'platform_account_id, so a manually verified seller is a valid row rather '
  'than a special case.';

-- ---------------------------------------------------------------------------
-- 6. core.account_control_challenge (section 7.2)
--
-- "the one-time code posted to the linked social account: code, issued_at,
-- expires_at, matched_at, attempts."
--
-- THE ANCHOR COLUMN IS NOT NAMED. The table is described only by its payload;
-- what it hangs from is left to inference. seller_social_account_id is the
-- only reading consistent with "posted to the linked social account", and it
-- is this migration's choice. Reported.
-- ---------------------------------------------------------------------------
CREATE TABLE core.account_control_challenge (
  id                       uuid PRIMARY KEY,
  seller_social_account_id uuid NOT NULL REFERENCES core.seller_social_account(id),
  code                     text NOT NULL,
  issued_at                timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz NOT NULL,
  matched_at               timestamptz NULL,
  attempts                 int NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7. core.seller_eligibility_evaluation (section 7.4) - APPEND-ONLY
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_eligibility_evaluation (
  id                uuid PRIMARY KEY,
  seller_id         uuid NOT NULL REFERENCES core.seller(id),
  evaluated_at      timestamptz NOT NULL DEFAULT now(),
  config_version_id uuid NULL REFERENCES core.eligibility_config(id),
  path              core.eligibility_path NOT NULL,
  outcome           core.eligibility_outcome NOT NULL,
  reasons           text[] NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.seller_eligibility_evaluation
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

-- The ladder-entry trigger (section 8.1), transcribed verbatim.
--
-- Per C5 the row is created when ELIGIBILITY IS SATISFIED, not when an ID
-- attestation is written. "In Phase 1 almost no seller is ID-verified, so
-- under the ADU-00 wording an entire Phase 1 cohort holds no level, and the
-- ladder accumulates nothing before the day it starts mattering."
--
-- ORDERING NOTE. core.seller_level_state is created by migration 8 (section 28
-- item 8), not here. plpgsql resolves table names at execution rather than at
-- CREATE FUNCTION, so this compiles and stays dormant until migration 8 runs;
-- section 8.1 additionally warns that the trigger must NOT be deferred past
-- migration 6, "if it ever moves after migration 6, a backfill INSERT ...
-- SELECT over satisfied evaluations has to move with it". Placing it here is
-- what the document asks for; the eight-migration gap before its target table
-- exists is reported.
CREATE FUNCTION core.fn_enter_ladder() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.outcome = 'SATISFIED' THEN
    INSERT INTO core.seller_level_state (seller_id, level, since, computed_at)
    VALUES (NEW.seller_id, 'NEW', now(), now())
    ON CONFLICT (seller_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_enter_ladder
  AFTER INSERT ON core.seller_eligibility_evaluation
  FOR EACH ROW EXECUTE FUNCTION core.fn_enter_ladder();

COMMENT ON FUNCTION core.fn_enter_ladder IS
  'ON CONFLICT DO NOTHING because re-evaluation must never reset a seller who '
  'has already climbed. `since` never resets, including on re-satisfaction '
  'after a revocation: the ladder measures accumulated handoff evidence, and a '
  'seller whose social account was revoked and re-verified has not lost the '
  'handoffs they completed. Where a revocation SHOULD cost a level, the '
  'instrument is a logged demotion under section 5.1 with a '
  'moderation_event_id, not a silent re-entry at NEW that leaves no record of '
  'who decided it or why.';

-- ---------------------------------------------------------------------------
-- 8. core.seller_availability (section 13.1)
--
-- "Renamed from seller_active_hours_version in v1.5, and no longer versioned.
-- Plain and updatable - the effective-range machinery existed only to serve a
-- retroactivity rule that no longer exists."
--
-- weekday's TYPE IS NOT STATED. fn_seller_availability_state compares it to
-- EXTRACT(isodow FROM ...), which is 1-7 (Monday-Sunday), so smallint with
-- that CHECK is the only reading the function admits.
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_availability (
  id         uuid PRIMARY KEY,
  seller_id  uuid NOT NULL REFERENCES core.seller(id) ON DELETE CASCADE,
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  opens_at   time NOT NULL,
  closes_at  time NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Section 13.1: "Windows are one hour to a full day, several per day
  -- permitted, and zero windows is a valid state. Most sellers are creators
  -- without a shop and may be available for handoff for an hour a day;
  -- requiring eight required a shopfront from people who do not have one."
  CONSTRAINT availability_window_minimum CHECK (closes_at - opens_at >= interval '1 hour')
);

CREATE INDEX idx_seller_availability_seller ON core.seller_availability (seller_id, weekday);

COMMENT ON TABLE core.seller_availability IS
  'Availability is INFORMATIONAL. It describes when the store is reachable, '
  'not when the system is. The app runs 24 hours; a buyer browses, reserves '
  'and pays at any hour. The operational gates are stock and product '
  'visibility, nothing else. The SLA is wall-clock, computed from '
  'submitted_at alone (section 13.1, R7(a)).';

-- ---------------------------------------------------------------------------
-- 9. core.seller_availability_override (section 13.1a, R27)
--
-- Transcribed verbatim.
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_availability_override (
  seller_id     uuid NOT NULL REFERENCES core.seller(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  note          text NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seller_id, override_date),
  CONSTRAINT override_note_length CHECK (note IS NULL OR length(note) <= 120)
);

COMMENT ON TABLE core.seller_availability_override IS
  'INVARIANT (section 13.1a) - the PRESENCE of a row means the store is closed '
  'on that date. There is NO is_closed column. A boolean here would admit a '
  'row whose value is false, which is a row that means nothing and a second '
  'state to reason about on every read. Closed is a fact recorded by writing '
  'it down and unrecorded by deleting it. This is a SCHEDULE, not a log: rows '
  'are deletable including past ones, it is NOT append-only, and it must not '
  'be marked so - the append-only count in Appendix B stays at 22.';

-- ---------------------------------------------------------------------------
-- 10. core.fn_seller_availability_state (section 13.1b, R27) - D5 CLOSED
--
-- "Three callers need the answer - the storefront, the chatbot's out-of-hours
-- reply, and the seller's own screen - and three implementations of 'check the
-- override table, then fall back to the weekday row' will differ at the edges."
--
-- Transcribed verbatim EXCEPT that v1.8's m.timezone is v1.9's
-- m.display_timezone. That one word is D5: the function written to prevent the
-- feature's one real defect could not run.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_seller_availability_state(p_seller uuid, p_at timestamptz)
RETURNS TABLE (is_open boolean, reason text, note text)
LANGUAGE plpgsql STABLE AS $$
DECLARE v_tz text; v_local timestamp;
BEGIN
  SELECT m.display_timezone INTO v_tz
    FROM core.seller s JOIN core.market m ON m.id = s.market_id
   WHERE s.id = p_seller;
  v_local := p_at AT TIME ZONE v_tz;

  -- 1. An override for the local date wins outright.
  RETURN QUERY
    SELECT false, 'OVERRIDE_CLOSED'::text, o.note
      FROM core.seller_availability_override o
     WHERE o.seller_id = p_seller AND o.override_date = v_local::date;
  IF FOUND THEN RETURN; END IF;

  -- 2. Otherwise the weekly pattern. Zero windows is valid and means closed.
  RETURN QUERY
    SELECT EXISTS (
      SELECT 1 FROM core.seller_availability a
       WHERE a.seller_id = p_seller
         AND a.weekday = EXTRACT(isodow FROM v_local)
         AND v_local::time BETWEEN a.opens_at AND a.closes_at
    ), 'WEEKLY_PATTERN'::text, NULL::text;
END $$;

COMMENT ON FUNCTION core.fn_seller_availability_state IS
  'INVARIANT (section 13.1b) - the override date is resolved in the MARKET '
  'timezone (core.market.display_timezone), never in UTC. override_date is a '
  'calendar date, and a date only means something inside a timezone. Comparing '
  'it against a UTC timestamp puts the rollover at 03:00 EAT, so a store '
  'marked closed for Meskel would show open for the first three hours of it '
  'and closed for the first three hours of the following day. This is the '
  'single most likely defect in the feature and it is the reason the function '
  'exists rather than a WHERE clause in three services. An override BEATS the '
  'weekly pattern outright - it does not intersect with it.';

-- ---------------------------------------------------------------------------
-- 11. core.seller_fulfilment_method (section 13.0, R13)
--
-- "ADU-PRD-01 section 4.6 makes fulfilment configuration a
-- publication-readiness item and ADU-API-01 section 7.1 gives it the code
-- FULFILMENT_CONFIG. Neither defines it. Through v1.6 it was the one readiness
-- item a seller could not satisfy, because nothing existed to write."
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_fulfilment_method (
  seller_id    uuid NOT NULL REFERENCES core.seller(id) ON DELETE CASCADE,
  method       core.fulfilment_method NOT NULL,
  handoff_note text NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seller_id, method)
);

COMMENT ON TABLE core.seller_fulfilment_method IS
  'INVARIANT (section 13.0, PRD section 4.6) - a seller must offer at least '
  'one ACTIVE fulfilment method before any product publishes. Enforced by '
  'fn_publication_readiness returning NOT_SATISFIED for FULFILMENT_CONFIG '
  'where no active row exists - a READINESS check rather than a table '
  'constraint, because a seller in DRAFT legitimately has none yet. NO FEE '
  'COLUMN EXISTS, deliberately: PRD section 25 leaves open who sets a delivery '
  'fee and whether Adulis records it, and section 8.4 already rules that when '
  'a fee mechanism exists it is captured onto the order as price is. Building '
  'a column now guesses at both.';

COMMENT ON COLUMN core.seller_fulfilment_method.handoff_note IS
  'The seller own words - where to collect, which areas are covered - rendered '
  'on the product page and at the reservation step, so a buyer knows how they '
  'will receive the goods BEFORE they commit stock. Free text under section 19 '
  'machine-translation rule, NEVER a structured address, because a structured '
  'address implies a delivery system Adulis does not operate until V6.';

-- ---------------------------------------------------------------------------
-- 12. core.operator_grant (section 6.11, F6) - APPEND-ONLY
-- ---------------------------------------------------------------------------
CREATE TABLE core.operator_grant (
  id                    uuid PRIMARY KEY,
  account_id            uuid NOT NULL REFERENCES core.account(id),
  role                  core.operator_role NOT NULL,
  granted_by_account_id uuid NULL REFERENCES core.account(id),
  granted_at            timestamptz NOT NULL DEFAULT now(),
  revoked_at            timestamptz NULL,
  revoked_by_account_id uuid NULL REFERENCES core.account(id),
  reason                text NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.operator_grant
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE INDEX idx_operator_grant_live ON core.operator_grant (account_id, role)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE core.operator_grant IS
  'INVARIANT (section 6.11) - an operator grant is a RELATIONSHIP on an '
  'account, never an account type. There is no operator login, no operator '
  'account table and no impersonation column. An operator is a person with a '
  'phone number and a grant, which is what makes the derived actor_role of '
  'sections 7.3 and 13.3 possible at all - R5 has something to derive FROM. '
  'INVARIANT - the table is APPEND-ONLY. Revocation sets revoked_at; it never '
  'deletes the row, because "who could read a bank record last March" is a '
  'question the audit logs cannot answer alone. A founder holding all five '
  'roles is fine; a founder holding all five because none exist is not.';

-- NOT SEEDED. Section 6.11 says "the table is seeded in migration 5 with the
-- founder account holding ADMIN, so tiers 6 and 7 have a real grant to test
-- against rather than a bypass." No founder account id exists in any document
-- and core.account carries no seed either, so the grant would have to invent
-- the account it references. Reported; it is one INSERT once the account is
-- named.

-- The verification boundary's read_attestation derives the actor's role from
-- this table (R5, migration 4). It runs as adulis_verification, which
-- therefore needs to reach it - and reaching exactly this one table is the
-- whole of what R5 requires.
GRANT USAGE  ON SCHEMA core            TO adulis_verification;
GRANT SELECT ON core.operator_grant    TO adulis_verification;

-- ---------------------------------------------------------------------------
-- 13. Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  core.seller,
  core.seller_company_detail,
  core.seller_team_member,
  core.seller_courier,
  core.seller_social_account,
  core.account_control_challenge,
  core.seller_eligibility_evaluation,
  core.seller_availability,
  core.seller_availability_override,
  core.seller_fulfilment_method,
  core.operator_grant
TO adulis_app;

-- Append-only (Appendix B, section 4). Two mechanisms, always together.
REVOKE UPDATE, DELETE ON core.seller_eligibility_evaluation FROM adulis_app;
REVOKE UPDATE, DELETE ON core.operator_grant                FROM adulis_app;

GRANT SELECT ON
  core.seller,
  core.seller_company_detail,
  core.seller_team_member,
  core.seller_courier,
  core.seller_social_account,
  core.seller_eligibility_evaluation,
  core.seller_availability,
  core.seller_availability_override,
  core.seller_fulfilment_method,
  core.operator_grant
TO adulis_readonly;

-- ---------------------------------------------------------------------------
-- 14. core.fn_has_permission (ADU-DB-01 v1.10 section 6.9a)
--
-- v1.9 cited this function in five places and never gave its body. Amendment
-- A1.3 supplied it; v1.10 absorbs A1.3 with A2's two rulings applied and prints
-- the whole thing in section 6.9a. This is that listing.
--
-- IT READS core.permission AND core.role_permission, WHICH MIGRATION 05b
-- CREATES. plpgsql resolves table names at execution rather than at CREATE
-- FUNCTION, so this compiles here and is exercised from 05b onward. Recorded as
-- deferral D4 in v1.10 section 28.1.
--
-- FIVE GATES, AND THIS FUNCTION IS TWO OF THEM (ADU-AUTH-01 v2.4 section 14).
-- v2.4 adds the STANDING gate ahead of Role and Surface, and it was previously
-- missing rather than merely unnamed.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_has_permission(
  p_account uuid, p_seller uuid, p_permission text, p_audience core.session_audience
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_role core.team_role;
BEGIN
  -- 1. Owner first. The Owner is core.seller.owner_account_id and nothing else.
  SELECT 'OWNER'::core.team_role INTO v_role
    FROM core.seller s
   WHERE s.id = p_seller AND s.owner_account_id = p_account;

  -- 2. Otherwise a team member who is neither suspended nor revoked. R28.
  IF v_role IS NULL THEN
    SELECT tm.role INTO v_role
      FROM core.seller_team_member tm
     WHERE tm.seller_id    = p_seller
       AND tm.account_id   = p_account
       AND tm.suspended_at IS NULL
       AND tm.revoked_at   IS NULL;
  END IF;

  -- 3. No relationship is a SCOPE failure, and must not be reported as a
  --    permission failure: 403 confirms the object exists.
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';   -- API maps to 404
  END IF;

  -- 4. Role grant AND surface, in ONE query, so the two cannot be told apart.
  IF NOT EXISTS (
    SELECT 1 FROM core.role_permission rp
      JOIN core.permission p ON p.code = rp.permission_code
     WHERE rp.role = v_role AND rp.permission_code = p_permission
       AND p_audience = ANY(p.surfaces)
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'U0001';  -- 403
  END IF;
END $fn$;

COMMENT ON FUNCTION core.fn_has_permission IS
  'Gates 1 and 2 of ADU-AUTH-01 v2.4 section 14, plus the STANDING gate (R28). '
  'RETURNS void AND RAISES: every call site uses PERFORM, because a boolean '
  'return invites "IF NOT fn_has_permission(...) THEN" and the failure mode of '
  'that shape is a caller who forgets the IF, which reads as authorised. '
  'It checks NEITHER seller.status (gate 0, 409) NOR object ownership '
  '(gate 4, 404 via composite FK); both belong to the calling function and to '
  'the schema respectively.';

-- R28 - THE STANDING GATE, and it was a live hole the previous revision found
-- and reported rather than closed.
--
-- Section 18.1 disables a suspended team member's LOGIN. Disabling a login does
-- not end a live session, so a member suspended for cause kept every permission
-- until their session expired - up to twelve hours, or SEVEN DAYS on a
-- remembered device under R17. For an ADMIN that is payout access, staff
-- administration and identity management for a week after the Owner suspended
-- them.
--
--   "The predicate is the control because it is on the row every authorization
--    check already reads: immediate, free, and impossible for a service path to
--    skip. A trigger also revokes that member's sessions, as hygiene - if it
--    fails, the boundary still holds."
--
-- The session-revocation trigger belongs to migration 14's neighbourhood, since
-- it writes core.session and fires on a table this migration creates; the
-- predicate above is what makes the boundary hold without it.

-- R29 - APPLICATION SQLSTATEs. 42501 is left to PostgreSQL.
--
-- ADU-CON-02 section 6.3 maps insufficient_privilege to 500 on the reasoning
-- "a grant is wrong" - correct for Postgres raising it, and wrong for a
-- deliberate denial, which is a 403. One code meaning both "you may not" and
-- "our grants are misconfigured" means a real privilege bug reaches a seller as
-- a clean 403 and is never investigated.
--
--   U0001  fn_has_permission        -> 403 PERMISSION_DENIED
--   U0002  fn_has_permission        -> 404, and never 403: an actor with no
--                                      relationship must not learn the seller exists
--   42501  PostgreSQL only          -> 500, a defect
--
-- NOT "ADU01": the SQL standard reserves SQLSTATE classes beginning 0-4 and
-- A-H, so implementation-defined codes must begin 5-9 or I-Z. U0003-U0999 are
-- reserved for future deliberate raises.

-- SECURITY DEFINER RUNS AS THE FUNCTION OWNER. These migrations are applied by
-- a bootstrap superuser, so without the line below this authorization function
-- would run as a superuser - which is not a privilege escalation here, because
-- it only reads, but it is exactly the habit that made the verification
-- boundary decorative in migration 04 until it was fixed. adulis_migrate owns
-- the core schema and is not a login role.
ALTER FUNCTION core.fn_has_permission(uuid, uuid, text, core.session_audience)
  OWNER TO adulis_migrate;

GRANT SELECT ON core.seller, core.seller_team_member TO adulis_migrate;

REVOKE ALL     ON FUNCTION core.fn_has_permission(uuid, uuid, text, core.session_audience) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION core.fn_has_permission(uuid, uuid, text, core.session_audience) TO adulis_app;

-- Down Migration

DO $$
BEGIN
  RAISE EXCEPTION
    'Migration 05a is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $$;
