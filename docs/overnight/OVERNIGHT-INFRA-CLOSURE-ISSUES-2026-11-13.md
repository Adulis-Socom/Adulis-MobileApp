# Infrastructure closure issue register -- 13 November 2026 (WO-INFRA-010 to 014)

New material issues of the closure batch. The earlier registers stay as they are, with dated status
notes added where an issue changed:
- `OVERNIGHT-INFRA-ISSUES-2026-11-13.md`;
- `OVERNIGHT-INFRA-FOLLOWUP-ISSUES-2026-11-13.md`.

Evidence paths are under `G:\AdulisDevelopment\WO-INFRA-CLOSURE\` unless stated.

## Summary

| Issue | WO | Severity | Status | Title | Founder decision |
|---|---|---|---|---|---|
| ISSUE-INFRA-CLOSURE-001 | 011 | P2 | RESOLVED | Docker Desktop's backend had exited before the batch | No |
| ISSUE-INFRA-CLOSURE-002 | 010 | P0 | BLOCKED | Merging the infrastructure candidate into `main` | YES |
| ISSUE-INFRA-CLOSURE-003 | 011 | P0 | BLOCKED | The live MinIO cutover | YES |
| ISSUE-INFRA-CLOSURE-004 | 012 | P2 | OPEN (ratcheted) | Five teardown leak classes in 24 API suites | YES (schedule the fix) |
| ISSUE-INFRA-CLOSURE-005 | 012 | P1 | RESOLVED | The API suites defaulted to the persistent development database | No |
| ISSUE-INFRA-CLOSURE-006 | 012 | P2 | OPEN | Locally the suites write into the live MinIO | YES (small) |
| ISSUE-INFRA-CLOSURE-007 | 012 | P1 | RESOLVED | The load tests (a million rows, triggers off) defaulted to the development database | No |
| ISSUE-INFRA-CLOSURE-008 | 012 | P1 | RESOLVED | `pnpm ci:local` migrated and seeded the development database before any guard | No |
| ISSUE-INFRA-CLOSURE-009 | 012 | P2 | RESOLVED | The first `fk-integrity` gate was vacuous (my own) | No |
| ISSUE-INFRA-CLOSURE-010 | 012 | P3 | RESOLVED | `test-db.sh`: no queue schema; a leaked volume per cycle (my own) | No |
| ISSUE-INFRA-CLOSURE-011 | 013 | P1 | BLOCKED | Repairing the development database's 192 orphaned rows | YES |
| ISSUE-INFRA-CLOSURE-012 | 010/011 | P2 | OPEN | The Work checkout: unpreserved local work, no `MINIO_HOST_PORT` | YES |

## MORNING REVIEW -- FOUNDER ACTIONS REQUIRED
See `OVERNIGHT-INFRA-CLOSURE-HANDOFF-2026-11-13.md`, section I.

---

## ISSUE-INFRA-CLOSURE-001 -- Docker Desktop's backend had exited before the batch
- **Work order:** WO-INFRA-011
- **Severity:** P2
- **Status:** RESOLVED
- **Description:** at the batch's start the Docker engine pipe was missing.
- **Expected behavior:** Docker Desktop running, as at the end of the previous batch (about 08:20Z).
- **Actual behavior:** `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`.
- **Root cause:** Docker Desktop's log: `backend process exited: exit status 1` at 2026-11-13T09:10:36Z,
  right after a `softwareUpdate` analytics event. No reboot (last boot 2026-11-12T03:02:52Z). A crash,
  not a deliberate quit.
- **Affected files:** none.
- **Actions attempted:** started Docker Desktop at 11:16:44Z.
- **Evidence:** the log tail (session); the containers' `StartedAt` of 11:17:00Z.
- **Verification results:**
  - `adulis-postgres` and `adulis-minio` came back through their restart policy: healthy, the same
    volumes, 26 volumes in total;
  - the `nac-trial` stack came back likewise.
- **Remaining risks:** an update may crash it again. Nothing was lost.
- **Founder decision required:** No.
- **Recommended next action:** let Docker Desktop finish its update when convenient.

## ISSUE-INFRA-CLOSURE-002 -- Merging the infrastructure candidate into `main`
- **Work order:** WO-INFRA-010
- **Severity:** P0
- **Status:** BLOCKED
- **Description:** `infra/main-integration-candidate` is ready, and draft PR #105 is open.
- **Expected behavior:** a merge only with explicit founder approval.
- **Actual behavior:** not merged; the PR is a draft marked "do not merge".
- **Root cause:** no approval exists (by design).
- **Affected files:** the candidate's code files (`WO-INFRA-010-INTEGRATION-AUDIT.md`, section 3).
- **Actions attempted:** dry-run merges; the PR's merge-result CI runs (`WO-INFRA-014-FINAL-AUDIT.md`).
- **Evidence:** PR #105 `MERGEABLE`; green merge-result runs.
- **Verification results:** all gates on the merge commit.
- **Remaining risks:** `main` stays without these fixes, and its CI stays untrustworthy, until the
  merge.
- **Founder decision required:** YES.
- **Recommended next action:** approve and merge (a merge commit, not squash), then follow
  `WO-INFRA-010-POST-MERGE-VERIFICATION.md`.

## ISSUE-INFRA-CLOSURE-003 -- The live MinIO cutover
- **Work order:** WO-INFRA-011
- **Severity:** P0
- **Status:** BLOCKED
- **Description:** the objects are still in `adulis-pgdata` (ISSUE-INFRA-001).
- **Expected behavior:** the cutover only with a separate approval.
- **Actual behavior:** not run.
- **Root cause:** no approval.
- **Affected files:** none.
- **Actions attempted:** the read-only `plan` (PLAN OK); rollback prerequisites checked.
- **Evidence:** `logs/wo011-preflight.log`.
- **Verification results:** 1,568 / 7 objects; the target is absent; the image and its archive are
  intact.
- **Remaining risks:** compose with the new file starts MinIO empty until the move runs.
- **Founder decision required:** YES.
- **Recommended next action:** after the merge, run `WO-INFRA-011-MIGRATION-EXECUTION.md` from the
  checkout that owns the stack.

## ISSUE-INFRA-CLOSURE-004 -- Five teardown leak classes in 24 API suites
- **Work order:** WO-INFRA-012
- **Severity:** P2
- **Status:** OPEN (ratcheted)
- **Description:** one full API run on a fresh database leaves 35 orphans on five keys:
  - otp attempts 23;
  - notifications 4;
  - claim evidence 3;
  - devices 3;
  - transitions 2.
- **Expected behavior:** a teardown removes children before parents.
- **Actual behavior:** parents are deleted under `replica`, which switches foreign keys off.
- **Root cause:** dependency-unaware teardowns. The files:
  - **OTP challenges** (19 files): `c1-onboarding`, `c4-financial`, `c6-accounts`, `disc-002-fyp`,
    `t12-d101-age-declaration`, `t12-d89-invite-claim`, `t13-delivery-layer`,
    `t14-a3-stamped-audience`, `t14-a4-transport-supersession`, `t26-ownership-before-rules`,
    `t5-identity-operator-only`, `t6-closure-survives-block`, `t6-ownership-transfer`,
    `t6-parked-decisions`, `t6-purchase-intent`, `t8-device-bootstrap`, `t8-market-from-device`,
    `wo-009-collections`, `wo-api-001a-auth-security`;
  - **orders** (8 files): `c6-accounts`, `c7-chat-claims`, `t6-closure-survives-block`,
    `t6-ownership-transfer`, `t6-parked-decisions`, `t7-deferred-nullability`, `t7-rulings`,
    `wo-006-seller-profile`;
  - **claims:** `t6-closure-survives-block`;
  - **the fixture market:** `c6-accounts`;
  - **fixture accounts:** `t26-ownership-before-rules`, `disc-001-scenes`.
- **Affected files:** the above (test only).
- **Actions attempted:**
  - not rewritten (the work order excludes an unrestricted rewrite);
  - the API run's teardown audit fails on any new leaking key;
  - the five are named in `ops/scripts/fk-audit.mjs`.
- **Evidence:** `logs/api-suite-disposable-run2.log`, `-run3`, `-run4` (identical counts);
  `logs/leak-sources-static.log`.
- **Verification results:** a ratchet proof: an injected unknown-key orphan fails the run.
- **Remaining risks:**
  - leaks within the five keys can grow unnoticed;
  - persistent databases would accumulate them, but the suites now refuse persistent databases.
- **Founder decision required:** YES (schedule a test-maintenance work order).
- **Recommended next action:** fix each teardown by deleting the children first, removing each key from
  `KNOWN_TEST_LEAKS` as it becomes clean.

## ISSUE-INFRA-CLOSURE-005 -- The API suites defaulted to the persistent development database
- **Work order:** WO-INFRA-012
- **Severity:** P1
- **Status:** RESOLVED
- **Description:** `apps/api` test loads the root `.env` (persistent database); there was no guard.
  An unset URL fell back to libpq's defaults (another local server).
- **Expected behavior:** the suites touch only a disposable database.
- **Actual behavior:** they ran against `127.0.0.1:5434/adulis` and left 192 orphans
  (ISSUE-INFRA-FOLLOWUP-005).
- **Root cause:** the default environment, with no target check.
- **Affected files:** `apps/api/jest.config.js`, `apps/api/test/db-target.ts`, `global-setup.ts`,
  `.github/workflows/ci.yml`, `ops/scripts/test-db.sh`.
- **Actions attempted:** the disposable mark, the globalSetup guard, the CI step, and the local
  disposable environment.
- **Evidence:** `logs/guard-refuses-devdb.log`; 17 guard tests; CI runs.
- **Verification results:** refused with the root `.env`; the development database unchanged; the
  full suite passes on the disposable database.
- **Remaining risks:** ISSUE-INFRA-CLOSURE-006.
- **Founder decision required:** No.
- **Recommended next action:** none.

## ISSUE-INFRA-CLOSURE-006 -- Locally the suites write into the live MinIO
- **Work order:** WO-INFRA-012
- **Severity:** P2
- **Status:** OPEN
- **Description:** the root `.env` sets `R2_ACCOUNT_ID=http://localhost:9100`, which is the live
  development MinIO. Suites that store media would write there.
