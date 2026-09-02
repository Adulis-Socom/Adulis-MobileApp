# WORK ORDER T15 REPORT

**Answer the Sentences the Console Is Rendering.** COMPLETE. The three
documents installed byte-exact; the seller-visible defect fixed first; the
three labelled items, the eight reads and the reason slot built; and the gap
sentences whose endpoints now exist DELETED -- each removal proven by the
screen rendering the real thing, end to end. Five phases, five PRs, an
adversarial pass before every merge. Every claim that asserts verification
names its command. `State of main` is a ref.

---

## Phase 1 -- the install (PR #57, merged baea916)

**Installed, exact founder bytes (commit 08658bd):** ADU-DB-01 v1.16,
ADU-API-01 v1.9, ADU-CON-03 v1.3 -- 0 bytes above U+007F
(`pnpm verify:docs-ascii` PASS on the grown governed set). v1.15/v1.8/v1.2
moved to `docs/superseded/`. `verify:appendix` re-anchored to v1_16 and PASS
both ways -- v1.16 removes S0's stale count that no gate ever read (D-222.5),
changes nothing else, and the fixture never won because nothing drifted.
DOCUMENT_AUTHORITY.md, both CLAUDE.md files and the amendments manifest
advanced in the same commit, as ordered.

## Phase 2 -- D-227 S1, the defect a seller can see (PR #58, merged 1779930)

The notifications seller-scope predicate is ONE SQL fragment
(`sellerClassTemplate`), interpolated into BOTH arms -- so the class list
cannot drift between the feed that must include it and the feed that must
exclude it. The three leaked classes (ownership transfer, stock nudge, trial)
come home to SC-30 and leave the buyer feed. **Asserted in both directions in
one test** -- a seller-scoped notice reaches the seller feed AND does not
reach the buyer feed -- because either arm alone passes with the predicate
inverted, which is the exact failure being fixed. The pass extended
UNSUPPRESSIBLE to OWNERSHIP_TRANSFER (remediation commit 6ece697).

## Phase 3 -- the three labelled items (PR #59, merged ca474b5)

- **`bucket` on GET /v1/seller/orders (D-154 CLOSED).** Membership is the
  server's, in one module (`order-buckets.ts`); needs_action is a SET
  (PAYMENT_SUBMITTED + PAYMENT_CONFIRMED); an undefined bucket is 400. The
  console tab sends a NAME and re-fetches -- asserted at the wire, because a
  client filtering one page four ways passes a rendering test.
- **Couriers carry `account_id` (D-224.4 CLOSED).** SC-04's assignment and
  custody controls are LIVE; e2e drives a real invite -> claim -> assign.
- **`allowed_actions` (D-155 CLOSED, after eight tiers).** A read-only
  resolver (grant-set.ts) intersects the caller's grant set with what the
  object's state admits; it never authorizes (every write still opens with
  fn_has_permission, which raises). Proven the way a wrong implementation
  could not fake: the SAME order in the SAME state yields DIFFERENT
  allowed_actions for OWNER and ANALYST (empty for ANALYST), plus a planted
  browser test that strips the array while state permits -- the controls
  disable, so a console that ORed its own guess back in fails the suite.
- **The pass (D-231)** found the work order's predicted class: the reissue
  predicate wrong at BOTH ends (offered where the function 409s, hidden where
  a bank-changed seller needs it -- transcribed from fn_reissue_instructions'
  own guard), a prototype-chain 500 (`in` -> Object.hasOwn), an empty bucket
  that hid the tabs, a tab-switch race, and the unfalsifiable grant gate. All
  fixed in-phase. **Count reported:** D-155 was the master inference entry
  and is CLOSED; the D-224 cap-counter family remains open -- absent DATA
  FIELDS, not allowed_actions.

## Phase 4 -- the eight reads (PR #60, merged b9ca6a9)

