#!/bin/sh
# MinIO data-volume guard (WO-INFRA-015A). Runs before MinIO starts, twice:
#   - as the one-shot service `minio-volume-guard` (as root, so it can read the old volume), which
#     the minio service depends on: a refusal leaves MinIO created but not started, and
#     `docker compose up` fails;
#   - inside the minio service itself, ahead of `minio server`, so `--no-deps` or `compose run`
#     cannot skip it. There it runs as the image's non-root user and fails closed when it cannot read.
# It cannot keep a running MinIO serving: compose replaces a container BEFORE it checks dependencies
# (rehearsed). That is the job of the required ADULIS_MINIO_VOLUME in docker-compose.yml; this guard
# is the second line, for when that variable is set too early: MinIO then never serves an empty store.
#
# REFUSES when the data volume holds no MinIO data while the legacy volume (`adulis-pgdata`, mounted
# read-only at $MINIO_GUARD_LEGACY_DIR) does, or cannot be read: that is an installation whose
# objects were never moved, and starting there would serve an empty store while the objects sit in
# the old volume. The move is ops/scripts/minio-migrate.mjs (docs/infrastructure/MINIO-STARTUP.md).
# A data volume that already holds MinIO data is always accepted: that is a migrated or a fresh
# installation that has started once. With arguments, runs them (exec) when it accepts.
set -eu

data=${MINIO_GUARD_DATA_DIR:-}
legacy=${MINIO_GUARD_LEGACY_DIR:-/adulis-guard/legacy}

refuse() {
  echo "minio-volume-guard: REFUSED: $1" >&2
  echo "  Nothing was started. See docs/infrastructure/MINIO-STARTUP.md." >&2
  exit 1
}

[ -n "$data" ] || refuse "MINIO_GUARD_DATA_DIR is not set"
[ -d "$data" ] || refuse "the data volume is not mounted at $data"
# ADULIS_MINIO_VOLUME=adulis-pgdata would mount the legacy volume as the data volume: the new image
# would then write into the old PostgreSQL directory, which the move exists to stop.
if [ -d "$legacy" ] && [ "$data" -ef "$legacy" ]; then
  refuse "the data volume is the legacy volume adulis-pgdata itself: set ADULIS_MINIO_VOLUME to the new volume"
fi

# MinIO DATA means a formatted drive: .minio.sys/format.json, written when MinIO first formats it.
# NOT .minio.sys alone: the MinIO image ships an empty .minio.sys skeleton in /data, and Docker copies
# it into every new volume on first mount, so that directory exists on a volume that holds nothing
# (found by the WO-INFRA-015A rehearsal, where the first version of this check accepted it).
if [ -f "$data/.minio.sys/format.json" ]; then
  echo "minio-volume-guard: ok: the data volume already holds MinIO data"
else
  # An empty data volume: a fresh installation, or one whose objects are still in adulis-pgdata.
  [ -d "$legacy" ] || refuse "the legacy volume is not mounted at $legacy, so an empty data volume cannot be judged"
  ls -a "$legacy" > /dev/null 2>&1 ||
    refuse "the data volume is empty and the legacy volume cannot be read here (it is the old PostgreSQL directory): it may hold MinIO data"
  # Unreadable .minio.sys counts as data: the check must be able to say "nothing there".
  if [ -e "$legacy/.minio.sys" ] && { [ -f "$legacy/.minio.sys/format.json" ] || ! ls "$legacy/.minio.sys" > /dev/null 2>&1; }; then
    refuse "the legacy volume adulis-pgdata holds MinIO data and the data volume is empty: move the objects first (minio-migrate.mjs)"
  fi
  echo "minio-volume-guard: ok: fresh installation (no MinIO data anywhere)"
fi

if [ "$#" -gt 0 ]; then exec "$@"; fi
