# WO-022 -- Seller messaging UX

12 November 2026. What changed in the Seller Companion's Messages, using only data the API already
returns to the store, and three proposals that need the founder or the backend.

## Implemented

| Area | Change | Data used |
|---|---|---|
| Inbox header | **"Conversations for {store} (@{handle})"** as a heading above the list, so an Account with several stores, or one that is also a Buyer, always sees which store's inbox is open | The active store's row from `GET /v1/seller/list` (verified name and handle) |
| Inbox rows | Each row reads "Buyer conversation", **"Last activity {date, time}" and "Started {date, time}"**. Before, it read the start time only when the last activity was missing. Both times are in the row's spoken label | `last_message_at`, `started_at` of the store's list |
| Conversation composer | **"Replies are sent as {store} (@{handle})."** above the reply field. It makes clear that a reply speaks for the store, which matters most when the same Account is also the conversation's Buyer | The active store's row |
| Conversation screen | Keyed by store **and** conversation: a changed conversation in the route starts with an empty composer and no unconfirmed reply (W22-02) | -- |
| Reply outcomes | The shared Chat rule (`sendOutcome`): a gateway answer without the API's problem, or an unreadable acceptance, is "may already have been received" with the same key on retry | -- |

## Already in place (WO-021), re-verified by tests

- **Sender categories:** Buyer, Store owner, Store team member, Automated answer. An automated
  answer is drawn with its own border.
- **Automated answers:** only `chat.bot.*` catalogue copy renders, else "This automated answer cannot
  be shown."
- **Anchors:** "About a Product" / "About an order", never named.
- **Times:** each message shows "Sent {date, time}" in the device locale.
- **States:**
  - Loading: the inbox shows an indicator and text; a conversation shows text.
  - Empty: "Buyer conversations will appear here when Buyers write to this store."
  - Offline: never "no conversations" or "not available".
  - Server error, with Retry.
  - Any 403: "Messaging is not available for your role in this store." No sign-out, and re-reading
    stops.
- **Accessibility:**
  - Rows are buttons with a full label and the hint "Opens the conversation".
  - Load more and Load earlier messages are buttons.
  - Send outcomes are announced.
  - Rows have a minimum height and grow with the text (no fixed height).
- **Long text:** a long unbroken message (tested with a 3,000-character URL) renders whole, with no
  line limit. The bubble is at most 88% of the width, and the platform breaks the line.

## Not shown, because the API does not provide it (and nothing is fabricated)

- Buyer name, photo, phone or handle.
- Message previews.
- Unread counts or read state.
- Human-readable conversation references.
- Product or Order names in history.

`buyer_account_id` is in the store's list rows. The app does not read it, so it can never become a
label.

## Proposal A -- a server-issued, store-scoped conversation reference (W21-04)

**Problem.** With several conversations, rows differ only by their times, and the screen title is
"Buyer conversation".

**Proposal (backend, additive):**
- `ConversationRow.store_ref`: a short reference issued by the server for each store (for example
  `C-4F7K`). It is stable for the conversation's life and unique within the store.
- It is not derived from, and does not reveal, the Buyer's Account id, phone or name.
- It could also appear on the Buyer's side, so both parties can quote it.

**Why not on the client:**
- A locally generated number (list position, hash of the id) is not stable across devices or
  sessions.
- It would look like an official reference while being neither. The work order forbids it.

**Privacy:** a reference is pseudonymous data under ADU-PRV-01 S17. It needs a decision on whether
the Buyer sees it too.

**Not proposed here:** any Buyer display label. ADU-CHAT-01 S9 leaves the Buyer's display "according
to privacy policy", and no policy exists yet (W21-04 founder decision).

## Proposal B -- per-store mobile capabilities (W21-06)

**Problem.** Messages is shown for every store role. INVENTORY, ANALYST and CAMPAIGN_MANAGER get the
server's 403. ADU-MOB-02 v4.3 line 1501 asks for capability-aware navigation ("hide unrestricted
Inbox" for INVENTORY). Hard-coding the role-to-permission map in the app would make the client
manufacture eligibility.

**Proposal (backend, additive):**
- Each row of `GET /v1/seller/list` gains `mobile_capabilities`: the subset of the store's
  permissions that the caller holds AND that carry the MOBILE surface. For example
  `["seller.messages:read", "seller.messages:send", "seller.orders:read"]`.
- The app hides an entry whose capability is absent.
- The server still checks every request, so the list is a presentation hint, never authority.

**Until then:** the entry stays visible, and the 403 reads "not available for your role". **No fake
permissions endpoint was added.**

## Proposal C -- store-side wording for the escalation line (W21-12)

**Problem.** `chat.bot.escalated` renders its only catalogue text, written for the Buyer: "Your
question has been passed to the seller. They will reply here." The store sees it under "Automated
answer".

**Proposed store-side copy (English, for approval):**

> **The buyer requested a response from your team.**

**Implementation once approved (mobile only; the template, the chatbot engine and the Buyer's text
are unchanged):**
- A new key, `seller.chat.bot.escalated`, in `packages/locale` with a human Amharic translation (no
  machine placeholder for approved copy).
- On the store's side, `MessageBubble` renders that key for an automated message whose template is
  `chat.bot.escalated`.
- Other templates keep the shared rule.

**Status: DEFERRED.** W21-12 stays open: new presentation copy needs founder approval, and no
approved Amharic exists. **Nothing was implemented.**
