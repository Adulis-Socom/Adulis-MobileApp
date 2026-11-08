# Adulis Order Management & Checkout
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R01, R03, R04. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-ORDER-01_Adulis_Order_Management_Checkout_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Mission

Order Management and Checkout are the transactional spine that converts Adulis discovery into an auditable paid Seller Order. The design begins after a Buyer selects canonical Product Posts, and it ends only when commercial state, fulfilment, physical Handoff, Reviews, Claims, refunds and downstream accounting can be explained from durable facts.

The current flow is gateway-first, seller-specific, connected-only and server-authoritative. Payment success is established by the backend from an approved payment gateway or aggregator; Sellers never confirm payment manually.

```
Scene Post -> Product Post -> Seller Cart -> Checkout Session
-> Seller Order -> Gateway Payment -> Seller Preparation
-> Fulfilment -> Handoff -> Completion -> Review / Claim
```

## 2. Version scope and precedence

Historical reviewed-baseline note (superseded by the selected 12 October amendment): Version 3.0 retains the gateway transaction architecture introduced in v2.0 and reconciles it with current October 2026 Mobile, Seller Console, Storefront, Operator, Deployment and canonical rules. The earlier direct-transfer/long-lived pre-payment workflow remains superseded.

Where an older Order assumption conflicts with this document on Checkout, gateway payment, multi-cart behavior, Handoff, connected-only execution, Valkey, Product/Scene attribution or buyer-side commission, this version is authoritative for Order Management and Checkout.

STATUS: CURRENT UPDATED BASELINE. One Seller per Order, multi-cart Buyer UX, gateway-verified payment, zero at launch buyer-side Adulis Checkout surcharge, two-stage Courier Handoff, best-effort Pickup/Delivery checkpoint evidence and Valkey/BullMQ.

| Area | Current baseline |
| --- | --- |
| Transaction unit | One Buyer + one Seller + one Market/currency per Seller Order |
| Buyer checkout | Multi-cart session groups several Seller carts for UX; Orders remain separate |
| Payment | Gateway/aggregator; Chapa is the initial named provider where configured |
| Commission | zero at launch buyer-side Adulis Checkout surcharge; collected through payment aggregator configuration |
| Fulfilment | Seller preparation, optional Courier assignment, two-stage physical Handoff |
| Connectivity | State-changing commerce and Handoff verification require backend connectivity |

| Area | Current baseline |
| --- | --- |
| Infrastructure | PostgreSQL + Drizzle truth; Valkey + BullMQ non-canonical async/cache |

The supplied October 2026 transaction corrections supersede affected September assumptions. Preserve one-Seller Orders, provider/backend payment authority, allocations/refunds, current zero-bps launch surcharge, idempotency/locking, append-only snapshots/outbox and connected-only Handoff.

## 3. System boundary

Order Management owns the lifecycle of Seller Orders and their immutable commercial snapshots. Checkout coordinates selected Seller carts, creates seller-specific Orders, initiates payment attempts and presents progress, but it does not merge several Sellers into one financial transaction.

Payments, Inventory, Fulfilment, Handoff, Notifications, Billing/Commission, Claims, Reviews and Trust remain distinct logical domains. Order Management consumes their authoritative facts through typed domain interfaces and events.

## 4. Current canonical commerce flow

A Buyer can enter commerce from Search, Shop, a Seller profile, a Product Post or a product tag inside a Scene Post. The FYP contains Scene Posts, while Product Posts remain the canonical commerce surface for price, Variant, availability and purchase intent.

Checkout revalidates all selected lines before creating any Seller Order. Each Seller Order is then paid independently through the configured provider. A paid Order becomes visible to the Seller for preparation immediately; it never waits for sibling Seller Orders in the same checkout session.

## 5. One Seller per Order

A Seller Order belongs to exactly one Buyer, one Seller, one Market and one currency. It may contain multiple Products/Variants from that Seller. This boundary preserves clear Inventory ownership, payment routing, refund scope, fulfilment responsibility, Handoff evidence, Claims and Reviews.

The Buyer may purchase from many Sellers in one shopping session, but the system creates one Order per Seller. There is no cross-Seller Order identifier with shared financial authority.

Each Seller Order has one Buyer, one Seller, one Market/currency, payment context, fulfilment context and independent refund/Claim/Handoff chain. There is no cross-Seller financial super-order.

## 6. Multi-cart Buyer design

The Buyer experience groups selected items by Seller. Each Seller cart has independent subtotal, fulfilment options, validation state and checkout readiness. The outer multi-cart container is a convenience layer only.

Adding a product updates only the cart for that Product's Seller. Quantity changes, removals, fulfilment choices and validation errors do not silently affect another Seller cart.

![Independent Seller Orders and payments](graphics/ORDER_01.svg)
*Figure 01. Independent Seller Orders and payments. Multi-cart/Checkout Session groups Buyer progress only; payment, fulfilment, Handoff, refunds and Claims remain Seller-specific.*

## 7. Checkout Session

A checkout_session may group the Seller Orders created from one Buyer review flow so Mobile can show progress such as NOT_STARTED, PAYMENT_PENDING, PAID or FAILED per Seller. It is not an Order, does not own money and does not authorize fulfilment.

A Checkout Session can outlive the first payment so a Buyer can leave and later resume remaining Seller payments. Already paid Seller Orders proceed independently.

## 8. Product Post and Scene Post attribution

Order lines always resolve commercial truth from the Product Post/Product/Variant domains. Scene Posts contribute discovery context, not price or stock authority.

When a Buyer arrives from a Scene Post, Checkout may carry a bounded attribution snapshot such as scene_post_id, product_tag_id, feed_session_id and impression_id. The snapshot supports analytics and seller performance reporting but can never change payment, Inventory or Order legality.

Scene visibility belongs to Content. A source Scene becoming PRIVATE neither rewrites an existing Order/historical attribution nor independently invalidates Checkout when the selected Product/Variant/Seller/Market remains eligible. Checkout always revalidates current merchandise truth; source Scene attribution is discovery evidence only.

## 9. Server authority

Clients express intent. The backend decides whether a line is purchasable, an Order may be created, a payment attempt may start, a Seller may Mark Ready, a Courier may be assigned, a Handoff may be verified, a refund may execute and a Review may become eligible.

No mobile callback, web redirect, Seller click, local timer, cached state or QR parse can create canonical business truth without server validation.

## 10. What Order Management owns

• Seller Order creation and immutable commercial snapshots.

• Order-line lifecycle and seller-specific totals.

• Order state/history and transition authorization.

• Checkout Session relationship to its Seller Orders.

• Links to payment attempts, fulfilment, Courier assignment and Handoff state.

• Idempotency, transition audit and Order-facing allowed_actions.

• Downstream Order events for Notifications, Billing, Analytics, Reviews, Claims and Trust.

## 11. What Order Management does not own

• FYP ranking, Search ranking or Scene Post eligibility.

• Product/Variant canonical price and Inventory source-of-truth rules.

• Authentication, Seller RBAC catalogue or Courier identity policy.

• Payment-provider secret handling, webhook signature verification or settlement execution.

• Commission policy authoring; Order snapshots the active policy supplied by Billing/Commercial Policy.

• Trust Level computation, Claim adjudication or Review moderation.

• Route optimization, public Courier marketplace pricing or delivery dispatch marketplace logic.

## 12. Aggregate structure

The Order aggregate is intentionally narrower than the entire purchase experience. It contains durable references to domain-owned facts rather than copying every subsystem into one table.

