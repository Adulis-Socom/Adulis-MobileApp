# Adulis Claims, Disputes & Evidence
Version 3.2 | 13 October 2026 | DOCUMENT-CORRECTED

## Document control

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026. |
| Source | ADU-CLAIM-01_Adulis_Claims_Disputes_Evidence_System_Design_v3.1.pdf |
| Authority | 13 October contract prompt; selected 12 October owner decisions remain binding. |
| Status | DOCUMENT-CORRECTED; implementation, integration tests and external approvals not established. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |

## 1. Mission

Claims owns Order-scoped allegations, evidence manifests, human adjudication, decision history and governed remedy requests. Every Claim belongs to one Seller Order and may optionally reference one line of that same Order. Product Post and Scene Post are contextual representation evidence, never standalone Claim scope.

An allegation is not a finding. Contested decisions require an authorized separate Operator Account; timers, detectors, Trust, Analytics and party statements do not decide cases. Finance owns verified money and provider remedies; Handoff owns physical receipt evidence.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

## 2. Version Scope and Supersession

This complete v3.0 baseline reconciles the attached v2.0 architecture and matching update specification. The established Order/line scope, append-only evidence/history, human decisions and provider-authoritative financial model are retained. Typed ordinary/Operator identity, historical Scene evidence, receipt-or-verified-failure Review boundary, provider KYC separation and explicit Market activation supersede conflicting wording.

## 3. Core Doctrine

- A claim opening is an allegation or system-detected incident, not a verdict.

- Claims never creates payment truth, Handoff truth, Inventory truth, Trust Level or moderation enforcement.

- Canonical domain facts are attached by immutable reference or bounded snapshot; Claims does not copy mutable business truth casually.

- Payment, refund and settlement facts come from Payments/Finance provider verification and reconciliation.

- Physical transfer facts come from accepted Handoff evidence; checkpoint location is supporting evidence only.

- Remedy and outcome are separate. A Seller may remedy a genuine failure without erasing the failure history.

- NOT_UPHELD does not mean bad faith. Bad faith requires separate affirmative evidence and a Moderation decision where appropriate.

- All state-changing Claim operations require authoritative backend connectivity.

Publication/visibility changes cannot rewrite historical representation. Accepted final receipt does not prove description, condition, completeness or quality of every line. Claim findings, remedies, Review Grants and Trust consequences have distinct owners.

## 4. What Claims Owns

- Claim creation and scope legality

- Claim state machine and review SLA

- Claim event ledger and decision history

- Evidence manifest and Claim-specific evidence attachments

- Evidence requests to Buyer/Seller

- Reviewer queue/read models

- Claim outcome and structured reason codes

- Remedy request orchestration through owning domains

- Evidence export for the entitled requester

- Retention holds that protect Claim evidence

- Claim-domain metrics and audit

## 5. What Claims Does Not Own

- Payment success, provider reconciliation, Seller settlement or refund completion

- Order lifecycle or Order-line commercial snapshots

- Inventory quantity or stock-event truth

- Courier assignment, delivery compensation or checkpoint capture

- QR/OTP/Manual Handoff credential verification

- Seller admission or social-account verification

- Trust calculation

- Moderation enforcement

- Review text or rating computation

- Authentication, Seller RBAC or Operator grants

- Notification transport

Claims cannot create or revoke Review Grants, set Trust levels, establish provider refund completion, republish private Content, convert an ordinary Account to Operator or collect Seller verification Government ID.

## 6. Current Commerce Context

Backend-verified provider facts alone establish payment, refund and settlement truth. Chapa is the first named Ethiopia provider only where the current Market route is enabled. Browser returns, screenshots, Seller confirmation and Chat statements cannot establish PAID. The current transaction charge is the server-calculated zero launch Adulis Buyer surcharge (0 bps), with exact currency rounding and an immutable Commercial Policy snapshot displayed before explicit confirmation. Paid Order, provider settlement and physical receipt are independent.

Content owns Scene Post revisions, publication state DRAFT/PUBLISHED/ARCHIVED and visibility PUBLIC/PRIVATE separately. Public publication requires media/caption, same-Seller eligible tags and at least one available tagged Product, plus current Seller, Market and Moderation gates. Last available Product loss changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Stock recovery may automatically restore PUBLIC only after all current gates pass; it does not archive or require manual republishing solely for restock. Independent archive/removal or safety blocks remain effective.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

A completed/delivered Order can still have a NOT_AS_DESCRIBED Claim. Provider settlement is separate from Buyer payment and physical receipt; remedy component treatment follows the captured Commercial Policy, not Claims arithmetic.

## 7. Claim Openers

| Opener actor type | Authority / preserved rights |
| --- | --- |
| ORDINARY_ACCOUNT | Buyer owns exact Order, or current Seller relationship/permission authorizes the Seller workflow; actual ordinary Account is recorded. |
| OPERATOR_ACCOUNT | Separate privileged identity with current scoped opening capability, case purpose and audit. |
| SYSTEM | Owner-approved detector or orchestration opens a case with source_domain; no human identity impersonation. |

Moderation-origin opening is SYSTEM with source_domain=MODERATION, not an ambiguous fourth person type. Every opener remains separate from a later human decider. Party rights are preserved when a system opens the incident.

## 8. System Claims Preserve User Rights

Where Adulis can already observe a qualifying paid-Order failure, a SYSTEM Claim may open without requiring the Buyer to discover the failure and press a button. This is particularly important for unresolved fulfilment deadlines, safety actions affecting active paid Orders, or refund failures that exceed a configured policy window.

## 9. Criminal and Legal Boundary

Claims determines platform transaction findings and remedies only. It does not adjudicate criminal guilt, make public accusations or substitute for external legal authorities. Evidence exports support the requesting party and lawful process without turning Adulis into a criminal adjudicator.

## 10. Core Claim Entity

```
claims.claim
  id, market_id, order_id FK orders.seller_order
  order_line_id nullable; composite FK (order_id, order_line_id)
  opened_by_actor_type ORDINARY_ACCOUNT|OPERATOR_ACCOUNT|SYSTEM
  opened_by_ordinary_account_id FK accounts.account nullable
  opened_by_operator_account_id FK operators.operator_account nullable
  opened_by_system_source nullable
  trigger, trigger_version, state, severity, remedy nullable
  review_deadline, first_reviewed_at nullable
  current_decision_id nullable, policy_version, version
  created_at, updated_at
```

CHECK actor shape: ordinary opener has only ordinary FK; privileged opener has only Operator FK; SYSTEM has neither human FK and an approved source. Seller business scope comes from the captured Order, not a supplied actor type. current_decision_id must refer to a decision on this same Claim.

## 11. Order and Order-Line Scope

Every Claim belongs to exactly one Seller Order. A Claim may additionally reference exactly one Order Line from that same Order. Order-level disputes include whole-Order delivery or payment exceptions. Line-level disputes include one Product/Variant being missing, materially different, cancelled or refunded.

![Exactly one Seller Order with contextual historical evidence](graphics/CLAIM_01.svg)
*Figure 01. Exactly one Seller Order with contextual historical evidence. Optional line is from that Order; Product/Scene/Chat context and accepted receipt do not create standalone Claim scope.*

## 12. Structural Scope Integrity

- Use a composite database constraint or trusted function so order_line_id can only reference a line belonging to claim.order_id.

- Do not accept arbitrary UUID references from a client.

- All evidence attachments repeat the same Order/scope validation.

- A Scene Post or Product Post can be evidence context, but neither becomes Claim scope; the commercial scope is Order / Order Line.

Enforce the Order/line pairing by composite FK or trusted atomic attachment contract. Market and Seller scope derive from the Order. Content IDs do not replace that scope; every evidence reference validates the same incident context.

## 13. Canonical Trigger Families

