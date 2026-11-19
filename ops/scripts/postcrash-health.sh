#!/usr/bin/env bash
# INF-CLOSE-01: fail-closed health verdict for the local development stack after a crash. READ-ONLY.
#
#   bash ops/scripts/postcrash-health.sh --since <UTC time before the crash> [--out <dir>]
#
# Every check prints PASS, FAIL or UNKNOWN. Exit 0 = every mandatory check PASSED; 1 = a check FAILED;
# 2 = no failure, but a mandatory check is UNKNOWN; 3 = Docker is not running (this script never starts it).
#
# It only reads: docker inspect / ps / volume ls / logs, `docker exec` of pg_isready, psql (session forced
# read-only with default_transaction_read_only=on) and ls inside the RUNNING containers, and an HTTP GET to
# MinIO's health endpoint. It creates no container, volume, network or image, pulls nothing, starts or stops
# nothing, and writes only to --out.
#
# Optional expectations (exact match, else that identity check is UNKNOWN):
#   EXPECT_PG_ID, EXPECT_PG_IMAGE, EXPECT_MINIO_ID, EXPECT_MINIO_IMAGE   (full IDs, as docker inspect prints)
set -uo pipefail
export MSYS_NO_PATHCONV=1
SINCE=''; OUT=''
while [ $# -gt 0 ]; do
  case $1 in
    --since) SINCE=${2:-}; shift 2 ;;
    --out) OUT=${2:-}; shift 2 ;;
    *) echo "usage: bash ops/scripts/postcrash-health.sh --since <UTC time> [--out <dir>]" >&2; exit 64 ;;
  esac
done
[ -n "$SINCE" ] || { echo "usage: --since <UTC time before the crash> is required" >&2; exit 64; }
[ -n "$OUT" ] && mkdir -p "$OUT"
PG=adulis-postgres; MINIO=adulis-minio
PG_VOLUME=adulis-platform_adulis-pgdata; PG_PORT=5434
MINIO_VOLUME=${ADULIS_MINIO_VOLUME:-adulis-pgdata}; MINIO_PORT=${MINIO_HOST_PORT:-9100}
TARGET_VOLUME=adulis-platform_adulis-miniodata
here=$(cd "$(dirname "$0")" && { pwd -W 2>/dev/null || pwd; })  # a Windows path for node under Git Bash
fails=0; unknowns=0
say() { printf '%-8s %s\n' "$1" "$2"; case $1 in FAIL) fails=$((fails + 1)) ;; UNKNOWN) [ "${3:-mandatory}" = mandatory ] && unknowns=$((unknowns + 1)) ;; esac; }
match() { # $1 label, $2 actual, $3 expected (may be empty)
  if [ -z "$3" ]; then say UNKNOWN "$1 = $2 (no expectation given)"; elif [ "$2" = "$3" ]; then say PASS "$1 = $2"; else say FAIL "$1 = $2, expected $3"; fi; }

if ! timeout 20 docker version --format '{{.Server.Version}}' > /dev/null 2>&1; then
  echo "UNKNOWN  Docker is not running: nothing inspected (this script never starts it)"; exit 3
fi
say PASS "Docker engine $(docker version --format '{{.Server.Version}}') (context $(docker context show))"

