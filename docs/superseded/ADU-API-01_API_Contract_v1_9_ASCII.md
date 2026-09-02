# ADU-API-01 -- Adulis API Contract

**Version:** 1.9  -  **Baseline date:** 1 September 2026
**Owner:** Founder / CEO (back-end)  -  COO/CTO (front-end)
**Status:** Binding API contract. Drawn from **ADU-DB-01 v1.12**, ADU-ARCH-01 v2.0 and ADU-CON-02 v3.0. **Under the two-developer split this is a contract between two people, not documentation for an agent.**
**Supersedes:** ADU-API-01 v1.8
**Related:** ADU-DB-01 v1.16  -  ADU-CON-03 v1.3  -  ADU-AUTH-01 v2.6  -  ADU-CON-02 v3.2  -  ADU-AUTH-01 v2.4  -  ADU-RUL-01 v1.0  -  ADU-CON-02 v3.0  -  ADU-CON-03 v1.1  -  ADU-PRD-01 v8.5  -  ADU-WEB-01 v1.0

> Where this document and ADU-PRD-01 disagree on **product behaviour**, the PRD governs. Where this document and ADU-DB-01 disagree on **enforcement**, ADU-DB-01 governs. This document governs the **wire**: what a client may send, what it will receive, and what it may assume.

> **The central rule.** Every state-changing endpoint calls a named function in ADU-DB-01. No endpoint writes a table directly where a function exists. An invariant enforced in a NestJS service is an invariant a second endpoint can bypass.

---

## 0. What this document is

ADU-DB-01 establishes what is true in the database. This document establishes what a client can do about it.

It exists because the gap between those two is where most of the defects will be. The database refuses an illegal transition; the API decides what the buyer sees when that happens, whether a retry produces a second order, and whether the error can be rendered in Amharic. None of that is a database question, and none of it is currently written down anywhere.

**Reading order:** ADU-00 -> ADU-PROJ-01 -> ADU-PRD-01 -> ADU-DB-01 -> ADU-API-01.

**Scope:** V1 as defined in ADU-PRD-01 S2, across four client surfaces. Out of scope: V3 discovery, advertising, Crowd Commerce, Group Buying, delivery, the Business-tier public API (S16.2 -- read-mostly, scoped tokens, specified separately when Business tier ships).

**Count:** **123 catalogue entries in 18 groups** -- 130 distinct method-and-path pairs, since some entries carry several methods. The catalogue is S12; the function mapping is S13.

[!] **v1.3's stated count of 79 was wrong.** Its catalogue actually held 92 entries and 95 method-path pairs. The figure appears to have drifted across revisions without being recounted, and it is corrected here rather than carried. This is the third counting error found in the document set -- ADU-DB-01 S28 and Appendix C carried two more, both corrected in v1.7. **A stated count that nobody can reproduce is worse than no count**, because S12 exists so that a reviewer can tell whether a generated router is complete.

---

## 0.1 What changed in v1.9

**Thirty screens are built and eleven of them render a sentence explaining what this contract does not supply.** v1.9 is that list, answered.

### The three the console labels on screen

| # | Change | Entry |
|---|---|---|
| **1** | **`bucket` on `GET /v1/seller/orders`** -- four values, **membership owned by the server** | D-154 |
| **2** | **`GET /v1/seller/couriers` returns COURIERS**, claimed rows carrying `account_id`, pending invites marked | D-157, D-224.4 |
| **3** | **`allowed_actions`** -- per object, named by permission code | D-155 |

### The reads that were never specified

**Eight endpoints write state nothing can read back.** Each was found by a builder drawing a screen and discovering the form had no way to show what was saved.

| # | Read | Screen |
|---|---|---|
| **4** | **`GET /v1/seller/profile`** -- SC-17 is a **write-only form** today and says so | SC-17 |
| **5** | **`GET /v1/seller/availability`** -- `PUT` exists; `core.seller_availability` is only ever written | SC-19 |
| **6** | **`GET /v1/seller/social-accounts`** -- follower count exists on the wire only as verify's transient value, **with no `captured_at`**, so R24's "as of" can only name this session | SC-22 |
| **7** | **Seller status and handle** on the profile read | SC-17, SC-22 |
| **8** | **Remembered devices** distinguishable from live sessions, and a way to remove a remembered flag alone | SC-27 |
| **9** | **Payout lock state on `GET /v1/seller/payout`** -- discovered on attempt today, so SC-24 cannot draw a proactive panel | SC-24 |
| **10** | **Analytics date parameters and export** | SC-12 |
| **11** | **Purchase-intent reference** on the subscription read | SC-26 |

### Two corrections

| # | | Entry |
|---|---|---|
| **12** | **The two `I` markers are WITHDRAWN.** S8 says a key rides on state-changing `POST` **and on nothing else**; the S12 catalogue marked `PATCH /variants/{id}` and `PUT .../images/order`. **The server implements S8** | D-222.6 |
| **13** | **`PAYOUT_LOCKED` gains a `reason` slot.** One code, two causes, and one English sentence assuming the wrong one | D-224.6 |

**Everything not listed above is carried forward from v1.8 unaltered.**

---

## 0.2 What changed in v1.8 -- retained for history

**Two error codes, three auth-endpoint corrections, and a count this document has been wrong about since Tier 3.**

| # | Change | S |
|---|---|---|
| **D-196a** | **`MARKET_UNAVAILABLE`** -- registration is not open in this country | 7.1 |
| **D-196b** | **`SMS_NOT_SENT`** -- transport definitively failed before the response | 7.1 |
| **D-180** | **`POST /v1/auth/otp/verify` REJECTS `audience`.** It is stamped at challenge creation and read from the row | 12.2 |
| **D-101** | **`age_declared_over_18` on verify, and `AGE_DECLARATION_REQUIRED` when a new account cannot be created without it** | 12.2 |
| **D-89** | **A successful verify claims a matching pending courier invite**, server-side, idempotent | 12.2 |
| **D-87** | **`POST /v1/conversations` takes no anchor.** The anchor moved to the message (D-73) | 12.7 |
| **D-100** | **The catalogue counts 124 entries; the built contract has 110 path keys and 129 operations.** Three quantities, counted as one | 12 |
| **D-155** | **No endpoint returns `allowed_actions`**, which the console's own instructions say it renders | 15 |

### Why the two codes are safe, which is the only interesting part

**`MARKET_UNAVAILABLE` is permitted by ADU-AUTH-01 v2.6 S17** because market availability *may* be disclosed **when it depends solely on public market configuration** -- every phone in that market receives the same answer.

[!] **And it must depend on nothing else.** An unsupported market that answers differently for a registered phone is **a country oracle with an extra step.**

**`SMS_NOT_SENT` covers only the case that can honestly reach a response.**

> **Provider acceptance is synchronous and belongs in the response. Delivery is asynchronous and does not.**
>
> If transport definitively fails before the response -- rejection, failover exhausted -- the request says so, **with a body identical for a registered and an unregistered phone.** If the provider accepted and delivery later failed, **the request has already returned and there is no channel.** The user learns on resend.

**No polled delivery status is added.** A status endpoint on an anonymous path is **a new endpoint answering questions about a phone**, and every such endpoint is an oracle until proven otherwise.

**Everything not listed above is carried forward from v1.7 unaltered.**

---

## 0.3 What changed in v1.7 -- retained for history

**ADU-RUL-01's rulings, and five places where the T4 build is right and this contract was wrong.**

| # | Change | S |
|---|---|---|
| **G1.1** | **`POST /v1/seller/identity-verification` is operator-only.** No KYC vendor at MVP; a seller can no longer attest their own identity | S12.9 |
| **G1.3** | Closure stays available while **deletion** is blocked, and every blocker names its clearing action | S12.12 |
| **G1.6** | **Ownership transfer** has a policy: an existing Admin receives it, 24-hour delay, unsuppressible notice both ways | S12.12 |
| **G1.7** | **Subscription lifecycle** -- 24-hour intent expiry, `ACTIVE` only on a reconciled payment, rate locked at intent creation | S12.12 |
| **G1.8** | **A courier invite succeeds whether or not the number has an account**, and the response is identical either way | S12.11 |
| **G1.9** | `{slug}` is now backed by a column. Doctrine 5 required it: a product page is anonymous and cannot carry a UUID | S12.1 |
| **G1.10** | **`POST /v1/conversations`** -- new, additive. Anchored on a product or an order | S12.7 |
| **D-30** | S12.5 said a non-buyer gets **403**; the build returns **404** | S12.5 |
| **D-33** | AUTH mandates `OTP_SUPERSEDED`; the build returns `OTP_EXPIRED` and its string already says what to do | S7.1 |
| **D-34** | S12.2 listed `revoke-others` for B S C; it is **`CONSOLE` only** | S12.2 |
| **D-44** | S12.15's subject kinds are spelled differently from the frozen enum | S12.15 |

**Counts:** 123 -> **124** catalogue entries. One addition, no removals.

### G1.1 tightens authorization, and that is not a breaking change

Doctrine 6 forbids removal, rename and retype **within a shape**. It protects a client against a contract changing under it. **It does not protect a client's right to call something it should never have been able to call.**

`POST /v1/seller/identity-verification` keeps its path, its body and its response. What changes is who may call it: `seller.identity:manage` no longer suffices, and an operator grant is required. **A seller session receives 403.** The path is not removed, because removing it would be a shape change and because the capability still exists -- it moves to whoever holds the grant.

**Everything not listed above is carried forward from v1.6 unaltered.**

---

## 0.3 What changed in v1.6 -- retained for history

**Four changes, no new endpoint.** v1.6 records how the database's authorization failures reach the wire, and closes two gating gaps ADU-CON-03 v1.1 found while its screens were being drawn.

| # | Area | v1.5 | v1.6 |
|---|---|---|---|
| **R29** | Error mapping | `insufficient_privilege` -> 500, on the reasoning *"a grant is wrong"* | **`U0001` -> 403  -  `U0002` -> 404  -  `42501` -> 500.** Deliberate denials and misconfigured grants no longer share a code | S7 |
| **R20** | `GET .../orders/{id}/qr` | Ungated | **409 before `PAYMENT_CONFIRMED`.** The token should not exist yet | S12.11 |
| **R25** | `GET /v1/courier/orders/{id}` | Returned everything | **The QR appears only after custody is accepted** | S12.17 |
| **C3** | `PATCH .../company-details` | Fields unnamed | Named, matching ADU-DB-01 v1.10 S7.1 |

**The R29 change is the one that matters, and it fixes a defect this document created.** ADU-CON-02 S6.3 maps `insufficient_privilege` to **500**, which is right when PostgreSQL raises it -- a missing grant is our defect, not the caller's. But ADU-DB-01's `fn_has_permission` was written to raise the same code **deliberately**, for a 403. One SQLSTATE meaning both *"you may not do this"* and *"our grants are misconfigured"* means **a real privilege bug reaches a seller as a clean 403 and is never investigated.**

**Everything not listed above is carried forward from v1.5 unaltered.**

---

## 0.2 What changed in v1.5 -- retained for history

**Three endpoints and one correction.** v1.5 carries **R27** from ADU-CON-03 v1.1 -- sellers may mark dates on which the store is closed -- and fixes an inconsistency v1.4 introduced.

| # | Area | v1.4 | v1.5 | S |
|---|---|---|---|---|
| **R27** | Availability | A weekly pattern only | **`GET  -  PUT  -  DELETE /v1/seller/availability-overrides`.** Closure dates with an optional note | S12.9 |
| -- | Storefront | Header, stats, trust level | **Gains a resolved availability state** -- additive, from `core.fn_seller_availability_state` | S12.1, S13 |
| -- | Idempotency markers | `GET  -  PUT /v1/seller/fulfilment-methods` carried **I** | **Corrected.** `PUT` is idempotent by method and by primary key; the key is required on `POST` and on nothing else | S8, S12.9 |

**Counts:** 120 -> **123** catalogue entries (127 -> 130 method-path pairs), 18 groups unchanged. Three rows, three pairs -- the overrides are one method per row. **The error taxonomy is unchanged** -- an out-of-range override date is `VALIDATION_FAILED` at the edge, and inflating a closed taxonomy for a date check would be the wrong trade.

**Why the override endpoints are item-scoped rather than a whole-set `PUT`.** Replacing the whole set is the shape that matches `PUT /v1/seller/availability` above it, and it is the shape that would have been wrong here. Past closures are retained (ADU-DB-01 v1.8 S13.1a), so a set-replace would need the hidden rule *"replaces only dates on or after today"* -- and a hidden rule in a contract is a rule an agent implements as a full-table replace that silently deletes history. **One date per request, addressed by path, no replace semantics to get wrong.**

**Everything not listed above is carried forward from v1.4 unaltered.**

---

## 0.2 What changed in v1.4 -- retained for history

v1.4 is the reissue **ADU-DB-01 v1.7 and ADU-CON-03 both depend on.** It carries three corrections ADU-CON-01 found in v1.3, the audience collapse, and the twenty-eight endpoints the seller console needs and this contract never described.

