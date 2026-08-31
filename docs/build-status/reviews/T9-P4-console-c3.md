# Adversarial pass -- T9 Phase 4 (console C-3)

**Ran against:** the working tree of `tier9/t9-p4-c3` before commit.
**Performed by:** the building agent, per WORK ORDER T7 S0.
**Written before** the fixes it prompted.

The premise: this stage's done-clause is a rendering claim, and a rendering
claim is the easiest kind to assert without checking. So every claim the code
or its comments make was put to a browser.

---

## F1 -- MAJOR -- four of six resolving links went nowhere

`Home.tsx` maps `resolving_action.kind` to a route, and its comment claimed
"the link is never dead and never lies about being ready". Of the five routes
it named, **only `products` existed**. `eligibility`, `profile`, `payouts` and
`fulfilment` fell through to the router's `*` catch-all, whose element is
`<Navigate to=".." relative="path" replace />` -- so "Complete this" navigated
the seller **straight back to Home**.

Worse than a 404: a control that appears to work, does nothing visible, and
teaches the seller that the readiness list is decorative. Four of the six
outstanding items were affected -- which is to say, most of the screen.

**Fixed:** the four screens ADU-CON-03 S6's table names are now routes, as
placeholders (SC-22, SC-17, SC-24, SC-18). Verified by loading each in a
browser:

```
eligibility   -> SC-22
profile       -> SC-17
payouts       -> SC-24
fulfilment    -> SC-18
products      -> SC-07
```

## F2 -- MAJOR -- D-103 was half-discharged by the change that claimed to close it

The provider was built, held the market, and **nothing consumed it**.
`Shell.tsx` still passed `timezone="Africa/Addis_Ababa"` as a literal, and
`IdleWarning` paired it with a hardcoded `'ETB'` -- so the one sentence in the
console that prints a **time** was still formatted against a guess, which is
D-103's complaint word for word.

A provider nothing reads is not a fix; it is the same defect with a new file
beside it.

**Fixed:** `IdleWarning` takes the `MarketContext` the server sent, and
renders **nothing** while it is null rather than falling back. A sign-out time
in the wrong zone is worse than no sign-out time, because a seller acts on it.

## F3 -- MAJOR -- "UPGRADE_REQUIRED is now reachable" was false

The client half is right: `UpgradeGate` sits above the router so the state can
honour S3's "reload prompt, no other content".

But **the server hardcodes `client_status: 'OK'`** (`bootstrap.controller.ts`,
`MIN_SUPPORTED_CLIENT = '0.0.0'` and a literal beside it -- D-20's
"floored at 0.0.0 so every client passes until a floor is ruled"). No
comparison happens. So the value the gate keys on cannot arrive, and the state
is still unreachable **in production**, by a server-side gap this PR does not
close.

**Verdict: the CLAIM is corrected; the client half is PROVEN.** Planting
`client_status: 'UPGRADE_REQUIRED'` in the controller, rebuilding and loading
the console gave:

```
state rendered        : UPGRADE_REQUIRED
readiness rows        : 0
sign-in form leaked   : no
reload control        : present
```

The plant was reverted and `git diff` on that file is empty. Recorded as
D-147: the floor is a value ADU-VAL-01 owes, and until it is ruled this gate
is correct and inert.

---

## Checked and found sound

- **Nine items, from the server, in the server's order.** The screen sorts
  nothing, filters nothing and hides nothing. A code it has no label for
  renders as its own code, and an action it has no route for renders
  unrouted rather than vanishing -- both because a readiness row the seller
  cannot see is a block they cannot clear.
- **Not a wizard.** No step numbers, no "next", no stored position. Verified
  by loading the screen twice: identical output, "3 of 9 done" both times.
  There is no position to lose because there is none to keep.
- **R26 appears at the moment of choosing**, verified by clicking the radio
  in a real browser rather than by reading the source: both facts present,
  `aria-live="polite"`, the individual branch correct, and the company text
  gone when the choice changes.
- **One bootstrap per load, in the right order.** The call moved out of
  `SessionProvider` rather than being added beside it; the session probe waits
  on `booting`. Sign-in still completes end to end on a reset database.
- **The idempotency key is minted on mount**, not in the submit handler --
  the rule the console's own CLAUDE.md states, and a declaration that mints a
  person row is not a place to get it wrong.
- **No fabricated problem envelopes.** Three sites initially built an
  `AdulisProblem` out of `{ code: 'TRANSPORT_ERROR' }`; `exactOptionalPropertyTypes`
  caught two and the third was found by reading. A synthesised envelope puts
  an invented request id in front of support.

## Not built, and stated rather than stubbed quietly

**SC-01 Life 2, the daily brief.** It needs `GET /v1/seller/orders?status=
needs_action`, `/v1/seller/analytics/overview` and `/v1/notifications`, and
every row needs SC-03's clock rules -- the countdown means a different thing
in each order state and `PAYMENT_CONFIRMED` shows none at all. Building it as
a list of numbers without those rules is exactly how a running timer ends up
on a paid order, which ADU-CON-03 S16 names as a forbidden control. It renders
a one-line statement of what is coming, not a fake.