| Trigger | Default scope | Meaning |
| --- | --- | --- |
| PAYMENT_STATUS_EXCEPTION | Order | Provider/Order financial facts conflict or remain unresolved long enough to harm the Buyer. |
| FULFILMENT_SLA_BREACH | Order or line | Paid commerce was not prepared/fulfilled within the applicable policy window. |
| STOCK_OR_FULFILMENT_FAILURE | Line | Seller cannot supply the captured Product/Variant after payment or committed fulfilment. |
| GOODS_NOT_RECEIVED | Order or line | Buyer did not receive the whole Order or a specific line. |
| NOT_AS_DESCRIBED | Line or Order | Delivered goods materially differ from the captured Product Post/Variant representation. |
| REFUND_NOT_COMPLETED | Order or line | An approved provider refund did not reach a confirmed completion state within policy. |
| DELIVERY_FAILURE | Order | Courier/Seller delivery failed, was returned, or custody/recipient facts require adjudication. |

## 14. Trigger Versioning

Trigger meaning is a versioned domain contract. Do not silently reuse an old trigger name for a new financial workflow. Historical Claims retain their original trigger and reason semantics; migrations map only when meaning is demonstrably equivalent.

## 15. Claim State Model

![Human review and owner-confirmed remedy facts control state](graphics/CLAIM_02.svg)
*Figure 02. Human review and owner-confirmed remedy facts control state. Waiting for evidence or provider facts never adjudicates the case. Corrections append history and preserve the original decision.*

Canonical states remain AWAITING_BUYER_EVIDENCE, AWAITING_SELLER_EVIDENCE, AWAITING_PROVIDER_RECONCILIATION, UNDER_REVIEW, REMEDY_PENDING and RESOLVED. Each transition follows the legal state table, recorded owner facts and current human authority. A deadline only requests attention; it is never a verdict.

## 16. State Meanings

| State | Meaning |
| --- | --- |
| AWAITING_BUYER_EVIDENCE | A specific missing Buyer fact/evidence prevents fair review. |
| AWAITING_SELLER_EVIDENCE | A specific missing Seller fact/evidence prevents fair review. |
| AWAITING_PROVIDER_RECONCILIATION | Finance must establish provider payment/refund truth before Claims can decide the transaction consequence. |
| UNDER_REVIEW | Required evidence is sufficiently assembled for human adjudication. |
| REMEDY_PENDING | Outcome/remedy is known but the owning domain has not yet completed the required operational/financial action. |
| RESOLVED | Current decision and required resolution state are complete or no further remedy is required. |

## 17. Legal State Transitions

```
AWAITING_* -> UNDER_REVIEW
UNDER_REVIEW -> AWAITING_* # reviewer requests missing fact
UNDER_REVIEW -> REMEDY_PENDING # upheld + remedy required
UNDER_REVIEW -> RESOLVED # no remedy / not upheld / already resolved
REMEDY_PENDING -> RESOLVED # owning domain confirms required outcome
```

No client writes state directly. Domain commands validate expected version, current state, actor authority, evidence prerequisites and allowed transition.

## 18. No Automatic Adjudication

Timers, risk scores, detector output, payment latency or a missing response may open/escalate a Claim and affect queue priority, but they do not automatically create UPHELD or NOT_UPHELD. Final contested outcomes require an authorized reviewer.

## 19. Initial Review SLA

The existing two-day initial human-review target remains the default operational policy unless a Market-specific policy explicitly replaces it. Missing the SLA triggers alerts/escalation; it never decides the Claim automatically.

## 20. One Open Claim per Identical Scope

At most one unresolved Claim exists for an identical Order, optional line, trigger and canonical incident identity under current policy. The database backstop must treat NULL line scope as identical: use an appropriate NULLS NOT DISTINCT partial uniqueness boundary or trusted normalized scope key, not a nullable UNIQUE that permits duplicate whole-Order cases.

Concurrent opening locks or insert-conflict recovery returns the existing authorized case. A different line/trigger/incident may remain separate and correlate without merging party rights or evidence.

## 21. Cross-Scope Correlation

One incident can legitimately affect multiple lines or spawn related operational facts. Correlate them using incident_group_id or equivalent read-model grouping without merging unrelated Claims into one decision. Correlation is for investigation/navigation; each Claim keeps explicit scope.

## 22. Evidence Doctrine

- Evidence is question-specific. No universal ranking says one evidence type always defeats another.

- Canonical system facts are preferred for the fact they actually establish.

- Party statements and attachments may explain context but do not rewrite system facts.

- Critical evidence is immutable after attachment; corrections append new evidence or exclusion metadata.

- Open Claim holds protect relevant evidence from ordinary purge until the hold is legally released.

## 23. Claim Evidence Manifest

```
claims.claim_evidence
  id, claim_id, kind, source_domain, source_ref, source_revision_id nullable
  captured_at, attached_at, integrity_digest nullable
  attached_by_actor_type ORDINARY_ACCOUNT|OPERATOR_ACCOUNT|SYSTEM
  attached_by_ordinary_account_id nullable FK accounts.account
  attached_by_operator_account_id nullable FK operators.operator_account
  access_class, hold_reference nullable
  excluded_at nullable, exclusion_reason nullable
  correction_reference nullable, policy_version
```

The manifest fixes exact historical source/revision and integrity. Typed actor CHECKs prevent identity ambiguity. Exclusion/correction appends history; retained bytes and selected message/evidence references remain private, scope-bound and held only for legitimate purpose.

## 24. Canonical Evidence Kinds

| Evidence family | Examples / current source |
| --- | --- |
| ORDER | Order state history, amount snapshot, fulfilment selection, policy version, actor transitions |
| ORDER_LINE | Product/Variant snapshot, quantity, captured price, line cancellation/refund status |
| CONTENT | Product Post snapshot; relevant Scene Post revision/caption/media context when it influenced representation |
| INVENTORY | StockEvent history, stock confirmation, checkout allocation conversion/release facts where relevant |
| PAYMENT | PaymentAttempt, provider-verified result, normalized provider event reference, amount/currency |
| COMMERCIAL CHARGES | Product subtotal, delivery charge, zero launch Adulis Checkout surcharge and Buyer total snapshots |
| REFUND | RefundRequest, expected basis, provider refund reference, normalized provider result |
| FULFILMENT | Seller readiness, Courier assignment, failed-delivery/return facts, compensation/delivery-charge snapshot where relevant |
| HANDOFF | Accepted Pickup/Delivery Handoff evidence, QR/OTP/Manual method, actor/purpose binding |
| DELEGATION | Final-delivery delegated-recipient authorization reference and recipient type, privacy-minimized |
| LOCATION | Pickup/final-delivery checkpoint evidence; supporting only |
| CHAT | Message-level Order/Product anchors and selected relevant messages |
| PARTY EVIDENCE | Buyer/Seller statement or private image/file attachment |
| MODERATION | Safety action reference affecting the specific Order, without private unrelated case narrative |

## 25. Product Post and Scene Post evidence

Representation evidence captures the relevant Product Post/Variant snapshot and exact Scene Post revision, caption, tag associations and media context that influenced the purchase or message. Scene Post is contextual evidence, not Claim scope.

Later Content PUBLISHED + PRIVATE due to stock loss, public restoration, removal or revision changes never rewrite that captured representation. Case-authorized access to retained PRIVATE evidence does not republish the current Scene or make an old revision publicly accessible. Media/source holds preserve the bounded historical bytes and manifest.

## 26. Product Media Preservation

When an active Claim needs historical product imagery, Media retains the exact referenced derivative/original according to the Claim hold and Privacy policy. Public removal does not destroy private evidence. Claims stores media references/digests, not a second uncontrolled copy of the public asset.

## 27. Payment Evidence

Finance supplies normalized PaymentAttempt, authenticated provider event/reference, verified amount/currency, paid state and safe audit/evidence references under legitimate Claim purpose. Screenshots or Seller statements may be party evidence, never paid authority.