| # | Area | v1.3 | v1.4 | S |
|---|---|---|---|---|
| **R3** | Credential presentation | Opaque bearer, unqualified | **Two presentations by surface.** `__Host-adulis_session` cookie for `CONSOLE`; bearer for `MOBILE`. Both opaque and stateful. ADU-SEC-01 and ADU-AUTH-01 both required this and this document never absorbed it | S5 |
| **R2** | Surfaces | `MOBILE`  -  `SELLER_WEB`  -  `COURIER_WEB` | **`MOBILE`  -  `CONSOLE`.** The courier restriction is RLS resolved per request, so a third audience enforced nothing | S4 |
| **R4** | Billing group | S12.12 still read *"there is no seller app... the restriction has nothing left to restrict"* | **Struck.** It contradicted S4.1 one page away, and an agent building from it omits the audience guard | S12.12 |
| **R10** | Conversation scope | `GET /v1/conversations` unscoped | **`?as=buyer` or `?as=seller&seller_id=`. No default** -- one account holds both roles | S12.7 |
| -- | Seller context | Undefined | **`X-Adulis-Seller` required** on every `/v1/seller/*` and `/v1/billing/*` call | S3.2 |
| **R7(c)** | Readiness items | Ten, including `ACTIVE_HOURS` | **Nine.** Availability is informational and zero windows is valid, so the item was always satisfied -- and a gate that never fails teaches the reader that satisfied rows mean nothing. `ACTIVE_HOURS_TOO_SHORT` retires with it | S7.1 |
| **R5** | Boundary functions | Took `p_actor_role` from the caller | **Derived server-side.** The mapping in S13 changes with ADU-DB-01 v1.7 S7.3 and S13.3 | S13 |
| **R15** | Payment instructions | Returned plaintext | **Returns ciphertext and a key reference**; the API decrypts. Key material never enters PostgreSQL | S12.5, S13 |
| **R18** | Evidence delivery | Unspecified | **Framed AEAD, streamed.** Constant memory at any concurrency | S12.11 |
| **R8'** | Ratification | R-1 and R-3 open | **Closed.** ADU-DB-01 v1.7 ratifies 23 rows. **`CONFIRMATION_WINDOW_LAPSED`** is new: a submitted payment never expires, and S12.4a of ADU-DB-01 says what happens instead | S7.1, S15 |
| -- | **The gap register** | 92 entries | **+28 -- exactly ADU-CON-01 S6's register.** Four new groups -- analytics, notifications, reports, client events -- plus additions across three seller groups | S12 |

**Counts:** 92 -> **120** catalogue entries (95 -> 127 method-path pairs), 14 -> **18** groups. Error codes gain five and retire one. Readiness items 10 -> **9**.

[!] **v1.3 stated 79 endpoints and had 92.** Corrected above; see S0's note.

**The largest change is the one that is easiest to miss.** v1.3 described a contract for a mobile app and a public website; the console was post-MVP when it was written. ADU-ARCH-01 v2.0 made the console the full seller management system, and **nine of the ten publication-readiness items are reachable from nowhere else** -- so a contract that cannot express product editing, analytics, notifications or content reporting is a contract in which no seller can become a seller. S12's additions are that gap closed.

**Everything not listed above is carried forward from v1.3 unaltered.**

---

## 0.3 What changed in v1.3 -- retained for history

v1.3 carries ADU-ARCH-01 **v2.0**: Telegram is removed, and the Adulis mobile app gains a **Seller Companion mode**. Seller endpoints become reachable from a native app again.

| Area | v1.2 | v1.3 |
|---|---|---|
| **Telegram group** | S12.15, five endpoints | **Deleted** |
| **Surfaces** | `BUYER_APP`  -  `SELLER_WEB`  -  `COURIER_WEB` | **`MOBILE`  -  `SELLER_WEB`  -  `COURIER_WEB`.** One mobile session serves both modes |
| **Version skew (S3.1)** | Buyer apps only -- the console updates on reload | **Applies to every endpoint the Companion reaches.** Seller endpoints are back inside a pinned client |
| **In-App Purchase** | Deleted -- no seller app existed | **Reinstated in full force.** S4 |
| **Surface scoping** | Absent | Every seller endpoint carries **M** where the Companion may reach it |

**Two reversals worth naming**, because v1.2 removed both and they are back:

**S3.1's additive-only rule governs seller endpoints again.** v1.2 halved the versioning burden on the grounds that the console is a PWA that updates on reload. **The Companion is a store-distributed app**, so every endpoint it reaches now has pinned old clients in the field -- and under the two-developer split it also has a colleague mid-sprint on the other side.

**The IAP constraint is a design constraint again.** v1.2 deleted it because there was no seller app to police. S4 reinstates it, with the specific trap that ADU-ARCH-02 S4 identified.

**Counts:** 84 -> **79** endpoints, 15 -> **14** groups.

**Everything not listed above is carried forward from v1.2 unaltered.**

---

## 0.4 What changed in v1.2 -- retained for history

v1.2 carries ADU-ARCH-01: **the seller has no native app.** The console is a PWA, notifications and quick actions run through a Telegram bot, and the iOS and Android apps are buyer-only.

| Area | v1.1 | v1.2 |
|---|---|---|
| **Surfaces** | Four, including a seller app and a separate `WEB_PURCHASE` session | **Three.** `BUYER_APP`  -  `SELLER_WEB`  -  `COURIER_WEB` |
| **In-App Purchase machinery** | An invariant, a separate audience, and a six-screen surface unreachable from the apps | **Deleted.** There is no seller app to keep purchase out of |
| **Version skew (S3.1)** | Applied to every client | **Buyer apps only.** The console updates on reload, so seller endpoints need no pinned-version support |
| **Telegram** | Absent | **New endpoint group S12.15**, `actor_channel` on every seller write |
| **OTP resend** | One endpoint, idempotency-keyed | **Split** -- X11 |
| **Ratification reference** | `payment/reject` cited R-3 | **W6 and row 8.** R-2 is closed by the confirmation-window ruling -- X9 |
| **Function mapping** | Two functions named and undefined | **Both defined in ADU-DB-01 v1.5** -- X10 |

**The largest simplification is one that stopped being needed rather than one that was solved.** ADU-PRD-01 S3 carried an INVARIANT plus a paragraph of machinery to keep subscription purchase away from the apps -- *"not a link, not a WebView, not an 'upgrade' prompt"* -- a distinct session audience, and a surface a seller had to find by leaving the app. All of it existed because a seller app existed. None of it survives.

**Everything not listed above is carried forward from v1.1 unaltered.**

---

## 0.5 What changed in v1.1 -- retained for history

v1.1 takes four of the six gaps from a stated default to a complete specification, answers the UTC question raised in review, and specifies the two tables the contract requires.

| Area | v1.0 | v1.1 | Section |
|---|---|---|---|
| **A1 error contract** | Envelope shape only | **Closed code taxonomy, mechanical key derivation, and a CI gate that fails when either locale catalogue is missing a key** | S7.1-S7.3 |
| **A3 batch scan sync** | Request and response shape | **Per-item transactions, deterministic ordering, size cap, and idempotent retry that returns the original outcome rather than a replay rejection** | S12.6.1 |
| **A4 anti-enumeration** | Posture | **Concrete limits, and the crawler tension named** | S10.1 |
| **A6 push delivery** | TTL and an authoritative order card | **Collapse key plus an actively displacing payment-confirmation notification** | S11.1 |
| **A5 device clock** | Bounded, residual accepted | **UTC answered.** Epoch-millis rule added; the residual is unchanged and is not a UTC problem | S1 A5 |
| **Two new tables** | Named | **Specified in full** | S16 |
| **iOS seller functionality** | Design note | **Confirmed: release-checklist item, not an API control** | S4 |

**One correction to v1.0.** S12.6 said a retried sync of an already-accepted nonce returns `REJECTED_REPLAY`. That conflates a device retrying its own scan with an attacker replaying a token, and would have shown a buyer *"rejected"* for a handoff that actually succeeded. The discriminator is the signed payload, not the nonce. Corrected in S12.6.1.

**Everything not listed above is carried forward from v1.0 unaltered.**

---

## 1. Gaps found, and how they are resolved

Six things a client needs that no existing document specifies. Each carries a default; **accepting a default requires no reply.**

Three of these are not API conveniences -- they are places where a guarantee ADU-DB-01 makes is not observable by the client, which means it is not a guarantee the product actually delivers.

### A1 -- There is no error contract, and three features separately require one

ADU-PRD-01 S8.3 requires a reconciliation step listing *every* failing cart line and what changed. S4.6 requires publication readiness returned as a complete list with the action resolving each item. S16.9 requires deletion blockers listed exactly. Three multi-item structured failures, and nothing says they share a shape -- so an app built from the PRD alone renders three of them.

Worse: if the API returns English prose, none of it can be localised. ADU-PRD-01 S23.1 makes translated strings per-locale resources assembled from named slots, never fragments -- an error body carrying `"Only 2 left in stock"` breaks that invariant at the one moment the buyer most needs to understand what happened.

> **Resolved in v1.1.** One error envelope for the whole API, RFC 9457 Problem Details extended with an `items[]` array. **Every item carries a `message_key` and a `slots` object, never rendered prose.** The code set is closed, the key is derived mechanically from the code, and a CI gate fails the build when either locale catalogue is missing an entry. Specified in S7, S7.1-S7.3.

### A2 -- A retry on a flaky connection creates a second order

The binding constraint is a low-end Android on a slow connection (S23). Retries are the normal case, not the exception: the buyer taps Reserve, the request succeeds, the response is lost, they tap again.

ADU-DB-01's `reservation_no_duplicate_active` exclusion constraint catches the single-line case. It does not catch a two-line order, and even where it fires the buyer receives a constraint violation rather than the order they already have.

> **Default.** An `Idempotency-Key` header, required on every state-changing `POST`. A replayed key returns the original response unchanged. Specified in S8.
>
> [!] **This requires one new table**, `core.idempotency_record`. Feedback to ADU-DB-01 in S16.

### A3 -- Batch scan sync has no specified shape, and partial failure is the normal case

S11.4 governs an offline scan by its signed timestamp and defines four outcomes. It says nothing about how scans reach the server. A courier who was offline all afternoon uploads six scans at once, of which one is a replay, one is beyond the horizon and four are valid.

Failing the whole batch loses four verified handoffs to one bad row. Succeeding the whole batch hides two rejections from a seller whose trust level depends on them.

> **Resolved in v1.1.** `POST /v1/handoffs/sync` accepts an array and returns a per-item outcome. **It never fails as a unit.** HTTP 200 with individual results, never 207 -- a partial-success status code that most HTTP clients treat as an error is worse than no status code at all. Each item is processed in its own transaction, order is deterministic, and a retry of an identical signed payload returns the **original** outcome rather than a replay rejection. Specified in S12.6.1.

### A4 -- The storefront is anonymous by design, which makes it enumerable

The web storefront is the conversion surface and must stay public (S3.1). It also publishes exactly the data a competitor wants: seller handle, trust level, completed handoff count, cancellation rate, product catalogue and prices (S13.2). ADU-PRD-01 S23 requires rate limiting on auth, OTP, reservation, claim and proposal endpoints -- the storefront is not on that list.

The distinction that matters is **scraping one storefront** versus **enumerating all of them**. The first is what a browser does and cannot be prevented. The second builds a competitor's target list of every seller on Adulis, ranked by how well they are doing.

> **Resolved in v1.1.** Prevent enumeration, accept scraping. Concrete limits and the crawler tension are in S10.1.
> - **INVARIANT -- no internal UUID appears in any public URL.** Storefronts and products are addressed by handle and slug. A UUIDv7 is time-ordered, so a UUID in a public URL leaks signup order and admits walking the space.
> - No endpoint returns a list of sellers without a caller-supplied query. `seller_lookup` caps results and never suggests (S7.6 already requires this -- here it is also an anti-enumeration control).
> - Anonymous reads are rate limited at the Cloudflare edge, matching ADU-WEB-01's decision; authenticated writes at the origin.

### A5 -- The scan timestamp that governs is signed by a device the buyer controls

**INVARIANT -- the signed timestamp inside the scanned token governs, not the moment the scan reaches the server** (S11.4). The device signs locally at the moment of scanning.

A buyer who sets their phone clock back can therefore assert an in-window scan on an order that expired, and a valid in-window scan counts toward the seller's trust level (S11.3). The attack needs a colluding buyer, which is exactly the shape S5.2's anti-gaming rules already assume. S5.2 limits how often one buyer can help one seller; it does nothing about *when* they can claim to have done it.

**Does calculating in UTC fix this?** No -- and the reason is worth stating precisely, because UTC fixes a *different* problem that is easy to conflate with this one.

UTC is a question about what a timestamp **means**. A5 is a question about whether a timestamp is **true**. A device that will emit a false local timestamp will emit a false UTC one just as readily; the attacker controls the clock, not the format.

What UTC does buy is real and worth having, because it removes the **common** case:

- ADU-DB-01 S4 and ADU-PRD-01 S23 already require every stored timestamp to be UTC. That is correct and unchanged.
- Cheap Android devices frequently carry a **correct NTP-synced UTC clock with a misconfigured timezone.** An app that builds its timestamp from local calendar components inherits the misconfiguration; one that reads epoch milliseconds directly does not. **So most honest clock errors disappear the moment the client stops constructing time from local components** -- which is a real gain, and the majority of what would otherwise look like A5 in the logs.
- Adversarial skew is what remains, and it is unaffected.

> **INVARIANT -- a client timestamp is epoch milliseconds read directly from the system clock, never assembled from local date and time components.** The signed scan payload carries an integer, not a formatted string, so there is no timezone to get wrong and no parser to disagree with.

**And on the seller's publish time: the question does not arise.** `published_at` is written server-side by `core.fn_publish_product`. No client supplies it, no client can influence it, and there is no signed-token equivalent. The scan timestamp is the *only* time value in the system that originates on a device the platform does not control -- which is exactly why it is the only one that needed A5.

> **Resolution.** Bound the adversarial case rather than pretend it is closed.
> - `CHECK (signed_at >= order_qr_token.issued_at)` -- a scan cannot predate the token it scanned. This alone caps backdating at the order's own lifetime.
> - The client sends its observed clock offset from the last successful `/bootstrap`. **Disagreement is recorded as a signal, never a rejection** -- a genuinely wrong clock is common on cheap devices and must not cost an honest buyer their order.
> - `received_at - signed_at` is already stored; a distribution that shifts for one seller feeds `level_velocity_flag`.
>
> **The residual is real and should be stated in ADU-PRD-01 S5.2 rather than discovered later:** a seller with one colluding buyer and a manipulated clock can manufacture verified handoffs within the sync horizon. The distinct-buyer rule limits the rate; nothing eliminates it, because the evidence originates on a device the platform does not control.

### A6 -- "No notification past PAYMENT_CONFIRMED" is a send guard, and delivery is asynchronous

**INVARIANT -- no notification is sent for an order past `PAYMENT_CONFIRMED`** (S17.3). ADU-DB-01 implements this at dispatch: the sender re-reads order state immediately before handing the message to the transport.

FCM then delivers whenever the device next has connectivity. A buyer whose payment is confirmed four minutes after dispatch still receives *"Your order from Alem is released in 2 hours."* The database honoured the invariant; the buyer experienced it being broken.

