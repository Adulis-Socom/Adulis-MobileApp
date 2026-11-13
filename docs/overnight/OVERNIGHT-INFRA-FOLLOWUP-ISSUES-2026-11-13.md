# Infrastructure follow-up issue register -- 13 November 2026 (WO-INFRA-007 to 009)

New material issues of the finalization batch. The first batch's register,
`OVERNIGHT-INFRA-ISSUES-2026-11-13.md`, is kept and its entries are updated there when their status
changes. Evidence paths are under `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\` unless stated.

## Summary

| Issue | WO | Severity | Status | Title | Founder decision |
|---|---|---|---|---|---|
| ISSUE-INFRA-FOLLOWUP-001 | 007 | P0 | RESOLVED | The first runbook could report success falsely, lose late writes, and reach PostgreSQL | No |
| ISSUE-INFRA-FOLLOWUP-002 | 007 | P2 | OPEN (guarded) | No `.env` sets `MINIO_HOST_PORT`; compose's default 9000 is held by another project | YES (small) |
| ISSUE-INFRA-FOLLOWUP-003 | 007 | P2 | RESOLVED | Three defects in the new migration script, found by its own rehearsal | No |
| ISSUE-INFRA-FOLLOWUP-004 | 008 | P1 | OPEN | Four of the five listen-first API suites exist only on the mobile line | YES (merge vehicle) |
| ISSUE-INFRA-FOLLOWUP-005 | 008 | P2 | OPEN | The dev database holds foreign-key orphans; its dump restores with 5 constraints missing | YES |
| ISSUE-INFRA-FOLLOWUP-006 | 008 | P1 | RESOLVED (candidate) | `main` fails CI on a calendar time bomb in `c1-onboarding` | YES (keep `810b598` in the candidate) |
| ISSUE-INFRA-FOLLOWUP-007 | 008 | P3 | RESOLVED | A worktree on the exFAT SSD is refused by Git as "dubious ownership" | No |
| ISSUE-INFRA-FOLLOWUP-008 | 009 | P1 | RESOLVED | The independent reviews found fail-open paths in the new migration script | No |
| ISSUE-INFRA-FOLLOWUP-009 | 009 | P3 | RESOLVED | Old MinIO image is unpullable; rollback depends on the local copy | No |

## MORNING REVIEW -- FOUNDER ACTIONS REQUIRED

Kept current in `OVERNIGHT-INFRA-FOLLOWUP-HANDOFF-2026-11-13.md`, section I.

---

## ISSUE-INFRA-FOLLOWUP-001 -- The first runbook could report success falsely, lose late writes, and reach PostgreSQL

- **Work order:** WO-INFRA-007
- **Severity:** P0
- **Status:** RESOLVED
- **Description:** The WO-INFRA-002 runbook had 12 weak points (A1 to A12 in
  `WO-INFRA-007-MIGRATION-SAFETY-REVIEW.md`):
  - success read from terminal output; `mc diff` checks names and sizes only;
  - no write freeze;
  - an unverified backup taken from a running server;
  - `docker compose up -d` of every service, which can recreate PostgreSQL on another port;
  - a hand-set port;
  - a `git checkout` rollback.
- **Root cause:** a hand-run procedure that delegated verification to the reader.
- **Evidence:** the audit table; rehearsals R3 and R4 show differences `mc diff` would not report (R4:
  same size, different bytes).
- **Changes attempted:** `ops/scripts/minio-migrate.mjs` (fail-closed, self-undoing), 8 unit tests, the
  gate `minio-migrate`, and a rewritten runbook.
- **Verification results:**
  - full migration and rollback rehearsed;
  - 10 deliberate failures, all refused, each leaving the old MinIO serving;
  - 12 of 12 mutations killed.
- **Remaining risks:** the live run itself (ISSUE-INFRA-001) has not happened.
- **Recommended action:** approve and run `WO-INFRA-007-CUTOVER-AND-ROLLBACK.md`.
- **Founder decision required:** No for this issue (the move's own approval is ISSUE-INFRA-001).

## ISSUE-INFRA-FOLLOWUP-002 -- No `.env` sets `MINIO_HOST_PORT`; compose's default 9000 is held by another project

- **Work order:** WO-INFRA-007
- **Severity:** P2
- **Status:** OPEN (guarded)
- **Update 13 November (closure batch):** partly done. This checkout's untracked `.env` now has `MINIO_HOST_PORT=9100` (WO-INFRA-011). The Work checkout's still lacks it: ISSUE-INFRA-CLOSURE-012.
- **Description:**
  - **Where 9100 comes from:** the live MinIO runs on 9100, set by a shell variable when the stack was
    started. Neither the Work checkout's `.env` nor this checkout's sets `MINIO_HOST_PORT`, although
    both point the API at `http://localhost:9100`.
  - **What a plain `docker compose up` does:** it publishes MinIO on 9000, which `nac-trial-minio`
    holds, so MinIO would not start.
