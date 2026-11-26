#!/usr/bin/env bash
#
# Prove the dependency rules actually fire for the Console (ADU-REPO-01 S4), run from anywhere, acts at the repo root.
#
# `depcruise apps/console packages` passing says nothing on its own: a rule nobody has seen fail is a rule nobody
# knows works. This plants each violation, asserts depcruise names it, and removes it again.
#
# [!] MUTATES THE WORKING TREE for a few hundred milliseconds. Do not run it concurrently with typecheck, lint or
#     build. The probe name carries the PID and the pattern is gitignored, so a crashed run leaves nothing committable.
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1

PLANTED=()
cleanup() { for f in "${PLANTED[@]:-}"; do [ -n "$f" ] && rm -f "$f"; done; }
trap cleanup EXIT

pass=0
fail=0

# plant <file> <content> <expected-rule-regex> <description>
plant() {
  local file="$1" content="$2" rule="$3" desc="$4"
  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$content" > "$file"
  PLANTED+=("$file")
  local out code
  out="$(pnpm exec depcruise apps/console packages --config .dependency-cruiser.cjs 2>&1)"
  code=$?
  rm -f "$file"
  if [ "$code" -ne 0 ] && printf '%s' "$out" | grep -Eq "$rule"; then
    printf '  PASS  %-52s caught by %s\n' "$desc" "$rule"
    pass=$((pass + 1))
  else
    printf '  FAIL  %-52s NOT caught (expected %s, exit %s)\n' "$desc" "$rule" "$code"
    printf '%s\n' "$out" | sed 's/^/          /' | head -12
    fail=$((fail + 1))
  fi
}

echo
echo "Do the dependency rules fire for apps/console?"
# Whether the target file exists or not, one of the two rules must name it: that is the point of not-to-unresolvable.
plant "apps/console/src/__depcruise_probe_$$.ts" "import '../../api/src/main';" 'no-app-to-app|not-to-unresolvable' 'console -> another app'
plant "apps/console/src/__depcruise_probe_$$_type.ts" "import type { X } from '../../api/src/main';
export type Y = X;" 'no-app-to-app|not-to-unresolvable' 'console -> another app (type-only import)'
plant "packages/locale/src/__depcruise_probe_$$.ts" "import '../../../apps/console/src/main';" 'no-package-to-app' 'package -> console'
plant "apps/console/src/__depcruise_probe_$$_dist.ts" "import '../../../packages/locale/dist/index.js';" 'no-import-into-dist|not-to-unresolvable' 'console -> workspace package dist'

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
