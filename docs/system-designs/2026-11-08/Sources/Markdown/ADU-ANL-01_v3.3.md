# Adulis Analytics & Attribution
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-ANL-01_Adulis_Analytics_Event_Tracking_Attribution_Complete_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Executive Summary

Analytics records bounded behavior, attributes canonical outcomes and produces versioned metrics and features. The current discovery object is Scene Post / SCENE_POST / scene_post. Product Posts remain commerce destinations. One ordinary Account may appear under multiple acting relationships without duplicate identity graphs; privileged Operator Account identity remains separate.

Primary product outcomes are conversion rate, purchase frequency and Buyer satisfaction. Engagement and photo dwell are diagnostic observations. Canonical provider, Order, Handoff, Reviews, Claims and Trust facts define the marketplace funnel; client telemetry cannot establish any of them.

The architecture is globally extensible with explicit phased Market activation. Ethiopia is the initial commerce Market, beginning with Addis Ababa. Future Markets require approved currency, provider, legal, commercial and operational readiness. Locale, IP address, phone prefix and client country never activate commerce.

## 2. Mission

Create a stable, explainable and cost-conscious analytics architecture that measures discovery, attention, product interest, commerce conversion and post-purchase quality while respecting Adulis domain ownership, Seller tenancy, Market boundaries, privacy and connected-only execution.

## 3. Goals

• One canonical event catalogue with immutable semantic versions and generated/checked TypeScript contracts.

• Strict separation of client behavior, canonical domain facts, security audit and operational observability.

• Anonymous browsing measurement with first-party random identifiers and later Account linkage without rewriting historical rows.

• Idempotent batch ingestion and server-event replay safety.

• Exact FYP -> Scene Post -> Product Post -> Checkout -> PSP -> Order attribution.

• Photo qualified-impression and dwell definitions suitable for a photo-only FYP.

• Tenant-safe Seller, Product Post, Scene Post, FYP, Search, Storefront and commerce projections.

• Versioned KPI definitions so different surfaces do not silently redefine conversion, GMV or qualified exposure.

• Incremental scaling from PostgreSQL without premature streaming infrastructure.

## 4. Non-Goals

• No second source of truth for Accounts, Products, Inventory, Orders, Payments, Handoffs, Trust, Claims or Reviews.

• No ad-tech identity graph, invasive device fingerprinting or third-party behavioral SDK that receives sensitive commerce data.

• No Kafka, Flink, Spark, dedicated feature store or warehouse requirement for launch.

• No native Adulis video analytics pipeline, playback-duration model, completion-rate model or transcoding analytics.

• No raw Chat body, provider credentials, social verification code, private social-message content or precise Courier coordinate stream in general analytics.

• No free-form event names emitted ad hoc throughout the application.

• No unbounded seller dashboards that query OLTP commerce tables directly.

## 5. Product Context

Photo-first Scene discovery -> Product Post -> Seller Cart/Checkout -> backend-verified provider payment -> paid Seller Order -> fulfilment -> accepted final DELIVERY Handoff -> Buyer Review Grant and legal completion -> quality outcomes. For You is Scene-only; other Home tabs remain independent. Search launches with Product Posts, Sellers and Scene Posts. Collections saves Product Posts and Scene Posts.

Content owns Scene Post revisions, publication state DRAFT/PUBLISHED/ARCHIVED and visibility PUBLIC/PRIVATE separately. Public publication requires media/caption, same-Seller eligible tags and at least one available tagged Product, plus current Seller, Market and Moderation gates. Last available Product loss changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Stock recovery may automatically restore PUBLIC only after all current gates pass; it does not archive or require manual republishing solely for restock. Independent archive/removal or safety blocks remain effective.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

## 6. Domain Ownership

| Concern | Analytics role | Canonical owner/source |
| --- | --- | --- |
| Event taxonomy, versions, metrics | Owns measurement contracts | Platform architecture constrains context |
| Client behavioral ingestion/dedup | Owns | Mobile/Web emit typed observations |
| Payment/Order facts | Records normalized facts | Finance / Order / provider adapter |
| FYP rank/eligibility | Does not own | Recommendation |
| Product/stock/content state | Does not own | Catalogue / Inventory / Content |
| Attribution model | Owns measurement model | Order/Checkout stores bounded immutable snapshot |
| Seller/Product/Scene Post projections | Owns projections | Canonical domains remain source facts |
| Privacy lifecycle | Declares data class/need | Privacy/Data Lifecycle coordinates |

Own the versioned registry, observation ingestion, immutable historical event interpretation, attribution snapshots, metric definitions, projection freshness and bounded feature delivery. Content visibility and Reviews Grant decisions remain owner facts.

## 7. Non-Ownership

• Analytics never authenticates Accounts or admits Sellers.

• Analytics never establishes Product/Variant/price/stock/content publication state.

• Analytics never marks payment successful, creates a paid Order or changes refund/settlement truth.

• Analytics never verifies physical Handoff, changes Claim outcome, publishes Reviews or sets Trust Level.

• Analytics never determines FYP eligibility/rank or Search rank.

• dependency-cruiser must prevent Analytics from importing private repositories from source domains.

Analytics does not activate Markets, restore Scene visibility, create Review Grants, calculate authoritative Checkout money, set Trust levels or guarantee ranking multipliers.

## 8. Analytics vs Domain Events vs Audit/Logs

| Class | Purpose | Example | Authority |
| --- | --- | --- | --- |
| Product analytics event | Behavior/measurement | fyp qualified impression, product post opened | Observational |
| Canonical domain event | Business fact | payment.verified, order.completed, handoff.verified | Owning domain |
| Security/audit record | Accountability | Operator verification review, permission denial | Audit/Security |
| Operational telemetry | Reliability | HTTP latency, queue age, DB saturation | Observability |

The supplied domain registry is separate from §11 analytics intake and internal audit/timeline/queue/template classes. Map a registered canonical source into an approved analytics schema after commit; analytics observation cannot create financial, receipt or eligibility truth.

## 9. System Context

![Observations and trusted owner facts meet in versioned measurement](graphics/ANL_01.svg)
*Figure 01. Observations and trusted owner facts meet in versioned measurement. Raw historical semantics, attribution and privacy-aware projections remain distinct from canonical commerce authority.*

Connected clients send approved behavioral batches. Owning domains publish canonical server facts through shared Eventing. PostgreSQL stores bounded raw events, attribution and versioned projections. Coarse BullMQ work derives Seller reports and Recommendation features without blocking commerce.

## 10. Event Taxonomy

| Class | Authority and permitted examples |
| --- | --- |
| CLIENT behavior | Visibility-qualified Scene impressions, bounded photo dwell, Search opens, Product opens and Checkout entry; observations only. |
| SERVER owner fact | Content visibility, Collections membership, provider payment, Order legal transition, Handoff receipt, Reviews Grant/publication, Claims outcome and Trust transition. |
| Privileged operations | Typed separate Operator audit or privacy-approved aggregate telemetry; never an ordinary account_id alias. |
| Infrastructure diagnostics | Sentry/Pino/queue/query signals are separate from product metrics and sensitive evidence. |

The closed registry fixes allowed producer/source, trigger, required/optional/forbidden fields, privacy/retention class, dedup boundary and projections per event version. A client cannot choose SERVER source or forge a canonical fact.

## 11. Event Catalogue

The shared analytics-contracts package is a closed, versioned registry. New producers use only current Scene contracts; deprecated content names/versions are rejected for new writes. Historical released raw payloads remain immutable and queryable through explicit versioned read transformations.

