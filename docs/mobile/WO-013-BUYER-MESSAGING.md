# WO-013 -- Buyer-Seller conversations and messaging

Work order WO-013 (12 November 2026). Branch `mobile/wo-013-buyer-messaging`, from the WO-012
checkpoint `37bfd566112ebde9429c7b6d277eea63a3a9be5a`. Engineering record; no backend change.

**Scope honesty.** This is the subset of ADU-CHAT-01 v3.3 that the existing Chat API supports.
`WO-013-CHAT-CONTRACT-GAPS.md` lists every design requirement and its status. The canonical Chat
design is not complete.

## 1. Sources

- **Design:** ADU-CHAT-01 v3.3 S1-S19 (identity, subjects, senders, states, connectivity,
  security); ADU-CHATBOT-01 v3.3 S3, S18-S19, S31, S71 (no model prose, labelling, escalation);
  ADU-MOB-02 v4.3 S123-S130, S161, S232 (R-07, R-09).
- **API:** `POST /v1/conversations`, `GET /v1/conversations?as=buyer`,
  `GET /v1/conversations/{id}/messages`, `POST /v1/conversations/{id}/messages`,
  `POST /v1/conversations/{id}/escalate` (ADU-API-01 S12.7). None publishes a schema.
- **Server behaviour checked (read only):** `apps/api/src/modules/chat`.
  - Create-or-return on the (Buyer, Seller, Market) pair; ACTIVE or CLOSING Sellers only.
  - Lists: 25 conversations a page, 50 messages a page, newest first, with timestamp cursors.
  - Membership is checked on every conversation call (404 otherwise).
  - Text is 1-4,000 characters; a Product anchor must be the Seller's and PUBLISHED.
  - BOT rows carry a template key. Escalation is Buyer-only and notifies the Seller's owner.

## 2. What the Buyer can do

| Where | What | Endpoint |
|---|---|---|
| Seller Profile | **Message Seller** (under the profile header). A guest is sent to sign in, returning to Messages | `POST /v1/conversations` with the profile read's `seller_id`, one idempotency key per intent |
| You, then Messages (and `/messages`) | The conversations, newest activity first: store name, @handle, "Last message {time}"; Refresh; pull to refresh; Load older | `GET /v1/conversations?as=buyer` |
| A conversation (`/chat/[conversationRef]`) | Messages oldest at the top; Load earlier; Refresh; a re-read every 30 s while the screen is focused in the foreground | `GET /v1/conversations/{id}/messages` |
| The composer | Plain text, 1-4,000 characters; Send | `POST .../messages {text}`, one key per draft |
| After an automated answer | **Ask the Seller** | `POST .../escalate`, one key per automated answer |

- **No new tab and no deep link.** The navigation decision is not made, so Messages lives under
  You and on the Seller Profile, with no new tab. Routes use typed parameters; no external link
  is constructed.

## 3. Attribution

| Server `sender_kind` | Label shown | Notes |
|---|---|---|
| BUYER | You | Right-aligned |
| SELLER | Seller | The store owner (the server decides) |
| TEAM_MEMBER | Seller team | Never presented as the owner |
| BOT | Automated answer | Its own styling (info colours, a thicker border). Never drawn as a Seller reply |

- **Bot rows** carry a template key, never prose. The app renders only `chat.bot.*` catalogue
  copy (today `chat.bot.escalated`: "Your question has been passed to the seller. They will reply
  here.").
- **Any other template** shows "This automated answer cannot be shown." No raw key is displayed
  and no slot is filled in.
- **Message bodies** are plain text in a Text element. Nothing is linkified or opened.

## 4. Sending (connected-only)

- **Acceptance.** A message counts as sent only when the server answers 201 with a `message_id`.
  Until then the draft stays in the box with "Sending your message". On a failure it stays, and
  the app says it was not sent, with the reason.
- **No queue.** Nothing is stored or retried in the background.
- **One idempotency key per draft text,** kept across a lost connection: a retry of the same text
  replays rather than sends twice. A server answer, or a changed text, starts a new intent.
- **Double taps.** A ref blocks a second tap while one send is in flight.
- **Limits.** An empty or whitespace-only message cannot be sent. Over 4,000 characters the field
  says so and Send is disabled (checked before sending; the server enforces the same limit).
- **No anchors.** No Product, Scene or Order anchor is sent (contract gaps rows 3-6).

## 5. Refresh and latency

- **When messages refresh:** on opening, on Refresh or pull, and every 30 seconds while the
  conversation screen is focused and the app is in the foreground (TanStack `refetchInterval`;
  window-focus semantics pause it in the background).
- **Latency.** A Seller reply appears within about 30 seconds while the Buyer watches, or at the
  next refresh. Delivery is never claimed to be live. There is no push, presence, typing or read
  receipt.

## 6. Security and privacy

- **Session-bound reads.** Every read is bound to the session on screen: a late answer is refused,
  never shown, and `clearSession` clears the cache.
- **Session changes.** The conversation screen leaves if its session ends or changes; the unsent
  draft (in-memory only) goes with it.
- **Seller identity** is the profile read's `seller_id`, never a handle, name or route parameter.
  The screen title comes from the cached conversation list, else "Conversation"; a link cannot
  set it.
- **References.** A malformed conversation reference is refused before any request. The server's
  404 (another Account's or an unknown conversation) shows "This conversation is not available."
- **Scope.** `as=buyer` is fixed; `X-Adulis-Seller` is never sent.
- **No logs and no commerce.** No message text is logged. No checkout, cart or payment path
  exists, and every test asserts none is called.

## 7. Tests

- **Jest:** `src/buyer/chat.test.tsx`, 18 tests against an in-memory chat server on the API's
  rules, numbered by the section 34 matrix.
  - Rows 19 and 20 (cross-Seller and restricted Product anchors) are covered by the app sending
    no anchor; the server's checks are in the API suite.
  - Rows 24 and 25 (Dark, enlarged text) are native.
  - Mobile suite: 351/351.
- **Native results:** `WO-013-FOUNDER-HANDOFF.md`.