Backend-verified provider facts alone establish payment, refund and settlement truth. Chapa is the first named Ethiopia provider only where the current Market route is enabled. Browser returns, screenshots, Seller confirmation and Chat statements cannot establish PAID. The current transaction charge is the server-calculated zero launch Adulis Buyer surcharge (0 bps), with exact currency rounding and an immutable Commercial Policy snapshot displayed before explicit confirmation. Paid Order, provider settlement and physical receipt are independent.

Provider KYC is not normal payment or Seller-verification Claim evidence. Default reviewers receive safe provider status only; sensitive Finance reads require a specific legitimate case and separate current policy/capability, with purpose and audit.

## 28. Refund Evidence

Refund evidence is the Finance-owned RefundRequest, basis/policy snapshot, provider reference, processing/reconciliation outcome and confirmed completion fact. Claims may remain AWAITING_PROVIDER_RECONCILIATION or REMEDY_PENDING while ambiguous. No party confirmation, timer or local case status establishes provider refund completion.

## 29. Handoff Evidence

Handoff provides immutable accepted PICKUP or final DELIVERY evidence with method QR/OTP/MANUAL, typed presenter/recipient class, assignment, active delegated-authorization reference where applicable, accepted timestamp and bounded GPS context. No raw QR/OTP/signing material is exposed.

Final accepted Buyer/delegate receipt proves the recorded physical custody transfer; it does not prove every Product’s condition, description or line completeness. A later NOT_AS_DESCRIBED Claim may be valid without rewriting Handoff history.

## 30. Delegated Recipient Evidence

An authorized delegate can accept final physical delivery while the ordinary Buyer keeps Order, Claim, refund, payment and Review Grant ownership. The delegate has no independent Buyer Claim or Review authorship. Claims receives only the needed authorization reference, recipient class and bounded acceptance facts, not full delegated contact data by default.

## 31. Checkpoint Location Evidence

Pickup and final-delivery location snapshots may support a delivery investigation but can never independently prove custody, receipt or fraud. Absence of location evidence does not invalidate an otherwise accepted Handoff. Location access and retention are purpose-bound and audited.

## 32. Chat Evidence

Capture only selected relevant immutable Chat Messages and their subject/provenance. Message subject is NONE, PRODUCT_POST, SCENE_POST or ORDER. Product-from-Scene uses Product primary plus exact Scene revision provenance. Validate Buyer/Seller/Market and exact Claim context; a Conversation or later selector cannot rewrite historical Message subject.

No default whole-Conversation dump. Raw private Chat belongs to bounded evidence access, never general Analytics, public exports or unrelated case search.

## 33. Party Evidence

Buyer or Seller may submit a bounded statement, photograph or permitted file when the system record cannot establish the disputed fact. Party evidence is marked with provenance and never misrepresented as system-observed truth.

## 34. Evidence Attachment Timing

At Claim opening, atomically attach or place holds on every relevant existing system evidence item that is cheap and safe to identify. Evidence generated later is appended. Early attachment prevents later Product edits, content removal, media cleanup or financial retention from destroying the historical context.

## 35. Trusted Attachment Function

```
attachClaimEvidence(claimId, kind, sourceRef, actor)
-> load claim scope
-> verify source exists
-> verify source belongs to same Order / line / Market
-> verify caller/system authority
-> apply retention hold when required
-> append claim_evidence
-> append claim_event
```

## 36. Evidence Immutability and Corrections

Ordinary application roles cannot UPDATE or DELETE attached critical evidence. If an item was attached in error, record exclusion metadata and append a correction event. Decision exports and timelines should distinguish original evidence from later correction without erasing audit history.

## 37. Payment Status Exception

```
Buyer reports charged / Order not progressing
-> Claims reads PaymentAttempt + Order amount snapshot
-> Finance reconciles provider
-> AWAITING_PROVIDER_RECONCILIATION while truth is unresolved
-> provider result established
-> paid fact -> evaluate fulfilment harm
-> failed/cancelled fact -> resolve / retry per payment policy
-> still ambiguous -> Operator review with Finance evidence
```

Claims never asks the Seller to decide whether payment happened and never substitutes party-provided payment proof for provider authority. If the provider has already established SUCCEEDED, the transaction dispute normally becomes a fulfilment/delivery issue rather than a payment-confirmation dispute.

## 38. Fulfilment SLA Breach

A provider-verified paid Order that is not prepared or fulfilled within the configured window may produce a SYSTEM Claim or allow the Buyer to open one. Attach paid timestamp, Seller readiness/transition history, fulfilment mode, Courier assignment attempts where applicable and any Seller explanation.

## 39. Stock or Fulfilment Failure

When a specific paid line cannot be supplied, use line scope. Attach the captured Product/Variant/price snapshot, Inventory events, checkout allocation conversion, Seller cancellation reason, paid amount and refund eligibility. Claims does not edit stock. The remedy is typically partial provider refund or an approved fulfilment alternative.

## 40. Goods Not Received

Use line scope for a specific missing item and Order scope for the whole shipment. Attach fulfilment mode, Courier assignment, Pickup/Delivery Handoff, delegated-recipient authorization if used, failed-delivery/return facts, relevant checkpoint location and Chat. A verified final Handoff is strong evidence of recorded receipt by the expected recipient, but does not prove every item/condition inside the package.

## 41. Not as Described

Use Product Post/Variant commercial snapshot, relevant Product media, any applicable Scene Post revision, Buyer item photographs, Seller response and Handoff/completion facts. The reviewer compares the historical representation with the received goods; current edited catalogue content is not enough.

Preserve exact historical Scene/Product representation and selected Message provenance even after current Scene becomes PRIVATE. Accepted final receipt and legal completion do not dismiss a condition/description allegation automatically.

## 42. Refund Not Completed

```
Claim/remedy authorizes refund
-> Claims sends typed refund request to Finance
-> Finance stores expected basis + provider request
-> Claim = REMEDY_PENDING
-> provider confirms result
-> completed -> Claim may RESOLVE
-> failed/requires_action -> evidence appended + reviewer/Finance action
-> delayed -> AWAITING_PROVIDER_RECONCILIATION or REMEDY_PENDING per policy
```

## 43. Delivery Failure and Return

Courier/Seller delivery failures may include Buyer absent, delegate unavailable, Courier cancellation, incorrect assignment, return-to-Seller or repeated failed attempts. Attach attribution of who cancelled/failed, Handoff stage, checkpoint evidence and any return Handoff. Fault is not inferred from a single cancellation code; Claims evaluates attributable evidence.

## 44. Safety Suspension Affecting Paid Commerce

Moderation may block future Seller activity immediately while already-paid Orders require transaction-specific handling. Moderation provides the safety action reference; Claims evaluates the affected Order evidence and remedy. Moderation does not decide the Claim, and Claims does not lift or impose platform safety enforcement.

## 45. System-Origin Claim

A system-origin Claim records the exact triggering fact, policy version and event ID. It should be as reviewable as a Buyer-opened Claim. SYSTEM is not a shortcut to auto-upheld; it only means the platform observed the trigger.

## 46. Evidence Request

A reviewer or rules engine may request only the missing evidence necessary for the question. Requests carry kind, recipient, requested_at, due_at, reason code and allowed upload types. Party silence becomes evidence of non-response but does not automatically decide the Claim.

## 47. Remedy Model

| Remedy | Meaning |
| --- | --- |
| REFUND | Claims authorizes/request a provider refund through Finance; Claims never marks the Buyer refunded. |
| FULFIL | Seller continues/corrects fulfilment through Order/Fulfilment/Handoff invariants. |
| NONE | No commerce remedy required, Claim not upheld, incident already resolved, or remedy unavailable by policy. |

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

## 48. Remedy Is Not Outcome

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

UPHELD/NOT_UPHELD remains adjudication; REQUESTED/PENDING/COMPLETED/REFUSED/OVERDUE remains financial execution. Neither is inferred from free text, review publication or a timer.

## 49. Refund Remedy Through Provider

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

