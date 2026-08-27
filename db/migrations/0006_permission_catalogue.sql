-- ===========================================================================
-- MIGRATION 05b - THE PERMISSION CATALOGUE AND THE ROLE MATRIX
--
-- Source: ADU-DB-01 v1.9 section 6.9a and section 28 item 5, second half -
-- "permission and role_permission seeded from ADU-AUTH-01 section 15/16".
-- The seed itself is ADU-AUTH-01 **v2.3 section 16.2a**, and it is EXECUTED
-- RATHER THAN TRANSCRIBED, per amendment A1.5 step 4: "Prefer executing
-- section 16.2a's SQL over transcribing section 16.2's table."
--
-- Section 28: "Migrations 5, 7 and 9 are the three to review by hand.
-- Migration 5 now seeds the permission catalogue, and a wrong surfaces array
-- there is a surface restriction that silently does not exist."
--
-- ---------------------------------------------------------------------------
-- WHY v2.3 EXISTS, AND WHY THIS FILE IS A COPY RATHER THAN A TRANSCRIPTION
--
-- v2.2 rendered the matrix with two three-byte glyphs that differ only in their
-- second and third bytes. In transit those bytes were lost and the two
-- collapsed into one character: 252 cells became indistinguishable while the
-- table still looked well-formed. That is the worst class of corruption - it
-- does not fail loudly, and a reader who had not seen the original would have
-- seeded 252 grants with confidence.
--
-- v2.3 answers it twice: section 16.2 is ASCII (`Y` and `.`), and section 16.2a
-- is the seed as executable SQL, both generated from one source. The block
-- below is that SQL, byte for byte. The authority copy is kept at
-- docs/amendments/ADU-AUTH-01_v2_3_permission_seed.sql, and a test parses THAT
-- file and compares it against the live database - so a bad copy-paste into
-- this migration fails the build rather than the audit.
--
-- BOTH FORMS WERE CROSS-CHECKED BEFORE THIS WAS WRITTEN. All 252 cells of
-- section 16.2's table agree with section 16.2a's SQL; the four checksums hold;
-- and every invariant section 16.4 and 16.5 state in prose is satisfied by the
-- data. Section 16.2a's claim that the two "cannot disagree" is true here.
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
  'INVARIANT (ADU-AUTH-01 section 15) - core.permission is a CLOSED SET. A '
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

COMMENT ON TABLE core.role_permission IS
  'ADU-AUTH-01 v2.3 section 16.2 - 42 codes, 6 roles, 139 grants. The Owner is '
  'core.seller.owner_account_id and never a row in seller_team_member '
  '(amendment A1.3), so the OWNER rows here describe the store owner rather '
  'than a team membership. At MVP only OWNER is reachable: Business tier is '
  'post-MVP, so team members do not exist yet and the matrix ships anyway - '
  '"adding roles later to a system that assumed one is far harder than leaving '
  'five unused".';

-- ---------------------------------------------------------------------------
-- 2. THE SEED - ADU-AUTH-01 v2.3 section 16.2a, byte for byte.
--
-- SURFACES ARE THE DOCUMENT'S, NOT THIS MIGRATION'S. The previous revision of
-- this file had to decide for itself what the three **M-squared** permissions
-- carried, because no document said; it chose {CONSOLE} and reported the
-- question. v2.3 answers it: seller.reviews:read,
-- seller.analytics.basic:read and seller.notifications.preferences:write are
-- MOBILE-reachable, so TWELVE permissions carry {MOBILE, CONSOLE} and thirty
-- carry {CONSOLE}. The seed below is the ruling, and the earlier reading is
-- discarded.
-- ---------------------------------------------------------------------------
INSERT INTO core.permission (code, surfaces, requires_step_up) VALUES
  ('seller.orders:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.orders:respond', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.order_ready:update', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.orders:reissue_instructions', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.payment_evidence:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.payment:confirm', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.refunds:report', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.products:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.products:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.products:publish', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.media:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.stock:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.stock:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.stock:bulk_write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.store:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.store:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.availability:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.fulfilment:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.messages:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.messages:send', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.handoff:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.handoff:custody_transfer', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.couriers:manage', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.reviews:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.claims:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.claims:respond', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.analytics.basic:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.analytics.full:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.analytics:export', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.notifications:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.notifications.preferences:write', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.chatbot:configure', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.chatbot.flows:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.broadcasts:send', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.payout:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.payout:update', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.staff:admin', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.ownership:transfer', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.subscription:update', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.identity:manage', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.account:delete', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.sessions:revoke_all', ARRAY['CONSOLE']::core.session_audience[], true);

