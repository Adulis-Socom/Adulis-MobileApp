# Adulis Seller Onboarding
Version 3.2 | 13 October 2026 | DOCUMENT-CORRECTED

## Document control

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026. |
| Source | ADU-ONB-01_Adulis_Seller_Onboarding_Eligibility_Verification_System_Design_v3.1.pdf |
| Authority | 13 October contract prompt; selected 12 October owner decisions remain binding. |
| Status | DOCUMENT-CORRECTED; implementation, integration tests and external approvals not established. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |

## 1. Mission

Seller Onboarding owns social-commerce admission, verification evidence and fresh publication readiness. Authentication creates ordinary sessions; it does not itself create a Seller. A Seller is a business entity with an OWNER relationship to an ordinary Account, not a new login identity.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Current admission is Government-ID-free. Creator is an optional admission trait/profile activated only by explicit Market/Product policy. Product Post readiness is independent of Scene creation; no Scene is required to become publish-ready.

The architecture is globally extensible with explicit phased Market activation. Ethiopia is the initial commerce Market, beginning with Addis Ababa. Future Markets require approved currency, provider, legal, commercial and operational readiness. Locale, IP address, phone prefix and client country never activate commerce.

## 2. Authoritative update baseline

This v3.0 baseline reconciles the attached v2.1 design and its matching update specification. Existing social-control protocol, eligibility engine, fresh-readiness rules, operational behavior and role-authorization appendix remain in force where consistent. Typed ordinary/Operator identity, policy-gated Creator admission, provider KYC separation and current Market activation supersede conflicting historical language.

## 3. Core doctrine

```
ACCOUNT AUTHENTICATION
!= SELLER CREATION
!= SELLER ELIGIBILITY
!= SOCIAL-ACCOUNT CONTROL
!= OPERATIONAL READINESS
!= TRUST
!= MODERATION
```

```
Every fact has one canonical owner.
```

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

Adulis admission establishes configured social-commerce eligibility, not legal identity, product authenticity, provider compliance or a purchased Trust level.

## 4. System boundary

Seller Onboarding owns Seller creation/progress, admission evaluation, onboarding evidence orchestration and readiness presentation. Auth owns Account/session truth. Payments owns provider/settlement readiness. Fulfilment owns fulfilment configuration. Catalogue owns Product Post publication. Trust and Moderation own reputation and safety enforcement.

Onboarding consumes those systems through public application contracts; it does not reach into their private repositories.

Auth/Authorization owns ordinary credentials, Seller relationships, TEAM exclusivity and effective role union. A separate privileged identity boundary owns Operator Accounts. Onboarding invokes these owner contracts rather than creating duplicate guards or identity stores.

## 5. What Seller Onboarding owns

• Seller creation in DRAFT and owner relationship bootstrap.

• Seller type declaration and editable setup profile.

• Versioned Market admission policy resolution.

• Social-account connection/control evidence orchestration.

• Current eligibility evaluation and historical evaluation records.

• Readiness projection and structured blocker/resolving actions.

• Onboarding analytics, beta/waitlist entry and launch gating.

## 6. What Eligibility owns

Eligibility owns versioned Market admission policy, evidence evaluation, immutable decision records and current satisfied/not-satisfied outcome. Audience/social-commerce evidence is current; IDENTITY_PATH remains inactive future compatibility and cannot satisfy launch admission.

Where a Creator admission profile is explicitly ratified and enabled, its legitimate-selling evidence rule is an additional policy input. Disabled Creator admission produces no active path or UI and does not require schema redesign. Creator is never a Seller or Account type.

## 7. What Verification owns

Verification in this release means proving control of claimed TikTok/Instagram social accounts and recording verified social-business evidence. It does not mean legal identity/KYC verification.

The primary mechanism is provider Login Kit/account connection. The controlled fallback is an Adulis-issued social-control one-time code delivered to the already-authenticated Seller phone, then DMd from the claimed social account to an official Adulis TikTok/Instagram account.

Fallback evidence is reviewed by a separate Operator Account and recorded as evidence. Eligibility re-evaluates from canonical facts; no reviewer writes eligible=true.

## 8. What this system does not own

• Ordinary phone-OTP login/session issuance.

• Seller team roles or permission calculations.

• PSP payment success, settlement or refunds.

• Courier assignment/Handoff verification.

• Trust Level calculation.

• Claim adjudication or Review eligibility.

• Product/stock truth or FYP ranking.

• Legal identity-document collection in the current release.

Provider KYC documents and bank/provider secrets belong to Finance/provider boundaries; Onboarding consumes safe readiness status only. Content owns Scene Posts and Analytics owns derived measurement.

## 9. Canonical Seller lifecycle

```
ACCOUNT EXISTS
   |
CREATE SELLER
   v
DRAFT
   | setup + admission + operational readiness
   v
PUBLICATION-READY
   | first valid Product Post publication
   v
ACTIVE
   |
SUSPENDED / CLOSED / DELETED lifecycle is owned by canonical Seller policy
```

## 10. DRAFT is a real Seller state

A Seller may exist in DRAFT while social verification, eligibility, provider onboarding, fulfilment or Product setup remains incomplete. DRAFT preserves progress and auditability without pretending the Seller is admitted or publicly launchable.

## 11. Wizard progress is a projection

Do not persist a mutable step number as business truth. The UI derives progress from canonical domain facts and readiness items. A Seller may complete setup in a different order, and a later change may make an item unsatisfied again.

## 12. Seller entity and ownership

Seller creation atomically creates the DRAFT Seller, its Market scope, the authenticated ordinary Account OWNER relationship and onboarding outbox intent through the Auth-owned application facade/shared unit of work. A failed relationship write rolls back the whole creation. This is an explicit owner contract, not a cross-domain repository bypass.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

The TEAM exclusivity backstop remains Auth-owned. Owning Seller businesses is a separate relationship and never collapses identity into account.seller_id.

## 13. Seller status

Recommended lifecycle states remain DRAFT, ACTIVE and canonical suspension/closure states used by the Seller domain. Onboarding may request legal transitions through the Seller application service; it does not update status directly.

## 14. Seller type

Keep the structural Seller types already used by Adulis, such as INDIVIDUAL and COMPANY. A creator is an admission profile/trait, not automatically a new legal Seller entity type. Do not invent a CREATOR database Seller type merely because creator applicants have an additional admission rule.

## 15. Individual Seller

An INDIVIDUAL Seller may be informal or unregistered. Current admission does not require National ID, passport, business licence or legal incorporation evidence. The Seller still must satisfy the active social-commerce admission policy.

## 16. Company Seller

A COMPANY Seller may provide company/store information needed for presentation and operations, but Adulis does not request personal National ID/passport or other legal identity documents as part of Seller verification in this release.

Any future formal business-document verification must be introduced as a versioned policy/design change rather than silently added to the current onboarding flow.

## 17. Creator admission profile / trait

Creator is admission_profile/trait metadata on the ordinary Account’s Seller application, not CREATOR Seller type, separate Account type or a complete new commerce actor. Seller types remain INDIVIDUAL and COMPANY.

The path is inactive unless explicit Market/Product policy ratifies and enables it. If enabled, apply versioned legitimate-selling evidence with established social presence; Government ID, business licence or incorporation documents are not implicit admission requirements. Disabled path/UI remains disabled while the optional schema trait is retained.

## 18. Market boundary

The architecture is globally extensible with explicit phased Market activation. Ethiopia is the initial commerce Market, beginning with Addis Ababa. Future Markets require approved currency, provider, legal, commercial and operational readiness. Locale, IP address, phone prefix and client country never activate commerce.

One Seller has one canonical Market in MVP. Eligibility policy, supported social providers, evidence requirements and readiness are evaluated for that Market and version. Future-country policy must be approved and activated explicitly; Ethiopia policy is not a universal fallback.

## 19. Seller creation API

```
POST /v1/sellers
Authorization: ordinary Account session
Idempotency-Key: required
Request:
  market_id: explicitly active onboarding Market
  seller_type: INDIVIDUAL | COMPANY
  display_name, handle
  admission_profile: optional policy-enabled trait
Atomic result:
  DRAFT Seller + typed ordinary Account OWNER relationship
  Market scope + onboarding projection + event_outbox
```

Server derives ordinary actor identity and validates the selected Market and allowed profile. Client cannot create an Operator Account, CREATOR Seller type, legal-ID path or team-membership bypass.

## 20. Seller creation idempotency

Retrying the same Seller-create command must return the same created Seller rather than duplicate businesses. Enforce stable idempotency and unique handle rules server-side.

## 21. Store profile

Store profile readiness covers minimum public Seller information such as display name, handle, description/category and approved public contact/location fields. It must not expose the Account login phone automatically.

## 22. Active Hours terminology is retired

Do not model Active Hours as Seller operating hours, admission evidence or a publication-readiness item. The phrase is too ambiguous and previously encouraged the wrong behavior.

## 23. Orders are placeable throughout the day

A Buyer may place an Order at any time while the Seller/Product/Market/payment system is available. Seller-configured hours do not close Checkout simply because the physical shop or delivery operation is closed at that moment.

Order acceptance timing is therefore distinct from physical fulfilment timing.

## 24. Delivery windows

For enabled Seller Delivery or Courier Delivery, the Seller may define delivery/pickup-operational windows used for scheduling, expectation setting and allowed fulfilment actions. These windows are Market-local time configuration and do not prevent the Buyer from placing the Order outside the window.

## 25. Store-visit and Buyer-collection hours

If a Seller offers in-person store visits or Buyer Collection, the Seller sets the hours during which the Buyer can visit/collect. Storefront/Mobile display those hours in the Seller/Market timezone while APIs use canonical absolute timestamps where an actual appointment/window is materialized.

## 26. No fake 24-hour physical availability

