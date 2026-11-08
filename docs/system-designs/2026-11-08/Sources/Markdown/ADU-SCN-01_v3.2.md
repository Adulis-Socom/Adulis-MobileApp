# Adulis Scene Posts & Content Lifecycle
Version 3.2 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.1 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Complete amended baseline: 12 October 2026. The supplied correction prompt and owner decisions supersede the conflicting reviewed source wording. Every original numbered body section and unaffected table/graphic is retained; targeted contracts, examples, tests, invariants and dependent definitions are reconciled. The historical audit remains unchanged.

| Document control | Amendment baseline |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026 -> 3.2 post-October-13 reconciled 8 November 2026. |
| Source | ADU-SCN-01_Adulis_Scene_Posts_Content_Lifecycle_Complete_System_Design_v3.1.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Executive Summary

Scene Post is the canonical Seller-authored, image-led merchandising/discovery object containing tagged Product Posts. Product Post is the structured commercial representation of exactly one sellable Product. Scene revisions reference current Product truth rather than owning price, stock, Variant sellability, payment or Trust.

Initial public publication requires a non-empty valid caption, ready authorized image presentation, at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product, plus Seller, Market and Moderation eligibility. A Product counts as available when it has a currently purchasable in-stock Variant and is not withdrawn/restricted. Zero tags fail PRODUCT_TAG_REQUIRED; all unavailable tags fail NO_AVAILABLE_TAGGED_PRODUCT.

Last available tagged Product loss keeps publication_state=PUBLISHED and changes visibility PUBLIC -> PRIVATE, with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE (or the stock-specific reason ALL_TAGGED_PRODUCTS_OUT_OF_STOCK). This is neither archival nor Moderation removal. If another tagged Product remains available, the Scene may remain PUBLIC while unavailable tags show safe current non-purchasable state.

Content re-evaluates availability restoration against every current public gate. A stock-driven PRIVATE Scene automatically returns to PUBLIC when at least one tagged Product is available and all gates pass. Restock never overrides Seller/Market suspension, Moderation, media restriction or ARCHIVED state; no manual republish is required solely because stock returned.

PRIVATE Scenes are excluded from every Buyer/public FYP, Search, Storefront/profile, deep link and Collection resolution. Seller management retains the Scene with a clear Private badge, reason and restoration condition. Notify the Seller on automatic PRIVATE/PUBLIC transitions; notification failure never rolls back canonical state. Restricted investigation is independently authorized, purpose/case scoped and audited.

Seller Console is the complete authoring surface; Seller Companion reads status/alerts/performance only. Published revisions are immutable and working revisions use optimistic concurrency. Content remains in the NestJS modular monolith with PostgreSQL canonical state, transactional outbox, idempotent BullMQ/Valkey consequences and R2/CDN/Sharp image references.

Commerce begins at the canonical Product Post and proceeds through Seller Cart, Checkout, provider-verified paid Seller Order, Fulfilment and Handoff. Content owns neither money nor transaction legality.

## 2. Mission

The Content Lifecycle system exists to make Adulis discovery visually compelling while preserving precise commerce ownership. It must let Sellers tell a product story, let Buyers understand the products inside that story, and let the platform measure whether merchandising leads to Product interest and successful commerce without converting Adulis into an unrestricted social network.

The design must survive Seller edits, Product price and stock changes, Product withdrawal, Moderation actions, team-member turnover, FYP algorithm changes, Market policy changes, cache delay, worker outages and future media/market expansion without rewriting historical evidence or creating a second source of commerce truth.

• Keep Product Posts and Scene Posts semantically distinct.

• Preserve immutable published revisions for evidence and attribution.

• Keep same-Seller content composition strongly tenant-scoped.

• Allow cross-Seller aggregation at Buyer Home/FYP and Marketplace Search result surfaces; each Scene remains same-Seller.

• Keep public and FYP eligibility derived from current canonical facts.

• Integrate cleanly with Storefront, Collections, Moderation, Analytics, Catalogue, Inventory and Checkout.

## 3. Goals

• Define one formal Scene Post root with Seller, Market, publication state, independent visibility and immutable revision lineage.

• Require caption, safe image presentation, valid same-Seller tags and at least one eligible available tagged Product for public publication.

• Automatically make all-unavailable published Scenes PRIVATE and restore them PUBLIC after all current gates pass.

• Preserve working revisions, optimistic concurrency, Product hotspots, accessible Product lists and exact revision evidence.

• Integrate launch Search, Scene-only FYP, Storefront and mixed Product/Scene Collections without private-content leakage.

• Keep Product commerce truth, Recommendation rank, payment authority and centralized retention outside Content.

• Retain typed REST/OpenAPI, PostgreSQL/Drizzle, transactional outbox, Valkey/BullMQ, R2/CDN/Sharp and connected-only mutations.

## 4. Non-Goals

• No Product or Scene Post listing cap based on subscription or Trust.

• No cross-Seller tags, standalone Creator/affiliate catalogue, owner-consent/revocation workflow or arbitrary social posting in current MVP.

• No Seller-controlled Storefront Scene pinning/reorder or collaborative real-time editing.

• No Seller Companion authoring, native Scene video, transcoding, TikTok Scene/FYP media or automatic Product recognition/AI tagging.

• No retired recommendation-enrichment modules, unrestricted comments, Cart/Checkout/payment/Order authority or FYP ranking inside Content.

• No independent Content microservice, Kafka or dedicated search engine solely to enable launch Scene Search.

## 5. Product Context

The codebase is multi-Market-ready while commerce activation is phased, initially Ethiopia with Addis Ababa service coverage where required. Each current Seller has one operating Market. Every Product Post and Scene Post inherits that Market; a public URL never authorizes cross-Market commerce.

Buyer Home contains For You (default), Following, Nearby, Discounts and Locally Made. For You/FYP top-level units are SCENE_POST only. Product Posts remain Shop/Search/detail objects and tagged-product destinations. Marketplace Search returns Product Posts, Sellers and PUBLIC Scene Posts from launch; Seller Storefront/profile stays Seller-scoped.

Scene Post -> Product Post -> Seller Cart -> Checkout Session -> configured PSP -> provider-verified paid Seller Order -> Fulfilment -> connected Handoff -> Review/Claim. The superseded pre-payment hold model is absent.

## 6. Two Formal Post Types

Product Posts are canonical commercial objects; Scene Posts reference them without copying mutable price/stock. One Product Post may be referenced by many Scenes; a public Scene revision requires one or more valid same-Seller Product relationships.

| Post type | Canonical owner / purpose | Launch discovery |
| --- | --- | --- |
| Product Post | Catalogue/Inventory; exactly one sellable Product, attributes, Variants, price and availability. | Shop/Search, Seller Storefront/profile, direct links and Scene-tag navigation. |
| Scene Post | Content; Seller-authored image-led merchandising with caption, tags, optional hotspots and immutable revisions. | Scene-only FYP, Marketplace Search, Seller Storefront/profile and direct links while PUBLIC eligible. |

## 7. Scene Post Definition

Scene Post is the formal canonical content object. It is not a separate presentation pattern layered on another post type. Any phrase describing a lifestyle visual style has no database, lifecycle or authorization meaning.

Drafts may have incomplete Product relationships while being edited; every public published revision must pass the minimum-one-valid-tag and available-Product requirements.

![One canonical Scene identity and revision lineage](graphics/SCN_01.svg)
*Figure 01. One canonical Scene identity and revision lineage. The stable Seller/Market root owns publication and visibility; current published and working revisions hold composition rather than mutable commerce truth.*

```
ScenePost
  scene_post_id / owner_seller_id / market_id
  publication_state = DRAFT | PUBLISHED | ARCHIVED
  visibility = PUBLIC | PRIVATE
  current_published_revision_id / working_revision_id?
SceneRevision
  required_caption / image_presentation_refs
  product_relationships   # >=1 valid relationship at public publish
  optional_normalized_hotspots / author_account_id / published_at
```

## 8. Domain Ownership

Content owns Scene publication/visibility; domain interfaces provide current dependent facts. Public eligibility is revalidated before exposure.

| Concern | Canonical owner | Content contract |
| --- | --- | --- |
| Scene root, visibility, revisions, tags | Content Lifecycle | Owns exact lifecycle and immutable composition; current eligibility resolver. |
| Product/Variant/price | Catalogue | Stable references; strong current validation at publish/public read. |
| Stock and sellability | Inventory | Canonical availability facts/outbox; never direct Scene state writes. |
| Image readiness/presentation/bytes | Media | Asset/presentation references; READY alone does not authorize public distribution. |
| Seller, Market, Moderation | Owning domains | Hard public gates; independent restrictions block restoration. |
| FYP and Search ranking | Recommendation / Search | Consume PUBLIC candidates and safe metadata; cannot override Content gates. |
| Storefront / Collections | Respective domains | Public resolution denies PRIVATE; saved membership never exposes private revision. |
| Order / payment / surcharge | Order / Payments | Attribution only; independent provider/commerce authority. |
| Retention and holds | Privacy / Moderation / Claims | Exact revisions retained or purged under central policy. |

