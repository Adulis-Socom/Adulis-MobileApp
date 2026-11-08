# Adulis Canonical Knowledge Base
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R01, R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | Adulis_Canonical_Knowledge_Base_2026-10-13_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. How this knowledge base should be interpreted

Adulis has evolved quickly. This baseline records the newest product and engineering truth and must be used to correct older specifications that still contain superseded assumptions.

The baseline date is 7 October 2026. The document remains the Adulis Canonical Knowledge Base. It reconciles the attached 14 September 2026 v2.0 baseline with the explicit revision rulings; unchanged architecture is retained.

### Authority precedence for this reconciliation

1. Explicit decisions stated in the current update instructions.

2. Newer dedicated Adulis system designs.

3. Existing Canonical Knowledge Base content where it does not conflict.

4. Older designs only as historical context.

After this revision, this Knowledge Base is the high-level canonical alignment source. Newer explicit rulings still supersede it. Dedicated designs supply implementation detail without overriding these current invariants. PRDs, UX documents, wireframes and presentations must align with the current decisions.

Canonical business truth comes from owning domains and PostgreSQL-backed backend services. Clients, caches, analytics and projections cannot create or override that truth.

### Decision labels

• CURRENT - authoritative now.

• CURRENT WITH EXTENSION - valid but requires adaptation.

• OPEN - intentionally unresolved; architecture must preserve the insertion point without inventing policy.

• SUPERSEDED - must not govern new implementation.

• DEFERRED - a future capability, disabled and outside current launch acceptance.

### Scope and unresolved details

The supplied revision instructions and source PDF are the evidence for this edition. Referenced newer dedicated designs were not separately attached. Where these inputs do not specify a final enum, numerical guard, retention period, settlement model or API migration, this document assigns that detail to its owning design rather than inventing it.

## 2. Adulis in one paragraph

Adulis is an Ethiopia-first social-commerce marketplace that combines algorithmic product discovery, structured products, commerce-focused content, seller operating software and evidence-based trust.

Buyer Home is the primary discovery container. Its default For You tab is an algorithmic FYP containing Scene Posts only. Product Posts are structured commerce destinations reached through Scene tags, Search, Shop, Storefronts, direct links and Collections. Adulis is not intended to become a general-purpose social network: Scene Posts must maintain a legitimate relationship to products that can be bought on Adulis.

### Current buyer loop

![Preserved canonical architecture](graphics/KB_01.svg)
*Figure 01. Preserved canonical architecture. Buyer discovery-to-commerce loop. Each outcome resolves through its owning domain.*

Adulis therefore combines social discovery + marketplace commerce + seller operating software + trust infrastructure.

## 3. Fundamental product invariants

These invariants should survive almost every future architecture decision.

### 3.1 Gateway-mediated payment truth - CURRENT

Buyer checkout is integrated with the Chapa payment gateway as the initial provider. Provider/backend verification is the canonical payment authority.

• The client must never be authoritative for payment success.

• The backend records a payment as successful only after server-side provider verification using the mechanisms supported by the payment integration.

• Provider transaction identity, amount, currency and Adulis Order context must be bound and reconciled idempotently.

• A Seller cannot confirm, accept, approve, reject provider truth or manually mark a payment successful.

• The exact legal settlement, merchant-of-record and fund-routing model is a separate payment/business/legal decision and must not be invented by client copy.

### 3.2 PostgreSQL is the transactional source of truth - CURRENT

Orders, inventory, trust evidence, seller state and other transactional business state are authoritative in PostgreSQL. Valkey, queues, recommendation caches, analytics systems and client state cannot override canonical business truth.

### 3.3 Trust must be earned rather than purchased - CURRENT

Subscription level, advertising spend, promotion purchases or any later commercial plan must never directly increase seller Trust Level. Trust is derived from platform evidence. Trust must never limit Product listing count or force Product unpublishing merely because a Trust Level falls.

### 3.4 Recommendation cannot override safety or commerce truth - CURRENT

An item with an excellent recommendation score cannot be served if it is unpublished, moderation-blocked, owned by a suspended/ineligible Seller, unavailable, geographically ineligible, blocked by the Buyer or otherwise policy-ineligible. Eligibility happens before ranking.

For FYP, the candidate must be a PUBLIC Scene Post with at least one currently eligible, in-stock tagged Product Post. Recommendation owns ranking and feed assembly; Content/Scene Lifecycle owns publication and visibility.

### 3.5 Scene content must remain commerce-connected - CURRENT

Every Scene Post must reference at least one valid Product Post, and the tagged product or products must be materially relevant to the content. Generic unrelated entertainment with a token product tag does not satisfy this invariant. Current MVP tags are same-Seller and must satisfy Market/content rules.

Public publication requires at least one currently eligible, in-stock/available tagged Product. A published Scene whose last available tagged Product becomes unavailable stays PUBLISHED and becomes PRIVATE. Eligible stock-driven Scenes automatically return to PUBLIC after availability recovers and all publication/visibility gates pass.

## 4. Current product surfaces

The platform is five user-facing products sharing one core platform.

![Preserved canonical architecture](graphics/KB_02.svg)
*Figure 02. Preserved canonical architecture. Five product surfaces, ordinary mobile relationships and a separate privileged Operator principal.*

The Seller Console remains the full management surface. Seller Companion remains the smaller operational mobile mode. Courier mode uses the same ordinary Account identity when eligibility is satisfied. Operator Console access uses a separate privileged Operator Account.

## 5. Company Website

CURRENT - the existing Company Website direction is accepted.

The Company Website is the public corporate/marketing surface and is not the Seller Storefront. The existing recommendation to keep those as separate products remains canonical.

### Website responsibilities

• Home, How Adulis Works, For Sellers, For Buyers, Trust & Safety, About, Help Center and Press.

• Waitlist/contact, legal documents, prohibited-products policy, reporting and account-deletion entry points.

• English + Amharic, mobile-first, accessibility and strong SEO.

### Current product narrative

The site should explain both acquisition loops: external social channels can send buyers to a Seller Storefront, while Adulis itself also creates internal cross-seller discovery through the FYP.

External social channels lead to a Seller Storefront or Adulis. Adulis For You leads to a Scene Post, a tagged Product Post, Product detail and Checkout.

The website should explain Chapa-powered checkout accurately. It must not claim escrow, guaranteed buyer safety, fund custody or settlement behavior that has not been legally and technically finalized.

The current launch-disabled zero Buyer-side Checkout surcharge is a closed, versioned transaction policy. Seller plans, plan prices, advertising and broader public pricing packaging remain separately managed or open; they must not become invented hard-coded website rules. No public Website flow provisions Operator credentials or converts an ordinary Account into an Operator Account.

## 6. Seller Storefront

CURRENT - the existing Seller Storefront direction is accepted.

A Seller Storefront is the Seller's public commerce identity and must work both as a shareable destination from TikTok/Instagram and as an identity/catalogue destination inside Adulis discovery.

### Storefront should contain

• Seller identity/profile, verification and Trust Level.

• Public reliability statistics.

• Product Posts backed by canonical Product/Variant/Inventory data.

• PUBLIC Scene Posts associated with one or more currently available Products.

• Current stock/availability and fulfilment information.

• Product reviews and seller-service reviews.

• Routes into chat, Product detail and checkout/app actions.

Trust and completed Handoff information should remain visible on the Storefront and Product surfaces. Product and content state must reflect current canonical truth rather than stale duplicated values.

A PRIVATE Scene is unavailable to Buyer Storefront/profile views and direct public links. Seller access through management surfaces does not make that Scene public. A Scene with at least one available tagged Product can remain public if all other rules pass.

## 7. Seller Console

CURRENT WITH CONTENT EXTENSION

The Seller Console remains the Seller's full administration and business-management surface. The boundary is: Console = Create / Configure / Manage / Administer; Companion = Monitor / Communicate / Respond / Urgent Operations.

### Seller Console responsibilities

• Seller onboarding, social-account eligibility and verification.

• Store configuration, catalogue, Product Posts, variants and inventory.

• Scene Post creation/management, Product tagging, media and publication lifecycle.

• Order and fulfilment operations, connected Handoff and permitted Order-level Courier actions.

• Standing Courier Pool configuration/administration, separately authorized from Order-level assignment.

• Chatbot configuration, Inbox, analytics and content-to-commerce performance.

• Trust, reviews, Claims, team/RBAC, security and sessions.

• Commercial-plan administration through policy-driven entitlements once the relevant packaging is finalized.

Seller management surfaces must show a clear Private badge/label on stock-restricted Scenes and explain the restriction. Adulis notifies the Seller both when stock drives a Scene Private and when it is automatically restored Public.

The Console must not calculate payment success, Trust Level, recommendation rank, Order legality or Seller permissions. Those are backend/domain decisions.

## 8. Mobile Application

CURRENT, MAJOR ACTIVE DESIGN AREA

There is one Adulis mobile application with Buyer Mode, authorized Seller Companion and Courier mode around one ordinary Account identity. Mode switching changes authorization context, not identity. Operator work access remains a distinct privileged security principal.

### Buyer Mode

• Buyer Home tabs: For You (default), Following, Nearby, Discounts and Locally Made.

• Scene-only algorithmic FYP; Marketplace Search; Product detail; Seller/Storefront views; private mixed-type Collections; cart and Shop access where exposed.

• Chapa-powered Checkout, a disclosed quote and Order status.

• Chat, connected QR Handoff, reviews, Claims and notifications.

• Courier Delivery status and permitted checkpoint evidence rather than movement maps.

### Seller Companion

• Notifications, Order monitoring, chat and operational alerts.

• Fulfilment and Handoff actions permitted by the backend.

• Lightweight analytics and urgent operational actions, including permitted Inventory/status responses.

• Clear Scene Private state and restriction/restoration notifications.

