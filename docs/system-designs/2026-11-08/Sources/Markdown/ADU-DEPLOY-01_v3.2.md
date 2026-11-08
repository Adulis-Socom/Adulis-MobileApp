# Adulis Deployment Architecture
Version 3.2 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.1 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Complete amended baseline: 12 October 2026. The supplied correction prompt and owner decisions supersede the conflicting reviewed source wording. Every original numbered body section and unaffected table/graphic is retained; targeted contracts, examples, tests, invariants and dependent definitions are reconciled. The historical audit remains unchanged.

| Document control | Amendment baseline |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026 -> 3.2 post-October-13 reconciled 8 November 2026. |
| Source | ADU-DEPLOY-01_Adulis_Deployment_Architecture_System_Design_v3.1.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Deployment philosophy

Deployment exists to preserve correctness, security, recoverability and operability while Adulis changes quickly. A release is successful only when code, database invariants, supported clients, workers, provider integrations and observability remain coherent.

The default operating rule is: build once, verify before production, promote deliberately, migrate safely, observe immediately and retain a recovery path.

## 2. Authority precedence

Newest explicit approved product/system decisions supersede the attached September baseline when they conflict. This edition reconciles deployment while preserving managed infrastructure, one primary write region, separate API/worker processes, PostgreSQL/Drizzle, two Valkey roles, BullMQ, R2/CDN/Sharp, GitHub Actions, EAS and independent adulis-platform/adulis-web boundaries.

Current contracts use Product Posts and image-led Scene Posts; Scene-only FYP; public Product/Seller/Scene Marketplace Search; mixed private Collections; same-Seller tags; current automatic Scene privacy/restoration; three ordinary Mobile contexts; separate internal Operator Accounts; approved Courier Pool/Network workflows; one active accepted delivery; checkpoint-only evidence and connected Handoffs; and launch-disabled zero Buyer-side surcharge policy.

## 3. Current platform deployment baseline

The initial platform uses managed infrastructure rather than self-managed clusters: Cloudflare at the global edge, Render managed compute in one primary write region, managed PostgreSQL, separate Valkey queue/cache instances, Cloudflare R2/CDN, GitHub Actions and EAS for mobile.

Production begins with at least two API instances when economically feasible and one independently deployable worker process.

Current closed transaction policy is a launch-disabled zero Buyer-side Adulis Checkout surcharge, equal to 0 basis points, backend-calculated on eligible merchandise value under versioned Commercial Policy. Courier Delivery charge is a separate line item excluded from this basis under current policy.

Buyer sees the Seller-defined Courier Delivery charge before PSP payment. For MVP it equals the immutable Courier compensation snapshot for that Seller Order; the delivery offer uses that same amount/currency and terms version. Seller rate changes or Operator actions cannot rewrite paid compensation or historical surcharge.

Evidence separates Product subtotal, Courier Delivery charge (or approved Seller Delivery charge), Adulis Checkout surcharge, applicable provider-authorized Buyer fee, approved tax/regulatory charges and the server-calculated total. Provider fees/taxes are included only where ratified and supported. Seller subscriptions, plans/pricing, advertising and broader future packages remain separately governed/open; Trust cannot be purchased.

The current native Seller media pipeline is image-only. Approved external TikTok video belongs only on Product Post Detail; it is not Scene/FYP media or commerce authority.

## 4. Global Day-1 posture

Adulis is globally reachable from Day 1. Global reach does not mean every country has identical commerce providers, seller onboarding, fulfilment or legal policy. Market configuration controls feature availability while the public edge remains worldwide.

The Company Website is international by default. Platform writes remain single-region until measured scale or residency/legal requirements justify regional data planes.

## 5. Single write region at launch

The initial transactional write region remains Frankfurt for API, worker, PostgreSQL and platform Valkey services. Keep latency-sensitive services on the same regional private network.

Do not introduce active-active writes across continents at MVP. Distributed stock, order, payment and Trust consistency is materially harder than globally caching public content.

## 6. Managed infrastructure principle

The engineering team should spend time on product correctness rather than operating database clusters, orchestration platforms or custom load balancers. Managed services are the default until scale, cost, compliance or provider limitations create a measurable reason to move.

## 7. Canonical technology stack

The deployment design must carry the full current stack, not only hosting products. Each layer below has operational impact and must appear in CI, environment certification and observability.

| Layer | Canonical technology | Deployment impact |
| --- | --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript; Drizzle ORM; PostgreSQL | One modular-monolith API image plus worker process; Drizzle migrations; PostgreSQL remains durable truth. |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements | Provider certification installs/verifies every required extension; pg_stat_statements supports production query diagnostics. _ _ |
| Async / cache | Valkey; BullMQ | Separate queue and cache Valkey services; BullMQ workers remain non-canonical, retryable and observable. |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client | Contracts are generated and CI-verified across web and mobile clients. |

| Layer | Canonical technology | Deployment impact |
| --- | --- | --- |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js | Rate limiting, secure HTTP headers and international phone normalization are production middleware concerns. |
| Media | Cloudflare R2; Cloudflare CDN; Sharp | Direct upload grants, quarantine/derivative processing and edge delivery; large media bytes bypass NestJS. |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; Expo SecureStore; Expo SQLite; Expo Camera; Expo Notifications; Expo Updates; small Zustand store | EAS native builds and compatible OTA channels; physical-device testing. Courier checkpoints may use foreground Expo Location; no background-task or live-route renderer dependency is required. |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 | Unit/domain, real PostgreSQL/Valkey integration, mobile E2E, browser E2E and load/capacity gates. |
| Observability | Sentry; Pino structured logs; pg_stat_statements | Release markers, redacted structured logs, service health and slow-query diagnosis. |
| Architecture control | dependency-cruiser | CI rejects forbidden package/domain imports and private-repository coupling. |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS | Immutable backend/web artifacts, managed compute, edge/CDN/R2 and mobile release workflows. |

## 8. Repository topology

The current repository boundary is two monorepos, not one. adulis-platform contains Mobile, Seller Console, Operator Console, Storefront, API, worker and shared packages. adulis-web is the independent Company Website monorepo with site, Website API and CMS.

This boundary keeps corporate/CMS delivery independent from marketplace releases while preserving explicit HTTPS integration where the Website invokes Platform-owned flows.

```
adulis-platform/
  apps/
    mobile/
    seller-console/
    operator-console/
    storefront/
    api/
    worker/
  packages/
  ops/
```

```
adulis-web/
  apps/
    site/
    api/
    cms/
  packages/
  infra/
```

## 9. Modular monolith, not microservices

The platform backend remains a NestJS/Fastify modular monolith with explicit domain boundaries. Deployment separates API and worker processes, not business domains into network services.

Do not introduce Kubernetes, service mesh, Kafka or microservice-per-domain as launch prerequisites.

## 10. Core deployment invariants

PostgreSQL is durable business truth. Valkey, CDN caches, analytics, client caches and feature flags never replace canonical domain state. Public content may be globally cached; authenticated commerce state may not be shared-edge cached.

Production/staging data and secrets remain isolated, exact release identity is recorded, and database restore is never used as an ordinary application rollback.

### PART II - GLOBAL EDGE, DNS AND USER-FACING SURFACES

This part maps each Adulis product surface to its production origin and clarifies which runtime is responsible for public, authenticated and administrative traffic.

## 11. Primary network architecture

Cloudflare provides global edge/DNS/WAF/public delivery; Render runs managed API, worker and web compute. The Platform API and worker share a reviewed Docker image and a single primary PostgreSQL/Drizzle write region, with separate Queue Valkey and Cache Valkey roles. R2/CDN/Sharp supply bounded image storage/processing/delivery.

Company Website is the independent adulis-web repository/runtime with its own API/CMS/PostgreSQL and approved residency-policy boundary. Storefront, Seller Console, Operator Console and the one native Mobile binary consume typed Platform APIs; their origins/session audiences remain isolated.

![Managed deployment boundaries](graphics/DEPLOY_01.svg)
*Figure 01. Managed deployment boundaries. Cloudflare edge and Render compute serve isolated clients; Platform truth, independent Website data, queue/cache roles and image delivery remain explicit.*

## 12. DNS topology

Public DNS names are product boundaries. Keep private Render hostnames, database names and internal worker names out of user-facing URLs. Use Cloudflare as the authoritative production DNS control plane.

## 13. Company Website origin

www.adulis.<tld> is the international Company Website. It comes from the independent adulis-web repository and is not a platform-commerce frontend.

The site is Next.js + React with server/static rendering. It may continue serving cached published content even if the platform API is degraded.

## 14. Company Website API origin

api-web.adulis.<tld> or a same-origin /api path serves the standalone Website NestJS/Fastify backend for CMS delivery, waitlist/contact intake and Website-owned operations.

