# FINAL TEST REPORT - What Breaks, And At What Number

**Order:** T25. **Status: STOPPED on a BLOCKER (D-320) at the end of Phases 2 and 3 and reported; the author instructed the order to continue. Phase 4 in progress on that instruction. A SECOND BLOCKER (D-325, a cross-tenant write) was confirmed by the refutation pass after the stop and is reported in SECURITY; no attack was launched after the stop -- the refuters that found it were already running.**

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

---

## SECURITY

**Where it ran:** the API built from this branch, booted on this laptop in `development` against the local database, with the fake SMS and push adapters bound. **Not the deployed surface** -- there is none (WHERE IT RAN). Every attack below was made with real HTTP requests or real SQL as the role named; every verdict names the command. The attackers were eleven agents, one per class, and **every FAILED verdict and every HELD verdict in a BLOCKER class was then attacked by a second agent whose only job was to refute it** -- because the order's warning stands: the agent testing its own work is the largest gap in this report, and a second author reduces that gap without closing it.

### The map first: what actually holds tenant isolation, table by table

The order says three layers -- RLS, the scope check, the composite foreign keys -- must each hold independently. **Measured on the local database before any attack, that is not the shape of the schema:**

```
tables in the application schemas                 119
tables with row-level security                      5
policies for adulis_app                             3   -- ALL on core."order"
   SELECT   USING (actor_role <> 'COURIER')             -- a role filter, not a tenant filter
   UPDATE   USING (true)
   INSERT   (no predicate)
seller-scoped tables adulis_app can SELECT with
   NO policy at all                                34   -- product, product_variant, reservation,
                                                        --   cart, cart_line, payout_details,
                                                        --   seller_team_member, stock_event, review ...
composite (tenant-pinning) foreign keys             15
SECURITY DEFINER functions                          63
functions that call fn_has_permission themselves     4
```

**So RLS is not a tenant layer here.** It restricts couriers on one table. On the 34 seller-scoped tables `adulis_app` can read, isolation is held by exactly two things: **the scope check** (`fn_has_permission` raising `U0002`/`U0001`, called by the guard on every seller-scoped request and by four functions), and **the composite FKs**, which make it impossible to *write* a child row that names one seller's parent under another seller's id -- but say nothing about *reads*. A read that reaches a table with the wrong `seller_id` in its WHERE clause, or with none, has nothing beneath it. That is the layer the attacks below lean on hardest, and the reason "which layer is the ONLY one holding it" is asked per table.

### THE ORDER STOPPED HERE: one BLOCKER, reproduced by the author

**`DELETE /v1/seller/products/{id}` and `/v1/seller/variants/{id}` tell any seller whether another seller's product exists and is selling right now.** The handler asserts `seller.products:write` (the actor may write to the actor's OWN seller -- true), then counts ACTIVE reservations by the client-supplied product id with **no seller predicate**, and throws 409 before the first seller-scoped statement. As the owner of seller A, with the console Origin and B's ids:

```
DELETE /v1/seller/products/<B's product with a live reservation>   409  PRODUCT_HAS_ACTIVE_ORDERS
DELETE /v1/seller/products/<B's product with none>                  404  NOT_FOUND
DELETE /v1/seller/products/<an id that does not exist>              404  NOT_FOUND
B's rows afterwards: unchanged
```

The order's rule is "404, not 403 -- a 403 confirms the object exists." **A 409 confirms it exists and is selling.** Product ids are in storefront links, so this is a competitor's live-sales signal, per product, on demand. Nothing is deleted and nothing is read across the line, which is exactly why the FKs and the scope check both held in the same pass: it is the one read the service makes before it scopes, and the map above is why nothing beneath it caught it. **D-320. Phase 4 was not started.** The refuters that were already running when it was found finish on their own and their verdicts are folded in below; no further attack was launched after the stop.

### Verdicts by attack class

Every class ran as one agent against the local API with real requests; every FAILED, and every HELD in the four BLOCKER classes (3.1, 3.4, 4.3, 4.7), was handed to a second agent told to refute it. **"Refutation pending" means the skeptic had not returned when the order stopped.**

