-- ===========================================================================
-- ADULIS PROVIDER CAPABILITY PROBE
--
-- *** THIS IS DISPOSABLE CAPABILITY-TEST DDL. IT IS NOT THE SCHEMA. ***
--
-- Nothing in this file is part of the Adulis data model. It creates throwaway
-- roles, schemas, tables and functions with a `probe_` prefix, proves that the
-- PostgreSQL instance can actually do the five things the architecture depends
-- on, and then DROPS EVERYTHING IT CREATED. It must never be copied into
-- db/migrations/, and no object it defines resembles a real Adulis object.
--
-- The real schema is ADU-DB-01: nine schemas, six roles, 105 tables in v1.6
-- rising to 107 under the pending v1.7. This probe creates six roles and two
-- schemas because those are the SHAPES being tested, not because these are them.
--
-- WHY THIS EXISTS. ADU-CON-02 v3.0 section 18 makes provider verification
-- mandatory before any hosting commitment, and notes that "requirement 5 is on
-- no feature page" — a managed provider's marketing tells you the Postgres
-- version, not whether you may own a schema with a role the application cannot
-- reach. Any failure below disqualifies that provider THAT DAY. Open item O-1
-- makes this day one of Tier 0.
--
-- WHAT IT PROVES, and why each one is load-bearing:
--   1. The four extensions install (section 18 step 1). Without `vector` the
--      chatbot cascade has no layer 3; without `btree_gist` the
--      duplicate-reservation invariant of ADU-DB-01 section 9.1 has no
--      implementation at all (ADU-DB-01 section 29).
--   2. Six roles can be created and granted independently.
--   3. Two schemas can be owned by DIFFERENT roles — the `verification` and
--      `financial` isolation of ADU-DB-01 sections 7.3 and 13.3.
--   4. REVOKE ALL actually holds against a simulated app role, and a
--      SECURITY DEFINER function crosses the boundary the app role cannot:
--      the app role CAN call the function but CANNOT SELECT the table. This is
--      Appendix C check 10 as a live test rather than a grep.
--   5. RLS filters on `current_setting('adulis.actor_role', true)` — the
--      mechanism the whole section 6.1 transaction-settings design rests on.
--
-- HOW TO RUN: see run-probe.md. Use a SCRATCH DATABASE, never a real one.
--   psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f probe.sql
--
-- Requires a superuser or a role with CREATEROLE + CREATE on the database.
-- ===========================================================================

\set ON_ERROR_STOP on
\timing off

\echo ''
\echo '=== ADULIS PROVIDER CAPABILITY PROBE ==='
\echo 'Disposable test DDL. Everything created here is dropped at the end.'
\echo ''

-- Start from a clean slate even if a previous run aborted half way.
-- DROP OWNED BY errors on a role that does not exist, so it is guarded: this
-- block must be safe on a virgin database and on one holding a failed run.
DROP SCHEMA IF EXISTS probe_financial CASCADE;
DROP SCHEMA IF EXISTS probe_core CASCADE;
DROP TABLE IF EXISTS probe_exclude_check;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['probe_app','probe_migrate','probe_financial_owner',
                           'probe_verification_owner','probe_readonly','probe_jobs']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('DROP OWNED BY %I CASCADE', r);
      EXECUTE format('DROP ROLE %I', r);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 1. EXTENSIONS (section 18, step 1)
-- ---------------------------------------------------------------------------
\echo '--- 1. Extensions ---'

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

SELECT extname AS extension,
       extversion AS version,
       'PASS' AS result
FROM pg_extension
WHERE extname IN ('vector', 'btree_gist', 'pg_trgm', 'pgcrypto')
ORDER BY extname;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_extension
   WHERE extname IN ('vector','btree_gist','pg_trgm','pgcrypto');
  IF n <> 4 THEN
    RAISE EXCEPTION 'CAPABILITY 1 FAILED: % of 4 extensions present. Provider disqualified.', n;
  END IF;
  RAISE NOTICE 'CAPABILITY 1 PASS: all four extensions installed';
END $$;

