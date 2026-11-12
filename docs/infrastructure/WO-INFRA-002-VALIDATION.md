# WO-INFRA-002 -- Validation evidence

All runs used resources created for the run (`infra-test-*`) and removed afterwards. Nothing named
`adulis-*` or `nac-trial-*` was started, stopped, recreated or written. Logs are in
`G:\AdulisDevelopment\WO-INFRA\logs\`; the scripts are in `...\scratch\`.

## 1. The corrected compose file, run for real (`compose-storage-validation.log`, 2026-11-12T22:22Z)

The committed file was run as project `infra-test`. Only the project name, the three container names
and the two physical volume names were rewritten; the script prints that diff. Host ports came from
`POSTGRES_HOST_PORT=55434` and `MINIO_HOST_PORT=19100`. **Result: 18 of 18 checks pass.**

| Check | Result |
|---|---|
| PostgreSQL and MinIO healthy; `minio-init` exits 0 | PASS |
| `db/init` ran: four extensions; `adulis_app` can log in | PASS |
| Buckets `adulis-media` and `adulis-evidence`; evidence private | PASS |
| PostgreSQL mounts `infra-test_adulis-pgdata`, MinIO mounts `infra-test_adulis-miniodata`; distinct | PASS |
| Object upload, then anonymous retrieval through the host port | PASS |
| Row and object survive `docker compose restart` | PASS |
| Row and object survive `docker compose down` (volumes kept) and `up` | PASS |
| The init is idempotent on the second start | PASS |
| No MinIO files in the PostgreSQL volume; no PostgreSQL files in the MinIO volume | PASS |

## 2. Resolved configuration (`compose-config-resolved.yml`)

Run from this checkout, `docker compose config` resolves to:
- `name: adulis-platform`;
- volume `adulis-pgdata` named `adulis-platform_adulis-pgdata`;
- volume `adulis-miniodata` named `adulis-platform_adulis-miniodata`;
- both services on the pinned MinIO digest.

## 3. Rehearsal of the live data move (`minio-migration-rehearsal.log`, 2026-11-12T22:24Z)

- **"Old":** tonight's tar of the live volume `adulis-pgdata`, restored into a disposable volume. It was
  served by the exact image the live MinIO runs (`minio/minio@sha256:14cea493...`, cached locally).
- **"New":** the corrected configuration's image on a fresh volume.
- **Procedure:** runbook steps 2 to 6. **Result: 15 of 15 checks pass.**

| Check | Result |
|---|---|
| Old copy lists 1,568 media and 7 evidence objects, plus 17 phantom PostgreSQL buckets | observed |
| Init on new; `mc mirror --preserve` of both buckets | PASS |
| Object counts equal (1,568 / 7); `mc diff` empty for both buckets | PASS |
| Sample object: same bytes (sha256) and same Content-Type (`image/webp`) | PASS |
| After the switch, new lists only `adulis-evidence/` and `adulis-media/` | PASS |
| Policies download / private; exactly one lifecycle rule | PASS |
| The old copy still holds its PostgreSQL files | PASS |

## 4. What was not validated
- **The live move itself:** BLOCKED, pending approval.
- **Recreating the founder's running containers with the new file:** not done, because it would switch
  the live MinIO to the empty new volume before the move.
