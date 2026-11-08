# Adulis Fulfilment & Courier Assignment
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R03, R04. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-FUL-01_Adulis_Fulfilment_Courier_Assignment_Complete_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Executive Summary

Adulis fulfilment launches with three fulfilment modes: Buyer Collection, Seller Delivery and Courier Delivery. Courier Delivery is now built around a persistent Courier role inside the Adulis Mobile App, seller-owned Private Courier Pools, and an MVP Cross-Seller Courier Network in which one independent Courier may be approved by multiple Sellers. The old one-off known-Courier model is superseded.

The current system is connected-only. Every assignment mutation, QR/OTP Handoff verification, payment fact, and checkpoint-location submission requires an Internet connection and authoritative server response. Device state is never an alternate source of business truth.

Courier Delivery becomes actionable only after the relevant Seller Order is provider-verified as PAID and the Seller marks it READY_FOR_DELIVERY. The Buyer pays the Product amount plus a Seller-defined delivery charge; the delivery charge represents the per-Order courier compensation for the current MVP. Payment provider integration owns collection/settlement mechanics, while Fulfilment owns the delivery commercial snapshot and execution context.

The system uses the current Handoff direction: Seller displays Pickup QR and assigned Courier scans; at final Courier delivery, the Courier displays the Delivery QR and the Buyer or authorized delegated recipient scans. OTP and audited Manual Verification remain fallback/recovery methods in one Handoff Verification state machine.

### CANONICAL MVP DIRECTION

Private Courier Pools + a shared Cross-Seller Courier Network are MVP. Open job marketplace, automatic dispatch, continuous/background GPS, route history, dynamic/surge delivery pricing, courier wallet and Adulis-operated courier payout infrastructure are not MVP.

## 2. Superseded Decisions

This current reconciliation supersedes the following assumptions from Fulfilment v1.0 and older cross-system documents:

• superseded pre-payment hold/direct-payment flows and any manual Seller payment-status authority;

• one Seller-invited known Courier as the only launch Courier model;

• background/continuous Courier tracking, route uploads, Buyer/Seller live map polling and location queues;

• disconnected Handoff acceptance or delayed synchronization;

• Buyer-displays/Courier-scans final delivery QR;

• absence of a Buyer-paid delivery charge in Courier Delivery;

• Courier assignment only through one Seller-specific invitation path.

## 3. Mission

Provide a secure, low-complexity physical fulfilment system that matches how small Sellers actually work: Couriers are independent actors who may serve many businesses; Sellers control who belongs to their private pools; Buyers see and pay the delivery charge before provider payment; and physical custody is verified through server-authoritative Handoff evidence.

## 4. Goals

• Keep Order, Payments, Fulfilment and Handoff as separate canonical domains with explicit contracts.

• Create one persistent Courier identity that can participate in many Seller Courier Pools.

• Allow Seller invitation and Courier application paths for pool membership.

• Expose the Seller-defined compensation per Order before a Courier joins a pool and on each delivery offer.

• Ensure the Buyer sees the delivery charge at Checkout before provider payment.

• Enforce one active accepted delivery per Courier in the MVP and at most one active Courier assignment per Seller Order.

• Keep Courier access assignment-scoped and minimize Buyer data before acceptance.

• Record only Pickup and final Handoff location snapshots; never use location as proof of custody.

• Use QR primary, OTP fallback and Manual Verification emergency recovery through one Handoff system.

• Support Buyer-authorized recipients for final Collection, Seller Delivery and Courier Delivery.

• Make every state-changing command idempotent, auditable and concurrency-safe.

## 5. Non-Goals

• Open per-job Courier marketplace or bidding beyond approved Seller pools.

• Automatic nearby-Courier matching, dispatch ranking or route optimization.

• Multi-stop batching, fleet management or traffic-aware ETA.

• Continuous/background Courier location collection or live route maps.

• Dynamic distance pricing, surge pricing or algorithmic delivery pricing.

• Courier wallet, Adulis balance, escrow or a general Courier payout ledger.

• GPS-based Order completion or geofence-as-proof.

• Advanced geospatial fraud ML or PostGIS-dependent Courier discovery.

• Turn-by-turn navigation inside Adulis.

## 6. Product Context

Adulis uses Product Posts and Scene Posts for discovery and structured commerce, but Fulfilment begins only after Checkout and provider-verified payment. A seller-specific Order is paid through the Payment provider adapter, then prepared by the Seller. Fulfilment does not interpret social content, Recommendation ranking or Product media.

Current Buyer commerce is multi-cart at the experience level but each Seller Order remains financially and operationally separate. Courier assignment, delivery charge, Handoff and Claims therefore attach to one Seller Order, not to the cross-Seller checkout container.

## 7. Domain Ownership

| Concern | Canonical owner | Fulfilment responsibility |
| --- | --- | --- |
| Order lifecycle / legal completion | Order Management | request allowed transition; never mutate Order tables directly |
| Provider payment / Buyer total / zero launch surcharge | Payments & Finance | consume PAID fact and delivery-charge snapshot; never establish payment success |
| Seller-defined courier compensation | Fulfilment + Order snapshot | own current Seller terms; snapshot exact amount into Seller Order/assignment context |
| Courier identity / pool relationship / availability | Fulfilment | own Courier profile, pool membership and job eligibility |
| Delivery request / offer / assignment | Fulfilment | own dispatch within approved pools and assignment state |
| Custody / receipt proof | Handoff Verification | supply participants/assignment context; consume verified Handoff fact |
| Checkpoint location evidence | Fulfilment | capture/store Pickup and Delivery snapshots only |
| Claims outcome | Claims | provide assignment, compensation, Handoff and location evidence |
| Authentication / Step-Up | Auth/AuthZ | consume actor/session context |
| Notifications | Notifications | publish canonical facts; Notification owns channel delivery |
| Retention / deletion / holds | Privacy | implement domain lifecycle contract and evidence holds |

## 8. High-Level System Context

Buyer Checkout/Payments owns the paid Seller Order and snapshots. Seller Console administers approved pools/terms; Companion operates Ready/request/Handoff workflows; Courier Mode applies, accepts and delivers. Canonical Fulfilment/Handoff/Order services cooperate through typed interfaces and PostgreSQL/outbox.

![One accepted Handoff event with explicit stage filters](graphics/FUL_01.svg)
*Figure 01. One accepted Handoff event with explicit stage filters. No separate pickup/delivery event aliases; one feedback container survives multiple Claims and remedies.*

## 9. Fulfilment Modes

Fulfilment mode is selected before payment and retained on the Seller Order. Later configuration affects future Orders only; any post-payment mode change requires an explicit authorized Order/Payments workflow.

| Mode | Physical path / final receipt | Commercial boundary |
| --- | --- | --- |
| BUYER_COLLECTION | Seller/authorized presenter displays final QR -> Buyer/delegate scans. | No Courier pool/compensation; paid + READY_FOR_COLLECTION. |
| SELLER_DELIVERY | Seller/authorized representative displays final QR -> Buyer/delegate scans. | Approved Seller-delivery policy, separate from Courier compensation. |
| COURIER_DELIVERY | Seller displays Pickup -> Courier scans; Courier displays Delivery -> Buyer/delegate scans. | Paid delivery charge = immutable compensation; approved pool, Ready gate and acceptance. |

## 10. Courier as a Primary Ordinary-Account Capability

Courier is a first-class Mobile mode under one ordinary Adulis Account and one persistent Courier profile. Many independent Seller Courier Pool relationships do not create duplicate identities or consume Seller-team membership. Operator is a separate internal privileged principal.

![Courier relationships / assignment capacity](graphics/FUL_02.svg)
*Figure 02. Courier relationships / assignment capacity. Persistent Courier identity can span Seller relationships while MVP allows one active accepted delivery.*

## 11. Courier Profile

