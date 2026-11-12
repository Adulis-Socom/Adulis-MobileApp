# WO-022 -- Messaging reliability hardening

12 November 2026. Branch `mobile/wo-022-messaging-reliability-hardening`, from
`mobile/wo-021-seller-companion-messaging` at `e5e4a6e`. No backend, contract, database, dependency
or native change.

Related records:
- `WO-022-SELLER-MESSAGING-UX.md`
- `WO-022-SELLER-CHAT-CONTRACT-RECONCILIATION.md`
- `WO-022-SECURITY-REVIEW.md`
- `WO-022-ISSUES-AND-BLOCKERS.md` (W22- IDs)
- `WO-022-FOUNDER-HANDOFF.md`
- `WO-022-REVIEW-GUIDE.md`

## 1. The defect (S21-03 on the Buyer side, W22-01)

The Buyer conversation decided a failed send with the shared `wasAnswered(error)`. That rule treats
every failure except offline and timeout as "the server answered, the message was not stored". Two
cases broke the assumption.

**Case 1: a gateway answer without the API's problem body.** A 502, 503 or 504 HTML page or empty
body from a proxy can arrive **after** the API has stored the message.

**Case 2: an unreadable acceptance.** A 201 whose body cannot be read, or names no `message_id`, is
probably a stored message.

In both cases the Buyer saw "Your message was not sent". The intent was dropped, so the next Send
used a **new idempotency key** and the Seller could receive the message twice. WO-021 had already
fixed this on the store's side with a narrower, store-only rule.

## 2. The correction: one Chat send-outcome rule

`sendOutcome(failure)` in `src/buyer/chat.ts`, used by the Buyer conversation and the store's reply
hook. **Other mutations keep `wasAnswered`** (Collections, authentication, Account deletion,
notifications, escalation).

| Logical state | When | What the app does |
|---|---|---|
| CONFIRMED_SENT | 201 with a UUID `message_id` | Shown in the conversation, composer cleared, intent ended |
| CONFIRMED_FAILED | The API's own problem envelope (ProblemDto's required `title_key`, `request_id`, `retryable`, and a `status` equal to the HTTP status; review S22-01), any status, including 5xx and 401 | "...was not sent", text kept, intent ended. After a 5xx, 409 or 404 the conversation is re-read first (`rereadAfter`). The next Send gets a new key |
| UNKNOWN_OUTCOME | Anything else: offline, timeout, a gateway 4xx/5xx without the API's problem envelope (including JSON carrying only a `code`), a 201 that cannot be read or has no message id | "Your message may already have been received..." The text, Product, conversation and key are frozen. **Try sending again** replays them; **Edit the message instead** gives the intent up. The conversation is re-read so a stored message appears |
| SENDING | Request in flight | "Sending your message"; Send disabled; a ref blocks a second tap |
| IDLE | Otherwise | -- |

**Why the API's problem body is the boundary.**
- The transport (`src/api/client.ts` `readProblem`) accepts any JSON object with a string `code` as a
  problem. For a Chat send that is too loose, because a gateway can send `{ code }` too (review
  S22-01). The send rule therefore also requires the contract's envelope fields. Only the API sends
  those.
- A 5xx problem from the API itself stays definite. The server keeps a refusal against its key
  (ADU-API-01 S8), so a replay would only repeat it forever.
- Anything without that body cannot prove the message was not stored.

**Never weaker than WO-021 on the store side:**
- The store-only rule's cases (gateway 5xx, unreadable 201) remain unknown.
- A gateway 4xx without the API's problem (for example an edge 413) is now unknown too. It was a
  definite refusal before.

## 3. Product-context invariants (WO-014/WO-015 preserved)

While a Buyer send is unknown, its payload is frozen:
- the text field is not editable;
- **Remove Product** and **Change Product** are disabled;
- a link that enters the conversation with another Product does not replace the frozen Product
  (route `productHandle`/`productSlug` changes are ignored while frozen).

On **Try sending again**, the Product is re-read first, as before. The outcomes:

| Re-read result | Retry |
|---|---|
| Same Product id, conversation's Seller | Sent with the **same** text, `product_id` and key |
| 404 (unpublished between attempts) | **Nothing sent**; "This Product is no longer available"; the outcome stays unknown; the anchor is not dropped |
| Offline or unreadable | **Nothing sent**; "could not check"; unknown; Try again on the Product, then the same retry |
| Another id or another Seller | **Nothing sent**; mismatch; unknown |

To send something else, the Buyer must press **Edit the message instead**: an explicit abandonment.
Only then can the Product be removed or changed, and the next Send gets a new key.

**The backend's idempotency behaviour is not assumed.** A replay is only ever the identical payload
under the same key. The app never asks the server to accept a changed payload under an old key.

## 4. Isolation

| Situation | Protection |
|---|---|
| Sign-out, session expiry, Account switch during a send | The conversation screen belongs to the session it opened in and leaves when it changes. A late answer checks `isCurrent()` before touching state. A 401 problem is CONFIRMED_FAILED and the session ends |
| Conversation switch on the same screen (route parameter change) | **Fixed (W22-02).** The Buyer route keys the screen by the conversation, and the Seller screen by store and conversation. Before, the frozen draft and intent stayed on screen, and a Buyer retry would have replayed conversation A's message, with A's key, into conversation B |
| Closing and reopening | The intent lives in the screen, so it is dropped with it. Nothing is persisted (no draft or intent storage). The re-read shows what the server stored |
| Store switch (Seller) | Unchanged from WO-021: screens keyed by store; the intent is bound to session, store and conversation |
| Rapid taps | A ref blocks a second send while one is in flight |
| No queue | No background or durable sending. Polling only reads |

