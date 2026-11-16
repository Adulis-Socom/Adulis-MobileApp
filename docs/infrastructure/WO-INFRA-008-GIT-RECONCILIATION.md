# WO-INFRA-008 -- Git branch reconciliation

13 November 2026. All findings come from `git merge-base`, `git log`, `git merge-tree` and
`git apply --check`. They are dry runs: no branch was merged, reset, force-pushed or rewritten.

**Evidence:** `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\logs\merge-tree-*.log` and
`work-checkout-overlap.log`.

## Ancestry

```
main 01302cf (2026-09-07)
 |-- ci/scope-filter-main-push 810fb27            (+1: ci.yml, scope filter empty on a push to main)
 |-- mobile/wo-022-messaging-reliability-hardening 3cad2e3   (+253 commits)
 |    `-- infra/wo-infra-001-006-stabilization bfa24bf       (+6 infrastructure commits)
 |         `-- infra/wo-infra-007-009-finalization            (+ this batch)
 `-- infra/main-integration-candidate                         (+6 infrastructure, +1 test-only, + this batch's infrastructure)
```

Verified relationships:
- `main` is an ancestor of WO-022 and of `810fb27`.
- WO-022 is an ancestor of the first infrastructure branch.
- The merge base of `main` and WO-022 is `01302cf`.

## What WO-022 adds to `main` (why it is more than infrastructure)

There are 253 non-merge commits:
- `apps/mobile`: 204 files;
- `apps/api`: 91 files;
- `docs`: 166 files;
- `packages/locale`: 14;
- `packages/api-client`: 7;
- `apps/console`: 3;
- `contracts/openapi.json`;
- `pnpm-lock.yaml`;
- `.env.example`;
- `CLAUDE.md`;
- **ten migrations**, `0053_session_token_hash` to `0062_catalogue_category_taxonomy`.

## The six infrastructure commits, against `main`

| Commit | Applies to `main` | Note |
|---|---|---|
| `ba74372` compose volumes | clean | |
| `3b9bbc6` MinIO image and init | clean | |
| `bbbadac` seed environment, scope fail-safe | clean | `gates.mjs` and `ci.yml` are identical on `main` and WO-022 |
| `1a8c6f7` API listen-first | **4 modify/delete conflicts** | Only `t8-device-bootstrap` exists on `main`. `cat-001`, `disc-002`, `wo-009-collections` and `wo-sec-001` came with the mobile line, so on `main` the fix is one file. Resolved by keeping them absent, as on `main` |
| `bac327a` review fixes | clean | |
| `bfa24bf` reports, compose comment | clean | |

**The candidate's code** (`ci.yml`, `docker-compose.yml`, `gates.mjs`, `gates.test.mjs`,
`minio-init.sh`, `t8-device-bootstrap`) is **byte-identical** to the CI-verified first branch's
(`git diff` empty).

**One non-infrastructure commit was added:** `810b598`, a test-only fix by the founder from the mobile
line. `c1-onboarding` hard-codes 2026-09-11 as a future date, so it fails on `main` since that date
passed (ISSUE-INFRA-FOLLOWUP-006). The candidate without it was red on exactly that one test (run
43384239326: 634 of 635 API tests, everything else passing). That run is kept as evidence.

## Overlaps and conflicts

| Pair | Result |
|---|---|
| Candidate x `810fb27` | **Merges clean.** Semantics agree: on a push to `main`, `810fb27` empties the filter, and the candidate's `gates.mjs` already runs everything when the filter selects nothing. Merging both is redundant, not contradictory |
| First infrastructure branch x `810fb27` | Merges clean |
| Candidate x WO-022 | Merges clean, **but** the merged tree would have the four mobile-line suites **without** the listen-first fix, so the CI flake of WO-INFRA-005 (F-5) returns |
| Candidate x first infrastructure branch | Merges clean |
| Candidate (before this batch's commits) x finalization branch | Conflicts in `gates.mjs` and the runbook (both "added" them relative to `main`). **Closed** by carrying this batch's infrastructure commits onto the candidate too; re-checked in `WO-INFRA-008-INTEGRATION-TESTS.md` |
| Work checkout's uncommitted edits x candidate | `ci.yml` (comments) and `.dependency-cruiser.cjs` apply cleanly. **`gates.mjs` does not:** both append a gate at the end of the list (`mobile-gates` against `gate-runner` and `minio-migrate`). Resolution: keep both, in either order (the list is append-only and cited by name) |

## The other checkout

`C:\Users\naods\Documents\Work\adulis-platform`, read with `git --no-optional-locks` only (no index
refresh, no writes):

| | |
|---|---|
| Branch | `ci/scope-filter-main-push`, in step with `origin/ci/scope-filter-main-push` (`810fb27`) |
| Staged | 1: `apps/mobile/.claude/settings.json` renamed to `.claude/settings.json` (also modified) |
| Unstaged | 17 modified: `ci.yml`, `gates.mjs`, `.dependency-cruiser.cjs`, `pnpm-lock.yaml` (+6,361 lines), `package.json`, `CLAUDE.md`, `apps/mobile/CLAUDE.md`, `apps/mobile/package.json`, `packages/tokens/*`, `packages/config/eslint.config.js`, two `ops/scripts` verifiers, `DEFECT-REGISTER.md`, `DOCUMENT_AUTHORITY.md` and `.gitignore` |
| Untracked | 22 paths: an earlier Expo foundation (MOB-WO-0) under `apps/mobile/`, `packages/tokens/src/native/`, `docs/adu/` and reports |
| Exists only locally | All of it. None of it is in any pushed branch |
| Owns the running Docker stack | **Yes**: the compose labels of `adulis-postgres` and `adulis-minio` name this checkout |

**What this means:**
- That work is a **different mobile foundation** from the one on the WO-022 line, and the two overlap
  heavily (`apps/mobile`, `packages/tokens`, `pnpm-lock.yaml`).
- Reconciling them is a product and engineering decision, not an infrastructure one; it is out of this
  batch's scope.
- **Nothing was reset, stashed, committed or changed there.**

## Commits included in, and excluded from, the candidate

- **Included:**
  - the 6 infrastructure commits (with `1a8c6f7` reduced to `t8`);
  - `810b598` (test-only);
  - this batch's infrastructure commits.
- **Excluded:**
  - all 253 WO-001 to WO-022 commits (apart from `810b598`);
  - `810fb27`, which is unnecessary with the scope fail-safe, merges clean, and stays the founder's
    choice;
  - everything in the Work checkout.
