# Adulis Data Protection Impact Assessment
Version 1.1 | 12 October 2026 | DOCUMENT-CORRECTED

## Document control

Complete amended baseline: 12 October 2026. The supplied correction prompt and owner decisions supersede the conflicting reviewed source wording. Every original numbered body section and unaffected table/graphic is retained; targeted contracts, examples, tests, invariants and dependent definitions are reconciled. The historical audit remains unchanged.

| Document control | Amendment baseline |
| --- | --- |
| Version history | 1.0 reviewed 8 October 2026 -> 1.1 amended 12 October 2026. |
| Source | ADU-DPIA-01_Adulis_Data_Protection_Impact_Assessment_v1.0.pdf |
| Authority | 19 selected corrections / F01-F18 and owner product decisions. |
| Status | DOCUMENT-CORRECTED; implementation, integration tests and external approvals not established. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |

## 1. Document Control

| Field | Assessment baseline |
| --- | --- |
| dpia_id / version / status | ADU-DPIA-01 / 1.1 / DRAFT; decision LEGAL REVIEW REQUIRED. |
| Scope / Markets | Marketplace, discovery, commerce, Trust, safety and operations; Ethiopia / Addis Ababa; Fashion, Cosmetics, Electronics. |
| Processing version / references | Amended canonical architecture baseline 12 October 2026; reviewed source baseline 8 October 2026. Current subsystem and PRV/OBS/CSP revisions; see Appendix F. |
| Inventory / risk model | PRV 40-class inventory; processor inventory draft 1.0; risk model LxI 1.0. |
| Created / reviewed / next review | Created 8 October 2026; document amended 12 October 2026. Authorized review NOT EVIDENCED; before pilot/every material change. Proposed quarterly internal review still requires Privacy/Legal adoption. |
| Approvers / supersedes | Role-based sign-off in Section 58; all NOT SIGNED; supersedes none. |
| Controlled status vocabulary | DRAFT; UNDER_REVIEW; MITIGATION_REQUIRED; LEGAL_REVIEW_REQUIRED; PRIOR_CONSULTATION_REQUIRED; APPROVED_WITH_CONTROLS; APPROVED; SUPERSEDED. Only authorized governance changes status. |

Evidence status: the supplied system designs and task specifications establish intended architecture, not deployed controls. No production configuration, executed security/deletion drills, processor contract, signed lawful-basis decision or named legal approval was supplied. Controls below are PLANNED unless a separately recorded test/configuration/contract proves IMPLEMENTED. Unverified control effectiveness cannot reduce the actual residual-risk finding.

## 2. Executive Summary

Adulis combines private commerce and conversations, identifiable content, behavioural discovery, Seller reputation and scoped delivery location. These create material risks to confidentiality, physical safety, fair commerce opportunities and people's ability to challenge decisions. This assessment records 30 activities and 35 specific risk scenarios with owners, verification and projected control effects.

Conclusion: LEGAL REVIEW REQUIRED. Production readiness also requires documented mitigations and verified controls. Actual active processors, processing regions, lawful bases, minors policy, required registration/DPO arrangements, retention values and Authority authorization/consultation remain OPEN. This draft does not authorize pilot processing or public launch.

The architecture avoids Government-ID admission, biometric verification, default Chat training, offline receipt and invasive fingerprinting. Those limits reduce planned scope, but are not evidence that deployed systems already enforce them.

## 3. Purpose

Evaluate likely impacts on people before processing and before material change; determine necessity/proportionality, safeguards, remaining risks, governance and launch conditions. Provide an Adulis-specific review pack for Privacy/DPO, Ethiopian legal counsel, engineering/product and the Authority where required.

The DPIA assesses risk; Privacy owns lifecycle execution, CSP browser resources, OBS operational detection and each domain its own facts. Neither document silently overrides another. A processing purpose change requires both implementation review and risk reassessment.

## 4. Legal / Regulatory Baseline

Ethiopia Personal Data Protection Proclamation No. 1321/2024 is the initial legal baseline [L01]. Article 47 concerns DPIA and Article 48 prior authorization/consultation. Article 43 provides the controller-awareness 72-hour Authority notification clock; Article 44 separately addresses data-subject communication. Legal/privacy authority applies conditions and records determinations; engineering neither invents exemptions nor certifies compliance.

Article 44 separately sets data-subject communication within 72 hours of awareness, subject to its stated conditions/exceptions. Legal applies them with evidence; they do not automatically exempt Authority notification under Article 43.

The official Ministry of Justice proclamation text is the legal source [L01]. Article 47 screening and Article 48 prior authorization/consultation require authorized legal interpretation. Assess Article 48 independently of the residual-risk score; do not import a narrower foreign-law rule.

The ECA privacy portal [L02] and any current implementing guidance/form must be verified by counsel before submission. An indexed draft ECA manual is not a verified binding rule or completed regulator form. This document has not been submitted or accepted.

Do not invent retention periods, lawful bases, DPO/registration exemptions, rights-response deadlines, minors rules or transfer mechanisms. Record LEGAL REVIEW REQUIRED where unresolved. Internal engineering limits/cadences are explicitly proposals, not statutory values.

## 5. DPIA Trigger / Screening

| Screening criterion | Finding / reason / action |
| --- | --- |
| Rights/freedoms risk by nature, scope, context or purpose | YES: linked transactions, Chat, addresses, GPS, reputation, profiling and privileged evidence access warrant assessment. |
| Systematic/extensive automated evaluation with legal or similarly significant effects | UNCERTAIN: FYP, Trust and moderation affect exposure/reputation and potentially Seller livelihood. Product/Legal must establish actual decision scale, human discretion and legal significance. |
| Large-scale sensitive-data processing | UNCERTAIN: no admission ID/biometrics; Chat, Claims or queries may incidentally contain sensitive content. Actual categories/volume and legal classification unverified. |
| Systematic large-scale monitoring of publicly accessible areas | UNCERTAIN: bounded delivery GPS is not assumed equivalent to public-area surveillance. Confirm collection scope, scale and interpretation. |
| Other Authority-required criteria / guidance | LEGAL REVIEW REQUIRED: check current ECA instructions, required assessment form and processing authorization. |
| New Markets, ID, biometrics, AI advice, unratified Creators | NOT APPLICABLE to current release; automatic reassessment trigger before activation. |

Screening outcome: conduct DPIA now. YES/UNCERTAIN triggers investigation, not automatic legal approval. Record source, reviewer/date, actual processing evidence and any Authority response.

## 6. Scope

Ethiopia is the initial active commerce Market, beginning with Addis Ababa. Future countries/providers require explicit legal, currency, commercial and operational activation. Locale, IP address, phone prefix and client country do not activate commerce. Actual provider routing and processing regions must be verified from production configuration.

Include Company Website/waitlist, Mobile Buyer/Seller/Courier, Seller Console, Seller Storefront and Operations Console; Auth, content/discovery, commerce/provider records, fulfilment, Handoff, Reviews, Trust, Claims, moderation, Chat/support, telemetry, lifecycle, processors and recovery.

Exclude active future Markets/providers, Government-ID admission, biometric receipt, AI Seller advice in MVP/Phase 1 and unratified Creator catalogue. They are change triggers, not processing approved by this assessment. Product-only TikTok embed remains conditional until the exact integration/privacy review is approved.

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

## 7. Assumptions

Evidence status: the supplied system designs and task specifications establish intended architecture, not deployed controls. No production configuration, executed security/deletion drills, processor contract, signed lawful-basis decision or named legal approval was supplied. Controls below are PLANNED unless a separately recorded test/configuration/contract proves IMPLEMENTED. Unverified control effectiveness cannot reduce the actual residual-risk finding.

Actual user volumes, feature activation, data regions, processors/subprocessors, network flows, public privacy notices and contracts are VERIFY PRODUCTION CONFIGURATION. No fabricated production count or statutory period is used.

Ordinary Account policy is selected 18+ declaration; legal known-underage/incidental-subject handling remains OPEN. Do not assume all users are adults or that a phone/Seller business establishes age. Determine age-related restrictions, notices, safeguarding and any lawful guardian requirements before launch without defaulting to Government-ID collection.

Claims/Chat/media can contain unexpected personal/sensitive data. Classify and restrict it; do not assume photos or free text are harmless. Lawful-basis candidates below require Ethiopian legal confirmation.

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

## 8. System Overview

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one current non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Multiple roles union permissions within that membership; ownership and Courier relationships do not consume the TEAM limit. Different humans use different Accounts.

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

Content owns Scene Post publication DRAFT/PUBLISHED/ARCHIVED separately from visibility PUBLIC/PRIVATE. A public Scene requires same-Seller eligible Product Post tags with at least one available Product, valid photo media/caption and current Seller, Market and safety gates. Loss of the last available tagged Product changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Eligible restock can restore PUBLIC after every current gate passes; it does not clear independent archive/moderation restrictions or require manual republishing solely for restock.

Finance/Payments alone establishes canonical payment, refund and settlement facts from authenticated provider callbacks and/or backend verification matched to the exact attempt/reference, Seller Order, amount and currency. Client return navigation, Seller statements and screenshots never establish PAID. Checkout snapshots merchandise, delivery, the zero launch Adulis Buyer surcharge (0 bps), exact currency rounding, Buyer total and Commercial Policy version before explicit confirmation. Payment, provider settlement and physical receipt are independent.

The owning PostgreSQL transaction commits state plus event_outbox and/or job_intent. The shared relay leases intent, records versioned event_delivery consumer work and enqueues deterministic BullMQ jobs on Valkey after commit. BullMQ is the sole ordinary execution engine. Delivery is at-least-once; workers re-read current owner state and suppression/hold policy and use database uniqueness/processed-effect markers. Reconciliation and bounded dead-letter recovery prevent correctness-sensitive PostgreSQL-to-Valkey dual writes.

![Actual processing evidence must match the assessed data map](graphics/DPIA_01.svg)
*Figure 01. Actual processing evidence must match the assessed data map. Designed routes are not deployment proof; all active processors and regions require verification.*

| Layer | Approved current technology and role |
| --- | --- |
| Backend / data | Node.js, NestJS, Fastify, TypeScript strict; Drizzle ORM, PostgreSQL; pg_trgm, btree_gist, pg_stat_statements. |
| Async / API | Valkey + BullMQ; REST, OpenAPI, @nestjs/swagger, generated TypeScript client; PostgreSQL event_outbox/job_intent remains durable authority. |
| Security / media | @nestjs/throttler, @fastify/helmet, libphonenumber-js; Cloudflare R2, Cloudflare CDN, Sharp. |
| Mobile | React Native, Expo, Expo Router, TanStack Query, FlashList, Expo Image, Expo SecureStore, Expo SQLite, Expo Camera, Expo Notifications, Expo Updates; small Zustand store. |
| Quality / visibility | Jest, Testcontainers, Maestro, Playwright, k6; Sentry, Pino structured logs, pg_stat_statements; dependency-cruiser. |
| Delivery | Docker, GitHub Actions, Render, Cloudflare, EAS. No unapproved runtime, governance service or second worker engine is added. |

## 9. Actors / Data Subjects

| People / role | Data and possible consequence |
| --- | --- |
| Buyer / prospective visitor / waitlist contact | Phone, preferences, private saved items, purchase/support history; disclosure, manipulation or unwanted contact. |
| Seller OWNER / TEAM / business contact | Representative identity, social control, content, reputation and access; exclusion, income harm, wrong-tenant disclosure. |
| Courier / delegated recipient | Assignment, location, recipient contacts and receipt evidence; stalking, misdelivery or purpose misuse. Delegate need not have an Account. |
| Review author / claimant / reported person | Public presentation and private statements/evidence; harassment, reputation harm and counterparty exposure. |
| Person depicted / incidental third party | Identifiable image or text submitted by another person; removal/complaint and fair retention assessment. |
| Operator / staff / processor contact | Separate privileged identity, decisions and accountability; employment/contact privacy and misuse investigation. |
| Minor / vulnerable person | Possible participant or incidental subject; actual policy and safeguards OPEN PRODUCT + LEGAL. |

## 10. Ordinary vs Operator Account

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one current non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Multiple roles union permissions within that membership; ownership and Courier relationships do not consume the TEAM limit. Different humans use different Accounts.

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

An ordinary Account may exit a Seller/Courier relationship while remaining Buyer. Account deletion evaluates every current relationship; Operator termination revokes privileged credentials but preserves justified audit provenance. Delegated receipt transfers no account ownership, Chat/Claim access or Review authorship. SYSTEM is a distinct service principal.

## 11. Data Categories

| Category | Adulis scope / safeguards |
| --- | --- |
| Identity / authentication | Phone/profile/session/security references, social-control result, separate Operator identity. No admission Government ID or biometric matching. |
| Commerce / financial | Cart/Checkout, Seller Order/line, provider references and amount/currency, surcharge, refund/settlement; no screenshot payment truth. |
| Private communication / case evidence | Chat, bounded Chatbot input, selected Claim/moderation evidence and delegate contact; sensitive content possible. |
| Location / fulfilment | Home delivery address and active-delivery Courier GPS; bounded purpose/precision/windows, strict access. |
| Content / reputation | Products/Scenes/photos/revisions, public Reviews and internal eligibility, Trust/moderation decisions; incidental identifiable people. |
| Preference / derived / security | Collections, Search/FYP affinities, first-party events, aggregated Seller reports, logs/CSP observations and audit. |
| Recovery / governance | Backups, suppression ledger, rights tasks, scoped holds and processor completion records. |

Map all 40 classes to policies in Appendix A. Pseudonymous linkage remains personal data; aggregation is anonymous only after a credible re-identification assessment.

## 12. Processing Activity Register

