# ADU-API-01 — Adulis API Contract

**Version:** 1.3 · **Baseline date:** 24 August 2026
**Owner:** Founder / CEO (back-end) · COO/CTO (front-end)
**Status:** Binding API contract. Drawn from ADU-DB-01 v1.6 and ADU-ARCH-01 v2.0. **Under the two-developer split this is a contract between two people, not documentation for an agent.**
**Supersedes:** ADU-API-01 v1.2
**Related:** ADU-DB-01 v1.3 · ADU-PRD-01 v8.5 · ADU-PROJ-01 v9.0 · ADU-WEB-01 v1.0

> Where this document and ADU-PRD-01 disagree on **product behaviour**, the PRD governs. Where this document and ADU-DB-01 disagree on **enforcement**, ADU-DB-01 governs. This document governs the **wire**: what a client may send, what it will receive, and what it may assume.

> **The central rule.** Every state-changing endpoint calls a named function in ADU-DB-01. No endpoint writes a table directly where a function exists. An invariant enforced in a NestJS service is an invariant a second endpoint can bypass.

---

## 0. What this document is

ADU-DB-01 establishes what is true in the database. This document establishes what a client can do about it.

It exists because the gap between those two is where most of the defects will be. The database refuses an illegal transition; the API decides what the buyer sees when that happens, whether a retry produces a second order, and whether the error can be rendered in Amharic. None of that is a database question, and none of it is currently written down anywhere.

**Reading order:** ADU-00 → ADU-PROJ-01 → ADU-PRD-01 → ADU-DB-01 → ADU-API-01.

**Scope:** V1 as defined in ADU-PRD-01 §2, across four client surfaces. Out of scope: V3 discovery, advertising, Crowd Commerce, Group Buying, delivery, the Business-tier public API (§16.2 — read-mostly, scoped tokens, specified separately when Business tier ships).

**Count:** 79 endpoints in 14 groups. The catalogue is §12; the function mapping is §13.

---

## 0.1 What changed in v1.3

v1.3 carries ADU-ARCH-01 **v2.0**: Telegram is removed, and the Adulis mobile app gains a **Seller Companion mode**. Seller endpoints become reachable from a native app again.

| Area | v1.2 | v1.3 |
|---|---|---|
| **Telegram group** | §12.15, five endpoints | **Deleted** |
| **Surfaces** | `BUYER_APP` · `SELLER_WEB` · `COURIER_WEB` | **`MOBILE` · `SELLER_WEB` · `COURIER_WEB`.** One mobile session serves both modes |
| **Version skew (§3.1)** | Buyer apps only — the console updates on reload | **Applies to every endpoint the Companion reaches.** Seller endpoints are back inside a pinned client |
| **In-App Purchase** | Deleted — no seller app existed | **Reinstated in full force.** §4 |
| **Surface scoping** | Absent | Every seller endpoint carries **M** where the Companion may reach it |

**Two reversals worth naming**, because v1.2 removed both and they are back:

**§3.1's additive-only rule governs seller endpoints again.** v1.2 halved the versioning burden on the grounds that the console is a PWA that updates on reload. **The Companion is a store-distributed app**, so every endpoint it reaches now has pinned old clients in the field — and under the two-developer split it also has a colleague mid-sprint on the other side.

**The IAP constraint is a design constraint again.** v1.2 deleted it because there was no seller app to police. §4 reinstates it, with the specific trap that ADU-ARCH-02 §4 identified.

**Counts:** 84 → **79** endpoints, 15 → **14** groups.

**Everything not listed above is carried forward from v1.2 unaltered.**

---

## 0.2 What changed in v1.2 — retained for history

v1.2 carries ADU-ARCH-01: **the seller has no native app.** The console is a PWA, notifications and quick actions run through a Telegram bot, and the iOS and Android apps are buyer-only.

| Area | v1.1 | v1.2 |
|---|---|---|
| **Surfaces** | Four, including a seller app and a separate `WEB_PURCHASE` session | **Three.** `BUYER_APP` · `SELLER_WEB` · `COURIER_WEB` |
| **In-App Purchase machinery** | An invariant, a separate audience, and a six-screen surface unreachable from the apps | **Deleted.** There is no seller app to keep purchase out of |
| **Version skew (§3.1)** | Applied to every client | **Buyer apps only.** The console updates on reload, so seller endpoints need no pinned-version support |
| **Telegram** | Absent | **New endpoint group §12.15**, `actor_channel` on every seller write |
| **OTP resend** | One endpoint, idempotency-keyed | **Split** — X11 |
| **Ratification reference** | `payment/reject` cited R-3 | **W6 and row 8.** R-2 is closed by the confirmation-window ruling — X9 |
| **Function mapping** | Two functions named and undefined | **Both defined in ADU-DB-01 v1.5** — X10 |

**The largest simplification is one that stopped being needed rather than one that was solved.** ADU-PRD-01 §3 carried an INVARIANT plus a paragraph of machinery to keep subscription purchase away from the apps — *"not a link, not a WebView, not an 'upgrade' prompt"* — a distinct session audience, and a surface a seller had to find by leaving the app. All of it existed because a seller app existed. None of it survives.

**Everything not listed above is carried forward from v1.1 unaltered.**

---

## 0.2 What changed in v1.1 — retained for history

v1.1 takes four of the six gaps from a stated default to a complete specification, answers the UTC question raised in review, and specifies the two tables the contract requires.

| Area | v1.0 | v1.1 | Section |
|---|---|---|---|
| **A1 error contract** | Envelope shape only | **Closed code taxonomy, mechanical key derivation, and a CI gate that fails when either locale catalogue is missing a key** | §7.1–§7.3 |
| **A3 batch scan sync** | Request and response shape | **Per-item transactions, deterministic ordering, size cap, and idempotent retry that returns the original outcome rather than a replay rejection** | §12.6.1 |
| **A4 anti-enumeration** | Posture | **Concrete limits, and the crawler tension named** | §10.1 |
| **A6 push delivery** | TTL and an authoritative order card | **Collapse key plus an actively displacing payment-confirmation notification** | §11.1 |
| **A5 device clock** | Bounded, residual accepted | **UTC answered.** Epoch-millis rule added; the residual is unchanged and is not a UTC problem | §1 A5 |
| **Two new tables** | Named | **Specified in full** | §16 |
| **iOS seller functionality** | Design note | **Confirmed: release-checklist item, not an API control** | §4 |

**One correction to v1.0.** §12.6 said a retried sync of an already-accepted nonce returns `REJECTED_REPLAY`. That conflates a device retrying its own scan with an attacker replaying a token, and would have shown a buyer *"rejected"* for a handoff that actually succeeded. The discriminator is the signed payload, not the nonce. Corrected in §12.6.1.

**Everything not listed above is carried forward from v1.0 unaltered.**

---

## 1. Gaps found, and how they are resolved

Six things a client needs that no existing document specifies. Each carries a default; **accepting a default requires no reply.**

Three of these are not API conveniences — they are places where a guarantee ADU-DB-01 makes is not observable by the client, which means it is not a guarantee the product actually delivers.

### A1 — There is no error contract, and three features separately require one

ADU-PRD-01 §8.3 requires a reconciliation step listing *every* failing cart line and what changed. §4.6 requires publication readiness returned as a complete list with the action resolving each item. §16.9 requires deletion blockers listed exactly. Three multi-item structured failures, and nothing says they share a shape — so an app built from the PRD alone renders three of them.

Worse: if the API returns English prose, none of it can be localised. ADU-PRD-01 §23.1 makes translated strings per-locale resources assembled from named slots, never fragments — an error body carrying `"Only 2 left in stock"` breaks that invariant at the one moment the buyer most needs to understand what happened.

> **Resolved in v1.1.** One error envelope for the whole API, RFC 9457 Problem Details extended with an `items[]` array. **Every item carries a `message_key` and a `slots` object, never rendered prose.** The code set is closed, the key is derived mechanically from the code, and a CI gate fails the build when either locale catalogue is missing an entry. Specified in §7, §7.1–§7.3.

### A2 — A retry on a flaky connection creates a second order

The binding constraint is a low-end Android on a slow connection (§23). Retries are the normal case, not the exception: the buyer taps Reserve, the request succeeds, the response is lost, they tap again.

ADU-DB-01's `reservation_no_duplicate_active` exclusion constraint catches the single-line case. It does not catch a two-line order, and even where it fires the buyer receives a constraint violation rather than the order they already have.

