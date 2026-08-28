# WORK ORDER T4 REPORT

**State of main: clean.** `00e2da3` at the start; T4 branches from it and merges back green.

```
Phase E  worker + 20 jobs   groups complete: E1 E2 E3 E4 E5 E6   idempotency proven: 20/20
         heartbeat: yes     injectable clock: yes
Phase F  operator runbook yes   adapter fakes fail-closed in production yes (6/6, + 1 that must not)
Phase G  RULINGS-NEEDED.md: 11 needing a founder ruling, 4 load-bearing workarounds
Gates    db:check 16/0/0   tests 355   determinism yes   ci:local exit 0
Register 10 new entries (D-47..D-56) -- 1 BLOCKER, 2 MAJOR
```

## BLOCKERS

**D-47 — `adulis_jobs` had no `USAGE` on schema `core`.** Not the wrong table grants: no
access to the schema at all. Every one of S24's twenty jobs would have failed on its first
statement with `42501`, including the one migration 0025 had just granted `EXECUTE` on.
The 48-hour reservation window would have stayed a promise nothing keeps, and the first
symptom would have been a seller noticing. **Fixed in 0026, proven as the role rather than
inferred** — the probe that found it ran before a line of the worker was written.

No blocker remains open.

---

## The two rulings, as built

**S1.1 — the confirmation window.** Both branches live in one job. The **24h seller
silence** is S12.4a exactly: no cancellation, stock **held**, `SYSTEM` claim opened
(trigger `SLA_BREACH`, already ruled at W7), evidence pinned against the purge by the
claim's own attach trigger, missed window counted. The **12h buyer silence** after a first
rejection is ordinary expiry: cancel, release, no claim.

The two branches share **one** `expireOrder` routine, which is a compare-and-set on order
state — so the fact that `order.expire_sweep` sees the same row (the 12h window was
written as `expires_at` by `fn_reject_payment`) is safe *by construction* rather than by
two implementations agreeing. Either job alone still honours the window. Registered as
D-55 for S24's row.

**S1.2 — the grants.** Every function a job calls is granted to `adulis_jobs` by name,
one justification per line, in migration 0026. The evidence purge needed a boundary
function rather than a grant, and got one (D-48): the job holds **no table privilege in
`financial` at all**, so it cannot name `payout_credential` even by accident.

---

## Phase E — the worker and twenty jobs

graphile-worker in the `jobs` schema, concurrency 10, connecting as **`adulis_jobs`** — a
different role from the API's `adulis_app`, which is the whole point of two processes.
Twenty jobs from ADU-DB-01 S24 plus the heartbeat ADU-CON-02 S20.2 requires and S24 does
not list. A registry test asserts the set against S24's own table: exactly twenty, named
exactly as the document names them.

| Group | Jobs | Notes |
|---|---|---|
| E1 the clock | expire_sweep · close_confirmation_window · cooldown.decay | Both sides of every boundary asserted |
| E2 notification | send · push_seller · morning_reminder | Order state re-read at send; 08:00 per market |
| E3 trust and stock | level.recompute · confidence_nudge · social_post.availability_check | Outage ≠ deleted post |
| E4 retention | evidence purge · media.lifecycle · waitlist · device.purge_unbound | Object before row, always |
| E5 transport and ledger | idempotency · rate_limit · assert_zero · create_partition | assert_zero throws |
| E6 billing and NLU | subscription.warn · collect_reminder · harvest_unmatched | One warning per milestone |

**The five traps, each proven rather than asserted:**

1. **Idempotency — 20/20.** Every job runs twice in its test and the second run changes
   nothing. Each is guarded by a compare-and-set on a state column *or* a partial unique
   index on its effect; expiry has both, because A3.2 warns that a blanket
   `ON CONFLICT DO NOTHING` there would silently not return stock on a multi-line order.
2. **The purge is scoped by name.** The test asserts a **payout credential survives a
   purge run** — and the job could not reach one if it tried, holding no privilege in
   that schema.
3. **08:00 is the market's.** The test asserts the reminder does **not** fire at 08:00 UTC
   and **does** at 05:00 UTC, which is 08:00 in Addis. A UTC implementation would send
   Ethiopia's morning reminder at 11:00 local and nothing would ever look wrong.
4. **The sender re-reads order state.** A notification queued for an order whose clock
   later stopped stays `QUEUED` and is never sent.
5. **The clock is injectable.** 23h59m and 24h01m are two lines apart. No test sleeps.

**No job holds a transaction open across an external call.** The evidence purge deletes
the object, then the row; the SMS and push sends happen after the claim has committed.

