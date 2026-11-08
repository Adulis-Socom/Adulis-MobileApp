# Adulis Search & Collections
Version 3.2 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.1 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Complete amended baseline: 12 October 2026. The supplied correction prompt and owner decisions supersede the conflicting reviewed source wording. Every original numbered body section and unaffected table/graphic is retained; targeted contracts, examples, tests, invariants and dependent definitions are reconciled. The historical audit remains unchanged.

| Document control | Amendment baseline |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026 -> 3.2 post-October-13 reconciled 8 November 2026. |
| Source | ADU-SRC-01_Adulis_Search_Collections_System_Design_v3.1.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. System status and canonical decisions

Status: FINALIZED COMPLETE CURRENT BASELINE / v3.0 / October 2026. All original numbered sections remain, with current Scene, rollout, identity, ranking and Collection lifecycle contracts reconciled.

• Marketplace Search launches with PRODUCT_POST, SELLER and SCENE_POST. Product Post represents exactly one Product; Scene Post is the one canonical image-led tagged-content entity.

• Buyer Collections are private and can contain Product Posts and whole Scene Posts independently. Save is durable intent, never stock/payment/Cart authority.

• Scene Search is an MVP capability. Only the current PUBLIC, published, eligible revision participates; last available-tag loss makes the Scene PRIVATE and excluded everywhere public.

• Relevant public out-of-stock Product Posts remain searchable below relevance-qualified available Product candidates; zero-available Scene Posts are excluded.

• Storefront local Search remains one-Seller scoped; deliberate global navigation opens Marketplace Search/Shop.

• Browse Markets are a server-approved activated set, initially Ethiopia. Explicit switching applies only to a supported activated Market and never authorizes Checkout.

• Search/Collection business actions are connected-only. PostgreSQL/Drizzle is canonical; pg_trgm handles launch Search, Valkey/BullMQ supports cache/async repair.

• One ordinary Account spans Buyer/Seller/Courier relationships; Collections require its authenticated Buyer capability. Anonymous durable saves, reorder controls and inferred restock subscriptions are excluded.

## 2. Mission, doctrine and domain ownership

Search and Collections represent different buyer intents. Search expresses explicit discovery intent; Collections preserve durable interest. FYP remains passive algorithmic discovery, Shop remains structured browsing, Cart represents current seller-specific purchase intent, Checkout orchestrates payment, and Order records the commercial transaction.

```
FYP         = passive algorithmic discovery
SEARCH      = explicit query intent
SHOP        = structured browsing
COLLECTION  = durable saved intent
CART        = current purchase intent
CHECKOUT    = transaction orchestration
ORDER       = canonical commercial transaction
```

### Search owns

• query normalization and parsing

• candidate retrieval for Product Posts, Sellers and Scene Posts

• structured filters and entity-specific ranking

• Search country/Market browsing context

• Seller diversity reranking

• opaque pagination

• Search suggestions policy

• Search-specific telemetry and attribution identifiers

• Search result assembly and derived Search projections

### Collections owns

• private Collection lifecycle and names

• Buyer ownership

• Product Post membership

• whole Scene Post membership

• save provenance and revision-at-save metadata

• idempotent save/remove

• default Saved Collection

• Recent Saves read model

• current-state resolution contract

• Collection analytics facts

### Search and Collections do not own

• Product/Variant truth, price or stock

• Seller admission/status or Trust computation

• Scene Post lifecycle or moderation

• payment success or PSP reconciliation

• Order legality

• FYP ranking

• Handoff, Reviews or Claims truth

• media processing

## 3. Publishing terminology and canonical objects

Use canonical typed entities consistently in covers, APIs, schemas, Search projections, Collections and Analytics. No independent presentation-subtype content object or Creator Search result is introduced.

| Object | Canonical meaning | Search / Collection role |
| --- | --- | --- |
| Product Post / PRODUCT_POST | Structured one-Product commerce representation; current Variant/price/stock resolve from owning domains | Search / Shop / Storefront / detail; savable Product target |
| Scene Post / ScenePost / SCENE_POST | Seller-authored image-led caption plus same-Seller Product tags and immutable revisions; independent publication and visibility | PUBLIC eligible Scene Search + FYP + Storefront; whole Scene savable |
| Seller / SELLER | Public Seller identity/profile/Storefront | Seller result; not a current Collection target |

Scene revisions and Search documents never own mutable price, stock, Variant status, payment or Trust. These resolve through current Catalogue/Inventory/Order/Trust contracts. Native publishing remains photo/image; TikTok is optional external Product-detail content only.

## 4. Search surfaces

| Surface | Scope | Entities | Authentication |
| --- | --- | --- | --- |
| Marketplace Search | Selected browse country/Market; multi-Seller | Product Posts, Sellers, Scene Posts | Anonymous read allowed |

| Surface | Scope | Entities | Authentication |
| --- | --- | --- | --- |
| Seller Storefront Search | One Seller only | That Seller's Product Posts + Scene Posts | Anonymous read allowed |
| Seller Lookup | Selected browse country/Market | Sellers | Anonymous read allowed |
| Shop | Structured browse, not empty-query Search | Primarily Product Posts; configured merchandising | Anonymous read allowed |
| Collections | One authenticated Buyer Account | Product Posts + Scene Posts | Required |

### Empty query

GET /v1/search?q= must not become a marketplace catalogue dump. Shop and curated discovery surfaces handle browsing without an explicit query.

## 5. Seller Storefront discovery and social entry

### Social entry paths

```
TikTok / Instagram BIO link
    -> Seller Storefront profile
    -> local catalogue / local Search
```

```
TikTok / Instagram Product link in caption/comment
    -> exact Seller Product Post detail
    -> optional Seller catalogue navigation
```

```
Approved Scene Post direct link
    -> exact Scene Post detail
    -> tagged Product Post navigation
```

The Storefront public web surface is an acquisition bridge. It remains anonymous and mobile-first, but the navigation shell may expose broader Adulis public navigation after entry. The initial social-link destination remains exact and seller-owned.

### Seller-local Search

• `GET /v1/storefronts/{handle}/search` remains seller-scoped and can return that Seller's Product Posts and Scene Posts.

• Local Search must never silently mix other Sellers into the seller-scoped result list.