### Courier mode

• Assignment-scoped delivery work and connected Pickup/Delivery Handoff.

• Foreground/on-demand location attempts at PICKUP and DELIVERY when available.

• One active accepted delivery per Courier at a time by current MVP default.

Complex catalogue administration, team management, commercial settings and full content administration remain primarily in the Seller Console unless a later product decision expands mobile authoring. ANALYST and CAMPAIGN_MANAGER do not need artificial operational Mobile workspaces during MVP. The client has no offline business-operation queue.

## 9. FYP and marketplace discovery

CURRENT - BUYER HOME AND SCENE-ONLY FYP

Buyer Home is the primary discovery container. For You is the default algorithmic cross-Seller tab. Following remains a relationship and ranking signal; it does not redefine the entire Home as chronological.

| Launch tab | Canonical role |
| --- | --- |
| For You | Default FYP; Scene Posts only. |
| Following | Content/discovery from followed Sellers according to current Home policy. |
| Nearby | Market/location-policy controlled discovery. |
| Discounts | Configured eligible commerce discovery. |
| Locally Made | Market/configuration-controlled local-product discovery; labels may vary by Market. |

FYP contains Scene Posts only. Product Posts are not independent feed units. They are reached through Scene Product tags, Marketplace Search, Shop, Seller profile/Storefront, direct links, Collections and other explicitly approved commerce surfaces.

A FYP candidate must be PUBLIC, eligible and connected to at least one current eligible in-stock tagged Product. Discovery must remain commerce-oriented. Adulis should not reward unrelated entertainment merely because it creates watch time.

Home configuration must allow Market-specific labels. Locally Made is not globally hard-coded to one country. Other tabs follow their owning Home policies; this Knowledge Base does not invent additional feed types for them.

## 10. FYP visual direction

The current FYP is photo/image-first, with native Seller upload limited to images at launch. The two formal Seller publishing formats are Product Post and Scene Post.

### Product Post

Represents exactly one sellable Product and answers: What exactly is being sold? It exposes canonical product information such as media, variants, price, availability, Seller, Trust and purchase action through Catalogue/Inventory. It is a commerce destination rather than an independent FYP unit.

### Scene Post

Seller-authored image-led merchandising/discovery content that answers: Why should I care about or want this product? It may show styling, tutorials, demonstrations, comparisons, setups or lifestyle use.

• Every Scene Post must tag at least one Product Post.

• One Scene Post may tag multiple same-Seller Product Posts.

• One Product Post may be referenced by many Scene Posts.

• Tagged Products must be materially relevant to the content.

• Scene Posts resolve current commerce truth instead of duplicating price, stock or variants.

• Captions, visual Product tags and hotspots are presentation features of the Scene Post itself.

### Media direction

Native Seller upload and FYP Scene media are image/photo only at launch. Approved external TikTok/social video may appear only on eligible Product Post detail through the approved embed boundary. It does not become Scene media in FYP. Richer media remains an extension seam rather than current functionality.

## 11. FYP request architecture

FYP delivery remains cursor-based infinite discovery. Offset pagination must not be used for personalized FYP sessions.

```
GET /v1/fyp?cursor=<opaque>&limit=24
```

The server response should preserve feed_session_id, algorithm_version, typed feed units, impression IDs, candidate source, rank/position and next cursor.

### Current contract

The current content unit is SCENE_POST, represented by ScenePostFeedUnit. Product references occur inside the Scene or its tag resolution; they are not independent FYP units. Seller/category/theme discovery entry points must not introduce other top-level FYP content units under the current rule.

```
ScenePostFeedUnit
  type: SCENE_POST
  scene_post_id: <canonical scene identity>
  impression_id: <server-generated identity>
  candidate_source: <versioned source>
  rank / position: <server-generated ordering>
  product_tags: <eligible current product references>

Envelope
  feed_session_id
  algorithm_version
  units: ScenePostFeedUnit[]
  next_cursor
```

This is a high-level contract example, not a declaration that an unreviewed deployed schema has already migrated. The client must not infer rank, publication, visibility or commerce eligibility locally. Response resolution must prevent a stale projection from exposing a PRIVATE Scene.

## 12. Recommendation Engine V1

CURRENT

Adulis should not launch with a complicated ML recommendation stack.

![Preserved canonical architecture](graphics/KB_03.svg)
*Figure 03. Preserved canonical architecture. Deterministic Recommendation V1; current eligibility is checked before any ranking.*

### Candidate sources

• Onboarding/category affinity, followed Sellers and Seller affinity.

• Recent/trending/local eligible Scene content.

• New Sellers and new Scene content.

• Controlled exploration.

• PUBLIC Scene Posts with at least one current eligible in-stock tagged Product.

### Ranking families

User relevance + Content quality + Commerce quality + Trust quality + Context + Exploration - Negative feedback - Frequency penalties.

### Possible V1 signals

• Category and Seller affinity.

• Qualified image/Scene views and dwell, without a watch-time-only objective.

• Saves, Product Post opens and Product-tag clicks.

• Checkout initiation, paid-Order conversion and completed-Order rate.

• Inventory availability and price affinity.

• Seller Trust and cancellation/Claim quality.

• Locality, negative feedback, repeated skipping and new-Seller exploration.

• Content-Product relevance for Scene Posts.

Weights are versioned configuration, not hard-coded business logic. Recommendation owns candidate ranking, diversification, exploration, impression lineage and feed assembly. Content/Scene Lifecycle owns visibility; Recommendation does not publish, privatize or restore Scenes.

## 13. FYP optimization objective

Adulis should not optimize for addiction or watch time alone. The FYP exists to create useful discovery that converts into successful commerce.

### Primary commerce funnel

![Preserved canonical architecture](graphics/KB_04.svg)
*Figure 04. Preserved canonical architecture. Commerce outcomes balance useful attention with successful buying and post-purchase quality.*

### Multi-objective principle

A highly entertaining Scene Post that produces almost no Product interaction should not automatically outrank materially relevant Product content solely because it generates more dwell time.

Ranking should connect Attention to Product Discovery, Product Interest and Commerce, with Claims, cancellations, availability, Seller concentration and Buyer dissatisfaction as guardrails. Conversion rate, purchase frequency and Buyer satisfaction should be balanced rather than optimizing attention in isolation.

## 14. Exploration and marketplace fairness

The FYP must not become a system where the Sellers who already have engagement receive all future engagement.

Cold-start users need useful recommendations even with zero history. New Sellers need bounded exposure opportunities even with no historical engagement. The current architecture therefore explicitly requires a combination of exploitation + exploration.

Diversification should also prevent:

• Ten consecutive Scenes from one Seller.

• A dominant Seller consuming the session.

• Excessive repetition.

• Category monotony.

Every exploration candidate still passes commerce/safety eligibility. Continued distribution is earned through relevance, Buyer response, content quality, conversion and Trust; exploration does not override a Scene's Private state or availability requirements.

## 15. Similar Finds and Complete the Scene - deferred

DEFERRED / FEATURE-FLAGGED OFF

Similar Finds and Complete the Scene remain valid future product concepts, but they are not active launch requirements.

Until Adulis has enough product coverage, structured attributes, behavioral data and marketplace liquidity, their UI entry points and ranking modules should remain commented out or disabled behind feature flags.

• Do not make MVP acceptance depend on either feature.

• Do not delete the conceptual architecture seams needed to add them later.

• Do not generate low-quality recommendations merely to fill these modules.

When sufficient data exists, Similar Finds can return alternatives and Complete the Scene can return complementary Products. Their dedicated ranking logic should be introduced deliberately at that time.

## 16. Search and Collections

Search is a separate domain from FYP recommendation. Initial Search should remain simple enough to operate through PostgreSQL unless measured scale/quality demonstrates the need for Elasticsearch/OpenSearch.

### Marketplace Search at launch

| Result type | Canonical resolution |
| --- | --- |
| PRODUCT_POST | Structured Product commerce destination, resolved under current Product/Seller/Market rules. |
| SELLER | Eligible Seller profile/Storefront destination. |
| SCENE_POST | Eligible PUBLIC Scene Post; public Scene Search is MVP launch scope. |

Search ranking is separate from FYP ranking. Search projections cannot override canonical eligibility or Scene visibility.

### Private Buyer Collections

Collections allow authenticated Buyers to create, rename and delete private Collections; save Product Posts and whole Scene Posts in the same Collection; remove saved items; and revisit currently resolvable content.

A Scene becoming PRIVATE must not render to the Buyer through a Collection, saved-item preview or direct-link resolution. Preserve its Collection membership internally where appropriate so eligible automatic PUBLIC restoration can make the same save resolvable again without recreating it.

Collections do not reserve Inventory, freeze price or create Cart/Checkout state. Durable Buyer state requires authentication. The recommendation system may later use Collection contents as preference evidence without converting them into canonical commerce facts.

## 17. Chat and Chatbot

CURRENT - COMMERCIAL CAP REMOVED

Adulis has a normal Buyer-Seller conversation system plus an assistive structured chatbot. The chatbot is not a free-form generative Seller agent.

![Private any-language waiting support with bounded attachments](graphics/KB_05.svg)
*Figure 05. Private any-language waiting support with bounded attachments. Money is never established by Chat; original text and private evidence remain purpose-bound.*

The LLM does not generate the final Buyer-facing commerce answer. Controlled templates are populated from authoritative Product, stock, fulfilment, Order and policy data.

Scene/Post context in conversations and bot turns uses Scene Post terminology and canonical Product Post references. Context does not duplicate price/stock truth or bypass access restrictions on a PRIVATE Scene. Chat and NLU integrations must migrate any legacy content identifiers through their dedicated contracts.

No revenue-percentage inference cap is canonical. Model quotas and provider budgets will be decided after the relevant business model and observed usage are known.

## 18. Chatbot knowledge structure

