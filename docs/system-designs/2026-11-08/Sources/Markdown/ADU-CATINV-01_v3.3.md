# Adulis Catalogue & Inventory
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R01, R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-CATINV-01_Adulis_Catalogue_Inventory_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. System mission

The Catalogue & Inventory System is the canonical commerce-data layer that answers two separate questions: what a Seller is offering, and whether the exact Product Variant can be sold now. It is redesigned around Product Posts, Scene Posts and gateway-based Checkout rather than the previous pre-payment model.

```
CATALOGUE -> Product / Variant / Product Post
CONTENT   -> Scene Post -> Product Post references
INVENTORY -> StockEvent ledger -> sellable quantity
CHECKOUT  -> gateway attempt -> paid Order -> fulfilment
```

## 2. Current baseline

Status: CURRENT UPDATED BASELINE. The system is photo-first, online-only, global-ready but single-Market-per-Seller for MVP, uses no Seller catalogue-size entitlement cap, and integrates with gateway-verified Checkout.

• Product Posts and Scene Posts are distinct first-class publishing formats.

• Product Posts are not FYP units; Scene Posts are the FYP content unit.

• No native video upload or video-processing infrastructure is in current scope.

• TikTok video is an optional external embed on an eligible Product Post only.

• PostgreSQL remains canonical truth; Valkey and BullMQ are supporting infrastructure only.

## 3. Update precedence

This version supersedes conflicting Catalogue/Inventory assumptions in the September 2026 v1.0 manual. The updated Order/Checkout, Payments, Mobile, Seller Console, Storefront and Canonical Knowledge designs govern shared boundaries.

Where an older specification conflicts with this document on payment, Product/Scene Post behavior, stock presentation, online-only operation, seller market scope or technology naming, this document uses the newer decision.

The supplied October 2026 instructions supersede affected older statements while preserving Product/Variant identity, exact StockEvents/concurrency, allocations, pricing/media/TikTok and Catalogue/Inventory domain separation. Canonical publication types are Product Post and Scene Post; lifestyle presentation is not a third content entity.

## 4. Ownership boundary

Catalogue owns Product identity, categories, structured attributes, Variants, Variant prices, Product Post publication state and product-facing media references. Inventory owns exact stock, StockEvents, stock confirmation, public stock projection inputs and Checkout stock effects. Scene Post content belongs to the Content domain but references Catalogue Product Posts.

• Catalogue does not own payment success, Order state, Claims, Reviews, Trust or FYP rank.

• Inventory does not own Cart, Checkout Session or payment-provider state.

• Content does not duplicate canonical price, Variant or stock truth.

Content owns Scene root/revision, publication, PUBLIC/PRIVATE visibility, caption and Product tags/hotspots. Catalogue/Inventory must not directly mutate Content visibility rows. Emit durable canonical Product/Variant/stock eligibility facts and let Content own the consequence.

Catalogue owns Product, typed attributes, Variant price and Product Post publication/media references. Inventory owns exact quantity, StockEvents, Checkout allocation, sellability and public availability inputs. Recommendation ranks already-eligible PUBLIC Scenes; Collections and financial charges belong elsewhere.

## 5. High-level architecture

Seller Console commands Catalogue (Product/Variant/price/Product Post), Content (Scene/image/caption/tags) and Inventory (exact quantity/StockEvents/allocations) through owning domain interfaces. Scene tags reference same-Seller Product Posts rather than copied price/stock.

Canonical Product/Inventory events drive current public composition and Content eligibility. Product Posts feed Search/Shop/Storefront/detail; PUBLIC eligible Scene Posts feed FYP and Scene Search. Checkout revalidates merchandise and owns provider-attempt stock allocation; normalized provider facts produce idempotent stock effects.

![Catalogue, Inventory and Content ownership](graphics/CATINV_01.svg)
*Figure 01. Catalogue, Inventory and Content ownership. Catalogue owns Product/Variant/price; Inventory owns exact StockEvents/allocations; Content owns Scene publication/visibility and references commerce truth.*

## 6. Core doctrine

Commerce data and presentation content are separated deliberately. A Scene Post can change its caption or imagery without becoming the authority for price or stock. A Product Post can change current price/availability without rewriting every Scene Post that references it.

Products are what Buyers purchase. Scene Posts are commerce-linked creative merchandising. Inventory is the sellability authority.

## 7. One Seller, one current operating Market

For MVP, each Seller operates under exactly one configured Market/country context. Product Posts, Variants, Inventory and Scene Posts inherit that Seller Market. Multi-country Seller operations are not supported in the current version.

• No cross-Market stock pool.

• No one Seller account managing country-specific catalogues in parallel.

• Market/currency/timezone/provider policy is resolved server-side.

## 8. Market portability without MVP complexity

The schema should avoid hard-coding Ethiopia-specific constants into Product or Inventory rows. Use market_id and canonical currency/locale context so a later multi-Market Seller capability can be introduced without rebuilding core Product identity.

• Current rule: one Seller -> one active operating Market.

• Future extension may add SellerMarket relationships and Market-scoped price/inventory, but not now.

## 9. Online-only execution

All Catalogue mutations, Inventory mutations, TikTok ownership checks, publication actions and Checkout stock decisions require network connectivity and server acceptance. A client may cache read-only UI state, but no disconnected write can become canonical commerce truth.

• No local stock mutation authority.

• No delayed local publication command treated as accepted.

• No device-side payment or stock confirmation.

## 10. Why modular monolith remains correct

Catalogue, Inventory, Content, Checkout and Payments remain logical modules inside the Adulis modular monolith. Shared PostgreSQL transactions are valuable for stock integrity. Physical service extraction would add distributed coordination without an MVP need.

## 11. Product Post definition

A Product Post represents exactly one sellable Product and is the canonical buyer-facing commerce object for structured product information. It links Product identity, attributes, Variants, current price, current Inventory projection, Seller/Trust context and purchase action.

• One Product Post -> one Product.

• A Product may have multiple Variants.

• Product Post public identity is stable across ordinary edits.

## 12. Scene Post definition, publication and visibility

Scene Post is Seller-authored image-led merchandising/discovery content with one or more valid same-Seller Product Post tags. Product Post is the canonical structured commerce representation of exactly one sellable Product; Scene revisions never own durable Product price or stock.

Initial public publication requires at least one valid Product Post tag, at least one tagged Product with an eligible purchasable in-stock Variant, and passing Seller, Market, media and moderation checks. Zero tags or no available tagged Product rejects the public publication command.

When the last eligible available tagged Product becomes unavailable, Content keeps publication_state=PUBLISHED and changes visibility PUBLIC -> PRIVATE, with reason ALL_TAGGED_PRODUCTS_OUT_OF_STOCK for stock depletion. This is system-derived commerce visibility, not archival or Moderation removal. If another tag remains eligible and available, the Scene may remain PUBLIC while the unavailable tag resolves current truth.

Content re-evaluates restock or restored Product eligibility against every current public gate. A stock-driven PRIVATE Scene automatically returns to PUBLIC only when at least one tag is available and all gates pass. Independent moderation, Seller suspension, archival/removal or other restrictions still block restoration.

PRIVATE Scenes are excluded from every Buyer/public FYP, Search, Storefront/profile, deep-link and Collection resolution. Seller management retains the Scene with a clear Private badge/reason; notify the Seller on automatic privacy/restoration. A retained Collection membership does not reveal private content. Restricted Operator investigation remains separately authorized and audited.

![Current eligibility runs before every new controlled Scene delivery](graphics/CATINV_02.svg)
*Figure 02. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 13. Product Post and Scene Post relationship

Scene Posts store references, not copies of mutable commerce truth. Price, stock, Variant status and purchase eligibility are resolved from Catalogue/Inventory when the Scene Post is read.

```
ScenePost
  id
  seller_id
  caption
  image_media_refs[]
  product_tags[] -> product_post_id
```

```
ProductPost
  id -> Product -> Variants -> Price / Inventory
```

Scene has one stable root/revision identity with independent publication_state and visibility. DRAFT/PUBLISHED/ARCHIVED/REMOVED describe lifecycle; PUBLIC/PRIVATE describe delivery eligibility. Stock-driven PRIVATE retains PUBLISHED. No permanent mutable price/quantity copy is placed in Scene revision.

