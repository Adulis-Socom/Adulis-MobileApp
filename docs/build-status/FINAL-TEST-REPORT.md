# FINAL TEST REPORT - What Breaks, And At What Number

**Order:** T25. **Status: Phases 0 and 1 complete and reported; Phases 2 and 3 (security) next, then Phase 4 (quality). Reported between phases as the order requires.**

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

### The second ceiling is RAM, and it is the catalogue, not the orders

Measured by loading a synthetic cohort into `adulis_probe_3` at 50, 500 and 5,000 sellers, each seller at A1's shape: 20 products x 3 variants, 30 orders (a month at one a day), 11 accounts. Every row went through the schema's own constraints as `adulis_migrate` -- the first attempt was refused by `order_clock_consistency` (a COMPLETED order without `clock_stopped_at`), which is the schema working and the probe being wrong.

| sellers | products / variants / orders | database | indexes | indexes vs `shared_buffers` (64 MB) |
|---|---|---|---|---|
| 50 | 1,000 / 3,000 / 1,500 | 19 MB | 4.2 MB | 6.5% |
| 500 | 10,000 / 30,000 / 15,000 | 43 MB | 20 MB | 30.6% |
| 5,000 | 100,000 / 300,000 / 150,000 | **264 MB** | **161 MB** | **251.7%** |

The line between 500 and 5,000 is straight -- **0.031 MB of index and 0.049 MB of database per seller** at this shape. So, on the 256 MB tier:

- **indexes outgrow `shared_buffers` at ~1,900 sellers**;
- **the database outgrows `effective_cache_size` (192 MB) at ~3,500**, and the instance's entire RAM at ~4,800.

**Where the bytes go: 249 of 264 MB is `core`, and 126 MB of that is `product_variant` -- 38 MB of rows carrying 88 MB of index.** Five indexes on one table. Two of them, `(id, seller_id)` and `(id, product_id)`, exist so that every child FK can pin the tenant -- the design that makes tenant isolation a constraint rather than a query discipline. **That is the RAM price of the isolation model: 2.3 bytes of index per byte of variant.** `order` has the same shape (23 MB heap, 35 MB index, two of them pinning). Nothing here is redundant; it is what the schema costs.

**What "does not fit" means, measured rather than asserted** -- one seller's storefront read (20 products, 60 variants) at 5,000 sellers:

```
cold    shared hit=114  read=29     24.6 ms
warm    shared hit=143  read=0       0.16 ms
```

**150x between a cached and an uncached read of the same sixty rows.** Nothing fails. The p95 becomes a function of how much of the catalogue is being browsed at once, because every cold read evicts someone else's warm one. **Below ~1,900 sellers the entire index set is resident and the cold case does not exist.**

**What did NOT get worse: the expiry sweep.** `idx_order_expiry_sweep` is `(expires_at) WHERE clock_stopped_at IS NULL` -- a partial index, Index Only Scan, **one buffer at 150,000 orders.** The sweep is O(due rows), not O(orders), and that stays true at any seller count.

**Not measurable here:** which pages actually occupy the 64 MB -- `pg_buffercache` is not installed on Render. The crossing points above are index-size arithmetic, which is the conservative reading: the hot set is smaller than the index set, so the real degradation begins later than ~1,900, not earlier.

### The third ceiling is the hot row, and the pool size is its throttle

Test (1) -- N buyers on one variant with stock S -- re-run against Render as `adulis_app`, with the API out of the path (the row lock lives in `fn_create_order`; the API adds only its own latency) and **every trigger firing**, which the repository's own harness cannot do here (D-307: its fixture needs `session_replication_role`). Round trip from this laptop to Frankfurt: **92-100 ms**, which an in-region API will not pay -- subtract it from every latency below.

| 200 buyers, stock 150 | pool **10** (`APP_POOL_MAX`) | pool **40** |
|---|---|---|
| orders created / refused | **150 / 50** | **150 / 50** (across a client crash, below) |
| stock after / negative stock events | **0 / 0** | **0 / 0** |
| wall | 9.0 s | **17.5 s** |
| p50 | 208 ms | 996 ms |
| p95 | 801 ms | **10.5 s** |
| max | 2.2 s | 14.2 s |
| refused at the door (`U0003` cart revalidation) | 44 | 12 |
| refused by the constraint (`23514`, `stock_count >= 0`) | **6** | **38** |

**Four things this says:**

