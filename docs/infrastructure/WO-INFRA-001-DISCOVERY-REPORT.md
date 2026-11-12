# WO-INFRA-001 -- Infrastructure discovery and safety audit

**Status: COMPLETE.** 13 November 2026 (UTC times). Branch `infra/wo-infra-001-006-stabilization`.
Issues are numbered as in `docs/overnight/OVERNIGHT-INFRA-ISSUES-2026-11-13.md`.

## 1. Work order
WO-INFRA-001, infrastructure discovery and safety audit.

## 2. Objective
Establish the real state of the local stack, CI and scripts before changing anything, and change nothing
destructive.

## 3. Investigations performed
- Repository: branch, HEAD, remote, newer commits. `3cad2e3` (WO-022 head) already contains all of
  `origin/main` (`01302cf`), so nothing newer exists to base on.
- Docker: every container, volume and mount (`docker ps -a`, `docker inspect`, `docker volume inspect`),
  read-only listings inside the MinIO volume.
- Git history of `docker-compose.yml`.
- CI: the workflow, the run history (last 200 runs) and the failed-step logs of six runs.
- Registries: manifest lookups (no pulls) for the MinIO images and controls.
- Scripts: `gates.mjs`, `seed.mjs`, `db-reset.mjs`, `db-determinism.mjs`, `verify-console-e2e.mjs`,
  `verify-boot-smoke.mjs`, root `package.json`, `.env.example`, `playwright.config.ts`.
- Resources: RAM, commit charge, disks, page file, Docker disk use; the storage audit
  (`logs/storage-audit-start.log`).

## 4. Confirmed findings

**Local stack** (Docker Desktop, engine 29.8.2, linux/amd64):

| Container | Image | Host port | Data volume | Notes |
|---|---|---|---|---|
| `adulis-postgres` | `pgvector/pgvector:pg17` (PostgreSQL 17.11) | 5434 | `adulis-platform_adulis-pgdata` (created 2026-09-03) | databases `adulis` 25 MB, `adulis_gates` 16 MB |
| `adulis-minio` | `minio/minio:latest` (RELEASE.2025-09-07T16-13-09Z) | 9100 | `adulis-pgdata` (created 2026-08-26) | 1,568 media objects, 7 evidence objects |
| `adulis-minio-init` | `minio/mc` | - | - | exited 0, two months ago |
| `adulis-final-check` | `pgvector/pgvector:pg17` | 55444 | anonymous volume | exited (255) two months ago; leftover, untouched |

The `nac-trial-*` containers and volumes belong to another project and were not touched.

- **The two volumes are separate today, but misnamed.** MinIO writes into `adulis-pgdata`, the original
  database volume, beside a complete PostgreSQL 17 data directory last written 2026-09-03 (about 145 MB).
  PostgreSQL runs on a newer volume (ISSUE-INFRA-001, ISSUE-INFRA-005).
- **MinIO lists the 17 PostgreSQL directories as buckets** (`base`, `global`, `pg_wal`, ...) and has
  written bucket metadata for them.
- **The running stack belongs to another checkout**, `C:\Users\naods\Documents\Work\adulis-platform`. It
  is on `ci/scope-filter-main-push` with uncommitted changes (ISSUE-INFRA-006). That checkout was not
  touched.
- **Policies on the live MinIO:**
  - `adulis-media` is `download` (anonymous GET, and anonymous LIST, ISSUE-INFRA-013).
  - `adulis-evidence` is `private`.
  - Three identical `evidence/raw/` 1-day expiry rules (ISSUE-INFRA-007).

**CI:**
- **The last green run was 2026-09-04 on main.** Main then failed at gate `migrate`
  (`refusing to seed with NODE_ENV=unset`, ISSUE-INFRA-003).
- **Every branch since 2026-11-08 failed before any gate,** at "Start object storage", because
  `minio/minio:latest` cannot be pulled (ISSUE-INFRA-002, ISSUE-INFRA-009).
- **Scoped gates select zero packages and pass,** on a push to main and on root-only branches
  (ISSUE-INFRA-004).
- **The bucket setup ends in `|| true`** (ISSUE-INFRA-008).

**Registries:**
- `docker.io/minio/minio` answers 404 and `quay.io/minio/minio` answers 401, for every tag tried.
- `minio/mc` is denied the same way.
- Public control images resolve.

