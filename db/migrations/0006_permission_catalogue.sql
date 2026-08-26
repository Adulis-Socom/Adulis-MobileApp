-- ===========================================================================
-- MIGRATION 05b - THE PERMISSION CATALOGUE
--
-- Source: ADU-DB-01 v1.9 section 6.9a and section 28 item 5, second half -
-- "permission and role_permission seeded from ADU-AUTH-01 section 15/16".
-- The catalogue itself is ADU-AUTH-01 v2.2 section 15.1; the eight step-up
-- codes are its section 16.3, which that document makes canonical.
--
-- Section 28: "Migrations 5, 7 and 9 are the three to review by hand.
-- Migration 5 now seeds the permission catalogue, and a wrong surfaces array
-- there is a surface restriction that silently does not exist."
--
-- ---------------------------------------------------------------------------
-- WHAT IS SEEDED HERE AND WHAT IS NOT
--
--   core.permission      42 rows. SEEDED. Every code, surface array and
--                        requires_step_up flag is transcribable from
--                        ADU-AUTH-01 v2.2 sections 15.1 and 16.3.
--
--   core.role_permission 139 rows. NOT SEEDED, AND NOT GUESSED.
--                        Section 16.2's matrix is the authority and its 252
--                        cells did not survive delivery: every glyph in the
--                        six role columns arrived as one identical character,
--                        so granted and not-granted are indistinguishable.
--                        The per-role totals (42 / 40 / 19 / 16 / 10 / 12) and
--                        the prose constraints fix roughly half the matrix and
--                        leave the rest underdetermined - which is exactly the
--                        condition in which a seeded guess would look right and
--                        be wrong. See the Tier 1 report.
--
-- D1 AND D3 ARE THE REASON THIS MIGRATION EXISTS IN THIS SHAPE. v1.8 named six
-- codes in a hardcoded CHECK where there are eight, omitted three of the eight,
-- and included one code that is not a permission - and because it read
-- "code NOT IN (...) OR surfaces = '{CONSOLE}'", AN OMITTED CODE WAS
-- UNCONSTRAINED. v1.9 removes the list rather than correcting it.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.permission (section 6.9a, transcribed verbatim)
-- ---------------------------------------------------------------------------
CREATE TABLE core.permission (
  code              text PRIMARY KEY,                 -- 'seller.orders:respond'
  surfaces          core.session_audience[] NOT NULL, -- which surfaces may exercise it
  requires_step_up  boolean NOT NULL DEFAULT false,   -- D1: a column, not a list
  CONSTRAINT surfaces_not_empty CHECK (cardinality(surfaces) > 0)
);

CREATE TABLE core.role_permission (
  role            core.team_role NOT NULL,
  permission_code text NOT NULL REFERENCES core.permission(code),
  PRIMARY KEY (role, permission_code)
);

-- INVARIANT (section 6.9a) - THE STEP-UP CONSTRAINT IS TOTAL. It quantifies
-- over EVERY row, present and future. A permission added in a later migration
-- is covered by a constraint written now.
--
-- "The list was wrong; the deeper fault was that it was a list. An enumeration
-- inside a CHECK must be kept in lockstep with a catalogue in a different
-- document, and nothing enforces that. requires_step_up is a fact about the
-- permission, so it lives on the permission."
ALTER TABLE core.permission ADD CONSTRAINT step_up_is_console_only CHECK (
  NOT requires_step_up
  OR surfaces = ARRAY['CONSOLE']::core.session_audience[]
);

COMMENT ON TABLE core.permission IS
  'INVARIANT (section 15, ADU-AUTH-01) - core.permission is a CLOSED SET. A '
  'permission code that is not in this catalogue does not exist, and '
  'role_permission carries a foreign key to it, so a role cannot be granted a '
  'capability nobody defined. INVARIANT (section 17) - surface is a property '
  'of the PERMISSION, not of the role.';

COMMENT ON COLUMN core.permission.requires_step_up IS
  'D1. Through v1.8 this was an enumeration of six codes inside a CHECK, in a '
  'document separate from the 42-code catalogue it had to track. It drifted: '
  'three of the eight step-up permissions were missing from it, and one code '
  'in it did not exist. Because the CHECK read "code NOT IN (...) OR surfaces '
  '= CONSOLE", an omitted code satisfied the first disjunct and was '
  'UNCONSTRAINED - a seed granting seller.identity:manage to MOBILE would have '
  'inserted cleanly, and nothing would have raised until someone found it from '
  'outside.';

