# ADU-CON-01 — Seller Console: Source Analysis and Build Basis

**Version:** 1.0 · **Baseline date:** 26 August 2026
**Owner:** Founder / CEO (back-end) · COO/CTO (front-end)
**Status:** Analysis and build basis. **Not a binding specification.** ADU-CON-02 (system design) is drawn from this document; nothing here is buildable until §7's rulings are taken.
**Related:** ADU-PRD-01 v8.5 · ADU-DB-01 v1.6 · ADU-API-01 v1.3 · ADU-AUTH-01 v2.0 · ADU-ARCH-01 v2.0 · ADU-SEC-01 v1.0 · ADU-WEB-01 v1.0 · ADU-DPIA-01 v1.0 · ADU-PROJ-01 v9.0 · ADU-PD-01 v1.0

---

## 0. What this document is

Task 1 of the console workstream. It is a read of the six binding technical documents against one question:

> **What must the seller console contain, and what in the existing document set prevents it being built as written?**

It produces three things: an account of how the seller side actually works (§2), a complete capability inventory mapping every seller action to its permission, endpoint and database function (§4), and a findings register of the contradictions and gaps that block the system design document (§5–§6).

**The series.** ADU-CON-01 analysis (this) → **ADU-CON-02** system design and architecture → **ADU-CON-03** content architecture → **ADU-CON-04** wireframe generation brief → build → **ADU-CON-05** security, QA and test specification.

**What this document deliberately does not do.** It proposes no technology, no folder structure and no screen. Those belong in ADU-CON-02 and ADU-CON-03 and would be guesses if written before §7 is answered.

---

## 1. The finding that comes before everything else

### F1 — The seller console is no longer post-MVP, and no document says so yet

ADU-PRD-01 v8.5 is unambiguous, and it is now wrong:

| ADU-PRD-01 v8.5 | Says |
|---|---|
| §3, client matrix | Seller shop setup and operations: web **Post-MVP**, Android **Yes** |
| §3.0 Step 1 | **"INVARIANT — there is no web sign-in at MVP."** Every seller operation happens in the Android app |
| §3.0 Step 3 | The full seller console is post-MVP, and *"until then those capabilities exist on Android only"* |
| §25 open items | *"Web seller console scope and timing — which Android seller capabilities move to web first, post-MVP"* |

ADU-ARCH-01 **v2.0** reverses every line of that:

| ADU-ARCH-01 v2.0 | Says |
|---|---|
| §1 | **"The Companion makes sellers fast. The PWA makes sellers capable."** The console is Create, Configure, Manage, Administer |
| §3.1 | The Companion's Phase 1 is **four surfaces**: notifications, order detail, inbox, mode switcher. Nothing else |
| §3.4 | **"INVARIANT — no action in ADU-PRD-01 §6.5 is reachable from the mobile app"** — enforced by `core.permission.surfaces`, not by hidden UI |
| §6.3 | *"ADU-PRD-01 §3.0's 'INVARIANT — there is no web sign-in at MVP' is gone."* |
| §9 | ADU-PRD-01 → v8.6: *"§3 client matrix rebuilt; §3.0 rewritten"* |

**The consequence nobody has written down.** Onboarding is console-only. Walk ADU-PRD-01 §4.6's ten publication-readiness items against ADU-ARCH-01 §3.1's four Companion surfaces:

| Readiness item | Reachable from the Companion? |
|---|---|
| Account created | Yes — sign-in exists on both |
| Seller type declared | **No** |
| Eligibility satisfied | **No** |
| Identity verification | **No** — §3.4 puts identity changes on the console |
| Company details and representative verification | **No** |
| Store profile — name, description, category | **No** |
| Payout details | **No** — `seller.payout:update` is `{SELLER_WEB}` by `CHECK` |
| Active hours | **No** |
| Fulfilment configuration | **No** |
| At least one product created | **No** |

**Nine of ten. A seller cannot become a seller without the console.**

> **RULING R1 — the seller console moves into Phase 1 (controlled beta) scope and onto the critical path.** It is not a post-MVP convenience; it is the only surface on which a beta seller can be onboarded at all. ADU-PROJ-01 §11 phase 1 and ADU-PRD-01 §3 must be rewritten to say so.
>
> **Consequences accepted with the ruling:**
> - ADU-PROJ-01 §8.3's engineering budget absorbs a fourth surface. ADU-ARCH-01 §9 already flags §8.3 for rewrite under the two-developer split; this is the reason.
> - ADU-PRD-01 §25's *"web seller console scope and timing"* open item is closed by this ruling rather than deferred: the scope is everything except what §3.1 grants the Companion, and the timing is before the first beta seller.
> - ADU-SEC-01 §7's prerequisite becomes binding immediately — nonce-based `script-src` with no `unsafe-inline` **before the console takes its first authenticated session**, not before paid launch.

---

## 2. How the seller side works — nine loops

Reconstructed from the binding documents rather than from any single one, because no document contains the seller's path end to end.

### Loop 1 — Admission

`waitlist.application` → founder review → account (phone OTP) → `core.seller` in `DRAFT` → eligibility evaluation → `seller_level_state` at `NEW` → readiness → publish.

