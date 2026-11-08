# Adulis Seller Storefront
Version 4.2 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v4.1 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Complete amended baseline: 12 October 2026. The supplied correction prompt and owner decisions supersede the conflicting reviewed source wording. Every original numbered body section and unaffected table/graphic is retained; targeted contracts, examples, tests, invariants and dependent definitions are reconciled. The historical audit remains unchanged.

| Document control | Amendment baseline |
| --- | --- |
| Version history | 4.0 reviewed 8 October 2026 -> 4.1 amended 12 October 2026 -> 4.2 post-October-13 reconciled 8 November 2026. |
| Source | ADU-STOREFRONT-02_Adulis_Seller_Storefront_System_Design_v4.1.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. System definition

The Seller Storefront is the public, buyer-facing web representation of an Adulis seller. It is a mobile-first, shareable commerce surface that can be opened from TikTok, Instagram, search engines, direct messages, QR/link sharing, and the Adulis app.

### It answers

- Who is this seller?

- What Product Posts are currently sellable?

- What Scene Posts has the seller published?

- What is currently available?

- What Trust/Review evidence has Adulis recorded?

- Does the seller have a public physical-store location?

- How can the buyer continue into Adulis checkout?

The Storefront is PUBLIC + ANONYMOUS + INDEXABLE + SHAREABLE + COMMERCE-ORIENTED.

It is not Seller administration, buyer account management, checkout execution, payment processing, Order management or Operator tooling. The transaction remains owned by the Adulis platform/mobile app.

## 2. Strategic role

The Storefront is now an acquisition bridge for both seller profiles and individual seller content.

### External profile path

TikTok / Instagram bio -> Seller Storefront -> Product Post or Scene Post -> Open Adulis -> Checkout.

### External content path

Seller publishes Product Post or Scene Post -> copies canonical Adulis URL -> places the URL in an Instagram/TikTok caption or comment -> buyer opens the URL -> Storefront renders that exact Product Post or Scene Post -> buyer can continue to the Product Post and Adulis checkout.

### Adulis discovery path

Adulis FYP -> Scene Post -> Product Post -> Seller -> Storefront.

### Search path

Search engine -> Seller / Product Post / Scene Post -> Browse -> Open Adulis.

Do not make the Storefront depend on whether a third-party social application renders a caption/comment URL as clickable. The canonical URL remains copyable, shareable and directly resolvable.

## 3. Primary architectural doctrine

The Storefront is a projection of canonical platform state. It does not own Seller, Product, Variant, Inventory, Trust, Reviews, Scene Post, Fulfilment, Payment or Order truth.

Canonical domains -> public read APIs/projections -> Storefront renderer -> browser.

PostgreSQL remains transactional truth. Valkey, CDN caches, analytics and browser state are non-authoritative. The Storefront never becomes a second source of commerce truth.

Content owns orthogonal publication_state and visibility. Public Storefront reads require PUBLISHED/PUBLIC plus at least one currently available eligible tagged Product and all other public gates. Storefront never publishes, privatizes, restores or archives Scenes.

## 4. Storefront versus Company Website

The Company Website and Seller Storefront remain separate products and deployment surfaces.

COMPANY WEBSITE: corporate Adulis, global marketing, Help, Legal, seller acquisition, international/Ethiopia informational pages, public forms and account-deletion UI.

SELLER STOREFRONT: one seller's public profile, Product Posts, Scene Posts, Reviews, Trust, fulfilment/location information and commerce entry points.

The Company Website now lives in the separate adulis-web repository. The Seller Storefront remains inside adulis-platform. They may share visual design language by published tokens, but they do not share runtime, database access or deployment authority.

## 5. Storefront versus Seller Console

They are opposite trust surfaces.

```
SELLER STOREFRONT
```

```
Anonymous
Public
Read-heavy
User-generated content
Cacheable
SEO-oriented
```

### versus

```
SELLER CONSOLE
```

```
Authenticated
Private
Write-heavy
```

```
Financial/admin functions
No shared cache
Operational
```

The existing browser-security architecture already requires the Seller Console to be isolated from any origin rendering seller-written content.

## 6. Recommended origin architecture

### Recommended production origins

adulis.<tld> Company Website (separate adulis-web repository) shop.adulis.<tld> Seller Storefronts seller.adulis.<tld> Seller Console ops.adulis.<tld> Operator Console api.adulis.<tld> Adulis Public API media.adulis.<tld> Public media/CDN

Storefront remains a dedicated public-content origin because it renders seller-authored descriptions, Scene Posts, Reviews and Product Post content. It must not share authenticated Seller Console or Operator cookies.

## 7. Why separate Storefront origin

A future Storefront XSS should not gain same-origin access to:

- seller sessions;

- Operator Console;

- Company Website PII forms;

- account deletion capabilities.

Origin isolation is stronger than relying on CSP alone.

CSP remains defense in depth.

Output encoding remains the first defense.

The existing security specification makes precisely this distinction between output encoding, origin separation, session storage and CSP.

## 8. Public URL architecture

### Canonical shareable URLs

### Seller profile

```
https://shop.adulis.<tld>/s/:handle
```

### Product Post

```
https://shop.adulis.<tld>/s/:handle/p/:productSlug
```

### Scene Post

```
https://shop.adulis.<tld>/s/:handle/post/:postSlug
```

### Reviews

```
https://shop.adulis.<tld>/s/:handle/reviews
```

### Seller catalogue

```
https://shop.adulis.<tld>/s/:handle/products
```

### Seller Scene Posts

```
https://shop.adulis.<tld>/s/:handle/posts
```

These URLs are suitable for social bio links, captions/comments, direct messages and ordinary public sharing. Internal UUIDs never appear in anonymous URLs.

Keep /s/:handle/post/:postSlug and /s/:handle/posts stable for existing social links/SEO. Internally they resolve Scene Posts. A later route-name migration must preserve explicit redirects, canonical URLs and app-link associations; terminology changes alone do not require breaking public URLs.

## 9. Never expose internal identifiers

### Public URLs must not contain

```
seller UUID
product UUID
post UUID
account UUID
```

### Use

```
seller handle
product slug
post public slug
```

The existing API architecture explicitly forbids internal UUIDs in anonymous URLs because UUIDv7 values are time-ordered and facilitate enumeration.

## 10. Public identifier model

### Canonical internal identity remains immutable

```
seller.id
product.id
post.id
```

### Public identity

```
seller.handle
product.slug
post.public_slug
```

Changing a public identifier must not change internal identity.

## 11. Seller handle

### Requirements

```
normalized
case-insensitive unique
reserved-word protected
length constrained
character constrained
```

### Buy in Adulisd examples

```
admin
api
seller
ops
support
help
login
```

```
privacy
terms
www
media
```

## 12. Handle changes

### If Seller A changes

```
@addisfashion
```

### to

```
@addisstyle
```

### the old URL should generally return

```
301 -> new canonical storefront
```

for an appropriate retention period or permanently where safe.

### Maintain

```
seller_handle_history
```

or equivalent canonical redirect record.

Do not silently reassign recently used handles to another seller.

## 13. Product Post slug

Each public Product Post uses a seller-scoped slug. Product Post represents exactly one canonical sellable Product; variants remain beneath that Product where applicable.

### Recommended uniqueness

```
UNIQUE(seller_id, slug)
```

The slug is public identity only. Product/Variant/Inventory remain canonical backend records.

## 14. Product Post slug change

Preserve redirect history.

```
old product URL
v 301
new canonical product URL
```

### This protects

- SEO;

- shared links;

- old messages;

- user bookmarks.

## 15. Scene Post public identity

Each Scene Post receives a stable public-safe identity and slug independent from internal IDs.

### Recommended public route

/s/:handle/post/:postSlug

A Scene Post is seller-owned merchandising/discovery content. It must reference at least one valid Product Post, and all tagged Product Posts are same-Seller in the current release. Published revisions remain evidence/analytics anchors where the Content domain versions them.

Initial public publication requires at least one eligible same-Seller Product tag, at least one currently available/in-stock tagged Product and Seller/Market/Media/Moderation eligibility. The public projection consumes backend Content decisions, not Storefront validation as authority.

## 16. Authentication boundary

Ordinary Storefront browsing is anonymous. Authentication is introduced only when the visitor chooses an action that requires an Adulis Account, such as opening the app to add to cart, checkout, chat, save or submit an eligible Review.

The Storefront must never receive Seller Console credentials, Operator credentials, database credentials or privileged deletion/account lifecycle authority.

## 17. Web browses; app transacts

The public web Storefront browses; the Adulis app transacts.

### Storefront may

- render Seller, Product Post, Scene Post, Trust and Review information;

- show current public availability;

- allow transient variant inspection;

- provide share/open-app actions.

### Storefront does not

- create seller carts or Orders;

- create payment attempts;

- execute Chapa/provider checkout;

- mutate Inventory;

- perform Handoff Verification;

- create Claims;

- create Reviews.

Transaction intent is handed to Mobile through public-safe deep-link context.

## 18. Purchase CTA

### A Product Post may visibly contain a CTA such as

Buy in Adulis or Continue in Adulis

The CTA does not perform checkout on public web. It opens the installed Adulis app, or presents the install/open handoff when the app is absent.

The target app revalidates Product, Variant, price, Inventory, Seller eligibility, market eligibility and payment-provider availability before Cart/Checkout proceeds.

## 19. Do not install-wall the storefront

### A buyer arriving from Instagram should not immediately see

Download the app.

### They should first be able to understand

- the seller;

- product;

- price;

- variants;

- availability;

- Trust;

- reviews.

Only when the buyer expresses transaction intent does Adulis introduce the native-app requirement.

The existing API architecture explicitly requires the install prompt to appear at Buy in Adulis rather than on arrival.

## 20. App-installed behavior

### Universal Links / Android App Links should cover

```
/s/:handle
/s/:handle/p/:slug
```

```
/s/:handle/post/:postSlug
```

### If the app is installed

```
URL
v
Native app
v
Exact entity
```

### If not installed

```
URL
v
Web Storefront
```

The older PRD already requires this one-URL/two-behavior model for seller and product URLs.

App resolution rechecks current Scene PUBLIC visibility/eligibility before showing media/caption/tags. A private stable link yields the approved safe unavailable response on web and native app; restoration can make it eligible again without changing identity.

## 21. Association files

### Storefront origin must host

```
/.well-known/apple-app-site-association
/.well-known/assetlinks.json
```

### with

- correct content type;

- no redirect;

- production signing identity.

## 22. Social bio-link rule

Seller profile links are a first-class acquisition path.

TikTok bio / Instagram bio -> canonical Seller Storefront URL.

A seller may publish the same Storefront profile link on one or both social platforms. Adulis must preserve stable handles and redirects so long-lived profile links do not break after a permitted handle change.

## 23. Product Post and Scene Post links

