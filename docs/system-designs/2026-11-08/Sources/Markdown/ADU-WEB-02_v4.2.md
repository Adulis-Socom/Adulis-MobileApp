# Adulis Company Website
Version 4.2 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v4.1 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Complete amended baseline: 12 October 2026. The supplied correction prompt and owner decisions supersede the conflicting reviewed source wording. Every original numbered body section and unaffected table/graphic is retained; targeted contracts, examples, tests, invariants and dependent definitions are reconciled. The historical audit remains unchanged.

| Document control | Amendment baseline |
| --- | --- |
| Version history | 4.0 reviewed 8 October 2026 -> 4.1 amended 12 October 2026 -> 4.2 post-October-13 reconciled 8 November 2026. |
| Source | ADU-WEB-02_Adulis_Company_Website_System_Design_v4.1.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Executive architecture decision

The Adulis Company Website will be a server-rendered, mobile-first, internationally oriented, CMS-backed public website with a small set of tightly isolated write flows and a standalone Website backend.

The default homepage at `/` is the international entry point. Ethiopia is represented through a dedicated market page rather than making the whole website Ethiopia-only.

### Architecture objectives

• Global-first public narrative from Day 1.

• Strong SEO and shareable public pages.

• English as the international default, with Amharic as a first-class locale and a dedicated Ethiopia implementation page.

• Accessibility, low-end-device support and constrained-network performance.

• A first-party CMS for public content, legal pages, availability/demo content and market-specific overrides.

• A standalone Website API for Website-owned concerns such as CMS delivery, waitlist and contact.

• Strict separation from Adulis marketplace business logic.

• Account deletion and platform content reporting remain main-platform workflows even when their UI is hosted on the Company Website.

```
INTERNET
   |
   v
ADULIS COMPANY WEBSITE  (adulis-web monorepo)
   |-- Global public content / CMS
   |-- Ethiopia market page
   |-- Availability demo page
   |-- Waitlist / Contact  ------> Website API + Website DB
   |-- Account deletion UI ------> Adulis Platform API
   `-- Report-content UI --------> Adulis Platform API
```

The Website is therefore globally public, operationally independent, and intentionally narrow: it explains Adulis, acquires users, publishes policy/content, and hosts safe public entry points without becoming a second marketplace frontend.

## 2. Product boundary

### Company Website owns

• Adulis corporate identity and global public narrative.

• International homepage and market/availability information.

• Dedicated Ethiopia implementation content.

• Seller acquisition and buyer education.

• Explanation of Product Posts, Scene Posts and the commerce-focused FYP.

• Trust & Safety, About, Press and Help Center.

• First-party CMS, navigation, legal/public policy publishing and versioning.

• Seller waitlist and contact intake.

• Public SEO content and public status/maintenance messaging.

• UI entry points for Account Deletion and Report Content.

### Company Website does NOT own

• FYP generation, Search ranking or personalized recommendations.

• Seller Storefront catalogue or Product/Scene Post business state.

• Cart, checkout, Chapa payment state, Orders, Inventory or fulfilment.

• Trust calculation, claims decisions, moderation decisions or seller eligibility decisions.

• Account deletion execution, anonymization, retention orchestration or session revocation.

• Seller Console, Operator Console or platform billing logic.

The Website's own backend may store Website-owned CMS and intake data, but it must not hold Adulis commerce truth.

Scene publication and visibility belong to the Platform Content domain. The Website explains PUBLIC/PRIVATE behavior but cannot publish, hide, restore or archive a Scene. Search and Collections are platform/mobile capabilities; the Website provides public education only.

## 3. Product narrative and global positioning

The previous Website narrative was too narrow because it treated Adulis mainly as the structured-commerce layer behind external social audiences. That acquisition loop still matters, but the current product also creates its own shopping discovery.

Adulis now addresses two separate problems:

### Problem A - social selling is operationally messy

Sellers attract interest on social platforms, then lose time in DMs, repeated questions, unclear stock, weak order evidence and fragmented buyer journeys.

### Problem B - traditional e-commerce browsing is often boring

Large catalogue grids are structured but can feel repetitive and uninspiring. TikTok demonstrates how compelling product discovery becomes when sellers creatively show how products look, work, combine and fit into real life.

Adulis combines the strengths without becoming a general social network:

Product Posts show what is being sold. Scene Posts show products in context - for example an outfit, setup, routine, comparison or demonstration - and connect Buyers to the current Product Posts. A Product Post is the structured sellable Product representation. A Scene Post is Seller-authored image-led commerce/discovery content with one or more eligible same-Seller Product Post tags; it is not unrestricted social posting.

Similar Finds and Complete the Scene are not launch messaging. They remain deferred behind feature flags until Adulis has enough products and behavioral data.

![Inspiration connected to commerce truth](graphics/WEB_01.svg)
*Figure 01. Inspiration connected to commerce truth. Product Posts supply structured commerce; image-led Scenes connect context and discovery to current Products.*

## 4. Website goals

### Primary goals

• Make an international visitor understand Adulis within seconds.

• Explain why Adulis makes online shopping discovery more engaging than static catalogue browsing while preserving structured commerce.

• Convert qualified sellers into waitlist applications where seller onboarding is not yet open.

• Educate buyers about Product Posts, Scene Posts, Trust, checkout, fulfilment and handoff.

• Establish company credibility for partners, press, app stores, investors and regulators.

• Publish policy, legal and safety information from one versioned CMS.

• Provide globally reachable Account Deletion and Report Content entry points.

### Global-launch constraint

The Website is global from Day 1, but market-specific product availability, seller onboarding, checkout providers, fulfilment and legal rules may differ. Public content must distinguish "Website available worldwide" from "commerce feature available in this market.

## 5. Website lifecycle

The Website must support multiple operating phases without another architectural rewrite.

### Phase A - Global public launch

`/` is the international homepage. The Website is accessible worldwide. `/markets/ethiopia` explains the Ethiopia implementation. `/availability` contains professionally written demo/placeholder availability content until the international rollout model is approved.

Seller CTA may remain waitlist-based in markets where onboarding is controlled. Buyer CTA may point to product education or app availability as configured.

### Phase B - Market enablement

As a market receives approved seller eligibility, payment, fulfilment, legal and support configuration, the CMS publishes the real market page and availability state. No frontend rebuild is required.

### Phase C - Expansion

Add market pages, languages, policies, app-store links, careers, partnerships and press releases through content/configuration.

Pricing does not progress through these phases automatically. `/pricing` remains a Coming Soon page until Seller subscription/plan packaging is explicitly approved.

## 6. Pricing and business-model representation

Status: CURRENT TRANSACTION POLICY / SELLER PACKAGING OPEN.

The commerce architecture includes a versioned launch-disabled zero Buyer-side Checkout surcharge. Payments/Checkout own the configured basis and authoritative quote; the Website performs no fee calculation.

Seller subscription tiers, Seller plan names/prices, advertising, entitlement packages and broader long-term monetization remain separately open and not publicly packaged. Do not claim the entire business model is undefined.

### Public pricing route

```
/pricing = Pricing Coming Soon
```

Keep this stable route without Seller tier cards, subscription prices, free-period promises, entitlement comparisons or future billing mechanics until separately approved.

The transaction percentage is not automatically approved for marketing publication. Any required public fee disclosure must use approved versioned commercial/legal content; the Website must not invent promotional copy around it.

When Seller packaging is approved, publish a versioned CMS commercial-policy revision. The Website remains presentation only; billing and commerce truth belong to the Platform.

## 7. Trust representation

The Website explains Trust but never computes it.

Public explanation should cover NEW / REBUILDING / ESTABLISHED / TRUSTED, evidence-based behavior, separate product and seller-service reviews, handoff evidence and public reliability facts.

Commercial spend must never be described as purchasing Trust. The Website also must not expose internal anti-gaming thresholds, risk models or private moderation reasoning.

Global pages explain the principle. Market pages may show only policy details that are explicitly approved for public release.

REBUILDING identifies a Seller with prior Adulis transaction history working back toward Established after falling below its requirements. It is distinct from NEW. No Trust level limits Product count.

## 8. Information architecture

Recommended current route tree:

```
/
|-- /how-it-works
|-- /for-sellers
|-- /for-buyers
|-- /trust-and-safety
|-- /availability                 # demo/placeholder until rollout is finalized
|-- /markets/ethiopia             # dedicated Ethiopia implementation
|-- /pricing                      # Coming Soon only
|-- /about
|-- /press
|-- /help
|-- /contact
|-- /waitlist
|-- /terms
|-- /privacy
|-- /seller-terms
|-- /refunds-and-disputes
|-- /prohibited-products
|-- /report-content
`-- /account-deletion
```

