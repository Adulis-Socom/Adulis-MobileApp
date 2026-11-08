# Adulis Platform Integration
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R01, R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-ARCH-PLATFORM-01_Adulis_Platform_Integration_System_of_Systems_Architecture_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Executive Summary

Adulis is a strict TypeScript NestJS + Fastify modular monolith with one canonical owner per important fact. PostgreSQL + Drizzle preserves business truth; owner application contracts handle immediate decisions, while committed outbox/job intent and shared BullMQ execution deliver independent aftermath.

This complete v3.0 baseline replaces the historical purchase/payment assumptions throughout the integration architecture. The current path is Scene/Search/Storefront -> Product Post -> Seller Cart -> Checkout Session -> independent Seller Order -> confirmed provider attempt -> backend verification -> paid Order -> fulfilment -> connected Handoff. Qualifying final DELIVERY anchors exactly one Buyer Review Grant.

Dedicated current subsystem designs govern internal domain rules. This Platform document governs ownership, dependency direction, context propagation, transaction boundaries, cross-domain consistency, async mechanics and failure semantics. A conflict with a current subsystem is reconciled here, never retained as an OPEN alternative.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

The architecture is globally extensible with explicit phased Market activation. Ethiopia is the initial commerce Market, beginning with Addis Ababa. Future Markets require approved currency, provider, legal, commercial and operational readiness. Locale, IP address, phone prefix and client country never activate commerce.

## 2. Goals

• Preserve one fact owner, private repositories, legal transitions and strict Seller tenancy.

• Make current Checkout/provider payment, Scene visibility, final Handoff, Reviews, Trust and Claims contracts coherent across every surface.

• Use typed ordinary and separate Operator identity without role-isolated human graphs.

• Protect immediate correctness with current canonical reads, locks, constraints and explicit transaction contracts.

• Record critical asynchronous intent atomically, tolerate duplicate execution and reconcile derived state.

• Define unavailable, ambiguous and delayed behavior explicitly rather than guess business success.

• Use generated REST/OpenAPI clients, dependency fitness checks, real-infrastructure tests and measured scaling.

• Activate Markets deliberately with provider/legal/operational readiness.

## 3. Non-Goals

MVP excludes a Buyer-facing Reserve transaction model, manual bank-transfer/Seller confirmation purchase path, disconnected Handoff acceptance, native-video FYP, paid organic Trust/rank, an independent Seller mini-commerce backend, a generic BFF/GraphQL layer and premature domain microservices.

AI business advice is not an MVP or Phase-1 dependency. Creator is optional policy-gated admission metadata unless a future product/Market decision explicitly finalizes its commerce capability. No duplicate ordinary worker engine, event broker or hidden cross-domain setter is introduced.

## 4. Canonical Architecture Principles

| Principle | Implementation consequence |
| --- | --- |
| Own the fact once | Every entity/state field has an owner and lawful mutation interface. |
| Command for an immediate answer | Synchronous bounded orchestration returns owner-confirmed legality; no optimistic paid/receipt result. |
| Commit before aftermath | Canonical mutation and required event_outbox/job_intent share the transaction. |
| Assume duplicates | Consumer/effect identity and database constraints prevent duplicate business effects. |
| Carry typed context | Principal, Seller scope, Market, correlation and policy survive legitimate calls/jobs. |
| Re-read current authority | Session claims, cached permissions, queue time and old projections never replace current scope/state. |
| Keep sensitive evidence private | Purpose, source-domain capability, typed audit, holds and confirmed deletion apply. |
| Scale from evidence | Separate process capacity before service extraction; protect PostgreSQL first. |

## 5. Existing System Landscape

| Human-facing surface | Current scope / backend boundary |
| --- | --- |
| Company Website | Public corporate/information surface; no independent commerce authority. |
| Seller Storefront | Adulis Seller profile/storefront resolving current Products and Scenes, not a separate mini-store backend. |
| Seller Console | Full permitted Seller business work under current ordinary relationship/role/surface checks. |
| Mobile App | One React Native/Expo app with Buyer, Seller Companion and Courier capabilities where enabled; modes are presentation. |
| Operator Console | Separate privileged Operator Account surface, current capabilities, scope, freshness and audit. |

Buyer Home launches For You, Following, Nearby, Discounts and Locally Made. For You is default and photo Scene-only; other tabs retain independent retrieval semantics. Search is intent retrieval with PRODUCT_POST, SELLER and SCENE_POST; Collections saves PRODUCT_POST and SCENE_POST.

## 6. Top-Level System Context

![Client surfaces share typed REST owner interfaces](graphics/ARCH_01.svg)
*Figure 01. Client surfaces share typed REST owner interfaces. The same modular platform serves current Adulis surfaces; Operator credentials and capability guards remain separate.*

All surfaces use REST/OpenAPI and generated clients. The API boundary authenticates the correct principal and current Market/scope; owner modules compose bounded decisions. PostgreSQL is canonical, R2/CDN/Sharp handles Media, and provider adapters handle authenticated external effects. API and worker process fleets scale independently within the modular architecture.

## 7. Domain Ownership Map

| Domain / module | Canonical ownership and boundary |
| --- | --- |
| Accounts / Authentication | Ordinary human identity, phone/session/recovery; separate Operator account/session contracts, never role conversion. |
| Authorization | Seller OWNER/TEAM relationships, role union, team exclusivity and resource/surface checks; distinct privileged capabilities. |
| Seller | Business entity, profile/type/status and Market; creation uses the approved atomic OWNER bootstrap contract. |
| Onboarding / Eligibility / Verification | Social-control evidence, versioned admission and fresh readiness; no Government-ID admission. |
| Catalogue | Product, Variant and one-Product Product Post representation and publication. |
| Inventory | Stock balance/event and allocation protection effects under canonical locks and constraints. |
| Content | Scene revisions, same-Seller tags, publication and PUBLIC/PRIVATE visibility. |
| Media | Image metadata/processing and byte grants, derivatives, private evidence access and deletion. |
| Recommendation / FYP | Scene candidates, features, ranking, diversity, exploration and sessions; cannot override hard eligibility. |
| Search | Intent-based Product/Seller/Scene retrieval and bounded query projections; separate rank contract. |
| Collections | Buyer-owned accepted Product/Scene membership; no public visibility override. |
| Checkout | Seller Cart, Checkout Session, current amount preview/confirmation and internal provider-attempt-bound allocation orchestration. |
| Orders | Independent Seller Orders, immutable purchased lines and legal state transitions. |
| Payments / Finance | PaymentAttempt, authenticated provider facts, reconciliation, refunds, Seller provider account, settlement, surcharge ledger and restricted financial evidence. |
| Fulfilment / Courier | Selected mode, preparation, custody assignment, current Courier relationship/assignment and supporting checkpoints. |
| Handoff | Connected purpose-bound credentials, delegation and immutable accepted physical receipt. |
| Reviews | Two-basis Buyer/Order Grant, publication and distinct Product-quality/Seller-service dimensions. |
| Trust | Evidence-derived NEW/REBUILDING/ESTABLISHED/TRUSTED state and policy-versioned consequences; cannot be purchased. |
| Claims | One Seller Order / optional same-Order line, immutable case evidence and human decision/correction history. |
| Moderation | Safety findings/restrictions and enforcement policy; cannot rewrite finance or case decisions. |
| Chat | One Buyer + Seller + Market Conversation; immutable Message subject and Scene provenance. |
| Chatbot | Deterministic typed answer resolver; optional model classifies only, no authoritative model commerce prose. |
| Notifications | Logical typed-recipient notice, per-device delivery/attempt history and preferences; no state authority. |
| Billing | Approved Seller subscription and entitlement obligations; no implicit per-completion Seller commission. |
| Commercial Policy | Versioned exact Buyer surcharge/amount/refund component policy, consumed by Checkout/Finance. |
| Market | Explicit activation, currency/provider/legal/operational configuration and effective versions. |
| Eventing | event_outbox, event_delivery, job_intent, relays, async audit/dead letters and repair; owns no business fact. |
| Analytics | Typed observations, attribution, metric versions, bounded projections/features and primary outcome reporting. |
| Privacy | Purpose/retention/holds, deletion orchestration and anti-resurrection tombstones through source owners. |
| Audit | Append-only privileged/sensitive action evidence with typed principal, scope, purpose and governing version. |
| Observability | Pino/Sentry/query/queue diagnostics and service budgets; not private evidence or business truth. |

## 8. Source-of-Truth Matrix

| Important fact | Source of truth / lawful mutation |
| --- | --- |
| Ordinary identity / credentials | Accounts/Auth; ordinary owner workflows only. |
| Operator identity / current capability | Separate privileged identity and authorization contracts; internally provisioned, audited. |
| Seller relationship / team exclusivity | Authorization relationship service + PostgreSQL typed constraints. |
| Seller admission / publish readiness | Onboarding/Eligibility fresh decision with canonical dependency reads. |
| Product representation / stock | Catalogue publication and Inventory balance/events, respectively. |
| Scene publication / visibility | Content state/revision; public reads revalidate current gates. |
| Cart / Checkout Session | Checkout; Cart holds no stock and no payment truth. |
| CheckoutAllocation | Approved Checkout/Inventory application transaction; short-lived, provider-attempt-bound. |
| Seller Order / purchased lines | Orders; legal transition from owner-confirmed facts. |
| PaymentAttempt / provider verification | Finance; authenticated event and exact server reconciliation. |
| Refund / provider settlement | Finance/provider normalized confirmed fact; distinct from paid Order and receipt. |
| Seller provider account / KYC readiness | Finance/provider safe reference and restricted evidence policy. |
| zero launch Adulis Buyer surcharge ledger | Finance accounting under immutable Commercial Policy and currency rounding snapshot. |
| Restricted financial evidence | Finance manifest/private storage, purpose-bound audited access. |
| Courier assignment / accepted Handoff | Fulfilment assignment and Handoff immutable receipt, respectively. |
| Review Grant / rating | Reviews final_handoff_id uniqueness and separate publication/aggregate rules. |
| Trust level / Claim decision | Trust evidence engine; Claims human adjudication, respectively. |
| Conversation / Message subject | Chat immutable Buyer-Seller-Market history and Message context. |
| Logical notice / delivery | Notifications canonical rows; push response is neither read nor business fact. |
| Subscription / entitlement | Billing approved obligation, independent of the Buyer transaction surcharge. |
| Market version / async intent | Market effective configuration and shared Eventing PostgreSQL records. |
| Search/FYP/analytics/public stats | Derived rebuildable projections only; owner truth always wins. |

## 9. Domain Dependency Graph

![Commerce facts, discovery and quality have explicit owners](graphics/ARCH_02.svg)
*Figure 02. Commerce facts, discovery and quality have explicit owners. Solid integration boundaries preserve current owner queries, synchronous commands and independent durable aftermath.*

The figure shows canonical business-fact progression and independent aftermath; public discovery also reads current Content directly. Section 10 specifies exact C/Q/E interface and call direction. Every integration uses a declared typed owner command, bounded reader or committed fact, never a private repository import.

Immediate legal decisions use owner orchestration. Independent Order completion, Reviews Grant and Trust interpretation consume accepted Handoff separately; Order completion is not a second Grant anchor. Historical context, private Content and derived discovery do not establish commerce authority.