INSERT INTO core.role_permission (role, permission_code) VALUES
  ('OWNER', 'seller.orders:read'),
  ('ADMIN', 'seller.orders:read'),
  ('SALES_SUPPORT', 'seller.orders:read'),
  ('INVENTORY', 'seller.orders:read'),
  ('ANALYST', 'seller.orders:read'),
  ('CAMPAIGN_MANAGER', 'seller.orders:read'),
  ('OWNER', 'seller.orders:respond'),
  ('ADMIN', 'seller.orders:respond'),
  ('SALES_SUPPORT', 'seller.orders:respond'),
  ('OWNER', 'seller.order_ready:update'),
  ('ADMIN', 'seller.order_ready:update'),
  ('SALES_SUPPORT', 'seller.order_ready:update'),
  ('INVENTORY', 'seller.order_ready:update'),
  ('OWNER', 'seller.orders:reissue_instructions'),
  ('ADMIN', 'seller.orders:reissue_instructions'),
  ('OWNER', 'seller.payment_evidence:read'),
  ('ADMIN', 'seller.payment_evidence:read'),
  ('SALES_SUPPORT', 'seller.payment_evidence:read'),
  ('OWNER', 'seller.payment:confirm'),
  ('ADMIN', 'seller.payment:confirm'),
  ('SALES_SUPPORT', 'seller.payment:confirm'),
  ('OWNER', 'seller.refunds:report'),
  ('ADMIN', 'seller.refunds:report'),
  ('SALES_SUPPORT', 'seller.refunds:report'),
  ('OWNER', 'seller.products:read'),
  ('ADMIN', 'seller.products:read'),
  ('SALES_SUPPORT', 'seller.products:read'),
  ('INVENTORY', 'seller.products:read'),
  ('ANALYST', 'seller.products:read'),
  ('CAMPAIGN_MANAGER', 'seller.products:read'),
  ('OWNER', 'seller.products:write'),
  ('ADMIN', 'seller.products:write'),
  ('INVENTORY', 'seller.products:write'),
  ('OWNER', 'seller.products:publish'),
  ('ADMIN', 'seller.products:publish'),
  ('INVENTORY', 'seller.products:publish'),
  ('OWNER', 'seller.media:write'),
  ('ADMIN', 'seller.media:write'),
  ('INVENTORY', 'seller.media:write'),
  ('CAMPAIGN_MANAGER', 'seller.media:write'),
  ('OWNER', 'seller.stock:read'),
  ('ADMIN', 'seller.stock:read'),
  ('SALES_SUPPORT', 'seller.stock:read'),
  ('INVENTORY', 'seller.stock:read'),
  ('ANALYST', 'seller.stock:read'),
  ('CAMPAIGN_MANAGER', 'seller.stock:read'),
  ('OWNER', 'seller.stock:write'),
  ('ADMIN', 'seller.stock:write'),
  ('INVENTORY', 'seller.stock:write'),
  ('OWNER', 'seller.stock:bulk_write'),
  ('ADMIN', 'seller.stock:bulk_write'),
  ('INVENTORY', 'seller.stock:bulk_write'),
  ('OWNER', 'seller.store:read'),
  ('ADMIN', 'seller.store:read'),
  ('SALES_SUPPORT', 'seller.store:read'),
  ('INVENTORY', 'seller.store:read'),
  ('ANALYST', 'seller.store:read'),
  ('CAMPAIGN_MANAGER', 'seller.store:read'),
  ('OWNER', 'seller.store:write'),
  ('ADMIN', 'seller.store:write'),
  ('OWNER', 'seller.availability:write'),
  ('ADMIN', 'seller.availability:write'),
  ('OWNER', 'seller.fulfilment:write'),
  ('ADMIN', 'seller.fulfilment:write'),
  ('INVENTORY', 'seller.fulfilment:write'),
  ('OWNER', 'seller.messages:read'),
  ('ADMIN', 'seller.messages:read'),
  ('SALES_SUPPORT', 'seller.messages:read'),
  ('OWNER', 'seller.messages:send'),
  ('ADMIN', 'seller.messages:send'),
  ('SALES_SUPPORT', 'seller.messages:send'),
  ('OWNER', 'seller.handoff:read'),
  ('ADMIN', 'seller.handoff:read'),
  ('SALES_SUPPORT', 'seller.handoff:read'),
  ('INVENTORY', 'seller.handoff:read'),
  ('OWNER', 'seller.handoff:custody_transfer'),
  ('ADMIN', 'seller.handoff:custody_transfer'),
  ('SALES_SUPPORT', 'seller.handoff:custody_transfer'),
  ('INVENTORY', 'seller.handoff:custody_transfer'),
  ('OWNER', 'seller.couriers:manage'),
  ('ADMIN', 'seller.couriers:manage'),
  ('SALES_SUPPORT', 'seller.couriers:manage'),
  ('OWNER', 'seller.reviews:read'),
  ('ADMIN', 'seller.reviews:read'),
  ('SALES_SUPPORT', 'seller.reviews:read'),
  ('INVENTORY', 'seller.reviews:read'),
  ('ANALYST', 'seller.reviews:read'),
  ('CAMPAIGN_MANAGER', 'seller.reviews:read'),
  ('OWNER', 'seller.claims:read'),
  ('ADMIN', 'seller.claims:read'),
  ('SALES_SUPPORT', 'seller.claims:read'),
  ('ANALYST', 'seller.claims:read'),
  ('OWNER', 'seller.claims:respond'),
  ('ADMIN', 'seller.claims:respond'),
  ('SALES_SUPPORT', 'seller.claims:respond'),
  ('OWNER', 'seller.analytics.basic:read'),
  ('ADMIN', 'seller.analytics.basic:read'),
  ('SALES_SUPPORT', 'seller.analytics.basic:read'),
  ('INVENTORY', 'seller.analytics.basic:read'),
  ('ANALYST', 'seller.analytics.basic:read'),
  ('CAMPAIGN_MANAGER', 'seller.analytics.basic:read'),
  ('OWNER', 'seller.analytics.full:read'),
  ('ADMIN', 'seller.analytics.full:read'),
  ('ANALYST', 'seller.analytics.full:read'),
  ('CAMPAIGN_MANAGER', 'seller.analytics.full:read'),
  ('OWNER', 'seller.analytics:export'),
  ('ADMIN', 'seller.analytics:export'),
  ('ANALYST', 'seller.analytics:export'),
  ('OWNER', 'seller.notifications:read'),
  ('ADMIN', 'seller.notifications:read'),
  ('SALES_SUPPORT', 'seller.notifications:read'),
  ('INVENTORY', 'seller.notifications:read'),
  ('ANALYST', 'seller.notifications:read'),
  ('CAMPAIGN_MANAGER', 'seller.notifications:read'),
  ('OWNER', 'seller.notifications.preferences:write'),
  ('ADMIN', 'seller.notifications.preferences:write'),
  ('OWNER', 'seller.chatbot:configure'),
  ('ADMIN', 'seller.chatbot:configure'),
  ('CAMPAIGN_MANAGER', 'seller.chatbot:configure'),
  ('OWNER', 'seller.chatbot.flows:write'),
  ('ADMIN', 'seller.chatbot.flows:write'),
  ('CAMPAIGN_MANAGER', 'seller.chatbot.flows:write'),
  ('OWNER', 'seller.broadcasts:send'),
  ('ADMIN', 'seller.broadcasts:send'),
  ('CAMPAIGN_MANAGER', 'seller.broadcasts:send'),
  ('OWNER', 'seller.payout:read'),
  ('ADMIN', 'seller.payout:read'),
  ('OWNER', 'seller.payout:update'),
  ('ADMIN', 'seller.payout:update'),
  ('OWNER', 'seller.staff:admin'),
  ('ADMIN', 'seller.staff:admin'),
  ('OWNER', 'seller.ownership:transfer'),
  ('OWNER', 'seller.subscription:update'),
  ('ADMIN', 'seller.subscription:update'),
  ('OWNER', 'seller.identity:manage'),
  ('ADMIN', 'seller.identity:manage'),
  ('OWNER', 'seller.account:delete'),
  ('OWNER', 'seller.sessions:revoke_all'),
  ('ADMIN', 'seller.sessions:revoke_all');

