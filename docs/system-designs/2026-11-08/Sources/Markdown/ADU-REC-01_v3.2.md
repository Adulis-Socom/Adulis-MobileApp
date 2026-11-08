# Adulis FYP & Recommendation Engine
Version 3.2 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.1 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Complete amended baseline: 12 October 2026. The supplied correction prompt and owner decisions supersede the conflicting reviewed source wording. Every original numbered body section and unaffected table/graphic is retained; targeted contracts, examples, tests, invariants and dependent definitions are reconciled. The historical audit remains unchanged.

| Document control | Amendment baseline |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026 -> 3.2 post-October-13 reconciled 8 November 2026. |
| Source | ADU-REC-01_Adulis_FYP_Recommendation_Engine_System_Design_v3.1.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Executive Summary

Adulis For You is the default personalized Buyer Home recommendation surface for photo-only Scene Post discovery. GET /v1/fyp returns ScenePostFeedUnit only; Product Posts remain commerce detail destinations reached through tags, Search, Shop, Seller profile or direct links. Scene Post is the canonical object, not a presentation alias.

This complete v3.0 / 7 October 2026 edition retains deterministic/config-driven V1 candidate generation, hard gates, ranking, fair exposure, sessions, telemetry, commerce evidence, experiments and recovery. Current Content-owned PUBLIC/PRIVATE lifecycle, ordinary Account and phased Market rules supersede conflicting v2 assumptions. Recommendation excludes ineligible Scenes and never publishes, archives or changes their visibility.

## 2. Mission

Recommend the next safe, relevant and commercially useful Scene Post without allowing engagement optimization to override product truth, seller eligibility, Market boundaries, moderation or verified commerce facts.

## 3. Current Product Model

Scene Post / ScenePost / SCENE_POST is the canonical Seller-authored image content object with caption, immutable revisions and same-Seller Product tags. Product Post is the structured commerce destination for exactly one Product. Scene context and historical provenance never establish current price, Variant availability, stock, Checkout totals or payment state.

Content owns publication_state DRAFT / PUBLISHED / ARCHIVED, independent visibility PUBLIC / PRIVATE and revision lifecycle. Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product, ready images/caption and every Seller, Market and Moderation gate.

When the last eligible available tagged Product disappears, Content changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Temporary stock loss does not archive/delete the Scene. Restock triggers Content reevaluation and automatic PUBLIC restoration only if every current gate passes; no manual republish is needed solely for recovered stock. Independent archive, moderation, Seller/Market or Media blocks remain binding.

Buyer-facing current reads of PRIVATE Scenes fail closed across FYP, Search, Storefront, direct links and Collection resolution. Response-time canonical gates remain final while outbox, cache, CDN and projection consumers converge. Saved membership can remain as a safe unavailable reference without revealing old caption/media or a newer private revision.

## 4. Canonical Scene Post identity

Scene Post / ScenePost / SCENE_POST is the canonical Content identity for persistence, revisions, APIs, moderation, ranking and analytics. Product Post is a separate structured commerce object, never a top-level FYP unit. No duplicate alias entity or Lifestyle-Scene terminology is retained.

## 5. FYP Objective

Balance conversion rate, purchase frequency and Buyer satisfaction. Supporting signals measure relevant attention, Product interaction, Checkout, provider-verified paid Orders, accepted completion and post-purchase outcomes. Dwell, scroll time, raw impressions and engagement are diagnostics; none automatically becomes the product objective or dominates by scale.

## 6. FYP Feed Unit Invariant

GET /v1/fyp returns ScenePostFeedUnit objects only. Product Post cards may be embedded as tagged-product summaries after interaction, but they are not independent FYP items.

## 7. What Recommendation Owns

• Candidate retrieval and source attribution.

• Eligibility orchestration over canonical read interfaces.

• Feature resolution and versioned scoring configuration.

• Diversification, exploration and feed assembly.

• Feed sessions, cursors, impressions and algorithm versioning.

• Recommendation-specific projections, replay tooling, experiments and diagnostics.

## 8. What Recommendation Does Not Own

• Product price, Variant or Inventory truth.

• Scene Post publication, PUBLIC/PRIVATE visibility and revision state.

• Seller identity, eligibility, Trust or Moderation decisions.

• Payment status, Checkout totals, Buyer-side surcharge, refunds or Order state.

• Media bytes or TikTok ownership verification.

• Collections, Reviews, Claims or Notifications.

## 9. Authority Boundaries

| Concern | Canonical owner | Recommendation behavior |
| --- | --- | --- |
| Scene Post lifecycle | Content Lifecycle | Read current PUBLISHED + PUBLIC / revision / archive/delete; never mutate lifecycle |
| Product availability | Catalogue / Inventory | Filter candidates; never mutate stock |
| Payment success | Payments / provider adapter | Consume server-confirmed outcome only |
| Order completion | Order / Handoff | Consume canonical completion event |
| Moderation | Moderation | Fail closed on removed/restricted content |
| Media | Media | Consume image delivery descriptors only |

## 10. High-Level Runtime Architecture

```
Mobile Buyer Mode
  -> GET /v1/fyp
  -> Recommendation Application Service
       -> candidate generators
       -> eligibility resolver
       -> feature resolver
       -> scorer + diversification
       -> feed assembler
  -> PostgreSQL/Drizzle (truth + projections)
  -> Valkey (ephemeral caches / rate coordination)
  -> BullMQ workers (aggregation / refresh / reconciliation)
  -> OpenAPI response -> FlashList + Expo Image
```

![Current hard eligibility precedes deterministic ranking](graphics/REC_01.svg)
*Figure 01. Current hard eligibility precedes deterministic ranking. Photo Scene candidates require PUBLISHED + PUBLIC and all current public gates; bounded features, scoring and diversity follow, with response-time revalidation.*

## 11. Primary Request

```
GET /v1/fyp?cursor=<opaque>&limit=<bounded>
Headers: Authorization / MarketContext / client capability / app version
Server derives buyer/account context; caller never supplies another user id.
```

