# Adulis Handoff Verification
Version 3.2 | 13 October 2026 | DOCUMENT-CORRECTED

## Document control

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R03, R04. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026. |
| Source | ADU-HND-01_Adulis_Handoff_Verification_System_Design_v3.1.pdf |
| Authority | 13 October contract prompt; selected 12 October owner decisions remain binding. |
| Status | DOCUMENT-CORRECTED; implementation, integration tests and external approvals not established. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |

## 1. Executive Summary

Handoff is the canonical domain for accepted physical-transfer evidence. Its established protocol remains backend-connected, QR primary, OTP fallback and governed Manual emergency recovery. The custody presenter displays or requests the purpose-bound credential; the recipient scans or supplies recipient-side proof at the physical meeting. PostgreSQL accepts the evidence exactly once.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Trust alone owns NEW, REBUILDING, ESTABLISHED and TRUSTED and its policy-versioned consequences. Generic accepted receipt is separate from stronger QR promotion evidence: qualifying final Buyer/delegate QR receipt may count under Trust policy; OTP and Manual do not automatically receive QR credit. Upstream domains expose safe method/purpose facts and never set Trust levels or promotion math.

## 2. Mission

Create trustworthy, online, auditable proof that physical custody moved between the correct parties for the correct paid Order, without letting QR/OTP possession bypass authentication, Courier assignment, recipient authorization, Order state or payment authority.

## 3. Goals

- Keep Product/Storefront navigation QR structurally separate from evidence-bearing Handoff QR.

- Use one Handoff state machine for QR, OTP and Manual Verification.

- Issue credentials only when the physical parties are together and the Handoff stage is eligible.

- Bind credentials to Order, Market, Handoff type, presenter, intended recipient and Courier assignment where applicable.

- Allow one Buyer-authorized delegated final recipient without transferring Order ownership.

- Make provider-confirmed payment a prerequisite without letting Handoff decide payment truth.

- Guarantee single successful verification, idempotent retries and deterministic concurrent redemption.

- Preserve immutable evidence for Claims/Reviews/Trust while respecting Privacy/Data Lifecycle holds.

- Use V1 Courier GPS only as supporting evidence, never as proof of receipt.

- Fit the current modular-monolith architecture and small-team operating model.

## 4. Non-Goals

- Disconnected Handoff acceptance, local pending scans or later sync queues.

- Escrow or payment-provider settlement logic inside Handoff.

- Product authenticity or quality proof.

- NFC/Bluetooth proximity proof or biometric receipt.

- Blockchain/notarization.

- Public Courier marketplace or assignment decisions.

- Order ownership transfer to a delegated recipient.

- Automatic completion from GPS/geofence presence.

- Operator rewriting or deletion of accepted historical evidence.

## 5. Product Context

Handoff begins only after operational Order PAID and stock are jointly committed and the selected fulfilment stage is current/ready. Finance charge verification alone leaves CHARGE_VERIFIED_ORDER_PROCESSING and cannot authorize receipt preparation. Handoff consumes normalized owner facts rather than Chapa-specific fields.

```
Scene/Search/Storefront -> Product -> Seller Checkout
-> Finance verifies and commits exact external charge
-> joint Order/stock PAID transaction -> preparation/assignment
-> connected current recipient/stage Handoff -> accepted evidence
Independent after-commit consumers:
 Orders: legal completion from accepted final receipt
 Reviews: receipt evidence OR eligible upheld paid-Order failure
          resolves one Buyer/Order Grant; no invented Handoff
 Trust: separate method/purpose and Claim consequence policy
 Claims / Analytics / Notifications: bounded owner facts
```

No pre-payment Buyer hold or Seller payment-confirmation step. Ethiopia/Addis Ababa is initial commerce scope; future Markets require separately approved readiness.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 6. Domain Ownership

Handoff owns accepted custody evidence and method/recipient/generation provenance. Reviews owns one Order-based opportunity across FINAL_HANDOFF and VERIFIED_ORDER_FAILURE; Trust owns independent method-specific credit. Failure feedback never manufactures Handoff evidence.

## 7. Non-Ownership

- Handoff cannot establish payment success, surcharge collection or provider settlement.

- Handoff cannot assign/reassign a Courier.

- Handoff cannot determine Product price, Inventory, Seller Trust Level or Review rating.

- Handoff cannot grant the delegate refunds, Claims ownership, Chat access or Buyer account ownership.

- Handoff cannot expose private Order/payment details merely because a person has an invite or QR.

- Handoff cannot delete evidence protected by active Claim, legal, security or Moderation holds.

Handoff does not own Review Grant tables, Review authorship, Trust levels, ordinary identity, privileged Operator identity or Market activation.

## 8. Connectivity Doctrine

All Handoff operations are connected-only. QR issuance, QR verification, OTP request, OTP verification, delegation acceptance and Manual Verification require authoritative backend connectivity. No successful state is created or presented from device-only logic.

The app may detect that the network is unavailable before opening the scanner or submitting a code, but it does not store a business verification for later acceptance. The user sees a reconnect/retry state and the canonical Handoff remains unchanged.

Hard rule: no SQLite Handoff queue, no local signed-scan acceptance, no late-sync recovery, no client-clock evidence path and no disconnected Order completion.

## 9. Core Handoff Concepts

| Concept | Meaning |
| --- | --- |
| Handoff | One Order-bound physical-transfer stage, either PICKUP or DELIVERY. |
| Presenter | The party currently giving custody and displaying/requesting the credential. |
| Recipient / Scanner | The party receiving custody and proving receipt through scan or OTP. |
| HandoffCredential | One short-lived QR or OTP capability bound to one Handoff. |
| DelegatedRecipientAuthorization | Buyer-created narrow authority for one other person to receive final delivery. |
| AcceptedHandoffEvidence | Immutable server decision that verification satisfied protocol + canonical state rules. |
| ManualReview | Operator-controlled emergency recovery for one exact Handoff stage. |

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

| Acting context | Canonical authorization resolution |
| --- | --- |
| Seller presenter | ordinary_account_id -> Seller OWNER or current TEAM membership -> effective permission -> exact Seller and Order stage. |
| Courier presenter / recipient | ordinary_account_id -> active Courier profile -> exact current Courier assignment -> Order and Handoff stage. |
| Buyer recipient | ordinary Account owning the Order as Buyer; Seller/Courier relationships elsewhere do not remove this authority. |
| Delegate recipient | Active Buyer-created authorization + verified designated phone control; no independent Buyer rights. |
| Manual decider | Separate Operator Account + current capability, case scope, freshness and governance. |

## 10. Fulfilment and Handoff Matrix

| Mode / stage | Presenter -> intended recipient | QR / OTP / Manual / transition |
| --- | --- | --- |
| Buyer Collection / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Seller displays / recipient scans; OTP to recipient; expressly authorized presenter may submit recipient-supplied code. Governed Manual; accepted final receipt. |
| Seller Delivery / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Same direction; no Courier pickup. Governed Manual; accepted final receipt. |
| Courier / PICKUP | Seller actor -> current assigned Courier | Seller displays / Courier scans; OTP to Courier. Governed Manual; custody only, no Buyer feedback Grant. |
| Courier / final DELIVERY | Current assigned Courier -> Buyer OR active authorized delegate | Courier displays / recipient scans; OTP to Buyer/delegate. Governed Manual; final receipt. |

At final acceptance re-read current recipient generation, assignment, verified payment, operational Order/stage and exact authority under owner locks. Delegates have receipt-only capability; no Buyer rights transfer.

![Current Handoff stage and recipient protocol](graphics/HND_01.svg)
*Figure 01. Current Handoff stage and recipient protocol. Recipient-directed OTP and Collection delegates; governed lockout recovery; connected final receipt.*

## 11. Verification Methods

QR, OTP and Manual Verification are adapters around one authoritative verification operation. QR is attempted first because it creates direct recipient participation with low friction. OTP exists for camera/app/device constraints. Manual Verification is last resort and requires Operator governance.

```
QR PRIMARY
  -> if unavailable / cannot scan
OTP FALLBACK
  -> if delivery fails / locked / exceptional
MANUAL VERIFICATION
  -> same Handoff domain decision
  -> immutable evidence
  -> Order application transition
```

