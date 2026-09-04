# T21 REPORT - Draw It

**Order:** T21 - "Draw It"
**Gates:** 27 of 28 verified green. `boot-smoke` fails identically on unmodified `main`.
**Figma:** `FneEVVjS5zjOA03NrVu4Rs` - write access verified before anything was drawn.

---

## The answer first

**Both segments are done, and the small one was not small.**

S1 was ruled as one line to delete. Deleting it exposed that
**`payout.activate_due` has never activated anything** -- the job T20 built to
bound the payout delay to twenty-four hours has been raising
`permission denied for table payout_details` on its first statement since the
day it shipped. It was invisible because the lazy call this order removes was
silently doing the work.

**Shipping the removal without migration 0049 would have meant payout changes
never activate at all**: a seller's new bank details sitting `PENDING` for ever
while the money kept going to the old account. Two defects each survivable
alone and fatal together, and the only reason the second one surfaced is that
the ruling forced a behavioural test to exist for the first time.

The design is drawn: **20 frames, 11 components, 69 variables, no colour
anywhere in the file that is not a variable.**

---

```
WORK ORDER T21 REPORT

S1        payout GET no longer activates:
            pnpm --filter @adulis/api test -- test/c4-financial.e2e.spec.ts
            arm "the GET does NOT activate a due change" -- PASSES, and goes RED
            when the deleted line is planted back (3 arms red, verified)

          a due change activates without any read:
            same command, arm "the JOB activates a due change with no read at
            all, as adulis_jobs" -- PASSES. Goes RED when 0049's grant is
            revoked (exactly 1 arm red, verified), which is how D-270 was found

          a failing GET rolls back nothing:
            same command, arm "a failing GET rolls back nothing, because there
            is nothing to roll back" -- PASSES. Forces a real raise INSIDE the
            handler transaction, after the point the activation used to occupy,
            by revoking SELECT on core.account_recovery_case for the length of
            the request

          screen still shows a due change as activating:
            pnpm verify:console-e2e -- PASS (real API, reset database, SC-24).
            Implemented as ADU-CON-03 S3.1 prescribes: display the deadline,
            REFETCH at zero, render what the server says. No thirteenth
            ScreenState, no ACTIVATING enum value, no client-side derivation

Figma     write access verified before drawing:
            one use_figma call created a 10x10 frame at (20000,20000), round-
            tripped it with getNodeByIdAsync, deleted it, and confirmed the id
            no longer resolves. Same call probed createPage and
            createVariableCollection and removed both. Nothing survived it.
            Result: writeAccess CONFIRMED, canCreatePage YES, canCreateVariable
            YES. whoami: Naod Solomon, tier pro, seat Full. D-262 is CLEARED

          file renamed, pages created:
            [!] THE FILE COULD NOT BE RENAMED. figma.root.name is not settable
            from the Plugin API -- "Setting the document name is currently not
            supported". It is a UI-only action and is the ONE thing in this
            order I could not do. It is a right-click in the Figma file
            browser. NOT faked, NOT worked around by creating a second file
            Pages: Cover | Foundations | Components | Screens - Desktop 1280 |
            Screens - Mobile 360

          variables: 38 colours, Light and Dark: YES
            "Adulis Color", modes Light + Dark: the 11-step neutral ramp
            (hidden, alias targets only) + 26 semantic roles + focus/ring-color
            "Adulis Scale", 1 mode: 31 mode-independent values -- a gap does
            not change with the theme
            69 total. Every one carries its var(--adu-*) code syntax; ZERO left
            at the ALL_SCOPES default

          every colour through a variable:
            audited in script across all five pages: every SOLID paint on every
            fill and stroke, checked for boundVariables.color.
            First run found 86 unbound in the dark screens alone --
            figma.createAutoLayout() returns a frame carrying an unbound WHITE
            fill, invisible on a white page and an opaque slab in dark. That is
            exactly the class the order names. 263 stripped across the file
            FINAL AUDIT: unboundPaints 0

          Auto Layout on every frame:
            same audit, counting FRAME nodes with children and layoutMode NONE
            FINAL AUDIT: nonAutoLayoutFrames 0

          components (11), each with the screen that needed it:
            Button (4 variants)        SC-00 sign in, SC-07 new product, every
                                       secondary and disabled control
            Payment Decision           SC-04 ONLY. One component for BOTH
                                       decisions, so neither can be the default
            Badge (5 tones)            SC-03 state badge, SC-04, SC-07 status,
                                       SC-01 obligations
            Input (4 states)           SC-00 phone and code. Focused carries
                                       the token ring
            Card                       SC-01 obligations, SC-04 regions
            List Row                   SC-03 order row
            Empty State                SC-03 and SC-07 empty lists
            Screen State (12 variants) every screen. The closed set of S3
            Nav / Top Bar              SC-01, SC-03, SC-04, SC-07
            Nav / Sidebar (>=1024)     the same four, desktop
            Nav / Bottom Bar (<1024)   the same four, mobile
            Nothing was built that no screen uses

          screens x2 modes x2 widths = 20 frames
            SC-00, SC-01, SC-03, SC-04, SC-07 at 1280 and 360, each Light and
            Dark. The dark ten are CLONES of the light ten with ONE property
            changed -- setExplicitVariableModeForCollection. No fill was
            re-picked by hand, which is what makes the mode switch a test
            rather than a claim

          the six rules, each held in both modes:
            1 equal decisions   one component, two instances, both FILL in the
                                same row. No variant exists to make one primary
            2 verify sentence   adjacent, above both buttons, never behind a
                                disclosure, warn-bordered. Verbatim
            3 handoff disabled  region rendered, four controls disabled, one
                                line saying what unlocks it. No display:none
            4 no colour alone   every badge carries its word; readiness rows
                                read "Done"/"To do"; the order state badge is
                                deliberately uncoloured, as in the console
            5 focus ring        2px at 2px offset, focus/ring-color, which
                                ALIASES the accent and so moves with the mode.
                                It had no dark value in the tokens until D-271
            6 three clocks      reservation window; confirmation window; and
                                the third is NOTHING -- stated in words on
                                SC-04 and drawn as an absent region on SC-03

          40%-longer string test: TWO things clipped, both fixed, retested clean
            Every string on all ten Light frames grown ~40% in whole words,
            then measured for overflow past its parent's inner box and past the
            frame itself.
            1280: SC-00's resend row overflowed 88px right -- a horizontal pair
                  that could not wrap. Fixed (wrap), retested 0
            360:  11 clips across SC-01, SC-04, SC-07 plus up to 53px spilling
                  past the 360 frame. TWO causes, both mine: text given the
                  FRAME width inside a parent that also has padding, so every
                  block sat 8px wider than its box; and dense rows that could
                  not wrap. 12 texts clamped, 52 rows allowed to wrap
            AFTER THE FIX, ALL TEN: clipped 0, spill 0, every frame GREW
            The 1280 slack hid what 360 could not. That is the whole value of
            running it before the Amharic pass rather than after

          values added to packages/tokens:
            focusDark { ringWidth, ringOffset, ringColor: colorDark.accent }
            focusModes { light, dark }
            and four rows added to verify-tokens.mjs's GROUPS so the gate can
            see focus, touchTarget and the two font stacks at all (D-272)
            PR #86, its own PR per the packages/* collision-surface rule

          tool calls used: 36 to the Figma MCP
            1 whoami, 1 skill index, 34 use_figma (2 of which errored:
            document rename unsupported, and FILL on an unparented component)

Gates     27 of 28 verified green.
            pnpm ci:local -- gates 01-21 green in one run (typecheck, lint,
              deps, deps-fires, contract-prefix, error-locale, build,
              extensions, migrate, worker-schema, test, determinism,
              permission-doc, docs-ascii, appendix-c, deferred-values,
              trust-before-open-signup, no-unsafe-eval, production-react,
              contract-current, mt-keys)
            gate 22 boot-smoke FAILS -- and fails identically on unmodified
              main (verified by stashing). Environmental on this machine, not
              this change
            the five gates after it, run individually: appendix,
              orphan-sweep, transcription, surface-markers, tokens -- all PASS
            API tests   pnpm --filter @adulis/api test   564 passed, 564 total
            e2e         pnpm verify:console-e2e          PASS

Register  6 new -- BLOCKERs first
            D-270  BLOCKER, FIXED. payout.activate_due could never run: the
                   grant it needed was not the grant it got
            D-268  BLOCKER, document debt. The ruling contradicts an installed
                   binding sentence (ADU-AUTH-01 v2.7 S20.1) that is not
                   reissued. Interim founder ruling, debt recorded
            D-273  MAJOR, pre-existing, NOT fixed. The api suite has a
                   cross-suite flake that reproduces on main, one run in three,
                   a different test each time
            D-271  MAJOR, FIXED. focus.ringColor had no dark value
            D-272  MAJOR, FIXED. verify:tokens could not have found D-271
            D-269  MINOR, registered not fixed. Ownership transfer still
                   activates on a read, and its stated reason no longer holds

State of main: 10c1567 (PR #86, PR #87) -- BOTH UNMERGED.
            #86 t21-tokens-focus-mode   packages/tokens + its gate. Its
                                          register entries (D-271, D-272) are
                                          in #87 with the rest, so the two PRs
                                          do not both edit DEFECT-REGISTER.md
                                          and collide on it
            #87 t21-s1-payout-activation  the ruling, migration 0049, the
                                          console, the register
            The Figma file is not a PR and is complete in the file itself.
```

