# Overnight infrastructure issues -- 2026-11-13

**Batch:** WO-INFRA-001 to WO-INFRA-006.

**Branch:** `infra/wo-infra-001-006-stabilization`.
- Based on `3cad2e39965657e2580009c424205f3843ad8eca`, the WO-022 head. It already contains all of
  `origin/main` (`01302cf`).
- Pushed, not merged.

**Times:** UTC; the batch ran from 21:45Z on 12 November.

**Logs:** `G:\AdulisDevelopment\WO-INFRA\logs`.

Resolved issues stay in this file. Each entry keeps its original finding, and later updates are added
under it. "Confirmed" means reproduced, or read in a log or file; "suspected" means reasoned but not
reproduced.

## Summary

| Metric | Count |
|---|---|
| Total issues discovered | 27 |
| Resolved | 18 |
| Open | 3 |
| Blocked | 1 |
| Deferred | 2 |
| Needs founder decision | 3 |
| Founder decisions required (all issues marked YES) | 4 |
| P0 unresolved | 1 (ISSUE-INFRA-001: configuration fixed, live data move blocked pending approval) |
| P1 unresolved | 0 |

### After the follow-up batch (WO-INFRA-007 to 009, 13 November)

The counts above are the first batch's, kept as they were. Statuses now:

| Metric | Count |
|---|---|
| Total issues (this register) | 27 |
| Resolved | 21 (+ ISSUE-INFRA-013, 016, 027) |
| Open | 1 (ISSUE-INFRA-010) |
| Blocked | 1 (ISSUE-INFRA-001, the live move only) |
| Deferred | 1 (ISSUE-INFRA-011) |
| Needs founder decision | 3 (ISSUE-INFRA-005 deletion only, 012, 017) |
| P0 unresolved | 1 (ISSUE-INFRA-001: hardened and rehearsed, awaiting approval) |
| P1 unresolved | 0 in this register (see the follow-up register for new ones) |

New issues of the follow-up batch: `OVERNIGHT-INFRA-FOLLOWUP-ISSUES-2026-11-13.md`.

## MORNING REVIEW -- FOUNDER ACTIONS REQUIRED

1. **Approve, or decline, the live MinIO data move (ISSUE-INFRA-001, BLOCKED).**
   - The compose file now gives MinIO its own volume.
   - The existing objects (1,568 media, 7 evidence) stay in the old volume `adulis-pgdata` until
     `docs/infrastructure/WO-INFRA-002-MIGRATION-RUNBOOK.md` is run.
   - The runbook was rehearsed on a copy, with every object identical.
   - Until then, the first `docker compose up` with the new file shows an empty MinIO.
2. **Decide about the old database inside that volume (ISSUE-INFRA-005).**
   - It is a PostgreSQL 17 data directory from before 2026-09-03, about 145 MB. Options: keep, export,
     or discard.
   - Nothing is deleted without this decision.
3. **Reconcile the overlapping CI work before merging (ISSUE-INFRA-012).**
   - Branch `ci/scope-filter-main-push` (`810fb27`) is unmerged.
   - There are uncommitted `ci.yml` edits in `C:\Users\naods\Documents\Work\adulis-platform`.
4. **Production backups (ISSUE-INFRA-017).** Nothing on this machine can confirm that production
   backups exist, or that production exists at all. Confirm, or provide access.
5. **Optional reviews, not blocking:**
   - the MinIO image vendor (Chainguard, pinned by digest);
   - re-authorising the GitHub MCP plugin (ISSUE-INFRA-010);
   - a `cosign` check of the image (ISSUE-INFRA-027);
   - the deferred P3 items (ISSUE-INFRA-011, 013).

**Never run `docker compose down -v` with the new file.** The project name is pinned, so from any clone
it deletes the live database volume (ISSUE-INFRA-026).

---

### ISSUE-INFRA-001 -- MinIO stores its data in the original PostgreSQL volume (AUD-001)

**Work Order:** WO-INFRA-001 (found), WO-INFRA-002 (fix)
**Severity:** P0 | **Category:** Docker | **Status:** BLOCKED (live data move)

