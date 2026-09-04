# T22 REPORT - The Instruments, Then the Design

**Order:** T22 - "The Instruments, Then the Design"
**Documents installed:** ADU-AUTH-01 **v2.8**
**Phases 1-4 complete. Phase 5 part done, and this says which part.**

---

## The answer first

**Both instruments now read.** `boot-smoke` was red on `main` because it replayed
a production origin at a localhost bundle -- **the console boots, and the gate
said so on the line above its own failure.** The suite's one-run-in-three flake
had a shared resource nobody had named; it is named, bounded, and eight
assertions have stopped reading other suites' rows.

**And D-261 is diagnosed after three orders**, by instrumentation rather than by
a fourth guess. The forensics printed the answer on the first reproduction: the
notification row **was written**, fourteen milliseconds "before" an instant the
test had captured a moment earlier. The test was comparing a Postgres timestamp
to a JavaScript one.

**Three findings this order did not go looking for**, each the same shape -- a
value described in one place and rendered from another:

| | |
|---|---|
| **D-274** | The ASCII gate governed **two superseded revisions**. It was enforcing ASCII on documents nobody reads and not on the documents that govern, and it printed PASS both times |
| **D-282** | D-261's arm compared a **server** clock to a **client** clock, and had done since Tier 6 |
| **D-285** | The console rendered a **3px** focus ring while the token said 2px. It never once read the focus token -- which made T21's dark-mode fix to that token **inert** |

**Phase 5 is part done.** The precondition S5.1 sets is complete and proven; the
eleven-component port is not started, and not started halfway, for the reason
S5's own ruling gives.

---