Claims sends a governed stable remedy request; Finance validates amount/components, actual provider permission/funding, external identity and completion. Required unfinished remedy stays truthful; operational case closure cannot declare reimbursement from a promise.

## 50. Partial Line Refunds

For line-scoped Claims, refund basis uses immutable Order Line amounts. Commercial policy decides whether all or part of delivery charge and Adulis Checkout surcharge are refundable for the reason. Claims never recalculates from current Product price or invents fee policy.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 51. Fulfil Remedy

FULFIL sends a controlled Order/Fulfilment command. Mark Ready, Courier assignment, Handoff issuance and Order completion remain owned by those domains. Claim code must never update Order state directly.

## 52. Human Adjudication

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

An authorized human deciding Operator Account reviews the exact Order/line Claim, permitted evidence and current policy. Record structured outcome, reason, remedy, actual typed decider, capability/scope/purpose, decision timestamp and governance references where required. No ordinary Account or automatic risk/timer job decides a contested case.

## 53. Outcome Model

```
UPHELD
NOT_UPHELD
```

NOT_UPHELD means only that Adulis did not uphold the Claim on the available evidence. It does not mean the claimant lied or abused the platform.

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 54. Structured Outcome Reasons

| Reason code example | Purpose |
| --- | --- |
| SELLER_FAILURE_ESTABLISHED | Canonical Order/fulfilment/product evidence established a Seller-side failure. |
| PROVIDER_FACT_ESTABLISHED | Finance/provider evidence established the relevant payment/refund fact. |
| HANDOFF_FACT_ESTABLISHED | Accepted Handoff evidence established the recorded transfer fact. |
| BUYER_EVIDENCE_INSUFFICIENT | Required Buyer-side evidence was insufficient after fair request. |
| SELLER_EVIDENCE_SUPPORTED | Seller evidence plus system facts supported the Seller position. |
| INCIDENT_ALREADY_RESOLVED | Requested remedy/failure had already been validly resolved. |
| CLAIM_OUTSIDE_SCOPE | Requested issue is outside this Claim scope/policy. |
| OTHER_REVIEWED_REASON | Controlled fallback requiring reviewer notes and later taxonomy review. |

## 55. Bad-Faith Finding Is Separate

Bad faith requires affirmative evidence and a separate Abuse/Moderation finding. It cannot be derived automatically from NOT_UPHELD, a lost payment dispute or a contradictory party statement. Claims may refer evidence to Moderation but does not punish the account itself.

## 56. Claim Event Ledger

```
claims.claim_event
  claim_id, sequence, event_type
  actor_type ORDINARY_ACCOUNT|OPERATOR_ACCOUNT|SYSTEM
  ordinary_account_id nullable FK accounts.account
  operator_account_id nullable FK operators.operator_account
  system_source nullable
  from_state, to_state, evidence_ref, reason_code
  request_id, correlation_id, occurred_at, policy_version
```

The per-Claim ledger is append-only with unique sequence and typed actor shape. Current state and required ledger/outbox fact commit atomically; privilege metadata is restricted audit, not an ordinary identity alias.

The per-Claim claim_event ledger is an internal audit record, not an unversioned integration envelope. Cross-domain facts from §89 use the separate event_type/event_version registry and the same committed decision/incident identity.

## 57. Decision History

```
claims.claim_decision (conceptual amendment)
  id; claim_id; incident_id; seller_order_id; optional order_line_id
  outcome; seller_fault; severity; remedy; responsibility
  approved_deadline; policy_version; decision_version
  decided_by_operator_account_id; approval_reference
  supersedes_decision_id; evidence_refs; occurred_at
Separate Finance-linked remedy status/time + correction lineage.
Resolution classification is structured, never parsed from notes.
```

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

## 58. Decision Correction

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

A correction appends a new exact-Claim decision; Trust/Reviews/Analytics repair one logical consequence from its supersession chain. Owed/refunded money is preserved even when fault is overturned. No arbitrary Operator table mutation.

## 59. Buyer Authorization

Authenticate the ordinary Buyer Account that owns the exact Order. Its Seller ownership or Courier relationships elsewhere do not invalidate Buyer authority. Limit case/evidence read and submitted statement/attachments to current party entitlement; another Buyer’s Order is denied. Delegated physical receipt does not grant delegate case ownership.

## 60. Seller Authorization

Authenticate the actual ordinary human and resolve current Seller OWNER/TEAM relationship, effective permission, surface and exact Order Seller scope. Membership removal or context substitution blocks the next read/action. A Seller business ID or client actor label alone is not authority; ANALYST/support/content roles receive only their permitted case operations.

## 61. Seller Role Boundary

OWNER/ADMIN or delegated roles may act only according to current Authentication/Authorization. SALES_SUPPORT can perform support/Claim responses where granted; specialist roles do not gain extra Claim or payment authority because they can edit Products or fulfilment. No Seller role can create provider payment/refund truth or decide the Claim outcome.

## 62. Operator Authorization

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

Claims capabilities distinguish queue view, sensitive evidence read, evidence request, decision, correction and private export. Every action checks exact case/resource, reason/purpose and required freshness; revocation blocks the next action. No ordinary Seller role grants Claim decision rights, party impersonation or raw table mutation.

## 63. Finance Integration

Finance supplies payment attempts, provider verification, refund and settlement evidence through a safe evidence contract. Claims can request a permitted refund after adjudication. Finance remains authoritative for the resulting money state and provider reconciliation.

Only normalized provider/Finance facts settle paid, refund and settlement questions. Finance KYC remains restricted and is absent from ordinary Claim evidence unless a specific legitimate case policy and privileged grant require the minimum access.

## 64. Order Integration

Order supplies Order/Order-Line snapshots, amount and policy snapshots, legal transition history, fulfilment status and allowed actions. Claims never writes Order tables directly. Remedy commands go through Order application services and idempotency rules.

## 65. Catalogue, Content & Media Integration

Content owns Scene Post revisions, publication state DRAFT/PUBLISHED/ARCHIVED and visibility PUBLIC/PRIVATE separately. Public publication requires media/caption, same-Seller eligible tags and at least one available tagged Product, plus current Seller, Market and Moderation gates. Last available Product loss changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Stock recovery may automatically restore PUBLIC only after all current gates pass; it does not archive or require manual republishing solely for restock. Independent archive/removal or safety blocks remain effective.

Claims preserves the exact historical Product/Scene revision and Media bytes under a bounded legitimate hold. Current Content visibility stays authoritative for public access. A Claim evidence route performs case authorization and restricted source reads; it never toggles PRIVATE to PUBLIC.

## 66. Inventory Integration

Inventory supplies canonical stock events and line sale/adjustment history. Claims may use these facts to establish a seller-cannot-fulfil incident but cannot change quantity or stock confidence.

## 67. Fulfilment & Courier Integration

Fulfilment supplies fulfilment mode, Courier pool/assignment history, delivery-charge snapshot, failed-delivery/return facts and checkpoint-location references. Courier compensation is not a general Buyer Claim right; expose only what the Claim needs to explain the transaction.

## 68. Handoff Integration

Use Handoff owner readers for immutable accepted stage/method/recipient/assignment facts. Final delivery to an active delegate leaves the Buyer as Claim and Review-right owner. GPS is supporting context. Claims neither fabricates receipt nor rewrites an accepted Handoff.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

## 69. Moderation Integration

Claims can emit upheld-pattern or suspected-abuse signals to Moderation. Moderation can supply a Seller/Courier safety-action reference to Claims. Each domain keeps its decision authority separate.

## 70. Trust Integration

Trust alone owns NEW, REBUILDING, ESTABLISHED and TRUSTED and its policy-versioned consequences. Generic accepted receipt is separate from stronger QR promotion evidence: qualifying final Buyer/delegate QR receipt may count under Trust policy; OTP and Manual do not automatically receive QR credit. Upstream domains expose safe method/purpose facts and never set Trust levels or promotion math.

