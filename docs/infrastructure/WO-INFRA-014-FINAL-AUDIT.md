# WO-INFRA-014 -- Final audit (and the work-order report)

**Status of the work order: COMPLETE.**
- Both independent reviews ran, and every finding is fixed or recorded.
- The registers are updated, final CI ran on both branches, and the environment and the mobile baseline
  are assessed.

13 November 2026.

## 1. Work order
WO-INFRA-014, final infrastructure audit and Mobile development handoff (P1).

## 2. Independent review (task 1)

**What was reviewed:**
- **The diff:** `git diff 149924c..HEAD`, code only.
- **The reviewers:** two read-only reviews, each given the diff and the rules, not my conclusions.
  - **PR Review Toolkit `code-reviewer`:** data safety, environment isolation, security, the Jest
    lifecycle, the repair SQL.
  - **PR Review Toolkit `silent-failure-hunter`:** fail-open paths, exit codes, swallowed errors.
- **Security Guidance:** covered by the reviewers' security sections and the secret scan of the
  added lines.
- **Maintainability:** Ponytail applied in writing (the smallest change, no new dependency).
- **The GitHub plugin:** failed to connect again (ISSUE-INFRA-010); `gh` was used.

| Finding | Reviewer(s) | Severity | Verified | Outcome |
|---|---|---|---|---|
| The repair deleted `core.device` under replica, so a referrer not in its hand-written list (for example `core.fyp_session`, migration 0055) would be orphaned and the script would still commit | both | high | yes, by reading: `fyp_session.device_id ... ON DELETE CASCADE`. The development database is at 0053 (no `fyp_session` there), but the hand list was the flaw | **fixed:** parent rows deleted with triggers on (a reference raises or cascades); replica only around the two append-only tables; step 4 checks **every** key whose child or parent is one of the five tables, from `pg_constraint`. Proven with an injected unforeseen referrer (section 4) |
| The Jest guard read the mark through `DATABASE_URL_MIGRATE` only; a URL without a port resolved through `PGPORT` to another server while the text check assumed 5432; the `localhost` rewrite hid `::1` | code review | high | yes, by reading pg's parameter resolution | **fixed:** the mark is read through **every** URL set; an explicit port is required; no `localhost` rewrite (`localhost` beside `127.0.0.1` is refused as ambiguous) |
| The gate check read only `DATABASE_URL_MIGRATE`, while `console-e2e` starts the API with `DATABASE_URL`: `--only console-e2e` with a split configuration would write to the development database | both | high | yes: a live proof with that split configuration (section 4) | **fixed:** `assert-disposable-db.mjs` applies the same rules (set, not empty, loopback, explicit port, no query override) and reads the mark through every URL |
| An empty `DATABASE_URL_JOBS` read as "unset"; `??` passes `''` on to libpq's defaults | silent-failure | medium | by reading `jobs-harness.ts` | **fixed:** an empty URL is refused (guard and gate check) |
| `db-loads.mjs` ran its replica cleanup even when the mark check never ran (a connection error) | silent-failure | medium | by reading | **fixed:** cleanup only after the check passed; stale header corrected |
| The audit could be blinded by row-level security under a non-owner role and still print PASS | silent-failure | medium (speculative) | by reading the policies | **fixed:** the session sets `row_security=off`, so the policy raises an error, which exits 2 |
| The known-leak lookup used `in` (prototype chain) and bare constraint names (unique per table, not per database) | both | low | yes | **fixed:** `Object.hasOwn`, keys `schema.table.constraint`; tests for the other-schema and `constructor` cases |
| The teardown reported "orphans" for any non-zero exit | silent-failure | low | yes | **fixed:** status 1 means orphans; anything else means "could not run", with the signal |
| `test-db.sh` marked the database before MinIO was ready; a failed `up` left containers; `down` claimed success regardless | both | low | yes | **fixed:** the mark is the last step; an ERR trap removes the run's containers; `down` checks |
| The runner said "not marked" when the check could not connect | silent-failure | low | yes | **fixed:** separate messages for exit 1 and exit 2 |
| The wrong comment "the jobs suites fall back to DATABASE_URL" | both | low | yes (the harness throws) | **fixed** |
| The object store is not guarded | both | medium (scope) | -- | **recorded:** ISSUE-INFRA-CLOSURE-006 |
| Known leaks are tolerated at any count | silent-failure | -- | -- | **recorded:** by design, ISSUE-INFRA-CLOSURE-004 |

**Confirmed sound by both reviewers:**
- A Jest 30 `globalSetup` or `globalTeardown` throw exits 1, and pnpm and CI propagate it.
- The fk-audit SQL: composite pairing, MATCH SIMPLE, partitions, and an empty enumeration fails.
- URL parsing is identical in the guard and in pg.
- `db:reset` drops schemas, not the database, so CI's mark survives.
- The repair is transactional, its counts are exact, and replica is scoped to the transaction.
- No application file changed.

