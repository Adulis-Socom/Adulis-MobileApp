# FINAL TEST REPORT - What Breaks, And At What Number

**Order:** T25. **Status: Phase 0 and Phase 1 in progress; reported between phases as the order requires.**

---

## WHERE IT RAN

**No Render deployment exists. The API, the worker and the console ran on this laptop. The DATABASE is Render's.**

That split matters and it is the first thing to understand about every number below. `ops/render.yaml` still carries `THIS FILE HAS NEVER BEEN APPLIED`, and no hosting credential exists on this machine -- so nothing in S5 of T24 happened and nothing here runs against a URL. But `adulis_probe_3` does exist: a real managed PostgreSQL 17.11 on Render's 256 MB tier, carrying all fifty migrations and the worker schema, migrated as `adulis_migrate` with `rolsuper=f` in T23.

**So the caveats are asymmetric, and each number says which side it is on:**

| measured against | what it is | caveat |
|---|---|---|
| **Render database** | `max_connections`, `shared_buffers`, RAM fit, contention, every connection count | **Real.** The tier this will run on, measured not read |
| **local API / worker** | memory, throughput, latency, anything CPU-bound | **An upper bound the deployment will not exceed.** More RAM, no proxy, no network hop to the API's own process |
| **local -> Render** | anything that crosses the link | **Slower than production**, which has the API and the database in one region -- so these are lower bounds on speed, not upper |

**The tier, verified rather than assumed** (`SELECT ... FROM pg_settings`, against `adulis_probe_3`):

```
max_connections                 100    (3 reserved for superuser -> 97 usable)
shared_buffers                  64 MB  (8192 x 8 kB)
effective_cache_size            192 MB (-> a 256 MB instance)
work_mem                        1.7 MB
maintenance_work_mem            16 MB
max_worker_processes            8
database size, schema only      17 MB
pooler in front                 NONE   (SHOW POOL_MODE -> "unrecognized parameter":
                                        the connection terminates at Postgres itself)
```

For comparison the local container: `shared_buffers` 128 MB, `effective_cache_size` 4 GB, `work_mem` 4 MB, same `max_connections`. **The laptop's database is two to twenty times larger on every memory dimension and identical on the one that breaks first.**

### The instrument check -- every gate class attacked before it was trusted

Four classes, each planted, each watched. **Two of the four did not fire on the first attempt, and both were my plant, not the gate.**

| class | plant | gate | result |
|---|---|---|---|
| **an unfired trigger** | `DROP TRIGGER trg_append_only ON core.stock_event` | `db:check` check 5 | **FIRED** -- `21 trg_append_only trigger(s), expected 22`; restored, PASS |
| **a stale artifact** | hand-edit a description in `contracts/openapi.json` | `contract-current` | **did not fire uncommitted; FIRED committed.** The gate regenerates then diffs against `HEAD`, so an uncommitted edit is overwritten before the diff -- which is correct for CI and means a local `ci:local` after a hand-edit silently repairs it rather than reporting it. Committed, it fires and prints the diff |
| **a missing token** | delete `--adu-color-accent` from `tokens.css` | `verify:tokens` | **FIRED**, twice over: `no custom property for color.accent`, and the downstream `--adu-focus-ring-color` disagreement it causes |
| **a broken boot** | `VITE_SMOKE_BREAK=1` at build | `boot-smoke` | **FIRED at the artifact level**: `the smoke break flag survived into the bundle: index-_inneQae.js`. **The browser half is NOT CHECKABLE on this machine** -- `boot-smoke`'s DOM half is already red here for D-293's `msedge --dump-dom` reason, so a plant cannot be distinguished from the standing failure. A first attempt through `verify:console-e2e` measured nothing: **that harness rebuilds the console itself and overwrote the plant** (dist re-stamped), so 87 of 88 passing against a module-scope throw was the harness, not the product |

**Three findings from the instrument check, before any test ran:**

- **The e2e harness cannot be used to plant a boot failure without passing the variable through its own build.** Not a defect -- but the first plant looked like a green gate ignoring a broken bundle, and that is the exact shape the order warns about.
- **"Six load tests" is three.** `apps/api/test-load/api.loadtest.ts` carries `it` blocks numbered (1), (5) and (6). A1's measurements (2), (3) and (4) exist only as prose in `SECURITY-REVIEW.md` SR-11 -- run once, recorded, never made repeatable.
- **One console e2e failed during the plant run for a reason that is neither**: `page.goto: net::ERR_NETWORK_IO_SUSPENDED` in the dark project, 13.5 minutes into the run. The laptop suspended network IO. Environmental; recorded because a reader of that log would otherwise blame the product.

---

## CAPACITY

### The first ceiling is arithmetic, and it is connections

**Every input measured against Render, not read from a constant.**

| process | what it opens | how measured |
|---|---|---|
| API, per instance | `APP_POOL_MAX` 10 + `FINANCIAL_POOL_MAX` 4 = **14** | idle -> 1; ten concurrent `/healthz` -> **10**, the cap. The financial pool is lazy and untouched by reads |
| worker, per instance | graphile-worker's OWN pool **11** at peak (10 idle) + our `WORKER_POOL_MAX` 12 = **23** | `run({ connectionString, concurrency: 10 })` with no `pgPool` passed opens its own; measured 10 idle, **11 under 30 queued jobs**, 0 after stop |
| migration, during deploy | 1 | |
| an operator's psql | 1 | |
| Render's own | ~6-7 | `pg_stat_activity` total with nothing of ours connected: 7 |

```
render.yaml as written  (1 api x 14) + (1 worker x 23) + 1 + 1 + 7   =  46   of 97   HOLDS
S18 production topology (2 api x 14) + (1 worker x 23) + 1 + 1 + 7   =  60   of 97   HOLDS
one more API instance   (3 api x 14) + (1 worker x 23) + 1 + 1 + 7   =  74   of 97   holds, no headroom for a second worker
two workers, three APIs (3 x 14) + (2 x 23) + 1 + 1 + 7              =  97   of 97   THE CEILING, exactly
```

**Three things this arithmetic says that a load test would not:**

1. **The worker costs more connections than the API**, and nobody would guess that from the constants. `WORKER_POOL_MAX = 12` is what the code declares; **23** is what a worker instance holds, because graphile-worker sizes a second pool to its concurrency and the runtime never hands it ours. **Fixing that -- passing `pgPool` into `run()` -- halves the worker's footprint for free**, and it is the cheapest capacity change in this report.
2. **There is no pooler.** `SHOW POOL_MODE` is not recognised, so each of those connections is a real Postgres backend holding real memory -- on a 256 MB instance, roughly 5-10 MB each once it has done any work. **Sixty backends is not just a count; it is a third of the RAM.**
3. **The D-273 shape is live in production's arithmetic**: the test suite's 19 workers x 16 = 304 against 100 was found because it failed. Production's 60 against 97 will not fail. It will sit at 62% with no alarm on it, and the first symptom of the second worker or the third API instance is `FATAL: remaining connection slots are reserved` on a Tuesday.

*(RAM fit, reservation contention, worker throughput, API memory, the sellers table and the recommendation follow as they are measured.)*