The system must not infer that because ordering is available 24/7, Seller staff, physical stores or Couriers operate 24/7. UI copy must distinguish Order anytime from Delivery/visit within Seller-set windows.

## 27. Eligibility Engine

Eligibility is a deterministic, server-side policy evaluator. It consumes the effective Market policy plus verified evidence and returns SATISFIED or NOT_SATISFIED with structured reason codes. Client screens may explain the decision but never calculate admission.

## 28. Eligibility paths remain extensible

```
EligibilityPath = AUDIENCE_PATH | IDENTITY_PATH
```

```
Architecture supports both.
Current launch policy enables AUDIENCE_PATH as the admission route.
IDENTITY_PATH remains an inactive/deferred policy capability until an approved verification method is 
introduced.
```

## 29. Current admission policy - social-commerce exclusive

Current launch admission uses the effective social-commerce Audience policy: established social-business presence and verified control of at least one supported social account. Account control alone does not prove established presence; both evidence concerns remain separately evaluated.

Creator-specific legitimate-selling rules apply only when the explicit Market/Product admission profile is enabled. Otherwise the Creator path and UI are inactive. Established presence, follower inputs and evidence sufficiency are versioned policy, never a hard-coded 1,000-follower threshold.

## 30. Audience Path

AUDIENCE_PATH proves two things separately: (1) the Seller controls the claimed external social account, and (2) the verified account/evidence satisfies the current social-business admission policy.

Control alone is necessary but not sufficient when policy also requires established presence.

## 31. Identity Path

IDENTITY_PATH is inactive future compatibility. It cannot satisfy current launch policy or expose an identity-document API, upload, storage field or UI. Activation would require a separately approved product/privacy/Market decision, migration and tests; schema compatibility is not permission to collect legal identity.

## 32. Future Identity Path compatibility

Keep an extensible path discriminator and versioned policy history for future decisions. No current evaluator accepts IDENTITY_PATH or Government-ID evidence. A future lawful requirement requires explicit policy, data minimization, storage/access/retention controls and release verification before collection begins.

## 33. Eligibility configuration

| Field | Current meaning |
| --- | --- |
| market_id / policy_version | Explicit Seller Market, effective policy history and non-overlapping validity. |
| admission_mode | SOCIAL_COMMERCE_EXCLUSIVE for the activated launch policy. |
| enabled_paths | AUDIENCE_PATH current; IDENTITY_PATH inactive. |
| counting_platforms | Supported independent social adapters under this Market policy. |
| follower_threshold / threshold_basis | Optional, versioned evidence input; no code constant. |
| creator_profile_enabled | False unless explicitly ratified Market/Product policy enables the trait. |
| creator_selling_evidence_rule | Evaluated only for an enabled Creator admission profile; no implicit Government-ID/licence/incorporation requirement. |
| effective_from / effective_to | Immutable version history; no retroactive overwrite. |

## 34. No hard-coded follower threshold

Do not implement REQUIRED_FOLLOWERS = N. Some Markets/policy versions may use follower evidence; others may emphasize other established-presence evidence. A nullable threshold means the numeric threshold concept does not apply for that version.

## 35. Established social-business presence

The policy resolver may use only substantiated evidence categories such as verified platform identity/control, provider-supplied audience evidence when available, public account activity/business signals, and controlled Operator-reviewed evidence when the automated provider path cannot supply a required fact.

Do not infer legitimacy from a single vanity metric or from self-reported numbers.

## 36. Policy-enabled Creator selling evidence

When Creator admission is explicitly enabled, evaluate approved legitimate-selling categories such as an established business-facing social page, product/selling content or another policy-approved commerce presence. Acceptance criteria are versioned Market/Product policy, not ad-hoc reviewer opinion. If disabled, no Creator-specific admission path is presented or evaluated.

## 37. Eligibility evaluation record

Store an append-only evaluation with seller_id, market_id, policy_version, path, evaluated_at, outcome and reason_codes plus references to the evidence versions used. Historical decisions must remain explainable after policy changes.

## 38. Eligibility outcome

Canonical evaluation is SATISFIED or NOT_SATISFIED. Operational states such as WAITING_FOR_PROVIDER, WAITING_FOR_DM_REVIEW or NEEDS_SELLER_ACTION belong to workflow/readiness, not ambiguous eligibility truth.

## 39. Reason codes

Use a closed/versioned catalogue such as SOCIAL_ACCOUNT_REQUIRED, SOCIAL_ACCOUNT_CONTROL_UNVERIFIED, SOCIAL_BUSINESS_PRESENCE_NOT_ESTABLISHED, CREATOR_SELLING_STATUS_REQUIRED, SOCIAL_EVIDENCE_UNAVAILABLE and POLICY_NOT_CONFIGURED.

Do not store only English reason strings; clients localize stable codes.

Use CREATOR_PROFILE_DISABLED or its registry-approved equivalent when a requested trait is not enabled. This is a policy denial, not a new identity type. No legal-ID evidence reason code is current admission authority.

## 40. Eligibility re-evaluation

Re-evaluate on relevant policy/evidence changes: social account re-verification/revocation, seller admission-profile change, effective Market policy version, creator status evidence change, Seller status changes and explicit authorized recheck. Preserve prior evaluations.

Re-evaluation also re-reads current Creator-profile enablement and Seller Market policy version. Historical evidence and evaluations are retained without turning disabled paths into current authority.

## 41. Social Account model

```
seller_social_account
-  i d
- seller_id
- platform: TIKTOK | INSTAGRAM | future provider
- provider_account_id?
- canonical_handle
- verification_method: LOGIN_KIT | OFFICIAL_ACCOUNT_DM
- control_status
- verified_at
- evidence_version/ref
- provider_connection_status
- token_reference/encrypted credential reference when required
- revoked_at?
- created_at / updated_at
```

## 42. One current relationship per Seller and platform

Current Seller/platform connection uniqueness must coexist with immutable verification history. Reconnecting or changing the account creates a new evidence/version boundary rather than rewriting historical attribution.

## 43. Primary social verification - Login Kit

Seller Onboarding integrates the account Login Kit/account-connection flow provided by TikTok and Instagram. After the Seller is already authenticated to Adulis, they choose Connect TikTok or Connect Instagram, complete the provider flow, and return through a server-validated callback.

Successful provider connection proves control only to the extent supported by the provider contract. Eligibility still evaluates the established social-business criteria separately.

Social capabilities are per-provider/account type, API version and approval, not a generic Login Kit promise. TikTok Login/account control is distinct from approved Display API v2 video ownership using an authorized video.list token; provider stable identity, callback state/replay, minimal fields and revoke/recheck lifecycle are recorded. Instagram Login supports professional Business/Creator accounts; unsupported consumer accounts use a separately valid approved admission path, not invented API access. Exact live app products/scopes/version/evidence fields and approval refs remain unconfirmed until verified.

Official-page DM proves approved selected account-control evidence only; it grants no OAuth scope, video query/ownership capability or provider approval. Keep TikTok videos external and Product-only. Ownership-dependent embeds require actual approved supported account/token/scopes and current wrong-owner/private/deleted/revoked checks; fail closed to safe placeholder/link without breaking an independent valid admission path. No TikTok native FYP/Scene video, password/inbox harvesting or session creation.

## 44. Login Kit is not Adulis login authority

Ordinary Adulis Account authentication remains the canonical phone-OTP/session architecture. A TikTok or Instagram connection must not by itself create an Adulis Account session, grant Seller ownership, grant a Seller team role or bypass Step-Up.

The same external identity may later support provider-specific capabilities such as TikTok video ownership checks, but capability-specific authorization remains separate.

Login Kit links social-control evidence to an existing ordinary Account’s Seller workflow; it never provisions an Adulis session or changes Account type.

## 45. Login Kit callback security

• Bind initiation to authenticated Account + Seller + platform.

• Use signed/unguessable state and nonce; use PKCE where supported/required by the provider contract.

• Validate redirect/callback origin and provider response server-side.

• Prevent account-link CSRF and callback replay.

• Never trust a client-supplied provider_account_id as proof.

## 46. Provider tokens and scopes

Request the minimum scopes needed for social-account control/audience evidence. Provider client secrets never reach Mobile or Seller Console. Access/refresh tokens, if the provider requires Adulis to retain them, are encrypted/restricted integration credentials and are redacted from logs, analytics and support views.

Social capabilities are per-provider/account type, API version and approval, not a generic Login Kit promise. TikTok Login/account control is distinct from approved Display API v2 video ownership using an authorized video.list token; provider stable identity, callback state/replay, minimal fields and revoke/recheck lifecycle are recorded. Instagram Login supports professional Business/Creator accounts; unsupported consumer accounts use a separately valid approved admission path, not invented API access. Exact live app products/scopes/version/evidence fields and approval refs remain unconfirmed until verified.

## 47. Provider identity mapping

Prefer stable provider account IDs over handles. Store handle/display data as a snapshot for user presentation. A handle rename must not silently create a new identity when the provider stable ID proves continuity.

## 48. TikTok and Instagram are independent adapters

A TikTok outage or rejected connection must not break Instagram verification, and vice versa. The adapter registry normalizes account identity/control/evidence while retaining provider-specific raw state only where safe and necessary.

## 49. Official social-page DM fallback

If a platform Login Kit/account-connection flow fails or cannot complete, Adulis uses its official TikTok or Instagram marketing page as a controlled fallback verification channel.

The fallback proves that the already-authenticated Adulis Seller can receive a one-time code on their verified phone and can send that same code from the claimed social account to the official Adulis account.

## 50. Fallback code must be separate from login OTP

User-facing copy may call this a verification code/OTP, but the backend purpose must be SOCIAL_ACCOUNT_CONTROL, not LOGIN_AUTHENTICATION.

