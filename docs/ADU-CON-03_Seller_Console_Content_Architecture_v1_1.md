# ADU-CON-03 — Seller Console: Content Architecture

**Version:** 1.1 · **Baseline date:** 26 August 2026
**Owner:** COO/CTO (front-end) · Founder/CEO (contract and content invariants)
**Status:** Binding content and information architecture for the seller console. It decides **what a seller sees, where, and in what state.** It does not decide visual design.
**Supersedes:** ADU-CON-03 v1.0
**Drawn from:** ADU-CON-01 v1.0 · ADU-CON-02 v3.0 · **ADU-DB-01 v1.7** · **ADU-API-01 v1.4** · **ADU-AUTH-01 v2.1** · ADU-ARCH-01 v2.0 · ADU-PRD-01 v8.5 · ADU-SEC-01 v1.0 · ADU-CON-04-R1 v1.0

---

## 0.1 What changed in v1.1

**v1.1 absorbs what building the wireframes taught.** Two rounds of generated wireframes against v1.0 found two defects in this document and five questions it could not answer; ADU-CON-04-R1 ruled on all of them, and they land here. The three reissued contracts — ADU-DB-01 v1.7, ADU-API-01 v1.4, ADU-AUTH-01 v2.1 — also close most of §17's endpoint gaps.

| # | Change | Screen |
|---|---|---|
| **R20** | **The handoff region requires `PAYMENT_CONFIRMED`** — all three controls, not just Mark Ready. v1.0 listed the region without its precondition, and the wireframes drew a live *Mark Ready* on an unpaid order | SC-04 |
| **R21** | The payout **cancel control renders only when a pending change exists**; the promise that cancelling needs no code stays in the disclosure | SC-24 |
| **R22** | **Eight notification categories, enumerated.** Seven toggleable, one locked. v1.0 said "per-category toggles" and no document had ever listed the categories | SC-28 |
| **R23** | Home's activity summary is **a rolling 7 days against the previous 7**. Fixed period, no picker | SC-01 |
| **R24** | Follower count is **captured, never refreshed in the background**. Always "as of <date>", with a Re-check action | SC-22 |
| **R25** | The courier sees the **QR only after accepting custody** | SC-C1 |
| **R26** | Declaring company adds **one** readiness item, not two — and **changes what identity verification means** | SC-02, SC-22 |
| **R27** | **Holiday overrides are included** — closure dates on top of the weekly pattern. Founder ruling, overriding the recommendation against them | SC-19 |
| — | Four questions answered from ADU-PRD-01 §16.1: product limits, the analytics matrix, team entitlement, variant statuses | SC-07, SC-12, SC-25, SC-09 |
| — | **§17 rewritten.** ADU-API-01 v1.4 specifies the twenty-eight endpoints v1.0 registered as missing. Three deferrals remain, plus one new gap R27 creates | §17 |

**R27 carries a schema consequence, recorded here so it is not a surprise.** `core.seller_availability` has no concept of a date, so holiday overrides require a new table — **ADU-DB-01 → v1.8** at 109 tables, and **ADU-API-01 → v1.5** for the endpoint. Both are small and neither blocks any tier before Tier 4. The design is fixed in SC-19 below so that the reissues transcribe rather than decide.

**Everything not listed above is carried forward from v1.0 unaltered.**

---

## 0. What this document is

The console is **the full seller management system** (ADU-ARCH-01 §1): create, configure, manage, administer. The Companion monitors and responds; everything else happens here. Nine of the ten publication-readiness items are reachable from nowhere else, so this is also the only surface on which a person becomes a seller at all.

This document gives four things: the **navigation model** (§2), the **state vocabulary** every screen draws from (§3), the **content rules** that bind copy (§4), and the **screen inventory** — twenty-nine screens, each with its regions, actions, endpoints and states (§6–§12).

**What it deliberately does not contain.** No colours, type scale, spacing or component design — those belong to the design system and `packages/tokens`. **No final copy**: English strings are written as *content intent*, because the real strings are catalogue keys authored once and translated (§13), and a document that hard-codes them creates a second source of truth. Where a label is an **invariant**, it is given verbatim and marked so.

**How it is used.** Abenezer builds from it. ADU-CON-04 — the wireframe generation brief — is derived from it mechanically, which is why every screen below states its regions in reading order rather than its appearance.

**Screen IDs are stable.** `SC-nn` is referenced by ADU-CON-04, by the front-end folder names under `apps/console/src/features/`, and by test names. They do not get renumbered; a retired screen leaves a hole.

---

## 1. Who is on this surface

| Actor | How they arrive | What they see |
|---|---|---|
| **Prospective seller** | Waitlist acceptance → sign-in | SC-00, SC-01, SC-02 only. Everything else is present but blocked by readiness |
| **Published seller (Owner)** | Daily | Everything |
| **Team member** | Invited; own phone, own OTP | Only what `core.role_permission` grants. Absent permissions are **not rendered** (§3.4) |
| **Courier** | Invited by a seller | **SC-C1 only** (§12.6). One screen. They are not seller staff and see no seller navigation |
| **Operator** | — | **Nothing.** ADU-CON-01 R6 puts operators on a separate deployment |

A single account may hold several of these at once (ADU-ARCH-01 §2). The seller context is the URL segment, never a stored preference (ADU-CON-02 §4.2).

---

## 2. Navigation

### 2.1 The shape

```
/s/:sellerId/…                      every seller-scoped route
/                                   seller chooser, or redirect if exactly one
/sign-in                            unauthenticated
/courier                            courier surface — no seller nav
```

**Five primary destinations. No more.** A sixth would mean the sixth is never used.

| # | Destination | Route | Why it is primary |
|---|---|---|---|
| 1 | **Home** | `/s/:id` | Readiness before publication; the day's work after |
| 2 | **Orders** | `/s/:id/orders` | The only surface touched every single day |
| 3 | **Products** | `/s/:id/products` | Catalogue and stock, the weekly surface |
| 4 | **Inbox** | `/s/:id/inbox` | Buyer questions; time-sensitive |
| 5 | **More** | `/s/:id/more` | Insights, Store, Settings, Billing |