## 9. Non-Ownership Rules

• Content never owns current Product price, Variant availability, exact stock, Trust, Reviews or Seller eligibility.

• Content never owns payment success, Buyer surcharge calculation, provider settlement or Order state.

• Content never owns FYP score or rank. Recommendation ranks only already-eligible candidates.

• Content never owns Collection membership. It supplies stable target/provenance identifiers only.

• Content never copies Product price or stock into immutable Scene Post revisions as canonical fields.

• Content never imports another domain's private repository. Application interfaces and documented projections are the boundary.

## 10. System Context

Seller Console uses generated REST/OpenAPI clients to invoke Content application services. Catalogue, Inventory, Media, Seller, Market and Moderation expose domain-owned interfaces; Content does not import their private repositories.

The canonical transaction commits the Scene change/history and durable outbox together. After-commit workers refresh FYP, Search, Storefront, Collections and Seller notifications. Public response-time eligibility rechecks protect exposure while projections lag.

![Current eligibility runs before every new controlled Scene delivery](graphics/SCN_02.svg)
*Figure 02. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 11. Owner and Author Model

Each Scene Post is owned by exactly one Seller. The Account that creates or edits a revision is recorded as author provenance but does not become the commercial owner. Team-member removal does not rewrite historical authorship.

In MVP, post owner and all tagged Product Posts resolve to the same Seller. Because external Seller products are not allowed, there is no external-owner consent state and no owner-revocation behavior in this system.

```
•
owner_seller_id is immutable after creation in MVP.
```

```
•
market_id is derived from the Seller operating Market and not freely client-supplied.
```

• Author Account ID is evidence/provenance; authorization still depends on current Seller relationship and permission.

• Operator/Moderation actions remain operator actions; they do not impersonate Seller authorship.

Operator investigation uses a separate privileged Operator Account and never impersonates or rewrites ordinary Seller author provenance.

## 12. Seller Console Authoring Only

Full Scene Post/Scene creation, editing, caption changes, Product association, hotspot placement, preview, publication, archive, restore and delete requests belong to Seller Console.

Seller Companion may display content status, performance summaries and content-related alerts when useful, but cannot create, edit or publish Product Posts or Scene Posts in the current release. This preserves the established Console = Create/Configure/Manage/Administer and Companion = Monitor/Communicate/Respond/Understand separation.

## 13. Seller RBAC

Seller authorization requires current ordinary Account/session, active ownership or team membership, effective permission, Seller/Market scope, permitted Console surface and domain state. Role names explain responsibility; the backend enforces exact capability codes.

CAMPAIGN_MANAGER may manage Scene revisions/media/tags/hotspots and approved moderation responses, with Product/Variant/availability reads needed for merchandising. It cannot change Product price, stock or Order state. OWNER/ADMIN may receive Scene capabilities under Seller RBAC. Seller Companion remains non-authoring.

| Permission | Protected action | Constraint |
| --- | --- | --- |
| seller.scene_posts:read | Read own drafts, published/private/archived status and readiness. | Current Seller scope; no public leak. |
| seller.scene_posts:write | Create/edit working revision and lifecycle deletion request. | Console only; ETag/idempotency; Privacy/hold checks for deletion. |
| seller.scene_posts:publish | First publish or new immutable published revision. | Full caption/media/tag/availability/Seller/Market/Moderation recomputation. |
| seller.scene_posts:archive | Archive or restore/revalidate. | Restock cannot reopen ARCHIVED; no Moderation bypass. |
| seller.scene_posts:tag_products | Tag same-Seller/same-Market Products and place hotspots. | No Product/price/stock mutation. |
| seller.content_media:manage | Scene media/presentation management. | Media purpose/ownership/readiness enforced. |
| seller.content_moderation:respond | Submit approved Seller content-moderation response. | No adjudication or enforcement override. |

## 14. Scene Post Lifecycle and Visibility

DRAFT is private authoring. PUBLISHED points to the current immutable published revision. ARCHIVED is explicit Seller removal from active discovery. Privacy lifecycle handles deletion separately. PUBLIC/PRIVATE visibility and Moderation remain independent dimensions.

Stock depletion never changes PUBLISHED to ARCHIVED. Restoration of stock may reopen a stock-driven PRIVATE Scene automatically; archive restoration is an explicit authorized command followed by full readiness validation.

![Current eligibility runs before every new controlled Scene delivery](graphics/SCN_03.svg)
*Figure 03. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 15. Publication State Semantics

All exposure is decided from current canonical dependencies; the retained revision does not preserve old purchase eligibility.

| Current state / trigger | Result | Required checks |
| --- | --- | --- |
| DRAFT + publish | PUBLISHED + PUBLIC | Caption, ready media, >=1 valid tag, >=1 eligible available Product, Seller, Market, Moderation. |
| PUBLISHED + publish working revision | PUBLISHED + PUBLIC if readiness passes | New immutable revision, current dependencies and ETag; prior revisions unchanged. |
| PUBLISHED/PUBLIC + last available tag lost | PUBLISHED + PRIVATE | Content-derived reason/provenance; invalidate all public resolution and notify Seller. |
| PUBLISHED/PRIVATE + availability returns | PUBLISHED + PUBLIC automatically when eligible | Current all-gate recheck; independent restrictions remain blocking. |
| PUBLISHED + Seller archive | ARCHIVED + PRIVATE | Authorized Seller intent; history retained. |
| ARCHIVED + restore/publish | PUBLISHED + PUBLIC only if ready | Full current publish validation; stock alone cannot restore. |
| Eligible deletion request | Public removal then policy/hold-aware cleanup | Central Privacy lifecycle; do not destroy held evidence. |

## 16. Moderation State

```
Moderation remains a separate authority. A Scene Post may be publication_state=PUBLISHED while
Moderation enforcement makes it public-ineligible. Sellers cannot republish around a current removal. Reports bind to the
exact revision that the Buyer saw.
```

Public APIs expose only safe availability outcomes. Private Moderation reasons, reporter identity and internal case detail never leak through Content read models.

## 17. Revision Model

Every published Scene Post revision is immutable. A stable root points to the current published revision and may additionally point to one mutable working revision. This preserves historical analytics, Moderation evidence and exact product-tag lineage.

Editing a published post clones the current revision into a working revision if none exists. The next publish atomically freezes that working revision and switches the root pointer. Previous revisions remain unchanged until lifecycle/retention policy later permits purge.

• Caption belongs to revision.

• Media presentation belongs to revision.

• Product relationships belong to revision.

• Hotspot geometry belongs to revision.

• Author and publication timestamp belong to revision.

• Current Product price/stock do not belong to revision.

## 18. Draft Editing and Connected-Only Operation

Adulis is online-only for current product/content mutations. Seller Console draft edits require network connectivity and receive canonical server acknowledgement. The browser may keep ephemeral unsaved form state, but there is no disconnected authoring queue that later invents publication order.

Draft updates use optimistic concurrency. The caller sends an ETag/version token; stale edits return a conflict and must refresh/reconcile rather than silently overwriting another team member's work.

```
PATCH /v1/seller/scene-posts/{id}/draft
If-Match: <working-revision-etag>
```

```
server: authorize Seller -> validate payload -> validate Product/Media refs -> update working revision -> return new ETag
```

## 19. Published Editing

• Never mutate a published revision in place.

• Clone to a new working revision on first edit.

• Re-run caption, Media, Seller, Market, Product, Moderation and geometry checks at publication time.

• Publish within one PostgreSQL transaction that locks the root/working revision, freezes the revision, changes the current pointer and inserts the outbox event.

• Downstream FYP/Storefront/Analytics/Collections projections react after commit and remain idempotent.

## 20. Caption Requirement

```
Caption is required for every published Scene Post. This decision is no longer Market-configurable for the current
release. Empty or whitespace-only captions fail publication with CAPTION_REQUIRED.
```

Caption is bounded plain Unicode text. It is not HTML, Markdown, a Product description or an alternate source of structured Product truth. Output surfaces escape it as inert text. Published caption edits create a new revision.

## 21. Media Model

