# WO-021 -- Issues and blockers

12 November 2026. Branch `mobile/wo-021-seller-companion-messaging` (from `d6dd399`). W21- IDs.
Resolved issues are kept, and first failures are recorded with their fixes. The central register
(`docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md`) points here.

**Preserved, not closed:**
- W20-01 .. W20-07
- W18-11, W18-12, W18-13
- ON-20261111-126, -162, -163

The Account-deletion, notification, chatbot and payment decisions are unchanged. Seller
notification policy was not touched.

## Summary

| ID | Severity | Category | Status | Founder decision |
|---|---|---|---|---|
| W21-01 | Medium | API contract gap | OPEN | No (backend contract work) |
| W21-02 | High | Authorization / SPEC_CONFLICT | OPEN | **Yes** |
| W21-03 | Medium | Runtime verification | OPEN (resource deferred) | No |
| W21-04 | Medium | API contract gap / product | OPEN | **Yes** |
| W21-05 | Low | API contract gap | OPEN | No |
| W21-06 | Low | Authorization UX | OPEN (by design) | Optional |
| W21-07 | Info | Deferred capability | DEFERRED | No |
| W21-08 | Low | Test failure | RESOLVED | No |
| W21-09 | Info | Resource limitation | OPEN (deferred) | No |
| W21-10 | Info | API contract | OPEN | No |
| W21-11 | Low | Sender attribution | OPEN (unverified) | No |
| W21-12 | Low | Content / UX | OPEN | **Yes** |

Security review findings are listed after W21-12.

---

### W21-01 -- No response schemas for the Chat endpoints

- **Severity:** Medium.
- **Category:** API contract gap.
- **Affected component:** `src/seller/seller-chat.ts` and `src/buyer/chat.ts` (the response checks).
- **Expected behavior:** `contracts/openapi.json` publishes response DTOs, so `@adulis/api-client`
  generates the types.
- **Actual behavior:** `GET /v1/conversations`, `GET` and `POST /v1/conversations/{id}/messages`
  publish 200/201 with no content (as WO-013 row 32 and W20-01).
- **Reproduction:** `contracts/openapi.json`, paths `/v1/conversations*`.
- **Root cause:** the Chat controller declares no response DTOs.
- **Fix implemented:**
  - Every answer is checked at the boundary: list `{ data[], next_cursor }`, ids UUID, times ISO.
  - A malformed body is a contract failure with Retry, and a malformed row is dropped.
  - No hand-written DTO is exported as a contract.
- **Commit:** `d365615`.
- **Regression test:** seller-chat 12, 15, 35.
- **Verification:** Jest.
- **Current status:** OPEN.
- **Remaining risk:** a field rename on the server reads as "could not be loaded", not as wrong
  data.
- **Founder decision required:** No. It needs a backend contract work order.

### W21-02 -- Is the Seller inbox reachable from MOBILE? (SPEC_CONFLICT)

- **Severity:** High. This is an authorization documentation conflict, not a code defect.
- **Category:** Authorization.
- **Affected component:** the whole WO-021 feature.
- **Expected behavior:** one governing answer to "may a MOBILE session read and send as a store?"
- **Actual behavior:** the sources disagree:
  - `db/migrations/0006_permission_catalogue.sql` gives `seller.messages:read` and
    `seller.messages:send` surfaces `{MOBILE, CONSOLE}`, granted to OWNER, ADMIN and SALES_SUPPORT.
  - ADU-MOB-02 v4.3 (the November design authority) puts the Companion Inbox and replies on mobile.
  - **ADU-API-01 v1.11 S12.7:** "Chat is in-app only for the buyer ... The seller's inbox is a
    console surface ... reachable from CONSOLE in the seller scope." In the same table the history
    GET carries no **M** marker, although the Buyer side reads it from MOBILE.
- **Reproduction:** read the three sources.
- **Root cause:** ADU-API-01 predates the November reconciliation.
- **Fix implemented:**
  - The app fails closed: 403 `PERMISSION_DENIED` or `AUDIENCE_NOT_PERMITTED` shows "not available
    for your role", stops polling, never signs out and never retries.
  - The server decides; the client grants nothing.
