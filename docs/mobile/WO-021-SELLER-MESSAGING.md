# WO-021 -- Seller Companion messaging

12 November 2026. Branch `mobile/wo-021-seller-companion-messaging`, from
`mobile/wo-020-seller-companion-foundation` at `d6dd399`. This adds store-side messaging to the
Seller Companion, built on the existing Chat API. No backend, contract, database or native change
was made.

Related records:
- `WO-021-CHAT-API-CAPABILITY-MATRIX.md`: endpoints, permissions, classification.
- `WO-021-SECURITY-REVIEW.md`
- `WO-021-ISSUES-AND-BLOCKERS.md` (W21- IDs)
- `WO-021-FOUNDER-HANDOFF.md`
- `WO-021-REVIEW-GUIDE.md`
- `MOBILE-NATIVE-VALIDATION-BACKLOG.md`: the WO-021 section.

## What was built

### Inbox (`src/seller/SellerMessages.tsx`, `/seller/messages`)

- **Messages** on Seller Home, above Store notifications, for the active store.
- `GET /v1/conversations?as=seller&seller_id={store}` with `X-Adulis-Seller: {store}`. The server
  sorts by last activity.
- Each row reads **"Buyer conversation"** and **"Last activity {time}"**. If the time is not valid,
  the row shows "Started {time}" instead.
- No Buyer name, photo, handle, preview or unread count exists in the API, so none is shown.
- `buyer_account_id` is not read at all, so it can never become a label (W21-04).
- Cursor paging (Load more, the shared list footer), **Refresh conversations**, and pull to refresh.
- States: offline (never "no conversations"), server or contract failure with Retry, and empty.
- **Any 403** (`PERMISSION_DENIED`, `AUDIENCE_NOT_PERMITTED` or another code; review S21-01) shows "Messaging is not available for
  your role in this store." The session and the store stay.
- **404 on the list** means the store is no longer this Account's. The existing WO-020 `refused()`
  ends the selection and re-reads the store list.
- **401** uses the existing session handling: the session ends and Seller mode is left.

### Conversation (`/seller/messages/{conversationId}`)

- **Route parameter:** untrusted. Only a UUID is read; anything else shows "not available" and sends
  nothing.
- **History:** `GET /v1/conversations/{id}/messages` with the store header, using the Buyer side's
  checked parser and the shared `MessageBubble`.
- **Sender, in the store's words:** Buyer, **Store owner** (`SELLER`), **Store team member**
  (`TEAM_MEMBER`), **Automated answer** (`BOT`). The kind is the server's; the client never infers
  it.
- **Automated answers:** only `chat.bot.*` catalogue copy renders. Anything else shows "This
  automated answer cannot be shown."
- **Anchors:** "About a Product" and "About an order". Neither is ever named.
- **Reading:** Load earlier messages (cursor), **Refresh messages**, and a re-read every **30 s** while
  the screen is focused and the app is in the foreground.
- **Polling stops** when the screen is left, when the app goes to the background, and on any 400,
  403 or 404. A refused read is not repeated on return to the foreground or on reconnect either
  (review S21-01, S21-02).
- **404:** "This conversation is not available." It **does not** call `refused()`: one conversation's
  404 never ends the store selection.
- **403:** "not available for your role". No composer, no polling, no sign-out.
- **Offline:** shown as offline, never as deleted.

### Replies (`src/seller/seller-chat.ts` `useStoreReply`)

- Plain text, 1 to 4,000 characters after trimming. Over the limit, the field shows "A message can
  be up to 4,000 characters." and Send is off.
- The body is `{ text }` only. `sender_kind`, `sender_account_id` and `seller_role` are never sent;
  the server derives the sender from the session and the store header.
- **One intent:**
  - It holds the session (the bound API, matched by being current; review S21-06), the store, the
    conversation, the text and its `Idempotency-Key`.
  - A retry of the same intent replays the same key, so the server stores the reply at most once.
  - A different text, store, conversation or session is a new intent with a new key.
