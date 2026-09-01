# WORK ORDER T14-C REPORT

**The Rest of the Console.** COMPLETE. The install is audited; C-5, C-6, C-7
and C-8 are each built, adversarially passed, remediated, and proven in a
browser -- four stages, four PRs, a pass before every merge. Every claim that
asserts verification names its command. `State of main` is a ref.

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

## S3 -- C-6 (groups F and G)

**Screens:** SC-17..19, SC-22, SC-23 (`features/store/`); SC-24..SC-29
(`features/admin/`); the More menu and the desktop sidebar's expanded groups
(S2.1/S2.3 -- names followed over the table's stale v1.0 numbers, D-224.11).
271 locale keys; am at placeholder parity; MT-KEYS' true count 594 after
D-223 exposed the generator's single-quote blindness (64 merged C-5 keys had
been invisible to the translation work list with the gate equally blind).

**The traps, each drawn by a browser** (`pnpm verify:console-e2e`, 42/42):

```
StepUpModal opens on the guard and RETRIES once      payout change: real modal, real dev-SMS code,
                                                       verify, retry -> the seed's deterministic 24h
                                                       NEW-DEVICE lock renders as a message
                                                     team invite: same pipeline -> real 409
                                                       TIER_LIMIT_REACHED past the key gate
R21  cancel ABSENT with no pending row (real)        both peers render beside a planted pending row
R27  weekly pattern / closure DATES, separate        duplicate date refused; sub-hour window refused
                                                       in words (was a permanent retryable 500, D-225)
R22  locked category OUTSIDE the group, reasoned     payments toggles off FOR REAL, consequence at the
                                                       moment of choice, reload reads the row back
R24  as-of + no-auto-refresh                         Re-check REMOVED: the wire cannot re-fetch
                                                       (already:true short-circuit) -- owed, not faked
R26  representative-as-a-person                      on SC-17 and SC-22, asserted
G1.1 NO identity-check control                       the endpoint is operator-only; region asserted empty
G1.3 blockers as messages, closure survives          seed's real obligations; close -> reopen driven
G1.6 transfer to an ACTIVE ADMIN MEMBERSHIP id       residual_role reachable; items[] blockers render
```

**Built against absence, named on screen (D-224, thirteen items):** profile
and weekly availability are WRITE-ONLY by the API's own shape; social
accounts unlistable (follower count exists once, in the verify response);
courier rows carry no name/assignments/activity/account_id; remembered
devices unlistable apart; the payout lock is discovered on the attempt; five
notification categories have no sender; team has no pending state; SC-22's
KYC prose and SC-25's "no product rules" note are stale against G1.1/G1.6
(later founder documents govern); S2.3's numbering; the closures upsert.

