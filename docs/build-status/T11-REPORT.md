# WORK ORDER T11 REPORT -- Make the Harness True, Then Believe It

Unattended. Every claim below names its instrument; where a claim could not be
re-derived, it says so instead.

```
Phase 0  environment restored: YES
         port 5434 holder was: Docker's own port proxies (com.docker.backend.exe
         + wslrelay.exe) forwarding to the healthy adulis-postgres container.
         The failing state was ECONNREFUSED with Docker Desktop down -- an
         ABSENT listener, not a conflict; no unexplained process existed.

Phase 1  build id minted and asserted: NODE_ENV=test pnpm verify:console-e2e
         -- the gate mints per run, index.html carries data-build-id via
         Vite's HTML env replacement ('untagged' outside the harness), and
         e2e/00-identity.spec.ts asserts the SERVED page carries the minted
         id, then makes a real fetch to the API origin from the page's own
         context so a blocking CSP fails on test one with the refusal quoted.
         four plants, each proven red:
           stale server   -> port guard, named; AND with the guard bypassed
                             (E2E_REUSE_SERVER=1, wrong expected id):
                             "BUILD ID MISMATCH ... STALE OR FOREIGN SERVER",
                             both ids in the message
           dev bundle     -> NODE_ENV=development planted into the build env:
                             "the console build under test is a DEVELOPMENT
                             bundle (...) NODE_ENV leaked into the build"
           wrong CSP      -> derivation removed, PLANTED POLICY CONFIRMED ON
                             THE WIRE FIRST (curl of the served header), then:
                             "refused it as POLICY, not network: ... violates
                             connect-src 'self' https://api.adulis.example"
           NODE_ENV unset -> env -u NODE_ENV node ops/scripts/verify-console-
                             e2e.mjs: the D-142 guard, exit 2
         API identity: the rebuild + early-exit detection DO NOT SUFFICE --
         a stale listener makes the fresh child die on EADDRINUSE and
         everything after is theatre. Decided and built: the gate mints a
         boot marker, passes ADULIS_BOOT_MARKER, /healthz echoes it
         (additive field), the gate asserts the echo. D-164 records the
         decision.

Phase 2  env entry: console-e2e carries env { NODE_ENV: 'test' } in gates.mjs
         (verified: an exported NODE_ENV survives --env-file-if-exists=.env)
         production bundle: 611,928 -> 322,690 bytes, and the gate now GREPS
         the fresh dist for the dev-React marker before serving it
         CSP derived from: E2E_API_BASE_URL -- the same variable the build
         consumes as VITE_API_BASE_URL; serve.mjs rebuilds connect-src from
         it, everything else in the policy served byte for byte
         console port guard: the gate refuses ANY listener on either port,
         and reuseExistingServer is opt-in (E2E_REUSE_SERVER=1, human only);
         the build-id assertion stands behind both. Two independent
         controls; neither trusted alone.

Phase 3  FULL SUITE, FIRST HONEST RUN: 17 passed, 0 failed
         (NODE_ENV=test pnpm verify:console-e2e, build id a66880bf...)
         NEW findings this run: NONE surfaced by the run itself. The honest
         expectation was more; the product held. Every T11 fix below is
         read-derived from the T10 adversarial pass, not from this run.
         T10 findings by method:
           read-derived (survive): D-169, D-170, D-171, D-172, D-173's
             schema question, D-174's false claims -- all confirmed by
             reading source/migrations before repair
           run-derived (withdrawn): T10's "8 passed", "16 passed", and all
             four plant results -- instrument unverified (D-162..D-165);
             most consistent with a leftover dev server holding the console
             port; never identified, now unidentifiable, and impossible
             henceforth (the identity invariant)
           re-derived at T11 (stand again, on new evidence): the full suite
             passes against the real artifact, and all four T10 plants fail
             it -- clock fallback, hidden handoff region, styled default,
             D-146's route deletion, each red by name under identity

Phase 4  Deadline: request count on a past deadline, before/after:
           1067 requests in ~4s (both controls planted out; the T10 pass
           measured ~68/s on the unfixed tree) -> 3 or fewer, asserted by
           the new request-count test over the new seeded lapsed order
           (rendering assertions passed THROUGHOUT the flood, which is why
           the test counts requests)
           Fix: ScreenState renders READY/STALE as ONE element shape (the
           remount boundary was destroying all child state on every
           refetch), AND the once-only guard lives in module state keyed by
           deadline string. Each control proven sufficient alone: guard-only
           run (remount re-planted) -> 20 passed.
         blob revoke: HONEST ASSERTION EXISTS -- an Image load probe
           (img-src allows blob:; connect-src pre-empted the old fetch
           probe), asserted BOTH SIDES: 'alive' while open, 'revoked' after
           close. Proven: revoke call deleted -> exactly one failure, named.

Phase 5  Show QR on COMPLETED: disabled (not hidden) on ended orders --
           asserted present + disabled + forced click opens nothing
           (trade.spec, terminal describe). D-169.
         Reissue on refusing states: rendered only in CREATED/NOTIFIED/
           PAYMENT_SUBMITTED, fn_reissue_instructions' own set (0022);
           asserted absent on the confirmed fixture AND present on the
           submitted one. D-170.
         Raw enum: six console.trade.line.* keys in both catalogues,
           label map with render-unknown-as-code; asserted "Fulfilled" on
           the terminal fixture. D-171.
         readiness skips: the test now REFUSES any unsatisfied row without a
           routed link, and Home's ACTION_ROUTE matches
           fn_publication_readiness verbatim (DECLARE_SELLER_TYPE -> SC-02,
           PROVIDE_COMPANY_DETAILS -> SC-17; COMPLETE_COMPANY_DETAILS, a key
           the server never sends, removed). Fixture limit recorded: the
           seeded seller is INDIVIDUAL, so those two rows are satisfied and
           their routes are exercised by review, not by the loop. D-172.

Phase 6  reservation without ORDER_CREATED prevented by: NOTHING.
         No trigger on core.reservation, no constraint, no check; the
         pairing exists only inside fn_create_order, and the release path
         (fn_cancel_line, the expiry sweep) inserts +quantity keyed
         (reservation_id, reason) WITHOUT requiring the reserving event --
         if it is absent, the release invents stock. Registered as D-173,
         RULING NEEDED; schema untouched per this order's S7. The fixture
         now writes the real ledger (variants at 0; SELLER_SET +42;
         ORDER_CREATED -2; WHERE NOT EXISTS, because BEFORE INSERT triggers
         fire even under ON CONFLICT DO NOTHING) and db:reset pins
         stock_drift = 0 -- variants disagreeing with their ledger sum.

Phase 7  D-159 corrected in source: YES -- orders.service.ts's header now
         names all three consumers of core.order_state_transition
         (claims.service.ts evidence bundles; e1-clock.ts confirmation-
         window expiry -- the money path). Register carries D-174.
         T10 claims withdrawn (in T10-REPORT, marked as T11 edits):
           Phase 4's "8 passed" and D-146 plant counts; Phase 5's "16
           passed" and its plant table; every "the harness proved" sentence
           -- withdrawn as UNSUPPORTED (wrong instrument), with the
           re-derivations noted beside them. The six-gaps sentence corrected:
           true of two when written; the three seller-visible gaps carry
           markers, all four markers now asserted; the three internal gaps
           live in the register and source headers, not on a seller's screen.
         data-gap markers that survive removal with tests still green:
           0 of 4. All four assertions select BY the attribute
           ([data-gap="D-..."]), so removing a marker -- not just its
           sentence -- fails the suite. (Six gaps; four markers; the other
           two gaps are internal-facing and have no marker to protect.)

Merges   #39 MERGED  #40 MERGED   gates.mjs deleted lines: 0 (two gates in,
         two gates out: appendix, orphan-sweep; numbers are display indices,
         citations by name)
         Proportionate passes before each: #39's gates run green on the
         branch, then the 14-pin proven red (fixture column removed -> "the
         fixture holds 13 columns; this gate is pinned to 14") and
         verify:appendix proven red (a planted type INSIDE the parsed block
         -> "Appendix A lists 1 type(s) the fixture does not:
         billing.planted_type"; a first plant landed OUTSIDE the parsed
         section, came back green, and was re-done per D-166 -- a plant must
         be proven in force). #40's sweep run green, then proven red by a
         replica-mode seller delete: "5 orphaned row(s): core.order ... 1
         orphaned row(s): core.product" -- richer than T10's plant because
         the trade fixture now populates more FKs into core.seller.
         Register on merged main: D-148, 149, 150, 151 in order, zero
         deleted lines against main, #39's branch and #40's branch.
         Merged main then flowed into #41 and #42 (gates conflict
         pre-resolved: appendix, orphan-sweep, console-e2e), so both open
         branches run the full 24-gate list.

Register 13 new: D-162..D-166 (harness identity, on #41) and D-167..D-174
         (on #42). BLOCKERs first: D-162 (gate cannot run in CI), D-163
         (dev bundle tested), D-164 (CSP forbade the API; the identity
         invariant), D-167 (unbounded refetch loop), D-168 (vacuous revoke
         assertion). Zero deleted lines at every step, verified against
         every merge parent.

Parked   D-173 -- database enforcement of the reservation/stock-event
         pairing (constraint trigger, or a refusing release, or a documented
         fn_create_order monopoly): needs a ruling; on the money path.
         D-153 buyer name (product + privacy), D-155 allowed_actions
         (contract), D-156 QR serialisation (contract, before the Companion
         scanner), D-157 courier account ids (contract), D-154 orders filter
         parameter -- all carried forward from T10, all still open.
         A COMPANY-seller fixture (so D-172's two corrected routes are
         exercised by navigation, not review) -- small, deferred.

State of main: 3e142ca (PRs #39, #40 merged) -- unmerged: #41
         (tier10/t10-p4-harness: the identity harness, D-162..166), #42
         (tier10/t10-p5-trade: C-4 + T11 phases 3-7, D-153..161 and
         D-167..174). Both updated with main merged in; both hold
         PASS all 24 gates (pnpm ci:local; #42 additionally: 461 API tests,
         20 e2e under identity).
```

## The sentence this order was about

The plants proved each assertion discriminates. They did not prove the
assertions were pointed at the right thing. **T10 treated the first as
evidence of the second; T11's harness carries identity in-band so the
difference can never again be invisible** -- and the first honest run then
said the product was sound, which is a claim worth exactly as much as the
instrument that produced it. That is now something.

Found while proving, and kept: **a plant that is not proven to be in force
tests nothing** (D-166) -- it happened twice in this order (a port race, and
an appendix plant outside the parsed section), caught both times because a
green plant was investigated instead of shrugged at. And its mirror, from the
D-167 experiments: **a restore that is not proven in force un-tests the fix**
-- `git checkout` on uncommitted work restores the pre-fix file, and the
single-control experiment had to be re-run from kept copies.
