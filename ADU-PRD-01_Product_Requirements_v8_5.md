# ADU-PRD-01 — Adulis Product Requirements

**Version:** 8.5 · **Baseline date:** 23 August 2026
**Owner:** Founder / COO-CTO
**Status:** Binding product specification. The system design is drawn from this document.
**Supersedes:** ADU-PRD-01 v8.4
**Related:** ADU-00 v9.0 · ADU-PROJ-01 v9.0 · ADU-WEB-01

> **Naming.** The company is **Adulis**. The rename to the ADU series completed at v8.4; v8.5 completes it in the body text. Where older documents say Adulis, they mean Adulis.

> Where this document and any other Adulis document disagree, this one governs product behaviour. Where a rule is marked **INVARIANT**, it must be enforced by a database constraint or a server-side check, never by UI alone.

---

## 1. What changed in v8.5

v8.5 resolves four gaps that were being carried informally, and completes the rename in body text. **No behaviour changed that was previously specified** — each item below either states a rule that was already true in practice, or removes an ambiguity that had already produced a defect.

| Area | Gap | Resolution | Section |
|---|---|---|---|
| **Web seller console** | The §3 capability matrix marked seller setup, team management and data export as available on web with no phase qualifier. Read as V1 scope, it contradicts a mobile-only MVP with no web sign-in. | §3 restructured into MVP, pre-paid-launch and post-MVP tiers. Web is anonymous browse at MVP. | §3 |
| **The bio link** | Nothing stated that neither platform permits a per-post outbound link. §21.1 read "that storefront **or product**", which is how "share a link to the exact product in your post" reached a wireframe set. | §21.0 — new invariant. One profile link in the bio; no per-post product link exists. | §21.0, §21.1 |
| **Beta entitlements** | §16.1 gives the $0 Listed tier no chatbot. §16.7 says beta sellers pay nothing. Nothing said what beta sellers actually get, and the public website already tells sellers what the chatbot costs afterwards. | §16.10 — beta sellers sit outside the tier table and receive the chatbot, because the intent library cannot improve without their escalation data. | §16.10 |
| **Font stack** | §23.1 required Ge'ez validation but said nothing about font family composition. An Ethiopic-only family has no Latin or numeral glyphs. | §23.1 — new invariant. Latin family first, Ethiopic as fallback. | §23.1 |
| Naming | v8.4 renamed the identifier; the body still said Adulis in 24 places | Completed | throughout |

**On the font stack.** This one is worth stating plainly because it already cost a wireframe round. A font family covering only Ge'ez renders every Latin character and every digit as a missing-glyph box. On an Amharic page that means the company name, both platform names and every published figure — completed handoff counts, stock timestamps, prices — become invisible. It is not a polish issue; it makes the page unreadable in a way that a reviewer who does not read Amharic will not notice.

---

## 1A. What changed in v8.4

Retained for history. v8.4 removes a mechanism that no longer fits, and records two decisions that were being carried informally.

| Area | Change | Section |
|---|---|---|
| Web-to-app handoff | **Short codes are removed entirely.** Replaced by platform deep links, a social post-link paste, and seller handle lookup. | §21 |
| Storefront search | Extended to resolve a social post link to that seller's tagged products, and to find a seller by handle | §7.5, §7.6 |
| Deferred follow | Depended on short codes; rewritten | §17.1.1 |
| Follower threshold | **Not enforced during the controlled beta.** The correct number is an open question the beta exists to answer. | §4.1 |
| Subscription purchase | No purchase surface exists at MVP because beta sellers are free. A web console is required before paid launch. | §16.7 |

**One consequence to hold onto.** Removing short codes means a buyer who browses on the web, installs the app, and had no deep link now arrives at a generic home screen. Seller handle lookup (§7.6) is the recovery path, and it is not optional — without it, that buyer is lost.

---

## 1B. What changed in v8.3

v8.3 resolves a contradiction between this document and the content architecture, and specifies five areas that the content architecture covered but the binding specification did not.

| Area | Gap | Resolution |
|---|---|---|
| Following | **§17.1 said following begins after a completed reservation. The content architecture says following is available from the storefront and product page. These conflicted, and this document governs.** | §17.1 rewritten — following is available before purchase, with deferred anonymous follow |
| Following feed | The decided V1 surface was not specified anywhere | §17.3 |
| Storefront search | Not mentioned. Nothing prevented it being built as cross-seller discovery. | §7.5 — scope is one seller, always |
| Publication readiness | Conditions were scattered across four sections; nothing required the seller be able to see what blocks them | §4.6 |
| Seller deletion | One line in a table. No rule that unresolved obligations block it. | §16.9 |
| Courier custody | The two custody events were one line. Nothing stopped the pickup scan being built as trust-advancing, which would make the ladder fakeable with one cooperative courier. | §11.2 — two distinct events, only one counts |
| Product media | Image and video rules were undefined after the hosting-cost analysis | §7.4 |

---

## 1C. What changed in v8.2

v8.2 closes an unaddressed attack surface and specifies the authentication mechanism that v8.1 left open.

| Area | Gap | Resolution |
|---|---|---|
| Payout details | A seller's bank account could be changed with nothing more than session access. Every subsequent buyer would pay the attacker, using instructions Adulis itself displays. Adulis never touches the money, so nothing downstream would catch it. | §10.4 — step-up authentication, activation delay, notification, immutable history, RBAC restriction |
| Orders in flight | A payout change silently rerouted payment for orders already placed | §8.5 — payout details are captured onto the order, exactly like price |
| Authentication | Seller credential mechanism was undecided, blocking a dozen screens | §6.2 — phone OTP, same as buyers, with stricter recovery |
| Team and courier access | Two actor types with credentials and sessions had no specified authentication | §6.3 |
| Sessions | No expiry, device management or revocation rules | §6.4 |
| Recovery | Account recovery could be immediately followed by a payout change — the complete attack | §6.6 — payout changes are locked for a cooling period after any recovery |

---

## 1D. What changed in v8.1

v8.1 closes gaps found while reviewing the content architecture ahead of wireframing. No strategic change; these are rules that were implicit, contradictory or absent and that a designer or engineer would otherwise have had to invent.

| Area | Gap | Resolution |
|---|---|---|
| Handoff | An offline scan syncing after expiry had no defined outcome | §11.4 — the signed scan timestamp governs, with compensating stock reconciliation |
| Expiry | Unclear whether the 48-hour clock expires a paid order | §9.2 — the clock stops at `PAYMENT_CONFIRMED` |
| Cart | Cart implied a stock hold; it does not | §8.2 — cart holds nothing; revalidation at order creation |
| Price | Nothing stopped a seller's price change affecting a live order | §8.4 — price is captured on the order and is immutable |
| Partial fulfilment | Not addressed at all | §9.4 — per-line cancellation and per-line refund |
| Suspension | No rule for active orders when a seller is suspended | §16.8 — billing and safety suspension behave differently |
| Payment evidence | Seller access to screenshots was not logged | §10.3 — every access is logged regardless of actor |
| Localisation | Layouts assumed Latin script | §23.1 — Ge'ez validation is a launch requirement |
| Notifications | The two buyer notifications had no specified copy | §17.3 — full copy matrix, both languages |
| Empty states | Undefined everywhere | §24 — required for every list surface |

---

### 1.1 What changed in v8.0 — retained for history

| Area | v7.0 | v8.0 |
|---|---|---|
| Follower requirement | Permanent | **Years 1–2 only; dropped in Phase 2** |
| Phase 2 eligibility | — | **Anyone, with no social account required** |
| Trust mechanism | Verification badge + reviews | **Trust ladder earned through scanned handoffs** |
| ID verification | Paid premium (blue tick) | **Mandatory for sellers with no verified audience** |
| V3 discovery | Roadmap item | **Hard prerequisite for Phase 2** |
| Verification cost driver | Pro conversions | **Total signups, from Phase 2** |

**Phase 2 must not be enabled until V3 discovery is live, a KYC vendor is integrated at signup volume, and the trust ladder is operating.** These are build dependencies, not policy preferences.

---

## 2. Scope

**V1 scope:** seller eligibility and verification · seller entity types · trust ladder data model and level computation · ordered catalogue with structured attributes · social embeds · web storefront (browse only) · buyer app (iOS and Android) · seller console (web and Android) · team access and RBAC · cart and orders · reservations with stock holds · QR handoff confirmation · buyer–seller chat · chatbot cascade · reviews with evidence tiers · claims · stock management and confidence scoring · subscription tiers, trial and entitlements · payment screenshot relay · narrow courier role · analytics and export · moderation · admin.

**The trust ladder ships in V1 even though the gate does not drop until Phase 2.** Levels must accumulate from the first handoff, or every seller arrives at Phase 2 with no history and the ladder means nothing on the day it starts mattering.

**Out of scope for V1:** marketplace discovery and ranking (V3) · advertising · Crowd Commerce · Group Buying · Adulis delivery service · courier job marketplace · funds custody · buyer payment gateway · Amharic free-text understanding.

---

## 3. Clients

| Capability | Web | iOS app | Android app |
|---|---|---|---|
| Browse storefront and products | Yes | Yes | Yes |
| See stock, price, variants, delivery zones, payment methods | Yes | Yes | Yes |
| Chatbot conversation | **No** | Yes | Yes |
| Buyer account | No | Yes | Yes |
| Cart and reserve | **No** | Yes | Yes |
| Buyer–seller chat | No | Yes | Yes |
| QR handoff scan | No | Yes | Yes |
| Reviews and claims | No | Yes | Yes |
| Seller shop setup and operations | **Post-MVP** | **No** | Yes |
| Team management and RBAC | **Post-MVP** | **No** | Limited |
| Data export | **Post-MVP** | **No** | No |
| Subscription purchase | **Web only, before paid launch** | No | No |
| Courier handoff scan | No | No | Yes |

