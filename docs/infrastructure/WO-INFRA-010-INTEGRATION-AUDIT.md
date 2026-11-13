# WO-INFRA-010 -- Integration audit (and the work-order report)

**Status of the work order: PARTIALLY COMPLETE.** The candidate is verified and a draft pull request is
open. **The merge is BLOCKED:** no founder approval to merge. 13 November 2026.

## 1. Work order
WO-INFRA-010, infrastructure integration and `main` branch readiness (P0).

## 2. Initial state
Re-verified at 11:15Z with `git fetch --all --prune`. Nothing moved since the previous batch:

| Branch | Head | Merge base with `main` |
|---|---|---|
| `main` | `01302cf` (2026-09-07) | -- |
| `ci/scope-filter-main-push` | `810fb27` | `01302cf` |
| `mobile/wo-022-messaging-reliability-hardening` | `3cad2e3` | `01302cf` |
| `infra/wo-infra-001-006-stabilization` | `bfa24bf` | `01302cf` |
| `infra/wo-infra-007-009-finalization` | `149924c` | `01302cf` |
| `infra/main-integration-candidate` | `e37d28d` (12 commits on `main`) | `01302cf` |

**Pull requests:** the only open one was #75 (Tier 13, unrelated). The Work checkout is still on `810fb27`,
with the same 40 entries.

## 3. Candidate review (task 2)

**What it changes:** `git diff --name-only origin/main origin/infra/main-integration-candidate`, docs
excluded. Nine code files:

| File | Change | Business behaviour |
|---|---|---|
| `.github/workflows/ci.yml` | Pullable MinIO image and shared init; health wait with a timeout; Node 24 action majors | none |
| `docker-compose.yml` | Pinned project name; explicit, separate volumes; pinned MinIO digest | none (local only) |
| `ops/scripts/gates.mjs` | Seed environment default; scope fail-safe; `--only` refuses unknown ids; gates `gate-runner` and `minio-migrate` appended | none |
| `ops/scripts/gates.test.mjs` | 13 tests of the runner's rules | none |
| `ops/scripts/minio-init.sh` | One fail-loud bucket init; evidence private, media single-object read | local and CI storage only |
| `ops/scripts/minio-migrate.mjs`, `.test.mjs` | The fail-closed MinIO move (not run on live data) and 11 tests | none |
| `apps/api/test/t8-device-bootstrap.e2e.spec.ts` | `await app.listen(0, '127.0.0.1')` before concurrent requests | test only |
| `apps/api/test/c1-onboarding.e2e.spec.ts` | `810b598`: the 2026-09-11 date derived instead of fixed. Verified present (`OVERRIDE_DATE`, 6 lines, as in `810b598`) | test only |

**Forbidden areas:** `git diff --name-only` over `apps/mobile`, `db/migrations`, `contracts`, `packages`,
`pnpm-lock.yaml`, `package.json`, `apps/console` and `apps/api/src` returns **nothing**. There is no
migration, contract, client, lockfile, application or Mobile change. The security gates are unchanged;
the fail-safe only widens what runs.

## 4. Overlaps, duplicates and conflicts (task 1)

| Pair | Dry-run merge | Note |
|---|---|---|
| Candidate into `main` | **clean.** GitHub reports PR #105 `MERGEABLE`, and its CI built and passed the merge commit `f47b5ab` | -- |
| Candidate x `810fb27` | clean | Duplicate intent: both make a push to `main` run every gate. Redundant, not contradictory |
| Candidate x `infra/wo-infra-007-009-finalization` | clean | The same infrastructure content cherry-picked (different SHAs, identical bytes) |
| Candidate x `infra/wo-infra-001-006-stabilization` | conflicts | The candidate holds newer versions. The first branch is superseded; do not merge it |
| Candidate x WO-022 | clean | But it brings back four API suites without their listen-first fix (ISSUE-INFRA-FOLLOWUP-004) |

**Duplicated content that merges cleanly** (the same patch on both sides):
- `810b598`, which is also on the WO-022 line;
- the `t8` listen-first line;
- every infrastructure commit, present on both the candidate and the finalization branch.

## 5. The other checkout (task 3)

