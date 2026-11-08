# Adulis Moderation & Abuse
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R01, R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-MOD-01_Adulis_Moderation_Abuse_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Executive Summary

Adulis Moderation protects buyers, sellers, couriers, content integrity and marketplace reliability without becoming a second implementation of Catalogue, Content, Payments, Orders, Trust, Claims or Authentication. Reports, automated signals and Operator investigations converge into a versioned Moderation Case. A human-authorized decision creates immutable moderation events and current enforcement projections.

The current content system has two Seller publishing formats: Product Posts and Scene Posts. Moderation targets these canonical objects directly. A Scene Post may tag same-Seller Product Posts; FYP displays only eligible Scene Posts. Product Posts are never treated as top-level FYP units.

Commerce is provider-based. Moderation reacts to normalized payment and Order facts from the Finance/Order domains. It never asks a Seller to confirm payment and never treats screenshots or client telemetry as payment truth. Safety Suspension blocks new commerce immediately while existing paid or payment-in-progress Orders follow explicit, idempotent per-Order handling.

• All app moderation actions are connected-only and server-authoritative.

• Removed content cannot reappear through stale FYP/Search/Storefront/Collection caches.

• Content enforcement is distinct from physical data deletion so evidence can survive legitimate retention/Claim holds.

• Valkey is ephemeral only; loss of Valkey cannot erase reports, cases, decisions or enforcement.

Current public targets are Product Posts and Scene Posts. Reports and weak signals remain allegations; durable adverse consequences require authorized policy decisions. No paid tier, Trust level, ad placement or engagement score can override a public restriction.

## 2. Mission

Provide a defensible, privacy-minimized and operationally usable system for reports, abuse signals, case review, evidence, enforcement, appeals and platform-integrity controls across all current Adulis surfaces.

## 3. Core Doctrine

• A report is an allegation, not a verdict.

• A signal is evidence/risk context, not a verdict.

• A moderation case groups related allegations/evidence; it does not itself change public state.

• A durable decision is tied to a policy version, actor, case and reason.

• Current enforcement is a projection of immutable moderation history.

• Canonical source domains execute their own legal state changes after moderation commands/events.

• High-impact action fails closed when required evidence or authorization cannot be established.

## 4. Current Product Context

Current commerce follows Seller Cart -> Checkout -> PSP/backend-verified payment -> one Seller Order -> Fulfilment -> accepted final Buyer/delegate Handoff. Seller never confirms Buyer payment. Connected QR is primary, OTP fallback and Manual Verification recovery; Pickup is Seller-displays/Courier-scans and final Delivery is Courier-displays/Buyer-or-authorized-delegate-scans. A delegate may receive goods but never inherits Buyer Review, Claim or refund rights. Exactly two best-effort foreground Pickup/Delivery location checkpoints are supporting evidence, not custody proof or continuous GPS.

Marketplace Search launches with PRODUCT_POST, SELLER and SCENE_POST. Scene eligibility is current PUBLIC plus Seller/Market/Moderation/media/tag availability gates; PostgreSQL + pg_trgm and bounded derived projections remain the baseline. FYP top-level units are image/photo Scene Posts only. Product Posts remain Product-detail, tag, Shop and Search commerce destinations. Buyer Home retains For You (default), Following, Nearby, Discounts and Locally Made; none bypasses public eligibility. Ranking follows hard gates and belongs to Search/Recommendation, never this domain.

![Policy decisions and source-domain consequences](graphics/MOD_01.svg)
*Figure 01. Policy decisions and source-domain consequences. Reports and exact evidence enter a case; separate Operator authority produces immutable enforcement; owning domains execute downstream effects without surrendering their truth.*

## 5. System Boundaries

Moderation owns policy interpretation and enforcement decisions. Source domains remain authoritative for the object being moderated and for all transaction/custody facts.

| Question | Owner |
| --- | --- |
| Is this content/account behavior policy-violating? | Moderation |
| Is Product/Variant/stock valid now? | Catalogue / Inventory |
| Is Scene Post published/archived? | Content lifecycle |
| Is payment successful/refunded/settled? | Finance / PSP adapter |
| May Order transition? | Order |
| Was physical transfer verified? | Handoff Verification |
| What transaction remedy applies? | Claims |
| What is Seller/Courier reputation? | Trust / reputation owner |
| Who may perform this Operator action? | Auth / Operator authorization |

## 6. Domain Ownership

• Reports and report history.

• Moderation policy versions, reasons and decision definitions.

• Moderation signals and cases.

• Review queue/leases/priority.

• Evidence snapshots and evidence-access audit.

• Immutable moderation events.

• Current enforcement projections and seller/account safety restrictions.

• Appeals and restoration history.

• Abuse investigations and moderation operational metrics.

## 7. Non-Ownership

• Product/Variant price or inventory quantity.

• Scene Post canonical content revision.

• Payment provider state, Buyer total, refund or Seller settlement.

• Order state or Checkout allocation mutations.

• Handoff credentials or physical custody truth.

• Claim adjudication/remedy.

• Review creation eligibility or rating arithmetic.

• Trust Level computation.

• Seller social-account verification.

• FYP rank score or personalization weights.

## 8. Actors

One ordinary human uses one stable ordinary Adulis Account across Buyer capability, Seller ownership, Seller-team participation and a persistent Courier profile. Different humans use different Accounts and never share credentials. Ownership, team membership and Courier relationships are independent; a team Account may have multiple active roles whose current permissions compose within the exact Seller scope.

At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the ordinary Account's team slot. Seller ownership and many private Seller-Courier Pool relationships do not consume that slot. Switching Buyer/Seller/Courier Mode changes presentation and current context, never identity or authority.

Operator Account is a separately provisioned privileged internal principal. A person may also hold an ordinary Account, but credentials, sessions, strong authentication, recovery, revocation and audit identity remain independent. Ordinary Account OTP, Seller roles, public registration and Mode switching never create Operator authority.

Privileged workflows require an isolated OPERATOR session, current explicit capability, exact resource/Market/case scope, strong authentication and freshness, plus approval when the existing Founder/Staff governance requires it. Restricted evidence needs its own current capability and case/purpose authorization; ADMIN supplies no universal bypass. Record operator_account_id, capability, policy, case/version, reason, request/time and applicable approval context. No impersonation or direct generic domain-state setter is introduced.

| Actor | Moderation relationship |
| --- | --- |
| Buyer capability | Report visible content/users; safe case outcomes and personal blocking |
| Seller Owner / team member | Read permitted Seller status; respond/appeal within current role-union permissions |
| Courier profile | Report unsafe participants; platform safety separate from Seller Pool decisions |
| Separate Operator Account | Case claim/read/decision/evidence/appeal only through current narrow capabilities |
| Source-domain services | Produce bounded canonical facts and consume authorized enforcement events |
| Automated detector | Produce signals or explicitly bounded containment; weak heuristic never permanently bans |

## 9. Canonical Moderation Targets

