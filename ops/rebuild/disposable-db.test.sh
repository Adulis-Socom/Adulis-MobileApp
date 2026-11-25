#!/usr/bin/env bash
# ops/rebuild/disposable-db.test.sh -- negative (and one positive) tests for disposable-db.sh (ARC-BE-01).
# A stub `docker` on PATH answers from FAKE_* variables and logs every call, so no daemon, container or
# database is touched. Each refusal case also asserts that nothing mutating (run/rm/COMMENT) was issued.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/disposable-db.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export FAKE_LOG="$TMP/docker.log"

cat >"$TMP/docker" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$FAKE_LOG"
all="$*"
case "$1" in
  context) echo "${FAKE_ENDPOINT}" ;;
  volume)
    case "$2" in
      inspect) [ "${FAKE_V_EXISTS}" = 1 ] || exit 1
        case "$all" in *com.adulis.lineage*) echo "${FAKE_V_LINEAGE}" ;; *com.adulis.disposable*) echo "${FAKE_V_DISPOSABLE}" ;; esac ;;
      *) exit 0 ;;
    esac ;;
  inspect)
    [ "${FAKE_C_EXISTS}" = 1 ] || exit 1
    case "$all" in
      *.Mounts*) echo "${FAKE_MOUNT}" ;;
      *'{{.Name}}'*) echo "${FAKE_C_NAME}" ;;
      *com.adulis.lineage*) echo "${FAKE_C_LINEAGE}" ;;
      *com.adulis.disposable*) echo "${FAKE_C_DISPOSABLE}" ;;
      *PortBindings*) printf '%s' "${FAKE_BINDINGS}" ;;
      *.State.Status*) echo running ;;
    esac ;;
  port) echo "${FAKE_LIVE}" ;;
  exec)
    case "$all" in
      *pg_isready*) exit 0 ;;
      *'select current_database()'*) echo "${FAKE_DB}" ;;
      *shobj_description*) echo "${FAKE_COMMENT}" ;;
      *pgmigrations*) echo "${FAKE_PGMIGRATIONS}" ;;
      *graphile_worker*) echo "${FAKE_LEGACY_SCHEMAS}" ;;
      *"nspname not like"*) echo "${FAKE_USER_SCHEMAS}" ;;
      *version*) echo 'PostgreSQL 17.11' ;;
      *pg_tables*) echo 0 ;;
      *) exit 0 ;;
    esac ;;
  *) exit 0 ;;
esac
STUB
chmod +x "$TMP/docker"
export PATH="$TMP:$PATH"

IDENT='adulis clean-rebuild disposable target, lineage rebuild-20261125; never the legacy adulis-postgres'
reset() {
  unset ADULIS_REBUILD_PG_PORT NODE_ENV ADULIS_ENV DOCKER_HOST
  export FAKE_ENDPOINT='npipe:////./pipe/docker_engine'
  export FAKE_C_EXISTS=1 FAKE_C_NAME='/adulis-rebuild-pg-20261125' FAKE_C_LINEAGE='rebuild-20261125' FAKE_C_DISPOSABLE='true'
  export FAKE_MOUNT='volume adulis-rebuild-pgdata-20261125' FAKE_BINDINGS='5432/tcp=127.0.0.1:55440 ' FAKE_LIVE='127.0.0.1:55440'
  export FAKE_V_EXISTS=1 FAKE_V_LINEAGE='rebuild-20261125' FAKE_V_DISPOSABLE='true'
  export FAKE_DB='adulis_rebuild' FAKE_COMMENT="$IDENT" FAKE_PGMIGRATIONS='f' FAKE_LEGACY_SCHEMAS='0' FAKE_USER_SCHEMAS='0'
  : >"$FAKE_LOG"
}