```
WORK ORDER T22 REPORT

Phase 1  v2.8 installed, authority docs advanced: YES
           docs/amendments/README.md (row AND the split block, which had said
           "-> v2.6" through the whole of v2.7's life), DOCUMENT_AUTHORITY.md
           (which every skill says to read FIRST and which still answered
           "ADU-API-01 v1.10 governs"), apps/api/CLAUDE.md, apps/console/CLAUDE.md
           (also stale at ADU-CON-02 v3.1), and the ASCII gate's governed list.
           v2.7 and API v1.10 moved to docs/superseded/. v2.6 and v2.5 STAY:
           a document is governed if it GOVERNS or if A GATE PARSES IT.
           D-268 is CLOSED -- v2.8 withdraws the sentence T21 shipped against.

         all 21 jobs probed as their own role: 21 pass, 0 fail
           jest test/e2-e6.jobs.spec.ts -t "every scheduled job RUNS"
           Nothing found. The probe is the deliverable, not the result: it
           iterates SCHEDULED_JOBS, so a job added tomorrow is probed tomorrow.
           Proven to FIRE by revoking 0049's grant -- it reports, by name,
           "payout.activate_due: permission denied for table payout_details".
           [!] Its first form ran the jobs FOR REAL, which is twenty-one
           fleet-wide sweeps, and made Phase 3's flake FOUR TIMES WORSE
           (measured: 4 runs of 4 red). Now each job runs in a transaction that
           is always rolled back -- privileges are checked per statement, so the
           grant check is untouched and only the effect is discarded (D-278).

Phase 2  boot-smoke: THE GATE WAS WRONG. The artifact boots.
           PASS  #root mounted with 1 child element(s)     <- on the line above
           FAIL  CSP violation: connect-src <- localhost:3000/v1/bootstrap
           FAIL  CSP violation: connect-src <- localhost:3000/v1/auth/sessions
           PASS  the smoke break flag is compiled out
         fix: connect-src is the one RUNTIME directive in the policy, and the
           gate's own header has said since D-138 that it does not test it --
           it only ever passed because CI builds without VITE_API_BASE_URL, so
           apiBase() threw before fetch was reached. "A gate that quietly
           benefits from a misconfiguration it does not name." The
           misconfiguration stopped and the gate went red.
           Load-time directives still FAIL. connect-src is a NOTE.
           This is D-164 recurring in the sibling file: that entry fixed exactly
           this in e2e/serve.mjs ("THE CSP IS DERIVED, NOT REPLAYED") and
           boot-smoke never received the treatment -- which is why console-e2e
           passes against the identical dist while boot-smoke fails.
           What it was checking that it should not have been: connect-src.
           D-138's open ruling stays open; this is the honest interim answer.
           Also D-277: a sandboxed shell makes msedge exit 0 having fetched
           nothing, and the gate reported "the page never reached the probe" --
           which reads as a broken console and is a statement about the shell.
           A GATE'S FAILURE MESSAGE IS PART OF THE GATE.

Phase 3  D-273: ENVIRONMENTAL, and the shared resource is ONE DATABASE
           `adulis` on the local container, one DATABASE_URL, every jest worker,
           NO per-worker database, schema or transactional isolation.
           BOUNDED, measured not supposed: 40 spec files; cpus=20 so jest's
           default is 19 workers; max_connections=100; per-suite ceiling
           10+4+admin -- so 19 workers can demand up to 304 connections against
           100. That is D-217's "connections" clause, quantified.
           A fourth candidate is DEAD: the IP limiter was deleted, not tuned, so
           any explanation citing otp-request-ip cites a control that no longer
           exists. The OTP daily budget IS a live shared counter but was NOT
           this: measured at 113 of a 1000 ceiling.
         protocol run: isolation t6 8/8, t12-d89 6/6, c4 20/20, e2-e6 24/24
                       maxWorkers=2 565/565, 43/43 suites
                       re-run THIRTEEN consecutive: TWELVE green at 565/565
           BEFORE one run in three, a DIFFERENT test each time.
           AFTER  one run in thirteen, always the SAME test -- then diagnosed
                  and fixed in Phase 4, after which nine consecutive greens.
         the fix is D-83's EXISTING rule, violated in eight new places:
           "no test asserts a global count ... assert your own row is gone;
            assert theirs is not."
           reads   t6-ownership-transfer x3, e2-e6's payout_credential pair,
                   c4's notification delta, migration-04-05's access_log count
           sweeps  c2's table-wide social_post orphan sweep, c1's table-wide
                   person sweep, c6's media_lifecycle purge by reason
           NOT changed, and measurement is why: the counts over immutable
           reference data ARE the assertion; and jobs.worker_heartbeat's
           count(*)=1 reads like a global count and is not one -- that table is
           ONE ROW BY CONSTRUCTION.
           The one fully established mechanism, with the colliding line:
           c8-analytics-public inserts OWNERSHIP_TRANSFER_REQUESTED for its own
           owner and holds it until its afterAll; t6 selected EVERY row of that
           template and compared the set to two of its own account ids.

Phase 4  products list carries a card key: YES
           jest test/c2-catalogue.e2e.spec.ts (asserts image_key on every row)
           TRANSCRIBED, not designed -- the storefront already ran this exact
           correlated subquery. Card derivative only. The field is `image_key`,
           NOT `image_url`: the API returns bare keys, bootstrap owns the
           origin, and `*_url` is one of the tokens Appendix C check 1 polices.
         storefront list too: ALREADY HAD IT. Checked before adding, as asked.
         effective limit returned with which side binds: YES
           jest test/c2-catalogue.e2e.spec.ts -- cap 2, binding LEVEL, level NEW
           fn_effective_limit computed the intersection with least() and THREW
           BOTH OPERANDS AWAY one line after reading them, and no HTTP endpoint
           called it for PRODUCT_COUNT at all. Migration 0050 returns tier_cap,
           level_cap, binding, level beside an UNCHANGED cap -- additive, so
           fn_publish_product is untouched and CREATE OR REPLACE preserved owner
           and grants (verified). level_cap is read from the ladder subselect
           DIRECTLY, because least() IGNORES NULLS and deriving the operands
           from the result would inherit that hole.
           All four bindings proven in a rolled-back transaction.
           `resolved` is carried separately: the fail-closed branches must not
           be rendered as "no cap is in force", which is the opposite.

Phase 5  variables -> tokens, both modes, tokens gate green:
           node ops/scripts/verify-tokens.mjs   PASS, both modes, both directions
           VERIFICATION, NOT MIGRATION. T21 ruled that Figma imports
           packages/tokens and never invents a parallel set, so there was
           nothing to bring back; the one value the design needed that the
           tokens lacked (focusDark) landed in T21 S2 and is merged.
           AND THE CONSOLE NOW ACTUALLY READS ONE (D-285) -- see below.
         components ported: 0/11   ScreenState treatments: 0/12
         screens ported: NONE
         the six rules asserted in BOTH modes after the port: DONE, and BEFORE
           any port, because a guard added afterwards proves nothing:
           1 equal decisions  computed-style equality on both buttons, plus
                              bounding-box height. Fires on a primary variant
           2 verify sentence  visible, verbatim, and provably not inside a
                              <details> -- toBeVisible alone passes for an OPEN
                              one the next seller finds closed
           3 handoff disabled region visible, data-gated=true, [data-gate=R20]
           4 no colour alone  every [data-badge] carries a WORD; every readiness
                              row says its state in words   <- HAD NO TEST
           5 focus ring       appears on Tab, NOT on a mouse click. Both halves
                                                              <- HAD NO TEST
           6 three clocks     the third is an ABSENT region, on list and detail
           pnpm verify:console-e2e   83 passed, 11 of them in DARK, exit 0
           Until T22 not one test in this suite ran in dark mode.
         SC-07 grid renders real photographs: NOT PROVEN IN A BROWSER.
           The wire carries image_key (asserted in c2) and the row renders the
           tile, but the seeded products have no images, so the browser shows
           the placeholder. Honest: the data path is proven, the picture is not.
         cap counter shows a number and names which limit: SPLIT.
           jest test/c2-catalogue.e2e.spec.ts proves the NUMBER and the BINDING
           on the wire (2 / LEVEL / NEW). The BROWSER proves the region renders,
           names a binding, and never prints "unlimited" -- but reaches only the
           fail-closed branch, because the seed seller has no subscription
           (D-284, registered not fixed: adding one works and breaks SC-26,
           whose e2e is titled "honest about having none").

Gates    27 of 28 verified green; boot-smoke FIXED and now 28.
           pnpm ci:local gates 01-21 green in one run (Phase 1)
           pnpm verify:boot-smoke      exit 0 on a clean build AND a configured
                                       one -- deterministic, same reason
           appendix, orphan-sweep, transcription, surface-markers, tokens,
           permission-doc, deferred-values, docs-ascii, mt-keys, contract-current
                                       all PASS individually
         API tests  pnpm --filter @adulis/api test   566 passed
                    nine consecutive full runs green after the D-261 fix
         e2e        pnpm verify:console-e2e          83 passed (11 dark)
         db:check   16 PASS, 0 FAIL      db:determinism  PASS, 11667 lines

Register 14 new -- BLOCKERs first
           D-274  MAJOR   the ASCII gate governed two superseded revisions, and
                          the manifest disagreed with itself. FIXED + comparator
           D-282  MAJOR   D-261 DIAGNOSED: a server timestamp compared to a
                          client one. FIXED. Discharges D-261, D-266, D-279
           D-285  MAJOR   two focus-ring rules; the token's lost. FIXED
           D-286  MAJOR   three rules held by absence, none tested in dark. FIXED
           D-283  MAJOR   fn_effective_limit discarded both operands. FIXED
           D-276  MAJOR   boot-smoke replayed a production origin. FIXED
           D-278  MAJOR   the probe I added made D-273 four times worse. FIXED
           D-268  CLOSED  discharged by v2.8
           D-273  RESOLVED as far as evidence allows
           D-275  MINOR   the D-47 probe restored, self-extending. Found nothing
           D-277  MINOR   the gate could not tell a dead browser from a dead app
           D-281  MINOR   two workers raced to unlink one file
           D-284  MINOR   registered NOT fixed -- the seed seller has no
                          subscription. Needs a ruling
           D-287  INFO    Phase 5 is part done, and which part
           D-279 and D-280 are recorded under Phase 3 and discharged/reported.

State of main: dfb3f3b (PR #88, #89, #90, #91, #92) -- ALL FIVE UNMERGED.
           A STACK, each based on the one before, so each diff is its phase:
             #88 t22-p1-auth-v2-8      -> main
             #89 t22-p2-boot-smoke     -> p1
             #90 t22-p3-d273           -> p2
             #91 t22-p4-api-gaps       -> p3
             #92 t22-p5-design-port    -> p4
           T21's #86 and #87 are merged; main is at their merge.
```

