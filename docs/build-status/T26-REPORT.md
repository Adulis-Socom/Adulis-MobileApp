# WORK ORDER T26 REPORT

**Both phases complete.** Two BLOCKERs closed, four more members of their class
found and closed, fourteen register entries, and a trust ladder that promotes a
seller in a minute while telling you plainly what it still cannot do.

Everything below was run against a local PostgreSQL 17 on port 5434
(`docker compose up -d postgres`), on a database reset with `pnpm db:reset`
before each full pass. `adulis_app` is not a superuser in it.

---

## The order's report block, filled in

```
WORK ORDER T26 REPORT

Phase 1  products/{id} and variants/{id}: foreign id and nonexistent id
         return BYTE-IDENTICAL responses:
           pnpm --filter @adulis/api test -- t26-ownership-before-rules
           -> 65 passed. The comparison is of the whole RFC 9457 envelope
              minus request_id (different between ANY two requests) and minus
              the ids the caller itself supplied.

         D-320 reproduction now fails:
           git checkout f67a522 -- apps/api/src/modules/catalogue/catalogue.service.ts \
                                   apps/api/src/modules/orders/orders.service.ts
           pnpm --filter @adulis/api test -- t26-ownership-before-rules
           -> 9 failed. DELETE /v1/seller/products/{id} fails at
              `"status": 409` against an expected 404 -- the oracle, reproduced
              by the test that closes it.

         sweep population: 62 handlers take a client-supplied object id
                           62 checked
                           6 were in the class:
                             deleteProduct              D-320  business rule first
                             deleteVariant              D-320  business rule first
                             cancelOrder                D-353  rule fused with scope
                             handoffs/sync              D-360  token read first
                             patchCompanyDetails        D-361  no resolution at all
                             fn_cancel_line             D-325  guard could not fire
                           plus 2 recorded and not fixed:
                             PATCH /v1/devices/{id}     D-355  ruling needed
                             POST /v1/cart/lines        D-356  visibility, not ownership

         D-325 covered by the sweep: YES -- over HTTP as a table row, and at the
           function layer with a stranger actor, a total stranger, a NULL actor
           and a positive control that calls the function and rolls back.

         generated test: 55 endpoints in the table (asserted count), 65 tests
           pnpm --filter @adulis/api test -- t26-ownership-before-rules

Phase 2  test thresholds seeded, non-production only:
           NODE_ENV=development pnpm db:reset
           psql -c "SELECT new_to_established_min_tenure, new_to_established_min_orders
                      FROM core.ladder_config"   -> 1 day | 2
           NODE_ENV=staging pnpm db:seed         -> exit 2, refused
           pnpm --filter @adulis/api test -- t26-trust-ladder-test-scale
           -> 9 passed, three of them the guard test (production, staging, unset)

         a real promotion observed via fn_recompute_seller_level:
           the same suite runs the REAL `level.recompute` job, as adulis_jobs,
           through the job harness. seed order: NEW -> ESTABLISHED, with the
           seller_level_event row, the evidence_snapshot the function recorded
           (completed_orders: 2), and seller_public_stats following the event.

         three sellers, one per level:
           psql -c "SELECT s.handle, ls.level, ps.level FROM core.seller s
                      JOIN core.seller_level_state ls ON ls.seller_id=s.id
                      JOIN core.seller_public_stats ps ON ps.seller_id=s.id
                     WHERE s.handle LIKE 'seed-ladder%'"
             seed-ladder-due | NEW         | NEW
             seed-ladder-est | ESTABLISHED | ESTABLISHED
             seed-ladder-new | NEW         | NEW

         seed header states what this does NOT fix:
           "[!] IT DOES NOT MAKE A SELLER ABLE TO EARN A LEVEL. Register D-328:
            nothing in the product moves an order from HANDED_OFF to COMPLETED
            ... So: the SCREENS become testable. The JOURNEY does not. Do not
            read a promotion here as evidence that the ladder works end to end."

Gates    29 gates   pnpm gates                       -> PASS all 29
         API tests  pnpm --filter @adulis/api test   -> 644 passed (Phase 2 head)
                                                        635 passed (Phase 1 head)
         e2e        gate 25, inside `pnpm gates`     -> "the console works
                    against the real API on a reset database"
         db:check   pnpm db:migrate && pnpm db:check -> 16 PASS, 0 PENDING, 0 FAIL

Register 14 new -- BLOCKERs first:
           D-320  CLOSED   the DELETE pre-check oracle, and the rule it produced
           D-325  CLOSED   fn_cancel_line's guard, and the grep it named
           D-360  MAJOR    handoffs/sync discloses a stranger's fulfilment state
           D-361  MAJOR    a company could borrow another store's identity
                           attestation -- fixed; the gap behind it needs a ruling
           D-358  MAJOR    the ladder demotes every seller it promotes
           D-355  MAJOR?   PATCH /v1/devices/{id} resolves no ownership -- ruling
           D-365  MINOR/   a seeded level never reached the storefront
                  MAJOR    (product fact; fixture defect)
           D-353  MINOR    cancelOrder answered with the business rule's code
           D-354  MINOR    fn_cancel_line takes no p_seller
           D-356  MINOR    cart/lines confirms an unpublished variant exists
           D-357  MINOR    the API suite is not isolated between suites
           D-359  MINOR    the test-scale ladder, and what guards it
           D-362  MINOR    the NULL-actor twin 0051's grep missed
           D-363  MINOR    the sweep's population was the wrong one
           D-364  MINOR    three of the sweep's own cases proved nothing
           D-366  MINOR    a COMPLETED order inserted fires no UPDATE trigger

State of main: 4bec441 (PR #88, t22-p1-auth-v2-8) -- 41 commits behind this work.
         UNMERGED, in order: t23-p2-console (8), t23-p3-gap-sentences (9),
         t23-p4-staging (11), t23-p5-runbook (17), t24-p1-install-v119 (18),
         t24-p2-worker-install (19), t24-p3-operator-grant (21),
         t25-p1-capacity (29), t26-p1-ownership-first (38),
         t26-p2-test-ladder (41). Each is a superset of the one above it.
         Nothing from T23, T24, T25 or T26 has reached main.
```

