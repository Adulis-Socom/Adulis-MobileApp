# Adulis Chatbot & NLU Engine
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-CHATBOT-01_Adulis_Chatbot_NLU_Engine_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. System mission

Adulis Chatbot reduces repetitive Seller support while protecting commerce truth. It identifies what the Buyer means, resolves an approved intent, fetches authoritative facts through typed domain readers, renders an immutable versioned template, and escalates whenever meaning or data is insufficient.

It is not a free-form generative sales agent. It does not negotiate, choose Products on behalf of the Buyer, invent policy, verify payment from prose, mutate Orders, or generate Buyer-facing commerce claims from an LLM.

Historical reviewed-baseline note (superseded by the selected 12 October amendment): Version 3.0 / 7 October 2026 retains the complete deterministic architecture and reconciles current Scene, Account, visibility, quality-review and Recommendation contracts.

## 2. Core architecture principle

```
Buyer input
   -> explicit message subject
   -> approved intent
   -> authoritative slot values
   -> deterministic template
   -> Buyer
```

```
LLM/model = classify only
LLM/model != Buyer-facing answer generator
```

## 3. Hardest invariant

CHATBOT-INV-01: No model-generated prose may be persisted or delivered as an automated Buyer-facing answer. The classifier returns an approved intent code or NO_MATCH only.

## 4. Owned responsibilities

● Intent catalogue and applicability rules.

● Quick Reply/chip resolution.

● Exact, keyword, optional embedding and classifier orchestration.

● Template selection/versioning and typed-slot orchestration.

● Seller chatbot knowledge configuration and readiness.

● BotTurn diagnostics, quality feedback, evaluation and rollout policy.

● Privacy-separated unmatched-language improvement datasets.

## 5. Explicit non-ownership

● Conversation identity and human Message persistence - Chat domain.

● Product/Variant truth and structured attributes - Catalogue.

● Availability - Inventory.

● Scene Post lifecycle/tag graph - Content.

● Payable amount and final purchase validation - Checkout.

● Provider-verified payment state - Payment/Finance.

● Order state - Orders.

● Delivery state - Fulfilment/Handoff.

● Organic feed ranking - Recommendation.

● Operator access policy - Auth/Operator governance.

## 6. Human Chat independence

WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

## 7. Conversation identity

One Buyer + one Seller + one Market forms one long-lived Conversation. Product Posts, Scene Posts and Orders do not create separate threads. Conversation state never stores a current commerce subject.

One human uses one ordinary Adulis Account across Buyer capability, Seller ownership relationships, Seller-team participation and Courier profile/relationships. Different humans use different Accounts; Seller credentials are never shared. At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the MVP team slot. Multiple roles within that membership compose by current effective permission union. Ownership and Courier relationships are separate from the team slot.

Switching Buyer, Seller or Courier context changes presentation and scoped authority, never the human's identity. An unrelated Courier or Seller relationship cannot grant access to a Buyer Order, another Seller's records or privileged operations.

Operator Accounts never act as ordinary Conversation participants.

## 8. Canonical primary subjects

A BotTurn has exactly one primary subject; Scene provenance is a separate optional typed relationship.

| Subject | Meaning | Reader |
| --- | --- | --- |
| NONE | Seller / General | Seller/Market/versioned Seller policy |
| PRODUCT_POST | One concrete Seller Product | Catalogue + Inventory |
| SCENE_POST | One whole Scene Post | Content + exact tagged Product relations |
| ORDER | This Buyer + Seller + Market Order | Orders + Finance/Fulfilment/Handoff |

WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

## 9. Source context / provenance

When a Buyer selects a Product Post from a Scene Post, the Product Post is the only primary subject. The Scene Post is immutable provenance that explains where the Buyer encountered the Product. It is never a second commerce authority.

Preserve source_scene_revision_id and validate the Product belongs to the referenced Scene revision/tag relationship. Subject/provenance belongs to the Conversation Seller and canonical Market.

## 10. Trigger-message context rule

Every BotTurn resolves strictly from the immutable Buyer Message that triggered it. Current composer selection, later Messages, the most recent Product in the thread, or a UI context change cannot modify an in-flight BotTurn.

## 11. Subject validation

● Product Post belongs to the Conversation Seller and is currently readable under Chat policy.

● Scene Post belongs to the Conversation Seller and is readable.

● Order belongs to the Conversation Buyer, Seller and Market.

● When source Scene Post accompanies Product Post, the Product is actually tagged in that Post.

● Invalid/cross-tenant refs fail without resource-existence leakage.

New normal Buyer Scene context requires current PUBLIC access. PRIVATE/draft/deleted/moderation-restricted Scenes are rejected. A historical triggering Message may retain a safe older snapshot, but the Bot must distinguish history from current accessibility and must not disclose a newer Seller-private revision. All current Product/Inventory/Order slots re-resolve under authorized readers.

## 12. Scene Post context and current accessibility

Content may provide Post identity, caption summary, presentation metadata and current tagged Product identities. Product price, current stock, Variant availability, payable amount, payment state and Order state must always resolve from their owning domains.

Scene Post / ScenePost / SCENE_POST is the canonical Seller-authored image content object with caption, immutable revisions and same-Seller Product tags. Product Post is the structured commerce destination for exactly one Product. Scene context and historical provenance never establish current price, Variant availability, stock, Checkout totals or payment state.

Content owns publication_state DRAFT / PUBLISHED / ARCHIVED, independent visibility PUBLIC / PRIVATE and revision lifecycle. Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product, ready images/caption and every Seller, Market and Moderation gate.

When the last eligible available tagged Product disappears, Content changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Temporary stock loss does not archive/delete the Scene. Restock triggers Content reevaluation and automatic PUBLIC restoration only if every current gate passes; no manual republish is needed solely for recovered stock. Independent archive, moderation, Seller/Market or Media blocks remain binding.

Buyer-facing current reads of PRIVATE Scenes fail closed across FYP, Search, Storefront, direct links and Collection resolution. Response-time canonical gates remain final while outbox, cache, CDN and projection consumers converge. Saved membership can remain as a safe unavailable reference without revealing old caption/media or a newer private revision.

