# Adulis Reviews & Ratings
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-REV-01_Adulis_Reviews_Ratings_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Mission

Reviews converts a verified paid Seller Order into one Buyer-owned feedback container from accepted final receipt or an upheld eligible Seller-fault failure. It owns opinion/eligibility/projections, not payment, Claims adjudication, Handoff or Trust.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

## 2. Core doctrine

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Payment alone, unreviewed allegation, readiness, PICKUP, local receipt tap or delegate identity never establish eligibility. The Reviews owner validates the complete basis; Claims supplies evidence, not direct Review writes.

![One Seller Order feedback identity, two evidence bases](graphics/REV_01.svg)
*Figure 01. One Seller Order feedback identity, two evidence bases. Multiple Claims and delivered refund disputes cannot create a second Review; delegate never owns feedback.*

## 3. Domain ownership

- Reviews owns Review Grant consumption, Review submission, Seller-service rating, Product-quality item ratings, Review body, publication state, public read models, rating aggregates, moderation-state integration and Review analytics.

- Handoff owns QR/OTP/Manual credential issuance and the authoritative VERIFIED result.

- Order owns Buyer/Seller/OrderLine/completion facts and emits completion references.

- Catalogue owns Product/Post identity; Product Posts are the commercial Product representation. Scene Posts are discovery/merchandising content and are not Review targets.

- Claims owns disputes and remedy decisions; Payments/Finance owns provider payment/refund truth.

- Trust owns Trust Level calculation. Reviews supplies evidence-backed rating facts only.

- Moderation owns review-text/rating enforcement policy and removal/restriction decisions.

- Auth owns Buyer identity, Seller-team roles and Operator permissions.

## 4. What Reviews does not own

- Payment success, PSP reconciliation or Seller settlement.

- Order state transitions, stock or CheckoutAllocation state.

- Courier assignment, route/location facts or fulfilment legality.

- QR/OTP/Manual Handoff verification.

- Claim adjudication or refund completion.

- Trust Level computation, FYP ranking or Seller eligibility.

- Product/Scene Post publication state.

- Open social comments, likes or discussion threads.

## 5. Current post/content model

Product Post displays Product-quality Reviews for its underlying canonical Product. Seller Storefront/profile displays Seller-service summaries through public projections. Scene Post has no standalone Review thread, star score or Review target.

An optional discovery-attribution record can retain scene_post_id, scene_revision_id, product_tag_id and product_post_id. These references never create eligibility, change rating weight or substitute for OrderLine provenance. FYP top-level content remains image-led Scene Posts; Product detail is the Product-rating destination.

### PART II - COMMERCE, HANDOFF & REVIEW GRANT MODEL

## 6. Current commerce prerequisite

Receipt path: verified charge -> operational PAID with stock -> fulfilment -> accepted final DELIVERY -> receipt-based Grant. Failure path: verified payment -> upheld eligible Seller-fault non-delivery/unpaid remedy -> Reviews evaluates VERIFIED_ORDER_FAILURE. No operational fake COMPLETED or fake Handoff is required for failure feedback.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 7. Qualifying final Handoff

FINAL_HANDOFF uses accepted final DELIVERY to Buyer or active authorized delegate for Collection, Seller Delivery or Courier Delivery; Courier PICKUP gives no eligibility. QR, OTP and governed Manual are valid receipt methods; Reviews reads immutable evidence rather than credentials.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 8. One Seller Order - One Feedback Opportunity

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

```
resolveOrderFeedback(orderId, exactBuyer)
  lock owning Order-feedback identity and current grant
  verify preserved payment and Buyer/Seller provenance
  validate FINAL_HANDOFF OR VERIFIED_ORDER_FAILURE evidence
  UPSERT one grant UNIQUE(order_id, buyer_account_id)
  attach/append evidence lineage; do not create second container
submitFeedback -> lock AVAILABLE grant -> consume + Review + outbox
A later Claim/refund/Handoff reconciles this existing identity.
```

## 9. Repeat purchase creates a new Review opportunity

Another real paid Seller Order can support a new independent feedback opportunity under its own qualifying basis. Another Claim/line/attempt on the same Order cannot. Repeat Product quality requires actual received eligible lines; paid non-delivery never supplies Product-quality experience.

## 10. Multi-product Order semantics

One container holds Seller-service stars/text and, only where receipt evidence proves goods received, eligible same-Order Product-quality item ratings. Failure-only container has no received goods and no item ratings. Multiple purchased lines keep exact snapshot provenance; no Scene score or overall rating.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 11. Delegated recipient semantics

A delegated recipient can scan the presenter's QR or complete the authorized OTP path for the Buyer, but does not become the Review author. Once the final Handoff is accepted, the Review Grant is issued to the Order Buyer. The delegate gets no Review, Claim, refund, payment or Order ownership rights.

## 12. Seller/Courier cooperation rule

Adulis should make Handoff completion an explicit condition of accepting goods. At the physical meeting, the presenter displays the QR; if QR is impractical, the authorized fallback is OTP; Manual Verification is emergency recovery. The Buyer should not take possession and leave while all Handoff methods are being refused, because an unverified physical exchange cannot produce a

Review Grant or prove a post-receipt Product-quality experience.

### Critical anti-abuse reconciliation: refusing Handoff must never let a Seller or Courier trap Buyer funds. If the

### presenting party refuses all legitimate Handoff methods, the Buyer should refuse possession and the Order remains

### incomplete. Fulfilment/Handoff must expose a non-cooperation/failure fact that Claims/Payments can use for

### cancellation or refund handling. Post-receipt quality remedies require completed final Handoff;

### failed-Handoff/non-delivery remedies are a separate path.

## 13. Buyer-facing warning