---

## Phase 1 -- D-320, and the class

### The ruling

> **Ownership is resolved before any business rule is evaluated.** A handler
> taking a client-supplied object id resolves it against the actor's seller (or
> account) FIRST, and everything else runs after.

The 409 was never the defect; its **position** was. The operational test for
membership of the class is sharper than "does something happen first": it is
**does any statement before the ownership resolution have an observable outcome
that varies with the client-supplied id?** `assertPermission` does not -- it
asks about the actor and the actor's own seller. Neither does
`fn_assert_step_up`. The reservation count in `deleteProduct` does, and that is
the whole of it.

### The sweep, and why its first population was wrong

The first pass enumerated `@Param` declarations: 61 routes carry a path
parameter, 8 are excluded by name (5 public `storefronts/{handle}`, 2
`availability-overrides/{date}` which take a DATE, 1 `devices/{id}` which is
`@Public()` and has no owner), leaving **53**. That number is arithmetically
correct and answers a narrower question than the order asked.

**An id is client-supplied wherever the client supplies it.** Nine more routes
take an owned-object identifier only in the request BODY, and the refutation
pass found the two worst defects of this phase among them. The population is
**62**. Both of those routes now have cases; the other seven were traced by
hand and are recorded in D-363.

That correction is the finding, more than either defect: *"we fixed the ones we
found"* is what T25 already said, and counting the wrong population is how the
same sentence gets said again with a number attached.

### What was found

| | route | what preceded the ownership resolution |
|---|---|---|
| **D-320** | `DELETE /v1/seller/products/{id}` | a count of ACTIVE reservations, no seller predicate -> 409 for a competitor's selling product |
| **D-320** | `DELETE /v1/seller/variants/{id}` | the same, on the variant |
| **D-325** | `POST /v1/seller/orders/{id}/reservations/{rid}/cancel` | the guard was there and could not fire: `seller_id <> (SELECT ...)` is NULL for a stranger |
| **D-353** | `POST /v1/orders/{id}/cancel` | the ownership predicate and the rule were one query, and the caller got the rule's answer |
| **D-360** | `POST /v1/handoffs/sync` | the QR-token read, on a table with no RLS -> "that stranger's order is being fulfilled right now" |
| **D-361** | `PATCH /v1/seller/company-details` | nothing -- there was no ownership resolution, and the column feeds identity verification |

