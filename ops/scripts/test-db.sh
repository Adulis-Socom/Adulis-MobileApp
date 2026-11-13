#!/usr/bin/env bash
# A disposable PostgreSQL and MinIO for the API suites, set up as CI sets up its own (WO-INFRA-012).
#
#   bash ops/scripts/test-db.sh up              # start, migrate, seed, mark disposable
#   eval "$(bash ops/scripts/test-db.sh env)"   # in the shell that runs the suites, then:
#   pnpm --filter @adulis/api test              # or: pnpm ci:local
#   bash ops/scripts/test-db.sh down            # remove both containers; their data goes with them
#
# The suites refuse any database without the mark (apps/api/test/db-target.ts), and the root .env
# points at the persistent development database, so this is the local way to run them. Both
# containers bind 127.0.0.1 only, keep no named volume (--rm drops their data), and use CI's fake
# credentials. MinIO is disposable too: with the .env values the suites would write into the live
# development MinIO. Ports: ADULIS_TEST_PG_PORT (55432), ADULIS_TEST_MINIO_PORT (59000).
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/../.."
PG=adulis-test-pg
S3=adulis-test-minio
PG_PORT=${ADULIS_TEST_PG_PORT:-55432}
S3_PORT=${ADULIS_TEST_MINIO_PORT:-59000}
MINIO_IMAGE=$(sed -n 's/^x-minio-image: &minio-image //p' docker-compose.yml)

env_lines() {
  cat <<EOF
export DATABASE_URL=postgres://adulis_app:ci-password@127.0.0.1:$PG_PORT/adulis
export DATABASE_URL_MIGRATE=postgres://adulis_bootstrap:ci-password@127.0.0.1:$PG_PORT/adulis
export DATABASE_URL_JOBS=postgres://adulis_jobs:ci-password@127.0.0.1:$PG_PORT/adulis
export R2_ACCOUNT_ID=http://127.0.0.1:$S3_PORT R2_MEDIA_PUBLIC_ORIGIN=http://127.0.0.1:$S3_PORT/adulis-media
export R2_ACCESS_KEY_ID=adulis-local R2_SECRET_ACCESS_KEY=adulis-local-secret
export R2_MEDIA_BUCKET=adulis-media R2_EVIDENCE_BUCKET=adulis-evidence
export EVIDENCE_ENCRYPTION_KEY_V1=ci-fake-evidence-key PAYOUT_ENCRYPTION_KEY_V1=ci-fake-payout-key IDENTITY_HASH_KEY_V1=ci-fake-identity-key
export ADULIS_PG_CONTAINER=$PG
EOF
}
# ADULIS_PG_CONTAINER (WO-INFRA-015A): db-determinism creates and drops databases through
# `docker exec` into this container, after proving it is the server DATABASE_URL_MIGRATE reaches.

wait_for() { # $1 = what, rest = command; 90 s at most
  local what=$1; shift
  for _ in $(seq 90); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  echo "test-db: $what not ready after 90 s" >&2
  return 1
}