All approved methods converge into the same canonical Handoff state. Valid final receipt through OTP or Manual remains eligible under current Reviews policy; method evidence remains distinguishable for Trust.

## 12. Presenter / Scanner Direction Rule

The party giving custody displays the QR. The party receiving custody scans it. This direction minimizes self-attestation and makes the receiving party perform the decisive action.

For QR, a presenter cannot verify their own displayed credential. For OTP, the presenter requests the code and the intended recipient receives it; after physical receipt, the recipient supplies or submits the code. The backend still verifies presenter and recipient identities/roles.

## 13. Buyer Collection Flow

PAID + READY_FOR_COLLECTION -> Seller meets Buyer or active authorized delegate -> Seller displays DELIVERY QR -> recipient scans -> backend validates exact current recipient/generation and stage -> one accepted final Handoff. OTP is sent to intended Buyer/delegate; recipient supplies code after possession; authorized Seller submission is explicit. No-app delegate uses the narrow supported OTP flow.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 14. Seller Delivery Flow

```
PAID -> PREPARING -> READY_FOR_DELIVERY
  -> Seller begins delivery
  -> Buyer or authorized delegate is present
  -> Seller generates final-delivery QR at the meeting
  -> Seller displays QR
  -> recipient scans
  -> server verifies intended recipient
  -> DELIVERY VERIFIED -> Order may complete
```

After accepted DELIVERY evidence commits, Order Management performs its own legal completion and Reviews independently creates one qualifying Buyer Grant from handoff.verified. A response must not claim Order COMPLETED before the Order owner has committed it.

## 15. Seller -> Courier Pickup Flow

```
PAID + READY_FOR_DELIVERY + valid Courier assignment
  -> Seller and assigned Courier meet
  -> Seller generates PICKUP QR
  -> Seller displays QR
  -> assigned Courier scans in Courier Mode
  -> server validates assignment + stage + actor + credential
  -> PICKUP VERIFIED
  -> custody becomes Courier
  -> safe OUT_FOR_DELIVERY milestone; optional foreground PICKUP checkpoint
```

A successful PICKUP never proves final Buyer receipt and never completes the Order.

This is Courier custody acquisition only. A verified PICKUP never establishes Buyer receipt, Order completion or Review Grant eligibility.

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

## 16. Courier -> Buyer / Delegate Delivery Flow

```
PICKUP VERIFIED / OUT_FOR_DELIVERY
  -> Courier reaches destination
  -> Buyer or authorized delegate is physically present
  -> Courier generates DELIVERY QR at the meeting
  -> Courier displays QR
  -> Buyer/delegate scans
  -> server verifies recipient + Courier assignment + stage
  -> DELIVERY VERIFIED
  -> Order may become COMPLETED
```

Superseding rule: the Courier displays the final-delivery QR and the Buyer/delegated recipient scans it. Earlier designs that made the Buyer display a QR for the Courier to scan are superseded.

After accepted DELIVERY evidence commits, Order Management performs its own legal completion and Reviews independently creates one qualifying Buyer Grant from handoff.verified. A response must not claim Order COMPLETED before the Order owner has committed it.

## 17. Delegated Recipient Feature

The Buyer may authorize a recipient for final Buyer Collection, Seller Delivery or Courier Delivery. Before issuing final-stage credentials, choose Receive by Someone Else and supply the bounded recipient name/phone under current authority; server binds one current authorization/generation to this exact Order/stage. Courier PICKUP remains assigned-Courier only. A recipient replacement revokes old credentials under the governed generation rules.

Delegation supplies narrow receipt capability only. It never transfers Buyer Order, payment, refund, Claim, Review, Chat or saved-method ownership. QR scanner or OTP destination is the intended recipient; authorized presenter may submit a recipient-supplied OTP only under the explicit matrix. No-app recipients may use the approved OTP/Manual paths.

Ordinary logical Notifications retain exactly one ordinary/Operator Account recipient. A no-Account delegate instead uses a narrow HANDOFF-owned external invitation transport intent on the existing SMS adapter. Bind authorization_id, generation, contact-purpose reference, expiry/revocation/suppression and durable dedupe/effect key; recheck current recipient generation immediately before dispatch. Message is minimal install/open/receipt context, no detailed Order or reusable secret. No dummy Account, phone-as-Buyer authority or extra Claim/refund/Review rights. Transport timeout may be ambiguous; reading/exactly-once global SMS delivery is never guaranteed.

## 18. Delegation Lifecycle

```
Buyer opens Order -> Receive by Someone Else
  -> enter recipient name + phone
  -> backend creates ACTIVE delegation
  -> Notifications sends app/deep-link invitation
  -> recipient installs/opens Adulis
  -> verifies the designated phone
  -> sees limited delegated-delivery card / QR scanner
  -> scans Seller/Courier QR at handoff
  -> delegation becomes USED after verified DELIVERY
```

The Buyer may revoke or replace the delegate while the final Handoff is still PENDING and before any final-delivery credential window is opened. The first final-delivery credential issuance locks the intended recipient for that meeting. A later recipient change requires the current credential to expire/revoke and the meeting flow to restart.

The first final credential window locks the intended recipient. A permitted replacement explicitly revokes the old authorization and incompatible QR/OTP, then restarts the current window under policy; it cannot silently retarget an issued credential.

![Narrow guest receipt capability and Handoff-owned SMS intent](graphics/HND_02.svg)
*Figure 02. Narrow guest receipt capability and Handoff-owned SMS intent. Existing SMS adapter carries the intent; transport timeout/read delivery and global exactly-once are not guaranteed.*

## 19. Delegation Privacy and Authorization

Buyer ordinary Account ownership is checked before creating, replacing or revoking the one active final recipient. Store protected recipient name and normalized E.164 phone; app use requires control of that designated phone. An invitation link alone cannot authorize scanning.

The delegate sees only a minimal delivery card needed to receive goods. Price, payment, private full Order, address editing, Buyer Chat and other Orders remain unavailable. Valid receipt leaves the Buyer as Order, Claim and Review Grant owner.

## 20. Co-Presence-Gated Credential Issuance

Neither QR nor OTP is issued hours before physical transfer. The presenter requests a credential only after the receiving party is present. This reduces screenshot forwarding, remote OTP social engineering and stale credential exposure.

QR is issued first. OTP is issued only if fallback is selected while the parties are together. The backend records meeting_started_at / credential_window_opened_at when the first credential is issued, snapshots the intended recipient, and prevents silent recipient swapping during that window.

## 21. QR Protocol Separation

Public navigation QR/deep links for Seller, Product Post and Scene Post support discovery. They use a distinct schema and parser from ADU-HANDOFF-2. A Product or Scene navigation QR cannot verify an Order. The verification endpoint accepts only the bounded, signed Handoff protocol and current recipient authority.

## 22. QR Token Payload

```
p = "ADU-HANDOFF-2"
pur = "PICKUP" | "DELIVERY"
m = opaque Market public reference
ord = opaque Order public reference
h = opaque Handoff reference
tid = random credential nonce
pres = presenter context class + bounded opaque reference
rec = intended recipient class + bounded opaque reference
asg = current Courier assignment public reference | null
del = delegated recipient authorization public reference | null
gen = credential generation
iat = issued-at server timestamp
exp = expires-at server timestamp
kid = signing key identifier
```

Opaque references map server-side to typed canonical rows. No raw Account or Operator Account ID, phone, name, address, Product details or payment details belongs in QR. Preserve fixed-order UTF-8 serialization, short TTL, generation binding and Ed25519 server integrity.

## 23. Signing and Key Management

Ed25519 remains the QR integrity primitive. The backend signs canonical token bytes; only server runtimes hold private signing material. Because verification is connected-only, Mobile does not maintain a public-key manifest or make local acceptance decisions.

Key states remain STAGED, ACTIVE, VERIFY_ONLY, REVOKED and RETIRED. Normal rotation permits old unexpired credentials to verify under server policy; compromise immediately revokes the key and all affected active credentials.

## 24. QR Issuance

```
Presenter authenticated
  -> POST generate QR
  -> server locks Handoff
  -> verify PAID / Ready / assignment / recipient / no active conflict
  -> create credential generation + random token id
  -> sign ADU-HANDOFF-2 payload
  -> persist claims + token digest + expiry + audit
  -> return QR rendering payload
  -> presenter displays
```