| Field | Purpose |
| --- | --- |
| courier_id / account_id | persistent platform identity |
| full_name / verified_phone | identity and contact |
| profile_photo | Seller recognition |
| verification_status | UNVERIFIED / PENDING / VERIFIED / SUSPENDED / BLOCKED |
| vehicle_type | operational fit |
| service_areas | coarse operating areas, not real-time location |
| availability_status | AVAILABLE / BUSY / UNAVAILABLE |
| created_at / updated_at | audit and lifecycle |

Aggregate delivery history and Trust signals may be projected later, but one Seller must never receive another Seller's private notes, relationship state or order volume.

## 12. Courier Authentication and Verification

Current Adulis Seller/Courier platform verification has no Government-ID, national-ID, passport, selfie-to-ID or biometric-identity requirement or storage path. Use current ordinary Account/verified-phone control and approved social/business or Courier eligibility evidence. Provider-owned PSP KYC is separate. A future formal verification requirement needs a new explicit versioned product/privacy/jurisdictional/provider design.

Courier authentication belongs to ordinary Auth; Sellers approve relationships rather than an identity. Eligibility requires current Account/verified phone, eligible Courier profile/platform status and approved relevant Seller pool relationship. Platform suspension overrides all Seller approvals. VERIFIED means passed the current platform eligibility/verification policy, not Government ID verified; Fulfilment consumes the decision and does not own authentication evidence.

## 13. Seller Courier Pool

Each Seller has a private pool of Couriers who may receive that Seller's delivery requests. User-facing terms may be “Delivery Team”, “My Couriers” or “Approved Couriers”; the canonical engineering term is Seller Courier Pool.

## 14. Seller-Courier Relationship Model

| Field | Meaning |
| --- | --- |
| seller_id / courier_id | many-to-many relationship key |
| status | INVITED / APPLIED / APPROVED / REJECTED / SUSPENDED / REMOVED |
| source | SELLER_INVITATION or COURIER_APPLICATION |
| requested_at / approved_at / removed_at | relationship audit |
| terms_version_seen | Seller courier compensation/program terms visible at application/acceptance |

Seller A removing or suspending a Courier has no automatic effect on Seller B. Only a platform-level Courier suspension disables the Courier globally.

## 15. Pool Join Paths

Seller invitation targets an existing ordinary Courier Account/phone and requires Courier acceptance under current platform eligibility. Courier application starts only from an eligible declared/invited Seller pool opportunity with compensation/terms visible; Seller approves or rejects it.

No public staff-candidate or per-job bidding marketplace is introduced. Approved standing relationships remain separate from a later Order offer/assignment and private across Sellers.

![Two paths into a private approved Courier Pool](graphics/FUL_03.svg)
*Figure 03. Two paths into a private approved Courier Pool. Seller invitation and Courier application preserve current eligibility, transparent terms, mutual authorization and private Seller-specific relationship history.*

## 16. Cross-Seller Courier Network

One persistent ordinary Courier identity may have approved relationships with many private Seller pools. Relationship-specific status, notes and terms remain private to that Seller/Courier context. This is not open job bidding or automatic nearby-driver dispatch; only eligible declared/invited opportunities are visible.

Current MVP enforces exactly one maximum active accepted delivery per Courier and at most one active assignment per Seller Order. Multiple relationships never permit simultaneous jobs, batching or route optimization.

![Courier relationships / assignment capacity](graphics/FUL_04.svg)
*Figure 04. Courier relationships / assignment capacity. Persistent Courier identity can span Seller relationships while MVP allows one active accepted delivery.*

## 17. Seller Courier Compensation Configuration

Seller defines fixed current Courier compensation per Courier Delivery Seller Order before Checkout. Buyer-facing Courier Delivery charge equals that compensation snapshot. No distance/surge/bidding/weight engine is introduced.

| Field | Current rule |
| --- | --- |
| courier_compensation_minor | Fixed amount per Seller Order; captured before provider payment. |
| currency / market_id | Must match the Seller Order/current Seller Market. |
| applications_open | Whether permitted Couriers may apply to the pool. |
| service_area_summary | Coarse declared operating area; no live-location dispatch. |
| terms_version / effective_at | Future Checkout snapshots use the effective terms; paid Orders remain immutable. |

Owner/Admin configure pool/compensation in Seller Console. No Seller or Operator may increase or reduce the paid delivery charge/offer compensation. Later terms do not retroactively reprice existing paid Orders or accepted assignments.

## 18. Courier Visibility of Compensation

The per-Order compensation is visible to the Courier in two places: (1) when considering a Seller courier-team invitation/application opportunity, and (2) on every delivery offer. This lets Couriers decide which Seller pools they want to join and whether a particular paid delivery is worth accepting.

Seller compensation changes trigger an advisory notification to approved Couriers. Relationship membership may remain active; the Courier can still decline future offers.

## 19. Buyer Delivery Charge

Current Buyer-side Adulis Checkout surcharge is Zero launch Adulis surcharge: 0 bps / amount zero on eligible merchandise value. Courier Delivery charge is a separate line item excluded from that basis (delivery_included=false). Order/Payments/Commercial Policy calculate and snapshot the surcharge; this domain does not duplicate the calculation.

For current Courier Delivery, Buyer-facing Seller-defined delivery charge equals the immutable Courier compensation snapshot. Amount, currency and terms/policy versions are preserved on paid Seller Orders and offers; future Seller rate/configuration changes never rewrite historical amounts. Provider-authorized fees or tax/regulatory components apply only when explicitly approved and supported.

Buyer total = Product subtotal + Courier Delivery charge + merchandise-based Adulis surcharge + applicable provider-authorized fee + approved tax/regulatory component. Every amount is server-derived and presented before PSP payment.

Fulfilment supplies the delivery charge/terms snapshot and consumes the verified paid amount; financial domains own surcharge calculation and collection/settlement.

![Immutable launch-zero money and provider permission](graphics/FUL_05.svg)
*Figure 05. Immutable launch-zero money and provider permission. The inactive proposed future surcharge and provider-fee permission never activate by configuration alone.*

## 20. Payment Provider Integration

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

Target provider-managed Seller settlement requires confirmed merchant/capability evidence. Preserve supported fallback: delivery component is recorded with Seller proceeds/compensation obligation and Seller pays Courier under immutable terms/proof/exception process. No invented Courier payout API, wallet or automatic split routing. Actual direct split is disabled until confirmed.

## 21. Financial Snapshots and Evidence

| Snapshot | Owner/use |
| --- | --- |
| delivery_charge_minor | Order/Checkout financial snapshot shown to Buyer |
| courier_compensation_minor | Fulfilment commercial snapshot shown to Courier |
| courier_terms_version | proves which Seller rate applied |
| provider_attempt_ref | Payments-owned reference only; not Fulfilment authority |
| seller_order_ref | links one delivery to one Seller-specific Order |
| currency / market_id | prevents cross-market ambiguity |

For MVP Courier Delivery, delivery_charge_minor and courier_compensation_minor are equal. Future insurance, taxes, platform delivery service or payout fees may require a different breakdown; do not pre-model those as hidden current charges.

## 22. Courier Availability

Courier Mode exposes AVAILABLE, BUSY and UNAVAILABLE. UNAVAILABLE means “do not offer jobs” and does not mean the device itself lacks network connectivity. Availability is advisory plus policy; the server remains authoritative for offer eligibility.

## 23. MVP Active-Delivery Rule

Enforce a maximum of ONE active accepted delivery per Courier at a time. This is a launch simplification that prevents overcommitment before batching, capacity planning and routing exist. A Courier may belong to many Seller pools while still holding at most one active accepted delivery.

## 24. Order-to-Delivery Gate

Checkout -> provider attempt -> backend verifies PAID -> Seller notified -> preparation -> READY_FOR_DELIVERY -> approved Courier request/offer. Pending/ambiguous/failed/cancelled/refunded-ineligible payment or non-ready Order blocks request.