## 13. Ambiguous multi-Product Post

If a Buyer asks a Product-specific question while the primary subject is a Scene Post containing multiple Products, automation must not guess. Return a deterministic structured context-recovery action such as SELECT_PRODUCT_CONTEXT. If structured recovery is unavailable, escalate.

## 14. No conversational-memory entity guessing

Do not introduce long-term LLM memory to resolve phrases such as "this", "that one" or "the black one" into commerce entities. Explicit message subject remains authoritative. Conversation history is for human readability and controlled evidence, not an unrestricted Product-selection memory store.

## 15. Primary language policy

English remains the launch automation language. Amharic/other user text is accepted privately for waiting human support, not routed to English NLU or translated by guess. Localized approved Quick Replies are optional assistance; no multilingual classifier or generative advice is introduced.

WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

## 16. Non-English automated mode

English-only NLU capability limits automation, not private human Message submission. Amharic and any other original-language free text is accepted under current Chat authorization and placed in WAITING_FOR_HUMAN when automation cannot handle it. Optional localized Quick Replies do not replace the text field or gate sending.

WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

## 17. Waiting for Human and Active Human Takeover

WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

## 18. Unsupported Automation and Accepted Human Messages

Unsupported-for-automation is a routing/status result, not a rejection of otherwise authorized Message text. Persist the original Message once, return accepted Message identity with WAITING_FOR_HUMAN, and bypass English NLU. Permission, rate/content and recipient errors remain genuine send denials. Optional Quick Replies/escalation controls never imply immediate human availability.

WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

## 19. Quick Reply integrity

Clients submit canonical chip_id plus validated subject/provenance. Visible labels are localized presentation only. The server resolves chip identity, intent, applicability, locale template and allowed transition.

Optional chips do not prevent arbitrary-language waiting-for-human text. Classifier failure/budget exhaustion cannot discard the original Message or promise a human response time.

## 20. Future language engines

Language-specific exact matching, embeddings, classifier support, evaluation datasets and free-text UI remain architecturally supported but disabled until each locale passes its own evaluation and launch gate. Enabling a language is a capability release, not a translation toggle.

## 21. Resolution cascade

```
0  STRUCTURED CONTEXT / UX
1  QUICK REPLY CHIP
2  EXACT / KEYWORD
3  EMBEDDING SIMILARITY (feature-gated)
4  MODEL CLASSIFIER (classify only)
5  HUMAN ESCALATION
```

## 22. Layer 0 - prevent ambiguity before AI

Layer 0 exposes optional Scene and Product selectors. With no Scene, Product selection uses the full current Seller eligible catalogue. With a Scene, Product choices are only its tagged Products. Scene + Product means PRODUCT_POST primary with exact SCENE_POST/revision provenance; Scene alone means SCENE_POST, neither means NONE. Independent ORDER context cannot compete with composer selections. BotTurn uses the immutable trigger, never later selector state.

![Optional Scene and Product selectors determine the next Message](graphics/CHATBOT_01.svg)
*Figure 01. Optional Scene and Product selectors determine the next Message. Scene selection filters Product choices to its tagged Products; a Product becomes the primary subject while Scene remains exact revision provenance. ORDER is independent.*

## 23. Layer 2 - normalization and deterministic language

For English text, trim, Unicode-normalize, case-fold where safe and preserve Product-significant punctuation. Exact and keyword rules are code/config with regression tests, not ad-hoc Seller intuition.

## 24. Layer 3 - embeddings

Embedding similarity remains optional. The current global deployment baseline does not list pgvector as a required platform extension. Therefore Layer 3 must stay feature-gated unless Deployment explicitly certifies pgvector (or another approved vector implementation). Disabling Layer 3 must not break Layers 0/1/2/4/5.

Deployment certification remains the activation gate for optional pgvector; it is not a required platform dependency.

## 25. Layer 4 - classifier contract

● Input: English buyer_text, locale, primary_subject_type, bounded subject/category metadata and allowlisted intent codes.

● No whole Conversation, Buyer identity/phone, payment secrets, Claim evidence, private Seller notes or complete Scene content payload.

● Output schema accepts only approved intentCode / NO_MATCH plus bounded diagnostics.

● No tools, no commerce writes, no answer prose.

## 26. Subject-aware allowlist

The classifier sees only intents enabled for current subject type, category, locale capability, risk class and Seller/Market policy. This reduces false containment and prevents impossible intent selection.

## 27. Intent structure

```
intent
  code
  domain
  description
  allowed_subject_types[]
  category_applicability[]
  supported_locales[]
  risk_class
  enabled
  template_family
  required_slots[]
```

## 28. Scene Post intent discipline

Add only semantically distinct Post intents such as tagged-product listing, Product identification and Product-selection help. Do not clone price/stock/size/color intents for Scene Posts when the actual question should resolve a Product Post and reuse the existing Product intent.

## 29. SlotResolver authority map

| Question / slot | Authoritative source | Rule |
| --- | --- | --- |
| Product identity, structured attributes, price | Catalogue | Current Product/Variant truth |
| Availability | Inventory | Never infer from caption/image |
| Tagged Products / Post structure | Content | Context only; no price/stock authority |
| Seller policy | Versioned Seller chatbot policy / owning domain | Use only configured fields |
| Order state | Orders | Read only |
| Payment status | Payment/Order projection | Provider/server verified only |
| Fulfilment | Fulfilment/Handoff | Read only |
| Payable total before purchase | Checkout | Fresh preview; never stale Chat value |

## 30. Deterministic templates

Every automated response resolves intent + immutable template version + typed slots + locale. Production template versions are immutable after use. Historical Bot responses remain attributable to the exact template/config/model versions that produced them.

## 31. Missing data behavior

If a required authoritative slot is unavailable, inconsistent or unsafe, do not fill with model prose. Use structured recovery where possible, otherwise escalate.

## 32. Configuration doctrine

Seller-provided chatbot knowledge expands answer coverage but must not duplicate or override canonical Catalogue, Inventory, Checkout, Payment, Order or Fulfilment truth. The setup UI asks only for structured facts/policies not already owned elsewhere.