Expected initial library: 50-70 global intents, while answers are Seller-specific.

The operational conversation database is intentionally separated from the identity-stripped NLU improvement dataset.

Core conceptual structures include:

```
chat.conversation   chat.message   chat.bot_turn
nlu.intent         nlu.intent_phrase
nlu.answer_template
nlu.unmatched_phrase
nlu.regression_case   nlu.regression_run
```

The bot-turn record deliberately contains no generated_text.

### Languages

Buyer-facing template output supports English and Amharic. Free-text understanding is initially more mature for English, while structured chips can carry much of Amharic interaction until the Amharic classifier corpus improves.

### Evaluation

Before changing the classifier:

• Maintain a frozen 300-500-message regression set.

• Run before/after evaluation.

• Reject changes that reduce precision.

## 19. Authentication

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

After offline recruitment, invite an EXISTING ordinary Account selected by username. Resolve target_account_id server-side and bind it immutably; username/phone changes cannot retarget the invite. No unregistered-phone team recruitment flow. Authorized Owner/Admin assigns permitted roles; target-bound acceptance, expiry/revocation and current exclusivity apply. PENDING invitations may coexist without membership authority or revealing another Seller relationship. One ACTIVE/SUSPENDED TEAM slot is database-enforced under concurrent acceptance; ownership/Courier relations remain separate.

Checkout authenticates the same ordinary Account and resumes verified server context; public anonymous browsing remains permitted under existing rules.

## 20. OTP architecture and vendors

Adulis owns OTP logic. Providers only transport SMS.

Adulis owns OTP generation, verification, expiration, attempts, challenge purpose, rate limits, sessions and Step-Up semantics. A provider /verify service must not become the authentication authority.

### Current parameters

• Six numeric digits.

• CSPRNG generated.

• Five-minute lifetime.

• Five attempts.

• Never store plaintext OTP.

• Constant-time comparison.

• Resend backoff.

| Routing | Primary | Backup |
| --- | --- | --- |
| Ethiopia | AfroMessage | SMS Ethiopia |
| International | Twilio | Infobip |

The application talks to an internal SMS abstraction rather than binding auth flows directly to any vendor.

## 21. Authorization model

Authentication answers: Who are you? Authorization must separately answer: Are you allowed to perform this exact action in this exact Seller context from this exact surface?

Current authorization evaluation includes Seller state, Account/member standing, role, application surface, entitlement and object/tenant scope.

### Current Seller role set

OWNER; ADMIN; SALES_SUPPORT; INVENTORY; ANALYST; CAMPAIGN_MANAGER.

Permissions must be derived from responsibility, atomic action, permission, permitted surface and role grants. Old permission-count totals are not business targets. Multiple roles in one membership do not bypass Seller scope or surface restrictions.

Authorization is server-side/database-enforced. Hiding a button is UX. It is not authorization. Allowed Actions are backend decisions for the authenticated principal, current object state, scope and permitted surface.

## 22. Surface-level authorization

Ordinary authenticated surface audiences include MOBILE and CONSOLE. A MOBILE session can use Buyer features and authorized Seller Companion/Courier features. A CONSOLE session reaches authorized full Seller-management functionality.

| Surface | Canonical responsibility |
| --- | --- |
| Seller Console | Create / Configure / Manage / Administer. |
| Seller Companion | Monitor / Communicate / Respond / Urgent Operations. |
| Operator Console | Privileged internal operations through a separate Operator Account and authentication path. |

High-risk operations remain console-only where their current owning permission policy requires it, including payout changes, team changes, Seller deletion, subscription/billing actions and session revocation. Step-Up applies according to the sensitive-action policy.

The database permission layer refuses prohibited surface/action combinations. ANALYST and CAMPAIGN_MANAGER do not require artificial operational Mobile workspaces in MVP. Courier Pool administration and Order-level assignment are separately authorized responsibilities.

## 23. Operator identity and Operator Console

CURRENT - SEPARATE PRIVILEGED ACCOUNT CLASS

An Operator Account is a separate privileged internal account class. It is not an ordinary Account with an added public-user role or grant. An employee may separately possess an ordinary personal Adulis Account, but Operator work access is a distinct security principal.

Public users cannot sign up as Operator, convert an ordinary Buyer/Seller/Courier Account into Operator, request Operator status from the public app or create Operator credentials from the public Website.

### Canonical provisioning flow

![Preserved canonical architecture](graphics/KB_06.svg)
*Figure 06. Preserved canonical architecture. Privileged work identity and ordinary personal identity remain independent security principals.*

Termination/revocation of Operator access must not require deletion of the employee's unrelated Buyer Account. Access is auditable, least-privileged and revocable.

### Operator roles and capabilities

Keep explicit SUPPORT, MODERATOR, CLAIM_REVIEWER and ADMIN capabilities and configured admission/account-recovery review capabilities. The dedicated Operator design owns the exact role catalogue. Seller-admission review is about current account/social/business evidence; it is not legal identity-document collection.

The Operator Console is a separate deployment/origin from the Seller Console, because compromise of a Seller-management surface must not automatically expose platform-wide moderation or payment-evidence capabilities.

Privileged authentication requires phishing-resistant expectations such as hardware security keys, WebAuthn/passkeys or managed identity with equivalent phishing-resistant MFA. Operators must never log in as a Seller, impersonate Buyers/Sellers or obtain shared master credentials.

### Operator Console responsibility

Moderation queues, reports, Claims, evidence review, social-commerce admission review, Seller/Account support, account recovery, Trust-related reviews/appeals, Seller suspension, Audit trails, administrative configuration and security operations. Operator actions record evidence and authorized decisions; they do not directly set Trust Level or payment truth.

## 24. Trust philosophy

CURRENT

Adulis should publish what it can prove from its own records.

Trust is built from evidence, not from Adulis editorially declaring whether somebody is a "good" or "bad" Seller. The public trust surface publishes measured data and level information. The database deliberately has no free-text field where an accusation could be stored in public Seller statistics.

Adulis should never publish accusation/guarantee labels such as scammer, fraud, criminal, safe Seller or dangerous Seller.

Trust is evidence-derived, cannot be purchased, is not set by a client and is not set directly by an Operator UI. It does not replace Claims or Moderation. Trust publishes factual evidence and never creates a Product listing-count entitlement.

## 25. Trust Ladder

![Adverse findings remain visible; consequences are proportionate](graphics/KB_07.svg)
*Figure 07. Adverse findings remain visible; consequences are proportionate. Trust never sells levels or sets Moderation restrictions; changed rates are not calibrated by document editing.*

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

Claim rate = DISTINCT qualifying affected verified-paid Seller Orders / DISTINCT eligible verified-paid Seller Orders in the SAME purchase cohort, including paid non-delivery. Select by canonical verified-payment cohort date and Market timezone; assign one Order once despite line/multiple Claims and retain inspectable membership. An effective metric policy must specify cohort window, maturity, late closure/reopening/correction, exclusions and minimum samples. Zero denominator returns INSUFFICIENT_EVIDENCE, never zero/perfect or division by zero. No numerator Order exists outside its denominator. Missing maturity/calibration is PENDING; do not deploy recalibrated demotion thresholds as validated.

The existing 10 purchased Product units per Buyer-Seller policy week cap applies only to favourable evidence/promotion credit. Keep its existing whole-Order threshold-crossing treatment for favourable QR/Review credit. Confirmed adverse findings remain countable at 9/10/11/20 units and across split Orders; caps cannot hide genuine Seller fault, cancellation or unresolved remedies. Independent abuse/duplicate review can invalidate proven false evidence with correction lineage, not a volume-based adverse blind spot.

Existing launch promotion thresholds (60 days/50 completed Orders/45 qualifying scans; 365 days/501 completed Orders/450 scans) remain as historical approved promotion policy. Changed Claim-cohort demotion thresholds require calibration before activation. A formerly promoted Seller dropping below ESTABLISHED is REBUILDING; no Trust-only listing cap/unpublish.

## 26. Trust anti-gaming

A Handoff should not automatically improve Trust merely because a QR event exists.

Current anti-gaming controls require evidence such as:

• Distinct Buyer.

• Buyer phone verified.

• Buyer not Seller owner/team member.

• Repeated Buyer-Seller transaction limits.

• Valid scan.

• Non-late scan for level advancement.

• Velocity monitoring.

• Buyer/Seller graph analysis.

This is important because otherwise Sellers could manufacture Trust using coordinated Accounts. A completed Order, qualifying scanned Handoff and promotion-health guard are distinct evidence requirements. Location by itself is not qualifying proof of receipt.

## 27. Public seller statistics

The Trust Engine should expose factual public statistics that help Buyers evaluate Seller reliability without turning internal risk logic into a public accusation system.

• Trust Level.

• Completed Handoffs / completed Orders.

• Cancellation rate.

• Fulfilment reliability.

• Handoff/scan completion rate.

• Unresolved Claims where policy permits aggregate display.

• Stock confidence and availability reliability.

These should be maintained through bounded projections rather than expensive full-history aggregation on every public request. Projections must remain recoverable from owning-domain facts and cannot override canonical Trust state.

## 28. Product and seller reviews

CURRENT

Two different things are reviewed.

| Dimension | Examples |
| --- | --- |
| Product quality | Item matched description; physical quality; sizing/condition and other Product-specific outcomes. |
| Seller service | Responsiveness; communication; fulfilment behavior. |

These must not be silently collapsed into one generic rating. Confirmed Handoffs provide the strongest transaction evidence for reviews. Sellers should not be able to suppress unfavorable reviews merely because the Seller disputes them.

Delegating receipt does not transfer the Buyer's Review rights to the delegated recipient.

## 29. Claims and incident handling

A Buyer can raise a Claim for defined transaction problems. The payment gateway changes the payment record, but it does not remove the need for dispute evidence.