Mark Ready never requires assignment. Seller has no confirm-payment step; Courier acceptance follows Ready and approved direct/pool offers.

![Paid and Ready before Courier request](graphics/FUL_06.svg)
*Figure 06. Paid and Ready before Courier request. Immutable paid compensation flows into approved offers; atomic acceptance enforces one active accepted delivery before directional Handoffs.*

## 25. Courier Request Methods

| Method | Behavior |
| --- | --- |
| DIRECT_REQUEST | Seller chooses one APPROVED, AVAILABLE Courier; only that Courier receives the offer. |
| POOL_REQUEST | Seller chooses multiple APPROVED Couriers; first eligible successful acceptance wins atomically. |

The MVP does not automatically broadcast to unknown Couriers outside the Seller pool.

Seller creates a delivery request/offer context; Courier acceptance creates the assignment atomically. Permission seller.orders:courier_request never permits bypassing Courier acceptance, approval, availability or the paid Ready gate.

## 26. Delivery Offer Content

Before acceptance, expose only the information needed for a rational decision:

• Seller public identity and verification/Trust summary allowed by policy.

• Pickup area/landmark and delivery area, not unnecessary exact Buyer contact information.

• Package size/category summary.

• Exact Courier compensation for this Order and currency.

• Order public reference, offer expiry and any essential service instructions.

• Accept / Decline actions.

The public Seller Trust ladder is NEW, REBUILDING, ESTABLISHED and TRUSTED. REBUILDING applies after formerly stronger standing falls below Established requirements. Trust owns the calculation; this domain consumes approved eligibility/safe projections only. No Trust level imposes a Product listing cap and payment cannot buy Trust.

## 27. First-Accept Assignment Safety

Pool acceptance is atomic in the canonical PostgreSQL/domain transaction. Validate approved relationship, current Courier status/availability, paid Ready Order, offer scope/expiry and one-active capacity; exactly one eligible acceptance wins. Losing Courier gets DELIVERY_ALREADY_ASSIGNED and no Buyer-sensitive data. Queue/cache/client state never decides the winner.

![Exactly one valid acceptance wins](graphics/FUL_07.svg)
*Figure 07. Exactly one valid acceptance wins. Canonical PostgreSQL constraints enforce the Seller Order winner and Courier active-capacity limit; losers gain no Buyer-sensitive assignment data.*

## 28. Offer Expiration

Offers expire after a short configurable window. Expiration does not cancel the paid Order. The Seller may re-offer to other approved Couriers, create another pool request, switch to another permitted fulfilment path through the proper Order workflow, or initiate cancellation/refund if fulfilment is impossible.

## 29. Assignment State Machine

Normal operational states are CREATED, OFFERED, ASSIGNED, AT_PICKUP, IN_CUSTODY, DELIVERING and DELIVERED. Offer decline/expiry/lost race and legal pre-custody cancellation are recorded separately. After custody, failed attempt/return requires explicit custody-resolution evidence; no silent reassignment.

Physical custody/receipt follows accepted Handoff facts, not a freely editable assignment status. Location points never move custody or complete Order.

![Operational delivery states and custody recovery](graphics/FUL_08.svg)
*Figure 08. Operational delivery states and custody recovery. Normal states follow accepted Pickup/Delivery evidence; pre-custody cancellation and post-custody failure/return remain explicit audited paths.*

## 30. Cancellation and Reassignment

Cancellation records actor, reason, timestamp and responsibility evidence. Before custody, Seller/Courier cancellation can release the assignment. After custody, reassignment cannot silently transfer possession: physical return or another explicit custody-resolution workflow is required.

Reassignment revokes active Courier-bound Handoff credentials and ordinary sensitive access for the old Courier. A new assignment receives new credentials only after server authorization.

## 31. Courier Data Access Boundary

An OFFERED Courier sees a minimal decision projection. After ASSIGNED, the Courier gains only operational data required for that delivery. Terminal/reassigned assignments immediately remove ordinary Buyer contact and active delivery access. Open screens do not preserve authority; every API request rechecks assignment state.

## 32. Seller and Courier Authorization

All current business mutations require connectivity and canonical authorization. Seller permission permits requesting approved Courier service, not unilaterally manufacturing assignment or silently replacing a paid selected fulfilment mode.

| Actor / role | Authorized responsibility | Hard boundary |
| --- | --- | --- |
| OWNER / ADMIN | Console pool invitations/applications/relationships/compensation; operational requests where granted. | Current Seller/Market/order scope, fresh proof and current domain state. |
| INVENTORY | Prepare paid Order, Mark Ready, request approved direct/pool Courier and Seller Pickup. | Cannot administer standing pool membership without separate explicit permission. |
| SALES_SUPPORT | Read/support permitted Order/Courier status. | No preparation, Ready, request/assignment or Pickup mutation. |
| CAMPAIGN_MANAGER / ANALYST | Content/analytics responsibilities. | No Courier request/assignment mutation. |
| Courier | Accept eligible offer and execute assigned Pickup/Delivery actions. | Ordinary Account, eligible Courier profile, approved relationship, exact offer/assignment, one-active limit. |
| Buyer / delegate | Final receipt for the owned Order or explicit designated recipient. | Phone/Order/stage binding; delegate receives no ownership or financial rights. |
| Operator Account | Exceptional Manual/recovery through audited domain workflow. | Separate privileged principal, capability, case, fresh auth and approval policy. |

## 33. Canonical Courier Delivery Flow

Buyer selects Courier Delivery and pays snapshotted Product/surcharge/delivery amounts through PSP. Backend verifies PAID; Seller prepares and marks Ready; approved direct/pool offers carry the same paid compensation; atomic Courier acceptance creates the winning assignment.

Pickup: physically meet -> Seller displays Pickup QR -> assigned Courier scans -> connected Handoff verifies custody -> best-effort Pickup checkpoint. Final: physically meet -> Courier displays Delivery QR -> Buyer/delegate scans -> Handoff verifies receipt -> best-effort Delivery checkpoint -> Order evaluates completion. Location failure never blocks valid receipt or invents custody.

![Paid and Ready before Courier request](graphics/FUL_09.svg)
*Figure 09. Paid and Ready before Courier request. Immutable paid compensation flows into approved offers; atomic acceptance enforces one active accepted delivery before directional Handoffs.*

![Current Handoff stage and recipient protocol](graphics/FUL_10.svg)
*Figure 10. Current Handoff stage and recipient protocol. Recipient-directed OTP and Collection delegates; governed lockout recovery; connected final receipt.*

## 34. Pickup Handoff

Pickup is a Seller-to-Courier physical transfer. The QR is generated only when the Seller and assigned Courier have met. Seller displays; assigned Courier scans in Courier Mode. QR issuance/verification requires server connectivity and is bound to Order, Seller, Courier assignment, Market, Handoff stage and single-use credential identity.

If QR is unusable, the presenter may request a Pickup OTP under the Handoff policy. Manual Verification is an emergency recovery path only.

Consume canonical handoff.verified with stage = PICKUP and current assignment/generation re-read; custody does not grant a final-delivery Review.

## 35. Pickup Location Evidence

Immediately around successful Pickup verification, Courier Mode requests a single device location snapshot. Store coordinates only with accuracy, capture time, server receipt time/status and Order/assignment references. Failure to obtain location never rewrites a successful Handoff.

## 36. Final Delivery Handoff

For Courier Delivery, the Courier is the presenter at final delivery. When the Courier and Buyer/delegate have physically met, Courier Mode requests a short-lived Delivery QR, displays it, and the Buyer/delegate scans it. This direction supersedes older Buyer-displays/Courier-scans flows.

The server validates current assigned Courier, intended recipient, Order, Market, Handoff state, credential purpose, expiry, replay state and any active delegation before recording Delivery VERIFIED and asking Order Management to evaluate completion.

