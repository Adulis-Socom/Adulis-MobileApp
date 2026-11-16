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
6. **Target:** the run creates its volume (external since WO-INFRA-015B); a private server on it runs `ops/scripts/minio-init.sh`.
7. **Copy** the two buckets from the restored backup.
8. **Verify, all automatically.** The restored backup equals the source inventory (refused if anything
   was written between the inventory and the stop); the target equals the restored backup, object by
   object (size, ETag, SHA-256, metadata); the target has exactly the two buckets, a private evidence
   bucket and its 1-day `evidence/raw/` expiry; anonymous users cannot list, read or write evidence, can
   read media (same bytes) and cannot write it; and a fresh tar of the source volume is byte-identical
   to the backup.
9. **Switch:** `docker compose up -d minio minio-init`. The init container must exit 0; MinIO must mount
   the new volume; the full inventory and the anonymous probes run again through the published port.

**Before the switch** the run writes the move record as `pending <run>`. **After step 9 passes** it
rewrites it as `complete <run>`, read back. Only a complete record lets a normal start serve the new volume.

**Any failure from step 3 on undoes itself, as far as Docker lets it.**
- **Before the switch:** the old container is started again, and the target volume this run created is
  removed (it was never served).
- **After the record is written:** the record is renamed aside first, verified, with bounded retries.
- **After the switch:** the new container is retired (stopped and checked, its configuration and logs saved
  in the run folder, removed: it carries the switch's one-time permission), what the target received since
  the switch is measured and listed, and the old one is
  recreated from its recorded configuration on `adulis-pgdata`. The target volume is then kept, because it
  was served.
- **The outcome:** each step's result goes into `manifest.json`, and the run ends with one of `NOTHING
  CHANGED`, `UNDO OK`, `UNDO PARTIAL` or `UNDO INCOMPLETE`. See "Recovery limits" below for what each
  means.
- **Rehearsed:** `WO-INFRA-007-MIGRATION-VALIDATION.md`; INF-04 for the record and recovery paths.

## Before you start

**Never run `docker compose down -v`.** The project name is pinned, so the command acts on the live stack
from any clone. Since WO-INFRA-015B this file declares every volume external, so through it the command
deletes no volume, but a checkout with an older compose file still deletes the live database volume
`adulis-platform_adulis-pgdata` (and, before the move, the MinIO objects in `adulis-pgdata`). Plain
`docker compose down` keeps them all.

- The founder's approval for ISSUE-INFRA-001.
- A checkout that has this change, at the repository root. The `minio` container's compose labels will
  point at that checkout afterwards; PostgreSQL's do not change. Which checkout owns the stack is a
  founder decision (`WO-INFRA-007-CUTOVER-AND-ROLLBACK.md`).
- Stop the API and the console dev server. Not for consistency (the stop in step 3 guarantees that), but
  so nothing shows errors for the two minutes MinIO is down.
- `MINIO_HOST_PORT=9100`. Since INF-04, compose's host port default is 9100 too. 9000 is where
  `nac-trial-minio` listens on this machine. The script refuses if compose would publish MinIO on a
  port other than the one the source uses.
- **Keep the old MinIO image.** It can no longer be pulled (Docker Hub and quay.io dropped it), and
  `rollback` recreates the old container from it. Once nothing runs it, `docker image prune -a` or a
  Docker Desktop clean-up would delete it.
  - **Save it first,** and check that the tag is the image the container runs:
    `docker inspect adulis-minio --format '{{.Image}}'` must equal
    `docker image inspect minio/minio:latest --format '{{.Id}}'`. Then:
    `docker image save minio/minio:latest -o G:/AdulisDevelopment/minio-move/minio-old-image.tar`.
  - Keep its SHA-256 beside it. INF-04 saved and restore-tested such a copy.
  - `migrate` also saves the image into the run's backup folder. `rollback` and `recover` load it from
    there if the image was pruned, and refuse before stopping anything if neither the image nor the copy
    exists.
- **The backup folder is sensitive.** It holds every object, including evidence, and the old
  container's recorded configuration with its local MinIO credentials. The script creates it
  owner-only, but exFAT ignores permissions, so keep the SSD to this machine (storage policy, trusted
  device).

## Commands (Git Bash, repository root)

```
export MINIO_HOST_PORT=9100
export ADULIS_MINIO_VOLUME=adulis-platform_adulis-miniodata   # WO-INFRA-015A: compose needs it named
node ops/scripts/minio-migrate.mjs plan          # read-only; must end "PLAN OK"

export MIGRATE_BACKUP_DIR=G:/AdulisDevelopment/minio-move/$(date -u +%Y%m%dT%H%M%SZ)
MIGRATE_LIVE=approved node ops/scripts/minio-migrate.mjs migrate 2>&1 | tee -i "$MIGRATE_BACKUP_DIR.log"
```
(`tee -i`: a Ctrl+C must not end the logger, or the undo's output would be lost. The undo's outcome is
also written into `manifest.json`.)

**Success** is the line `MIGRATED: adulis-media=<n> adulis-evidence=<m>` and exit code 0, with the counts
the plan printed. **Anything else** ends with `REFUSED:` and the reason; the old MinIO is already back.

**Since WO-INFRA-015A:**
- **Unexpected buckets:** `plan` and `migrate` refuse a source holding any bucket other than the two
  buckets and the 17 PostgreSQL directories, before anything stops.
- **Interrupts:** Ctrl+C is honoured at the next step, and the undo runs.
- **The move record** (`.adulis-migration-complete` in the new volume) is two-phase since INF-04:
  - **`pending <run>` before the switch.** The MinIO guard in `docker-compose.yml` accepts it only during
    that run's own switch;
  - **`complete <run>` after the switched MinIO is verified.** Only this lets a normal start serve the new
    volume while `adulis-pgdata` holds MinIO data;
  - **after a failure:** the undo renames the record aside (verified). If the undo cannot (see "A record
    that could not be cleared"), the record stays pending, and every normal start refuses it.
- **After a success:** put `ADULIS_MINIO_VOLUME=adulis-platform_adulis-miniodata` in the root `.env`, so
  later `docker compose` commands keep MinIO on the new volume (`docs/infrastructure/MINIO-STARTUP.md`).
  Not before: after a failure, the variable stays out of `.env`.

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
- **renames the move record aside first** (`.adulis-migration-rolled-back`, read back). If that fails, it
  refuses with nothing stopped. From here on, no kill can leave a record a later start would serve
  (INF-04);
- stops the new MinIO and renames it aside (Docker will not restart it);
- recreates the old container from the recorded configuration on `adulis-pgdata`, and logs what that
  configuration does not carry over;
- compares the restored store with its inventory at the time of the move. `ROLLED BACK` is printed
  only if they are identical;
- measures the kept target **after** the new MinIO stopped (through a private helper), and lists and
  journals every object added, changed or deleted after the switch. Those stay in the new volume: nothing is
  deleted. Any change gives a MANUAL ACTION to copy back what must be kept. Stop the API before a rollback,
  so nothing writes in between.

**If the old container cannot be recreated,** it removes what it created, puts the new MinIO back under its
name, puts its record back (its guard needs it) and starts it, verified. It restores the record only if the
name holds that same new MinIO. Otherwise, or if the record cannot be put back, it starts nothing and says
that nothing serves (manual action).

**A rollback that was interrupted** (a closed window, a killed process) is finished by running `rollback`
again. It recognises each state a kill can leave:
- the new MinIO still serving, with the record already renamed;
- the new one renamed aside, with the old one not yet back;
- the old one back.

It completes the remaining steps and verifies as a full rollback does. If the old store then differs from
its state at the migration, it ends `ROLLED BACK WITH DIFFERENCES` (exit 1), never `ROLLED BACK`.

**What it never does:** run `git checkout` or touch PostgreSQL.

**The read-only rule:** serving the old volume again necessarily mounts it read-write, as the live
MinIO does today. The read-only rule applies to the move, not to a rollback.

While rolled back, `docker compose up` fails on the port, deliberately, until the founder decides.
Remove `ADULIS_MINIO_VOLUME` from the root `.env` after a rollback, so compose refuses to run at all.

## After a migrate that did not finish: `recover`

```
MIGRATE_LIVE=approved MIGRATE_BACKUP_DIR=<the same folder> node ops/scripts/minio-migrate.mjs recover
```

Use it when `migrate` was killed (a closed console window, a crash, a power cut), or when its undo ended
`UNDO PARTIAL` or `UNDO INCOMPLETE`.

**What it reads first:** the manifest and the live state, which it prints:
- which container holds the MinIO name, on which volume, and whether it runs;
- the move record.

A record of another run is refused (use that run's folder).

**What it then does, from what it found** (never from assumptions):
1. Renames any move record aside (verified, with bounded retries).
2. Removes only that run's helper containers, networks and scratch volume, and checks they are gone.
3. **Retires** a new MinIO it finds serving the target: stopped (checked), its configuration and logs saved
   in the run folder as `retired-*.inspect.json` and `retired-*.log`, container removed.
4. Brings the old MinIO back on `adulis-pgdata`. It either starts the recorded container, or recreates it from
   its recorded configuration, loading the saved image if it was pruned.
5. Verifies that the old container serves the old volume and answers.
6. Compares it with the inventory the run took.
7. **If the run had reached its switch,** measures the target through a private helper (no MinIO serving it)
   and lists every object added, changed or deleted since the stopped source. Uploads the new MinIO accepted
   are never dropped silently: any change ends `RECOVERY INCOMPLETE`, with a MANUAL ACTION to copy back what
   must be kept (rehearsed: c35).

**Never:**
- deletes a volume;
- guesses a state it does not recognise (it refuses instead).

The target volume is kept without a record: compare it with the old store before it is ever removed.

**It is repeatable:** a second run finds nothing left to do.

**If the run had already committed** (record complete, the new MinIO serving: killed after its verified
switch), nothing is undone. The end is recorded, and `rollback` is then the way back.

**One process per backup folder:** `migrate`, `rollback` and `recover` take a lock file in it. A lock left
by a killed run (its process gone) is taken over, and the tool says so.

## A record that could not be cleared

The undo and `recover` print `move record NOT cleared` for each failed attempt, then `MANUAL ACTION
REQUIRED` with the record's state as read back.

- **`pending` or `switching`.** The guard refuses both at every start, a restart of the switched MinIO
  included (rehearsed: c34). It still must go before the target volume is used:
  1. Run `recover` again once Docker works.
  2. Or by hand (the image is the local PostgreSQL one): `docker run --rm -v adulis-platform_adulis-miniodata:/d --entrypoint mv pgvector/pgvector:pg17 /d/.adulis-migration-complete /d/.adulis-migration-invalidated`.
- **`complete`.** This happens only if the commit's write succeeded but its read-back failed. The guard
  **accepts** it, so clear it as above before anything starts.
- **One case outside the tool's reach:** compose creates the new container and Docker dies before starting
  it. That container never used its permission, so a manual `docker start` or `docker compose start` of it
  could start once on the verified pre-switch copy. Once a move has started, run `recover`, never a manual
  start.

## Recovery limits (INF-04)

What is automatic, what is partial, and what needs a person.

| Situation | What happens | Automatic? | A person must |
|---|---|---|---|
| A failure before the source is stopped (a preflight refusal, too little room on the backup drive, a failed image save) | `NOTHING CHANGED`; recorded in `manifest.json` and `journal.jsonl` | yes | read the reason |
| A failure after the stop, Docker healthy | the old MinIO comes back, the record (if written) renamed aside and read back, the new MinIO retired, the target measured: `UNDO OK` | yes, verified | nothing |
| The same, but the target received writes after the switch | `UNDO PARTIAL`, the changes listed in `journal.jsonl` | the safety yes | copy back what must be kept |
| The record cannot be renamed (four attempts) | `UNDO PARTIAL`, `MANUAL ACTION REQUIRED` with the state read back; pending or switching is refused at every start | the safety yes, the clean-up no | run `recover`, or clear it by hand |
| An undo step fails, or the old MinIO does not serve its volume | `UNDO PARTIAL` or `UNDO INCOMPLETE`, naming the step | no | run `recover`, or act as the step says |
| A Ctrl+C (one or two) | the run stops at the next step and undoes itself. During an `mc` step (inventory, copy) that step finishes first; during the backup or hash it stops at once. A second Ctrl+C is acknowledged; the undo goes on | yes (rehearsed with real console Ctrl+C events) | read the outcome |
| The console window closed, or the process killed | Windows ends Node about 5 s later; the undo may stop part-way | **no** | run `recover` (or `rollback` again, for a rollback) |
| The switched MinIO restarted before `recover` (Docker restart, crash, `docker start`) | its guard refuses (`switching`): MinIO is down, never stale | the safety yes | run `recover` |
| Docker unavailable during the undo | nothing can be changed; a pending or switching record is refused at start | the safety yes | start Docker, then `recover` |
| The old image pruned | `rollback` and `recover` load it from the run's backup folder | yes | keep that folder |
| The backup folder lost as well, and the image gone | refused before anything stops | no | restore the image from the separately saved copy (`docker load`) |
| The backup drive full or removed mid-run | journal writes fail without stopping the undo (`JOURNAL WRITE FAILED`); the console output is the record | the undo yes | read the console output; `recover` |
| The switch back of a rollback fails | the record is restored onto the new MinIO and it is restarted, verified. If the name is held by anything else, or the record cannot be restored, nothing is started and it says NOTHING SERVES | partly | act by hand if it says so |
| A rollback rerun finds the old store changed | `ROLLED BACK WITH DIFFERENCES` (exit 1), the differences listed | no | judge the differences |
| A state none of the above produces | refused, never guessed | no | inspect: `journal.jsonl` holds every step, undo step, record attempt and outcome |

Recoverable is not the same as available:
- `recover` brings back the old MinIO, which holds the data as it was at the stop, plus anything written
  after the undo;
- the target volume stays as it was, and what it received after the switch is listed.

**What no part of this does:** run the move without the founder's approval, delete a volume, or claim a
state it did not read back.

## Afterwards

- Record the date, the counts and the backup folder in the overnight register (ISSUE-INFRA-001).
- `adulis-pgdata` is referenced by nothing. **Do not delete it**: deleting needs the founder's approval
  (ISSUE-INFRA-005). Its PostgreSQL data is archived and restore-tested
  (`WO-INFRA-008-LEGACY-DATABASE-ARCHIVE.md`).