## 10. Command / Query / Event Dependency Matrix

C = owning command; Q = bounded canonical query; E = independent committed owner-event consumer. This directional matrix is an integration contract, not a permission to share repositories or mutate an aggregate from a query.

| Caller / consumer | Owner / dependency | C / Q / E and required boundary |
| --- | --- | --- |
| Seller bootstrap | Seller + Auth relationships + Market | C approved atomic unit of work; OWNER, DRAFT and outbox commit together. |
| Onboarding readiness | Auth, Catalogue, Finance, Fulfilment, Market | Q fresh permission and policy-gated status; no raw KYC/Scene requirement. |
| Catalogue publish | Onboarding, Media, Moderation, Market | Q immediate readiness/safety; C Catalogue publication. |
| Content publish / reevaluate | Catalogue, Inventory, Seller, Media, Moderation, Market | Q current gates; E availability facts; C Content visibility only. |
| Checkout preview / confirm | Catalogue, Inventory, Fulfilment, Commercial Policy, Market | Q current exact price/stock/mode/fees; explicit Buyer material reconfirmation. |
| Checkout attempt creation | Orders, Inventory, Finance | C approved atomic scope/allocation contract then provider effect from durable identity. |
| Finance verification | ProviderAdapter, Orders | Authenticated external verification; Finance C fact + E Order legal paid transition. |
| Order paid / cancellation | Inventory, Fulfilment, Notifications | C declared legal stock effect where atomic contract requires; E independent aftermath. |
| Handoff issue / verify | Orders, Auth, Fulfilment, Market | Q normalized paid eligibility, current relationship/assignment/recipient; C accepted evidence. |
| Order completion | Handoff | E final accepted DELIVERY; re-read own legal state. |
| Review Grant | Handoff, Orders, Claims, Finance | E qualifying final DELIVERY or approved paid-Order-failure/correction facts; Q current paid/decision/received-line facts; C one unique Buyer/Order Grant. |
| Review publication | Review Grant, Moderation | Q/C own validity; E aggregates, Trust, bounded discovery quality. |
| Claims | Orders, Finance, Handoff, Content, Media, Chat | Q exact historical/canonical evidence; C own human decision/history; C Finance remedy request. |
| Trust | Claims, Reviews, Handoff and own evidence | E structured facts/corrections; C own deterministic policy evaluation. |
| Moderation | Content, Catalogue, Seller, Market | C owner enforcement interfaces; E public projection refresh. |
| Recommendation / Search | Content, Catalogue, Inventory, Market, Trust, Moderation | Q hard gates; E bounded feature/index refresh; distinct ranking contracts. |
| Collections | Content / Catalogue | Q authorized current resolution; C canonical Buyer membership. |
| Chat / Chatbot | Content, Catalogue, Inventory, Orders, Finance, Handoff | Q typed slot facts; C Chat immutable Message; Checkout via explicit Buyer flow only. |
| Notifications | Owner events, Auth/current recipient contexts | E policy resolution; C logical notice/delivery rows; no commerce mutation. |
| Billing | Commercial Policy / approved subscription contract | Q entitlement and approved fee terms; C own obligation, no inferred transaction commission. |
| Analytics | Owner events / approved CLIENT schema | E canonical facts, batch observation ingestion; no owner C. |
| Privacy / Audit | Every relevant source owner | C bounded hold/delete/access record with explicit purpose and legal authority. |
| Eventing workers | Owning domain application service | E/C current-state re-read and stable idempotent effect; no generic mutation. |

## 11. Forbidden Dependencies

• No module imports another domain’s private repository, ORM mutator or generic shared commerce DAL.

• No cache, UI, Client telemetry, Chat text, model answer, Search result or FYP score establishes payment, stock, receipt, Claim outcome or Trust.

• No ordinary role can become Operator; no Operator impersonates a party or uses a universal canonical setter.

• No Seller payment-confirmation path or Buyer-facing Reserve state machine is a current purchase dependency.

• No Recommendation/Eventing archive or visibility mutation; Content alone decides stock-driven PRIVATE/PUBLIC.

• No order.completed independent Review Grant producer or PICKUP Grant.

• No complete Creator actor/identity, AI business-advice dependency or localization rank promise enters MVP without an explicit ratified product change.

• No persistent Handoff or Analytics replay queue on Mobile, no second ordinary worker engine and no request-path correctness dual write to Valkey.

• No general Analytics/private export captures raw Chat, Review text, QR/OTP, provider secrets or routine KYC.

## 12. Shared Kernel

The shared kernel contains pure, small primitives: typed IDs, Money/currency and exact rounding interfaces, Market/locale references, clock abstraction, discriminated principal context, correlation, idempotency key types, safe error/result shape, policy-version reference and shared Eventing/OpenAPI contracts.

Do not place Seller, Order, Payment, Inventory or Claim repositories, mutable domain objects, universal authorization or business transition functions in the kernel. A reusable type is not an owner bypass. Money operations use decimal/integer minor-unit correctness; floating-point guesses and client recalculation cannot define charge truth.

## 13. RequestContext

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

```
type Principal =
  | {kind:'ANONYMOUS_PUBLIC'; anonymousRef?:string}
  | {kind:'ORDINARY_ACCOUNT'; accountId:string}
  | {kind:'OPERATOR_ACCOUNT'; operatorAccountId:string}
  | {kind:'SYSTEM'; authenticatedServiceSource:string};
type EventScope =
  | {kind:'GLOBAL'; originatingMarketId?:string}
  | {kind:'MARKET'; marketId:string};
RequestContext = {principal; scope; requestId; correlationId;
  locale; surface; decisionAt; authorizedSellerContextId?};
// Runtime schema + trusted-source/session + resource guards required.
// Anonymous requests cannot claim SYSTEM or execute commerce.
```

![Explicit anonymous, ordinary, privileged and trusted service contexts](graphics/ARCH_03.svg)
*Figure 03. Explicit anonymous, ordinary, privileged and trusted service contexts. Modes change acting relationships, not identity; separate Operator and delegate receipt boundaries remain.*

## 14. ActorContext

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

| ActorContext | Authorization resolution |
| --- | --- |
| Buyer | Ordinary Account owns the target Order, Collection, Message or Grant. |
| Seller | Ordinary Account -> current OWNER/TEAM relationship -> unioned permissions -> Seller, surface and exact resource. |
| Courier | Ordinary Account -> active profile/relationship -> exact current assignment/offer and stage. |
| Delegate | Active named/normalized-phone authorization and verified phone control, receipt only. |
| Operator | Separate Operator Account -> current capability -> exact case/resource/purpose, freshness and governance. |
| SYSTEM | Approved automation source and owner contract; no party impersonation. |

Authentication answers who; authorization answers current relationship/capability; the owner decides whether the transition is legal. Having other roles never removes legitimate Buyer rights.

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

## 15. MarketContext

The architecture is globally extensible with explicit phased Market activation. Ethiopia is the initial commerce Market, beginning with Addis Ababa. Future Markets require approved currency, provider, legal, commercial and operational readiness. Locale, IP address, phone prefix and client country never activate commerce.

MarketContext includes canonical market_id, currency, timezone, activation/status and applicable provider/commercial/legal/config versions. Requests resolve permitted Market from server resource truth. Order and financial snapshots preserve the effective version for historical obligations; workers re-read current legality for new effects.

Missing/inactive route denies new commerce. Existing paid obligations are handled only through the Market’s explicit wind-down/refund/fulfilment policy and owning domains; locale or a client country cannot reactivate operations. One Seller has one Market in MVP; future extensibility does not mean international Day-One activation.

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

## 16. Correlation & Request IDs

Generate or validate bounded requestId at the edge and retain correlationId across composed owner calls, provider attempts, outbox facts, job executions and sensitive audit. Each retry has attempt identity but retains the stable business/effect identity.

Do not log complete payloads to preserve correlation. Safe logs carry actor class, opaque allowed resource references, Market, route/job, result category, duration and release. Provider request identity and external idempotency references are stored in Finance, not inferred from log text.

## 17. Configuration Context

Use typed versioned configuration for Market activation, supported currency/provider, social admission, fulfilment windows, Checkout amount/zero-bps launch surcharge and rounding, internal allocation deadlines, Handoff TTL/attempt policy, Claims SLA/remedies, Trust thresholds, visibility rules and feature rollout.

Mutable operational flags cannot retroactively rewrite a purchased amount, provider attempt, decision or historical evidence. Capture applicable versions on canonical records and reject overlapping effective ranges where the domain requires exclusivity. Commercial Policy belongs to its owner; no payment-instruction snapshot or implied Seller commission is active.

Defaults are explicit and safe: disabled optional Creator/native-video/AI advice features remain unavailable; missing critical fee/provider/Market policy fails closed rather than guessing.

## 18. Synchronous Interaction Rules

Immediate success requires bounded synchronous orchestration of current owner decisions: authenticate/authorize, resolve exact resource and Market, fetch current legal facts, validate the command, take required locks and commit the canonical effect. Do not use a future event to justify a present PAID, PUBLISHED, VERIFIED or accepted purchase response.

Checkout resolves exact Product/Variant, quantity, fulfilment, current stock, price, delivery and disclosed zero launch surcharge in a server preview. Material changes require an updated final summary and explicit Buyer reconfirmation before any provider attempt. Cart is intent, not stock protection.

Cross-domain calls have explicit timeout and result semantics. If an external provider outcome is ambiguous, return PROCESSING/RECONCILING under the same attempt identity; never create a blind second charge. Expensive media, bulk Analytics and independent notices are asynchronous.

## 19. Asynchronous Interaction Rules

Business changes and required event_outbox and/or job_intent commit in the same PostgreSQL transaction. The shared Eventing relay leases durable intent, creates versioned event_delivery records from its consumer registry and deterministic BullMQ jobs after commit. BullMQ on Valkey is the sole ordinary background execution engine. Delivery is at-least-once; workers re-read current canonical scope/state and use PostgreSQL uniqueness and processed-effect markers. Repair, dead-letter review and bounded reconciliation recover outages; no correctness-sensitive PostgreSQL-to-Valkey dual write is allowed.

Use committed past-tense facts for independently retryable consequences: Order completion from final receipt, Review Grant, Trust recomputation, Content availability reevaluation, Notifications, Search/FYP refresh, Analytics and privacy repair.

Domain owners select and version consumer semantics. A delayed consumer revalidates relevant current state and privacy/authority; an old event cannot resurrect deleted linkage, revoked team scope, private Scene visibility or an expired allocation. One failed consumer does not suppress others or roll back the accepted owner fact.

## 20. Transaction Boundaries

A local PostgreSQL transaction may span an explicitly documented owner application unit of work when a joint invariant requires it. Repositories stay private and each owner validates its part. Network provider calls are never claimed atomic with the database; durable effect identity and reconciliation cross that boundary.

