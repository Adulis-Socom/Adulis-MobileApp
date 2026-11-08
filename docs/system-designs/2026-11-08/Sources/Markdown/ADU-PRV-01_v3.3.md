# Adulis Privacy & Data Lifecycle
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R01, R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-PRV-01_Adulis_Privacy_Retention_Deletion_Data_Lifecycle_Complete_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Executive Summary

Privacy/Data Lifecycle coordinates purpose-bound, policy-versioned deletion, retention and export across domain-owned data. It preserves scoped evidence while minimizing identity and proving mandatory domain, derived, object, processor and backup-suppression actions. Enqueued or finished jobs alone do not prove deletion.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one current non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Multiple roles union permissions within that membership; ownership and Courier relationships do not consume the TEAM limit. Different humans use different Accounts.

Finance/Payments alone establishes canonical payment, refund and settlement facts from authenticated provider callbacks and/or backend verification matched to the exact attempt/reference, Seller Order, amount and currency. Client return navigation, Seller statements and screenshots never establish PAID. Checkout snapshots merchandise, delivery, the zero launch Adulis Buyer surcharge (0 bps), exact currency rounding, Buyer total and Commercial Policy version before explicit confirmation. Payment, provider settlement and physical receipt are independent.

This revision reconciles the complete source architecture. ADU-DPIA-01 evaluates people's privacy risks using this inventory, policies, processor/transfer map, rights and security controls; it does not replace lifecycle implementation. ADU-CSP-01 governs browser resources and minimized CSP security reports.

## 2. Mission

Ensure every Adulis data element has a known owner, purpose, classification, retention source,

deletion/anonymisation method, hold behavior and recoverable lifecycle path so user privacy can be honored without destroying marketplace evidence or allowing indefinite hidden retention.

## 3. Goals

• Maintain a comprehensive data inventory and classification model.

• Translate retention/privacy policy into versioned executable configuration.

• Provide idempotent Account deletion and Seller closure workflows.

• Separate hard deletion, anonymisation, pseudonymisation, cryptographic erasure, soft

lifecycle state and tombstones.

• Preserve Orders/Claims/Trust/audit facts only as justified and minimize identity after deletion.

• Protect Claim/legal/security evidence with granular holds.

• Ensure caches, Search, FYP, Analytics, devices, processors and object storage participate in

lifecycle completion.

• Prevent backup restore from resurrecting deleted subjects/data.

• Support data access/export without leaking other people's private data.

• Keep legal uncertainties explicit and configurable by Market/policy version.

• Provide observable, auditable, bounded batch execution for a small team.

## 4. Non-Goals

This document does not:

• provide definitive legal advice or invent statutory retention periods;

• turn a DPIA into code automatically;

• allow Privacy to mutate every domain's tables directly;

• treat soft delete as completed privacy deletion;

• erase immutable transaction/evidence facts merely because an Account disappears;

• keep every record forever "in case of Claims";

• build a commercial data-governance/catalogue platform;

• introduce Kafka/Temporal/Kubernetes for deletion workflows;

• perform cross-border legal analysis for future Markets before expansion;

• guarantee that backups can surgically remove one row without restore/reapplication controls.

## 5. Product Context

Ethiopia is the initial active commerce Market, beginning with Addis Ababa. Future countries/providers require explicit legal, currency, commercial and operational activation. Locale, IP address, phone prefix and client country do not activate commerce. Actual provider routing and processing regions must be verified from production configuration.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one current non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Multiple roles union permissions within that membership; ownership and Courier relationships do not consume the TEAM limit. Different humans use different Accounts.

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

Content owns Scene Post publication DRAFT/PUBLISHED/ARCHIVED separately from visibility PUBLIC/PRIVATE. A public Scene requires same-Seller eligible Product Post tags with at least one available Product, valid photo media/caption and current Seller, Market and safety gates. Loss of the last available tagged Product changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Eligible restock can restore PUBLIC after every current gate passes; it does not clear independent archive/moderation restrictions or require manual republishing solely for restock.

Finance/Payments alone establishes canonical payment, refund and settlement facts from authenticated provider callbacks and/or backend verification matched to the exact attempt/reference, Seller Order, amount and currency. Client return navigation, Seller statements and screenshots never establish PAID. Checkout snapshots merchandise, delivery, the zero launch Adulis Buyer surcharge (0 bps), exact currency rounding, Buyer total and Commercial Policy version before explicit confirmation. Payment, provider settlement and physical receipt are independent.

Adulis Seller admission collects no Government ID, passport, driving-licence image, selfie-to-ID artifact or Government-ID hash. Social-account-control evidence supports admission. Provider KYC/KYB is a separate Finance/provider compliance purpose; prefer provider-hosted collection and retain minimum safe readiness status/reference. Any unavoidable Adulis receipt requires confirmed necessity and restricted Finance controls, not an Onboarding identity class.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Current data covers Products/Scene revisions, phone/Auth, Seller relationships, Cart/Checkout Session/short-lived CheckoutAllocation, Seller Orders, PaymentAttempt/provider/refund/settlement, Fulfilment/Handoff/delegates, Reviews/Trust/Claims/Moderation, Chat/Chatbot, Collections/Search/FYP, Notifications, connected Analytics, Audit, lifecycle state, processors and backups. Buyer Home has For You, Following, Nearby, Discounts and Locally Made; For You is photo-only Scene Posts, never standalone Products. Search supports PRODUCT_POST, SELLER and SCENE_POST; Collections supports Product and Scene items.

## 6. Legal/Policy Assumptions

Ethiopia Personal Data Protection Proclamation No. 1321/2024 is the initial legal baseline [L01]. Article 47 concerns DPIA and Article 48 prior authorization/consultation. Article 43 provides the controller-awareness 72-hour Authority notification clock; Article 44 separately addresses data-subject communication. Legal/privacy authority applies conditions and records determinations; engineering neither invents exemptions nor certifies compliance.

LEGAL REVIEW REQUIRED: final purposes/lawful bases, sensitive-data conditions, registration/authorization, DPO duties, rights response rules, retention durations, transfer/localisation safeguards and evidentiary obligations. The ECA portal is the current regulatory reference [L02]; retrievable draft guidance is not treated as enacted law. Approval must reference the final corporate and production configuration, including hosting and processors.

## 7. Engineering vs Legal Responsibilities

| Question | Engineering decides | Legal/business decides |
| --- | --- | --- |
| How deletion propagates | workflow/handlers/idempotency | whether data is legally deletable now |
| Retention duration storage | configurable policy engine | exact period and legal basis |
| Holds | data model/enforcement/audit | authority/reason/duration/review |
| Data export mechanism | secure generation/delivery | scope/format/legal response requirement |
| Cross-border processing | provider/region inventory, controls | transfer basis/approval |
| Consent/withdrawal mechanics | state/versioning/hooks | when consent is lawful basis |
| Evidence preservation | immutable refs/holds | statutory/business necessity |

## 8. Domain Ownership

Privacy owns coordination metadata; each domain owns interpretation, mutation and verification of its data. Audit owns privileged accountability; Finance owns provider records; Content owns Scene visibility.

| Data scope | Owner | Lifecycle contract |
| --- | --- | --- |
| Ordinary Account / Operator Account | Auth / Operator Auth, separate principals | Revoke access; minimize appropriate historical provenance. |
| Seller ownership / TEAM / Courier relationship | Seller / Authorization / Fulfilment | Relationship exit distinct from Account deletion. |
| Products / Scenes / Media / stock | Catalogue / Content / Media / Inventory | Publication/visibility separate from actual purge; reference/hold-aware bytes. |
| Cart / Checkout Session / allocation | Checkout / Inventory | Short initiation window; ORDER §35/46 proof and locked charge/dispatch/generation re-read before release; uncertain required stock remains protected. |
| Seller Orders / provider financial records | Orders / Finance | Retain justified transaction snapshots; minimize identity and restricted raw material. |
| Handoff / delegate / Review Grant | Handoff / Reviews | Preserve minimum eligible receipt; revoke unusable Grant and expire direct delegate identity. |
| Claims / Moderation / Trust / Chat | Respective owner domains | Exact scoped evidence and correction history; ordinary Chat independently bounded. |
| Collections / Search / FYP / Analytics | Respective owner domains | Subject linkage/profiles removed; aggregate anonymity assessed. |
| Notifications / Eventing / telemetry | Notifications / Eventing / OBS | Tokens and payloads bounded; no sensitive shadow archive. |
| Processors / backups | Domain adapter / Privacy / Deployment | Track external proof; suppression replay and verification before restore traffic. |

## 9. Data Classification

Classify along separate dimensions; classification does not by itself decide a lawful basis or statutory sensitive-data definition.

| Dimension | Classes and interpretation |
| --- | --- |
| Privacy | PUBLIC, INTERNAL, PERSONAL, SENSITIVE_PERSONAL; Legal confirms sensitive classification for location, evidence and other context. |
| Business | IDENTITY, TRANSACTIONAL, FINANCIAL_RECORD, COMMUNICATION, TRUST_SAFETY, SECURITY, AUDIT, ANALYTICS_BEHAVIORAL, DERIVED. |
| Retention | EPHEMERAL, OPERATIONAL, TRANSACTION_RECORD, RESTRICTED_EVIDENCE, SECURITY_AUDIT, ANONYMISED_AGGREGATE. |
| Access | PUBLIC, USER_PRIVATE, SELLER_PRIVATE, OPERATOR_RESTRICTED, SECURITY_RESTRICTED, EVIDENCE_RESTRICTED. |

An ordinary financial record is normalized provider/accounting data. A voluntary Claim financial attachment belongs to a restricted case evidence class; there is no normal FINANCIAL_EVIDENCE screenshot-upload payment subsystem.

## 10. Data Inventory

This is the complete current inventory baseline. Each implementation entry is expanded to table/entity/object-prefix level with data_class_id, owner, purposes, sensitivity, source/recipients, canonical/derived copies, retention_policy_id/version, trigger, action, hold eligibility, processor/region and completion proof. Policy stems below are proposed identifiers, not approved durations or legal bases. All exact unapproved values are LEGAL REVIEW REQUIRED.

