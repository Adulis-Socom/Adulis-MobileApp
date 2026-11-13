# Local stack: when `docker compose up` is safe (WO-INFRA-015A)

This page says how to start the local PostgreSQL and MinIO with `docker compose` without losing sight
of MinIO's objects, and how the database scripts decide what they may reset.

## The protections in `docker-compose.yml`

1. **`ADULIS_MINIO_VOLUME` is required.**
   - It names MinIO's data volume.
   - **Unset:** every `docker compose` command stops at configuration time with a message naming
     this page. Nothing is created, replaced or started.
   - **Why it is needed:** compose replaces a running container before it checks any dependency, so
     only refusing to run at all can keep a running MinIO serving.
   - `.env.example` carries the line commented out, so copying the template cannot set it by
     accident.
2. **The data-volume guard** (`x-minio-volume-guard` at the top of the compose file).
   - **Where it runs:** inline, with no file from a checkout:
     - as the one-shot service `minio-volume-guard` (root) before MinIO;
     - inside the minio service before `minio server`.
   - **What it refuses** while the legacy volume `adulis-pgdata` holds MinIO data (or cannot be read):
     - an empty data volume;
     - a data volume holding MinIO data without the record of a completed move
       (`.adulis-migration-complete`, written by `minio-migrate.mjs` once the copy is verified, just
       before the switch, and removed by any undo). That
       covers a partial copy, or a store started before the move.
   - **What it refuses always:**
     - the legacy volume itself used as the data volume;
     - a data volume holding files that are not MinIO's.
   - **What counts as MinIO data:** a formatted drive (`.minio.sys/format.json`). The empty
     `.minio.sys` that the MinIO image places in every new volume does not count.
3. **`adulis-pgdata` is an external volume.**
   - Compose never creates it, and never deletes it, `docker compose down -v` included.
   - The guard mounts it read-only only.

Both ports are published on **127.0.0.1 only** by default. That covers:
- the API;
- the console;
- the e2e gate;
- an Android emulator (through `10.0.2.2`);
- a device using `adb reverse`.

## The five situations

### 1. An existing installation, before the MinIO move

This is the state of a machine whose MinIO still runs on `adulis-pgdata`.

- **Leave `ADULIS_MINIO_VOLUME` unset.**
- **Do not run `docker compose up`:** it will refuse, and that is the intent.
- **Starting services:** the running containers restart on their own (`restart: unless-stopped`). To
  start one by hand, use `docker start adulis-postgres` or `docker start adulis-minio`.
- **If the variable was set by mistake and compose ran:**
  - the old MinIO container has been replaced, and the guard has kept the new one from starting, so
    nothing serves;
  - the objects are still in `adulis-pgdata`;
  - remove the variable;
  - restore the old container from the checkout that created it (its older compose file:
    `docker compose up -d minio` there);
  - the move remains possible later: an empty new volume that holds only the image's `.minio.sys`
    skeleton is accepted by `minio-migrate.mjs` as empty;
  - do not delete any volume.

### 2. The approved move

Follow `docs/infrastructure/WO-INFRA-002-MIGRATION-RUNBOOK.md`. It needs the founder's approval
(`MIGRATE_LIVE=approved`).
- `ADULIS_MINIO_VOLUME=adulis-platform_adulis-miniodata` is exported in that shell only.
- `plan` and `migrate` refuse, before anything stops, if the source holds a bucket the move would not
  copy. The PostgreSQL directories that share the volume are expected.
- **An interrupt (Ctrl+C)** stops the run at the next step, and the old MinIO is put back. No success
  line is printed for a run that was interrupted.
- **What the undo leaves behind:** the new volume is removed again. If that fails, the undo reports
  UNDO PARTIAL and names the volume to remove.
- **Logging:** pipe the run through `tee -i`, so a Ctrl+C does not end the logger.

### 3. After a successful move

Put this line in the root `.env`:
```
ADULIS_MINIO_VOLUME=adulis-platform_adulis-miniodata
```
From then on, `docker compose up -d` is the normal command:
- the guard finds MinIO data and the move record in the data volume, and accepts;
- `adulis-pgdata` stays mounted read-only by the guard only;
- it is kept until the founder decides otherwise.

The first `compose up` after the move also recreates `adulis-postgres` once, because its port is now
published on 127.0.0.1 only. Its data volume is kept.

### 4. A rollback

Follow the runbook's Rollback section. It clears the move record in the new volume. Afterwards:
- remove `ADULIS_MINIO_VOLUME` from the root `.env`;
- the old MinIO serves `adulis-pgdata` again, published on 127.0.0.1;
- any compose command refuses until the next move.

### 5. A fresh machine

```
cp .env.example .env
#   then uncomment ADULIS_MINIO_VOLUME=adulis-platform_adulis-miniodata in .env
docker volume create adulis-pgdata   # once: the empty legacy volume the guard reads
docker compose up -d
```
- The guard reads the empty `adulis-pgdata` as "nothing to move", and MinIO formats its new volume.
- Later starts are accepted because the data volume holds MinIO data and the legacy volume none.

## Deliberate LAN access

Set `ADULIS_BIND_ADDRESS=0.0.0.0` for that one command. Example:
`ADULIS_BIND_ADDRESS=0.0.0.0 docker compose up -d`.
- **What it exposes:** PostgreSQL and MinIO on every interface, with the local credentials in this
  repository.
- **When to use it:** only on a trusted network, and only for as long as needed.
- **To go back:** restart without the variable, which returns to loopback.

## What the database scripts may reset

| Command | Target it accepts |
|---|---|
| `pnpm db:determinism` | only a disposable server. `ADULIS_PG_CONTAINER` must name its container, and the script proves that container is the server `DATABASE_URL_MIGRATE` reaches (port, system identifier, the disposable mark, no named or host data directory). There is no default container |
| `pnpm verify:console-e2e` | only databases carrying the disposable mark, checked before it builds, resets or seeds anything |
| `pnpm db:reset` | a database carrying the disposable mark; or a persistent database named exactly for that one run: `pnpm db:reset -- --confirm-target=<database>@<host>:<port>` (explicit port required), recorded in `.adulis-db-admin.log`. No environment variable can stand in for the confirmation |
| `pnpm db:seed` | NODE_ENV development or test, and a local host only |
| `pnpm db:migrate`, `pnpm worker:install` | additive. Also used by the deploy blueprint (`ops/render.yaml`), so they do not require a disposable target |

The disposable test environment for all of them:
```
bash ops/scripts/test-db.sh up
eval "$(bash ops/scripts/test-db.sh env)"   # also exports ADULIS_PG_CONTAINER
pnpm ci:local                               # or any single gate or suite
bash ops/scripts/test-db.sh down
```
