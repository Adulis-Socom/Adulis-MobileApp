# PHASE-001 -- Branch audit

13 November 2026. Work Order B1 and B2, read-only. Repository `Adulis-Socom/Adulis-MobileApp`, 134 remote
branches. The refs were refreshed with `git fetch` immediately before this table.
Evidence: `evidence/branch-audit.txt`, `evidence/closure-verification.txt`, `evidence/merge-simulation.txt`.

## 1. The branches that matter

"Ahead" and "behind" are counted against `origin/main` (`01302cfb7616cb38de111de9a7694312c58c8913`).
Every branch below has `01302cf` as its merge base and is 0 commits behind `main`.

| Branch | Head (full) | Ahead of `main` | Latest CI (run, event, result) | Role |
|---|---|---|---|---|
| `main` | `01302cfb7616cb38de111de9a7694312c58c8913` | 0 | 34129602933, push, 7 Sep 2026, **failure** (Gates step) | protected trunk; **not verified green** |
| `mobile/wo-022-messaging-reliability-hardening` | `3cad2e39965657e2580009c424205f3843ad8eca` | 253 | 43301469942, push, **failure** ("Start object storage": the old MinIO image) | mobile line WO-001 to WO-022; superseded by the closure line, which contains it |
| `infra/wo-infra-001-006-stabilization` | `bfa24bf8388985bc610b183b0578eb501d13994c` | 259 | 43326234395, **success** | historical; contained in the closure line |
| `infra/wo-infra-007-009-finalization` | `149924c02fa7daea4200a73facf543258cf7dd62` | 264 | 43392474799, **success** | historical; contained in the closure line |
| `infra/wo-infra-010-014-closure` | `341d57935bfb430a0db6c8bea708ae1e47c21f26` | 272 | 43424424106, **success** | **the recommended baseline** (section 3) |
| `infra/main-integration-candidate` | `66123ba818837b093710b4d01a38a2a509cc0e4b` | 19 | 43423038257, pull_request (PR #105 merge result), **success** | infrastructure-only path into `main` |
| `ci/scope-filter-main-push` | `810fb27811ede6e170cff5d7029fee42fe45aad6` | 1 | 34147378670, push, 7 Sep 2026, **failure** (Gates step) | the Work checkout's branch; base of the preservation branch |
| `backup/mob-wo-0-preservation-2026-11-13` | `0f9b08380d869d7a6c0783595966210f607a404a` before this documentation commit | 3 | 43447307780, push, **failure** (old MinIO image) | PHASE-001 backup (see the manifest) |
| `backup/tier2-before-merge` | `d39e30d9043fe8bd9da9683a4d02e1e8b5107034` | -- (316 behind) | not checked | an older backup; untouched |

## 2. Open pull requests

| PR | Head -> base | State | Mergeable | Note |
|---|---|---|---|---|
| **#105** | `infra/main-integration-candidate` (`66123ba`) -> `main` | **draft**, open, not merged | MERGEABLE | its merge result passed CI (32 of 32 gates) |
| #75 | `tier13/t13-p1-db-v1-14` (`e72b8bc`) -> `main` | open | CONFLICTING | unrelated to this phase; stale |

**No pull request was created, merged or changed in PHASE-001.**

## 3. Verification of the infrastructure closure (B2)

The closure handoff's claims were checked against `origin/infra/wo-infra-010-014-closure` at `341d579`.

| Claim | Check | Result |
|---|---|---|
| The WO-INFRA-010 to 014 artefacts exist | `minio-migrate.mjs` and its test, `minio-init.sh`, `fk-audit.mjs` and its test, `assert-disposable-db.mjs`, `test-db.sh`, `gates.test.mjs`, `apps/api/test/{db-target,global-setup,global-teardown}.ts`, `db-target.spec.ts`, `WO-INFRA-013-repair.sql`, `WO-INFRA-013-REPAIR-PLAN.md`, the closure handoff | **all present** |
| Every work order is documented | WO-INFRA reports per order: 001:3, 002:3, 003:2, 004:2, 005:3, 006:3, 007:3, 008:4, 009:4, 010:3, 011:3, 012:3, 013:4, 014:4 | **44 reports** |
| The mobile work is on the line | WO-022's head `3cad2e3` is an ancestor; 171 mobile work-order commits | **yes** |
| The gates | the list in `ops/scripts/gates.mjs` | **32 gates** |
| CI hardening | `ci.yml`: the test-database mark step, the pinned Chainguard MinIO digest, `checkout@v7`, `setup-node@v7`, `action-setup@v6` | **present** (1, 1, 3) |
| Nothing added since the handoff | commits after `341d579` | **0** |
| CI green | run 43424424106 on `341d579`; the code run 43422806778 on `be098c7` (32 of 32 gates, 1,004 API tests, 520 mobile tests, 88 console end-to-end) | **success** |
| Merge state | PR #105 draft and unmerged; `main` unchanged at `01302cf` | **as recorded** |

**No contradiction with the closure documentation was found, except one stale statement (next section).**

## 4. Merge simulation (in memory; nothing merged)

`git merge-tree --write-tree` computes a merge without touching a branch, the index or a working tree.

| Simulation | Result | Conflicting files |
|---|---|---|
| `main` + closure | **clean** | none |
| candidate (PR #105) + closure | **4 conflicts** | `apps/api/jest.config.js` (content); `docs/overnight/OVERNIGHT-INFRA-ISSUES-2026-11-13.md`, `...-FOLLOWUP-ISSUES-...`, `...-CLOSURE-ISSUES-...` (add/add) |
| `main` + preservation branch | clean | none |
| closure + preservation branch | **7 conflicts** | `CLAUDE.md`, `apps/mobile/CLAUDE.md`, `apps/mobile/metro.config.js`, `apps/mobile/package.json`, `apps/mobile/tsconfig.json`, `ops/scripts/gates.mjs`, `pnpm-lock.yaml` |

**Stale statement:**
- **What the documents say:** the closure handoff, `WO-INFRA-010-INTEGRATION-AUDIT.md` and
  `WO-INFRA-014-MOBILE-READINESS.md` all say that merging the closure line after PR #105 carries
  **one** conflict, `apps/api/jest.config.js`.
- **What the simulation shows:** after the final documentation commit `341d579` there are four.
- **Why:** the three extra conflicts are documentation registers that both branches added. In each
  case the closure copy is the candidate's copy plus 4 lines.
- **Resolution, when the merge is authorised:** take the closure version of all four files. The
  `jest.config.js` closure version adds the WO-INFRA-012 global setup and teardown lines.
- **Recorded as:** PHASE-001-ISS-03.

## 5. CI failures, classified

| Run | Branch | Failing step | Cause | Action |
|---|---|---|---|---|
| 34129602933 | `main` (7 Sep) | Gates | predates the infrastructure work, and is still the latest run on `main` | fixed on the closure and candidate lines; `main` is verified only after an authorised merge |
| 34147378670 | `ci/scope-filter-main-push` (7 Sep) | Gates | same era as `main` | none |
| 43301469942 | `mobile/wo-022-...` | Start object storage | `minio/minio` no longer pullable; fixed by WO-INFRA's pinned Chainguard digest | none: superseded |
| 43447307780 | `backup/mob-wo-0-preservation-2026-11-13` | Start object storage | the September `ci.yml` (same cause) | none: a backup is not modified (PHASE-001-ISS-04) |