- **Eligibility is configuration, not code.** `core.fn_evaluate_eligibility(seller_id, at)` reads `core.eligibility_config` at that instant. Phase 2 is `audience_required = false` in a new effective row (DB §7.4).
- **No follower threshold is enforced during the beta.** `follower_threshold` is nullable and null means no threshold — not zero (PRD §4.1, DB §5.3).
- **Two paths, and one must be satisfied before any product publishes.** Audience (account-control code posted to TikTok/Instagram, fetched and matched, follower count captured with a timestamp) or Identity (KYC vendor; **no image ever reaches Adulis** — there is no column for one).
- **Entering the ladder is a trigger on the eligibility evaluation**, `ON CONFLICT DO NOTHING`, so re-evaluation never resets a seller who has climbed (DB §8.1).
- **Readiness is one function returning ten rows.** `core.fn_publication_readiness` returns `(item, satisfied, resolving_action)`. The client renders; it computes nothing. Failure emits `seller_publication_blocked` from inside the function, so the funnel data cannot be lost to a code path that forgot to log.

**What the console owes this loop:** a persistent, returnable readiness surface — not a wizard. PRD §4.6 is explicit that a seller leaves and returns across days, and that abandoned setup is indistinguishable in the funnel from a seller who never wanted the product.

### Loop 2 — Catalogue

Product → variants → attributes → media → social posts → publish.

- **Price lives on the variant.** `product.base_price_minor` is a **seed** copied into a new variant and read by nothing else (C1). Appendix C check 3 greps for it.
- **Two attribute layers.** Product-level descriptive attributes are what make the chatbot free (cascade layer 0); variant-defining attributes are what distinguish one variant from another, enforced by composite FK.
- **`variant_key`** is a trigger-written canonical serialisation; two variants of one product cannot carry the same attribute combination.
- **Media is signed-URL then commit**, never a proxied multipart body. Five images maximum as a `UNIQUE (product_id, position)` fact. One video, ≤480p, ≤30s, compressed on the device. **No `original_key` column exists.** No transcoding.
- **Publication limit is the intersection** of tier limit and level limit — `billing.fn_effective_limit(seller_id, 'PRODUCT_COUNT')`. A New seller on Business publishes at the New limit.
- **Downgrade unpublishes, never deletes**, and the seller chooses which survive.

### Loop 3 — Stock and confidence

- **`stock_count` is not writable.** It is maintained only by an `AFTER INSERT` trigger on `core.stock_event`, and a `BEFORE UPDATE` guard raises on any other path. `CHECK (stock_count >= 0)` makes over-selling a transaction failure rather than a negative number.
- The endpoint takes a `delta` **or** an absolute `count`; in both cases the server writes an event. The count is never assigned.
- **Confidence is a view, never a column** — five levels off `stock_confirmed_at`, because a stored level drifts the moment a job misses a run.
- ⚠ **Level 3 is inert on Free tier** (its consequence is chatbot hedging, and Free has no chatbot). DB §10.2 flags this; the console's explanation of stock confidence must not promise a consequence the reader's tier cannot experience.

### Loop 4 — The order, which is never accepted

```
CREATED → NOTIFIED → PAYMENT_SUBMITTED → PAYMENT_CONFIRMED → HANDED_OFF → COMPLETED
```

> **INVARIANT — no seller action gates a reservation** (ARCH-01 §3.2). Stock decrements at order creation. Nothing waits on the seller. **There is no "Accept reservation" and it must not be built.**

The seller's only actions on a live order are *view* and **Can't Fulfil** (a per-line cancel that feeds the published cancellation rate). Two state machines, not one: order-level terminal state is **derived** from lines; `REFUNDED` exists only at reservation level.

- **The 48-hour clock stops permanently at `PAYMENT_CONFIRMED`**, enforced twice — a `CHECK` on `clock_stopped_at`, and the absence of any `EXPIRED_UNCLAIMED` transition from a post-payment state.
- **Cancellation arithmetic is per line.** Cancelling two of three lines is two cancellations, not one.
- **The buyer may cancel the remainder without penalty**, and `penalty_exempt` is set automatically by a trigger — not by a support request.

### Loop 5 — Payment, where the seller is the verifier

> **INVARIANT — the action is "Confirm Payment Received", never "Accept Payment"**, accompanied by *"Verify the payment in your own bank or payment account before confirming."* Adulis never asserts that a payment is genuine, and the label must not imply otherwise (ARCH-01 §3.3, PRD §10.1).

- **Payout details are captured onto the order**, never referenced live (§8.5). A payout change mid-order reroutes nothing.
- **The buyer's payment instructions come from exactly one function** — `financial.render_payment_instructions(order_id, actor)` — which verifies the caller is the buyer, verifies the order is payable, writes the access log **in the same transaction**, then decrypts. The endpoint performs none of those checks itself.
- **Evidence viewing is logged for the seller identically to an operator.** Seller access requires no justification; `reason` is nullable precisely for that, and the row is written all the same.
- **A payment confirmed without the evidence ever being opened is a normal path**, because the seller's primary check is their bank app (ARCH-01 §3.3). `financial.access_log` will show fewer reads than confirmations. An auditor needs to know that is expected.
- **Rejection returns the order to `NOTIFIED`** with the clock still running — an inference DB §12.2 had to make, recorded as write-back W6. First rejection opens a 12-hour retry window; the second ends the order (API §12.11).