• When the visitor chooses a global Marketplace Search/Shop/Explore navigation control, the browser transitions to the marketplace discovery surface and may show other Sellers and Products.

• This separation preserves seller-store context while allowing full Adulis exploration once the public Storefront is open.

### Anonymous save boundary

Storefront browsing is anonymous; persistent saving is not. Save actions require an authenticated Buyer Account. If an anonymous visitor taps Save, the UI may invite account creation/sign-in, but it must not create a server Collection or silently persist a guest Collection.

## 6. Supported browse Markets and phased rollout

Discovery is globally extensible with phased Market activation. Initial browse/commerce availability is Ethiopia; only server-approved supported activated browse Markets appear in selectors or API allowlists. A country registry, Geo-IP hint, locale, SMS capability or global code path does not activate another Market.

Resolve a coarse default browse Market from approved Market/account context and coarse device/Geo-IP hints without mandatory precise GPS. Explicit user selection overrides the default only within the supported activated set. Seller/Product/Scene corpus must belong to the selected Market; unsupported/inactive requests return a safe unavailable result or bounded error, never global fallback.

Browse context is separate from transactional authority. Opening a result does not promise legal/operational purchase; Checkout revalidates current Seller, Product/Variant, price, stock, currency, Market and PSP capability. A Collection save persists across Market changes while current resolution explains supported Market unavailability.

![Activated discovery scope precedes retrieval](graphics/SRC_01.svg)
*Figure 01. Activated discovery scope precedes retrieval. A coarse default or explicit supported selection resolves server-approved browse Market. Initial rollout is Ethiopia; global code and country metadata never activate commerce.*

## 7. Marketplace Search result types and UI

Canonical result types are PRODUCT_POST, SELLER and SCENE_POST. Launch tabs can read Top | Products | Scenes | Sellers while the API/Analytics identity stays SCENE_POST.

For blended Top, retrieve/rank each relevance-qualified family independently, normalize bands and apply deterministic bounded type/Seller diversity. Raw trigram scores across unrelated entity types are not calibrated probabilities. Exact Seller handle/name matches remain strong; do not add ML merely to blend launch types.

Creator is not a current result type. A legitimately admitted Creator-as-Seller appears only through existing Seller and same-Seller Product/Scene rules.

## 8. Product Post Search

| Field / signal | Launch weight / use |
| --- | --- |
| Product name | Strongest lexical signal |
| Category | Strong |
| Structured attributes | Strong |
| Variant-defining attributes | Medium |
| Description | Lower weight |
| Availability | Hard ranking bucket; available before out-of-stock |
| Seller Trust / public quality | Secondary quality signal, never overriding exact intent |
| Commerce/popularity/freshness | Secondary tie-breakers; must not make Search become FYP |

### Structured filters

• category

• price_min / price_max

• seller

• availability

• trust_level where policy allows

• category-defined attributes such as size, colour, material, storage, shade, skin type or volume

• sort from a closed whitelist

Category-defined facets come from Catalogue schemas. Do not create universal columns such as size, RAM and shade on every Product.

### Variant-aware price

A Product Post matches a price range when at least one current eligible active Variant satisfies the range. Withdrawn/ineligible Variants do not count. Search displays current price presentation from Catalogue rather than storing an independent Search price truth.

First require query relevance, then apply current public hard gates and availability buckets. The strategic feature family is semantic/query relevance, public Trust/reliability, popularity, conversion and quality; launch semantic understanding uses bounded lexical/structured matching and controlled synonyms, not a new embedding/LLM service or an invented fixed formula.

## 9. Out-of-stock Search behavior

A temporarily out-of-stock Product Post can remain searchable when it is published/public, Seller/Market/Moderation eligible and query-relevant. This rule does not apply to a Scene with no available eligible tags.

For the query-qualified Product set, apply eligibility and partition A=available/in-stock and B=out-of-stock/public/searchable. Rank within each bucket by entity-specific relevance/quality; return A before B. If no A exists, B may lead. An irrelevant available Product does not enter A merely to displace a strong exact out-of-stock match.

Variant eligibility and price filters use current eligible active Variants. Opening Product detail/Checkout re-resolves mutable facts. Product Save preserves membership without stock hold, price freeze or automatic Cart.

![Relevance-qualified Products split into availability buckets](graphics/SRC_02.svg)
*Figure 02. Relevance-qualified Products split into availability buckets. Hard public eligibility follows query qualification. Available Products lead relevant public OOS Products; zero-available Scenes become PRIVATE and do not enter either Product bucket.*

Buyer restock alerting is deferred. A future explicit opt-in subscription may create notices; ordinary Product/whole-Scene Save never implies a subscription.

## 10. Seller Search and Seller Lookup

Seller Search uses only public Seller fields such as store name, handle and approved public category information. Private phone, payment, Claims, Chat, Buyer or internal Trust evidence must never enter the public Search corpus.

### Country as primary filter

• Country/Market is a first-class filter and is visible in Seller Lookup UX.

• Default is the Buyer's resolved current country.

• Buyer can select another supported country and Search immediately re-runs under that browse Market.

• Exact Seller/handle matches should not be suppressed by generic Seller diversity.

• Seller Lookup must remain rate-limited and bounded against enumeration.

Expose only supported activated browse Markets. Server checks corpus scope and current Seller safety/admission/Market status at response time; no inactive-country discovery is inferred from global metadata. Trust features are approved public projections, never private Claim/Buyer evidence.

## 11. Scene Post Search

Scene Post / ScenePost / SCENE_POST is the single canonical Seller-authored, image-led discovery object with caption and tagged Product Posts. Product Post is the structured commerce representation of exactly one Product. Scene revisions hold composition and provenance; Catalogue/Inventory own current Product, Variant, price and stock truth.

Initial public publication requires ready authorized images, a valid non-empty caption, at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product, plus every current Seller, Market, Content and Moderation gate. Drafts may be incomplete; zero tags fail PRODUCT_TAG_REQUIRED and all-unavailable tags fail NO_AVAILABLE_TAGGED_PRODUCT.

Last available tagged Product loss keeps publication_state=PUBLISHED and changes visibility=PUBLIC to PRIVATE. Content owns this automatic availability consequence and its reason; no archival, deletion or Moderation decision is inferred. With another available eligible tag, the Scene can remain PUBLIC while unavailable tags resolve safely.