Consume the same canonical handoff.verified with stage = DELIVERY. Re-read accepted final evidence, current Order/assignment and recipient authority; preserve the separate verified-paid-Order-failure Review route.

## 37. Delegated Recipient - Receive by Someone Else

Before the Courier arrives and before final-delivery credential issuance, the Buyer may authorize one person to receive the package by entering name + phone number. This is a narrow receive-on-behalf authorization, not an Order ownership transfer.

```
Buyer -> Order -> Receive by Someone Else
 -> enter recipient name + phone
 -> recipient receives invite
 -> if Adulis is installed: verify designated phone -> limited delivery card -> scan Courier QR
 -> if app cannot be installed/used: Courier requests Delivery OTP
 -> OTP sent to designated recipient phone
 -> recipient confirms only after physical receipt
 -> Handoff verified as DELEGATED_RECIPIENT
```

The delegate does not gain refund rights, Claim ownership, Buyer Chat history, payment details, Reviews eligibility or account ownership. Buyer may revoke/replace the delegate before the final credential window begins; replacement revokes prior verification authority.

## 38. OTP Fallback

OTP is generated on demand at the physical meeting, not hours in advance. It is single-use, short-lived, purpose-bound, Order-bound, Handoff-bound and assignment/recipient-bound where applicable. Store only a secure hash; rate-limit generation, resend and failed attempts.

The message must clearly warn the recipient that using or sharing the code confirms physical receipt. The presenter can request the OTP, but no successful code may bypass current Order, Courier assignment or recipient authorization checks.

## 39. Manual Verification

Manual Verification is emergency recovery for legitimate cases where QR and OTP cannot complete. An authorized Operator reviews Order, paid state, Seller, assigned Courier, Buyer/delegate, previous attempts, checkpoint evidence and timestamps, then approves/rejects with explicit reason and case reference. Manual recovery never becomes an ordinary fulfilment shortcut.

Operator Account is a separate privileged internal security principal, independent of an ordinary Buyer/Seller/Courier Account. A person may possess both; their credentials, sessions, recovery, revocation and audit attribution remain separate. Ordinary Account registration, OTP, recovery or Seller roles never produce Operator authority.

Privileged internal provisioning creates the Operator Account and explicit least-privilege role/capability assignments. Strong phishing-resistant credentials, isolated OPERATOR sessions, fresh authorization, immediate revocation and audited domain workflows are required. Founder/Staff governance remains Operator-domain policy, and ADMIN does not create a restricted-evidence bypass.

Manual records operator_account_id, exact capability, reason, case, evidence, decision and timestamp. Required Founder/Staff approval is consumed through Operator governance; personal ordinary Account identity is never the acting principal.

## 40. Location Evidence Doctrine

Location is supporting transaction evidence, not authority. The MVP captures exactly two Courier Delivery checkpoints when available: PICKUP and DELIVERY. There is no route history, live movement map, periodic sampling, background location, or location-based assignment.

### LOCATION INVARIANT

A verified Handoff with location unavailable remains a verified Handoff. A location point without valid Handoff evidence never proves custody or delivery.

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

## 41. Checkpoint Location Model

| Field | Meaning |
| --- | --- |
| event_type | PICKUP or DELIVERY |
| latitude / longitude | device-provided coordinates |
| accuracy_meters | required when device provides it |
| captured_at_device | observation time |
| received_at_server | authoritative receipt time |
| status | CAPTURED / DENIED / UNAVAILABLE / TIMEOUT / LOW ACCURACY / ERROR |
| courier_id / seller_id / order_id / assignment_id | evidence binding |
| handoff_evidence_id | accepted Handoff reference when available |

## 42. No Continuous Tracking

The Courier app does not request background-location permission for this MVP. It does not emit location every N seconds, maintain a route polyline, expose Buyer/Seller tracking maps or queue route points for later transmission. `expo-location` is used only for foreground/on-demand checkpoint capture.

## 43. Location Failure and Privacy

Location denial, timeout or poor accuracy is recorded as a status and must not block legitimate QR/OTP receipt. Exact coordinates are sensitive: Seller sees only appropriate fulfilment evidence, Buyer receives completion status rather than raw Courier coordinates by default, and Operator access is purpose-bound/audited. Retention follows Privacy/Claims policy and is never indefinite by convenience.

Precise coordinates are purpose-limited restricted evidence, not casual Buyer/Seller map data. Operator Account access needs exact case/capability/reason and audit. Only policy-approved safe status is normally shown to Buyer/Seller. Capture denial/failure also never invalidates otherwise valid Manual Handoff.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 44. Buyer Collection

Buyer Collection remains a supported fulfilment mode. After PAID and READY_FOR_COLLECTION, Seller and Buyer meet. Seller presents a final-receipt credential and Buyer scans; OTP/Manual fallbacks use the same Handoff system. Courier pool/compensation logic is not involved.

An authorized name/phone delegate may complete final direct receipt under the same Order/Handoff-bound recipient policy. Delegation retains Buyer Claim/refund/Review ownership; there is no Courier Pickup stage in this mode.

| Mode / stage | Presenter -> intended recipient | QR / OTP / Manual / transition |
| --- | --- | --- |
| Buyer Collection / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Seller displays / recipient scans; OTP to recipient; expressly authorized presenter may submit recipient-supplied code. Governed Manual; accepted final receipt. |
| Seller Delivery / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Same direction; no Courier pickup. Governed Manual; accepted final receipt. |
| Courier / PICKUP | Seller actor -> current assigned Courier | Seller displays / Courier scans; OTP to Courier. Governed Manual; custody only, no Buyer feedback Grant. |
| Courier / final DELIVERY | Current assigned Courier -> Buyer OR active authorized delegate | Courier displays / recipient scans; OTP to Buyer/delegate. Governed Manual; final receipt. |

## 45. Seller Delivery

Seller Delivery remains separate from Courier Delivery. Seller or authorized Seller representative physically delivers. Final receipt follows presenter-displays/Buyer-or-delegate-scans. Seller Delivery pricing, if any, is configured by the applicable Seller/Checkout policy and must not be confused with Courier pool compensation.

## 46. Failed Delivery and Return to Seller

A failed delivery records a typed attempt such as BUYER_UNAVAILABLE, ADDRESS_UNCLEAR, ACCESS_BLOCKED, COURIER_ISSUE, SAFETY_CONCERN or OTHER. It does not automatically penalize Buyer or Courier. If custody must return to Seller, use an auditable return Handoff where practical before custody projection changes back to Seller.

## 47. Incident Attribution

Cancellation, failure and incident records retain who initiated the action, reason, timing, custody stage and available evidence. Accept-then-cancel is not automatically Courier fault; Trust consequences depend on attributable evidence.

## 48. Notification Model

Routine pool invitations, applications, offers, assignment changes and reminders use in-app/push notification through Expo Notifications. SMS supports approved phone verification, recovery/Step-Up, Handoff OTP and the narrow Handoff-owned guest-delegate invitation transport intent; no ordinary logical phone-only Notification is created. Notification delivery is advisory; clients always re-fetch canonical state.

Ordinary logical Notifications retain exactly one ordinary/Operator Account recipient. A no-Account delegate instead uses a narrow HANDOFF-owned external invitation transport intent on the existing SMS adapter. Bind authorization_id, generation, contact-purpose reference, expiry/revocation/suppression and durable dedupe/effect key; recheck current recipient generation immediately before dispatch. Message is minimal install/open/receipt context, no detailed Order or reusable secret. No dummy Account, phone-as-Buyer authority or extra Claim/refund/Review rights. Transport timeout may be ambiguous; reading/exactly-once global SMS delivery is never guaranteed.

## 49. Courier Mode UX

Courier Mode remains intentionally small: Home, Requests, Delivery, My Sellers and Profile. Core cards show availability, current assignment, pending offers, approved Seller pools, exact compensation on each offer, and completed-delivery history where policy permits.