> **Default.** An `Idempotency-Key` header, required on every state-changing `POST`. A replayed key returns the original response unchanged. Specified in §8.
>
> ⚠ **This requires one new table**, `core.idempotency_record`. Feedback to ADU-DB-01 in §16.

### A3 — Batch scan sync has no specified shape, and partial failure is the normal case

§11.4 governs an offline scan by its signed timestamp and defines four outcomes. It says nothing about how scans reach the server. A courier who was offline all afternoon uploads six scans at once, of which one is a replay, one is beyond the horizon and four are valid.

Failing the whole batch loses four verified handoffs to one bad row. Succeeding the whole batch hides two rejections from a seller whose trust level depends on them.

> **Resolved in v1.1.** `POST /v1/handoffs/sync` accepts an array and returns a per-item outcome. **It never fails as a unit.** HTTP 200 with individual results, never 207 — a partial-success status code that most HTTP clients treat as an error is worse than no status code at all. Each item is processed in its own transaction, order is deterministic, and a retry of an identical signed payload returns the **original** outcome rather than a replay rejection. Specified in §12.6.1.

### A4 — The storefront is anonymous by design, which makes it enumerable

The web storefront is the conversion surface and must stay public (§3.1). It also publishes exactly the data a competitor wants: seller handle, trust level, completed handoff count, cancellation rate, product catalogue and prices (§13.2). ADU-PRD-01 §23 requires rate limiting on auth, OTP, reservation, claim and proposal endpoints — the storefront is not on that list.

The distinction that matters is **scraping one storefront** versus **enumerating all of them**. The first is what a browser does and cannot be prevented. The second builds a competitor's target list of every seller on Adulis, ranked by how well they are doing.

> **Resolved in v1.1.** Prevent enumeration, accept scraping. Concrete limits and the crawler tension are in §10.1.
> - **INVARIANT — no internal UUID appears in any public URL.** Storefronts and products are addressed by handle and slug. A UUIDv7 is time-ordered, so a UUID in a public URL leaks signup order and admits walking the space.
> - No endpoint returns a list of sellers without a caller-supplied query. `seller_lookup` caps results and never suggests (§7.6 already requires this — here it is also an anti-enumeration control).
> - Anonymous reads are rate limited at the Cloudflare edge, matching ADU-WEB-01's decision; authenticated writes at the origin.

### A5 — The scan timestamp that governs is signed by a device the buyer controls

**INVARIANT — the signed timestamp inside the scanned token governs, not the moment the scan reaches the server** (§11.4). The device signs locally at the moment of scanning.

A buyer who sets their phone clock back can therefore assert an in-window scan on an order that expired, and a valid in-window scan counts toward the seller's trust level (§11.3). The attack needs a colluding buyer, which is exactly the shape §5.2's anti-gaming rules already assume. §5.2 limits how often one buyer can help one seller; it does nothing about *when* they can claim to have done it.

**Does calculating in UTC fix this?** No — and the reason is worth stating precisely, because UTC fixes a *different* problem that is easy to conflate with this one.

UTC is a question about what a timestamp **means**. A5 is a question about whether a timestamp is **true**. A device that will emit a false local timestamp will emit a false UTC one just as readily; the attacker controls the clock, not the format.

What UTC does buy is real and worth having, because it removes the **common** case:

- ADU-DB-01 §4 and ADU-PRD-01 §23 already require every stored timestamp to be UTC. That is correct and unchanged.
- Cheap Android devices frequently carry a **correct NTP-synced UTC clock with a misconfigured timezone.** An app that builds its timestamp from local calendar components inherits the misconfiguration; one that reads epoch milliseconds directly does not. **So most honest clock errors disappear the moment the client stops constructing time from local components** — which is a real gain, and the majority of what would otherwise look like A5 in the logs.
- Adversarial skew is what remains, and it is unaffected.

> **INVARIANT — a client timestamp is epoch milliseconds read directly from the system clock, never assembled from local date and time components.** The signed scan payload carries an integer, not a formatted string, so there is no timezone to get wrong and no parser to disagree with.

**And on the seller's publish time: the question does not arise.** `published_at` is written server-side by `core.fn_publish_product`. No client supplies it, no client can influence it, and there is no signed-token equivalent. The scan timestamp is the *only* time value in the system that originates on a device the platform does not control — which is exactly why it is the only one that needed A5.

> **Resolution.** Bound the adversarial case rather than pretend it is closed.
> - `CHECK (signed_at >= order_qr_token.issued_at)` — a scan cannot predate the token it scanned. This alone caps backdating at the order's own lifetime.
> - The client sends its observed clock offset from the last successful `/bootstrap`. **Disagreement is recorded as a signal, never a rejection** — a genuinely wrong clock is common on cheap devices and must not cost an honest buyer their order.
> - `received_at - signed_at` is already stored; a distribution that shifts for one seller feeds `level_velocity_flag`.
>
> **The residual is real and should be stated in ADU-PRD-01 §5.2 rather than discovered later:** a seller with one colluding buyer and a manipulated clock can manufacture verified handoffs within the sync horizon. The distinct-buyer rule limits the rate; nothing eliminates it, because the evidence originates on a device the platform does not control.

### A6 — "No notification past PAYMENT_CONFIRMED" is a send guard, and delivery is asynchronous

**INVARIANT — no notification is sent for an order past `PAYMENT_CONFIRMED`** (§17.3). ADU-DB-01 implements this at dispatch: the sender re-reads order state immediately before handing the message to the transport.

FCM then delivers whenever the device next has connectivity. A buyer whose payment is confirmed four minutes after dispatch still receives *"Your order from Alem is released in 2 hours."* The database honoured the invariant; the buyer experienced it being broken.

> **Resolved in v1.1, and more completely than v1.0 managed.** v1.0 only narrowed the window. The fix is to **displace** the stale message rather than wait for it to expire: every notification for an order carries the same collapse key, and confirming a payment sends a payment-confirmation notification on that key — which supersedes any expiry warning still queued at the transport or still sitting in the buyer's tray. Specified in §11.1.
>
> Data-only pushes composed locally after a state re-read would close the race completely, and are rejected: Android throttles them hard in Doze, which is precisely the low-end device the product targets.

---

## 2. API doctrine

1. **Every endpoint maps to a named ADU-DB-01 function.** Where none exists, the endpoint is a plain read. No endpoint reimplements an invariant.
2. **The client computes nothing.** §23: *"Clients display state and send intents; they never compute expiry, eligibility, level or entitlement."* The API returns resolved state, never the inputs to a client-side decision.
3. **Every failure is machine-readable and localisable.** A `message_key`, never prose.
4. **Every write is idempotent from the client's point of view.**
5. **No internal identifier is public.** Handles and slugs on the wire; UUIDs behind authentication.
6. **The wire is additive within a major version.** A field is added, never removed or repurposed, because two app versions are always in the field.
7. **Authorisation is server-resolved per request.** No claim in a token is trusted for authorisation.
8. **Payload size is a feature.** The binding constraint is first paint on a slow connection; a storefront response that carries fields nobody renders costs the conversion the site exists to produce.

---

## 3. Transport and versioning

**REST/JSON over HTTPS with HSTS.** OpenAPI 3.1 generated from NestJS decorators, published to the repository as the client's source of truth.

**Rejected: GraphQL.** Query cost is caller-determined, which is the wrong property when the binding constraint is a slow connection and the binding engineering constraint is a beginner developer. N+1 resolution against a single Postgres is the specific failure ADU-PROJ-01 §13.5 warns about.

**Rejected: tRPC.** End-to-end types are attractive with TypeScript on both ends, but it has no versioning story, and the store-review problem below makes explicit versioning mandatory rather than optional — for the buyer apps, which is now the only place it binds.

### 3.1 The version-skew problem nobody has written down

ADU-PROJ-01 §9.2 budgets two to three store rejection rounds. Ethiopian buyers on low-end Android with metered data frequently do not auto-update. **Several app versions will be live simultaneously, for months, and the oldest cannot be assumed to have been updated at all.**

Three consequences, all binding:

**Under ADU-ARCH-01 v2.0 this applies to every endpoint the mobile app reaches — which now includes the seller endpoints marked M.** v1.2 exempted seller endpoints on the grounds that a PWA updates on reload; the Companion is store-distributed, so those endpoints have pinned old clients in the field again. **Endpoints reachable only from `SELLER_WEB` may still change freely** — but under the two-developer split even those changes are a conversation rather than an edit, because the front-end consumes them days later.

