# Adulis Payments, Payouts & Financial Evidence
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R01. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-FIN-01_Adulis_Payments_Payouts_Financial_Evidence_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Mission

Adulis Payments, Payouts & Financial Evidence is the financial-integrity domain for gateway commerce. It converts Checkout payment intent into provider-verified financial facts, preserves the exact Buyer charge, tracks Seller settlement and refunds, and produces auditable evidence without allowing client applications or Sellers to invent money state.

The current architecture is gateway-first, online-only and provider-authoritative. Chapa is the initial named gateway where Market configuration enables it; future aggregators plug into the same internal provider contract.

```
Buyer Checkout
   -> Seller Order
   -> Payment Provider Adapter
   -> Chapa / market provider
   -> provider-verified payment
   -> seller preparation / fulfilment
   -> settlement + surcharge ledger + refund evidence
```

## 2. Version scope and precedence

Historical reviewed-baseline note (superseded by the selected 12 October amendment): Version 3.0 / 7 October 2026 replaces the previous direct bank-transfer, Buyer-uploaded receipt and Seller payment-decision architecture. Those workflows are not part of the current payment model.

This document aligns with the updated Order Management & Checkout, Mobile App, Seller Console, Storefront, Operator Console and Deployment designs. Newer explicit Adulis decisions supersede earlier financial assumptions.

The supplied current specification supersedes conflicting all-Market launch, account/grant, KYC ownership and dispatcher language; this is the complete preserved financial design.

## 3. Governing financial principles

• Payment success is established only by backend-verified provider facts.

• One Seller Order is one independent payment scope; a multi-cart Checkout Session is only Buyer UX grouping.

• The current Commercial Policy charge is a launch-disabled zero Buyer-side Adulis Checkout surcharge.

• Payment aggregators handle the mechanism by which the surcharge is collected and settlement is routed.

• Payment success, Seller settlement, refund completion and physical Handoff are separate facts.

• PostgreSQL is canonical financial state; Valkey and client caches are never money truth.

• All state-changing payment operations require network connectivity.

## 4. Current canonical financial flow

The Buyer reviews a server-calculated Seller Order amount, then the backend creates a provider payment attempt. The provider adapter maps the internal amount snapshot into the selected Market provider. The client may be redirected to or return from a provider, but that navigation is not proof of success.

Provider webhook and/or server verification establishes the normalized payment result. Only then does the Seller Order become paid and operationally visible to the Seller.

## 5. System boundary

This system owns payment attempts, provider-event normalization, verification/reconciliation facts, surcharge collection accounting, Seller settlement/payout references, refund execution/reconciliation, and sensitive financial evidence.

It does not own Product pricing, Inventory availability, Order lifecycle legality, fulfilment, Handoff acceptance, Claims decisions, Trust calculation, Reviews, or seller subscription policy. Those domains provide or consume typed facts.

## 6. Globally extensible, Market-activated provider architecture

The architecture is globally extensible and Market-aware; commerce activation is phased, with Ethiopia as the first active launch Market. Future Markets require explicit approved Market Configuration and operational readiness. Server-derived canonical Market context wins over client country fields, IP, phone prefix, locale or worker region. Global-ready code never activates commerce by itself.

Future provider routes activate only after legal/compliance validation, confirmed provider and currency availability, initiation/server verification/webhook capability, required refunds/partial refunds, settlement feasibility, tax/Commercial Policy readiness and operational approval. Each enabled route is provider + Market + currency + capability/version.

One provider does not work everywhere. If no approved route can charge the Buyer and handle the configured surcharge, Checkout fails closed. Chapa remains the initial named provider only where current Ethiopia configuration enables it; adapter-specific DTOs never leak into canonical PaymentAttempt/Order schema.

![Global provider architecture, explicitly activated Markets](graphics/FIN_01.svg)
*Figure 01. Global provider architecture, explicitly activated Markets. Ethiopia starts the phased rollout. Legal, provider, currency, refunds, settlement and operational readiness form the approved activation boundary.*

## 7. Chapa as initial named provider

Chapa is the initial named Ethiopia adapter target, not evidence of an enabled live agreement. One API/version/reference/authentication/event/verification contract must be pinned from actual agreed evidence before activation. Generic normalized owner models remain provider-independent; no mixed v1/v2 examples establish permission.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 8. Provider capability registry

Each enabled capability requires both documented technical support and permission actually granted to the exact Adulis merchant model. Evidence matrix appears in the provider appendix; until attached, enabled_live=false for the affected scope. Configuration never creates legal powers.

## 9. Multi-cart payment boundary

A Buyer may review products from several Sellers in one multi-cart Checkout Session, but each Seller Order is created and paid independently. The current Buyer flow performs these payments one by one.

A successful payment for Seller A must not wait for Seller B. A failure for Seller B must not reverse Seller A. Each Order carries its own payment attempt, settlement, refund, surcharge and evidence references.

## 10. One Seller Order per payment scope

Each financial payment scope resolves exactly one Buyer, one Seller, one Market and one currency. This simplifies settlement attribution, Seller obligations, refunds, Claims, financial reporting and audit.

Cross-Seller combined charges are not part of the current architecture.

## 11. Payment authority

The Payments domain is authoritative for normalized payment state, but only from authenticated provider information. Mobile success screens, browser redirects, query parameters, screenshots, Seller actions and analytics events cannot mark an Order paid.

Seller Console and Seller Companion render provider-verified payment state as read-only operational context.

## 12. Online-only financial operations

Payment initiation, payment verification, refund requests, settlement changes and financial evidence access require backend connectivity. A device may preserve ordinary UI state, but it cannot create a local paid/refunded/settled result.

If connectivity is lost during provider return, the client shows Processing or Reconnect and re-reads canonical state when online.

## 13. Provider return handling

The return URL or deep link exists only to bring the Buyer back to Adulis. The client immediately refetches the payment attempt and Order. It never parses a success parameter into canonical state.

Provider-return tokens or references in URLs must be treated as sensitive navigation data and minimized.

## 14. Webhook authority

Webhook ingress validates authenticity according to the configured provider contract, records an idempotent provider event, translates it to a normalized fact and then invokes the Payments application service.

Webhook processing tolerates duplicate, delayed and out-of-order delivery.

## 15. Server verification and reconciliation

Before accepting normalized success, ALWAYS re-verify Chapa result server-side under the pinned adapter; bind exact expected transaction/reference, merchant/environment, amount, currency and final result. Authenticate webhook ingress; provider lookup/network is outside DB transactions.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

## 16. Ambiguous outcomes

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

## 17. PaymentAttempt entity

Conceptual fields include id, seller_order_id, provider, provider_attempt_reference, status, expected_amount_minor, currency, created_at, initiated_at, verified_at, failed_at, expires_at, reconciliation_state, market_id and idempotency_key_hash.

Provider secrets and full provider payloads do not belong in this row.

```
PaymentAttempt (conceptual amendment)
  attempt_generation; quote_id/version; merchant_ref; environment
  provider_contract_id/version; expected component snapshot
  finality_status; finality_evidence_ref; release_decision_ref
ExternalCharge
  provider_transaction_id; merchant/environment; attempt_ref
  amount_minor; currency; verification_ref/time; status
  UNIQUE(provider, environment, merchant_ref, provider_transaction_id)
Duplicate-charge obligation is separate; never UNIQUE(order_id) here.
```

