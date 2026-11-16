# WO-INFRA-007 -- MinIO migration safety review

**Status of the work order: PARTIALLY COMPLETE.** The migration is now fail-closed, verified
automatically and rehearsed end to end, including failures. The **live cutover is BLOCKED**: no founder
approval exists for it. 13 November 2026.

This is the work-order report. The rehearsal evidence is `WO-INFRA-007-MIGRATION-VALIDATION.md`, and the
exact commands are in `WO-INFRA-007-CUTOVER-AND-ROLLBACK.md` and the revised
`WO-INFRA-002-MIGRATION-RUNBOOK.md`.

## 1. Work order
WO-INFRA-007, safe MinIO migration hardening and operational readiness (P0).

## 2. Initial state
- **Live MinIO:** `adulis-minio` (image `minio/minio:latest`, id `14cea493d9a3`, RELEASE.2025-09-07),
  published on host port 9100. It mounts the volume `adulis-pgdata` at `/data`, under compose project
  `adulis-platform`, owned by `C:\Users\naods\Documents\Work\adulis-platform`. Running since
  2026-11-12T07:01Z.
- **Source inventory (re-read 06:50Z and again at 07:21Z, read-only):**
  - `adulis-media`: 1,568 objects, 2.7 MiB, policy `download`;
  - `adulis-evidence`: 7 objects, 406 KiB, private;
  - 17 phantom PostgreSQL "buckets";
  - three identical 1-day `evidence/raw/` expiry rules, one per run of the old init.
- **Target volume** `adulis-platform_adulis-miniodata`: does not exist.
- **The runbook:** a hand-run sequence, rehearsed once, that relied on reading terminal output.

## 3. Runbook audit (task 1): what the first version could do

| # | Step of the old runbook | Risk | Class |
|---|---|---|---|
| A1 | 1, backup: `docker run ... > tar; sha256sum` | No exit-code check: a failed or cut-short tar still gets a checksum. Taken while MinIO runs. Never restore-tested | false success |
| A2 | 2, `docker volume create` | Silently reuses an existing volume: if MinIO had already started empty on it and the API had written, the copy would merge into foreign data | overwrite / false success |
| A3 | 2, init | "If it fails, run it again": exit code not checked, so buckets, policies or expiry could be missing | permissions / false success |
| A4 | 3, `mc mirror` from the running server | Writes that land after the copy are lost at the switch; nothing detects them | data loss |
| A5 | 4, `mc diff ...; mc diff ...; wc -l` | `;` discards exit codes. `mc diff` compares names and sizes only, not content or metadata. Success means "nothing printed", read by eye | false success |
| A6 | 4 | No check of the target's anonymous policies, expiry rule or bucket list | permissions |
| A7 | 5, `docker compose up -d` (every service) | Recreates `adulis-postgres` if its definition differs. From a checkout without `POSTGRES_HOST_PORT=5434` it would move to 5432, which PostgreSQL 18 holds: the database becomes unreachable | database / inaccessible |
| A8 | 5, `export MINIO_HOST_PORT=9100` by hand | Neither `.env` sets it. Forgotten, compose publishes 9000, which `nac-trial-minio` holds: MinIO does not start. If 9000 were free, MinIO would run where the API does not look | inaccessible |
| A9 | 5 | No automatic way back if the new MinIO fails to start or init fails | inaccessible |
| A10 | 6, checks | Mount, init exit code and counts compared by eye | false success |
| A11 | Rollback: `git checkout <commit> -- docker-compose.yml` | Overwrites the working-tree file (uncommitted edits lost). The old file has no `name:`, so from a checkout not named `adulis-platform` it addresses another compose project. `docker rm -f` first | overwrite / wrong target |
| A12 | 3 | The copy was served by MinIO running on the original volume, which writes its own bookkeeping there | source modified |

**Assumptions the old runbook made:**
- **Names:** containers `adulis-minio` and `adulis-minio-new`.
- **Network:** `adulis-platform_default` exists, which is true only if compose project `adulis-platform`
  started the stack.