| Data class / policy stem | Owner / necessary data | Trigger / lifecycle |
| --- | --- | --- |
| Ordinary Account<br>account-core | Auth; Phone/profile; PERSONAL/IDENTITY | ACCOUNT_DELETION_COMPLETED -> Revoke; minimize/delete direct identity; minimal suppression |
| Phone / Auth / session / device / OTP<br>auth-security | Auth; Security metadata; no raw OTP/token export | SESSION_REVOKED -> Expire/revoke; keyed phone cooling only when justified |
| Seller organization<br>seller-core | Seller; Public business + representative data | SELLER_CLOSED -> Public removal; minimize personal fields; retain obligations |
| Ownership / TEAM membership<br>seller-relationship | Authorization / Seller; Typed ordinary Account relationship and roles | LAST_ACTIVITY -> Revoke relationship; preserve minimal actor history |
| Social-account-control evidence<br>social-control | Onboarding; TikTok/Instagram control result and minimal DM evidence | SELLER_CLOSED -> Delete tokens/challenges; retain justified bounded reference |
| Operator Account<br>operator-account | Operator Auth / Audit; Privileged identity/access and audit provenance | OPERATOR_ACCOUNT_TERMINATED -> Revoke sessions; separate audit retention |
| Product Post / Product / Variant<br>catalogue-history | Catalogue; Commerce representation and Seller provenance | OBJECT_RETIRED -> Unpublish; retain exact purchased-line context where justified |
| Scene Post / revisions / tags<br>scene-content | Content; Photo caption, same-Seller tags and visibility | SCENE_ARCHIVED -> PRIVATE is not purge; exact held revision retained |
| Media<br>media-object | Media; Masters, derivatives and private evidence objects | OBJECT_RETIRED -> Reference/hold check; R2 delete and CDN reconciliation |
| Inventory<br>inventory-ledger | Inventory; Stock ledger and transaction links | ORDER_COMPLETED -> Retain justified ledger; minimize actor identity |
| Cart<br>cart-intent | Checkout; Buyer intent and Product selections | LAST_ACTIVITY -> Expire/delete; no stock/payment authority |
| Checkout Session<br>checkout-session | Checkout; Confirmed price/options/delivery and context snapshot | CREATED_AT -> Expire; retain only justified linked transaction fields |
| CheckoutAllocation<br>checkout-allocation | Checkout / Inventory; Attempt-bound short stock protection | OBJECT_RETIRED -> Purge after convert/expire/release unless specific reconciliation/hold |
| Seller Order / Order Line<br>order-transaction | Orders; Buyer/Seller, purchased snapshots and fulfilment | ORDER_COMPLETED -> Retain justified fact; minimize address and live identity |
| PaymentAttempt / provider result<br>provider-payment | Finance; Exact amount/currency/reference and normalized outcome | PAYMENT_RECONCILED -> Keep justified canonical fact; bounded raw exception |
| Launch-zero surcharge ledger<br>surcharge-ledger | Finance; Separate Buyer accounting component/policy snapshot | PAYMENT_RECONCILED -> Accounting retention; no unrelated profile reuse |
| Refund / settlement<br>finance-remedy | Finance; Provider-confirmed remedy/payout records | REFUND_COMPLETED -> Retain justified fact; bounded reconciliation payload |
| Provider account / KYC status reference<br>provider-readiness | Finance; Hosted-provider ref and readiness; no admission ID | SELLER_CLOSED -> Provider deletion/retention contract; restrict minimal reference |
| Fulfilment / Courier assignment<br>fulfilment-evidence | Fulfilment; Order scope, current assignment and timestamps | ORDER_COMPLETED -> Assignment ends; retain justified transfer references |
| Courier GPS<br>delivery-location | Fulfilment; Purpose-limited active-delivery location | ORDER_COMPLETED -> Minimum precision/window; delete direct route, no Analytics copy |
| Handoff<br>handoff-evidence | Handoff; Online accepted evidence, method/stage/digest metadata | ORDER_COMPLETED -> No raw QR/OTP; minimum evidence/hold-aware retention |
| Delegated recipient<br>delegate-identity | Handoff; Name/phone/control and one active authorization | ORDER_COMPLETED -> Delete/minimize direct identity after purpose; small evidence ref |
| Review Grant<br>review-eligibility | Reviews; Buyer/Order identity, FINAL_HANDOFF or VERIFIED_ORDER_FAILURE evidence, received-line eligibility | ACCOUNT_DELETION_COMPLETED -> Unused Grant unusable; minimum justified historical eligibility |
| Reviews / ratings<br>review-content | Reviews; Public text/author presentation, separate rating dimensions | ACCOUNT_DELETION_COMPLETED -> Delete or anonymize per approved policy; internal eligibility separate |
| Claims / evidence<br>claim-evidence | Claims; One Seller Order/optional line, statements and exact snapshots | CLAIM_RESOLVED -> Scoped hold then approved tail; private access and corrections |
| Moderation<br>moderation-evidence | Moderation; Reported revision/decision/reporter provenance | HOLD_RELEASED -> Public removal distinct; reporter protection and appeal tail |
| Trust<br>trust-history | Trust; NEW/REBUILDING/ESTABLISHED/TRUSTED evidence | SELLER_CLOSED -> Bounded historical facts/appeal; no unlimited behavioral retention |
| Chat<br>chat-ordinary | Chat; Private messages with NONE/PRODUCT_POST/SCENE_POST/ORDER subject | LAST_ACTIVITY -> Ordinary retention; only selected promoted messages held |
| Chatbot<br>chatbot-support | Chatbot; Intent/template/session and Product/Scene/Order anchors | LAST_ACTIVITY -> Minimize free text; no default long-term training corpus |
| Collections<br>collection-private | Collections; Private names/ordering and Product/Scene memberships | ACCOUNT_DELETION_COMPLETED -> Delete subject rows; no deletion of canonical saved objects |
| Search<br>search-personal | Search; Query history and entity projections | LAST_ACTIVITY -> Avoid raw queries by default; delete subject history/projections |
| FYP / recommendation<br>recommendation-personal | Recommendation; First-party affinities, feedback, ranked Scene features | ACCOUNT_DELETION_COMPLETED -> Purge person profile/link; current Content gates remain |
| Notifications<br>notification-history | Notifications; Channel preferences, logical notices/delivery references | SESSION_REVOKED -> Revoke tokens; bounded security/operational history |
| Analytics<br>analytics-raw | Analytics; Typed raw observations, attribution and derived reports | CREATED_AT -> Bounded raw partition/subject suppression; aggregates only if anonymous |
| Audit<br>privileged-audit | Audit; Typed ordinary/Operator/SYSTEM accountability | CREATED_AT -> Restricted justified retention; no evidence bodies |
| Eventing / outbox / jobs<br>async-transport | Eventing; Minimal domain references/status/effect identity | OBJECT_RETIRED -> Bound processed/dead-letter retention; suppression before rebuild |
| Logs / Sentry / CSP reports<br>security-telemetry | Observability / Security; Minimized route/directive/result/release observations | CREATED_AT -> No raw report URL/query/policy nonce; bounded operational policy |
| Privacy requests / holds<br>privacy-accountability | Privacy; Purpose/policy/task/hold/verification metadata | HOLD_RELEASED -> Minimize subject ref; retain proof/review only as justified |
| Processor records / actions<br>processor-governance | Privacy / owner adapter; Deployment, contract/region, request/completion proof | OBJECT_RETIRED -> Version governance evidence; no duplicated processor payload |
| Backups<br>backup-recovery | Deployment / DB operations; Restricted point-in-time copies of approved data | CREATED_AT -> Bound rotation; authoritative suppression replay before traffic |

Storage for domain records is PostgreSQL; Media/private exports use R2; caches/queues use Valkey; provider/telemetry/backup locations are VERIFY PRODUCTION CONFIGURATION. Every class records actual external copies. A hold applies only to specifically eligible evidence, not the entire inventory automatically.

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

CHAT_ATTACHMENT is a PRIVATE Media purpose bound to typed conversation_id, pending_message/send intent, eventual immutable message_id and sender ordinary_account_id. Chat verifies current participant/exact Seller-team permission on upload, completion, bind and every new read. Upload grants/object keys stay private; READY is technical only. One upload-completion/send identity attaches once; cross-conversation rebinding and public PRODUCT_GALLERY delivery are forbidden. Reuse bounded approved image processing/limits; abandoned grants expire under approved policy. No new numeric limits or native video.

Ordinary logical Notifications retain exactly one ordinary/Operator Account recipient. A no-Account delegate instead uses a narrow HANDOFF-owned external invitation transport intent on the existing SMS adapter. Bind authorization_id, generation, contact-purpose reference, expiry/revocation/suppression and durable dedupe/effect key; recheck current recipient generation immediately before dispatch. Message is minimal install/open/receipt context, no detailed Order or reusable secret. No dummy Account, phone-as-Buyer authority or extra Claim/refund/Review rights. Transport timeout may be ambiguous; reading/exactly-once global SMS delivery is never guaranteed.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 11. Purpose Limitation

Approved purposes are explicit and versioned. Phone supports authentication/recovery; social control supports Seller admission; provider records support payment/reconciliation/accounting; delegated contact supports receipt/communication for one Order; active-delivery GPS supports fulfilment; Review eligibility proves qualifying purchased lines; selected promoted messages support an exact Claim/Moderation case; Audit proves privileged accountability. FYP/Analytics cannot copy raw Chat, exact GPS or private evidence.

New purpose or recipient requires privacy review and, where material, ADU-DPIA-01 reassessment. Retained transaction facts do not authorize marketing or profiling. Withdrawal/relationship termination and ordinary Account deletion are distinct commands with domain-specific consequences.

## 12. Data Minimization

Before adding any field/domain copy, teams must ask:

• Is the field necessary for the stated purpose?

• Can a stable reference replace the copied value?

• Can precision be reduced (e.g. area instead of exact location)?

• Can retention be shorter?

• Can data be aggregated/anonymised?

• Does another domain already own the sensitive value?

Architecture fitness tests reject known forbidden copies such as raw restricted financial/case evidence in events/logs or Chat body in Analytics.

Broad Pino/Sentry telemetry contains no OTP/digest, session/refresh token, raw QR, signing key, provider credential/signature/raw financial body, KYC document, Chat body, Claim evidence, delegate name/phone, push token or precise GPS/address. URL queries/fragments and dynamic private paths are removed before transport. Restricted evidence/audit repositories remain purpose-scoped and separately governed.

## 13. Canonical vs Derived Data

Lifecycle categories:

• Canonical: domain source data; domain handler decides delete/anonymise/retain.

• Derived projection/index: Search, FYP feature, seller analytics; delete/rebuild from surviving canonical data.

• Cache/CDN: never a retention authority; invalidate/purge promptly.

• Backup: offline recovery copy; not ordinary access, but restore must honor historical deletions.