## 14. FYP placement rule

The FYP displays Scene Posts only. Product Posts are discoverable through Shop/Search, Seller profile, Storefront, Product links and Scene Post product-tag exploration. Catalogue APIs must support this separation rather than emitting Product Posts as FYP units.

Only PUBLIC eligible image-led Scene Posts with at least one current available valid tag enter Recommendation candidates. Product Posts remain structured commerce destinations and never top-level FYP units; ranking does not own stock or Scene visibility.

## 15. Unlimited Product Posts

There is no business-tier or seller-level cap on the number of Product Posts a Seller may publish. The data model must not contain a current max_products entitlement that blocks valid publishing.

• Use cursor pagination for large catalogues.

• Use abuse/rate controls for security and platform protection, not product-count monetization.

• Storage/media constraints are operational policies, not a seller post-count quota.

## 16. Unlimited Scene Posts

There is no business-tier or seller-level cap on Scene Post count. A Seller may create as many commerce-relevant Scene Posts as their catalogue and merchandising needs justify.

• Publication still requires policy eligibility and valid Product tags.

• Spam/duplicate abuse can be moderated independently of count.

## 17. No count-based entitlement coupling

Catalogue and Content authorization must not ask a commercial entitlement such as can_create_11th_product. If Adulis later introduces a measured anti-abuse or operational limit, it must be an explicit versioned policy rather than a hidden assumption in Product tables.

## 18. Same-Seller tagging in current release

Current Scene Post product tags must reference Product Posts owned by the same Seller. Cross-Seller tagging is not implemented in this release. Keep the data model extensible enough that a future authorization policy could allow broader relationships without rewriting Product identity.

• Enforce same-seller ownership server-side.

• Reject stale/withdrawn/ineligible Product tags.

• Do not trust client-supplied seller ownership.

## 19. Product-level availability and Scene eligibility

A tagged Product is currently available for Scene eligibility only when its Product Post is public/eligible, the Product is not withdrawn/restricted, at least one purchasable Variant has sellable stock and current Seller/Market context permits commerce. Resolve this from canonical Product/Variant/Inventory facts, not stale Scene-copied fields.

For Scene tags A+B, A becoming unavailable leaves Scene PUBLIC if B still passes. A resolves unavailable and B remains actionable. If B then becomes unavailable, eligible_available_product_count drops 1 -> 0 and Content keeps PUBLISHED while setting PRIVATE. Restock 0 -> >=1 triggers gated automatic restoration, never an Inventory-forced PUBLIC write.

## 20. Product update propagation

Editing a Product or Variant changes canonical Catalogue state once. Scene Posts referencing it do not receive copied price/stock fields. Public read composition and event-driven cache invalidation make the latest commerce truth visible automatically.

```
Seller edits Product
  -> Catalogue transaction commits
  -> outbox product.updated
  -> public projection/cache invalidation
  -> every Scene Post reference resolves new Product truth
```

## 21. Stock propagation and Content-owned visibility consequences

Inventory balance + append-only StockEvent + inventory.changed outbox commits atomically. Content consumes the versioned stock input and owns scene_post.visibility_changed when appropriate; consumers never infer an independent became_available/private fact. Public batched owner readers enforce eligibility before delivery while projection/purge lags.

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

![Distinct Catalogue/stock facts with current eligibility](graphics/CATINV_03.svg)
*Figure 03. Distinct Catalogue/stock facts with current eligibility. Different facts keep their meanings; unavailable last tag produces PRIVATE, never an automatic archive.*

## 22. Publication versus availability

A published Product Post may exist while current stock is zero. Publication describes whether the listing is visible; Inventory describes whether it is currently purchasable. Do not unpublish a Product automatically merely because stock reaches zero.

Zero Product stock prevents unavailable Variant Checkout and changes availability but does not automatically withdraw the Product Post. This intentionally differs from Scene PUBLIC eligibility, which requires at least one available tag.

## 23. Withdrawn Product behavior

A Seller may intentionally withdraw a Product Post. Withdrawn Products are not new-purchase eligible. Historical Orders, Reviews, Claims and attribution retain stable Product references and snapshots.

## 24. Scene consequences of withdrawn/restricted Products

Withdrawn/restricted Product is ineligible for new purchase and Scene commerce eligibility. Scene may remain PUBLIC when another tagged Product remains eligible/available; losing the final eligible available tag makes Content change PUBLIC -> PRIVATE while retaining PUBLISHED.

Restored Product eligibility triggers the same full eligibility re-evaluation as restock. Do not archive solely for stock/eligibility loss, silently retarget tags to another Product, or restore through an Inventory/moderation override. Historical/public links resolve a safe unavailable state while non-public.

## 25. Content-to-commerce attribution

When a Buyer opens a Product Post from a Scene Post tag, preserve typed attribution such as scene_post_id, tag_id, feed_session_id and impression_id where allowed. Attribution is analytics context only and cannot modify price, stock or Order legality.

## 26. Image-first publishing model

Current Catalogue/Content design is Instagram-style in the sense that seller publishing is photo-first and visually browsable. Product Posts and Scene Posts use Adulis-hosted images and image carousels as their native media format.

• No native Seller video upload.

• No Adulis video transcoding, streaming or video derivative pipeline.

• FYP remains image-first Scene Posts in the current release.

## 27. Product image authority

Product images are Media-domain objects referenced by Product Post. They are uploaded through signed grants to Cloudflare R2, validated/processed by bounded Sharp workers and delivered through the Cloudflare CDN.

• Media count/dimension policy is configurable.

• Media bytes never pass through NestJS when direct upload is supported.

## 28. Scene Post image media

Scene Posts may use one or more approved images/carousel frames. Hotspots or tag geometry may reference Product Posts, but every tagged Product is also represented in an accessible list so commerce does not depend on visual coordinates alone.

## 29. No native video infrastructure

The current Media domain does not accept Seller video files for Product Posts or Scene Posts. There is no current video object class, transcoder, adaptive streaming pipeline, video thumbnail job or FYP video player contract.

A Seller video file must be rejected by upload policy rather than quietly stored as a generic media object.

## 30. TikTok embed is the only current video path

A Seller may attach an approved TikTok video link to a Product Post when the video is their own and ownership has been verified through a connected TikTok account. The video remains hosted by TikTok and is rendered as an external embed only on the Product Post detail page.

• TikTok embed is not an Adulis media upload.

• TikTok embed is not shown in the FYP.

• TikTok embed is not Scene Post media.

• TikTok embed does not become price/stock/Product truth.

## 31. TikTok account connection

The TikTok embed capability is enabled only after the Seller connects and authenticates an eligible TikTok account through the approved TikTok account-linking/OAuth flow. This is separate from the Seller's primary Adulis authentication method.

• If the Seller has not connected TikTok, the embed field is disabled.

• The UI prompts the Seller to connect TikTok before accepting a TikTok video link.

• Adulis does not ask for the Seller's TikTok password.

## 32. TikTok ownership verification

When a Seller submits a TikTok video URL, the server-side TikTok integration must verify that provider metadata identifies the video as belonging to the TikTok creator account connected to that Seller. If ownership cannot be proven with the available provider contract, fail closed and do not publish the embed.

• Store provider video identifier, connected account reference, verification timestamp and verification result.

• Do not trust URL text or browser claims as ownership proof.

## 33. TikTok connection lifecycle

If the Seller disconnects TikTok, loses authorization, or the linked creator identity changes, existing embed eligibility must be re-evaluated according to policy. Product Post core commerce data remains usable even when an external embed becomes unavailable.

## 34. TikTok embed security boundary

External media loads only after explicit Buyer action using a restricted embed/WebView/browser component. Never inject Adulis session secrets, Seller Console credentials or privileged JavaScript into third-party content.

• Allowlist approved TikTok embed origins.

• Block arbitrary navigation from the embed container.

• Apply referrer/privacy controls according to platform policy.

## 35. TikTok embed degradation

If TikTok is unavailable, removed, rate-limited or the embed cannot load, the Product Post remains complete using Adulis-hosted Product images, details, Variants, availability, Seller/Trust information and purchase action.

## 36. Poster/placeholder behavior