| Event family | Source | Exact meaning |
| --- | --- | --- |
| fyp_qualified_impression / fyp_dwell_recorded | CLIENT | Visible current Scene revision and bounded active photo dwell, with signed served context. |
| scene_post_opened / product_post_opened | CLIENT | The actual destination is active; open is not a save or purchase. |
| scene_post_saved / product_post_saved | SERVER | Collections accepted canonical membership; button click is not proof. |
| scene_visibility_changed | SERVER / Content | Publication/visibility/version changed through Content authority. |
| search_result_opened | CLIENT | One PRODUCT_POST, SELLER or SCENE_POST with exact Search context. |
| checkout_started | CLIENT | Intentional entry; no allocation, charge or paid inference. |
| payment_attempt_created / payment_verified | SERVER / Finance | Canonical attempt identity or authenticated backend-verified provider result. |
| order_paid / order_completed | SERVER / Orders | Legal paid/completed transition; completion does not prove a Review Grant. |
| handoff_verified | SERVER / Handoff | Accepted stage, method, fulfilment and recipient class; PICKUP differs from final DELIVERY. |
| review_grant_created | SERVER / Reviews | One unique ordinary Buyer/Order opportunity from FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; final_handoff_id only for actual final DELIVERY. Basis-aware Seller feedback and received-line quality remain separate. |
| review_invitation_delivered / opened | SERVER / Notifications; approved CLIENT open | Distinct delivery and opened observations, never Grant or Review publication. |
| review_published | SERVER / Reviews | Accepted publication with separate Product-quality and Seller-service dimensions. |
| claim_opened / decision_recorded / corrected | SERVER / Claims | Structured scope/outcome facts; allegation remains distinct from finding. |
| trust_transitioned | SERVER / Trust | Policy-versioned NEW/REBUILDING/ESTABLISHED/TRUSTED transition. |
| seller_social_verification_completed | SERVER / Onboarding | Approved control method/outcome; no private verification evidence. |

## 12. Event Versioning

Released event meaning is immutable. Breaking schema, identity or Scene semantics require a new registered version and producer rollout. New writers reject deprecated versions; historical raw events are not renamed in place. A versioned compatibility transformation may map old payload semantics into an explicitly identified reporting view. Reports retain source_event_version and transform_version for reproducibility.

## 13. Event Envelope

| Field | Requirement / semantics |
| --- | --- |
| event_id / event_name / event_version | Server storage identity and exact closed-registry version. |
| source / source_domain | CLIENT or trusted SERVER owner adapter; inferred/authenticated rather than accepted blindly. |
| occurred_at / received_at | Bounded event-time estimate and server ingestion time. |
| scope / market_id / originating_market_id | Explicit GLOBAL or MARKET registry scope. Required canonical market_id for MARKET; GLOBAL omits it and may carry validated originating_market_id. |
| account_id | Ordinary Account only, server-resolved; optional for approved anonymous behavior. |
| principal_type / operator_account_id | ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or authenticated SERVER SYSTEM; mutually exclusive runtime shape. Separate Operator identifier; no fabricated ordinary Account or public SYSTEM. |
| anonymous_id | First-party random identity; no fingerprinting. |
| seller_context_id / acting_context | Authorized relevant Seller, Buyer or Courier relationship dimensions around one ordinary identity. |
| app_session_id / client_event_id | Connected behavioral session and stable retry identity. |
| server_event_id | Stable trusted source-domain event/outbox identity for server dedup. |
| feed_session_id / impression_id | FYP-specific context, not general session identity. |
| scene_post_id / scene_revision_id | Exact historical Scene object and revision where relevant. |
| search_session_id / query_id | Bounded Search journey context; not arbitrary raw query capture. |
| source_surface / app_version / platform / locale | Closed shipped surface enum and bounded values. |
| properties | Event-specific typed, depth/cardinality/size-limited payload. |

No OTP, QR, phone, raw address, Chat body, Review text, provider secret, KYC document or Operator note is a general event property.

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

## 14. Client Event Identity

Each client observation receives a random client_event_id when created. The identifier is reused for duplicate HTTPS retry attempts during the same connected delivery lifecycle. The Analytics client does not persist an event backlog across app restarts. If a low-priority event cannot be delivered after bounded retry while the session remains connected, it may be discarded.

A repeated real action receives a new identifier. Reusing one ID for several user actions would collapse valid behavior.

## 15. Server Event Identity

Server analytics facts use deterministic or source-carried server_event_id values from the canonical domain outbox event. Replayed domain events therefore upsert/deduplicate safely without inventing a second business identity.

## 16. Event Deduplication

Uniqueness is enforced by source + identifier + event semantic version as appropriate. Ingestion returns per-item results so one duplicate or invalid item does not reject an otherwise valid batch.

```
CLIENT UNIQUE: (source=CLIENT, client_event_id)
SERVER UNIQUE: (source=SERVER, server_event_id, event_name, event_version)
```

```
Duplicate delivery -> ACK as duplicate / no second metric contribution
```

## 17. Time Semantics

Store occurred_at and received_at separately. Server facts also retain canonical domain timestamps where supplied. Market-local reporting dates are derived using the effective Market timezone; raw instants remain UTC/timestamptz.

## 18. Clock Skew

Client clocks are untrusted. Large skew is flagged and bounded for sequence analysis. Server facts use source-domain time. Metrics requiring ordering prefer server receipt/domain timestamps when client time is implausible.

## 19. Connected Client Delivery

Adulis Mobile requires an active network connection for product operation. Analytics therefore uses a small in-memory queue only for batching and immediate connected retry. It does not create a durable telemetry replay subsystem.

• No analytics event is treated as a business command.

• Failure to deliver low-priority behavior telemetry does not fabricate later events.

• When connectivity is unavailable, the application itself cannot complete network-dependent commerce actions.

• Critical business outcomes still exist because they are produced server-side by canonical domains, not recovered from client telemetry.

## 20. Batching

Batching reduces radio/network overhead while the app is active and connected. Flush on bounded count/bytes, short timer, app background transition when network is still available, and explicit high-value navigation boundaries. Use gzip where beneficial.

Do not create one BullMQ job per impression. Insert client batches in bulk and schedule coarse projection work by partition/watermark.

## 21. Ingestion API

Conceptual endpoint: POST /v1/analytics/events. Request contains a bounded list of typed event envelopes. Authentication is optional for anonymous browse events but, when a session exists, server identity overrides client-supplied identity.

```
POST /v1/analytics/events
{
  "events": [ ... bounded typed events ... ]
```

```
}
```

```
200/207 style per-item result:
accepted | duplicate | schema_rejected | source_forbidden | context_rejected
```

## 22. Validation

• Reject unknown event_name/version pairs.

• Reject CLIENT attempts to emit server-only payment, Order, Handoff, Claim, Trust, Review or moderation facts.

• Bound event count, payload bytes, nesting depth, string length and array length.

• Validate Market and Seller context against authenticated/server context; never trust arbitrary tenant IDs.

• Forbid secret-bearing fields by schema and log redaction.

• Validate source_surface enum and entity type enum.

• Rate-limit ingestion without blocking canonical commerce APIs.

## 23. Schema Registry / Typed Events

Analytics contracts are generated/validated from one versioned TypeScript schema registry used by Mobile, Web/Seller Console and NestJS ingestion. OpenAPI describes transport; event definitions describe semantic payloads. CI fails when a producer emits an undeclared event or a projection consumes an unsupported version.

Canonical domain-source adapters validate event_type/event_version against Contract_Registry before mapping to the separate analytics schema/version. Claim correction, verified completion and Review eligibility reversal preserve source revision/effect lineage; unknown versions do not become new observations by guessing.

## 24. Anonymous Identity

Anonymous browsing uses a random first-party anonymous_id generated by Adulis. It is not derived from hardware characteristics, advertising IDs or fingerprinting. Rotation/deletion policy is governed by Privacy.

## 25. Account Linking