> **Resolved in v1.1, and more completely than v1.0 managed.** v1.0 only narrowed the window. The fix is to **displace** the stale message rather than wait for it to expire: every notification for an order carries the same collapse key, and confirming a payment sends a payment-confirmation notification on that key -- which supersedes any expiry warning still queued at the transport or still sitting in the buyer's tray. Specified in S11.1.
>
> Data-only pushes composed locally after a state re-read would close the race completely, and are rejected: Android throttles them hard in Doze, which is precisely the low-end device the product targets.

---

## 2. API doctrine

1. **Every endpoint maps to a named ADU-DB-01 function.** Where none exists, the endpoint is a plain read. No endpoint reimplements an invariant.
2. **The client computes nothing.** S23: *"Clients display state and send intents; they never compute expiry, eligibility, level or entitlement."* The API returns resolved state, never the inputs to a client-side decision.
3. **Every failure is machine-readable and localisable.** A `message_key`, never prose.
4. **Every write is idempotent from the client's point of view.**
5. **No internal identifier is public.** Handles and slugs on the wire; UUIDs behind authentication.
6. **The wire is additive within a major version.** A field is added, never removed or repurposed, because two app versions are always in the field.
7. **Authorisation is server-resolved per request.** No claim in a token is trusted for authorisation.
8. **Payload size is a feature.** The binding constraint is first paint on a slow connection; a storefront response that carries fields nobody renders costs the conversion the site exists to produce.

---

## 3. Transport and versioning

**REST/JSON over HTTPS with HSTS.** OpenAPI 3.1 generated from NestJS decorators, published to the repository as the client's source of truth.

**Rejected: GraphQL.** Query cost is caller-determined, which is the wrong property when the binding constraint is a slow connection and the binding engineering constraint is a beginner developer. N+1 resolution against a single Postgres is the specific failure ADU-PROJ-01 S13.5 warns about.

**Rejected: tRPC.** End-to-end types are attractive with TypeScript on both ends, but it has no versioning story, and the store-review problem below makes explicit versioning mandatory rather than optional -- for the buyer apps, which is now the only place it binds.

### 3.1 The version-skew problem nobody has written down

ADU-PROJ-01 S9.2 budgets two to three store rejection rounds. Ethiopian buyers on low-end Android with metered data frequently do not auto-update. **Several app versions will be live simultaneously, for months, and the oldest cannot be assumed to have been updated at all.**

Three consequences, all binding:

**Under ADU-ARCH-01 v2.0 this applies to every endpoint the mobile app reaches -- which now includes the seller endpoints marked M.** v1.2 exempted seller endpoints on the grounds that a PWA updates on reload; the Companion is store-distributed, so those endpoints have pinned old clients in the field again. **Endpoints reachable only from `SELLER_WEB` may still change freely** -- but under the two-developer split even those changes are a conversation rather than an edit, because the front-end consumes them days later.

**INVARIANT -- within `/v1`, changes are additive only.** No field is removed, renamed, or has its meaning changed. A field that must change gets a new name alongside the old one.

**INVARIANT -- every response is valid against the schema every supported client version holds.** A client ignores fields it does not know.

**A minimum supported version exists and is enforced at `/bootstrap`, not at the endpoint.** A client below the floor receives an upgrade instruction once, at launch, rather than an incomprehensible failure at the moment it tries to reserve.

