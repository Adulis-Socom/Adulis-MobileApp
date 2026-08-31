# T10 -- Trade, and the Harness That Makes It Verifiable

Work order T10, five phases. This report is S7 of that order.

**ADU-AUTH-01 v2.6 was under evaluation and is NOT installed throughout.**
Nothing in T10 assumes the current authentication mechanism and nothing
assumes a replacement. Where authentication was unavoidable -- the harness has
to sign in -- it is in exactly one function, named below.

---

## Phase 1 -- the merges

#35, #36, #37 and #38, merged in number order.
`git diff <parent> -- docs/build-status/DEFECT-REGISTER.md | grep '^-[^-]'`
returned zero on each, as required: a merge of an append-only file produces
only additions, and **a lost register entry breaks no build, fails no gate and
appears nowhere.**

Continuity confirmed against the order's own correction: the gaps are at
**D-25 and D-28**, not D-24 and D-27. `D-105` appears exactly once.

Phase 1 was merges, not a PR.

---

## Phase 2 -- four documents, a pinned count, and an appendix gate

Installed: **ADU-DB-01 v1.13**, **ADU-REPO-01 v1.3**, **ADU-CON-02 v3.2**,
**ADU-VAL-01 v1.2**.

ADU-REPO-01 was installed **for the first time**. It had been cited 77 times
across 33 files -- including the title of the `deps` gate -- while being absent
from `docs/` and from DOCUMENT_AUTHORITY's baseline. Nothing recorded that
until D-94.

`verify:deferred-values` pinned at **14** rows, down from 16, with the two
departures explained in the script rather than in a commit message.

`verify:appendix` added, comparing document to fixture **both ways** and citing
by name.

> **The order's pre-ruling was exercised, and it mattered.** DB v1.13's
> appendices came from the T7 Phase 2 output plus `WEB` -- four work orders
> old. On install they were checked against the fixtures rather than trusted:
> **66 types and 114 tables, in agreement.** The one disagreement was an
> artefact -- Appendix B names a per-table fixture that does not exist -- and it
> became D-150 rather than a reconciliation. *"I would rather be told I am
> stale than have you reconcile a green check against my document."*

PR #39.

---

## Phase 3 -- the orphan sweep

**The class was fixed at T7 in ten suites, and D-128's fix reintroduced it in
an eleventh.** Ten edits are not a rule.

`verify:orphan-sweep` asserts, after a full suite run, zero orphaned rows
against **every FK into `core.seller`, enumerated from `pg_constraint`** -- not
from a list. `WITH ORDINALITY` on both `conkey` and `confkey`, joined on
ordinal, so a composite key cannot be mismatched column-wise.

Proved red by planting a `session_replication_role = replica` delete, watching
it fail, and removing the plant.

**It found D-151 on its first run** -- a T9 test of my own leaves one orphaned
`core.seller_level_state` per run, because `trg_enter_ladder` fires on the
*evaluation* insert, two triggers out from `core.seller`. Which is the argument
for enumerating rather than listing, arriving immediately.

PR #40.

---

## Phase 4 -- the console harness

**Playwright, against the built console and the real API, on a database reset
immediately before.** Appended as gate `console-e2e`.

C-3 landed without a harness. T9's three defects are the argument, and none of
them was found by reading the diff: a link that navigated back to Home
(D-146), a provider nothing read (D-145), a state that could not fire (D-147).

**Sign-in is in exactly one file** -- `e2e/helpers/session.ts`, `signInAs`. No
test names a phone number; no test knows what an OTP is. It drives the real
wire, because a harness that fabricates a session proves the screens render,
not that a seller can reach them.

**One sign-in per run.** The first version signed in per test and the fourth
got `otp/request 429` -- the 3/hour phone budget, a refusal about nothing,
D-124's shape arriving in the harness. `globalSetup` plus `storageState`.

First customers, and no backfill beyond them: the twelve states through
`ScreenState`, SC-01's readiness resumable across a reload, the store chooser's
labelled gap, and `UPGRADE_REQUIRED` planted at the wire.

> ### D-152 -- the harness's own regression test passed against the regression
> ### it was written for
>
> Planting D-146 exactly -- deleting the `payouts` route so the router's
> catch-all returns the seller to Home -- gave **8 passed**.
>
> The assertion was true when it ran and false a moment later: `page.goto`
> resolves before `<Navigate>` has run, so the readiness list really is absent
> right then. **A redirect happens slightly later, and a test that checks the
> destination's CONTENTS races it.** It now asserts the URL the browser ended
> up at. Re-planted: 1 failed, 7 passed. Restored: 8 passed.
>
> That is the harness justifying itself on its first day. C-3 needed one
> because reading missed three defects; **a harness needs proving because a
> test written from the same understanding as the code inherits the same blind
> spot.**

