# Adulis Mobile App
Version 4.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v4.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v4.1 dated 12 October 2026. Selected repairs in this document: R01. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 4.0 reviewed 8 October 2026 -> 4.1 amended 12 October 2026. -> 4.2 contract-corrected 13 October 2026 -> 4.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-MOB-02_Adulis_Mobile_App_System_Design_v4.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. System definition

Adulis Mobile is one native application, one ordinary Account system and one distributed binary with three eligibility/relationship contexts: BUYER MODE, SELLER COMPANION and COURIER MODE.

Buyer Mode discovers PUBLIC Scenes/Products, uses mixed Collections and seller-specific Cart/Checkout/Orders, and supports Handoff, Reviews, Claims and Chat. Seller Companion handles role-permitted monitoring, communication, response and urgent operations. Courier Mode handles approved relationships/offers, one active delivery, connected Handoffs and checkpoint evidence.

An Account may be Buyer, own Sellers, hold one Seller TEAM membership and have multiple Courier relationships simultaneously where eligible. These are contexts around one ordinary Account, not separate ordinary identities.

Operator is not a fourth public mode. Operator Account is a separate internal privileged principal provisioned only after hiring/authorization; Mobile cannot create it, request access or switch into it.

![One ordinary Account / three contexts](graphics/MOB_01.svg)
*Figure 01. One ordinary Account / three contexts. Buyer, Seller Companion and Courier contexts are eligibility-bound; Operator is a separate internal privileged identity.*

## 2. Core mobile principle

The Mobile App is a client of Adulis domain systems. It displays server-owned state and sends user intent; it does not recreate business authority on-device.

The app does not calculate recommendation rank, Trust Level, product eligibility, stock authority, payment success, legal Order transitions, Courier assignment legality, Handoff acceptance, review eligibility or Seller permissions. PostgreSQL-backed domain logic remains authoritative. Valkey, client caches and device state are never alternate business truth.

## 3. Current product direction

Current mobile architecture is global-ready, commerce-first and algorithmic.

Buyer Home is the primary discovery container with For You (default), Following, Nearby, Discounts and Market-configured Locally Made tabs. For You contains Scene Posts only. A Scene Post is canonical Seller-authored image-led content with at least one eligible same-Seller Product Post tag and at least one currently available tagged Product for public visibility. Product Posts remain the canonical commerce object and appear in Search, Shop, Seller profiles/storefronts, direct links and Explore This Scene - never as FYP feed units.

Checkout uses a payment-gateway architecture with Chapa as the initial provider integration. The old pre-payment hold/direct-transfer/manual-confirmation flow is superseded.

The Company Website is a separate adulis-web repository; this Mobile App remains part of the main Adulis platform product family.

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

## 4. Primary buyer loop

Open Adulis

```
-> Home / For You: Scene Post
-> open tagged Product Post
-> choose Variant / quantity
-> add to seller-specific cart
-> continue discovery and add from other Sellers
-> combined checkout summary
-> pay each Seller Order sequentially through the gateway
-> Seller receives verified paid-order notification
-> Seller prepares and assigns Courier
-> Seller-to-Courier Pickup Handoff
-> delivery state and exception progress
-> Courier-to-Buyer / authorized delegate Delivery Handoff
-> completed Order
-> verified-purchase Review / Claim
-> return to discovery
```

The checkout screen may coordinate multiple Seller carts, but it never creates one cross-Seller Order or one cross-Seller custody record.

![Discovery to verified receipt](graphics/MOB_02.svg)
*Figure 02. Discovery to verified receipt. Every Checkout/payment/Order remains Seller-specific; final receipt is verified by the Buyer or authorized delegate.*

## 5. High-level architecture

MOBILE APP - React Native + Expo

There is no mobile-specific backend and no mobile BFF at launch. Mobile consumes the same domain APIs as other authorized Adulis surfaces.

![Shared canonical Platform architecture](graphics/MOB_03.svg)
*Figure 03. Shared canonical Platform architecture. Clients express intent through typed APIs; domains authorize and decide, PostgreSQL persists truth, and workers build projections.*

## 6. Technology baseline and mobile impact

Canonical implementation stack:

Backend: Node.js; NestJS; Fastify; strict TypeScript; Drizzle ORM; PostgreSQL. PostgreSQL extensions: pg_trgm for search support, btree_gist for exclusion/range constraints where required,

pg_stat_statements for query visibility. Async/cache: Valkey; BullMQ. API: REST; OpenAPI; @nestjs/swagger; generated TypeScript client. Security: @nestjs/throttler; @fastify/helmet; libphonenumber-js. Media: Cloudflare R2; Cloudflare CDN; Sharp. Mobile: React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; Expo SecureStore; Expo SQLite; Expo Camera; Expo Notifications; Expo Updates; a small Zustand store. Quality: Jest; Testcontainers; Maestro; Playwright; k6. Observability: Sentry; Pino structured logs; pg_stat_statements. Architecture control: dependency-cruiser. Delivery: Docker; GitHub Actions; Render; Cloudflare; EAS.

Courier checkpoint evidence may use expo-location for foreground/on-demand PICKUP and DELIVERY attempts when available/allowed. No background-location permission, expo-task-manager tracking requirement or live-route map package is needed for MVP. This does not change canonical business ownership.

Impact by layer: Expo Router separates Buyer/Seller/Courier route groups; TanStack Query owns server-state fetch/refetch; FlashList virtualizes the Scene-Post FYP; Expo Image delivers CDN derivatives; SecureStore protects session/device secrets; SQLite is limited to local technical state such as bounded analytics batching and crash-safe retry metadata, not disconnected commerce; Camera drives QR verification; Notifications delivers order/courier/review-reminder events; Updates provides bounded OTA delivery. Valkey/BullMQ power non-canonical caching and background jobs on the backend.

## 7. Why React Native + Expo

The choice is particularly strong for Adulis because it gives:

```
one language
one mobile codebase
one API contract
one store architecture
one Seller Companion
```

while still providing native access to:

• camera;

• push;

• secure credential storage;

• deep links;

• app updates.

The previous mobile design also correctly rejected maintaining separate Swift and Android implementations for the current small engineering team.

## 8. Development build

Development should use:

Expo Development Builds

rather than depending on Expo Go.

Native behavior that must be tested includes:

• push;

• secure storage;

• camera;

• App Links;

• Universal Links;

• native configuration;

• signing identities.

The existing mobile specification explicitly requires a development build because Expo Go does not reproduce several of these production conditions.

## 9. Application modes

Mode is an authorization context, not a second login.

BUYER MODE is available to the Account as a customer experience. SELLER COMPANION appears only when the Account has an active Seller relationship and surface permission. COURIER MODE appears only when the Account has Courier capability and/or current assignments.

Switching modes must clear or namespace seller/courier-scoped query caches so one context can never leak data into another.

Operator Account is separate internal privileged identity and never appears as a Mobile mode, self-enabled capability or ordinary Account role. Buyer/Seller/Courier contexts share ordinary session identity while every action is reauthorized.

## 10. Authentication does not change mode

One authenticated Account session can expose several relationship contexts. Changing Buyer, Seller Companion or Courier Mode does not issue a new identity. The backend derives effective permissions from Account + relationship + Market + surface + resource scope.

A client-provided mode is never authority. The server revalidates every Seller or Courier action against the authenticated Account and current relationship state.

## 11. Buyer navigation

Buyer bottom navigation: Home | Shop | Saved | Orders | You.

Home is the primary discovery container. Its launch tabs are For You (default), Following, Nearby, Discounts and Locally Made. For You is image/photo-led Scene Posts only; Product Posts are never top-level FYP units. Following is followed-Seller discovery; Nearby is permission/Market controlled; Discounts uses eligible offers; Locally Made wording and eligibility are Market-configured/localized.

Shop supports intentional Product/category discovery and Marketplace Search. Saved contains private mixed Product/whole-Scene Collections. Orders contains separate Seller Orders even when coordinated by one multi-cart Checkout. You contains Account/settings and eligible ordinary-mode switching.

Guest Orders: Sign in to start ordering and track your orders.

Guest You: Sign in to see your profile.

Do not fabricate authenticated Order/Profile objects for guests. Public discovery browsing remains anonymous according to Auth policy.

![Buyer Home discovery container](graphics/MOB_04.svg)
*Figure 04. Buyer Home discovery container. For You is the default Scene-only tab; other tabs and labels use current Market configuration.*

## 12. Why five tabs

Five tabs keep the primary Buyer jobs legible on small screens: discover, intentionally shop, revisit, manage purchases and manage identity. Courier and Seller navigation are separate mode-specific shells rather than extra Buyer tabs.

## 13. Buyer route tree

### Buyer routes

```
(buyer)/home/{for-you,following,nearby,discounts,locally-made}
```

```
(buyer)/shop | search | product/[productRef] | scenes/[scenePostRef]
```

```
(buyer)/seller/[sellerRef] | saved | carts | checkout/[checkoutSessionRef]
```

```
(buyer)/orders/[orderRef] | delivery/[orderRef] | handoff/[orderRef]
```

```
(buyer)/reviews/[orderLineRef] | claims/[orderRef] | chat/[conversationRef]
```

```
(buyer)/notifications | account/*
```

Scene Post Detail / Scene Explorer are presentations of one canonical Scene Post, not separate content entities or duplicate routes/IDs. Migrate old content route aliases through stable public-link resolution/redirects.

Authenticated routes re-check session, relationships and resource scope. Public Scene routes require current PUBLIC visibility and at least one available eligible tagged Product; cached routes cannot bypass a private response.

## 14. FYP

The Buyer FYP is a commerce-discovery feed of Scene Posts only.

Hard invariant: Product Posts are never FYP feed units. Product Posts are reached through tagged-product interactions, Search, Shop, Seller profile/storefront, direct links or Explore This Scene.

A Scene Post is eligible only when it has at least one valid, materially relevant product relationship and passes Seller, Market, Moderation, Media and commerce eligibility. Ranking remains multi-objective: engagement matters, but product interaction, downstream checkout/order quality and negative outcomes matter too.

Every Buyer-facing Scene needs publication_state=PUBLISHED, visibility=PUBLIC, at least one eligible currently available same-Seller tagged Product and passing Seller/Market/Media/Moderation gates. Zero-tag/all-unavailable publication is rejected by backend Content. Mobile consumes that truth; it cannot publish or restore Scenes.

## 15. FYP API

```
GET /v1/fyp returns typed ScenePostFeedUnit objects only for the current mobile contract.
```

Each unit should include stable Scene Post/revision identity, Seller public summary, approved media presentation, product-tag summaries, impression identity, algorithm version and allowed engagement actions. Current product price/stock must not be duplicated as permanent Scene Post truth; product-tag cards resolve current canonical commerce data.

## 16. FYP client state

Keep feed-session cursor, loaded pages, visible impression IDs, scroll anchor and bounded prefetch state. Do not keep canonical product availability or payment/order truth in FYP local state. On material interaction, re-read the owning resource.

## 17. FYP does not download everything

The FYP fetches bounded Scene Post units and appropriately sized media derivatives. Product detail, full Seller profile, checkout data, embedded social video and full review history load only when the Buyer opens those resources.

## 18. Feed virtualization

Use FlashList for long Scene-Post sessions. Stable keys are post/revision identities. Recycle heavy media views, cancel requests for items far outside the viewport and prefetch only a small forward window. Measure blank-area/render latency on low-end Android devices.

## 19. FYP unit registry

Current FYP registry is intentionally narrow:

FeedUnitRenderer

