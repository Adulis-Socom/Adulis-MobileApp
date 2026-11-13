# WO-INFRA-002 -- MinIO data move runbook (local development stack)

**Status: PREPARED AND REHEARSED; NOT RUN ON LIVE DATA.** The live move needs the founder's approval
(ISSUE-INFRA-001). Revised by WO-INFRA-007: the hand-run steps of the first version are replaced by
`ops/scripts/minio-migrate.mjs`, which checks every step itself and puts the old MinIO back on any
failure. Why the first version was not safe enough: `WO-INFRA-007-MIGRATION-SAFETY-REVIEW.md`.

## What it does

It copies the MinIO objects out of the old volume `adulis-pgdata` into the volume the compose file names
for MinIO, `adulis-platform_adulis-miniodata`, then lets compose recreate MinIO on it.

- **It copies; it never moves or deletes.** The old volume keeps the original objects and the old
  PostgreSQL directory until the founder decides about it (ISSUE-INFRA-005, now archived by WO-INFRA-008).
- **It is a logical copy of the two real buckets** (`mc mirror`). The 17 phantom PostgreSQL "buckets" are
  never copied.
- **PostgreSQL is not touched.** Compose is only asked for the `minio` and `minio-init` services.
- **Writes are frozen by stopping the old MinIO first.** The API writes with the root credentials, so no
  bucket policy can freeze it; a stopped server can. The copy is taken from a backup of the stopped
  volume, restored into a scratch volume, so the original volume is only ever mounted read-only.

## The sequence (`migrate`)

1. **Preflight, before anything changes.** The source container exists, runs and mounts `adulis-pgdata`;
   it is compose's `minio` service of project `adulis-platform`; compose would publish MinIO on the port
   the source uses today (9100); the target volume is absent or empty; the backup folder is new, outside
   the repository; the credentials are present. Any problem: refused, nothing changed.
2. **Source inventory** from the running server: every object's size, ETag, metadata and SHA-256 of its
   content, the buckets, the anonymous policies and the lifecycle rules.
3. **Stop the old MinIO.** From here nothing can write to the source.
4. **Backup** of the stopped volume (`tar`, on the SSD), its SHA-256 recorded, then re-read and checked:
   checksum, every tar header, the end-of-archive marker, and that it holds the MinIO data and the old
   PostgreSQL directory.
5. **Restore the backup** into a scratch volume and serve it with the exact image the old MinIO runs, on
   a private Docker network. This proves the backup restores.
6. **Target:** compose creates its volume; a private server on it runs `ops/scripts/minio-init.sh`.
7. **Copy** the two buckets from the restored backup.
8. **Verify, all automatically.** The restored backup equals the source inventory (refused if anything
   was written between the inventory and the stop); the target equals the restored backup, object by
   object (size, ETag, SHA-256, metadata); the target has exactly the two buckets, a private evidence
   bucket and its 1-day `evidence/raw/` expiry; anonymous users cannot list, read or write evidence, can
   read media (same bytes) and cannot write it; and a fresh tar of the source volume is byte-identical
   to the backup.
9. **Switch:** `docker compose up -d minio minio-init`. The init container must exit 0; MinIO must mount
   the new volume; the full inventory and the anonymous probes run again through the published port.

**Any failure from step 3 on undoes itself:** before the switch, the old container is started again and
the target volume this run created is removed (it was never served); after the switch, the new container
is renamed aside and the old one recreated from its recorded configuration on `adulis-pgdata`; the target
volume is then kept, because it was served. Rehearsed: `WO-INFRA-007-MIGRATION-VALIDATION.md`.

## Before you start

**Never run `docker compose down -v` with this file.** The project name is pinned, so from any clone that
command deletes the live database volume `adulis-platform_adulis-pgdata` and the new MinIO volume. Plain
`docker compose down` keeps both.

- The founder's approval for ISSUE-INFRA-001.
- A checkout that has this change, at the repository root. The `minio` container's compose labels will
  point at that checkout afterwards; PostgreSQL's do not change. Which checkout owns the stack is a
  founder decision (`WO-INFRA-007-CUTOVER-AND-ROLLBACK.md`).
- Stop the API and the console dev server. Not for consistency (the stop in step 3 guarantees that), but
  so nothing shows errors for the two minutes MinIO is down.
- `MINIO_HOST_PORT=9100`: no `.env` sets it today, and MinIO's host port defaults to 9000, which
  `nac-trial-minio` holds. The script refuses without it.
- **Keep the old MinIO image.** It can no longer be pulled (Docker Hub and quay.io dropped it), and
  `rollback` recreates the old container from it. Once nothing runs it, `docker image prune -a` or a
  Docker Desktop clean-up would delete it. Save it first:
  `docker image save minio/minio:latest -o G:/AdulisDevelopment/minio-move/minio-old-image.tar`.
  `rollback` refuses, before stopping anything, if the image is missing.
- **The backup folder is sensitive.** It holds every object, including evidence, and the old
  container's recorded configuration with its local MinIO credentials. The script creates it
  owner-only, but exFAT ignores permissions, so keep the SSD to this machine (storage policy, trusted
  device).

## Commands (Git Bash, repository root)

```
export MINIO_HOST_PORT=9100
node ops/scripts/minio-migrate.mjs plan          # read-only; must end "PLAN OK"

export MIGRATE_BACKUP_DIR=G:/AdulisDevelopment/minio-move/$(date -u +%Y%m%dT%H%M%SZ)
MIGRATE_LIVE=approved node ops/scripts/minio-migrate.mjs migrate 2>&1 | tee "$MIGRATE_BACKUP_DIR.log"
```

**Success** is the line `MIGRATED: adulis-media=<n> adulis-evidence=<m>` and exit code 0, with the counts
the plan printed. **Anything else** ends with `REFUSED:` and the reason; the old MinIO is already back.

Then start the API and open any product image (the console, or the mobile app against the dev API): media
URLs use `R2_MEDIA_PUBLIC_ORIGIN` (`http://localhost:9100/adulis-media`), which the script's anonymous read
probe has already exercised on the same port.

## Rollback

```
MIGRATE_LIVE=approved MIGRATE_BACKUP_DIR=<the same folder> node ops/scripts/minio-migrate.mjs rollback
```

**Before stopping anything, it checks:**
- that MinIO really serves the new volume, so a second rollback refuses;
- that the old image and the old volume still exist;
- that the run's recorded source is the live volume, in which case `MIGRATE_LIVE=approved` is
  required whatever `MIGRATE_SRC_VOLUME` says.

**Then it:**
- stops the new MinIO and renames it aside;
- recreates the old container from the recorded configuration on `adulis-pgdata`, and logs what that
  configuration does not carry over;
- compares the restored store with its inventory at the time of the move. `ROLLED BACK` is printed
  only if they are identical;
- lists every object added, changed or deleted after the switch. Those stay in the new volume and the
  renamed container: nothing is deleted.

**If the old container cannot be recreated,** it puts the new MinIO back and starts it.

**What it never does:** run `git checkout` or touch PostgreSQL.

**The read-only rule:** serving the old volume again necessarily mounts it read-write, as the live
MinIO does today. The read-only rule applies to the move, not to a rollback.

While rolled back, `docker compose up` fails on the port, deliberately, until the founder decides.

## Afterwards

- Record the date, the counts and the backup folder in the overnight register (ISSUE-INFRA-001).
- `adulis-pgdata` is referenced by nothing. **Do not delete it**: deleting needs the founder's approval
  (ISSUE-INFRA-005). Its PostgreSQL data is archived and restore-tested
  (`WO-INFRA-008-LEGACY-DATABASE-ARCHIVE.md`).