Ordinary account_id is one stable human identity resolved by Auth; Buyer/Seller/Courier acting dimensions do not create separate person graphs. Anonymous linkage is first-party and policy-controlled. Do not attach a separate Operator Account to this graph or infer identity from shared device, IP, contact list or social handle.

Deletion tombstones and unlink policy apply before late events or replay. A delayed server fact cannot resurrect deleted ordinary Account linkage.

## 26. Sessions

Use separate session concepts because they answer different questions:

• app_session_id - general foreground connected usage.

• feed_session_id - one FYP browsing session/cursor lineage.

• search_session_id - bounded query/reformulation journey.

• checkout/order IDs - canonical commerce identifiers from server domains, not client sessions.

## 27. Market Context

The architecture is globally extensible with explicit phased Market activation. Ethiopia is the initial commerce Market, beginning with Addis Ababa. Future Markets require approved currency, provider, legal, commercial and operational readiness. Locale, IP address, phone prefix and client country never activate commerce.

Live commerce events use the canonical activated Market and recorded currency/policy scope. Historical records retain the Market version that governed their occurrence. Ethiopia reporting and commercial rules do not silently apply to other future Markets.

ANONYMOUS_PUBLIC behavioral intake is validated for its approved public purpose; it is never SYSTEM. Registered SERVER global Account lifecycle may use GLOBAL scope and optional validated originating_market_id. Commerce and Market content events use MARKET scope with canonical market_id; cross-Market history preserves each record rather than assigning an Account an owner Market.

## 28. Seller Context

Seller-scoped events carry seller_context_id only when needed. Server authorization and resource ownership determine Seller context. Seller dashboards are tenant-scoped and must not expose Buyer identity or another Seller's private metrics.

## 29. Source Surface Taxonomy

```
source_surface = FYP | SHOP | SCENE_POST | PRODUCT_POST
  | SELLER_STOREFRONT | SELLER_PROFILE | SEARCH | COLLECTION
  | CHAT | NOTIFICATION | SHARED_LINK | DIRECT | CHECKOUT
buyer_home_tab = FOR_YOU | FOLLOWING | NEARBY | DISCOUNTS | LOCALLY_MADE
```

Only shipped surfaces emit live events. For You impressions use FYP; every other Home tab retains its independent semantics. A generic tab open is not conversion attribution; create attribution at an explicit qualified discovery or Product interaction.

## 30. FYP Attribution

For You top-level qualified impressions reference Scene Posts only. Require feed_session_id, impression_id, scene_post_id, scene_revision_id, seller_id, algorithm_version, candidate_source and position, plus canonical Market and served eligibility context. Product-tag opens remain Product commerce destinations with exact Scene provenance.

Candidate delivery is not an impression. Signed/validated served context and current Content gates prevent a stale PRIVATE Scene from generating legitimate new impressions. SDK stops reporting after canonical invalidation; response-time serving fails closed even while projections lag.

![Current Scene gates and immutable attribution](graphics/ANL_02.svg)
*Figure 02. Current Scene gates and immutable attribution. Analytics cannot change Content state or use retained history to restore public access.*

## 31. Impression Semantics

Candidate generation, server response and rendering are different facts. A returned feed unit is not automatically an impression. Client measurement records an impression only after the defined visibility condition is met. Re-exposure that independently meets the threshold receives a new impression_id.

Current PRIVATE, archived, removed or unsafe content is not a legitimate new public impression. A bounded delayed observation that truly occurred while valid remains historical under its occurred_at and served revision/version; it does not rewrite current visibility.

## 32. Qualified Impressions

The current metric definition should be versioned. A practical launch baseline is at least 50% of the Scene Post card visible for at least 500 ms while the app is foregrounded and the card is not occluded. Exact values belong to the metric definition, not scattered UI code.

Qualified impressions are suitable denominators for CTR, save rate, dwell and product-tag interaction. Server candidate count remains a separate operational metric.

## 33. Photo Dwell

Photo dwell measures bounded meaningful on-screen time for a qualified Scene Post impression. Pause when the card is no longer meaningfully visible or the app loses foreground focus. Aggregate locally in memory and emit one bounded dwell observation rather than high-frequency timer ticks.

Adulis has no native video measurement pipeline. Do not create playback-duration, video-completion, frame-playback or streaming-quality events. A TikTok embed on Product Post detail may have open/load/error interaction events only.

## 34. Scene Post attribution

Scene attribution records scene_post_id, exact scene_revision_id, Seller and Market, originating interaction, source_surface, algorithm/candidate context when relevant and policy-approved attribution window. Content alone changes visibility. Historical attribution and revenue context remain immutable after PUBLIC/PRIVATE transitions.

Stock-driven PRIVATE stops new public discovery and new impressions; restock PUBLIC allows fresh observations with current revision/version. Historical provenance is not permission to open a currently private Scene. Analytics never archives or restores Content.

## 35. Search Attribution

Search supports PRODUCT_POST, SELLER and SCENE_POST at launch. Every result observation carries search_session_id, query_id, result_type, result_id, position, Search version and Market; Product-from-Scene opens preserve exact revision provenance. Type-specific clicks and conversion funnels remain distinct.

Raw query text is not a default analytics field. Use approved bounded categorization or a justified privacy-reviewed query sample with explicit retention. Unknown result types fail the registry rather than coercing to Product.

## 36. Collection Analytics

Collections supports two canonical saved-item types: PRODUCT_POST and SCENE_POST. Accepted membership facts from Collections establish saves/removals, not client button clicks. A saved private Scene stays historical membership but cannot bypass current visibility; saved membership never becomes a Buyer restock subscription.

Measure accepted saves, removals and subsequent authorized opens with item type, opaque item reference, Seller and Market and exact Scene revision where required. Collection names, private collection contents and Buyer identities are not exposed to Sellers.

## 37. Product Post Analytics

Product Post analytics measures detail opens, image carousel interaction, Variant selection, availability presentation, saves, add-to-cart/checkout intent and downstream provider-verified commerce. Product Post is the canonical one-Product commerce destination.

If an approved TikTok embed is available, measure explicit embed request/load/failure and outbound/provider interaction where observable. Do not infer playback duration or completion from an external embed.

## 38. Storefront Analytics

Storefront measures seller visit, Product Post view, Scene Post view, product-tag open, share, app-open intent and checkout handoff. Public web analytics never establish Cart, payment or Order truth. Canonical server outcomes are joined later through attribution identifiers where available.

## 39. Chat/Chatbot Analytics

Chat Conversation is one ordinary Buyer + Seller + Market relationship. Immutable Message subject is NONE, PRODUCT_POST, SCENE_POST or ORDER. Product selected from a Scene is PRODUCT_POST primary with exact Scene provenance; conversation subject or later composer selection must not rewrite earlier attribution.

Record bounded intent/outcome, Message-context references and approved Bot version/locale coverage, never raw Chat body. Optional Bot completeness/localization evidence may be delivered as versioned metadata; Recommendation independently ignores, caps, experiments with or disables it. No fixed localization rank multiplier or guaranteed impression promise is a contract.

## 40. Commerce Server Events

Commerce server facts come from the canonical owner’s committed outbox/event adapter, with stable source-domain identity and safe Market/Order/line references. Finance payment/refund/settlement, Orders paid/completed, Handoff pickup/final receipt, Reviews Grant/publication, Claims outcomes and Trust transitions are not client events.

Business changes and required event_outbox and/or job_intent commit in the same PostgreSQL transaction. The shared Eventing relay leases durable intent, creates versioned event_delivery records from its consumer registry and deterministic BullMQ jobs after commit. BullMQ on Valkey is the sole ordinary background execution engine. Delivery is at-least-once; workers re-read current canonical scope/state and use PostgreSQL uniqueness and processed-effect markers. Repair, dead-letter review and bounded reconciliation recover outages; no correctness-sensitive PostgreSQL-to-Valkey dual write is allowed.