```
`-- ScenePostRenderer
```

Product cards may appear inside an opened Scene Post or Scene Explorer, but are not top-level FYP units. Unknown future feed unit types must fail gracefully and remain capability-gated.

## 20. Client capability negotiation

Server feed contracts are version-aware. A new mandatory Scene Post presentation or interaction requires minimum client capability and a safe fallback before rollout. Feature flags control exposure, never authorization or commerce legality.

## 21. FYP media model

Current launch FYP/Scene media is Adulis-hosted image/photo content optimized for image-led browsing. Native Seller video upload/transcoding is not a launch capability.

Approved TikTok/Instagram social-video embeds are Product Post Detail only, inside the restricted approved WebView boundary. They never appear on FYP, Scene Detail/cards or Seller profile.

A future explicitly approved media capability can evolve behind version/capability gates without changing Product Post commerce ownership.

## 22. Scene Post and Buyer visibility

Scene Post is the canonical Seller-authored image-led commerce/discovery object with one or more eligible same-Seller Product Post tags. Outfit, setup, routine, comparison and demonstration are presentation patterns, not separate formal entities.

Buyer sees the Scene image and can reveal tags or open Scene Post Detail / Scene Explorer. The Scene never owns canonical price, stock, Variants or payment state.

Mobile may render only current PUBLIC Scenes with at least one available eligible tagged Product. When the last available Product becomes unavailable, backend Content keeps PUBLISHED but makes the Scene PRIVATE. It disappears from FYP, Search, Storefront, Buyer profile, direct public links and Collections.

At least one eligible Product restocked -> backend rechecks all public gates -> automatic PUBLIC restoration if valid. Archive/removal, moderation, Seller suspension, Market or independent restrictions prevent restoration. Mobile consumes refreshed projections and never orchestrates this lifecycle.

![Current eligibility runs before every new controlled Scene delivery](graphics/MOB_05.svg)
*Figure 05. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 23. FYP product-tag density

Do not cover the Scene Post with commerce chrome. Show a small number of clear product-tag affordances on the feed card and expose the complete tagged-product list after interaction. Accessibility must provide a non-visual equivalent for every tag.

## 24. Scene Explorer

Canonical route: /scenes/:scenePostRef. Scene Post Detail / Scene Explorer is a presentation of the same Scene Post.

Regions: primary image, caption, Product hotspots and accessible tag list, In This Scene, Seller/Trust context and eligible related PUBLIC Scenes. Products resolve current Catalogue/Inventory price, Variant and availability truth; all current MVP tags are same-Seller.

On visibility change or stale eligibility, re-read canonical state. A PRIVATE/restricted response clears stale media/caption/tags and shows a safe content-unavailable response with navigation out. Never continue rendering stale purchasable content while refreshing.

Public links and every Buyer surface apply the same current visibility gate.

## 25. Scene API

```
Use bounded resources such as GET /v1/scene-posts/:id and GET /v1/scene-posts/:id/products. Mobile does not
request disabled recommendation modules. Scene payloads carry exact revision identity for
analytics and moderation provenance.
```

The Scene contract is one canonical content resource; transitional endpoint aliases map to the same ID/version and enforce PUBLIC/availability before returning media/caption/tags. Backend mutations remain outside Buyer APIs.

## 26. Hotspot coordinates

Scene hotspots use normalized coordinates:

```
x ∈ [0,1]
y ∈ [0,1]
```

Never hard-coded pixel coordinates.

Mobile must map the normalized location against the actual rendered image rectangle.

This must account for:

• cover cropping;

• contain;

• different aspect ratios;

• 360px phones;

• tablets.

The current engineering manual explicitly requires unit tests for this geometry.

## 27. Hotspot accessibility

A hotspot must announce:

```
Black leather handbag. Open product.
```

not:

```
Button.
```

and certainly not:

```
x 0.74 y 0.42.
```

## 28. In This Scene

Displays canonical products explicitly tagged in the Scene.

Each product card includes:

• image;

• name;

• current canonical price;

• seller;

• availability indicator;

• trust information where appropriate.

## 29. Product Post discovery surfaces

Product Posts are canonical commerce pages and are discoverable through Shop, Search, Seller profile/storefront, tagged-product interactions, direct links and Explore This Scene. They are deliberately excluded from the FYP to keep For You focused on creative Scene Posts within the Home container.

## 30. Related discovery policy

Current mobile discovery after opening a Scene Post or Product Post may use same-Seller related content, category navigation, Search and Shop. Data-intensive recommendation modules that are not currently approved must not appear as active UI or API dependencies.

## 31. Multi-cart preserves seller-specific Orders

Buyers may shop across Sellers in one session, but payment, fulfilment, Handoff and Claims remain seller-specific.

One checkout session may contain Seller A cart + Seller B cart + Seller C cart. The platform creates separate Seller Orders and separate gateway payment attempts. There is no cross-Seller Order, no shared payment fact and no merged delivery proof.

## 32. Shop

The Shop tab serves buyers who arrive with explicit intent rather than wanting algorithmic discovery.

It contains:

```
Search
Categories
Fashion
Cosmetics
Electronics
Nearby
New Drops
Market-configured Locally Made
Price-led modules
```

according to enabled configuration.

## 33. Search

Search should distinguish:

```
Products
Sellers
Scenes
```

Results should carry explicit result type.

PostgreSQL search is sufficient for MVP if measured relevance and latency are acceptable.

Do not add Elasticsearch/OpenSearch merely because marketplace search exists.

Launch result types are PRODUCT_POST, SELLER and SCENE_POST. User categories may be Top, Products, Scenes/Posts and Sellers according to current UX wording. PUBLIC Scene Search is MVP; current visibility and availability gates precede result rendering.

## 34. Search suggestions

Start simple:

```
Recent searches  -  local client presentation state if privacy-approved
Popular queries  -  server aggregate
Categories
Seller matches
```

Do not implement complex predictive typeahead before basic search quality is measured.

## 35. Search telemetry

Record:

```
query
filters
result type
```

```
result count bucket
clicked result context
```

through first-party analytics.

Do not log sensitive user text indiscriminately.

Search query retention policy should be explicit.

## 36. Nearby and market-aware discovery

Nearby is optional and Market-configured. It may use coarse Buyer location only after explicit permission and only where local marketplace policy supports it. A worldwide launch does not mean every Market enables identical Nearby behavior.

## 37. Location permissions

Buyer Nearby may request foreground Buyer location when the feature needs it and policy permits. Courier Delivery separately attempts on-demand foreground location only at PICKUP and DELIVERY checkpoints. Neither purpose requires Courier background-location permission in MVP.

Seller physical-store location is structured Seller-supplied map-provider data, not inferred from Buyer/Courier location. Keep purposes, permissions, retention and presentation separate.

A denied/unavailable/timed-out/low-accuracy/error Courier checkpoint does not invalidate an otherwise valid connected QR/OTP/Manual Handoff. Precise evidence is private and not a broad Buyer/Seller map.

## 38. Market collections

Curated country/market collections are configuration-driven. Locally Made may be localized for a specific Market without hard-coding a country-specific label as the universal product term. Global Buyer UI receives enabled collections from Market configuration.

## 39. Saved

Saved is a first-class Buyer destination for private Collections, recent saves, saved Product Posts and saved whole Scene Posts. Whole-Scene saves are first-class, not optional Product-only attribution.

Anonymous browsing is allowed on public discovery surfaces, but durable server-side saves/Collections require authentication. An anonymous Save action leads to the approved sign-in/app continuation without fabricating account-bound membership.

## 40. Collections

A private authenticated Buyer Collection contains Product Posts and whole Scene Posts as first-class typed items. Buyers can create, rename, delete/open Collections, and add/remove either type.

Use stable target_type (PRODUCT_POST or SCENE_POST) + target_id, bounded attribution and revision provenance where appropriate. Membership writes are idempotent and unique per Collection/target; Collection state does not freeze price/stock or reserve Inventory.

PRIVATE/restricted Scene membership may remain internally so restoration can make it visible again. Buyer reads must suppress its media, caption and Product associations everywhere; Collection membership never authorizes private content. Automatically restored PUBLIC Scenes become eligible for fresh rendering.

Collections do not own Scene lifecycle, commerce truth or Cart quantity semantics.

![Private mixed Buyer Collections](graphics/MOB_06.svg)
*Figure 06. Private mixed Buyer Collections. Product and whole-Scene targets are first-class; retained private Scene membership never reveals private content.*

## 41. Originating Scene Post

When a Buyer saves or buys a product reached from a Scene Post, retain bounded attribution such as source post/revision, product-tag identity, impression ID and algorithm version. Attribution measures discovery; it never changes commerce validity.

A direct whole-Scene save stores the stable Scene target and appropriate revision/attribution provenance. Product-origin attribution and whole-Scene Collection membership are separate concepts; neither bypasses current public visibility.

## 42. Save versus multi-cart

Save is long-lived Buyer intent. Cart is seller-scoped purchase intent.

A Buyer can save individual Product Posts and whole eligible PUBLIC Scene Posts across Sellers in private authenticated Collections. Adding to cart places the line into that Seller's cart inside the multi-cart container; it does not overwrite another Seller's cart.

## 43. Seller Storefront

The mobile Seller profile/storefront exposes Seller identity, Trust/public reliability, Product Posts, Scene Posts, fulfilment information, reviews and allowed Buyer actions.

If the Seller has a physical store, the profile may show a structured Google Maps or Apple Maps location object and an "Open in Maps" action. Do not treat a free-text address as canonical map location data.

External social embeds do not render on the Seller profile.

Only PUBLIC Scenes with current eligibility render. Storefront/FYP/Search/Collection/direct-link reads share the same visibility boundary. Trust names are NEW, REBUILDING, ESTABLISHED and TRUSTED; no Trust level caps Product count.

## 44. Product Post detail

Product Post Detail concentrates canonical commerce truth:

Media; product name; current Variant price; availability; stock context; Seller; Trust; description; attributes/specifications; fulfilment; Save; Add to cart; verified-purchase Reviews; and approved external social video embed.

Product Posts may be reached from Search, Shop, Seller profile, tagged Scene Posts or Scene Explorer. They are not FYP units.

Before add-to-cart and checkout, re-read material availability from the server.

## 45. Product media

Request derivative according to UI role.

```
Grid -> thumbnail
FYP -> feed card
Scene -> scene explorer
Product detail -> bounded full
```

Do not download product-detail media for every FYP card.

The current media architecture defines controlled derivative roles for exactly these contexts.

## 46. Image cache

Only public media may use normal disk caching.

Authenticated/sensitive data must never enter the image cache.

Use expo-image or equivalent with cache strategy matched to asset class.

## 47. Social embeds - Product Post only

Approved TikTok video or Instagram Reels embeds may appear only on the Product Post page for that product.

They must never render in the FYP or Seller profile/storefront. Use click-to-load behavior: show an Adulis-hosted poster/placeholder first, then load the approved origin inside a restricted WebView only after explicit Buyer action. Embedded media never becomes Product truth and never receives Adulis authentication/session secrets.

## 48. WebView boundary

WebView is permitted only for explicitly approved Product Post social embeds. It is prohibited for authentication, Seller Console, Handoff verification, gateway payment authorization, arbitrary browsing or Operator tools. Restrict navigation to approved embed origins and do not inject privileged Adulis JavaScript.

## 49. Verified-purchase Reviews

Adulis does not implement open social-media discussion on products or Scene Posts. The feedback surface is Review.

A Buyer may submit a Product Review only when the backend can prove purchase history for that exact Product/Order line and the required completed Handoff/Order condition is satisfied. The client renders server-provided review eligibility and never fabricates it locally.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 50. Engagement actions

Scene Post actions may include Save, Share, Follow Seller, Not Interested, Report and product-tag interaction. Product Post actions may include Save, Add to cart, Share, Chat and eligible Review. There is no open social discussion action.

## 51. Not Interested

This should be easy to access.

Possible scope:

```
Not interested in this content
See less from this seller
See less from this category
```

but each scope must be explicitly defined by backend policy.

Do not quietly interpret one as another.

## 52. Sharing

Share public entity URLs:

```
Scene
Product
Seller
Collection  -  only if public collections later exist
```

Use canonical Adulis URLs that open:

```
App if installed
Web if not
```

## 53. Deep links

Supported links include Seller, Product Post, Scene Post, Order, delivery progress, Chat, Claim and review-reminder destinations. Public links use Universal Links/App Links. Authenticated resources re-authenticate and re-authorize before display.

A private Scene link never reveals media/caption/tags. Resolve current canonical PUBLIC status on every open, including old aliases/shared links; restoration may make the stable link eligible again after all gates pass.

## 54. Deep-link rule

A deep link never bypasses:

• authentication;

• authorization;

• version floor;

• moderation;

• entity availability.

Deep-link input is untrusted.

Validate all route parameters before using them.

The existing mobile architecture already requires this behavior.

## 55. Back-stack behavior

Discovery context should survive navigation:

```
FYP -> Scene Post -> tagged Product Post -> Seller -> Back
should restore Seller -> Product -> Scene Post -> exact FYP scroll position where practical.
```

Checkout, payment and Handoff screens use explicit transactional return paths rather than relying only on presentation history.

## 56. FYP feed session

A feed session has stable server identity, algorithm version, cursor and impression lineage. Because the current feed contains Scene Posts only, feed analytics must not classify Product Posts as FYP impressions.

## 57. Refresh behavior

Pull-to-refresh:

```
ends current feed session
v
requests new FYP
v
creates new feed session
```

Returning from Product normally preserves the current feed session.

## 58. Impression definition

A Scene Post impression is recorded only after the unit satisfies the configured visibility/time threshold. Product Post impressions are recorded on their own surfaces and must not be mixed with FYP Scene Post metrics.

## 59. Dwell / watch-time equivalent

Measure qualified dwell on image/carousel Scene Posts and watch/completion signals only for approved native media formats if introduced. Dwell/watch time is a ranking signal, not the objective. Product-tag clicks, Product Post opens, checkout starts, paid Orders and downstream quality matter more to commerce effectiveness.

## 60. Analytics batching

Mobile sends privacy-minimized typed analytics in bounded batches. Batch delivery is non-authoritative and must never block discovery, checkout, payment, delivery progress or Handoff. Expo SQLite may hold a bounded technical analytics buffer; no business action is considered completed from that local buffer.

## 61. Analytics buffer

Buffer only approved telemetry fields with stable client_event_id values. Enforce size/age limits, drop low-priority events under pressure and never store Chat bodies, OTPs, payment credentials, precise long-lived Courier routes or sensitive evidence in analytics storage.

## 62. Analytics event priorities

Highest-value mobile measurement includes FYP qualified impression, product-tag interaction, Product Post open, add-to-cart, checkout step, gateway outcome observation, paid-order server fact, delivery progress open, Handoff completion, Review submission and negative feedback. Server-owned payment/Order facts come from backend domain events, not client claims.

## 63. Event attribution

```
Preserve discovery context through Scene Post -> Product Post -> seller cart -> Seller Order.
Each Seller Order can carry the selected attribution snapshot independently even when several
Orders were created from one checkout session.
```

## 64. Event fraud resistance

The client can lie.

Therefore FYP telemetry must not become financial truth.

Where practical, backend should reconcile:

```
impressionId
+
feedSessionId
+
entity
```

against an actually served impression.

But:

analytics remains analytics.

An event never completes an order or changes commission.

## 65. Cold start

Cold start loads bootstrap, session state, Market/localization configuration and the first Scene-Post FYP page. Do not block anonymous discovery on Seller/Courier relationship loading unless the user switches into those modes.

## 66. Interest onboarding

Optional onboarding interests seed Scene-Post recommendation. They do not lock the Buyer into categories and do not replace observed commerce signals. Market availability constrains the selectable taxonomy.

## 67. Anonymous personalization

Anonymous FYP sessions may maintain privacy-bounded affinity until sign-in. Once the Buyer checks out, the backend links eligible attribution according to privacy policy without rewriting historical event identity.

## 68. Device identity

On first launch:

```
generate device ID
v
SecureStore
v
POST /v1/devices
```

Then include:

```
X-Adulis-Device
```

on applicable requests.

The previous mobile design intentionally creates the device before the account so anonymous browsing/cart state can exist.

## 69. Device ID continuity

Do not regenerate the device ID on every:

• launch;

• logout;

• token expiry.

Losing the ID can orphan anonymous cart/measurement state.

## 70. Authentication timing

Anonymous Buyers may browse public Scene Posts, Product Posts and Seller profiles. Authentication is required before account-bound actions such as Cart persistence across devices, Checkout/payment, Chat, Review, Claim, Seller Mode or Courier Mode.

## 71. First-checkout authentication

If an anonymous Buyer begins checkout, authenticate without losing multi-cart state or discovery attribution. After successful OTP/session creation, revalidate every selected cart line before creating Seller Orders or payment attempts.

## 72. Returning user sign-in

Returning users should also have Sign In accessible from:

```
Orders
You
```

without forcing it at launch.

## 73. OTP authority

Adulis:

• generates OTP;

• verifies OTP;

• controls expiry;

• controls attempts;

• issues sessions.

SMS vendors only transport messages.

This is explicit in the current authentication architecture.

## 74. Mobile session

Credential:

```
Authorization: Bearer <opaque-token>
```

Store in:

```
Keychain / Keystore via Expo SecureStore
```

Never:

```
AsyncStorage
```

for the authentication credential.

The existing auth specification explicitly distinguishes mobile secure bearer storage from the Console cookie model.

## 75. Session is stateful

Do not use JWTs as the canonical mobile session merely for convenience.

Immediate server-side revocation is required.

## 76. 401 handling

On:

```
SESSION_REVOKED
SESSION_EXPIRED
```

clear:

```
session token
authenticated query data
```

Keep:

```
device ID
public image cache
anonymous shopping continuity
safe request-reconciliation metadata (no offline Handoff acceptance)
order-creation retry key where valid
```

The previous mobile architecture explicitly requires a session failure not to destroy device identity or safe pending request-reconciliation metadata. There is no offline Handoff acceptance queue.

## 77. Query cache

Use TanStack Query for server state.

No persistent Query cache.

In-memory only.

A four-hour-old disk-cached order can be materially wrong.

## 78. Query keys

Buyer examples:

```
["fyp", deviceId, feedSession]
["scene-post", scenePostRef]
["product", sellerHandle, slug]
["orders", accountId]
```

Seller examples:

```
["seller", sellerId, "orders"]
["seller", sellerId, "notifications"]
```

Seller context must always participate in seller-scoped cache keys.

## 79. Client state

Use a small client-state store only for things the server does not own.

Examples:

```
locale
temporary onboarding state
current mode
current seller selector
connected Handoff attempt UI state
FYP local scroll coordination
dismissed version banner
```

Never mirror:

• order state;

• trust;

• stock;

• prices;

• permissions

into a second client store.

## 80. API client

All network requests flow through one reviewed API module.

The API client injects:

```
Authorization when authenticated
X-Adulis-Device
X-Adulis-Client
X-Adulis-Clock-Offset
Accept-Language
Idempotency-Key where required
X-Adulis-Seller in Seller Companion only
```

The previous mobile architecture used the same centralized-request pattern precisely so screens cannot accidentally omit these controls.

## 81. Generated API contracts

Generate client types from canonical OpenAPI.

Do not maintain a second handwritten mobile API specification.

Routine server changes must remain backward compatible with supported mobile versions.

## 82. Forward-compatible response decoding

Do not use strict response decoders that crash when the server adds a field.

Use:

```
generated type
+
tolerant boundary mapping
+
unknown-field ignore
+
unknown-enum fallback
```

Critical required fields may be checked defensively.

But an additive API response must not brick an old mobile binary.

## 83. Version skew

This is a first-class architecture problem.

Several app versions will exist simultaneously.

Therefore /v1 contracts must support older binaries during their defined support window.

## 84. Bootstrap

```
GET /v1/bootstrap is called on cold start and meaningful foreground return. It returns server
time, Market/country context, locale defaults, feature flags, minimum supported client, enabled
payment/courier capabilities and relationship summaries needed to expose Seller/Courier mode entry
points.
```

API instants are UTC. Human-facing Order/activity times render in the relevant Market/order local timezone with a clear timezone label when ambiguity exists.

## 85. Version floor

Possible statuses:

```
OK
UPGRADE_RECOMMENDED
UPGRADE_REQUIRED
```

Recommended Dismissible banner.

Required Blocking screen.

No:

• push;

• deep link;

• Seller Mode;

• cached screen

may bypass required upgrade.

The previous architecture explicitly treats the version floor as a global bootstrap gate.

## 86. Runtime versus binary version

Because Expo OTA can change JavaScript without changing the native binary:

send both:

```
runtime version
native binary version
```

The server must know what code is actually executing.

## 87. Feature flags

Bootstrap may control Scene Post presentation variants, Nearby, market collections, Courier assignment/checkpoint UI, social-embed support, new payment-provider experiences and Seller/Courier mode rollouts. Flags never bypass authorization, payment truth, inventory truth or Handoff rules.

## 88. Multi-cart container

The Buyer may keep products from multiple Sellers at the same time.

CARTS

```
|-- Seller A cart
```

| Product lines...

```
|-- Seller B cart
```

| Product lines...

```
`-- Seller C cart
Product lines...
```