Availability restoration automatically returns a stock-driven PRIVATE Scene to PUBLIC only when all current gates pass. Restock cannot override ARCHIVED state, Seller/Market suspension, a Scene Moderation restriction, unsafe media or another independent block. Seller management retains the Scene with a Private badge, reason and restoration condition.

PRIVATE is denied on FYP, Search, public Storefront/profile, direct links and public/Buyer Collection resolution. Saved membership may remain as a safe unavailable reference; old revisions, captions, images, investigative reasons and private cause details never bypass current visibility. Seller PRIVATE/PUBLIC notices are advisory and cannot create or roll back Scene state.

Scene Search is available from launch and indexes only the current PUBLIC published revision. Draft, private, archived, deleted, media-ineligible and moderation-restricted Scenes are excluded before ranking and denied during response/open revalidation.

Index current caption as primary text; approved tagged Product names/category/selected attributes as secondary context; Seller name/handle as low context. Resolve current Product/Variant price and availability separately rather than copying them as canonical Scene truth.

Return scene_post_id and the exact served published_revision_id for attribution. New publication refreshes future results; past impressions retain the revision actually served. A saved historical revision never grants current read access.

## 12. Eligibility before ranking

Normalize the query, retrieve bounded candidates and apply a meaningful query-relevance threshold. Then require current Seller/Market, publication, Content PUBLIC, Moderation and applicable media/tag-availability gates before any ranking or composition.

For eligible Products, partition available versus public out-of-stock. Apply family-specific relevance and approved public Trust/reliability, popularity, conversion/commerce and quality signals; then bounded diversity and typed current-state assembly. No irrelevant/unsafe candidate may be admitted by a secondary feature.

![Query meaning and current public eligibility precede rank](graphics/SRC_03.svg)
*Figure 03. Query meaning and current public eligibility precede rank. Three launch entity families share hard gates, then use family-specific ranking. Product availability partitions only relevant eligible Products; secondary features never rescue irrelevant/private content.*

Search inclusion means eligible to show now. Canonical Product detail -> Seller Cart -> Checkout -> PSP/backend verification -> paid Seller Order remains a separate authority chain; Search cannot create payment, Order, stock or Handoff truth.

## 13. Entity-specific ranking

Use query-led entity-specific ranking after current hard eligibility. The strategic feature family is relevance, public Trust/reliability, popularity, conversion and quality; launch configuration remains bounded/versioned without an unsupported fixed numeric formula.

| Entity | Ranking doctrine |
| --- | --- |
| Product Post | Strong name/category/structured/Variant match; relevant available bucket before public OOS; then public quality/Trust, conversion/popularity, freshness and bounded Seller diversity |
| Seller | Exact handle/name and query/category match, selected active browse Market and public Seller quality/reliability; no private evidence |
| Scene Post | Current caption/tagged Product relevance, content quality, approved commerce interaction/conversion, freshness, public Seller quality and bounded diversity |

Subscription tier and Buyer surcharge/commission cannot improve organic rank. No Seller selects a fixed organic position. Future Search Ads require separate sponsored ranking, labeling, budget and attribution. Search and Scene-only FYP use separate algorithms/versions/experiments; query meaning remains dominant for Search.

## 14. Query identity, language and suggestions

### Query identity

```
search_session_id
query_id
parent_query_id?
browse_market_id
locale
filters
sort
search_algorithm_version
```

parent_query_id supports reformulation analysis (for example: shoes -> black shoes -> black running shoes).

### Normalization

• trim

• Unicode normalization

• case folding where appropriate

• whitespace normalization

• preserve Amharic characters

• preserve Product-significant punctuation

### Launch languages

English is the primary/source language. Amharic-script Search is supported for the Ethiopia locale. Full transliteration is deferred until real zero-result and reformulation data justify it.

### Suggestions - worth adding in MVP

• recent searches where privacy policy permits

• safe popular queries

• categories

• Seller matches

• controlled synonym dictionary

• optional safe content phrase suggestions from curated/popular aggregates

Do not build neural autocomplete or autonomous LLM query rewriting at launch.

## 15. Zero-result recovery and typo tolerance

Zero-result Search must provide useful recovery rather than a dead end.

• broader/corrected query suggestions

• category suggestions

• Seller results

• Product Post results

• Scene Post results

• links to Shop/FYP where appropriate

• `search_zero_results` telemetry

### Typo tolerance

Use PostgreSQL trigram matching with bounded thresholds. Exact/prefix matches should dominate fuzzy matches. Very short queries use stricter logic to avoid expensive noisy scans.

## 16. Search technology and performance architecture

MVP Search remains PostgreSQL-first. Scene Post Search does not by itself justify adding a dedicated Search engine.

```
PostgreSQL
  + pg_trgm
  + indexed normalized fields
  + structured SQL filters
  + current canonical joins / bounded projections
```

```
Valkey
  = non-authoritative hot cache / rate-control support
```

```
BullMQ
  = asynchronous projection refresh / invalidation / analytics jobs
```

### Scale only after measurement

• query latency / p95-p99

• corpus size

• CPU/query plans

• trigram selectivity

• join/projection cost

• ranking quality

• zero-result rate

• cache hit/miss

• reconciliation lag

Elasticsearch, OpenSearch, Algolia, a dedicated Search microservice and a vector database remain infrastructure options, not current product roadmap requirements.

### Pagination and enumeration

• Opaque cursors for marketplace Search.

• Bounded page size.

• No unrestricted offset enumeration.

• No empty-query marketplace dump.

• Seller Lookup query minimums/caps and throttling.

## 17. Search projection, cache and invalidation

Search projections and caches are derived. Current canonical eligibility checks precede response/descriptor issuance even while asynchronous invalidation is delayed. Durable source facts/outbox plus idempotent BullMQ jobs and reconciliation repair projection drift.