Claims emits structured decision/correction facts and the governing evidence/outcome versions. Trust computes its own idempotent consequences and re-evaluates corrections; it cannot rewrite Claim decisions. NOT_UPHELD is not automatic bad faith. Claims does not write Trust levels or promotion/demotion arithmetic.

## 71. Reviews Integration

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Claims cannot directly create or revoke Review Grants. A Claim opening or upheld decision does not automatically suppress a Review; Reviews applies its explicit policy to typed case outcomes while preserving the final-Handoff-backed Buyer right and separate Product-quality/Seller-service dimensions.

## 72. Seller Verification Boundary

Adulis Seller admission requires no Government ID, legal-ID upload or selfie-to-ID flow. A PSP may independently impose KYC/KYB under its contract and the activated Market. Prefer provider-hosted collection and retain only provider references, safe status and masked metadata in Finance. Any unavoidable Adulis handling requires a confirmed requirement and restricted Finance purpose, storage, access, audit, retention and deletion controls; it does not become an Onboarding ID requirement.

Normal Seller verification contracts contain no Government-ID evidence. Social control/admission metadata may be a bounded case fact where relevant; it does not attest legal identity. Provider KYC is not included in default case manifests or exports.

## 73. Market & Localization

The architecture is globally extensible with explicit phased Market activation. Ethiopia is the initial commerce Market, beginning with Addis Ababa. Future Markets require approved currency, provider, legal, commercial and operational readiness. Locale, IP address, phone prefix and client country never activate commerce.

Claim triggers, evidence/deadline rules, localization and remedy policy are Market-versioned. The initial review target is the configured two-day baseline where adopted; missing it alerts/escalates and never decides a contested case. Future Market activation requires explicit policy, provider remedy and operating readiness; Ethiopia rules are not a universal default.

## 74. Evidence Export Purpose

An evidence export gives an entitled party a portable record of their transaction and Claim: Order reference, commercial snapshot, relevant Product/Scene Post representation, provider payment/refund timeline, fulfilment/Handoff facts, relevant communication, party-submitted evidence and current Claim decision.

## 75. Export Privacy Boundary

Exports are private, time-bounded and purpose/case authorized with immutable access audit. Include only necessary historical Order/line representation and permitted evidence; redact unrelated Chat, delegate contact, addresses, provider secrets and private narratives. PRIVATE Scene historical evidence never becomes a public link.

Provider KYC is excluded by default. Exceptional legitimate access/export requires the source Finance policy, specific case purpose, current privileged capability and minimum necessary scope. Seller admission Government ID does not exist to export.

## 76. Export Integrity Manifest

Exports are generated server-side, time-bounded and audited. Include file/item hashes or a manifest sufficient to detect accidental alteration, plus generated_at, Claim/Order reference, export schema version and the decision version represented.

## 77. Retention Holds

Opening a Claim creates explicit holds on the evidence classes required by policy: financial provider evidence, Product/media snapshots, relevant Chat references, Handoff/fulfilment evidence and private party attachments. Holds are scoped to the Claim/Order, not an entire account, and are released only by the retention lifecycle after legitimate purpose ends.

Holds apply to exact historical Scene revision and needed media/message/evidence references, never the whole unrelated Account or Content corpus. Releasing a hold does not change current Scene visibility or undo privacy deletion tombstones.

## 78. Evidence References vs Bytes

PostgreSQL stores evidence metadata, references, digests and access state. Private binary evidence is stored in the approved restricted object-storage path. Deleting object bytes must update lifecycle metadata only after storage confirms deletion; missing objects are reconciliation errors, not silent success.

## 79. Account Deletion

Account deletion may anonymize/minimize identity links while retaining the minimum transaction and Claim evidence required by active Claims, accounting, security, legal or policy holds. Deletion never rewrites Claim outcome/history. Once holds expire, the Privacy lifecycle purges/anonymizes according to the versioned retention policy.

## 80. No Public Accusation

Public Seller pages may expose only approved aggregate reliability/trust/review signals. Claim narratives, evidence, reporter identity, reviewer notes and accusation text are not public. Party-visible outcome copy remains neutral and localized.

## 81. Buyer API

```
POST /v1/orders/:orderRef/claims
GET /v1/claims/:claimRef
POST /v1/claims/:claimRef/evidence
POST /v1/claims/:claimRef/respond
GET /v1/claims/:claimRef/evidence-export
POST /v1/claims/:claimRef/evidence-export
```

The server derives Buyer identity and allowed Claim scopes from the authenticated Order. Clients submit a trigger/reason and optional line reference only where returned allowed_actions permits it.

## 82. Seller API

```
GET /v1/sellers/:sellerRef/claims
GET /v1/sellers/:sellerRef/claims/:claimRef
POST /v1/sellers/:sellerRef/claims/:claimRef/respond
POST /v1/sellers/:sellerRef/claims/:claimRef/evidence
POST /v1/sellers/:sellerRef/claims/:claimRef/remedy-proposal
```

## 83. Operator API

| Endpoint class | Required privileged contract |
| --- | --- |
| Queue / case read | Separate OPERATOR audience, current capability and exact scope. |
| Selected evidence access / request | Case purpose, source-domain permission, audit and minimum data. |
| Decision / correction | Actual deciding Operator Account, current decision capability, freshness and required governance; append-only history. |
| Evidence export | Current export capability, legitimate purpose and expiry; default excludes KYC. |
| Operational repair | Owner-specific replay/reconciliation with immutable audit; no universal setter. |

Generated REST/OpenAPI clients do not confer authorization. Ordinary sessions cannot call these operations; current capability revocation takes effect on the next sensitive action.

## 84. Allowed Actions Contract

Buyer, Seller and Operator clients render server-supplied allowed_actions. They do not derive action legality from Claim state alone. Examples: SUBMIT_EVIDENCE, RESPOND, REQUEST_REFUND_REMEDY, PROPOSE_FULFIL, DECIDE, CORRECT_DECISION, GENERATE_EXPORT.

## 85. Error Taxonomy

```
CLAIM_NOT_FOUND
CLAIM_SCOPE_INVALID
CLAIM_ALREADY_OPEN
CLAIM_STATE_CONFLICT
CLAIM_VERSION_CONFLICT
EVIDENCE_KIND_NOT_ALLOWED
EVIDENCE_SCOPE_MISMATCH
EVIDENCE_HOLD_FAILED
PROVIDER_RECONCILIATION_REQUIRED
REFUND_NOT_ALLOWED
REMEDY_NOT_ALLOWED
PERMISSION_DENIED
OPERATOR_CAPABILITY_REQUIRED
```

## 86. Core Tables

| Table | Purpose |
| --- | --- |
| claims.claim | Current Claim scope/state/severity/current decision reference |
| claims.claim_event | Append-only event ledger |
| claims.claim_decision | Append-only decisions and corrections |
| claims.claim_evidence | Evidence manifest/reference metadata |
| claims.evidence_request | Requested evidence and deadline/status |
| claims.claim_remedy | Requested remedy and owning-domain reference/status |
| claims.evidence_export | Private expiring export metadata |
| claims.evidence_access_log | Sensitive evidence/export access audit |

## 87. Database Constraints

- Claim Order/Order-Line composite integrity

- One unresolved Claim per identical supported scope/trigger

- Append-only decision/event protection through permissions/functions

- Current decision must reference same Claim

- Monotonic event sequence per Claim

- Evidence source scope validation through trusted attach command

- Unique idempotency key per actor + command + Claim

- No nullable Market for Market-scoped commerce Claims

## 88. Indexes

- Open work queue by state/severity/review_deadline

- Buyer/Seller Claim lists by account/seller + created_at cursor

- Order + line + trigger partial uniqueness

- Evidence by Claim + kind

- Claim event by claim_id + sequence

- Decision by claim_id + decided_at

- SLA monitor partial index on unresolved Claims

- Export expiry index

## 89. Events and Transactional Outbox

```
claim.opened
claim.evidence_attached / claim.evidence_requested
claim.state_changed
claim.decision_recorded / claim.decision_corrected
claim.remedy_requested / claim.remedy_completed
claim.resolved
```

