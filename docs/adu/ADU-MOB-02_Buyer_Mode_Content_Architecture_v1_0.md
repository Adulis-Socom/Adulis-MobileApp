# ADU-MOB-02 -- Buyer Mode: Content Architecture

**Version:** 1.0  -  **Baseline date:** 5 September 2026
**Owner:** Founder / CEO -- sole engineer (ADU-REPO-01 v1.3 S3)
**Status:** **Binding content and information architecture for Buyer Mode.** It decides **what a buyer sees, where, and in what state.** It does not decide visual design.
**Scope:** **Buyer Mode only.** The Seller Companion is ADU-CMP-01, unwritten.
**Drawn from:** ADU-MOB-01 **v1.1**  -  ADU-MOB-00 **v1.1**  -  ADU-MOB-AMD-01 v1.0  -  **ADU-API-01 v1.11**  -  **ADU-AUTH-01 v2.8**  -  **ADU-DB-01 v1.19**  -  ADU-RUL-04 v1.0  -  ADU-CON-03 v1.1 (its counterpart)  -  ADU-PRD-01 v8.5  -  ADU-PD-01 v1.0  -  ADU-DPIA-01 v1.0  -  ADU-WEB-01 v1.0  -  ADU-VAL-01 v1.0  -  ADU-PROJ-01 v9.0
**Encoding:** ASCII.

---

## 0. What this document is

**This is ADU-CON-03 for the buyer's app.** ADU-MOB-01 S7 lists the surfaces, their endpoints and the rule that constrains each. **This turns that list into screens** -- their regions in reading order, the states each implements, the copy that is an invariant, and the empty state that is mandatory on every list.

It gives five things: the **navigation model** (S2), the **state vocabulary** every screen draws from (S3), the **content rules** that bind copy (S4), the **screen inventory** -- forty screens, each with regions, endpoints and states (S6-S13) -- and the **empty-state catalogue** (S15).

**What it deliberately does not contain.** No colours, type scale, spacing or component design; those are **ADU-MOB-03**. No wireframes; those are **ADU-MOB-04**, derived from this document mechanically, which is why every screen states its regions in reading order rather than its appearance. **No final copy** -- English strings are written as *content intent*, because the real strings are catalogue keys in `packages/locale` authored once and translated, and a document that hard-codes them creates a second source of truth. **Where a label is an invariant it is given verbatim and marked so.**

**Screen IDs are stable.** `MB-nn` is referenced by ADU-MOB-03 and ADU-MOB-04, by the folder names under `apps/mobile/src/features/`, and by Maestro flow names. **They are never renumbered; a retired screen leaves a hole.**

### 0.1 Two things this document is allowed to do that ADU-MOB-01 is not

1. **Rule on copy.** ADU-MOB-01 rules on architecture and deliberately stops at the string. Where a sentence is the control -- the new-seller disclosure, the claim-evidence rule, the scan-versus-tap labelling -- **the ruling is here**, because the string *is* the mechanism.
2. **Close ADU-MOB-01 S24 Q12.** The in-session scan retry budget was assigned to this document by ADU-MOB-AMD-01 G1. **M1 rules it**, subject to founder ratification, and it sets the floor for ADU-VAL-01 D3.

### 0.2 The rulings in this document

| # | Ruling | Screen |
|---|---|---|
| **M1** | **The scan retry budget.** Twenty seconds of visible retry before the tap alternative is offered; never auto-navigate; never auto-tap | MB-21 |
| **M2** | **There is no entitlement state in Buyer Mode**, and no permission state either. A capability the buyer lacks is not rendered and is never explained by naming a tier | S3.5 |
| **M3** | **Home's empty following list is a designed first screen, not an empty state.** It is the entire first experience for every new buyer | MB-01 |
| **M4** | **The order is one screen.** No separate payment tab, no wizard; a state-driven action region on a single card | MB-16 |
| **M5** | **Every server-supplied freshness stamp is rendered.** `available_checked_at`, `confirmed_at`, review dates. A number with no "as of" is a claim the app cannot support | S4.7 |
| **M6** | **Scan is the action; the tap is one step further and is labelled as the weaker record.** B9 expressed as placement and copy | MB-21, MB-23 |
| **M7** | **The new-seller disclosure is a full-screen interstitial at the reservation step**, not a checkbox and not a banner | MB-14 |
| **M8** | **The claim evidence screen states the single-transaction rule in its own copy**, and names what a statement would reveal | MB-27 |
| **M9** | **Payment instructions: an explicit copy control, nothing auto-copied, no screenshot block, nothing on disk** | MB-17 |
| **M10** | **Post-link resolve has five states and *several matches* is the ordinary one** | MB-02 |
| **M11** | **Sign out and delete my account are different screens, different words, and not adjacent** | MB-32, MB-37 |
| **M12** | **A countdown that belongs to the seller is labelled as the seller's.** The buyer must never be shown someone else's deadline as though it were an instruction to act | MB-16 |

---

## 1. Who is on this surface

| Actor | How they arrive | What they see |
|---|---|---|
| **Anonymous visitor** | Install, or a deep link from a bio link | **Everything except identity.** Browse, search, cart, follow-intent. ADU-PRD-01 S6.1: *"Browsing is fully anonymous on all clients"* |
| **Identified buyer** | Created an account inside the reserve flow | Everything |
| **A buyer who is also a seller** | Same account, same session | **The same Buyer Mode.** Their seller work is the Companion or the console; nothing on this surface changes because they sell |
| **Courier** | -- | **Nothing.** The courier surface is `SC-C1` on the console |
| **Operator** | -- | **Nothing** |

**Identity is created at first reserve and at no other moment.** There is no sign-in prompt at launch, at browse or on the storefront (ADU-MOB-01 S4.2). Sign-in is *offered* from the orders tab and the account tab, for an existing buyer on a new device; an account is *created* only inside the reserve flow.

> **The anonymous buyer is not a degraded user.** They are the majority of every session, and the app is designed for them first. A screen that is unusable without a session is a screen that has been built backwards.

---

## 2. Navigation

### 2.1 The shape

```
app/(tabs)/index               Home -- feed, or the first-run screen
app/(tabs)/orders              Orders
app/(tabs)/inbox               Chat
app/(tabs)/account             Account
app/s/[handle]                 Storefront
app/s/[handle]/p/[slug]        Product          <- the deep-link target
app/cart                       Cart
app/orders/[id]                Order
app/scan                       Scan
app/claims/[id]                Claim
app/upgrade-required           The floor. Nothing routes past it
```

**The link map is the directory listing** (ADU-MOB-01 S3.2), which is why it is reviewable in a diff.

### 2.2 Four tabs. Not five

| # | Tab | Why it is primary |
|---|---|---|
| 1 | **Home** | The only surface a buyer with no order reaches for |
| 2 | **Orders** | Where money and obligation live. The most consequential screen in the app is one tap from launch |
| 3 | **Chat** | Time-sensitive, and the only channel to a seller |
| 4 | **Account** | Follows, notifications, sessions, language, deletion |

**There is no Search tab and no Scan tab, both deliberately.**

- **Search is not cross-seller and never will be** (ADU-PRD-01, ADU-PD-01 S2). A search tab would promise a catalogue-wide search the product does not have and must never have, and the disappointment would be structural rather than a bug.
- **Scan is not a destination.** It is an action on an order that is ready for handoff, reached from that order. **A scan tab invites scanning without an order**, which is a screen with no correct outcome. It is also how a buyer would learn to scan first and find the order afterwards, which is the wrong order of operations at a doorway.

### 2.3 Home has two lives, and the first one is the product's hardest screen

> **RULING M3 -- Home with an empty following list is a designed first screen, not an empty state.**
>
> ADU-MOB-01 S7.1: *"The empty following list is the entire first experience of this surface for every new buyer."* Every buyer arrives here following nobody. **A skeleton, an apology or a bare icon is the first thing the product ever says**, and the two recovery paths ADU-PRD-01 S21.2 makes mandatory have nowhere else to live.