- **Commit:** `d365615`.
- **Regression test:** seller-chat 13, 33, 42.
- **Verification:** Jest only. **No runtime probe** (the work order forbade starting the API).
- **Current status:** OPEN.
- **Remaining risk:**
  - If the running API refuses MOBILE, every store user sees "not available" and the feature is
    inert, though safe.
  - If it accepts, the feature works as tested.
- **Founder decision required: Yes.** Confirm that MOBILE Seller messaging is intended, as the
  November pack says. ADU-API-01 S12.7 is then corrected to the design (as R-20 did for Courier),
  and a probe confirms the runtime (see W21-03).

### W21-03 -- Seller-side Chat behaviour not observed at runtime

- **Severity:** Medium.
- **Category:** Runtime verification.
- **Affected component:** inbox, history, reply.
- **Expected behavior:** a probe from a MOBILE session of a store owner, as WO-020 did for Orders.
- **Actual behavior:** not run. The work order forbade the API, PostgreSQL and Docker.
- **Unverified:**
  - The list's row shape `{ id, buyer_account_id, started_at, last_message_at }` (from the work
    order and `chat.conversation`).
  - That history and send honour `X-Adulis-Seller`.
  - That a same-Account send with the header is recorded as `SELLER`.
  - Which code a role without the permission receives.
- **Reproduction:** n/a.
- **Root cause:** resource restriction.
- **Fix implemented:** fail-closed parsing and refusal handling. The fake server applies the work
  order's stated rules.
- **Commit:** `d365615`.
- **Regression test:** the whole seller-chat suite, against those stated rules.
- **Verification:** Jest only.
- **Current status:** OPEN (resource deferred).
- **Remaining risk:** a shape mismatch shows "could not be loaded". It never shows wrong data.
- **Founder decision required:** No. Run the probe with the native backlog (WO-019 or the next
  work order that may start the API).

### W21-04 -- No Buyer display identity for the store

- **Severity:** Medium.
- **Category:** API contract gap / product.
- **Affected component:** inbox rows and the conversation title.
- **Expected behavior:** a store can tell its conversations apart.
- **Actual behavior:**
  - Every row reads "Buyer conversation" plus its last activity, and the title is "Buyer
    conversation".
  - The only Buyer field is `buyer_account_id`, a full Account UUID. It is deliberately not read:
    the work order forbids exposing it as a label.
- **Reproduction:** open Messages with two conversations.
- **Root cause:** no Buyer display field in the Seller list.
- **Fix implemented:** neutral labels only.
- **Commit:** `d365615`.
- **Regression test:** seller-chat 1 (no Buyer id drawn).
- **Verification:** Jest.
- **Current status:** OPEN.
- **Remaining risk:** with many conversations a store must open each one to know who it is.
- **Founder decision required: Yes.** Which Buyer label, if any, may a store see (for example a
  first name, or a masked phone)? That is a privacy decision (DPIA) before any contract change.

### W21-05 -- No unread or read state for the store

- **Severity:** Low.
- **Category:** API contract gap.
- **Affected component:** inbox.
- **Expected behavior:** design CHAT S10: a read high-water mark per side.
- **Actual behavior:** no read endpoint and no unread field, so no unread count is shown.
- **Reproduction:** n/a.
- **Root cause:** WO-013 row 12, on the Seller side.
- **Fix implemented:** none, by rule (no invented counts).
- **Commit:** --.
- **Regression test:** seller-chat 1 (no "unread" text).
- **Verification:** Jest.
- **Current status:** OPEN.
- **Remaining risk:** a store cannot see which conversations need an answer.
- **Founder decision required:** No (a backend gap already recorded).

### W21-06 -- Messages is offered to every store role

- **Severity:** Low.
- **Category:** Authorization UX.
- **Affected component:** Seller Home.
- **Expected behavior:** a role without `seller.messages:read` (INVENTORY, ANALYST,
  CAMPAIGN_MANAGER) is not invited into a feature it cannot use.
- **Actual behavior:** the button shows for every role, and the server's 403 then reads "Messaging
  is not available for your role in this store."
