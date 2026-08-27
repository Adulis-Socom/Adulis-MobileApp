-- LOCAL DEVELOPMENT ONLY. This directory is mounted into the compose
-- container's /docker-entrypoint-initdb.d and runs once, on first
-- initialisation of an empty data directory. It never runs in CI (the service
-- container has no such mount) and never in production (provisioning there is
-- the host's concern - ADU-CON-02 v3.0 section 19; a password in a migration
-- would be a secret in git, which is why migration 01 creates every role
-- NOLOGIN and this file exists at all).
--
-- WHY: "adulis_app is never a superuser, in any environment, INCLUDING
-- LOCAL" (apps/api/CLAUDE.md). Under a superuser DATABASE_URL every boundary
-- check passes while proving nothing - check 10 returns zero rows because
-- privileges are irrelevant, not because they are correct. From Tier 3 the
-- API's pools connect as adulis_app, so the role needs LOGIN locally.
--
-- This runs BEFORE any migration (initdb time), so the roles are created
-- here with LOGIN; migration 01's guarded CREATE ROLE ... NOLOGIN then skips
-- them (IF NOT EXISTS) and the LOGIN attribute survives. On an
-- already-initialised volume, apply by hand:
--   docker exec -i adulis-postgres psql -U adulis_bootstrap -d postgres \
--     -f /docker-entrypoint-initdb.d/01-local-logins.sql

DO $provision$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['adulis_app', 'adulis_jobs'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', r, 'local-dev-password');
    ELSE
      EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L', r, 'local-dev-password');
    END IF;
  END LOOP;
END
$provision$;