```
/am
`-- localized equivalents where content exists, including /am/markets/ethiopia
```

`/` is the canonical international English homepage. `/en` may redirect to `/` for compatibility. Future locale prefixes can be added without changing the market-page model.

### Demo availability-page content

Until international availability is curated, `/availability` may use clearly non-contractual placeholder copy such as:

"Adulis is being prepared for international access from Day 1. Market-specific seller onboarding, checkout, fulfilment and policy availability may differ while our rollout model is finalized. This page will be replaced with confirmed market availability as each implementation is approved."

The demo must be labeled informational and must not invent country support.

## 9. Homepage

The international homepage has one job: make a visitor understand the product quickly.

### Recommended narrative order

### Hero

"Discover products through the way people actually like to see them used."

Secondary explanation: Adulis combines structured Product Posts with creative Scene Posts so buyers can move from inspiration to real product information and checkout.

### The problems

• Social selling creates DM overload, repeated questions, uncertain stock and fragmented transaction evidence.

• Traditional e-commerce often reduces discovery to repetitive grids and filters.

### What changes

```
Creative product discovery
+ canonical Product Posts
+ Seller Storefronts
+ Trust
+ Chat assistance
+ Gateway checkout
+ Fulfilment / handoff
```

### Product Posts and Scene Posts

Show a Product card beside an image-led outfit/demo/routine Scene with same-Seller Product tags. Explain the connection from inspiration to current Product information.

### Commerce-focused FYP

Emphasize enjoyable discovery that leads toward product interest and commerce, not an unrestricted entertainment feed.

### Global availability

Link to `/availability` and `/markets/ethiopia` without claiming unapproved market features.

### Trust & safety

Summarize verification, handoff evidence, separate review dimensions and Trust Ladder.

The homepage must not show pricing details while `/pricing` is Coming Soon.

For You contains Scene Posts only and uses photos/images at launch. Product Posts are reached through tags, Search, Shop, Seller Storefronts, direct links and Collections. Native Seller video is not a launch FYP feature. Keep detailed private/restoration rules in Help and For Sellers.

## 10. How It Works page

This page explains the product in plain language without implementation internals.

1. Discover a Scene Post in For You, or find Product Posts, Sellers and Scene Posts through Marketplace Search.

2. Open a tagged or directly discovered Product Post.

3. Review current Product, Variant, availability, Seller and Trust information.

4. Select Product/quantity and begin the seller-specific Checkout in Adulis.

5. Complete gateway payment where the Market supports it.

6. Seller preparation begins after provider/backend-verified payment.

7. Receive or collect the goods through the supported fulfilment method. Courier Delivery uses verified Pickup and Delivery handoffs. Adulis may capture bounded location evidence at these checkpoints where available.

8. Complete the applicable connected Handoff; location is supporting evidence, not proof of delivery.

9. Leave Product and Seller-service Reviews when eligible, or use Claims where appropriate.

10. Return to discovery; authenticated Buyers may save individual Product Posts and whole Scene Posts in private Collections.

In the Ethiopia implementation page, describe Chapa only where that integration is enabled. Global copy uses gateway checkout unless a Market-specific provider is confirmed.

Explain both acquisition paths: external social -> Seller Storefront -> Product/Scene; and Adulis Home/For You -> Scene Post -> Product Post.

![Discovery to verified receipt](graphics/WEB_02.svg)
*Figure 02. Discovery to verified receipt. Every Checkout/payment/Order remains Seller-specific; final receipt is verified by the Buyer or authorized delegate.*

## 11. For Sellers

The seller page is a primary conversion surface and must reflect the current admission model.

### Who Adulis is for now

• Businesses with an established, recognizable social-media business presence.

• Content creators who also have legitimate business/seller status.

A business with no meaningful social-media presence, or a creator with no business/seller status, is not part of the current early admission policy.

### Seller value proposition

• Bring existing social-commerce credibility into a structured store.

• Create canonical Product Posts for sellable items.

• Create Scene Posts - outfit content, tutorials, demonstrations, setups, comparisons and other commerce-relevant creative media - and tag one or more products.

• Reach buyers through an internal commerce-focused FYP, not only existing followers.

• Manage catalogue, inventory, chat, orders, fulfilment and Trust through Adulis seller tools.

• Understand content-to-commerce performance over time.

Do not publish pricing or plan details. Link `/pricing` to Coming Soon.

### Scene publication and availability

A Scene must tag at least one eligible Product Post owned by the same Seller. At initial publication, at least one tagged Product must be currently available/in stock; zero-tag or all-unavailable Scenes cannot become public. Other Seller, Market, media and moderation requirements also apply.

If every tagged Product in a published Scene becomes unavailable, Adulis automatically makes the Scene private so Buyers are not shown content with nothing currently purchasable. It remains published; it is not archived or deleted.

When at least one tagged Product becomes available again, Adulis can automatically restore the Scene to public visibility after rechecking every other eligibility requirement. Another restriction can prevent restoration.

### Seller admission and fulfilment

Current admission may use Account/phone control, social-account control, social-commerce business evidence and Seller/business information. Adulis does not currently collect Government ID, passport, identity-card scans or selfies for Seller admission. A payment provider's KYC is provider-specific onboarding.

Sellers can work with approved Couriers through Adulis Courier relationships and fulfilment tools. Private Courier Pools and the Cross-Seller Courier Network support persistent Courier identity and approval by multiple Sellers, with one active accepted delivery per Courier in MVP.

## 12. For Buyers

Explain the buyer proposition in global language:

• Discover products through creative, commerce-connected content instead of only static catalogue grids.

• Open the canonical Product Post to see current price, variants, availability and seller information.

• Understand who is selling through Storefront and Trust information.

• Use structured chat and seller information instead of scattered DMs.

• Proceed to gateway checkout where that market is enabled.

• Courier Delivery uses verified Pickup and Delivery handoffs. Adulis may capture bounded location evidence at those checkpoints where available; precise coordinates are not public.

• Use fulfilment/handoff evidence and post-purchase review flows where applicable.

Avoid guarantees about product authenticity, delivery, refund outcome, fraud prevention or universal country availability. The page must never imply that every feature is available in every country merely because the Website is globally accessible.

Marketplace Search includes Product Posts, Sellers and PUBLIC Scene Posts. Buyers may save individual Products and whole Scenes in private Collections. For You is Scene-only and image-led at launch. The Website explains these features; it does not implement their application workflows.

## 13. Trust & Safety

Trust & Safety remains one of the strongest public pages.

### Explain

• Seller admission and verification principles.

• NEW / REBUILDING / ESTABLISHED / TRUSTED as an evidence-derived Trust Ladder.

• Product ratings and seller-service ratings as separate concepts.

• Handoff and fulfilment evidence.

• Claims and moderation as evidence-based workflows.

• Scene Post relevance rules and the anti-social-network guardrail.

### Do not claim

• guaranteed safety or guaranteed refunds;

• that commercial plans buy Trust;

• that the Website or frontend independently verifies payment;

• that a seller is criminal/fraudulent based on private signals;

• that one market's policy applies globally.

Market-specific safety/legal details belong to versioned market content.

Seller admission may verify phone/Account control, social-account control, social-commerce evidence and Seller/business information. Adulis currently does not require Government ID, passport, identity-card scan or selfie collection; provider-specific KYC belongs to provider onboarding.

Rebuilding means a Seller with prior transaction history is working back toward Established. No Trust level limits Product count. Do not publish private thresholds or unsupported safety/fraud guarantees.

Courier handoffs: Seller displays Pickup QR and the assigned Courier scans; Courier displays final Delivery QR and the Buyer or authorized delegate scans. QR is primary, OTP is fallback, and Manual Verification is emergency recovery. Precise checkpoint locations are private and never delivery proof by themselves.

## 14. About

The About page should be international in tone from Day 1.

Suggested structure:

• Mission - make online product discovery engaging without losing commerce structure.

• Origin - Adulis takes its name from the historic Aksumite port and the idea of a gateway for trade.

• Product philosophy - Product Posts show what is sold; Scene Posts show those products in context; commerce-focused discovery connects inspiration to canonical commerce truth.

• Ethiopia - link to the dedicated implementation page rather than making the corporate story Ethiopia-only.

• Company/contact information.

Do not publish an unapproved international expansion roadmap or pricing model.

## 15. Press

Press should be CMS-managed and globally usable.

Provide:

• company description and approved boilerplate;

• founder/company media assets;

• press releases;

• product screenshots/mockups clearly labeled where needed;

• contact route;

• market-specific facts only when confirmed.

Press copy must distinguish the globally available Website from market-specific commerce availability. No release should announce unsupported countries, pricing or rollout dates without explicit approval.

## 16. Help Center

Help Center content is CMS-managed rather than hard-coded Git-only content.

Initial topics:

• What Adulis is.

• Product Posts vs Scene Posts.

• Seller eligibility.

• FYP discovery.

• Product availability and checkout.

• Chapa checkout on the Ethiopia implementation where applicable.

• Fulfilment, approved Courier relationships, verified handoffs and bounded checkpoint evidence.

• Trust, reviews and claims.

• Account deletion.

• Report Content.

• International availability and market differences.

Help pages remain statically renderable from published CMS revisions so the Help Center does not require client-side JavaScript.

Additional launch Help topics: Scene publication requires Product tags and at least one available Product; automatic private visibility and restoration without archival/deletion; Marketplace Search result types; saving Products and whole Scenes in Collections; four Trust labels including REBUILDING; Seller admission without Adulis Government-ID collection; provider-specific onboarding; and approved versioned Checkout fee disclosure.

Detailed Scene availability behavior belongs here and in For Sellers rather than overloading the Homepage. Published Help copy must not expose event names, internal reason codes or precise checkpoint coordinates unnecessarily.

## 17. Rendering architecture

Recommended frontend: Next.js + React + strict TypeScript using the App Router.

Use server-rendered/static output by default. CMS publication feeds build-time/static-generation or controlled revalidation. Client components are limited to genuinely interactive features such as navigation, forms, accessible accordions and small visual demonstrations.

The Website frontend talks to two backends for two different reasons:

• Website API - CMS delivery, waitlist, contact and Website-owned operations.

• Adulis Platform API - account deletion, platform content reports and other platform-owned public workflows.

The frontend must remain useful HTML before JavaScript executes for core content.

## 18. Rendering modes

Use rendering strategy according to content ownership.

### Static / revalidated from CMS

Home, How It Works, For Sellers, For Buyers, Trust & Safety, About, Press, Help, Availability, Ethiopia market page, Pricing Coming Soon, Prohibited Products and legal documents.

### Dynamic Website routes

Waitlist, Contact and Website-owned form status.

### Dynamic Platform-backed public flows

Account Deletion and Report Content use the main Adulis Platform API. They may be rendered by the Website frontend, but their business state is not stored in the Website database.

Do not turn the site into a client-heavy SPA merely because a CMS or standalone Website API exists.

## 19. CMS architecture

A CMS is now required.

The preferred launch design is a small first-party CMS inside the `adulis-web` monorepo rather than introducing a broad external dependency without need.

### CMS responsibilities

• Global pages and navigation.

• Locale variants.

• Market pages and market overrides.

• `/availability` demo/placeholder content and later confirmed availability content.

• Press and Help Center.

• SEO metadata and structured-data fields.

• Legal/public-policy documents with immutable published versions.

• Redirects and publication status.

• Public media references.

### Content workflow

```
DRAFT -> REVIEW -> PUBLISHED -> SUPERSEDED / ARCHIVED
```

Recommended CMS roles: CONTENT_EDITOR, PUBLISHER, LEGAL_PUBLISHER and ADMIN. Legal-policy publication should require stronger review than ordinary marketing copy.

Published content is versioned. A publish action emits cache/revalidation work; it does not mutate marketplace state.

## 20. Repository structure

The Company Website is no longer inside the main Adulis platform repository.

Canonical repository boundary:

```
adulis-web        # independent monorepo: Website frontend + Website API + CMS
adulis-platform   # core Adulis backend/platform
adulis-mobile     # mobile application
```

The Website repository has its own build, CI, deployment and release lifecycle. It may consume generated public Platform API clients/contracts, but it must not import private platform modules or database repositories.

Repository independence reduces blast radius: a marketplace code change should not be required to deploy corporate content, and a Website/CMS incident should not mutate commerce state.

## 21. Proposed monorepo structure

Recommended `adulis-web` monorepo:

```
adulis-web/
|-- apps/
|   |-- site/          # Next.js public Website
|   |-- api/           # NestJS + Fastify Website backend
|   `-- cms/           # protected CMS/admin UI
|-- packages/
|   |-- ui/
|   |-- contracts/
|   |-- content-schema/
|   |-- i18n/
|   |-- config/
|   |-- observability/
|   `-- testing/
|-- infra/
|-- docs/
|-- package.json
`-- tsconfig.base.json
```