| Operation | Atomic canonical boundary / independent aftermath |
| --- | --- |
| Seller creation | DRAFT Seller + ordinary OWNER relationship + Market + event_outbox through approved Auth/Seller contract. |
| Product publication | Catalogue publication plus fresh readiness validation and outbox; Content/FYP do not become publication owners. |
| Scene publish / visibility | Content revision/state/visibility + outbox after current tags/availability/safety; downstream refresh independent. |
| Inventory adjustment | Balance/StockEvent + non-negative/concurrency backstop + outbox. |
| Checkout / allocation | Concrete Seller Order/payment scope, attempt-bound allocation/stock protection and deadline job_intent under approved owner unit of work. |
| Provider verification | Finance authenticated exact result, dedup/idempotency marker and outbox; provider network lies outside transaction. |
| Order PAID | Orders legal transition from verified Finance fact with declared Inventory/allocation effect contract and outbox. |
| Handoff acceptance | Credential consumption/sibling revocation, canonical accepted evidence and handoff.verified outbox. |
| Order completion | Orders own legal transition and outbox from re-read final receipt; distinct from Handoff transaction. |
| Review Grant | One Buyer-owned eligibility/consumption per paid Seller Order; FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; delegate never owns it. |
| Review publication | Accepted Review/dimensions and outbox; aggregates/Trust/discovery independent. |
| Claim open / evidence / decision | Claims scope/manifest/hold references or append-only decision/history and outbox; no direct Finance/Trust/Review write. |
| Trust evaluation | Own deterministic state/evidence-policy snapshot, immutable transition and outbox. |
| Moderation enforcement | Own decision and typed owner enforcement contract; legal paid obligations remain with Orders/Finance. |
| Collections / Notifications | Accepted membership or logical notice/delivery canonical rows with effect uniqueness. |
| Billing / Commercial Policy / Market | Approved own obligation/configuration + effective version constraints + outbox/audit. |
| Privileged action / privacy | Current capability and bounded owner command; required immutable audit and hold/deletion intent commit legally. |

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 21. Strong Consistency Requirements

| Strong requirement | Backstop / owner |
| --- | --- |
| Identity and resource authority | Typed ordinary/Operator principal, current relationship/capability, surface and exact tenant/case scope. |
| Money verification | Authenticated provider result, exact amount/currency/attempt match and Finance dedup; no Seller/client proof. |
| Stock / CheckoutAllocation | Deterministic locks, non-negative balances, attempt-bound protection, canonical expiry and payment re-read. |
| Checkout confirmation | Server current preview and material-value version; explicit reconfirmation before effect. |
| Order transition | Owning state machine and unique processed financial/receipt identity. |
| Handoff acceptance | Connected current paid/stage/assignment/recipient, signature/TTL/use and accepted-evidence uniqueness. |
| Review Grant | One Buyer-owned eligibility/consumption per paid Seller Order; FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; delegate never owns it. |
| Scene public access | Current Content publication/visibility + available eligible tag + Seller/Market/Media/safety gates even with stale index. |
| Claims integrity | Same-Order line FK, NULL-safe unresolved scope, append-only human decisions/corrections. |
| Config / sensitive access | Effective-version constraints, source-purpose access, privacy holds and current Operator revocation. |

Independent propagation is not made synchronous merely to call it strong. The canonical fact and durable required consequence are strong; Trust/Review aggregates and projection consumption remain eventual with repair and documented lag.

## 22. Eventual Consistency Requirements

FYP features, Search indexes, Seller dashboards, Review aggregates, Analytics, Notifications, affinity/public statistics and safety/Scene visibility propagation are rebuildable eventual projections. Define owner, source identity, watermark/version, freshness budget, repair method and safe stale response.

Content stock-driven PRIVATE/PUBLIC decisions may wait for their consumer, but public serving also checks current eligible Product availability and current Content/safety/Market state. A stale cache/index cannot expose a currently PRIVATE or otherwise ineligible Scene. Stock loss does not archive; valid restock permits Content-owned automatic restoration after all gates pass.

Content owns Scene Post revisions, publication state DRAFT/PUBLISHED/ARCHIVED and visibility PUBLIC/PRIVATE separately. Public publication requires media/caption, same-Seller eligible tags and at least one available tagged Product, plus current Seller, Market and Moderation gates. Last available Product loss changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Stock recovery may automatically restore PUBLIC only after all current gates pass; it does not archive or require manual republishing solely for restock. Independent archive/removal or safety blocks remain effective.

Privacy tombstones and revocation are checked on replay. Notification/Analytics lag does not block accepted commerce; a required unresolved legal money/stock fact fails safely rather than using a projection.

## 23. Transactional Outbox Contract

Business changes and required event_outbox and/or job_intent commit in the same PostgreSQL transaction. The shared Eventing relay leases durable intent, creates versioned event_delivery records from its consumer registry and deterministic BullMQ jobs after commit. BullMQ on Valkey is the sole ordinary background execution engine. Delivery is at-least-once; workers re-read current canonical scope/state and use PostgreSQL uniqueness and processed-effect markers. Repair, dead-letter review and bounded reconciliation recover outages; no correctness-sensitive PostgreSQL-to-Valkey dual write is allowed.

| Shared component | Mechanical responsibility |
| --- | --- |
| event_outbox | Committed versioned owner fact and publish/delivery metadata. |
| consumer registry / event_delivery | Declared versions/consumers, per-consumer identity, lease/status, retry and completion. |
| job_intent | Required direct/deadline/external effect intent with stable identity and run_at; reconstructable after queue loss. |
| Relay | Lease bounded committed rows, enqueue deterministic BullMQ jobs, record safe handoff; retry crash gaps. |
| Worker | At-least-once execution, current canonical read and owner application command with stable effect marker. |
| Dead letters / repair | Bounded classification, safe retry/reconcile and scoped Operator audit; no blind state override. |

![Committed intent to recoverable ordinary execution](graphics/ARCH_04.svg)
*Figure 04. Committed intent to recoverable ordinary execution. At-least-once delivery; no claim of distributed exactly-once execution.*

BullMQ is the sole ordinary execution technology. No Graphile Worker, Kafka, RabbitMQ or Temporal is an MVP parallel path. Valkey durability is useful operationally but never the only record of required business intent. A crashed relay after enqueue may repeat delivery; database effect idempotency decides business uniqueness.

## 24. Event Contract Requirements

Registered domain events declare owner, past-tense meaning, event/version identity, aggregate/reference, occurred_at, Market, correlation/causation, policy version where material and consumer/privacy/retention contracts. Actor attribution is typed ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or SYSTEM with separate safe identity fields.

Payloads are minimized: no sessions/JWTs, OTP/QR, phone/address, private Chat/Review prose, provider secret, KYC document or Operator narrative. Consumers resolve current permitted facts through owner readers. Released payload meaning is immutable; breaking identity/content semantics requires a new producer version and explicit historical compatibility transform, never an in-place rewrite.

handoff.verified safely carries stage, fulfilment mode, method, recipient class, current assignment reference and verified_at. Reviews consumes qualifying final DELIVERY and upheld eligible failure evidence; Orders and Trust consume according to their independent contracts.

Use the complete supplied Contract_Registry/event_contract_registry.json and event_payload_schemas.json, not an illustrative list. Handoff consumers filter one handoff.verified by stage; guest delegate transport uses the separate Handoff job intent. Generated contracts/CI reject undeclared names/versions/owners and preserve independent consumer delivery/effects.

## 25. Idempotency

Define idempotency around actor/resource/Market and one intended command, not around arbitrary HTTP retries. Store request fingerprint/result where necessary; mismatched reuse fails. Child commands derive deterministic identities from the parent and owner effect type. Database uniqueness enforces accepted evidence, provider event, Review Grant, Claim incident and logical Notification boundaries.

External financial effects retain one PaymentAttempt/refund/settlement reference and provider idempotency key. On timeout, reconcile the existing identity; do not create a fresh charge to make a request appear successful. A consumer commits effect plus processed marker and next outbox atomically.

A legitimately repeated Buyer action obtains a new intent identity. Replay of the same event/attempt does not multiply stock consumption, Grant, refund, Trust consequence or notice. Privacy and current eligibility still apply before replayed effects.

## 26. Concurrency

Acquire stock/allocation rows in deterministic order and use PostgreSQL transaction/row locks and constraints to prevent oversell, negative balances and deadlock amplification. The declared Checkout/Inventory contract covers protection, consumption and release. Cart never protects stock.

A delayed allocation expiry locks and re-reads current deadline/version, provider attempt and paid Order. Resolved, extended or consumed allocations no-op; ambiguous payment reconciles before release according to owner policy. A late timer cannot release paid consumed inventory.

Handoff verification locks current credential/stage and accepts evidence once. Grant creation conflicts return the existing Buyer Grant. Claim scope uses NULL-safe uniqueness. Last available Product loss emits durable Inventory/Catalogue facts; Content rechecks current affected Scenes rather than trusting old deltas.

## 27. Cross-Domain Database Rules

Typed foreign keys may encode cross-domain referential integrity, including same-Order line and distinct ordinary/Operator references, without giving write authority. Owner schemas/repositories remain private. Document bounded read-only joins/projections with privacy and performance purpose; a join does not bypass authorization.

An explicitly approved multi-owner unit of work may preserve a joint invariant through owning application facades, deterministic locks and shared transaction context. Seller + OWNER bootstrap and Checkout stock protection are examples. This narrow contract is not permission for a generic shared repository, arbitrary ORM access or hidden domain trigger.

## 28. Repository Ownership

Each module exposes public application commands, bounded readers and versioned event contracts; domain entities and repositories remain private. Infrastructure adapters implement declared interfaces behind the owner. DTOs are validated at runtime and OpenAPI generates client types.

```
modules/<domain>/
  public/       typed commands, readers, event contracts
  application/  orchestration, transaction and idempotency boundaries
  domain/       legal state transitions and invariants
  persistence/  private Drizzle repositories and migrations
  adapters/     provider/media/SMS integration where owned
  workers/      thin re-read + owning application command
packages/contracts/  shared pure types and generated API/event contracts
```

dependency-cruiser enforces public interfaces, detects cycles and forbids private repository imports. A worker does not become a parallel business implementation. Contract tests verify real owner rules and actor shapes.

## 29. Database Functions & Triggers

Use PostgreSQL constraints and narrowly scoped functions for invariants that must survive concurrency: non-negative stock, legal allocation effects, credential single acceptance, NULL-safe case scope, same-Order evidence attachment, effective-date ranges and Grant uniqueness.

Trusted functions have an explicit owner and caller contract, transaction and authorization responsibility. They do not invoke HTTP, hide Claims adjudication, calculate independent Trust math, write every domain through generic payloads or dispatch to Valkey before commit. Triggers cannot become undocumented cross-domain workflows; durable owner events carry aftermath.

## 30. Read Models & Projections

Read models are disposable derived state with source identities, schema/metric/algorithm version, updated_at/watermark and repair contract. Public endpoints compose current owner gates with a bounded projection; they do not accept the projection as Stock, Finance, Handoff, Claim or Trust authority.

Scene eligibility is checked at public response/continuation time despite an old index, feed session or CDN reference. Current PRIVATE or unavailable tags cannot be revived by saved history. Historical Scene attribution/case evidence remains exact, private where required and separate from public resolution.

Bounded stale display can be marked where safe; critical state denies or queries the canonical owner. Rebuilds respect privacy tombstones, Market and versioned historical semantics.

## 31. API Composition

Prefer purpose-built REST read endpoints that compose a small bounded set of owner readers. Generated OpenAPI clients serve Mobile, Seller Console, Operator Console, Storefront and Website where applicable. No generic BFF, GraphQL gateway, handwritten parallel contract or cross-domain write-through read endpoint is required for MVP.

