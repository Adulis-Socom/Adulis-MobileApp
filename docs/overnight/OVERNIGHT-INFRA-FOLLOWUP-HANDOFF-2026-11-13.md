# Infrastructure follow-up handoff -- 13 November 2026 (WO-INFRA-007 to 009)

**Branches:** pushed, **nothing merged**.
- `infra/wo-infra-007-009-finalization`: this batch, on top of the first infrastructure branch.
- `infra/main-integration-candidate`: `main` plus the infrastructure only.

**Start here; then:**
- `OVERNIGHT-INFRA-FOLLOWUP-ISSUES-2026-11-13.md`: this batch's issues;
- `OVERNIGHT-INFRA-ISSUES-2026-11-13.md`: the first batch's, updated.

## A. Executive summary

- **The MinIO move is now safe to run, but it has not run.**
  - The hand-run runbook (12 weak points) is replaced by a script that verifies every object by content
    and metadata, and undoes itself on any failure.
  - It was rehearsed: a full move in 63 seconds, a rollback, and ten deliberate failures, each refused
    with the old MinIO still serving.
  - The **live move is BLOCKED**: it needs your approval.
- **The old database is preserved and understood.**
  - It started cleanly from a copy (shut down cleanly on 3 September).
  - It turned out to be only migrations 0001-0048 plus the seed fixture.
  - It is archived on the SSD and restore-tested; the original volume is untouched.
- **There is an infrastructure-only path to `main`.**
  - A candidate branch carries the infrastructure fixes without the 253 mobile-line commits.
  - It is green in CI.
  - `main` also needed one test fix (a hard-coded date that expired on 12 September), which you had
    already written on the mobile line.
- **The supply chain is checked.** The MinIO image's signature and provenance verify against
  Chainguard's release workflow, with 0 known vulnerabilities.
- **CI is modernised.** The CI actions are on their Node 24 majors.
- **The media bucket is closed for listing.** Anyone on the network could list every media key; now
  only single objects are readable.

## B. Work-order results

| Work order | Status | Completed | Remaining |
|---|---|---|---|
| WO-INFRA-007 | **PARTIALLY COMPLETE** | Runbook audit; fail-closed migration script with automatic verification and undo; backup verification (existing backup OK); rehearsal of the full procedure and ten failure modes; cutover and rollback commands | **Live cutover BLOCKED** (no approval) |
| WO-INFRA-008 | **COMPLETE** | Legacy database recovered from a copy, compared, archived, restore-tested; branches mapped; the other checkout inspected read-only; integration candidate built and green; merge options written | Your merge decision |
| WO-INFRA-009 | **COMPLETE** | Signature, SBOM and provenance verified; vulnerability scan; vendor assessment; actions upgraded; media listing closed; risk review; final CI | GitHub MCP re-authorisation; production backups (yours) |

## C. Data migration

| | |
|---|---|
| Source volume | `adulis-pgdata` (mounted by `adulis-minio`, port 9100) |
| Destination volume | `adulis-platform_adulis-miniodata` (does not exist yet) |
| Backup status | Existing backup (2026-11-12T22:14:35Z) verified today: all checksums match; the tar is complete and holds the MinIO data and the old database. Each live run takes and verifies a fresh one of the stopped volume |
| Source object counts | 1,568 media, 7 evidence (re-read 07:21Z; 17 phantom PostgreSQL "buckets", not copied) |
| Destination object counts | none yet (live). In rehearsal: 1,568 and 7, identical by SHA-256, ETag, size and metadata |
| Verification results | Rehearsal: all checks passed on the success path; every injected fault refused (`WO-INFRA-007-MIGRATION-VALIDATION.md`) |
| Cutover status | **BLOCKED**, pending your approval |
| Rollback readiness | Automatic on failure; `rollback` command after success; both rehearsed |
| Existing data modified | **No.** `adulis-minio`, `adulis-postgres` and both volumes are unchanged (same containers and start times) |
| Founder approval required | **Yes**: ISSUE-INFRA-001 |

## D. Legacy database