*"A write with no read is a fact the product cannot show its owner."* Each of
S15.0b's eight lands (register D-232): profile (with **status and handle**),
availability (the PUT's own shape back), social accounts (below), sessions
(remembered distinguishable AND `DELETE /v1/auth/remembered-devices/{id}` --
the flag alone, the session stays), payout lock state (`payout_locked_until`
+ `reason`, the render-side twin of fn_request_payout_change's three checks,
same order, same rows, raising nothing), analytics `[from,to]` date windows
(echoed back as window_from/window_to), and the purchase-intent reference on
the GET (A7).

**The owed column was already there.** ADU-API-01 v1.9 says
core.seller_social_account owes `follower_count` and `captured_at` to an
ADU-DB-01 v1.17. It does not: `follower_count_at_verification` and
`verified_at` have existed since migration 0005, write-once, written on
verify, superseded by a fresh row on re-verification -- exactly R24's
semantics. The read maps them to the v1.9 wire names. **No migration was
written, so there is no generated appendix content to send** -- the honest
answer to that instruction is that the column exists. The v1.9 note is stale
against the installed v1.16 (D-232 C3; amendment owed).

**PAYOUT_LOCKED (D-224.6):** renamed from PAYOUT_LOCKED_RECOVERY (one code,
two causes, and a name asserting the wrong one); the `reason` slot already
flowed from the DB DETAIL; the two sentences that differ are locale keys
(en + am, MT-KEYS regenerated). S7.1's taxonomy row still prints the old
name against S15.0c -- an internal v1.9 contradiction, reported (C1), built
per the authoritative section.

**The pass:** the payout-lock read traced exhaustively against the DB
function with NO divergence; permission gates and seller/account scoping
confirmed on every read; no PII in any SELECT list. Two MINORs fixed before
merge (a lone past `to` produced a silent empty window -- lo now defaults to
`to - 30 days`; a doc-comment item mislabel). Deferred with reasons:
analytics EXPORT is not a read -- async job, and the worker and job table do
not exist (ruling requested on which tier owns it).

## Phase 5 -- the sentences deleted, each removal proven (PR #61, merged 0ca6e6b)

Register D-233. Each deleted sentence was replaced by the screen rendering
the real read, driven end to end under `pnpm verify:console-e2e` (the built
console, the real API, a reset database):

```
SC-17  "cannot be shown here yet" GONE      loads the profile, shows status+handle,
                                            an edit PATCHes and READS BACK across a reload
SC-19  "Saved hours cannot be shown" GONE   the weekly editor loads the saved pattern;
                                            a saved window reads back across a reload
SC-22  "cannot be shown again later" GONE   the linked list renders from the server;
                                            a minted PENDING account survives a reload
                                            (VERIFIED as-of asserted at the wire in c1)
SC-24  the 409-discovery REPLACED           the REAL server's new-device lock draws the
                                            proactive panel -- cause, lift time, control
                                            DISABLED (R20) -- no step-up SMS spent to
                                            discover a refusal the GET now states
SC-27  "cannot be listed or removed" GONE   forget-the-device driven against the real
                                            API: THE FLAG GOES, THE SESSION STAYS
SC-12  "a period picker arrives..." GONE    7/30/90 re-fetches with a real from= (wire-
                                            asserted); the caption is the SERVER's echo
SC-26  "reference cannot be shown" GONE     the GET's reference renders in the open-
                                            intent block (API proof: t6's GET==POST)
```

**The pass earned its keep (D-233).** ONE BLOCKER, in the phase's own
failure class: SC-29 still told sellers *"the server does not report"*
whether the store is open -- a status SC-17 was rendering two taps away from
the same read. Kept by omission; fixed -- SC-29 now loads the profile,
`closed` is the server's CLOSING rather than the tab's memory of its own
POST, and the e2e closes, RELOADS (the badge renders from the server),
reopens, and reloads again. Six MAJORs, all fixed before merge: a lock
arriving mid-session left an armed form behind its disabled toggle; the
overrides refetch clobbered a weekly draft mid-edit (the two reads split,
the read-back dirty-guarded); the profile post-save refetch clobbered
mid-flight typing (per-field sent-guard); a failed social list rendered as
EMPTY (the C-5 class -- failure renders as failure now); the analytics
generation guard leaked through its catch paths; a failed full-read kept the
previous window's tiles under the new caption; and SC-26's reference render
gained its on-screen plant proof. Clearing a saved profile field now REFUSES
in words -- the coalescing PATCH cannot express clearing, and "Saved."
followed by a silent revert would lie.

**Sentences that REMAIN -- every one a deliberate keep, none by omission:**
D-153 (buyer name -- the data-model absence stands, marker and tests stay);
SC-17 logo (no endpoint, no column) and company DETAILS read-back (the
profile read carries entity_type, not registration/licence/tin); SC-22
Re-check (the verify short-circuits a VERIFIED account -- D-225's write-path
debt); SC-13 trust level (GET /v1/seller/level does not exist, D-226); SC-12
export (no worker, no job table, D-232); SC-01 chooser (D-97: nothing lists
the caller's own sellers); SC-23 courier name/assignments/activity; the
D-224 cap-counter family; SC-30 sender absences and the SC-20/21
conversation-row fields (D-226); SC-16 claims history, SC-09 media upload
(D-219), SC-08 attributes, SC-07 row summary, SC-C1 courier joins (D-228) --
the pass's keep-list sweep, so nothing stands by omission.

## The standing rules

None broken. The single-writer rule held through every adversarial pass (all
review agents read-only); no secrets, no generated-file edits, ASCII on every
governed byte, every state-changing endpoint still opens with its named
function, adulis_app never a superuser.

## Copy

Locale keys net +17 (payout reason sentences, profile status/handle labels,
linked-accounts list, analytics periods, forget-device, reference line);
the five gap sentences' keys removed. am at placeholder parity; MT-KEYS
regenerated same commits (`pnpm verify:mt-keys` PASS; HUMAN-REQUIRED
unchanged at 2; count 744).

## Browser and gates

`pnpm verify:console-e2e`: **54 passed** -- every rewritten arm above plus
the whole standing suite. `pnpm ci:local`: **PASS all 25 gates** on every
phase before its merge (Phase 3's one `test`-gate red matched D-217's
signature and protocol: 23/23 in isolation, 513/513 at --maxWorkers=2, green
on re-run). API tests 524/524 at Phases 4 and 5.

## Register

D-229, D-230, D-231, D-232, D-233; DEFECT-REGISTER entries carry every pass
finding and every deferred item with its reason.

## Parked -- long by design

- The ADU-API-01 v1.9 amendments owed: S7.1's PAYOUT_LOCKED_RECOVERY row
  (C1), the S12 catalogue tables' missing GET rows (C2), the stale v1.17
  "owed column" note (C3), and the `_30d` field names under a custom window
  (rename or bless; window_from/window_to disambiguate meanwhile).
- Analytics EXPORT: the async job, worker process, job table and R2 write --
  a ruling on which tier owns it.
- The deliberate keeps above, each at its register home (D-97, D-224, D-225,
  D-226, D-232).
- Out of scope per S0: Amharic quality, real vendor accounts, the
  activation-boundary privilege change, the deferred constraint trigger,
  passkeys, social OAuth, the operator surface, mobile, the custody-transfer
  arbiter and state gate, Home's obligation surfacing, harness debts,
  ops/render.yaml.

## State of main

`main` = **0ca6e6b**: the install, D-227 S1, the three labelled items, the eight
reads and the sentence deletions all merged -- PRs #57, #58, #59, #60, #61,
each with its adversarial pass remediated before merge -- and `pnpm ci:local`
PASS all 25 gates on the merged result. WORK ORDER T15 is complete; nothing
of it rides a branch.
