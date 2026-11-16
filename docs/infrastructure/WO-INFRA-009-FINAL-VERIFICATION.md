# WO-INFRA-009 -- Final verification (and the work-order report)

**Status of the work order: COMPLETE.** 13 November 2026.

## 1. Work order
WO-INFRA-009, final infrastructure security, CI modernization and release readiness (P1/P2).

## 2. Initial state
- **ISSUE-INFRA-027:** the image signature was never checked.
- **ISSUE-INFRA-016:** the CI actions targeted Node 20.
- **ISSUE-INFRA-013:** the media bucket was anonymously listable.
- **Still open:** ISSUE-INFRA-010 (GitHub MCP), 011 (moving PostgreSQL tag) and 017 (production
  backups).

## 3. Confirmed findings
- **Supply chain** (`WO-INFRA-009-SUPPLY-CHAIN-REVIEW.md`):
  - the signature and the SBOM and SLSA attestations are verified, signed by Chainguard's release
    workflow; a wrong identity fails;
  - 0 known vulnerabilities, with a control scan finding 135 on another image;
  - AGPL-3.0, with no obligation for local and CI use;
  - historical digests stay pullable for at least six months.
- **CI actions** (`WO-INFRA-009-CI-MODERNIZATION.md`): all three upgrades are compatible with this
  workflow, by their release notes.
- **Media listing:** nothing in the API or the clients lists the media bucket anonymously. The API uses
  credentials; clients read objects by URL.

## 4. Root causes
- **Signature:** `cosign` was not installed (ISSUE-INFRA-027). It ran here as a container.
- **Actions:** the v4 majors predate Node 24.
- **Listing:** `mc anonymous set download` grants `ListBucket` as well as `GetObject`.

## 5. Files inspected
`docker-compose.yml`, `.github/workflows/ci.yml`, `ops/scripts/minio-init.sh`,
`apps/api/src/common/adapters/s3-object-storage.ts`, `ops/render.yaml`, each action's release notes and
`action.yml`, and the image's SBOM and provenance.

## 6. Files modified
- `.github/workflows/ci.yml`: the three action majors and a comment.
- `ops/scripts/minio-init.sh`: the media policy.
- `ops/scripts/minio-migrate.mjs` and its test: "media listing denied" is now enforced.
- The four WO-INFRA-009 reports and both issue registers.

## 7. Changes made
Commit `4b38c78`, plus the review fixes (section 13). Nothing in the application, schema, contract or
lockfile changed.

## 8. Verification commands
- `cosign tree`, `cosign verify` (open, then strict, then a wrong identity), `cosign verify-attestation`
  (SPDX and SLSA v1), Grype on the digest and on a control;
- registry tag listing and manifest HEAD requests;
- the init script on a disposable MinIO (two runs, anonymous probes);
- rehearsal R14 (migrate and rollback under the new policy);
- CI runs on both branches (below).

## 9. Actual results: CI

| Branch | Commit | Run | Result |
|---|---|---|---|
| finalization | `67ef676` (WO-INFRA-007) | [43386065180](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43386065180) | **success:** `PASS all 31 gates`; API 983 of 983 (63 suites), mobile 520 of 520 (27 suites), `console-e2e` 88, `gate-runner` 13 of 13, `minio-migrate` 8 of 8; still on the v4 actions (deprecation warning present) |
| candidate | `b3b4e79` | [43385069084](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43385069084) | **success:** `PASS all 30 gates`; API 635 of 635, `console-e2e` 88, `gate-runner` 13 of 13 |
| finalization | `4b38c78` (actions, media policy) | [43388580622](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43388580622) | **success:** `PASS all 31 gates`; API 983, mobile 520, `console-e2e` 88, `gate-runner` 13, `minio-migrate` 8; 16 of 16 steps; **0 Node 20 warnings**; pnpm 10.32.1; dependency cache hit |
| finalization | `7418d82` (review fixes; final code) | [43390992801](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43390992801) | **success:** `scope: UNSCOPED - 51 changed root input(s)`; `PASS all 31 gates` (31 gate headers); API 983 of 983 (63 suites), mobile 520 of 520 (27 suites), `console-e2e` 88, `gate-runner` 13 of 13, `minio-migrate` 11 of 11, permission matrix 252 cells; 16 of 16 steps; 0 Node 20 warnings |
| candidate | `de1ae19` (all infrastructure; final code) | [43391044138](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43391044138) | **success:** `scope: UNSCOPED - 7 changed root input(s)`; `PASS all 31 gates` (31 gate headers); API 635 of 635 (44 suites), `console-e2e` 88, `gate-runner` 13 of 13, `minio-migrate` 11 of 11, permission matrix 252 cells; 16 of 16 steps; 0 Node 20 warnings. No mobile suite: `main` has the placeholder app |

**Task 5 categories** (final runs; see the table):

| Category | Gate(s) | Result |
|---|---|---|
| TypeScript | `typecheck` | PASS |
| Lint | `lint` | PASS |
| Database migrations | `migrate` (plus the seed), `worker-schema`, `extensions` | PASS |
| API tests | `test` | PASS (983 on the finalization branch, 635 on the candidate) |
| Mobile tests | `test` | PASS, 520 on the finalization branch; the candidate (`main`) has no mobile app |
| Console browser tests | `console-e2e` | PASS (88) |
| Infrastructure gates | all 31 on both branches | PASS |
| Gate-runner regression tests | `gate-runner` | PASS (13) |
| Migration-script tests | `minio-migrate` | PASS (11 after the review fixes) |
| Build validation | `build`, `production-react`, `boot-smoke` | PASS |
| Dependency boundaries | `deps`, `deps-fires` | PASS (6 of 6 probes) |
| Object-storage integration | the CI step "Start object storage and create the two buckets" (pinned image, the shared init, the new media policy), plus the `console-e2e` media arms | PASS |
| Security checks | `no-unsafe-eval`, `boot-smoke` (production CSP), `permission-doc` (252 cells), `surface-markers`, `trust-before-open-signup`, `orphan-sweep` | PASS |