The raw reusable QR string is never written to ordinary logs or analytics.

Authenticate the actual ordinary presenter Account. Resolve current Seller permission or Courier assignment from server truth; a supplied presenter_actor_type is a request hint only. Removed members and revoked/reassigned Couriers cannot issue new credentials.

## 25. QR Verification

```
Recipient scans presenter QR
  -> app requires network
  -> POST token + authenticated recipient context
  -> server verifies signature / protocol / expiry
  -> lock credential + Handoff + relevant Order/assignment rows
  -> verify expected recipient or delegated-recipient authorization
  -> verify presenter / stage / Market / Order state
  -> consume credential atomically
  -> mark Handoff VERIFIED
  -> append evidence + outbox
  -> call Order application with verified Handoff fact
  -> return canonical success
```

Under the canonical lock, re-read the current ordinary Account relationship, Seller permission, exact Courier assignment or active Buyer/delegate recipient, active Market and normalized provider-paid eligibility. Revocation after token issuance denies verification; a valid signature alone is insufficient.

## 26. Expiry, Regeneration and Revocation

QR lifetime is short and configuration-driven. A new QR generation revokes the previous active generation for the same Handoff. There is no late acceptance of a revoked generation because the system is connected-only.

Revocation triggers include regeneration, Order cancellation, payment reversal that makes fulfilment ineligible, Courier reassignment, delegate replacement, Seller/Courier suspension and security incident. Credentials become unusable immediately after canonical revocation commits.

## 27. Anti-Replay and Concurrency

- Random credential IDs/nonces with high entropy.

- ACTIVE / USED / EXPIRED / REVOKED credential state.

- Exactly one successful Handoff verification.

- Purpose, Order, Market, presenter, recipient and assignment binding.

- Row lock / compare-and-set on verification.

- Unique accepted-evidence constraint per Handoff.

- Idempotency key for verification commands.

- Concurrent QR and OTP success race: first valid commit wins; later valid credential receives already-verified result.

- Duplicate network retry returns the existing accepted result rather than creating another custody event.

## 28. OTP Fallback Generation

OTP is a first-class fallback, not a second completion system. The presenter requests it only at the meeting after QR is unavailable or impractical. Pickup and Delivery OTPs are different purposes and can never verify each other.

Recommended initial OTP format is six digits with configurable short expiry (approximately ten minutes), resend cooldown and bounded incorrect attempts. The actual thresholds are configuration, not client constants.

## 29. OTP Delivery and Security

| Mode / stage | Presenter -> intended recipient | QR / OTP / Manual / transition |
| --- | --- | --- |
| Buyer Collection / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Seller displays / recipient scans; OTP to recipient; expressly authorized presenter may submit recipient-supplied code. Governed Manual; accepted final receipt. |
| Seller Delivery / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Same direction; no Courier pickup. Governed Manual; accepted final receipt. |
| Courier / PICKUP | Seller actor -> current assigned Courier | Seller displays / Courier scans; OTP to Courier. Governed Manual; custody only, no Buyer feedback Grant. |
| Courier / final DELIVERY | Current assigned Courier -> Buyer OR active authorized delegate | Courier displays / recipient scans; OTP to Buyer/delegate. Governed Manual; final receipt. |

OTP is recipient-directed; presenter never receives it merely because they present goods. Store keyed verifier only, current purpose/Handoff/generation, TTL and canonical attempts. Expressly authorized presenter submits recipient-supplied code or authorized recipient submits directly; do not reverse credentials into a Courier-to-Buyer shared login code.

## 30. OTP Verification Rules

Ordinary QR/OTP acceptance requires eligible PENDING Handoff and ACTIVE current-generation credential, paid operational Order, current presenter/recipient/assignment and canonical attempts. LOCKED rejects ordinary redemption; only governed connected Manual can accept under its explicit transition. Re-check all facts under locks before consuming once.

## 31. Manual Verification

Manual Verification is connected emergency recovery after QR and OTP cannot safely finish. It validates the exact Handoff, paid Order, presenter/recipient, current assignment and delegation and never overrides payment, Buyer ownership or assignment.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

Use current Operator Console governance. Founder review/approval separation applies unless a valid Solo Coverage Mode exception is active; staff operations use their configured approval policy. Handoff does not invent a new hierarchy or exception duration.

| Manual decision field | Required semantics |
| --- | --- |
| decided_by_operator_account_id | Typed FK to separate Operator Account, never an ordinary Account actor. |
| approval / reviewer references | Required current governance records and distinct approver where mandated. |
| handoff_id / order_id / method | Exact reviewed scope; method = MANUAL. |
| reason_code / evidence_case_ref | Structured reason and bounded supporting case/evidence. |
| decided_at / verified_at / policy_version | Server decision timestamp, accepted receipt timestamp and governing version. |

Authorized Manual supports PENDING -> VERIFIED and LOCKED -> VERIFIED only with current distinct Operator capability/governance, reason/evidence/audit and execution-time paid/stage/recipient/assignment checks. LOCKED is not a client bypass. Preserve failed-attempt history; do not revive expired/revoked old credentials.

## 32. Unified verifyHandoff Operation

```
verifyHandoff(input)
  1. authenticate actor / presenter or recipient
  2. resolve Handoff + Order + fulfilment + recipient authorization
  3. validate current state and stage
  4. validate QR | OTP | MANUAL evidence adapter
  5. lock canonical rows
  6. re-check all invariants
  7. mark Handoff VERIFIED exactly once
  8. persist immutable AcceptedHandoffEvidence
  9. consume/revoke sibling active credentials
 10. write transactional outbox event
 11. commit
 12. Order application evaluates legal transition
```

Return canonical Handoff VERIFIED and accepted evidence identity after its transaction. Order completion and Review Grant are independent idempotent consequences; if delayed, expose their current owner-reported state instead of inventing success.

## 33. Handoff State Machine

| Transition | Legal cause |
| --- | --- |
| PENDING -> VERIFIED | Valid current connected QR/OTP or governed Manual; one accepted stage. |
| PENDING -> LOCKED | Canonical attempt/risk limit reached; ordinary redemption stops. |
| LOCKED -> VERIFIED | Authorized connected Manual only; reason/evidence/approval/audit + current legality. |
| PENDING/LOCKED -> CANCELLED or REVOKED | Owner cancellation or assignment/recipient/security invalidation. |
| PENDING/LOCKED -> EXPIRED | Canonical window ends; not a receipt. |
| Expired/revoked replacement | Keep old record/evidence and invalidate old credentials; governed new eligible generation under lock, no history rewrite. |

VERIFIED evidence is immutable. Concurrent QR/OTP/Manual or recipient replacement is serialized; repeat acceptance returns the original permitted result.

![Current-generation receipt and governed lockout recovery](graphics/HND_03.svg)
*Figure 03. Current-generation receipt and governed lockout recovery. No ordinary lockout bypass, offline acceptance, GPS receipt proof or revival of old credentials.*

## 34. Credential State Machine

| Credential transition | Effect |
| --- | --- |
| ACTIVE -> USED | Exactly one successful verification. |
| ACTIVE -> EXPIRED | Server-controlled expiry reached. |
| ACTIVE -> REVOKED | Regenerate, reassign, replace recipient or cancel. |

Only ACTIVE credentials can be evaluated. A VERIFIED Handoff consumes the successful credential and revokes unused QR/OTP siblings in the same transaction. The PostgreSQL state and canonical attempt counters remain authoritative after Valkey loss.

## 35. Order Integration

Handoff commits accepted physical evidence and a durable handoff.verified fact without writing Order tables. Order Management re-reads paid state, fulfilment mode and accepted stage, then performs its legal transition through its own application service. PICKUP supports Courier custody only. Final DELIVERY may legally complete the Order.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

![One accepted Handoff event with explicit stage filters](graphics/HND_04.svg)
*Figure 04. One accepted Handoff event with explicit stage filters. No separate pickup/delivery event aliases; one feedback container survives multiple Claims and remedies.*

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 36. Courier Assignment and GPS

Fulfilment owns exact current Courier assignment. Reassignment invalidates former Courier-bound credentials; standing pool membership alone gives no Order access.

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

## 37. Payment Service Provider Boundary