• Audit/evidence: separately justified immutable/minimized facts.

Deletion completeness requires handling all applicable categories.

## 14. Lifecycle Actions

Canonical actions:

• HARD_DELETE

• ANONYMISE

• PSEUDONYMISE

• CRYPTO_ERASE

• UNLINK_IDENTITY

• REVOKE_ACCESS

• UNPUBLISH_PUBLIC

• PURGE_DERIVED

• RETAIN_UNDER_HOLD

• TOMBSTONE_MINIMAL

Each domain contract declares allowed actions by data class/request type.

## 15. Hard Deletion

Physical deletion is used when purpose/retention ended, no hold applies and referential/business integrity permits removal. Destructive workers operate in bounded batches and recheck

eligibility immediately before DELETE/object removal.

Cascade delete is never the sole lifecycle plan because it cannot understand Claims, backups,

processors or anonymisation.

## 16. Anonymisation

Anonymised data must no longer be reasonably reconnectable to an individual using retained

Adulis means. Setting account_id = NULL while retaining phone, device ID, precise route and unique message content is not true anonymisation.

Common use: public Review/aggregate marketplace history may survive with no Account/profile link if policy/legal basis supports it.

## 17. Pseudonymisation

Pseudonymised data remains personal/privacy-sensitive because a controlled key/mapping can

relink it. Use it when internal continuity is required without exposing direct identity. Mapping access/retention is stricter than ordinary data.

## 18. Cryptographic Deletion

Crypto-erasure is an available action only where approved key granularity and backup/key-copy controls make erasure demonstrable. Destroy all relevant key copies and remove eligible object metadata/bytes; shared encryption keys cannot safely erase one subject. Do not add a new key service or per-subject infrastructure by implication. Restricted Claim/provider evidence may use approved encrypted-object controls; no normal payment screenshot object class exists.

## 19. Soft Delete / Tombstones

Soft delete is a workflow/publication state, not final privacy deletion when full data remains indefinitely accessible.

Minimal tombstones may preserve:

• uniqueness/cooling anti-abuse hash;

• historical foreign-key placeholder;

• deleted-account non-login suppression;

• public slug redirect/Gone semantics;

• backup restore suppression.

Tombstones never contain the original full profile/content "just in case."

## 20. Retention Policy Model

```
privacy.retention_policy
  policy_id
  policy_version
  market_id nullable
  data_class
  trigger_type
  base_duration / rule expression
  action_on_expiry
  hold_eligible
  legal_basis_ref / policy_ref
  effective_from / effective_to
  status
```

Durations remain configuration. Production values require legal/business approval and are read through Market Configuration where Market-specific.

Required additional fields: purpose_ids, authority/source_ref, legal_confirmation_status, policy_approver_ref, review_at and configuration_evidence_ref. A missing production duration/authority is a launch/configuration blocker, never a fallback to indefinite retention. Numeric engineering retry/batch budgets are not statutory retention rules.

## 21. Retention Versioning

Every destructive decision snapshots the policy version that made the data eligible. Policy

changes are not silently retroactive unless explicitly authorized. A new longer legal requirement may extend future/eligible data; retroactive application requires a migration/legal decision.

## 22. Retention Triggers

Triggers can be:

• CREATED_AT

• LAST_ACTIVITY

• ACCOUNT_DELETION_COMPLETED

• ORDER_COMPLETED

• CLAIM_RESOLVED

• HOLD_RELEASED

• SELLER_CLOSED

• SESSION_REVOKED

• OBJECT_RETIRED

The trigger is stored/derivable explicitly. Code never scatters magic + 90 days constants across domains.

| Current additional trigger | Purpose |
| --- | --- |
| PAYMENT_RECONCILED | Minimal payment/provider/accounting records after resolved provider state. |
| REFUND_COMPLETED | Confirmed remedy records; not request submission. |
| SCENE_ARCHIVED | Content retirement trigger; visibility PRIVATE is not deletion. |
| OPERATOR_ACCOUNT_TERMINATED | Revoke privileged access; assess audit provenance independently. |

## 23. Holds

A hold protects narrowly identified evidence from ordinary destructive action. Hold creation and purge serialize through a domain-owned eligibility fence; inspecting holds before a later unlocked DELETE is insufficient.

```
privacy.hold
  id, type, scope_type, scope_ref, reason_code, authority_ref
  created_actor_type: OPERATOR_ACCOUNT | SYSTEM
  created_by_operator_account_id?, system_operation_ref?
  created_at, review_at, expires_at?, policy_version
  released_actor_type?, released_by_operator_account_id?
  release_system_operation_ref?, released_at, release_reason
  CHECK: exactly one typed actor reference appropriate to actor_type
```

OPERATOR_ACCOUNT creates/releases approved legal/security exceptions with current capability, Step-Up, reason and Audit. SYSTEM creates/releases only domain-authorized Claim/moderation holds through declared contracts, never impersonating a reviewer. No indefinite hold without recurring review, authority and visible escalation.

## 24. Claim Holds

Claims protects only needed normalized Finance/provider facts, exact Product/Scene revisions, selected promoted Chat messages, accepted Handoff evidence and referenced private Media. A PRIVATE Scene remains retained under that scope without republishing. Claim resolution starts approved post-resolution retention; hold release is governed separately.

The source domain atomically reserves immutable evidence or a retention fence before exposure to destructive workers. Concurrent Claim opening and purge must lock/revalidate a common eligibility record or use an equivalent proven protocol. If required evidence was already lawfully purged, return an explicit unavailable result; never fabricate or recover prohibited data through an uncontrolled backup lookup.

## 25. Legal/Security Holds

Only privileged roles/processes may create legal/security incident holds. Requirements:

• documented authority/reason;

• narrow scope;

• review/expiry workflow;

• immutable audit;

• no ordinary user/operator ability to create indefinite invisible holds.

Exact legal authority/process is LEGAL REVIEW REQUIRED.

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

## 26. Hold Release

Release is an explicit auditable action/event. After release, data does not disappear

synchronously by magic; purge eligibility is recomputed under current retention policy and destructive tasks are scheduled idempotently.

## 27. Deletion Orchestrator

The Privacy/Data Lifecycle module owns coordination state only:

1. accept lifecycle request;

2. step-up/confirm requester when required;

3. resolve subject and requested scope;

4. snapshot policy/Market/legal configuration;

5. query domains for blockers and applicable holds through typed contracts;

6. create one idempotent domain task per required action;

7. emit/queue work through transactional outbox + BullMQ;

8. track task result/retry/blocker;

9. reconcile derived caches/processors/backups;

10. mark request complete only when every mandatory task satisfies completion criteria.

It must never bypass domain repositories with a central DELETE FROM * WHERE account_id=?

strategy.

The owning PostgreSQL transaction commits state plus event_outbox and/or job_intent. The shared relay leases intent, records versioned event_delivery consumer work and enqueues deterministic BullMQ jobs on Valkey after commit. BullMQ is the sole ordinary execution engine. Delivery is at-least-once; workers re-read current owner state and suppression/hold policy and use database uniqueness/processed-effect markers. Reconciliation and bounded dead-letter recovery prevent correctness-sensitive PostgreSQL-to-Valkey dual writes.

A domain task carries immutable subject type/ref, Market, action, policy snapshot, scope and idempotency identity. The handler re-reads current hold/suppression state immediately before commit and verifies physical/derived effects; Privacy receives proof references and status, not private raw repositories.

## 28. Domain Lifecycle Contract

Each domain implements a common application-layer contract conceptually like:

```
interface DomainLifecycleHandler {
  inspectSubject(scope: SubjectScope): Promise<LifecycleInventory>;
  findBlockers(scope: SubjectScope): Promise<Blocker[]>;
  execute(task: LifecycleTask): Promise<LifecycleTaskResult>;
  verify(task: LifecycleTask): Promise<VerificationResult>;
}
```

A domain declares:

• personal data it owns;

• supported request types/actions;

• retention policy IDs;

• hold interaction;

• derived/external copies it is responsible for;

• proof of completion.

dependency-cruiser enforces that Privacy invokes public lifecycle interfaces, not private repositories.

inspectSubject() returns all applicable ordinary relationships, data classes and external copies. execute()/verify() return COMPLETE, BLOCKED, RETRYABLE or FAILED with safe structured reasons and verification references. A tombstoned subject prevents a queued rebuild from recreating personal data. Lifecycle adapters are versioned public application interfaces enforced by dependency-cruiser.

## 29. Lifecycle Request State Machine

![Verified lifecycle completion, not a queue acknowledgement](graphics/PRV_01.svg)
*Figure 01. Verified lifecycle completion, not a queue acknowledgement. Owner-owned actions remain coordinated centrally; a retained exception is visible and reviewed.*

| State / transition | Required meaning |
| --- | --- |
| REQUESTED -> CONFIRMATION_REQUIRED -> ASSESSING | Authenticated subject confirmation and immutable scope. |
| ASSESSING -> WAITING_BLOCKER / WAITING_HOLD | Specific live legal/business blocker; safe visible reason and review schedule. |
| ASSESSING -> COOLING_OFF -> PROCESSING | Only if approved policy defines a reversible cooling period. |
| PROCESSING -> PARTIALLY_COMPLETE / RETRYING | Mandatory task failed or pending; completed work is not repeated destructively. |
| PROCESSING -> VERIFYING -> COMPLETED | All required owner, object, processor and restore-suppression proofs verified. |
| CANCELLED / REJECTED_RETAINED | Cancellation only while reversible; retained refusal requires authorized reason and review path. |

Completion means approved lifecycle obligations are satisfied, including documented restricted retention and backup-suppression controls. It does not mean every immutable transaction row was physically erased. Explain retained categories safely; an undisclosed failed mandatory purge cannot be reclassified as an exception.

## 30. Account Deletion

Account deletion is destructive and requires fresh authentication/OTP/step-up appropriate to the Account risk level. Immediate or early actions after confirmed request may include:

• prevent new commerce/account-sensitive changes;

• revoke new session issuance and active sessions at the chosen point;

• remove push tokens/marketing permissions;

• mark Account lifecycle as deletion-pending;

• block Account resurrection through ordinary login/recovery.

Open Orders/Claims/security/legal obligations can pause irreversible steps. Once blockers clear,

workflow resumes automatically.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one current non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Multiple roles union permissions within that membership; ownership and Courier relationships do not consume the TEAM limit. Different humans use different Accounts.