One human uses one ordinary Adulis Account across Buyer capability, Seller ownership relationships, Seller-team participation and Courier profile/relationships. Different humans use different Accounts; Seller credentials are never shared. At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the MVP team slot. Multiple roles within that membership compose by current effective permission union. Ownership and Courier relationships are separate from the team slot.

Switching Buyer, Seller or Courier context changes presentation and scoped authority, never the human's identity. An unrelated Courier or Seller relationship cannot grant access to a Buyer Order, another Seller's records or privileged operations.

Personalization uses the ordinary Account acting in Buyer context; no separate Buyer identity is created. If guest FYP is supported, use a safe server-resolved Market/context session key and do not create durable Buyer history outside approved identity/privacy policy.

## 12. Response Contract

| Field | Purpose |
| --- | --- |
| feed_session_id | Stable identity for one recommendation session |
| cursor | Opaque signed/encoded pagination continuation |
| algorithm_version | Immutable ranking configuration identifier |
| items[] | ScenePostFeedUnit only |
| impression_id | Per-served-unit observation identity |
| next_cursor | Continuation if more eligible results exist |

## 13. Scene Post Feed Unit

• Stable post and revision public identity.

• Seller public summary and Trust-safe display facts.

• Adulis-hosted photo derivative/presentation.

• Required caption or bounded excerpt.

• Current tagged-product summaries sufficient for interaction, not frozen commerce truth.

• Allowed actions: Save, Share, Follow Seller, Not Interested, Report, product-tag interaction.

• Impression identity and algorithm version.

EligibilityDecision carries scene_revision_id and lifecycle_version; feed and impression identity bind exact Scene/revision. Scene payload uses images only and contains no TikTok media/feature data.

## 14. Product Post Boundary

Product Posts remain outside the top-level FYP response. When a Buyer opens a tagged Product, Mobile fetches current Product Post truth and revalidates availability before cart/checkout. Recommendation may use Product metadata as features, but never turns Product Posts into feed items.

## 15. Photo-Only Media Rule

Current Adulis discovery is photo-only. FYP units request bounded image derivatives from the Media domain and must not contain native video payloads, autoplay players, transcoding assumptions or video-specific engagement metrics.

## 16. TikTok Embed Isolation

A Seller may attach an approved TikTok video link to a Product Post after TikTok account ownership is verified by the relevant Auth/Social integration. That embed loads only on the Product Post detail surface after explicit Buyer action. It never appears in FYP, Scene Post media, Seller profile feed cards or Recommendation feature payloads.

## 17. Market Scope

Each Seller currently operates in one Market/country. Every Scene Post and tagged Product Post resolves to that Market. FYP candidate retrieval uses the Buyer MarketContext and excludes content from other Markets. Future multi-market Seller operation must be introduced through Market Configuration, not IP inference.

The architecture is globally extensible and Market-aware; commerce activation is phased, with Ethiopia as the first active launch Market. Future Markets require explicit approved Market Configuration and operational readiness. Server-derived canonical Market context wins over client country fields, IP, phone prefix, locale or worker region. Global-ready code never activates commerce by itself.

Seller, Scene and tagged Product Market must match canonical browsing/Buyer Market rules; arbitrary target user/country data cannot activate a Market.

## 18. Candidate Model

```
RecommendationCandidate {
  scene_post_id
  revision_id
  seller_id
  market_id
  source
  source_rank_hint?
  generated_at
}
```

```
Candidates contain identity/context only; canonical Product/Inventory facts are resolved later.
```

## 19. Candidate Source Registry

| Source | Use |
| --- | --- |
| ONBOARDING_INTEREST | Category interests for sparse-history buyers |
| CATEGORY_AFFINITY | Buyer/category behavioral relevance |
| SELLER_AFFINITY | Buyer relationship with seller content |
| FOLLOWING | Eligible posts from followed sellers |
| RECENT | Fresh eligible Scene Posts |
| TRENDING | Qualified engagement with abuse controls |
| NEW_SELLER | Measured exposure support for new eligible sellers |
| NEW_CONTENT | Fresh post exploration |
| EXPLORATION | Controlled discovery outside strongest affinities |

These sources generate eligible Scene candidates, not new content/identity domains. Creator-as-Seller uses normal Seller/Scene rules; CREATOR_AFFINITY, CREATOR_FEED and creator-specific source architecture remain deferred unless separately ratified.

## 20. Candidate Generator Interface

```
interface CandidateGenerator {
  source: CandidateSource;
  generate(ctx: RequestContext, budget: number, deadlineMs: number):
    Promise<RecommendationCandidate[]>;
}
```

## 21. Parallel Generation

Independent candidate generators execute concurrently under a bounded request deadline. One slow noncritical source must not serially block the entire feed. Critical Market/eligibility dependencies still fail closed.

## 22. Source Budgets

Each source receives a configured candidate budget larger than its final feed quota so eligibility and diversification can remove items without starving the page. Budgets are versioned with the algorithm configuration.

## 23. Deduplication

Deduplicate by canonical Scene Post identity and current eligible revision before scoring. Preserve the primary source plus optional bounded secondary-source provenance for diagnostics; never show the same post twice in one assembled page.

## 24. Eligibility Architecture

Candidate generation is intentionally broader than serving eligibility. Every candidate passes a canonical eligibility resolver immediately before scoring/assembly, and again where a stale cache could otherwise expose removed content.

## 25. Eligibility Inputs

• Current Scene publication_state=PUBLISHED and visibility=PUBLIC; current published revision exists and is not deleted.

• Seller standing/public eligibility passes; Market is active, server-resolved and matching for Scene/Seller/Products.

• Independent Moderation distribution gates pass; ready authorized native photo MediaPresentation and required caption exist.

• At least one tagged Product is currently same-Seller/same-Market, published, eligible and available under Catalogue/Inventory rules.

• Recheck these current gates before response assembly/continuation when projections could be stale; feature scores cannot authorize content.

## 26. Eligibility Output

The current eligibility result records the canonical decision inputs and reason lineage.

