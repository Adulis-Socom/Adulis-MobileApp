# WORK ORDER T16 REPORT

**What Needs Me.** COMPLETE. Three phases, three PRs, an adversarial pass
remediated before every merge. Every claim asserting verification names its
command. `State of main` is a ref.

```
WORK ORDER T16 REPORT
Phase 1  v1.10 installed   authority docs advanced in the same commit: YES
           (DOCUMENT_AUTHORITY.md, both CLAUDE.md files, the amendments
            manifest, the docs-ascii GOVERNED list -- one commit, PR #63)
         PAYOUT_LOCKED_RECOVERY gone from code and catalogue:
           grep -rn PAYOUT_LOCKED_RECOVERY apps/api/src packages contracts
           -> no occurrence as a value (comments and immutable migration
           headers only); already true since T15 P4, the doc now agrees
         window reported in the response, both sides moved:
           pnpm --filter @adulis/api test c8-analytics -- 17/17; c8 asserts
           window:{from,to} on BOTH reads AND that orders_30d/window_from
           are ABSENT -- the gate that compares a field name to the data
           behind it, which did not exist before
Phase 2  obligation kinds admitted: PAYMENT_AWAITING_CONFIRMATION (deadline =
           payment_submission.sla_deadline, the column SC-03's clock renders;
           consequence = fn_confirmation_window_lapse verbatim),
           CLAIM_AWAITING_SELLER (claim.review_deadline; decidable without
           your side past it), ORDER_NOT_READY (derived clock_stopped_at +
           fulfilment_window; the TRUE consequence -- the work order's
           "expires and stock releases" is FALSE in the schema and D-235
           reports it with a ruling invited)
         REJECTED as pending, each with the test applied: refund awaiting
           BUYER acknowledgement (the buyer acts -- nothing required of the
           seller); refund UNREPORTED (real, but NO ruled deadline exists --
           a nearest-deadline-first list cannot seat a deadline-less entry;
           ruling invited); publication readiness (a consequence, not a
           deadline; Home Life 1 already surfaces it); payout change pending;
           ownership transfer pending (the order's own exclusions)
         each entry carries kind, object, deadline, consequence:
           c3-orders "T16 Phase 2" describe -- kind/object_kind/object_id/
           deadline/consequence_key asserted per entry; consequence_key
           carried explicitly, the way error envelopes carry message_key
         empty list is a 200 with an empty array, not a 404:
           c3 arm "an empty list is a 200 with an empty array" (SELLER2)
Phase 3  obligations render above the summary:
           readiness.spec "three kinds, nearest deadline first" -- the DOM
           interleave assertion (every [data-obligation] precedes every
           [data-item])
         nearest-deadline-first with three kinds seeded:
           the same arm, against the REAL server: the seed's OVERDUE lapsed
           payment first (rendering "Overdue"), the fresh payment, a claim
           the seeded buyer files THROUGH THE BUYER WIRE strictly
           interleaved at +2 days, the unready order last (+~6 days) -- an
           order neither grouping nor a client sort reproduces
         consequence text rendered from the server, not composed:
           the same arm asserts all three sentences verbatim from the
           server-sent consequence_key; the post-lapse variant is API-proven
           in c3 (the pass's F1: the stale entry switches its sentence
           instead of promising forever what already happened)
         empty state reads as a good state: "Nothing needs you right now."
           -- a callout beside the real week-on-week summary, never an empty
           box (readiness.spec Life-2 arm, planted per the R21 pattern
           because the seeded seller is genuinely obligated)
         R23 unchanged -- no picker on Home:
           the same arm asserts [data-period] count 0; the summary is two
           REAL windowed overview reads (7d vs previous 7), orders compared,
           point-in-time tiles rendered once (a cross-window comparison of a
           point-in-time count would fabricate a trend)
Gates    25 gates  pnpm ci:local -- PASS on every phase's merged tree
           (Phase 3's final run flaked twice on the D-217 class -- a 429 on
            t12's OTP budget, then a Windows EPERM file-lock on c6's dev-sms
            log, a DIFFERENT suite each time -- and the protocol held: green
            in isolation, 531/531 at --maxWorkers=2, green on the re-run)
         API tests  pnpm --filter @adulis/api test -- 531/531
         e2e  pnpm verify:console-e2e -- 56/56 against the real API on a
           reset database
         db:check  pnpm db:check -- 16 PASS inside every gate run
Register 3 new, no BLOCKER shipped -- D-234 (the install; four transcription
         findings reported not judgement-called: three S12.12a rows that
         disagree with the shipped paths or v1.10's own sections, and S7.1's
         RECOVERY vs the shipped RECOVERY_COOLING -- the D-44 class; the
         pass corrected C4's justification ground: overview is
         MOBILE-granted, and the S12.13 no-M-marker vs the 0006 grant is
         handed to the next reissue), D-235 (the endpoint; the pass found
         the work order's exact warned failure BEFORE merge -- the
         post-lapse entry promising forever what already happened -- fixed
         with the lapsed consequence variant; and commitEvidence's silent
         zero-row insert now fails loudly), D-236 (Home; the persistent
         "Overdue" domain truth; the badge owed to push, not built against
         a poll; the pass's major -- the brief's two windows OVERLAPPED by a
         day and "previous 7" spanned eight under the inclusive-date
         convention, two honest numbers answering a dishonest question --
         fixed to seven DISJOINT days each; an unknown consequence_key now
         renders AS the key, the Feedback precedent, instead of silently
         dropping the stakes)
Parked   the v1.11 amendment set: three S12.12a path rows; the reason
           vocabulary (RECOVERY vs shipped RECOVERY_COOLING + the unnamed
           fail-closed NO_TIMING_CONFIG); the S12.12b "route" cell (the
           ACTION_ROUTE reading, recorded as a deviation); the S12.13
           M-marker vs the 0006 MOBILE grant on overview
         a fulfilment-lapse job -- "the order expires and stock releases"
           exists in no schema or job; ruling on whether it should
         a refund-REPORT window, if the unreported refund belongs on the
           obligations list
         claim review windows into timing_config (hardcoded 2 days today)
         the F3 divergence (stored sla vs job derivation) if timing_config
           ever gains a mutation path
         the Home nav badge -- owed to a push mechanism
State of main: 8fcb2fe (PRs #63, #64, #65) -- nothing unmerged
```