Analytics lag never rolls back or blocks these owner transactions. Ordinary behavioral overload is shed or batched before canonical services are affected.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

## 41. Checkout/Order Attribution

Checkout copies a validated attribution snapshot into the independent Seller Order scope. One Seller-specific paid outcome references its own immutable amount/currency and policy; sequential multi-Seller payment is measured independently, without merging unrelated failures or granting all Orders one success.

PaymentAttempt created, provider processing, backend verified, Order PAID, provider settlement, accepted final receipt and Order completion are separate server facts. Missing/invalid attribution degrades measurement, never Checkout correctness. Client return cannot count as paid conversion.

## 42. AttributionContext

AttributionContext is a typed navigation/command object separate from RequestContext and business state. It is created at a meaningful discovery touch, replaced by a later direct touch, validated for Market/entity consistency server-side, and size-bounded.

A small Zustand store may hold the current in-memory navigation context. It is not transaction truth and is not a persistent behavior log.

Use current Scene identity and exact revision; typed Product/Order references and originating immutable Message context where applicable. Historical source metadata survives current visibility loss without restoring public access or changing its stored Seller/Market scope.

## 43. Conversion Attribution

MVP uses last meaningful discovery touch as the direct conversion source with a versioned attribution window. Assisted-touch analysis may use bounded prior analytics history. The model describes measurable association; it does not claim causality.

## 44. Attribution Models

Two query views are sufficient for launch:

• Direct attribution: one immutable source snapshot associated with the Seller Order/payment outcome.

• Assisted discovery: bounded preceding Scene Post/Product/Search/Storefront/Collection touches joined from Analytics for product/recommendation analysis.

Weighted ad attribution, view-through advertising identity and cross-device advertising graphs are deferred.

## 45. Claim/Cancellation Attribution

Discovery history is not erased by a later cancellation, refund or Claim. Quality-adjusted reports show paid Orders, completed Orders, cancellation rate, Claim rate, upheld-Claim rate and refund/remedy outcomes using canonical server facts.

Claim rate = DISTINCT qualifying affected verified-paid Seller Orders / DISTINCT eligible verified-paid Seller Orders in the SAME purchase cohort, including paid non-delivery. Select by canonical verified-payment cohort date and Market timezone; assign one Order once despite line/multiple Claims and retain inspectable membership. An effective metric policy must specify cohort window, maturity, late closure/reopening/correction, exclusions and minimum samples. Zero denominator returns INSUFFICIENT_EVIDENCE, never zero/perfect or division by zero. No numerator Order exists outside its denominator. Missing maturity/calibration is PENDING; do not deploy recalibrated demotion thresholds as validated.

The existing 10 purchased Product units per Buyer-Seller policy week cap applies only to favourable evidence/promotion credit. Keep its existing whole-Order threshold-crossing treatment for favourable QR/Review credit. Confirmed adverse findings remain countable at 9/10/11/20 units and across split Orders; caps cannot hide genuine Seller fault, cancellation or unresolved remedies. Independent abuse/duplicate review can invalidate proven false evidence with correction lineage, not a volume-based adverse blind spot.

## 46. Review Analytics

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

| Review funnel fact | Measurement rule |
| --- | --- |
| Qualifying final DELIVERY | Accepted Handoff evidence, method and recipient class; no PICKUP eligibility. |
| review_grant_created | Reviews server fact anchored to final_handoff_id and ordinary Buyer. |
| Invitation delivered | Notification delivery fact; distinct from logical notice, Grant and Review. |
| Invitation opened | Approved client observation; not proof of Review submission. |
| review_published | Reviews accepted publication; separate Product-quality and Seller-service dimensions. |

Delegate receipt attributes the Grant to the Buyer, never to delegate authorship. A completed Order is not a Grant-created event. Review text is forbidden in general Analytics; ratings, structured outcome categories and publication references are bounded.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

## 47. Trust Analytics

Trust alone owns NEW, REBUILDING, ESTABLISHED and TRUSTED and its policy-versioned consequences. Generic accepted receipt is separate from stronger QR promotion evidence: qualifying final Buyer/delegate QR receipt may count under Trust policy; OTP and Manual do not automatically receive QR credit. Upstream domains expose safe method/purpose facts and never set Trust levels or promotion math.

Measure canonical transitions and policy-versioned evidence categories only. Analytics must not generate a hidden alternative reputation score or rewrite level from CTR, admission, paid features or raw allegations.

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

## 48. Moderation Analytics

Measure report volume, target type, decision class, time-to-review, appeal/restoration and removal effectiveness using pseudonymous/aggregate fields. Sensitive case notes and reporter identity remain outside general analytics.

## 49. Notification Analytics

Preserve notification_id, template/version, channel, send/delivery/open outcome and source context. Opening a notification may create a later meaningful Product/Scene Post touch. Delivery/open does not prove causation.

## 50. Seller Analytics

Seller analytics is current Seller-tenant scope and ordinary effective permission/surface controlled. Report bounded aggregates with freshness, metric version, time window, Market and privacy thresholds. ANALYST is read-only; no report reveals ordinary Buyer IDs, private Collections, raw Chat, Review text, Claims narrative or provider/KYC evidence.

Creator profile metadata can be a policy-enabled cohort label; a separate Creator commerce analytics namespace is deferred unless explicitly ratified. Switching context never expands scope.

## 51. Product Post Analytics Projections

Example daily projection:

```
analytics.product_post_daily_metric
  market_id
  seller_id
  product_post_id
  date_local
  detail_opens
  saves
  add_to_cart
  checkout_starts
  paid_orders
  completed_orders
  merchandise_gmv_minor
  claim_count
  upheld_claim_count
  metric_version
  updated_at
```

Projection jobs are idempotent and operate from watermarked raw/server fact ranges.

## 52. Scene Post analytics projections

Scene projections retain exact object/revision, Seller/Market, qualified impressions, tag opens, accepted whole-Scene saves, attributable Checkout/paid outcomes and versioned quality diagnostics. Content visibility is read-only source truth. Stale projection/cache cannot serve a PRIVATE Scene or manufacture new impressions.

Historical aggregates do not change when the current Scene becomes PRIVATE. Rebuilds preserve event and metric versions and apply current privacy tombstones.

## 53. FYP Performance Analytics

Recommendation consumes bounded derived features, not raw-event scans per request. Useful aggregates include qualified exposure, photo dwell, save/share rate, product-tag interaction, Product Post open rate, checkout rate, provider-verified payment rate, completion rate, negative feedback, freshness and exposure concentration.

All ranking features record feature-version/freshness. Recommendation may use them only as signals; Analytics never makes eligibility or purchase decisions.

## 54. Search Performance Analytics

Measure query volume, zero-result rate, result CTR by entity type, reformulation, Product/Scene Post open, downstream checkout and paid/completed conversion. Keep Search quality analysis separate from Search ranking authority.

## 55. KPI / Metric Catalogue

Each metric definition records owner, version, numerator, denominator/population, inclusion/exclusion, attribution window, reporting window, Market timezone, freshness and privacy rules. No example ratio is a universal business formula.