## 33. First Seller setup - required English chatbot knowledge

| Group | Required / source | Examples |
| --- | --- | --- |
| Seller profile | English canonical profile + chatbot policy completion | Business summary is reused from Seller profile; do not duplicate name/category/location. |
| Returns / exchanges | Seller policy, structured | Eligibility, window, condition requirements, exclusions, process. |
| Warranty / after-sales | Structured where applicable | Whether offered, duration/unit, coverage summary, service route. |
| General buyer guidance | Structured seller configuration | Size guidance approach, care/setup guidance policy, common pre-purchase limitations. |
| Fulfilment / visit timing | Reuse canonical Fulfilment/Seller config | Chatbot reads delivery/collection/store-visit windows; Seller does not retype them. |
| Escalation | Internal configuration | Which human queue handles unresolved Buyer questions; not Buyer-facing policy. |
| Language | English required; configured Market work-language optional | Localized values use explicit locale/version, never overwrite English source. |

## 34. Dynamic category chatbot schema

Each category exposes a versioned Chatbot Knowledge Schema. The authoring UI computes the difference between canonical Product fields and chatbot-only fields; Sellers are never asked to re-enter data already represented by Catalogue attributes.

## 35. Fashion chatbot-only examples

● Fit guidance: fitted / regular / relaxed / oversized when not already canonical.

● Stretch level and drape/feel where not represented in Catalogue.

● Lining/transparency notes.

● Care instructions and measurement guidance.

● Styling/occasion guidance clearly labeled as Seller-provided advice.

## 36. Cosmetics chatbot-only examples

● How-to-use steps and routine order.

● Texture/finish/scent notes where not canonical.

● Applicator/packaging usage guidance.

● General patch-test / caution template selection as approved platform wording.

● No diagnosis, treatment claims or fabricated ingredient/medical advice.

## 37. Electronics chatbot-only examples

● Box contents and included accessories when not canonical.

● Setup/pairing steps.

● Compatibility notes not already modeled as structured attributes.

● Charging/power guidance.

● Seller warranty/service instructions.

## 38. Product Post authoring rule

When a Seller publishes a Product Post while Chatbot automation is enabled, all required English chatbot-knowledge fields for that Product category must be completed or the Product is marked CHATBOT_COVERAGE_INCOMPLETE. This status must not silently rewrite Catalogue publication state; it controls automation readiness and localization completeness evidence.

## 39. Scene Post chatbot knowledge

Scene chatbot knowledge is versioned structured context keyed to Scene/revision, without commerce authority.

| Field | Purpose |
| --- | --- |
| scene_purpose | Approved structured context such as STYLE_LOOK / HOW_TO / DEMO / SETUP / OTHER. |
| chatbot_context_summary_en | Short Seller-authored English context; not stock/price/payment truth. |
| tag_role | Role of each exact tagged Product in this Scene revision. |
| combination_guidance | Structured usage/styling guidance when applicable. |
| sequence_or_step_notes | Ordered setup/use context when applicable. |
| anticipated_question_notes | Bounded hints mapped to approved intents; no arbitrary model prompts. |

## 40. Scene publication and automation boundary

Chatbot-only fields live in versioned Chatbot knowledge referencing Scene/revision. Missing knowledge reduces automation coverage; it never publishes, unpublishes, archives or changes Scene visibility. Content alone controls required caption/media/tags and PUBLISHED + PUBLIC eligibility, including at least one available Product and all other hard gates.

## 41. Versioning and historical meaning

Seller policy and chatbot knowledge are versioned. Editing a Product/Post/policy creates a new knowledge version for future BotTurns. Historical BotTurns retain references to the knowledge/template versions used; Sellers cannot rewrite historical automated answers.

## 42. English remains mandatory source

Seller profile, Product chatbot knowledge and Scene Post chatbot knowledge must be complete in English. Optional localization is additive. A local-language value never replaces the English source-of-truth entry.

## 43. Market work-language localization

Market Configuration defines the eligible work-language locale(s) for the localization/readiness policy. Sellers may optionally provide complete localized equivalents for Seller profile, Product Post chatbot knowledge and Scene Post chatbot knowledge.

## 44. Localization completeness flags

```
seller_profile_localized_complete: boolean
product_post_localized_complete: boolean  // per Product Post
scene_post_localized_complete: boolean // per Scene Post revision
localized_tagged_product_count: integer
localization_policy_version: string
```

## 45. Qualification rules

● All required translatable fields for that entity/schema version are present.

● Locale is one of Market-configured localization locales.

● Values pass basic script/language plausibility and abuse checks; empty filler or duplicated garbage does not qualify.

● Canonical non-translatable data does not need to be duplicated.

● Machine-generated translation does not automatically qualify unless a future approved policy explicitly allows it.

## 46. Localization evidence and Recommendation ownership

Chatbot owns localization completeness, locale support, intent/template quality and versioned Seller configuration evidence. Recommendation independently owns all organic ranking behavior. Chatbot emits no final score, fixed multiplier, guaranteed impressions or mandatory ranking weight.

Optional evidence can use typed names chatbot_localization_quality, chatbot_locale_coverage and chatbot_knowledge_completeness. Recommendation may ignore, cap, experiment with, activate or remove those fields under its own immutable algorithm version. Answering, human Chat and FYP remain functional when this optional integration is disabled.

![Private any-language waiting support with bounded attachments](graphics/CHATBOT_02.svg)
*Figure 02. Private any-language waiting support with bounded attachments. Money is never established by Chat; original text and private evidence remain purpose-bound.*

## 47. Localization readiness examples

Operational examples describe readiness without promising distribution.

| Configuration | Evidence / behavior |
| --- | --- |
| English source complete | English automation readiness; no rank guarantee. |
| Approved localized Seller profile | Versioned locale coverage/completeness evidence. |
| Approved localized Scene knowledge | Context coverage for that exact Scene revision. |
| Localized tagged Product knowledge | Bounded count and quality diagnostics; no deterministic score boost. |
| Optional Recommendation feature disabled | Chatbot answering and normal FYP ranking continue independently. |