| Source change | Required derived consequence |
| --- | --- |
| Product unpublish/remove | Invalidate Product document/cache and denied tag action; Content independently evaluates Scenes |
| Seller safety / Market disabled | Deny Seller and all owned public candidates immediately; invalidate projections |
| Scene PRIVATE | Remove/inactivate Scene document and public caches; no old revision fallback |
| Scene PUBLIC after all gates | Reactivate current eligible published revision idempotently |
| New Scene published revision | Refresh current caption/tags/revision; historical attribution unchanged |
| Scene archive/delete/Moderation restriction | Deny all current public resolution and invalidate derived rows |
| Inventory change | Refresh Product availability bucket; emit Content availability consequence separately; Collection membership unchanged |
| Market configuration | Re-evaluate current activated corpus/locale/capability |
| Valkey/BullMQ delay/loss | Current reads still deny restricted state; PostgreSQL reconciliation repairs work |

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

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

## 18. Private Buyer Collections - MVP

MVP Collections are private, owned by an authenticated ordinary Account exercising Buyer capability. Public/unlisted/collaborative Collections are deferred. Device/Mode changes do not change server ownership.

Target types are PRODUCT_POST and SCENE_POST. A Buyer can save a whole Scene and separately save one of its tagged Product Posts; memberships are independent and may coexist in the same Collection.

No anonymous durable Collection or Storefront guest Save exists. Derive owner_account_id from the authenticated ordinary session, never client input or Seller/Operator role. No special Creator catalogue/Collection type is introduced.

![Private mixed typed membership and independent provenance](graphics/SRC_04.svg)
*Figure 04. Private mixed typed membership and independent provenance. One ordinary Buyer Account owns Collections. Each item has one Product or whole-Scene FK; optional Scene/tag/revision provenance does not authorize historic content or create commerce.*

## 19. Collection data model and integrity

Use typed foreign keys and explicit optional provenance. PostgreSQL enforces exactly one Product or whole-Scene membership target. Optional Scene revision/tag provenance supports history, never current authority.

```
core.collection
  id / owner_account_id FK / name
  kind = DEFAULT | USER_CREATED
  created_at / updated_at / deleted_at?
core.collection_item
  id / collection_id FK
  product_post_id? FK
  scene_post_id? FK
  originating_scene_post_id? FK
  originating_scene_revision_id? FK
  product_tag_id? FK
  scene_revision_seen_at_save_id? FK
  source_surface / created_at
CHECK exactly one of product_post_id or scene_post_id
UNIQUE(collection_id, product_post_id) WHERE product_post_id IS NOT NULL
UNIQUE(collection_id, scene_post_id) WHERE scene_post_id IS NOT NULL
```

Repeated Save creates one membership; repeated Remove remains idempotently unsaved. No MVP position/rank/reorder endpoint exists. Read items by created_at DESC with stable ID tie-break; reordering is deferred. DEFAULT identity is a DB kind/constraint, never the localized display name Saved.

## 20. Save provenance, revision history and current-state rendering

Saving a Product from a Scene records product_post_id plus optional originating_scene_post_id, originating_scene_revision_id, product_tag_id and source_surface. Saving the whole Scene records scene_post_id, revision seen at save and source_surface.

Save provenance and past served revision remain audit/attribution data. Normal Collection display resolves the current canonical Product/current PUBLIC Scene revision. A historical save never grants access to an old restricted/private caption, image, hotspot or Product payload.

![Current eligibility runs before every new controlled Scene delivery](graphics/SRC_05.svg)
*Figure 05. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

| Current target state | Safe Collection resolution |
| --- | --- |
| Product available | Current card/actions; no reservation or price freeze |
| Product out of stock | Keep independent membership; current unavailable state and revisit |
| Product removed / restricted / deleted | Keep safe unavailable/tombstone reference according to owning lifecycle; no restricted details |
| Scene PUBLIC and eligible | Render current eligible published revision; historical saved revision remains attribution only |
| Scene PRIVATE / restricted / archived / deleted | Keep safe unavailable/tombstone membership; omit historical captions/images/tags/private cause |
| Scene restored PUBLIC after all gates | Current normal rendering resumes automatically; membership unchanged |
| Supported Market changed | Membership persists; resolve current Market availability safely |

## 21. Collection UX - MVP must-have and worth-adding

### Default Saved Collection

Each Buyer has one server-recognized default Collection using `kind=DEFAULT` or equivalent. Never identify it by the localized display name “Saved”.

### One-tap Save

```
Tap Save -> Saved
Secondary action -> Add to Collection / Choose Collection / Move
```

### Collection picker

• Default Saved

• named Collections

• create new Collection

### Recent Saves

• Collections

• Recent Saves

• Saved Product Posts

• Saved Scene Posts

### No purchase semantics

• No quantity

• No stock hold

• No checkout state

• No payment state

• No price freeze

• No automatic Cart creation

## 22. Saved-state batching and APIs

Search/FYP/Storefront cards must not issue one save-state request per card. Use typed batch membership resolution.

```
POST /v1/collections/saved-state:batch
[
```

```
  {"type":"PRODUCT_POST","ref":"..."},
  {"type":"SCENE_POST","ref":"..."}
]
```

### Collection CRUD

```
POST   /v1/collections
GET    /v1/collections
GET    /v1/collections/{collectionRef}
PATCH  /v1/collections/{collectionRef}
DELETE /v1/collections/{collectionRef}
POST   /v1/collections/{collectionRef}/items
DELETE /v1/collections/{collectionRef}/items/{itemRef}
POST   /v1/collections/saved-state:batch
```

### Marketplace Search

```
GET /v1/search?q=black+dress&country=ET&cursor=...&limit=24
```

```
Top result item:
{
  "type": "PRODUCT_POST | SCENE_POST | SELLER",
  "payload": {...},
  "attribution": {...}
}
```

### Storefront Search

```
GET /v1/storefronts/{handle}/search?q=...&type=PRODUCT_POST|SCENE_POST
```

The Storefront local endpoint remains seller-scoped. Global navigation calls the marketplace endpoint instead of broadening the local endpoint.

## 23. Search telemetry and attribution

Search Analytics uses journey identifiers rather than scattering raw query text through general logs.

```
search_performed
search_zero_results
search_result_impression
search_result_opened
search_result_saved
search_product_added_to_cart
search_product_tag_opened
search_checkout_started
search_paid_order_attributed
```

### Required attribution fields

• search_session_id

• query_id

• result_type