Before payment and again at receipt, the app should explain: "Complete Adulis Handoff before accepting the order. Your verified Handoff unlocks your Review and supports post-receipt transaction evidence. If the Seller/Courier refuses verification, do not accept the goods; use the in-app Handoff problem flow." The copy must not imply that a Seller can waive Buyer rights by refusing verification.

### PART III - ELIGIBILITY, SUBMISSION & RATING SEMANTICS

## 14. Canonical eligibility resolver

```
ReviewEligibility (conceptual REST response)
  can_review; review_grant_id?; eligibility_basis?
  order_ref; existing_review_ref?; evidence_version?
  final_handoff_ref?; safe_failure_label?; safe_remedy_status?
  seller_rating_allowed; body_allowed
  items[] {order_line_ref, product_ref, received, rating_allowed}
  reason_codes[]
Server derives Buyer/Seller/evidence; no raw private Claim reference.
```

## 15. Eligibility conditions

Require authenticated exact Order Buyer, verified payment, current authoritative basis, AVAILABLE unconsumed unique Order grant, valid opinion policy and same-Order received-line checks. FINAL_HANDOFF proves final accepted receipt; VERIFIED_ORDER_FAILURE proves upheld eligible Seller fault/remedy. Lock/re-read basis at submission; no client evidence selection can bypass it.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 16. No fallback unverified public Reviews

No unverified fallback. Public launch feedback remains transaction-backed: receipt-based or clearly labelled verified paid-Order failure. Do not describe failure feedback as Handoff-verified or goods-received. Minimal remedy annotation is distinct from opinion and full private evidence.

## 17. Seller-service rating

Seller-service rating measures the Buyer's experience with the Seller: communication, preparation accuracy, fulfilment coordination, cooperation with Handoff, reliability and service quality. It must not be mathematically merged with Product-quality ratings. Handoff proves that a commerce experience occurred; it does not prove the Seller deserves a good score.

## 18. Product-quality rating

Product-quality rating measures the received Product experience. It is anchored to the immutable OrderLine and server-derived Product identity. The client must not submit an arbitrary Product ID. A Product-quality rating requires that the corresponding OrderLine was part of the completed receipt experience.

## 19. Rating scale and no overall rating

Use 1-5 integer stars for Seller service and each Product-quality item. Do not create one combined "overall" rating because Seller service and Product quality are different facts. Public averages remain ordinary arithmetic averages unless a formally versioned future weighting policy is approved.

## 20. Review body

The Review container may include one optional text body describing the transaction experience. Product-specific detail can be expressed through the associated item ratings and future structured item comments if approved. The body is moderated content; it cannot contain doxxing, prohibited content, threats or unsupported private information.

## 21. Submission payload

Client submits only user-entered opinion data plus stable OrderLine references. Buyer ID, Seller ID, Product ID, Handoff ID, verification method, Market and publication timestamp are server-derived.

```
POST /v1/orders/{orderRef}/review
Idempotency-Key:
{
"seller_rating": 1..5,
"body": "...",
"items": [
{ "order_line_ref": "...", "rating": 1..5 }
]
}
```

Optional discovery_attribution is separately typed and validated against actual served Scene/Product context. Server derives product_id from eligible OrderLine and ignores/rejects arbitrary Product IDs; Scene is never a rated entity.

## 22. Atomic publication

The submission function re-runs eligibility inside the write transaction, locks/consumes the Review Grant, creates the Review and item ratings, writes transition/audit data and emits an outbox event. If any requested item is ineligible, reject the whole submission with structured item errors rather than partially publishing a misleading Review.

## 23. Immediate publication and Seller non-control

- An eligible Review publishes immediately subject to normal content-policy enforcement.

- Seller cannot approve, delay, hide, delete or reorder Reviews to suppress negative feedback.

- Seller may report a Review through Moderation, but the report itself does not hide it.

- Commercial plans, advertising spend or Seller Trust level cannot increase Review visibility or weight.

### PART IV - DATA MODEL, APIS & PROJECTIONS

## 24. Review Grant entity

| Review Grant field | Amended semantics |
| --- | --- |
| id / order_id / buyer_account_id / seller_id | One grant per paid Seller Order / exact Buyer; tuple constrained to owner provenance. |
| eligibility_basis | FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; authoritative versioned resolver. |
| final_handoff_id nullable | Required for receipt basis; absent for failure-only basis; partial unique non-null evidence. |
| claim_decision_id nullable / decision version | Required upheld eligible Seller-fault evidence for failure basis; receipt basis may carry separate later remedy annotation. |
| status / consumed_by_review_id | AVAILABLE / CONSUMED / REVOKED; one locked consumption. |
| evidence and correction lineage | Accepted receipt or immutable decision ref, eligibility/policy version, safe remedy state and append-only correction refs. |
| timestamps | Actual created/verified/consumed instants, not fabricated receipt for failure. |

## 25. Review entity

Review has UNIQUE(order_id) and UNIQUE(review_grant_id); expose UNIQUE(review_id, order_id). Buyer/Seller/Market/evidence basis are server-derived and matched to grant/Order tuples. final_handoff_id is nullable for failure basis; no unconditional NOT NULL excludes valid failure feedback.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

## 26. Review item rating entity

review_item_rating includes order_id. Enforce (review_id, order_id) -> Review and (order_line_id, order_id, product_id) -> OrderLine composite foreign keys. OrderLine exposes the matching unique key. Stars use same-row 1..5 CHECK. Received-line/basis predicates run inside the correctly locked Reviews owner transaction; no cross-table CHECK function.

```
review_item_rating
  review_id; order_id; order_line_id; product_id
  item_rating integer CHECK(item_rating BETWEEN 1 AND 5)
  UNIQUE(review_id, order_line_id)
  FOREIGN KEY(review_id, order_id) REFERENCES Review
  FOREIGN KEY(order_line_id, order_id, product_id) REFERENCES OrderLine
See PostgreSQL 17 fixture appendix for exact executable syntax.
```