The Website API has its own PostgreSQL, Valkey/BullMQ, R2 scope and secrets. It has no platform database credentials.

## 15. Company CMS origin

cms.adulis.<tld> is a protected administrative surface for the first-party Website CMS. CMS authentication and roles are Website-owned and must not be treated as Buyer/Seller platform sessions.

Published content should remain recoverable even if CMS administration is temporarily unavailable.

## 16. Seller Storefront origin

shop.adulis.<tld> is a mobile-first Next.js Storefront runtime behind Cloudflare and deployed on managed compute. It server-renders seller identity, Product Posts, Scene Posts, Trust, Reviews and public fulfilment/location information.

The Storefront calls the public Platform API through a generated REST/OpenAPI client. It does not own checkout, payment, Order or Handoff state.

## 17. Seller Console origin

seller.adulis.<tld> is an authenticated private management surface. The current Console architecture requires a thin same-origin /api gateway/proxy so host-only sessions, CSRF protection and request tracing remain simple.

Deploy the Console web/gateway as an independently releasable artifact. Business logic stays in the core platform API.

## 18. Operator Console origin

ops.adulis.<tld> is a separate privileged origin with independent CSP, session policy and access controls. It must not share authenticated cookies with Seller Console, Storefront or Company Website.

Founder-operations and later staff-operations modes use the same deployment surface; role/workflow policy changes, not a second Operator application.

## 19. Platform API origin

api.adulis.<tld> routes through Cloudflare to Render API instances. Cloudflare may absorb abusive traffic, but every request still passes platform authentication/authorization and domain validation.

## 20. Public media origin

media.adulis.<tld> serves only approved public derivatives from R2 through Cloudflare CDN. Private evidence, identity material, deletion exports and non-public uploads never use the public media domain.

## 21. Mobile distribution

The React Native + Expo app is distributed through Apple App Store and Google Play using EAS Build/Submit and compatible EAS Update channels. Buyer, Seller Companion and Courier Mode ship in one binary.

## 22. Origin isolation

A compromise of public seller-authored content must not grant same-origin access to Seller or Operator sessions. Separate origins, host-only cookies, strict CSP and scoped APIs are defense-in-depth boundaries.

## 23. Account deletion boundary

The Company Website may host account-deletion UI, but the Platform Account Lifecycle domain authorizes and executes deletion. Deployment boundaries follow domain ownership: adulis-web calls the Platform over HTTPS and never receives platform database credentials.

### PART III - PLATFORM COMPUTE AND PROCESS TOPOLOGY

The platform uses one reviewed backend image with separate API and worker commands, plus independently deployable web/mobile clients.

## 24. API process

Run at least two stateless Platform API instances in production when feasible. Responsibilities include HTTP, authentication, authorization, domain commands/reads, provider webhook intake, upload grants and privacy-minimized analytics ingestion.

## 25. Worker process

Run at least one separate worker process from the same reviewed backend image. The worker handles BullMQ consumers, reconciliation, notifications, media orchestration, retention/purge tasks, projections and other asynchronous work.

A heavy job must not compete directly with request latency for checkout, FYP, Product Post reads, Handoff or operator actions.

## 26. One backend Docker image

Use one backend Dockerfile and immutable image for API and worker. Different process commands select the runtime role. This prevents dependency drift and makes rollback/redeployment reproducible.

## 27. Immutable release identity

Every backend release records Git SHA, build ID and image digest. Production must never depend on an ambiguous latest tag. The same reviewed artifact that passed staging is promoted to production.

## 28. API graceful shutdown

On SIGTERM stop accepting new traffic, finish bounded in-flight requests, close PostgreSQL and Valkey connections and then exit. Do not terminate in-flight payment verification or Order writes mid-transaction.

## 29. Worker graceful shutdown

On SIGTERM stop claiming new jobs, finish or safely release bounded work, close BullMQ/Valkey and database connections, then exit before the platform kill timeout.

## 30. Health endpoints

Expose minimal unauthenticated /livez and /healthz equivalents. Liveness answers whether the process is running. Readiness checks critical PostgreSQL reachability and only dependencies required to serve normal traffic.

Never expose database hostnames, schema details, Valkey URLs, secret state or provider credentials in health responses.

## 31. Optional dependency degradation

Analytics, recommendation enrichment and cache failure should not automatically mark the core API unhealthy when safe fallbacks exist. PostgreSQL inability to execute canonical writes is a readiness failure.

## 32. Payment webhook intake

Provider callbacks enter through a dedicated platform route behind Cloudflare. The endpoint verifies provider authenticity, binds provider transaction identity to Adulis checkout/order context, applies idempotency and persists canonical payment facts before emitting downstream work.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 33. Payment reconciliation worker

Ambiguous, delayed or missing provider callbacks are reconciled asynchronously using provider APIs where supported. Reconciliation is retryable and idempotent and never grants the Seller a manual payment-authority button.

## 34. Courier checkpoint-evidence ingest path

Courier Checkpoint Location Evidence consists of exactly two best-effort foreground/on-demand capture opportunities: PICKUP and DELIVERY, immediately around the corresponding accepted/eligible Handoff context. No periodic or background samples, live Buyer/Seller maps, movement routes or tracking projections are part of MVP.

Fulfilment validates the Courier, active assignment, Order, checkpoint purpose and Handoff context. Evidence may include coordinates, accuracy, client capture time, server receipt time and capture result/status. Capture failure or denied permission never invalidates an otherwise valid connected QR/OTP/Manual Handoff, proves custody, or completes an Order.

Precise location is sensitive, purpose-limited evidence. General logs/analytics redact coordinates; Operator access requires an authorized case, capability and reason-for-access. No general map of Courier movement or unrelated Seller relationship data is exposed.

Ingest one bounded foreground location fix per eligible Pickup/Delivery checkpoint context through Platform API. Store the assignment/Order reference, purpose, timestamps, accuracy and capture status under Fulfilment policy. This is not a continuous writer or location projection service.

No route stream, high-frequency sampling queue, movement-history datastore, continuous-tracking cache or tracking-specific scale tier is deployed.

![Two bounded evidence checkpoints](graphics/DEPLOY_02.svg)
*Figure 02. Two bounded evidence checkpoints. Foreground attempts at Pickup and Delivery support evidence; valid connected Handoff is independent of location availability.*

### PART IV - DATABASE, DRIZZLE AND MIGRATIONS

Adulis uses PostgreSQL as the canonical durable store. The Website has a separate PostgreSQL boundary; neither database is a cache for the other.

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

## 35. Platform PostgreSQL

Managed PostgreSQL 17 in the primary region is the source of truth for Accounts, Sellers, Catalogue, Product Posts, Inventory, Scene Posts and revisions, Orders, payment facts, fulfilment, Handoff, Courier Pool/Network relationships, requests/offers/assignments and checkpoint evidence, Trust, Reviews, Claims, authorization, configuration, privacy lifecycle and audit.

## 36. Website PostgreSQL

The standalone Website database owns CMS revisions, CMS roles/audit, waitlist/contact intake, Website idempotency, residency policy/configuration and Website analytics where enabled. There is no cross-database foreign key to Platform data.

## 37. Drizzle ORM boundary

Drizzle is the approved ORM/migration layer for both platform and Website backends. Frontends never import Drizzle repositories or database credentials. Domain/application services remain the mutation boundary.

## 38. Required PostgreSQL extensions

Provider certification must install and verify pg_trgm, btree_gist and pg_stat_statements. Do not assume a managed provider supports an extension merely because local Docker does.

## 39. Database access classes

Use separate application, worker and migration credentials. The migration role may own schemas/extensions; runtime roles are constrained to the operations they require through grants, functions and RLS where used.

## 40. No public database exposure

Production services connect using private/internal provider networking where available. Temporary administrative access is tightly restricted, time-bounded and removed after use.

## 41. Provider certification suite

Before production, verify extensions, migrations from zero, upgrade-path migrations, schema ownership, RLS/SECURITY DEFINER behavior, revokes, invariant checks, backup and restore on the actual managed service.

## 42. Expand-migrate-contract doctrine

Production schema changes follow expand -> deploy compatible code -> backfill/switch -> contract. Destructive cleanup waits until all supported mobile/web clients and background workers no longer depend on the old shape.

Implementation identifier migration to SCENE_POST uses additive expand-migrate-contract and versioned contract adapters within the supported Mobile window. Do not destructively remove historical fields/events or break installed binaries in a single deployment. Canonical documentation/new contracts use Scene terminology; adapters translate legacy names without duplicate logical events.

## 43. Mobile compatibility window

Supported mobile binaries may remain in the field for weeks. /v1 API and database-backed behavior must remain additive/backward-compatible until a minimum-supported-version gate intentionally retires an old client.

## 44. Backfill execution