# --- PostgreSQL ---------------------------------------------------------------------------------------
if ! docker inspect "$PG" > /dev/null 2>&1; then say FAIL "$PG does not exist"
else
  f=$(docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Status}}|{{.State.Running}}|{{.State.Restarting}}|{{.RestartCount}}|{{.State.StartedAt}}|{{with index .State "Health"}}{{index . "Status"}}{{end}}' "$PG")
  IFS='|' read -r id image status running restarting restarts started health <<< "$f"
  match "$PG id" "$id" "${EXPECT_PG_ID:-}"
  match "$PG image" "$image" "${EXPECT_PG_IMAGE:-}"
  [ "$running" = true ] && [ "$restarting" = false ] && say PASS "$PG running since $started, restarts $restarts, health ${health:-none}" || say FAIL "$PG status=$status restarting=$restarting"
  [ "$restarts" -le 1 ] 2>/dev/null && say PASS "$PG restart count $restarts" || say FAIL "$PG restart count $restarts (restart loop?)"
  mnt=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}:{{.Name}}{{end}}{{end}}' "$PG")
  [ "$mnt" = "volume:$PG_VOLUME" ] && say PASS "$PG data directory on volume $PG_VOLUME" || say FAIL "$PG data directory mount is '$mnt', expected volume:$PG_VOLUME"
  port=$(docker inspect --format '{{range $p, $b := .NetworkSettings.Ports}}{{if eq $p "5432/tcp"}}{{range $b}}{{.HostPort}} {{end}}{{end}}{{end}}' "$PG")
  case " $port " in *" $PG_PORT "*) say PASS "$PG published on host port $PG_PORT" ;; *) say FAIL "$PG host port '$port', expected $PG_PORT" ;; esac
  # The COMPLETE log since the given time, kept whole; the verdict reads all of it.
  log=$(docker logs --since "$SINCE" "$PG" 2>&1)
  [ -n "$OUT" ] && printf '%s\n' "$log" > "$OUT/$PG.log"
  verdict_json=$(printf '%s\n' "$log" | node "$here/pg-recovery-verdict.mjs"); vrc=$?
  [ -n "$OUT" ] && printf '%s\n' "$verdict_json" > "$OUT/$PG-verdict.json"
  verdict=$(printf '%s' "$verdict_json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.verdict+' (starts '+j.starts+', unclean '+j.uncleanDetected+', redo '+j.redoStarted+'/'+j.redoDone+', ready '+j.ready+', client FATAL '+j.clientFatals+(j.problems.length?'; '+j.problems.join('; '):'')+')')})")
  case $vrc in 0) say PASS "$PG startup log since $SINCE: $verdict" ;; 1) say FAIL "$PG startup log since $SINCE: $verdict" ;; *) say UNKNOWN "$PG startup log since $SINCE: $verdict" ;; esac
  if docker exec "$PG" pg_isready -q -U adulis_bootstrap -d adulis; then say PASS "$PG pg_isready"; else say FAIL "$PG pg_isready"; fi
  q=$(docker exec -e PGOPTIONS='-c default_transaction_read_only=on' "$PG" psql -U adulis_bootstrap -d adulis -XAtF'|' -c "SELECT current_setting('server_version'), (SELECT system_identifier FROM pg_control_system()), current_setting('data_directory'), pg_is_in_recovery(), current_setting('transaction_read_only'), (SELECT string_agg(datname, ',' ORDER BY datname) FROM pg_database WHERE NOT datistemplate), (SELECT string_agg(extname, ',' ORDER BY extname) FROM pg_extension)" 2>&1); qrc=$?
  if [ $qrc -ne 0 ]; then say FAIL "$PG read-only query failed: $(printf '%s' "$q" | head -1)"
  else
    IFS='|' read -r ver sysid datadir inrec ro dbs exts <<< "$q"
    [ -n "$OUT" ] && printf 'version=%s system_identifier=%s data_directory=%s in_recovery=%s read_only=%s databases=%s extensions=%s\n' "$ver" "$sysid" "$datadir" "$inrec" "$ro" "$dbs" "$exts" > "$OUT/$PG-cluster.txt"
    [ "$ro" = on ] && [ "$inrec" = f ] && say PASS "$PG read-only query: PostgreSQL $ver, cluster $sysid, not in recovery, session read-only" || say FAIL "$PG in_recovery=$inrec read_only=$ro"
    case "${ver%%.*}" in 17) say PASS "$PG major version 17" ;; *) say FAIL "$PG major version ${ver%%.*}, expected 17" ;; esac
    case ",$dbs," in *,adulis,*adulis_gates,*|*,adulis_gates,*adulis,*) say PASS "$PG databases include adulis and adulis_gates ($dbs)" ;; *) say FAIL "$PG databases: $dbs" ;; esac
    for e in vector btree_gist pg_trgm pgcrypto; do case ",$exts," in *",$e,"*) ;; *) say FAIL "$PG extension $e missing in adulis" ;; esac; done
    say PASS "$PG extensions: $exts"
    mig=$(docker exec -e PGOPTIONS='-c default_transaction_read_only=on' "$PG" psql -U adulis_bootstrap -d adulis -XAt -c "SELECT count(*) || ' applied, last ' || max(name) FROM pgmigrations" 2>&1) && say PASS "$PG migrations: $mig" || say UNKNOWN "$PG migrations: $(printf '%s' "$mig" | head -1)"
  fi