`apps/site` never imports database code. `apps/api` owns Website DB access. `apps/cms` uses authenticated Website API endpoints. Main-platform Account Deletion is consumed only through HTTPS APIs.

## 22. Navigation

Navigation has one CMS-backed configuration source used by desktop header, mobile navigation, footer and sitemap generation.

Suggested international header:

• How it works

• For sellers

• For buyers

• Trust & Safety

• Availability

• Ethiopia

• About

• Help

• Language

• Join waitlist / Start selling according to market state

Pricing may appear in the footer or navigation only as a link to `/pricing`, which renders Coming Soon and nothing else.

Do not create a separate "International" navigation item for the root homepage; `/` is already the international entry point.

## 23. Internationalization and localization architecture

Internationalization and market localization are different dimensions.

### Locale

The default international locale is English at unprefixed URLs. Amharic is first-class at `/am/...`. Future languages may use additional locale prefixes.

### Market

Market-specific public implementation pages use `/markets/<market-slug>`, for example `/markets/ethiopia`. Locale and market can combine: `/am/markets/ethiopia`.

A visitor's locale choice must not silently assert their market eligibility. Likewise, geolocation must not automatically redirect users into a different legal/policy context without a clear user-visible path.

Use explicit market metadata and locale metadata in CMS content rather than encoding market rules inside translated strings.

## 24. Translation and market-content storage

Store complete sentences and page blocks, not language fragments.

CMS content keys should carry:

• locale;

• market scope (`GLOBAL` or explicit market);

• content version;

• publication state;

• effective date for policy/legal pages;

• SEO metadata;

• optional fallback relationship.

Global English is the default fallback for marketing content. Legal/policy pages must not silently fall back across jurisdictions if the required market-specific policy is absent; the route should fail closed to an approved generic policy or unavailable state.

## 25. Typography

Self-host:

• primary Latin font;

• Ethiopic-compatible fallback.

Use unicode-range or equivalent subsetting so an English visitor does not download unnecessary Ethiopic glyph payload. The prior specification already requires a Latin-first/Ethiopic-fallback stack and treats missing Ge'ez glyphs as a launch failure.

## 26. Responsive architecture

Design order: 360px

```
v
```

390px

```
v
```

Tablet

```
v
```

Laptop

```
v
```

Large desktop

```
Not desktop -> shrink.
```

The existing design requires complete usability at 360px and forbids horizontal scrolling. No fixed-height text containers. Amharic can expand substantially compared with English, and the existing design explicitly budgets around 40% text expansion.

## 27. Forms architecture

Public forms are the main Website write surface.

Website-owned forms:

• Seller Waitlist.

• Contact.

Platform-owned workflows rendered on the Website:

• Report Content.

• Account Deletion.

Every form must validate server-side, work without JavaScript where feasible, use localized errors, preserve safe values after recoverable failure, apply rate limits, avoid secrets/PII in URLs and logs, and enforce payload-size limits.

The account-deletion UI must not send arbitrary account IDs. Identity is derived by the Platform backend from the authenticated/deletion-verification context.

## 28. Form execution architecture

Website-owned intake flow:

```
Browser
  | POST
  v
Website API (NestJS/Fastify)
  |-- validate / normalize
  |-- residency-policy resolve
  |-- abuse / rate-limit
  |-- consent + policy-version snapshot
  |-- persist to Website PostgreSQL
  `-- transactional outbox -> BullMQ/Valkey
                         |-- notification
                         `-- operational analytics
```

Account deletion and content-report flows use a different path:

```
Browser -> Adulis Platform Public API -> owning Platform domain
```

Email is never the system of record.

## 29. Standalone Website backend

The Website now has its own standalone backend inside `adulis-web`.

### Website API owns

• CMS content/revision APIs.

• CMS authentication/authorization for Website editors.

• Waitlist and contact intake.

• Website-only rate-limit/idempotency state.

• Website email/notification jobs.

• Website analytics ingestion where used.

• Website database migrations and retention jobs.

### Website API does not own

• Adulis Account lifecycle/deletion.

• Platform authentication sessions.

• Platform moderation/report decisions.

• Product, seller, order, checkout, payment, Trust or FYP state.

This backend uses the current Adulis engineering stack but is deployed as a separate service and has separate database credentials.

## 30. Waitlist

Recommended seller-waitlist fields:

• full name;

• registered/contact phone;

• email;

• country/market of interest;

• city/region where relevant;

• business/social platform;

• social handle or business-page URL;

• optional audience/follower range;

• product category/business type;

• business status declaration;

• consent/policy version.

The form should make the current admission expectation clear: early sellers are businesses with established social-media business presence, or creators who also operate a legitimate business/selling activity.

Flow: validate -> normalize phone/email -> resolve residency policy -> deduplicate -> persist -> issue non-sequential reference -> outbox notification -> success.

## 31. Waitlist reference

Use non-sequential public references such as `ADL-WL-26-X8K4P2`.

The reference is safe to quote in support messages but is not authentication and must never expose a database primary key. Status lookup, if offered later, requires an additional authenticated or possession-bound mechanism.

## 32. Waitlist data model

Suggested Website-owned waitlist model:

| Field | Purpose | Use / classification |
| --- | --- | --- |
| id | Internal UUID | Primary key |
| public_ref | Human-safe reference | Non-sequential support reference |
| name | Applicant name | PII |
| phone_e164 | Normalized phone | PII / dedupe |
| email_normalized | Normalized email | PII / dedupe/contact |
| country_code | Declared country | Residency/market routing input |
| city_region | Optional location | Market qualification |
| social_platform | Primary platform | Eligibility evidence |
| social_handle_url | Business/creator page | Eligibility evidence |
| audience_band | Optional range | Avoid unnecessary exact-value dependence |
| business_type | Category/business description | Qualification |
| business_status | Business/seller declaration | Admission policy |
| consent_version | Public policy snapshot | Auditability |
| residency_zone | Resolved storage zone | Data-residency enforcement |
| status | Workflow state | Operations |
| created_at | Server timestamp | Auditability |

Do not store platform account data or commerce data in the Website waitlist table.

## 33. Waitlist status

Suggested waitlist states: `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_INFO`, `QUALIFIED`, `NOT_CURRENTLY_ELIGIBLE`, `INVITED`, `CLOSED`.

The Company Website does not make final platform seller-eligibility decisions merely because the intake record is marked qualified. Platform onboarding revalidates current policy.

## 34. Duplicate waitlist handling

