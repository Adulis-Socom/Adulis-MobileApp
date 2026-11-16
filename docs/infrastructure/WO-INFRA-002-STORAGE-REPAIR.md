# WO-INFRA-002 -- Docker storage isolation repair

**Status: PARTIALLY COMPLETE.** The configuration is fixed and validated. The live MinIO data move is
prepared and rehearsed, but BLOCKED pending founder approval. 13 November 2026.

## 1. Work order
WO-INFRA-002, Docker storage isolation repair.

## 2. Objective
Give PostgreSQL and MinIO separate physical volumes without losing or moving existing data unapproved.

## 3. Investigations performed
- Resolved configuration (`docker compose config`) before and after the change.
- Physical volume names and mounts of the running containers.
- Git history of the volumes block.
- Contents of both live volumes (read-only).

## 4. Confirmed findings
- **The two services were never writing one volume at the same time,** but the configuration was wrong
  (ISSUE-INFRA-001):
  - The explicit `name: adulis-pgdata` had moved to MinIO in `2cb0baf`.
  - MinIO writes into the original database volume, beside an orphaned PostgreSQL 17 data directory.
  - PostgreSQL uses a project-prefixed volume created when that commit was first run.
- **Any checkout from before `2cb0baf` would make the collision real:** it mounts `adulis-pgdata` as
  PostgreSQL's data directory while MinIO uses it.
- **The project name came from the directory.** This workspace's checkout (`Adulis-MobileApp`) would have
  been a different compose project from the running one, which belongs to another checkout
  (ISSUE-INFRA-006).

## 5. Root causes
- An insertion in the wrong place in the YAML: a nameless key took the next key's `name`.
- Implicit, directory-derived names hid the change.

## 6. Files inspected
`docker-compose.yml`, its history (`eb8c8bd`, `883bb36`, `2cb0baf`), `db/init/*.sql`.

## 7. Files modified
`docker-compose.yml`:
- top-level `name: adulis-platform`;
- explicit `name:` on both volumes:
  - `adulis-platform_adulis-pgdata`, unchanged, the volume the database uses today;
  - `adulis-platform_adulis-miniodata`, new;
- a comment that tells the reader where the old objects are and that the old volume must not be deleted.

## 8. Verification commands
- `docker compose config`;
- `G:\AdulisDevelopment\WO-INFRA\scratch\validate-compose-storage.sh` (disposable project);
- `rehearse-minio-migration.sh` (disposable copies).

Details are in `WO-INFRA-002-VALIDATION.md`.

## 9. Actual results
- **Compose validation:** 18 of 18 checks pass.
- **Migration rehearsal:** 15 of 15 checks pass. All 1,568 media and 7 evidence objects were copied,
  and `mc diff` was empty.
- **Resolved configuration:** each service gets its own physical volume, and the PostgreSQL volume name
  is unchanged.

## 10. Security assessment
- No credential changed; the compose file still carries only the documented local fakes.
- The evidence bucket stays private on the new volume, verified in the rehearsal and validation.

## 11. Regression assessment
- **PostgreSQL:** keeps its volume, so no data moves.
- **MinIO:** the first `docker compose up` with this file gives it a new, empty volume. The old objects
  are not lost, but they are not visible until the runbook is run. This is the one behaviour change; the
  compose file and the runbook say so (risk R-11).

## 12. Issues encountered
- ISSUE-INFRA-001, 005, 006.
- Two of my own validation-script bugs, fixed before the recorded run: an env prefix that did not reach
  `mc` after a pipe, and a wrong extension name.

## 13. Issues resolved
- ISSUE-INFRA-001: configuration resolved.
- ISSUE-INFRA-006: the project name is pinned.

## 14. Issues remaining
- **The live data move** (runbook): BLOCKED, needs founder approval.
- **ISSUE-INFRA-005:** the old database inside the old volume; a founder decision.

## 15. Founder decisions required
- Approve the live MinIO move: run `WO-INFRA-002-MIGRATION-RUNBOOK.md`.
- Decide what happens to the old PostgreSQL 17 directory and, after the move, to the volume `adulis-pgdata`.

## 16. Commit SHA
`ba74372`

## 17. Final status
**PARTIALLY COMPLETE.** The configuration is corrected and validated on disposable volumes. The live
migration is BLOCKED by the safety rule; no live data was touched.
