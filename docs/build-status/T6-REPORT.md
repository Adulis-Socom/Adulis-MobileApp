# WORK ORDER T6 REPORT

```
WORK ORDER T6 + T6-B REPORT
Phases: A merged (#18) - B open (#19, CI green) - C+D open (this branch)
Migrations: 0028-0034   new tables: 4 (seller_courier_invite, purchase_intent,
                                       seller_ownership_transfer, + no others)
Rulings closed: G1.2 G1.3 G1.6 G1.7 G1.8 G1.9 G1.10 G1.11   parked: none
Amendment A1: A1.1 asserted - A1.2 built - A1.3 built at Phase A - A1.4 not a schema change
Register: D-57..D-83 added; 81 entries total
Gates: 18/18 via ops/scripts/gates.mjs   tests 413/413 in 31 suites, 12 runs clean
db:check 16/0/0 (114 tables)   db:determinism converges (11219 lines)
permission matrix 252/252   docs ASCII   contract regenerated and committed
ci:local == CI: ONE list, proven by planting a CI-only failure
NOT done: the S5 out-of-scope list, ops/render.yaml (D-80), the message anchor (D-73)
```

> **The §6 template was not recoverable in this session.** T6-B's verbatim text was
> compacted out of the transcript before this report was written, so this follows
> T5-REPORT.md's shape instead. If the intended template differs, the contents below map
> onto it directly.

**Three PRs, one per phase, none merged by me.** Phase A is merged. Phase B is open with
CI green. Phase C and D share this one, as T6 §5 permits.

---

## What the four phases built

| Phase | Ruling | Where it lives |
|---|---|---|
| **A** | G1.2 ladder, G1.8 invite table, G1.9 slug, G1.10 anchor, G1.11 device market | `0028`–`0032` |
| **B** | G1.3 closure, G1.7 subscription lifecycle, G1.6 ownership transfer, and A's surfaces | `0033`, `0034`, four modules |
| **C** | D-27, D-30, D-33, D-34, D-51 — a test each, "even where no code changes" | `t6-parked-decisions.spec.ts` |
| **D** | `ci:local` ≡ CI, and the deploy runbook | `ops/scripts/gates.mjs`, `ops/runbooks/deploy.md` |

---

## The findings, ranked by how quietly they would have shipped

### 1. `GET /healthz` answered 401 in the assembled application (D-79)

**No deploy would ever have gone live.** The `AuthGuard` is `APP_GUARD`-global and
`HealthController.healthz` carried no `@Public()`. ADU-CON-02 S18 makes `/healthz` the
route Render polls, with no `Authorization` header, to decide whether an instance may
take traffic.

It survived because **both** its tests build a standalone module — `DatabaseModule` plus
the controller — where no global guard exists. So the entire T4 heartbeat feature, and
D-51's careful 200-versus-503 decision, were being tested against a route that could not
be reached. Found only because T6 §4 said to write a test for each recorded decision, and
the natural place for D-51's was a suite built from the real `AppModule`.

The generalisable form, worth a review checklist line: **a controller tested only in a
standalone module is a controller whose global guards, filters and interceptors are
untested.** `/healthz` was the only route in the repository with no e2e coverage through
`AppModule`, and it was the only one that was wrong.

### 2. A lazy activation inside the handler's transaction is undone by the request it activates on (D-74)

G1.6's activation runs at the top of every seller-scoped transaction, which is what makes
A1.1's requirement true: the outgoing owner's *next request* activates the transfer and is
then judged by what the activation did — `fn_has_permission` finds no relationship, raises
`U0002`, the endpoint 404s. Correct.

**And the raise rolls the transaction back, taking the activation with it.** The
observable behaviour is exactly right and the store never moves: `owner_account_id` stays
where it was, the memberships never change, both unsuppressible notices are never queued,
and every subsequent request by that owner repeats the cycle. The one case A1.1 names is
precisely the case that cannot commit.

Found by A1.1's own test on its first run — which is why A1.1 asks for that assertion in
those words. Fixed by attempting the activation in the handler's transaction while it
succeeds (free) and once more in a transaction of its own when it did not, swallowing that
attempt's own errors so it can never mask the handler's.

