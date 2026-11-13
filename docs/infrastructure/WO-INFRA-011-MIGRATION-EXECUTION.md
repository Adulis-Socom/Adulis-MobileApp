# WO-INFRA-011 -- Migration execution

**NOT EXECUTED. BLOCKED PENDING FOUNDER APPROVAL.**

The work order states that it does not authorise the live cutover. No separate approval for "the live
MinIO move" exists in this session, so the move was not run. The following were **not** used:
- `MIGRATE_LIVE=approved`;
- the old manual runbook;
- any change to `adulis-minio`, `adulis-pgdata` or `adulis-platform_adulis-pgdata`.

| | |
|---|---|
| Approved checkout | none approved |
| Source volume | `adulis-pgdata` (unchanged) |
| Destination volume | `adulis-platform_adulis-miniodata` (not created) |
| Writers stopped | not applicable (nothing was run; no writer was running) |
| Final backup | not taken; it is taken only by a live `migrate` |
| Copy and cutover | not run |
| Before-and-after counts | before: 1,568 / 7 (preflight). After: none, nothing was moved |
| Failures and recovery (task 6) | none: nothing was attempted |

## When approval is given, the exact procedure
From a checkout of the merged `main` (preferably the Work checkout, after its local work is preserved),
in Git Bash at the repository root:

```
grep -q '^MINIO_HOST_PORT=9100' .env || echo 'MINIO_HOST_PORT=9100' >> .env   # once per checkout
docker image inspect minio/minio:latest >/dev/null || docker load -i G:/AdulisDevelopment/WO-INFRA-FOLLOWUP/backup/minio-old-image-14cea493d9a3.tar
node ops/scripts/minio-migrate.mjs plan                                      # expect PLAN OK
export MIGRATE_BACKUP_DIR=G:/AdulisDevelopment/minio-move/$(date -u +%Y%m%dT%H%M%SZ)
MIGRATE_LIVE=approved node ops/scripts/minio-migrate.mjs migrate 2>&1 | tee "$MIGRATE_BACKUP_DIR.log"
```

Then run the checks in `WO-INFRA-011-POST-CUTOVER-VALIDATION.md`.

**Rollback:** `MIGRATE_LIVE=approved MIGRATE_BACKUP_DIR=<that folder> node ops/scripts/minio-migrate.mjs rollback`.
Before rolling back, read its "changes after the switch" list: objects uploaded after the cutover stay in
the new volume and must not be discarded silently.