```
EligibilityDecision {
  eligible
  reason_codes
  eligible_available_product_count
  decision_at
  scene_revision_id
  lifecycle_version
  policy_version
}
```

## 27. Fail-Closed Rules

When Recommendation cannot determine a critical Seller, Market, Moderation, publication or Inventory fact safely, the candidate is excluded. A temporary feed gap is preferable to showing restricted or non-actionable commerce content.

## 28. At-Least-One-Available-Product Rule

A Scene Post can enter or remain in FYP only while eligible_available_product_count >= 1. Availability means the current canonical Product/Variant/Inventory rules permit a Buyer to proceed toward cart/checkout for at least one tagged Product.

## 29. Content-owned PRIVATE transition on zero availability

When the last eligible available tagged Product disappears, immediately exclude the Scene from new feed assembly and continuation. Content reevaluates current facts and commits PUBLISHED + PUBLIC -> PUBLISHED + PRIVATE, reason ALL_TAGGED_PRODUCTS_UNAVAILABLE, with a durable visibility event.

Recommendation emits no archive or visibility mutation request. If it detects stale inconsistency, it excludes the candidate and emits safe diagnostics/reconciliation signal; Content remains lifecycle authority.

![Current eligibility runs before every new controlled Scene delivery](graphics/REC_02.svg)
*Figure 02. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 30. PUBLIC restoration and projection reconciliation

Inventory/Product changes drive Content-owned visibility reevaluation. With at least one eligible available tagged Product restored and every current public gate passing, Content automatically restores PUBLISHED + PRIVATE -> PUBLISHED + PUBLIC. Recommendation then re-admits through normal gates; temporary stock recovery alone requires no manual republish.

Independent archive/delete, Seller/Market, Moderation and Media blocks are never overridden. Reconciliation repairs derived Recommendation eligibility/feature projections from canonical Scene, Product/Inventory, Seller, active Market, Moderation and Media state. It never archives Content. Historical feed sessions and caches cannot resurrect a PRIVATE Scene.

## 31. Inventory Integration

Recommendation reads an availability projection optimized for bulk candidate filtering, but Product/Variant/Inventory remains canonical. Checkout performs its own revalidation. FYP cache may never authorize purchase or keep a zero-availability post eligible.

Inventory-driven visibility jobs belong to Content and work in bounded batches through its application service. Recommendation response-time current gates deny zero-available or PRIVATE Scenes while async consumers catch up.

## 32. Moderation and Seller Eligibility

Moderation removal or Seller suspension immediately overrides session consistency. Candidate caches, Valkey entries and feed-session continuation cannot resurrect restricted content. Invalidation is best-effort fast; request-time eligibility is the final guard.

## 33. Feature Resolution

After hard eligibility, resolve ranking features in bounded batches. Prefer precomputed projections for behavioral aggregates while reading critical freshness-sensitive facts from authoritative or explicitly safe projections.

## 34. Feature Families

| Family | Examples |
| --- | --- |
| User relevance | category affinity, seller affinity, follow relationship, recent interests |
| Content quality | qualified dwell, save/share rates, product-tag interaction quality, freshness |
| Commerce | Product Post opens, add-to-cart, checkout intent, provider-verified paid Orders, completion quality |
| Trust/safety | Seller Trust category, Claim/cancellation guardrails, moderation quality signals |
| Context | Market, session diversity, recency, time-of-day when evidence supports it |
| Negative | Not Interested, reports, quick skips, repeated non-conversion, stale/unavailable tags |

Current Trust labels are NEW, REBUILDING, ESTABLISHED and TRUSTED. Trust/reliability and bounded Review aggregates are one feature family, not the whole formula. Provider-verified conversion/completion and final canonical Claim outcomes require statistically meaningful bounded interpretation; one Claim does not imply permanent Seller punishment.

## 35. Qualified Impression

An impression is only eligible for behavioral learning after the card satisfies a configured visible-area and minimum-time threshold. Merely receiving an API response is not a qualified view.

## 36. Photo Dwell

Photo dwell measures meaningful on-screen time for Scene Posts. It replaces any launch assumption that video watch/completion metrics exist. Dwell is bounded, de-duplicated and interpreted with scroll behavior rather than treated as proof of satisfaction.

## 37. Engagement Signals

• Qualified dwell and scroll pause.

• Save whole Scene Post.

• Share.

• Follow Seller.

• Open tagged-product list/hotspot.

• Open Product Post.

• Return/back behavior and session continuation.

Whole-Scene Collection Save and typed Product Save are distinct higher-intent actions; Collections owns canonical membership and current-state resolution. Save telemetry does not reserve stock or freeze commerce values.

## 38. Commerce Signals

• Product Post detail view after FYP attribution.

• Variant interaction.

• Add to seller cart.

• Checkout intent/start.

• Payment attempt created by backend.

• Payment success verified by configured PSP/provider adapter.

• Paid Seller Order.

• Completed Order after fulfilment/Handoff.

## 39. Negative Signals

• Not Interested at content/seller/category scope.

• Report/Moderation outcome where appropriate.

• Fast repeated skips after qualified opportunity.

• Product-tag dead ends or unavailability.

• Payment/Order cancellation and Claim outcomes only when interpreted carefully and not used as simplistic seller punishment.

## 40. Verified Review Signals

Use bounded Seller-service receipt/failure aggregates and confirmed remedy/Claim facts separately from received-line Product-quality aggregates. No raw Review body, unreceived Product rating or standalone Scene score. Method-specific QR Trust credit remains distinct from valid Buyer feedback.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

## 41. Payment-Provider Commerce Funnel

```
FYP Scene Post impression
  -> meaningful view / tag interaction
  -> Product Post
  -> seller cart
  -> Checkout Session
  -> PSP/provider payment attempt
  -> server-side provider verification
  -> PAID Seller Order
  -> fulfilment / Handoff
  -> COMPLETED Order
  -> verified Review / Claim outcome
```

## 42. Server-Authoritative Purchase Events

