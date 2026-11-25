#!/usr/bin/env bash
# ops/rebuild/disposable-db.sh -- the clean-rebuild lineage's DISPOSABLE PostgreSQL target (RBL-02, RB25-D02).
#
# It is NEW and EMPTY: its own container, volume, host port, database name and identity comment. It is never the
# legacy adulis-postgres (host port 5434), which is preserved untouched. No real data is ever loaded into it;
# schema creation belongs to ARC-BE-03. Bound to 127.0.0.1 with a local-only password (fake, not a secret).
#
#   bash ops/rebuild/disposable-db.sh up            create (or start) the target and stamp its identity
#   bash ops/rebuild/disposable-db.sh fingerprint   print identity, labels and emptiness proof
#   bash ops/rebuild/disposable-db.sh env           print DATABASE_URL for the target
#   bash ops/rebuild/disposable-db.sh stop|start    stop or start the container (data kept)
#   bash ops/rebuild/disposable-db.sh down          remove container AND volume -- refuses unless both carry the
#                                                   disposable rebuild labels
set -euo pipefail

LINEAGE='rebuild-20261125'
NAME="adulis-rebuild-pg-20261125"
VOLUME="adulis-rebuild-pgdata-20261125"
PORT="${ADULIS_REBUILD_PG_PORT:-55440}"
DB='adulis_rebuild'
USER_='rebuild_bootstrap'
PASS='rebuild-local-only'
IMAGE='pgvector/pgvector:pg17'
IDENTITY="adulis clean-rebuild disposable target, lineage ${LINEAGE}; never the legacy adulis-postgres"
LEGACY_PORTS=' 5432 5433 5434 '   # 5432: the repository default and legacy adulis; 5434: adulis-postgres; 5433: another project

die() { echo "disposable-db: $*" >&2; exit 2; }
psql_t() { docker exec "$NAME" psql -U "$USER_" -d "$DB" -At -v ON_ERROR_STOP=1 -c "$1"; }
label() { docker inspect -f "{{ index .Config.Labels \"$1\" }}" "$NAME" 2>/dev/null || true; }

guard() {
  case "$PORT" in ''|*[!0-9]*) die "port '$PORT' is not numeric; refusing" ;; esac
  case "$LEGACY_PORTS" in *" $PORT "*) die "port $PORT belongs to an existing non-rebuild database; refusing" ;; esac
  [ "$NAME" != 'adulis-postgres' ] || die 'refusing to touch the legacy container'
  if docker inspect "$NAME" >/dev/null 2>&1; then
    [ "$(label com.adulis.lineage)" = "$LINEAGE" ] || die "container $NAME exists without the rebuild lineage label; refusing"
    [ "$(label com.adulis.disposable)" = 'true' ] || die "container $NAME is not labelled disposable; refusing"
  fi
}

case "${1:-}" in
  up)
    guard
    if docker inspect "$NAME" >/dev/null 2>&1; then
      docker start "$NAME" >/dev/null
    else
      docker volume create --label com.adulis.lineage="$LINEAGE" --label com.adulis.disposable=true "$VOLUME" >/dev/null
      docker run -d --name "$NAME" \
        --label com.adulis.lineage="$LINEAGE" --label com.adulis.disposable=true \
        --memory=256m -p "127.0.0.1:${PORT}:5432" \
        -e POSTGRES_USER="$USER_" -e POSTGRES_PASSWORD="$PASS" -e POSTGRES_DB="$DB" \
        -v "$VOLUME":/var/lib/postgresql/data "$IMAGE" >/dev/null
    fi
    for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U "$USER_" -d "$DB" >/dev/null 2>&1 && break; sleep 1; done
    docker exec "$NAME" pg_isready -U "$USER_" -d "$DB" >/dev/null || die 'target did not become ready'
    psql_t "COMMENT ON DATABASE ${DB} IS '${IDENTITY}'" >/dev/null
    echo "disposable-db: ${NAME} ready on 127.0.0.1:${PORT} (database ${DB})"
    ;;
  fingerprint)
    guard
    echo "container:      ${NAME} ($(docker inspect -f '{{.State.Status}}' "$NAME"))"
    echo "labels:         lineage=$(label com.adulis.lineage) disposable=$(label com.adulis.disposable)"
    echo "volume:         ${VOLUME} (lineage label: $(docker volume inspect -f '{{ index .Labels "com.adulis.lineage" }}' "$VOLUME"))"
    echo "host binding:   $(docker port "$NAME" 5432/tcp)"
    echo "server:         $(psql_t 'select version()' | cut -c1-60)"
    echo "database:       $(psql_t 'select current_database()')"
    echo "identity:       $(psql_t "select shobj_description(oid,'pg_database') from pg_database where datname=current_database()")"
    echo "user tables:    $(psql_t "select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')")"
    echo "legacy markers: pgmigrations=$(psql_t "select to_regclass('public.pgmigrations') is not null") core_schema=$(psql_t "select exists(select 1 from pg_namespace where nspname='core')")"
    ;;
  env)
    guard
    # The URL comes from the container's ACTUAL binding, never from the override alone.
    docker inspect "$NAME" >/dev/null 2>&1 || die "container $NAME does not exist; run 'up' first"
    BOUND="$(docker port "$NAME" 5432/tcp | head -1)"
    [ -n "$BOUND" ] || die "container $NAME is not running; run 'start' first"
    echo "DATABASE_URL=postgres://${USER_}:${PASS}@${BOUND}/${DB}"
    ;;
  stop) guard; docker stop "$NAME" >/dev/null && echo "disposable-db: stopped (data kept)" ;;
  start) guard; docker start "$NAME" >/dev/null && echo "disposable-db: started" ;;
  down)
    guard
    [ "$(docker volume inspect -f '{{ index .Labels "com.adulis.disposable" }}' "$VOLUME" 2>/dev/null)" = 'true' ] || die "volume $VOLUME is not labelled disposable; refusing"
    docker rm -f "$NAME" >/dev/null && docker volume rm "$VOLUME" >/dev/null && echo 'disposable-db: removed container and volume'
    ;;
  *) sed -n '2,16p' "$0"; exit 2 ;;
esac
