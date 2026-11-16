# WO-INFRA-008 -- Integration candidate tests

Branch `infra/main-integration-candidate`, based on `main` (`01302cf`). **Not merged.**
**CI logs:** `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\logs\ci-*.log`.

## CI runs on the candidate

| Run | Commit | Contents | Result |
|---|---|---|---|
| [43384239326](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43384239326) | `68bbb6d` | `main` + the 6 infrastructure commits | **failure**. Every gate up to `test` passed. In `test`: API 634 of 635; the one failure is `c1-onboarding` "GET lists ascending from today", the 2026-09-11 time bomb (ISSUE-INFRA-FOLLOWUP-006). Pre-existing on `main`, unrelated to infrastructure. Kept as evidence |
| [43385069084](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43385069084) | `b3b4e79` | + `810b598` (test-only date fix) | **success**. `scope: UNSCOPED - 5 changed root input(s)`; **`PASS all 30 gates`** (30 gate headers in the log); API 635 of 635 (44 suites); `console-e2e` 88 passed; `gate-runner` 13 of 13; permission matrix 252 cells; dependency rules 6 of 6 probes |
| [43391044138](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43391044138) | `de1ae19` | + WO-INFRA-007 to 009 infrastructure commits (migration script, reports, Node 24 actions, media policy, review fixes) | **success:** `PASS all 31 gates`; API 635 of 635; `console-e2e` 88; `gate-runner` 13 of 13; `minio-migrate` 11 of 11; 0 Node 20 warnings |

**Mobile on the candidate:** `main`'s `apps/mobile` is still the placeholder, whose test script prints
"placeholder, no tests". There is no mobile suite to run on `main`; the 520 mobile tests exist only on
the WO-022 line.

## Task 8 checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Only intended files changed | **Yes** | `git diff --name-only origin/main candidate`: code files `ci.yml`, `docker-compose.yml`, `gates.mjs`, `gates.test.mjs`, `minio-init.sh`, `t8-device-bootstrap.e2e.spec.ts`, `c1-onboarding.e2e.spec.ts` (test only), and this batch's `minio-migrate.mjs`, its test and gate entry; everything else under `docs/` |
| 2 | Required corrections included | **Yes** | compose project and volumes; pinned MinIO image and shared init; the seed's `NODE_ENV` default; the scope fail-safe; the review fixes; `gates.test.mjs`; the API listen-first fix (where the suite exists) |
| 3 | No unresolved conflicts | **Yes** | The four modify/delete conflicts were resolved by keeping the files absent, as on `main`; the cherry-picks completed; no conflict markers |
| 4 | No Mobile business functionality changed | **Yes** | no path under `apps/mobile` differs from `main` |
| 5 | No generated contract changed | **Yes** | `contracts/openapi.json` and `packages/api-client/src/schema.d.ts` equal `main`'s; gate `contract-current` passed |
| 6 | It builds | **Yes** | gate `build` passed |
| 7 | Required tests execute | **Yes** | API 635 of 635, `console-e2e` 88, `gate-runner` 13 of 13, locale type test, permission matrix |
| 8 | CI scope selection works | **Yes** | the run is UNSCOPED because root inputs changed (`.github/workflows/ci.yml`, `docker-compose.yml`, `ops/scripts/gates.mjs`, ...); the scope decision for a push to `main`, a selection of nothing, Markdown-only and git failures is unit-tested by `gate-runner` |
| 9 | Security and data safeguards intact | **Yes** | `deps`, `deps-fires`, `no-unsafe-eval`, `boot-smoke` (production CSP), `permission-doc`, `surface-markers`, `trust-before-open-signup` among the 30 passing gates; the evidence bucket stays private (init script) |

## Dry-run merges (no branch changed)

| Merge | Result |
|---|---|
| Candidate + `810fb27` | clean |
| Candidate + first infrastructure branch | clean |
| Candidate + WO-022 | clean, but it reintroduces the four suites without the listen-first fix |
| Candidate (before this batch) + finalization branch | conflicts in `gates.mjs` and the runbook |
| Candidate `de1ae19` + finalization `7418d82` | **clean** (after carrying this batch's commits) |
| Candidate `de1ae19` + first infrastructure branch | conflicts (`gates.mjs`, `minio-init.sh`, the runbook): the candidate holds newer versions. The first branch is superseded by the finalization branch, which is the vehicle for the mobile line |
| Candidate `de1ae19` + `810fb27` | clean |
| Work checkout's uncommitted `ci.yml`, `.dependency-cruiser.cjs`, `gates.mjs` onto the candidate | the first two apply; `gates.mjs` collides at the end of the gate list (keep both gates) |

## Not executed
- **No CI run on `main` itself:** the candidate is not merged.
- **No local full gate run of the candidate:** its worktree is on exFAT, where `pnpm install` cannot
  create links. CI is the verifier.
- **The gates that do not exist:** a secret scan, native builds, and the additive-only contract differ.