Attempt/dispatch provenance additionally stores dispatch_intent_id, dispatch_generation, dispatch_state, initiation evidence, finality/release adapter contract version and authoritative evidence reference. Possible dispatch is not overwritten by local expiry. Order §35/46 locks and re-reads this owner evidence; no verified charge can be deleted by cancellation.

## 18. PaymentProviderEvent entity

Every inbound provider event is deduplicated and auditable. Store a provider event identifier when available, received timestamp, event type, normalized outcome, payload hash, authenticity result and processing outcome.

Raw provider bodies are retained only when a documented support, dispute or regulatory purpose justifies them.

## 19. Provider reference policy

Provider references shown to Sellers or Buyers are safe bounded identifiers. Full provider request/response bodies, signatures, secret keys, settlement account credentials and internal reconciliation metadata never enter ordinary client payloads.

## 20. Idempotency and unique constraints

• Payment-attempt creation is idempotent for the same Seller Order and intent.

• Provider-event identifiers or stable hashes are unique per provider/environment.

• A provider success cannot create multiple paid transitions for one attempt.

• Refund creation is idempotent for the same requested refund intent.

• Settlement/reconciliation imports deduplicate provider records.

## 21. Money snapshot

Every payment attempt references an immutable server amount snapshot from Order Management. Financial services never recalculate Product prices from live Catalogue data after the Order exists.

All monetary values use integer minor units or an equivalent exact decimal representation. Floating-point arithmetic is forbidden for charge, refund, surcharge and settlement calculations.

## 22. Buyer-side Adulis Checkout surcharge

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

## 23. Surcharge basis and policy version

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

Active example: merchandise 100,000 minor units, Adulis rate 0 bps -> Adulis amount 0. Total = merchandise + approved delivery + a provider-confirmed permitted fee, not a guessed fixed value. Old accepted amounts retain their captured policy.

## 24. Currency rounding

Rounding is deterministic per Market/currency and occurs once in backend calculation. The provider charge must use the same stored amount. Any provider amount mismatch is a Finance/Operator exception.

## 25. Aggregator collection of Adulis surcharge

No Adulis platform fee is collected at launch. The target is provider-managed Seller settlement, conditional on confirmed merchant/subaccount route. Buyer-paid provider processing cost requires approved legal incidence and exact calculation; no provider fee switch/split privilege is assumed.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 26. Seller proceeds

Seller proceeds are derived from the immutable Order amount and provider settlement rules, not from a browser calculation. Seller-visible financial summaries distinguish Buyer total, Adulis surcharge, provider fees where contractually exposed, refunds and the expected Seller settlement amount.

Do not imply a precise net settlement until the provider has supplied the relevant fact.

## 27. Payment success is not settlement

A successful Buyer charge and a completed Seller settlement are separate states. The Order can be PAID while settlement is still PENDING or provider status is not yet available.

Fulfilment is triggered by provider-verified Buyer payment according to Order policy; it does not wait for Seller bank settlement unless a future Market rule explicitly requires that.

## 28. Meaning of Payout in this document

Payout means provider/aggregator settlement of Seller proceeds, not an Adulis wallet or manual disbursement from funds held by Adulis. Adulis records provider settlement facts and may initiate provider-supported payout actions only through approved adapter contracts.

No internal Seller balance for purchase proceeds is introduced by this design.

## 29. Seller provider onboarding

Prefer provider-hosted or tokenized Seller merchant/onboarding and settlement setup. Adulis retains minimum provider account/merchant reference, onboarding/completion/error status, settlement status, masked destination/metadata, Market/environment and audit refs.

Adulis Seller admission/verification does not require national ID, passport, driving licence, selfie-ID matching or Adulis KYC-document upload. Social-commerce admission and account-control evidence belong to Onboarding, distinct from financial provider compliance and Trust.

A regulated PSP may independently require KYC/KYB/identity evidence under its contract or Market law. Route the Seller into the provider-hosted flow where available. Retaining provider onboarding status does not require copying identity documents and does not introduce an Adulis Government-ID eligibility condition.

Only a confirmed provider contract/law requirement can justify unavoidable Adulis handling of KYC data: restricted Financial boundary, minimization, encryption, explicit retention and audited access; no copy into general Seller verification and no general Seller/Operator API exposure. No such collection requirement is assumed in this design.

![Adulis Seller admission and provider compliance are distinct](graphics/FIN_02.svg)
*Figure 02. Adulis Seller admission and provider compliance are distinct. Adulis admission requires no Government ID. Provider-hosted KYC may be independently required; status-only references avoid copying identity documents.*

## 30. Seller settlement configuration

The Seller Console may render provider onboarding/settlement status and backend-supplied allowed actions such as Complete provider onboarding or Update permitted settlement details.

All configuration mutations route through the Payments domain and provider adapter. The Console does not write financial tables directly.

## 31. Step-Up for sensitive settlement changes

Where the provider integration allows Adulis to change a Seller settlement destination or merchant configuration, require fresh Step-Up Authentication when policy marks the operation sensitive. Bind the authorization to the exact Seller, operation and provider account.

Write an immutable change/audit record and send required security notifications.

Step-Up binds the authenticated ordinary Account, exact Seller, exact provider account/operation and a short validity window. Security/configuration events commit with financial truth; Notifications independently resolves current permitted recipients and delivery policy. Finance transaction logic sends no hard-coded push/SMS.

## 32. Minimize raw Seller bank credentials

Do not collect or store full Seller bank credentials merely because the legacy system once did. If the provider can own the credential, Adulis should keep only a provider token/reference plus masked display metadata.

If a future provider contract genuinely requires Adulis to hold sensitive settlement credentials, place them in the restricted Financial boundary, encrypt them, and expose only masked values.

## 33. SellerProviderAccount entity

Conceptual fields may include seller_id, provider, provider_account_ref, onboarding_status, settlement_status, masked_destination, market_id, created_at, updated_at and security/audit references.

Provider account references are scoped by environment and cannot be accepted from arbitrary client input without server validation.

## 34. Normalized settlement states

Use a small provider-independent set such as UNKNOWN, PENDING, SETTLED, FAILED, REVERSED and REQUIRES_ACTION, while preserving the raw provider state separately for diagnosis where safe.

Do not map every provider-specific state into a new Order state.

## 35. Settlement reconciliation

Settlement reconciliation ingests provider reports/webhooks/status queries and links them to Seller Orders, payouts and surcharge ledger entries. Missing or contradictory data creates an exception rather than silent guessing.

Reconciliation jobs are retryable and idempotent.

## 36. Payout/settlement history

Seller-facing history returns only safe fields: provider, masked settlement reference, covered Orders or period, gross seller value, refunds/adjustments where appropriate, provider-confirmed status and timestamps.

Never expose provider secrets or unrelated Buyers financial details.

## 37. Seller Console financial boundary

Seller Console sees read-only Buyer payment status and permitted settlement configuration actions. It exposes no Seller-side manual payment-approval controls.

Paid Orders appear exactly once after backend verification.

## 38. Mobile financial boundary

Buyer Mode starts provider payment, returns to Adulis, polls/refetches canonical state and displays sequential multi-Seller payment progress. Seller Companion sees paid status and preparation actions only.