**INVARIANT — within `/v1`, changes are additive only.** No field is removed, renamed, or has its meaning changed. A field that must change gets a new name alongside the old one.

**INVARIANT — every response is valid against the schema every supported client version holds.** A client ignores fields it does not know.

**A minimum supported version exists and is enforced at `/bootstrap`, not at the endpoint.** A client below the floor receives an upgrade instruction once, at launch, rather than an incomprehensible failure at the moment it tries to reserve.

```
GET /v1/bootstrap
→ 200 {
    "server_time": "2026-08-24T09:14:02Z",
    "min_supported_client": "1.4.0",
    "client_status": "OK" | "UPGRADE_RECOMMENDED" | "UPGRADE_REQUIRED",
    "market": { "code": "ET", "display_currency": "ETB", "timezone": "Africa/Addis_Ababa" },
    "locales": ["en", "am"],
    "feature_flags": { ... }
  }
```

`server_time` is load-bearing, not a convenience: it is the reference the client uses to compute the clock offset A5 requires.

### 3.2 Headers

| Header | Direction | Required | Purpose |
|---|---|---|---|
| `Authorization: Bearer <token>` | → | Authenticated endpoints | Opaque session token (§5) |
| `Idempotency-Key` | → | Every state-changing `POST` | §8 |
| `X-Adulis-Client` | → | Always | `android/1.6.2`, `ios/1.4.0`, `web/2026-08-24` |
| `X-Adulis-Device` | → | App clients | Registered `device_id` (§6.4 of ADU-DB-01) |
| `X-Adulis-Clock-Offset` | → | App clients | Milliseconds, device minus server, from last bootstrap. A5 |
| `Accept-Language` | → | Always | `en` or `am`; server echoes the resolved locale |
| `X-Adulis-Request-Id` | ← | Always | Correlates a client report to a server log |

---

## 4. Surfaces

Three callers, and the differences between them are enforced, not documented.

| Surface | Auth | May call |
|---|---|---|
| **Public web** (Next.js, Cloudflare) | None | Anonymous reads only, plus the deletion OTP flow |
| **Mobile app** (React Native, iOS + Android) | Session, `audience = MOBILE` | Buyer groups, **plus the seller endpoints marked M** |
| **Seller PWA** | Session, `audience = SELLER_WEB` | Every seller and billing group |
| **Courier PWA** | Session, `audience = COURIER_WEB` | Courier group only |

**One account, two modes.** ADU-PRD-01 §6.3 already holds that *"one person may hold buyer, seller, team member and courier roles on the same phone number. Roles are relationships, not accounts."* A mobile session therefore reaches buyer endpoints and Companion endpoints without switching identity, and **a seller acting as a buyer creates a buyer transaction** — orders reference `buyer_account_id` and nothing consults whether that account also owns a store.

**INVARIANT — surface is checked in the database, not in a service.** `core.fn_has_permission(account, seller, permission, audience)` takes the calling audience and `core.permission.surfaces` decides. An endpoint cannot grant a capability the surface may not exercise, because the check happens below the endpoint.

**INVARIANT — no §6.5 step-up action is reachable from `MOBILE`.** Payout changes, reissued instructions, team changes, subscription purchase, seller deletion, revoking sessions. A mobile session presenting at one receives **403**, from the permission function, before endpoint logic runs.

### 4.1 In-App Purchase — a design constraint again

ADU-PRD-01 §3: *"**INVARIANT — subscription purchase never happens inside either app.** No prices, no purchase flow, no link to purchase. This is what keeps the apps outside Apple's In-App Purchase and Google Play Billing requirements, both of which would take 15–30% in card rails incompatible with manual ETB bank transfer."*

v1.2 deleted this because there was no seller app. **It is reinstated.**

> **INVARIANT — no endpoint reachable from `MOBILE` returns a price, a tier name, or a URL to a billing surface.** The billing group is `SELLER_WEB` only, and a mobile session receives 403 rather than a redirect — **a redirect is itself a link to an external purchase mechanism.**

**Where a mobile response must convey a tier limit**, it names the capability and where it is configured — `"custom_flows_configured_in_console"` — **never a tier and never a route to change one.** This is why §7's error contract returns `message_key` and `slots` rather than prose: the client renders from its own catalogue, and no server string can leak a price into a screen Apple reviews.

⚠ **Store rules in this area move.** The shape of the risk is stable; the permissible wording is not. Worth a paid review before first submission.

---

## 5. Authentication and session

**Opaque bearer tokens, not JWTs.** ADU-DB-01 §6.6 requires the session row to be read on every authenticated request, because revocation must take effect immediately rather than at next refresh. A JWT invites exactly the optimisation that breaks that rule, and its only advantage — stateless validation — is one this system has already declined.

```
POST /v1/auth/otp/request     { phone, purpose: "SIGN_IN" }        → 202
POST /v1/auth/otp/verify      { phone, code, audience, device_id } → 200 { token, expires_at, roles[] }
```

`roles[]` describes what the account *is* — buyer, seller-owner, team member on N sellers, courier for N sellers. It is a **rendering hint only**. Authorisation is resolved server-side per request through `fn_has_permission`; a client that hides a control based on `roles[]` and a server that permits the call anyway is the failure §16.2 forbids.

**INVARIANT — an OTP with purpose `ACCOUNT_DELETION` cannot mint a session.** Enforced in the database (§6.5 of ADU-DB-01); the endpoint surfaces it as `otp_purpose_not_permitted` rather than a 500.

Sessions: `GET /v1/auth/sessions` · `DELETE /v1/auth/sessions/{id}` · `POST /v1/auth/sessions/revoke-others` (step-up required).

---

## 6. Step-up

The six actions in §6.5 take a step-up challenge **as a body parameter**, never as ambient middleware state.

```
POST /v1/auth/step-up/request  { action: "PAYOUT_CHANGE", target_ref } → 202
POST /v1/auth/step-up/verify   { challenge_id, code }                  → 200 { challenge_id, satisfied_at }
```

Then, on the protected call:

```
POST /v1/seller/payout
  { bank_code, account_number, account_name, step_up_challenge_id: "..." }
```

**Why a parameter and not middleware.** ADU-DB-01 §6.7: the writing function takes the challenge id as an argument, so a code path that omits it does not compile. A middleware guard is a decorator someone forgets on the seventh endpoint, and the omission is invisible until it is exploited.

**INVARIANT — cancelling a pending payout change requires no step-up** (§10.4). Reverting must always be easier than changing.

---

## 7. The error contract

One envelope. RFC 9457 Problem Details plus `items[]`.

```json
{
  "type": "https://adulis.example/errors/cart-revalidation-failed",
  "title_key": "error.cart.revalidation_failed",
  "status": 409,
  "code": "CART_REVALIDATION_FAILED",
  "request_id": "01J...",
  "items": [
    {
      "code": "INSUFFICIENT_STOCK",
      "subject": { "kind": "CART_LINE", "id": "..." },
      "message_key": "error.line.insufficient_stock",
      "slots": { "requested": 3, "available": 1, "product_name": "Canvas tote" },
      "resolving_action": { "kind": "REDUCE_QUANTITY", "to": 1 }
    },
    {
      "code": "PRICE_CHANGED",
      "subject": { "kind": "CART_LINE", "id": "..." },
      "message_key": "error.line.price_changed",
      "slots": { "was_minor": 45000, "now_minor": 52000, "currency": "ETB" },
      "resolving_action": { "kind": "ACCEPT_NEW_PRICE" }
    }
  ]
}
```

**INVARIANT — no error body contains rendered prose in any language.** `message_key` plus `slots` only. §23.1 makes translated strings per-locale resources with named slots and forbids fragment assembly; an English error string is that invariant broken at the worst possible moment. `title_key` follows the same rule.

**INVARIANT — `items[]` is complete.** Where the operation failed on several counts, every one is present. §8.3 requires the buyer to see everything that changed at once; a first-failure response makes them discover the second on the retry.

**Three features share this shape**, which is the point of specifying it once:

| Endpoint | `items[].kind` | Source |
|---|---|---|
| `POST /v1/orders` | `CART_LINE` | §8.3 revalidation |
| `GET /v1/seller/readiness` | `READINESS_ITEM` | §4.6 — **returns 200, not an error.** Readiness is a state, not a failure |
| `GET /v1/seller/deletion/blockers` | `OBLIGATION` | §16.9 — also 200 |

