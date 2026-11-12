# WO-INFRA-006 -- Independent infrastructure audit

**Status: COMPLETE.** 13 November 2026.

## 1. Work order
WO-INFRA-006, independent infrastructure audit and morning handoff.

## 2. Objective
Review every change made by WO-INFRA-002 to 005 independently, fix what the review finds, and classify
each work order honestly.

## 3. Investigations performed
Two independent, read-only reviews of `git diff 3cad2e3..1a8c6f7` (code only). Each reviewer received the
diff and the rules, not my conclusions:
- **PR Review Toolkit `code-reviewer`:** correctness, security, compose, the API test change,
  maintainability. It also served as the maintainability (Ponytail-equivalent) pass.
- **PR Review Toolkit `silent-failure-hunter`:** fail-open paths and swallowed errors.

Security Guidance was covered by the reviewers' security sections plus the secret scan below. The
GitHub plugin was unavailable (ISSUE-INFRA-010), so `gh` was used.

## 4. Confirmed findings

| Finding | Reviewer(s) | Severity | Verified by me | Outcome |
|---|---|---|---|---|
| Main guard runs nothing through a junction or symlink, exit 0 | both | High | yes: NTFS junction, 0 lines vs 30 | fixed `bac327a` (ISSUE-INFRA-018) |
| `docs/` exempt although a suite reads `docs/amendments/*.sql` | both | High / Medium | yes: grep of test sources | fixed (ISSUE-INFRA-019) |
| Gate environment overrides a deliberate `NODE_ENV` (staging would be seeded) | both | Medium | yes: `NODE_ENV=staging` now refused | fixed (ISSUE-INFRA-020) |
| `--only <typo>` passes zero gates (pre-existing) | silent-failure | Medium | yes | fixed (ISSUE-INFRA-021) |
| Console-dist gates assume "not selected" under any scope (pre-existing) | silent-failure | Medium | by reading | fixed (ISSUE-INFRA-022) |
| `compose up` exits 0 when `minio-init` fails | silent-failure | Medium | by reading | runbook checks it (ISSUE-INFRA-023) |
| Lifecycle check too loose; export failure read as "none" | both | Low | yes: error text captured | fixed (ISSUE-INFRA-024) |
| CI health wait without timeout or logs | silent-failure | Low | ready endpoint answers 200 | fixed (ISSUE-INFRA-025) |
| `git diff` hides renames | both | Low | by reading | fixed: `--no-renames` |
| `docker compose down -v` from any clone deletes the live volumes | code-reviewer | Info | by reading | warnings added (ISSUE-INFRA-026) |
| Signature not verified; digest lifetime | code-reviewer | Info | - | open (ISSUE-INFRA-027, R-05) |

**No Critical finding.** Every High and Medium finding is fixed or documented.

The reviewers confirmed:
- the compose volumes do not collide, and PostgreSQL keeps its physical volume;
- the API test change does not affect `req.ip`, rate limits, cookies or `trust proxy`;
- no secret was added;
- the evidence bucket stays private.

## 5. Root causes
- My own WO-INFRA-004 changes introduced three of the findings: the guard, the `docs/` exemption and the
  override.
- The rest were pre-existing fail-open paths in the gate runner, or local-only robustness gaps.

## 6. Files inspected
All ten changed code files, `apps/api/test/permission-matrix.spec.ts`, `seed.mjs`, and supertest's
`lib/test.js`.

## 7. Files modified (WO-INFRA-006)
- `ops/scripts/gates.mjs`, `ops/scripts/gates.test.mjs`, `ops/scripts/minio-init.sh`,
  `.github/workflows/ci.yml` (`bac327a`).
- `docker-compose.yml`: a comment only, the `down -v` warning (documentation commit).

## 8. Verification commands
- `node --test ops/scripts/gates.test.mjs`;
- `mutate-gates.cjs`;
- a junction run in PowerShell;
- `gates.mjs --only migrate,determinism,gate-runner` on the disposable database;
- `validate-minio-image.sh`;
- the wrong-rule check;
- CI run 43324138043.

## 9. Actual results
- **`gate-runner`:** 13 of 13 tests; 10 of 10 mutations killed.
- **Image validation:** 22 of 22. **Post-review recheck:** pass.
- **CI 43324138043 (`bac327a`):** success.
  - `PASS  all 30 gates`.
  - API 983 of 983, mobile 520 of 520.
  - `console-e2e` 88 passed.
  - `gate-runner` 13 of 13.

## 10. Security assessment
- **No security control was weakened.** Two were strengthened:
  - the evidence bucket is set private on every init;
  - deliberate staging and production now reach every destructive guard.
- **The MinIO container now runs non-root.**
- **The secret scan of all added lines** found only the documented local fakes (`local-dev-password`,
  `ci-password`, `adulis-local-secret`).

## 11. Regression assessment
- **Full runs:** unchanged.
- **CI:** runs everything when root inputs change. That is slower, and deliberate.
- **Local MinIO:** empty until the runbook runs (risk R-11).
- **Five API suites:** listen on loopback before sending requests.

## 12. Revisited issues
Each open issue was re-checked at the end:
- **ISSUE-INFRA-016 (action versions):** a separate change carries more risk than it removes tonight.
  Kept OPEN.
- **ISSUE-INFRA-027 (`cosign`):** needs a tool install. OPEN.
- **ISSUE-INFRA-011 and 013:** DEFERRED by design.
- **ISSUE-INFRA-001, 005, 012, 017:** need the founder.
- Nothing else became solvable.

## 13. Work-order outcomes

| Work order | Outcome | Why |
|---|---|---|
| WO-INFRA-001 | COMPLETE | every inspection done; nothing destructive |
| WO-INFRA-002 | PARTIALLY COMPLETE | configuration fixed and validated; live data move BLOCKED pending approval |
| WO-INFRA-003 | COMPLETE | image pinned and verified; CI provisioning green |
| WO-INFRA-004 | COMPLETE | seed and scope fixed, tested, mutation-checked, green in CI |
| WO-INFRA-005 | COMPLETE | every category has a result; CI green, 30 of 30 |
| WO-INFRA-006 | COMPLETE | reviewed, fixed, re-verified, documented |

## 14. Final branch review

| Check | Result |
|---|---|
| Branch | `infra/wo-infra-001-006-stabilization`, pushed |
| Base | `3cad2e39965657e2580009c424205f3843ad8eca` (contains `origin/main` `01302cf`) |
| Commits | `ba74372`, `3b9bbc6`, `bbbadac`, `1a8c6f7`, `bac327a`, plus the documentation commit |
| Merges | none; nothing merged into any branch; no force-push |
| Scope | 10 code files (above) plus docs; no generated contract, client, migration, lockfile or `package.json` |
| Secrets | none |
| Destructive operations | none. No live container, volume or database was stopped, recreated, modified or deleted. Disposable `infra-test-*` and `infra-gates-*` resources were created and removed by the batch |
| Working tree | clean after the documentation commit |

## 15. Issues remaining
See `WO-INFRA-006-OPEN-ISSUES.md`.

## 16. Commit SHA
`bac327a` (the review fixes); the documentation commit follows it.

## 17. Final status
**COMPLETE.**