fi

# --- MinIO --------------------------------------------------------------------------------------------
if ! docker inspect "$MINIO" > /dev/null 2>&1; then say FAIL "$MINIO does not exist"
else
  f=$(docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Running}}|{{.RestartCount}}|{{.State.StartedAt}}|{{with index .State "Health"}}{{index . "Status"}}{{end}}' "$MINIO")
  IFS='|' read -r id image running restarts started health <<< "$f"
  match "$MINIO id" "$id" "${EXPECT_MINIO_ID:-}"
  match "$MINIO image" "$image" "${EXPECT_MINIO_IMAGE:-}"
  [ "$running" = true ] && say PASS "$MINIO running since $started, restarts $restarts, health ${health:-none}" || say FAIL "$MINIO not running"
  mnt=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Type}}:{{.Name}}{{end}}{{end}}' "$MINIO")
  [ "$mnt" = "volume:$MINIO_VOLUME" ] && say PASS "$MINIO data on volume $MINIO_VOLUME" || say FAIL "$MINIO data mount '$mnt', expected volume:$MINIO_VOLUME"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$MINIO_PORT/minio/health/live")
  [ "$code" = 200 ] && say PASS "$MINIO liveness on $MINIO_PORT: 200" || say FAIL "$MINIO liveness on $MINIO_PORT: $code"
  rec=$(docker exec "$MINIO" sh -c 'for f in /data/.adulis-migration*; do [ -e "$f" ] && echo "$f"; done; true' 2>&1); rrc=$?
  if [ $rrc -ne 0 ]; then say UNKNOWN "move records on $MINIO_VOLUME: could not list ($rec)"
  elif [ -n "$rec" ]; then say FAIL "move record(s) present on $MINIO_VOLUME: $rec"
  else say PASS "no .adulis-migration* record on $MINIO_VOLUME"; fi
fi
[ -z "$(docker volume ls -q --filter "name=^${TARGET_VOLUME}$")" ] && say PASS "migration target volume $TARGET_VOLUME absent" || say FAIL "migration target volume $TARGET_VOLUME exists"

# --- Leftovers (reported; never removed here) -----------------------------------------------------------
left=$(docker ps -a --filter label=adulis.test-db.owner --format '{{.Names}}({{.Label "adulis.test-db.owner"}})'; docker ps -a --filter label=adulis.inf04.owner --format '{{.Names}}'; docker ps -a --format '{{.Names}}' | grep -E '^(inf04|minio-migrate)'; docker volume ls -q | grep -E '^(inf04|minio-migrate)'; docker network ls --format '{{.Name}}' | grep -E '^inf04'; docker ps -a --filter label=adulis.native-harness.owner --format '{{.Names}}'; docker volume ls -q --filter label=adulis.native-harness.owner; docker network ls --filter label=adulis.native-harness.owner --format '{{.Name}}')
[ -z "$left" ] && say PASS "no disposable or rehearsal leftovers" || say UNKNOWN "leftovers to identify before any removal: $(printf '%s' "$left" | tr '\n' ' ')" advisory

echo "SUMMARY  $fails failed, $unknowns mandatory unknown"
[ $fails -gt 0 ] && exit 1
[ $unknowns -gt 0 ] && exit 2
exit 0