D-360 and D-361 are the ones the refuter was sent to find, and the order was
right that they existed. D-361 is not an oracle at all: it is a committed
cross-tenant read-through of identity evidence.

### What the fixes cost, and what came back

Code review caught **two regressions the fixes introduced**, both after the
sweep was green:

- `COURIER_CANNOT_SCAN` **throws**, so it escapes the per-item loop and aborts
  the whole batch -- against 12.6.1's *"200 whenever the batch was
  well-formed"*. Hoisted above the signature check it became reachable on an
  order id alone, so one courier typo would have discarded a queue of doorway
  scans collected offline. It sits below the signature again.
- The representative check scoped the person to `req.ctx.accountId`, but the
  permission checked one line above is `seller.store:write`, which ADMIN team
  members hold. A staff member was 404'd on an endpoint the matrix lets them
  use. It resolves against the **store's owner** now.

Both have regression tests, each checked to fail against the rejected shape.

### One consequence, stated rather than discovered later

**A company seller whose owner holds no individual store now cannot set company
details at all**, so `COMPANY_DETAILS` publication readiness cannot go green and
that seller cannot publish.

That is not a regression this check introduces. Before it, the only way through
was to name a stranger's `core.person` and borrow their identity attestation --
which is the defect. Nothing in the product creates a person row for a
company's representative: `createSeller` mints one only for an INDIVIDUAL
seller, and the operator attestation path explicitly refuses to. **D-361 asks
for that ruling**, and it is the most consequential open question this phase
produced.

---

## Phase 2 -- the ladder, at test scale

### What moved, and what did not

The **thresholds** moved, in the non-production seed and in the test fixture:
one day, two orders, where ADU-VAL-01 S2 sets sixty and fifty. The
**mechanism** did not move at all -- `git diff f67a522..HEAD -- apps/api/src/jobs/`
is empty and no ladder function or trigger is touched.

Sixty days is seedable (`since` is the ladder's own clock and a fixture can
backdate it). Fifty completed orders per level-dependent seller is not, and a
fixture of 150 order rows would be the thing under test.

### The three stores

One owner, three stores, one per **reachable** level. There is no fourth,
because all four TRUSTED thresholds are ADU-VAL-01 Group A and stay NULL, every
gate is `coalesce(..., false)`, and a fourth store pretending otherwise would be
the dummy ladder this exists not to be.

`seed-ladder-est`'s ESTABLISHED is **written directly**, and the seed says so.
It has to be: a level the function produced always carries `since = now()`
(D-358), so no sweep history leads to a stable ESTABLISHED row. The function
agrees with it -- three sweeps leave it alone -- but it did not produce it, and
the seed's headline sentence claimed "nothing here sets a level" until review
caught the file denying what it does.

### D-358 -- what watching a real promotion found

`fn_recompute_seller_level` measures tenure as `now() - seller_level_state.since`
and sets `since = now()` on **every** level change. A promotion is a level
change. So a seller reaches ESTABLISHED with tenure zero, fails the tenure arm
on the next sweep, and is demoted.

```
before        NEW          tenure 3 days
after sweep 1 ESTABLISHED  tenure 00:00:00
after sweep 2 NEW          tenure 00:00:00
events: NEW -> ESTABLISHED  COMPUTED
        ESTABLISHED -> NEW  COMPUTED
```

At production scale that is a 61-day cycle in which a seller is ESTABLISHED for
exactly one nightly run, with the NEW product cap re-applying overnight and the
badge flickering. It is invisible today only because D-328 means nobody reaches
the promotion at all -- the two defects hide each other.

**The cadence matters and the first version of this report's register entry got
it wrong.** At the seed's one-day threshold on the job's own cron, tenure at the
next run is ~24 hours and `interval '24 hours' >= interval '1 day'` is TRUE, so
the seeded fixture does not oscillate nightly. Two back-to-back sweeps do, which
is what makes the mechanism visible in a minute. The defect is production's.

