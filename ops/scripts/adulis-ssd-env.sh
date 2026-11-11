#!/usr/bin/env bash
# Adulis development storage on the external SSD (WO-010; docs/engineering/WO-010-SSD-ENVIRONMENT.md).
#
#   source ops/scripts/adulis-ssd-env.sh WO-010      # sets up and exports; returns non-zero if unusable
#   adulis_ssd_ok || exit 1                          # re-check before each disk-intensive step
#
# Process-scoped only: it exports TEMP, TMP and TMPDIR for this shell and its children (node's
# os.tmpdir(); Java's java.io.tmpdir, so Maestro's driver APKs), the shared cache locations
# (ADULIS_JEST_CACHE, ADULIS_METRO_CACHE, NODE_COMPILE_CACHE under <root>\shared-cache) and
# ADULIS_SCRATCH / ADULIS_MAESTRO / ADULIS_LOGS for scripts. Nothing system-wide changes, so WSL,
# Docker, Gradle and Android Studio keep their own settings. If the SSD is missing, is not the
# expected volume or cannot be written, it says so and returns non-zero: it never falls back to C:.
#
# Overridable: ADULIS_SSD_ROOT (default G:/AdulisDevelopment), ADULIS_SSD_LABEL (default
# "Extreme SSD"; empty skips the check).

adulis_ssd_ok() {
  local root="${ADULIS_SSD_ROOT:-G:/AdulisDevelopment}"
  local drive="${root%%:*}"
  local label="${ADULIS_SSD_LABEL-Extreme SSD}"
  if [ -n "$label" ]; then
    local actual
    actual=$(powershell -NoProfile -Command "(Get-Volume -DriveLetter $drive -ErrorAction SilentlyContinue).FileSystemLabel" 2>/dev/null | tr -d '\r')
    if [ "$actual" != "$label" ]; then
      echo "adulis-ssd: drive $drive: is not the volume \"$label\" (found \"$actual\"); stopping, nothing falls back to C:" >&2
      return 1
    fi
  fi
  # A write probe: the drive may take a long time to wake from idle (74 s measured in WO-010).
  local probe="$root/.write-probe-$$"
  if ! ( mkdir -p "$root" && printf 'ok' > "$probe" && [ "$(cat "$probe")" = ok ] && rm -f "$probe" ) 2>/dev/null; then
    echo "adulis-ssd: $root is not writable; stopping, nothing falls back to C:" >&2
    return 1
  fi
  return 0
}

adulis_ssd_env() {
  local wo="${1:?work order, e.g. WO-010}"
  # A plain work-order name only: "x/../shared-cache" would put evidence among rebuildable caches.
  [[ $wo =~ ^WO-[A-Za-z0-9-]+$ ]] || { echo "adulis-ssd: \"$wo\" is not a work-order name (WO-...)" >&2; return 1; }
  local root="${ADULIS_SSD_ROOT:-G:/AdulisDevelopment}"
  adulis_ssd_ok || return 1
  local base="$root/$wo"
  mkdir -p "$base/temp" "$base/scratch" "$base/maestro" "$base/logs" "$base/build" || return 1
  # WO-010A: caches shared across work orders (rebuildable; each tool keys its entries by content
  # and tool/config versions): Jest (apps/mobile/jest.config.js reads ADULIS_JEST_CACHE), Metro
  # (apps/mobile/metro.config.js reads ADULIS_METRO_CACHE), Node's compile cache (NODE_COMPILE_CACHE,
  # Node's own variable). Disposable outputs (TEMP: test temp files, Maestro driver APKs, the
  # emulator's temp) stay in the work order's folder.
  local shared="$root/shared-cache"
  mkdir -p "$shared/jest" "$shared/metro" "$shared/node" || return 1
  # Windows-style paths: node and Java read these, not MSYS paths.
  local win swin
  win=$(cygpath -w "$base" 2>/dev/null || echo "$base")
  swin=$(cygpath -w "$shared" 2>/dev/null || echo "$shared")
  export TEMP="$win\\temp" TMP="$win\\temp" TMPDIR="$win\\temp"
  export ADULIS_JEST_CACHE="$swin\\jest" ADULIS_METRO_CACHE="$swin\\metro" NODE_COMPILE_CACHE="$swin\\node"
  export ADULIS_WO_DIR="$win" ADULIS_SCRATCH="$base/scratch" ADULIS_MAESTRO="$base/maestro" ADULIS_LOGS="$base/logs"
  echo "adulis-ssd: $wo temporary files under $win; shared caches under $swin (this shell only)"
}

if [ "${BASH_SOURCE[0]}" != "$0" ] && [ -n "${1:-}" ]; then
  adulis_ssd_env "$1"
fi