1. **Exact, both times.** 150 orders, 150 reservations, stock 0, zero negative stock events -- the A1 6.1 proof, now on the managed tier.
2. **The pre-check is not the guard, and the numbers show why.** `fn_create_order` reads `stock_count` before it decrements. At pool 10 that read turned 44 buyers away and **6 slipped past on a stale read**; at pool 40, **38** slipped past. **Every one of them was stopped by `CHECK (stock_count >= 0)` on the locked row.** "Overselling is a transaction failure, never a negative number" is measured here, forty-four times.
3. **A bigger pool makes the hot row WORSE.** Four times the connections: **half the throughput** (wall 9.0 s -> 17.5 s) and **thirteen times the p95**. Forty backends queued on one row lock on a 256 MB instance is a convoy; ten is a queue. `APP_POOL_MAX = 10` is the right number, and raising it under load is the intuitive mistake -- it also spends the connection budget from the first ceiling.
4. **The first pool-40 attempt crashed the CLIENT process after 94 orders** -- Node exited on an unhandled socket event inside `pg`'s pool (the stack ended at `node:net`; the message was lost to my own output filter, so the cause is recorded as *unknown*, not as Render's). **The ledger was exact when it died: 94 orders, stock 56.** The rerun took exactly the remaining 56 and refused the 94 already-converted carts with `U0002` -- the right answer for a cart that has already become an order. Whether the API's own pool survives the same event is checked in SECURITY/QUALITY, not assumed here.

### What breaks FIRST is not a number of sellers. It is the first closed connection.

The pool-40 client crash above was not Render's doing and not the load's. **It reproduces on demand, with no load at all:**

```
idle adulis_app backends: 10; pool idleCount=10 totalCount=10
terminated one idle backend from the server side: [{"ok":true}]
process exiting with code 1
node:events:497  throw er; // Unhandled 'error' event
error: terminating connection due to administrator command   (57P01)
Emitted 'error' event on BoundPool instance
```

`database.ts:35` and `:45` and `runtime.ts:58` each do `new Pool({ connectionString, max })` and attach nothing. **node-postgres emits `error` on the pool when an idle client's socket dies; an emitter with no `error` listener throws; an uncaught throw ends the process.** `main.ts` installs no `uncaughtException` handler either, and Kysely's dialect adds no listener of its own.

**What produces that event in production without anyone running `pg_terminate_backend`:** a managed-Postgres maintenance restart, a failover, the provider's idle-connection reaper, a network blip on any of the 14 API or 23 worker connections. **Each one ends the process.** Render restarts it, so the symptom is not "down" -- it is a boot's worth of 502s, every dropped in-flight request, every cron tick the worker misses while it reboots, and no line in any log that says why, because the process is gone before its logger flushes.

Measured on the identical pool construction against Render, not on the API binary itself (which would need a full staging environment to boot); the shape is the same three lines of code, so the caveat is about the test, not the conclusion. **This is the first thing that breaks, and it breaks at one seller.**

### The fourth ceiling is the worker, and it is structural before it is computational

Measured against Render as `adulis_jobs`, running the **real job bodies** from `apps/api/dist` over a 10,000-order backlog. The backlog itself went in through `fn_create_order` the way production would -- 10,000 buyers through a pool of 10, one transaction each: **34 orders/s sustained on ONE variant from 100 ms away**, p50 288 ms, p95 594 ms, ledger exact (10,000 reservations, stock 0, zero negative). The scheduler was not in the path; what a run costs is `job.run(ctx)`, which is what `jobs-harness.ts` calls too.

| job | what one run does | measured | the ceiling |
|---|---|---|---|
| `order.expire_sweep` (`* * * * *`) | selects 500 due orders, **one transaction each**: UPDATE the order, UPDATE its reservations, one `fn_release_reservation_stock` per line | two runs, **500/500 expired, 0 failed**, 252 s and 260 s from here; **505 ms per order, ~485 ms of it five round trips at 97 ms** -- the server's share is ~20 ms | **500 per minute per worker, by construction** (`LIMIT 500` on a one-minute cron). In-region, a full run is ~10 s of its 60 s slot |
| `notification.morning_reminder` (08:00, per market) | one `INSERT ... SELECT` over every open order older than 8 h | **9,300 rows in 3.3 s warm** (0.36 ms/row, linear); **22 s** when the job ran cold right after the 10k load | not a ceiling: once a day, linear, and the same statement for 500 sellers is 0.2 s |
| `notification.push_seller` / `.send` (`* * * * *`) | claim 500 (`FOR UPDATE SKIP LOCKED`), one provider call and one UPDATE each | one claim each, 336 / 409 ms | **500 per minute per channel per worker**, by construction |
| the sweep's candidate query at 10,000 due | `idx_order_expiry_sweep`, partial | **20 buffers, 0.17 ms** | O(due), as the code's own comment claims -- with the exception below |