Before an external video is loaded, render an Adulis-hosted poster or neutral placeholder with a clear Watch TikTok video action. Do not auto-load third-party content during every Product page view unless the approved privacy/performance policy explicitly permits it.

## 37. Embed moderation

An approved ownership check does not make a TikTok video policy-safe. Moderation may still restrict a Product Post or remove the embed reference for misleading demonstrations, prohibited claims, unsafe content or mismatch with the Product.

• Ownership verification answers who posted it, not whether the content is compliant.

## 38. No Instagram/Reels embed in current Catalogue baseline

Current Catalogue video behavior is TikTok-link-only. Other external video providers are not part of this document's launch contract. Adding another provider requires an explicit integration decision, provider

adapter and security/privacy review.

## 39. External integration exception boundary

The current no-third-party-tools rule refers to inventory/catalogue synchronization tools such as POS, ERP, warehouse or external catalogue systems. Chapa/payment providers and the explicitly approved TikTok account/embed path are separate platform dependencies required by current product decisions.

## 40. Category taxonomy

Categories provide controlled structure for Fashion, Cosmetics, Electronics and future configured domains. Category identity is stable; localized labels are presentation. Category changes require migration/versioning discipline because attributes, Search and analytics depend on them.

## 41. Structured attributes

Attributes are typed and category-scoped. Examples include size, colour, material, capacity or device compatibility. Avoid putting structured searchable facts only inside free-text description.

## 42. Variant model

A Variant is the exact sellable combination of variant-defining options. Variant identity must remain stable enough for Orders, Reviews and Claims to reference the purchased configuration.

```
Product
  +-- Variant: size=M, colour=Black
  +-- Variant: size=L, colour=Black
  +-- Variant: size=M, colour=Blue
```

## 43. Variant uniqueness

Enforce one unique active Variant per Product + normalized variant-defining combination. Concurrency protection belongs in PostgreSQL constraints/transactions, not only UI validation.

## 44. Variant pricing

Price is stored at the exact Variant level where Variants differ commercially. Use integer minor units and ISO currency. Current Seller Market determines the allowed currency context.

## 45. Price changes

A Seller may update current Variant price individually. New reads use the current price; existing paid Order lines use immutable commerce snapshots. A price edit must not rewrite historical Order amounts.

## 46. Product identity and slug

Internal Product/Post identity is immutable. Public Product Post routes use Seller handle + stable Product slug. Renaming a Product does not silently change the canonical slug. Redirect policy may support controlled public URL changes if explicitly implemented.

## 47. Product description

Seller-authored descriptions are sanitized, length-bounded and treated as untrusted content. Do not allow arbitrary executable HTML. Structured attributes should remain machine-readable even when the Seller also mentions them in prose.

## 48. Product Post publication state

Recommended conceptual states include DRAFT, PUBLISHED, UNPUBLISHED/WITHDRAWN and RESTRICTED where Moderation requires it. Publication state is distinct from Inventory sellability.

## 49. Publishability checks

Before PUBLISHED, the backend verifies Seller standing, single-Market context, required Product fields, valid Variant/price state, required image media, policy eligibility and any category-specific required attributes.

• TikTok connection is optional; it is required only when a TikTok embed is attached.

## 50. Individual Product editing only

Current Seller Console edits Products/Variants one Product at a time. There is no bulk Product update command, spreadsheet import, bulk price edit or mass stock adjustment in this release.

• Each mutation has its own authorization, idempotency and concurrency checks.

• Bulk tooling is a future extension after real Seller workflows justify it.

## 51. No bulk mutation API

Do not ship a hidden array endpoint that effectively recreates bulk update behind the UI. Current write contracts operate on one Product/Variant target per command, except bounded creation of Variants during one Product authoring transaction where required.

## 52. Automatic dependent refresh

The absence of bulk updates does not mean Sellers must manually edit every Scene Post. Product/Scene relationships are reference-based, so a single Product update automatically changes all current projections that resolve that Product.

## 53. Catalogue pagination

Unlimited Seller post count requires cursor-based or stable keyset pagination for Seller Console, Shop, Storefront and internal APIs. Never fetch an entire Seller catalogue into one browser response.

## 54. Seller catalogue search

Use PostgreSQL and pg_trgm for bounded seller-catalogue text search where appropriate. Search remains a read capability; it must never bypass Seller scoping, publication policy or Inventory truth.

## 55. No third-party catalogue synchronization

Current MVP does not import or synchronize Products, prices or stock from POS, ERP, marketplaces, warehouse systems, spreadsheets or vendor APIs. Seller Console remains the authoritative write surface for Catalogue/Inventory changes.

• Future adapters must call canonical Catalogue/Inventory commands rather than mutate tables directly.

## 56. Future external-tool seam

Keep command interfaces and event contracts clean so later external integrations can be added behind adapters. Do not build connector tables, webhook frameworks or reconciliation logic until an approved external-tool use case exists.

## 57. Inventory authority

PostgreSQL-backed Inventory is the authoritative source of current stock. Product Post text, Scene Post content, FYP caches and Seller descriptions cannot override Inventory sellability.

## 58. Exact stock is internal truth

Maintain exact canonical quantity per Variant even when the Buyer sees only a qualitative label. Public visibility is a presentation policy; it does not change stock accounting.

## 59. Append-only StockEvents

Every quantity-changing operation writes an append-only StockEvent with reason/source/actor/reference and updates the materialized current quantity in the same transaction where practical.

```
StockEvent
  id
  variant_id
  delta
  reason
  source_type
  source_ref
  actor_account_id?
  occurred_at
```

## 60. No direct stock rewrite

Business code must not execute an unaccounted UPDATE of stock_count. All stock changes pass through Inventory commands that validate non-negative outcomes and write evidence.

## 61. Seller Set Stock

Seller can set the target quantity for one Variant/Product at a time. The backend computes the delta from current state, writes the StockEvent and updates the canonical count transactionally.

## 62. Seller stock confirmation

A Seller may confirm that the current quantity is still accurate without changing it. Confirmation updates stock-confirmed metadata but does not create fake quantity movement.

## 63. No bulk stock update

There is no current mass stock editor, CSV import or multi-Product inventory mutation. Sellers update each Product/Variant individually. This keeps MVP authorization, concurrency and audit behavior simple.

• Bulk stock management is explicitly future scope.

## 64. Public stock visibility toggle

Each Product Post exposes a Seller-controlled stock-display toggle with two modes: EXACT and STATUS_ONLY. The toggle changes only the Buyer-facing projection; exact Inventory truth always remains server-side.

```
stock_visibility_mode = EXACT | STATUS_ONLY
```

## 65. EXACT mode

When EXACT is selected, public reads may show the current sellable quantity such as 7 available, subject to final localization/copy policy. The server still revalidates quantity at Checkout.

## 66. STATUS_ONLY mode

When STATUS_ONLY is selected, public reads show only one of the approved labels: Not Available, Low, or Available. The exact quantity is not included in public DTOs for that Product Post.

```
0 sellable                 -> Not Available
positive + low-stock policy -> Low
otherwise                  -> Available
```

## 67. Low-stock threshold policy

The exact threshold for Low is configuration, not a hard-coded universal number. It may be platform/Market/category/Product policy later. Inventory returns the resolved status; clients do not invent the threshold.

## 68. Out-of-stock semantics

Zero sellable quantity makes the Variant unavailable for new Checkout. The Product Post may remain visible and explain that the item is not currently purchasable. Tagged Scene Post cards immediately resolve the unavailable state through current projections.

## 69. Variant-level availability

A Product can remain purchasable when one Variant is unavailable and another Variant has stock. Buyer surfaces must resolve availability at Variant selection and Checkout, not use a single optimistic Product flag.

## 70. Inventory confidence

Keep stock confidence/last-confirmed metadata separate from exact count. A stale Seller-maintained count can still be 3 while confidence is lower. Downstream UX may present this carefully but must never claim guaranteed availability.

## 71. Stock timestamps

API instants are UTC. Seller/Buyer surfaces render relevant times in the Seller/Market local timezone. Stock confirmation and StockEvent chronology must remain absolute and auditable.

## 72. Inventory concurrency