After the Seller is signed in, Adulis issues a new SOCIAL_ACCOUNT_CONTROL one-time code and sends it to the verified Seller phone. Do not reuse the OTP that authenticated the Adulis session. Reusing a login OTP in a social DM would expose an authentication secret to a third-party channel and create avoidable account-takeover risk.

## 51. Fallback verification flow

```
SELLER AUTHENTICATED TO ADULIS
        |
Claims TikTok or Instagram account
        |
Login Kit failed/unavailable
        v
POST social-control fallback request
        |
Adulis sends one-time SOCIAL_ACCOUNT_CONTROL code to verified phone
        |
Seller opens official Adulis TikTok/Instagram page
        |
Seller DMs code FROM claimed social account
        |
Authorized Operator verifies sender account + code + challenge state
        |
Server records control evidence
        v
Eligibility re-evaluates using verified evidence
```

![Social account control and video capability need separate evidence](graphics/ONB_01.svg)
*Figure 01. Social account control and video capability need separate evidence. DM control grants no OAuth/video permission. Actual provider permissions remain activation gates.*

## 52. Fallback challenge properties

| Property | Rule |
| --- | --- |
| Purpose | SOCIAL_ACCOUNT_CONTROL only |
| Delivery | Verified Account phone via normal messaging router |
| Format | Short one-time code; 6 digits is acceptable unless config changes |
| TTL | Short/configurable, e.g. around 10 minutes |
| Attempts | Bounded and rate-limited |
| Storage | Keyed verifier/hash; never plaintext after issuance |
| Binding | Seller + Account + platform + claimed social account + challenge id |
| Reuse | Never reusable as login OTP, Step-Up or another platform challenge |

## 53. Official account configuration

The canonical official TikTok/Instagram account identifiers and deep links live in versioned configuration. Do not hard-code display handles throughout Mobile/Console because marketing handles can change. The UI must show the configured official destination and anti-phishing warning.

## 54. DM review

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

The authorized reviewer checks the inbound sender against the claimed social account and the one-time SOCIAL_ACCOUNT_CONTROL challenge. Record matched/rejected evidence, deciding reviewer FK, timestamp, reason and immutable policy/config references. The reviewer does not manually assign eligibility; the Eligibility service re-evaluates from that evidence and current policy.

## 55. Manual fallback does not become an override

Fallback review is evidence validation, not an eligibility override. A sender/code match can still leave established-presence or readiness requirements unsatisfied. Formal policy exceptions, if explicitly supported, use the separate Operator capability and governance path, retain their evidence and never create an undocumented universal eligible=true action.

## 56. Fallback evidence model

```
onboarding.social_control_challenge
  id, seller_id, ordinary_account_id FK accounts.account, market_id
  platform, claimed_social_account_ref
  purpose SOCIAL_ACCOUNT_CONTROL, code_verifier_hash
  issued_at, expires_at, attempts, status
  sms_delivery_reference nullable, official_account_config_version
  dm_observed_at, minimal observed_sender_platform_id / handle snapshot
  reviewed_by_operator_account_id FK operators.operator_account nullable
  review_result, reason_code, reviewed_at, verified_at
  eligibility_policy_version, evidence_reference
```

Ordinary applicant and privileged reviewer use distinct typed FKs. Retain only necessary sender/code-match metadata by default, not arbitrary DM conversations. Login and Step-Up OTPs cannot satisfy this challenge.

## 57. Fallback anti-abuse controls

• Throttle challenge creation by Account, Seller, phone, platform and device/session risk.

• One active challenge per Seller/platform/account-control attempt.

• Expire on Seller social-account change or Account security event.

• Detect excessive DM-fallback use and route anomalies to support/security.

• Do not disclose whether a claimed social account is linked to another Seller.

## 58. Anti-phishing UX

Seller-facing screens must state that Adulis never asks for the Seller social password, never asks the Seller to send the Adulis login OTP, and only accepts the dedicated social verification code through the official account displayed in the app/console.

A verification code should be entered/sent only for the visible Seller/platform challenge.

## 59. DM evidence retention

Keep minimal proof metadata and audit references. Do not copy or retain unrelated personal DM history. Any screenshot/export used for a specific fraud/support case belongs to restricted evidence storage and retention policy, not general Seller onboarding tables.

## 60. Social-business evidence snapshot

When provider/manual review yields audience or business-presence evidence, create a versioned snapshot with provider/source, captured_at, verified account reference and the specific normalized facts used by policy. Do not mutate old snapshots when re-verifying.

## 61. Follower evidence remains optional policy input

If the effective policy uses follower count, use verified provider or controlled fallback evidence. Do not sum TikTok and Instagram audiences unless the policy explicitly defines that behavior. Self-reported waitlist claims never satisfy admission.

## 62. Social revocation

Provider disconnection, token revocation, account loss/control challenge reversal or confirmed wrong-account linkage marks the current social-control relationship non-current and triggers eligibility re-evaluation. Historical evidence remains for audit.

## 63. Re-verification

A re-verification creates a new evidence version. It never edits follower count, provider ID, verification timestamp or fallback result on the historical record that supported an earlier eligibility decision.

## 64. Public verification language

Do not show "Identity Verified" or imply legal/KYC verification. Public/seller-facing badges must describe only substantiated claims, for example Social account verified or Seller admitted to Adulis under the current policy.

A social-control badge does not mean legal identity, business licence, product authenticity or guaranteed reliability.

## 65. Legal identity verification is deferred

Legal identity verification is deferred from Adulis Seller admission. No National ID, passport, driver licence, legal-ID number, selfie-to-ID comparison or document retention is a current verification flow. Social control language must not imply legal identity or provider KYC assurance.

## 66. No legal-ID endpoints or storage

No current Government-ID API, UI, upload route, schema field or evidence store is exposed for Seller verification. Compatibility discriminators do not authorize collection. Negative contract tests inspect server validation, generated clients, Seller screens, storage and database migrations.

## 67. No fake KYC

Social verification proves supported account control under its recorded evidence and current admission policy. Company profile metadata and phone control are not legal identity verification. Avoid KYC-approved, legally verified or government-verified labels for this workflow.

## 68. Provider compliance and safe readiness boundary

Adulis Seller admission requires no Government ID, legal-ID upload or selfie-to-ID flow. A PSP may independently impose KYC/KYB under its contract and the activated Market. Prefer provider-hosted collection and retain only provider references, safe status and masked metadata in Finance. Any unavoidable Adulis handling requires a confirmed requirement and restricted Finance purpose, storage, access, audit, retention and deletion controls; it does not become an Onboarding ID requirement.

Onboarding consumes only safe normalized Finance outcomes such as PROVIDER_SETTLEMENT_READY or REQUIRES_PROVIDER_ACTION, provider reference and policy-versioned availability. It does not retain raw KYC documents, bank credentials or provider tokens.

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 69. Identity Path schema compatibility

The Eligibility Engine keeps IDENTITY_PATH as an enum/policy capability and may persist future path evaluations. Current configuration does not evaluate it as satisfiable. This preserves the requested alternative-path architecture without pretending a verification method exists today.

The optional future path discriminator remains inactive and has no raw Government-ID backing in current schema. Future collection needs an explicit change, not a generic nullable document column added now.

## 70. Publication Readiness

Readiness answers whether the admitted Seller has the operational setup required to publish commerce now. It returns every relevant item and never relies on a stale client-side checklist.

## 71. Current readiness items

| Readiness code | Current server rule |
| --- | --- |
| ACCOUNT_CREATED | Authenticated ordinary Account has the exact Seller OWNER relationship. |
| SELLER_TYPE_DECLARED | INDIVIDUAL or COMPANY under current allowed lifecycle. |
| ELIGIBILITY_SATISFIED | Fresh effective social-commerce evaluation; optional Creator profile only if explicitly enabled. |
| COMPANY_DETAILS | Conditional business metadata for COMPANY; no Government-ID verification. |
| STORE_PROFILE | Minimum public Seller profile and appropriate physical windows. |
| PROVIDER_SETTLEMENT_READY | Conditional safe Finance/provider status where current Market route requires settlement onboarding. |
| FULFILMENT_CONFIG | Supported fulfilment mode with that mode’s required physical windows. |
| AT_LEAST_ONE_PRODUCT | Catalogue confirms at least one legitimate, valid and eligible Product Post draft/current Product suitable for first publication. Scene creation is not required. |

## 72. IDENTITY_VERIFIED readiness item removed from current launch

Because legal identity verification is deferred and IDENTITY_PATH is not an active admission route, current readiness must not block on an IDENTITY_VERIFIED item. If a future Market activates legal/other identity verification, it can add a versioned conditional requirement through policy.

## 73. Company details are not KYC

Company name, description, representative/contact or physical-store details may be required for business operation/presentation. Their presence does not mean Adulis legally verified the company or representative. UI copy must preserve that distinction.

## 74. Payment readiness uses PSP status

Payments/Finance owns provider settlement onboarding and compliance readiness. Onboarding queries safe canonical status and its freshness/version; clients cannot mark it complete. Required provider action can block publication under explicit Market policy without Adulis collecting Government ID.

## 75. Fulfilment readiness

At least one fulfilment mode is required where current product policy requires Sellers to support fulfilment. Current modes may include Buyer Collection, Seller Delivery and Courier Delivery. Fulfilment owns the actual configuration and Courier Pool relationships.

## 76. Fulfilment windows are conditional

Ordering remains open throughout the day. If Buyer Collection, Seller Delivery or Courier Delivery requires a physical operating window, readiness validates that the enabled mode has the necessary Seller-configured visit/delivery/pickup window. Do not reintroduce a generic ACTIVE_HOURS blocker.

## 77. First Product Post

First Product readiness is a Catalogue decision. A validated legitimate Product Post draft/current Product may satisfy initial setup under the first-publication contract; Onboarding does not demand an already-public Seller to publish the prerequisite and create a circular gate. Scene Post creation or publication is a separate optional Content workflow.