```
NEW DELIVERY OFFER
Seller: ABC Fashion
Pickup area: Bole Atlas
Destination area: CMC
Package: Small
Courier compensation: ETB 220
Expires in: 02:34
```

```
[Accept Delivery]   [Decline]
```

## 50. Seller UX

Seller Console owns Courier Pool administration, compensation configuration, invitations, applications and relationship history. Seller Companion owns operational paid-Order actions: mark Ready, request Courier, view offers/assignment, display Pickup credential, handle failed-delivery/support actions and see completion evidence.

## 51. Courier Team Opportunity UX

A Courier considering a Seller team must see the Seller public identity, verification/Trust summary permitted by policy, current per-Order compensation, currency, service-area summary, vehicle requirements if configured, and application status. Do not expose Seller private order volume or another Courier's terms.

## 52. API Contract

| Method / route | Purpose |
| --- | --- |
| GET /v1/courier/profile | read current Courier profile |
| PATCH /v1/courier/availability | AVAILABLE/BUSY/UNAVAILABLE |
| GET /v1/courier/seller-opportunities | eligible/invited Seller pool opportunities with compensation |
| POST /v1/sellers/:sellerRef/couriers/apply | Courier applies to Seller pool |
| POST /v1/sellers/:sellerRef/couriers/invite | Seller invitation |
| POST /v1/sellers/:sellerRef/couriers/:courierRef/approve | approve relationship |
| POST /v1/sellers/:sellerRef/couriers/:courierRef/remove | remove/suspend relationship |
| PUT /v1/sellers/:sellerRef/courier-terms | set future per-Order compensation/program terms |
| POST /v1/orders/:orderRef/delivery-requests | create direct/pool request |
| POST /v1/delivery-offers/:offerRef/accept | atomic accept and assignment |
| POST /v1/delivery-offers/:offerRef/decline | decline offer |
| POST /v1/delivery-assignments/:ref/cancel | pre-custody cancel where legal |
| POST /v1/delivery-assignments/:ref/location-evidence | submit Pickup/Delivery checkpoint snapshot |
| GET /v1/courier/assignments/:ref | assignment-safe projection |

Handoff QR/OTP/delegated-recipient endpoints remain owned by ADU-HND-01 and are called through its public application/API contract rather than duplicated inside Fulfilment.

Requests require paid + Ready, approved eligible pool and current operational permission. Accept is Courier-owned and atomically enforces winner/capacity. The location-evidence route accepts only purpose-bound PICKUP or DELIVERY context, never periodic route points.

## 53. Core Database Model

| Table | Canonical purpose |
| --- | --- |
| fulfilment.courier_profile | persistent Courier capability and profile |
| fulfilment.seller_courier_terms | Seller Market-level per-Order compensation/program terms + version |
| fulfilment.seller_courier_relationship | many-to-many pool membership |
| fulfilment.courier_availability | current job-offer eligibility |
| fulfilment.delivery_request | one Seller Order delivery request |
| fulfilment.delivery_offer | one Courier-specific offer under a request |
| fulfilment.delivery_assignment | winning Courier + immutable compensation snapshot |
| fulfilment.delivery_attempt | failed/return operational attempts |
| fulfilment.location_evidence | PICKUP/DELIVERY location snapshots only |
| fulfilment.delivery_event | append-oriented operational audit/projection events |

fulfilment.delivery_assignment is the assignment FK target for Handoff §39. Handoff stores separate presenter_courier_assignment_id and recipient_courier_assignment_id roles; both resolve this canonical table, never a second courier_assignment table.

## 54. Recommended Key Fields

```
seller_courier_terms
  seller_id, market_id, compensation_minor, currency, applications_open, version, effective_at
```

```
delivery_assignment
  id, order_id, request_id, seller_id, courier_id, state, version
  compensation_minor_snapshot, currency, terms_version_snapshot
  accepted_at, pickup_handoff_ref, delivery_handoff_ref, completed_at
```

```
location_evidence
  id, assignment_id, order_id, courier_id, event_type(PICKUP|DELIVERY)
  latitude, longitude, accuracy_meters, status
  captured_at_device, received_at_server, handoff_evidence_ref
```

## 55. Constraints and Indexes

• Partial unique constraint: at most one active assignment per Seller Order.

• Partial/transactional guard: at most one active accepted delivery per Courier in MVP.

• Unique active seller_courier_relationship per (seller_id, courier_id).

• Currency/Market equality across Seller terms, Order and assignment snapshot.

• Offer acceptance uses row lock or conditional update; no client-only race control.

• Location event uniqueness prevents duplicate checkpoint effects for the same accepted Handoff.

• Compensation snapshot is immutable after paid Order/assignment creation.

• Indexes on Seller pool status, Courier availability, request state/expiry and Courier active assignment.

Handoff-owned assignment lookups use its separate presenter/recipient assignment + status indexes, as HND §40. They do not replace Fulfilment’s current-assignment/custody/capacity transaction checks.

## 56. RLS and Tenant Isolation

PostgreSQL RLS may reinforce Courier/Seller read boundaries on narrowly exposed projections, but application authorization remains mandatory. Seller A cannot query Seller B relationships. Courier X cannot substitute another assignment ID. RLS must never be treated as the only authorization layer.

## 57. Event Contracts

| Event | Typical consumers |
| --- | --- |
| courier.relationship.approved | Notifications / audit / Courier projection |
| courier.terms.updated | Notifications / Seller/Courier UI cache invalidation |
| delivery.request.created | Notifications / analytics |
| delivery.offer.accepted | Seller / Notifications / audit |
| delivery.assigned | Courier/Seller projections |
| handoff.verified [stage = PICKUP] | Fulfilment / Order / Claims / Trust |
| location.pickup.captured | Claims / audit |
| delivery.started | Notifications / analytics |
| handoff.verified [stage = DELIVERY] | Fulfilment / Order / Reviews / Trust |
| location.delivery.captured | Claims / audit |
| delivery.completed | Notifications / analytics / Trust |
| delivery.cancelled | Notifications / Claims / Trust attribution |

Use transactional outbox and at-least-once consumers with deterministic deduplication. Events carry stable references and facts, not QR/OTP secrets, full phone numbers or raw location unless a restricted evidence contract explicitly requires it.

The authoritative complete registry is Contract_Registry/event_contract_registry.json, linked by EVT §35; its local table is a consumer subset. PICKUP changes custody only. Qualifying final DELIVERY drives final fulfilment/Order completion and receipt-based Reviews; neither PICKUP nor delivery.started grants a Review. Historical released names retain meaning; these obsolete unreleased subscriptions are removed, not emitted as parallel aliases.

## 58. Order Integration

Order Management owns whether PAID, READY, OUT_FOR_DELIVERY and COMPLETED transitions are legal. Fulfilment submits typed facts such as assignment accepted, Pickup Handoff verified and Delivery Handoff verified. Duplicate events cannot transition an Order twice.

A source Scene becoming PRIVATE after purchase does not cancel/reprice/rewrite the paid Seller Order. Historical Scene attribution remains evidence; current fulfilment starts from canonical paid Order/selected mode.

## 59. Payments and Finance Integration

Payments supplies provider-verified PAID state plus immutable Buyer total/delivery-charge snapshot. Fulfilment never trusts a browser redirect, Seller action or Courier receipt as proof of money. Refund/cancellation paths remain financial-domain decisions and must reconcile the delivery charge according to policy.

## 60. Handoff Verification Integration

Fulfilment supplies expected Seller, Courier assignment, Buyer/delegate context, Market and stage. Handoff owns QR/OTP/Manual credential issuance, verification, replay protection, delegated-recipient authorization and accepted evidence. Fulfilment consumes only accepted Handoff facts.

PICKUP and DELIVERY consumers are independently registered filters on handoff.verified/event_version. A consumer effect is unique per logical_effect_id and consumer; duplicate or older facts cannot regress current custody/completion or create another feedback container.

