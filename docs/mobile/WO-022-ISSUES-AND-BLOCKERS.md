# WO-022 -- Issues and blockers

12 November 2026. Branch `mobile/wo-022-messaging-reliability-hardening` (from `e5e4a6e`). W22- IDs.
Resolved issues are kept, and first failures are recorded with their fixes. The central register
(`docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md`) points here.

**Preserved, not closed:**
- W21-01, -03, -05, -07, -09, -10 and -11.
- S21-04, S21-05.
- W20-01 .. W20-07.
- W18-11, W18-12, W18-13.
- ON-20261111-126, -162, -163.

W21-02, W21-04, W21-06 and W21-12 are carried below (W22-05, -06, -11, -12) and stay open. The
payment, Account-deletion and notification policy decisions are unchanged.

## Summary

| ID | Severity | Category | Status | Founder decision |
|---|---|---|---|---|
| W22-01 | High | Application defect (S21-03, Buyer side) | RESOLVED | No |
| W22-02 | Medium | Application defect (conversation switching) | RESOLVED | No |
| W22-03 | Low | UX issue (store not named, times) | RESOLVED | No |
| W22-04 | Info | Test-harness issue (no unreadable body) | RESOLVED | No |
| W22-05 | Medium | Founder decision / API contract (W21-02) | OPEN (proposal written) | **Yes** |
| W22-06 | Medium | API contract gap (W21-01 schemas) | OPEN (proposal written) | No |
| W22-07 | Low | API contract gap (timestamp cursor ties) | OPEN (unverified) | No |
| W22-08 | Low | API contract gap (permission naming) | OPEN | **Yes** |
| W22-09 | Low | Test-harness issue (first Seller run) | RESOLVED | No |
| W22-10 | Info | Environment limitation | OPEN (deferred) | No |
| W22-11 | Medium | Founder decision / UX (W21-04 distinguishability) | OPEN (proposal A) | **Yes** |
| W22-12 | Low | Founder decision / UX (W21-12 escalation wording) | OPEN (proposal C, deferred) | **Yes** |
| W22-13 | Info | Security (S22-03, unpublished-Product retry) | OPEN | **Yes** |
| W22-14 | Info | Security (S22-04, store-name bidi) | OPEN | No |
| W22-15 | Info | Security / UX (S22-05, leaving drops intent) | BY DESIGN | Optional |
| W22-16 | Info | Application defect, pre-existing (Product link while frozen) | OPEN | No |
| W22-17 | Low | API contract / backend verification (idempotency answers) | OPEN | No |
| W22-18 | Info | Application observation (escalation keeps `wasAnswered`) | OPEN | No |
| S22-01 | Low | Security defect (problem-shaped intermediary body) | RESOLVED | No |
| S22-02 | Info | Test-harness issue (refusal fixture stored) | RESOLVED | No |
| -- | -- | W21-06 (Messages for all roles): carried as proposal B in `WO-022-SELLER-MESSAGING-UX.md` | OPEN | Optional |

---

## Application defects

### W22-01 -- Buyer uncertain sends classified as "not sent" (S21-03, Buyer side)

- **Severity:** High (duplicate messages).
- **Category:** Application defect.
- **Affected files:** `apps/mobile/src/buyer/Conversation.tsx`, `apps/mobile/src/buyer/chat.ts`,
  `apps/mobile/src/seller/seller-chat.ts`.
- **Expected:** an outcome that may follow a stored message keeps the intent and its key.
- **Actual (before):** `wasAnswered` treated a gateway 502/503/504 without the API's problem, and an
  unreadable or id-less 201, as refusals. The Buyer saw "not sent", the key was dropped, and the
  next Send could store a second copy.
- **Reproduction:** a POST answered with a 502 HTML page after the server stored the message, then
  Send.
- **Root cause:** a transport-wide rule applied to a non-idempotent outcome question.
- **Fix:**
  - `sendOutcome()`: only the API's own problem envelope is a refusal; everything else is unknown.
  - Used by the Buyer conversation and the store reply hook, replacing the store-only rule without
    weakening it.
  - Other mutations keep `wasAnswered`.
- **Commit:** `fa7eaa2` (rule), `0da543b` (envelope, S22-01).
- **Regression test:** Buyer "Uncertain-send reliability (WO-022)"; Seller "WO-022 store replies".
- **Verification:**
  - Jest: Buyer 85 of 85, Seller 43 of 43, full suite in band.
  - Mutation: restoring `wasAnswered` fails 11 new Buyer tests.
