# WORK ORDER T12 REPORT -- The Ledger Hole, Then Authentication

Every claim names its instrument. One load-bearing absence shaped this order's
execution and is stated first.

> **ADU-AUTH-01 v2.6 IS NOT IN THE REPOSITORY (D-176).** docs/ holds v2.5;
> docs/amendments/ holds the v2.4 seed and the README; nothing arrived with
> the order. Phases 2, 3 and 4 transcribe sections of v2.6 -- the order names
> three of S12.2's six delivery-status values and cites the rest by number.
> "Transcribe, do not design": a schema built from fragments becomes the
> binding shape the real document then has to match. **Phases 2-4 are stopped
> at MISSING_SOURCE**, exactly as T9 stopped (D-140). Phases 0, 1 and 5 do
> not need the document and are DONE; Phase 5's two rulings are stated in
> full in the order's own text and were built under founder-ruling authority
> with the unreissued-document debt recorded (D-177, D-178).

```
Phase 0  #41 #42 merged: YES (both fast-forward -- each branch already
         carried main). deleted lines, register and gates.mjs: 0 and 0,
         verified against the pre-merge ref (git diff 3e142ca).
         pnpm ci:local on merged main: PASS all 24 gates.

Phase 1  release derives from stock_event:
           migration 0042 (fn_release_reservation_stock; fn_cancel_line and
           fn_reject_payment re-created with bodies EXTRACTED VERBATIM from
           0021 -- programmatically, so transcription cannot drift -- and
           only the release block swapped; e1-clock's expiry release
           converted in the same commit)
           cmd: pnpm --filter @adulis/api test -- t12-d173  -> 3 passed
         reservation without ORDER_CREATED fails and creates no stock:
           arm 2 asserts all three clauses -- raises naming D-173, writes
           nothing, and the line stays ACTIVE (an aborted cancellation must
           not half-cancel)
         deferred-trigger cost against the 300-concurrent load test: PARKED
           per the order's own S1 -- the measurement needs the A1 S6.1 rig
           (ops/load/db-loads.mjs); stock_drift: 0 in db:reset holds the line

         ADVERSARIAL PASS ON #43 (24 agents): 8 findings, 8 upheld, 0
         refuted. All addressed pre-merge, each with a red-green proof:
           BLOCKER  the expiry sweep had NO per-order containment -- the new
                    loud failure would front ORDER BY expires_at and halt
                    expiry platform-wide, while the code's own comment
                    claimed containment. Both e1-clock loops now try/catch
                    per order and count failures into the job result;
                    pinned by a poisoned-order-FIRST test:
                    {considered:2, expired:1, failed:1}, healthy order
                    expires, no invented stock.
           MAJOR    non-positive derived quantity now refuses by name (a
                    positive-delta reserving row was a silent DECREMENT).
           MAJOR    MUTATION-CONFIRMED VACUITY: the fixture's row and ledger
                    agreed, so a row-derivation implementation passed 3/3.
                    The row now LIES (quantity 5, event -3); the mutation
                    re-applied PROVENLY (prosrc checked in force) fails
                    "Expected: 10, Received: 12"; restored provenly, green.
           (e1)     the fixture's reserving event moved outside the replica
                    window so the decrement trigger actually fires.
           MINOR    p_reason validated against the two release reasons.

Phase 2  MISSING_SOURCE (D-176). migration/new tables/new enums: none built.
         events in S30 absent from the catalogue: cannot be diffed -- S30 is
         in the absent document. APPENDIX content: none generated; nothing
         changed the schema, verify:appendix stayed green throughout.

Phase 3  MISSING_SOURCE (D-176). v2.6 not installed; amendments/README
         untouched; verify:permission-doc: PASS (nothing moved).

Phase 4  MISSING_SOURCE (D-176). No delivery table exists to build against;
         building it from three named values of a six-value enum is design,
         not transcription. Nothing built.

Phase 5  AGE_DECLARATION_REQUIRED returned and rendered:
           pnpm --filter @adulis/api test -- t12-d101  -> 3 passed
           (new phone, no declaration -> 400 AGE_DECLARATION_REQUIRED with
           the derived title_key and NO account row; with -> account created,
           confirmation + timestamp stored; EXISTING account without -> 200,
           because the requirement is identity-creation only -- the oracle
           half). c6's old expectation of the bare VALIDATION_FAILED updated:
           that is the ruling landing, not a regression.
         checkbox unconditional, never pre-checked, cleared on change-number:
           e2e/age-declaration.spec.ts inside NODE_ENV=test
           pnpm verify:console-e2e -> 21 passed. Runs signed-out on the
           seeded BUYER phone (its own OTP bucket; two REQUESTS, no verify;
           db:reset clears buckets per gate run, so D-124 cannot accumulate).
           The control shows for a phone that HAS an account -- the console
           must not know which case it is in (S17).
         courier claim idempotent, phone-matched, response identical:
           pnpm --filter @adulis/api test -- t12-d89  -> 4 passed
           (claim-ALL atomically -- two sellers, one phone, two relationships
           in the sign-in's own transaction; second sign-in changes nothing;
           revoked invite untouched; and the ORACLE test: invited and
           uninvited sign-ins identical in status and response shape).
           One WITH ... RETURNING ... INSERT ... ON CONFLICT DO NOTHING
           statement in verifySignIn, both account branches.

Gates    24 gates: pnpm ci:local -> PASS all 24 (on main post-#43, and on
           the Phase 5 branch)
         API tests: pnpm --filter @adulis/api test -> 472 passed, 39 suites
         e2e: NODE_ENV=test pnpm verify:console-e2e -> 21 passed, identity
           verified (build id + boot marker + derived CSP)
         db:check: pnpm db:check -> PASS (sixteen checks)
         db:determinism -> PASS (11305 lines compared)

Register 5 new -- D-175 (Phase 1, ruled+discharged, carries the pass record),
         D-176 (MISSING_SOURCE, the BLOCKER for 2-4), D-177 (D-101 settled),
         D-178 (D-89 settled), D-179 (two test-suite conventions found the
         hard way: a LIVE fixture market captures other suites' devices and
         accounts through bootstrap -- fixture markets are non-live and
         teardown scopes by phone; and the session->challenge /
         notification->account FK ordering).

Parked   ADU-AUTH-01 v2.6's arrival unblocks Phases 2-4 (needs: the document)
         D-173's deferred constraint trigger (needs: the A1 S6.1 load
           measurement)
         D-153 buyer name - D-154 orders filter - D-155 allowed_actions -
           D-156 QR serialisation - D-157 courier account ids (all carried,
           all still open)
         The api-side identity asymmetry the order names in S6: recorded,
           not urgent (the API suite runs in-process against a database it
           provisions).

State of main: 05c7649 (PR #43 merged) -- unmerged: the Phase 5 PR
         (tier12/t12-p5-auth-findings: D-177/D-178/D-179 + D-176's record),
         adversarial pass pending before its merge.
```

## The sentence worth keeping

Phase 1's pass refuted nothing -- eight findings, eight upheld -- and the
worst of them was the order's own warning made real: **a wrong fix that looks
exactly like a right one** (a suite whose fixture agreed with both
implementations), caught by mutation, fixed by making the fixture lie. The
instrument discipline from T11 held: every plant, mutation and restore in
this order was proven in force before its result was read.