**Desktop (≥1024px):** persistent left sidebar showing all five plus the *More* group expanded into its four sections — the console is used at a desk and hiding settings behind a click costs more than it saves.
**Tablet and mobile (<1024px):** bottom bar with the four primary destinations plus *More*, which opens a full-page menu, not a drawer that traps focus.

**Top bar, every route:** store name and seller switcher (rendered **only** when the account holds more than one seller — a switcher offering one choice teaches nothing), notification bell with unread count (SC-26), account menu.

### 2.2 Home is one screen with two lives

Pre-publication it is the **readiness hub**; post-publication it is the **daily brief**. Same route, same screen ID, different content — because ADU-PRD-01 §4.6 requires setup to be *returnable*, and a seller who leaves mid-setup and comes back to a different screen has to find their place again. The transition is not an event the seller performs; it is what the screen shows once `fn_publication_readiness` returns nine satisfied items and one product is published.

### 2.3 What *More* contains

| Section | Screens |
|---|---|
| **Insights** | SC-12 Analytics · SC-13 Trust and level · SC-14 Reviews |
| **Store** | SC-17 Profile · SC-18 Fulfilment · SC-19 Availability · SC-20 Identity · SC-21 Couriers |
| **Settings** | SC-25 Sessions and devices · SC-27 Notifications · SC-23 Team · SC-28 Closure |
| **Billing** | SC-24 Subscription |

**Claims (SC-15/16) are not filed under a section.** A claim is an open obligation with a deadline, and it surfaces on Home and in Orders, reachable from both. Filing it under *Insights* would make the most urgent thing in the product the hardest to find.

### 2.4 Deep links

Every notification deep-links to a specific screen with its object. **A deep link never bypasses a gate**: an unauthenticated deep link lands on SC-00 and resumes after sign-in; a deep link into a step-up action lands on the screen with the challenge presented, never on the completed action.

---

## 3. The state vocabulary