- **Status:** RESOLVED.
- **Remaining risk:** the backend's replay answers are unverified (W22-17).
- **Founder decision:** No.

### W22-02 -- A changed conversation in the route inherited the unconfirmed send

- **Severity:** Medium.
- **Category:** Application defect.
- **Affected files:** `apps/mobile/src/app/(buyer)/chat/[conversationRef].tsx`,
  `apps/mobile/src/seller/SellerMessages.tsx`.
- **Expected:** each conversation has its own draft and intent.
- **Actual (before):**
  - The screen stayed mounted when only the conversation parameter changed (for example
    `router.setParams`, or a link handled by the open screen).
  - The frozen text, its state and the intent remained on screen.
  - **Buyer:** the intent did not record its conversation, so Try sending again would replay
    conversation A's text and key into B.
  - **Seller:** the intent is bound to its conversation, so it would not replay. The draft still
    showed under B.
- **Reproduction:** an unknown send, then `router.setParams({ conversationRef: other })`.
- **Root cause:** the screen was not keyed by the conversation.
- **Fix:** Buyer route `key={conversationRef}`; Seller `key={store.id}:{conversationId}`.
- **Commit:** `fa7eaa2` (Buyer), `cf79371` (Seller).
- **Regression test:** Buyer "8 (switching)"; Seller "36 (switching)".
- **Verification:** the Buyer switching test fails without the key (mutation check; its loss is
  offline, so only the key can explain it).
- **Status:** RESOLVED.
- **Remaining risk:** none known.
- **Founder decision:** No.

### W22-16 -- A Product entered by a link while a send is frozen is not applied after "Edit instead"

- **Severity:** Info.
- **Category:** Application defect, pre-existing (WO-014).
- **Affected files:** `apps/mobile/src/buyer/Conversation.tsx` (`entered`).
- **Expected:** after the Buyer gives the send up, the Product from the latest link is offered.
- **Actual:** the link's Product was consumed while frozen, so it is not applied afterwards.
- **Reproduction:** an unknown anchored send, open the conversation from another Product's Ask
  Seller, Edit the message instead.
- **Root cause:** `entered` updates even when the context cannot change.
- **Fix:** none (out of scope). The Buyer can choose the Product with Select Product.
- **Commit:** --.
- **Regression test:** --.
- **Verification:** found by the security review (reading).
- **Status:** OPEN.
- **Remaining risk:** minor inconvenience.
- **Founder decision:** No.

### W22-18 -- Escalation still uses the transport-wide rule

- **Severity:** Info.
- **Category:** Application observation.
- **Affected files:** `apps/mobile/src/buyer/Conversation.tsx` (`ask`).
- **Expected:** --.
- **Actual:**
  - "Ask the Seller" (`POST .../escalate`) drops its key on a gateway answer without the API's
    problem.
  - A second tap could escalate twice, if the server does not treat a second escalation as a no-op
    (unverified).
- **Reproduction:** n/a.
- **Root cause:** WO-022 unified message sends only. Escalation behaviour was left unchanged on
  purpose ("Do not change Buyer escalation behavior").
- **Fix:** none.
- **Commit:** --.
- **Regression test:** --.
- **Verification:** reading.
- **Status:** OPEN.
- **Remaining risk:** a possible duplicate escalation line.
- **Founder decision:** No. It is a candidate for a later Buyer work order, once the server's repeat
  behaviour is known.

## UX issues

### W22-03 -- The Seller inbox did not name the store; rows hid the start time

- **Severity:** Low.
- **Category:** UX issue.
- **Affected files:** `apps/mobile/src/seller/SellerMessages.tsx`, `packages/locale`.
- **Expected:** a multi-store Account always knows which inbox is open.
- **Actual (before):** no store line; "Started" only when the last activity was missing.
- **Fix:**
  - "Conversations for {store} (@{handle})" heading.
  - Both times on each row and in its spoken label.
  - "Replies are sent as {store} (@{handle})." in the composer.
- **Commit:** `7a135d6` (strings), `cf79371`.
- **Regression test:** Seller "43, 59", "44", "45, 46", "54, 60".
- **Verification:** Jest.
- **Status:** RESOLVED (native check in the backlog).
- **Remaining risk:** the Amharic for the two new strings is machine-translated (MT-KEYS.md).
- **Founder decision:** No.

### W22-11 -- Conversations are hard to tell apart (W21-04 carried)