Each seller cart has its own subtotal, fulfilment choices and validation state. The container is convenience UI, not a cross-Seller transaction aggregate.

## 89. Seller-cart grouping rules

Adding a Product creates or updates the cart belonging to that Product's Seller. Never merge two Sellers into the same cart. Quantity/Variant changes apply only to that Seller cart. Removing one cart does not affect the others.

## 90. Aggregated checkout

Checkout compiles selected Seller carts into one review experience so the Buyer can understand the total shopping session.

The screen shows each Seller section separately and clearly explains that Orders and payments are processed independently. The checkout coordinator may create a checkout_session reference that groups seller-specific Order/payment progress for UX only; it is not an Order and is not financial authority.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 91. Cart truth

Cart lines are intent, not guaranteed inventory. Revalidate current publication, Variant, price, quantity and Seller eligibility when cart opens and again before creating each Seller Order/payment attempt. Never silently substitute or change a line.

## 92. Checkout and Order creation

Flow per selected Seller cart:

```
Product lines -> Review -> Create Seller Order -> create provider payment attempt -> Buyer pays ->
backend verifies provider outcome -> Order becomes PAID.
```

There is no pre-payment hold state. One checkout session may create several Seller Orders. The Buyer then pays those Orders one by one until all selected Seller carts are paid, skipped or failed.

## 93. Order and payment idempotency

Order creation and gateway-attempt creation require idempotency keys. If a response is lost, retry with the same logical request identity and return the existing result. Local retry metadata may be persisted narrowly so process death cannot create duplicate Seller Orders; the app still requires network connectivity to execute the retry.

## 94. Checkout reconciliation

If product truth changes before a Seller Order/payment attempt is created, return all affected lines: currently unavailable, insufficient quantity, price changed, unpublished, Variant withdrawn or Seller unavailable. The Buyer explicitly reviews changes before continuing.

## 95. New-seller disclosure

Where Trust policy requires factual disclosure for a new Seller, show it before payment for that Seller Order. Describe evidence, not accusation. Gateway payment does not make an inexperienced Seller automatically trustworthy; Trust remains evidence-derived.

Enumerated Trust labels are NEW, REBUILDING, ESTABLISHED and TRUSTED. Rebuilding is distinct from New. Display factual evidence and policy-approved requirements; Trust cannot be purchased and does not limit Product count.

## 96. Orders tab

Order buckets may include:

```
Needs action
Active
Completed
Cancelled
```

Buyer sees server-resolved states.

The app does not infer bucket membership.

For an unauthenticated user, render: Sign in to start ordering and track your orders. No empty authenticated Order object is created; sign-in returns to the intended destination after authorization.

## 97. Order Detail

Order Detail contains Seller, Products, current Order state, gateway payment state/reference, fulfilment method, Courier assignment, pickup status, In Delivery/Delivery/exception state, delivery Handoff status, Chat, Claim actions and eligible Review actions.

For multi-cart purchases, provide navigation back to the checkout-session summary showing sibling Seller Orders without implying they are one Order.

Fulfilment mode is the pre-payment Seller Order snapshot. Display Product subtotal, Seller-defined Courier charge/snapshotted compensation, versioned launch-disabled zero Adulis Buyer Checkout surcharge on its configured basis, applicable provider-authorized fee and Buyer total. Mobile renders backend canonical amounts and does not calculate or rewrite them. The configured surcharge basis excludes delivery unless a later approved version includes it.

## 98. Deadlines and local time

The server provides canonical UTC timestamps. Mobile renders deadlines and activity in the relevant Order/Market local timezone and may show relative countdowns for presentation. When a countdown reaches zero, refetch; the client does not locally invent a business-state transition.

## 99. Payment gateway invariant

Buyer payment is processed through an approved payment gateway, with Chapa as the initial provider integration. Mobile never declares payment success because a browser/SDK returned a success-looking screen.

Canonical payment truth comes from the backend Payments domain after verified provider webhook/query/reconciliation. Provider secrets never ship in the app.

## 100. Gateway checkout

For each Seller Order, Mobile requests a backend-created payment attempt and receives only the public/provider handoff data required to continue. The exact provider presentation may use an approved external/native flow, but Adulis authentication secrets and payment-provider private credentials remain server-side.

Checkout shows the complete canonical quote before provider handoff, including disclosed Courier compensation/delivery charge and configured surcharge. Each Seller Order retains its own quote, payment and fulfilment snapshot.

## 101. Sequential multi-seller payments

A multi-cart checkout may require several payments:

```
Seller A Order -> pay -> verify
Seller B Order -> pay -> verify
Seller C Order -> pay -> verify
```

The checkout-session summary shows PAID / PAYMENT_PENDING / FAILED / NOT_STARTED per Seller Order. A failure for one Seller must not roll back already paid Orders for another Seller.

## 102. Returning from payment provider

On foreground return or payment deep link, re-read payment attempt and Order state from the backend. Do not trust query parameters, browser history or client callbacks as final payment authority.

## 103. Payment-status reconciliation

If the provider result is delayed or ambiguous, show a neutral processing state and let backend reconciliation resolve it. Poll with bounded backoff or consume a notification/deep link when state changes. Do not ask the Seller to manually verify payment.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

Cancellation UI shows request accepted, payment reconciliation pending and completed safe release as separate backend facts. CANCEL is a request; EXPIRED is a local deadline, never "no money charged". Show late verified money and any PAID_BUT_UNFULFILLABLE/Seller remedy honestly; do not expose a retry while backend allowed_actions denies it.

## 104. Payment failure and retry

Failed or abandoned provider attempts remain tied to one Seller Order. The backend decides whether a fresh attempt may be created. A retry must not duplicate the Order or double-charge because a previous provider result arrived late.

## 105. Checkout progression

After one Seller Order is confirmed PAID, checkout may advance to the next unpaid Seller Order. Buyers may leave and later resume remaining payments from Orders/checkout summary. Paid Orders immediately enter Seller preparation; they do not wait for every sibling Seller Order to be paid.

## 106. No seller payment confirmation

Seller Companion receives a paid-order notification only after the backend establishes provider payment success. There is no Seller action to confirm receipt, no buyer screenshot submission path and no mobile UI that treats Seller judgment as payment authority.

## 107. Handoff Verification System

Adulis uses one Handoff Verification System with two handoff types and three verification methods.

```
PICKUP: Seller -> Courier.
DELIVERY: Courier -> Buyer.
```

Methods: QR primary; OTP fallback; Manual Verification emergency recovery. All methods converge into the same authoritative handoff state machine and audit trail. Pickup and Delivery credentials are purpose-bound and never interchangeable.