## 5. Shared Chat review (Workstream B)

These were reviewed and left unchanged:

- **Cache keys:**
  - Buyer: `['conversation-messages', id]` and `['buyer-conversations']`.
  - Store: `['seller', sellerId, 'conversation', id]` (gcTime 0) and the list's
    `['seller', sellerId, 'conversations', subject, generation]`.
  - No cross-population.
- **Ordering:** newest first; an automated answer sorts after the question it shares a time with
  (ON-153). Ids are de-duplicated across pages.
- **Cursors:**
  - `nextOf` refuses a repeated cursor.
  - A polling refetch recomputes later pages from the fresh first page, so a page boundary that
    moves does not drop a message on the client.
  - **Server side:** a timestamp cursor can split a same-time pair (W22-07, a contract item).
- **Polling:**
  - 30 s while focused and in the foreground.
  - The Buyer stops on 404.
  - The store's side stops on any 400, 403 or 404, and also on focus and reconnect (WO-021 S21-01,
    S21-02).
- **Permissions:**
  - Buyer behaviour is unchanged (WO-013).
  - The store's 403 is "not available for your role".
  - A conversation 404 never ends the store selection.

## 6. Tests

Run from `apps/mobile` with `node scripts/check-locale-imports.mjs && npx jest --runInBand`.
`pnpm --filter @adulis/mobile test -- --runInBand` was not used: it runs no tests.

**New tests:**
- `src/buyer/chat.test.tsx`, block "Uncertain-send reliability (WO-022)": 16 tests (section 21,
  1-30, and review S22-01).
- `src/seller/seller-chat.test.tsx`, two WO-022 blocks: 12 tests (sections 22-23, and review S22-01).

**Mutation check:**
- Restoring `wasAnswered` in the Buyer conversation and removing the route key fails 11 of the 15
  new Buyer tests. Among them is the conversation-switching test, which can only fail on the key
  (its loss is offline in both rules).
- Restoring the code-only refusal rule fails the two `{ code }` tests (review S22-01).
- Every mutation was restored, with no residue.

| Suite | Result |
|---|---|
| Buyer chat (`chat.test.tsx`) | 85 of 85 (69 before) |
| Seller chat (`seller-chat.test.tsx`) | 43 of 43 (31 before) |
| Full mobile suite, in band | 27 suites, 520 of 520, exit 0 (492 before WO-022) |

**Matrix map (section 21 Buyer):**

| Cases | Covered by |
|---|---|
| 1, 2, 27 | WO-022 "1, 2, 27" |
| 3 | WO-016 "20.7" (timeout) |
| 4 | WO-013 "12, 13" (offline) |
| 5-7, 11, 12, 14, 15, 30 | WO-022 gateway 502/503/504 |
| 8, 9, 28 | WO-022 unreadable / missing-id 201 |
| 10 | WO-022 "10" (5xx problem) |
| 13, 19, 20 | WO-022 anchored gateway |
| 16 | WO-013 "11" |
| 17, 18 | WO-022 "17, 18" |
| 21 | WO-022 "21" |
| 22 | WO-022 "22" |
| 23 | WO-022 "23" |
| 24, 25 | WO-016 "20.1" and WO-013 "22" (sign-out during a send, late answer after sign-out) |
| 26 | WO-022 "26" |
| 29 | WO-022 "29" |

**Section 22 (Seller, 31-42):**

| Cases | Covered by |
|---|---|
| 31 | WO-021 "37, 40, 41, 52" |
| 32-34 | WO-022 502/503/unreadable 201/gateway 413 |
| 35 | WO-021 "50, 51" |
| 36 | WO-021 "17, 49" and WO-022 route switching |
| 37 | The in-memory server's header rules (WO-021 "34, 36") |
| 38 | WO-021 13, 33, 42 and S21-01 |
| 39 | WO-021 "34, 36", "42 (404)" |
| 40 | WO-021 "54" |
| 41 | WO-021 "53" |
| 42 | The seller-chat afterEach (no creation, no sender fields, no Order, payment or read-all requests) |

**Section 23 (43-60):**

| Cases | Covered by |
|---|---|
| 43, 59 | WO-022 "43, 59" |
| 44 | WO-022 "44" |
| 45, 46 | WO-022 "45, 46" |
| 47 | WO-021 "11", "32" |
| 48 | WO-021 "12, 15" |
| 49 | WO-021 "13", "33" |
| 50, 51 | WO-021 "9, 10", "30, 31" |
| 52, 54-57 | WO-021 "19-28" |
| 53, 58 | WO-022 "53, 58" (and every test runs at Jest's font scale 2) |
| 60 | WO-022 "54, 60" and WO-021 "50, 51" |

Native checks: not run (`MOBILE-NATIVE-VALIDATION-BACKLOG.md`, "From WO-022").