Evaluate every Seller ownership/TEAM and Courier assignment alongside Buyer Orders, Claims, Reviews, Grant, Chat, Collections, sessions/devices, Notifications, Handoff/delegates and personalization. Pending deletion may block new risky activity but must provide a controlled authenticated rights/status route and a safe path to resolve existing obligations. Do not strand open Orders by blindly revoking all access before the blocker-resolution policy is applied.

## 31. Buyer Deletion

Buyer-capability data is one subset of ordinary Account lifecycle. An export or Buyer-data request must not assume the person has no Seller/Courier relationship. Full ordinary deletion fans out to every relationship; an approved role-specific exit leaves the same Account available for remaining capabilities.

• Delete private Collections, Search history and person-level FYP/Analytics linkage; suppress delayed server replay.

• Revoke sessions/devices/push tokens at the approved point; old credentials never authenticate final deleted identity.

• Unused Review Grants become unusable; public Review content/author presentation follows approved separate policy.

• Completed Seller Orders/payment snapshots retain only justified transaction facts with minimized Buyer identity/address.

• Held Handoff/Claim evidence and direct delegate identity receive separate purpose/retention decisions.

## 32. Seller Closure

Seller closure is distinct from owner Account deletion. Closure workflow:

• stop new publication/commerce;

• unpublish Products and Scenes from public surfaces;

• remove Storefront/FYP/Search projections;

• preserve active Orders/Claims/financial/billing obligations;

• revoke Seller team access according to role/ownership rules;

• retain transaction/Trust/Review history as justified;

• schedule Seller-only draft/content/media purge after blockers/retention;

• preserve owner Account as Buyer if they choose and policy permits.

A Seller organization may be closed while one or more Accounts remain active in other roles.

Seller closure retains the ordinary owner Account where other capabilities remain. Active settlement/refund, billing, Orders and scoped Claims are handled through their owners. Social-control tokens and obsolete challenges expire; Finance/provider readiness references follow their separate lifecycle. OWNER-only Console/fresh Step-Up controls apply where the canonical authorization contract requires them.

## 33. Seller Team Lifecycle

Removing a team member revokes the relationship and future Seller authorization. It does not delete:

• Orders they handled;

• Seller Chat messages they authored as representative;

• audit/approval records;

• Scene/Product creation provenance where historically relevant.

Historical actor records should use immutable Account refs or pseudonymous actor refs under

deletion policy, not active membership dependence.

At most one non-terminal TEAM membership per ordinary Account is enforced by Authorization. Revocation removes current access across app/Console and invalidates stale permission/cache projections, while typed minimal historical actor provenance is assessed separately. Courier relationship termination similarly ends assignments/access without deleting Buyer identity; active delivery obligations require an explicit safe reassignment/closure path.

## 34. Orders

Orders are Seller-specific canonical transaction facts. Cart and Checkout Session are intent; optional CheckoutAllocation protects stock briefly during a bounded provider attempt and is neither a Buyer reservation nor payment proof.

Finance/Payments alone establishes canonical payment, refund and settlement facts from authenticated provider callbacks and/or backend verification matched to the exact attempt/reference, Seller Order, amount and currency. Client return navigation, Seller statements and screenshots never establish PAID. Checkout snapshots merchandise, delivery, the zero launch Adulis Buyer surcharge (0 bps), exact currency rounding, Buyer total and Commercial Policy version before explicit confirmation. Payment, provider settlement and physical receipt are independent.

Retain necessary purchased Product/option/price, delivery and surcharge/refund snapshots under approved transaction policy; minimize live profile, address and counterparty exposure. Allocation conversion/expiry/release triggers short operational cleanup unless a narrow security, reconciliation or Claim scope applies. Under locks, expiry uses ORDER §35/46 release proof, including fenced uninitiated dispatch or authoritative initiated-attempt finality. Pending/possibly charged stock stays protected, with explicit reconciliation/escalation; an unavailable provider has no promised final resolution. Operational cleanup cannot erase charge, release-decision or narrowly required reconciliation evidence.

## 35. Reviews

Review Grant/eligibility evidence has one Buyer/Seller-Order identity across receipt or verified failure. Unused grants become unusable on Account deletion; public text/author presentation and restricted receipt/Claim eligibility have separate approved retention. Keep minimal correction lineage and safe remedy status; never expose private case payload.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

## 36. Collections

Collections are private preference data. On final Buyer deletion, delete Collection rows, items, ordering and private names. Product/Scene canonical data is unaffected. Any analytics

aggregate that no longer identifies the Buyer may survive if truly anonymised and policy permits.

Membership types are PRODUCT_POST and SCENE_POST. A private or removed Scene resolves as unavailable on public Buyer surfaces; retained private membership/evidence never bypasses Content serving gates.

## 37. Search/FYP Personalization

Personal search history, preference profiles, FYP affinity features and negative-feedback profiles are derived behavioral data. Account deletion triggers:

• delete/rekey personal profile rows;

• unlink anonymous/account identity as policy requires;

• invalidate Valkey caches;

• purge Search/Recommendation subject projections;

• prevent delayed events/jobs from recreating deleted subject state.

Population-level anonymised aggregates remain only if they are not reasonably re-identifiable.

FYP units are photo Scene Posts. Account deletion purges person-level affinity, feedback and linkage; Content visibility transitions remove public resolution across FYP, Search, Storefront and Collections without deleting the Seller-owned Scene. New current impressions cease; legitimately retained historical attribution remains purpose-scoped and is not republished.

## 38. Chat

Chat has two lifecycle classes:

1. ordinary conversation data under Chat retention/deletion policy;

2. evidence-promoted content referenced by open/retained Claim/Moderation case.

Deletion request must not delete evidence-bearing messages while a valid hold exists. Evidence promotion records exact message IDs/version/content hash/snapshot according to Claims

design; ordinary Chat can age out independently later.

Counterparty privacy matters: a user's export/deletion cannot reveal or destroy another party's

private data beyond the approved conversation lifecycle semantics.

Current immutable Message subject is NONE, PRODUCT_POST, SCENE_POST or ORDER. Product selection remains primary commerce intent; exact Scene revision provenance survives later public visibility changes. Selected evidence copies use source/Claim hold references; no general conversation-wide indefinite hold or training reuse is implied.

Selected Claim/Moderation/legal/security attachment evidence uses existing exact hold/purge fences; ordinary message removal cannot erase held bytes. After release apply approved lifecycle and orphan reconciliation. Purpose-scoped bounded signed access never promises recall of previously downloaded bytes or already issued access grants. Public descriptors, notifications, Analytics/logs and unrelated exports exclude private attachment bytes and URLs.

## 39. Chatbot Data

Chatbot operational metadata (intent ID/template version/readiness metrics) can follow

Analytics/Chatbot retention. Free-form unmatched phrases may contain sensitive information and receive a shorter restricted retention class or are not retained at all by default.

The deterministic chatbot's template definitions are business configuration, not user personal data, but message/session linkage may be personal.

Classification is intent/template-version/session metadata with exact Product/Scene/Order anchors. Any unmatched phrase retention is restricted, bounded and explicitly justified. AI Seller business advice is not MVP/Phase-1; broader model training requires a new purpose and DPIA review.

## 40. Payments, Provider Records & Restricted Financial Evidence

Finance/Payments alone establishes canonical payment, refund and settlement facts from authenticated provider callbacks and/or backend verification matched to the exact attempt/reference, Seller Order, amount and currency. Client return navigation, Seller statements and screenshots never establish PAID. Checkout snapshots merchandise, delivery, the zero launch Adulis Buyer surcharge (0 bps), exact currency rounding, Buyer total and Commercial Policy version before explicit confirmation. Payment, provider settlement and physical receipt are independent.

Adulis Seller admission collects no Government ID, passport, driving-licence image, selfie-to-ID artifact or Government-ID hash. Social-account-control evidence supports admission. Provider KYC/KYB is a separate Finance/provider compliance purpose; prefer provider-hosted collection and retain minimum safe readiness status/reference. Any unavoidable Adulis receipt requires confirmed necessity and restricted Finance controls, not an Onboarding identity class.

| Financial class | Privacy / lifecycle contract |
| --- | --- |
| Normalized payment/refund/settlement | Finance owner, exact monetary snapshot, bounded reference and approved accounting retention. |
| Provider event raw material | Verify integrity; normalize; retain restricted raw minimum only for confirmed reconciliation/security purpose. |
| Seller provider account | Safe reference/status or bank-detail token; avoid duplicated bank information. |
| Voluntary financial Claim attachment | Case-specific private evidence with narrow scope, audit, hold and verified object cleanup; never a normal payment flow. |
| User export | Entitled normalized payment/surcharge/refund facts only; no credentials, signatures, KYC, settlement secrets or internal fraud findings. |

Provider deletion/rectification/export mechanism and independent legal retention are documented per contract. A processor cannot be assumed to erase statutory records on request; record the lawful retained categories and minimize Adulis linkage instead of falsely claiming complete deletion.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

## 41. Identity, Social Control & Separate Provider KYC

Adulis Seller admission collects no Government ID, passport, driving-licence image, selfie-to-ID artifact or Government-ID hash. Social-account-control evidence supports admission. Provider KYC/KYB is a separate Finance/provider compliance purpose; prefer provider-hosted collection and retain minimum safe readiness status/reference. Any unavoidable Adulis receipt requires confirmed necessity and restricted Finance controls, not an Onboarding identity class.

Current identity classes are ordinary phone/profile/Auth security data, Seller social-control identifiers/results, narrowly authorized delegated-recipient contact and separate Operator Account identity. TikTok/Instagram Login Kit adapters use minimum scopes, nonce/state/PKCE/CSRF/replay validation; social provider login is not a separate Adulis ordinary identity.

DM fallback stores claimed account, challenge reference, sender/code-match result, timestamp, policy and reviewed_by_operator_account_id. Keep no plaintext fallback code, social password, unrelated private inbox history or unnecessary provider token copy. Established business presence and social-account control are separate evidence dimensions; human evidence review cannot directly set eligibility.

## 42. Media

Media deletion follows reference/hold semantics:

• remove public binding immediately when Product/Scene/User content is deleted or

moderated;

• identify whether sanitized master/derivatives are referenced by active

Product/Scene/Order/Claim/Moderation evidence;

• delete unreferenced bytes after retention/holds;

• purge derivatives and CDN cache;

• reconcile object storage failures until metadata truth matches physical state.

Shared/reused Media must not be physically deleted just because one referencing object

disappears.