**Update 13 November (follow-up batch):** BLOCKED, unchanged. WO-INFRA-007 replaced the hand-run runbook with `ops/scripts/minio-migrate.mjs` (fail-closed, self-undoing), rehearsed with a full move, a rollback and ten deliberate failures. The live move still needs the founder's approval: `WO-INFRA-007-CUTOVER-AND-ROLLBACK.md`.
**Update 13 November (closure batch):** still BLOCKED. The read-only `plan` passed again at 11:29Z (1,568 / 7 objects; the target is absent; the old image and its archive are intact). The live cutover needs a separate approval (ISSUE-INFRA-CLOSURE-003).
**Discovered at:** 2026-11-12T21:58Z
**Affected files:** `docker-compose.yml`

**Description:** the volumes block read `adulis-pgdata:` / `adulis-miniodata:` / `name: adulis-pgdata`.
The explicit name belonged to the MinIO volume, not to PostgreSQL.

**Expected behavior:** PostgreSQL and MinIO each have their own, clearly named physical volume.

**Actual behavior (confirmed at runtime):**
- `adulis-postgres` mounts `adulis-platform_adulis-pgdata` (created 2026-09-03 10:02).
- `adulis-minio` mounts `adulis-pgdata` at `/data`. That volume was created 2026-08-26 and is labelled as
  the compose volume `adulis-pgdata`.
- That volume holds MinIO's buckets side by side with a complete PostgreSQL 17 data directory:
  - `adulis-media`: 19 MB, 1,568 objects;
  - `adulis-evidence`;
  - `.minio.sys`.

**Root cause (confirmed):**
- Commit `2cb0baf` (T20 S4, 2026-09-03) inserted `adulis-miniodata:` between `adulis-pgdata:` and its
  existing `name: adulis-pgdata` line, present since `eb8c8bd`.
- The name moved to MinIO, and PostgreSQL silently got a new, project-prefixed, empty volume.

**Evidence:**
- `git log -p -- docker-compose.yml`;
- `docker inspect adulis-postgres|adulis-minio` mounts;
- `docker exec adulis-minio ls -la /data`.

**Actions attempted:**
- Read-only inspection.
- A backup of the volume on the SSD (`G:\AdulisDevelopment\WO-INFRA\backup`, checksummed).
- Disposable validation and a rehearsal of the move.

**Changes made:** `ba74372`:
- explicit volume names `adulis-platform_adulis-pgdata` (unchanged) and `adulis-platform_adulis-miniodata` (new);
- `name: adulis-platform`.

**Verification:**
- Compose validation on a disposable project: 18 of 18.
- Migration rehearsal on a restored copy: 15 of 15, `mc diff` empty.
- No live container was recreated.

**Remaining risk:** the live objects still sit in `adulis-pgdata`; MinIO starts empty with the new file
until the runbook runs (risk R-11).

**Founder decision required:** YES: approve the live move.

**Recommended next action:** run `WO-INFRA-002-MIGRATION-RUNBOOK.md` once approved.

**Dependency impact:** ISSUE-INFRA-005.

**Update 2026-11-12T22:28Z:** configuration RESOLVED. The live move is BLOCKED by the safety rule, so
the overall status is BLOCKED.

### ISSUE-INFRA-002 -- MinIO images no longer pullable from Docker Hub or quay.io (AUD-002)

**Work Order:** WO-INFRA-001, WO-INFRA-003
**Severity:** P0 | **Category:** CI / Docker | **Status:** RESOLVED
**Discovered at:** 2026-11-12T22:02Z
**Affected files:** `.github/workflows/ci.yml`, `docker-compose.yml`

**Description:** CI's "Start object storage" step failed on `minio/minio:latest` ("pull access denied"),
so the gate step was skipped on every run.

**Root cause (confirmed):**
- `hub.docker.com/v2/repositories/minio/minio/` answers 404, and `quay.io/api/v1/repository/minio/minio`
  answers 401.
- Manifest lookups for `minio/minio` and `minio/mc` were denied on both registries, for `latest` and for
  the pinned RELEASE tags. Control images resolve.
- This machine still has the old image cached, which hid the problem locally.

**Evidence:** `logs/image-availability.txt`; 40 failed runs from 42501689869 to 43301469942.