**INVARIANT — the iOS app contains no seller functionality and no reference to subscription pricing.**

**INVARIANT — subscription purchase never happens inside either app.** No prices, no purchase flow, no link to purchase. This is what keeps the apps outside Apple's In-App Purchase and Google Play Billing requirements, both of which would take 15–30% in card rails incompatible with manual ETB bank transfer.

### 3.0 The web tier arrives in three steps

The **Post-MVP** entries above are not a hedge. The web surface is built in three distinct stages, and building a later one early is a scope error, not an optimisation.

**Step 1 — MVP. The public web is anonymous.**

**INVARIANT — there is no web sign-in at MVP.** No account, no session, no seller console, no cart, no reservation, no chat, no review. Every seller operation happens in the Android app; every buyer action happens in either app. The web tier is the public site and the seller storefronts, and its entire job is to prove value and drive an install.

**One authenticated exception exists**, and it is deliberately narrow: the account-deletion path required by both app stores. **INVARIANT — the deletion path proves identity by phone OTP for that request alone. It issues no session, grants access to no other surface, and its copy must state that it is not a sign-in.** Specified in ADU-WEB-01; obligations that block deletion are in §16.9.

**Step 2 — before paid launch. A narrow purchase surface.**

Roughly six screens: the seller signs in, sees their plan and term, receives bank transfer instructions, and marks the transfer made (§16.7). Nothing else.

**INVARIANT — the purchase surface is never reachable from inside either app.** Not a link, not a WebView, not an "upgrade" prompt. A seller finds it by going to the website themselves.

**Step 3 — post-MVP. The full seller console.**

Shop setup and operations, team management and RBAC, data export. **When it ships it is the primary surface for business sellers**, because shops operate from desks with several staff. Until then those capabilities exist on Android only, and Business tier is sold on that basis.

**At MVP there is no purchase surface at all**, because controlled-beta sellers are free (§16.7, §16.10).

### 3.1 Web view responsibility

The web storefront must answer, as page content, every question the chatbot would answer from structured data, **including the seller's trust level and completed handoff count**. The install prompt appears at the reserve action, never on arrival.

---

## 4. Seller eligibility

### 4.1 Two phases, driven by configuration

**INVARIANT — eligibility is evaluated by a rules service reading per-market configuration.** Threshold, counting platforms, permitted seller types and whether an audience is required at all are versioned configuration records. **Phase 2 must not require a code change.**

| Setting | Phase 1 | Phase 2 |
|---|---|---|
| Audience required | Yes | **No** |
| Minimum followers | **Not enforced during beta** — see below | n/a |
| Counting platforms | TikTok, Instagram | n/a |
| Threshold basis | Highest single platform, never the sum | n/a |
| Permitted seller types | Individual, Company | Individual, Company |
| ID verification | Optional (blue tick) | **Mandatory without a verified audience** |

**The threshold is an open question, not a setting with a known value.**

During the controlled beta no follower minimum is enforced. Every applicant is accepted onto the waitlist and reviewed. The purpose is to find out what audience size actually predicts a seller who succeeds — a question no amount of reasoning answers.

**INVARIANT — the threshold remains a per-market configuration record with a null-permitted value.** Setting it later must not require a code change.

Follower count is still captured at verification for every seller, whatever it is. That data is the input to the decision.

**Threshold basis, once a threshold exists, is a decision, not an assumption.** A seller with 3,000 on TikTok and 3,000 on Instagram is very likely the same audience counted twice. Take the highest single connected account.

### 4.2 Two verification paths

From Phase 2, a seller qualifies to publish by satisfying **either**:

| Path | Requirement | Identity anchor |
|---|---|---|
| **Audience** | Account-control verification on a platform meeting the market threshold | The social account |
| **Identity** | Government ID verification through the KYC vendor | The person |

**INVARIANT — a seller must satisfy at least one path before publishing any product.** They may draft; nothing is publicly visible.

**INVARIANT — a seller taking the identity path holds a full ID attestation before their first listing goes live.** There is no grace period. The identity path is the only thing standing between the platform and an anonymous seller taking bank transfers.

Follower count is recorded at verification with a timestamp. **Eligibility is not re-evaluated retroactively.**

### 4.3 Seller entity types

| Field | Individual | Company |
|---|---|---|
| Legal name | Person's name | Registered business name |
| Registration identifier | — | Trade licence number, TIN |
| ID verification subject | The person | An authorised individual acting for the company |
| VAT invoice required | Usually no | **Often yes — confirm with accountant** |

**INVARIANT — ID verification always attests to a natural person**, regardless of seller entity type.

### 4.4 Multiple accounts

A person or company may hold several seller accounts, one per business.

**INVARIANT — the keyed ID hash is stored once per person and referenced by each seller account**, so one verified individual is not re-verified per business and duplicate-identity detection works across accounts.

**This becomes load-bearing in Phase 2.** It is the mechanism that stops a suspended seller from immediately reappearing under a new account.

### 4.5 The ambassador rule

Someone acting as a brand ambassador may not open an account on that brand's behalf. **Not system-enforceable.** Terms of service with a report-and-takedown path. Do not build a control for it.

### 4.6 Publication readiness

Whether a seller may publish depends on conditions spread across this document: eligibility (§4.2), identity verification where required (§4.2), trust-level product caps (§5.1), tier limits (§7.3), and operational setup — store profile, payout details, active hours, fulfilment.

**INVARIANT — publication readiness is computed server-side as a single resolved state, not inferred by the client from separate checks.**

**INVARIANT — a seller can see, at any time, the complete list of what is preventing publication, in plain language, with the action that resolves each item.**

This is not a convenience. Seller onboarding is a multi-step process a seller will leave and return to across days, on a phone, between other work. A seller who cannot tell why their store is not live abandons setup, and abandoned setup is indistinguishable in the funnel from a seller who never wanted the product — so it is also a measurement problem.

The readiness state is persistent and returnable, not a wizard that must be completed in one pass. Its items:

| Item | Required |
|---|---|
| Account created | Always |
| Seller type declared | Always |
| Eligibility satisfied — audience or identity path | Always |
| Identity verification | Where the market configuration requires it |
| Company details and representative verification | Company sellers only |
| Store profile — name, description, category | Always |
| Payout details | Always |
| Active hours, minimum 8 hours per day | Always |
| Fulfilment configuration | Always |
| At least one product created | Always |

**INVARIANT — publication readiness emits `seller_publication_blocked` with the blocking reasons whenever it is evaluated and fails.** Which step sellers abandon at is the single most useful onboarding metric, and it cannot be reconstructed later.


---

## 5. The trust ladder

### 5.1 Levels

**INVARIANT — a seller's level is computed from completed, scanned handoffs and published reliability statistics. It is never set manually, never purchasable, and never affected by subscription tier or advertising spend.**

| Level | Earned by | Unlocks |
|---|---|---|
| **New** | Eligibility satisfied | Limited published products; "new seller" badge; no boosted placement; transaction value cap |
| **Established** | Sustained run of scanned handoffs with good ratings and low claims | Full catalogue limit for tier; standard placement; cap lifted |
| **Trusted** | Sustained volume, high scan completion, low claim rate | Priority placement; broadcast eligibility |

**INVARIANT — all thresholds are per-market configuration records**, published to sellers and never secret.

**Levels fall as well as rise.** An upheld claim, a run of unscanned handoffs, or a rising cancellation rate demotes. **INVARIANT — demotion is computed by the same service on the same evidence; there is no manual downgrade except through moderation action, which is logged.**

An existing audience seller is not placed above New on follower count alone. The audience path satisfies *eligibility*; the ladder governs *placement*.

### 5.2 Anti-gaming

The ladder is only worth what it costs to fake.

**INVARIANT — a scanned handoff counts toward level only when the scanning buyer account is distinct**, has its own verified phone number, and has not transacted with that seller more than a configured number of times in the level window.

Additional controls: velocity limits on level progression · graph analysis on buyer–seller pairs · device and payment-detail signals shared across accounts · automatic review flag when a seller's level rises unusually fast · **INVARIANT — an upheld claim always demotes, regardless of volume.**

### 5.3 Buyer-facing presentation

**INVARIANT — the seller's level and completed handoff count are visible on the storefront, on every product page, and at the reservation step.**

Language is descriptive and factual: "New seller — 0 completed handoffs." Never "unproven," "risky," or any characterisation. This is the same doctrine that governs published statistics: facts from our own logs, never judgements.

**INVARIANT — reserving from a New seller shows an explicit disclosure at the reservation step**, stating that the seller has no completed handoff history and that payment is made directly to the seller. It must not be dismissible by default or buried in terms.

---

## 6. Identity, authentication and sessions

### 6.1 Buyer identity

- Browsing is fully anonymous on all clients.
- Identity is created **at the moment of first reserve**, by phone OTP.
- One phone number, one account.
- The account carries reservation history, confirmation rate, cancellation history, claims filed and claims upheld.

**INVARIANT — a review may only be written by the buyer who holds the order it references.**

**No third-party login in V1.** Phone OTP only.

### 6.2 Seller authentication

**Sellers authenticate by phone OTP, the same mechanism as buyers.**

The reasoning: it is the mechanism every Ethiopian seller already uses everywhere else, it requires no password reset flow, it creates no credential-breach surface, and it removes an entire family of screens. What it does not do is make seller accounts as easy to recover as buyer accounts — a seller account holds payout details, order history and identity attestations, so §6.6 makes recovery deliberately harder.