All activity locations are VERIFY PRODUCTION CONFIGURATION; listed technology is architecture, not independently verified active processing. Frequency is event-driven for commands/observations; GPS only during eligible active delivery; backups only under approved recovery schedule. Actual volume, peak rate, recipients and geographic scale must be measured before pilot. Every candidate basis is LEGAL REVIEW REQUIRED. Each policy stem is a proposed PRV linkage; exact duration is not approved.

### PA-01 - Auth and recovery

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Authenticate and secure one human; Accounts; Operators separately |
| Data / source | Phone/profile, session/device security metadata; source: User and Auth challenges |
| Recipient / owner | Authorized human, Auth and active SMS adapter; owning domain: Auth / Operator Auth |
| Storage / processor / location | PostgreSQL; device SecureStore; transient Valkey; SMS; hosting; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | auth-security; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract/security candidates; not approved. |
| Automation / consequence | Sessions and risk checks can deny access |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-02 - Seller onboarding

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Admit legitimate Seller business; OWNER/TEAM; business contacts |
| Data / source | Business profile and representative relationship; source: Seller submissions/current owner state |
| Recipient / owner | Scoped Seller and separate verification Operator; owning domain: Onboarding / Seller |
| Storage / processor / location | PostgreSQL; selected private evidence R2; Hosting/media; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | seller-core; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract / legitimate-purpose candidates; not approved. |
| Automation / consequence | Eligibility and readiness restrict publication |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-03 - Social verification

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Verify TikTok/Instagram account control; Seller representative; social account owner |
| Data / source | Minimum social ID/result, protected operational token, DM challenge evidence; source: Official provider callback or selected challenge |
| Recipient / owner | Scoped Operator and approved social provider; owning domain: Onboarding |
| Storage / processor / location | PostgreSQL; secrets restricted operational store; TikTok/Meta if activated; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | social-control; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract/security candidates; not approved. |
| Automation / consequence | Control result informs admission; review possible |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-04 - Product publication

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Present sellable Products; Seller; depicted people |
| Data / source | Description/options/prices/photo revisions; source: Seller upload |
| Recipient / owner | Public viewers for approved published data; owning domain: Catalogue / Media |
| Storage / processor / location | PostgreSQL; R2/CDN public derivatives; Cloudflare if activated; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | catalogue-history; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract / content permission candidates; not approved. |
| Automation / consequence | Validation/moderation may restrict item |
| Initial risk / verification | Moderate design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-05 - Scene publication

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Photo merchandising with same-Seller Product tags; Seller; depicted/incidental people |
| Data / source | Photo/caption/tags, publication and visibility; source: Seller and current Inventory gates |
| Recipient / owner | Public only while hard gates pass; Seller private access; owning domain: Content / Media |
| Storage / processor / location | PostgreSQL; R2/CDN; Cloudflare if activated; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | scene-content; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract / content permission candidates; not approved. |
| Automation / consequence | Last available tag lost makes PRIVATE, not purge |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-06 - For You recommendations

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Relevant photo Scene discovery; Buyers; Sellers |
| Data / source | First-party affinity/feedback and purchase-quality features; source: Permitted observations and owner outcomes |
| Recipient / owner | Buyer ranked feed; aggregate governance reviewers; owning domain: Recommendation |
| Storage / processor / location | PostgreSQL features; bounded cache; Hosting; no external ad broker baseline; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | recommendation-personal; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Personalization basis requires review; not approved. |
| Automation / consequence | Ranking affects exposure; limited new-Seller exploration |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-07 - Marketplace Search

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Find Product Posts, Sellers and Scene Posts; Buyers; Sellers |
| Data / source | Query, bounded preferences, current public projections; source: Buyer query and owner facts |
| Recipient / owner | Buyer results; approved aggregate measurement; owning domain: Search |
| Storage / processor / location | PostgreSQL/search projection; bounded cache; Hosting; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | search-personal; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: User-requested service candidate; not approved. |
| Automation / consequence | Ranking affects discovery; private Scene excluded |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-08 - Collections

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Private saved Product/Scene preferences; Buyer |
| Data / source | Names/order/memberships; source: Buyer actions |
| Recipient / owner | Owner Buyer only; public item resolved with current gates; owning domain: Collections |
| Storage / processor / location | PostgreSQL; Hosting; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | collection-private; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract candidate; not approved. |
| Automation / consequence | PRIVATE Scene unresolved to Buyer; saved ref does not grant access |
| Initial risk / verification | Moderate design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-09 - Buyer-Seller Chat

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Private commerce communication; Buyer; scoped Seller members; incidental subjects |
| Data / source | Messages and NONE/PRODUCT_POST/SCENE_POST/ORDER subjects; source: Conversation participants |
| Recipient / owner | Authorized participants; selected case promotion only; owning domain: Chat |
| Storage / processor / location | PostgreSQL; attachment R2 if allowed; Hosting/media; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | chat-ordinary; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract / communication basis review; not approved. |
| Automation / consequence | No default training; context does not grant Order rights |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-10 - Deterministic Chatbot

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Bounded Buyer support; Buyer; Seller |
| Data / source | Intent/template/session and selected anchors; minimized text; source: Buyer/support conversation |
| Recipient / owner | Buyer and authorized support context; owning domain: Chatbot |
| Storage / processor / location | PostgreSQL; Hosting; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | chatbot-support; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Service-support candidate; not approved. |
| Automation / consequence | Template answer; no independent financial or legal decision |
| Initial risk / verification | Moderate design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-11 - Cart and Checkout

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Explicit purchase confirmation; Buyer; Seller |
| Data / source | Product selections, exact commercial snapshots, address; source: Buyer and current Catalogue/Inventory |
| Recipient / owner | Exact Buyer/Seller order participants; Finance references; owning domain: Checkout |
| Storage / processor / location | PostgreSQL; attempt-bound allocation; Hosting; PSP adapter; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | checkout-session; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract candidate; not approved. |
| Automation / consequence | Material changes require reconfirmation |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-12 - Provider payment

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Verify money and refund state; Buyer; Seller |
| Data / source | Attempt/reference, amount/currency, zero-bps launch surcharge/result; source: Authenticated provider and backend match |
| Recipient / owner | Restricted Finance; safe Order outcome; owning domain: Finance |
| Storage / processor / location | PostgreSQL; bounded raw exception evidence; Actual PSP unverified; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | provider-payment; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract/accounting candidate; not approved. |
| Automation / consequence | Provider facts establish PAID; client return does not |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-13 - Settlement and provider onboarding

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Provider readiness and payout reconciliation; Seller representatives |
| Data / source | Provider account/status/ref, settlement/refund; hosted KYC; source: Provider/Seller Finance workflow |
| Recipient / owner | Approved provider; scoped Finance Operators; owning domain: Finance |
| Storage / processor / location | PostgreSQL minimal ref; KYC stays provider where possible; Actual PSP/KYC processor unverified; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | provider-readiness; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract/legal duty candidates; not approved. |
| Automation / consequence | Readiness/payout eligibility separate from Seller admission |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-14 - Fulfilment and assignment

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Complete exact paid Seller Order; Buyer; Seller; Courier |
| Data / source | Address, assignment, delivery instructions/timestamps; source: Buyer and owner assignment facts |
| Recipient / owner | Current assigned actor sees minimum fulfilment data; owning domain: Fulfilment |
| Storage / processor / location | PostgreSQL; Hosting; activated delivery adapter only; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | fulfilment-evidence; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract candidate; not approved. |
| Automation / consequence | Assignment limits access; reassign invalidates prior scope |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-15 - Courier GPS

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Support active delivery operational evidence; Courier; nearby/incidental subjects |
| Data / source | Purpose-limited PICKUP/DELIVERY point/status from optional foreground device permission; precise points remain restricted, ordinary surfaces show milestones. |
| Recipient / owner | Scoped delivery parties/operations where necessary; owning domain: Fulfilment |
| Storage / processor / location | PostgreSQL two optional foreground checkpoint records (PICKUP/DELIVERY), no route/history/Analytics copy; approved hosting; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | At most the two best-effort foreground checkpoint attempts for this delivery; no periodic/background sampling. Production scale OPEN. |
| Retention / lawful-basis status | delivery-location; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Location basis requires review; not approved. |
| Automation / consequence | GPS supports delivery; never proves receipt |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-16 - Handoff verification

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Establish physical custody receipt online; Buyer; Seller; Courier; delegate |
| Data / source | Stage/method/result/digest metadata, exact assignment; source: Connected presenter and designated recipient |
| Recipient / owner | Scoped owner evidence and selected Claim reviewers; owning domain: Handoff |
| Storage / processor / location | PostgreSQL; transient credential only; Hosting; active SMS for OTP; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | handoff-evidence; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Contract/security candidate; not approved. |
| Automation / consequence | QR/OTP/approved Manual accepted; PICKUP no Review Grant |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-17 - Delegated receipt

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Authorize one recipient for final Collection or delivery; Buyer; delegate |
| Data / source | Name/phone, authorization/control result; source: Buyer authorization and recipient verification |
| Recipient / owner | Current presenter/recipient workflow only; owning domain: Handoff |
| Storage / processor / location | PostgreSQL bounded contact; Active SMS/push as applicable; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | delegate-identity; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Delegate-processing basis review; not approved. |
| Automation / consequence | No delegate Order/Claim/Review ownership |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-18 - Reviews and Grants

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Verified purchase-quality/service feedback; Buyer author; Seller; mentioned people |
| Data / source | Buyer opinion plus private FINAL_HANDOFF or VERIFIED_ORDER_FAILURE eligibility and safe remedy annotation; source: Buyer, accepted final receipt or upheld eligible Seller-fault decision. |
| Recipient / owner | Public approved content; eligibility restricted; owning domain: Reviews |
| Storage / processor / location | PostgreSQL; Hosting; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | review-content; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Feedback publication basis review; not approved. |
| Automation / consequence | One Buyer/paid Seller-Order container across both bases; Product quality only for received lines; correction lineage retained. |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-19 - Trust evaluation

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Evidence-based marketplace reputation; Seller; associated people |
| Data / source | NEW/REBUILDING/ESTABLISHED/TRUSTED, versioned evidence; source: Canonical outcomes and reviewed case decisions |
| Recipient / owner | Public bounded indicator; restricted provenance; owning domain: Trust |
| Storage / processor / location | PostgreSQL; Hosting; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | trust-history; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Reputation basis requires review; not approved. |
| Automation / consequence | Exposure/commerce consequence; correction and challenge required |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-20 - Claims and disputes

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Human resolution of one Seller Order; Buyer; Seller; Courier; delegate; third parties |
| Data / source | Selected statements, exact revisions and provider/receipt facts; source: Parties and source owners |
| Recipient / owner | Case-scoped separate Operator; minimum counterparty evidence; owning domain: Claims |
| Storage / processor / location | PostgreSQL; private R2; Hosting/media; provider remedy adapter; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | claim-evidence; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Dispute/accountability candidates; not approved. |
| Automation / consequence | Allegations not findings; provider confirms refunds |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-21 - Moderation and abuse

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Keep people and commerce safe; Reporter; reported Seller/Buyer; depicted person |
| Data / source | Selected report/revision, decision and appeal provenance; source: Reports/automated flags and human assessment |
| Recipient / owner | Scoped safety Operator; public removal outcome only; owning domain: Moderation |
| Storage / processor / location | PostgreSQL; restricted R2; Hosting/media; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | moderation-evidence; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Safety basis requires review; not approved. |
| Automation / consequence | False suspension harms legitimate Seller; appeal necessary |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-22 - Notifications

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Purpose-bound operational/security communication; Account; delegate; Operator |
| Data / source | Channel preferences, tokens and safe notice refs; source: Owner facts and user preferences |
| Recipient / owner | Ordinary logical Account Notification under Notifications; no-Account guest transport intent separately Handoff-owned on existing SMS adapter. |
| Storage / processor / location | PostgreSQL; device token; transient queue; SMS/push processors if active; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | notification-history; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Service / consent categories review; not approved. |
| Automation / consequence | No lockscreen secret or unrelated marketing reuse |
| Initial risk / verification | Moderate design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-23 - First-party Analytics

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Measure declared product/business outcomes; Buyers; Sellers; Couriers |
| Data / source | Typed event refs, attribution and bounded derived facts; source: Connected in-memory observations plus owner outcomes |
| Recipient / owner | Restricted internal analysts; aggregates only externally; owning domain: Analytics |
| Storage / processor / location | PostgreSQL; bounded in-memory Mobile batch; Hosting; no fingerprinting service baseline; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | analytics-raw; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Measurement basis requires review; not approved. |
| Automation / consequence | Raw linkage can identify; suppress/delete person profiles |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-24 - Seller Analytics

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Aggregate business insight without Buyer identity; Seller; underlying Buyers |
| Data / source | Thresholded trends, conversion/quality metrics; source: Privacy-reviewed Analytics projections |
| Recipient / owner | Exact scoped Seller OWNER/authorized TEAM; owning domain: Analytics |
| Storage / processor / location | PostgreSQL aggregate views; Hosting; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | analytics-raw; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Aggregate service basis review; not approved. |
| Automation / consequence | Small cohorts require suppression; no raw Buyer drilldown |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-25 - Operator operations

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Govern marketplace with accountable privilege; Operators; all case subjects |
| Data / source | Separate identity, case scope, approved read/action audit; source: Internally provisioned account and owner records |
| Recipient / owner | Capability/purpose-bound Operator; no impersonation; owning domain: Operator Auth / respective domain / Audit |
| Storage / processor / location | PostgreSQL; separate sessions; Hosting; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | privileged-audit; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Governance/security candidates; not approved. |
| Automation / consequence | Can restrict/resolve cases only within exact authority |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-26 - Observability and security

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Detect failures/abuse without evidence shadow archive; Users/Operators incidentally |
| Data / source | Redacted route/result/release, query aggregates and safe security signal; source: Pino/Sentry/infrastructure |
| Recipient / owner | Approved technical responders; restricted exports; owning domain: Observability / Security |
| Storage / processor / location | Approved telemetry/log store; actual region unverified; Sentry/hosting/CDN if active; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | security-telemetry; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Security/operations basis review; not approved. |
| Automation / consequence | Observation not verdict; no raw private payload |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-27 - Privacy rights and lifecycle

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Provide rights, scoped retention and deletion proof; Ordinary Accounts; Operators; counterparties |
| Data / source | Requests/tasks/policy refs, selected export and narrow holds; source: Verified subject/Operator and owner handlers |
| Recipient / owner | Verified requester; typed authorized reviewers; owning domain: Privacy / owner domain |
| Storage / processor / location | PostgreSQL; private short-lived R2 export; Active owner processors; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | privacy-accountability; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Rights/legal duty candidates; not approved. |
| Automation / consequence | No entire-counterparty export; retained evidence minimized |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-28 - Backups and restore

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Recover service while respecting deletion; All retained subjects |
| Data / source | Restricted historical copies and suppression ledger; source: Approved canonical stores |
| Recipient / owner | Authorized restore personnel only; owning domain: Deployment / Privacy |
| Storage / processor / location | Backup vault/storage actual region unverified; Hosting/backup processor unverified; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | backup-recovery; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Recovery/security candidates; not approved. |
| Automation / consequence | Restore suppression replay before traffic prevents resurrection |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-29 - CSP reporting

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Observe blocked browser resource attempts; Browser user incidentally |
| Data / source | Minimized directive/source category/release; no secret URL; source: Unauthenticated browser report |
| Recipient / owner | Bounded security responders only; owning domain: Security / Observability |
| Storage / processor / location | Minimized telemetry; raw body discarded; Hosting/edge; Sentry only safe routing; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | security-telemetry; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Security basis requires review; not approved. |
| Automation / consequence | Untrusted report cannot mutate business or policy |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