Backend-verified provider facts alone establish payment, refund and settlement truth. Chapa is the first named Ethiopia provider only where the current Market route is enabled. Browser returns, screenshots, Seller confirmation and Chat statements cannot establish PAID. The current transaction charge is the server-calculated zero launch Adulis Buyer surcharge (0 bps), with exact currency rounding and an immutable Commercial Policy snapshot displayed before explicit confirmation. Paid Order, provider settlement and physical receipt are independent.

Handoff consumes only the owning domains’ normalized paid/eligible Order facts. No Chapa-specific field belongs in the Handoff schema. Only explicitly active Market policy may issue or verify live commerce Handoffs.

## 38. API Contract

Use REST/OpenAPI with @nestjs/swagger and generated TypeScript clients. Server resolves principal, relationship, Market and current stage; client actor labels never confer authority.

| Method / route | Operation and current authority |
| --- | --- |
| POST /v1/orders/:orderRef/delivery-recipient | Create/replace delegate; ordinary Buyer owns exact Order; recipient-lock and replacement rules. |
| DELETE /v1/orders/:orderRef/delivery-recipient | Revoke under Buyer ownership and current window policy. |
| GET /v1/me/delegated-deliveries | Minimal cards for active authorization and verified designated phone. |
| POST /v1/handoffs/:handoffRef/qr | Current Seller-scoped or assigned-Courier ordinary presenter at physical meeting. |
| POST /v1/handoffs/verify-qr | Current exact custody recipient: Buyer, authorized delegate or assigned Courier. |
| POST /v1/handoffs/:handoffRef/otp/request | Current stage presenter requests bounded recipient-directed OTP. |
| POST /v1/handoffs/:handoffRef/verify-otp | Authorized presenter submits recipient-supplied OTP after physical receipt, or permitted recipient flow; exact recipient binding remains checked. |
| GET /v1/orders/:orderRef/handoffs | Minimal status under current Buyer/Seller/Courier scope. |
| POST /v1/operator/handoffs/:handoffRef/manual-review | Separate OPERATOR session, current review capability and scoped case. |
| POST /v1/operator/handoffs/:handoffRef/manual-decision | Separate deciding Operator Account, capability, freshness and required governance. |

All mutations carry stable idempotency and correlation identity. Reassignment, membership removal, recipient revocation or Operator capability revocation blocks the next action.

## 39. Database Model

```
core.handoff
  id, public_ref, order_id, market_id, stage PICKUP|DELIVERY
  fulfilment_mode, presenter_principal_type ORDINARY_ACCOUNT
  presenter_ordinary_account_id FK accounts.account
  presenter_seller_id FK core.seller nullable
  presenter_courier_assignment_id FK fulfilment.delivery_assignment nullable
  intended_recipient_type BUYER|DELEGATE|COURIER
  buyer_account_id FK accounts.account nullable
  delegated_recipient_authorization_id FK core.delivery_recipient_authorization nullable
  recipient_courier_assignment_id FK fulfilment.delivery_assignment nullable
  status, meeting_started_at, verified_at, verification_method, policy_version

core.handoff_credential
  id, handoff_id, type QR|OTP, purpose, generation, token_id
  credential_digest, key_id nullable, recipient_binding_ref, presenter_binding_ref
  status ACTIVE|USED|EXPIRED|REVOKED, issued_at, expires_at, used_at
  attempt_count, max_attempts

core.delivery_recipient_authorization
  id, order_id, buyer_account_id FK accounts.account
  protected recipient_name, recipient_phone_e164
  accepted_ordinary_account_id FK accounts.account nullable, phone_verified_at
  status ACTIVE|REVOKED|USED|EXPIRED, created_at, revoked_at, used_at

core.handoff_evidence
  id, handoff_id, order_id, market_id, method QR|OTP|MANUAL
  presenter_ordinary_account_id FK accounts.account
  presenter_seller_id / presenter_courier_assignment_id typed nullable FKs
  recipient_class, recipient_buyer_account_id / recipient_delegate_authorization_id
  recipient_courier_assignment_id typed nullable FKs
  credential_id nullable, operator_case_id nullable
  decided_by_operator_account_id FK operators.operator_account nullable
  approval_reference / reviewer_reference nullable, reason_code, policy_version
  verified_at, request_id, minimized immutable evidence metadata
```

CHECK constraints enforce the stage-specific exactly-one actor relationship and recipient FK shape. A Seller presenter is an ordinary human acting for a Seller business; a Courier presenter is an ordinary human under a current assignment. Manual decision identity is a different privileged FK. Public payloads use opaque references, not these internal IDs.

The assignment target is fulfilment.delivery_assignment from FUL §53. Presenter and recipient columns remain distinct typed references to that one canonical assignment table; no generic courier_assignment_id or handoff_type column is introduced.

## 40. Constraints and Indexes

- Unique Handoff per Order + required stage/fulfilment identity.

- At most one accepted evidence row per Handoff.

- At most one ACTIVE delegated recipient authorization per Order.

- At most one active credential generation per Handoff/type where policy requires.

- Credential status transition checks and expiry >= issuance.

- Unique token_id / public_ref; no sequential public identifiers.

- Foreign keys to Order, assignment and Account where lifecycle semantics allow.

- Lookup indexes are table-owned and use the revised stage/presenter/recipient model; see the exact matrix and SQL below. Lookup speed never supplies current authorization or replaces uniqueness.

- PostgreSQL remains canonical; Valkey cannot enforce any of these invariants.

Add typed FK and CHECK backstops for presenter context, recipient class and Manual deciding Operator Account. Reviews owns UNIQUE(order_id, buyer_account_id); receipt evidence additionally has partial UNIQUE(final_handoff_id) WHERE final_handoff_id IS NOT NULL on its Grant; Handoff owns UNIQUE(handoff_id) accepted evidence. Duplicate facts and retries cannot multiply either effect.

| Owning table / index | Columns / predicate | Lookup or invariant |
| --- | --- | --- |
| core.handoff / handoff_order_stage_lookup | (order_id, stage) | Read the required custody or final stage; preserve existing Order/stage/fulfilment uniqueness. |
| core.handoff / handoff_presenter_assignment_status_lookup | (presenter_courier_assignment_id, status) WHERE presenter_courier_assignment_id IS NOT NULL | Assigned Courier acting as presenter at final DELIVERY; current assignment re-read still required. |
| core.handoff / handoff_recipient_assignment_status_lookup | (recipient_courier_assignment_id, status) WHERE recipient_courier_assignment_id IS NOT NULL | Assigned Courier acting as recipient at PICKUP; never substitute presenter role. |
| core.handoff_credential / handoff_credential_expiry_status_lookup | (expires_at, status) | Credential expiry work, not an absent Handoff expiry column. |
| core.delivery_recipient_authorization / delivery_recipient_order_status_lookup | (order_id, status) | Purpose-bound delegate lookup under current Buyer/Order authority. |
| core.delivery_recipient_authorization / delivery_recipient_one_active_order | UNIQUE(order_id) WHERE status = ACTIVE | At most one ACTIVE recipient authorization; revoked/used/expired history remains. |

```
CREATE INDEX handoff_order_stage_lookup
  ON core.handoff(order_id, stage);
CREATE INDEX handoff_presenter_assignment_status_lookup
  ON core.handoff(presenter_courier_assignment_id, status)
  WHERE presenter_courier_assignment_id IS NOT NULL;
CREATE INDEX handoff_recipient_assignment_status_lookup
  ON core.handoff(recipient_courier_assignment_id, status)
  WHERE recipient_courier_assignment_id IS NOT NULL;
CREATE INDEX handoff_credential_expiry_status_lookup
  ON core.handoff_credential(expires_at, status);
CREATE INDEX delivery_recipient_order_status_lookup
  ON core.delivery_recipient_authorization(order_id, status);
CREATE UNIQUE INDEX delivery_recipient_one_active_order
  ON core.delivery_recipient_authorization(order_id)
  WHERE status = 'ACTIVE';
```

## 41. Event Contracts