Content owns Scene Post publication DRAFT/PUBLISHED/ARCHIVED separately from visibility PUBLIC/PRIVATE. A public Scene requires same-Seller eligible Product Post tags with at least one available Product, valid photo media/caption and current Seller, Market and safety gates. Loss of the last available tagged Product changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Eligible restock can restore PUBLIC after every current gate passes; it does not clear independent archive/moderation restrictions or require manual republishing solely for restock.

PUBLIC -> PRIVATE for availability is a reversible commerce/discovery transition, not privacy erasure, Seller archive or moderation removal. Preserve legitimate Seller-side Scene/media and exact held revision; remove public bindings/projections while independently adjudicating media reference/hold cleanup. Seller-facing Private badge/notice is a Content/Notifications consequence. A truly privacy-deleted object must not return via restock or delayed projection rebuild.

## 43. Claims

Claims own Claim lifecycle/evidence scope. Opening a Claim atomically/near-atomically creates

required retention holds for referenced evidence. Claim resolution releases/changes holds according to post-resolution retention policy rather than immediate purge.

Account deletion does not erase Claim outcome or adjudication history necessarily; it removes/minimizes personal identity where the Claim record can legally/operationally survive.

Each Claim is one Seller Order with optional same-Order Line; retained Scene/Chat is contextual evidence, never an independent purchase scope. Human adjudication and append-only correction record separate Operator identity. An allegation is not a finding; privacy export cannot disclose unrestricted counterparty statements or reviewer notes.

## 44. Moderation

Moderation evidence and decisions can outlive public content. A policy removal means public

distribution stops, while exact reported revision/evidence remains restricted for appeal, enforcement history and audit under defined retention.

Reporter identity is particularly sensitive and should not be exposed to reported Sellers/users or general analytics.

## 45. Trust

Trust history is evidence-derived marketplace reliability state. Account/Seller deletion cannot simply remove adverse/positive facts in a way that corrupts historical commerce or permits

account-reset abuse. Privacy minimization may detach direct public identity while retaining minimum evidence references/pseudonymous historical facts under approved policy.

Trust is never a justification to keep every behavioral event forever.

Current Trust states are NEW, REBUILDING, ESTABLISHED and TRUSTED. Claims correction causes owner recomputation; retained QR method evidence is distinct from generic completion. Exact rule/evidence version and correction/appeal paths are bounded, not a reason to retain every interaction forever.

## 46. Notifications

Push tokens are device identifiers and are deleted/revoked when session/device/Account

lifecycle ends. Notification message/history retention is bounded; mandatory security/audit notifications may have a different class than marketing/product engagement notifications.

Stopping marketing communication after withdrawal/deletion does not require deleting immutable proof that the withdrawal request was executed.

## 47. Sessions / Devices / OTP

• Active Sessions are revoked promptly during confirmed deletion/compromise.

• OTP challenges are short-lived security artifacts and purged automatically after expiry/limited

audit need.

• Device records/push tokens are deleted or minimized when no longer needed.

• Security recovery history may retain minimal hashed/pseudonymous references under

security retention, not full tokens.

• Deleted Account sessions can never authenticate after deletion completes.

## 48. Phone Reuse

Phone number is central to Auth and may require a cooling/anti-abuse period before reassignment. Architecture stores the minimum needed after deletion, preferably a keyed hash

plus cooling expiry/reason, not the plaintext number if product/auth requirements allow.

Exact cooling duration is OPEN/policy. Deletion cannot be used to instantly reset abuse/recovery restrictions.

## 49. Analytics

Mobile Analytics uses bounded connected in-memory batching only. Low-priority observations may be dropped after bounded failure; no persistent cross-session SQLite replay, fingerprinting or later reconnect upload queue exists. Delayed canonical SERVER events may replay through Eventing and must honor deletion tombstones, purpose and linkage suppression.

• Delete/unlink ordinary Account raw events and identity mappings under approved policy; pseudonymous linkage remains personal.

• Purge person-level Search/FYP features, queued exports and dashboard linkage.

• Protect exact historical transaction attribution only where justified, minimizing identity.

• Truly anonymous aggregates may survive only after re-identification/small-cohort analysis.

• Review Grant, paid/refund, accepted Handoff, Trust and Claim events are owner facts; client telemetry never creates them.

## 50. Outbox / Jobs

Outbox/job payloads are operational transport data and should contain references/minimal facts.

They get bounded retention after processing. Dead letters cannot become permanent sensitive-data archives.

If deletion-related work is in-flight, payload references remain until workflow completes, then

age out. A stale job arriving after subject deletion must no-op/reconcile rather than recreate data.

The owning PostgreSQL transaction commits state plus event_outbox and/or job_intent. The shared relay leases intent, records versioned event_delivery consumer work and enqueues deterministic BullMQ jobs on Valkey after commit. BullMQ is the sole ordinary execution engine. Delivery is at-least-once; workers re-read current owner state and suppression/hold policy and use database uniqueness/processed-effect markers. Reconciliation and bounded dead-letter recovery prevent correctness-sensitive PostgreSQL-to-Valkey dual writes.

## 51. Logs

Broad Pino/Sentry telemetry contains no OTP/digest, session/refresh token, raw QR, signing key, provider credential/signature/raw financial body, KYC document, Chat body, Claim evidence, delegate name/phone, push token or precise GPS/address. URL queries/fragments and dynamic private paths are removed before transport. Restricted evidence/audit repositories remain purpose-scoped and separately governed.

CSP observations may contain page/blocked/source URLs, original policy, browser data and samples before ingestion. Drop original-policy/nonces, samples, query/fragment, direct identifiers and exact private route segments before storage/forwarding. Keep surface/policy version, directive, bounded origin category, browser family, deployment and safe occurrence metadata only. ADU-CSP-01 defines ingestion; Privacy sets the approved retention class.

## 52. Backups

Backups are not ordinary access surfaces and are not expected to support one-row deletion

in-place. Canonical strategy:

1. keep backup retention bounded and documented;

2. maintain a minimal deletion/suppression ledger outside/restorable with production state;

3. after any restore, before serving traffic, replay all lifecycle completions/suppressions newer

than the restore point;

4. run reconciliation to purge restored derived/object state;

5. verify deleted Accounts cannot authenticate or reappear.

Backup restoration that resurrects deleted data into live service without reapplication is a launch-blocking defect.

## 53. CDN / Search / Caches

Cache/index copies are not retention authorities. Lifecycle domain task completion requires:

• invalidate/purge Valkey subject/entity cache keys;

• remove Search documents/subject history projections;

• remove FYP/recommendation personal features;

• purge Cloudflare CDN public objects/routes where content is removed;

• tolerate transient purge failures only while retry state remains visible/incomplete.

A stale CDN may not keep privacy-deleted private/public content intentionally accessible indefinitely.

## 54. Third-Party Processors

No production processor is deemed active solely because it appears in the architecture. Activation requires configuration/contract evidence and a reviewed inventory record; unverified regions are VERIFY PRODUCTION CONFIGURATION.

| Candidate service category | Necessary processing / activation evidence |
| --- | --- |
| Render / managed PostgreSQL | Application/DB hosting; actual region, backup region, access, DPA and subprocessor evidence. |
| Cloudflare R2 / CDN | Media/private export bytes and delivery; bucket/jurisdiction/cache configuration and lifecycle controls. |
| Sentry | Scrubbed error/performance/release data; DSN/region/retention and project access. |
| SMS / push | Phone and short-message/device delivery; actual Ethiopia routing and push transport, suppression and incident contact. |
| PSP / provider KYC | Payment/provider readiness; contract role, hosted KYC boundary, exact geography and deletion/export exemptions. |
| TikTok / Meta | Social account control and optional Product embed; minimum scopes, browser disclosure and selected active adapter. |

Every active record contains service/purpose/data, controller/processor relationship, source/destination country/region, transfer status and reviewed legal mechanism, contract/DPA, subprocessors, retention/deletion/export mechanism, security controls, breach contact, exit plan, review date and evidence. New Market/provider/region change requires legal/privacy and DPIA reassessment; CSP permission alone is not approval.

## 55. Data Export / Access

Export is a domain-safe projection workflow, never a raw database dump. Snapshot the entitled subject scope and current access; fresh authentication/idempotency is required and download authorization is rechecked.

| Export group | Entitled contents / exclusions |
| --- | --- |
| Ordinary Account / relationships | Profile/privacy preferences, ownership/TEAM/Courier relationship and limited safe session/device history. |
| Commerce | Buyer and authorized Seller-visible Orders, purchased snapshots and normalized payment/zero launch surcharge/refund facts with counterparty minimization. |
| Personal content | Private Collections, authored Reviews and entitled Chat; held evidence and other-party private data remain restricted. |
| Personalization | Required available high-level preference/attribution categories; no raw fraud/Operator notes or provider secrets. |

Generate bounded streaming private R2 objects, no PII names, short-lived signed access, no-store and configured expiry. A ZIP capability may be approved but zod, archiver or any additional runtime dependency is not mandated. Do not email full exports; expiry verifies object cleanup.

## 56. Operator Workflows

Operator Console supports privileged, typed privacy actions:

• inspect lifecycle request/task status;

• inspect blockers/holds with reason and authority;

• create/release approved legal/security holds with step-up and audit;

• retry failed domain task;

• regenerate a failed export;

• mark processor action complete based on verified response;

• escalate to legal/security review.

Operators cannot run arbitrary SQL, bulk-delete by hand or impersonate the user. Every decision records actor, reason, prior/new state and timestamp.

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

Every high-risk hold/exception/recovery action stores purpose, prior/new version, evidence/approval and required Audit in the authoritative transaction. Processor completion requires verified response/retention exception evidence; an Operator cannot mark a mandatory failed delete as complete merely to clear a dashboard.

## 57. API Contract

```
Ordinary authenticated routes:
POST /v1/privacy/deletion-requests
GET  /v1/privacy/deletion-requests/{requestId}
POST /v1/privacy/deletion-requests/{requestId}/confirm
POST /v1/privacy/deletion-requests/{requestId}/cancel
POST /v1/privacy/data-exports
GET  /v1/privacy/data-exports/{exportId}
GET/PATCH /v1/privacy/preferences
Separate privileged routes:
GET  /v1/ops/privacy/lifecycle-requests/{requestId}
POST /v1/ops/privacy/holds
POST /v1/ops/privacy/holds/{holdId}/release
POST /v1/ops/privacy/tasks/{taskId}/retry
POST /v1/ops/privacy/processor-actions/{id}/verify
```