- **Severity:** Medium.
- **Category:** Founder decision / UX.
- **Affected files:** inbox.
- **Expected:** a store can tell conversations apart.
- **Actual:** only the two times differ. No Buyer label or reference is published, and none is
  fabricated.
- **Fix:** proposal A (a server-issued, store-scoped conversation reference) in
  `WO-022-SELLER-MESSAGING-UX.md`.
- **Commit:** docs.
- **Regression test:** Seller "43, 59" (no Buyer id in labels).
- **Verification:** --.
- **Status:** OPEN.
- **Remaining risk:** --.
- **Founder decision: Yes.** Whether a reference and/or any Buyer label may be shown (ADU-PRV-01
  S17; CHAT-01 S9 leaves Buyer display to privacy policy).

### W22-12 -- Store-side escalation wording (W21-12 carried)

- **Severity:** Low.
- **Category:** Founder decision / UX.
- **Affected files:** none changed.
- **Expected / Actual:** as W21-12. The store sees the Buyer's sentence.
- **Fix:** proposal C ("The buyer requested a response from your team.") with its implementation
  plan. **Not implemented:** it needs approval and a human Amharic translation.
- **Commit:** docs.
- **Regression test:** --.
- **Verification:** --.
- **Status:** OPEN (deferred).
- **Remaining risk:** mild confusion.
- **Founder decision: Yes.** Approve the copy.

## Security findings (from `WO-022-SECURITY-REVIEW.md`)

### S22-01 -- A problem-shaped answer from an intermediary counted as a refusal

- **Severity:** Low.
- **Category:** Security defect.
- **Affected files:** `apps/mobile/src/buyer/chat.ts`, `Conversation.tsx`, `seller-chat.ts`.
- **Expected:** only the API's refusal ends an intent.
- **Actual (before):**
  - Any JSON with a string `code` counted as a refusal.
  - After a non-404 refusal, the history was not re-read.
- **Reproduction:** a 502 with body `{"code":"BAD_GATEWAY"}` after a stored message.
- **Root cause:** the transport's loose problem test (`readProblem`).
- **Fix:**
  - The send rule requires ProblemDto's required fields, with the status matching.
  - `rereadAfter` re-reads after a 5xx, 409 or 404 refusal.
- **Commit:** `0da543b`.
- **Regression test:** Buyer "502 with JSON carrying only a code"; Seller same; Buyer "10" (re-read).
- **Verification:** Jest; the mutation fails both `{ code }` tests.
- **Status:** RESOLVED.
- **Remaining risk:** an intermediary that copies the full envelope (not expected).
- **Founder decision:** No.

### S22-02 -- Refusal fixtures stored the message

- **Severity:** Info.
- **Category:** Test-harness issue.
- **Affected files:** `chat.test.tsx`, `seller-chat.test.tsx` (`storing`).
- **Fix:** an API refusal stores nothing; the tests assert one copy.
- **Commit:** `0da543b`.
- **Regression test:** Buyer "10"; Seller "31, 52".
- **Verification:** Jest.
- **Status:** RESOLVED.
- **Remaining risk:** depends on the backend rule in W22-17.
- **Founder decision:** No.

### W22-13 -- An unpublished-Product retry can only end by editing (S22-03)

- **Severity:** Info.
- **Category:** Security / duplicate risk.
- **Affected files:** `Conversation.tsx`.
- **Expected / Actual:** a retry whose Product is now unpublished sends nothing and stays unknown.
  The Buyer must Edit instead; if the first copy was stored, the edited one is a second message.
  The re-read shows the stored copy first.
- **Fix:** none; it follows "preserve the uncertainty rather than silently removing the anchor".
- **Commit:** --.
- **Regression test:** Buyer "21".
- **Verification:** Jest.
- **Status:** OPEN.
- **Remaining risk:** a duplicate only if the Buyer edits after not checking the history.
- **Founder decision: Yes.** Allow a same-key replay with the unchanged Product id once the backend
  confirms its replay answer for an unpublished Product?

### W22-14 -- Bidirectional controls in a store name (S22-04)