| class | HELD | FAILED | NOT TESTED | the verdict in one line |
|---|---|---|---|---|
| **3.1 tenant isolation** | 12 | **2** | 4 | reads, header-swap, scope check, composite FKs all hold; **the DELETE pre-check leaks (BLOCKER, D-320)**; RLS holds nothing seller-vs-seller (D-319) |
| **3.2 the six gates** | 9 | 0 | 1 | all six fail alone, each above or inside `fn_has_permission`; the seller-status 409 gate is not `fn_has_permission`'s and was not driven |
| **3.3 step-up** | 7 | **2** | 1 | audience, replay, foreign challenge, wrong action, expiry, concurrent reuse all refuse; **target binding unenforced (D-322); consumption rolls back (D-323)**; 3 of 8 actions driven end to end |
| **3.4 boundaries** | -- | -- | -- | **the first agent returned nothing usable; re-run in progress at the stop.** What stands is T24's evidence (D-309): `read_attestation` refuses an ungranted operator and `adulis_app` cannot read `access_log` |
| **4.1 enumeration** | 8 | 0 | 2 | byte-identical on every anonymous phone path; timing 0.97-1.17x; **D-203's countable version holds on both sides** |
| **4.2 idempotency** | 5 | 0 | 3 | D-69 holds on every must-be-indistinguishable endpoint; the rest by inspection |
| **4.3 media** | 4 | **2** | 1 | mint isolation and the evidence bucket hold (both refuter-confirmed); **video key unowned (D-321); bytes unvalidated (D-317, refuter-confirmed)**; R2's real policy NOT TESTED |
| **4.4 handoff** | 15 | 0 | 2 | forgery, replay, third-party scan all refuse; the composite key needs the buyer -- proven |
| **4.5 payout** | 6 | 0 | 2 | cancel-then-set locked; the chain end to end; the outgoing owner loses payout AND evidence on the flipping request |
| **4.6 web surface** | 8 | **2** | 3 | injection parameterised; session rules hold; **CSP not served by the defined deployment (D-318, found by a refuter)**; garbage cursor -> 500 (D-324) |
| **4.7 secrets** | 8 | 0 | 1 | bundle and logs clean under a real OTP sign-in; two refuters widened the search and found nothing |