Mobile never receives provider secret keys, webhook credentials or settlement-account secrets.

## 39. Operator Console financial boundary

Operator Account is a separate internally provisioned privileged principal, with independent credentials, strong authentication, OPERATOR sessions, recovery, revocation and audit identity. Ordinary Account roles, phone OTP, public registration and Mode switching do not create Operator authority. The same person may possess both principals, but their authorization and identifiers remain distinct.

Privileged commands require the separate Operator Account, a current narrow capability, exact Market/resource/case scope, purpose/reason and audit, with fresh authentication and approval where existing Operator governance requires it. No generic superuser bypass, arbitrary state setter or impersonation path is introduced.

Use narrow Finance capabilities such as FINANCIAL_PAYMENT_READ, FINANCIAL_RECONCILE, FINANCIAL_REFUND_READ, FINANCIAL_SETTLEMENT_READ, FINANCIAL_EVIDENCE_READ and FINANCIAL_EVIDENCE_EXPORT, mapped to the established Operator taxonomy. Current OPERATOR session, exact case/resource/Market scope and sensitive-read audit are required. No Operator command fabricates provider success or directly sets arbitrary finance state.

![Ordinary relationships and privileged authority are independent](graphics/FIN_03.svg)
*Figure 03. Ordinary relationships and privileged authority are independent. The same human may possess both principals, but session, credential, recovery, scope and audit do not cross from an ordinary Account to an Operator Account.*

## 40. Financial evidence - current definition

Financial evidence is now primarily provider-generated and system-generated evidence, not Buyer-uploaded payment screenshots. It exists to explain why Adulis concluded a payment, refund or settlement state and to support Claims, audits and incident response.

Examples include normalized provider events, verification results, amount snapshots, refund references, settlement records, surcharge ledger facts and signed/hashed evidence artifacts where retained.

## 41. Provider-event evidence

For every decisive money transition, retain enough immutable metadata to reconstruct: which provider fact was received, when, for which attempt, what amount/currency was expected, what authenticity check passed and which application transition followed.

The evidence model must remain useful even after transient provider responses are no longer retained.

## 42. Raw provider payload minimization

Do not store entire provider payloads by default. Normalize the fields needed for business truth and retain a cryptographic hash of the received body where useful for integrity.

If raw payload retention is necessary for dispute, provider support or compliance, store it in restricted encrypted evidence storage with a documented retention policy.

## 43. Private financial evidence storage

Cloudflare R2 may be used for private financial evidence objects such as retained provider reports or support exports. These objects are never served from the public media domain or a public bucket.

Use random object keys, no predictable filenames, strict bucket credentials and no shared CDN caching.

## 44. Evidence provenance

Every retained evidence object records source_type, provider, environment, related payment/refund/settlement identifiers, object hash, received/generated timestamp, retention_reason and lifecycle state.

Evidence metadata is canonical in PostgreSQL; object bytes remain in private storage.

## 45. Financial access log

Every successful sensitive evidence/settlement read is coupled to authorization and append-only access logging. Highly sensitive reads fail closed on audit failure under explicit policy; success cannot silently bypass its access record.

Use distinct typed actor provenance and FKs; one ambiguous shared actor ID for ordinary and Operator identities is forbidden.

```
financial_access_log
  actor_type = ORDINARY_ACCOUNT | OPERATOR_ACCOUNT | SYSTEM
  ordinary_account_id?   // FK ordinary Account; required only for its actor type
  operator_account_id?   // FK separate Operator Account; required only for its type
  capability
  subject_kind / subject_ref
  seller_id? / seller_order_id? / claim_id?
  purpose / reason where required
  occurred_at / correlation_id / request_id
CHECK actor_type matches exactly its principal FK; SYSTEM has neither
```

## 46. Role derivation

One human uses one ordinary Adulis Account across Buyer capability, Seller ownership relationships, Seller-team participation and Courier profile/relationships. Different humans use different Accounts; Seller credentials are never shared. At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the MVP team slot. Multiple roles within that membership compose by current effective permission union. Ownership and Courier relationships are separate from the team slot.

Switching Buyer, Seller or Courier context changes presentation and scoped authority, never the human's identity. An unrelated Courier or Seller relationship cannot grant access to a Buyer Order, another Seller's records or privileged operations.

Buyer access requires exact Order Buyer ownership. Seller settlement access requires current Seller ownership or active team membership with effective financial role permission, exact Seller/Market and allowed surface. Courier relationship alone grants no settlement/evidence access.

Operator APIs separately authenticate an Operator Account and OPERATOR session, then derive current Finance capability and case/resource scope. Client role labels, Seller ADMIN and ordinary Account credentials cannot grant internal authority. Use IDOR-safe denial without exposing another principal's financial object existence.

## 47. Claims integration

Claims consumes provider-confirmed payment/refund facts and Handoff/fulfilment evidence without owning the Payment state machine. Opening a Claim may place a retention hold on relevant financial evidence.

Resolution may create a permitted refund command; the provider result remains the refund-completion authority.

## 48. Evidence export

Operator/Claim evidence exports are generated for a specific case, access-controlled, time-bounded and audited. They are never public links. Export packages should include only the minimum financial fields necessary for the case.

Export requests use the separate Operator principal and exact FINANCIAL_EVIDENCE_EXPORT or established equivalent capability with case/purpose scope and immutable access audit. Ordinary API responses contain no signed private evidence URL; permitted delivery remains through the controlled evidence workflow.

## 49. Evidence retention

Retention is policy-driven. Keep normalized durable transaction facts required for accounting/audit, but retain raw provider bodies and private evidence objects only as long as their legitimate purpose requires.

Open Claims, fraud/security investigations or legal obligations may extend retention through an explicit hold.

## 50. Evidence deletion and lifecycle

Physical object deletion is asynchronous and auditable. Mark an object eligible for deletion, execute the private-storage purge, confirm success, then record deleted_at. Do not claim deletion if object removal failed.

Account deletion may anonymize identity links while preserving the minimum payment/accounting record required by policy.

## 51. Refund architecture

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

Finance persists refund intent/obligation before the external call, links a verified charge and governed decision, separates accepted/requested processing from COMPLETED reimbursement, and reconciles ambiguous attempts without issuing duplicates. Insufficient Seller/provider funding remains pending/refused/overdue, not success.

## 52. RefundRequest entity

Conceptual fields include refund_id, seller_order_id, payment_attempt_id, provider_ref, requested_amount_minor, currency, reason_code, policy_version, status, requested_by, requested_at, provider_updated_at and completed_at.

Partial line refunds additionally reference the affected OrderLine(s).

requested_by uses typed actor_type and the matching ordinary_account_id or operator_account_id, with SYSTEM where a valid approved application service initiates a consequence. Audit links must not conflate principal domains.

```
Refund obligation amendment
  seller_order_id; charge_id; owed_amount_minor; currency
  responsibility=SELLER; decision_id/version; deadline/policy
  REQUESTED|PENDING|COMPLETED|REFUSED|OVERDUE
  provider_acceptance_ref/time; verified_completion_ref/time
  refusal/overdue history; outstanding_amount; correction lineage
Provider-request acceptance is not COMPLETED.
```

## 53. Refund idempotency