- **Reproduction:** a store where the Account is INVENTORY.
- **Root cause:** the API does not publish per-store capabilities. Hiding the button by role would
  put the server's role-to-permission map in the client, which "the client never manufactures
  eligibility" forbids.
- **Fix implemented:** server-decided refusal, no sign-out.
- **Commit:** `d365615`.
- **Regression test:** seller-chat 13.
- **Verification:** Jest.
- **Current status:** OPEN (by design).
- **Remaining risk:** one extra tap for those roles.
- **Founder decision required:** Optional. If wanted, the server could expose the store's mobile
  capabilities in the list or bootstrap.

### W21-07 -- Anchored Seller replies not built

- **Severity:** Info.
- **Category:** Deferred capability.
- **Affected component:** composer.
- **Expected behavior:** none in WO-021. The work order excludes Product and Order selection on
  replies.
- **Actual behavior:** text-only replies.
- **Reproduction:** n/a.
- **Root cause:** scope.
- **Fix implemented:** --.
- **Commit:** --.
- **Regression test:** every POST body is exactly `{ text }` (afterEach).
- **Verification:** Jest.
- **Current status:** DEFERRED.
- **Remaining risk:** none.
- **Founder decision required:** No.

### W21-08 -- First run: one test asserted before the second page loaded

- **Severity:** Low.
- **Category:** Test failure.
- **Affected component:** `seller-chat.test.tsx` case 29.
- **Expected behavior:** after Load earlier messages, the button disappears.
- **Actual behavior (first run):**
  - 28 of 29 passed.
  - Case 29 found the button still present: the assertion ran before the second page's render.
  - Log: `G:\AdulisDevelopment\WO-021\logs\jest-seller-chat-1.log`.
- **Reproduction:** the first version of the test.
- **Root cause:** a synchronous assertion after an asynchronous page load. This is a test defect
  only.
- **Fix implemented:** wait for the button to disappear; assert exactly one cursor request and the
  store header. No application change.
- **Commit:** `d365615` (committed fixed).
- **Regression test:** case 29.
- **Verification:** 29 of 29 (`jest-seller-chat-2.log`), then the full suite.
- **Current status:** RESOLVED.
- **Remaining risk:** none.
- **Founder decision required:** No.

### W21-09 -- Native validation not run

- **Severity:** Info.
- **Category:** Resource limitation.
- **Affected component:** all screens.
- **Expected behavior:** the WO-021 native checks.
- **Actual behavior:** none run. The emulator, Gradle and Maestro were forbidden.
- **Reproduction:** n/a.
- **Root cause:** the founder's machine was occupied.
- **Fix implemented:** listed in `MOBILE-NATIVE-VALIDATION-BACKLOG.md` as NOT EXECUTED --
  RESOURCE DEFERRED.
- **Commit:** docs commit.
- **Regression test:** --.
- **Verification:** --.
- **Current status:** OPEN (deferred).
- **Remaining risk:**
  - Keyboard layout, enlarged text, Dark and TalkBack are unverified on a device for these screens.
  - They reuse the WO-016/WO-018 patterns: header offset, history minimum height, scrolling
    composer, announcements.
- **Founder decision required:** No.

### W21-10 -- `GET /v1/conversations` marks `seller_id` and `cursor` as required

- **Severity:** Info.
- **Category:** API contract.
- **Affected component:** client.
- **Expected behavior:** the published parameters match use: `seller_id` with `as=seller` only, and
  `cursor` optional.
- **Actual behavior:** both are marked required in `contracts/openapi.json`. The first page sends no
  cursor; the Buyer side has done this at runtime since WO-013.
- **Reproduction:** the spec.
- **Root cause:** a generator or decorator detail.
- **Fix implemented:** none needed in the client.
- **Commit:** --.
- **Regression test:** --.
- **Verification:** WO-013 runtime (Buyer side).
- **Current status:** OPEN.
- **Remaining risk:** a strict generated client would demand both.
- **Founder decision required:** No.

### W21-11 -- What an ADMIN's reply is recorded as is not documented

