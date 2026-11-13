# Infrastructure closure handoff -- 13 November 2026 (WO-INFRA-010 to 014)

**The primary founder review document for the closure batch.**

**Branches:** pushed, **nothing merged**.
- `infra/wo-infra-010-014-closure`: this batch, on the finalization branch.
- `infra/main-integration-candidate`: `main` plus the infrastructure only, offered to `main` as
  **draft PR #105**.

**Registers:**
- `OVERNIGHT-INFRA-CLOSURE-ISSUES-2026-11-13.md` (this batch);
- `OVERNIGHT-INFRA-FOLLOWUP-ISSUES-2026-11-13.md` and `OVERNIGHT-INFRA-ISSUES-2026-11-13.md` (updated
  with dated notes).

## A. Executive summary
1. **Ready to merge, not merged.** The infrastructure-only candidate is verified and offered as **draft
   PR #105**. GitHub calls it mergeable, and CI on GitHub's merge commit with `main` is green.
2. **The MinIO move is ready, not run.** Its read-only preflight passes (1,568 media, 7 evidence objects)
   and rollback is ready. It still needs your approval.
3. **The cause of the development database's broken data is closed.** The API tests used to run against
   the persistent development database. Now:
   - the API tests, the load tests and every gate that writes refuse any database not explicitly marked
     disposable (proven live, with the development database unchanged);
   - CI marks its own throwaway database;
   - a new script gives developers the same disposable setup in about 11 seconds;
   - an audit after every API run fails on any new kind of broken foreign key.
4. **The broken data itself is traced and repairable.** 192 rows break five foreign keys, all residue of
   those test runs. A repair script, revised after review, was rehearsed on a copy: every foreign key
   holds afterwards, and it refuses and rolls back on anything unexpected. **It was not run** on the
   development database: it needs your approval.
5. **Two independent reviews** found real gaps in this batch's first version (three high), plus a design
   error I caught myself (a check that could not see what it was checking). All are fixed and
   re-verified.

## B. Work-order results

| Work Order | Status | Completed | Remaining |
|---|---|---|---|
| WO-INFRA-010 | **PARTIALLY COMPLETE** | branch audit; candidate review (nine code files, no forbidden area, `810b598` present); Work checkout inspected read-only, with a preservation plan; draft PR #105; merge-result CI green; post-merge procedure | **the merge: BLOCKED** (your approval) |
| WO-INFRA-011 | **PARTIALLY COMPLETE -- LIVE CUTOVER BLOCKED PENDING FOUNDER APPROVAL** | controls re-verified (11 tests); `MINIO_HOST_PORT=9100` in this checkout's `.env`; read-only plan PASS; rollback prerequisites (the old image local, the archive verified) | **the live cutover** |
| WO-INFRA-012 | **COMPLETE** | disposable-database guard for the API, load tests and writing gates; CI mark; `test-db.sh`; the teardown audit with the known-leak ratchet; regression tests and live refusal proofs | the five teardown leak classes (24 files) to fix later |
| WO-INFRA-013 | **PARTIALLY COMPLETE** | read-only audit (192 rows, five keys); root cause; recovery point; repair script; rehearsal on a copy (every key validated, a refusal on mismatch and on an unforeseen reference, rollback) | **the live repair: BLOCKED** (your approval) |
| WO-INFRA-014 | **COMPLETE** | two independent reviews, all findings fixed or recorded; registers updated; final CI on both lines; environment and Mobile readiness assessed | -- |

## C. Git integration

| | |
|---|---|
| Branches reviewed | `main` `01302cf`, `ci/scope-filter-main-push` `810fb27`, WO-022 `3cad2e3`, the first infrastructure branch `bfa24bf`, finalization `149924c`, candidate, closure (merge base of all: `01302cf`) |
| Integration candidate | `infra/main-integration-candidate`: `main` + the infrastructure commits of WO-INFRA-001 to 014 + `810b598`. Code files: `ci.yml`, `docker-compose.yml`, `gates.mjs`/`gates.test.mjs`, `minio-init.sh`, `minio-migrate.mjs`/test, `fk-audit.mjs`/test, `assert-disposable-db.mjs`, `test-db.sh`, `ops/load/db-loads.mjs`, `apps/api/jest.config.js` and `jest.load.config.js`, `apps/api/test/{db-target,global-setup,global-teardown}.ts` and the guard spec, `t8-device-bootstrap` and `c1-onboarding` (test only). **No** application, migration, contract, package, lockfile or Mobile change |
| Merge readiness | PR #105 `MERGEABLE`; the merge-result CI is green (section F) |
| Actual merge status | **not merged** |
| Conflicts | none with `main`. Later, merging the closure line into `main` carries **one mechanical conflict** in `apps/api/jest.config.js`: keep the closure version |
| Founder approval required | **yes**: the merge; and whether `810fb27` also merges (it is clean either way) |

## D. MinIO migration