-- ---------------------------------------------------------------------------
-- 3. The checksums section 6.9a and A1.5 step 5 require
--
-- Asserted HERE so a bad seed fails the MIGRATION, and again in the integration
-- tests against the authority .sql file, so a bad seed that agrees with itself
-- still fails the BUILD. Section 6.9a is explicit that these run "each against
-- a fixture rather than against the seed".
-- ---------------------------------------------------------------------------
DO $seed_check$
DECLARE
  n_perm int; n_grant int; n_step int; n_mobile int;
  r record;
  expected constant jsonb := '{"OWNER":42,"ADMIN":40,"SALES_SUPPORT":19,
                               "INVENTORY":16,"ANALYST":10,"CAMPAIGN_MANAGER":12}';
BEGIN
  SELECT count(*) INTO n_perm  FROM core.permission;
  SELECT count(*) INTO n_grant FROM core.role_permission;
  SELECT count(*) INTO n_step  FROM core.permission WHERE requires_step_up;
  SELECT count(*) INTO n_mobile FROM core.permission WHERE 'MOBILE' = ANY(surfaces);

  IF n_perm <> 42 THEN
    RAISE EXCEPTION 'core.permission holds % rows; ADU-AUTH-01 v2.3 section 15.1 has 42', n_perm
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF n_grant <> 139 THEN
    RAISE EXCEPTION 'core.role_permission holds % rows; section 16.2 has 139', n_grant
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF n_step <> 8 THEN
    RAISE EXCEPTION 'core.permission holds % step-up rows; section 16.3 names 8', n_step
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF n_mobile <> 12 THEN
    RAISE EXCEPTION 'core.permission holds % mobile-reachable rows; section 16.2a has 12', n_mobile
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Per-role totals: 42 / 40 / 19 / 16 / 10 / 12.
  FOR r IN SELECT role::text AS role, count(*)::int AS n
             FROM core.role_permission GROUP BY 1 LOOP
    IF (expected ->> r.role)::int IS DISTINCT FROM r.n THEN
      RAISE EXCEPTION 'role % holds % permissions; section 16.2 says %',
        r.role, r.n, expected ->> r.role
        USING ERRCODE = 'restrict_violation';
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT role) FROM core.role_permission) <> 6 THEN
    RAISE EXCEPTION 'section 16.2 grants to six roles; the seed does not'
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

  -- A1.2's one-to-one correspondence: one core.step_up_action value per
  -- step-up permission. A ninth step-up permission with no value to record its
  -- challenge is the defect A1.2 closed, and this is what keeps it closed.
  IF (SELECT count(*) FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'core' AND t.typname = 'step_up_action') <> n_step THEN
    RAISE EXCEPTION
      'core.step_up_action has % values against % step-up permissions (A1.2)',
      (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'core' AND t.typname = 'step_up_action'), n_step
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- ANALYST holds no write of any kind. Asserted by iterating the catalogue
  -- rather than by a hand-written list of writes, per section 24, "so a write
  -- added later is caught without anyone remembering to add a case".
  IF EXISTS (
    SELECT 1 FROM core.role_permission
     WHERE role = 'ANALYST'
       AND split_part(permission_code, ':', 2) NOT IN ('read', 'export')
  ) THEN
    RAISE EXCEPTION 'ANALYST holds a write permission; section 16.2 says zero'
      USING ERRCODE = 'restrict_violation';
  END IF;