- **Severity:** Low.
- **Category:** Sender attribution.
- **Affected component:** `MessageBubble` labels.
- **Expected behavior:** the store sees who answered.
- **Actual behavior:**
  - The app shows the server's kind: `SELLER` as "Store owner", `TEAM_MEMBER` as "Store team
    member".
  - Whether the server records an ADMIN as `TEAM_MEMBER` (or as `SELLER`) is not stated in the
    sources read.
- **Reproduction:** an ADMIN replies (native or probe).
- **Root cause:** CHAT S7 names SELLER_OWNER and TEAM_MEMBER; the API's mapping for ADMIN was not
  observable.
- **Fix implemented:** the label follows the server's kind; nothing is inferred from the role.
- **Commit:** `d365615`.
- **Regression test:** seller-chat 52, 53.
- **Verification:** Jest (OWNER and SALES_SUPPORT).
- **Current status:** OPEN (unverified).
- **Remaining risk:** if the server recorded an ADMIN as `SELLER`, the label "Store owner" would be
  wrong for that message.
- **Founder decision required:** No (verify in the probe).

### W21-12 -- The escalation line is worded for the Buyer

- **Severity:** Low.
- **Category:** Content / UX.
- **Affected component:** history, automated answers.
- **Expected behavior:** the store reads automated lines in words meant for the store.
- **Actual behavior:** `chat.bot.escalated` renders its only catalogue text, "Your question has
  been passed to the seller. They will reply here.", under "Automated answer". It is the Buyer's
  sentence.
- **Reproduction:** a conversation with an escalation.
- **Root cause:** one catalogue string per template, written for the Buyer.
- **Fix implemented:** none. No store-side sentence was invented.
- **Commit:** --.
- **Regression test:** seller-chat 19-28 (the line renders, labelled Automated answer).
- **Verification:** Jest.
- **Current status:** OPEN.
- **Remaining risk:** mild confusion. The label makes clear it is an automated line to the Buyer.
- **Founder decision required: Yes.** Approve a store-side sentence for the same template, for
  example "The Buyer asked for a person to reply." It would go in a `packages/locale` change with a
  human translation.

---

## Security review findings (S21-)

From the independent review (`WO-021-SECURITY-REVIEW.md`). There were no Critical, High or Medium
findings. The fix commit is `c4b9ad1`.

### S21-01 -- Only two 403 codes counted as "denied"

- **Severity:** Low.
- **Category:** Security defect (permission revocation).
- **Affected component:** `src/buyer/chat.ts` (stop set), `src/seller/SellerMessages.tsx`.
- **Expected behavior:** any refusal for the role stops reading and says "not available".
- **Actual behavior (before):** a 403 with another code, such as `STEP_UP_REQUIRED`, kept cached
  history on screen and was re-read every 30 s.
- **Reproduction:** a history or list answer of 403 `STEP_UP_REQUIRED`.
- **Root cause:** classification by code instead of by status.
- **Fix implemented:** `isForbidden` (any 403 problem) for the store's denied state. On the store's
  side, any 400, 403 or 404 is final.
- **Commit:** `c4b9ad1`.
- **Regression test:** "S21-01, S21-02".
- **Verification:** Jest, 31 of 31.
- **Current status:** RESOLVED.
- **Remaining risk:** none known.
- **Founder decision required:** No.

### S21-02 -- A refused read was repeated on focus and on reconnect

- **Severity:** Info.
- **Category:** Security defect (excess requests after refusal).
- **Affected component:** `useConversationMessages` (store scope).
- **Expected behavior:** no re-read after a final refusal.
- **Actual behavior (before):** TanStack's refetch on focus and on reconnect still ran.
- **Reproduction:** a 403, then the connection drops and returns.
- **Root cause:** only `refetchInterval` was gated.
- **Fix implemented:** `refetchOnWindowFocus` and `refetchOnReconnect` return false for a final
  refusal (store scope).
- **Commit:** `c4b9ad1`.
- **Regression test:** "S21-01, S21-02" (offline, online, 95 s: no read).
- **Verification:** Jest.
- **Current status:** RESOLVED.
- **Remaining risk:** none.
- **Founder decision required:** No.

### S21-03 -- A gateway 5xx or an unreadable acceptance counted as "not sent"