Large data changes run in bounded batches with progress/watermarks and observability. Avoid long locks or enormous transactions that block live checkout, Product Post updates or Handoff.

## 45. Single migration actor

Exactly one migration runner owns a release. Do not let each API instance and worker race migrations. Use one designated CI/pre-deploy job with the privileged migration credential.

## 46. Migration safety controls

Set lock/statement timeouts, review table rewrites, large indexes, type rewrites, constraint validation and mass updates against production-shaped staging data. Fail a migration rather than silently blocking live commerce.

## 47. Production seed policy

Production seeding is limited to reviewed reference/configuration data delivered through migrations or controlled admin workflows. Never create demo sellers, fake Orders or development Accounts in production.

## 48. Rollback and restore are different

Application rollback returns earlier software only when schema compatibility permits. Database restore rewinds business history and is reserved for real data loss/corruption incidents after explicit incident command.

### PART V - VALKEY, BULLMQ AND ASYNCHRONOUS DELIVERY

Valkey is the only approved cache/queue datastore name. Queue durability and cache disposability have different failure semantics and are deployed separately.

## 49. Valkey architecture

Valkey supports cache, rate-limit counters, short-lived coordination and BullMQ backing. It never becomes a fallback source of Order, payment, Inventory, Trust or account-lifecycle truth.

## 50. Separate queue and cache Valkey

Production uses separate managed instances or equivalently isolated services: one for BullMQ/coordination and one for disposable cache/rate-limit state. Cache eviction policy must never compete with queue durability.

## 51. Queue Valkey policy

Queue Valkey uses noeviction or another policy compatible with durable BullMQ operation, persistence as appropriate, private network access and alerts on memory pressure, connection failures and oldest-job age.

## 52. Cache Valkey policy

Cache Valkey may use measured LRU/TTL eviction. If it disappears, Adulis becomes slower but remains correct through PostgreSQL/public read fallbacks where safe.

## 53. BullMQ role

BullMQ runs retryable asynchronous work such as provider reconciliation, notifications, Review reminders, cache invalidation, projection refresh, media processing coordination, account-deletion fanout, retention tasks and controlled exports.

## 54. Job payload versioning

Important job payloads carry an explicit schema version. During deploy overlap, workers should accept old and new payload versions before producers start emitting a new version.

## 55. Job idempotency

Business-effect jobs tolerate retries, duplicate delivery, process crashes and deployment overlap. A duplicate job must not create duplicate notifications beyond policy, duplicate refunds, duplicate Order transitions or duplicate deletion effects.

## 56. Transactional outbox

For critical post-transaction side effects, commit a domain/outbox event in PostgreSQL in the same transaction as canonical state. A dispatcher later enqueues BullMQ work. If Valkey is temporarily unavailable, the durable outbox event remains.

BullMQ is the standard job system; no overlapping Graphile Worker engine is required. Canonical transaction plus outbox commits first, dispatcher relays after commit to Queue Valkey/BullMQ, idempotent workers apply consequences, and reconciliation repairs missed dispatch without inventing business facts. Queue/cache Valkey retain distinct loss/eviction semantics.

![Commit first, relay after commit](graphics/DEPLOY_03.svg)
*Figure 03. Commit first, relay after commit. PostgreSQL owns truth; BullMQ/Queue Valkey support idempotent consequences with independent reconciliation and separate cache failure semantics.*

## 57. Critical outbox candidates

Use stronger delivery for paid-Order notifications, provider payment-state fanout, Handoff consequences, Claim consequences, security notifications, moderation invalidation, account-deletion lifecycle events and other effects whose loss would violate product correctness.

## 58. Queue outage behavior

Canonical synchronous operations continue where safely designed. Outbox-backed work accumulates for later dispatch, alerts fire on lag, and user-facing flows show degraded states where the side effect is required before progress.

## 59. Cache outage behavior

Bypass or degrade cache safely, cap retry storms and protect PostgreSQL from sudden stampedes. Never answer with invented stock, payment or Trust data merely because cache is unavailable.

### PART VI - PRODUCT POSTS, SCENE POSTS, FYP AND MEDIA DEPLOYMENT

The content model changes infrastructure load, cache keys, media pipelines, fixtures and observability. Deployment must treat Product Posts and Scene Posts as distinct first-class entities.

## 60. Product Post deployment role

A Product Post is the canonical public commerce representation of one sellable Product. Product Post reads depend on Catalogue/Inventory truth and appear in Search, Shop, Storefront, Seller profile and tagged-product navigation, not as top-level Buyer FYP units.

Marketplace Search launches with PRODUCT_POST, SELLER and SCENE_POST; public Scene Search is enabled. PostgreSQL/pg_trgm remain the launch search architecture unless measured scale justifies additional infrastructure. Collections store Product and whole-Scene targets within current modules/datastores.

## 61. Scene Post deployment role and public eligibility

Scene Post is Seller-authored image-led merchandising/discovery content with one or more valid same-Seller Product Post tags. Product Post is the canonical structured commerce representation of exactly one sellable Product; Scene revisions never own durable Product price or stock.

Initial public publication requires at least one valid Product Post tag, at least one tagged Product with an eligible purchasable in-stock Variant, and passing Seller, Market, media and moderation checks. Zero tags or no available tagged Product rejects the public publication command.

When the last eligible available tagged Product becomes unavailable, Content keeps publication_state=PUBLISHED and changes visibility PUBLIC -> PRIVATE, with reason ALL_TAGGED_PRODUCTS_OUT_OF_STOCK for stock depletion. This is system-derived commerce visibility, not archival or Moderation removal. If another tag remains eligible and available, the Scene may remain PUBLIC while the unavailable tag resolves current truth.

Content re-evaluates restock or restored Product eligibility against every current public gate. A stock-driven PRIVATE Scene automatically returns to PUBLIC only when at least one tag is available and all gates pass. Independent moderation, Seller suspension, archival/removal or other restrictions still block restoration.

PRIVATE Scenes are excluded from every Buyer/public FYP, Search, Storefront/profile, deep-link and Collection resolution. Seller management retains the Scene with a clear Private badge/reason; notify the Seller on automatic privacy/restoration. A retained Collection membership does not reveal private content. Restricted Operator investigation remains separately authorized and audited.

## 62. FYP serves Scene Posts only

The current Mobile contract returns Scene Post feed units only. Deployment smoke tests and observability must detect accidental Product Post feed units as a contract failure.

PUBLIC eligible Scene candidates must pass current tag availability, Seller/Market/media/moderation and visibility gates before ranking. A PRIVATE Scene or top-level Product feed unit is a contract failure.

## 63. No launch dependency on deferred recommendation modules

Similar Finds and Complete the Scene are not launch requirements. Do not provision jobs, databases or specialized infrastructure solely for these modules. Keep feature seams/flags dormant until product coverage and data justify activation.

## 64. Media upload path

Clients request scoped upload grants from the API, upload bytes directly to Cloudflare R2, commit metadata, then workers validate/process/publish derivatives. Large media bytes should not transit the NestJS API.

## 65. R2 storage boundaries

Use clearly separated logical buckets/namespaces for public media, quarantine/private media, restricted evidence/exports, analytics archive and encrypted database backups. Website/CMS assets use separate adulis-web scopes.

## 66. Sharp processing

Sharp creates bounded image derivatives for Product Posts, Scene Posts, Storefront cards and other image roles. Worker concurrency is capped so viral media processing cannot starve payment or notification work.

## 67. Public media custom domain

Only approved derivatives are served through media.adulis.<tld> and Cloudflare CDN. Immutable object keys/versioning enable long TTLs without serving stale edited content.

## 68. Scene visibility propagation and cache invalidation

Inventory commits canonical quantity/StockEvent plus transactional outbox. An idempotent Scene eligibility consumer/reconciler rechecks affected tags; Content owns PUBLIC/PRIVATE decisions. Content state/version changes then invalidate Search, FYP candidates, Storefront/profile and Collection public resolution, including targeted CDN/cache purge and Seller notifications.

Restock follows the same eligibility re-evaluation before PUBLIC restoration. Use authoritative current gates, projection version/state, targeted purge, bounded TTL and reconciliation. A delayed BullMQ job/cache purge never authorizes exposure of canonical PRIVATE content; Valkey/CDN is not an eligibility authority. Public reads fail closed when current eligibility cannot be confirmed.

![Current eligibility runs before every new controlled Scene delivery](graphics/DEPLOY_04.svg)
*Figure 04. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

Cache genuinely non-sensitive static shells and permitted immutable image/static assets only. Scene-bearing data/HTML/caption/title/card/meta bypasses full-page/data CDN caching, ISR and stale-while-revalidate unless the authoritative decision still runs before every delivery. Dynamic nonce HTML uses the existing fresh per-response CSP nonce profile and no shared HTML cache; static asset policies stay compatible. Already delivered bytes, in-flight responses and external screenshots/copies cannot be recalled. Authorized Seller-private and case-scoped Operator access are separately authenticated.

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

