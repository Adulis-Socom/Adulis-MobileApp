# WO-INFRA-012 -- Test database audit (and the work-order report)

**Status of the work order: COMPLETE.**
- **Implementation:** the API suites, the load tests and the gates that write refuse any database not
  marked disposable.
- **Coverage:** none lost.
- **The known leaks:** five known teardown leaks are bounded by a ratchet.
- **Development data:** untouched.

13 November 2026. **Logs:** `G:\AdulisDevelopment\WO-INFRA-CLOSURE\logs\`.

## 1. Work order
WO-INFRA-012, API test database isolation and contamination prevention (P1). It closes the root cause
of ISSUE-INFRA-FOLLOWUP-005.

## 2. Initial state: how the persistent database got contaminated
- **The default target:** `apps/api` `test` = `node --env-file-if-exists=../../.env jest`, so every
  local run used the root `.env`. That file points at the persistent development database:
  `127.0.0.1:5434/adulis`, with the migrate role as superuser.
- **No guard:** Jest had no global setup, so nothing checked the target.
- **Unset variables:** `database.module.ts` falls back to `process.env['DATABASE_URL'] ?? ''`. An empty
  connection string means libpq's defaults: `localhost:5432`, which on this machine is a different
  PostgreSQL 18.
- **Proof by measurement:** on a fresh database, all 201 foreign keys hold. After **one** full API run,
  **35 rows break five keys**, the same five and the same counts on three separate runs (2, 3 and 4;
  run 4 without the root `.env`). The development database holds 192 rows on exactly those five keys.

## 3. Everything that can modify data, classified (task 1)

| Item | What it can do | Target before | Now |
|---|---|---|---|
| API suites (`apps/api/test`, 64 suites on the mobile line, 45 on `main`) | `DELETE` in 48 files; `session_replication_role = replica` in 38 (64 settings); one `DROP`; fixture inserts | root `.env`, the persistent database | **globalSetup refuses** unless the database is marked (section 4); **globalTeardown audits** every foreign key |
| API load tests (`jest.load.config.js`, `test-load/api.loadtest.ts`) | hundreds of fixtures; `DELETE` under replica | root `.env` | **the same globalSetup** |
| `ops/load/db-loads.mjs` | **a million synthetic orders** with triggers off | root `.env` | **refuses an unmarked database** before its first write |
| Gate `migrate` | migrations and `db:seed` | the environment (root `.env` locally) | the **runner checks the mark** before the first writing gate |
| Gate `worker-schema` | installs the queue schema | the same | the same |
| Gate `test` | the API suites | the same | the runner check plus the Jest guard |
| Gate `determinism` | `CREATE`/`DROP DATABASE` of its scratch databases on the same server | the same | the runner check |
| Gate `console-e2e` | **`pnpm db:reset` before and after** (drops ten schemas, re-migrates, seeds) and API writes | the same | the runner check |
| `pnpm db:reset`, `db:seed`, `db:migrate` run by hand | drop and recreate, seed, migrate | the root `.env` | **unchanged, by design**: they are the developer's own commands for the development database. Reset and seed refuse anything but `NODE_ENV` development or test |
| `verify-orphan-sweep.mjs`, `fk-audit.mjs` | read only (fk-audit enforces a read-only session) | -- | -- |
| CI | a PostgreSQL service per job, destroyed afterwards | disposable | **marked disposable** by a CI step |

No test or script uses `TRUNCATE` or `DISABLE TRIGGER`.

## 4. The isolation boundary (task 2)
Details are in `WO-INFRA-012-ISOLATION-IMPLEMENTATION.md`. In short:
1. **The mark:** a database is disposable only if it carries the comment
   `adulis:disposable-test-database`. CI's step and `ops/scripts/test-db.sh` set it; nothing else does.
2. **Jest `globalSetup` refuses, before any suite:**
   - missing `DATABASE_URL` or `DATABASE_URL_MIGRATE`;
   - a non-loopback host;
   - URLs naming different databases;
   - a query string that overrides the target;
   - `NODE_ENV` production or staging;
   - an unmarked database.
3. **The gate runner** checks the mark before `migrate`, `worker-schema`, `test`, `determinism` and
   `console-e2e`.
4. **The load script** checks the mark before writing.

`NODE_ENV=test` is never accepted as proof: it labels the process, not the database.

## 5. Coverage preserved (task 3)
- **No test was removed, skipped or weakened.**
- The full API suite passes on the disposable database: 64 suites and 1,000 tests (the 983 plus 17 new
  guard tests) on the mobile line, and 45 suites and 652 tests on `main`, in CI.
- **Authorization:** the suites still connect as `adulis_app`, never a superuser, so the permission and
  RLS assertions keep their meaning.

## 6. `session_replication_role` (task 4)
- **Why it is used:** 22 tables are append-only (`trg_append_only` forbids `DELETE`), and teardowns set
  replica mode to delete their fixtures.
- **What else it switches off:** every foreign-key trigger too. So a parent deleted before its
  children leaves orphans, and PostgreSQL still marks the key validated.
- **Where it leaks:** five keys leak, from 24 files (ISSUE-INFRA-CLOSURE-004):

| Key | Leaking teardowns |
|---|---|
| `otp_delivery_attempt` -> `otp_challenge` | 19 files delete challenges, never their delivery attempts |
| `order_state_transition` -> `order` | 8 files delete orders under replica, never their transitions |
| `claim_evidence_item` -> `claim` | `t6-closure-survives-block` |
| `device` -> `market` | `c6-accounts` deletes its fixture market `cccc6666-...` while the API created devices in it |
| `notification` -> `account` | `t26-ownership-before-rules`, `disc-001-scenes` |

**Necessary or replaceable:**
- **The append-only bypass is necessary** for fixtures in append-only tables.
- **The orphaning is not.** The safe fix is dependency-aware deletion: delete the children first, in the
  same teardown. Wider options:
  - disabling only `trg_append_only` (DDL in tests, so not recommended);
  - a fresh database per run, which `test-db.sh down && up` already provides locally.

**Not done here** (no unrestricted rewrite): editing the 24 teardowns. Instead:
- the API run's teardown audit fails on any **new** leaking key;
- the five are named with their files in `ops/scripts/fk-audit.mjs`, and removed from the list as they
  are fixed.

## 7. Regression tests (task 5)
In `WO-INFRA-012-REGRESSION-TESTS.md`:
- 17 guard tests;
- 2 runner tests;
- 3 ratchet tests;
- a teardown proof;
- four "refused, and the development database unchanged" proofs.

## 8. Files modified
- **API tests:**
  - `apps/api/test/db-target.ts`, `db-target.spec.ts`, `global-setup.ts`, `global-teardown.ts`;
  - `apps/api/jest.config.js`, `jest.load.config.js`.
- **Ops scripts:**
  - `ops/scripts/test-db.sh`, `fk-audit.mjs`, `fk-audit.test.mjs`, `assert-disposable-db.mjs`;
  - `gates.mjs`, `gates.test.mjs`.
- **Elsewhere:**
  - `ops/load/db-loads.mjs`;
  - `.github/workflows/ci.yml` (the step "Mark the job's database disposable").

**On the candidate:** the same changes, except that its `jest.config.js` keeps `main`'s shape (no
mobile-line `testTimeout`).

## 9. Found and fixed during the work
1. **The `fk-integrity` gate was vacuous.** Placed last, it ran after `console-e2e`'s `db:reset`, so
   in CI it saw a fresh database ("201 keys hold") while local runs left 35 orphans. Moved into the API
   run's `globalTeardown`; the gate now tests only the ratchet. **Caught before any merge.**
2. **`test-db.sh` lacked the queue schema.** `worker-runtime` failed on the first local run; the script
   now runs `worker:install`, like the `worker-schema` gate.
3. **`test-db.sh down` leaked an anonymous volume per cycle** (the postgres image's `VOLUME`). Now
   `docker rm -f -v`; verified 26 -> 27 -> 26. The four leaked volumes were confirmed unused and removed.

## 10. Security review
- **No credentials added.** `test-db.sh` uses CI's documented fakes, and binds both ports to `127.0.0.1`.
- **The audit cannot write:** a read-only session, checked before the first query.
- **Error messages** name host, port and database only, never a password.

## 11. Remaining risks
- **The object store is not guarded.** Locally the suites write to whatever `R2_*` names. The root
  `.env` points at the **live** MinIO; `test-db.sh` supplies a disposable one, but nothing enforces it
  (ISSUE-INFRA-CLOSURE-006).
- **The five leak classes remain** until their teardowns are fixed.
- **Hand-run commands:** `db:reset`, `db:seed` and `db:migrate` still act on the root `.env` when run by
  hand, by design.

## 12. Final status
**COMPLETE.** Commits `849d607` and `86a9584` on `infra/wo-infra-010-014-closure` (`d7ad9e9` and
`5060a70` on the candidate).