**INVARIANT — a seller account is bound to one phone number, and that number is the authentication factor.**

**INVARIANT — the phone number bound to a seller account may only be changed through the recovery path in §6.6, never through ordinary settings.**

### 6.3 Team member and courier authentication

Both are invited by the seller and authenticate with **their own phone number by OTP**. Neither shares the seller's credentials.

| Actor | Invited by | Scope |
|---|---|---|
| **Team member** | Owner/Admin, Business tier only | Whatever their role grants, server-enforced on every endpoint |
| **Courier** | Any seller | Assigned orders only. Buyer name, phone and delivery information for those orders. No catalogue, no analytics, no chat history, no other orders. |

**INVARIANT — a courier account can read only the orders currently assigned to it by the seller that invited it.** Assignment ending ends access to that order's buyer information.

**INVARIANT — one person may hold buyer, seller, team member and courier roles on the same phone number.** Roles are relationships, not accounts. A creator who also buys, and a courier who also sells, are ordinary cases.

### 6.4 Sessions

**INVARIANT — session lifetime is per-market configuration, and seller sessions are shorter than buyer sessions.** A buyer losing a session loses convenience; a seller losing one loses payout control.

- Every session records device, first seen, last activity and approximate location where available.
- A seller or team member can list active sessions and revoke any of them, including all others at once.
- **INVARIANT — a new-device sign-in on a seller, team member or courier account sends a notification to the account's registered number.** It is not suppressible.
- Revoking a session takes effect server-side immediately, not at next token refresh.

### 6.5 Step-up authentication

**INVARIANT — the following actions require a fresh OTP challenge regardless of an active session:**

- Changing payout details (§10.4)
- Reissuing payment instructions on an order (§8.5)
- Adding, removing or changing the role of a team member
- Purchasing, upgrading or cancelling a subscription
- Deleting the seller account
- Revoking all other sessions

These are the actions where a compromised session becomes a compromised business. Viewing payment evidence is deliberately **not** on this list — it is the seller's routine work, and a challenge on every order would train them to approve challenges without reading them.

### 6.6 Recovery

Buyer recovery is ordinary: a new device, an OTP to the same number, and the buyer is back.

**Seller recovery is deliberately harder**, and its difficulty scales with what the account controls.

| Situation | Path |
|---|---|
| New device, same number | Ordinary OTP. No review. |
| Lost device, same number retained | Ordinary OTP on the new device. |
| **Number changed or SIM lost** | **Operator review.** Not self-service. |

Operator review draws on evidence Adulis already holds: the identity attestation where one exists, account-control verification against the linked social account, order and device history, and the registered payout details. **INVARIANT — the reviewing operator's decision, the evidence relied on, and the reason are logged.**

**INVARIANT — payout details cannot be changed for a configured cooling period after any account recovery. Default 7 days.**

This is the single most important rule in this section. Recovering an account and immediately changing the bank details is the complete attack, and it is exactly what a determined attacker would attempt. The cooling period gives the real seller time to notice, and it makes the attack require patience under observation rather than a single successful session.

During the cooling period the seller operates normally in every other respect.

---

## 7. Catalogue

Products carry seller, name, description, price, display order, visibility, source social post URL, category, and **structured attributes** — the mechanism that makes the chatbot free.

`ProductVariant` carries an attribute set, stock count and last-confirmed timestamp. `StockEvent` is append-only.

**INVARIANT — stock is never mutated without a corresponding StockEvent row.**

**Publication limits are the lesser of the tier limit and the level limit.** A New seller on Business tier publishes at the New limit.

On downgrade, products above the limit are **unpublished, never deleted**. The seller chooses which remain; failing a choice, the system defaults to most-reserved then most-recently-added.

### 7.4 Product media

**Images.** Up to **5 per product**.

**INVARIANT — uploaded originals are resized on receipt and discarded.** Three derivatives are retained — thumbnail, card and full — served as WebP or AVIF. The original is never stored and never served.

**INVARIANT — media is served from object storage with zero egress cost behind a CDN.** Bandwidth, not storage, is what makes media expensive; the architecture must not reintroduce a per-gigabyte delivery charge.

**Video — embed by default.** Social embeds are video-only, click-to-play with a cached poster frame that Adulis stores itself. **The product page must remain fully functional without the embed**, because the seller may delete the source post, the platform may rate-limit or geo-block, and embeds do not render cleanly inside the app.

**Video — optional self-hosted fallback.** A seller may additionally upload **one short clip per product**.

- **INVARIANT — video is compressed on the seller's device before upload.** Maximum 480p, maximum 30 seconds, size-capped server-side. A seller uploading a 40MB file over mobile data is paying for that bandwidth themselves and will frequently fail partway.
- Uploads are resumable.
- **INVARIANT — Adulis runs no server-side transcoding pipeline in V1.** A single progressive-download rendition is served. Adaptive bitrate solves a problem a 15-second clip does not have.
- Where both an embed and an uploaded clip exist, the uploaded clip is the fallback, not the primary.

**Retention.** **INVARIANT — media has a lifecycle policy.** Media belonging to deleted accounts is purged after the configured retention period; media for unpublished products moves to infrequent-access storage. Storage otherwise only ever grows.

**Moderation consequence to accept:** a 30-second video takes roughly thirty seconds to review, against two for an image. Video materially increases the cost of the risk-flagged moderation queue in §18, which is founder work under a 24-hour commitment.

### 7.5 Storefront search

A seller with 200 published products presents a buyer with a wall. Each storefront is searchable within itself.

**INVARIANT — storefront search scope is exactly one seller. It never returns a product from any other seller, under any query, on any client.**

This is not V3 discovery arriving early. The distinction is not a matter of degree: cross-seller results are a different product with different ranking, anti-gaming and moderation obligations, and building them here would smuggle V3 in through a side door.

Available on the web storefront and in the app:

- Product-name search within the seller
- Category filter
- Availability filter
- Structured-attribute filters, drawn from the attributes that seller actually uses

**The seller's configured display order remains the default.** Search and filters are a narrowing tool, never a re-ranking of the seller's merchandising.

### 7.5.1 Resolving a social post link

A seller attaches the TikTok or Instagram post that created demand for a product (§7.1). A buyer who saved that post but never followed the link can paste it into the app and reach the product.

**INVARIANT — a pasted post link resolves only within the seller who tagged it. It never returns a product from another seller.**

**One post commonly features several products, so the result is a list, not a redirect.** Returning every product that seller tagged with that link, and letting the buyer choose, is the correct behaviour — not a best guess.

Requirements:

- **Shortened and redirecting URLs must be resolved before matching.** TikTok share links are usually shortened; matching on the raw pasted string will fail most of the time.
- Matching is on the canonical post identifier, not the URL string, so tracking parameters and regional domains do not break it.
- **INVARIANT — one post link may be attached to many products by the same seller.** The data model must not assume one link, one product.
- Where the same link is claimed by more than one seller, none is shown and the event is flagged for moderation. A reseller using someone else's content is a moderation question, not a search result.

Required states: one match · several matches · no match · link not recognised · link no longer available.

**Deleted and reposted source content is a known unresolved case** and is recorded in §25.

### 7.6 Seller lookup

A buyer finds a seller by name or `@handle` and opens their storefront.

**This exists because short codes were removed.** A buyer who browsed on the web, installed the app, and had no deep link to follow arrives at a generic home screen. Without seller lookup they cannot get back to the seller who brought them.

**INVARIANT — seller lookup returns sellers, never products, and never suggests a seller the buyer did not search for.** No "similar sellers", no "popular near you", no ranked recommendations.

That constraint is what keeps this outside V3. Navigating to a seller you already know is not discovery.

- Matches on store name, `@handle` and connected social handles
- Results show name, verification status, trust level and completed handoff count
- Required states: results, no matches, search unavailable

Required states for §7.5: results, no matches, and search unavailable.

Bulk operations — import, multi-select edit, bulk stock update — are Business tier, in the web console.

---

## 8. Cart and orders

### 8.1 Structure

**INVARIANT — a cart contains items from exactly one seller.** Enforced when a second seller's item is added, not at checkout.

An **Order** is one buyer, one seller, one or more **Reservations** — one reservation per variant line. The two-day timer, the QR code, the payment, the confirmation scan and the review all attach to the **Order**. Cancellation and refund attach to the **Reservation**, so that an order can be partially cancelled without being destroyed.

### 8.2 The cart holds nothing

**INVARIANT — adding an item to the cart has no effect on stock.** Stock is decremented only when the order is created. A cart is a draft, not a claim.

This must be visible rather than implied. The cart displays live availability per line with the moment it was checked, and re-checks on every view of the cart.

### 8.3 Revalidation at order creation

**INVARIANT — the entire cart is revalidated inside the same transaction that creates the order.** If any line fails, no order is created and no stock is decremented.

Each line is checked for: sufficient stock, product still published, variant still exists, price unchanged, seller still eligible to receive orders, and the New-level transaction cap.

Where revalidation fails, the buyer is shown a reconciliation step listing exactly what changed and offering to reduce the quantity, remove the line, or abandon the order. **The system never silently alters a cart.**

Required buyer-facing states, per line: sold out · insufficient quantity · price changed · no longer published · variant withdrawn · seller unavailable.

### 8.4 Price is captured, not referenced

**INVARIANT — the unit price in effect at the moment the order is created is written onto the reservation and is immutable for the life of that order.** A later change to the product's price never affects an existing order.

The same rule applies to any delivery fee once that mechanism is specified, and to the ETB conversion rate where a local price is displayed.

This exists because price is the most common source of dispute between a buyer and a seller, and because the buyer agreed to a specific number.

### 8.5 Payout details are captured, not referenced