For competing buyers, lock/validate affected Variant rows in deterministic order and use PostgreSQL constraints. External locks are not the primary correctness mechanism.

## 73. Negative stock prevention

Database/application invariants must prevent sellable quantity from becoming negative. A command that cannot satisfy requested quantity fails rather than silently overselling.

## 74. Idempotent stock commands

Retry-prone stock commands use idempotency keys or source-reference uniqueness. Duplicate payment/provider processing must not consume stock twice; duplicate release must not add stock twice.

## 75. Inventory reads and caching

Valkey may cache bounded non-authoritative availability projections. Cache loss changes performance, not correctness. Checkout and other critical decisions re-read/validate canonical PostgreSQL state.

## 76. Inventory alerts

Low-stock and out-of-stock notification decisions are produced from Inventory evidence and delivered by Notifications. Deduplicate threshold-crossing alerts to avoid sending one message for every decrement.

## 77. Gateway-first Checkout integration

Catalogue/Inventory integrates with the current gateway-based Checkout model. The Buyer selects Product/Variant quantities, the backend revalidates Catalogue/Inventory, creates one Seller-specific Order, and the Payments domain creates the approved provider attempt such as Chapa where configured.

## 78. No seller payment-confirmation workflow

A Seller does not accept the Buyer before payment and does not manually confirm receipt of money. Provider/server verification establishes payment success. Inventory responds to that canonical payment outcome through typed internal commands/events.

## 79. Checkout revalidation

Immediately before Seller Order creation/payment initiation, validate Product publication, Variant existence, Seller ownership, current price, quantity, Market, currency, stock, Seller standing and provider eligibility. Return precise safe errors for stale carts.

## 80. Provider-attempt stock allocation

CheckoutAllocation is optional short internal attempt-generation stock support, never a Buyer reservation. Lifetime/finality/release rules must match the confirmed provider protocol; unknown finality remains protected reconciliation.

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

The normal attempt deadline and retained allocation are separate. ORDER §35/46 owns the shared release predicate; Inventory exposes the locked idempotent stock transition, not a timer-controlled independent release path.

## 81. Payment success consumes allocation

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

## 82. Payment failure releases allocation

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

Only recorded authorized release/finality evidence permits the locked idempotent release. New local attempts cannot steal another active generation’s allocation.

Immediate release is permitted only for a definitively uninitiated attempt: under the Order/attempt/allocation locks, durable dispatch state proves no accepted, dispatched or in-flight provider request and no verified charge. Fence/cancel the matching dispatch intent before release so a leased or delayed worker cannot initiate it afterwards. An absent callback, local NOT_STARTED label or provider not-found lookup alone is not this proof.

## 83. Ambiguous payment outcome

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

For an initiated or possibly initiated attempt, ORDER §35/46 is the single owner-controlled release predicate: record authoritative adapter finality/release evidence, then lock and re-read current Finance charge, dispatch, attempt generation and allocation ownership. Unknown, stale or incomplete evidence retains required stock in protected RECONCILING. G01 must establish the actual protocol; permanent provider outage has no promised resolution time.

## 84. Sequential multi-seller payments

Multi-cart Buyer UX groups multiple Seller carts, but Catalogue/Inventory remains Seller-Order scoped. Each Seller Order revalidates and consumes only that Seller's stock. Payment of Seller A never locks or mutates Seller B's Inventory except through Seller B's own attempt.

## 85. Buyer-side Adulis surcharge boundary

The zero launch Adulis Checkout surcharge is a Payments/Checkout pricing component charged to the Buyer and collected through the configured payment aggregator. Catalogue price remains the Seller Product/Variant price; Inventory never incorporates the surcharge into stock or Product price.

Courier Delivery charge belongs to Checkout/Fulfilment/Order commercial snapshots and equals current MVP Courier compensation. It is separate from merchandise price and excluded from the zero-bps launch surcharge basis under current policy; Inventory calculates neither fee and neither changes stock accounting.

## 86. Price snapshot boundary

Current Catalogue price is snapshotted into the Seller Order before provider payment. Later Product price edits do not change the amount of an already-created/paid Order. Refunds use Order/Payments snapshots, not current Catalogue price.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 87. Provider capability is not Catalogue configuration

Chapa/provider availability, surcharge collection capability, refunds and settlement are Payment/Market concerns. Catalogue can expose product currency/Market context but must not contain provider secret/configuration logic.

## 88. Seller unable to fulfil paid stock

If a Seller cannot fulfil a paid Order despite recorded stock, Orders/Claims/Payments handle cancellation/refund consequences. Inventory writes corrective StockEvents where necessary but does not rewrite payment history.

## 89. Refund and restock semantics

A refund does not automatically imply physical stock returned to available inventory. Restock only when the Seller/fulfilment process has reliable evidence the item remains or is returned to sellable stock. Keep financial and physical-state facts separate.

## 90. Order line snapshots

Order Management stores immutable line snapshots for Product/Variant identity, selected attributes, quantity and price. Catalogue can evolve later without making historical Orders depend on current Product rows.

## 91. No external call inside stock transaction

Do not hold a PostgreSQL stock transaction open while waiting for Chapa/TikTok/other network providers. Commit local state, call providers through bounded application flows, then reconcile results through idempotent commands.

## 92. Paid-state protection

Once backend provider verification proves payment success, stale client state, cache expiry or an old payment attempt timer must never make Inventory treat that paid quantity as freely sellable again. Paid Order truth dominates stale transient state.

## 93. Catalogue domain events

After commit, publish typed events through the transactional outbox such as product.created, product.updated, product.published, product.withdrawn, variant.updated and product_post.updated. Event schemas are versioned.

The complete registry explicitly includes product.created, product.updated, product.published, product.withdrawn, variant.updated, product_post.updated and the existing Product Post publication facts. Product aggregate facts and Product Post publication are different owner transitions; no stock/projection fact is mechanically renamed to inventory.changed.

## 94. Inventory domain events

The distinct registered facts are inventory.changed (committed exact-stock revision), inventory.stock_confirmed (committed owner stock-confirmation evidence), and inventory.public_stock_projection_changed (a derived public availability projection revision). Each appears once; the projection is never authoritative stock or Scene permission.

• Events never replace PostgreSQL as canonical stock truth.

Payloads carry safe owner/aggregate/stock or projection revisions with logical_effect_id and event_version. Consumers re-read current stock and independent public eligibility; stale projection delivery cannot restore a restricted Scene. Producer/schema entries are in EVT §35 and Contract_Registry.

## 95. Scene eligibility and dependent projection invalidation

Catalogue/Inventory events provide durable Product eligibility, Variant/price and availability facts. Content rechecks affected Scene references without copying mutable commerce truth and owns stock-driven PRIVATE/PUBLIC transitions plus its own versioned events. Its downstream consumers update Search/FYP/Storefront/profile/Collection projections and caches.

Current public reads authorize only PUBLIC eligible Scenes with at least one available valid tag even if asynchronous purge is delayed. Product availability remains resolved from canonical data; idempotent consumers, bounded cache TTL and reconciliation cannot replace authoritative gates.

## 96. FYP integration

FYP consumes eligible Scene Posts and current Product-tag availability projections. FYP may cache eligibility/projections but cannot make an unavailable Variant purchasable. Product Posts are not returned as FYP feed units in the current Mobile contract.

## 97. Marketplace Search, Shop and Collections boundaries

Marketplace Search launches with PRODUCT_POST, SELLER and SCENE_POST; public Scene Search is in MVP. Catalogue supplies current Product/category/attribute/Variant/price/availability and Seller/Trust summary; Content supplies eligible public Scene/image/tag information. PostgreSQL + pg_trgm remain the launch search architecture unless measured evidence justifies more infrastructure.

Search never supplies canonical price/stock authority or returns PRIVATE Scenes. Shop and Product surfaces still provide precise commerce discovery outside the Scene-only FYP.

Buyer private Collections can independently save a Product Post and a whole Scene Post. Collections is not Catalogue-owned; retained PRIVATE Scene membership never renders its image/caption/tags, and only valid restoration reopens Buyer resolution.

## 98. Seller Storefront integration

Storefront is a public read projection. It lists Product Posts and Scene Posts, composes current Inventory, and hands authenticated purchase intent into the Mobile/backend Checkout flow. It never mutates Catalogue or Inventory.

