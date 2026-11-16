# WO-INFRA-011 -- MinIO preflight (and the work-order report)

**Status of the work order: PARTIALLY COMPLETE. LIVE CUTOVER BLOCKED PENDING FOUNDER APPROVAL.**
The preflight passes and rollback is ready; the live move was not run, because no separate approval
exists. 13 November 2026.

**Log:** `G:\AdulisDevelopment\WO-INFRA-CLOSURE\logs\wo011-preflight.log`.

## 1. Work order
WO-INFRA-011, controlled MinIO migration and verification (P0).

## 2. Initial state
- **Docker:** Docker Desktop's backend had exited at 09:10:36Z, with exit status 1 right after a
  software-update event; no reboot. This batch started it at 11:16:44Z. The live containers came back
  at 11:17:00Z through their restart policy, healthy, on the same volumes (ISSUE-INFRA-CLOSURE-001).
- **Live MinIO:** `adulis-minio` (image `14cea493d9a3`), port 9100, volume `adulis-pgdata`.

## 3. The implementation still holds every control (task 1)
`ops/scripts/minio-migrate.mjs` is unchanged since its review fixes (`7418d82`). Its tests pass, 11 of 11.

| Control | Where | Rehearsed |
|---|---|---|
| Refuses an unexpected source volume | preflight: the source must mount `MIGRATE_SRC_VOLUME` at `/data` | R0, R12 |
| Refuses an unexpected or used target volume | preflight: absent or empty | R10b |
| Verifies compose ownership | the source must be compose service `minio` of the project | the first R10 attempts |
| Checks the host port | compose's resolved port must equal the source's | R0b; live, below |
| Stops writes before the final backup | `docker stop` of the source before the tar | every run |
| Verifies the backup | checksum, every tar header, end marker, required entries; strict checksum-file parsing | R1, R17 |
| Restores the backup in a disposable environment | scratch volume, served by the old image on an internal network | every run |
| Checks object content and metadata | size, ETag, SHA-256, metadata, both directions | R3 to R5 |
| Verifies bucket permissions | evidence private; media `GetObject` only; anonymous probes | R6, R14 |
| Checks the init exit status | `docker wait` must be 0 | R8, R16 |
| Detects incomplete copying | object-by-object comparison | R3 |
| Restores the old service after failure | undo, verified by `UNDO OK` | R8, R9, R16, R17 |
| Preserves the old volume | mounted read-only by the move; never deleted | every run |

## 4. Local configuration (task 2)
- **Port:** the live MinIO still publishes **9100**, and port 9000 belongs to `nac-trial-minio`.
- **This checkout's `.env`:** untracked and git-ignored. Its earlier copy was saved first
  (`WO-INFRA-CLOSURE\scratch\env-before-wo011.bak`), then one line was appended, `MINIO_HOST_PORT=9100`,
  with a comment. Nothing else changed (`diff`: 3 added lines). `docker compose config` now resolves
  MinIO to `9100->9000`. No credentials were added; the values there are the documented local fakes.
- **The Work checkout's `.env`:** not touched (the work order forbids changing that checkout). It needs
  the same line before the move runs there.

## 5. Read-only preflight (task 3)

`MINIO_HOST_PORT=9100 node ops/scripts/minio-migrate.mjs plan`, run without `MIGRATE_LIVE`:

| Item | Result |
|---|---|
| Source container | `adulis-minio`, image `14cea493d9a3` |
| Source volume | `adulis-pgdata` |
| Destination volume | `adulis-platform_adulis-miniodata`: does not exist (compose will create it) |
| Docker project | `adulis-platform` |
| Host port | 9100 |
| Bucket inventory | **1,568 media, 7 evidence**; 19 buckets on the server (2 real, 17 phantom PostgreSQL directories) |
| Result | **PLAN OK: preflight passed; nothing was changed** |
| Existing backups | the first batch's set at `G:\AdulisDevelopment\WO-INFRA\backup`: all 5 checksums OK. A fresh backup is taken during the move |
| Available storage | G: 3,352,768,282,624 bytes free (one backup is about 162 MB); C: 28,590,014,464 |
| Required images | the pinned Chainguard digest is local, and so is the old image `minio/minio:latest` (`14cea493d9a3`) |
| Application writers | none: nothing listens on the API port 3000, the console (5173, 4173) or Metro (8081) |

## 6. Rollback readiness (task 4)

| Prerequisite | State |
|---|---|
| The original image | local (`sha256:14cea493d9a3`), **and** saved at `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\backup\minio-old-image-14cea493d9a3.tar`: checksum OK. `docker load -i` restores it |
| The original volume readable | yes: `plan` read all 1,575 objects from it |
| Recovery credentials | in the live container's environment and in the `legacy-container.json` that `migrate` records. Not printed here |
| The old container's configuration | recorded by `migrate` before the switch; `rollback` recreates it (rehearsed R11, R15) |
| Migration script tests | 11 of 11 |

## 7. Status
- **Implementation and readiness:** COMPLETE.
- **The live cutover (task 5):** **BLOCKED.** It needs a separate, explicit founder approval naming the
  operation. This prompt does not grant it. See `WO-INFRA-011-MIGRATION-EXECUTION.md`.

## 8. Issues
ISSUE-INFRA-CLOSURE-001 (Docker had stopped), ISSUE-INFRA-CLOSURE-003 (live cutover blocked).

**Commit SHA:** the WO-INFRA-011 commit on `infra/wo-infra-010-014-closure` (`git log --grep WO-INFRA-011`).