## 78. No Product-count cap in onboarding

Onboarding does not enforce a commercial product-count limit. Current Catalogue policy allows Sellers to create Product Posts and Scene Posts without a fixed listing-count cap, subject to abuse, moderation and system limits.

## 79. Readiness response

```
GET /v1/sellers/{sellerRef}/readiness
200 OK
{
  "ready": false,
  "policy_version": "...",
  "items": [
    {
      "code": "ELIGIBILITY_SATISFIED",
      "satisfied": false,
      "reason_codes": ["SOCIAL_ACCOUNT_REQUIRED"],
      "resolving_action": {"kind":"CONNECT_SOCIAL_ACCOUNT"}
    } ,
    ... all current items ...
  ]
}
```

## 80. Readiness is a fresh server decision

A successful GET readiness response does not grant future authorization. Product publication must re-read/re-evaluate material Seller, eligibility, provider, fulfilment, product and moderation state in the publication command.

Publication rechecks current ordinary relationship and effective permission, active Seller Market, eligibility policy/profile enablement, Catalogue readiness, conditional Finance and Fulfilment facts. Cached wizard completion is advisory.

## 81. Publication command

```
AUTHENTICATE
  -> AUTHORIZE Seller + surface + scope
  -> Seller status
  -> current Eligibility evaluation/policy
  -> current Readiness resolver
  -> Catalogue Product rules
  -> Moderation / Trust constraints
  -> publish through Catalogue
  -> first valid publish may request Seller DRAFT -> ACTIVE transition
```

## 82. Admission does not buy Trust

Admission does not buy or assign Trust. Trust owns NEW, REBUILDING, ESTABLISHED and TRUSTED based on its current policy and downstream marketplace evidence. Social control and admission evidence can be typed inputs where Trust allows, but never an Onboarding level setter.

## 83. Beta/waitlist is not verification

Waitlist invite/cohort membership may allow access to onboarding, but self-reported follower counts, contact form data or beta invitation status do not satisfy social-account control or eligibility.

## 84. Waitlist import

Import only operational fields needed to resume onboarding. Keep self-reported audience claims explicitly labeled as claims and never merge them into verified social evidence.

## 85. Seller eligibility refresh

Existing admitted Sellers should not be silently reinterpreted under a new policy unless the versioned policy explicitly defines re-evaluation/migration behavior. New Sellers always use the policy version effective when evaluated; historical records preserve provenance.

## 86. Seller deletion

Account/Seller deletion follows the canonical Privacy lifecycle. Public Seller exposure and active authority are removed according to policy, while minimal historical eligibility/audit facts may be retained when required for Claims, security, accounting or legal holds.

## 87. Phone relationship

The Account phone is an authentication/contact credential and is not automatically the public Seller phone. Social-control fallback codes are sent to the verified Account phone (or canonical verified phone relationship), not an arbitrary unverified number typed into the fallback screen.

## 88. Account recovery and phone change

Account recovery/phone change preserves Seller ownership by immutable Account identity. A phone change invalidates or rebinds pending phone-delivered social-control challenges; it does not rewrite historical social verification evidence.

## 89. Authentication integration

Auth establishes Account identity through the current ordinary login/session model. Onboarding consumes ActorContext and never accepts account_id/role from client input as authority. Social Login Kit connections are linked external identities, not ordinary Adulis login authority.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Ordinary login/recovery belongs to Auth. TikTok/Instagram credentials and control evidence do not replace Adulis authentication. Shared human credentials are not a Seller team mechanism.

## 90. Seller Authorization integration

Authentication & Authorization answers WHO MAY PERFORM THIS ACTION. Seller Onboarding/Eligibility/Verification answers whether the requested onboarding, eligibility or verification transition is domain-valid. Onboarding must not duplicate or own the Seller RBAC matrix.

Only authenticated/authorized Seller owners or permitted team members may read or mutate onboarding resources. Seller team memberships may hold multiple assigned specialist roles under current current Auth; effective permissions are the server-derived union of those grants, constrained by Seller context, surface, scope, Step-Up and domain invariants. Onboarding must not infer rights from UI role labels.

Auth alone enforces at most one non-terminal ACTIVE/SUSPENDED TEAM membership in MVP, many roles within it, and current effective permission union. Seller ownership and Courier relationships remain distinct. Onboarding consumes the current owner result; it does not duplicate exclusivity logic.

## 91. Seller Console onboarding surface

Seller Console is the primary create/configure/administer surface. It presents current admission status, Connect TikTok/Instagram actions, DM fallback when offered, Seller/store configuration, PSP onboarding status, fulfilment setup and launch blockers.

It does not display legal-ID upload controls.

## 92. Seller Companion scope

Seller Companion may show onboarding/readiness status or deep-link to required actions, but full Seller setup/social connection administration remains Console-first unless a specific Mobile capability is deliberately implemented. Surface authorization remains enforced by the backend.

## 93. Operator Console integration

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

The Console exposes only scoped social challenge review, minimal evidence and formal policy exceptions where supported. A Seller OWNER/ADMIN ordinary session cannot use these endpoints. Capability revocation is checked on the next sensitive read or decision; every review records actual Operator Account and case/purpose.

## 94. Official social-page access security

Credentials for the official Adulis TikTok/Instagram marketing accounts must not be shared broadly among ordinary Seller-support staff. Access is a privileged operational asset with MFA/provider security, least privilege and documented recovery. Compromise triggers security incident response and suspension of DM fallback verification until trust is restored.

## 95. Catalogue/Media integration

Seller social-account connection may be reusable by Catalogue/Media for approved TikTok Product Post embed ownership verification, but the two decisions remain distinct: Seller admission proves Seller social control/presence; video embed authorization proves a specific video belongs to the linked TikTok account.

Instagram is not a current Product video embed path unless the Catalogue policy changes.

## 96. Payments integration

Adulis Seller admission requires no Government ID, legal-ID upload or selfie-to-ID flow. A PSP may independently impose KYC/KYB under its contract and the activated Market. Prefer provider-hosted collection and retain only provider references, safe status and masked metadata in Finance. Any unavoidable Adulis handling requires a confirmed requirement and restricted Finance purpose, storage, access, audit, retention and deletion controls; it does not become an Onboarding ID requirement.

Publication readiness receives provider-domain status, not payment destination screenshots, Seller bank confirmation or raw KYC data. Provider payment success and settlement readiness are independent facts.

## 97. Fulfilment integration

Onboarding reads whether the Seller supports at least one valid fulfilment mode. Courier-specific pool membership, compensation, delivery requests and Handoff evidence stay inside Fulfilment/Handoff. Seller delivery/visit windows are referenced as readiness facts where needed.

## 98. Trust integration

Trust alone owns NEW, REBUILDING, ESTABLISHED and TRUSTED and its policy-versioned consequences. Generic accepted receipt is separate from stronger QR promotion evidence: qualifying final Buyer/delegate QR receipt may count under Trust policy; OTP and Manual do not automatically receive QR credit. Upstream domains expose safe method/purpose facts and never set Trust levels or promotion math.

Onboarding does not confer a Trust level or promotion. Current admission and provider readiness are separate from purchase-quality/reliability evidence.

## 99. Moderation integration

A Seller can satisfy admission and still be blocked by safety/moderation status. Publication gates recheck Seller/moderation eligibility. A social account being verified does not guarantee its content is policy-compliant.

## 100. Notification integration

Notifications may deliver social-control fallback codes, provider/onboarding reminders and readiness notices. Never include provider tokens, full sensitive evidence or internal fraud indicators in push/SMS. Notification delivery is advisory; canonical state is re-read.

## 101. Online-only system

Seller onboarding, provider Login Kit callbacks, DM fallback review, readiness evaluation and publication gating require network connectivity. There is no offline Seller verification/readiness acceptance or later synchronization path. Local UI caches are presentation only.

## 102. Primary API surface

| Endpoint | Purpose |
| --- | --- |
| POST /v1/sellers | Create DRAFT Seller idempotently. |
| GET /v1/sellers/{seller}/onboarding | Progress/projection. |
| GET /v1/sellers/{seller}/readiness | All launch blockers/resolving actions. |
| GET /v1/sellers/{seller}/eligibility | Current admission evaluation. |
| POST /v1/sellers/{seller}/eligibility/re-evaluate | Authorized explicit evaluation. |
| POST /v1/sellers/{seller}/social/{platform}/ connect | Begin Login Kit/account-link flow. |
| GET /v1/integrations/social/{platform}/callback | Provider callback handled server-side. |
| POST /v1/sellers/{seller}/social/{platform}/ fallback-challenges | Issue phone-delivered social-control code. |
| GET /v1/sellers/{seller}/social-accounts | Current linked social relationships/status. |
| DELETE /v1/sellers/{seller}/social/{platform} | Disconnect/revoke current connection when allowed. |

## 103. Operator fallback API surface

| Endpoint | Separate privileged authority |
| --- | --- |
| GET /v1/operator/social-verification/queue | OPERATOR audience + current social-verification review capability and queue scope. |
| GET /v1/operator/social-verification/{challenge} | Minimal sender/challenge evidence; purpose, case scope and audited access. |
| POST /v1/operator/social-verification/{challenge}/confirm | Record sender/code evidence match with reviewed_by_operator_account_id; request Eligibility re-evaluation. |
| POST /v1/operator/social-verification/{challenge}/reject | Structured rejection under current capability and freshness. |
| POST /v1/operator/eligibility/{seller}/exception | Only explicitly supported formal policy exception; current governance/approval and immutable audit. |

No endpoint creates an ordinary Seller participant or permits direct eligible=true. Ordinary Accounts, including Seller OWNER, are denied at the privileged identity boundary.

## 104. Social callback must not mutate eligibility directly

Provider callback writes/updates the social connection/evidence and emits an event or invokes the Eligibility application service. It must not directly set seller.eligible=true inside the integration handler.