Final recipient may be an Order/Handoff-scoped Buyer-authorized delegate. This grants receipt verification only and does not transfer Order ownership, Claim/refund or Review rights; the Review Grant stays with the Order Buyer. For direct Seller-to-Buyer fulfilment, Seller displays and Buyer/delegate scans.

## 108. Handoff presenter and recipient surfaces

Presenter/giver displays the purpose-bound credential; recipient scans.

Pickup: authorized Seller Companion displays Pickup QR -> assigned Courier Mode scans -> server accepts custody when legal.

Final Courier Delivery: Courier Mode displays Delivery QR -> authenticated Buyer or authorized delegate scans -> server accepts final receipt when legal.

Seller Console can display Pickup credential where permitted; it never performs the Buyer scan. Buyer Mode owns final-recipient scanning; Courier Mode owns Pickup scanning and final Delivery credential display.

QR primary, OTP fallback and Manual emergency recovery all use the same connected, server-authoritative Handoff model.

![Current Handoff stage and recipient protocol](graphics/MOB_07.svg)
*Figure 07. Current Handoff stage and recipient protocol. Recipient-directed OTP and Collection delegates; governed lockout recovery; connected final receipt.*

| Mode / stage | Presenter -> intended recipient | QR / OTP / Manual / transition |
| --- | --- | --- |
| Buyer Collection / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Seller displays / recipient scans; OTP to recipient; expressly authorized presenter may submit recipient-supplied code. Governed Manual; accepted final receipt. |
| Seller Delivery / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Same direction; no Courier pickup. Governed Manual; accepted final receipt. |
| Courier / PICKUP | Seller actor -> current assigned Courier | Seller displays / Courier scans; OTP to Courier. Governed Manual; custody only, no Buyer feedback Grant. |
| Courier / final DELIVERY | Current assigned Courier -> Buyer OR active authorized delegate | Courier displays / recipient scans; OTP to Buyer/delegate. Governed Manual; final receipt. |

## 109. QR credential security

QR credentials are server-minted, short-lived, single-use, Order-bound, handoff-type-bound and actor/assignment-bound where applicable. Mobile contains no server signing key. The backend validates authenticated actor, Order state, assignment, credential state, expiry and replay protection before accepting a handoff.

## 110. Pickup QR flow

```
PAID Order -> Seller prepares -> Seller assigns/nominates Courier -> READY_FOR_DELIVERY -> Seller
displays Pickup QR -> assigned Courier scans -> server verifies PICKUP credential -> custody
becomes Courier-held -> In Delivery stage begins; attempt bounded Pickup checkpoint evidence where available.
```

The pickup verification does not complete the Buyer Order.

## 111. Delivery QR flow

Courier reaches the authorized recipient -> Courier opens/displays purpose-bound Delivery QR -> Buyer or authorized delegate scans after receipt -> server validates Order, assignment/custody, recipient authorization, DELIVERY purpose, expiry and unused state -> Delivery Handoff VERIFIED -> Order Management may complete when legal.

Attempt bounded Delivery checkpoint evidence where available. Its denial/unavailability/timeout/low accuracy/error cannot invalidate a valid connected Handoff. Review/Claim/refund rights remain with the Buyer.

## 112. OTP fallback

| Mode / stage | Presenter -> intended recipient | QR / OTP / Manual / transition |
| --- | --- | --- |
| Buyer Collection / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Seller displays / recipient scans; OTP to recipient; expressly authorized presenter may submit recipient-supplied code. Governed Manual; accepted final receipt. |
| Seller Delivery / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Same direction; no Courier pickup. Governed Manual; accepted final receipt. |
| Courier / PICKUP | Seller actor -> current assigned Courier | Seller displays / Courier scans; OTP to Courier. Governed Manual; custody only, no Buyer feedback Grant. |
| Courier / final DELIVERY | Current assigned Courier -> Buyer OR active authorized delegate | Courier displays / recipient scans; OTP to Buyer/delegate. Governed Manual; final receipt. |

QR presenter displays/scanner receives. OTP is sent to intended recipient; expressly authorized presenter can enter a recipient-supplied code after possession. Do not send OTP to the Courier merely because Courier presents goods. LOCKED ordinary redemption is unavailable; safe Operator Manual path retains current authority.

## 113. Manual Verification

If normal verification cannot complete, an authorized Operator may review the Order, parties, Courier assignment, prior attempts, location/timestamps and support context. Manual approval/rejection is audited with operator identity, reason and case reference. Mobile displays the resulting status; it cannot request an arbitrary silent completion.

## 114. Handoff state

Conceptual Handoff state is independent from credential state. Handoff types: PICKUP / DELIVERY. Handoff status: PENDING / VERIFIED / EXPIRED / LOCKED / CANCELLED / REVOKED. Verification method: QR / OTP / MANUAL.

A handoff may have multiple credentials over time, but only one accepted verification outcome.

## 115. Network-required verification

The current Mobile App requires network connectivity for Handoff acceptance. QR parsing may happen locally, but success is shown only after server validation. If connectivity is unavailable, show a clear reconnect state and keep the underlying Order unchanged.

## 116. Handoff UX

Every stage shows who is expected to act, the Order reference, current Courier identity where appropriate, credential expiry and a safe fallback path. Never label a Pickup scan as delivered, and never let Delivery verification appear before a valid Courier assignment/custody stage.

## 117. Idempotent verification and recovery

Duplicate verify requests return the existing accepted result and cannot create two custody events or two completions. Reassignment/cancellation revokes incompatible active credentials. Lockout from repeated OTP failures routes to Manual Verification rather than weakening checks.

## 118. Reviews

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Mobile renders server allowed_actions and basis-aware item eligibility; no local purchase/Handoff/Claim inference. Show failure label/minimal remedy state and disable unreceived Product ratings. Delegates cannot author.

## 119. Review publication

The Reviews domain decides eligibility, one-review/update policy, moderation state and publication. Mobile displays allowed_actions. Sellers cannot suppress a valid negative Review merely because they disagree with it. Review UI must distinguish Product quality from Seller service.

## 120. Claims

Claims are transaction-specific.

Claim flow:

```
Order
v
Problem
v
Claim type
v
Statement
v
```

```
Evidence
v
Submit
v
Claim status
```

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

## 121. Financial claim evidence

With gateway checkout, payment-related Claim evidence is provider transaction state, server payment records, Order history and audit facts. Mobile should not ask Buyers for ordinary bank-transfer screenshots as the normal purchase path. Additional claim evidence remains purpose-limited and uploaded through the dedicated Claims/Media security boundary when required.

## 122. Claim status

Possible screen concepts:

```
Submitted
Evidence added
Under review
Action needed
Resolved
```

Exact state names must come from canonical Claims.

Mobile does not invent them.

## 123. Report

Every relevant piece of user-generated content should expose:

Report

Examples:

• Scene;

• Reviews;

• seller content;

• review where permitted;

• message where policy applies.

Reporting content is not the same as resolving a transaction claim.

## 124. Block

Where marketplace safety requires it, buyers should also be able to block:

• seller;

• account/content relationship

according to canonical policy.

Blocking must immediately affect recommendation eligibility where applicable.

## 125. Chat

Buyer Mode supports Buyer-Seller conversation plus clearly separated Adulis Operator outreach. Seller messages, bot messages and Operator messages must have distinct provenance; Operators never impersonate Sellers.

Chat remains commerce-aware and may link a Product Post or Order at message level. Sensitive actions still execute through structured domain APIs, not free-form message text.

## 126. Conversation anchors

Message-level anchors may reference Product Post, Scene Post or Order context according to server authorization. An Operator review reminder anchors the completed Order/Product line so the Buyer knows exactly what is being requested.

## 127. Chatbot

Buyer may receive automated answers.

Architecture:

```
Buyer question
v
Rules / Exact Match
v
Embedding similarity where enabled
v
Classifier where enabled
v
Intent
v
Approved template
v
Canonical seller/product data
v
Answer
```

The LLM never writes the final answer directly.

## 128. Bot display

Bot messages should be visibly distinguishable from seller-written replies.

Example badge:

Automated answer

and where useful:

Ask seller

## 129. Amharic chatbot

During early stages, controlled chips/templates can carry more of the Amharic experience than unrestricted free-text classification.

A confident wrong answer is worse than escalation.

## 130. Human escalation and Operator outreach

WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

Mobile preserves send success only after the Chat owner persists the original Message; a human waiting badge is not a response SLA or a local offline business success. Seller Companion/Console see the same conversation and awaiting-human state.

## 131. Push notifications

Use Expo Notifications for meaningful state changes such as paid Order, Seller preparation, Courier assignment, pickup verified, In Delivery/Delivery state changes, delivery verification, Claim updates, security events and Review reminders. Push is a hint; opening the app re-reads authoritative state.

Relevant Seller content roles may receive Scene-made-Private and Scene-restored-to-Public notifications. These are hints; a fresh read resolves current visibility/reason and does not grant mobile content editing.

## 132. Notification permission timing

Ask after the user has encountered a concrete benefit, such as Order/Courier updates. Denial must not block checkout, payment, Handoff or Review. In-app Notification Centre remains available.

## 133. Notification-denied path

Notification permission denial must not cause lost orders.

Order Detail must independently show:

• current state;

• current deadline;

• action needed.

Push is convenience.

The server/order system remains truth.

## 134. No client-owned deadline actions

Do not schedule client-only timers to create business facts. Provider payment reconciliation, Order deadlines, Courier assignment lifecycle and review-reminder scheduling are server jobs. Mobile may display local reminders only as supplemental UX if policy later allows it.

## 135. Notification deep links

Deep-link notifications to the exact authorized resource: Seller Order, Courier assignment, delivery progress, Handoff screen, Claim, Chat or eligible Review form. All links revalidate current actor/context.

## 136. Notification Centre and Review reminders

Mobile displays Reviews-owned AVAILABLE Order Grant reminders for FINAL_HANDOFF or VERIFIED_ORDER_FAILURE. Keep T+1, T+3 and T+10 days from first grant issuance, then stop; failure eligibility never fabricates a receipt date. Approved reminder channels carry a safe Buyer call-to-action; no delegate author or automatic private case disclosure. Re-read current eligibility/recipient/preferences and cancel consumed/revoked/suppressed grants. One Order Grant has one deduplicated schedule; later Claims/evidence do not restart it.

## 137. You

You contains Account identity, settings, sessions/devices, privacy, account-deletion entry, notification preferences, language/market presentation and mode switcher. Seller/Courier capability is shown only when the backend says the relationship exists.

Guest You renders: Sign in to see your profile. Do not fabricate an authenticated Profile. Only the three eligible ordinary contexts are available; Operator access cannot be created/requested or switched to here.

## 138. Following

Following is a launch Home tab for followed-Seller discovery and may contribute recommendation context. For You remains Scene-only ranked discovery; Following does not redefine it as the whole Home container or force a chronological feed.

Use current PUBLIC Scene eligibility. Valkey may cache bounded non-authoritative relationship projections; PostgreSQL owns relationships and business truth.

## 139. Account deletion

Mobile is only an Account Deletion UI client. The complete lifecycle remains in adulis-platform.

```
Path: Profile -> Settings -> Account -> Delete Account -> step-up verification -> Platform Account
Deletion API -> status.
```

Use the same authenticated workflow as the Company Website/Seller surfaces. Mobile never accepts an arbitrary account ID and never deletes database/media rows directly. The backend coordinates Auth, Orders, Claims, Media, Chat, Notifications, Seller resources, FYP/recommendation data, analytics identities and retention/holds before completing deletion.

## 140. Seller Companion

Seller Companion is the urgent operational context in the same app: Monitor / Communicate / Respond / Urgent Operations. Seller Console remains Create / Configure / Manage / Administer.

OWNER/ADMIN may handle normal urgent paid-order alerts, preparation, Mark Ready, already eligible Courier assignment, Pickup credential display, custody/Delivery progress, permitted Inbox/replies, urgent stock and Claim alerts/summary.

SALES_SUPPORT handles Buyer messages/replies/chatbot escalation, Claim alerts/summary/deadlines and Buyer-safe read-only Order/payment/fulfilment/Courier/Pickup/Delivery facts. No preparation, Mark Ready, Courier assignment, stock/Product/Variant/price edits or fulfilment-operator Pickup credential display.

INVENTORY handles paid preparation, Mark Ready, eligible Courier assignment, Seller Pickup credential and custody/Delivery status, quick stock correction, mark unavailable/sold out and stock confirmation. No unrestricted Buyer Inbox or full Product authoring.

ANALYST is Console-first for privacy-bounded analytics; CAMPAIGN_MANAGER is Console-first for Scene/content/chatbot/discovery work. Do not create substantive operational Companion workspaces merely for symmetry. Lightweight relevant Private/restoration notifications do not permit mobile Scene editing.

Mobile excludes Product creation/full editor, Scene authoring, team administration, ownership transfer, Seller closure, full chatbot configuration and sensitive Store/provider administration.

![Seller surfaces by responsibility](graphics/MOB_08.svg)
*Figure 08. Seller surfaces by responsibility. Console administers the business; Companion handles permission-scoped urgent operations and communication.*