The harness is itself typechecked, via a separate `tsconfig.e2e.json` -- it
needs `@playwright/test` and node types the app must not have. A harness with
no type gate is one whose own typo surfaces as a red test about the product.

PR #41.

---

## Phase 5 -- C-4, Trade

SC-03 Orders, SC-04 Order detail, SC-05 Payment evidence, SC-06 Handoff and QR.
Every rule below is asserted by `console-e2e` and **proved by planting its
violation**.

### The four owed rules

**1. Three clock treatments, in ONE module** (`lib/clock.tsx`). SC-03's row and
SC-04's clock region ask it the same question, so they cannot drift.

| State | Clock |
|---|---|
| `CREATED` / `NOTIFIED` | the reservation window, `order.expires_at` |
| `PAYMENT_SUBMITTED` | the CONFIRMATION window, the open submission's `sla_deadline` -- **and not the reservation one, which is irrelevant here** |
| `PAYMENT_CONFIRMED` and after | **no countdown at all** |

There is no fallback from the confirmation deadline to `expires_at`: if the
former is missing the honest rendering is no clock, because showing an
irrelevant deadline as though it governed is worse than showing none. The
seeded `PAYMENT_SUBMITTED` order carries an `expires_at` **in the past** for
exactly this reason -- a fallback renders a negative countdown and the harness
sees it.

`if (Date.now() > order.expiresAt)` is the defining violation of "the console
computes no business state", and it is not in this codebase. At zero the
countdown **refetches**; the server says what the order is. The countdown also
measures against `serverTime` from `/v1/bootstrap` rather than the device
clock, which `market.tsx` had been carrying for this since C-3.

**2. The payment decisions are equally weighted.** `.decision` has no variant
-- no `.primary`, no `.danger` -- and the stylesheet says so where someone
would add one. **"Confirm Payment Received", verbatim, never "Accept
Payment."** The verify-in-your-own-bank sentence renders before both controls,
always, and the test proves it is not inside a `<details>` rather than merely
visible. Confirming without opening the evidence is a normal path
(ADU-ARCH-01 S3.3): nothing nags, blocks, or badges the evidence as unread.
Rejection is two steps and step two states the consequence in full.

**3. R20 -- the handoff region is DISABLED, not hidden**, and that is all four
controls, not only Mark Ready. The region stays in the document with its
explaining line; `disabled` is the only thing state changes. The test asserts
both halves, which a hidden region makes impossible to distinguish from a
broken one.

**4. Evidence renders from a blob URL revoked on unmount.** No download, print,
share, save, or "looks valid" affordance of any kind -- asserted across the
whole modal, not just the image. **The revoke is proved by fetching the URL
after closing and requiring the fetch to fail**; checking that the `<img>` is
gone would pass with the blob still alive.

Also built: the step-up **interception and retry**. `useStepUp` opens SC-31 and
runs the original action again on success, so the seller taps once. It has two
doors, because the API has two: a `403 STEP_UP_REQUIRED` (which
`pg-error-translator` raises from SQLSTATE U0004 when a challenge is stale),
and `challengeRequired` for endpoints whose zod body demands the challenge up
front -- `reissueBody` is one, and reissuing payment instructions is C-4's
single step-up action. `StepUpModal` gained nothing: it still requests, takes
six digits, verifies and hands back an id.

### What the phase found

**Six gaps, stated rather than filled.** Each is on screen with a
`data-gap` attribute and an e2e assertion, so a later agent cannot quietly
delete an awkward sentence:

| | |
|---|---|
| **D-153** | **SC-03 and SC-04 specify a buyer name the data model has no column for.** `core.person` holds a keyed hash and nothing else, deliberately; `core.buyer_profile` is an anchor with no payload; `core.account` holds a phone number, and S7 forbids showing that. A document-against-document conflict, and the data model is the one that gives its reasoning. **Needs a ruling.** |
| **D-154** | `GET /v1/seller/orders` takes no filter parameter, so SC-03's four tabs group the loaded rows and say so. |
| **D-155** | **No endpoint anywhere returns `allowed_actions`** -- one of the three things `apps/console/CLAUDE.md` says the console renders. |
| **D-156** | The QR payload serialisation is unspecified. Isolated in one function so the ruling changes one line. |
| **D-157** | Courier assignment wants an account id; the couriers endpoint returns invites with phone numbers. Nothing bridges them. |
| **D-158** | Development financial storage is in-memory, so no SQL fixture can supply evidence bytes. |