Scene native media is image-based: a ready authorized primary presentation and optional permitted image carousel. R2 owns bytes, Cloudflare CDN delivers approved derivatives, and bounded Sharp workers normalize images. Content stores MediaAsset/MediaPresentation references rather than raw R2 keys.

Product hotspots bind to canonical versioned presentation geometry after EXIF/orientation/crop normalization. The current Scene object has no native video upload/transcode/stream path. Optional click-to-load TikTok video remains Product-detail-only and cannot become Scene or FYP media.

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

## 22. Image Processing and Coordinate Assumptions

Hotspot geometry is meaningful only against a canonical image presentation. EXIF orientation and normalization happen before coordinates become authoritative. The same presentation metadata is used by Seller Console preview, Mobile and Storefront rendering.

Normalized coordinates use the presentation rectangle, not raw device pixels. Rendering must account for contain/cover behavior, crop rectangles and responsive aspect ratio changes.

```
x_norm in [0,1]
y_norm in [0,1]
```

```
rendered_x = content_rect.left + x_norm * content_rect.width
rendered_y = content_rect.top  + y_norm * content_rect.height
```

## 23. Product Relationships

A draft working revision may be incomplete, but public publication requires at least one valid same-Seller Product Post relationship. Relationships are explicit rows, not caption parsing. One Product Post may appear in many Scene Posts. A Scene Post may tag many Product Posts from the same Seller.

Product relationships carry presentation order and attribution metadata only. Current product name, price, Variant, stock and purchase eligibility are composed from Catalogue/Inventory at read time.

## 24. Hotspot Model

Hotspots are optional visual coordinates attached to a Scene Post/Product relationship. A Product relationship may exist without any hotspot and may have multiple hotspots when the same product appears more than once in the composition.

Accessible tagged-product lists are mandatory even when hotspots are present. A Buyer who cannot use the image overlay must still be able to discover every tagged Product Post.

## 25. Same-Seller Product Rule

CURRENT MVP RULE: A Seller-authored Scene Post can tag only Product Posts owned by that same Seller. Cross-Seller content composition is not implemented.

The backend verifies Seller ownership at tag creation and again at publication. The client cannot bypass this by supplying a public Product identifier from another Seller.

Cross-Seller behavior exists only at aggregation surfaces: the FYP, approved Buyer Home sections and Marketplace Search results may present eligible Scene Posts from different Sellers in one stream. Each individual post remains single-Seller and market-consistent.

## 26. Product Eligibility

• Product Post exists and belongs to the Scene Post owner Seller.

• Product and Scene Post share the same Market.

• Product publication/Moderation state permits the current relationship.

• Product current commerce state is resolved from Catalogue/Inventory, not copied from the Scene Post.

• Seller remains eligible for public commerce.

• Hotspot relationship and display-order references are internally valid.

An eligible available Product additionally has at least one currently purchasable in-stock Variant. Structural tag eligibility and current availability are distinct: a retained historical unavailable tag may be displayed only while another available tag keeps the Scene PUBLIC.

## 27. Required Product and Availability Publication Rule

Minimum valid Product tag count for public publication is ONE. A draft with zero tags cannot publish; return PRODUCT_TAG_REQUIRED. At least one valid tag must also be currently eligible/available, otherwise return NO_AVAILABLE_TAGGED_PRODUCT. These are publication requirements, not merely FYP filters.

The Content resolver uses the current published or proposed working revision and domain-owned canonical availability. It never trusts a cached Seller readiness badge, client stock value or prior impression.

```
public_eligible = (
  publication_state == PUBLISHED and visibility == PUBLIC
  and caption_ok and media_ok and seller_ok and market_ok and moderation_ok
  and valid_tag_count >= 1 and eligible_available_product_count >= 1
)
fyp_eligible = public_eligible   # Recommendation applies its own ranking rules
```

## 28. Product State Changes

| Product change | Scene Post revision | Current presentation consequence |
| --- | --- | --- |
| Price or Variant change | Unchanged | Next read resolves new canonical Product data |
| Some tagged variants unavailable | Unchanged | Affected Product tag shows current unavailable state; other products remain actionable |
| Product sold out / temporarily unavailable | Unchanged | Tag becomes non-actionable; current buyer-safe reason comes from Product/Inventory |
| Product unpublished or removed | Unchanged | Association becomes non-public/non-actionable; history is preserved |
| Product restored | Unchanged | May become actionable again after current eligibility resolution |

When a change leaves zero eligible available tags, Content transitions visibility to PRIVATE while retaining the published revision. Availability recovery triggers a complete eligibility recheck and possible automatic PUBLIC restoration; partial loss retains PUBLIC only while another tag passes.

## 29. Automatic PRIVATE Transition and PUBLIC Restoration

Scene Post is the canonical Seller-authored, image-led merchandising/discovery object containing tagged Product Posts. Product Post is the structured commercial representation of exactly one sellable Product. Scene revisions reference current Product truth rather than owning price, stock, Variant sellability, payment or Trust.

Initial public publication requires a non-empty valid caption, ready authorized image presentation, at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product, plus Seller, Market and Moderation eligibility. A Product counts as available when it has a currently purchasable in-stock Variant and is not withdrawn/restricted. Zero tags fail PRODUCT_TAG_REQUIRED; all unavailable tags fail NO_AVAILABLE_TAGGED_PRODUCT.

Last available tagged Product loss keeps publication_state=PUBLISHED and changes visibility PUBLIC -> PRIVATE, with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE (or the stock-specific reason ALL_TAGGED_PRODUCTS_OUT_OF_STOCK). This is neither archival nor Moderation removal. If another tagged Product remains available, the Scene may remain PUBLIC while unavailable tags show safe current non-purchasable state.

Content re-evaluates availability restoration against every current public gate. A stock-driven PRIVATE Scene automatically returns to PUBLIC when at least one tagged Product is available and all gates pass. Restock never overrides Seller/Market suspension, Moderation, media restriction or ARCHIVED state; no manual republish is required solely because stock returned.

PRIVATE Scenes are excluded from every Buyer/public FYP, Search, Storefront/profile, deep link and Collection resolution. Seller management retains the Scene with a clear Private badge, reason and restoration condition. Notify the Seller on automatic PRIVATE/PUBLIC transitions; notification failure never rolls back canonical state. Restricted investigation is independently authorized, purpose/case scoped and audited.

Inventory/transaction -> StockEvent or Product availability fact -> durable outbox -> idempotent BullMQ consumer -> Content finds affected current Scene relationships -> recomputes current eligibility -> commits visibility/history/outbox -> public projections and Seller notices refresh. Inventory never directly writes Scene state.

The stored derived visibility may await the consumer briefly, but every new public resolution uses current canonical eligibility and must deny an all-unavailable Scene during that lag. Reconciliation repairs missed/stale projections. Restock changes visibility, not the immutable revision.

![Canonical Scene and Inventory facts, versioned durable effects](graphics/SCN_04.svg)
*Figure 04. Canonical Scene and Inventory facts, versioned durable effects. Legacy mapping requires actual compatibility evidence and resolves to the same logical business effect.*

## 30. Market Rules

```
Every Product Post and Scene Post belongs to exactly one Market in the current release. The server derives
market_id from the Seller's single active operating Market. Sellers cannot author the same Product/Post for multiple
countries through one current MVP Seller context.
```

Content is shown only when the resolved Buyer/public Market matches the Seller/Post Market. FYP/Home candidate generation, Seller Storefront public projection and Product Post discovery all enforce this boundary. Public links opened from another Market show a safe market-unavailable result rather than silently presenting purchasable content that cannot be fulfilled there.

API instants are UTC. Human-facing publication times and Seller operational context render using the relevant Market IANA timezone.

• No cross-Market Product tags.

• No shared multi-country stock pool in this domain.

• No client-selected arbitrary Market on content create/publish.

• Background workers recover Market from canonical post/event data, never from the worker machine locale or requester IP alone.

## 31. Future Multi-Market Seller Expansion

Future releases may add explicit SellerMarket relationships and allow a Seller with approved operations in several countries to publish Market-specific Product Posts/Scene Posts across those Markets. That future design must define Market-scoped price, inventory, fulfilment, PSP availability, policy and content visibility.

```
The current schema keeps market_id explicit so expansion is possible, but it does not expose multi-country
management controls now. A future migration must not reinterpret one current single-Market post as globally available.
```

## 32. Publication Readiness