**INVARIANT — the seller's payout details in effect at the moment the order is created are written onto the order and are immutable for the life of that order.**

The payment instructions shown to a buyer are read from the order, never from the seller's current record.

Without this rule, a payout change mid-order silently reroutes payment for every order already placed. That is the exact outcome an attacker who compromises a seller session is trying to produce, and it would be invisible to the buyer, to the seller, and to Adulis.

**Where a seller's account genuinely closes mid-order**, there is one controlled path: a **reissue payment instructions** action on a single named order. It requires step-up authentication under §6.5, notifies the buyer prominently that the seller's payment details have changed and that they should confirm through chat before transferring, resets that order's confirmation SLA, and writes an immutable record. It is never applied in bulk and never applied silently.

**INVARIANT — reissuing payment instructions on an order is logged with actor, order, previous and new payout reference, and timestamp, and is included in any evidence export for that order.**

---

## 9. Reservation lifecycle

### 9.1 States

```
CREATED → NOTIFIED → PAYMENT_SUBMITTED → PAYMENT_CONFIRMED
                   → HANDED_OFF → COMPLETED

Terminal: CANCELLED_BY_BUYER · CANCELLED_BY_SELLER · EXPIRED_UNCLAIMED · REFUNDED
```

- Creating an order **decrements stock immediately** and holds it for **48 hours**.
- Expiry releases stock automatically and notifies both parties.
- A seller may decline; declining is recorded and affects the published cancellation rate.

**INVARIANT — a unique constraint on (seller, buyer, variant, active time window) makes duplicate live reservations structurally impossible.**

**INVARIANT — stock release on expiry is idempotent.**

**INVARIANT — an order from a New-level seller is rejected if it exceeds the configured transaction value cap.**

### 9.2 What the 48-hour clock actually governs

**INVARIANT — the expiry clock stops permanently when an order reaches `PAYMENT_CONFIRMED`.** A paid order is never expired by the system.

The 48 hours exist to stop unpaid reservations holding stock indefinitely. Once the seller has confirmed payment, the buyer has performed and the obligation reverses: the seller now owes goods. Expiring that order would release stock the buyer has already paid for.

A confirmed order awaiting handoff moves to a **fulfilment window** — a separate, longer, per-market configured period. Its expiry does not release stock and does not cancel the order; it raises a claim trigger, because a paid order that never reaches handoff is a dispute, not a timeout.

### 9.3 Buyer notifications

Two only — the morning after the order is placed, and two hours before expiry. Copy is specified in §17.3.

Permission is requested immediately after the first reservation, never at first launch. If denied, an in-app badge and countdown appear on the order card.

**Notifications stop when the clock stops.** A buyer whose payment has been confirmed does not receive expiry warnings.

### 9.4 Partial fulfilment

A seller who cannot supply every line may cancel individual reservations rather than the whole order.

**INVARIANT — cancellation, refund and stock release operate at reservation level, not order level.**

Rules:

- Each cancelled line releases its own stock and writes its own `StockEvent`.
- Each cancelled line counts toward the seller's published cancellation rate. Cancelling two of three lines is two cancellations, not one.
- The order total recalculates from the surviving lines.
- **INVARIANT — where payment was already confirmed, each cancelled line enters `REFUNDED` and the seller owes that line's captured amount.**
- **The buyer is notified and may cancel the remainder without penalty.** Someone buying a matching set may not want part of it, and that choice belongs to them.
- An order whose every line is cancelled becomes `CANCELLED_BY_SELLER` at order level.

Where the seller's stated reason is unavailable stock and the stock record was not current, the buyer may raise a claim and the seller's stock confidence degrades.

### 9.5 Buyer cancellation penalties

3 consecutive cancellations with one seller → 1 hour cooldown; a pattern across multiple sellers → 1 day, then 2 days, escalating. The counter **decays after 30 days of clean activity**. Cancelling actively is penalised less than letting an order expire silently.

---

## 10. Payment

### 10.1 Flow

Adulis holds no money. It relays evidence.

1. Seller has filled in business bank credentials during shop setup.
2. Buyer reaches payment; the bot provides the seller's bank details.
3. Buyer transfers funds and uploads a screenshot.
4. Seller reviews it against their own bank account and confirms or rejects.
5. On confirmation the bot informs the buyer and the order moves to `PAYMENT_CONFIRMED`.

**Adulis never asserts that a payment is genuine.** The seller is the verifier. Team members may confirm where RBAC grants it; the acting member is recorded.

### 10.2 Active hours

**Seller active hours:** declared, **minimum 8 hours per day**. The confirmation SLA is **1 hour, counted only within active hours**.

**INVARIANT — the active-hours window in effect at the moment the screenshot was submitted governs that transaction.**

**INVARIANT — every change to active hours is written to an immutable log** with actor and timestamp.

### 10.3 Payment evidence handling

**INVARIANT — screenshots are stored encrypted in an isolated boundary with its own access control and audit log, and are deleted once the payment is validated.** Retention beyond validation only while a claim referencing that payment is open.

**INVARIANT — every access to a payment evidence record is written to the evidence access log, regardless of who performs it.** That includes the seller, any seller team member acting under RBAC, any Adulis operator, and any automated process. The log records actor, actor role, evidence reference, related order, reason where one is required, and timestamp.

This is the point of an isolated boundary. A log that records only operator access describes a boundary Adulis controls while ignoring the actor who reads the record most often. A payment screenshot carries both parties' bank details; the seller is a legitimate reader, not an exempt one.

Seller-side access requires no justification field — viewing evidence is their job — but it is recorded identically and is visible to the buyer on request as part of an evidence export.

### 10.4 Payout details

The seller's bank account is the highest-value target in the system. An attacker who changes it once collects from every buyer thereafter, using instructions Adulis itself displays, and because Adulis never touches the money there is nothing downstream that would notice. It needs controls proportionate to that, not the controls of an ordinary settings field.

**INVARIANT — only the Owner/Admin role may view or change payout details.** No other role, including Sales/Support who confirm payments daily.

**INVARIANT — changing payout details requires step-up authentication under §6.5.**

**INVARIANT — a payout change does not take effect immediately.** It enters a `PENDING` state for a configured activation delay, default **24 hours**, during which:

- The previous details remain in effect for all new orders.
- The seller can cancel the pending change without step-up authentication — reverting must always be easier than changing.
- The pending change is visible in the seller console and in the account history.

**INVARIANT — a payout change, whether requested, activated or cancelled, sends a notification to the seller's registered phone number and to every Owner/Admin on the account. It is not suppressible and is not affected by notification preferences.**

The notification names what changed, when, and how to cancel it. A seller who did not make the change learns within minutes rather than when a buyer says they paid someone else.

**INVARIANT — every payout change is written to an immutable log** recording actor, timestamp, device and session reference, the masked previous account, the masked new account, and the outcome — pending, activated, or cancelled.

**INVARIANT — payout details are masked everywhere after entry.** The last four digits only, in the seller console, in support tooling and in admin. The full number is written once and never redisplayed to anyone.

**INVARIANT — payout details cannot be changed during the recovery cooling period defined in §6.6.**

**On the activation delay.** It is real friction for a seller who has legitimately opened a new account, and it is the control that most reduces the blast radius of a stolen session. It is per-market configuration so it can be tuned against observed behaviour rather than argued about in advance. It should not be set to zero.

### 10.5 Refunds

A `REFUNDED` state exists at reservation level. The refund is a direct seller-to-buyer transfer; Adulis records that the seller reported it and that the buyer acknowledged receipt. Both are explicit user actions with their own events; neither is inferred.

An unacknowledged refund after a configured period is a claim trigger.

---

## 11. Handoff confirmation

### 11.1 Mechanism

Adulis generates a QR code per **order**. At handoff the seller, team member or courier displays it and **the buyer scans it** — the buyer is the party asserting receipt.

**The QR encodes a signed offline token.** The scan must be verifiable offline and sync later.

Target: under 10 seconds per handoff, one scan per order regardless of item count.

### 11.2 The two custody events

Where a courier is involved there are two distinct events. Conflating them would make the trust ladder fakeable by any seller with one cooperative courier, so they are specified separately.

**Event A — seller → courier. Internal custody transfer.**

Establishes which courier physically received the order and when responsibility left the seller. One authenticated confirmation from each side.

- **INVARIANT — Event A never completes an order.**
- **INVARIANT — Event A never counts toward seller trust level.**
- **INVARIANT — Event A never enables a review.**

It exists for the seller's own operational record and for claim evidence. The courier is the seller's agent; custody between them is internal to the seller's business and is not evidence of anything to a buyer.

**Event B — courier → buyer. Verified handoff.**

The courier displays the order QR and **the buyer scans it**. This is the only event that produces buyer-facing evidence.

- Completes the order.
- Counts toward trust level.
- Earns the review its strongest evidence badge.

**INVARIANT — a courier can never perform the buyer's scan**, on any client, under any circumstance. The buyer is the party asserting receipt, and a courier scanning on the buyer's behalf would let a seller manufacture verified handoffs at will.

Where the seller hands to the buyer directly, Event A does not occur and Event B is unchanged.

### 11.3 Confirmation tiers

| Path | Result | Counts toward level |
|---|---|---|
| Buyer scans the QR | **Verified handoff** | **Yes** |
| Buyer taps "I received it" | **Confirmed by buyer** | No |
| Neither, within the window | **Unconfirmed** | No |

**INVARIANT — only a scanned handoff counts toward trust level.** A tapped confirmation publishes a review at medium weight but does not advance a seller. Otherwise the ladder is trivially fakeable.

### 11.4 Offline scans and late sync