### Examples

• Payment succeeded but the Seller does not fulfil.

• Seller cancels because stock was inaccurate.

• Goods not received.

• Materially not as described.

• Promised refund not completed.

• Handoff/Courier disputes.

Claim review uses evidence already held by Adulis: Order snapshots, Chapa/provider payment references and verified statuses, chat, Handoff evidence, Product/listing snapshots, Courier assignment and authorized Pickup/Delivery checkpoint evidence where relevant, Seller actions and Audit history.

Claims remain human-reviewed for material outcomes. Analytics or recommendation signals do not adjudicate disputes. Checkpoint location is supporting evidence; location failure does not invalidate an otherwise valid QR/OTP/Manual Handoff. Precise location is not broadly exposed merely because it exists. Delegation does not transfer Buyer ownership, refund or Claim rights.

## 30. Order Management - canonical checkout flow

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

![One safe release predicate and a separate money/stock commit](graphics/KB_08.svg)
*Figure 08. One safe release predicate and a separate money/stock commit. Timer/request alone never releases uncertain stock. Provider failure has no guaranteed resolution time.*

Release is governed by ORDER §35/46, shared by expiry/cancel/callback/repair. A definitively uninitiated attempt may release only after durable dispatch proof and fencing under locks; any possibly initiated attempt needs confirmed authoritative finality, never merely not-found or a local deadline.

## 31. Checkout, payment and Order boundaries

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

Current launch total is merchandise + approved delivery + provider-permitted processing fee + zero Adulis surcharge + any separately approved applicable component. No supported fee route is presumed until the gate passes.

## 32. Current Order lifecycle direction

The owning Order design defines the finalized state graph. The retained high-level direction is:

![One safe release predicate and a separate money/stock commit](graphics/KB_09.svg)
*Figure 09. One safe release predicate and a separate money/stock commit. Timer/request alone never releases uncertain stock. Provider failure has no guaranteed resolution time.*

Payment-failed, cancellation, refund-pending and refunded paths must be modeled explicitly where applicable. Illegal transitions must remain fail-closed and database-enforced. The labels in the diagram express lifecycle direction, not a claim that every deployed enum has these exact names.

Seller fulfilment actions never confirm payment. Connected Handoff acceptance and Order completion are server-authoritative. Multi-Seller UX grouping does not erase individual Seller Order states.

## 33. Important paid-buyer protection invariant

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Reviews owns review.eligibility_changed on committed basis/state change only. One handoff.verified event carries required stage; only qualifying DELIVERY supplies final receipt. Verified failure/correction/remedy facts use the supplied EVT registry; neither replay nor PICKUP creates another feedback opportunity.

## 34. Handoff and connectivity

CURRENT - CONNECTED-ONLY, SERVER-AUTHORITATIVE

Handoff remains the strongest physical transaction evidence Adulis generates. QR-based evidence feeds Order completion, reviews, Trust, Claims and Seller statistics.

Business Handoff requires a network connection and server acceptance. A locally captured scan is not an accepted business Handoff. The client cannot queue Handoff acceptance for delayed synchronization. On connection failure, the action remains unaccepted and the user retries through the connected server path.

QR is primary. OTP is fallback. Manual Verification is emergency recovery. Each method remains server-authoritative and subject to current authorization, state and evidence rules.

### Canonical display/scan direction

| Transfer | Presenter/giver displays | Recipient scans |
| --- | --- | --- |
| Seller to Courier Pickup | Seller | Courier |
| Courier to Buyer/delegate Delivery | Courier | Buyer or authorized delegated recipient |
| Seller to Buyer direct collection/delivery | Seller | Buyer or authorized delegated recipient |

Presenter/giver displays; recipient scans. Courier Delivery uses two custody stages: Seller to Courier Pickup and Courier to Buyer/delegate Delivery. Signed, replay-resistant evidence and server state validation remain required.

### Delegated recipient

A Buyer may authorize one recipient according to Order/Handoff policy. Delegation permits receipt only; it does not transfer Buyer ownership, refund, Claim or Review rights.

Location attempts at PICKUP and DELIVERY are supporting evidence. Their failure does not invalidate a valid connected QR/OTP/Manual Handoff. That does not remove the network requirement for business acceptance.

## 35. Payment gateway security

CURRENT - CHAPA INTEGRATION

Payment security centers on gateway transaction integrity.

• Create payment attempts server-side and bind them to Adulis Checkout/Order context.

• Never trust a client redirect, query parameter or local success screen as payment confirmation.

• Verify provider results server-side using the payment provider's supported verification mechanisms.

• Enforce unique provider transaction identity and idempotent callback/reconciliation handling.

• Validate expected amount, currency and Adulis transaction context before marking payment successful.

• Keep Chapa credentials/secrets outside PostgreSQL and redact them from logs, analytics and client payloads.

• Run reconciliation for ambiguous, delayed or missed callbacks.

• Use an internal payment-provider adapter so a later PSP can be introduced without rewriting Order logic.

Refund, settlement routing and merchant/legal fund-flow details must be defined in the dedicated Payments and business/legal work. This document does not invent them. Sellers cannot approve or override provider-verified financial truth.

## 36. Fulfilment

Adulis supports Buyer collection, Seller delivery and Courier Delivery through the current pool/network assignment model.

A Seller must configure at least one valid fulfilment method for sellable Products where the publication policy requires it. Human-readable pickup/delivery instructions remain important because addressing quality varies.

Fulfilment begins from a valid paid commerce state and never decides payment truth itself. Courier request/assignment is backend/Fulfilment-owned. Order-level assignment is distinct from standing Courier Pool administration.

For Courier Delivery, the Buyer sees and pays the Seller-defined delivery charge before provider payment. Current MVP delivery charge corresponds to the Courier compensation snapshotted for that Order. Fulfilment consumes the authorized financial snapshot; it does not maintain a Courier wallet.

## 37. Courier scope

CURRENT MVP - PRIVATE POOLS AND CROSS-SELLER NETWORK

| Current MVP phase | Scope |
| --- | --- |
| Phase 1 | Private Courier Pools administered for individual Sellers. |
| Phase 2 | Cross-Seller Courier Network, with backend/Fulfilment-owned requests and assignments. |

One Courier identity may participate in multiple Seller Courier Pools. Seller relationships remain private to each Seller. A Courier may have multiple Seller relationships, while the current MVP default permits a maximum of ONE active accepted delivery per Courier at a time.

Assignment-scoped access remains enforced by backend authorization and database/RLS scope. A standing relationship does not expose every Seller's Orders or private Courier relationships. Courier Delivery participates in Seller-to-Courier and Courier-to-Buyer/delegate Handoff evidence.

### Location/checkpoint evidence

Current MVP attempts location capture at exactly two Courier Delivery checkpoints when available: PICKUP and DELIVERY. Capture is foreground/on-demand, supporting evidence only. A failed location attempt does not invalidate a valid QR/OTP/Manual Handoff.

Precise checkpoint location is accessed only under its purpose/authorization boundary; it is not broadly exposed in Buyer/Seller views, logs or analytics merely because it exists. The owning Privacy design defines access and retention detail.

### Outside current scope

Simultaneous delivery batching, grouped multi-Seller routes, route optimization, movement maps, continuous/background location collection and location-based assignment are not current MVP capabilities. Public Courier bidding, dynamic pricing, insurance and advanced Courier ranking remain deferred. The Cross-Seller Courier Network does not imply an unrestricted public bidding marketplace.

## 38. Product Posts, Scene Posts and Media architecture

CURRENT - TWO FORMAL SELLER PUBLISHING TYPES

Adulis has two primary Seller publishing formats: Product Post and Scene Post. Formal documentation should not use "normal post" for Seller content.

### Product Post

A Product Post is the canonical structured representation of exactly one sellable Product. It owns/references current structured commerce facts through Catalogue/Inventory: Product identity, attributes, Variants, price, Inventory/availability, Seller identity, ratings, Trust context and purchase actions.

### Scene Post

A Scene Post is Seller-authored image-led commerce/discovery content that visually presents one or more of that Seller's Product Posts. It may demonstrate, style, teach, compare or otherwise show why Buyers may want those Products. Captions, Product tags and hotspots belong to this presentation. A Scene Post is already the Scene; there is no separate formal Scene entity type.

• At least one valid Product Post tag is mandatory for public publication.

• Tags must be same-Seller and valid under Market/content rules in current MVP.

• Product tags must be materially relevant to the media/content.

• A Scene may tag multiple Products; a Product may be referenced by multiple Scenes.

• Scene Posts never own canonical price, Variant, stock or payment truth.

### Public publication gate

A Scene cannot become publicly PUBLISHED unless all required conditions pass: at least one Product Post tag; every tag being added is valid; at least one tagged Product is currently eligible and in stock/available; Seller is eligible; Market is valid; media is ready; caption/content requirements pass; and Moderation permits publication.

| Publication example | Result |
| --- | --- |
| Zero Product tags | Reject publication. |
| One tag and its Product is out of stock | Reject publication. |
| Multiple tags and all Products are out of stock | Reject publication. |
| Multiple valid tags and at least one eligible Product is in stock | May publish if every other gate passes. |

### Separate lifecycle and visibility

| Field | Canonical values / meaning |
| --- | --- |
| publication_state | DRAFT; PUBLISHED; ARCHIVED / REMOVED as appropriate to the owning lifecycle design. |
| visibility | PUBLIC or PRIVATE; Buyer visibility is separate from publication lifecycle. |
| Stock restriction reason | ALL_TAGGED_PRODUCTS_OUT_OF_STOCK, or the owning design's equivalent structured reason. |

![Current eligibility runs before every new controlled Scene delivery](graphics/KB_10.svg)
*Figure 10. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