Publication readiness deterministically returns actionable blockers and is recomputed in the publish command. Required families include MEDIA_MISSING, MEDIA_NOT_READY, MEDIA_NOT_AUTHORIZED, CAPTION_REQUIRED, PRODUCT_TAG_REQUIRED, NO_AVAILABLE_TAGGED_PRODUCT, PRODUCT_NOT_ELIGIBLE, PRODUCT_MARKET_MISMATCH, PRODUCT_SELLER_MISMATCH, HOTSPOT_INVALID, SELLER_NOT_PUBLIC_ELIGIBLE, CONTENT_MODERATION_RESTRICTED and MARKET_NOT_ACTIVE.

Every supplied tag is validated structurally, and at least one currently valid tag must have a purchasable in-stock Variant. A valid caption/image alone never makes zero-product content publishable.

## 33. Publication Transaction

The canonical transaction validates current readiness, freezes the revision and emits durable consequences. No inventory is reserved merely by publishing a Scene.

```
BEGIN
  lock ScenePost root + working revision
  authorize ordinary Account + Seller + Console permission
  resolve Seller Market and decision_at
  require valid non-empty caption and ready authorized image presentation
  validate all tags: same Seller + same Market + structurally eligible Product
  require valid_tag_count >= 1 and eligible_available_product_count >= 1
  validate hotspots + Seller + Market + Moderation + working ETag/version
  freeze published revision; update current_published_revision_id
  set publication_state=PUBLISHED and visibility=PUBLIC
  clear working_revision_id; append immutable transition/history
  insert transactional outbox events
COMMIT
```

## 34. Public Identity and Slugs

Scene identity/public reference is stable across revisions. Seller-scoped slugs and approved redirect history remain; exact revision references are purpose-specific evidence rather than authorization. Current public resolution always checks publication, visibility and every hard eligibility gate.

Canonical Scene route: /scene/:sceneRef. Storefront may use /s/:sellerHandle/post/:postSlug. Product route remains /s/:sellerHandle/p/:productSlug. If old routes or identifiers are deployed, keep a bounded compatibility alias period with identical current eligibility checks; use canonical Scene names in new contracts.

## 35. Deep Links

Deep links are untrusted input. Resolve Scene public reference -> current published revision -> visibility -> Seller -> Market -> Moderation -> media and available-tag eligibility. PRIVATE, archived, restricted or out-of-Market results return approved safe unavailable copy without captions/images/tags or internal reasons.

A known URL, stale client cache, saved Collection or old route alias cannot bypass current public eligibility or client-version policy.

![One stable public URL / current eligibility](graphics/SCN_05.svg)
*Figure 05. One stable public URL / current eligibility. Installed app and anonymous web resolve the same public-safe Scene identity; both deny private content.*

## 36. Seller Storefront Integration

Storefront/profile exposes only current PUBLIC eligible same-Seller Scenes and current Product projections. Backend-defined ordering remains; no Seller pin/reorder controls are added. Storefront never reuses FYP rank as Seller-page order.

An all-unavailable Scene is PRIVATE and absent from public lists/detail, including previously saved/direct references. Authorized Seller Console management still shows the retained published Scene, Private badge, typed reason, current tag statuses and restoration condition. Buyer-safe copy omits private Inventory/Moderation detail.

## 37. FYP and Home Integration

Buyer Home tabs are For You (default), Following, Nearby, Discounts and Locally Made. FYP/For You top-level units are SCENE_POST only; Product Posts are reached through tags, Shop/Search, Seller surfaces and direct Product links.

Content provides hard PUBLIC/available-tag eligibility and structured metadata. Recommendation owns ranking, bounded new-Seller exploration, diversity, personalization and impression lineage. Continued distribution depends on relevance, Buyer response, content quality, conversion and Trust; paid promotion cannot buy Trust or override hard eligibility.

PRIVATE, Moderation, Seller/Market restrictions and unavailable-tag state are rechecked before candidate exposure even when Valkey projections lag. Scene media remains image-only; TikTok never enters FYP.

![Buyer Home discovery container](graphics/SCN_06.svg)
*Figure 06. Buyer Home discovery container. For You is the default Scene-only tab; other tabs and labels use current Market configuration.*

## 38. Collections Integration

Collections supports independent PRODUCT_POST and SCENE_POST items. Whole-Scene save records stable Scene reference, the revision seen at save time, saved_at and approved source attribution. Current public rendering normally resolves the current eligible revision; historical provenance remains for Analytics.

If the Scene becomes PRIVATE/archived/deleted/restricted, membership may remain internally but Buyer resolution returns unavailable without restricted content. PUBLIC restoration may resume normal rendering under Collections policy. A Product save is independent of a Scene save and never changes canonical Content state.

![Private mixed Buyer Collections](graphics/SCN_07.svg)
*Figure 07. Private mixed Buyer Collections. Product and whole-Scene targets are first-class; retained private Scene membership never reveals private content.*

```
CollectionItem
  target_type = PRODUCT_POST | SCENE_POST
  target_id / saved_at / saved_from_scene_revision_id?
  source = FYP | SEARCH | STOREFRONT | DIRECT_LINK | PRODUCT_DETAIL
```

## 39. Search Integration

Marketplace Search launches with PRODUCT_POST, SELLER and SCENE_POST. Search owns retrieval/query interpretation/ranking and consumes safe current Content/Product/Seller projections. Only PUBLIC eligible Scenes may appear. PRIVATE transition removes/inactivates the projection; PUBLIC restoration reactivates it idempotently. Stale Search cache never authorizes private content. PostgreSQL + pg_trgm may remain sufficient; dedicated search infrastructure requires measured need.

Content supplies stable public Scene reference, Seller, Market, current public eligibility, approved caption/search metadata, publication timestamp, bounded media descriptor, eligible tagged-product context and Moderation status. Seller-private management filtering remains separate and may use pg_trgm.

## 40. Moderation Integration

Scene Post is a first-class Moderation target. A report records stable post identity and exact revision identity. The evidence package may include the immutable caption/media/product-association snapshot that the reporter actually saw.

Moderation removal immediately changes authoritative public eligibility and triggers FYP/Home/Storefront/CDN invalidation asynchronously. The Seller cannot bypass a current removal by creating a new publication pointer to the same restricted revision.

Product moderation and post moderation are separate. A Product becoming restricted can make its tag non-actionable or remove FYP commerce eligibility without rewriting the post revision.

Stock-driven PRIVATE is not a Moderation decision. If a Product restriction removes the last eligible available tag, Content applies PRIVATE; restock alone cannot bypass the underlying Product/Scene Moderation restriction. Scene visibility consequences also invalidate Search and Collection/public deep-link resolution.

## 41. Seller Suspension

Seller safety suspension is owned by Seller/Moderation, not implemented by mutating every Scene Post row. Derived public/FYP eligibility fails for posts owned by a suspended Seller. Public cache and candidate projections are invalidated/reconciled.

Because current posts cannot tag another Seller's Products, there is no external product-owner suspension/revocation workflow inside a Scene Post. Future creator commerce would require a new explicit design.

Seller suspension prevents every public Scene read and automatic restoration. Restricted Seller status never changes historical author/revision evidence, and inventory recovery does not override it.

## 42. Analytics and Attribution

Analytics observes content behavior but never becomes publication or commerce authority. Attribution uses stable post/revision/product identifiers and distinguishes seller-authored product tags from Product Posts opened elsewhere.

The updated commerce funnel is: FYP/Home impression -> Scene Post view -> Product tag interaction -> Product Post view -> Seller Cart -> Checkout Session -> payment attempt -> provider-verified paid Seller Order -> fulfilment -> completed Handoff -> Review/Claim signal.

Content-to-commerce reports can compare impressions, saves, shares, product-tag CTR, Product views, checkout starts, paid Orders and completed Orders. The Buyer-side Checkout surcharge is a Payments/Checkout financial fact and is not calculated by Content analytics.

## 43. Payment Provider and Checkout Boundary

Content does not create Cart, Checkout, payment or Order state. When a Buyer selects a Product Post, Mobile/backend revalidate Product, Variant, price, inventory, Seller and Market before creating seller-specific Cart/Checkout state.

Payment attempts are created server-side through the Payments provider adapter. Chapa is the initial named provider where Market configuration enables it; other approved PSPs use the same provider-independent contract. A browser/app provider return is not payment proof; provider facts are verified/reconciled server-side.

The current launch-disabled zero Buyer-side Adulis Checkout surcharge is calculated and snapshotted by Checkout/Payments. Scene Post content never stores or displays a duplicated surcharge as Product truth.

## 44. Event Contracts

Content writes one canonical versioned fact per accepted state change. New producers emit scene_post.published and scene_post.visibility_changed; no independent became_private/became_public aliases. Inventory input is inventory.changed. Other declared scene_post lifecycle facts retain explicit registry semantics.

