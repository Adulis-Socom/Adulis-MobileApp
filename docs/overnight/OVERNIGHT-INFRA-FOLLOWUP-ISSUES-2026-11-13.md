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