Storefront resolves only currently eligible PUBLIC Scenes; public detail/share/SEO/cache cannot bypass visibility. Product Posts may remain visible at zero stock with a truthful unavailable label. Restock opens a private Scene only after Content passes every current public gate.

## 99. Seller Console integration

Seller Console is the primary current authoring/administration surface for Product Posts, Variants, individual stock changes, Scene Posts, Product-tagging, Product images and TikTok embed configuration.

• Seller Companion remains focused on paid-Order operations rather than full catalogue authoring.

Seller Console is primary Catalogue/Scene authoring and administration. Seller Companion permits only urgent role/allowed_actions-authorized actions such as mark unavailable, quick stock correction and confirm stock; Mobile MVP has no full Product or Scene authoring.

## 100. Mobile Buyer integration

Mobile Buyer Mode uses Scene Posts in FYP, Product Posts in Shop/Search and Product detail, and current Inventory to drive purchase affordances. The client never computes canonical availability from cached counts.

## 101. TikTok embed placement on Mobile

Mobile Product Post detail may render the approved TikTok embed after Buyer action. The embed never appears in FYP or Seller profile. If unavailable, Product detail still functions from Adulis-hosted images and structured Product data.

## 102. Chatbot integration

Chatbot receives structured Product/Variant/Inventory facts through typed read interfaces. It may state configured availability using current public stock semantics but cannot invent stock from Seller prose or an old conversation.

## 103. Review integration

Verified-purchase Product Reviews reference stable Product/Order line identity. Product withdrawal or edit does not erase valid Reviews or make them attach to a different Product.

## 104. Claims integration

Claims can reference immutable Order snapshots, current/historical Product identity, StockEvent evidence and fulfilment/payment facts. Catalogue does not adjudicate claims.

## 105. Notifications integration

Notifications consumes outbox/domain events for publication, moderation, low stock, out of stock, restock where enabled and other seller/buyer communications. Notification failure never rolls back a committed stock mutation.

Automatic last-available-tag loss notifies Seller: "Scene made Private" with reason "All tagged Products are currently out of stock." Gated restoration notifies: "Scene is Public again because at least one tagged Product is available." Seller management shows Private badge/reason. Notification failure never rolls back quantity or Scene state.

## 106. Analytics integration

Track Product Post views, Scene Post tag clicks, Product opens, Add to cart, Checkout starts, provider payment outcomes, paid Orders, stock-outs and content-to-commerce attribution. Analytics is non-authoritative and must not block commerce.

## 107. Public Product Post DTO

Public Product Post reads expose only safe current fields and a public Inventory projection.

```
PublicProductPost {
  slug, name, description, images[]
  approvedTikTokEmbed?
  category, attributes, variants[]
  pricePresentation
  publicStock: { mode, label?, exactCount? }
  sellerSummary, trustSummary
}
```

## 108. Public Scene Post DTO and eligibility gate

PublicScenePost may expose stable public slug/ref, caption, image media, Product references, current safe availability summaries, publication metadata and Seller summary. Price/stock stay canonical in Catalogue/Inventory and are composed as current safe views, never durable Scene revision copies.

```
PublicScenePost { publicSlug, caption, images[], productTags[] -> ProductPostPublicRef, publishedAt, sellerSummary, availabilitySummaries }
```

Only PUBLIC eligible Scenes pass Buyer/public resolution. PRIVATE returns the safe unavailable result without restricted content, including through Collections or stale deep links.

## 109. Authentication and Seller context

Every Catalogue/Inventory mutation runs under authenticated Account context plus explicit Seller scope and Market context. Browser-selected seller_id is never sufficient authority.

## 110. Authorization

Backend permission resolution controls Product/Variant/price/media/publication/stock operations; frontend checks are usability only. Every command includes authenticated ordinary Account, explicit Seller context, current relationship/standing/role-set/surface permission and Market scope.

OWNER has full permitted Catalogue/Inventory administration; ADMIN ordinary delegated administration; INVENTORY primary authorized Product/Variant/availability/stock and permitted price/media/publication work. CAMPAIGN_MANAGER may read/search eligible Product Posts for Scene tags but gains no price/stock mutation from Scene authorship. SALES_SUPPORT has no Product/stock mutations; ANALYST has bounded read-only analytics rather than unrestricted data/mutations.

Content independently authorizes Scene commands. A role permitted urgent Companion stock work receives no automatic full Mobile authoring capability.

## 111. TikTok connection authorization

Only Seller members with the explicit content/integration permission can connect or disconnect TikTok and attach a verified embed. Ownership verification does not grant unrelated Seller permissions.

## 112. Catalogue create API

Conceptual write contracts remain typed REST endpoints generated from OpenAPI. Product creation is one Seller-scoped command with structured validation; current APIs do not expose a bulk import surface.

```
POST /v1/sellers/{sellerId}/product-posts
PATCH /v1/sellers/{sellerId}/product-posts/{id}
POST /v1/sellers/{sellerId}/product-posts/{id}/publish
```

## 113. Variant APIs

Variant create/update endpoints validate Product ownership, option combination, price/currency and concurrency version. Destructive delete is avoided when historical Orders reference the Variant; withdraw/deactivate instead.

## 114. Inventory APIs

Current commands operate on one Variant/Product target at a time.

```
PUT  /v1/sellers/{sellerId}/variants/{variantId}/stock
POST /v1/sellers/{sellerId}/variants/{variantId}/stock-confirmation
GET  /v1/sellers/{sellerId}/variants/{variantId}/stock-history
```

## 115. Stock visibility API

Product Post settings expose stock_visibility_mode. Changing visibility does not mutate stock_count. Public DTO composition applies the mode after current Inventory status is resolved.

## 116. Scene API validation boundary

Content owns Scene create/publish, validates Product Post references through Catalogue/Inventory and enforces same-Seller/Market eligibility. Reject zero Product tags with SCENE_PRODUCT_TAG_REQUIRED (or existing equivalent); reject public publication when no tagged Product has an available purchasable Variant with NO_AVAILABLE_TAGGED_PRODUCT (or equivalent).

Preserve cross-Seller tag, withdrawn/restricted/ineligible Product, unsupported video and Market mismatch rejection. Only Content can decide public publication/visibility. Exact machine-readable names follow the existing error conventions; use additive/versioned identifier migration where historical implementation compatibility requires it.

## 117. TikTok embed API boundary

Use a dedicated integration endpoint/command to connect TikTok and attach a provider-verified video reference. Never accept arbitrary embed HTML from Seller input.

```
POST /v1/sellers/{sellerId}/integrations/tiktok/connect
POST /v1/sellers/{sellerId}/product-posts/{id}/tiktok-embed
DELETE /v1/sellers/{sellerId}/product-posts/{id}/tiktok-embed
```

## 118. Error taxonomy

Use stable machine-readable errors such as PRODUCT_NOT_FOUND, VARIANT_NOT_FOUND, PRODUCT_NOT_PUBLISHED, STOCK_INSUFFICIENT, STOCK_VERSION_CONFLICT, CROSS_SELLER_TAG_FORBIDDEN, VIDEO_UPLOAD_UNSUPPORTED, TIKTOK_CONNECTION_REQUIRED, TIKTOK_VIDEO_OWNERSHIP_UNVERIFIED and MARKET_SCOPE_MISMATCH.

Current Scene validation also returns SCENE_PRODUCT_TAG_REQUIRED and NO_AVAILABLE_TAGGED_PRODUCT or convention-equivalent stable codes. Missing media/Market/tag eligibility errors remain independently distinguishable.

## 119. Optimistic concurrency

Seller edits include revision/version tokens where conflicting updates could overwrite each other. A stale editor receives a conflict rather than silently replacing newer price/description/visibility settings.

## 120. Idempotency

Create/publish/stock/provider-linked commands that may be retried require idempotency or unique source references. Reusing the same key with a materially different payload is an error.

## 121. Database constraints

Use PostgreSQL CHECK, UNIQUE, foreign keys and exclusion/partial constraints where appropriate. Drizzle provides types/query/migrations but does not replace database invariants.

## 122. Catalogue schema concept