## 69. Partial and complete tagged-Product unavailability

One unavailable Product does not hide a Scene if another valid tagged Product remains available. Resolve each tag from current Catalogue/Inventory and render unavailable tags safely. If the final available eligible tag is lost, Content keeps PUBLISHED but changes PUBLIC -> PRIVATE; no archival is implied.

Eligibility restoration requires every current public gate. Deployment tests deliberately delay consumers/purges and require FYP/Search/Storefront/Collection reads to suppress private content immediately through authoritative response-time eligibility checks.

## 70. Product-detail TikTok integration boundary

Approved external TikTok video is an optional Product Post Detail enhancement only. It is isolated, click-to-load and never required for FYP, Scene media, Product availability or Storefront correctness. Third-party failure leaves current Product commerce information and image fallback intact.

R2/CDN/Sharp handle native Product/Scene image media. Do not deploy Seller-video upload/transcoding/streaming infrastructure or infer approval for other external video providers.

## 71. Viral Storefront scaling

A viral social link should primarily increase Cloudflare/R2/CDN traffic, with a much smaller increase in origin/API reads and minimal proportional PostgreSQL load. If every card/image view becomes a database query, caching/projection design is wrong.

### PART VII - CHECKOUT, PAYMENT, ORDERS, HANDOFF AND COURIER OPERATIONS

The old pre-payment hold flow is not deployed. Gateway payment and server-verified commerce events drive the production lifecycle.

## 72. Gateway payment architecture

Checkout creates a provider payment attempt through the Platform Payment domain. Chapa is the initial configured provider where enabled; provider availability is Market-configured rather than assumed globally.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

## 73. Provider adapter boundary

Provider-specific API/webhook details stay behind an internal Payment adapter. Mobile, Seller Console, Storefront and Operator Console consume canonical Platform contracts, not raw Chapa SDK semantics.

## 74. Provider secrets

Use separate sandbox/staging/production provider credentials and webhook secrets. Secrets remain server-side in managed secret stores; no provider secret enters browser/mobile bundles.

## 75. Server-side payment verification

Client redirect/success screens are not payment truth. The backend records success only after server-side provider verification and reconciliation rules pass.

## 76. Paid Order idempotency

Duplicate callbacks, retries or lost client responses must not create duplicate successful payment state, duplicate Seller Orders or repeated stock effects. Use database uniqueness/idempotency keys at the canonical boundary.

## 77. Multi-cart and sequential payment

A Buyer may hold multiple seller-specific carts in one checkout summary. Current production creates separate Seller Orders and payment attempts and allows sequential payment. There is no cross-Seller Order or shared payment fact.

## 78. Seller is not payment authority

Seller surfaces receive a server-verified paid-Order notification and begin preparation. There is no deployment path for a Seller to manually approve payment success.

## 79. Payment provider outage

Historical verified payment/Order state remains readable. New payment-dependent flows may pause or show a provider-degraded state. Reconciliation workers retry safely; no manual override weakens payment truth.

## 80. Payment observability

Track payment-attempt latency/outcome, callback verification failures, reconciliation lag, provider error classes, paid-Order creation latency and Seller-notification lag without logging credentials or full provider payloads.

## 81. Order continuity during incidents

When safe, preserve reads and progress for already paid Orders, Seller preparation, Courier delivery-state and checkpoint evidence, Handoff, Claims and Reviews even if new checkout or provider initiation is paused.

## 82. Two-stage Handoff Verification

Pickup: Seller displays the purpose-bound PICKUP QR -> assigned Courier scans -> server verifies custody transfer. Final Courier Delivery: Courier displays DELIVERY QR -> Buyer or authorized delegated recipient scans -> server verifies final receipt. Direct Buyer Collection/Seller Delivery: Seller displays final receipt QR -> Buyer/delegate scans. Presenter/giver displays; recipient scans.

QR is primary, stage-specific OTP is fallback, and Manual Verification is emergency recovery through an authorized Operator/domain workflow. Every method requires server connectivity and uses the same state machine, actor/stage/Order/assignment checks, expiry, single use and replay controls. A disconnected device cannot record local acceptance for later synchronization.

Buyer may authorize one final recipient using name and phone before final credential issuance. Verify the designated phone for app scanning, or send final-delivery OTP to that phone when scanning is unavailable. Delegation transfers no Order ownership, payment/refund rights, Claim ownership, Review eligibility or Buyer Chat history; Review rights remain with the Order Buyer.

![Current Handoff stage and recipient protocol](graphics/DEPLOY_05.svg)
*Figure 05. Current Handoff stage and recipient protocol. Recipient-directed OTP and Collection delegates; governed lockout recovery; connected final receipt.*

## 83. Checkpoint-evidence privacy boundary

Checkpoint evidence is restricted Fulfilment data associated with a specific assignment, Order, purpose and Handoff context. Exact coordinates are not public Storefront or general analytics fields; redact them from standard logs and apply Privacy/Claims retention and authorized case access.

Exactly two best-effort foreground checkpoint opportunities exist. Evidence failure cannot prevent valid connected physical receipt or be used as a substitute for Handoff. No movement-route storage or Buyer/Seller live-map infrastructure is required.

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

## 84. Verified-purchase Reviews

Deploy Reviews evidence interfaces for canonical verified payment plus FINAL_HANDOFF or upheld eligible VERIFIED_ORDER_FAILURE. Operator outreach/Notifications follows one AVAILABLE Buyer/Order Grant and first-issuance T+1/T+3/T+10 cadence; delivery failures never create or alter eligibility. Migrate reminder identity and nullable/discriminated evidence before activation; Product quality requires received lines.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 85. Environment model

Canonical environments are LOCAL, STAGING and PRODUCTION, with PREVIEW for safe web review. Each has separate data, credentials, provider configuration and observability.

## 86. Local development

Use Docker-based local services for PostgreSQL and Valkey, safe local adapters and dev/test R2 scopes where required. No production credentials or production customer data are available locally.

## 87. Staging

Staging uses production-like managed Render, PostgreSQL, Valkey, Cloudflare/R2 and provider sandboxes at smaller capacity. It is the mandatory validation environment before production promotion.

## 88. Production data never moves downward

Do not copy raw production databases, evidence buckets or customer exports to developer laptops, preview or staging. Build deterministic synthetic fixtures instead.

## 89. Synthetic fixtures

Staging fixtures should include Accounts, Sellers, Product Posts, Scene Posts, same-Seller tags, multi-cart checkout, provider payment attempts, paid Orders, Couriers, Pickup/Delivery checkpoint evidence, pickup/delivery Handoff, Claims, Reviews, operator work items and account-deletion states.

Fixtures include separate Operator Accounts/credentials and ordinary Accounts, stock-driven Scene PRIVATE/restoration cases, private mixed Collections, public Product/Seller/Scene Search, four Trust labels, approved Courier relationships/requests/offers and compensation snapshots. Competing acceptance, one-active-delivery, delegated final receipt and absent checkpoint evidence must be represented without implying Adulis Government-ID storage.

## 90. Staging SMS and push

SMS uses allowlisted test numbers or disabled delivery. Push targets only staging builds/devices. OTP vendor credentials and production push keys remain separate.

## 91. Staging payment provider

Use Chapa/provider sandbox or an internal deterministic provider adapter in staging. Never run automated staging tests against production merchant credentials.

## 92. Environment naming

Use explicit names such as adulis-api-production, adulis-worker-staging, adulis-platform-db-production, adulis-queue-production and adulis-cache-production. Avoid ambiguous names like db2 or final-prod.

## 93. Deployment vs business configuration

Environment variables hold technical deployment configuration such as URLs, secrets and runtime settings. Market eligibility, currencies, payment-provider availability, FYP weights, Trust thresholds, seller policy and current transaction Commercial Policy and future Seller packaging remain versioned domain configuration.

## 94. Market context

Every commerce request resolves explicit Market context. Global Day-1 does not justify hard-coded Ethiopia assumptions or automatic use of one payment provider in every country.

## 95. UTC API and local human time

APIs and canonical event timestamps use UTC ISO 8601 instants. Buyer/Seller/Operator displays render the relevant Market/order IANA timezone. Deployments must ship timezone data and tests for DST/multi-zone markets.

## 96. Website data-residency policy

Website PII writes resolve a versioned residency_policy before persistence, selecting storage zone, allowed processors, retention policy and whether the form is enabled.

If no approved policy exists for a country/market, public content remains available but PII collection fails closed instead of silently storing data in the default region.

## 97. Three-plane Website data model

