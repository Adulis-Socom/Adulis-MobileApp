# WORK ORDER T14-C REPORT

**The Rest of the Console.** The install is complete and audited; C-5 is built,
adversarially passed, remediated, and proven in a browser; C-6, C-7 and C-8 were
not started, deliberately -- a half-finished stage is worse than one not started,
and the order says so. Every claim that asserts verification names its command.
`State of main` is a ref.

---

## S1 -- the install

**Installed, exact founder bytes (commit a3c74f5):** ADU-CON-03 v1.2,
ADU-DB-01 v1.15, ADU-API-01 v1.8, ADU-RUL-07 -- and ADU-RUL-06, which every
prior session had cited and none had ever installed. All five 0 bytes above
U+007F (`pnpm verify:docs-ascii` PASS on the grown governed set). v1.1/v1.14/v1.7
moved to `docs/superseded/`. `verify:appendix` re-anchored to v1_15 and PASS both
ways -- the fixture never won, so nothing stopped.

**The install audit found the router lying (D-222).** DOCUMENT_AUTHORITY.md --
the fail-closed spec-router's own input -- still named v1.14/v1.7 as binding
(one line still said v1.13) and carried no ADU-CON-03 at any version;
apps/api/CLAUDE.md agreed with it. Both advanced. The amendments manifest
installed the CON-03 reissue and, two rows down, said the reissue was owed --
reconciled: v1.2 IS the reissue RUL-07 asked for, post-dates it, and the later
founder document governs. Recorded append-only, not fixed: 0046/D-215 cite
RUL-06 for the is_live ruling whose real home is ADU-DB-01 S30b.3 (the merged
migration is never edited); v1.15 S0 still says "109 tables" against its own
S0.1/Appendix B's 116 (installed verbatim; governed docs are not edited here);
ADU-API-01's S12 catalogue marks PATCH variants and PUT image-order with **I**
while S8 says POST-and-nothing-else -- the server implements S8, the build
follows S8, the two markers are the next reissue's.

**D-220:** v1.15 S30b.7 rules D-208 (audience joins the anonymous-throttle
tuple) and S30b.3 rules D-216.4 (bootstrap serves a returning device from a
SUSPENDED market). Both rulings' service halves are backend work outside this
order's scope -- registered as owed, not smuggled in.

## S3 -- C-5 (the only stage reached)

**First act, per the order: Part B's state colours in console CSS before drawing
anything.** `console.css` gained the state visual language -- danger for
TRANSPORT_ERROR/VALIDATION, warn for CONFLICT/BLOCKED_READINESS/
UPGRADE_REQUIRED, info for STALE, neutral for EMPTY/TERMINAL/NO_ENTITLEMENT,
success for readiness-done -- text the carrier, colour the reinforcement.

**Screens: SC-07, SC-08, SC-09, SC-10, SC-11** (`features/catalogue/`; SC-09/10
are sections of SC-08 per S8, SC-11 both inline and routed at
`/products/:productId/stock`). Types transcribed locally from the service
(the catalogue endpoints are schema-less in the contract, the D-98 class) and
marked for deletion the day the contract gains schemas.

**The traps, each with its command** (all under `pnpm verify:console-e2e`,
26/26 against the real API on a reset database):

```
set-count and confirm-stock are visibly TWO actions      catalogue.spec "SC-11 -- stock is two distinct actions"
the cap counter names which limit binds                  the counter the contract cannot supply is NAMED, not faked
  ("10 of unlimited is a bug report")                      (cap_unreported on screen; TIER_/LEVEL_ messages when the server says)
stock is EVENTS                                          mutation arm asserts the +7 SELLER_SET history row
blank count is NOT zero                                  mutation arm clears the field, clicks, asserts the refusal
publish blockers are MESSAGES, all of them               mutation arm: REAL 409 (seed satisfies 4/9 readiness items)
                                                           renders readiness LABELS; planted 409 covers LEVEL_LIMIT
slug immutability (G1.9)                                 no rename control exists to lie; name PATCH only
media order: server order, 5/1 stated, upload owed       Media renders position order; upload registered D-219
```