Composition carries authenticated typed context and applies current resource/surface/tenant authorization before fetching restricted detail. Declare per-dependency timeout and partial-result semantics. Product/Storefront reads may degrade ancillary stats; Checkout cannot guess price, payment, stock or Market. Pagination, query cost and media metadata are bounded.

## 32. Cache Policy

Valkey caches only rebuildable non-authoritative data with explicit key scope, version, TTL and invalidation/repair. Cached permissions, old provider state, client selection or feed projections never authorize current sensitive actions. Shared rate coordination may use Valkey, but canonical Handoff OTP attempt limits remain in PostgreSQL.

Public immutable image derivatives may be CDN-cacheable; current Scene access still honors Content/availability/safety gates. Private Claims/Finance/KYC evidence is purpose-bound and does not use unrestricted public cache URLs. Reusing an old URL or collection entry cannot republish private Content.

Cache outage uses safe canonical readers or bounded eligible fallback where feasible; if truth cannot be established, the operation fails safely. No request-path double write to PostgreSQL and cache claims atomic business correctness.

## 33. External Vendor Boundary

| Adapter | Boundary / failure semantics |
| --- | --- |
| PaymentProviderAdapter | Provider-independent initiation, authenticated webhook/verify, refund and settlement; Chapa only on configured Ethiopia route. Exact attempt/currency/amount checks and idempotency. |
| SMS | Purpose-bound sends and normalized outcome; configured Ethiopia providers such as Afromessage/SMSEthiopia where approved. Future Twilio/Infobip routes require Market activation. |
| Push | Typed logical notice and current device binding; provider accepted delivery is not user read or business success. |
| TikTok / Instagram | Independent Login Kit/control adapters with server callback state/PKCE/CSRF/replay protection; never Adulis login. |
| R2 / CDN | Media/evidence byte grants, immutable image delivery or private purpose access; deletion confirmation and holds. |
| Optional classification model | Chatbot approved bounded intent classification only; deterministic slot/template rendering and safe recovery. |
| Future integration | Explicit owner, allowed Market capability, timeout, privacy, cost and migration plan before activation. |

All external callbacks are untrusted until authenticated, bounded and matched to the canonical reference. A timeout/ambiguous provider result never means success or safe stock release; persist processing/reconciliation under the same identity. Credentials and raw responses are minimized/redacted, with restricted evidence retention only where justified.

## 34. Security Boundaries

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

| Boundary | Required enforcement |
| --- | --- |
| Ordinary human session | Auth credentials/session and current Buyer/Seller/Courier/delegate resource checks. |
| Privileged internal session | Independent OPERATOR audience, current capability, freshness/governance and typed audit. |
| Tenant / object access | Exact canonical Seller/Buyer/Market/Order/case scope; supplied IDs are never authority. |
| Provider / webhook | Signature/authentication, replay/dedup, reference/amount/currency validation; no redirect proof. |
| Public / private Media | Public derivative versus current restricted purpose grant and source hold. |
| Sensitive evidence / KYC | Source-owned minimal access, legitimate purpose and current capability; default excludes KYC. |
| Automation / replay | Approved SYSTEM source, safe provenance, current state and stable effect identity, never a stored JWT. |

## 35. Tenant Isolation

Tenant authority is relationship and resource based. A Seller-scoped request derives exact Seller from current OWNER/TEAM relationship and compares it with the canonical resource. Changing sellerContextId, route IDs or client mode cannot expose another Seller. Buyer rights are exact ownership; Courier rights are exact assignment.

Effective permissions are unioned across roles within the current membership but remain constrained by surface and owner state. Removed or suspended scope is re-evaluated on the next action. PostgreSQL FKs prevent invalid references; they do not replace application authorization. Projections and exports retain the same scope/privacy rules.

## 36. Operator Integration

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

Internally provisioned Operator Accounts have separate credential/recovery/revocation lifecycle, capability grants and audit. Typed operator_account_id and ordinary_account_id never share a generic FK. Claims adjudication, Manual Handoff, social evidence review, sensitive export and operational repair each require their own scoped capability.

Follow current Founder/Staff governance and required Step-Up/approval, including only valid current Solo Coverage exceptions. Re-check revocation and purpose before every sensitive read/action. No party impersonation, ordinary role conversion, support shortcut, raw SQL console or universal business setter exists.

## 37. Error Propagation

| Failure category | User/API meaning and consequence |
| --- | --- |
| Authentication / authorization | Deny with safe current principal/scope result; avoid revealing another tenant’s resource. |
| Domain conflict / stale preview | Return stable reason and current permitted state; Buyer must reconfirm material Checkout changes. |
| Critical dependency unavailable | Fail safely when stock, Market, payment or required authority cannot be established. |
| External effect ambiguous | Return processing/reconciliation for the existing attempt; no invented PAID/refund/completion. |
| Derived data stale | Expose bounded freshness or safe fallback; never override canonical truth. |
| Async delivery delayed | Accepted owner fact remains; independent notice/projection/Grant shows current state until repair. |
| Rate / payload bound | Controlled retry/backoff or rejection; redact secret/evidence inputs. |

Errors preserve correlation and stable public codes while internal exception details remain restricted. A transport 200 or provider browser return cannot substitute for the owning domain’s committed outcome.

## 38. Retry Policy

Retries have bounded backoff/jitter, classified transient/permanent outcomes and stable intent/effect identity. Record external attempt before executing it; Finance reconciles ambiguous effects under the same provider reference rather than charging again. Current policy determines timeout and maximum operational attempts; no universal retry count grants business authority.

Relays and workers may repeat safely after crashes. Canonical transaction/effect marker protects accepted Handoff, stock, Grant, remedy and notice uniqueness. Dead-letter replay is bounded, scoped and audited and re-reads current Market/actor/privacy/state. Poison or unsupported events are quarantined, not coerced into newer semantics.

## 39. Failure Matrix

| Dependency / scenario | Current behavior / repair |
| --- | --- |
| Checkout stock or price unavailable | Fail/revalidate; no blind acceptance or provider charge. |
| Inactive Market / missing route | Deny new commerce; owner-configured historical obligation policy only. |
| Provider unavailable before initiation | Return safe unavailable/processing state under durable attempt policy; no paid guess. |
| Provider outcome ambiguous | Keep existing attempt PROCESSING/RECONCILING and verify server-side; no duplicate charge. |
| Valkey / BullMQ unavailable | PostgreSQL truth and required outbox/job intent remain; asynchronous consequences wait and reconcile. |
| PostgreSQL unavailable | No canonical mutation/verification can succeed; safe retry under same intent. |
| Handoff network unavailable | Cannot issue or verify; no offline acceptance or later sync completion. |
| Scene visibility/index consumer delayed | Current publication/visibility/available-tag gates deny ineligible serving; Content repair converges. |
| Recommendation / Search degraded | Bounded currently eligible fallback or unavailable; never revive private content. |
| Notifications / Analytics unavailable | Accepted owner transaction remains; independent retry or behavioral shedding. |
| Claims / Trust / Reviews consumer lag | Durable fact persists; own pending/freshness state and idempotent replay; no fabricated consequence. |
| Media/R2 unavailable | Fail new required upload/evidence acquisition safely; retained manifests/holds are not declared deleted. |
| Ordinary relationship / Operator revoked | Next sensitive read/action denied using current authority; old page/JWT/cache does not bypass. |

## 40. Workflow A - Seller Onboarding

Authenticate the ordinary Account -> create DRAFT Seller + OWNER relationship + Market + outbox atomically -> collect store/type/fulfilment metadata -> verify TikTok/Instagram control through independent Login Kit or purpose-bound official-page DM fallback -> evaluate established social-business presence under effective policy -> query Catalogue/Finance/Fulfilment readiness -> re-check before Seller publication.

Adulis Seller admission requires no Government ID, legal-ID upload or selfie-to-ID flow. A PSP may independently impose KYC/KYB under its contract and the activated Market. Prefer provider-hosted collection and retain only provider references, safe status and masked metadata in Finance. Any unavoidable Adulis handling requires a confirmed requirement and restricted Finance purpose, storage, access, audit, retention and deletion controls; it does not become an Onboarding ID requirement.

DM reviewer is a separate Operator Account recording sender/code evidence; Eligibility re-evaluates rather than accepting eligible=true. No Government-ID admission surface or active IDENTITY_PATH exists. Creator admission is an optional trait enabled only by explicit Market/Product policy, not a new Account/Seller type.

Product readiness does not require Scene publication or a circular already-public Seller prerequisite. Orders are placeable throughout the day; selected delivery/collection/store-visit windows constrain physical service, not global Checkout availability. Admission does not confer Trust.

## 41. Workflow B - Product Publication

Seller-scoped ordinary actor with current permission -> Catalogue valid Product/Variant/Post draft -> approved Media READY -> current Seller readiness, Market and Moderation gates -> legal Product publication + outbox -> Product/Storefront/Search projection. Product Post is the one-Product commerce destination, not an independent For You unit.

Content owns Scene Post revisions, publication state DRAFT/PUBLISHED/ARCHIVED and visibility PUBLIC/PRIVATE separately. Public publication requires media/caption, same-Seller eligible tags and at least one available tagged Product, plus current Seller, Market and Moderation gates. Last available Product loss changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Stock recovery may automatically restore PUBLIC only after all current gates pass; it does not archive or require manual republishing solely for restock. Independent archive/removal or safety blocks remain effective.

Scene publication is a separate Content command. Same-Seller tagged Product eligibility and at least one available tag are checked at publication; public serving rechecks gates. Current Catalogue permits legitimate Product creation without an invented Onboarding/subscription count cap; abuse/safety and ratified entitlement rules remain explicit.

![Current eligibility runs before every new controlled Scene delivery](graphics/ARCH_05.svg)
*Figure 05. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 42. Workflow C - Checkout and independent Seller Orders

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

Seller Cart/Checkout Session groups intent only; independent Seller Orders and sequential multi-Seller provider attempts remain. No new Buyer-facing reservation or distributed cross-Seller transaction.

![One safe release predicate and a separate money/stock commit](graphics/ARCH_06.svg)
*Figure 06. One safe release predicate and a separate money/stock commit. Timer/request alone never releases uncertain stock. Provider failure has no guaranteed resolution time.*

## 43. Workflow D - Provider Payment

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

Initial provider-managed Seller settlement target is conditional on exact merchant/contract capability evidence. Browser return is navigation; Finance preserved verification establishes money, Order joint commit establishes readiness.

![One safe release predicate and a separate money/stock commit](graphics/ARCH_07.svg)
*Figure 07. One safe release predicate and a separate money/stock commit. Timer/request alone never releases uncertain stock. Provider failure has no guaranteed resolution time.*

## 44. Workflow E - Handoff

Provider-paid eligible Order -> Seller prepares -> selected fulfilment mode -> for Courier, Seller presents and assigned Courier verifies PICKUP -> final DELIVERY physical meeting -> Seller or assigned Courier presenter displays QR / requests OTP -> Buyer or active delegate recipient scans/proves receipt -> Handoff verifies once and commits immutable evidence + outbox.