- **Severity:** Low.
- **Category:** Security defect (duplicate message on retry).
- **Affected component:** `src/seller/seller-chat.ts`.
- **Expected behavior:** an outcome that may have stored the reply keeps its key.
- **Actual behavior (before):** a 504 without a problem body, or a 201 without a `message_id`, ended
  the intent. The next Send got a new key, so the Buyer could receive the reply twice.
- **Reproduction:** a 504 answer with no body, then Send again.
- **Root cause:** the shared `wasAnswered` treats every non-network failure as answered.
- **Fix implemented:** `settled()` on the store side. Both cases are now unknown: "may already have
  been received", with Try sending again (same key) or Edit the message instead.
- **Commit:** `c4b9ad1`.
- **Regression test:** "S21-03". A mutation restoring `wasAnswered` fails it.
- **Verification:** Jest.
- **Current status:** RESOLVED (store side). **OPEN on the Buyer side**: the same pattern was left
  unchanged, because WO-021 keeps Buyer behaviour as it is. Recommended for a Buyer work order.
- **Remaining risk:** Buyer-side duplicate after a gateway 5xx.
- **Founder decision required:** No.

### S21-04 -- Same-Account attribution depends on the server

- **Severity:** Info.
- **Category:** Authorization (backend unverified).
- **Affected component:** `POST /v1/conversations/{id}/messages`.
- **Expected behavior:** with `X-Adulis-Seller`, the reply is the store's.
- **Actual behavior:** the client always sends the header (test 54, mutation-checked). The server
  side was not observed.
- **Reproduction:** runtime probe (W21-03).
- **Root cause:** no probe was possible.
- **Fix implemented:** none on the client; no guess was added.
- **Commit:** --.
- **Regression test:** seller-chat 54 (client side).
- **Verification:** Jest only.
- **Current status:** OPEN.
- **Remaining risk:** if the server ignored the header for MOBILE, the reply would be stored as the
  Buyer's.
- **Founder decision required:** No. It needs a backend negative test (with W21-02).

### S21-05 -- Conversation ownership under the store header is the server's check

- **Severity:** Info.
- **Category:** Authorization (backend unverified).
- **Affected component:** history and send by id.
- **Expected behavior:** another store's conversation is refused.
- **Actual behavior:** the client relies on the server's 404 and shows "not available" (tests 34,
  36, 17).
- **Reproduction:** a deep link with another store's conversation id.
- **Root cause:** ownership cannot be checked on the client.
- **Fix implemented:** neutral 404 without `refused()`.
- **Commit:** `d365615`.
- **Regression test:** seller-chat 34, 36.
- **Verification:** Jest only.
- **Current status:** OPEN.
- **Remaining risk:** depends on the server.
- **Founder decision required:** No. It needs a backend test.

### S21-06 -- "Same session" decided by object identity

- **Severity:** Info.
- **Category:** Idempotency.
- **Affected component:** `useStoreReply`.
- **Expected behavior:** a retry in the same session replays the key.
- **Actual behavior (before):** correct today, but a recreated bound API would have minted a new
  key.
- **Reproduction:** n/a.
- **Root cause:** `held.api === api`.
- **Fix implemented:** `held.api.isCurrent()`.
- **Commit:** `c4b9ad1`.
- **Regression test:** seller-chat 43-45, 49.
- **Verification:** Jest.
- **Current status:** RESOLVED.
- **Remaining risk:** none.
- **Founder decision required:** No.

### S21-07 -- The refactor changed Buyer polling on 403

- **Severity:** Info.
- **Category:** Buyer regression.
- **Affected component:** `useConversationMessages`.
- **Expected behavior:** Buyer behaviour unchanged.
- **Actual behavior (before):** the Buyer's polling also stopped on two 403 codes.
- **Reproduction:** n/a.
- **Root cause:** one stop set for both sides.
- **Fix implemented:** the stop set is now per scope; the Buyer side stops on NOT_FOUND only, as in
  WO-013.
- **Commit:** `c4b9ad1`.
- **Regression test:** Buyer chat 69 of 69.
- **Verification:** Jest.
- **Current status:** RESOLVED.
- **Remaining risk:** none.
- **Founder decision required:** No.
