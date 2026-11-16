# Overnight infrastructure morning handoff -- 13 November 2026

**Branch:** `infra/wo-infra-001-006-stabilization`, pushed, **not merged**.

**Final code commit:** `bac327a`. A documentation commit follows it.

**CI:** **green**. Run 43324138043 passed all 30 gates.

## 1. Executive summary

CI had not run a single gate on any branch since 8 November, and main had been red since 4 September.
Four defects caused that, plus a fifth found on the way:

| Defect | Why it mattered | Status |
|---|---|---|
| The MinIO images are gone from Docker Hub (404) and quay.io (401) | every run died before the gates (AUD-002) | **Fixed** |
| The seed refused to run in CI (`NODE_ENV=unset`) | main stopped at gate `migrate` (AUD-003) | **Fixed** |
| Scoped CI runs could select zero packages and still pass | typecheck, build and test had been "passing" on main without running (AUD-004) | **Fixed** |
| MinIO was writing into the original PostgreSQL volume (AUD-001) | a misplaced YAML line since 3 September | **Configuration fixed**; the live data move waits for you |
| A race in how five API suites use supertest | they failed only on GitHub's runner | **Fixed** |

**Review:** two independent reviews then found three fail-open paths in my own fixes, plus two
pre-existing ones. All are fixed and mutation-tested.

**Now:**
- all 30 gates pass in CI: API 983 of 983, mobile 520 of 520, console end to end 88 tests;
- the same 30 pass locally against disposable services.

**Data safety:** no live data was touched.

## 2. Work-order results

| Work order | Status | Accomplishments | Remaining problems |
|---|---|---|---|
| WO-INFRA-001 | COMPLETE | Full discovery; root cause of the volume mix-up traced to `2cb0baf`; checksummed backup on the SSD; risk register and recovery plan | Production backup status unknown (ISSUE-INFRA-017) |
| WO-INFRA-002 | PARTIALLY COMPLETE | Separate, explicit volumes, with PostgreSQL unchanged; project name pinned; 18/18 disposable checks; data move rehearsed on a copy, 15/15 with every object identical | Live MinIO move BLOCKED pending approval (ISSUE-INFRA-001); old database decision (ISSUE-INFRA-005) |
| WO-INFRA-003 | COMPLETE | Chainguard MinIO pinned by digest; one fail-loud init script for compose and CI; 22/22 image checks; CI provisioning green | Signature not verified (ISSUE-INFRA-027); digest lifetime (R-05) |
| WO-INFRA-004 | COMPLETE | Seed gets `NODE_ENV=test` as a default only; scope fail-safe; new `gate-runner` gate (13 tests, 10/10 mutations killed) | Overlap with the unmerged `810fb27` (ISSUE-INFRA-012) |
| WO-INFRA-005 | COMPLETE | Every verification category has a result; CI green 30/30; supertest race diagnosed (94/420 vs 0/420) and fixed | Runner on ubuntu-26.04; Node 20 actions deprecated (ISSUE-INFRA-016) |
| WO-INFRA-006 | COMPLETE | Two independent reviews; 9 findings fixed or documented; final audit; CI re-verified at `bac327a` | Founder decisions below |

## 3. Issues discovered

| Metric | Count |
|---|---|
| Total discovered | 27 |
| Resolved | 18 |
| Open | 3 |
| Blocked | 1 |
| Deferred | 2 |
| Needs founder decision | 3 |
| Founder decisions required (issues marked YES) | 4 |

Full register: `docs/overnight/OVERNIGHT-INFRA-ISSUES-2026-11-13.md`. Open list:
`docs/infrastructure/WO-INFRA-006-OPEN-ISSUES.md`.

## 4. Critical unresolved issues

**P0, ISSUE-INFRA-001 (BLOCKED): the live MinIO objects still sit in the old volume.**
- The configuration is fixed; only the data move is waiting. It is a copy, not a move, and is rehearsed.
- Until it runs, `docker compose up` with the new file shows an empty MinIO. Nothing is lost.

**P1:** none unresolved.

## 5. Founder decisions required

1. **Run the MinIO data move?**
   - **Options:**
     - (a) run `docs/infrastructure/WO-INFRA-002-MIGRATION-RUNBOOK.md` (about 5 minutes; it copies,
       verifies, then switches);
     - (b) start MinIO empty and re-seed the fixtures;
     - (c) keep the old file locally.
   - **Risks:** (a) is low risk; the old volume stays as a fallback. (b) loses the local test media.
     (c) keeps the misnamed volume.
   - **Recommended:** (a).
   - **Blocked until then:** using the new compose file locally with the existing media.
2. **The old database inside `adulis-pgdata`** (a PostgreSQL 17 directory from before 3 September, about
   145 MB).
   - **Options:** keep, export with `pg_dump` from a throwaway container, or discard.
   - **Risk:** someone removing the volume or the phantom `pg_*` buckets by mistake.
   - **Recommended:** export after the move, then discard.
   - **Blocked:** deleting the volume `adulis-pgdata`.
3. **Merge order with the existing CI work.**
   - **Options:** merge this branch first, or merge `ci/scope-filter-main-push` (`810fb27`) first and
     resolve `ci.yml`.
   - **Risk:** a merge conflict in `ci.yml`. The other checkout also holds uncommitted `ci.yml` and
     `.dependency-cruiser.cjs` edits.
   - **Recommended:** this branch first; its scope fail-safe also covers main.
   - **Blocked:** the merge.
