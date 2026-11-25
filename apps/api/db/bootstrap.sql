-- apps/api/db/bootstrap.sql -- run ONCE per cluster/database by `pnpm db:bootstrap` as the provisioning
-- superuser (ARC-BE-03). Idempotent. It creates the three runtime responsibilities of the replacement lineage
-- and nothing else: no schema object, no data.
--
--   adulis_migrator  owns every replacement schema object; runs `pnpm db:migrate`; CREATE on the database
--   adulis_api       the API process: CONNECT plus whatever each migration grants, nothing more
--   adulis_worker    the worker process: likewise
--
-- None is SUPERUSER, CREATEDB, CREATEROLE, REPLICATION or BYPASSRLS, and the attributes are re-asserted on
-- every run so a role that pre-existed with more power is reduced, not trusted. Passwords and the
-- database-level grants are applied by bootstrap.ts with server-side quoting (format %I / %L).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['adulis_migrator', 'adulis_api', 'adulis_worker'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I LOGIN', r);
    END IF;
    EXECUTE format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT', r);
  END LOOP;
END
$$;

-- Nothing is created in public, and functions the migrator creates are not executable by PUBLIC by default.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE adulis_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