| Canonical fact | Owner / payload / consumers |
| --- | --- |
| scene_post.published | Content; Scene/Seller/Market, revision + effect identity; REC/SRC/Storefront/Media/Analytics. |
| scene_post.visibility_changed | Content; previous/current visibility, reason, aggregate revision + logical effect identity; all public projections/Notifications. |
| inventory.changed | Inventory; Product/Variant/Seller/Market, stock revision + effect identity; Content and current eligibility readers. |

Registry is shared with EVT, including schema/version/scope/order/replay/correction. Legacy mappings exist only where actual historical/deployed evidence requires them, and map to one logical effect.

## 45. API Contract

Canonical routes below are illustrative generated OpenAPI contracts. Seller mutations enforce current permissions, Console audience, Seller/Market context, state, concurrency and idempotency; public reads return only current PUBLIC eligible content.

| Method / route | Action | Contract |
| --- | --- | --- |
| POST /v1/seller/scene-posts | Create root/working revision. | Idempotency-Key; Seller/Market server-derived. |
| PATCH /v1/seller/scene-posts/{id}/draft | Edit caption/media/tags/hotspots. | If-Match; exact write/tag/media permissions. |
| POST /v1/seller/scene-posts/{id}/publish | Publish/revise. | Complete readiness; zero/all-unavailable tags rejected. |
| POST /v1/seller/scene-posts/{id}/archive | Archive. | Idempotency; never stock-driven archive. |
| POST /v1/seller/scene-posts/{id}/restore | Restore and revalidate. | Every public gate required. |
| DELETE /v1/seller/scene-posts/{id} | Request lifecycle deletion. | Write permission + Privacy/hold checks. |
| GET /v1/scene-posts/{publicRef} | Current public Scene detail. | PRIVATE and current ineligible results unavailable. |
| GET /v1/scene-posts/{publicRef}/products | Current tagged Product projections. | Same-Seller/current eligibility; no private Scene bypass. |
| GET /v1/storefronts/{handle}/posts | PUBLIC same-Seller Scenes. | Backend default order; bounded pagination. |
| GET /v1/search?type=SCENE_POST | Launch Scene Search through Search domain. | Market/current public eligibility; bounded descriptors. |

## 46. Database Model

Catalogue retains Product canonical data. Content stores Scene references/composition/history only, with explicit Seller and Market scope. No cross-Seller consent tables or standalone Creator ownership objects are introduced.

| Conceptual table | Purpose | Key rule |
| --- | --- | --- |
| core.scene_post | Stable root/public reference and current pointers. | Seller/Market; publication_state; visibility; typed visibility reason/version; current/working revision refs. |
| core.scene_post_revision | Caption/media/author immutable published snapshot. | Unique Scene/version; at most one working revision. |
| core.scene_post_product | Revision -> Product Post relationship. | Unique revision/Product; same Seller/Market; published immutable. |
| core.scene_post_hotspot | Optional normalized Product-tag geometry. | Bound to versioned MediaPresentation; x/y in [0,1]. |
| core.scene_post_slug_history | Stable Seller-scoped links/redirects. | Append-only; aliases cannot bypass eligibility. |
| core.scene_post_transition | Lifecycle/visibility audit and provenance. | Scene/from/to/reason/actor or system fact/decision_at. |

## 47. Indexes and Constraints

```
•
scene_post(owner_seller_id, publication_state, published_at DESC) for Seller management
and Storefront list.
```

```
•
scene_post(market_id, publication_state, published_at DESC) for bounded Market
projections/FYP candidate scans.
```

• Unique Seller-scoped public slug/ref for active canonical URL.

```
•
scene_post_revision(post_id, version) unique and partial uniqueness for one WORKING revision.
```

```
•
scene_post_product(revision_id, product_id) unique plus Product lookup index for availability
reconciliation.
```

• Hotspot x/y database CHECK constraints in [0,1].

```
•
pg_stat_statements identifies expensive detail/candidate queries; pg_trgm supports seller-private management
filtering; btree_gist is used only for a real exclusion constraint, not decoratively.
```

Index current-public scans by market_id/publication_state/visibility/published_at, and Product-to-current-Scene relationships for affected availability rechecks. pg_trgm may support approved launch Scene caption/metadata Search and Seller-private filtering. Enforce publish minimum-tag/readiness in the domain transaction; drafts may remain incomplete.

## 48. Caching and CDN

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

Cache genuinely non-sensitive static shells and permitted immutable image/static assets only. Scene-bearing data/HTML/caption/title/card/meta bypasses full-page/data CDN caching, ISR and stale-while-revalidate unless the authoritative decision still runs before every delivery. Dynamic nonce HTML uses the existing fresh per-response CSP nonce profile and no shared HTML cache; static asset policies stay compatible. Already delivered bytes, in-flight responses and external screenshots/copies cannot be recalled. Authorized Seller-private and case-scoped Operator access are separately authenticated.

Valkey bounded projections and invalidation remain performance/recovery support. Current batched owning-domain reads determine the response; neither event lag nor stale cache confers access.

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

## 49. Low-Data Behavior

• Return bounded Scene Post card payloads; fetch full tagged Products only on interaction.

• Use right-sized image derivatives and Expo Image/CDN caching; never ship originals in FYP cards.

• Do not preload Product detail, full reviews, Checkout or external TikTok embeds from a Scene Post card.

• Preserve caption and accessible tagged-product list even when hotspot overlay enhancement is unavailable.

• Keep FYP functional when Analytics is degraded; telemetry failure must not block content delivery.

## 50. Accessibility

• Caption is exposed to assistive technology as real text.

• Every hotspot has an accessible label such as Product name + action, never raw coordinates.

• Every tagged Product also appears in a non-visual accessible list.

• Availability is communicated with text, not color only.

• Touch targets meet mobile accessibility size guidance and keyboard operation works on Storefront.

• Reduced-motion preferences are respected; understanding a Scene never depends on animation.

## 51. Security

```
@fastify/helmet supplies HTTP security headers. libphonenumber-js remains part of the wider Auth stack but has
no Scene Post business responsibility.
```

| Threat | Control |
| --- | --- |
| Cross-Seller post IDOR | Seller-scoped query + membership/permission + inaccessible/404 behavior |
| Foreign Product injection | Server Product lookup + same-Seller + same-Market validation |
| Forged MediaAsset | Media owner/purpose/access-class validation |
| Cross-Market exposure | Server-derived Market + market-scoped public/FYP queries |
| Caption XSS | Plain text input + output encoding + Helmet/CSP |
| Mass post spam | @nestjs/throttler using shared Valkey where distributed coordination is required |
| Moderation bypass by republish | Public eligibility checks independent Moderation enforcement |
| Revision overwrite race | ETag/optimistic concurrency + row lock on publish |
| Stale cache visibility | Targeted invalidation + bounded TTL + authoritative eligibility on read/FYP |

## 52. Abuse Prevention

• Rate-limit create/publish/archive/delete commands per Account/Seller/device/network dimensions as appropriate.

• Reject repeated foreign Product reference attempts and feed abuse signals to Moderation/Abuse without inventing a hidden Content-owned Trust score.

• Detect duplicate/near-duplicate image spam through Media/Moderation policy where implemented, but do not block legitimate reuse of a Product across many Scene Posts.

• Require Product-linked publication and keep relevance Moderation: at least one valid available tag is mandatory, and every supplied tag must be materially related to the Scene.

• Do not expose FYP ranking internals or allow seller payment/subscription to silently purchase organic rank.

## 53. Failure Behavior

| Failure | Required behavior |
| --- | --- |
| PostgreSQL unavailable | Fail content mutations closed; do not fabricate success |
| Valkey unavailable | Degrade cache/queues; canonical reads/writes continue when safe; delayed side effects reconciled |
| Media readiness unavailable at publish | Fail publication closed with retryable blocker |
| Catalogue/Inventory lookup unavailable at publish | Fail Product relationship validation closed |
| FYP unavailable | Revision remains canonical; Storefront stays accessible only while current PUBLIC eligibility passes; no revision rollback |
| Storefront cache purge fails | Retry/alert; authoritative APIs stay correct |
| Analytics unavailable | Drop/retry telemetry; never block publication or Buyer navigation |
| Product state changes after impression | Buyer re-read shows current state; no stale purchase authority |
| PSP/payment provider unavailable | Content browsing remains; Checkout handles payment unavailable state |

If availability or another critical public dependency cannot be resolved safely, deny new Scene public exposure/publication rather than assuming eligibility. Worker/queue/purge outage cannot authorize a PRIVATE or all-unavailable Scene.

## 54. Concurrency