Current user-reportable kinds are SELLER, PRODUCT_POST, SCENE_POST, REVIEW, MESSAGE, SELLER_PROFILE, COURIER_PROFILE and ACCOUNT. Internal case context can include MEDIA_ASSET, TIKTOK_EMBED_REFERENCE, ORDER_REF, DELIVERY_REF and HANDOFF_REF under restricted capability/case-purpose controls.

Report the visible Product or Scene rather than an opaque storage object. Scene identity, revision identity and evidence context are explicit typed references. Order/Delivery/Handoff references support investigation without making Moderation the Claims or custody domain.

## 10. Product Post Moderation

• Product Post can be reported for prohibited goods, deceptive description, counterfeit allegation, unsafe content, impersonation, spam or other versioned policy reasons.

• Enforcement can RESTRICT or REMOVE public visibility/purchase eligibility while preserving the canonical Product identity and transaction history needed by Orders/Claims.

• Moderation does not edit price, stock or Variant data. Catalogue/Inventory correct structural commerce truth.

• A Product Post removal must invalidate Search, Storefront, Scene-tag composition and any current purchase affordance.

## 11. Scene Post Moderation

Scene Posts are first-class report and enforcement targets. Capture the exact published Scene revision, caption, image/MediaPresentation, tags/hotspots, Seller, Market and observed public state involved in the allegation.

Scene REMOVED or applicable RESTRICTED enforcement denies FYP, launch Search, public Storefront/profile and direct public reads. Saved Collections retain only safe unavailable/tombstone resolution. A Scene decision does not automatically punish every tagged Product; an independent Product decision must identify that Product and policy basis.

Restoration appends a new decision/event and re-evaluates all current public gates; it never deletes the original evidence or decision. Native Seller publishing remains images/text; external TikTok is optional Product-detail integration, not Scene-native video.

## 12. Product Availability Effects

Scene Post / ScenePost / SCENE_POST is the single canonical Seller-authored, image-led discovery object with caption and tagged Product Posts. Product Post is the structured commerce representation of exactly one Product. Scene revisions hold composition and provenance; Catalogue/Inventory own current Product, Variant, price and stock truth.

Initial public publication requires ready authorized images, a valid non-empty caption, at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product, plus every current Seller, Market, Content and Moderation gate. Drafts may be incomplete; zero tags fail PRODUCT_TAG_REQUIRED and all-unavailable tags fail NO_AVAILABLE_TAGGED_PRODUCT.

Last available tagged Product loss keeps publication_state=PUBLISHED and changes visibility=PUBLIC to PRIVATE. Content owns this automatic availability consequence and its reason; no archival, deletion or Moderation decision is inferred. With another available eligible tag, the Scene can remain PUBLIC while unavailable tags resolve safely.

Availability restoration automatically returns a stock-driven PRIVATE Scene to PUBLIC only when all current gates pass. Restock cannot override ARCHIVED state, Seller/Market suspension, a Scene Moderation restriction, unsafe media or another independent block. Seller management retains the Scene with a Private badge, reason and restoration condition.

PRIVATE is denied on FYP, Search, public Storefront/profile, direct links and public/Buyer Collection resolution. Saved membership may remain as a safe unavailable reference; old revisions, captions, images, investigative reasons and private cause details never bypass current visibility. Seller PRIVATE/PUBLIC notices are advisory and cannot create or roll back Scene state.

![Current eligibility runs before every new controlled Scene delivery](graphics/MOD_02.svg)
*Figure 02. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 13. FYP Integration

Marketplace Search launches with PRODUCT_POST, SELLER and SCENE_POST. Scene eligibility is current PUBLIC plus Seller/Market/Moderation/media/tag availability gates; PostgreSQL + pg_trgm and bounded derived projections remain the baseline. FYP top-level units are image/photo Scene Posts only. Product Posts remain Product-detail, tag, Shop and Search commerce destinations. Buyer Home retains For You (default), Following, Nearby, Discounts and Locally Made; none bypasses public eligibility. Ranking follows hard gates and belongs to Search/Recommendation, never this domain.

Apply current Seller/account safety, Market activation, Content visibility, Moderation and available-tag gates before candidate ranking, then recheck current eligibility at response time. Engagement, ads, public Trust and cached features cannot override an independent denial.

Moderation emits enforcement facts, not recommendation multipliers, hidden shadow-ban scores or direct ranking writes. Product removal makes the affected tag non-purchasable; Content independently derives Scene visibility.

![Current eligibility runs before every new controlled Scene delivery](graphics/MOD_03.svg)
*Figure 03. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 14. Search / Storefront / Collections

Launch Search resolves Product Posts, Sellers and Scene Posts through current hard public gates. Public Storefront and direct links consume the same current enforcement and Content contracts. PRIVATE or moderation-ineligible Scenes cannot be served even while projections/CDN purge are delayed.

Collections may retain a Product/whole-Scene membership independently. A removed, restricted, PRIVATE or deleted target resolves as safe unavailable/tombstone; saved revisions support provenance only. No historical caption, image, tag payload or private cause leaks through cached save data.

Search/Storefront/Collections consumers refresh idempotently from outbox events. Current canonical response-time checks fail closed for restricted reads while asynchronous repair catches up.

## 15. TikTok Embed Moderation

Current Adulis video support is limited to an approved TikTok embed on eligible Product Post detail. Adulis does not ingest native Seller video.

• Ownership verification of the TikTok video belongs to the social-integration/Catalogue boundary, not Moderation.

• Moderation can evaluate whether the Product Post/embed use violates Adulis policy and can disable/remove the reference through the owning domain contract.

• External provider unavailability is not a moderation violation.

• Moderation stores bounded embed identifiers/snapshots needed for evidence, never TikTok credentials or private login tokens.

## 16. Report Intake

All report submission requires an Internet connection and successful server acceptance. The app must not display a report as submitted until the backend has persisted it.

• Authenticated reporting uses the caller Account from session; client never supplies reporter identity as authority.

• Public Website reporting may support approved unauthenticated intake with stronger abuse controls and limited target types.

• Use Idempotency-Key or equivalent stable client request identity for retry safety.

• Report body is treated as hostile input: length-bounded, escaped, redacted from ordinary logs and never rendered as raw HTML.

• Reporter does not need ownership of a target.

## 17. Report Reason Policy

• Reason codes are stable machine identifiers and user-facing text is localized separately.

• Reasons are target-aware; a Product reason set need not equal a Message reason set.

• English is the primary policy/source language. Amharic and future locales use reviewed translations without changing reason semantics.

• Public report reasons are not automatically identical to internal enforcement reasons.

## 18. Moderation Policy Versioning

Every durable decision records the effective policy version and decision/reason definition used at decision time. Policy changes do not reinterpret historical decisions.

```
moderation_policy_version
- id / market_id / version
- effective_from / effective_to
- status
```

```
- created_by_operator_account_id / approved_by_operator_account_id
- reason_definition_set
- decision_definition_set
```

## 19. Abuse Taxonomy