## 61. Claims, Trust and Reviews

Claims may reference assignment history, compensation snapshot, delivery attempts, Handoff evidence and checkpoint location. Trust can consume attributed delivery outcomes but Fulfilment never directly changes Trust Level. Verified-purchase Review eligibility comes from canonical paid Order and final Handoff/completion state, not Courier self-report.

The public Seller Trust ladder is NEW, REBUILDING, ESTABLISHED and TRUSTED. REBUILDING applies after formerly stronger standing falls below Established requirements. Trust owns the calculation; this domain consumes approved eligibility/safe projections only. No Trust level imposes a Product listing cap and payment cannot buy Trust.

## 62. Security Threat Model

| Threat | Control |
| --- | --- |
| Courier reads another Seller Order | assignment-scoped APIs + application AuthZ + optional RLS + 404 semantics |
| Seller tries forced/unapproved Courier assignment | APPROVED relationship + current status/availability + paid Ready gate + Courier atomic acceptance |
| two Couriers accept one offer | atomic assignment transaction + unique active assignment |
| Seller changes pay after Buyer paid | immutable Order/assignment compensation snapshot |
| Courier scans wrong Pickup | Handoff assignment/order/purpose binding |
| delegate invite forwarded | phone-bound delegation + authenticated recipient checks |
| OTP guessed/social engineered | short expiry, attempt limits, warnings, actor/order/recipient binding |
| location spoofed | supporting evidence only; accuracy/risk flags; never proof |
| sensitive data retained after assignment | terminal access revocation + Privacy lifecycle |
| push spoof/stale | push is advisory; canonical state re-read |

## 63. Privacy Controls

• Minimize Buyer contact data before Courier acceptance.

• End ordinary Courier access to exact Buyer contact after terminal/reassigned state.

• Collect location only at Pickup/Delivery checkpoints and only for the active assignment.

• Never log QR/OTP secrets, raw phone numbers or raw coordinates in ordinary Pino/Sentry telemetry.

• No public tracking link or all-Courier operations map.

• Claim/legal/security holds are scoped to the relevant Order/assignment/evidence, not an entire Courier history.

• Delegated recipient name/phone are restricted delivery data and follow Privacy deletion/retention contracts.

## 64. Analytics

Analytics receives privacy-minimized events, not raw location or OTP/QR content. MVP metrics include Courier registrations/verification, Seller pools per Courier, Couriers per Seller, application approval, compensation distributions, offer acceptance/expiry, median acceptance time, accept-then-cancel attribution, Pickup/Delivery Handoff success, QR/OTP/Manual method rates, checkpoint-location capture status, failed deliveries and average Sellers served per active Courier.

## 65. Observability

Use Pino structured logs, Sentry errors/traces, `pg_stat_statements`, Valkey/BullMQ health and provider/Notification signals. Monitor assignment race conflicts, offer expiry lag, Handoff consequence lag, failed checkpoint capture, pool growth, compensation-snapshot mismatch, stale authorization, queue lag and database saturation. No raw coordinates or credential values in logs.

## 66. Failure Behavior

| Failure | Canonical behavior |
| --- | --- |
| Internet unavailable | block state-changing Fulfilment/Handoff action; show connection-required state; no local acceptance |
| PSP result ambiguous | do not request Courier; Payments reconciles until authoritative |
| Valkey unavailable | canonical PostgreSQL commands continue where safe; async/cache degrades, never changes authority |
| push not delivered | offer remains canonical; Courier can refresh Requests |
| accept race | one transaction wins; losers receive typed conflict |
| Seller/Courier meet but QR fails | request stage-specific OTP while connected; Manual only after normal methods fail |
| location denied/unavailable | Handoff can still succeed; record location status |
| Buyer absent | use Buyer-authorized delegate if configured or record failed attempt |
| Courier reassigned | revoke old access/credentials; new assignment required |
| PostgreSQL unavailable | no canonical mutation/verification; retry after service recovery |

## 67. Error Taxonomy

```
FULFILMENT_ORDER_NOT_PAID
FULFILMENT_ORDER_NOT_READY
COURIER_RELATIONSHIP_NOT_APPROVED
COURIER_PLATFORM_STATUS_INELIGIBLE
COURIER_NOT_AVAILABLE
COURIER_ACTIVE_DELIVERY_LIMIT
DELIVERY_OFFER_EXPIRED
DELIVERY_ALREADY_ASSIGNED
DELIVERY_ASSIGNMENT_VERSION_CONFLICT
COURIER_COMPENSATION_SNAPSHOT_MISMATCH
FULFILMENT_MARKET_MISMATCH
LOCATION_EVIDENCE_EVENT_INVALID
NETWORK_REQUIRED
POST_CUSTODY_CANCELLATION_REQUIRES_RECOVERY
```

## 68. Testing Strategy

• Unit: state transitions, compensation snapshots, eligibility, location-status classification.

• Database/Testcontainers: unique active assignment, one active delivery per Courier, relationship isolation, concurrency races, idempotency.

• API contract: generated client compatibility and stable errors.

• Maestro: Courier application/invite -> paid Order -> offer -> Pickup QR -> Delivery QR -> delegated recipient -> completion.

• Maestro: QR failure -> OTP fallback and connection-required behavior.

• Playwright: Seller Console pool terms, applications, compensation updates and operational request flows.

• Integration: provider PAID fact -> Seller Ready -> Fulfilment; Handoff accepted -> Fulfilment/Order consequence.

• Security-negative: IDOR, wrong Seller, wrong Courier, wrong Market, stale assignment, forwarded delegate invite.

• k6: offer fan-out/accept races and high request volume without unbounded DB scans.

## 69. Critical End-to-End Scenarios

| Scenario | Required result |
| --- | --- |
| Buyer pays Courier Delivery Order | server verifies PSP; delivery charge and compensation snapshot are immutable |
| Pool request to 3 Couriers | all see same compensation; exactly one can win acceptance |
| Pickup | Seller displays -> assigned Courier scans -> location snapshot best effort -> custody recorded |
| Final delivery | Courier displays -> Buyer scans -> location snapshot best effort -> completion evaluated |
| Delegated delivery | Buyer names/phones delegate -> phone-bound invite -> delegate scans Courier QR |
| Delegate cannot install app | Courier requests OTP -> designated phone receives code -> verified receipt |
| No network at meeting | no verification or local success; users must reconnect or use later support path |
| Seller changes compensation | new future Orders use new rate; paid Orders/offers keep old snapshot |

| Additional scenario | Expected result |
| --- | --- |
| Paid -> Ready -> direct request | Assignment not needed for Ready; only approved available Courier receives offer. |
| Courier accepts a second delivery | Rejected while an active accepted assignment exists, including another Seller pool. |
| Pickup/Delivery location denied | QR/OTP/Manual Handoff remains valid; capture status recorded. |
| Current verification | No Government-ID/passport/selfie dependency or storage path. |
| Surcharge basis | 0 bps on merchandise; delivery charge excluded and compensation equal to paid snapshot. |
| Support recovery | Separate Operator principal, capability/case/reason and appropriate approvals. |

## 70. Load and Capacity Model

MVP load is dominated by relationship lists, offer creation/fan-out, accept races, push consequences and two location writes per Courier-delivery Order. There is no high-frequency GPS ingestion stream. PostgreSQL indexing and transactional correctness matter more than geospatial scale. k6 should test realistic pool sizes and bursts such as many Sellers marking Orders ready at the same time.

## 71. Current Technology Placement