Duplicate handling should consider normalized phone and normalized email, but must avoid unsafe account enumeration.

For a repeated submission, return a generic localized response and attach/update permitted non-sensitive fields according to policy. Do not tell an unauthenticated visitor that a specific phone/email is already associated with an Adulis account.

Country/residency changes must not silently move previously stored PII between storage zones; that requires an explicit lifecycle/migration rule.

## 35. Correcting a mistyped phone or email

Mistyped contact details need a controlled correction path.

For phone correction, verify possession of the replacement number if the workflow relies on phone contact. For email correction, verify the new email when verification is enabled.

Avoid raw edit links containing phone/email. Use short-lived opaque correction capabilities stored in Website PostgreSQL and/or Valkey with strict expiry and single-use semantics.

Corrections must preserve submission history and policy/residency metadata rather than rewriting audit facts invisibly.

## 36. Waitlist retention

Waitlist retention must be policy-driven and residency-aware. Store `retention_policy_version`/`consent_version` (or equivalent) so a purge job can determine eligibility without inventing duration in code. Records needed for an active invitation/review may be retained according to approved policy; stale/closed records are purged or anonymized. Exact periods require legal/business approval.

## 37. Contact system

Contact is Website-owned intake. Collect the minimum needed fields (for example name, email, optional phone, category and message), apply residency-policy resolution, rate limits and retention. Persist before sending email. Do not use contact as a substitute for Platform support cases that require authenticated account/order context.

## 38. Report Content

The Company Website hosts the public Report Content UI, but platform content reporting belongs to `adulis-platform` Moderation.

The Website calls the Platform report API over HTTPS. It does not persist a second authoritative moderation case/report record in the Website database. Public report pages must not leak whether inaccessible private content exists and must protect against reporting abuse.

## 39. Account deletion

Account deletion UI is hosted on the Company Website, but all deletion logic remains inside `adulis-platform`.

Canonical public route: `www.adulis.com/account-deletion`

The Website is an API client only. It has no Platform database credentials and no lifecycle/deletion business logic.

### Shared deletion workflow

```
Adulis Mobile ---------Seller Console ---------+--> Adulis Account Deletion API
Company Website -------/           |
                                  v
                         Account Lifecycle Service
                                  |
                  Auth / DB / Media / FYP / Orders /
                  Chat / Notifications / other domains
```

### Self-service API shape

`POST /v1/me/account-deletion/start` `POST /v1/me/account-deletion/verify` `POST /v1/me/account-deletion/confirm` `GET /v1/me/account-deletion/status`

Never expose `DELETE /users/:userId` to a public frontend. The backend derives identity from the verified context.

### Platform-side lifecycle contract (integration reference)

The canonical Platform workflow creates an `account_deletion_requests` record with fields approximately: `id`, `account_id`, `status`, `requested_at`, `verified_at`, `scheduled_for`, `completed_at`, `initiated_from`, `retention_reason`, and `failure_reason`. This table lives in `adulis-platform`, not the Website database.

When deletion executes, Platform responsibilities include session/token revocation, push-token removal, authentication disablement, and typed lifecycle handling across Auth, PostgreSQL-owned domains, Media/R2/CDN, Catalogue/Storefront, Chat, Notifications, Trust, FYP/Recommendation, Analytics and Search.

The Platform may emit an internal `account.deleted` event containing `accountId`, `deletionRequestId` and timestamp so owning domains can delete/anonymize user-specific state. FYP-specific deletion includes watch/dwell history, clicks, product interactions, recommendation profiles/features and other account-linked personalization data according to Privacy policy.

Completed transaction, legal, security, fraud, claims/dispute and audit records may require minimum retention or anonymization rather than blind deletion. The Website only renders the backend's explanation/status.

The deletion process is orchestrated: step-up -> request -> blockers/holds -> session revocation -> domain lifecycle tasks -> deletion/anonymization -> completion/audit. It is never one SQL DELETE.

## 40. Deletion blocked state

Deletion may be initiated even when it cannot finish immediately.

Current blocker categories include:

• active Orders or in-flight checkout/payment processes;

• unresolved claims/disputes;

• seller obligations or open seller processes;

• required financial/accounting, fraud, security, legal or audit holds.

The old pre-payment transaction hold terminology is not used.

Suggested platform statuses include `REQUESTED`, `VERIFIED`, `PROCESSING`, `BLOCKED_BY_ACTIVE_TRANSACTION`, `COMPLETED`, `FAILED`, `CANCELLED`.

The Website displays backend-supplied status and user-facing reason codes. It does not derive blockers itself.

## 41. PII and data-residency architecture

The Website is worldwide, but personal-data storage cannot be treated as one undifferentiated global bucket.

The architecture therefore uses explicit residency policy resolution instead of hard-coding a region.

### Data classes

• PUBLIC_CONTENT - globally cacheable CMS output; no submitted PII.

• WEBSITE_INTAKE - waitlist/contact PII owned by the Website backend.

• PLATFORM_ACCOUNT - account/deletion/report data owned by the main Platform.

• ANALYTICS - privacy-minimized behavioral data with no form-field values.

### Residency decision

Every PII write includes an explicit declared country/market and resolves a versioned `residency_policy` before persistence:

```
country / market
      |
      v
residency_policy
  |-- storage_zone
  |-- allowed_processors
  |-- retention_policy
  |-- form_enabled
  `-- policy_version
```

If a country has no approved intake/storage policy, the public Website can still serve content worldwide, but the affected PII-collecting form fails closed to an unavailable/Coming Soon state instead of silently storing the data in an arbitrary region.

Cloudflare may cache public content globally, but submitted PII must not be placed in shared CDN caches, query strings or public object storage.

Exact jurisdiction mappings, transfer bases and processor approvals remain legal/business configuration. The software provides the enforcement mechanism without inventing international law.

## 42. Three-plane data architecture

Use three logical planes:

| Plane | Owner | Examples | Delivery / placement | Privacy boundary |
| --- | --- | --- | --- | --- |
| Global public read plane | adulis-web | CMS-rendered pages, assets, SEO | May be CDN-cached worldwide | Contains no submitted PII |
| Website private write plane | Website API | waitlist, contact, CMS admin, Website jobs | Region/residency-policy controlled | Own Website DB only |
| Platform account/commerce plane | adulis-platform | deletion, reports, auth, products, orders, payment, Trust | Main Platform policy | Website accesses only through HTTPS APIs |

This replaces the older assumption that all public forms and deletion must share one backend. Separation is intentional: repository/deployment boundaries follow domain ownership.

![Three distinct data planes](graphics/WEB_03.svg)
*Figure 03. Three distinct data planes. Global public delivery, residency-controlled Website writes and Platform account/commerce data have separate owners.*

## 43. Cloudflare usage

Cloudflare is the global edge layer for DNS, TLS, CDN/static delivery, cache control and appropriate edge security.

Use Cloudflare for:

• public static/CMS-generated pages;

• immutable public media and optimized Website assets;

• edge caching and compression;

• domain routing and security controls.

Do not cache authenticated CMS responses, account-deletion responses, form POST bodies or submitted PII. Do not treat Cloudflare storage/logging as a substitute for an approved residency policy.

Cloudflare configuration belongs to `adulis-web` delivery infrastructure; Platform domains remain separately deployable.

## 44. Analytics

Website analytics should answer public-site questions without becoming a surveillance layer.

Measure page views, CTA clicks, market-page visits, Help usage, waitlist funnel steps and performance. Do not send waitlist/contact field values, deletion status details, phone/email, payment information or sensitive platform state into analytics.

Website analytics may be stored/aggregated by the Website backend or forwarded through an approved first-party analytics contract. It is never a source of commerce truth.

## 45. Analytics architecture

Recommended Website analytics path:

```
Browser -> privacy-minimized event batch -> Website API
       -> validate / dedupe -> PostgreSQL analytics schema
       -> BullMQ/Valkey projection job -> aggregate dashboards