---

## S1 - the ruling, and what obeying it uncovered

### The removal is one line; the reasoning is three

The order's first reason decides it: **a read that writes is the defect, not
the transaction it writes in.** Moving the activation to its own connection
fixes the rollback and leaves a `GET` whose side effect depends on whether
anyone opened a screen -- and a write outside the request's transaction cannot
be rolled back when the request *should* fail, which is the mirror of D-74.

`financial.service.ts:213` is gone. **Three comment blocks went stale with it**,
and all three are corrected rather than left to mislead: the job's own header
(which still said "the lazy path stays"), and `handler-transaction.ts`, where
payout was cited as the precedent **for** laziness and is now the
counter-example.

### The part that needed the founder, not an engineer

**ADU-AUTH-01 v2.7 S20.1 says, verbatim:** *"The lazy path stays -- it costs
nothing and makes the screen correct at the moment it is read."*

That is an installed, binding sentence, and this order rules the opposite. The
spec router returned `OPEN_DECISION` on exactly that ground before a line was
edited, which is what routing first is for. The router's own rule then supplies
the way through: *a founder instruction may authorise an interim ruling, but
record the exact source and the unreissued document debt.* Done, as **D-268**,
which is filed as a BLOCKER because a document that contradicts the code is a
trap for whoever reads it next and believes it.