Product Post and Scene Post URLs are first-class share links.

After publishing either format, Seller Console should expose Copy link / Share link. Sellers may place the URL in TikTok or Instagram captions/comments, direct messages, campaign pages or other supported channels.

Opening a Product Post link resolves directly to that Product Post. Opening a Scene Post link resolves directly to that Scene Post with its tagged products.

The Storefront must preserve canonical URL integrity and must not require the visitor to navigate through the seller home page first.

A previously shared Scene link cannot bypass PRIVATE/restricted status. Current visibility governs the exact entity response, metadata and app handoff.

![One stable public URL / current eligibility](graphics/STOREFRONT_01.svg)
*Figure 01. One stable public URL / current eligibility. Installed app and anonymous web resolve the same public-safe Scene identity; both deny private content.*

## 24. Primary storefront page

Route: /s/:handle

### Recommended mobile structure

Seller identity -> Trust snapshot -> current availability -> optional physical-store map/location -> Product Posts -> Scene Posts -> Reviews summary -> Fulfilment information -> About seller.

No seller-controlled manual ordering hierarchy is applied in the current release. The Storefront uses a simple deterministic public ordering policy defined by the backend/configuration until merchandising hierarchy is introduced in a later update.

The public list contains only eligible PUBLIC Scenes. Do not render a Seller-only Private badge/reason on Storefront; private Scenes are absent entirely.

## 25. Storefront header

The Storefront header should show public seller identity without becoming a social profile clone.

### Recommended

- display name / logo;

- Trust level or Trust summary;

- verified/social-business indicators where public policy permits;

- category/short bio;

- public physical-store location CTA when configured;

- Open Adulis / Share.

Do not expose internal account/member details.

## 26. Seller availability

### The API should return an already resolved state such as

```
AVAILABLE
UNAVAILABLE
UNKNOWN
```

plus appropriate public text/context.

Frontend must not interpret weekly business hours itself and decide whether the seller is available.

## 27. Availability is informational

### It does not mean

Seller guarantees a reply in five minutes.

### or

Delivery is currently operating.

It describes canonical seller availability configuration only.

## 28. Trust snapshot

### Seller Storefront consumes

```
Trust Public Read Model
```

rather than recomputing Trust.

Potential published fields can include approved facts such as:

```
Trust Level
Completed handoffs
Cancellation rate
Scan completion
Seller-service rating
```

Exact public fields remain owned by the Trust domain.

## 29. Trust response placement

Trust should be part of the initial seller response.

### Do not render

```
Seller page
v
wait
v
second Trust API request
```

on the primary page.

The existing API specifically makes Trust Level and completed handoff count part of Storefront page content to avoid another slow-network round trip.

## 30. Trust language

Canonical public Trust labels: NEW, REBUILDING, ESTABLISHED, TRUSTED.

REBUILDING is distinct from NEW: a Seller with prior transaction history is working back toward Established after falling below its requirements.

Consume the Trust public read model and factual approved reliability evidence. Never say safe Seller, guaranteed Seller, fraud-free, verified safe or risk-free. Paid promotion cannot buy Trust, and no Trust level limits Product count.

Storefront computes neither Trust nor private thresholds/risk reasoning.

## 31. Trust details sheet/page

### Clicking Trust may explain

```
What the Level means
What evidence Adulis records
Completed handoffs
Review methodology
What Adulis does not guarantee
```

This reduces misunderstanding without cluttering the product card.

## 32. Seller verification

Policy-approved narrow public indicators may include phone/Account control verified, social-account control verified and Seller/business admission status.

Current Adulis Seller admission does not collect Government ID, passport, selfie or ID scans. Do not imply business/identity attestation means such collection. Payment-provider KYC is provider-specific onboarding, outside Storefront Seller verification.

Storefront exposes no private legal records, evidence, provider KYC payload or Operator notes; it consumes only explicitly approved public facts.

## 33. Product Post catalogue

The Storefront catalogue renders the seller's eligible Product Posts.

A Product Post is the public commercial representation of exactly one sellable Product and may expose permitted Variant/price/availability information from canonical Catalogue/Inventory state.

The Storefront does not invent Product Post data and does not duplicate canonical product truth into Scene Posts.

## 34. Storefront catalogue is not FYP

The Seller Storefront is not the FYP. The FYP is cross-seller algorithmic discovery and, under the current Mobile decision, serves Scene Posts only.

The Storefront is seller-scoped. It shows this seller's Product Posts and Scene Posts and does not use FYP rank to reorder the seller page.

Product Posts may be reached from Storefront, Shop, Search, Seller profile and Scene Post exploration.

## 35. Current merchandising rule - no ordering hierarchy

Current release: no seller-controlled ordering hierarchy.

### Do not implement

- drag-and-drop Product Post ranking;

- custom visitor ordering tiers;

- seller-controlled priority weights;

- manual hierarchy shared with Mobile.

Use a simple deterministic backend-defined default order (for example current eligible publication/update recency plus stable tie-breaker) and explicit filters/search where available.

A richer merchandising/order hierarchy is deferred to the next product update. Do not encode today's simple order into permanent schema assumptions.

## 36. Product Post card

### Product Post card displays only public commerce essentials

- product image derivative;

- Product name;

- current/starting price presentation;

- current availability;

- optional Variant summary;

- current stock-confidence/freshness context where policy exposes it.

On the seller's own Storefront, repeating Seller name is usually unnecessary.

## 37. Product Post card media

### Use

product thumbnail derivative

not the full-resolution image.

Never serve full product originals into catalogue grids.

## 38. Product Post detail

Route: /s/:handle/p/:slug

Product Post Detail concentrates current public commerce truth.

### Recommended regions

Media Product name Current price Variants Availability + reason Stock confidence/freshness Attributes/specifications Description Seller + Trust Fulfilment Physical-store location where public Common Questions Verified-purchase Reviews Seller-owned related Scene Posts Optional TikTok/Instagram embed (Product Post page only) Buy/Continue in Adulis CTA

The page re-reads material commerce truth. Cached discovery data never authorizes checkout.

## 39. Product Post API

### Canonical public read

```
GET /v1/storefronts/:handle/products/:slug
```

The endpoint returns the public Product Post projection, not a private Catalogue entity. It is safe for anonymous use, bounded in size, market-aware and cacheable according to Inventory freshness policy.

## 40. Product availability

Public availability comes from canonical Inventory/Catalogue eligibility. The Storefront can cache informational availability but must clearly represent current state when known.

If the last item is sold after a Scene Post was seen, Product Post should render: Currently unavailable

Opening the Product Post should also show the public-safe reason where available, such as sold out, temporarily unavailable or unavailable in the current market. Public UI must not expose internal moderation or risk codes.

## 41. Stock confidence

### Where appropriate, show

```
In stock
Stock confirmed recently
```

or canonical equivalents.

### Avoid claiming

Guaranteed available.

## 42. confirmed_at

Every meaningful stock claim should preserve when the seller last confirmed it.

### Example

```
Stock confirmed today at 12:42 PM
```

This is more honest than making stale inventory appear timeless.

The existing API explicitly includes confirmed_at with product stock.

## 43. Variant selection on web

### Web may allow a visitor to inspect

```
Colour
Size
Shade
Storage
Model
```

### and see corresponding

- price;

- availability;

- media.

This does not create a Cart.

Variant selection is transient UI state.

## 44. Variant -> app checkout handoff

If a visitor selects a Variant and chooses Buy/Continue in Adulis, the Storefront may pass a public-safe Product/Variant reference in the app link.

### The Mobile app then

- revalidates Product/Variant/Inventory;

- adds the item to the appropriate seller cart;

- creates/continues seller-specific checkout;

- creates payment attempt through the platform Payment domain/provider adapter.

The Storefront never creates Cart, Order or Chapa/provider state.

## 45. Common Questions

Because web visitors cannot use authenticated buyer chat, Product Detail should expose deterministic read-only answers to common commerce questions.

### Examples

```
Pickup options
Seller delivery
Return/refund policy
Product material
Availability
Product specifications
```

The answers should come from the same authoritative seller/product configuration used by the Chatbot.

Do not maintain a second manually duplicated FAQ truth.

## 46. Chatbot relationship

The web Storefront does not need an interactive chatbot at MVP.

### Instead

```
Chatbot authoritative data/templates
v
Read-only Common Questions
```

### Then

Ask seller in Adulis

hands conversation intent to the native app.

This avoids introducing browser identity/session complexity merely for chat.

## 47. Product reviews

Product Reviews are commerce evidence, not social comments. A Review can be created only through the authenticated Adulis transaction flow after the buyer has a qualifying purchase history for that Product according to Review policy.

Storefront only reads published Review projections.

## 48. Review dimensions

### Never calculate

```
(product quality + seller service) / 2
```

into one ambiguous score.

### Storefront should clearly identify

```
Product rating
```

```
Seller-service rating
```

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

## 49. Review evidence

Review eligibility is evidence-based. Storefront may display that a Review is from a recorded purchase/handoff where policy exposes that fact, but it must not expose Order IDs, phone numbers or private Buyer identity.

The Reviews domain, not Storefront, decides whether a buyer may submit a Review.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 50. Negative reviews

Seller cannot remove a review merely because it is negative.

Storefront reads canonical Review state.

Seller reporting/moderation happens elsewhere.

## 51. Reviews route

```
/s/:handle/reviews
```

### Possible tabs

```
Seller service
Products
```

### with

- cursor pagination;

- rating filters where useful;

- evidence badge;

- date.

## 52. Reviews and SEO

Review text is user-generated content.

### If indexed

- use canonical moderation status;

- sanitize/encode;

- do not expose private order information;

- do not expose buyer phone/account identity.

## 53. Scene Posts

Scene Posts are Seller-authored image-led commerce/discovery content with one or more eligible same-Seller Product Post tags.

Storefront includes eligible PUBLIC Scenes on the Seller page, /s/:handle/posts and /s/:handle/post/:postSlug. Product Post remains canonical commerce truth; Scene owns no current price, stock or Variant authority.

Launch native Scene media is images/photos and supported image presentation. No native Seller video upload/transcoding or short-form Scene video is a launch capability. Approved third-party social-video embed is Product Post Detail only, never Seller profile, Scene card/Detail or FYP.

## 54. Why Scene Posts belong here

Product Posts answer: What exactly is being sold? Scene Posts answer: Why should I care about or want it?

The Storefront needs both because social traffic may land on the seller profile, an exact Product Post or an exact Scene Post.

Scene Posts remain commerce-linked content, not unrestricted social posting.

## 55. Scene Post card

Public Scene card may show image, caption excerpt, tagged Product count, currently available tagged-Product summary and Explore products.

Keep full tags/hotspots on Detail and use current canonical Product availability. At least one eligible tag must remain available for public display.

