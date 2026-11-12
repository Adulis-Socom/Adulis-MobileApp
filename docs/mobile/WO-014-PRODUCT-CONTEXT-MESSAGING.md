# WO-014 -- Product-context messaging

Work order WO-014 (12 November 2026). Branch `mobile/wo-014-product-context-messaging`, from the
WO-013 checkpoint `706e8948f589d56a57c5900390f0ddb040418d95`. Engineering record. There is no
backend change, no new endpoint and no contract change.

**Scope honesty.** This builds row 3 of `WO-013-CHAT-CONTRACT-GAPS.md`: Ask Seller from a Product,
with the Product preselected. The chat design's other subjects (Scene, Order), its source context
and its in-conversation Product selector remain unbuilt. That record lists every design
requirement and its status.

## 1. Sources

- **Design:** ADU-CHAT-01 v3.3 S1, S3-S5, S10, S15, S17 (one conversation per Buyer, Seller and
  Market; "the conversation is relationship-only; composer state is temporary; each Message
  captures its own immutable subject"; "context selection affects only the next Message"; Product
  entry preselects the current Product); ADU-MOB-02 v4.3 R-07 (Ask Seller opens the ongoing
  conversation with the Product's context).
- **API (ADU-API-01 S12.7):**
  - `GET /v1/storefronts/{handle}` (the Seller, by handle);
  - `GET /v1/storefronts/{handle}/products/{slug}` (the Product);
  - `POST /v1/conversations {seller_id}` (create or return);
  - `GET /v1/conversations?as=buyer`;
  - `POST /v1/conversations/{id}/messages {text, product_id?}`. The server accepts a
    `product_id` only for a PUBLISHED Product of the conversation's Seller, and answers 404
    otherwise.
- **Prototype (UX reference only):** `src/sections/MobileBuyer.tsx`, the Product page's Ask Seller.

## 2. What the Buyer can do

| Where | What | Calls |
|---|---|---|
| Product Detail | **Ask Seller About This Product**, under "Sold by", also on an unavailable Product | `GET /v1/storefronts/{handle}?revalidate=true` (the Seller), then `POST /v1/conversations {seller_id}` |
| The conversation | The composer shows **Asking about**, the Product's name, its availability, "Your next message will be about this Product." and **Remove Product** | `GET .../products/{slug}?revalidate=true` |
| Send | The Product is read again; if it is still this Seller's and public, the message carries its id | `GET .../products/{slug}?revalidate=true`, then `POST .../messages {text, product_id}` |
| History | A message about a Product shows "About a Product" (no name) | `GET .../messages` |

- **Two Products of one Seller use one conversation.** Each message keeps its own Product. A
  Product of another Seller opens that Seller's conversation.
- **The context is temporary.** It describes the next message only. It clears once the server
  accepts that message, so follow-ups carry no anchor unless the Buyer comes from a Product again.
  Opening the conversation from Messages, or opening another conversation, carries no context.
- **History names no Product.** No read returns a Product by id, so a past message's Product is
  never named from a guess. The line "About a Product" is the fallback the work order allows.

## 3. Seller resolution

The Product read names its Seller by public handle only. Ask Seller therefore:

1. reads `GET /v1/storefronts/{handle}` (a technical re-read, not a profile view);
2. uses the answer only if it is for the same handle and carries a well-formed id;
3. opens the conversation with that `seller_id` (one idempotency key per intent).

A handle is never used as an id. No Seller id ever travels in route parameters. The Product
travels to the conversation only as its public handle and slug: the lookup keys of the
conversation screen's own read.

The conversation screen checks that the Product's Seller is the conversation's by comparing the
Product read's Seller handle with the handle in the Buyer's own conversation list. Neither the
Product read nor the list carries a `seller_id` (contract gap ON-20261111-162). The server's own
check is the authority either way.

## 4. Product context

The composer shows the Product only from the screen's own current public read:

| State | Shown | Send |
|---|---|---|
| Checking | "Checking this Product" | disabled |
| The read answers and its Seller is the conversation's | name, availability, the note, Remove Product | enabled |
| 404 (unpublished, removed, private: one answer) | "This Product is no longer available to ask about. Remove it to send your message without it." No name | disabled until removed |
| The read answers for another Seller | "This Product is not from this Seller, so it cannot be attached here." No name | disabled until removed |
| No answer (offline, timeout, list failure) | "This Product could not be checked. Check your connection and try again." Try again. No name | disabled |

- No price, stock, discount, delivery estimate or promise is drawn in the context. Availability is
  the server's own word ("Available" / "Currently unavailable").
- Route parameters are validated as path names (`isPathName`); a malformed pair is ignored.

## 5. Sending an anchored message

Before an anchored send:

1. the session is the one the screen opened in (the bound client refuses otherwise);
2. the conversation is the screen's own (the server checks membership);
3. the Product is read again (`revalidate=true`);
4. the fresh read must be the Product on screen (same id) and the conversation Seller's.

Only then does the message go, with `product_id` set to the fresh read's id. On a refusal nothing
is sent, the draft stays, and the context says why. A lost connection during the check is "could
not be checked", never "removed". If the server still refuses the Product (a 404 at send time),
the message is "not sent" and the context says the Product is no longer available.

**Idempotency.** The intent is the whole payload: the conversation, the text, and the Product or
none. One key per intent.

- A server answer ends the intent; the next attempt gets a new key.
- No answer (offline, timeout) keeps the key, and the outcome is "unconfirmed". While a send is
  unconfirmed, its payload is frozen: the composer and Remove Product are locked, and Send replays
  the same text, Product and key. If the Product now reads as a different id, the replay is
  refused and the send stays unconfirmed.
- **Edit the message instead** gives the unconfirmed intent up explicitly and unlocks the composer.
  A changed text or Product is then a new intent with a new key.

## 6. Guests, sessions and Accounts

- A guest's Ask Seller opens sign-in with `returnTo` set to the Product (an allowlisted path). After
  sign-in the Buyer is back on the Product. Nothing is created and nothing is sent until they tap
  Ask Seller again. A cancelled sign-in creates nothing.
- Drafts and the context live in the screen's memory only. There is no persistent draft store.
  The screen leaves when the session ends or changes, and a request started under one session is
  refused before it is sent under another.

## 7. Keyboard and accessibility

- The context block is part of the composer area, above the text box. The route's
  `KeyboardAvoidingView` keeps the composer above the keyboard (checked natively, section 9).
- Buttons are the shared `Button` (minimum 44 dp). Refusals are announced as alerts. All strings
  are centralized in `@adulis/locale` (nine new keys, committed separately; Amharic strings are
  machine-translation placeholders, still disabled for users).
- Light and Dark come from the shared theme roles; enlarged text was checked natively.

## 8. Automated tests

`apps/mobile/src/buyer/chat.test.tsx`, on the real route tree against an in-memory chat server
that follows the API's rules. The server holds a small public catalogue and refuses a
`product_id` that is not a PUBLISHED Product of the conversation's Seller. The work order's
section 19 matrix:

| # | Covered by |
|---|---|
| 1-3 | "1, 2, 3. Ask Seller is on Product Detail; a guest is sent to sign in and nothing is created" |
| 4 | "4. a successful sign-in returns to the Product; nothing is opened or sent until the Buyer asks again" |
| 5 | "5. a cancelled sign-in creates nothing" |
| 6, 8 | "6, 8. the Seller is resolved by the public storefront read and the conversation opened by its seller_id" |
| 7 | "7. a storefront read that answers for another handle / names the handle as its id is not used" (two cases) |
| 9 | "9. two Products of one Seller go to one conversation, each message about its own Product" |
| 10 | "10. Products of different Sellers do not share a conversation" |
| 11, 13, 15, 16 | "11, 13, 15, 16. the context shows the current read; the message carries product_id; the context clears and a follow-up has no anchor" |
| 12, 14 | "12, 14. a removed context sends a message with no Product anchor" (and WO-013 test 8) |
| 17 | "17. the context stays with its conversation" and "review L-3" |
| 18 | "18. a malformed Product reference is ignored; an unknown one shows the neutral unavailable state" |
| 19 | "19. a Product of another Seller is never shown or attached" |
| 20 | "20. a Product unpublished after it was shown ..." and "20, 28. a Product the server refuses at send time ..." |
| 21 | "21. a check that cannot reach the server sends nothing and is not called removed" and "review M-1" |
| 22 | "22. a context read lost offline shows no Product details" |
| 23, 24 | WO-013 "9, 10. an empty or over-long message cannot be sent" |
| 25 | "25. a second press while an anchored message is sending sends nothing" (and WO-013 test 11) |
| 26, 29 | "26, 29. an unconfirmed anchored send freezes its payload ..." and "review L-2" |
| 27 | "27. giving up an unconfirmed send and changing the Product is a new intent with a new key" |
| 28 | "20, 28" and WO-013 test 14 |
| 30 | "30. signing out while the Product is being checked sends nothing" (and WO-013 tests 21, 22) |
| 31-35 | WO-013 tests 1-23 in the same file (Seller Profile messaging, the list, history, attribution, escalation) |
| 36-39 | `shop.test.tsx`, `categories.test.tsx`, `search.test.tsx`, `saved.test.tsx`, Product Detail tests in the full suite |
| 40 | Every test in the file asserts no cart, order, checkout, payment or reservation call (`afterEach`) |

Result: 43/43 in the file; the full mobile suite is 376/376 (22 suites).

## 9. Native Android

Android 17 emulator (`Adulis_Pixel_8a_API_37`), the WO-010A debug APK reused (no native change),
Metro restarted on this branch, the real local API on the disposable `adulis_gates` database with
the WO-CAT-001 fixtures (Fixture Weaves: Coffee tray, Woven basket, Clay cup). New disposable
phones for every run. Flow: `apps/mobile/.maestro/product-context-messaging.yaml`. Harness:
`G:\AdulisDevelopment\tools\review\wo014-native.sh` (it checks the stored rows between steps).
Evidence: `G:\AdulisDevelopment\WO-014\maestro\` and `G:\AdulisDevelopment\WO-014\logs\native-*.out`.

| Journey | Steps | Result | Stored rows |
|---|---|---|---|
| C: guest | Product link -> Ask Seller -> sign-in -> the code -> back on the same Product -> Ask Seller again | PASS (pcm-guest, pcm-guest-in, pcm-c-open) | 0 conversations after sign-in; 1 only after the explicit tap; no message |
| A: Product to chat | Shop -> Coffee tray -> Ask Seller -> "Asking about Coffee tray" -> question sent | PASS (pcm-ask-a) | 1 conversation; Buyer messages: coffee-tray |
| B: two Products | Woven basket -> Ask Seller -> the same conversation (the tray question above) -> question sent | PASS (pcm-ask-b) | still 1 conversation; coffee-tray, woven-basket |
| D: Product removed | Clay cup -> Ask Seller -> context shown; the harness unpublishes it; Send -> "no longer available", no name, Send disabled, draft kept; Remove Product -> sent without | PASS (pcm-d-open, pcm-d-send; second run, see below) | nothing about clay-cup; the message stored with no anchor |
| Offline | Woven basket -> Ask Seller; the API stopped; Send -> "could not be checked" (not "gone"), no name; the API back; Try again -> sent | PASS (pcm-off-open, pcm-off-send, pcm-off-retry) | nothing stored while offline; then woven-basket |
| Dark + font scale 1.3 + keyboard | The context in Dark; typing with the keyboard open: the context, the box and Send stay above the keyboard | PASS (pcm-view) | -- |
| E: another Account | Sign out; a new Account signs in; Messages is empty; Ask Seller opens its own empty conversation; no message or draft of the first Account | PASS (account-sign-out-m, auth-request-other, sign-in-other, msg-other-list, pcm-other) | the other Account: 1 conversation, no message; the first still 1 |

- **Market isolation:** the stored anchors are the device Market's (SEED) Product ids; Market B's
  Woven basket (the same Seller handle) never appears.
- **First D run:** FAIL on a wrong flow assertion ("About a Product" not visible), written
  before the conversation already held the A and B messages, which show that line. The failure
  screenshot shows the correct refusal, and the rows show nothing sent. The assertion was
  replaced by "Send is disabled", and D was run again: PASS (ON-20261111-166).
- **Keyboard at font scale 1.3:** the composer stays visible, but the message list above it has
  no height left while the keyboard is open (ON-20261111-164).
- **Regressions (same branch, same day):** smoke, Buyer shell, category Shop, category Search,
  Search, Shop, Seller Profile, Explore the Scene, Product Detail (catalogue part 1), Saved guest
  continuation (two parts), Saved Collections, Card Saves in Dark at font scale 1.3, Shop offline
  (two parts), Seller Profile messaging (Message Seller, plain message, automated answer, Ask the
  Seller, reopened from Messages): all PASS.
- **ON-20261111-159:** `card-saves` STEP=dark now runs on a fresh disposable Account: PASS alone
  (cards-dark-alone) and PASS right after `saved-collections` in the battery (the order that
  failed before). No assertion was changed.
- **Not run:** the dedicated For You flow (`buyer-for-you.yaml`, ON-20261111-084). iOS.
- **Commerce rows:** carts 0, reservations 5, orders 8 before and after every run; all were
  created before this work order's runs (fixtures and earlier tests).

## 10. What is not built

- Choosing another Product from inside the conversation (the design's composer selector).
- Scene and Order subjects, source context, attachments, read state, push, typing, presence.
- Naming a past message's Product (no Product read by id).
- iOS was not tested.
