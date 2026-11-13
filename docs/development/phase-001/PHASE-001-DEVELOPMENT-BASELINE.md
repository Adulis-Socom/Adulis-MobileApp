# PHASE-001 -- Development baseline

13 November 2026. Work Order C.

This document records a recommendation. **No branch, worktree, merge or pull request was created to
implement it.** Each step below needs the founder's authorisation in a later work order.

## 1. Canonical baseline (C1)

| | |
|---|---|
| Branch | `origin/infra/wo-infra-010-014-closure` |
| Commit | `341d57935bfb430a0db6c8bea708ae1e47c21f26` (verified after a fresh `git fetch`; 0 commits since) |
| Code commit | `be098c7` (`341d579` adds documentation only) |
| Contains | `main` (`01302cf`) + WO-001 to WO-022 (mobile) + WO-INFRA-001 to 014 (272 commits) |
| CI | run 43424424106 on `341d579`: success; code run 43422806778: 32 of 32 gates, 1,004 API tests, 520 mobile tests, 88 console end-to-end, 0 failed, 0 skipped |
| Local copy | the workspace clone `Adulis-Mobile-Workspace/Adulis-MobileApp`, on this branch, clean (0 status entries) |

**Until the founder merges this line into `main`, every new Mobile or infrastructure branch starts from
`341d579`.** After the merge, new branches start from `main`.

**Not the baseline:**
- `main`: no Mobile app, and its latest CI run (7 September) failed;
- `mobile/wo-022-...`: contained in the baseline;
- `backup/mob-wo-0-preservation-2026-11-13`: a backup;
- `ci/scope-filter-main-push`: September.

## 2. Branch naming convention (C2)

| Prefix | Use | Example |
|---|---|---|
| `mobile/wo-0NN-<slug>` | a Mobile work order, in `apps/mobile` only | `mobile/wo-019-native-verification` |
| `infra/wo-infra-0NN-<slug>` | CI, Docker, scripts, test infrastructure | `infra/wo-infra-015-minio-move` |
| `packages/<package>-<slug>` | any change to `packages/*`, always its own PR (repository rule) | `packages/tokens-native-roles` |
| `api/<slug>`, `console/<slug>` | backend or console work, owned by those workstreams | -- |
| `integration/<slug>` | a reconciliation branch that merges lines, created only on authorisation | `integration/closure-into-main` |
| `backup/<topic>-<yyyy-mm-dd>` | a preservation snapshot; never merged, never rewritten | `backup/mob-wo-0-preservation-2026-11-13` |
| `docs/<slug>` | documentation only | -- |

Rules that already apply:
- one branch per work order;
- no force-push;
- no direct commit to `main`;
- `pnpm-lock.yaml` is never hand-merged (take one side, `pnpm install`, commit);
- `contracts/openapi.json` and `schema.d.ts` are written by CI only;
- `db/migrations/**` has a single writer.

## 3. Isolated worktrees (C2)

Parallel agents must never share a working tree.

**One agent, one worktree, one branch.** The workspace clone stays on the baseline as the read and
integration copy; implementation happens in worktrees.

| Rule | Reason (recorded in earlier work orders) |
|---|---|
| Put worktrees on the SSD at a **short, real, top-level path**, for example `G:\wt\m019` | React Native codegen breaks under `subst` drives and long paths |
| Never use a junction or a symbolic link on G: | exFAT has no junctions; pnpm links break |
| Add each G: worktree to `safe.directory` | exFAT has no ownership, so Git refuses it otherwise |
| Run `pnpm install` in each worktree; point the Jest and Metro caches at `G:\AdulisDevelopment\shared-cache` | `node_modules` is per tree. The pnpm store is on C: (4.33 GB) and cannot hard-link across drives, so each G: worktree holds a full copy (about 1 GB) |
| Never create `node_modules` at the workspace level | it would be shared by both repositories through upward resolution (workspace rule) |
| Source `ops/scripts/adulis-ssd-env.sh WO-xxx` before work | temporary output goes to the SSD, never C: |
| Remove a worktree with `git worktree remove` when its work order ends | avoids stale records like `wt-am` in the Work checkout |
| Only one worktree may use the live development stack (ports 5434, 9100) or the emulator at a time | they are single shared resources |
| Database-writing tests run only against `ops/scripts/test-db.sh up` (ports 55432, 59000) | the guards refuse an unmarked database |