### Loop 6 — Handoff, two events and two clocks

**Event A** (seller → courier) never completes an order, never counts toward level, never enables a review. It has no column for any of those and no trigger reaching those tables.

**Event B** (buyer scans the seller's or courier's QR) is the only event producing buyer-facing evidence. A composite foreign key to `("order".id, buyer_account_id)` makes a courier scan structurally impossible.

**The split that matters, and it is the subtlest rule in the system:**

| Test | Governs | Clock |
|---|---|---|
| `corrected_at` inside the reservation window | Order completion | **Device**, skew-corrected, floored at `order_qr_token.issued_at` |
| `received_at` inside window + `level_credit_grace` (24h) | Level credit | **Server** |

Completion trusts the device because getting it wrong hurts a buyer who has their goods and no record. Level credit trusts the server because getting it wrong corrupts the only real differentiator. ⚠ This contradicts ADU-PRD-01 §11.4 as written and is recorded as **W11**.

### Loop 7 — Trust

`core.fn_recompute_seller_level` has **no `UPDATE` grant to the app role**, and its body references `handoff_scan`, `review`, `claim` and `ladder_config` — **and no billing table**. There is no join path from a subscription to a level, so no generated code can create one. Every change writes an append-only event with `CHECK (source <> 'MODERATION' OR moderation_event_id IS NOT NULL)`.

`core.seller_public_stats` is materialized and contains **only numbers, dates and three level names**. No free-text column exists, so a published statistic cannot hold an accusation.

⚠ **ADU-DPIA-01 §7.4 rates the ladder as automated decision-making with significant effect, and R11 is open: there is no human review route.** That review path is an authorization concern as much as a privacy one (AUTH §18) — it is how a person contests a machine-made restriction on their livelihood. **It has no surface anywhere in the document set.** See F6.

### Loop 8 — Failure

- **One open claim per scope**, enforced by a partial unique index. A trigger firing against an already-open claim **appends evidence rather than opening a second claim** — otherwise one seller failure demotes three times under §14's unconditional rule.
- **Evidence is attached at claim time, not export time**, and opening a claim sets `retention_reason = 'OPEN_CLAIM'` on the payment evidence in the same transaction, which is what stops the purge job destroying the only proof.
- **Billing suspension never cancels an active order.** Existing-order operations check `status <> 'SAFETY_SUSPENDED'`; forward-looking ones check `status = 'ACTIVE'`.
- **Safety suspension terminating a paid order opens a claim rather than cancelling** — which is why `claim.opened_by_kind` admits `SYSTEM`.

### Loop 9 — Administration

Everything in ADU-PRD-01 §6.5, and all of it is console-only by `CHECK` constraint:

`seller.payout:update` · `seller.orders:reissue_instructions` · `seller.staff:admin` · `seller.subscription:update` · `seller.account:delete` · `seller.sessions:revoke_all` — plus `seller.ownership:transfer` and `seller.identity:manage`.

**The payout change is the highest-value target in the system** and carries five stacked controls: step-up bound to action *and* target, a 24-hour activation delay during which the previous details remain in effect, an unsuppressible notification to the registered number and every Owner/Admin, an immutable log, and the order snapshot that makes the change retroactively harmless. **Cancelling requires no step-up — reverting must always be easier than changing.**

---

## 3. The gates, restated as one build rule

ADU-AUTH-01 §14 gives four gates. There are five checks in practice and they fire in this order:

| # | Gate | Question | Mechanism | Failure |
|---|---|---|---|---|
| 0 | **State** | Is the seller suspended or closing? | `seller.status` | 409 `SELLER_UNAVAILABLE` |
| 1 | **Role** | May this person do this for this seller? | `core.role_permission` | 403 `PERMISSION_DENIED` |
| 2 | **Surface** | May they do it from *here*? | `core.permission.surfaces` | 403 `PERMISSION_DENIED` — **identical body** |
| 3 | **Entitlement** | Does the tier ∩ level include it? | `billing.fn_effective_limit` | 409 `TIER_LIMIT_REACHED` |
| 4 | **Scope** | Is this object actually theirs? | Composite FK / RLS | **404**, never 403 |

> **Build rule for ADU-CON-02:** `core.fn_has_permission(account, seller, permission, audience)` is the **first statement of every seller-scoped writing function**, and the console never reimplements any of the five. The console hides controls for ergonomics; the server refuses them for correctness. A control hidden and permitted is the failure ADU-PRD-01 §16.2 names.

**Three consequences the front-end must be told explicitly, because they are counter-intuitive:**

1. **`roles[]` from `/v1/auth/otp/verify` is a rendering hint only.** Never an authorization input.
2. **The active seller context is a request parameter, never session state** (AUTH §8.3). Two stores in two tabs, context switched in one, action taken in the other, lands on the wrong store — and here that means confirming the wrong payment.
3. **A 403 never says which gate stopped you.** Telling a caller which one tells an attacker which to work on.