4. **Production backups.**
   - **Options:** confirm that production is not yet deployed, or provide read access to verify.
   - **Risk:** unknown recoverability.
   - **Recommended:** confirm before any production data exists.
   - **Blocked:** nothing in this batch.

Not blocking:
- review the image vendor;
- review the five API test one-liners as backend owner;
- re-authorise the GitHub plugin.

## 6. CI/CD verification

| | |
|---|---|
| Branch | `infra/wo-infra-001-006-stabilization` |
| Final commit verified | `bac327ad8b43e70921eab8a00c5e69e01dff20e2` |
| Workflow run | https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43324138043 |
| Result | **success**; 16 of 16 steps |
| Passed gates | 30 of 30, run unscoped because root inputs changed. API 983/983, mobile 520/520, `console-e2e` 88, `gate-runner` 13/13, permission matrix 252 cells |
| Failed gates | none |
| Skipped gates | none; nothing was "not selected" |
| Earlier runs | 43320430973 (`bbbadac`): failed at `test`, 4 ECONNRESET, fixed. 43321921280 (`1a8c6f7`): green |
| Not executed | no gate exists for a secret scan, native builds or the additive-only contract differ; main itself has not run (not merged) |

## 7. Data safety

- **Existing persistent data touched:** no.
  - `adulis-postgres` and `adulis-minio` kept running on their original volumes throughout, started
    2026-11-12T07:01Z, before the batch.
  - Reads only: listings, `pg_dump`, and a read-only tar.
- **Volume migration:** none on live data. It was rehearsed on a restored copy.
- **Destructive operations:** none.
  - No `down -v`, prune or volume delete on anything that existed before the batch.
  - Only the batch's own `infra-test-*` and `infra-gates-*` containers, volumes and networks were
    removed, plus one unused image it had pulled.
- **Storage isolation verified:** yes, on a disposable project running the committed compose file.
  - The volumes are distinct.
  - No cross-contamination.
  - Data survives restart and down/up.
- **Secrets exposed:** none. Only the documented local fakes appear; the scan of all added lines is clean.
- **Backup:** `G:\AdulisDevelopment\WO-INFRA\backup\`, with SHA256SUMS. It holds both databases, the
  roles and the whole MinIO volume.

## 8. Next development readiness

- **Can Mobile frontend development safely resume?** Yes.
  - Nothing in `apps/mobile` changed.
  - CI now actually runs the mobile suite: 520 of 520 in CI.
  - New mobile branches will get real CI results once they are based on a commit that has these fixes.
- **Infrastructure still needing attention:**
  - the MinIO move;
  - the old database;
  - the merge reconciliation;
  - production backups;
  - a later bump of the Node 20 action majors.
- **Ready for review?** Yes: 10 code files, five commits, each with its own report in
  `docs/infrastructure/`.
- **Ready to merge?** After decision 3 and the `cosign` check; merging does not need the MinIO move.
  The branch also carries WO-018 to WO-022, because it is based on the WO-022 head. Merging it merges
  them too, so decide whether this branch or a rebase of its five infrastructure commits onto `main`
  should be the vehicle.
- **To verify after merging:**
  - the first CI run on main is green and shows `scope: UNSCOPED - ... selects no package`, or root
    inputs;
  - run the MinIO runbook on the development machine;
  - `docker compose wait minio-init` returns 0.
- **Partially complete work orders:** WO-INFRA-002, because only the live data move remains.

## Storage (DEVELOPMENT-STORAGE-POLICY)

1. **Start:** C: 31,936,733,184 bytes free; G: 3,353,324,027,904 (audit at 2026-11-12T22:10Z,
   `logs/storage-audit-start.log`).
2. **Before cleanup:** C: 32,408,494,080; G: 3,353,065,029,632.
3. **After cleanup:** C: 32,395,468,800; G: 3,353,061,883,904.
4. **Net growth:**
   - C: free rose by 458,735,616 bytes. Windows shrank its system-managed page file from 29,520 to
     23,538 MB during the night; the batch did not change it.
   - G: free fell by 262,144,000 bytes.
   - Docker's data disk stayed at 47.34 GB.
5. **Generated:** 187,115,191 bytes in `G:\AdulisDevelopment\WO-INFRA`: the backup (164 MB), logs and
   scripts. The pinned MinIO image (236 MB) sits inside Docker's disk.
6. **Removed:** the batch's disposable containers, volumes and networks, and the unused
   `chainguard/minio-client` image (84 MB inside Docker's disk).
7. **Recovered:** 0 bytes on C: (space freed inside Docker's disk does not return to C:).
8. **Protected:** untouched. That covers the `adulis-*` and `nac-trial-*` containers and volumes,
   `adulis-pgdata`, both databases, the shared caches, `G:\w2`, `G:\wo001a`, `G:\w10a` and the archive.
9. **Concerns:**
   - RAM ran at 0.4 to 3.7 GB free.
   - The audit again lists about 21 GB of reclaimable Docker build cache (shared, not touched), about
     2 GB of pip leftovers, and the old native build copies on G:. All are review items for the founder.