| Role | Companion work | Boundary |
| --- | --- | --- |
| OWNER / ADMIN | Urgent paid Orders, preparation/Ready, eligible Courier assignment, Pickup display, Inbox, stock, Claim alerts. | Full authoring, team, lifecycle and sensitive configuration stay Console-only. |
| SALES_SUPPORT | Inbox/replies/escalation; Buyer-safe Order/payment/delivery read; Claim alerts/summary. | No preparation/Ready/assignment/stock/edit/Pickup credential. |
| INVENTORY | Paid preparation/Ready, eligible assignment, Pickup display, urgent stock/confirmation. | No unrestricted Inbox, pool administration or full authoring. |
| ANALYST | Console-first aggregate analytics. | No artificial operational mobile workspace. |
| CAMPAIGN_MANAGER | Console-first Scene/chatbot/discovery work; lightweight visibility notices. | Notifications do not grant mobile Scene editing. |

## 141. Seller Mode navigation

Companion navigation is capability-aware. OWNER/ADMIN may use Alerts, Orders, Inbox and permitted urgent actions. SALES_SUPPORT prioritizes Inbox/support/Claim alerts and read-only Buyer-safe Orders. INVENTORY prioritizes preparation/Ready/Pickup work and urgent stock; hide unrestricted Inbox.

Render destinations and actions only from backend capabilities/allowed_actions. ANALYST/CAMPAIGN_MANAGER remain Console-first; relevant notification entry is not an artificial operational workspace.

Complex Catalogue/content/team/provider configuration stays in Console. Delivery views show states/exceptions rather than live location maps.

## 142. Seller selection

MVP allows at most ONE non-terminal Seller TEAM membership per ordinary Account; one membership can have multiple non-OWNER roles. Team joining uses an existing Account username invitation and acceptance in Console; team administration stays Console-only.

The Account may own multiple Sellers where allowed, own Seller A plus be team member of Seller B, and be Courier across several relationships. Companion therefore always carries an explicit authorized seller_id.

Switching Seller clears/namespaces Seller cache without leaking into Buyer/Courier contexts. Never describe multiple simultaneous team memberships as permitted.

## 143. Seller Mode authorization

Every Seller action carries authenticated Account context plus active Seller scope. The backend verifies role/permission and allowed_actions. The app cannot grant itself Seller rights or choose another Seller by changing a request parameter.

Canonical permission inputs are Account, Seller relationship, standing, role-set, surface, permission, resource scope and allowed_actions. Frontend role names are not security; directly invoked endpoints must deny prohibited role/surface actions.

## 144. Seller Alerts

High-priority alerts include new PAID Order, preparation deadline, Courier assignment issue, Pickup Handoff status, Courier delivery exception, Buyer message, Claim, stock problem and security event. Do not alert Seller to manually verify gateway payment.

Alerts are role-scoped: support sees Buyer-facing issues/messages/Claims; Inventory sees preparation/stock/fulfilment; authorized content roles may see Scene Private/restoration hints. Opening a notice re-reads canonical state.

## 145. Seller Order Detail

Seller Order Detail shows Buyer-safe fulfilment information, Products/quantities, verified gateway payment state, preparation status, Courier assignment, Pickup Handoff, In Delivery/Delivery/exception state, Delivery Handoff status, Chat and allowed operational actions.

Payment remains Processing/Paid/Failed/Refunded/reconciliation plus a safe reference, read-only for every role. The Order fulfilment mode is snapshotted before payment and is normally read-only; expose a change only through a specific backend authorized workflow.

## 146. No seller acceptance or payment-confirmation step

A verified gateway payment creates the paid-order obligation directly. Seller does not accept the purchase and does not confirm money receipt. Backend/provider payment truth is read-only to the Seller.

## 147. Paid-order notification

When provider payment is verified, Notifications tells the Seller that the Order is paid and preparation should begin. The Seller can open the Order, prepare items, read the snapshotted fulfilment mode, assign an already eligible Courier and mark ready when allowed.

## 148. Seller payment status

Seller Companion may display provider payment status and reference fields that are safe for Seller use, but cannot edit payment outcome. Ambiguous provider states show a neutral processing/reconciliation state until backend resolution.

## 149. Seller financial-data boundary

Do not expose provider secrets, Buyer payment credentials or unnecessary financial payloads. Seller-facing payment fields are read models produced by the Payments domain. Sensitive provider debugging belongs to authorized Operator tooling.

## 150. Seller Mark Ready

After a PAID Order is prepared, Seller may Mark Ready if allowed_actions permits it. Mark Ready is idempotent, server-authoritative and may enable Pickup Handoff credentials for the assigned Courier.

Only roles granted physical fulfilment, including OWNER/ADMIN/INVENTORY, may perform this action. SALES_SUPPORT cannot prepare, Mark Ready or assign Courier; none may set payment success.

## 151. Seller Pickup QR

For Courier delivery, Seller Companion displays the purpose-bound Pickup QR after Order/Courier prerequisites are satisfied. The assigned Courier scans it in Courier Mode. The Seller never displays the Courier's final Delivery credential.

Credential display is restricted to the authorized fulfilment operator. SALES_SUPPORT does not gain Pickup credential access from Order read/support permission.

## 152. Seller Inbox

Seller Inbox contains Buyer conversations and chatbot escalations for the active Seller. Operator-to-Buyer outreach is not shown as if it came from the Seller. Message provenance and Product/Order anchors remain explicit.

Inbox is granted to OWNER/ADMIN/SALES_SUPPORT as permitted. INVENTORY has no unrestricted Buyer Inbox; ANALYST and CAMPAIGN_MANAGER do not inherit raw messages from read-only analytics/chatbot/content access.

## 153. Seller Companion future scope

Possible later additions include lightweight seller dashboard, Reviews, notification preferences and more inventory monitoring. Full Product/Scene Post authoring, team administration and sensitive store/payment configuration remain Console-first unless evidence justifies expansion.

Urgent stock is current, role-permitted Companion work: Inventory marks a Product unavailable -> Inventory commits -> Content makes affected Scenes PRIVATE if this was their last available tag -> public projections invalidate -> content roles are notified. Restock triggers gated automatic PUBLIC restoration. Mobile submits Inventory intent and consumes results; it does not orchestrate Content lifecycle.

## 154. Courier Mode

Courier Mode is the third ordinary context, exposed only by current capability/relationships. MVP supports Private Courier Pools plus the Cross-Seller Courier Network, persistent Courier identity and approval by several Sellers.

Where approved by Fulfilment UX, Courier may view/apply to Seller Courier opportunities, accept/decline eligible offers, perform the assignment and Handoff. It need not originate from a single Seller phone invitation.

The workspace is offers/assignments, authorized pickup/delivery instructions, one active accepted delivery, connected Handoff, bounded checkpoint evidence and history. It is not a wallet, open bidding system or route-optimization/batching product.

![Courier relationships / assignment capacity](graphics/MOB_09.svg)
*Figure 09. Courier relationships / assignment capacity. Persistent Courier identity can span Seller relationships while MVP allows one active accepted delivery.*

## 155. Courier navigation

Courier shell may use Assignments | Active Delivery | History | Account.

Assignment detail shows received/available eligible offer, Order reference, Seller pickup information, Buyer delivery information only after authorization, snapshotted compensation, assignment state, Pickup action, Delivery action and completion/history.

States include Awaiting Pickup, Pickup Verified, In Delivery, Delivery Verified, Exception and Completed. Show state and next permitted action; there is no live-GPS tracking status, route polyline or location-based assignment.

Data access ends when assignment/relationship no longer authorizes it. Courier relationship administration and offer legality belong to backend Fulfilment.

## 156. Courier assignment and one active delivery

MVP permits ONE active accepted delivery per Courier. One assignment serves one Seller Order, which may contain multiple Product lines.

One Courier identity may have many approved Seller Pool/Network relationships. These are standing relationships, not permission for simultaneous assignments.

Fulfilment enforces concurrency transactionally when accepting/assigning and returns eligible offers/allowed_actions. No simultaneous multi-Seller grouped route, multi-stop batching or route optimization is part of this MVP.

## 157. Courier Checkpoint Location Evidence

Current MVP attempts location evidence at exactly two handoff checkpoints: PICKUP and final DELIVERY. Use foreground/on-demand expo-location when available/allowed, scoped to the authorized Order/assignment and accepted evidence policy.

No live map, route polyline/history, periodic sample, background permission/collection, sample queue or location-based assignment is implemented. Do not add expo-task-manager for tracking or react-native-maps solely for Courier routes.

Location is supporting evidence only. Denied, unavailable, timed-out, low-accuracy or errored capture must not invalidate an otherwise valid connected QR/OTP/Manual Handoff. Record the bounded outcome without fabricating coordinates or business success.

Exact checkpoint coordinates are sensitive, retained/accessed by explicit policy and not broadly exposed in ordinary Buyer/Seller UI. Notifications and status reads communicate delivery progress.

Keep Buyer Nearby foreground location and structured Seller store maps separate from Courier checkpoint purpose/permissions.

![Two bounded evidence checkpoints](graphics/MOB_10.svg)
*Figure 10. Two bounded evidence checkpoints. Foreground attempts at Pickup and Delivery support evidence; valid connected Handoff is independent of location availability.*

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

## 158. Courier Pickup Handoff

```
Courier opens assigned Order -> scans Seller Pickup QR or uses stage-specific OTP fallback -> backend verifies assignment and PICKUP purpose -> custody becomes Courier-held -> attempt bounded Pickup checkpoint evidence where available; In Delivery stage continues.
```

## 159. Courier Delivery Handoff

Courier reaches the Buyer/authorized delegate -> Courier displays Delivery QR (or presents the stage-specific OTP fallback) -> Buyer/delegate scans/verifies after receipt -> backend validates Order, assignment/custody, recipient and credential -> Delivery Handoff VERIFIED -> Order Management completes when legal.

Attempt bounded Delivery checkpoint evidence where available. Capture failure is independent from a valid connected Handoff. Claims/refund/Review rights stay with the Order Buyer.

## 160. Courier failure and recovery

Handle revoked/reassigned assignment, invalid or expired credential, failed OTP, network interruption, location permission loss and provider/notification issues explicitly. A Courier cannot force completion; unresolved verification routes to retry, reassignment or authorized Manual Verification.

## 161. Network-required operation

Adulis Mobile is an online application. Business actions - checkout, payment, Chat, Claim, delivery-state actions and Handoff verification - require connectivity to authoritative services. The UI may cache safe public presentation assets for performance, but cached data never enables disconnected business mutation.

## 162. Performance reference device

Performance must be measured on:

a low-end Android device

rather than only developer phones/emulators.

The previous architecture explicitly requires physical low-end hardware as the binding mobile performance environment.

## 163. Initial performance objectives

Engineering targets:

```
Cold start -> interactive:
<= 3 seconds
```

```
FYP shell:
<= 2 seconds typical
```

```
First meaningful FYP media:
<= 2.5-3 seconds on target constrained network
```

```
Product interaction after cached metadata:
near-instant visual response
```

```
Scroll:
avoid visible frame stalls
```

```
Android bundle:
keep aggressively bounded
```

These are internal engineering objectives, not SLAs.

## 164. Memory management

FYP is the main memory-risk surface.

Rules:

• recycle off-screen items;

• do not retain large decoded images unnecessarily;

• do not preload unlimited items;

• unmount WebViews immediately;

• release payment-evidence buffers;

• avoid keeping several product-detail galleries alive.

## 165. Background behavior

Buyer/Seller/Courier screens pause nonessential polling in background. No continuous Courier location collection runs in this MVP; checkpoint capture is foreground/on-demand at Pickup and Delivery only.

Notifications return the user to a fresh server read. Background execution never establishes Order/Handoff success or queues disconnected business acceptance. Safe presentation assets and bounded technical analytics/retry metadata do not become business truth.

## 166. Security posture

Treat the mobile binary as untrusted. Keep session secrets in SecureStore, provider secrets on servers, validate all deep links, reauthorize Seller/Courier scope on every sensitive call, throttle abuse server-side and minimize third-party SDKs. Handoff QR/OTP secrets must never enter logs/analytics.

## 167. Logs

Mobile Sentry/log breadcrumbs may include app/runtime version, screen, request ID, error code and bounded entity references. Never log OTP values, Handoff credential contents, access/session tokens, Chapa/provider secrets, payment credentials, precise long-lived Courier routes or private Chat bodies.

## 168. Third-party SDK policy

Launch with no advertising, session-replay or unnecessary analytics SDK.

Use first-party telemetry.

Store-provided crash/ANR information may be used initially.

Any future third-party telemetry processor requires an explicit privacy/security decision before installation.

## 169. Certificate pinning

Do not add certificate pinning in MVP.

A broken native pin can disable every installed app and cannot necessarily be repaired through JavaScript OTA.

Standard TLS, platform trust and strong server security are sufficient for current threat assumptions.

## 170. Root/jailbreak detection

Do not make root/jailbreak detection a primary security boundary.

Server authorization and revocable sessions protect the actual system.

Client anti-tamper signals may be reconsidered only when they solve a measured fraud problem.

## 171. Privacy

The app should minimize collection.

Do not collect:

```
background location
contacts
microphone
precise location without need
birth date without need
full banking statements
advertising identifiers
```