**In sellers.** At A1's shape -- one order per seller per day, one in five going unclaimed -- 5,000 sellers produce 1,000 expiries a day: **0.7 a minute against a cap of 500**, and a 24-hour worker outage leaves a backlog the sweep clears in two minutes. The morning reminder at 5,000 sellers writes ~5,000 rows once a day in ~2 s and `push_seller` drains them in ten minutes. **No row of the sellers table reaches a worker cap.** What reaches one is a burst: a broadcast to 50,000 buyers is 100 minutes of `push_seller` on one worker, and the second worker that halves it costs 23 connections from the first ceiling.

**Two things that DO grow, both silently, both found by reading the plans rather than the clocks:**

1. **Every order the sweep expires stays in the sweep's index for the rest of its life.** `order_clock_consistency` *requires* `clock_stopped_at IS NULL` for `EXPIRED_UNCLAIMED`, and `idx_order_expiry_sweep` is `WHERE clock_stopped_at IS NULL` -- so an expired order still satisfies the index predicate, and every run skips it through `Filter: state = ANY(...)`, which needs the heap row. **Measured: after 1,000 expiries the same query is 47 buffers / 0.585 ms with `Rows Removed by Filter: 937`; it was 20 buffers / 0.17 ms before.** Linear in expired-ever: at 1,000 expiries a day that is 365,000 heap fetches per minute by the end of year one, on a tier where the order table no longer fits in cache. **D-314.** One migration fixes it: `AND state IN ('CREATED','NOTIFIED')` in the index predicate.
2. **Releasing a reservation reads the whole stock ledger.** `fn_release_reservation_stock` finds the reserving event by `reservation_id AND reason = 'ORDER_CREATED'`, and no index serves that -- the only `reservation_id` index is partial to the RELEASE reasons: `Seq Scan on stock_event ... Rows Removed by Filter: 11026`, 2 ms today. The ledger is append-only and holds a row for every order ever placed. **D-313.** One partial index fixes it.

Neither is visible at 50 or 500 sellers. Both are the shape the order asked for: the thing that breaks second, at a number, silently -- in the second year, when nobody is measuring.

*(A note on method: the first attempt to create the backlog server-side -- 10,000 `fn_create_order` calls in ONE statement -- ran for five and a half minutes and was cancelled. Ten thousand updates of one variant row inside one transaction build a ten-thousand-version chain, so the pattern is quadratic. That is not a product finding; nothing in the product does it. It is recorded because a "no-network order-creation rate" measured that way would have been a number about the probe, not about the database.)*

### API memory is not a ceiling at any number in the table

Measured on this laptop, in-process (Nest `AppModule` under supertest), against the local database -- **an upper bound the deployment will not exceed on the API's own memory** (more RAM here, no proxy) and a caveat the other way on latency (no network hop to the API's own process).

| load test (A1 section 6) | what it holds | result |
|---|---|---|
| (5) evidence streaming, 100 concurrent viewers of a 2 MB framed blob | R18: the API must not buffer what it streams | **+33.5 MB RSS at peak** for 200 MB in flight -- the frames go through, they are not held |
| (1) one hot variant, 200 concurrent buyers, stock 150 | the same proof as the Render run above, with the HTTP layer in the path | 150 / 50 / stock 0 / zero negative, **p95 1,146 ms** with no network between client and API |

**Two readings.** First, +33.5 MB for 100 x 2 MB says the evidence path streams; the number that would have said otherwise is +200 MB, and it is not there. Second, the local p95 of 1,146 ms with the HTTP layer in and no network is HIGHER than Render's 801 ms with the network in and the HTTP layer out -- **the queue on the hot row is the cost, not the transport, and not the API.** At A1's shape (one order per seller per day) no row is hot; the hot-row case is a launch, a broadcast, a single product going viral, and it degrades to seconds rather than to failure.

**What was not measured:** the API's RSS under a sustained mixed load (reads, uploads, and orders together over an hour), because nothing in the repository generates one (D-312) and building a load generator is not this order. The number here is the worst single path, measured; a sustained-load number is NOT TESTED.

### The sellers table

A1's shape throughout: one order per seller per day, 20 products x 3 variants, eleven accounts per seller, one in five orders unclaimed. **Every database number was measured on `adulis_probe_3` (Render, 256 MB, PostgreSQL 17.11); every process number on this laptop, as an upper bound.** The S18 topology is two API instances and one worker.

