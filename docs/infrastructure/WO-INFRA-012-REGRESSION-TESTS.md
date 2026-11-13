# WO-INFRA-012 -- Regression tests

**Logs:** `G:\AdulisDevelopment\WO-INFRA-CLOSURE\logs\`.

| Requirement | Test | Evidence |
|---|---|---|
| Refuse the protected development database | `db-target.spec.ts` "refuses a database without the marker", "refuses a similar but different comment" | **Live proof:** `pnpm --filter @adulis/api test` with the root `.env` stopped at globalSetup ("127.0.0.1:5434/adulis is not marked disposable"); per-table counts of the development database identical before and after (`guard-refuses-devdb.log`) |
| Refuse staging and production | `it.each`: a staging host, a Render production host, `NODE_ENV` production and staging, a query-string host override | unit tests, in CI |
| Missing configuration does not fall back | `it.each`: `DATABASE_URL` unset, `DATABASE_URL_MIGRATE` unset | **Live:** with neither set, globalSetup lists both and stops |
| Ambiguous targets refused | two different databases; a jobs URL elsewhere; not a URL | unit tests |
| Disposable testing works | the real-server tests in `db-target.spec.ts` (the run's own database passes; the same server's unmarked `postgres` database is refused) | **Local:** `test-db.sh up` plus the full suite, 64 suites and 1,000 tests passing (runs 2, 3 and 4). **CI:** below |
| Cleanup leaves no unexpected orphans | `global-teardown.ts` plus `fk-audit.test.mjs` (3) | **Proof** (`teardown-audit-proof.log`): clean database, Jest exit 0; an injected orphan on an unknown key (`zz_child_parent_id_fkey`), and the run **fails** (exit 1) although all 17 tests pass |
| A failed or refused run does not modify the development database | the guard runs before any suite | **Live,** per-table counts identical before and after for: the API suites (`guard-refuses-devdb.log`), the load tests and `db-loads.mjs` (`load-guards-refuse.log`), and `gates.mjs --only migrate` (`gates-refuse-devdb.log`: migrations still 53) |
| The gates that write refuse an unmarked database before running | `gates.test.mjs`: "a gate that writes to the database refuses an unmarked one before it runs", "the database-writing gates are real gates" | 15 of 15 `gate-runner` tests |

## CI runs

| Run | Branch, commit | Result |
|---|---|---|
| [43418093186](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43418093186) | closure `849d607` (first isolation commit) | success: 32 of 32 gates; API 1,000 of 1,000 (64 suites); mobile 520 of 520; `[db-target] 127.0.0.1:5432/adulis is marked disposable` |
| [43418194281](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43418194281) | PR #105 merge result, candidate `d7ad9e9` | success: 32 of 32; API 652 of 652 (45 suites); the guard line present |
| final runs, with the teardown audit and the runner check | closure `e573a34`, candidate `3295261` | in `WO-INFRA-014-FINAL-AUDIT.md` |

The first two runs' end-of-list audit printed "201 / 175 foreign keys hold". That was **after**
`console-e2e`'s `db:reset`, which is why the audit moved into the API run's teardown (the audit report,
section 9).
