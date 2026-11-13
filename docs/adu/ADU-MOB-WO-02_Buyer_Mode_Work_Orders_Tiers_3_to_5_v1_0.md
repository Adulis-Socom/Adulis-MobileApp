# ADU-MOB-WO-02 -- Buyer Mode Work Orders, Tiers 3 to 5

**Version:** 1.0  -  **Baseline date:** 5 September 2026
**Prepared and executed by:** Founder / CEO -- sole engineer, with the coding agent
**Status:** Working instrument. **Not binding.** ADU-MOB-01 v1.1 and ADU-MOB-02 v1.0 govern; where this and either disagree, they win and this is corrected.
**Source:** ADU-MOB-01 v1.1 S18  -  ADU-MOB-02 v1.0 MB-01 to MB-20  -  ADU-MOB-03 v1.0 S3  -  ADU-MOB-06 v1.0 S7
**Follows:** ADU-MOB-WO-01 v1.1 (tiers 0-2)  -  **Continues in:** ADU-MOB-WO-03 (tiers 6-8)
**Encoding:** ASCII.

---

## 0. Where this picks up

**Tiers 0 to 2 built plumbing. This builds the product a buyer sees**, and it is the first document in the series where every slice has a screen specification to work from.

**Three slices, and the risk profile changes at each boundary:**

| Tier | Slice | What goes wrong if it is wrong |
|---|---|---|
| **3** | Anonymous browse | The buyer never arrives, or arrives nowhere. **A funnel loss nobody sees** |
| **4** | Cart and reserve | **A duplicate order.** The buyer's own bank charged twice |
| **5** | Payment | **Money to the wrong account**, or an account number on disk |

> **Tier 4 and tier 5 are read line by line by hand**, on the same rule that applies to tiers 1 and 2 (ADU-MOB-01 S18). Everywhere else a mistake is visible; here a mistake is a transfer.

### 0.1 Prerequisites carried forward

| # | Prerequisite | Blocks | State |
|---|---|---|---|
| **P4** | Reference devices | The device half of every gate below | Not started |
| **P5** | **The domain** | **The App Link half of WO-3's gate**, and nothing else. The screens build without it | Open |
| **Q5** | **The fulfilment window length** (ADU-VAL-01 3.2) | **MB-16's `PAYMENT_CONFIRMED` copy.** Not the screen, one region of it | Open |
| **Q6** | **The delivery fee** (ADU-VAL-01 3.8) | **MB-12's total.** `seller_fulfilment_method` carries no fee column, so either ruling is a migration | Open |
| **N1** | The verify body | Already isolated in WO-2's OTP module. **No new exposure here** | Open |

> **Neither Q5 nor Q6 stops a slice.** Both are rendered as **annotated empty regions** exactly as ADU-MOB-04 S9 draws them -- a labelled gap, never an invented number. **A screen that invents a fee is worse than a screen with a gap in it**, because the gap gets ruled on and the invention gets shipped.

---

## WO-3 -- Anonymous browse, deep links and the embed

**Purpose:** everything a buyer can do without an account -- which is most of the product, and the majority of every session.

### 3.1 Read first

ADU-MOB-01 v1.1 **S7.1, S7.2, S7.4, S8.1, S11, S12, S13**  -  **ADU-MOB-02 S2 in full, S4.7, and MB-01, MB-02, MB-03, MB-06, MB-07, MB-08, MB-09, MB-10**  -  **ADU-MOB-03 S3.2, C1, C2, C3, C5, C6, C7, H1, H2**  -  ADU-API-01 **S12.7, S12.8** and the storefront group  -  ADU-PRD-01 **S7.4, S17.2, S21.1, S21.2**  -  ADU-SEC-01 **S10**.

### 3.2 Build