Recommendation never trusts a client success screen, redirect, Seller confirmation or analytics event as payment truth. Purchase and revenue-quality features are derived from canonical Payment/Order events after provider verification. Chapa is the initial named provider where configured, behind the provider-adapter boundary.

## 43. Scoring Model

V1 remains deterministic and config-driven. A conceptual score combines normalized relevance, content-quality, commerce-quality, Trust/context and negative features. Hard eligibility is not a score: an ineligible item has no rank.

No fixed Chatbot localization multiplier exists. Chatbot cannot define final FYP score or promise an exposure increase. If independently adopted by Recommendation, bounded localization-quality evidence is optional, config-driven, capped, versioned, experimentable and empirically validated; all hard gates remain binding and the feature can be disabled without breaking normal FYP.

![Chatbot quality evidence and Recommendation rank are independent](graphics/REC_03.svg)
*Figure 03. Chatbot quality evidence and Recommendation rank are independent. Approved localization expands versioned coverage. Recommendation may ignore or independently cap/experiment with optional quality evidence; no fixed multiplier or impression promise exists.*

## 44. Feature Normalization

Features use bounded transformations so one raw metric cannot dominate by scale alone. Rate features require minimum-denominator handling and smoothing; recency/affinity use controlled decay; sparse data receives confidence-aware weighting.

Use minimum denominators, smoothing/confidence, bounded decay and clipping/caps for views, dwell, popularity, saves and commerce rates. Raw synthetic volume or a large-scale feature cannot dominate relevance simply through units.

## 45. Config-Driven Weights

Weights, thresholds, caps and source budgets are stored in an immutable algorithm-version configuration validated before activation. Do not hard-code product strategy into scattered application constants.

## 46. Determinism

Given the same algorithm version, eligible candidate set, feature snapshot, Buyer/session context and deterministic seed, ranking must be reproducible for replay/debugging. Random exploration uses a session-derived deterministic seed.

## 47. Tie Breaking

Use stable tie-breakers such as deterministic seeded hash plus post identity. Do not rely on database incidental row order.

## 48. Diversification

Diversification is a feed-assembly concern after scoring. It prevents a session from becoming monotonous without fabricating relevance. Rules may include seller adjacency limits, category variety and repeated-content suppression.

## 49. Seller Exposure Controls

Apply configurable exposure caps and adjacency rules so one seller cannot fill a page merely because they have many similar high-scoring posts. These controls are part of organic feed quality, not a promise of equal distribution.

Apply configured seller/small-group concentration caps, adjacency limits and recent-serving suppression over appropriate windows. Prevent feed takeover without forcing irrelevant content for mathematical equality. Policy and experiment diagnostics record concentration, eligible exploration allocation and outcomes.

## 50. Category Variety

Avoid long runs of the same category when comparably relevant alternatives exist. Diversity should not force clearly irrelevant content merely to satisfy a quota.

## 51. Feed Assembly

Assembler merges scored eligible candidates, applies diversity/exploration policy, assigns impression IDs and emits a bounded ordered page. Feed assembly never changes Product/Post state.

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

## 52. Feed Session

A feed session stores Buyer/anonymous subject reference, Market, algorithm version, deterministic seed, creation/expiry and bounded continuation metadata. It gives stable pagination and attribution without freezing safety eligibility.

## 53. Cursor

Cursor is opaque, integrity-protected and version-aware. It may encode session ID, page position and continuation token. Clients must not be able to alter score, target user, Market or hidden offsets.

## 54. Safety Invalidation

Moderation, Seller suspension, Market disablement, Scene PRIVATE/visibility change, independent archive/delete and zero-available-product transitions override session consistency. Previously ranked items are rechecked before new delivery.

## 55. Impression Identity

Every served unit receives an impression_id bound to feed session, Scene Post revision, algorithm version, position and candidate source. This identity links later behavior without letting client events create commerce truth.

## 56. Event Taxonomy

Observation names and server-domain facts remain distinct; exact catalogue versions follow owning contracts.

| Class | Current representative events |
| --- | --- |
| Client observations | feed_unit_visible, qualified_impression, scene_open, tag_open, save, share, not_interested |
| Server commerce | product_post_open_attributed, cart_line_added, checkout_started, payment_verified, order_paid, order_completed |
| Content / safety | scene_post.visibility_changed canonical fact, moderation_removed, seller_suspended, market_disabled |
| Experiments | assignment_exposed, algorithm_version_served; observation never grants authority |

Use the catalogue canonical visibility_changed event or its explicitly versioned equivalent; do not double-emit redundant forms. Independent Scene archive events remain valid for real archive lifecycle, never for zero stock.

## 57. Canonical vs Analytics Events

Analytics events measure what happened; canonical domains establish business facts. Recommendation can learn from canonical events and client observations, but it cannot infer PAID or COMPLETED from telemetry.

| Registry entry | Versioned contract / scope / execution |
| --- | --- |
| scene_post.published v1 / Content | MARKET; Scene/Seller/Market/published_revision, aggregate_revision, logical_effect_id; consumers REC/SRC/Storefront/Media/Analytics; current eligibility re-read. |
| scene_post.visibility_changed v1 / Content | MARKET; same scope plus previous_visibility/current_visibility, reason, revision/effect; public consumers and one Seller advisory notice. |
| inventory.changed v1 / Inventory | MARKET; Product/Variant/Seller/Market/stock_revision/effect; Content and commerce eligibility readers. |
| account.created / account.deletion_requested / Accounts-Privacy | GLOBAL; exact ordinary Account, schema version/effect and optional validated origin; no fabricated Account owner Market. |
| claim.decision_recorded / Claims | MARKET; structured seller_fault/severity/remedy deadline/resolution/decision/correction fact; Trust/Reviews/Finance/Analytics. |
| handoff.verified / Handoff | MARKET; immutable stage/method/recipient/assignment/generation/evidence; receipt-based Reviews plus independent Orders/Trust. |
| review.eligibility_changed / Reviews | MARKET; one Order/Buyer eligibility basis/state/version with restricted evidence references; safe prompts/projections; no client/raw case body. |
| handoff.delegate_invitation / Handoff job intent | MARKET; authorization/generation/contact-purpose/expiry/effect; existing SMS adapter, not an ordinary Notification event. |