Multiple Seller team members may edit the same working Scene Post. Draft updates use optimistic concurrency with ETag/version tokens. Publication additionally obtains row locks on the root and working revision to prevent double publish or pointer races.

```
Product/Inventory changes may occur concurrently with publication. The publication transaction revalidates referenced
Products against current canonical state at decisionAt. Checkout later performs its own stronger current commerce
revalidation; post publication never locks inventory.
```

Availability consumers deduplicate, re-read the current published relationships and lock/version the Scene when committing a visibility transition. A stale event cannot reopen a subsequently restricted Scene. Publication/Inventory races are contained by decision-time validation plus response-time hard-gate rechecks and reconciliation.

## 55. Idempotency

• Create root, publish/revise, archive, restore and delete-request commands use stable idempotency keys.

• Replaying the same idempotency key with the same payload returns the prior result; reusing it with a materially different payload is an error.

• Draft PATCH uses optimistic concurrency rather than an idempotency record for every keystroke.

• Outbox/BullMQ consumers are safe for at-least-once delivery and deduplicate by consumer + event identity.

• Collections Save operations follow Collections idempotency, not Content state mutation.

## 56. Observability

```
Use Sentry for backend/web/mobile exceptions with release context and sensitive-field redaction; Pino for structured logs;
pg_stat_statements for database query visibility; Valkey/BullMQ metrics for cache/queue health; Cloudflare/R2
metrics for image delivery.
```

Important business correctness signals include stale removed content visibility, FYP delivery with zero eligible Products, cross-Market leakage, cross-Seller tag rejection volume, outbox backlog, CDN purge failure and revision drift.

• Log request_id, correlation_id, market_id, seller_context_id, post public ref, revision version, operation, duration and safe outcome code.

• Do not log full captions unnecessarily, private moderation reasons, provider payment payloads, auth tokens or raw Product private fields.

• Alert when FYP eligibility recomputation fails repeatedly or all-unavailable posts continue appearing in new FYP delivery.

Alert on PUBLIC effective exposure with zero eligible available tags; failed automatic PRIVATE/PUBLIC transitions; PRIVATE Scene returned by FYP, Search, Storefront or Collections; Inventory-to-Content consumer lag; stale public projection; outbox backlog; revision drift; cross-Seller tag attempts; Seller notice failure. General logs carry safe Scene/version/reason references, not private captions/evidence by default.

## 57. Testing

| Layer | Required coverage |
| --- | --- |
| Jest | Lifecycle/readiness rules, caption requirement, minimum-one-tag and available-Product publish rules, FYP eligibility, geometry helpers |
| Testcontainers | PostgreSQL constraints, revision immutability, ETag races, transactional outbox, Valkey/BullMQ integration where relevant |
| Playwright | Seller Console authoring, Storefront post/detail/save/deep-link behavior, no manual ordering controls |
| Maestro | Mobile FYP -> Scene Post -> Product Post, Scene Explorer, Save whole post, Market gating |
| k6 | FYP candidate/read, Storefront viral link traffic, publish bursts, public detail cache behavior |
| Security negative | Cross-Seller IDOR/tag injection, cross-Market leakage, XSS, stale permissions, rate-limit bypass |

Search, Collections/deep-link privacy, automatic stock-driven visibility/restoration and delayed-consumer response-time gates require integration/E2E coverage.

## 58. Critical E2E Scenarios

• Zero tags -> publish rejected with PRODUCT_TAG_REQUIRED; one unavailable tag -> NO_AVAILABLE_TAGGED_PRODUCT.

• One in-stock eligible tag -> PUBLIC publish; tags A/B available -> PUBLIC.

• A out of stock and B available -> remain PUBLIC with A non-purchasable; B also unavailable -> PUBLISHED + PRIVATE.

• PRIVATE is absent from FYP, launch Search, public Storefront/profile, deep links and Collection content; Seller sees Private badge/reason and advisory notice.

• Restock A -> automatic PUBLIC when every gate passes; Moderation, Seller/Market suspension, media restriction or archive still blocks restoration.

• Duplicate/reordered availability events and queue lag cannot expose private content; reactivation/projection/Seller notices are idempotent.

• Cross-Seller or cross-Market tag rejected; out-of-Market direct link safely unavailable.

• Product save and whole-Scene save are independent; retained Scene membership never leaks a private revision.

• Seller Companion authoring denied; Console publish/edit/archive/restore and hold-aware deletion succeed under exact capabilities.

• Product price/stock update affects current reads without rewriting revisions; Scene -> Product -> Checkout -> PSP-paid Seller Order attribution never manufactures money authority.

## 59. Load Testing

• FYP candidate selection and post detail do not perform N+1 Product/Inventory queries per hotspot.

• Viral Storefront/direct Scene Post traffic should primarily increase CDN/edge reads, not database queries per image.

• Publish bursts are bounded by Seller limits and database transaction capacity; async cache/analytics work is allowed to lag without corrupting publication.

• Large Sellers with many Product/Scene Posts use cursor/keyset pagination; unlimited business-level post count does not imply unbounded API response size.

```
•
Use pg_stat_statements evidence before introducing new search/storage infrastructure.
```

## 60. Retention, Archive and Deletion

DECISION CLOSED: adopt the prior safe default. ADU-SCN-01 does not hard-code a numeric retention duration. Archived/deleted revisions follow centrally versioned Privacy/Moderation retention policy and active holds.

Archiving removes the Scene Post from active discovery but does not mean deletion. Archived content remains restorable while policy allows and its historical revisions/analytics remain subject to Privacy/Moderation lifecycle rules.

Deletion removes public exposure first, then delegates destructive cleanup to the Platform Privacy/Data Lifecycle contract. Claim, Moderation appeal, legal or security holds can retain exact revisions/evidence beyond ordinary purge eligibility. The Content module records lifecycle status and proof but does not scatter fixed +N-day constants.

Published revision retention is therefore policy-driven and effective-dated. When central policy later changes, the lifecycle handler can recompute purge eligibility without a schema rewrite. This matches the platform rule that unrelated modules do not hard-code retention days.

Stock-driven PRIVATE retains the Scene, revision and authorized evidence; it is not archival, deletion or a reason to purge Media bytes. Only central lifecycle policy and surviving references/holds decide destructive cleanup.

## 61. MVP Scope

• Formal Product Post + Scene Post; required caption; image-based primary presentation and permitted carousel; optional accessible hotspots.

• Same-Seller/same-Market tags; minimum one valid tag and one eligible available Product for public publication.

• Immutable published revisions, working edits, optimistic concurrency, atomic publish/history/outbox.

• Automatic stock-driven PRIVATE/PUBLIC visibility, Seller Private badge/reason and advisory notices.

• Scene-only FYP/Buyer Home, launch public Scene Search, eligible Seller Storefront/profile and deep links.

• Mixed Product/Scene Collections with exact save provenance and private-resolution safeguards.

• Seller Console authoring only; exact-revision Moderation, attribution and centralized retention/holds.

• Connected-only commands; canonical PostgreSQL/Drizzle; Valkey/BullMQ; R2/CDN/Sharp; current security/quality/observability/deployment stack.

## 62. Explicitly Deferred Scope

• Native Scene video, cross-Seller tags and standalone Creator/affiliate catalogue.

• Automatic Product recognition, AI auto-tagging, unrestricted discussion/comments and collaborative real-time editing.

• Seller-controlled Storefront pin/reorder and simultaneous multi-Market Seller publishing.

• Retired recommendation-enrichment modules, dedicated Content microservice, Kafka or dedicated search engine without measured need.

Launch public Scene Search is current scope and must not be listed as deferred.

## 63. Future Expansion

Future richer media, controlled Storefront merchandising, separately approved Creator commerce and multi-Market Sellers require explicit new policy, authorization, attribution and safety decisions. Current launch Search is already supported. Product external video remains optional TikTok Product-detail-only; a richer media layout does not create a second Scene identity/lifecycle.

## 64. System Invariants

The following invariants are normative for implementation and launch certification.

• SCN-INV-01 Formal publishing types are Product Post + Scene Post.

• SCN-INV-02 Product Post is structured commerce truth for one sellable Product.

• SCN-INV-03 Each Scene belongs to one Seller and one Market.

• SCN-INV-04 Scene tags are same-Seller/same-Market in current MVP.

• SCN-INV-05 Public publication requires >=1 valid Product tag and a valid caption.

• SCN-INV-06 PUBLIC eligibility requires >=1 currently eligible available tagged Product.

• SCN-INV-07 Last available-tag loss makes PUBLISHED Scene PRIVATE.

• SCN-INV-08 Availability restoration automatically reopens stock-driven PRIVATE only after every current gate passes.