- **Expected behavior:** a disposable object store too.
- **Actual behavior:** `test-db.sh env` points `R2_*` at a disposable MinIO (59000), but nothing
  enforces it.
- **Root cause:** the guard covers databases only, which is this work order's scope.
- **Affected files:** none changed.
- **Actions attempted:** `test-db.sh` starts and exports a disposable MinIO.
- **Evidence:** `ops/scripts/test-db.sh`.
- **Verification results:** the full suite passes with the disposable MinIO.
- **Remaining risks:** a developer who sets only the database variables would write test objects into
  the live MinIO.
- **Founder decision required:** YES (small).
- **Recommended next action:** extend the globalSetup guard to refuse the live MinIO's endpoint, or
  require a marker object in the bucket.

## ISSUE-INFRA-CLOSURE-007 -- The load tests (a million rows, triggers off) defaulted to the development database
- **Work order:** WO-INFRA-012
- **Severity:** P1
- **Status:** RESOLVED
- **Description:** `ops/load/db-loads.mjs` inserts about a million synthetic orders under `replica`, and
  `test:load` seeds hundreds of fixtures. Both read the root `.env`.
- **Expected behavior:** refuse a persistent database.
- **Actual behavior:** no check existed.
- **Root cause:** the same default environment.
- **Affected files:** `ops/load/db-loads.mjs`, `apps/api/jest.load.config.js`.
- **Actions attempted:** a mark check before the first write; the shared globalSetup.
- **Evidence:** `logs/load-guards-refuse.log`.
- **Verification results:** both refuse the development database; it is unchanged.
- **Remaining risks:** none known.
- **Founder decision required:** No.
- **Recommended next action:** none.