| Versioned event family | Committed fact / permitted consumers |
| --- | --- |
| handoff.created | Stage created; Order audit and Analytics. |
| handoff.delegate_created / handoff.delegate_revoked | Buyer authorization changed; credential invalidation, audit and Notifications. |
| handoff.qr_issued / handoff.otp_requested | Current presenter issued/requested purpose-bound credential; safe audit/metrics. |
| handoff.otp_sent / Notifications delivery fact | Provider accepted credential-directed send; safe audit/metrics only, never validity or receipt authority. |
| handoff.verification_failed | Structured failure category; no raw credential. |
| handoff.manual_review_requested | Governed emergency case opened; Operator Console. |
| handoff.verified | Immutable accepted receipt; independent Order, Reviews, Trust, Claims, Analytics and Notifications consumers. |
| handoff.revoked | Stage authority invalidated; authorized UI, audit and Notifications. |

Registry-approved versions carry handoff_id, order_id, market_id, stage PICKUP/DELIVERY, fulfilment_mode, verification_method, recipient_class BUYER/DELEGATE/COURIER, assignment reference when relevant, verified_at, safe correlation and typed actor attribution. Breaking actor/consumer semantics use a new registered version; immutable released events remain historical.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Business changes and required event_outbox and/or job_intent commit in the same PostgreSQL transaction. The shared Eventing relay leases durable intent, creates versioned event_delivery records from its consumer registry and deterministic BullMQ jobs after commit. BullMQ on Valkey is the sole ordinary background execution engine. Delivery is at-least-once; workers re-read current canonical scope/state and use PostgreSQL uniqueness and processed-effect markers. Repair, dead-letter review and bounded reconciliation recover outages; no correctness-sensitive PostgreSQL-to-Valkey dual write is allowed.

All exact Handoff facts and payload schemas are registered in Contract_Registry/event_contract_registry.json and event_payload_schemas.json. handoff.verified requires stage PICKUP/DELIVERY; Reviews’ receipt consumer accepts qualifying final DELIVERY only. No raw phone, OTP, QR token or coordinate appears in domain payloads. handoff.otp_sent is a Handoff-owned acknowledgement after the protected transport result, distinct from ordinary notification.delivery_recorded and never receipt authority.

## 42. Notifications and SMS

Notifications owns logical notices, recipient policy and delivery attempts for delegate invitations, credential-directed SMS and safe accepted/failure updates. Handoff owns validity and canonical attempts; SMS acceptance is not recipient proof.

Configured Ethiopia policy may use Afromessage with SMS Ethiopia backup. Twilio/Infobip or other future Market routes require explicit Market/provider activation through Notifications; no international route is implied launch-active. Failed delivery never creates receipt or resets expiry/attempts.

## 43. Security Threat Model

| Threat | Control |
| --- | --- |
| Screenshot/forwarded QR | short TTL; recipient identity binding; assignment/stage binding; single use |
| Remote OTP social engineering | co-presence issuance; explicit warning; short TTL; presenter binding; GPS support where available |
| Delegate invite forwarding | verified phone match required; invite token is not sufficient authority |
| Courier substitution | current assignment check on issuance and verification; revoke on reassignment |
| Seller self-attestation | presenter cannot verify own credential; expected recipient identity enforced |
| Cross-Order replay | Order/Handoff/purpose binding + consumed state |
| Brute-force OTP | keyed digest, bounded attempts, resend cooldown, throttling and lockout |
| Race QR vs OTP | transaction lock; unique accepted evidence; sibling revoke |
| Client fabricates paid/ready state | server resolves Order + Payment + Fulfilment facts |
| Operator abuse | RBAC, step-up, review/approval policy, append-only audit |
| Secret leakage in telemetry | redaction; no raw token/OTP/phone in ordinary logs or Analytics |

## 44. Mobile Security

- Expo Camera is only an input device; camera success is not Handoff success.

- Expo SecureStore holds session/device secrets, never canonical Handoff state.

- No Handoff SQLite queue or local acceptance path.

- TanStack Query cache is invalidated/refetched after verification; cached state is never authority.

- Sensitive screens avoid screenshots/previews where platform controls are available, but screenshot blocking is defense-in-depth only.

- QR/OTP values are excluded from crash breadcrumbs, analytics and Pino/Sentry payloads.

- Device compromise never exposes a server signing private key.

## 45. Delegated Recipient Security

- Buyer authentication/authorization is required to create, replace or revoke a delegate.

- Phone input is normalized with libphonenumber-js and validated against Market rules.

- Delegate app access requires authentication to the exact designated verified phone.

- Delegate cannot browse the Buyer Order beyond the minimal delegated-receipt projection.

- Delegate cannot create a Claim, request a refund, message the Seller as Buyer, leave a Review or change delivery instructions unless a future explicit policy adds it.

- OTP is sent only to the currently active designated phone and becomes unusable if delegation is revoked/replaced.

- Completion consumes the delegation so it cannot authorize a later Order.

## 46. Privacy and Evidence Retention

Handoff evidence is transaction/evidence data. Public display and evidence retention are separate. The Handoff domain follows centrally versioned Privacy/Claims retention policy and never hard-codes arbitrary retention days.

Delegate name/phone are personal data used for delivery authorization and communication. Minimize them after the purpose ends; preserve only the minimum evidence reference required by transaction/Claim policy. Active Claims, Moderation, legal or security holds override normal purge eligibility.

Raw OTP is not retained. QR raw token strings are not ordinary evidence storage. Keep canonical credential IDs/digests, decision facts, actor references, timestamps and policy versions needed to explain verification.

## 47. Trust, Reviews and Claims Integration

Trust alone owns NEW, REBUILDING, ESTABLISHED and TRUSTED and its policy-versioned consequences. Generic accepted receipt is separate from stronger QR promotion evidence: qualifying final Buyer/delegate QR receipt may count under Trust policy; OTP and Manual do not automatically receive QR credit. Upstream domains expose safe method/purpose facts and never set Trust levels or promotion math.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Claims may read immutable accepted pickup/final evidence, method, typed presenter reference, recipient class, delegated authorization, assignment, timestamps and bounded GPS under exact case purpose. No raw QR, OTP or signing material is exported. Acceptance proves recorded custody receipt, not correctness of every item, condition or description.

## 48. Analytics

Analytics receives only stage, method, success/reason category, attempt bucket, time to verify, delegate flag, fulfilment mode, Market and app version. Canonical accepted server evidence is distinct from client scanner behavior. Raw QR/OTP, phone, delegate name, exact address and Operator notes are excluded. Reviews emits its own Grant-created fact; Analytics never infers a Grant from Order completion.

## 49. Observability and Initial SLOs

Use Sentry for application exceptions with credential scrubbing, Pino for structured backend logs, pg_stat_statements for query diagnosis, Valkey/BullMQ health for throttling/jobs, and provider metrics for SMS delivery.

Initial engineering objectives should focus on verification availability and latency rather than public guarantees. Track p50/p95/p99 credential issuance and verify latency, OTP delivery lag/failure, invite delivery, delegate acceptance, replay/assignment mismatch, manual recovery rate, duplicate idempotent returns, and Order-transition lag after verified Handoff.

## 50. Failure Behavior

| Failure | Required behavior |
| --- | --- |
| No network | No issue/verify; show reconnect; no local pending success |

| Failure | Required behavior |
| --- | --- |
| QR expired/used/revoked | Reject; presenter may regenerate if Handoff still eligible |
| Wrong recipient account | Reject without exposing intended recipient details |
| Delegate phone mismatch | Reject; show invite/phone verification guidance |
| OTP incorrect | Increment canonical attempt; generic failure |
| OTP send provider failure | Retry approved provider path; do not weaken verification |
| Too many OTP attempts | LOCKED / Manual Verification path |
| Courier reassigned | Old credentials revoked; old Courier loses access |
| Payment/Order no longer eligible | Reject and revoke credential |
| Server accepted but client missed response | Idempotent retry returns existing VERIFIED result |
| Concurrent QR + OTP | one commits; other returns already verified |
| PostgreSQL unavailable | no canonical acceptance; retry after recovery |
| Valkey unavailable | canonical verification can continue where safe; rate-limit degradation handled conservatively |

| Mode / stage | Presenter -> intended recipient | QR / OTP / Manual / transition |
| --- | --- | --- |
| Buyer Collection / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Seller displays / recipient scans; OTP to recipient; expressly authorized presenter may submit recipient-supplied code. Governed Manual; accepted final receipt. |
| Seller Delivery / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Same direction; no Courier pickup. Governed Manual; accepted final receipt. |
| Courier / PICKUP | Seller actor -> current assigned Courier | Seller displays / Courier scans; OTP to Courier. Governed Manual; custody only, no Buyer feedback Grant. |
| Courier / final DELIVERY | Current assigned Courier -> Buyer OR active authorized delegate | Courier displays / recipient scans; OTP to Buyer/delegate. Governed Manual; final receipt. |