A handoff happens in a doorway with no signal. The token is scanned at hour 47 and syncs at hour 50, by which time the server has expired the order and released the stock. This will happen routinely and needs a rule.

**INVARIANT — the signed timestamp inside the scanned token governs, not the moment the scan reaches the server.**

The token carries: order reference, a nonce, the scan timestamp, and a signature. The device signs the scan locally at the moment it occurs.

| Condition | Outcome |
|---|---|
| Scan timestamp within the reservation window | **Valid verified handoff.** The order completes and counts toward trust level, even if the server had already expired it. |
| Scan timestamp after the window closed | Handoff is recorded as **late**. It publishes a review at "confirmed by buyer" weight and does **not** count toward trust level. The order does not reopen. |
| Token arrives more than the configured sync horizon after its timestamp | Rejected. Default 7 days, per-market configuration. |
| Token nonce already seen | **Rejected as replay**, always, regardless of timestamp. |

**INVARIANT — stock is never re-decremented when an expired order is completed by a late-syncing scan.** The stock was already released. Re-decrementing could drive the count negative and would violate the non-negativity invariant.

Instead, the system writes a **reconciliation StockEvent** recording the discrepancy, and notifies the seller that a completed handoff arrived against released stock and their count may need correcting. The seller is the system of record for stock; Adulis surfaces the conflict rather than guessing at it.

Where the released stock was reserved by a different buyer in the interval, both orders are flagged for the moderation queue. Two buyers now hold claims on one item and no software can resolve that — but the platform must notice it rather than let one of them discover it at a doorway.

**Design consequence for the app:** an unsynced scan must be visible to the buyer as pending rather than complete, with a plain explanation that confirmation will finish when they are online. It must survive the app being closed and must not be lost on reinstall within the sync horizon.

---

## 12. Reviews

**INVARIANT — a seller can never prevent a review from publishing. Evidence determines the badge, not the right to publish.**

| Path | Publishes | Badge | Weight |
|---|---|---|---|
| Scanned handoff | Yes | Verified handoff | Highest |
| Buyer tapped confirm | Yes | Confirmed by buyer | Medium |
| No confirmation | Yes | Unverified | Lowest |
| Claim or dispute | Always | Shown in claim record | n/a |

The seller's **scan completion rate is published**.

**Two ratings, always separate.** Item quality and seller quality. Never averaged together. Item quality aggregates to the product; seller quality aggregates to the seller badge and feeds the ladder.

One review per order, requiring an order in a terminal state.

---

## 13. Trust signals

### 13.1 Verification

| Level | Method | Available to |
|---|---|---|
| **Unverified** | — | Cannot publish |
| **Account control** | One-time code posted to the linked social account; automated fetch and match; follower count captured | All sellers, free |
| **ID verified** | KYC vendor or scheduled video call | Required in Phase 2 without an audience; blue tick at Pro |

**Account-control adapters at launch: TikTok and Instagram.** **INVARIANT — each platform sits behind an adapter interface; a platform failure degrades to manual verification without affecting the others.**

**Video-call verification window: 08:00–20:00 EAT (05:00–17:00 UTC).**

⚠ **Founder video calls do not scale to Phase 2.** When ID verification becomes mandatory, volume moves from Pro conversions to total signups. **INVARIANT — the KYC provider sits behind a vendor-agnostic interface**, and a vendor must be integrated and load-tested before the gate drops.

**INVARIANT — no identity image or video is ever uploaded to Adulis systems.** Retained: date, verifier or vendor reference, ID type, legal name, a **deterministic keyed hash (HMAC, key in a managed store, rotatable)** of the ID number, a verified boolean, and for company sellers the verified individual's stated relationship to the company.

A keyed hash, not a per-record salt: the purpose is detecting the same ID across accounts, which a per-record salt makes impossible.

**INVARIANT — payment never buys a badge or a level.** The subscription buys access to the verification process.

### 13.2 Published seller statistics

Factual and never accusatory: trust level · completed handoff count · cancellation rate · confirmation rate · scan completion rate · unresolved claims · missed payment-confirmation windows · stock confidence level.

**INVARIANT — Adulis never publishes the words scammer, fraud, criminal or equivalent, or any assertion of wrongdoing.**

### 13.3 Stock confidence

Degrades when stock is not confirmed daily, and every 3 hours once critical. Graduated consequences:

| Level | Effect |
|---|---|
| 1 | Seller nudged to confirm |
| 2 | Product page shows a staleness notice |
| 3 | Chatbot hedges stock claims more strongly |
| 4 | Badge display degraded |
| 5 | Broadcasts blocked |

**Every stock claim carries its last-confirmed timestamp.** Stock update must take under five seconds. External stock integration is Business tier only.

---

## 14. Claims

**Triggers:** payment confirmed with no seller response within SLA · seller cancels for stock not updated · goods not received after payment · goods materially not as described · refund promised and not delivered.

**Process:** reviewed within a **2-day window**. Evidence attached automatically by claim type: chat history, scan records, payment screenshot, stock event history, active-hours change log, order state transitions, seller level at time of order, acting team member.

Outcome: **upheld** or **not upheld**, including bad-faith claims. Outcomes affect published statistics and **INVARIANT — an upheld claim always demotes the seller's level.**

**Escalation beyond Adulis:** Adulis does not file police reports. On request it produces an **evidence export** and cooperates with lawful process. **For Phase 2 sellers this export is the buyer's primary recourse and must be fast and complete.**

---

## 15. Chat and chatbot

Buyer–seller chat is available on **all tiers**. Free sellers carry the load manually — the burden must be **visible**: unanswered count, response time, out-of-hours questions.

Chat is in-app only. Bot escalations are delivered as **notifications**; ordinary messages are not.

### 15.1 The resolution cascade

| Layer | Mechanism | Cost |
|---|---|---|
| **0** | Product page structure — the question is never asked | 0 |
| **1** | Quick-reply chips from structured fields | 0 |
| **2** | Exact and keyword match against the intent library | 0 |
| **3** | Embedding similarity via pgvector | ~$0.000006 |
| **4** | Model as classifier — returns an intent ID only | ~$0.00013 |
| **5** | Escalate to the seller with full context | 0 |

**INVARIANT — the model never generates a response.** It returns an intent ID. Every response is a template filled from structured data.

**INVARIANT — the bot never goes dark.** Only layer 4 is metered. At the cap, layers 0–3 continue and everything else escalates.

Per-seller inference cap: **15% of tier revenue.** Warned at 70% and 90%.

**Intents are global; answers are per-seller.** Expected inventory: 50–70 intents. Business tier adds deterministic custom flows above the cascade.

### 15.2 Language

- **Output:** English and Amharic, fully templated with slot-filling. ~120 strings, human-translated once.
- **Input:** English free text at launch; Amharic free-text understanding deferred, chips carry the load.
- **INVARIANT — templates and intent phrases are per-locale resources.**

### 15.3 The improvement loop

Every escalation is logged with its unmatched text. Monthly: **200+ new example phrases**, **0–3 new intents.**

**INVARIANT — a frozen regression set of 300–500 hand-labelled real messages runs before and after every update.** Precision drop reverts the change.

**Two stores, separated:** the operational conversation record and the identity-stripped phrase library.

---

## 16. Subscriptions, trial and entitlements

### 16.1 Tiers

| Tier | Price | Products | Chatbot | Blue tick | Broadcast | Analytics | Team | Support |
|---|---|---|---|---|---|---|---|---|
| Listed | $0 | 10 | None | No | No | Essential counts | No | Self-service |
| Assisted | $10 | Unlimited | Top 10 | No | No | Views, reservations, conversion | No | 48h |
| Verified Pro | $25 | Unlimited | All | Yes | Yes | Full | No | Priority |
| Business | $50 | Unlimited | All + custom flows | Yes | Yes | Full + export | Yes, RBAC | Dedicated |

**Broadcast eligibility requires Trusted level as well as Pro tier.** Tier grants the capability; level grants the right to use it.

### 16.2 Business tier — V1 scope

| Capability | Requirement |
|---|---|
| **Team accounts** | Multiple logins under one seller |
| **Roles** | Owner/Admin · Sales/Support · Inventory · Analyst (read-only) · Campaign manager |
| **Audit** | Every state-changing action records the acting team member |
| **Export** | Orders, products, stock events, analytics as CSV/XLSX from the web console |
| **Custom chatbot flows** | Deterministic multi-step sequences, seller-authored |
| **Bulk catalogue operations** | Import, multi-select edit, bulk stock update |
| **API** | Read-mostly, rate-limited, scoped tokens |

**INVARIANT — RBAC is enforced server-side on every endpoint**, never by hiding UI. **INVARIANT — no role except Owner/Admin may change billing, delete the seller, or alter team membership.**

### 16.3 Trial

**INVARIANT — the trial is 60 days from each seller's own signup date**, never a calendar cutoff.

**INVARIANT — the blue tick is excluded from the trial**, except where ID verification is mandatory under Phase 2, in which case it is a condition of selling and is provided regardless of tier.

Business team features are not included in the trial. At expiry the seller falls to Free unless paid. Warnings at 14 days, 3 days and 1 day.

### 16.4 States

```
TRIAL → ACTIVE → (PAST_DUE → ACTIVE | PAST_DUE → SUSPENDED) → CANCELLED
```

Suspension downgrades to free tier. **INVARIANT — suspension never deletes seller data, and never resets trust level.** On downgrade from Business, team logins are disabled, not deleted.

Behaviour of active orders during suspension is specified in §16.8.

### 16.5 Entitlement resolution

**INVARIANT — entitlements are resolved by a service at read time**, never stored as a boolean column. Tier inclusions, limits, ladder thresholds and level unlocks are versioned configuration records.