## 27. Core constraints

Database uniqueness gives one grant/consumption/container per Buyer-Seller Order. Composite owner tuples bind Buyer/Seller/Order and rating Product/line. Receipt evidence is unique only when non-null; failure evidence must be an upheld eligible exact-Order decision validated under owner locks. No cascade deletes required commercial, financial, Review or held evidence. Application/ORM validation supplements constraints, not replaces them.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 28. Review APIs

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /v1/orders/{orderRef}/review-eligibility | Server-authoritative allowed actions and ratable OrderLines. |
| POST | /v1/orders/{orderRef}/review | Consume grant and publish Review. |
| GET | /v1/orders/{orderRef}/review | Buyer reads their Review. |
| GET | /v1/products/{productRef}/reviews | Public Product Reviews, cursor paginated. |
| GET | /v1/storefronts/{handle}/reviews | Public Seller-service Reviews, cursor paginated. |
| GET | /v1/sellers/{sellerId}/reviews | Authorized Seller read-only operational view. |
| POST | /v1/reviews/{reviewRef}/report | Route Review to Moderation; no immediate suppression. |

## 29. Idempotency and concurrency

Review creation requires an Idempotency-Key. Concurrent submissions against the same grant acquire a database lock or equivalent serializable protection. The first valid commit consumes the grant; a retry with the same key returns the existing Review; a different request after consumption returns REVIEW_ALREADY_SUBMITTED. Valkey must not be used as the correctness lock for Review uniqueness.

Registered producer contract: review.eligibility_changed is Reviews-owned and commits with the unique Order grant/container and outbox. Include exact Buyer/Seller Order, previous/current eligibility state and eligibility basis, eligibility_revision and opaque source/version reference. No new event, Grant or reminder is created when replay/current re-read yields no state/basis change. Correction/reversal changes eligibility and repairs existing projections; later verified remedy updates its truthful status without inventing receipt or another container. The original reminder clock remains the first AVAILABLE grant issuance.

Inputs: handoff.verified filtered to qualifying final DELIVERY; payment.verified; claim.decision_recorded/claim.decision_corrected; verified claim.remedy_completed/refund.status_changed. Owner locks and current decision/evidence reads decide applicability. PICKUP, order.completed alone, allegation, refusal and unverified reimbursement cannot grant receipt eligibility. Contract_Registry defines the closed versions and safe payloads.

## 30. Rating projections

Seller-service aggregates include permitted receipt/failure feedback; expose basis-aware counts/labels. Product-quality aggregates include received-line ratings only. Sum/count/distribution remain separate and never become an overall/Scene score. Rebuild on moderation/eligibility corrections and safe remedy-status updates; rating opinion does not prove refund completion.

![Supported Review relationships and received-only transaction](graphics/REV_02.svg)
*Figure 02. Supported Review relationships and received-only transaction. Reference PostgreSQL 17 DDL is supplied as a synthetic fixture; deployment and product tests are not claimed.*

## 31. Valkey usage

Valkey may cache public rating summaries, cursor/read-model fragments, rate-limit counters and BullMQ queue state. PostgreSQL remains canonical. A cache hit can never create eligibility, consume a Review Grant or keep a moderated rating contributing indefinitely. Event-driven invalidation plus bounded TTL provides recovery.

### PART V - MODERATION, CLAIMS, TRUST & PRODUCT

### INTEGRATION

## 32. Moderation integration

Moderation can restrict/remove Review text or the entire Review from public presentation according to policy. The canonical Review record and evidence references remain auditable. Rating aggregate contribution follows the approved moderation effect and must be reconciled after enforcement/restore events.

## 33. Claim and Review independence

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Open/unupheld Claims create no Grant. Claims supplies immutable decision evidence; Reviews independently evaluates and locks the one-Order eligibility/container. A refund does not itself erase valid opinion or manufacture a second Review.

## 34. Post-receipt refund/quality boundary

For post-receipt Product-quality disputes such as NOT_AS_DESCRIBED, the completed final Handoff is strong evidence that custody occurred and aligns with Review eligibility. Reviews does not decide refund eligibility or outcome. Claims decides the dispute; Payments/Finance/provider integration executes and reconciles approved refunds.

## 35. Failed Handoff and non-delivery boundary

A failed or refused final Handoff is not treated as a completed receipt merely to unlock a Review. The Buyer should not accept goods without verification. If the presenter refuses all legitimate Handoff methods, Handoff/Fulfilment records the failure/non-cooperation fact; Claims may then handle non-delivery/failed-fulfilment recourse. This path must not create a public Product-quality Review because verified custody never occurred.

## 36. Refund after completed Handoff

A refund after a legitimate completed Handoff does not automatically erase the Review. The Buyer experienced the Product and may have a valid negative or positive opinion. Moderation/Claims may add policy-approved annotations or exclude proven abusive/fraudulent ratings, but ordinary refund completion alone does not rewrite Review history.

## 37. Trust integration

Trust consumes permitted canonical Review and Handoff facts under its own versioned policy. Public levels are NEW, REBUILDING, ESTABLISHED and TRUSTED; no Product listing cap applies. Five stars do not directly promote and one star does not directly demote/suspend. QR-only Trust promotion counters remain separate from Review eligibility after accepted QR, OTP or Manual final Handoff.

## 38. Recommendation/FYP integration

Marketplace Search launches with PRODUCT_POST, SELLER and SCENE_POST. Scene eligibility is current PUBLIC plus Seller/Market/Moderation/media/tag availability gates; PostgreSQL + pg_trgm and bounded derived projections remain the baseline. FYP top-level units are image/photo Scene Posts only. Product Posts remain Product-detail, tag, Shop and Search commerce destinations. Buyer Home retains For You (default), Following, Nearby, Discounts and Locally Made; none bypasses public eligibility. Ranking follows hard gates and belongs to Search/Recommendation, never this domain.