Retrying the same approved refund must not create multiple provider refunds. Use a stable internal refund ID/idempotency key and provider-specific idempotency capabilities where available.

Duplicate webhook events update the same refund record.

## 54. Partial refunds

When the provider supports safe partial refunds, the Payments adapter executes the server-calculated amount from Order/Commercial Policy. If the provider cannot express the required partial outcome, route to controlled Finance/Operator handling.

Never calculate partial refund amounts in the browser.

## 55. Surcharge refund treatment

Launch Adulis surcharge is zero, so its launch refundable component is zero. Actual provider-fee refund treatment is unconfirmed and must be disclosed from the agreed provider contract; no assumed tariff/refundability. Historical captured fees keep their original policy.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

## 56. Refund versus settlement

A refund may be requested after Seller settlement has begun or completed. Provider-specific settlement offsets/reversals are Finance facts, not Order state shortcuts.

The system must preserve both the Buyer refund outcome and the Seller settlement adjustment trail.

## 57. Chargeback and external dispute posture

Where the actual provider imposes disputes/chargebacks/reserves or merchant debits, record liabilities, source/evidence and reconciliation even at launch. No-voluntary-Adulis-funding does not remove contractual exposure. Exact amounts/rights and recovery route require signed evidence before live payments.

## 58. Order Management integration

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

## 59. Inventory integration

Finance records money, never independently decrements Inventory. The approved Order/Inventory owner unit of work consumes a preserved verified charge with atomic stock/PAID/history/outbox. Expiry, duplicate/reordered success and late allocation follow that same serialization.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

## 60. Fulfilment and Handoff integration

Seller preparation becomes available only after operational Order PAID and stock commit, never merely after Finance charge verification. Payment, provider settlement and receipt remain independent. Handoff follows its stage/recipient matrix; checkpoint GPS is no financial authority.

## 61. Billing/ledger integration

Ledger entries reference immutable quote/charge/Order components: zero launch Adulis rate/amount, separate provider cost and Seller entitlement, exact basis/currency/rounding and versions. Append corrections/reversals; never rewrite old paid history.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 62. Checkout surcharge ledger

A dedicated ledger separates Buyer platform-charge accounting from Seller proceeds. At minimum track charge amount, collection status, refund/reversal amount, provider settlement reference, accounting period and reconciliation state.

The ledger is not an internal wallet and does not grant the client spendable balance.

## 63. Adjustments are append-only

If a provider fee, refund or settlement correction changes the financial outcome, write an adjustment with reason/reference. Never mutate the original paid amount or surcharge record to pretend the original event was different.

## 64. Taxes and regulated charges

Taxes or future regulated charges are applied only through an approved Market/Commercial Policy. The Payments adapter sends the provider the backend-computed total but does not invent jurisdictional tax logic.

Provider processing fees are separate from Adulis surcharge unless the contract explicitly says otherwise.

## 65. Provider fees

Buyer fee incidence is the selected preference, not an approved merchant-fee pass-through. Chapa’s published Article 6 conflicts with it; preserve the decision and block the unsupported live route until written provider/legal resolution and exact rate/basis/rounding/refund treatment. Do not silently charge Seller instead.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 66. No client-side money authority

Mobile, Seller Console, Storefront and Operator Console may format monetary values but may not calculate canonical payable total, surcharge, refund entitlement, settlement amount or payment state.

All critical values come from typed API responses.

## 67. Market and currency context

Each financial record is Market/currency scoped. Provider selection, currency minor units, surcharge policy, refund capability and Seller settlement configuration are resolved server-side from Market configuration.

Cross-currency conversion is not silently performed unless a future approved payments architecture introduces it.

Only explicitly activated Markets and approved provider + currency + capability versions can transact. An inactive future Market has no payment route, even though schemas/adapters are globally extensible. New Market taxes or regulated charges require approved policy and cannot silently reuse Ethiopia assumptions.

## 68. Time and timezone semantics

APIs and canonical financial timestamps use ISO 8601 UTC instants. Human-facing Seller/Buyer/Operator screens render in the relevant Market or Order timezone context.

Provider timestamps are normalized to UTC while preserving the original provider timestamp/raw zone when diagnostically necessary.

## 69. Payment API contract principle

Use REST + OpenAPI with generated TypeScript clients. All endpoints return machine-readable states and request IDs. Clients do not duplicate provider DTOs or parse raw provider payloads.

## 70. Buyer payment APIs

```
POST /v1/checkout-sessions/{id}/seller-orders/{orderId}/payment-attempts
GET  /v1/orders/{orderId}/payment
GET  /v1/orders/{orderId}/refunds
POST /v1/orders/{orderId}/refund-request   # only if backend contract permits buyer action
```

## 71. Provider ingress APIs

```
POST /v1/payments/providers/chapa/webhook
# additional provider-specific ingress lives behind the same normalized Payments application layer
```

## 72. Seller settlement APIs

```
GET  /v1/seller/payment-provider/status
POST /v1/seller/payment-provider/onboarding
POST /v1/seller/payment-provider/settlement-config
GET  /v1/seller/settlements
# exact enabled actions come from backend/provider capability and allowed_actions
```

## 73. Operator/Finance APIs

```
GET  /v1/ops/payments/{paymentId}
POST /v1/ops/payments/{paymentId}/reconcile
GET  /v1/ops/refunds/{refundId}
GET  /v1/ops/settlements/{settlementId}
GET  /v1/ops/financial-evidence/{evidenceId}
```

Every /v1/ops Finance route requires a separate Operator Account, OPERATOR session, current narrow capability, exact resource/Market/case scope and audit. Ordinary Buyer/Seller/Courier sessions are denied regardless of role labels.

## 74. Error taxonomy

Use explicit errors such as PAYMENT_PROVIDER_UNAVAILABLE, PAYMENT_ATTEMPT_CONFLICT, PAYMENT_PROCESSING, PAYMENT_AMOUNT_MISMATCH, PAYMENT_ALREADY_SUCCEEDED, REFUND_NOT_ALLOWED, REFUND_PROCESSING, SETTLEMENT_ACTION_REQUIRED, PROVIDER_CONFIGURATION_REQUIRED and FINANCIAL_PERMISSION_DENIED.

Do not expose secret verification detail or another Sellers financial object existence.

## 75. Provider secrets

Provider API keys, webhook secrets and signing material never enter PostgreSQL, mobile/web bundles, analytics or logs. Store them in environment/secret management scoped to environment and provider.

Rotate provider credentials using documented runbooks and preserve enough version metadata to explain which credential generation signed/verified historical traffic without retaining the secret value.

## 76. Webhook signature/authenticity verification

Authenticate provider events before they can cause a financial transition. Verification failures are logged as security events with payload content redacted/minimized.

Replay or duplicate valid events are handled idempotently rather than treated as new money.

## 77. Outbound provider security

Provider HTTP clients use configured allowlisted base URLs, TLS verification, bounded timeouts, retry policy and correlation IDs. Never allow user-controlled URLs to become provider destinations.

Retries must respect idempotency to avoid duplicate charges/refunds.

## 78. Rate limiting and abuse controls

Use @nestjs/throttler plus edge/provider-specific controls for payment-attempt creation, onboarding actions, reconciliation triggers and sensitive reads. Rate limits cannot replace Order ownership and authorization checks.