### PA-30 - Processor and transfer governance

| Register field | Activity-specific assessment |
| --- | --- |
| Purpose / subjects | Control external processing and termination; All affected subjects; supplier contacts |
| Data / source | Purpose/data/region/contracts and completion proofs; source: Configuration, contracts and owner adapters |
| Recipient / owner | Authorized Privacy/Legal/security owners; owning domain: Privacy / Procurement / Deployment |
| Storage / processor / location | PostgreSQL governance metadata; processor copies tracked; Actual active list unverified; VERIFY PRODUCTION CONFIGURATION. |
| Frequency / scale | Event-driven for this purpose, scheduled only for declared backup/lifecycle tasks; no general location sampling. Production counts/rates OPEN; Ethiopia-first context. |
| Retention / lawful-basis status | processor-governance; PRV trigger/action in Appendix A; exact duration LEGAL REVIEW REQUIRED. Candidate: Legal/governance basis review; not approved. |
| Automation / consequence | Activation blocked until legal/security approval |
| Initial risk / verification | High design-assessment priority; effectiveness unverified. Risks R-01..35 and owner tests in Section 53. |

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

CHAT_ATTACHMENT is a PRIVATE Media purpose bound to typed conversation_id, pending_message/send intent, eventual immutable message_id and sender ordinary_account_id. Chat verifies current participant/exact Seller-team permission on upload, completion, bind and every new read. Upload grants/object keys stay private; READY is technical only. One upload-completion/send identity attaches once; cross-conversation rebinding and public PRODUCT_GALLERY delivery are forbidden. Reuse bounded approved image processing/limits; abandoned grants expire under approved policy. No new numeric limits or native video.

Ordinary logical Notifications retain exactly one ordinary/Operator Account recipient. A no-Account delegate instead uses a narrow HANDOFF-owned external invitation transport intent on the existing SMS adapter. Bind authorization_id, generation, contact-purpose reference, expiry/revocation/suppression and durable dedupe/effect key; recheck current recipient generation immediately before dispatch. Message is minimal install/open/receipt context, no detailed Order or reusable secret. No dummy Account, phone-as-Buyer authority or extra Claim/refund/Review rights. Transport timeout may be ambiguous; reading/exactly-once global SMS delivery is never guaranteed.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 13. Data Flow

![Actual processing evidence must match the assessed data map](graphics/DPIA_02.svg)
*Figure 02. Actual processing evidence must match the assessed data map. Designed routes are not deployment proof; all active processors and regions require verification.*

User/provider input -> typed domain command -> canonical PostgreSQL/approved private R2 -> current-state public or scoped private reads -> committed minimal intent -> bounded async projections and processor adapters. Public content, private evidence and derived personalization remain distinct data flows.

Exports pass requester/relationship/third-party filtering into private short-lived delivery; deletion enters domain handlers and processor completion, then suppression ledger is enforced on rebuild/restore. No direct private body flows into Analytics, Sentry or CSP reports. Appendix A records 40 data classes; production traffic evidence must confirm these routes.

## 14. Storage / Regions

| Store / copy | Region and configuration evidence required |
| --- | --- |
| PostgreSQL / replicas / snapshots | VERIFY PRODUCTION CONFIGURATION: provider/project/region, replicas, access, encryption and backup locations. |
| Valkey / BullMQ | VERIFY PRODUCTION CONFIGURATION: deployment locality, minimal job payload, expiration and dead-letter retention. |
| R2 / CDN / private exports | VERIFY PRODUCTION CONFIGURATION: bucket jurisdiction/locality settings, caching paths, public/private boundary and purge proof. |
| Pino / Sentry / access logs | VERIFY PRODUCTION CONFIGURATION: organization/DSN region, scrub order, transport/edge logs and vendor retention. |
| Backup / recovery / suppression ledger | VERIFY PRODUCTION CONFIGURATION: storage/key copies, rotation and suppression ledger available before serving restore. |
| SMS / push / PSP / social | VERIFY PRODUCTION CONFIGURATION: actual activation, all onward-processing locations and support access. |

Do not infer residency from provider brand or user Market. No Frankfurt or other region is approved by this document without actual configuration and legal assessment.

## 15. Processors / Subprocessors

No active processor has been independently verified from the supplied evidence pack. Therefore the active-production register is EMPTY / VERIFICATION REQUIRED, rather than a fabricated live list. Appendix B lists candidate architecture providers awaiting activation evidence; future vendors are not active.

Before any pilot, reconcile contracts, configuration and observed flows; each active entry records legal entity, purpose/data/role, processing country, transfer, DPA/security, subprocessor/version, retention, deletion mechanism, breach contact and exit plan. Mixed independent-controller/processor roles require legal analysis. Architecture presence is not approval.

## 16. Cross-Border Transfers

| Required transfer field | Review and safeguard |
| --- | --- |
| Source / destination / classes | Ethiopia subject context; every actual destination, support country and onward subprocessor must be recorded from contracts/configuration, not guessed. |
| Purpose / necessity | Per PA activity; select less-data/local-processing alternative where feasible; prohibit unrelated purpose expansion. |
| Legal mechanism / approval | LEGAL REVIEW REQUIRED: applicable Ethiopian authorization/transfer conditions and contract terms; foreign template clauses alone do not prove legality. |
| Technical / contractual safeguards | Minimization, access/TLS/encryption, audit, deletion proof; actual region/residency commitments, onward-transfer limits and breach escalation. |
| Risk / change handling | R-16/R-34; security review plus Privacy/Legal sign-off; region/subprocessor change triggers reassessment before routing. |

If a destination or safeguard is unknown, do not activate it. Article 48 prior authorization and consultation must be considered with counsel independently of generic supplier security certifications.

## 17. Lawfulness

Appendix C maps all PA activities to purpose, candidate basis, sensitive-data condition, notice and confirmation status. These are review candidates, not a legal declaration. Document the exact applicable Ethiopian provision and whether a purpose actually needs consent, contract necessity, legal obligation or another permitted basis.

Notice does not itself create a basis; blanket consent does not validate disproportionate collection. Sensitive incidental content, children, delegate contacts, legitimate interests/balancing and automated outcomes need specific review. Separate service necessity from optional personalization/marketing and record withdrawal/objection consequences.

## 18. Necessity

| High-risk purpose | Necessity / less-data alternative / test |
| --- | --- |
| Location / home delivery | Address needed only for chosen fulfilment; GPS only active delivery and minimum precision. Test collection stops at completion/reassignment; coarse or no GPS where sufficient. |
| Social control / hosted KYC | Minimum scopes/result rather than inbox/history/identity-document copy. Test token lifecycle and challenge-only DM evidence. |
| FYP / Trust / moderation | Use minimum first-party signals, explain purpose; Following/Search alternative and human contest for consequential decisions. Compare fairness and utility to reduced-signal baseline. |
| Chat / Claims | Ordinary Chat bounded; promote selected messages/revisions for exact case only. Test selected evidence versus bulk conversation export. |
| Analytics / Seller reporting | Aggregate and suppress small cohorts; no Buyer identity or device fingerprint. Prove useful reports with reduced linkage/shorter raw retention. |
| Telemetry / backups | Redact before transport; bounded retention; recover only authorized historical state with suppression replay. Test safe diagnosis without bodies. |

Each owner records necessity evidence, alternatives rejected and review date before activation. A convenient dataset is not automatically necessary.

## 19. Proportionality

Apply the least intrusive implementation that accomplishes the approved purpose: lower GPS precision, shorter active windows, shorter raw event/query retention, on-device transient batching, aggregation and scoped evidence. Security and auditing remain bounded rather than a perpetual dossier.

Offer clear personalization explanation/reset/negative feedback and lawful objection/withdrawal where applicable; assess non-personalized Following/Search paths. Seller ranking/Trust/moderation challenges receive competent human review with source evidence and correction; not a token rubber stamp. Unknown consequences or untested opt-out remain OPEN.

## 20. Transparency

Notices must explain controller/contact, purposes/bases, collected/derived data, recipients/transfers, retention criteria, rights/complaints and profiling consequences in accessible language for the initial Market. Actual notices/translations and contact details are NOT PROVIDED and require Product/Legal review.

Just-in-time notices cover active location, delegated-recipient contact, public photo/Review exposure, social scopes and any approved external embed. A delegate and incidental depicted person need appropriate transparency handling; do not assume Buyer consent covers every third party. Version notices with processing and consent records where used.

## 21. Data-Subject Rights

| Right / workflow | Owner and verification / legal status |
| --- | --- |
| Access / portability where applicable | Privacy verifies requester and relationships, assembles filtered domain export and private expiring capability; exclude counterparty secrets and unrelated case data. |
| Rectification / challenge | Owner corrects profile/selected factual evidence; append corrections to immutable case/audit history; Trust/moderation assess consequential challenge. |
| Deletion / withdrawal / objection | Privacy orchestrates ordinary multi-relationship deletion and separate relationship exit; prevent new incompatible use; lawful evidence retention narrow and disclosed. |
| Transparency / complaint / escalation | Accessible contact, status and authorized Privacy/Legal review; no retaliation or hidden Operator self-approval. |
| Response timing / exceptions | LEGAL REVIEW REQUIRED: exact Ethiopian deadlines, verification standard and permissible restrictions; internal task SLO does not replace law. |

Implement meaningful tests for identity verification, safe partial export, denial justification, hold scope and all derived/processor copies. Rights status is OPEN until actual workflow and legal review evidence are recorded.

## 22. Retention

Every class has proposed retention_policy_id/stem, trigger, rule source, eligible hold and expiry action in Appendix A. Approved versioned policy must add exact scope/duration, legal/purpose justification, reviewer and effective date before execution. Numeric statutory periods are not invented.

Holds are scoped to exact case/revision/evidence and require reason, authority, review date and release. Case existence cannot freeze all Chat, route history or whole Account. R-21/R-22 track over-retention and indefinite holds; expiry workers re-read current policy/holds before destructive work.

## 23. Account Deletion

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one current non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Multiple roles union permissions within that membership; ownership and Courier relationships do not consume the TEAM limit. Different humans use different Accounts.

Ordinary deletion evaluates Buyer Orders, Seller ownership/transfer obligations, TEAM revocation, Courier assignments, sessions/tokens, delegate contacts, private Collections, Search/FYP profile, Analytics, Chat, Review eligibility/content, Claims and required security/accounting evidence. Relationship exit does not erase the entire person.

Unused Review Grants become unusable; author presentation/content is deleted or anonymized only per approved policy. Preserve smallest justified transaction/case fact, minimize direct identity and prove processor/derived/media actions. Completion is not merely job success. Backups expire under approved schedule with suppression replay before traffic.

## 24. Seller Onboarding

Adulis Seller admission collects no Government ID, passport, driving-licence image, selfie-to-ID artifact or Government-ID hash. Social-account-control evidence supports admission. Provider KYC/KYB is a separate Finance/provider compliance purpose; prefer provider-hosted collection and retain minimum safe readiness status/reference. Any unavoidable Adulis receipt requires confirmed necessity and restricted Finance controls, not an Onboarding identity class.

Admission verifies business/social-control and current readiness rather than collecting legal identity documents. Distinguish ownership from one current TEAM membership; scoped access cannot leak another Seller's onboarding/profile. Unnecessary DM/profile collection and mistaken control affect legitimate Seller access; offer review and correction.

## 25. Social Verification

Minimum TikTok/Instagram account ID, safe business-presence metadata and server-verified control result. Protect operational tokens with bounded scope/lifetime; never request social password. DM fallback retains selected sender/challenge/result and Operator/timestamp/policy references only, not an inbox dump.

Social API scopes, provider role, region, contract and retention are unverified; integration remains gated. R-12/R-13 demand token-revocation and unrelated-message exclusion tests. TikTok embed is a separate Product-only feature, not permission to harvest social activity.

## 26. Product / Scene Media