Representative durable entities include Product, ProductPost, Variant, Category, AttributeDefinition, ProductAttributeValue, ProductImageReference and ProductTikTokEmbedReference. ScenePost remains a Content entity with ProductPost tags.

## 123. Inventory schema concept

Representative entities include VariantInventory, StockEvent, StockConfirmation and short-lived CheckoutAllocation metadata where required for active provider attempts. All durable quantity effects are traceable to an append-only event/reference.

## 124. Transaction boundaries

Use one PostgreSQL transaction for local Catalogue/Inventory invariants. Do not mix external provider calls into that transaction. Use outbox + idempotent reconciliation for downstream/provider effects.

## 125. Indexing

Index Seller/Product scopes, public slug, category, publication state, Variant combination keys, stock update chronology and active checkout-allocation lookup. Use pg_trgm selectively for bounded product text search.

## 126. Migration discipline

Migrations preserve Product public identity, Variant references, Order snapshots, StockEvent history and stock-count consistency. Destructive cleanup happens only after compatibility is proven.

## 127. Backup and restore

Catalogue and Inventory restore from the same PostgreSQL recovery point so current counts and StockEvents remain consistent. R2 image objects follow Media backup/lifecycle policy. Provider/TikTok tokens follow secure integration-secret recovery rules.

## 128. No direct database access from clients

Seller Console, Mobile and Storefront use REST/OpenAPI contracts. They never receive PostgreSQL credentials and never mutate tables directly.

## 129. Canonical technology stack

The Catalogue/Inventory implementation follows the current Adulis baseline. Technology supports domain rules; it does not become an alternate business authority.

| Layer | Current technology | Catalogue / Inventory impact |
| --- | --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript | Catalogue, Inventory, Content integration commands/queries and HTTP runtime. |
| Persistence | Drizzle ORM; PostgreSQL | Schema/migrations/data access; canonical Product, Variant and stock truth. |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements | Seller/product search support, advanced constraints where justified, query diagnostics. |
| Async / cache | Valkey; BullMQ | Non-authoritative cache, outbox dispatch, media/invalidation/reconciliation jobs. |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client | Typed Seller Console/Mobile/Storefront contracts and DTO drift control. |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js | Abuse controls/headers; phone library is shared platform stack, not Catalogue authority. |
| Image media | Cloudflare R2; Cloudflare CDN; Sharp | Direct image upload, derivatives and delivery. No native video pipeline. |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; SecureStore; SQLite; Camera; Notifications; Updates; small Zustand store | Product/Scene reads, image rendering, FYP lists and current server-state UX; no device commerce authority. |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 | Unit/domain, PostgreSQL integration, mobile/browser E2E and load testing. |
| Observability | Sentry; Pino structured logs; pg_stat_statements | Errors/releases, redacted logs and DB query visibility. |
| Architecture control | dependency-cruiser | Enforces module/package boundaries and prevents private repository coupling. |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS | Backend/web deployment, CDN/R2 delivery and Mobile release workflow. |
| Payments | Chapa via internal provider adapter where Market-configured | Payment success feeds Inventory only through normalized backend facts. |
| TikTok | Account-link / ownership-verification adapter + approved embed | Optional Product Post external video; no native video storage. |

## 130. Valkey usage

Valkey is used only for bounded non-canonical concerns such as read cache, rate/abuse counters, BullMQ queue backing and short-lived projection metadata. Losing Valkey must not lose Product, price or stock truth.

## 131. BullMQ jobs

Background jobs may include image derivatives, cache invalidation, event dispatch, checkout-allocation reconciliation/release, low-stock notifications, TikTok revalidation where provider policy supports it, and projection rebuilds.

• Jobs are idempotent and observable.

• Critical domain facts are committed to PostgreSQL before asynchronous fan-out.

Content eligibility jobs consume durable inventory.changed / inventory.changed / stock_changed facts, reconcile affected Scene visibility and invalidate public projections. Jobs are idempotent; notification loss cannot undo canonical state.

![Commit first, relay after commit](graphics/CATINV_04.svg)
*Figure 04. Commit first, relay after commit. PostgreSQL owns truth; BullMQ/Queue Valkey support idempotent consequences with independent reconciliation and separate cache failure semantics.*

## 132. R2/CDN/Sharp image pipeline

Seller image -> signed upload -> private/controlled staging -> validation -> Sharp derivative processing -> immutable R2 object keys -> Cloudflare CDN public delivery where approved.

```
Seller -> upload grant -> R2 -> Sharp -> derivatives -> CDN
                          \-> metadata -> PostgreSQL
```

## 133. No video worker tier

Do not provision FFmpeg/transcoding workers, adaptive-video storage, video CDN profiles or video-specific queues for current Catalogue/Content. TikTok remains externally hosted.

## 134. Sentry

Capture Catalogue/Inventory application errors and release context without attaching full Seller descriptions, provider secrets, TikTok tokens or sensitive request bodies. Add Product/Variant opaque IDs only where safe.

## 135. Pino structured logs

Log request_id, operation, seller_id, product/variant opaque references, outcome, latency and safe error code. Redact secrets, OAuth tokens, payment provider payloads and user-entered sensitive fields.

## 136. pg_stat_statements

Use pg_stat_statements to diagnose expensive Seller catalogue search, Product projection and Inventory queries. Do not compensate for missing indexes by adding uncontrolled cache layers.

## 137. Core operational metrics

Measure Product publish success/failure, Scene Post tag validation failures, image processing latency, Product read latency, Inventory command latency, StockEvent write failures, checkout stock conflicts, cache hit rate and outbox/job lag.

Measure Scene eligibility-consumer/reconciliation lag, tag/available-product validation, automatic PRIVATE/restoration success/failure and public projection invalidation latency. No precise unnecessary Buyer/recipient/location information belongs in Catalogue telemetry.

## 138. Integrity alerts

Page/alert on business-impact signals such as negative-stock invariant rejection spikes, duplicated payment stock effects, inability to write StockEvents, widespread Product projection failure, TikTok ownership-check bypass signals or stale checkout allocations beyond policy.

Alert on Scene remaining publicly eligible with zero available tags, failed automatic PRIVATE/restoration, stale public Scene after depletion, PRIVATE Scene served by FYP/Search/Storefront/Collection resolution, outbox/eligibility-consumer lag and repeated reconciliation failure. Distinguish expected blocked restoration (e.g. moderation) from system failure.

## 139. Unit testing

Jest covers Catalogue validation, Product/Scene relationships, stock status projection, stock visibility toggle, price/money logic, TikTok URL/ownership result handling and domain error mapping.

## 140. Database integration testing

Testcontainers runs real PostgreSQL/Valkey integration tests for constraints, migrations, StockEvent/current-count atomicity, concurrency, idempotency, outbox and cache-failure behavior.

## 141. Seller Console E2E

Playwright validates Product Post create/edit/publish, individual Variant/stock updates, stock visibility toggle, image-only Scene Post authoring, TikTok connect/embed flow and absence of bulk update controls.

## 142. Mobile E2E

Maestro validates FYP Scene Post -> Product tag -> Product Post, Shop/Search Product discovery, exact/status stock presentation, Add to cart, gateway payment flow and product availability changes after Seller stock edits.

## 143. Load testing

k6 tests Seller catalogue pagination, Product public reads, Storefront viral reads, stock-update throughput and checkout contention. Unlimited post count means APIs must remain bounded by pagination rather than response-size assumptions.

## 144. Security testing

Include cross-Seller IDOR, unauthorized stock mutation, cross-Seller Scene tag, malicious descriptions, media MIME spoofing, TikTok URL abuse, OAuth state/CSRF protection, embed-origin restriction, rate-limit bypass and provider-secret leakage tests.

## 145. Critical test - no video upload

Attempt Product/Scene media upload with video content/MIME and misleading file extension. Expected: rejected before durable publication; no video object/worker path is created.

## 146. Critical test - TikTok ownership

Connect Seller TikTok A -> attach video owned by A succeeds when provider verification proves ownership. Attach video owned by B fails. Disconnect/revoke TikTok -> new embeds disabled; existing embed follows revalidation policy.

## 147. Critical test - unlimited catalogue

Create a large Seller catalogue well beyond previous plan limits using paginated test fixtures. Expected: no commercial count-cap denial, stable pagination and no full-catalogue load in UI/API.