## 79. Provider token/reference handling

Tokenized provider account/payment references are sensitive identifiers. Store only what is required, mask them in client responses and avoid placing them in analytics or URLs where possible.

## 80. Logging

Pino structured logs include request_id, correlation_id, provider, operation, normalized status, Seller Order ID, duration, error code and deployment version.

Never log provider secrets, full webhook bodies by default, full bank/account credentials, Buyer payment credentials, authorization headers or private evidence bytes.

## 81. Analytics boundary

Analytics receives non-sensitive events such as payment_attempt_started, payment_processing, payment_succeeded, payment_failed, refund_started, refund_succeeded and settlement_exception. It never receives raw provider payloads, secret references or bank details.

Analytics failure must never block payment or refund state changes.

## 82. Audit versus analytics

Audit explains who/what changed or accessed sensitive financial state. Analytics explains aggregate product behavior. Audit is durable and access-controlled; analytics is privacy-minimized and non-authoritative.

## 83. Canonical database model

Recommended logical records include payment_attempt, payment_provider_event, payment_verification, seller_provider_account, provider_settlement, provider_payout, refund, checkout_surcharge_ledger,

financial_evidence, financial_access_log and shared platform.event_outbox / platform.job_intent.

Exact physical schemas may use core/payment/financial namespaces, but ownership and privileges must remain explicit.

## 84. Database constraints

• Unique provider event identity within provider/environment.

• One canonical successful outcome per payment attempt.

• Expected amount/currency stored and immutable after attempt initiation.

• Refund amount cannot exceed backend-calculated refundable balance.

• Seller provider account references scoped to the correct Seller and environment.

• Append-only transition/audit records for financial state changes.

• Typed financial access/audit/request actor CHECKs enforce exact ordinary versus Operator FK lineage.

• No provider KYC document collection exists without an explicit confirmed requirement and restricted retention/access policy.

## 85. Restricted Financial schema

Sensitive retained provider evidence and any unavoidable encrypted Seller settlement credential belong in a restricted financial schema/storage boundary. The ordinary application role should not have broad direct SELECT/UPDATE access to sensitive tables.

Use narrowly scoped repository/functions and audited access paths.

## 86. Drizzle ORM and migrations

Drizzle provides typed schema/data access and reviewed migrations. Database constraints remain authoritative; ORM validation is not a substitute for unique, check, foreign-key and transactional invariants.

Production migrations follow expand/use/contract and upgrade-path testing.

## 87. PostgreSQL extensions

pg_stat_statements is required for query diagnostics. pg_trgm may support bounded operational search where justified. btree_gist is available for exclusion/range constraints when a real financial invariant requires it.

Do not add extensions merely because they are available.

## 88. Valkey usage

Valkey is the only current async/cache datastore name. It may support rate-limit counters, bounded non-sensitive caches, coordination and BullMQ backing.

It must never be canonical payment, refund, settlement, surcharge, provider-event or financial-evidence truth.

## 89. BullMQ jobs

BullMQ is the sole ordinary background-job engine; Valkey supports execution only. Typed Finance jobs include payment verification/reconciliation, refund status reconciliation, settlement import/reconciliation, private evidence purge and projection/notification consequences.

Canonical financial mutation plus event_outbox and/or direct job_intent commits in one PostgreSQL transaction. Shared Eventing relays later materialize BullMQ work; current-state re-read, database-backed idempotency, external effect identity, ambiguity handling and reconciliation apply to every worker. Finance has no alternative dispatcher/worker technology.

## 90. Transactional outbox

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

Durable Finance intent/outbox drives recoverable downstream work. Reviews additionally supports VERIFIED_ORDER_FAILURE from upheld Seller-fault evidence under its one-Order eligibility contract; payment alone creates no Grant.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

![Verified money precedes atomic Order and stock readiness](graphics/FIN_04.svg)
*Figure 04. Verified money precedes atomic Order and stock readiness. Every second success is preserved as its own charge; no second fulfilment and no unconditional refund/fulfilment promise.*

## 91. Cloudflare R2 boundary

R2 is for private retained financial evidence/reports and other media-domain objects, not canonical payment state. Financial evidence uses a private bucket/namespace with credentials separate from public media.

No financial evidence is served from the public media origin or CDN.

## 92. Sharp and media processing

Sharp belongs to the canonical media stack but is not part of payment authority. If a retained evidence image requires safe normalization for an Operator view, that processing occurs in the controlled Media/Financial

evidence path and never changes payment status.

## 93. Observability stack

Sentry captures sanitized application errors/releases; Pino provides redacted structured logs; pg_stat_statements and managed PostgreSQL metrics diagnose query regressions. Provider, Valkey/BullMQ, Render and Cloudflare operational metrics complete the view.

Sensitive provider payloads must not enter Sentry breadcrumbs or exception context.

## 94. Core financial metrics

• payment attempt creation success/latency by provider and Market.

• provider verification/reconciliation latency.

• processing/ambiguous-state age.

• amount/currency mismatch rate.

• paid-to-Seller-notification lag.

• refund initiation/completion/failure latency.

• settlement lag and unresolved exception count.

• surcharge collected/refunded/reconciled totals.

• financial evidence read/denial rates and audit write failures.

## 95. Zero-tolerance integrity alerts

• Provider reports success for an amount/currency different from expected snapshot.

• Two successful provider charges appear linked to one intended payment.

• Financial evidence read succeeds without an access-log entry.

• Paid Order lacks corresponding payment success fact.

• Refund exceeds refundable amount.

• Settlement/surcharge ledger cannot reconcile to provider facts beyond configured tolerance.

• Provider secret appears in logs or client payloads.

## 96. Provider outage

During provider outage, historical paid Orders and financial history remain readable. New payment attempts may be disabled for the affected provider/Market. The system does not fall back to manual bank-transfer confirmation.

Existing PROCESSING/RECONCILING attempts retain required allocation and durable financial evidence under ORDER §35/46. Reconciliation may resume if the provider returns; permanent unavailability has no promised eventual result or bounded safe-release time. A pending/not-found lookup is not automatically finality.

## 97. Webhook outage

If webhook delivery is delayed or misconfigured, server verification/reconciliation recovers where supported. The system must not depend on a single callback to protect a genuinely successful Buyer payment.

## 98. PostgreSQL outage

If PostgreSQL cannot safely record canonical financial state, fail payment-state mutations closed. Do not accept provider events into a volatile cache as money truth.

Recovery follows the Deployment database/PITR and reconciliation runbooks.

## 99. Valkey/BullMQ outage

Queue failure may delay reconciliation, notifications and projections, but PostgreSQL outbox/state remains authoritative. Critical work is retried after recovery. Cache loss must not change money.

## 100. R2 evidence outage

If private evidence storage is unavailable, core payment verification may continue when it does not require object evidence. Evidence/report capture should fail safely or queue a durable retry depending on the source and policy.

Never claim an evidence object was retained if upload failed.

## 101. Settlement delay

A delayed Seller settlement is not reclassified as Buyer payment failure. Surface the settlement state separately and route aging exceptions to Finance/Operator workflows.

Fulfilment/Claim rules consume the appropriate payment and settlement facts without conflating them.

## 102. Amount mismatch