Content owns Scene Post publication DRAFT/PUBLISHED/ARCHIVED separately from visibility PUBLIC/PRIVATE. A public Scene requires same-Seller eligible Product Post tags with at least one available Product, valid photo media/caption and current Seller, Market and safety gates. Loss of the last available tagged Product changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Eligible restock can restore PUBLIC after every current gate passes; it does not clear independent archive/moderation restrictions or require manual republishing solely for restock.

Photos can identify models, passers-by, minors or home locations. Seller declares upload authority; reporting/removal and human review address third-party privacy. Inspect metadata removal and derivatives; do not automatically publish precise EXIF/location. Moderation removal is distinct from evidence retention.

PRIVATE visibility removes Buyer discovery access and CDN/public-resolution eligibility as designed; it does not purge retained exact Claim evidence. Restock rechecks all gates. Public Product-only TikTok embed, if approved, needs IP/cookie/referrer/tracking assessment and less-intrusive external-link alternative; CSP alone cannot supply consent or lawful basis.

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

## 27. FYP Profiling

For You ranks photo-only Scene Posts using bounded first-party relevance, engagement, purchase conversion/quality and Trust. No standalone Product units, raw Chat, precise Courier GPS or invasive device fingerprint. All current public Content/Seller/Market/safety gates precede ranking.

Assess intrusive interest inference, concentration, discriminatory exclusion, manipulation and opaque Seller livelihood effects. Limited fair new-Seller exposure is not guaranteed success; continued distribution depends on relevant Buyer response, quality/conversion and Trust. Monitor conversion, purchase frequency and Buyer satisfaction with fraud/dispute/completion/quality/Trust guardrails.

Provide negative feedback/profile reset and assess lawful objection/nonpersonalized alternative. Product/Privacy review feature necessity and proxy bias; practical A/B tests stop on material harm. Paid promotion cannot buy Trust or override safety; any advertising introduction triggers reassessment. Significant automated-decision classification remains LEGAL REVIEW REQUIRED.

## 28. Search

Search supports Product Posts, Sellers and Scene Posts from launch. Avoid indefinite raw queries; short processing and aggregate use preferred. Queries can reveal sensitive interests even if categories seem ordinary. Access controlled and subject history purge tested. Trust/relevance/popularity/conversion/quality ranking must obey public gates and fairness review.

## 29. Collections

Collections are private Buyer preference data supporting Product and Scene references. Never publish by default or grant access to a newly PRIVATE Scene because it was saved earlier. Delete subject-owned names/memberships on Account deletion without deleting canonical content. Test cross-Account read denial and public item hard gates.

## 30. Chat

Buyer-Seller Chat has NONE, PRODUCT_POST, SCENE_POST or ORDER context; same-Seller filtering does not broaden membership/Order access. Do not reuse conversation bodies for Analytics, profiling or training. Selected Claim/moderation messages have independent scoped retention; whole conversation does not inherit a hold.

Malicious Sellers may solicit excess personal details; provide reporting/safety guidance and scoped moderation. Restrict attachment access, lockscreen previews and Operator case reads. R-08/R-31 address purpose misuse and coercive collection; actual retention and complaint policy require approval.

## 31. Chatbot

Deterministic support uses approved intent/templates and Product/Scene/Order anchors. Minimize free text/session logs, prohibit default training corpus and do not infer sensitive individual characteristics. The bot cannot verify money, accept custody or adjudicate Claims. AI business advice is not current MVP/Phase-1 processing.

## 32. Checkout

Finance/Payments alone establishes canonical payment, refund and settlement facts from authenticated provider callbacks and/or backend verification matched to the exact attempt/reference, Seller Order, amount and currency. Client return navigation, Seller statements and screenshots never establish PAID. Checkout snapshots merchandise, delivery, the zero launch Adulis Buyer surcharge (0 bps), exact currency rounding, Buyer total and Commercial Policy version before explicit confirmation. Payment, provider settlement and physical receipt are independent.

Cart is intent; Checkout Session snapshot supports explicit confirmation; short-lived CheckoutAllocation is internal attempt-bound stock support. Minimize abandoned selections/address and expire without disrupting already confirmed provider-paid outcomes. Do not retain internal allocations indefinitely.

Order/Checkout snapshots separately itemize merchandise, delivery, zero launch Adulis Buyer surcharge, total and refund references. No special privacy exception is created by the fee; accounting-purpose retention and linkage must still be justified.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 33. Payment / PSP

Finance/Payments alone establishes canonical payment, refund and settlement facts from authenticated provider callbacks and/or backend verification matched to the exact attempt/reference, Seller Order, amount and currency. Client return navigation, Seller statements and screenshots never establish PAID. Checkout snapshots merchandise, delivery, the zero launch Adulis Buyer surcharge (0 bps), exact currency rounding, Buyer total and Commercial Policy version before explicit confirmation. Payment, provider settlement and physical receipt are independent.

Broad Pino/Sentry telemetry contains no OTP/digest, session/refresh token, raw QR, signing key, provider credential/signature/raw financial body, KYC document, Chat body, Claim evidence, delegate name/phone, push token or precise GPS/address. URL queries/fragments and dynamic private paths are removed before transport. Restricted evidence/audit repositories remain purpose-scoped and separately governed.

Actual provider identity, Seller routing, regional processing, DPA/role, bank-detail exposure and webhook test evidence are OPEN. Provider raw retention is bounded only if justified; normalized minimum records preferred. Spoofing/mismatch creates financial loss and false adverse reputation; verify signature/server result plus exact scoped amount/currency/ref.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 34. Provider KYC

Adulis Seller admission collects no Government ID, passport, driving-licence image, selfie-to-ID artifact or Government-ID hash. Social-account-control evidence supports admission. Provider KYC/KYB is a separate Finance/provider compliance purpose; prefer provider-hosted collection and retain minimum safe readiness status/reference. Any unavoidable Adulis receipt requires confirmed necessity and restricted Finance controls, not an Onboarding identity class.

R-14 prevents unnecessary document copies. Provider readiness is not Seller admission identity verification. If any identity document becomes technically unavoidable inside Adulis, pause activation for necessity, lawful-basis/transfer/security assessment and DPIA change review; this draft does not approve it.

## 35. Fulfilment

Current assignment and exact Seller Order scope limit address/contact/instructions to the minimum authorized actor. Reassignment terminates previous access and invalidates stale credentials. Only two optional foreground PICKUP/DELIVERY checkpoints exist; no route/history or continuous samples are collected. Selected Claim evidence promotes exact scoped checkpoints under lawful hold. Payment, checkpoint and accepted custody each prove distinct facts.

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

## 36. Courier GPS

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

Checkpoint data can still create physical-safety risks, so existing rights-based R-09 impact and strict case access remain. Exact retention, processing basis and actual controls are not approved by this revision.

## 37. Handoff

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Connected QR/OTP/approved Manual verifies exact purpose, stage, actor, current assignment and intended recipient. Never retain raw QR/OTP in logs/evidence; use minimum digest/control metadata in protected owner state. Manual exception requires authorized policy and accountable evidence, not an offline fabricated success.

Interception or stale credentials can cause misdelivery and false Review eligibility; test single use, short window, invalidated recipient/assignment and replay rejection. Biometric receipt remains deferred and requires a new assessment.

## 38. Delegated Recipient

Buyer authorizes the exact current delegate for final delivery. Minimize name/phone and verify correct contact; recipient communication does not authorize marketing or social profiling. Cancellation/replacement invalidates former authorization and credential.

A mistaken phone can expose Order/address and enable wrong receipt. Provide safe confirmation and revoke/reissue workflow. Delegate need not have Account and gains no independent Order/refund/Claim/Chat/Review ownership. Minimize direct delegate identity after approved purpose tail; preserve only smallest justified evidence.

## 39. Reviews

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Public Review text/presentation is separate from private eligibility evidence. Product-quality and Seller-service are separate dimensions. Remove unnecessary personal/address/phone content and provide complaint/moderation; factual criticism and alleged wrongdoing require fair treatment, not automatic suppression because a Claim exists.

Deletion/anonymization uses approved policy; public authorship visibility can expose or degrade a person. Tests protect eligibility, delegate exclusion and historical fairness. Trust interprets outcomes itself; Reviews never directly sets reputation state.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

## 40. Trust

Trust uses NEW, REBUILDING, ESTABLISHED, TRUSTED with policy-versioned evidence and explainable human challenge/correction. QR quality distinctions do not make valid OTP/Manual receipt invalid. Claims allegations are not findings; corrections are not unconditional demotion.

False scores affect reputation/exposure/income and can compound FYP unfairness. Separate eligibility gates, reputation and paid promotion; no purchased Trust. Test false-positive/correction/rebuild paths, trace every material adverse result to permitted evidence and provide competent review. Automated legal-significance and appeal rights need counsel decision.

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

## 41. Claims

Each Claim concerns one Seller Order, with optional belonging Order Line. Human Operators adjudicate selected exact Product/Scene revisions, relevant Chat, accepted Handoff and normalized provider facts. Private Scene evidence remains restricted and never republished. Allegations, decision, provider remedy and case resolution are distinct.

Selected sharing must balance contestability with counterparty privacy; protect delegates/reporters and third-party content. No bulk Chat/evidence download, indefinite blanket hold or log export. Correction history remains append-only, with downstream Trust interpretation independently owned.

## 42. Moderation

Moderation examines specific reported content/conduct with proportionate access and human escalation. A safety flag can be wrong; suspension/removal affects Seller livelihood. Record reasons/evidence/version, appeal and restoration, and measure false positives/group effects. Protect reporter identity where lawful and avoid disclosing full unrelated conversations.

## 43. Analytics

Typed first-party events and backend owner facts support conversion/satisfaction/quality measurement. Mobile batching is connected-only, bounded in memory; low-priority events may drop on bounded failure. No persisted offline SQLite replay queue. Delayed backend facts still require person suppression on projection/rebuild.

Pseudonymous Account/Seller/Order linkage remains personal; no fingerprinting or hidden external tracking. Bound raw retention and purpose/reidentification access. True anonymous aggregates may survive only after a credible risk assessment. Seller dashboards receive no Buyer identity or exact private payload.

## 44. Seller Analytics

Apply exact tenant/role scope, minimum-cohort suppression and suitable aggregation to Seller reports. Test joins, exports, drilldowns and repeated differencing against small-cohort identification. Proposed thresholds require Privacy approval based on actual density; this draft does not invent a universal legal threshold. No Buyer phone/address/raw Chat or individual user behavioral list.

## 45. Notifications

Operational/security notices use approved channel and minimal safe text; lockscreen may be visible to others. Revoke device tokens/session-related delivery rights on logout/deletion; wrong delegate/channel messages must not leak private body. Distinguish service from optional marketing and assess lawful consent/withdrawal. Provider copies and retry/dead-letter payloads have bounded lifecycle.

## 46. Operator Processing

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

Evidence access requires exact capability, resource/case scope, reason/purpose and authentication freshness; sensitive destructive/export/hold actions require approval where policy specifies. Record typed audit without copying private evidence bodies. Separate read from decision/remedy authority and prohibit impersonation.

R-03 includes insider abuse; monitor bounded access/audit anomalies and review access termination. Operator identity itself has justified retention, clear internal notice and restricted investigation access. No shared founder credentials or ordinary-account elevation shortcut.

## 47. Observability / Security Logs

Broad Pino/Sentry telemetry contains no OTP/digest, session/refresh token, raw QR, signing key, provider credential/signature/raw financial body, KYC document, Chat body, Claim evidence, delegate name/phone, push token or precise GPS/address. URL queries/fragments and dynamic private paths are removed before transport. Restricted evidence/audit repositories remain purpose-scoped and separately governed.

Redact at source/SDK before transport, not only dashboard display; check access logs, breadcrumbs, exception attachments, queue errors and signed URLs. Sentry DSN/routing/retention and support access must be verified. pg_stat_statements/query diagnostics must not expose literals or excessive identifying metadata. OBS cannot become a private evidence archive.

## 48. CSP Reporting

ADU-CSP-01 reporting accepts untrusted browser observations that may contain document/resource URLs. Discard queries/fragments, private dynamic identifiers, original policy/nonce and samples before transport; normalize origin to bounded source category. Disable raw endpoint request/access body logs.

Bound body/batch/depth/rate/retention and prohibit report-driven automatic policy relaxation or business mutation. CSP enforcement continues if reporting fails. R-24 verifies secrets never reach Sentry, logs or raw stored reports; endpoint source IP is not an indefinite user fingerprint.

## 49. Backups

Backup copies may not support row-by-row surgical deletion; document approved bounded rotation, encryption/access and retained-copy handling. Restore suppression/deletion ledger and owner purge replay before any serving traffic, projection or event replay. Test stale Account cannot resurrect through logs, media, queue, Search/FYP or export. Actual backup locations/retention/drill evidence remain OPEN.

## 50. Security Controls

Reference dedicated Auth/Authorization, Payments, Handoff, Media, CSP, Eventing, Privacy, Deployment and OBS contracts rather than substitute a generic security checklist. Key safeguards include strict typed authorization, TLS/approved encryption, verified provider facts, private R2 access, connected credential replay protection, Operator audit, redaction/throttling, dependency boundaries and recoverable intent.

Each safeguard must attach executed evidence/version/environment. A design statement, deployment success or security vendor badge is not proof of purpose limitation or people-risk mitigation. Compare expected negative and valid workflows; absence of errors is insufficient.

## 51. Privacy-by-Design Controls