```

High-volume event storage may later move if measured load requires it. Do not add a third-party behavioral SDK by default.

Global/market attribution fields should use explicit locale and market-page context; do not infer a legal market from IP alone.

## 46. Public event schema

Example public event envelope:

```
event_name
event_version
client_event_id
session_id (privacy-safe)
page_key
locale
market_page_context (optional)
referrer_class
cta_key (optional)
timestamp
site_release
```

No arbitrary free-form event names. No form-field values. No raw phone/email. No deletion ticket. No full URL when it may contain sensitive parameters.

When public demonstrations name an entity, use versioned PRODUCT_POST, SELLER or SCENE_POST identifiers and Scene event naming. Legacy terminology migration belongs in a contract adapter; do not emit duplicate events for the same interaction.

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

## 47. Analytics privacy rules

Analytics privacy rules:

• no waitlist/contact field values;

• no phone/email;

• no deletion OTP/ticket/status detail;

• no Platform access tokens;

• no full IP retained longer than required for security/rate limiting;

• no raw social-handle value in analytics;

• no cross-site advertising identity graph;

• no analytics dependency for core site behavior.

Country/market analytics use coarse, approved context and must not substitute for residency/legal decisions.

## 48. SEO

SEO is a major Company Website responsibility.

Priorities:

• international canonical homepage at `/`;

• dedicated market pages such as `/markets/ethiopia`;

• locale-aware canonical/hreflang relationships;

• Product/company schema only where semantically correct;

• clean public policy/help/press routes;

• fast static rendering and strong Core Web Vitals;

• no indexing of submission/status pages.

The Website should rank for Adulis/company/product concepts without exposing private Seller/Buyer data.

## 49. International SEO

International SEO must distinguish language from market.

• `/` is the international English canonical homepage.

• `/am/...` is the Amharic locale.

• `/markets/ethiopia` is a market implementation page, not a language route.

• Future market pages use stable slugs and CMS metadata.

• `hreflang` is emitted only for real translated equivalents.

• Market pages use canonical URLs and must not generate thousands of thin geo pages.

The temporary `/availability` demo page should be indexable only if product/marketing owners want it discoverable; otherwise mark it `noindex` until real availability data is approved.

## 50. Structured data

Use Schema.org selectively:

• Organization for Adulis corporate information.

• WebSite for the Company Website.

• FAQPage only when the visible Help content qualifies.

• Article/NewsArticle for genuine press releases.

• BreadcrumbList where useful.

Do not publish product-price, aggregate-rating or marketplace structured data from the Company Website unless that page actually owns and displays the corresponding public information. Seller Storefront/product SEO belongs to the Storefront system.

Scene examples and visible CMS/Help content use Scene Post terminology and current public eligibility. Company Website structured data remains corporate/editorial; Scene/Product entity SEO is owned by Storefront and does not imply a Company Website catalogue.

## 51. Indexing rules

Index:

• international Home, How It Works, For Sellers, For Buyers, Trust & Safety, About, Press, Help, approved market pages and public policies.

Conditionally index:

• Availability demo page according to launch decision.

• Pricing Coming Soon only if it is useful; otherwise `noindex` until real commercial content exists.

Never index:

• account-deletion verification/status;

• waitlist/contact success states;

• CMS/admin routes;

• internal references;

• staging/preview deployments.

## 52. App deep linking infrastructure

Company-domain association files should support app handoff where applicable:

• `/.well-known/apple-app-site-association`

• `/.well-known/assetlinks.json`

Public marketing URLs may deep-link into the app when a stable public route exists. Account deletion remains a Website route and a Mobile-native flow; deep linking must never transfer deletion tickets or OTP values through URLs.

Scene links resolve the current canonical PUBLIC Scene before app display. A private or otherwise restricted Scene produces the approved safe unavailable response; old shared links cannot bypass visibility. Keep stable public URLs and redirects through any terminology migration.

## 53. Security architecture

Public does not mean harmless. Threats include:

• spam;

• scraping;

• XSS;

• dependency compromise;

• DDoS;

• form abuse;

• OTP abuse;

• report abuse;

• malicious uploads;

• injection;

• data leakage;

• accidental indexing;

• compromised CI/CD.

## 54. Security headers

Production responses should use appropriate controls including: Strict-Transport-Security Content-Security-Policy X-Content-Type-Options Referrer-Policy Permissions-Policy Frame restrictions should prevent clickjacking where embedding is not intentionally supported.

## 55. CSP

Start strict. Conceptually: default-src 'self' script-src approved first-party sources style-src approved first-party sources img-src approved media sources connect-src approved Adulis APIs frame-ancestors 'none' object-src 'none' base-uri 'self' form-action approved Adulis form origins Avoid weakening CSP simply to install marketing trackers.

## 56. Public form abuse protection

Use layered controls: Request

```
v
```

Payload size

```
v
```

Schema validation

```
v
```

Origin validation

```
v
```

Rate limit

```
v
```

Honeypot / bot signal

```
v
```

Duplicate detection

```
v
```

Persist CAPTCHA should not be the first defense. If a third-party CAPTCHA/bot provider is introduced, it must first pass privacy and residency-policy review.

## 57. Rate limiting

Do not scatter literals across controllers. Create configurable policies for: WAITLIST_SUBMIT CONTACT_SUBMIT REPORT_SUBMIT DELETION_OTP_REQUEST Dimensions may include:

• IP hash;

• device/browser signal;

• phone HMAC;

• endpoint.

OTP limits belong to the canonical Auth module, not Company Website.

## 58. File upload security

Report Content may accept screenshots. Flow: Upload request

```
v
```

type/size validation

```
v
```

malware/content validation where appropriate

```
v
```

isolated object storage

```
v
```

moderation reference

Never allow:

• executable files;

• arbitrary HTML;

• public direct bucket access;

• filename-based storage keys.

Use random object keys. Strip unnecessary metadata from images where appropriate.

## 59. Authentication boundary

There are three distinct authentication boundaries.

### Public Website browsing

Anonymous; no account session required.

### CMS/editor access

Website-owned authenticated admin surface with strong credentials, secure cookies, CSRF protection and role-based authorization. CMS identity is not a Platform buyer/seller session.

### Platform self-service flows

Account Deletion uses the Platform's own verification/step-up context. The Website must not convert a deletion verification into a general account session.

Repository separation must preserve these boundaries.

## 60. Data architecture

Website data is intentionally separate from Platform commerce data.

### Website PostgreSQL owns

• CMS content and revisions;

• CMS users/roles/audit metadata;

• waitlist/contact records;

• Website idempotency/audit metadata;

• Website analytics/projections where used;

• residency-policy configuration for Website intake.

### Main Platform owns

Accounts, authentication, account deletion requests, seller/product/order/payment/Trust/FYP data and platform moderation reports.

No foreign-key relationship crosses the two databases. Cross-system identity uses opaque public references or authenticated API contracts where necessary.

## 61. Database

The standalone Website backend uses PostgreSQL + Drizzle ORM as its canonical datastore.

Required/approved extensions from the current stack:

• `pg_trgm` - CMS/help/public-content search and controlled fuzzy lookup where justified.

• `btree_gist` - available for exclusion/range constraints where a real model needs it; do not use merely because it is installed.

• `pg_stat_statements` - production query observability.

The Website database is separate from the Adulis Platform database and uses separate credentials, migrations, backups and restore drills.

## 62. Database access principle

Only `apps/api` may hold Website database credentials.

`apps/site` and `apps/cms` consume typed REST clients. They do not connect directly to PostgreSQL. The Company Website never receives main Platform database credentials.

Main-platform data is accessed only through documented public APIs. Account deletion is the clearest example: UI in `adulis-web`, execution in `adulis-platform`.

## 63. API contracts

Website API uses REST + OpenAPI + `@nestjs/swagger` with generated TypeScript clients.

Recommended Website endpoints include:

• `GET /v1/content/pages/:key`

• `GET /v1/content/navigation`

• `POST /v1/waitlist`

• `POST /v1/contact`

• CMS/admin endpoints under a protected namespace.

Platform-owned calls use the Platform client, for example:

• `POST /v1/me/account-deletion/start`

• `POST /v1/me/account-deletion/verify`

• `POST /v1/me/account-deletion/confirm`

• `GET /v1/me/account-deletion/status`

Do not duplicate those endpoints in the Website API with independent business logic.

## 64. API response format

Use one stable API envelope per backend with request IDs and machine-readable errors.

Example:

```
{
  "data": {...},
  "requestId": "..."
}
```

Validation/error response:

```
{
  "error": {
    "code": "WAITLIST_EMAIL_INVALID",
    "message": "localized/client-safe message",
    "fields": {"email": "invalid"}
  },
  "requestId": "..."
}
```

Do not expose stack traces, SQL details, residency internals or platform security reasoning.

## 65. Idempotency

Idempotency is required for retry-prone public writes.

Waitlist/contact submissions may accept a client-generated idempotency key scoped to endpoint + normalized intent. Server stores the result in PostgreSQL or short-lived Valkey according to durability needs.

Platform Account Deletion uses Platform idempotency rules. The Website must pass the caller's request safely and render the returned canonical status rather than inventing its own retry state.

## 66. Failure architecture

Failure architecture follows domain ownership.

• CMS/API outage: serve last published/static content where possible.

• Website intake outage: keep read-only public site online and show localized temporary-unavailable state for forms.

• Platform API outage: Account Deletion/Report Content pages remain reachable but show a safe platform-service-unavailable state; Website does not queue unauthorized deletion commands locally.

• Email outage: persisted Website intake remains safe; notification job retries.

• Analytics outage: never block content/forms.

• Market/residency-policy unavailable: fail closed for PII collection while keeping public content available.

## 67. Performance architecture

The international public read path should be almost entirely cacheable.

```
Visitor -> Cloudflare CDN -> static/revalidated Next.js HTML
                       -> optimized assets/images