| Technology | Fulfilment responsibility |
| --- | --- |
| Node.js / NestJS / Fastify | Courier pool, request, offer, assignment and location-evidence APIs/application services |
| TypeScript strict | domain states/contracts and generated clients |
| Drizzle ORM | Fulfilment schema, migrations and domain-private repositories |
| PostgreSQL | canonical Courier relationships, terms, requests, offers, assignments, events and location evidence |
| pg_stat_statements | query/load diagnosis |
| pg_trgm | optional Seller/Courier management search; not job dispatch |
| btree_gist | platform baseline; use only for justified exclusion/range constraint |
| Valkey | non-canonical cache/rate coordination and BullMQ backend |
| BullMQ | offer expiry, notification consequences, reconciliation and bounded background work |
| REST/OpenAPI/@nestjs/swagger | typed platform API contracts |
| generated TypeScript client | Mobile/Seller/Operator clients |
| @nestjs/throttler | invite/application/offer/OTP-adjacent abuse limits |
| @fastify/helmet | HTTP security baseline |
| libphonenumber-js | Courier/delegate phone normalization where owning domain requires |
| React Native + Expo + Expo Router | Courier Mode and Buyer/Seller operational surfaces |
| TanStack Query | server state, requests/offers/assignment refresh |
| FlashList | bounded performant request/history lists where useful |
| Expo SecureStore | session/device sensitive material |
| Expo Camera | Handoff QR scanning |
| Expo Notifications | Courier offers and Seller operational pushes |
| Expo Updates / EAS | controlled mobile release |
| Expo Location | foreground/on-demand Pickup/Delivery location snapshot only |
| Expo SQLite | platform baseline only; no Fulfilment/Handoff business queue or disconnected authority |
| small Zustand store | ephemeral UI state only |
| Jest / Testcontainers / Maestro / Playwright / k6 | correctness, integration, mobile/web E2E and load |
| Sentry / Pino / pg_stat_statements | errors, structured logs and DB visibility |
| dependency-cruiser | domain boundary enforcement |
| Docker / GitHub Actions / Render / Cloudflare / EAS | build, backend/worker/web edge and mobile delivery |

`expo-task-manager` and `react-native-maps` are not Fulfilment MVP requirements because this design no longer performs background route collection or live tracking. External Google Maps/Apple Maps deep links may be used for navigation to structured pickup/destination locations.

## 72. Repository Architecture

```
adulis-platform/
  apps/
    api/src/modules/fulfilment/
      courier-profile/ seller-courier-pool/ courier-terms/
      delivery-request/ delivery-offer/ delivery-assignment/
      delivery-attempt/ location-evidence/ application/ api/
    worker/src/jobs/fulfilment/
      offer-expiry/ notification-consequence/ reconciliation/
    mobile/src/features/courier/
      home/ requests/ assignment/ sellers/ profile/
    mobile/src/features/handoff/       # Handoff public client integration
    seller-console/                    # pool admin + compensation terms
    operator-console/                  # support/evidence views
  packages/
    api-contracts/ permission-catalogue/ money/ dates/ handoff-contract/
```

```
adulis-web/ remains the separate Company Website repository.
```

Shared packages expose contracts/types only. No frontend imports backend repositories or database credentials.

## 73. MVP Scope - Phase 1: Private Courier Pools

• Courier role/profile and verification status.

• Seller Courier Pool, invitations and Courier applications.

• Seller-set per-Order compensation and Courier-visible team terms.

• Courier availability and one-active-delivery rule.

• Direct and selected-pool delivery offers with push notification.

• Atomic assignment and assignment-safe data access.

• Seller->Courier Pickup Handoff using QR/OTP/Manual methods.

• Courier->Buyer/delegate Delivery Handoff using presenter-displays/recipient-scans.

• Pickup and Delivery location snapshots only.

• Buyer-paid delivery charge through PSP-integrated Checkout.

• Failure/return, Claims, Privacy and audit integration.

• Current platform Courier verification excludes Government-ID/selfie/biometric evidence.

• Seller request permission operates approved pool; Courier acceptance establishes assignment.

## 74. MVP Scope - Phase 2: Cross-Seller Courier Network

• One global Courier identity across many Seller pools.

• Shared platform verification/history with Seller-specific relationship privacy.

• Courier can evaluate Seller team opportunities/invitations using compensation and service-area information.

• Seller-specific approval/suspension/removal.

• Platform-level Courier suspension across all relationships.

• Metrics for average Sellers served per active Courier and network formation.

## 75. Deferred Evolution

• Broad proximity/reputation-based Courier discovery beyond Seller-declared team opportunities.

• Open per-job Courier marketplace and bidding.

• Intelligent dispatch/recommendation.

• Multiple simultaneous deliveries, batching and route optimization.

• Continuous/background location and live maps only if a later explicit product decision reintroduces them.

• Dynamic/surge pricing, insurance/collateral and dedicated logistics fleet management.

• Courier wallet, earnings dashboard and Adulis-operated payout system.

• Standalone Creator actor-specific pools/permissions remain unapproved future scope; a creator selling legitimately uses ordinary Seller fulfilment.

## 76. System Invariants

```
FUL-INV-001  Order state is owned by Order, not Fulfilment.
FUL-INV-002  PSP/server verification establishes PAID; Seller/Courier never do.
FUL-INV-003  One Courier has one persistent Adulis identity.
FUL-INV-004  Seller-Courier relationship is many-to-many and Seller-scoped.
FUL-INV-005  Seller controls its own private Courier Pool.
FUL-INV-006  Buyer pays the snapshotted Courier Delivery charge before Courier request.
FUL-INV-007  Courier compensation shown on offer equals the paid Order snapshot.
FUL-INV-008  Seller rate changes never rewrite paid Orders/accepted assignments.
FUL-INV-009  At most one active Courier assignment exists per Seller Order.
FUL-INV-010  MVP enforces a maximum of one active accepted delivery per Courier.
FUL-INV-011  Courier access is assignment-scoped and state-rechecked.
FUL-INV-012  Pickup: Seller displays, assigned Courier scans.
FUL-INV-013  Final Courier delivery: Courier displays, Buyer/delegate scans.
FUL-INV-014  QR, OTP and Manual converge on one Handoff state machine.
FUL-INV-015  Credentials are issued/verified only with Internet/server authority.
FUL-INV-016  Delegation never transfers Buyer ownership/financial rights.
FUL-INV-017  Location is supporting evidence only.
FUL-INV-018  Only Pickup and Delivery checkpoint location is collected in MVP.
FUL-INV-019  No route history/background location/live tracking exists in MVP.
FUL-INV-020  Location failure cannot invalidate an otherwise verified Handoff.
FUL-INV-021  No Courier wallet/payout balance exists in Fulfilment MVP.
FUL-INV-022  Push notifications are advisory; canonical state is re-read.
FUL-INV-023  Assignment history and Handoff evidence are auditable and not overwritten.
FUL-INV-024  All state-changing commands are idempotent/concurrency-safe.
FUL-INV-025  Cross-Seller Courier network never exposes private Seller relationship data.
```

FUL-INV-026 Current Courier platform verification requires no Government ID.

FUL-INV-027 Seller request/offer never bypasses Courier acceptance or paid Ready gates.

FUL-INV-028 Current zero-bps Buyer surcharge excludes Courier charge; Fulfilment does not calculate it.

FUL-INV-029 Manual support attributes the separate privileged Operator Account.

## 77. Canonical Write-Backs

Linked designs must consume the same current contracts: Scene -> Product -> Seller-specific PSP-paid Order; immutable Courier charge/compensation; zero-bps merchandise surcharge excluding delivery; paid Ready before direct/pool requests; atomic accepted assignment; presenter-displays/recipient-scans Handoff; final name/phone delegation; Pickup/Delivery checkpoints only.

Auth supplies ordinary Courier eligibility and semantic Seller request permissions; Operator Auth supplies separate privileged Manual/recovery principal/capability. Notifications, Analytics, Trust, Claims and Privacy consume purpose-limited canonical events without private relationship leakage or raw general-coordinate telemetry.

## 78. Implementation Sequence