Business changes and required event_outbox and/or job_intent commit in the same PostgreSQL transaction. The shared Eventing relay leases durable intent, creates versioned event_delivery records from its consumer registry and deterministic BullMQ jobs after commit. BullMQ on Valkey is the sole ordinary background execution engine. Delivery is at-least-once; workers re-read current canonical scope/state and use PostgreSQL uniqueness and processed-effect markers. Repair, dead-letter review and bounded reconciliation recover outages; no correctness-sensitive PostgreSQL-to-Valkey dual write is allowed.

Registered event versions include Claim, Order/optional same-Order line, Market/policy, structured outcome/reason, decision version, safe source reference and distinct ORDINARY_ACCOUNT/OPERATOR_ACCOUNT/SYSTEM attribution. Do not emit raw private evidence, full Chat, notes, QR/OTP, KYC or provider secrets. Decision correction has a stable compensating identity; Trust, Reviews and Analytics apply their own idempotent rules.

All nine exact lifecycle/decision/remedy facts here are registered in EVT §35 and Contract_Registry. claim.decision_corrected requires current decision/version, supersedes_decision_id and correction lineage. claim.remedy_requested states an obligation/request, not payment. claim.remedy_completed requires verified Finance completion reference/time/status, not a decision, promise or screenshot. claim.resolved can finish adjudication while an explicit remedy remains outstanding; the two truths never collapse.

## 90. Scheduled Jobs

- Initial-review SLA monitor

- Evidence-request deadline monitor

- Provider-reconciliation/remedy follow-up monitor

- Evidence-export expiry/purge

- Retention-hold reconciliation

- Projection/statistics reconciliation

- Dead-job/retry monitoring

Timers only request attention, legal owner reconciliation or state-eligible work. They never decide contested cases or mark an ambiguous provider refund complete. All deadlines are canonical PostgreSQL timestamps/version; queue delay is not business authority.

## 91. Connected-Only Claim Operations

Claim creation, evidence commit, decision, remedy request and export generation require backend confirmation. The client may keep transient form state for UX, but it does not maintain a durable local Claim/evidence queue or claim success before the server commits the operation.

## 92. Evidence Upload Security

- Server-issued scoped upload grants only

- Strict file-size/count limits and allowlisted content types

- Content sniffing; do not trust filename extension

- Private object storage; no public Claim evidence URLs

- Image normalization/metadata stripping when appropriate

- Malware/file safety checks appropriate to supported formats

- Finalize evidence only after server validates object ownership and Claim scope

- No automatic image or OCR judgment of contested facts

## 93. Private Financial Evidence Access

Private Finance evidence is accessed through a source-owned, purpose-bound reader and actual typed principal audit. Ordinary parties see only their permitted case/payment facts. Operator Accounts require current Finance evidence capability in addition to Claim purpose/scope where necessary.

Provider-hosted KYC is not routine Claim evidence. Prefer safe status/ref data. Exceptional raw KYC access requires a confirmed legitimate requirement and restricted source policy, never a general Claim role or default export.

## 94. Operator Console Security

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

Case read, decision, correction and export are individually scoped/audited. No Seller OWNER role crosses this boundary. Governing approvals/Step-Up apply to sensitive operations under current policy; shortcuts, impersonation and direct canonical SQL writes are prohibited.

## 95. Abuse Protection

Rate-limit Claim creation, evidence upload and repeated responses without blocking legitimate urgent recourse. Detect duplicate/replayed evidence references, arbitrary target IDs, cross-Seller scope probes, forged provider references and mass evidence-export requests. A claimant losing multiple Claims is not itself proof of abuse.

## 96. Logging and Redaction

- Log request/correlation ID, Claim reference, transition, error code, latency and actor class.

- Never log private attachments, raw provider payloads, OTP/QR credentials, access tokens, full Chat bodies or sensitive delegate contact data.

- Pino structured logs and Sentry breadcrumbs use bounded identifiers and redacted context.

## 97. Observability

| Signal family | Examples |
| --- | --- |
| Queue/SLA | open Claims, age, first-review SLA misses, evidence-request expiry |
| Financial | provider reconciliation wait, refund latency, failed refund commands |
| Evidence | attachment errors, hold failures, missing-object reconciliation, restricted-read rate |
| Decisions | UPHELD/NOT UPHELD distribution, correction rate, reviewer conflict rate |
| Delivery | Claim rate by fulfilment mode, accepted Handoff method, failed delivery/return |
| Platform | PostgreSQL query health, BullMQ age, Valkey health, R2 errors, API p95/p99 |

## 98. Zero-Tolerance Alerts

- Evidence attached from the wrong Order or Seller

- Provider payment/refund fact changed by a non-Finance authority

- Claim decision written without authorized Operator identity

- Outcome changed by direct UPDATE rather than appended correction

- Required evidence hold failed while Claim opened

- Cross-tenant evidence read succeeded

- Refund marked complete without Finance/provider authority

- Accepted Handoff evidence mutated or deleted by Claim code

## 99. Core Functional Tests

- Buyer cannot open Claim for another Buyer Order

- Seller cannot read another Seller Claim

- Line reference must belong to same Order

- Duplicate open Claim same scope rejected/idempotent

- Product Post/Scene Post revision snapshot retained correctly

- Provider success/refund facts attach and deduplicate

- Client redirect cannot establish payment fact

- Fulfilment SLA system Claim opens but does not auto-uphold

- Pickup/Delivery Handoff evidence attaches correctly

- Delegated recipient Handoff leaves Buyer as Claim owner

- Location evidence never proves receipt alone

- Partial line refund uses historical amounts/policy

- Decision correction preserves original decision and recomputes downstream evidence

- Account deletion cannot purge active-Claim evidence

### Required current-contract regressions

| Test | Expected result |
| --- | --- |
| CLAIM-CANON-01 | Ordinary Buyer cannot open another Buyer’s Order Claim. |
| CLAIM-CANON-02 | Seller relationship cannot expose another Seller Claim. |
| CLAIM-CANON-03 | Buyer authority survives Seller ownership elsewhere on the same ordinary Account. |
| CLAIM-CANON-04 | Ordinary Account cannot decide a Claim. |
| CLAIM-CANON-05 | Scoped separate Operator Account can decide with current capability. |
| CLAIM-CANON-06 | Capability revocation blocks next sensitive action. |
| CLAIM-CANON-07 | Exact historical Scene revision survives PRIVATE transition. |
| CLAIM-CANON-08 | Case access never republishes PRIVATE Scene. |
| CLAIM-CANON-09 | Product/Scene evidence survives legitimate Claim hold. |
| CLAIM-CANON-10 | Delegate final receipt leaves Buyer as Claim owner. |
| CLAIM-CANON-11 | Delegate gains no Review/Claim right. |
| CLAIM-CANON-12 | Final DELIVERY can coexist with NOT_AS_DESCRIBED. |
| CLAIM-CANON-13 | Normal Seller verification has no Government-ID evidence. |
| CLAIM-CANON-14 | Provider KYC is absent from ordinary case evidence. |
| CLAIM-CANON-15 | Refund completion requires Finance/provider fact. |
| CLAIM-CANON-16 | Correction preserves old decision and compensates derived consequences. |

## 100. Authorization Tests

- SALES_SUPPORT response succeeds only with seller.claims:respond

- INVENTORY/ANALYST/CAMPAIGN_MANAGER actions follow Auth grants, not hard-coded role names

- No Seller role writes outcome or provider state

- Operator grant revocation takes effect on next sensitive action

- Console/Mobile surface restrictions are enforced server-side

Exercise distinct ordinary/Operator FK shapes, all party scopes, multirole permission union, revocation after page load, purpose-bound export and exceptional Finance capability separation.

## 101. Concurrency and Idempotency Tests

- Two reviewers deciding same case -> one version wins; other gets conflict