Contracts are proposed current API shapes for ADU-API writeback. Ordinary requester is server-authenticated, never a supplied actor ID. OPERATOR audience/capability, fresh Step-Up and audit protect privileged routes; cancellation only precedes irreversible work. Mutating requests use idempotency key, scope version/optimistic concurrency, stable errors and @nestjs/swagger OpenAPI/generated TS clients. No arbitrary SQL/delete endpoint.

## 58. Database Model

```
privacy.lifecycle_request
 id, subject_type ORDINARY_ACCOUNT|SELLER|COURIER_RELATIONSHIP|OPERATOR_ACCOUNT
 ordinary_account_id?, seller_id?, courier_relationship_id?, operator_account_id?
 request_type, market_id, state, scope_version, policy_snapshot
 requested_actor_type, requested_by_ordinary_account_id?
 requested_by_operator_account_id?, system_operation_ref?
 requested_at, confirmed_at, cooling_until?, completed_at?, safe_failure_code
privacy.lifecycle_task
 id, request_id, domain_name, action, data_class, scope_ref
 state, attempts, blocker_code?, error_code?, policy_version
 idempotency_key UNIQUE, verification_ref?, lease_version, completed_at?
privacy.retention_policy
 id, version, market_id?, data_class, purposes, trigger, rule_config
 action, hold_eligible, authority_ref, approval_ref, effective_from/to, status
privacy.deletion_tombstone
 subject_type, minimal_subject_ref_or_keyed_hash, completed_at
 suppression_scope, suppression_until?, reason_code, policy_version
privacy.processor_action
 id, request_id, processor_id/version, action, state
 minimal_external_ref?, verification_ref?, retention_exception_ref?, completed_at?
privacy.data_export
 id, request_id, ordinary_account_id?, operator_account_id?
 scope_snapshot, state, private_object_ref?, expires_at?, generated_at?
privacy.incident
 id, controller_awareness_at, authority_due_at, subject_notice_due_at
 legal_assessment_state, notification_decision_ref?, restricted_timeline_ref
privacy.hold: typed schema in Section 23
```

CHECK constraints enforce the exact allowed subject/actor field combination; ordinary and Operator FK namespaces never overload one subject_id. Retention policy versions are immutable; tasks hold policy snapshots. Index state/next_attempt, request/domain, active hold scope/review, tombstone key and processor state. Hold/purge locks share an owner-defined fence; scoped FKs/uniqueness prevent cross-tenant evidence and duplicate effects.

## 59. Events

| Versioned owner event | Minimal envelope / effect |
| --- | --- |
| privacy.lifecycle_requested / privacy.lifecycle_confirmed / privacy.lifecycle_blocked | request_id, typed subject ref, scope/Market, state and policy_version. |
| privacy.lifecycle_processing_started / privacy.domain_task_completed | Task/effect identity, domain/action, safe result and proof ref. |
| privacy.hold_created / privacy.hold_released | Exact held scope/type, reason/authority and typed actor refs; no evidence body. |
| privacy.lifecycle_completed / privacy.export_ready | Completion/expiry/proof references; no export URL/content. |
| privacy.incident_awareness_recorded / privacy.incident_assessment_updated | Restricted incident ref, awareness/deadline and safe escalation state. |

The owning PostgreSQL transaction commits state plus event_outbox and/or job_intent. The shared relay leases intent, records versioned event_delivery consumer work and enqueues deterministic BullMQ jobs on Valkey after commit. BullMQ is the sole ordinary execution engine. Delivery is at-least-once; workers re-read current owner state and suppression/hold policy and use database uniqueness/processed-effect markers. Reconciliation and bounded dead-letter recovery prevent correctness-sensitive PostgreSQL-to-Valkey dual writes.

Record controller_awareness_at without resetting it when escalation changes hands. Separate Authority and data-subject assessment/status; internal warnings at 24h and 48h are engineering escalation proposals, not statutory extensions. Legal/privacy authority records notification/exemption/consultation decisions and submission references; OBS surfaces elapsed time and escalation. Preserve a restricted immutable timeline and processor notice contact, never evidence bodies in broad telemetry.

Exact family members resolve to the supplied closed registry with event_version, typed subject/scope, protected opaque proof references and owner authorization. Account-wide lifecycle is GLOBAL; Market-owned subject scope is explicit MARKET. No export URL, private incident body or contact is emitted. Current legal/hold/retention gates remain G02.

## 60. Security

Controls:

• deletion/export request requires authenticated subject and fresh step-up appropriate to risk;

• Seller closure/account deletion uses Console-only controls where Auth design requires;

• lifecycle tasks cannot change subject/Market after creation;

• Operator hold/retry actions use privileged roles + audit;

• exports use private R2 objects and short-lived signed download URLs, Cache-Control: no-store;

• export object names contain no PII;

• export generation worker streams bounded data and never writes sensitive archives to local persistent disk unnecessarily;

• @nestjs/throttler limits destructive/export requests;

• @fastify/helmet and standard API security baseline apply;

• deletion tombstone/suppression data is minimal and separately access-controlled.

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

No raw secrets in export/archive/log transport; no additional runtime is implied by schema validation or streaming capabilities. Restrict signed object access by current subject/case authorization, expiry and safe disposition. Native browser resource controls and CSP report minimization follow ADU-CSP-01; DPIA risks/control evidence follow ADU-DPIA-01.

## 61. Privacy Threat Model

| Threat | Control |
| --- | --- |
| Attacker deletes victim Account | fresh auth/OTP/step-up, session risk controls |
| Seller admin deletes wrong Seller | Seller context/ownership + explicit Seller closure flow |
| Privacy service bypasses domain hold | domain-owned handler + hold check + DB permissions |
| Operator creates indefinite hold | restricted role, reason, review/expiry, alerts |
| Backup resurrects deleted user | suppression ledger replay before serving |
| Old mobile reconnect recreates profile | tombstone/suppression check at Auth/Analytics |
| Export leaks counterparty data | domain-safe export projection, security tests |
| R2 export URL leaks | private object + short TTL signed access + no logs |
| Dead letter keeps sensitive payload forever | minimal refs + bounded retention |
| Deletion race with new Claim | destructive task rechecks holds immediately before commit |
| Object delete fails after metadata removed | state remains DELETE PENDING; reconciliation _ |

| Additional current threat | Required prevention / residual handling |
| --- | --- |
| Scene PRIVATE mistaken for erasure | Separate Content visibility and Privacy action; tests retain Seller/held revision. |
| Delegate contact repurposed | One-Order purpose; no marketing/profiling; approved expiry and restricted read. |
| KYC copied into admission | Provider-hosted status/reference boundary; source/schema/UI fitness check. |
| Ordinary/Operator identity confusion | Typed separate FKs, guard/audience and actor combination checks. |
| Raw CSP report becomes shadow evidence | Schema allowlist, no samples/query/nonces, bounded retention and abuse protection. |
| Late server replay restores identity | Suppression check before effect/projection; restore ledger replay before traffic. |

## 62. Failure Behavior

| Failure | Required behavior |
| --- | --- |
| Domain lifecycle handler unavailable | request stays incomplete; task retries |
| One domain task fails | PARTIALLY COMPLETE; do not claim completion _ |
| Object storage delete fails | retain metadata/state DELETE PENDING; retry _ |
| CDN purge fails | canonical/private access removed; retry/alert for exposure risk |
| Search/FYP projection purge delayed | request incomplete where personal visibility persists; reconcile |
| Analytics unavailable | lifecycle task waits/retries; delayed events suppressed from resurrection |
| Processor deletion API fails | processor task remains open and visible |
| Claim opens during purge | hold/eligibility recheck prevents destructive commit or compensates safely |
| Worker runs twice | idempotent task key returns already-complete result |
| Backup restore | deletion ledger replay and verification before production traffic |

Provider action unavailable or pending legal retention remains explicit and unresolved until verified required obligations are fulfilled. PRIVATE Scene visibility alone is not a failed purge. Current provider-paid state fences allocation release; a cache/worker outage cannot turn financial truth into unpaid.

## 63. Partial Deletion Recovery

Each task is independently idempotent. The orchestrator periodically reconciles nonterminal requests and verifies successful tasks against domain verify() hooks. It never assumes that

job completed equals data gone.

Examples:

• Media task reports success only after object/meta/derivative/CDN requirements satisfy policy.

• Analytics task reports success after subject linkage/raw data actions and profile purge are

verified.

• Auth task reports success after sessions revoked and deleted Account cannot authenticate.

• Third-party processor task requires confirmed API/provider result or documented manual

completion.

## 64. Reconciliation

Recurring reconciliation jobs check:

• PROCESSING/PARTIALLY_COMPLETE requests older than thresholds;

• expired holds not released/reviewed;

• data past retention with no hold;

• DELETE_PENDING objects;

• Search/CDN cache remnants after canonical removal;

• deleted subjects present in Analytics/Recommendation identity maps;

• restored backup data that violates suppression ledger;

• processor actions overdue;

• export objects past expiry.

Reconciliation is bounded/batched and uses FOR UPDATE SKIP LOCKED or deterministic job keys to scale safely.

## 65. Observability

Use Pino, Sentry, pg_stat_statements and domain metrics. Privacy-specific metrics:

• lifecycle requests by type/state/Market;

• time in confirmation/cooling/blocker/processing/verification;

• domain task success/failure/retry;

• oldest incomplete request;

• active holds by type/age/review overdue;

• purge candidates vs purged rows/objects;

• object/CDN/Search deletion failure counts;

• processor deletion lag;

• export generation/download/expiry;

• backup-restore suppression replay count;

• attempted deleted-subject authentication/resurrection;

• deletion verification failures.

Sensitive subject IDs are never metric labels (cardinality/privacy risk).

## 66. Testing

Jest: state machines, policy resolver/version snapshots, hold precedence, blocker rules,

idempotency.

Testcontainers: real PostgreSQL locks/FKs/tombstones/hold race, BullMQ retries, R2-compatible

test adapter where possible.

Maestro: ordinary Account deletion request/confirmation/status, stale/offline app reconnect, session

revocation.

Playwright: Seller closure and Operator privacy/hold workflows.

Required end-to-end cases:

• ordinary Account deletion with Buyer-only relationships;

• completed Order retained with identity minimized;

• open Order/Claim blocker;

• Review anonymisation;

• Collections/Search/FYP deletion;

• Chat ordinary vs Claim evidence;

• restricted provider/Claim attachment purge race with Claim opening;

• object/CDN/Search deletion failure;

• Analytics outage;

• backup restore;

• Seller closure while owner remains Buyer;

• team-member removal;

