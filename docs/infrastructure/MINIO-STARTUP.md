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
       (`.adulis-migration-complete`). That covers a partial copy, or a store started before the move;
     - a record that is only **pending** (INF-04). `minio-migrate.mjs` writes `pending <run>` once the
       copy is verified, just before the switch. The guard accepts that only during that run's own
       switch, and **only once**: the switched MinIO's own start rewrites it `switching <run>`, which
       every start refuses, a restart of that same container included (Docker restart, crash,
       `docker start`; rehearsed). The record becomes `complete <run>` only after the switched MinIO is
       verified. So a record that an undo could not clear (Docker down, the console closed) is refused at
       every later start;
     - a record in any other form, and a data volume holding `.adulis-migration-invalidated` or
       `.adulis-migration-rolled-back` (the names an undo, a recovery or a rollback renames the record
       to).
   - **What it refuses always:**
     - the legacy volume itself used as the data volume;
     - a data volume holding files that are not MinIO's.
   - **What counts as MinIO data:** a formatted drive (`.minio.sys/format.json`). The empty
     `.minio.sys` that the MinIO image places in every new volume does not count.
3. **`adulis-pgdata` is an external volume.**
   - Compose never creates it, and never deletes it, `docker compose down -v` included.
   - The guard mounts it read-only only.
   - So are the database volume `adulis-platform_adulis-pgdata` and MinIO's own volume, in this
     compose file (WO-INFRA-015B): through it, `docker compose down -v` deletes no volume.
   - **Still never run `docker compose down -v`.** A checkout with an older compose file (such as
     the one that created the running stack) still deletes the live database volume and
     `adulis-pgdata` with it, and the command stops the live containers from any checkout. Use
     plain `docker compose down`.

**MinIO's host port defaults to 9100** (INF-04; it was 9000). 9000 is where another project's MinIO
often listens: on the development machine it is the Nehemiah Autism Center stack, so a 9000 default
could point the API at the wrong store. `MINIO_HOST_PORT` still overrides it, and `.env.example`'s
`R2_ACCOUNT_ID` and `R2_MEDIA_PUBLIC_ORIGIN` use 9100 to match. Inside Docker, MinIO still listens on
9000 (`http://minio:9000`).

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
- **Run no compose command at all, from any checkout** (`up`, `down`, `ps` and `logs` included): it
  will refuse, and that is the intent. Use `docker ps`, `docker logs` and `docker start` instead.
  Never set the variable just to get compose back (PHASE-002B-01 review M3).
- **Keep the old MinIO image:** it can no longer be pulled. Do not prune images before the move, and
  keep a copy: `docker save -o <folder>/minio-legacy-image.tar minio/minio:latest` (it only reads the
  image), in a folder other than the run's `MIGRATE_BACKUP_DIR`, which must start empty.
  `minio-migrate.mjs migrate` saves its own copy into the run's backup folder, where rollback looks.
- **Starting services:** the running containers restart on their own (`restart: unless-stopped`). To
  start one by hand, use `docker start adulis-postgres` or `docker start adulis-minio`. **Once a move has
  started** (its backup folder exists), do not start MinIO containers by hand: run `recover` or
  `rollback` (runbook).
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
- **What the undo leaves behind:**
  - Before the switch, the new volume is removed again; if that fails, the undo reports UNDO PARTIAL
    and names the volume to remove.
  - From the step that writes the record on (even if that write failed), the new volume is kept: it may
    hold the only copy of later writes. The undo renames the record aside, with up to four attempts, and
    counts it cleared only when a separate read finds it gone.
  - After the switch, the new MinIO is **retired**: stopped (checked), its configuration and logs saved in
    the run folder, and the container removed, so no copy of it can be started again. What the target
    received after the switch is measured and listed; any change makes the outcome UNDO PARTIAL with a
    MANUAL ACTION.
  - If every record attempt fails (Docker unavailable, for example), the undo says so (UNDO PARTIAL,
    MANUAL ACTION REQUIRED, with the state read back). A pending or switching record is refused at every
    start.
  - It never claims more than it read back. The runbook's "Recovery limits" has the full list.
- **Ctrl+Break** is treated like Ctrl+C (WO-INFRA-015B).
- **Closing the console window** is not something the tool can undo in full. Windows ends Node, and the
  docker commands with it, within seconds, so the undo may stop part-way. Do not close the window during
  a move.
  - If it happened, run `minio-migrate.mjs recover` with the same `MIGRATE_BACKUP_DIR` (approval as for
    the move) before anything else.
  - It reads what was left and renames any record aside.
  - It retires a new MinIO it finds serving the target, and brings the old MinIO back on `adulis-pgdata`
    from its recorded configuration.
  - It **measures what the target received after the switch** and lists every object added, changed or
    deleted. If there is anything, it ends RECOVERY INCOMPLETE: copy back what must be kept.
  - It never deletes a volume, and running it twice changes nothing.
  - Rehearsed after a real window close (INF-04).
- **Rollback** loads the old image from the run's backup folder if it was pruned.
- **Logging:** pipe the run through `tee -i`, so a Ctrl+C does not end the logger.

### 3. After a successful move

Put this line in the root `.env`:
```
ADULIS_MINIO_VOLUME=adulis-platform_adulis-miniodata
```
From then on, `docker compose up -d && docker compose wait minio-init` is the normal command (see
"Checking that the buckets were set up" below):
- the guard finds MinIO data and a **complete** move record in the data volume, and accepts;
- `adulis-pgdata` stays mounted read-only by the guard only;
- it is kept until the founder decides otherwise.

The first `compose up` after the move:
- **recreates `adulis-postgres` once,** because its port is now published on 127.0.0.1 only. Its data
  volume is kept;
- **recreates `adulis-minio` once,** because the switch variable the move used is gone. The guard
  accepts the complete record (rehearsed, INF-04).

### 4. A rollback

Follow the runbook's Rollback section. It renames the move record aside, verified, **before** it stops
anything, so even a rollback that is killed part-way never leaves a record a later start could serve.
A rerun finishes a rollback that was interrupted. Afterwards:
- remove `ADULIS_MINIO_VOLUME` from the root `.env`;
- the old MinIO serves `adulis-pgdata` again, published on 127.0.0.1;
- any compose command refuses until the next move.

### 5. A fresh machine

```
cp .env.example .env
#   then uncomment ADULIS_MINIO_VOLUME=adulis-platform_adulis-miniodata in .env
docker volume create adulis-pgdata   # once: the empty legacy volume the guard reads
docker volume create adulis-platform_adulis-pgdata     # once: the database volume (WO-INFRA-015B)
docker volume create adulis-platform_adulis-miniodata  # once: the MinIO volume (WO-INFRA-015B)
docker compose up -d && docker compose wait minio-init
```
- All three volumes are external: compose stops with "external volume ... not found" until they exist,
  and this compose file's `down -v` never deletes them (still, never run it: see section 3 above).
- The guard reads the empty `adulis-pgdata` as "nothing to move", and MinIO formats its new volume.
- Later starts are accepted because the data volume holds MinIO data and the legacy volume none.

## Checking that the buckets were set up (WO-INFRA-015B)

`docker compose up -d` exits 0 even when the one-shot `minio-init` fails, for example on a policy
step. Follow it with `docker compose wait minio-init`, which exits with the init's own status
(rehearsed: 0 when it succeeded, 3 when it failed with 3). Do not use `docker compose up -d --wait`:
this Compose (5.7) reports any exited one-shot container as a failure, so it exits 1 even when the
init succeeded (rehearsed).

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