---

## The three findings, and why they are one finding

**A value described in one place and rendered from another.** That is D-274,
D-282 and D-285, and none of them was what this order set out to do.

**D-274** -- the ASCII gate's `GOVERNED` list is a hand-maintained transcription
of "which revision governs", and nothing compared it to the directory. Two
entries had gone stale at T20 and the gate printed PASS both times, because the
superseded files were still on disk and still ASCII. **The check ran; it just ran
on the wrong document.** The durable half is the comparator: every governed path
must exist, must not be under `superseded/`, and a governed family must be
governed at its **newest installed revision**. Proven by planting T20's exact
mistake.

**D-282** -- `scheduled_for` defaults to `now()`, which is transaction start, on
Postgres's clock. The test compared it to `new Date()`. The margin is two
machines' clocks plus the width of a transaction, and under nineteen workers it
is not always positive. **D-261 called it clock skew and could not measure it;
D-266 measured the clocks properly and correctly declined to conclude from that.
Both were looking at the right thing.** What neither had was the failing row's
own timestamp printed beside the value it was compared against -- which is the
entire argument for instrumenting a flake instead of guessing at it again.

**D-285** -- the console declared its own `:focus-visible` at 3px while the token
declared 2px, and because the token's rule is written `:where(...)` at
specificity zero, **the console's always won.** So T21's D-271 -- giving the ring
a dark value, because a 2px `#1e40af` ring on a `#14120f` page is the colour of
the ground it sits on -- was correct, was gated, and bought the console nothing.