- **Credentials:** hard-coded.
- **Port:** 9100, by a hand-set variable.
- **Owner:** "the checkout that will own the stack", unnamed.
- **Writers:** that nothing writes during the copy, unverified.

Nothing in it deletes a volume or an object. `mc mirror` was run without `--remove` and `--overwrite`.

## 4. Root causes
- The runbook asked a person to verify by reading output, and treated "nothing printed" as success.
- It verified with a tool (`mc diff`) that does not compare content or metadata.
- Writes were not frozen: the API uses the root credentials, so only stopping the server freezes them.
- The switch and the rollback went through whole-project compose commands and `git checkout`, which
  reach further than MinIO.

## 5. Confirmed findings
All 12 risks above were confirmed by reading the old commands and by the rehearsals; A1, A4, A7 and A8
were also reproduced as conditions. Two defects of my own script were found by the rehearsal and fixed
before any result was taken (section 12).

## 6. Files inspected
- `docs/infrastructure/WO-INFRA-002-MIGRATION-RUNBOOK.md` (first version);
- `docker-compose.yml`, `ops/scripts/minio-init.sh`;
- `.env` in this checkout and in the Work checkout (the port keys only);
- the live container's configuration and compose labels (`docker inspect`, read-only);
- the old rehearsal script (`G:\AdulisDevelopment\WO-INFRA\scratch\rehearse-minio-migration.sh`).

## 7. Files modified
- `ops/scripts/minio-migrate.mjs` (new): the fail-closed migration, with `plan`, `migrate`, `rollback`
  and `verify-backup`.
- `ops/scripts/minio-migrate.test.mjs` (new): 8 tests of the refusals.
- `ops/scripts/gates.mjs`: appended gate `minio-migrate` (31 gates).
- `docs/infrastructure/WO-INFRA-002-MIGRATION-RUNBOOK.md`: rewritten around the script.
- The three WO-INFRA-007 reports.

## 8. Changes made: how each risk is closed

| Risk | Now |
|---|---|
| A1 | Backup of the **stopped** volume; exit code checked; SHA-256 recorded, then the file is re-read: checksum, every tar header checksum, the two end-of-archive blocks, and the required entries (MinIO data and the old PostgreSQL directory). Then it is **restored** and the copy is served from the restored backup |
| A2 | Preflight refuses a target volume that exists and is not empty, before anything is stopped |
| A3 | Init on the target must exit 0; afterwards the bucket set, the evidence policy and the expiry rule are checked |
| A4 | The old MinIO is stopped before the backup. The restored backup must equal the inventory taken just before the stop (rehearsed: a late write refuses) |
| A5 | Every command's exit code is checked by the script. The target must equal the source object by object: key, size, ETag, SHA-256 of the content, all metadata. Any difference refuses |
| A6 | Exactly the two buckets; evidence policy empty; the 1-day `evidence/raw/` rule present and the rule set equal to the source's; anonymous probes: evidence list, read and write denied, media read allowed (same bytes), media write denied. A probe that errors is a failure, not a denial |
| A7 | Compose is asked for `minio` and `minio-init` only; PostgreSQL is never named |
| A8 | Preflight compares compose's resolved MinIO port with the port the source publishes and refuses on a difference |
| A9 | Any failure after the stop undoes itself (section "The sequence" of the runbook); rehearsed for eight failure kinds |
| A10 | After the switch the script checks the init exit code, the mounted volume, and repeats the full inventory and the probes through the published port |
| A11 | `rollback` recreates the old container from its recorded `docker inspect` on `adulis-pgdata`, renames the new one aside, deletes nothing and never runs `git` |
| A12 | MinIO never runs on the original volume: it is mounted read-only (backup, final tar check) and the copy is served from a scratch restore |

Also:
- `plan` is read-only;
- `migrate` and `rollback` on `adulis-pgdata` refuse without `MIGRATE_LIVE=approved`;
- the rehearsal faults (`MIGRATE_FAULT`) are refused on the live volume.