| Family | Examples |
| --- | --- |
| Content policy | prohibited goods; explicit/unsafe content; impersonation; stolen content allegation |
| Seller behavior | deceptive pricing; repeated false availability; spam; evasion; abusive communication |
| Buyer behavior | report spam; harassment; Claim/review manipulation attempts |
| Courier behavior | unsafe conduct; assignment abuse; repeated accepted-then-cancelled pattern; false handoff attempts |
| Chat/review | harassment; threats; personal-data exposure; manipulation |
| Platform integrity | synthetic engagement; self-engagement; automated scraping/report abuse; duplicate flooding |

## 20. Moderation Signals

• Signals are append-only observations with source, detector/rule version, target, timestamp and bounded evidence references.

• Signals may originate from Catalogue, Inventory, Analytics, Recommendation, Claims, Reviews, Chat, Fulfilment/Handoff, Auth or security systems.

• A detector confidence band can influence queue priority but cannot silently become a permanent penalty.

• The same underlying incident should consolidate rather than open unlimited duplicate cases.

## 21. Case Model

```
moderation_case
- id / market_id
- primary_target_kind / primary_target_id
- case_type / priority / state
- policy_version_id
- opened_at / due_at
- claimed_by_operator_account_id / lease_expires_at
- case_version
```

```
moderation_case_item
- case_id
- item_kind: REPORT | SIGNAL | TARGET | EVIDENCE_REF
- item_ref / added_at
```

A case is operational work context. Current enforcement derives from immutable decisions/events, not from a mutable case status alone.

## 22. Queue and Priority

• Queue items have explicit due_at, priority and short review leases.

• Priority can consider safety severity, transaction exposure, number of independent reporters, current public reach and repeated-pattern evidence.

• High engagement alone must not reduce scrutiny or override policy.

• Leases expire safely if an Operator leaves; stale decisions use optimistic case_version and return conflict.

## 23. Evidence Snapshots

• Snapshot exact content revision, Product fields, public Seller context and relevant policy-visible state at report/decision time.

• Keep evidence minimal; do not clone entire domain rows into Moderation.

• Store hashes/immutable references to Media evidence where needed.

• For payment/Order/Handoff/Courier facts, consume safe canonical summaries or evidence references from the owning domain.

• Every access to restricted evidence is audited with operator, purpose/case and timestamp.

For Scene evidence, preserve scene_post_id, published_revision_id, caption, MediaPresentation/image references, Product tags/hotspots, Seller/Market and visibility observed at report time. Investigation access to later PRIVATE state is separately authorized and audited; snapshots never restore public access.

## 24. Media Evidence

• Public removal and private evidence preservation are separate operations.

• Media can be quarantined/private for a valid moderation/Claim hold while public CDN paths are purged/inaccessible.

• R2/CDN/Sharp remain Media infrastructure; Moderation stores references and enforcement/evidence metadata, not duplicate image processing pipelines.

• No native video evidence pipeline is required for current Seller content.

## 25. Enforcement Model

Use immutable moderation events plus a current projection. Recommended public-impact states:

```
NONE
RESTRICTED
REMOVED
```

RESTRICTED is policy-specific and must define exact effects. REMOVED means the target is unavailable on public/discovery surfaces covered by that enforcement. Permanent account/seller safety actions use dedicated safety state rather than overloading content visibility.

Enforcement NONE / RESTRICTED / REMOVED is independent of Content publication_state DRAFT / PUBLISHED / ARCHIVED and visibility PUBLIC / PRIVATE. Record cause and decision lineage in the owning domain; availability-driven PRIVATE does not create a Moderation event.

## 26. Public Visibility

Effective public access requires source publication eligibility AND current Content visibility=PUBLIC AND current Seller/account safety AND Market eligibility AND Moderation eligibility. These remain separate state dimensions; PUBLISHED/PUBLIC at source does not override REMOVED enforcement.

Do not store a generic recommendation_eligible flag or ranking score in Moderation. Restored enforcement permits a public read only if every other gate passes. Safe user reason classes exclude private investigative notes and unproven allegations.

![Current eligibility runs before every new controlled Scene delivery](graphics/MOD_04.svg)
*Figure 04. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 27. Appeals and Restoration

• Appeal is a new record linked to the decision/event; it never edits or deletes the original event.

• Appeal can be submitted only by an authorized affected party under Auth/Seller scope rules.

• Restoration is another immutable moderation event with actor, case, policy and rationale.

• Evidence retention may outlive public restoration according to Privacy/Claims/legal holds.

## 28. Blocking

• User block is a personal safety/preference relationship, not a global moderation verdict.

• Blocking can suppress interaction/content exposure according to product rules but cannot erase Orders, Claims, Reviews or Handoff history.

• Seller blocking, if enabled, affects the blocking user experience only unless a separate platform moderation action exists.

• Block state is enforced server-side; changing client parameters cannot bypass it.

## 29. Seller Safety Suspension

Seller Safety Suspension is the principal platform-level Seller moderation control. It immediately blocks forward-looking Seller commerce/content actions defined by policy while preserving a controlled path for already-created Orders, Claims, appeals and required historical access.

• No new checkout/payment attempt may be initiated for a safety-suspended Seller.

• New publication and new FYP eligibility are blocked according to policy.

• Existing Orders receive an explicit moderation_order_action rather than being handled by a blanket client rule.

• Lifting suspension does not erase the suspension or per-Order decision history.

Seller Safety Suspension blocks new risky Checkout/payment attempts, new publication and public discovery immediately through owning-domain gates. Existing paid or reconciliation-sensitive Seller Orders retain historical access and Buyer financial/Claim/refund/appeal rights; record per-Order CONTINUE or TERMINATE explicitly and idempotently. Moderation never mutates payment allocations, paid snapshots or accepted Handoff facts directly.

## 30. Commerce-State Integration

Moderation consumes the current PSP/provider commerce model. The authoritative lifecycle is Checkout/payment attempt -> provider verification/reconciliation -> one-Seller Order payment state -> Fulfilment/Handoff.

Moderation never accepts Seller confirmation or buyer-uploaded payment proof as canonical payment success. Provider-normalized server facts determine whether an Order is unpaid, paid or still in a reconciliation-sensitive state.

## 31. Payment-State Rules

| Commerce state at enforcement | Moderation orchestration |
| --- | --- |
| Durably fenced uninitiated attempt / confirmed release-finality evidence | Order/Checkout invokes ORDER §35/46; locked current-generation/evidence check releases once only when safe |
| Provider attempt pending without ambiguous external result | Stop new progression; Order/Finance determine legal cancellation/reconciliation behavior |
| Provider result ambiguous / reconciliation required | Treat conservatively; do not destroy state; freeze risky progression and route through Finance/Claim policy |
| Provider-verified PAID | Per-Order CONTINUE or TERMINATE policy; termination must preserve Buyer financial rights and invoke Claim/refund workflow as appropriate |
| Completed Handoff/Order | Historical fact remains; future Seller restriction does not rewrite completion |

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

## 32. Checkout Allocation Handling

Any short-lived stock protection attached to an active provider payment attempt is owned by Checkout/Inventory. Moderation must never mutate it directly.

• When an unpaid flow is legally terminated, Order/Checkout releases the allocation idempotently.

• If payment outcome is ambiguous, allocation handling follows the bounded reconciliation policy of Order/Inventory.

• A worker retry cannot release stock twice or consume stock twice.