| Default | Required privacy effect / owner proof |
| --- | --- |
| No admission ID / hosted KYC | Onboarding collects no document; Finance stores minimum provider status; schema/upload-route tests. |
| Private preferences/evidence | Collections owner-only; Claim/DM/evidence restricted; URL/tenant regression. |
| Separate visibility and deletion | Content makes Scene PRIVATE, preserves exact authorized evidence; hard public-gate and purge tests. |
| Connected minimum collection | No offline Analytics/Handoff queue; GPS only active assignment; session/delegate lifetime tests. |
| Purpose-bound derivation | No raw Chat/GPS in FYP/Analytics; minimization and suppression tests on rebuild. |
| Provable lifecycle | Domain actions, processor completion and backup suppression proof; completion partial until mandatory verification succeeds. |
| Contestable outcomes | Human review for adverse Trust/moderation and material automated outcomes; traceable correction and fairness evidence. |

## 52. Risk Methodology

Model 1.0: likelihood 1 Rare, 2 Unlikely, 3 Possible, 4 Likely, 5 Almost Certain; impact 1 Minimal, 2 Minor, 3 Moderate, 4 Major, 5 Severe. Score = L x I. Low 1-4; Moderate 5-9; High 10-16; Critical 17-25. Scores are documented engineering/privacy judgement, not measured incident probabilities or statutory thresholds.

![People-focused likelihood and impact matrix](graphics/DPIA_03.svg)
*Figure 03. People-focused likelihood and impact matrix. Score = likelihood x impact; projected control reductions require actual evidence. Low 1-4, Moderate 5-9, High 10-16, Critical 17-25.*

Impact concerns people: confidentiality/control, identity/financial harm, discrimination/exclusion, reputation, harassment, physical safety, chilling effects, inability to contest and Seller livelihood. A severe location harm stays impact 5 even after access controls lower likelihood.

Inherent scores assume relevant safeguards fail/are absent. Projected residual scores assume every listed control is implemented and tested. Actual residual is NOT VERIFIED and remains governed at inherent priority until evidence supports a revised rating. This conservative governance rule avoids falsely claiming planned mitigation already reduced risk.

## 53. Detailed Risk Register

Evidence status: the supplied system designs and task specifications establish intended architecture, not deployed controls. No production configuration, executed security/deletion drills, processor contract, signed lawful-basis decision or named legal approval was supplied. Controls below are PLANNED unless a separately recorded test/configuration/contract proves IMPLEMENTED. Unverified control effectiveness cannot reduce the actual residual-risk finding.

Each R record is unaccepted; listed residual is PROJECTED, not verified. Before first pilot or feature activation (whichever is earlier), the named owner role must produce the specified test/configuration/legal evidence. Actual risk governance remains at inherent priority until authorized re-rating. No invented named owner, completed test or acceptance date.

### R-01 - Account takeover exposes Orders / Chat

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-01, PA-09, PA-11; Accounts and counterparties; financial loss, confidentiality and identity harm |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Auth/session security and scoped reads. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Verify OTP throttling, recovery/session revocation and cross-Account Order/Chat denial; execute takeover/recovery regression. |
| Owner / due date | Auth / Security; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-02 - TEAM member accesses wrong Seller

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-02, PA-09, PA-24; Sellers/Buyers; private business and conversation disclosure |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | One current TEAM membership and exact Seller guards. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test ACTIVE/SUSPENDED membership, role union, tenant switch, removed membership and forged Seller IDs across APIs/exports. |
| Owner / due date | Authorization / Seller; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-03 - Operator abuses evidence access

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-20, PA-25, PA-27; Claim subjects/delegates; confidentiality, harassment and unfair decisions |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Separate Operator, capability/case/purpose/freshness audit. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L3 x I5 = 15 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Prove least privilege, Step-Up, scoped approved export, audit review and immediate revocation; insider drill with safe fixture. |
| Owner / due date | Security / Operations; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I5 = 10 / High AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-04 - FYP profiling becomes intrusive

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-06, PA-23; Buyers; sensitive inference, manipulation, loss of control |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | First-party minimal features; no Chat/GPS copy. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Review every feature/purpose, offer meaningful negative feedback/reset and lawful objection path; test reduced-signal alternative and profile purge. |
| Owner / due date | Recommendation / Privacy; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-05 - FYP discriminatory / unfair Seller outcomes

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-06, PA-07, PA-19; Sellers; exclusion, concentration and income harm |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Bounded exploration; quality/trust guardrails. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Audit cohorts/proxies and exposure concentration, test new-Seller fairness and stop harmful experiments; competent human challenge. |
| Owner / due date | Product / Recommendation; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-06 - Trust falsely harms reputation

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-19, PA-20, PA-21; Seller representatives; reputational/economic harm and inability to contest |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Versioned owner facts; correction and human review. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Trace adverse result to permitted evidence, test correction/rebuild and appeal; QR/OTP/Manual quality policy independent from receipt validity. |
| Owner / due date | Trust / Operations; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-07 - Claim evidence leaks

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-20, PA-25; Parties/incidental subjects; private disclosure, harassment |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Private R2 and case-scoped access. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L3 x I5 = 15 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test object URLs/download/export/preview and counterparty minimization; enforce case purpose and expiring capabilities. |
| Owner / due date | Claims / Media / Security; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I5 = 10 / High AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-08 - Chat reused outside purpose

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-09, PA-10, PA-23; Conversation participants; chilling effect and loss of confidentiality |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Ordinary retention separate from selected evidence. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Prove no training/profile/log pipeline consumes raw Chat; selected-message promotion and expiry tests. |
| Owner / due date | Chat / Privacy; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-09 - GPS reveals Courier movements

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-14, PA-15; Couriers; stalking, physical safety and off-duty tracking |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Active-delivery only, precision/window limits. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I5 = 20 / Critical; design judgement, not empirical probability. |
| Additional mitigation / verification | Test start/stop/background/reassignment and access; approve smallest useful precision/retention and remove routes from Analytics. |
| Owner / due date | Fulfilment / Privacy; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I5 = 10 / High AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-10 - Buyer home address exposed

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-11, PA-14, PA-20; Buyer/household; physical safety and unwanted contact |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Minimum current-assignment address access. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I5 = 20 / Critical; design judgement, not empirical probability. |
| Additional mitigation / verification | Test stale Courier, Seller team scope, logs/lockscreen/export and post-delivery minimization; no public location detail. |
| Owner / due date | Fulfilment / Orders; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I5 = 10 / High AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-11 - Delegate phone reused

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-17, PA-22, PA-23; Delegate; unsolicited contact and relationship inference |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | One-Order purpose and bounded direct identity. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Prohibit marketing/affinity copy; test contact expiry, revoked authorization and source-recipient notice. |
| Owner / due date | Handoff / Notifications; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-12 - Social OAuth token compromised

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-03; Social-account owner; identity/control compromise |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Minimum scopes and protected bounded token. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L3 x I5 = 15 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Verify callback state/replay, secret store/redaction, revoke/expire and provider scope; staged compromise drill without live token. |
| Owner / due date | Onboarding / Security; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I5 = 10 / High AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-13 - DM fallback captures unrelated messages

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-03; Seller/social counterparties; unrelated confidential disclosure |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Selected challenge evidence only. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Review capture UI/Operator procedure; prove unrelated inbox/message content cannot enter retained case/log/export. |
| Owner / due date | Onboarding / Operations; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I4 = 4 / Low AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-14 - KYC unnecessarily duplicated

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-13; Seller representatives; sensitive identity loss and overcollection |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Hosted provider collection and minimum status/ref. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L3 x I5 = 15 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Inspect schemas/upload endpoints/provider mapping; reject document upload into admission and verify provider-hosted alternative. |
| Owner / due date | Finance / Privacy; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I5 = 5 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-15 - Provider financial data breach

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-12, PA-13; Buyer/Seller; financial/identity harm |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Normalized minimal facts; provider-hosted data. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L3 x I5 = 15 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Verify PSP contract/role/regions, access/webhook redaction, bounded raw exceptions and deletion; supplier security review. |
| Owner / due date | Finance / Security; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I5 = 10 / High AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-16 - Transfer processor lacks safeguard

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-03, PA-12, PA-26, PA-30; All affected subjects; loss of legal/control protections |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Versioned processor/region activation gate. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I5 = 20 / Critical; design judgement, not empirical probability. |
| Additional mitigation / verification | Verify every destination/subprocessor, lawful transfer authorization and DPA; block unapproved region activation and reassess change. |
| Owner / due date | Privacy / Legal / Procurement; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I5 = 10 / High AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-17 - Analytics re-identification

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-23, PA-24; Buyers; private behavioral inference and unwanted targeting |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Bounded typed events; privacy-reviewed aggregation. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test linkability, export joins and small cohorts/differencing; approve threshold/rules and subject suppression. |
| Owner / due date | Analytics / Privacy; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-18 - Search reveals sensitive interests

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-07; Buyer; sensitive inference/confidentiality loss |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Avoid indefinite raw query storage. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test logs/search history deletion and query minimization; prohibit unrestricted query exports and sensitive profiling. |
| Owner / due date | Search / Privacy; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I4 = 4 / Low AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-19 - Review identifies / degrades person

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-18; Author/Seller/mentioned people; harassment/reputation harm |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Public/private separation and moderation. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test personal-info reporting/removal, safe author presentation and approved anonymization; fair factual criticism review. |
| Owner / due date | Reviews / Moderation; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-20 - Deleted Account resurrects

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-27, PA-28; Deleted subjects; lost control and renewed exposure |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Suppression replay before restore traffic. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I5 = 20 / Critical; design judgement, not empirical probability. |
| Additional mitigation / verification | Execute full backup/queue/media/projection restore drill; no serving until mandatory deletion proof and suppression checks pass. |
| Owner / due date | Deployment / Privacy; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I5 = 5 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-21 - Retention lasts too long

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-All; All subjects; accumulation and loss of control |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Versioned purpose-based policy/expiry. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Approve every class trigger/duration/action; measure expired rows/objects/processor copies and run bounded purge verification. |
| Owner / due date | Privacy / Domain owners; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-22 - Legal / Claim hold becomes indefinite

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-20, PA-21, PA-27; Case subjects; denied erasure and hidden dossier |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Narrow scope/reason/authority/review/release. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test expired/broad holds rejected, review escalation and release/purge fence; approve lawful exception and subject explanation. |
| Owner / due date | Privacy / Claims / Legal; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-23 - Logs / Sentry collect private payload

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-26; Users/counterparties; credential or evidence disclosure |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Pre-transport redaction and forbidden-field contracts. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I5 = 20 / Critical; design judgement, not empirical probability. |
| Additional mitigation / verification | Inject safe sentinel OTP/Chat/QR/GPS/KYC/provider payloads; prove absent from SDK, network, logs, attachments and dead letters. |
| Owner / due date | Observability / Security; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I5 = 5 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-24 - CSP report leaks secret URL

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-29; Browser users; token/private-case disclosure |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Minimized report schema, no raw logging. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I5 = 20 / Critical; design judgement, not empirical probability. |
| Additional mitigation / verification | Send adversarial signed/private URLs, original policy and nonce samples; verify discarded before store/Sentry/logs. |
| Owner / due date | Security / Observability; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I5 = 5 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-25 - Scene/media contains another person

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-04, PA-05; Depicted/incidental people/minors; privacy/reputation/safety |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Upload authority, complaint/removal and metadata minimization. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Verify report/removal and safe evidence hold; strip EXIF; review minor/third-party notice and authority. |
| Owner / due date | Content / Media / Legal; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-26 - Media moderation fails

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-04, PA-05, PA-21; Depicted people/Buyers; exposure/harassment and safety harm |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Current safety gates and report review. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L3 x I5 = 15 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test prohibited/identifying content fixtures, response/removal and cache purge; measure human false negatives/appeals. |
| Owner / due date | Moderation / Media; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I5 = 10 / High AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-27 - Seller closure exposes historical personal data

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-02, PA-04, PA-05, PA-20; Former Seller representative/Buyers; unwanted disclosure |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Public removal distinct from narrow transaction history. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test Storefront/Search/Scene/public links and historical exports after closure; minimize identity while scoped evidence remains. |
| Owner / due date | Seller / Content / Privacy; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I4 = 4 / Low AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-28 - Webhook spoof changes money

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-12, PA-13; Buyer/Seller; financial loss and false adverse state |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Authenticated exact provider match and dedup. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I5 = 20 / Critical; design judgement, not empirical probability. |
| Additional mitigation / verification | Execute invalid signature/ref/amount/currency/replay tests, backend reconciliation and paid-stock race tests. |
| Owner / due date | Finance / Orders; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I5 = 5 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-29 - Handoff QR / OTP intercepted

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-16, PA-17; Buyer/delegate/Seller; misdelivery and false receipt |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Connected purpose/stage/recipient/single-use window. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test expired/replayed/stale assignment/wrong recipient, raw-secret absence and Manual authority; no offline accept. |
| Owner / due date | Handoff / Security; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I4 = 4 / Low AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-30 - Delegated receipt sent to wrong phone

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-17, PA-22; Buyer/delegate/unintended person; address/Order leak |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Safe exact authorization/contact verification. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L3 x I4 = 12 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test phone confirmation/correction, cancellation/replacement and revoke/reissue; notices reveal no private body. |
| Owner / due date | Handoff / Notifications; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I4 = 4 / Low AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-31 - Malicious Seller solicits excessive data

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-09; Buyer/vulnerable people; coercion, fraud and privacy harm |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Scoped Chat with reporting and safety intervention. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Provide warnings/report workflow; verify proportionate review and response, no bot prompts asking unnecessary IDs/secrets. |
| Owner / due date | Chat / Trust & Safety; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-32 - Automated moderation falsely suspends

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-21, PA-19; Legitimate Sellers; income loss/discrimination and inability to contest |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Versioned flag plus governed human escalation. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I4 = 16 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test false positive/appeal/restoration, source traceability and group effects; human review of consequential action. |
| Owner / due date | Moderation / Product; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I4 = 8 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-33 - Privacy export leaks counterparty data

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-27, PA-09, PA-20; Counterparties/delegates; confidentiality loss |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Requester verification and per-domain filtering. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L3 x I5 = 15 / High; design judgement, not empirical probability. |
| Additional mitigation / verification | Test multi-relationship subject identity, redacted counterparty evidence, expiring private export and wrong-account denial. |
| Owner / due date | Privacy / Domain owners; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I5 = 5 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-34 - Processor breach notice late

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-30, PA-26; All affected subjects; delayed protection and lost control |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Contract contacts and incident escalation. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I5 = 20 / Critical; design judgement, not empirical probability. |
| Additional mitigation / verification | Verify actual contract notification/24h reachable contact, staged supplier incident drill and escalation; no assumed grace period. |
| Owner / due date | Procurement / Security / Privacy; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L2 x I5 = 10 / High AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