## 9. Verification commands
- `node --test ops/scripts/minio-migrate.test.mjs`; `node ops/scripts/gates.mjs --only minio-migrate`;
- 12 mutations of the script (`logs/mutation-minio-migrate.log`);
- `node ops/scripts/minio-migrate.mjs verify-backup <tar> <SHA256SUMS.txt>` on the existing backup;
- the rehearsals R0 to R12 (`G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\scratch\rh.sh`, `rh-faults.sh`);
- `plan` against the live stack, read-only.

## 10. Actual results
- **Unit tests:** 8 of 8 at `67ef676`; 11 of 11 after the review fixes.
- **Mutations:** 12 of 12 killed.
- **Existing backup** (`G:\AdulisDevelopment\WO-INFRA\backup`, taken 2026-11-12T22:14:35Z): all five
  checksums match. The volume tar is complete (7,064 entries) and holds the MinIO data and the old
  PostgreSQL directory.
- **Rehearsal:** a full migration in 63 seconds, then a rollback. Every deliberate failure refused and
  left the old MinIO serving its data. Details in the validation report.
- **Live `plan`:** passes with `MINIO_HOST_PORT=9100`, refuses without it. Live inventory 1,568 / 7.
  Nothing changed.

## 11. Security review
- **No credential added.** The script reads the MinIO credentials from compose and from the source
  container. They are the documented local fakes, passed to helper containers as environment
  variables, and never printed: docker errors print only the first two words of the command.
- **Evidence stays private,** checked by policy and by three anonymous probes, before and after the
  switch. The security check refuses a public evidence bucket (rehearsed).
- **Helper servers** run on an `--internal` Docker network with no published port.
- **Backups** are refused inside the repository; they go to the SSD.
- **The live guard** refuses `migrate` or `rollback` on `adulis-pgdata` without the explicit approval
  variable, and refuses test faults there.

## 12. Regression review
- **Nothing in the application changes.**
- **The compose file is unchanged** by this work order.
- **The new gate** runs only Node's test runner on the script's pure functions.
- **Two defects found in my own script by the rehearsal, fixed before any result:**
  - the backup-folder check refused every folder on another drive: on Windows, `path.relative` from C:
    to G: is absolute (now `insideRepo`, tested);
  - the snapshot server's address was overwritten by the source's, and `mc ready` blocks forever on a
    stopped server (now bounded at 90 s).
- **The harness had to mimic the live container exactly.** With fewer compose labels than live, compose
  did not recognise the stand-in container as the service, which is why the rehearsal source carries
  the live label set.

## 13. Issues encountered
- ISSUE-INFRA-FOLLOWUP-001: the old runbook's fail-open points (A1 to A12).
- ISSUE-INFRA-FOLLOWUP-002: no `.env` sets `MINIO_HOST_PORT` (A8).
- ISSUE-INFRA-FOLLOWUP-003: the two script defects above (resolved).

## 14. Issues resolved
ISSUE-INFRA-FOLLOWUP-001 and 003; ISSUE-INFRA-FOLLOWUP-002 is guarded (the script refuses).

## 15. Outstanding risks
- **The live move has not run.** Until it does, `docker compose up` with the new compose file starts an
  empty MinIO (R-11 of the first batch).
- **Downtime:** about two minutes of MinIO downtime during the move. The API should be stopped.
- **Compose ownership:** compose labels for the `minio` container will point at whichever checkout runs
  the move.

## 16. Founder decisions
- **Approve the live move** (ISSUE-INFRA-001), and **choose the checkout that will own the stack**.
- Commands: `WO-INFRA-007-CUTOVER-AND-ROLLBACK.md`.

## 17. Commit SHA and final status
- **Commits:** `67ef676` on `infra/wo-infra-007-009-finalization`, hardened by the review fixes in
  `7418d82` (WO-INFRA-009, section 13 of its final verification).
- **On the candidate:** `4aa71de` and `de1ae19`.
- **Final status:** **PARTIALLY COMPLETE**. The hardening, verification and rehearsal are COMPLETE;
  the **live cutover is BLOCKED** pending approval.