Buyer Collection uses Seller -> Buyer DELIVERY; Seller Delivery uses Seller -> Buyer/delegate; Courier PICKUP is Seller -> assigned Courier; Courier DELIVERY is assigned Courier -> Buyer/delegate. Preserve ADU-HANDOFF-2, server Ed25519, purpose/Order/Market/assignment/recipient binding, short TTL, co-presence, single use and canonical attempts. GPS supports context only. No disconnected issuance/acceptance or persistent sync queue exists.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Trust alone owns NEW, REBUILDING, ESTABLISHED and TRUSTED and its policy-versioned consequences. Generic accepted receipt is separate from stronger QR promotion evidence: qualifying final Buyer/delegate QR receipt may count under Trust policy; OTP and Manual do not automatically receive QR credit. Upstream domains expose safe method/purpose facts and never set Trust levels or promotion math.

Order Management independently completes legally from accepted final evidence. Approved Manual recovery uses a separate Operator Account, current capability/governance and exact paid/assignment/recipient validation, never a payment or ownership override.

![Current Handoff stage and recipient protocol](graphics/ARCH_08.svg)
*Figure 08. Current Handoff stage and recipient protocol. Recipient-directed OTP and Collection delegates; governed lockout recovery; connected final receipt.*

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

| Mode / stage | Presenter -> intended recipient | QR / OTP / Manual / transition |
| --- | --- | --- |
| Buyer Collection / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Seller displays / recipient scans; OTP to recipient; expressly authorized presenter may submit recipient-supplied code. Governed Manual; accepted final receipt. |
| Seller Delivery / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Same direction; no Courier pickup. Governed Manual; accepted final receipt. |
| Courier / PICKUP | Seller actor -> current assigned Courier | Seller displays / Courier scans; OTP to Courier. Governed Manual; custody only, no Buyer feedback Grant. |
| Courier / final DELIVERY | Current assigned Courier -> Buyer OR active authorized delegate | Courier displays / recipient scans; OTP to Buyer/delegate. Governed Manual; final receipt. |

## 45. Workflow F - Reviews

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Buyer submits Review under its unique Grant for relevant purchased lines. Reviews validates current policy and publishes separate Product-quality and Seller-service dimensions -> rating projections -> Trust evidence -> bounded Search/Recommendation quality -> Seller Analytics. Review publication and downstream aggregates each use stable idempotent facts.

Delegate receipt qualifies the Buyer and never changes authorship. Claim opening or findings do not directly create/revoke a Grant or automatically suppress Reviews; Reviews applies its explicit policy. Reviews never sets Trust level directly.

![One Seller Order feedback identity, two evidence bases](graphics/ARCH_09.svg)
*Figure 09. One Seller Order feedback identity, two evidence bases. Multiple Claims and delivered refund disputes cannot create a second Review; delegate never owns feedback.*

## 46. Workflow G - Claims

Open a Claim on one Seller Order and optional same-Order line -> preserve exact Product/Scene representation, selected immutable Message context, Finance provider facts, accepted Handoff and bounded party attachments -> request evidence where needed -> authorized separate Operator Account human adjudication -> append decision/history + outbox -> approved provider refund/fulfil remedy through the owner -> owner-confirmed remedy fact -> legal case resolution.

An allegation is not a finding; timer expiry is not a verdict; NOT_UPHELD is not automatically bad faith. Decision correction appends a superseding decision and compensating facts without erasing history. Trust re-evaluates its consequences from structured outcomes; Claims never writes Trust or Reviews Grant tables.

A PRIVATE Scene remains legitimate exact historical case evidence under bounded purpose and hold; case access cannot republish it. Final Buyer/delegate receipt does not prove item condition/description, so NOT_AS_DESCRIBED may coexist with accepted DELIVERY. Provider ambiguity remains pending; Claims cannot mark a refund complete.

![Adverse findings remain visible; consequences are proportionate](graphics/ARCH_10.svg)
*Figure 10. Adverse findings remain visible; consequences are proportionate. Trust never sells levels or sets Moderation restrictions; changed rates are not calibrated by document editing.*

## 47. Workflow H - Moderation

Moderation records a scoped safety decision and invokes owning enforcement commands -> canonical Content/Product/Seller gate changes + outbox -> independent Search/FYP/Storefront/Collection refresh and Notifications. Response-time hard gates protect stale projections immediately.

Moderation does not rewrite captured paid Orders, provider money, Claim verdicts or Handoff history. Existing obligations and remedies follow Orders/Finance/Claims policy. Content stock-driven PRIVATE is a different cause from safety removal/archive; restock cannot clear independent restrictions. Private case notes and unrelated allegations never become public content.

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

## 48. Workflow I - Configuration

Authorized owner or separate Operator capability proposes typed configuration -> required validation/governance -> effective-version overlap/activation check -> atomic Market/Commercial Policy record + audit/outbox -> bounded consumer refresh. Existing snapshots keep their historical versions.

The architecture is globally extensible with explicit phased Market activation. Ethiopia is the initial commerce Market, beginning with Addis Ababa. Future Markets require approved currency, provider, legal, commercial and operational readiness. Locale, IP address, phone prefix and client country never activate commerce.

New provider/Market requires currency, verification/refund/settlement, legal and operational readiness. Locale, phone prefix and IP cannot activate a route. Missing current policy fails closed; a feature flag cannot silently enable Creator identity, Government-ID admission, native-video FYP or a second worker engine.

## 49. Workflow J - Recovery

Ordinary Account recovery and phone change use Auth’s current verified-control, Step-Up and security policy. New phone/control does not transfer Seller ownership, Order Buyer, provider route or Grant automatically. Re-check normalized identity uniqueness and revoke relevant sessions/credentials under the owner’s policy.

Operator Account recovery is a separate internally governed privileged lifecycle; ordinary recovery cannot obtain it. Sensitive Seller/provider configuration change uses exact current relationship, approved surface and required freshness. No invented universal cooling period or support impersonation shortcut is added; current subsystem policy remains authoritative.

## 50. Async Job Ownership

| Owning domain / work | Execution and canonical rule |
| --- | --- |
| Eventing relays / repair | Lease committed outbox/job intent; deterministic BullMQ jobs; per-consumer delivery, dead letters and audit. |
| Checkout / Inventory deadlines | Canonical allocation run_at/version; re-read payment/paid/consumed state before release; sweeper repairs queue loss. |
| Finance verify / refund / settlement | Durable attempt/effect identity; authenticated provider reconciliation; no blind second effect. |
| Content availability reevaluation | Bounded affected Scenes; re-read all gates; Content-owned PRIVATE/PUBLIC + outbox. |
| Handoff cleanup / attention | Canonical credential/delegation expiry and current state; never late offline acceptance. |
| Reviews Grant / aggregates | Grant consumes qualifying final Handoff once; publication projections remain independent. |
| Claims SLA / remedy reconciliation | Attention/escalation and owner facts only; timers never adjudicate. |
| Trust evaluation | Stable evidence/correction identity; own deterministic versioned policy. |
| Media image / deletion | Sharp bounded CPU/memory jobs, object deletion confirmation and hold checks. |
| Notifications delivery | Logical notice/device-attempt idempotency and current recipient policy. |
| Analytics projections | Bulk/coarse watermarked partitions, bounded workload; no job per normal impression. |
| Billing / privacy maintenance | Approved subscription/retention obligations; no inferred Seller transaction commission. |

All are ordinary BullMQ executions backed by Valkey and reconstructable PostgreSQL required intent. Workers are thin owner invocations with current state and safe context; no parallel business implementation or background engine exists.

## 51. Observability Integration

Instrument request/owner/adapter/relay/worker correlation, current actor class and Market with redacted structured Pino logs, Sentry release/environment and PostgreSQL query visibility. Track latency/error/DB pool/lock budgets, outbox age, relay/delivery lag, job retries/dead letters and canonical reconciliation drift.

Business operating signals include Checkout material-change/oversell prevention, ambiguous provider age, surcharge ledger reconciliation, allocation expiry safety, Handoff issue/verify/attempt outcomes, Grant replay/lag, Scene PRIVATE/PUBLIC convergence and stale hard-gate denial, Claims review/remedy age and Trust correction propagation.

Primary Buyer outcomes are versioned conversion rate, purchase frequency and satisfaction. Fraud/dispute, completion, content quality, Trust deterioration, cancellation/refund, concentration/fairness and negative feedback constrain experiments. Higher engagement cannot excuse material harm. Observability is not a private evidence archive.

## 52. Privacy / Data Lifecycle Integration

Source owners define data classification, explicit retention, lawful purpose, selected holds, access audit and confirmed byte deletion. Privacy orchestrates owner commands; it does not directly purge every schema or change an allegation/history. Account deletion severs general analytics linkage and records tombstones before delayed replay can resurrect it.

Claims holds preserve exact relevant Product/Scene revision, Media, selected Message and financial/evidence references for legitimate case purpose. Current Scene PRIVATE remains private; retained history does not restore public visibility. Release holds through recorded policy, then delete bytes with object-store confirmation rather than interpreting a missing lookup as success.

Adulis Seller admission requires no Government ID, legal-ID upload or selfie-to-ID flow. A PSP may independently impose KYC/KYB under its contract and the activated Market. Prefer provider-hosted collection and retain only provider references, safe status and masked metadata in Finance. Any unavoidable Adulis handling requires a confirmed requirement and restricted Finance purpose, storage, access, audit, retention and deletion controls; it does not become an Onboarding ID requirement.

Sensitive Finance/provider KYC is excluded from default Claims exports and Analytics. Exceptional case access needs confirmed purpose, current privileged/source capability, minimization, audit and applicable retention/deletion. No current Seller verification Government-ID store is introduced.

## 53. Testing Architecture

| Test level | Current evidence required |
| --- | --- |
| Unit / pure logic | Domain legal transition, exact Money/rounding, signature parsing and deterministic policy/rank logic. |
| Real-infrastructure integration | PostgreSQL constraints/locks/FKs, Drizzle migration, outbox intent/effect marker and Valkey/BullMQ crash gaps. |
| API / contract | Typed principals, current authorization, payload/source registry, OpenAPI generation/diff and generated client compatibility. |
| Mobile / web E2E | Maestro connected Buyer/Seller/Courier journeys; Playwright Seller, Storefront, Website and separate Operator governance. |
| Concurrency / replay | Stock/allocation, provider callbacks, Handoff single acceptance, Grant uniqueness, NULL-safe Claim scope and correction compensation. |
| Privacy / evidence | Historical PRIVATE Scene hold/access, selected immutable Message, source KYC restriction, deletion tombstone and object confirmation. |
| Failure / load | Provider ambiguity, queue/network/database/Media outage, current public hard gates, OLTP protection, k6 budgets and repair. |

Cross-domain journeys cover Seller onboarding -> Product -> Scene -> Search/FYP -> Product -> explicit Checkout -> independent sequential Seller payments -> PAID -> fulfilment -> online Handoff -> one Buyer Grant -> Review quality -> Claims decision/correction -> Trust recompute. Test with one ordinary human in multiple relationships and a distinct Operator identity. Tests prove behavior, not only mocked method calls.

## 54. Architecture Fitness Functions

• dependency-cruiser fails forbidden private repository imports, cycles and generic domain mutators.

• CI validates exactly one current ordinary worker engine and no request-path business-correctness dual write.

• REST/OpenAPI generation/diff and all generated TypeScript client builds are required; runtime validation still applies.

• Typed principal schema/FK checks reject ordinary IDs in Operator paths and generic identity overload.