END $seed_check$;

-- ---------------------------------------------------------------------------
-- 4. Grants
--
-- The catalogue is reference data read on every authorization decision and
-- written only by migration. adulis_app gets SELECT and nothing else: a matrix
-- the application can INSERT into is an authorization model that widens at
-- runtime with no migration and no diff, which is the same argument section
-- 12.2 makes for the state-transition tables.
--
-- A1.3 justifies fn_has_permission's SECURITY DEFINER on the grounds that these
-- are tables "which the app role has no need to read directly". SELECT IS
-- RETAINED ANYWAY, because ADU-AUTH-01 section 5 returns roles[] as a rendering
-- hint and section 16.2 requires that a client not hide a control the server
-- would permit - which needs the grant set, not just a yes/no per call. The
-- tension is reported rather than resolved by revoking; SECURITY DEFINER makes
-- the function correct either way.
-- ---------------------------------------------------------------------------
GRANT SELECT ON core.permission, core.role_permission TO adulis_app, adulis_readonly;
REVOKE INSERT, UPDATE, DELETE ON core.permission      FROM adulis_app;
REVOKE INSERT, UPDATE, DELETE ON core.role_permission FROM adulis_app;

-- fn_has_permission (migration 05a) is SECURITY DEFINER owned by adulis_migrate
-- and reads both tables. It needs its own grant, which is deliberately narrower
-- than the app's: SELECT, on these two, and nothing else.
GRANT SELECT ON core.permission, core.role_permission TO adulis_migrate;

-- Down Migration

DO $$
BEGIN
  RAISE EXCEPTION
    'Migration 05b is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $$;