If provider-confirmed charged amount/currency differs from the immutable expected snapshot, do not automatically mark normal success. Enter a controlled exception/reconciliation state and preserve the provider evidence.

Operators receive enough context to resolve without accessing provider secrets.

## 103. Provider credential compromise

Immediately revoke/rotate the affected credential, disable unsafe provider actions if needed, inspect provider and Adulis audit trails, reconcile affected attempts and document the incident.

Key rotation cannot rewrite historical provider facts.

## 104. Environment separation

Local, staging and production use different provider credentials, webhook endpoints, PostgreSQL databases, Valkey instances/namespaces, R2 namespaces and observability environments.

Staging providers use test/sandbox capabilities where available and must never charge real Buyers accidentally.

## 105. Backup and restore

Financial PostgreSQL state participates in managed PITR and tested logical backup/restore. Private financial evidence requires lifecycle/versioning/backups according to its retention classification.

A backup is not considered proven until an isolated restore passes financial invariants and provider-reference consistency checks.

## 106. Security of backup material

Backups containing financial metadata or retained private evidence are access-restricted and must not enter developer laptops or ordinary staging environments.

Secrets themselves are recovered from secure secret-management processes, not database backups.

## 107. Quality strategy

Use Jest for domain/unit tests, Testcontainers for real PostgreSQL/Valkey integration, Playwright for Seller/Operator web financial flows, Maestro for Mobile payment-return and sequential checkout flows, and k6 for load/capacity.

Provider adapters require contract fixtures and negative tests for duplicate/reordered/malformed events.

Maintain provider fixtures, negative tests and the following canonical regression cases without implying a provider capability that has not been confirmed.

### Current canonical regression cases

• 01. Same payment attempt idempotency -> one provider intent.

• 02. Forged browser success -> remains PROCESSING.

• 03. Duplicate provider success -> one PAID transition.

• 04. Wrong amount/currency -> controlled exception, no ordinary success.

• 05. 0 bps calculation exact.

• 06. Historical surcharge policy preserved.

• 07. Multi-Seller A paid / B failed -> independent.

• 08. Refund duplicate -> one provider refund identity.

• 09. Seller settlement masked/scoped.

• 10. Seller team financial permission server-derived from ordinary Account relationship.

• 11. Courier relationship alone grants no settlement access.

• 12. Ordinary Account cannot access Operator Finance APIs.

• 13. Authorized separate Operator Account can access only capability-scoped evidence.

• 14. Every sensitive Operator read creates Operator-account audit record.

• 15. Adulis Seller verification succeeds without Government ID according to Onboarding policy.

• 16. Provider-hosted KYC can require provider identity flow without creating Adulis Government-ID requirement.

• 17. KYC status may be retained without copying raw provider documents.

• 18. Valkey outage leaves payment/outbox truth correct.

• 19. Provider outage cannot create false failure/success.

• 20. Inactive future Market has no provider route even though architecture supports future activation.

## 108. Test - payment attempt creation

Create a Seller Order with immutable amount snapshot, request a payment attempt twice with the same idempotency key, and assert one canonical attempt/provider intent. A changed payload with the same key must fail.

## 109. Test - duplicate provider event

Replay the same valid success event multiple times. Expect one payment success, one paid Order transition, one Inventory commit and deduplicated downstream events.

## 110. Test - provider return is not authority

Return to Mobile/Web with a forged success query parameter while backend/provider state is unresolved. The UI must remain Processing and the Seller must not receive a paid-order notification.

## 111. Test - amount mismatch

Provider verification returns success with the wrong amount or currency. Expect controlled exception/reconciliation, no ordinary success transition, audit evidence and an Operator/Finance alert.

## 112. Test - zero launch surcharge

For representative currencies and edge rounding values, assert the backend computes 0 bps on the configured eligible basis, stores the exact snapshot and sends the identical total to the provider adapter.

Client-provided totals are ignored/rejected.

## 113. Test - aggregator collection

Using provider adapter fixtures, assert seller value and Adulis surcharge are mapped according to enabled provider capabilities and normalized settlement facts are recorded. No Seller-side manual collection is created.

## 114. Test - sequential multi-Seller payment

Checkout contains Seller A and Seller B. Pay A successfully and leave B incomplete. A becomes paid and Seller A is notified; B remains separately payable. No cross-Seller financial authority or combined refund scope is created.

## 115. Test - refund idempotency

Request the same approved refund twice and replay provider completion. Expect one provider refund identity, one normalized successful refund and one set of ledger adjustments.

## 116. Test - settlement access

An authorized Seller member sees masked settlement/payout history for their Seller. Another Seller receives safe denial/not-found. Internal access requires a separate Operator Account, current Finance capability/case scope and typed Operator-account audit.

## 117. Test - provider secret redaction

Scan application logs, Sentry events, API payloads, analytics and client bundles for synthetic provider credentials/signatures. The test fails if secret material appears.

## 118. Test - Valkey loss

Disable Valkey during a committed provider-success transaction. PostgreSQL payment state and outbox remain correct. Notifications/reconciliation recover after queue restoration without duplicate money state.

## 119. Test - financial evidence retention

Create retained provider evidence linked to an open Claim and assert purge is blocked. Resolve the hold, run purge, verify object deletion and deleted_at audit metadata without deleting unrelated provider/settlement credentials.

## 120. Performance targets

Payment correctness has priority over raw throughput. Define load targets from expected peak Checkout traffic and provider limits. Measure p95/p99 attempt creation, webhook processing, reconciliation, refund and Seller paid-order notification latency.

No financial endpoint should rely on unbounded provider calls or unbounded database scans.

## 121. Repository/module placement

The Payments/Finance domain stays inside adulis-platform as a strongly isolated module of the NestJS/Fastify modular monolith. The Company Website in adulis-web has no payment database access and does not own Checkout.

A separate payment microservice is not required for MVP.

## 122. Recommended module structure

```
apps/api / apps/worker
  payments/
    attempts/
    providers/
      chapa/
      contracts/
    verification/
    reconciliation/
    refunds/
    settlements/
    seller-provider-accounts/
    surcharge-ledger/
    financial-evidence/
    audit/
  packages/api-contracts
  packages/money
  packages/permission-catalogue
```

## 123. dependency-cruiser boundaries

dependency-cruiser should prevent provider-specific adapters from leaking into Order, Mobile or Seller Console feature code and prevent frontends from importing private financial repositories.

Order/Claims/Billing integrate through public module contracts/events.

## 124. Current technology stack and impact

| Layer | Canonical technology | Payments/Finance impact |
| --- | --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript; Drizzle ORM; PostgreSQL | Provider adapters, payment/refund/settlement commands, canonical transaction state. |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements | Bounded search/constraints where justified; production query visibility. |
| Async / cache | Valkey; BullMQ | Reconciliation, outbox dispatch, refunds/settlement jobs, rate limits; never money truth. |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client | Typed Mobile/Console/Operator contracts; no raw provider DTO coupling. |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js | Abuse controls, headers, international phone normalization where payment/onboarding needs it. |
| Media | Cloudflare R2; Cloudflare CDN; Sharp | Private retained evidence in R2; public CDN/Sharp not in payment-authority path. |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; Expo SecureStore; Expo SQLite; Expo Camera; Expo Notifications; Expo Updates; small Zustand store | Sequential checkout/payment UI, secure session state, provider return/deep links, notifications; no local payment truth. |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 | Domain, provider contract, DB integration, Mobile/web E2E and load tests. |
| Observability | Sentry; Pino structured logs; pg_stat_statements | Sanitized errors/releases, redacted logs, DB diagnostics. |
| Architecture control | dependency-cruiser | Enforces provider/domain/frontend boundaries. |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS | Backend/worker/web deployment plus Mobile native/OTA release. |
| Payment integration | Chapa through PaymentProviderAdapter; future Market adapters | Provider isolation, verification, refunds and settlement normalization. |

