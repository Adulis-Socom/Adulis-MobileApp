# T18 REPORT - Photographs, and the Two Fakes That Actually Block

**Order:** T18 - "Photographs, and the Two Fakes That Actually Block"
**Written:** T20, and that delay is the first thing to say plainly.

---

## Why this report is late, and why it is separate

T18's report was never written. T19 and T20 followed, and T20 S9 orders it written
now, **separately from T20's own report**, for a stated reason worth repeating:

> "merging it into this order's report would bury T18's fake-audit count and the
> cancel-then-set attack under the media work, and that attack is the most
> important thing either order produced."

That is right, and the register bears it out. **T18 Phase 4 found a live account-takeover
path in its own first draft** -- not in old code, not in a dependency, but in the
migration being written at that moment -- and killed it before merge. Nothing in
T20 is as consequential.

---

## The five phases, and what each one actually produced

| Phase | Register | Outcome |
|---|---|---|
| **1** - The two fakes that block | D-240 | Three fakes became null adapters; boot blockers fell 6 -> 4. **Found a BLOCKER: four notification templates reached nobody.** |
| **2** - Media | D-242 | The storage-free half only. **Found a shipped endpoint that had never once succeeded.** Completed in **T20 S4**. |
| **3** - The store list | D-243 | D-97 closed. One pre-existing auth-boundary defect found and fixed in passing. |
| **4** - The payout lock | D-241 | **The cancel-then-set takeover path.** See below. |
| **5** - The trust flags | D-244 | A deliberate beta setting given a tripwire so it cannot survive by inertia (gate `trust-before-open-signup`). |

---

## Phase 4: the cancel-then-set attack

**This is the finding of both orders.**

T18 S4 ruled the new-device payout lock too aggressive for a brand-new account:
*"The lock exists to stop an attacker redirecting payments after a takeover. On a
brand-new account there is nothing to redirect."* True, and the first draft
implemented it literally -- carve out sellers with **no `ACTIVE` payout row**.

The adversarial pass broke that in one move, and **the move costs the attacker
nothing**:

1. `core.fn_cancel_payout_change` requires **no step-up**, checks **no lock**, and
   is deliberately easy -- reverting must always be easier than changing.
2. An attacker who has taken over an account, on a device we have never seen,
   cancels the seller's legitimate **PENDING first set**.
3. That leaves no `ACTIVE` and no `PENDING` row. The `ACTIVE`-only carve-out
   applies.
4. The attacker sets **their own bank account, unlocked**.

Before the migration, that attacker was held for the full window. The "improvement"
would have opened the door.

**The fix is the predicate.** The question is *has this seller **ever** had payout
details* -- a `CANCELLED` row is still a row, and an attacker-controlled move cannot
walk it back. An e2e arm performs the entire attack and requires `NEW_DEVICE` at the
end of it.

**The twin mattered as much as the write path.** `payoutLockState`, which draws
SC-24's proactive panel, carried the same predicate -- and the first draft had the
panel and the server agreeing on the **wrong** one. A panel that disagrees with the
write path is worse than no panel; a panel that agrees with it wrongly hides the
attack from the screen as well as from the server.

### The aggravating factor, and its closure in T20

D-241 recorded something it could not fix:

> "activation is lazy and reader-driven. `core.fn_activate_due_payout` is invoked
> from exactly ONE place in the product (the GET on `/v1/seller/payout`) and no job
> calls it, so a due PENDING stays PENDING -- and stays cancellable -- **until
> somebody opens the payout screen. The window is not 24 hours; it is 'until the
> seller next looks'.**"

**That is now closed.** ADU-AUTH-01 v2.7 S20.1 ordered the job, T20 S6.1 built it
(`payout.activate_due`, every five minutes, per-seller containment, its own
transaction), and D-254 records it. The third of D-241's three open rulings --
*"Whether activation should have a job rather than depending on a reader"* -- is
answered yes and discharged.