Recommendation may consume bounded privacy-safe Product/Seller Review aggregates. Reviews does not calculate rank, guarantee placement or create Scene star scores. Scene attribution can trace a discovery journey without altering rating validity/weight. Current private visibility and Moderation gates remain independent of high ratings.

## 39. Seller surfaces

Seller Console may display read-only Review lists, aggregate ratings, moderation/report actions and trend analytics according to Auth permissions. Seller Companion may show urgent/new Review notifications and limited read-only summaries if current role/surface policy permits. Neither surface can mutate Buyer ratings or Review eligibility.

## 40. Review reminders

Notifications schedules the existing T+1/T+3/T+10-day cadence from first AVAILABLE Order Grant issuance under either FINAL_HANDOFF or VERIFIED_ORDER_FAILURE, then stops. No fabricated receipt date for failure feedback, restarted schedule after later Claims or unlimited Seller pushes. Re-read current eligibility/recipient/preferences; cancel consumed, revoked or suppressed grants.

## 41. Authorization

One ordinary human uses one stable ordinary Adulis Account across Buyer capability, Seller ownership, Seller-team participation and a persistent Courier profile. Different humans use different Accounts and never share credentials. Ownership, team membership and Courier relationships are independent; a team Account may have multiple active roles whose current permissions compose within the exact Seller scope.

At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the ordinary Account's team slot. Seller ownership and many private Seller-Courier Pool relationships do not consume that slot. Switching Buyer/Seller/Courier Mode changes presentation and current context, never identity or authority.

Operator Account is a separately provisioned privileged internal principal. A person may also hold an ordinary Account, but credentials, sessions, strong authentication, recovery, revocation and audit identity remain independent. Ordinary Account OTP, Seller roles, public registration and Mode switching never create Operator authority.

Privileged workflows require an isolated OPERATOR session, current explicit capability, exact resource/Market/case scope, strong authentication and freshness, plus approval when the existing Founder/Staff governance requires it. Restricted evidence needs its own current capability and case/purpose authorization; ADMIN supplies no universal bypass. Record operator_account_id, capability, policy, case/version, reason, request/time and applicable approval context. No impersonation or direct generic domain-state setter is introduced.

Only the authenticated exact Order Buyer may consume the grant. An authorized delegate's receipt grants the opportunity to the Buyer, never to the delegate. Seller ownership/team roles cannot author/edit another Buyer's Review, impersonate a Buyer or suppress a negative Review; Seller may report through normal Moderation intake.

Review moderation uses separate Operator Account capability and current evidence/case authorization. Ordinary Buyer/Seller/Courier sessions are denied even when the same person is an Operator. Resolve Seller/Buyer scope from server facts, never arbitrary IDs supplied by the client.

![Ordinary relationships and privileged authority are independent](graphics/REV_03.svg)
*Figure 03. Ordinary relationships and privileged authority are independent. The same human may possess both principals, but session, credential, recovery, scope and audit do not cross from an ordinary Account to an Operator Account.*

## 42. Abuse resistance

Buyer surfaces display canonical basis and allowed actions. A distinct paid Seller Order can create a new eligible opportunity; multiple Claims/Handoffs on the same Order cannot. Product ratings require received lines; safe Seller failure feedback is labelled separately.

## 43. Privacy and deletion

Public Reviews should not reveal Buyer phone, delivery address, delegate identity, payment-provider data, exact Handoff credential data or private Order references. Buyer account deletion anonymizes Review authorship where policy permits while preserving the transaction-backed rating history and evidence needed for active Claims, security or legal holds. Deletion/retention is controlled by the Privacy/Data Lifecycle domain.

## 44. Localization

English is the primary/source language. Localized UI and domain messages use approved whole-sentence translation resources. Amharic remains a supported Ethiopia localization with founder-reviewed translation for current launch. User-written Review text remains in its original language unless a future translation feature is explicitly approved; machine translation must not overwrite source text.

## 45. Analytics

Track the funnel without copying Review body or private Buyer data into general analytics: review_grant_created, review_eligible, review_prompted, review_started, review_published, seller_rating_submitted, product_rating_submitted, review_reported, review_moderated, reminder_cancelled. Server events establish publication; client events are interaction observations only.

Optional Scene attribution is a separate privacy-safe journey reference: scene_post_id, served scene_revision_id, product_tag_id and Product Post. General analytics excludes body text, private evidence and precise recipient data; attribution cannot create a Review Grant or a Scene rating.

## 46. Observability

Monitor duplicate Order grants/containers, consumed grants without Review, missing/wrong basis evidence, failure-only item rating, Product/Seller provenance mismatch and correction/projection lag. Redacted Sentry/Pino/DB/queue observations remain separate from evidence. A missing Handoff is valid only for a proven failure basis.

## 47. Failure behavior

Finance/Order/Handoff or Claim evidence unavailable: fail closed for a NEW eligibility/submission decision whenever the required current basis cannot be verified. Failure eligibility requires the exact upheld Seller-fault decision/remedy evidence; an allegation/cache bit is not fallback. An already published container follows current governed visibility/correction rules, not invented revocation.

Trust or downstream Analytics/Notifications/projection outage never blocks an otherwise valid owner-verified Review publication; persist durable outbox for replay. Duplicate commands return the canonical existing result or consumed denial. Failed moderation/current authorization denies through the owning policy.

## 48. Current technology stack