simply because mobile OS APIs make them available.

## 172. Permissions

Ask contextually.

Camera When scanning QR or capturing permitted evidence.

Photos When selecting evidence/media.

Notifications After first meaningful transactional reason.

Location Only when opening an explicitly location-dependent feature.

No permission wall at launch.

## 173. Accessibility

Requirements:

• screen-reader labels;

• dynamic text;

• adequate contrast;

• large touch targets;

• no color-only status;

• meaningful hotspot labels;

• logical focus after sheets/modals;

• reduced motion;

• accessible error announcements.

The current engineering manual explicitly requires accessibility testing on 360px Android.

## 174. Localization and global market support

The app is global-ready from Day One. English is the international baseline; Amharic remains first-class for Ethiopia. Market/country configuration determines currency, enabled categories, payment/courier capabilities, policy copy and local time presentation. Additional locales can be added without changing domain APIs.

## 175. Amharic typography

React Native does not provide CSS-style unicode-range.

Therefore actual mixed Latin/Ge'ez rendering must be verified on physical devices.

Test:

```
Adulis
TikTok
Instagram
ETB figures
Amharic sentence
```

together.

The previous mobile architecture specifically makes this a physical-device release gate.

## 176. Dynamic type

Test every critical flow using large system text.

Especially:

• OTP;

• Product;

• checkout;

• payment instructions;

• claim evidence;

• View Payment Status;

• step-related explanations.

No clipped financial instruction.

## 177. Money representation

Use integer minor units or the backend's canonical Money contract, never floating-point arithmetic. Display currency from the Seller Order/Market context. A multi-cart checkout may contain Seller Orders in only combinations permitted by Market/payment policy; the client does not invent currency conversion.

## 178. Time representation

APIs exchange canonical absolute instants as ISO 8601 UTC timestamps with Z. Human-facing Order, Seller and Courier activity renders in the relevant Market/order local timezone. Seller operating hours are interpreted in Seller/Market local time. Never derive canonical event time from the device timezone alone.

## 179. Error model

Every major surface distinguishes:

```
Loading
Empty
Success
Retryable error
Not found
Conflict
Authentication required
Permission denied
Upgrade required
```

Do not turn all failures into:

```
Something went wrong.
```

## 180. Request IDs

Unexpected error surfaces should display:

```
Reference: req_...
```

so support can correlate the mobile failure with backend logs.

## 181. FYP errors

FYP failure states distinguish initial-load failure, next-page failure, media failure, stale product-tag availability and moderation removal. Keep the last safe Scene Posts visible when possible and provide retry without turning stale data into commerce authority.

## 182. Scene availability loss, Private visibility and restoration

Partial stock loss: Scene tags A/B; A becomes unavailable but eligible B remains available -> Scene stays PUBLIC -> tag A says Currently unavailable -> B remains actionable using fresh commerce truth.

Last available tag lost: B becomes unavailable -> backend retains PUBLISHED and sets PRIVATE -> clear the open Buyer Scene's stale media/caption/tags on canonical visibility response and show safe unavailable navigation -> remove from future FYP/Search/Storefront/Collection/direct-link rendering.

Restock: A becomes available -> backend rechecks all public gates -> automatic PUBLIC restoration if valid -> refresh affected projections. Existing private Collection membership may become renderable again; it never overrides visibility.

Mobile does not orchestrate this process. Events/notifications are refresh hints; current server reads authorize display and purchase actions.

## 183. Product availability reason

Opening an unavailable Product Post must explain the reason in buyer-safe language, for example: sold out, temporarily unavailable, Variant unavailable, Seller unavailable or product removed. The universal label may remain "Currently unavailable" while the detail page provides the specific reason and any valid next action such as viewing other same-Seller products or returning to Shop/Search.

## 184. Moderation disappearance

If content becomes moderation-ineligible while open:

next canonical refresh may return:

```
Content unavailable
```

with safe navigation out.

Do not show restricted content merely because it remains in in-memory FYP state indefinitely.

## 185. FYP refresh after long background

After a meaningful background interval, create/refetch the FYP session according to configuration rather than assuming old Scene Post eligibility remains current. Preserve user context where safe, but current moderation/availability always wins.

## 186. Repository architecture

Canonical repository boundary:

```
adulis-platform/
apps/
mobile/
app/
(buyer)/
(seller)/
(courier)/
auth/
src/
api/ bootstrap/ session/
features/
fyp/ scene-posts/ search/ products/ sellers/
collections/ carts/ checkout/ orders/ payments/
handoff/ courier/ delivery-progress/ reviews/ claims/ chat/ notifications/
seller-companion/ account/
analytics/ i18n/ shared/
maestro/
app.config.ts
eas.json
seller-console/
operator-console/
storefront/
api/
worker/
packages/
api-contracts/ design-system/ tokens/ schemas/ locale/
analytics-events/ money/ dates/ permission-catalogue/ handoff-contract/
```

```
adulis-web/ is a separate Company Website monorepo with its own Website backend/CMS and is not
inside adulis-platform.
```

There is no disconnected business module. Shared packages never expose backend repositories or database credentials to Mobile.

## 187. Buyer/Seller/Courier code seams

Buyer, Seller Companion and Courier feature modules may share API client, session, locale, design tokens, analytics helpers and safe Handoff contract types. They must not import each other's business feature implementations or silently reuse scoped query keys.

Seller requests carry Seller context only when in Seller Mode. Courier requests use assignment-scoped Courier APIs. Buyer requests never masquerade as Seller/Courier.

## 188. Design system

Shared mobile components should include ScenePostCard, ProductTag, SceneExplorer, ProductCard/ProductMiniCard, SellerCard, MultiCartSummary, SellerCartSection, PaymentProgress, OrderStateCard, DeliveryProgressCard, HandoffCredentialCard, QRScanner, OTPFallbackSheet, ReviewEligibilityCard, OperatorMessageBadge and robust Loading/Empty/Error states.

## 189. Server-owned allowed actions

Order, payment, Seller, Courier, Handoff, Claim and Review screens render server-provided allowed_actions/capabilities. UI hiding improves usability but is never the security boundary.

## 190. Idempotency

Use idempotency for high-risk writes: Seller Order creation, payment-attempt creation/retry, Cart mutation where duplication is costly, Handoff verification, Mark Ready, Courier assignment commands, Claim submission and Review submission. Reusing a key with a different payload is an error.

## 191. Observability

Mobile reliability is observed through Sentry plus backend Pino/metrics. Track app/runtime version, request IDs, FYP latency, gateway status latency, Checkout errors, Courier assignment conflicts and checkpoint-attempt outcomes, Handoff verification failures, push/open failures and crash-free sessions. pg_stat_statements supports backend query diagnosis; Valkey/BullMQ health remains backend observability.

## 192. Mobile business telemetry

Measure Scene Post qualified impressions, product-tag clicks, Product Post opens, saves, add-to-cart, seller-cart checkout starts, payment-attempt starts/outcomes, paid Seller Orders, Courier assignment, delivery progress opens, Pickup/Delivery Handoff outcomes, Reviews and Claims. Canonical paid/completed facts are server-origin events.

## 193. Client health telemetry

Track cold-start duration, FYP first-render time, image/embed load failures, JS/native crashes, memory pressure where available, payment-return failures, delivery-state rendering and checkpoint-capture outcomes, Handoff verification latency, deep-link failures and upgrade-required share - without sensitive payload capture.

## 194. Handoff and checkpoint alerts

Alert on sustained QR/OTP acceptance failures, replay/idempotency anomalies, assignment/concurrency conflicts, payment-to-Seller-notification lag and delivery-completion inconsistency. Observe bounded checkpoint outcome/failure rates for operations without making location required for valid acceptance.

No GPS freshness, background sample or route-map alerts exist. Redact precise coordinates/credential payloads from telemetry; business facts come from canonical domains.

## 195. Recommendation client metrics

Track FYP first-page/next-page latency, prefetch efficiency, Scene Post render failures, media failure, empty feed, duplicate suppression, product-tag interaction latency and unavailable-tag rate. Do not expose ranking weights or internal quality scores to users.

## 196. Testing layers

Required:

```
Unit
Component
Integration
```

```
API contract
Database invariant
Mobile E2E
Security negative testing
Performance
Physical-device testing
```

The current engineering manual explicitly requires mobile-component and critical E2E testing in addition to backend tests.

## 197. Critical E2E - FYP to Product Post

```
Open app -> FYP Scene Post -> product tag -> Product Post -> Back -> exact Scene Post ->
Back -> preserved FYP position.
```

Assert that no Product Post is returned as an FYP feed unit.

## 198. Critical E2E - Search/Shop Product discovery

```
Shop/Search -> Product Post -> Seller profile -> physical store map action when present -> Add to
seller cart -> return to Search. Verify Product Posts remain discoverable outside FYP and
structured map location is used rather than plain text.
```

Assert launch Search PRODUCT_POST/SELLER/SCENE_POST results and only eligible PUBLIC Scenes. Save an individual Product and a whole Scene into one private Collection; deduplicate writes, suppress private Scene payloads and restore rendering after gated PUBLIC restoration. Guest durable saving requires sign-in.

## 199. Critical E2E - multi-cart checkout

```
Add Seller A products -> add Seller B products -> Carts shows two seller carts -> combined
checkout summary -> create separate Seller Orders -> verify no cross-Seller Order ID or payment
authority is created.
```

## 200. Critical E2E - authentication during checkout

```
Cold install -> browse Scene Post -> Product Post -> add to cart -> checkout -> OTP/account
creation -> cart/checkout context preserved -> server revalidates lines -> Seller Orders created
exactly once.
```

## 201. Critical E2E - payment retry/idempotency

```
Create Seller Order/payment attempt -> provider return lost or ambiguous -> app restarts ->
re-read Order/payment -> retry only if backend allows -> exactly one Order and no duplicate
successful charge state.
```

## 202. Critical E2E - sequential multi-seller payment

```
Checkout with Seller A + Seller B -> pay A -> A becomes PAID and Seller A notified -> pay B later
-> B becomes PAID -> each Seller prepares independently -> checkout summary reflects mixed
progress correctly.
```

## 203. Critical E2E - two-stage Handoff

Paid Order -> authorized Seller prepares/assigns eligible Courier/Marks Ready -> Seller displays Pickup QR -> assigned Courier scans -> connected PICKUP accepted -> In Delivery -> Courier displays Delivery QR -> Buyer or authorized delegate scans -> connected DELIVERY accepted -> Order completes -> Buyer Review Grant becomes eligible.

Repeat purpose/replay/idempotency checks with OTP fallback and Manual emergency fixtures. Network loss never shows local acceptance or creates an offline queue. Delegate verifies receipt without gaining Claim/refund/Review ownership.

Assert exactly two foreground checkpoint attempts, one at Pickup and one at Delivery. Denied/unavailable/timeout/low-accuracy/error capture does not invalidate legal connected Handoff. No periodic/background location, live map, batching or second active accepted delivery.

## 204. Critical E2E - claim

```
Completed/eligible Order -> Problem -> Claim -> server-scoped evidence guidance -> submit -> Claim
status -> Operator review. Verify gateway/payment facts and Handoff facts are referenced without
exposing provider secrets.
```

## 205. Critical E2E - Seller Companion

OWNER/ADMIN urgent flow: PAID notice -> Companion Order -> prepare -> assign already eligible Courier -> Mark Ready -> display Pickup credential -> read custody/In Delivery/Delivery state -> permitted Inbox/reply and urgent stock.

SALES_SUPPORT positive: messages/replies, chatbot escalation, Claim summary/deadline and Buyer-safe Order/payment/delivery reads. Negative: prepare/Mark Ready/assign/stock/edit/Pickup credential.

INVENTORY positive: paid preparation/Mark Ready/eligible assignment/Pickup display/urgent stock/confirm unavailable. Negative: unrestricted Buyer Inbox, pool administration, full Product/Scene authoring, team/provider/security.

ANALYST/CAMPAIGN_MANAGER receive no artificial operational Companion workspaces; content roles may receive Private/restoration hints without editing. Test urgent stock -> backend PRIVATE suppression -> restock/gated restoration and permission-aware notifications.

Every role sees payment read-only; no manual confirmation or casual post-payment fulfilment-mode choice exists.

## 206. Critical E2E - three-mode isolation

Account is Buyer + Seller A Owner + Seller B Staff + Courier for selected Sellers. Verify Buyer, Seller A, Seller B and Courier caches/inboxes/orders are isolated. Courier can see only authorized assignments; Seller contexts do not leak into Buyer or Courier requests.

Assert one non-terminal team membership; reject a second membership and activation race. Ownership of multiple Sellers, one team relationship and multiple Courier Pools remain distinct valid contexts. Operator identity/mode creation/request/switch is absent.

## 207. Critical authorization testing

Negative tests include cross-Seller IDOR, Courier accessing unassigned Order, Buyer invoking Seller/Courier commands, wrong Handoff-type credential, reused QR/OTP, Operator chat impersonation, ineligible Review submission, client-forged payment success and stale mode context after relationship revocation.

Add role-by-role direct-endpoint negative tests, one-active-delivery race, private Scene direct/Collection/cache bypass, team exclusivity and guest Orders/You sign-in states. UI hiding cannot authorize a command.

