#!/usr/bin/env bash
# ops/rebuild/disposable-db.sh -- the clean-rebuild lineage's DISPOSABLE PostgreSQL target (RBL-02, RB25-D02,
# hardened in ARC-BE-01).
#
# It is NEW and EMPTY: its own container, volume, host port, database name and identity comment. It is never the
# legacy adulis-postgres (host port 5434), which is preserved untouched. No real data is ever loaded into it.
# Bound to 127.0.0.1 with a local-only password (fake, not a secret).
#
#   bash ops/rebuild/disposable-db.sh up            create (or start) the target; stamp identity ONLY on a volume
#                                                   this invocation created
#   bash ops/rebuild/disposable-db.sh verify        every identity/isolation/lineage check, no output on success
#   bash ops/rebuild/disposable-db.sh fingerprint   verify, then print identity, labels and emptiness proof
#   bash ops/rebuild/disposable-db.sh env           verify, then print the superuser bootstrap URL
#   bash ops/rebuild/disposable-db.sh stop|start    stop or start the container (data kept)
#   bash ops/rebuild/disposable-db.sh down          remove container AND volume after every check passes
#
# Every check FAILS CLOSED (exit 2). An existing resource that does not match exactly is refused, never adopted,
# and an existing identity comment is never overwritten to make an unknown database look valid.
# Negative tests: ops/rebuild/disposable-db.test.sh (a stub docker; no daemon needed).
set -euo pipefail

LINEAGE='rebuild-20261125'
NAME='adulis-rebuild-pg-20261125'
VOLUME='adulis-rebuild-pgdata-20261125'
PORT="${ADULIS_REBUILD_PG_PORT:-55440}"
DB='adulis_rebuild'
USER_='rebuild_bootstrap'
PASS='rebuild-local-only'
IMAGE='pgvector/pgvector:pg17'
DATA_DIR='/var/lib/postgresql/data'
IDENTITY="adulis clean-rebuild disposable target, lineage ${LINEAGE}; never the legacy adulis-postgres"
LEGACY_PORTS=' 5432 5433 5434 '   # 5432: repository default and legacy adulis; 5434: adulis-postgres; 5433: another project
# Markers the replacement can never contain (same set as apps/api/src/db/target-guard.ts): Graphile Worker's
# schema and the retired Reservation table. node-pg-migrate's history is checked separately.
LEGACY_MARKERS="select count(*) from (select 1 from pg_namespace where nspname = 'graphile_worker' union all select 1 where to_regclass('core.reservation') is not null) m"

die() { echo "disposable-db: $*" >&2; exit 2; }
psql_t() { docker exec "$NAME" psql -U "$USER_" -d "$DB" -At -v ON_ERROR_STOP=1 -c "$1"; }
c_fmt() { docker inspect --type container -f "$1" "$NAME" 2>/dev/null || true; }
v_fmt() { docker volume inspect -f "$1" "$VOLUME" 2>/dev/null || true; }
container_exists() { docker inspect --type container "$NAME" >/dev/null 2>&1; }
volume_exists() { docker volume inspect "$VOLUME" >/dev/null 2>&1; }

guard_env() {
  case "${NODE_ENV:-}${ADULIS_ENV:-}" in *production*|*staging*) die "NODE_ENV/ADULIS_ENV names a deployed environment; this helper is local-only" ;; esac
  # The daemon must be this machine's: a remote DOCKER_HOST or context would put the "disposable" target elsewhere.
  local endpoint="${DOCKER_HOST:-$(docker context inspect -f '{{.Endpoints.docker.Host}}' 2>/dev/null || true)}"
  case "$endpoint" in unix://*|npipe://*) ;; *) die "docker endpoint '${endpoint}' is not a local socket/pipe; refusing" ;; esac
}

guard_port() {
  case "$PORT" in ''|*[!0-9]*) die "port '$PORT' is not numeric; refusing" ;; esac
  [ "$PORT" -ge 1024 ] && [ "$PORT" -le 65535 ] || die "port $PORT is outside 1024-65535; refusing"
  case "$LEGACY_PORTS" in *" $PORT "*) die "port $PORT belongs to an existing non-rebuild database; refusing" ;; esac
}

verify_volume() {
  volume_exists || die "volume $VOLUME does not exist"
  [ "$(v_fmt '{{ index .Labels "com.adulis.lineage" }}')" = "$LINEAGE" ] || die "volume $VOLUME lacks the rebuild lineage label; refusing"
  [ "$(v_fmt '{{ index .Labels "com.adulis.disposable" }}')" = 'true' ] || die "volume $VOLUME is not labelled disposable; refusing"
}