Note for review: `core.fn_activate_due_payout` (0022) has the same exposure on any request
that fails after it, and separately activates only when somebody reads.

### 3. The payout contradiction inside G1.6 itself, which A1.2 resolves

S12.12 promised the outgoing owner an `ADMIN` membership **and** that "payout access ends
at activation". Under the shipped 139-grant matrix those are incompatible: `ADMIN` holds
`seller.payout:read` and `seller.payout:update` (`OWNER` minus `ADMIN` is exactly
`seller.account:delete` and `seller.ownership:transfer`), and the permission model is
role-based with no per-member grant column — so there is no `ADMIN`-minus-payout to hand
out. A1.2 removes the promise rather than the permission, and the build follows A1.2: the
outgoing owner keeps **nothing** by default and may nominate any role except `ADMIN`,
created **at activation**, in the same transaction.

### 4. The billing grant trap, which fails on the first real call and not at migration time

`adulis_migrate` owns every `SECURITY DEFINER` function in `billing` and held **nothing**
on `billing.collection_record`. The doctrine-correct move — write the reconciliation as a
definer function — produces a function that `CREATE`s fine, migrates fine, passes every
static check, and raises `42501 permission denied for table collection_record` the first
time an operator reconciles a real bank transfer. Migration 0033 grants what the definer
needs, and the tests call every one of the four new functions, so the closure is
demonstrated rather than asserted.

### 5. Five intermittent failures, all one shape (D-83)

A converged gate list is worth nothing if it goes red at random — that is the same
failure as a gate people skip, arrived at from the other side. So the suite was run
**twelve times with every run's output kept**, rather than once.

Five distinct flakes surfaced, none about the behaviour under test, all the same shape:
**a test asserting a global count, or driving a fleet-wide sweep, against a database
shared with every other suite in the run.** `device.purge_unbound` was exercised by two
suites; so was `subscription.collect_reminder`. `analytics.create_partition` ran at a
fixed 2026-06-01 clock whose "next two months" had drifted into the real current month,
so any analytics event another suite wrote sat in `event_default` and blocked the CREATE —
and its `DROP TABLE` cleanup would have taken that suite's rows with it. A stock-event
read ordered on a column both rows tie on. And one of mine: a `rate_limit_bucket` purge by
`bucket_key` alone, wiping every other suite's OTP budget mid-run.

Fixed by one rule — **exactly one suite may own a global sweep, and no test asserts a
global count** — and verified by twelve consecutive clean runs, 413/413 each.

### 6. `ci:local` and CI were two lists (D-81, D-82)

Eight gates locally, eighteen in CI, nothing comparing them. T5 changed one
`@ApiOperation` summary, `ci:local` went green, and CI failed on a step `ci:local` did not
have. **A green local run that means less than a green CI run is worse than no local run
at all, because it is trusted.**

The premise that kept the database gates out — that `ci:local` should stay
infrastructure-free — was already false (D-82): `pnpm test` runs twenty integration suites
that open a real `pg.Pool` and *throw* rather than skip when `DATABASE_URL` is unset.

### 7. The collection record that no path closed, and the SMS that never stopped

`reconciled_at` was `subscription.collect_reminder`'s only exit and no code wrote it. Worse:
`core.fn_delete_seller_effects` cancels a deleted seller's subscription but holds no grant
on `collection_record`, and `core.fn_delete_account` has by then rewritten that account's
phone to a synthetic `+999…` number. The terminal state was an SMS provider called every
seven days, in perpetuity, with a fabricated number, for an account that no longer exists.

---

## The three T6 traps, and what each turned out to be

**§1.1 — enumerate the FKs first, from `information_schema`, not from the document.**
Done, twice, independently. **The trap enumerates to zero.** 29 foreign keys reference
`core.seller`: 28 on `(id)`, one on `(id, entity_type)`. Zero on
`(id, owner_account_id)`, and `confupdtype` is `'a'` (NO ACTION) on all 29 — in fact **no
`ON UPDATE` action exists anywhere in this database, on any table**. `UPDATE core.seller
SET owner_account_id` cannot raise on FK grounds. A1.1 withdrew the warning on the same
finding; both `seller_id_owner` and `seller_id_market` are real unique indexes with zero
dependents, costing writes and buying nothing.