**Status codes.** 400 malformed · 401 no or invalid session · 403 authenticated but not permitted, including wrong audience · 404 not found or not visible to this caller · 409 state conflict, including every illegal transition and every revalidation failure · 410 gone, for a deleted seller's storefront · 422 semantically invalid · 429 rate limited, with `Retry-After` · 503 with `Retry-After` on planned unavailability.

**Illegal state transitions return 409 with `code: "ILLEGAL_TRANSITION"` and the two states in `slots`.** The database raises `restrict_violation` (§12.2 of ADU-DB-01); the API translates rather than leaking a Postgres error, and never presents it as a 500 — it is a conflict, and a client can act on it by refetching.

### 7.1 The code taxonomy is closed

**INVARIANT — `code` is drawn from the list below and from nowhere else.** A code invented in a service is a code with no catalogue entry, which renders to the buyer as a generic apology in the one moment they needed to be told what to do.

**Adding a code within `/v1` is additive** — old clients render it through the §7.2 fallback — but it is a change to this document, not a decision taken in a pull request.

| Group | Codes |
|---|---|
| **Auth** | `OTP_INVALID` · `OTP_EXPIRED` · `OTP_ATTEMPTS_EXCEEDED` · `OTP_PURPOSE_NOT_PERMITTED` · `SESSION_EXPIRED` · `SESSION_REVOKED` · `AUDIENCE_NOT_PERMITTED` · `RECOVERY_REQUIRED` |
| **Step-up** | `STEP_UP_REQUIRED` · `STEP_UP_EXPIRED` · `STEP_UP_ACTION_MISMATCH` |
| **RBAC** | `PERMISSION_DENIED` · `OWNER_ONLY` |
| **Cart** | `CART_EMPTY` · `CART_SELLER_CONFLICT` · `CART_REVALIDATION_FAILED` |
| **Cart line items** | `INSUFFICIENT_STOCK` · `SOLD_OUT` · `PRICE_CHANGED` · `NO_LONGER_PUBLISHED` · `VARIANT_WITHDRAWN` · `SELLER_UNAVAILABLE` · `TRANSACTION_CAP_EXCEEDED` |
| **Order** | `ILLEGAL_TRANSITION` · `ORDER_NOT_PAYABLE` · `ORDER_ALREADY_TERMINAL` · `DUPLICATE_RESERVATION` · `BUYER_COOLDOWN_ACTIVE` |
| **Payment** | `EVIDENCE_REQUIRED` · `EVIDENCE_TOO_LARGE` · `PAYMENT_ALREADY_DECIDED` · `NOT_ORDER_BUYER` |
| **Handoff** | `SCAN_SIGNATURE_INVALID` · `SCAN_PREDATES_TOKEN` · `SCAN_NOT_ORDER_BUYER` · `COURIER_CANNOT_SCAN` |
| **Seller** | `PUBLICATION_BLOCKED` · `ELIGIBILITY_NOT_SATISFIED` · `TIER_LIMIT_REACHED` · `LEVEL_LIMIT_REACHED` · `ACTIVE_HOURS_TOO_SHORT` · `HANDLE_TAKEN` |
| **Payout** | `PAYOUT_LOCKED_RECOVERY` · `PAYOUT_CHANGE_PENDING` · `PAYOUT_PERMISSION_DENIED` |
| **Deletion** | `DELETION_BLOCKED` · `DELETION_OWNER_ONLY` |
| **Request** | `VALIDATION_FAILED` · `IDEMPOTENCY_KEY_MISSING` · `IDEMPOTENCY_KEY_REUSED` · `RATE_LIMITED` · `CLIENT_UPGRADE_REQUIRED` · `PAYLOAD_TOO_LARGE` |

**Two item-code sets that are not errors** but share the `items[]` shape, because §7's whole point is that the client renders one component:

- **Readiness** (`GET /v1/seller/readiness`, 200): `ACCOUNT_CREATED` · `SELLER_TYPE_DECLARED` · `ELIGIBILITY_SATISFIED` · `IDENTITY_VERIFIED` · `COMPANY_DETAILS` · `STORE_PROFILE` · `PAYOUT_DETAILS` · `ACTIVE_HOURS` · `FULFILMENT_CONFIG` · `AT_LEAST_ONE_PRODUCT` — the ten items of §4.6, in that order.
- **Obligations** (`GET /v1/seller/deletion/blockers`, 200): `OPEN_RESERVATIONS` · `EVIDENCE_AWAITING_CONFIRMATION` · `AWAITING_HANDOFF` · `REFUNDS_OUTSTANDING` · `OPEN_CLAIMS` · `SUBSCRIPTION_PAST_DUE` — the six of §16.9, each independently reported.

### 7.2 Keys are derived, not invented

**INVARIANT — `message_key` is `error.<group>.<code in lower snake case>`.** `INSUFFICIENT_STOCK` in the cart-line group is always `error.cart_line.insufficient_stock`. Nothing else.

The key is therefore **mechanically derivable from the code**, which is the property that matters: the server and the two locale catalogues cannot drift into disagreement about naming, and §7.3's gate can be a script rather than a review.

**Slots are typed primitives, never pre-formatted text.** Money is `{ amount_minor, currency }`. Timestamps are RFC 3339 UTC. Counts are integers. **The server never formats a number, a date or a currency** — formatting is per-locale and belongs to the client, and a server-formatted `"45.00 ETB"` is a fragment by another name (§23.1).

**INVARIANT — an unknown key renders a generic message and logs the key. It never renders the raw key path.** This mirrors ADU-WEB-01 §8.3: a missing translation degrades to something a person can read, never to `error.cart_line.insufficient_stock` displayed on a phone.

**Every envelope carries `retryable: true | false`.** Whether the client may offer *"try again"* is a server decision — `SOLD_OUT` is not retryable, `RATE_LIMITED` is, and a client guessing gets it wrong in whichever direction is more annoying.

### 7.3 The catalogue completeness gate

**INVARIANT — CI fails when any code in §7.1 lacks an entry in both the English and the Amharic catalogue.**

This is the smallest useful piece of ADU-WEB-01 §8.3's translation gate made mechanical. The alternative is discovering a missing Amharic error string when a seller sends a screenshot of a blank dialog, which is exactly the failure mode §8.2 warns about — the Ge'ez looks correct, so a reviewer who does not read Amharic never notices what is absent.

Two consequences worth accepting:

- **A new code cannot ship without its Amharic string.** That is friction, and it is the point.
- **Machine-translated placeholders satisfy the gate.** The gate checks presence, not quality; ADU-WEB-01 §8.3's human-translation requirement is a separate, later gate and this one does not discharge it.

---

## 8. Idempotency

**INVARIANT — every state-changing `POST` requires an `Idempotency-Key` header.** A request without one is rejected 400. Not optional, because the failure it prevents — a duplicate order on a retried request — is silent, expensive and hits the buyers on the worst connections hardest.

Mechanics:

- Key is a client-generated UUIDv7, scoped to `(account_id or device_id, endpoint)`.
- First use: the response is stored with the request hash.
- Replay with the same key **and the same request hash**: the stored response is returned unchanged, with `X-Adulis-Idempotent-Replay: true`.
- Replay with the same key and a **different** hash: 409 `IDEMPOTENCY_KEY_REUSED`. The client has a bug, and silently serving the old response would hide it.
- Records expire after 24 hours — longer than any plausible retry, shorter than any storage concern.

`PATCH` and `DELETE` on a specific resource are naturally idempotent and do not require a key.

**One consequence worth stating.** The stored response is returned *as it was*, not recomputed. A buyer who retries after the seller has since cancelled a line sees the original success and then the current state on their next read. That is correct: the API is answering *"did my request succeed?"*, and it did.

---

## 9. Pagination, caching and payload

**Cursor pagination everywhere. No offset, anywhere.** The following feed is recency-ordered over a set that changes while the buyer pages (§17.2); offsets duplicate and skip. Cursor is an opaque base64 of `(sort_key, id)`.

```
GET /v1/feed?limit=20&cursor=eyJ0IjoiMjAyNi0...
→ 200 { "data": [...], "next_cursor": "...", "has_more": true }
```

`limit` defaults to 20, caps at 50. The cap is an anti-enumeration control as much as a performance one (A4).