```
Seller Order
|-- Order Lines
|-- Commercial Amount Snapshot
|-- Fulfilment Snapshot
|-- Checkout Surcharge Snapshot
|-- Payment Attempt reference(s)
|-- Courier Assignment reference
|-- Handoff reference(s)
|-- Refund reference(s)
|-- Claim/Review eligibility references
`-- Transition History
```

## 13. Order entity

The Order stores immutable identity and stable commercial context: internal id, public order reference, buyer_account_id, seller_id, market_id, currency, created_at, current derived state, checkout_session_id when applicable, active fulfilment mode, and version references for money, policy and configuration snapshots.

Public APIs use non-sensitive public references. Internal UUIDs remain server/database identifiers.

## 14. OrderLine entity

Each OrderLine captures exactly what the Buyer agreed to buy: Product/Variant identifiers, public product reference, seller ownership, quantity, unit price, selected attributes, line subtotal and a bounded Product title/media snapshot for historical rendering.

The snapshot prevents later catalogue edits from rewriting the commercial history. Current Product availability may still be displayed separately from the captured Order line.

Expose UNIQUE(order_line_id, order_id, product_id) on the canonical immutable OrderLine snapshot, in addition to its primary line identity. Reviews stores order_id on each rating and references this tuple plus UNIQUE(review_id, order_id) on Review through supported composite foreign keys. Current received-line evidence is validated by the locked Reviews owner command; no cross-table CHECK lookup or destructive cascade. The complete synthetic PostgreSQL17 DDL is in the Reviews appendix; production migration execution is not established.

## 15. Checkout Session entity

Suggested fields include id, buyer_account_id, market context, created_at, updated_at, status, selected_seller_count, and a relationship to seller-specific Order references. It should not store one cross-Seller total as financial truth.

A presentation total may be computed for the Buyer, but every payable amount remains attached to its Seller Order and payment attempt.

## 16. Payment Attempt entity

Payment attempts belong to one Seller Order. Suggested fields include id, order_id, provider, provider_attempt_reference, amount_minor, currency, status, idempotency_key_hash, created_at, expires_at, confirmed_at and reconciliation metadata.

Multiple attempts may exist over time for one Order, but only provider-confirmed success may establish PAID. A late success must reconcile safely against any newer attempt.

## 17. Provider Event entity

Inbound provider facts are recorded before business handling so duplicate webhooks and delayed messages can be reconciled. Store provider event reference, type, received_at, verification result, payload hash/reference, target payment attempt and processing status.

Do not persist unnecessary raw sensitive payloads merely for convenience. Retain only what Payment/Finance policy requires.

## 18. Checkout Inventory Allocation

A very short-lived checkout allocation protects limited stock while a provider payment attempt is active. It is an Inventory-domain concurrency mechanism linked to one Seller Order/payment attempt, not a user-facing shopping state.

The normal short checkout-attempt window bounds new payment initiation, not the lifetime of protection for uncertain money. A local deadline starts reconciliation; it never establishes provider finality. Verified charges are preserved by Finance before the existing atomic Order/Inventory PAID transaction. Release follows §35/46 only. This remains internal stock protection, not a Buyer reservation or Seller acceptance step.

## 19. Commercial snapshot

Order creation captures unit price, quantity, currency, selected Variant attributes, seller/Market identity, fulfilment choice and the active Checkout surcharge policy reference. Downstream refunds and Claims use this captured history rather than today's Product values.

Snapshots are evidence. They do not replace the canonical Product and Inventory domains for future browsing.

For Courier Delivery, snapshot courier_delivery_charge_minor, currency and compensation policy/terms version (or equivalent owned references) before payment. The charge equals the Courier compensation for that Seller Order; later offer amounts use this immutable paid snapshot, never today's Seller rate. Historical fulfilment and Commercial Policy versions govern refunds/evidence.

## 20. Fulfilment snapshot

Capture the fulfilment mode selected for the Seller Order and the parameters required to honor it: seller-delivery terms, Buyer-collection location reference, Courier-delivery eligibility, allowed delivery area, charges included in checkout and policy/configuration version.

Later Seller configuration changes must not silently rewrite the Buyer's already paid fulfilment commitment.

Fulfilment mode is selected before payment and snapshotted. Seller has no generic post-payment mode dropdown; changes require an explicit authorized Order/Fulfilment workflow. Courier Pool compensation does not apply to Seller Delivery.

## 21. Trust and Market snapshot

Store only bounded factual context needed for transaction evidence, for example Seller Trust Level identifier/version at purchase time and Market configuration version. Trust remains computed by the Trust system.

Market context determines currency, timezone, provider availability, fulfilment rules and approved payment configuration. Shared Order logic must not hard-code Ethiopia-specific values.

Seller Trust evidence supports NEW, REBUILDING, ESTABLISHED and TRUSTED with bounded version/context. A historical level is evidence only and does not recalculate or override current Trust; no Trust-based Product-count cap applies.

## 22. Checkout surcharge snapshot

Every Seller Order stores the applied Adulis Checkout surcharge rate, basis, resulting amount, currency and commercial-policy version. Current rule: zero at launch (0 basis points) on the eligible Order value defined by the active policy.

The snapshot ensures a later rate change does not rewrite historical Orders or refunds.

## 23. Courier Assignment reference

Fulfilment owns Courier identity/profile, Seller Pool relationships, availability, delivery requests/offers/assignments and checkpoint evidence. Order stores/references the selected fulfilment mode, immutable delivery-charge snapshot, active assignment and Handoff/custody consequences.

One persistent Courier identity can serve approved relationships across Sellers, but MVP permits only ONE active accepted delivery per Courier and at most one active assignment per Seller Order. Independent Order evidence does not permit simultaneous batching.

## 24. Handoff entity

Create first-class Handoff records for physical transfer. Courier Delivery uses two independent stages in core.handoff.stage: PICKUP for Seller -> Courier and DELIVERY for Courier -> Buyer. These records are not interchangeable and do not share credentials.

Conceptual status: PENDING, VERIFIED, EXPIRED, LOCKED, CANCELLED or REVOKED. verification_method is QR, OTP or MANUAL only after a successful verification outcome.

## 25. HandoffCredential entity

Credentials are separate from the Handoff itself. One Handoff can receive multiple credentials over time because QR can expire, OTP can be regenerated under policy, or an exceptional case can be routed to Manual Verification.

Store only hashed/signed verification material and metadata needed for purpose, expiry, single-use, actor binding, attempt limits and revocation. Never store a reusable plaintext OTP.

## 26. Refund entity

Refund state is provider-driven rather than a Seller-reported external transfer. The system records requested amount, eligible Order/line basis, provider refund reference, requested_at, confirmed_at, failure state, reason and policy version.

A refund remains incomplete until the backend establishes the provider/aggregator result or an approved Finance reconciliation process resolves it.

## 27. Transition history

Every legal Order transition appends an immutable history record with actor/system source, from_state, to_state, reason_code, timestamp, request_id, related payment/Handoff/refund reference and policy/configuration versions where relevant.

Never overwrite history to make a current state look cleaner. Corrections append new facts.

## 28. Money representation

All prices, charges, refunds and surcharge values use integer minor units with ISO currency. Provider adapters convert only at the boundary required by that provider and must round using the Market currency policy.

The client may format values but never calculates canonical totals.

| Money field | Rule |
| --- | --- |
| Representation | Integer minor units + ISO currency code |
| Arithmetic | Integer/decimal-safe server functions; never binary floating point |
| Rate | Zero launch Adulis surcharge: 0 bps / amount zero |
| Surcharge | money round(eligible basis minor * 0 / 10000, currency policy) _ _ _ _ |
| Display | Buyer sees a separate Adulis Checkout surcharge line before payment |
| Authority | Backend amount snapshot + provider-confirmed charge result |

## 29. Time and timezone semantics

API instants are ISO 8601 UTC. Human-facing checkout, payment, preparation and fulfilment times render in the relevant Order/Market IANA timezone. Local operating hours and holiday rules are interpreted in that configured timezone.

The client may display countdowns, but reaching zero only triggers refetch; it cannot perform a canonical transition locally.

## 30. Identifiers and public references

Internal primary keys remain opaque server/database identifiers. Buyer/Seller surfaces use human-readable Order references and public payment/checkout references where needed. Provider references are never exposed beyond the minimum required for support and user-facing status.

Do not place internal UUIDs, provider secrets or sensitive token material into shareable URLs.

## 31. Checkout input

Checkout receives selected Seller carts with Product/Variant identifiers, quantity, Buyer-selected fulfilment choices and optional discovery attribution. It never trusts client-supplied price, surcharge, Seller ownership, stock or payment status.

Every field that influences money or eligibility is re-resolved server-side.

## 32. Cart revalidation

Before creating each Seller Order, revalidate publication state, Seller eligibility, Product/Variant ownership, current price, allowed quantity, Inventory, Market availability, fulfilment choice and payment-provider availability.

Return all material differences together so the Buyer can review them. Do not silently substitute a Variant, reduce quantity, change price or move an item to another Seller.

## 33. Unavailable Product handling

If a selected Product becomes unavailable before payment, that Seller Order cannot be created for the invalid line. The Buyer receives a precise safe reason such as Currently unavailable, insufficient quantity or price changed.

The originating Scene Post may remain visible under Content policy; Product truth is rechecked when the Buyer enters commerce.

## 34. Seller Order creation transaction

Create a Seller Order in one PostgreSQL transaction after deterministic locking and final validation. Insert Order, OrderLines, commercial snapshots, surcharge snapshot, transition history and the required Inventory checkout allocation/outbox records atomically.

If any line cannot be satisfied, fail that Seller Order creation as a whole. Another Seller cart in the same Checkout Session may still proceed independently.

## 35. Checkout allocation transaction

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

Allocation stores order_id, attempt_id, generation, quantity, state/revision, release_decision_id/evidence and effect identity; locks/constraints prevent negative availability or double consume/release.

Immediate release is permitted only for a definitively uninitiated attempt: under the Order/attempt/allocation locks, durable dispatch state proves no accepted, dispatched or in-flight provider request and no verified charge. Fence/cancel the matching dispatch intent before release so a leased or delayed worker cannot initiate it afterwards. An absent callback, local NOT_STARTED label or provider not-found lookup alone is not this proof.

For an initiated or possibly initiated attempt, ORDER §35/46 is the single owner-controlled release predicate: record authoritative adapter finality/release evidence, then lock and re-read current Finance charge, dispatch, attempt generation and allocation ownership. Unknown, stale or incomplete evidence retains required stock in protected RECONCILING. G01 must establish the actual protocol; permanent provider outage has no promised resolution time.

Cancellation handlers, deadline workers, authenticated callbacks and Operator repair all call the same Order-owned predicate through approved Inventory/Finance interfaces. Store decision/evidence reference, adapter contract/version, attempt and dispatch generation, allocation revision and a unique release effect identity. A committed CONSUMED/RELEASED effect returns its recorded result; stale generations cannot release another allocation. Provider calls and evidence gathering occur outside the database transaction.

## 36. No Seller acceptance step

A Seller does not approve a Buyer before payment. Once provider-confirmed payment succeeds, the Seller receives a paid-order notification and begins preparation.

This keeps Adulis transactional rather than returning to DM-style negotiation.

## 37. Payment attempt creation

After the Seller Order exists and checkout allocation is valid, the Payments domain creates an idempotent provider attempt using the server-calculated total. The Order records the attempt reference but does not own provider credentials.

A lost API response must be safely retryable with the same idempotency identity and return the existing attempt.

## 38. External-call transaction boundary

Never hold a PostgreSQL transaction open while waiting for a remote payment provider. Commit the Order/allocation/outbox first, then create or activate the provider attempt through an idempotent boundary.

If provider creation fails or its response is lost, preserve the attempt/dispatch identity and reconcile. Release only through §35/46: durable fenced uninitiated proof or confirmed initiated-attempt finality. A network exception is not proof that no provider charge can arrive.

## 39. Transactional outbox

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

Only independent Notifications/Analytics/projection consequences are ordinary after-commit outbox consumers. Allocation consume, operational PAID and Order history/outbox are the same owner unit of work; permitted releases are separately locked canonical Inventory commands.

## 40. Payment gateway/aggregator adapter

The platform exposes one internal provider contract so Order/Checkout does not embed Chapa-specific logic throughout the codebase. The adapter owns provider request mapping, authentication, webhook verification, status lookup, refund calls and settlement metadata translation.

Provider adapters return normalized facts such as attempt status, charged amount, currency, provider reference, settled/fee metadata where available and reconciliation timestamps.

## 41. Chapa integration

Chapa is the initial named gateway/aggregator integration where Market configuration enables it. The core Order state machine must not depend on Chapa-specific field names or callback behavior.

Changing or adding an aggregator should be a Payment-domain integration plus configuration exercise, not an Order schema rewrite.

## 42. Market provider selection

Global Day-One architecture resolves payment provider availability from Market configuration. The Buyer is offered only provider paths approved for the Seller Order's Market/currency.

If a Market lacks an approved provider configuration capable of the required charge and Adulis surcharge collection, payment must fail closed rather than inventing manual payment steps.

## 43. Return from provider

A browser/native return from the payment provider is navigation context only. The client immediately refetches the payment attempt and Seller Order. Query parameters or SDK callbacks are never treated as proof of payment.

The UI may show Processing while server reconciliation is pending.

## 44. Provider webhook processing

Webhook ingress validates provider authenticity, parses the event through the provider adapter, stores an idempotent event record and then applies normalized Payment-domain transitions.

Webhook handlers must tolerate duplicate delivery, reordering and delayed arrival. They must not directly mutate unrelated Order tables without domain authorization.

## 45. Payment reconciliation

If callback and webhook evidence are delayed or contradictory, the Payments domain queries the provider when supported and resolves a single normalized status. Reconciliation jobs are idempotent and observable.

Seller preparation begins only after the backend establishes payment success.

## 46. Ambiguous payment outcome

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

Apply §35 to every release candidate, including a provider not-found response. No authoritative answer means protected reconciliation and explicit escalation, not guaranteed eventual failure. A verified older-generation charge remains financial truth; generation fencing prevents new initiation or stock effects, never deletes that charge.

## 47. Duplicate and late provider events

Webhook/event duplicates deduplicate external facts; distinct successful provider transactions never collapse into one erased record. Attempt generation fences new initiation and allocation ownership, but does not discard a verified older-generation charge.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

## 48. Provider-confirmed payment success

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 49. Seller paid-order notification

Seller Console/Seller Companion receives New Paid Order only after provider-confirmed success. The notification includes Order reference, Buyer-safe fulfilment summary, preparation action and no payment credential secrets.

There is no Seller action to confirm receipt of payment and no Buyer payment-screenshot path.

## 50. Payment failure or abandonment

A provider-declared failure leaves the Seller Order unpaid and invisible from normal Seller fulfilment queues. The Buyer may retry only when backend allowed_actions permits a new attempt.

Abandonment is not a Seller failure and should not affect Seller reliability.

Failure/abandonment does not itself authorize release. Definitively uninitiated dispatch proof or the confirmed initiated-attempt finality evidence must pass §35/46 under locks. A new attempt is unavailable while the current required protection remains unresolved; no blind replacement charge is created.

## 51. Payment attempt expiry

Local deadline schedules reconciliation/cancellation enquiry, not a declaration of unpaid finality. Store provider evidence/version and new deadline generation; queue expiry cannot release uncertain stock.

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

The deadline worker invokes the same §35/46 release decision. It can close a proven uninitiated dispatch or process confirmed finality, but cannot turn EXPIRED into evidence of no charge. Retries carry the original attempt/dispatch generation and effect identity.

## 52. Allocation release

Authorized release locks Order/attempt/allocation in the declared owner order, re-reads Finance charge/finality, verifies generation and effect identity, then appends one Inventory release + history/outbox. A concurrent accepted success either consumes under the same serialization or follows late stock re-acquisition.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

Immediate release is permitted only for a definitively uninitiated attempt: under the Order/attempt/allocation locks, durable dispatch state proves no accepted, dispatched or in-flight provider request and no verified charge. Fence/cancel the matching dispatch intent before release so a leased or delayed worker cannot initiate it afterwards. An absent callback, local NOT_STARTED label or provider not-found lookup alone is not this proof.

All initiated-attempt releases require §35/46 evidence; preserve release_decision_id, evidence_ref, adapter_contract_version, attempt_generation, allocation_revision and release_effect_id in the durable transition. A successful prior consume/release or mismatched current generation is an idempotent recorded result or rejection, never a second stock effect.

## 53. Successful payment commits stock

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

## 54. Sequential multi-seller payments

Checkout may guide the Buyer through Seller A, then Seller B, then Seller C. Each step uses its own Seller Order, surcharge snapshot and provider attempt.

A failure on Seller B never rolls back Seller A's already paid Order. Seller A starts preparation immediately.

## 55. Partial Checkout Session outcomes

A Checkout Session can end with mixed Seller states: some PAID, some FAILED, some NOT_STARTED. This is valid. The summary UI must explain that each Seller purchase is independent.

The Session itself cannot be used to infer that all goods were paid for or shipped.

## 56. Resuming remaining payments

Buyers may return from Orders/Checkout Session summary and continue unpaid Seller Orders if their product/payment state remains eligible. Before a new attempt, revalidate current allowed_actions and the Inventory/payment situation.

Paid sibling Orders remain untouched.

## 57. Payment state machine

Payment state is independent from operational Order readiness. Finance SUCCEEDED means a verified external charge; it does not authorize Seller preparation before the joint stock/Order PAID commit. Clients render these dimensions separately.

| Payment status | Meaning |
| --- | --- |
| NOT_STARTED | No provider attempt initiated. |
| PENDING | Attempt exists; no authoritative final result. |
| PROCESSING / RECONCILING | Ambiguous provider outcome; required allocation/generation remains protected. |
| SUCCEEDED | Authenticated, server-verified preserved charge; operational readiness still independently gated. |
| FAILED | Authoritative failure/finality evidence recorded; any release/retry follows the locked adapter protocol. |
| EXPIRED | Local deadline expired; this alone does not prove no payment or authorize release. |
| REFUND_PENDING | Seller-funded obligation/provider process outstanding; no completed reimbursement implied. |
| PARTIALLY_REFUNDED | Finance verifies the exact returned components; remainder stays owed where applicable. |
| REFUNDED | Finance verifies full required reimbursement under the captured component policy. |

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

State direction: local expiry/cancel request -> RECONCILING when initiation is possible. RECONCILING -> RELEASED requires §35/46 proof under the owner lock; VERIFIED charge -> CHARGE_VERIFIED_ORDER_PROCESSING -> atomic stock/PAID, or PAID_BUT_UNFULFILLABLE if authorized late reacquisition fails. EXPIRED is a local deadline dimension, not financial no-charge finality.

## 58. Fulfilment state machine

Fulfilment begins only after payment success. Different modes use the same broad lifecycle but may skip stages that do not apply.

| Fulfilment status | Meaning |
| --- | --- |
| NOT_STARTED | Order is not yet operationally prepared. |
| PREPARING | Seller is preparing paid items. |
| READY_FOR_COLLECTION | Buyer Collection is ready. |
| READY_FOR_DELIVERY | Delivery mode is ready for handoff to courier/seller delivery. |
| PICKED_UP | Courier pickup Handoff verified. |
| OUT_FOR_DELIVERY | Courier/seller is actively delivering. |
| DELIVERED | Buyer receipt Handoff verified. |
| CANCELLED | Fulfilment stopped under an approved cancellation/refund path. |

## 59. Derived Order state

Buyer-facing derived state preserves independent payment, allocation, fulfilment, cancellation and remedy facts. A preserved charge cannot disappear behind CANCELLED or REFUNDED copy.

| Derived state | Canonical condition / allowed action |
| --- | --- |
| PAYMENT_PENDING | Payment not verified; no preparation. |
| CHARGE_VERIFIED_ORDER_PROCESSING | Charge committed; joint operational PAID/stock transaction pending. No preparation/fulfilment. |
| PAID | Stock secure/consumed and operational PAID/history/outbox committed together; preparation may begin. |
| PAID_BUT_UNFULFILLABLE | Verified late success after authorized release cannot reacquire stock. No fulfilment; Seller refund obligation visible. |
| PREPARING | Current eligible operational paid Order; Seller preparing. |
| READY | Current paid Order ready for authorized collection/delivery. |
| IN_TRANSIT | Current valid Courier custody stage; safe milestones only. |
| COMPLETED | Required final recipient Handoff accepted; financial/remedy facts remain independent. |
| CANCELLED | Canonical authorized cancellation; unknown/late payment still reconciles independently. |
| REFUND_PENDING / REFUSED / OVERDUE | Seller-funded obligation unresolved; display truthful current state. |
| REFUNDED | Required reimbursement verified by Finance; no erased Order/charge history. |

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

## 60. Legal transition authority

Allowed transitions are server-side domain rules backed by database invariants where practical. Controllers and clients call commands; they do not assign arbitrary enum values.

Illegal transitions return machine-readable errors and the current authoritative state.

## 61. allowed_actions contract

Order reads include allowed_actions for the authenticated actor and current state. Examples: PAY, RETRY_PAYMENT, CANCEL (request cancellation), MARK_READY, ASSIGN_COURIER, DISPLAY_PICKUP_CREDENTIAL, REQUEST_HANDOFF_OTP, OPEN_CLAIM or LEAVE_REVIEW.

UI hiding is usability only; every command rechecks authorization and state.

CANCEL authorizes a cancellation request only. Return cancellation_status (REQUESTED / RECONCILING / COMPLETED), current payment status and allocation status separately. COMPLETED allocation release is shown only after the owner predicate commits; a paid cancellation/remedy can remain financially pending. RETRY_PAYMENT is returned only when safe initiation is established, not because a timer expired. Every action revalidates its exact actor, generation and current owner state.

## 62. Idempotency

Require idempotency for Seller Order creation, payment attempt creation/retry, cancellation, refund request, Mark Ready, Courier assignment and Handoff verification. The key is scoped to actor + command + resource + request hash.

Reusing a key with the same request returns the original result. Reusing it with a different payload is an error.

## 63. Deterministic locking

When several cart lines touch Inventory rows, lock/validate in deterministic order to reduce deadlock risk. Use PostgreSQL transactions and constraints as the correctness boundary.

Do not serialize all commerce globally; lock only the rows/keys necessary for the Seller Order.

## 64. Concurrency strategy

Concurrency correctness comes from PostgreSQL row/constraint semantics and Inventory domain operations. Valkey may coordinate non-canonical work but cannot decide whether the last unit is sold.

Test two Buyers attempting the final quantity, duplicated payment callbacks and simultaneous Seller actions.

## 65. Stock correctness invariant

At most the available quantity can become committed across concurrent Seller Orders. Every allocation/commit/release carries an Order/attempt reference so reconciliation can explain the count.

A cache loss, worker restart or duplicated job must not change canonical quantity.

## 66. Checkout amount breakdown

Before invoking the PSP, display the server-calculated Product subtotal, mode-specific fulfilment charge, Adulis surcharge, applicable authorized provider fee/tax and total. Preserve exactly these values in immutable commercial/fulfilment snapshots and use the same amount for provider initiation/reconciliation.

For current Courier Delivery, the delivery charge equals snapshotted Courier compensation and is excluded from the merchandise surcharge basis. For Seller Delivery, only an approved Seller Delivery policy may add its own separate charge. Provider Buyer fees and tax/regulatory charges exist only when supported and ratified.

| Amount component | Owner / current rule |
| --- | --- |
| Product subtotal | Captured eligible merchandise value from OrderLine unit price x quantity. |
| Courier Delivery charge | Seller-defined before payment; equals immutable Courier compensation for this Seller Order. |
| Seller Delivery charge | Applies only under approved Seller Delivery pricing; separate from Courier compensation. |
| Adulis Checkout surcharge | 0 basis points (zero at launch) on configured eligible merchandise value; excludes Courier Delivery under current policy. |
| Provider-authorized Buyer fee | Only under approved provider/Market contract; client never invents it. |
| Approved tax/regulatory charge | Only when introduced by ratified Market policy. |
| Buyer payable total | Backend sum of applicable captured components; exact amount sent to provider. |

![Immutable launch-zero money and provider permission](graphics/ORDER_02.svg)
*Figure 02. Immutable launch-zero money and provider permission. The inactive proposed future surcharge and provider-fee permission never activate by configuration alone.*

## 67. zero at launch Buyer-side Adulis Checkout surcharge

Current transaction rule is a launch-disabled zero Buyer-side Adulis Checkout surcharge, equal to 0 basis points. It is a separate visible line item, backend-calculated, versioned, snapshotted and immutable for an historical Order. This supersedes prior Seller-side commission assumptions.

Do not bury the surcharge in Product price or call Courier compensation an Adulis commission.

## 68. Surcharge basis and delivery-charge exclusion

Current surcharge basis is eligible merchandise/Product value for this Seller Order. Courier Delivery charge is a separate component excluded from that basis. A future ratified Commercial Policy may change approved inclusion/exclusion or discount/tax handling, but must be explicitly versioned without rewriting historical Orders.

Never calculate from a client-provided total. Catalogue merchandise price, Courier compensation and provider-authorized fees retain separate owners/snapshots.

## 69. Server-side surcharge calculation

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Use surcharge_rate_bps = 0 and surcharge_minor = 0 for new launch quotes; integer/decimal-safe component arithmetic and exact approved provider fee basis/rounding remain required. Store immutable merchandise, delivery, provider processing cost, Adulis surcharge, total, currency and policy snapshots. The provider attempt matches that exact accepted snapshot; never recalculate historical paid fees.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 70. Currency rounding

Each Market/currency defines a deterministic rounding rule for minor units. Apply it once in the backend and store the result. The Mobile App, Seller Console and provider callback must not independently recompute different pennies/cents.

Any provider amount mismatch is a Finance/Operator exception.

## 71. Buyer display

Before payment, show Product subtotal, fulfilment charge when applicable, Adulis Checkout surcharge and total payable. The label should explain that the surcharge is an Adulis platform charge.

Do not call the surcharge a Seller fee or imply the Seller sets it.

## 72. Aggregator collection of commission

Payment aggregators handle how Adulis collects the Buyer-side surcharge. The internal PaymentProviderAdapter receives the Seller Order amount breakdown and translates it to the provider's supported charge/settlement model.

Where a provider supports split/platform-fee settlement, the adapter can route seller value and Adulis surcharge accordingly. Where the provider uses another approved settlement method, the adapter records the provider-confirmed result. Order Management does not manually collect the fee from the Seller.

## 73. Settlement facts

Settlement mechanics are Payment/Finance domain concerns. Order Management stores only bounded references/facts needed to explain the Buyer charge and completed sale.

Never infer settlement merely because the Buyer payment succeeded; payment success and downstream settlement are related but separate facts.

## 74. Commission ledger integration

After a provider-confirmed payment, Billing/Finance records a checkout-surcharge ledger entry using the immutable Order amount snapshot. The ledger references Order, Buyer, Seller, Market, provider attempt, eligible basis, zero-bps launch rate, surcharge amount and policy version.

Adjustments append reversal/adjustment entries rather than rewriting historical charges.

## 75. Commercial policy versioning

The zero at launch transaction rule is current for this design, but subscriptions and other business-model elements remain outside Order Management. Keep commission basis, refund treatment and future rates versioned so product/business decisions do not require data-history rewrites.

A deployed code change must not silently alter the fee applied to an already created Seller Order.

## 76. Refund architecture

Paid cancellations and upheld Claims use provider/aggregator refund capabilities through the Payments domain. The Seller does not transfer money externally and then ask the Buyer to acknowledge it.

Order/Refund records remain auditable even if provider settlement completes later.

## 77. Buyer cancellation

Before verified payment, the Buyer may request cancellation or abandon the UI. Neither action proves that no charge is in flight. The backend records the request, fences further initiation and invokes §35/46; uncertain attempts retain allocation in RECONCILING. A proven uninitiated attempt may release immediately, and an initiated attempt releases only with recorded authoritative finality and locked state re-read. After payment success, cancellation eligibility still depends on fulfilment stage, Seller/Market policy and Claim rules; refund owed/pending is not reimbursement completed.

The backend returns allowed_actions; the client never guesses that a paid Order is cancellable.

## 78. Seller can't fulfil

A Seller-facing Cannot Fulfil action identifies affected line(s) and reason. For a paid Order this starts a provider refund path and records Seller reliability evidence; it does not ask the Seller to send money manually.

For multi-line Orders, unaffected lines may continue when policy and fulfilment mode allow partial fulfilment.

## 79. Partial line cancellation

Line-level cancellation/refund uses the captured commercial snapshot. Recalculate the surviving Order presentation deterministically and request a partial provider refund when supported.

If provider capabilities cannot safely express the required partial outcome, route to controlled Operator/Finance handling rather than inventing client-side arithmetic.

## 80. Refund amount

Refund computation uses captured line amounts and the versioned commercial policy. Never use today's Product price. Any refundable share of Seller fulfilment charges or Adulis surcharge is determined from the same policy version used at purchase.

Store refund basis and amount before calling the provider so reconciliation has a stable expected value.

Courier Delivery refunds likewise use the captured delivery-charge/compensation and purchase-time policy references. A current Seller rate or assigned Courier offer cannot rewrite refund basis. Actual refund eligibility remains policy-governed, not invented by this reconciliation.

## 81. Provider refund execution

Payments creates an idempotent refund request and records the provider refund reference. Webhook/query reconciliation establishes PENDING, SUCCEEDED or FAILED.

A Seller/Operator UI can request a permitted refund, but it cannot mark the refund complete.

## 82. Surcharge refund treatment

Do not hard-code a non-refundable platform fee. The Commercial Policy defines whether the Adulis Checkout surcharge is reversed fully, proportionally or not at all for each cancellation/refund reason.

The Order snapshot points to the exact policy so a later commercial change cannot affect prior Buyer entitlements.

## 83. Refund state and completion

Buyer-facing status should distinguish Refund requested, Refund processing and Refunded. Completion requires provider/Finance confirmation.

Claims may remain open until the required money outcome and fulfilment evidence are reconciled.

## 84. Fulfilment modes

Order Management supports Buyer Collection, Seller Delivery and Courier Delivery where Market/Seller configuration permits. Fulfilment mode is captured before payment and cannot be silently changed afterwards without an authorized flow.

Courier Delivery adds approved request/offer/assignment, best-effort checkpoint evidence and two Handoff stages.

Buyer Collection, Seller Delivery and Courier Delivery remain distinct modes selected before payment. Only Courier Delivery has a separate Seller-to-Courier Pickup stage and approved Pool/Network assignment.

## 85. Buyer Collection

Seller prepares the paid Order and marks READY_FOR_COLLECTION. At physical receipt Seller displays a short-lived final receipt QR and Buyer/authorized delegate scans; OTP fallback and audited Manual recovery use the same connected Handoff domain. There is no Courier Pickup stage.

Public physical-store location uses structured approved map-provider data where configured; private pickup instructions remain Order-scoped. Recipient delegation does not change Order Buyer or Review/Claim/refund ownership.

## 86. Seller Delivery

Seller Delivery is one Seller Order/provider payment, physically presented by Seller or authorized Seller representative. Preparation/delivery state is server-authoritative. At final physical receipt Seller displays -> Buyer/authorized delegate scans the final receipt credential; QR/OTP/Manual share connected verification.

Seller Delivery pricing, if any, follows its approved fulfilment/Checkout policy. Do not apply Courier Pool compensation or Courier-only Pickup/custody stages to this mode.

## 87. Courier Delivery

MVP Fulfilment supports Private Courier Pools and the Cross-Seller Courier Network. One persistent Courier identity may have approved relationships with multiple Sellers; standing pool membership is distinct from an Order request, offer or assignment. Only case-relevant Seller relationships may be exposed.

Maximum ONE active accepted delivery per Courier and at most one active assignment per Seller Order are enforced atomically by canonical domain/database rules. Relationships with several Sellers do not permit simultaneous deliveries, multi-stop batching or route optimization.

After provider-verified payment, Seller prepares and marks READY_FOR_DELIVERY before Fulfilment creates a request/offer workflow. Assignment is not a prerequisite for Mark Ready. DIRECT_REQUEST targets one eligible approved Courier; POOL_REQUEST may offer to multiple eligible approved Couriers, with first valid acceptance winning atomically.

Canonical sequence: Buyer selects Courier Delivery/sees charge -> Checkout snapshots amounts -> PSP/backend verifies PAID -> Seller notified -> Seller prepares -> Mark Ready -> delivery request/offer -> valid atomic Courier acceptance/assignment -> Courier travels to Seller -> Pickup Handoff -> Courier custody -> final Buyer/delegate Delivery Handoff -> Order evaluates completion.

![Paid and Ready before Courier request](graphics/ORDER_03.svg)
*Figure 03. Paid and Ready before Courier request. Immutable paid compensation flows into approved offers; atomic acceptance enforces one active accepted delivery before directional Handoffs.*

## 88. Courier authorization

Courier Mode appears only for an Account with current Courier capability/assignments. Every Courier action is scoped to the authenticated Account, specific assignment, Order and current Handoff stage.

A scanned credential cannot grant access to unrelated Order information.

## 89. Delivery request, offer and atomic assignment

Mark Ready permits Fulfilment to create the delivery request/offer workflow. DIRECT_REQUEST offers to one eligible approved Courier; POOL_REQUEST may offer to multiple approved eligible Couriers, with first valid acceptance winning atomically. Unknown/unapproved Couriers are not exposed merely because they are nearby.

Recheck approval/standing, request/offer validity, the Courier one-active-delivery constraint, Order readiness/payment and one active assignment per Order within the canonical acceptance transaction. Order consumes the winning assignment reference; offer notification or UI selection alone never creates custody.

## 90. Mark Ready

An authorized Seller action marks an already-paid prepared Order Ready after required preparation, Inventory and selected fulfilment/configuration gates pass. Courier assignment is NOT required for Mark Ready.

For Courier Delivery, READY_FOR_DELIVERY enables the request/offer workflow. Pickup credential issuance additionally requires a subsequently valid assignment and physical meeting. The action is idempotent and returns current backend allowed_actions.

## 91. Courier Checkpoint Location Evidence

Courier Checkpoint Location Evidence consists of exactly two best-effort foreground/on-demand capture opportunities: PICKUP and DELIVERY, immediately around the corresponding accepted/eligible Handoff context. No periodic or background samples, live Buyer/Seller maps, movement routes or tracking projections are part of MVP.

Fulfilment validates the Courier, active assignment, Order, checkpoint purpose and Handoff context. Evidence may include coordinates, accuracy, client capture time, server receipt time and capture result/status. Capture failure or denied permission never invalidates an otherwise valid connected QR/OTP/Manual Handoff, proves custody, or completes an Order.

Precise location is sensitive, purpose-limited evidence. General logs/analytics redact coordinates; Operator access requires an authorized case, capability and reason-for-access. No general map of Courier movement or unrelated Seller relationship data is exposed.

![Two bounded evidence checkpoints](graphics/ORDER_04.svg)
*Figure 04. Two bounded evidence checkpoints. Foreground attempts at Pickup and Delivery support evidence; valid connected Handoff is independent of location availability.*

## 92. Checkpoint evidence is non-blocking and non-authoritative

Location is Fulfilment supporting evidence only. Order may reference Pickup/Delivery checkpoint records in authorized evidence views but does not own them. Capture failure or denial does not invalidate QR, OTP or Manual Verification or prevent valid Handoff completion.

No periodic samples, movement route, background tracking, live-map API or geofence completion is permitted. General logs/analytics redact precise coordinates and evidence access remains purpose/case-scoped.

## 93. Pickup Handoff

PAID + READY_FOR_DELIVERY + valid assignment + physical meeting -> Seller requests/displays purpose-bound PICKUP QR -> assigned Courier scans -> backend validates Order/stage/actors/assignment/expiry/replay -> PICKUP VERIFIED -> custody=Courier.

Immediately around the accepted/eligible Pickup context, the Courier may submit one best-effort Pickup checkpoint. Failure does not invalidate custody verification. Pickup never proves final Buyer receipt or completes the Order.

## 94. Delivery Handoff

Courier reaches Buyer/authorized delegate and physically presents goods -> Courier requests short-lived DELIVERY QR -> Courier displays -> Buyer/delegate scans after receipt -> backend verifies designated recipient, current assignment, Order, purpose, state, expiry and single use -> DELIVERY VERIFIED -> Order may become COMPLETED when its other invariants pass.

Presenter/giver displays; recipient scans. Buyer Mode does not display a delivery credential for the Courier to scan. A best-effort Courier Delivery checkpoint around this context supports evidence but never substitutes for receipt.

![Current Handoff stage and recipient protocol](graphics/ORDER_05.svg)
*Figure 05. Current Handoff stage and recipient protocol. Recipient-directed OTP and Collection delegates; governed lockout recovery; connected final receipt.*

## 95. Unified Handoff Verification System

QR, OTP and Manual Verification are mechanisms within one Handoff domain, not independent completion systems. They all enforce the same Order, actor, assignment, stage and replay rules.

Pickup and Delivery credentials are purpose-bound and can never verify the opposite stage.

## 96. QR Verification

QR is primary. Server-minted credentials are short-lived, single-use, purpose/stage/Order-bound, and assignment/actor/recipient-bound where appropriate. Backend checks token/signature, current state, designated actor, expiry and used/revoked status atomically.

Courier scans Seller-displayed Pickup QR. Buyer or authorized delegate scans Courier-displayed final Delivery QR. Direct Seller final receipt uses Seller display and Buyer/delegate scan. The two Courier-stage credentials are never interchangeable.

## 97. OTP fallback

If QR cannot be used, request a stage-specific short-lived OTP. Pickup OTP and Delivery OTP are distinct, single-use, purpose-bound and attempt-limited. Store only a secure hash.

The Delivery OTP screen warns the Buyer to share it only after receiving the Order. OTP generation/resends are rate-limited and lockout routes to Manual Verification.

Buyer may designate one final recipient using name and phone before final credential issuance. When app scanning is unavailable, the presenter requests a stage-specific Delivery OTP sent to that designated phone; disclose it only after physical receipt. Pickup fallback remains stage/assigned-recipient scoped. Delegation gives no Order, refund, Claim, Review, payment or Chat rights.

## 98. Manual Verification

Emergency recovery belongs to the Operator Console. An authorized Operator reviews Order, Buyer, Seller, Courier assignment, previous attempts, timestamps, checkpoint/Handoff/delegate/support context and any permitted evidence, then approves or rejects the exact Handoff stage.

Record operator identity, reason, case reference, method=MANUAL and verified_at. Manual recovery never silently bypasses audit.

## 99. Connected-only Handoff verification

The app requires backend connectivity for Handoff acceptance. QR parsing can occur on-device, but the UI shows success only after authoritative server verification.

If connectivity is unavailable, show reconnect/retry and keep the Order/Handoff unchanged.

## 100. Replay and credential abuse protection

Used, expired, revoked or wrong-stage credentials are rejected. Verification attempts are rate-limited and logged with safe metadata. QR/OTP material must not appear in analytics or ordinary logs.

Duplicate successful verification requests return the existing outcome and cannot create two custody transfers or completions.

## 101. Reassignment and credential revocation

Before Pickup/custody, an authorized workflow may cancel or replace the assignment, revoke incompatible credentials/access, and mint new credentials only after a new valid assignment. Cancellation/refund also revokes incompatible Handoff credentials.

After Pickup, do not silently reassign while the original Courier physically holds goods. Use explicit failed-delivery/return/custody-resolution workflow, preserving custody history, assignment and Handoff evidence. One-active-delivery capacity remains governed by the domain, not UI presence.

## 102. Order completion

COMPLETED is reached when the required Buyer receipt evidence exists for the fulfilment mode and no blocking state prevents completion. For Courier Delivery, this is the verified DELIVERY Handoff.

Completion emits durable facts for Reviews, Trust, Analytics, Claims windows and financial reconciliation.

## 103. Review eligibility

Product and Seller-service Reviews are verified-purchase feedback. Reviews owns eligibility across FINAL_HANDOFF and VERIFIED_ORDER_FAILURE, using verified payment and exact Buyer/Order/received-line evidence; open social comments are not part of Order Management.

Reviews emits canonical review.eligibility_changed only when its locked eligibility/basis/state transition commits, with one Buyer-owned feedback container per Seller Order. Orders exposes evidence and its own facts; it does not emit a second Review event. PICKUP cannot establish final receipt, and the separate upheld paid-Order-failure basis does not fabricate one.

Receipt by an authorized final delegate completes delivery for the Order Buyer under Handoff policy. Review eligibility remains with the Buyer who owns the Order; the recipient acquires no Review rights.

## 104. Claims integration

Claims may reference payment, fulfilment, Handoff, refund, Seller cancellation or product-delivery facts. Claim adjudication remains the Claims domain, but Order Management provides immutable evidence references and current allowed actions.

Claims must not rewrite Order history; remedies append new facts such as refund, adjustment or Trust consequence.

## 105. Order evidence package

Permissioned Order evidence includes immutable merchandise/surcharge/fulfilment snapshots, paid Courier delivery charge and matching compensation reference/version, provider-confirmed payment, Seller preparation/Ready, request/offer/winning assignment, Pickup Handoff/checkpoint, designated final recipient/delegate, Delivery Handoff/checkpoint, failure/return facts, refunds and Claim links.

No movement history or tracking-freshness package is produced. Access is purpose-limited; do not expose provider secrets, unrelated Buyer/Seller data, private relationships from another Seller Pool or Buyer history to a delegated recipient.

## 106. Buyer authorization

A Buyer can read only Orders owned by the authenticated Account and perform only server-allowed actions. Public Order references are not authorization.

Checkout and payment commands bind identity to the current authenticated Account after any anonymous cart is upgraded at first checkout.

## 107. Seller authorization

Seller operations require explicit Seller context plus relationship/role/permission checks. A Seller may not read or act on another Seller's Order even if the same Account belongs to several Sellers.

Seller payment state is read-only provider truth.

## 108. Courier authorization

Courier APIs expose only assigned Order context and required pickup/delivery details. Assignment removal immediately revokes access to protected assignment/checkpoint and Handoff verification actions.

Courier Mode never becomes a generic Order search interface.

## 109. Operator authorization

Operators access Orders through the Operator Console with narrow permissions, append-only audit and secondary approval where required by operational policy. Manual Handoff recovery is an explicit privileged action.

Operator tools may correct exceptional workflow outcomes but cannot erase history or fabricate provider payment success.

The actor is a separate privileged Operator Account with OPERATOR authentication/authorization. A public Account is never upgraded through a grant. Only named domain actions and required Founder/Staff approval policy may affect an Order; no generic payment/Order/Handoff state toggle exists.

## 110. API contract principle

Use REST + OpenAPI + @nestjs/swagger and generated TypeScript clients. APIs return stable public references, machine-readable errors, request IDs and server-resolved allowed_actions.

Clients do not import backend repositories or duplicate DTO definitions by hand where generated contracts are available.

## 111. Checkout APIs

Exact endpoint names may vary, but the contract must preserve seller-specific results and idempotency. Creating several Seller Orders should return per-Seller success/failure rather than pretending one atomic cross-Seller purchase exists.

```
POST /v1/checkout/sessions
GET /v1/checkout/sessions/:checkoutRef
POST /v1/checkout/sessions/:checkoutRef/orders
GET /v1/checkout/sessions/:checkoutRef/progress
```

## 112. Order APIs

Buyer and Seller catalogues use actor-scoped views with cursor pagination. Sensitive internal identifiers and payment-provider secrets are omitted.

```
GET /v1/orders
GET /v1/orders/:orderRef
POST /v1/orders/:orderRef/cancel
POST /v1/orders/:orderRef/mark-ready
POST /v1/orders/:orderRef/courier-assignment
```

## 113. Payment APIs

Provider webhooks use dedicated ingress routes and are not normal user APIs. Reconciliation is server/internal.

```
POST /v1/orders/:orderRef/payment-attempts
GET /v1/orders/:orderRef/payment
POST /v1/orders/:orderRef/refunds # authorized internal/seller/operator path as policy permits
```

## 114. Fulfilment APIs

Typed REST/OpenAPI contracts expose Mark Ready, permitted request/offer/assignment and authorized delivery/Handoff state. Illustrative resource paths below follow domain ownership; exact naming may follow the existing approved API catalogue.

```
POST /v1/orders/:orderRef/mark-ready
```

```
POST /v1/fulfilment/orders/:orderRef/delivery-requests
```

```
POST /v1/fulfilment/delivery-offers/:offerRef/accept
```

```
GET /v1/fulfilment/orders/:orderRef/delivery
```

```
POST /v1/fulfilment/assignments/:assignmentRef/checkpoints/:type
```

Request/offer creation requires the paid/Ready gate; acceptance enforces atomic winner/capacity checks. Checkpoints are PICKUP/DELIVERY purpose-bound evidence submissions. No live-map, route or continuous location endpoint exists; private coordinate evidence is returned only through specifically authorized evidence views.

## 115. Handoff APIs

Manual verification uses protected Operator APIs and must never be available as an ordinary Buyer/Seller/Courier command.

```
POST /v1/orders/:orderRef/handoffs/:type/qr
POST /v1/orders/:orderRef/handoffs/:type/otp/request
POST /v1/orders/:orderRef/handoffs/:type/verify-qr
POST /v1/orders/:orderRef/handoffs/:type/verify-otp
GET /v1/orders/:orderRef/handoffs
```

Pickup issuance is Seller-presenter scoped and verification is assigned-Courier scoped. Final Courier Delivery issuance is Courier-presenter scoped and verification is Buyer/designated-delegate scoped. Direct receipt issuance is Seller scoped. Delegation is Buyer-owned name+phone, limited to one current final recipient before issuance; changing/revoking it invalidates incompatible credentials under policy.

## 116. Provider webhook endpoint

Expose provider-specific webhook ingress behind strict verification and rate/abuse controls. The route returns quickly after durable event acceptance; expensive reconciliation can continue asynchronously.

Never rely on source IP alone as provider authenticity.

## 117. Error taxonomy

Use stable codes such as ORDER_NOT_PAYABLE, PRODUCT_UNAVAILABLE, PRICE_CHANGED, QUANTITY_UNAVAILABLE, PAYMENT_ATTEMPT_EXISTS, PAYMENT_RECONCILING, PAYMENT_FAILED, ORDER_NOT_READY, COURIER_NOT_ASSIGNED, HANDOFF_WRONG_STAGE, HANDOFF_CREDENTIAL_EXPIRED, HANDOFF_REPLAY and REFUND_NOT_ALLOWED.

Messages are localized/client-safe; detailed internal reasoning remains in logs/audit.

## 118. Notification architecture

Important events include payment confirmed, Seller preparation needed, Mark Ready, Courier assigned, Pickup verified, Courier custody/In Delivery state, Delivery verified, refund status, Claim opened/resolved and Review invitation.

Notification delivery never becomes Order truth. State is persisted first, then notification jobs execute.

## 119. Notification freshness

Before sending lifecycle instructions, the worker re-reads current Order state so a queued stale notification cannot tell the Buyer to pay an already paid Order or tell the Seller to prepare a cancelled Order.

Use Order-specific collapse/replacement keys where push platforms support them.

## 120. Analytics and attribution

Analytics measures the funnel from Scene Post impression -> product tag -> Product Post -> Seller cart -> Checkout -> payment attempt -> PAID -> Handoff -> COMPLETED -> Review/Claim.

Order/payment completion facts originate from backend domain events. Client telemetry can enrich attribution but never changes commission or money.

## 121. Operational observability

Preserve Order creation latency/error, allocation contention/leak age, payment-attempt creation, provider reconciliation lag, amount mismatch, paid-to-Seller notification lag, refund latency, Handoff failure/replay, queue age and DB query health.

Add delivery charge/compensation mismatch, Ready/request sequencing failures, offer/assignment backlog/expiry/conflicts, one-active-delivery rejection anomalies, delegated-recipient verification outcomes and checkpoint submission success/failure. Location failure is distinguished from Handoff failure and never blocks completion.

Attach deployment version/request_id/correlation IDs across Checkout, Payment, Inventory, Fulfilment and Handoff; redact precise coordinates and sensitive payment/recipient payloads.

## 122. Valkey usage

Valkey is non-canonical support infrastructure for rate limits, short-lived coordination, bounded cache and BullMQ backing. Separate durable queue-oriented and disposable cache usage in production when required by the deployment design.

Loss of cache may make Adulis slower; it must not change Order, money, Inventory or Handoff truth.

## 123. BullMQ jobs

• payment.reconcile and delayed provider status checks.

• checkout-allocation expiry/release reconciliation.

• paid-order Seller notification and operational reminders.

• refund reconciliation.

• Handoff credential expiry/cleanup and manual-review notifications.

• analytics projection and non-critical event delivery.

• outbox dispatch/retry.

Fulfilment jobs may expire offers, fan out approved Courier notifications and reconcile assignments; winning assignments and capacity remain canonical PostgreSQL facts. Commit Order/outbox first -> after-commit BullMQ/Queue Valkey -> idempotent consequence workers -> reconciliation.

![Commit first, relay after commit](graphics/ORDER_06.svg)
*Figure 06. Commit first, relay after commit. PostgreSQL owns truth; BullMQ/Queue Valkey support idempotent consequences with independent reconciliation and separate cache failure semantics.*

## 124. PostgreSQL and Drizzle

PostgreSQL is canonical transactional truth. Drizzle ORM manages typed data access and migrations without weakening database constraints. Use pg_trgm where bounded text search requires it, btree_gist where exclusion/range constraints justify it, and pg_stat_statements for production query visibility.

Financial and transition invariants must exist server/database-side, not only in TypeScript validation.

## 125. Media boundary

Order Management does not store payment screenshots. Product/Scene media uses Cloudflare R2 + CDN + Sharp through the Media domain. Claims may attach controlled evidence through the Claims/Media boundary.

Handoff QR/OTP material is credential data, not media, and must never be published to R2/CDN.

## 126. Current technology stack and impact

Order/Checkout uses the current Adulis canonical stack. Technologies are implementation tools; they do not become business authority. PostgreSQL-backed domain logic remains authoritative.

| Layer | Canonical technology | Order/Checkout impact |
| --- | --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript; Drizzle ORM; PostgreSQL | Commands, state machines, provider adapters, transactional truth. |
| PostgreSQL ext. | pg_trgm; btree_gist; pg_stat_statements | Search/constraint support where justified; query diagnostics. |
| Async/cache | Valkey; BullMQ | Outbox dispatch, reconciliation, notification jobs, bounded cache/rate limits. |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client | One typed contract for Mobile/Console/Operator surfaces. |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js | Abuse controls, secure headers, international phone normalization where needed. |
| Media | Cloudflare R2; Cloudflare CDN; Sharp | Product/Claim media dependencies; not payment truth. |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; SecureStore; SQLite; Camera; Notifications; Updates; small Zustand store | Buyer multi-cart/payment, QR scan/display, notifications, online retry metadata. |
| Courier extension | Foreground Expo Location where used | Two best-effort foreground Pickup/Delivery checkpoint captures; no Courier-only background-task/live-map dependency. |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 | Domain, DB, Mobile E2E, web E2E and load testing. |
| Observability | Sentry; Pino structured logs; pg_stat_statements | Errors/releases, redacted logs, DB query analysis. |
| Architecture | dependency-cruiser | Prevents forbidden cross-domain/private-repository dependencies. |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS | Backend/worker/web delivery and native/OTA Mobile release. |
| Payment | Chapa + provider adapter abstraction | Initial gateway/aggregator plus market-specific provider extensibility. |

## 127. Repository and module structure

Order/Checkout remains inside the adulis-platform modular monolith. The Company Website stays in the separate adulis-web repository and never owns commerce truth.

Recommended logical seams:

```
adulis-platform/
apps/api/src/modules/
checkout/ orders/ payments/ inventory/
fulfilment/ courier/ handoff/ refunds/ billing/
apps/worker/src/jobs/
payments/ checkout/ refunds/ notifications/ handoff/
apps/mobile/
features/carts checkout orders payments handoff courier checkpoints
seller-console/ operator-console/ storefront/
packages/
api-contracts/ handoff-contract/ money/ dates/ analytics-events/
```

## 128. Testing strategy

Use Jest for unit/domain logic, Testcontainers for real PostgreSQL/Valkey integration, Maestro for critical Mobile flows, Playwright for Seller/Operator/Storefront browser paths, k6 for load/concurrency and generated OpenAPI contract tests for client/server compatibility.

Production-critical rules require negative tests, not only happy paths.

The R01 regression scenarios in §129 are proposed application acceptance tests. The document update executes source/contract checks only; no deployed cancellation handler, provider callback, database race or UI integration is claimed tested.

## 129. Critical end-to-end tests

- Multi-cart Seller A+B creates independent Orders/payments with correct mixed progress; one Seller/Buyer/Market/currency per Order.

- Provider success requires backend verification; duplicate/late/lost-response retries create one logical payment/stock effect.

- Final-unit concurrency permits at most one paid stock consumption; local expiry/cancellation cannot release initiated or uncertain charged stock; only §35/46 proof permits one fenced release.

- Server zero-bps launch surcharge matches snapshot/provider amount with integer/decimal-safe rounding; Courier delivery is excluded from current basis.

- Buyer sees exact Seller-defined delivery charge before payment; paid amount equals immutable Courier offer compensation despite rate changes.

- PAID -> Seller prepares -> Mark Ready -> request/offer; assignment is not required for Ready.

- Three eligible Couriers competing for one Pool offer create exactly one winning assignment; a Courier with one active delivery cannot accept another.

- Pickup Seller-display/assigned-Courier-scan and Delivery Courier-display/Buyer-or-delegate-scan reject wrong stage/actor/replay.

- OTP uses designated recipient/stage; QR/OTP/Manual require network and share domain audit/state invariants.

- Only best-effort Pickup/Delivery checkpoint evidence is captured; failure/permission denial does not invalidate valid Handoff; no route/live-map endpoint exists.

- Delegation does not transfer Buyer Review/Claim/refund/payment/Chat ownership; Buyer remains Review eligible after delegate receipt.

- Pre-custody reassignment revokes incompatible credentials; post-Pickup needs explicit custody resolution.

- Refunds use historical captured amounts/policy and reconcile full/partial results without rewriting history.

R01 acceptance: cancel/expiry followed by delayed success; provider lookup outage/not-found without finality; uninitiated dispatch cancelled while a worker competes; duplicate callbacks and expiry/repair retries; stale generation; final-unit Buyer A/B race. Require preserved charge, no negative stock, one release/consume effect, truthful REQUESTED/RECONCILING/COMPLETED UI, and Seller-funded owed remedy if authorized late stock reacquisition fails.

## 130. Deployment and release

Backend API and worker ship as reviewed Docker artifacts through GitHub Actions to Render; Cloudflare remains edge/CDN and EAS delivers Mobile builds/updates. Staging receives releases before deliberate production promotion.

Schema changes follow expand/use/contract. Backend must remain compatible with supported older Mobile binaries during rollout.

## 131. Failure and recovery architecture

Database unavailable: fail state-changing Checkout/Order commands closed. Payment provider unavailable: keep existing paid Orders readable, pause new attempts, reconcile later. Valkey unavailable: preserve canonical database state and outbox work, then recover async jobs. Notification failure: Order state remains valid.

Checkpoint capture failure omits supporting location evidence but does not invalidate valid Handoff. Handoff service failure blocks completion until verification can be safely retried or manually reviewed.

## 132. Security and privacy

Provider secrets remain server-side. Webhook authenticity is verified. OTP/QR secrets, session tokens, payment credentials, precise long-lived Courier routes and sensitive Claim evidence are excluded from ordinary logs/analytics.

Apply @nestjs/throttler, Fastify security headers, strict authorization, CSRF controls on cookie-authenticated web surfaces, scoped R2 credentials, protected GitHub/Render/Cloudflare/EAS access and append-only audit for sensitive operational actions.

## 133. Production launch gates

Do not enable real Buyer payments until all of the following are proven in production-like staging:

• ✓ multi-cart creates separate Seller Orders with no cross-Seller financial authority

• ✓ Product/Variant/price/Inventory revalidation works under concurrency

• ✓ payment attempt idempotency and provider webhook verification pass

• ✓ client/provider-return cannot mark payment successful

• ✓ zero launch Adulis Buyer surcharge is server-calculated, displayed and snapshotted correctly

• ✓ payment aggregator collection/settlement adapter is configured for enabled Markets

• ✓ Seller sees only provider-confirmed paid Orders

• ✓ checkout allocation expiry cannot release stock after paid success

• ✓ refund/partial-refund reconciliation is idempotent

• ✓ Courier request/offer/assignment and checkpoint-evidence authorization are bounded to the relevant paid Ready Order

• ✓ Pickup and Delivery Handoffs are separate and credentials are not interchangeable

• ✓ QR, OTP and Manual Verification all converge on one Handoff domain

• ✓ Handoff success requires backend connectivity and replay protection

• ✓ COMPLETED enables verified-purchase Reviews

• ✓ Claims can reconstruct payment/fulfilment/Handoff evidence

• ✓ Valkey/BullMQ failures preserve canonical correctness

• ✓ Sentry/Pino/pg_stat_statements and business alerts are wired

• ✓ Jest/Testcontainers/Maestro/Playwright/k6 gates pass

• ✓ staging/production isolation, backups and restore drills pass

• ✓ no prohibited legacy transaction terminology or cache technology remains in current contracts

- Ready-before-request, atomic one-active-delivery, paid charge/compensation equality, final recipient direction/delegation, checkpoint failure and separate Operator principal tests pass. Source Scene privacy cannot rewrite existing Orders or authorize stale merchandise.

## 134. Final architecture

Buyer Scene discovery or Product/Seller Search -> current Product Post/Variant -> Multi-Cart/Checkout Session UX -> separate Seller Orders and payment attempts -> provider/backend-verified PAID -> Seller preparation/Mark Ready -> selected fulfilment -> verified custody/receipt -> Completion -> Buyer-owned Review/Claim/refund.

For Courier Delivery: charge/compensation snapshot before payment -> Ready -> approved direct/Pool offer -> atomic winning assignment and one-active-delivery check -> Seller-displayed Pickup/Courier scan -> Courier-displayed Delivery/Buyer-or-delegate scan. Foreground Pickup/Delivery evidence is best effort; no continuous route or client completion authority exists.

NestJS/Fastify/strict TypeScript and PostgreSQL/Drizzle own domain truth; transactions/outbox feed Valkey/BullMQ idempotent consequences. Provider adapters, R2/CDN/Sharp image dependencies, generated REST/OpenAPI, security middleware, tests and recovery retain their original boundaries.

![Independent Seller Orders and payments](graphics/ORDER_07.svg)
*Figure 07. Independent Seller Orders and payments. Multi-cart/Checkout Session groups Buyer progress only; payment, fulfilment, Handoff, refunds and Claims remain Seller-specific.*

## 135. Hard Order/Checkout invariants

• ORDER-INV-01: One Seller Order belongs to one Buyer, one Seller, one Market and one currency.

• ORDER-INV-02: A Checkout Session may group Orders but never becomes cross-Seller financial authority.

• ORDER-INV-03: Product/Variant price and Inventory are revalidated server-side before Order/payment creation.

• ORDER-INV-04: Provider-confirmed backend facts are the only payment-success authority.

• ORDER-INV-05: Seller never confirms Buyer payment manually.

• ORDER-INV-06: Current Adulis transaction commission is a launch-disabled zero Buyer-side Checkout surcharge.

• ORDER-INV-07: Client code never calculates canonical surcharge or payable total.

• ORDER-INV-08: Payment aggregator/provider integration handles surcharge collection/settlement mechanics.

• ORDER-INV-09: Checkout Inventory allocation is short-lived, payment-attempt-scoped and database-authoritative.

• ORDER-INV-10: Valkey is never Order, payment or Inventory truth.

• ORDER-INV-11: Courier Delivery has separate PICKUP and DELIVERY Handoffs.

• ORDER-INV-12: QR primary, OTP fallback and Manual Verification use one Handoff state machine.

• ORDER-INV-13: Handoff acceptance requires backend validation; no local-only completion exists.

• ORDER-INV-14: Best-effort Pickup/Delivery checkpoint evidence neither proves final receipt nor blocks valid Handoff.

• ORDER-INV-15: Reviews require transaction-backed completed purchase evidence.

• ORDER-INV-16: Refund completion is provider/Finance verified, not Seller-reported.

• ORDER-INV-17: API instants are UTC; human display uses relevant Market-local time.

• ORDER-INV-18: Historical snapshots and transition records are append-only evidence.

- ORDER-INV-19: Paid Courier delivery charge equals immutable compensation; current surcharge basis excludes delivery.

- ORDER-INV-20: Mark Ready precedes the Courier request/offer workflow and does not require assignment.

- ORDER-INV-21: One Courier has at most one active accepted delivery; one Order at most one active assignment.

- ORDER-INV-22: Pickup recipient Courier scans; final Buyer/delegate scans Courier-displayed Delivery credential.

- ORDER-INV-23: Delegation is final-receipt-only and never transfers Buyer rights/history.

- ORDER-INV-24: Source Scene visibility is Content-owned and cannot rewrite an existing Order.

- ORDER-INV-25: Operator is a separate internal security principal using named domain commands.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 136. Superseded assumptions

This version removes the prior long-waiting purchase flow, Buyer payment screenshots, Seller payment confirmation, manual external refund acknowledgment, single-QR final-only Courier flow, local Handoff success, seller-side commission and legacy cache terminology.

It also updates the Order model for multi-cart Checkout Sessions, gateway/aggregator payments, buyer-side surcharge collection, Product/Scene attribution, best-effort Pickup/Delivery checkpoint evidence and the current modular-monolith technology baseline.

The assignment-before-ready rule, simultaneous multi-Order Courier carrying, Buyer-presented Courier Delivery QR, Courier scanning both stages and continuous/live-map delivery architecture are superseded by the current contracts.

## 137. Recommended implementation sequence

• Phase 1 - schema/migrations for Seller Orders, OrderLines, snapshots, Checkout Session and transition history.

• Phase 2 - Inventory checkout allocation + concurrency tests.

• Phase 3 - PaymentProviderAdapter + Chapa integration + webhook/reconciliation/idempotency.

• Phase 4 - multi-cart Checkout coordinator + sequential Seller payments + Buyer progress UI.

• Phase 5 - zero launch surcharge policy snapshot + aggregator collection/Finance ledger integration.

• Phase 6 - Seller paid-order flow, preparation, Mark Ready and fulfilment modes.

• Phase 7 - Ready-gated Courier request/offer/atomic assignment + foreground checkpoint evidence.

• Phase 8 - unified Handoff domain: Pickup/Delivery QR, OTP fallback, Manual Verification.

• Phase 9 - provider refund/reconciliation + Claims/Reviews/Trust events.

• Phase 10 - observability, load/security tests, staging certification, restore drills and production launch gates.

Include compensation/fulfilment snapshots in Checkout, Ready-gated approved Courier request/offer/atomic assignment, one-active capacity, final delegation, directional connected Handoff and non-blocking checkpoint evidence before certifying delivery. Keep allocations/provider reconciliation/refunds first-class rather than adding a parallel engine.

## 138. Final engineering doctrine

Order Management must make the sequence of money, stock, custody and Buyer receipt explainable from durable evidence. A visually successful payment screen is not payment truth. A selected Courier is not pickup truth. Checkpoint location is not delivery truth. A Seller click is not refund truth.

The correct path is intentionally conservative: server-calculated commerce -> provider-confirmed payment -> Seller fulfilment -> verified physical Handoff -> auditable completion. PostgreSQL preserves the history; Valkey/BullMQ accelerate and coordinate it; provider adapters isolate external payment differences; clients remain responsive without becoming authorities.

## 139. Glossary

| Term | Definition |
| --- | --- |
| Seller Order | One Buyer/Seller/Market/currency transaction with independent payment/fulfilment/Claims. |
| Multi-Cart | Buyer UX groups Seller carts/Orders; no cross-Seller financial super-order. |
| Checkout Session | Orchestration/progress grouping of independent Seller Order/payment attempts. |
| Payment Attempt | Provider-scoped attempt with immutable amount, idempotency and reconciled outcome. |
| Checkout Inventory Allocation | Short provider-attempt stock allocation; success consumes, failure releases safely. |
| Scene Post | Seller-authored image-led discovery content with same-Seller Product Post tags and current eligibility. |
| Product Post | Canonical structured commerce representation of exactly one Product; current price/stock are domain-owned. |
| Courier Delivery Charge | Seller-defined Buyer checkout charge; equals immutable Courier compensation in MVP. |
| Courier Compensation | Immutable Courier offer amount matching the paid delivery-charge snapshot. |
| Courier Pool | Standing Seller-approved Courier relationships, separate from active delivery assignment. |
| Cross-Seller Courier Network | Approved opportunities/relationships across Sellers using one persistent Courier identity. |
| Delivery Request | Ready-gated direct/Pool request for approved eligible Courier offers. |
| Delivery Offer | Approved Courier opportunity with paid compensation snapshot and expiry. |
| Delivery Assignment | Atomic winning accepted delivery; one active per Courier and per Order in MVP. |
| Mark Ready | Paid prepared Order transition that permits Courier requests, before assignment. |
| Pickup Handoff | Seller displays purpose-bound QR; assigned Courier scans to verify custody. |
| Delivery Handoff | Courier displays final QR; Buyer/designated recipient scans to verify receipt. |
| Delegated Recipient | One Buyer-authorized final recipient by name/phone; no transfer of Order/Claim/refund/Review rights. |
| Checkpoint Location Evidence | Two best-effort foreground Pickup/Delivery captures; supporting evidence, never receipt authority. |
| Adulis Checkout Surcharge | Backend zero-bps Buyer fee on eligible merchandise, excluding Courier delivery currently. |
| Commercial Snapshot | Immutable purchase-time merchandise/charge/fee and Commercial Policy facts. |
| Fulfilment Snapshot | Captured mode/terms/charges and policy/configuration for the Seller Order. |
| Allowed Action | Backend-returned current lawful operation for actor/resource/surface. |
| Transactional Outbox | Durable event/intent recorded with canonical transaction, relayed after commit and reconciled. |
| Shoppable Post | Superseded former term for Scene Post. |

## 140. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-08 — Review presentation and write eligibility | The 13 October Reviews design separates Product Quality and Seller Service and defines evidence-based eligibility. | Anyone may read Reviews. Product Reviews expose Product Review and Seller Review. Scene Reviews expose one Product tab per distinct tagged Product plus Seller Review. Write/Edit controls appear only when authoritative Review eligibility exists; ineligible viewers see no composer. Product Quality and Seller Service remain separate. One active Product Review and one active Seller Review are maintained per qualifying entitlement; edit updates instead of duplicating. Sellers cannot edit/delete legitimate Buyer Reviews; Report Review is a moderation utility. The prototype’s completed-order path does not silently remove the 13 October design’s VERIFIED_ORDER_FAILURE Seller-service basis; that failure basis remains valid unless a later founder decision explicitly removes it. | PR-005, 27 Oct 2026 |
| R-10 — Purchased Products and Buy Again | The 13 October pack has Buyer Orders/account history but not the finalized Purchased Products UX. | Purchased Products derives from completed Buyer Orders and shows one entry per Product using the latest purchase: Seller, purchase date, purchased variant and current Product facts where resolvable. Buy Again opens the current Product with the last variant preselected only if still offered; Buyer must still choose quantity/fulfilment and explicitly order/pay. Unavailable or delisted Products remain in purchase history without an invalid Buy Again action. Review actions reuse canonical Review eligibility. | PR-006, 27 Oct 2026 |
| R-14 — Courier compensation source and immutable Order snapshot | The 13 October Fulfilment/Order/Finance designs already treat delivery charge as Seller-defined, shown before payment and snapshotted on the Order. | There is no per-Courier-relationship compensation schedule in the current MVP. One Seller-level Courier Delivery term applies to future Checkout quotes. Once the Buyer accepts/pays, the Order’s Courier Delivery/compensation amount is immutable history. Delivery Offers, Seller selection surfaces and Courier Mode display the Order snapshot. Changing Seller terms affects future quotes only. | PR-008 correction, 27 Oct 2026 |
| R-15 — Courier offer eligibility and sequence | The 13 October designs already require Courier acceptance and one active accepted delivery. | A direct Delivery Offer may be sent only to a Courier who is in the Seller’s Approved pool relationship, Adulis-verified, AVAILABLE and has no active accepted delivery. BUSY Couriers may remain visible for context but are disabled with reason. UNAVAILABLE, restricted, pending, removed or non-approved Couriers are ineligible. Seller request/offer never equals assignment; Courier acceptance atomically rechecks eligibility/capacity. Mark Ready precedes offer. Offer timing must respect the one-active-delivery rule. | PR-008 correction, 27 Oct 2026 |
| R-22 — Canonical launch Adulis surcharge remains zero | The October 13 Finance/Order/Market/KB designs set launch Adulis surcharge to 0 bps / amount zero. | Launch Adulis surcharge is disabled: 0 bps and zero amount. Provider processing fee is a separate provider-policy route and may be Buyer-paid only when that route is explicitly permitted and confirmed. The prototype canonical-rules line claiming a current 0.5% Adulis Buyer surcharge is stale and must not be implemented. | October 13 pack reaffirmed against stale prototype rule |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
