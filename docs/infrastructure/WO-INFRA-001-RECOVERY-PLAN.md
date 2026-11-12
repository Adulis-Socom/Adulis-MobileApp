# WO-INFRA-001 -- Backup and recovery plan (local development stack)

13 November 2026. This covers the local Docker stack only. **Production backup status is UNKNOWN:** no
production access exists from this machine, and `ops/render.yaml` has never been applied (see the
discovery report).

## 1. Recovery point taken tonight

Taken at 2026-11-12T22:14Z, before any configuration change. It is on the external SSD, outside the
repository, in `G:\AdulisDevelopment\WO-INFRA\backup\`:

| File | What | Size |
|---|---|---|
| `adulis.dump` | `pg_dump -Fc` of the development database `adulis` | 0.7 MB |
| `adulis_gates.dump` | `pg_dump -Fc` of `adulis_gates` | 0.8 MB |
| `globals.sql` | roles (`pg_dumpall --globals-only --no-role-passwords`) | 1.4 KB |
| `minio-volume-adulis-pgdata.tar` | read-only tar of the whole volume `adulis-pgdata`: MinIO's data plus the old PostgreSQL directory, 7,064 entries | 162 MB |
| `SHA256SUMS.txt` | checksums of the above | - |

The tar was proven restorable: WO-INFRA-002 restored it into a disposable volume, served it with the
exact image the live MinIO runs, and listed all 1,568 media and 7 evidence objects.

Verify integrity before any restore:

```
cd /g/AdulisDevelopment/WO-INFRA/backup && sha256sum -c SHA256SUMS.txt
```

## 2. Restore procedures

These are commands for a person to run deliberately. Nothing restores automatically.

**A database, into a NEW database (non-destructive).** Replace `<name>` with a new name:

```
docker exec adulis-postgres createdb -U adulis_bootstrap <name>
docker exec -i adulis-postgres pg_restore -U adulis_bootstrap -d <name> --no-owner < adulis.dump
```

Restoring over `adulis` itself means dropping it first. That is destructive and needs the founder.

**The MinIO volume, into a NEW volume (non-destructive):**

```
MSYS_NO_PATHCONV=1 docker volume create <new-volume>
MSYS_NO_PATHCONV=1 docker run --rm -i -v <new-volume>:/dst --entrypoint tar pgvector/pgvector:pg17 \
  -C /dst -xf - < minio-volume-adulis-pgdata.tar
```

Then serve it with the image that wrote it (`minio/minio@sha256:14cea493...`, still cached on this
machine), or mirror it as in `WO-INFRA-002-MIGRATION-RUNBOOK.md`.

**The old PostgreSQL 17 directory inside that tar** (pre-2026-09-03) can be started read-only in a
throwaway container for a `pg_dump`. Doing so is part of ISSUE-INFRA-005's decision.

## 3. Rolling back tonight's changes

| Change | Rollback | Data effect |
|---|---|---|
| Compose volume names, project name (`ba74372`) | `git revert ba74372` | None: no live container was recreated tonight |
| MinIO image and init script (`3b9bbc6`) | `git revert 3b9bbc6` | None locally (the old image is still cached); CI would fail again at the image pull |
| Gate runner (`bbbadac`) | `git revert bbbadac` | None |

No live container, volume or database was modified, recreated or deleted during the batch. All
validation ran on `infra-test-*` and `infra-gates-*` resources that were created and removed by the
batch.

## 4. Known gaps

- **No scheduled local backups.** Each work order that runs a destructive gate uses a disposable
  database instead. That is the existing practice, and it is unchanged.
- **Tonight's backup is a snapshot.** It ages; re-take it immediately before running the migration
  runbook (step 1 of the runbook does this).
- **Production:** unknown, founder action (risk R-09).