## 208. Critical FYP geometry tests

Test Product-tag hotspot geometry across aspect ratios, image crop modes, 360px devices, tablets and dynamic text. Tags remain usable/accessibility-labeled and opening them resolves current Product Post availability.

## 209. Maestro

Maestro is the primary mobile E2E tool for critical Buyer/Seller/Courier journeys. Maintain deterministic test accounts and fixtures for multi-cart, Chapa sandbox/payment adapter states, Courier checkpoint capture success/denied/unavailable/timeout/low-accuracy/error states, Pickup/Delivery QR and OTP fallback.

## 210. CI

GitHub Actions gates typecheck, lint, Jest, generated OpenAPI client drift, dependency-cruiser boundaries, Testcontainers-backed integration tests where relevant, mobile build checks and selected Maestro flows. Release artifacts are produced through EAS.

## 211. CI architecture guards

dependency-cruiser must prevent Buyer/Seller/Courier feature cross-imports, frontend imports of backend repositories, direct payment-provider secret packages in Mobile, and forbidden platform-to-adulis-web coupling. CI also verifies no legacy cache datastore naming reappears: Valkey is canonical.

## 212. Release environments

Use EAS profiles/channels:

```
development
preview
production
```

Development Developers.

Preview Internal founders/testers.

Production Store-distributed users.

## 213. OTA updates

OTA is valuable for:

• JavaScript bug fixes;

• safe UI fixes;

• translation corrections;

• non-material configuration changes.

Do not use OTA to introduce:

• new native permission;

• new native SDK;

• materially different app capability;

• privacy-changing data collection.

Those require a native binary release.

The existing architecture explicitly keeps OTA changes inside the already-reviewed native capability boundary.

## 214. OTA rollback

Maintain:

```
publish OTA
monitor
rollback to previous bundle
```

as a tested runbook.

Do not discover rollback procedure during the first production incident.

## 215. Minimum supported version

Raise client floor only when an old client can produce a materially incorrect or unsafe result.

Not because:

• it looks old;

• maintaining it is annoying;

• a new screen exists.

The current mobile architecture makes the same distinction.

## 216. Feature rollout

Feature flags may stage Scene Post variants, Courier assignment/checkpoint workflows, social embeds, payment-provider UI and new Market capabilities. Core security/payment/Handoff invariants are not experiments. FYP Product Post units are not a rollout option in the current architecture.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 217. App-store binary symmetry

Aim for the same core product architecture on iOS and Android.

Platform-specific differences should remain limited to:

• system permissions;

• secure storage implementation;

• push infrastructure;

• deep-link configuration;

• native OS behavior.

Avoid maintaining two different business products unless an explicit platform requirement makes it necessary.

## 218. What not to build

Do not build: a second Seller app; a separate Courier app; cross-Seller Order/payment semantics; client-authoritative payment success; provider payment status; disconnected commerce replication; open Courier bidding beyond approved Pool/Network opportunities; open social discussion; Product Posts in FYP; social embeds in FYP/Seller profile; or mobile ownership of Trust/stock/Order/Handoff rules.

## 219. Mobile invariants

MOB-INV-01 One Account / one binary / Buyer + Seller Companion + Courier Mode. MOB-INV-02 FYP feed units are Scene Posts only. MOB-INV-03 Product Posts are canonical commerce pages outside FYP. MOB-INV-04 Multi-cart groups seller-specific carts; every Seller Order/payment stays separate. MOB-INV-05 Gateway payment truth is backend/provider verified; Seller never confirms receipt. MOB-INV-06 Current app business actions require network connectivity.

```
MOB-INV-07 Courier delivery has PICKUP Seller->Courier and DELIVERY Courier->Buyer handoffs.
```

MOB-INV-08 QR primary, OTP fallback, Manual emergency all converge on one Handoff state machine. MOB-INV-09 Courier location attempts are bounded to Pickup and Delivery only; no live/background tracking. Capture failure never invalidates a valid connected Handoff. MOB-INV-10 Reviews require verified purchase history/eligibility. MOB-INV-11 Social embeds appear only on Product Post detail. MOB-INV-12 Unavailable tagged products show "Currently unavailable" and explain reason on Product Post detail. MOB-INV-13 API instants are UTC; human activity uses relevant Market-local time. MOB-INV-14 Valkey is the canonical cache/async datastore name.

- MOB-INV-15 - Home contains For You/default, Following, Nearby, Discounts and localized Locally Made; guests see explicit Orders/You sign-in states.

- MOB-INV-16 - Scene is one canonical content object; PRIVATE suppresses all Buyer exposure and restock permits only gated automatic restoration.

- MOB-INV-17 - Launch Search is Product/Seller/Scene; private Collections contain Product and whole-Scene items without bypassing visibility.

- MOB-INV-18 - Seller displays Pickup; Courier scans. Courier displays Delivery; Buyer/authorized delegate scans. No offline acceptance.

- MOB-INV-19 - Courier identity may have many Pool/Network relationships but only one active accepted delivery.

- MOB-INV-20 - Companion actions are responsibility/permission/surface scoped; one non-terminal team membership; no public Operator mode.

- MOB-INV-21 - Fulfilment/compensation/fee amounts are backend pre-payment snapshots; no client financial calculation or Seller payment confirmation.

- MOB-INV-22 - Trust has four labels and no Product-count caps; Scene/FYP launch media is image-only.

## 220. MVP build sequence

PHASE 1 - app shell, bootstrap, session, three-mode authorization. PHASE 2 - Product Posts, Seller profiles, Search/Shop, Scene-Post FYP. PHASE 3 - Saved + multi-cart + checkout coordinator. PHASE 4 - Chapa/provider payment integration and paid Order views. PHASE 5 - Seller Companion paid-order preparation/Courier assignment. PHASE 6 - Courier Pool/Network Mode + one active delivery + checkpoint evidence. PHASE 7 - Handoff Verification: Pickup QR/OTP, Delivery QR/OTP, Manual recovery integration. PHASE 8 - Reviews, Claims, Report/Block, Operator review-reminder workflow. PHASE 9 - Chat/Chatbot, notifications, account lifecycle UI. PHASE 10 - performance, accessibility, security hardening and store submission.

## 221. Build Receipt and Failure Evidence Before Feedback UI

Build canonical verified-payment, receipt and upheld eligible Claim/remedy evidence interfaces before feedback UI. Reviews consumes accepted FINAL_HANDOFF or VERIFIED_ORDER_FAILURE owner evidence, resolves one Buyer/Order identity and validates received-line quality permissions. No manual client delivery confirmation, fabricated receipt or extra Claim-based Review is introduced.

## 222. Why FYP comes early

FYP is the primary Buyer Home and the differentiation from boring catalogue browsing. It must launch early enough to test whether creative Scene Posts generate product interest and commerce, while Shop/Search remain precise Product Post discovery surfaces.

## 223. MVP Buyer scope

Launch Buyer scope: Home (For You/default, Following, Nearby, Discounts, localized Locally Made); image-only Scene FYP; canonical Scene Detail/Explorer and Product tags; Shop/Search Products, Sellers and PUBLIC Scenes; Seller Storefront; private Product/whole-Scene Collections; multi-cart and separate Seller Checkout/payment/Orders; delivery state; Buyer/delegate final QR scan/OTP fallback; Reviews/Claims/Chat/Operator outreach; Notifications; explicit guest Orders/You states; Account/deletion and Market/time presentation.

PRIVATE Scenes disappear from every Buyer route/cache/Collection response; automatic gated restoration can re-expose the stable target. No live Courier map or native Seller video FYP is launch functionality.

## 224. MVP Seller Companion scope

Launch Companion is role-aware urgent operations. OWNER/ADMIN have broad permitted preparation, Mark Ready, eligible Courier assignment, Pickup display, delivery states, Inbox/replies, urgent stock and Claim alerts/summary. SALES_SUPPORT is communication/read/support only; INVENTORY is preparation/physical fulfilment/urgent stock without unrestricted Inbox.

ANALYST/CAMPAIGN_MANAGER stay Console-first; relevant content notices may be lightweight. One Seller team membership and explicit Seller context are enforced by backend.

No payment confirmation, Product/Scene authoring, team administration, ownership transfer/closure, full chatbot configuration or sensitive Store/provider administration exists in Mobile.

## 225. Post-MVP Buyer features

Potential later additions: Following enhancements beyond the current Home tab, native richer-media FYP formats, advanced Nearby, public collections, creator profiles/commerce where approved, more sophisticated personalization and additional payment/fulfilment options. Current Product/Scene Post and Handoff invariants remain unless explicitly changed.

## 226. Post-MVP Seller Companion

Based on beta evidence: basic dashboard, Reviews, notification preferences, expanded inventory monitoring beyond current urgent stock operations and content-performance summaries. Seller Console remains the primary create/configure/administer surface.

## 227. Future recommendation migration

Mobile continues requesting the stable FYP API while ranking evolves behind it. Any future ranker still returns eligible Scene Posts under the current feed contract; Product Post recommendations belong to Shop/Search/other explicit discovery surfaces unless a future product decision changes the invariant.

## 228. Future media migration

The app can evolve from image-led Scene Posts to richer native media without using external social embeds as FYP media. TikTok/Instagram embeds remain Product Post detail aids unless a future explicit product decision changes placement.

## 229. Final system architecture

One React Native/Expo/strict-TypeScript Mobile app exposes authorized Buyer, Seller Companion and Courier contexts through generated REST/OpenAPI contracts to the shared NestJS/Fastify modular monolith. No Mobile BFF or independent mobile truth is introduced.

Buyer: Home/Scene FYP, Product/Seller/Scene Search, mixed Collections, seller-specific Cart/Checkout/Orders, recipient Handoff, Reviews/Claims/Chat. Companion: role-scoped urgent operations and communication. Courier: Pool/Network opportunities/offers, one active assignment, Pickup scan, final Delivery display, checkpoint evidence and history.

Backend domains: Auth/AuthZ/Seller/Market; Catalogue/Inventory; Scene Content/Media; FYP/Search/Collections; Checkout/Payments/Chapa/Orders; Fulfilment/Handoff; Chat/Reviews/Claims; Notifications/Analytics/Privacy. PostgreSQL/Drizzle owns state; transactional outbox/job intent relays to idempotent BullMQ workers over Valkey; R2/CDN/Sharp delivers images.

Operator remains a separate internally provisioned privileged identity/surface. Mobile expresses intent and renders accepted results, current eligibility and allowed_actions.

![Shared canonical Platform architecture](graphics/MOB_11.svg)
*Figure 11. Shared canonical Platform architecture. Clients express intent through typed APIs; domains authorize and decide, PostgreSQL persists truth, and workers build projections.*

## 230. Final design philosophy

Adulis Mobile deliberately separates inspiration, commerce and physical fulfilment.

DISCOVERY should feel creative: Scene Posts make products understandable and desirable without turning Adulis into a generic social network.

```
COMMERCE should become progressively more precise: Product Post -> Variant -> seller cart ->
separate Seller Order -> verified gateway payment.
```

```
FULFILMENT should be observable and evidential: Seller preparation -> eligible Courier assignment -> Pickup Handoff -> delivery state -> Delivery Handoff, with bounded supporting checkpoint evidence.
```

TRUST should be earned through real transaction evidence: completed Orders, Handoffs, verified-purchase Reviews, Claims and transparent Seller statistics.

The result is one global-ready mobile application with three modes, a Scene-Post FYP, seller-specific multi-cart commerce, provider-verified payment and auditable last-mile delivery - while keeping PostgreSQL-backed domains authoritative underneath.

Home is a discovery container, Collections preserve typed Product/Scene intent, and Scene visibility is consistently enforced. Ordinary relationship contexts share one Account while one-team/one-active-delivery limits and privileged Operator separation remain explicit. No client cache, location sample or notification establishes business truth.

## 231. Glossary

| Term | Definition |
| --- | --- |
| Buyer Mode | Ordinary Account context for discovery, Collections, commerce, recipient Handoff, Reviews and Claims. |
| Checkpoint Location | Foreground/on-demand Pickup and Delivery evidence attempts; capture failure does not invalidate Handoff. |
| Collection | Private authenticated Buyer grouping of Product Posts and whole Scene Posts; no Inventory reservation. |
| Courier Mode | Ordinary Account context for approved offers, one active delivery, Handoffs and delivery history. |
| Courier Pool | Standing approved Seller-Courier relationship set, separate from active assignment capacity. |
| Cross-Seller Courier Network | Approved opportunities/relationships across Sellers using persistent Courier identity. |
| Delegated Recipient | Buyer-authorized Order/Handoff-scoped receiver; receives no ownership, refund, Claim or Review rights. |
| FYP | For You/default Home tab, containing image-led eligible PUBLIC Scene feed units only. |
| Handoff | Connected server-authoritative transfer verification: QR primary, OTP fallback, Manual emergency. |
| Home | Buyer discovery container: For You, Following, Nearby, Discounts and localized Locally Made. |
| Private | Seller-only Scene visibility; omitted from every Buyer route/Collection payload until valid restoration. |
| Product Post | Canonical representation of one sellable Product; current price/stock/Variants come from backend domains. |
| Public | Scene visibility permitted only with current available eligible tags and all other gates passing. |
| Scene Post | Canonical image-led Seller discovery content with same-Seller Product tags; no separate lifestyle entity. |
| Seller Companion | Role-aware Mobile monitoring, communication, response and urgent operations; administration stays Console. |
| Seller Context | Explicit authorized seller_id and scope, included in requests and cache keys. |
| Seller Team Membership | Existing Account team relationship; at most one non-terminal membership, with possible multiple roles. |
| Step-Up Authentication | Additional server-verified authentication for permitted sensitive actions. |
| Trust Ladder | NEW, REBUILDING, ESTABLISHED, TRUSTED evidence-derived labels; no Product-count cap. |
| Urgent Stock | Role-permitted quick availability/stock correction; backend automatically reconciles dependent Scene visibility. |
| Visibility | PUBLIC/PRIVATE content dimension independent from publication lifecycle and moderation. |
| Shoppable Post | Superseded former term for Scene Post. |