**INVARIANT — the effective limit for any capability is the intersection of tier entitlement and trust level.**

### 16.6 Pricing and currency

- **USD is the currency of record.**
- **INVARIANT — every market has its own price schedule.**
- Local prices re-published **every two months**.
- **INVARIANT — the rate is locked when a paid term begins and holds for that term.**
- **INVARIANT — the rate used is logged against every subscription record.**

### 16.7 Collection and invoicing

Manual bank transfer, prompted by SMS. Prepay: 5% for three months, 10% annually.

**No purchase surface exists at MVP.** Controlled-beta sellers pay nothing, so nothing needs to be bought. This is why the product can ship mobile-only.

**Before paid launch, a narrow authenticated web surface is required** — the seller signs in, sees their plan and term, receives bank transfer instructions, and marks the transfer made. Roughly six screens.

**INVARIANT — that surface lives on the web and is never reachable from inside either app.** Not a link, not a WebView, not an "upgrade" prompt. A seller finds it by going to the website themselves.

Loading a pricing page inside a WebView is treated as purchasing in the app and is a well-documented rejection. The seller must leave the app entirely.

**Company sellers require a compliant invoice.** Confirm format with the accountant before paid launch.

**INVARIANT — the payment collection provider sits behind an adapter interface.**

### 16.8 Suspension with active orders

Two kinds of suspension exist and they must not behave the same way.

**Billing suspension** — the seller did not pay. This is administrative, not a safety finding.

**INVARIANT — billing suspension never cancels an active order.** The seller retains full access to existing orders: confirming payments, arranging handoff, displaying the QR, responding in chat, processing refunds. What is blocked is everything forward-looking — publishing products, receiving new reservations, broadcasts.

A buyer with an order in flight sees no change to that order. The storefront shows as unavailable to new visitors; the buyer's order detail page continues to work normally.

**Safety suspension** — a moderation action for prohibited goods, fraud, impersonation or equivalent. Here, allowing handoffs to continue may be exactly wrong.

Safety suspension is a separately logged admin action with an explicit decision recorded at the time: whether active orders continue or terminate. Where they terminate:

- Unpaid orders are cancelled and stock released.
- **Paid orders are not simply cancelled.** A claim is opened automatically on the buyer's behalf, the buyer is notified factually, and an evidence export is prepared.
- The buyer is told what happens next, never why the seller was suspended. **INVARIANT — moderation reasoning is never disclosed to third parties**, which follows directly from the rule against publishing accusations.

**INVARIANT — suspension type, actor, the decision on active orders, and the reason are recorded in the moderation log.**

### 16.9 Seller account deletion

A seller account carries obligations to third parties that a buyer account does not: money owed, goods owed, evidence held in open claims, and team members whose access derives from it. Deletion cannot be a settings toggle.

**INVARIANT — deletion is blocked while any of the following is unresolved**, and the seller is shown exactly which:

- Reservations in any non-terminal state
- Payment evidence submitted and awaiting confirmation
- Orders confirmed and awaiting handoff
- Refunds reported but not acknowledged, or owed and not reported
- Claims open or under review
- A subscription in `PAST_DUE`

**INVARIANT — for a company seller, only the Owner may initiate deletion.** No Admin, no other role.

**INVARIANT — deletion requires step-up authentication under §6.5.**

What deletion does:

| Data | Treatment |
|---|---|
| Storefront and products | Unpublished immediately, then purged after the retention period |
| Seller identity fields | Scrubbed |
| Verification attestation | Retained per the identity retention policy — **the keyed ID hash survives deletion**, or deletion becomes the mechanism for evading duplicate-identity detection |
| Payout details | Purged |
| Transactional records | Retained, anonymised |
| Reviews written by buyers | **Anonymised, never deleted.** A seller cannot erase their own reliability history by closing the account. |
| Team member access | Revoked; the members' own accounts are untouched |
| Courier assignments | Ended |
| Moderation and audit records | Retained in full |
| Trust level and handoff history | Retained in anonymised form |

**INVARIANT — deletion never removes evidence relied upon in a resolved claim**, and never removes moderation history.

**INVARIANT — a deleted seller's phone number does not become immediately reusable for a new seller account.** A cooling period, per-market configuration, prevents deletion being used to reset a poor trust record.

### 16.10 Controlled-beta entitlements

**Beta sellers are not on the Free tier.** They pay nothing, but the tier table in §16.1 does not describe them. Their entitlements are set here.

**INVARIANT — `BETA` is a distinct subscription state, not a $0 Listed subscription.** It is resolved by the entitlement service under §16.5 like any other state, it is recorded on every event under §20, and it ends by conversion to a paid tier or by expiry — never silently.

The reason it must be distinct rather than modelled as Free: beta cohort behaviour is the evidence for every launch decision in ADU-PROJ-01 §12, and it is worthless if it cannot be separated from the behaviour of sellers who chose the free tier on the merits.

| Capability | Beta | Why |
|---|---|---|
| **Chatbot** | **Included, on all products** | See below |
| Products | Unlimited | The catalogue-size question is not what the beta is testing |
| Verification | Account control, free. ID verification where the market requires it | Unchanged from §13.1 |
| Blue tick | Not granted by beta status | A badge is a trust signal, not a courtesy |
| Broadcasts | **No** | Requires Trusted level (§17.1), which no beta seller can have earned |
| Analytics | Views, reservations, conversion | Enough for the seller to judge the product |
| Team accounts and RBAC | **No** | Business-tier capability; not what the beta is testing |
| Data export | **No** | Post-MVP surface (§3.0) |

**Why the chatbot is included even though it is a paid feature afterwards.**

The chatbot cannot be evaluated, priced or improved without real buyer questions asked of real sellers. §15.3 defines the improvement loop: every escalation is logged with its unmatched text, and the intent library grows by roughly 200 example phrases and 0–3 intents a month from that record. Withholding the chatbot during the beta means the loop starts from nothing on the day it starts mattering commercially — the intent inventory would be founder guesswork, containment would be unmeasured, and the per-seller inference cap would be set against no data.

**INVARIANT — beta chatbot conversations feed the improvement loop under §15.3 on the same terms as any other conversation**, including the two-store separation between the operational conversation record and the identity-stripped phrase library.

**The commercial position must be stated to beta sellers in advance.** The chatbot is included during the beta and becomes a paid-tier capability afterwards. A seller who discovers at conversion that a feature they relied on now costs money churns, and is right to.

> ⚠ **Open item — beta-to-paid transition.** What happens to a beta seller's chatbot configuration, intent customisations and conversation history at conversion, and whether the 60-day trial (§16.3) runs in addition to the beta period or is consumed by it, are not decided. Both need answers before the first cohort converts, not before it is onboarded.

---

## 17. Followers and broadcasts

### 17.1 Following and notification eligibility

**Adulis followers are not social-platform followers.** They are earned separately, and a seller with 80,000 social followers begins here with none.

**INVARIANT — following is available before purchase, from every surface where a seller is identified.** The web storefront, the app storefront, the product page, the reservation flow, and after a completed order.

Following is not gated on having transacted. A buyer who has not yet bought anything is exactly the buyer a seller most wants to reach again, and a follow list that only accumulates after completed orders grows too slowly to make broadcasts worth paying for.

The post-reservation prompt in the buyer flow remains, but it is an **acquisition prompt, not the eligibility point**.

### 17.1.1 Following from the web

Web browsing is anonymous and following requires an identity, so a follow tapped on the web cannot complete there.

**With the app installed**, the Follow control opens the app on that seller's storefront through §21.1 and the follow is created there.

**Without the app**, the control explains what following does and sends the buyer to the store. After installing, the buyer reaches the seller through seller lookup (§7.6) and follows.

**The deferred-follow token from v8.3 is removed** along with short codes. The cost is real: a buyer who intended to follow before installing may not complete it.

**Measure `follow_intent_web` against `follow_created` for the same buyer.** If the gap is wide, deferred follow is worth rebuilding as a standalone mechanism — but it should be rebuilt on evidence, not reinstated on assumption.

**INVARIANT — one canonical follow state.** Following, unfollowing and per-seller notification preferences resolve to one server-side relationship regardless of which of the six surfaces initiated it.

| Notification type | Availability |
|---|---|
| Reservation reminders, expiry warnings, payment confirmations, escalations, claim updates | **All tiers, all levels** |
| Restock and discount marketing broadcasts | **Pro or Business tier AND Trusted level** |

### 17.2 The following feed

A V1 buyer surface listing activity from sellers the buyer deliberately follows.

**INVARIANT — the following feed contains only sellers the buyer follows. It never introduces a seller the buyer has not followed, by any mechanism, including "similar sellers", "popular near you" or any other framing.**

That constraint is what keeps it outside V3. Cross-seller discovery is a different product with ranking, anti-gaming, new-seller impression allocation and moderation obligations that V1 does not carry.

Eligible content: new products from followed sellers · restocks · discount broadcasts where the seller is Pro or Business **and** Trusted · seller storefront updates.

Ordering is recency-first within the followed set. **No personalisation model, no learned ranking, no engagement scoring.** The feed is a query, not a recommender.

**The empty state is the entire first experience of this surface for every new buyer**, since Adulis follower lists start at zero and always will for someone. §23.2 applies with particular force: it must explain what following does and route the buyer to the sellers whose links brought them.

### 17.3 Buyer notification copy

Two notifications stand between a reservation and silent expiry. They carry more weight per word than any other text in the product and are specified here rather than left to implementation.

**INVARIANT — notification content is selected by order state at send time, not by a single template.** A buyer whose payment is already confirmed must never receive an expiry warning.

**INVARIANT — no notification is sent for an order past `PAYMENT_CONFIRMED`**, since §9.2 stops the clock there.