## 3. Outstanding issues revisited (task 2)
**Classification:** `WO-INFRA-014-REMAINING-RISKS.md`.

**Registers updated with dated notes; nothing deleted:**
- the first batch's: 001, 005, 010, 012;
- the follow-up's: 002, 004, 005, 006;
- the closure register: 12 issues, plus this audit.

## 4. Verification after the review fixes
**Evidence:** `logs/reverify-after-review.log`. All on disposable copies; the development database was
read only, and its per-table counts were identical before and after.

| Check | Result |
|---|---|
| `test-db.sh up` (the mark set last, ERR trap) | ready |
| Guard spec, plus the teardown audit, on the disposable database | 21 of 21 tests; `PASS all 201 foreign keys hold`; Jest exit 0 |
| Split configuration: `DATABASE_URL` the development database, `DATABASE_URL_MIGRATE` disposable | the gate check **refuses**: "DATABASE_URL reaches database adulis, which is not marked disposable" (exit 1) |
| `gates.mjs --only migrate` with the root `.env` | **refused before anything ran** ("nothing was run") |
| Revised repair, 5a: an injected table referencing an orphaned device (not in the script's referrer list) | **raises** `violates foreign key constraint "zz_dev_ref_device_id_fkey"`; rolled back, with all 15 devices and 155 attempts still present |
| Revised repair, 5b: the clean run | `COMMIT`; the five constraints re-added (exit 0); the repaired dump restores with `--exit-on-error` (exit 0); `PASS all 175 foreign keys hold` |
| Unit tests | `fk-audit` 3, `gate-runner` 16, `minio-migrate` 11 (30 in all); the guard spec 21 |

## 5. CI (task 3)
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

## 6. Environment (task 4)
Measured at 11:53Z (`logs/environment-assessment.log`):

| | |
|---|---|
| RAM | 15.7 GB, **1.98 GB free**: WSL/Docker VM 1.26 GB, a game 834 MB, Node 759 MB, VS Code about 1 GB |
| C: | 28,248,940,544 bytes free |
| G: | 3,351,387,308,032 bytes free |
| Docker data disk | `docker_data.vhdx` 53,520,367,616 bytes (49.84 GiB) |
| Docker usage | images 15.6 GB (8.1 GB reclaimable); build cache **28.18 GB (21.43 GB reclaimable)**; local volumes 2.85 GB (1.49 GB reclaimable: dangling volumes of other projects, **not** this batch's) |
| Active containers | adulis 2, nac-trial 5: about 0.8 GB together |
| `.wslconfig` | none (WSL2's default memory limit) |

**Interference with native Android testing:** yes, likely. The emulator needs 2 to 4 GB and only about
2 GB is free; WO-018 recorded failures with a game running.

**Safe recommendations** (none performed):
1. **Free memory:** close the game, and stop the `nac-trial` stack. Stopping deletes nothing.
2. **Build cache:** `docker builder prune` reclaims about 21 GB of build cache **only**. It touches no
   image, container or volume.
3. **Disk space:** compacting the Docker disk (Docker Desktop, "Clean up", or `Optimize-VHD` with
   Docker stopped) returns the freed space to C:.
4. **Never:** `docker system prune --volumes` or a volume prune. The "reclaimable" volumes include
   other projects' data, and `adulis-pgdata` is unreferenced by a running container only because MinIO
   uses it today.

## 7. Mobile baseline (task 5)
`WO-INFRA-014-MOBILE-READINESS.md`: start from `infra/wo-infra-010-014-closure`. The next work orders
are WO-019 (native verification), then WO-023 (Seller Companion Order awareness).

## 8. Readiness, separately (task 6)

| Category | Verdict | Basis |
|---|---|---|
| **Development readiness** | **Ready** | the closure branch is green with all suites; the guards make local testing safe; no mobile code changed |
| **Local infrastructure readiness** | **Ready, with two approval-gated steps** | PostgreSQL and MinIO run (MinIO on the old volume); `test-db.sh` gives a CI-equivalent test environment. The MinIO move and the development-database repair are prepared but not approved |
| **CI readiness** | **Ready** | 32 gates run and pass on both lines; Node 24 actions; the scope fail-safe; the test-database guard; the teardown audit |
| **Integration readiness** | **Ready for the founder's decision** | PR #105 `MERGEABLE`, green on its merge commit; one mechanical conflict expected later, when merging the closure line |
| **Mobile release readiness** | **Not ready** | no native Android or iOS validation since WO-018 (`MOBILE-NATIVE-VALIDATION-BACKLOG.md`); open contract items W21-02 and W20-07 |
| **Production readiness** | **Not verified** | production's existence, deployment, monitoring, backups and recovery are unknown (ISSUE-INFRA-017) |

## 9. Final status
**COMPLETE.** The approval-gated operations are not counted as complete. They are BLOCKED:
- the merge (WO-INFRA-010);
- the live MinIO move (WO-INFRA-011);
- the development-database repair (WO-INFRA-013).
