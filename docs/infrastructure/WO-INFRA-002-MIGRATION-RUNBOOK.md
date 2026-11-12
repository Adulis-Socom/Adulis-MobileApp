# WO-INFRA-002 -- MinIO data move runbook (local development stack)

**Status: PREPARED AND REHEARSED; NOT RUN ON LIVE DATA.** The live move needs the founder's approval
(ISSUE-INFRA-001). Run it once, on the development machine, after this branch is merged or checked out.

## What it does

It copies the MinIO objects out of the old volume `adulis-pgdata` into the new volume
`adulis-platform_adulis-miniodata`, then switches MinIO to the new volume.

- **It copies; it does not move.** Nothing is deleted. The old volume keeps the original objects and the
  old PostgreSQL directory until the founder decides about it (ISSUE-INFRA-005).
- **It is a logical copy (`mc mirror`), not a file copy.** A file copy would carry over MinIO's metadata
  for the 17 phantom PostgreSQL "buckets", and the root-owned files the old image wrote, which the
  new non-root image cannot write.
- **PostgreSQL is not touched.** It keeps `adulis-platform_adulis-pgdata`.

## Rehearsal

Rehearsed at 2026-11-12T22:24Z on disposable copies, using tonight's backup of the live volume and the
exact image the live MinIO runs (`logs/minio-migration-rehearsal.log`):
- 1,568 media and 7 evidence objects were copied;
- `mc diff` was empty for both buckets;
- bytes and content-type matched on a sample;
- the new volume has only the two real buckets, with the right policies and one lifecycle rule;
- the old copy was untouched.

## Before you start

**Never run `docker compose down -v` with this file.** The project name is now pinned, so from any
clone that command deletes the live database volume `adulis-platform_adulis-pgdata` and the new MinIO
volume. Plain `docker compose down` keeps both.

- Run from the checkout that will own the stack, in Git Bash, at the repository root.
- Prefix the `docker` commands with `MSYS_NO_PATHCONV=1`.
- Docker Desktop is running, and `adulis-minio` is up (`docker ps`).
- Nothing should be uploading media for the few minutes this takes. Stop the API if it is running.
- The live MinIO is on host port 9100 today. Keep that port with `export MINIO_HOST_PORT=9100` before
  step 5, or update `R2_ACCOUNT_ID` and `R2_MEDIA_PUBLIC_ORIGIN` in `.env`.

```
IMG=cgr.dev/chainguard/minio@sha256:786cb11d340b1a657de8dc899560e36e1d1fb371d3d6f3eb6c903a0bb0cec714
NET=adulis-platform_default
CREDS="-e MINIO_ROOT_USER=adulis-local -e MINIO_ROOT_PASSWORD=adulis-local-secret"
```

## Steps

**1. Back up the old volume.** Re-take it even though one exists from the night of 13 November:

```
mkdir -p /g/AdulisDevelopment/minio-move && cd /g/AdulisDevelopment/minio-move
docker run --rm --entrypoint tar -v adulis-pgdata:/src:ro pgvector/pgvector:pg17 -C /src -cf - . > adulis-pgdata.tar
sha256sum adulis-pgdata.tar > adulis-pgdata.tar.sha256
cd -
```

**2. Start a temporary MinIO on the new volume, beside the old one:**

```
docker volume create adulis-platform_adulis-miniodata
docker run -d --name adulis-minio-new --network $NET $CREDS \
  -v adulis-platform_adulis-miniodata:/data $IMG server /data
docker run --rm --network $NET -e MINIO_URL=http://adulis-minio-new:9000 $CREDS \
  -v "$(pwd -W)/ops/scripts/minio-init.sh:/minio-init.sh:ro" --entrypoint /bin/sh $IMG /minio-init.sh
```

If the init fails with "connection refused", the server was still starting: run the init again.

**3. Copy the two buckets from the running old server:**

```
M="-e MC_HOST_old=http://adulis-local:adulis-local-secret@adulis-minio:9000 \
   -e MC_HOST_new=http://adulis-local:adulis-local-secret@adulis-minio-new:9000"
docker run --rm --network $NET $M --entrypoint /bin/sh $IMG -c \
  'mc mirror --preserve old/adulis-media new/adulis-media && mc mirror --preserve old/adulis-evidence new/adulis-evidence'
```

**4. Verify before switching.** Both `mc diff` lines must print nothing, and the counts must match:

```
docker run --rm --network $NET $M --entrypoint /bin/sh $IMG -c \
  'mc diff old/adulis-media new/adulis-media; mc diff old/adulis-evidence new/adulis-evidence;
   for b in adulis-media adulis-evidence; do echo "$b old=$(mc ls -r old/$b | wc -l) new=$(mc ls -r new/$b | wc -l)"; done'
```

If anything differs, **stop here**. Remove the temporary server (`docker rm -f adulis-minio-new`); the
old stack is unchanged.

**5. Switch.** Remove the temporary server, then let compose recreate MinIO on the new volume:

```
docker rm -f adulis-minio-new
export MINIO_HOST_PORT=9100     # keep today's port (see "Before you start")
docker compose up -d
```

Compose also recreates `adulis-postgres` if its definition changed. It stays on the same volume, so
no data moves.

**6. Check:**

`docker compose up -d` exits 0 even when `minio-init` fails, so check the init's own exit code:

```
docker inspect adulis-minio --format '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{end}}'
#   adulis-platform_adulis-miniodata -> /data
docker compose wait minio-init         # prints 0; anything else: read `docker logs adulis-minio-init`
docker exec adulis-minio sh -c 'export MC_HOST_l=http://adulis-local:adulis-local-secret@localhost:9000;
  mc ls l; mc ls -r l/adulis-media | wc -l'
#   only adulis-evidence/ and adulis-media/; 1568 or more objects
```

## Rollback

Until the old volume is deleted, rolling back is two commands. Nothing was written to the old volume
except MinIO's own bookkeeping while it served the copy.

```
docker rm -f adulis-minio
git checkout <commit before ba74372> -- docker-compose.yml && docker compose up -d minio
```

## Afterwards

- Record the date and the counts in the overnight register (ISSUE-INFRA-001).
- `adulis-pgdata` is now referenced by nothing. **Do not delete it** until the founder decides about the
  old database (ISSUE-INFRA-005).
- Deleting it is a destructive operation and needs that approval.