## 105. Core data model

| Entity | Canonical responsibility |
| --- | --- |
| core.seller | Business identity, status, INDIVIDUAL/COMPANY type, one Market and optional admission_profile trait. |
| Auth-owned Seller relationship | Typed ordinary Account OWNER / TEAM relationships, role grants and exclusivity backstop. |
| core.seller_social_account | Seller-platform connection and verified-control projection. |
| onboarding.social_control_challenge | Ordinary applicant FK, separate Operator reviewer FK, attempts and minimal evidence. |
| onboarding.social_evidence_snapshot | Immutable normalized audience/presence facts and provider/config version. |
| onboarding.eligibility_policy_version | Effective Market admission and explicit optional-profile enablement. |
| onboarding.seller_eligibility_evaluation | Append-only result with evidence and policy references. |
| onboarding.readiness_projection | Optional bounded cache, never publication authority. |

## 106. Seller social account constraints

Enforce Seller+platform current-connection uniqueness according to history strategy; stable provider-account identity uniqueness where policy forbids one external account being actively claimed by multiple Sellers; and explicit status/revocation timestamps. Conflicts return privacy-safe errors.

## 107. Eligibility policy constraints

Effective ranges must not overlap for the same Market/policy key. Config activation is transactional and validated so a Market cannot accidentally have no current admission policy.

## 108. Challenge constraints

Challenge code verifier is unique enough for its purpose, single-use, expires, has bounded attempts and cannot be accepted after Seller/platform/account relation changes. Use transactional consume semantics to prevent concurrent double-verification.

## 109. No raw social passwords

Adulis never asks the Seller for TikTok/Instagram password. Login Kit redirects/account linking and official-page DM fallback are the only current social-control mechanisms described here.

## 110. No raw legal identity data

The onboarding database, logs, analytics and object storage must not contain National ID/passport scans/numbers or other legal-ID documents for the current Seller verification feature. If such data appears in an upload/support path, treat it as unintended sensitive data and follow Privacy/incident handling.

## 111. Audit trail

Append audit records for Seller creation, social connect begin/callback result, fallback challenge issue/confirm/reject, social disconnect/revocation, eligibility evaluation, policy activation, readiness-critical setup changes and privileged Operator access.

Audit records identify actor Account/Operator, Seller, surface, request ID, reason/action, policy/evidence version and timestamps without storing reusable secrets.

Typed actor attribution distinguishes ORDINARY_ACCOUNT ordinary_account_id, OPERATOR_ACCOUNT operator_account_id and SYSTEM. Never overload a generic operator_account_id or ordinary account_id with privileged identity. Review audit records effective capability, case/purpose, correlation, timestamp and governing version.

## 112. Privacy

Collect only evidence needed for admission. Do not expose competitor social relationships, provider tokens, private DM content or fraud flags. Public projections use approved Seller/social fields only. Seller B must not learn that a social account is attached to Seller A through an enumeration-friendly error.

## 113. Retention

Current social-control/evaluation history is retained according to Privacy, security and dispute requirements. Provider tokens may have a shorter lifecycle than historical verification metadata. Deleted/revoked social

connections remain historically attributable where required but are not presented as current.

## 114. Valkey role

Valkey is the only current cache/short-lived coordination datastore name. It may support rate limiting, short-lived provider state/nonce coordination, ephemeral readiness-display caches or background-work coordination with BullMQ.

Valkey is never the authority for Account identity, Seller ownership, social verification evidence, eligibility, provider settlement readiness or publication permission.

## 115. PostgreSQL remains canonical truth

Seller, current social relationship, immutable evidence references, eligibility policies/evaluations and audit records are canonical in PostgreSQL through Drizzle. Database constraints backstop application-level invariants.

## 116. Transactional outbox and BullMQ

Business changes and required event_outbox and/or job_intent commit in the same PostgreSQL transaction. The shared Eventing relay leases durable intent, creates versioned event_delivery records from its consumer registry and deterministic BullMQ jobs after commit. BullMQ on Valkey is the sole ordinary background execution engine. Delivery is at-least-once; workers re-read current canonical scope/state and use PostgreSQL uniqueness and processed-effect markers. Repair, dead-letter review and bounded reconciliation recover outages; no correctness-sensitive PostgreSQL-to-Valkey dual write is allowed.

Seller creation, social evidence, eligibility evaluation and readiness changes emit through this shared Eventing bridge. Notifications and Analytics are independent consequences; their lag cannot undo canonical eligibility. Workers re-read Market, policy and relationship before effects.

## 117. Failure - TikTok Login Kit unavailable

TikTok connection fails closed for that provider. Instagram remains usable independently. Where current policy permits, offer the official TikTok-page DM fallback. Do not mark TikTok verified merely because the callback timed out.

## 118. Failure - Instagram Login Kit unavailable

Same behavior: independent failure isolation, official Instagram-page DM fallback if enabled, and no inferred success.

## 119. Failure - official Adulis social page unavailable

Do not invent a third ungoverned verification path. Show temporary verification unavailability or allow the other supported platform if policy permits. Keep Seller DRAFT until evidence exists.

## 120. Failure - SMS delivery unavailable

The DM fallback cannot complete because the social-control code must reach the verified Seller phone. Retry through the configured SMS provider router or wait; do not display the code in a way that defeats the phone-possession check.

## 121. Failure - provider metrics unavailable after control

Account control may be verified while a required audience/business-presence fact is unavailable. Record control separately, leave eligibility NOT_SATISFIED or operationally waiting under policy, and allow a controlled evidence-review path only when policy defines it.

## 122. Failure - fallback code from wrong sender

Reject the challenge, increment/bound attempts as appropriate, record privacy-safe audit metadata and never reveal whether the intended claimed account is linked elsewhere.

## 123. Failure - duplicate callback/DM review

All provider callbacks and Operator confirm/reject commands are idempotent. Duplicate delivery of the same successful evidence cannot create duplicate current connections or multiple eligibility transitions.

## 124. Failure - eligibility config missing

Fail closed for Seller admission/publication. A missing Market policy is a configuration incident, not a reason to use a default follower threshold or admit everyone.

## 125. Failure - PSP readiness unavailable

If provider settlement readiness is required for launch and Payments cannot determine it, readiness shows a temporary/provider blocker. Onboarding does not guess ready. Existing paid Order truth remains owned by Payments.

## 126. Failure - fulfilment configuration removed

If the Seller removes the only required fulfilment mode/window before initial launch, publication readiness becomes unsatisfied. For already ACTIVE Sellers, subsequent operational consequences follow Seller/Fulfilment policy rather than silently changing historical admission.

## 127. Failure - Valkey unavailable

Rate limiting/caches may degrade to conservative PostgreSQL/application fallback or temporary denial where safety requires. The system must never fail open and mark a Seller verified/eligible because Valkey is down.

## 128. Failure - PostgreSQL unavailable

No canonical Seller creation, social verification acceptance, eligibility decision or readiness-critical mutation can commit. Return retriable service failure; do not queue an unverified local success.

## 129. Error taxonomy

Use stable codes such as SELLER_HANDLE_TAKEN, ELIGIBILITY_NOT_SATISFIED, SOCIAL_CONNECTION_REQUIRED, SOCIAL_PROVIDER_UNAVAILABLE, SOCIAL_CALLBACK_INVALID, SOCIAL_CONTROL_CHALLENGE_EXPIRED, SOCIAL_CONTROL_SENDER_MISMATCH, SOCIAL_EVIDENCE_UNAVAILABLE, CREATOR_SELLING_STATUS_REQUIRED, PSP_ONBOARDING_REQUIRED and FULFILMENT_CONFIG_REQUIRED.

Map them to consistent HTTP semantics without revealing another Seller existence/relationship.

## 130. Security model

Threats include OAuth/account-link CSRF, provider callback forgery, challenge interception/replay, phishing with fake Adulis social accounts, social-account takeover, Operator collusion/mistake, cross-Seller IDOR, enumeration, provider-token leakage and policy misconfiguration.

Controls combine session-bound initiation, provider validation, short-lived single-use challenges, official-account configuration, Step-Up/Operator grants, audit, rate limits, RLS/scope checks and secret redaction.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

External social callbacks validate server state, PKCE where applicable, signed nonce, expiry, CSRF and replay rules for each independent adapter. The official-page DM code remains distinct from login and Step-Up secrets.

## 131. Operator abuse protection

Privileged reviewers authenticate with separate Operator credentials and current capability. Enforce queue/case scope, access purpose, freshness, evidence minimization, required governance and immutable audit. Ordinary Seller OWNER/ADMIN roles provide no privileged access. No impersonation or universal eligibility setter exists.

## 132. Seller Console security

Console hides unavailable actions for usability but server authorization is mandatory. Never trust client-provided Seller ID without verifying relationship/scope, client-provided platform account ID as proof, or callback query parameters as eligibility truth.

## 133. Analytics

Record minimal onboarding funnels, adapter outcomes, readiness reason categories and versioned Market/profile labels. ordinary account_id identifies the ordinary human only; Operator evidence stays in typed privileged audit or safe aggregate operations telemetry. No DM body, code, phone, social token, Government ID or raw provider KYC is analytics payload.

## 134. Primary onboarding metrics

| Metric | Definition boundary |
| --- | --- |
| Seller creation / publication conversion | Canonical Seller and publication facts under exact Market and policy version. |
| Social control success / failure | Separate TikTok, Instagram and DM evidence outcomes; no eligibility inference from client completion. |
| Eligibility / readiness blockers | Current versioned reason categories, distinct from wizard progress. |
| Creator-profile conversion | Only policy-enabled profile cohorts; disabled profile has no active admission funnel. |
| Provider action readiness | Safe Finance status categories, without KYC data. |
| Review latency / replay / abuse | Privileged evidence outcome aggregates without ordinary identity overload. |