| | |
|---|---|
| Preflight | `plan` PASS at 11:29Z: `adulis-minio` on `adulis-pgdata`, port 9100, project `adulis-platform`, the target volume absent, no writer running |
| Backup status | the first batch's set verified (5 of 5 checksums). A fresh backup is taken by the live run |
| Source and destination | `adulis-pgdata` -> `adulis-platform_adulis-miniodata` |
| Authorization status | **none**: the work order excludes it, and no separate approval exists |
| Actual execution | **not executed** |
| Object verification | live: 1,568 / 7 counted read-only. The move compares every object by SHA-256, ETag, size and metadata (rehearsed in the previous batch) |
| Rollback readiness | the old image local **and** archived (checksum OK); `rollback` rehearsed |
| Remaining risks | compose with the new file starts MinIO empty until the move; the Work checkout's `.env` lacks `MINIO_HOST_PORT` |

## E. Database integrity

| | |
|---|---|
| Orphaned records | **192**: `otp_delivery_attempt` 155, `device` 15, `order_state_transition` 10, `claim_evidence_item` 9, `notification` 3 (175 keys checked, read-only) |
| Affected foreign keys | the five above, all still marked validated by PostgreSQL |
| Root cause | the API suites ran against this database by default (the root `.env`), and their teardowns delete parents under `session_replication_role = replica`, which switches foreign keys off. One fresh run leaves 35 orphans on the same five keys, deterministically |
| Test isolation status | **in force** on both lines (WO-INFRA-012) |
| Backup and restoration | recovery point `adulis-dev-20261113T113549Z.dump` (checksummed). It restores with exactly the five errors |
| Repair rehearsal | on a copy: archive 192 rows; repair; re-add the five keys (validated); restore with `--exit-on-error`; **all 175 keys hold**. A second run refuses; an unforeseen referrer raises and rolls back; the archive reload restores the original |
| Live repair authorization | **none: BLOCKED** |

## F. CI verification
**Final code runs**, all `success`, 17 of 17 steps, 0 Node 20 warnings:

| | Closure branch | Candidate (push) | PR #105 (merge result with `main`) |
|---|---|---|---|
| Branch / commit | `infra/wo-infra-010-014-closure` `be098c7` | `infra/main-integration-candidate` `66123ba` | merge commit `d61a638` (`66123ba` into `01302cf`) |
| Workflow | [43422806778](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43422806778) | [43422815900](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43422815900) | [43423038257](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43423038257) |
| Gates | **32 of 32** | **32 of 32** | **32 of 32** |
| API tests | 1,004 of 1,004 (64 suites: 983 + 21 guard) | 656 of 656 (45 suites) | 656 of 656 (45 suites) |
| Mobile tests | 520 of 520 (27 suites) | none: `main` has the placeholder app | none |
| Console end to end | 88 passed | 88 passed | 88 passed |
| Infrastructure tests | `gate-runner` 16, `minio-migrate` 11, `fk-integrity` 3 | the same | the same |
| Database guard | `PASS DATABASE_URL / DATABASE_URL_JOBS / DATABASE_URL_MIGRATE reaches adulis, marked disposable` before the first writing gate; `[db-target] ... marked disposable` before the suites | the same | the same |
| Teardown audit | `PASS all 201 foreign keys hold, apart from 5 known test leak(s) (35 rows)` | `PASS all 175 ... apart from 5 known (20 rows)` | the same as the push |
| Failed | 0 | 0 | 0 |
| Skipped | 0 steps skipped | 0 | 0 |

**Not executed:**
- **No CI run on `main` itself:** nothing was merged, so **`main` is not verified**.
- **No gate exists** for a secret scan, native builds or the additive-only contract differ.
- **Earlier runs of this batch** (all green) are listed in the WO-INFRA-010, 012 and 014 reports. The
  documentation commit after `be098c7` also runs CI; its result is in the final message.

## G. Security and data safety
- **Existing data modified:** **no.**
  - `adulis-postgres`, `adulis-minio`, `adulis-pgdata` and `adulis-platform_adulis-pgdata` were unchanged.
  - The development database was read only, with per-table counts identical before and after every
    proof.
  - The live containers restarted once, through their restart policy, when this batch started the
    crashed Docker Desktop.
- **Any volume deleted:** none that existed before the batch. Removed only: the anonymous volumes of
  this batch's own disposable containers, each confirmed unused, with creation times matching the
  container starts. The count is back to 26.
- **Any database reset:** **no.** Only disposable databases were created and destroyed.
- **Any branch merged:** **no.** No force-push.
- **Secrets exposed:** **no.** Only CI's documented fakes appear (`test-db.sh`); the audit tools never
  print credentials; the legacy role export carries no password hashes.
- **Security controls weakened:** **no.** New controls were added, and the reviews' security findings
  are fixed.

## H. Issues register

| | Count |
|---|---|
| Closure issues discovered | 13 |
| Resolved | 7 (001, 005, 007, 008, 009, 010, 013) |
| Open | 3 (004 ratcheted, 006, 012) |
| Blocked | 3 (002 merge, 003 MinIO move, 011 database repair) |
| Deferred | 0 |
| Founder decisions required | 6 (002, 003, 004, 006, 011, 012) |