## 48. Optional ranking evidence safety boundary

If Recommendation adopts locale-quality evidence, it must be optional, config-driven, capped, versioned, experimentable and empirically validated. It remains subordinate to relevance, Trust, conversion quality and every Content/Market/Moderation/availability hard gate. No Seller UI may promise a fixed exposure increase or guaranteed impressions. Chatbot cannot override a PRIVATE Scene.

## 49. Anti-gaming and revocation

Completeness is not merely "non-empty". Suspected filler, wrong-language text, copied English text presented as localization, abuse or policy violations can revoke qualification. Revocation changes future completeness evidence only; it never rewrites historical impressions or Bot responses.

## 50. Cross-system localization contract

Recommendation defines whether and how bounded quality evidence is used, and can disable it entirely. Market Configuration defines supported locales and capability/schema versions. Seller Console shows explainable completeness and missing fields without a multiplier or impression promise. Analytics captures evidence/version/qualification and optional feature adoption separately from provider commerce outcomes.

## 51. Review-mode toggle

Seller Companion Chat provides an opt-in Review bot responses toggle for an authenticated Seller Owner/team member who can read that Seller conversation. The toggle is a review UI preference; it does not alter Buyer-visible Chat behavior or the Bot response itself.

## 52. Three response-quality actions

| Action | Meaning | Workflow |
| --- | --- | --- |
| Correct - green tick | Response is correct and useful | Record lightweight positive review signal; no quality case required by default. |
| Needs improvement - yellow ! | Substantially correct but wording, coverage or data handling can improve | Open feedback form; submit creates normal-priority quality case. |
| Wrong / urgent - red X | Wrong answer or materially unsafe/incorrect commerce response | Open feedback form; submit creates high-priority quality case and may trigger intent/template kill-switch review. |

## 53. Yellow/red feedback form

● What happened? - required concise description.

● What should the Bot have answered or done? - required.

● Optional problem type: wrong intent / wrong slot data / missing data / bad template / outdated Seller policy / language issue / other.

● The system automatically binds BotTurn, Buyer trigger Message, Seller, subject/provenance, intent, template version, slot source diagnostics, model/classifier version and timestamps.

● Do not ask the Seller to copy sensitive conversation history manually.

## 54. Feedback entity

```
chatbot.feedback_case
  id
  seller_id
  reporter_account_id
  bot_turn_id
  rating: NEEDS_IMPROVEMENT | WRONG_URGENT
  issue_type
  what_happened
  expected_behavior
  status
  priority
  assigned_operator_account_id?
  resolution_type?
  linked_change_version?
  created_at / resolved_at
```

reporter_account_id is an ordinary Account FK authorized through this Seller relationship. assigned_operator_account_id is a separate Operator Account FK; assignment never confers capability.

## 55. Actual actor attribution

Every Seller/team member uses their own Account. Feedback records the real reporter account; shared Seller credentials are prohibited. Multiple devices for one Account remain valid and do not create duplicate cases when the same review submission is retried.

One human uses one ordinary Adulis Account across Buyer capability, Seller ownership relationships, Seller-team participation and Courier profile/relationships. Different humans use different Accounts; Seller credentials are never shared. At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the MVP team slot. Multiple roles within that membership compose by current effective permission union. Ownership and Courier relationships are separate from the team slot.

Switching Buyer, Seller or Courier context changes presentation and scoped authority, never the human's identity. An unrelated Courier or Seller relationship cannot grant access to a Buyer Order, another Seller's records or privileged operations.

## 56. Operator quality queue

Operator Account is a separate internally provisioned privileged principal, with independent credentials, strong authentication, OPERATOR sessions, recovery, revocation and audit identity. Ordinary Account roles, phone OTP, public registration and Mode switching do not create Operator authority. The same person may possess both principals, but their authorization and identifiers remain distinct.

Privileged commands require the separate Operator Account, a current narrow capability, exact Market/resource/case scope, purpose/reason and audit, with fresh authentication and approval where existing Operator governance requires it. No generic superuser bypass, arbitrary state setter or impersonation path is introduced.

Quality queue access requires narrow current capabilities such as CHATBOT_QUALITY_READ, CHATBOT_QUALITY_CLAIM, CHATBOT_QUALITY_DECIDE, CHATBOT_TEMPLATE_APPROVE, CHATBOT_INTENT_APPROVE or CHATBOT_KILL_SWITCH according to the established Operator taxonomy. Each read/claim/decision is exact case/evidence scope and audited. Seller feedback permission grants no Operator authority.

![Ordinary relationships and privileged authority are independent](graphics/CHATBOT_03.svg)
*Figure 03. Ordinary relationships and privileged authority are independent. The same human may possess both principals, but session, credential, recovery, scope and audit do not cross from an ordinary Account to an Operator Account.*

## 57. Operator workflow

```
OPEN
 -> TRIAGED
 -> (NEEDS_SELLER_CONFIG | TEMPLATE_CHANGE | INTENT_CHANGE | SLOT_BUG | CLASSIFIER_RULE | NO_DEFECT)
 -> CHANGE_PROPOSED
 -> REGRESSION_TESTED
 -> APPROVED
 -> RELEASED
 -> CLOSED
```

## 58. No automatic learning from Seller reports

Seller feedback is evidence for human review, not a direct training signal. A yellow/red report must never automatically edit an intent, template, prompt, Seller policy, phrase library or model. Every production change is versioned and must pass regression tests.

## 59. Urgent containment

A red report may trigger an Operator-approved temporary kill switch for an intent/template/classifier path while investigation occurs. The safe fallback is deterministic alternative or escalation, never a rushed

model-generated answer.

Containment and release follow the existing approval/governance policy; an assigned case or Seller urgent report never bypasses current Operator authorization.

## 60. Feedback visibility

Seller Companion can show Submitted / Under review / Resolved status for the reporter where appropriate. It must not expose internal model prompts, other Sellers' cases, security reasoning or Operator-only notes.

## 61. Buy-from-Chat is a navigation boundary