-- Prove btree_gist is not merely installed but USABLE in the one construct the
-- architecture cannot do without: an EXCLUDE constraint mixing an equality
-- column with a range. This is the shape of ADU-DB-01 section 12.1's
-- duplicate-reservation constraint.
CREATE TABLE probe_exclude_check (
  id           bigserial PRIMARY KEY,
  variant_id   uuid NOT NULL,
  live_window  tstzrange NOT NULL,
  EXCLUDE USING gist (variant_id WITH =, live_window WITH &&)
);

INSERT INTO probe_exclude_check (variant_id, live_window)
VALUES ('00000000-0000-4000-8000-000000000001',
        tstzrange('2026-01-01', '2026-02-01'));

DO $$
BEGIN
  BEGIN
    INSERT INTO probe_exclude_check (variant_id, live_window)
    VALUES ('00000000-0000-4000-8000-000000000001',
            tstzrange('2026-01-15', '2026-03-01'));
    RAISE EXCEPTION 'CAPABILITY 1b FAILED: overlapping row was accepted; EXCLUDE USING gist is not enforcing';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'CAPABILITY 1b PASS: EXCLUDE USING gist rejected the overlap (exclusion_violation)';
  END;
END $$;

-- ---------------------------------------------------------------------------
-- 2. SIX ROLES
-- ---------------------------------------------------------------------------
\echo ''
\echo '--- 2. Six roles ---'

CREATE ROLE probe_app                  NOLOGIN;
CREATE ROLE probe_migrate              NOLOGIN;
CREATE ROLE probe_financial_owner      NOLOGIN;
CREATE ROLE probe_verification_owner   NOLOGIN;
CREATE ROLE probe_readonly             NOLOGIN;
CREATE ROLE probe_jobs                 NOLOGIN;

SELECT rolname AS role, 'PASS' AS result
FROM pg_roles
WHERE rolname LIKE 'probe_%'
ORDER BY rolname;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_roles WHERE rolname LIKE 'probe_%';
  IF n <> 6 THEN
    RAISE EXCEPTION 'CAPABILITY 2 FAILED: created % of 6 roles. Provider disqualified.', n;
  END IF;
  RAISE NOTICE 'CAPABILITY 2 PASS: six independent roles created';
END $$;

-- ---------------------------------------------------------------------------
-- 3. TWO SCHEMAS OWNED BY DIFFERENT ROLES
-- ---------------------------------------------------------------------------
\echo ''
\echo '--- 3. Two schemas, different owners ---'

CREATE SCHEMA probe_core      AUTHORIZATION probe_app;
CREATE SCHEMA probe_financial AUTHORIZATION probe_financial_owner;

SELECT n.nspname AS schema,
       pg_get_userbyid(n.nspowner) AS owner,
       'PASS' AS result
FROM pg_namespace n
WHERE n.nspname IN ('probe_core', 'probe_financial')
ORDER BY n.nspname;

DO $$
DECLARE core_owner text; fin_owner text;
BEGIN
  SELECT pg_get_userbyid(nspowner) INTO core_owner FROM pg_namespace WHERE nspname='probe_core';
  SELECT pg_get_userbyid(nspowner) INTO fin_owner  FROM pg_namespace WHERE nspname='probe_financial';
  IF core_owner = fin_owner THEN
    RAISE EXCEPTION 'CAPABILITY 3 FAILED: both schemas owned by %. The isolated boundary is impossible here.', core_owner;
  END IF;
  RAISE NOTICE 'CAPABILITY 3 PASS: probe_core owned by %, probe_financial owned by %', core_owner, fin_owner;
END $$;

-- ---------------------------------------------------------------------------
-- 4. REVOKE ALL HOLDS, AND SECURITY DEFINER CROSSES THE BOUNDARY
--
--    The shape of ADU-DB-01 section 13.3 / Appendix C check 10: the app role
--    has NO grant on the financial schema and reaches it only through a
--    SECURITY DEFINER function that writes the access log in the SAME
--    transaction. An unlogged read is not possible, rather than not permitted.
-- ---------------------------------------------------------------------------
\echo ''
\echo '--- 4. REVOKE holds; SECURITY DEFINER crosses ---'

SET ROLE probe_financial_owner;

CREATE TABLE probe_financial.secret_ledger (
  id           bigserial PRIMARY KEY,
  order_id     uuid NOT NULL,
  ciphertext   bytea NOT NULL
);