**Send 1 — the morning after the order is placed (08:00 EAT)**

| Order state | English |
|---|---|
| `CREATED` / `NOTIFIED` | *[Seller] is holding your order. Send payment before [time] tomorrow to keep it.* |
| `PAYMENT_SUBMITTED` | *[Seller] hasn't confirmed your payment yet. Your order is held until [time] tomorrow.* |
| `PAYMENT_CONFIRMED` | Not sent. |

**Send 2 — two hours before expiry**

| Order state | English |
|---|---|
| `CREATED` / `NOTIFIED` | *Your order from [Seller] is released in 2 hours. Send payment to keep your items.* |
| `PAYMENT_SUBMITTED` | *Still waiting on [Seller]. If nothing changes in 2 hours you can raise a claim — your payment record is saved.* |
| `PAYMENT_CONFIRMED` | Not sent. |

Rules that apply to both:

- **Name the seller.** A buyer with orders from three sellers cannot act on an anonymous reminder.
- **State the deadline as a time, never a duration.** "Expires in 4 hours" is stale the moment it is read from the notification tray.
- **Never blame.** The `PAYMENT_SUBMITTED` variants describe the situation; they do not characterise the seller.
- Deep-link directly to the order, not to the app home.
- Templates are per-locale resources under §15.2, filled by slot. **INVARIANT — translated strings are never assembled from concatenated fragments**; each is a complete sentence with named slots, because word order differs between English and Amharic.

**In-app fallback where notification permission was denied** carries the same information as a persistent badge and a countdown on the order card. This is not optional — Android 13 and later let buyers refuse notifications, and a refused permission must not mean a lost order.

---

## 18. Moderation

**Reactive by default, proactive on risk signals.** The automatic queue surfaces prohibited-product keyword matches, sellers under one week old, **all New-level sellers' first listings from Phase 2**, and cosmetics and electronics.

**Store-mandated, build in V1:** report mechanism on **every** piece of user content · block mechanism · published contact method · action on reported content within **24 hours**.

`ModerationEvent` is immutable: actor, target, decision, reason, timestamp.

---

## 19. Multi-market readiness

**INVARIANT — the following are per-market configuration records, never constants:**

| Dimension | Examples |
|---|---|
| Eligibility | Audience required, follower threshold, counting platforms, threshold basis, permitted seller types |
| Trust ladder | Level thresholds, New-level product and transaction caps, demotion rules |
| Currency and pricing | Price schedule, display currency, re-derivation cadence |
| Locale | Chatbot templates, intent phrases, UI strings, formats |
| Payment rail | Collection provider adapter, processing fee |
| Identity | KYC vendor, accepted documents, verification hours |
| Legal | Terms version, privacy regime, retention, prohibited categories, invoice format, required disclosures |
| Time | Display timezone; UTC always for storage |

**INVARIANT — a new market is added by creating configuration and a locale pack, not by changing code. Phase 1 and Phase 2 are per-market states, not global ones** — a mature home market may be in Phase 2 while a new market opens in Phase 1.

---

## 20. Analytics and the event schema

**INVARIANT — every meaningful action emits a versioned event. A definition change creates a new event version; it never edits an existing one.**

`storefront_viewed` · `product_viewed` · `chip_tapped` · `chat_message_sent` · `bot_resolved` · `bot_escalated` · `cart_item_added` · `cart_revalidation_failed` · `order_created` · `reservation_created` · `reservation_cancelled_by_seller` · `payment_submitted` · `payment_confirmed` · `payment_evidence_accessed` · `payout_change_requested` · `payout_change_activated` · `payout_change_cancelled` · `payment_instructions_reissued` · `session_created` · `session_revoked` · `new_device_signin` · `step_up_challenged` · `account_recovery_requested` · `account_recovery_resolved` · `refund_reported` · `refund_acknowledged` · `handoff_scanned` · `handoff_synced_late` · `stock_reconciliation_required` · `order_confirmed` · `order_expired` · `order_cancelled` · `review_published` · `claim_filed` · `claim_resolved` · `stock_updated` · `stock_confirmed` · `seller_verified` · `seller_eligibility_checked` · `seller_level_changed` · `seller_suspended` · `new_seller_disclosure_shown` · `notification_sent` · `notification_permission_result` · `team_member_added` · `team_action_performed` · `export_generated` · `trial_started` · `trial_converted` · `trial_expired` · `subscription_state_changed` · `app_link_opened` · `reserve_intent_web` · `post_link_pasted` · `post_link_resolved` · `post_link_unresolved` · `post_link_conflict` · `seller_lookup_performed` · `follow_created` · `follow_intent_web` · `seller_publication_blocked` · `storefront_search_performed` · `courier_custody_transferred` · `seller_deletion_requested` · `seller_deletion_blocked`

Every event carries `market_id`, `seller_type`, `eligibility_path` and `seller_level`.

**`eligibility_path` is the most important field added in this version.** Audience-path and identity-path sellers must be measurable as separate cohorts from the first day of Phase 2 — on churn, conversion, claim rate and first-sale time. That comparison is the evidence for whether dropping the gate worked, and it cannot be reconstructed later.

Every chatbot turn additionally emits: `seller_id`, `buyer_id`, `conversation_id`, `turn_index`, `resolution_path`, `model_id`, `tokens_in`, `tokens_cached`, `tokens_out`, `language`, `latency_ms`, `escalated`.

---

## 21. Web-to-app handoff

The web storefront browses; the app acts. Everything below exists to carry a buyer across that boundary without losing what they were looking at.

**Short codes are removed.** They existed to survive an install with no deep link. Three mechanisms replace them, in order of how well they preserve context.

### 21.0 The bio link is the only outbound link

**INVARIANT — neither TikTok nor Instagram permits an outbound link on an individual post. A seller cannot link to a specific product from a post, and no Adulis surface, document, screen or marketing material may depict, describe or imply that they can.**

What actually exists:

- **One Adulis profile link in the seller's bio.** It resolves to that seller's storefront. It is the only link the seller controls on either platform.
- **A `source social post URL` recorded against a product** (§7.1). This is Adulis's own inbound record of which post created demand — it is used for link resolution (§7.5.1) and for the embed on the product page (§7.4). **It is not an outbound link and the seller never publishes it.**

The distinction matters because those two are easy to conflate, and conflating them produces a product story that cannot be executed: a seller told to "share a product link in your post" will find no such control on either platform and conclude the product does not work the way it was described.

**Consequence for every downstream surface.** The buyer journey is: bio link → seller storefront → browse → install → find the product again. The buyer arrives at a **storefront**, not at a product. Where a specific product must be recovered after an install, §21.2 is the mechanism — not a link the seller was never able to post.

### 21.1 App installed — platform deep links

**INVARIANT — Android App Links and iOS Universal Links are configured for every seller storefront and product URL.** A buyer with the app installed who opens an Adulis URL lands in the app on that exact surface, never the browser.

The **bio link** is a storefront URL, so tapping it opens the storefront. Product URLs exist and are deep-linkable — they are reached from inside Adulis, from a shared link, or from §21.2 recovery — but a seller never publishes one on a social post, because §21.0 means they cannot.

This requires the domain association file to be hosted and the URL patterns declared in both apps. It is native, free, and handles the majority of returning buyers.

Where the app is not installed the same URL renders the public web storefront. One URL, two behaviours, no branching logic on the page.

### 21.2 App not installed — install, then recover

A buyer without the app sees the web storefront, browses, and taps Reserve. They are told the app is needed and sent to the store.

**There is no mechanism that carries the specific product across that install.** This is a deliberate simplification and it has a cost: the buyer arrives at a generic home screen.

Two recovery paths, and the app's first screen must offer both:

1. **Paste the social post link** (§7.5.1) — works when the buyer saved the TikTok or Instagram post
2. **Search the seller** (§7.6) — works whenever the buyer remembers who they were buying from

**Measure the drop.** `reserve_intent_web` against `first_reservation_created` for the same buyer identity is the honest figure for how many buyers this loses. If it is large, a deferred deep-link service becomes worth paying for, and that decision should be made on this number rather than on principle.

### 21.3 Install attribution

Short codes previously gave install attribution per seller as a side effect. That is gone.

Attribution now comes from platform deep links where available, and otherwise from the seller a buyer first transacts with. It is weaker, and Pro sellers asking what Adulis did for them should be given the figures that are actually measurable rather than an estimate.

---

## 22. Custody readiness

**INVARIANT — every payment event writes a ledger entry**, recording amount, currency, parties, direction and state, with Adulis's balance at zero.

**INVARIANT — financial records are append-only.**

**Reconciliation is a first-class concept.**

When the licence arrives, custody becomes a change in who holds the balance. **Escrow is the complete answer to the Phase 2 buyer protection gap and should be designed against this ledger from the start.**

---

## 23. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | Web storefront first paint on a low-end Android over a slow connection is the binding constraint. Server-rendered. Embeds click-to-load. |
| **Offline** | The QR handoff scan must work offline and sync later. |
| **Time** | All timestamps stored UTC. Displayed in the market's local timezone. Never store local time. |
| **State** | All state logic on the server. Clients display state and send intents; they never compute expiry, eligibility, level or entitlement. |
| **Security** | TLS with HSTS · rate limiting on auth, OTP, reservation, claim and proposal endpoints · RBAC enforced server-side · secrets in a managed store · dependency scanning in CI · backups verified by restore |
| **Isolated boundaries** | `verification` and `payment_evidence` have separate access control and audit logs, short enough for a paid reviewer to read in full |
| **Account deletion** | In-app path plus web-accessible URL. Buyers: identity scrubbed, transactional records retained anonymised, reviews anonymised not deleted, active reservations released. **Sellers: see §16.9** — obligations block deletion and the keyed ID hash survives it. |