The Chatbot may surface a structured Buy / Review purchase action when a concrete Product Post and required Variant/quantity selections are available. It may not create a payment, silently choose a Variant, lock an old Chat price or declare a purchase complete.

## 62. Mandatory final purchase review

| Review field | Source |
| --- | --- |
| Product and Seller | Catalogue/Seller |
| Selected Variant attributes: color, size, type, etc. | Catalogue |
| Quantity | Buyer selection + Checkout validation |
| Current unit price / merchandise subtotal | Checkout/Catalogue |
| Delivery charge where applicable | Fulfilment/Checkout snapshot |
| Adulis Buyer-side Checkout surcharge | Checkout/Finance policy |
| Currency and final payable total | Checkout |
| Availability / eligibility | Catalogue + Inventory + Market + Seller eligibility |

The current Adulis Buyer Checkout surcharge is zero at launch; display only Checkout/Finance server-calculated amount and policy snapshot. Bot and Chat perform no fee arithmetic.

## 63. Double revalidation at Buyer confirmation

When the Buyer confirms the final review, Checkout revalidates material values. If stock, Variant eligibility, price, delivery charge, surcharge or other material facts changed, payment does not begin. The Buyer receives an updated summary and must confirm again.

## 64. Provider payment authority

After explicit Buyer confirmation, Checkout creates a provider payment attempt through the configured PSP adapter (Chapa where Market-configured). Server-side provider verification establishes payment truth. Seller prose, Buyer claims, screenshots, client redirects and local success screens cannot mark an Order paid.

## 65. Payment status answers

Payment-status intents query the authoritative Payment/Order projection. Automated answers can explain pending/processing/paid/failed/retry states using canonical values but never override them.

## 66. Timeline/system events

Current Chat stores domain facts such as ORDER_PAID, ORDER_READY, COURIER_ASSIGNED, HANDOFF_VERIFIED, CLAIM_OPENED and REFUND_STATUS_CHANGED in chat.timeline_event, separate from human/Bot Messages.

Pickup and final Delivery Handoff facts remain distinct; BotTurn never consumes a timeline row as triggering human language.

## 67. Timeline events never enter NLU

The NLU engine never classifies timeline-event display text as Buyer/Seller language. If a Buyer asks about an Order fact, the intent resolves typed domain readers rather than reading the visible timeline label.

## 68. Escalation payload

● Trigger Buyer Message reference/body under authorized Seller access.

● Primary subject and concise subject summary.

● Source Scene Post provenance when applicable.

● Candidate intent/reason automation failed where safe.

● No irrelevant full Conversation dump.

## 69. Core database model

```
chat
  conversation
  message
  bot_turn
  escalation
  timeline_event
```

```
chatbot
  seller_policy_version
  product_knowledge_version
  scene_post_knowledge_version
  localization_completeness_projection
  feedback_case
```

```
nlu
  intent
  intent_phrase
  answer_template
  answer_template_version
  unmatched_phrase
  regression_case
  regression_run
```

## 70. BotTurn provenance

● trigger_message_id / response_message_id

● resolution_path and decision reason

● intent code/version

● template key/version

● slot source versions

● classifier/model/prompt versions where used

● latency and escalation outcome

● primary subject/source context by immutable reference

● language capability/mode

## 71. Conceptual APIs

All APIs use REST/OpenAPI with generated clients and server-derived relationship/capability checks.

| Endpoint / command | Purpose |
| --- | --- |
| GET /v1/sellers/{seller}/chatbot/setup | Seller Console readiness and required fields. |
| PATCH /v1/sellers/{seller}/chatbot/policy | Versioned Seller-wide policy. |
| PUT /v1/sellers/{seller}/products/{product}/chatbot-knowledge | Product/category structured Chatbot knowledge. |
| PUT /v1/sellers/{seller}/scenes/{scene}/chatbot-knowledge | Versioned exact Scene/revision context. |
| POST /v1/chatbot/feedback | Ordinary Seller reporter; green signal or yellow/red case under permission. |
| POST /v1/chatbot/test | Non-production deterministic test; no real commerce. |
| POST /v1/conversations/{ref}/escalate | Chat-owned human takeover request; exact route follows Chat contract. |

## 72. Transactional outbox and events

Config/feedback/completeness changes commit durable PostgreSQL state first and publish transactional outbox events. BullMQ/Valkey execute asynchronous quality processing, notifications, analytics and

Recommendation projection refresh. Queue state is never canonical truth.

Use shared Eventing transactional event_outbox and job_intent relays; no direct PostgreSQL-to-Valkey correctness dual write. Each consequence is idempotent and rechecks current state. No event may publish or change Scene visibility.

## 73. Important events

```
chatbot.knowledge_version_published
chatbot.localization_completeness_changed
chatbot.feedback_submitted
chatbot.feedback_triaged
chatbot.intent_version_published
chatbot.template_version_published
chatbot.kill_switch_changed
chatbot.escalation_created
chatbot.bot_turn_completed
```

These exact committed owner facts resolve in Contract_Registry with event_version, Seller/Market, safe version/turn/escalation references and current-state filters. Private message/template/feedback bodies remain owner-scoped, not broad event payloads. Internal chat.timeline_event records and Notification template keys stay separate classes; no unsupported-language classification or new generative launch capability is added.

## 74. Valkey usage

● BullMQ backing.

● Short-lived intent/template/config caches.

● Rate-limit/budget counters where reconstructable.

● Optional embedding/result cache keyed by versioned context.

● Never authoritative for Messages, BotTurns, Seller policies, feedback cases or localization qualification.

## 75. Security controls

● NestJS guards + server-side Seller/Conversation/subject authorization.

● @nestjs/throttler for message/classifier/test/feedback abuse limits.

● @fastify/helmet and strict origin/CSP policies for web surfaces.

● Opaque stateful sessions from Auth; exact Seller-team actor attribution.

● No external classifier tools or secrets in prompts.

● No cross-Seller Product/Post injection.

● Private Chat attachments use controlled Media access; no public URL leakage.

## 76. Privacy model