• legal hold/expired hold;

• repeated lifecycle job;

• phone reuse/cooling;

• delayed outbox/dead-letter.

| Current regression | Expected result |
| --- | --- |
| PRV-CANON-01 / No admission ID class | Scan source/UI/schema/processor inventory; no Government-ID ingestion or hash class. |
| PRV-CANON-02 / Minimal social evidence | Control verification and DM fallback work without social passwords/plain code/unrelated messages. |
| PRV-CANON-03 / Hosted KYC | Safe provider readiness survives with no Adulis KYC document; provider lifecycle tracked. |
| PRV-CANON-04 / Provider records | Canonical payment/refund/settlement replace normal screenshot evidence. |
| PRV-CANON-05 / No payment upload | Ordinary payment surface/API has no screenshot collection. |
| PRV-CANON-06 / Paid owner | Seller/client/spoofed callback cannot establish paid. |
| PRV-CANON-07 / Allocation cleanup | Expire/convert/purge separate from historical Order; uncertain charge protection and ORDER §35/46 release evidence are preserved. |
| PRV-CANON-08 / Scene visibility | PUBLIC -> PRIVATE causes no physical privacy deletion. |
| PRV-CANON-09 / Private resolution | Seller sees retained Private Scene; public FYP/Search/Collections/Storefront deny. |
| PRV-CANON-10 / Exact Scene hold | Claim retains exact historical revision through visibility changes. |
| PRV-CANON-11 / Grant lifecycle | Final DELIVERY one Buyer Grant; deleted Buyer cannot consume unused Grant. |
| PRV-CANON-12 / Delegate minimization | Name/phone expires after approved purpose; minimal held receipt remains. |
| PRV-CANON-13 / Connected Analytics | No persisted local queue after deletion/restart; delayed server events suppressed. |
| PRV-CANON-14 / Whole ordinary identity | Deletion assesses Buyer/Seller/TEAM/Courier and active obligations. |
| PRV-CANON-15 / Relationship exit | Seller closure leaves ordinary Buyer Account; TEAM/Courier exit is separate. |
| PRV-CANON-16 / Operator termination | Access revoked; justified historical Audit provenance retained. |
| PRV-CANON-17 / Worker replay | Duplicate/stale BullMQ effect cannot resurrect deleted subject. |
| PRV-CANON-18 / Restore traffic fence | Suppression replay and critical verification precede production reads/writes. |
| PRV-CANON-19 / Provider lifecycle | Deletion/export response or justified restricted-retention proof recorded. |
| PRV-CANON-20 / CSP minimization | Queries/fragments/private paths/samples/original policy never reach stored report or Pino/Sentry. |

## 67. Load / Batch Testing

Use k6 and synthetic datasets for:

• burst of Account deletion/export requests;

• large Seller closure with thousands of Products/Scenes/Orders;

• retention sweep over millions of old rows;

• bounded batch deletes and vacuum/IO behavior;

• simultaneous Claim hold creation vs purge;

• R2 object deletion batches;

• Search/CDN invalidation fan-out;

• export generation size/streaming;

• backup suppression replay throughput.

No mass unbounded DELETE is allowed in production workers. Use bounded

keys/ranges/partitions and monitor DB lag/locks.

## 68. MVP Scope

MVP retains the existing request/task/policy/hold, domain lifecycle contracts, idempotent bounded orchestration, export, processor tracking, cache/index/object reconciliation and backup-suppression design. It covers every current inventory class, ordinary multi-relationship deletion, Seller/TEAM/Courier exit, separate Operator termination, provider/zero at launch accounting, two-basis Order Grant/delegate evidence, connected Analytics and CSP reports. Legal and implementation launch evidence is explicitly outstanding until approved; this architecture alone is not a compliance certificate.

## 69. Deferred Scope

• automated legal decision engine;

• multi-jurisdiction policy authoring UI;

• dedicated enterprise data catalogue/DLP platform;

• subject-access self-service for every derived internal dataset;

• per-subject encryption keys for all data;

• active-active multi-region deletion coordination;

• third-party consent-management platform;

• advanced privacy-preserving analytics/differential privacy unless needed later.

## 70. System Invariants

PRV-INV-001 Every retained personal-data class has a declared purpose.

PRV-INV-002 Every data class has a canonical owning domain.

PRV-INV-003 Privacy orchestrator never directly mutates unrelated private repositories.

PRV-INV-004 Domain executes its own lifecycle contract.

PRV-INV-005 Soft delete alone is not completed privacy deletion.

PRV-INV-006 Deletion request is idempotent.

PRV-INV-007 Destructive request requires appropriate fresh authentication/confirmation.

PRV-INV-008 Completion requires all mandatory domain tasks verified.

PRV-INV-009 Partial failure keeps lifecycle request incomplete.

PRV-INV-010 Open Order/Claim/legal blockers are explicit, justified and visible.

PRV-INV-011 Blocked request resumes automatically when blocker clears.

PRV-INV-012 Holds are scoped and auditable.

PRV-INV-013 Holds cannot silently become indefinite convenience retention.

PRV-INV-014 Purge rechecks holds immediately before destructive action.

PRV-INV-015 Claim evidence survives while required hold is active.

PRV-INV-016 Account deletion does not destroy canonical completed Order fact automatically.

PRV-INV-017 Deleted ordinary Account identity is minimized in retained Orders under approved policy.

PRV-INV-018 Seller closure is separate from owner Account deletion.

PRV-INV-019 Team-member removal does not erase historical actor provenance.

PRV-INV-020 Private Collections are deleted on full ordinary Account deletion unless a specific approved obligation applies.

PRV-INV-021 Recommendation/Search personal profiles are purged/unlinked.

PRV-INV-022 Ordinary Chat and evidence-promoted Chat have different retention semantics.

PRV-INV-023 Restricted financial Claim/provider evidence cleanup is hold-aware; ordinary payment creates no screenshot.

PRV-INV-024 Current Seller admission stores no Government-ID artifacts; provider KYC stays separately governed.

PRV-INV-025 Shared Media is not deleted while another valid reference/hold exists.

PRV-INV-026 CDN/cache/index copies are not retention authorities.

PRV-INV-027 Object delete failure cannot be reported as DELETED.

PRV-INV-028 Analytics delayed events cannot resurrect a deleted identity/profile.

PRV-INV-029 Push tokens/sessions cannot remain active after final Account deletion.

PRV-INV-030 Phone cooling uses minimum necessary retained information.

PRV-INV-031 Outbox/job payloads are minimized and have bounded retention.

PRV-INV-032 Dead letters cannot become permanent sensitive-data archives.

PRV-INV-033 Backups are not ordinary data-access surfaces.

PRV-INV-034 Backup restore cannot resurrect deleted Accounts into service.

PRV-INV-035 Deletion/suppression ledger stores minimum required data.

PRV-INV-036 Public removal and internal evidence retention are separate.

PRV-INV-037 Deletion cannot bypass active security recovery restrictions.

PRV-INV-038 Operators cannot arbitrarily cancel valid deletion.

PRV-INV-039 Operators cannot create unreviewed indefinite holds.

PRV-INV-040 Retention policies are versioned/effective-dated.

PRV-INV-041 No unrelated module hard-codes retention days.

PRV-INV-042 Policy snapshot used for lifecycle decision is auditable.

PRV-INV-043 Hard-delete workers use bounded batches.

PRV-INV-044 Partition drop cannot bypass hold-eligible data policy.

PRV-INV-045 Derived projections are rebuilt only from surviving eligible canonical state.

PRV-INV-046 Seller/Buyer export never includes another party's private data beyond allowed transaction view.

PRV-INV-047 Export objects are private and expire.

PRV-INV-048 Full exports are not emailed as attachments.

PRV-INV-049 Third-party processors are included in lifecycle inventory.

PRV-INV-050 Processor deletion failure prevents false completion where mandatory.

PRV-INV-051 Cross-border/provider-region changes require updated privacy/legal review.

PRV-INV-052 Legal uncertainties are marked LEGAL REVIEW REQUIRED, not invented.

PRV-INV-053 Security/audit retention has purpose and access limits.

PRV-INV-054 Sentry/Pino do not become shadow sensitive-data stores.

PRV-INV-055 Deleted Account cannot authenticate with old Session.

PRV-INV-056 Delayed BullMQ job cannot recreate deleted subject data.

PRV-INV-057 Lifecycle state can be used by Auth to block resurrection safely.

PRV-INV-058 Anonymisation claim requires re-identification analysis, not just nulling one FK.

PRV-INV-059 Pseudonymised data remains privacy-sensitive.

PRV-INV-060 Transaction/evidence retention cannot be used as excuse for unrelated behavioral retention.

PRV-INV-061 One ordinary Account may carry Buyer/Seller/Courier relationships; lifecycle cannot assume mutually exclusive identities.

PRV-INV-062 Operator lifecycle is separate from ordinary Account lifecycle.

PRV-INV-063 Current Seller verification stores no Government-ID artifacts.

PRV-INV-064 Provider KYC does not become Seller-admission data merely because Finance reads readiness.

PRV-INV-065 Provider/backend facts establish payment; normal flow creates no Buyer screenshot evidence.

PRV-INV-066 CheckoutAllocation is short-lived operational state, not a Buyer-facing Reservation.

PRV-INV-067 Scene PUBLIC/PRIVATE is not equivalent to deletion/archive.

PRV-INV-068 Held exact Scene revision survives public visibility changes.

PRV-INV-069 Direct delegate identity is minimized after purpose, subject to narrow lawful evidence retention.

PRV-INV-070 Buyer Review Grant is lifecycle-managed separately from public Review content.

PRV-INV-071 No persistent Mobile Analytics replay queue can resurrect a deleted subject.

PRV-INV-072 Raw provider material is minimized/restricted; normalized canonical facts are preferred.

PRV-INV-073 CSP/security telemetry has privacy classification and bounded retention.

PRV-INV-074 Only explicitly active Markets/processors are live production processing.

## 71. Open Legal/Product Decisions

Every unresolved item has a named role, approved configuration/evidence requirement and release gate. No fabricated statutory day count or legal basis is inserted.