```

A homepage request should not require Website PostgreSQL, Valkey, the Adulis Platform, FYP, Trust or Chapa.

Dynamic dependencies exist only when a user invokes a write/self-service flow. This allows the corporate Website to remain online even during marketplace incidents.

## 68. Caching

Cache only data that is safe to cache.

Good candidates:

• published CMS page output;

• navigation and non-sensitive market metadata;

• public assets;

• Help/Press pages.

Never shared-cache:

• CMS admin responses;

• waitlist/contact POST responses containing user data;

• Account Deletion state;

• Report Content private status;

• authentication/step-up data.

CMS publish should trigger targeted cache invalidation/revalidation rather than a global purge whenever practical.

## 69. Images

Use:

• responsive sizes;

• AVIF/WebP where supported;

• dimensions specified to avoid layout shift;

• lazy loading below fold;

• optimized LCP asset;

• CDN caching.

Avoid giant desktop hero images on a low-end phone.

## 70. JavaScript budget

Use JavaScript only for interactive enhancement. The page must remain understandable without it - an existing Adulis website doctrine. Avoid hydration-heavy animation libraries simply for visual polish.

## 71. Accessibility

Minimum target remains: WCAG 2.1 AA or better The existing design already requires:

• visible focus;

• skip link;

• 44×44 touch targets;

• reduced-motion support;

• visible form labels.

Additionally require:

• correct heading hierarchy;

• landmark regions;

• accessible menu state;

• form errors tied using aria-describedby;

• error summary receives focus;

• sufficient contrast;

• keyboard-operable accordions;

• no information conveyed by color alone;

• meaningful image alt text;

• decorative images ignored by assistive technology.

## 72. Progressive enhancement

Core site: HTML + CSS = complete JavaScript adds:

• smoother validation;

• menu transitions;

• conditional field hiding;

• analytics;

• optional visual interactions.

JavaScript must not be required to:

• read;

• navigate;

• understand;

• submit the waitlist;

• contact Adulis.

The prior specification explicitly requires all public forms to work with JavaScript disabled.

## 73. Observability

Website observability uses the current canonical stack:

• Sentry for errors/releases/performance where appropriate;

• Pino structured logs from NestJS/Website backend;

• `pg_stat_statements` plus managed PostgreSQL metrics;

• Render, Cloudflare and EAS/platform signals where relevant to linked flows;

• Valkey/BullMQ queue metrics.

Observability must distinguish Website incidents from Platform incidents. A failed Platform deletion API call is not the same as a Website render failure.

The Website has no live Courier location dependency or tracking SLO. Linked Mobile/Platform delivery capabilities use private, order-scoped checkpoint evidence and verified Handoff state. Static public pages remain independent from those services.

## 74. Logs

Pino logs are structured and redacted.

Never log:

• waitlist phone/email;

• contact message body unless an explicitly restricted audit path requires it;

• deletion OTP/token/session material;

• Platform access tokens;

• CMS credentials;

• form payload dumps.

Use opaque record references, request IDs, operation names, result codes, latency and deployment version.

## 75. Alerts

Alert on symptoms that need action:

• public-site availability degradation;

• elevated 5xx rate;

• waitlist/contact persistence failures;

• CMS publish/revalidation failures;

• queue lag/dead jobs;

• database saturation or slow-query regression;

• excessive rate-limit/abuse signals;

• Platform account-deletion API failures above threshold;

• Cloudflare/CDN origin failure.

Do not page on normal traffic spikes alone.

## 76. Proposed initial SLOs

Initial objectives should be treated as engineering targets, not public guarantees.

| Surface | Initial target |
| --- | --- |
| Public static content | >= 99.9% monthly availability |
| Website API | >= 99.9% monthly availability for enabled intake |
| Successful accepted intake persistence | >= 99.9% once request passes validation/policy gates |
| CMS published-content recovery | Last known published content remains servable during CMS admin outage |
| Recovery | Documented RPO/RTO and tested restore; exact targets approved before production |

Targets can be tightened from real traffic and operating evidence.

## 77. Backups

Website PostgreSQL requires automated backups and tested restoration. CMS media/object storage requires lifecycle/versioning controls appropriate to the selected Cloudflare R2 configuration.

Backups are not proven until restore drills succeed. Restored environments must preserve privacy-deletion/retention state for Website-owned data.

Platform Account Deletion data is backed up and restored under the Platform's own privacy/deployment architecture; the Website does not duplicate those records.

## 78. Deployment environments

Use isolated environments:

• local/development;

• preview where safe;

• staging;

• production.

Each environment has separate Website database, Valkey, R2 namespace/bucket/prefix, secrets, CMS roles and email/test configuration.

Production data never moves into lower environments. Preview/staging must not send real seller/customer notifications or call destructive Platform deletion endpoints against production.

## 79. Suggested domains

Suggested public origins:

• `www.adulis.com` - international Company Website.

• `api-web.adulis.com` or same-origin `/api` gateway - standalone Website API.

• `cms.adulis.com` - protected Website CMS/admin.

• `api.adulis.com` - main Adulis Platform public API.

• `seller.adulis.com`, `ops.adulis.com` and Storefront origins remain separate systems.

Route `/markets/ethiopia` remains on the Company Website; it does not require a country-specific domain.

## 80. CI/CD

`adulis-web` has independent GitHub Actions pipelines.

PR gates should include strict TypeScript, lint, dependency-cruiser, unit tests, API contract generation/verification, Testcontainers integration tests, Playwright E2E, security/header checks, CMS content-schema validation, build and preview smoke tests.

Production delivery uses Docker for the Website API, Render for managed compute/database/Valkey as selected, Cloudflare for edge/CDN/R2, and separate deployment credentials from `adulis-platform`.

A Platform release is not required to publish ordinary Website/CMS content.

## 81. Copy-invariant testing

This is particularly important for Adulis. CI should reject prohibited phrases where they create false product claims. Examples: "Adulis guarantees..." "Adulis verifies your payment..." "secure transaction" "buyer protection" Context matters, so not every word can be enforced using naive grep alone. Use:

• automated checks for high-risk strings;

• human copy review for semantics.

The existing website specification explicitly treats these wording boundaries as system invariants, not mere marketing preferences.

Reject stale affirmative copy about the former content name; Product Posts as top-level FYP units; live Courier maps/location; a Trust enumeration omitting REBUILDING; Government ID required by Adulis; public Operator signup; or all commercial policy being open. Exception-aware checks may allow a single superseded-term glossary entry and negative regression fixtures.

Positive tests require Scene Post terminology, Scene-only image-led FYP, checkpoint/Handoff wording, four Trust labels wherever labels are enumerated, Market-specific provider claims, and no unsupported guarantees. Use automated checks plus semantic human review.

## 82. Content schema validation

CMS content schemas must be validated before publish.

Validate:

• required blocks/fields;

• locale and market scope;

• internal-link existence;

• SEO title/description length;

• no unapproved Seller plans, subscription prices or entitlement fields on `/pricing`;

• no market-availability claims without approved status;

• legal-document version/effective date;

• image alt text;

• safe rich-text component allowlist.

CMS must not allow arbitrary executable HTML/JavaScript injection.

Validate Scene public definitions and availability help blocks; image-only launch claims; complete four-label Trust enumerations; narrow Seller-verification claims; approved commercial/legal version references; and absence of Operator registration routes. Content schemas cannot mutate Platform Scene state or financial policy.

## 83. Testing strategy

Unit Test:

• phone normalization;

• reference generation;

• schemas;

• locale functions;

• analytics validation;

• policy rendering.

Component Test:

• navigation;

• accordion;

• waitlist errors;

• language switch;

• deletion states.

Integration Test:

```
form -> API -> DB
API -> queue
queue -> notification
E2E
```

Critical flows: English waitlist Amharic waitlist invalid waitlist duplicate waitlist phone correction contact report content deletion success deletion blocked language switching 404 Security Test:

• XSS;

• malformed payload;

• oversized body;

• rate limits;

• upload MIME spoofing;

• injection;

• unauthorized deletion flow;

• replayed deletion token.

Copy/schema integration and E2E cover Scene-only FYP examples, publication constraints, automatic private/restoration Help, Product/Seller/Scene Search education, Product-and-Scene Collections education, Handoff direction, checkpoint-only location and approved commercial disclosure. Assert public routes contain no Operator signup flow.

## 84. Browser/device testing

At minimum: Chrome Android Android WebView-like constraints Safari iOS Chrome Desktop Safari Desktop Firefox Desktop

Most important real-device test: low-end Android + constrained connection + 360px width. The existing specification makes that operating condition the binding UX constraint.

## 85. Localization and market-content testing

Every release validates the global default and supported locale/market combinations.

Minimum matrix:

• `/` international English;

• `/markets/ethiopia` English;

• `/am` and `/am/markets/ethiopia` where localized;

• `/availability` placeholder/demo state;

• `/pricing` Coming Soon state.

Test text expansion, Ge'ez glyphs, navigation, forms, metadata, canonical/hreflang, market links and missing-content fallback behavior. Human-reviewed Amharic remains required before production publication.

Run the corrected Scene, Trust, Courier, verification and commercial-copy invariants in every supported locale/Market; translation must not reintroduce stale claims.

## 86. Security testing in CI

Automate:

• dependency audit;

• secret scanning;

• lockfile integrity;

• SAST where practical;

• CSP/header check;

• route exposure check;

• forbidden environment files;

• source-map configuration review.

Do not expose production environment secrets to preview deployments.

Route exposure checks reject /operator-signup and equivalent public Operator-creation/request paths.

## 87. Supply-chain security

Use:

• pinned lockfile;

• reviewed dependency upgrades;

• minimal packages;

• no abandoned UI dependency for trivial effects;

• automated dependency alerts;

• protected main;

• required pull request review.

AI-generated dependency additions must be reviewed rather than automatically accepted.

## 88. Legal/document versioning

Legal/public-policy documents are versioned CMS entities with immutable published revisions, effective timestamps and archived historical versions.

The Website must be able to answer: "What policy text was publicly effective at this time and for this market?"

Commercial policy is separate. The versioned launch-disabled zero Adulis Buyer Checkout surcharge is current transaction policy; Seller subscription/plan/advertising packaging remains open. Legal documents must use approved versioned fee disclosures and must not invent Seller packaging or future subscription economics. Market-specific legal content must not silently inherit another jurisdiction's policy.

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 89. Commercial policy publication

The Website does not define or calculate financial policy. Current Payments/Checkout policy already includes a versioned launch-disabled zero Buyer-side surcharge; this is separate from open Seller subscriptions, plans, prices, advertising and entitlement packaging.

- /pricing remains Coming Soon for Seller packaging until separately approved.

- Public fee disclosure uses approved versioned commercial/legal copy, not improvised percentage promotion.

- Website code contains no pricing arithmetic or canonical fee calculation.

- Seller Terms make no unapproved future plan or free-period promises.

Publish approved changes as new CMS/legal/commercial-policy versions. Financial computation and transaction snapshots remain in Platform Payments/Checkout.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

## 90. Integration with FYP

The Website integrates with FYP through narrative and design demonstrations, not personalized feed loading.

For You feed demonstrations contain Scene Posts only, with eligible same-Seller Product tags and at least one currently available Product. Product Posts appear as tagged commerce destinations or through Search, Shop, Storefronts, direct links and Collections; they are never top-level FYP units.

Launch Scene/FYP media is photo/image based. Approved third-party social-video embeds belong only on Product Post Detail, outside the FYP.

Explain attention -> Product discovery -> Product interest -> commerce. Watch time is not the sole objective. Similar Finds and Complete the Scene remain deferred behind feature flags until Product/data coverage is sufficient.

## 91. Integration with Trust Engine

The Website consumes only public Trust explanations or a public Trust-policy representation where needed. It never calculates Trust.

Global pages explain the evidence-derived principle. Market-specific pages may show approved public thresholds only if/when policy owners explicitly publish them. Internal anti-gaming logic stays private.

All Trust enumerations use NEW, REBUILDING, ESTABLISHED and TRUSTED. Rebuilding is distinct from New; paid promotion cannot purchase Trust, and no Trust level imposes a Product-count cap.

## 92. Integration with Mobile App

The Company Website provides app-download links, deep-link association files, Help/Privacy/Terms, market/availability content and Account Deletion.

Mobile Account Deletion path: `Profile -> Settings -> Account -> Delete Account`

Website and Mobile call the same Platform Account Deletion API. No independent Website deletion implementation exists.

Mobile owns Buyer Home with For You, Following, Nearby, Discounts and Market-configured Locally Made; Marketplace Search and private mixed Product/Scene Collections; and connected Courier Handoffs with checkpoint-only location. Website Help must remain consistent with those capabilities.

## 93. Integration with Seller Console

Seller Console may link to Website policies, Help, Contact, Trust & Safety, market/availability information and pricing Coming Soon.

Seller Console and Website remain independent repositories/deployments. Shared visual assets may be published as packages only where release coupling is acceptable; do not recreate a hidden cross-repository runtime dependency.

Seller Console owns Scene authoring, publication and Seller-only Private badges/reasons, role-aware business administration, username team invitations and Courier Pool administration. Website Help explains the user effects while Platform domains own eligibility and restoration.

## 94. Integration with Operator Console

Operator Console does not live in `adulis-web`.

Website waitlist/contact records may be reviewed through a dedicated CMS/Website operations interface or an explicit integration later; Platform moderation/deletion/operator decisions remain in the Platform Operator Console.

Do not place `/admin` routes for Platform users, claims, payments or moderation inside the public Website application.

Operator Account is a separate internal privileged identity provisioned only after hiring/authorization by Adulis. The public Website provides no Operator registration, account-creation, mode-signup or request-access path. CMS administration is a separate Website-owned identity boundary and does not grant Platform Operator authority.

## 95. Integration with email

Email is a notification/output channel, never the source of truth.

Website jobs may send waitlist/contact acknowledgements or staff notifications after the record is safely committed. Avoid copying full PII/form bodies into internal inboxes.

Email templates are CMS/config versioned where practical and must respect locale, market and consent rules.

## 96. SEO versus privacy boundary

Public pages may be indexed; private workflow/status pages may not.

Never place phone, email, waitlist references, deletion tickets, OTPs or submitted form values into URLs/query strings that can leak into browser history, analytics, edge logs or search indexes.

CMS preview links must be unguessable/authenticated and `noindex`.

## 97. 404 architecture

Provide localized/global 404 behavior with helpful routes: Home, How it works, Help, Availability and Ethiopia page where appropriate.

Never redirect every unknown path to Home. Preserve correct HTTP status for SEO and debugging. Unknown market/locale combinations should explain that the requested page is unavailable rather than inventing content.

## 98. Maintenance mode

Maintenance is component-scoped.

If the Website API is unavailable, cached/public pages remain online. If waitlist/contact is unavailable, show a targeted message. If the Platform Account Deletion API is unavailable, the deletion page remains reachable and explains that the account service is temporarily unavailable.

Do not take the entire international Website offline for a single dependency.

## 99. System dependency map

There is no database connection from `adulis-web` to the Platform database.

![Standalone Website / Platform boundary](graphics/WEB_04.svg)
*Figure 04. Standalone Website / Platform boundary. Website owns CMS and intake persistence. Platform APIs own Account Deletion and Report Content; no shared database connection.*

## 100. What Valkey is used for

Valkey is used only for ephemeral/distributed Website concerns such as:

• distributed rate-limit counters;

• BullMQ queue backing;

• short-lived idempotency/correction capabilities where safe;

• bounded cache entries;

• abuse counters.

Valkey is never canonical storage for waitlist records, CMS content, contact submissions, account-deletion state or platform reports. PostgreSQL remains Website canonical truth for Website-owned durable records.

## 101. Background jobs

Website jobs may include:

• `waitlist.notify`;

• `waitlist.retention_purge`;

• `contact.notify`;

• `cms.publish_revalidate`;

• `cms.asset_process`;

• `public_intake.cleanup`;

• `analytics.project`;

• `email.send`.

Jobs run through BullMQ + Valkey and are retryable, idempotent where required, observable and dead-job recoverable.

Account deletion jobs belong to `adulis-platform`, not `adulis-web`.

## 102. Architecture invariants

Hard Website invariants:

• WEB-INV-01 - `/` is the international homepage; Ethiopia is a dedicated market page.

• WEB-INV-02 - Website global availability does not imply every commerce feature is enabled in every market.

• WEB-INV-03 - `/pricing` shows Coming Soon for Seller packaging until that packaging is separately approved.

• WEB-INV-04 - Company Website never holds Product, Order, payment, Trust or FYP transactional truth.

• WEB-INV-05 - Product/Scene Post public narrative must match current canonical definitions.

• WEB-INV-06 - Similar Finds and Complete the Scene are not advertised as launch features while feature-flagged off.

• WEB-INV-07 - Core public content works without JavaScript.

• WEB-INV-08 - Every public form validates server-side.

• WEB-INV-09 - Submitted PII is not logged or sent to analytics.

• WEB-INV-10 - Website PII writes resolve an approved residency policy before persistence.

• WEB-INV-11 - `adulis-web` has no Platform database credentials.

• WEB-INV-12 - Frontends request deletion; Platform authorizes, coordinates, executes, audits and completes it.

• WEB-INV-13 - Account Deletion cannot accept an arbitrary user/account ID from the frontend.

• WEB-INV-14 - Static public pages do not depend on marketplace/FYP/payment uptime.

• WEB-INV-15 - Valkey is ephemeral infrastructure, never durable business truth.

• WEB-INV-16 - CMS publication cannot mutate commerce state.

• WEB-INV-17 - Market/legal content is versioned and cannot silently fall back across jurisdictions when prohibited.

• WEB-INV-18 - Valkey is the only approved cache/queue datastore name in current architecture.

- WEB-INV-19 - For You is image-led and Scene-only at launch; Product Posts are commerce destinations outside the feed.

- WEB-INV-20 - Help reflects tagged/available initial publication, automatic PRIVATE on last available Product loss, and gated automatic PUBLIC restoration without archival.

- WEB-INV-21 - Courier copy uses verified handoffs and bounded checkpoint evidence; precise coordinates are not public.

- WEB-INV-22 - Trust has four labels; Seller admission implies no Adulis Government-ID collection.

- WEB-INV-23 - No public Operator creation/request route exists.

- WEB-INV-24 - Versioned Buyer Checkout policy is closed; Seller packaging remains open, and the Website calculates neither.

## 103. What I would explicitly reject

Do not build the Company Website using:

• microservices/Kubernetes/Kafka for a small public site;

• GraphQL without a measured need;

• a client-heavy SPA for static content;

• direct browser-to-database access;

• Platform database credentials in `adulis-web`;

• a duplicated account-deletion implementation;

• platform commerce logic in the Website API;

• unrestricted rich HTML/JavaScript from CMS;

• third-party session replay on sensitive flows;

• dozens of marketing SDKs;

• hard-coded pricing or country-availability claims;

• a fake global data-residency assumption.

A CMS is now required; rejecting CMS as a category is no longer current.

Also reject public Operator signup, native Seller-video launch claims in FYP, live Courier map promises, Trust-based Product caps and marketing copy that treats all financial policy as undefined.

## 104. Recommended implementation stack

The Website adds Next.js/React on top of the canonical Adulis stack and otherwise follows the updated baseline.

| Layer | Website baseline |
| --- | --- |
| Frontend | Next.js; React; strict TypeScript; App Router; internationalized routing |
| Backend | Node.js; NestJS; Fastify; strict TypeScript; Drizzle ORM; PostgreSQL |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements |
| Async / cache | Valkey; BullMQ |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript clients |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js; secure cookies/CSRF for CMS |
| Media | Cloudflare R2; Cloudflare CDN; Sharp |
| CMS | First-party CMS in adulis-web; versioned content/revisions and market/locale variants |
| Mobile integration reference | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; Expo SecureStore; Expo SQLite; Expo Camera; Expo Notifications; Expo Updates; small Zustand store |
| Quality | Jest; Testcontainers; Maestro (mobile/cross-surface); Playwright; k6; accessibility checks |
| Observability | Sentry; Pino structured logs; pg_stat_statements |
| Architecture control | dependency-cruiser |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS (mobile release integration) |
| Platform integration | HTTPS only through generated Platform public API client |

Mobile-only Expo technologies remain part of the wider Adulis stack but are not Website runtime dependencies.

## 105. Greenfield build plan

The Website will be built from scratch in the new `adulis-web` monorepo. Do not treat the old Website implementation as code that must be migrated.

### Build sequence

1. Establish repo, design tokens, lint/TypeScript/dependency-cruiser and CI. 2. Build Next.js international shell, global navigation and responsive design. 3. Build Website NestJS/Fastify API + PostgreSQL/Drizzle + Valkey/BullMQ. 4. Build first-party CMS and content schema/versioning. 5. Implement international homepage, availability demo and Ethiopia market page. 6. Implement Product/Scene Post narrative and Trust/Safety/help/legal pages. 7. Implement waitlist/contact with email, residency-policy enforcement and retention. 8. Integrate Platform Account Deletion and Report Content through public APIs. 9. Add SEO, analytics, observability, security hardening, backups and load testing. 10. Complete launch-gate review.

The previous visual language may be used as design reference, but no old repository boundary or business assumption should constrain the new build.

## 106. Launch gate

Do not call the Website production-ready until all of these pass:

• `/` is international and all primary global routes work.

• `/markets/ethiopia` exists with approved Ethiopia-specific content.

• `/availability` clearly uses approved demo/placeholder wording until rollout data is real.

• `/pricing` displays Coming Soon only.

• English and Amharic coverage is complete for the required launch routes; Amharic is human reviewed.

• 360px real-device and constrained-network tests pass.

• keyboard/accessibility audit passes; no horizontal overflow.

• CMS draft/review/publish/versioning works and published content can be recovered.

• waitlist captures email + phone and passes residency-policy enforcement.

• contact, rate limiting, idempotency and retention jobs are tested.

• Account Deletion uses only the Platform API and cannot delete arbitrary IDs.

• Report Content routes to the Platform moderation/report API.

• PII is absent from logs/analytics and private CDN caches.

• Website DB backup/restore is tested.

• staging/production are isolated and secrets protected.

• security headers/CSP/supply-chain checks pass.

• sitemap/canonical/hreflang/market SEO is verified.

• Product Post/Scene Post copy matches the canonical product decision.

• Similar Finds and Complete the Scene are not exposed as launch features.

• no unapproved Seller packaging or fee promotion appears; required fee disclosures use approved versioned legal/commercial content.

• all current cache/queue references use Valkey consistently.

• Website API and public pages meet initial SLO/load gates.

Scene publication/private/restoration, Search/Collections education, four-level Trust, narrow verification, checkpoint Handoff copy and Operator route-rejection tests pass in every launch locale. Public Seller packaging remains Coming Soon.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 107. Final architecture

The Website and Platform are separate repositories, databases and deployments. Integration is explicit HTTPS API usage, not shared persistence.

![Standalone Website / Platform boundary](graphics/WEB_05.svg)
*Figure 05. Standalone Website / Platform boundary. Website owns CMS and intake persistence. Platform APIs own Account Deletion and Report Content; no shared database connection.*

## 108. Architectural outcome

This design produces a Company Website that can launch to an international audience from Day 1 without pretending that every market has identical commerce availability.

It gives Adulis a clear global corporate entry point, a dedicated Ethiopia implementation page, a safe placeholder for international availability, and a CMS that can replace demo content with approved market facts without rebuilding the application.

It also resolves the repository and data-boundary questions: `adulis-web` is its own monorepo with its own Website backend and database, while Account Deletion and other Platform-owned workflows remain in `adulis-platform` and are consumed only through public APIs.

The Website can remain online when marketplace services fail. Public content is edge-cacheable. Submitted PII is residency-policy controlled. Seller pricing stays Coming Soon until packaging is approved; approved versioned legal/commercial content may disclose existing Checkout policy. The FYP narrative reflects Product Posts and commerce-linked Scene Posts rather than a generic social network.

Most importantly, the architecture keeps three truths separate: public communication belongs to the Website, Website-owned intake belongs to the Website backend, and Adulis commerce/account truth belongs to the Adulis Platform.

## 109. Glossary

| Term | Definition |
| --- | --- |
| Account Deletion | Platform-owned deletion, retention and hold workflow; Website may host its UI entry point. |
| CMS | First-party versioned content-management system for Website pages, locales, Markets and policies. |
| Company Website | Global public corporate/education site in the independent adulis-web repository. |
| Courier Delivery | Fulfilment using approved Courier relationships and verified Pickup/Delivery handoffs. |
| FYP | For You discovery: PUBLIC eligible Scene Posts only; image-led at launch. |
| Gateway Checkout | Platform Checkout/payment through the configured provider with backend-verified financial truth. |
| Handoff | Connected server-accepted transfer evidence; QR primary, OTP fallback, Manual emergency recovery. |
| Market | Configured commerce context for availability, currency, providers, policies, localization and time. |
| Operator Account | Separate internal privileged identity provisioned after Adulis hiring/authorization; no public signup. |
| Product Post | Structured sellable representation of one canonical Product and its current commerce information. |
| REBUILDING | Trust label for a formerly promoted Seller working back toward Established after falling below requirements. |
| Scene Post | Seller-authored image-led discovery content with eligible same-Seller Product tags; no price/stock authority. |
| Seller Storefront | Seller-scoped public browsing/share surface; native Platform/Mobile owns transactions. |
| Shoppable Post | Superseded former term for Scene Post. |
| Trust Ladder | Evidence-derived NEW, REBUILDING, ESTABLISHED, TRUSTED labels; cannot be purchased. |
| Website API | Website-owned NestJS/Fastify API for CMS, intake and Website operations; explicit Platform API boundary. |
| Website Database | Separate Website PostgreSQL for CMS/intake/analytics; never Platform commerce truth. |
| PUBLIC | Scene visibility eligible for Buyer/public delivery after every public gate passes. |
| PRIVATE | Seller-only Scene visibility; stock-driven private state preserves PUBLISHED lifecycle and may restore. |
| Checkout Surcharge | Current versioned launch-disabled zero Buyer-side fee owned/calculated by Payments/Checkout; public copy needs approval. |

## 110. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-01 — Buyer-facing Product / Scene terminology | The 13 October designs use Product Post and Scene Post as canonical domain names. | Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly. | PR-001 / PR-005, 26-27 Oct 2026 |
| R-11 — Buyer account controls and deletion parity | The 13 October Privacy/Auth designs govern account lifecycle and deletion. | Authenticated Buyer account controls include Edit Profile, saved discovery area, Appearance, notification preferences, Privacy & Security, Help & Support, Delete Account and Sign Out. Delete Account uses verification, consequence preview, authoritative blockers and typed confirmation; Mobile and Website must share policy wording/data rather than independently reauthoring deletion consequences. Sign Out changes session state only. | PR-006, 27 Oct 2026 |
| R-16 — Company Website public-copy refinements | The 13 October Website/Finance designs already hold the corrected launch financial model. | Public Website copy must not promise a 0.5% Adulis transaction fee. It uses Buyer-facing Product/Scene language and shared authoritative report/deletion policy. Removing decorative warning/report icons must not remove role=status/role=alert semantics. Seller public location copy must not imply a mandatory physical storefront when only operating area/collection point is available. | PR-001 + Oct 15 corrections |
| R-17 — Theme and appearance architecture | The 13 October pack contains shared design tokens; final brand palette is not contract-closed. | Production clients use semantic theme roles with Light, Dark and System plumbing so palette changes are centralized. Theme Lab (Baseline plus ten candidates) is prototype evaluation tooling only and must not ship as production theme choices. No candidate palette is canonical until founder approval. Operational status colors remain semantic and independent from brand palette. | Theme Lab + WO-001, 27 Oct / 8 Nov 2026 |
| R-22 — Canonical launch Adulis surcharge remains zero | The October 13 Finance/Order/Market/KB designs set launch Adulis surcharge to 0 bps / amount zero. | Launch Adulis surcharge is disabled: 0 bps and zero amount. Provider processing fee is a separate provider-policy route and may be Buyer-paid only when that route is explicitly permitted and confirmed. The prototype canonical-rules line claiming a current 0.5% Adulis Buyer surcharge is stale and must not be implemented. | October 13 pack reaffirmed against stale prototype rule |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.

### Open / deferred items

• Final production brand palette remains open; semantic theme architecture is required, Theme Lab candidates are not canonical.
