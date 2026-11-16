# WO-INFRA-005 -- Complete infrastructure and CI verification

**Status: COMPLETE.** 13 November 2026.

## 1. Work order
WO-INFRA-005, complete infrastructure and CI verification.

## 2. Objective
Run the full official gate list in a disposable environment and in CI, and give every verification
category an explicit result.

## 3. Investigations performed
- **A disposable local environment, mirroring `ci.yml`:**
  - PostgreSQL 17 container `infra-gates-pg` on port 55435, no named volume;
  - MinIO `infra-gates-minio` on port 19000, using the pinned image;
  - the four extensions, `db:migrate`, the runtime-role passwords and the bucket init, as CI does them.
- **All 30 gates run one at a time** with `--only`, so a red gate could not hide later ones. `boot-smoke`
  ran from PowerShell.
- **Two CI runs** on the branch.

The founder's `adulis-postgres` and `adulis-minio` were not used.

## 4. Confirmed findings
- **Local, `bbbadac`:** 30 of 30 gates pass. API 983 of 983, mobile 520 of 520, `console-e2e` 88 tests.
- **CI 43320430973 (`bbbadac`):**
  - object storage and gates 01 to 10 pass, including `migrate` with the seed;
  - `test` fails 4 of 983, all `read ECONNRESET` (failure register F-5).
- **CI 43321921280 (`1a8c6f7`):** green.
  - `PASS  all 30 gates.`
  - API 983 of 983 (63 suites), mobile 520 of 520 (27 suites).
  - `console-e2e` 88 passed. `gate-runner` 10 of 10. Permission matrix 252 cells.
  - No "No projects matched" anywhere in the log.

## 5. Root causes
In `WO-INFRA-005-FAILURE-REGISTER.md`.

## 6. Files inspected
- Every gate's log.
- `apps/api/test/*.e2e.spec.ts`, for how requests are issued.
- `node_modules/supertest/lib/test.js` (7.2.2).

## 7. Files modified
Five API suites (`1a8c6f7`): `cat-001-public-catalogue`, `disc-002-fyp`, `t8-device-bootstrap`,
`wo-009-collections` and `wo-sec-001-pool-starvation`. Each adds `await app.listen(0, '127.0.0.1')`
after `app.init()`. That is test harness only: no assertion, no application code.

## 8. Verification commands
- `run-gates-each.sh`: `node ops/scripts/gates.mjs --only <id>` for each gate, with the disposable
  environment.
- PowerShell: `node ops/scripts/gates.mjs --only boot-smoke`.
- `jest` on the five suites, `--maxWorkers=2`.
- `supertest-race-repro2.cjs`.
- `gh run watch`, `gh run view --log`.

## 9. Actual results
In `WO-INFRA-005-TEST-MATRIX.md`.

**GitHub Actions:**

| | |
|---|---|
| Branch | `infra/wo-infra-001-006-stabilization` |
| Commit | `1a8c6f7` |
| Workflow run | https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43321921280 |
| Job | `install -> typecheck -> lint -> test -> build -> gates`: success |
| Steps | 16 steps, all success |
| Gates passed | 30 of 30 |
| Gates failed | 0 |
| Gates skipped | 0. The run was unscoped because root inputs changed, so nothing was "not selected" |
| Not executed | No gate exists for: a secret scan, native builds, the additive-only contract differ |

The previous run, https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43320430973 at
`bbbadac`, failed at `test` (F-5) and is kept as evidence.

## 10. Security assessment
- **Security-relevant gates pass in CI:** `deps`, `deps-fires`, `no-unsafe-eval`, `boot-smoke` under the
  production CSP, `permission-doc`, `surface-markers`, `trust-before-open-signup`.
- **Object storage:** the media arms of `console-e2e` use the private evidence bucket through presigned
  URLs only.
- **The API-test change:** binds to loopback only.

## 11. Regression assessment
- Nothing regressed: every gate that passed before still passes.
- The API-suite change only removes a race. It was re-run locally (126 of 126) and in CI (983 of 983).

## 12. Issues encountered
ISSUE-INFRA-014, 015, 016; failures F-1 to F-6.

## 13. Issues resolved
ISSUE-INFRA-009 (CI restored), 014, 015.

## 14. Issues remaining
- ISSUE-INFRA-016: the runner moved to ubuntu-26.04, and the Node 20 actions are deprecated.
  Warnings only today.
- No CI run on `main` yet: this branch is not merged.

## 15. Founder decisions required
None for this work order.

## 16. Commit SHA
`1a8c6f7` (the test fix). CI verified at `1a8c6f7`.

## 17. Final status
**COMPLETE.** Every category has an explicit result, and CI is green with all 30 gates run.

## Addendum
After the WO-INFRA-006 review fixes, CI run 43324138043 at `bac327a` is also green: 30 of 30 gates,
`gate-runner` 13 of 13. It is the final verified code commit.