Keep global public CMS output globally cacheable, Website private intake in residency-controlled Website data planes, and Platform account/commerce data in the Platform plane accessed only over HTTPS APIs.

### PART IX - SECURITY, SECRETS AND CONTROL-PLANE PROTECTION

Deployment credentials are production authority. Protecting GitHub, Render, Cloudflare, EAS and the domain is as important as application authentication.

## 98. Secrets architecture

Secrets never enter Git, built static assets, mobile bundles or broad logs. Store them in Render/Cloudflare/GitHub/EAS protected secret systems according to the component that needs them.

## 99. Secret inventory

Maintain a metadata-only inventory with secret name, purpose, system, owner, rotation strategy and last rotation date. Never store the secret value in the inventory document.

## 100. Environment and service scoping

Do not reuse credentials across staging/production, public/private R2, Website/Platform databases or unrelated provider adapters. Least privilege limits blast radius.

## 101. R2 credentials

Use separate scoped credentials for public media writing, quarantine/private media, Website CMS assets, backups and restricted evidence. Avoid one broad root key in every service.

## 102. Encryption-key versioning

Sensitive encrypted records identify the key version used. Rotation adds a new version, moves new writes, re-encrypts in background, verifies, retains the old key through rollback window, then retires it.

## 103. GitHub security

Require strong MFA/passkeys, protected main branch, review before merge, protected production environments and limited organization administration. Production release credentials are environment-protected.

## 104. Render security

Use individual workspace access, least privilege, environment separation and periodic audit. Do not share founder passwords or broad personal tokens.

## 105. Cloudflare security

Protect DNS, WAF, R2 and CDN with individual accounts, strong MFA/passkeys and scoped API tokens. Keep registrar recovery independent.

## 106. Domain registrar security

Enable registrar lock, strong MFA/passkeys, secure recovery codes and multiple legitimate company contacts where feasible. Domain compromise can bypass many application controls.

## 107. Separate Operator Account deployment/security boundary

Operator Account is a separate internally provisioned privileged security principal, never an ordinary Account promotion/grant. Isolate ops.adulis.<tld>, host-only secure/HttpOnly cookie, OPERATOR audience, phishing-resistant authentication, CSRF, stateful revocation and fresh strong reauthentication. Public applications cannot provision an Operator.

The principal/credential/authorization boundary may reside within the existing Platform PostgreSQL and modular monolith. This requires logical/table/schema/session separation, not an automatic Operator microservice or physical database split. Personal ordinary Account compromise/recovery/suspension/deletion remains independent; no shared cookie or impersonation is allowed.

Current Adulis Seller verification does not ingest Government-ID/selfie identity imagery. Restricted storage still supports legitimate Claim/Privacy/Operator evidence; provider-specific KYC remains provider-owned.

![Separate internal Operator principal](graphics/DEPLOY_06.svg)
*Figure 06. Separate internal Operator principal. Personal public Accounts and privileged Operator Accounts have independent authentication, sessions, lifecycle and recovery.*

## 108. EAS and app-store security

Protect Expo/EAS and Apple/Google organization accounts with strong authentication, multiple legitimate administrators and documented recovery. OTA and native release credentials are production credentials.

## 109. AI coding-agent boundary

AI coding agents may modify code, tests and infrastructure definitions through PRs. They do not receive implicit production database mutation, Render/Cloudflare credentials, provider secrets, identity evidence or unrestricted production shell access.

### PART X - CI/CD, RELEASE ORDER AND FEATURE ACTIVATION

GitHub is the release authority. Staging receives reviewed artifacts first; production promotion remains deliberate and auditable.

## 110. Branch model

Use short-lived feature branches -> pull request -> main. Avoid long-lived develop/staging/production branches unless a measured workflow need appears.

## 111. Single gate catalogue

Local and hosted CI invoke the same ordered gate definition so developers cannot get a false local green result that CI rejects for different checks.

## 112. PR gate set

At minimum run dependency installation, strict TypeScript/typecheck, lint, dependency-cruiser, Jest, Testcontainers integration, database migration/invariant checks, generated OpenAPI contract verification, relevant web/mobile builds, Playwright/Maestro paths, security checks and targeted k6 gates.

## 113. Generated API contract verification

When NestJS/OpenAPI source changes, CI fails if generated TypeScript clients are stale. Supported clients consume one canonical contract rather than handwritten parallel DTOs.

## 114. Migration verification

CI creates a fresh database, installs required extensions, applies every migration and runs invariant tests. High-risk releases also test previous-production-schema -> new migrations.

## 115. Staging trigger

A reviewed merge to main with green CI automatically deploys the affected staging artifacts. Independent repos deploy independently: ordinary adulis-web CMS/site changes do not require a Platform release.

## 116. Production trigger

Production is manual promotion after staging validation. A main-branch merge alone is never sufficient authority to deploy production.

## 117. Two-person production rule

When two qualified founders/developers are available, the person who merges a high-risk change should not be the only person approving production promotion.

## 118. Documented single-person exception

When only one qualified person is available during a real production incident, a single-person emergency release may occur with incident reference, reason, exact artifact, rollback/forward-fix plan and post-release review.

## 119. Backend release order

Default compatible sequence: database expansion -> worker compatible with old/new jobs -> API -> affected web clients -> smoke/E2E -> observe -> enable feature flag.

Consumer compatibility comes before producers emit new BullMQ job payloads.

## 120. Company Website release

adulis-web has its own GitHub Actions pipeline and deployment credentials. Site/API/CMS can be released without Platform deployment. Account-deletion integration contract tests ensure Website changes do not duplicate lifecycle logic.

## 121. Storefront release

Storefront is independently deployable from the adulis-platform monorepo. Server-rendered pages and public cache behavior are verified in staging with Product Post/Scene Post deep links and social in-app-browser tests.

## 122. Seller/Operator Console release

Authenticated web consoles are independently deployable artifacts. Old browser tabs may remain open during rollout, so APIs remain additive and session/CSRF behavior is tested across version overlap.

## 123. Native mobile release

Native-code or native-permission changes use EAS production build -> internal/TestFlight/Play testing -> backend compatibility verification -> store submission -> controlled store rollout. Courier location/task changes require native-release testing.

## 124. OTA release

Compatible JavaScript/asset changes may use EAS Update through staging then percentage production rollout. Runtime versions prevent incompatible OTA from reaching older native binaries.

## 125. Feature flags

Feature flags separate deployment from product exposure. Every flag has owner, purpose, default, targeting, creation date, telemetry and removal condition. Authorization and business invariants never depend on a client-side flag.

## 126. Current dormant feature flags

Similar Finds and Complete the Scene remain disabled. Cross-Seller Scene tagging is not enabled in the current release. Seller subscription/advertising packaging stays separately gated; the versioned launch-disabled zero Adulis Buyer Checkout surcharge is already current transaction policy.

### PART XI - OBSERVABILITY, ALERTS AND DEPLOYMENT GUARDRAILS

Observability must answer both software-health and commerce-integrity questions without collecting sensitive payloads.

## 127. Observability layers

Use Sentry for error/release context, Pino for structured redacted server logs, pg_stat_statements plus managed database metrics for query diagnosis, Valkey/BullMQ metrics for async health, Cloudflare/R2 metrics for edge/media, and product/business telemetry for guardrails.

## 128. Structured logging

Where relevant include timestamp, environment, service, deployment version, request ID/correlation ID, route, status and duration. Never log OTPs, sessions, provider secrets, full payment payloads, private evidence, identity documents, precise long-lived Courier routes or database URLs.

## 129. Deployment markers

Every production release creates a marker in Sentry/metrics/logging so a spike in errors, payment failures or FYP latency can be correlated with the exact release.

## 130. Backend metrics

Track request rate, p50/p95/p99 latency, error rate, CPU/memory, event-loop lag, active requests and database-pool usage.

## 131. Database metrics

Track connections, slow queries, locks/deadlocks, transaction duration, CPU/memory/storage and PITR/backup health. Use pg_stat_statements to identify regressions caused by new Product/Scene or analytics queries.

## 132. Queue metrics

Track queue depth, oldest job age, throughput, retry/failure counts, dead jobs, worker concurrency and processing duration. Oldest job age is often a better user-impact signal than raw queue length.

## 133. Cache metrics

Track hit/miss ratio, memory, evictions, latency and connection errors separately for cache and queue Valkey.

## 134. FYP metrics

Track Scene Post candidate/ranking latency, empty-feed rate, fallback rate, algorithm version, render/media failures and product-tag interaction latency. A Product Post appearing as a top-level FYP unit is a contract-alert condition.

## 135. Product/Scene content and visibility metrics

Measure Product/Scene read/render latency, tag availability mismatch, Scene automatic PRIVATE/restoration failures, eligibility-consumer/outbox lag, Search/FYP/Storefront invalidation lag, media derivative failure and cache-hit behavior. Alert on any Buyer/public response exposing PRIVATE Scene content despite delayed purge/projection jobs.

