#!/usr/bin/env bash
#
# ADU-REPO-01 §4 — prove the dependency rules actually fire.
#
# `pnpm verify:deps` passing tells you nothing on its own: a config with a typo in
# a path regex, or with preserveSymlinks left true, passes exactly as loudly as a
# correct one. A rule nobody has ever seen fail is a rule nobody knows works.
#
# So this plants each violation in turn, asserts depcruise catches it BY NAME, and
# removes it again. It is the same argument as ADU-AUTH-01 §16.6's second clause —
# two forms that nothing compares are two chances to be wrong, not a check.
#
# [!] THIS SCRIPT MUTATES THE WORKING TREE. It writes a probe file, runs depcruise,
#     and deletes it. Two consequences, both learned the hard way:
#
#     1. DO NOT RUN IT CONCURRENTLY with typecheck, lint or build. A probe that
#        exists for only a few hundred milliseconds is long enough for a parallel
#        `tsc --noEmit` to see it and fail on an import that was never real. That
#        is exactly how this note came to be written - a background review agent
#        ran this fixture while `pnpm ci:local` was type-checking, and the console
#        failed on TS2307 for a module nobody had ever imported.
#     2. The probe name carries the PID and the pattern is gitignored, so a
#        crashed run cannot leave anything committable behind.
#
# Run: pnpm verify:deps-fires
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

PLANTED=()
cleanup() { for f in "${PLANTED[@]:-}"; do rm -f "$f"; done; }
trap cleanup EXIT

pass=0
fail=0

# plant <file> <content> <expected-rule> <description>
plant() {
  local file="$1" content="$2" rule="$3" desc="$4"
  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$content" > "$file"
  PLANTED+=("$file")

  local out
  out="$(pnpm exec depcruise apps packages --config .dependency-cruiser.cjs 2>&1)"
  local code=$?

  rm -f "$file"

  if [ "$code" -ne 0 ] && printf '%s' "$out" | grep -q "$rule"; then
    printf '  PASS  %-46s caught by %s\n' "$desc" "$rule"
    pass=$((pass + 1))
  else
    printf '  FAIL  %-46s NOT caught (expected %s, exit %s)\n' "$desc" "$rule" "$code"
    printf '%s\n' "$out" | sed 's/^/          /' | head -12
    fail=$((fail + 1))
  fi
}

echo
echo "ADU-REPO-01 §4 - do the dependency rules actually fire?"
echo

# --- Rule 2, the one that gets broken helpfully ----------------------------
plant "apps/console/src/__depcruise_probe_$$.ts" \
"import { boot } from '../../api/src/main';
export const x = boot;" \
  "no-app-to-app" \
  "rule 2: console -> api by relative path"

# The type-only form is what a console developer actually reaches for, and it is
# invisible without tsPreCompilationDeps. This probe is why that option is not
# a preference.
plant "apps/console/src/__depcruise_probe_$$.ts" \
"import type { DatabaseModule } from '../../api/src/common/db/database.module';
export type X = DatabaseModule;" \
  "no-app-to-app" \
  "rule 2: TYPE-ONLY console -> api (tsPreCompilationDeps)"

# The package-name spelling. Undeclared, so it resolves to nothing and must be
# caught by not-to-unresolvable rather than slipping through silently.
plant "apps/console/src/__depcruise_probe_$$.ts" \
"import { boot } from '@adulis/api';
export const x = boot;" \
  "not-to-unresolvable" \
  "rule 2: undeclared '@adulis/api' import"

# Reaching into another app's built output, which the dist/ exclusion would
# otherwise hide completely. THE TARGET IS PLANTED TOO: on a fresh clone - and
# in CI, where this step runs before any build - apps/api/dist does not exist,
# the import cannot RESOLVE, and not-to-unresolvable catches it instead of
# no-import-into-dist. The probe then fails asserting the rule NAME while the
# boundary itself holds: a green rule proven by the wrong mechanism. Planting
# a one-line target makes the probe independent of build order everywhere.
# (This is why main went red on 27 Aug 2026: same probe, same missing dist.)
mkdir -p apps/api/dist
printf 'export const boot = 1;
' > "apps/api/dist/__depcruise_probe_target_$$.js"
PLANTED+=("apps/api/dist/__depcruise_probe_target_$$.js")
plant "apps/console/src/__depcruise_probe_$$.ts" \
"import { boot } from '../../api/dist/__depcruise_probe_target_$$.js';
export const x = boot;" \
  "no-import-into-dist" \
  "rule 2: console -> api/dist (the exclusion blind spot)"

# --- Rule 3 ----------------------------------------------------------------
plant "packages/locale/src/__depcruise_probe_$$.ts" \
"import { boot } from '../../../apps/api/src/main';
export const x = boot;" \
  "no-package-to-app" \
  "rule 3: package -> app"

echo
echo "  --- and the clean tree must pass ---"
if pnpm exec depcruise apps packages --config .dependency-cruiser.cjs > /dev/null 2>&1; then
  printf '  PASS  %-46s no violations\n' "clean tree"
  pass=$((pass + 1))
else
  printf '  FAIL  %-46s the real tree already violates a rule\n' "clean tree"
  pnpm exec depcruise apps packages --config .dependency-cruiser.cjs 2>&1 | sed 's/^/          /' | head -20
  fail=$((fail + 1))
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "FAIL  $fail of $((pass + fail)) probes did not behave as specified."
  echo "      A dependency rule that does not fire is worse than no rule: it is a"
  echo "      green build asserting a boundary that is not there."
  echo
  exit 1
fi
echo "PASS  all $pass probes behaved as specified; the rules fire and the tree is clean."
echo