- **MB-01, both lives.** Life 1 is a designed screen: the two recovery actions, equally weighted, and one sentence. **No suggested sellers, no categories, no search bar.** Life 2 is `GET /v1/feed`, recency over the followed set.
- **MB-02, all five result cases**, with *several matches* built as the ordinary outcome rather than the edge. **The clipboard is read only on an explicit tap.**
- **MB-03**, returning sellers and never products, with **no recent and no popular**.
- **MB-06 and MB-07**, per their region lists. **Trust level and completed handoff count are page content from the storefront call, not a second request.** `C3` renders stock **with its `confirmed_at`**.
- **MB-09**, naming the seller in its own label so the scope is legible rather than inferred.
- **MB-10**, with `C5` -- **two ratings, never averaged** -- and one line explaining the badge.
- **`C7 FollowButton`, available before purchase**, from every surface where a seller is identified. An anonymous follow creates the intent and resolves at identity creation.
- **The route tree as the link map** (ADU-MOB-01 S3.2), with `app/s/[handle]` and `app/s/[handle]/p/[slug]` as the deep-link targets. **Handle and slug are shape-validated before they are routed or interpolated.**
- **MB-08, the only `WebView` in the app**: `originWhitelist` restricted to the two embed origins, `javaScriptEnabled` with **no injected script of ours**, third-party cookies off, **navigation outside the whitelist opens the system browser**, mounted on the product screen only and unmounted on leave. **One line naming the platform before it loads.**
- **Image derivatives by slot**: thumbnail in a grid, card in a list, **`full` only on a product screen the buyer opened**. `expo-image` disk cache, **public media only.**

### 3.3 Do not build

**The App Links and Universal Links association files and `app.config.ts` entries** -- there is no domain (P5), and a half-configured association degrades silently to a chooser dialog in production. **The routes exist; the association does not.**  -  Cart, reserve or any write  -  sign-in prompts anywhere on these screens  -  push  -  **any sort, filter-by-price, or relevance control**  -  a share sheet  -  related products.

### 3.4 The absences that bind this slice

**No parameter that widens scope or ranks** on any request  -  **no `WebView` outside `features/storefront/embed`** (gate 8)  -  **no `full` derivative in a list**  -  **no sign-in prompt at launch, at browse, or on the storefront**  -  **no cross-seller anything.**

### 3.5 Gate

**CI half** -- gate 8 passes  -  a test that `GET /v1/feed` and the storefront search are called with no ranking or scope-widening parameter  -  a test that a malformed handle or slug is rejected before routing  -  a test that the list surfaces request the thumbnail derivative.

**Emulator half** -- MB-02 renders the several-matches case from a seeded post link tagged on three products  -  MB-01 Life 1 renders with no follows and offers both recovery paths  -  **the product screen is fully usable with the embed never tapped**  -  every list has its empty state, and each carries what, why, and an action or a stated reason for none.

**Device half** (deferred, P4) -- every screen at the largest OS text size in Amharic, **on Android specifically** (ADU-MOB-03 D1)  -  a storefront visit measured against the 1.5 MB and 2-second budgets on the reference Android  -  memory under 200 MB on a 60-product grid.

**App Link half** (deferred, P5) -- an App Link and a Universal Link each open the exact product **on a physical device**; the same URL renders the web storefront with the app uninstalled.

### 3.6 Review checklist

[ ] no request carries a ranking, sorting or scope-widening parameter  [ ] the `WebView` is confined and unmounted on leave  [ ] no injected JavaScript  [ ] freshness stamps render wherever the server supplies one  [ ] ratings are never averaged  [ ] the image derivative matches the slot  [ ] no sign-in prompt on any screen in this slice  [ ] both locale entries for every string  [ ] no fixed height on anything holding text.

---

## WO-4 -- Cart, reserve, reconciliation and the order card

**Purpose:** the moment an anonymous buyer becomes a buyer, and the one place in the app where a client defect charges someone twice.

### 4.1 Read first

ADU-MOB-01 v1.1 **S4.2, S5.2, S7.3, S7.5** (the order-card row)  -  **ADU-MOB-02 MB-11, MB-12, MB-13, MB-14, MB-15, MB-16, and S4.4 and S4.7**  -  **ADU-MOB-03 C2, C4, O1, O2, O3, O4, O5, O6, R2**  -  ADU-API-01 **S7.1, S12.3, S12.4**, and gap **A2**  -  ADU-DB-01 **S11.2**  -  ADU-PRD-01 **S5.3, S8.2**  -  **ADU-MOB-06 S7 N1, N8, N9**.

### 4.2 Build