## ISSUE-INFRA-CLOSURE-008 -- `pnpm ci:local` migrated and seeded the development database before any guard
- **Work order:** WO-INFRA-012
- **Severity:** P1
- **Status:** RESOLVED
- **Description:**
  - gate `migrate` (migrations and the seed) runs before `test`;
  - locally, with the root `.env`, it would apply this branch's migrations 0054 to 0062 and the seed to
    the development database (at 0053);
  - `determinism` creates and drops databases on the same server;
  - `console-e2e` runs `pnpm db:reset`.
- **Expected behavior:** the gates that write refuse a persistent database.
- **Actual behavior:** only the Jest guard existed, and it runs after `migrate`.
- **Root cause:** the gate order.
- **Affected files:** `ops/scripts/gates.mjs`, `ops/scripts/assert-disposable-db.mjs`,
  `ops/scripts/gates.test.mjs`.
- **Actions attempted:** the runner checks the mark before the first of the five writing gates.
- **Evidence:** `logs/gates-refuse-devdb.log`.
- **Verification results:** refused; still 53 migrations; two regression tests.
- **Remaining risks:** none known.
- **Founder decision required:** No.
- **Recommended next action:** none.

## ISSUE-INFRA-CLOSURE-009 -- The first `fk-integrity` gate was vacuous (my own)
- **Work order:** WO-INFRA-012
- **Severity:** P2
- **Status:** RESOLVED
- **Description:** appended at the end of the list, the audit ran after `console-e2e`'s `pnpm db:reset`.
  CI reported "201 keys hold" while every local run left 35 orphans.