| Layer | Current stack / Review use |
| --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript. Review/eligibility application services and REST APIs. |
| Persistence | Drizzle ORM; PostgreSQL. Canonical Review Grant, Review, item ratings, projections, outbox and constraints. |
| PostgreSQL extensions | pg_trgm for bounded review-text/search support where approved; btree_gist for applicable exclusion constraints; pg_stat_statements for performance diagnosis. |
| Async/cache | Valkey; BullMQ. Non-canonical read cache, rate-limit support, projection/reconciliation/reminder jobs. |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client. |
| Security | @nestjs/throttler; @fastify/helmet; shared authorization/step-up/session infrastructure; server-side tenancy checks. |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; SecureStore; SQLite for bounded technical data only; Camera; Notifications; Updates; small Zustand store. |
| Media | Cloudflare R2/CDN + Sharp for platform media. Review v2 launches text/stars only unless Review media is separately approved. |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6. |
| Observability | Sentry; Pino structured logs; pg_stat_statements. |
| Architecture control | dependency-cruiser. |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS. |

## 49. Repository/module placement

Reviews remains a module in the platform modular monolith. Enforce domain-private repositories; cross-domain changes use approved contracts/events, never direct source-table writes. The repository structure is:

```
adulis-platform/apps/api/modules/reviews/
  domain/
    review-grant.ts
    review.ts
    review-item-rating.ts
  application/
    resolve-review-eligibility.ts
    submit-review.ts
    moderate-review-projection.ts
    rebuild-rating-projections.ts
  infrastructure/
    drizzle/
    outbox/
    valkey-cache/
    bullmq-jobs/
  http/
    buyer-reviews.controller.ts
    public-reviews.controller.ts
    seller-reviews.controller.ts
```

## 50. Critical tests

- QR final Handoff -> one Review Grant -> one successful Review.

- OTP final Handoff -> one Review Grant -> one successful Review.

- Manual final Handoff -> one Review Grant -> one successful Review with audited provenance.

- Courier PICKUP Handoff alone -> no Review Grant.

- Buyer self-confirmation alone without qualifying receipt/failure evidence -> no Review.

- Delegate receives Order -> Review Grant belongs to Buyer; delegate submission rejected.

- Concurrent Review submits -> exactly one Review; idempotent retry returns existing result.

- Repeat purchase + new final Handoff -> second independent Review allowed.

- Same Product without a new paid eligible Seller Order -> second Review rejected.

- OrderLine from another Order -> rejected.

- Arbitrary Product ID injection -> ignored/rejected; server derives Product.

- Seller-owner self-review conflict -> excluded/rejected according to policy.

- Seller reports one-star Review -> Review remains public pending Moderation decision.

- Moderation removes Review -> projection updates and reconciliation converges.

- Valkey outage -> canonical eligibility/submission still correct.

- Reminder schedule stops after Review consumption.

- Presenter refusal alone grants none; upheld eligible Seller-fault paid non-delivery can create Seller-only feedback.

Retain existing concurrency, provenance, arithmetic, privacy, moderation and failure tests. Add the supplied canonical regression cases below; Jest/Testcontainers verify constraints and races, Maestro/Playwright exercise Buyer/Seller/Operator surfaces, and k6 validates bounded submission/projection workloads.

• Current regression 01: Paid without final Handoff and WITHOUT upheld eligible failure -> cannot Review; proven eligible failure permits Seller-only feedback.

• Current regression 02: Seller->Courier Pickup -> cannot Review.

• Current regression 03: Final QR Delivery -> Review Grant.

• Current regression 04: Final OTP Delivery -> Review Grant.

• Current regression 05: Final Manual Verification -> Review Grant.

• Current regression 06: Delegate receives -> grant goes to Buyer.

• Current regression 07: Concurrent grant creation -> one grant.

• Current regression 08: Concurrent Review submissions -> one Review.

• Current regression 09: Multi-Product Order -> one Review container + eligible item ratings.

• Current regression 10: Arbitrary Product ID injection -> rejected/ignored.

• Current regression 11: Repeat purchase/new Handoff -> second independent Review allowed.

• Current regression 12: Same Handoff -> second Review rejected.

• Current regression 13: Seller reports 1-star Review -> remains unless Moderation acts.

• Current regression 14: Refund after completed receipt -> Review remains by default.

• Current regression 15: Scene attribution preserved but Scene itself is not rated.

• Current regression 16: FYP Scene has no standalone Scene star score.

• Current regression 17: Operator ordinary Account cannot perform Review moderation.

• Current regression 18: Authorized Operator Account can perform permitted action.

• Current regression 19: Valkey outage -> canonical Review correctness remains.

• Current regression 20: Reminder schedule stops after grant consumption.

New specification fixtures: verified paid non-delivery/upheld Seller fault -> Seller-only feedback; unverified payment/unrelated Buyer/unupheld allegation -> deny; many Claims -> same container; delivered refund dispute -> existing container; later refund -> safe remedy annotation; overturned decision -> owner reconciliation. Wrong Order/Product/Buyer/Seller, failure-only Product rating and concurrent consumption are negative DDL/owner tests. These cases are NOT EXECUTED by document editing.

## 51. Load/performance strategy

Use cursor/keyset pagination for public Review lists, indexed Product/Seller projection reads, batched projection updates and bounded Review text search where enabled. Recommendation/FYP never scans raw Reviews per feed request. k6 tests should cover viral Product Post review reads, Seller Storefront summaries and bursty post-Handoff grant creation without compromising Order/Handoff latency.

## 52. Deployment and release

Database migrations must land before code that relies on Review Grant constraints. Deploy in stages: schema -> backfill/migration tooling -> shadow eligibility resolver -> API/client -> reminder migration -> strict uniqueness -> remove old fallback paths. Feature flags may control rollout but cannot bypass two-basis owner eligibility or database constraints.