• target public analytics reference

• position

• algorithm_version

• source_surface

• browse_market_id / country

• for Scene Posts: scene_post_id + published_revision_id

• when opening a tag: product_tag_id + product_post_id

### Raw-query privacy

General Analytics should prefer query ID, token count, filters, result count, type and click position. If raw query retention is needed for relevance debugging, use a separately governed, access-controlled, short-retention dataset integrated with deletion/privacy lifecycle.

## 24. Collection analytics and Recommendation integration

### Canonical Collection facts

```
collection_item_added
collection_item_removed
collection_opened
collection_item_opened
```

```
target_type = PRODUCT_POST | SCENE_POST
```

### Recommendation evidence

Search and Collections can provide Recommendation signals, but neither owns FYP ranking. Save is stronger than an impression/open but remains weaker evidence than completed commerce. Do not hard-code a universal numeric hierarchy in this system.

```
impression < open < save < product interaction < cart < checkout < paid/completed commerce
```

The inequality is conceptual strength only. Recommendation owns actual versioned weighting.

Scene/Product Save is a typed canonical fact; it is not an explicit restock subscription or a fixed save=X-points rule. Recommendation alone owns actual versioned signal weights and current PUBLIC Scene FYP candidate gates.

## 25. Privacy, deletion, moderation and lifecycle

### Buyer deletion

• Collection roots and items

• Collection names and metadata

• Search personalization state

• query-history product data where retained

• Recommendation affinities derived from Buyer behavior

• private saved provenance according to policy

### Content lifecycle

• Current public Scene revision only in Search.

• Moderation restrictions immediately affect eligibility.

• Collection membership may persist as a tombstone/unavailable reference without revealing restricted historical content.

• Seller suspension/closure removes public Search eligibility.

### Market changes

A saved item may remain in the Collection when the Buyer changes country, while current rendering says “Unavailable in your current market.” Membership represents durable intent, not a promise of global availability.

Scene PRIVATE/PUBLIC never deletes Collection membership automatically. Current public resolution must omit all historical private payload even during cache lag; authorized Seller management and restricted case investigation use their independent current permissions. Buyer deletion, legal holds and minimal tombstone policy remain Privacy/owning-domain decisions.

## 26. Security and abuse controls

| Threat | Control |
| --- | --- |
| Collection IDOR | Authenticated owner derivation + scoped query + 404/not-visible semantics |
| SQL injection / filter abuse | Parameterized SQL, typed filter parser, sort whitelist, bounded filters |
| Search enumeration | Query minimums, cursor pagination, rate limits, no empty-query dump |
| Private-data indexing | Closed Search projection allowlist; no phone/payment/Claims/Chat/Buyer data |
| Stale restricted result | Eligibility recheck, event invalidation, short bounded caches, reconciliation |
| Forged target save | Resolve public target server-side; typed FK integrity |
| Paid organic boost | Forbidden in organic ranking |

| Threat | Control |
| --- | --- |
| Anonymous save abuse | No guest persistent Collection; authentication required |

## 27. Ordinary Account, devices and Storefront navigation

Search read surfaces may be anonymous. Collection writes require the Buyer Account. Multiple devices may access the same Buyer Account and therefore the same server-owned Collections. Device-local UI state is not Collection authority.

### Public Storefront navigation contract

1. Open seller/profile or exact Product/Scene URL from TikTok/Instagram.

2. Render public Storefront projection without requiring installation or sign-in.

3. Allow local Seller catalogue browsing and local Search across Product Posts + Scene Posts.

4. Expose global public navigation to Marketplace Search/Shop/other Sellers.

5. Require authenticated Buyer Account only when the visitor attempts persistent save, Cart/Checkout, private Orders or other account-owned actions.

6. After authentication, return the Buyer to the intended Product/Post/Collection action without losing attribution context.

One ordinary human uses one stable ordinary Adulis Account across Buyer capability, Seller ownership, Seller-team participation and a persistent Courier profile. Different humans use different Accounts and never share credentials. Ownership, team membership and Courier relationships are independent; a team Account may have multiple active roles whose current permissions compose within the exact Seller scope.

At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the ordinary Account's team slot. Seller ownership and many private Seller-Courier Pool relationships do not consume that slot. Switching Buyer/Seller/Courier Mode changes presentation and current context, never identity or authority.

Operator Account is a separately provisioned privileged internal principal. A person may also hold an ordinary Account, but credentials, sessions, strong authentication, recovery, revocation and audit identity remain independent. Ordinary Account OTP, Seller roles, public registration and Mode switching never create Operator authority.

Privileged workflows require an isolated OPERATOR session, current explicit capability, exact resource/Market/case scope, strong authentication and freshness, plus approval when the existing Founder/Staff governance requires it. Restricted evidence needs its own current capability and case/purpose authorization; ADMIN supplies no universal bypass. Record operator_account_id, capability, policy, case/version, reason, request/time and applicable approval context. No impersonation or direct generic domain-state setter is introduced.

Search read may be anonymous; durable Collections use the same ordinary Account Buyer capability across devices. Seller or Operator roles never grant another Buyer Collection access. Precise GPS is not required for browse Market defaults.

## 28. Current technology stack and placement

| Layer | Technology / placement |
| --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements |
| Async / cache | Valkey + BullMQ; non-authoritative |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client |
| Security | @nestjs/throttler; @fastify/helmet; reviewed parameterized query/filter layer |
| Public media | Cloudflare R2 + Cloudflare CDN + Sharp |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; SecureStore; Notifications; Updates; bounded Zustand |
| Public Storefront | Browser public surface inside adulis-platform; Cloudflare fronting/cache; no Storefront database authority |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 |
| Observability | Sentry; Pino structured logs; pg_stat_statements |
| Architecture control | dependency-cruiser |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS |
| Commerce integration | PSP adapter; Chapa where Market-configured; provider/server verified payment |

No dedicated Search service, vector database or external Search provider is required for MVP.

## 29. Failure behavior and reliability

| Failure | Required behavior |
| --- | --- |
| Valkey unavailable | Fallback to PostgreSQL-backed reads where safe; disable/slow caches; never invent eligibility. |
| BullMQ delayed | Search invalidation/projection lag is reconciled; canonical response-time gates deny private/restricted state immediately while asynchronous invalidation catches up. |
| Analytics unavailable | Search and Save continue; analytics events may be retried/dropped per analytics policy without breaking user action. |
| Recommendation unavailable | Search remains independently usable. |