**§1.2 — the ladder boundary from both sides.** 60 days + 49 orders is NEW; 60 days + 50
is ESTABLISHED; **59 days + 100 orders is NEW**. All three asserted at Phase A. The `AND`
is the whole ruling and an `OR` passes the first two.

**§1.3 — byte-identical invite responses, without constant-time machinery.** Closed on all
three channels at Phase A: the body, the idempotency record, and the duplicate 409. The
branches now run the same statements. **The known-phone branch is heavier, by ~0.096 ms**
— one heap insert — measured, not modelled.

---

## G1.7 and G1.6: the two shapes chosen, and why

**The intent is a new table, not columns on `collection_record`.** The obvious move is to
treat the collection record as the intent — it is what `purchase-intent` creates and the
URL says "intent". It is not one. The collection record is the *reconciliation artifact*,
the row an operator matches a bank line against, and expiring it would void, under an
operator's hands, the record they were mid-way through matching. The two objects have
opposite lifetimes. One intent, one record, `collection_record_id UNIQUE`, and expiry acts
on the intent.

**No new enum, either time.** Appendix C check 16 compares enum names *and* values against
`db/checks/fixtures/appendix-a.json` in both directions, so an intent-state or
transfer-state enum is a document amendment rather than a migration. Both new tables carry
their state as timestamps: a row is live when `reconciled_at IS NULL AND cancelled_at IS
NULL AND expires_at > now()`. **Expiry is a fact about the row, not an event somebody has
to remember to fire.**

**No 21st job.** ADU-DB-01 S24's table *is* the job set and `registry.ts` asserts exactly
its twenty names. The collection sweep therefore belongs to
`subscription.collect_reminder` — which is the right owner anyway: the job whose
termination condition was missing is the job that now enforces it.

**No reconciliation endpoint.** ADU-DB-01 S18.5 calls reconciliation "operator work outside
this contract" and no document names a surface, a role or a screen. So T6 built the
*enforcement* and did not invent the endpoint that would call it:
`billing.fn_reconcile_purchase` is owned by `adulis_migrate`, `REVOKE`d from `PUBLIC`, and
granted `EXECUTE` to **no runtime role at all**. Authority is derived from a live
`core.operator_grant`, exactly as T5's `verification.write_attestation` derives it, so a
psql session is not the authority. `ops/runbooks/billing-reconciliation.md` is the surface.

**The recipient is named by membership, not by account.** "Not an arbitrary phone number —
the recipient must already be known to the store", and a `seller_team_member.id` is the
only identifier that *cannot* name a stranger. It is also what the console holds:
`GET /v1/seller/team` returns membership ids and no account ids.

**`DELETE /v1/seller/ownership-transfer` has no permission check, and that is the point.**
`seller.ownership:transfer` is OWNER-only and must stay so; the recipient is an Admin, and
T6-B S1.2 rules that either party may end it — the recipient's cancel is a **decline**.
Widening the matrix so an Admin could pass that gate would hand every Admin the power to
*start* a transfer, which is the one power Admin is defined not to have. The gate is the
function's own party test, and a non-party gets 404. Same shape as G1.1's
identity-verification endpoint, for the same reason.

---

## Phase D, proven the way the dependency rules were proven

`ops/scripts/gates.mjs` holds the eighteen gates. `pnpm ci:local` runs it; the CI job runs
the same script and keeps only **setup** — checkout, node, pnpm, the four extensions, the
LOGIN passwords — which differs legitimately between a service container and
docker-compose and cannot fail because someone wrote something wrong. The one real
difference, CI's scoping of typecheck/build/test to changed packages (ADU-REPO-01 S7), is
expressed once as `ADULIS_SCOPE_FILTER`.

**The proof.** An `@ApiOperation` summary was changed and `pnpm ci:local` was run:

```
FAIL  gate 'contract-current' (The contract is CI-authored and current).
      The committed contract does not match what the code generates.
      Run: pnpm generate:openapi && pnpm generate:api-client, then COMMIT the result.
```

The old `ci:local` was green on the same change. That is the exact failure T5 shipped.