**Changes made:** `3b9bbc6`:
- `cgr.dev/chainguard/minio` pinned by digest, in compose and CI;
- the shared `ops/scripts/minio-init.sh`.

**Verification:**
- Disposable image validation: 22 of 22.
- CI 43320430973: the object-storage step succeeded, the first success since 2026-11-08.
- CI 43321921280: all green.

**Remaining risk:** the free tier serves only `latest`; a removed digest would fail CI loudly (R-05).

**Founder decision required:** NO. The vendor choice is offered for review.

**Recommended next action:** verify the signature with `cosign` (ISSUE-INFRA-027).

**Dependency impact:** unblocked every gate.

### ISSUE-INFRA-003 -- `db:seed` refuses inside the gate run in CI (AUD-003)

**Work Order:** WO-INFRA-001, WO-INFRA-004
**Severity:** P0 | **Category:** CI | **Status:** RESOLVED
**Discovered at:** 2026-11-12T21:52Z
**Affected files:** `ops/scripts/gates.mjs`

**Description:** gate `migrate` ran `pnpm db:seed` with no environment. `gates.mjs` drops
`NODE_ENV=development`, CI never sets one, and `seed.mjs` allows only development or test.

**Actual behavior (confirmed):** CI run 34129602933 (main, 2026-09-07) printed
`FAIL refusing to seed with NODE_ENV=unset.` Locally it passed only because `.env` was re-read.

**Root cause (confirmed):** `steps` could not carry an environment.

**Changes made:**
- `bbbadac`: per-step environment; the seed step declares `NODE_ENV=test`.
- `bac327a`: the environment is a default, never an override (ISSUE-INFRA-020).

**Verification:**
- Locally, unset, `production` and `staging` are each refused by `seed.mjs`, and the fixed gate passes
  (`logs/aud-003-seed.log`).
- CI 43320430973 and 43321921280: `migrate` PASS.
- Mutation-tested.

**Remaining risk:** none known. **Founder decision required:** NO.

### ISSUE-INFRA-004 -- Scoped gates select zero packages and still pass (AUD-004)

**Work Order:** WO-INFRA-001, WO-INFRA-004
**Severity:** P1 | **Category:** CI | **Status:** RESOLVED
**Discovered at:** 2026-11-12T21:55Z
**Affected files:** `ops/scripts/gates.mjs`

**Actual behavior (confirmed):** `typecheck`, `build` and `test` printed "No projects matched" and passed:
- on a push to main (run 34129602933);
- on a branch with root-only changes (run 34147378670);
- the console-dist gates then passed as "not selected".

**Root cause (confirmed):** pnpm exits 0 on an empty selection, and root files belong to the excluded
root project.

**Changes made:**
- `bbbadac`: the scope fail-safe, and the `gate-runner` gate.
- `bac327a`: hardening from review (ISSUE-INFRA-019, 022).

**Verification:**
- CI banner: `scope: UNSCOPED - 28 changed root input(s)`.
- CI 43321921280 ran all 30 gates, with no "No projects matched".
- 13 tests; 10 of 10 mutations killed.

**Remaining risk:** `810fb27` overlaps the same area (ISSUE-INFRA-012). **Founder decision required:** NO.

### ISSUE-INFRA-005 -- An orphaned PostgreSQL 17 data directory sits inside MinIO's volume

**Work Order:** WO-INFRA-001 | **Severity:** P2 | **Category:** Docker / Database
**Status:** NEEDS FOUNDER DECISION

**Update 13 November (follow-up batch):** NEEDS FOUNDER DECISION, now only about deleting the volume. WO-INFRA-008 recovered the directory from the backup copy (clean shutdown 2026-09-03 10:02:39): migrations 0001-0048 plus the seed fixture, nothing unique. Archived on the SSD with checksums and restore-tested (`WO-INFRA-008-LEGACY-DATABASE-ARCHIVE.md`). The volume is untouched.
**Update 13 November (closure batch):** unchanged: the deletion decision only. The volume was untouched again.
**Discovered at:** 2026-11-12T22:00Z
**Affected files:** Docker volume `adulis-pgdata`

**Description:** the pre-2026-09-03 development database (about 145 MB: `base` 63 MB, `pg_wal` 81 MB) is
in the volume MinIO uses. MinIO lists its 17 top-level directories as empty buckets, and has written
bucket metadata for them.