PRIVATE Scenes are omitted entirely. Seller-only Private badge/reason belongs on management surfaces, never public Storefront.

## 56. Scene Post detail

Stable route: /s/:handle/post/:postSlug.

Scene Detail may show primary Adulis-hosted image, caption, optional visual hotspots plus accessible Product list/In This Scene, current Product availability, Seller/Trust summary and Share/Open in Adulis.

All current MVP tags belong to the same Seller. Each resolves current Catalogue/Inventory truth; Scene revisions do not freeze price or stock. No third-party video embed or native Scene video appears here, and deferred recommendation enrichments stay disabled.

Before any public payload/metadata/media is returned, enforce current PUBLIC eligibility. A stale cached page cannot bypass PRIVATE.

## 57. Seller-owned product tagging only

### Current MVP rule

A seller-authored Scene Post may tag only Product Posts owned by that same Seller.

Validation occurs server-side when tags are added/published. The Storefront therefore renders only same-Seller tagged Product Posts in the current release.

Future creator/affiliate or cross-Seller commerce may be introduced by a later product decision; do not implement it now.

## 58. Storefront product-tag policy

For Storefront rendering, every Scene Post product tag must resolve to an eligible Product Post owned by the same Seller in the current release.

The Storefront never treats a stale tag as proof that a Product is purchasable. It composes current Product/Inventory state at read time and shows unavailable state where appropriate.

## 59. Scene public eligibility and restoration

Storefront consumes public Scene projections only after Content confirms publication_state=PUBLISHED and visibility=PUBLIC, active/public Seller, allowed Market, moderation clearance, ready image media, valid same-Seller tags and at least one currently available/in-stock eligible tagged Product.

Zero-tag and all-unavailable Scenes never become public at initial publication. Partial stock loss keeps PUBLIC only while another eligible tagged Product is available.

Loss of the last available Product keeps PUBLISHED but sets PRIVATE; it is not archival. Storefront, local/Marketplace Search, FYP, Buyer profiles, Collections and direct public resolution suppress it.

Restock of at least one eligible Product triggers Content re-evaluation of all gates and automatic PUBLIC restoration if valid. Archived/deleted/blocked/suspended/wrong-Market/independently restricted content cannot restore simply from restock.

![Current eligibility runs before every new controlled Scene delivery](graphics/STOREFRONT_02.svg)
*Figure 02. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 60. Partial stock loss, Private visibility and restoration

Case A - Partial stock loss: Scene tags A/B; A becomes unavailable while eligible B stays in stock -> Scene remains PUBLIC; A shows current unavailable state/public-safe reason and no purchase action; B remains actionable.

Case B - Last available Product loss: B becomes unavailable -> Content automatically sets PUBLISHED/PRIVATE -> remove Scene from public list and local/Marketplace Search -> direct anonymous URL cannot reveal image, caption or Product associations -> invalidate/reconcile projections/CDN. Buyer cannot use stale caches to bypass PRIVATE.

Case C - Restock: A becomes available -> Content rechecks every public gate -> automatically restore PUBLIC if valid -> refresh projection/list/detail/Search/cache and canonical indexability. No archival/deletion occurs solely for stock loss.

Storefront consumes this lifecycle; it never computes or mutates it.

## 61. Private and removed Scene public response

PRIVATE Scenes are Seller-only. Anonymous/public direct links return the approved generic unavailable response (policy-defined 404/410 or safe equivalent) without image, caption, Product associations or Seller-only reason.

Apply the same public-safe behavior to unpublished, removed, deleted or moderation-ineligible Scenes. No internal reason code, inventory-zero explanation or existence leak is returned unless an explicitly approved public policy requires it.

PRIVATE Scenes are absent from Search/sitemap and cannot be indexed. Purge public payload/HTML/metadata/media derivatives from delivery paths as required; a stale CDN object must not override current visibility. Historical evidence/revisions remain authorized internal data under retention policy.

## 62. Search within seller

### Storefront may provide seller-scoped search

GET /v1/storefronts/:handle/search?q=...

Search can return public Product Posts and Scene Posts belonging to that Seller only. Global marketplace search belongs to Mobile/Discovery and is not implemented by the Storefront endpoint.

Local result types are this Seller's PRODUCT_POST and PUBLIC SCENE_POST only; never private Scenes. Separate launch Marketplace Search can return Product Posts, Sellers and Scene Posts. Do not broaden this Seller endpoint silently.

## 63. Storefront search is not marketplace search

### Do not add

```
scope=all
```

to the Storefront endpoint.

Global marketplace search belongs to Mobile/Discovery.

This prevents a local feature from quietly becoming an unreviewed enumeration API.

## 64. Seller catalogue search

Seller catalogue search covers Product Post name, category, supported attributes and other public indexed fields approved by Search/Catalogue policy.

Use PostgreSQL/pg_trgm for MVP seller-scoped text search where relevance/latency is sufficient. Results return only public eligible Product Posts; no seller-controlled custom ranking hierarchy is applied in the current release.

## 65. No unqualified seller listing

### Do not expose

```
GET /v1/storefronts
```

```
GET /v1/sellers
```

to enumerate everyone.

The current API explicitly prevents this form of public enumeration.

## 66. Scraping versus enumeration

### Adulis should accept

Someone can scrape a seller's public Storefront.

That is structurally unavoidable for a useful public page.

### Adulis should resist

Someone can trivially download every Adulis seller and rank them by revenue/trust activity.

### Therefore use

- public slugs;

- no seller-list endpoint;

- bounded pagination;

- opaque cursors;

- edge rate limiting;

- query-intent requirements.

## 67. Do not CAPTCHA normal Storefront

browsing

### Storefronts should be

- public;

- indexable;

- fast.

### A JS challenge or CAPTCHA on ordinary browsing harms

- buyers;

- SEO;

- social in-app browsers;

- low-end phones.

The existing API architecture explicitly recognizes this crawler/anti-enumeration tension.

## 68. Rate limiting

Anonymous Storefront reads should primarily use edge controls.

### Dimensions can include

```
IP
ASN
route
burst
request volume
```

Use conservative limits that do not block legitimate crawling.

## 69. Application architecture

### Surface-specific frontend

- Next.js + React + strict TypeScript;

- Server Components/server rendering by default for public pages;

- generated TypeScript API client from OpenAPI;

- minimal client JavaScript for interactive Product tags, sharing, locale and app handoff.

Canonical Adulis platform stack used by Storefront dependencies: BACKEND: Node.js, NestJS, Fastify, strict TypeScript, Drizzle ORM, PostgreSQL. POSTGRESQL EXTENSIONS: pg_trgm, btree_gist, pg_stat_statements. ASYNC/CACHE: Valkey, BullMQ. API: REST, OpenAPI, @nestjs/swagger, generated TypeScript client. SECURITY: @nestjs/throttler, @fastify/helmet, libphonenumber-js where phone input is relevant to shared platform APIs. MEDIA: Cloudflare R2, Cloudflare CDN, Sharp. QUALITY: Jest, Testcontainers, Playwright, k6. OBSERVABILITY: Sentry, Pino structured logs, pg_stat_statements. ARCHITECTURE CONTROL: dependency-cruiser. DELIVERY: Docker, GitHub Actions, Render, Cloudflare. EAS belongs to Mobile delivery, not Storefront runtime.

Technology does not become business authority. PostgreSQL/domain services remain sources of truth.

## 70. Why server rendering

Server rendering remains appropriate because the Storefront is public, SEO-sensitive, social-link heavy and should render useful content inside mobile in-app browsers before large JavaScript bundles execute.

SSR must compose bounded public projections and benefit from Cloudflare caching. It does not imply direct database access from the Next.js Storefront.

## 71. Rendering architecture

### Rendering path

Browser -> Cloudflare edge/CDN -> Next.js Storefront on Render -> generated REST client -> api.adulis.<tld> NestJS/Fastify -> public read composition -> PostgreSQL/Valkey/R2 projections.

Client-side requests are reserved for interactions that materially benefit from them. Public HTML should remain useful with JavaScript limited or delayed.

## 72. Storefront page rendering

### For initial Seller page

### server fetch

```
Seller header/trust/availability
+
first product page
```

```
+
lightweight featured Scene Post page
```

in parallel where possible.

Avoid sequential waterfalls.

## 73. Public API response budget

### The established Storefront API target is

under approximately 40 KB uncompressed for the primary Storefront first-page response.

It includes seller information, public statistics and lightweight product information rather than full media.

Preserve that budget.

Scene Posts should use a separate bounded endpoint rather than bloating the core Seller response.

## 74. Proposed API map

### Recommended public API map

```
GET /v1/storefronts/:handle
GET /v1/storefronts/:handle/products
GET /v1/storefronts/:handle/products/:slug
GET /v1/storefronts/:handle/posts
GET /v1/storefronts/:handle/posts/:postSlug
GET /v1/storefronts/:handle/search
GET /v1/storefronts/:handle/reviews
```

Optional market/location endpoints may be composed into the seller response or fetched through bounded public contracts.

Do not add checkout/payment mutation endpoints to Storefront public APIs.

Stable public /posts routes may remain compatibility paths while conceptual contracts use Scene Post naming. Every Scene list/detail/search endpoint applies canonical PUBLIC/current-availability gates before response; no private management DTO or reason is serialized.

![Public web browses / native app transacts](graphics/STOREFRONT_03.svg)
*Figure 03. Public web browses / native app transacts. Storefront renders eligible public projections, keeps stable links, and hands intent to Mobile; backend revalidates commerce.*

## 75. API ownership

Storefront endpoints are read composition interfaces.

### They may compose data from

```
Seller
Catalogue
Inventory
Trust
Reviews
Content
Fulfilment
```

but must not become owners of those records.

## 76. Avoid N+1 queries

### Storefront composition must batch

- seller;

- variants;

- media;

- availability;

- Trust snapshots;

- ratings.

### Never

```
12 products
×
individual inventory query
×
seller query
×
review query
```

## 77. Public read model

The Storefront consumes bounded public read models optimized for anonymous rendering. Read models may denormalize Seller identity, Trust summary, rating summary, current Product Post presentation, Scene Post presentation and public location data.

They never become write models or independent business truth. Projections must be rebuildable from canonical domains.

PublicScenePost is a bounded response, not a direct Seller Content object. Eligibility is enforced before composition. Rebuildable projections cannot override current PRIVATE status or treat TTL as authorization.

## 78. Projection update model

Canonical domain commits persist transactional events/outbox or job intent with the business change. After commit, a relay schedules deterministic BullMQ invalidation/reconciliation jobs over Valkey; consumers are idempotent and projections are rebuildable.

Inventory last available tag lost -> Inventory commit -> Content Scene lifecycle rechecks dependencies and sets PRIVATE while retaining PUBLISHED -> durable visibility event -> invalidate public Scene projection, Seller list/detail, local/Marketplace Search, FYP/Buyer projections and CDN/cache. Current public eligibility blocks stale payloads while invalidation completes.