## 33. Fulfilment and Handoff

• Moderation may restrict Seller/Courier/Account future activity but Handoff Verification owns physical transfer truth.

• Verified Pickup/Delivery Handoffs are immutable evidence and cannot be fabricated or deleted by a moderator.

• QR/OTP/Manual Handoff details are exposed only as bounded evidence summaries to authorized Operators.

• Only server-accepted online Handoff outcomes count.

• Checkpoint location evidence can support an investigation but does not itself prove custody or delivery.

Current commerce follows Seller Cart -> Checkout -> PSP/backend-verified payment -> one Seller Order -> Fulfilment -> accepted final Buyer/delegate Handoff. Seller never confirms Buyer payment. Connected QR is primary, OTP fallback and Manual Verification recovery; Pickup is Seller-displays/Courier-scans and final Delivery is Courier-displays/Buyer-or-authorized-delegate-scans. A delegate may receive goods but never inherits Buyer Review, Claim or refund rights. Exactly two best-effort foreground Pickup/Delivery location checkpoints are supporting evidence, not custody proof or continuous GPS.

## 34. Courier Abuse and Safety

Courier is a first-class Adulis role with a global identity and many Seller-pool relationships. Moderation distinguishes Seller-level pool management from platform-level safety enforcement.

• Seller APPROVE/SUSPEND/REMOVE inside one private Courier pool is not automatically a platform moderation verdict.

• Platform-level Courier restriction may block new pool joins, job acceptance and Handoff participation through Fulfilment/Auth contracts.

• A Courier restriction with Seller A does not automatically alter Seller B relationship unless the action is platform-wide.

• Abuse signals can include repeated assignment cancellation, reported unsafe behavior, Handoff manipulation attempts and validated Claim patterns.

• No continuous GPS trail exists in the current MVP; investigations use only approved checkpoint evidence and other canonical records.

## 35. Claims Boundary

Claims answer what happened in a specific commercial transaction and what remedy is appropriate. Moderation answers whether content/behavior violates platform policy. The same incident can create both without sharing ownership.

```
Counterfeit allegation
  -> CLAIM: specific Order evidence + remedy
  -> MODERATION: Product/Seller policy review
```

```
Claim outcome may become a moderation signal.
Moderation cannot adjudicate the Claim.
```

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

## 36. Trust Boundary

• Trust consumes canonical moderation outcomes where the Trust design permits.

• Moderation cannot set Trust Level directly.

• A report count alone is not Trust evidence; unresolved allegations are weak signals.

• Restoration/appeal outcomes must be distinguishable from upheld enforcement so Trust can interpret evidence correctly.

Public Trust names are NEW, REBUILDING, ESTABLISHED and TRUSTED. Trust computes levels deterministically from canonical evidence; Moderation only emits confirmed outcomes/exclusions. Report volume and a Scene stock-private transition do not set level. Confirmed fabricated evidence produces append-only invalidation and Trust recomputation, never a Moderator-selected level or Product listing cap.

## 37. Reviews

• Sellers cannot remove negative Reviews by reporting them.

• Review removal requires an actual moderation decision under policy, independent of sentiment.

• Review manipulation can create signals/cases; Reviews domain remains owner of Review eligibility and rating aggregation.

• Historical eligible review evidence remains governed by Reviews/Privacy after moderation state changes.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

## 38. Chat and Message Moderation

• A user reports a specific Message/conversation context; general moderators do not receive unrestricted Seller Inbox access.

• Expand conversation context only when authorized and necessary for the case.

• Private message bodies are never copied into general analytics or logs.

• Harassment/threat/personal-data policy can produce message/account enforcement independently from Order/Claim rights.

## 39. Seller Verification Boundary

Current platform Seller admission/Trust does not require or store Government-ID, passport, national-ID, selfie-to-ID or biometric identity evidence. Approved social-account control/business admission belongs to Onboarding/Verification. Provider-owned PSP KYC remains a separate provider boundary; it is not a platform identity-document evidence store. A future formal requirement needs explicit versioned product/privacy/provider approval.

TikTok/Instagram account connection and controlled fallback belong to Seller Onboarding/Verification. Consume only necessary safe method/status or match outcomes; no social login token, verification code or private social message is copied into general case data. Impersonation/evasion may request re-verification through the owning service.

## 40. Account Evasion

• Signals may include repeated Seller recreation after platform enforcement, reused prohibited content, linked security/device abuse patterns where legally approved, and safe social-verification relationship signals.

• Moderation receives match/outcome signals, not secret authentication material.

• Similarity is a signal, not proof; do not automatically ban a new Seller because a product image resembles removed content.

• Platform enforcement across linked Accounts requires explicit policy, human review and auditable evidence.

## 41. Algorithm and FYP Abuse

Recommendation integrity is protected without giving Moderation control over ranking weights.

• Invalid/synthetic engagement can be excluded from ranking inputs as data-quality enforcement.

• Seller/account enforcement eligibility is a hard Recommendation gate.

• No hidden visibility multiplier is used as an unreviewable punishment.

• FYP anti-spam/diversification remains Recommendation-owned; Moderation supplies canonical restrictions and abuse signals.

## 42. Synthetic Engagement

• Self-engagement, bot-like velocity, repeated device/account patterns and impossible interaction sequences are signals.

• Use qualified impressions, Product opens, legitimate saves, provider-verified paid Orders and completed Handoffs as stronger downstream evidence than raw view/tap volume.

• Detector version and invalidation rule version are recorded.

• Weak heuristic alone cannot create a permanent Seller/account ban.

## 43. Deceptive Commerce Signals

• Price churn, unavailable bait Variants, repeated misleading captions and repeated stock mismatch may create moderation signals.

• Catalogue/Inventory remain authoritative for price/stock correction.

• Analytics/Claims may provide pattern evidence; Moderation decides policy intent/repetition where applicable.

• A one-off stale cache is an operational defect, not automatically Seller misconduct.

## 44. Spam and Duplicate Content

• Media/Catalogue enforce upload/file validity and rate controls; Moderation handles broader abuse patterns.

• Exact asset digest, repeated metadata and rapid submissions can surface candidates for review.

• Perceptual image matching remains future capability until measured need.

• Duplicate Product or Scene content alone is not proof of infringement or malicious abuse.

## 45. Operator Authorization

Operator Account is a separately provisioned privileged internal principal. A person may also hold an ordinary Account, but credentials, sessions, strong authentication, recovery, revocation and audit identity remain independent. Ordinary Account OTP, Seller roles, public registration and Mode switching never create Operator authority.

Privileged workflows require an isolated OPERATOR session, current explicit capability, exact resource/Market/case scope, strong authentication and freshness, plus approval when the existing Founder/Staff governance requires it. Restricted evidence needs its own current capability and case/purpose authorization; ADMIN supplies no universal bypass. Record operator_account_id, capability, policy, case/version, reason, request/time and applicable approval context. No impersonation or direct generic domain-state setter is introduced.