- Same evidence commit retried -> one manifest row

- Same refund remedy retried -> one Finance RefundRequest

- Claim open double-tap -> one Claim

- Provider duplicate webhook -> one canonical payment/refund fact attached

- Decision correction race uses version/current_decision guard

Specify duplicate/out-of-order decision correction and remedy events, incorrect supersession, missing Finance completion proof and reopened cases. Trust and Reviews lock/re-read the current decision, deduplicate the same logical incident effect and repair reversals. Static/schema fixtures are executed; database/worker/application races remain unexecuted.

## 102. Load and Cost Tests

Use k6 to test Buyer/Seller Claim reads, evidence metadata writes, Operator queue paging and burst Claim opening. Testcontainers validates PostgreSQL constraints/concurrency. Maestro covers Mobile Claim creation/evidence flow; Playwright covers Seller/Operator Console. Large binary uploads are load-tested separately from core API memory limits.

## 103. Failure Behaviour

| Failure | Required behavior |
| --- | --- |
| Valkey/BullMQ unavailable | Canonical synchronous writes continue where safe; async notifications/projections retry. Claim truth never disappears. |
| Provider unavailable | Claim waits for Finance reconciliation; do not invent payment/refund state. |
| R2 private evidence unavailable | Block new binary evidence commit; keep Claim/evidence metadata consistent; existing Claim remains readable where possible. |
| Handoff service unavailable | Do not fabricate transfer evidence; use existing accepted evidence or wait/retry. |
| Trust/Moderation unavailable | Record Claim decision; downstream effects retry through outbox. |
| Notification unavailable | Claim state remains authoritative in-app; notification retries. |

## 104. Canonical Technology Stack

| Layer | Current implementation and authority |
| --- | --- |
| API / runtime | Node.js; NestJS + Fastify; strict TypeScript; REST/OpenAPI with @nestjs/swagger and generated TypeScript clients; @nestjs/throttler, @fastify/helmet and libphonenumber-js. |
| Canonical data | PostgreSQL + Drizzle; pg_trgm, btree_gist and pg_stat_statements; owner repositories, typed FKs, legal transitions and transactional outbox/job_intent. |
| Async / coordination | BullMQ on Valkey as the sole ordinary background engine; committed PostgreSQL intent, deterministic execution IDs, current-state revalidation and database idempotency. |
| Media | Cloudflare R2 + CDN and Sharp for image processing. Restricted evidence bytes use private, purpose-bound access. Native video is deferred from the photo-first discovery baseline. |
| Mobile | React Native + Expo; Expo Router, TanStack Query, FlashList, Expo Image, SecureStore, SQLite, Camera, Notifications and Updates; small Zustand UI stores. SQLite never establishes offline commerce acceptance. |
| Quality / operations | Jest, Testcontainers, Maestro, Playwright and k6; Sentry, Pino and database query diagnostics; dependency-cruiser; Docker, GitHub Actions, Render, Cloudflare and EAS. |

Private evidence manifests and bytes remain Claims/source-domain controlled. Current worker repair follows the shared Eventing bridge; no separate Claims microservice or alternate background engine is required at MVP.

## 105. Module Layout

```
adulis-platform/
apps/api/src/modules/claims/
domain/
application/
infrastructure/
api/
apps/worker/src/jobs/claims/
apps/mobile/src/features/claims/
apps/seller-console/src/features/claims/
apps/operator-console/src/features/claims/
packages/api-contracts/
packages/permission-catalogue/
packages/analytics-events/
```

## 106. Dependency Rules

- Claims may call public application/service contracts for Order, Finance, Catalogue, Content, Inventory, Fulfilment, Handoff, Chat, Trust, Moderation, Reviews, Privacy and Notifications.

- Claims must not import another domain private repository.

- Finance provider adapter is not imported by Claims.

- Order tables are not updated from Claims infrastructure.

- Valkey never stores the only copy of Claim state/evidence/decision.

## 107. No Claims Microservice at MVP

Keep Claims inside the modular monolith. It needs strongly consistent scope validation, evidence attachment, retention holds, authorization and transactional outbox behavior across current platform contracts. Splitting it out now would add distributed evidence assembly and authorization complexity without a proven scaling need.

## 108. Deployment Model

Claims API runs in the platform API service; asynchronous notifications, exports, projection/reconciliation and lifecycle jobs run in workers. PostgreSQL is canonical. Private R2 stores Claim attachments/exports. Valkey backs BullMQ and bounded coordination/rate controls. Deploy through Docker/GitHub Actions/Render with Cloudflare at the edge and EAS for Mobile releases.

## 109. Superseded v1.0 Assumptions

| Superseded assumption | Current replacement |
| --- | --- |
| Legacy line-level transaction scope | Order Line from current one-Seller Order model |
| Payment authority | Backend-verified PSP/provider payment facts |
| Provider uncertainty state | AWAITING_PROVIDER_RECONCILIATION through Finance |
| Seller sends refund directly | Provider refund request/reconciliation through Finance |
| Buyer acknowledgment defines refund completion | Provider-authoritative refund completion |
| Old final-delivery scan direction | Presenter displays; Buyer/delegate scans; QR/OTP/Manual unified |
| Document-based Seller verification context | No such evidence in current Claims transaction model |
| Legacy cache terminology | Valkey only |

## 110. Data Migration

- Add order_line_id to the v2 Claim model and migrate any historical line references through a verified mapping before old fields are retired.

- Replace financial-wait state with AWAITING_PROVIDER_RECONCILIATION for new Claims; preserve old historical state labels only in migration/audit views if required.

- Introduce provider payment/refund evidence kinds and stop creating old payment-proof evidence kinds for new Orders.

- Backfill Market and current decision references where deterministic.

- Do not mutate historical decisions/evidence to look like they were created under v2 semantics.

Migrate ambiguous opener/decider IDs to typed canonical identities through an explicit mapping; unresolved history remains quarantined from privileged authority. Preserve historical evidence hashes, Scene revisions, decision sequence and policy versions. Do not rewrite allegations into findings or reuse an ordinary role ID as Operator Account.

## 111. Required Upstream Contracts

- Order must expose immutable Order/Order-Line commercial snapshots and allowed actions.

- Catalogue/Content/Media must preserve exact Product Post and relevant Scene Post revision under an active Claim hold.

- Finance must expose safe provider payment/refund evidence and idempotent refund commands.

- Fulfilment/Handoff must expose immutable assignment, checkpoint and accepted transfer evidence.

- Privacy must implement holds/purge callbacks.

- Trust/Moderation/Reviews must consume Claim decision/correction events idempotently.

Require exact historical Scene revision/Media hold contracts, immutable Message provenance, accepted Handoff method/recipient facts, safe provider/KYC boundary, two-basis Buyer/Order feedback ownership and distinct typed ordinary/Operator principal audit.

Reviews consumes registered claim.decision_recorded, claim.decision_corrected and verified claim.remedy_completed/refund.status_changed facts through current owner reads. Finance completion is independent evidence; Claims cannot manufacture it. An unsupported event_version rejects delivery rather than guessing a schema.

## 112. Core Invariants

- CLAIM-INV-01 Every Claim belongs to exactly one Order.

- CLAIM-INV-02 A line-scoped Claim references an Order Line belonging to that same Order.

- CLAIM-INV-03 A Claim opening is not a finding.

- CLAIM-INV-04 No timer or detector automatically decides a contested Claim.

- CLAIM-INV-05 Initial human review target is policy-controlled; missing SLA does not auto-resolve.

- CLAIM-INV-06 At most one unresolved Claim exists per identical incident scope/trigger.

- CLAIM-INV-07 Critical evidence and decisions are append-only; corrections never erase history.

- CLAIM-INV-08 Evidence from another Order cannot be attached.

- CLAIM-INV-09 Product representation evidence preserves the historical Product Post/Variant context.

- CLAIM-INV-10 Provider-verified payment/refund facts remain Finance-owned.