Restock -> re-evaluate every gate -> PUBLIC if valid -> durable event -> recreate/refresh public projection and invalidate negative/list/detail/Search caches. Archive/moderation/Seller/Market/deletion restrictions still win.

Use invalidation plus bounded TTL and reconciliation. Async caches never authorize publication or checkout; no second overlapping ordinary job engine is introduced.

![Current eligibility runs before every new controlled Scene delivery](graphics/STOREFRONT_04.svg)
*Figure 04. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 79. Cache architecture

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

Cache genuinely non-sensitive static shells and permitted immutable image/static assets only. Scene-bearing data/HTML/caption/title/card/meta bypasses full-page/data CDN caching, ISR and stale-while-revalidate unless the authoritative decision still runs before every delivery. Dynamic nonce HTML uses the existing fresh per-response CSP nonce profile and no shared HTML cache; static asset policies stay compatible. Already delivered bytes, in-flight responses and external screenshots/copies cannot be recalled. Authorized Seller-private and case-scoped Operator access are separately authenticated.

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

## 80. CDN hierarchy

Static shell/assets may hit Cloudflare cache; Scene-bearing data/HTML/meta routes bypass shared cache -> origin -> batched authoritative Adulis owner eligibility -> response. Safe Product/static cache roles remain separately bounded. Private preview/case responses authenticate independently and never share public cache.

Cache genuinely non-sensitive static shells and permitted immutable image/static assets only. Scene-bearing data/HTML/caption/title/card/meta bypasses full-page/data CDN caching, ISR and stale-while-revalidate unless the authoritative decision still runs before every delivery. Dynamic nonce HTML uses the existing fresh per-response CSP nonce profile and no shared HTML cache; static asset policies stay compatible. Already delivered bytes, in-flight responses and external screenshots/copies cannot be recalled. Authorized Seller-private and case-scoped Operator access are separately authenticated.

## 81. Cache tags

### Use logical cache tags/surrogate keys such as

```
seller:<sellerId>
product:<productId>
scene:<scenePostId>
reviews:<sellerId>
```

Internal identifiers are acceptable inside infrastructure tags.

They simply must not appear in public URLs.

Compatibility invalidation may purge legacy post-tag aliases during migration. Public routes stay stable; internal tag naming moves to Scene without duplicating canonical entities/events.

## 82. Event-driven invalidation

### Example

```
Product price updated
v
catalogue event
v
invalidate:
product page
seller product list
related Scene Post projection where needed
```

Do not rely solely on a five-minute stale window for important publication changes.

Scene visibility changes are high-priority public-access changes. Purge detail/list/search/SEO/metadata/media delivery and CDN objects, reconcile missed events, and gate public responses with current eligibility. Restoration invalidates negative caches and rebuilds the public projection. A stale cache can never serve private content merely because its TTL has not elapsed.

## 83. TTL still matters

Event-driven cache invalidation can fail.

Therefore bounded TTL provides recovery.

### Use

```
invalidation
+
bounded TTL
```

not either one alone.

Bounded TTL recovers missed projection updates; it is not permission to continue exposing a PRIVATE Scene. Access/publication gating and visibility-aware delivery must deny stale public payloads independently of asynchronous purge lag.

## 84. Inventory cache semantics

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

Checkout still revalidates exact current Product/Variant/price/quantity before payment. Ordinary informational Product-only cache limits do not authorize a stale all-unavailable Scene; response-time gating checks current tag stock and independent restrictions.

## 85. Removed content invalidation

Moderation removals should receive higher-priority cache invalidation than ordinary merchandising changes.

### A content-removal event should invalidate relevant

- Scene Post page;

- product page if needed;

- Storefront list;

- CDN object/public projection.

Scene PRIVATE and removal both invalidate public Scene detail/list/search/sitemap/metadata/CDN paths. Keep lifecycle meanings separate: stock-driven PRIVATE is not ARCHIVED or REMOVED. Gated PUBLIC restoration refreshes the stable public target and negative caches.

## 86. Media architecture

Media architecture uses Cloudflare R2 as object storage, Cloudflare CDN for public delivery and Sharp for bounded image processing/derivatives.

Storefront receives public presentation URLs/metadata from Media; it never receives storage credentials. Original uploads are not served into every card when a smaller derivative exists.

## 87. Media derivatives

### Use controlled roles

```
Avatar
Product thumbnail
Product card
Feed card
Scene Post explorer
Product detail
```

The existing social-commerce architecture already defines this controlled derivative strategy.

## 88. Responsive image delivery

### HTML should include appropriate

```
srcset
sizes
width
height
```

or framework equivalents.

A 360px phone must not download an image generated for a 1,600px desktop.

## 89. LCP image

Storefront hero/primary product media should receive appropriate priority only if above the fold.

Do not mark every image as high priority.

That defeats browser prioritization.

## 90. Lazy loading

### Below-fold product/Scene Post images

```
lazy
```

with reserved dimensions to avoid layout shift.

## 91. Product Post social embeds

TikTok/Instagram embeds are permitted only on the Product Post Detail page.

### They are not shown

- on the Seller profile/home page;

- on Scene Post cards/details as third-party embeds;

- in the Adulis FYP.

A seller may associate an approved TikTok video or Instagram Reel with the Product Post. Default state is an Adulis-hosted poster. Third-party embed infrastructure loads only after explicit buyer action such as Play video.

## 92. Embed isolation

### Product Post third-party embeds use strict isolation

- approved TikTok/Instagram origins only;

- sandboxed iframe/WebView-equivalent browser embed where compatible;

- lazy/click-to-load mounting;

- no Adulis credentials in embed context;

- no privileged postMessage behavior;

- restrictive CSP frame-src allowlist.

The Product Post remains usable when the third-party service fails.

## 93. Raw HTML

### Seller input must never be rendered through

```
dangerouslySetInnerHTML
```

without a tightly reviewed sanitization need.

### Default

```
seller text
-> structured/plain storage
-> React escaped output
```

The existing browser-security specification identifies output encoding as the primary defense against seller-content XSS.

## 94. Content Security Policy

Storefront needs a strict CSP.

### Conceptually

default-src 'self' script-src nonce-based approved sources style-src approved self resources img-src self media.adulis...

```
connect-src public Adulis API/analytics
frame-src approved TikTok/Instagram embed origins
object-src 'none'
base-uri 'self'
frame-ancestors appropriate policy
```

### No generic

```
script-src 'unsafe-inline'
```

## 95. Security headers

### Include

```
Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
```

Set permissions policy to deny unnecessary browser capabilities.

### A Storefront does not need

- camera;

- microphone;

- geolocation

for ordinary MVP browsing.

## 96. No sensitive cookies

Ordinary Storefront browsing should not create sensitive authentication cookies.

### Any analytics/session cookie must first justify

- purpose;

- retention;

- privacy impact.

Prefer cookieless first-party anonymous analytics where practical.

## 97. SEO architecture

SEO applies to Seller profiles, Product Posts, Scene Posts and Review pages where public policy permits indexing.

Use server-rendered metadata, canonical URLs, structured data where semantically accurate, sitemap entries and market/locale-aware alternates. Do not expose private seller/account/Order identifiers for SEO.

Only current eligible PUBLIC Scenes are indexable. PRIVATE Scenes expose no media/caption/tags, metadata or structured Scene payload. Restored PUBLIC Scenes use the same canonical URL and approved indexing policy.

## 98. Seller metadata

### Seller page

```
<title>
<meta name="description">
canonical URL
OpenGraph
Twitter/social card metadata
structured data
hreflang
```

### Example title

```
Addis Style | Fashion on Adulis
```

## 99. Product metadata

Product Post metadata may include public name, seller, canonical URL, description summary, image, current price/availability and supported structured Product data.

Do not put stale price in long-lived metadata without cache invalidation/freshness controls. Payment-provider internals never belong in SEO metadata.

## 100. Structured data

### Appropriate Schema.org types may include

```
Organization / Store
```

```
Product
Offer
AggregateRating
Review
BreadcrumbList
```

only when the underlying public data genuinely satisfies the semantics.

A Scene page may use only semantically accurate visible-content metadata; it is not a canonical priced Product Offer. Never emit Scene structured data for PRIVATE content or pretend a Scene owns price/stock.

## 101. Rating structured data

Do not manufacture a single AggregateRating if Adulis intentionally distinguishes:

- product quality;

- seller service.

Use structured data only where the meaning is unambiguous.

## 102. Product availability structured data

### If an Offer says

```
InStock
```

ensure its cache/invalidation policy is sufficiently fresh.

When uncertain, avoid stronger machine-readable claims than the system can maintain.

## 103. Canonical URLs

Canonical public URLs are stable seller-scoped entity URLs. Marketing parameters such as UTM tags do not create canonical duplicates.

### Storefront

/s/:handle

### Product Post

/s/:handle/p/:productSlug

### Scene Post

/s/:handle/post/:postSlug

Locale/market rendering may vary, but entity identity remains stable. Any future localized-path strategy must preserve redirects and canonical/hreflang consistency.

## 104. Sitemap strategy

Sitemaps may enumerate public Seller profiles, Product Posts and Scene Posts that are eligible for indexing.

Do not include deleted/unpublished/moderation-restricted entities. Sitemap generation consumes public projections and remains independent from private Seller Console state.

Explicitly exclude PRIVATE Scenes. Visibility invalidation updates sitemap and cached SEO objects promptly; gated automatic PUBLIC restoration can recreate the canonical entry without changing the stable URL.

## 105. Robots

Do not use robots.txt as a security system.

Anything confidential must not exist on Storefront routes at all.

## 106. Deleted seller

When a Seller is no longer publicly available, return the approved unavailable HTTP response, such as 404 or 410 where removal is intentionally permanent, according to public response policy.

Do not return 200 with a fake empty Seller shell.

## 107. Renamed seller

When handle history resolves to the same Seller, return 301 to the canonical new handle rather than a missing-content response. Preserve redirect history and canonical identity.

## 108. Unpublished product

A public request for an unpublished Product uses the approved generic unavailable response. Do not reveal that the Product exists but the Seller unpublished it; that leaks internal state unnecessarily.

## 109. Moderation-restricted product

### Ordinary visitor sees

```
Not available
```

through appropriate 404/removal semantics.

Do not disclose internal moderation reason codes.

## 110. Global localization architecture

Adulis is global from day one, so Storefront must be international-ready rather than Ethiopia-only.

### Requirements

- Unicode/i18n-safe UI and seller content;

- market/locale context supplied by platform configuration;

- currency formatting from canonical market/product data;

- market-local human time display where time is shown;

- API instants remain ISO 8601 UTC (Z);

- SEO locale alternates only for actually supported translations;