## 51. Error Taxonomy

Use stable, client-safe errors. Do not leak expected phone/name, internal IDs, SQL, signing key material or moderation reasons.

```
HANDOFF_NETWORK_REQUIRED
HANDOFF_PAYMENT_NOT_VERIFIED
HANDOFF_ORDER_STATE_INELIGIBLE
HANDOFF_WRONG_STAGE
HANDOFF_PRESENTER_INVALID
HANDOFF_RECIPIENT_INVALID
HANDOFF_RECIPIENT_LOCKED
HANDOFF_DELEGATE_REQUIRED
HANDOFF_DELEGATE_PHONE_MISMATCH
HANDOFF_DELEGATE_REVOKED
HANDOFF_ASSIGNMENT_MISMATCH
HANDOFF_CREDENTIAL_EXPIRED
HANDOFF_CREDENTIAL_REVOKED
HANDOFF_CREDENTIAL_USED
HANDOFF_SIGNATURE_INVALID
HANDOFF_OTP_INVALID
HANDOFF_OTP_LOCKED
HANDOFF_ALREADY_VERIFIED
HANDOFF_MANUAL_REVIEW_REQUIRED
HANDOFF_IDEMPOTENCY_CONFLICT
```

## 52. Testing Strategy

- Jest: state machines, policy resolvers, token canonicalization, OTP attempt rules, delegate lifecycle.

- Testcontainers: real PostgreSQL constraints/transactions, Valkey-assisted rate limits, outbox/idempotency.

- Maestro: Buyer/Seller Companion/Courier QR flows, delegated recipient install/invite/scan, OTP fallback.

- Playwright: Operator Manual Verification and founder/staff approval UX.

- k6: credential issue/verify bursts, resend abuse, concurrent redemption and notification pressure.

- Contract tests: generated OpenAPI clients and stable error semantics.

- Security tests: token tamper, cross-Order, cross-Market, wrong actor, wrong assignment, replay, invite forwarding and OTP brute force.

Validation/validate_handoff_indexes.py mechanically compares §39 model columns, table-owned index examples and the supplied SQL. PostgreSQL 17 binaries/server are unavailable here: SQL creation, negative inserts, query plans and migration/constraint concurrency were NOT EXECUTED.

## 53. Critical End-to-End Tests

• E2E-01 Buyer Collection: provider-paid Order -> ready -> Seller presents at meeting -> Buyer verifies DELIVERY -> legal Order completion -> exactly one Buyer Grant.

• E2E-02 Courier: current assignment -> Seller presents -> Courier verifies PICKUP with no Grant -> Courier presents -> Buyer verifies DELIVERY -> one Buyer Grant.

• E2E-03 Delegate app: Buyer authorizes normalized phone -> delegate verifies phone control -> assigned Courier presents -> delegate accepts final receipt -> Buyer Grant only.

• E2E-04 Delegate without usable app: presenter requests recipient-bound OTP at meeting -> designated phone receives it -> recipient shares after physical receipt -> connected canonical verification -> Buyer Grant.

• E2E-05 Seller Delivery to delegate: Seller-scoped presenter -> active delegate final receipt -> Buyer keeps all purchase rights.

• E2E-06 QR and OTP fail -> separate Operator Account reviews exact case under current governance -> approved connected Manual -> legal owner transitions.

### Required current identity, Reviews and Trust regressions

| Test | Expected result |
| --- | --- |
| HND-AUTH-01 | One ordinary Account can be Buyer here and Seller/Courier elsewhere without an identity conflict. |
| HND-AUTH-02 | Seller presenter needs a valid exact Seller relationship and Seller-scoped permission. |
| HND-AUTH-03 | Courier presenter/recipient requires the exact current assignment, not merely a profile. |
| HND-AUTH-04 | Removed Seller member cannot issue a new credential. |
| HND-AUTH-05 | Revoked Courier assignment cannot issue or verify. |
| HND-AUTH-06 | Ordinary Account cannot call privileged Manual decision. |
| HND-AUTH-07 | Separate Operator decides only with current capability, scope and required governance. |
| HND-REVIEW-01 | Verified Courier PICKUP creates no Grant. |
| HND-REVIEW-02 | Buyer Collection final DELIVERY creates exactly one Buyer Grant. |
| HND-REVIEW-03 | Seller Delivery final DELIVERY creates exactly one Buyer Grant. |
| HND-REVIEW-04 | Courier final DELIVERY creates exactly one Buyer Grant. |
| HND-REVIEW-05 | Delegate final receipt creates Buyer Grant and no delegate right. |
| HND-REVIEW-06 | Duplicate handoff.verified still produces one Grant. |
| HND-REVIEW-07 | order.completed replay never produces a second Grant. |
| HND-REVIEW-08 | QR final receipt qualifies under current Reviews conditions. |
| HND-REVIEW-09 | Valid OTP final receipt qualifies under current Reviews conditions. |
| HND-REVIEW-10 | Approved Manual final receipt qualifies while retaining method evidence. |
| HND-TRUST-01 | Handoff cannot directly write Trust state. |
| HND-TRUST-02 | Accepted verification method remains available as evidence. |
| HND-TRUST-03 | QR promotion evidence is distinguishable from OTP/Manual completion. |
| HND-TRUST-04 | Trust replay is idempotent under stable evidence identity. |

## 54. Concurrency, Abuse and Load Tests

- Same QR scanned simultaneously by two devices: exactly one accepted evidence row.

- QR and OTP verified simultaneously: exactly one successful Handoff.

- Buyer replaces delegate while Courier opens credential window: one transaction wins; no mixed recipient state.

- Courier reassignment during QR display: old credential becomes unusable.

- Duplicate provider-paid event cannot create duplicate Handoffs.

- Repeated OTP request/guess cannot bypass canonical attempt limits after Valkey restart.

- High burst of handoff completions does not block Order outbox or notification processing.

- Abuse test verifies no PII/credential leakage in Sentry/Pino/Analytics.

Required remaining SQL/application checks: stage/fulfilment duplicate, second accepted evidence, second ACTIVE delegate/credential, wrong Order assignment tuple, credential expiry before issue, ordinary Manual decider, presenter/recipient lookup distinction and stale authorization/generation during acceptance. Static field/index consistency is not a passed migration.

## 55. Current Technology Stack and Handoff Impact

| Layer | Current implementation and authority |
| --- | --- |
| API / runtime | Node.js; NestJS + Fastify; strict TypeScript; REST/OpenAPI with @nestjs/swagger and generated TypeScript clients; @nestjs/throttler, @fastify/helmet and libphonenumber-js. |
| Canonical data | PostgreSQL + Drizzle; pg_trgm, btree_gist and pg_stat_statements; owner repositories, typed FKs, legal transitions and transactional outbox/job_intent. |
| Async / coordination | BullMQ on Valkey as the sole ordinary background engine; committed PostgreSQL intent, deterministic execution IDs, current-state revalidation and database idempotency. |
| Media | Cloudflare R2 + CDN and Sharp for image processing. Restricted evidence bytes use private, purpose-bound access. Native video is deferred from the photo-first discovery baseline. |
| Mobile | React Native + Expo; Expo Router, TanStack Query, FlashList, Expo Image, SecureStore, SQLite, Camera, Notifications and Updates; small Zustand UI stores. SQLite never establishes offline commerce acceptance. |
| Quality / operations | Jest, Testcontainers, Maestro, Playwright and k6; Sentry, Pino and database query diagnostics; dependency-cruiser; Docker, GitHub Actions, Render, Cloudflare and EAS. |

The stack supports the preserved synchronous connected protocol; BullMQ handles only committed asynchronous consequences, deadlines and repair. Expo Camera scans; SecureStore protects sessions; SQLite does not queue offline Handoff acceptance.

## 56. Repository Architecture

```
adulis-platform/
  apps/
    api/src/modules/
      handoff/
        application/
        handoffs/
        credentials/
          q r /
          otp/
        delegated-recipient/
        manual-recovery/
        evidence/
        policy/
        events/
```

