# WO-INFRA-005 -- Test matrix

Every category from the work order, with an explicit result. **Gates are the official list**
(`node ops/scripts/gates.mjs --list`, 30 gates), cited by name.

**Local** is a full, unscoped run at `bbbadac`, one gate at a time, against disposable services:
- PostgreSQL 17 `infra-gates-pg` on port 55435;
- MinIO `infra-gates-minio` on port 19000, with the pinned image;
- `ADULIS_PG_CONTAINER=infra-gates-pg`;
- setup mirroring `ci.yml`.

Logs: `G:\AdulisDevelopment\WO-INFRA\logs\gates\<id>.log`, summary `summary.txt`. `boot-smoke` ran from
PowerShell; it cannot start a browser from the Bash tool's sandbox (a known local limit).

**CI** is GitHub Actions on `infra/wo-infra-001-006-stabilization`: run 43320430973 at `bbbadac`, and
run 43321921280 at `1a8c6f7`. Both used ubuntu-26.04 and an unscoped run (root inputs changed).

| Category | Gate(s) | Local | CI 43320430973 (`bbbadac`) | CI 43321921280 (`1a8c6f7`) |
|---|---|---|---|---|
| Object storage provisioning | CI setup step | PASS (setup log) | PASS | **PASS** |
| TypeScript typecheck | `typecheck` | PASS | PASS | **PASS** |
| Linting | `lint` | PASS | PASS | **PASS** |
| Dependency boundaries | `deps`, `deps-fires` | PASS, PASS | PASS, PASS | **PASS**, **PASS** |
| Contract consistency | `contract-prefix`, `contract-current` | PASS, PASS | PASS, not reached | **PASS**, **PASS** |
| Error catalogue in both locales | `error-locale` | PASS | PASS | **PASS** |
| Build verification | `build` | PASS | PASS | **PASS** |
| Extensions | `extensions` | PASS | PASS | **PASS** |
| Database migrations (+ seed) | `migrate` | PASS | PASS | **PASS** |
| Worker schema | `worker-schema` | PASS | PASS | **PASS** |
| API tests | `test` (`@adulis/api`) | PASS 983/983 (63 suites) | FAIL 979/983 (ECONNRESET, ISSUE-INFRA-015) | **PASS** 983/983 (63 suites) |
| Mobile tests | `test` (`@adulis/mobile`) | PASS 520/520 (27 suites) | not reached (pnpm -r stopped at api) | **PASS** 520/520 (27 suites) |
| Console unit tests | `test` (`@adulis/console`) | none exist (prints so) | not reached | none exist (prints so) |
| Locale package tests | `test` (`@adulis/locale`) | PASS | not reached | **PASS** |
| Database determinism | `determinism` | PASS | not reached | **PASS** |
| Database invariants (Appendix C, 16 checks) | `appendix-c` | PASS | not reached | **PASS** |
| Orphan rows after the suites | `orphan-sweep` | PASS | not reached | **PASS** |
| Permission matrix vs SQL | `permission-doc` | PASS | not reached | **PASS** |
| Governed docs ASCII | `docs-ascii` | PASS | not reached | **PASS** |
| Deferred values | `deferred-values` | PASS | not reached | **PASS** |
| Trust before open signup | `trust-before-open-signup` | PASS | not reached | **PASS** |
| Production console build | `no-unsafe-eval`, `production-react` | PASS, PASS | not reached | **PASS**, **PASS** |
| Translation work list | `mt-keys` | PASS | not reached | **PASS** |
| Browser smoke | `boot-smoke` | PASS (PowerShell) | not reached | **PASS** |
| Generated appendices | `appendix` | PASS | not reached | **PASS** |
| Console end to end, incl. object storage (presigned PUTs) | `console-e2e` | PASS (88 Playwright tests) | not reached | **PASS** (88 Playwright tests, Edge on ubuntu-26.04) |
| Migration 0043 transcription | `transcription` | PASS | not reached | **PASS** |
| Surface markers | `surface-markers` | PASS | not reached | **PASS** |
| Tokens | `tokens` | PASS | not reached | **PASS** |
| Staging blueprint vs repo | `render-yaml` | PASS | not reached | **PASS** |
| Gate runner's own rules | `gate-runner` | PASS 10/10 | not reached | **PASS** 10/10 |
| Existing security gates | `deps`, `no-unsafe-eval`, `boot-smoke` (CSP), `surface-markers`, `permission-doc`, `trust-before-open-signup` | PASS | partial | **PASS** |

**Not covered by any gate, and so NOT RUN:**
- a secret scan (commented out in `ci.yml`, "scanner to be selected");
- native Android and iOS builds;
- the additive-only OpenAPI differ (owed since T3).

**CI 43324138043 (`bac327a`, after the WO-INFRA-006 review fixes): success.**
- All 30 gates PASS, unscoped (49 changed root inputs).
- API 983/983, mobile 520/520, `console-e2e` 88 passed, `gate-runner` 13/13, permission matrix 252 cells.
- https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43324138043