- original seller-authored content is never silently machine-translated and presented as seller truth.

English and Amharic remain supported locales, not the architectural limit.

## 111. Seller-written language

Seller-authored Product Post/Scene Post text may be written in any language currently allowed by the Seller's Market/content policy. Storefront displays the authored text and platform-localized UI chrome separately.

Do not fabricate translations of seller product claims. Translation services may be added later only with explicit provenance/policy.

## 112. Missing translation

### Platform-controlled UI

fallback safely.

### Seller-controlled content

display original.

Do not make up a translation of a product claim.

## 113. Typography

Typography must handle Latin, Ge'ez and other enabled market scripts, mixed numbers, currency symbols and long localized strings without clipping. Use font fallbacks licensed for the deployed web surface and verify real devices for target markets.

## 114. Phone-first responsive baseline

Launch UI is phone-first and phone-targeted. Bind design QA to common mobile widths beginning around 360px and social in-app browsers on Android/iOS.

The full Storefront interaction design is optimized for phone browsing. Tablet/wide-screen access must not become a second separately designed Storefront.

## 115. No dedicated desktop Storefront

There is no dedicated desktop Storefront version in the current release.

When a human visitor opens a Storefront on a wide desktop viewport, lead them to continue on a phone. A minimal desktop continuity page may show Seller identity, the canonical link, a non-transactional QR/deep-link handoff and instructions to open Adulis on the phone.

Do not spend MVP design/engineering effort building a separate desktop catalogue/navigation experience. Search crawlers can still receive semantic server-rendered public HTML.

## 116. Storefront navigation

### Phone Storefront navigation remains commerce-focused

Seller Product Posts Scene Posts Reviews About / location Share Open Adulis

Do not reproduce full Company Website corporate navigation. Keep interaction shallow and suitable for social in-app browsers.

## 117. Seller navigation remains scoped

While browsing a Seller Storefront, keep the visitor scoped primarily to that Seller. Scene Post tags are same-Seller in the current release.

Cross-seller marketplace discovery belongs to Mobile FYP/Search and is not injected into ordinary Storefront pages. Recommendation enrichment on Storefront is deferred.

## 118. Public share

### Allow canonical sharing of

- Seller profile;

- Product Post;

- Scene Post.

Seller Console should provide the corresponding links immediately after publication. Sellers may reuse them in TikTok/Instagram bio (profile) and captions/comments (Product/Scene Post), direct messages and campaigns.

Do not attach secrets, internal IDs or privileged attribution tokens to shared URLs.

Authenticated saving supports individual Product Posts and whole PUBLIC Scene Posts through platform Collections. Anonymous Save uses approved sign-in/app handoff; Storefront owns no Collection membership or durable Buyer account state. Private Scene membership never grants public content access.

## 119. Purchase/install sheet

When a browser visitor taps Buy in Adulis / Continue in Adulis, show a concise phone-oriented handoff:

- Open Adulis (if installed);

- Get Adulis;

- Continue browsing public Storefront.

Explain accurately that checkout/payment occurs inside Adulis using the supported payment gateway for the buyer/order market. Chapa is the initial provider where enabled by Adulis configuration.

The Storefront itself creates no payment attempt.

## 120. Install continuity limitation

If the app is not installed, conventional app-store links may not preserve exact Product/Post context through a first installation on every platform.

Do not promise perfect deferred deep-link continuity unless Adulis implements and verifies it. The original public URL remains the recovery anchor and can be reopened after installation.

## 121. Recovery after install

### Recovery after install can use

- reopen the original Product Post/Scene Post URL;

- Search the Seller/Product in Adulis;

- Seller profile link;

- recent link/browser history where the platform permits.

Do not introduce transaction short codes merely to patch app-install continuity.

## 122. Desktop visitor phone handoff

Because current Storefront has no dedicated desktop experience, wide-screen visitors may receive a phone-continuation view.

The view may display a QR containing only the canonical public Seller/Product/Scene Post URL plus Open on phone instructions.

It must not expose checkout/payment or Handoff credentials on desktop.

## 123. Public-link QR vs Handoff Verification

A public share/continuation QR is only a URL/navigation mechanism.

It is NOT a Handoff Verification credential.

Adulis Handoff Verification is a separate authenticated order domain with two physical handoffs (Seller -> Courier pickup, Courier -> Buyer delivery) and QR / OTP / Manual verification methods. Storefront public links must be visually, cryptographically and semantically separate from that system.

## 124. Analytics

Use first-party Storefront analytics with typed/versioned events.

### Key events can include

storefront_viewed product_post_viewed scene_post_viewed scene_product_tag_opened reviews_opened storefront_search_performed checkout_intent_web open_app_clicked app_store_clicked share_clicked social_referrer_classified

Canonical Order/payment outcomes are server-origin events from the Adulis platform, never browser truth.

Use SCENE_POST entity/event naming in typed versioned analytics contracts. Migrate legacy event aliases without double-counting. Visibility events are operational domain facts, not Storefront-owned analytics decisions.

## 125. No transaction truth from web analytics

Web analytics observations never establish commerce truth.

checkout_intent_web means the visitor expressed intent. It does not mean an Order exists or a payment succeeded.

Only canonical backend domains/provider verification can establish paid Order/completed Order facts.

## 126. Funnel measurement

### External conversion funnel

Storefront/Scene Post view -> Product Post view -> checkout intent -> app open/install -> seller cart checkout -> gateway payment attempt -> paid seller Order -> fulfilment -> delivery Handoff -> completed Order.

Measure transitions without claiming perfect attribution. Scene Post product-tag clicks should preserve post/product/referrer context.

Whole-Scene save attribution is distinct from Product-tag clicks. PRIVATE Scenes produce no public content events from stale delivery; canonical paid/completed facts remain server-origin.

## 127. Referrer attribution

Capture bounded referrer/source information for public links: social platform/referrer class, campaign identifiers where explicitly approved, shared-link source and landing entity.

Normalize/strip tracking parameters from canonical SEO/cache keys after analytics capture. Do not retain full sensitive referrer URLs indefinitely.

## 128. Social in-app browser problem

TikTok/Instagram in-app browsers are primary Storefront entry environments. Test link opening, back navigation, app links, clipboard/share, cookie restrictions and browser limitations on real devices.

The Storefront must still render useful Product/Scene content before the visitor opens Adulis.

## 129. Seller analytics integration

### Seller Console should eventually distinguish

```
Web Storefront visits
Native Storefront visits
FYP impressions
Product opens
Orders
```

so sellers can understand where demand came from.

## 130. Storefront analytics privacy

### Do not send

- product description text;

- review body;

- seller private data;

- visitor phone;

- query strings containing secrets.

Use stable entity identifiers internally inside first-party analytics where approved.

## 131. Performance objectives

Initial phone Storefront objectives should emphasize fast social landing and bounded media:

- low TTFB from Cloudflare/SSR cache;

- fast LCP for primary image/poster;

- stable layout at 360px;

- small JavaScript budget;

- no third-party embed load before explicit action;

- bounded API payloads.

Exact SLO values belong to Observability/Deployment configuration and are validated with production-like tests.

## 132. Viral traffic objective

A seller receives 1,000,000 TikTok views.

A fraction taps the bio.

### The desired infrastructure behavior is

```
large increase:
CDN requests
image delivery
```

```
small increase:
origin rendering
```

```
very small increase:
PostgreSQL
```

If a viral Storefront creates one database query per image/card/view, the architecture has failed.

## 133. Degradation strategy

Degrade optional features before public commerce truth.

If Analytics is down: render Storefront. If Valkey is degraded: bypass/slow cache safely where possible; canonical public reads remain available. If recommendation enrichment is absent: no impact (feature deferred). If social embed is down: Product Post still works. If Inventory cannot be determined: fail conservative on purchase affordance and explain availability uncertainty.

## 134. Inventory-service degradation

### If canonical inventory cannot be determined

### do not say

```
In stock
```

### Render

```
Availability temporarily unavailable
```

The buyer can retry.

Never guess optimistic inventory.

## 135. Trust-service degradation

Prefer last approved bounded Trust projection if Trust read model is explicitly designed for this degradation.

### Otherwise

```
Trust information temporarily unavailable
```

Do not infer Trust from seller age/reviews.

## 136. Media degradation

### If one image fails

- show accessible placeholder;

- preserve Product name;

- preserve price;

- keep navigation usable.

Do not allow an image CDN outage to reduce the page to blank cards.

## 137. Social embed degradation

If TikTok/Instagram embed fails, the Product Post page remains complete using Adulis-hosted poster/media, Product information, Seller/Trust, availability and Buy/Continue in Adulis CTA.

Never make third-party video availability a prerequisite for Product Post commerce.

## 138. Analytics degradation

Storefront analytics may fail open. Drop/retry low-priority telemetry. Never block Product/Scene Post rendering or checkout handoff because event ingestion is unavailable.

## 139. Search degradation

If seller-scoped Storefront search fails, Product Posts and Scene Posts remain browsable in the simple backend-defined default order. Search is an enhancement, not a business-state dependency.

## 140. Error pages

### Create localized

```
Seller not found
Product not found
Scene Post unavailable
Temporary problem
```

### with useful recovery

```
Return to seller
Open Adulis
Return to Adulis
```

## 141. Server errors

### Do not expose

- SQL;

- stack traces;

- internal IDs;

- moderation state;

- object-store paths;

- authorization details.

Return request ID for troubleshooting.

## 142. Observability

Observe Storefront across frontend, API, database, cache and media layers.

Sentry: Storefront/server/client errors and release context. Pino: structured backend logs with redaction. pg_stat_statements: PostgreSQL query diagnosis. Valkey/BullMQ: cache/job health. Cloudflare/R2: edge/media signals.

Monitor request rate, TTFB/SSR latency, API latency, 5xx/404, cache hit ratio, LCP, media/embed failure, checkout-intent rate, app-open rate and stale/unavailable-tag rates.

## 143. Cache observability

Cache observability tracks Cloudflare HIT/MISS/STALE/REVALIDATED/PURGED plus origin/Valkey cache behavior where used.

Cache dimensions must remain bounded by canonical path, market/locale and meaningful filters. Never vary cache by arbitrary analytics cookies or high-cardinality user identity.

## 144. Cache-key discipline

### Do not vary public Storefront cache on

- random analytics cookies;

- unnecessary User-Agent values;

- arbitrary tracking parameters.

Canonical cache dimensions should remain small.

### Typically

```
path
locale
meaningful query filters
```

## 145. Query parameter normalization

Strip/ignore marketing parameters from canonical cache/SEO behavior where possible.

### Example

```
?utm_source=tiktok
```

must not create a separate canonical Product page.

Analytics may observe the parameter before normalization.

## 146. Logging

### Allowed

```
request ID
route template
status
latency
cache status
deployment version
```