## 232. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-01 — Buyer-facing Product / Scene terminology | The 13 October designs use Product Post and Scene Post as canonical domain names. | Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly. | PR-001 / PR-005, 26-27 Oct 2026 |
| R-02 — Scene publication and all-unavailable lifecycle | The 13 October pack already requires a legitimate same-Seller Product relationship and at least one currently available tagged Product at public publication. | Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product. Zero-tag or all-unavailable initial publication is rejected. A published Scene stays public while at least one tagged Product remains available. If the last available tagged Product becomes unavailable, the Scene remains PUBLISHED but effective Buyer visibility becomes PRIVATE across FYP, Following, Nearby, Search, Buyer Seller profile, public Storefront and Buyer-facing Collection/direct resolution. Seller/Operator views retain it with Private state. Restoration of at least one eligible Product automatically re-evaluates and may restore PUBLIC without republishing. | Founder rule + PR-004 reconciliation |
| R-03 — Buyer Home and social-commerce FYP presentation | The 13 October pack already defines For You / Following / Nearby / Discounts / Locally Made and a Scene-only FYP. | For You is the default Buyer Home channel and contains Scenes only; Products never become top-level FYP units. Home presents the five channels in a compact discovery row with Search and Notifications, with Seller Stories below. Scene cards are structured social-commerce cards, not full-screen video. Following is Seller-follow based; Nearby remains commerce-relevant without continuous/live GPS; Discounts and Locally Made are Product-led channels under their own eligibility rules. | PR-003, 26 Oct 2026 |
| R-04 — Seller Stories prototype direction | Stories are not a production domain in the 13 October system-design pack. | The approved prototype includes a lightweight horizontal Seller Stories row. A Story carries Seller identity, short-lived media/text and a link to a Product or Scene; discount presentation is allowed where the linked Product has an active discount. The viewer has no replies, reactions or comments. This is an approved UX/product direction only: production storage, API, event, media-retention, notification and analytics contracts remain OPEN and must be designed before Stories are implemented as a production domain. | PR-003, 26 Oct 2026 |
| R-05 — Final Scene engagement model | The 13 October designs define Scene commerce/discovery but do not fully freeze the later action bar and presentation. | Scene actions are Like, Save, Share, Reviews, Follow, More and Explore the Scene. Like belongs to the Scene only and no public Like count is shown. Save saves the Scene only. Follow is Seller-level. More may include Not Interested where applicable, Hide this Scene and Report. Public comments and reposts are not part of the current MVP. Explore the Scene is the primary commerce-exploration action. | PR-004, 26-27 Oct 2026 |
| R-06 — Explore the Scene and hotspot placement | The 13 October designs support tagged Products/hotspots but do not fully freeze where hotspot UI appears. | Normal For You and Following Scene media carries no Product hotspots. Tapping Scene media or Explore the Scene opens the dedicated Explore surface. Explore owns numbered hotspots and the tagged-Product list; hotspot/list selection remains synchronized. Unavailable tagged Products remain visible with current price plus “Currently unavailable” and no purchase action. View Product only navigates to Product detail; it never orders automatically. | PR-004 follow-up, 27 Oct 2026 |
| R-07 — Final Product engagement model | Product Post remains the canonical structured commerce object. | Buyer-facing Product actions are Save, Share, Reviews, Ask Seller, Order and More/Report. Product has no Like, public comments or repost. Save is Product-only. Ask Seller opens the ongoing Buyer-Seller conversation with Product context. Order enters Cart/Checkout; opening a Product or using Buy Again never creates an Order or payment automatically. | PR-005, 27 Oct 2026 |
| R-08 — Review presentation and write eligibility | The 13 October Reviews design separates Product Quality and Seller Service and defines evidence-based eligibility. | Anyone may read Reviews. Product Reviews expose Product Review and Seller Review. Scene Reviews expose one Product tab per distinct tagged Product plus Seller Review. Write/Edit controls appear only when authoritative Review eligibility exists; ineligible viewers see no composer. Product Quality and Seller Service remain separate. One active Product Review and one active Seller Review are maintained per qualifying entitlement; edit updates instead of duplicating. Sellers cannot edit/delete legitimate Buyer Reviews; Report Review is a moderation utility. The prototype’s completed-order path does not silently remove the 13 October design’s VERIFIED_ORDER_FAILURE Seller-service basis; that failure basis remains valid unless a later founder decision explicitly removes it. | PR-005, 27 Oct 2026 |
| R-09 — Seller profile and Storefront information architecture | The 13 October designs define Seller profile/Storefront content but not the final shared tab order. | Buyer Seller profile and standalone public Storefront share Scenes / Products / Reviews / About and open on Scenes. Scenes show the Seller’s Buyer-public eligible Scenes. Products show the catalogue with available first. Reviews is Seller Service; Product Quality remains on Product. About includes description, Trust facts, category, neighborhood/operating area, fulfilment, member since and social accounts. Collection point appears only where Buyer Collection is offered. Header actions are Follow and Message; the public Storefront hands these actions into the app. Trust is information, not a button. | PR-002, 26 Oct 2026 |
| R-10 — Purchased Products and Buy Again | The 13 October pack has Buyer Orders/account history but not the finalized Purchased Products UX. | Purchased Products derives from completed Buyer Orders and shows one entry per Product using the latest purchase: Seller, purchase date, purchased variant and current Product facts where resolvable. Buy Again opens the current Product with the last variant preselected only if still offered; Buyer must still choose quantity/fulfilment and explicitly order/pay. Unavailable or delisted Products remain in purchase history without an invalid Buy Again action. Review actions reuse canonical Review eligibility. | PR-006, 27 Oct 2026 |
| R-11 — Buyer account controls and deletion parity | The 13 October Privacy/Auth designs govern account lifecycle and deletion. | Authenticated Buyer account controls include Edit Profile, saved discovery area, Appearance, notification preferences, Privacy & Security, Help & Support, Delete Account and Sign Out. Delete Account uses verification, consequence preview, authoritative blockers and typed confirmation; Mobile and Website must share policy wording/data rather than independently reauthoring deletion consequences. Sign Out changes session state only. | PR-006, 27 Oct 2026 |
| R-12 — Seller roles and team presentation | ADU-AUTH-02 v3.2 already defines Owner-derived ownership, Admin plus four specialist roles and multi-role union. | Canonical Seller roles remain Owner (derived, never assignable), Admin, Analyst, Campaign Manager, Inventory and Sales Support. A member may hold multiple non-Owner roles; effective access is the union subject to surface/resource/domain checks. Active membership cannot be left with zero role. No Seller role confirms payment, sets Trust, decides Claims, creates Handoff evidence or edits Reviews. Ownership transfer and Seller closure remain Owner-only. Prototype role matrices and member-edit UX now reflect this design. | PR-007, 27 Oct 2026 |
| R-14 — Courier compensation source and immutable Order snapshot | The 13 October Fulfilment/Order/Finance designs already treat delivery charge as Seller-defined, shown before payment and snapshotted on the Order. | There is no per-Courier-relationship compensation schedule in the current MVP. One Seller-level Courier Delivery term applies to future Checkout quotes. Once the Buyer accepts/pays, the Order’s Courier Delivery/compensation amount is immutable history. Delivery Offers, Seller selection surfaces and Courier Mode display the Order snapshot. Changing Seller terms affects future quotes only. | PR-008 correction, 27 Oct 2026 |
| R-15 — Courier offer eligibility and sequence | The 13 October designs already require Courier acceptance and one active accepted delivery. | A direct Delivery Offer may be sent only to a Courier who is in the Seller’s Approved pool relationship, Adulis-verified, AVAILABLE and has no active accepted delivery. BUSY Couriers may remain visible for context but are disabled with reason. UNAVAILABLE, restricted, pending, removed or non-approved Couriers are ineligible. Seller request/offer never equals assignment; Courier acceptance atomically rechecks eligibility/capacity. Mark Ready precedes offer. Offer timing must respect the one-active-delivery rule. | PR-008 correction, 27 Oct 2026 |
| R-17 — Theme and appearance architecture | The 13 October pack contains shared design tokens; final brand palette is not contract-closed. | Production clients use semantic theme roles with Light, Dark and System plumbing so palette changes are centralized. Theme Lab (Baseline plus ten candidates) is prototype evaluation tooling only and must not ship as production theme choices. No candidate palette is canonical until founder approval. Operational status colors remain semantic and independent from brand palette. | Theme Lab + WO-001, 27 Oct / 8 Nov 2026 |
| R-18 — Mobile app identifiers and production foundation | ADU-MOB-02 v4.2 already specifies one React Native/Expo app with Buyer, Seller Companion and Courier modes. | Canonical application identifiers are Android applicationId com.adulis.app and iOS bundleIdentifier com.adulis.app. One Expo/React Native app exposes Buyer, Seller Companion and Courier modes under one ordinary MOBILE session. Mode switching changes active context, not identity/session. Available modes are backend-authoritative; active mode is UI state. Operator is never a Mobile mode. | WO-001 / WO-001A, 8 Nov 2026 |
| R-19 — Mobile-safe localization and Amharic release gate | The 13 October designs prohibit Mobile software-subscription purchase/billing surfaces and keep commercial subscription management in Console. | Mobile runtime imports only a physically isolated mobile-safe/shared localization catalogue; Console-only subscription, tier, billing and software-purchase copy must not enter the Mobile import graph even if hidden at runtime. English/Amharic key parity is enforced. Current Amharic strings are not approved human translations; Amharic remains disabled for users until a human translation/review pass is complete. | WO-001A, 8 Nov 2026 |
| R-20 — Courier MOBILE API/auth contract correction | ADU-AUTH-02 v3.2 and ADU-MOB-02 v4.2 already define Courier as a third ordinary Mobile mode using the ordinary MOBILE session. | Executable API/auth contracts must be corrected to match the design: Courier uses audience=MOBILE with backend-verified Courier relationship/capability, exact resource scope and permission surface. Do not move Courier back to Console/cookie auth to match stale implementation contracts. Until the corrected contract is published, production Mobile must not fabricate Courier API calls. | WO-001 discovery + October 13 AUTH/MOB authority |
| R-21 — Mode eligibility bootstrap and generated API-client types | The 13 October design assumes server-authoritative relationship/permission evaluation. | Bootstrap/session contracts must expose sufficient authoritative relationship/capability information to derive Buyer/Seller Companion/Courier mode availability without trusting a client role. The shared generated API-client seam must export generated OpenAPI path/types. Mobile must not hand-write duplicate DTOs to compensate for missing schemas or exports. | WO-001 / WO-001A discovery, 8 Nov 2026 |
| R-22 — Canonical launch Adulis surcharge remains zero | The October 13 Finance/Order/Market/KB designs set launch Adulis surcharge to 0 bps / amount zero. | Launch Adulis surcharge is disabled: 0 bps and zero amount. Provider processing fee is a separate provider-policy route and may be Buyer-paid only when that route is explicitly permitted and confirmed. The prototype canonical-rules line claiming a current 0.5% Adulis Buyer surcharge is stale and must not be implemented. | October 13 pack reaffirmed against stale prototype rule |
| R-23 — Canonical Account architecture is resolved | The October 13 pack already defines one ordinary Account with Buyer, Seller and Courier relationships plus a distinct Operator identity domain. | The production Account model is not unresolved for these surfaces: one ordinary Account can act as Buyer, own Sellers, hold authorized Seller team membership/roles, and hold one Courier profile with many Seller relationships. The Mobile app exposes Buyer, authorized Seller Companion and Courier contexts under the same ordinary Account session. Operator Console remains a separate privileged identity/session. Prototype role-switcher scaffolding is not itself authority, but the October 13 production model is. | October 13 AUTH/MOB/KB reaffirmed against stale prototype rule |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.

### Open / deferred items

• Courier MOBILE executable contract and mode-eligibility/bootstrap projection remain implementation-contract gaps; the product/system design remains one MOBILE session with Courier as an authorized relationship context.

• Amharic user release remains blocked on human translation/review even though rendering and key parity are technically validated.

• Final production brand palette remains open; semantic theme architecture is required, Theme Lab candidates are not canonical.

• Seller Stories are an approved prototype/product direction but their production API/storage/event/media/retention contracts remain open.
