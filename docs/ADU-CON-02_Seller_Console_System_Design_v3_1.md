# ADU-CON-02 -- Seller Console: System Design, Build and Operations Guide

**Version:** 3.1  -  **Baseline date:** 28 August 2026
**Owner:** Founder / CEO (back-end)  -  COO/CTO (front-end)
**Supersedes:** ADU-CON-02 v3.0
**Status:** Binding architecture record **and the standing operating manual.**
**Certified capacity:** **10,000 active sellers** (~200-300k monthly buyers) under the assumptions of ADU-CON-02-A1, with defined triggers for everything beyond -- S17.
**Drawn from:** ADU-CON-01 v1.0  -  ADU-CON-02-A1 v1.0  -  **ADU-DB-01 v1.12**  -  **ADU-API-01 v1.7**  -  **ADU-AUTH-01 v2.5**  -  **ADU-REPO-01 v1.2**  -  ADU-CON-03 v1.1  -  ADU-RUL-01 v1.0  -  ADU-ARCH-01 v2.0  -  ADU-SEC-01 v1.0  -  ADU-PRD-01 v8.5

---

## 0. What this document is, and how to read it

Both developers are beginners working with AI coding agents; this document is written for that reality, in three parts. **Part A** -- the system: what we are building, with which technologies, and why each one won including what lost. **Part B** -- building it: the repository, the environment, how we work with the agents, the tiers and their gates. **Part C** -- running it: hosting, deploys, backups, monitoring, maintenance, and the capacity posture.

**Two rules about this document itself:** (1) when the agent's output and this document disagree, **this document wins** -- the document is amended first, then the code, never the reverse; (2) **MVP means MVP** -- every choice is the smallest thing that satisfies the binding invariants, and where a bigger option exists it lost on purpose, with the upgrade path noted only where it matters.

> **Plain-terms boxes** like this explain a concept from zero. Read them once; skip them after.

---

## 0.2 What changed in v3.1

**v3.0 was written before anything was built. v3.1 is what building it changed.** Two named defects, three sections superseded by other documents, and -- the substantial one -- **six modelled numbers replaced by measured ones.**

| # | Change | S |
|---|---|---|
| **D-51** | **`/healthz` returns 200 with `status: degraded`, never 503.** v3.0's *"reddens"* would remove the instance from the load balancer -- a stale worker heartbeat would have taken the API down | 20.2 |
| **D-27** | **The request wrapper sets four settings, not three.** A ratified function body reads `adulis.audience` | 6.1 |
| -- | **S6.3's error mapping is rewritten.** `insufficient_privilege` -> 500 was correct until ADU-DB-01 began raising it deliberately for a 403. **`U0001` / `U0002` / `42501` now separate the three cases** | 6.3 |
| -- | **S12's repository tree is superseded by ADU-REPO-01 v1.2.** v3.0 described two apps and put the website in another repository; there are now five workstreams in one | 12 |
| -- | **S15's tier table records what was built**, and gains the tier that was missing: **the worker** | 15 |
| -- | **S17's capacity certification is measured, not modelled**, for six of its rows | 17 |
| -- | **S21's cost model gains two lines** and records one constraint that is not a cost | 21 |

### The one that would have caused an outage

**D-51 is small and it is the kind that takes a service down.** v3.0 said a stale worker heartbeat *"reddens `/healthz`"*, and S18 puts `/healthz` behind the platform's health check -- **which removes an instance that fails it.** A worker that stopped would therefore have removed the **API** from service, turning a background-job failure into a total outage. The build returns **200 with `status: degraded`** and alerts on the body, which is the distinction between *tell me* and *act on it*.

**Everything not listed above is carried forward from v3.0 unaltered.**

---

### 0.1 What changed in v3.0 -- retained for history

v2.0 was tested against the capacity model of **ADU-CON-02-A1**, which found the design as specified fails economically at ~80 sellers and carries one build-time trap. v3.0 folds in the four corrections so the system **supports at least 10,000 sellers**:

| | Ruling | What changed | Fixes A1 rung |
|---|---|---|---|
| **R17** | **Remembered-device console sessions** (adopted from RR-17) | S4.3 rewritten: 7-day absolute / 8-hour idle on a device the seller marks remembered; 12h/30min otherwise. SMS falls ~70%: **$6.5k -> ~$2.0k/month at 10k sellers**, and the residual is transaction-shaped | 1, 2 |
| **R16** | **`seller_public_stats` is a trigger-maintained table, never a `MATERIALIZED VIEW`** | S6.4 new; Appendix C gains check 15 (`grep "MATERIALIZED VIEW"` = 0) | 3 (build-time) |
| **R18** | **Evidence is encrypted as ~64 KB AEAD frames and streamed** | S8.2: constant-memory decryption; 20 concurrent viewers cost ~5 MB, not 100 MB | 6 (built right now) |
| **R19 v2** | **Analytics partitions retire to R2 after a 90-day live window** (tightened from A1's 6 months: 153-225 GB live at 10k sellers priced managed storage out) | S3.7 job list; export as Parquet, queryable offline; window is a config value | 4 |

Also new: S17 (the certification and the upgrade triggers), S20.2 (capacity alarms), S21 (cost model split into infrastructure vs cost-of-revenue), API minimum two instances (S17.2), and per-table autovacuum tuning for the churn tables (S15 tier 2). Everything else is carried from v2.0 unaltered.

---

# PART A -- THE SYSTEM

## 1. The system on one page

**One API, four clients, two processes, one database.**

```text
                          THE INTERNET
                               |
                    -----------------------
                    |     Cloudflare      |  DNS, TLS, edge cache,
                    |    (Pro plan)       |  edge rate limits, Pages, R2
                    `-----------------------
        -----------------------+-------------------------------
        |            |         |              |               |
  adulis.example  console.  media.adulis   Mobile app     api.adulis.example
  Public website  adulis    R2, custom     (later: Expo)        |
  Next.js on      React SPA domain,                   ---------------------
  CF Pages        on CF     public media              |  Render (Frankfurt)
  (separate repo) Pages     only                      |  ----------------
                                                      |  | api x2       | NestJS, HTTP
                                                      |  |---------------|
                                                      |  | worker       | graphile-worker
                                                      |  |---------------|
                                                      |  | PostgreSQL 17| 9 schemas, 6 roles,
                                                      |  | managed,PITR | 107 tables
                                                      |  `----------------
```

- **The console is a static site** on Cloudflare Pages -- no server of its own; everything it knows it learns by calling the API with the seller's session cookie.
- **The API is one NestJS service; every client calls the same one.** What each caller may do is decided *inside the database* by `core.fn_has_permission(account, seller, permission, audience)` -- never by having different back-ends.
- **The worker is the same codebase started differently**, running the scheduled jobs (order expiry, notification dispatch, evidence purge, partition retirement...). Two processes so a heavy job can never make a seller's click slow.
- **The database is where the rules live.** Stock cannot go negative, a courier cannot read another seller's orders, a payout change cannot skip its delay -- because Postgres refuses, regardless of what any code does. Application code is deliberately thin. **This is what makes a beginner-plus-agent team safe:** generated code is plausible far more often than it is correct, and a `CHECK` constraint does not care how plausible the code was.
- **The edge carries the buyers.** Anonymous storefront traffic -- the largest number in the system -- is served from Cloudflare's cache and mostly never reaches the origin. A1 showed this one decision is why 10,000 sellers produce only ~190 origin requests/second at peak.

> **INVARIANT -- there is no per-surface back-end.** No BFF, no gateway, no microservices. A surface is a value checked inside the permission function, not a deployment.

## 2. Ethiopia-only or global from day 1

**Almost nothing differs, by design.** Every market-varying dimension is a configuration row (ADU-PRD-01 S19, ADU-DB-01 S5); a second market is an `INSERT`. What genuinely changes if users arrive globally: SMS reach (the Twilio secondary already covers it), API latency for far-away users (acceptable at MVP; the fix later is a second region, not a rewrite), and a GDPR legal question if EU users are served (a review item, zero engineering delta). Payments change *nothing* -- buyers pay sellers directly, so there is no payment-rail work per country.

> **RULING -- build as if global, launch as configured.** The launch decision is a business decision with zero engineering cost either way.

## 3. The technology register

Each entry: *what it is -> why this one -> what lost.* Majors here; exact versions pinned in the repo.

### 3.1 TypeScript everywhere, on Node 22 LTS

> **Plain terms:** TypeScript is JavaScript plus a compiler that refuses ill-typed code; Node runs it outside the browser; LTS versions get fixes without breaking changes.

One language across console, API, worker, future mobile app and the public site: one skill set, one agent-instruction style, shared packages. `strict: true`, no exceptions -- **an entire class of agent mistakes fails the build instead of production.** `.nvmrc` pins the version everywhere; "works on my machine" is almost always version skew, deleted here. *Rejected:* a second back-end language -- halves the review capacity of a two-person team.

### 3.2 PostgreSQL 17 -- the centre of the system

> **Plain terms, the four features you will meet constantly:** a **`SECURITY DEFINER` function** runs with its owner's permissions, not the caller's -- a locked door with a receptionist: you never get the key, you get escorted, and the visit is written down. **Row-level security (RLS)** makes the table itself filter rows by who is asking -- a courier's `SELECT` returns only their assigned orders even if our code forgets the `WHERE`. A **trigger** is a function the database runs automatically on writes -- our stock count is maintained *only* by one. A **transaction** makes a group of statements succeed or fail as one.

ADU-DB-01 is *written in* Postgres features: nine schemas with six roles, the two isolated boundaries, `EXCLUDE USING gist` making duplicate reservations impossible, append-only by `REVOKE`, pgvector for the chatbot, pg_trgm for search, and the job queue itself. **Postgres is the sole datastore** -- no Redis, no broker, no search cluster. Every extra datastore is a thing that can be down, unsynced, or unbacked-up; at our volume Postgres does all their jobs (rate limiting is a table, the queue is a schema, search is an index). A1 confirmed the honest ceiling of this choice -- ~200-300k sellers on the largest single node -- which is far beyond every gate in ADU-PROJ-01 S11.

### 3.3 NestJS 11 -- the API framework

> **Plain terms:** a framework structuring a Node server into modules, controllers (receive HTTP) and services (do the work), via decorators like `@Post('/orders')`.

Two load-bearing reasons: **its decorators generate our OpenAPI spec** -- the contract the front-end is built against (S11) -- and its opinionated structure means generated code lands where a reviewer expects. Services stay thin: **a state-changing endpoint's service method is one call to one named database function** (ADU-API-01 S13) **and nothing else of consequence.** *Rejected:* bare Express/Fastify (the agent invents a structure per session); Next.js API routes (the API serves four clients and runs a worker; it is not a website appendage).

### 3.4 Kysely -- database access, and why there is no ORM

> **Plain terms:** an ORM (Prisma, TypeORM) maps tables onto objects and writes SQL for you -- `order.save()`. A query builder like Kysely is lighter: typed queries for reads, and a `sql` template tag that inserts parameters safely for everything else.

**The most argued decision here, in full:** (1) **ORMs exist to let application code write tables -- our architecture forbids exactly that.** Every state change goes through a named function so the invariants execute inside the database; `order.save()` is the bypass, and an ORM makes the wrong thing the easy thing. (2) ORMs do not speak this schema's language -- composite-FK scoping, `EXCLUDE` constraints, cross-schema `SECURITY DEFINER`, RLS on per-transaction settings. (3) Migrations are already hand-written SQL; an ORM's generator is a second author of DDL to audit against the first. (4) **What Kysely gives instead:** `kysely-codegen` derives TypeScript types *from the live database*, so types cannot drift from migrations and **an agent that invents a column writes code that does not compile**; reads get autocomplete; writes are parameterised `sql` calls, making string-built SQL -- the classic agent-introduced injection -- structurally awkward. *Rejected:* Prisma, TypeORM, Drizzle-as-write-path, raw `pg` alone (no typed reads).

### 3.5 `node-pg-migrate` -- SQL-file mode only

> **Plain terms:** a migration is a numbered SQL file changing the schema; the runner applies each exactly once, in order, recording it, so every environment converges.

The DDL already exists in ADU-DB-01; the runner applies it, transactionally, under the DDL-only `adulis_migrate` role, from CI -- **never by hand against production.**

### 3.6 graphile-worker -- jobs in Postgres

A database function that enqueues a notification **in the same transaction** as the state change means the two commit or fail together -- a guarantee no external broker gives without distributed-transaction machinery. **Every job is idempotent** (partial unique index or compare-and-set), because at-least-once is what any queue truly guarantees.

### 3.7 The job list (ADU-DB-01 S24, plus v3.0's additions)

All 21 specified jobs, unchanged, **plus:** `analytics.retire_partitions` (monthly -- detach partitions older than the 90-day live window, export to R2 as Parquet, drop; **R19**) and the worker heartbeat (S20.1). Worker concurrency starts at 10; the 08:00 EAT reminder at 10k sellers dispatches ~8,000 pushes in ~0.7 minutes on one dispatcher -- parallelise only when measurement says so.

### 3.8 Zod -- validation at the door

TypeScript types vanish at runtime; a request body is untrusted bytes until proven. One Zod schema per endpoint validates, produces the handler's type, and feeds the OpenAPI generation -- one definition, three jobs.

### 3.9 The console: Vite 7 + React 19 + React Router 7 + TanStack Query 5 + Tailwind 4

> **Plain terms:** Vite builds the front-end and runs the instant-reload dev server; React renders UI from state; Router maps URLs to screens; Query manages fetching/caching server data; Tailwind styles via utility classes.

- **Vite over Next.js -- security-driven, not taste.** Next.js injects inline bootstrap scripts, forcing the nonce CSP machinery of ADU-SEC-01 S8. A Vite SPA has **zero inline scripts**, so the console runs `script-src 'self'` -- no nonce, no `'unsafe-inline'` -- and the entire policy protecting the payout surface lives in a static `_headers` file **reviewable in a diff.** `'self'` has no bypass on an origin that serves only CI-built assets (no upload path, no dynamic route). Documented reopen trigger: the moment the console origin ever serves user-influenced content.
- **React Router 7** -- boring and ubiquitous, which for an agent-executed build is a feature. The active-seller ruling rides on it: the seller id lives in the URL (`/s/:sellerId/...`), so two stores in two tabs are two URLs and the two-tab bug of ADU-AUTH-01 S8.3 is structurally impossible.
- **TanStack Query** -- the product literally requires "re-read on every view" (order card) and "re-check on every view" (cart). That *is* Query's model; hand-rolling it with `useEffect` is the top source of beginner React bugs, so we do not.
- **Forms:** React Hook Form + the same Zod schemas -- instant client feedback, server remains the authority.
*Rejected:* Next.js (above)  -  Redux (Query owns server state; the rest is component-local)  -  runtime CSS-in-JS (runtime style injection is what our CSP posture wants less of).

### 3.10 `openapi-typescript` + `openapi-fetch`  -  3.11 `vite-plugin-pwa`  -  3.12 Pino

The console's client is **generated from the API's own published spec** -- no hand-written types, no drift; a breaking change fails the console build the same day (S11). The service worker precaches the **app shell only**; `/v1/*` is `NetworkOnly` -- never a cached authenticated response, no offline queue; a new worker **prompts**, never silently reloads under a seller mid-payout-change. Pino writes JSON logs under a **redaction allow-list** (S20.3).

### 3.13 Infrastructure set

Cloudflare **Pro** (DNS, TLS, edge cache, **the S10.1 rate-limit rule set needs more than the free plan's single rule**, Pages, R2)  -  Render Frankfurt (managed Postgres + the two services)  -  GitHub + Actions  -  Docker  -  pnpm.

### 3.14 Consolidated rejections

GraphQL  -  tRPC (ADU-API-01 S3) -- ORMs (S3.4) -- Redis / brokers / Elasticsearch (sole-datastore doctrine) -- JWT / hosted auth (the session row must be read per request for immediate revocation; a hosted provider cannot hold it and is a data processor besides) -- Next.js for the console (S3.9) -- `sharp` / server image pipeline (S8.1) -- Kubernetes / microservices / BFFs (fewest moving parts) -- Firebase/Supabase-as-backend (the rules live in *our* schemas and roles; a BaaS hides exactly that layer).

## 4. Origin, session and CSRF

> **Plain terms:** an **origin** is scheme+host (`https://console.adulis.example`); a **site** is the registrable domain (`adulis.example`). Browsers isolate origins but treat subdomains as one *site* for cookies. **CORS** is the browser's permission system for cross-origin calls; **CSRF** is a hostile page making your browser send a request that rides on your cookie.

### 4.1 The cookie

The console **holds no credential.** Signing in makes the API set `__Host-adulis_session` -- `HttpOnly` (XSS cannot read it), `Secure`, `SameSite=Strict`, host-scoped by the `__Host-` prefix. Same *site* -> the browser attaches it to the console's API calls; different *origins* -> exact CORS (`Allow-Origin: https://console.adulis.example`, `Allow-Credentials: true`) and `credentials: 'include'`. **CSRF, two independent controls:** `SameSite=Strict` and an exact `Origin` check on every state-changing request -- one is browser behaviour, the other is ours. The mobile app keeps `Authorization: Bearer` in native secure storage. Both credentials are opaque and stateful; **the session row is read on every request so revocation is immediate** -- one PK lookup, the deliberate price of the invariant.

### 4.2 Active seller context

`X-Adulis-Seller: <uuid>` -- required on every `/v1/seller/*` and `/v1/billing/*` call, derived by the client from the URL segment. Absent -> 400; present but not a seller the account holds -> **404** (a scope failure never confirms existence, ADU-AUTH-01 S19).

### 4.3 Session lifetimes -- rewritten by R17

**The finding that forced this (A1 rung 1):** with a 30-minute idle timeout and OTP as the only factor, every console return after a coffee break is one SMS. Followed exactly, the v2.0 specification spends **$648/month on sign-in messages at 1,000 sellers and $6,500 at 10,000** -- against a $50 infrastructure target -- and the 3-OTP/hour phone limit starts locking out honest sellers. The specification, not a bug, produced this; so the specification changes.

> **RULING R17 -- remembered-device sessions.** At console sign-in the seller may tick **"remember this device."**
>
> | Console session | Absolute | Idle |
> |---|---|---|
> | **Remembered device** | **7 days** | **8 hours** |
> | Any other device | 12 hours | 30 minutes |
>
> Mechanics: remembering sets a second long-lived `__Host-adulis_device` cookie -- an opaque token bound to the `(account, device)` row, revocable like any session, listed in the sessions screen as a named device. All four values live in `timing_config` (which already owns session lifetimes per market). `MOBILE` is unchanged (30 days sliding, 5 devices).
>
> **Why this is safe *in this architecture specifically*, stated honestly:** a longer session is a longer window for a stolen cookie -- and here is why the trade holds. The cookie is `HttpOnly` + `__Host-`, so theft requires device compromise, not XSS. **Every action that moves money or membership demands a fresh step-up OTP regardless of session age** -- that is the real control, untouched. New-device sign-ins still notify unsuppressibly; revocation is still immediate on the next request; and the payout activation delay plus per-order payout snapshots make even a fully compromised session largely harmless to money in flight. The 30-minute idle was defending the borrowed-laptop case; the remembered flag is precisely the seller asserting *this is not that laptop* -- and un-remembered devices keep the strict values.
>
> **Effect:** ~1.5 -> ~0.25 console OTPs/seller/day. Residual SMS is buyer signups and step-ups -- spend that tracks *transactions*, the correct shape for a cost (S21). Passkeys/WebAuthn are the recorded post-MVP path to near-zero. **ADU-AUTH-01 -> v2.1** carries this; the client shows the idle warning 5 minutes before either idle limit.

## 5. The request pipeline

Request id -> body limit (256 KB -- media never transits the API) -> CORS + Origin -> locale -> **authenticate** (cookie or bearer; one session read) -> seller context -> origin-tier rate limit (`core.rate_limit_bucket`) -> idempotency (state-changing POSTs) -> **handler** (transaction, settings, one function call) -> error mapper -> response headers. Client version is enforced at `/v1/bootstrap` only.

## 6. Data access -- where the whole system stays honest

### 6.1 Every request that touches the database declares who is asking, transaction-locally

```ts
await db.transaction().execute(async (trx) => {
  await sql`SELECT set_config('adulis.account_id', ${ctx.accountId}, true),
                   set_config('adulis.actor_role',  ${ctx.actorRole}, true),
                   set_config('adulis.seller_id',   ${ctx.sellerId},  true),
                   set_config('adulis.audience',    ${ctx.audience},  true)`.execute(trx);
  return handler(trx);
});
```

> **INVARIANT -- the third argument is `true` (transaction-local) and is the entire control.** Connections are pooled and reused. A `set_config(..., false)` persists on the connection, and the *next* request -- a different person -- inherits a courier's identity or a seller's scope, silently defeating every RLS policy in the schema. This is the single most likely catastrophic agent mistake in the codebase: named in `AGENTS.md`, covered by its own test (two interleaved identities on one pooled connection must never cross), and checked in review of any file touching the pool. A1's statement audit found this wrapper is ~47% of all database statements -- the receipt for RLS being real, charged knowingly.

> **D-27 -- there are four settings, and v3.0 listed three.** `adulis.audience` is read by a ratified function body -- `fn_mark_order_ready` passes it to `fn_has_permission` as the surface argument. **Omit it and the surface gate reads NULL**, which is not `'CONSOLE'` and not `'MOBILE'`, so a step-up permission would be refused from every surface including the right one. That fails closed, which is why it was survivable; it would still have been a day of confusion.

### 6.2 Two pools, one privilege

An `app` pool for everything; a `financial` pool -- same role, but the **only** module permitted to call the two decrypting functions. The privilege boundary is the schema grant; the second pool is an *audit* boundary: `grep` its import and you hold the complete list of code that can reach payment evidence.

### 6.3 Postgres errors translate mechanically

> **Rewritten in v3.1.** v3.0 mapped `insufficient_privilege` to **500** on sound reasoning -- PostgreSQL raising it means a grant is wrong, and that is our defect, not the caller's. **Then ADU-DB-01 began raising the same code deliberately, for a 403.** One SQLSTATE meaning both *"you may not do this"* and *"our grants are misconfigured"* means **a real privilege bug reaches a seller as a clean denial and is never investigated** -- the system looks correct while a boundary is broken.
>
> | SQLSTATE | Raised by | HTTP |
> |---|---|---|
> | **`U0001`** | `fn_has_permission`, and both boundary read functions | **403** `PERMISSION_DENIED` -- identical body whatever gate produced it |
> | **`U0002`** | `fn_has_permission` -- no relationship to the seller | **404**, the ordinary not-found envelope, no hint a permission was involved |
> | `42501` | **PostgreSQL itself** | **500.** A grant is misconfigured. **Never shown as a denial** |
>
> **Not `ADU01`, and the reason is worth keeping:** the SQL standard reserves SQLSTATE classes beginning `0`-`4` and `A`-`H` for standard conditions. `U0` is implementation-defined; `U0003`-`U0999` are reserved for this project.

Transition-guard `restrict_violation` -> 409 `ILLEGAL_TRANSITION` (both states in `slots`)  -  reservation `exclusion_violation` -> 409 `DUPLICATE_RESERVATION`  -  stock `check_violation` -> 409 `INSUFFICIENT_STOCK`  -  composite-FK scope violation -> **404**  -  append-only or privilege violations -> **500**, because those mean a defect. Multi-item failures arrive as JSON in the exception's `DETAIL` -- the function raises once with **every** failing line -- and pass to the envelope's `items[]` verbatim. **No error body ever contains rendered prose**: `message_key` + typed `slots`, formatted by the client per locale.

### 6.4 `seller_public_stats` -- R16, the build-time trap disarmed

ADU-DB-01 S8.3's word *"materialized"* invites a literal `CREATE MATERIALIZED VIEW` -- which re-aggregates **every seller's entire history** to update one seller's row: O(total) work per refresh, seconds of constant burn from ~5k sellers, untenable ~30k (A1 rung 3).

> **RULING R16 -- `core.seller_public_stats` is a plain table, one row per seller, updated in O(1) by the same triggers that already fire on `handoff_scan`, `review`, `claim` and level events.** The storefront read stays one PK lookup, exactly as cheap as intended; the write stops being a time bomb. ADU-DB-01 v1.7 rewords S8.3; **Appendix C gains check 15: `grep -c "MATERIALIZED VIEW" migrations/` = 0** -- so the agent cannot reintroduce it.

## 7. Idempotency

Every state-changing `POST` requires `Idempotency-Key`. Claim row inserted **in the same transaction** as the handler (a crash mid-handler leaves no claim; the retry is a first use); identical replay returns the stored response with `X-Adulis-Idempotent-Replay: true`; same key + different hash -> 409. **The console mints the key when the control mounts, not on click** -- a double-tap must be one key.

## 8. The two paths that carry the security argument

### 8.1 Media never transits the API

Signed URLs -> the client resizes to the three derivatives (thumbnail/card/full, WebP, canvas) -> direct `PUT` to R2 -> commit validates dimensions/bytes and `HEAD`s each object -> `core.product_image`. No `sharp`, no server pipeline, and no `original_key` -- there is no URL at which an original could even arrive. Same doctrine as video, which ADU-PRD-01 S7.4 already compresses on-device. Accepted cost: an old phone browser encodes three WebPs slowly; the console is desktop-first.

### 8.2 Evidence and payout decrypt in the API, streamed -- R15 + R18

The `SECURITY DEFINER` functions verify the caller, **write the access log in the same transaction**, and return **ciphertext + key reference** -- key material never enters Postgres (R15), so even a live database connection yields nothing readable.

> **RULING R18 -- evidence is encrypted as a sequence of ~64 KB AEAD frames** (AES-256-GCM, per-frame nonce from a counter, frame index authenticated), **decrypted and streamed frame-by-frame with constant memory.** Whole-file AES-GCM must buffer the entire object to verify its tag; at 5 MB x concurrent viewers that exhausts a starter instance (A1 rung 6). Framed, 20 concurrent viewers cost ~5 MB total. The 5 MB `EVIDENCE_TOO_LARGE` cap stands; `Cache-Control: private, no-store`; the console renders via a blob URL revoked on unmount. **Evidence is never at a predictable URL** -- `blob:` appears in the console's `img-src` and nowhere else.

## 9. Localisation

A **typed catalogue module** -- `en.ts` defines the key union; `am.ts` is `Record<MessageKey, string>`, so **a missing Amharic string is a compile error.** Machine-translated placeholders satisfy the type check (presence gate), not the human-translation gate; `AM_ENABLED` hides the switcher until the latter passes. Whole sentences with named slots, never fragments (word order differs between English and Amharic). All formatting is client-side `Intl` against the market timezone from `/bootstrap`; the wire carries `{amount_minor, currency}` and RFC 3339 UTC only. Fonts: Inter + Noto Sans Ethiopic, self-hosted, per-family `unicode-range` -- an Ethiopic-only family drops every Latin glyph, and ADU-PROJ-01 S12 makes the mixed-script render a release gate.

## 10. What the console never does

No accept-reservation action  -  never asserts a payment is genuine  -  no level setting  -  no review moderation  -  no cross-seller anything  -  no operator functions  -  no offline data  -  no bulk reissue. **If a screen seems to need one of these, the screen is wrong.**

## 11. The contract between the two developers

```
NestJS decorators + Zod  ->  openapi.json (generated in CI, committed)
                         ->  openapi-typescript  ->  typed client in the console
                         ->  Prism mock server   ->  front-end never blocked
```

(1) The spec is generated, never hand-edited -- a hand-edited spec is a lie with authority. (2) **CI diffs the spec against the previous commit and fails on any removal, rename or retype inside `/v1`** -- additive-only becomes a build failure, not a discipline. (3) The front-end develops against the mock until the real endpoint lands, then flips a base URL; where a permission exists and an endpoint does not (ADU-CON-01 S6's register), the screen is not built yet.

---

# PART B -- BUILDING IT

## 12. The repository

> **Superseded by ADU-REPO-01 v1.2.** v3.0 described **two** apps and put the public website in its own repository. There are now **five workstreams in one repository** -- the shared backend, the database, the seller console, the mobile app and the storefront -- with four dependency rules enforced by `dependency-cruiser`, three seams, and per-workstream instruction files.
>
> **ADU-REPO-01 governs the tree, the ownership and the boundaries.** What follows is retained because the *reasoning* behind the original two-app layout is not repeated there, and because S13's day-one setup still works against it.



One pnpm monorepo, `adulis-platform`. (The public website keeps its own existing repo; the token package is copied there until publishing is worth having -- noted, accepted.)

> **Plain terms:** a **monorepo** is one git repository holding several packages that version and deploy together; **pnpm workspaces** let them import each other locally with strict dependency isolation.

```text
adulis-platform/
|--- apps/
|   |--- api/                        # NestJS -- API and worker
|   |   |--- src/
|   |   |   |--- main.ts             # HTTP entrypoint (process 1)
|   |   |   |--- worker.ts           # graphile-worker entrypoint (process 2)
|   |   |   |--- common/             # the pipeline
|   |   |   |   |--- auth/  errors/  idempotency/  rate-limit/
|   |   |   |   `--- db/             # Kysely, two pools, tx-settings helper (S6.1)
|   |   |   |--- modules/            # one folder per ADU-API-01 S12 group
|   |   |   |   |--- bootstrap/ auth/ seller-onboarding/ catalogue/ stock/
|   |   |   |   |--- orders/ payment/ handoff/ payout/ team/ billing/
|   |   |   |   |--- chat/ claims/ analytics/ notifications/ reports/
|   |   |   |   `--- couriers/ fulfilment/ deletion/
|   |   |   |       # each: *.controller.ts  -  *.service.ts (one fn call)
|   |   |   |       #       *.schemas.ts (Zod)  -  *.spec.ts
|   |   |   `--- jobs/               # the job handlers (S3.7)
|   |   `--- test/                   # integration tests vs real Postgres
|   `--- console/                    # Vite React SPA
|       |--- src/
|       |   |--- main.tsx  router.tsx
|       |   |--- api/                # generated client -- DO NOT EDIT
|       |   |--- auth/               # sign-in, remember-device, idle warning
|       |   |--- layout/             # shell, nav, seller switcher (/s/:sellerId)
|       |   |--- features/           # mirrors ADU-CON-03 screen groups
|       |   |--- components/  lib/   # primitives  -  Intl, idempotency hook, blob viewer
|       |--- public/_headers         # the console CSP -- reviewable in a diff
|       `--- vite.config.ts          # incl. vite-plugin-pwa
|--- packages/
|   |--- locale/                     # en.ts (key union), am.ts (Record<MessageKey,string>)
|   |--- tokens/  config/            # design tokens  -  shared tsconfig/eslint/prettier
|--- db/
|   |--- migrations/                 # 001...015 .sql + v1.7 additions -- hand-written
|   |--- checks/                     # Appendix C as scripts (...check-15)
|   `--- seed/                       # one market, config rows, a test seller
|--- docs/                           # the ADU document set lives WITH the code
|--- ops/
|   |--- render.yaml                 # infrastructure as code
|   `--- runbooks/                   # S20.5
|--- .github/workflows/  docker-compose.yml  AGENTS.md
|--- .nvmrc  pnpm-workspace.yaml  .env.example
```

Generated files are committed but never hand-edited -- CI regenerates and fails on diff. `docs/` makes the binding documents greppable by the agent every session. `.env.example` names every variable with a fake value; the real `.env` never enters git (CI secret-scan enforces).

## 13. The development environment -- day one

```bash
fnm install 22 && fnm use 22          # matches .nvmrc
corepack enable && corepack prepare pnpm@latest --activate
git clone git@github.com:<org>/adulis-platform.git && cd adulis-platform
pnpm install
docker compose up -d                   # Postgres 17 + the four extensions
cp .env.example .env                   # fill local values
pnpm db:migrate && pnpm db:check       # must print 15 passes
pnpm db:seed
pnpm dev                               # api :3000  -  worker  -  console :5173
pnpm test
```

**Definition of a working setup:** `db:check` prints fifteen passes and the console signs in the seeded seller (the local SMS adapter prints OTPs to the terminal). If either fails, fixing that *is* the day's work.

## 14. How we work

**14.1 Git.** Trunk-based; short-lived branches; squash-merge into protected `main` (CI must pass, one approval, no direct pushes). **The other founder approves** -- the review checklist is designed so CI does the deep checking and the human checks *conformance to the documents*, which either founder can judge. Small PRs: one endpoint group, one screen, one migration.

**14.2 The document -> agent -> verify loop.** (1) Naod prepares the work order -- the ADU sections, the endpoints/screens in scope, the gate that verifies it: the agent receives documents, not vibes. (2) The agent builds within the slice and stops at its boundary. (3) Verification is a command: `pnpm db:check`, the tier gate, `pnpm ci:local`. (4) Human review against the checklist, PR, merge. (5) Output<->document disagreement -> amend the document first, through the amendment-file workflow.

**14.3 `AGENTS.md`** -- loaded every session, maintained like code: the reading order and that documents beat training instincts  -  **the eleven load-bearing absences** (no `original_key`, no `generated_text`, no `has_chatbot`, no feed score, no accept-reservation, no bulk reissue, no operator impersonation, no identity image, no text column on public stats, no `nlu`->`core`/`chat` FK, no seller-writable column on `review`) -- *completing* the schema by adding one is the defined failure  -  `set_config(..., true)` always  -  **`MATERIALIZED VIEW` is a forbidden phrase (R16)**  -  no new tables/columns/enums/endpoints without a document amendment; **table count 107**  -  every state-changing endpoint calls its named function; services hold no business rules  -  no string-built SQL outside the `sql` tag  -  no secrets in code  -  no edits to generated files  -  stop at the slice boundary and list what was *not* done.

**14.4 The printed review checklist.** [ ] only slice files touched [ ] counts unchanged unless the work order changed them [ ] `pnpm db:check` (15) passes [ ] every new POST has idempotency + Zod + both locale entries [ ] all DB access via the tx-settings helper [ ] nothing from the redaction list logged [ ] negative-case tests exist, not just happy path [ ] OpenAPI diff additive.

**14.5 Definition of done, per PR:** code + tests + both locale entries + spec regenerated + gate green + reviewed. Not five of six.

## 15. The build sequence -- nine tiers, gated

> **Where it actually stands, as of v3.1.** Tiers 0 to 8 are **complete and merged**: the schema at 25 migrations, the request pipeline, 124 contract path keys, and Phase D's security review with its six measured load tests. Tier 9 is partially done -- the review ran, the hardening findings are recorded in `SECURITY-REVIEW.md`, and ADU-CON-05 itself is still unwritten.
>
> **And the tier table was missing a tier.** Nothing in v3.0 covered **the worker**, so every endpoint enqueued jobs that nothing ran -- reservations that never expired, notifications that never sent, S12.4a's claim that never fired. It was built as T4 and belongs in this table as **Tier 2b**, between the schema and the pipeline, because the jobs are where the schema's clock lives.

| Tier | Contents | State |
|---|---|---|
| 0-2 | Repository, migrations 01-25 | **Complete** |
| **2b** | **The worker: graphile-worker in `jobs`, twenty S24 jobs, the heartbeat** | **Complete (T4)** |
| 3 | The request pipeline | **Complete** |
| 4-8 | Endpoints, 124 path keys | **Complete** |
| 9 | Hardening -- ADU-CON-05 | Review run; document unwritten |

**The nine-tier table below is retained as the specification of each gate.**



| Tier | Owner | Contents | Gate (a command, not an opinion) |
|---|---|---|---|
| **0** | Both | Repo, toolchain, CI skeleton, compose, health check | CI green; compose yields Postgres with the four extensions |
| **1** | Naod | Migrations 1-5: roles, schemas, 54 enums, config, accounts, sessions, `verification`, sellers, **permissions seeded** | Appendix C 1, 4, 10, 11, 12; every S15 permission exists |
| **2** | Naod | Migrations 6-15 + v1.7: `operator_grant`, `seller_fulfilment_method`, `order.ready_at`, derived-role functions, **R16 stats table**, ratified transition set, **per-table autovacuum tuning for `rate_limit_bucket`, `idempotency_record` and the `jobs` schema** (high-churn tables get aggressive `autovacuum_vacuum_scale_factor`) | Appendix C 5, 7, 8, 9, 13, **15**; **check 14 = 107**; zero unratified rows |
| **3** | Naod | The pipeline: both credentials, **remember-device (R17)**, session read, permissions, tx settings, error mapper, idempotency, rate limits, locale, `/bootstrap`, OpenAPI publish | Role matrix reproduced **incl. every negative case**; 8 step-up permissions reject `MOBILE`; scope failure = 404; **pooled-connection settings-leak test passes** |
| **4** | Naod -> Abenezer follows per group | Onboarding: seller, profile, company, social, identity, availability, fulfilment, readiness | Nine readiness items; each blocker independently reproducible; `seller_publication_blocked` emitted |
| **5** | " | Catalogue, media commit, stock, confidence | Stock never moves without an event; concurrent decrement never negative; limit = tier  intersect  level |
| **6** | " | Orders, payment confirm/reject, **evidence viewer with R18 framing**, per-line cancel, refunds, mark ready, couriers on orders, QR | Evidence reads logged with **derived** role; **memory flat at 100 concurrent evidence streams**; clock stops at `PAYMENT_CONFIRMED`; billing suspension leaves orders operable |
| **7** | " | Payout (change/cancel/history), team, ownership transfer, sessions, subscription, closure, deletion | Full payout battery: step-up, delay, previous-details-during-PENDING, both cooling locks, unsuppressible notification |
| **8** | " | Analytics (+ **R19 retirement job**), notifications + prefs, reports, seller reviews/claims, courier mgmt, `/v1/events` | Every S15.1 permission has an endpoint or a recorded deferral; a detached partition round-trips: export -> drop -> query the Parquet |
| **9** | Both | Hardening -- ADU-CON-05, seeded by A1 S6's six load tests | -- |

Tiers 1-2 are read line-by-line by hand (migrations 7 and 9 especially -- everywhere else a mistake raises; there it produces wrong data). The front-end trails the back-end by one group within each tier, on the mock. **Tier 3 before tier 4 is not negotiable.**

## 16. CI -- every push

Install -> strict typecheck -> lint -> unit tests -> **integration tests against a real Postgres service container** (constraints, triggers, RLS and `EXCLUDE` cannot be mocked) -> migrations applied twice to empty DBs, schema dumps diffed (determinism) -> **Appendix C, all 15** -> locale completeness -> OpenAPI regenerate + additive diff -> console build -> `'unsafe-eval'` absent from output -> secret scan. Red on any; there is no skip label.

---

# PART C -- RUNNING IT

## 17. Capacity posture -- certified to 10,000 sellers

**Six of these are now measured rather than modelled.** ADU-CON-02-A1 S6 named six load tests as the thing that would replace its assumptions; T4 Phase D ran all six, and this is what they returned.

| A1's test | Measured | Verdict |
|---|---|---|
| 1. Hot variant, concurrent orders | **Exactly 300 of 350 succeed on stock 300. Zero negative counts** | `CHECK (stock_count >= 0)` doing what it was chosen for -- fifty buyers get a clean transaction failure, nobody is oversold |
| 2. Expiry sweep, 1M orders / 10k live | **2.8 ms** on the partial index | The index sizing holds. This was modelled as a risk and is not one |
| 3. Stats trigger, 100 scans/sec | **Flat at ~0.35 ms/scan** | R16's O(1) proven. The materialized view would have been O(entire history) here |
| 4. 08:00 dispatch, 10k queued | **Drained in 99 ms** | The model said 0.7 minutes. It is two orders of magnitude better |
| 5. Evidence streaming, 100 x 2 MB | **+24.8 MB RSS** | R18's framing proven. Whole-object AEAD would have been ~200 MB and A1's rung-6 failure would have been real |
| 6. Pooled-connection identity leak | **Zero crossings under interleaved load** | The one every RLS policy in the schema rests on |

> **Measurements beat the model, and by a lot.** That is worth naming rather than celebrating: **a model that is wrong in the safe direction is still wrong**, and the next one should be trusted less, not more. A1 said so about itself -- *"the model is only as good as its next correction."*

The certification below, per component, at 10,000 active sellers. Rows carrying a measured number are marked; the rest remain A1's estimates at +/-40%:

| Component | At 10k sellers | Of capacity | Trigger to act, and the action |
|---|---|---|---|
| Origin traffic | ~193 RPS peak | -- | -- |
| **PostgreSQL (PG small)** | ~1.2k stmt/s | **~41%** | >=70% sustained 15 min -> **upgrade plan** (a dashboard action; S20.2 alarms) |
| **API** | ~64% of one instance | **run 2 instances** | Two from day one: zero-downtime deploys + burst headroom. >=70% avg CPU -> add one |
| DB connections | ~30 direct | 30% of 100 | >=70 -> PgBouncer transaction mode -- S6.1 was written compatible with it on purpose |
| 08:00 dispatch | **99 ms MEASURED** (modelled 0.7 min) | -- | >10 min -> parallelise dispatchers |
| Evidence memory | **+24.8 MB at 100 x 2 MB streams MEASURED** | negligible | -- (was the rung-6 failure; measured flat) |
| Analytics storage | ~0.9-1.2 GB/day; **<= ~110 GB live** at the 90-day window (R19) | within plan | Window is a config value; exports are Parquet on R2, queryable offline |
| SMS | ~5.5k/day (R17) | -- | S21 -- now a priced cost of revenue, not an infra leak |
| Flash drop, one variant | ~125 orders/s ceiling | bounded | Buyers briefly queue; **nobody is ever oversold** -- the constraint doing its job |

**Beyond 10k**, the ladder is known and each rung is a knob, not a rewrite, until ~200-300k: PG medium at ~17-25k -> analytics onto its own Postgres (`analytics` has no FKs into it *by design* -- the pre-built relief valve) -> PgBouncer at ~140k -> PG large -> the single-primary ceiling at ~200-300k, which is the honest end of this architecture and sits beyond every gate in ADU-PROJ-01 S11. **Console polling (~26% of origin traffic) is the first post-launch optimisation** -- one SSE endpoint deletes a quarter of the load; recorded, not built.

## 18. Hosting -- decided (carried from v2.0)

> **RULING -- managed hosting on Render, Frankfurt: one managed PostgreSQL 17 (PITR), `api` x2 + `worker` from one image. Cloudflare Pro in front of everything.**

**Why managed:** self-managed Postgres wins on latency and cost and loses on the one resource we cannot buy -- operator attention. A botched backup is the one mistake this business cannot survive, because the database *is* the trust record. **Why Render:** services map 1:1 to our processes; `render.yaml` keeps infrastructure in the repo; git-push deploys; private networking; Frankfurt is ~130-170 ms from Addis and a sensible centre for a global launch. **Fallbacks in order if verification fails:** DigitalOcean Managed Postgres (Frankfurt), then AWS RDS -- `DATABASE_URL` means the application never knows.

**Mandatory verification before any commitment** (requirement 5 is on no feature page): on a trial instance -- (1) the four `CREATE EXTENSION`s succeed; (2) migrations 1, 4 and 10 run -- six roles, both isolated schemas owned by their roles, `REVOKE` holds, `SECURITY DEFINER` callable, RLS enforces; (3) `pnpm db:check` = 15 passes; (4) a manual backup restores to a second instance where check 14 = 107. Any failure disqualifies that provider *that day*.

**Topology (`ops/render.yaml`):** `adulis-db` (Postgres 17, PITR, private-network only)  -  `adulis-api` x2 (`node dist/main.js`, `/healthz`)  -  `adulis-worker` (`node dist/worker.js`)  -  pre-deploy job `pnpm db:migrate`. DNS: `api.adulis.example` -> Cloudflare (proxied) -> Render; `console.adulis.example` -> Cloudflare Pages.

**Standing decisions:** push = FCM + APNs  -  keys = versioned environment secrets (`..._V1`; rotation = add `_V2`, run the re-encrypt job -- `encryption_key_ref` was built for this; KMS when a provider offers one)  -  SMS = Ethiopian aggregator primary (AfroMessage / GeezSMS -- **selected by measured delivery rate in Phase 0**) + Twilio Verify secondary with voice fallback; failover on non-delivery within the configured window; the user sees one countdown, never two providers.

## 19. Environments, configuration, deploying

| | `local` | `staging` | `production` |
|---|---|---|---|
| Database | Docker | Render small | Render PITR |
| SMS | Terminal adapter | Terminal (real send only for delivery tests) | Real adapters |
| Deploy | `pnpm dev` | **Auto on merge to `main`** | **Manual promote** |
| Data | Seed | Seed + test cohort | Real -- **never copied down**; a production dump on a laptop is a data-protection incident |

**Configuration is ~13 environment variables** (`DATABASE_URL`, `DATABASE_URL_MIGRATE`, three key secrets, `R2_*` x4, `SMS_PRIMARY_*`/`SMS_SECONDARY_*`, `CONSOLE_ORIGIN`). Anything per-market is a configuration **row**, never an env var.

**A normal deploy:** merge -> CI (S16) -> staging auto-deploys (migrations, api, worker, Pages) -> click through affected flows -> **manual promote** -> watch `/healthz`, logs and the counters for ten minutes. Two-person rule: the merger is not the promoter.

**Migration discipline -- the part that prevents self-inflicted outages:** migrations run **before** new code serves, so **every migration must be compatible with the code currently running** -- expand -> migrate -> contract; destructive statements need a PR titled `DESTRUCTIVE:` and both approvals; a migration is never edited after it has run anywhere -- write a new one. **Rollback:** code = redeploy previous image (runbook, two clicks); schema = **roll forward** with a correcting migration; corrupted data = PITR restore -- which is why the drill exists.

## 20. Maintenance -- the standing rhythm

**20.1 Backups and the drill.** PITR from day one. **A backup that has never been restored is a hope.** Monthly, 30 minutes, alternating founders: restore production to a fresh instance at a point in time -> `db:check` (15) -> three known-answer queries (order count, a seller's stock, the ledger zero-balance view) -> destroy -> log it. The first production restore must never be the first restore ever performed.

**20.2 Monitoring -- minimal, actually watched.** Uptime pings on `/healthz` (checks DB) and the console -> both phones. A worker heartbeat row every 5 minutes.

> **D-51 -- `/healthz` returns 200 with `status: degraded` when the heartbeat is stale. It must never return 503 for this.** v3.0 said the endpoint *"reddens"*, and S18 puts `/healthz` behind the platform's health check, **which removes an instance that fails it.** A stopped worker would therefore have removed the **API** from service -- turning a background-job failure into a total outage, and doing it automatically.
>
> **The alert fires on the body, not the status code.** `/healthz` answers *should this instance receive traffic* -- 503 only when it genuinely should not, which means the database is unreachable. **A dead worker is a thing to be told about, not a thing to act on by removing the only healthy API.**

A dead worker is discovered by us, not by 48-hour-old unexpired orders. **Capacity alarms (new in v3.0):** DB CPU >=70% for 15 min  -  DB storage >=70%  -  direct connections >=70  -  API p95 > 500 ms -- each pages with its S17 action attached, so the alarm carries its own instruction.

**20.3 The counters, weekly** -- each watches an invariant that could silently stop holding: evidence-reads : confirmations ratio (fewer reads than confirmations is *expected*; ~1.0 means sellers distrust their bank app; ~0 for one seller is a different signal)  -  idempotent-replay rate  -  `ILLEGAL_TRANSITION` by state pair  -  **session reads per request = exactly 1** (above 1 means someone cached a session and immediate revocation is gone)  -  **and new: SMS sent per active seller per day** -- the R17 dividend, watched so it cannot quietly regress.

**20.4 Updates.** Renovate monthly batches, security advisories immediately; everything pinned exact. Majors of anything in S3: one at a time, own PR, release notes read, both approve. Postgres minors in the maintenance window, staging first; majors annually at most, restore-tested first. `AGENTS.md` and this document update in the same PR as any decision that changes them.

**20.5 The weekly half-hour (alternating):** [ ] uptime + heartbeat green [ ] capacity alarms' dashboards [ ] the five counters [ ] error-level log scan [ ] Renovate batch [ ] drill due? [ ] anything odd -> an issue, not a memory.

**20.6 When something breaks.** One-page runbooks, written before the incident: `deploy`  -  `rollback`  -  `restore-drill`  -  `incident`  -  `sms-failover`  -  `key-rotation`  -  **`db-upgrade` (new -- the S17 trigger's action)**. Severity: **SEV-1** money/trust wrong (payments, payout, evidence, ladder) -- both founders now, deploys frozen; **SEV-2** feature down -- same day; **SEV-3** cosmetic -- issue. Every SEV-1/2 gets a five-line post-mortem: what, impact, cause, fix, prevention. No blame; the process gets fixed, not the person.

## 21. What it costs -- split honestly in v3.0, extended in v3.1

**Two lines added, and one constraint that is not a cost.**

| Line | Note |
|---|---|
| **Cloudflare Pro** | ~$25/month. The S10.1 rate-limit rule set needs more than the free plan's single rule |
| **GitHub Team** | **$4/user/month, deferred.** Not optional forever -- see below |

> **[!] Branch protection is not enforceable on the current plan, and this is an operational fact rather than a cost.** GitHub enforces branch protection and rulesets on **private** repositories only from **Team** upward; on a free organisation the rules can be created and **do not apply**. The repository is private under ADU-LEG-01 pending the trademark filings, so making it public is not available.
>
> **The consequence is precise: sixteen CI gates exist and nothing obliges anyone to respect any of them.** A red pull request can be merged. A direct push to `main` succeeds. **This is the rule that ADU-REPO-01 S4 rejects -- one that depends on someone noticing** -- and it sits at the outermost layer, guarding everything the inner ones enforce.
>
> **Interim:** a client-side `pre-push` hook refusing `main`, which stops the slip and not the decision. **Upgrade when the licence lands**, and treat the gap as a known exposure until then rather than as a solved problem.



**Infrastructure (the ADU-PROJ-01 S10 target line):**

| Line | At beta (~100 sellers) | At 10,000 sellers |
|---|---|---|
| Render Postgres (PITR) | ~$20-35 | ~$50-95 (storage for the 90-day analytics window) |
| Render api x2 + worker | ~$21-40 | ~$40-80 |
| Cloudflare **Pro** + R2 | ~$25-30 | ~$30-40 |
| **Infrastructure total** | **~$65-105** | **~$120-215** |

The beta figure exceeds the $50 target by the price of PITR, a second API instance and the Pro rate-limit rules -- recorded as accepted: each buys a failure mode.

**Cost of revenue (scales with users; not infrastructure):** SMS at ~$0.012 x ~0.55/seller/day ~ **$0.20/seller/month** -- ~$20/mo at beta, **~$2,000/mo at 10k sellers**, of which most is buyer signups and step-up OTPs: spend that maps one-to-one onto a new buyer or a protected money action, which is the correct shape for a cost and prices into ARPU at ~1.5-2.5%. Without R17 this line would read **$6,500** and be shaped like a leak.

## 22. Open items

> **[!] O-1 has not moved, and it has become more urgent rather than less.** The four-step provider probe of S18.2 has still run **only against local Docker**. Requirement 5 -- six roles and cross-schema `SECURITY DEFINER` -- appears on no provider's feature page and is the one that disqualifies.
>
> **SR-1 and D-50 are the reason it matters more now.** Both were grant defects that nothing detected for four work orders, and the fix for both is a privilege model that a managed provider may or may not permit. **If Render cannot create six roles and reassign function ownership, S4.4a's definer discipline has no implementation** -- and it would land on top of 25 migrations, 124 endpoints and a worker rather than on an empty repository. **One hour, and it can only get more expensive.**



| # | Item | Blocks | Note |
|---|---|---|---|
| O-1 | Provider verification (S18) | Provisioning | The four-step test; day one of Tier 0 |
| O-4 | Error tracking | Tier 9 | Behind the DPIA; logs suffice |
| O-5b | SMS primary **selection** | Launch | Structure decided; vendor chosen by measured Phase-0 delivery rate |
| O-6 | Delivery fee | Deferred deliberately | `seller_fulfilment_method` carries no fee column; either PRD ruling is a migration |
| O-7 | GDPR posture if global | Launch decision | Legal review; zero engineering delta |
| O-8 | SSE for console inbox | Post-launch | Deletes ~26% of origin load when measurement justifies it |

## 23. Documents to reissue

ADU-DB-01 -> **v1.7**: everything previously listed **plus** R16's S8.3 rewording + Appendix C check 15, R18's framing note on `financial.payment_evidence`, R19's retirement job and window value, autovacuum settings for the churn tables  -  ADU-AUTH-01 -> **v2.1**: R17 (S8.1 lifetimes table, the device-remember mechanic, the passkey roadmap note)  -  ADU-API-01 -> **v1.4**: unchanged list  -  ADU-SEC-01 -> **v1.1**: unchanged list; S4 notes the second `__Host-adulis_device` cookie  -  ADU-PRD-01 -> v8.6  -  ADU-PROJ-01 -> **v9.1**: hosting ruling; **S10's cost table replaced by S21's split**  -  ADU-DPIA-01 -> v1.1: processors (Render, SMS pair), R15/R18 boundary, remembered-device retention line  -  ADU-CON-02-A1 stands as the test record.

---

*Binding architecture record and standing operating manual, v3.1 -- corrected against what building it revealed. Six of A1's modelled numbers are now measured, and every one beat the model; that is worth less confidence, not more, because a model wrong in the safe direction is still wrong. Two defects: a request wrapper that set three settings where a ratified function reads four, and a health endpoint whose specified behaviour would have removed the API from service whenever a background worker stopped. And one thing that is not a defect but is an exposure -- sixteen CI gates that nothing currently obliges anyone to respect, because branch protection does not apply to a private repository on this plan. From v3.0: The system is one API, four clients, two processes and one PostgreSQL that enforces its own rules -- the property that makes a two-beginner, agent-executed build safe. v3.0's four corrections buy the first 10,000 sellers: sessions that stop spending the budget on sign-in messages, a stats table that cannot become a time bomb, evidence that streams in constant memory, and analytics that retire to cheap storage -- with every threshold beyond 10k paired to an alarm and a runbook, so growth is met by a knob and not a surprise. Supersedes v2.0. ADU-CON-03, the content architecture, is next.*