### R-35 - Breach assessment misses 72-hour clock

| Risk field | People-focused assessment |
| --- | --- |
| Processing / affected subjects | PA-26, PA-27, PA-30; Affected people; delayed protection/notification |
| Rights / freedoms | Confidentiality, security, control and contestability; specific economic/physical/social harm stated above. |
| Existing-control status | Awareness timestamp, incident/privacy legal escalation. PLANNED / implementation and effectiveness OPEN. |
| Inherent likelihood / impact / score | L4 x I5 = 20 / Critical; design judgement, not empirical probability. |
| Additional mitigation / verification | Tabletop Article 43 Authority and Article 44 subject tracks separately; preserve awareness, updates/reasons and authorized legal decision. |
| Owner / due date | Incident Commander / Privacy / Legal; before first pilot or affected feature activation, whichever is earlier. Evidence pack and authorized review required. |
| Projected residual | L1 x I5 = 5 / Moderate AFTER verified controls only. Actual residual NOT VERIFIED; no current reduction claimed. |
| Acceptance / launch blocker | NOT ACCEPTED; launch-blocking YES until controls verified, legal decisions resolved and residual risk formally handled. High projected residual requires Privacy/Legal/Executive and Authority decision where applicable. |

## 54. Mitigation Plan

Appendix E assigns one mitigation action/verification milestone to every R-01..35. All unresolved inherent High/Critical scenarios are launch-blocking. Owner roles nominate accountable people; evidence refs, executed dates and authorized review are OPEN rather than fabricated.

G0 before any pilot: processor/region/legal/minors/authorization scope decisions. G1 before live personal-data ingress: Auth, Operator, data minimization, redaction and isolation. G2 before respective commerce/delivery feature: provider/Handoff/GPS/delegate/Review proof. G3 before launch: deletion/restore, fairness/appeal, rights exports, CSP and breach tabletop. A later milestone cannot excuse earlier unsafe processing.

## 55. Residual Risk

All 35 risks remain NOT ACCEPTED because implementation evidence is absent. Projected High scores remain for insider/case access, GPS/address safety, social token/provider finance, cross-border safeguards, media safety and supplier notification. These are explicit governance issues, not secretly downgraded.

Privacy/DPO, Legal and Executive record whether mitigations are sufficient, further alternatives, actual residual rating and competent acceptance authority. High/Critical actual residual cannot be accepted by a developer alone; evaluate Authority prior consultation/authorization. No risk acceptance bypasses law or mandatory control.

![Evidence and competent authority determine privacy readiness](graphics/DPIA_04.svg)
*Figure 04. Evidence and competent authority determine privacy readiness. The assessment does not approve pilot processing or public launch with unresolved blockers.*

## 56. Consultation

| Consulted role / group | Current evidence / required outcome |
| --- | --- |
| Engineering/domain owners | NOT EVIDENCED / NOT CONDUCTED in supplied pack. Record named participant, date, evidence, concerns, disagreement and resolution before approval. |
| Product / Growth / Recommendation | NOT EVIDENCED / NOT CONDUCTED in supplied pack. Record named participant, date, evidence, concerns, disagreement and resolution before approval. |
| Operations / Trust & Safety | NOT EVIDENCED / NOT CONDUCTED in supplied pack. Record named participant, date, evidence, concerns, disagreement and resolution before approval. |
| Security / Incident response | NOT EVIDENCED / NOT CONDUCTED in supplied pack. Record named participant, date, evidence, concerns, disagreement and resolution before approval. |
| Privacy / DPO role determination | NOT EVIDENCED / NOT CONDUCTED in supplied pack. Record named participant, date, evidence, concerns, disagreement and resolution before approval. |
| Ethiopian Legal counsel | NOT EVIDENCED / NOT CONDUCTED in supplied pack. Record named participant, date, evidence, concerns, disagreement and resolution before approval. |
| Representative Buyers / Sellers / Couriers / delegates where appropriate | NOT EVIDENCED / NOT CONDUCTED in supplied pack. Record named participant, date, evidence, concerns, disagreement and resolution before approval. |
| Actual active processors / suppliers | NOT EVIDENCED / NOT CONDUCTED in supplied pack. Record named participant, date, evidence, concerns, disagreement and resolution before approval. |

Consultation must address actual processing and less-intrusive alternatives, not only document formatting. Do not record agreement where no meeting/signature exists. Any disagreement on high people-risk remains a tracked launch condition.

## 57. Prior Authority Consultation Decision

Current decision: LEGAL_REVIEW_REQUIRED. Projected High risks and unverified actual residual warrant formal evaluation; this document neither claims consultation is unnecessary nor falsely states submission occurred.

Article 48 prior authorization is a separate legal assessment before processing, including applicable transfer safeguards; do not limit it to residual High risk. Determine controller/processor registration and current Authority procedure with Ethiopian counsel/ECA before pilot.

Consultation states: NOT_REQUIRED; LEGAL_REVIEW_REQUIRED; CONSULTATION_REQUIRED; CONSULTATION_SUBMITTED; AUTHORITY_RESPONSE_RECEIVED. Every change requires legal reason, scope, reviewer/date and evidence. If legally required, do not activate processing until required Authority authorization/response and conditions are satisfied.

## 58. Sign-Off

| Sign-off authority | Required record / current status |
| --- | --- |
| Engineering / Product / Operations | Named accountable owners, verified scope/controls/test refs and conditions; NOT SIGNED. |
| Security / Privacy or DPO | Actual risk findings, residual/control evidence, rights/lifecycle and incident readiness; NOT SIGNED; statutory DPO requirement unresolved. |
| Ethiopian Legal counsel | Lawful bases, minors/rights/retention, transfers, registration, prior authorization/consultation conclusion; NOT SIGNED. |
| Executive | Resources, unresolved risk handling within competent authority and launch decision; NOT SIGNED. |
| Authority where required | Submission/ref/date, decision/conditions and scope; NOT SUBMITTED / requirement under legal review. |

Record approver name/role/date/version, evidence links, conditions/expiry and dissent. A PDF version number or this document's author is not approval.

## 59. Review Triggers

• New Market or processing jurisdiction

• New processor/subprocessor or region/support-location change

• New sensitive data, Government ID or biometrics

• AI decisioning or Seller advice

• Creator platform, advertising or behavioral-targeting change

• Major Recommendation/Trust/moderation policy or feature change

• More precise/wider location collection

• Payment-provider/KYC architecture change

• Chat training/new purpose

• Major breach or repeated control failure

• Legal/regulatory guidance change

• Acquisition, data sharing or material retention change

Review before change approval, not after data collection. Proposed quarterly internal review plus event-driven review requires Privacy/Legal approval; no assertion that Ethiopian law mandates an annual period. Version processing/inventory/notice/contract evidence and supersede the old decision explicitly.

## 60. Launch Gate

| Launch gate | Acceptance evidence / current state |
| --- | --- |
| Scope/age | Exact live features, Markets and minors policy confirmed; no ID/biometric/future feature drift. Current: OPEN / NOT VERIFIED. |
| Processors/regions/transfers | Every active provider/subprocessor and destination verified; contracts, legal basis/authorization and exit controls recorded. Current: OPEN / NOT VERIFIED. |
| Purpose/retention/rights | All purposes/bases and 40 policy classes approved; notices and safe rights workflow tested. Current: OPEN / NOT VERIFIED. |
| High/Critical risks | Controls verified; Critical scenarios closed/mitigated; actual residual High formally handled with legal/Authority decision. Current: OPEN / NOT VERIFIED. |
| Money/KYC | Authenticated exact provider matching and hosted KYC boundary proved; no screenshot payment truth. Current: OPEN / NOT VERIFIED. |
| Location/Handoff/delegates | Window/precision/scope/replay/contact tests passed; final Buyer Grant uniqueness and delegate exclusion proved. Current: OPEN / NOT VERIFIED. |
| Operator/telemetry/CSP | Separate privileged audience, purpose-bound access, pre-transport redaction and enforced per-surface CSP verified. Current: OPEN / NOT VERIFIED. |
| Lifecycle/recovery | Domain/processor deletion completion and backup suppression restore drill passed; no resurrection. Current: OPEN / NOT VERIFIED. |
| Incident/legal readiness | Awareness and separate Article 43/44 72-hour assessment tabletop; actual contacts/authority procedure verified. Current: OPEN / NOT VERIFIED. |
| Consultation/sign-off | Required prior authorization/consultation and all competent sign-offs recorded for exact version. Current: OPEN / NOT VERIFIED. |

The DPIA cannot support a public launch while these blockers remain. A controlled pilot is also personal-data processing and must satisfy applicable legal authorization and proportionate safeguards before starting; pilot wording is not an exemption.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 61. Final DPIA Decision

FINAL DPIA DECISION: LEGAL REVIEW REQUIRED. Secondary implementation disposition: MITIGATION REQUIRED BEFORE LAUNCH. Assessment status DRAFT; no approval, compliance claim or completed regulatory submission.

Reopen decision only after scope/processor/region/legal evidence, executed mitigation and residual-risk assessment, prior authorization/consultation decision and competent sign-offs. Possible final decisions are APPROVED FOR CONTROLLED PILOT, APPROVED FOR LAUNCH WITH CONDITIONS, MITIGATION REQUIRED BEFORE LAUNCH, LEGAL REVIEW REQUIRED, PRIOR CONSULTATION REQUIRED or NOT APPROVED. Choose according to evidence; approval is not the default.

## 62. Appendix A - Data Map & Retention Linkage

Each row links a current data class to its owning domain and proposed policy stem. Storage: PostgreSQL domain metadata; Media/private exports R2; transient cache/queue Valkey; actual telemetry/provider/backup copies and regions VERIFY PRODUCTION CONFIGURATION. Rules/durations and eligible evidence holds require approved policy version; no indefinite class-wide hold.