**Evidence:** `docker exec adulis-minio mc ls local`; the backup tar lists `.minio.sys/buckets/pg_*`.

**Changes made:** none, by design. A backup is on the SSD.

**Remaining risk:**
- `mc rb` on a phantom bucket deletes PostgreSQL files.
- Deleting the "old postgres volume" deletes every MinIO object.

**Founder decision required:** YES: keep, export (`pg_dump` from a throwaway container), or discard.

**Recommended next action:** decide after the MinIO move.

### ISSUE-INFRA-006 -- The running stack belongs to a different checkout

**Work Order:** WO-INFRA-001, WO-INFRA-002 | **Severity:** P3 | **Category:** Environment
**Status:** RESOLVED
**Discovered at:** 2026-11-12T22:01Z

**Description:**
- The live stack was created from `C:\Users\naods\Documents\Work\adulis-platform` (project
  `adulis-platform`).
- That checkout is on `ci/scope-filter-main-push` with uncommitted changes; it was not touched.
- Compose run from this checkout would have been project `adulis-mobileapp`: a name clash, and an
  empty database volume.

**Changes made:** `ba74372` pins `name: adulis-platform`.

**Verification:** `docker compose config` resolves `name: adulis-platform`.

**Founder decision required:** NO.

### ISSUE-INFRA-007 -- `minio-init` added a duplicate lifecycle rule on every run

**Work Order:** WO-INFRA-001, WO-INFRA-003 | **Severity:** P3 | **Category:** Docker
**Status:** RESOLVED
**Discovered at:** 2026-11-12T22:01Z

**Evidence:** three identical `evidence/raw/` rules on the live evidence bucket.

**Changes made:**
- `3b9bbc6`: add only when missing.
- `bac327a`: require an enabled 1-day rule.

**Verification:**
- Exactly one rule after three init runs.
- With only a 30-day rule present, the init adds the 1-day backstop (`logs/minio-init-wrong-rule.log`).

**Remaining risk:** the three duplicate rules on the LIVE bucket stay until the move (harmless).

**Founder decision required:** NO.

### ISSUE-INFRA-008 -- The init chains ended in `|| true`, which hid a failed bucket setup

**Work Order:** WO-INFRA-001, WO-INFRA-003 | **Severity:** P2 | **Category:** CI / Security
**Status:** RESOLVED
**Discovered at:** 2026-11-12T22:05Z

**Root cause:** shell precedence (`a && b || c`).

**Changes made:** `3b9bbc6`, `set -eu` in the shared script; the evidence bucket is set private on every
run.

**Verification:** the init exits non-zero when MinIO is unreachable (validation check 22).

**Founder decision required:** NO.

### ISSUE-INFRA-009 -- No CI gate had run since 2026-11-08; main red since 2026-09-04

**Work Order:** WO-INFRA-001, WO-INFRA-005 | **Severity:** P1 | **Category:** CI | **Status:** RESOLVED
**Discovered at:** 2026-11-12T21:50Z

**Description:** the last green run was 33853008715 (2026-09-04). The WO-001 to WO-022 branches carry no
CI gate evidence.

**Verification:** CI 43321921280 (`1a8c6f7`) is green with all 30 gates:
- API 983 of 983;
- mobile 520 of 520;
- `console-e2e` 88 tests.

**Remaining risk:** main itself has not run yet; the branch is not merged.

**Founder decision required:** NO.

### ISSUE-INFRA-010 -- GitHub MCP plugin did not connect

**Work Order:** WO-INFRA-001 | **Severity:** P3 | **Category:** Other (tooling) | **Status:** OPEN

**Update 13 November (follow-up batch):** OPEN, unchanged: the plugin still fails ("Authorization header is badly formatted"). `gh` was used. Founder action: re-authorise with `/mcp`.
**Update 13 November (closure batch):** still OPEN. This session's start again reported the GitHub plugin failing ("Authorization header is badly formatted"); `gh` was used, including to open draft PR #105.
**Discovered at:** 2026-11-12T21:45Z

**Description:** "Authorization header is badly formatted" at session start. The authenticated `gh` CLI
was used instead.