## 58. Affinity Updates

Behavior updates affinity asynchronously. High-intent product interactions and completed commerce generally carry more meaning than a passive impression, but weights remain empirical/configured. Negative feedback must reduce future exposure promptly.

## 59. Category Affinity

Maintain bounded per-subject category affinity with recency decay and confidence. New categories remain explorable so the model does not trap buyers in one historic interest.

## 60. Seller Affinity

Seller affinity may use follows, repeated qualified engagement, Product opens and commerce outcomes. Never interpret a seller relationship as authorization; it is ranking context only.

## 61. Negative Affinity

Not Interested and repeated negative outcomes create explicit negative features with scope. Content-level, seller-level and category-level controls must remain distinct so one action is not silently broadened.

## 62. Cold Start: Buyer

Without history, use Market-eligible recent/trending/new-seller/exploration pools plus optional onboarding interests. Do not require onboarding answers before a useful feed can render.

## 63. Cold Start: Seller

Provide bounded new-seller/new-content exploration after full eligibility. Exposure does not bypass Trust, Moderation, Market or availability requirements.

## 64. Cold Start: Scene Post

New posts start with sparse-performance confidence. Initial exploration can test them with bounded exposure; early noisy rates should not permanently bury or boost them.

## 65. Fallback Feed

If personalization projections are unavailable, assemble from safe Market-eligible recency/trending/new-content sources under normal eligibility and diversity. Fallback is explicit in diagnostics and analytics.

## 66. No Unsafe Fallback

If critical eligibility sources fail, do not fall back to unfiltered raw posts. Empty or reduced feed plus retry is safer than exposing restricted or non-actionable content.

## 67. Caching Strategy

Cache non-authoritative candidate lists, feature projections and configuration reads with bounded TTL and event-driven invalidation. Do not cache a final authorization decision beyond its safe window.

## 68. Valkey Usage

• Short-lived candidate/result caches.

• Distributed rate-limit and abuse counters where approved.

• BullMQ queue backing.

• Ephemeral session helpers if reconstructable.

• No canonical publication, Inventory, Payment, Order or Moderation truth.

## 69. Database Read Architecture

Use PostgreSQL/Drizzle with batched queries and explicit read models. Recommendation should not execute N+1 Product/Seller/Inventory reads per candidate. pg_stat_statements identifies expensive query shapes; add indexes from measured workload.

## 70. Recommendation Projections

Maintain rebuildable projections for affinity, trending, qualified engagement, recent-serving suppression and seller/category exposure. Projection lag can reduce ranking quality but must not change hard eligibility authority.

## 71. Feed Session Persistence

Persist only what is needed for continuation, reproducibility, abuse control and bounded attribution. Expire sessions according to Privacy/Analytics policy; do not retain arbitrary browsing state forever.

## 72. Feed Impression Persistence

Operational impression records include session, post revision, position, source, algorithm version and serve timestamp. High-volume analytical details may flow into Analytics storage/aggregation according to retention policy.

## 73. Experiment System

Experiments vary ranking weights, source budgets, diversity thresholds or presentation-safe recommendation parameters. Assignment is deterministic by approved subject key and experiment salt/version.

## 74. Experiment Guardrails

Never experiment on hard Seller, active Market, Content PUBLIC/availability, Moderation or Media gates, payment authorization, price or Inventory truth. Deterministic versioned assignment can vary weights, source budgets, diversity, exploration and safe presentation parameters.

Configured experiment policy stops a harmful variant manually or automatically when it materially harms Buyer trust/satisfaction, increases fraud/disputes/major complaints, causes Seller unfairness or concentration, degrades conversion or Order-completion quality, increases low-quality content or worsens Trust quality. Increased engagement never excuses a guardrail breach.

Monitor at least fraud rate, dispute rate, Order completion, low-quality content rate and Trust-score/quality deterioration, alongside conversion, purchase frequency, Buyer satisfaction and Seller concentration. Gradual rollout, confidence/sample rules, owner, stop thresholds and kill switch are versioned configuration, not invented universal constants.

![Buyer outcomes and marketplace guardrails control experiments](graphics/REC_04.svg)
*Figure 04. Buyer outcomes and marketplace guardrails control experiments. Versioned assignment can vary safe ranking parameters. Increased engagement cannot excuse material trust, fraud/dispute, fairness, conversion or satisfaction harm.*

## 75. Algorithm Versions

Each active configuration has immutable version ID, schema version, activation time, feature definitions, source budgets, weights, thresholds and experiment references. Existing impression history keeps the exact served version.

## 76. Anti-Gaming

Recommendation assumes sellers may try to manipulate attention. Separate qualified engagement from raw events, suppress self/team engagement where identifiable, rate-limit abnormal event patterns and use canonical commerce outcomes as harder-to-fake quality evidence.

## 77. Manipulated Engagement

Repeated devices/accounts, impossible event timing, event floods and synchronized engagement rings should be flagged for Analytics/Abuse review. Recommendation can discount suspicious signals but does not invent a permanent hidden Seller Trust level.

## 78. Fair Exposure

Every fully eligible new Seller/Scene receives a bounded exploration opportunity under configured budgets and concentration policy; this is not permanent placement or guaranteed long-term distribution. Continued exposure is earned through Buyer relevance/response, content quality, conversion, Trust/reliability and satisfaction evidence.

Qualified popularity can inform rank; raw views/synthetic volume do not guarantee it. Do not force irrelevant content just for equality. Sponsored FYP remains deferred. Future paid placement must be labeled, use separate policy/ranking, retain all hard gates, never buy Trust and never silently alter organic rank.

![Bounded exploration gathers evidence without permanent placement](graphics/REC_05.svg)
*Figure 05. Bounded exploration gathers evidence without permanent placement. Eligible new Sellers/Scenes receive exploration opportunity; continued relevance, Buyer response, quality, conversion and reliability earn distribution under concentration controls.*