● General Analytics receives structured metrics, not raw private Chat text.

● Unmatched phrase ETL redacts identity and excludes Buyer/Seller IDs/phones/conversation IDs.

● Feedback cases reference operational Messages/BotTurns rather than copying full conversations unnecessarily.

● Operator quality review is audited and least-privilege.

● Retention and legal/Claim holds follow Privacy lifecycle policy.

## 77. Failure behavior

| Failure | Safe behavior |
| --- | --- |
| Classifier/model down | Skip Layer 4; escalate. |
| Embedding path down | Skip Layer 3; continue exact/keyword/classifier/escalation. |
| Valkey down | Persisted Chat/feedback/config remains correct; synchronous safe paths continue where possible; async work reconciles later. |
| Content reader down | Post-specific answer escalates; no Product truth guessed. |
| Catalogue/Inventory down | Product/stock answer escalates; no stale sale claim. |
| Payment reader down | Do not claim paid/unpaid; explain temporary inability and escalate/retry. |
| Feedback queue down | Feedback case persists in PostgreSQL; worker dispatch resumes after recovery. |
| Recommendation consumer down | Localization completeness remains stored; an independently adopted optional quality projection can catch up later; no fixed boost is implied. |

## 78. Configuration readiness

Readiness is explainable, not a magic score. It reports Seller-wide policy completion, category knowledge completion, Product/Post coverage, English completeness, optional localization completeness and missing required chatbot fields. It is distinct from live answer quality.

## 79. Live quality metrics

● Containment / escalation rate by subject and intent.

● End-to-end answer accuracy from reviewed sample.

● Seller yellow/red feedback rate and urgent defect rate.

● Buyer repeat-question / re-escalation rate.

● Missing-subject and missing-product-in-Post rate.

● Slot resolution failure rate.

● Classifier use/cost/latency by intent.

● False containment by subject type.

## 80. Feedback metrics

Green reviews may be sampled for calibration; yellow/red rates are not treated as objective truth by themselves. Operator adjudication outcome and regression reproduction determine whether a defect is confirmed.

## 81. Evaluation dataset

Frozen regression data must include Product Post, Scene Post, Product-from-Post provenance, multi-product ambiguity, Seller/General, Order, Buy action, English free text, localized Quick Replies, unsupported non-English text, human-takeover multilingual free text and seller-feedback cases. WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

## 82. Critical regression cases

| Scenario | Expected |
| --- | --- |
| Post has four Products; Buyer asks "Is Medium available?" | Do not auto-select; SELECT_PRODUCT_CONTEXT or escalate. |
| Product subject + Post provenance; asks size | Use Product Catalogue/Inventory; Post only provenance. |
| Seller says "I received payment" but provider not verified | Bot does not report paid. |
| Buyer changes composer subject while BotTurn pending | Bot answer stays bound to trigger Message subject. |
| Unsupported Amharic arbitrary text before escalation | WAITING_FOR_HUMAN: original any-language free text accepted privately; optional localized chips; no English-only NLU route or immediate-response promise. |
| Amharic arbitrary text after human takeover begins | WAITING_FOR_HUMAN: original any-language free text accepted privately; optional localized chips; no English-only NLU route or immediate-response promise. |
| Yellow seller review | Create quality case requiring description + expected behavior. |
| Red seller review | High-priority quality case; optional kill-switch review; no auto-learning. |
| Five localized tagged Products + localized Post | Completeness/quality evidence is recorded without any guaranteed rank, multiplier or exposure. |

### Current canonical regression cases

• 01. NONE / PRODUCT_POST / SCENE_POST / ORDER subjects pass.

• 02. Product-from-Scene provenance validated.

• 03. Multi-Product Scene never causes guessed Product.

• 04. PRIVATE Scene cannot be newly selected.

• 05. Historical private Scene context handled safely.

• 06. English free-text + chips pass.

• 07. Unsupported locale Unsupported-language text persists privately in WAITING_FOR_HUMAN and bypasses NLU. WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

• 08. Human takeover free text bypasses unsupported NLU. WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

• 09. Model-generated answer path impossible.

• 10. Seller feedback never auto-trains production.

• 11. Separate Operator Account required for quality queue.

• 12. Buy always enters canonical Checkout review.

• 13. Provider verification only payment truth.

• 14. Localization completeness is recorded without generating guaranteed multiplier.

• 15. No 1.2x/1.5x/2.0x required ranking assertion remains.

• 16. Recommendation remains functional if localization feature is completely disabled.

• 17. Valkey outage does not corrupt BotTurn/config state.

## 83. Load and cost controls

● Bound message length and classifier input.

● Global/provider classifier concurrency controls.

● Per-Seller fairness budgets.

● Cache only safe versioned artifacts.

● Load-test chat message persistence separately from automation.

● Protect PostgreSQL from N+1 slot resolution and large Post/Product fetches.

## 84. Observability

● Sentry for backend/mobile exceptions and release context.

● Pino structured logs with redaction and BotTurn IDs, never full ordinary Chat bodies.

● pg_stat_statements for slow queries.

● Valkey/BullMQ health, lag/retries/dead-letter monitoring.

● Dashboards for intent precision, escalation age, urgent feedback backlog and localization-projection lag.

## 85. Zero-tolerance alarms

● Model-generated answer prose reaches Buyer.

● Bot answer uses a different Product/Post than triggering Message.

● Scene Post content is treated as stock/price/payment truth.

● Seller text establishes payment success.

● Unsupported non-English automated text reaches classifier.

● Timeline event is classified as authored text.

● Feedback report directly changes production without versioned review.

● Unapproved ranking contract or deprecated fixed localization multiplier is emitted/applied; any quality feature bypasses hard eligibility.

## 86. Latest technology stack

| Layer | Current stack / Chatbot placement |
| --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript |
| Database | PostgreSQL + Drizzle ORM; pg_trgm, btree_gist, pg_stat_statements |
| Async/cache | Valkey + BullMQ; PostgreSQL remains durable truth |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript clients |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js where shared phone normalization is required |
| Media | Cloudflare R2 + controlled delivery; Sharp for image processing; no native video pipeline |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; SecureStore; Expo Notifications |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 |
| Observability | Sentry; Pino; pg_stat_statements |
| Architecture | dependency-cruiser |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS |
| Embedding extension | Layer 3 may use pgvector only after Deployment explicitly certifies it; otherwise keep Layer 3 disabled. |