### PART VIII - MIGRATION, INVARIANTS & FINAL ARCHITECTURE

## 53. Migration from v1

Migration specification, not execution: expand nullable/discriminated evidence and Order tuple keys; classify legacy provenance without fabricating receipt/failure findings; deduplicate one Order container under reviewed history; backfill verified source evidence only; validate composite FK/uniqueness; update generated APIs/projections/reminders; then retire old receipt-only assumptions. Preserve historical bodies/commercial snapshots/holds and correction lineage. See negative-insert fixtures; production migration remains unexecuted.

## 54. Hard invariants

REV-INV-01 New feedback requires FINAL_HANDOFF or VERIFIED_ORDER_FAILURE with complete verified evidence.

REV-INV-02 One paid Seller Order has at most one Buyer-owned container/grant consumption across bases and Claims.

REV-INV-03 Delegate receipt grants Buyer only; PICKUP and payment alone grant none.

REV-INV-04 No Product-quality rating for unreceived goods; eligible item line/Product tuples match the Review Order.

REV-INV-05 No client asserts Buyer/Seller/evidence/Market provenance.

REV-INV-06 Seller cannot suppress negative valid feedback; moderation/corrections are owner-governed.

REV-INV-07 Financial completion is verified independently of opinion/Claim promise.

REV-INV-08 Seller-service/Product-quality sum/count/distribution remain separate; no overall or Scene rating.

REV-INV-09 Private evidence/bodies stay out of broad telemetry and public annotations.

REV-INV-10 PostgreSQL locks/keys enforce publication; Valkey/BullMQ remains non-canonical.

REV-INV-11 Ads, subscriptions, Trust and attribution never buy validity/weight.

REV-INV-12 Account lifecycle, legacy provenance, holds and evidence history remain preserved.

## 55. Production launch gate

Launch gate: implemented two-basis resolver, one Order container/concurrent consumption, received-only item guard, valid composite DDL/migration tests, delegate/PICKUP exclusion, correction/projection privacy and basis-aware reminders. Actual integration/runtime evidence and legal/provider approvals remain OPEN; no PDF update closes them.

## 56. Recommended implementation sequence

Implement in owner dependency order; every exit preserves one Buyer/paid Seller-Order Grant consumption/container across both evidence bases.

| Phase | Work | Exit criterion |
| --- | --- | --- |
| 1 | Order/Finance/Handoff/Claim owner evidence interfaces | Verified payment and exact FINAL_HANDOFF or upheld VERIFIED_ORDER_FAILURE; PICKUP/allegation excluded. |
| 2 | Discriminated Grant / tuple constraints / migration | One Buyer/Order grant; nullable receipt for failure; locked evidence resolver. |
| 3 | Atomic Review and received-line publication | Supported composite FKs, stars CHECK, one consumption; no failure-only Product rating. |
| 4 | Separate Seller/Product projections | Seller-service includes valid failure basis; Product quality requires received lines; corrections repair. |
| 5 | Basis-aware API/UI/reminders/attribution | Buyer-only; minimal failure/remedy label; one issuance-based T+1/T+3/T+10 schedule. |
| 6 | Operator/privacy/abuse/release | Separate principal/holds; specified negative/race cases and actual live-data approvals. |

## 57. Final system architecture

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Handoff receipt facts and upheld eligible Claims decisions are independent source evidence. Reviews alone resolves and locks the one Buyer/Order identity, validates received item lines and publishes history/outbox. Downstream Trust/Notifications/Analytics/projections acquire no eligibility authority.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

![One Seller Order feedback identity, two evidence bases](graphics/REV_04.svg)
*Figure 04. One Seller Order feedback identity, two evidence bases. Multiple Claims and delivered refund disputes cannot create a second Review; delegate never owns feedback.*

![Supported Review relationships and received-only transaction](graphics/REV_05.svg)
*Figure 05. Supported Review relationships and received-only transaction. Reference PostgreSQL 17 DDL is supplied as a synthetic fixture; deployment and product tests are not claimed.*

## 58. Final engineering doctrine

A Review is one Buyer opinion about one verified paid Seller Order, supported by receipt or an adjudicated eligible Seller-fault failure. It never substitutes for an owed refund or turns non-delivery into a fabricated received Product experience. Domains retain separate ownership; historical evidence/corrections remain auditable.

## 59. Appendix - PostgreSQL 17 Relationships & Negative Fixtures