When the last currently available tagged Product becomes unavailable, publication_state remains PUBLISHED and visibility changes PUBLIC to PRIVATE. Do not archive the Scene because of stock exhaustion. If at least one eligible tagged Product remains available, stock alone does not privatize it.

A stock-restricted PRIVATE Scene disappears from FYP, Marketplace Search, Buyer Storefront/profile views, direct public Buyer links, Collections/public Buyer resolution and every other Buyer-facing discovery surface. It remains accessible to the owning Seller through authorized management surfaces, with a clear Private badge and an explanatory notification.

### Automatic restoration is current policy

When at least one tagged Product becomes available/in stock again, the server re-evaluates Seller, Market, Product, Moderation, media and publication eligibility. If every required condition passes, stock-driven PRIVATE visibility automatically returns to PUBLIC and the Seller receives a restoration notification.

Restoration must not override independent archival, moderation blocking, Seller suspension, Market ineligibility, deletion or any other restriction. A stock recovery is a re-evaluation trigger, not unconditional publication. Clients and Recommendation do not own these transitions.

Inventory availability changes trigger owning-domain re-evaluation and projection invalidation through transactional eventing. Public resolution enforces current eligibility even while derived Search/FYP/cache projections converge. Reconciliation repairs missed work without allowing queues or projections to become canonical visibility truth.

### Media flow

![Media purpose separates public images from private Chat evidence](graphics/KB_11.svg)
*Figure 11. Media purpose separates public images from private Chat evidence. Downloaded bytes cannot be recalled. Chat evidence cannot use public gallery permissions or native video.*

Native Seller uploads and FYP are image/photo only at launch. There is no current native Seller video-processing/transcoding pipeline. Approved external TikTok/social video may appear only on eligible Product Post detail through the approved embed boundary; third-party video does not become FYP Scene media. Richer media remains a future extension seam.

### Engineering identifier migration

The canonical current type is SCENE_POST, with ScenePostFeedUnit and scene_post.* naming in current contracts. Deployed database/API/event identifiers must migrate through their dedicated compatibility/versioning plans rather than being blindly renamed. A legacy implementation identifier awaiting migration is not a second current product type.

Apply this migration across schemas, APIs, UI copy, events, analytics, Search, Collections, Moderation, Media, Chat/NLU context and Platform/Privacy/Observability cross-references. The superseded human term is recorded only in the final Glossary for migration clarity.

## 39. Sellers should not have to become creators twice

A major Seller-experience principle remains: Adulis should not force Sellers to build a completely separate content operation merely to sell on Adulis.

Where platform rules and APIs permit, Sellers should be able to reuse existing image creative and transform it into a Scene Post by attaching legitimate Adulis Product Posts.

• The Seller should not re-enter canonical price, stock, Variants or Product description for every Scene Post.

• Product tagging should be fast: upload permitted image media, add caption, choose existing same-Seller Product Posts, position/attach tags, preview and publish through the current gate.

• The anti-social-network guardrail still applies: reused content must materially support the tagged Products.

External video reuse follows the eligible Product Post detail/embed boundary only; it is not a path for video into FYP Scenes. Future creator-commerce is allowed by extension seams, but current MVP Scene tagging remains same-Seller unless an explicit approved creator/affiliate decision changes it.

## 40. Current core technology baseline

CURRENT - CANONICAL IMPLEMENTATION STACK

| Layer | Canonical baseline |
| --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript; Drizzle ORM; PostgreSQL. |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements. |
| Async / cache | Valkey; BullMQ. |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client. |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js. |
| Media | Cloudflare R2; Cloudflare CDN; Sharp. |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; Expo SecureStore; Expo SQLite; Expo Camera; Expo Notifications; Expo Updates; small Zustand store. |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6. |
| Observability | Sentry; Pino structured logs; pg_stat_statements. |
| Architecture control | dependency-cruiser. |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS. |
| Payment provider | Chapa - initial gateway integration, accessed through an internal provider boundary. |

This list supersedes older stack references. Valkey is the current cache/queue datastore name. BullMQ is the ordinary background-job engine; do not add a second overlapping engine. The Mobile stack does not imply an offline client business-operation queue or a continuous-delivery-location task requirement.

## 41. Modular monolith, not microservices

CURRENT

At launch, one NestJS application contains strong logical module boundaries inside a consolidated deployment.

![Preserved canonical architecture](graphics/KB_12.svg)
*Figure 12. Preserved canonical architecture. Logical ownership inside one NestJS application; no premature distributed service topology.*

Do not prematurely build dozens of microservices, Kafka, Kubernetes, an independent ML service, GPU infrastructure, a feature store, a vector database for FYP, a dedicated mobile BFF, GraphQL only because the FYP exists, or Elasticsearch merely because Search exists.

The current architecture explicitly rejects that premature complexity. This is especially appropriate for the current engineering-team size.

## 42. Recommended core module map

Recommended backend modules remain logical modules inside one NestJS modular monolith.

| Module group | Responsibilities |
| --- | --- |
| Identity / Admission | Auth, Authorization, Account, Seller, Seller Team Membership, Onboarding, Verification; separate privileged Operator identity boundary. |
| Catalogue / Content | Catalogue, Inventory, Product Posts, Scene Posts, Scene Lifecycle/visibility, Media. |
| Discovery | Recommendation/FYP, Search, Collections. |
| Commerce | Checkout, Payments/Chapa, Orders, Fulfilment, Courier Pools/network assignments, Handoff. |
| Trust & Safety | Reviews, Trust, Claims, Moderation. |
| Communication | Chat, Chatbot/NLU, Notifications. |
| Cross-cutting | Market Config, Analytics, Privacy, Audit, Observability, Billing/Entitlements, transactional eventing and jobs. |

Each module owns writes to its canonical state. Cross-domain writes route through the owning application interface rather than reaching into another module's repositories.

### Current async/eventing doctrine

![Preserved canonical architecture](graphics/KB_13.svg)
*Figure 13. Preserved canonical architecture. Durable PostgreSQL state and work intent precede relay, retry-safe jobs and reconciliation.*

A PostgreSQL business transaction writes canonical state and transactional event_outbox / job_intent records together. After commit, a relay submits a deterministic BullMQ job. Valkey supports queue/cache infrastructure; an idempotent consumer performs work, and reconciliation repairs missed or ambiguous outcomes.

BullMQ is the ordinary background-job engine. Valkey is never canonical business truth. Do not introduce a second overlapping job engine or claim distributed exactly-once delivery. Retries and duplicate delivery are handled by idempotency and reconciliation. There is no offline client business-operation queue.

## 43. Analytics architecture

Analytics must distinguish Product performance, content performance and content-to-commerce performance.

### Product performance

Product Post impressions/views/saves; Checkout starts; paid Orders; completion; GMV where policy permits; Inventory performance. Product impressions on approved commerce surfaces do not make Product Posts independent FYP units.

### Scene Post performance

Impressions, qualified image views/dwell, saves/shares/other enabled engagement and Product-tag clicks.

### Content-to-commerce performance

Product click-through rate; Product Post views generated; Storefront visits; Checkout starts; paid Orders influenced; conversion contribution; GMV attribution where appropriate.

Analytics should be able to answer: "Which creative sells this Product best?" and "Which Scene Posts create attention but little commercial value?"

Server-owned payment/Order outcomes remain canonical domain facts. Analytics observes them; it does not create them. Scene events and dimensions use the current Scene naming with explicit migration for any legacy stored identifiers.

## 44. Algorithm attribution

Every meaningful conversion should preserve structured origin context without making attribution a condition for commerce validity.

• feed_session_id and impression_id.

• algorithm_version and candidate source.

• FYP unit type SCENE_POST where the origin is FYP.

• Scene Post identity and exact revision/version where applicable.

• product_tag identity when the path came through a tag.

• Product Post/Product identity.

• Surface and position.

• Later Checkout/Order attribution snapshot.

Attribution should support analysis of direct Product-led discovery through Search/Storefront/other commerce surfaces versus Scene-led discovery, while preserving privacy and deterministic event semantics. A direct Product conversion has valid commerce even when no FYP impression exists.

## 45. Machine learning policy

CURRENT

Do not build ML simply because Adulis now has an FYP.

ML becomes appropriate when Adulis has enough behavioral data, trustworthy event instrumentation, deterministic benchmark performance, a clear prediction target, evaluation capability and business guardrails.

### Possible future progression

![Preserved canonical architecture](graphics/KB_14.svg)
*Figure 14. Preserved canonical architecture. Possible future ML progression; every promotion requires evidence and evaluation, not a launch dependency.*

None of this is required to launch the current FYP.

## 46. Deployment philosophy

CURRENT

At minimum, Development, Staging and Production use separate credentials, environment configuration, data and secrets.

### Current recommended release path

![Preserved canonical architecture](graphics/KB_15.svg)
*Figure 15. Preserved canonical architecture. Managed release progression with separated environments and health verification.*

Backups are not considered proven until a restore has actually been tested. Managed deployment remains the preferred philosophy. Operator Console deployment/origin and authentication boundaries remain separate from ordinary Seller surfaces.

## 47. Existing web deployment assumptions

Current API/surface documentation has previously assumed public web on Next.js / Cloudflare, Seller Console as a React web application / Cloudflare Pages, React Native mobile and shared backend APIs.

The canonical delivery toolchain includes Docker, GitHub Actions, Render, Cloudflare and EAS. Historical web assumptions alone do not settle every compute/database hosting configuration. The dedicated Deployment design owns environment topology, vendor/service configuration and release operations.

## 48. Reliability and observability

At minimum monitor application health, PostgreSQL, Valkey/BullMQ, R2/CDN, payment-provider integration, FYP, analytics and client reliability.