## 135. Observability

Use Sentry for errors/traces with strict secret scrubbing, Pino structured logs, pg_stat_statements for database diagnosis, provider-adapter health metrics, BullMQ job telemetry and Valkey health.

Monitor Login Kit callback failure, state/nonce rejection, fallback challenge issue/consume rate, Operator queue age, eligibility evaluation latency, policy-version errors, readiness latency and cross-Seller authorization denials.

## 136. Logging redaction

Never log social-control code plaintext, provider access/refresh tokens, ordinary login OTP, session token, full phone, private DM content or unneeded provider payloads. Log stable challenge/account/Seller refs and reason codes instead.

## 137. Technology baseline

| Layer | Current implementation and authority |
| --- | --- |
| API / runtime | Node.js; NestJS + Fastify; strict TypeScript; REST/OpenAPI with @nestjs/swagger and generated TypeScript clients; @nestjs/throttler, @fastify/helmet and libphonenumber-js. |
| Canonical data | PostgreSQL + Drizzle; pg_trgm, btree_gist and pg_stat_statements; owner repositories, typed FKs, legal transitions and transactional outbox/job_intent. |
| Async / coordination | BullMQ on Valkey as the sole ordinary background engine; committed PostgreSQL intent, deterministic execution IDs, current-state revalidation and database idempotency. |
| Media | Cloudflare R2 + CDN and Sharp for image processing. Restricted evidence bytes use private, purpose-bound access. Native video is deferred from the photo-first discovery baseline. |
| Mobile | React Native + Expo; Expo Router, TanStack Query, FlashList, Expo Image, SecureStore, SQLite, Camera, Notifications and Updates; small Zustand UI stores. SQLite never establishes offline commerce acceptance. |
| Quality / operations | Jest, Testcontainers, Maestro, Playwright and k6; Sentry, Pino and database query diagnostics; dependency-cruiser; Docker, GitHub Actions, Render, Cloudflare and EAS. |

## 138. Technology placement notes

Expo SQLite may remain part of the wider Mobile stack but Seller onboarding has no offline business-state feature. Cloudflare R2/Sharp are not identity-document storage in this design; normal Seller/product media is

owned by Media/Catalogue. Social provider secrets/tokens belong to restricted integration credentials, not public configuration.

## 139. Module structure

```
adulis-platform/
  apps/api/src/modules/
    auth/
    seller/
    onboarding/
      seller-onboarding/
      eligibility/
      social-verification/
      readiness/
      policy/
    payments/
    fulfilment/
    catalogue/
    trust/
    moderation/
  apps/worker/src/jobs/onboarding/
  packages/
    api-contracts/
    schemas/
    permission-catalogue/
    analytics-events/
```

```
Seller Console + Mobile consume generated contracts.
Do not create a separate onboarding microservice for MVP.
```

## 140. Cross-module contracts

Onboarding reads Auth ActorContext, Seller ownership/status, Payments provider-onboarding status, Fulfilment configuration, Catalogue Product existence/publication result, Trust starting-state interface and Moderation status through public contracts. dependency-cruiser blocks private repository imports across domains.

## 141. Domain events

| Event family | Owner fact / safe consumer semantics |
| --- | --- |
| seller.created | Atomic Seller + OWNER relationship + Market creation. |
| seller.social_connection.verified / seller.social_connection.revoked | Recorded supported social-control evidence or current revocation. |
| seller.eligibility.evaluated / seller.eligibility.satisfied | Eligibility-owned result with policy/evidence references, including explicit optional-profile state. |
| seller.readiness.changed | Readiness observation, not permission to publish from stale event. |
| seller.onboarding.completed | Legal current setup completion; publication still validates fresh canonical facts. |

Business changes and required event_outbox and/or job_intent commit in the same PostgreSQL transaction. The shared Eventing relay leases durable intent, creates versioned event_delivery records from its consumer registry and deterministic BullMQ jobs after commit. BullMQ on Valkey is the sole ordinary background execution engine. Delivery is at-least-once; workers re-read current canonical scope/state and use PostgreSQL uniqueness and processed-effect markers. Repair, dead-letter review and bounded reconciliation recover outages; no correctness-sensitive PostgreSQL-to-Valkey dual write is allowed.

Registered envelopes use market_id, source owner, schema/policy version, correlation and typed actor attribution ORDINARY_ACCOUNT / OPERATOR_ACCOUNT / SYSTEM with distinct FK/reference fields. Consumers are idempotent; new actor semantics require a registered version. No codes, tokens, DM body, Government ID or raw KYC is emitted.

All exact event names/versions and schemas are supplied in the authoritative registry linked from EVT §35. These committed observations do not authorize publication, provider settlement or optional social API access; consumers re-read current owner gates. Actual G01/G03 permissions stay pending.

## 142. Test - Seller creation

Authenticated Account creates Seller twice with the same idempotency key. Exactly one Seller/OWNER relationship exists; response is stable.

## 143. Test - TikTok Login Kit

Start from authenticated Seller context -> callback with valid provider state/account -> current TikTok social relationship verified -> evidence snapshot created -> eligibility re-evaluated. No new Adulis login session is created by the provider callback.

## 144. Test - Instagram Login Kit

Same provider-isolated behavior for Instagram. A TikTok outage does not break Instagram connection.

## 145. Test - social account-link CSRF

Callback state/nonce not issued for the current Seller/session or already consumed -> reject; no social relationship/evidence mutation.

## 146. Test - wrong provider account

Client submits a different provider_account_id/handle than the server-validated callback identity -> server uses provider-validated identity and rejects conflicting client claims.

## 147. Test - DM fallback success

Login Kit unavailable -> authenticated Seller requests fallback -> dedicated social-control code delivered to verified phone -> DM arrives from the claimed account to configured official Adulis account -> authorized Operator confirms -> control evidence written -> challenge consumed once.

## 148. Test - login OTP reuse prohibited

The ordinary Adulis authentication OTP can never satisfy a social-control challenge. A social-control code can never authenticate a session or satisfy Step-Up.

## 149. Test - DM from wrong account

Correct code arrives from a different social sender -> reject SOCIAL_CONTROL_SENDER_MISMATCH; do not verify claimed account.

## 150. Test - expired/replayed fallback code

Expired or already-consumed social-control code -> reject; no current social verification. Concurrent confirm attempts produce exactly one successful consume.

## 151. Test - no legal-ID surface

Seller Console/Mobile/API schemas contain no National ID/passport/legal-ID upload requirement for Seller verification. Attempted obsolete ID-upload endpoint is absent/404 or explicitly unsupported.

## 152. Test - Audience Path current policy

Verify the current Market’s social-commerce Audience policy independently checks social control and established presence; unsupported, stale or incomplete evidence cannot satisfy it. Optional Creator rules run only when explicitly enabled. No hard-coded follower threshold replaces policy.

## 153. Test - Identity Path deferred

Attempt to select/use IDENTITY_PATH under current policy cannot satisfy admission. It does not fall back to fake Operator attestation or legal-ID upload.

## 154. Test - explicit Creator admission profile

An enabled Creator admission trait must satisfy versioned social and legitimate-selling evidence without becoming CREATOR Seller/Account type. Disabled Market/Product profile rejects the path and hides its UI while preserving compatible optional metadata. No Government-ID, licence or incorporation requirement appears by implication.

## 155. Test - follower threshold configuration

Where policy threshold is NULL, no numeric follower threshold is applied. Where a threshold/basis is configured, use verified evidence and exact versioned rule; do not sum platforms unless configured.

## 156. Test - waitlist claim isolation

Self-reported waitlist audience count differs from provider-verified evidence. Admission uses verified evidence only.

## 157. Test - order-anytime semantics

Seller physical store is closed at 02:00 but Seller/Product/Checkout are otherwise available. Buyer may place Order. Delivery/collection UI selects a Seller-configured future window; generic Active Hours does not block Checkout.

## 158. Test - delivery/store-visit windows

Enabled Buyer Collection/Seller Delivery/Courier Delivery that requires physical scheduling uses the Seller-configured relevant window. Ordering remains open outside the window.

## 159. Test - PSP readiness

If current PSP/Market requires Seller provider onboarding and Payments reports REQUIRES_ACTION, readiness blocks with provider resolving action. Onboarding cannot mark provider ready locally.

## 160. Test - stale readiness

Readiness true -> social connection revoked or fulfilment removed -> Seller presses Publish -> server re-evaluates current facts and publication fails safely.

## 161. Test - cross-Seller isolation

OWNER/team member of Seller A substitutes Seller B in social/readiness endpoints -> deny with disclosure-safe semantics.

## 162. Test - Valkey outage

Canonical PostgreSQL-backed decisions remain correct or safely unavailable; no Seller becomes verified/eligible because cache/rate-limit state disappeared.

## 163. Load and capacity tests

Use k6 for Seller creation/readiness/eligibility reads and controlled callback bursts. Simulate provider retries and onboarding launch spikes. Bound external provider concurrency and retry policies so one viral onboarding cohort cannot exhaust API/worker/database capacity.

## 164. Production launch gates

• TikTok and Instagram provider connections have state/nonce/replay protection and secret redaction.

• Official-page DM fallback uses a distinct social-control code, not login OTP.

• Official account identifiers are configured and anti-phishing copy is approved.

• No legal-ID upload/storage/KYC attestation path exists in current Seller verification.

• Current Market policy enforces social-commerce admission and evaluates Creator selling evidence only when explicitly enabled.

• IDENTITY_PATH is architecturally retained but cannot satisfy current policy.

• PSP settlement readiness comes from Payments/provider status.

• Ordering-hours semantics are separated from delivery/store-visit windows.

• Valkey is never authoritative.

• Cross-Seller authorization/RLS tests pass.

• All critical callbacks/Operator commands are idempotent and audited.