```
-- Synthetic reference schema only. PostgreSQL 17 target; NOT executed here.
CREATE SCHEMA adulis_review_fixture;
CREATE TABLE adulis_review_fixture.seller_order (
 order_id uuid PRIMARY KEY, buyer_account_id uuid NOT NULL,
 seller_id uuid NOT NULL,
 UNIQUE(order_id,buyer_account_id,seller_id));
CREATE TABLE adulis_review_fixture.order_line (
 order_line_id uuid PRIMARY KEY, order_id uuid NOT NULL,
 product_id uuid NOT NULL,
 FOREIGN KEY(order_id) REFERENCES adulis_review_fixture.seller_order
   ON DELETE RESTRICT,
 UNIQUE(order_line_id,order_id,product_id));
CREATE TABLE adulis_review_fixture.review_grant (
 grant_id uuid PRIMARY KEY, order_id uuid NOT NULL,
 buyer_account_id uuid NOT NULL, seller_id uuid NOT NULL,
 eligibility_basis text NOT NULL,
 final_handoff_id uuid, claim_decision_id uuid,
 status text NOT NULL CHECK(status IN ('AVAILABLE','CONSUMED','REVOKED')),
 UNIQUE(order_id,buyer_account_id),
 UNIQUE(grant_id,order_id,buyer_account_id,seller_id,eligibility_basis),
 FOREIGN KEY(order_id,buyer_account_id,seller_id)
   REFERENCES adulis_review_fixture.seller_order
   (order_id,buyer_account_id,seller_id) ON DELETE RESTRICT,
 CHECK((eligibility_basis='FINAL_HANDOFF'
        AND final_handoff_id IS NOT NULL)
    OR (eligibility_basis='VERIFIED_ORDER_FAILURE'
        AND final_handoff_id IS NULL AND claim_decision_id IS NOT NULL)));
CREATE UNIQUE INDEX review_grant_receipt_unique
 ON adulis_review_fixture.review_grant(final_handoff_id)
 WHERE final_handoff_id IS NOT NULL;
CREATE TABLE adulis_review_fixture.review (
 review_id uuid PRIMARY KEY, order_id uuid NOT NULL UNIQUE,
 grant_id uuid NOT NULL UNIQUE, buyer_account_id uuid NOT NULL,
 seller_id uuid NOT NULL, eligibility_basis text NOT NULL,
 seller_rating integer NOT NULL CHECK(seller_rating BETWEEN 1 AND 5),
 body text, UNIQUE(review_id,order_id),
 FOREIGN KEY(grant_id,order_id,buyer_account_id,seller_id,eligibility_basis)
  REFERENCES adulis_review_fixture.review_grant
  (grant_id,order_id,buyer_account_id,seller_id,eligibility_basis)
  ON DELETE RESTRICT);
CREATE TABLE adulis_review_fixture.review_item_rating (
 review_id uuid NOT NULL, order_id uuid NOT NULL,
 order_line_id uuid NOT NULL, product_id uuid NOT NULL,
 item_rating integer NOT NULL CHECK(item_rating BETWEEN 1 AND 5),
 PRIMARY KEY(review_id,order_line_id),
 FOREIGN KEY(review_id,order_id)
  REFERENCES adulis_review_fixture.review(review_id,order_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(order_line_id,order_id,product_id)
  REFERENCES adulis_review_fixture.order_line
  (order_line_id,order_id,product_id) ON DELETE RESTRICT);
-- Authentic receipt/Claim refs + received-only cross-row predicate require
-- approved owner evidence interfaces and locked command validation.
-- No CHECK function looks up another table. No destructive cascade.
```

These statements are valid PostgreSQL constraint syntax for the synthetic schema. They are not deployed migrations and were not run against PostgreSQL 17 in this document-edit workflow. Production evidence FKs and owner interfaces map exact canonical Handoff/Claim tables under reviewed migration; dummy UUID presence alone never establishes eligible evidence.

```
submitReview (locked owner transaction, conceptual)
 lock one Order/grant, current eligibility and evidence generation
 validate exact Buyer/Seller and verified payment through owner readers
 validate accepted FINAL_HANDOFF or upheld VERIFIED_ORDER_FAILURE
 verify each requested item is received in that same Order
 failure-only + any item rating -> reject whole submission
 compare grant.status=AVAILABLE; insert Review/items; set CONSUMED
 write immutable history/effect/outbox; commit
 concurrent loser returns existing idempotent result or consumed denial
```

| Negative fixture / migration check | Expected outcome - NOT EXECUTED |
| --- | --- |
| Review Buyer/Seller mismatches grant/Order | Composite FK rejects fabricated relationship. |
| Item wrong Order/Product | Composite FKs reject wrong tuple. |
| Stars 0 / 6; duplicate container | Same-row CHECK / unique Order and grant reject. |
| Failure basis without approved Claim or fabricated ID | Locked owner evidence resolver rejects; NOT NULL alone is insufficient. |
| Failure-only Product rating | Locked received-line guard rejects; valid FK alone is insufficient. |
| Concurrent consumption / late Claim-Handoff race | One Order grant/container survives; correction attaches lineage, no second Review. |
| Legacy migration/backfill | Prove keys and nullable basis, retain history/holds, segregate unproven legacy; no invented evidence. |

### Executable Negative Inserts - Synthetic, Not Executed

```
-- PostgreSQL17 synthetic fixture; NOT EXECUTED. Run reference DDL first.
-- Dummy evidence UUIDs here test relationships, never actual eligibility.
BEGIN;
INSERT INTO adulis_review_fixture.seller_order VALUES
 ('00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000021');
INSERT INTO adulis_review_fixture.order_line VALUES
 ('00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000041');
INSERT INTO adulis_review_fixture.review_grant VALUES
 ('00000000-0000-0000-0000-000000000051',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000021','FINAL_HANDOFF',
  '00000000-0000-0000-0000-000000000061',NULL,'AVAILABLE');
INSERT INTO adulis_review_fixture.review VALUES
 ('00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000051',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000021','FINAL_HANDOFF',4,NULL);
DO $$ BEGIN
 BEGIN -- wrong Product tuple: must raise 23503
  INSERT INTO adulis_review_fixture.review_item_rating VALUES
   ('00000000-0000-0000-0000-000000000071',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000042',4);
  RAISE EXCEPTION 'Wrong Product relationship was accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN -- out-of-range stars: must raise 23514
  INSERT INTO adulis_review_fixture.review_item_rating VALUES
   ('00000000-0000-0000-0000-000000000071',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000041',0);
  RAISE EXCEPTION 'Invalid stars were accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN -- second same Order/container: must raise 23505
  INSERT INTO adulis_review_fixture.review
   SELECT '00000000-0000-0000-0000-000000000072'::uuid,
    order_id,grant_id,buyer_account_id,seller_id,
    eligibility_basis,seller_rating,body
   FROM adulis_review_fixture.review;
  RAISE EXCEPTION 'Duplicate Order container was accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
ROLLBACK;
-- Extend with wrong Review/Order/Buyer/Seller and nullable-basis cases.
-- Fake evidence and failure-only item guards require locked owner tests;
-- the synthetic DDL does NOT establish authentic receipt/Claim evidence.
```