**Not created:** no future branch or worktree was created during PHASE-001, as the work order requires.

## 4. Integration sequence (C3)

`main` is at `01302cf`. Two routes exist; the founder chooses (PHASE-001-DEC-01).

**Route 1 (recommended, as prepared by WO-INFRA-010):**

1. **Merge PR #105** (`infra/main-integration-candidate`, 19 commits, infrastructure only) into `main`.
   - Its merge result is already green: run 43423038257, 32 of 32 gates.
   - Then confirm a green push run on `main`; that is the first verification of `main`.
2. **Reconcile:** create `integration/closure-into-main` from the closure line and merge the new `main`
   into it. Expect **4 conflicts** (simulated in `PHASE-001-BRANCH-AUDIT.md` section 4); resolve each by
   taking the closure version:
   - `apps/api/jest.config.js` (the closure adds the WO-INFRA-012 global setup and teardown);
   - the three `docs/overnight/OVERNIGHT-INFRA-*-ISSUES-2026-11-13.md` registers (the closure copy is a
     superset).

   Then run full CI.
3. **Review and merge** the reconciled line (WO-001 to WO-022) into `main` through a pull request,
   with a backend review of the API-adjacent changes. After that, `main` is the baseline.

**Route 2:**
- Close PR #105 unmerged and open one pull request from the closure line to `main`.
- `git merge-tree` shows this merges **cleanly**.
- The cost is a single 272-commit review, with the infrastructure and Mobile changes reviewed together.

**Why Route 1:**
- the infrastructure changes are small, reviewed and green;
- landing them makes `main` verifiable;
- the conflicts that follow are mechanical and known.

**Never:** a hand-merged lockfile; a force-push; merging MOB-WO-0 (it is a reference, not a source).

## 5. Infrastructure dependencies (C4)

| Dependency | State | Blocks |
|---|---|---|
| Disposable test environment (`test-db.sh`, the disposable-database mark, the Jest and gate guards) | on the closure line; works | -- (it is what makes local testing safe) |
| Live development PostgreSQL `adulis-postgres` (port 5434, database `adulis`, **unmarked**, so the guards refuse to write to it) | running, healthy | -- |
| Live MinIO `adulis-minio` (port 9100), data on the volume named `adulis-pgdata` | running; the name is misleading | the MinIO move (WO-INFRA-011): **BLOCKED** pending founder approval |
| Development-database repair (WO-INFRA-013 script and plan) | prepared, rehearsed on copies | **BLOCKED** pending founder approval |
| Five known teardown leaks (ISSUE-INFRA-CLOSURE-004) | tolerated by the fk-audit ratchet | -- (to fix in API tests later) |
| Object-store guard (ISSUE-INFRA-CLOSURE-006) | none; tests can reach the live MinIO if misconfigured | a future infrastructure work order |
| Native validation backlog since WO-018 | `docs/mobile/MOBILE-NATIVE-VALIDATION-BACKLOG.md` | Mobile release readiness; WO-019 |
| Contract decisions W21-02, W20-07 and the four Chat decisions | open | parts of Seller Companion and messaging |
| Production environment | unknown (ISSUE-INFRA-017) | production readiness |
| Expo development server | needs `EXPO_PUBLIC_API_BASE_URL`, or the app shows a generic error | every on-device session |

**Mobile work order sequence:**
- **WO-019 (native verification)** first, once the machine has free memory (see the environment
  inventory).
- **WO-023 (Seller Companion order awareness)** after it.
- Neither was started in PHASE-001.