| Area | Required operating signals |
| --- | --- |
| Backend | Request rate, error rate, p50/p95/p99 latency. |
| PostgreSQL | Query latency, pool usage, lock contention, slow queries through pg_stat_statements. |
| Valkey / BullMQ | Relevant cache hit/miss, memory, latency, queue backlog, retries, processing time and dead jobs. |
| Payments / Chapa | Attempt success/failure, verification latency, callback/reconciliation lag, duplicate handling and provider outages. |
| FYP / content | Candidate count, ranking latency, empty/fallback rate, Product-tag CTR and content-to-commerce conversion. |
| Scene Lifecycle | Stock-driven Private/restoration transitions, eligibility re-evaluation lag, projection invalidation failures and notification outcomes. |
| Courier / Handoff | Assignment health; connected Handoff acceptance/error/replay outcomes; Pickup/Delivery location-attempt availability/failure, without broad precise-coordinate exposure. |
| Eventing | Outbox/job-intent age, relay lag, deterministic-job retries, idempotent-consumer outcomes and reconciliation repairs. |
| Operator boundary | Privileged authentication/access failures, revocation and audited authorized actions. |

Sentry and Pino provide the primary application error/logging layer. Observability is not Analytics and logs are not the durable privileged Audit system. Location sample age, route history and movement-session health are not current product/monitoring capabilities. No raw precise checkpoint location should be broadly logged merely because it exists.

## 49. Testing philosophy

The architecture requires unit, integration, database/invariant, API contract, component, E2E, security-negative and load tests.

### High-value E2E and invariant examples

• For You returns ScenePostFeedUnit with SCENE_POST only; Scene tag opens Product Post; Checkout, Chapa verification and paid Seller Order follow.

• Search returns PRODUCT_POST, SELLER and PUBLIC SCENE_POST from launch.

• Scene publication rejects zero tags, invalid/cross-Seller tags and all-out-of-stock tags; it may succeed with one eligible available tag when other gates pass.

• Last available tag becomes unavailable: Scene stays PUBLISHED, becomes PRIVATE, disappears from every Buyer public surface/direct link/Collection resolution, shows Private to Seller and creates a notification.

• Restocking re-evaluates all eligibility and automatically restores PUBLIC only when every gate passes; independently restricted Scenes stay restricted and valid restoration notifies the Seller.

• A Collection preserves saved membership internally while its PRIVATE Scene remains unrenderable; eligible restoration resolves the same save.

• Stale FYP/Search/cache projections cannot expose a canonically PRIVATE Scene.

• Payment callback retry is idempotent and cannot create duplicate Orders or stock effects; Seller APIs cannot manually mark payment successful.

• Multi-cart splits into separate Seller Orders with independent operational/financial state and correctly disclosed versioned surcharge/fee snapshots.

• The current zero-basis-point surcharge basis excludes Courier Delivery charge; provider fees and delivery compensation remain distinct.

• Paid Order, fulfilment, connected QR/OTP/Manual Handoff, completion and Review follow legal transitions; lack of network never produces accepted Handoff or a delayed client acceptance queue.

• Seller displays/Courier scans Pickup; Courier displays/Buyer or delegate scans Delivery; Seller displays/Buyer or delegate scans direct Handoff.

• Delegation allows receipt without transferring ownership, refund, Claim or Review rights.

• Courier identity can join multiple private Seller Pools; unrelated Seller relationships remain private; accepting a second active delivery fails under the MVP concurrency default.

• Only PICKUP and DELIVERY foreground location attempts occur; denied/unavailable location does not invalidate valid connected Handoff.

• A second non-terminal Seller Team Membership fails; accepted username-based invitations can carry multiple permitted roles within one membership.

• Ordinary public Account flows cannot provision/convert to Operator; revoking an Operator principal leaves an unrelated ordinary Buyer Account intact.

• Trust promotion requires every configured threshold and health guard; demotion uses REBUILDING when appropriate and never changes listing-count entitlement.

• Claim evidence leads to an authorized Operator outcome; cross-tenant/surface authorization, Step-Up and provider failure paths remain fail-closed.

• Deterministic Recommendation ranking is tested under fixtures; outbox/relay retries, idempotent jobs and reconciliation tolerate duplicates and queue loss.

Similar Finds and Complete the Scene are not launch-gate E2E requirements while those features are disabled. These scenarios update the existing test philosophy rather than claiming that implementation tests have already been run.

## 50. Localization and Ethiopia-specific design

CURRENT

Ethiopia is an architectural constraint, not merely a launch label. The architecture remains international and Market-aware.

• English + Amharic.

• Low-end Android devices and expensive/variable mobile data.

• Image optimization and low-data FYP delivery.

• Clear connectivity failures and recoverable connected Handoff retry; no local business acceptance.

• Local OTP vendor reliability.

• Weak standardized addressing and local fulfilment patterns.

• Chapa payment integration and provider-outage recovery.

• Foreground Pickup/Delivery checkpoint location attempts when available; supporting evidence with purpose-limited access.

• Market-specific eligibility, availability, labels, currency/provider policy and Locally Made configuration.

Poor connectivity does not relax provider/backend payment authority, connected Handoff acceptance or current Scene visibility gates.

## 51. Commercial policy - current transaction rule and open packaging

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

| Policy area | Current scope |
| --- | --- |
| Adulis surcharge | Disabled launch: 0 bps and amount zero; future Buyer incidence is selected, activation not. |
| Chapa processing fee | Buyer preference selected; provider permission/calculation unresolved; route disabled. |
| Courier charge | Seller-defined approved snapshot; supported Seller-to-Courier fallback preserved. |
| Settlement/refunds | Provider-managed Seller settlement target conditional on actual merchant permissions; no voluntary Adulis cash backstop. |
| Subscriptions/advertising | Unaffected separately managed/deferred packaging; this correction adds no tariff. |

## 52. Chatbot commercial limits - OPEN

OPEN - NO REVENUE-PERCENTAGE CAP

The previous rule that tied chatbot inference cost to a fixed percentage of Seller-tier revenue is discarded.

Chatbot usage limits, provider/model budgets, plan entitlements and inference quotas will be decided only after the relevant business model and real usage/cost data are available.

Until then, the architecture should expose configurable budgets and safety limits without expressing them as a percentage of Seller revenue. The closed Checkout surcharge does not by itself settle chatbot plan packaging or quotas.

## 53. Seller eligibility - social-commerce admission gate

CURRENT - SOCIAL-COMMERCE ADMISSION

Adulis remains intentionally exclusive at launch and during the early growth period.

### Current admission rule

• A business must have an established, recognizable social-media business presence/page to qualify.

• A content creator must also have a legitimate business/selling status; creator reach alone is not enough.

• A business with no meaningful social-media presence is not eligible under the current policy.

• A creator with no business/Seller status is not eligible under the current policy.

• Social-account control and configured Seller/business verification remain required according to current policy.

Exact audience thresholds and evidence rules should remain versioned/configurable rather than hard-coded globally. Adulis may broaden eligibility after roughly one to two years, but that future opening is not a current commitment.

### Current Seller verification boundary

Seller verification is primarily phone/Account control, social-account control, social-commerce admission evidence and configured Seller/business information. PSP/provider onboarding applies where required by that provider.

Adulis admission does not collect or require government identity documents, identity-document scans/images or identity-verification selfies. Provider-specific KYC performed by a PSP remains a provider boundary; it must not be described as Adulis Seller-ID verification or used to reintroduce an Adulis document-collection requirement.

## 54. Roadmap - OPEN / previous roadmap discarded

OPEN - NEW ROADMAP TO BE DRAFTED

The previous staged product-evolution roadmap is discarded and must not be used to infer current sequencing, scope or architecture priorities. A new overall roadmap will be drafted separately.

Until then, current explicit product decisions and dedicated system designs define scope. The current MVP's Private Courier Pools (Phase 1) and Cross-Seller Courier Network (Phase 2) are explicit scope rulings; they are not deferred merely because the broader roadmap remains open.

## 55. Explicitly superseded decisions

The following older assumptions must not govern new implementation. The current replacements are authoritative.

| Superseded assumption | Current replacement |
| --- | --- |
| Entire Home is a chronological followed-Seller feed | Buyer Home has five launch tabs; For You defaults to algorithmic cross-Seller discovery. |
| Marketplace discovery is a later-generation feature | Cross-Seller discovery and public Scene Search are launch scope. |
| Mixed Product/Scene top-level FYP content | Scene Posts are the only FYP content units; Products are commerce destinations. |
| Public Scenes without available Product relationships | Public publication needs valid tags and at least one eligible available Product. |
| Archive a Scene solely when stock is exhausted | Keep PUBLISHED; become PRIVATE; automatically restore after stock recovery and eligibility checks. |
| Separate formal lifestyle content entity | Scene Post is already the Scene; hotspots are presentation features. |
| Buyer transfer evidence or Seller action establishes payment | Provider/backend verified payment; no Seller payment authority. |
| Old pre-payment timer/state model | Current dedicated Checkout/Order/Inventory design owns legal transitions and stock protection. |
| Generic/unrestricted Seller social content | Product Posts or materially commerce-linked Scene Posts. |
| Continuous Courier movement maps and route collection | Two foreground/on-demand Pickup/Delivery checkpoint location attempts, when available. |
| Delayed local acceptance of physical Handoff | Connected-only, server-authoritative QR/OTP/Manual Handoff. |
| Seller-invited-only Courier access | Private Courier Pools plus Cross-Seller Courier Network in current MVP. |
| Concurrent multi-Order Courier routes | One active accepted delivery per Courier by MVP default. |
| Recipient presents final Delivery QR | Presenter/giver displays; recipient scans. |
| Ordinary public identity promoted to privileged Operator | Separate internally provisioned Operator Account and authentication path. |
| Adulis identity-document admission or Trust listing entitlements | Phone/social/business admission evidence; no Adulis identity-document collection; no Trust listing-count restriction. |
| NEW used again for a formerly promoted Seller | Four labels: NEW, REBUILDING, ESTABLISHED, TRUSTED. |
| Every commercial decision is open or one universal free period applies | Versioned zero launch Adulis Buyer surcharge is closed; plan/advertising/public packaging remains separately managed. |
| Fixed chatbot inference cap based on Seller revenue | Configurable budgets; quotas and plan packaging remain open. |
| Previous multi-version roadmap | New overall roadmap to be drafted; current explicit scope still governs. |
| Telegram Seller bot / separate Seller app | One mobile app with Seller Companion. |
| Older ORM/cache/job-engine assumptions | Drizzle ORM, Valkey and BullMQ; no second overlapping job engine. |
| UI visibility acts as authorization | Server/database enforcement of action, scope and surface. |