**Environment handling:**
- These scripts refuse an unset `NODE_ENV`, each against a closed list:
  - `seed.mjs`, `db-reset.mjs` and `verify-console-e2e.mjs` allow only development or test.
  - `db-determinism.mjs` validates against its own closed set.
  - `db-reset.mjs` also refuses a non-local host.
- `gates.mjs` drops `NODE_ENV=development`, and CI sets no `NODE_ENV`.
- `determinism` and `console-e2e` already declared `NODE_ENV=test`; the seed step could not.

**Persistent data and backups:**
- No backup of the local volumes existed.
- Production backup status is **UNKNOWN**:
  - `docker-compose.yml` says production is managed PostgreSQL on Render with point-in-time recovery.
  - `ops/render.yaml` is unapplied, and the T23 notes record that no Render credentials were found.
  - Nothing here can verify that production backups exist.
- A recovery point was taken tonight (see the recovery plan).

**Resources:**
- **Memory:** 15.7 GB RAM; 0.4 to 1.1 GB free during the night; commit charge about 38 of 44.5 GB.
- **Disk:** C: had 31.9 GB free at the audit. Docker's data disk is 47.3 GB on C:.
- **Docker's own usage:** images 15.4 GB, volumes 2.8 GB, build cache 28.2 GB (21.4 GB reclaimable).
  The build cache is shared with other projects; nothing was pruned.

## 5. Root causes
- **ISSUE-INFRA-001:** commit `2cb0baf` (T20 S4) inserted `adulis-miniodata:` above the existing
  `name: adulis-pgdata` line.
- **ISSUE-INFRA-002:** MinIO stopped serving community images from both registries. The cached local
  copy hid this.
- **ISSUE-INFRA-003:** `steps` in `gates.mjs` could not carry an environment.
- **ISSUE-INFRA-004:** pnpm exits 0 on an empty filter, and root files belong to the excluded root
  project.

## 6. Files inspected
`docker-compose.yml`, `.github/workflows/ci.yml`, `ops/scripts/gates.mjs`, `ops/scripts/seed.mjs`,
`ops/scripts/db-reset.mjs`, `ops/scripts/db-determinism.mjs`, `ops/scripts/verify-console-e2e.mjs`,
`ops/scripts/verify-boot-smoke.mjs`, `apps/console/playwright.config.ts`, `package.json`,
`.env.example`, `.gitattributes`, `db/init/*.sql`, `docs/engineering/DEVELOPMENT-STORAGE-POLICY.md`,
`ops/scripts/adulis-ssd-env.sh`.

## 7. Files modified
None in this work order; it only adds the overnight register and these three reports.

## 8. Verification commands
`docker inspect`, `docker volume inspect`, `docker exec adulis-minio ls -la /data`,
`docker exec adulis-minio mc ls local`, `docker buildx imagetools inspect <ref>`,
`curl https://hub.docker.com/v2/repositories/minio/minio/`, `gh run list`, `gh run view <id> --log-failed`,
`git log -p -- docker-compose.yml`, `ops/scripts/adulis-storage-audit.ps1`.

## 9. Actual results
As in section 4. Evidence:
- `G:\AdulisDevelopment\WO-INFRA\logs\image-availability.txt`
- `storage-audit-start.log`
- the CI run logs cited in the register.

## 10. Security assessment
- **Evidence bucket:** private, confirmed by anonymous GET and LIST returning 403.
- **Media bucket:** anonymously listable locally. That is pre-existing, and Cloudflare R2's public
  origin does not list (ISSUE-INFRA-013).
- **Credentials:** only the documented local fakes appear in compose and CI. No real secret was found in
  the files read.
- **CI's MinIO step:** it hid failures. The evidence bucket is still created private by default.

## 11. Regression assessment
Nothing was changed, so nothing could regress.

## 12. Issues encountered
ISSUE-INFRA-001 to ISSUE-INFRA-013.

## 13. Issues resolved
None in this work order; fixes are in WO-INFRA-002 to 004.

## 14. Issues remaining
See the register.

## 15. Founder decisions required
ISSUE-INFRA-005: keep, export or discard the old database found inside MinIO's volume.

## 16. Commit SHA
The documentation commit that adds this file. There is no code in this work order.

## 17. Final status
**COMPLETE.** Every inspection item was done; no destructive operation was run.