**Life 1 -- first run.** Two actions, equally weighted, above anything else: **paste a post link** (MB-02) and **find a seller** (MB-03). One sentence explaining that Adulis shows the sellers you choose to follow, and nothing else. **No suggested sellers, no popular near you, no categories to browse** -- there is no cross-seller discovery in this product and a first screen that implies one is a promise the app breaks on the next tap.

**Life 2 -- the feed.** Recency over the followed set (`GET /v1/feed`). No sort control, no *recommended*, no *similar to*. Same route, same screen ID.

### 2.4 Deep links and push never bypass a gate

- **A deep link into an authenticated surface with no session lands on the anonymous equivalent, never a dead end.** A push into an order the buyer is signed out of shows sign-in, then the order.
- **Nothing routes past `UPGRADE_REQUIRED`** -- not a deep link, not a push tap (ADU-MOB-01 S6.1).
- **Deep-link input is untrusted.** Handle and slug are shape-validated before they are routed or interpolated into a request.
- **A notification tap deep-links to the object and the app re-reads it.** The app renders no amount, deadline or state name from a push payload (B15).

---

## 3. The state vocabulary

Every screen declares which of these it implements. **The set is closed.** A screen needing a state not on this list has found a contract gap, and the answer is to raise it in ADU-MOB-01 S22, not to invent a state.

| Key | When | What is shown |
|---|---|---|
| `LOADING` | First fetch, nothing on screen | Skeleton in the final layout's shape. **Never a full-page spinner** |
| `EMPTY` | Success, zero rows | **Mandatory on every list** (S3.2) |
| `READY` | Data present | The screen |
| `STALE` | Refetching with data on screen | Existing data stays visible and interactive; a quiet indicator only |
| `SENDING` | A state-changing request is in flight | **The action is disabled and named as in progress. Never rendered as complete** |
| `RETRYING` | A send failed and the screen is retrying | **Mobile-specific.** Visible retry affordance, a plain statement that it has not been sent, and the elapsed attempt. MB-21's whole design |
| `CONFLICT` | 409 | The server's `message_key` + `slots`, and the state the object is actually in |
| `VALIDATION` | 400 / 422 | Per-field messages, each attached to its field |
| `NOT_FOUND` | 404 | **"Not found." Never "you are not allowed"** (S4.3) |
| `TERMINAL` | The object's lifecycle has ended | History and record, no actions |
| `TRANSPORT_ERROR` | Network failure or 5xx | Retry, plus the request id in selectable text (S4.6) |
| `UPGRADE_REQUIRED` | Below the `/v1/bootstrap` floor | The blocking screen. No other content, in either locale, with no session |
| `SIGNED_OUT` | 401 on an authenticated surface | The anonymous equivalent of the screen, plus sign-in. **Never a modal trap** |
| `DEVICE_PERMISSION_NEEDED` | The OS refused camera or notifications | **A device permission, not a server one.** What the feature needs and the route to Settings |

### 3.1 The rule beneath the vocabulary

> **INVARIANT -- the app computes no business state.** It never derives expiry from `created_at + 48h`, never computes a trust level, never decides eligibility, never predicts a scan outcome, never infers whether a transition is legal. It renders `state`, `allowed_actions`, `items[]` and `outcome` as the server resolved them.
>
> **A countdown may *display* a server-supplied deadline. It may not *decide* anything when it reaches zero** -- it refetches and shows what the server says.

### 3.2 Empty states are mandatory and specified

ADU-PRD-01 S23.2: *"Every list surface defines an empty state... It is never a bare icon, an apology, or a blank region."*

**Every empty state carries exactly three things:** what will appear here, why it is worth having, and **one action** that makes it appear -- **or an explicit statement of why no action is offered.** S15 catalogues all of them.

### 3.3 Loading is a skeleton, and the reason is the device

The reference device is a low-end Android on a slow connection (ADU-MOB-01 S13). **A spinner on that device is on screen long enough to be read as a hang.** A skeleton in the final layout's shape also stops the reflow that makes a slow screen feel broken twice.

### 3.4 Every closed set has a default branch

The app never validates a response against a strict schema (B1), so **an unrecognised order state, error code or scan outcome must render something honest rather than a blank.** The default branch is a real string -- the object's state as the server named it, plus what the buyer can do -- not an empty view and not a crash. This is the version-skew contract's client half.

### 3.5 There is no entitlement state, and no permission state

> **RULING M2 -- `NO_ENTITLEMENT` and `NO_PERMISSION` do not exist in Buyer Mode.**
>
> The console renders a locked control with what unlocks it, because the console is the only surface where billing exists. **On mobile that pattern is the App Store rejection**, spelled out (ADU-MOB-01 S16). A disabled control captioned *"available on Verified Pro"* is a tier name in the bundle.
>
> **And there is nothing to render anyway.** All eight step-up permissions are `CONSOLE`-only, Buyer Mode calls no permission-gated endpoint, and `revoke-others` is `CONSOLE`-only (D-34) so the app renders no control for it.
>
> **Consequence for the error mapper:** `PERMISSION_DENIED` and `STEP_UP_REQUIRED` reaching a buyer screen can only mean a client defect. They render as `TRANSPORT_ERROR` **with the request id**, because a buyer cannot act on them and a support message can.
>
> **The one place a tier could still leak is a seller's chatbot cap arriving in chat** (`TIER_LIMIT_REACHED`). The catalogue entry for it names the capability and where it is configured, **and never the tier, and never a route to change one.**

---

## 4. Content rules

### 4.1 Verbatim labels -- invariants, not suggestions

| Action | Label | Source |
|---|---|---|
| The buyer scans the seller's code | **Scan to complete** | ADU-PRD-01 S11.3, B9 |
| The buyer completes without scanning | **I received it without scanning** -- never "Confirm receipt" as a peer of Scan, never "Complete order" | M6 |
| Sending the scan | **Sending -- not yet recorded** | M1 |
| The buyer submits payment proof | **I have paid -- send proof** | ADU-PRD-01 S10 |
| Cancelling one line | **Cancel this item** -- never "Cancel order" where lines remain | ADU-MOB-01 S7.5 |
| Acknowledging a refund | **I received this refund** -- an explicit action, never inferred | ADU-MOB-01 S7.5 |
| Accepting a reservation | **Does not exist.** No seller acceptance step exists in the product, and no buyer screen may imply one is pending | ADU-ARCH-01 S3.2 |

> **INVARIANT -- Adulis never asserts that a payment is genuine, and never characterises a seller.** No screen shows "verified", "trusted seller", "safe", a green tick against a payment, or any synonym. **The buyer's own record is what the app shows; the platform makes no claim about it.**

### 4.2 Terminology, fixed across the app

**Reserve**, not "buy" or "order now" -- nothing is bought on Adulis and the word would be a promise about money the platform does not hold. **Handoff**, not "delivery". **Storefront**, not "shop" or "store" in buyer-facing copy -- *store* is what the seller calls their own. **Level**, never "rank", "score" or "tier" -- *tier* is a subscription word and it must not appear at all (S4.3). **Seller**, never "vendor" or "merchant". **Scan**, never "check in" or "confirm" -- the whole product rests on the difference between scanning and tapping, and the copy is where that difference is taught.

### 4.3 Copy that must never appear

**Carried verbatim from ADU-WEB-01 S3's copy invariants, which bind every string in this app** (ADU-MOB-01 S16.3):

- **Never** *buyer protection*, *protects buyers*, *guaranteed*, *safe purchase*, *secure transaction*, *we make sure*, *we check*, or any synonym. **There is no escrow.** A claim here is a promise the company cannot keep, and it is the copy most likely to be written by someone being helpful.
- **Never** any implication that Adulis verified, held or checked a payment.
- **Never** a price, tier name, currency figure for a subscription, the word *upgrade*, a purchase flow, or a link to a billing surface -- **anywhere, including help and onboarding text** (ADU-MOB-01 S16.1).
- **Never** a "sell on Adulis" call to action (B19).
- **Never** a seller characterisation in either direction -- no "top seller", no "new and unproven", no warning adjective. **The New-seller disclosure states facts** (M7) and stops.
- **Never** "you are not allowed" where the server said 404 (S4.6 of ADU-AUTH-01 S19).
- **Never** a delivery timing promise. Adulis does not deliver.