A case lease creates work continuity, never authority. Check capability revocation and case_version on every effect command. Example domain capabilities are MODERATION_CASE_READ, MODERATION_CASE_CLAIM, MODERATION_DECIDE_CONTENT, MODERATION_DECIDE_ACCOUNT_SAFETY, MODERATION_EVIDENCE_READ and MODERATION_APPEAL_REVIEW, mapped to the approved Operator taxonomy rather than a universal ADMIN role.

Consume existing Founder/Staff approval and Solo Coverage rules where applicable. No fabricated second-person/self-approval record is created; exact decision payload and approval context must remain reviewable.

![Ordinary relationships and privileged authority are independent](graphics/MOD_05.svg)
*Figure 05. Ordinary relationships and privileged authority are independent. The same human may possess both principals, but session, credential, recovery, scope and audit do not cross from an ordinary Account to an Operator Account.*

## 46. Seller-Team Boundary

One ordinary human uses one stable ordinary Adulis Account across Buyer capability, Seller ownership, Seller-team participation and a persistent Courier profile. Different humans use different Accounts and never share credentials. Ownership, team membership and Courier relationships are independent; a team Account may have multiple active roles whose current permissions compose within the exact Seller scope.

At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the ordinary Account's team slot. Seller ownership and many private Seller-Courier Pool relationships do not consume that slot. Switching Buyer/Seller/Courier Mode changes presentation and current context, never identity or authority.

Seller OWNER/ADMIN and specialist permissions allow only scoped Seller status, responses and appeals already authorized by Auth. Role union never grants Moderation decision capability, reporter identity or private case notes. Ownership/team/Courier relationships stay outside the Moderation identity model.

## 47. API Contracts

```
POST /v1/reports
GET  /v1/reports/mine
POST /v1/blocks
DELETE /v1/blocks/{target}
```

```
GET  /v1/operator/moderation/work
GET  /v1/operator/moderation/cases/{caseId}
POST /v1/operator/moderation/cases/{caseId}/claim
POST /v1/operator/moderation/cases/{caseId}/release
POST /v1/operator/moderation/cases/{caseId}/decision
POST /v1/operator/moderation/targets/{kind}/{id}/restrict
POST /v1/operator/moderation/targets/{kind}/{id}/remove
POST /v1/operator/moderation/targets/{kind}/{id}/restore
POST /v1/operator/moderation/appeals
```

Exact paths may be versioned during implementation, but resource ownership, server authorization, idempotency and case-linked effect commands are mandatory.

Report/enforcement target enums and OpenAPI contracts use SCENE_POST and scene_post_id / published_revision_id. All /v1/operator/moderation commands require a separate Operator principal, current capability and case-version preconditions; ordinary MOBILE/CONSOLE sessions are denied.

## 48. Data Model

| Entity | Purpose |
| --- | --- |
| moderation_policy_version | Effective Market policy and definition set |
| moderation_reason_definition | Stable reason code + target applicability + public/internal presentation |
| moderation_signal | Append-only risk/abuse observation |
| content_report | Reporter allegation and safe text |
| moderation_case | Operational investigation container |
| moderation_case_item | Reports/signals/targets/evidence refs |
| moderation_evidence_snapshot | Bounded immutable evidence snapshot |

| Entity | Purpose |
| --- | --- |
| moderation_event | Immutable decision/action history |
| moderation_enforcement | Current target enforcement projection |
| moderation_appeal | Appeal and resolution history |
| moderation_order_action | Per-Order CONTINUE/TERMINATE policy for Seller safety cases |
| block | Personal user blocking relationship |

Privileged actor references use operator_account_id FKs: policy created/approved actors, case claimant, decision maker, appeal reviewer and evidence-access actor. Ordinary reporter_account_id / affected account references remain ordinary Account FKs. Do not place either principal into an unchecked polymorphic actor ID.

## 49. Events and Outbox

• Effect-producing decisions commit moderation_event + enforcement projection + transactional outbox atomically.

• Consumers include Recommendation, Search, Storefront, Content/Catalogue, Media, Auth, Trust, Notifications, Order/Claims and Analytics as applicable.

• Consumers are idempotent using stable event IDs/version.

• Queue or consumer failure cannot roll back the already-committed moderation decision; reconciliation catches stale projections.

CONTENT_RESTRICTED, CONTENT_RESTORED, SELLER_SAFETY_ACTION and APPEAL_UPDATE notification policy consumes committed canonical events through outbox/BullMQ. No Expo/SMS provider call runs inside the enforcement transaction. Scene availability events originate in Content and are never mislabeled as moderation restrictions.

| Registry entry | Versioned contract / scope / execution |
| --- | --- |
| scene_post.published v1 / Content | MARKET; Scene/Seller/Market/published_revision, aggregate_revision, logical_effect_id; consumers REC/SRC/Storefront/Media/Analytics; current eligibility re-read. |
| scene_post.visibility_changed v1 / Content | MARKET; same scope plus previous_visibility/current_visibility, reason, revision/effect; public consumers and one Seller advisory notice. |
| inventory.changed v1 / Inventory | MARKET; Product/Variant/Seller/Market/stock_revision/effect; Content and commerce eligibility readers. |
| account.created / account.deletion_requested / Accounts-Privacy | GLOBAL; exact ordinary Account, schema version/effect and optional validated origin; no fabricated Account owner Market. |
| claim.decision_recorded / Claims | MARKET; structured seller_fault/severity/remedy deadline/resolution/decision/correction fact; Trust/Reviews/Finance/Analytics. |
| handoff.verified / Handoff | MARKET; immutable stage/method/recipient/assignment/generation/evidence; qualifying final DELIVERY receipt-based Reviews; independent Orders/Trust filters, never PICKUP feedback. |
| review.eligibility_changed / Reviews | MARKET; one Order/Buyer eligibility basis/state/version with restricted evidence references; safe prompts/projections; no client/raw case body. |
| handoff.delegate_invitation / Handoff job intent | MARKET; authorization/generation/contact-purpose/expiry/effect; existing SMS adapter, not an ordinary Notification event. |

The complete event/schema authority is EVT §35 / Contract_Registry, and this table is the local contract subset. Claim corrections and verified remedy completion update truthful existing notifications/projections; Review eligibility changes act once on committed state, including revocation. handoff.delegate_invitation stays in job_intents/intent_version and cannot enter the ordinary Notification event parser.

## 50. Valkey and Cache Semantics

Valkey is the only current distributed cache/queue datastore name.

• Use Valkey for BullMQ backing, bounded case-work coordination, rate-limit counters and non-canonical enforcement/read caches where useful.

• Never store the only copy of a report, case, decision, enforcement or appeal in Valkey.

• Canonical authorization/public reads revalidate PostgreSQL/domain state where stale cache could expose removed content.

• Cache keys are bounded and tenant/Market aware; no raw report body or sensitive evidence in cache keys.

## 51. Failure Behavior