### 23.1 Localisation and script

Every layout must be validated in Ge'ez script before it ships. This is a launch requirement, not a polish item.

**Why it needs stating.** Amharic strings are typically longer than their English equivalents, Ge'ez characters have different height and line-spacing behaviour, and the character set is large enough that font loading is a measurable cost on a slow connection. A layout designed against English and translated afterwards breaks in ways nobody sees until a seller sends a screenshot.

**INVARIANT — no layout may assume a fixed string length, a single line of text, or a fixed-height container around translated content.**

**INVARIANT — the font stack declares a Latin family first and an Ethiopic family as fallback.** For example `Inter, "Noto Sans Ethiopic", sans-serif`. **No element may be given an Ethiopic-only family, including elements whose visible content is entirely Ge'ez.**

This is not a preference. A font covering only the Ethiopic block has no Latin letters, no digits and no punctuation, so on an Amharic screen it renders `ADULIS`, `TikTok`, `Instagram` and **every number** as missing-glyph boxes. That includes every published figure the product exists to show: completed handoff counts, stock timestamps, prices, order references. The page becomes unreadable in a way a reviewer who does not read Amharic will not notice, because the Ge'ez itself looks correct.

**INVARIANT — Amharic layout validation includes a Latin-and-digit legibility check.** At minimum, on any Amharic screen: the wordmark, both platform names, and at least one figure must render as characters, not boxes. A single missing-glyph box anywhere fails the gate.

Requirements:

- Every wireframe and every component is reviewed against **realistic Amharic strings**, not placeholder text. Highest priority: product cards, the payment instruction page, the New-seller disclosure, the reservation notifications, and every button label.
- **Ge'ez fonts are subsetted and cached aggressively.** Font weight counts against first paint on the low-end Android that is the binding performance constraint. Declaring the two families separately lets each carry its own `unicode-range`, so an English-only screen never downloads the Ethiopic file at all.
- **INVARIANT — translated strings are never assembled from concatenated fragments.** Each is a complete sentence with named slots. Word order differs between languages and fragment assembly produces text that is grammatically wrong in one of them.
- Numbers, currency, dates and times are formatted per locale, from the market configuration.
- Text expansion of at least 40% over English is assumed when sizing any container.

### 23.2 Empty states

**Every list surface defines an empty state.** These are the first screens a new user sees, and there are more first-time users than any other kind.

An empty state states plainly what will appear there, and offers the single action that makes it appear. It is never a bare icon, an apology, or a blank region.

Required at minimum:

| Surface | Who sees it |
|---|---|
| Seller: no products | Every seller, at signup |
| Seller: no orders | Every seller, until their first sale |
| Seller: no reviews | Every seller, until their first review |
| Seller: no chats, no claims, no team members | Ordinary steady state for most sellers |
| Seller: analytics with no data | Every seller in week one |
| Buyer: no orders | Every buyer who installs before reserving |
| Buyer: not following anyone | **Every buyer on first open** |
| Buyer: no notifications, no claims | Ordinary steady state |
| Storefront with no published products | Any seller mid-setup, and any seller after a downgrade |

**The buyer's empty following list deserves particular attention.** Adulis followers start at zero for everyone, so this state is the entire first experience of the following feed — for every buyer, permanently, since there are always new buyers. It must explain what following does and give the buyer a way to reach the sellers whose links brought them.

---

## 24. Test coverage required before launch

- Reservation state machine and its uniqueness constraint
- Stock decrement and release under concurrency
- Expiry job idempotency
- **Expiry does not fire on an order past `PAYMENT_CONFIRMED`**
- **Cart revalidation at order creation, for every failure mode: sold out, insufficient quantity, price changed, unpublished, variant withdrawn, seller unavailable**
- **Price immutability — a seller price change does not alter an existing order**
- **Partial cancellation: per-line stock release, per-line refund state, order total recalculation, cancellation-rate arithmetic**
- **Offline scan reconciliation: in-window late sync completes the order without re-decrementing stock; out-of-window sync does not advance trust level; replayed nonce is rejected; sync beyond the horizon is rejected**
- **Billing suspension leaves active orders fully operable**
- **Safety suspension with termination opens claims on paid orders rather than cancelling them**
- Payment SLA against active hours, including the retroactivity rule
- Active-hours change logging
- Review publication across all three evidence tiers, including where the seller refuses to scan
- Eligibility resolution across both phases and both verification paths
- **Trust level computation, promotion, demotion, and the distinct-buyer constraint**
- **New-level transaction cap enforcement**
- **New-seller disclosure rendering at the reservation step**
- Entitlement resolution as the intersection of tier and level
- Trial expiry and its ungameability
- RBAC enforcement on every state-changing endpoint, including negative cases per role
- Subscription state transitions and per-market rate locking
- Verification attestation write and image non-persistence
- **Payment evidence access logging fires for seller, team member and operator alike**
- **Payout change: step-up required, activation delay honoured, previous details remain in effect for new orders during PENDING, cancellation reverts cleanly**
- **Payout details captured on the order are not altered by a later payout change**
- **Payout change is blocked during the post-recovery cooling period**
- **Reissuing payment instructions requires step-up, notifies the buyer, resets the SLA and is logged**
- **RBAC: no role except Owner/Admin can view or change payout details**
- **Courier access is limited to currently assigned orders and ends with assignment**
- **Session revocation takes effect server-side immediately, not at token refresh**
- **Step-up is enforced server-side on every action listed in §6.5, including direct API calls**
- **Storefront search never returns a product from another seller, on any query, on any client**
- **A pasted post link resolves only within the seller that tagged it**
- **A shortened or redirecting post URL resolves to the same canonical identifier as the full URL**
- **A post link tagged on several products returns all of them, not one**
- **A post link claimed by more than one seller returns nothing and raises a moderation flag**
- **Seller lookup returns sellers only, never products, and never a seller the buyer did not search for**
- **App Links and Universal Links open the app on the correct storefront and product, and fall back to the web storefront when the app is absent**
- **No Adulis surface exposes or implies a per-post outbound product link** (§21.0)
- **Entitlement resolution treats `BETA` as a distinct state, not as $0 Listed, and grants the chatbot on all products** (§16.10)
- **Beta chatbot escalations reach the improvement loop and the identity-stripped phrase library** (§15.3, §16.10)
- **Every Amharic screen renders the wordmark, both platform names and at least one figure as characters, not missing-glyph boxes** (§23.1)
- **Courier custody transfer does not complete the order, advance trust level or enable a review**
- **A courier account cannot submit a buyer handoff scan**
- **Deferred follow: an anonymous web follow intent is claimed on first app open without a second prompt**
- **Publication readiness resolves server-side and blocks publishing for every listed condition**
- **Seller deletion is blocked by each unresolved obligation independently**
- **Seller deletion retains the keyed ID hash, anonymised reviews and moderation history**
- Person-to-seller-account identity linkage and duplicate ID detection across accounts
- QR token signing, offline validation and replay rejection
- Buyer cooldown escalation and decay
- Chatbot cascade routing and cap behaviour

Integration tests cover the full buyer journey from social link through web view, install, reserve, pay, scan, review. Load testing targets a realistic low-bandwidth Android profile.

---

## 25. Open items requiring a decision

| Item | Blocks |
|---|---|
| **Follower threshold** — not enforced during beta; the number the beta exists to discover (§4.1) | Eligibility configuration at paid launch |
| **Deleted or reposted source content** — what happens to a product whose tagged post no longer exists (§7.5.1) | Link resolution completeness |
| **Trust ladder thresholds** — how many scanned handoffs for Established and Trusted | Ladder implementation |
| **New-level caps** — product count and transaction value | Phase 2 |
| **Fulfilment window length** — how long a paid order may await handoff before it becomes a claim trigger (§9.2) | Order lifecycle completion |
| **Payout activation delay** — 24 hours is a starting value, not a measured one (§10.4) | Can ship at default; tune against observed behaviour |
| **Recovery cooling period** — 7 days is a starting value (§6.6) | Can ship at default |
| **Session lifetimes** — buyer and seller, per market (§6.4) | Can ship at a default; needs a number before build |
| **Deleted-number cooling period** before a phone number may open a new seller account (§16.9) | Can ship at a default |
| **Media retention period** for deleted accounts and unpublished products (§7.4) | Lifecycle policy configuration |
| **Offline scan sync horizon** — default 7 days, needs confirming against real handoff behaviour (§11.4) | Handoff implementation |
| **Refund acknowledgement window** — how long before an unacknowledged refund raises a claim (§10.4) | Claim triggers |
| **Beta-to-paid transition** — what happens to chatbot configuration, intent customisations and conversation history at conversion, and whether the 60-day trial runs in addition to the beta period or is consumed by it (§16.10) | First cohort conversion |
| **Web seller console scope and timing** — which Android seller capabilities move to web first, post-MVP (§3.0) | Business tier on web |
| **KYC vendor selection** and per-verification cost | Phase 2 economics |
| Counting platforms — two or five | Verification build |
| Hosting region — no cloud provider operates in Ethiopia | Infrastructure provisioning |
| Business tier API scope and rate limits | Business tier launch |
| VAT invoice format for company sellers | Paid launch |
| NBE category opinion | Custody roadmap |
| Delivery fee — who sets it, buyer visibility, whether Adulis records it | Courier module |
| Claim outcome matrix | Phase 3 |
| Trial conversion success criterion, written down in advance, per seller type | Paid launch |

---

*Binding product specification. The system design is drawn from this document. Security, payment, tax, consumer-protection and privacy reviews remain open.*