## 136. Payment and Order metrics

Track provider availability, payment attempt outcomes, callback verification failures, reconciliation lag, paid-Order creation latency, duplicate-idempotency rejections, Seller notification delay and checkout abandonment without treating analytics as payment truth.

## 137. Courier request, checkpoint and Handoff metrics

Measure delivery request/offer backlog, offer failure/expiry, atomic assignment conflicts, one-active-delivery rejection anomalies, checkpoint submission success/failure, Pickup/Delivery QR/OTP outcomes, replay rejection, Manual Verification volume and payment-to-Handoff latency. Location failure is distinguished from Handoff verification failure.

No tracking-freshness or movement-volume metric is a production dependency. Minimize all telemetry and redact precise coordinates.

## 138. Review reminder metrics

Track reminder schedule execution, delivery attempts, Buyer opens and Review submission outcome while enforcing the configured T+1, T+3 and T+10 reminder ceiling.

## 139. Website metrics

Keep Website observability separate from Platform incidents: public-site availability, CMS publish/revalidation, intake persistence, residency-policy failures, Website queue lag and Platform deletion/report API dependency errors.

## 140. Alert philosophy

Alert on business/user impact: payment verification failure spike, paid-Order creation failure, Handoff verification failure, delivery offer/assignment or checkpoint-evidence failures, OTP delivery collapse, queue age, DB exhaustion, FYP empty-feed spike, CMS intake persistence failures.

Do not page founders for harmless transient CPU fluctuations.

## 141. Post-deployment watch

After production release actively verify health, errors, latency, DB pool, queue age, provider payment outcomes, paid Orders, FYP, Product/Scene reads, Handoff, checkpoint submissions and affected feature metrics before closing the deployment window.

### PART XII - BACKUP, RECOVERY AND INCIDENT ARCHITECTURE

A backup is not trusted until it has been restored and verified. Recovery paths must preserve current business history rather than casually rewind it.

## 142. Backup layers

Use managed PostgreSQL PITR, encrypted logical database backups, infrastructure/configuration in Git, R2 lifecycle/versioning strategy and a secure secret/control-plane recovery inventory. Website and Platform databases are backed up/restored independently.

## 143. Platform PITR

PITR is the first database recovery layer. Restore to an isolated target, verify schema/invariants and reconcile before cutover. Never overwrite the running production database blindly.

## 144. Encrypted logical backups

Scheduled backup jobs use a read-limited credential where feasible, compress and encrypt pg_dump output, write to a private backup bucket, record checksum and verify upload.

## 145. Website recovery

The Website PostgreSQL/CMS store has its own backups and restore drills. Recovery must preserve residency/retention metadata and must not recreate Platform account-deletion state locally.

## 146. R2 deletion protection

Use lifecycle/versioning or a controlled DELETING -> purge workflow where policy permits. Account deletion and legal retention rules decide when private objects are physically purged.

## 147. Restore drills

Before launch and periodically thereafter: provision isolated database, restore, run schema/invariant/security checks, execute representative reads, measure duration and destroy the test environment.

## 148. RPO/RTO

Do not publish precise recovery guarantees until measured restore drills establish defensible targets. Track last recoverable timestamp and time to provision, restore, validate and cut over.

## 149. Backend instance loss

With multiple API instances, health checks remove a failed instance and remaining capacity continues while replacement starts. No data restore is required.

## 150. Worker loss

BullMQ jobs remain in queue/outbox-backed state; alert on stale heartbeat/oldest-job age, restart workers and allow idempotent processing to continue.

## 151. Cache loss

Fall back safely, protect PostgreSQL from stampede and rebuild cache. Correctness is unchanged.

## 152. Queue Valkey loss

Durable outbox records preserve important pending side effects. Restore queue connectivity, replay dispatch from outbox and reconcile. Do not silently drop critical notifications or lifecycle consequences.

## 153. PostgreSQL loss/corruption

Stop unsafe writes, determine last good point, restore to isolated database, run invariant/security checks, reconcile critical counts, change service connection only after verification and then validate commerce flows.

## 154. Bad migration

Disable the affected feature, then choose compatible application rollback, forward schema repair or PITR. PITR is a last resort when it would discard legitimate post-migration writes.

## 155. Cloudflare outage

At MVP Cloudflare is a shared edge dependency. Maintain registrar access, Render-origin documentation and backup communication channels. Do not add a second CDN solely for theoretical redundancy.

## 156. Render regional outage

Assume recovery means provisioning replacement resources in another region, restoring data and cutting over DNS/configuration. Do not pretend there is an instant in-place region switch.

## 157. Payment provider outage

Pause/degrade new provider-dependent checkout where necessary, keep verified historical Orders readable, retry reconciliation and preserve Handoff/Claims/Reviews for already paid Orders.

## 158. Read-only emergency mode

A backend-controlled emergency mode may block new state-changing commerce while preserving authenticated reads and already-paid Order support. Prefer narrow feature kill switches before a global outage page.

## 159. Runbook set

Maintain executable runbooks for deploy, rollback, DB migration/restore, worker outage, Valkey outage, payment-provider outage, Cloudflare/Render outage, secret rotation, mobile release/OTA rollback, Website outage, incident response and first-production launch.

### PART XIII - SCALING, COST AND PROVIDER PORTABILITY

Scale only from measured pressure. The initial architecture intentionally favors simple managed components over premature distributed systems.

## 160. Scaling doctrine

Scale from measured latency, concurrency, queue age, database behavior, media demand and cost, not registered-user count alone.

## 161. API horizontal scale

Add API instances when sustained CPU/memory/concurrency pressure is actually in API compute. Do not scale API to solve a hot database row or lock contention.

## 162. Worker scale

Scale BullMQ workers horizontally when oldest-job age or processing latency violates service expectations and jobs are idempotent/concurrency-safe. Separate critical/bulk queues only after starvation is observed.

## 163. PostgreSQL scale

Prefer vertical managed-database scaling and query/index optimization before sharding. Introduce PgBouncer/transaction pooling when connection pressure justifies another layer.

## 164. Analytics relief valve

If behavioral analytics materially harms transaction PostgreSQL, extract analytics storage/workload before splitting core Orders or Catalogue into microservices.

## 165. Valkey scaling

Queue and cache can scale independently because they have separate failure semantics and services.

## 166. Storefront and Website viral scale

Public pages should scale primarily at Cloudflare/CDN. Published Website content and Storefront media/public HTML should not linearly increase PostgreSQL load.

## 167. FYP scale

Before specialized ML infrastructure, optimize candidate queries, bounded pools, deterministic ranking, precomputed aggregates, Valkey caches and batched analytics.

## 168. Courier workflow and checkpoint capacity

Scale bounded checkpoint submissions from accepted delivery volume: at most two purpose-bound evidence checkpoints per delivery rather than a sample-frequency multiplier. Size requests/offers, notification fanout, acceptance contention and assignment reconciliation from measured workload.

Courier Pool/Network/request/offer/assignment/checkpoint features remain modules in the modular monolith. No Courier microservice, route optimizer, fleet infrastructure, Courier wallet/balance service or Adulis-operated Courier payout ledger is an MVP deployment requirement.

## 169. Cost categories

Track fixed infrastructure, usage infrastructure, provider transactions, R2/media, SMS, AI/classifier calls, mobile distribution/tooling and observability separately.

## 170. Cost anomaly alerts

Watch for unexpected R2 request/egress patterns, SMS spikes, provider-call spikes, FYP telemetry multiplication, database growth, checkpoint-evidence volume and failed submissions and runaway worker retries.

## 171. Provider portability

Keep standard Docker images, PostgreSQL, Valkey protocols, S3/R2-compatible object interfaces, HTTPS/OpenAPI and explicit configuration boundaries. Avoid embedding Render-specific semantics in domain code.

## 172. No hot standby region yet

Document cross-region recovery first. Add continuously replicated standby regions only when business impact, legal requirements or measured traffic justify the operating cost and complexity.

### PART XIV - PRODUCTION GOVERNANCE, LAUNCH CERTIFICATION AND FINAL ARCHITECTURE

The final part turns the architecture into an operational contract: ownership, release records, launch gates and non-negotiable invariants.

## 173. Production ownership

Every production surface and dependency has a named owner: platform API/worker, database, Valkey queue/cache, Cloudflare/R2, adulis-web, Storefront, Seller Console, Operator Console, Mobile/EAS, payment provider, SMS and observability. One founder may own several systems initially.

## 174. Deployment record

Record release ID, Git SHA/image digest, database migration version, web/mobile versions, runtime compatibility, promoter, time, feature flags, known risks and incident/change reference.