| Failure | Required behavior |
| --- | --- |
| Valkey/BullMQ unavailable | Persist synchronous reports/decisions in PostgreSQL where possible; async side effects delayed/reconciled |
| Recommendation unavailable | Moderation decision still commits; Recommendation catches up from outbox/reconciliation |
| CDN purge fails | Canonical reads deny content; retry purge and alert |
| Media quarantine fails | Fail closed for public removal path if unsafe media could remain reachable; retry/alert |
| Finance/Order unavailable during safety action | Seller forward-looking restriction commits; affected Order actions remain pending/idempotent |
| Claims unavailable for paid termination | Do not erase Order/payment; retry SYSTEM Claim/remedy orchestration |
| Trust unavailable | Moderation commits; Trust catches up from canonical event |
| Operator capability revoked | Effect command denied immediately even if case screen was already open |
| Client loses Internet | No false success; report/appeal/decision remains unsubmitted until server confirms |

## 52. Retention and Deletion

• Retention classes are declared with Privacy/Data Lifecycle, not hard-coded independently in Moderation.

• Reports/cases/evidence may be retained longer when needed for active Claim, appeal, fraud/security, policy/legal hold or enforcement history.

• Public removal does not imply immediate evidence destruction.

• Account deletion removes/anonymizes direct linkage where permitted while preserving legally/operationally required immutable moderation history.

• Delayed queue/event replay must not rehydrate deleted personal linkage.

## 53. Privacy

• Reporter identity is private from the reported party by default.

• Seller analytics/moderation status never exposes Buyer identity unnecessarily.

• Evidence access is purpose/case bound and audited.

• Do not copy payment credentials, social login tokens, Handoff secret material or full Chat histories into general cases.

• Location evidence is limited to approved fulfilment checkpoint records and only exposed when necessary.

## 54. Security

• Treat report text, captions, messages, external embed metadata and evidence filenames as hostile input.

• Use @nestjs/throttler/rate controls for report/block/public intake abuse.

• Use @fastify/helmet/CSP controls on Operator and public web surfaces.

• No raw HTML from reports/evidence.

• Effect APIs require server-derived actor, scope, Operator Account capability and Step-Up/approval where configured.

• Prevent IDOR through target-scope validation and safe 404/denial semantics.

• Sentry/Pino redaction forbids sensitive evidence bodies by default.

Separate Operator strong-authentication/session boundary and evidence-purpose audit are required at every privileged read/effect endpoint. Ordinary Account recovery, stale role caches and Seller ADMIN never authorize restricted evidence.

## 55. Localization

• Policy/reason identifiers are locale-neutral.

• English is the primary/source language for current product and policy copy.

• Amharic translation is founder-reviewed for current Ethiopia support.

• Future language teams can add reviewed locale resources without changing decision codes or database enums.

• Whole-sentence localized notices are used; no concatenated fragments that produce misleading legal/safety text.

## 56. Analytics and Metrics

• Measure reports per target/reason, time-to-first-review, time-to-decision, appeal rate/uphold/restore rate, repeat abuse, detector precision/false-positive indicators and cache-removal effectiveness.

• Marketplace integrity metrics may join server facts such as paid/completed Orders, Claims and Handoffs but cannot redefine them.

• Reporter-quality analytics must not punish unsuccessful reporters automatically.

• Seller dashboards receive only safe moderation status/aggregate information, never reporter identities or private evidence.

## 57. Observability

• Sentry for exceptions/release context with redaction.

• Pino structured logs with request/correlation/case/event IDs, not report/evidence bodies.

• pg_stat_statements for queue/case/enforcement query performance.

• Valkey/BullMQ health: queue age, retries, dead jobs and reconciliation lag.

• Cloudflare/R2 purge/quarantine failures are alerted.

• Operational dashboards track overdue work, pending Order actions, failed notifications and stale public-surface enforcement.

Alert on stale separate-Operator authorization, unsafe PRIVATE Scene delivery, lost case-version preconditions, evidence-access audit failures and divergence between canonical enforcement and public projections.

## 58. Performance and Cost

• PostgreSQL indexes cover active queue state, target enforcement, case consolidation and event chronology.

• Do not create one BullMQ job per ordinary impression or content view.

• Batch/reconcile downstream invalidations by target/event where safe.

• Avoid unbounded full-table scans in moderation dashboards.

• Use CDN purge selectively rather than global cache flush for each decision.

• Scale operational workers horizontally only after measured queue demand.

## 59. Technology Stack

| Layer | Current Adulis baseline / Moderation use |
| --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript - APIs, case services, policy resolvers |
| Persistence | PostgreSQL; Drizzle ORM - canonical cases/events/enforcement/audit |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements - bounded search/config constraints/performance |
| Async/cache | Valkey; BullMQ - queues, retries, ephemeral caches/rate coordination |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript clients |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js where shared phone normalization applies |
| Media | Cloudflare R2; Cloudflare CDN; Sharp - owned by Media; moderation integrates quarantine/purge |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; Expo SecureStore; Expo Camera; Expo Notifications; Expo Updates; small Zustand store |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 |
| Observability | Sentry; Pino; pg_stat_statements |
| Architecture control | dependency-cruiser |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS |
| Payments | PSP/provider adapter; Chapa where Market-configured - Moderation consumes normalized facts only |

## 60. Module Structure

```
adulis-platform/
  apps/api
  apps/worker
  modules/moderation
    policy
    reports
    signals
    cases
    evidence
    enforcement
    appeals
    seller-safety
    public-contracts
  modules/... source domains
```

```
No separate moderation microservice in MVP.
```

Private repositories stay module-owned. Cross-domain effects use public application services, typed events and transactional outbox. dependency-cruiser prevents private repository imports.

## 61. Testing

Use Jest for policy/reason selection and scoped authorization; Testcontainers for immutable events, target uniqueness, outbox/idempotent Order actions and concurrent case leases; Maestro/Playwright for report, appeal and Operator flows; k6 for report bursts, case queues and safety suspension fanout. Run the following regression scenarios in addition to existing commerce/dependency tests:

• Current regression 01: Report Scene Post -> exact revision snapshot.

• Current regression 02: Scene moderation REMOVED -> absent from FYP.

• Current regression 03: Scene moderation REMOVED -> absent from Marketplace Search.

• Current regression 04: Scene moderation REMOVED -> absent from public Storefront.

• Current regression 05: Saved Scene remains safe unavailable/tombstone; historical restricted content does not leak.

• Current regression 06: One Product in multi-Product Scene removed -> Scene remains PUBLIC if another eligible available Product remains.

• Current regression 07: Last eligible available Product disappears -> Content transitions Scene PUBLIC -> PRIVATE; Moderation does not archive it.

• Current regression 08: Restock while no Scene Moderation restriction -> Content may restore PUBLIC.

• Current regression 09: Restock while Scene REMOVED -> remains non-public.

• Current regression 10: Product removal blocks Product Search/checkout/tag action.

• Current regression 11: Report remains allegation until authorized decision.

• Current regression 12: Weak automated signal cannot permanently ban.

• Current regression 13: Seller reporting negative Review does not hide it.

• Current regression 14: Seller Safety Suspension blocks new Checkout but preserves paid-Order rights.

• Current regression 15: Courier Seller-pool removal does not become platform ban.

• Current regression 16: Operator ordinary Account cannot use Moderation API.

• Current regression 17: Separate authorized Operator Account can claim/decide according to capability.

