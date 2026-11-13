# WO-INFRA-012 -- Isolation implementation

## The rule
The API suites, the load tests, and the gates that write run only against a database that **says** it
is disposable, by carrying this database comment:

```
COMMENT ON DATABASE adulis IS 'adulis:disposable-test-database';
```

**Who sets it:** only CI's per-job service database and `ops/scripts/test-db.sh`. Nobody marks a
database they intend to keep. **Never** mark the development database: that would defeat the guard.

## The checks

| Where | When | Refuses |
|---|---|---|
| `apps/api/test/db-target.ts`, from Jest `globalSetup` (`jest.config.js`, `jest.load.config.js`) | before the first suite | `DATABASE_URL` or `DATABASE_URL_MIGRATE` unset; any URL **empty**, without an **explicit port**, or with a non-loopback host; URLs whose text names different databases (`localhost` beside `127.0.0.1` counts as different); a query-string `host`, `hostaddr`, `port`, `dbname` or `service`; `NODE_ENV` production or staging. Then the mark is read **through every URL set**: each connection must land on the named database, and that database's comment must be the mark exactly |
| `apps/api/test/global-teardown.ts` | after the last suite | any foreign-key orphan outside the five known test leaks: exit 1 means orphans, any other status means the audit could not run. It runs `ops/scripts/fk-audit.mjs --known-test-leaks`, read-only, with `row_security=off`, so row-level security raises instead of hiding rows |
| `ops/scripts/gates.mjs`, through `ops/scripts/assert-disposable-db.mjs` | before the first of `migrate`, `worker-schema`, `test`, `determinism`, `console-e2e` | the same configuration rules, then the mark read **through every URL** (`console-e2e` starts the API with `DATABASE_URL`). Exit 1: refused. Exit 2: could not check. Either way nothing runs |
| `ops/load/db-loads.mjs` | before its first write | an unmarked database |

## Local procedure (developers)

```
bash ops/scripts/test-db.sh up              # disposable PostgreSQL 17 + MinIO, ~11 s
eval "$(bash ops/scripts/test-db.sh env)"   # in the shell that runs the tests
pnpm --filter @adulis/api test              # or pnpm ci:local, or the load tests
bash ops/scripts/test-db.sh down            # both containers and their data removed
```

**What `up` does:** it mirrors CI.
- `pgvector/pgvector:pg17` on `127.0.0.1:55432`, the pinned MinIO on `127.0.0.1:59000`;
- the four extensions, the migrations, the queue schema (`worker:install`), the runtime-role passwords
  (CI's fakes) and the seed (`NODE_ENV=test`);
- the mark, and the bucket init.

**Ports:** override them with `ADULIS_TEST_PG_PORT` and `ADULIS_TEST_MINIO_PORT`.

**Lifetime:** the containers use `--rm`, have no named volume, and `down` removes their anonymous
volumes.

**Precedence:** `eval "$(... env)"` sets the database, MinIO and key variables in the shell. The test
script still loads the root `.env`, but Node gives the shell's values precedence, so only the settings
the shell does not set come from `.env`.

## CI
- **The step:** "Mark the job's database disposable", right after the extensions, comments the job's
  service database.
- **What CI then shows:** the guard prints `[db-target] 127.0.0.1:5432/adulis is marked disposable`,
  and the runner prints `PASS  adulis is marked disposable` before `migrate`.

## Running against the development database
By design, no supported way exists: that is the point. To inspect it, use read-only tools
(`ops/scripts/fk-audit.mjs`, or `psql` with `PGOPTIONS='-c default_transaction_read_only=on'`).