## 125. Deployment model

API and worker are separate processes using the same reviewed backend image. PostgreSQL and Valkey live in the primary managed region; Cloudflare protects public ingress and R2 storage; Mobile ships through EAS/App Stores.

Provider webhooks terminate through the protected API origin and must remain compatible during zero-downtime deployments.

## 126. Feature flags and kill switches

Provider enablement, Market enablement, refund capability, settlement import and new reconciliation behavior may be controlled with narrow versioned flags. Do not use one global switch when only one provider/Market is affected.

A kill switch must never rewrite historical payment state.

## 127. Production launch gates

• Provider secrets isolated and redaction tests pass.

• Payment attempt and provider-event idempotency proven.

• Forged client success cannot mark an Order paid.

• Expected amount/currency verification enforced.

• zero launch Adulis Buyer surcharge is server-calculated, explicit and snapshot-versioned.

• Aggregator collection/settlement adapter behavior is tested for enabled provider capability.

• Paid Order appears exactly once and Seller receives no manual payment-confirmation control.

• Refund/partial-refund behavior is provider-reconciled and idempotent.

• Seller settlement data is scoped/masked and sensitive changes use Step-Up when applicable.

• Financial evidence is private, access-audited and retention-controlled.

• Valkey/BullMQ loss cannot change financial truth.

• PostgreSQL restore drill and financial invariant suite pass.

• Jest/Testcontainers/Maestro/Playwright/k6 critical gates are green.

• Adulis Seller verification is Government-ID-free; provider-hosted KYC can remain a separate provider requirement with status-only Adulis retention.

• One ordinary Account relationship scoping, Courier settlement denial and separate Operator Finance APIs/audit pass.

• Ethiopia provider route is explicitly enabled and inactive future Markets fail closed.

• Shared outbox/job-intent relay and typed financial principal constraints pass current tests.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 128. Hard financial invariants

• FIN-INV-01 Provider/backend facts alone establish payment success.

• FIN-INV-02 One Seller Order has independent finance scope.

• FIN-INV-03 Current surcharge = launch-disabled zero Buyer-side Checkout surcharge.

• FIN-INV-04 Client cannot calculate/override payable total.

• FIN-INV-05 Provider owns supported collection/settlement mechanics.

• FIN-INV-06 Buyer payment and Seller settlement are different facts.

• FIN-INV-07 No Seller manual payment confirmation.

• FIN-INV-08 Provider secrets stay out of PostgreSQL/client/logs.

• FIN-INV-09 Sensitive financial evidence access is audited.

• FIN-INV-10 Valkey/BullMQ are non-canonical.

• FIN-INV-11 Provider/Finance confirms refund completion.

• FIN-INV-12 Financial state mutation requires backend connectivity.

• FIN-INV-13 Historical financial facts are append-only.

• FIN-INV-14 Company Website does not own payment state.

• FIN-INV-15 Architecture is multi-Market, but only explicitly activated Markets transact.

• FIN-INV-16 Current first Market is Ethiopia.

• FIN-INV-17 Adulis Seller verification does not require Government ID.

• FIN-INV-18 Provider-required KYC is provider/Market compliance, not Adulis Trust/Onboarding identity proof.

• FIN-INV-19 Operator finance authority comes from separate Operator Account.

• FIN-INV-20 Sensitive financial actor provenance distinguishes ordinary Account and Operator Account.

• FIN-INV-21 All money uses exact arithmetic, one deterministic rounding rule and immutable policy snapshots.

• FIN-INV-22 Provider ambiguity preserves PROCESSING/RECONCILING and never creates a blind duplicate charge/refund.

• FIN-INV-23 Private financial evidence has purpose-driven retention, valid holds and confirmed physical deletion.

• FIN-INV-24 Canonical mutation and durable outbox/job intent share a transaction; platform relays alone materialize async consequences.

• FIN-INV-25 Highly sensitive reads cannot succeed without their required durable access audit.

FIN-INV-26 Local expiry, Buyer cancellation, missing callback and provider outage are not release evidence. Fenced durable uninitiated proof or confirmed adapter finality, current generation and locked charge/allocation re-read are required by ORDER §35/46.

## 129. Superseded assumptions

The current architecture removes the previous direct bank-transfer instruction system, Buyer payment-screenshot submission, Seller payment acceptance/rejection, manual receiving-account snapshot/reissue workflow, old pre-payment timeout model, offline financial state acceptance and Seller-side transaction commission assumptions.

Where older documents contain those concepts, this financial design and the current Order Management & Checkout design take precedence.

## 130. Recommended implementation sequence

| Phase | Build | Exit criterion |
| --- | --- | --- |
| 0 - Provider boundary | PaymentProviderAdapter, environment secrets, normalized contracts, provider fixtures | No provider-specific DTO escapes the Payment module. |
| 1 - Payment attempts | payment attempt, amount snapshot linkage, idempotency, Chapa adapter initiation | One Seller Order can create one safe provider attempt. |
| 2 - Verification | webhook authenticity, provider-event dedupe, server verification, reconciliation | Forged/duplicate client/provider traffic cannot create false paid state. |
| 3 - Paid Order integration | outbox, Inventory commit, Seller notification, sequential multi-cart progress | Paid Seller Orders become actionable exactly once. |
| 4 - Surcharge/ledger | zero-bps calculation, Buyer display snapshot, surcharge ledger, aggregator collection mapping | Buyer total and Adulis surcharge reconcile to provider facts. |
| 5 - Refunds | refund entity, provider calls, reconciliation, policy-driven surcharge reversal | Refund status is provider-authoritative and idempotent. |
| 6 - Seller settlement | Provider-hosted onboarding/KYC status, settlement refs/reconciliation and masked Seller history | Seller settlement is visible without creating an Adulis wallet. |
| 7 - Financial evidence | Private R2, typed ordinary/Operator audit, separate Operator capabilities, Claim holds/exports | Sensitive evidence is private, auditable and purgeable. |
| 8 - Hardening | load/security tests, alerts, backup/restore, runbooks | Production launch gates pass. |

## 131. Final architecture

Checkout confirms one Seller-specific immutable amount/policy snapshot. Payments creates a provider-independent idempotent attempt on an approved active Market route. Authenticated webhook/server verification supplies money truth; Order/Fulfilment, ledger and notices react to committed facts.

![Verified money precedes atomic Order and stock readiness](graphics/FIN_05.svg)
*Figure 05. Verified money precedes atomic Order and stock readiness. Every second success is preserved as its own charge; no second fulfilment and no unconditional refund/fulfilment promise.*