| Metric / outcome | Versioned definition and canonical source |
| --- | --- |
| Conversion rate - primary | Approved qualifying paid purchase numerator and defined eligible visit/Checkout population; source and attribution windows are explicit. |
| Purchase frequency - primary | Qualifying paid/completed purchases within a defined active-Buyer population/window; cancellations/refunds, Market timezone and inclusion policy are explicit. |
| Buyer satisfaction - primary | Approved post-purchase satisfaction evidence, structured Reviews, Claims/refunds/cancellations, repeat behavior and negative feedback; versioned composition, not dwell or one signal. |
| Qualified FYP CTR / Scene save rate | Meaningful opens/tag interactions or accepted whole-Scene saves over qualified Scene impressions; diagnostic. |
| Product save / Checkout conversion | Accepted Product saves and defined Checkout starts over the metric’s Product-view/visit population. |
| Paid conversion / completion | Provider-verified paid Seller Orders and legal completed Orders over their defined populations. |
| Claims / fraud / disputes | Structured canonical Claims/Moderation/provider outcomes; allegations distinguished from adjudicated findings. |
| Low-quality content / Trust deterioration | Content/Moderation quality evidence and Trust-owned transitions under current versions. |
| Cancellation / refund / negative feedback | Canonical owner outcomes with defined time and reason categories. |
| Exposure concentration / fairness | Versioned Seller/group exposure shares and complaint evidence; no guaranteed equal placement. |
| Merchandise / attributed GMV | Canonical merchandise subtotals for approved states, joined only to valid attribution; excludes delivery and platform surcharge. |

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Claim rate = DISTINCT qualifying affected verified-paid Seller Orders / DISTINCT eligible verified-paid Seller Orders in the SAME purchase cohort, including paid non-delivery. Select by canonical verified-payment cohort date and Market timezone; assign one Order once despite line/multiple Claims and retain inspectable membership. An effective metric policy must specify cohort window, maturity, late closure/reopening/correction, exclusions and minimum samples. Zero denominator returns INSUFFICIENT_EVIDENCE, never zero/perfect or division by zero. No numerator Order exists outside its denominator. Missing maturity/calibration is PENDING; do not deploy recalibrated demotion thresholds as validated.

## 56. Metric Versioning

Metric semantic changes increment metric_version. Reports show metric version, event/transform compatibility, cohort/window, Market timezone and freshness. Historical comparisons require an explicit compatible definition or side-by-side versions; never silently restate old reports under a new numerator or population. Responsible product/domain owners approve primary outcomes and guardrail definitions.

## 57. GMV and Revenue Measure Boundaries

Backend-verified provider facts alone establish payment, refund and settlement truth. Chapa is the first named Ethiopia provider only where the current Market route is enabled. Browser returns, screenshots, Seller confirmation and Chat statements cannot establish PAID. The current transaction charge is the server-calculated zero launch Adulis Buyer surcharge (0 bps), with exact currency rounding and an immutable Commercial Policy snapshot displayed before explicit confirmation. Paid Order, provider settlement and physical receipt are independent.

| Measure | Distinct reporting basis |
| --- | --- |
| Merchandise GMV | Captured Product-line merchandise subtotal under defined inclusion states. |
| Delivery charge | Separate captured fulfilment/delivery amount. |
| Adulis Buyer surcharge | Exact server zero at launch / zero-bps Commercial Policy snapshot; no Seller commission obligation inferred. |
| Buyer total | Canonical sum of disclosed Checkout components under currency rounding policy. |
| Refund | Finance/provider-confirmed amount and component/policy basis, separately reported. |
| Settlement | Provider-reported Seller settlement status/amount; not Buyer payment or physical receipt. |

Analytics does not recalculate money from clicks or assume every surcharge is refundable. The immutable Commercial Policy and Finance facts determine component treatment.

## 58. Experiments

Experiments use deterministic assignment, immutable configuration/version, explicit exposure units, ramp/holdout policy, analysis window and rollback owner. Vary bounded Recommendation features or ranking policy without changing hard Content eligibility, price, Inventory, payment authorization or Trust truth.

Primary outcomes are conversion rate, purchase frequency and Buyer satisfaction. Stop or roll back on configured material Trust, fraud/dispute, completion, quality, fairness/concentration, complaint, cancellation/refund, conversion or satisfaction harm even if CTR or dwell rises. Thresholds/confidence and automated versus manual action are explicitly versioned policy.

![Buyer outcomes and guardrails govern experiments](graphics/ANL_03.svg)
*Figure 03. Buyer outcomes and guardrails govern experiments. Dwell and CTR are diagnostics; they are not Buyer satisfaction.*

## 59. Bot/Internal Traffic

Classify staff test accounts, synthetic monitoring, load-test clients, known crawlers and preview environments. Keep the raw classification reason restricted and provide standard report filters so internal traffic does not distort product metrics.

## 60. PII Minimization

General analytics stores identifiers only where necessary for measurement, tenancy and controlled joining. It must not store authentication OTPs, social-control verification codes, provider tokens, private social messages, payment credentials, Handoff QR/OTP contents or raw Chat bodies.

Seller verification analytics records only safe status/method metadata such as TIKTOK_LOGIN_KIT, INSTAGRAM_LOGIN_KIT or SOCIAL_DM_FALLBACK plus outcome/reason category and timestamps. The evidence itself remains in the owning onboarding/security boundary.

## 61. Access Control

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

Ordinary analytics access uses current effective Seller permissions and resource scope. Privileged event paths use typed Operator identity only when justified; general product telemetry prefers aggregates. Private evidence access is a source-domain capability, not an Analytics export permission.

## 62. Storage Architecture

PostgreSQL stores partitioned bounded raw observations, server-fact identities, attribution snapshots, metric definitions, projection rows and watermarks. Bulk/coarse workers avoid per-impression jobs. Valkey may coordinate throttles and short derived caches, not canonical measurement identity or commerce state.

Business changes and required event_outbox and/or job_intent commit in the same PostgreSQL transaction. The shared Eventing relay leases durable intent, creates versioned event_delivery records from its consumer registry and deterministic BullMQ jobs after commit. BullMQ on Valkey is the sole ordinary background execution engine. Delivery is at-least-once; workers re-read current canonical scope/state and use PostgreSQL uniqueness and processed-effect markers. Repair, dead-letter review and bounded reconciliation recover outages; no correctness-sensitive PostgreSQL-to-Valkey dual write is allowed.

Shared OLTP resource budgets, retention partitions, bounded query windows and freshness alerts protect commerce. A warehouse can be introduced later from measured load; no new ordinary background engine is added.

## 63. Raw Events

Raw event properties are typed and bounded. Frequently queried dimensions may be promoted to indexed columns. Avoid giant JSONB objects and uncontrolled property cardinality. Partition management, retention and index review are explicit operational responsibilities.

Historical raw schema and privacy/retention metadata remain immutable while permitted; explicit versioned transformations interpret released old contracts. New producers are not granted deprecated write aliases.

## 64. Projections

Dashboards and ranking features read precomputed projections rather than scanning raw events or source-domain OLTP tables. Projection writes are idempotent, watermarked and rebuildable from retained inputs where policy allows.

## 65. Real-Time vs Batch

Use synchronous ingestion acknowledgement only for event acceptance, not for dashboard recomputation. Near-real-time needs such as FYP feature freshness can use short periodic/coarse jobs. Seller reporting can tolerate longer aggregate cadence. Canonical payment/order facts remain immediately available from their owning domains regardless of Analytics lag.

Do not add a streaming platform merely to make dashboards appear instant.

## 66. Recommendation Feature Pipeline

Analytics delivers bounded affinity, quality and exposure features with feature_version, metric/event semantics, generated_at, freshness and privacy scope. Recommendation owns candidate/ranking decisions and current hard eligibility; it never scans raw event history per request.

Optional Bot locale completeness/quality metadata has its own version and freshness. Recommendation can ignore, cap, experiment with or disable it; no fixed multiplier, guaranteed impressions or localization-owned rank is promised. Primary outcomes and canonical guardrails constrain experiments.

## 67. Late Events

Server events may arrive late because of retries, provider webhook delay or queue backlog. Client batches may also arrive after short connected retry. Projections use occurred_at + received_at, watermarks and bounded backfill windows so late arrival can update affected aggregates without double counting.

## 68. Data Quality

Continuously measure:

• event rejection rate by app/event version;

• duplicate rate and batch partial-failure rate;