- **Root cause:** the port override lived in a shell, not in the file the API's settings live in.
- **Evidence:** `logs/live-plan.log` (refused without it); `grep MINIO_HOST_PORT` finds nothing in
  either `.env`.
- **Changes attempted:** the migration script refuses when compose's port differs from the source's.
  `.env` files are local and untracked, so they were not edited.
- **Verification results:** R0b and the live `plan` refuse without the variable and pass with it.
- **Remaining risks:** any other `docker compose up` without the variable (outside the script) still
  fails to start MinIO.
- **Recommended action:** add `MINIO_HOST_PORT=9100` to the `.env` of every checkout that runs the stack.
- **Founder decision required:** YES (small): the founder's local files.

## ISSUE-INFRA-FOLLOWUP-003 -- Three defects in the new migration script, found by its own rehearsal

- **Work order:** WO-INFRA-007
- **Severity:** P2
- **Status:** RESOLVED
- **Description:**
  1. **Backup folder refused on another drive.** Every folder on G: was refused as "inside the
     repository": on Windows, `path.relative` from C: to G: is absolute.
  2. **Wait on the wrong server.** The snapshot server's address was overwritten by the stopped
     source's, and `mc ready` blocks forever on a dead server, so the run hung.
  3. **Leaked volume.** The undo for a compose-created target volume was registered after the compose
     call, so a failed call leaked an empty volume.
- **Root cause:**
  1. a path check written without considering drives;
  2. an object spread in the wrong order, plus an unbounded wait;
  3. the order of registration.
- **Evidence:** `logs/rehearsal-R10.log` (first attempts); the hung process was stopped by hand; its
  undo restored the rehearsal source correctly.
- **Changes attempted:**
  - `insideRepo()` with a unit test;
  - explicit server records and a 90 s bounded wait;
  - undo registered before the call.
- **Verification results:** R10 passes in 63 s; mutation M11 kills the reverted path check.
- **Remaining risks:** none known.
- **Recommended action:** none.
- **Founder decision required:** No.

## ISSUE-INFRA-FOLLOWUP-004 -- Four of the five listen-first API suites exist only on the mobile line

- **Work order:** WO-INFRA-008
- **Severity:** P1
- **Status:** OPEN
- **Update 13 November (closure batch):** still a decision. The merge vehicle for the mobile line is now `infra/wo-infra-010-014-closure`, which supersedes the finalization branch (`WO-INFRA-014-MOBILE-READINESS.md`, section 7).
- **Description:** `1a8c6f7` (WO-INFRA-005) added `app.listen(0, '127.0.0.1')` to five suites. On `main`
  only `t8-device-bootstrap` exists; `cat-001`, `disc-002`, `wo-009-collections` and `wo-sec-001` came
  with the WO-001 to WO-022 line. The integration candidate therefore carries one of the five.
- **Root cause:** the first infrastructure branch was based on WO-022, not on `main`.
- **Evidence:** the modify/delete conflicts when cherry-picking `1a8c6f7` onto `main`
  (`WO-INFRA-008-GIT-RECONCILIATION.md`); `git merge-tree` of the candidate with WO-022 is clean but
  leaves those four suites unfixed.