pass=0; failn=0
# expect <name> <expected-exit> <stderr-substring> <command...>
expect() {
  local name="$1" code="$2" needle="$3"; shift 3
  local out rc
  out="$(bash "$SCRIPT" "$@" 2>&1)"; rc=$?
  local mutated=''
  grep -Eq '^(run|rm|volume (create|rm)|exec .*COMMENT ON)' "$FAKE_LOG" && mutated=yes
  if [ "$rc" = "$code" ] && [[ "$out" == *"$needle"* ]] && { [ "$code" = 0 ] || [ -z "$mutated" ]; }; then
    pass=$((pass+1)); echo "  PASS  $name"
  else
    failn=$((failn+1)); echo "  FAIL  $name (rc=$rc, mutated=${mutated:-no}): $out"
  fi
}

echo 'disposable-db.sh negative tests'
reset; expect 'happy path: verify passes on the exact target' 0 '' verify
reset; export ADULIS_REBUILD_PG_PORT=abc; expect 'non-numeric port' 2 'not numeric' verify
reset; export ADULIS_REBUILD_PG_PORT=80; expect 'port below 1024' 2 'outside 1024-65535' verify
reset; export ADULIS_REBUILD_PG_PORT=70000; expect 'port above 65535' 2 'outside 1024-65535' verify
reset; export ADULIS_REBUILD_PG_PORT=5434; expect 'legacy adulis-postgres port' 2 'non-rebuild database' up
reset; export NODE_ENV=production; expect 'production environment' 2 'deployed environment' up
reset; export ADULIS_ENV=staging; expect 'staging environment' 2 'deployed environment' verify
reset; export DOCKER_HOST='tcp://10.0.0.5:2375'; expect 'remote docker daemon' 2 'not a local socket' up
reset; export FAKE_C_NAME='/adulis-postgres'; expect 'name resolves to another container' 2 'different container' up
reset; export FAKE_C_LINEAGE=''; expect 'container without lineage label' 2 'lacks the rebuild lineage label' up
reset; export FAKE_C_DISPOSABLE='false'; expect 'container not disposable' 2 'not labelled disposable' down
reset; export FAKE_MOUNT='volume adulis-pgdata'; expect 'container mounts the legacy volume' 2 'not volume adulis-rebuild-pgdata' down
reset; export FAKE_MOUNT=''; expect 'container has no data volume' 2 "stores its data in 'nothing'" verify
reset; export FAKE_V_LINEAGE=''; expect 'volume without lineage label' 2 'volume adulis-rebuild-pgdata-20261125 lacks' down
reset; export FAKE_V_DISPOSABLE=''; expect 'volume not disposable' 2 'is not labelled disposable' down
reset; export FAKE_C_EXISTS=0 FAKE_V_LINEAGE='other'; expect 'orphan volume of another lineage is not adopted' 2 'lacks the rebuild lineage label' up
reset; export FAKE_BINDINGS='5432/tcp=0.0.0.0:55440 '; expect 'configured binding on all interfaces' 2 'binding is' verify
reset; export FAKE_BINDINGS='5432/tcp=127.0.0.1:55441 '; expect 'configured binding on another port' 2 'binding is' verify
reset; export FAKE_BINDINGS='5432/tcp=127.0.0.1:55440 127.0.0.1:55442 '; expect 'two configured bindings' 2 'binding is' verify
reset; export FAKE_LIVE='0.0.0.0:55440'; expect 'live binding on all interfaces' 2 'actually bound' env
reset; export FAKE_DB='adulis'; expect 'wrong database name' 2 'is not adulis_rebuild' verify
reset; export FAKE_COMMENT=''; expect 'existing database without identity is not stamped' 2 'identity is' up
reset; export FAKE_COMMENT='something else'; expect 'foreign identity is not overwritten' 2 'never overwritten' up
reset; export FAKE_PGMIGRATIONS='t'; expect 'legacy pgmigrations present' 2 'public.pgmigrations' verify
reset; export FAKE_LEGACY_SCHEMAS='1'; expect 'legacy schema present' 2 'legacy-lineage marker' up
echo "disposable-db.sh: ${pass} passed, ${failn} failed"
[ "$failn" = 0 ]