**The pass (D-225).** Two agents, single-writer held. Five BLOCKERs -- three
mutations that could NEVER succeed (no Idempotency-Key on team, transfer,
deletion -- a seller spent a real step-up SMS and 400'd every time), a
sub-hour window rendered as a permanent retryable 500 (the database's
one-hour floor transcribed nowhere), Re-check erasing the count it promised
to refresh -- plus the error-path family: refetch failures silent on five
screens and form-destroying on two, request ids absent from TRANSPORT_ERROR,
items[] dropped, reason-less 409 sentences, pagination caps silent, a failed
fetch rendering the success-empty state, deletion success rendering nothing.
ALL FIXED in-phase; the e2e gained seven arms including the two that prove
the key fixes against the real server. The C-5 lesson held its shape: the
three broken mutations were exactly the three the e2e had left undriven.

## S3 -- C-7 (groups D and E plus SC-30)

**Screens:** SC-12..16 (`features/trust/`), SC-20/21 (`features/conversation/`),
SC-30 (`features/notifications/`); the shell bell became a LINK to SC-30.
~120 locale keys; MT-KEYS 710.

**The wire disagreed with the wireframe more than anywhere yet (D-226):**
GET /v1/seller/level and POST analytics/export DO NOT EXIST (SC-13 renders
its two wire-free sentences -- level is computed, level is independent of
tier -- plus the named absence; no number invented); analytics accepts NO
date parameters (the work order's 90-day picker is owed to the wire, the
fixed 30-day window said in words); the seller conversation row is FOUR
FIELDS (no buyer name, preview, unread marker, order link or unanswered
filter -- the D-153 asymmetry, each named in one on-screen sentence).

**The traps** (50/50 `pnpm verify:console-e2e`): reviews read-only -- the
forbidden list IS the design, zero controls asserted; claims respond-only,
the empty list good news with NO action; D-73's anchor rides the MESSAGE --
the pin derives from what the thread said, proven by a real order-anchored
buyer message; SC-30's read state is the server's read_at (why it syncs with
the Companion), driven against the real NEW_DEVICE_SIGNIN row the harness's
own sign-in mints; polling 30s, paused when hidden.

**The pass (D-227).** One BLOCKER of a NEW class: SC-16's evidence labels
were written from memory against enum values that do not exist, and the e2e
plant COPIED THE FICTION -- green against invented data. The map is rebuilt
verbatim from core.claim_evidence_kind, the plant derived from the DDL and
the service SELECT, and the lesson joins D-221's: a vocabulary is
transcribed, never recalled, and a plant derives from the server, never the
component. Also fixed: the poll-vs-send race (generation counter), the
50-message silent truncation, the false 30-day sentence, S14's forbidden
empty-state action (which the e2e had certified), claims reachable only by
typed URL, the blank VALIDATION main (closing D-225's parked question), and
the vocabulary class twice more (claim states, review badges). One API
defect PARKED and recorded: the notifications seller-scope predicate hides
ownership-transfer/stock/trial notices from the seller and leaks them into
the buyer feed (D-227 S1).

The e2e's centrepiece: a REAL two-sided conversation -- the seeded buyer on
an explicitly cookie-free context writes through the buyer wire (console
Origin presented); the seller console reads, sees the pin, and replies
through its own wire, past the key gate.

## S3 -- C-8 (SC-C1, the courier)

**One screen for a different user** (`courier/CourierScreen.tsx`): no shell,
no seller navigation, its own route tree, mobile single-column. The list IS
the assignments (row-level security on the per-request actor role); the
detail carries the buyer's phone and -- ONLY once custody is accepted -- the
QR, with the server as R25's enforcement: before custody the payload is
ABSENT FROM THE WIRE, and the e2e asserts that at the wire, not the DOM.
The D-156 interim QR encoding moved to `lib/qr.tsx` -- SC-C1 renders the
SAME payload as SC-06, one function, one line to change when the format is
ruled. The who-scans sentence renders under the code.

**The e2e drives the whole chain for real** (`courier.spec.ts`): the EMPTY
teach before anything exists, the seller invites the seeded buyer's phone
(immediate claim, G1.8's one shape), assigns the confirmed order, the
courier reloads into the row -- order REFERENCE shown -- accepts custody
(Event A, a real runIdempotent POST), the QR renders, and the post-custody
wire read asserts the payload's order_ref. The revoke cleanup is asserted,
leaving the world as found. The buyer identity signs in ONCE per run
(globalSetup) -- the OTP budget is per phone, and two specs minting their
own codes rediscovered D-124's class.

**The pass (folded into D-228):** the order reference was missing (two
orders from one store indistinguishable at a doorway); the screen never
refetched (an ended assignment lingered as banner-over-stale); expires_at
rendered as a stale deadline (the reservation clock is stopped for every
state a courier holds -- removed); no path led to /courier (the Chooser
links it). All fixed. Parked, API-side: the custody insert's missing unique
arbiter and state gate, the courier list's uncursored LIMIT 50, the
degenerate courier-is-the-buyer fixture, and the absent buyer-name/pickup/
note joins.

## S5 -- the ten standing rules

None broken across either stage. At C-5, the two bent by the first draft -- keys minted per click
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

`pnpm verify:console-e2e`: **51 passed** (all four stages) -- C-5's renders and mutation arm
(create -> refuse blanks -> variant -> stock -> confirm -> real blocked
publish, plus the planted 409) and C-6's fifteen (real fulfilment save with
read-back, real closure round-trip, real courier invite/revoke, real
notification PATCH with read-back, the full step-up pipeline twice, the
one-hour refusal, the 503 degradation with request id, and the planted R21 /
seats halves). Nothing is described as verified that a browser did not draw.
`pnpm ci:local`: **PASS all 25 gates** (one `test`-gate flake matched D-217's
signature and protocol: green in isolation, green at --maxWorkers=2, green on
re-run). API tests 507/507.

## Register

D-218 (amended), D-219, D-220, D-221, D-222, D-223, D-224, D-225, D-226, D-227, D-228.

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
- C-6's API-side debts (D-225): the zod one-hour refine + 23514 translator
  row; courier account_id; the purchase-intent reference on the GET; a
  seller-status read; core.category rows and display names; per-field anchor
  links from slots.path; SC-26/SC-27 mutation arms (need a billing seed).
- C-7's API-side debts (D-226/D-227): GET /v1/seller/level (and history);
  analytics date parameters and export; the conversation row's buyer-name/
  preview/unread/order fields and unanswered filter; the notifications
  seller-scope predicate (D-227 S1 -- transfer/stock/trial notices hidden
  from the seller, leaked to the buyer feed); a chatbot-entitled seed for
  BOT-render e2e; a poll-pause harness technique; Home's obligation
  surfacing (claims) with the daily brief.
- C-8's API-side debts (D-228): the custody-transfer unique arbiter and a
  state gate on Event A; a cursor on the courier list; the buyer-name/
  pickup/handoff-note joins on the courier read; a third seeded account so
  the courier-buyer fixture stops being degenerate; a roles[] read so the
  courier link can gate.

## State of main

`main` = **20eda5e** at C-8's branch point (everything through C-7 merged,
25 gates green). C-8 rides `tier14c/c8-courier` -- pass remediated, 51/51
e2e and 25/25 gates on the branch -- and merges as the order's last stage.