---

## 4. Capability inventory

Every seller capability, its permission, its endpoint and its function. **✗ = specified nowhere.** M = Companion-reachable. § = step-up.

### 4.1 Onboarding and identity

| Capability | Permission | Endpoint | Function |
|---|---|---|---|
| Create seller | — | `POST /v1/seller` | ✗ named |
| Readiness | — | `GET /v1/seller/readiness` | `fn_publication_readiness` |
| Store profile | `seller.store:write` | `PATCH /v1/seller/profile` | ✗ named |
| **Company details** | `seller.store:write` | **✗** | ✗ |
| Link social account | `seller.identity:manage` § | `POST /v1/seller/social-accounts` | ✗ named |
| Verify account control | `seller.identity:manage` § | `POST .../{id}/verify` | ✗ named |
| Identity verification | `seller.identity:manage` § | `POST /v1/seller/identity-verification` | `verification.write_attestation` |
| Availability | `seller.availability:write` | `PUT /v1/seller/availability` | ✗ named |
| **Fulfilment configuration** | **✗** | **✗** | **✗** |

⚠ **Fulfilment configuration is a readiness item (§4.6) and a `READINESS_ITEM` code (`FULFILMENT_CONFIG`) with no table, no endpoint and no definition anywhere in the document set.** It is the only readiness item that cannot be satisfied.

### 4.2 Catalogue and stock

| Capability | Permission | Endpoint | Function |
|---|---|---|---|
| List / create / edit products | `seller.products:read` · `:write` | `GET · POST · PATCH /v1/seller/products` | ✗ named |
| **Read one product** | `seller.products:read` | **✗** | — |
| Publish | `seller.products:publish` | `POST .../{id}/publish` | `fn_publish_product` |
| **Unpublish** | `seller.products:publish` | **✗** | **✗** |
| **Delete product** | `seller.products:write` | **✗** | ✗ |
| Create variant | `seller.products:write` | `POST .../{id}/variants` | ✗ |
| **Edit / withdraw variant** | `seller.products:write` | **✗** | ✗ |
| Upload images | `seller.media:write` | `POST .../{id}/images` | ✗ |
| **Delete / reorder images** | `seller.media:write` | **✗** | ✗ |
| Upload video | `seller.media:write` | `POST .../{id}/video` | ✗ |
| Attach social post | `seller.products:write` | `POST .../{id}/social-posts` | ✗ |
| Set stock | `seller.stock:write` | `POST /v1/seller/variants/{id}/stock` | insert `stock_event` |
| Confirm stock | `seller.stock:write` | `POST .../confirm-stock` | ✗ |
| **Stock history** | `seller.stock:read` | **✗** | — |
| Bulk operations | `seller.stock:bulk_write` | **✗** — Business tier, deferrable | — |

### 4.3 Orders, payment, handoff

| Capability | Permission | Endpoint | |
|---|---|---|---|
| List orders | `seller.orders:read` | `GET /v1/seller/orders` | **M** |
| **Read one order** | `seller.orders:read` | **✗** | **M** |
| Confirm payment received | `seller.payment:confirm` | `POST .../payment/confirm` | **M** |
| Payment not received | `seller.payment:confirm` | `POST .../payment/reject` | **M** |
| View evidence | `seller.payment_evidence:read` | `GET .../payment-evidence` | **M** |
| Can't fulfil (per line) | `seller.orders:respond` | `POST .../reservations/{rid}/cancel` | **M** |
| Mark ready | `seller.order_ready:update` | **✗** | **M** |
| Order QR | `seller.handoff:read` | `GET .../qr` | **M** |
| Custody transfer | `seller.handoff:custody_transfer` | `POST .../custody-transfer` | |
| Assign courier | `seller.couriers:manage` | `POST .../courier-assignment` | |
| **Manage couriers** | `seller.couriers:manage` | **✗** | |
| Report refund | `seller.refunds:report` | `POST .../refunds` | |
| Reissue instructions | `seller.orders:reissue_instructions` § | `POST .../reissue-instructions` | |

⚠ **`seller.order_ready:update` is a Phase 1 Companion grant (ARCH-01 §3.1, DB §6.9a) with no endpoint, no order state and no column.** "Mark ready" appears in the Companion's order-detail surface and exists nowhere else. Either it is a first-class state or it is not in Phase 1.

### 4.4 Feedback, messaging, analytics

| Capability | Permission | Endpoint |
|---|---|---|
| Inbox | `seller.messages:read` · `:send` | `GET · POST /v1/conversations…` **M** |
| **Seller-scoped review list** | `seller.reviews:read` | **✗** |
| Claims | `seller.claims:read` · `:respond` | `GET /v1/claims` · `POST /v1/seller/claims/{id}/remedy` |
| **Analytics — any** | `seller.analytics.basic:read` · `.full:read` · `:export` | **✗ — nothing** |
| **Notification list** | `seller.notifications:read` | **✗** |
| **Notification preferences** | `seller.notifications.preferences:write` | **✗** |
| **Report content** | — | **✗** |
| Chatbot / flows / broadcasts | `seller.chatbot:*` · `seller.broadcasts:send` | **✗** — Business/Pro, deferrable |