## 175. Change classification

Classify changes LOW, MEDIUM or HIGH. High-risk includes authentication/authorization, payment/provider integration, Orders, Inventory, Handoff, privacy deletion, Trust, operator access, encryption and destructive migrations.

## 176. High-risk change gate

Require second review when available, staging E2E, rollback/forward-fix plan, explicit production approval and post-deploy verification.

## 177. Production database console use

Direct production SQL is exceptional. Prefer read-only first, document reason and results, use transaction/review and repair business state through domain recovery functions/migrations that preserve audit.

## 178. No manual state repair

Never fix support incidents by editing an Order/payment/Handoff state because the UI appears wrong. Recover through reviewed domain logic with evidence and audit.

## 179. MVP physical deployment

The current production target is intentionally simple and managed.

```
CLOUDFLARE GLOBAL EDGE
  DNS / TLS / WAF / CDN
  R2 public + private namespaces
```

```
RENDER - PRIMARY PLATFORM REGION (FRANKFURT)
  adulis-api x2
  adulis-worker x1
  platform PostgreSQL 17
  queue Valkey
  cache Valkey
  Storefront runtime
  Seller Console web/gateway
  Operator Console web/gateway
```

```
ADULIS-WEB (SEPARATE REPO / DEPLOYMENT)
  Next.js site runtime
  Website NestJS/Fastify API
  CMS admin runtime
  Website PostgreSQL
  Website Valkey/BullMQ
  Website R2 scope
```

```
EAS / APP STORES
  one React Native + Expo binary
  Buyer + Seller Companion + Courier Mode
  native build tracks + compatible OTA channels
```

## 180. Build order

Recommended implementation sequence: local Docker/config validation -> GitHub protections/single gate runner -> Render staging data services -> backend image/API/worker -> Cloudflare DNS/R2/origins -> adulis-web staging -> web surfaces -> payment sandbox/webhooks -> mobile EAS staging -> backups/restore -> observability/alerts -> production infrastructure -> runbooks/incident drills -> launch certification.

## 181. First-production certification

Launch requires all critical deployment and current-product gates to pass.

• all cache/queue references use Valkey; no legacy datastore naming remains

• required PostgreSQL extensions and every migration pass on managed provider

• staging and production data/secrets/provider credentials are isolated

• Product Posts and Scene Posts render through current public/API contracts

• Buyer FYP returns Scene Posts only; Product Posts remain outside top-level FYP

• same-Seller Scene tagging is enforced; cross-Seller launch tagging is rejected

• deferred recommendation enrichments are disabled

• gateway payment verification, callbacks and reconciliation are idempotent

• paid Seller Order creation occurs exactly once; Seller cannot manually confirm payment

• multi-cart creates separate Seller Orders/payment attempts

• Seller-to-Courier pickup and Courier-to-Buyer delivery verification are distinct

• only Pickup/Delivery checkpoint evidence is captured best effort; no continuous/live-map delivery infrastructure is deployed

• no disconnected commerce success path exists on Mobile

• Company Website is deployed from separate adulis-web with standalone API/CMS/database

• Website residency policy fails closed for unapproved PII storage zones

• Storefront is server-rendered and social links resolve Product/Scene entities directly

• Seller/Operator origins do not share privileged cookies

• Sentry/Pino/pg_stat_statements and queue/cache/media/provider metrics are live

• PITR, encrypted logical backup and isolated restore drill have succeeded

• production promotion is deliberate and exact release identity is recorded

• native mobile release and OTA rollback paths are tested on supported iOS/Android devices

- Scene zero-tag/all-unavailable publish rejection, last-tag privacy, restock restoration and delayed-invalidation suppression pass on every public surface.

- Marketplace Search includes Products, Sellers and PUBLIC Scenes; mixed Collections cannot reveal PRIVATE content.

- Operator Accounts are separately provisioned and no public principal is promotable; Seller-ID imagery ingestion is absent.

- Courier Mark Ready precedes request/offer; atomic acceptance and one-active-delivery constraints pass; Buyer/delegate scans final Courier-displayed credential.

- Paid delivery charge equals immutable Courier offer compensation; zero-bps launch surcharge excludes delivery under current policy.

- Native Courier permission tests cover foreground checkpoints and non-blocking denial/failure; no Courier-only background task/map dependency exists.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 182. Deployment invariants

The invariant catalogue below is normative for production.

• DEPLOY-INV-01 Production, staging and local have separate data and credentials.

• DEPLOY-INV-02 Production customer data is never copied to developer machines or staging.

• DEPLOY-INV-03 PostgreSQL is canonical durable business truth.

• DEPLOY-INV-04 Valkey/cache/queues never become canonical commerce truth.

• DEPLOY-INV-05 API and worker processes deploy independently from the same reviewed backend image.

• DEPLOY-INV-06 Only one migration actor runs per release.

• DEPLOY-INV-07 Runtime and migration database credentials are separate.

• DEPLOY-INV-08 Supported mobile clients remain compatible with deployed /v1 APIs.

• DEPLOY-INV-09 Producers do not outrun BullMQ consumer payload compatibility.

• DEPLOY-INV-10 Critical jobs are idempotent and recoverable.

• DEPLOY-INV-11 Public media and private evidence have different storage/security boundaries.

• DEPLOY-INV-12 Large media bytes bypass NestJS request bodies.

• DEPLOY-INV-13 Product Posts and Scene Posts remain distinct deployed entity contracts.

• DEPLOY-INV-14 The Buyer FYP serves Scene Posts only under the current Mobile contract.

• DEPLOY-INV-15 Current Scene tags are same-Seller only.

• DEPLOY-INV-16 Gateway/provider payment truth is server verified.

• DEPLOY-INV-17 Seller clients cannot set payment success.

• DEPLOY-INV-18 Multi-cart never creates a cross-Seller Order.

• DEPLOY-INV-19 Handoff stages use distinct purpose-bound credentials and server verification.

• DEPLOY-INV-20 Best-effort Pickup/Delivery checkpoint evidence never proves receipt or blocks valid Handoff.

• DEPLOY-INV-21 adulis-web is separate from adulis-platform and has no Platform DB credentials.

• DEPLOY-INV-22 Website PII writes resolve an approved residency policy before persistence.

• DEPLOY-INV-23 Authenticated web HTML/state is never shared-edge cached.

• DEPLOY-INV-24 Production secrets never enter Git or client bundles.

• DEPLOY-INV-25 Production promotion is deliberate and staging-first.

• DEPLOY-INV-26 Backups are not proven until a restore succeeds.

• DEPLOY-INV-27 Code rollback and database recovery are separate operations.

• DEPLOY-INV-28 AI coding agents have no implicit production mutation authority.

• DEPLOY-INV-29 Similar Finds and Complete the Scene are not launch infrastructure dependencies.

• DEPLOY-INV-30 Kubernetes, Kafka and microservice-per-domain are not launch requirements.

- DEPLOY-INV-31 Content owns Scene visibility; current canonical eligibility gates every public read despite asynchronous invalidation.

- DEPLOY-INV-32 PRIVATE Scenes are suppressed from FYP/Search/Storefront/Collections and restore only after all public gates pass.

- DEPLOY-INV-33 Courier relationships may span Sellers; only one active accepted delivery is permitted.

- DEPLOY-INV-34 Operator Account is a separate internal principal with isolated credentials/sessions/recovery.

- DEPLOY-INV-35 No Adulis Seller-ID image ingestion or native Seller-video processing pipeline is deployed.

- DEPLOY-INV-36 Current Buyer surcharge and paid Courier charge/compensation are versioned immutable transaction facts.

## 183. Final deployment topology and release flow

Reviewed source/PR gates -> immutable backend/web/native release identity -> one additive migration actor and compatible backfills -> staging deployment/certification -> deliberate production promotion -> API/worker/web rollout -> supported Mobile native/OTA delivery -> post-deployment watch and recorded release.

Cloudflare/Render serve isolated public and privileged surfaces, Platform PostgreSQL remains single-region write truth, independent Website PostgreSQL respects residency, two Valkey roles/BullMQ relay idempotent outbox consequences, and R2/CDN/Sharp deliver approved images.

![Managed deployment boundaries](graphics/DEPLOY_07.svg)
*Figure 07. Managed deployment boundaries. Cloudflare edge and Render compute serve isolated clients; Platform truth, independent Website data, queue/cache roles and image delivery remain explicit.*

## 184. Final design philosophy

Deployment should make incorrect production behavior harder than correct behavior. Application code can be replaced; cache can be lost; workers can restart; an API instance can die. Canonical business history must not casually disappear or be reconstructed from client claims.

The intentionally boring architecture is the strength: Cloudflare at the edge, managed Render compute in one write region, PostgreSQL + Drizzle as truth, two Valkey roles, BullMQ for async work, R2/CDN + Sharp for media, GitHub Actions for reviewed change, and EAS/App Stores for the one mobile binary.