## 87. Module topology

```
adulis-platform
  modules/chat/       conversation, messages, context, escalation, timeline_event
  modules/chatbot/    orchestration, config, templates, slots, feedback, readiness
  modules/nlu/        intents, phrases, exact/keyword, optional embeddings, classifier, evaluation
  modules/catalogue/  Product truth
  modules/content/    Scene Post truth
  modules/order/      transaction state
  modules/payment/    provider verification
  modules/recommendation/ FYP rank + optional bounded quality feature policy
```

```
adulis-worker
  feedback notifications / quality jobs / ETL / evaluation / analytics / projections
```

## 88. Implementation sequence

| Phase | Scope / exit |
| --- | --- |
| 0 - Canonical alignment | Subject terminology, current Chat language/human-takeover policy, Checkout/payment, one ordinary Account + separate Operator identity, current stack. |
| 1 - Deterministic core | Context validation, Quick Replies, exact/keyword, templates, slots, BotTurn. |
| 2 - Seller knowledge | Seller setup + category Product/Post chatbot schemas + readiness. |
| 3 - Scene context | Post subject, Product provenance, Content reader, ambiguity recovery. |
| 4 - Language capability | English text/chips; non-English chips; explicit human-takeover multilingual free text. |
| 5 - Seller review loop | Companion toggle, green/yellow/red controls, feedback case, Operator queue. |
| 6 - Buy from Chat | Final Checkout review, revalidation, provider handoff. |
| 7 - Localization evidence | Versioned completeness/quality evidence; Recommendation independently decides adoption, caps and experiments. |
| 8 - Optional higher NLU | Feature-gated embeddings/classifier after evaluation and cost/security gates. |
| 9 - Hardening | Privacy, security, load, quality, rollback, observability, production certification. |

## 89. MVP production launch gate

• Human Chat and Seller Inbox remain usable through automation, model, budget and quality-queue failure.

• All four subjects, exact Product-from-Scene revision provenance, optional selectors and exclusive ORDER context pass.

• Multi-Product Scene never guesses a Product; PRIVATE current context fails safely and historical context cannot reveal private revisions.

• English automated text/chips, unsupported-locale chips and authorized human-takeover multilingual text are API-enforced.

• Model prose cannot become a Buyer answer. Every response retains trigger, intent/template/config/slot/classifier provenance.

• Seller setup and category/Scene knowledge are versioned; English source is retained; no canonical commerce fields are duplicated as authority.

• Seller green/yellow/red review, structured case binding and separate Operator capabilities/audit pass; feedback never changes production automatically.

• Buy always enters Checkout final review, explicit confirmation and material reconfirmation with server fee snapshot. Provider/backend alone establishes paid state.

• Localization completeness is recorded without fixed score or guaranteed exposure; FYP and answers remain functional with optional integration disabled.

• Shared outbox/job-intent relay, PostgreSQL durability, Valkey recovery, privacy, security, regression, cost and load gates pass.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 90. Explicitly deferred

● Autonomous checkout or agentic payment tools.

● Long-term conversational entity memory.

● LLM-generated Seller policy or Buyer-facing answer prose.

● Multimodal understanding of images/video.

● Native video NLU/transcripts.

● Automatic Product detection from Scene media.

● Free-form non-English automated NLU before locale engine approval.

● Automatic learning directly from Seller feedback.

● Unreviewed translation qualifying as localization-quality evidence.

• A distinct Creator persona, intent namespace or NLU architecture is deferred unless separately ratified; admitted Creator-as-Seller uses the normal Seller model.

## 91. Core invariants

• CHATBOT-INV-01 Model never generates Buyer answer prose.

• CHATBOT-INV-02 BotTurn uses immutable triggering Message.

• CHATBOT-INV-03 Subjects = NONE / PRODUCT_POST / SCENE_POST / ORDER.

• CHATBOT-INV-04 Product-from-Scene uses Scene as provenance only.

• CHATBOT-INV-05 Commerce truth comes from owning domains.

• CHATBOT-INV-06 Multi-Product Scene ambiguity is recovered/escalated, never guessed.

• CHATBOT-INV-07 English automation supports text + chips.

• CHATBOT-INV-08 Unsupported-language automation is unavailable; human text is accepted privately in WAITING_FOR_HUMAN without guessed NLU.

• CHATBOT-INV-09 Human takeover may use free text according to Chat policy.

• CHATBOT-INV-10 Buy cannot skip Checkout review.

• CHATBOT-INV-11 Provider/backend verification establishes payment success.

• CHATBOT-INV-12 Timeline events do not enter NLU as authored text.

• CHATBOT-INV-13 Seller feedback cannot auto-modify production.

• CHATBOT-INV-14 English configuration remains canonical source.

• CHATBOT-INV-15 Localization completeness does not guarantee organic rank or fixed multiplier.

• CHATBOT-INV-16 Recommendation owns all ranking weights.

• CHATBOT-INV-17 PostgreSQL is durable truth.

• CHATBOT-INV-18 Human Chat survives automation failure.

• CHATBOT-INV-19 Scene lifecycle is Content-owned.

• CHATBOT-INV-20 Quality Operators authenticate through separate Operator Accounts.

• CHATBOT-INV-21 Historical response/config/slot provenance is immutable; new reviewed knowledge versions affect future turns only.

• CHATBOT-INV-22 Chatbot readiness cannot change Content publication or visibility.

• CHATBOT-INV-23 Localization revocation updates future evidence and never rewrites historical BotTurns.

## 92. Final system architecture

Persist the trigger Message before automation. The context-aware cascade resolves an approved intent, typed domain slots and an immutable approved locale template; uncertainty or missing authority escalates to the human Seller. BotTurn preserves exact historical provenance.

