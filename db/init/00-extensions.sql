-- Adulis local database initialisation.
--
-- Runs once, automatically, on first container start (docker-entrypoint-initdb.d).
-- This is NOT a migration and it is NOT the schema: db/migrations owns all DDL,
-- applied by node-pg-migrate under the DDL-only adulis_migrate role. This file
-- exists so that a developer's very first `docker compose up -d` yields a
-- database with the four extensions already present, which is Gate D.
--
-- ADU-DB-01 section 3.1 requires all four. ADU-CON-02 v3.0 section 18 makes
-- creating them step 1 of provider verification: a provider that cannot is
-- disqualified that day.

CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector: chatbot cascade layer 3
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- required by EXCLUDE USING gist
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- trigram search indexes
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- digest / gen_random_bytes