```
reads/
        integrations/
          orders/
          fulfilment/
          notifications/
    worker/src/jobs/handoff/
    mobile/src/features/handoff/
      buyer-receipt/
      delegated-receipt/
      seller-presenter/
      courier-pickup/
      courier-delivery/
    operator-console/src/features/handoff-recovery/
  packages/
    api-contracts/
    handoff-contract/
    permission-catalogue/
    analytics-events/
```

```
No handoff sync queue. No client key-manifest verifier. No duplicate completion logic in Mobile.
```

Typed ordinary and Operator principals enter distinct guards. Domain repositories remain private; Order, Reviews, Trust and Claims consume owner facts or typed readers rather than cross-writing Handoff tables.

## 57. MVP Scope

- Online-only QR issuance and verification.

- OTP fallback for PICKUP and DELIVERY.

- Manual Verification with current Operator governance.

- Buyer Collection, Seller Delivery and Courier Delivery.

- Two-stage Courier PICKUP + DELIVERY.

- Buyer-authorized delegated final recipient with name + phone.

- App invite and delegated QR scanner after phone authentication.

- SMS OTP path for delegated recipient when app/scanner cannot be used.

- Ed25519 QR integrity; single-use/replay protection; idempotency.

- Provider-paid Order prerequisite; Chapa abstracted behind Payments.

- Courier GPS as supporting evidence.

- Events, audit, Claims/Reviews/Trust integration, Privacy holds.

Current MVP uses the ordinary relationship model, separate Manual Operator Account, one Buyer-owned Grant per qualifying final DELIVERY, explicit active Market policy and canonical Scene Post navigation terminology.

## 58. Deferred Scope

- NFC/Bluetooth proximity proofs.

- Device attestation/device-signed receipt evidence.

- Dynamic rotating QR beyond short-lived regeneration.

- Biometric recipient proof.

- Multiple simultaneous delegates per Order.

- Delegate authority for Claims/refunds/Reviews/Chat.

- Partial parcel / multi-stop delivery Handoffs.

- Automated risk scoring that can complete/reject a Handoff without the defined verification path.

- Public Courier marketplace/bidding.

- Any disconnected verification or later sync model.

## 59. System Invariants

HND-INV-01 - A PICKUP credential can never verify DELIVERY.

HND-INV-02 - A DELIVERY credential can never verify PICKUP.

HND-INV-03 - Every successful verification requires current backend connectivity.

HND-INV-04 - Only a provider-confirmed paid/eligible Order may enter physical Handoff.

HND-INV-05 - The presenter displays QR; the custody recipient scans QR.

HND-INV-06 - Credentials are issued only after the presenter starts the physical meeting flow.

HND-INV-07 - A credential can successfully verify at most once.

HND-INV-08 - QR, OTP and Manual all converge into one Handoff state machine.

HND-INV-09 - Courier pickup requires the current assignment.

HND-INV-10 - Courier final delivery requires the current assigned Courier as presenter.

HND-INV-11 - Buyer Collection/Seller Delivery use Seller as presenter.

HND-INV-12 - Final delivery may be verified by Buyer or one active Buyer-authorized delegate.

HND-INV-13 - Delegation does not transfer Order ownership or financial rights.

HND-INV-14 - Delegate app verification requires control of the designated phone.

HND-INV-15 - Delegate replacement revokes prior recipient authority and active incompatible credentials.

HND-INV-16 - Once the final credential window is opened, intended recipient cannot silently change.

HND-INV-17 - OTP is purpose/order/handoff/recipient-bound, expiring, single-use and attempt-limited.

HND-INV-18 - Raw OTP is not stored in plaintext.

HND-INV-19 - Raw QR/OTP is excluded from ordinary logs and Analytics.

HND-INV-20 - Manual Verification identifies responsible Operator Account and governance decision.

HND-INV-21 - Manual Verification cannot establish payment success.

HND-INV-22 - GPS can support evidence but never prove receipt by itself.

HND-INV-23 - Order transition authority remains in Order Management.

HND-INV-24 - Historical accepted evidence is immutable.

HND-INV-25 - Cancellation/reassignment/security invalidation revokes active credentials.

HND-INV-26 - Duplicate network submissions are idempotent.

HND-INV-27 - Valkey loss cannot change Handoff truth or reset canonical OTP attempts.

HND-INV-28 - Mobile cache cannot authorize a Handoff.

HND-INV-29 - Public navigation QR cannot be interpreted as transaction evidence.

HND-INV-30 - Privacy/Claim holds are checked before evidence deletion.

• HND-INV-31 Buyer/Seller/Courier participation derives from ordinary Account plus acting relationship.

• HND-INV-32 Internal Manual authority requires a separate Operator Account.

• HND-INV-33 A qualifying final DELIVERY Handoff is the Review Grant anchor.

• HND-INV-34 PICKUP never creates Review eligibility.

• HND-INV-35 Delegate receipt creates no delegate Review right; the Buyer retains the Grant.

• HND-INV-36 order.completed cannot independently create a duplicate Review Grant.

• HND-INV-37 Handoff method is evidence; Trust owns method-specific promotion consequences.

• HND-INV-38 Scene/Product navigation QR is never Handoff evidence.

• HND-INV-39 Only explicitly active Markets may issue/verify live commerce Handoffs.

## 60. Canonical Write-Backs

Write back current typed presenter/recipient and separate Operator FKs, the stage/OTP/Manual generation matrix, one Order feedback identity across receipt and verified failure, method-specific Trust facts and secret-free Analytics. Handoff publishes accepted receipt only; Claims supplies failure evidence to Reviews without creating receipt.

## 61. Implementation Sequence

```
PHASE 0 - domain/schema foundation
  Handoff + Credential + Evidence + delegate authorization + constraints
PHASE 1 - paid/fulfilment integration
  PAID/Ready preconditions, assignment binding, Order command contract
PHASE 2 - QR online path
  ADU-HANDOFF-2 issuance, Seller/Courier display, Buyer/Courier scanner, replay safety
PHASE 3 - OTP fallback
  recipient routing, keyed digest, attempts/resends, Notifications integration
PHASE 4 - delegated recipient
  Buyer form, phone normalization, invite/deep link, limited recipient projection, scanner
PHASE 5 - Manual Verification
```

```
Operator review/approval, founder Solo Coverage integration, audit
PHASE 6 - integrations
  Reviews/Trust/Claims/Analytics/Privacy/Notifications
PHASE 7 - hardening
  E2E, concurrency, abuse, k6, incident runbooks, production gates
```

Introduce typed identity/schema constraints and scoped guards before new producer versions; migrate historical accepted evidence without changing receipt meaning. Deploy idempotent Reviews Grant consumer, then replay qualifying accepted final Handoffs under current migration policy with the same uniqueness boundary. No Order-completed backfill trigger creates a second Grant.

## 62. Production Launch Gate

[ ] Provider-confirmed paid fact is mandatory before Handoff issuance.

[ ] All issuance/verification routes fail closed without network/backend.

[ ] Presenter/scanner direction matches all three fulfilment modes.

[ ] Courier reassignment revokes old credentials immediately.

[ ] QR token tamper/replay/cross-Order/cross-stage tests pass.

[ ] OTP destination, attempts, expiry and lockout tests pass.

[ ] Buyer can create/revoke/replace delegate before final credential window.

[ ] Delegate phone-match and invite-forwarding negative tests pass.

[ ] Delegate without app can complete via authorized OTP fallback.

[ ] No delegate sees payment/provider/private Buyer data.

[ ] Concurrent QR/OTP cannot double-complete.

[ ] Order completes only from accepted final Handoff fact.

[ ] Manual Verification respects Operator governance and is audited.

[ ] Pino/Sentry/Analytics scrubbing contains no raw QR/OTP/phone.

[ ] Privacy/Data Lifecycle has delegation/evidence retention policy IDs.

[ ] Notification/SMS provider failure has visible retry/manual recovery path.

[ ] Maestro, Playwright, Testcontainers and k6 launch suite passes.

[ ] Final API/OpenAPI/generated clients and dependency-cruiser checks pass.

Release requires all HND-AUTH, HND-REVIEW and HND-TRUST cases above, typed FKs, privileged governance/audit, current Market gate, outbox/relay replay, Valkey-loss canonical attempts, QR/OTP/Manual final Grant equivalence and no retained active completed-Order-only Grant trigger.