-- ---------------------------------------------------------------------------
-- 2. The 42 permissions (ADU-AUTH-01 v2.2 section 15.1)
--
-- SURFACES, AND THE ONE DECISION THIS SEED MAKES.
--
--   {MOBILE, CONSOLE}  the nine codes section 15.1 marks **M**. Section 6.9a
--                      lists the same nine as "the Companion's Phase 1 grants"
--                      and states "Each carries surfaces = '{MOBILE, CONSOLE}'
--                      - the console can do everything the Companion can."
--
--   {CONSOLE}          everything else, per section 15.1's legend:
--                      "Everything unmarked is console-only."
--
-- THE DECISION: section 15.1 marks three codes **M-squared**, meaning
-- "Companion PHASE 2 (ARCH-01 section 3.1). Built on beta evidence, not
-- before" - seller.reviews:read, seller.analytics.basic:read and
-- seller.notifications.preferences:write. No document says what surfaces they
-- carry TODAY. They are seeded {CONSOLE}, because section 6.9a enumerates
-- exactly the nine Phase 1 codes as MOBILE-bearing and these are not among
-- them, and because widening a surface later is one UPDATE while narrowing one
-- after a client has shipped against it is a breaking change. Reported as the
-- single question this seed had to answer for itself.
--
-- A NAMING DEFECT FOUND WHILE DOING THIS. Section 6.9a's Phase 1 list names
-- seller.reservations:read, seller.reservations:respond and
-- seller.payment_receipt:confirm. NONE OF THE THREE IS A PERMISSION - the
-- catalogue calls them seller.orders:read, seller.orders:respond and
-- seller.payment:confirm. They are pre-v1.6 names left in a "for reference"
-- list. Under that correspondence section 6.9a's nine and section 15.1's nine
-- **M** codes are the same set exactly, which is what makes the surface
-- mapping above safe to make. Reported.
--
-- STEP-UP: the eight of ADU-AUTH-01 v2.2 section 16.3, which that document
-- makes canonical and which this document deliberately does not restate -
-- "two copies of one list is how D1 happened". Note that section 15.1 groups
-- seller.payout:read on the same marked row as seller.payout:update; section
-- 16.3 lists only the latter, and section 16.3 governs.
-- ---------------------------------------------------------------------------
INSERT INTO core.permission (code, surfaces, requires_step_up) VALUES
  -- Orders
  ('seller.orders:read',                   ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.orders:respond',                ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.order_ready:update',            ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.orders:reissue_instructions',   ARRAY['CONSOLE']::core.session_audience[],          true),
  -- Payment
  ('seller.payment_evidence:read',         ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.payment:confirm',               ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.refunds:report',                ARRAY['CONSOLE']::core.session_audience[],          false),
  -- Catalogue
  ('seller.products:read',                 ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.products:write',                ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.products:publish',              ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.media:write',                   ARRAY['CONSOLE']::core.session_audience[],          false),
  -- Stock
  ('seller.stock:read',                    ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.stock:write',                   ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.stock:bulk_write',              ARRAY['CONSOLE']::core.session_audience[],          false),
  -- Store
  ('seller.store:read',                    ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.store:write',                   ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.availability:write',            ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.fulfilment:write',              ARRAY['CONSOLE']::core.session_audience[],          false),
  -- Messaging  ("Free on every tier")
  ('seller.messages:read',                 ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.messages:send',                 ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  -- Handoff    (handoff:read "Includes the QR")
  ('seller.handoff:read',                  ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.handoff:custody_transfer',      ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.couriers:manage',               ARRAY['CONSOLE']::core.session_audience[],          false),
  -- Feedback   (reviews:read is M-squared - Phase 2)
  ('seller.reviews:read',                  ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.claims:read',                   ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.claims:respond',                ARRAY['CONSOLE']::core.session_audience[],          false),
  -- Analytics  (analytics.basic:read is M-squared - Phase 2)
  ('seller.analytics.basic:read',          ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.analytics.full:read',           ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.analytics:export',              ARRAY['CONSOLE']::core.session_audience[],          false),
  -- Notifications  (preferences:write is M-squared - Phase 2)
  ('seller.notifications:read',            ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.notifications.preferences:write', ARRAY['CONSOLE']::core.session_audience[],        false),
  -- Automation  (deferred capabilities, not gaps - Business tier ships them)
  ('seller.chatbot:configure',             ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.chatbot.flows:write',           ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.broadcasts:send',               ARRAY['CONSOLE']::core.session_audience[],          false),
  -- Administrative
  ('seller.payout:read',                   ARRAY['CONSOLE']::core.session_audience[],          false),
  ('seller.payout:update',                 ARRAY['CONSOLE']::core.session_audience[],          true),
  ('seller.staff:admin',                   ARRAY['CONSOLE']::core.session_audience[],          true),
  ('seller.ownership:transfer',            ARRAY['CONSOLE']::core.session_audience[],          true),
  ('seller.subscription:update',           ARRAY['CONSOLE']::core.session_audience[],          true),
  ('seller.identity:manage',               ARRAY['CONSOLE']::core.session_audience[],          true),
  ('seller.account:delete',                ARRAY['CONSOLE']::core.session_audience[],          true),
  ('seller.sessions:revoke_all',           ARRAY['CONSOLE']::core.session_audience[],          true);

-- ---------------------------------------------------------------------------
-- 3. The three checksums section 6.9a requires of this migration
--
-- "each against a fixture rather than against the seed". The counts are
-- asserted here so a bad seed fails the MIGRATION, and again in the
-- integration tests against a hand-written fixture, so a bad seed that agrees
-- with itself still fails the BUILD.
-- ---------------------------------------------------------------------------
DO $seed_check$
DECLARE n_perm int; n_step int;
BEGIN
  SELECT count(*) INTO n_perm FROM core.permission;
  SELECT count(*) INTO n_step FROM core.permission WHERE requires_step_up;

  IF n_perm <> 42 THEN
    RAISE EXCEPTION 'core.permission holds % rows; ADU-AUTH-01 v2.2 section 15.1 has 42', n_perm
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF n_step <> 8 THEN
    RAISE EXCEPTION 'core.permission holds % step-up rows; section 16.3 names 8', n_step
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Appendix C's second reviewer query, BOTH DIRECTIONS. v1.8's version was
  -- one-directional and did not compile; D2. "A one-directional EXCEPT catches
  -- a permission that should not require step-up; it says nothing about one
  -- that SHOULD and does not - and that is the direction D1 failed in."
  IF EXISTS (
    SELECT code FROM core.permission WHERE requires_step_up
    EXCEPT SELECT unnest(ARRAY[
      'seller.payout:update','seller.orders:reissue_instructions','seller.staff:admin',
      'seller.subscription:update','seller.account:delete','seller.sessions:revoke_all',
      'seller.identity:manage','seller.ownership:transfer'])
  ) THEN
    RAISE EXCEPTION 'a permission requires step-up that section 16.3 does not name'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF EXISTS (
    SELECT unnest(ARRAY[
      'seller.payout:update','seller.orders:reissue_instructions','seller.staff:admin',
      'seller.subscription:update','seller.account:delete','seller.sessions:revoke_all',
      'seller.identity:manage','seller.ownership:transfer'])
    EXCEPT SELECT code FROM core.permission WHERE requires_step_up
  ) THEN
    RAISE EXCEPTION 'a section 16.3 step-up permission is missing from the seed'
      USING ERRCODE = 'restrict_violation';
  END IF;
END $seed_check$;

-- ---------------------------------------------------------------------------
-- 4. core.role_permission is DELIBERATELY EMPTY
--
-- Section 6.9a requires 139 rows and ADU-AUTH-01 v2.2 section 16.2 is the only
-- statement of which 139. Its checksums are recoverable - 42 / 40 / 19 / 16 /
-- 10 / 12, with ANALYST holding zero writes, OWNER all 42 and ADMIN all but
-- seller.account:delete and seller.ownership:transfer - and its membership is
-- not: the matrix cells did not survive delivery.
--
-- What the prose alone fixes: OWNER's 42, ADMIN's 40, the seven reads section
-- 16.1 rule 3 grants to all six roles, and the section 16.4 departures
-- (CAMPAIGN loses both order-mutation grants; INVENTORY gains handoff:read and
-- handoff:custody_transfer but not couriers:manage; INVENTORY gains
-- fulfilment:write but not store:write or availability:write;
-- orders:reissue_instructions is Owner and Admin only). What it does not fix:
-- which ten of the catalogue's reads ANALYST holds, and the remaining
-- membership of SALES_SUPPORT's 19, INVENTORY's 16 and CAMPAIGN's 12.
--
-- Seeding a plausible 139 would satisfy every checksum in section 6.9a and
-- still be wrong, and a wrong role_permission row is not a visible defect -
-- it is a person who can or cannot do their job, discovered months later.
-- Section 24's matrix test asserts all 139 grants AND all 113 non-grants
-- precisely because a seed can agree with itself.
--
-- The table exists so that migration 9's fn_mark_order_ready has its foreign
-- key, and the seed is one INSERT once section 16.2 is readable.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. Grants
--
-- The catalogue is reference data read on every authorization decision and
-- written only by migration. adulis_app gets SELECT and nothing else: a matrix
-- the application can INSERT into is an authorization model that widens at
-- runtime with no migration and no diff, which is the same argument section
-- 12.2 makes for the state-transition tables.
-- ---------------------------------------------------------------------------
GRANT SELECT ON core.permission, core.role_permission TO adulis_app, adulis_readonly;
REVOKE INSERT, UPDATE, DELETE ON core.permission      FROM adulis_app;
REVOKE INSERT, UPDATE, DELETE ON core.role_permission FROM adulis_app;

-- Down Migration

DO $$
BEGIN
  RAISE EXCEPTION
    'Migration 05b is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $$;
