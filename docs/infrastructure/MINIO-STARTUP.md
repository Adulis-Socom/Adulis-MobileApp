# Local stack: when `docker compose up` is safe (WO-INFRA-015A)

This page says how to start the local PostgreSQL and MinIO with `docker compose` without losing sight
of MinIO's objects, and how the database scripts decide what they may reset.

## The two protections in `docker-compose.yml`

1. **`ADULIS_MINIO_VOLUME` is required.**
   - It names MinIO's data volume.
   - **Unset:** every `docker compose` command stops at configuration time with a message naming
     this page. Nothing is created, replaced or started.
   - **Why it is needed:** compose replaces a running container before it checks any dependency, so
     no check inside a container can keep a running MinIO serving. Only refusing to run at all can.
2. **The data-volume guard** (`ops/scripts/minio-volume-guard.sh`).
   - **Where it runs:**
     - as the one-shot service `minio-volume-guard`, as root, before MinIO;
     - inside the minio service, before `minio server`.
   - **What it refuses:**
     - an empty data volume while the legacy volume `adulis-pgdata` holds MinIO data (or cannot be
       read);
     - the legacy volume itself used as the data volume.
   - "MinIO data" means a formatted drive (`.minio.sys/format.json`). The empty `.minio.sys` that the
     MinIO image places in every new volume does not count.
   - **When it refuses:** MinIO is not started, so it never serves an empty store, and the objects
     stay where they are.

Both ports are published on **127.0.0.1 only** by default. That covers:
- the API;
- the console;
- the e2e gate;
- an Android emulator (through `10.0.2.2`);
- a device using `adb reverse`.

## The five situations

### 1. An existing installation, before the MinIO move

This is the state of a machine whose MinIO still runs on `adulis-pgdata`.

- **Leave `ADULIS_MINIO_VOLUME` unset.** Do not copy it from `.env.example`.
- **Do not run `docker compose up`:** it will refuse, and that is the intent.
- **Starting services:** the running containers restart on their own (`restart: unless-stopped`). To
  start one by hand, use `docker start adulis-postgres` or `docker start adulis-minio`.
- **If the variable was set by mistake and compose ran:**
  - the old container has been replaced, and the guard has kept the new one from starting, so
    nothing serves;
  - the objects are still in `adulis-pgdata`;
  - restore the old container from the checkout that created it, or follow the runbook's Rollback.
  - Do not delete any volume.

### 2. The approved move

Follow `docs/infrastructure/WO-INFRA-002-MIGRATION-RUNBOOK.md`. It needs the founder's approval
(`MIGRATE_LIVE=approved`).
- `ADULIS_MINIO_VOLUME=adulis-platform_adulis-miniodata` is set in that shell.
- `plan` and `migrate` refuse, before anything stops, if the source holds a bucket the move would not
  copy. The PostgreSQL directories that share the volume are expected.
- **An interrupt (Ctrl+C)** stops the run at the next step, and the old MinIO is put back. No success
  line is printed for a run that was interrupted.

### 3. After a successful move

Put this line in the root `.env`:
```
ADULIS_MINIO_VOLUME=adulis-platform_adulis-miniodata
```
From then on, `docker compose up -d` is the normal command:
- the guard sees MinIO data in the data volume and accepts;
- `adulis-pgdata` stays mounted read-only by the guard only;
- it is kept until the founder decides otherwise.

### 4. A rollback

Follow the runbook's Rollback section. Afterwards:
- remove `ADULIS_MINIO_VOLUME` from the root `.env`;
- the old MinIO serves `adulis-pgdata` again;
- any compose command refuses until the next move.

### 5. A fresh machine

```
cp .env.example .env        # includes ADULIS_MINIO_VOLUME=adulis-platform_adulis-miniodata
docker compose up -d
```
- On first start, compose creates `adulis-pgdata` empty. The guard reads that as "nothing to move"
  and MinIO formats its new volume.
- Later starts are accepted because the data volume holds MinIO data.

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
| `pnpm db:determinism` | only a disposable server. `ADULIS_PG_CONTAINER` must name its container, and the script proves that container is the server `DATABASE_URL_MIGRATE` reaches (port, system identifier, the disposable mark). There is no default container |
| `pnpm verify:console-e2e` | only databases carrying the disposable mark, checked before it builds, resets or seeds anything |
| `pnpm db:reset` | a database carrying the disposable mark; or a persistent database named exactly for that one run: `pnpm db:reset -- --confirm-target=<database>@<host>:<port>`, recorded in `.adulis-db-admin.log`. No environment variable can stand in for the confirmation |
| `pnpm db:seed` | NODE_ENV development or test, and a local host only |
| `pnpm db:migrate`, `pnpm worker:install` | additive. Also used by the deploy blueprint (`ops/render.yaml`), so they do not require a disposable target |

The disposable test environment for all of them:
```
bash ops/scripts/test-db.sh up
eval "$(bash ops/scripts/test-db.sh env)"   # also exports ADULIS_PG_CONTAINER
pnpm ci:local                               # or any single gate or suite
bash ops/scripts/test-db.sh down
```