**`main` itself was not run:** nothing was merged, so no claim is made that `main` is green.

## 10. Security review
- **Supply chain:** verified (section 3). Cosign and Grype ran as pinned containers and were removed
  afterwards.
- **Media listing closed:** anonymous `ListBucket` removed. Evidence stays private, checked by the
  init test, R14 and the migration's probes.
- **Secrets:** the scan of all 1,986 added lines found only the documented local fakes and prose
  (`logs/secret-scan.log`).
- **Backup files:** created owner-only (effective on Linux; exFAT has no permissions); the runbook says
  so.
- **Not done:** actions pinned by commit SHA (recommended separately); signature checks in CI.

## 11. Regression review
- **The action majors:** the same 16 steps, the same counts, and the cache still restores.
- **The media policy:**
  - the API and the clients never list anonymously;
  - `console-e2e` passes;
  - the live MinIO keeps its old policy until the move; the init then applies the new one.
- **Review fixes:** re-rehearsed R15 to R17. Success, rollback, a refused second rollback, a refused
  live-recorded rollback without approval, an init failure ending `UNDO OK`, and a corrupt backup ending
  `UNDO OK`.

## 12. Revisited issues (task 4)

| Issue | Now | Why |
|---|---|---|
| ISSUE-INFRA-010 GitHub MCP | OPEN | Still fails ("Authorization header is badly formatted"); needs `/mcp`. No account was authenticated by this batch |
| ISSUE-INFRA-011 moving PostgreSQL tag | DEFERRED | Pinning would recreate `adulis-postgres` on the next `compose up` and stop security updates; determinism passed in every run |
| ISSUE-INFRA-013 media listing | RESOLVED | `4b38c78`; tested; CI green |
| ISSUE-INFRA-016 Node 20 actions | RESOLVED | `4b38c78`; 0 warnings |
| ISSUE-INFRA-017 production backups | NEEDS FOUNDER DECISION | Unknown and not assumed. The repository holds only a staging blueprint (`ops/render.yaml`: `adulis-staging-db`, PostgreSQL 17, plan `basic-256mb`) |
| ISSUE-INFRA-027 signature | RESOLVED | Verified, with a negative control |

## 13. Independent reviews
- **The reviews:** two read-only reviews of `bfa24bf..HEAD` (code), each given the diff and the rules,
  not my conclusions.
  - PR Review Toolkit `code-reviewer`: correctness, security, portability, and the Actions bump.
  - `silent-failure-hunter`: fail-open paths.
- **Coverage:**
  - the Security Guidance plugin's automated review flagged the backup-file permissions;
  - Ponytail's maintainability lens was applied in writing (smallest change, no new dependency).
- **Findings and outcomes** (ISSUE-INFRA-FOLLOWUP-008), all **fixed in `7418d82`**:

| Finding | Severity | Outcome |
|---|---|---|
| `verify-backup` skipped the hash with a BOM or leading blank (both reviewers) | High | Fixed: strict `recordedSha`; proven on the real backup |
| A stream error killed Node before the undo (both) | High | Fixed: `pipeline()`; three failure kinds proven to reject |
| Rollback skipped the approval via `MIGRATE_SRC_VOLUME` (code review) | High | Fixed: the recorded volume decides; R15b refused |
| Rollback could stop the restored MinIO on a second run, or leave nothing serving (both) | High / Medium | Fixed: precondition checks and a put-back path; R15 refused the second run |
| Rollback reported success without comparing; it undercounted changes (both) | Medium | Fixed: compared with the saved inventory; additions, changes and deletions listed |
| Undo unverified; cleanup failures ignored; helpers might survive the switch (silent-failure) | Medium | Fixed: `UNDO OK` / `UNDO INCOMPLETE`; guarded steps; a helper check before the switch |
| `exists()` read any error as "absent" | Low | Fixed |
| The media-hash probe without `pipefail`; an empty evidence key; no media-policy check | Low | Fixed |
| `recreateLegacy` dropped parts silently | Medium | Fixed: it logs what it does not carry over |
| Backup files with default permissions (Security Guidance) | Medium | Fixed: owner-only modes |
| The old image is unpullable, so rollback depends on the local copy | Medium | Fixed: precondition, plus the image saved to the SSD (ISSUE-INFRA-FOLLOWUP-009) |
| No Ctrl+C handling | Low | Fixed: the handler lets the undo run |
| The init's lifecycle pattern can match across two rules | Low | Not changed: a documented shortcut; `migrate` checks the rule set itself |
| Large multipart objects would be refused by ETag | Uncertain | Not changed: the safe direction; none exist today (largest object far below 16 MiB) |

## 14. Issues encountered
ISSUE-INFRA-FOLLOWUP-008 and 009; the pnpm 11 bootstrap warning (cosmetic).

## 15. Outstanding risks
- Chainguard's free-tier digest retention is not guaranteed (observed at least six months).
- No vulnerability attestation is published.
- `mc` is frozen upstream.
- Actions are pinned by tag.
- Production is unknown.

## 16. Founder decisions
See `WO-INFRA-009-FOUNDER-HANDOFF.md`.

## 17. Commit SHA and final status
- **Commits:** `4b38c78` (actions, media policy), `7418d82` (review fixes), and the documentation
  commit after them.
- **Final status:** **COMPLETE.**