Terminology migration is governed by Section 38 and the final Glossary. Historical identifiers are not current parallel content types.

## 56. Things that are deliberately NOT in MVP architecture

Unless a measured requirement or new explicit decision changes this, MVP should not depend on:

• Kubernetes, Kafka, microservices, service mesh or distributed saga infrastructure.

• GPU inference, deep-learning recommendation, dedicated feature store or real-time ML feature platform.

• Elasticsearch/OpenSearch solely because Search exists.

• Public Courier bidding, dynamic delivery pricing or a Courier insurance engine.

• Active Similar Finds or Complete the Scene before data/Product coverage is sufficient.

• Creator/affiliate marketplace, customer-generated Scene Posts or automatic visual Product recognition.

• Generic social-network posting unrelated to commerce.

• Separate Seller mobile application or Telegram bot dependency.

• Native Seller video processing/transcoding or video Scene media in FYP.

• Continuous Courier movement collection, route optimization or simultaneous multi-delivery routes.

• Client-side queued business acceptance or delayed Handoff acceptance.

• A Fulfilment-owned Courier wallet or a second overlapping background-job engine.

These exclusions do not remove current public Scene Search, mixed Product/Scene Collections, automatic Scene restoration, Private Courier Pools or the Cross-Seller Courier Network from MVP scope.

## 57. Areas that are already unusually mature

Several Adulis areas should be preserved rather than redesigned from zero. This is an assessment of architectural foundations, not a claim that implementation has passed all checks.

### Authentication and authorization

Phone OTP, stateful sessions, surface-aware permissions and scope enforcement are mature foundations. Operator access retains phishing-resistant, audited least privilege within the separate privileged Account boundary.

### Trust, Reviews and Claims

Evidence-derived Trust, separate Product/service review dimensions and auditable Claim handling remain strong design foundations. The current four-label ladder and promotion baselines replace older numerical/label assumptions.

### Handoff

Signed, replay-resistant QR evidence and server validation remain developed conceptual foundations. Connected-only acceptance replaces delayed local acceptance.

### Seller surfaces

The separation between Company Website, Seller Storefront, Seller Console, Buyer Mode, Seller Companion and Operator Console remains correct.

### Deployment and data ownership

Modular-monolith boundaries, PostgreSQL authority, transactional outbox, managed infrastructure and recoverable projections remain sound.

Payment/Checkout integration still requires its dedicated implementation and validation; this baseline does not label it mature merely because the initial provider and surcharge are now explicit.

## 58. Areas requiring the most new architecture work

The largest architecture work now centers on:

1. Aligning Checkout, Payment and Seller Orders with provider authority, multi-cart boundaries, current fee snapshots and paid-Buyer protection.

2. Applying Product Post / Scene Post terminology through Catalogue, Content, Media, Seller tooling, FYP, Search, Collections and Storefront contracts.

3. Enforcing public Scene publication, stock-driven Private transitions, eligible automatic restoration, notifications and protection from stale projections.

4. Preserving Product-tag events, revision lineage, content-to-commerce attribution and multi-objective FYP ranking.

5. Updating Moderation for Product relevance, unrelated tagging and content-specific abuse.

6. Aligning private Courier Pools, the Cross-Seller Courier Network, assignment privacy and the one-active-delivery default.

7. Enforcing connected Handoff direction/delegation and purpose-limited Pickup/Delivery checkpoint evidence.

8. Implementing separate Operator principal/provisioning and Seller Team Membership exclusivity with surface-aware permissions.

9. Applying the four-label Trust Ladder and current promotion baselines without listing-count restrictions or identity-document admission.

10. Propagating Valkey/BullMQ transactional eventing, tests, observability, diagrams, API contracts and database migrations through affected designs.

11. Researching separately managed Seller plan/advertising packaging, drafting the overall roadmap and continuing measured Search/analytics/deployment work.

The list states integration/reconciliation work; it does not assert that all referenced dedicated designs are incomplete or that unreviewed implementation has shipped.

## 59. Proposed canonical architecture philosophy

The architecture remains a modular monolith with strong logical ownership and explicit external-provider boundaries.

![Preserved canonical architecture](graphics/KB_16.svg)
*Figure 16. Preserved canonical architecture. Owning-domain/PostgreSQL truth supports all surfaces. Queues, media and derived measurements do not override it.*

PostgreSQL-backed owning domains determine business state. Public surfaces resolve authorized current state; Valkey/BullMQ, Search/FYP projections, analytics and observability support the platform without becoming business authorities. Operator identity is a separate privileged boundary. Payment/SMS/social providers remain behind explicit adapters or embed boundaries.

Domains may be extracted physically later only when measured scale or operational isolation justifies the cost.

## 60. Final alignment summary

Unless a newer explicit decision supersedes them, the following are the canonical assumptions for subsequent Adulis system-design updates.

| Area | Canonical direction |
| --- | --- |
| Platform positioning | Ethiopia-first social-commerce marketplace; commerce-focused discovery + Seller operating software + evidence-based Trust. |
| Markets | International/Market-aware architecture; eligibility, locality, labels and provider policy are configured by Market. |
| Product Post | Exactly one sellable Product; structured commerce facts resolve through Catalogue/Inventory; not an independent FYP unit. |
| Scene Post | Seller-authored image-led commerce/discovery content with same-Seller Product tags; no canonical price/Variant/stock/payment truth. |
| Scene publication | Valid relevant tags, at least one eligible in-stock Product, eligible Seller/Market, ready media, passing content and Moderation gates. |
| Scene automatic Private | Last eligible available tag becomes unavailable: retain PUBLISHED, set PRIVATE, remove every Buyer public resolution, badge and notify Seller. |
| Scene automatic restoration | Stock recovery triggers all-gate re-evaluation; eligible stock-driven Scene automatically becomes PUBLIC and notifies Seller. Independent restrictions stay effective. |
| Buyer Home | Primary discovery container: For You (default), Following, Nearby, Discounts, Locally Made; Market-configurable labels. |
| FYP | PUBLIC eligible Scene Posts only; image-only; commerce-focused deterministic V1 with exploration/diversification. |
| Search | PRODUCT_POST, SELLER and PUBLIC SCENE_POST from launch; separate Search ranking/eligibility resolution. |
| Collections | Authenticated private Buyer Collections support Product Posts and whole Scenes; Private Scenes cannot render; saved membership may survive restoration. |
| Accounts | One ordinary Account may hold Buyer, Seller-owner/team and Courier relationships after eligibility/data completion. |
| Seller Team Membership | Maximum one non-terminal membership per ordinary Account during MVP; multiple assigned roles allowed; username invitation and acceptance. |
| Operator Account | Separate privileged internal security principal; internal provisioning/authentication; audited least privilege; no public conversion or impersonation. |
| Seller verification | Phone/social-account control, social-commerce admission and configured business information; no Adulis identity-document/selfie collection; provider KYC separate. |
| Trust | NEW, REBUILDING, ESTABLISHED, TRUSTED; evidence-derived, cannot be purchased; no listing-count restriction. Promotion: 60 days/50 Orders/45 scans + guard; 365 days/501 Orders/450 scans + activity/health. |
| Checkout | Chapa initial provider; backend verifies payment; no Seller payment authority; multi-cart groups separate Seller Orders. |
| zero launch surcharge | Buyer-side Checkout surcharge, 0 basis points, versioned; current basis excludes Courier Delivery charge. |
| Courier Delivery charge | Seller-defined, shown and paid before provider payment; matches snapshotted Order Courier compensation in current MVP; distinct from surcharge/provider fees. |
| Courier Pools | MVP Phase 1 Private Pools; Phase 2 Cross-Seller Courier Network; one Courier may join multiple Seller Pools while relationships stay private. |
| Courier concurrency | Maximum one active accepted delivery per Courier by current MVP default. |
| Handoff | Network-required and server-authoritative; QR primary, OTP fallback, Manual emergency recovery; giver displays, recipient scans; one authorized delegate under policy. |
| Location/checkpoint evidence | Exactly PICKUP and DELIVERY foreground/on-demand attempts when available; supporting evidence; failure does not invalidate valid connected Handoff; purpose-limited precise data. |
| Seller Console | Create / Configure / Manage / Administer; deep catalogue/content/team/pool configuration and business management. |
| Seller Companion | Monitor / Communicate / Respond / Urgent Operations; backend-authorized mobile work; no artificial ANALYST/CAMPAIGN_MANAGER operational workspace. |
| Media | Native images/photos and image-only FYP; R2/CDN + Sharp; approved external video only on eligible Product detail through embed boundary. |
| Async/eventing | PostgreSQL transaction + event_outbox/job_intent; after-commit relay; deterministic BullMQ job; Valkey support; idempotent consumer + reconciliation; no exactly-once claim. |
| Technology stack | Node.js/NestJS/Fastify/strict TypeScript; Drizzle/PostgreSQL; Valkey/BullMQ; REST/OpenAPI/generated client; React Native/Expo; canonical tools in Section 40. |
| Reviews / Claims | Separate Product-quality and Seller-service Reviews; human-reviewed evidence-based Claims; delegated receipt does not transfer Buyer rights. |
| Chat / Chatbot | Buyer-Seller chat and controlled intent classification/templates; authoritative commerce data; operational and identity-stripped NLU data separate. |
| Attribution / Analytics | Scene revision/tag/impression lineage; canonical payment/Order outcomes observed, never created by analytics. |
| Commercial packaging | Transaction surcharge closed; Seller plans/prices, advertising, public packaging and broader portfolio separately managed/open. |
| Roadmap | Overall roadmap open; explicit current MVP decisions govern immediately. |
| Architecture | Modular monolith, managed deployment, owning-domain writes; extract physically only for measured need. |
| Deferred capabilities | Similar Finds, Complete the Scene, richer native media, creator/affiliate marketplace, public Courier bidding/advanced pricing and premature distributed/ML infrastructure. |