The exact runnable fixture is also supplied as review_negative_inserts_pg17.sql. Its UUIDs are synthetic relationship inputs, not approved receipt/Claim evidence. Migration/backfill and concurrent owner-evidence/received-line guards remain the separately specified cases above. No PostgreSQL execution occurred in this workflow.

## 60. Glossary

| Term | Current meaning |
| --- | --- |
| Account | Ordinary stable human identity across Buyer, Seller and Courier relationships; never shared credentials. |
| Operator Account | Separate privileged internal principal with independent strong authentication, session, recovery and audit. |
| Product Post | Canonical structured public commerce representation of exactly one Product. |
| Scene Post | Canonical image-led Seller content with caption, Product tags and revision lineage. |
| SCENE_POST / ScenePost | Current API/event enum and entity name for Scene Post. |
| Shoppable Post | Superseded former name for Scene Post; not a current independent entity. |
| Publication state | DRAFT, PUBLISHED or ARCHIVED; separate from visibility and moderation. |
| PUBLIC / PRIVATE | Content-owned current visibility; PRIVATE denies all Buyer/public Scene resolution. |
| Product tag | Same-Seller Product reference within a Scene; mutable commerce resolves canonically. |
| Published revision | Immutable composition/version; attribution records the actual version served. |
| Seller Order | One Seller transaction anchored to PSP/backend-verified payment and canonical OrderLines. |
| Final Handoff | Accepted Buyer/delegate receipt; QR primary, OTP fallback, Manual recovery; Pickup differs. |
| Review Grant | One Buyer-owned eligibility/consumption per paid Seller Order; FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; delegate never owns it. |
| Trust level | NEW, REBUILDING, ESTABLISHED or TRUSTED, computed from ratified canonical evidence. |
| Transactional outbox | Durable committed facts for idempotent asynchronous consequences and repair. |
| Valkey / BullMQ | Non-canonical cache/queue and execution; PostgreSQL retains business truth. |
| Seller-service rating | Independent 1..5 rating for service on one Seller Order. |
| Product-quality rating | Independent 1..5 item rating anchored to an eligible OrderLine/Product. |
| Review container | One Buyer opinion per Seller Order across both evidence bases; received-only Product quality separate from Seller service. |
| OrderLine | Server-owned Product provenance for item ratings. |
| Attribution | Optional served Scene/revision/tag journey context without eligibility or weighting authority. |
| Projection | Rebuildable Seller/Product sum/count/distribution aggregate. |
| Grant consumption | Atomic AVAILABLE -> CONSUMED publication under PostgreSQL constraints. |
| Delegate | Authorized receiver; Buyer retains Review/Claim/refund rights. |
| Review reminder | T+1/T+3/T+10 attention while grant remains AVAILABLE, then stop. |
| Claim | Human-adjudicated scoped dispute; upheld eligible Seller fault can support Reviews-owned failure eligibility, never direct Review or money truth. |
| QR scan credit | Trust promotion counter; distinct from QR/OTP/Manual Review eligibility. |

## 61. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-08 — Review presentation and write eligibility | The 13 October Reviews design separates Product Quality and Seller Service and defines evidence-based eligibility. | Anyone may read Reviews. Product Reviews expose Product Review and Seller Review. Scene Reviews expose one Product tab per distinct tagged Product plus Seller Review. Write/Edit controls appear only when authoritative Review eligibility exists; ineligible viewers see no composer. Product Quality and Seller Service remain separate. One active Product Review and one active Seller Review are maintained per qualifying entitlement; edit updates instead of duplicating. Sellers cannot edit/delete legitimate Buyer Reviews; Report Review is a moderation utility. The prototype’s completed-order path does not silently remove the 13 October design’s VERIFIED_ORDER_FAILURE Seller-service basis; that failure basis remains valid unless a later founder decision explicitly removes it. | PR-005, 27 Oct 2026 |
| R-09 — Seller profile and Storefront information architecture | The 13 October designs define Seller profile/Storefront content but not the final shared tab order. | Buyer Seller profile and standalone public Storefront share Scenes / Products / Reviews / About and open on Scenes. Scenes show the Seller’s Buyer-public eligible Scenes. Products show the catalogue with available first. Reviews is Seller Service; Product Quality remains on Product. About includes description, Trust facts, category, neighborhood/operating area, fulfilment, member since and social accounts. Collection point appears only where Buyer Collection is offered. Header actions are Follow and Message; the public Storefront hands these actions into the app. Trust is information, not a button. | PR-002, 26 Oct 2026 |
| R-10 — Purchased Products and Buy Again | The 13 October pack has Buyer Orders/account history but not the finalized Purchased Products UX. | Purchased Products derives from completed Buyer Orders and shows one entry per Product using the latest purchase: Seller, purchase date, purchased variant and current Product facts where resolvable. Buy Again opens the current Product with the last variant preselected only if still offered; Buyer must still choose quantity/fulfilment and explicitly order/pay. Unavailable or delisted Products remain in purchase history without an invalid Buy Again action. Review actions reuse canonical Review eligibility. | PR-006, 27 Oct 2026 |
| R-13 — Seller engagement analytics grouping | The 13 October Analytics design provides event/attribution architecture but not the final Seller-facing metric grouping. | Scene Performance prioritizes commerce outcomes (Explore opens, Product-detail visits, Seller inquiries, Orders initiated, verified completed Orders) before engagement counts (views, hotspot taps, Likes, Saves, Shares). Product Performance includes views, Saves, Product rating, inquiries and Order outcomes. Seller Reputation keeps Seller rating, Product ratings, verified completed Orders, service quality and Trust separate. Do not blend popularity and Trust into one score. | PR-007, 27 Oct 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