- **Expected behavior:** the audit sees the suites' residue.
- **Actual behavior:** it saw a freshly reset database.
- **Root cause:** the gate list is append-only, and `console-e2e` sits before its end.
- **Affected files:** `apps/api/test/global-teardown.ts`, `apps/api/jest.config.js`,
  `ops/scripts/gates.mjs`.
- **Actions attempted:**
  - the audit moved into the API run's `globalTeardown`, inside `test`;
  - the gate now runs only the ratchet's unit tests, and says so.
- **Evidence:** `logs/teardown-audit-proof.log`; the comparison of CI and local counts.
- **Verification results:** clean run exit 0; an injected orphan fails the run.
- **Remaining risks:** none known.
- **Founder decision required:** No.
- **Recommended next action:** none.

## ISSUE-INFRA-CLOSURE-010 -- `test-db.sh`: no queue schema; a leaked volume per cycle (my own)
- **Work order:** WO-INFRA-012
- **Severity:** P3
- **Status:** RESOLVED
- **Description:**
  - the first local full run failed `worker-runtime` with "permission denied for database": no queue
    schema;
  - each `up`/`down` left an anonymous volume, from the postgres image's `VOLUME`.
- **Expected behavior:** parity with CI, and no leftovers.
- **Actual behavior:** as described.
- **Root cause:** a missing `worker:install`; `docker rm -f` without `-v`.
- **Affected files:** `ops/scripts/test-db.sh`.
- **Actions attempted:** both fixed. The four leaked volumes were confirmed unused (created at this
  batch's container start times) and removed.
- **Evidence:** `logs/api-suite-disposable-run1.log` against `run2`; `logs/test-db-down-volume-check.log`.
- **Verification results:**
  - 1,000 of 1,000 tests pass;
  - volumes went 26 -> 27 -> 26;
  - the total is back to 26.
- **Remaining risks:** none known.
- **Founder decision required:** No.
- **Recommended next action:** none.

## ISSUE-INFRA-CLOSURE-011 -- Repairing the development database's 192 orphaned rows
- **Work order:** WO-INFRA-013
- **Severity:** P1
- **Status:** BLOCKED
- **Description:** 192 rows break five validated foreign keys, all test residue
  (`WO-INFRA-013-DATABASE-INTEGRITY-AUDIT.md`).
- **Expected behavior:** a repair only with approval.
- **Actual behavior:** the procedure is prepared and rehearsed; not run live.
- **Root cause:** ISSUE-INFRA-CLOSURE-005 together with ISSUE-INFRA-CLOSURE-004.
- **Affected files:** `docs/infrastructure/WO-INFRA-013-repair.sql` (the script).
- **Actions attempted:** a recovery point; a rehearsal on a copy (archive, repair, re-add the
  constraints, a clean restore, a refusal on mismatch, rollback).
- **Evidence:** `logs/wo013-*`; `repair-rehearsal\`.
- **Verification results:** all 175 keys hold after the rehearsal; the repaired dump restores with
  `--exit-on-error`.
- **Remaining risks:** until repaired, development-database dumps restore with five keys missing.
- **Founder decision required:** YES.
- **Recommended next action:** approve, then follow `WO-INFRA-013-REPAIR-PLAN.md`.

## ISSUE-INFRA-CLOSURE-012 -- The Work checkout: unpreserved local work, no `MINIO_HOST_PORT`
- **Work order:** WO-INFRA-010 and WO-INFRA-011
- **Severity:** P2
- **Status:** OPEN
- **Description:** `C:\Users\naods\Documents\Work\adulis-platform` holds 40 uncommitted entries,
  including an earlier mobile foundation (MOB-WO-0), on no remote. Its `.env` lacks
  `MINIO_HOST_PORT=9100`.
- **Expected behavior:** local work pushed or stashed before integration, and the port set.
- **Actual behavior:** unchanged (not touched by this batch, as required).
- **Root cause:** --
- **Affected files:** that checkout.
- **Actions attempted:** a read-only inspection; a preservation plan; this checkout's `.env` got the
  port.
- **Evidence:** `WO-INFRA-010-INTEGRATION-AUDIT.md`, section 5.
- **Verification results:** --
- **Remaining risks:** a disk failure or a reset would lose MOB-WO-0.
- **Founder decision required:** YES.
- **Recommended next action:** commit that work to a local branch and push it; add `MINIO_HOST_PORT=9100`
  to its `.env`.