⚠ **Analytics has zero endpoints.** Every tier including Free is promised analytics (PRD §16.1), `analytics.event` is fully specified with 68 seeded definitions, and no seller can read any of it.

⚠ **Content reporting has zero endpoints.** ADU-PRD-01 §18: *"report mechanism on **every** piece of user content"*, app-store-mandated, build in V1. `core.content_report` exists. Nothing reaches it.

### 4.5 Administration

| Capability | Permission | Endpoint |
|---|---|---|
| Read payout (last4) | `seller.payout:read` | `GET /v1/seller/payout` |
| Change payout | `seller.payout:update` § | `POST /v1/seller/payout` |
| Cancel pending | `seller.payout:read` | `DELETE /v1/seller/payout/pending` — **no step-up** |
| **Payout history** | `seller.payout:read` | **✗** |
| Team | `seller.staff:admin` § | `GET · POST · DELETE /v1/seller/team` |
| **Ownership transfer** | `seller.ownership:transfer` § | **✗** — permission is new in AUTH-01 v2.0 |
| Subscription | `seller.subscription:update` § | `GET /v1/billing/subscription` · `POST /v1/billing/purchase-intent` |
| Sessions | — · `seller.sessions:revoke_all` § | `GET · DELETE /v1/auth/sessions` · `POST .../revoke-others` |
| Closure (reversible) | `seller.account:delete` | `POST · DELETE /v1/seller/closure` |
| Deletion | `seller.account:delete` § | `GET .../deletion/blockers` · `POST /v1/seller/deletion` |

---

## 5. Findings register

**F1 — the console is on the critical path.** §1. Ruled.

### F2 — `session_audience` is two values in one document and three in another, and the console's auth layer sits on the difference

| Document | Values |
|---|---|
| ADU-DB-01 v1.6 §6.6, Appendix A | `MOBILE` · `SELLER_WEB` · `COURIER_WEB` |
| ADU-API-01 v1.3 §4 | same three |
| **ADU-AUTH-01 v2.0** §5, §8.1, §9.1, §17, §24 | **`MOBILE` · `CONSOLE`** throughout |

ADU-AUTH-01 §12 recommends collapsing `COURIER_WEB` into `CONSOLE` on the grounds that the courier restriction is row-level security keyed on `current_setting('adulis.actor_role')` — **resolved per request, not per session** — so a separate audience buys nothing and forces a person who is both courier and seller to hold two logins for one account. §25 records it as an ADU-DB-01 v1.7 change *"if §12 is accepted."*

**It has not been accepted, and meanwhile ADU-AUTH-01 §17 and §24 state the `CHECK` as `surfaces = '{CONSOLE}'` while ADU-DB-01 §6.9a's actual DDL says `ARRAY['SELLER_WEB']`.** One of the two is wrong in a constraint that guards the payout boundary.

> **RULING R2 — accept ADU-AUTH-01 §12. Two audiences: `MOBILE` and `CONSOLE`.** The argument is correct and the cost of carrying a distinction that does no work is a second login for a courier who also sells — a case ADU-PRD-01 §6.3 explicitly calls ordinary.
>
> **Consequences:** ADU-DB-01 → v1.7 (`session_audience` enum, the `step_up_is_web_only` `CHECK`, every `surfaces` array, the `permission` seed). ADU-API-01 → v1.4 (§4's surface table, every **M** marking's counterpart). One migration, taken before any permission row is seeded, or it is a data migration afterwards.

### F3 — The console's credential is specified in two documents and absent from the contract

ADU-API-01 §5 specifies opaque bearer tokens without qualifying the browser case. ADU-SEC-01 §4 and ADU-AUTH-01 §5.1 both require an httpOnly `__Host-adulis_session` cookie for the console and bearer for mobile, and **both flag it as a change ADU-API-01 has not absorbed.**

This is not cosmetic. `localStorage` under XSS is *"stolen in one line"*; the console holds payout access; the `__Host-` prefix is what makes host-scoping enforced by the browser rather than by our discipline.

> **RULING R3 — two credential presentations, chosen by surface.** Cookie (`__Host-`, HttpOnly, Secure, SameSite=Strict, Path=/, no Domain) for `CONSOLE`; `Authorization: Bearer` for `MOBILE`. Both opaque and stateful; never a JWT. **ADU-API-01 → v1.4 §5 records it before the console's auth layer is written.**

### F4 — ADU-API-01 §12.12 contradicts ADU-API-01 §4.1 on the billing group

§4.1 reinstates the In-App Purchase constraint in full force: *"no endpoint reachable from `MOBILE` returns a price, a tier name, or a URL to a billing surface. The billing group is `SELLER_WEB` only, and a mobile session receives 403 rather than a redirect — a redirect is itself a link to an external purchase mechanism."*

§12.12's trailing paragraph — carried unchanged from v1.2 — still reads: *"The billing endpoints are ordinary console endpoints… **There is no seller app**, and the restriction has nothing left to restrict."*

An agent building the billing group from §12.12 omits the audience guard, and the omission is invisible until an App Store reviewer finds a price in a mobile response.