| Failure | Required behavior |
| --- | --- |
| Inventory unavailable | Do not claim availability; degrade safely or fail bounded Product result assembly according to canonical cache freshness policy. |
| Trust projection unavailable | Do not fabricate Trust; relevance remains query-led and safe fallback applies. |
| Product changes after Search | Open Product detail re-resolves current state. |
| Save response lost | Idempotency/unique membership makes retry safe. |
| Collection deleted concurrently | Return current canonical state; no orphan item writes. |
| Storefront social link stale | Stable public slug redirect/tombstone behavior per Storefront/Content lifecycle; do not expose private IDs. |

## 30. Capability classification - MVP, future and non-goals

### MVP - must have

• Marketplace Product Post Search

• Seller Search / Seller Lookup

• Public Scene Post Search

• typed result model

• search session/query identity

• normalization

• English + Amharic-script Search

• structured filters

• deterministic entity-specific ranking

• eligibility before ranking

• country/Market scoping

• opaque pagination

• Search attribution/telemetry/privacy

• private Collections

• Product Post save

• whole Scene Post save

• mixed membership

• revision/provenance

• Collection CRUD

• idempotent save/remove

• unique membership

• current-state and current-Market resolution

• batch saved-state

• Collection security/analytics

• Recommendation signal integration

• privacy/deletion/moderation integration

• rate limiting/abuse protection

### MVP - worth adding

• Default Saved Collection

• one-tap Save

• Collection picker

• Recent Saves

• simple Search suggestions

• safe popular-query suggestions

• category suggestions

• Seller suggestions

• controlled synonyms

• zero-result recovery UI

• Search tabs

• blended Top surface

• Seller diversification

• reformulation tracking

### Current additional MVP rules from this revision

• Seller Storefront local Search includes both Product Posts and Scene Posts.

• Storefront social entry supports profile and exact Product links, then full public navigation.

• Seller Lookup defaults country to current Buyer context with manual country switching.

• Out-of-stock Product Posts stay searchable but rank after available products.

• Collections have no user reordering.

• Anonymous users cannot save.

Current launch is Ethiopia-first through server-supported activated browse Markets. Scene current PUBLIC eligibility, safe saved-state resolution, typed ordinary/Operator authority and response-time canonical checks are required. Global-ready infrastructure does not expose every country as live.

## 31. Future / deferred research catalogue

| Area | Deferred capability / research item |
| --- | --- |
| Collections | Public Collections; unlisted Collections; shareable Collection URLs; collaborative Collections; followers/likes/comments; Collection media; Collection recommendations; AI naming; Variant preference; user reordering. |
| Product interest | Price-drop tracking; restock notification subscription. |
| Search language | Full transliteration; voice Search. |
| Search intelligence | Vector Product Search; semantic Product Search; semantic Scene Post Search; semantic image Search; LLM query rewriting; personalized Search ML; learning-to-rank. |
| Location | Advanced Nearby / radius / service-area Search with Market-specific privacy policy. |
| Monetization | Explicit sponsored Search / Search Ads with labeling, budget, attribution and separate ranking. |
| Infrastructure options | Elasticsearch; OpenSearch; Algolia; dedicated Search microservice; dedicated vector database - only after measured need. |

### Not needed to certify MVP

None of the deferred capabilities above should block MVP certification. Public Scene Post Search is explicitly not deferred.

Standalone Creator catalogue/affiliate cross-Seller tagging, consent/revocation architecture and Creator Search type are outside the current approved scope. Native video publishing is not introduced by Search. Advanced semantic/vector/image retrieval, transliteration/LLM rewrite and dedicated Search services require measured need and separately approved design.

## 32. Architectural anti-patterns - do not build

• Paid organic Search boosts disguised as relevance.

• Search as price, stock, payment or Order authority.

• Empty-query marketplace catalogue dump.

• Public Search over private Chat, Buyer, Claim, payment or internal Trust evidence.

• Collection Save causing stock/checkout/payment/Order effects.

• Recommendation auto-inserting items into a Buyer Collection.

• Client-supplied Collection owner authority.

• Raw query text duplicated across logs/analytics/unrelated systems.

• Historical Scene revisions exposed as independent live Search results.

• Unchecked generic Collection target IDs without referential integrity.

• Guest anonymous Collections presented as durable server state.

• Local Storefront Search silently broadening to other Sellers instead of invoking global Marketplace Search.

## 33. Required cross-system write-backs

| System | Required update |
| --- | --- |
| Mobile | Search tabs/types become Product Posts + Scene Posts + Sellers; whole-post save mandatory; country selector; OOS result treatment; no guest saves. |
| Seller Storefront | Local Search returns Product + Scene; social entry behavior; global navigation from public web surface; Save requires account; preserve seller-local/global Search boundary. |
| Content / Scene | Public Scene Post Search is launch capability; current public revision + eligibility contract. |
| Analytics | Search result types include SCENE POST; Collection types include Product + Scene; Search-to-post-to-product attribution. |
| Market Configuration | Country/browse-Market Search capability and locale config; country selection semantics. |
| Catalogue / Inventory | Expose current Product/Variant/availability read contract; OOS remains searchable; no Search authority over stock. |
| Recommendation | Consume bounded Search/save evidence; Search rank remains independent. |
| Notifications | Future restock notification remains deferred and must not infer subscription from ordinary save. |
| Privacy | Collection/query datasets and deletion lifecycle; raw-query governance. |
| API / DB | Typed Search results, mixed Collection FKs, saved-state batch, Search projection/invalidation contracts. |

| Current contract | Required coordinated update |
| --- | --- |
| Auth / Operator | One ordinary multi-relationship identity; separate privileged sessions/principal FKs; Collection owner remains ordinary Buyer |
| Scene lifecycle | Content-owned PUBLISHED/PRIVATE, all-gate automatic PUBLIC restoration and current revision delivery on every public surface |
| Active rollout | Ethiopia-first server allowlist; future approved Market activation without country-specific code branches |
| Projection repair | Scene PRIVATE remove / PUBLIC restore / revision refresh; current hard read gate denies async stale state |