• Sentry/Pino/analytics scrub OTPs, provider tokens, phones and private DM content.

Require separate Operator Account endpoint isolation, typed reviewer FK/audit, no legal-ID UI/API/storage, inactive IDENTITY_PATH, provider-hosted KYC with safe readiness, policy-disabled Creator path, explicit Market activation, Product-without-Scene readiness and shared outbox/relay crash recovery.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 165. Implementation sequence

```
PHASE 0 migrate/remove obsolete legal-ID attestation surfaces and legacy cache naming
PHASE 1 Seller create + DRAFT/OWNER + Market policy versioning
PHASE 2 TikTok/Instagram Login Kit adapter contracts + secure callbacks
PHASE 3 official-account DM fallback + phone-delivered social-control code + Operator review
PHASE 4 social evidence snapshots + current social-commerce eligibility evaluator
PHASE 5 optional explicitly enabled Creator selling-evidence policy + reason catalogue
PHASE 6 provider-aware readiness + fulfilment windows + first Product Post
PHASE 7 Console/Mobile/Operator UX + notifications
PHASE 8 Trust/Moderation/Catalogue integration + analytics/observability
PHASE 9 concurrency, cross-tenant, provider-failure, privacy and load hardening
```

Deliver typed ordinary/Operator guards and Auth-owned creation unit of work first; keep optional Creator profile disabled unless ratified; deploy Market versions and safe Finance readiness; exercise current social/DM and role regressions before publication.

## 166. Migration from v1.0

Remove active identity-attestation document fields/workflows, HMAC legal-ID duplicate detection, future-KYC assumptions presented as current functionality, IDENTITY_VERIFIED launch blocker, legacy cache references, direct Payment Account readiness semantics and generic Active Hours logic.

Preserve Seller creation, Market-versioned eligibility, immutable evaluation history, social evidence versioning, waitlist separation, freshness on publication and domain ownership principles that remain valid.

Preserve immutable social and eligibility history. Replace ambiguous privileged reviewer references through an explicit typed mapping or quarantine unresolved legacy references; never treat old ordinary role IDs as privileged accounts. Current path enablement is re-evaluated without retroactively rewriting evidence.

## 167. Hard invariants

ONB-INV-01 Ordinary Adulis login/session authority is separate from TikTok/Instagram social account control.

ONB-INV-02 Current admission requires the effective social-commerce Audience policy; IDENTITY_PATH cannot silently satisfy launch policy.

ONB-INV-03 When explicitly enabled, the Creator admission profile must satisfy its configured legitimate-selling rule in addition to social presence.

ONB-INV-04 No National ID/passport/legal-ID document is collected for Seller verification in this release.

ONB-INV-05 Login Kit/provider callback identity is verified server-side; client claims are never proof.

ONB-INV-06 DM fallback code is purpose-bound, single-use, short-lived and distinct from login/Step-Up OTP.

ONB-INV-07 Operator fallback records evidence; it does not directly author eligibility truth.

ONB-INV-08 Historical social/evaluation evidence is immutable and versioned.

ONB-INV-09 Ordering is not closed by Seller physical operating windows; delivery/store visits obey Seller-set windows.

ONB-INV-10 PSP/provider readiness is owned by Payments.

ONB-INV-11 Valkey is non-authoritative.

ONB-INV-12 Publication rechecks current readiness server-side.

ONB-INV-13 Social verification does not imply legal identity, licence, product authenticity or Trust Level.

ONB-INV-14 Cross-Seller scope and authorization are enforced on every Seller-scoped request.

ONB-INV-15 Seller onboarding/verification is online-only.

• ONB-INV-16 One ordinary Account may hold Buyer/Seller/Courier relationships without identity duplication.

• ONB-INV-17 Seller OWNER is a relationship, not an Account type.

• ONB-INV-18 Internal manual review authority requires a separate Operator Account.

• ONB-INV-19 Provider KYC never becomes Adulis Seller legal-ID verification by implication.

• ONB-INV-20 Creator is an admission trait/profile, not a separate Account or Seller type.

• ONB-INV-21 Creator-specific admission is activated only by explicit Market/Product policy.

• ONB-INV-22 Ethiopia is initially active; future Market rules require explicit activation.

• ONB-INV-23 Product Post readiness and Scene Post creation remain separate concerns.

• ONB-INV-24 Async consequences use canonical transactional-outbox/Eventing infrastructure.

## 168. Final System Architecture

![Social account control and video capability need separate evidence](graphics/ONB_02.svg)
*Figure 02. Social account control and video capability need separate evidence. DM control grants no OAuth/video permission. Actual provider permissions remain activation gates.*

Ordinary Seller owner/team capabilities reach social control, policy evaluation and current readiness through owner contracts. Separate Operator review records evidence only. Catalogue, Finance and Fulfilment remain canonical readiness readers; Content owns independent Scene creation.

## 169. Final engineering doctrine

Adulis admits Sellers only through claims it can substantiate: verified TikTok/Instagram account control, versioned social-business admission evidence, and legitimate selling/business evidence for an explicitly enabled Creator profile. Current Seller

verification collects no legal identity document, physical-store hours never shut down all-day ordering, and cache/provider/browser state never becomes canonical authority.

IDENTITY_PATH remains a future-compatible policy slot only; activating it requires an explicit approved verification method, privacy controls, policy version and tests.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Internal privileged actions require a separate, internally provisioned Operator Account with independent credentials, OPERATOR session/audience, recovery, revocation and audit. Every action checks current capability, exact case/resource scope, purpose and required authentication freshness and governance approval. An ordinary Account role or mode switch cannot become an Operator Account; no party impersonation is permitted.

Adulis Seller admission requires no Government ID, legal-ID upload or selfie-to-ID flow. A PSP may independently impose KYC/KYB under its contract and the activated Market. Prefer provider-hosted collection and retain only provider references, safe status and masked metadata in Finance. Any unavoidable Adulis handling requires a confirmed requirement and restricted Finance purpose, storage, access, audit, retention and deletion controls; it does not become an Onboarding ID requirement.

Optional Creator admission is policy-gated, and the activated Seller Market is explicit. The role appendix remains current authorization guidance rather than a second identity model.

## 170. Role-authorization reconciliation appendix

This appendix incorporates the attached Role-Authorization & Current-Architecture Reconciliation Knowledge Base without changing unrelated onboarding architecture. Authentication/Authorization owns who may act; Onboarding/Eligibility/Verification owns whether the requested transition is domain-valid.

This v3.0 edition integrates the role appendix with the ordinary Account model, separate Operator evidence review, safe provider readiness and explicit optional admission profiles.

## 171. Seller creation and relationship model - authorization reconciliation

Creating a Seller binds the new Seller to the authenticated Account through the canonical OWNER relationship. It must not create a Seller-specific password, second login or account-level seller_id/seller_role field.

Preserve the current identity doctrine: one Account may simultaneously be a Buyer, own one or more Sellers where policy permits, hold one Seller-team membership during MVP, and maintain Courier relationships. The MVP team exclusivity rule applies only to non-terminal Seller TEAM memberships.

The bootstrap actor is the ordinary human Account. Create DRAFT Seller + OWNER + Market + outbox atomically through Auth’s owning facade. TEAM exclusivity does not apply to ownership and remains Auth’s canonical responsibility.

## 172. Role participation during Seller setup

| Role / relationship | Current onboarding responsibility |
| --- | --- |
| OWNER | May resolve all Seller-facing onboarding/setup actions for which Seller authority exists; Owner-only controls remain protected. |
| ADMIN | May resolve ordinary delegated Seller configuration/setup actions except Owner-only control or legally/business-significant changes. |
| INVENTORY | May resolve permitted operational readiness, especially FULFILMENT CONFIG and AT LEAST ONE PRODUCT. |
| SALES_SUPPORT | No general onboarding configuration authority. |
| ANALYST | Read-only where a bounded status view is useful; no onboarding mutation. |
| CAMPAIGN_MANAGER | No core onboarding mutation; content/discovery responsibility does not imply eligibility or Store-setup control. |

## 173. Store profile authorization

OWNER and ADMIN may manage the core Seller Store profile when their current permissions allow it. INVENTORY may receive only the fulfilment-related operational configuration subset genuinely required for its job.

SALES_SUPPORT, ANALYST and CAMPAIGN_MANAGER do not receive core Store-profile mutation authority merely because they participate in Seller operations. Branding/content work must not be confused with authority to alter Seller identity or business profile.

## 174. Seller type / entity-type authorization

INDIVIDUAL <-> COMPANY is structurally significant. After commerce has begun or the Seller has reached a state where the change affects historical/business meaning, entity-type change is OWNER-controlled, CONSOLE-only and Step-Up protected, with domain review/migration conditions.

ADMIN may assist during early DRAFT correction only where explicit product policy permits. ADMIN must not independently change the Seller entity type after active commerce. Specialist roles have no entity-type mutation authority.

Creator admission_profile is separate from entity type. Significant post-commerce INDIVIDUAL/COMPANY change remains Owner-only in Seller Console with required Step-Up and domain migration/re-evaluation.

## 175. Company representative authorization

Company representative/contact information may be part of Company Seller setup, but the current architecture does not perform National-ID/passport/legal-ID attestation. Changing the representative after launch remains high-risk because it changes who represents the business operationally.

Current authority is OWNER + CONSOLE + Step-Up + readiness re-evaluation. ADMIN may maintain ordinary non-control company metadata where permitted but cannot independently replace the representative after active commerce. If a future IDENTITY_PATH introduces formal verification, the verification evidence must remain outside Seller self-assertion and follow the then-approved Operator/provider boundary.

## 176. Social-account control authorization

OWNER and ADMIN may initiate allowed TikTok/Instagram linking, Login Kit connection, fallback verification challenge, re-verification and disconnection when their Auth permissions allow it.

