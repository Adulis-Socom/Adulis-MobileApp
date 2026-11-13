# WO-INFRA-014 -- Remaining risks

Every unresolved item across the three registers, classified. History is kept in each register; this is
the current view.

## Blocked on founder approval (nothing technical left)

| Item | Risk while blocked | Unblocks with |
|---|---|---|
| Merge the candidate into `main` (ISSUE-INFRA-CLOSURE-002, ISSUE-INFRA-012) | `main` keeps a dead MinIO image, a seed that refuses CI, a scope filter that can pass vacuously, and no test-database guard. Every push to `main` is red or meaningless | approval of PR #105, then `WO-INFRA-010-POST-MERGE-VERIFICATION.md` |
| Live MinIO move (ISSUE-INFRA-001, ISSUE-INFRA-CLOSURE-003) | compose with the new file starts MinIO empty (nothing lost) | approval, then `WO-INFRA-011-MIGRATION-EXECUTION.md` |
| Development database repair (ISSUE-INFRA-CLOSURE-011, ISSUE-INFRA-FOLLOWUP-005) | its dumps restore with five foreign keys missing; queries over those tables see 192 rows that break their keys | approval, then `WO-INFRA-013-REPAIR-PLAN.md` |

## Open: founder decisions

| Item | Risk | Recommended |
|---|---|---|
| The Work checkout's MOB-WO-0 local work, on no remote (ISSUE-INFRA-CLOSURE-012) | a disk failure or reset loses it; it collides with WO-001 to WO-022 | commit to a local branch and push it today; decide which foundation continues |
| `MINIO_HOST_PORT` in the Work checkout's `.env` (ISSUE-INFRA-FOLLOWUP-002) | a plain `docker compose up` there cannot start MinIO | add the line |
| Merge vehicle for the mobile line (ISSUE-INFRA-FOLLOWUP-004) | merging WO-022 alone brings back the supertest race in four suites | use `infra/wo-infra-010-014-closure` |
| `810b598` in the candidate (ISSUE-INFRA-FOLLOWUP-006) | none | keep |
| Delete `adulis-pgdata` (ISSUE-INFRA-005) | irreversible, but its contents are archived twice | after the MinIO move is verified |
| Production and its backups (ISSUE-INFRA-017) | unknown recoverability; only a staging blueprint exists in the repository | confirm whether production exists, and how it is backed up |
| The five teardown leak classes (ISSUE-INFRA-CLOSURE-004) | bounded by the ratchet; growth within the five keys goes unnoticed | a test-maintenance work order (24 files listed) |
| Object store not guarded for tests (ISSUE-INFRA-CLOSURE-006) | a misconfigured local run writes test objects into the live MinIO | extend the guard to the R2 endpoint |

## Open: technical, no decision needed

| Item | Risk | Next step |
|---|---|---|
| GitHub MCP plugin (ISSUE-INFRA-010) | none functional (`gh` works) | re-authorise with `/mcp` |
| Moving PostgreSQL tag (ISSUE-INFRA-011, DEFERRED) | determinism drift if pgvector republishes | revisit only on drift |
| Chainguard digest retention not guaranteed (R-05) | a pinned digest could someday 404 (observed 6 months retained) | re-pin with a signature check when needed |
| Actions pinned by tag, not SHA | a compromised tag would run in CI | Dependabot or Renovate with SHA pins |
| Docker's disk at 49.84 GB; about 21 GB of build cache | C: has about 28 GB free | `docker builder prune` reclaims cache only (not volumes); compacting the disk is a founder action |
| RAM (2 GB free with a game and Docker running) | native Android testing unreliable | close heavy programs; stop `nac-trial`; consider a `.wslconfig` cap |

## Resolved in this batch
- ISSUE-INFRA-CLOSURE-001: Docker restarted.
- ISSUE-INFRA-CLOSURE-005: the API suites' default target.
- ISSUE-INFRA-CLOSURE-007: the load tests.
- ISSUE-INFRA-CLOSURE-008: `pnpm ci:local`.
- ISSUE-INFRA-CLOSURE-009: the vacuous gate.
- ISSUE-INFRA-CLOSURE-010: `test-db.sh`.
- The independent-review findings: `WO-INFRA-014-FINAL-AUDIT.md`.

## Not verified at all
- **A CI run on `main`:** none, since nothing was merged.
- **Native Android or iOS:** not tested since WO-018 (`MOBILE-NATIVE-VALIDATION-BACKLOG.md`).
- **Production:** deployment, monitoring, backups and recovery are unknown.
- **The live MinIO move and the live database repair:** both are approval-gated; neither was run.