• server-fact lag from canonical event to Analytics receipt;

• projection watermark age;

• unknown/invalid source-surface rate;

• missing Market/Seller context rate;

• FYP candidate-delivered vs qualified-impression ratio;

• payment/order reconciliation mismatch counts;

• event volume spikes/drops after releases.

## 69. Reconciliation

Reconcile server-derived payment, paid/completed Order, accepted Handoff, Reviews Grant/publication, Claims outcome, Trust and Content visibility projections against their owner APIs/outbox identities. Missing canonical facts can be replayed idempotently through authorized adapters. Behavioral observations that never arrived cannot be reconstructed as facts.

Reconciliation applies event/metric version, privacy tombstone, current retention and watermark checks. It repairs derived measurement only and never mutates commerce or restores deleted person linkage.

## 70. Retention

Assign each event and projection an explicit retention class controlled by Privacy/Data Lifecycle and Market policy. High-volume behavior may have shorter raw retention than compact aggregates. Financial/order-linked analytics references must respect canonical retention/hold requirements without copying protected source evidence unnecessarily.

## 71. Deletion Integration

Account deletion signals Analytics through the Privacy lifecycle. Where policy requires deletion/anonymization, remove direct Account linkage while preserving allowed aggregate statistics and legally retained canonical business records in their source domains.

Deletion tombstones/versions protect against delayed server-event replay reattaching erased personal linkage.

Deletion forbids re-linking an ordinary Account via delayed outbox facts or historical compatibility transforms. Legal domain evidence holds remain bounded at their source and do not authorize a general Analytics identity archive.

## 72. Security

• Treat every client analytics payload as untrusted input.

• Use HTTPS/TLS; validate source, schema, size, Market and Seller scope server-side.

• Never put provider secrets, auth tokens, payment credentials or verification codes in analytics properties.

• Rate-limit ingestion using @nestjs/throttler and shared abuse policy.

• Use @fastify/helmet where relevant to web/API surfaces.

• Keep analytics DB credentials scoped; Seller-facing read endpoints never expose raw events.

• Redact Sentry/Pino breadcrumbs and do not log whole analytics request bodies by default.

## 73. Failure Behavior

| Failure | Required behavior |
| --- | --- |
| Analytics ingestion unavailable | Product/commerce flow continues if required platform APIs are healthy; low-priority client observations may be lost |
| Valkey unavailable | Canonical events remain in PostgreSQL; projection/cache work slows or retries |
| BullMQ worker unavailable | Raw/server facts persist; projections become stale and alert |
| PostgreSQL unavailable | Analytics writes fail; source domains remain authoritative |
| Provider webhook delayed | Finance/Order reconciliation establishes truth; Analytics receives later server fact |
| Projection bug | Stop affected consumer, fix, rebuild from retained canonical/raw inputs |
| Schema mismatch after release | Reject unknown version, alert by app version, preserve other valid batch items |

## 74. Observability

Use Sentry for error capture, Pino structured logs with request/correlation/batch/event-version context, PostgreSQL pg_stat_statements for query regressions, BullMQ/Valkey queue metrics, ingestion counters and projection freshness dashboards. Never log entire event payloads by default.

## 75. Capacity & Cost Model

Capacity planning uses events per qualified session, batch size, bytes/event, raw retention, projection row counts and server-fact volume. Start in PostgreSQL and scale through batching, partitioning, indexes, retention and projection isolation before adding new infrastructure.

High-cardinality FYP behavior is the dominant launch volume. Avoid per-impression queues, per-event synchronous enrichment and one database query per card.

## 76. Testing

• Contract tests for every event version and source rule.

• Client cannot emit payment_verified, order_paid, handoff_verified, claim_resolved, review_published or trust-transition facts.

• FYP events accept Scene Post feed units only; Product Posts cannot masquerade as top-level FYP units.

• Photo dwell stops when visibility/foreground conditions fail.

• TikTok embed analytics emits interaction/load outcome only and never native video watch/completion fields.

• Collection save facts support PRODUCT_POST and SCENE_POST.

• Checkout attribution snapshot preserves exact Scene Post revision/Product/FYP context and survives later edits.

• Provider duplicate webhook -> one payment fact contribution.

• Seller scope/RLS prevents cross-tenant analytics reads.

• Social verification telemetry contains no code, token, phone or private message content.

• Account deletion and delayed server replay do not restore deleted direct linkage.

### Required current-contract regressions

| Test | Expected result |
| --- | --- |
| ANL-CANON-01 | New producer rejects deprecated content names/versions and requires registered Scene vNext. |
| ANL-CANON-02 | Historical released event payloads remain queryable without mutation. |
| ANL-CANON-03 | PRIVATE Scene yields no new legitimate FYP impressions after canonical propagation. |
| ANL-CANON-04 | Historical Scene attribution remains intact. |
| ANL-CANON-05 | Restock PUBLIC impressions carry current revision/version. |
| ANL-CANON-06 | CLIENT cannot forge scene_visibility_changed. |
| ANL-CANON-07 | Final DELIVERY-backed Reviews Grant server fact is measured. |
| ANL-CANON-08 | order_completed alone is not interpreted as Grant created. |
| ANL-CANON-09 | Delegated final receipt attributes Buyer Grant, not delegate author. |
| ANL-CANON-10 | Multiple ordinary acting contexts do not duplicate person graph. |
| ANL-CANON-11 | Operator Account never populates ordinary account_id. |
| ANL-CANON-12 | Ethiopia records retain Market policy without global application. |
| ANL-CANON-13 | No fixed localization multiplier contract exists. |
| ANL-CANON-14 | Guardrail rollback may occur while CTR rises. |
| ANL-CANON-15 | Valkey/BullMQ backlog does not block canonical commerce. |

## 77. Load Testing

Use k6 for ingestion throughput, batch-size envelopes, raw partition insert throughput, Seller dashboard reads and projection catch-up. Test viral FYP traffic with realistic batches and ensure PostgreSQL/Valkey/BullMQ saturation does not block canonical commerce APIs.

## 78. MVP Scope

Current MVP includes connected in-memory client batching, Scene photo discovery, Product destinations, all three Search result types, both Collection item types, immutable Chat context attribution, provider-backed commerce facts, receipt-or-verified-failure Review funnel, four-state Trust measurement, scoped Seller reports and primary Buyer outcomes/guardrails.

The architecture is globally extensible with explicit phased Market activation. Ethiopia is the initial commerce Market, beginning with Addis Ababa. Future Markets require approved currency, provider, legal, commercial and operational readiness. Locale, IP address, phone prefix and client country never activate commerce.

No persistent cross-session Mobile telemetry replay queue, fingerprinting, raw evidence analytics, native-video watch catalogue, paid organic rank or complete Creator product namespace is active.

## 79. Deferred Scope

• Dedicated warehouse/lakehouse, Kafka/Flink/Spark, feature store and stream-processing platform.

• Native Adulis video measurement pipeline.

• Cross-device advertising identity and multi-touch ad attribution.

• Automated causal-inference platform.

• External BI access to raw production events.

• Real-time neural recommendation training from event streams.

• Complex international data replication beyond the approved residency architecture.

## 80. Invariants

• ANL-INV-001 Analytics never establishes canonical Payment/Order/Handoff/Claim/Trust/Review state.

• ANL-INV-002 Client telemetry cannot emit server-only event definitions.

• ANL-INV-003 Released event semantics are immutable; changed meaning requires a new event version.

• ANL-INV-004 Client retries reuse one client_event_id; real repeated actions use new IDs.

• ANL-INV-005 Duplicate delivery is safe and does not double-count.

• ANL-INV-006 Every Market-scoped event records canonical Market context; locale does not determine Market.

• ANL-INV-007 Anonymous identity is first-party random and never fingerprint-derived.