### APPENDIX A - UPDATED TECHNOLOGY STACK AND DEPLOYMENT OWNERSHIP

This appendix repeats the canonical stack as an implementation checklist and assigns each item to the deployment layer that must operate it.

| Layer | Canonical technology | Deployment impact |
| --- | --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript; Drizzle ORM; PostgreSQL | One modular-monolith API image plus worker process; Drizzle migrations; PostgreSQL remains durable truth. |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements | Provider certification installs/verifies every required extension; pg_stat_statements supports production query diagnostics. _ _ |
| Async / cache | Valkey; BullMQ | Separate queue and cache Valkey services; BullMQ workers remain non-canonical, retryable and observable. |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client | Contracts are generated and CI-verified across web and mobile clients. |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js | Rate limiting, secure HTTP headers and international phone normalization are production middleware concerns. |
| Media | Cloudflare R2; Cloudflare CDN; Sharp | Direct upload grants, quarantine/derivative processing and edge delivery; large media bytes bypass NestJS. |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; Expo SecureStore; Expo SQLite; Expo Camera; Expo Notifications; Expo Updates; small Zustand store | EAS native builds and compatible OTA channels; physical-device testing. Courier checkpoints may use foreground Expo Location; no background-task or live-route renderer dependency is required. |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 | Unit/domain, real PostgreSQL/Valkey integration, mobile E2E, browser E2E and load/capacity gates. |
| Observability | Sentry; Pino structured logs; pg_stat_statements | Release markers, redacted structured logs, service health and slow-query diagnosis. |
| Architecture control | dependency-cruiser | CI rejects forbidden package/domain imports and private-repository coupling. |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS | Immutable backend/web artifacts, managed compute, edge/CDN/R2 and mobile release workflows. |

Mobile Courier extensions

Courier checkpoint capture may use foreground Expo Location. It does not require expo-task-manager or a route-map renderer solely for delivery. Independently approved map features may retain their own dependencies. Native capability changes still require reviewed development/native builds, device permission/failure testing and supported release compatibility.

### APPENDIX B - SUPERSEDED DEPLOYMENT ASSUMPTIONS

The following assumptions from earlier deployment/system documents must not govern the current build.

• The old pre-payment hold workflow and its expiry/worker/metrics paths are removed from deployment architecture.

• The former manual buyer-to-seller payment-verification workflow is not the canonical payment path.

• All cache/queue infrastructure is named and implemented as Valkey; legacy datastore naming is removed.

• The Company Website is not a static-only page bundle inside the main platform repository; it is the independent adulis-web monorepo with Website API and CMS.

• The Seller Storefront is not deployed as the previous Worker-specific architecture; the current design is Next.js server rendering on managed compute behind Cloudflare.

• Product Posts and Scene Posts replace generic seller-post/Scene-only deployment assumptions.

• The Buyer FYP does not deploy Product Posts as top-level feed units under the current Mobile contract.

• Cross-Seller Scene Post tagging is not enabled for launch.

• Similar Finds and Complete the Scene do not justify launch infrastructure, queues or ranking services.

• Mobile commerce is online; no disconnected Handoff success or general offline mutation queue is deployed.

• Commercial policy is domain-versioned rather than hard-coded into environment variables. The zero launch Adulis Buyer surcharge is current; Seller subscription/advertising packaging remains separately governed.

## 185. Glossary

| Term | Definition |
| --- | --- |
| API Process | Request-serving process from the reviewed backend Docker image. |
| Worker Process | Separate process for idempotent jobs/reconciliation from the same backend image. |
| Canonical Truth | Authoritative durable business facts in PostgreSQL-backed owning domains. |
| Transactional Outbox | Durable event/intent recorded with canonical transaction, relayed after commit and reconciled. |
| BullMQ | Standard idempotent background-job system using Queue Valkey. |
| Valkey | Supporting queue/cache infrastructure; never canonical business truth. |
| Cache Valkey | Rebuildable bounded cache with loss/eviction semantics distinct from queue storage. |
| Queue Valkey | BullMQ queue infrastructure with durable-queue failure/reconciliation policy. |
| Scene Post | Seller-authored image-led discovery content with same-Seller Product Post tags and current eligibility. |
| Product Post | Canonical structured commerce representation of exactly one Product; current price/stock are domain-owned. |
| Scene Visibility | PUBLIC/PRIVATE dimension independent of publication state and moderation. |
| Private | Seller-only Scene visibility; excludes Buyer/public resolution. Authorized investigation is separate. |
| Public | Scene visibility eligible for Buyer/public delivery only when all current gates pass. |
| Checkpoint Location Evidence | Two best-effort foreground Pickup/Delivery captures; supporting evidence, never receipt authority. |
| Courier Pool | Standing Seller-approved Courier relationships, separate from active delivery assignment. |
| Cross-Seller Courier Network | Approved opportunities/relationships across Sellers using one persistent Courier identity. |
| Courier Delivery Charge | Seller-defined Buyer checkout charge; equals immutable Courier compensation in MVP. |
| Operator Account | Separate internally provisioned privileged security principal; independent of public Accounts and recovery. |
| PITR | Point-in-time database recovery under backup/restore policy. |
| Expand-Migrate-Contract | Add compatible structures, migrate/backfill, then retire old structures safely. |
| Release Identity | Immutable reviewed version/artifact and migration identity recorded for deployment. |
| Primary Write Region | Single launch region accepting canonical database writes. |
| R2 | Object storage for domain-governed public images and restricted evidence. |
| CDN | Edge public delivery/cache; cannot authorize private evidence or Scene exposure. |
| Shoppable Post | Superseded former term for Scene Post. |

## 186. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-17 — Theme and appearance architecture | The 13 October pack contains shared design tokens; final brand palette is not contract-closed. | Production clients use semantic theme roles with Light, Dark and System plumbing so palette changes are centralized. Theme Lab (Baseline plus ten candidates) is prototype evaluation tooling only and must not ship as production theme choices. No candidate palette is canonical until founder approval. Operational status colors remain semantic and independent from brand palette. | Theme Lab + WO-001, 27 Oct / 8 Nov 2026 |
| R-18 — Mobile app identifiers and production foundation | ADU-MOB-02 v4.2 already specifies one React Native/Expo app with Buyer, Seller Companion and Courier modes. | Canonical application identifiers are Android applicationId com.adulis.app and iOS bundleIdentifier com.adulis.app. One Expo/React Native app exposes Buyer, Seller Companion and Courier modes under one ordinary MOBILE session. Mode switching changes active context, not identity/session. Available modes are backend-authoritative; active mode is UI state. Operator is never a Mobile mode. | WO-001 / WO-001A, 8 Nov 2026 |
| R-19 — Mobile-safe localization and Amharic release gate | The 13 October designs prohibit Mobile software-subscription purchase/billing surfaces and keep commercial subscription management in Console. | Mobile runtime imports only a physically isolated mobile-safe/shared localization catalogue; Console-only subscription, tier, billing and software-purchase copy must not enter the Mobile import graph even if hidden at runtime. English/Amharic key parity is enforced. Current Amharic strings are not approved human translations; Amharic remains disabled for users until a human translation/review pass is complete. | WO-001A, 8 Nov 2026 |
| R-20 — Courier MOBILE API/auth contract correction | ADU-AUTH-02 v3.2 and ADU-MOB-02 v4.2 already define Courier as a third ordinary Mobile mode using the ordinary MOBILE session. | Executable API/auth contracts must be corrected to match the design: Courier uses audience=MOBILE with backend-verified Courier relationship/capability, exact resource scope and permission surface. Do not move Courier back to Console/cookie auth to match stale implementation contracts. Until the corrected contract is published, production Mobile must not fabricate Courier API calls. | WO-001 discovery + October 13 AUTH/MOB authority |
| R-21 — Mode eligibility bootstrap and generated API-client types | The 13 October design assumes server-authoritative relationship/permission evaluation. | Bootstrap/session contracts must expose sufficient authoritative relationship/capability information to derive Buyer/Seller Companion/Courier mode availability without trusting a client role. The shared generated API-client seam must export generated OpenAPI path/types. Mobile must not hand-write duplicate DTOs to compensate for missing schemas or exports. | WO-001 / WO-001A discovery, 8 Nov 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.

### Open / deferred items

• Courier MOBILE executable contract and mode-eligibility/bootstrap projection remain implementation-contract gaps; the product/system design remains one MOBILE session with Courier as an authorized relationship context.

• Amharic user release remains blocked on human translation/review even though rendering and key parity are technically validated.

• Final production brand palette remains open; semantic theme architecture is required, Theme Lab candidates are not canonical.