case "${1:-}" in
  up)
    [ -n "$MINIO_IMAGE" ] || { echo "test-db: no x-minio-image in docker-compose.yml" >&2; exit 1; }
    # Before the trap: a pair that already exists belongs to another run, which the trap must not remove.
    names=$(docker ps -a --format '{{.Names}}') || { echo "test-db: docker is not reachable" >&2; exit 1; }
    if grep -qxE "$PG|$S3" <<<"$names"; then
      echo "test-db: $PG or $S3 already exists (another run?); run 'bash ops/scripts/test-db.sh down' first" >&2
      exit 1
    fi
    # A failed step removes what THIS run started, by container ID: a run that loses a race for the
    # names must not remove the other run's containers (WO-INFRA-015A review).
    started=()
    trap 'echo "test-db: setup failed; removing the containers this run started" >&2; [ ${#started[@]} -eq 0 ] || docker rm -f -v "${started[@]}" >/dev/null 2>&1' ERR
    started+=("$(docker run -d --rm --name "$PG" -p "127.0.0.1:$PG_PORT:5432" -e POSTGRES_USER=adulis_bootstrap \
      -e POSTGRES_PASSWORD=ci-password -e POSTGRES_DB=adulis pgvector/pgvector:pg17)")
    started+=("$(docker run -d --rm --name "$S3" -p "127.0.0.1:$S3_PORT:9000" -e MINIO_ROOT_USER=adulis-local \
      -e MINIO_ROOT_PASSWORD=adulis-local-secret "$MINIO_IMAGE" server /data)")
    eval "$(env_lines)"
    # Ready only once the image's init has finished and restarted the server on its real socket.
    wait_for PostgreSQL docker exec "$PG" psql -U adulis_bootstrap -d adulis -h 127.0.0.1 -c 'select 1'
    # The setup below writes over 127.0.0.1:$PG_PORT before the mark exists: prove that port reaches
    # the container just started, not a local PostgreSQL listening on the same port (WO-INFRA-015A).
    inside=$(docker exec "$PG" psql -U adulis_bootstrap -d adulis -AtX -c 'select system_identifier from pg_control_system()')
    outside=$(node --input-type=module -e "import pg from 'pg'; const c = new pg.Client({ connectionString: process.env.DATABASE_URL_MIGRATE }); await c.connect(); const r = await c.query('select system_identifier::text AS s from pg_control_system()'); console.log(r.rows[0].s); await c.end();")
    if [ -z "$inside" ] || [ "$inside" != "$outside" ]; then
      echo "test-db: 127.0.0.1:$PG_PORT is not $PG (another server answers there); nothing was written" >&2
      false
    fi
    docker exec -i "$PG" psql -U adulis_bootstrap -d adulis -v ON_ERROR_STOP=1 -q <db/init/00-extensions.sql
    pnpm -s db:migrate >/dev/null
    pnpm -s worker:install >/dev/null # gate `worker-schema`: the queue schema the worker suites run on
    for role in adulis_app adulis_jobs; do
      docker exec "$PG" psql -U adulis_bootstrap -d adulis -v ON_ERROR_STOP=1 -q -c "ALTER ROLE $role LOGIN PASSWORD 'ci-password'"
    done
    NODE_ENV=test pnpm -s db:seed >/dev/null
    wait_for MinIO docker exec "$S3" mc ready local
    docker exec -i -e MINIO_URL=http://127.0.0.1:9000 -e MINIO_ROOT_USER=adulis-local \
      -e MINIO_ROOT_PASSWORD=adulis-local-secret "$S3" /bin/sh -s <ops/scripts/minio-init.sh >/dev/null
    # Last: only a fully set-up database carries the mark the guards accept.
    docker exec "$PG" psql -U adulis_bootstrap -d adulis -v ON_ERROR_STOP=1 -q \
      -c "COMMENT ON DATABASE adulis IS 'adulis:disposable-test-database'"
    trap - ERR
    echo "test-db: ready (PostgreSQL 127.0.0.1:$PG_PORT, MinIO 127.0.0.1:$S3_PORT). Now:" >&2
    echo "  eval \"\$(bash ops/scripts/test-db.sh env)\"" >&2
    ;;
  env) env_lines ;;
  down)
    # -v: the postgres image declares a VOLUME; without it every up/down left an anonymous volume.
    docker info >/dev/null 2>&1 || { echo "test-db: docker is not reachable; nothing was removed" >&2; exit 1; }
    docker rm -f -v "$PG" "$S3" >/dev/null 2>&1 || true
    names=$(docker ps -a --format '{{.Names}}') || { echo "test-db: docker stopped answering; check by hand" >&2; exit 1; }
    if grep -qxE "$PG|$S3" <<<"$names"; then
      echo "test-db: could not remove $PG or $S3" >&2
      exit 1
    fi
    echo "test-db: removed $PG and $S3" >&2
    ;;
  *)
    echo "usage: bash ops/scripts/test-db.sh up | env | down" >&2
    exit 2
    ;;
esac
