# WO-014 -- Product-context messaging: security review

Work order WO-014 (12 November 2026). An independent, read-only review of the change
`706e894..a2e5a18` (and its tests), done by a separate reviewer with the requirements and the code,
not with the implementer's conclusions. It did not read `apps/api` or `apps/console` (workspace
boundary) and did not run the app. The fixes are in commit `a4c7229`.

Result: **no Critical or High finding. One Medium and two Low findings, all fixed with regression
tests. Three Info notes remain, recorded below.**

## 1. Scope

- `apps/mobile/src/buyer/MessageSellerButton.tsx`: Ask Seller About This Product, Seller resolution.
- `apps/mobile/src/buyer/Conversation.tsx`: the composer's Product context, revalidation, the
  idempotency intent, the unconfirmed-send lock.
- `apps/mobile/src/app/(buyer)/chat/[conversationRef].tsx`: route parameter validation.
- `apps/mobile/src/api/client.ts`: `sendMessage` with an optional `product_id`.
- `apps/mobile/src/buyer/ProductDetail.tsx`: the entry point.
- Helpers read for context: `saved.ts` (`usePrivateApi`, `keepIfCurrent`), `auth/session.tsx`
  (`boundApi`), `auth/sign-in-flow.ts` (return allowlist), `public-read.ts` (`isPathName`).

## 2. Findings and resolution

| # | Severity | Finding | Resolution |
|---|---|---|---|
| M-1 | Medium | The screen paged the Buyer's conversation list (to find the conversation's Seller) with an effect that depended on an object rebuilt every render. A later page that failed with a server error (not retried) was requested again back to back: battery and API load, including through a 429. | Fixed: the walk stops on a list failure, the context says "could not be checked", and Try again re-reads the list. Test "review M-1"; against the original effect that test never finishes (the loop), against the fix it passes. |
| L-2 | Low | While a send was unconfirmed, a retry compared the fresh Product id only with the screen's own read, which refreshes on reconnect. A Product re-created under the same slug would have gone out under a NEW key with a different `product_id`, while the first message might already be stored. | Fixed: an unconfirmed send replays its own payload or nothing; a different id is refused as a mismatch and stays unconfirmed. Only "Edit the message instead" starts a new intent. Test "review L-2". |
| L-3 | Low | The conversation route is one screen per conversation. Entering it again with another Product (a link, or a future path) kept the first context. What was shown still matched what would be sent, but not what the Buyer asked about. | Fixed: re-entry replaces the context (or clears it), except while a send is in flight or unconfirmed. Test "review L-3". |
| I-4 | Info | The Product's Seller is matched by handle (storefront read versus the Product; the Product versus the conversation list), not by id. STOREFRONT-02 S12 lets a released handle move after a quarantine; handle history is not built (OVN-091). | Not changed: no read carries a `seller_id` for a Product or a conversation row. The server's own check (the Product must be the conversation Seller's and PUBLISHED, else 404) bounds the impact. Recorded as a contract gap (ON-20261111-162). |
| I-5 | Info | Any 404 on an anchored send is shown as "This Product is no longer available to ask about", even if the conversation itself was not found. | Not changed: the message is imprecise but discloses nothing; a missing conversation also fails its message read and the screen shows "not available". |
| I-6 | Info | A link `adulis://chat/<id>?productHandle=...&productSlug=...` can preselect any public Product of that conversation's Seller. | Accepted: the Product is visible in the composer, the Buyer still types and taps Send, and the server re-checks it. |

## 3. Checked and found sound

- **Untrusted input.** Route parameters are validated as path names and used only as the lookup
  keys of the screen's own public read. Nothing about a Product is drawn from them. The Product's
  name and availability are shown only while that read is current and its Seller is the
  conversation's. The `product_id` sent is the fresh read's id and must equal the id on screen.
  The `seller_id` comes from the storefront read, must be a UUID, and is used only when that read
  answers for the same handle. A handle is never used as an id.
- **Market isolation.** The storefront read, both Product reads and the conversation calls all go
  through the same session-bound client, so they carry the same bearer and resolve in the same
  Market. Market B's Seller with the same handle, and its Woven basket, are never reached (the
  native run's stored anchors are the device Market's Product ids).
- **Unpublished Products.** The read answers 404 and the context shows a neutral line with no
  name or availability. A lost connection or a timeout says "could not be checked", never
  "removed".
- **Sessions and Accounts.** `boundApi` refuses at send time once the session has changed, so
  nothing is sent under another Account. `keepIfCurrent` drops late answers. The screen leaves
  on a session change. The draft and the context live in component memory only (no persistent
  store). Sign-out clears the query cache and the context query keeps nothing (`gcTime: 0`).
- **Guests.** `returnTo` goes through the sign-in allowlist (`/product/{handle}/{slug}`), so it
  cannot redirect elsewhere. Nothing is armed for after sign-in, so nothing is created or sent.
- **Idempotency.** The intent is the whole payload: text and Product, or none. An absent Product
  is omitted from the body (never `null`), so a replay is byte-identical.
- **Logging.** No logging was added. Message text, tokens and codes are never logged.

## 4. What was not reviewed

- The API's own enforcement (`apps/api` is outside this workspace session's boundary); its
  behaviour is taken from ADU-API-01 S12.7 and the CHAT design.
- iOS (not tested in this work order).