### Avoid logging

- raw search query indefinitely;

- full referer URL;

- review content;

- seller descriptions;

- unnecessary IP beyond security retention policy.

## 147. Abuse monitoring

### Watch

```
high request velocity
sequential handle probing
```

```
cursor harvesting
mass search
media hotlinking
scraping concentration
malicious review payload attempts
embed abuse
```

Respond proportionally.

## 148. Hotlink protection

Public product images will inevitably be shareable.

Do not introduce signed per-view image URLs that destroy CDN caching.

### If external hotlink abuse becomes expensive

consider CDN referer/rate controls later based on measured cost.

## 149. Application directory

Canonical repository boundary (Storefront remains in the main platform monorepo):

```
adulis-platform/
apps/
mobile/
seller-console/
operator-console/
storefront/
app/
s/[handle]/page.tsx
s/[handle]/products/
s/[handle]/p/[slug]/
s/[handle]/posts/
s/[handle]/post/[postSlug]/
s/[handle]/reviews/
.well-known/
robots.ts
not-found.tsx
src/
storefront/
product-posts/
scene-posts/
trust/
reviews/
location/
app-handoff/
analytics/
seo/
shared/
tests/
api/
worker/
packages/
api-contracts/
design-system/
tokens/
schemas/
locale/
analytics-events/
money/
dates/
permission-catalogue/
handoff-contract/
```

adulis-web/ is a separate Company Website monorepo and is not inside adulis-platform.

Frontend packages never import backend repositories or database credentials.

## 150. Shared packages

Shared packages may provide design tokens, locale primitives, generated API contracts/types, schemas, analytics-event contracts, money/date formatting and public-safe handoff/link contract types.

Do not share Drizzle repositories, PostgreSQL clients, secrets or private domain internals with Storefront. dependency-cruiser enforces import boundaries.

## 151. Network architecture

### Browser network access is intentionally small

- page/document requests to shop.adulis.<tld>;

- approved public API calls to api.adulis.<tld> when client interactivity needs them;

- media from media/CDN origin;

- click-to-load TikTok/Instagram Product Post embeds from approved origins;

- app links/store links.

The browser never connects to PostgreSQL, Valkey, BullMQ or R2 credentials directly.

## 152. Browser API calls

Most initial page data should be server-rendered.

### Client API calls only for interactions such as

- load more;

- seller search;

- filters;

- Scene Post expansion;

- analytics.

Do not hydrate everything merely to fetch again.

## 153. Timeout strategy

Public page rendering should have bounded backend timeouts.

A degraded recommendation/secondary module must not delay the seller header indefinitely.

### Prioritize

```
Seller
Product
Price
Trust
Availability
```

### over

```
Related Scene Posts
Optional recommendations
Analytics
Embeds
```

## 154. Critical versus optional data

### Critical public data

Seller identity/eligibility, Product Post name/price/availability, tagged-product current state, Trust/Review summary where shown, and safe fulfilment/location context.

### Optional data

analytics, Product Post social embed, non-critical media derivatives, optional Seller bio content.

If critical data cannot be determined safely, degrade conservatively instead of inventing values.

Scene PUBLIC visibility plus at least one current eligible available tag are critical response gates. If those cannot be determined, return safe unavailable content; never allow stale optional content to override them.

## 155. Accessibility

Target WCAG AA.

### Requirements

- semantic headings;

- keyboard access;

- adequate touch targets;

- visible focus;

- meaningful image alt text;

- accessible variant controls;

- no color-only availability;

- accessible Trust explanation;

- descriptive Buy in Adulis CTA;

- usable at large text size.

## 156. Scene Post accessibility

Scene Post accessibility must not depend only on visual hotspots.

Every tagged Product must also be available in an accessible list with Product name, current availability and a descriptive link. Hotspots need accessible labels and keyboard/touch targets. Image/carousel controls require proper semantics and text alternatives where supported by launch image policy. No Scene video player/third-party embed is rendered.

## 157. Reduced motion

### Do not make

- parallax;

- animated hotspot pulses;

- autoplay media

required for understanding the page.

Respect prefers-reduced-motion.

## 158. Product image alt text

Use product information when available.

### Good

Black linen midi dress, front view.

### Bad

Image 1.

Do not generate unsupported details that seller did not provide.

## 159. Testing pyramid

### Testing layers use the current quality stack

- Jest for unit/component logic;

- Testcontainers for real PostgreSQL/Valkey/API integration where backend behavior is involved;

- Playwright for Storefront browser E2E/security/SEO paths;

- k6 for load/viral-traffic testing;

- API contract tests from OpenAPI/generated client;

- security-negative tests and dependency-cruiser architecture checks.

Mobile-specific Maestro tests validate app handoff on the Mobile project; Storefront itself is Playwright-driven.

## 160. Critical E2E  -  social landing

### Critical E2E - social landing

Seller publishes Product Post and Scene Post -> copy canonical links -> open each link from simulated TikTok/Instagram referrer/in-app browser -> exact entity renders -> tagged Product opens correctly -> Buy/Continue in Adulis handoff works.

Also verify Seller profile bio URL lands on the correct Storefront.

## 161. Critical E2E  -  installed app

### Critical E2E - installed app

Open Product Post or Scene Post Universal/App Link on a phone with Adulis installed -> app receives public-safe entity context -> Product/Store context is correct -> buyer can add to seller cart / continue checkout after backend revalidation.

The public Storefront never creates payment state itself.

## 162. Critical E2E  -  Storefront

### Critical E2E - Storefront

Open Seller profile -> Product Posts -> Scene Posts -> Reviews -> public physical-store location if configured -> share link -> back navigation.

Verify no seller-admin or private account data appears and no manual ordering hierarchy is exposed.

## 163. Critical E2E - Scene visibility and restoration

Initial publication: zero tags, cross-Seller tags and all-unavailable tags are rejected by backend; no public Storefront projection appears.

Case A: Scene A/B public -> Product A unavailable, B available -> Scene remains PUBLIC -> unavailable A is non-purchasable -> B remains actionable with fresh Product truth.

Case B: B unavailable -> PUBLISHED/PRIVATE -> Scene absent from Seller page/list, local and Marketplace Search, FYP and Buyer Collections -> direct anonymous URL reveals no image/caption/tags -> sitemap/index/HTML/metadata/CDN caches invalidate and stale object cannot bypass access gating.

Case C: A restocked -> Content rechecks all gates -> automatic PUBLIC restoration if valid -> stable list/detail/canonical URL/SEO/Search public again. Archived/blocked/suspended/wrong-Market/deleted/restricted fixtures prevent restoration.

No Seller-only Private badge/reason is rendered publicly. Same-Seller tag ownership remains enforced.

## 164. Critical E2E  -  unavailable stock

### Critical E2E - unavailable stock

Product Post cached as available -> last unit is sold through canonical Order -> Inventory event/cache invalidation occurs -> Storefront revalidation eventually shows Currently unavailable -> opening Product Post shows public-safe reason -> Mobile checkout revalidation prevents stale purchase.

No cache state may corrupt Order/Inventory truth.

If this Product was the last available tag of any public Scene, assert immediate canonical PRIVATE suppression across all public reads/caches. Inventory freshness and Scene access gating are separate checks.

## 165. Critical E2E  -  product removal

```
Product cached
-> moderation removes product
-> invalidation
-> public URL no longer exposes product
```

If removal eliminates the last eligible available tag, reconcile dependent Scene visibility/public projections; no cached Scene exposes restricted media/Product associations.

## 166. Critical E2E  -  seller rename

```
/s/oldhandle
-> 301
-> /s/newhandle
```

including Product routes where feasible.

## 167. XSS tests

### Attempt seller inputs such as

```
<script>
<img onerror>
javascript:
malformed markdown
SVG payloads
event attributes
```

Verify they render inertly.

Reviews require equivalent tests.

## 168. Enumeration tests

### Verify there is no

```
GET all sellers
editable sequential cursor
internal UUID URL
public admin route
```

and that seller lookup remains bounded.

## 169. Cache-isolation tests

### Verify

```
Seller A response
```

### can never be returned for

```
Seller B URL
```

because of malformed cache keys.

### Also test locale separation

```
/en
/am
```

## 170. SEO tests

### Automate

- correct HTTP status;

- title;

- canonical;

- hreflang;

- OpenGraph;

- structured data;

- index/noindex;

- redirects;

- duplicate query variants.

Add PRIVATE Scene absence from sitemap/indexable responses, no private media/caption/tags in HTML/metadata/structured data, stale-CDN bypass rejection and restored PUBLIC Scene canonical URL/indexability. Test old stable social links and any redirect aliases.

## 171. Load test

### Use k6 against production-like staging for

- viral Seller profile traffic;

- direct Product Post link spikes;

- direct Scene Post link spikes;

- search crawler pressure;

- cache cold/warm behavior;

- public API/R2 origin protection.

Success means Cloudflare absorbs cacheable traffic, Render/API remain within SLOs, PostgreSQL/Valkey/BullMQ remain healthy and no seller/locale cache isolation defect appears.

## 172. Deployment

Storefront is an independently deployable application inside adulis-platform.

### Runtime path

Cloudflare edge/DNS/CDN -> Next.js Storefront deployment on Render -> api.adulis.<tld> -> platform domains.

Delivery uses Docker, GitHub Actions, Render and Cloudflare. A Storefront UI release must not require Company Website deployment; adulis-web is separate. Mobile uses EAS independently.

## 173. Environment separation

Separate development, staging and production environments for Storefront/API dependencies. Separate at minimum API origins, PostgreSQL databases, Valkey instances/namespaces, R2/media namespaces, credentials, Chapa/provider keys, observability projects and feature/configuration values.

Storefront preview environments must never point at production private/admin state.

## 174. Preview environments

PR previews must never automatically expose production private data.

Using production public Storefront APIs for visual previews should still be avoided unless explicitly designed.

Prefer staging fixtures.

## 175. CI pipeline

### Recommended CI

Install -> dependency-cruiser architecture check -> typecheck -> lint -> Jest -> API contract generation/compatibility -> build -> security headers/CSP checks -> Playwright E2E -> Testcontainers integration where applicable -> deploy staging -> smoke -> production promotion.

k6 runs on production-like staging for release/capacity gates rather than every small PR.

## 176. Security CI

### Gate against

```
dangerouslySetInnerHTML
unsafe-inline script CSP
unapproved iframe origin
internal UUID public route
console imports
API secrets in client bundle
unbounded pagination
```

Exceptions require explicit review.

## 177. Feature flags

Feature/configuration controls may govern public Scene Post rendering variants, social embeds, locale/market availability, physical-store location display and future recommendation enrichments.

A feature flag never bypasses authorization, moderation, Inventory, Seller eligibility or payment-provider policy.

## 178. Reviews, not social comments