**One thing the convergence forced.** `.env` carries `NODE_ENV=development` because that
is what `pnpm dev` wants, and the gate script loads `.env` for `DATABASE_URL`. Vite selects
React's build from `NODE_ENV`, so the first converged run produced a *development* console
bundle and failed the gate that exists to catch a development console bundle — every time,
for every developer, on a machine where nothing was wrong. CI never sets `NODE_ENV`, so it
passed there. A gate that fails locally and passes in CI for reasons that are not the code
is a gate people learn to skip. `gates.mjs` drops `NODE_ENV=development` and says so; the
bundle is 193 kB, not 391 kB. `NODE_ENV=production` is *not* dropped — someone who sets
that means it, and the fake-adapter guard should refuse to start.

---

## Contradictions found, and where each is recorded

| | |
|---|---|
| S12.12 promises the outgoing owner `ADMIN` **and** that payout access ends | Resolved by A1.2; built as A1.2 |
| ADU-DB-01 v1.12:2299 "no purchase surface exists at MVP" vs ADU-API-01 v1.7 S12.12's three endpoints | D-36, restated; the code follows ADU-API-01 |
| ADU-DB-01 v1.12:2295's `collection_record` column list omits `currency`, which the table has | D-68's neighbourhood; the table governs |
| ADU-CON-02 v3.1 says `db:check` prints **fifteen** passes (S14.2, S18.2) and check 14 = **107**; the code is at **sixteen** and **109** | D-81's tail; S18.2 is the gate a deploy depends on |
| ADU-CON-02 v3.1 S18 names `ops/render.yaml`; it has never existed | D-80 |
| ADU-AUTH-01 v2.5 S14's gate 0 ("a CLOSING seller is blocked from forward-looking actions") names no set | D-76 |

---

## Gates

```
pnpm ci:local          18/18   (the same list CI runs)
  tests                417 in 31 suites
  db:check             16 PASS · 0 PENDING · 0 FAIL   (114 tables)
  db:determinism       two clean databases converge, 11219 lines
  verify:permission-doc 252 cells, both directions
  verify:docs-ascii    governed specs ASCII; no NUL byte in 242 source files
  verify:error-locale  61 codes, both catalogues
  contract-current     regenerated and committed
```

**Also run, and not part of any gate list.** The live development database was dumped and
compared against a fresh build of `0001..0034` on **table grants and function ACLs** —
identical. Two grants were applied by hand during development and `db:determinism`
structurally cannot catch that class: it compares two *fresh* databases to each other, so
a grant that exists only in a developer's database and not in a migration passes it.

---

## NOT done

**The T6 §5 out-of-scope list, confirmed untouched.**

Deliberately built nothing for, each with its reasoning in the register:

- **The message anchor (D-73).** T6-B S4 asked for the reasoning and nothing built. A
  per-conversation anchor answers a buyer's *second* product question against the first
  product's slots — a wrong answer with **better containment metrics** than the missing
  anchor it replaces, which S15.3's loop would then optimise toward. `openConversation`
  does not re-anchor, so today's behaviour stays the honest one.
- **`BILLING_SUSPENDED → CLOSING` (D-75).** Permitting it also requires ruling where
  `DELETE /v1/seller/closure` returns that seller to; returning them to `ACTIVE` would
  launder a suspension, and recording where they came from is a column no document gives.
- **Gate 0's full set (D-76).** Product publication, broadcasts, courier invites and team
  invites are all candidates for "forward-looking" and none is named. Only the billing
  path was gated, because G1.7 was building it anyway.
- **The operator surface for reconciliation (D-77).** A function and a runbook, no
  endpoint.
- **`ops/render.yaml` (D-80).** Writing one that has never been applied would be a file
  that looks authoritative and has never been true. `deploy.md` step 0 carries the
  topology until a Render account exists to verify against.
- **The rest of ADU-CON-02 S20.6's runbooks** — `rollback`, `restore-drill`, `incident`,
  `sms-failover`, `key-rotation`, `db-upgrade`. Each needs a deployment that exists.

**Rulings owed to the documents**, all in the register with the shipped shape written out:
Appendix B owes `billing.purchase_intent` (D-68) and `core.seller_ownership_transfer`
(D-70); Appendix A owes a `SELLER` rate-limit subject kind (D-72); ADU-CON-02 owes three
corrected numbers (D-81); ADU-DB-01 owes a signature for whatever
`fn_transfer_seller_ownership` means (D-70).