| Phase | Build | Exit criterion |
| --- | --- | --- |
| 0 - Contracts | Order/Payments/Handoff public interfaces; permissions; enums | No private cross-domain repository imports |
| 1 - Courier identity | Courier role/profile/verification/availability | One global Courier identity works |
| 2 - Pools & terms | relationships, invite/apply, compensation versioning | Courier can join Seller pool with visible terms |
| 3 - Checkout integration | delivery-charge snapshot + PAID gate | Buyer total/provider facts reconcile |
| 4 - Requests/offers | direct/pool requests, push, atomic acceptance | One assignment winner; compensation shown exactly |
| 5 - Pickup | Seller QR -> Courier scan; checkpoint location | Custody verified online |
| 6 - Final delivery | Courier QR -> Buyer/delegate scan; OTP/Manual | Receipt verified online |
| 7 - Operations | failure/return, Claims, Privacy, audit | Exceptional paths are safe |
| 8 - Hardening | security, E2E, concurrency, k6, observability | Production gates pass |

## 79. Production Launch Gate

• No pre-payment hold/old payment-confirmation logic remains in Fulfilment flows.

• Buyer sees Courier Delivery charge before provider payment and server snapshots it.

• Courier sees exact compensation before joining/accepting relevant work.

• No paid Order can be silently repriced after payment.

• Pool accept race and one-active-delivery constraints pass concurrency tests.

• Courier cannot access another Seller/assignment or retain terminal Buyer-sensitive data.

• Pickup and Delivery Handoff directions match current ADU-HND-01 v2 protocol.

• Delegated recipient name/phone flow and OTP fallback pass security/E2E tests.

• No disconnected acceptance, delayed synchronization or local business queue exists.

• No background/continuous location permission, route upload or live tracking endpoint exists.

• Location failures are non-blocking and privacy/retention controls are configured.

• Pino/Sentry scrub credentials, phone details and coordinates.

• Valkey/BullMQ outages cannot create alternate business truth.

• Jest/Testcontainers/Maestro/Playwright/k6 and dependency-cruiser gates pass.

• Current Seller/Courier verification has no Government-ID/selfie dependency; VERIFIED means current eligibility policy.

• Separate Operator Account Manual authorization, four-level Seller Trust projection, semantic Courier request/acceptance and delivery-excluded zero-bps launch surcharge snapshots pass cross-system checks.

• Paid -> prepare -> Ready -> offer order is enforced; Mark Ready never waits for assignment.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 80. Final System Architecture

Courier identity/relationships, Seller-owned terms, immutable Order snapshots, atomic request/acceptance and connected directional Handoff retain their current domain boundaries. Location is only best-effort support.

![One accepted Handoff event with explicit stage filters](graphics/FUL_11.svg)
*Figure 11. One accepted Handoff event with explicit stage filters. No separate pickup/delivery event aliases; one feedback container survives multiple Claims and remedies.*

![Paid and Ready before Courier request](graphics/FUL_12.svg)
*Figure 12. Paid and Ready before Courier request. Immutable paid compensation flows into approved offers; atomic acceptance enforces one active accepted delivery before directional Handoffs.*

![Two bounded evidence checkpoints](graphics/FUL_13.svg)
*Figure 13. Two bounded evidence checkpoints. Foreground attempts at Pickup and Delivery support evidence; valid connected Handoff is independent of location availability.*

## 81. Engineering Doctrine

Fulfilment coordinates people, custody and execution without becoming Order, Payments, Trust, Content or a GPS platform. Seller decides approved pool/terms; Buyer pays the immutable delivery charge; Courier evaluates transparent compensation and accepts; Handoff proves physical transfer; exactly two foreground checkpoints add non-blocking evidence.

This reconciliation preserves the current Private Pools/Cross-Seller Network architecture and adds current Scene terminology, no-Government-ID eligibility, separate Operator principal, four-level Seller Trust, semantic request authorization and closed merchandise-surcharge basis. The former one-off Courier, continuous GPS, Buyer-displayed final QR and Seller-confirmed payment assumptions remain superseded.

## 82. Glossary

| Term | Definition |
| --- | --- |
| Courier | Ordinary-Account delivery capability with one persistent profile. |
| Courier Profile | Platform operational identity/eligibility, not Government-ID evidence. |
| Seller Courier Pool | Seller-controlled approved relationships and private standing/terms. |
| Cross-Seller Courier Network | One Courier identity across many private pools; no open job bidding. |
| Seller-Courier Relationship | Scoped invite/application/approval/suspension/removal record. |
| Courier Availability | AVAILABLE/BUSY/UNAVAILABLE plus current server eligibility. |
| Courier Compensation | Immutable offer/Order amount equal to paid delivery charge in MVP. |
| Courier Delivery Charge | Seller-defined Buyer checkout line, separate from merchandise surcharge. |
| Delivery Request | Seller request for one paid Ready Order through approved pool. |
| Delivery Offer | Courier-specific eligible opportunity with exact compensation and expiry. |
| Delivery Assignment | Atomic acceptance winner with one active Courier/Order capacity. |
| Direct Request | One approved available Courier receives the offer. |
| Pool Request | Selected eligible approved Couriers compete; first valid acceptance wins. |
| One Active Delivery | Maximum one accepted active delivery per Courier in current MVP. |
| Pickup Handoff | Seller displays Pickup credential; assigned Courier scans online. |
| Delivery Handoff | Courier displays Delivery credential; Buyer/delegate scans online. |
| Delegated Recipient | One Buyer-authorized name/phone recipient with final receipt only. |
| Checkpoint Location Evidence | Two best-effort foreground Pickup/Delivery points, never custody proof. |
| Scene Post | Discovery content attribution; privacy changes do not rewrite paid Orders. |
| Product Post | Canonical commercial Product destination before Checkout. |
| Manual Verification | Audited emergency Handoff recovery through separate Operator principal. |
| Transactional Outbox | Durable consequences committed with Fulfilment state. |
| Shoppable Post | Superseded former term for Scene Post. |

## 83. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-14 — Courier compensation source and immutable Order snapshot | The 13 October Fulfilment/Order/Finance designs already treat delivery charge as Seller-defined, shown before payment and snapshotted on the Order. | There is no per-Courier-relationship compensation schedule in the current MVP. One Seller-level Courier Delivery term applies to future Checkout quotes. Once the Buyer accepts/pays, the Order’s Courier Delivery/compensation amount is immutable history. Delivery Offers, Seller selection surfaces and Courier Mode display the Order snapshot. Changing Seller terms affects future quotes only. | PR-008 correction, 27 Oct 2026 |
| R-15 — Courier offer eligibility and sequence | The 13 October designs already require Courier acceptance and one active accepted delivery. | A direct Delivery Offer may be sent only to a Courier who is in the Seller’s Approved pool relationship, Adulis-verified, AVAILABLE and has no active accepted delivery. BUSY Couriers may remain visible for context but are disabled with reason. UNAVAILABLE, restricted, pending, removed or non-approved Couriers are ineligible. Seller request/offer never equals assignment; Courier acceptance atomically rechecks eligibility/capacity. Mark Ready precedes offer. Offer timing must respect the one-active-delivery rule. | PR-008 correction, 27 Oct 2026 |
| R-20 — Courier MOBILE API/auth contract correction | ADU-AUTH-02 v3.2 and ADU-MOB-02 v4.2 already define Courier as a third ordinary Mobile mode using the ordinary MOBILE session. | Executable API/auth contracts must be corrected to match the design: Courier uses audience=MOBILE with backend-verified Courier relationship/capability, exact resource scope and permission surface. Do not move Courier back to Console/cookie auth to match stale implementation contracts. Until the corrected contract is published, production Mobile must not fabricate Courier API calls. | WO-001 discovery + October 13 AUTH/MOB authority |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.

### Open / deferred items

• Courier MOBILE executable contract and mode-eligibility/bootstrap projection remain implementation-contract gaps; the product/system design remains one MOBILE session with Courier as an authorized relationship context.