```
GET /v1/bootstrap
-> 200 {
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
| `Authorization: Bearer <token>` | -> | Authenticated **`MOBILE`** endpoints | Opaque session token (S5) |
| *(cookie)* `__Host-adulis_session` | <-> | Authenticated **`CONSOLE`** endpoints | Set by the API, sent by the browser. **Never read by JavaScript** (S5) |
| `X-Adulis-Seller` | -> | Every `/v1/seller/*` and `/v1/billing/*` call | The active seller's uuid. Absent -> 400; not a seller the account holds -> **404** (S4.2) |
| `Origin` | -> | Every state-changing request from a browser | Checked against an exact allow-list. Absent on a write -> 403 (S5.1) |
| `Idempotency-Key` | -> | Every state-changing `POST` | S8 |
| `X-Adulis-Client` | -> | Always | `android/1.6.2`, `ios/1.4.0`, `web/2026-08-24` |
| `X-Adulis-Device` | -> | App clients | Registered `device_id` (S6.4 of ADU-DB-01) |
| `X-Adulis-Clock-Offset` | -> | App clients | Milliseconds, device minus server, from last bootstrap. A5 |
| `Accept-Language` | -> | Always | `en` or `am`; server echoes the resolved locale |
| `X-Adulis-Request-Id` | <- | Always | Correlates a client report to a server log |

---

## 4. Surfaces

Three callers, and the differences between them are enforced, not documented.

| Surface | Auth | May call |
|---|---|---|
| **Public web** (Next.js, Cloudflare) | None | Anonymous reads only, plus the deletion OTP flow |
| **Mobile app** (React Native, iOS + Android) | Bearer, `audience = MOBILE` | Buyer groups, **plus the seller endpoints marked M** |
| **Seller console** (React SPA, Cloudflare Pages) | Cookie, `audience = CONSOLE` | Every seller and billing group |
| **Courier** | Cookie, `audience = CONSOLE` | Courier group only -- **by row-level security, not by audience** |

**R2 -- two audiences, not three.** ADU-AUTH-01 S12 is adopted in ADU-DB-01 v1.7: the courier restriction is row-level security keyed on `current_setting('adulis.actor_role')`, **resolved per request**, so `COURIER_WEB` enforced nothing the RLS policy did not already enforce, while forcing a person who is both courier and seller to hold two logins for one account -- a case ADU-PRD-01 S6.3 calls ordinary. The courier's isolation is unchanged and is stronger than an audience check, because it is on the table.

**One account, two modes.** ADU-PRD-01 S6.3 already holds that *"one person may hold buyer, seller, team member and courier roles on the same phone number. Roles are relationships, not accounts."* A mobile session therefore reaches buyer endpoints and Companion endpoints without switching identity, and **a seller acting as a buyer creates a buyer transaction** -- orders reference `buyer_account_id` and nothing consults whether that account also owns a store.

**INVARIANT -- surface is checked in the database, not in a service.** `core.fn_has_permission(account, seller, permission, audience)` takes the calling audience and `core.permission.surfaces` decides. An endpoint cannot grant a capability the surface may not exercise, because the check happens below the endpoint.

**INVARIANT -- no S6.5 step-up action is reachable from `MOBILE`.** Payout changes, reissued instructions, team changes, subscription purchase, seller deletion, revoking sessions. A mobile session presenting at one receives **403**, from the permission function, before endpoint logic runs.

### 4.2 The active seller travels per request

**INVARIANT -- the active seller is a request parameter, never session state** (ADU-AUTH-01 S8.3). Every `/v1/seller/*` and `/v1/billing/*` call carries `X-Adulis-Seller`. Absent -> 400 `VALIDATION_FAILED`; present but not a seller the account holds a relationship with -> **404**, never 403, because a scope failure must not confirm that the object exists (ADU-AUTH-01 S19).

The paths in S12 carry no seller segment, which is why this is a header. The console derives it from its own URL segment on every request, so two stores open in two tabs are two URLs and cannot be confused -- the failure S8.3 exists to prevent is a seller confirming a payment on the wrong store.

### 4.1 In-App Purchase -- a design constraint again

ADU-PRD-01 S3: *"**INVARIANT -- subscription purchase never happens inside either app.** No prices, no purchase flow, no link to purchase. This is what keeps the apps outside Apple's In-App Purchase and Google Play Billing requirements, both of which would take 15-30% in card rails incompatible with manual ETB bank transfer."*

v1.2 deleted this because there was no seller app. **It is reinstated.**

> **INVARIANT -- no endpoint reachable from `MOBILE` returns a price, a tier name, or a URL to a billing surface.** The billing group is `SELLER_WEB` only, and a mobile session receives 403 rather than a redirect -- **a redirect is itself a link to an external purchase mechanism.**

**Where a mobile response must convey a tier limit**, it names the capability and where it is configured -- `"custom_flows_configured_in_console"` -- **never a tier and never a route to change one.** This is why S7's error contract returns `message_key` and `slots` rather than prose: the client renders from its own catalogue, and no server string can leak a price into a screen Apple reviews.

[!] **Store rules in this area move.** The shape of the risk is stable; the permissible wording is not. Worth a paid review before first submission.

---

## 5. Authentication and session

**Opaque and stateful, never JWTs.** ADU-DB-01 S6.6 requires the session row to be read on every authenticated request, because revocation must take effect immediately rather than at next refresh. A JWT invites exactly the optimisation that breaks that rule, and its only advantage -- stateless validation -- is one this system has already declined.

### 5.1 Two presentations, chosen by surface -- R3

v1.3 said "bearer tokens" without qualifying the browser case. ADU-SEC-01 S4 and ADU-AUTH-01 S5.1 both require a cookie for the console and both recorded it as a change this document had not absorbed. It is absorbed here.

| Surface | Presentation |
|---|---|
| `MOBILE` | `Authorization: Bearer <token>`, held in native secure storage |
| `CONSOLE` | `Set-Cookie: __Host-adulis_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/` |

**The token is identical in both cases** -- the same opaque `core.session` row, the same per-request read, the same immediate revocation. Only the carrier differs.

> **INVARIANT -- the console never holds a credential in JavaScript.** No `localStorage`, no `sessionStorage`, no in-memory token. `HttpOnly` means an XSS that runs on the console origin cannot read the session, which matters because that origin is where payout details are changed.

**CORS is exact, never wildcard.** `Access-Control-Allow-Origin: https://console.<domain>` with `Access-Control-Allow-Credentials: true`; the console fetches with `credentials: 'include'`. The two hosts are the same *site*, so a `SameSite=Strict` cookie is sent; they are different *origins*, so CORS applies.

**CSRF has two independent controls:** `SameSite=Strict`, and an exact `Origin` check on every state-changing request. One is browser behaviour and one is ours, and neither is trusted alone.

**Remembered devices (R17).** A console sign-in may set a second cookie, `__Host-adulis_device`, an opaque token bound to a `core.account_device` row. It extends the session lifetime to 7 days absolute and 8 hours idle; an unremembered console session keeps 12 hours and 30 minutes. It is **not** a credential on its own: it selects a lifetime, and every S6 step-up still demands a fresh OTP regardless of session age.

```
POST /v1/auth/otp/request     { phone, purpose: "SIGN_IN" }        -> 202
POST /v1/auth/otp/verify      { phone, code, audience, device_id } -> 200 { token, expires_at, roles[] }
```

`roles[]` describes what the account *is* -- buyer, seller-owner, team member on N sellers, courier for N sellers. It is a **rendering hint only**. Authorisation is resolved server-side per request through `fn_has_permission`; a client that hides a control based on `roles[]` and a server that permits the call anyway is the failure S16.2 forbids.

**INVARIANT -- an OTP with purpose `ACCOUNT_DELETION` cannot mint a session.** Enforced in the database (S6.5 of ADU-DB-01); the endpoint surfaces it as `otp_purpose_not_permitted` rather than a 500.

Sessions: `GET /v1/auth/sessions`  -  `DELETE /v1/auth/sessions/{id}`  -  `POST /v1/auth/sessions/revoke-others` (step-up required).

---

## 6. Step-up

The six actions in S6.5 take a step-up challenge **as a body parameter**, never as ambient middleware state.

```
POST /v1/auth/step-up/request  { action: "PAYOUT_CHANGE", target_ref } -> 202
POST /v1/auth/step-up/verify   { challenge_id, code }                  -> 200 { challenge_id, satisfied_at }
```

Then, on the protected call:

```
POST /v1/seller/payout
  { bank_code, account_number, account_name, step_up_challenge_id: "..." }
```

**Why a parameter and not middleware.** ADU-DB-01 S6.7: the writing function takes the challenge id as an argument, so a code path that omits it does not compile. A middleware guard is a decorator someone forgets on the seventh endpoint, and the omission is invisible until it is exploited.

**INVARIANT -- cancelling a pending payout change requires no step-up** (S10.4). Reverting must always be easier than changing.

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

**INVARIANT -- no error body contains rendered prose in any language.** `message_key` plus `slots` only. S23.1 makes translated strings per-locale resources with named slots and forbids fragment assembly; an English error string is that invariant broken at the worst possible moment. `title_key` follows the same rule.

**INVARIANT -- `items[]` is complete.** Where the operation failed on several counts, every one is present. S8.3 requires the buyer to see everything that changed at once; a first-failure response makes them discover the second on the retry.

**Three features share this shape**, which is the point of specifying it once:

| Endpoint | `items[].kind` | Source |
|---|---|---|
| `POST /v1/orders` | `CART_LINE` | S8.3 revalidation |
| `GET /v1/seller/readiness` | `READINESS_ITEM` | S4.6 -- **returns 200, not an error.** Readiness is a state, not a failure |
| `GET /v1/seller/deletion/blockers` | `OBLIGATION` | S16.9 -- also 200 |

**Status codes.** 400 malformed  -  401 no or invalid session  -  403 authenticated but not permitted, including wrong audience  -  404 not found or not visible to this caller  -  409 state conflict, including every illegal transition and every revalidation failure  -  410 gone, for a deleted seller's storefront  -  422 semantically invalid  -  429 rate limited, with `Retry-After`  -  503 with `Retry-After` on planned unavailability.

**Illegal state transitions return 409 with `code: "ILLEGAL_TRANSITION"` and the two states in `slots`.** The database raises `restrict_violation` (S12.2 of ADU-DB-01); the API translates rather than leaking a Postgres error, and never presents it as a 500 -- it is a conflict, and a client can act on it by refetching.

### 7.1 The code taxonomy is closed

**INVARIANT -- `code` is drawn from the list below and from nowhere else.** A code invented in a service is a code with no catalogue entry, which renders to the buyer as a generic apology in the one moment they needed to be told what to do.

**Adding a code within `/v1` is additive** -- old clients render it through the S7.2 fallback -- but it is a change to this document, not a decision taken in a pull request.

| Group | Codes |
|---|---|
| **Auth** | `OTP_INVALID`  -  `OTP_EXPIRED`  -  `OTP_ATTEMPTS_EXCEEDED`  -  `OTP_PURPOSE_NOT_PERMITTED`  -  `SESSION_EXPIRED`  -  `SESSION_REVOKED`  -  `AUDIENCE_NOT_PERMITTED`  -  `RECOVERY_REQUIRED` |
| **Step-up** | `STEP_UP_REQUIRED`  -  `STEP_UP_EXPIRED`  -  `STEP_UP_ACTION_MISMATCH` |
| **RBAC** | `PERMISSION_DENIED`  -  `OWNER_ONLY` |
| **Cart** | `CART_EMPTY`  -  `CART_SELLER_CONFLICT`  -  `CART_REVALIDATION_FAILED` |
| **Cart line items** | `INSUFFICIENT_STOCK`  -  `SOLD_OUT`  -  `PRICE_CHANGED`  -  `NO_LONGER_PUBLISHED`  -  `VARIANT_WITHDRAWN`  -  `SELLER_UNAVAILABLE`  -  `TRANSACTION_CAP_EXCEEDED` |
| **Order** | `ILLEGAL_TRANSITION`  -  `ORDER_NOT_PAYABLE`  -  `ORDER_ALREADY_TERMINAL`  -  `DUPLICATE_RESERVATION`  -  `BUYER_COOLDOWN_ACTIVE`  -  `ORDER_NOT_READYABLE` |
| **Payment** | `EVIDENCE_REQUIRED`  -  `EVIDENCE_TOO_LARGE`  -  `PAYMENT_ALREADY_DECIDED`  -  `NOT_ORDER_BUYER` |
| **Handoff** | `SCAN_SIGNATURE_INVALID`  -  `SCAN_PREDATES_TOKEN`  -  `SCAN_NOT_ORDER_BUYER`  -  `COURIER_CANNOT_SCAN` |
| **Seller** | `PUBLICATION_BLOCKED`  -  `ELIGIBILITY_NOT_SATISFIED`  -  `TIER_LIMIT_REACHED`  -  `LEVEL_LIMIT_REACHED`  -  `HANDLE_TAKEN`  -  `FULFILMENT_METHOD_REQUIRED`  -  `PRODUCT_HAS_ACTIVE_ORDERS`  -  `VARIANT_HAS_ACTIVE_ORDERS` |
| **Payout** | `PAYOUT_LOCKED_RECOVERY`  -  `PAYOUT_CHANGE_PENDING`  -  `PAYOUT_PERMISSION_DENIED` |
| **Deletion** | `DELETION_BLOCKED`  -  `DELETION_OWNER_ONLY` |
| **Request** | `VALIDATION_FAILED`  -  `IDEMPOTENCY_KEY_MISSING`  -  `IDEMPOTENCY_KEY_REUSED`  -  `RATE_LIMITED`  -  `CLIENT_UPGRADE_REQUIRED`  -  `PAYLOAD_TOO_LARGE`  -  `SELLER_CONTEXT_REQUIRED`  -  `SCOPE_PARAMETER_REQUIRED` |

### 7.1a Authorization failures on the wire -- R29

**Three SQLSTATEs, three outcomes, and the distinction is load-bearing.**

| SQLSTATE | Raised by | HTTP | Body |
|---|---|---|---|
| **`U0001`** | `fn_has_permission`  -  `read_attestation`  -  `read_payment_evidence` | **403** | `PERMISSION_DENIED` |
| **`U0002`** | `fn_has_permission` | **404** | The ordinary not-found envelope |
| `42501` | **PostgreSQL itself** | **500** | Generic. A grant is misconfigured -- our defect |

> **INVARIANT -- a deliberate denial and a misconfigured grant never share a code.** v1.5 mapped `insufficient_privilege` to 500 on sound reasoning, and ADU-DB-01 then raised the same code deliberately for a 403. Left as it was, **a genuine privilege bug would have surfaced to a seller as a clean 403 and never been investigated** -- the system would look correct while an entire boundary was misconfigured.

> **INVARIANT -- `U0001` is returned identically whatever gate produced it.** Standing, role and surface all raise it, and the response body does not distinguish them (ADU-AUTH-01 S14). Telling a caller which gate stopped them tells an attacker which to work on.

**`U0002` is a 404 and never a 403**, because an actor with no relationship to a seller must not learn that the seller exists (ADU-AUTH-01 S19). The envelope is the ordinary not-found one, with no hint that a permission was involved.

**`U0003`-`U0999` are reserved** for future deliberate raises. **Not `ADU...`** -- the SQL standard reserves SQLSTATE classes beginning `0`-`4` and `A`-`H`; implementation-defined codes must begin `5`-`9` or `I`-`Z`.

**Added in v1.8, two codes, each through the amendment route this section names** -- a new code is admitted here and **never invented in a service**:

| Code | HTTP | When |
|---|---|---|
| **`MARKET_UNAVAILABLE`** | 403 | Registration is not open in this country. **Depends solely on public market configuration**, so every phone in that market gets it |
| **`SMS_NOT_SENT`** | 502 | Transport definitively failed **before the response**. Body identical for a registered and an unregistered phone |

> **`SMS_NOT_SENT` is deliberately narrow.** It exists for `DEFINITIVE_NOT_SENT` with failover exhausted -- **not for `DELIVERY_UNKNOWN`**, where the provider may already have sent, and not for a delivery that failed after the request returned. **Those have no channel and none is invented.**

**Retired in v1.7: `OTP_SUPERSEDED` is not added -- D-33.** ADU-AUTH-01 S4.2 mandates it; the build returns **`OTP_EXPIRED`**, whose message key already tells the user to check for a newer code.

> **A code that produces no different client behaviour does not earn a slot in a closed taxonomy.** Superseded and expired are the same event to the person holding the phone -- the code they have does not work and a newer one exists -- and the message key carries that nuance without a second branch for a client to get wrong. **ADU-AUTH-01 v2.5 withdraws `OTP_SUPERSEDED`**; this contract does not add it.

**Retired in v1.4: `ACTIVE_HOURS_TOO_SHORT`.** Availability is informational and zero windows is valid (ADU-DB-01 S13.1), so nothing can be too short. Retiring a code is **not** additive -- but this one can never have been returned by a conforming server, so no client can have branched on it.

**Two item-code sets that are not errors** but share the `items[]` shape, because S7's whole point is that the client renders one component:

- **Readiness** (`GET /v1/seller/readiness`, 200): `ACCOUNT_CREATED`  -  `SELLER_TYPE_DECLARED`  -  `ELIGIBILITY_SATISFIED`  -  `IDENTITY_VERIFIED`  -  `COMPANY_DETAILS`  -  `STORE_PROFILE`  -  `PAYOUT_DETAILS`  -  `FULFILMENT_CONFIG`  -  `AT_LEAST_ONE_PRODUCT` -- **nine items**, in that order.

  **`ACTIVE_HOURS` is removed in v1.4 (R7c).** With availability informational and zero windows valid, the item was satisfied unconditionally -- and a gate that never fails is worse than no gate, because it teaches a seller that a satisfied row means something. **`FULFILMENT_CONFIG` gains a definition it never had**: at least one active `core.seller_fulfilment_method` row (ADU-DB-01 v1.7 S13.0). Through v1.3 it was the one readiness item a seller could not satisfy, because nothing existed to write.
- **Obligations** (`GET /v1/seller/deletion/blockers`, 200): `OPEN_RESERVATIONS`  -  `EVIDENCE_AWAITING_CONFIRMATION`  -  `AWAITING_HANDOFF`  -  `REFUNDS_OUTSTANDING`  -  `OPEN_CLAIMS`  -  `SUBSCRIPTION_PAST_DUE` -- the six of S16.9, each independently reported.

### 7.2 Keys are derived, not invented

**INVARIANT -- `message_key` is `error.<group>.<code in lower snake case>`.** `INSUFFICIENT_STOCK` in the cart-line group is always `error.cart_line.insufficient_stock`. Nothing else.

The key is therefore **mechanically derivable from the code**, which is the property that matters: the server and the two locale catalogues cannot drift into disagreement about naming, and S7.3's gate can be a script rather than a review.

**Slots are typed primitives, never pre-formatted text.** Money is `{ amount_minor, currency }`. Timestamps are RFC 3339 UTC. Counts are integers. **The server never formats a number, a date or a currency** -- formatting is per-locale and belongs to the client, and a server-formatted `"45.00 ETB"` is a fragment by another name (S23.1).

**INVARIANT -- an unknown key renders a generic message and logs the key. It never renders the raw key path.** This mirrors ADU-WEB-01 S8.3: a missing translation degrades to something a person can read, never to `error.cart_line.insufficient_stock` displayed on a phone.

**Every envelope carries `retryable: true | false`.** Whether the client may offer *"try again"* is a server decision -- `SOLD_OUT` is not retryable, `RATE_LIMITED` is, and a client guessing gets it wrong in whichever direction is more annoying.

### 7.3 The catalogue completeness gate

**INVARIANT -- CI fails when any code in S7.1 lacks an entry in both the English and the Amharic catalogue.**

This is the smallest useful piece of ADU-WEB-01 S8.3's translation gate made mechanical. The alternative is discovering a missing Amharic error string when a seller sends a screenshot of a blank dialog, which is exactly the failure mode S8.2 warns about -- the Ge'ez looks correct, so a reviewer who does not read Amharic never notices what is absent.

Two consequences worth accepting:

- **A new code cannot ship without its Amharic string.** That is friction, and it is the point.
- **Machine-translated placeholders satisfy the gate.** The gate checks presence, not quality; ADU-WEB-01 S8.3's human-translation requirement is a separate, later gate and this one does not discharge it.

---

## 8. Idempotency

**INVARIANT -- every state-changing `POST` requires an `Idempotency-Key` header.** A request without one is rejected 400. Not optional, because the failure it prevents -- a duplicate order on a retried request -- is silent, expensive and hits the buyers on the worst connections hardest.

Mechanics:

- Key is a client-generated UUIDv7, scoped to `(account_id or device_id, endpoint)`.
- First use: the response is stored with the request hash.
- Replay with the same key **and the same request hash**: the stored response is returned unchanged, with `X-Adulis-Idempotent-Replay: true`.
- Replay with the same key and a **different** hash: 409 `IDEMPOTENCY_KEY_REUSED`. The client has a bug, and silently serving the old response would hide it.
- Records expire after 24 hours -- longer than any plausible retry, shorter than any storage concern.

`PATCH` and `DELETE` on a specific resource are naturally idempotent and do not require a key.

**One consequence worth stating.** The stored response is returned *as it was*, not recomputed. A buyer who retries after the seller has since cancelled a line sees the original success and then the current state on their next read. That is correct: the API is answering *"did my request succeed?"*, and it did.

---

## 9. Pagination, caching and payload

**Cursor pagination everywhere. No offset, anywhere.** The following feed is recency-ordered over a set that changes while the buyer pages (S17.2); offsets duplicate and skip. Cursor is an opaque base64 of `(sort_key, id)`.

```
GET /v1/feed?limit=20&cursor=eyJ0IjoiMjAyNi0...
-> 200 { "data": [...], "next_cursor": "...", "has_more": true }
```

`limit` defaults to 20, caps at 50. The cap is an anti-enumeration control as much as a performance one (A4).

**Caching.** Anonymous storefront reads carry `ETag` and `Cache-Control: public, max-age=60, stale-while-revalidate=300`, served from the Cloudflare edge. Authenticated reads are `private, no-store` -- an order response contains bank details under C3 and must never enter a shared cache.

**Payload budget.** A storefront first-page response targets **under 40KB** uncompressed. It carries the seller header, published statistics, and the first twelve products with thumbnail URLs only. Card and full derivatives are fetched by the image layer, not embedded. This is a number to measure against, not an aspiration -- it is the response standing between a bio-link tap and a conversion on a slow connection.

---

## 10. Rate limiting

Two tiers, matching ADU-WEB-01's decision for the website.

| Tier | Where | Applies to |
|---|---|---|
| **Edge** | Cloudflare rules, by IP and ASN | All anonymous reads: storefront, search, seller lookup, post-link resolution |
| **Origin** | Postgres token bucket, by account and by phone | OTP request, session creation, order creation, claim filing, message sending, evidence upload, step-up request |

S23 of ADU-PRD-01 requires origin limiting on auth, OTP, reservation, claim and proposal endpoints. **OTP is limited by phone number as well as by account**, because the account does not exist yet when the abuse happens.

[!] **The origin limiter needs one new table**, `core.rate_limit_bucket`. Feedback to ADU-DB-01 in S16, along with the accepted cost: one small write per limited request, on top of the session read, on a single Postgres. Affordable at the modelled volume and worth measuring before it is not.


### 10.1 Anti-enumeration -- the concrete posture

A4's distinction: **scraping one storefront is what a browser does and cannot be prevented. Enumerating all of them builds a competitor's target list of every Adulis seller, ranked by how well each is doing.** Only the second is worth engineering against.

**The tension to name before designing around it.** Storefronts are meant to be indexed. A bio link resolves to a page whose job is to prove value and drive an install (S3.1), and a search engine finding that page is a free version of the same job. **So aggressive bot detection works against the product**, and any control here has to be one a well-behaved crawler passes. That rules out CAPTCHAs, JS challenges and user-agent blocking on storefront routes, and leaves shape and rate.

**Structural controls -- these do the real work.**

| Control | Rule |
|---|---|
| **No internal identifier is public** | Storefronts are `/{handle}`, products `/{handle}/{slug}`. UUIDv7 is time-ordered; a UUID in a public URL leaks signup order and admits walking the space |
| **No unqualified list endpoint exists** | There is no `GET /v1/sellers`, no `GET /v1/storefronts`, and no sitemap enumerating sellers beyond what the seller themselves has published |
| **Lookup requires intent** | `seller_lookup` takes a minimum 2-character query, returns at most 10, and never suggests (S7.6 requires this for product reasons; it is also the anti-enumeration control) |
| **Paging is capped** | `limit` maxes at 50 and cursors are opaque, so a cursor cannot be edited into a scan |

**Rate limits -- starting values, to be tuned against measurement.**

| Route | Edge limit | Key |
|---|---|---|
| `GET /v1/storefronts/*` | 60/min | IP  -  600/min per ASN |
| `GET /v1/storefronts/*/search` | 30/min | IP |
| `GET /v1/sellers/lookup` | 20/min | IP |
| `POST /v1/post-links/resolve` | 10/min | IP |
| `POST /v1/auth/otp/request` | 3/hour per phone hash  -  10/hour per IP | Origin |
| `POST /v1/orders` | 20/hour | Account |
| `POST /v1/claims` | 5/day | Account |
| `POST /v1/conversations/*/messages` | 60/min | Account |

**Phone-keyed limits use a hash, never the number**, matching `core.phone_reuse_block` -- the limit has to work before an account exists, which is exactly when the raw number would otherwise be sitting in a counter table.

**What is accepted, explicitly.** A determined party can scrape any storefront they already know the handle of, and will. Every field they obtain is a field the page renders to a buyer, and S13.2 requires it to be there -- published statistics are the differentiator, and withholding them from the anonymous surface would break the product to inconvenience a competitor. **Detection rather than prevention is the honest posture:** anonymous read volume is logged by ASN, and a distribution that shifts is a signal to look at, not an automatic block.

---

## 11. Events and notification delivery

**INVARIANT -- the endpoint emits the event; the client never does.** S20's schema exists to answer questions about behaviour, and a client-emitted event is missing exactly when the client crashed, which is the case worth knowing about.

Two exceptions, both unavoidable and both narrow: `notification_permission_result` and `follow_intent_web` describe things only the client observes. Both are `POST`ed to `/v1/events` against a closed allow-list, and **any other event name on that endpoint is rejected 400** rather than accepted and ignored.

Every event carries `market_id`, `seller_type`, `eligibility_path` and `seller_level`, resolved server-side from the session (S20). The client never supplies them.

### 11.1 Notification delivery -- closing the A6 race

The dispatch guard is correct and insufficient. FCM delivers whenever the device next has connectivity, so a buyer whose payment confirms four minutes after dispatch still receives *"Your order from Alem is released in 2 hours."* The database honoured the invariant; the buyer experienced it being broken.

**The fix is displacement, not expiry.** v1.0 only narrowed the window. Four mechanisms, in the order they take effect:

**1. The dispatch guard** (ADU-DB-01 S20). The sender re-reads order state immediately before handing the message to the transport, and `WHERE clock_stopped_at IS NULL` skips any confirmed order. This stops the message being sent at all in the common case.

**2. Time-to-live bounded by relevance.** A push that cannot be delivered inside its own relevance window is discarded by the transport rather than queued.

| Notification | TTL | Reason |
|---|---|---|
| Morning reminder | 6h | Useless after the working day it refers to |
| Two-hour expiry warning | 2h | Outlives its own subject if it survives longer |
| Payment confirmed | 24h | Still worth receiving late |
| Payout change | **No TTL** | Not suppressible, not expirable (S10.4) |
| Claim update, escalation | 24h | |

**3. A collapse key per order.** Every notification concerning an order carries `collapse_key = "order:{order_id}"` and, on the client, `tag = order_id`. A newer message replaces an older undelivered one at the transport, and replaces the older displayed one in the tray.

**4. Payment confirmation is sent on that key, and this is what actually closes the race.** Confirming a payment sends a payment-confirmation notification -- a type S17.1 already permits on all tiers and all levels -- which **supersedes any expiry warning still queued or still on screen**. The buyer does not receive a correction; they receive the right message in the place the wrong one was.

**INVARIANT -- a notification payload asserts no state the app cannot re-verify on open.** It carries `order_id`, `notification_id`, a deep link and the display text. It carries no amount, no deadline the app then treats as authoritative, and no state name. The order card re-reads on every view and is the authoritative surface -- S17.3 already requires that for buyers who denied permission, and it does double duty here.

**The residual, stated rather than papered over.** A device that is online when the warning arrives and whose owner reads it in the seconds before the confirmation lands sees a message that was true when sent and is not true when read. Nothing closes that without data-only pushes, which Android throttles in Doze on precisely the devices this product targets. The window is seconds to minutes, the correction is automatic, and the in-app card never shows the stale claim.


---

## 12. Endpoint catalogue

Legend: **A** anonymous  -  **B** buyer (mobile)  -  **S** seller (`SELLER_WEB`)  -  **C** courier  -  **M** also reachable from the Seller Companion on mobile  -  **S** step-up required  -  **I** idempotency key required.

**The M marking is the Companion's Phase 1 scope** (ADU-ARCH-01 S3.1). It is enforced by `core.permission.surfaces`, not by this table -- the table records what the database already decides.

### 12.1 Public -- anonymous

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/bootstrap` | S3.1 |
| GET | `/v1/storefronts/{handle}` | Header, published statistics, trust level, handoff count (S5.3), **and a resolved availability state** (v1.5) |
| GET | `/v1/storefronts/{handle}/products` | Seller's display order is the default (S7.5) |
| GET | `/v1/storefronts/{handle}/products/{slug}` **-- `slug` is a real column since ADU-DB-01 v1.12 (G1.9); it was served by `id` before, which put a UUID on an anonymous URL against doctrine 5** | Includes structured attributes, variants, stock with `confirmed_at` |
| GET | `/v1/storefronts/{handle}/search` | Scope is one seller, always (S7.5) |
| GET | `/v1/storefronts/{handle}/reviews` | Badge per review (S12) |
| GET | `/v1/sellers/lookup?q=` | Returns sellers only, capped, never suggests (S7.6) |
| POST | `/v1/post-links/resolve` **I** | Returns a **list** -- one post commonly features several products (S7.5.1) |
| GET | `/v1/categories` | |

**INVARIANT -- the storefront response carries the seller's trust level and completed handoff count as page content** (S3.1). It is not a separate call. The web view must answer everything the chatbot would, and a second round trip on a slow connection is a page that renders without the trust signal.

**INVARIANT -- the install prompt appears at the reserve action, never on arrival** (S3.1). The API contributes by having no reserve endpoint reachable without a session -- the web client cannot offer the action even by mistake.

### 12.2 Identity and session

> **v1.8 -- three corrections to `POST /v1/auth/otp/verify`, and the first is a security boundary.**
>
> **D-180: the request REJECTS `audience`.** It is stamped on the challenge at creation, from the device's market, and read from the row. **Ignoring the field would leave a client sending it forever**, and a client that sends a field the server ignores is a client whose author believes it matters.
>
> **D-101: the request carries `age_declared_over_18`**, and a new account that cannot be created without it returns **`AGE_DECLARATION_REQUIRED`** -- never a bare `VALIDATION_FAILED`. **The control is rendered to everyone; the server decides who needs it**, because asking the client to know whether a phone has an account is the oracle S19 forbids.
>
> **D-89: a successful verify claims a matching pending courier invite.** Server-side, matched on the authenticated normalized phone, idempotent, and the relationship creation is in the same transaction. **The client cannot name an invite.**

[!] **The `roles[]` in the response differs for an invited phone** -- `["COURIER"]` where an uninvited one has none. **That is designed disclosure and it is post-authentication**: the observer holds a valid code, so they control the number, and telling the person who controls a phone that someone invited them discloses nothing they are not entitled to.

> **Authentication is the boundary the enumeration invariant stops at.** Before it, nothing distinguishes a known phone from an unknown one. **After it, the account's own facts are the account's to see.** The difference must appear **only** after successful verification -- if it reaches `request` or `resend`, that is S19 and a different answer entirely.


| Method | Path | |
|---|---|---|
| POST | `/v1/auth/otp/request` **I** | Transport retries only |
| POST | `/v1/auth/otp/resend` | **Not idempotency-keyed.** A user tapping *resend* calls this; only a lost response reuses a key (X11) |
| POST | `/v1/auth/otp/verify` **I** | Creates buyer identity on first use (S6.1) |
| GET | `/v1/auth/sessions` | B S C |
| DELETE | `/v1/auth/sessions/{id}` | B S C |
| POST | `/v1/auth/sessions/revoke-others` **S** | **`CONSOLE` only** -- D-34. It is a step-up action, and ADU-AUTH-01 S9.1 puts every step-up on the console. v1.6 listed it for B S C, which would have made it reachable from a mobile session |
| POST | `/v1/auth/step-up/request` **I** | |
| POST | `/v1/auth/step-up/verify` | |
| POST | `/v1/devices` **I** | Anonymous registration; binds at identity creation (S11.1) |
| PATCH | `/v1/devices/{id}` | Push token, permission result |
| POST | `/v1/auth/recovery` **I** | Number changed or SIM lost -> operator review, not self-service (S6.6) |

### 12.3 Cart -- B, plus anonymous by device

| Method | Path | |
|---|---|---|
| GET | `/v1/cart` | Re-checks availability per line on every view (S8.2) |
| POST | `/v1/cart/lines` **I** | 409 `CART_SELLER_CONFLICT` on a second seller (S8.1) |
| PATCH | `/v1/cart/lines/{id}` | |
| DELETE | `/v1/cart/lines/{id}` | |

Cart endpoints accept `X-Adulis-Device` without a session, per C6. Every line carries `available`, `available_checked_at` and the live price -- a cart is a draft, and the interface has to say so rather than imply it.

### 12.4 Orders -- B

| Method | Path | |
|---|---|---|
| POST | `/v1/orders` **I** | Whole-cart revalidation in one transaction; 409 with complete `items[]` (S8.3) |
| GET | `/v1/orders` | Cursor paged |
| GET | `/v1/orders/{id}` | Authoritative order card; re-read on every view (A6) |
| GET | `/v1/orders/{id}/payment-instructions` | **The C3 disclosure path.** S12.7. **A non-buyer receives 404, never 403** -- D-30 |
| POST | `/v1/orders/{id}/payment-evidence` **I** | Upload via signed URL, then commit |
| POST | `/v1/orders/{id}/reservations/{rid}/cancel` **I** | Per line (S9.4) |
| POST | `/v1/orders/{id}/cancel` **I** | Convenience: cancels every remaining line |
| POST | `/v1/orders/{id}/confirm-receipt` **I** | The tapped tier -- medium weight, no level (S11.3) |
| POST | `/v1/orders/{id}/review` **I** | One per order (S12) |
| POST | `/v1/orders/{id}/refunds/{rid}/acknowledge` **I** | Explicit buyer action, never inferred (S10.5) |

**Claims** -- omitted from the v1.1 catalogue in error, though referenced in S10's rate limits and S13's function mapping.

| Method | Path | |
|---|---|---|
| POST | `/v1/claims` **I** | B |
| GET | `/v1/claims`  -  `/v1/claims/{id}` | B S |
| POST | `/v1/claims/{id}/evidence` **I** | B S -- bank record. **A single transaction, not a statement** (X15) |
| POST | `/v1/claims/{id}/evidence-export` **I** | B -- the buyer's own order, chats and payment records |
| POST | `/v1/seller/claims/{id}/remedy` **I** | S -- `REFUND` or `FULFIL`, the seller's choice (X15) |

**INVARIANT -- no endpoint returns another party's identity.** The evidence export carries the requesting buyer's own transaction and nothing about who the seller is. Seller identity -- verified legal name, ID type and verification date -- is disclosed only to law enforcement or lawful process, through an operator path that is not part of this contract (X15).

`GET /v1/orders/{id}` returns `expires_at` as an absolute timestamp and never a duration -- S17.3's rule for notifications applies with equal force to the card the buyer checks at 2am.

### 12.5 Payment instructions -- the C3 endpoint

The single decryption path in ADU-DB-01 S13.6, surfaced.

```
GET /v1/orders/{id}/payment-instructions
-> 200 {
    "bank_code": "CBE",
    "account_number": "1000123456789",
    "account_name": "Alem Tesfaye",
    "amount_minor": 145000,
    "currency": "ETB",
    "reference": "ADU-7K3M9"
  }
```

- Calls `financial.render_payment_instructions(order_id, actor)` and nothing else.
- The function verifies the caller is the buyer on that order and the order is payable, then logs to `financial.access_log` in the same transaction. **The endpoint performs none of those checks itself** -- duplicating them in NestJS creates a second place to get them wrong and a first place to skip the log.
- `Cache-Control: private, no-store`. This response must never enter a shared cache.
- 409 where the order is not in a payable state; 403 where the caller is not the buyer.

**No other endpoint in this contract returns an unmasked account number.** Seller, team, support and admin surfaces receive `account_last4`, because that is the only value `core` holds.

### 12.6 Handoff -- B and C

| Method | Path | |
|---|---|---|
| POST | `/v1/handoffs/sync` **I** | Batch, per-item outcomes, never fails as a unit |
| GET | `/v1/seller/orders/{id}/qr` **M** | The seller displays; the buyer scans (S11.1). **409 `ORDER_NOT_READYABLE` before `PAYMENT_CONFIRMED`** -- R20. **Cached by the app for offline display at a doorway** |
| POST | `/v1/courier/orders/{id}/custody-accept` **I** | C -- Event A |
| POST | `/v1/seller/orders/{id}/custody-transfer` **I** | S -- Event A, seller side |

```
POST /v1/handoffs/sync
{ "scans": [ { "nonce": "...", "order_ref": "...", "signed_at": "...", "signature": "..." }, ... ] }

-> 200 { "results": [
    { "nonce": "...", "outcome": "VALID",             "counts_toward_level": true  },
    { "nonce": "...", "outcome": "LATE",              "counts_toward_level": false },
    { "nonce": "...", "outcome": "REJECTED_REPLAY",   "counts_toward_level": false },
    { "nonce": "...", "outcome": "REJECTED_HORIZON",  "counts_toward_level": false }
  ] }
```

**INVARIANT -- a courier session cannot submit a buyer scan** (S11.2). Enforced by the composite foreign key in the database; the endpoint returns 403 rather than letting the constraint surface as a 500.

**An unsynced scan is visible to the buyer as pending, not complete** (S11.4). The client holds it locally, shows it as pending with a plain explanation, and it must survive the app being closed and a reinstall within the horizon.

### 12.6.1 Scan sync in full

**INVARIANT -- the client signs once, at the moment of scanning, and stores the signed blob. Every retry transmits the identical bytes.** It never re-signs. This is what makes the discrimination below possible, and without it a retry is indistinguishable from an attack.

**Request.** Up to **50** scans; above that, 413 `PAYLOAD_TOO_LARGE`. `Idempotency-Key` covers a whole-batch retry; the per-nonce rules below cover a partial resend, which is the more common case because the client drops items as they settle.

**Processing.**

- **Each item is processed in its own transaction.** This is what makes "never fails as a unit" true rather than aspirational -- a rollback triggered by item three cannot take items one and two with it.
- **Order is deterministic: ascending `signed_at`, ties broken by array position.** Two scans in one batch sharing a nonce resolve the same way on every retry.
- The batch returns 200 whenever it was well-formed. **A batch of six rejections is a successful request** -- the client asked what happened to six scans and was told.

**Outcomes.**

| `outcome` | Meaning | `counts_toward_level` | Client action |
|---|---|---|---|
| `VALID` | In-window scan (S11.4) | true | Show complete. Drop the local copy |
| `LATE` | Signed after the window closed | false | Show complete, badge "confirmed by buyer". Drop |
| `REJECTED_REPLAY` | Nonce seen with a **different** signed payload | false | Drop. Surface nothing to the buyer |
| `REJECTED_HORIZON` | Beyond `offline_sync_horizon` | false | Show as expired, explain plainly. Drop |
| `REJECTED_SIGNATURE` | Signature does not verify | false | Drop and log |
| `REJECTED_UNKNOWN_ORDER` | Order does not exist or is not visible | false | Drop and log |

**The replay correction.** v1.0 said a retried sync of an already-accepted nonce returns `REJECTED_REPLAY`. That was wrong, and would have shown a buyer *"rejected"* for a handoff that had in fact succeeded -- the worst possible outcome at a doorway.

**INVARIANT -- a nonce arriving with a byte-identical signed payload from the same account is an idempotent retry and returns the original stored outcome, with `replay: true`.** A nonce arriving with a *different* payload, or from a different account, is `REJECTED_REPLAY`. The discriminator is the signed payload, not the nonce.

```
POST /v1/handoffs/sync
{ "scans": [ { "nonce": "...", "order_ref": "...", "signed_at": 1756025642817,
               "signature": "..." } ] }

-> 200 { "results": [
    { "nonce": "...", "order_ref": "...", "outcome": "VALID",
      "counts_toward_level": true,  "replay": false, "order_state": "HANDED_OFF" },
    { "nonce": "...", "order_ref": "...", "outcome": "LATE",
      "counts_toward_level": false, "replay": true,  "order_state": "HANDED_OFF" }
  ] }
```

`signed_at` is **epoch milliseconds**, per the A5 rule in S1 -- an integer, so there is no timezone to get wrong and no parser to disagree with.

**The client may retry freely.** Every outcome is terminal for that nonce, an identical resend returns the same answer, and a transport failure costs a round trip rather than a handoff. That is the property a courier on an intermittent connection actually needs.

### 12.7 Chat -- B and S

| Method | Path | |
|---|---|---|
| POST | `/v1/conversations` **M I** | Begins a conversation. **Takes NO anchor since v1.8 -- D-87.** The anchor moved to the message (D-73) |
| GET | `/v1/conversations` **M** | Cursor paged. **`?as=buyer` or `?as=seller&seller_id=` is required** -- R10 |
| GET | `/v1/conversations/{id}/messages` | |
| POST | `/v1/conversations/{id}/messages` **M I** | Body carries either `text` or `chip_id`. **Human messaging is free on every tier**; the AI cascade is what is metered (S15) |
| POST | `/v1/conversations/{id}/escalate` **I** | Free escalation (S15.1 layer 5) |

The bot's reply arrives as a message with `sender_kind: "BOT"` and a `resolution_path`. **The response body carries `template_key` and `slots`, never assembled prose** -- the same rule as S7, for the same reason, and because S15.1 already forbids generated text anywhere in the system.

**Chat is in-app only for the buyer** (S15). The seller's inbox is a console surface (ADU-CON-03 SC-20), so this group is reachable from `CONSOLE` in the seller scope.

> **v1.8 -- the anchor is on the MESSAGE, not the conversation** (D-73, D-87). `POST /v1/conversations` takes no anchor and `chat.conversation`'s two columns are dropped.
>
> **A thread is a relationship; a question is about a thing.** `one_conversation_per_pair` means a buyer and a seller have exactly one thread, so a per-conversation anchor answered the buyer's **second** product question against the **first** product's slots -- **a wrong answer with better containment metrics than the missing anchor it replaced**, which S15.3's loop would then optimise toward.
>
> **Without an anchor a slotted answer template cannot be filled, so the assistant escalates instead of answering.** That is worse than a missed answer: **containment then measures the missing anchor rather than the assistant**, and S15.3's improvement loop optimises against a signal that is wrong about which intents are failing.

> **R10 -- the scope parameter has no default.** One account holds buyer and seller roles simultaneously (ADU-ARCH-01 S2), so an unscoped list interleaves a seller's business with their own shopping, and a defaulted scope is S8.3's two-tab bug in list form. Absent -> 400 `SCOPE_PARAMETER_REQUIRED`. `as=seller` additionally requires `X-Adulis-Seller` to match `seller_id`.

### 12.8 Follows and feed -- B

| Method | Path | |
|---|---|---|
| POST | `/v1/sellers/{handle}/follow` **I** | Available before purchase, from every surface (S17.1) |
| DELETE | `/v1/sellers/{handle}/follow` | |
| PATCH | `/v1/follows/{handle}/preferences` | |
| GET | `/v1/feed` | Recency-first over the followed set only (S17.2) |

**INVARIANT -- the feed endpoint accepts no ranking, sorting or recommendation parameter.** There is no `?sort=`, no `?recommended=true`, no `?similar_to=`. S17.2 keeps this outside V3, and an endpoint that accepts a ranking parameter is one flag away from being a recommender.

### 12.9 Seller -- onboarding and verification -- S

| Method | Path | |
|---|---|---|
| POST | `/v1/seller` **I** | |
| GET | `/v1/seller/readiness` | Complete list, plain language, resolving action per item (S4.6) |
| PATCH | `/v1/seller/profile` | |
| POST | `/v1/seller/social-accounts` **I** | Issues the account-control code |
| POST | `/v1/seller/social-accounts/{id}/verify` **I** | Fetch and match; captures follower count |
| POST | `/v1/seller/identity-verification` **I** | **Operator-only since v1.7 -- G1.1.** A seller session receives **403**. **No image ever reaches Adulis** (S13.1) |
| PUT | `/v1/seller/availability` | **Informational.** One hour to a full day, several windows per day, **zero windows valid**. No change log |
| GET | `/v1/seller/availability-overrides` | **New in v1.5.** Closure dates. Cursor paged, ascending by date, `?from=` defaulting to today |
| PUT | `/v1/seller/availability-overrides/{date}` | **New in v1.5.** Marks the store closed on that date, or updates the note. **Idempotent by path**; no key |
| DELETE | `/v1/seller/availability-overrides/{date}` | **New in v1.5.** Removes the closure. **204 whether or not it existed** |
| PATCH | `/v1/seller/company-details` **I** | Company sellers. Satisfies `COMPANY_DETAILS`. Fields: `registration_identifier`, `trade_licence_number`, `tin`, `representative_person_id`, `representative_relationship` -- **ADU-DB-01 v1.10 S7.1** |
| GET  -  PUT | `/v1/seller/fulfilment-methods` | **New in v1.4.** `BUYER_COLLECTION`  -  `SELLER_DELIVERY`  -  `COURIER_DELIVERY`, each with a `handoff_note`. **At least one active** or 422 `FULFILMENT_METHOD_REQUIRED` |
| POST | `/v1/seller/ownership-transfer` **S I** | **New in v1.4.** Owner only; step-up bound to the target account (ADU-AUTH-01 S16) |

`GET /v1/seller/readiness` returns **200 with `items[]`**, not an error. Readiness is a state a seller returns to across days, on a phone, between other work -- modelling it as a failure would be wrong about what it is, and S4.6 is explicit that a seller who cannot tell why their store is not live abandons setup.

> **G1.8 -- inviting a courier succeeds whether or not that phone has an Adulis account, and the response is byte-identical either way.** A pending invite is written and surfaces when that person next signs in (ADU-DB-01 v1.12 S6.3a).
>
> **v1.6 returned 404 for an unregistered number, and that is a registration oracle.** Anyone holding a seller account could test arbitrary phone numbers for Adulis membership -- the same class as S19's scope failure returning 404 rather than 403, and ADU-AUTH-01 S22's rule that a rate-limit rejection never reveals whether a number belongs to an account. **Here the better user experience and the correct security posture are the same build.**
>
> **Couriers only.** Team invites keep the existing behaviour, because team is Business tier and post-beta -- an asymmetry recorded as a decision rather than left as an oversight.

**Availability overrides -- R27, and the shape is the point.**

`{date}` is an ISO calendar date in the **market's timezone**, not UTC. `PUT` takes `{ note? }`, capped at 120 characters; the body may be empty, because **the existence of the override is the fact and the note is decoration** (ADU-DB-01 v1.8 S13.1a -- there is no `is_closed` field to send).

> **INVARIANT -- `PUT` and `DELETE` on an override carry no `Idempotency-Key`, and this is not an exception to S8.** S8 requires a key on every state-changing **`POST`**, because a `POST` creates a new object on each call and a lost response makes a retry indistinguishable from a second intent. `PUT` to a path that names its own primary key is idempotent by construction, and `DELETE` returns 204 whether the row existed or not. A key here would be ceremony that protects nothing.

**A `PUT` more than 24 months ahead is `VALIDATION_FAILED` at the edge.** Not a new error code: the taxonomy in S7.1 is closed, and a date sanity check does not earn an entry in it. The bound exists so that a client bug cannot write year 9999 into a table nobody purges.

**There is deliberately no whole-set `PUT`.** ADU-DB-01 v1.8 retains past closures, so a set-replace would need the unwritten rule *replaces only dates on or after today* -- and an agent reading `PUT /v1/seller/availability-overrides` will implement a full replace. One date per request removes the ambiguity rather than documenting around it.

**The identity-verification endpoint never accepts an image.** There is no multipart body, no `document` field, no upload URL. Adulis stores date, verifier kind, ID type, name and a keyed hash -- and no photograph, because the schema has no column for one.

> **G1.1 -- operator-only at MVP.** There is no KYC vendor and no video call; an operator attests directly under an `IDENTITY_REVIEWER` or `ADMIN` grant, and the attestation records **`verifier_kind = 'OPERATOR_ATTESTED'`** -- a value added in ADU-DB-01 v1.12 because neither `KYC_VENDOR` nor `VIDEO_CALL` would have been true.
>
> **Before this ruling the endpoint wrote an attestation from fields the client supplied.** A seller holding `seller.identity:manage` and a step-up code could assert their own identity verification -- the IDENTITY eligibility path, and at Pro the verified badge. **The hole was open from C6 until v1.7.**

**The `AUDIENCE` eligibility path is unaffected and carries the beta.** ADU-PRD-01 S4.1 admits a seller on either path, and a cohort of creators takes the audience one anyway.

### 12.10 Seller -- catalogue and stock -- S

| Method | Path | |
|---|---|---|
| POST  -  GET  -  PATCH | `/v1/seller/products` **I** | |
| GET | `/v1/seller/products/{id}` | **New in v1.4.** The editor's read. Variants, attributes, media, social posts, publication state |
| POST | `/v1/seller/products/{id}/publish` **I** | 409 with readiness `items[]` where blocked |
| POST | `/v1/seller/products/{id}/unpublish` **I** | **New in v1.4.** Removes from the storefront; keeps the row. Required on downgrade and by seller choice (S7) |
| DELETE | `/v1/seller/products/{id}` | **New in v1.4.** 409 `PRODUCT_HAS_ACTIVE_ORDERS` where any reservation is live |
| POST | `/v1/seller/products/{id}/variants` **I** | |
| PATCH | `/v1/seller/variants/{id}` | **New in v1.4.** Price, status, attributes |
| DELETE | `/v1/seller/variants/{id}` | **New in v1.4.** Withdraws. `VARIANT_WITHDRAWN` already exists as a cart code for exactly this |
| POST | `/v1/seller/products/{id}/images` **I** | Signed upload; max five (S7.4) |
| DELETE | `/v1/seller/products/{id}/images/{position}` | **New in v1.4.** |
| PUT | `/v1/seller/products/{id}/images/order` | **New in v1.4.** The **whole** ordering in one request -- `UNIQUE (product_id, position)` makes a two-step swap a constraint violation, so a reorder is one transaction or it is a defect |
| POST | `/v1/seller/products/{id}/video` **I** | One clip; <=480p, <=30s, compressed on device |
| DELETE | `/v1/seller/products/{id}/video` | **New in v1.4.** |
| POST | `/v1/seller/products/{id}/social-posts` **I** | Canonical id resolved server-side |
| POST | `/v1/seller/variants/{id}/stock` **I** | Writes a StockEvent. Never a direct count set |
| POST | `/v1/seller/variants/{id}/confirm-stock` **I** | Resets `stock_confirmed_at` (S13.3) |
| GET | `/v1/seller/variants/{id}/stock-events` | **New in v1.4.** Cursor paged. The same evidence a claim attaches as `STOCK_EVENTS` |

**Media upload is signed-URL then commit, never a proxied multipart body.** A 4MB image through the API server is bandwidth paid twice and a request timeout on a slow uplink. The commit call registers the derivatives; **the original is never retained** and there is no field in which to name it.

`POST /v1/seller/variants/{id}/stock` takes a `delta` or an absolute `count`, and in both cases the server writes a `stock_event` -- the count is never assigned. S7's invariant lives in a trigger, and the endpoint shape must not suggest otherwise.

### 12.11 Seller -- orders and payout -- S

| Method | Path | |
|---|---|---|
| GET | `/v1/seller/orders` **M** | |
| GET | `/v1/seller/orders/{id}` **M** | **New in v1.4.** The order-detail read. Needed by the console **and** by the Companion's Phase 1 order surface, which v1.3 specified without the endpoint that feeds it |
| POST | `/v1/seller/orders/{id}/ready` **M I** | **New in v1.4.** Sets `ready_at` and notifies the assigned courier. **Idempotent by state, not only by key** -- a second call is a no-op, not a second notification. 409 `ORDER_NOT_READYABLE` before `PAYMENT_CONFIRMED` |
| POST | `/v1/seller/orders/{id}/payment/confirm` **M I** | **"Confirm Payment Received"**, never "Accept Payment". The seller verifies in their own bank first (S10.1) |
| POST | `/v1/seller/orders/{id}/payment/reject` **M I** | **"Payment Not Received".** W6; ratification row 8. First rejection opens a 12-hour retry window; the second ends the order |
| GET | `/v1/seller/orders/{id}/payment-evidence` **M** | Logged access, no justification required (S10.3). **Streamed, `private, no-store`** (R18). **Never rendered in a notification preview**, never at a predictable URL |
| POST | `/v1/seller/orders/{id}/reservations/{rid}/cancel` **M I** | Per line. Surfaced as **"Can't Fulfil"**. **There is no accept action -- reservations are never gated on the seller** |
| POST | `/v1/seller/orders/{id}/refunds` **I** | Seller reports; buyer acknowledges separately |
| POST | `/v1/seller/orders/{id}/reissue-instructions` **S I** | Single order only. No bulk endpoint exists (S8.5) |
| POST | `/v1/seller/orders/{id}/courier-assignment` **I** | |
| GET | `/v1/seller/payout` | Returns `account_last4` only |
| POST | `/v1/seller/payout` **S I** | Enters `PENDING`; activates after the delay |
| DELETE | `/v1/seller/payout/pending` | **No step-up** -- reverting is easier than changing |
| GET | `/v1/seller/payout/history` | **New in v1.4.** Masked, append-only. S10.4 requires the change to be *"visible in the seller console and in the account history"* and v1.3 gave no way to read it |
| GET  -  POST  -  DELETE | `/v1/seller/couriers` **I** | Invite by phone; the courier authenticates with their own OTP. Revoking ends assignment-scoped access immediately. **`POST` succeeds whether or not the number has an account** -- G1.8 |
| GET | `/v1/seller/reviews` | **New in v1.4.** Seller-scoped, with badges and item ratings. **Read-only -- there is no field a seller can write on a review** |
| GET | `/v1/seller/claims` | **New in v1.4.** Seller-scoped. `GET /v1/claims` is buyer-shaped |

**There is no bulk reissue endpoint**, and its absence is deliberate: S8.5 permits reissue on *a single named order* and never in bulk, and an endpoint accepting an array of order ids would be that rule broken at the wire while the database still believed it held.

### 12.12 Seller -- team, subscription, deletion

| Method | Path | |
|---|---|---|
| GET  -  POST  -  DELETE | `/v1/seller/team` **S I** | Business tier; Owner/Admin only |
| GET | `/v1/billing/subscription` | S or W |
| POST | `/v1/billing/purchase-intent` **S I** | Console endpoint. The IAP restriction is gone with the seller app |
| POST | `/v1/billing/mark-transferred` **I** | Console endpoint |
| POST | `/v1/seller/closure` **I** | Enters `CLOSING`. Blocks new reservations; existing orders stay fully operable |
| DELETE | `/v1/seller/closure` | Returns to `ACTIVE`. Reversible by design |
| GET | `/v1/seller/deletion/blockers` | 200 with `items[]` (S16.9) |
| POST | `/v1/seller/deletion` **S I** | Owner only for company sellers |

> **R4 -- the billing group is `CONSOLE` only, and a `MOBILE` session receives 403.** v1.3 still carried a v1.2 paragraph reading *"there is no seller app... the restriction has nothing left to restrict."* That was true when the seller had no app. **ADU-ARCH-01 v2.0 gave the seller a Companion**, and S4.1 reinstated the In-App Purchase constraint in full force -- so the two paragraphs contradicted each other one page apart, and an agent building this group from S12.12 would have omitted the audience guard entirely. The omission is invisible until an App Store reviewer finds a price in a mobile response.
>
> The three billing endpoints carry `surfaces = '{CONSOLE}'` in `core.permission`. **403, never a redirect** -- a redirect is itself a link to an external purchase mechanism.

**G1.3 -- closure survives a deletion block.** ADU-CON-03 SC-29 separates the two: closing is reversible and stops new obligations; deletion is permanent and is blocked while the account holds an order in `PAYMENT_SUBMITTED` or `PAYMENT_CONFIRMED`.

> **`POST /v1/seller/closure` remains available when `POST /v1/seller/deletion` is blocked.** A buyer or seller who wants out immediately closes now and deletes when the money settles. **Every blocker names its clearing action, and `items[]` carries all of them, never the first** -- a bare refusal is what fails an app-store review; a stated obligation with a route through it does not.

**G1.6 -- `POST /v1/seller/ownership-transfer` has a policy.** It had an endpoint, a permission and a function, and no rules; ADU-RUL-01 supplies them.

| | |
|---|---|
| **Who may receive** | An account holding an **active `ADMIN` membership** on that seller. Not an arbitrary phone number -- the recipient must already be known to the store |
| **Notice** | Both parties notified **unsuppressibly**. Activation after **24 hours**, cancellable by the outgoing owner throughout |
| **What the outgoing owner keeps** | An `ADMIN` membership, written in the same transaction. **Payout access ends at activation** |
| **Blocked while** | A payout change is pending, or a claim is open |

> **The 24-hour delay is the design, not a formality.** It is the same control as a payout change and for the same reason: **a compromised Owner session cannot hand the store away before anyone notices**, and the unsuppressible notice is what makes the delay useful rather than merely slow.

**G1.7 -- the subscription lifecycle, provisional pending the commercial rebuild.** Three rules: **an intent expires after 24 hours**; a subscription becomes `ACTIVE` **only on a payment reconciled against a live intent**, never on the intent alone; and **the rate is locked at intent creation**, so the price shown is the price charged.

Nothing depends on this today -- beta sellers pay nothing -- but v1.6's endpoints opened a collection record that no path closed.

### 12.13 Seller -- analytics -- S

**New group in v1.4.** v1.3 specified zero analytics endpoints while ADU-PRD-01 S16.1 promises every tier some analytics, `analytics.event` is fully specified with 68 seeded definitions, and three permissions exist to read it. No seller could read any of it.

| Method | Path | |
|---|---|---|
| GET | `/v1/seller/analytics/overview` | Essential counts. **Every tier, including Free and Beta** |
| GET | `/v1/seller/analytics/full` | Views, reservations, conversion, funnel. Entitlement-gated |
| POST | `/v1/seller/analytics/export` **I** | Business tier. Async; returns a job handle, not a file |

**INVARIANT -- analytics responses carry resolved numbers, never raw event rows.** A client that receives events and aggregates them is a client computing business state, and two clients will compute it differently.

**Entitlement is resolved, not read from tier.** `billing.fn_effective_limit` decides. **Beta sellers receive the Assisted set, not the Free set** (ADU-PRD-01 S16.10) -- `BETA` is a distinct subscription state precisely so that beta behaviour can be separated from the behaviour of sellers who chose Free on the merits, and rendering them as Free corrupts the evidence every launch decision rests on.

`POST /v1/seller/analytics/export` is asynchronous because an export over a year of events is not a request-scoped operation. The job writes to R2 and the seller is notified.

### 12.14 Notifications -- B and S

**New group in v1.4.** `seller.notifications:read` and `seller.notifications.preferences:write` both existed as permissions with no endpoint.

| Method | Path | |
|---|---|---|
| GET | `/v1/notifications` **M** | Cursor paged. **`?as=buyer` or `?as=seller&seller_id=` required**, same rule as S12.7 |
| POST | `/v1/notifications/{id}/read` **M I** | Read state syncs across surfaces -- one list, two clients |
| POST | `/v1/notifications/read-all` **M I** | |
| GET  -  PATCH | `/v1/seller/notification-preferences` **I** | |

> **INVARIANT -- a notification with `suppressible = false` is not togglable, and the preferences endpoint rejects an attempt to disable one with 422.** Payout-change notifications are the case: the database enqueues them with `suppressible = false` and the sender's filter carries `WHERE suppressible`. The endpoint must refuse rather than silently accept and ignore, or a seller will believe they turned something off that will keep arriving.

### 12.15 Reports -- B and S

**New group in v1.4.** ADU-PRD-01 S18 requires a report mechanism on **every** piece of user content, names it an app-store requirement, and puts it in V1 scope. `core.content_report` exists. Nothing reached it.

| Method | Path | |
|---|---|---|
| POST | `/v1/reports` **I** | Any surface, any authenticated actor |
| GET | `/v1/reports/mine` | The reporter's own reports and their outcomes |

**Body:** `{ subject_kind, subject_id, reason, detail? }`. `subject_kind` is closed and **its spelling is whatever `core.content_report_subject` holds** -- D-44.

> **The enum is frozen and shipped; this document is not the authority on its spelling.** v1.6 spelled two values differently from the migration, and the build mapped them at the edge rather than diverging. **The mapping is removed and the contract adopts the enum's spelling**, because a translation layer between a document and a shipped type is a place for a third spelling to appear.

**INVARIANT -- reporting a review is not disputing it.** A report enters `core.moderation_queue_item` for operator review under S18's policy; it does not hide the review, delay its publication, notify the seller, or mark it pending. A seller can never prevent a review from publishing, and the report path must not become the mechanism by which they do.

### 12.16 Client events -- B and S

| Method | Path | |
|---|---|---|
| POST | `/v1/events` **M** | **Catalogued in v1.4.** S11 referenced this endpoint and never listed it |

**A closed allow-list of two client-observed events** (S11): `NotificationOpened` and `PaymentInstructionsViewed`. Everything else in `analytics.event` is server-emitted from inside the function that caused it, so it cannot be forged, suppressed or lost to a client that crashed.

> **INVARIANT -- a client cannot emit an event outside the allow-list.** An unknown `event_name` is 422 `VALIDATION_FAILED`, never a silent accept. An events endpoint that accepts anything is an events table that means nothing.

### 12.17 Courier -- C

| Method | Path | |
|---|---|---|
| GET | `/v1/courier/orders` | **Currently assigned orders only** (S6.3) |
| GET | `/v1/courier/orders/{id}` | Buyer name, phone and delivery information for that order only. **The QR is present only once custody has been accepted** -- R25 |
| POST | `/v1/courier/orders/{id}/custody-accept` **I** | Event A |

> **R20 and R25 are the same rule at two ends of the handoff.** No QR token exists before the payment is confirmed, and no courier sees one before they hold the goods.
>
> **The buyer's scan writes `PAYMENT_CONFIRMED -> HANDED_OFF`, and no legal transition exists from any earlier state** (ADU-DB-01 S12.2.1). A QR issued before confirmation is therefore a code that either fails on scan or completes an order nobody has paid for. A QR visible to a courier who has not accepted custody is a path to a completed handoff for goods still sitting with the seller.
>
> **Both are gated in the response, not in the client.** ADU-CON-03 renders the controls disabled; this contract makes the data absent. A screen that hides a control the API would still serve is the failure ADU-PRD-01 S16.2 names.

Enforced by row-level security in the database, not by a `WHERE` clause in a service (S6.9 of ADU-DB-01). This is the one access rule where a forgotten filter hands one seller's buyer list to another seller's courier.

### 12.18 Account deletion from the web -- anonymous

The one authenticated exception on the public site (S6.2 of ADU-WEB-01), and deliberately narrow.

| Method | Path | |
|---|---|---|
| POST | `/v1/deletion/otp/request` **I** | `purpose: ACCOUNT_DELETION` |
| POST | `/v1/deletion/otp/verify` | **Returns a deletion ticket, not a session** |
| GET | `/v1/deletion/preview` | Blockers as `items[]`; what deletion does |
| POST | `/v1/deletion/confirm` **I** | Requires explicit acknowledgement |

**INVARIANT -- `/v1/deletion/otp/verify` returns a single-purpose ticket scoped to the deletion flow.** It is not a bearer token, is not accepted by any other endpoint, and expires in fifteen minutes. S3.0: the deletion path *"issues no session, grants access to no other surface, and its copy must state that it is not a sign-in."* A ticket that any other endpoint accepts is a session, whatever it is called.

**`/v1/deletion/preview` explains what deletion does before the phone number is taken** -- the page order is explain -> phone -> OTP -> confirm (ADU-WEB-01 S6.2), and the preview endpoint exists so the explanation is server-supplied and stays in agreement with what deletion actually does.

## 13. Function mapping

Every state-changing endpoint and the ADU-DB-01 function it calls. Where this table says a function, the NestJS service calls it and does nothing else of consequence.

| Endpoint | Function |
|---|---|
| `POST /v1/orders` | `core.fn_create_order` |
| `GET /v1/orders/{id}/payment-instructions` | `financial.render_payment_instructions` -- **returns ciphertext and a key reference; the API decrypts** (R15) |
| `GET /v1/seller/orders/{id}/payment-evidence` | `financial.read_payment_evidence(p_evidence_id, p_actor, p_reason)` -- **the `p_actor_role` parameter is gone** (R5) |
| `POST /v1/seller/identity-verification` | `verification.write_attestation`; reads go through `verification.read_attestation(p_person_id, p_actor, p_reason)` -- **role derived, not supplied** (R5) |
| `POST /v1/seller/orders/{id}/ready` | `core.fn_mark_order_ready` -- ADU-DB-01 v1.7 S12.6a |
| `POST /v1/seller/products/{id}/unpublish` | `core.fn_unpublish_product` |
| `POST /v1/seller/ownership-transfer` | `core.fn_transfer_seller_ownership` |
| `PUT /v1/seller/fulfilment-methods` | Scoped write to `core.seller_fulfilment_method`; readiness re-evaluates on read |
| `POST /v1/reports` | insert `core.content_report` -- the queue trigger routes it |
| *(every seller-scoped writing endpoint)* | **`core.fn_has_permission(account, seller, code, audience)` is the first statement.** Returns void, raises `U0001` or `U0002` -- ADU-DB-01 v1.10 S6.9a |
| `POST /v1/events` | insert `analytics.event` -- the key-validation trigger refuses an unknown name |
| `PUT  -  DELETE /v1/seller/availability-overrides/{date}` | Scoped write to `core.seller_availability_override` -- a primary-key upsert and a delete; no function, because there is no rule beyond the key |
| `GET /v1/storefronts/{handle}`  -  the chatbot's out-of-hours reply | **`core.fn_seller_availability_state(seller, at)`** -- resolves the override first, then the weekly pattern, **in the market's timezone** |
| `GET /v1/seller/readiness`  -  `POST .../publish` | `core.fn_publication_readiness`  -  `core.fn_publish_product` |
| `POST /v1/seller/variants/{id}/stock` | insert `core.stock_event` -- the trigger does the rest |
| `POST /v1/seller/payout`  -  `DELETE .../pending` | `core.fn_request_payout_change`  -  `core.fn_cancel_payout_change` |
| `POST /v1/handoffs/sync` | insert `core.handoff_scan` -- the validity trigger decides the outcome |
| `POST /v1/claims` | insert `core.claim` -- the evidence trigger populates the set |
| `GET /v1/seller/deletion/blockers`  -  `POST /v1/seller/deletion` | `core.fn_deletion_blockers`  -  `core.fn_delete_seller` |
| Every seller-scoped write | `core.fn_has_permission` as the first statement |
| Every capability gate | `billing.fn_effective_limit` |
| Every eligibility check | `core.fn_evaluate_eligibility` |

> **INVARIANT -- no caller computes whether a store is open.** Three surfaces need the answer -- the storefront, the chatbot and the seller's own screen -- and three implementations of *check the override table, then fall back to the weekday row* will differ at the edges. `fn_seller_availability_state` is the single answer, and the edge it protects is a timezone one: `override_date` is a calendar date, and comparing it against a UTC timestamp puts the rollover at 03:00 EAT, showing a store open for the first three hours of the holiday it is closed for.

> **INVARIANT -- `actor_role` in either isolated-boundary access log is derived inside the function from the caller's actual grants, never accepted as a parameter** (R5; ADU-DB-01 v1.7). The API passes the actor and the reason; it does not assert who the actor is. That assertion is the one thing the audit log exists to make independently of the person it holds to account.

**INVARIANT -- no endpoint computes a trust level, an entitlement, an expiry, a readiness state or a scan validity.** Each is a function call. S23: clients display state and send intents; by the same logic the API layer relays decisions and does not make them.

---

## 14. Non-functional

| Concern | Requirement |
|---|---|
| **Storefront first response** | Under 40KB uncompressed, single round trip, edge-cached |
| **Timeouts** | 10s client-side on reads, 30s on writes. A write that times out is retried with the same idempotency key |
| **Offline** | Scan capture and queued sync are the only offline-capable operations (S23) |
| **Time** | Every timestamp on the wire is RFC 3339 UTC with a `Z` suffix. The client formats for the market timezone |
| **Money** | Always `{ amount_minor, currency }`. Never a decimal, never a formatted string |
| **Locale** | Server echoes the resolved locale in every response. A key missing from the Amharic catalogue falls back to English, never to a raw key path (S8.3 of ADU-WEB-01) |

---

## 15. Open items

> **v1.9 answers eleven of these and the answering is the interesting part.** Every one was found the same way: **a builder drew a screen, and the contract could not supply what the screen was told to render.**

### 15.0a The three the console labels on screen

**`bucket` on `GET /v1/seller/orders`** -- `needs_action` - `active` - `completed` - `cancelled`.

> **"Needs action" is not a state. It is a SET of states**, and which states belong in it is a product decision. **A `state` parameter would have left that decision on the client** wearing a filter's clothes. `cancelled` is the plainest case: `CANCELLED_BY_BUYER`, `CANCELLED_BY_SELLER` **and** `EXPIRED_UNCLAIMED` -- three states, one tab, **and the mapping is not the console's to make.**

**`GET /v1/seller/couriers` returns couriers.** v1.8's S17 said this endpoint was *owed*; **it exists, and it returns the wrong object** (D-224.4). A seller asking *who are my couriers* is asking about **relationships**, not invitations.

| | Carries | Assignable |
|---|---|---|
| **Claimed courier** | `account_id`, phone, joined | **Yes** |
| **Pending invite** | phone, invited | **No** |

**That makes SC-04's disabled state true rather than a workaround**: *invited, has not joined yet*, and not selectable.

**`allowed_actions`** -- per object, named by permission code.

[!] **The console never unions it with anything it worked out itself.** ADU-AUTH-01 S15's six gates are the server's, and **a client that ORs its own guess with the server's answer has replaced the answer.**

### 15.0b The reads, and why they are one class

**Eight endpoints write state that nothing can read back.** SC-17 is a write-only form. SC-19's weekly editor edits a local draft. SC-22 can show a follower count **only for the session that witnessed it**, because the value arrives transiently at verification with no `captured_at`.

> **A write with no read is a fact the product cannot show its owner.** Each of these passed review because the write was specified and nobody asked what displays it.

**The follower count needs a column, not only an endpoint.** R24 says *captured, never background-refreshed, always "as of <date>"* -- **and there is no date to render** while the value exists only in a verify response. `core.seller_social_account` owes `follower_count` and `captured_at`; ADU-DB-01 v1.17.

### 15.0c Payout lock, and one message for two causes

**`GET /v1/seller/payout` carries `payout_locked_until` and `reason`**, so SC-24 draws the panel rather than discovering the lock on a 409.

> **`PAYOUT_LOCKED` stays one code and gains a `reason` slot.** The client's behaviour is identical -- show the lock, show when it lifts -- **and only the sentence differs**, which makes it the locale catalogue's job rather than a second code in a closed taxonomy.
>
> **The two sentences are not interchangeable.** A `RECOVERY` lock says *seven days after an account recovery*; a `NEW_DEVICE` lock says *twenty-four hours after a sign-in from a device we have not seen* -- **and the second implicitly asks a question the first does not: was that you?**

### 15.0d The two `I` markers, withdrawn

S8 says an idempotency key rides on a state-changing `POST` **and on nothing else.** The S12 catalogue marked `PATCH /v1/seller/variants/{id}` and `PUT .../images/order`. **The server implements S8** and those handlers ignore the header.

> **S8 is right and the markers were the defect.** A `PUT` that replaces a complete ordering, and a `PATCH` carrying every field it sets, **are idempotent by construction** -- a retry produces the same state.
>
> **The key exists for operations where a retry would create a second thing.** Adding one to an operation that already cannot duplicate adds a record, a conflict path and a replay semantic **to buy a property the verb already has.**


> **v1.8 -- two entries this document owes rather than answers.**
>
> **D-100: three quantities are being counted as one.** This catalogue names **124 entries**; the built contract carries **110 path keys and 129 operations**, and two other documents restate 124 as the count of what is **built**. **A catalogue entry, a path key and an operation are not the same object**, and 110 against 129 proves it.
>
> **The catalogue's 124 is not necessarily wrong** -- it is consistent with fourteen specified endpoints not yet built. **What cannot stand is any document restating it as the count of what exists.** Resolving it means an endpoint-by-endpoint audit, which is a work order rather than a sentence.
>
> **D-155: no endpoint returns `allowed_actions`**, and the console's own instructions say it renders them. **That is a contract gap, not a console gap.** Until it lands, every screen deciding what a seller may do is deciding it from state -- which is the rule the console is built to not break, kept only by there being nothing to break it with.


| Item | Blocks | Note |
|---|---|---|
| **Domain** | Every URL in this document, App Links, Universal Links | ADU-WEB-01 S14, in progress. Every path here is stable; only the host is pending |
| ~~R-1 and R-3~~ | -- | **Closed in v1.4.** ADU-DB-01 v1.7 S12.2.1 ratifies all 23 rows. R-2 was already closed and v1.6's shipped table had not caught up; S12.4a now specifies what terminates an unanswered `PAYMENT_SUBMITTED` order -- a `SYSTEM` claim, with **stock still held**, because the buyer has paid |
| ~~Availability overrides~~ | -- | **Closed in v1.5.** ADU-CON-03 v1.1 S17 item 1 is discharged; the schema is ADU-DB-01 v1.8 S13.1a |
| **Ownership transfer** | `POST /v1/seller/ownership-transfer` | Endpoint and function specified in v1.4; the **product rules** -- who may receive, what notice is given, whether the outgoing owner retains anything -- are not written in any document. ADU-PRD-01 v8.6 owes them |
| **Business tier API** | S16.2's read-mostly scoped-token API | Specified when Business tier ships |
| **Push provider** | Buyer and seller notification delivery, TTL semantics | FCM and APNs assumed; not recorded as decided anywhere |
| **Companion Phase 2** | Overview, analytics, reviews, notification preferences | Built on beta evidence -- ADU-ARCH-01 S3.1 |
| **Signed upload provider** | Media commit flow | Cloudflare R2 presigned assumed, per the existing R2 decision |

---

## 16. Feedback to ADU-DB-01

> **This section is closed and retained for history.** Both tables were adopted into ADU-DB-01 at v1.4 and are carried in v1.7; this document is no longer their source. The specifications below are kept because the *reasoning* -- why `actor_kind` admits `DEVICE`, why the buckets key on a phone hash -- is not repeated in ADU-DB-01, and a reader asking "why is it shaped like this" should find the answer somewhere.

This contract required two tables that ADU-DB-01 v1.3 did not have. Both are transport concerns rather than domain concerns, which is why they surfaced here and not there.

**`core.idempotency_record`** -- S8

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

- `actor_kind` admits `DEVICE` because the cart and device-registration endpoints are reachable before an account exists (C6). An idempotency scheme that assumed an account would leave the pre-identity endpoints -- the ones a buyer hits on the worst connection, before they have committed to anything -- unprotected.
- `expires_at` is `created_at + 24 hours`: longer than any plausible retry, shorter than any storage concern.
- **Not append-only.** It is an expiring cache of what was already answered, not a record of what happened. `analytics.event` is the record.

**`core.rate_limit_bucket`** -- S10

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

- **`PHONE_HASH`, never a phone number.** The OTP limit has to work before an account exists, which is exactly when the raw number would otherwise sit in a counter table with no retention story. Same reasoning, same mechanism as `core.phone_reuse_block` (S16.9).
- **Not append-only**, and purged aggressively -- a bucket older than its widest window is dead weight.
- **Accepted cost:** one small write per limited request, on top of the session read, on a single Postgres. Affordable at the modelled volume and worth measuring before it is not.

Two new enum types: `core.idempotency_actor_kind` and `core.rate_limit_subject_kind`.

Two new jobs, both trivially idempotent: `idempotency.purge_expired` and `rate_limit.purge_stale`, hourly.

~~**ADU-DB-01 moves to v1.4 at 104 tables and 51 enum types.**~~ **Superseded: ADU-DB-01 v1.7 carries 108 tables and 56 enum types**, and Appendix C is fifteen checks. **Append-only count stays 21** -- neither table records what happened, and marking an expiring cache append-only would put two rows in a count whose whole purpose is to be compared against the trigger and `REVOKE` totals.

**And a write-back to ADU-PRD-01, W10:** S5.2's anti-gaming rules limit how often one buyer can advance one seller, and say nothing about *when* that buyer can claim the handoff occurred. A5's residual -- a colluding buyer with a manipulated device clock -- belongs in that section as a known limit, not in this document as a footnote. **UTC does not resolve it**, for the reason given in S1 A5.

---

*Binding API contract, v1.9 -- eleven answers to a list the console currently renders as sentences on screen. Three were named as owed and eight were never named at all: endpoints that write state nothing can read back, each of which passed review because the write was specified and nobody asked what displays it. A write with no read is a fact the product cannot show its owner. Two corrections beside them, and the idempotency one is the more interesting: a PUT replacing a complete ordering is idempotent by construction, so a key there buys a property the verb already has, at the cost of a record and a conflict path. From v1.8: Two error codes admitted through the amendment route this document names, and the interesting part is why each is safe rather than that it exists: `MARKET_UNAVAILABLE` because market availability depends solely on public configuration, and `SMS_NOT_SENT` because provider acceptance is synchronous while delivery is not -- a status endpoint on an anonymous path would be a new endpoint answering questions about a phone. Verify rejects `audience` rather than ignoring it, because a field the server discards is a field a client keeps sending. And two entries this document owes rather than answers: no endpoint returns `allowed_actions`, and three different quantities have been counted as one since Tier 3. From v1.7: ADU-RUL-01's rulings and five corrections. The one that matters is G1.1: `POST /v1/seller/identity-verification` accepted an attestation built from fields the client supplied, so a seller with a step-up code could assert their own identity verification, and it was open from C6 until now. It becomes operator-only, which tightens authorization without changing a shape -- and doctrine 6 protects a client against a contract moving under it, never a client's right to call something it should not have reached. From v1.6: No new endpoint: it records how the database's authorization failures reach the wire, and closes two handoff gaps found by drawing the screens rather than by reading the contract. The change that matters is R29 -- v1.5 mapped `insufficient_privilege` to 500 as a misconfigured grant, and ADU-DB-01 then raised the same code deliberately for a 403, so a real privilege bug would have reached a seller as a clean denial and never been investigated. From v1.5: v1.4 was the reissue that unblocked the seller console; v1.5 adds three endpoints for R27's closure dates and corrects one idempotency marker. 123 catalogue entries in 18 groups, drawn from ADU-DB-01 v1.8. It carries R3 (a cookie for the console, a bearer for the app, one opaque session behind both), R2 (two audiences), R4 (the billing group is console-only, and the paragraph saying otherwise is struck), R10 (conversation scope has no default), R5 and R15 (the boundary functions derive the role and return ciphertext), and the twenty-eight endpoints ADU-CON-01 S6 registered as missing -- three of them entire groups, because analytics, notifications and content reporting were promised in the PRD and reachable from nothing. Every state-changing endpoint calls a named database function; no endpoint reimplements an invariant. Five of the six gaps of S1 are resolved in full; A5's residual is bounded and recorded as W10. **One open item remains and it is a policy gap, not a contract gap:** ownership transfer has an endpoint, a permission and a function, and no document saying who may receive a store -- the mechanism must not ship before ADU-PRD-01 v8.6 writes the rules.*