• Canonical Scene type, publication/visibility separation and current public gates are mandatory; no stock-loss archive producer exists.

• Review Grant creation has qualifying FINAL_HANDOFF or VERIFIED_ORDER_FAILURE evidence and one Buyer/Order identity.

• Generated clients/screens/schema expose no Government-ID Seller verification, Seller payment confirmation or Buyer Reserve product.

• Mobile Handoff has no offline acceptance queue; Analytics has no persistent telemetry queue.

• Versioned events declare publishers/consumer/source/privacy/retention/dedup; CLIENT cannot forge canonical outcomes.

• Current full stack, phone normalization, bounded Media and data budgets, secret redaction and replay/privacy tests run before release.

## 55. Scaling / Future Extraction Strategy

Keep the modular monolith first, with independently scalable API and worker roles. Measure API CPU, SQL query/lock/I/O and pool pressure, queue age, Media processing and edge delivery before adding infrastructure. Fix expensive queries, bound read composition, partition/retain Analytics and scale the measured bottleneck.

Later extraction may target Recommendation, Search, Analytics, Notifications, Media workers or Chat realtime only when measured throughput/latency, isolation or operating needs justify the cost. Preserve ownership, typed context, event contracts, idempotency and reconciliation across any extraction. No premature payment microservice, event broker or new ordinary worker technology is justified merely by domain count.

Connection pooling, specialized indexes/read replicas and a later warehouse are deliberate Deployment/Data decisions with legal consistency/privacy limits. Cache and service extraction never relax canonical public/commerce authority.

## 56. System-Wide Invariants

• PLAT-INV-001 One important fact has one canonical owner.

• PLAT-INV-002 Cross-domain writes route through the owner application service.

• PLAT-INV-003 PostgreSQL is canonical transactional truth.

• PLAT-INV-004 Valkey/BullMQ never authorize canonical commerce state.

• PLAT-INV-005 Domain events are past-tense facts emitted by their owner.

• PLAT-INV-006 Async delivery is at-least-once; consumers are idempotent.

• PLAT-INV-007 One ordinary Account can carry Buyer/Seller/Courier relationships.

• PLAT-INV-008 Operator Account is a separate privileged identity.

• PLAT-INV-009 Seller TEAM membership is relationship-scoped, not an Account type.

• PLAT-INV-010 Market context survives requests, events and jobs.

• PLAT-INV-011 Only explicitly active Markets transact.

• PLAT-INV-012 Product Post is the one-Product commerce destination.

• PLAT-INV-013 Scene Post is the canonical photo discovery/merchandising object.

• PLAT-INV-014 Public Scene publication requires at least one eligible available tagged Product.

• PLAT-INV-015 Zero available tagged Products makes a published Scene PRIVATE, not archived.

• PLAT-INV-016 Recommendation cannot alter Scene lifecycle.

• PLAT-INV-017 FYP top-level units are Scene Posts only.

• PLAT-INV-018 Search returns Product Posts, Sellers and Scene Posts.

• PLAT-INV-019 Cart does not reserve Inventory.

• PLAT-INV-020 Current MVP has no Buyer-facing Reserve transaction model.

• PLAT-INV-021 CheckoutAllocation is internal and payment-attempt-bound.

• PLAT-INV-022 Backend/provider facts alone establish payment success.

• PLAT-INV-023 Seller cannot confirm payment truth.

• PLAT-INV-024 Client redirect/screenshot cannot establish payment truth.

• PLAT-INV-025 Current transaction charge is the launch-disabled zero Adulis Buyer Checkout surcharge.

• PLAT-INV-026 Seller payment and provider settlement are distinct.

• PLAT-INV-027 Handoff requires backend connectivity.

• PLAT-INV-028 Presenter displays; custody recipient scans.

• PLAT-INV-029 GPS never proves receipt.

• PLAT-INV-030 Qualifying final DELIVERY anchors one Buyer Review Grant.

• PLAT-INV-031 order.completed cannot create a duplicate Review Grant.

• PLAT-INV-032 Reviews keeps Product-quality and Seller-service ratings separate.

• PLAT-INV-033 Trust states are NEW/REBUILDING/ESTABLISHED/TRUSTED.

• PLAT-INV-034 Trust cannot be purchased.

• PLAT-INV-035 Claims owns adjudication; Trust cannot rewrite Claims.

• PLAT-INV-036 Seller admission does not require Government ID.

• PLAT-INV-037 Provider KYC stays within provider/Finance boundaries.

• PLAT-INV-038 Chat Conversation is Buyer + Seller + Market, not a Product thread.

• PLAT-INV-039 Chatbot model cannot generate authoritative Buyer commerce prose.

• PLAT-INV-040 Analytics client events never establish commerce facts.

• PLAT-INV-041 BullMQ is the sole ordinary background execution engine.

• PLAT-INV-042 Critical async intent uses the PostgreSQL outbox/job_intent bridge.

• PLAT-INV-043 No unsafe PostgreSQL-to-Valkey correctness dual write is allowed.

• PLAT-INV-044 No client/cache/projection can override canonical state.

• PLAT-INV-045 Sensitive evidence uses restricted domain/storage boundaries.

### Additional preserved architecture constraints

• PLAT-INV-046 Repositories are private; read-only cross-domain joins are bounded and documented.

• PLAT-INV-047 Immediate legal decisions use synchronous owner orchestration; independent aftermath never substitutes for success.

• PLAT-INV-048 Every required owner fact and async intent is atomic with its canonical mutation.

• PLAT-INV-049 Config history is effective-dated and immutable; captured money/policy cannot be changed retroactively.

• PLAT-INV-050 Tenant, surface and resource scope apply to current reads, commands, exports and replay.

• PLAT-INV-051 Current permission/capability revocation blocks the next sensitive action.

• PLAT-INV-052 Required jobs are reconstructable after queue loss; queue time is not business time.

• PLAT-INV-053 Ambiguous provider effects reconcile under the same identity without blind duplicate charges.

• PLAT-INV-054 Accepted Handoff, purchased lines and critical Claim history remain immutable; corrections append.

• PLAT-INV-055 No timer or detector automatically adjudicates a contested Claim.

• PLAT-INV-056 Historical Scene attribution/evidence survives visibility change without public republishing.

• PLAT-INV-057 Only current Content gates may restore stock-private PUBLIC visibility.

• PLAT-INV-058 Notification/Analytics failure cannot roll back committed commerce.

• PLAT-INV-059 Public projections have explicit source/version/freshness and repair contracts.

• PLAT-INV-060 Account deletion tombstones prevent delayed replay from restoring general person linkage.

• PLAT-INV-061 Restricted evidence is purpose-bound, held only when legitimate and deleted with confirmed source/byte handling.

• PLAT-INV-062 Generated OpenAPI clients and dependency fitness checks remain required.

• PLAT-INV-063 No supported adapter/framework creates a hidden owner bypass.

• PLAT-INV-064 Mobile caches/SQLite never accept offline Handoff or persist cross-session Analytics replay.

• PLAT-INV-065 Service extraction and added technology require measured need, not domain count.

## 57. Architecture Decisions

| ADR | Current architecture decision |
| --- | --- |
| ADR-01 | Modular monolith first; measured later extraction only. |
| ADR-02 | One canonical owner and private repositories; public owner application interfaces. |
| ADR-03 | PostgreSQL + Drizzle canonical transactional persistence and reviewed constraints/migrations. |
| ADR-04 | Valkey cache/coordination and BullMQ sole ordinary execution; neither is business truth. |
| ADR-05 | Synchronous bounded owner orchestration for immediate legal decisions. |
| ADR-06 | Atomic outbox/job_intent, shared relay/delivery registry and idempotent independent aftermath. |
| ADR-07 | Typed ordinary/Seller/Market/request/correlation context; separate privileged identity. |
| ADR-08 | REST/OpenAPI with @nestjs/swagger and generated TypeScript clients; no generic BFF/API alternative. |
| ADR-09 | Current NestJS + Fastify strict TypeScript and full Appendix A stack are required, not optional extensions. |
| ADR-10 | R2/CDN image delivery with Sharp workers; private evidence distinct from public Media. |
| ADR-11 | Rebuildable bounded read models and current response-time eligibility gates. |
| ADR-12 | Typed versioned configuration and immutable purchase/evidence/decision snapshots. |
| ADR-13 | Purpose-bound Privacy/Audit and explicit sensitive-source restrictions. |
| ADR-14 | Jest/Testcontainers/Maestro/Playwright/k6, query/queue diagnostics and dependency-cruiser prove boundaries. |
| ADR-15 | Checkout Session + independent Seller Orders; optional short attempt-bound CheckoutAllocation, no Buyer Reserve product. |
| ADR-16 | Provider/backend payment authority, distinct settlement, exact disclosed zero launch Adulis Buyer surcharge and reconciliation. |
| ADR-17 | Connected QR/OTP/Manual Handoff; qualifying final DELIVERY -> one Buyer Review Grant; method-specific Trust evidence. |
| ADR-18 | Scene publication/visibility separation, Content-owned stock PRIVATE/restock PUBLIC; Scene-only photo For You. |
| ADR-19 | Social-commerce Government-ID-free Seller admission; provider KYC separate; Creator profile explicitly policy-gated. |

## 58. Open Decisions

Remaining choices are bounded implementation/product policies: initial capacity and SLO targets, optional later warehouse/Search/Chat serving extraction, retention/hold durations, calibrated impression/metric windows, satisfaction composition, versioned experiment thresholds, provider route readiness and future Creator product scope.

Current product contracts are settled: provider Checkout, Buyer surcharge, photo Scene-only For You, three Search types, two Collection types, same-Seller Scene tags, connected Handoff, four Trust states and two-basis Buyer/Order Review Grant are not contradictory OPEN options. Native video, AI business advice, additional Markets and complete Creator commerce remain deferred/disabled unless explicitly ratified.

Close a true implementation blocker with the responsible owner or keep that feature disabled. A default or deployment flag cannot substitute for a legal/product/provider decision.

## 59. Canonical Write-Backs

| Canonical artifact | Required current write-back |
| --- | --- |
| Database reference | Typed ordinary/Operator FKs, Seller relationships, current Checkout/Order/Finance/allocation, Scene visibility and Grant/case uniqueness. |
| API reference / clients | Generated REST contracts, current actor guards, explicit confirmation, provider/pending semantics and safe errors. |
| Engineering Manual | Private owner interfaces, approved joint transactions, one BullMQ execution plane, outbox/job-intent relay and repair. |
| Catalogue / Content / Media | Product commerce versus Scene discovery, same-Seller tags, stock PRIVATE/restock PUBLIC and private historical evidence. |
| Orders / Checkout / Finance | Independent Seller payment scopes, exact zero at launch policy snapshot, provider verification/refunds/settlement and ambiguity handling. |
| Auth / Operator / Onboarding | One ordinary identity, TEAM constraints, separate privileged lifecycle/capabilities and Government-ID-free policy-gated admission. |
| Fulfilment / Handoff / Reviews / Trust | Current assignment, connected direction/recipient binding, Buyer/Order Grant with nullable basis-specific receipt evidence and distinct method-specific Trust consequences. |
| Claims / Privacy / Audit | One Order/optional line, typed human adjudication, exact retained Scene/Message evidence, corrections and source KYC restrictions. |
| Chat / Chatbot / Notifications | Relationship Conversation, immutable Message/provenance, deterministic answers and logical notice/device delivery. |
| Recommendation / Search / Collections / Analytics | Scene-only FYP, three Search types, two save types, current hard gates, versioned outcomes and privacy-aware feature contracts. |
| Deployment / runbooks | Full stack, measured resource budgets, replica/worker/relay boundaries, crash/restore tests and rollback ownership. |