## 148. Critical test - stock visibility

With exact quantity 7, EXACT returns count 7. STATUS_ONLY returns no exactCount and a server-resolved label. With zero stock, purchase is blocked regardless of display mode.

## 149. Critical test - payment stock effect

Two Buyers compete for final quantity; duplicate provider success and duplicate failure/reconciliation events are injected. Expected: exactly one valid sold quantity effect, no double decrement and no double release.

Also specify delayed charge after cancel/expiry, unavailable/not-found provider lookup, dispatch-versus-release race, duplicate expiry/repair work and stale generation. Required uncertain allocation remains protected; proven uninitiated dispatch is fenced before release. These application/PostgreSQL concurrency tests remain unexecuted.

## 150. Critical E2E - Scene eligibility, privacy and restoration

- Reject Scene publication with zero tags or only zero-stock/ineligible tagged Products.

- Publish Scene with Products A/B available; A out of stock leaves Scene PUBLIC with truthful A-unavailable/B-actionable tags.

- B then out of stock changes Content state to PUBLISHED + PRIVATE, never archived; Seller still sees Private reason and receives notice.

- FYP/Search/Storefront/profile/deep link/Collections suppress private content even when outbox/purge is delayed.

- Restock A -> Content rechecks -> automatic PUBLIC if every other gate passes, with Seller restoration notice; moderation/restriction blocks restoration.

- Product Post at zero stock remains visible/unavailable while Checkout rejects unavailable Variants.

- Product price/image/Variant updates compose current truth without editing every Scene revision or copying durable stock/price.

- Concurrent final-unit Buyers allow at most one paid stock consumption; provider success/failure/ambiguity preserve existing idempotent allocation rules.

## 151. MVP scope

Build now:

• Categories, typed attributes, Products, Variants and Variant pricing.

• Product Posts with image media and current public Product DTOs.

• Image-first Scene Posts with mandatory same-Seller Product Post tags.

• Unlimited Product Post and Scene Post counts with pagination/abuse controls.

• Exact Inventory, append-only StockEvents, individual Seller stock updates and confirmations.

• Stock visibility toggle: exact count or Not Available / Low / Available.

• TikTok account connection, ownership verification and Product-Post-only external embed.

• Checkout/payment-provider stock integration and server-authoritative paid-order effects.

• Storefront, Search/Shop, FYP, Chatbot, Notifications and Analytics read/event interfaces.

• Valkey/BullMQ async/cache behavior, current observability and test stack.

- Public Scene Search and mixed private Product/Scene Collection read boundaries.

- Mandatory available-tag public publication, Content-owned automatic PRIVATE/restoration, Seller badges/notices and public eligibility/cache safeguards.

## 152. Explicitly deferred

Do not build in this version:

• Bulk Product/price/stock update tools.

• CSV/spreadsheet catalogue import.

• POS, ERP, warehouse, marketplace or other third-party inventory sync.

• Multi-country operations for one Seller.

• Multi-location/warehouse stock.

• Native video upload/transcoding/streaming.

• Additional external video providers beyond the approved TikTok path.

• Cross-Seller Scene Post tagging.

• Advanced inventory forecasting or dynamic pricing ML.

• Dedicated Catalogue/Inventory microservices, Kafka or Elasticsearch without measured need.

## 153. Future bulk updates

A later bulk-management release may add explicit batch commands with preview, validation, per-item result reporting, idempotency, partial-failure policy and audit. It must still write canonical per-Product/Variant StockEvents and never bypass invariants.

## 154. Future multi-country Seller operations

A future design may support one Seller across multiple Markets with Market-scoped price, inventory, tax/payment, fulfilment and content policy. This requires dedicated research and is intentionally excluded from MVP.

## 155. Future external inventory adapters

If Adulis later integrates POS/ERP/warehouse systems, adapters must translate external facts into authorized Catalogue/Inventory commands and reconcile conflicts. External tools never become direct database writers.

## 156. Future native richer media

If product evidence later justifies native video, introduce a dedicated Media architecture with upload policy, transcoding, moderation, delivery, analytics and cost controls. Do not pre-build this infrastructure now.

## 157. Hard Catalogue invariants

CAT-INV-01 Every Product belongs to one Seller and current one Market. CAT-INV-02 Product Post is the canonical buyer-facing commerce object for one Product. CAT-INV-03 Scene Posts reference Product Posts; they do not own price/stock. CAT-INV-04 Current Scene tags are same-Seller only. CAT-INV-05 No seller post-count business cap exists in the current design. CAT-INV-06 Native video upload is unsupported. CAT-INV-07 TikTok embed requires verified connected-account ownership. CAT-INV-08 Product Post is not an FYP feed unit.

CAT-INV-09 Scene visibility/publication are Content-owned. CAT-INV-10 Public Scene publication requires >=1 valid same-Seller tag and >=1 available eligible tagged Product. CAT-INV-11 Last available tag loss retains PUBLISHED and makes PRIVATE; restoration rechecks all gates. CAT-INV-12 PRIVATE Scenes cannot resolve through Buyer/public surfaces. CAT-INV-13 No Trust level imposes a Product listing cap.

## 158. Hard Inventory invariants

INV-INV-01 Exact stock is canonical in PostgreSQL. INV-INV-02 Every quantity mutation is evidenced by StockEvent/source reference. INV-INV-03 Public stock visibility never changes exact truth. INV-INV-04 Checkout stock effects are payment-attempt/Order scoped and idempotent. INV-INV-05 Provider success cannot decrement stock twice. INV-INV-06 failure/reconciliation cannot release stock twice. INV-INV-07 cache loss cannot change sellability. INV-INV-08 no client owns stock authority.

INV-INV-09 Inventory publishes canonical eligibility facts/outbox, never directly rewrites Scene visibility. INV-INV-10 Courier charge/surcharge do not change Product price or Inventory accounting. INV-INV-11 Product stock zero does not automatically withdraw Product Post.

## 159. Technology invariants

TECH-INV-01 Valkey is the current cache/queue datastore. TECH-INV-02 PostgreSQL + Drizzle remain core persistence/data-access baseline. TECH-INV-03 BullMQ jobs are non-authoritative and recoverable. TECH-INV-04 R2/CDN/Sharp handle images only in current media scope. TECH-INV-05 REST/OpenAPI/generated clients are the typed integration contract. TECH-INV-06 dependency-cruiser enforces logical architecture boundaries.

## 160. Launch gates

Do not certify production until:

• Seller can create/publish Product Post and image-first Scene Post.

• No Seller count-cap blocks additional Product/Scene Posts.

• Cross-Seller Product tags are rejected.

• Video file upload is rejected; TikTok embed requires connected verified owner.

• TikTok failure does not break Product commerce.

• Individual Product/Variant stock updates write correct StockEvents.

• No bulk update/import endpoint or UI is exposed.

• Stock visibility toggle hides exact count in STATUS_ONLY.

• Zero stock blocks Checkout and propagates to public projections.

• Concurrent final-unit Checkout passes without oversell.

• Provider-verified payment commits stock exactly once; failure releases exactly once.

• One-Seller-one-Market rule is enforced.

• Third-party stock synchronization is absent.

• FYP returns Scene Posts only; Product Posts remain Shop/Search/Product surfaces.

• Valkey failure preserves correctness.

• Backup/restore and migration tests preserve Inventory history.

• Sentry/Pino logs redact provider/TikTok secrets.

- All Scene zero-tag/OOS, partial loss, last-tag privacy, Seller badge/notice, gated restoration, moderation block and delayed-cache/public suppression tests pass.

- Marketplace Search includes public Scenes; mixed Collections deny PRIVATE Scene content.

- Role/surface Catalogue/stock permissions and urgent Companion-only scope are proven.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 161. Recommended build sequence

Phase 0: schema/invariants -> Phase 1: Catalogue/Product Post -> Phase 2: image media -> Phase 3: Inventory/StockEvents -> Phase 4: Seller individual authoring/stock UX -> Phase 5: Scene Post/tag integration -> Phase 6: public projections/FYP/Search/Storefront -> Phase 7: TikTok connection/embed -> Phase 8: Checkout/payment stock coordination -> Phase 9: observability/tests/load/security -> Phase 10: launch certification.