| Class / policy | Owner / minimum data | Trigger / action |
| --- | --- | --- |
| Ordinary Account / account-core | Auth; Phone/profile; PERSONAL/IDENTITY | ACCOUNT_DELETION_COMPLETED -> Revoke; minimize/delete direct identity; minimal suppression; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Phone / Auth / session / device / OTP / auth-security | Auth; Security metadata; no raw OTP/token export | SESSION_REVOKED -> Expire/revoke; keyed phone cooling only when justified; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Seller organization / seller-core | Seller; Public business + representative data | SELLER_CLOSED -> Public removal; minimize personal fields; retain obligations; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Ownership / TEAM membership / seller-relationship | Authorization / Seller; Typed ordinary Account relationship and roles | LAST_ACTIVITY -> Revoke relationship; preserve minimal actor history; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Social-account-control evidence / social-control | Onboarding; TikTok/Instagram control result and minimal DM evidence | SELLER_CLOSED -> Delete tokens/challenges; retain justified bounded reference; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Operator Account / operator-account | Operator Auth / Audit; Privileged identity/access and audit provenance | OPERATOR_ACCOUNT_TERMINATED -> Revoke sessions; separate audit retention; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Product Post / Product / Variant / catalogue-history | Catalogue; Commerce representation and Seller provenance | OBJECT_RETIRED -> Unpublish; retain exact purchased-line context where justified; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Scene Post / revisions / tags / scene-content | Content; Photo caption, same-Seller tags and visibility | SCENE_ARCHIVED -> PRIVATE is not purge; exact held revision retained; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Media / media-object | Media; Masters, derivatives and private evidence objects | OBJECT_RETIRED -> Reference/hold check; R2 delete and CDN reconciliation; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Inventory / inventory-ledger | Inventory; Stock ledger and transaction links | ORDER_COMPLETED -> Retain justified ledger; minimize actor identity; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Cart / cart-intent | Checkout; Buyer intent and Product selections | LAST_ACTIVITY -> Expire/delete; no stock/payment authority; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Checkout Session / checkout-session | Checkout; Confirmed price/options/delivery and context snapshot | CREATED_AT -> Expire; retain only justified linked transaction fields; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| CheckoutAllocation / checkout-allocation | Checkout / Inventory; Attempt-bound short stock protection | OBJECT_RETIRED -> Purge after convert/expire/release unless specific reconciliation/hold; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Seller Order / Order Line / order-transaction | Orders; Buyer/Seller, purchased snapshots and fulfilment | ORDER_COMPLETED -> Retain justified fact; minimize address and live identity; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| PaymentAttempt / provider result / provider-payment | Finance; Exact amount/currency/reference and normalized outcome | PAYMENT_RECONCILED -> Keep justified canonical fact; bounded raw exception; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Launch-zero surcharge ledger / surcharge-ledger | Finance; Separate Buyer accounting component/policy snapshot | PAYMENT_RECONCILED -> Accounting retention; no unrelated profile reuse; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Refund / settlement / finance-remedy | Finance; Provider-confirmed remedy/payout records | REFUND_COMPLETED -> Retain justified fact; bounded reconciliation payload; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Provider account / KYC status reference / provider-readiness | Finance; Hosted-provider ref and readiness; no admission ID | SELLER_CLOSED -> Provider deletion/retention contract; restrict minimal reference; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Fulfilment / Courier assignment / fulfilment-evidence | Fulfilment; Order scope, current assignment and timestamps | ORDER_COMPLETED -> Assignment ends; retain justified transfer references; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Courier GPS / delivery-location | Fulfilment; Purpose-limited active-delivery location | ORDER_COMPLETED -> Minimum precision/window; delete direct route, no Analytics copy; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Handoff / handoff-evidence | Handoff; Online accepted evidence, method/stage/digest metadata | ORDER_COMPLETED -> No raw QR/OTP; minimum evidence/hold-aware retention; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Delegated recipient / delegate-identity | Handoff; Name/phone/control and one active authorization | ORDER_COMPLETED -> Delete/minimize direct identity after purpose; small evidence ref; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Review Grant / review-eligibility | Reviews; Buyer/Order identity, FINAL_HANDOFF or VERIFIED_ORDER_FAILURE evidence, received-line eligibility | ACCOUNT_DELETION_COMPLETED -> Unused Grant unusable; minimum justified historical eligibility; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Reviews / ratings / review-content | Reviews; Public text/author presentation, separate rating dimensions | ACCOUNT_DELETION_COMPLETED -> Delete or anonymize per approved policy; internal eligibility separate; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Claims / evidence / claim-evidence | Claims; One Seller Order/optional line, statements and exact snapshots | CLAIM_RESOLVED -> Scoped hold then approved tail; private access and corrections; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Moderation / moderation-evidence | Moderation; Reported revision/decision/reporter provenance | HOLD_RELEASED -> Public removal distinct; reporter protection and appeal tail; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Trust / trust-history | Trust; NEW/REBUILDING/ESTABLISHED/TRUSTED evidence | SELLER_CLOSED -> Bounded historical facts/appeal; no unlimited behavioral retention; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Chat / chat-ordinary | Chat; Private messages with NONE/PRODUCT_POST/SCENE_POST/ORDER subject | LAST_ACTIVITY -> Ordinary retention; only selected promoted messages held; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Chatbot / chatbot-support | Chatbot; Intent/template/session and Product/Scene/Order anchors | LAST_ACTIVITY -> Minimize free text; no default long-term training corpus; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Collections / collection-private | Collections; Private names/ordering and Product/Scene memberships | ACCOUNT_DELETION_COMPLETED -> Delete subject rows; no deletion of canonical saved objects; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Search / search-personal | Search; Query history and entity projections | LAST_ACTIVITY -> Avoid raw queries by default; delete subject history/projections; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| FYP / recommendation / recommendation-personal | Recommendation; First-party affinities, feedback, ranked Scene features | ACCOUNT_DELETION_COMPLETED -> Purge person profile/link; current Content gates remain; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Notifications / notification-history | Notifications; Channel preferences, logical notices/delivery references | SESSION_REVOKED -> Revoke tokens; bounded security/operational history; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Analytics / analytics-raw | Analytics; Typed raw observations, attribution and derived reports | CREATED_AT -> Bounded raw partition/subject suppression; aggregates only if anonymous; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Audit / privileged-audit | Audit; Typed ordinary/Operator/SYSTEM accountability | CREATED_AT -> Restricted justified retention; no evidence bodies; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Eventing / outbox / jobs / async-transport | Eventing; Minimal domain references/status/effect identity | OBJECT_RETIRED -> Bound processed/dead-letter retention; suppression before rebuild; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Logs / Sentry / CSP reports / security-telemetry | Observability / Security; Minimized route/directive/result/release observations | CREATED_AT -> No raw report URL/query/policy nonce; bounded operational policy; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Privacy requests / holds / privacy-accountability | Privacy; Purpose/policy/task/hold/verification metadata | HOLD_RELEASED -> Minimize subject ref; retain proof/review only as justified; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: selected justified evidence only; review/release mandatory |
| Processor records / actions / processor-governance | Privacy / owner adapter; Deployment, contract/region, request/completion proof | OBJECT_RETIRED -> Version governance evidence; no duplicated processor payload; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |
| Backups / backup-recovery | Deployment / DB operations; Restricted point-in-time copies of approved data | CREATED_AT -> Bound rotation; authoritative suppression replay before traffic; duration LEGAL REVIEW REQUIRED; rule source approved PRV purpose/policy. Hold: no default hold; any exceptional evidence promotion requires exact approved scope and separate purpose |

Rule source for every row: approved purpose-specific PRV policy plus applicable legal/accounting/case decision; presently LEGAL REVIEW REQUIRED. Hold eligibility only selected transaction/Claim/security/legal evidence where justified. General preference/profile/delegate/route data is not automatically held; every row requires explicit scope and review/release.

## 63. Appendix B - Processor Register

Active-production register: EMPTY / VERIFICATION REQUIRED. The following are CANDIDATE ARCHITECTURE records, not active approvals. No Twilio/Infobip or other future Market vendor is declared live. Split categories into exact legal-entity/subprocessor records once activation is verified.

### Render / hosting

| Processor field | Candidate record / activation evidence required |
| --- | --- |
| Status / purpose | NOT VERIFIED ACTIVE; Application/database/worker hosting |
| Data / role | Canonical domain data and minimal job refs; Hosting role/entity must be verified |
| Country / region / transfer | VERIFY PRODUCTION CONFIGURATION for storage, support and onward processing. Ethiopian source context; transfer mechanism LEGAL REVIEW REQUIRED. |
| Contract / DPA / security | NOT PROVIDED; obtain actual terms, permitted purpose, access/encryption/security evidence and vendor review. |
| Retention / subprocessor | VERIFY contract settings, policy triggers, exact subprocessor/version/destinations; no duration or onward party invented. |
| Deletion / breach contact / exit | Hosting/backup exit and deletion proof; actual deletion mechanism/test, reachable breach escalation contact and exit schedule OPEN. |

### Cloudflare R2 / CDN / edge

| Processor field | Candidate record / activation evidence required |
| --- | --- |
| Status / purpose | NOT VERIFIED ACTIVE; Media delivery, private objects and edge protection |
| Data / role | Public media derivatives; restricted object bytes; minimized network metadata; Object/cache/edge processing role and locations must be verified |
| Country / region / transfer | VERIFY PRODUCTION CONFIGURATION for storage, support and onward processing. Ethiopian source context; transfer mechanism LEGAL REVIEW REQUIRED. |
| Contract / DPA / security | NOT PROVIDED; obtain actual terms, permitted purpose, access/encryption/security evidence and vendor review. |
| Retention / subprocessor | VERIFY contract settings, policy triggers, exact subprocessor/version/destinations; no duration or onward party invented. |
| Deletion / breach contact / exit | Bucket deletion, CDN purge and export expiry proof; actual deletion mechanism/test, reachable breach escalation contact and exit schedule OPEN. |

### Sentry

| Processor field | Candidate record / activation evidence required |
| --- | --- |
| Status / purpose | NOT VERIFIED ACTIVE; Error/performance/release observation |
| Data / role | Redacted bounded route/result/release only; Telemetry role/entity/DSN region must be verified |
| Country / region / transfer | VERIFY PRODUCTION CONFIGURATION for storage, support and onward processing. Ethiopian source context; transfer mechanism LEGAL REVIEW REQUIRED. |
| Contract / DPA / security | NOT PROVIDED; obtain actual terms, permitted purpose, access/encryption/security evidence and vendor review. |
| Retention / subprocessor | VERIFY contract settings, policy triggers, exact subprocessor/version/destinations; no duration or onward party invented. |
| Deletion / breach contact / exit | Retention/access/erasure and safe export proof; actual deletion mechanism/test, reachable breach escalation contact and exit schedule OPEN. |

### Afromessage / SMS Ethiopia

| Processor field | Candidate record / activation evidence required |
| --- | --- |
| Status / purpose | NOT VERIFIED ACTIVE; Initial Ethiopia OTP/security messages if activated |
| Data / role | Minimum phone and approved transient message; Actual primary/backup route, legal entity and role must be verified |
| Country / region / transfer | VERIFY PRODUCTION CONFIGURATION for storage, support and onward processing. Ethiopian source context; transfer mechanism LEGAL REVIEW REQUIRED. |
| Contract / DPA / security | NOT PROVIDED; obtain actual terms, permitted purpose, access/encryption/security evidence and vendor review. |
| Retention / subprocessor | VERIFY contract settings, policy triggers, exact subprocessor/version/destinations; no duration or onward party invented. |
| Deletion / breach contact / exit | Channel retention/deletion and termination proof; actual deletion mechanism/test, reachable breach escalation contact and exit schedule OPEN. |

### Expo / FCM / APNs as actually used

| Processor field | Candidate record / activation evidence required |
| --- | --- |
| Status / purpose | NOT VERIFIED ACTIVE; Push infrastructure if activated |
| Data / role | Device push token and safe minimal notice; Actual routed supplier chain/platform roles must be verified |
| Country / region / transfer | VERIFY PRODUCTION CONFIGURATION for storage, support and onward processing. Ethiopian source context; transfer mechanism LEGAL REVIEW REQUIRED. |
| Contract / DPA / security | NOT PROVIDED; obtain actual terms, permitted purpose, access/encryption/security evidence and vendor review. |
| Retention / subprocessor | VERIFY contract settings, policy triggers, exact subprocessor/version/destinations; no duration or onward party invented. |
| Deletion / breach contact / exit | Token revocation, payload lifetime and provider completion; actual deletion mechanism/test, reachable breach escalation contact and exit schedule OPEN. |

### PSP / Chapa if enabled

| Processor field | Candidate record / activation evidence required |
| --- | --- |
| Status / purpose | NOT VERIFIED ACTIVE; Payment, refund, settlement and hosted KYC |
| Data / role | Minimum scoped attempt/ref/amount; provider-hosted documents; Actual activation, legal entity, controller/processor boundary must be verified |
| Country / region / transfer | VERIFY PRODUCTION CONFIGURATION for storage, support and onward processing. Ethiopian source context; transfer mechanism LEGAL REVIEW REQUIRED. |
| Contract / DPA / security | NOT PROVIDED; obtain actual terms, permitted purpose, access/encryption/security evidence and vendor review. |
| Retention / subprocessor | VERIFY contract settings, policy triggers, exact subprocessor/version/destinations; no duration or onward party invented. |
| Deletion / breach contact / exit | Reconciliation/export, retention/deletion and migration plan; actual deletion mechanism/test, reachable breach escalation contact and exit schedule OPEN. |

### TikTok / Meta if enabled

| Processor field | Candidate record / activation evidence required |
| --- | --- |
| Status / purpose | NOT VERIFIED ACTIVE; Social control and conditional Product embed |
| Data / role | Minimum scopes/control result; embed may disclose IP/cookie/referrer; Independent provider/processor roles and tracking require legal review |
| Country / region / transfer | VERIFY PRODUCTION CONFIGURATION for storage, support and onward processing. Ethiopian source context; transfer mechanism LEGAL REVIEW REQUIRED. |
| Contract / DPA / security | NOT PROVIDED; obtain actual terms, permitted purpose, access/encryption/security evidence and vendor review. |
| Retention / subprocessor | VERIFY contract settings, policy triggers, exact subprocessor/version/destinations; no duration or onward party invented. |
| Deletion / breach contact / exit | Token disconnect, selected evidence expiry, embed replacement; actual deletion mechanism/test, reachable breach escalation contact and exit schedule OPEN. |

## 64. Appendix C - Lawful-Basis Register

All rows require the applicable Ethiopian legal provision, sensitive-data condition where relevant, confirmation authority/date and exact notice/version. No candidate below is an approved final basis.

| Activity / purpose | Candidate / condition / confirmation |
| --- | --- |
| PA-01 Auth and recovery; Authenticate and secure one human | Contract/security candidates; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-02 Seller onboarding; Admit legitimate Seller business | Contract / legitimate-purpose candidates; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-03 Social verification; Verify TikTok/Instagram account control | Contract/security candidates; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-04 Product publication; Present sellable Products | Contract / content permission candidates; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-05 Scene publication; Photo merchandising with same-Seller Product tags | Contract / content permission candidates; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-06 For You recommendations; Relevant photo Scene discovery | Personalization basis requires review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-07 Marketplace Search; Find Product Posts, Sellers and Scene Posts | User-requested service candidate; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-08 Collections; Private saved Product/Scene preferences | Contract candidate; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-09 Buyer-Seller Chat; Private commerce communication | Contract / communication basis review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-10 Deterministic Chatbot; Bounded Buyer support | Service-support candidate; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-11 Cart and Checkout; Explicit purchase confirmation | Contract candidate; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-12 Provider payment; Verify money and refund state | Contract/accounting candidate; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-13 Settlement and provider onboarding; Provider readiness and payout reconciliation | Contract/legal duty candidates; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-14 Fulfilment and assignment; Complete exact paid Seller Order | Contract candidate; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-15 Courier GPS; Support active delivery operational evidence | Location basis requires review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-16 Handoff verification; Establish physical custody receipt online | Contract/security candidate; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-17 Delegated receipt; Authorize one recipient for final Collection or delivery | Delegate-processing basis review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-18 Reviews and Grants; Verified purchase-quality/service feedback | Feedback publication basis review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-19 Trust evaluation; Evidence-based marketplace reputation | Reputation basis requires review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-20 Claims and disputes; Human resolution of one Seller Order | Dispute/accountability candidates; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-21 Moderation and abuse; Keep people and commerce safe | Safety basis requires review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-22 Notifications; Purpose-bound operational/security communication | Service / consent categories review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-23 First-party Analytics; Measure declared product/business outcomes | Measurement basis requires review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-24 Seller Analytics; Aggregate business insight without Buyer identity | Aggregate service basis review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-25 Operator operations; Govern marketplace with accountable privilege | Governance/security candidates; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-26 Observability and security; Detect failures/abuse without evidence shadow archive | Security/operations basis review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-27 Privacy rights and lifecycle; Provide rights, scoped retention and deletion proof | Rights/legal duty candidates; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-28 Backups and restore; Recover service while respecting deletion | Recovery/security candidates; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-29 CSP reporting; Observe blocked browser resource attempts | Security basis requires review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |
| PA-30 Processor and transfer governance; Control external processing and termination | Legal/governance basis review; sensitive/incidental data and minors conditions assessed individually; LEGAL REVIEW REQUIRED; notice NOT PROVIDED. |