**Caching.** Anonymous storefront reads carry `ETag` and `Cache-Control: public, max-age=60, stale-while-revalidate=300`, served from the Cloudflare edge. Authenticated reads are `private, no-store` — an order response contains bank details under C3 and must never enter a shared cache.

**Payload budget.** A storefront first-page response targets **under 40KB** uncompressed. It carries the seller header, published statistics, and the first twelve products with thumbnail URLs only. Card and full derivatives are fetched by the image layer, not embedded. This is a number to measure against, not an aspiration — it is the response standing between a bio-link tap and a conversion on a slow connection.

---

## 10. Rate limiting

Two tiers, matching ADU-WEB-01's decision for the website.

| Tier | Where | Applies to |
|---|---|---|
| **Edge** | Cloudflare rules, by IP and ASN | All anonymous reads: storefront, search, seller lookup, post-link resolution |
| **Origin** | Postgres token bucket, by account and by phone | OTP request, session creation, order creation, claim filing, message sending, evidence upload, step-up request |

§23 of ADU-PRD-01 requires origin limiting on auth, OTP, reservation, claim and proposal endpoints. **OTP is limited by phone number as well as by account**, because the account does not exist yet when the abuse happens.

⚠ **The origin limiter needs one new table**, `core.rate_limit_bucket`. Feedback to ADU-DB-01 in §16, along with the accepted cost: one small write per limited request, on top of the session read, on a single Postgres. Affordable at the modelled volume and worth measuring before it is not.


### 10.1 Anti-enumeration — the concrete posture

A4's distinction: **scraping one storefront is what a browser does and cannot be prevented. Enumerating all of them builds a competitor's target list of every Adulis seller, ranked by how well each is doing.** Only the second is worth engineering against.

**The tension to name before designing around it.** Storefronts are meant to be indexed. A bio link resolves to a page whose job is to prove value and drive an install (§3.1), and a search engine finding that page is a free version of the same job. **So aggressive bot detection works against the product**, and any control here has to be one a well-behaved crawler passes. That rules out CAPTCHAs, JS challenges and user-agent blocking on storefront routes, and leaves shape and rate.

**Structural controls — these do the real work.**

| Control | Rule |
|---|---|
| **No internal identifier is public** | Storefronts are `/{handle}`, products `/{handle}/{slug}`. UUIDv7 is time-ordered; a UUID in a public URL leaks signup order and admits walking the space |
| **No unqualified list endpoint exists** | There is no `GET /v1/sellers`, no `GET /v1/storefronts`, and no sitemap enumerating sellers beyond what the seller themselves has published |
| **Lookup requires intent** | `seller_lookup` takes a minimum 2-character query, returns at most 10, and never suggests (§7.6 requires this for product reasons; it is also the anti-enumeration control) |
| **Paging is capped** | `limit` maxes at 50 and cursors are opaque, so a cursor cannot be edited into a scan |

**Rate limits — starting values, to be tuned against measurement.**

| Route | Edge limit | Key |
|---|---|---|
| `GET /v1/storefronts/*` | 60/min | IP · 600/min per ASN |
| `GET /v1/storefronts/*/search` | 30/min | IP |
| `GET /v1/sellers/lookup` | 20/min | IP |
| `POST /v1/post-links/resolve` | 10/min | IP |
| `POST /v1/auth/otp/request` | 3/hour per phone hash · 10/hour per IP | Origin |
| `POST /v1/orders` | 20/hour | Account |
| `POST /v1/claims` | 5/day | Account |
| `POST /v1/conversations/*/messages` | 60/min | Account |

**Phone-keyed limits use a hash, never the number**, matching `core.phone_reuse_block` — the limit has to work before an account exists, which is exactly when the raw number would otherwise be sitting in a counter table.

**What is accepted, explicitly.** A determined party can scrape any storefront they already know the handle of, and will. Every field they obtain is a field the page renders to a buyer, and §13.2 requires it to be there — published statistics are the differentiator, and withholding them from the anonymous surface would break the product to inconvenience a competitor. **Detection rather than prevention is the honest posture:** anonymous read volume is logged by ASN, and a distribution that shifts is a signal to look at, not an automatic block.

---

## 11. Events and notification delivery

**INVARIANT — the endpoint emits the event; the client never does.** §20's schema exists to answer questions about behaviour, and a client-emitted event is missing exactly when the client crashed, which is the case worth knowing about.

Two exceptions, both unavoidable and both narrow: `notification_permission_result` and `follow_intent_web` describe things only the client observes. Both are `POST`ed to `/v1/events` against a closed allow-list, and **any other event name on that endpoint is rejected 400** rather than accepted and ignored.

Every event carries `market_id`, `seller_type`, `eligibility_path` and `seller_level`, resolved server-side from the session (§20). The client never supplies them.

### 11.1 Notification delivery — closing the A6 race

The dispatch guard is correct and insufficient. FCM delivers whenever the device next has connectivity, so a buyer whose payment confirms four minutes after dispatch still receives *"Your order from Alem is released in 2 hours."* The database honoured the invariant; the buyer experienced it being broken.

**The fix is displacement, not expiry.** v1.0 only narrowed the window. Four mechanisms, in the order they take effect:

**1. The dispatch guard** (ADU-DB-01 §20). The sender re-reads order state immediately before handing the message to the transport, and `WHERE clock_stopped_at IS NULL` skips any confirmed order. This stops the message being sent at all in the common case.

**2. Time-to-live bounded by relevance.** A push that cannot be delivered inside its own relevance window is discarded by the transport rather than queued.

| Notification | TTL | Reason |
|---|---|---|
| Morning reminder | 6h | Useless after the working day it refers to |
| Two-hour expiry warning | 2h | Outlives its own subject if it survives longer |
| Payment confirmed | 24h | Still worth receiving late |
| Payout change | **No TTL** | Not suppressible, not expirable (§10.4) |
| Claim update, escalation | 24h | |

**3. A collapse key per order.** Every notification concerning an order carries `collapse_key = "order:{order_id}"` and, on the client, `tag = order_id`. A newer message replaces an older undelivered one at the transport, and replaces the older displayed one in the tray.

**4. Payment confirmation is sent on that key, and this is what actually closes the race.** Confirming a payment sends a payment-confirmation notification — a type §17.1 already permits on all tiers and all levels — which **supersedes any expiry warning still queued or still on screen**. The buyer does not receive a correction; they receive the right message in the place the wrong one was.

**INVARIANT — a notification payload asserts no state the app cannot re-verify on open.** It carries `order_id`, `notification_id`, a deep link and the display text. It carries no amount, no deadline the app then treats as authoritative, and no state name. The order card re-reads on every view and is the authoritative surface — §17.3 already requires that for buyers who denied permission, and it does double duty here.

**The residual, stated rather than papered over.** A device that is online when the warning arrives and whose owner reads it in the seconds before the confirmation lands sees a message that was true when sent and is not true when read. Nothing closes that without data-only pushes, which Android throttles in Doze on precisely the devices this product targets. The window is seconds to minutes, the correction is automatic, and the in-app card never shows the stale claim.


---

## 12. Endpoint catalogue

Legend: **A** anonymous · **B** buyer (mobile) · **S** seller (`SELLER_WEB`) · **C** courier · **M** also reachable from the Seller Companion on mobile · **§** step-up required · **I** idempotency key required.

**The M marking is the Companion's Phase 1 scope** (ADU-ARCH-01 §3.1). It is enforced by `core.permission.surfaces`, not by this table — the table records what the database already decides.

