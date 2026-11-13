# WO-INFRA-009 -- Founder handoff (readiness)

The consolidated handoff for the whole batch is
`docs/overnight/OVERNIGHT-INFRA-FOLLOWUP-HANDOFF-2026-11-13.md`. This page answers the ten readiness
questions of the work order, from evidence.

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Is CI/CD operational? | **Yes, CI is, on both branches.** Every push runs all 31 gates on both branches, on Node 24 actions, without warnings (final runs 43390992801 and 43391044138). On the candidate there is no mobile suite: `main` has no mobile app yet. **CD:** not in scope; nothing deploys from CI | `WO-INFRA-009-FINAL-VERIFICATION.md` |
| 2 | Is the development environment stable? | **Yes.** The live `adulis-postgres` and `adulis-minio` ran untouched through the batch; the volume count is back to 26 | `OVERNIGHT-INFRA-FOLLOWUP-HANDOFF-2026-11-13.md` section C |
| 3 | Are Docker volumes correctly configured? | **In the compose file, yes:** separate, explicitly named volumes for PostgreSQL and MinIO, with the project pinned. **On the machine, not yet:** the running MinIO still uses `adulis-pgdata` until the move runs | `docker-compose.yml`, ISSUE-INFRA-001 |
| 4 | Is the existing MinIO data safely migrated? | **No: BLOCKED pending your approval.** The move is ready and rehearsed: a full move, a rollback and ten failure modes | `WO-INFRA-007-CUTOVER-AND-ROLLBACK.md` |
| 5 | Is the historical PostgreSQL database preserved? | **Yes.** Archived and restore-tested on the SSD; the original volume is untouched; the physical copy is also kept | `WO-INFRA-008-LEGACY-DATABASE-ARCHIVE.md` |
| 6 | Is the infrastructure-only integration candidate ready? | **Yes, for review and merge.** It is green in CI and merges clean with the finalization branch and with `810fb27` | `WO-INFRA-008-INTEGRATION-TESTS.md` |
| 7 | Any P0 infrastructure issues unresolved? | **One:** ISSUE-INFRA-001, the live MinIO move. It is blocked only by the approval | registers |
| 8 | Any P1 infrastructure issues unresolved? | **One:** ISSUE-INFRA-FOLLOWUP-004, the merge vehicle for the mobile line (use the finalization branch, not WO-022 alone). It is a decision, not a defect | follow-up register |
| 9 | Can Mobile development continue safely? | **Yes.** No file in `apps/mobile` changed in this batch, and the mobile suite runs in CI (520 of 520). New mobile branches get real CI once they include these fixes | CI runs |
| 10 | What remains before production deployment? | Not infrastructure-ready for production, and not assessed as such: production's existence and backups are unknown (ISSUE-INFRA-017); there is no production blueprint in the repository (only `ops/render.yaml` for staging); no secret-scan, native-build or additive-contract gates exist; actions are pinned by tag, not SHA | ISSUE-INFRA-017, the risk register |

## Decisions for you, in order
1. **Approve the MinIO move** (ISSUE-INFRA-001) and choose the checkout that runs it.
2. **Choose the merge path:** option A recommended (`WO-INFRA-008-MERGE-RECOMMENDATION.md`). Keep
   `810b598` in the candidate (ISSUE-INFRA-FOLLOWUP-006).
3. **Add `MINIO_HOST_PORT=9100`** to the `.env` of the checkout that runs the stack
   (ISSUE-INFRA-FOLLOWUP-002).
4. **After the move is verified,** decide whether to delete `adulis-pgdata` (ISSUE-INFRA-005). Its
   database is archived.
5. **Dev database orphans** (ISSUE-INFRA-FOLLOWUP-005): point the API tests at a disposable database
   and clean the orphans, in a separate change.
6. **Production:** confirm whether it exists and how it is backed up (ISSUE-INFRA-017).
7. **Re-authorise the GitHub MCP plugin** with `/mcp` (ISSUE-INFRA-010).