• SCN-INV-09 Stock-driven PRIVATE is not archival, deletion or Moderation.

• SCN-INV-10 Published revisions are immutable; current price/stock never become revision truth.

• SCN-INV-11 Content never owns payment, surcharge, Order state or Trust calculation.

• SCN-INV-12 FYP top-level units are Scene Posts only.

• SCN-INV-13 Marketplace Search includes PUBLIC Scene Posts at launch.

• SCN-INV-14 Collections supports independent Product Post and Scene Post targets; private membership cannot leak content.

• SCN-INV-15 Scene native media is image-based; TikTok is Product-detail-only.

• SCN-INV-16 Seller Companion cannot author Product/Scene content.

• SCN-INV-17 Valkey/CDN/client caches cannot authorize public visibility.

• SCN-INV-18 Outbox/BullMQ consumers are idempotent and current-state aware.

• SCN-INV-19 Public APIs/deep links never expose PRIVATE Scene content.

• SCN-INV-20 Standalone Creator/cross-Seller commerce is not current MVP.

• SCN-INV-21 Retention durations and holds are centrally policy-owned.

• SCN-INV-22 No Seller-controlled Storefront Scene pin/reorder exists at launch.

• SCN-INV-23 Content never imports foreign private repositories.

## 65. Superseded Decisions

• The former post/presentation split is replaced by one formal Scene Post object.

• Zero-tag publication, all-unavailable public content and FYP-only stock exclusion are replaced by minimum-one-available-tag publication and global Buyer/public PRIVATE handling.

• Public Scene Search deferral is superseded by Product/Seller/Scene launch Search.

• Cross-Seller tags, Creator/affiliate authority and automatic recognition remain unapproved future scope.

• Required caption, mixed Collections, provider-based commerce, connected-only mutations, immutable revisions and centralized retention remain current.

## 66. Canonical Write-Backs

Canonical linked-contract reconciliation uses Scene identity/revision/product/hotspot tables, Scene API/DTO/event names, current Seller Scene permission family, PUBLIC/PRIVATE eligibility and exact revision provenance. Search includes Scene from launch, Collections stores PRODUCT_POST/SCENE_POST, and Media uses SCENE_* bindings/purposes.

If previous identifiers are already deployed, use expand-migrate-contract: add canonical aliases/fields/routes, migrate stored target/event/grant references, preserve read compatibility and historical evidence during a bounded period, verify old-client behavior, then retire obsolete writes. Compatibility never bypasses current readiness/visibility/security.

Inventory emits facts; Content owns visibility; Notifications owns advisory transport; Recommendation/Search own ranking; Order/Payments own commerce; Privacy owns retention policy.

## 67. Implementation Sequence

• Phase 0: canonical Scene contracts and safe compatibility migration plan.

• Phase 1: Seller/Market root, independent visibility, revisions, tags and current RBAC.

• Phase 2: required caption, R2/CDN/Sharp references and presentation/hotspot geometry.

• Phase 3: minimum tag/current availability publication resolver and atomic immutable publish/outbox.

• Phase 4: Inventory/Product facts -> current Content eligibility -> PRIVATE/PUBLIC transitions and Seller notices.

• Phase 5: public read/deep-link/Storefront hard gates, launch Search and Scene-only FYP/Buyer Home.

• Phase 6: mixed Collections and private-resolution safeguards; exact-revision Moderation.

• Phase 7: provider commerce attribution, central lifecycle/holds, reconciliation, metrics and security/E2E/load certification.

## 68. Production Launch Gate

• Canonical Scene naming is consistent in roots/revisions, APIs, permissions, events, analytics, Collections and clients.

• Zero/all-unavailable publication fails; same-Seller/Market tags, caption/media and current hard gates are enforced.

• Last available loss keeps PUBLISHED and makes PRIVATE; restock restores automatically only while all gates pass.

• Seller Private badge/reason and privacy/restoration notices work without changing canonical-state authority.

• PRIVATE cannot resolve through FYP, Search, Storefront/profile, direct links or Collections even during consumer/purge lag.

• Marketplace Search returns Product/Seller/Scene; FYP top-level units are Scene only; Buyer Home tabs are current.

• Revisions are immutable; Seller Console alone authors; no cross-Seller/Creator/native-video scope is silently enabled.

• Mixed Collection saves, exact-revision Moderation and policy/hold-aware lifecycle work independently from stock privacy.

• Outbox/BullMQ duplicate/reordered/retry handling and Valkey outage remain safe; response-time current eligibility fails closed.

• Generated OpenAPI compatibility, Testcontainers/Playwright/Maestro/k6, security negatives, Sentry/Pino/pg_stat_statements and dependency-cruiser gates pass before production.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 69. Final Architecture Diagram

Seller Console authors one canonical Scene object; domain-owned current facts govern public eligibility. Public consumers share that gate and retain their own ranking/save responsibilities. Commerce begins at Product detail and remains provider/Order authoritative.

![Current eligibility runs before every new controlled Scene delivery](graphics/SCN_08.svg)
*Figure 08. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

![Canonical Scene and Inventory facts, versioned durable effects](graphics/SCN_09.svg)
*Figure 09. Canonical Scene and Inventory facts, versioned durable effects. Legacy mapping requires actual compatibility evidence and resolves to the same logical business effect.*

## 70. Engineering Doctrine

The content system should be visually expressive but architecturally strict. A Buyer can encounter many Sellers in the FYP, yet every individual Scene Post remains a clean Seller-owned composition whose Product relationships, Market and evidence lineage can be explained exactly.

Publication is not commerce authority. A beautiful Scene does not prove a Product is available; a saved post does not preserve an old price; a client success screen does not prove payment; a cached candidate does not override Moderation; and a deleted public object does not erase held evidence.

The final implementation principle is: Content owns presentation and revision history. Catalogue/Inventory own what can be bought. Recommendation owns cross-Seller discovery order. Collections own saves. Payments/Orders own commerce. Privacy/Moderation own retention and enforcement.

The canonical object is Scene Post. Publication/revision history and current PUBLIC/PRIVATE visibility are separate; availability can hide or restore retained content without rewriting evidence. Every Buyer/public surface consumes the same hard current eligibility.

## 71. Appendix A - Canonical Technology Baseline

| Layer | Canonical baseline | Scene Content relevance |
| --- | --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript | Content commands/queries, readiness, lifecycle and public APIs |
| ORM / DB | Drizzle ORM; PostgreSQL | Canonical root/revision/tag/hotspot/outbox truth |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements | Launch Scene Search and private management filtering where sufficient; justified constraints; query diagnostics |
| Async / cache | Valkey; BullMQ | Non-canonical cache, outbox consumers, invalidation/reconciliation and throttling support |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client | One typed contract across Seller Console, Mobile and Storefront |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js | Rate limits and HTTP hardening; phone library remains Auth-only |
| Media | Cloudflare R2; Cloudflare CDN; Sharp | Image upload/delivery/derivatives; no Scene video pipeline |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; SecureStore; SQLite; Camera; Notifications; Updates; small Zustand | FYP/Scene rendering, deep links and client state; canonical Content stays server-side |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 | Unit/DB/mobile/web/load verification |
| Observability | Sentry; Pino structured logs; pg_stat_statements | Errors, redacted logs, query performance |
| Architecture control | dependency-cruiser | Forbid private cross-domain imports/cycles |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS | Reproducible API/worker/web/mobile delivery |

## 72. Appendix B - Runtime Placement and Responsibility

| Runtime | Content work | Must not do |
| --- | --- | --- |
| Render API | AuthZ, commands/queries, readiness, PostgreSQL transactions | Proxy large image bytes; run heavy Sharp work |
| Render worker | Outbox consumers, reconciliation, cache/CDN invalidation | Create alternate Content truth |
| PostgreSQL | Root/revision/tags/hotspots/history/idempotency/outbox | Serve media bytes; store FYP rank |
| Valkey | Bounded cache, BullMQ queue state, distributed throttle counters | Authorize publish/Market/Moderation or store canonical content |
| Cloudflare R2/CDN | Image bytes and public derivatives | Own post semantics or Product truth |
| Seller Console | Authoring UX / scene editor | Decide authorization or canonical readiness |
| Seller Companion | Read status/performance/alerts only | Author/create/edit/publish Content |
| Buyer Mobile | Render FYP/Scene/Products, save/open Product | Persist canonical Content or payment truth locally |

## 73. Appendix C - API, Security and Client Contract Rules

• OpenAPI generated clients are CI artifacts; handwritten duplicate Content DTOs are discouraged/prohibited by architecture rules.