SALES_SUPPORT, INVENTORY, ANALYST and CAMPAIGN_MANAGER do not receive social-account-control authority by default. CAMPAIGN_MANAGER content responsibilities do not grant control of the external social identities used for Seller admission.

Seller-facing OWNER/ADMIN workflow authority is ordinary relationship scope. Reviewing official-page evidence is a distinct separate Operator Account capability; successful evidence does not bypass policy.

## 177. Publication Readiness authorization model

There is one canonical server-authoritative readiness state for the Seller. Roles do not receive separate readiness truth; they differ only in whether they are authorized to resolve a blocker.

The backend returns all blockers. Clients map each blocker to a resolving action only when Auth says the current Account/relationship/role-set/surface may perform that action.

Readiness never requires Scene publication or raw provider KYC. Catalogue and Finance canonical statuses are re-read by the server, with Creator-specific evidence evaluated only when enabled.

## 178. Readiness responsibility matrix

| Readiness concern | Who may resolve in current model |
| --- | --- |
| ACCOUNT_CREATED | OWNER relationship is established by Seller creation; others do not resolve it. |
| SELLER_TYPE_DECLARED | OWNER; ADMIN only for explicitly allowed early-DRAFT assistance. Later significant changes are Owner-only. |
| ELIGIBILITY_SATISFIED | OWNER or ADMIN may operate the Seller-facing workflow; specialist roles do not mutate eligibility evidence/policy. |
| COMPANY_DETAILS | OWNER; ADMIN for ordinary permitted metadata; representative/control changes remain Owner-only. |
| STORE_PROFILE | OWNER / ADMIN; INVENTORY only the explicitly granted fulfilment subset. |
| PROVIDER_SETTLEMENT_READY | OWNER; ADMIN only when delegated by current Payments/Auth policy; specialist roles do not configure PSP/provider settings. |
| FULFILMENT_CONFIG | OWNER / ADMIN / INVENTORY where the corresponding fulfilment permission is granted. |
| AT_LEAST_ONE_PRODUCT | OWNER / ADMIN / INVENTORY may create/manage Product Posts under Catalogue/Auth rules. |

## 179. Seller Console and Seller Companion authorization

Seller Console remains the primary create/configure/administer surface. Sensitive setup actions stay Console-first. Seller Companion consumes the same readiness API; it is not a second onboarding authority.

OWNER/ADMIN Mobile may see setup status and basic operational blockers. INVENTORY Mobile may see fulfilment/Product blockers relevant to its role. SALES_SUPPORT/ANALYST/CAMPAIGN_MANAGER Mobile must not gain onboarding controls merely because the Account has a Seller relationship. Surface restrictions are enforced by Auth, not frontend hiding.

## 180. Seller closure / deletion initiation authority

Seller closure initiation is OWNER-only, CONSOLE-only and Step-Up protected, subject to Seller lifecycle/domain validation. ADMIN cannot initiate Seller closure.

Authorization decides whether the Account may request closure; Seller lifecycle decides whether the transition is domain-valid; Privacy/Retention decides deletion, anonymization and evidence retention. Onboarding must not merge those responsibilities.

## 181. Payment readiness authorization boundary

Onboarding asks Payments only whether the Seller setup required by the current Market/PSP model is satisfied. It never implements provider business logic or reads protected provider credentials.

OWNER may resolve Seller-facing payment/provider onboarding. ADMIN may do so only where current Auth/Payments policy delegates it. Specialist roles do not configure settlement/provider settings. If a legacy PAYOUT_DETAILS wire code still exists elsewhere, its semantics must be interpreted through the current PSP/provider readiness contract rather than direct bank-payment assumptions.

Only safe provider-domain readiness is returned. Provider-required KYC can remain hosted externally; no Government-ID document moves into the Onboarding schema or role matrix.

## 182. Seller-team exclusivity and permission-catalogue boundary

Onboarding does not enforce the team-membership limit; Auth/Authorization owns that invariant. Current MVP policy allows at most one non-terminal Seller TEAM membership per Account, while ownership and Courier relationships remain separate.

Every Seller-scoped onboarding/readiness request still requires explicit Seller context and cross-tenant scope enforcement. Onboarding never depends on historical permission counts or duplicates the executable Seller permission seed; it asks Auth whether the current Account has the required permission for the target Seller, action and surface.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Ownership is separate from TEAM membership; Courier relationships do not consume that limit. Multiple roles union permissions within one membership, subject to current Seller, surface, resource and domain constraints. Different humans use different Accounts.

Auth owns exclusivity, membership revocation and multi-role union. INVENTORY can perform permitted Product/fulfilment work; SALES_SUPPORT is support-only; ANALYST read-only; CAMPAIGN_MANAGER content-only. None of these roles confers eligibility, privileged review or payment-provider settings by implication.

## 183. Role-authorization regression tests

• OWNER core profile update succeeds; ADMIN ordinary profile update succeeds; specialist core-profile mutations fail.

• INVENTORY can resolve permitted Product and fulfilment readiness but cannot resolve eligibility, representative changes or payment-provider configuration.

• SALES_SUPPORT, ANALYST and CAMPAIGN_MANAGER cannot mutate core onboarding state.

• OWNER/ADMIN may operate allowed social-account control; specialist roles cannot.

• Post-commerce ADMIN entity-type change fails; OWNER requires Console + Step-Up + domain re-evaluation.

• ADMIN Seller-closure attempt fails; OWNER request still requires Step-Up and lifecycle validation.

• Readiness consumes PSP-domain status; clients cannot declare payment/provider setup complete.

• Changing seller_id/context cannot expose another Seller readiness, eligibility, company details or social-verification state.

• Multi-role membership permissions are unioned by Auth, but surface/scope/domain constraints still deny forbidden operations.

### Required canonical identity and admission regressions

| Test | Expected result |
| --- | --- |
| ONB-CANON-01 | Seller creation establishes ordinary Account OWNER, not a Seller Account identity. |
| ONB-CANON-02 | The same human can remain Buyer/Courier elsewhere. |
| ONB-CANON-03 | TEAM exclusivity remains Auth-owned and excludes ownership/Courier relationships. |
| ONB-CANON-04 | Government-ID APIs, UI and storage are absent. |
| ONB-CANON-05 | IDENTITY_PATH cannot satisfy launch admission. |
| ONB-CANON-06 | Provider KYC readiness can be required while Adulis stores no Government ID. |
| ONB-CANON-07 | DM reviewer authenticates with separate Operator Account. |
| ONB-CANON-08 | Ordinary Seller OWNER cannot call privileged review. |
| ONB-CANON-09 | Evidence match requests policy re-evaluation, not manual eligible=true. |
| ONB-CANON-10 | Creator trait never creates CREATOR Seller type. |
| ONB-CANON-11 | Market/Product can disable Creator path without schema redesign. |
| ONB-CANON-12 | Ethiopia policy never silently applies globally. |
| ONB-CANON-13 | Product readiness succeeds without Scene publication. |
| ONB-CANON-14 | Valkey loss does not change canonical eligibility. |

## 184. Appendix - Social Capability Evidence & Failure Matrix

Social capabilities are per-provider/account type, API version and approval, not a generic Login Kit promise. TikTok Login/account control is distinct from approved Display API v2 video ownership using an authorized video.list token; provider stable identity, callback state/replay, minimal fields and revoke/recheck lifecycle are recorded. Instagram Login supports professional Business/Creator accounts; unsupported consumer accounts use a separately valid approved admission path, not invented API access. Exact live app products/scopes/version/evidence fields and approval refs remain unconfirmed until verified.

Official-page DM proves approved selected account-control evidence only; it grants no OAuth scope, video query/ownership capability or provider approval. Keep TikTok videos external and Product-only. Ownership-dependent embeds require actual approved supported account/token/scopes and current wrong-owner/private/deleted/revoked checks; fail closed to safe placeholder/link without breaking an independent valid admission path. No TikTok native FYP/Scene video, password/inbox harvesting or session creation.

| Provider capability | Published scope / actual activation evidence |
| --- | --- |
| TikTok account control | Login Kit callback + provider stable identity; actual products/scopes/account field mapping NOT CONFIRMED. |
| TikTok video ownership | Display API v2 /v2/video/query/ with authorized video.list token; query belongs-to-user check; app/user approvals and account mapping OPEN. |
| Instagram Login | Professional Business/Creator account support; unsupported consumer account not implied. Actual API/version/scopes/identity fields/approval OPEN. |
| Official-page DM | Minimal sender/challenge matched by separate Operator under policy; control evidence only, no OAuth/video permission. |
| Tokens / revoke / rename | Protected minimal tokens; revocation/expiry re-check; stable ID anchors handle changes; wrong account/callback fails closed. |
| Unavailable/private/deleted/wrong-owner video | Suppress embed; Product images and independent valid admission path remain usable. |

Provider reference: https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query and Meta’s official Instagram Login collection https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login (checked 12 October 2026). Exact deployed integration versions/scopes and permissions must be recorded before activation; no arbitrary fields or credentials invented.

## 185. Glossary

| Term | Meaning in this design |
| --- | --- |
| Ordinary Account | One human identity with Buyer, Seller and Courier acting relationships. |
| Operator Account | Separate internally provisioned privileged identity with current scoped capability. |
| Canonical owner | Domain whose legal command and PostgreSQL state establish the fact. |
| Market | Explicit activated commerce jurisdiction/configuration and effective version. |
| Scene Post | Photo merchandising/discovery content with separate publication and visibility. |
| event_outbox / job_intent | Required committed fact/effect intent persisted atomically with business truth. |
| BullMQ / Valkey | Ordinary async execution and non-canonical queue/cache infrastructure. |
| Social control | Recorded supported social-account control, distinct from established presence. |
| Admission profile | Optional policy-gated trait; not a Seller or Account type. |
| Readiness | Fresh server decision from current owner facts before publication. |