Provider settlement and refunds remain separate states, with append-only corrections and minimum private financial evidence. Ordinary resource relationships and separate privileged Operator capabilities/audits control every sensitive access. Physical Handoff is separate from payment and settlement; location checkpoints never prove money truth.

## 132. Final engineering doctrine

The Payments and Finance system should make it difficult for any UI, stale callback, duplicated event, worker failure or provider outage to create a false financial fact.

The safest design is intentionally explicit: the Buyer sees a server-calculated charge; the provider establishes payment; the Seller acts only after paid status; the aggregator handles supported surcharge collection and Seller settlement mechanics; refunds return through the provider; and Adulis keeps the minimum durable evidence needed to explain every financial outcome.

Financial truth remains in PostgreSQL-backed domain state. Provider integrations can change. Clients can reload. Workers can retry. Valkey can be lost. Historical payment, surcharge, refund and settlement evidence cannot be casually rewritten.

Global-ready adapters transact only in explicitly activated Markets. Adulis Seller admission remains Government-ID-free while provider-hosted KYC is independently governed. Privileged Finance operations require separate Operator identity and typed audit. Current zero launch Adulis Buyer surcharge remains explicit, exact and policy-versioned.

## 133. Appendix - Provider Capability & Evidence Matrix

| Capability / owner | Evidence / activation status |
| --- | --- |
| Merchant / Seller subaccount model / Finance + Legal | Signed agreement + legal entity, Seller responsibility and permitted actual accounts Status OPEN / NOT PROVIDED. All live collection disabled until evidenced. |
| KYC / onboarding responsibility / Finance + Privacy | Approved provider-hosted or other supported flow, required data/scopes/processor role Status OPEN / NOT PROVIDED. No Adulis admission ID; unsupported onboarding disabled. |
| Collection / API contract / Finance + Engineering | One agreed API/version/environment, request/ref/events/auth and server verification Status OPEN / NOT PROVIDED. Sandbox specifications only; no v1/v2 mixture. |
| Buyer fee incidence / exact calculation / Finance + Legal + Provider | Written resolution of Article 6 conflict, tariff/basis/rounding and collection once Status OPEN / NOT PROVIDED. Buyer preference preserved; incompatible live route disabled. |
| Provider-managed Seller settlement / Finance + Provider | Actual subaccount/split/routing permission and settlement reconciliation Status OPEN / NOT PROVIDED. Conditional target; no wallet/escrow authority. |
| Partial / post-settlement refund / Finance + Provider | Granted endpoint/privilege, acceptance vs completion and component treatment Status OPEN / NOT PROVIDED. Affected live payment/refund route gated. |
| Insufficient balance / Seller funding / Finance + Legal | Confirmed allowed funding/recovery flow compatible with Seller responsibility Status OPEN / NOT PROVIDED. No voluntary Adulis cash backstop; no guarantee. |
| Split reversal / offsets / Finance + Provider | Explicit supported reversal evidence and each entitlement accounting Status OPEN / NOT PROVIDED. No cross-Seller entitlement reallocation. |
| Chargebacks / reserves / merchant liabilities / Legal + Finance | Contract responsibility, exposure/reserve amounts and dispute process Status OPEN / NOT PROVIDED. Liabilities retained; amounts unknown. |
| Attempt finality / cancel / late success / Finance + Provider | Evidence of initiation/dispatch, in-flight race, authoritative finality/release rules, not-found semantics and escalation Status OPEN / NOT PROVIDED. Unknown finality protected; no timer-only release. |
| Courier compensation / Fulfilment + Finance | Existing Seller-to-Courier fallback terms/proof; direct payout only if granted Status OPEN / NOT PROVIDED. Fallback retained; unsupported payout disabled. |

The published Chapa Ethiopian Merchant Service Agreement Article 6 conflicts with passing merchant service fees to customers. Resolve the actual signed route; public API documentation is not permission. Reference: https://chapa.co/merchant-agreement (checked 12 October 2026). No tariff or approval is invented. Pin one actual supported adapter contract only after evidence; live scope stays disabled meanwhile. Provider refund acceptance and verified completion remain separate.

## 134. Glossary

Definitions used in this current complete edition.

| Term | Current meaning |
| --- | --- |
| Ordinary Account | One human identity across Buyer/Seller/Courier relationships; roles/context remain resource scoped. |
| Operator Account | Separate privileged internal principal, credentials, OPERATOR session and typed audit. |
| Scene Post | Canonical captioned image content with exact same-Seller Product/revision relationships. |
| PUBLIC / PRIVATE | Content visibility independent of publication and Moderation; stock-private can restore after all gates pass. |
| Product Post | Structured commerce destination for exactly one Product; current Catalogue/Inventory truth. |
| Market activation | Approved runtime commerce scope; Ethiopia first, globally extensible future routes. |
| PSP | Payment service provider; authenticated backend/provider facts establish money state. |
| Launch surcharge / 0 bps | Current explicit Buyer Checkout surcharge; exact server policy snapshot. |
| Outbox / job_intent | PostgreSQL records atomically preserve facts or direct/deadline async intent. |
| BullMQ / Valkey | Sole ordinary job engine and its execution/cache datastore; non-canonical. |
| Payment != settlement | Buyer PAID and provider Seller settlement are independent facts. |
| PaymentProviderAdapter | Provider-independent normalized initiation/verification/refund/settlement contract. |
| PROCESSING / RECONCILING | Unresolved provider outcome; never a blind new charge. |
| KYC / KYB | Provider compliance/onboarding requirement, separate from Adulis Seller admission. |
| Financial access log | Sensitive read coupled to typed ordinary/Operator principal and durable scope/purpose audit. |
| Append-only adjustment | Correction/reversal preserves the original financial fact and policy snapshot. |

## 135. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-14 — Courier compensation source and immutable Order snapshot | The 13 October Fulfilment/Order/Finance designs already treat delivery charge as Seller-defined, shown before payment and snapshotted on the Order. | There is no per-Courier-relationship compensation schedule in the current MVP. One Seller-level Courier Delivery term applies to future Checkout quotes. Once the Buyer accepts/pays, the Order’s Courier Delivery/compensation amount is immutable history. Delivery Offers, Seller selection surfaces and Courier Mode display the Order snapshot. Changing Seller terms affects future quotes only. | PR-008 correction, 27 Oct 2026 |
| R-16 — Company Website public-copy refinements | The 13 October Website/Finance designs already hold the corrected launch financial model. | Public Website copy must not promise a 0.5% Adulis transaction fee. It uses Buyer-facing Product/Scene language and shared authoritative report/deletion policy. Removing decorative warning/report icons must not remove role=status/role=alert semantics. Seller public location copy must not imply a mandatory physical storefront when only operating area/collection point is available. | PR-001 + Oct 15 corrections |
| R-22 — Canonical launch Adulis surcharge remains zero | The October 13 Finance/Order/Market/KB designs set launch Adulis surcharge to 0 bps / amount zero. | Launch Adulis surcharge is disabled: 0 bps and zero amount. Provider processing fee is a separate provider-policy route and may be Buyer-paid only when that route is explicitly permitted and confirmed. The prototype canonical-rules line claiming a current 0.5% Adulis Buyer surcharge is stale and must not be implemented. | October 13 pack reaffirmed against stale prototype rule |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
