# WO-INFRA-008 -- Legacy database archive (and the work-order report)

**Status of the work order: COMPLETE.**
- **Part A:** the legacy database was recovered from a copy, archived and restore-tested; the original
  volume was untouched.
- **Part B:** the branches are reconciled, and an infrastructure-only candidate was built and is green
  in CI. Nothing was merged.

13 November 2026. Part B details: `WO-INFRA-008-GIT-RECONCILIATION.md`,
`WO-INFRA-008-INTEGRATION-TESTS.md` and `WO-INFRA-008-MERGE-RECOMMENDATION.md`.

## 1. Work order
WO-INFRA-008, legacy database preservation and Git branch reconciliation (P1).

## 2. Initial state
- **The old directory:** volume `adulis-pgdata` holds a PostgreSQL 17 data directory from before
  2026-09-03, beside the MinIO objects that have been written there since (ISSUE-INFRA-005).
- **No restore attempt yet:** it had never been started or archived on its own.
- **Branches:** the first infrastructure branch was based on WO-022, so it also carried 253 mobile-line
  commits.

## 3. Part A: what the legacy database is

**Method:**
- Only the verified backup copy was used: `minio-volume-adulis-pgdata.tar`, all checksums OK.
- Its PostgreSQL files (MinIO directories excluded) were restored into the disposable volume
  `infra-legacy-pg`, then started with `pgvector/pgvector:pg17`, the image the stack uses, with no
  published port.
- The original volume was never mounted.

| Question | Answer (evidence: `logs/legacy-db-restore.log`, `legacy-db/`) |
|---|---|
| Structurally intact? | **Yes.** `pg_control`: "Database cluster state: shut down", last modified 2026-09-03 10:02:39 UTC, a clean shutdown one minute before MinIO first wrote into the volume (10:03:40). The server started with no recovery: "database system was shut down at 2026-09-03 10:02:39 UTC" |
| Version | PostgreSQL 17 (catalog 202406281), system identifier 7678391873398169638 |
| Databases | `adulis` 22 MB, `adulis_t1` 9.8 MB, `adulis_det` 8 MB, `postgres` |
| Roles | the same seven as today (`adulis_bootstrap` superuser, `adulis_app`, `adulis_jobs`, `adulis_migrate`, `adulis_financial`, `adulis_verification`, `adulis_readonly`) |
| `adulis` | 124 tables; migrations **0001 to 0048** (last applied 2026-09-03 09:59:03); 417 rows |
| `adulis_t1` | 33 tables, migrations 0001 to 0006 (2026-08-27); only the permission catalogue (181 rows): an old T1 test database |
| `adulis_det` | empty (no tables): the determinism gate's scratch database |

## 4. Part A: compared with the current development database

**What it was compared against:** the current side is the first batch's verified dump of the live
`adulis` (`adulis.dump`, 2026-11-12T22:14:35Z). It was restored beside the legacy data on the disposable
server; the live database was not queried for the comparison.

| Measure | Legacy `adulis` | Current `adulis` |
|---|---|---|
| Migrations | 0001 to 0048 | 0001 to 0053: the legacy list is **exactly its first 48** |
| Tables | 124 | 124, the **same names** (no table exists only on one side) |
| Rows | 417 | 929 |

**The data, row by row:**
- Every non-configuration row in the legacy database (accounts, person, seller, product and variants,
  orders, payment submissions, reservations, stock events, QR tokens, buyer profile) **has the same id
  in the current database**. These are the seed fixture's fixed ids (`5eed0000-...`).
- With timestamp columns removed, the rows are **identical** (checked for product, order, account and
  payment submission).
- The timestamps differ because the seed writes times relative to "now"; the legacy accounts were
  created at 2026-09-03 09:59:05.

**Conclusion:**
- The legacy database is a migrate-and-seed run of 2026-09-03 (migrations to 0048, then `db:seed`),
  shut down cleanly three minutes later.
- It holds no record that is not reproducible from the repository, so its value is low.
- It is archived anyway, as the work order requires, and nothing was assumed obsolete without this
  evidence.

## 5. Part A: the archive

