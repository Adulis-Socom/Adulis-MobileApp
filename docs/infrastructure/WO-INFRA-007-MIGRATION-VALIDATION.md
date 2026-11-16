# WO-INFRA-007 -- Migration validation (rehearsal evidence)

13 November 2026. Every run used disposable copies only.

**Logs:** `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\logs\`, files `rehearsal-*.log`,
`existing-backup-verify.log`, `live-plan.log` and `mutation-minio-migrate.log`.

**Per-run outputs** (backup, `manifest.json`, inventory, recorded container configuration):
`G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\rehearsal\<case>\`.

## How the rehearsal mirrors the live stack

| Live | Rehearsal |
|---|---|
| Volume `adulis-pgdata` | `infra-rh-src`, restored from the verified backup of `adulis-pgdata` (2026-11-12T22:14:35Z): the same 1,568 + 7 objects, the 17 phantom directories and the old PostgreSQL directory |
| `adulis-minio`, image `minio/minio:latest` (`14cea493d9a3`), port 9100, compose project `adulis-platform` | `infra-rh-minio`: the same image id, port 19100, and the **same compose label set** as the live container (project `infra-rh`) |
| `docker-compose.yml` of this branch | The same file plus `rehearsal.override.yml`, which renames only the project, the container names and the volume names |
| `adulis-platform_adulis-miniodata` | `infra-rh-miniodata` |

The script ran unchanged. Only its environment differed: `MIGRATE_SRC_*`, `MINIO_HOST_PORT=19100`,
`COMPOSE_FILE` and `COMPOSE_PROJECT_NAME`.

## Backup verification (task 3)

| Check | Result |
|---|---|
| Existing backup set, `G:\AdulisDevelopment\WO-INFRA\backup` | **All five SHA-256 sums match** (`sha256sum -c`) |
| `minio-volume-adulis-pgdata.tar` with `verify-backup` | **OK:** 7,064 entries; every header checksum valid; end-of-archive present; holds `.minio.sys/format.json`, both buckets, `PG_VERSION`, `global/pg_control` and `base/` |
| Restorability | Restored into a scratch volume in every rehearsal and served by the old image; all 1,575 objects read back with matching content. Its PostgreSQL directory also starts as a database (WO-INFRA-008) |
| **Recovery point** | **2026-11-12T22:14:35Z** for the existing backup. Each live `migrate` takes a fresh one of the stopped volume, which becomes the new recovery point |
| `adulis.dump` (current dev database) | Checksum OK. Restore-tested by WO-INFRA-008: it loads, but 5 foreign keys cannot be re-created, because the live dev database already holds rows violating them (ISSUE-INFRA-FOLLOWUP-005) |

## Success path

| Run | What happened | Result |
|---|---|---|
| **R0** | `plan` on the rehearsal source | **PLAN OK**; source 1,568 / 7, 19 buckets |
| **R0b** | `plan` without `MINIO_HOST_PORT` | **REFUSED:** "compose would publish MinIO on 9000 but the source uses 19100" |
| **R10** | Full `migrate` | **MIGRATED in 63 s**. Steps: inventory, stop, backup (6,989 entries), restore, target, init, copy. Verified before the switch: target = restored backup on every object (size, ETag, SHA-256, metadata), 2 buckets, policies, expiry and probes, with the source tar byte-identical to the backup. Compose then recreated the container on the new volume (init exit 0) and the same verification passed through port 19100 |
| **R11** | One object written to the new MinIO, then `rollback` | **ROLLED BACK:** the old image serves `infra-rh-src` again (1,568 / 7). Kept: the renamed new container and the new volume. Reported: the one object written after the switch, by name |
| **R11b** | `docker compose up -d minio` while rolled back | Fails: compose starts the kept container and the port is taken. No change |

The R10 manifest records:
- **Counts:** source 1,568 / 7, served 1,568 / 7.
- **Anonymous probes:** media read ALLOWED, media write DENIED, evidence list, read and write DENIED,
  and media list ALLOWED, which is reported but not enforced (ISSUE-INFRA-013).

`mc mirror` preserved every object's metadata exactly: the strict metadata comparison passed on all
1,575 objects, without `--preserve`.

## Deliberate failures (task 7): every one refused, and the old MinIO kept serving

| Run | Fault, where a real one would occur | Refused because | Afterwards |
|---|---|---|---|
| R1 | One byte of the fresh backup flipped after its checksum was recorded | SHA-256 does not match | Same old container running, 1,568 / 7; no target volume left |
| R2 | An object written to the source between its inventory and the stop | "the source changed between its inventory and the stop": the late object is listed | Same old container; the late object is in the source (1,569), which stays authoritative |
| R3 | One object deleted from the target after the copy | `missing: adulis-media/products/.../card.webp` | Same old container, 1,568 / 7 |
| R4 | One object overwritten with zeros, same size | ETag and SHA-256 differ (size alone would have passed `mc diff`) | Same old container |
| R5 | One object's Content-Type changed (same bytes) | `metadata differs: {"Content-Type":"image/webp"} -> {"Content-Type":"text/plain"}` | Same old container |
| R6 | Evidence bucket made anonymously readable on the target | The policy check, and two probes (list ALLOWED, read ALLOWED) | Same old container |
| R7 | A file added to the stopped source volume during the run | Its tar stream no longer equals the backup | Same old container |
| R8 | `minio-init` fails at the switch (wrong password, compose override) | `infra-rh-minio-init exited 1` (signature mismatch) | Old container **recreated** from its recorded configuration on `infra-rh-src`, serving 1,568 / 7. The failed new container and the target volume kept |
| R9 | New MinIO never healthy at the switch (healthcheck override) | `docker compose up exited 1` | As R8 |
| R10b | Target volume already holds a file | Preflight: "already exists and is not empty" | Source **never stopped** (same start time) |
| R12 | `migrate` and `rollback` aimed at the real `adulis-pgdata` without approval, and a fault with approval | All three refused before any Docker call | Live `adulis-minio` unchanged (same id, same start) |

## The script's own checks

- **Unit tests** (`ops/scripts/minio-migrate.test.mjs`): 8 of 8.
- **New gate** `minio-migrate`: PASS.
- **12 mutations**, each removing one refusal: **12 of 12 killed.** M11 (cross-drive folder) is
  asserted only on Windows, the only platform where that bug exists.

## Found and fixed during the rehearsal (in my script, before any result was taken)

1. **Every backup folder on G: was refused.** On Windows, `relative('C:\...', 'G:\...')` is absolute,
   so the "inside the repository" check was wrong. Fixed as `insideRepo()`, unit-tested.
2. **The snapshot server's address was replaced by the stopped source's,** and `mc ready` blocks
   forever on a dead server, so the run hung. Fixed: server records are built explicitly, and the wait
   is bounded at 90 s. The hung run was stopped, and its undo restored the rehearsal source: the first,
   unplanned confirmation of the failure path.
3. **The undo for a compose-created target volume was registered after the compose call,** so a failed
   call leaked an empty volume. Now registered before it.

## After the independent reviews (WO-INFRA-009)

The script was hardened in `7418d82`; see section 13 of `WO-INFRA-009-FINAL-VERIFICATION.md`. Re-run on
disposable copies:

| Run | What | Result |
|---|---|---|
| R13 | The committed script (`67ef676`): migrate, then rollback | MIGRATED; ROLLED BACK |
| R14 | Under the new media policy (`4b38c78`) | MIGRATED, with media listing enforced as DENIED; ROLLED BACK |
| R15 | Review fixes: migrate, rollback, second rollback | MIGRATED; ROLLED BACK, "identical to its state at the migration", 0 changes after the switch; the second rollback **refused** ("nothing to roll back") |
| R15b | A rollback of a run recorded on `adulis-pgdata`, with `MIGRATE_SRC_VOLUME=x` | **Refused:** needs the founder's approval |
| R16 | Init fails at the switch | Refused, then **UNDO OK** (the old MinIO answers on its port again) |
| R17 | Corrupt backup | Refused, then **UNDO OK** |

Two further checks:
- **Stream errors:** a disk-full output, an EPIPE on stdin and a non-zero exit all reject, and the
  process lives on to run its undo (`logs/dockerpipe-error-check.log`).
- **Checksum files:** `verify-backup` with a BOM and a wrong hash is refused; with a BOM and the right
  hash it passes.

## Live, read-only

`plan` against the real stack at 07:21Z:
- **Without `MINIO_HOST_PORT`:** refused.
- **With `MINIO_HOST_PORT=9100`:** PLAN OK. Source `adulis-minio` on `adulis-pgdata`, 1,568 / 7, 19
  buckets; the target volume does not exist.
- **Nothing changed:** the same container id and start time before and after.

## Not rehearsed
- **Docker Desktop restarting mid-run.** The undo needs a working Docker; if it is interrupted, the
  runbook's rollback section applies by hand.
- **A disk-full SSD during the backup.** The backup write fails, which is a docker or stream error, so
  the run refuses before the copy. Not induced.
- **The application** (API and console) **against the migrated store.** The rehearsal checks the
  storage-level contract the API uses (same port, same credentials, same buckets and policies). The
  API's object-storage path itself is exercised against this image by the CI gate `console-e2e` (media
  arms).