| | |
|---|---|
| Condition | Intact: a clean shutdown at 2026-09-03 10:02:39 UTC; it starts without recovery |
| Recoverable | Yes, from the backup copy (the original volume was never mounted) |
| Content | `adulis`: migrations 0001-0048 plus the seed fixture of 2026-09-03 09:59; every row matches today's database except the seed timestamps. `adulis_t1`: an old test database. `adulis_det`: empty |
| Archive | `pg_dump` of all three, roles without password hashes, `pg_controldata`, checksums |
| Restoration verification | Fresh PostgreSQL 17, `--exit-on-error`: all three restore, and every per-table row count matches |
| Storage location | `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\legacy-db\`; the physical copy is in `G:\AdulisDevelopment\WO-INFRA\backup\` |
| Remaining risks | None to the data. The volume stays until you decide (keep it until the MinIO move is verified) |

## E. Git branches

| | |
|---|---|
| Current development branch | `mobile/wo-022-messaging-reliability-hardening` (`3cad2e3`) = `main` + 253 commits |
| Infrastructure branches | `infra/wo-infra-001-006-stabilization` (`bfa24bf`); `infra/wo-infra-007-009-finalization` (this batch) |
| Integration candidate | `infra/main-integration-candidate` = `main` + the infrastructure commits + `810b598` |
| Commits included | The six first-batch infrastructure commits (`1a8c6f7` reduced to the one suite `main` has); `810b598` (your test-only date fix); this batch's infrastructure commits |
| Commits excluded | The other 252 mobile-line commits; `810fb27`; everything in the Work checkout |
| Overlapping changes | `810fb27` merges clean (redundant with the scope fail-safe). The Work checkout's uncommitted `gates.mjs` collides only at the end of the gate list. Four listen-first suites exist only on the mobile line |
| Conflicts | None unresolved. Four modify/delete conflicts on the candidate were resolved by keeping the files absent, as on `main` |
| Recommended merge strategy | **Option A:** merge the candidate first; bring the mobile line in later through the finalization branch (`WO-INFRA-008-MERGE-RECOMMENDATION.md`) |

## F. CI/CD results

See `WO-INFRA-009-FINAL-VERIFICATION.md` for every run.

| | Finalization branch | Integration candidate |
|---|---|---|
| Workflow | [43390992801](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43390992801) | [43391044138](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43391044138) |
| Final commit | `7418d82` (final code) | `de1ae19` (final code) |
| Gates executed | 31 of 31 (unscoped) | 31 of 31 (unscoped) |
| Tests passed | API 983 of 983, mobile 520 of 520, `console-e2e` 88, `gate-runner` 13, `minio-migrate` 11, permission matrix 252 cells | API 635 of 635, `console-e2e` 88, `gate-runner` 13, `minio-migrate` 11, permission matrix 252 cells |
| Tests failed | 0 | 0 |
| Skipped | 0 steps skipped (16 of 16 success) | 0 (16 of 16) |
| Not executed | no gate exists for a secret scan, native builds or the additive-only contract differ | the same, plus no mobile suite (`main` has the placeholder app) |

**`main` itself has not run** these fixes: nothing was merged. The documentation commit that follows also runs CI; its result is in the final message, not in this file.

## G. Security

| | |
|---|---|
| Container image verification | Signature, SBOM and SLSA provenance verified with cosign (identity: Chainguard's release workflow; a wrong identity fails). Grype: 0 known vulnerabilities |
| Credentials and secrets | No secret added (scan of all 1,986 added lines: only the documented local fakes). The legacy roles were exported without password hashes. The script never prints credentials |
| Storage permissions | Evidence private (policy plus anonymous probes in every rehearsal). Media now `GetObject` only, so listing is closed (ISSUE-INFRA-013) |
| Data-preservation controls | The live guard (`MIGRATE_LIVE=approved`); the source mounted read-only; the backup verified and restored before the copy; undo on failure; `rollback` deletes nothing |
| Security regressions | None found; independent reviews in section H |
| Supply-chain risks | The free tier guarantees no digest lifetime (observed at least six months); no vulnerability attestation from Chainguard; `mc` frozen upstream; actions pinned by major tag, not SHA |

## H. Issues register

**This batch** (`OVERNIGHT-INFRA-FOLLOWUP-ISSUES-2026-11-13.md`):

| Metric | Count |
|---|---|
| Total new issues | 9 |
| Resolved | 6 (001, 003, 006 on the candidate, 007, 008, 009) |
| Open | 3 (002 guarded, 004, 005) |
| Blocked | 0 |
| Deferred | 0 |
| Founder decisions required (marked YES) | 4 (002, 004, 005, 006) |

**First batch register** (`OVERNIGHT-INFRA-ISSUES-2026-11-13.md`), updated with dated notes; nothing
deleted:

| Status | Issues |
|---|---|
| Resolved | 21 |
| Open | 1 (010) |
| Blocked | 1 (001, the live move only) |
| Deferred | 1 (011) |
| Needs your decision | 3 (005 deletion only, 012, 017) |

**P0 unresolved:** 1 (ISSUE-INFRA-001).
**P1 unresolved:** 1 (ISSUE-INFRA-FOLLOWUP-004, a merge-vehicle decision).

## I. Founder decisions required

| # | Problem | Options | Risks | Recommended | If postponed |
|---|---|---|---|---|---|
| 1 | The MinIO objects still live in `adulis-pgdata` (ISSUE-INFRA-001) | (a) run the rehearsed move; (b) start MinIO empty and re-seed; (c) keep running the old compose file | (a) about 2 min of MinIO downtime; automatic undo. (b) the local media is lost. (c) the misnamed volume stays | **(a)**, after option A is merged, from the checkout that owns the stack | Any `docker compose up` with the new file starts an empty MinIO; nothing is lost, but confusing |
| 2 | Which checkout runs the stack | The Work checkout (owns it today; uncommitted mobile-foundation work) or a checkout of the merged change | Compose labels for `minio` move to whichever runs the move | The Work checkout, after bringing it to the merged `main` with its work preserved | The move waits |
| 3 | Merge path (ISSUE-INFRA-012, FOLLOWUP-004) | A: candidate first, mobile line later via the finalization branch. B: the finalization branch at once | A: two merges. B: 253 commits, 10 migrations and `packages/*` in one review | **A** | `main` stays red and its CI keeps proving nothing |
| 4 | `810b598` travels with the infrastructure merge (FOLLOWUP-006) | Keep it, or drop it and accept a red `main` | none (test only, your own commit) | **Keep** | `main` fails one test on the calendar |
| 5 | `MINIO_HOST_PORT` in `.env` (FOLLOWUP-002) | Add `MINIO_HOST_PORT=9100` | none | **Add** | A plain `docker compose up` cannot start MinIO (port 9000 taken) |
| 6 | Delete `adulis-pgdata`? (ISSUE-INFRA-005) | Keep it, or delete it after the move is verified | Deletion is irreversible, but the data is archived twice (the physical tar and the logical dumps) | Keep it until the move is verified, then delete | 162 MB stays used |
| 7 | Dev database orphans (FOLLOWUP-005) | Point the API tests at a disposable database; clean the orphans in an approved change | Cleaning touches dev data | Both, in a separate work order | Dev backups restore with 5 constraints missing |
| 8 | Production (ISSUE-INFRA-017) | Confirm whether production exists and how it is backed up | Unknown recoverability | Confirm before any production data exists | Unknown risk |
| 9 | GitHub MCP (ISSUE-INFRA-010) | `/mcp` re-authorise | none | Re-authorise | `gh` keeps working instead |

## J. Final development readiness

| Area | Readiness | Basis |
|---|---|---|
| Frontend (mobile) development | **Ready** | No `apps/mobile` file changed; the mobile suite runs in CI (520 of 520); new branches get real CI once they include these fixes |
| Local infrastructure | **Ready with one step pending** | The stack is unchanged and healthy. The new compose file is correct, but MinIO's data needs the approved move before it is used locally |
| CI | **Ready** | All gates run and pass on both branches, on Node 24 actions, with no deprecation warnings. Scope fail-safe in place |
| Merge | **Ready for your decision** | The candidate is green and merges clean with the finalization branch and `810fb27`. The Work checkout's `gates.mjs` needs a one-line append resolution. Nothing merged |
| Production | **Not assessed, not ready** | Production's existence and backups are unknown; the repository has only a staging blueprint; no secret-scan or native-build gates |

**Not done in this batch:**
- the live MinIO move (needs approval);
- any merge;
- any change to the Work checkout;
- deleting `adulis-pgdata`;
- cleaning the dev database's orphans;
- a CI run on `main` itself.

## Storage (DEVELOPMENT-STORAGE-POLICY)

Audits are in `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\logs\storage-audit-*.log`.

1. **Start** (06:43Z): C: 30,689,136,640 bytes free; G: 3,353,040,912,384.
2. **Before cleanup:** C: 28,004,954,112; G: 3,350,055,616,512.
3. **After cleanup:** C: 27,689,062,400; G: 3,352,036,376,576.
4. **Net growth:**
   - C: free fell by 3,000,074,240 bytes. The main cause is Docker's data disk, which grew from
     47.34 GB to 49.84 GB with the rehearsal volumes, snapshots and two scanner images. They were all
     deleted inside Docker, but the virtual disk does not shrink by itself.
   - The page file is unchanged (22.99 GB allocated).
   - G: free fell by 1,004,535,808 bytes. exFAT allocates 1 MiB per file.
5. **Generated** in `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP`: 128,877,072 bytes apparent.
   - the legacy-database archive (18 MB on disk);
   - the saved old MinIO image (62 MB);
   - logs, rehearsal manifests and scratch scripts;
   - the candidate's worktree under `build\integration`, removed after the last cherry-pick (reported in
     the final message).
6. **Removed:**
   - 15 rehearsal backup tars and one stray rehearsal folder: 2,590,114,943 bytes on G:;
   - the `cosign` and `grype` images (about 315 MB inside Docker's disk);
   - every disposable `infra-rh-*`, `infra-legacy-*`, `infra-init-test*` and `minio-migrate-*`
     container, volume and network. The volume count is back to 26.
7. **Recovered:** 0 bytes on C:. Space freed inside Docker's disk does not return to C:.
8. **Protected:** untouched:
   - the live `adulis-postgres`, `adulis-minio`, `adulis-pgdata`, `adulis-platform_adulis-pgdata`;
   - the `nac-trial-*` stack;
   - the first batch's backup in `G:\AdulisDevelopment\WO-INFRA\backup`;
   - the shared caches, and the native build copies on G:.
9. **Concerns:**
   - Docker's data disk is now 49.84 GB; compacting it is a founder action.
   - RAM fell to 631 MB free at the end.
   - The shared Docker build cache (about 21 GB reclaimable) is a review item.