### 12.1 Public — anonymous

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/bootstrap` | §3.1 |
| GET | `/v1/storefronts/{handle}` | Header, published statistics, trust level, handoff count (§5.3) |
| GET | `/v1/storefronts/{handle}/products` | Seller's display order is the default (§7.5) |
| GET | `/v1/storefronts/{handle}/products/{slug}` | Includes structured attributes, variants, stock with `confirmed_at` |
| GET | `/v1/storefronts/{handle}/search` | Scope is one seller, always (§7.5) |
| GET | `/v1/storefronts/{handle}/reviews` | Badge per review (§12) |
| GET | `/v1/sellers/lookup?q=` | Returns sellers only, capped, never suggests (§7.6) |
| POST | `/v1/post-links/resolve` **I** | Returns a **list** — one post commonly features several products (§7.5.1) |
| GET | `/v1/categories` | |

**INVARIANT — the storefront response carries the seller's trust level and completed handoff count as page content** (§3.1). It is not a separate call. The web view must answer everything the chatbot would, and a second round trip on a slow connection is a page that renders without the trust signal.

**INVARIANT — the install prompt appears at the reserve action, never on arrival** (§3.1). The API contributes by having no reserve endpoint reachable without a session — the web client cannot offer the action even by mistake.

### 12.2 Identity and session

| Method | Path | |
|---|---|---|
| POST | `/v1/auth/otp/request` **I** | Transport retries only |
| POST | `/v1/auth/otp/resend` | **Not idempotency-keyed.** A user tapping *resend* calls this; only a lost response reuses a key (X11) |
| POST | `/v1/auth/otp/verify` **I** | Creates buyer identity on first use (§6.1) |
| GET | `/v1/auth/sessions` | B S C |
| DELETE | `/v1/auth/sessions/{id}` | B S C |
| POST | `/v1/auth/sessions/revoke-others` **§** | B S C |
| POST | `/v1/auth/step-up/request` **I** | |
| POST | `/v1/auth/step-up/verify` | |
| POST | `/v1/devices` **I** | Anonymous registration; binds at identity creation (§11.1) |
| PATCH | `/v1/devices/{id}` | Push token, permission result |
| POST | `/v1/auth/recovery` **I** | Number changed or SIM lost → operator review, not self-service (§6.6) |

### 12.3 Cart — B, plus anonymous by device

| Method | Path | |
|---|---|---|
| GET | `/v1/cart` | Re-checks availability per line on every view (§8.2) |
| POST | `/v1/cart/lines` **I** | 409 `CART_SELLER_CONFLICT` on a second seller (§8.1) |
| PATCH | `/v1/cart/lines/{id}` | |
| DELETE | `/v1/cart/lines/{id}` | |

Cart endpoints accept `X-Adulis-Device` without a session, per C6. Every line carries `available`, `available_checked_at` and the live price — a cart is a draft, and the interface has to say so rather than imply it.

### 12.4 Orders — B

| Method | Path | |
|---|---|---|
| POST | `/v1/orders` **I** | Whole-cart revalidation in one transaction; 409 with complete `items[]` (§8.3) |
| GET | `/v1/orders` | Cursor paged |
| GET | `/v1/orders/{id}` | Authoritative order card; re-read on every view (A6) |
| GET | `/v1/orders/{id}/payment-instructions` | **The C3 disclosure path.** §12.7 |
| POST | `/v1/orders/{id}/payment-evidence` **I** | Upload via signed URL, then commit |
| POST | `/v1/orders/{id}/reservations/{rid}/cancel` **I** | Per line (§9.4) |
| POST | `/v1/orders/{id}/cancel` **I** | Convenience: cancels every remaining line |
| POST | `/v1/orders/{id}/confirm-receipt` **I** | The tapped tier — medium weight, no level (§11.3) |
| POST | `/v1/orders/{id}/review` **I** | One per order (§12) |
| POST | `/v1/orders/{id}/refunds/{rid}/acknowledge` **I** | Explicit buyer action, never inferred (§10.5) |

**Claims** — omitted from the v1.1 catalogue in error, though referenced in §10's rate limits and §13's function mapping.

| Method | Path | |
|---|---|---|
| POST | `/v1/claims` **I** | B |
| GET | `/v1/claims` · `/v1/claims/{id}` | B S |
| POST | `/v1/claims/{id}/evidence` **I** | B S — bank record. **A single transaction, not a statement** (X15) |
| POST | `/v1/claims/{id}/evidence-export` **I** | B — the buyer's own order, chats and payment records |
| POST | `/v1/seller/claims/{id}/remedy` **I** | S — `REFUND` or `FULFIL`, the seller's choice (X15) |

**INVARIANT — no endpoint returns another party's identity.** The evidence export carries the requesting buyer's own transaction and nothing about who the seller is. Seller identity — verified legal name, ID type and verification date — is disclosed only to law enforcement or lawful process, through an operator path that is not part of this contract (X15).

`GET /v1/orders/{id}` returns `expires_at` as an absolute timestamp and never a duration — §17.3's rule for notifications applies with equal force to the card the buyer checks at 2am.

### 12.5 Payment instructions — the C3 endpoint

The single decryption path in ADU-DB-01 §13.6, surfaced.

```
GET /v1/orders/{id}/payment-instructions
→ 200 {
    "bank_code": "CBE",
    "account_number": "1000123456789",
    "account_name": "Alem Tesfaye",
    "amount_minor": 145000,
    "currency": "ETB",
    "reference": "ADU-7K3M9"
  }
```

- Calls `financial.render_payment_instructions(order_id, actor)` and nothing else.
- The function verifies the caller is the buyer on that order and the order is payable, then logs to `financial.access_log` in the same transaction. **The endpoint performs none of those checks itself** — duplicating them in NestJS creates a second place to get them wrong and a first place to skip the log.
- `Cache-Control: private, no-store`. This response must never enter a shared cache.
- 409 where the order is not in a payable state; 403 where the caller is not the buyer.

**No other endpoint in this contract returns an unmasked account number.** Seller, team, support and admin surfaces receive `account_last4`, because that is the only value `core` holds.

### 12.6 Handoff — B and C

| Method | Path | |
|---|---|---|
| POST | `/v1/handoffs/sync` **I** | Batch, per-item outcomes, never fails as a unit |
| GET | `/v1/seller/orders/{id}/qr` **M** | The seller displays; the buyer scans (§11.1). **Cached by the app for offline display at a doorway** |
| POST | `/v1/courier/orders/{id}/custody-accept` **I** | C — Event A |
| POST | `/v1/seller/orders/{id}/custody-transfer` **I** | S — Event A, seller side |

```
POST /v1/handoffs/sync
{ "scans": [ { "nonce": "...", "order_ref": "...", "signed_at": "...", "signature": "..." }, ... ] }

→ 200 { "results": [
    { "nonce": "...", "outcome": "VALID",             "counts_toward_level": true  },
    { "nonce": "...", "outcome": "LATE",              "counts_toward_level": false },
    { "nonce": "...", "outcome": "REJECTED_REPLAY",   "counts_toward_level": false },
    { "nonce": "...", "outcome": "REJECTED_HORIZON",  "counts_toward_level": false }
  ] }
```

**INVARIANT — a courier session cannot submit a buyer scan** (§11.2). Enforced by the composite foreign key in the database; the endpoint returns 403 rather than letting the constraint surface as a 500.

**An unsynced scan is visible to the buyer as pending, not complete** (§11.4). The client holds it locally, shows it as pending with a plain explanation, and it must survive the app being closed and a reinstall within the horizon.

### 12.6.1 Scan sync in full

**INVARIANT — the client signs once, at the moment of scanning, and stores the signed blob. Every retry transmits the identical bytes.** It never re-signs. This is what makes the discrimination below possible, and without it a retry is indistinguishable from an attack.

**Request.** Up to **50** scans; above that, 413 `PAYLOAD_TOO_LARGE`. `Idempotency-Key` covers a whole-batch retry; the per-nonce rules below cover a partial resend, which is the more common case because the client drops items as they settle.

**Processing.**

- **Each item is processed in its own transaction.** This is what makes "never fails as a unit" true rather than aspirational — a rollback triggered by item three cannot take items one and two with it.
- **Order is deterministic: ascending `signed_at`, ties broken by array position.** Two scans in one batch sharing a nonce resolve the same way on every retry.
- The batch returns 200 whenever it was well-formed. **A batch of six rejections is a successful request** — the client asked what happened to six scans and was told.

**Outcomes.**

| `outcome` | Meaning | `counts_toward_level` | Client action |
|---|---|---|---|
| `VALID` | In-window scan (§11.4) | true | Show complete. Drop the local copy |
| `LATE` | Signed after the window closed | false | Show complete, badge "confirmed by buyer". Drop |
| `REJECTED_REPLAY` | Nonce seen with a **different** signed payload | false | Drop. Surface nothing to the buyer |
| `REJECTED_HORIZON` | Beyond `offline_sync_horizon` | false | Show as expired, explain plainly. Drop |
| `REJECTED_SIGNATURE` | Signature does not verify | false | Drop and log |
| `REJECTED_UNKNOWN_ORDER` | Order does not exist or is not visible | false | Drop and log |

**The replay correction.** v1.0 said a retried sync of an already-accepted nonce returns `REJECTED_REPLAY`. That was wrong, and would have shown a buyer *"rejected"* for a handoff that had in fact succeeded — the worst possible outcome at a doorway.

**INVARIANT — a nonce arriving with a byte-identical signed payload from the same account is an idempotent retry and returns the original stored outcome, with `replay: true`.** A nonce arriving with a *different* payload, or from a different account, is `REJECTED_REPLAY`. The discriminator is the signed payload, not the nonce.

```
POST /v1/handoffs/sync
{ "scans": [ { "nonce": "...", "order_ref": "...", "signed_at": 1756025642817,
               "signature": "..." } ] }