- **Changes attempted:** none on the mobile branch (it is not this batch's to change). The fix lives in
  both infrastructure branches.
- **Verification results:** the candidate is green without them (they do not exist there). The first
  infrastructure branch, which has all five, was green (983 of 983).
- **Remaining risks:** merging WO-022 itself after the candidate brings back the CI flake F-5 (4
  ECONNRESET per run).
- **Recommended action:** bring the mobile line in by merging `infra/wo-infra-007-009-finalization`
  (WO-022 plus every infrastructure fix), not WO-022 alone.
- **Founder decision required:** YES: the merge vehicle for the mobile line.

## ISSUE-INFRA-FOLLOWUP-005 -- The dev database holds foreign-key orphans; its dump restores with 5 constraints missing

- **Work order:** WO-INFRA-008
- **Severity:** P2
- **Status:** OPEN
- **Update 13 November (closure batch):** the root cause is closed by WO-INFRA-012: the suites, the load tests and the writing gates refuse any unmarked database. The repair of the existing 192 rows is prepared and rehearsed, but BLOCKED pending approval (ISSUE-INFRA-CLOSURE-011).
- **Description:** restoring the first batch's `adulis.dump` (the live development database) fails to
  re-create five foreign keys:
  - `device_market_id_fkey`;
  - `notification_recipient_account_id_fkey`;
  - `claim_evidence_item_claim_id_fkey`;
  - `order_state_transition_order_id_fkey`;
  - `otp_delivery_attempt_otp_challenge_id_fkey`.
  The rows load; the constraints do not.
- **Root cause:** the live dev database already contains rows that violate those constraints, which
  PostgreSQL marks as validated: 15 devices referencing a missing market, 3 notifications referencing
  missing accounts, and others. About 50 API test files clean up with `session_replication_role`, which
  skips foreign-key triggers, and the API tests run against the dev database `adulis` by default, so
  their residue accumulates there.
- **Evidence:** `logs/legacy-current-snapshot-restore.log`; a forced read-only query on the live
  database (`default_transaction_read_only=on`): `orphan device->market 15`, `orphan
  notification->account 3`, all five constraints `convalidated = t`.
- **Changes attempted:** none: the dev data and the test teardowns are not infrastructure, and this
  batch never modifies existing data.
- **Verification results:** the dump itself is complete (the data loads). The legacy database, by
  contrast, is clean (0 unvalidated constraints after restore).
- **Remaining risks:**
  - a restore of the dev database needs the constraints re-added after the orphans are cleaned, or
    added `NOT VALID`;
  - tests that read across those tables may see stale rows.
- **Recommended action:** point the API test run at a disposable database (as the gates do), and clean
  the dev database's orphans in a separate, approved change.
- **Founder decision required:** YES.

## ISSUE-INFRA-FOLLOWUP-006 -- `main` fails CI on a calendar time bomb in `c1-onboarding`

- **Work order:** WO-INFRA-008
- **Severity:** P1
- **Status:** RESOLVED on the candidate, pending the founder's merge decision
- **Update 13 November (closure batch):** unchanged. `810b598` is still in the candidate; the candidate's CI on `main` stays green with it (`WO-INFRA-014-FINAL-AUDIT.md`).
- **Description:** `c1-onboarding.e2e.spec.ts` on `main` stores and expects the override date
  2026-09-11, while the endpoint lists from `CURRENT_DATE`. Since 2026-09-12 the list is empty and the
  test throws `Cannot read properties of undefined (reading 'date')`. `main`'s CI would be red even
  with every infrastructure fix.
- **Root cause:** a fixed date in a test of a date-relative query. It was fixed on the mobile line by
  `810b598` (founder-authored, test only), never on `main`.
- **Evidence:** run 43384239326 (634 of 635, this one failure); run 43385069084 with `810b598`
  cherry-picked: 635 of 635.
- **Changes attempted:** `810b598` cherry-picked (`-x`) onto the candidate as its own commit.
- **Verification results:** green.
- **Remaining risks:** none; the same patch on both sides merges cleanly later.
- **Recommended action:** keep it in the candidate.
- **Founder decision required:** YES (confirm it may travel with an infrastructure merge).

## ISSUE-INFRA-FOLLOWUP-007 -- A worktree on the exFAT SSD is refused by Git as "dubious ownership"

- **Work order:** WO-INFRA-008
- **Severity:** P3
- **Status:** RESOLVED
- **Description:** `git worktree add` to G: succeeded, but every later command failed with "detected
  dubious ownership": exFAT records no owner.
- **Root cause:** Git's `safe.directory` protection on a file system without ownership.
- **Evidence:** the error text in the WO-INFRA-008 session.
- **Changes attempted:** `git -c safe.directory=<that one path>` on each command. The global Git
  configuration was not changed.
- **Verification results:** the cherry-picks and pushes worked.
- **Remaining risks:** none; the same limitation as junctions on G: (first batch).
- **Recommended action:** for worktrees on G:, pass `-c safe.directory` per command.
- **Founder decision required:** No.

## ISSUE-INFRA-FOLLOWUP-008 -- The independent reviews found fail-open paths in the new migration script

- **Work order:** WO-INFRA-009 (review of WO-INFRA-007)
- **Severity:** P1
- **Status:** RESOLVED
- **Description:** two independent, read-only reviews (PR Review Toolkit `code-reviewer` and
  `silent-failure-hunter`), given the diff and the rules but not my conclusions, found:
  - `verify-backup` printed BACKUP OK without comparing hashes when the checksum file had a BOM or a
    leading blank;
  - a stream error during backup or restore crashed Node before the undo, leaving the source stopped;
  - `rollback` could skip the approval (it used the environment's volume, not the run's), could stop
    the restored MinIO on a second run, did not check that the old image and volume still exist, and
    reported success without comparing the restored store;
  - the undo was never verified, and cleanup failures were ignored;
  - smaller probe and logging gaps.
- **Root cause:** my own code: a lenient parser, `pipe()` without error handlers, and a rollback
  written for the happy path.
- **Evidence:** both reviewers reproduced the stream crash and the BOM pass in scratch scripts.
  Findings are listed in `WO-INFRA-009-FINAL-VERIFICATION.md` (section 13).
- **Changes attempted:** see the review-fix commit: strict `recordedSha`, `pipeline()`, a Ctrl+C
  handler, rollback preconditions, a put-back path and a content comparison, a verified undo, guarded
  cleanup, `exists()` that refuses on errors, fail-closed probes, a media-policy action check, and
  owner-only backup files.
- **Verification results:**
  - 11 unit tests (3 new) and 13 `gate-runner` tests;
  - the BOM case refused on the real backup;
  - all three stream-failure kinds reject without crashing (`logs/dockerpipe-error-check.log`);
  - re-rehearsed R15 to R17 (`logs/rehearsal-R15-R17.log`).
- **Remaining risks:**
  - `minio-init.sh`'s lifecycle pattern can still match across two rules. That is a documented
    shortcut, and `migrate` checks the rule set itself.
  - Large multipart objects would be refused by ETag, which is the safe direction.
- **Recommended action:** none.
- **Founder decision required:** No.

## ISSUE-INFRA-FOLLOWUP-009 -- Old MinIO image is unpullable; rollback depends on the local copy

- **Work order:** WO-INFRA-009
- **Severity:** P3
- **Status:** RESOLVED
- **Description:** `rollback` recreates the old container from image `14cea493d9a3` (`minio/minio:latest`,
  RELEASE.2025-09-07), which Docker Hub no longer serves. After the move nothing runs it, so an image
  prune or a Docker Desktop clean-up would delete it and make the rollback impossible.
- **Root cause:** upstream MinIO stopped publishing images (WO-INFRA-003).
- **Evidence:** WO-INFRA-003 (Docker Hub 404); the code review's finding 3.
- **Changes attempted:** `rollback` now refuses before stopping anything if the image is missing. The
  runbook says to save it first.
- **Verification results:** the image was saved, which is non-destructive:
  `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\backup\minio-old-image-14cea493d9a3.tar` (62,259,712 bytes,
  SHA-256 `ff5c117e...`, recorded in `SHA256SUMS.txt` beside it). `docker load -i <file>` restores it.
- **Remaining risks:** none while that file exists.
- **Recommended action:** keep the file until the move is verified and ISSUE-INFRA-005 is decided.
- **Founder decision required:** No.