## 61. Appendix - Amended Cross-Domain Acceptance Specifications

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

## 62. Glossary

Definitions are specific to the current Adulis baseline. This is the final section of the document.

| Term | Definition |
| --- | --- |
| Account | Ordinary Adulis identity used for Buyer, Seller-owner/team and Courier relationships after the required eligibility/data is completed. It is distinct from an Operator Account. |
| Allowed Action | A backend-authorized atomic operation for the authenticated principal, current object state, tenant scope and permitted application surface; a visible button alone grants nothing. |
| Buyer | The ordinary Account relationship that discovers Products, checks out and owns its Orders, refund/Claim/Review rights and authenticated durable saves. |
| Buyer Home | Primary mobile discovery container with For You, Following, Nearby, Discounts and Locally Made launch tabs. |
| Checkout | The Buyer's purchase intent and current quote for selected Seller Products/Variants, quantities and fulfilment before provider payment. |
| Checkout Surcharge | Adulis's versioned launch-disabled zero Buyer-side transaction surcharge (0 basis points), calculated on the configured basis currently excluding Courier Delivery charge. |
| Courier | An eligible ordinary Account relationship that performs assignment-scoped delivery; it can relate to multiple Seller Pools while accepting only one active delivery by MVP default. |
| Courier Delivery Charge | The Seller-defined Buyer charge disclosed before provider payment; it corresponds to the Order-snapshotted Courier compensation in current MVP. |
| Courier Pool | A Seller's standing private set of Courier relationships, administered separately from individual Order delivery assignment. |
| Cross-Seller Courier Network | Current MVP Phase 2 Courier request/assignment network across Sellers; backend/Fulfilment-owned, with private Seller relationships and assignment-scoped access. |
| Delegated Recipient | One person the Buyer authorizes under Order/Handoff policy to receive goods; receipt does not transfer Buyer ownership, refund, Claim or Review rights. |
| FYP | For You feed: the default algorithmic Buyer Home tab, containing only eligible PUBLIC image-led Scene Posts and server-owned impression lineage. |
| Handoff | Connected, server-accepted evidence of goods/custody transfer using QR primarily, OTP as fallback or Manual Verification for emergency recovery; giver displays and recipient scans. |
| Inventory | The owning commerce domain for current Product/Variant stock and availability; neither Scene content nor a Collection can freeze or replace it. |
| Market | The configured operating context governing eligibility, locality, labels and relevant commerce/provider policy; country-specific assumptions are not hard-coded globally. |
| Operator Account | Separately provisioned privileged internal security principal for authorized Adulis staff, using the Operator authentication path and Console; not an ordinary Account upgrade. |
| Order | A Seller-scoped commercial transaction with snapshotted facts and separate operational/financial state; Buyer multi-cart can group several Seller Orders. |
| PostgreSQL Canonical Truth | Owning-domain transactional business state persisted in PostgreSQL; clients, Valkey, queues, projections and analytics cannot override it. |
| Private | Scene visibility that excludes all Buyer public discovery/direct-link/Collection rendering while retaining authorized owning-Seller management access; it is not archival. |
| Product Post | Structured representation of exactly one sellable Product, resolving identity, Variants, price, availability, Seller and purchase actions through Catalogue/Inventory. |
| Public | Scene visibility permitting Buyer resolution only while current Seller, Market, Product, content, media and Moderation eligibility also pass. |
| REBUILDING | Public Trust label for a formerly ESTABLISHED/TRUSTED Seller that falls below ESTABLISHED; distinguishes recovery from a never-promoted NEW Seller. |
| Scene Post | Seller-authored image-led commerce/discovery content presenting one or more same-Seller Product Posts, with relevant tags and optional captions/hotspots; it never owns price, stock or payment truth. |
| Seller | Admitted commerce business relationship/tenant owning its catalogue, content and Seller Orders, subject to Market, authorization and current social-commerce admission policy. |
| Seller Companion | Authorized mobile Seller surface for monitoring, communication, response and urgent operations; deep administration remains in the Console. |
| Seller Console | Seller business-management surface for creation, configuration, management and administration under server-enforced scope/surface permissions. |
| Seller Team Membership | The relationship assigning one ordinary Account permitted roles in one Seller team; at most one non-terminal membership per Account in MVP, with multiple roles allowed. |
| Step-Up Authentication | Additional purpose-bound authentication required by the sensitive-action policy before an otherwise authorized high-risk operation. |
| Trust Ladder | Evidence-derived public Seller labels NEW, REBUILDING, ESTABLISHED and TRUSTED; promotion/demotion is domain-owned and never bought or used to limit listings. |
| Transactional Outbox | PostgreSQL event_outbox records written atomically with a business transaction and relayed after commit for durable downstream work without making the queue authoritative. |
| Valkey | Supporting cache/queue datastore for Adulis infrastructure, including BullMQ support; it is never canonical business truth. |
| BullMQ | Adulis's ordinary background-job engine for deterministic jobs, retries and idempotent consumers, fed by after-commit intent/event relay and repaired by reconciliation. |
| Shoppable Post | Superseded term for Scene Post; included only for migration clarity, not a second current content type. |
| Catalogue | Owning domain for structured Product identity, attributes and Variant references used by Product Posts and resolved Scene tags. |
| Claim | Human-adjudicated scoped dispute; upheld eligible Seller fault can support Reviews-owned failure eligibility, never direct Review or money truth. |
| Collection | Authenticated private Buyer grouping of saved Product Posts and whole Scene Posts; no Inventory reservation, price freeze or Checkout state. |
| ESTABLISHED | Trust label promoted from NEW only after all current 60-day, 50-completed-Order, 45-qualifying-scan and health-guard requirements pass. |
| job_intent | Durable intent for background work committed with canonical PostgreSQL state and relayed after commit into deterministic BullMQ processing. |
| Manual Verification | Emergency connected Handoff recovery method accepted by the server under current authorization/evidence rules; it cannot override payment truth. |
| NEW | Trust label for an admitted Seller that has not previously held ESTABLISHED/TRUSTED; it is not a Product listing-count entitlement. |
| Payment Provider / PSP | External payment-service boundary; Chapa is initial. Verified provider transactions inform backend financial truth and any provider-specific KYC remains separate. |
| Qualifying scanned Handoff | A server-validated scan that passes current Trust anti-gaming, timing and evidence rules; not every scan counts toward ladder promotion. |
| TRUSTED | Trust label requiring all current 365-day, 501-completed-Order, 450-qualifying-scan, recent-activity and health-guard requirements. |
| Variant | A structured selectable form of a Product whose current commerce attributes/availability resolve through the owning Catalogue/Inventory domains. |

## 63. Post-October-13 reconciliation — current authority

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
| R-13 — Seller engagement analytics grouping | The 13 October Analytics design provides event/attribution architecture but not the final Seller-facing metric grouping. | Scene Performance prioritizes commerce outcomes (Explore opens, Product-detail visits, Seller inquiries, Orders initiated, verified completed Orders) before engagement counts (views, hotspot taps, Likes, Saves, Shares). Product Performance includes views, Saves, Product rating, inquiries and Order outcomes. Seller Reputation keeps Seller rating, Product ratings, verified completed Orders, service quality and Trust separate. Do not blend popularity and Trust into one score. | PR-007, 27 Oct 2026 |
| R-14 — Courier compensation source and immutable Order snapshot | The 13 October Fulfilment/Order/Finance designs already treat delivery charge as Seller-defined, shown before payment and snapshotted on the Order. | There is no per-Courier-relationship compensation schedule in the current MVP. One Seller-level Courier Delivery term applies to future Checkout quotes. Once the Buyer accepts/pays, the Order’s Courier Delivery/compensation amount is immutable history. Delivery Offers, Seller selection surfaces and Courier Mode display the Order snapshot. Changing Seller terms affects future quotes only. | PR-008 correction, 27 Oct 2026 |
| R-15 — Courier offer eligibility and sequence | The 13 October designs already require Courier acceptance and one active accepted delivery. | A direct Delivery Offer may be sent only to a Courier who is in the Seller’s Approved pool relationship, Adulis-verified, AVAILABLE and has no active accepted delivery. BUSY Couriers may remain visible for context but are disabled with reason. UNAVAILABLE, restricted, pending, removed or non-approved Couriers are ineligible. Seller request/offer never equals assignment; Courier acceptance atomically rechecks eligibility/capacity. Mark Ready precedes offer. Offer timing must respect the one-active-delivery rule. | PR-008 correction, 27 Oct 2026 |
| R-16 — Company Website public-copy refinements | The 13 October Website/Finance designs already hold the corrected launch financial model. | Public Website copy must not promise a 0.5% Adulis transaction fee. It uses Buyer-facing Product/Scene language and shared authoritative report/deletion policy. Removing decorative warning/report icons must not remove role=status/role=alert semantics. Seller public location copy must not imply a mandatory physical storefront when only operating area/collection point is available. | PR-001 + Oct 15 corrections |
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
