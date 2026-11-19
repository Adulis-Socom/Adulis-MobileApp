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
| CONFIRMED_FAILED | The API's own problem envelope (ProblemDto's required `title_key`, `request_id`, `retryable`, and a `status` equal to the HTTP status; review S22-01). In the Buyer conversation only a 4xx other than a key conflict (409) or a rate limit (429); on a replay only a 400, a 413 and a 404 (see section 7 for the 404). In the Seller reply any status of that envelope (the older rule, see section 7) | "...was not sent", text kept, intent ended. After a 404 the conversation is re-read first (`rereadAfter`). The next Send gets a new key |
| UNKNOWN_OUTCOME | Anything else: offline, timeout, a gateway 4xx/5xx without the API's problem envelope (including JSON carrying only a `code`), a 201 that cannot be read or has no message id; in the Buyer conversation also the API's own 5xx, 429 and 409, and on a replay a refusal the server raises before it looks at its record (a client too old, a recovery window, the wrong audience, a missing session) | "Your message may already have been received..." The text, Product, conversation and key are frozen. **Try sending again** replays them; **Edit the message instead** gives the intent up. The conversation is re-read so a stored message appears |
| SENDING | Request in flight | "Sending your message"; Send disabled; a ref blocks a second tap |
| IDLE | Otherwise | -- |

A 404 on a replay can stay unknown after an earlier attempt that never got an answer: see section 7.

**Why the API's problem body is the boundary.**
- The transport (`src/api/client.ts` `readProblem`) accepts any JSON object with a string `code` as a
  problem. For a Chat send that is too loose, because a gateway can send `{ code }` too (review
  S22-01). The send rule therefore also requires the contract's envelope fields. Only the API sends
  those.
- In the Buyer conversation a 5xx problem from the API itself is unknown, not definite. The server
  stores the message and its idempotency record in one transaction, and a connection lost at the
  commit answers 503 although the commit happened, so the key is kept and the same message is sent
  again under it (a stored message comes back as stored). The Seller reply keeps the older rule: see
  section 7.
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

## 7. Later refinements (Buyer side)

**A missing conversation or Product on a replay.** The server raises a 404 for a missing conversation
or Product inside its handler, after it has looked up the idempotency record. On a replay that
normally proves that nothing is stored under the key, so it stays the API's own definite refusal:
"not sent", intent ended. One case is different. An earlier attempt of the same message ended without
an answer from the API (offline, a timeout, a gateway page, an unreadable acceptance), and the server
may still be running it: it can store the message after the 404. A 404 on a later attempt then leaves
the outcome unknown. The text, Product and key stay frozen, **Try sending again** stays offered, and
only the hedged sentence is drawn (not the "not sent" sentences, and no line of the server's own
text). A 400, a 413, the first attempt's own 404 and a 404 after attempts the API did answer are
unchanged. Ask the Seller follows the same rule for its own key. The state ends when a replay is
answered, when the Buyer chooses **Edit the message instead** (a new message, which could arrive
twice), or when the key reaches its safe age.

**Edit the message instead** reads the conversation again in the background as the editor opens, so
the line saying that a message with the same text now appears can catch up while the Buyer edits.
Send is not held back for that read. If the read fails, or is waiting for a connection, the box says
so ("The messages could not be loaded." or the offline sentence), so that no such line is not taken
for "not stored". That line is advisory only: it never settles a send.

**The next message after an accepted one.** After a 201 the send lock ends with the request. The next
message can be sent at once, while the conversation is still being read again. A history row whose id
the server has answered a send of the screen with is never offered as that line for a later message
with the same words.

**Retry-After written as a date** is measured against the `Date` header of the same answer only when
that header has the HTTP-date form (English day and month names, GMT). Otherwise the device clock is
used.

**Signing in over a live session** as a different credential clears the query cache, the active mode
and a pending Save, as signing out does. A guest signing in keeps what a guest holds.

**The Seller reply keeps the older rule.** Everything in this section is the Buyer conversation. The
store's reply (`src/seller/seller-chat.ts`) still ends its intent on any answer that carries the API's
envelope, at any status, so it does not keep the key after a 5xx or after a 404 that follows an
attempt that never got an answer. Whether the Seller reply and the 5xx rule should follow the Buyer
conversation is an open product decision.
