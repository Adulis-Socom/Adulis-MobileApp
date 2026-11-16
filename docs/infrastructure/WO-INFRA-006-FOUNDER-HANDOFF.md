# WO-INFRA-006 -- Founder handoff

**CI is green again.** The batch is executed. The start-here document is
`docs/overnight/OVERNIGHT-INFRA-MORNING-HANDOFF-2026-11-13.md`; this page is the short version.

## What changed
- **CI:** it runs all 30 gates and passes, for the first time since 4 September. Run 43324138043 at
  `bac327a`.
- **Object storage:** MinIO comes from a maintained image, pinned by digest. The old one no longer
  exists on Docker Hub or quay.io.
- **The seed:** it runs in CI.
- **Scoped runs:** they can no longer pass while checking nothing.
- **Storage:** the compose file gives PostgreSQL and MinIO separate, explicitly named volumes. The
  database keeps its current volume.
- **API suites:** five suites no longer flake in CI.

## What you need to decide

1. **The MinIO data move (needed before using the new compose file locally).**
   - Your current MinIO objects live in the volume named `adulis-pgdata`.
   - `WO-INFRA-002-MIGRATION-RUNBOOK.md` copies them to the new volume; it was rehearsed on tonight's
     backup.
   - **Recommended:** approve and run it the first time you bring the stack up from a checkout that has
     this branch.
2. **The old database found inside that volume (pre-3 September).**
   - **Recommended:** keep it until the move is done.
   - Then either export it with `pg_dump` from a throwaway container, or discard it.
3. **Merge order:**
   - Compare this branch with `ci/scope-filter-main-push` and with the uncommitted edits in
     `C:\Users\naods\Documents\Work\adulis-platform`.
   - **Recommended:** merge this branch first. Its scope fail-safe also covers the main-push case that
     `810fb27` fixes.
4. **Production backups:** confirm whether production exists and is backed up. Nothing here could check.

## What I changed outside infrastructure files
Five API test files gained one line each: `app.listen(0, '127.0.0.1')`. It is a test-harness fix for a
supertest race, proven with a standalone reproduction. Please review it as the backend owner.

## Never run
`docker compose down -v` with the new file. It would delete the live database volume from any clone.