- CLAIM-INV-11 Client returns, Seller actions and analytics cannot establish payment truth.

- CLAIM-INV-12 Claims never marks a provider refund complete.

- CLAIM-INV-13 Accepted Handoff evidence remains Handoff-owned and immutable.

- CLAIM-INV-14 A delegated recipient never becomes Order or Claim owner.

- CLAIM-INV-15 Checkpoint location is supporting evidence only.

- CLAIM-INV-16 Outcome and remedy are independent concepts.

- CLAIM-INV-17 NOT_UPHELD never automatically means bad faith.

- CLAIM-INV-18 Trust and Moderation consequences are downstream domain decisions.

- CLAIM-INV-19 Sensitive evidence reads are purpose-bound and audited.

- CLAIM-INV-20 Claim operations require server confirmation; no local business-state authority.

- CLAIM-INV-21 Valkey is non-canonical and loss of Valkey cannot change Claim truth.

- CLAIM-INV-22 Claim evidence/export never becomes public accusation content.

- CLAIM-INV-23 Account deletion cannot remove evidence protected by active legitimate holds.

- CLAIM-INV-24 Claims never adjudicates criminal guilt.

• CLAIM-INV-25 Scene Post is contextual evidence, never Claim scope.

• CLAIM-INV-26 PUBLIC/PRIVATE changes never rewrite historical Claim evidence.

• CLAIM-INV-27 PRIVATE Scene evidence access does not restore public visibility.

• CLAIM-INV-28 Ordinary Account and Operator Account identities remain distinct.

• CLAIM-INV-29 Contested decisions require an authorized Operator Account.

• CLAIM-INV-30 Delegate final receipt leaves Buyer as Claim and Review-right owner.

• CLAIM-INV-31 Claims cannot create/revoke Review Grants directly.

• CLAIM-INV-32 Current Seller verification requires no Government-ID evidence.

• CLAIM-INV-33 Provider KYC remains Finance/provider restricted unless a specific legitimate case requires access.

• CLAIM-INV-34 Claim policy is Market-versioned; future activation is explicit.

## 113. Production Launch Gate

- [PASS REQUIRED] Buyer/Seller cross-tenant scope tests pass.

- [PASS REQUIRED] Order-Line composite integrity is enforced in PostgreSQL.

- [PASS REQUIRED] Duplicate open Claim same scope is impossible/idempotent.

- [PASS REQUIRED] Claim event and decision ledgers are append-only.

- [PASS REQUIRED] Two-reviewer concurrency conflict is safe.

- [PASS REQUIRED] Provider payment/refund evidence attaches through Finance contracts only.

- [PASS REQUIRED] Provider ambiguity cannot be converted into a guessed payment result.

- [PASS REQUIRED] Refund remedy creates one idempotent Finance request and waits for authoritative result.

- [PASS REQUIRED] Product Post/Variant and relevant Scene Post revision can be preserved under Claim hold.

- [PASS REQUIRED] Handoff QR/OTP/Manual accepted evidence attaches without exposing credentials.

- [PASS REQUIRED] Delegated-recipient receipt preserves Buyer Claim ownership.

- [PASS REQUIRED] Location evidence cannot complete or decide a Claim by itself.

- [PASS REQUIRED] Private evidence upload/access controls and audit logs pass.

- [PASS REQUIRED] No Seller role can decide outcomes or payment/refund truth.

- [PASS REQUIRED] Operator grant revocation and no-impersonation tests pass.

- [PASS REQUIRED] Decision correction causes downstream Trust/Moderation/Analytics compensation/recompute.

- [PASS REQUIRED] Retention hold and account-deletion tests pass.

- [PASS REQUIRED] Valkey loss does not corrupt durable Claim state.

- [PASS REQUIRED] k6/Playwright/Maestro/Testcontainers suites pass agreed gates.

- [PASS REQUIRED] Final architecture contains no legacy payment-confirmation or direct-refund path.

Require all CLAIM-CANON cases, typed opener/decider FKs, NULL-safe unresolved-scope uniqueness, separate Operator revocation/audit, historical PRIVATE Scene holds, provider-refund reconciliation and no routine Government-ID/KYC export.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 114. Recommended Implementation Sequence

| Phase | Implementation |
| --- | --- |
| 0 | Schema correction: Order-Line scope, states, event ledger, decisions, constraints |
| 1 | Buyer/System Claim creation, duplicate prevention, allowed actions |
| 2 | Evidence assembler: Order/Product/Inventory/Chat + retention holds |
| 3 | Finance provider payment/refund evidence + provider reconciliation state |
| 4 | Fulfilment/Handoff/delegation/location evidence integration |
| 5 | Private party attachments + evidence requests + access audit |
| 6 | Operator review queue, append-only adjudication and decision correction |
| 7 | Provider refund / fulfil remedy orchestration |
| 8 | Trust/Moderation/Reviews/Analytics/Notifications consumers |
| 9 | Evidence export, retention/deletion reconciliation |
| 10 | Concurrency, security, privacy, failure/load tests and production certification |

Deploy typed principal guards/schema checks and historical representation holds before decision workflows. Add source-owned Finance/Handoff/Reviews contracts, then shared outbox correction replay and privacy deletion/reconciliation. Verify current Market policy before rollout.

## 115. Final Architecture Diagram

![Bounded party evidence, privileged adjudication and source-owned remedies](graphics/CLAIM_03.svg)
*Figure 03. Bounded party evidence, privileged adjudication and source-owned remedies. Private retained representations and append-only history are canonical Claims data; Finance confirms refunds and Trust owns consequences.*

Ordinary parties contribute bounded case evidence; separate authorized Operator Accounts adjudicate. PostgreSQL preserves scope, append-only manifests/decisions and outbox. Restricted Media/evidence, provider Finance remedies and Trust/Reviews consequences keep their own authority.

## 116. Architecture Interpretation

Claims binds one Seller Order and optional same-Order line. Historical Product/Scene and selected immutable Message context describe the allegation; Handoff establishes recorded custody, not condition. Privileged human decisions append history. Finance confirms provider remedies, while Trust and Reviews interpret structured facts independently.

## 117. Final Engineering Doctrine

### ALLEGATION != EVIDENCE. EVIDENCE != FINDING. FINDING != CRIMINAL JUDGMENT. REMEDY != OUTCOME.

### NOT_UPHELD != BAD FAITH.

The Claims system should make Adulis more trustworthy by making disagreements reproducible rather than arbitrary. A Claim is one scoped transaction incident, assembled from evidence that keeps its source authority, reviewed by an identified human, resolved through versioned reasons and legal domain commands, and preserved well enough that a later correction can be made without rewriting history.

The defining current boundary is financial and evidentiary discipline: provider-verified payment/refund facts remain Finance truth; accepted Handoff remains Handoff truth; Product and Order snapshots remain commerce truth; Claims connects those facts into a fair decision without inventing a second marketplace state machine.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

Preserve exact history without making it public, adjudicate with current case authority, request remedies from their owner, and append corrections rather than erase decisions. Current visibility, canonical money and Buyer Review rights remain outside Claims mutation authority.

## 118. Glossary

| Term | Meaning in this design |
| --- | --- |
| Ordinary Account | One human identity with Buyer, Seller and Courier acting relationships. |
| Operator Account | Separate internally provisioned privileged identity with current scoped capability. |
| Canonical owner | Domain whose legal command and PostgreSQL state establish the fact. |
| Market | Explicit activated commerce jurisdiction/configuration and effective version. |
| Scene Post | Photo merchandising/discovery content with separate publication and visibility. |
| event_outbox / job_intent | Required committed fact/effect intent persisted atomically with business truth. |
| BullMQ / Valkey | Ordinary async execution and non-canonical queue/cache infrastructure. |
| Claim scope | Exactly one Seller Order and optional same-Order line. |
| Decision correction | Append-only superseding human decision with compensating downstream facts. |
| Evidence hold | Bounded legitimate retention of exact historical source references/bytes. |