### 4.4 Numbers, money, dates -- and the two clocks

The wire carries `{amount_minor, currency}` and RFC 3339 UTC. **The client formats, always**, through `Intl` against the market timezone from `/v1/bootstrap`. A server-formatted `"45.00 ETB"` is a translation fragment wearing a disguise.

**Relative time is permitted for recency** (*"2 hours ago"* on a message). **It is forbidden for a deadline.** Deadlines are absolute and carry the timezone, because *"expires in 3 hours"* on a screen that has been open for two is wrong in the direction that costs the buyer their reservation.

> **RULING M12 -- a countdown that belongs to the seller is labelled as the seller's.**
>
> The order card shows a different clock in each state, and **two of the three are not the buyer's obligation**:
>
> | Order state | The clock | Whose deadline |
> |---|---|---|
> | `CREATED` / `NOTIFIED` | The reservation window | **The buyer's.** Pay before it ends |
> | `PAYMENT_SUBMITTED` | The seller's 24-hour confirmation window | **The seller's.** The buyer's copy says the seller is checking, and when they must answer by. **It is not an instruction to the buyer and must not read as one** |
> | `PAYMENT_CONFIRMED` | **None. The clock stops and no countdown is shown at all** | -- |
>
> A running timer on a confirmed order is the single most misleading thing this screen could display -- the console's SC-03 says the same from the other side, and the buyer's version is worse, because the buyer cannot see what the seller is doing.
>
> **What replaces the countdown at `PAYMENT_CONFIRMED` is blocked** -- the fulfilment window length is ADU-VAL-01 3.2 and nobody has chosen it (ADU-MOB-01 S24 Q5). **Until it is chosen the card says what happened, not what happens next**, and S19 records that as a gap rather than letting a screen invent a number.

### 4.5 Sentences, never fragments

Every string is a complete sentence or a whole label with **named** slots. **No `prefix + value + suffix` assembly** -- Amharic word order differs, and a helper that reads correctly in English produces ungrammatical Amharic. A missing Amharic key is a compile error, not a runtime fallback.

### 4.6 Errors carry the request id

Every `TRANSPORT_ERROR` and every unexpected 5xx displays `X-Adulis-Request-Id` in **selectable** text. It is the only thing that makes a buyer's support message actionable, and on a phone it must be selectable rather than merely visible.

### 4.7 Freshness is content, not decoration

> **RULING M5 -- wherever the server supplies a freshness stamp, the screen renders it. A number without its "as of" is a claim the app cannot support.**

| Stamp | Screen | Why it is not optional |
|---|---|---|
| `available_checked_at` on each cart line | MB-11 | **A cart is a draft and the interface has to say so.** A line that says *in stock* with no timestamp is the app asserting something it learned minutes ago |
| `confirmed_at` on stock | MB-07, MB-11 | Every stock claim carries when it was last true. This is the seller's own confirmation, not our measurement |
| Review date and badge | MB-10, MB-24 | Two ratings, **never averaged into one number** |
| Trust level and completed handoffs | MB-06 | Page content from the storefront call, not a second request, and rendered as counts rather than as praise |

---

## 5. Screen inventory

| Group | Screens |
|---|---|
| **A - Entry and recovery** | MB-00 First launch  -  MB-01 Home  -  MB-02 Paste a post link  -  MB-03 Find a seller  -  MB-04 Sign in  -  MB-05 Upgrade required |
| **B - Discovery** | MB-06 Storefront  -  MB-07 Product  -  MB-08 Video embed  -  MB-09 Search within a seller  -  MB-10 Seller reviews |
| **C - Cart and reserve** | MB-11 Cart  -  MB-12 Review and reserve  -  MB-13 Reconciliation  -  MB-14 New-seller disclosure |
| **D - Orders and payment** | MB-15 Orders  -  MB-16 Order  -  MB-17 Payment instructions  -  MB-18 Send proof of payment  -  MB-19 Cancel an item  -  MB-20 Refund |
| **E - Handoff** | MB-21 Scan  -  MB-22 Scan outcome  -  MB-23 Complete without scanning |
| **F - After the handoff** | MB-24 Leave a review  -  MB-25 Claims  -  MB-26 Claim  -  MB-27 Claim evidence  -  MB-28 Report  -  MB-29 Block |
| **G - Chat** | MB-30 Conversations  -  MB-31 Conversation |
| **H - Account** | MB-32 Account  -  MB-33 Notifications  -  MB-34 Notification primer  -  MB-35 Following  -  MB-36 Devices and sessions  -  MB-37 Delete my account  -  MB-38 Language  -  MB-39 About Adulis |

**[!] marks a screen blocked on a decision or a contract gap. S19 lists all of them.**

---

## 6. Group A -- Entry and recovery

### MB-00 - First launch
**Route** `app/(tabs)/index`, first run  -  **Endpoints** `POST /v1/devices`, `GET /v1/bootstrap`  -  **Anonymous**

**No sign-in prompt. No notification prompt. No account of any kind.** Both are ruled: identity is created at first reserve (ADU-MOB-01 S4.2) and notification permission is requested after the first reservation (S10.2). **A launch screen that asks for a phone number loses the buyer the storefront just earned.**

**Regions, in reading order:** wordmark  -  one sentence saying what Adulis is, in the market's language  -  **Paste a post link** (MB-02)  -  **Find a seller** (MB-03)  -  language control if the device locale is ambiguous.

**States:** `LOADING` (bootstrap in flight -- **the app renders nothing else until it resolves**), `READY`, `UPGRADE_REQUIRED`, `TRANSPORT_ERROR`.

> **The bootstrap failure path is a screen, not a toast.** A 429 or 503 costs the app the market, the locales, the clock reference and the version floor at once. **It does not proceed with defaults.** It shows what it is doing, retries with backoff, and offers a manual retry. **The cached clock offset survives; the cached floor does not exist** -- a stale floor is how a below-floor client keeps running (ADU-MOB-00 S5.2).

### MB-01 - Home
**Route** `app/(tabs)/index`  -  **Endpoint** `GET /v1/feed`  -  **Anonymous**

**Two lives, one screen ID (M3).**

**Life 1 -- following nobody.** MB-00's two actions, permanently, plus one sentence: Adulis shows you the sellers you follow. **No suggested sellers. No categories. No "popular".** There is no cross-seller discovery in this product.

**Life 2 -- the feed.** Recency over the followed set. Each entry: seller handle and logo, the post or product, the time. Tapping goes to the product (MB-07) or storefront (MB-06).

**Absent by design:** any sort control, any *recommended* or *similar to*, any engagement signal, any ranking. `GET /v1/feed` accepts no parameter that would rank, and none may be added -- *"an endpoint that accepts a ranking parameter is one flag away from being a recommender."*

**States:** `LOADING`, `READY` (both lives), `STALE`, `TRANSPORT_ERROR`. **`EMPTY` does not apply** -- an empty following list is Life 1, which is a designed screen.

### MB-02 - Paste a post link
**Route** `app/link`  -  **Endpoint** `POST /v1/post-links/resolve`  -  **Anonymous**

> **RULING M10 -- five states, and *several matches* is the ordinary one, not the edge case.**
>
> ADU-MOB-01 S7.1: the endpoint *"returns a list -- one post commonly features several products."* A screen built for the single-match case and patched for the rest will show a list as an error.

| Result | The screen |
|---|---|
| **One product** | Goes straight to MB-07. No intermediate confirmation |
| **Several products** | **A list, presented as the normal outcome**: *"This post features 4 items."* Each row is the product card |
| **None** | The seller's storefront, with one line saying this post has no items linked to it |
| **Unrecognised link** | Plain: this is not a link we recognise. **Names the two platforms** and offers Find a seller |
| **No longer available** | The seller's storefront where the seller is known, otherwise Find a seller |

**The paste affordance reads the clipboard only on an explicit tap.** Nothing is read automatically -- on iOS an automatic read shows the system paste banner, which reads to a buyer as the app taking something.