Update actual canonical sections/schema/examples; a change log or appended exception alone does not reconcile an active contradiction. Implementation contracts use registered versions and reviewed migrations before rollout.

## 60. Implementation Sequence

• 1. Ratify owner/interface/context map, separate principal types and current Market/provider/commercial baseline.

• 2. Apply reviewed typed FKs/constraints and shared transaction/idempotency contracts; introduce canonical outbox/job intent and relay/delivery repair.

• 3. Deliver ordinary Auth/Seller OWNER bootstrap, TEAM/permission guards, separate Operator lifecycle and social/readiness workflow.

• 4. Implement Catalogue/Inventory/Media and Content Scene publication, stock PRIVATE/restock PUBLIC and current public gates.

• 5. Deliver concrete Checkout review/reconfirmation, independent Seller Orders, attempt-bound stock protection and provider Finance verification/refund/settlement/surcharge ledger.

• 6. Connect paid fulfilment/current assignments and preserved online QR/OTP/Manual Handoff; add two-basis Buyer/Order Grant and Review dimensions.

• 7. Integrate human Claims/corrections, provider remedies, Trust recomputation and purpose-bound retained evidence/privacy audit.

• 8. Add current Chat/Bot/Notifications, Search/Collections/FYP and bounded Analytics outcomes/features; keep independent aftermath repairable.

• 9. Run generated client/fitness, real-infrastructure concurrency/crash/privacy, targeted E2E and measured load/recovery gates.

• 10. Activate Ethiopia rollout deliberately after provider/operating readiness, runbook/rollback ownership and current release sign-off.

## 61. Production Launch Gate

Launch requires the current subsystem gates plus verified cross-domain integration. Evidence includes committed state, uniqueness and crash recovery, not just UI screenshots or mocked calls.

• Seller onboarding -> valid Product publication; no Government-ID API/UI/storage or active IDENTITY_PATH.

• Scene public publish requires available eligible same-Seller Product; last available tag -> PRIVATE; restock -> PUBLIC only when all gates pass.

• Search/FYP -> Product -> current Checkout with exact material reconfirmation.

• Provider/backend exact amount/currency verification; redirects/Seller statements never paid authority.

• Multi-Seller sequential independent attempt behavior and partial failures.

• Exact zero launch Adulis Buyer surcharge/total/policy-ledger reconciliation and component refund treatment.

• Paid Order -> fulfilment/current assignment -> connected QR/OTP/approved Manual final Handoff.

• Final qualifying DELIVERY -> one Buyer Grant; PICKUP none; delegate gives Buyer rights only; order.completed replay no second Grant.

• Review Product-quality/Seller-service dimensions and bounded downstream rating/Trust/discovery.

• Claim upheld/corrected -> structured Trust recomputation; human separate Operator decision and provider-confirmed remedies.

• Separate Operator credentials/audience/capability/scope/freshness/governance/revocation and no impersonation.

• Outbox/job_intent/relay/worker crash gaps, per-consumer replay and deterministic business-effect uniqueness.

• Valkey loss rebuild, canonical OTP attempts and allocation deadline/payment re-read; no second background engine.

• No offline Handoff acceptance or persistent Analytics replay; first-party typed observations cannot forge business facts.

• Current hard public gates after stale Scene/safety projection; bounded eligible discovery fallback.

• Historical PRIVATE Scene/Message/Media evidence hold/access/export and privacy tombstone/byte-deletion confirmation.

• Cross-tenant/object negative tests across ordinary multirole and privileged contexts.

• Versioned typed configuration, effective-range overlap, active Market and provider/legal/operational readiness.

• Generated OpenAPI clients compile; DTO/runtime validation, dependency-cruiser and permission/event catalogues match migrations.

• Provider/SMS/social/R2 adapters have timeouts, authentication/replay protections and secret/evidence redaction.

• API/worker health and heartbeat, queue/outbox age, DB pool/lock/query budgets and reconciliation drift alerts.

• PITR/logical backup and restore drill; repaired queue intents cannot resurrect revoked/deleted/private state.

• Representative low/mid-range Mobile image/list performance; bounded R2/CDN direct paths and protected OLTP.

• Target k6 capacity/error/latency budgets and classified provider/Valkey/Media/Analytics/discovery outages.

• Current write-backs reviewed, genuine blockers closed or features disabled, deployment/rollback/runbook owners and launch sign-off.

## 62. Final Platform Architecture Diagram

![Complete current system-of-systems architecture](graphics/ARCH_11.svg)
*Figure 11. Complete current system-of-systems architecture. All required module groups, canonical storage, committed async bridge, Media and external adapters are explicit.*

Identity, Commerce, Discovery, Communication, Trust & Safety and Cross-Cutting groups remain explicit owner modules behind REST/OpenAPI. Ordinary and Operator guards stay distinct. PostgreSQL + Drizzle is canonical; its outbox/job_intent relays to BullMQ on Valkey. Media uses R2/CDN/Sharp; external PSP, SMS/Push and TikTok/Instagram enter authenticated adapters.

## 63. Engineering Doctrine

OWN THE FACT ONCE. COMMAND THE OWNER FOR AN IMMEDIATE DECISION. COMMIT BUSINESS TRUTH IN POSTGRESQL. RECORD DURABLE ASYNC INTENT IN THE SAME TRANSACTION. DELIVER AFTER COMMIT. ASSUME DUPLICATE EXECUTION. MAKE CONSUMERS IDEMPOTENT. RECONCILE DERIVED STATE. KEEP ORDINARY AND OPERATOR IDENTITIES DISTINCT. LET DISCOVERY, ANALYTICS AND CACHES LAG, BUT NEVER LET THEM BECOME TRUTH.

### Appendix A - Canonical technology baseline

STATUS: CURRENT. The complete stack below is the required applicable implementation baseline. No library creates a second source of business truth or weakens the preceding ownership/consistency rules.

| Layer | Current implementation and authority |
| --- | --- |
| API / runtime | Node.js; NestJS + Fastify; strict TypeScript; REST/OpenAPI with @nestjs/swagger and generated TypeScript clients; @nestjs/throttler, @fastify/helmet and libphonenumber-js. |
| Canonical data | PostgreSQL + Drizzle; pg_trgm, btree_gist and pg_stat_statements; owner repositories, typed FKs, legal transitions and transactional outbox/job_intent. |
| Async / coordination | BullMQ on Valkey as the sole ordinary background engine; committed PostgreSQL intent, deterministic execution IDs, current-state revalidation and database idempotency. |
| Media | Cloudflare R2 + CDN and Sharp for image processing. Restricted evidence bytes use private, purpose-bound access. Native video is deferred from the photo-first discovery baseline. |
| Mobile | React Native + Expo; Expo Router, TanStack Query, FlashList, Expo Image, SecureStore, SQLite, Camera, Notifications and Updates; small Zustand UI stores. SQLite never establishes offline commerce acceptance. |
| Quality / operations | Jest, Testcontainers, Maestro, Playwright and k6; Sentry, Pino and database query diagnostics; dependency-cruiser; Docker, GitHub Actions, Render, Cloudflare and EAS. |

Generated clients derive from the canonical OpenAPI artifact, for example openapi-typescript with openapi-fetch or an equivalent reviewed generator. Breaking unsupported changes fail CI. Nest uses FastifyAdapter; Express-only middleware is not assumed. Drizzle is the single ORM; strict TypeScript complements, rather than replaces, database/runtime validation.

Keep the stack compact: no parallel ORM, ordinary queue engine, API protocol, mobile server-state store or object-storage abstraction without a measured approved requirement. BullMQ is sole ordinary execution; PostgreSQL intent is the recoverable bridge, and Valkey cache/queue is non-canonical.

### Appendix B - Runtime placement and responsibility

![Compact production roles and one recoverable execution plane](graphics/ARCH_12.svg)
*Figure 12. Compact production roles and one recoverable execution plane. Cloudflare, Render, PostgreSQL, relay, Valkey/BullMQ and EAS preserve the full current stack without creating business authority in infrastructure.*

| Runtime role | Responsibility / operating rule |
| --- | --- |
| Cloudflare edge / web / R2 | DNS/TLS/WAF/CDN and public immutable derivatives; private evidence requires source-purpose grants, not unrestricted URLs. |
| Render API fleet | Node/NestJS/Fastify REST, typed principal guards, validation, bounded owner composition and transactional decisions; no CPU-heavy image/bulk projection workload. |
| PostgreSQL / Drizzle | Owner schemas, constraints, transactions, snapshots, audit and durable event_outbox/event_delivery/job_intent; pool/lock/query/I/O budgets apply. |
| Eventing relay | Bounded committed intent leases, deterministic enqueue and retry-gap repair; no domain mutation or alternate engine. |
| Worker fleet / BullMQ on Valkey | Thin current canonical re-read + owner command, bounded Sharp/projection/notification/retention/external reconciliation work; at-least-once effect safety. |
| Mobile / Expo | One Buyer/Seller Companion/Courier-capable app where enabled; bounded UI/server caches, no offline Handoff or durable Analytics queue. |
| Delivery / control | GitHub Actions immutable verification/build, Docker promotion to Render, Cloudflare edge/web/media, EAS native build and compatible Updates; Sentry/Pino/query telemetry. |

Scale API replicas only while the measured PostgreSQL pool/lock/CPU/I/O budgets remain healthy. Deployment may add PgBouncer for measured connection pressure; it never becomes an authority. Worker concurrency is budgeted per expensive job class, not merely increased until downstream failure.

### Appendix C - API, security and client contract rules

| Concern | Current required rule |
| --- | --- |
| HTTP / OpenAPI | Fastify plugins are bootstrap infrastructure; @nestjs/swagger publishes canonical REST contracts; DTO/runtime validation and current authorization remain server responsibilities. |
| Generated clients | Mobile and each web surface use the same generated artifact; supported client versions and additive rollout are verified. |
| Rate / payload bounds | @nestjs/throttler with Valkey cross-replica coordination where needed; explicit auth, SMS, Search, Chat, upload and evidence limits. Canonical security counters remain owner-controlled. |
| Headers / CSP | @fastify/helmet and surface-specific CSP/security policies; no session/evidence exposed to third-party scripts. |
| Phone identity | libphonenumber-js normalization before uniqueness, delegation binding and control comparison; formatting is not identity. |
| Principal context | Discriminated ordinary/Operator/SYSTEM shape; independent audiences and credential recovery; current resource/surface/case gates. |
| Idempotency / external effects | Stable critical REST intent plus owner-derived child/effect identity; ambiguous Finance reuses attempt and reconciles. |
| Direct bytes / restricted access | Bounded direct upload grants and image CDN derivatives; private evidence purpose/expiry/audit and malware/format controls. |

No new generic BFF, GraphQL or tRPC layer is required. Purpose-built bounded read composition cannot write canonical state or bypass source privacy.