**Recommended next action:** re-authorise via `/mcp`. **Founder decision required:** NO.

### ISSUE-INFRA-011 -- `pgvector/pgvector:pg17` is a moving tag

**Work Order:** WO-INFRA-001 | **Severity:** P3 | **Category:** Docker | **Status:** DEFERRED

**Update 13 November (follow-up batch):** DEFERRED, re-checked. Pinning `pgvector/pgvector:pg17` by digest would make the next `docker compose up` recreate `adulis-postgres` (same volume, a restart), and it would stop security updates arriving. The determinism gate passed in every CI run of both batches. Revisit only if determinism drifts.
**Discovered at:** 2026-11-12T22:04Z

**Description:** the local image is `sha256:cf134a76...`; the tag resolves today to `sha256:7d0a4146...`.

**Recommended next action:** pin by digest only if `db:determinism` starts to differ. It passed both
locally and in CI. **Founder decision required:** NO.

### ISSUE-INFRA-012 -- Unmerged CI fix and uncommitted CI edits exist elsewhere

**Work Order:** WO-INFRA-001 | **Severity:** P3 | **Category:** CI | **Status:** NEEDS FOUNDER DECISION

**Update 13 November (follow-up batch):** NEEDS FOUNDER DECISION, now reconciled. `810fb27` merges clean with both infrastructure branches. The Work checkout's uncommitted `gates.mjs` edit collides only at the end of the gate list. An infrastructure-only candidate on `main` is green. Recommendation: option A (`WO-INFRA-008-MERGE-RECOMMENDATION.md`).
**Update 13 November (closure batch):** draft PR #105 (the candidate into `main`) is open, `MERGEABLE`, and green on its merge commit. The merge is BLOCKED pending approval (ISSUE-INFRA-CLOSURE-002).
**Discovered at:** 2026-11-12T21:56Z

**Description:** this batch's `ci.yml` changes overlap two other pieces of work:
- `origin/ci/scope-filter-main-push` (`810fb27`, which empties the filter on a push to main);
- uncommitted `ci.yml` and `.dependency-cruiser.cjs` edits in the other checkout.

**Remaining risk:** merge conflicts. Both CI approaches can coexist: this batch's fail-safe also covers
main.

**Founder decision required:** YES: the merge order.

### ISSUE-INFRA-013 -- The local media bucket is anonymously listable

**Work Order:** WO-INFRA-003 | **Severity:** P3 | **Category:** Security | **Status:** DEFERRED

**Update 13 November (follow-up batch):** RESOLVED by WO-INFRA-009 (`4b38c78`). The media bucket's anonymous policy is `s3:GetObject` on objects only. Tested: anonymous read OK, list and write denied, evidence private, init idempotent. CI run in `WO-INFRA-009-FINAL-VERIFICATION.md`.
**Discovered at:** 2026-11-12T22:19Z

**Description:** the `download` canned policy grants `s3:ListBucket` as well as `s3:GetObject`. This is
pre-existing: the live official image behaves the same (`mc anonymous get-json`). Cloudflare R2's public
origin does not list, so local and CI are more permissive than production.

**Recommended next action:** a GetObject-only policy through `mc anonymous set-json`, if wanted. Left
unchanged to preserve behaviour. **Founder decision required:** NO.

### ISSUE-INFRA-014 -- The new MinIO image has no `grep`; the first init draft failed open

**Work Order:** WO-INFRA-003 | **Severity:** P2 | **Category:** Docker | **Status:** RESOLVED
**Discovered at:** 2026-11-12T22:19Z

**Description:** found by the disposable validation, before any commit: duplicate rules again (2, then 3).

**Changes made:** a shell `case` match.

**Verification:** validation 22 of 22. **Founder decision required:** NO.

### ISSUE-INFRA-015 -- API suites flake with `read ECONNRESET` in CI (supertest listen race)

**Work Order:** WO-INFRA-005 | **Severity:** P1 | **Category:** Testing | **Status:** RESOLVED
**Discovered at:** 2026-11-12T22:36Z
**Affected files:** five `apps/api/test/*.e2e.spec.ts`