## 79. Primary Funnel Metrics

Measure qualified impression -> Scene Post engagement -> Product tag -> Product Post -> cart -> checkout -> provider-verified paid Order -> completed Order -> verified Review/Claim outcome. Report drop-off by algorithm version, source, category, seller cohort and Market where privacy allows.

Primary outcomes are conversion rate, purchase frequency and Buyer satisfaction. Engagement/dwell/saves/tag opens remain supporting diagnostics. Report marketplace fraud/dispute/completion/low-quality/Trust-quality guardrails separately and stop harmful experiments.

## 80. Attribution

Carry bounded feed_session_id, impression_id, Scene Post revision and product-tag context into Product/Checkout analytics. Attribution is analytical metadata only and never required for Order validity.

## 81. Latency Budget

Set an end-to-end FYP API target with sub-budgets for candidate generation, eligibility, feature resolution, scoring/assembly and serialization. Exact SLO numbers are configuration/operations decisions validated under production-like load.

## 82. Partial Generator Failure

When a noncritical generator exceeds deadline or errors, omit it, record diagnostics and continue with other sources if enough safe content exists. Do not extend request latency unpredictably waiting for one source.

## 83. Observability

• Sentry for backend/mobile exceptions and release context.

• Pino structured logs with request/session/algorithm/source timing and redaction.

• pg_stat_statements + managed PostgreSQL metrics.

• Valkey/BullMQ cache/job health.

• Cloudflare/R2 media delivery signals consumed as platform context, not ranking truth.

## 84. Required Metrics

• FYP request latency/errors and generator deadlines.

• Candidate counts before/after eligibility.

• Reason-code exclusion rates.

• Scene PRIVATE transition/invalidation lag, stale Scene visibility rate and PUBLIC restoration projection lag.

• Cache hit/miss and stale-read rate.

• Feed concentration/diversity.

• Qualified impression, dwell, save/share, product-tag and Product Post open rates.

• Checkout/payment-verified/completed-order funnel rates.

• Negative feedback, Claims and content-removal rates.

## 85. Alerts

Alert on sudden eligibility leaks, zero eligible content in an active Market, Scene visibility/projection-reconciliation backlog, abnormal seller concentration, payment-event ingestion gaps, high stale-availability rate, BullMQ lag, Valkey outage impact, PostgreSQL saturation and significant algorithm-version regressions.

Alert when a deprecated fixed localization contract is emitted/applied, an optional quality feature bypasses a hard gate, or experiment success masks fraud/dispute/conversion/satisfaction harm.

## 86. Security

• Server derives authenticated/anonymous subject; never accept arbitrary target user ID.

• MarketContext is server-validated.

• Cursor integrity protected and expires.

• Internal replay/admin endpoints require Operator/engineering authorization and audit.

• @nestjs/throttler coordinates abuse limits; @fastify/helmet protects HTTP surfaces.

• No TikTok tokens or payment-provider secrets enter Recommendation payloads/logs.

Operator Account is a separate internally provisioned privileged principal, with independent credentials, strong authentication, OPERATOR sessions, recovery, revocation and audit identity. Ordinary Account roles, phone OTP, public registration and Mode switching do not create Operator authority. The same person may possess both principals, but their authorization and identifiers remain distinct.

Privileged commands require the separate Operator Account, a current narrow capability, exact Market/resource/case scope, purpose/reason and audit, with fresh authentication and approval where existing Operator governance requires it. No generic superuser bypass, arbitrary state setter or impersonation path is introduced.

Internal replay and diagnostics use exact current capability/purpose scope; an ordinary Seller/Courier/Buyer relationship is never internal ranking authority.

## 87. Privacy

Minimize behavioral profiles, use versioned retention policy, support account deletion/pseudonymisation, purge subject-linked recommendation projections, prevent delayed jobs from recreating deleted profiles, and avoid storing raw captions/search text in recommendation logs unless explicitly required.

## 88. Repository Architecture

```
adulis-platform/
  apps/api/src/modules/recommendation/
    application/ candidates/ eligibility/ features/ ranking/ assembly/
    sessions/ impressions/ experiments/ projections/ diagnostics/
  apps/worker/src/jobs/recommendation/
    affinity/ trending/ eligibility-reconcile/ projection-refresh/
  apps/mobile/src/features/fyp/
  packages/api-contracts/
  packages/analytics-events/
  packages/schemas/
  packages/locale/
```

```
Company Website remains in separate adulis-web repository.
```

## 89. API Contracts

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /v1/fyp | Serve Scene Post feed page |
| POST | /v1/analytics/events/batch | Client observation batch through Analytics boundary |
| GET | /v1/recommendation/why/:impressionRef | Optional bounded explanation if approved |
| POST | /internal/recommendation/replay | Restricted deterministic replay |
| GET | /internal/recommendation/diagnostics/:sessionRef | Restricted diagnostics |

## 90. Async Jobs

• Affinity aggregation.

• Trending/qualified-rate projection refresh.

• Recent-serving suppression cleanup.

• Content visibility consequence consumption and canonical eligibility/projection reconciliation; no lifecycle mutation.

• Experiment metric aggregation.

• Projection rebuild/reconciliation.

• No job is allowed to directly authorize payment or mutate Product Inventory.

## 91. Technology Stack and Impact