• All Seller mutations validate ActorContext + SellerContext + MarketContext + permission server-side.

• Public routes validate stable public refs and current eligibility; internal UUID exposure is unnecessary.

• @nestjs/throttler may use Valkey for distributed limits across API replicas.

• TanStack Query owns server state; Zustand remains bounded ephemeral editor/UI state only.

• Expo SecureStore protects session/device secrets; SQLite may support technical client metadata but not disconnected Content authoring.

• Public payloads are bounded; Product details and Checkout are loaded only when the Buyer enters those resources.

## 74. Appendix D - Data, Media and Mobile Performance Rules

• Batch Product/Inventory/Seller projections for a post; never one database round trip per hotspot.

• FYP uses FlashList + Expo Image + CDN derivatives and bounded prefetch.

• Public post payload includes dimensions/presentation metadata before image load to avoid layout shift.

• Seller Console and Buyer surfaces use the same canonical image presentation transform for hotspots.

• Sharp work runs in Media workers with bounded resource/concurrency limits.

• FYP never loads external Product TikTok embeds; those remain Product-detail behavior under Catalogue policy.

• Use cursor/keyset pagination for Sellers with unlimited Product/Scene Post counts.

## 75. Appendix E - Quality, Observability and Architecture Control

• dependency-cruiser rejects Content importing foreign private repository paths.

• OpenAPI breaking changes require review; generated clients are verified in CI.

• Drizzle migrations include ownership, immutability, FK/index and rollback/expand-contract review.

• Jest + Testcontainers + Playwright + Maestro + k6 gates run at appropriate layers.

• Sentry releases map to Git commit/EAS update where applicable and redact sensitive data.

• Pino logs include safe request/post/revision/Market/Seller context.

• Dashboards include p95 detail/publish latency, eligible-product recomputation errors, queue age, cache/CDN invalidation failures and hot pg_stat_statements fingerprints.

## 76. Appendix F - Delivery and Production Topology

GitHub Actions runs typecheck/lint, dependency-cruiser, Jest/Testcontainers, generated OpenAPI compatibility, Playwright and selected k6 gates. One reviewed Docker backend artifact serves independently deployed Render API/worker processes. PostgreSQL is canonical; Queue Valkey supports BullMQ and Cache Valkey remains rebuildable.

Cloudflare edge/CDN/R2 serves approved image/public delivery; Media direct uploads and Sharp processing preserve the established boundary. Expo/EAS controls Mobile builds/updates. Company Website remains independently owned in adulis-web; clients never receive database credentials or foreign private repositories.

![Managed deployment boundaries](graphics/SCN_10.svg)
*Figure 10. Managed deployment boundaries. Cloudflare edge and Render compute serve isolated clients; Platform truth, independent Website data, queue/cache roles and image delivery remain explicit.*

## 77. Appendix G - Stack-Specific Final Launch Checks

• NestJS runs with FastifyAdapter and transport details do not leak into domain logic.

• @nestjs/swagger emits Seller/Public Content routes, ETag and idempotency requirements correctly.

• Generated TypeScript clients are consumed by Seller Console, Mobile and Storefront where applicable.

• All Content PostgreSQL queries are visible in pg_stat_statements.

• Valkey loss is tested; canonical Content reads/writes never treat cache as truth.

• BullMQ duplicate/retry tests prove outbox consumers are idempotent.

• Cloudflare R2/CDN serves image bytes; NestJS load tests do not proxy full media.

• Sharp derivative work is bounded and isolated in Media workers.

• Expo Router deep links, FlashList and Expo Image pass realistic low-memory/low-bandwidth device tests.

• Sentry source maps/releases and Pino redaction are verified.

• dependency-cruiser fails CI on an intentional forbidden import fixture.

• Docker, Render, Cloudflare and EAS release procedures are documented and reproducible.

• No current code path contains the superseded pre-payment content/commerce model, discontinued recommendation-enrichment UI, or non-Valkey cache naming.

## 78. Glossary

| Term | Definition |
| --- | --- |
| Product | Seller-owned sellable item whose current price/stock/Variants resolve from Catalogue/Inventory. |
| Product Post | Canonical structured commercial representation of exactly one Product. |
| Scene Post | Seller-owned image-led merchandising/discovery with same-Seller Product tags. |
| Scene Revision | Versioned caption, image presentation, tags, hotspots and author provenance. |
| Working Revision | Editable connected-only revision protected by optimistic concurrency. |
| Published Revision | Immutable evidence snapshot referenced by the stable Scene root. |
| Product Tag | Explicit same-Seller/same-Market relationship to a canonical Product Post. |
| Hotspot | Optional normalized visual Product-tag coordinate, supplemented by accessible lists. |
| Media Presentation | Versioned normalized crop/orientation/geometry used by the revision. |
| Publication State | DRAFT/PUBLISHED/ARCHIVED Seller lifecycle intent, separate from visibility. |
| Visibility | Current PUBLIC/PRIVATE exposure dimension owned by Content. |
| PUBLIC | Public-eligible published Scene with >=1 available valid tag and all gates passing. |
| PRIVATE | Retained Scene unavailable to Buyer/public resolution; authorized Seller management remains. |
| ARCHIVED | Explicit Seller removal; restock alone cannot reopen it. |
| Eligible Available Product | Valid public Product tag with a purchasable in-stock Variant and current hard gates. |
| Scene Eligibility | Current caption/media/tag/availability/Seller/Market/Moderation public decision. |
| FYP | For You recommendation feed of eligible Scene Posts only. |
| Marketplace Search | Launch search returning Product Posts, Sellers and PUBLIC Scene Posts. |
| Collection Item | Independent private Buyer save of Product or whole Scene with safe current resolution. |
| Attribution | Scene/revision/tag/impression provenance; never payment or Order authority. |
| Transactional Outbox | Durable event committed with canonical state, then relayed/reconciled. |
| Valkey | Non-canonical cache/queue infrastructure. |
| BullMQ | Idempotent async consequences and reconciliation on Queue Valkey. |
| Shoppable Post | Superseded former term for Scene Post. |

## 79. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-01 — Buyer-facing Product / Scene terminology | The 13 October designs use Product Post and Scene Post as canonical domain names. | Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly. | PR-001 / PR-005, 26-27 Oct 2026 |
| R-02 — Scene publication and all-unavailable lifecycle | The 13 October pack already requires a legitimate same-Seller Product relationship and at least one currently available tagged Product at public publication. | Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product. Zero-tag or all-unavailable initial publication is rejected. A published Scene stays public while at least one tagged Product remains available. If the last available tagged Product becomes unavailable, the Scene remains PUBLISHED but effective Buyer visibility becomes PRIVATE across FYP, Following, Nearby, Search, Buyer Seller profile, public Storefront and Buyer-facing Collection/direct resolution. Seller/Operator views retain it with Private state. Restoration of at least one eligible Product automatically re-evaluates and may restore PUBLIC without republishing. | Founder rule + PR-004 reconciliation |
| R-05 — Final Scene engagement model | The 13 October designs define Scene commerce/discovery but do not fully freeze the later action bar and presentation. | Scene actions are Like, Save, Share, Reviews, Follow, More and Explore the Scene. Like belongs to the Scene only and no public Like count is shown. Save saves the Scene only. Follow is Seller-level. More may include Not Interested where applicable, Hide this Scene and Report. Public comments and reposts are not part of the current MVP. Explore the Scene is the primary commerce-exploration action. | PR-004, 26-27 Oct 2026 |
| R-06 — Explore the Scene and hotspot placement | The 13 October designs support tagged Products/hotspots but do not fully freeze where hotspot UI appears. | Normal For You and Following Scene media carries no Product hotspots. Tapping Scene media or Explore the Scene opens the dedicated Explore surface. Explore owns numbered hotspots and the tagged-Product list; hotspot/list selection remains synchronized. Unavailable tagged Products remain visible with current price plus “Currently unavailable” and no purchase action. View Product only navigates to Product detail; it never orders automatically. | PR-004 follow-up, 27 Oct 2026 |
| R-13 — Seller engagement analytics grouping | The 13 October Analytics design provides event/attribution architecture but not the final Seller-facing metric grouping. | Scene Performance prioritizes commerce outcomes (Explore opens, Product-detail visits, Seller inquiries, Orders initiated, verified completed Orders) before engagement counts (views, hotspot taps, Likes, Saves, Shares). Product Performance includes views, Saves, Product rating, inquiries and Order outcomes. Seller Reputation keeps Seller rating, Product ratings, verified completed Orders, service quality and Trust separate. Do not blend popularity and Trust into one score. | PR-007, 27 Oct 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
