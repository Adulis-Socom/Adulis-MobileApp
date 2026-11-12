# WO-INFRA-006 -- Open issues at the end of the batch

These are the 9 issues that are not resolved. The full entries are in
`docs/overnight/OVERNIGHT-INFRA-ISSUES-2026-11-13.md`.

| Issue | Severity | Status | What remains | Who acts |
|---|---|---|---|---|
| ISSUE-INFRA-001 | P0 | BLOCKED | Live MinIO objects are still in the old volume; run the rehearsed runbook | founder approves, then anyone runs it (about 5 minutes) |
| ISSUE-INFRA-005 | P2 | NEEDS FOUNDER DECISION | The pre-2026-09-03 PostgreSQL 17 directory in volume `adulis-pgdata`: keep, export or discard | founder |
| ISSUE-INFRA-012 | P3 | NEEDS FOUNDER DECISION | Reconcile with `810fb27` and the uncommitted `ci.yml` edits in the other checkout before merging | founder |
| ISSUE-INFRA-017 | P2 | NEEDS FOUNDER DECISION | Production environment and backup status unknown | founder |
| ISSUE-INFRA-010 | P3 | OPEN | Re-authorise the GitHub MCP plugin | founder (`/mcp`) |
| ISSUE-INFRA-016 | P3 | OPEN | Node 20 action majors deprecated; runner now ubuntu-26.04 | next infrastructure change |
| ISSUE-INFRA-027 | P3 | OPEN | Verify the image signature with `cosign` | before the merge |
| ISSUE-INFRA-011 | P3 | DEFERRED | `pgvector/pgvector:pg17` is a moving tag | only if determinism drifts |
| ISSUE-INFRA-013 | P3 | DEFERRED | The local media bucket is anonymously listable (R2 is not) | optional |

Residual risks without an issue of their own (`WO-INFRA-001-RISK-REGISTER.md`):
- **R-05:** the Chainguard digest's lifetime on the free tier.
- **R-11:** MinIO is empty until the move.
- **ISSUE-INFRA-015:** a new API suite that sends concurrent requests without `app.listen` would
  reintroduce the race.