- **Severity:** Info.
- **Category:** Security (spoofing within one's own store).
- **Affected files:** `SellerMessages.tsx` `storeLine`.
- **Expected / Actual:** an unterminated RLO or RLI in a store name can reorder the rest of the store
  line. Only the store's own members see it.
- **Fix:** none. Suggested: wrap slot values in first-strong isolates (non-destructive).
- **Commit:** --.
- **Regression test:** --.
- **Verification:** reading.
- **Status:** OPEN.
- **Remaining risk:** very low.
- **Founder decision:** No.

### W22-15 -- Leaving the conversation drops an unknown intent (S22-05)

- **Severity:** Info.
- **Category:** Security / UX.
- **Status:** BY DESIGN. Nothing is persisted (no approved persistence policy), and the history is
  re-read on reopening.
- **Tests:** Buyer "26", "8 (switching)"; Seller "36 (switching)".
- **Founder decision:** Optional (a leave warning).

## Test-harness issues

### W22-04 -- The fake API could not return an unreadable body

- **Severity:** Info.
- **Category:** Test-harness issue.
- **Affected files:** `apps/mobile/src/testing/fake-api.ts`.
- **Fix:** an `unreadable` reply option, where reading the body throws.
- **Commit:** `fa7eaa2`.
- **Status:** RESOLVED.

### W22-09 -- First Seller WO-022 run: 4 failures from an early assertion

- **Severity:** Low.
- **Category:** Test-harness issue.
- **Affected files:** `seller-chat.test.tsx` (32-34).
- **Actual (first run):**
  - 38 of 42 passed (`G:\AdulisDevelopment\WO-022\logs\jest-seller-022-1.log`).
  - The stored reply was asserted right after the unknown text disappeared, while the post-success
    re-read was still in flight.
- **Root cause:** an assertion timing defect in the test. Not an application defect: the debug run
  showed the message present one tick later.
- **Fix:** wait for the composer to clear (the send returns after the re-read), and assert that the
  stored reply is visible while the outcome is unknown.
- **Commit:** `cf79371` (committed fixed).
- **Verification:** 42 of 42 (`jest-seller-022-2.log`), then the full suite.
- **Status:** RESOLVED.

## API contract gaps

### W22-05 -- MOBILE Seller messaging (W21-02 carried)

- **Severity:** Medium.
- **Category:** Founder decision / API contract.
- **Status:** OPEN. The proposal is in `WO-022-SELLER-CHAT-CONTRACT-RECONCILIATION.md` (policy,
  required ADU-API-01 edits, security implications, acceptance criteria). Nothing was amended.
- **Founder decision: Yes.**

### W22-06 -- Chat response schemas (W21-01 carried)

- **Severity:** Medium.
- **Category:** API contract gap.
- **Status:** OPEN. The additive proposal is in reconciliation section 11. The runtime validators
  are kept; no official DTO was written.
- **Founder decision:** No (backend work order).

### W22-07 -- A timestamp cursor can split a same-time message pair

- **Severity:** Low.
- **Category:** API contract gap (unverified).
- **Expected:** every message is returned once across pages.
- **Actual (possible):**
  - WO-013 records timestamp cursors.
  - A Buyer message and its automated answer share `sent_at` (ON-20261111-153).
  - If the next page is "older than the cursor's time", the second of a pair split by the page
    boundary is never returned.
- **Fix:** none on the client. The contract should make `next_cursor` opaque and unique.
- **Verification:** not observed (no API run; `apps/api` not read).
- **Status:** OPEN.
- **Founder decision:** No. Backend matrix row 16.

### W22-08 -- Permission names differ between the design and the database

- **Severity:** Low.
- **Category:** API contract gap.
- **Actual:** AUTH-02 v3.3 S157 names `seller.inbox:read` / `seller.inbox:reply`; migration 0006
  names `seller.messages:read` / `seller.messages:send`.
- **Fix:** none. The client never names a permission.
- **Status:** OPEN.
- **Founder decision: Yes** (which name is canonical; reconciliation section 6.5).

### W22-17 -- Backend idempotency answers unverified

- **Severity:** Low.
- **Category:** Backend verification.
- **Actual:** the refusal rule assumes an API problem answer means nothing was stored under the key.
  Unverified:
  - the answer to a same-key request that arrives while the first is still running;
  - the answer to a failure after commit.
- **Fix:** none on the client.
- **Status:** OPEN (reconciliation section 12, rows 12 and 16).
- **Founder decision:** No.

## Environment limitations

### W22-10 -- Native validation not run; low memory

- **Severity:** Info.
- **Category:** Environment limitation.
- **Actual:**
  - Free RAM was 0.43 GB at the start (commit 37.62 of 44.54 GB). In-band Jest ran safely.
  - No emulator, Gradle, Maestro, Docker, PostgreSQL or API was started.
  - The 16 WO-022 native checks are in the backlog as NOT EXECUTED -- RESOURCE DEFERRED.
- **Status:** OPEN (deferred to WO-019).