verify_container() {
  [ "$NAME" != 'adulis-postgres' ] || die 'refusing to touch the legacy container'
  container_exists || die "container $NAME does not exist; run 'up' first"
  # docker inspect also resolves ID prefixes; the record must be THIS name exactly.
  [ "$(c_fmt '{{.Name}}')" = "/$NAME" ] || die "docker resolved '$NAME' to a different container; refusing"
  [ "$(c_fmt '{{ index .Config.Labels "com.adulis.lineage" }}')" = "$LINEAGE" ] || die "container $NAME lacks the rebuild lineage label; refusing"
  [ "$(c_fmt '{{ index .Config.Labels "com.adulis.disposable" }}')" = 'true' ] || die "container $NAME is not labelled disposable; refusing"
  local mount
  mount="$(c_fmt "{{range .Mounts}}{{if eq .Destination \"$DATA_DIR\"}}{{.Type}} {{.Name}}{{end}}{{end}}")"
  [ "$mount" = "volume $VOLUME" ] || die "container $NAME stores its data in '${mount:-nothing}', not volume $VOLUME; refusing"
  # Configured binding (readable while stopped): exactly one, loopback, on PORT.
  local bindings
  bindings="$(c_fmt '{{range $p, $b := .HostConfig.PortBindings}}{{$p}}={{range $b}}{{.HostIp}}:{{.HostPort}} {{end}}{{end}}')"
  [ "$bindings" = "5432/tcp=127.0.0.1:${PORT} " ] || die "container $NAME binding is '${bindings}', not 5432/tcp=127.0.0.1:${PORT}; refusing"
}

verify_live_binding() {
  local bound
  bound="$(docker port "$NAME" 5432/tcp 2>/dev/null || true)"
  [ "$bound" = "127.0.0.1:${PORT}" ] || die "container $NAME is actually bound to '${bound:-nothing}', not 127.0.0.1:${PORT}; refusing"
}

wait_ready() {
  for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U "$USER_" -d "$DB" >/dev/null 2>&1 && return 0; sleep 1; done
  die 'target did not become ready'
}

verify_database() {
  [ "$(psql_t 'select current_database()')" = "$DB" ] || die "connected database is not $DB; refusing"
  local comment
  comment="$(psql_t "select coalesce(shobj_description(oid,'pg_database'),'') from pg_database where datname=current_database()")"
  [ "$comment" = "$IDENTITY" ] || die "database identity is '${comment:-absent}', not the rebuild identity; refusing (it is never overwritten)"
}

verify_lineage() {
  [ "$(psql_t "select to_regclass('public.pgmigrations') is not null")" = 'f' ] || die 'legacy node-pg-migrate history (public.pgmigrations) present; refusing'
  [ "$(psql_t "$LEGACY_MARKERS")" = '0' ] || die 'a legacy-lineage marker (graphile_worker, core.reservation) is present; refusing'
}

verify_all() { guard_env; guard_port; verify_container; verify_volume; verify_live_binding; verify_database; verify_lineage; }

case "${1:-}" in
  up)
    guard_env; guard_port
    if container_exists; then
      verify_container; verify_volume
      docker start "$NAME" >/dev/null
      wait_ready; verify_live_binding; verify_database; verify_lineage
    else
      created_volume=false
      if volume_exists; then verify_volume; else
        docker volume create --label com.adulis.lineage="$LINEAGE" --label com.adulis.disposable=true "$VOLUME" >/dev/null
        created_volume=true
      fi
      docker run -d --name "$NAME" \
        --label com.adulis.lineage="$LINEAGE" --label com.adulis.disposable=true \
        --memory=256m -p "127.0.0.1:${PORT}:5432" \
        -e POSTGRES_USER="$USER_" -e POSTGRES_PASSWORD="$PASS" -e POSTGRES_DB="$DB" \
        -v "$VOLUME":"$DATA_DIR" "$IMAGE" >/dev/null
      verify_container; wait_ready; verify_live_binding
      if [ "$created_volume" = true ]; then
        # Stamp only what this invocation created, and only while it is provably empty.
        [ "$(psql_t "select coalesce(shobj_description(oid,'pg_database'),'') from pg_database where datname=current_database()")" = '' ] || die 'new database already carries a comment; refusing'
        [ "$(psql_t "select count(*) from pg_namespace where nspname not like 'pg\_%' and nspname not in ('public','information_schema')")" = '0' ] || die 'new database is not empty; refusing'
        psql_t "COMMENT ON DATABASE ${DB} IS '${IDENTITY}'" >/dev/null
      fi
      verify_database; verify_lineage
    fi
    echo "disposable-db: ${NAME} ready on 127.0.0.1:${PORT} (database ${DB})"
    ;;
  verify) verify_all ;;
  fingerprint)
    verify_all
    echo "container:      ${NAME} ($(c_fmt '{{.State.Status}}'))"
    echo "labels:         lineage=${LINEAGE} disposable=true (container and volume)"
    echo "volume:         ${VOLUME} mounted at ${DATA_DIR}"
    echo "host binding:   127.0.0.1:${PORT}"
    echo "server:         $(psql_t 'select version()' | cut -c1-60)"
    echo "database:       ${DB}"
    echo "identity:       ${IDENTITY}"
    echo "user tables:    $(psql_t "select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')")"
    echo "legacy markers: none (no pgmigrations, no legacy schema)"
    ;;
  env)
    verify_all
    echo "DATABASE_URL_BOOTSTRAP=postgres://${USER_}:${PASS}@127.0.0.1:${PORT}/${DB}"
    ;;
  stop) guard_env; guard_port; verify_container; verify_volume; docker stop "$NAME" >/dev/null && echo "disposable-db: stopped (data kept)" ;;
  start) guard_env; guard_port; verify_container; verify_volume; docker start "$NAME" >/dev/null; wait_ready; verify_live_binding; verify_database; echo "disposable-db: started" ;;
  down)
    guard_env; guard_port; verify_container; verify_volume
    docker rm -f "$NAME" >/dev/null && docker volume rm "$VOLUME" >/dev/null && echo 'disposable-db: removed container and volume'
    ;;
  *) sed -n '2,20p' "$0"; exit 2 ;;
esac
