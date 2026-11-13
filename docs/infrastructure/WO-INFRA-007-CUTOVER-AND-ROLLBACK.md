# WO-INFRA-007 -- Cutover and rollback (live MinIO move)

**Live cutover: BLOCKED.** It needs the founder's explicit approval (ISSUE-INFRA-001). This batch did not
receive one, so nothing below was run on live data. Everything was rehearsed on disposable copies
(`WO-INFRA-007-MIGRATION-VALIDATION.md`).

## Decide first

1. **Approve the move.** Copying about 3 MiB of objects takes about two minutes of MinIO downtime.
2. **Which checkout runs it.** The live stack belongs to `C:\Users\naods\Documents\Work\adulis-platform`
   (branch `ci/scope-filter-main-push`, with uncommitted work). That checkout does not have the new
   compose file. Options:
   - **(a) Recommended:** merge the infrastructure change to `main` first (see
     `WO-INFRA-008-MERGE-RECOMMENDATION.md`), bring the Work checkout to it with its uncommitted work
     preserved, then run the move there. Compose ownership stays where it is.
   - **(b)** Run it from a checkout of this branch (for example
     `...\Adulis-Mobile-Workspace\Adulis-MobileApp`). Only the `minio` container's compose labels then
     point at that checkout; `adulis-postgres` keeps the Work checkout's.

## Pre-cutover checklist (the script refuses if any of these fails)

| Check | How |
|---|---|
| Exact compose project | `plan` prints it: `adulis-platform` |
| Running containers | `adulis-minio` running, compose service `minio` of `adulis-platform`, mounting `adulis-pgdata` |
| Active ports | MinIO must be published on the port the source uses: 9100. Set `MINIO_HOST_PORT=9100` |
| Source and destination volumes | `adulis-pgdata` -> `adulis-platform_adulis-miniodata` (absent or empty) |
| Backup integrity | A fresh backup is taken of the stopped volume, then verified and restored, during the run |
| Source inventory | Printed by `plan`; re-read at the start of `migrate` |
| Target health | Private target server ready, then init exit 0 |
| Writers stopped | **By hand: stop the API and the console dev server.** The script itself freezes writes by stopping `adulis-minio` |

## Cutover commands (Git Bash, repository root of the chosen checkout)

```
export MINIO_HOST_PORT=9100
node ops/scripts/minio-migrate.mjs plan                       # read-only; expect "PLAN OK"

export MIGRATE_BACKUP_DIR=G:/AdulisDevelopment/minio-move/$(date -u +%Y%m%dT%H%M%SZ)
MIGRATE_LIVE=approved node ops/scripts/minio-migrate.mjs migrate 2>&1 | tee "$MIGRATE_BACKUP_DIR.log"
echo "exit=${PIPESTATUS[0]}"                                  # 0 only after every check below passed
```

## Post-cutover checks (done by the script; repeatable by hand)

| Check | Script | By hand |
|---|---|---|
| Correct volume mounted | Refuses unless `/data` is `adulis-platform_adulis-miniodata` | `docker inspect adulis-minio --format '{{range .Mounts}}{{.Name}}{{end}}'` |
| Init exited successfully | `docker wait adulis-minio-init` must print 0 | the same |
| Both buckets, and only them | Inventory through port 9100 | `docker exec adulis-minio sh -c 'export MC_HOST_l=http://adulis-local:adulis-local-secret@localhost:9000; mc ls l'` |
| Counts and content | Every object compared with the stopped source's restored backup: size, ETag, SHA-256, metadata | `manifest.json` |
| Evidence private | Anonymous list, read and write must be denied | `curl -s -o /dev/null -w '%{http_code}' http://localhost:9100/adulis-evidence/` -> 403 |
| Media retrieval | Anonymous read returns the same bytes | Open a product image in the console or app (`R2_MEDIA_PUBLIC_ORIGIN`) |
| Application | Not automated | Start the API; create a product image in the console; it uploads to and reads from port 9100 |

## Rollback

**Automatic:** any failure after `adulis-minio` is stopped puts the old service back. Rehearsed for
eight failure kinds, including init failing and the new MinIO never becoming healthy.

**On request, after a successful move:**

```
MIGRATE_LIVE=approved MIGRATE_BACKUP_DIR=<the same folder> node ops/scripts/minio-migrate.mjs rollback
```

- **What it does:**
  - stops the new MinIO and renames it `adulis-minio-migrated-<run>`;
  - recreates `adulis-minio` from the configuration recorded before the move: the same image id,
    environment, port, network alias, restart policy, and `adulis-pgdata` at `/data`;
  - waits for it to answer;
  - lists the objects written after the switch. Those exist only in the new volume and the renamed
    container, which are kept.
- **What it never does:** delete a container or a volume, touch PostgreSQL, run `git checkout`, or
  change a file in any checkout.
- **Afterwards:** `docker compose up` fails on the port, which is deliberate. To try again later, the
  founder decides what happens to the objects written after the switch, and to the kept volume.

**If Docker itself fails mid-run** and the script cannot undo, by hand:
```
docker ps -a --filter name=adulis-minio      # see what exists
docker start adulis-minio                    # if the original container still exists (before the switch)
# after the switch: rename the new container aside, then recreate from $MIGRATE_BACKUP_DIR/legacy-container.json
```
The original data is never at risk: `adulis-pgdata` is only ever mounted read-only by the script, and the
fresh backup is in `$MIGRATE_BACKUP_DIR`.

## What stays protected
- **`adulis-platform_adulis-pgdata` and `adulis-postgres`:** never named, mounted or recreated by the
  script.
- **`adulis-pgdata`:** read-only throughout. Deleting it later needs separate approval
  (ISSUE-INFRA-005).
- **Other projects:** `nac-trial-*` and every other container and volume are untouched. The script
  only creates and removes resources named `minio-migrate-<run>-*`.