**3.1 Tenant isolation -- HELD 12, FAILED 2, NOT TESTED 4.**
HELD: as A's owner, every read with B's ids -> 404 (products, orders, variants and stock events, QR, claims, chat messages, reviews, payout, payment evidence); `X-Adulis-Seller: B` on A's session -> 404 from `fn_has_permission` U0002; direct calls: stranger U0002, suspended member U0001, rightful void; 404-for-stranger vs 403-for-suspended-member mid-session through the API; the five composite FKs (`variant_product_seller`, `stock_event_variant_seller`, `reservation_order_seller`, `cart_line_variant_seller`, `cart_line_single_seller`) each refuse a child naming A's seller under B's parent; seller-scoped functions called with A's actor and B's target refuse; courier revoke isolated. **Commands:** `p23/01/attack.sh`, `scope.sql`, `fk.sql`, `fk2.sql`, `rls.sql`.
FAILED: **D-320** (above). **D-319**: as `adulis_app` with the GUCs set to A, every one of B's rows on all ten tenant tables is visible -- RLS is live (the courier control sees 0) and fences couriers only.
NOT TESTED: the mutating POSTs (publish, payment/confirm) returned **500 for the attack AND the rightful control** from unmapped database refusals (D-324), so their isolation is unmeasured, not held; `order_courier_assignment` has no `seller_id` and no composite FK, so that layer does not exist for it; team revoke needs a step-up challenge (class 3.3's surface); the buyer-vs-buyer axis was not built.
**Per table, the ONLY layer holding reads is the service WHERE on `seller_id`.** Writes have the FKs beneath them. `financial.payout_credential` has GRANT alone.

**3.2 The six gates -- HELD 9, NOT TESTED 1.** State: account SUSPENDED -> 401 SESSION_REVOKED at `authenticate` while `fn_has_permission` still returns void, so state is enforced ABOVE the function. Standing: a member suspended mid-session fails the very next request (R28), 403; revoked -> 404. Role: a role without the permission -> U0001 directly and 403 through the endpoint. Surface: a MOBILE session on a console-only permission -> 403. Entitlement: 409 TIER_LIMIT_REACHED from `billing.fn_effective_limit` with `fn_has_permission` returning void. Scope: a seller the actor never touched -> U0002/404. Every non-granted permission called directly -> U0001. NOT TESTED: the seller-state 409 (SAFETY_SUSPENDED / CLOSING) -- by design not `fn_has_permission`'s gate ("gate 0", its own comment) and enforced in specific services; the seller-scoped console READ paths do not check it. **Commands:** `p23/02/`.

**3.3 Step-up -- HELD 7, FAILED 2, NOT TESTED 1.** HELD, with a working positive control (real request -> OTP from `.dev-sms.log` -> verify -> consume): MOBILE session -> 403; consumed challenge replayed -> 403 STEP_UP_REQUIRED; another account's challenge -> the same 403 (no existence oracle); a different action's challenge -> 403 STEP_UP_ACTION_MISMATCH; expired -> 403 STEP_UP_EXPIRED; **two parallel requests with one challenge -> exactly one 200 and one 403** (D-32's `FOR UPDATE`). FAILED: **D-322** -- a challenge minted for member C spent on member B -> 204 (`target_ref` written at issuance, read by nothing); **D-323** -- a challenge spent on a failing handler is un-consumed by the rollback and spendable again. NOT TESTED: five of the eight actions end to end (PAYOUT_CHANGE, SUBSCRIPTION_CHANGE, SELLER_DELETION, IDENTITY, OWNERSHIP_TRANSFER need heavy state fixtures); driven for REVOKE_ALL_SESSIONS (full matrix), TEAM_CHANGE and REISSUE_INSTRUCTIONS; the mechanism is one function, `core.fn_assert_step_up`, so the matrix results transfer and the target gap transfers with them. **Commands:** `p23/03/probe.sh`, `probe3.sh`.

**3.4 The boundaries -- NOT REPORTED BY THIS PASS.** The agent assigned `financial.read_payment_evidence` and `verification.read_attestation` returned a one-line placeholder instead of a result; a replacement was launched and had not returned at the stop. What is already on record from T24 Phase 3 (D-309), measured on Render as `adulis_app`: `read_attestation` as a granted operator returns; as an ungranted account raises `no grant permits reading an identity attestation`; `adulis_app` selecting `verification.access_log` -> `permission denied`. Ciphertext-vs-plaintext, "naming another actor", and "every read logged with the right actor" are **NOT TESTED in T25 until the replacement returns**, and this line will be replaced when it does.

**4.1 Enumeration -- HELD 8, NOT TESTED 2.** Every anonymous phone-taking path (`auth/otp/request`, `/resend`, `auth/recovery`, `deletion/otp/request`, both verify endpoints): same status, byte-identical body, identical Content-Length, no timing header, 20-sample median wall-clock ratio 0.97-1.17x registered vs unregistered. `auth/recovery` does registration-dependent work (an `account_recovery_case` INSERT for known numbers -- 20 rows created) at a ~1.4 ms delta with a byte-identical response: a note, not a finding. **D-203, both sides:** the issuer stamps `otp_max_attempts` from the DEVICE's market (3 for a registered phone whose account lives in a market set to 6, issued through a market-A device), and verify reads the stamp: refusals before the 429 were 2/2/2 for registered / unregistered / account-in-another-market, and 5 in a second market set to 6 -- the count tracks public device-market configuration, never registration. Handle and device-id axes distinguish existing from missing by design (public storefront lookup; an unenumerable device echo). NOT TESTED: the cookie-presented (`__Host-adulis_browser`) variant -- the two presentations converge in `requestingDevice()` by code, not exercised; the deployed tier's timing floor. **Commands:** `p23/class05/`.

**4.2 The idempotency channel -- HELD 5, NOT TESTED 3.** D-69 holds where it must: the courier invite (G1.8), `auth/recovery` ("202 for any number"), `auth/otp/request`, `deletion/otp/request` all COMMIT on the registered and the unregistered branch; a same-body replay returns `X-Adulis-Idempotent-Replay: true`, a different body returns 409 IDEMPOTENCY_KEY_REUSED, identically for a known and an unknown phone. NOT TESTED: `storefront/post-links/resolve` (never throws, so the precondition cannot be met), the seller-owned mutation POSTs and the buyer POSTs -- by inspection they operate on the caller's own resources with no hidden-fact branch; each would need a bespoke stateful fixture to reach an in-handler failure. **Commands:** `p23/class06/`.

**4.3 Media -- HELD 4, FAILED 2, NOT TESTED 1.** The API is bound to the REAL S3 adapter against a live local MinIO (`adulis-media`, `adulis-evidence`), so presigned PUTs and bucket policies were exercised, not faked. HELD: minting an image URL for another seller's product -> 404 at the composite `product.seller_id` check, and the forged `X-Adulis-Seller` variant -> 404 (refuter: reproduced, then eight traversal crafts -- literal `..`, `%2e%2e`, `..%2f`, `//../`, evidence-crossing -- all refused, by MinIO and by the image COMMIT's `products/<productId>/img/` prefix guard); **the evidence bucket has no unsigned path**: anonymous GET / HEAD / list / prefix-list / PUT / DELETE / `?policy` on `evidence/raw` and `evidence/framed` -> 403, the only evidence URL any client ever receives is the buyer's own 900-second signed PUT, and framed keys never leave the server (refuter-confirmed with a wider set of vectors than the attacker's). FAILED: **D-321** (video COMMIT key unowned); **D-317** (bytes validated by count only; content-type not even signed -- refuter-confirmed against ADU-CON-02 S8.1's own promise). NOT TESTED: **the production R2 buckets' actual policy** -- no credential and no Cloudflare console here; the code sets no public policy and R2 defaults private, so what a person with the dashboard must check is that neither `adulis-evidence` nor `adulis-staging-evidence` has an `r2.dev` public URL or a public custom domain enabled. **Commands:** `p23/class07/probe1_mint_isolation.sh`, `probe2_contenttype.mjs`, `probe3_traversal.mjs`.

**4.4 The handoff token -- HELD 15, NOT TESTED 2.** Forgery is refused at three layers, each isolated: a garbage signature, a genuine HMAC for the wrong (order, nonce) tuple, and a mismatched pair -> REJECTED_SIGNATURE with no scan row; a valid photographed QR scanned by a third-party account, by the seller's courier for a DIFFERENT order, and by a buyer who is not the order's buyer -> 403 COURIER_CANNOT_SCAN, nothing consumed; the composite key requires the buyer's account -- proven by the same valid token succeeding only for the rightful courier on the rightful order. NOT TESTED: forging with the real signing key (deliberately -- it would mean using the secret and proves nothing the nonce and composite results do not); the concurrent double-consume race (`handoff_scan.nonce` UNIQUE plus a 23505 catch by design, not exercised). **Commands:** `p23/08/`.

**4.5 Payout -- HELD 6, NOT TESTED 2.** Cancel-then-set: a first set from an unseen device, cancelled, then set again from the same device -> 409 PAYOUT_LOCKED / NEW_DEVICE, while the same request from a seen device -> 201; at the DB layer, holding the device constant and toggling only the row's existence isolates the predicate ("ever had" = any row, CANCELLED included). The chain end to end: request -> unsuppressible PAYOUT_CHANGE_REQUESTED SMS -> 24 h (advanced as the superuser) -> `payout.activate_due`'s body as `adulis_jobs` (0049's grant works) supersedes the prior ACTIVE and writes an unsuppressible PAYOUT_CHANGE_ACTIVATED. Ownership transfer: the outgoing owner reads payout 200 the request before and **404 on the very request that flips `owner_account_id`**, and loses payment-evidence access (U0002) at the same instant; the new owner reads 200 with no re-auth. One latent fail-open, noted not failed: the new-device guard is `p_device IS NOT NULL AND ...`, so a device-less session would skip the lock -- sign-in always binds `session.device_id` (verified in `auth.service.ts`), so no such session exists. NOT TESTED: the RECOVERY_COOLING lock (guard 3, outside the class's three targets); the `*/5` cron tick itself. **Commands:** `p23/class09/chain_end_to_end.sh`.

**4.6 The web surface -- HELD 8, FAILED 2, NOT TESTED 3.** XSS: every seller-controlled field the console renders (product name, description, store name, profile description, variant key, chat message) stores and returns attacker markup byte-for-byte as `application/json` -- the API is not an HTML sink, so the burden is the renderer's (Phase 4, not reached) and the CSP's. CSP: **served as a real header by the e2e server and asserted by `boot-smoke` -- and absent from the only deployment the repository defines**: a refuter found `ops/render.yaml` publishes the console as a Render static site with no `headers:` key, so the policy in `_headers` is never sent (**D-318**). Session: fixation (a client-chosen session id) refused; revocation takes effect on the NEXT request; the remembered-device cookie alone authenticates nobody; `__Host-` attributes as documented. Injection: search, handle, slug, sort, cursors, ILIKE patterns, arrays -- every value bound, `pg_sleep` never fired (5-44 ms). FAILED: **D-324**, a garbage cursor -> 500. NOT TESTED: a courier NAME field and a seller review RESPONSE (neither exists on this surface -- the invite takes a phone only; reviews are buyer-written and seller-read); **browser enforcement of the CSP** (no system Chrome; the MCP browser could not launch -- the same wall Phase 4 would have met and solved with the console's bundled Chromium). **Commands:** `p23/class10/`.

**4.7 Secrets -- HELD 8, NOT TESTED 1.** The built console (4 files, 550 KB, no source maps): zero key-shaped strings (AWS, Stripe, SSH, Slack, GitHub, JWT, DSN, Twilio, Mailgun), zero 32+ hex runs (so no R2 account id), zero base64 blobs over 40 chars except React's own `internalSetStateDoNotUseOrYouWillBreakYourApp`, no unexpected hostname; `*.js.map` requests return the SPA fallback. Two refuters widened it: an entropy scan, a literal-value check of every `.env` secret against the bundle, and a **deliberately hostile rebuild with the whole `.env` exported into the build shell plus a `VITE_` canary** -- only the two `VITE_` names the code references were inlined. The API's log under a REAL sign-in (OTP requested through the running API, code read from `.dev-sms.log`, verified): the code, the phone, the session token and the Idempotency-Key are absent as substrings of ANY line -- the D-290 test, done the way D-290 says it must be. NOT TESTED: a production build with the deploy environment and the production log level. **Commands:** `p23/class11/`.

### What the second author changed -- and it changed the report

**Twenty-four refutations returned; eight died on a session limit** (seven tenant-class skeptics and one secrets skeptic), so seven of 3.1's items and one of 4.7's have one author only. Of the twenty-four: **eighteen confirmed a HELD, one confirmed a FAILED** (D-317, against the document's own words), **one withdrew a FAILED** (the step-up rollback is D-32's documented atomic consumption -- D-323 amended to a wording note), **and four overturned a HELD into a FAILED, two of them the most serious findings in this report:**

| overturned | what the attacker saw | what the skeptic asked |
|---|---|---|
| **D-325, BLOCKER** -- `fn_cancel_line` | four seller-scoped write functions refuse a stranger with U0002: HELD | *the fifth?* Its guard compares `seller_id <> (subquery)`; for a stranger the subquery is NULL and the `IF` never fires. **As seller A through the API: `POST /v1/seller/orders/{B's order}/reservations/{B's line}/cancel` -> 200, B's order CANCELLED_BY_SELLER, stock released, committed** |
| **D-326, MAJOR** -- the financial boundary | `adulis_app` cannot read the tables and every read logs: HELD | *which OTHER role?* `adulis_jobs` holds `SELECT, UPDATE ON financial.payment_evidence` from 0012:627, never revoked after D-48 -- **reads unlogged, and an UPDATE repoints evidence** |
| **D-318, MAJOR** -- the CSP | the policy file is tight: HELD | *who serves it?* Nobody: `render.yaml` publishes a static site with no `headers:` |
| D-323 -> withdrawn | consumption rolls back: FAILED | *was anything committed undone?* No -- that is D-32 as specified |

**3.4 The boundaries -- HELD 12, FAILED 1 (D-326), NOT TESTED 1.** The replacement agent, as `adulis_app` directly: reads succeed only for the rightful actor (owner, team ADMIN, an entitled operator; IDENTITY_REVIEWER for attestation), fail closed for a stranger, a wrong-role operator and a revoked grant, and work with no GUCs set because both functions authorise on `p_actor` alone; **naming another actor as the reader logs that actor only if that actor holds the grant** -- the logged role is derived server-side, there is no "logged reader" parameter, so SR-1's complete-but-false row is not constructible; every successful read wrote exactly one `access_log` row naming the actor passed (3 financial, 1 verification, delta-verified) and every denied read wrote none; evidence is ciphertext (the repo's own `encryptFramed` hides a distinctive marker and a 200 KB constant run; round-trip decrypts) and the function returns only `object_key` and the key VERSION name, never bytes or key material; `adulis_app` is denied SELECT on both access logs and every underlying table; all ten SR-1 definer functions are non-PUBLIC (`has_function_privilege` false) and `adulis_jobs` is refused execution of both escorts. The one observation the order did not ask for: `read_attestation` denies with 42501, which the API maps to 500 (D-327). NOT TESTED: `render_payment_instructions`' ciphertext path end to end (the payout class built that fixture and covered the privilege half). **Commands:** `p23/3.4-boundaries/01_ciphertext.js`, `02_app_reads.sql`, `03_verify_log.sql`, `04_privs.sql`; the skeptic's `refute/repro.sh`.

**The stop, restated.** D-320 was the BLOCKER the order stopped on. **D-325 is a second, and it is a write.** Phase 4 was started on the author's instruction to continue past the first; the second is reported here at the moment it was confirmed.

### NOT TESTED, and why -- the list the order asked for

- **The deployed surface.** There is none. Every verdict above is the local API against the local database with fakes for SMS and push and a real MinIO for storage; every number is an upper bound on what a deployment would show.
- **The boundaries (3.4)** until the replacement agent returns.
- **The production R2 bucket policy** (no credential): the one check a person with the Cloudflare dashboard must make is written out in 4.3.
- **Browser enforcement of the CSP** and **the renderer's XSS escaping**: Phase 4's surface, not reached because of the stop.
- **Five of the eight step-up actions end to end**; the mechanism is one function and was driven through three of them.
- **The write-path isolation of publish and payment/confirm** -- masked by D-324's 500s on both sides.
- **The author testing the author's work.** Eleven attackers and twenty-five skeptics reduce that gap; a second person removes it, and this report has not had one.

---

## QUALITY

**Phase 4 was not started.** The order says stop on a tenant-isolation failure, and D-320 is one. Everything below is what was prepared and what quality-shaped findings the earlier phases produced on the way -- not the day-in-the-life, not the edges, not the accessibility audit, not the Amharic layout pass. **Those four are NOT TESTED**, and the reason is the stop, not the machine.

**What was ready when the stop came, so the next run starts at the first screen:**

| piece | state | where |
|---|---|---|
| the API, `development`, fake SMS writing codes to `.dev-sms.log` | up on :3000 | `apps/api/dist/main.js` |
| the shipped console, served with its CSP by the e2e static server | up on :5173 | `node e2e/serve.mjs 5173` |
| **the Amharic-forced console** (`navigatorPrefersAmharic()` returning `true`, the only switch there is -- `AM_ENABLED` exists in comments alone) | built in a detached worktree, up on :5174 | `<scratchpad>/wt-am`; never committed |
| an accessibility engine | axe-core 4.10.2, installed OUTSIDE the repository | `<scratchpad>/p4/node_modules/axe-core` |
| a browser | the MCP browser needs a system Chrome this machine lacks; the console's bundled Chromium (Playwright 1.56.1, build 1194) was being installed at the stop | `pnpm --filter @adulis/console exec playwright install chromium` |
| the seeded seller and buyer, and the sign-in path | `+251900000001` / `+251900000002`, OTP from the dev SMS log | `apps/console/e2e/helpers/session.ts` |

**What the earlier phases found that a seller would feel, in the order a seller would meet them:**

1. **The API and the worker exit on the first closed connection** (D-310). A seller's symptom is a 502 for the length of a boot, on no schedule, with nothing in the log that says why. This is the first thing in this report to fix and it is not a security finding.
2. **A garbage cursor is a 500** (D-324). A seller's browser will not send one; a stale bookmark or a back button on a paginated list might, and the page says "something went wrong, try again" for a URL that will never work.
3. **Seller-controlled text is stored as typed** (class 4.6). The renderer's escaping is the whole defence on the console, and it was not audited -- that is Phase 4's first screen. The CSP that would have been the second defence is not served by the blueprinted deployment (D-318).
4. **The console e2e harness dies on a directory URL** (D-316), which is a test-quality finding: a run that fails this way reads as a product outage.
5. **"Six load tests" is three** (D-312), and the three cannot run on a managed provider (D-307); the repository's repeatable coverage of the deployed tier is zero.

**What embarrasses, on the evidence so far:** nothing a buyer sees. Every buyer-facing path that was attacked -- OTP, enumeration, handoff, evidence, payout -- held. What embarrasses is on the seller side and is invisible until it is looked for: a competitor reading your live orders through a status code, and a step-up code approved for one member spent on another.

---

## RECOMMENDATION

**What to fix before a beta -- in this order, and every one of them is small:**

| # | fix | register | why first |
|---|---|---|---|
| 1 | **`fn_cancel_line`'s seller-arm guard rewritten as its siblings have it (`IF NOT FOUND`)**, and a grep of every scope predicate in `db/migrations` for an inequality against a subquery | **D-325** | a seller cancels another seller's order line through the API today, committed; the grep finds the next one |
| 2 | **the unscoped pre-check in `deleteProduct` / `deleteVariant`**, and a grep for the same shape (a count or existence read keyed by a client id with no `seller_id`) across every service | **D-320** | the first BLOCKER; one line, and the grep is the real deliverable |
| 3 | **`REVOKE SELECT, UPDATE ON financial.payment_evidence FROM adulis_jobs`**, the purge job re-run to prove 0026's functions carry it, and Appendix C check 10 extended to assert no role but the owner holds a table privilege in `financial` or `verification` | D-326 | the worker reads the boundary table unlogged and can repoint evidence; D-48 already believes the grant is gone |
| 4 | **an `error` listener on all three pools** | D-310 | the process exits on the first blip; three lines |
| 5 | **step-up target binding** -- `fn_assert_step_up` takes and compares the target, every call site passes it, the SMS names it | D-322 | an approved code is spent on the wrong member or order (the rollback half, D-323, turned out to be D-32 as designed and needs a word, not a fix) |
| 6 | **`headers:` in `render.yaml` generated from the same source as `_headers`**, and the blueprint gate failing when they disagree | D-318 | the console ships without its CSP |
| 7 | **magic-byte and dimension validation at image COMMIT, content-type signed into the PUT; the prefix guard on the video key** | D-317, D-321 | the document already says the first; the second is copying a guard |
| 8 | **validate the cursor before the cast; map 22007 / 22P02 to 400**; `read_attestation`'s denial as U0001 | D-324, D-327 | it also unmasks the write-path isolation tests; and a denial must never look like our own grant bug |
| 9 | **`pgPool` into `run()`; the two indexes; the connection alarm** | capacity Stage 0 | a day, and the numbers above assume it |

**Two things a second author taught this list.** Items 1 and 3 were HELD until a skeptic asked "which function did you NOT call?" and "which role did you NOT connect as?" -- the attacker's four functions all used the safe pattern, and the attacker's one role was the one the reviews describe. **Before a beta, the tests that stand in for those two skeptics are: every seller-scoped write function called once with a stranger actor, and every role's table privileges in the two boundary schemas asserted to be none.** Both are a page of SQL, and both would have found these on the day they were written.

**What can wait, and what it costs to wait:** the database tier (Stage 1 at 1,000 sellers -- cost, not code); the pooler (Stage 2, when the arithmetic says so); notification retention (D-315 -- a ruling first); the three unwritten load tests (D-312); the harness fix (D-316). **What cannot be decided by this report:** whether RLS was ever meant to carry tenant isolation (D-319) -- if it was, the 34 tables need policies and the RAM section says what that costs; if it was not, the reviews that say it does are wrong and should say so. Either way, until it is decided, **the service WHERE clause is the tenant boundary and every reviewer should read it as such.**

**What this report did not do, said plainly:** it did not run on the deployment (there is none), it did not reach Phase 4, its boundary class is pending a replacement agent, and its author is its largest gap.