• ANL-INV-008 FYP top-level impressions reference Scene Posts only and preserve exact published revision.

• ANL-INV-009 Product Posts remain commerce destinations and may be attributed from Scene Post tags or other sources.

• ANL-INV-010 Candidate delivery is not a qualified impression.

• ANL-INV-011 Photo dwell stops when content is not meaningfully visible/foregrounded.

• ANL-INV-012 No native video watch/completion metrics exist in the current event catalogue.

• ANL-INV-013 Attribution metadata cannot invalidate Checkout, payment or Order commands.

• ANL-INV-014 Provider-verified payment facts are server-only.

• ANL-INV-015 Merchandise GMV, delivery charge, Adulis surcharge and Buyer total remain distinct measures.

• ANL-INV-016 Raw Chat body and secret verification/payment/Handoff material are forbidden in general analytics.

• ANL-INV-017 Seller analytics never exposes Buyer identity and remains Seller-tenant scoped.

• ANL-INV-018 Metric definitions are versioned and historical reports identify metric version.

• ANL-INV-019 Analytics delivery has no persistent Mobile replay queue across app restarts.

• ANL-INV-020 Analytics outage cannot fabricate or block canonical business facts when the required platform services are healthy.

• ANL-INV-021 Low-priority client telemetry may be shed before product correctness is affected.

• ANL-INV-022 Raw event payload size/depth/cardinality are bounded.

• ANL-INV-023 Projection jobs are idempotent and watermarked.

• ANL-INV-024 Recommendation never scans raw events per FYP request.

• ANL-INV-025 Projections record freshness/version.

• ANL-INV-026 Canonical server-fact reconciliation is possible.

• ANL-INV-027 Behavioral observations that never arrived are never reconstructed as facts.

• ANL-INV-028 Raw events have explicit retention classes.

• ANL-INV-029 Account deletion cannot be undone by delayed server-event replay.

• ANL-INV-030 Sentry/Pino do not capture whole analytics payloads by default.

• ANL-INV-031 pg_stat_statements is used to detect analytics query regressions.

• ANL-INV-032 No one-by-one BullMQ job is created for each normal FYP impression.

• ANL-INV-033 Valkey is ephemeral coordination/cache infrastructure and never canonical Analytics truth.

• ANL-INV-034 Seller social-verification analytics stores method/outcome metadata only, not verification evidence.

• ANL-INV-035 All analytics writes/reads obey current Auth permission, surface and resource-scope rules.

• ANL-INV-036 Scene visibility is Content truth; Analytics cannot archive/private/public it.

• ANL-INV-037 Historical Scene attribution survives PUBLIC/PRIVATE transitions.

• ANL-INV-038 One ordinary identity may appear under several acting relationships without duplication.

• ANL-INV-039 Operator Account identity is distinct from ordinary Account identity.

• ANL-INV-040 Grant analytics follows Reviews’ final-Handoff-backed server fact.

• ANL-INV-041 order_completed does not independently prove Grant creation.

• ANL-INV-042 Fixed Chatbot localization multipliers are not an Analytics contract.

• ANL-INV-043 Conversion, purchase frequency and Buyer satisfaction are versioned primary outcomes.

• ANL-INV-044 Marketplace guardrails are measured from canonical facts.

• ANL-INV-045 Only explicitly active Markets produce live commerce metrics.

## 81. Open Decisions

Implementation choices still requiring product/operations ratification include metric windows and exact population definitions, satisfaction signal composition, material guardrail thresholds/confidence, retention budgets and later warehouse extraction. None may weaken canonical ownership. Search Scene results are launch scope; fixed localization boosts and native-video metrics are not open launch defaults.

## 82. Canonical Write-Backs

The following cross-system documents/contracts should inherit the current Analytics contracts where not already updated:

• Mobile: no persistent Analytics replay queue; connected in-memory batching only.

• Recommendation: FYP feed/impression events use Scene Post + revision identity and photo dwell only.

• Content/Catalogue: publish/archive/product availability events expose stable IDs/revisions needed by Analytics.

• Collections: server facts distinguish Product Post save from whole Scene Post save.

• Order/Finance: immutable attribution snapshot travels with one-Seller checkout/payment and normalized money breakdown.

• Onboarding: only safe social-verification method/status metadata is exposed to Analytics.

• Auth/Seller Console: Analytics views use the current role/surface permission model, especially ANALYST and CAMPAIGN_MANAGER.

• Privacy: retention/deletion contracts enumerate Analytics raw events, link tables and projections.

Write back current Scene event names and visibility read boundary; basis-aware Buyer/Order feedback funnel; typed ordinary/Operator identity; three Search types; two Collection types; Message-level provenance; exact Buyer surcharge component reporting; versioned primary outcomes and guardrails; shared Eventing replay/retention rules.

## 83. Implementation Sequence

| Phase | Build | Exit condition |
| --- | --- | --- |
| 0 - Contracts | Event registry, TypeScript types, source rules, metric registry | No undeclared production event |
| 1 - Ingestion | Connected in-memory batch client, NestJS endpoint, validation, dedup | Duplicate/retry safe |
| 2 - Discovery | FYP Scene Post impressions, dwell, Product tag opens, Product Post events | Discovery funnel reproducible |
| 3 - Commerce | Checkout attribution snapshot, provider/payment/Order server facts | Paid/completed conversion uses server truth |
| 4 - Projections | Product/Scene Post/Seller/FYP/Search daily metrics | Dashboards avoid raw scans |
| 5 - Quality | Claims, Reviews, Trust, Moderation, Notifications | Post-purchase quality joins available |
| 6 - Privacy/Security | Deletion, access control, sensitive-field enforcement | Privacy/security tests pass |
| 7 - Hardening | Reconciliation, k6, observability, partition lifecycle | Production launch gate passes |

Deploy current registry and producer version gates first; preserve historical raw semantics with explicit transforms. Add server owner adapters and Grant measurement, update feature/report definitions and scoped readers, then roll out guardrail dashboards after reconciliation and privacy tests.

## 84. Production Launch Gate

• Event registry is closed, versioned and consumed by all producers.

• Client cannot forge provider payment, Order, Handoff or Trust facts.

• FYP top-level event schema accepts Scene Posts only.

• No removed recommendation feature event names exist in the launch catalogue.

• No persistent Mobile Analytics replay queue exists.

• Photo dwell/qualified-impression semantics are versioned and device-tested.

• Product Post and whole-Scene Post-Post Collection saves are represented correctly.

• Checkout attribution snapshot is immutable and optional for commerce validity.

• Payment/Order reconciliation shows no unexplained double-counting.

• Merchandise GMV, delivery charge and Adulis surcharge reconcile to canonical server facts.

• Seller analytics access obeys Seller scope and current role/surface policy.

• Social verification telemetry contains no secrets/private evidence.

• Valkey loss does not erase canonical Analytics history.

• BullMQ backlog recovery is tested.

• PostgreSQL partitions/indexes pass k6 and pg_stat_statements review.

• Deletion/retention behavior passes Privacy integration tests.

• Sentry/Pino redaction and payload logging controls are verified.

• Final architecture and OpenAPI/generated clients are CI-consistent.

Require all ANL-CANON cases, current-state Scene serving, typed privileged identity, canonical Reviews Grant provenance, metric owner/version/window definitions, material-harm rollback, shared Eventing replay and OLTP/queue load isolation.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 85. Final Architecture Diagram

![Observations and trusted owner facts meet in versioned measurement](graphics/ANL_04.svg)
*Figure 04. Observations and trusted owner facts meet in versioned measurement. Raw historical semantics, attribution and privacy-aware projections remain distinct from canonical commerce authority.*

Client observation, canonical owner facts, immutable raw storage, versioned transforms/projections and scoped outcome reporting remain distinct. Current Content gates constrain serving while historical attribution survives visibility transitions.