- **Shown as sent only when the server accepts it:** a 201 with a UUID `message_id`. There is no
  optimistic message and no offline queue.
- **Server refusal** (an answer):
  - The intent ends and the text stays.
  - 403: "Your role cannot send messages in this store. The reply was not sent."
  - 404: "This conversation is not available right now. The reply was not sent." (the history is
    re-read, and `refused()` is not called)
  - Anything else: "Your message was not sent..." with the server's message.
- **No answer** (offline, timeout, a gateway 5xx without the API's problem body, or a 201
  without a readable message id; review S21-03):
  - "Your message may already have been received...". The text is frozen.
  - **Try sending again** replays the same key.
  - **Edit the message instead** gives the intent up, and the edited text gets a new key.
- A ref blocks a double tap. Outcomes are announced for TalkBack.

### Isolation

- **Query keys:**
  - `['seller', storeId, 'conversations', subject, generation]` (the shared public-list key)
  - `['seller', storeId, 'conversation', conversationId]`, `gcTime 0`
  - The Buyer's `['conversation-messages', id]` is never used for store data. Nothing is persisted.
- **Every screen is keyed by the active store.** Changing store unmounts it, together with its
  draft and any unconfirmed intent.
- **The store's intent cannot be replayed** under another store, conversation or session.
- **A late answer:**
  - For an earlier session it is refused (`keepIfCurrent`).
  - For another store it lands under that store's key only.
- **Sign-out:** the Seller gate unmounts the whole mode, and the session clear empties the cache.
- **Same Account on both sides:** history and replies always carry the store header, so a reply
  from Seller mode is the store's (test 54).

## Shared code (no second Chat engine)

- `src/buyer/chat.ts` `useConversationMessages(ref, focused, scope)` takes a `ChatScope` (`buyer`
  or `seller` + store). Both sides use the same parser, sorting, paging, retry and polling.
- `src/buyer/MessageBubble.tsx` is the bubble extracted from the Buyer conversation, with the sender
  named in the viewer's words. The Buyer side is unchanged (69 Buyer chat tests still pass).
- `src/api/client.ts`: `sellerConversations`, `sellerConversationMessages`, `sendSellerMessage`. Each
  uses the client's existing `seller` option: UUID-checked, refused before sending if invalid.
- `WithStore` (from `SellerOrders.tsx`, now exported) gives the inbox and the conversation the same
  "wait for the store list" behaviour as Orders.

## Strings

20 `seller.messages.*` keys in `packages/locale` (English, plus Amharic machine translations
recorded in `MT-KEYS.md`; Amharic stays disabled for users). Committed separately: `9e350bb`.

## Tests

`src/seller/seller-chat.test.tsx`, 31 tests on the real route tree against an in-memory Chat server
with the API's scope rules. They cover the work order's matrix 1-56 (numbers in the test names) and the two
security-review fixes.
Every test also checks the following:
- no conversation is created;
- every POST body is exactly `{ text }` and carries the store header;
- no escalation, Order, payment, refund, reservation or read-all request is sent.

Mutation checks:
- With the store header removed from the send, test 54 fails: the server records the reply as
  `BUYER`.
- With the old answered/unknown rule restored, test S21-03 fails.

Commands (from `apps/mobile`):

```
node scripts/check-locale-imports.mjs && npx jest --runInBand
```

Results:
- Seller chat: 31 of 31.
- Buyer chat: 69 of 69.
- Full mobile suite: 27 suites, 492 of 492, exit 0, run in band (490 before the review fixes).

`pnpm --filter @adulis/mobile test -- --runInBand` was not used: it runs no tests (WO-020).

## Not built (by the work order or the contract)

- Anchored Seller replies.
- Conversation creation.
- Buyer profile.
- Unread counts.
- Previews.
- Push, WebSockets, presence, typing and read receipts.
- Quick replies and attachments.
- Archive, mute, block and report.

Native validation is owed, and none was run: see the backlog.