> **RULING R4 — strike §12.12's trailing paragraph in ADU-API-01 v1.4 and replace it with §4.1's rule.** The three billing endpoints carry `surfaces = '{CONSOLE}'` in `core.permission` and return 403 to a mobile session.

### F5 — ADU-DB-01's two boundary read functions still take the actor's role as a parameter

ADU-AUTH-01 §20.2 identifies this as a defect in ADU-DB-01 and is right about it:

```sql
verification.read_attestation(p_person_id, p_actor, p_actor_role text, p_reason)
financial.read_payment_evidence(p_evidence_id, p_actor, p_actor_role text, p_reason)
```

`p_actor_role` is written straight into the access log. **The most contested field in the row is the one the reader supplies.** Deriving it instead closes a second hole quietly: with no grant lookup the function *authorises nothing* — it logs a read it was going to perform anyway. Derive the role and the same query becomes the authorization check. **No grant, no row.**

**The console is the primary caller of `read_payment_evidence`.** Building the evidence viewer against the current signature builds the defect into the surface that uses it most.

> **RULING R5 — adopt ADU-AUTH-01 §20.2's fix in ADU-DB-01 v1.7 before the evidence viewer is built.** `INVARIANT — actor_role in either access log is derived server-side from the caller's actual grants and is never a function parameter.` ADU-API-01 §13's function mapping updates with it.

### F6 — There is no operator surface, and four documented workflows have nowhere to happen

Moderation (PRD §18), claim review (§14), identity verification (§13.1), account recovery (§6.6) and the DPIA's required human-review route for the trust ladder (§7.4, R11) all describe an operator making a decision. **Nothing defines what an operator is** — no table, no roles, no grants, no surface. ADU-AUTH-01 §20.1 requires `core.operator_grant` before the beta and observes: *"A founder holding all five is fine. A founder holding all five because none exist is not."*

ADU-PRD-01 §2 lists "admin" in V1 scope. No document designs it.

> **RULING R6 — the operator console is a separate deployment on its own origin, and it is out of scope for ADU-CON-02.**
>
> **Why separate rather than a role-gated area of the seller console.** The seller console is seller-scoped: every call carries a `seller_id` validated against a seller relationship (AUTH §8.3). An operator has no seller relationship, so mixing operator grants into it means the scope model has two shapes in one codebase — and it widens the blast radius of a console XSS from one seller's payout to every seller's identity attestations. ADU-SEC-01 §3's separation argument applies with more force here, not less.
>
> **What is in scope for ADU-CON-02:** `core.operator_grant` as a table in ADU-DB-01 v1.7 (table count 105 → 106; Appendix C check 14 moves with it), and the five roles seeded. The surface is ADU-OPS-01, sequenced after the beta cohort is onboarded but **before the first non-founder operator.**

### F7 — Availability: three documents disagree, and one contradicts itself

| Source | Says |
|---|---|
| ADU-PRD-01 §4.6, §10.2 | **Minimum 8 hours per day.** SLA is 1 hour **counted only within active hours**. The window in force at submission governs. Every change to an immutable log |
| ADU-DB-01 §13.1 | Renamed `core.seller_availability`, **no longer versioned**, **informational only**, **1-hour minimum**, **zero windows is valid**, *"the retroactivity rule is deleted"*, `active_hours_version_id` **dropped**, SLA is **wall-clock** |
| ADU-DB-01 §13.2 | `core.payment_submission` column list **still contains `active_hours_version_id`** |
| ADU-API-01 §12.9 | *"Informational. One hour to a full day, several windows per day, zero windows valid. No change log"* |

ADU-DB-01 v1.6 contradicts itself one section apart. And if zero windows is valid, the `ACTIVE_HOURS` readiness item (API §7.1) checks nothing.

> **RULING R7 — ADU-DB-01 §13.1 governs. Availability is informational, minimum one hour per window, zero windows valid, no change log, wall-clock SLA.** The reasoning is sound: most beta sellers are creators without a shopfront, and an eight-hour minimum required premises from people who do not have any.
>
> **Three corrections follow:** (a) delete `active_hours_version_id` from ADU-DB-01 §13.2's column list; (b) rewrite ADU-PRD-01 §4.6 and §10.2 to match, and strike the two §24 tests that covered retroactivity; (c) **remove `ACTIVE_HOURS` from the readiness item set** — API-01 §7.1's ten codes become nine — because a state that is always satisfied is not a gate, and leaving it in teaches a seller that a satisfied row means something.

### F8 — The state machine is unratified and blocks every live market

ADU-DB-01 §12.2.1: 24 rows seeded with `ratified_at IS NULL`; `fn_guard_market_live` refuses to set a market live while any row is unratified. Build proceeds; launch does not. Three questions carry written recommendations that need adopting, not re-deriving:

| | Question | Recommendation as written |
|---|---|---|
| **R-1** | Late in-window scan completing an expired order (rows 11, 24) | **Ratify both**, `reason = 'LATE_SYNC_RECOVERY'` + reconciliation `StockEvent` |
| **R-2** | Buyer paid, seller never responded, order expires (row 6) | **Ratify, and open a `SYSTEM` claim in the same transaction** |
| **R-3** | Mixed cancellation (rows 17, 18) | **`CANCELLED_BY_SELLER` whenever any line was seller-cancelled or refunded** |

> **RULING R8 — adopt all three recommendations as written and ratify the 24 rows.** Each is reasoned in ADU-DB-01 and none is contested by another document. This is a founder decision costing one migration, and leaving it open means the console is built and cannot be launched behind.
>
> ⚠ **R-2 has a dependency: write-back W7.** ADU-PRD-01 §14's first claim trigger reads *"payment confirmed with no seller response within SLA"* — but the §10.2 SLA is the **confirmation** SLA, so it must mean payment **submitted**. As written the trigger describes a state in which the SLA has already been met. Fix W7 in the same pass or R-2's claim never fires.

### F9 — ADU-DB-01 §26's invariant matrix carries two rows the architecture retired

| Row | Status |
|---|---|
| *"§3 — iOS app has no seller functionality — no enum value for an iOS seller session audience"* | **Stale.** ADU-ARCH-01 v2.0 puts the Seller Companion on iOS. The surviving invariant is *no §6.5 action reachable from `MOBILE`*, and its mechanism is `core.permission.surfaces` |
| *"§3.0 — No web sign-in at MVP"* | **Stale.** ADU-ARCH-01 §6.3 removes the invariant. The mechanism survives on its own merits — a deletion OTP still cannot mint a session — but it no longer enforces the row it is filed under |

> **RULING R9 — correct both rows in ADU-DB-01 v1.7.** An invariant matrix carrying a retired invariant is worse than one that omits it: a reviewer checking the mechanism finds it present and passes a rule that no longer exists.

### F10 — The seller inbox and the buyer inbox are the same endpoint

`GET /v1/conversations` is marked **M** and shared between buyer and seller. One account holds both roles (ARCH-01 §2), and ADU-AUTH-01 §8.3 requires the active seller context to be an explicit per-request parameter. Nothing says whether the endpoint returns a seller's conversations, a buyer's, or both interleaved.

> **RULING R10 — `GET /v1/conversations` requires an explicit scope parameter: `?as=buyer` or `?as=seller&seller_id=…`.** No default. A defaulted scope on this endpoint is the two-tab bug of §8.3 in list form.

### F11 — The console is a PWA and authenticated reads are `no-store`

ADU-API-01 §9: authenticated reads are `private, no-store` — *"an order response contains bank details under C3 and must never enter a shared cache."* ADU-SEC-01 §5.2 permits `worker-src 'self'` for the PWA service worker and notes that a poisoned service worker is persistent XSS surviving reload.

ADU-ARCH-01 §5 resolves the offline question in the console's favour: the QR is cached by the **native app**, Event A has **no offline requirement**, and the courier "needs one screen and will not install anything."

> **RULING R11 — the console service worker caches the application shell and static assets only. It never caches an authenticated API response, and it holds no offline queue.** Offline capability in this product belongs to the mobile app's scan capture, and nowhere else (API §14).

### F12 — Documents to reissue before ADU-CON-02 is written

| Document | To | Carries |
|---|---|---|
| **ADU-DB-01** | **v1.7** | R2 (audience enum, `CHECK`, `surfaces`), R5 (derived role), R7(a) (`payment_submission`), R8 (ratification), R9 (matrix), F6 (`operator_grant`, 106 tables), AUTH-01 §25's `timing_config` and `account` additions, `core.permission` + `role_permission` seeded from the AUTH §15/§16 catalogue |
| **ADU-API-01** | **v1.4** | R3 (credentials), R4 (billing audience), R10 (conversation scope), the §6 gap register, derived-role function mapping |
| **ADU-PRD-01** | **v8.6** | R1 (§3, §3.0), R7(b) (§4.6, §10.2, §24), W1–W11 already listed in ADU-DB-01 §29, ADU-AUTH-01 §25's §16.2 role matrix and ownership transfer |
| **ADU-PROJ-01** | **v9.1** | R1 (§11 phase 1), §8.3 two-developer rewrite, recovery SLA (AUTH §10) |
| **ADU-ARCH-01** | — | No change. It is the document the others must catch up to |

---

## 6. Endpoint gap register

**28 endpoints the console requires and ADU-API-01 v1.3 does not specify.** Grouped by whether they block the beta.

### Blocking — the console cannot ship without them

| # | Endpoint | Note |
|---|---|---|
| 1 | `GET /v1/seller/orders/{id}` | Order detail. Needed by the console **and** by the Companion's Phase 1 order surface |
| 2 | `GET /v1/seller/products/{id}` | |
| 3 | `POST /v1/seller/products/{id}/unpublish` | §7 requires it on downgrade and by seller choice |
| 4 | `DELETE /v1/seller/products/{id}` | |
| 5 | `PATCH /v1/seller/variants/{id}` | Price, status, attributes |
| 6 | `DELETE /v1/seller/variants/{id}` | Withdraw — a `VARIANT_WITHDRAWN` cart error code already exists for it |
| 7 | `DELETE /v1/seller/products/{id}/images/{n}` | |
| 8 | `PUT /v1/seller/products/{id}/images/order` | `UNIQUE (product_id, position)` makes reordering a transaction, not two writes |
| 9 | `PATCH /v1/seller/company-details` | `COMPANY_DETAILS` readiness item has no write path |
| 10 | `POST /v1/seller/orders/{id}/ready` | Or delete `seller.order_ready:update` from the Phase 1 grants |
| 11 | `GET /v1/seller/notifications` | `seller.notifications:read` |
| 12 | `POST /v1/reports` | **App-store mandated** (§18): report on every piece of user content |
| 13 | `POST /v1/events` | Referenced by API §11 for the two client-observed events; never catalogued |
| 14 | `GET /v1/seller/analytics/overview` | Views, reservations, conversion — the Free/Beta grant |

### Required for the console to be "the full management system"

| # | Endpoint |
|---|---|
| 15 | `GET /v1/seller/reviews` — seller-scoped, with badge and item ratings |
| 16 | `GET /v1/seller/variants/{id}/stock-events` — stock history; also `STOCK_EVENTS` claim evidence |
| 17 | `GET /v1/seller/payout/history` — §10.4 requires the pending change *"visible in the seller console and in the account history"* |
| 18 | `GET · POST · DELETE /v1/seller/couriers` — `seller.couriers:manage` (3 endpoints) |
| 21 | `PATCH /v1/seller/notification-preferences` |
| 22 | `GET /v1/seller/analytics/full` · `POST /v1/seller/analytics/export` (2) |
| 24 | `POST /v1/seller/ownership-transfer` **§** — new permission in ADU-AUTH-01 v2.0, no endpoint, no function |
| 25 | `GET /v1/seller/claims` — seller-scoped; `GET /v1/claims` is buyer-shaped |

### Deferrable — Business/Pro tier, post-beta

| # | Endpoint |
|---|---|
| 26 | `POST /v1/seller/broadcasts` — `fn_send_broadcast` exists |
| 27 | `PUT /v1/seller/chatbot/answers` |
| 28 | `POST /v1/seller/stock/bulk` |

**79 → roughly 104 endpoints.** That number, not the screen count, is the honest size of the back-end task.

---

## 7. Decisions required before ADU-CON-02 can be written

Eleven rulings are proposed above. **Under the standing convention, a default applies unless overridden** — so silence on R1–R11 is acceptance, and ADU-CON-02 will be written against them.

**Four things are not rulings I can take, because they need information I do not have:**

| # | Question | Blocks | Note |
|---|---|---|---|
| **Q1** | **Product hosting.** No major cloud operates an Ethiopian region. Whatever is chosen must offer `pgvector`, `btree_gist`, `pg_trgm`, `pgcrypto` — some managed providers do not offer `vector` | ADU-CON-02 §deployment, and provisioning | ADU-PROJ-01 §10 and ADU-DB-01 §3.1 both flag it. It cannot be deferred past the architecture document because connection pooling, backup posture and the `SECURITY DEFINER` role model all depend on whether Postgres is managed or self-managed |
| **Q2** | **What is fulfilment configuration?** A readiness item, a `READINESS_ITEM` code, and nothing else | The tenth readiness item, and one console screen | Options: delivery zones, handoff methods, courier default, or "collection point + delivery yes/no". A decision, not a lookup |
| **Q3** | **Does "mark ready" exist?** It is a Phase 1 Companion grant with no state, column or endpoint | Endpoint 10, and the order state machine's ratification | If yes it is a column on `order` and a legal transition; if no, delete the permission before `core.permission` is seeded |
| **Q4** | **SMS provider and secondary.** ADU-AUTH-01 §6 requires an adapter, **a second provider configured before launch**, and voice fallback after the second failed resend. Nothing is chosen | Not ADU-CON-02's architecture, but it is on the same critical path as the console — a seller who cannot receive an OTP cannot use the console at all, and it shows up as churn rather than as a defect |

---

## 8. What the console is not

Recorded here so it does not accrete during build.

- **Not a place where a reservation is accepted.** No accept action, on any screen, ever (ARCH-01 §3.2).
- **Not a payment verifier.** Adulis never asserts a payment is genuine. The console displays evidence and records the seller's own decision.
- **Not a level-setting surface.** No manual promotion or demotion. The recompute function has no `UPDATE` grant and touches no billing table.
- **Not a review-moderation surface.** *"A seller can never prevent a review from publishing."* There is no seller-writable column on `review` — no `hidden`, no `approved`, no `visible`.
- **Not a discovery surface.** Storefront search is scoped to exactly one seller; seller lookup returns sellers, never products; the feed is a query, not a recommender.
- **Not an operator surface.** F6.
- **Not offline-capable.** F11.
- **Not a place a bulk reissue exists.** §8.5 permits reissue on a single named order; an endpoint accepting an array would be that rule broken at the wire while the database still believed it held.

---

*Analysis and build basis. Eleven rulings proposed, four questions open. The largest finding is F1: the seller console has moved from post-MVP to the critical path without any document recording it, and nine of the ten publication-readiness items are reachable from nowhere else. The second largest is the endpoint gap register — the API contract specifies 79 endpoints and the console needs roughly 104. ADU-CON-02 is written against the rulings in §5 and cannot be written at all until Q1–Q3 are answered.*