| Technology | Recommendation impact |
| --- | --- |
| Node.js + NestJS + Fastify + strict TypeScript | Recommendation APIs, application services, typed boundaries, Fastify transport |
| Drizzle + PostgreSQL | Sessions, impressions, algorithm versions, projections and durable config; DB constraints remain authoritative |
| pg_stat_statements | Slow-query diagnosis and ranking-read tuning |
| pg_trgm / btree_gist | Platform extensions available; use only when a measured Recommendation query/constraint needs them |
| Valkey + BullMQ | Ephemeral caches, queues, projection refresh, aggregation and reconciliation |
| REST + OpenAPI + @nestjs/swagger | Stable typed Mobile/API contracts and generated TypeScript client |
| Cloudflare R2/CDN + Sharp | Image derivatives are delivered by Media; FYP references descriptors, not bytes through API |
| React Native + Expo Router | Buyer FYP navigation and deep-link return paths |
| TanStack Query + FlashList + Expo Image | Server-state fetching, virtualized feed, image loading/cache |
| SecureStore / SQLite / Camera / Notifications / Updates / Zustand | Platform Mobile capabilities; Recommendation uses only the subset needed for session/UI state, not business truth |
| Jest + Testcontainers + Maestro + Playwright + k6 | Unit/DB/mobile/web-contract/load validation |
| Sentry + Pino + pg_stat_statements | Errors, structured diagnostics and DB observability |
| dependency-cruiser | Prevents Recommendation from importing domain-private repositories |
| Docker + GitHub Actions + Render + Cloudflare + EAS | Build, test, deploy and Mobile release pipeline |

## 92. Testing Architecture

• Deterministic scorer fixtures.

• Eligibility invariant tests with real PostgreSQL via Testcontainers.

• API contract tests from OpenAPI.

• Mobile FYP navigation/E2E with Maestro.

• Operator/replay browser tooling with Playwright where applicable.

• k6 load tests for feed requests, pagination and burst traffic.

• Security-negative tests for target-user, cursor and Market tampering.

## 93. Critical E2E Tests

• Eligible Scene Post with one available Product appears in FYP.

• Product Post never appears as a top-level FYP unit.

• Scene with zero available Products disappears immediately; Content alone commits PUBLIC -> PRIVATE and Recommendation sends no archive request.

• PRIVATE/archived Scene cannot reappear from stale Valkey/cache/session data.

• Moderation removal overrides an existing cursor.

• TikTok embed metadata never appears in FYP payload/media renderer.

• Product-tag -> Product Post -> seller cart -> Checkout -> provider-verified payment -> paid Order attribution remains intact.

• Client payment-success spoof does not create a commerce-quality event.

• Market mismatch content never enters the feed.

### Current canonical regression cases

• 01. GET /v1/fyp returns ScenePostFeedUnit only.

• 02. Product Post never top-level FYP unit.

• 03. Scene with zero tags cannot publicly publish.

• 04. Scene with one available Product can become PUBLIC/FYP-eligible.

• 05. Last available Product disappears -> Content makes Scene PRIVATE.

• 06. Recommendation does NOT archive Scene.

• 07. PRIVATE Scene disappears immediately from new FYP assembly.

• 08. Restock -> Content PUBLIC -> normal FYP eligibility can return.

• 09. Moderation removal overrides feed session/cache.

• 10. Seller suspension overrides cached ranking.

• 11. Market disablement overrides feed session.

• 12. TikTok never appears in FYP.

• 13. One new Seller receives bounded exploration opportunity.

• 14. Continued distribution responds to buyer response/relevance/quality/conversion/trust.

• 15. Seller concentration caps prevent feed takeover.

• 16. Fixed Chatbot 2.0x multiplier does not exist.

• 17. Localization quality feature can be entirely disabled without breaking FYP.

• 18. Experiment with higher engagement but harmful fraud/dispute/conversion guardrail is stopped.

• 19. Client payment-success telemetry cannot produce commerce feature without canonical provider event.

• 20. Valkey loss does not expose ineligible Scene.

## 94. Load Testing

Test realistic feed page sizes, cold/hot caches, high seller/content cardinality, burst refresh, candidate-generator partial failure and Scene PRIVATE/PUBLIC visibility event storms. Media bytes must flow through CDN, not NestJS. Measure PostgreSQL query count per FYP request and keep it bounded.

## 95. Deployment

Deploy Recommendation as modules inside the platform modular monolith plus BullMQ workers. Separate dev/staging/prod PostgreSQL, Valkey, R2 namespaces, secrets and algorithm configuration. Migrations precede application release; new

algorithm versions activate only after compatibility checks.

## 96. Feature Flags

Feature flags can gate new candidate sources, ranking weights, diversity rules and UI-compatible fields. Flags never bypass hard eligibility or authorize content/payment. Every flag has owner, environment, rollout plan and kill switch.

## 97. Launch Scope

• Photo-only ScenePostFeedUnit FYP under For You, the default Buyer Home tab.

• Product Posts reached through tags/Shop/Search/profile/direct link, never independent feed units.

• Deterministic parallel multi-source generation, hard current PUBLISHED + PUBLIC and Seller/active-Market/Moderation/Media/available-tag eligibility.

• Content-owned PRIVATE loss and all-gate PUBLIC restoration; Recommendation never mutates lifecycle.

• Bounded fair new-Seller/Scene exploration, diversity, concentration and recent-serving controls.

• Qualified views/dwell/typed saves/shares/tag/Product actions and server/provider payment/completion signals.

• Conversion, purchase frequency and Buyer satisfaction outcomes; marketplace experiment stop guardrails.

• Sessions, opaque cursors, deterministic versions, replay and safety invalidation; PostgreSQL canonical, Valkey/BullMQ support.

• Optional independent bounded locale-quality feature, entirely disableable; no fixed Chatbot multiplier.

• Ethiopia-first activated Market and one ordinary Account Buyer personalization subject.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 98. Deferred Scope

• Native video FYP media and video-specific ranking metrics.

• Advanced ML rankers, embeddings/vector retrieval and dedicated feature-store infrastructure until evidence justifies them.

• Multi-market Seller operation.

• Advertising/sponsored recommendation product.

• Additional recommendation modules beyond the launch FYP contract.

• Creator-specific sources/feed/persona and cross-Seller Creator architecture, unless separately ratified.

• Sponsored placement until approved with explicit labeling, separate policy/rank and unchanged eligibility.

• Future Markets until explicit activation/readiness; global-ready architecture alone is insufficient.

## 99. Hard Invariants

• REC-INV-01 FYP top-level units are Scene Posts only.

• REC-INV-02 Scene Post is canonical content identity.