→ 200 { "results": [
    { "nonce": "...", "order_ref": "...", "outcome": "VALID",
      "counts_toward_level": true,  "replay": false, "order_state": "HANDED_OFF" },
    { "nonce": "...", "order_ref": "...", "outcome": "LATE",
      "counts_toward_level": false, "replay": true,  "order_state": "HANDED_OFF" }
  ] }
```

`signed_at` is **epoch milliseconds**, per the A5 rule in §1 — an integer, so there is no timezone to get wrong and no parser to disagree with.

**The client may retry freely.** Every outcome is terminal for that nonce, an identical resend returns the same answer, and a transport failure costs a round trip rather than a handoff. That is the property a courier on an intermittent connection actually needs.

### 12.7 Chat — B and S

| Method | Path | |
|---|---|---|
| GET | `/v1/conversations` **M** | Cursor paged |
| GET | `/v1/conversations/{id}/messages` | |
| POST | `/v1/conversations/{id}/messages` **M I** | Body carries either `text` or `chip_id`. **Human messaging is free on every tier**; the AI cascade is what is metered (§15) |
| POST | `/v1/conversations/{id}/escalate` **I** | Free escalation (§15.1 layer 5) |

The bot's reply arrives as a message with `sender_kind: "BOT"` and a `resolution_path`. **The response body carries `template_key` and `slots`, never assembled prose** — the same rule as §7, for the same reason, and because §15.1 already forbids generated text anywhere in the system.

**Chat is in-app only** (§15). No web endpoints in this group.

### 12.8 Follows and feed — B

| Method | Path | |
|---|---|---|
| POST | `/v1/sellers/{handle}/follow` **I** | Available before purchase, from every surface (§17.1) |
| DELETE | `/v1/sellers/{handle}/follow` | |
| PATCH | `/v1/follows/{handle}/preferences` | |
| GET | `/v1/feed` | Recency-first over the followed set only (§17.2) |

**INVARIANT — the feed endpoint accepts no ranking, sorting or recommendation parameter.** There is no `?sort=`, no `?recommended=true`, no `?similar_to=`. §17.2 keeps this outside V3, and an endpoint that accepts a ranking parameter is one flag away from being a recommender.

### 12.9 Seller — onboarding and verification — S

| Method | Path | |
|---|---|---|
| POST | `/v1/seller` **I** | |
| GET | `/v1/seller/readiness` | Complete list, plain language, resolving action per item (§4.6) |
| PATCH | `/v1/seller/profile` | |
| POST | `/v1/seller/social-accounts` **I** | Issues the account-control code |
| POST | `/v1/seller/social-accounts/{id}/verify` **I** | Fetch and match; captures follower count |
| POST | `/v1/seller/identity-verification` **I** | KYC vendor handoff. **No image ever reaches Adulis** (§13.1) |
| PUT | `/v1/seller/availability` | **Informational.** One hour to a full day, several windows per day, **zero windows valid**. No change log |

`GET /v1/seller/readiness` returns **200 with `items[]`**, not an error. Readiness is a state a seller returns to across days, on a phone, between other work — modelling it as a failure would be wrong about what it is, and §4.6 is explicit that a seller who cannot tell why their store is not live abandons setup.

**The identity-verification endpoint never accepts an image.** There is no multipart body, no `document` field, no upload URL. The client is handed a vendor session and the vendor attests; Adulis stores date, verifier, ID type, name, keyed hash and a boolean (§13.1).

### 12.10 Seller — catalogue and stock — S

| Method | Path | |
|---|---|---|
| POST · GET · PATCH | `/v1/seller/products` **I** | |
| POST | `/v1/seller/products/{id}/publish` **I** | 409 with readiness `items[]` where blocked |
| POST | `/v1/seller/products/{id}/variants` **I** | |
| POST | `/v1/seller/products/{id}/images` **I** | Signed upload; max five (§7.4) |
| POST | `/v1/seller/products/{id}/video` **I** | One clip; ≤480p, ≤30s, compressed on device |
| POST | `/v1/seller/products/{id}/social-posts` **I** | Canonical id resolved server-side |
| POST | `/v1/seller/variants/{id}/stock` **I** | Writes a StockEvent. Never a direct count set |
| POST | `/v1/seller/variants/{id}/confirm-stock` **I** | Resets `stock_confirmed_at` (§13.3) |

**Media upload is signed-URL then commit, never a proxied multipart body.** A 4MB image through the API server is bandwidth paid twice and a request timeout on a slow uplink. The commit call registers the derivatives; **the original is never retained** and there is no field in which to name it.

`POST /v1/seller/variants/{id}/stock` takes a `delta` or an absolute `count`, and in both cases the server writes a `stock_event` — the count is never assigned. §7's invariant lives in a trigger, and the endpoint shape must not suggest otherwise.

### 12.11 Seller — orders and payout — S

| Method | Path | |
|---|---|---|
| GET | `/v1/seller/orders` **M** | |
| POST | `/v1/seller/orders/{id}/payment/confirm` **M I** | **"Confirm Payment Received"**, never "Accept Payment". The seller verifies in their own bank first (§10.1) |
| POST | `/v1/seller/orders/{id}/payment/reject` **M I** | **"Payment Not Received".** W6; ratification row 8. First rejection opens a 12-hour retry window; the second ends the order |
| GET | `/v1/seller/orders/{id}/payment-evidence` **M** | Logged access, no justification required (§10.3). **Never rendered in a notification preview** |
| POST | `/v1/seller/orders/{id}/reservations/{rid}/cancel` **M I** | Per line. Surfaced as **"Can't Fulfil"**. **There is no accept action — reservations are never gated on the seller** |
| POST | `/v1/seller/orders/{id}/refunds` **I** | Seller reports; buyer acknowledges separately |
| POST | `/v1/seller/orders/{id}/reissue-instructions` **§ I** | Single order only. No bulk endpoint exists (§8.5) |
| POST | `/v1/seller/orders/{id}/courier-assignment` **I** | |
| GET | `/v1/seller/payout` | Returns `account_last4` only |
| POST | `/v1/seller/payout` **§ I** | Enters `PENDING`; activates after the delay |
| DELETE | `/v1/seller/payout/pending` | **No step-up** — reverting is easier than changing |

**There is no bulk reissue endpoint**, and its absence is deliberate: §8.5 permits reissue on *a single named order* and never in bulk, and an endpoint accepting an array of order ids would be that rule broken at the wire while the database still believed it held.

### 12.12 Seller — team, subscription, deletion

| Method | Path | |
|---|---|---|
| GET · POST · DELETE | `/v1/seller/team` **§ I** | Business tier; Owner/Admin only |
| GET | `/v1/billing/subscription` | S or W |
| POST | `/v1/billing/purchase-intent` **§ I** | Console endpoint. The IAP restriction is gone with the seller app |
| POST | `/v1/billing/mark-transferred` **I** | Console endpoint |
| POST | `/v1/seller/closure` **I** | Enters `CLOSING`. Blocks new reservations; existing orders stay fully operable |
| DELETE | `/v1/seller/closure` | Returns to `ACTIVE`. Reversible by design |
| GET | `/v1/seller/deletion/blockers` | 200 with `items[]` (§16.9) |
| POST | `/v1/seller/deletion` **§ I** | Owner only for company sellers |

**The billing endpoints are ordinary console endpoints.** v1.1 had them reject a seller-app session to keep the apps outside In-App Purchase and Google Play Billing. **There is no seller app**, the buyer apps contain nothing purchasable, and the restriction has nothing left to restrict.

### 12.13 Courier — C

| Method | Path | |
|---|---|---|
| GET | `/v1/courier/orders` | **Currently assigned orders only** (§6.3) |
| GET | `/v1/courier/orders/{id}` | Buyer name, phone and delivery information for that order only |
| POST | `/v1/courier/orders/{id}/custody-accept` **I** | Event A |

Enforced by row-level security in the database, not by a `WHERE` clause in a service (§6.9 of ADU-DB-01). This is the one access rule where a forgotten filter hands one seller's buyer list to another seller's courier.

### 12.14 Account deletion from the web — anonymous

The one authenticated exception on the public site (§6.2 of ADU-WEB-01), and deliberately narrow.

| Method | Path | |
|---|---|---|
| POST | `/v1/deletion/otp/request` **I** | `purpose: ACCOUNT_DELETION` |
| POST | `/v1/deletion/otp/verify` | **Returns a deletion ticket, not a session** |
| GET | `/v1/deletion/preview` | Blockers as `items[]`; what deletion does |
| POST | `/v1/deletion/confirm` **I** | Requires explicit acknowledgement |

**INVARIANT — `/v1/deletion/otp/verify` returns a single-purpose ticket scoped to the deletion flow.** It is not a bearer token, is not accepted by any other endpoint, and expires in fifteen minutes. §3.0: the deletion path *"issues no session, grants access to no other surface, and its copy must state that it is not a sign-in."* A ticket that any other endpoint accepts is a session, whatever it is called.

**`/v1/deletion/preview` explains what deletion does before the phone number is taken** — the page order is explain → phone → OTP → confirm (ADU-WEB-01 §6.2), and the preview endpoint exists so the explanation is server-supplied and stays in agreement with what deletion actually does.

## 13. Function mapping

Every state-changing endpoint and the ADU-DB-01 function it calls. Where this table says a function, the NestJS service calls it and does nothing else of consequence.

| Endpoint | Function |
|---|---|
| `POST /v1/orders` | `core.fn_create_order` |
| `GET /v1/orders/{id}/payment-instructions` | `financial.render_payment_instructions` |
| `GET /v1/seller/orders/{id}/payment-evidence` | `financial.read_payment_evidence` — defined in ADU-DB-01 v1.5 §13.3 |
| `POST /v1/seller/identity-verification` | `verification.write_attestation` — defined in ADU-DB-01 v1.5 §7.3 |
| `GET /v1/seller/readiness` · `POST .../publish` | `core.fn_publication_readiness` · `core.fn_publish_product` |
| `POST /v1/seller/variants/{id}/stock` | insert `core.stock_event` — the trigger does the rest |
| `POST /v1/seller/payout` · `DELETE .../pending` | `core.fn_request_payout_change` · `core.fn_cancel_payout_change` |
| `POST /v1/handoffs/sync` | insert `core.handoff_scan` — the validity trigger decides the outcome |
| `POST /v1/claims` | insert `core.claim` — the evidence trigger populates the set |
| `GET /v1/seller/deletion/blockers` · `POST /v1/seller/deletion` | `core.fn_deletion_blockers` · `core.fn_delete_seller` |
| Every seller-scoped write | `core.fn_has_permission` as the first statement |
| Every capability gate | `billing.fn_effective_limit` |
| Every eligibility check | `core.fn_evaluate_eligibility` |

**INVARIANT — no endpoint computes a trust level, an entitlement, an expiry, a readiness state or a scan validity.** Each is a function call. §23: clients display state and send intents; by the same logic the API layer relays decisions and does not make them.

---

## 14. Non-functional

| Concern | Requirement |
|---|---|
| **Storefront first response** | Under 40KB uncompressed, single round trip, edge-cached |
| **Timeouts** | 10s client-side on reads, 30s on writes. A write that times out is retried with the same idempotency key |
| **Offline** | Scan capture and queued sync are the only offline-capable operations (§23) |
| **Time** | Every timestamp on the wire is RFC 3339 UTC with a `Z` suffix. The client formats for the market timezone |
| **Money** | Always `{ amount_minor, currency }`. Never a decimal, never a formatted string |
| **Locale** | Server echoes the resolved locale in every response. A key missing from the Amharic catalogue falls back to English, never to a raw key path (§8.3 of ADU-WEB-01) |

---

## 15. Open items

| Item | Blocks | Note |
|---|---|---|
| **Domain** | Every URL in this document, App Links, Universal Links | ADU-WEB-01 §14, in progress. Every path here is stable; only the host is pending |
| **R-1 and R-3** | Late-sync terminal state; mixed cancellation | ADU-DB-01 §12.2.1. **R-2 is closed** — a submitted payment never expires |

| **Business tier API** | §16.2's read-mostly scoped-token API | Specified when Business tier ships |
| **Push provider** | Buyer and seller notification delivery, TTL semantics | FCM and APNs assumed; not recorded as decided anywhere |
| **Companion Phase 2** | Overview, analytics, reviews, notification preferences | Built on beta evidence — ADU-ARCH-01 §3.1 |
| **Signed upload provider** | Media commit flow | Cloudflare R2 presigned assumed, per the existing R2 decision |

---

## 16. Feedback to ADU-DB-01

This contract requires two tables that ADU-DB-01 v1.3 does not have. Both are transport concerns rather than domain concerns, which is why they surfaced here and not there. **Both are specified in full below and adopted into ADU-DB-01 v1.4**; this section is the source until that revision issues, and stops being authoritative the moment it does.

**`core.idempotency_record`** — §8

```sql
CREATE TABLE core.idempotency_record (
  id              uuid PRIMARY KEY,
  key             uuid NOT NULL,
  actor_kind      core.idempotency_actor_kind NOT NULL,   -- ACCOUNT | DEVICE
  actor_id        uuid NOT NULL,
  endpoint        text NOT NULL,
  request_hash    bytea NOT NULL,
  response_status int  NOT NULL,
  response_body   jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  UNIQUE (key, actor_kind, actor_id, endpoint)
);
```

- `actor_kind` admits `DEVICE` because the cart and device-registration endpoints are reachable before an account exists (C6). An idempotency scheme that assumed an account would leave the pre-identity endpoints — the ones a buyer hits on the worst connection, before they have committed to anything — unprotected.
- `expires_at` is `created_at + 24 hours`: longer than any plausible retry, shorter than any storage concern.
- **Not append-only.** It is an expiring cache of what was already answered, not a record of what happened. `analytics.event` is the record.

**`core.rate_limit_bucket`** — §10

```sql
CREATE TABLE core.rate_limit_bucket (
  subject_kind core.rate_limit_subject_kind NOT NULL,  -- ACCOUNT | DEVICE | PHONE_HASH | IP_HASH
  subject_id   text NOT NULL,
  bucket_key   text NOT NULL,                          -- endpoint group
  window_start timestamptz NOT NULL,
  count        int NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_kind, subject_id, bucket_key, window_start)
);
```

- **`PHONE_HASH`, never a phone number.** The OTP limit has to work before an account exists, which is exactly when the raw number would otherwise sit in a counter table with no retention story. Same reasoning, same mechanism as `core.phone_reuse_block` (§16.9).
- **Not append-only**, and purged aggressively — a bucket older than its widest window is dead weight.
- **Accepted cost:** one small write per limited request, on top of the session read, on a single Postgres. Affordable at the modelled volume and worth measuring before it is not.

Two new enum types: `core.idempotency_actor_kind` and `core.rate_limit_subject_kind`.

Two new jobs, both trivially idempotent: `idempotency.purge_expired` and `rate_limit.purge_stale`, hourly.

**ADU-DB-01 moves to v1.4 at 104 tables and 51 enum types.** Appendix C check 14 changes with it. **Append-only count stays 21** — neither table records what happened, and marking an expiring cache append-only would put two rows in a count whose whole purpose is to be compared against the trigger and `REVOKE` totals.

**And a write-back to ADU-PRD-01, W10:** §5.2's anti-gaming rules limit how often one buyer can advance one seller, and say nothing about *when* that buyer can claim the handoff occurred. A5's residual — a colluding buyer with a manipulated device clock — belongs in that section as a known limit, not in this document as a footnote. **UTC does not resolve it**, for the reason given in §1 A5.

---

*Binding API contract. Drawn from ADU-DB-01 v1.6 and ADU-ARCH-01 v2.0. Every state-changing endpoint calls a named database function; no endpoint reimplements an invariant. Five of the six gaps of §1 are resolved in full; A5's residual is bounded and recorded as W10. The two tables of §16 require ADU-DB-01 v1.4.*