### Appendix D - Data, Media and Mobile performance rules

• Drizzle migrations and PostgreSQL constraints/transactions/indexes are reviewed artifacts; real concurrent tests verify invariants beyond TypeScript.

• pg_trgm supports bounded Search similarity; btree_gist supports required exclusion/effective-range constraints; pg_stat_statements measures query costs where provider support allows.

• R2/CDN separates public immutable image delivery from private evidence. Current Scene serving/access cannot be authorized by an old public projection alone.

• Sharp decode/normalize/resize/format runs in bounded workers with memory/time/concurrency limits; API nodes orchestrate metadata/grants, not large byte transforms.

• FlashList and Expo Image virtualize photo Scene feeds, use known aspect ratios, bounded prefetch/retained state and role-appropriate CDN derivatives.

• TanStack Query owns remote cache/refetch/invalidation; small Zustand owns ephemeral UI/context/non-server preferences; neither stores alternative commerce truth.

• SecureStore protects session/device secrets; Camera scans connected Handoff credentials; Notifications and Updates preserve typed/current authority and native runtime compatibility.

• Expo SQLite is only approved bounded local technical/offline-readable data. It never queues delayed Handoff acceptance and Analytics never uses cross-session persistent replay.

### Appendix E - Quality, observability and architecture control

| Control | Required current use |
| --- | --- |
| Jest | Domain legal states, pure Money/policy logic, signature/parser and meaningful failure behavior. |
| Testcontainers | Real PostgreSQL/Valkey locks, constraints, extensions, Drizzle migrations, atomic outbox, relay crash gaps and replay. |
| Maestro | Mobile login, Scene/Product/Checkout, provider-return pending/verified, connected QR/OTP/delegate and Seller Companion flows. |
| Playwright | Seller Console, Storefront, Company Website and separate Operator capability/governance/security journeys. |
| k6 | Current stock/Checkout concurrency, FYP/Search/detail, Chat polling, upload grants, projection and worker backpressure; measured release budgets. |
| Sentry / Pino | Release/environment-correlated errors and structured redacted logs; no raw secret, private evidence, Chat or KYC payload capture. |
| pg_stat_statements | High-cost SQL, regression, call/time and database resource diagnosis before scaling. |
| dependency-cruiser | Fail private-repository imports, cycles and unauthorized module edges; public contracts stay small. |

Minimum CI sequence: type-check, dependency fitness, domain tests, real-infrastructure integration, OpenAPI generation/diff, generated-client build, targeted web/mobile E2E, migration verification and configured image/security checks. k6 runs at production capacity milestones with recorded target budgets. Quality tests validate real effects and failure recovery, not only mirrors of implementation.

### Appendix F - Delivery and stack-integrated production topology

GitHub Actions verifies immutable artifacts; Docker packages API/worker runtime. Render hosts application and managed PostgreSQL/Valkey roles. Cloudflare provides edge/web/CDN/R2 integration. EAS builds/distributes Expo native apps and coordinates runtime-compatible Updates. Each environment separates credentials, data and provider routes.

Public Media bytes go directly through the designed R2/CDN paths; restricted evidence remains private. API connects to PostgreSQL for canonical decisions; committed intent goes through the shared relay to BullMQ workers. Workers invoke source owners and external adapters with stable effect identities. No API/cache/queue dual-write claims atomic correctness.

Promotion, migration ordering, supported client compatibility, feature/Market kill switches, rollback and provider outage/reconciliation runbooks have named owners. Restore drills recover PostgreSQL required intent and privacy/hold/tombstone state before replay. Scale the measured hot workload while retaining canonical gates.

### Appendix G - Technology launch gate and final doctrine

• NestJS boots with Fastify in production-like environments; OpenAPI and every generated client compile.

• Critical APIs enforce intended typed authentication/authorization, current scope, payload validation, throttling and idempotency.

• Helmet/surface CSP and libphonenumber-js identity normalization are active; secret/evidence log redaction is verified.

• Required PostgreSQL extensions/migrations and pool/query budgets are reviewed; canonical concurrent stock protection and Grant/case uniqueness pass Testcontainers.

• Only BullMQ executes ordinary background work; durable PostgreSQL outbox/job intent, leases, crash-gap repair and Valkey-loss recovery pass.

• Sharp processing is bounded; direct R2/CDN paths and representative low/mid-range Android photo list performance pass.

• TanStack Query/Zustand/SQLite remain non-authoritative; no offline Handoff or persistent Analytics queue exists.

• Maestro/Playwright current provider Checkout, connected receipt, Buyer Grant and separate privileged journeys pass; k6 meets measured launch budgets.

• Sentry/Pino/query/queue freshness telemetry, backup/restore, dependency fitness and approved deployment/rollback procedures are exercised.

Use the smallest canonical stack that preserves correctness. Adapters accelerate or retry work; owners decide legality. Commit truth and required intent together, keep sensitive evidence restricted, re-read current authority, assume duplicate execution and repair derived state. No framework, cache, queue, client store or vendor creates a hidden path around the domain owner.

## 64. Appendix - Amended Cross-Domain Acceptance Specifications

| Correction | Required test specification - execution pending |
| --- | --- |
| P01 | Zero rate/components and immutable historical quotes; no invented processing fee/double fee. |
| P02 | Last unit A/B, delayed/reordered success, cancellation timeout, expiry race, second attempt/duplicate charge and no-stock late success. |
| P03 | Crash after Finance commit/every joint Order-stock step, restart, webhook replay, queue outage and concurrent expiry; one stock/PAID effect. |
| P04 | Paid upheld failure Buyer-only Seller feedback; unverified/unrelated denied; no unreceived quality; multiple Claims/delivered refund race one container; completion/correction annotation. |
| P05 | Timely minor, serious/repeated/refused/late/overturned/replayed faults; paid unfinished Orders, line Claims, zero denominator, late closure and 9/10/11/20 units/split Orders. |
| P06 | 18+ declaration all ordinary paths; underage/missing denial; no role bypass/verified-age label/ID or permanent denied child profile. |
| P07 | Pin actual adapter and granted capability; sandbox signature/reference/merchant/environment/amount/currency/finality; accepted/pending/completed refund and insufficient funding. |
| P08 | True CDN HIT/MISS/stale, failed purge, origin outage, last tag, independent restock restrictions, lists/direct links/social metadata and nonce-header-body match. |
| P09 | Two foreground checkpoint attempts, location denied and no ordinary precise coordinate DTO/notice/log/history. |
| P10 | Generated registered producer/consumer fixtures; undeclared names rejected; duplicates/reordering/old revisions cause no duplicate notice or public resurrection. |
| P11 | Existing username -> immutable target; changed username/phone, pending invites, wrong Account acceptance, revocation and concurrent one-slot enforcement. |
| P12 | PostgreSQL17 synthetic DDL/migration negatives: wrong tuples/stars/Buyer/Seller, fabricated evidence and failure-only Product rating; concurrent consumption. |
| P13 | All Collection/delivery/pickup directions, recipient OTP/no-app delegate, authorized Manual after lockout, expiry/revoke replacement and recipient generation race. |
| P14 | Wrong conversation/sender/team, public-descriptor denial, retry association once, orphan expiry, signed access scope and hold vs delete. |
| P15 | No-Account SMS, ambiguous retry, expired/revoked/replaced authorization, stale suppression and later receipt-only Account binding. |
| P16 | Unsupported Amharic/text with offline Seller, bot off/unavailable/classifier failure/budget exhaustion; persist original, no English NLU/false interpretation. |
| P17 | Anonymous browse, global Account before Seller, cross-Market history/Operator provision, invalid/missing commerce Market and untrusted SYSTEM denial. |
| P18 | Supported/unsupported accounts, token revoke, rename, wrong owner, deleted/private video, callback failure; manual control without video permission. |
| P19 | Synthetic-only engineering; real class/processor/region/policy approvals and executed lifecycle/security/restore/incident evidence before applicable activation. |

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 65. Glossary

| Term | Meaning in this design |
| --- | --- |
| Ordinary Account | One human identity with Buyer, Seller and Courier acting relationships. |
| Operator Account | Separate internally provisioned privileged identity with current scoped capability. |
| Canonical owner | Domain whose legal command and PostgreSQL state establish the fact. |
| Market | Explicit activated commerce jurisdiction/configuration and effective version. |
| Scene Post | Photo merchandising/discovery content with separate publication and visibility. |
| event_outbox / job_intent | Required committed fact/effect intent persisted atomically with business truth. |
| BullMQ / Valkey | Ordinary async execution and non-canonical queue/cache infrastructure. |
| CheckoutAllocation | Short internal provider-attempt-bound stock protection, never Cart/payment truth. |
| Review Grant | One Buyer-owned eligibility/consumption per paid Seller Order; FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; delegate never owns it. |
| Provider reconciliation | Verify an ambiguous external effect under the same canonical identity. |

## 66. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-18 — Mobile app identifiers and production foundation | ADU-MOB-02 v4.2 already specifies one React Native/Expo app with Buyer, Seller Companion and Courier modes. | Canonical application identifiers are Android applicationId com.adulis.app and iOS bundleIdentifier com.adulis.app. One Expo/React Native app exposes Buyer, Seller Companion and Courier modes under one ordinary MOBILE session. Mode switching changes active context, not identity/session. Available modes are backend-authoritative; active mode is UI state. Operator is never a Mobile mode. | WO-001 / WO-001A, 8 Nov 2026 |
| R-20 — Courier MOBILE API/auth contract correction | ADU-AUTH-02 v3.2 and ADU-MOB-02 v4.2 already define Courier as a third ordinary Mobile mode using the ordinary MOBILE session. | Executable API/auth contracts must be corrected to match the design: Courier uses audience=MOBILE with backend-verified Courier relationship/capability, exact resource scope and permission surface. Do not move Courier back to Console/cookie auth to match stale implementation contracts. Until the corrected contract is published, production Mobile must not fabricate Courier API calls. | WO-001 discovery + October 13 AUTH/MOB authority |
| R-21 — Mode eligibility bootstrap and generated API-client types | The 13 October design assumes server-authoritative relationship/permission evaluation. | Bootstrap/session contracts must expose sufficient authoritative relationship/capability information to derive Buyer/Seller Companion/Courier mode availability without trusting a client role. The shared generated API-client seam must export generated OpenAPI path/types. Mobile must not hand-write duplicate DTOs to compensate for missing schemas or exports. | WO-001 / WO-001A discovery, 8 Nov 2026 |
| R-23 — Canonical Account architecture is resolved | The October 13 pack already defines one ordinary Account with Buyer, Seller and Courier relationships plus a distinct Operator identity domain. | The production Account model is not unresolved for these surfaces: one ordinary Account can act as Buyer, own Sellers, hold authorized Seller team membership/roles, and hold one Courier profile with many Seller relationships. The Mobile app exposes Buyer, authorized Seller Companion and Courier contexts under the same ordinary Account session. Operator Console remains a separate privileged identity/session. Prototype role-switcher scaffolding is not itself authority, but the October 13 production model is. | October 13 AUTH/MOB/KB reaffirmed against stale prototype rule |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.

### Open / deferred items

• Courier MOBILE executable contract and mode-eligibility/bootstrap projection remain implementation-contract gaps; the product/system design remains one MOBILE session with Courier as an authorized relationship context.