CREATE TABLE probe_financial.access_log (
  id           bigserial PRIMARY KEY,
  actor_role   text NOT NULL,
  ledger_id    bigint NOT NULL,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

-- pgcrypto lives in `public`; the function below deliberately hardens its
-- search_path to exclude it, so every pgcrypto call here is schema-qualified.
INSERT INTO probe_financial.secret_ledger (order_id, ciphertext)
VALUES ('00000000-0000-4000-8000-0000000000ff',
        public.pgp_sym_encrypt('probe-secret', 'probe-key')::bytea);

-- The whole point: the app role gets nothing on this schema.
REVOKE ALL ON SCHEMA probe_financial FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA probe_financial FROM PUBLIC;
REVOKE ALL ON SCHEMA probe_financial FROM probe_app;
REVOKE ALL ON ALL TABLES IN SCHEMA probe_financial FROM probe_app;

-- The single escorted path. SECURITY DEFINER runs as the function's OWNER
-- (probe_financial_owner), so it can read the table the CALLER cannot, and it
-- writes the log row in the same statement.
-- Returns CIPHERTEXT, never plaintext. This mirrors ruling R15: key material
-- never enters Postgres, so the boundary function hands back the ciphertext and
-- a key reference and the API decrypts (as ~64 KB AEAD frames, R18). A probe
-- that decrypted in-database would be testing a shape the architecture rejects.
--
-- search_path is pinned and excludes `public` on purpose: an unqualified call
-- inside a SECURITY DEFINER function is the classic privilege-escalation hole,
-- because the caller controls the search path.
CREATE FUNCTION probe_financial.read_secret(p_id bigint)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = probe_financial, pg_temp
AS $fn$
DECLARE v bytea;
BEGIN
  SELECT ciphertext INTO v FROM probe_financial.secret_ledger WHERE id = p_id;
  -- Reading and logging are ONE statement pair in ONE transaction: an unlogged
  -- read is not possible, rather than not permitted (ADU-DPIA-01 section 4).
  INSERT INTO probe_financial.access_log (actor_role, ledger_id)
  VALUES (current_setting('adulis.actor_role', true), p_id);
  RETURN v;
END
$fn$;

GRANT USAGE ON SCHEMA probe_financial TO probe_app;
GRANT EXECUTE ON FUNCTION probe_financial.read_secret(bigint) TO probe_app;
GRANT USAGE, SELECT ON SEQUENCE probe_financial.access_log_id_seq TO probe_financial_owner;

RESET ROLE;

-- 4a. The app role must NOT be able to SELECT the table directly.
SET ROLE probe_app;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM probe_financial.secret_ledger LIMIT 1;
    RAISE EXCEPTION 'CAPABILITY 4a FAILED: probe_app read the table directly. REVOKE does not hold. Provider disqualified.';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'CAPABILITY 4a PASS: direct SELECT denied (insufficient_privilege)';
  END;
END $$;

-- 4b. The same role MUST be able to call the escorted function, and the call
--     must write the log row.
DO $$
DECLARE ct bytea;
BEGIN
  PERFORM set_config('adulis.actor_role', 'SELLER_OWNER', true);
  SELECT probe_financial.read_secret(1) INTO ct;
  IF ct IS NULL OR length(ct) = 0 THEN
    RAISE EXCEPTION 'CAPABILITY 4b FAILED: SECURITY DEFINER returned no ciphertext';
  END IF;
  RAISE NOTICE 'CAPABILITY 4b PASS: SECURITY DEFINER callable by probe_app; returned % bytes of ciphertext (never plaintext, R15)', length(ct);
END $$;

RESET ROLE;

-- 4c. The read wrote its log row — reading and logging are one statement.
DO $$
DECLARE n int; r text;
BEGIN
  SELECT count(*), max(actor_role) INTO n, r FROM probe_financial.access_log;
  IF n <> 1 THEN
    RAISE EXCEPTION 'CAPABILITY 4c FAILED: access_log has % rows, expected 1. An unlogged read is possible here.', n;
  END IF;
  RAISE NOTICE 'CAPABILITY 4c PASS: the read wrote its access-log row, actor_role=%', r;
END $$;

-- ---------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY KEYED ON current_setting('adulis.actor_role', true)
--
--    This is the mechanism ADU-CON-02 section 6.1 rests on: a courier's SELECT
--    returns only their rows even if application code forgets the WHERE.
-- ---------------------------------------------------------------------------
\echo ''
\echo '--- 5. RLS on a transaction-local setting ---'

CREATE TABLE probe_core.scoped_order (
  id          bigserial PRIMARY KEY,
  owner_role  text NOT NULL,
  detail      text NOT NULL
);

INSERT INTO probe_core.scoped_order (owner_role, detail) VALUES
  ('SELLER_OWNER', 'visible to the seller'),
  ('COURIER',      'visible to the courier'),
  ('SELLER_OWNER', 'also the seller');

ALTER TABLE probe_core.scoped_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE probe_core.scoped_order FORCE ROW LEVEL SECURITY;

CREATE POLICY probe_scope ON probe_core.scoped_order
  FOR SELECT
  USING (owner_role = current_setting('adulis.actor_role', true));

GRANT USAGE ON SCHEMA probe_core TO probe_app;
GRANT SELECT ON probe_core.scoped_order TO probe_app;

SET ROLE probe_app;
DO $$
DECLARE seller_rows int; courier_rows int; unset_rows int;
BEGIN
  PERFORM set_config('adulis.actor_role', 'SELLER_OWNER', true);
  SELECT count(*) INTO seller_rows FROM probe_core.scoped_order;

  PERFORM set_config('adulis.actor_role', 'COURIER', true);
  SELECT count(*) INTO courier_rows FROM probe_core.scoped_order;

  -- Fail closed: with no identity declared, the policy must return nothing.
  PERFORM set_config('adulis.actor_role', '', true);
  SELECT count(*) INTO unset_rows FROM probe_core.scoped_order;

  IF seller_rows <> 2 THEN
    RAISE EXCEPTION 'CAPABILITY 5 FAILED: SELLER_OWNER saw % rows, expected 2', seller_rows;
  END IF;
  IF courier_rows <> 1 THEN
    RAISE EXCEPTION 'CAPABILITY 5 FAILED: COURIER saw % rows, expected 1', courier_rows;
  END IF;
  IF unset_rows <> 0 THEN
    RAISE EXCEPTION 'CAPABILITY 5 FAILED: an unset actor_role saw % rows, expected 0. RLS does not fail closed here.', unset_rows;
  END IF;

  RAISE NOTICE 'CAPABILITY 5 PASS: RLS filtered 3 rows to 2 (SELLER_OWNER), 1 (COURIER), 0 (unset)';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- TEARDOWN — the probe leaves nothing behind.
-- ---------------------------------------------------------------------------
\echo ''
\echo '--- Teardown ---'

DROP TABLE IF EXISTS probe_exclude_check;
DROP SCHEMA IF EXISTS probe_financial CASCADE;
DROP SCHEMA IF EXISTS probe_core CASCADE;

DROP OWNED BY probe_app                CASCADE;
DROP OWNED BY probe_migrate            CASCADE;
DROP OWNED BY probe_financial_owner    CASCADE;
DROP OWNED BY probe_verification_owner CASCADE;
DROP OWNED BY probe_readonly           CASCADE;
DROP OWNED BY probe_jobs               CASCADE;

DROP ROLE IF EXISTS probe_app;
DROP ROLE IF EXISTS probe_migrate;
DROP ROLE IF EXISTS probe_financial_owner;
DROP ROLE IF EXISTS probe_verification_owner;
DROP ROLE IF EXISTS probe_readonly;
DROP ROLE IF EXISTS probe_jobs;

DO $$
DECLARE leftover_roles int; leftover_schemas int;
BEGIN
  SELECT count(*) INTO leftover_roles   FROM pg_roles     WHERE rolname LIKE 'probe_%';
  SELECT count(*) INTO leftover_schemas FROM pg_namespace WHERE nspname LIKE 'probe_%';
  IF leftover_roles <> 0 OR leftover_schemas <> 0 THEN
    RAISE EXCEPTION 'TEARDOWN INCOMPLETE: % roles and % schemas remain', leftover_roles, leftover_schemas;
  END IF;
  RAISE NOTICE 'TEARDOWN PASS: no probe_ roles or schemas remain';
END $$;

\echo ''
\echo '=== PROBE COMPLETE — all capabilities passed ==='
\echo ''