Adulis does not provide generic social-media comments on Storefront.

Buyer feedback is represented as Reviews governed by purchase eligibility. Only a buyer with qualifying purchase history for the Product may submit a Product Review through the authenticated Adulis app/workflow.

Storefront is read-only for published Reviews. Instagram/TikTok "comments" mentioned in seller acquisition are external social locations where a seller may paste an Adulis link; they are not an Adulis feature.

## 179. Deferred recommendation enrichments

Public recommendation-enrichment modules beyond seller-owned Product/Scene content are not part of the current Storefront release.

Keep the Storefront correct without Recommendation service availability. Any future enrichment must be introduced by a later product decision and consume Recommendation through a bounded public contract rather than computing ranking inside Storefront.

## 180. Future recommendation extension point

Preserve an extension seam for future recommendation modules without reserving current UI space or API contracts that imply they already exist.

The current page remains Seller-scoped: Seller Product Posts, same-Seller Scene Posts, Reviews, Trust, location and checkout handoff.

## 181. Storefront and FYP consistency

### Storefront and Mobile must use consistent entity semantics

- FYP displays Scene Posts only;

- Product Posts are available through Search/Shop/Seller profile and Scene Post exploration;

- Storefront exposes both Product Posts and Scene Posts;

- current Scene Post tags are same-Seller only;

- current availability/price comes from canonical Product/Inventory state;

- checkout/payment occurs in Adulis, not Storefront.

All Buyer/public surfaces share PUBLIC plus current eligible availability gating. Last-stock loss suppresses Scene exposure everywhere and restock permits gated automatic restoration. Image-only Scene media and four Trust labels are consistent across surfaces.

## 182. Seller suspension

If canonical Seller state makes the seller publicly ineligible:

all public seller commerce surfaces must stop advertising purchasability.

Do not rely on individual Product records being unpublished one by one.

Use central seller eligibility in Storefront read authorization.

## 183. Storefront closure

Seller closure policy controls public visibility without deleting evidence. A temporarily closed Seller may display a clear unavailable/closed state while disabling Buy/Continue in Adulis actions.

Exact public behavior is Seller/Moderation/Privacy policy; Storefront does not erase historical transaction evidence.

## 184. Seller deletion

Seller/Account deletion is coordinated by the main Adulis Account Lifecycle/Privacy domains. Storefront consumes the resulting public visibility/tombstone state and purges/invalidate public projections/media as instructed.

Storefront never implements account deletion logic or directly deletes domain records.

## 185. Public data minimization

Storefront should expose only buyer-useful information.

### Never expose

- seller phone number;

- seller team;

- legal-ID data;

- payment account;

- internal claim evidence;

- internal Trust score;

- moderation notes;

- seller email unless explicitly made public by policy.

## 186. Trust Engine secrecy

### Public Trust may show

```
Level
Facts
Published metrics
```

### It should not expose

```
fraud risk score
internal anomaly flags
demotion thresholds not approved for publication
investigation notes
anti-gaming weights
```

This protects both users and system integrity.

## 187. Recommendation secrecy

### Likewise, Storefront must never expose

```
FYP score
seller boost value
candidate weights
trust multiplier
exploration quota
```

Seller Console receives outcomes, not algorithm internals.

Storefront receives even less.

## 188. Commerce language invariants

Commerce copy must match the gateway architecture.

### Never claim

- Storefront itself processed payment;

- payment success before provider/backend verification;

- escrow unless a future legally/technically approved system actually provides it;

- guaranteed/risk-free purchase;

- guaranteed Seller safety.

Use factual language about supported Adulis checkout, current availability, Trust evidence and recorded handoffs.

The current versioned launch-disabled zero Adulis Buyer Checkout surcharge belongs to Payments/Checkout. Storefront does not calculate it, create a financial quote or advertise unapproved Seller subscription packaging.

## 189. Correct gateway payment language

### Where payment is explained, use wording such as

Checkout and payment are completed in Adulis through the supported payment gateway for this market.

Where Chapa is the configured provider, the product may accurately say Chapa is used for payment processing.

### Do not say

- legacy direct-transfer wording from the superseded payment model;

- manual seller payment-confirmation wording from the superseded payment model;

- any claim that Adulis/Storefront confirmed payment before canonical provider/backend verification.

Storefront itself never receives card/payment credentials or creates payment truth.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

## 190. Correct purchase language

Use purchase/checkout language rather than the old pre-payment hold model.

### Recommended CTA

Buy in Adulis Continue in Adulis Continue to checkout

The Storefront hands off public Product/Variant context. Mobile/backend create seller-specific Cart/Order/payment workflow and revalidate current commerce truth.

## 191. Fulfilment display

Storefront shows only Seller-supported fulfilment options from canonical Market/Fulfilment configuration: Buyer Collection, Seller Delivery and Courier Delivery where enabled.

Courier Delivery may use approved Private Courier Pools and Cross-Seller Courier relationships. The public page does not assign Couriers, expose Order-specific delivery state, raw checkpoint location or live GPS. Standing relationships do not imply multiple simultaneous active deliveries.

Native Platform Checkout snapshots the chosen fulfilment method and disclosed Courier charge/compensation before payment; Storefront hands off public-safe intent and owns no transaction state.

## 192. Delivery/location display

If the Seller has a physical shop and chose to publish it, Storefront may show structured location data sourced from Seller configuration.

Location must be map-provider data, not a free-text address:

- provider: GOOGLE_MAPS or APPLE_MAPS;

- provider place/reference or canonical map URL;

- latitude/longitude;

- provider-formatted address;

- country/region/locality;

- IANA timezone where available.

Provide Open in Google Maps / Open in Apple Maps when compatible. Human hours/times render in the Seller/Market local timezone; APIs carry absolute instants in UTC.

Courier location evidence is separate private Order/assignment data attempted only at Pickup and Delivery; it has no place in anonymous Storefront rendering. Public structured Seller store location is not a Courier checkpoint or delivery-proof signal.

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

## 193. Storefront public model

### Conceptual public DTO

```
PublicStorefront {
handle
displayName
description
logo
category
availability
publicTrustSnapshot
ratingSummary
publicPhysicalStoreLocation?
fulfilmentSummary
productPosts[]
scenePosts[]
}
```

No private Seller domain object is serialized directly.

## 194. Product Post public model

### Conceptual public DTO

```
PublicProductPost {
slug
name
description
media
approvedSocialEmbed?
category
attributes
variants
pricePresentation
publicAvailability
unavailableReasonPublic?
confirmedAt
sellerSummary
trustSummary
fulfilmentSummary
publicLocationSummary?
}
```

All commerce fields come from canonical Product/Variant/Inventory/Seller domains.

## 195. Scene Post public model

### Conceptual public DTO

```
PublicScenePost {
publicSlug
caption
mediaPresentation
productTags[]
publicationVersion
publishedAt
sellerSummary
}
```

Each productTags entry references a same-Seller Product Post in the current release and composes current availability. A public response never exposes moderation internals.

PublicScenePost response eligibility has already been enforced: current PUBLISHED/PUBLIC, valid same-Seller tags, at least one eligible available Product and every other gate. Each tag composes current Product availability. No Seller-only visibility reason, moderation internals or private caption/media/associations leak.

## 196. Stable content versions

Stable public Product Post/Scene Post identities survive ordinary content edits through domain versioning/redirect policy. Where published revisions are retained for evidence/analytics, historical attribution points to the exact version seen.

Current public reads always compose current Product/Inventory truth rather than copying stale price/stock into old Scene Post revisions.

## 197. Recommended data-flow

### SELLER CONSOLE

Valkey/BullMQ support cache/async work only; PostgreSQL/domain owners remain authoritative.

![Public web browses / native app transacts](graphics/STOREFRONT_05.svg)
*Figure 05. Public web browses / native app transacts. Storefront renders eligible public projections, keeps stable links, and hands intent to Mobile; backend revalidates commerce.*

## 198. Storefront invariants

STOREFRONT-INV-01 Ordinary Storefront browsing is anonymous. STOREFRONT-INV-02 Storefront has no Seller Console/Operator session authority. STOREFRONT-INV-03 No internal UUID appears in public URLs. STOREFRONT-INV-04 Seller handle is stable public identity with redirect history. STOREFRONT-INV-05 Product Posts use seller-scoped public slugs. STOREFRONT-INV-06 Scene Posts use public-safe identities. STOREFRONT-INV-07 Storefront never owns Product/Inventory/Trust/Payment/Order truth. STOREFRONT-INV-08 Every current Scene Post references >=1 valid Product Post. STOREFRONT-INV-09 Current Scene Post tags are same-Seller only. STOREFRONT-INV-10 Storefront cache never authorizes checkout. STOREFRONT-INV-11 Public web creates no Cart, Order or payment attempt. STOREFRONT-INV-12 Gateway payment truth is backend/provider verified. STOREFRONT-INV-13 No seller-controlled ordering hierarchy in current release. STOREFRONT-INV-14 No generic Adulis social comments; Reviews require purchase eligibility. STOREFRONT-INV-15 TikTok/Instagram embeds appear only on Product Post Detail and load on user action. STOREFRONT-INV-16 Wide desktop is a phone-continuation surface, not a dedicated Storefront version. STOREFRONT-INV-17 Public physical-store location is structured Google Maps/Apple Maps data. STOREFRONT-INV-18 API instants are UTC; human time uses relevant Market/local timezone. STOREFRONT-INV-19 Valkey is the only cache datastore name. STOREFRONT-INV-20 Company Website is in separate adulis-web repo; Storefront stays in adulis-platform.

- STOREFRONT-INV-21 - Scene PUBLIC requires at least one eligible available same-Seller tag; zero-tag/all-unavailable initial publication never appears publicly.

- STOREFRONT-INV-22 - Last available tag loss sets PUBLISHED/PRIVATE, suppressing all public payload/SEO/cache resolution; it does not archive the Scene.

- STOREFRONT-INV-23 - Restock triggers backend gated automatic PUBLIC restoration; independent restrictions prevent it.

- STOREFRONT-INV-24 - Current visibility overrides stale projection/CDN/Collection membership; invalidation, bounded TTL and reconciliation support delivery.

- STOREFRONT-INV-25 - Scene launch media is image-only; social-video embed is Product Post Detail only.

- STOREFRONT-INV-26 - Trust labels are NEW/REBUILDING/ESTABLISHED/TRUSTED; no Product-count cap or Adulis Government-ID implication.

- STOREFRONT-INV-27 - Local Search is Seller-scoped Products/PUBLIC Scenes; separate Marketplace Search also includes Sellers.

## 199. MVP scope

### Launch Storefront includes

- Seller profile/identity/Trust/availability;

- public physical-store map location when configured;

- Product Post catalogue + Product Post Detail;

- Scene Post list + Detail with mandatory same-Seller Product tags;