| Open item | Decision owner / safe current handling |
| --- | --- |
| Account deletion grace/cooling | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Phone reuse cooling | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Review retention/anonymization | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Ordinary Chat retention | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Analytics raw-event retention | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Search-query retention | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Provider transaction/raw reconciliation retention | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Claim post-resolution tail | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Delegate direct-contact retention | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Precise Courier GPS window/retention | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Operator/security telemetry retention | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| CSP-report retention | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Backup rotation/restore-suppression lifetime | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Private export expiry | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Controller/processor registration and prior authorization | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| DPO appointment/obligation | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Cross-border transfer/localisation safeguard | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Legal/security hold authority/review | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| Provider KYC responsibility boundary | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |
| 18+ declaration implementation; known-underage/incidental-child legal handling | Privacy + Legal with domain/Product owner; LEGAL REVIEW REQUIRED where applicable. Versioned policy/config; block affected processing until resolved. |

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 72. Canonical Write-Backs

| Canonical writeback | Required contract |
| --- | --- |
| DB / API / Auth / Authorization | Typed subject/actor FKs, ordinary relationship inventory, separate Operator lifecycle; request/task/hold/policy/tombstone/export contracts. |
| Checkout / Orders / Finance | Allocation cleanup, provider/surcharge/refund snapshots, restricted evidence and provider lifecycle adapter. |
| Content / Media / Search / Collections / FYP | Scene visibility vs deletion; exact retained revision; public hard gates and derived/object purge. |
| Handoff / Fulfilment / Reviews / Claims / Trust | Delegate/location minimization, final DELIVERY Buyer Grant, scoped source evidence and corrections. |
| Chat / Chatbot / Analytics / Notifications / Eventing | Purpose-limited messages/observations; no local replay; safe intents and suppression before rebuild. |
| CSP / OBS / DPIA | Report class/minimization; privacy clock; risk register/control evidence and legal gates. |
| Deployment / processors | Verified regions/contracts, deletion mechanisms and restore-suppression drill. |

## 73. Implementation Sequence

| Phase | Build and exit evidence |
| --- | --- |
| 0 Legal / inventory | Confirm corporate obligations, processing/processor/region inventory, purposes and policy IDs. |
| 1 Lifecycle foundation | Typed request/task/hold/suppression schema and versioned public domain interfaces. |
| 2 Auth / relationships | Deletion confirmation, safe blocker resolution, multi-relationship exits and separate Operator termination. |
| 3 Commerce / evidence | Provider/zero at launch/allocation, Handoff/delegate/Grant, exact Scene/Claim/Chat evidence holds. |
| 4 Durable execution | PostgreSQL intent/relay/BullMQ, idempotency, hold fences, bounded retries/reconciliation. |
| 5 Derived / external | Analytics/Search/FYP/CDN/cache, provider/processor actions and CSP telemetry policy. |
| 6 Export / governance | Private streaming export, entitlement filtering, Operator audit and escalation. |
| 7 Restore / hardening | Ledger replay before traffic, race/failure/load/UI tests; DPIA and legal release sign-off. |

## 74. Production Launch Gate

Production approval requires evidence for every gate; an unchecked item is OPEN, not implied implementation.

• Complete current inventory/purpose/approved retention policy for all 40 classes; no hard-coded unapproved duration.

• Legal review of corporate obligations, registration/authorization, DPO, rights, notices, transfers/regions and holds; current ADU-DPIA-01 decision.

• No Government-ID Seller admission API/UI/storage; social-control and hosted provider KYC boundaries verified.

• Provider payment/refund/settlement and separate zero at launch accounting class; allocation cleanup never releases paid stock.

• All ordinary relationships evaluated; Seller/TEAM/Courier exit and separate Operator lifecycle proven.

• Scene PRIVATE is not purge; public gates and held exact revisions tested.

• Handoff/delegate/GPS/Review Grant lifecycle and unusable deleted-Buyer Grant proven.

• Scoped hold wins purge race; shared Media/reference cleanup; bounded task verification and no false COMPLETED.

• Connected Analytics and server replay suppression; sessions/push/caches/personalization cannot resurrect identity.

• Private entitled export, safe CSP/log reports, actual processor action verification and failures tracked.

• Restore ledger replay and verification before traffic; privacy breach Authority/data-subject clocks and escalation tabletop.

• Original lifecycle race/backup/load tests plus PRV-CANON-01 through 20 pass; canonical writebacks complete.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 75. Final Architecture Diagram

![Domain-owned deletion under central lifecycle governance](graphics/PRV_02.svg)
*Figure 02. Domain-owned deletion under central lifecycle governance. Retention and legal decisions are approved policies; private visibility is not deletion.*

Privacy coordinates through declared contracts; domains execute and verify their own lifecycle. External processor completion, cache/CDN/index cleanup and authoritative suppression replay are part of proof. COMPLETED cannot be emitted before required verification.

## 76. Engineering Doctrine

Privacy is a cross-domain lifecycle protocol, not a central delete permission. Domains know data semantics; Privacy knows purpose/policy/hold scope; Eventing executes durable intent; Legal approves legal conclusions. Public removal, identity minimization and justified evidence retention may coexist. Backups are delayed copies, not deletion exemptions. No unapproved library or governance service is introduced by this design.

## 77. Appendix A - Current Technology Placement

| Layer | Approved current technology and role |
| --- | --- |
| Backend / data | Node.js, NestJS, Fastify, TypeScript strict; Drizzle ORM, PostgreSQL; pg_trgm, btree_gist, pg_stat_statements. |
| Async / API | Valkey + BullMQ; REST, OpenAPI, @nestjs/swagger, generated TypeScript client; PostgreSQL event_outbox/job_intent remains durable authority. |
| Security / media | @nestjs/throttler, @fastify/helmet, libphonenumber-js; Cloudflare R2, Cloudflare CDN, Sharp. |
| Mobile | React Native, Expo, Expo Router, TanStack Query, FlashList, Expo Image, Expo SecureStore, Expo SQLite, Expo Camera, Expo Notifications, Expo Updates; small Zustand store. |
| Quality / visibility | Jest, Testcontainers, Maestro, Playwright, k6; Sentry, Pino structured logs, pg_stat_statements; dependency-cruiser. |
| Delivery | Docker, GitHub Actions, Render, Cloudflare, EAS. No unapproved runtime, governance service or second worker engine is added. |

Streaming export/archive, schema validation and crypto capabilities must use approved runtime facilities or receive separate engineering approval. zod, archiver, Temporal, Kafka and a privacy-governance product are not mandatory additions.

## 78. Appendix B - Stable Privacy Errors

| Code | Meaning |
| --- | --- |
| PRIVACY_REQUEST_NOT_FOUND | Absent or inaccessible; do not leak existence. |
| PRIVACY_STEP_UP_REQUIRED | Fresh confirmation/authentication required. |
| PRIVACY_REQUEST_ALREADY_ACTIVE | Idempotent/conflicting active request. |
| PRIVACY_DELETION_BLOCKED | Explicit approved obligation remains. |
| PRIVACY_HOLD_ACTIVE | Scoped hold prevents destructive action. |
| PRIVACY_REQUEST_IRREVERSIBLE | Cancellation point passed. |
| PRIVACY_DOMAIN_TASK_FAILED | Mandatory work incomplete; safe retry status. |
| PRIVACY_EXPORT_NOT_READY | Generation/verification pending. |
| PRIVACY_EXPORT_EXPIRED | Private artifact expired/removed. |
| PRIVACY_TEMPORARILY_UNAVAILABLE | Retryable dependency failure. |

## 79. Appendix C - Legal Sources & Review Evidence

Sources checked 8 October 2026; architecture sources are not proof of production implementation.

| Reference | Official source / status |
| --- | --- |
| L01 - Proclamation No. 1321/2024 | https://justice.gov.et/en/law/personal-data-protection-proclamation/ - Ministry of Justice, in-force listing and linked bilingual Gazette; Articles 43, 44, 47 and 48 reviewed. |
| L02 - ECA PDP portal | https://pdp.eca.et/ - current regulatory reference; portal retrieval was intermittent. Verify final applicable forms/directives directly before submission. |
| L03 - ECA manual draft | https://pdp.eca.et/files/PDP%20Manual%20Draft.%20v_1.1.3.pdf - indexed as DRAFT; full retrieval unavailable in this review. Not a final legal obligation or completed form. |

Policy values, actual processor/region contracts, legal interpretations and sign-offs remain explicit evidence requirements. No fixed Order, Chat, Analytics or Claim retention period is inferred from these references.

## 80. Appendix D - Architecture Fitness Functions

• Reject personal field without owner/purpose/class/retention/processor mapping.

• Reject Privacy import of another domain's private repository.

• Reject hard-coded legal retention, ambiguous ordinary/Operator actor FK or unreviewed admission-ID class.

• Reject purge that skips current hold fence or marks complete before physical/derived/processor proof.

• Reject user export containing counterparty secrets, fraud internals, raw provider or private reviewer evidence.

• Reject persisted Mobile Analytics/Handoff authority or delayed worker restore without suppression check.

• Reject new mandatory runtime dependency, indefinite dead-letter archive or backup reopening without ledger replay.

• Reject raw CSP URL/query/policy nonce, Chat/evidence/GPS/provider secrets in Pino/Sentry.

## 81. Appendix - Actual Launch-Scope Evidence Register

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

## 82. Glossary

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

## 83. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-10 — Purchased Products and Buy Again | The 13 October pack has Buyer Orders/account history but not the finalized Purchased Products UX. | Purchased Products derives from completed Buyer Orders and shows one entry per Product using the latest purchase: Seller, purchase date, purchased variant and current Product facts where resolvable. Buy Again opens the current Product with the last variant preselected only if still offered; Buyer must still choose quantity/fulfilment and explicitly order/pay. Unavailable or delisted Products remain in purchase history without an invalid Buy Again action. Review actions reuse canonical Review eligibility. | PR-006, 27 Oct 2026 |
| R-11 — Buyer account controls and deletion parity | The 13 October Privacy/Auth designs govern account lifecycle and deletion. | Authenticated Buyer account controls include Edit Profile, saved discovery area, Appearance, notification preferences, Privacy & Security, Help & Support, Delete Account and Sign Out. Delete Account uses verification, consequence preview, authoritative blockers and typed confirmation; Mobile and Website must share policy wording/data rather than independently reauthoring deletion consequences. Sign Out changes session state only. | PR-006, 27 Oct 2026 |
| R-16 — Company Website public-copy refinements | The 13 October Website/Finance designs already hold the corrected launch financial model. | Public Website copy must not promise a 0.5% Adulis transaction fee. It uses Buyer-facing Product/Scene language and shared authoritative report/deletion policy. Removing decorative warning/report icons must not remove role=status/role=alert semantics. Seller public location copy must not imply a mandatory physical storefront when only operating area/collection point is available. | PR-001 + Oct 15 corrections |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
