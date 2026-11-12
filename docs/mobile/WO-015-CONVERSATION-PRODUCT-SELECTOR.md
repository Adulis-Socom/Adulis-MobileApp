# WO-015 -- In-conversation Product selector

Work order WO-015 (12 November 2026). Branch `mobile/wo-015-conversation-product-selector`, from
the WO-014 checkpoint `c8efdb8424ddda79505a5eb597ecc33944b76c2c`. Engineering record. There is no
backend change, no new endpoint and no contract change.

## 1. Sources

- **Design:** ADU-CHAT-01 v3.3 S4-S5 (the composer's Product selector; the selection describes
  the next message only; each message keeps its own subject), ADU-MOB-02 v4.3 R-07.
- **API (ADU-API-01 S12.7):**
  - `GET /v1/conversations?as=buyer` (the conversation's Seller handle);
  - `GET /v1/storefronts/{handle}/products` (the Seller's public Products, 30 a page, opaque
    cursor);
  - `GET /v1/storefronts/{handle}/products/{slug}` (the Product, read and re-read);
  - `POST /v1/conversations/{id}/messages {text, product_id?}`.
- **Built on:** WO-014's Product context (`WO-014-PRODUCT-CONTEXT-MESSAGING.md`).

## 2. What the Buyer can do

From any conversation (Messages, then a conversation):

1. Tap **Select Product**. A full-screen picker opens: "Select a Product", "Products from
   {store}", and a note that the Product goes with the next message only.
2. The Seller's public Products are listed with their photo, name and availability in words.
   More load as the list scrolls. Loading, empty ("This Seller has no Products to show right
   now."), offline, error and Try again are the shared public-list states. **Cancel** (or the
   system Back) closes it with nothing changed.
3. Tap a Product. The picker closes and the composer shows "Asking about", the Product's current
   name and availability, and Remove Product. Nothing is sent and the text in the box is kept.
4. **Choose another Product** replaces it; **Remove Product** takes it away.
5. Send. The message carries the Product (`product_id`), in the same conversation. The context then
   clears, so the next message has no Product unless the Buyer chooses one again.

An available or unavailable Product that is public can be chosen. A Product that is not public
(unpublished, private, gone from the Market) shows "no longer available" and cannot be attached.

## 3. One authorization path

Choosing a Product only produces a lookup key: this conversation's Seller handle (from the Buyer's
own authenticated conversation list) and the Product's slug (from the Seller's public list). From
there it is exactly WO-014's context:

- the screen reads the Product itself (`revalidate=true`, not counted as a view);
- the context is shown only while that read is current and its Seller handle is the
  conversation's;
- the Product is read again right before sending, and must still be the same Product of the
  same Seller;
- the message's `product_id` is the fresh read's id, under one idempotency intent (text and
  Product);