**What it is:** `C:\Users\naods\Documents\Work\adulis-platform`, read with `git --no-optional-locks`
only.

| | |
|---|---|
| Branch | `ci/scope-filter-main-push` at `810fb27`, in step with its remote |
| Staged | 1 rename (`apps/mobile/.claude/settings.json` -> `.claude/settings.json`), also modified |
| Unstaged | 17 modified files, including `ci.yml` (comments only), `gates.mjs` (appends a `mobile-gates` gate), `.dependency-cruiser.cjs` (a `tokens-import-nothing` rule), `pnpm-lock.yaml`, `package.json`, `packages/tokens/*`, `apps/mobile/package.json` |
| Untracked | 22 paths: an earlier Expo foundation (MOB-WO-0) under `apps/mobile/`, `packages/tokens/src/native/`, `docs/adu/` |
| Pushed anywhere | no |
| Owns the running stack | yes (compose labels) |

**Overlap with the candidate:**
- `ci.yml` and `.dependency-cruiser.cjs` apply cleanly.
- `gates.mjs` collides at the end of the gate list. Keep both gates; the list is append-only.

**Preservation and reconciliation plan** (founder-run; nothing was done to that checkout):
1. **Preserve first.** In that checkout, `git stash push --include-untracked -m "MOB-WO-0 local work"`,
   or better, commit it to a new local branch, `git switch -c local/mob-wo-0-foundation && git add -A
   && git commit`. Then push that branch so it exists off-machine.
2. **Bring the checkout to the merged `main`** (after PR #105 is merged): `git switch main && git pull`.
3. **Decide the mobile foundation.** MOB-WO-0, in that checkout, against WO-001 to WO-022, the
   foundation every later mobile work order built on. They overlap heavily (`apps/mobile`,
   `packages/tokens`, the lockfile). This is a product decision, not an infrastructure one.
4. **Resolve `gates.mjs` by hand** if MOB-WO-0's `mobile-gates` is kept: append it after
   `minio-migrate`. Never hand-merge `pnpm-lock.yaml`: take one side and run `pnpm install`.

## 6. Pull request (task 4)
**Draft PR #105**, https://github.com/Adulis-Socom/Adulis-MobileApp/pull/105.
- **Direction:** `infra/main-integration-candidate` into `main`.
- **Body:** "DRAFT. Do not merge without the founder's explicit approval"; the full change list and
  what is not changed; the pre-merge checks.
- **Opened by** this batch. **Not merged.**

## 7. Verification (task 5)

| Run | What | Result |
|---|---|---|
| [43415907830](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43415907830) | **The PR, event `pull_request`: GitHub's merge commit `f47b5ab`** (`e37d28d` merged into `01302cf`) | **success:** `scope: UNSCOPED - 7 changed root input(s)`; `PASS all 31 gates`; API 635 of 635 (44 suites); `console-e2e` 88; `gate-runner` 13; `minio-migrate` 11; permission matrix 252 cells; dependency rules 6 of 6; 0 Node 20 warnings |
| 43391044138 / 43392484504 | The candidate branch at `de1ae19` / `e37d28d` (push) | success, the same counts |

**What these runs establish:**
- Object storage was provisioned by the shared init in the CI step "Start object storage and create
  the two buckets".
- The migrate gate (with the seed) and the `worker-schema` gate passed.
- The scope filter cannot pass vacuously: the run is unscoped, and `gate-runner` tests the fail-safe.

The candidate gains WO-INFRA-012's test-isolation commits later in this batch; its final run is in
`WO-INFRA-014-FINAL-AUDIT.md`.

## 8. Issues
- ISSUE-INFRA-CLOSURE-001: Docker Desktop's backend had exited at 09:10Z; started by this batch.
- ISSUE-INFRA-CLOSURE-002: the merge, blocked pending approval.

## 9. Final status
- **Implementation:** COMPLETE. Candidate verified; PR open; reconciliation planned.
- **Operation:** the merge is **BLOCKED** pending founder approval. **`main` is not verified:** no run
  on the merged `main` exists, because nothing was merged.

**Commit SHA:** the WO-INFRA-010 commit on `infra/wo-infra-010-014-closure` (`git log --grep WO-INFRA-010`).