## 162. Repository placement

Catalogue, Inventory, Product/Scene integration, API and workers live inside the current adulis-platform modular monolith/repository. The Company Website remains in its separate adulis-web repository and consumes only public platform information where needed.

```
adulis-platform/
  apps/api/
  apps/worker/
  apps/seller-console/
  apps/mobile/
  apps/storefront/
  modules/catalogue/
  modules/inventory/
  modules/content/
  modules/payments/
  modules/orders/
  packages/api-contracts/
```

```
adulis-web/   # separate company website repository
```

## 163. Final system architecture

Seller Console -> owning Catalogue/Product/Variant/price/media and Inventory/exact StockEvents commands; separate Content owns image-led Scene roots/revisions/captions/tags/publication/visibility. Product tags resolve current canonical Product/Variant/Inventory facts rather than copied price/stock.

Stock transaction/outbox -> idempotent Content eligibility -> PUBLISHED PUBLIC/PRIVATE consequence -> current public read composition, Search/FYP/Storefront/Collection safeguards -> notices. Product Posts remain visible/unavailable at zero stock; Scenes need at least one current available eligible tag.

Checkout/payment-provider adapter revalidates Seller/Market/Variant/quantity, owns short attempt allocation and immutable price/charge snapshots, and feeds normalized provider facts into idempotent stock consumption/release. Orders/Fulfilment/Handoff, Reviews/Claims/Trust remain distinct downstream owners.

PostgreSQL/Drizzle is canonical truth; Valkey/BullMQ supports after-commit/idempotent async; R2/CDN/Sharp supply image media; approved TikTok detail embeds remain optional and external. No bulk/import/sync/video/microservice expansion is introduced.

![Catalogue, Inventory and Content ownership](graphics/CATINV_05.svg)
*Figure 05. Catalogue, Inventory and Content ownership. Catalogue owns Product/Variant/price; Inventory owns exact StockEvents/allocations; Content owns Scene publication/visibility and references commerce truth.*

## 164. Final design doctrine

The Catalogue should make a Seller's products structured, searchable and visually compelling without turning Adulis into a generic social network or building premature infrastructure. Product Posts carry precise commerce truth; Scene Posts create image-first discovery; Inventory preserves exact sellability; Checkout converts Buyer intent into provider-verified paid Orders.

One edit should update one source of truth. Every public surface should compose from that truth. No copied price/stock, no hidden seller-count quota, no native video stack, and no client-side commerce authority.

## 165. Architectural outcome

This design supports a large Seller catalogue with unlimited Product/Scene Post publishing, current social-commerce discovery, controlled TikTok promotion reuse, simple individual Seller operations, strong stock accounting and gateway-safe checkout. It keeps future bulk tools, multi-country Seller operations, external inventory integrations and richer native media as explicit later extensions rather than MVP complexity.

## 166. Glossary

| Term | Definition |
| --- | --- |
| Product | Seller-owned sellable item with structured attributes and Variants. |
| Variant | Distinct purchasable Product option with its own price and exact stock. |
| Product Post | Canonical structured commerce representation of exactly one Product; current price/stock are domain-owned. |
| Scene Post | Seller-authored image-led discovery content with same-Seller Product Post tags and current eligibility. |
| Product Tag | Same-Seller Scene reference/hotspot to a canonical Product Post. |
| Public | Scene visibility eligible for Buyer/public delivery only when all current gates pass. |
| Private | Seller-only Scene visibility; excludes Buyer/public resolution. Authorized investigation is separate. |
| Publication State | DRAFT/PUBLISHED/ARCHIVED/REMOVED lifecycle, independent of visibility. |
| Visibility | PUBLIC/PRIVATE delivery dimension; stock-driven PRIVATE retains PUBLISHED. |
| Sellable Quantity | Canonical quantity currently available for eligible purchase after domain allocations. |
| StockEvent | Append-only evidence of exact quantity mutation and source reference. |
| Checkout Inventory Allocation | Short provider-attempt stock allocation with idempotent consume/release. |
| EXACT | Public availability mode disclosing permitted current exact sellable count. |
| STATUS_ONLY | Public mode hides exact quantity and shows approved availability label. |
| Available | Current purchasable stock above applicable low-stock threshold. |
| Low | Current purchasable stock within the configured low-stock threshold. |
| Not Available | No currently purchasable/sellable stock under current public rules. |
| Scene Eligibility | Current valid same-Seller tag, available Product and Seller/Market/media/moderation gates. |
| Transactional Outbox | Durable event/intent recorded with canonical transaction, relayed after commit and reconciled. |
| Catalogue | Owner of Product, attributes, Variants, price and Product Post publication/media references. |
| Inventory | Owner of exact quantity, StockEvents, allocation and sellability inputs. |
| Content | Owner of Scene revision/caption/tags/publication/visibility and eligibility consequence. |
| Market | Current country/currency/timezone/provider/commerce policy context. |
| TikTok Embed | Approved optional external video on Product Post Detail only; no stock/media authority. |
| Shoppable Post | Superseded former term for Scene Post. |

## 167. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-01 — Buyer-facing Product / Scene terminology | The 13 October designs use Product Post and Scene Post as canonical domain names. | Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly. | PR-001 / PR-005, 26-27 Oct 2026 |
| R-02 — Scene publication and all-unavailable lifecycle | The 13 October pack already requires a legitimate same-Seller Product relationship and at least one currently available tagged Product at public publication. | Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product. Zero-tag or all-unavailable initial publication is rejected. A published Scene stays public while at least one tagged Product remains available. If the last available tagged Product becomes unavailable, the Scene remains PUBLISHED but effective Buyer visibility becomes PRIVATE across FYP, Following, Nearby, Search, Buyer Seller profile, public Storefront and Buyer-facing Collection/direct resolution. Seller/Operator views retain it with Private state. Restoration of at least one eligible Product automatically re-evaluates and may restore PUBLIC without republishing. | Founder rule + PR-004 reconciliation |
| R-06 — Explore the Scene and hotspot placement | The 13 October designs support tagged Products/hotspots but do not fully freeze where hotspot UI appears. | Normal For You and Following Scene media carries no Product hotspots. Tapping Scene media or Explore the Scene opens the dedicated Explore surface. Explore owns numbered hotspots and the tagged-Product list; hotspot/list selection remains synchronized. Unavailable tagged Products remain visible with current price plus “Currently unavailable” and no purchase action. View Product only navigates to Product detail; it never orders automatically. | PR-004 follow-up, 27 Oct 2026 |
| R-07 — Final Product engagement model | Product Post remains the canonical structured commerce object. | Buyer-facing Product actions are Save, Share, Reviews, Ask Seller, Order and More/Report. Product has no Like, public comments or repost. Save is Product-only. Ask Seller opens the ongoing Buyer-Seller conversation with Product context. Order enters Cart/Checkout; opening a Product or using Buy Again never creates an Order or payment automatically. | PR-005, 27 Oct 2026 |
| R-09 — Seller profile and Storefront information architecture | The 13 October designs define Seller profile/Storefront content but not the final shared tab order. | Buyer Seller profile and standalone public Storefront share Scenes / Products / Reviews / About and open on Scenes. Scenes show the Seller’s Buyer-public eligible Scenes. Products show the catalogue with available first. Reviews is Seller Service; Product Quality remains on Product. About includes description, Trust facts, category, neighborhood/operating area, fulfilment, member since and social accounts. Collection point appears only where Buyer Collection is offered. Header actions are Follow and Message; the public Storefront hands these actions into the app. Trust is information, not a button. | PR-002, 26 Oct 2026 |
| R-10 — Purchased Products and Buy Again | The 13 October pack has Buyer Orders/account history but not the finalized Purchased Products UX. | Purchased Products derives from completed Buyer Orders and shows one entry per Product using the latest purchase: Seller, purchase date, purchased variant and current Product facts where resolvable. Buy Again opens the current Product with the last variant preselected only if still offered; Buyer must still choose quantity/fulfilment and explicitly order/pay. Unavailable or delisted Products remain in purchase history without an invalid Buy Again action. Review actions reuse canonical Review eligibility. | PR-006, 27 Oct 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