**Location:** `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\legacy-db\` on the SSD, not in git.

| File | What |
|---|---|
| `legacy-adulis.dump` | `pg_dump -Fc` of `adulis` (683,507 bytes) |
| `legacy-adulis_t1.dump`, `legacy-adulis_det.dump` | the same for the other two |
| `legacy-globals.sql` | `pg_dumpall --globals-only --no-role-passwords`: the 7 roles, **without password hashes** |
| `legacy-pg_controldata.txt` | the cluster's control data |
| `SHA256SUMS.txt` | checksums of the above |
| `rowcounts-*.txt`, `migrations-*.txt`, `restored-rowcounts-*.txt` | the comparison and restore evidence |

**The physical copy remains:** `G:\AdulisDevelopment\WO-INFRA\backup\minio-volume-adulis-pgdata.tar`
holds the original directory byte for byte (checksum verified today).

**Restore test, in a fresh, separate PostgreSQL 17 container** (`logs/legacy-restore-test.log`):
- the checksums verify;
- the globals were applied;
- each database restored with `pg_restore --exit-on-error`, exit 0 for all three;
- **the per-table row counts equal the source's for all three databases**;
- all 7 roles are present, and no constraint is left unvalidated.

**Recovery limitation:** the role passwords are deliberately not exported. A restored instance needs its
own passwords, which the runtime-role provisioning step sets anyway.

## 6. Part A: the original volume
- **Not modified.** `adulis-pgdata` was never mounted by this work order.
- **The phantom MinIO "buckets"** (the PostgreSQL directories seen by MinIO) are untouched.
- **The live `adulis-minio`** still serves it, with the same container and start time as before the
  batch.
- **Deletion needs the founder's explicit approval,** even now that the data is archived.

## 7. Part B, in brief (details in the three Git reports)

| Branch | Head | Relationship |
|---|---|---|
| `main` | `01302cf` (2026-09-07) | base of everything below |
| `ci/scope-filter-main-push` | `810fb27` | `main` + 1 commit (`ci.yml` only); unmerged |
| `mobile/wo-022-messaging-reliability-hardening` | `3cad2e3` | `main` + 253 commits |
| `infra/wo-infra-001-006-stabilization` | `bfa24bf` | WO-022 + 6 infrastructure commits |
| `infra/wo-infra-007-009-finalization` | this batch | the previous one + this batch's commits |
| `infra/main-integration-candidate` | `b3b4e79` (before this batch's commits were added) | `main` + the 6 infrastructure commits + 1 test-only commit; **green in CI** (run 43385069084, 30 of 30 gates) |

**The other checkout** (`C:\Users\naods\Documents\Work\adulis-platform`, inspected read-only with
`--no-optional-locks`):
- **Branch:** `ci/scope-filter-main-push` at `810fb27`, in step with its remote.
- **Uncommitted, local only:**
  - one staged rename (`apps/mobile/.claude/settings.json` -> `.claude/settings.json`);
  - 17 modified files, among them `ci.yml` (comments only), `gates.mjs` (a `mobile-gates` gate),
    `.dependency-cruiser.cjs` (a `tokens-import-nothing` rule) and `pnpm-lock.yaml`;
  - 22 untracked paths: an earlier mobile-foundation attempt (MOB-WO-0) under `apps/mobile/`, plus
    `docs/adu/` and others.
- **Overlap with the infrastructure fixes:** only `gates.mjs`, where both append at the end of the gate
  list. The other two apply cleanly onto the candidate.
- **Nothing there was changed.**

## 8. Files inspected
- **Part A:** the backup tar listing, `pg_controldata`, both databases' catalogs and data.
- **Part B:** every branch's history; the six infrastructure commits; `810fb27`; the WO-022 versions of
  the five API suites and `c1-onboarding.e2e.spec.ts`; the Work checkout's diff.

## 9. Files modified
- **This branch:** only the four WO-INFRA-008 reports and the issue registers.
- **The candidate branch:** cherry-picks only (see the reconciliation report).
- **No application code, migration, contract or lockfile was touched.**

## 10. Verification commands
- **Part A:** `docker run ... tar -xpf - --exclude=...` into the disposable volume; `pg_controldata`;
  `psql` catalog and count queries; `pg_dump -Fc`; `pg_dumpall --globals-only --no-role-passwords`;
  `sha256sum -c`; `pg_restore --exit-on-error` into a fresh container.
- **Part B:** `git merge-base --is-ancestor`; `git merge-tree --write-tree`; `git apply --check`; `git
  cherry-pick -x`; CI runs 43384239326 and 43385069084.

## 11. Actual results
Sections 3 to 7. Integration CI results: `WO-INFRA-008-INTEGRATION-TESTS.md`.

## 12. Security review
- **No password hashes** left the legacy cluster: `--no-role-passwords` was used, and the globals file
  contains no `PASSWORD` line.
- **The disposable servers** published no port and were removed afterwards, with their volumes.
- **The live dev database was queried once,** in a session forced read-only
  (`default_transaction_read_only=on`), to confirm the orphan rows of ISSUE-INFRA-FOLLOWUP-005.

## 13. Regression review
- **No running service was changed.** The disposable containers (`infra-legacy-pg`,
  `infra-legacy-restore`), their volume, and one anonymous volume were removed. The volume count is
  back to 26.
- **The candidate's code changes** are byte-identical to the CI-verified first infrastructure branch,
  except that the four suites `main` does not have are absent there.

## 14. Issues encountered
- **ISSUE-INFRA-FOLLOWUP-004:** four of the five API suites with the listen-first fix exist only on
  the mobile line.
- **ISSUE-INFRA-FOLLOWUP-005:** the current dev database holds foreign-key orphans; its dump restores
  with 5 constraints missing.
- **ISSUE-INFRA-FOLLOWUP-006:** `main` fails CI on a calendar time bomb in `c1-onboarding`, fixed only
  on the mobile line.
- **ISSUE-INFRA-FOLLOWUP-007:** an exFAT worktree needs `safe.directory`.

## 15. Issues resolved
- **ISSUE-INFRA-005 (old database):** archived and restore-tested. Its remaining decision (keep or
  delete the volume) stays with the founder.
- **ISSUE-INFRA-012 (merge order):** reconciled, with a recommendation; the decision is the founder's.
- **ISSUE-INFRA-FOLLOWUP-006:** resolved on the candidate.

## 16. Founder decisions
- **Delete `adulis-pgdata`, or keep it?** Only after the MinIO move. Recommended: keep it until the move
  is verified, then delete.
- **Merge option A or B** (`WO-INFRA-008-MERGE-RECOMMENDATION.md`): **A recommended.**
- **Keep the test-only commit `810b598` in the candidate?** Recommended: yes.

## 17. Commit SHA and final status
- **Commit:** the WO-INFRA-008 commit on `infra/wo-infra-007-009-finalization`
  (`git log --grep WO-INFRA-008`).
- **Candidate:** `infra/main-integration-candidate`.
- **Final status:** **COMPLETE.**