**Actual behavior:** in CI 43320430973, 4 of 983 tests failed with `read ECONNRESET` inside concurrent
bursts (`wo-sec-001` x3, `wo-009` #18). They pass locally.

**Root cause (confirmed):**
- supertest 7.2.2 calls `listen(0)` per request on a server that is not listening, and closes it when
  that request ends; the rest of the burst is reset.
- A standalone reproduction: 94 of 420 staggered requests reset, against 0 of 420 with the server
  listening first.

**Changes made:** `1a8c6f7` adds `await app.listen(0, '127.0.0.1')` after `app.init()` in the five suites
that send concurrent HTTP requests. Test harness only; no assertion changed.

**Verification:** 126 of 126 locally; CI 43321921280 983 of 983.

**Remaining risk:** a new suite that bursts without listening would reintroduce it.

**Founder decision required:** NO. These are backend test files, changed for CI reliability; please
review.

### ISSUE-INFRA-016 -- CI runner moved to Ubuntu 26.04; the Node 20 actions are deprecated

**Work Order:** WO-INFRA-005 | **Severity:** P3 | **Category:** CI | **Status:** OPEN

**Update 13 November (follow-up batch):** RESOLVED by WO-INFRA-009 (`4b38c78`): checkout v7, setup-node v7, pnpm/action-setup v6, all Node 24. CI evidence in `WO-INFRA-009-FINAL-VERIFICATION.md`.
**Discovered at:** 2026-11-12T22:41Z

**Description:** GitHub annotations:
- `actions/checkout@v4`, `setup-node@v4` and `pnpm/action-setup@v4` target Node 20 and are forced onto
  Node 24;
- `ubuntu-latest` is now ubuntu-26.04 (image 20261111.196.1).

Edge, which Playwright and `boot-smoke` use, is present there, and all gates passed.

**Recommended next action:** bump the actions to Node 24 majors in a separate change, and consider
pinning `runs-on`. **Founder decision required:** NO.

### ISSUE-INFRA-017 -- Production environment and backup status cannot be verified

**Work Order:** WO-INFRA-001 | **Severity:** P2 | **Category:** Database / Other
**Status:** NEEDS FOUNDER DECISION

**Update 13 November (follow-up batch):** NEEDS FOUNDER DECISION, unchanged. Nothing in this batch could reach a production environment, and its existence or backups are not assumed.
**Discovered at:** 2026-11-12T22:10Z

**Description:**
- `docker-compose.yml` says production is managed PostgreSQL on Render with point-in-time recovery.
- `ops/render.yaml` has never been applied, and T23 recorded that no Render credentials exist.
- Nothing here shows whether production, or its backups, exist.

**Founder decision required:** YES: confirm status, or provide read access.

### ISSUE-INFRA-018 -- The main guard could make `pnpm gates` run nothing and exit 0

**Work Order:** WO-INFRA-006 (review) | **Severity:** P1 | **Category:** CI | **Status:** RESOLVED
**Discovered at:** 2026-11-12T22:47Z
**Affected files:** `ops/scripts/gates.mjs`

**Description (introduced by `bbbadac`):** `main()` ran only when `argv[1]` equalled the resolved module
path. Through a junction, `subst` drive or symlink the two differ.

**Root cause (confirmed):** through an NTFS junction, `--list` printed 0 lines with the committed guard.

**Changes made:** `bac327a`, `realpathSync` on both sides, and a test that spawns `--list`.

**Verification:** 30 lines through the junction; mutation killed. **Founder decision required:** NO.

### ISSUE-INFRA-019 -- docs/ was exempt from the scope fail-safe, but a suite reads docs/

**Work Order:** WO-INFRA-006 (review) | **Severity:** P1 | **Category:** CI | **Status:** RESOLVED
**Discovered at:** 2026-11-12T22:47Z

**Description:** `apps/api/test/permission-matrix.spec.ts` reads
`docs/amendments/ADU-AUTH-01_v2_4_permission_seed.sql`. A change to that file beside a mobile change would
have skipped the API suite.

**Changes made:** `bac327a`: only Markdown and `.claude/` are exempt; `git diff --no-renames`.

**Verification:** test case added; mutation killed. **Founder decision required:** NO.

### ISSUE-INFRA-020 -- A gate's environment overrode a deliberate NODE_ENV

**Work Order:** WO-INFRA-006 (review) | **Severity:** P2 | **Category:** Security | **Status:** RESOLVED
**Discovered at:** 2026-11-12T22:47Z

**Description:** `{ ...process.env, ...extraEnv }` turned an explicit `NODE_ENV=staging` into `test`.
That would let the seed write its fixture into staging. Introduced for the seed step by `bbbadac`;
pre-existing for `determinism` and `console-e2e`.

**Changes made:** `bac327a`, `gateEnv()` (a default only).

**Verification:** `NODE_ENV=staging` is now refused by the seed guard (`logs/post-review-recheck.log`);
test and mutation. **Founder decision required:** NO.

### ISSUE-INFRA-021 -- `--only <typo>` passed with zero gates

**Work Order:** WO-INFRA-006 (review) | **Severity:** P2 | **Category:** CI | **Status:** RESOLVED

**Description (pre-existing):** an unknown id printed "PASS all 0 gates" and exited 0.

**Changes made:** `bac327a` exits 2.

**Verification:** test; `--only migrat` exits 2. **Founder decision required:** NO.

### ISSUE-INFRA-022 -- The console-dist gates assumed "not selected" whenever any scope was set

**Work Order:** WO-INFRA-006 (review) | **Severity:** P2 | **Category:** CI | **Status:** RESOLVED

**Description (pre-existing):** a scoped run that selected `@adulis/console`, but had no dist, passed.

**Changes made:** `bac327a` checks the selected package names.

**Verification:** covered by the scope tests (`selected`); full runs unaffected.

**Founder decision required:** NO.

### ISSUE-INFRA-023 -- `docker compose up` exits 0 when `minio-init` fails

**Work Order:** WO-INFRA-006 (review) | **Severity:** P3 | **Category:** Docker | **Status:** RESOLVED (documented)

**Description:** nothing depends on `minio-init`, so its failure only shows in its own exit code.

**Changes made:** the runbook checks `docker compose wait minio-init`. CI checks its own `docker run`
exit code.

**Remaining risk:** a developer who does not check sees no error. **Founder decision required:** NO.

### ISSUE-INFRA-024 -- Lifecycle check accepted any rule on the prefix, and treated any failure as "none"

**Work Order:** WO-INFRA-006 (review) | **Severity:** P3 | **Category:** Docker | **Status:** RESOLVED

**Changes made:** `bac327a`. Only "lifecycle configuration does not exist" counts as none; other errors
stop the init; an enabled 1-day rule is required.

**Verification:** validation 22 of 22; the wrong-rule check. **Founder decision required:** NO.

### ISSUE-INFRA-025 -- CI's MinIO health wait had no timeout and no logs on failure

**Work Order:** WO-INFRA-006 (review) | **Severity:** P3 | **Category:** CI | **Status:** RESOLVED

**Changes made:** `bac327a`: `/minio/health/ready`, `--max-time 5`, and `docker logs` on failure. The
ready endpoint answers 200 on the pinned image.

**Founder decision required:** NO.

### ISSUE-INFRA-026 -- With the project pinned, `docker compose down -v` from any clone deletes the live volumes

**Work Order:** WO-INFRA-006 (review) | **Severity:** P2 | **Category:** Docker | **Status:** RESOLVED (documented)

**Description:** this was already true for the original checkout; pinning the name extends it to every
clone.

**Changes made:** warnings in the compose comment and the runbook. `down -v` is also on the batch's
prohibited list.

**Founder decision required:** NO.

### ISSUE-INFRA-027 -- The image signature was not verified

**Work Order:** WO-INFRA-003 | **Severity:** P3 | **Category:** Security | **Status:** OPEN

**Update 13 November (follow-up batch):** RESOLVED by WO-INFRA-009. cosign verified the signature and the SBOM and SLSA attestations, signed by Chainguard's release workflow. A wrong identity correctly fails. Grype reports 0 known vulnerabilities (`WO-INFRA-009-SUPPLY-CHAIN-REVIEW.md`).

**Description:** Chainguard signs its images with Sigstore. `cosign` is not installed, and installing
tools was out of scope.

**Recommended next action:** the `cosign verify` command in `WO-INFRA-003-IMAGE-VERIFICATION.md`, before
the merge. **Founder decision required:** NO.