**The earlier registers, with dated notes added:**
- the first batch's: 001 still blocked; 005 the deletion decision only; 010 still open; 012 now PR #105;
- the follow-up's: 002 partly done; 004 vehicle now the closure branch; 005 root cause closed, repair
  blocked; 006 unchanged.

## I. Founder decisions

| Decision | Options | Risks | Recommended | What stays blocked |
|---|---|---|---|---|
| Merge PR #105 | merge (a merge commit); wait | waiting: `main`'s CI stays broken or meaningless | **merge**, then the post-merge checks | `main`'s trustworthy CI; the MinIO move from `main` |
| The MinIO move | run the rehearsed script; start empty and re-seed; keep the old volume | about 2 min of downtime; automatic undo | **run it** after the merge, from the checkout that owns the stack | using the new compose file with existing media |
| The development database repair | run the rehearsed repair; leave it; rebuild the database | removes 192 test-residue rows, archived first | **run it** | clean development-database dumps |
| The Work checkout's MOB-WO-0 work | commit and push to a branch; stash; discard | it exists only on one disk | **commit and push today** | parallel mobile work |
| Which mobile foundation | WO-001 to WO-022 (tested, 520 tests); MOB-WO-0 (local) | two foundations cannot both continue | **WO-001 to WO-022** | the Mobile roadmap |
| Fix the five teardown leak classes | a test-maintenance work order; leave ratcheted | leaks within those keys go unnoticed | **schedule it** | nothing |
| Guard the object store for tests | extend the guard; leave it | a misconfigured local run writes into the live MinIO | **extend it** (small) | nothing |
| Production and its backups | confirm; provide access | unknown recoverability | **confirm** | the production-readiness assessment |

## J. Mobile development readiness
- **Can Mobile development resume:** **yes.** No `apps/mobile` file changed, and the mobile suite runs in
  CI (520 of 520).
- **The recommended branch:** `infra/wo-infra-010-014-closure`.
- **The exact starting commit:** the head of that branch at the end of this batch (given in the final
  report), the documentation commit after the last code commit `be098c7`.
- **The remaining dependencies:**
  - API tests need `bash ops/scripts/test-db.sh up`;
  - nothing native has run since WO-018 (the backlog: 59 rows);
  - open contract items: W21-02 (the Seller inbox on a phone), W20-07 (the Order line shape), and four
    Chat decisions.
- **The recommended next work orders:**
  1. **WO-019, native verification** of the WO-018 to WO-022 backlog, on a machine with free memory:
     close the game and stop `nac-trial`;
  2. **WO-023, Seller Companion Order awareness.**

## Storage (DEVELOPMENT-STORAGE-POLICY)

Audits are in `G:\AdulisDevelopment\WO-INFRA-CLOSURE\logs\storage-audit-*.log`.

1. **Start** (11:17Z): C: 28,590,014,464 bytes free; G: 3,352,768,282,624.
2. **Before cleanup:** C: 28,237,283,328; G: 3,351,334,879,232.
3. **After cleanup:** C: 28,204,449,792; G: 3,352,612,044,800.
4. **Net growth:**
   - C: free fell by 385,564,672 bytes. Docker's data disk was unchanged at 49.84 GB, and the page file
     unchanged at 22.90 GB; the rest is system and application activity during the batch.
   - G: free fell by 156,237,824 bytes.
5. **Generated:** 86,692,266 bytes apparent in `G:\AdulisDevelopment\WO-INFRA-CLOSURE`: logs (including
   the CI logs), the development-database recovery point (724,402 bytes), the repair-rehearsal archive
   and dumps, and scratch scripts.
6. **Removed:**
   - **On G:** the batch's TEMP files (382 files, 11,775,807 bytes: the Jest cache and fake-SMS logs);
     the candidate's worktree (10,931,206 bytes apparent);
   - **in Docker:** every disposable container (`adulis-test-*`, `infra-repair-pg`), plus the anonymous
     volumes they left, each confirmed unused. The volume count is back to 26.
7. **Recovered:** 0 bytes on C:. Space freed inside Docker's disk does not return to C:.
8. **Protected:** untouched:
   - the live `adulis-postgres`, `adulis-minio`, `adulis-pgdata`, `adulis-platform_adulis-pgdata`;
   - the `nac-trial-*` stack;
   - every earlier backup on G: (`WO-INFRA\backup`, `WO-INFRA-FOLLOWUP\backup` and `legacy-db`);
   - the shared caches, and the native build copies.
9. **Concerns:**
   - RAM ended at 627.6 MB free (a game, Docker and VS Code running).
   - Docker's disk is 49.84 GB, with 21.43 GB of reclaimable build cache.
   - Both are review items for the founder; see `WO-INFRA-014-FINAL-AUDIT.md`, section 6.