## 34. Testing strategy and launch gates

### Search launch gates

• Marketplace Search returns Product Posts, Sellers and Scene Posts.

• Storefront Search stays seller-scoped but supports both post types.

• Global navigation from Storefront opens marketplace discovery without contaminating local results.

• Country default and manual country switching are deterministic and auditable.

• English and Amharic Search pass representative relevance tests.

• Out-of-stock exact/relevant Product remains findable but ranks below available Products.

• No ineligible/suspended/moderated entity appears from stale cache.

• Opaque cursors, query bounds, throttling and SQL parameterization pass.

• No private-data index leakage.

### Collection launch gates

• Authenticated Buyer can save Product Post and whole Scene Post.

• Anonymous Storefront visitor cannot create durable save.

• Mixed Collection renders safely.

• Repeated save/remove is idempotent.

• No user reorder endpoint/position mutation exists in MVP.

• Current Market and current public state re-resolve on read.

• Restricted historical content cannot leak.

• Cross-account private Collection access is blocked.

• Save never mutates Inventory/Cart/Checkout/Payment/Order.

• Batch saved-state prevents card-level N+1.

### Critical regression cases

• Seller changes Scene revision after Search impression: old event preserves served revision; new Search uses new revision.

• Seller is suspended after result cached: result becomes ineligible and cannot be reopened as active commerce.

• Buyer switches browse country: Seller/Product/Post corpus changes; Collection membership does not disappear.

• Product goes out of stock after Search: Product detail shows current status; Search may later rank lower.

• Product restocks: current Search availability bucket updates; no restock push unless future explicit subscription exists.

• Anonymous visitor signs in after tapping Save: return to intended target and save exactly once.

Add the supplied current regression scenarios below to existing relevance, Market, privacy, lifecycle, idempotency and N+1 cases. Use Jest/Testcontainers for typed schema/queries/races; Maestro/Playwright for anonymous entry, auth return, Scene unavailable/restored and cross-account views; k6 for bounded query/fanout/cursor workloads.

• Current regression 01: Marketplace Search returns Product + Seller + Scene.

• Current regression 02: Superseded legacy content enum is rejected or migrated appropriately; SCENE_POST is the current accepted type.

• Current regression 03: Storefront local Search returns Product + Scene from that Seller only.

• Current regression 04: Scene with zero Product tags cannot become Search candidate because Content cannot publish it publicly.

• Current regression 05: Scene with one available Product -> PUBLIC -> searchable.

• Current regression 06: Scene's final available Product becomes unavailable -> Scene PRIVATE -> removed from Search.

• Current regression 07: Product itself becomes OOS but remains public -> still findable below available Product results.

• Current regression 08: Scene restock -> Content PUBLIC -> Search reindexes.

• Current regression 09: Moderation-removed Scene cannot reappear from stale Valkey/search projection.

• Current regression 10: Exact Product/Seller match remains relevant even when another result has stronger Trust.

• Current regression 11: Organic ranking cannot be purchased.

• Current regression 12: Explicit Market switch only permits server-supported browse Markets.

• Current regression 13: Inactive unsupported country cannot become active marketplace by query parameter.

• Current regression 14: Collection saves Product + Scene independently.

• Current regression 15: Saved Scene PRIVATE -> membership remains but content unavailable.

• Current regression 16: PRIVATE saved Scene cannot expose historical public revision.

• Current regression 17: Scene PUBLIC again -> Collection current state returns.

• Current regression 18: Anonymous browsing works.

• Current regression 19: Anonymous persistent save rejected.

• Current regression 20: One ordinary Account with Buyer relationship can access same Collections across devices.

• Current regression 21: Save never changes stock/Cart/Checkout.

• Current regression 22: Valkey outage degrades speed, not canonical correctness.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 35. Recommended implementation sequence

| Phase | Deliverable |
| --- | --- |
| 0 - Canonical alignment | Product/Scene terminology; three Search types; supported activated browse-Market context; Collection types; Checkout terminology; privacy contracts. |
| 1 - Search foundation | pg_trgm, normalization, English/Amharic, Product/Seller/Scene retrieval, eligibility, country filtering, cursor contract. |
| 2 - Marketplace Search API | Typed results, tabs, blended Top, filters, availability buckets, Seller diversity, zero-result handling. |
| 3 - Storefront/Search bridge | Seller-local Product/Scene Search, social-entry routing, full public navigation, global Search handoff. |
| 4 - Search quality | Typo tolerance, controlled synonyms, structured attributes, linked-Product enrichment, ranking/config versioning. |
| 5 - Collections model | Collection, mixed items, uniqueness, provenance, default Saved, no reordering. |
| 6 - Collection APIs/UI | CRUD, one-tap Save, picker, Recent Saves, batch saved-state, auth return flow. |
| 7 - Analytics/Recommendation | Search sessions, result types, post revision attribution, typed Collection facts, bounded signals. |
| 8 - Privacy/security/hardening | IDOR, rate limits, country isolation, invalidation, lifecycle deletion, load tests, reconciliation. |

## 36. Final system architecture

Public entry lands on an exact Seller Storefront or Marketplace Search. Local Search remains one Seller; explicit global navigation selects a supported activated browse Market. Bounded query retrieval plus current hard gates produces typed Product/Seller/Scene results. Open resolves current canonical state; authenticated Save creates private durable intent, independently from commerce.

![Public Search and private saved intent share current domain reads](graphics/SRC_06.svg)
*Figure 06. Public Search and private saved intent share current domain reads. Exact social entry preserves Seller-local Search; explicit global navigation resolves active Market Search. Typed results open canonical resources or create authenticated private membership.*

![Query meaning and current public eligibility precede rank](graphics/SRC_07.svg)
*Figure 07. Query meaning and current public eligibility precede rank. Three launch entity families share hard gates, then use family-specific ranking. Product availability partitions only relevant eligible Products; secondary features never rescue irrelevant/private content.*

![Private mixed typed membership and independent provenance](graphics/SRC_08.svg)
*Figure 08. Private mixed typed membership and independent provenance. One ordinary Buyer Account owns Collections. Each item has one Product or whole-Scene FK; optional Scene/tag/revision provenance does not authorize historic content or create commerce.*