Every screen declares which of these it implements. The set is closed — a screen needing a state not on this list has found a contract gap, and the answer is to raise it, not to invent a state (ADU-CON-01's rule: *the server owns business state; the client owns presentation state only*).

| Key | When | What is shown |
|---|---|---|
| `LOADING` | First fetch, no cached data | Skeleton matching the final layout's shape, never a spinner on a blank page |
| `EMPTY` | Request succeeded, zero rows | **Mandatory on every list** (§3.2) |
| `READY` | Data present | The screen |
| `STALE` | Refetching with data on screen | Existing data stays visible and interactive; a quiet indicator only |
| `BLOCKED_READINESS` | A readiness item is unsatisfied | What is missing and the one control that fixes it |
| `NO_PERMISSION` | `core.role_permission` does not grant it | **Nothing.** The control is not rendered (§3.4) |
| `NO_ENTITLEMENT` | Tier ∩ level excludes it | Control visible and disabled, with what unlocks it (§3.5) |
| `CONFLICT` | 409 from the API | The server's `message_key` + `slots`, and the state the object is actually in |
| `VALIDATION` | 400/422 | Per-field messages **and** a summary list linking to each invalid field |
| `TERMINAL` | The object's lifecycle has ended | History, no actions |
| `TRANSPORT_ERROR` | Network or 5xx | Retry, plus the request id for support (§4.6) |
| `UPGRADE_REQUIRED` | Client below the `/v1/bootstrap` floor | Reload prompt; no other content |

### 3.1 The rule beneath the vocabulary

> **INVARIANT — the console computes no business state.** It never derives expiry from `created_at + 48h`, never computes a trust level, never decides an entitlement, never infers whether a transition is legal. It renders `state`, `allowed_actions` and `readiness[]` as the server resolved them. A countdown may *display* a server-supplied deadline; it may not *decide* anything when the countdown reaches zero — it refetches and shows what the server says.

### 3.2 Empty states are mandatory and specified

ADU-PRD-01 §23.2: *"Every list surface defines an empty state… It is never a bare icon, an apology, or a blank region."* Every empty state carries exactly three things: **what will appear here**, **why it is worth having**, and **one action** that makes it appear. §14 catalogues all of them.

### 3.3 Loading is never a full-page spinner

The console's slowest surfaces are order detail and analytics. Both render their layout as skeletons so the page does not reflow when data lands.

### 3.4 Absent permission renders nothing; denied permission is impossible

If `fn_has_permission` would refuse, the control is not drawn. The seller is never shown a button that produces a 403 — but the server still refuses independently, because *hidden and permitted* is the failure ADU-PRD-01 §16.2 names. The console hides for ergonomics; the server refuses for correctness.

### 3.5 Absent entitlement renders the control, disabled

This is the opposite treatment, deliberately. A capability the seller could have is a commercial fact worth showing; a capability they may not use is not. Tier names, prices and upgrade links **are permitted on the console** — the console is the only surface where billing exists (ADU-API-01 §4.1). They are forbidden in the mobile bundle entirely.

---

## 4. Content rules

### 4.1 Verbatim labels — these are invariants, not suggestions

| Action | Label | Source |
|---|---|---|
| Seller confirms a buyer's payment | **Confirm Payment Received** — never "Accept Payment", never "Approve" | ADU-ARCH-01 §3.3, PRD §10.1 |
| Accompanying instruction, always adjacent | **Verify the payment in your own bank or payment account before confirming.** | ADU-ARCH-01 §3.3 |
| Seller rejects evidence | **Payment Not Received** | PRD §10.1 |
| Seller cannot supply a line | **Can't Fulfil** | PRD §9.4 |
| Order is ready for collection or courier | **Mark Ready** | ADU-ARCH-01 §3.1, DB §12.6a |
| Accepting a reservation | **Does not exist.** No screen has this control | ADU-ARCH-01 §3.2 |

> **INVARIANT — Adulis never asserts that a payment is genuine.** No screen displays "verified", "validated", "confirmed by Adulis" or a green tick against a payment. The seller's own decision is recorded; the platform makes no claim about it.

### 4.2 Terminology, fixed across the console

**Reservation** not "order hold". **Handoff** not "delivery" (Adulis does not deliver until V6). **Store** not "shop" or "storefront" in seller-facing copy — *storefront* is the buyer-facing page. **Level**, not "rank", "tier" or "score" — *tier* is the subscription, and confusing the two confuses the two things the product most needs kept apart. **Stock confidence**, not "stock accuracy".

### 4.3 Copy that must never appear

- Anything implying Adulis holds, escrows, guarantees or verifies money.
- Any control to hide, delay, dispute or reply-gate a review. There is no seller-writable column on `review` and there is no screen affordance either.
- Any promise of delivery timing Adulis cannot keep.
- Any suggestion that a higher tier raises trust level. **Tier and level are independent** — `fn_recompute_seller_level` touches no billing table, and the copy must not imply otherwise.
- Any consequence a seller's tier cannot actually experience. **Concretely: stock confidence level 3's consequence is chatbot hedging, and Free tier has no chatbot** (ADU-DB-01 §10.2) — so the confidence explainer is written from resolved entitlement, not from a static list.

### 4.4 Numbers, money and dates

The wire carries `{amount_minor, currency}` and RFC 3339 UTC. **The client formats, always** — `Intl.NumberFormat` and `Intl.DateTimeFormat` against the market timezone from `/v1/bootstrap`. A server-formatted `"45.00 ETB"` is a translation fragment wearing a disguise.

Relative time (*"2 hours ago"*) is permitted for recency, but **never for a deadline**. Deadlines are absolute and carry the timezone, because *"expires in 3 hours"* on a stale tab is wrong in the direction that costs a sale.

### 4.5 Sentences, never fragments

Every string is a complete sentence or a whole label with named slots. No `prefix + value + suffix` assembly — Amharic word order differs, and a helper that works in English produces ungrammatical Amharic (ADU-CON-02 §9).

### 4.6 Errors show the request id

Every `TRANSPORT_ERROR` and every unexpected 5xx displays `X-Adulis-Request-Id` in selectable text. It is the only thing that makes a support message actionable.

---

## 5. Screen inventory

| Group | Screens |
|---|---|
| **A · Entry** | SC-00 Sign in · SC-01 Home (readiness / daily brief) · SC-02 Become a seller |
| **B · Trade** | SC-03 Orders · SC-04 Order detail · SC-05 Payment evidence · SC-06 Handoff and QR |
| **C · Catalogue** | SC-07 Products · SC-08 Product editor · SC-09 Variants · SC-10 Media · SC-11 Stock |
| **D · Conversation** | SC-20 Inbox · SC-21 Conversation |
| **E · Trust** | SC-12 Analytics · SC-13 Trust and level · SC-14 Reviews · SC-15 Claims · SC-16 Claim detail |
| **F · Store** | SC-17 Store profile · SC-18 Fulfilment · SC-19 Availability · SC-22 Identity · SC-23 Couriers |
| **G · Administration** | SC-24 Payout · SC-25 Team · SC-26 Subscription · SC-27 Sessions and devices · SC-28 Notifications · SC-29 Closure and deletion |
| **H · Cross-cutting** | SC-30 Notification centre · SC-31 Step-up challenge · SC-C1 Courier |

⚠ marks a screen whose endpoint is **still** unspecified after ADU-API-01 v1.4 — §17 lists all four.

---

## 6. Group A — Entry

### SC-00 · Sign in
**Route** `/sign-in` · **Endpoints** `POST /v1/auth/otp/request`, `POST /v1/auth/otp/verify` · **Unauthenticated**

Phone number → OTP → session. The only sign-in path; there is no password and no email.

**Regions, in reading order:** brand mark · phone entry with country prefix · **"Remember this device" checkbox** · request button · [after request] code entry, resend affordance with countdown, "change number" · help link.

**States:** `READY`, `VALIDATION` (malformed number), `CONFLICT` (rate limited — shows when they may retry), `TRANSPORT_ERROR`.

**Content notes.** Remember-this-device is explained in one sentence naming the trade in plain terms: this device stays signed in for a week; anything touching money still asks for a code. That is R17's actual security argument, and a seller ticking it deserves to know it. **One live challenge at a time** — requesting a new code invalidates the previous one, and the UI must not imply two codes are valid. Resend and re-request are distinct (ADU-AUTH-01 §6); the countdown belongs to resend.

### SC-01 · Home
**Route** `/s/:id` · **Endpoints** `GET /v1/seller/readiness`, `GET /v1/seller/orders?status=needs_action`, `GET /v1/seller/analytics/overview`, `GET /v1/seller/notifications`

**Life 1 — readiness hub.** Nine items from `fn_publication_readiness`, each rendered from `(item, satisfied, resolving_action)`. **The client computes no progress logic**; it counts satisfied rows.

| # | Item | Resolves at |
|---|---|---|
| 1 | Account created | — (always satisfied here) |
| 2 | Seller type declared | SC-02 |
| 3 | Eligibility satisfied | SC-22 |
| 4 | Identity verified *(where the market requires it)* | SC-22 |
| 5 | Company details *(company sellers)* | SC-17 |
| 6 | Store profile | SC-17 |
| 7 | Payout details | SC-24 |
| 8 | Fulfilment configuration | SC-18 |
| 9 | At least one product | SC-08 |

**Not a wizard.** Every item is independently addressable in any order, the screen is returnable across days, and progress is never lost. Availability is **not** a readiness item — R7(c) removed it, because zero windows is valid and a gate that is always satisfied teaches the reader that satisfied rows mean nothing.

**Life 2 — daily brief.** Ordered by consequence: orders awaiting payment confirmation (with time remaining in the confirmation window) · orders paid and awaiting handoff · **open claims** · stock at confidence level 4–5 · unread messages · a small activity summary.

**R23 — the summary covers a rolling 7 days, compared against the preceding 7.** Fixed; **no date picker on Home.** Seven days smooths the weekday/weekend swing that dominates a small retailer's numbers without being long enough to hide a change worth acting on. The picker belongs on SC-12, which is where a seller goes to ask a question; Home answers the question they did not ask, and a control there invites fiddling with a number meant to be glanceable.

**States:** `LOADING`, `READY`, `BLOCKED_READINESS`, `TRANSPORT_ERROR`.

### SC-02 · Become a seller
**Route** `/s/new` · **Endpoints** `POST /v1/seller`, `PATCH /v1/seller/company-details`

Declares individual or company.

> **R26 — choosing company adds exactly one readiness item (`COMPANY_DETAILS`) and changes what identity verification means.** It does not add a second item. The attestation is keyed on `person_id` and has no `seller_id` (ADU-DB-01 §7.3): *a company attestation is an attestation about its representative.* So the item the seller already had now refers to a **named individual**, not to the business.
>
> Both facts appear at the moment of choosing, because both surprise people and a seller surprised mid-verification abandons it. The choice is not reversible without support, and the screen says that too.

---

## 7. Group B — Trade

### SC-03 · Orders
**Route** `/s/:id/orders` · **Endpoint** `GET /v1/seller/orders` · **Permission** `seller.orders:read` · **Companion parity**

**Regions:** filter row (needs action · active · completed · cancelled) · order list · pagination (cursor, never offset).

**Each row carries, in this priority:** buyer's first name · state badge · **the clock that matters in the current state** · line count and total · a single primary action if one is available.

> **The clock changes meaning with state, and the row must not use one countdown for all of them.** In `CREATED`/`NOTIFIED` it is the reservation window. In `PAYMENT_SUBMITTED` it is the **confirmation window** (24h), and the reservation clock is irrelevant. At `PAYMENT_CONFIRMED` **the clock is stopped and no countdown is shown at all** — a running timer on a paid order is the single most misleading thing this screen could display.

**States:** `LOADING`, `EMPTY`, `READY`, `STALE`, `TRANSPORT_ERROR`.

### SC-04 · Order detail
**Route** `/s/:id/orders/:orderId` · **Endpoints** `GET /v1/seller/orders/{id}`, `POST …/payment/confirm`, `POST …/payment/reject`, `POST …/reservations/{rid}/cancel`, `POST …/ready`, `POST …/courier-assignment`, `POST …/refunds`, `POST …/reissue-instructions` **§** · **Companion parity**

**The most important screen in the console.** Regions in reading order:

1. **State and clock** — the resolved state, and the governing deadline only where one is running.
2. **Buyer** — name, contact affordance routing to SC-21. Never a raw phone number where a conversation exists.
3. **Lines** — per line: product, variant attributes, quantity, price, line state. Per-line **Can't Fulfil** where permitted.
4. **Payment** — submitted time, **View evidence** (SC-05), then the two decisions.
5. **Handoff** — Mark Ready · courier assignment · custody transfer · **Show QR** (SC-06). **Gated — see below.**
6. **History** — append-only transition list, plain language, timestamped.

**The payment decision block is specified, not designed:**

> **Confirm Payment Received** and **Payment Not Received** are equally weighted. Neither is styled as the safe default. Directly adjacent, always visible, never behind a disclosure: *"Verify the payment in your own bank or payment account before confirming."* **Confirming without opening the evidence is a normal path** (ADU-ARCH-01 §3.3) — the seller's bank app is the real check — so the UI must not nag, block, or mark evidence as unread-and-required.

**Rejection is a two-step confirmation** and states the consequence: the order returns to awaiting payment with the clock still running, the buyer may submit new evidence once, and a second rejection ends the order.

**States:** all except `EMPTY`. `TERMINAL` renders history with no actions. `CONFLICT` covers the stale-tab case — a seller acting on an order another device already moved sees what state it is actually in, from the server.

**`ready_at` is a timestamp, not a state** (ADU-DB-01 §12.6a). Render it as a fact — "Marked ready at 14:20" — never as a lifecycle stage in the state badge.

> **R20 — the whole handoff region requires `PAYMENT_CONFIRMED`.** All three controls, not only Mark Ready. `fn_mark_order_ready` refuses any earlier state and the endpoint returns 409 `ORDER_NOT_READYABLE`.
>
> **Show QR is gated for a stronger reason than the other two.** The buyer's scan writes `PAYMENT_CONFIRMED → HANDED_OFF`, and no legal transition exists from `PAYMENT_SUBMITTED` — so a QR presented earlier either fails on scan or completes an order nobody has paid for. The token should not be issuable before the payment is confirmed.
>
> **Render, do not hide.** The region stays on screen with its controls disabled and one line: handoff opens once the payment is confirmed. A region that disappears makes a seller wonder what they broke; a region that explains itself teaches the sequence.
>
> *v1.0 omitted this precondition, and the first wireframe pass duly drew a live Mark Ready on an unpaid order. The omission was here, not in the drawing.*

### SC-05 · Payment evidence
**Route** modal over SC-04 · **Endpoint** `GET /v1/seller/orders/{id}/payment-evidence` · **Permission** `seller.payment_evidence:read`

**Regions:** the image, zoomable · submitted time · a close affordance · the two payment decisions repeated so the seller need not close to act.

**Content and security notes.** The image arrives as bytes and renders from a **blob URL revoked on unmount** — never a public or predictable URL (ADU-SEC-01 §7). No download, no print, no share, no copy-image affordance. **Every open is logged**, including the seller's; the seller does not need to be told this each time, but the privacy page states it. The screen carries no "looks valid" affordance of any kind — the decision belongs to the seller's bank account, not to this image.

### SC-06 · Handoff and QR
**Route** modal over SC-04 · **Endpoint** `GET /v1/seller/orders/{id}/qr` · **Permission** `seller.handoff:read`

Large, high-contrast QR for the buyer to scan at the doorway. One line explaining that the **buyer** scans it, and that scanning completes the order and lets them leave a review.

**No offline cache** — the console holds no authenticated data (ADU-CON-02 §8). Offline QR belongs to the mobile Companion. If the screen is opened without a connection it says so plainly and points at the app.

---

## 8. Group C — Catalogue

### SC-07 · Products
**Route** `/s/:id/products` · **Endpoints** `GET /v1/seller/products`, `POST …/{id}/publish`, `POST …/{id}/unpublish`, `DELETE …/{id}`

**Regions:** publication counter (used of effective limit) · search and status filter · product list · **New product**.

**Each row:** primary image · name · variant count · **aggregate stock and its confidence** · published state.

**The publication counter is entitlement-resolved, not tier-read.** The limit is `billing.fn_effective_limit` — the **intersection** of tier and level — so a New seller on Business publishes at the New limit. The counter shows the effective number and, when it binds, **says which of the two is binding**. Getting this wrong tells a paying seller their money did nothing.

**"Unlimited" is never actually unlimited, and the screen must not print the word.** ADU-PRD-01 §16.1 gives Listed a limit of 10 and every paid tier "unlimited" — but the *level* limit is a configuration row and always applies. So the tier alone never determines the number, and a counter reading *"12 of unlimited"* is both meaningless and wrong.

**States:** `LOADING`, `EMPTY`, `READY`, `STALE`, `NO_ENTITLEMENT` (limit reached — **New product** disabled, with what raises it), `TRANSPORT_ERROR`.

### SC-08 · Product editor
**Route** `/s/:id/products/:productId` · **Endpoints** `GET …/{id}`, `POST · PATCH /v1/seller/products`, `POST …/social-posts`

**Regions:** name and description · category · **product-level descriptive attributes** · media (SC-10) · variants (SC-09) · linked social posts · publish control.

**Two attribute layers, and the seller must understand the difference**, because it determines whether the chatbot can answer without them. Product-level attributes describe the product (material, care, origin) and are cascade layer 0 — **free answers, on every tier**. Variant-defining attributes distinguish one variant from another (size, colour). The editor labels them by what they do, not by their schema names.

**Publish** is disabled with `BLOCKED_READINESS` when readiness is unmet, and the block names the missing item and links to it. A 409 from publish returns the readiness items in `items[]` — **render every one, not the first**.

### SC-09 · Variants
**Route** section of SC-08, or `/s/:id/products/:productId/variants/:variantId` · **Endpoints** `POST …/variants`, `PATCH · DELETE /v1/seller/variants/{id}`

Table: attribute combination · price · stock · status — where status is **active or withdrawn**, and a withdrawn variant raises `VARIANT_WITHDRAWN` in a buyer's cart (ADU-API-01 §7.1). **Price lives on the variant** — the product's price is a seed copied at creation and read by nothing afterwards, so the editor never presents a product price as though editing it changes anything.

Two variants cannot share an attribute combination (`variant_key` is trigger-written and unique); the form prevents it and the server refuses it independently.

### SC-10 · Media
**Route** section of SC-08 · **Endpoints** `POST …/images`, `DELETE …/images/{n}`, `PUT …/images/order`, `POST …/video`

Up to five images, one video (≤30s, ≤480p). Drag-to-reorder; position 1 is the storefront thumbnail and is labelled as such.

**Resizing happens in the browser** (ADU-CON-02 §8.1). The upload control shows real progress across three derivatives per image, and on a slow device says it is preparing the image rather than appearing frozen. Reorder is **one request**, not two writes — `UNIQUE (product_id, position)` makes a two-step swap a constraint violation.

### SC-11 · Stock
**Route** `/s/:id/products/:productId/stock` and inline on SC-09 · **Endpoints** `POST /v1/seller/variants/{id}/stock`, `POST …/confirm-stock`, `GET …/stock-events`

**Two distinct actions that must never be conflated:** *set the count* (writes a stock event, changes the number) and **Confirm stock is accurate** (changes no number, refreshes `stock_confirmed_at`, resets confidence). A seller whose count is right but stale needs the second, and if the UI only offers the first they will re-enter the same number to clear the warning — which works, but teaches them the wrong model.

**Confidence is explained by consequence, and only by consequences their entitlement permits** (§4.3). For a Free-tier seller, level 3's chatbot-hedging consequence is not shown, because it cannot happen to them.

**History** is a read of stock events — the same evidence a claim would attach.

---

## 9. Group D — Conversation

### SC-20 · Inbox
**Route** `/s/:id/inbox` · **Endpoint** `GET /v1/conversations?as=seller&seller_id=…` · **Companion parity**

⚠ **The scope parameter is not optional** (ADU-CON-01 R10). One account holds buyer and seller roles; an unscoped list interleaves a seller's business with their own shopping.

**Regions:** conversation list — buyer name, last message preview, unread marker, linked order where one exists · filter for unanswered.

Polling at 30s while the tab is visible; **paused when hidden**. Console polling is ~26% of all origin traffic (ADU-CON-02-A1), and a background tab polling forever is the avoidable part.

### SC-21 · Conversation
**Route** `/s/:id/inbox/:conversationId` · **Endpoint** `POST /v1/conversations/{id}/messages`

Thread with order context pinned where linked. **Where the chatbot answered, the message is marked as such** — the seller must be able to see what was said on their behalf. Where it escalated, that is visible too, since escalation is why the message reached them.

The composer sends manual replies only. **There is no generative assistance and no suggested reply** — the chatbot is deterministic (ADU-PRD-01 §15), and a suggestion feature would be the rejected LLM arriving through the side door.

---

## 10. Group E — Trust

### SC-12 · Analytics
**Route** `/s/:id/insights` · **Endpoints** `GET /v1/seller/analytics/overview`, `…/full`, `POST …/export`

**ADU-API-01 v1.4 §12.13 specifies this group.** v1.0 recorded it as the largest gap in the document — zero analytics endpoints against a PRD that promises every tier some analytics — and it is now closed.

| Entitlement | Content | Source |
|---|---|---|
| Listed / Free | Essential counts | PRD §16.1 |
| Assisted | Views, reservations, conversion | PRD §16.1 |
| **Beta** | Views, reservations, conversion — **the Assisted set** | PRD §16.10 |
| Verified Pro | Full | PRD §16.1 |
| Business | Full **+ export** | PRD §16.1 |

Beta sellers get the Assisted set — **not the Free set** — because `BETA` is a distinct subscription state and beta behaviour is the evidence for every launch decision (PRD §16.10). Rendering them as Free would be wrong on screen and wrong in the funnel.

Locked sections render disabled with what unlocks them (§3.5). **States:** `LOADING`, `EMPTY` (a new seller has no data — say what will appear once buyers arrive), `READY`, `NO_ENTITLEMENT`.

### SC-13 · Trust and level
**Route** `/s/:id/insights/trust` · **Endpoints** `GET /v1/seller/level`, `GET /v1/storefronts/{handle}/stats`

Current level · what the buyer sees · the criteria for the next level with the seller's current numbers against each · level history with the reason for each change.

> **Nothing on this screen is a control.** Level is computed; `fn_recompute_seller_level` has no `UPDATE` grant to the app role. The screen explains and never negotiates.

**Two things it must state plainly.** That level is **independent of subscription tier** — the recompute function touches no billing table, and a paying seller who assumes otherwise will feel cheated. And, where a demotion occurred, **why**, from `seller_level_event.source` — a machine-made restriction on someone's livelihood that arrives unexplained is the case ADU-DPIA-01 §7.4 is about.

### SC-14 · Reviews
**Route** `/s/:id/insights/reviews` · **Endpoint** `GET /v1/seller/reviews`

List with rating, item ratings, text, date, linked order, and any badge.

> **There is no control here.** No hide, no dispute, no reply, no report-this-review. ADU-PRD-01: *a seller can never prevent a review from publishing.* The schema has no seller-writable column on `review` and this screen has no affordance. The empty state explains that reviews unlock when a buyer scans at handoff — which is also the honest explanation of why reviews are scarce and trustworthy.

### SC-15 · Claims · SC-16 · Claim detail
**Route** `/s/:id/claims`, `…/:claimId` · **Endpoints** `GET /v1/seller/claims`, `POST /v1/seller/claims/{id}/remedy`

Claim detail regions: what happened and when · **the evidence attached at claim time** (read-only — attached automatically by claim type, never assembled at review time) · the remedy options available in the current state · deadline · history.

Claims opened by `SYSTEM` — including the confirmation-window lapse of ADU-DB-01 §12.4a — read as a statement of fact, not an accusation. **One open claim per scope**; a second trigger appends evidence rather than opening a second claim, and the screen shows one claim gaining evidence rather than a list that grows.

---

## 11. Group F — Store

### SC-17 · Store profile · **Endpoints** `PATCH /v1/seller/profile`, `PATCH /v1/seller/company-details`
Name, handle, description, category, logo — with a live preview of the storefront header, because this is the only place the seller sees what a buyer sees. Company sellers get the company block and its representative verification, and the screen says the attestation is **about the representative as a natural person**, which is what the schema enforces and what surprises people.

### SC-18 · Fulfilment · **Endpoint** `GET · PUT /v1/seller/fulfilment-methods`
Three methods, at least one required (ADU-DB-01 §13.0). Each toggles and carries a `handoff_note` in the seller's own words — where to collect, which areas are covered. The note is shown to buyers **before they commit stock**, and the field label says so.

**No fee field.** ADU-PRD-01 §25 leaves the delivery fee open; the schema carries no column, and inventing one on screen would create an expectation the back end cannot honour.

### SC-19 · Availability · **Endpoints** `PUT /v1/seller/availability`, ⚠`GET · PUT /v1/seller/availability-overrides`
**Two sections, and the screen must keep them visibly separate: the weekly pattern, and the exceptions to it.**

**Weekly pattern.** Windows per day, one hour minimum, split shifts allowed, **zero windows valid**. Informational: it tells buyers when to expect a reply and gates nothing. The screen says exactly that, because a seller who believes it is a gate will over-report and then miss it.

> **R27 — holiday overrides are included.** Founder ruling, taken against the recommendation in ADU-CON-04-R1, and recorded as an override rather than a consensus.
>
> **The recommendation against them was that availability gates nothing**, so a seller closing for Meskel is already not judged on it, and a date calendar is machinery for a signal with no consequence. **The counter-argument that wins is buyer-facing rather than seller-facing:** a storefront that says *open 9–6 Monday to Saturday* during Timkat is telling buyers something false, and a buyer who messages into silence during a public holiday does not know whether the seller is closed or gone. Availability's one job is setting an expectation, and an expectation that is wrong on the twelve days a year buyers most need it is the case worth building for.

**Overrides — closures only, deliberately.** An override marks a **date on which the store is closed**, with an optional short note (*"Closed for Meskel"*) shown on the storefront and in the chatbot's out-of-hours reply. **There is no "different hours on this date."** Roughly all real use is closure; supporting variable hours per date would need a second window editor and a second set of validation for a case that is rare and carries no consequence. If a seller wants shorter hours for one day, they cannot express it, and nothing breaks.

**The schema this implies, fixed here so ADU-DB-01 v1.8 transcribes rather than decides:**

`core.seller_availability_override` — `seller_id`, `override_date date`, `note text NULL`, `created_at`. `PRIMARY KEY (seller_id, override_date)`. **Presence of the row means closed.** No `is_closed` boolean, because a row that says false is a row that means nothing.

**Rows are not purged.** They accumulate at perhaps ten per seller per year, which is nothing, and a past closure is the answer to *"why did nobody reply on the 27th"* — which the seller will be asked.

**Screen regions:** the weekly grid · a list of upcoming closure dates with a remove control on each · an add control opening a date picker and note field · past closures collapsed behind a disclosure, read-only.

**States:** `READY`, `EMPTY` (no overrides — say what they are for; do not treat an empty list as a problem), `VALIDATION` (a date already overridden).

### SC-22 · Identity and verification **§** · **Endpoints** `POST /v1/seller/social-accounts`, `POST …/verify`, `POST /v1/seller/identity-verification`
Two paths, both explained before either is chosen. **Account control:** a code to post on TikTok or Instagram, then fetch and match — the screen shows the code, where to put it, and the check. **Identity:** hands off to the KYC vendor, and states plainly that **no photograph of a document ever reaches Adulis** — there is no column for one, and saying so is the difference between a seller trusting the flow and abandoning it.

> **R24 — the follower count is captured at verification and re-fetched only when the seller re-checks. There is no background refresh.** It always displays **"as of <date>"**, never a bare number, with a **Re-check** action beside it and one line saying it does not update on its own.
>
> The reason is a risk rather than a cost. A scheduled re-fetch creates a mechanism by which a seller can **lose standing because their follower count drifted down** — and nothing in ADU-PRD-01 says eligibility is continuously re-tested. Ladder entry is `ON CONFLICT DO NOTHING` precisely so re-evaluation never resets a seller who has climbed (ADU-DB-01 §8.1); a refresh job would smuggle continuous re-testing in through a number the seller never agreed to be re-judged on. It also removes a scheduled dependency on two third-party APIs and their rate limits, for a figure that is informational once admission is granted.

### SC-23 · Couriers · **Endpoints** `GET · POST · DELETE /v1/seller/couriers`
Invite by phone; the courier authenticates with **their own OTP** — never shared credentials. List shows each courier, current assignments and last activity. Revoking ends access immediately; assignment-scoped visibility means a revoked courier loses even the orders they held, and the screen says so before confirming.

---

## 12. Group G — Administration

### SC-24 · Payout **§** · **Endpoints** `GET · POST /v1/seller/payout`, `DELETE …/pending`, `GET …/history`

**The highest-value target in the system** (ADU-CON-01 §2). Regions: current details, **masked — only the last four digits exist in `core`** · pending change with its activation countdown · change control (step-up) · cancel control (**no step-up**) · immutable history.

**Five facts the screen states before the seller confirms a change:** it takes effect in 24 hours, not now; the previous details stay in force until then; every Owner and Admin is notified and it cannot be turned off; orders already placed are unaffected because their payout was captured at creation; and it can be cancelled at any time before activation.

> **Cancelling requires no step-up, deliberately** — reverting must always be easier than changing. The cancel control is a peer of the change control, not buried inside it.
>
> **R21 — but it renders only when a `PENDING` row exists.** A console must not offer to cancel something that does not exist. The *promise* — *you can cancel any time before the new details activate* — stays in the pre-change disclosure, where a seller reads it before starting something risky; the *control* appears beside the thing it cancels.

Blocked during either cooling period, with the reason and the date it lifts.

### SC-25 · Team **§** · **Endpoint** `GET · POST · DELETE /v1/seller/team` · **Business tier**
Members, roles, invitations. Each role names what it can and cannot do — notably that **Sales/Support cannot see or change payout details** despite confirming payments daily.

**Team is Business tier only** (ADU-PRD-01 §16.1 — "Yes, RBAC" appears on Business and on no other row). Verified Pro does **not** include it. Every lower tier renders `NO_ENTITLEMENT`.

⚠ **Ownership transfer** has an endpoint (`POST /v1/seller/ownership-transfer` **§**), a permission and a database function — **and no product rules.** No document says who may receive a store, what notice the outgoing owner gets, or what happens to an in-flight payout change or an open claim. **The mechanism must not ship before the policy**; ADU-PRD-01 v8.6 owes it. The screen is not built until it does.

### SC-26 · Subscription **§** · **Endpoints** `GET /v1/billing/subscription`, `POST /v1/billing/purchase-intent`
Current state, renewal, tier comparison, purchase. **Console only** — these endpoints return 403 to a mobile session, and no price, tier name or billing link exists anywhere in the mobile bundle (ADU-API-01 §4.1).

Beta sellers see their beta state and its end date, and **the commercial position stated in advance**: the chatbot is included during the beta and becomes a paid capability afterwards. PRD §16.10 is explicit that a seller who learns this at conversion churns and is right to.

### SC-27 · Sessions and devices **§** · **Endpoints** `GET · DELETE /v1/auth/sessions`, `POST …/revoke-others`
Active sessions and **remembered devices** (R17), each with label, last used and location approximation. Revoke one, revoke others, revoke all. Revoking a remembered device ends every session it created, in the same transaction — the screen says so, because the two look separate and are not.

### SC-28 · Notification preferences · **Endpoints** `GET · PATCH /v1/seller/notification-preferences`

**R22 — eight categories. Seven toggleable, one locked.** v1.0 said "per-category toggles" and no document had ever listed the categories, so the screen could not be built.

| # | Category | Covers | Default |
|---|---|---|---|
| 1 | Orders and reservations | New reservation · buyer cancelled a line · reservation expiring · reservation expired | On |
| 2 | **Payments** | Buyer submitted payment · confirmation window closing · confirmation window lapsed | On |
| 3 | Handoff | Courier accepted custody · buyer scanned at handoff | On |
| 4 | Messages | New buyer message · assistant escalated a conversation | On |
| 5 | Reviews and claims | Review received · claim opened · claim resolved | On |
| 6 | Trust level | Level changed, with the reason | On |
| 7 | Stock | Stock not confirmed recently · a variant sold out | On |
| 8 | **Security and payout** | Payout requested, activated or cancelled · new-device sign-in · sessions revoked | **Locked on** |

The seven sit in a grouped control; **the locked row sits outside it**, visibly disabled with a short reason — showing it is more honest than hiding it, since a seller looking for the setting should find an explanation rather than an absence.

> **Category 8 is the only locked one, and the boundary is deliberate: suppression is disabled for account security, not for importance.** It is `suppressible = false` at the database (ADU-DB-01 §13.4) and always includes SMS to the registered number, because that is the channel that reaches a seller whose account is being taken over.

> **Category 2 stays toggleable even though it is the most consequential.** A seller who switches it off risks missing the 24-hour confirmation window, losing the sale and drawing a `SYSTEM` claim (ADU-DB-01 §12.4a). **The right response is to tell them at the moment they toggle it** — one line naming that consequence — not to take the choice away. Locking it would broaden `suppressible = false` past the security justification that earned it.

**Channel selection is post-MVP.** One on/off per category at V1; push, in-app and SMS are not separately selectable. Recorded so the absence is a decision.

### SC-29 · Closure and deletion **§** · **Endpoints** `POST · DELETE /v1/seller/closure`, `GET …/deletion/blockers`, `POST /v1/seller/deletion`
Two distinct things, and the screen must not blur them. **Closing** is reversible: it stops new obligations, unpublishes, and the seller can reopen. **Deletion** is not, and is blocked while obligations exist. Blockers are listed individually with what clears each — **every one, from `items[]`, never the first**.

### SC-30 · Notification centre
**Route** `/s/:id/notifications` · **Endpoint** `GET /v1/notifications?as=seller&seller_id=`
Chronological, unread marked, each deep-linking to its object. Read state syncs with the Companion — the same list, two surfaces.

### SC-31 · Step-up challenge
**Modal, invoked by eight actions.** OTP entry with the action and its target both named in the prompt: *"Enter the code to change your payout account"*, never a bare "confirm your identity". ADU-AUTH-01 binds a challenge to **action and target**, and the copy must make that legible — a seller who cannot tell what they are authorising cannot notice when it is wrong.

### SC-C1 · Courier
**Route** `/courier` · **Endpoints** `GET /v1/courier/orders`, `GET …/{id}`, `POST …/custody-accept`
**One screen. No seller navigation, no store context, no catalogue.** Assigned orders only — row-level security means a courier's list *is* their assignments, and access ends with the assignment. Per order: pickup, buyer name, handoff address from the seller's note, custody accept, and the QR for the buyer to scan.

> **A courier can never perform the buyer's scan.** The composite foreign key makes it structurally impossible, and this screen offers no affordance that would suggest otherwise.
>
> **R25 — the QR renders only after custody is accepted.** Two states, and the difference between them is the point. *Assigned, custody not accepted:* order reference, collection point, buyer's first name, the seller's handoff note, **Accept custody** — and **no QR**. *Custody accepted:* the same, plus the QR.
>
> Event A exists to record the moment responsibility moves from seller to courier (ADU-DB-01 §14.1). A QR visible before that is a path to the buyer's scan happening while the goods are still with the seller — writing a completed handoff for an order nobody has handed over.

---

## 13. Localisation and layout

**Both locales ship; the switcher is hidden until human translation completes** (`AM_ENABLED`). Every string is a catalogue key; a missing Amharic key is a **compile error**, not a runtime fallback (ADU-CON-02 §9).

- **No fixed heights** on any container holding translated text. Amharic runs longer and a fixed card clips it.
- **Latin family first, Ethiopic second**, each with its own `unicode-range`. An Ethiopic-only stack drops every digit and Latin brand name — "TikTok", "ADULIS", "48" — and ADU-PROJ-01 §12 makes the mixed-script render a release gate.
- **Test with realistic Amharic**, not lorem ipsum: long store names, long product names, and the eight step-up prompts, which are the longest sentences in the product.
- Numbers stay Latin-digit. Dates and money go through `Intl`.

## 14. Empty states

Each states what appears, why it matters, and one action.

| Screen | Appears when | Action offered |
|---|---|---|
| SC-03 Orders | Buyers reserve from your storefront | Share your storefront link |
| SC-07 Products | Your catalogue | Add your first product |
| SC-09 Variants | Sizes, colours, options | Add a variant |
| SC-20 Inbox | Buyer questions | *(none — explains that the chatbot answers first)* |
| SC-12 Analytics | Once buyers visit | Share your storefront link |
| SC-14 Reviews | After a buyer scans at handoff | *(none — explains the gate)* |
| SC-15 Claims | If something goes wrong | *(none — an empty claims list is good news and should read that way)* |
| SC-23 Couriers | People who deliver for you | Invite a courier |
| SC-27 Sessions | *(never empty — the current session is always listed)* | — |

**Two empty states offer no action, deliberately.** Reviews and claims cannot be caused by the seller, and an action there would either be a lie or an invitation to game the gate.

## 15. Accessibility baseline

Semantic HTML first, ARIA only to fill a gap · full keyboard operation with visible focus · **44×44px minimum targets** (ADU-WEB-01 §325) · submit buttons stay enabled so validation can be triggered and explained · validation errors appear as a summary of links that focus each invalid field · **no state conveyed by colour alone** — every state badge carries text · async outcomes announced to screen readers, which matters most on the two payment decisions · reduced-motion respected.

## 16. What is not in the console

No Accept Reservation · no assertion that a payment is genuine · no level control · no review moderation of any kind · no cross-seller discovery · no operator function · no offline data · no bulk reissue · no generative assistance. **A screen that seems to need one of these is wrong**, and the fix is upstream of the screen.

## 17. Contract gaps this document depends on

**v1.0 recorded twenty-eight missing endpoints. ADU-API-01 v1.4 specifies all of them**, so the register that governed this document is closed. Four items remain.

| # | Item | Status |
|---|---|---|
| 1 | ⚠ `GET · PUT /v1/seller/availability-overrides` | **New, created by R27.** Requires ADU-DB-01 v1.8 (`core.seller_availability_override`, 109 tables) and ADU-API-01 v1.5. SC-19's override section cannot be built until both land |
| 2 | Chatbot configuration and custom flows | **Deferred** — Business tier, ships when Business does |
| 3 | Broadcasts | **Deferred** — Pro tier and Trusted level; `fn_send_broadcast` exists |
| 4 | Bulk stock write | **Deferred** — Business tier |

**Everything a beta seller touches is now specified.** SC-04, SC-08, SC-12 and SC-30 — four of the six screens a seller uses daily, and blocked in v1.0 — are unblocked. The three deferrals are entitlement-gated capabilities no beta seller has, so their screens are not built rather than blocked.

**Item 1 is the only thing in this document that cannot be built today**, and it exists because a ruling was taken after the contracts were reissued. That is the ordinary cost of deciding late rather than a defect: the design is fixed in SC-19, so the two reissues transcribe it.


---

*Binding content architecture, v1.1 — corrected against two rounds of wireframes drawn from it. Twenty-nine seller screens plus one courier screen, one navigation model, twelve states, and a closed set of verbatim labels for the actions that move money. Eight rulings land here, two of them closing defects this document itself introduced: v1.0 listed the handoff region without its precondition, and said "per-category toggles" for categories no document had ever enumerated. Both were found by drawing the screens, which is what drawing them was for. The two rules underneath all of it are unchanged: the console renders business state and computes none of it, and every list has an empty state that teaches.*