**States:** `READY`, `SENDING`, `VALIDATION` (not a URL), `NOT_FOUND`, `TRANSPORT_ERROR`.

### MB-03 - Find a seller
**Route** `app/find`  -  **Endpoint** `GET /v1/sellers/lookup?q=`  -  **Anonymous**

**Returns sellers, never products.** **Never suggests a seller the buyer did not search for** -- no recent, no popular, no "you might like". An empty query returns nothing and the screen says what to type.

**Each result:** handle, logo, trust level, completed handoff count. **Counts, not adjectives** (S4.1).

**States:** `READY`, `SENDING`, `EMPTY` (**no match -- say that the handle is the seller's own and where they publish it**), `TRANSPORT_ERROR`.

### MB-04 - Sign in
**Route** `app/sign-in`  -  **Endpoints** `POST /v1/auth/otp/request`, `POST /v1/auth/otp/verify`  -  **Anonymous**  -  **[!] blocked on N1**

Phone number, then a 6-digit code. **No password, no email, no social login.**

**Regions:** phone entry with country prefix  -  request control  -  [after request] code entry with autofill, **the age declaration checkbox**, resend with countdown, change-number  -  help.

> **The age checkbox renders for everyone, and the app never first asks whether the phone has an account.** Rendering it only for new accounts would answer, on screen, the enumeration question ADU-AUTH-01 S17 forbids answering. **The server requires it only for account creation** and refuses with `AGE_DECLARATION_REQUIRED`, which the app renders **at the checkbox**, never as a toast.

**Copy:** a self-declaration of being 18 or over. **Never described as verification.** **No date of birth is collected** -- Adulis sells no age-graded product, so a birth date would be data held for no purpose.

> **INVARIANT -- every refusal on this path is byte-identical for a number that has an account and one that does not.** `RATE_LIMITED` renders as a wait with `Retry-After`. Resend and re-request are distinct; the countdown belongs to resend. **One live challenge at a time** -- requesting a new code invalidates the previous one, and the screen must not imply two are valid (`OTP_SUPERSEDED`).

**[!] The request body is a contract gap.** ADU-AUTH-01 v2.8 S5.2 and ADU-API-01 v1.11 S5 disagree on what verify takes, and **the difference decides whether this screen keeps a `challenge_id` between two steps.** Build against AUTH v2.8; S19 N1.

**States:** `READY`, `SENDING`, `VALIDATION`, `CONFLICT` (rate limited, superseded), `TRANSPORT_ERROR`.

### MB-05 - Upgrade required
**Route** `app/upgrade-required`  -  **Endpoint** `GET /v1/bootstrap`  -  **Anonymous**

**A blocking screen with no other content.** What it needs: renders **in both locales**, **with no session**, and **nothing routes past it** -- not a deep link, not a push tap.

**Regions:** one sentence saying the app must be updated to continue  -  a control opening the store listing  -  **nothing else.** No dismiss, no "later", no navigation.

**Copy carries no price and no store account language.** A link to the app's own store listing is not a purchase link; a sentence about accounts or payment would be.

---

## 7. Group B -- Discovery

### MB-06 - Storefront
**Route** `app/s/[handle]`  -  **Endpoints** `GET /v1/storefronts/{handle}`, `GET /v1/storefronts/{handle}/products`  -  **Anonymous**  -  **Deep-link target**

**Regions:** header -- logo, store name, handle, **trust level and completed handoff count as page content, not a second call**  -  follow control  -  fulfilment note in the seller's own words  -  availability, with any closure note  -  search and filter row  -  product grid  -  reviews entry (MB-10).

> **The seller's display order is the default and the app never re-ranks.** Search and filters **narrow**; they do not sort by relevance, popularity or anything else. There is no sort control.

**Follow is available before purchase, from here and from every surface where a seller is identified.** An anonymous buyer who follows creates the intent; the follow resolves when identity is created.

**Images: thumbnail derivative in the grid.** Never `full` in a list -- ADU-MOB-01 S8.1 makes this the single largest data cost in the app, on the exact device class the product is built for.

**States:** `LOADING`, `READY`, `STALE`, `EMPTY` (**the seller has published nothing yet -- say so plainly and offer follow**), `NOT_FOUND`, `TRANSPORT_ERROR`.

### MB-07 - Product
**Route** `app/s/[handle]/p/[slug]`  -  **Endpoint** `GET /v1/storefronts/{handle}/products/{slug}`  -  **Anonymous**  -  **Deep-link target**

**The most-linked screen in the product.** Every bio link, every post link and every share lands here.

**Regions, in reading order:** media carousel with the video's poster frame  -  name and price  -  variant selector  -  **stock, with `confirmed_at`**  -  description  -  product-level attributes  -  seller strip with trust level and follow  -  fulfilment note  -  **Add to cart**  -  reviews summary  -  report control.

> **The screen is fully usable with the embed never tapped** (ADU-PRD-01 S7.4). The video is a poster frame Adulis stores itself; the embed loads on tap and only on tap. **No request reaches TikTok or Instagram until the buyer asks for one** -- a data-protection property the DPIA relies on and a performance property the low-end Android needs.

**Variant selection changes price and stock together.** Price lives on the variant; the product's price is a seed. A withdrawn variant is not selectable and says why.

**States:** `LOADING`, `READY`, `STALE`, `NOT_FOUND` (**unpublished or removed -- offer the storefront**), `TRANSPORT_ERROR`.

### MB-08 - Video embed
**Modal over MB-07**  -  **No Adulis endpoint**

**The only `WebView` in the app** (B8). Confined to the two embed origins; our own JavaScript never injected; third-party cookies off; **any navigation outside the whitelist opens the system browser** rather than loading in place; mounted on this screen only and unmounted on leave.

**Copy:** one line naming which platform the video is hosted on, **before** it loads, so the buyer knows the tap reaches a third party.

**States:** `LOADING`, `READY`, `TRANSPORT_ERROR` (**the embed failed -- the product screen is unaffected and says so**).

### MB-09 - Search within a seller
**Route** `app/s/[handle]/search`  -  **Endpoint** `GET /v1/storefronts/{handle}/search`  -  **Anonymous**

> **Scope is one seller, always.** No parameter exists that widens it and none may be added. **The screen names the seller in its own copy** -- *"Search Selam's store"* -- so the scope is legible rather than inferred, and a buyer never wonders why a product they saw elsewhere is missing.

**States:** `READY`, `SENDING`, `EMPTY` (**no match in this store -- offer the full product list, never another seller**), `TRANSPORT_ERROR`.

### MB-10 - Seller reviews
**Route** `app/s/[handle]/reviews`  -  **Endpoint** `GET /v1/storefronts/{handle}/reviews`  -  **Anonymous**

**Two ratings per review, always separate, never averaged into one number.** Each review carries its badge -- the evidence tier that produced it -- and its date.

**The badge is explained once on the screen, in plain terms**, because it is the product's differentiator and it is invisible if unexplained: a review from a scanned handoff carries more weight than one from a tapped confirmation.

**No seller control exists anywhere in this product** -- no reply, no dispute, no hide. The buyer's report control is present per review (MB-28).

**States:** `LOADING`, `EMPTY` (**explains the gate: reviews appear after a buyer completes a handoff, which is why there are few and why they mean something**), `READY`, `TRANSPORT_ERROR`.

---

## 8. Group C -- Cart and reserve

### MB-11 - Cart
**Route** `app/cart`  -  **Endpoints** `GET /v1/cart`, `POST`/`PATCH`/`DELETE /v1/cart/lines...`  -  **Anonymous** (keyed by device)

**Re-checks on every view.** Each line shows product, variant, quantity, price, **`available`** and **`available_checked_at`** (M5).

> **A cart is a draft and the interface has to say so.** The stamp is the sentence that says it. The app never silently alters a cart -- not a quantity, not a price, not a removal.

**One seller per cart, enforced by a composite foreign key.** Adding from a second seller returns 409 `CART_SELLER_CONFLICT`, and **the app offers to start a new cart, never to merge.** The copy names both sellers and says the current cart is kept until the buyer chooses.

**The cart survives sign-out** (B4) and binds to the account at first reserve.

**States:** `LOADING`, `EMPTY` (**what a cart is for, and the route back to the storefront the buyer came from**), `READY`, `STALE`, `CONFLICT`, `TRANSPORT_ERROR`.

### MB-12 - Review and reserve
**Route** `app/cart/reserve`  -  **Endpoint** `POST /v1/orders`  -  **Creates identity if none exists**

**The screen where an anonymous buyer becomes a buyer.** Regions: lines with final quantities and prices  -  fulfilment method and the seller's note  -  total  -  **[!] delivery fee -- see S19 Q6**  -  sign-in or account creation (MB-04 inline)  -  **the new-seller disclosure where it applies** (MB-14)  -  **Reserve**.

> **The idempotency key is minted when this screen mounts and is persisted** (B6). It is reused for every attempt and deleted when the order is created or the cart changes. **Same key with a different cart hash returns 409, which the app renders as "your cart changed -- review it"**, not as a failure.
>
> This is the single most consequential line of client code in the app. A fresh key on retry is a second order, a second stock decrement and a buyer charged twice by their own bank.

**Reserve is `SENDING` from tap to response, disabled throughout.** A double tap is one key and one order.

**States:** `READY`, `SENDING`, `CONFLICT` (-> MB-13), `VALIDATION`, `TRANSPORT_ERROR`.

### MB-13 - Reconciliation
**Presented over MB-12 on 409**  -  **No endpoint of its own**

> **Six per-line states, rendered from `items[]` verbatim, all six built:** sold out  -  insufficient quantity  -  price changed  -  no longer published  -  variant withdrawn  -  seller unavailable.
>
> **The system never silently alters a cart.** Every changed line is shown with what it was and what it is now, and the buyer chooses. **Render every item, never the first.**

**Also arrives here:** the transaction cap for a New-level seller. **The message names the limit and never the seller's level as a judgement** -- *"this seller can accept orders up to X"*, not *"this seller is new"*. That distinction is S4.3.

**States:** `CONFLICT` only. The screen exists to render one.

### MB-14 - New-seller disclosure
**Presented within MB-12**  -  **Emits `new_seller_disclosure_shown`**

> **RULING M7 -- a full-screen interstitial at the reservation step. Not a checkbox, not a banner, not a collapsed disclosure.**
>
> ADU-PRD-01 S5.3 requires it to be shown at the reservation step, **not dismissible by default and not buried.** A banner above a Reserve button is buried; a checkbox makes it a consent to click through. **A screen the buyer has to advance past is the only shape that satisfies the requirement.**

**It states two facts and nothing else:** this seller has **no completed handoff history on Adulis**, and **payment goes directly to the seller** -- Adulis does not hold, forward or refund it.

**It contains no adjective.** Not "risky", not "unproven", not "be careful". **A characterisation is forbidden** (S4.3), and the facts are stronger than an adjective would be.

**One control: continue.** Plus a route back to the cart. **No "don't show this again."**

---

## 9. Group D -- Orders and payment

### MB-15 - Orders
**Route** `app/(tabs)/orders`  -  **Endpoint** `GET /v1/orders`  -  **Session required**

**Each row:** seller  -  state  -  **the clock that matters in the current state, labelled by whose it is** (M12)  -  line count and total  -  one primary action where one exists.

**States:** `LOADING`, `EMPTY` (**what will appear here, and the route to the storefront -- with sign-in offered if the buyer is anonymous**), `READY`, `STALE`, `SIGNED_OUT`, `TRANSPORT_ERROR`.

### MB-16 - Order
**Route** `app/orders/[id]`  -  **Endpoints** `GET /v1/orders/{id}` and the state-specific actions  -  **Session required**

> **RULING M4 -- the order is one screen.** No payment tab, no wizard, no separate handoff page. **One card whose action region is driven by the server's `state` and `allowed_actions`.** A buyer at a doorway, or in a bank app, must not be navigating a hierarchy to find the one thing they can do now.

**Regions, in reading order:**

1. **State and clock** -- the resolved state, and **the governing deadline only where one is running, labelled by whose it is** (M12).
2. **Seller** -- name, trust level, a contact affordance routing to MB-31.
3. **Lines** -- product, variant, quantity, price, line state. Per-line **Cancel this item** where allowed.
4. **The action region** -- exactly one primary action for the current state.
5. **What happened** -- an append-only history in plain language, timestamped.

| State | The action region |
|---|---|
| `CREATED` / `NOTIFIED` | **View payment instructions** (MB-17) |
| Instructions seen | **I have paid -- send proof** (MB-18) |
| `PAYMENT_SUBMITTED` | **Nothing to do.** The seller is checking, and by when. **No action, and no countdown presented as the buyer's** |
| Payment rejected | The seller did not find the payment. **One more submission is allowed**, and the copy says so before the tap |
| `PAYMENT_CONFIRMED` | **[!] Blocked on Q5** -- what happens next needs the fulfilment window. **Until it is ruled the card states the fact and offers the seller contact**, and invents no number |
| Ready for handoff | **Scan to complete** (MB-21), with MB-23 one step further down |
| `HANDED_OFF` | **Leave a review** (MB-24) |
| Refund issued | **I received this refund** (MB-20) |
| `TERMINAL` | History only. No actions |

**The order is re-read on view and on foreground. Nothing polls** (ADU-MOB-01 S13). **Nothing is cached to disk** -- the card is the one thing in the product that must never lie, and a cached card is a card that can.

**States:** all except `EMPTY`.

### MB-17 - Payment instructions
**Route** `app/orders/[id]/pay`  -  **Endpoint** `GET /v1/orders/{id}/payment-instructions`  -  **Session required**

> **RULING M9 -- the single decryption path, held in memory for the life of the screen, and nowhere else.**
>
> `private, no-store`. **Never written to disk, never cached by Query, never included in a list view.** The read is logged server-side.

**Regions:** the bank or wallet, the account name, **the account number**, the exact amount, and the reference the seller expects  -  **an explicit copy control on each field**  -  one line saying the payment goes directly to the seller  -  **I have paid -- send proof** (MB-18).

**Nothing is placed on the clipboard automatically.** A copy happens on a tap the buyer made.

> **Screenshot blocking is considered and rejected, and the reasoning belongs on this screen.** The obvious instinct is `FLAG_SECURE`. It is wrong here: **the buyer needs the account number in their bank app**, and blocking the screenshot pushes them to copy a thirteen-digit number by hand -- which is how money reaches the wrong account. **The account number is not a secret from the buyer; it is the thing being disclosed to them.**

**States:** `LOADING`, `READY`, `NOT_FOUND` (the order is no longer payable), `TRANSPORT_ERROR`.

### MB-18 - Send proof of payment
**Route** `app/orders/[id]/evidence`  -  **Endpoint** `POST /v1/orders/{id}/payment-evidence`  -  **Session required**

**Regions:** pick from photos or take a photo  -  preview  -  one line saying what the seller will look for -- **the transaction reference must be readable**  -  send.

> **The image is downscaled on device before upload** (B10). `EVIDENCE_TOO_LARGE` is a client defect, not a message to a buyer who is trying to pay. **Legibility bounds the compression**: the evidence exists so a seller can read a reference, and the release gate is a human check on a real screenshot from a real low-end device.

**Progress is real.** On a slow device the control says it is preparing the image rather than appearing frozen.

> **A failed upload leaves the order exactly where it was.** The commit call is what advances the state, so a dropped upload is a retry and never a half-submitted payment. **The screen must say that**, because a buyer whose upload failed will otherwise assume they have paid twice or not at all.

**The buyer never sees payment evidence rendered back.** Not their own, not anyone's. There is no evidence viewer in Buyer Mode.

**States:** `READY`, `SENDING`, `VALIDATION` (`PAYLOAD_TOO_LARGE`, wrong type), `TRANSPORT_ERROR`.

### MB-19 - Cancel an item
**Sheet over MB-16**  -  **Endpoint** `POST /v1/orders/{id}/reservations/{rid}/cancel`

**Per line, never the whole order where lines remain.**

> **The penalty ladder is disclosed before the tap, not after.** The sheet states what this cancellation costs the buyer and what it does to the rest of the order, and the confirm control is the second tap.

**States:** `READY`, `SENDING`, `CONFLICT` (`ILLEGAL_TRANSITION` -- the line already moved), `TRANSPORT_ERROR`.

### MB-20 - Refund
**Section of MB-16**  -  **Endpoint** `POST /v1/orders/{id}/refunds/{rid}/acknowledge`

**An explicit buyer action, never inferred.** The screen states what the seller says was refunded and asks whether the buyer received it. **Acknowledging is not a rating and not a release** -- the copy must not imply the buyer is agreeing that the amount was correct, only that something arrived.

**Where nothing arrived, the route is a claim** (MB-26), named on this screen.

---

## 10. Group E -- Handoff

**This is the product.** Everything else on this surface exists so that this moment produces evidence.

### MB-21 - Scan
**Route** `app/scan`, entered from MB-16 only  -  **Endpoints** camera, then `POST /v1/handoffs/sync`  -  **Session required**

**Regions:** camera viewfinder with a target  -  the order it belongs to, named  -  one line: the seller shows you a code; scanning completes the order and lets you leave a review  -  **Complete without scanning**, one step further down (M6).

> **RULING M6 -- placement is the ruling.**
>
> **Scan is the screen. The tap is a text control below the viewfinder, plainly labelled the weaker record**, and it opens a confirmation (MB-23) rather than acting immediately.
>
> Only a scanned handoff counts toward trust level; a tapped confirmation publishes a review at medium weight and advances nothing. **An interface that offers *Scan* and *I received it* as equal buttons teaches the cheaper one -- and the cheaper one is the one a seller has an incentive to coach.** Scan completion rate is a release gate carrying double weight. **This is not friction for its own sake; it is the product's only differentiator being defended in the one place it can be lost.**

**The pipeline:** decode -> parse -> reject anything that is not a well-formed Adulis token (*"that is not an Adulis code"*, plainly) -> capture `{nonce, order_ref, signature}` from the token, stamp `signed_at` from the device clock, read the offset from memory -> **POST an array of one**.

> **RULING M1 -- the retry budget. Founder ratification owed; this is the proposal.**
>
> | Phase | Elapsed | What the buyer sees |
> |---|---|---|
> | Attempt 1 | 0 s | **Sending -- not yet recorded** |
> | Retries | 2 s, 5 s, 10 s, then every 15 s | The same, plus **Retry now** |
> | **The offer** | **20 s** | **Complete without scanning** is raised to a full control beside Retry, with one line: this records the handoff but does not count toward the seller's level |
> | Ceiling | 120 s | Retries stop. Manual **Retry now** remains for as long as the screen is open |
>
> **Three things this must never do.** It must never **navigate away on its own** -- a buyer at a doorway who looks up to find a different screen has lost the code. It must never **tap on the buyer's behalf** after a timeout. And it must never **show success before the server said so** (`SENDING`, then the outcome, never in between).
>
> **Twenty seconds is chosen against the doorway, not against the network.** It is long enough that an ordinary reconnection wins and the verified handoff is kept; it is short enough that the buyer is not standing in a stranger's compound watching a spinner. **The number is a product decision and it is the whole of what a buyer experiences here** -- ADU-VAL-01 D3's horizon must be at least this, and the two are ratified together.

> **If the buyer leaves the screen or the app is killed, the scan is gone.** Nothing is queued and nothing is written to disk (B25). **The screen says so before it is left** -- a single confirmation on back-navigation while `SENDING`, offering the tap instead.

**States:** `DEVICE_PERMISSION_NEEDED` (camera refused -- **what it is for and the route to Settings; the tap remains available**), `READY`, `SENDING`, `RETRYING`, `TRANSPORT_ERROR`.

**[!] Blocked on the QR payload ruling** -- D-156 records the encoding as interim (S19 Q11).

### MB-22 - Scan outcome
**Presented over MB-21**  -  **No endpoint**

**Rendered from the server's `outcome`, never predicted** (ADU-MOB-01 S9.3):

| `outcome` | The buyer sees |
|---|---|
| `VALID` | **Complete.** The review invitation, immediately |
| `LATE` | **Complete**, badged *confirmed by buyer* |
| `REJECTED_REPLAY` | **Nothing.** Rendered as complete -- *"a replay reaching the buyer as a rejection is the worst possible answer at a doorway"* |
| `REJECTED_HORIZON` | **Expired**, explained plainly. Rare, and if it is not rare the device clock is wrong |
| `REJECTED_SIGNATURE` | Nothing. Logged |
| `REJECTED_UNKNOWN_ORDER` | Nothing. Logged |
| Unrecognised | **The default branch** (S3.4). The order's state as the server named it, plus the route back to MB-16 |

**`replay: true` with a stored outcome is success, not rejection.**

> **INVARIANT -- the app never tells the buyer whether a scan counted toward the seller's level.** `counts_toward_level` is a server determination against a grace window the client cannot see, and a client that guessed would be wrong in public.

### MB-23 - Complete without scanning
**Sheet over MB-16 or MB-21**  -  **Endpoint** `POST /v1/orders/{id}/confirm-receipt`

**Two-step, and the copy carries the difference.** *"This records that you received the order. It does not count toward the seller's level -- only a scan does."* **Neutral, not discouraging**: a buyer whose seller has no code, or who is somewhere with no signal, is doing the honest thing and must not be made to feel they are cheating.

**States:** `READY`, `SENDING`, `CONFLICT`, `TRANSPORT_ERROR`.

---

## 11. Group F -- After the handoff

### MB-24 - Leave a review
**Route** `app/orders/[id]/review`  -  **Endpoint** `POST /v1/orders/{id}/review`

**Two ratings, always separate and never combined into one:** the item, and the handoff. Free text optional.

**One review per order, and a terminal state is required.** **It always publishes.** The screen says so before submission -- *"the seller cannot hide, reply to or remove this"* -- because that is the guarantee the product is built on and the buyer should know it before they write.

**The badge is shown, not chosen.** The buyer does not select their evidence tier; the server assigns it from how the order completed.

**States:** `READY`, `SENDING`, `CONFLICT` (already reviewed), `TRANSPORT_ERROR`.

### MB-25 - Claims  -  MB-26 - Claim
**Route** `app/claims`, `app/claims/[id]`  -  **Endpoints** `GET`/`POST /v1/claims`

**Claim detail regions:** what happened and when  -  the evidence attached at claim time, **read-only**  -  the remedy options available in the current state  -  the deadline  -  history.

**A claim opened by `SYSTEM` reads as a statement of fact, not an accusation.** **One open claim per scope** -- a second trigger appends evidence rather than opening a second claim, and the screen shows one claim gaining evidence rather than a list that grows.

**States:** `LOADING`, `EMPTY` (**an empty claims list is good news and reads that way. No action offered**), `READY`, `TERMINAL`, `TRANSPORT_ERROR`.

### MB-27 - Claim evidence
**Route** `app/claims/[id]/evidence`  -  **Endpoints** `POST /v1/claims/{id}/evidence`, `/evidence-export`

> **RULING M8 -- the screen states the single-transaction rule in its own copy, and names what a statement would reveal.**
>
> ADU-DPIA-01 S6 calls the single-transaction rule *"the single best minimisation decision in the design"* and requires it to be **stated in the claim interface, not buried in terms.**
>
> The copy, in substance: *upload the record of this one payment. Do not upload a full bank statement -- it would show your balance, your salary and everyone else you have paid, and none of that is needed to prove this transaction.*
>
> **A buyer who uploads a statement has over-disclosed to a seller and to us, and this interface is the only place that can prevent it.**

**The evidence export** returns the buyer's own order, chats and payment records and **carries nothing about who the seller is.** The screen says what the export contains before it is requested.

### MB-28 - Report  -  MB-29 - Block
**Sheets, reachable from every piece of user content**  -  **Endpoint** `POST /v1/reports`

> **A report control exists on every piece of user content**: product, storefront, review, message, seller. **The release gate is walking the list**, not trusting the claim.

`subject_kind` is the enum's spelling, not this document's (D-44). **Block is store-mandated alongside report** (ADU-PRD-01 S18) and is a separate control with its own confirmation, because blocking a seller ends a channel the buyer may have an open order in -- **and the sheet says so where one exists.**

**States:** `READY`, `SENDING`, `TRANSPORT_ERROR`.

---

## 12. Group G -- Chat

### MB-30 - Conversations
**Route** `app/(tabs)/inbox`  -  **Endpoint** `GET /v1/conversations?as=buyer`

> **`as` has no default.** Absent returns 400 `SCOPE_PARAMETER_REQUIRED`. **One account holds both roles, and an unscoped list would interleave a seller's own business with their shopping.** CI greps for the parameter's presence on every conversation and notification request.

**Rows:** seller, last message preview, unread marker, the linked order or product where one exists.

**No polling.** Re-reads on view and on foreground.

**States:** `LOADING`, `EMPTY` (**explains that a conversation starts from a product or an order -- with the route to Home**), `READY`, `STALE`, `SIGNED_OUT`, `TRANSPORT_ERROR`.

### MB-31 - Conversation
**Route** `app/inbox/[id]`  -  **Endpoints** `GET`/`POST /v1/conversations/{id}/messages`, `POST .../escalate`

**Anchored on exactly one of a product or an order** (G1.10). **The app never starts an unanchored conversation** -- without an anchor the assistant escalates instead of answering, and containment then measures the missing anchor rather than the assistant.

**Bot replies are rendered from `template_key` + `slots`, never as assembled prose**, and **are visibly marked as automatic.** A buyer must be able to tell whether a person answered.

**Chips carry the load in Amharic, deliberately.** Free-text Amharic understanding is deferred, and *"a bot that misunderstands Amharic and answers confidently is worse than one that offers buttons."*

**Escalate to the seller is free, always available, and never hidden behind a failed bot exchange.**

**States:** `LOADING`, `READY`, `SENDING`, `STALE`, `TRANSPORT_ERROR`.

---

## 13. Group H -- Account

### MB-32 - Account
**Route** `app/(tabs)/account`  -  **Anonymous or session**

**Anonymous:** sign in  -  language  -  about  -  help. **Nothing else, and no account-shaped shell suggesting there is a profile behind it.**

**Signed in:** the phone number, masked  -  Following (MB-35)  -  Notifications (MB-33)  -  Devices and sessions (MB-36)  -  Language (MB-38)  -  About (MB-39)  -  **Sign out**  -  **Delete my account** (MB-37).

> **RULING M11 -- sign out and delete are different words, different screens, and not adjacent.** They are separated by at least one other item, styled differently, and **delete never sits directly below sign out**, which is where a mis-tap lands. **Sign out is one tap with a confirmation; delete is MB-37 and re-verifies the phone number.**

**Sign out clears the token and nothing else** (B4) -- the device id, the cart and the order idempotency key survive. **The confirmation says the cart is kept.**

### MB-33 - Notifications
**Route** `app/notifications`  -  **Endpoints** `GET /v1/notifications?as=buyer`, `.../read`, `read-all`

Chronological, unread marked, each deep-linking to its object. **Read state syncs across surfaces.** Re-reads on view; nothing polls.

**States:** `LOADING`, `EMPTY` (**what will appear here; no action**), `READY`, `SIGNED_OUT`, `TRANSPORT_ERROR`.

### MB-34 - Notification primer
**Presented once, immediately after the first reservation**  -  **`PATCH /v1/devices/{id}` + `POST /v1/events`**

> **INVARIANT -- permission is requested after the first reservation, never at first launch** (ADU-PRD-01 S9.3). A permission asked at launch is asked before the buyer has any reason to say yes, and **both platforms give one chance.**

**The reason is on the screen:** the seller is holding your order for 48 hours, and we will tell you when they confirm your payment. **One sentence, then the OS prompt.**

**The result -- granted, denied, not asked -- goes to the device row and emits `notification_permission_result`.**

> **[!] The app emits nothing until ADU-API-01's client-event allow-list is reconciled.** S11 and S12.16 name four events across two sections that each call themselves a closed list of two (ADU-MOB-01 F3). S19.

> **The denied path is a requirement, not a fallback.** Where permission is refused, **the order card carries a persistent badge and a countdown with the same information the notification would have carried** (ADU-PRD-01 S9.3). Android 13 and later let buyers refuse notifications, and *"a refused permission must not mean a lost order."*

### MB-35 - Following
**Route** `app/account/following`  -  **Endpoints** `GET /v1/follows`, `PATCH /v1/follows/{handle}/preferences`

The followed sellers, each with an unfollow and per-seller notification preferences. **One canonical follow state regardless of which surface created it.**

**States:** `LOADING`, `EMPTY` (**this is Home's Life 1 restated -- the two recovery paths, again**), `READY`, `TRANSPORT_ERROR`.

### MB-36 - Devices and sessions
**Route** `app/account/sessions`  -  **Endpoints** `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/{id}`

Active sessions with label, last used and approximate location. **Individual revoke only.**

> **`revoke-others` is `CONSOLE`-only (D-34) and the app renders no control for it.** Not a disabled one, not an explained one. **It does not exist on this surface.**

**The current session is always listed and is not revocable from here** -- signing out is MB-32.

### MB-37 - Delete my account
**Route** `app/account/delete`  -  **Endpoints** `/v1/deletion/otp/request`, `/otp/verify`, `GET /v1/deletion/preview`, `POST /v1/deletion/confirm`

> **Required in the app by ADU-PRD-01 S23 and by Apple before submission** (B23). **The app drives the anonymous flow and re-verifies the phone number by OTP even though a session is present.** A session must never mint a deletion ticket: **a phone left unlocked in a shop should not be two taps from deleting an account. The friction is the feature.**

**The order is the web page's, and it is not negotiable: explain, then phone, then code, then confirm.** *"A person should know what they are requesting before identifying themselves."* The explanation comes from `GET /v1/deletion/preview` so it cannot drift from what deletion does.

**Blockers arrive as `items[]`. Every one is rendered, and every one names its clearing action** -- an open order, an unresolved claim, a pending refund. **Never the first blocker only.**

**States:** `READY`, `SENDING`, `CONFLICT` (blocked -- the full list), `VALIDATION`, `TRANSPORT_ERROR`.

### MB-38 - Language
**Route** `app/account/language`

English and Amharic. **The switcher is hidden until human translation passes the release gate** (`AM_ENABLED`) -- machine output satisfies the compiler, not the gate.

### MB-39 - About Adulis
**Route** `app/account/about`  -  **[!] the highest copy risk in the app**

Version and build  -  privacy  -  terms  -  contact  -  the licences screen the platforms expect.

> **[!] This is where the In-App Purchase rule leaks.** Not from a pricing screen nobody would build -- **from a help screen written by someone reasonably describing the business.** A sentence explaining that sellers subscribe, a link to the marketing site's pricing page, a "become a seller" invitation: each is natural, each is a rejection.
>
> **The rule: this screen describes what Adulis does for buyers, and says nothing about what it costs sellers.** No price, no tier name, no *upgrade*, no billing link, no seller-recruitment call to action (B19). **The web link, where one exists, goes to the privacy and terms pages and not to the site root.**

---

## 14. Cross-cutting behaviour

### 14.1 What happens on 401, anywhere

**The screen becomes its anonymous equivalent and offers sign-in.** Never a modal the buyer cannot escape, never a bounce to Home that loses their place, never a silent failure. **The device id, the cart and the order idempotency key survive** (B4).

### 14.2 What happens when the network is gone

**There is no offline mode** (B25). Every screen that needs the network shows `TRANSPORT_ERROR` with a retry and the request id where one exists. **No screen shows stale content as though it were current**, and no screen shows a cached authenticated response, because none is kept.

**The one screen with a designed network-failure behaviour is MB-21**, and M1 is that design.

### 14.3 What happens on a cold start

Bootstrap first, and **nothing renders past MB-00 until it resolves or fails visibly.** Then: the version floor, the clock offset, the locale, the market. **A push token refresh and a `PATCH /v1/devices/{id}` happen on every cold start**, not only at first grant -- a rotated token nobody learns about is a device that silently stops receiving the new-device sign-in warning.

### 14.4 Interruption is the normal case

The buyer switches to their bank app mid-payment, takes a call at a doorway, and loses signal in a compound. **Every screen returns to where it was.** The order screen re-reads on foreground; MB-21 keeps retrying while it is open; MB-12's key is persisted precisely because this is ordinary rather than exceptional.

---

## 15. Empty states

**Each states what will appear, why it is worth having, and one action -- or says explicitly why no action is offered.**

| Screen | Appears when | Action offered |
|---|---|---|
| MB-01 Home | **Not an empty state.** Life 1 is a designed screen (M3) | Paste a post link  -  Find a seller |
| MB-03 Find a seller | No match | **None.** Explains that the handle is the seller's own and where they publish it |
| MB-06 Storefront | The seller has published nothing yet | Follow this seller |
| MB-09 Search | No match in this store | See all products **in this store** |
| MB-10 Reviews | After a buyer completes a handoff | **None.** Explains the gate -- which is also the honest explanation of why reviews here are scarce and trustworthy |
| MB-11 Cart | Items you are about to reserve | Back to the storefront you came from |
| MB-15 Orders | Orders you have reserved | Find a seller  -  **plus sign-in if anonymous** |
| MB-25 Claims | If something goes wrong with an order | **None. An empty claims list is good news and reads that way** |
| MB-30 Chat | Questions you ask a seller | **None.** Explains that a conversation starts from a product or an order |
| MB-33 Notifications | Updates about your orders | **None** |
| MB-35 Following | Sellers you follow | Paste a post link  -  Find a seller |

**Three empty states offer no action, deliberately.** Reviews, claims and chat cannot be caused by the buyer from that screen, and an action there would either be a lie or an invitation to file something that is not needed.

---

## 16. Localisation and layout

- **Every string is a catalogue key.** A missing Amharic key is a **compile error**, not a runtime fallback.
- **Whole sentences with named slots.** No fragment assembly (S4.5).
- **40% text expansion assumed in every container. No fixed heights. No truncated button labels.** Amharic runs longer, and the eight longest sentences in the buyer app are the new-seller disclosure, the claim-evidence rule and the deletion explanation -- **all three are the ones a designer will be tempted to fit into a fixed card.**
- **`allowFontScaling` is honoured and every screen is checked at the largest OS text size.** A buyer on a cheap phone with large text is a real and common user, and **a clipped payment instruction is a wrong bank transfer.**
- **No component sets an Ethiopic-only font family.** React Native has no `unicode-range`; the default text style is the Latin family and the platform's per-character fallback supplies Ge'ez (B16). **The guarantee is a device-measured release gate** -- the wordmark, both platform names and at least one figure rendering as characters, in both locales.
- **Numbers stay Latin-digit. Dates and money go through `Intl`** against the market timezone from bootstrap.
- **Test with realistic Amharic, not lorem ipsum**: long store names, long product names, and the three long disclosures above.

---

## 17. Accessibility baseline

Semantic accessibility roles on every control  -  full screen-reader operation with meaningful labels, **including the scan viewfinder and its state**  -  **44x44pt minimum targets**  -  **no state conveyed by colour alone** -- every state badge carries text, which matters most on the order card and on the scan outcome  -  submit controls stay enabled so validation can be triggered and explained  -  **async outcomes announced**, which matters most on MB-21 and MB-18  -  reduced motion respected  -  **the camera screen has a non-camera path** (MB-23), which is an accessibility requirement as well as a coverage one.

---

## 18. What is not in the app

**A screen that seems to need one of these is wrong, and the fix is upstream of the screen.**

No cross-seller search, browse, feed or recommendation  -  no ranking, sorting or personalisation control of any kind  -  no price, tier name, upgrade prompt, purchase flow or billing link  -  no seller-recruitment call to action  -  no assertion that a payment is genuine  -  no characterisation of a seller in either direction  -  no locally computed expiry, level, entitlement or eligibility  -  no locally scheduled notification  -  no queued, deferred or background write  -  no persisted API response  -  no evidence viewer  -  no review moderation, reply or dispute  -  no `revoke-others` control  -  no step-up challenge  -  no seller, courier or operator capability  -  no third-party SDK  -  no in-app browser for anything transactional.

---

## 19. What this document is blocked on

**Five screens cannot be finished today. Three of the five are blocked on a decision rather than on work.**

| # | Item | Blocks | Note |
|---|---|---|---|
| **N1** | **The OTP verify body** -- ADU-AUTH-01 v2.8 S5.2 and ADU-API-01 v1.11 S5 disagree | **MB-04** | It decides whether the screen keeps a `challenge_id` between two steps. **Build against AUTH v2.8**; the contract owes the correction (ADU-MOB-01 F3's sibling, recorded in ADU-MOB-00 S10 N1) |
| **Q5** | **The fulfilment window length** (ADU-VAL-01 3.2) | **MB-16's `PAYMENT_CONFIRMED` copy** | The card has to say what happens next and the answer is a number nobody has chosen. **Until it exists the card states the fact and invents nothing** |
| **Q6** | **The delivery fee** (ADU-VAL-01 3.8) | **MB-12's total** | `seller_fulfilment_method` carries no fee column, so either ruling is a migration **and a change to the one screen where a buyer commits money** |
| **Q11** | **The QR payload encoding** -- D-156 records it as interim | **MB-21** | **Both halves of a scan contract have to agree on bytes.** The console's half already ships, so the cheap answer is to ratify what D-156 built |
| **F3** | **The client-event allow-list** -- four names across two sections that each call themselves a closed list of two | **MB-14, MB-34** | The app emits nothing until it is reconciled, which means two events this document specifies are built and silent |
| **M1** | **The retry budget** proposed above | **MB-21's copy and ADU-VAL-01 D3** | **This document proposes twenty seconds and asks for ratification.** It is a product decision, not an engineering one |

**Everything else in this document can be built against the contract as it stands today**, which is the advantage of writing a client after the back end is finished.

---

## 20. What ADU-MOB-03 and ADU-MOB-04 take from here

**ADU-MOB-03** -- the design system and component inventory -- takes the **regions** and turns them into components. The list it must cover, derived from this document rather than invented: product card (three densities)  -  order card with its state-driven action region  -  the line item with its freshness stamp  -  the state badge  -  the countdown, in its two labelled forms  -  the disclosure interstitial  -  the empty state  -  the skeleton  -  the sheet  -  the scan viewfinder and its four states  -  the rating pair  -  the chip row  -  the copy-to-clipboard field.

**ADU-MOB-04** -- the wireframe generation brief -- takes the **screens** mechanically. Every `MB-nn` above becomes a brief with its regions in reading order, its states enumerated, and its invariant copy quoted verbatim. **A wireframe that draws a state this document does not list, or omits one it does, is wrong against this document and not against taste** -- which is the whole reason the states are enumerated per screen.

> **The console learned this the expensive way.** Two rounds of wireframes against ADU-CON-03 v1.0 found two defects in the document itself: a region drawn without its precondition, and *"per-category toggles"* for categories no document had ever enumerated. **Both were found by drawing the screens, which is what drawing them was for.** Expect this document to have the same class of defect, and expect ADU-MOB-04 to be where it surfaces.

---

*Binding content architecture, v1.0. Forty buyer screens, one navigation model, fourteen states and a closed set of verbatim labels for the moments that decide whether evidence exists. Twelve rulings land here; the one that matters most is the smallest -- **twenty seconds of visible retry at a doorway before the app offers the weaker record**, which is the entire user experience of the feature the product is built around, and which no document had ruled on until this one. Two rules sit underneath everything else: **the app renders business state and computes none of it**, and **the scan is never a peer of the tap on any screen where a scan is still possible**. Five screens are blocked, three of them on decisions rather than on work, and each is named with what it blocks rather than left to be discovered by whoever draws it. **ADU-MOB-03, the design system and component inventory, is next.***