• REC-INV-03 Product Posts are never top-level FYP units in MVP.

• REC-INV-04 FYP is photo-only.

• REC-INV-05 TikTok never renders in FYP.

• REC-INV-06 Every served Scene is PUBLISHED + PUBLIC.

• REC-INV-07 Every served Scene has >=1 currently eligible available tagged Product.

• REC-INV-08 Zero available Products causes Content PUBLIC->PRIVATE, not archive.

• REC-INV-09 Recommendation does not own Content lifecycle.

• REC-INV-10 Restored availability may allow Content PRIVATE->PUBLIC.

• REC-INV-11 Provider/server facts required for payment-quality signals.

• REC-INV-12 Client telemetry cannot establish payment/Order truth.

• REC-INV-13 Market eligibility is server-derived.

• REC-INV-14 Valkey/projections are non-authoritative.

• REC-INV-15 safety invalidation overrides feed-session consistency.

• REC-INV-16 organic rank cannot be silently purchased.

• REC-INV-17 all released ranking behavior is versioned/replayable.

• REC-INV-18 new Sellers receive bounded exploration, not guaranteed permanent placement.

• REC-INV-19 no Seller/small group may dominate beyond configured concentration policy.

• REC-INV-20 fixed Chatbot localization multipliers are not Recommendation invariants.

• REC-INV-21 conversion, purchase frequency and Buyer satisfaction are primary Buyer outcomes.

• REC-INV-22 harmful experiments are stopped under configured guardrails.

• REC-INV-23 For You is distinct from Search and other Buyer Home tabs.

• REC-INV-24 one ordinary Account may supply Buyer personalization identity.

• REC-INV-25 only active Markets are eligible for commerce discovery.

## 100. Final System Architecture

Buyer For You requests a bounded Scene-only feed using a server-resolved ordinary Buyer/anonymous subject and active Market. Parallel candidate sources identify Scenes; current hard gates precede bounded features, deterministic score, diversity/exploration and final response-time revalidation. Session/cursor/impression metadata binds exact Scene revision and algorithm version without freezing safety.

![Scene-only discovery with canonical readers and rebuildable projections](graphics/REC_06.svg)
*Figure 06. Scene-only discovery with canonical readers and rebuildable projections. For You owns its algorithm while other Home tabs and Search keep independent semantics. PostgreSQL durability and provider commerce facts remain outside cache authority.*

Content owns PRIVATE/PUBLIC; Recommendation consumes visibility facts and repairs derived eligibility. Analytics batches high-volume observations; authoritative provider/Order/Handoff/Review outcomes feed commerce quality. PostgreSQL/Drizzle persist durable contracts and projections; Valkey/BullMQ are reconstructable support. TikTok/native video never enters the feed.

### Buyer Home and Search boundaries

For You is the default personalized FYP. Following serves eligible followed-Seller content under its own chronological/light ranking policy. Nearby, Discounts and Locally Made use exact canonical location/offer/locally-made facts and independent tab filters. They may share gates/projections/utilities but are not the same FYP algorithm. Marketplace Search is independent, launches PRODUCT_POST / SELLER / SCENE_POST and uses query-led ranking; its relevance formula is not imported wholesale into passive FYP.

### Final engineering doctrine

Scene-only photo discovery inspires; Product Posts transact; owning domains decide truth. Rank stays versioned and hard-eligibility-first, balances conversion/purchase frequency/Buyer satisfaction, gives bounded fair exploration and stops harmful experiments. No stale session, localization feature, popularity or payment can buy eligibility or Trust.

## 101. Glossary

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
| ScenePostFeedUnit | Only top-level GET /v1/fyp type; native photo content. |
| Hard eligibility | Current PUBLISHED + PUBLIC and all Seller/Market/Moderation/Media/available-tag gates. |
| Algorithm version | Immutable feature/weight/source/diversity/experiment configuration for replay. |
| Qualified impression | Actual visible-area/time threshold; API receipt/preload alone is not a view. |
| Fair exploration | Bounded new-Seller/Scene opportunity; no permanent distribution promise. |
| Experiment guardrail | Configured stop policy for trust, fraud/disputes, fairness, conversion and satisfaction harm. |

## 102. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-02 — Scene publication and all-unavailable lifecycle | The 13 October pack already requires a legitimate same-Seller Product relationship and at least one currently available tagged Product at public publication. | Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product. Zero-tag or all-unavailable initial publication is rejected. A published Scene stays public while at least one tagged Product remains available. If the last available tagged Product becomes unavailable, the Scene remains PUBLISHED but effective Buyer visibility becomes PRIVATE across FYP, Following, Nearby, Search, Buyer Seller profile, public Storefront and Buyer-facing Collection/direct resolution. Seller/Operator views retain it with Private state. Restoration of at least one eligible Product automatically re-evaluates and may restore PUBLIC without republishing. | Founder rule + PR-004 reconciliation |
| R-03 — Buyer Home and social-commerce FYP presentation | The 13 October pack already defines For You / Following / Nearby / Discounts / Locally Made and a Scene-only FYP. | For You is the default Buyer Home channel and contains Scenes only; Products never become top-level FYP units. Home presents the five channels in a compact discovery row with Search and Notifications, with Seller Stories below. Scene cards are structured social-commerce cards, not full-screen video. Following is Seller-follow based; Nearby remains commerce-relevant without continuous/live GPS; Discounts and Locally Made are Product-led channels under their own eligibility rules. | PR-003, 26 Oct 2026 |
| R-05 — Final Scene engagement model | The 13 October designs define Scene commerce/discovery but do not fully freeze the later action bar and presentation. | Scene actions are Like, Save, Share, Reviews, Follow, More and Explore the Scene. Like belongs to the Scene only and no public Like count is shown. Save saves the Scene only. Follow is Seller-level. More may include Not Interested where applicable, Hide this Scene and Report. Public comments and reposts are not part of the current MVP. Explore the Scene is the primary commerce-exploration action. | PR-004, 26-27 Oct 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