- current availability / Currently unavailable behavior;

- seller-scoped Search;

- published Reviews (read-only on web);

- fulfilment summary;

- canonical public sharing for Seller/Product/Scene links;

- social caption/comment and bio-link landing;

- app deep links and Buy/Continue in Adulis handoff;

- Product Post-only click-to-load TikTok/Instagram embeds;

- global market/locale-ready rendering;

- SEO, Cloudflare CDN caching and first-party analytics;

- phone-first UI with desktop phone-continuation.

No public checkout/payment execution exists on Storefront.

Launch includes PUBLIC Scene availability/private/restoration gating, visibility-aware CDN/SEO invalidation and Product/whole-Scene Save handoff to platform-owned private Collections. Private Scenes are never rendered publicly.

## 200. Can follow shortly after launch

### Can follow in a later product update based on evidence

- richer seller merchandising / manual ordering hierarchy;

- seller-curated collections;

- richer filters and Review filtering;

- additional locale/market UX;

- richer Scene Post formats;

- future recommendation enrichment after product/data coverage is sufficient;

- creator/affiliate tagging if separately approved;

- improved deferred app-link continuity.

## 201. Explicitly deferred

### Explicitly deferred from current Storefront

- web Buyer account;

- web Cart/checkout/payment submission;

- web Buyer chat;

- web Claims;

- web Review creation;

- web Collections account;

- Seller Console functions;

- live Inventory WebSockets;

- public Seller directory;

- seller-to-seller comparison;

- seller-controlled Product/Post ordering hierarchy;

- cross-Seller product tags in Scene Posts;

- generic social comments;

- recommendation-enrichment modules;

- dedicated desktop Storefront UX;

- native TikTok-grade video feed.

## 202. Production launch gates

### Do not launch until

- seller/Product/Scene URLs contain no internal IDs;

- handle/slug uniqueness and redirects pass;

- Seller, Product Post and Scene Post pages server-render;

- 360px Android/iPhone social-browser flows are usable;

- wide desktop leads to phone without exposing broken full Storefront UI;

- global locale/market fallback is safe;

- Trust comes from canonical projection;

- Product availability/freshness and Currently unavailable behavior are correct;

- same-Seller Scene tag invariant is enforced;

- no seller-controlled ordering hierarchy is exposed;

- Buy/Continue in Adulis deep-link/install flow works;

- Storefront creates no Cart/Order/payment state;

- gateway/provider copy is accurate;

- Cloudflare cache keys never cross seller/market/locale boundaries;

- moderation removal invalidates public cache;

- Seller/Review text cannot execute script/HTML;

- CSP/security headers pass;

- no sensitive cookie/session exists;

- seller search remains seller-scoped;

- R2/CDN/Sharp media derivatives are correct;

- Product Post social embed is click-to-load and limited to approved origins;

- social bio/caption/comment landing is tested;

- physical-store map links use structured provider data;

- Playwright/Jest/Testcontainers/k6/security checks pass;

- Sentry/Pino/pg_stat_statements and Valkey/BullMQ health signals are wired.

Zero-tag/all-OOS rejection, partial stock loss, last-stock PRIVATE suppression, safe direct links, stale CDN denial, automatic gated restoration, private sitemap/index removal, four Trust labels, narrow Seller-verification copy and image-only Scene placement all pass. Stable /post URLs and app associations remain valid.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 203. Final architecture

### INTERNET / SOCIAL / SEARCH

-> generated OpenAPI TypeScript client -> api.adulis.<tld> NestJS + Fastify -> Public Read Composition - Seller / Trust / Reviews

- Catalogue / Product Posts / Inventory

- Content / Scene Posts / Media

- Fulfilment / public structured location

### Public buyer path

Seller bio OR Product/Scene social link -> Storefront -> Product Post -> Buy/Continue in Adulis -> Mobile multi-cart/seller checkout -> Payment domain/provider adapter (Chapa where configured) -> paid Order -> fulfilment/Handoff/Review.

### Repository boundary

adulis-platform/apps/storefront is the Storefront runtime. adulis-web is the separate Company Website repository.

![Public web browses / native app transacts](graphics/STOREFRONT_06.svg)
*Figure 06. Public web browses / native app transacts. Storefront renders eligible public projections, keeps stable links, and hands intent to Mobile; backend revalidates commerce.*

## 204. Final system philosophy

The Storefront should feel like a real seller commerce destination without pretending to be the transaction engine.

PRODUCT POST creates understanding of exactly what is sold. SCENE POST creates desire, education and merchandising around seller-owned products. STOREFRONT creates seller confidence, catalogue depth and shareable social landing. MOBILE APP creates authenticated Cart/Checkout, gateway payment, Order, delivery state, Handoff, Claims and Review actions. BACKEND DOMAINS create canonical commerce truth.

The Storefront is deliberately rich in Product Posts, Scene Posts, seller identity, Trust, verified Reviews, availability, fulfilment and public location - and deliberately thin in authentication, transaction state, payment credentials and client-side business logic.

That boundary lets sellers convert TikTok/Instagram attention into structured Adulis commerce while keeping payment, Inventory, Orders and physical handoff auditable and server-authoritative.

Scene visibility follows current canonical availability and all public gates. Public web renders eligible projections while Seller-only management keeps private content/reasons. Stable links and SEO survive terminology migration and gated restoration without creating transaction or visibility authority in Storefront.

## 205. Glossary

| Term | Definition |
| --- | --- |
| Anonymous Browsing | Public Storefront reading without Buyer login; account-bound actions continue through Platform/Mobile. |
| Canonical URL | Stable public entity URL used for sharing/SEO with redirects for permitted handle/slug changes. |
| CDN | Edge cache/delivery layer for public pages/assets; never authorization or commerce truth. |
| Checkpoint Location | Private order-scoped Pickup/Delivery evidence, excluded from anonymous Storefront rendering. |
| FYP | Cross-Seller Scene-only For You discovery; its ranking does not order this Seller Storefront. |
| Product Post | Structured representation of one sellable Product; current commerce fields are canonical backend data. |
| Public Read Model | Bounded rebuildable projection with public eligibility enforced before response; no private domain serialization. |
| Private | Seller-only Scene visibility; public URLs disclose no Scene image, caption or Product associations. |
| Public | Scene visibility eligible for anonymous delivery after current tags, availability and every other gate pass. |
| Scene Post | Seller-authored image-led content with eligible same-Seller Product tags; no price/stock authority. |
| Seller Storefront | Seller-scoped public browsing/share site on a separate origin; transactions continue in Adulis. |
| Seller Handle | Public Seller identifier with uniqueness and redirect history, independent of immutable internal identity. |
| Slug | Public-safe Seller-scoped Product/Scene identifier used instead of internal UUIDs. |
| Trust Ladder | Evidence-derived NEW, REBUILDING, ESTABLISHED, TRUSTED labels consumed from Trust public projections. |
| REBUILDING | Formerly promoted Seller working back toward Established; distinct from NEW. |
| Universal Link / App Link | Verified public URL association opening the exact authorized native entity when installed. |
| Visibility | Scene PUBLIC/PRIVATE dimension; last available tag loss makes a published Scene private without archival. |
| Storefront Search | Seller-scoped public Product and Scene search; private Scenes are excluded. |
| Marketplace Search | Separate launch search across Product Posts, Sellers and PUBLIC Scene Posts. |
| Shoppable Post | Superseded term for Scene Post. |

## 206. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-01 — Buyer-facing Product / Scene terminology | The 13 October designs use Product Post and Scene Post as canonical domain names. | Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly. | PR-001 / PR-005, 26-27 Oct 2026 |
| R-02 — Scene publication and all-unavailable lifecycle | The 13 October pack already requires a legitimate same-Seller Product relationship and at least one currently available tagged Product at public publication. | Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product. Zero-tag or all-unavailable initial publication is rejected. A published Scene stays public while at least one tagged Product remains available. If the last available tagged Product becomes unavailable, the Scene remains PUBLISHED but effective Buyer visibility becomes PRIVATE across FYP, Following, Nearby, Search, Buyer Seller profile, public Storefront and Buyer-facing Collection/direct resolution. Seller/Operator views retain it with Private state. Restoration of at least one eligible Product automatically re-evaluates and may restore PUBLIC without republishing. | Founder rule + PR-004 reconciliation |
| R-08 — Review presentation and write eligibility | The 13 October Reviews design separates Product Quality and Seller Service and defines evidence-based eligibility. | Anyone may read Reviews. Product Reviews expose Product Review and Seller Review. Scene Reviews expose one Product tab per distinct tagged Product plus Seller Review. Write/Edit controls appear only when authoritative Review eligibility exists; ineligible viewers see no composer. Product Quality and Seller Service remain separate. One active Product Review and one active Seller Review are maintained per qualifying entitlement; edit updates instead of duplicating. Sellers cannot edit/delete legitimate Buyer Reviews; Report Review is a moderation utility. The prototype’s completed-order path does not silently remove the 13 October design’s VERIFIED_ORDER_FAILURE Seller-service basis; that failure basis remains valid unless a later founder decision explicitly removes it. | PR-005, 27 Oct 2026 |
| R-09 — Seller profile and Storefront information architecture | The 13 October designs define Seller profile/Storefront content but not the final shared tab order. | Buyer Seller profile and standalone public Storefront share Scenes / Products / Reviews / About and open on Scenes. Scenes show the Seller’s Buyer-public eligible Scenes. Products show the catalogue with available first. Reviews is Seller Service; Product Quality remains on Product. About includes description, Trust facts, category, neighborhood/operating area, fulfilment, member since and social accounts. Collection point appears only where Buyer Collection is offered. Header actions are Follow and Message; the public Storefront hands these actions into the app. Trust is information, not a button. | PR-002, 26 Oct 2026 |
| R-16 — Company Website public-copy refinements | The 13 October Website/Finance designs already hold the corrected launch financial model. | Public Website copy must not promise a 0.5% Adulis transaction fee. It uses Buyer-facing Product/Scene language and shared authoritative report/deletion policy. Removing decorative warning/report icons must not remove role=status/role=alert semantics. Seller public location copy must not imply a mandatory physical storefront when only operating area/collection point is available. | PR-001 + Oct 15 corrections |
| R-17 — Theme and appearance architecture | The 13 October pack contains shared design tokens; final brand palette is not contract-closed. | Production clients use semantic theme roles with Light, Dark and System plumbing so palette changes are centralized. Theme Lab (Baseline plus ten candidates) is prototype evaluation tooling only and must not ship as production theme choices. No candidate palette is canonical until founder approval. Operational status colors remain semantic and independent from brand palette. | Theme Lab + WO-001, 27 Oct / 8 Nov 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.

### Open / deferred items

• Final production brand palette remains open; semantic theme architecture is required, Theme Lab candidates are not canonical.