## 86. Engineering Doctrine

Measure the exact observed object, revision, ordinary acting context, Market and version without turning measurement into business authority. Scene photo discovery reaches Product and confirmed provider commerce; final accepted receipt supports the Buyer Grant and quality outcomes. Outcomes, engagement and guardrails are distinct.

### Appendix A - Current technology placement

| Layer | Current implementation and authority |
| --- | --- |
| API / runtime | Node.js; NestJS + Fastify; strict TypeScript; REST/OpenAPI with @nestjs/swagger and generated TypeScript clients; @nestjs/throttler, @fastify/helmet and libphonenumber-js. |
| Canonical data | PostgreSQL + Drizzle; pg_trgm, btree_gist and pg_stat_statements; owner repositories, typed FKs, legal transitions and transactional outbox/job_intent. |
| Async / coordination | BullMQ on Valkey as the sole ordinary background engine; committed PostgreSQL intent, deterministic execution IDs, current-state revalidation and database idempotency. |
| Media | Cloudflare R2 + CDN and Sharp for image processing. Restricted evidence bytes use private, purpose-bound access. Native video is deferred from the photo-first discovery baseline. |
| Mobile | React Native + Expo; Expo Router, TanStack Query, FlashList, Expo Image, SecureStore, SQLite, Camera, Notifications and Updates; small Zustand UI stores. SQLite never establishes offline commerce acceptance. |
| Quality / operations | Jest, Testcontainers, Maestro, Playwright and k6; Sentry, Pino and database query diagnostics; dependency-cruiser; Docker, GitHub Actions, Render, Cloudflare and EAS. |

Analytics Mobile batching is in memory only; SQLite remains a wider platform component for separately approved non-authoritative caches, never persistent telemetry or Handoff sync. Coarse projection/reconciliation jobs use shared BullMQ and PostgreSQL watermarks.

### Appendix B - Error catalogue

| Code | Meaning / safe producer response |
| --- | --- |
| ANALYTICS_EVENT_UNKNOWN | Unknown name/version: reject, never coerce. |
| ANALYTICS_SOURCE_FORBIDDEN | Client forged server fact: reject and emit safe security count. |
| ANALYTICS_SCHEMA_INVALID | Typed field violation: bounded item-level rejection. |
| ANALYTICS_BATCH_TOO_LARGE | Count/byte cap exceeded: follow explicit request contract. |
| ANALYTICS_CONTEXT_INVALID | Market/Seller/object context mismatch: reject item. |
| ANALYTICS_DUPLICATE | Known event identity: acknowledge without second contribution. |
| ANALYTICS_RATE_LIMITED | Backoff/shedding; preserve product operations. |
| ANALYTICS_PROJECTION_STALE | Expose safe freshness state and alert. |
| ANALYTICS_METRIC_VERSION_UNSUPPORTED | Fail explicitly; never substitute silently. |

### Appendix C - Architecture fitness rules

• CI requires every producer definition in the closed registry with source, privacy, retention and dedup rules.

• New producers reject deprecated content event contracts while historical read transforms retain version provenance.

• CLIENT cannot emit provider/Order/Handoff/Claims/Trust/Reviews or Content visibility facts.

• FYP top-level schemas require Scene identity and exact revision; Search validates all three result types.

• Mobile Analytics has no persistent telemetry queue; one ordinary identity graph excludes Operator Accounts.

• Server facts require stable source-domain identity; Seller reads require current authorization/scope.

• Sensitive-field schema and log denylists exclude raw Review/Chat, credential, private evidence and KYC data.

• Load gates prove bounded Analytics work cannot saturate canonical OLTP resources.

## 87. Glossary

| Term | Meaning in this design |
| --- | --- |
| Ordinary Account | One human identity with Buyer, Seller and Courier acting relationships. |
| Operator Account | Separate internally provisioned privileged identity with current scoped capability. |
| Canonical owner | Domain whose legal command and PostgreSQL state establish the fact. |
| Market | Explicit activated commerce jurisdiction/configuration and effective version. |
| Scene Post | Photo merchandising/discovery content with separate publication and visibility. |
| event_outbox / job_intent | Required committed fact/effect intent persisted atomically with business truth. |
| BullMQ / Valkey | Ordinary async execution and non-canonical queue/cache infrastructure. |
| CLIENT / SERVER | Observed behavior versus trusted canonical owner fact; sources are registry-gated. |
| Attribution | Immutable exact historical context linking approved interactions and outcomes. |
| Metric version | Explicit population/window/inclusion and interpretation of measured evidence. |

## 88. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-01 — Buyer-facing Product / Scene terminology | The 13 October designs use Product Post and Scene Post as canonical domain names. | Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly. | PR-001 / PR-005, 26-27 Oct 2026 |
| R-03 — Buyer Home and social-commerce FYP presentation | The 13 October pack already defines For You / Following / Nearby / Discounts / Locally Made and a Scene-only FYP. | For You is the default Buyer Home channel and contains Scenes only; Products never become top-level FYP units. Home presents the five channels in a compact discovery row with Search and Notifications, with Seller Stories below. Scene cards are structured social-commerce cards, not full-screen video. Following is Seller-follow based; Nearby remains commerce-relevant without continuous/live GPS; Discounts and Locally Made are Product-led channels under their own eligibility rules. | PR-003, 26 Oct 2026 |
| R-05 — Final Scene engagement model | The 13 October designs define Scene commerce/discovery but do not fully freeze the later action bar and presentation. | Scene actions are Like, Save, Share, Reviews, Follow, More and Explore the Scene. Like belongs to the Scene only and no public Like count is shown. Save saves the Scene only. Follow is Seller-level. More may include Not Interested where applicable, Hide this Scene and Report. Public comments and reposts are not part of the current MVP. Explore the Scene is the primary commerce-exploration action. | PR-004, 26-27 Oct 2026 |
| R-07 — Final Product engagement model | Product Post remains the canonical structured commerce object. | Buyer-facing Product actions are Save, Share, Reviews, Ask Seller, Order and More/Report. Product has no Like, public comments or repost. Save is Product-only. Ask Seller opens the ongoing Buyer-Seller conversation with Product context. Order enters Cart/Checkout; opening a Product or using Buy Again never creates an Order or payment automatically. | PR-005, 27 Oct 2026 |
| R-08 — Review presentation and write eligibility | The 13 October Reviews design separates Product Quality and Seller Service and defines evidence-based eligibility. | Anyone may read Reviews. Product Reviews expose Product Review and Seller Review. Scene Reviews expose one Product tab per distinct tagged Product plus Seller Review. Write/Edit controls appear only when authoritative Review eligibility exists; ineligible viewers see no composer. Product Quality and Seller Service remain separate. One active Product Review and one active Seller Review are maintained per qualifying entitlement; edit updates instead of duplicating. Sellers cannot edit/delete legitimate Buyer Reviews; Report Review is a moderation utility. The prototype’s completed-order path does not silently remove the 13 October design’s VERIFIED_ORDER_FAILURE Seller-service basis; that failure basis remains valid unless a later founder decision explicitly removes it. | PR-005, 27 Oct 2026 |
| R-13 — Seller engagement analytics grouping | The 13 October Analytics design provides event/attribution architecture but not the final Seller-facing metric grouping. | Scene Performance prioritizes commerce outcomes (Explore opens, Product-detail visits, Seller inquiries, Orders initiated, verified completed Orders) before engagement counts (views, hotspot taps, Likes, Saves, Shares). Product Performance includes views, Saves, Product rating, inquiries and Order outcomes. Seller Reputation keeps Seller rating, Product ratings, verified completed Orders, service quality and Trust separate. Do not blend popularity and Trust into one score. | PR-007, 27 Oct 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