**A reissue of S20.1 is owed.**

### D-270 - the job could never run

The order said: *test both arms.* Writing the first arm is what found it.

**No test in this repository had ever called `payoutActivateDue.run()`.** The
three that mention it assert that its *name* is registered and scheduled.
Registered and works are different claims that looked identical in the suite.
The first call raised:

```
permission denied for table payout_details
```

0022 granted `adulis_jobs` EXECUTE on the SECURITY DEFINER function. The job
does not start with that function -- it starts by **finding** the due sellers,
with a direct `SELECT` on `core.payout_details`, and that read sits outside the
per-seller `try/catch`, so **the sweep died whole rather than skipping a
seller.** Confirmed against the running database rather than inferred:

```
has_table_privilege('adulis_jobs','core.payout_details','SELECT')            false
has_function_privilege('adulis_jobs','core.fn_activate_due_payout(uuid)',..) true
```

**The grant it was given was real. It was the wrong one, and only by itself.**

The thing worth keeping from this: **the defect was masked by the defect.**
While the lazy call existed, payouts activated and nobody could tell the job was
dead. Removing one exposed the other, and removing one *without* fixing the
other would have shipped a console where payout changes never take effect.

Migration `0049` grants `SELECT`, and only `SELECT`: the job reads to find work
and hands the work to the definer function, which writes under its own rights.

### The console keeps the one thing the ruling keeps

The order said *"read the deadline and render it; let the job move the row."*
ADU-CON-03 S3.1 turns out to say the same thing as an INVARIANT:

> A countdown may *display* a server-supplied deadline; it may not *decide*
> anything when the countdown reaches zero -- **it refetches and shows what the
> server says.**

So SC-24 schedules a refetch **at** `activates_at`, then keeps asking while the
server still reports `PENDING`. What it does **not** do is invent a thirteenth
`ScreenState`, add an `ACTIVATING` value to a four-value enum, or derive the
state client-side -- all three of which S3's closed set forbids, and the second
of which would move `core.payout_state` and Appendix A with it. The due note is
**added** beside the server's own sentence, never substituted for it.