**`/healthz` now reports the worker** — and a stale heartbeat reddens the **body**, not
the status code (D-51). S18 makes a 503 there the signal that removes an instance from
traffic; a dead worker must not turn "orders stop expiring" into "the storefront is down".

---

## Findings, ranked by silence

**D-50 (MAJOR) — a `SECURITY DEFINER` owned by the superuser.** `fn_stats_on_reservation`
never got the `OWNER TO adulis_migrate` line every sibling has, so it ran with
`rolsuper` + `rolbypassrls` for four work orders. Nothing exploited it; it returns
`trigger`, so it cannot be called directly. It worked perfectly, forever — which is why
nobody saw it. Re-owned; the database now has **zero** superuser-owned definers.

**D-53 (MAJOR) — identity attestation is written from client-supplied data.** There is no
KYC adapter because there is no KYC vendor, so `POST /v1/seller/identity-verification`
trusts the verifier, reference, legal name and ID hash in the request body. A seller can
assert their own verification. Recorded, not worked around: building a vendor is out of
scope and inventing a verification protocol would be worse than naming the gap. **It is
the first item in RULINGS-NEEDED.**

**D-52 — the worker booted and could not work.** graphile-worker puts RLS on its own
tables; with the DDL role owning them, the process started, logged healthy, and failed on
its first task. The runtime test now **enqueues a real job and waits for its effect** —
the earlier version passed while nothing could run.

**D-49 — `analytics.create_partition` was unimplementable.** S24 names the job and
migration 16's comment names the function; the partitioned parent is owned by the
bootstrap role, so no definer could attach to it. Every analytics event since Tier 2 has
landed in the DEFAULT partition.

**The recurring class, third and fourth instances.** `fn_derive_order_state` and
`fn_cart_last_line` are **invoker** triggers that write tables the job's own statement
never mentions. A column-scoped grant passes every statement test and fails the first time
a real row moves. Only running the job **as `adulis_jobs`** finds these, which is why the
test harness refuses to run on an admin connection.

---

## Phase F

**The operator grant** is [`ops/runbooks/grant-founder-operator.md`](../../ops/runbooks/grant-founder-operator.md).
It could never have been a migration: no founder account id exists until someone signs up
through the ordinary phone-OTP path, and a grant is a decision about a person recorded in
an append-only table. The runbook names the narrowest role for each job and says plainly
why `ADMIN` is not the default.

**The adapters.** All six fakes now log loudly at construction and **throw under
`NODE_ENV=production`**, with a test per adapter proving both. The seventh —
`NullInferenceAdapter` — deliberately does **not**: "the bot never goes dark" means an
unbound layer-4 classifier is the *specified* degradation (layers 0-2 answer, everything
above escalates), and refusing to start over it would take the whole API down to disable
one cascade layer. A fake pretends to be a vendor; the Null adapter truthfully answers "I
matched nothing".

Vendor status, unchanged by this work order: **push** = FCM/APNs decided, credentials not.
**Storage** = R2 decided, credentials not. **SMS**, **KYC**, **classifier** = no vendor.

---

## Phase G

[`RULINGS-NEEDED.md`](RULINGS-NEEDED.md) triages all 56 register entries and SR-1..SR-11
into four groups: **11 need a founder ruling**, 24 need a document amendment (the build is
already right), 5 need code that is already ruled, 16 are resolved.

**Four are load-bearing** — something depends on a temporary decision today: the KYC gap
(G1.1), the empty ladder config (G1.2 — the nightly recompute now runs against it and
fails closed, so nobody is ever promoted), the buyer money gate on deletion (G1.3), and
the scan signature scheme (G1.4). Each carries one line on what happens if it is answered
wrong, which is the information that makes a ruling take five minutes.

---

## NOT done

- **The operator surface (ADU-OPS-01).** Out of scope, and the consequence is now
  explicit: every operator queue fills and nothing in-product drains it. Claim review,
  moderation and identity review are founder work against the database by hand.
- **Real vendor adapters.** Out of scope by S5. The interfaces are confirmed stable and
  the fakes cannot reach production.
- **`analytics.retire_partitions` (R19).** Explicitly tier 8.
- **The two PARKED endpoints** — ownership transfer (D-24) and analytics export (D-42) —
  both blocked on rulings, not on effort.
- **The ADU-CON-02 S20.6 runbooks** — `deploy`, `rollback`, `restore-drill`, `incident`,
  `sms-failover`, `key-rotation`, `db-upgrade`. Each needs a deployment that exists. The
  `deploy` one must include `pnpm worker:install` (D-52).
- **Back-filling register D-25 and D-28** (D-56): two numbers cited from code with no
  entries behind them.