**All three were invisible to gates that were passing.** D-274's gate compared
two files that agreed with each other; D-285's compared `index.ts` to
`tokens.css`, which also agreed. What no gate did was ask what the browser
actually painted, or whether the document being checked was the document that
governs.

---

## What was NOT done

- **Phase 5 steps 2, 3 and 4** -- eleven components, twelve ScreenState
  treatments, five screen layouts. **Not started halfway**, for the reason S5's
  own ruling gives: six components out of eleven leaves the console in two
  design systems at once, and the inconsistency is what a seller notices.
  D-287 records the measured shape of that work -- three real swaps and eight
  extractions, with Button and Input **last** because they are element selectors
  today and every unmigrated control would lose its 44px target otherwise.
- **D-284 is registered, not fixed** -- the seed seller has no subscription, so
  the seeded console reaches only the fail-closed limit. Adding one works and
  breaks two screens seeded to demonstrate the opposite.
- **SC-07's grid is not proven in a browser** -- the wire is asserted, the seeded
  products have no photographs.
- The three founder-owned engines, the other twenty-five screens' design,
  Amharic quality, passkeys, social OAuth, the operator surface, mobile,
  `ops/render.yaml`, and the remaining gap sentences.

## What needs you

1. **Merge the stack in order** -- #88, #89, #90, #91, #92. Each is based on the
   one before, so a merge out of order will conflict on `DEFECT-REGISTER.md`.
2. **D-284** -- should the seed carry a BETA subscription? It makes SC-07 show
   ADU-CON-03 S8's model sentence and breaks SC-26's "honest about having none".
   A fixture question with a product answer.
3. **D-138** -- does `boot-smoke` assert `connect-src` at all, or does that
   belong to the console harness owed at C-3? Still open; Phase 2 is the interim
   answer, not the ruling.
4. **D-280** -- `--maxWorkers=2` runs the API suite in 17s against the default's
   34-39s. Four reports have cited the cap as the slow-but-safe fallback at an
   assumed 6-20x cost. It is roughly twice as **fast**. Not adopted, because a
   cap hides the class rather than fixing it -- but the number is now measured.