- the server makes the final decision (the conversation Seller's PUBLISHED Products only).

There is no second Product-authorization implementation. A route parameter never names the Seller
whose list is shown: with a Product context from a link, the picker still lists the conversation
Seller's Products.

## 4. Finding the conversation's Seller (bounded)

No read publishes the conversation's Seller id (ON-20261111-162), and there is no conversation read
by id. The Seller handle comes from the Buyer's conversation list, 25 conversations a page:

- the screen reads at most **four pages** (`MAX_LIST_PAGES`, 100 conversations) to find the open
  conversation, and stops at the first failure;
- while it looks, Select Product is disabled;
- if the list fails: "Products cannot be chosen in this conversation right now because its Seller
  could not be confirmed. You can still send messages." with Try again;
- if the conversation is not among the first 100: the same line, without Try again (an attached
  Product from a link says it cannot be attached);
- plain messages always work.

Limitation: a conversation older than the Buyer's 100 most recently active ones cannot have a
Product attached until the API publishes a Seller id or a conversation read (recorded in the
issues file, B-002, and ON-20261111-162).

## 5. Unconfirmed sends

WO-014's lock is kept. While a send is in flight or unconfirmed, Select Product / Choose another
Product and Remove Product are disabled, and a Product chosen in a picker opened earlier is
ignored. Only "Edit the message instead" gives the unconfirmed intent up; a Product chosen after
that is a new intent with a new key.

## 6. Sessions and Accounts

The picker reads through the session-bound client; a late answer is dropped. Signing out (or
another Account signing in) makes the conversation screen leave, which closes the picker and drops
the chosen Product. Nothing about the selection is stored. A guest never reaches the conversation
screen, so never the picker.

## 7. Accessibility

- The picker is a system modal (Back closes it). Its title is a header.
- Each Product row is a button whose label is "{name}, {availability}", at least 64 dp tall.
- Select Product, Choose another Product, Remove Product, Try again and Cancel use the shared
  `Button` (minimum 44 dp).
- Light and Dark come from the theme roles. Enlarged text was checked natively (section 9).
- Strings come from `@adulis/locale` (11 new keys, their own commit; the Amharic strings are
  machine-translation placeholders, disabled for users).

## 8. Automated tests

`apps/mobile/src/buyer/chat.test.tsx`, "In-conversation Product selector (WO-015)", against the
in-memory chat server, which now lists each Seller's published Products page by page:

| # | Covered by |
|---|---|
| 1, 2, 3 | "Select Product opens the picker on this conversation Seller's Products; Cancel closes it with nothing attached" |
| 3 | "the list follows the conversation (the authenticated list), never a route parameter" |
| 4, 5 | "the picker says it is loading, then that the Seller has no Products" |
| 6 | "the picker pages: the next page is read with the server's cursor" |
| 7, 8 | "a list lost offline says so, and Try again reads it" |
| 9, 12, 16, 17, 18 | "a chosen Product is attached (read and re-read), sent with the next message in the same conversation, then cleared" |
| 10, 11 | "another Product replaces the first; Remove Product takes it away" |
| 13 | "a chosen Product unpublished before Send is refused and nothing is sent" |
| 14 | "a listed Product that reads as another Seller's is never shown or attached" |
| 15 | "a listed Product that has left the Market shows the neutral unavailable state" |
| 19 | "while a send is unconfirmed, the Product cannot be changed; giving it up allows a new one" |
| 20, 21 | "signing out with the picker open closes it, drops the chosen Product, and the next Account sees none of it" |
| 22 | "a guest never reaches the picker or a Seller list" |
| 23 | WO-014 "Product-context messaging" cases (Ask Seller from Product Detail), unchanged and passing |
| 24 | WO-013 "Message Seller" cases, unchanged and passing |
| 25 | `afterEach`: no cart, order, checkout, payment or reservation call in any test |
| (bounded walk, B-002) | "a conversation beyond the first pages of the list: Product selection is off and says why" |
| (list failure) | "a conversation list that fails: selection is off, and Try again reads the list again" |

Plus the security review's "review I-2" and "review I-3". Result: chat.test.tsx 60/60; the full
mobile suite 393/393 (22 suites).

## 9. Native Android

Android 17 emulator (`Adulis_Pixel_8a_API_37`), the WO-010A debug APK reused (no native change),
Metro restarted on this branch, the real local API on the disposable `adulis_gates` database with
the review fixtures (rebuilt by `morning-start.sh prepare` after B-004). A new disposable Account.
Flow: `apps/mobile/.maestro/conversation-product-selector.yaml`; harness step `selector` in
`G:\AdulisDevelopment\tools\review\wo014-native.sh`. Evidence: `G:\AdulisDevelopment\WO-015\maestro\`.

| Step | What | Result | Stored rows |
|---|---|---|---|
| seed | Seller Profile -> Message Seller (the conversation exists, empty; Select Product shown) | PASS | 1 conversation, no message |
| select | You -> Messages -> Fixture Weaves -> type a draft -> Select Product -> the picker ("Products from Fixture Weaves", 4 Products) -> Coffee tray -> "Asking about Coffee tray", the draft kept, "Choose another Product" -> question sent -> "About a Product", the context cleared | PASS | Buyer messages: coffee-tray |
| select2 | The same path -> Woven basket -> question sent | PASS | still 1 conversation; coffee-tray, woven-basket |
| view | The picker in Dark at font scale 1.3 (both read back from the device), then Cancel | PASS (`sel-view-3`) | -- |

- **First attempts (recorded):**
  - The first run failed at `seed`, with "This Seller is no longer available". The review data
    was incomplete (B-004: `prepare` had lost a fixture helper and still said "ready").
  - `select`, `select2` and `view` were then BLOCKED by the 10 GB C: gate (B-003: C: at 9.92 GB
    while an unrelated program held about 10 GB of memory).
  - After fixing `prepare` and stopping the emulator, the full step passed.
- **B-005 (found natively):** the picker's title sat under the status bar. It was fixed (the
  modal has its own safe area) and checked again in Dark at 1.3.
- **Commerce rows:** carts 0, reservations 5, orders 8 (the fixtures' own), unchanged by the run.
- **Not run natively:** the offline picker, paging beyond 30 Products (the fixture Seller has 4),
  and Account switching with the picker open. These are covered by the Jest cases.

## 10. Not built

- A search inside the picker (the API lists pages only).
- Naming a past message's Product in history (ON-20261111-163).
- Selection for a conversation beyond the Buyer's 100 most recent (ON-20261111-162).