• Current regression 18: Revoked Operator capability prevents effect-producing command.

• Current regression 19: Appeal restoration preserves original history.

• Current regression 20: Valkey outage does not lose canonical decision.

• Additional commerce/dependency gates: definitive-unpaid allocation release exactly once; paid termination opens required Claim/refund route; ambiguous payment is preserved; Handoff evidence cannot be edited.

• Additional security/media gates: report idempotency/throttling, typed arbitrary-target and cross-Seller/Account IDOR, exact case-version conflicts, reporter privacy and evidence-access audit, TikTok external-reference failure isolation and connected-only no-false-success behavior.

## 62. Load and Abuse Testing

• k6 report bursts with realistic body limits and per-account/IP throttling.

• Large Seller suspension with thousands of Orders processed through resumable moderation_order_action workers.

• BullMQ backlog/recovery and Valkey restart without data loss.

• High-volume FYP invalidation without one job per impression.

• Mass malicious report campaign does not starve genuine high-priority cases.

• Case list/lease queries remain indexed at projected launch volume.

• Cloudflare purge rate/backoff behavior tested.

## 63. MVP Scope

• Product Post and Scene Post reporting/enforcement.

• Review and reported-Message moderation.

• Seller/account/Courier safety cases.

• Versioned reasons/policies, cases, queue and leases.

• Bounded evidence snapshots + Media quarantine/purge integration.

• Seller Safety Suspension + per-Order action orchestration under PSP payment state.

• FYP/Search/Storefront/Collections enforcement integration.

• Blocks, appeals, notifications and Operator workflows.

• Valkey/BullMQ async operation, observability, retention and privacy integration.

## 64. Deferred Scope

• Large ML content-safety classifier stack.

• Computer-vision moderation service.

• Perceptual image similarity at scale.

• Real-time graph fraud platform.

• Automated permanent bans from heuristic scores.

• Large dedicated moderation microservice.

• Kafka/Flink/Spark pipeline.

• General third-party trust/risk score.

• Mass bulk permanent enforcement console.

• Native video moderation infrastructure unless Adulis later builds native video publishing.

## 65. Invariants

• MOD-INV-01 Reports/signals are not verdicts.

• MOD-INV-02 Durable adverse decisions are policy-versioned/auditable.

• MOD-INV-03 Moderation does not own commerce/domain truth.

• MOD-INV-04 Product Post and Scene Post are canonical content targets.

• MOD-INV-05 FYP cannot rank moderation-ineligible Scene Posts.

• MOD-INV-06 Product Posts are not top-level FYP units.

• MOD-INV-07 Marketplace Search cannot return moderation-ineligible targets.

• MOD-INV-08 Cache/index/CDN cannot override removal.

• MOD-INV-09 No hidden unlogged shadow-ban exists.

• MOD-INV-10 User blocking is not a global verdict.

• MOD-INV-11 Seller Safety Suspension blocks new risky commerce.

• MOD-INV-12 Existing Orders receive explicit handling.

• MOD-INV-13 Payment truth is PSP/backend authoritative.

• MOD-INV-14 Paid/reconciliation-sensitive Orders are preserved.

• MOD-INV-15 Handoff evidence cannot be rewritten.

• MOD-INV-16 Seller Courier-pool decisions and platform moderation are separate.

• MOD-INV-17 Reporter identity is private by default.

• MOD-INV-18 Restricted evidence access is audited.

• MOD-INV-19 No Government-ID Seller evidence store is assumed.

• MOD-INV-20 Client report/appeal success requires backend confirmation.

• MOD-INV-21 Valkey is non-canonical.

• MOD-INV-22 Consumers are idempotent.

• MOD-INV-23 Appeals/restoration retain history.

• MOD-INV-24 Weak heuristic cannot directly permanently ban.

• MOD-INV-25 Seller roles cannot become Moderator roles.

• MOD-INV-26 Moderators authenticate as separate Operator Accounts.

• MOD-INV-27 Translation cannot change policy meaning.

• MOD-INV-28 Sensitive report/evidence bodies stay out of ordinary telemetry.

• MOD-INV-29 Native Seller content remains image/text plus external Product TikTok reference only.

• MOD-INV-30 Product unavailability and Moderation are separate causes of Scene non-public state.

## 66. Architecture Write-Backs

• Content/Catalogue: Product and Scene typed targets; Content owns availability-driven PUBLISHED/PRIVATE and all-gate restoration without archive or Moderation cause confusion.

• Search/Recommendation/Storefront/Collections: hard canonical gates precede ranking/delivery; launch Product/Seller/Scene Search; safe saved references cannot serve historical private content.

• Auth/Operator: one ordinary multi-relationship Account; separate Operator credentials/sessions/capabilities and privileged actor FKs; preserve Founder/Staff governance.

• Order/Checkout: PSP-aware CONTINUE/TERMINATE handling; idempotent definitive-unpaid allocation release; preserve paid/ambiguous financial rights and Claim/refund routes.

• Media: native images/text, evidence holds, controlled public delivery/quarantine/purge; external Product-detail TikTok independently disabled.

• Fulfilment/Handoff: Seller Pool action separate from platform safety; preserve directional accepted custody/receipt and exactly two best-effort checkpoints.

• Trust/Reviews: canonical outcomes, four Trust names, no rating/report-count level setter or listing cap; negative Review remains unless authorized Moderation acts.

• Verification/Privacy: safe social admission status only; no platform Government-ID store, restricted evidence/audit retention and reporter privacy.

• Notifications/Analytics: typed Scene target/transition events, committed outbox consumption, safe reasons and no sensitive evidence bodies.

## 67. Implementation Sequence

| Phase | Build | Exit |
| --- | --- | --- |
| 0 - Policy | Target/reason/decision catalogue; policy versioning | Every decision explainable by a version |
| 1 - Reporting | Reports, history, idempotency, blocks, rate limits | All current public targets reportable |
| 2 - Cases | Case consolidation, queue, priority, leases | Operational work is measurable |
| 3 - Enforcement | Events/projection; Product/Scene/Review/Message | Public effect is canonical and auditable |
| 4 - Public integrations | FYP/Search/Storefront/Collections/cache purge | Removed content cannot circulate |
| 5 - Seller/Courier safety | Safety states; per-Order actions; PSP-aware orchestration | New risk blocked, existing rights preserved |
| 6 - Evidence | Snapshots, Media quarantine, access audit | Removal cannot destroy case evidence |
| 7 - Appeals | Appeal/restore workflow + notifications | Reversible decisions retain history |
| 8 - Hardening | Privacy, reconciliation, k6, alerts | Production gate passes |

## 68. Production Launch Gate

• Every launch Product/Scene/Review/Message/Seller/Courier target is reportable as intended.

• Report reasons and moderation policy are versioned.

• Report idempotency/rate limits pass.

• Cases consolidate and queue due_at/lease behavior is observable.

• Moderation events are immutable.

• Product Post removal blocks purchase/search/storefront/tag usage.

• Scene Post removal blocks FYP/public delivery.

• No eliminated recommendation modules exist in current moderation integration.

• Stale Valkey/search/CDN state cannot restore removed content.