**So the sentence in D-241 is now true as written: the window is twenty-four hours.**
It was not true when D-241 was written, and the entry said so rather than assuming
the number it wanted.

**One of D-241's three rulings remains open**, and it is still open after T20:
`core.fn_cancel_payout_change` accepts a row whose `activates_at` has already
passed. The job narrows the exposure -- a due row is now activated within five
minutes rather than never -- but it does not remove the case.

---

## Phase 1: the fake audit

The order asked which fakes actually block production. The audit found the answer is
smaller than the fear:

- `assertFakeIsPermitted(name)` throws under `NODE_ENV=production`, with **eight
  callers**.
- **Three of them did not need a vendor at all.** A fake pretends to be a vendor; a
  **null adapter** says there is no vendor. The social-platform resolver, the post-link
  resolver and the NLU classifier each have a specified degraded behaviour -- verification
  falls to the manual path, links resolve to nothing and the seller is told so,
  unmatched questions escalate to the seller. Those are the specification, not a
  failure mode, so they became `Null*` adapters that run anywhere.
- **Boot blockers fell from six to four.**

**And Phase 1 found a BLOCKER while counting.** `NullPushAdapter.send()` returned
`RETRYABLE`, which is a claim about a *transient* failure. With no provider bound the
failure is permanent, so every PUSH notification burned its full backoff and landed in
`FAILED`. **Four templates are PUSH-only and therefore reached nobody**:
`ORDER_AWAITING_PAYMENT_MORNING`, `STOCK_CONFIDENCE_NUDGE`, `TRIAL_ENDING`, and
`notification.chat.escalated`.

The last is the one that costs money: a buyer asks what the assistant cannot answer,
it escalates, and **the seller never learns**. A lost sale with no trace.

**T18 recorded it (D-240); T20 S5 fixed it** with a fourth outcome, `NO_PROVIDER` --
a fact about the platform rather than about the device or the network -- and a
fallback that **moves** the row to `IN_APP` rather than copying it (D-253).

---

## Phase 2: an endpoint that had never once succeeded

`PUT /v1/seller/products/{id}/images/order` was in the contract, had types, and
**had never been called by anything** -- not by the console, not by a test. D-242
records that it could not have worked in any environment.

**Phase 2 completed in T20 S4**, which is why this report is written after it: the
half T18 could do without a storage vendor was done then, and the half that needed
one is D-248.

---

## Phases 3 and 5, briefly

**Phase 3 (D-243)** closed D-97 with `GET /v1/seller/list` and made the chooser
redirect a single-store seller into their store. It also found and fixed a
**case-sensitivity defect on an auth boundary** that predated the phase -- the kind
of thing found only by someone reading the neighbouring code for another reason.

That redirect had a consequence T18 did not see and T19/T20 paid for: it took
"Create a store" away with it, and it trapped a courier who also owned exactly one
store. Both are closed now (T19 Phase 1 and T20 S3, D-247).

**Phase 5 (D-244)** turned the beta's trust-flag settings into a launch gate:
`trust-before-open-signup` (gate 26 at the time; **cite it by name**) fails the day a
market is opened to public seller registration while nothing about a seller is
measured. It is green today because the beta is invite-only. **The point is that it
cannot survive by inertia** -- the setting is deliberate now and will announce itself
the moment it stops being.

---

## What T18 did not do

- Media, completely -- Phase 2 was scoped to the half needing no vendor.
- The document debt from Phase 4, item 1: **ADU-AUTH-01 v2.6 S20 states the
  new-device payout lock unconditionally**, and v2.5's invariant quantifies the
  guarantee as 48 hours. For a seller who has never had payout details it is now 24.
  The narrowing is a founder ruling carried as an interim ruling and **the amendment
  was owed**. ADU-AUTH-01 **v2.7 S20.0a installs it** ("the predicate is *ever had*,
  not *has an active row*"), so this debt is discharged as of T20's installation.
- D-241's remaining open ruling on `fn_cancel_payout_change`, above.