**The adversarial pass (D-221) and what it taught.** Two agents, single-writer
discipline held. Theme, in its own words: THE HAPPY PATH WAS BUILT AGAINST THE
SPEC, THE ERROR PATH WAS BUILT AGAINST NOTHING, AND THE E2E ONLY WALKED THE
HAPPY PATH. 4 BLOCKERs, 7 MAJORs, all fixed in-phase (that is finishing, S0.1):
reorder had never once succeeded against the real API (body shape, B1); mutation
failures rendered nothing (B2/B3); `Number('') === 0` zeroed live stock (B4);
per-click idempotency keys on calls S8 says carry none (M1); a 403 rendered a
dead shell (M2); SC-11's route did not exist while a comment said it did (M4);
blockers rendered raw codes with publish still enabled (M5); D-218's "named on
screen" was false for three of five regions (M6); no price was editable (M7).
**B5 arrived after the pass, caught by the new arm's own first run:** create
navigated to `/products/undefined` because the screen read `created.id` where
the server returns `{product_id}` -- the arm existing is the point. The first
REAL 409 then showed five different blockers rendering five identical generic
sentences; the distinguishing fact is `slots.item`, SC-01's own vocabulary, so
`ITEM_LABEL` moved to `lib/readiness.ts` (one mapping, no stale copy) and
blockers render as readiness labels.

## S5 -- the ten standing rules

None broken. The two that were bent by the first draft -- keys minted per click
(the mount rule), and NO_PERMISSION rendering chrome -- were pass findings,
fixed before merge, recorded in D-221.

## D-155 -- screens that infer what a seller may do

Each inference registered, the debt being the point: **D-218** (five absent
regions, each NAMED on screen -- amended in place on the branch when the pass
proved three were named only in comments), **D-219** (the upload pipeline:
client-resize, three renditions -- built against absence, stated on screen).
The three contract items v1.2 S17 lists as owed are the founder's (bucket, the
couriers endpoint, allowed_actions) and were built against their absence.

## Copy

64 `console.catalogue.*` en keys; am at machine-placeholder parity (the compile
gate holds; quality deliberately not attempted, S6). MT-KEYS regenerated same
commits (`pnpm verify:mt-keys` PASS; HUMAN-REQUIRED unchanged at 2).

## Browser and gates

`pnpm verify:console-e2e`: **26 passed** -- renders of SC-07/08/11 plus the
mutation arm (create -> refuse blanks -> variant -> stock -> confirm -> real
blocked publish) and the planted 409. Nothing is described as verified that a
browser did not draw. `pnpm ci:local`: **PASS all 25 gates** (one `test`-gate
flake mid-run matched D-217's signature and protocol: green in isolation, green
at --maxWorkers=2, green on re-run). API tests 507/507.

## Register

D-218 (amended), D-219, D-220, D-221, D-222.

## Parked -- long by design

- The cap counter's number and the D-155 family (allowed_actions, bucket,
  couriers) -- founder's contract items.
- Variant labels (size/colour naming), stock confidence level, structured
  attributes -- server shapes do not carry them; named on screen.
- The upload pipeline (D-219). Media reorder e2e (the seed carries no images;
  seeding fakes was not worth distorting the seed for one drag).
- Which of the twelve states a LOAD-time 400 renders (S3.4 defines VALIDATION
  as field errors; a hand-mangled product URL currently renders an empty main).
- v1.15 S0's "109 tables" line; ADU-API-01's two idempotency markers -- both
  the founder's, at the next reissue of each.
- D-208 / D-216.4 service halves (backend, out of scope, D-220).
- **C-6, C-7, C-8: not started.** Their traps are in the order, unconsumed.

## State of main

`main` = **3e87574** (all of T13 + T14 A/B). PR **#52** carries the install and
all of C-5 (`tier14c/t14c-install-docs`, head `fd690d7`), unmerged, pass
remediated, 25 gates green on the branch.