### The tests, and one that had to move

The old single arm drove activation **through** the GET -- and was also the only
producer of an `ACTIVE` payout row in the entire c4 file, so deleting it would
have taken order creation, evidence and reissue with it. Four arms replace it,
and three of them go red if the deleted line ever returns.

**The job's arm had to move off the fleet sweep.** `payout.activate_due` is
global; running it from c4 put a second suite's global sweep into a parallel
jest worker, which is D-83's registered flake, and it fired on demand. It now
runs against a sweep-only seller that nothing else in the file reads.

---

## S2 - the design

### What is in the file

**Cover** states the one rule the file exists to keep: `packages/tokens` is the
source of truth and Figma mirrors it. **Foundations** shows every colour role in
**both modes side by side** -- one variable rendered twice, not two sets of
colours -- plus the type scale, spacing, radius, the focus ring at its real
width and offset, and the 44px target. **Components** holds eleven, and nothing
that no screen uses. **Screens** holds twenty frames.

### The mode switch is a test, not a claim

The ten dark frames are **clones** of the ten light frames with exactly one
property changed. Nothing was recoloured. That is what makes them evidence: a
hard-coded fill is the only thing a mode switch cannot move, so anything wrong
in dark is a hard-coded fill by construction.

**It found 86 of them on the first try.** `figma.createAutoLayout()` returns a
frame carrying an unbound white fill; on a white page that is invisible, and in
dark mode it is an opaque slab. Every one of my layout containers had one.
263 were stripped across the file, and the final audit reports **zero unbound
paints and zero non-auto-layout frames.**

### The 40% test earned its place

Nothing clipped at 1280 except one row on SC-00. **At 360, eleven things
clipped**, and up to 53px spilled past the frame edge. Two causes, both mine:
text given the *frame* width inside a parent that also has padding, and dense
rows that could not wrap. Both fixed; all ten frames now grow rather than clip.

**The 1280 slack hid what 360 could not**, which is the argument for running the
test before the Amharic pass rather than after it.

### Where I did not do what the order asked

**SC-07 has no photo grid and no cap counter, and I did not draw either.**

The order expected photographs there -- "newly real since T20". They are real,
but they live on **SC-10 Media, a section of SC-08 Product editor**, not SC-07.
`GET /v1/seller/products` returns `id`, `name`, `visibility`, `base_price` and
`display_order` and **no image key**, so a thumbnail on a row would be a picture
with nothing behind it.

The cap counter is specified (ADU-CON-03 S8: *"N of M, and which limit binds"*)
and **not built**, because the list endpoint carries no effective-limit field and
*"8 of unlimited"* is the bug report that section explicitly warns about. The
console says so in a sentence today, and that sentence is what the frame shows.

**Drawing an invented counter would have put a number in a design no endpoint
can produce**, which is the prime rule's "never invent an answer" in its most
tempting form. Both gaps are labelled on the frame itself.

---

## What was NOT done

- **The file is still called `Untitled`.** The Plugin API cannot set a document
  name. It is a rename in the Figma UI and it is the only item in this order I
  could not complete.
- **No console screen was rebuilt to match the design.** Explicitly out of scope,
  and the temptation the order named.
- **D-273 is not fixed** -- a pre-existing cross-suite flake, registered with
  evidence because "one run in three, on main" is a fact and an intermittent red
  that nobody has characterised is how the seeded-market defect survived.
- **D-269 is not fixed** -- ownership transfer still activates on a read. It is
  not payout's twin: A1.1 requires the capability to be lost *on the next
  request*, which a five-minute sweep does not discharge.
- **`boot-smoke` is red** and red on main too. Not diagnosed; not mine.
- The three founder-owned engines, Amharic quality, the other twenty-five
  screens, passkeys, social OAuth, the operator surface, mobile,
  `ops/render.yaml`, and the remaining gap sentences.

## What needs you

1. **Rename the Figma file** from `Untitled`. One action, in the UI.
2. **Reissue ADU-AUTH-01 S20.1** (D-268). The code and the document disagree,
   deliberately, and only the register says so.
3. **D-269** - does A1.1's "on its next request" permit a job-plus-read hybrid
   for ownership transfer, or must that read keep activating?