**One thing owed build, and built** -- D-159. The seller order endpoints
returned neither the confirmation deadline, nor a line count, nor any history.
`core.order_state_transition` has existed since migration 11, is written by a
trigger, is protected against mutation, and **nothing had ever read it.**

**And two defects in the harness itself**, both found on C-4's first run:

> ### D-160 -- the gate ran a stale API, and a zombie answering `/healthz`
> ### read as a healthy start
>
> The gate checked that `dist/main.js` existed and ran whatever was in it while
> rebuilding the console. Then it waited for `/healthz`. **`/healthz` answering
> proves that AN api is up, not that THIS one is.** With a stale process
> holding the port, the child dies on `EADDRINUSE`, the health check succeeds
> against the zombie, and the suite runs against that binary.
>
> Measured: the console showed "undefined items" and no confirmation clock, and
> both were **true readings of an API compiled before those fields existed**.
> Every symptom pointed at the screens. Seven failures survived adding the
> rebuild, because the zombie was still answering; the port guard took seven
> to one, and the one was D-161.
>
> **A check that runs and a check that checks are different things** -- D-132,
> one layer out.

> ### D-161 -- `locator.count()` does not retry
>
> The QR test counted modules the instant the modal became visible, while
> `GET /qr` was still in flight, and reported an empty QR that had 1396
> rects. `expect(locator)` retries; `await locator.count()` asks once.
>
> D-152 was an assertion that ran too early and **passed**. This one ran too
> early and **failed**. Same cause; only the direction of the wrong answer
> differs.

### Proving the phase

The three C-4 rules were each broken in the way their rule forbids, one at a
time, and each was caught by its own test with a message naming the rule:

| Plant | Result |
|---|---|
| `clockFor` falls back to `expires_at` on `PAYMENT_SUBMITTED` | *"a PAYMENT_SUBMITTED order must show the 24h confirmation window"* |
| the handoff region is hidden rather than disabled | R20 test, *"element(s) not found"* |
| `#detail-confirm` gets a green background and weight 800 | *"the two decisions must be styled identically -- neither is the safe default"*, with the computed-style diff |

All three restored; **16 passed**; `pnpm ci:local` **PASS all 22 gates**;
**461 API tests passed**.

PR for Phase 5.

---

## What was NOT done

Per the standing rule that every session ends by listing what it did not do.

- **Everything authentication.** `core.otp_challenge`, `core.step_up_challenge`,
  `fn_assert_step_up`, the auth service and its controllers, ADU-AUTH-01 v2.6,
  OTP provider adapters, passkeys, social OAuth. Out of scope by S6.
- **No backfill of C-1 and C-2 coverage** beyond Phase 4's four first
  customers. S4 says so in terms: *"the harness earns its place on C-4;
  retrofitting it across everything first is how a phase stops ending."*
- **R25 -- the courier sees the QR only after accepting custody** -- is SC-C1
  and lands at **C-8**. C-4 builds the SELLER's QR, whose gate is R20.
- **Courier assignment and custody transfer are disabled** (D-157), so the
  handoff region's middle two controls are rendered and inert.
- **SC-05's happy path uses planted bytes** (D-158). The security shape is
  asserted for real; the pixels are not.
- Real vendor adapters, the operator surface, `ops/render.yaml`, D-86, mobile,
  C-5 and beyond -- all out of scope by S6.
- **Amharic translation quality.** The C-4 keys carry English in `am.ts` and
  are declared in `MT-KEYS.md` as awaiting the human pass, which is the
  existing treatment for every console key. Out of scope by S6.
- **PRs #39, #40 and #41 are open and unmerged.** T10 Phase 1 scoped merging to
  #35 through #38.

## Rulings needed out of T10

D-153 (buyer name -- product, with a privacy dimension) - D-155
(`allowed_actions` -- contract) - D-156 (QR serialisation -- contract, needed
before the Companion's scanner) - D-157 (courier account ids -- contract, one
line of SQL either way) - D-154 (an orders filter parameter, or a statement
that the console groups locally).