• Seller Safety Suspension blocks new Checkout immediately.

• Unpaid termination releases any active Checkout allocation exactly once.

• Provider-verified paid/reconciliation-sensitive Order handling preserves Buyer financial rights.

• No Seller payment-confirmation logic exists.

• Handoff verification facts are immutable and remain source-domain owned.

• Courier platform suspension integrates with Fulfilment/Auth; seller pool removal remains independent.

• Reporter privacy and restricted evidence access pass.

• Current verification policy creates no legal-document dependency in Moderation.

• Operator stale-screen/capability-revocation/approval tests pass.

• Appeal/restoration retains original decision history.

• Connected-only report/appeal paths never show false success.

• All cache/queue terminology and implementation uses Valkey.

• Current technology-stack CI and architecture fitness rules pass.

Launch also requires all public Scene paths to deny PRIVATE/REMOVED state during projection lag; partial/last-tag/restock restrictions and separate Operator stale-authority tests must pass. No Government-ID, standalone Creator or native-video architecture is added.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 69. Final Architecture

Reports/signals and exact revision evidence enter a policy-versioned case. A separately authenticated, currently authorized Operator issues a durable immutable decision; canonical enforcement and outbox commit together. Source domains retain their own payment, content, stock, custody, Claims and Trust truth.

![Policy decisions and source-domain consequences](graphics/MOD_06.svg)
*Figure 06. Policy decisions and source-domain consequences. Reports and exact evidence enter a case; separate Operator authority produces immutable enforcement; owning domains execute downstream effects without surrendering their truth.*

![Ordinary relationships and privileged authority are independent](graphics/MOD_07.svg)
*Figure 07. Ordinary relationships and privileged authority are independent. The same human may possess both principals, but session, credential, recovery, scope and audit do not cross from an ordinary Account to an Operator Account.*

Current public reads compose enforcement with Content/Seller/Market gates synchronously. Valkey/BullMQ and Search/CDN projections support delivery and repair; they never become a second verdict store.

## 70. Engineering Doctrine

Moderation should always be able to answer: what target was reviewed, which exact content/version and evidence were considered, which policy version applied, who was authorized to decide, what immutable event was recorded, what current enforcement derives from it, and which source domains executed downstream business effects.

### The system protects marketplace integrity by combining explicit policy + bounded signals + human-authorized

### decisions + immutable history + source-domain integration. It must remain possible to remove harmful content quickly

### without inventing payment, inventory, identity, custody or reputation facts that belong elsewhere.

### Appendix A - Key Error Catalogue

| Code | Meaning |
| --- | --- |
| MOD_TARGET_UNSUPPORTED | Target kind is not reportable/enforceable in current release |
| MOD_REPORT_INVALID_REASON | Reason not valid for target/effective policy |
| MOD_REPORT_RATE_LIMITED | Reporter/public intake exceeded abuse control |
| MOD_CASE_CONFLICT | case_version changed since Operator loaded it |
| MOD_OPERATOR_FORBIDDEN | Operator Account lacks current capability/approval |
| MOD_ENFORCEMENT_CONFLICT | Target/current enforcement conflicts with command precondition |
| MOD_EVIDENCE_UNAVAILABLE | Required evidence cannot be safely resolved |
| MOD_PAYMENT_STATE_UNRESOLVED | Order action requires Finance reconciliation before destructive transition |
| MOD_DEPENDENCY_UNAVAILABLE | Required source-domain effect cannot complete; retry/reconcile |
| MOD_ALREADY_APPLIED | Idempotent command already produced equivalent effect |

### Appendix B - Architecture Fitness Rules

• CI rejects private repository imports across Moderation/source domains.

• CI rejects current code/docs using the deprecated cache datastore name.

• CI rejects current moderation target/event names for removed recommendation modules.

• CI rejects Seller payment-confirmation semantics in Moderation commerce integration.

• CI requires Product Post/Scene Post target enums in report/enforcement tests.

• CI requires server-side Auth guard on every Operator effect endpoint.

• CI checks report/evidence/log schemas against sensitive-field denylist.

• Testcontainers verifies immutable-event constraints, target enforcement uniqueness and idempotent per-Order action constraints.

• Playwright/Maestro exercise current report/appeal/Operator flows; no disconnected success mode exists.

• k6 validates report bursts, case queues and suspension fan-out without starving core commerce.

Fitness checks also reject ordinary Account-based Operator authority, current superseded content enums, availability-driven archival and private Scene leakage on Search/Storefront/Collections/direct links. A standalone Creator actor/catalogue/enforcement model is deferred; any admitted Creator-as-Seller follows these same Seller rules.

## 71. Glossary

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
| Report | An allegation, not a verdict. |
| Signal | Bounded risk observation, not automatic guilt. |
| Case / lease | Versioned operational investigation and temporary claimant continuity, never authority. |
| Moderation policy | Effective version of reason/decision rules recorded with each decision. |
| Enforcement | NONE / RESTRICTED / REMOVED projection from immutable decisions. |
| Evidence snapshot | Exact bounded target/revision/context preserved under restricted access and retention. |
| Evidence capability | Separate current purpose/case-scoped authorization; ADMIN does not bypass it. |
| Appeal | Review of a prior decision; resolution/restoration appends history. |
| Safety Suspension | Forward-looking risk block with explicit paid/ambiguous Order handling. |
| CONTINUE / TERMINATE | Idempotent per-Order safety disposition executed by owning domains. |
| Block | Personal safety relationship; no global verdict. |

## 72. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-01 — Buyer-facing Product / Scene terminology | The 13 October designs use Product Post and Scene Post as canonical domain names. | Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly. | PR-001 / PR-005, 26-27 Oct 2026 |
| R-05 — Final Scene engagement model | The 13 October designs define Scene commerce/discovery but do not fully freeze the later action bar and presentation. | Scene actions are Like, Save, Share, Reviews, Follow, More and Explore the Scene. Like belongs to the Scene only and no public Like count is shown. Save saves the Scene only. Follow is Seller-level. More may include Not Interested where applicable, Hide this Scene and Report. Public comments and reposts are not part of the current MVP. Explore the Scene is the primary commerce-exploration action. | PR-004, 26-27 Oct 2026 |
| R-07 — Final Product engagement model | Product Post remains the canonical structured commerce object. | Buyer-facing Product actions are Save, Share, Reviews, Ask Seller, Order and More/Report. Product has no Like, public comments or repost. Save is Product-only. Ask Seller opens the ongoing Buyer-Seller conversation with Product context. Order enters Cart/Checkout; opening a Product or using Buy Again never creates an Order or payment automatically. | PR-005, 27 Oct 2026 |
| R-16 — Company Website public-copy refinements | The 13 October Website/Finance designs already hold the corrected launch financial model. | Public Website copy must not promise a 0.5% Adulis transaction fee. It uses Buyer-facing Product/Scene language and shared authoritative report/deletion policy. Removing decorative warning/report icons must not remove role=status/role=alert semantics. Seller public location copy must not imply a mandatory physical storefront when only operating area/collection point is available. | PR-001 + Oct 15 corrections |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