## 65. Appendix D - Risk Scoring

| Dimension | Operational meaning |
| --- | --- |
| Likelihood 1 / 2 | Rare / Unlikely; plausible uncommon event; require actual exposure/control evidence before lowering score. |
| Likelihood 3 / 4 / 5 | Possible / Likely / Almost Certain; exposure opportunity, repeated failures and actor incentives inform judgment. |
| Impact 1 / 2 / 3 | Minimal / Minor / Moderate; degree, duration, reversibility, number/vulnerability of affected people. |
| Impact 4 / 5 | Major / Severe; serious identity/financial/reputational/exclusion effects or physical safety/irreversible harm. |
| Score / bands | L x I; 1-4 Low, 5-9 Moderate, 10-16 High, 17-25 Critical. |
| Inherent / actual / projected | Inherent absent/failed controls; actual supported by verified evidence; projected conditional on planned controls. Do not conflate. |

An authorized reviewer records rationale, uncertainty and disagreements. Vulnerable people, aggregated harm and inability to contest may increase impact. Scores support decisions; a Low score does not waive law.

## 66. Appendix E - Mitigation Tracker

| Risk / owner | Action / deadline / verification / blocker |
| --- | --- |
| R-01 / Auth / Security | Verify OTP throttling, recovery/session revocation and cross-Account Order/Chat denial; execute takeover/recovery regression. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-02 / Authorization / Seller | Test ACTIVE/SUSPENDED membership, role union, tenant switch, removed membership and forged Seller IDs across APIs/exports. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-03 / Security / Operations | Prove least privilege, Step-Up, scoped approved export, audit review and immediate revocation; insider drill with safe fixture. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-04 / Recommendation / Privacy | Review every feature/purpose, offer meaningful negative feedback/reset and lawful objection path; test reduced-signal alternative and profile purge. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-05 / Product / Recommendation | Audit cohorts/proxies and exposure concentration, test new-Seller fairness and stop harmful experiments; competent human challenge. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-06 / Trust / Operations | Trace adverse result to permitted evidence, test correction/rebuild and appeal; QR/OTP/Manual quality policy independent from receipt validity. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-07 / Claims / Media / Security | Test object URLs/download/export/preview and counterparty minimization; enforce case purpose and expiring capabilities. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-08 / Chat / Privacy | Prove no training/profile/log pipeline consumes raw Chat; selected-message promotion and expiry tests. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-09 / Fulfilment / Privacy | Test start/stop/background/reassignment and access; approve smallest useful precision/retention and remove routes from Analytics. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-10 / Fulfilment / Orders | Test stale Courier, Seller team scope, logs/lockscreen/export and post-delivery minimization; no public location detail. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-11 / Handoff / Notifications | Prohibit marketing/affinity copy; test contact expiry, revoked authorization and source-recipient notice. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-12 / Onboarding / Security | Verify callback state/replay, secret store/redaction, revoke/expire and provider scope; staged compromise drill without live token. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-13 / Onboarding / Operations | Review capture UI/Operator procedure; prove unrelated inbox/message content cannot enter retained case/log/export. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-14 / Finance / Privacy | Inspect schemas/upload endpoints/provider mapping; reject document upload into admission and verify provider-hosted alternative. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-15 / Finance / Security | Verify PSP contract/role/regions, access/webhook redaction, bounded raw exceptions and deletion; supplier security review. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-16 / Privacy / Legal / Procurement | Verify every destination/subprocessor, lawful transfer authorization and DPA; block unapproved region activation and reassess change. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-17 / Analytics / Privacy | Test linkability, export joins and small cohorts/differencing; approve threshold/rules and subject suppression. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-18 / Search / Privacy | Test logs/search history deletion and query minimization; prohibit unrestricted query exports and sensitive profiling. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-19 / Reviews / Moderation | Test personal-info reporting/removal, safe author presentation and approved anonymization; fair factual criticism review. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-20 / Deployment / Privacy | Execute full backup/queue/media/projection restore drill; no serving until mandatory deletion proof and suppression checks pass. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-21 / Privacy / Domain owners | Approve every class trigger/duration/action; measure expired rows/objects/processor copies and run bounded purge verification. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-22 / Privacy / Claims / Legal | Test expired/broad holds rejected, review escalation and release/purge fence; approve lawful exception and subject explanation. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-23 / Observability / Security | Inject safe sentinel OTP/Chat/QR/GPS/KYC/provider payloads; prove absent from SDK, network, logs, attachments and dead letters. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-24 / Security / Observability | Send adversarial signed/private URLs, original policy and nonce samples; verify discarded before store/Sentry/logs. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-25 / Content / Media / Legal | Verify report/removal and safe evidence hold; strip EXIF; review minor/third-party notice and authority. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-26 / Moderation / Media | Test prohibited/identifying content fixtures, response/removal and cache purge; measure human false negatives/appeals. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-27 / Seller / Content / Privacy | Test Storefront/Search/Scene/public links and historical exports after closure; minimize identity while scoped evidence remains. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-28 / Finance / Orders | Execute invalid signature/ref/amount/currency/replay tests, backend reconciliation and paid-stock race tests. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-29 / Handoff / Security | Test expired/replayed/stale assignment/wrong recipient, raw-secret absence and Manual authority; no offline accept. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-30 / Handoff / Notifications | Test phone confirmation/correction, cancellation/replacement and revoke/reissue; notices reveal no private body. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-31 / Chat / Trust & Safety | Provide warnings/report workflow; verify proportionate review and response, no bot prompts asking unnecessary IDs/secrets. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-32 / Moderation / Product | Test false positive/appeal/restoration, source traceability and group effects; human review of consequential action. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-33 / Privacy / Domain owners | Test multi-relationship subject identity, redacted counterparty evidence, expiring private export and wrong-account denial. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-34 / Procurement / Security / Privacy | Verify actual contract notification/24h reachable contact, staged supplier incident drill and escalation; no assumed grace period. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |
| R-35 / Incident Commander / Privacy / Legal | Tabletop Article 43 Authority and Article 44 subject tracks separately; preserve awareness, updates/reasons and authorized legal decision. Due before first pilot or feature activation, whichever earlier. Test/config/legal evidence OPEN; execution/date/reviewer OPEN; launch-blocking YES; acceptance NOT ACCEPTED. |

Attach evidence only after execution; role owners nominate a named accountable person. Re-rating must link evidence and exact processing/control versions. A ticket created or scheduled is not a verified mitigation.

## 67. Appendix F - Document & Legal References

| Reference | Assessment use / evidence status |
| --- | --- |
| ADU-PRV-01 / current revision | 40-class inventory, purpose/policy/lifecycle/export/hold/processor/backup contracts; design evidence, implementation not proved. |
| ADU-OBS-01 / current revision | Monitors/runbooks, redaction and incident clocks; executed drills OPEN. |
| ADU-CSP-01 v1.1 | Per-surface policy/report minimization and deployment tests; enforced production evidence OPEN. |
| Auth / Seller / Onboarding designs | Ordinary/Operator and scoped membership/social-control intended controls. |
| Catalogue / Scene / Media / Search / Recommendation | Public gates, photos, ranking, private preference and derived feature contracts. |
| Orders / Finance / Fulfilment / Handoff / Reviews | Provider money/KYC boundary, assignments/receipt/delegates and unique final Buyer Grant. |
| Claims / Trust / Moderation / Chat / Chatbot / Analytics | Scoped human evidence, contestability, purpose-limited communication and measurement. |
| Platform / Eventing / Deployment / Notifications | Durable intent, bounded transport, recovery and channel lifecycle. |
| Production evidence pack | Contracts/DPA/regions, notices/bases, security/deletion/restore tests and signed decisions NOT PROVIDED. |
| L01 official Ethiopian proclamation | https://justice.gov.et/en/law/personal-data-protection-proclamation/ |
| L02 ECA privacy portal | https://pdp.eca.et/ |

Sources checked 8 October 2026. Official proclamation Articles 43/44, 47/48 inform incident/DPIA governance; current implementing ECA procedure/form must be verified. No draft manual is presented as binding or as a completed submission.

## 68. Appendix G - Legal-Review Questions

| Question | Owner / status / required evidence |
| --- | --- |
| Final lawful basis and sensitive/incidental-data conditions for every PA purpose | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Selected 18+ declaration: legal known-underage / incidental-person handling, notices and retention | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Controller/processor registration and DPO appointment requirements | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Actual processor legal entities, roles, contracts, subcontractors and regions | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Applicable international transfer safeguards and Article 48 authorization | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Exact Chat/GPS/Analytics/Review/accounting/Claim/audit/backup retention rules | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Data-subject verification, response deadlines, applicable objection/portability and exceptions | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Trust/ranking/moderation significant automated effects, explanation and appeal duties | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Delegate/depicted-person transparency and lawful contact/image handling | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| TikTok embed tracking, notice/consent and less-intrusive alternative | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Any provider KYC document exposure and Finance legal obligations | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Actual residual High risks, prior consultation and Authority procedure | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |
| Separate Articles 43/44 notification duties, conditions, contacts and clocks | Privacy + Ethiopian Legal counsel; OPEN / LEGAL REVIEW REQUIRED. Record applicable authority, actual facts, written decision/reviewer/date and launch consequence. |

## 69. Appendix - Actual Launch-Scope Evidence Register

| Data / owner / policy draft | Approval evidence / gate / status |
| --- | --- |
| 18+ declaration / denied registration / Auth / age-declaration / registration trigger | Account creation declaration + policy version; no permanent denied child profile; Privacy/Legal exact retention and known-underage handling. Actual processor/region VERIFY PRODUCTION CONFIGURATION; policy version DRAFT; responsible person UNASSIGNED (role owner above); status PLANNED / OPEN; real-data feature gated until approved. |
| PRIVATE_CHAT attachment / Chat / Media / chat-attachment / Message lifecycle; hold fence | Conversation/send/Message/sender binding and selected scoped evidence; Existing image/byte/expiry limits and owner access verification. Actual processor/region VERIFY PRODUCTION CONFIGURATION; policy version DRAFT; responsible person UNASSIGNED (role owner above); status PLANNED / OPEN; real-data feature gated until approved. |
| Guest delegate contact / SMS intent / Handoff / delegate-contact / expiry-revoke-complete | One authorization generation, purpose-bound contact + transport dedupe; Privacy basis/notice/retention; existing SMS processor contract. Actual processor/region VERIFY PRODUCTION CONFIGURATION; policy version DRAFT; responsible person UNASSIGNED (role owner above); status PLANNED / OPEN; real-data feature gated until approved. |
| Two optional checkpoints / Fulfilment / checkpoint-evidence / delivery purpose end | PICKUP/DELIVERY foreground point/status; safe public milestone; Location basis/retention + actual region/access tests. Actual processor/region VERIFY PRODUCTION CONFIGURATION; policy version DRAFT; responsible person UNASSIGNED (role owner above); status PLANNED / OPEN; real-data feature gated until approved. |
| Zero surcharge / processing fee / charge exceptions / Finance / Orders / provider-money / reconciliation-accountability | Exact quote/charge/merchant/currency/basis; late duplicate charge and Seller obligation; Merchant permissions/finality/funding and legal financial retention. Actual processor/region VERIFY PRODUCTION CONFIGURATION; policy version DRAFT; responsible person UNASSIGNED (role owner above); status PLANNED / OPEN; real-data feature gated until approved. |
| Failure feedback / Claim correction / Reviews / Claims / Trust / feedback-evidence / review-case lifecycle | One Order basis, Seller-service opinion, private decision/evidence + safe remedy label; Public notice/basis/retention, correction/projection and safe disclosure tests. Actual processor/region VERIFY PRODUCTION CONFIGURATION; policy version DRAFT; responsible person UNASSIGNED (role owner above); status PLANNED / OPEN; real-data feature gated until approved. |

Retain the existing complete data-class/processor/region register, lifecycle tasks, scoped holds, purge serialization, derived deletion, processor proof and restore suppression. Apply these additions to the actual Ethiopia scope; future Market requirements are separately gated. No statutory duration, DPA, named signer, regulator permission or implemented test is invented.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 70. Glossary

| Term | Current meaning |
| --- | --- |
| Ordinary Account | One human identity with Buyer, Seller and Courier relationships. |
| Operator Account | Separate privileged principal with independent audience and scoped access. |
| Scene Post | Photo merchandising content tagging same-Seller Product Posts. |
| PRIVATE visibility | Unavailable publicly; distinct from archive, deletion or evidence purge. |
| Seller Order | One Seller payment/fulfilment scope within explicit Checkout. |
| CheckoutAllocation | Optional short-lived attempt-bound stock support, not a Buyer reservation. |
| Provider fact | Authenticated backend-matched money outcome; client return is not proof. |
| Review Grant | One Buyer-owned eligibility/consumption per paid Seller Order; FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; delegate never owns it. |
| Scoped hold | Narrow justified evidence retention with review and release. |
| Suppression replay | Apply deletion ledger before restored data or projections serve traffic. |
| Purpose limitation | Processing only for an approved necessary, proportionate purpose. |
| Projected residual | Conditional risk after planned controls; not verified actual risk. |
| Processor activation | Actual provider/region/contract approval; architecture presence is insufficient. |
| Report-Only | Observation policy that does not enforce browser blocking. |
| Legal review required | Unresolved legal determination; no engineering compliance certification. |