![Private any-language waiting support with bounded attachments](graphics/CHATBOT_04.svg)
*Figure 04. Private any-language waiting support with bounded attachments. Money is never established by Chat; original text and private evidence remain purpose-bound.*

Seller Console authors English source and approved versioned localized knowledge. Seller review creates bounded feedback cases for separately authenticated quality Operators; reviewed changes require regression and approved release. Optional quality evidence crosses to Recommendation without ranking control.

![Private any-language waiting support with bounded attachments](graphics/CHATBOT_05.svg)
*Figure 05. Private any-language waiting support with bounded attachments. Money is never established by Chat; original text and private evidence remain purpose-bound.*

## 93. Final engineering doctrine

The Chatbot resolves meaning while typed domains establish truth and approved templates communicate it. Human Chat handles uncertainty. Seller feedback improves future controlled versions through review; localization expands coverage and may supply optional bounded quality evidence, with organic rank owned entirely by Recommendation.

## 94. Required dependent-design updates

Dependent designs consume the following current contracts.

| System | Required current alignment |
| --- | --- |
| Chat / Mobile / Companion | Immutable subjects/Scene provenance, selectors, human takeover, deterministic Bot display and Seller review controls. |
| Seller Console | English source/category/Scene authoring, explainable readiness, versioned localization, Test Chatbot and feedback history. |
| Operator Console / Auth | Separate Operator Accounts and narrow quality capabilities; case/evidence scope, approved versioned release and kill switches. |
| Recommendation | Optional bounded quality evidence; independent feature adoption/caps/version/experiment; no fixed localization multiplier or exposure guarantee. |
| Market Configuration | Supported locales, locale/schema/capability versions; Ethiopia-first activation. |
| Analytics | Safe resolution, subject, feedback and quality evidence metrics; no raw private Chat text. |
| Notifications | Current ordinary Seller recipients for escalation; separate Operator recipients for urgent quality attention. |
| Privacy / Claims | Bounded immutable BotTurn/feedback evidence and valid holds. |
| Deployment / Eventing | Optional pgvector certified before enabling; shared PostgreSQL outbox/job-intent relays, BullMQ/Valkey execution. |

## 95. Seller-side permission boundary

Configuration remains Seller Console-first. Seller Companion users who can read the conversation may submit quality feedback if granted the narrow feedback capability, but they do not gain template/intent/configuration authority merely because they can rate a response.

```
chatbot.view
chatbot.configure        // Console
chatbot.test             // Console
chatbot.analytics        // Console / permitted insights
chatbot.feedback:submit  // Companion/Console where granted
```

## 96. Test Chatbot tool

Seller Console retains a clearly labeled Test Chatbot surface. Test traffic uses the same intent/template/slot logic but is excluded from Buyer demand, containment, Recommendation, Trust and normal production quality metrics. It must not create payment attempts, Orders, Claims or real escalations.

## 97. Feature flags and kill switches

● Enable/disable classifier independently of human Chat.

● Enable/disable optional embedding Layer 3 independently.

● Disable one unsafe intent/template version without taking down the full bot.

● Disable optional localization-quality evidence ingestion separately from chatbot answering if Recommendation integration is unhealthy.

● Disable Seller review controls without losing existing feedback cases.

● All flags are operational controls, not authorization or commerce truth.

## 98. Decision register

The current decision register preserves deterministic answering and independent domain authority.

| Decision | Current MVP status |
| --- | --- |
| Model classify-only; deterministic Buyer answers | Required. |
| NONE / PRODUCT_POST / SCENE_POST / ORDER | Required; exact immutable provenance. |
| English text/chips; unsupported automated locales chips | WAITING_FOR_HUMAN: original any-language free text accepted privately; optional localized chips; no English-only NLU route or immediate-response promise. |
| Seller green/yellow/red review and structured Operator case | Required; separate privileged Operator principal. |
| English knowledge source; optional approved versioned localization | Required source; optional additive coverage. |
| Fixed localization score / impression promise | Removed from current architecture. |
| Optional bounded Recommendation quality evidence | Independent Recommendation adoption; can be fully disabled. |
| Checkout review / explicit confirmation / PSP authority | Required. |
| Automatic production learning from Seller feedback | Prohibited. |
| Autonomous commerce / Creator-specific NLU | Deferred unless separately approved. |

## 99. Glossary

Definitions used in this current complete edition.

| Term | Current meaning |
| --- | --- |
| Ordinary Account | One human identity across Buyer/Seller/Courier relationships; roles/context remain resource scoped. |
| Operator Account | Separate privileged internal principal, credentials, OPERATOR session and typed audit. |
| Scene Post | Canonical captioned image content with exact same-Seller Product/revision relationships. |
| PUBLIC / PRIVATE | Content visibility independent of publication and Moderation; stock-private can restore after all gates pass. |
| Product Post | Structured commerce destination for exactly one Product; current Catalogue/Inventory truth. |
| Market activation | Approved runtime commerce scope; Ethiopia first, globally extensible future routes. |
| PSP | Payment service provider; authenticated backend/provider facts establish money state. |
| Launch surcharge / 0 bps | Current explicit Buyer Checkout surcharge; exact server policy snapshot. |
| Outbox / job_intent | PostgreSQL records atomically preserve facts or direct/deadline async intent. |
| BullMQ / Valkey | Sole ordinary job engine and its execution/cache datastore; non-canonical. |
| BotTurn | Immutable trigger/response, intent/template/config/slot/classifier provenance. |
| SlotResolver | Typed authoritative domain reader; no inferred stock/price/payment. |
| NO_MATCH | Classifier found no approved intent; recover or escalate safely. |
| SELECT_PRODUCT_CONTEXT | Deterministic recovery for Scene-specific Product ambiguity. |
| Localization quality | Versioned bounded evidence; no score formula or guaranteed exposure. |
| Feedback case | Bounded Seller yellow/red report; separately authorized Operator review; no auto-learning. |

## 100. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-01 — Buyer-facing Product / Scene terminology | The 13 October designs use Product Post and Scene Post as canonical domain names. | Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly. | PR-001 / PR-005, 26-27 Oct 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