- **MB-11**: lines as `C4`, each with `available` **and `available_checked_at`**. **Re-checks on every view.** The seller-conflict 409 offers a new cart and **never a merge**, naming both sellers.
- **MB-12**: the reserve screen, with identity creation inline (MB-04's components reused, not reimplemented).
- **The persisted idempotency key, and it is the most consequential code in the app.** Written to SQLite with the cart's content hash **when the checkout screen mounts**; reused for every attempt; deleted when the order is created or the cart changes. **Same key with a different hash is a 409 rendered as *your cart changed -- review it***.
- **MB-13**: `O6` rendering **all six** per-line failure states from `items[]` verbatim -- sold out, insufficient quantity, price changed, no longer published, variant withdrawn, seller unavailable. **Every item, never the first. Nothing is auto-corrected.**
- **The transaction cap 409**, whose message names the limit and **never the seller's level as a judgement**.
- **MB-14 as `R2 DisclosureInterstitial`**: full screen, two facts, one continue, **no checkbox and no dismiss**. **Emits its event on mount.** *(See S4.3 on the event.)*
- **MB-15 and MB-16**: the orders list and the order card. **`O1` is one component with a server-driven `O4` action region** -- no tabs, no wizard, no stepper.
- **`O3 Countdown` with its two labelled variants only.** At `PAYMENT_SUBMITTED` the clock is **the seller's** and the action region is **empty, with one line saying there is nothing to do.** At `PAYMENT_CONFIRMED` **the clock slot is empty** and carries Q5's annotated gap.
- The order is **re-read on view and on foreground. Nothing polls. Nothing is cached to disk.**

### 4.3 Do not build

- **The client event on MB-14 is not emitted.** ADU-API-01's allow-list names four events across two sections that each call themselves a closed list of two (ADU-MOB-01 F3). **Build the emit point, wire it to a no-op, and record it in `DEFERRED-GATES.md`** -- the disclosure requirement is that it was *shown*, which the screen satisfies.
- **No delivery fee line with a number** (Q6). An annotated empty row.
- **No fulfilment-window copy** (Q5). The card states the fact and offers the seller contact.
- Payment instructions, evidence, cancel, refunds -- tier 5  -  push -- tier 8  -  review -- tier 7.

### 4.4 The absences that bind this slice

**No cart altered without the buyer choosing** -- not a quantity, not a price, not a removal  -  **no order created without the persisted key**  -  **no countdown without an owner** (M12)  -  **no `/v1/*` response on disk** (gate 5)  -  **no computed expiry, level or eligibility**  -  **no client event emitted** until the allow-list is reconciled.

### 4.5 Gate

**CI half** -- **kill the process mid-`POST /v1/orders`, relaunch, retry: exactly one order** (N1)  -  a same-key-different-hash request renders the cart-changed state  -  **all six reconciliation states render from a stubbed `items[]`**, and a stub with three items renders three  -  a second seller's line produces `CART_SELLER_CONFLICT` and the new-cart offer  -  `O3` cannot be constructed without a variant  -  gate 5 passes.

**Emulator half** -- the disclosure is not dismissible and cannot be scrolled past  -  the confirmed-state card shows **no countdown**  -  the submitted-state card shows the seller's clock **and no action**  -  the cart's freshness stamps render.

**Device half** (deferred) -- the full reserve flow at the largest OS text size in Amharic, **with the disclosure's action still pinned** (ADU-MOB-03 S4.3)  -  **after the flow, the app container holds no cart or order response body**.

### 4.6 Review checklist

[ ] the idempotency key is persisted, minted at mount, and deleted on success or cart change  [ ] all six reconciliation states exist and render from `items[]`  [ ] `O6` renders every item  [ ] the disclosure is an interstitial, not a banner or a checkbox  [ ] no adjective describes the seller  [ ] every countdown names whose deadline it is  [ ] the confirmed state has no clock  [ ] the fee and window gaps are annotated, not filled  [ ] nothing polls  [ ] negative cases tested.

---

## WO-5 -- Payment instructions, evidence, cancel and refunds

**Purpose:** the buyer gets an account number they can act on, and nothing about it reaches disk.

### 5.1 Read first

ADU-MOB-01 v1.1 **S7.5, S8.2, S9.2, S14.1, S14.2**  -  **ADU-MOB-02 MB-17, MB-18, MB-19, MB-20, and S4.3**  -  **ADU-MOB-03 R3, P2, P6**  -  ADU-API-01 **S9, S12.10**, the payment-instructions row  -  ADU-DPIA-01 **S6**  -  ADU-ARCH-01 **S10**  -  **ADU-MOB-06 S2.1, S2.3, S7 N7, N20**.

### 5.2 Build

- **MB-17**, the single decryption path. **`private, no-store`. Held in memory for the life of the screen and nowhere else.**
- **`R3 CopyField`** on the account number, the amount and the reference: **`mono` with tabular figures, an explicit copy control, and the value selectable.** **Nothing is placed on the clipboard automatically.**
- **MB-18**: pick or take a photo, preview, one line saying the transaction reference must be readable, send with **real progress**.
- **Downscale on device before upload** (B10) -- long edge capped, quality stepped down until the bytes fit. `EVIDENCE_TOO_LARGE` **must not reach the buyer.**
- **Signed URL -> direct `PUT` -> commit.** **No multipart body through the API.** A failed upload **leaves the order exactly where it was**, and the screen says so.
- **MB-19**: per line, never the whole order where lines remain. **The penalty is disclosed before the tap**, and confirm is the second tap.
- **MB-20**: an explicit acknowledgement, never inferred. The copy must not imply the buyer agrees the amount was correct.

### 5.3 Do not build

- **No evidence viewer.** The buyer never sees payment evidence rendered back -- not their own, not anyone's.
- **No `FLAG_SECURE` and no screenshot blocking** on MB-17. **The buyer needs that number in their bank app**, and blocking it makes them retype thirteen digits, which is how money reaches the wrong account.
- **No "Adulis has verified this account" line, no tick, no reassurance of any kind.**
- No in-app payment method, no card entry, no wallet.
- Handoff, review, claim -- tiers 6 and 7.

### 5.4 The absences that bind this slice

**No `/v1/*` response body, bank detail or amount written to disk or to a log** (gates 2 and 5, and ADU-MOB-01 S14.2)  -  **no automatic clipboard write**  -  **no assertion that a payment is genuine**  -  **no evidence rendered back**  -  **no `CopyField` persistence of any kind.**

### 5.5 Gate

**CI half** -- a 12 MP fixture downscales inside the cap (N7)  -  a failed commit leaves the order state unchanged  -  gates 2 and 5 pass  -  the instructions response is not written by any code path.

**Emulator half** -- the copy control fires only on a tap  -  the cancel sheet states the penalty before the confirm control is reachable  -  the refund acknowledgement is an explicit action.

**Device half** (deferred) -- **N20: after a full session, `find` over the app container yields no `/v1/*` response body, no seeded bank detail, no phone number and no token outside secure storage**  -  **the same search over the captured logs**  -  **a real screenshot from a real cheap phone remains readable after downscaling** -- this is a human check and it is the one that bounds the compression  -  **the app-switcher snapshot on MB-17** (ADU-MOB-06 F3, Q1) -- record what it shows, and whether a background overlay is adopted.

### 5.6 Review checklist

[ ] the instructions response exists only in memory and is not passed to any store  [ ] nothing is auto-copied  [ ] the account number is selectable  [ ] evidence is downscaled before upload  [ ] a failed upload advances nothing  [ ] no evidence is ever rendered to the buyer  [ ] no verification language anywhere on these screens  [ ] cancel is per line and the penalty precedes the tap  [ ] the container and the logs are searched for seeded values, not reasoned about  [ ] both locale entries.

---

## 6. What tier 6 needs, and one of it is a ruling

| Needs | State |
|---|---|
| **The QR payload encoding** (D-156, ADU-MOB-01 Q11) | **Hard blocker.** Recorded as *interim*; **both halves of a scan contract have to agree on bytes**, and the seller's half already ships. **The cheap answer is to ratify what D-156 built** |
| **The retry budget** (ADU-MOB-02 M1, Q12) | **Proposed at twenty seconds, awaiting ratification.** It is the whole of the buyer's experience at a doorway and it is a product decision |
| The device half of tiers 3-5 | Queued in `DEFERRED-GATES.md` |

**Tier 6 onwards is ADU-MOB-WO-03.**

---

*Working instrument, three slices. **Tier 3 is the largest slice in the app and the least dangerous; tier 4 is the smallest and the worst to get wrong.** The single line of code that matters most in this document is the persisted idempotency key -- minted when the checkout screen mounts, not when the button is tapped -- because the failure it prevents is a duplicate order on a good connection, and the buyer's own bank is what charges them twice. **Two open decisions are carried as annotated gaps rather than filled**: a delivery fee nobody has ruled and a fulfilment window nobody has chosen. A screen that invents either is worse than a screen with a labelled hole in it, because the hole gets ruled on and the invention gets shipped.*