It is **pinned as a characterization test**, not endorsed: when the ruling
arrives, that expectation flips deliberately instead of silently. No function
was changed, because 0028's own comment registers tenure's origin as undefined
by any document, and choosing one would be inventing an answer to an open
product question.

### What this does not fix, in the seed's own words

> **[!] IT DOES NOT MAKE A SELLER ABLE TO EARN A LEVEL.** Register D-328:
> nothing in the product moves an order from HANDED_OFF to COMPLETED -- the
> transition is ratified in migration 0011 and NO function, trigger, job or
> service performs it. `fn_recompute_seller_level` counts COMPLETED orders, so
> in a live test a seller still cannot advance the counter by trading. [...]
> **So: the SCREENS become testable. The JOURNEY does not.** Do not read a
> promotion here as evidence that the ladder works end to end.

The same sentence is in the seed's printed summary, in the test's header, and in
D-359.

### The risk this change creates

A one-day, two-order threshold in a production market would promote every
trading seller inside a week, lifting the NEW product cap and the transaction
cap, and it would **look like the ladder working**. What stands between it and a
market is that `seed.mjs` **enumerates** the environments it may write a fixture
into rather than negating production -- so staging is refused with production
and with every environment added later.

D-359 records it, and names the launch gate as the neighbourhood a check would
live in: `pnpm verify:trust-before-open-signup` already refuses to let a market
open to public seller signup while measuring nothing, and *"a market open to
signup whose ladder thresholds are below the ADU-VAL-01 values"* is the same
sentence with the inequality reversed. It is not added now because the gate is
about markets that are open, and none is.

**Two stale copies of that rule pointed the other way**, both pre-existing and
both made dangerous by this change -- `apps/api/src/common/env.ts`, the file
whose entire job is the NODE_ENV matrix, still said *"Staging IS seeded"*, and
`ops/runbooks/staging.md` still described the fixture as "two sellers, five
orders". Both now say what the script does. That is the stale-copy failure the
root `CLAUDE.md` names, found in a fifth and sixth place.

---

## What was NOT done

Everything the order put out of scope, and nothing was quietly taken on:

- **D-319's RLS ruling.** Right answer, wrong order -- a policy layer over a
  known-leaking read is one nobody can test cleanly.
- **D-328's settlement job.** It is the ruling Phase 2 keeps running into, and
  it is the one thing that would make the ladder real.
- **D-310's missing pool error listener** -- the order names it as the next
  thing, because one closed connection exits the process and logs nothing.
- The other thirteen recommendation items, the three founder-owned engines,
  mobile, deployment.

And, inside the phases, three things reported rather than fixed, each with the
reason:

- **D-355**, `PATCH /v1/devices/{id}`: `@Public()` by design, pre-identity, and
  there is no owner to resolve against until an account claims the device.
  Choosing the rule here is what the prime rule forbids.
- **D-356**, `POST /v1/cart/lines`: a one-bit visibility leak whose fix has a
  test-fixture blast radius; its own PR.
- **D-366**, the UPDATE-only triggers a seeded COMPLETED order does not fire: a
  fixture that hand-writes derived counters asserts the numbers it is meant to
  test. It closes with D-328.

## What is still open, in the order I would answer it

1. **D-328** -- what settlement is and who performs it. Until it is answered no
   order completes, no seller earns a level, and D-358 stays invisible.
2. **D-361** -- where a company representative's `core.person` row comes from.
   Company sellers cannot publish until this is answered.
3. **D-358** -- what tenure is measured from, and whether a promotion resets it.
4. **D-355** -- whether an unauthenticated caller may patch a claimed device.
5. **D-360** -- which actors may be told `COURIER_CANNOT_SCAN` rather than "no
   such order".

## Method note

Both phases were reviewed twice: an independent adversarial pass instructed to
find what the author missed rather than to confirm what the author found, and
`code-review` at high effort over the whole range. **Between them they found six
things the author had not**, including the two worst defects of Phase 1, three
test cases that passed for the wrong reason, two regressions the fixes
introduced, and a fixture whose ESTABLISHED store was NEW on its own storefront.

Every one of those is in the register (D-360, D-361, D-363, D-364, D-365,
D-366) rather than quietly repaired, because the number in a report is what the
next order trusts.