## 63. Final System Architecture

![Revised Handoff model and table-owned indexes](graphics/HND_05.svg)
*Figure 05. Revised Handoff model and table-owned indexes. PostgreSQL 17 SQL is a synthetic reference fixture. Static consistency passed; database execution pending.*

Ordinary Buyer, Seller-scoped presenter, assigned Courier and authorized delegate reach connected Handoff services through typed guards. Separate Operator recovery reaches only governed Manual decisions. PostgreSQL preserves credentials, accepted evidence and shared outbox; Order, Reviews, Trust, Claims and Notifications remain independent owners.

## 64. Engineering Doctrine

The Handoff system is not a QR feature with backup codes. It is a physical-transfer evidence domain with multiple verification adapters.

The essential rule is simple: payment establishes that the commercial transaction is eligible; fulfilment establishes who should transfer custody; the presenter creates a short-lived proof at the physical meeting; the receiving party proves receipt; the Handoff domain accepts that evidence exactly once; and Order Management decides what legal transition follows.

Online authority is intentional. Removing disconnected synchronization eliminates ambiguous late evidence, client-clock trust and local pending completion states. The complexity that remains is spent on the risks that matter now: recipient identity, delegated receipt, Courier assignment, replay, social-engineering-resistant OTP fallback, Operator recovery and durable audit evidence.

### Appendix A - Updated Technology Placement

| Technology | Use in Handoff | Not authority for |
| --- | --- | --- |
| PostgreSQL + Drizzle | Handoff, credentials, delegation, evidence, idempotency, constraints | payment provider result, Trust policy |
| Valkey | rate-limit coordination, ephemeral coordination, BullMQ backing | accepted verification or OTP attempt truth |
| BullMQ | notifications, expiry cleanup, outbox follow-up, reconciliations | synchronous verification decision |
| Node crypto / Ed25519 | QR signing and server verification | recipient authorization by itself |
| Expo Camera | scan presenter QR | Handoff acceptance |
| Expo SecureStore | session/device secret storage | canonical Order/Handoff data |
| Expo Notifications + SMS providers | delegate invite / OTP delivery | credential validity |
| expo-location (foreground only) | Two optional foreground checkpoints | receipt proof |
| Sentry/Pino/pg_stat_statements | operations and diagnostics | audit evidence replacement |
| Testcontainers/Maestro/Playwright/k6 | production-like correctness and resilience testing | business policy |

### Appendix B - ADU-HANDOFF-2 Credential Contract

Canonical QR serialization uses fixed field order and UTF-8 encoding. The wire form may remain compact base64url payload + Ed25519 signature. Any breaking payload or verification semantic change increments protocol version.

```
adu-h2:<base64url(canonical-payload)>.<base64url(signature)>
```

```
Required verification order:
1. recognize protocol/version
2. parse bounded claims
3. resolve key id and verify signature
4. resolve credential/Handoff by opaque refs/token id
5. authenticate current actor
6. lock canonical rows
7. revalidate paid/fulfilment/assignment/recipient state
8. enforce expiry/revocation/use/attempt rules
9. accept exactly once
10. persist evidence + outbox
```

### Appendix C - Delegated Recipient Contract

```
Create / replace request
{
  "recipient_name": "...",
  "recipient_phone": "+251..."
}
```

```
Server derives:
  order_id / buyer_account_id
  normalized phone
  ACTIVE authorization id
  invite reference
  Market + policy version
```

```
Delegate capability allows only:
  - view minimal delegated-delivery card
  - scan current final-delivery QR
  - receive/submit final-delivery OTP
```

```
Delegate capability does NOT allow:
  - payment/refund access
  - Order ownership or edit
  - Claim/review as Buyer
  - Seller chat impersonation
  - delivery-address edits
  - other Orders
```

### Current identity and consumer contract

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Trust alone owns NEW, REBUILDING, ESTABLISHED and TRUSTED and its policy-versioned consequences. Generic accepted receipt is separate from stronger QR promotion evidence: qualifying final Buyer/delegate QR receipt may count under Trust policy; OTP and Manual do not automatically receive QR credit. Upstream domains expose safe method/purpose facts and never set Trust levels or promotion math.

The architecture is globally extensible with explicit phased Market activation. Ethiopia is the initial commerce Market, beginning with Addis Ababa. Future Markets require approved currency, provider, legal, commercial and operational readiness. Locale, IP address, phone prefix and client country never activate commerce.

## 65. Appendix - Stage, Recovery & Delegate Transport Contract

| Mode / stage | Presenter -> intended recipient | QR / OTP / Manual / transition |
| --- | --- | --- |
| Buyer Collection / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Seller displays / recipient scans; OTP to recipient; expressly authorized presenter may submit recipient-supplied code. Governed Manual; accepted final receipt. |
| Seller Delivery / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Same direction; no Courier pickup. Governed Manual; accepted final receipt. |
| Courier / PICKUP | Seller actor -> current assigned Courier | Seller displays / Courier scans; OTP to Courier. Governed Manual; custody only, no Buyer feedback Grant. |
| Courier / final DELIVERY | Current assigned Courier -> Buyer OR active authorized delegate | Courier displays / recipient scans; OTP to Buyer/delegate. Governed Manual; final receipt. |

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

Ordinary logical Notifications retain exactly one ordinary/Operator Account recipient. A no-Account delegate instead uses a narrow HANDOFF-owned external invitation transport intent on the existing SMS adapter. Bind authorization_id, generation, contact-purpose reference, expiry/revocation/suppression and durable dedupe/effect key; recheck current recipient generation immediately before dispatch. Message is minimal install/open/receipt context, no detailed Order or reusable secret. No dummy Account, phone-as-Buyer authority or extra Claim/refund/Review rights. Transport timeout may be ambiguous; reading/exactly-once global SMS delivery is never guaranteed.

| Recovery fixture | Expected specification outcome |
| --- | --- |
| LOCKED ordinary QR/OTP | Deny; preserve attempt history; no client bypass. |
| LOCKED authorized Manual | Current governed Operator reason/evidence/approval/audit; recheck then VERIFIED once. |
| Expired/revoked generation | Old credentials remain invalid; reviewed new eligible generation, original evidence retained. |
| Concurrent recipient replacement / redemption | Serialize current generation/assignment/payment/stage; one accepted effect; stale authorization rejected. |
| No-app Collection delegate | OTP sent to authorized delegate; narrow receipt capability; exact Buyer owns later feedback. |
| Location denied | Valid connected receipt still accepted; no GPS proof substitution. |

handoff.delegate_invitation is a registered Handoff job intent (intent_version), not an event_type or ordinary Notification. The closed protected payload contains authorization/contact-purpose references, stage, current generation, expires_at and durable effect identity. Current authorization/revocation/suppression is re-read immediately before dispatch; phone/OTP resolve only inside the existing protected adapter.

PostgreSQL 17 reference schema: Contract_Registry/handoff_schema_reference_pg17.sql defines the revised entities, exact lookup indexes, one Order/stage/fulfilment identity, one accepted evidence row, active credential-type uniqueness and at-most-one-ACTIVE delegate. Parent table stubs are synthetic fixture scaffolding only. Match current owner models during migration; current cross-row authority/generation/stage rules remain locked owner transactions, never cross-table CHECK functions.

## 66. Glossary

| Term | Meaning in this design |
| --- | --- |
| Ordinary Account | One human identity with Buyer, Seller and Courier acting relationships. |
| Operator Account | Separate internally provisioned privileged identity with current scoped capability. |
| Canonical owner | Domain whose legal command and PostgreSQL state establish the fact. |
| Market | Explicit activated commerce jurisdiction/configuration and effective version. |
| Scene Post | Photo merchandising/discovery content with separate publication and visibility. |
| event_outbox / job_intent | Required committed fact/effect intent persisted atomically with business truth. |
| BullMQ / Valkey | Ordinary async execution and non-canonical queue/cache infrastructure. |
| Presenter / recipient | Custody giver displays/requests proof; custody receiver scans/proves receipt. |
| Final DELIVERY | Accepted Buyer-facing physical receipt, distinct from Courier PICKUP. |
| Review Grant | One Buyer-owned eligibility/consumption per paid Seller Order; FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; delegate never owns it. |