PostgreSQL/Drizzle owns Collection and current domain state; pg_trgm supports Search. Valkey/BullMQ are derived cache/projection execution, R2/CDN/Sharp delivers eligible images, and Pino/Sentry/pg_stat_statements observe safe operations.

## 37. Core invariants

• SRC-INV-001 Search result types are PRODUCT_POST, SELLER, SCENE_POST.

• SRC-INV-002 Scene Post is the single canonical content entity; no superseded dual type exists.

• SRC-INV-003 Hard eligibility occurs before ranking.

• SRC-INV-004 Out-of-stock Product may remain searchable.

• SRC-INV-005 Available Product bucket precedes OOS Product bucket.

• SRC-INV-006 Scene with zero eligible available Products is PRIVATE and not searchable.

• SRC-INV-007 Storefront Search remains one-Seller scoped.

• SRC-INV-008 Browse Market is server-controlled and only supported Markets are exposed.

• SRC-INV-009 Search never authorizes checkout/payment/order truth.

• SRC-INV-010 Collections are private in MVP.

• SRC-INV-011 Collections accept Product Posts + whole Scene Posts.

• SRC-INV-012 Anonymous users cannot create durable Collection membership.

• SRC-INV-013 Save never reserves stock/freezes price/creates commerce.

• SRC-INV-014 No user reorder in MVP.

• SRC-INV-015 Current canonical target state re-resolves on Collection read.

• SRC-INV-016 Search and FYP ranking remain independent.

• SRC-INV-017 Valkey/BullMQ are non-authoritative.

• SRC-INV-018 Only current PUBLIC Scene revision participates in Search.

• SRC-INV-019 Raw query text is privacy-governed.

• SRC-INV-020 Organic ranking cannot be purchased.

• SRC-INV-021 Restock alert is not inferred from Save.

• SRC-INV-022 Scene PRIVATE transition invalidates Search.

• SRC-INV-023 Saved Scene PRIVATE state cannot leak historical restricted content.

• SRC-INV-024 Creator is not a current Search entity type.

• SRC-INV-025 Search is globally extensible but commerce availability follows active Market rollout.

• Collection target FKs enforce exactly one Product/Scene and independent unique membership; DEFAULT kind is stable and card saved-state uses a typed batch contract.

## 38. Final engineering doctrine

Search makes query-relevant public Product Posts, Sellers and Scene Posts findable within a supported activated browse Market. Hard current eligibility precedes ranking; the available Product bucket precedes relevant public out-of-stock Products, while zero-available Scenes are PRIVATE and excluded.

Collections preserve private ordinary-Account Buyer intent across devices and Market changes. Typed Product/whole-Scene membership is independent, provenance records what was seen, and current canonical state decides what may render today. Save does not create stock, Cart, Checkout, payment, Order or restock-subscription authority.

Seller Storefront is an anonymous public acquisition bridge: exact social destinations and local one-Seller Search remain clear, and deliberate broader navigation opens marketplace discovery. Launch remains PostgreSQL + pg_trgm with Drizzle, recoverable Valkey/BullMQ support and current image delivery; advanced infrastructure follows measured evidence.

## 39. Glossary

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
| Browse Market | Server-approved activated discovery scope; distinct from Checkout authority. |
| pg_trgm | PostgreSQL launch typo/lexical matching with bounded relevance thresholds. |
| Query relevance | Meaningful candidate qualification before secondary ranking signals. |
| Availability bucket | Relevant eligible available Products before public out-of-stock Products. |
| Collection | Private durable ordinary-Account Buyer intent, not Cart. |
| Collection item | Exactly one typed Product or whole-Scene FK with independent unique membership. |
| Saved provenance | Scene/revision/tag history; no current read, stock or price authority. |
| DEFAULT Collection | Stable server DB kind, never inferred from localized Saved label. |
| Saved-state batch | Typed membership query for cards, avoiding per-card N+1 requests. |
| Organic ranking | Query-led relevance/public quality; no paid tier/surcharge position boost. |
| Restock subscription | Deferred explicit opt-in object; ordinary Save never creates one. |

## 40. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-01 — Buyer-facing Product / Scene terminology | The 13 October designs use Product Post and Scene Post as canonical domain names. | Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly. | PR-001 / PR-005, 26-27 Oct 2026 |
| R-02 — Scene publication and all-unavailable lifecycle | The 13 October pack already requires a legitimate same-Seller Product relationship and at least one currently available tagged Product at public publication. | Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product. Zero-tag or all-unavailable initial publication is rejected. A published Scene stays public while at least one tagged Product remains available. If the last available tagged Product becomes unavailable, the Scene remains PUBLISHED but effective Buyer visibility becomes PRIVATE across FYP, Following, Nearby, Search, Buyer Seller profile, public Storefront and Buyer-facing Collection/direct resolution. Seller/Operator views retain it with Private state. Restoration of at least one eligible Product automatically re-evaluates and may restore PUBLIC without republishing. | Founder rule + PR-004 reconciliation |
| R-03 — Buyer Home and social-commerce FYP presentation | The 13 October pack already defines For You / Following / Nearby / Discounts / Locally Made and a Scene-only FYP. | For You is the default Buyer Home channel and contains Scenes only; Products never become top-level FYP units. Home presents the five channels in a compact discovery row with Search and Notifications, with Seller Stories below. Scene cards are structured social-commerce cards, not full-screen video. Following is Seller-follow based; Nearby remains commerce-relevant without continuous/live GPS; Discounts and Locally Made are Product-led channels under their own eligibility rules. | PR-003, 26 Oct 2026 |
| R-06 — Explore the Scene and hotspot placement | The 13 October designs support tagged Products/hotspots but do not fully freeze where hotspot UI appears. | Normal For You and Following Scene media carries no Product hotspots. Tapping Scene media or Explore the Scene opens the dedicated Explore surface. Explore owns numbered hotspots and the tagged-Product list; hotspot/list selection remains synchronized. Unavailable tagged Products remain visible with current price plus “Currently unavailable” and no purchase action. View Product only navigates to Product detail; it never orders automatically. | PR-004 follow-up, 27 Oct 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