| sellers | orders / day | database (measured) | indexes vs `shared_buffers` 64 MB | connections, S18 topology | expiries / min vs the worker cap | **what breaks first** | **at what number** |
|---|---|---|---|---|---|---|---|
| **50** | 50 | 19 MB | 6.5% | 60 of 97 | 0.007 of 500 | **the first closed connection (D-310)** -- the process exits | **1 seller.** Load is irrelevant to it |
| **500** | 500 | 43 MB | 30.6% | 60 of 97 | 0.07 of 500 | still D-310; nothing measured degrades at this row | -- |
| **5,000** | 5,000 | **264 MB** | **252%** | 60 of 97 | 0.7 of 500 | **RAM: the working set left the tier** -- cold storefront reads at 150x warm | **~1,900 sellers** (indexes exceed `shared_buffers`); **~3,500** (database exceeds `effective_cache_size`); **~4,800** (database exceeds the instance) |

**The first thing that breaks is not in the table's columns.** D-310 breaks at one seller, at the first maintenance restart or idle-connection reap, and it is three lines of code. Everything below assumes it is fixed, because until it is, no capacity number matters.

**The second thing that breaks is RAM, at ~1,900 sellers on the 256 MB tier, and it does not fail -- it slows.** The catalogue, not the orders: 126 of 264 MB is `product_variant` and 88 MB of that is index, two of them the tenant-pinning FK targets. **The isolation design costs 2.3 bytes of index per byte of variant, and that is a price worth paying, but it is the number that sets the tier.**

**What does NOT break at any row:** connections (60 of 97 at S18; they break at the first scale-out step -- the third API instance plus the second worker is exactly 97), the hot-row path (it degrades to seconds under a convoy and never to a wrong number), API memory (streams), and the worker's structural caps (0.7 a minute against 500).

**What breaks in wall-clock time rather than in sellers:** D-314 and D-313 -- the sweep's walk over every order it ever expired, and the ledger scan on every release -- grow with orders-ever, not sellers, and reach the tier's cache limit in the second year at the 5,000 row (365,000 expired orders; 1.8 million ledger rows). At 500 sellers they take ten years.

### Recommendation, staged, with triggers -- and not a rewrite

Nothing here changes the architecture. One API, one PostgreSQL, two processes, no broker, no cache tier, no read replica: the shape holds to 5,000 sellers on a tier upgrade and four small changes, and the order's instruction was to name the triggers rather than pre-build the stages.

**Stage 0 -- before the first seller. No trigger; these are the beta.**

| change | what it is | why now |
|---|---|---|
| **an `error` listener on all three pools** (D-310) | three lines; log and let the pool discard the client | the process otherwise exits on the first closed connection |
| **pass `pgPool` into graphile-worker's `run()`** | one argument; the worker stops opening its own eleven | 23 -> 12 connections per worker; the cheapest capacity change in this report |
| **the sweep index predicate** (D-314) | one migration: `AND state IN ('CREATED','NOTIFIED')` | linear-in-expired-ever, once a minute, forever |
| **the release lookup index** (D-313) | one migration: `(reservation_id) WHERE reason = 'ORDER_CREATED'` | linear-in-orders-ever on every expiry and cancellation |
| **a connection alarm** in `worker.heartbeat` | `count(*) FROM pg_stat_activity` against `max_connections`, warn at 80 | the D-273 shape: 62% with no alarm on it fails on a Tuesday |

**Stage 1 -- the database tier. Trigger: 1,000 sellers, or `pg_database_size` above 128 MB, whichever first.** Move the database to the 1 GB tier (`shared_buffers` 256 MB). No code change. The three crossing points scale with the tier: ~7,600 / ~14,000 / ~19,000 sellers. Cost, not engineering.

**Stage 2 -- a pooler in front of the API. Trigger: the third API instance or the second worker is needed** -- which the arithmetic says is p95 on `POST /v1/orders` above one second sustained, or a push backlog above thirty minutes. PgBouncer in transaction mode in front of the API only. **The code is already shaped for it:** every request's GUCs are `set_config(..., true)`, transaction-local by rule, which is exactly the property transaction pooling needs. The worker stays on a direct connection (graphile-worker's LISTEN/NOTIFY does not pool). This is the stage that turns 97 into a budget rather than a ceiling.

**Stage 3 -- the catalogue. Trigger: 300,000 variants (5,000 sellers at this shape), or the 1 GB tier's index set above its `shared_buffers`.** The next tier up, again. **Not recommended:** dropping any of `product_variant`'s five indexes (two are the isolation design; the other three serve the storefront, the seller console and the uniqueness rule), a search engine for `idx_product_name_trgm`, or a read replica -- each is an architecture change with a reissue behind it, and none is needed inside this table.

**What can wait, and why:** D-315 (notification retention -- a ruling first, then a job); D-312 (the three unwritten load tests -- a build order); the sweep's structural 500/minute (a `LIMIT` change when a burst is a real event rather than a hypothetical). **What cannot wait is Stage 0, and Stage 0 is a day.**
