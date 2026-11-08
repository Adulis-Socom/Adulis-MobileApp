# Adulis Authentication & Authorization
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R02. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-AUTH-02_Adulis_Authentication_Authorization_Layer_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. System mission

Authentication identifies the security principal controlling a credential. Ordinary authentication resolves an immutable Adulis Account; privileged authentication resolves a distinct internal Operator Account. Authorization evaluates that principal against the exact action/resource, relationship/capability, surface, scope, freshness, state and domain invariants.

A valid login never implies business authority. Ordinary Buyer/Seller/Courier relationships and Operator capabilities are evaluated through separate typed authorization paths.

## 2. Core authorization principle

Every protected command is decided from server-owned facts. Client-supplied role names, Account IDs, Seller IDs without scope validation, payment success claims, or UI visibility are never authorization evidence.

A person may be logged in and still be unauthorized. Adulis must prove the relationship and permission for the target resource on every protected path.

## 3. Ordinary Account Relationships and Separate Operator Principal

One ordinary Account supports Buyer capability, Seller ownership, one non-terminal Seller team membership with multiple roles, and one persistent Courier profile with many Seller pool relationships. Operator is outside this tree and cannot be added as a public Account grant.

A person may hold both ordinary and Operator Accounts, but compromise, recovery, suspension or deletion of the personal ordinary Account does not grant/recover/impersonate the privileged identity.

![Explicit anonymous, ordinary, privileged and trusted service contexts](graphics/AUTH_01.svg)
*Figure 01. Explicit anonymous, ordinary, privileged and trusted service contexts. Modes change acting relationships, not identity; separate Operator and delegate receipt boundaries remain.*

## 4. Stable identity principle

Business-domain foreign keys reference immutable Account identifiers, never a phone number, social handle or SMS provider identity. Phone is a credential/identifier; changing it does not transfer Orders, Claims, Reviews, Seller relationships or Courier history.

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

## 5. Anonymous Buyer and durable-identity boundary

Authentication is not required at installation. Anonymous Buyers may browse image-only Scene FYP, Marketplace Search Product/Seller/PUBLIC Scene projections, Shop/Product detail and public Seller Storefront according to product policy.

Account-bound checkout/Order creation, persistent Collections, Buyer-Seller Chat, Claims, Reviews and Handoff require current authenticated or narrowly designated-recipient authority. Temporary anonymous cart UX never creates canonical paid commerce.

## 6. Application modes do not create identities

The Adulis Mobile App has Buyer, Seller Companion and Courier modes. Switching modes does not create a new Account or re-run ordinary authentication. The same MOBILE session is re-evaluated against the relationships required by the selected mode.

Seller Companion requires an ownership or usable team relationship. Courier Mode requires an eligible Courier profile/capability. Buyer Mode remains available unless separately restricted by platform policy.

## 7. Authentication actors

• Ordinary Buyers and anonymous-to-authenticated Buyers.

• Seller owners and Seller team members.

• Couriers using their own independent Adulis Account.

• Operators using their separate internal Operator Account, strong credential and OPERATOR session.

## 8. Authoritative systems

PostgreSQL is canonical for Accounts, sessions, membership relationships, roles, permission grants, separate Operator Accounts, credentials, capability assignments and privileged sessions, recovery and security state. Valkey may accelerate bounded lookups, rate limiting or coordination but never becomes the sole source of authentication or authorization truth.

## 9. Online authority

Protected authentication and authorization actions require connectivity to the Adulis backend. A client may display cached non-sensitive presentation state, but it must not mint sessions, accept role changes, complete step-up, activate team membership, accept Courier work or execute protected commerce from device-only state.

## 10. Market and locale separation

Authentication provider routing is Market-aware. Market availability is an Adulis product decision, not inferred merely because an SMS provider supports a country. Locale affects language; Market controls provider, policy and operational availability.

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

## 11. Absolute time semantics

Security timestamps are stored as timezone-aware instants and exchanged as ISO 8601 UTC values. User-facing time can render in the relevant Market timezone. Device time is not authoritative for OTP expiry, session expiry, step-up freshness or membership transitions.

## 12. Domain ownership boundaries

• Auth owns identity, credentials, sessions, membership authorization primitives, role/permission resolution, step-up and recovery.

• Order owns Order lifecycle; Payments owns provider-verified payment truth.

• Fulfilment owns Seller-Courier relationships/assignments; Handoff owns verification evidence.

• Trust, Claims, Reviews, Moderation, Billing/entitlements and Privacy remain authoritative for their own rules.

• Auth evaluates permissions; it does not rewrite canonical domain state.

PART II - ORDINARY AUTHENTICATION

CHAT_ATTACHMENT is a PRIVATE Media purpose bound to typed conversation_id, pending_message/send intent, eventual immutable message_id and sender ordinary_account_id. Chat verifies current participant/exact Seller-team permission on upload, completion, bind and every new read. Upload grants/object keys stay private; READY is technical only. One upload-completion/send identity attaches once; cross-conversation rebinding and public PRODUCT_GALLERY delivery are forbidden. Reuse bounded approved image processing/limits; abandoned grants expire under approved policy. No new numeric limits or native video.

Delegate authority is receipt-only, including Collection; no Buyer rights transfer.

## 13. Ordinary MVP authentication

Phone OTP remains the ordinary MVP authentication mechanism. Adulis generates and verifies the challenge itself; SMS providers transport the message only.

## 14. Phone normalization and PHONE_KEY

Normalize numbers with libphonenumber-js and store a canonical E.164 representation. Rate-limit and lookup keys must avoid leaking raw phone numbers into logs or cache keys; derive a privacy-safe keyed representation for rate-limit dimensions where appropriate.

## 15. OTP challenge model

Each challenge is purpose-bound and audience-bound, with a cryptographically strong random code, keyed verifier, expiry, attempt budget, resend lineage and delivery-attempt history. OTP plaintext is not persisted.

```
otp_challenge
- id / phone_key / purpose / audience
- verifier_hash or keyed verifier
- status / expires_at / failed_attempts / max_attempts
- resend_generation / created_at / verified_at
- market_id / provider-routing metadata
```

## 16. OTP parameters

• Six digits unless a versioned security decision changes format.

• Five-minute default validity for ordinary sign-in challenges.

• Five failed attempts burn the challenge by default.

• One live challenge per normalized phone + purpose + audience tuple.

• Values are configuration-driven where safe, but security tests lock intended defaults.

## 17. Constant-time verification

Credential comparison must use constant-time techniques. Attempt counters are consumed atomically so transaction rollback cannot restore a failed attempt budget.

## 18. Resend semantics

Resend creates a new challenge generation and invalidates the old code. Provider failover is different: the same challenge may be delivered through the configured backup transport when the primary delivery attempt is safely known to have failed.

## 19. Provider result taxonomy

SMS adapter results distinguish DELIVERED/ACCEPTED, FAILED, REJECTED, RATE_LIMITED, DELIVERY_UNKNOWN and provider-specific retry conditions. DELIVERY_UNKNOWN must not automatically cause a duplicate send that could deliver two live codes.

## 20. Market provider routing

Ethiopia provider routing uses Afromessage as primary and SMS Ethiopia as backup. Global-market routing uses Twilio as primary and Infobip as backup where Adulis has enabled that Market. Provider order remains configuration, not scattered application branching.

## 21. OTP request throttling

• Per PHONE_KEY, IP/risk bucket, device/session context and Market controls.

• Resend cooldown and bounded challenge creation.

• Soft and hard spend/volume guardrails for SMS abuse.

• Security-critical recovery paths use separately governed budgets rather than disabling controls.

## 22. Enumeration resistance

OTP request and account-resolution responses do not reveal whether a phone already belongs to an Account. Timing, status codes and copy should be bounded enough to avoid membership discovery.

## 23. Account creation

After successful OTP verification, the backend resolves an existing Account or creates one transactionally. Domain relationships are created by their owning workflows; ordinary sign-in does not auto-create Seller, team or Courier authority.

## 24. Age and policy declarations

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

Persist adult_declaration=true, declared_at and age_policy_version only for approved creation; deny missing/false declaration uniformly. Retain minimum necessary security denial trace under approved policy, not a permanent child Account/profile. Existing Auth/Step-Up/session architecture remains unchanged.

## 25. Local biometrics

Face ID/fingerprint may unlock locally stored session material through platform secure storage. Local biometrics do not create a new Adulis session, role, Seller membership or step-up authority unless an explicit server policy says so.

## 26. Linked social identities

TikTok account connection is a linked external identity used for functions such as proving control of a Seller-owned TikTok video before Product Post embed approval. It is not Seller authorization and does not grant team roles.

Current Media/Catalogue policy can require the Seller to connect TikTok before enabling the TikTok embed feature. The external provider subject is bound to Account/Seller context and verified server-side.

## 27. Social providers are not business authority

No TikTok, Google/Gmail or other external identity assertion can by itself establish Seller ownership, team membership, Courier pool approval, payment status or Operator authority. Future sign-in methods must resolve to the same core Account and pass the same relationship authorization.

## 28. Authentication telemetry

• OTP request, provider acceptance/failure, delivery latency, verify success/failure, resend and fallback rate.

• Checkout authentication conversion rather than old pre-payment hold conversion.

• Cost per successful authentication, provider failure concentration and duplicate-message reports.

• Never send raw OTP, session token or unnecessary phone data to analytics.

## 29. Authentication failure semantics

Provider outage may block new OTP delivery but must not invalidate already-issued valid challenges. Database authority failure is fail-closed for session issuance. Valkey degradation may reduce rate-limit/cache efficiency but cannot create alternate authentication truth.

## 30. Public versus authenticated APIs

Public discovery may be anonymous under product policy, but every read resolves current public eligibility. Scene PRIVATE/Moderation/Market/Seller/media/availability restrictions deny exposure even when the public ID, old deep link or saved Collection is known. Protected APIs require a typed audience-bound principal and independent resource authorization.

PART III - SESSIONS & DEVICE SECURITY

## 31. Session philosophy

Use high-entropy opaque stateful sessions. The client holds an opaque credential; PostgreSQL stores the hash and canonical session state. This makes revocation, audience separation and incident response straightforward.

## 32. Session model

core.session binds only an ordinary Account and ordinary MOBILE or CONSOLE audience. Privileged Operator sessions are distinct and cannot be manufactured by changing audience on an ordinary session row or using an ambiguous principal foreign key.

The conceptual design uses separate Operator session/credential objects inside the existing modular monolith/PostgreSQL. An equivalently strongly typed model is acceptable only if ordinary and Operator principal references are structurally unambiguous and conversion impossible.

```
core.session
  id / account_id / audience=MOBILE|CONSOLE / token_hash
  device_id? / created_at / last_seen_at / expires_at / idle_expires_at?
  revoked_at / revoked_reason / assurance / authentication_method
operator.session
  id / operator_account_id / audience=OPERATOR / token_hash
  strong_credential_ref / authentication_at / expires_at / idle_expires_at
  revoked_at / revoked_reason / privileged_security_version
```

## 33. Audience binding

MOBILE and CONSOLE credentials resolve ordinary Accounts and cannot cross audiences. OPERATOR credential resolves only an Operator Account. Surface derives from validated session/route, never a request field. Ordinary phone OTP endpoints cannot issue OPERATOR sessions.

Database/API principal types prohibit ordinary account_id in a privileged session. Operator bootstrap, session list/revoke and recovery are separately scoped and do not appear under ordinary Account session APIs.

![Typed sessions and independently scoped authorization](graphics/AUTH_02.svg)
*Figure 02. Typed sessions and independently scoped authorization. MOBILE/CONSOLE sessions reference ordinary Accounts; OPERATOR sessions reference only internally provisioned Operator Accounts and strong credentials.*

## 34. Mobile token storage

React Native/Expo stores session material in Expo SecureStore or equivalent platform-protected storage. Do not store bearer credentials in SQLite, AsyncStorage or analytics state.

## 35. Console session storage

Use Secure, HttpOnly, SameSite cookies appropriate to the Seller Console origin. __Host- cookie naming is preferred where deployment/origin requirements are satisfied. CSRF protection applies to cookie-authenticated state-changing Console routes.

## 36. Operator session storage

Use isolated ops origin, separate host-only hardened Secure/HttpOnly/SameSite cookie, separate OPERATOR session state and CSRF protections. Bind session to operator_account_id and strong credential/assurance; apply short idle/absolute lifetime, fresh auth and immediate revocation.

Neither ordinary Buyer/Seller/Courier bearer/cookie nor a changed audience, route or role field can become Operator authority. No privileged tokens in localStorage, SQLite or analytics.

## 37. Session revocation

Revocation is immediate in canonical session state. Membership/role revocation also removes business authority on the next request even if the Account session remains valid.

Operator Account/capability/session revocation immediately denies privileged authorization independently of personal ordinary sessions. High-risk Operator paths prove canonical current state; revocation correctness never relies solely on a cache TTL.

## 38. Session list and revoke controls

Users can list relevant sessions and revoke one or all other sessions according to policy. Seller team administrators may have Seller-scoped session administration where the permission seed allows; they never gain global Account takeover capability.

Ordinary users list/revoke only their relevant ordinary sessions. Privileged Operator session administration is an internally authorized separate workflow, never personal Account session takeover.

## 39. Device registry

Device records support notification routing, risk context and session management. Device ID is not authentication. A copied device identifier cannot authorize Seller, Courier or Operator actions.

## 40. New-device protections

Sensitive Seller finance/security actions may apply a new-device delay or fresh step-up in addition to ordinary permission checks. Controls stack; passing one does not bypass another.

## 41. Session cache behavior

Valkey may cache a positive session lookup briefly if invalidation is reliable. High-risk paths re-read or otherwise prove current canonical state. Revocation correctness must not depend on cache TTL.

## 42. Session fixation and rotation

Session identifiers rotate on authentication transitions where necessary. New authentication never adopts an attacker-chosen token. Recovery/phone-change flows revoke relevant existing sessions before issuing new control.

## 43. No refresh-token hierarchy required for MVP

With opaque stateful sessions and direct revocation, a separate access/refresh-token hierarchy is not required unless future scale or API clients create a measured need. Do not add JWT complexity merely for convention.

## 44. Network interruption

If a protected request loses connectivity, the client may retry idempotently where the domain supports it. It must not assume success. On reconnection, canonical server state is re-read.

PART IV - STEP-UP, RECOVERY & PRIVILEGED AUTHENTICATION

## 45. Step-up authentication

Step-up proves recent control for a specific sensitive action. It is not another general session. A successful step-up is purpose-bound, Account-bound, target-bound where appropriate, short-lived and one-use for the authorized command.

## 46. Current sensitive-action examples

• Ownership transfer and Seller closure.

• Seller team invitation, role-set changes and membership removal when policy requires fresh proof.

• Settlement/financial receiving-account change.

• Revoke-all Seller sessions or sensitive Seller security administration.

• Account phone change, high-risk recovery and final account-deletion confirmation.

• Other actions may be added only through a versioned security/permission change, not by assuming a fixed historical count.

## 47. Step-up binding

```
step_up_challenge
account_id
purpose / permission
seller_id? / target_resource?
audience
expires_at
consumed_at
challenge_verifier / assurance metadata
```

## 48. Step-up anti-replay

One-use means one successful protected command. Transaction rollback, duplicate retries or a second endpoint must not resurrect or reuse an already-consumed challenge.

## 49. Account recovery

Recovery preserves the same Account ID and relationships. It changes authentication control, revokes prior sessions according to policy and records the recovery case. Seller memberships are never recreated merely because a phone changes.

Ordinary recovery preserves only the ordinary Account and its Buyer/Seller/Courier relationships. It never recovers an Operator Account, credential or OPERATOR session.

## 50. Recovery evidence

Recovery policy combines approved evidence. Social account control alone is insufficient for established Seller recovery because external-account compromise must not become Seller takeover.

Current Adulis Seller/Courier platform verification has no Government-ID, national-ID, passport, selfie-to-ID or biometric-identity requirement or storage path. Use current ordinary Account/verified-phone control and approved social/business or Courier eligibility evidence. Provider-owned PSP KYC is separate. A future formal verification requirement needs a new explicit versioned product/privacy/jurisdictional/provider design.

Current ordinary recovery may use phone/account control, approved social/business evidence and audited policy-defined review. It does not pre-build Government-ID tables or infer biometric identity. Local device biometrics may unlock secure session material without being Adulis identity verification.

## 51. Phone change

Phone is a credential; changing it does not change Account ownership. Apply step-up/recovery assurance, uniqueness/reuse policy, session revocation and audit logging. Team/Courier relationships remain attached to Account ID.

## 52. Account deletion authentication

Account deletion uses the Platform account-lifecycle APIs and requires step-up. Website and Mobile are UI clients; they do not delete authentication or domain rows directly.

## 53. Operator authentication

Operator Account is a separate privileged internal security principal, independent of an ordinary Buyer/Seller/Courier Account. A person may possess both; their credentials, sessions, recovery, revocation and audit attribution remain separate. Ordinary Account registration, OTP, recovery or Seller roles never produce Operator authority.

Privileged internal provisioning creates the Operator Account and explicit least-privilege role/capability assignments. Strong phishing-resistant credentials, isolated OPERATOR sessions, fresh authorization, immediate revocation and audited domain workflows are required. Founder/Staff governance remains Operator-domain policy, and ADMIN does not create a restricted-evidence bypass.

Operator identifier -> phishing-resistant WebAuthn/passkey/security-key assertion -> active internally provisioned Operator Account -> current role/capability -> dedicated OPERATOR session. Ordinary OTP, public registration and personal recovery are unrelated to privileged access.

Conceptual fields: operator_account_id, internal identity reference, status, strong credential refs, role/capability assignments, provisioning metadata, revocation/security version and historical audit lineage. No separate microservice is required.

## 54. Founder and staff Operator phases

Founder bootstrap and later Staff provisioning follow the respective Operator Console designs. Auth establishes the separate internal principal and current capability assignment; Operator domain owns workflow approvals.

Founder phase preserves distinct Founder Accounts, normal dual control and bounded audited Solo Coverage. Staff phase uses COO/CTO governance, qualified staff and risk-based second approval, with no routine CEO access or Founder Solo Coverage. Revoking CEO privileged access does not revoke a separate personal Account.

Internal recovery requires independently authorized strong assurance, credential/session revocation, controlled re-enrollment and immutable audit. Personal ordinary Account recovery never restores Operator access. No master credential, impersonation or implicit Founder bypass exists.

## 55. No Operator impersonation

Operators do not become Buyers, Sellers or Couriers by impersonating sessions. Support tools act through explicit operator permissions and audited domain commands.

All Operator actions are attributed to operator_account_id and exact capability/workflow; never the person's unrelated personal ordinary Account.

## 56. Break-glass

Any emergency privileged path is explicit, highly audited, narrowly scoped, time-bounded and incident-reviewed. It must not become a hidden superuser session.

PART V - SELLER AUTHORIZATION & TEAM MODEL

Break-glass remains a separate authorized internal incident path and never promotes an ordinary Account. Recovery/revocation/provisioning are privileged, time-bounded and strongly audited.

## 57. Seller authorization pipeline

Seller authorization retains explicit Seller context even though MVP ordinary team membership is exclusive. Ownership relationships may coexist, Courier relationships are separate, and future multi-Seller team membership is planned.

The ordinary pipeline remains independent of the privileged Operator path. A validated role union cannot bypass current selected-mode legality, public Content restrictions or required domain approval.

![Role union passes every independent authorization gate](graphics/AUTH_03.svg)
*Figure 03. Role union passes every independent authorization gate. Exact Seller relationship, surface, scope, freshness and domain legality are all required; role composition never bypasses paid-mode or Courier-acceptance rules.*

## 58. Seller relationship types

Seller ownership and Seller team membership are different relationships. OWNER is derived from the ownership relationship. Ordinary team membership may hold one or more assignable roles. Courier relationships are never Seller-team memberships.

## 59. MVP team-membership exclusivity

An Account may maintain at most one non-terminal Seller team membership at a time during MVP. ACTIVE grants authority. SUSPENDED grants no Seller authority but continues to occupy the membership slot until resolved. REVOKED/terminal releases the slot.

This is a product/domain constraint, not an identity architecture limitation.

MVP: one Account -> maximum one non-terminal Seller TEAM membership. Future: multiple team memberships without redesigning Account, session or permission architecture.

## 60. Database enforcement of membership limit

Use an executable PostgreSQL partial unique index with existing canonical standing values; pre-check remains UX only.

```
CREATE UNIQUE INDEX seller_team_one_current_slot
ON seller_team_membership (account_id)
WHERE relationship_type = 'TEAM'
  AND standing IN ('ACTIVE', 'SUSPENDED');
```

Map this reviewed fixture to actual schema/migration names; no migration execution is claimed. Invitation acceptance locks/binds target Account and uniqueness prevents concurrent activation into two Sellers. Ownership rows are outside this predicate.

## 61. Historical memberships

Revoked memberships are retained according to Privacy/audit policy. They preserve action attribution, role history, Claims/investigations and future transition history; they are not deleted just because the Account joins another Seller.

## 62. Seller-team recruitment is offline and relationship-led

Adulis does not provide a Seller-team talent-discovery product in MVP. Team members obtain the job relationship outside the platform: the person approaches the Seller/administrator in person, or the Seller/administrator approaches and recruits the person in person.

After that offline recruitment decision, the Owner/Admin uses Adulis only to create the access relationship.

## 63. No Seller-team job or candidate-discovery marketplace

• No public talent profiles for Seller staff recruiting.

• No browse/search endpoint for finding staff candidates.

• No Seller-team job listings or applicant ranking.

• No member-initiated in-app application queue for Seller jobs.

• No recommendation engine matching team members to Sellers.

• Courier applications are a separate Fulfilment/Courier concept and must not be reused as Seller-team employment discovery.

## 64. Team invitation after offline recruitment

After offline recruitment, invite an EXISTING ordinary Account selected by username. Resolve target_account_id server-side and bind it immutably; username/phone changes cannot retarget the invite. No unregistered-phone team recruitment flow. Authorized Owner/Admin assigns permitted roles; target-bound acceptance, expiry/revocation and current exclusivity apply. PENDING invitations may coexist without membership authority or revealing another Seller relationship. One ACTIVE/SUSPENDED TEAM slot is database-enforced under concurrent acceptance; ownership/Courier relations remain separate.

## 65. Invitation acceptance

Acceptance authenticates the target Account, validates invitation recipient binding, Seller state, invitation state, membership-slot availability and the proposed initial role set. Membership activation and role assignment occur atomically with audit evidence.

![Explicit anonymous, ordinary, privileged and trusted service contexts](graphics/AUTH_04.svg)
*Figure 04. Explicit anonymous, ordinary, privileged and trusted service contexts. Modes change acting relationships, not identity; separate Operator and delegate receipt boundaries remain.*

## 66. Multiple roles per team member

A single Seller team membership may hold multiple roles whenever the Seller Owner or an authorized Admin determines that the responsibilities are appropriate. The membership slot is consumed once regardless of how many roles are attached.

Example: the same person may hold INVENTORY + SALES_SUPPORT, or ADMIN + INVENTORY + ANALYST for one Seller.

## 67. Role-assignment model

Do not store one scalar seller_role on Account or membership. Use a membership-to-role assignment relation so role sets are explicit, versionable and future-compatible.

OWNER is not assignable through this table; it is derived from Seller ownership and changes only through the ownership-transfer workflow.

```
seller_team_membership
  id / account_id / seller_id / standing / version ...
```

```
seller_team_role_assignment
  membership_id
  role_code  # ADMIN | SALES_SUPPORT | INVENTORY | ANALYST | CAMPAIGN_MANAGER
  assigned_by_account_id
  assigned_at
  revoked_at?
```

## 68. Effective permission union

For one membership, effective role permissions are the set union of all active role grants. Union never bypasses Seller scope, surface restrictions, entitlements, Step-Up, Seller state or domain invariants. No combination of team roles can create OWNER-only authority.

```
effective_permissions = UNION(role_permission(role) for role in membership.active_roles)
then apply surface + Seller scope + state + entitlement + Step-Up + domain rules
```

## 69. Role-set mutation

Owner/Admin can add or remove non-OWNER roles from a current membership using a Console-only team-administration flow. Role changes are atomic, version-checked and audited. An ACTIVE membership must retain at least one assignable role; otherwise terminate/suspend the relationship rather than leaving an authority-less active row.

## 70. Admin role-management limits

ADMIN may manage ordinary team roles but cannot assign OWNER, transfer ownership or close the Seller. Role changes cannot elevate the acting Admin into ownership or bypass owner-only actions.

## 71. Team removal and leaving

Owner/Admin removal transitions the membership to a terminal state and immediately removes Seller authority on the next request. A team member may leave when product policy allows. General Buyer/Courier session validity may remain; the Seller-team slot is released only after the membership is terminal.

## 72. Suspension

SUSPENDED grants no Seller permissions but keeps the one-team slot occupied. This prevents a temporarily suspended staff member from bypassing the relationship state by immediately activating a second Seller team.

## 73. Seller context remains mandatory

Requests remain explicitly Seller-scoped. One Account can own Seller A while being a team member of Seller B, and future releases may allow multiple team memberships. The backend never derives a mutable global current Seller from Account identity alone.

## 74. Cross-Seller isolation

Role permission is not resource ownership. ADMIN of Seller A with seller.orders:read cannot read Seller B Orders. Application checks, schema constraints and RLS where appropriate enforce tenant boundaries. Return non-disclosing 404 semantics when revealing object existence would leak another Seller's data.

## 75. Seller bootstrap relationship shape

Bootstrap contracts return relationship collections even though MVP normally yields zero or one usable team membership. Avoid brittle user.seller or user.role scalar contracts. Each relationship includes Seller reference, relationship type, standing and role set.

## 76. Seller identity visibility in clients

Seller Console and Seller Companion always display the represented Seller and carry explicit Seller context in requests. Notifications also include Seller attribution, reducing wrong-context actions and preparing for future multi-Seller support.

## 77. Role changes and sessions

Role removal does not require global logout to take effect. Authorization re-resolves membership version/effective permissions and denies the next Seller request. Permission caches must invalidate on membership standing or role-assignment changes.

## 78. Ownership is separate from team membership

An Account may own a Seller and also hold the single team membership slot for another Seller unless a future policy explicitly changes that combination. Ownership does not consume the team-membership limit.

## 79. Courier relationships are separate

A Courier can belong to multiple Seller Courier Pools under the current Fulfilment model. Those relationships do not consume the Seller-team slot and do not inherit Seller team permissions. Courier authority derives from Courier profile, Seller-Courier relationship and assignment state.

## 80. Team audit model

Every team invitation, activation, suspension, role-set change, removal and leave operation records Account, Seller, membership, previous/new role set, actor, session, timestamp, request ID and reason where applicable. Historical actions retain the role set that authorized them rather than relying on today's membership state.

PART VI - PERMISSIONS, ROLES & SURFACES

## 81. Permission-design rule

Permissions are derived from business responsibility and atomic protected actions. Historical numeric targets are discarded. Do not invent or remove permissions merely to make a role reach a preconceived count.

## 82. Closed executable permission catalogue

The responsibility-derived v3.0 executable seed has 68 unique Seller permission codes and 197 role grants. Semantic Courier/Scene corrections are derived from valid protected actions; no code is added or removed to satisfy an old count. Appendix B contains exact canonical codes and Appendix C defines the executable grant sets/count calculation. CI must compare documentation/seed/enforcement, not a historical fixed target.

All normative dependent Seller references and generated types resolve to this single canonical seed. Self-service Account deletion/session purposes are classified outside it. Unknown code validation fails closed; no obsolete consumer string is granted as an alias.

## 83. Permission naming

Use stable semantic codes seller.<domain>:<action>. Permissions authorize valid commands only. Seller payment state is read-only; seller.orders:courier_request creates approved offers requiring Courier acceptance, and seller.orders:fulfilment_operate executes valid actions within the paid selected mode rather than silently replacing it.

## 84. Permission catalogue - summary

The current grouped totals are calculated from the executable seed.

| Permission family | Computed count |
| --- | --- |
| Orders & fulfilment | 6 |
| Payments & finance | 3 |
| Catalogue | 8 |
| Inventory | 4 |
| Scene content | 7 |
| Buyer communication | 2 |
| Claims | 4 |
| Chatbot | 4 |
| Analytics | 7 |
| Store & verification | 7 |
| Courier administration | 5 |
| Team administration | 4 |
| Seller security | 2 |
| Trust & safety reads | 3 |
| Ultimate control | 2 |
| TOTAL | 68 |

## 85. Role-grant totals are outputs, not requirements

Grant counts are outputs from the explicit responsibility sets, not product targets. INVENTORY has no standing pool, team, finance-setting or extra support mutation merely to preserve a prior total.

| Role | Computed permissions | Responsibility |
| --- | --- | --- |
| OWNER | 68 | All ordinary Seller permissions; derived ownership, never assignable. |
| ADMIN | 66 | All except ownership transfer and Seller closure. |
| SALES_SUPPORT | 13 | Order/payment reads, Inbox, Claim response and safe support projections. |
| INVENTORY | 23 | Catalogue/pricing/stock, preparation/Ready, approved request and Pickup. |
| ANALYST | 7 | Privacy-bounded analytics only. |
| CAMPAIGN_MANAGER | 20 | Scene/media/tags/hotspots, chatbot, merchandising-context reads and scoped analytics. |
| TOTAL ROLE GRANTS | 197 | Computed from explicit role definitions. |

## 86. OWNER authority

OWNER is derived from Seller ownership and receives the complete current Seller permission seed subject to surface, Step-Up, Seller state, entitlement, scope and domain rules. OWNER cannot declare payment successful, adjudicate Claims, set Trust Level or fabricate Handoff evidence.

## 87. ADMIN authority

ADMIN receives delegated full business administration but never seller.ownership:transfer or seller.lifecycle:close. ADMIN may manage team members and multiple role assignments, Courier pool administration, Store configuration and ordinary Seller security according to Step-Up policy.

## 88. SALES_SUPPORT authority

SALES_SUPPORT reads relevant Orders and provider payment status, operates Seller Inbox, handles chatbot escalations, responds to Claims and sees enough delivery/Courier state to help Buyers. It cannot prepare goods, Mark Ready, request Courier service, perform Seller pickup, change stock/product/price, author Scene Posts or administer team/security.

## 89. INVENTORY authority

INVENTORY is the catalogue, pricing, stock and fulfilment operator. It can create/edit/publish/archive Product Posts, manage Variants and price, manage stock, prepare paid Orders, Mark Ready, operate the Buyer-selected paid fulfilment mode, request approved Courier service requiring acceptance and perform Seller Pickup Handoff.

It cannot invite/approve/remove standing Couriers, manage team, access unrestricted Buyer Inbox, change settlement accounts or administer Seller identity/security.

seller.orders:fulfilment_operate never permits silent paid-mode replacement. seller.orders:courier_request creates direct/pool offers after paid Ready and approved relationship checks; Courier acceptance establishes assignment. Standing pool/compensation administration stays Owner/Admin unless separately granted.

## 90. ANALYST authority

ANALYST receives only privacy-reduced analytics permissions. Read-only does not mean read every raw operational record. It cannot mutate Orders, Products, stock, content, settings, team or finance.

## 91. CAMPAIGN_MANAGER authority

CAMPAIGN_MANAGER creates and manages Scene Posts, content media, product tagging/hotspots, approved moderation-response workflows, Seller chatbot configuration/testing and discovery/content analytics. It can read Product/Variant/availability context needed for tagging but cannot change canonical Product price, stock or Order state.

Scene permissions are seller.scene_posts:read/write/publish/archive/tag_products plus seller.content_media:manage and seller.content_moderation:respond. No role allows Content eligibility bypass or direct price/stock/payment authority.

## 92. Multiple roles compose additively

A membership with SALES_SUPPORT + INVENTORY receives the union of both sets. A membership with ADMIN + ANALYST still lacks OWNER-only transfer/closure. Role combination does not create a new named role and does not alter the one-team-membership rule.

## 93. Surface authorization

Permissions carry permitted surfaces. Seller Console is the create/configure/manage/administer surface. Seller Companion is operational: monitor, communicate, respond and perform urgent/physical workflow actions. The server derives surface from the validated audience and route contract.

## 94. Mobile Seller Companion role behavior

OWNER/ADMIN may operate paid Orders, prepare/Mark Ready, request approved Courier service requiring acceptance, perform Pickup Handoff, see Courier state and Inbox, with only limited urgent inventory actions. SALES_SUPPORT gets support/Claim/Inbox actions but no fulfilment mutation. INVENTORY gets preparation, fulfilment and urgent stock actions. ANALYST and CAMPAIGN_MANAGER require no substantive Seller Companion workspace in MVP.

## 95. Console-only administration

• Team invitations, multi-role assignment and removal.

• Ownership transfer and Seller closure.

• Full Product Post and Scene Post authoring.

• Courier pool invitation/application review/relationship administration and Seller-defined Courier compensation.

• Chatbot configuration and full analytics.

• Settlement-account changes, session/security administration and other sensitive Seller configuration.

## 96. Entitlements and permissions remain separate

Permission answers whether the actor is allowed to attempt an action. Entitlement/Trust/Market/domain rules answer whether the capability is currently available. The commercial model remains outside Auth; do not hard-code subscription tier or commission logic into permission evaluation.

PART VII - BUYER, COURIER, OPERATOR & PUBLIC AUTHORIZATION

## 97. Buyer authorization

Buyer authorization is relationship/resource based: the authenticated Account owns the cart/session, is the Buyer party to an Order/Claim/Conversation, or is otherwise explicitly authorized. A Buyer never supplies a target buyerAccountId as authority.

## 98. Checkout and payment authorization

Checkout creates seller-specific Orders/payment attempts through the current multi-cart architecture. Payment success is established only by the backend Payments domain using PSP verification/webhooks/reconciliation. Seller roles receive read/support access only.

The Buyer-side Adulis Checkout surcharge and Courier delivery charge are financial-domain calculations; Auth does not calculate or approve either.

## 99. Review eligibility

Auth proves Buyer identity; Reviews verifies exact Product purchase/completed delivery eligibility. Being logged in is insufficient to create a Review.

## 100. Courier identity and relationships

Courier is a third primary Mobile mode. One Account has one persistent Courier identity and may have many Seller-Courier relationships. Courier-team applications/invitations are Fulfilment concepts and are not Seller staff recruitment.

Current Adulis Seller/Courier platform verification has no Government-ID, national-ID, passport, selfie-to-ID or biometric-identity requirement or storage path. Use current ordinary Account/verified-phone control and approved social/business or Courier eligibility evidence. Provider-owned PSP KYC is separate. A future formal verification requirement needs a new explicit versioned product/privacy/jurisdictional/provider design.

Courier VERIFIED means current platform eligibility policy, not Government ID verified. Pool relationships remain separate from Seller-team employment/access slots.

## 101. Courier authorization

Courier actions require eligible Courier profile + applicable Seller-Courier relationship + assignment state + resource scope. An approved Courier in Seller A's pool cannot read Seller B delivery details unless independently authorized there. One active accepted delivery per Courier is current Fulfilment policy, enforced by that domain.

Offer acceptance additionally checks eligible approved relevant pool, current platform status/availability, exact offer/Order/Market, expiry and atomic one-active capacity. Seller request permission does not force assignment; losing Courier receives no Buyer-sensitive details.

## 102. Handoff authorization

Handoff Verification is server-authoritative and network-required. Auth supplies current actor/session context; Handoff owns QR/OTP/Manual credential semantics. Current delivery direction is Seller displays Pickup QR for Courier scan, then Courier displays final Delivery QR for Buyer or authorized delegate scan, with OTP/Manual fallbacks.

Direct Buyer Collection/Seller Delivery also uses Seller/authorized presenter displays -> Buyer/delegate scans. Delegate binding is one name/phone recipient, final stage only and set before final credential issuance.

## 103. Delegated delivery recipient

A Buyer may designate a recipient by name and phone before Courier arrival. Auth/Account services may support recipient phone verification or app sign-in, but delegation is Order/Handoff-scoped and does not transfer Buyer Account ownership, Claims, Reviews, refund rights or Seller permissions.

## 104. Operator authorization axis

Operator Account is a separate privileged internal security principal, independent of an ordinary Buyer/Seller/Courier Account. A person may possess both; their credentials, sessions, recovery, revocation and audit attribution remain separate. Ordinary Account registration, OTP, recovery or Seller roles never produce Operator authority.

Privileged internal provisioning creates the Operator Account and explicit least-privilege role/capability assignments. Strong phishing-resistant credentials, isolated OPERATOR sessions, fresh authorization, immediate revocation and audited domain workflows are required. Founder/Staff governance remains Operator-domain policy, and ADMIN does not create a restricted-evidence bypass.

Operator authorization resolves operator_account_id, exact current role/capability, resource/policy scope, fresh strong auth and approval/workflow context. Founder/Staff assignments attach to this principal and preserve historical attribution on revocation.

No ordinary role/grant API, public make-operator endpoint or personal Account recovery can create privileged authority. Capability assignment is not an ordinary Account promotion. Sensitive evidence remains independently capability/case/purpose scoped.

## 105. Public authorization

Anonymous/public reads may return eligible Product Posts, Seller profiles/Storefront and PUBLIC Scene Posts. Launch Marketplace Search types are PRODUCT_POST, SELLER and SCENE_POST. Public-safe references and approved projections omit private Seller/internal IDs and restricted evidence.

Content enforces Scene visibility before public authorization succeeds. PUBLISHED + PRIVATE, all-unavailable tags, Moderation/Seller/Market/media restrictions or out-of-Market context deny public detail, Search/FYP, deep links and Collections rendering. Retained private Collection membership never grants access to private content.

## 106. FYP authentication boundary

FYP may be browsed anonymously where product policy allows. FYP top-level units are Scene Posts only; Product Posts are commerce/detail surfaces. Authentication is required only when an account-bound action is taken.

PART VIII - IMPLEMENTATION, DATA & APIS

Product Posts are reached through Scene tags, Search/Shop/Seller surfaces and direct links. FYP never bypasses PRIVATE/current-eligibility gates.

## 107. NestJS modular architecture

Authentication and Authorization remain modules inside the Adulis modular monolith; no standalone auth microservice is required. Strong interfaces and dependency-cruiser rules prevent private repository leakage across domains.

```
apps/api/src/modules/authentication
apps/api/src/modules/authorization
apps/api/src/modules/seller-team
apps/api/src/modules/operator-auth
apps/worker/src/jobs/auth-*
packages/permission-catalogue
packages/api-contracts
```

## 108. Guard stack

Use composable guards/interceptors/application services: session authentication -> audience/surface -> Seller context -> membership/ownership -> effective permissions -> entitlement/Trust gates -> resource scope -> Step-Up -> domain invariant. Do not hide business authorization exclusively in decorators or frontend components.

Operator routes use a separate guard branch: typed Operator session -> active Operator Account/security version -> exact capability -> resource/case/policy -> fresh strong auth -> required approval -> domain invariant. No ordinary Seller relationship is used to authenticate privileged actions.

## 109. Structured authorization decision

Authorization decisions are explicitly typed by principal; do not put an ordinary Account ID in an Operator decision or attribute a privileged action to personal identity.

```
OrdinaryAuthorizationDecision {
  principal_kind: ORDINARY_ACCOUNT; account_id; allowed; reason_code;
  seller_id?; membership_id?; relationship_type?; effective_roles[];
  permission; surface; resource_scope_result; step_up_result; domain_result;
}
OperatorAuthorizationDecision {
  principal_kind: OPERATOR_ACCOUNT; operator_account_id; allowed; reason_code;
  operator_role_capability; resource_policy_case_scope;
  fresh_auth_result; approval_workflow_context; domain_result;
}
```

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

## 110. Permission loading

Load closed permission definitions and role grants from versioned seed data. Effective team permissions are calculated across all active role assignments for the target membership. OWNER permissions derive from ownership relationship, not from inserting an OWNER team-role row.

## 111. Authorization caching

Valkey may cache effective permission sets keyed by Account + Seller + membership/ownership version + surface. Invalidate on membership standing change, role assignment change, Seller suspension, ownership transfer or grant version change. High-risk actions can bypass stale cache.

Operator authorization caches are typed separately and keyed by operator_account_id/security/capability version. High-risk privileged access proves current canonical revocation/capability/workflow state; stale ordinary Account caches cannot authorize it.

## 112. PostgreSQL schemas

Ordinary and privileged principals remain logically/security-separated in the existing PostgreSQL/modular monolith. Conceptual naming can follow implementation conventions while retaining distinct unambiguous foreign keys.

| Ordinary object | Canonical purpose |
| --- | --- |
| core.account | Immutable ordinary Buyer/Seller/Courier identity. |
| core.otp_challenge / core.otp_delivery_attempt | Ordinary Adulis-owned OTP/challenge transport history. |
| core.session / core.account_device | MOBILE/CONSOLE sessions and device context. |
| core.step_up_challenge | Purpose-bound ordinary fresh proof. |
| seller.team_membership / seller.team_role_assignment | One non-terminal team slot, additive non-OWNER roles. |
| auth.permission / auth.role_permission | Versioned closed ordinary Seller seed and grants. |
| core.account_recovery_case / core.account_control_challenge | Ordinary recovery only; no Operator restoration. |
| audit.security_event | Append-only typed ordinary/privileged attribution. |

| Privileged object | Canonical purpose |
| --- | --- |
| operator.account | Distinct operator_account_id/internal identity/status/provisioning. |
| operator.credential | Strong phishing-resistant credential refs/enrollment. |
| operator.role_capability_assignment | Least-privilege versioned/auditable/revocable authority. |
| operator.session | OPERATOR audience with operator_account_id and strong assurance. |
| operator.recovery_security_state | Internal recovery, revocation/security version and audit. |

## 113. Membership constraints

• Unique relationship identity and immutable membership ID.

• Database-backed one non-terminal team membership slot per Account during MVP.

• At least one active non-OWNER role assignment for ACTIVE team membership.

• No OWNER role assignment row; OWNER comes from ownership.

• Role assignment uniqueness per membership + role code.

• Seller scope and Account foreign keys enforced.

## 114. RLS and cross-tenant defense

Use PostgreSQL RLS on suitable Seller-private projections/tables as defense in depth. Application authorization remains mandatory. RLS session context must be set transaction-safely and must not leak between pooled connections.

## 115. Seller-team invitation APIs

Canonical API shape may vary, but should express known-person invitation rather than candidate discovery.

```
POST /v1/sellers/{sellerId}/team/invitations
GET  /v1/me/seller-team/invitations
POST /v1/seller-team/invitations/{inviteId}/accept
POST /v1/sellers/{sellerId}/team/members/{membershipId}/suspend
POST /v1/sellers/{sellerId}/team/members/{membershipId}/revoke
POST /v1/me/seller-team/membership/{membershipId}/leave
```

After offline recruitment, invite an EXISTING ordinary Account selected by username. Resolve target_account_id server-side and bind it immutably; username/phone changes cannot retarget the invite. No unregistered-phone team recruitment flow. Authorized Owner/Admin assigns permitted roles; target-bound acceptance, expiry/revocation and current exclusivity apply. PENDING invitations may coexist without membership authority or revealing another Seller relationship. One ACTIVE/SUSPENDED TEAM slot is database-enforced under concurrent acceptance; ownership/Courier relations remain separate.

```
POST /v1/sellers/{sellerId}/team/invitations
  { target_username, permitted_role_codes[], expires_under_policy }
Server resolves immutable target_account_id; no target_phone DTO.
Accept requires that exact authenticated Account and current authority.
Account creation: adult_declaration=true + age_policy_version;
false/missing declaration denies registration with no child profile.
```

## 116. Role-set APIs

```
GET   /v1/sellers/{sellerId}/team/members/{membershipId}/roles
PUT   /v1/sellers/{sellerId}/team/members/{membershipId}/roles
# body is desired complete non-OWNER role set; server validates actor, step-up, membership version and role codes
```

## 117. Explicitly absent Seller-team APIs

```
NO /team/talent
NO /team/jobs
NO /team/candidates/search
NO /team/applications
NO /recommended-staff
```

## 118. Authentication and session APIs

```
POST /v1/auth/otp/request
POST /v1/auth/otp/verify
POST /v1/auth/otp/resend
GET  /v1/auth/sessions
DELETE /v1/auth/sessions/{sessionId}
```

```
POST /v1/auth/sessions/revoke-all
POST /v1/auth/logout
```

Separate internally authorized Operator contracts handle credential login, OPERATOR session bootstrap/revoke and privileged recovery. Ordinary /v1/auth/otp and /v1/auth/sessions never accept OPERATOR audience or operator_account_id, and no public Account-to-Operator creation endpoint exists.

## 119. Step-up and recovery APIs

```
POST /v1/auth/step-up/start
POST /v1/auth/step-up/verify
POST /v1/account-recovery/start
POST /v1/account-recovery/verify
POST /v1/account-recovery/complete
# exact route names follow generated OpenAPI contract
```

## 120. Bootstrap APIs

GET /v1/bootstrap returns mode/capability/relationship summaries appropriate to MOBILE. Seller Console and Operator Console use their own scoped bootstrap. Seller relationships are arrays; team memberships include role arrays rather than a scalar role.

Operator bootstrap binds only the privileged principal and current capability/workflow summaries. Public/ordinary bootstrap cannot return usable internal credentials, private investigation state or Operator authority.

## 121. Bootstrap example

```
sellerRelationships: [
  { sellerId, relationshipType: "OWNER", standing: "ACTIVE", roles: ["OWNER"] },
  { sellerId, relationshipType: "TEAM", standing: "ACTIVE", roles: ["INVENTORY","SALES_SUPPORT"] }
]
# During MVP an Account can have at most one non-terminal TEAM relationship, but ownership may coexist.
```

## 122. Generated OpenAPI clients

@nestjs/swagger defines server contracts; generated TypeScript clients are consumed by Mobile, Seller Console and other first-party surfaces. Clients do not hand-code permission constants or infer Seller authority from hidden UI state.

## 123. Transactional outbox and BullMQ

Security/team-change events that require asynchronous notifications, analytics or reconciliation are emitted transactionally. BullMQ/Valkey process the outbox consequences; the queue is not the authority for whether the role or membership changed.

## 124. Repository boundaries

adulis-platform contains API, worker, Mobile, Seller Console, Operator Console and shared permission/api-contract packages. adulis-web remains a separate Company Website repository. No frontend receives database credentials or private repository access.

## 125. Migration to Canonical Principal and Permission Model

Treat the current 68-code/197-grant seed as an explicit versioned authorization migration. Canonical Scene permission names replace prior content names; courier_request replaces any forced-assignment meaning; fulfilment_operate is restricted to legal selected-mode actions. Update generated clients, guards, grants, documentation and negative tests together.

If previous values are deployed, use bounded read/alias compatibility and additive migration with unchanged current domain constraints; never make legacy aliases a privilege bypass. Preserve historical audit identifiers and revoke obsolete writes after compatibility verification.

For Operator separation, internally provision independent principals/strong credentials, migrate approved staff/founder access through governance and explicit audit mapping, revoke ordinary-derived privileged sessions/grants, verify personal Account recovery cannot restore access, and retire the ordinary promotion path. Do not convert ordinary sessions by changing audience or erase historical evidence.

CI compares exact code sets, role grant sets/counts and enforced semantic/surface rules to the executable seed. Numeric totals are recomputed, never fixed to old targets.

PART IX - AUDIT, PRIVACY, OBSERVABILITY & FAILURE

## 126. Security event catalogue

Use a closed versioned event catalogue. Team events include invite created/accepted, acceptance blocked by membership limit, membership activated/suspended/revoked, role set changed and membership-limit denied. Reuse equivalent existing event codes instead of inventing duplicates.

Privileged provisioning, strong credential enrollment/recovery/revocation, capability changes and approval-sensitive actions record Operator-specific actor/event identity and current policy/workflow provenance. Event consumers cannot create authority from payloads alone.

## 127. Audit versus analytics

Audit records establish who did what under which authority. Analytics measures product/operational behavior. Analytics cannot replace immutable security evidence and must not receive secrets or unnecessary PII.

## 128. Authorization audit context

• account_id, seller_id, relationship_type, membership_id where applicable.

• Effective role set and permission evaluated.

• Resource reference, session/audience, request ID and timestamp.

• Decision reason and Step-Up result for sensitive actions.

• Historical role-set snapshot/version when needed for later reconstruction.

Privileged audit uses operator_account_id, exact capability/assignment version, case/resource, strong-auth freshness, required approval/workflow and timestamp. Never attribute Operator action to the unrelated personal ordinary Account. Ordinary audit retains Account/Seller/membership/effective-role lineage separately.

## 129. Team privacy

When Seller B invites a person already attached to Seller A, Seller B receives eligibility status, not Seller A identity. The platform must not expose employment relationships across Sellers unless a future explicit disclosure policy permits it.

## 130. No employment-law inference

The one-team membership limit is a platform MVP simplification, not an employment, non-compete or conflict-of-interest determination. Auth does not infer legal employment status from a membership row.

## 131. Logging

Pino structured logs include request/correlation IDs, stable decision codes and technical context with redaction. Never log OTP plaintext, bearer/session tokens, settlement credentials, raw verification/recovery evidence or unnecessary phone numbers.

## 132. Observability

Sentry captures sanitized client/server errors and release context; Pino covers structured logs; pg_stat_statements identifies PostgreSQL hot queries. Monitor OTP/provider health, session lookup latency, authorization denial reasons, role-change invalidation and membership acceptance conflicts.

## 133. Authorization metrics

• permission_denied / surface_denied / scope_denied / step_up_required.

• membership_limit_denied and concurrent-acceptance conflict rate.

• team invitations sent/accepted, role changes, membership revocations and leaves.

• cross-tenant access attempts and unexpected permission-cache mismatches.

• Provider payment-status authorization attempts never include a Seller payment-confirm action.

Monitor attempts to convert ordinary session audience, personal-recovery-to-Operator access, public Operator provisioning, stale privileged revocation, private Scene exposure and semantic Courier-request bypass. Reject all such paths and alert on any unexpected authorization success.

## 134. Valkey degradation

Canonical sessions, membership/role state and permission seed remain available from PostgreSQL. Rate limiting/caches may degrade to conservative database-backed behavior. Never fail open because Valkey is unavailable.

## 135. Database degradation

Authentication/session issuance and protected authorization requiring canonical state fail closed if PostgreSQL authority is unavailable. Public cached content may have its own degradation strategy, but no new business authority is created.

## 136. SMS-provider outage

Already-issued valid OTPs remain verifiable by Adulis. New sign-ins may be temporarily unavailable if all transports fail. Do not weaken authentication to bypass the outage.

## 137. Permission-cache failure

If invalidation confidence is lost, bypass cached permissions and re-read canonical membership/role grants. Sensitive team/finance/ownership actions should prefer canonical checks regardless.

## 138. Security incidents

• Unexpected cross-Seller authorization success.

• OWNER-only action executed by non-owner.

• Two simultaneous non-terminal team memberships for one Account.

• Role change fails to remove authority.

• Seller role changes payment truth.

• Operator audience accepted on ordinary session or vice versa.

• OTP/session secret exposure.

• Ordinary recovery or role change creates privileged access.

• Public/internal-ID knowledge bypasses PRIVATE Scene eligibility.

• Seller request fabricates Courier assignment or silently replaces paid fulfilment mode.

## 139. Retention and deletion

Auth, audit and membership records follow the central Privacy/Retention lifecycle. Active legal/security/Claim holds can delay destructive deletion. Historical team-role attribution must not disappear while it is required for legitimate evidence.

## 140. Account deletion relationship behavior

Deletion does not silently erase active Seller ownership/team/Courier obligations. Account Lifecycle coordinates required transitions and retention. Authentication only proves and authorizes the deletion request.

## 141. Cost controls

SMS transport and high-cardinality security telemetry are cost-bounded. Valkey/BullMQ workloads are monitored, but security correctness is not traded away to reduce provider or cache cost.

PART X - TESTING, LAUNCH & FINAL ARCHITECTURE

## 142. Test architecture

Use Jest for unit/property-style policy tests, Testcontainers with PostgreSQL for schema/RLS/concurrency tests, Maestro for Mobile authentication/mode/Handoff-related flows, Playwright for Seller/Operator Console flows and k6 for authentication/authorization load.

## 143. OTP critical tests

• Valid, wrong, expired and burned codes.

• Resend invalidates old generation.

• Provider failover sends the correct live challenge without duplicate authority.

• DELIVERY_UNKNOWN does not blindly resend.

• Enumeration responses remain non-disclosing.

• Attempt counter cannot be restored through transaction rollback.

## 144. Session and audience tests

• MOBILE/CONSOLE audiences are isolated; ordinary account_id cannot become OPERATOR by field/route/header changes.

• Ordinary Seller/Buyer role API cannot grant privileged access; no public make-operator route exists.

• Strong separate Operator login works independently of personal ordinary Account; personal recovery never recovers Operator credentials/sessions.

• Operator revocation immediately removes privileged access while unrelated ordinary sessions keep their own policy.

• Ordinary session revocation, membership revocation, new-device/Step-Up and cookie/CSRF boundaries pass independently.

## 145. Multi-role Seller tests

• One membership with INVENTORY + SALES_SUPPORT receives the exact union of both grants.

• Removing SALES_SUPPORT removes only its unique permissions while INVENTORY permissions remain.

• ADMIN + any specialist never gains ownership transfer or Seller closure.

• ACTIVE membership cannot have an empty active role set.

• Role changes invalidate cached effective permissions.

## 146. Membership exclusivity tests

• First non-terminal team membership activates.

• Second team invitation may be PENDING but acceptance is denied while the first slot is occupied.

• Two concurrent invitation acceptances result in exactly one non-terminal membership.

• SUSPENDED membership grants no authority and still occupies the slot.

• REVOKED membership releases the slot and remains auditable.

• Ownership and Courier relationships do not consume the team slot.

## 147. Team recruitment boundary tests

• No public staff-candidate search/list endpoint exists.

• No in-app staff application flow can create Seller team membership.

• Only authorized Owner/Admin can create a team invitation after the person is known.

• Invitation acceptance cannot expose another Seller identity.

## 148. Role responsibility tests

• SALES_SUPPORT can read/support/Claim respond but cannot prepare, Mark Ready, request Courier, perform Pickup or edit price/stock/content.

• INVENTORY can manage Product/Variant/price/stock and paid preparation/Ready, operate selected fulfilment, request approved direct/pool offers and perform Pickup; cannot force acceptance/assignment or manage standing pool/team/finance configuration.

• ANALYST receives exact privacy-reduced analytics set and all mutations fail.

• CAMPAIGN_MANAGER can author Scene/media/tags/hotspots and approved chatbot/content-moderation workflows; price/stock/Order/payment mutation fails.

• ADMIN excludes owner-only transfer/closure; OWNER still obeys fresh proof and domain legality.

• Grant counts match executable explicit sets; no unsupported grant is inserted for count symmetry.

• Public Search returns eligible Product/Seller/Scene; PRIVATE direct/Collection/FYP read fails; FYP is Scene-only.

• Courier second active delivery rejected, Handoff presenter/recipient binding enforced, delegate cannot obtain Buyer Claim/refund/Review rights.

• No Government-ID/Seller-Courier identity-storage requirement exists; four-level Trust is consumed without listing caps or setters.

## 149. Payment authorization tests

• No Seller role can mark PSP payment successful.

• Provider/backend verified payment status is readable only where granted.

• Forged client success callback does not create payment authority.

• Finance settlement-account change requires appropriate Owner/Admin permission plus Step-Up.

• Checkout surcharge and Courier delivery price are not authorization calculations.

## 150. Cross-Seller and RLS tests

Run IDOR/resource-scope tests for every Seller-private resource. Test pooled DB connection context reset. OWNER Seller A + team member Seller B must receive different effective authority depending on explicit target Seller.

## 151. Performance and load

k6 should validate OTP request/verify, session authentication and Seller permission evaluation under production-like concurrency. Authorization should resolve common effective permissions with bounded queries and no N+1 per permission.

## 152. Production launch gates

• Stable ordinary Account identity, Adulis OTP defaults/resend/failover/attempt burn and privacy-safe E.164/provider routing pass.

• Separate internal Operator principal/provisioning/strong login/recovery/session/authorization and immediate revocation are enforced; ordinary Account promotion is absent.

• 68 canonical Seller codes and 197 role grants match executable seed and documentation through CI; semantic Courier request/selected-mode operations and Scene family are current.

• One non-terminal Seller-team slot, multi-role union/removal and concurrent acceptance are database-safe; ownership/Courier pools remain separate.

• No Seller staff discovery/job/application APIs, no OWNER team assignment, and explicit Seller/surface/resource/Step-Up rules pass.

• Public Marketplace Search supports Product/Seller/PUBLIC Scene; PRIVATE/current restrictions deny all public and Collection resolution; FYP is Scene-only.

• Current Seller/Courier verification uses no Government ID; Trust projection has NEW/REBUILDING/ESTABLISHED/TRUSTED with no count cap.

• Approved pool/paid Ready/Courier acceptance/one-active constraint and directional QR/OTP/Manual/delegate authorization pass.

• No Seller role changes provider payment truth; surcharge/compensation remain financial-domain facts.

• Cross-Seller/RLS, Valkey fail-closed fallback, audit attribution/redaction, compatibility and security/E2E/load gates pass before release.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 153. Build sequence

• Phase 0: stable ordinary identity/phone/Market and distinct privileged principal contracts.

• Phase 1: ordinary OTP authority/provider routing/rate limits and opaque MOBILE/CONSOLE sessions.

• Phase 2: internal Operator provisioning, strong credentials, typed OPERATOR sessions/recovery/revocation.

• Phase 3: ordinary Step-Up/recovery/phone lifecycle and no privileged recovery equivalence.

• Phase 4: responsibility-derived versioned Seller seed, semantic Scene/Courier actions and doc/seed CI comparison.

• Phase 5: known-person team invites, one-slot invariant, multi-role union/audit and explicit Seller context.

• Phase 6: Console/Companion surface checks, public Product/Seller/Scene eligibility and private-resolution safeguards.

• Phase 7: Courier/connected Handoff/delegation and Operator workflow/approval integrations.

• Phase 8: additive identifier/principal migration, historical audit preservation, RLS/security/load/production certification.

## 154. Latest technology stack

The system uses the current Adulis canonical implementation stack. Appendix A maps each technology to Authentication/Authorization responsibilities.

## 155. Final system architecture

Ordinary Account and Operator Account are separate security principals. Their sessions, credentials, authorization and recovery remain independently typed inside the same modular monolith. PostgreSQL is canonical; Valkey/outbox/BullMQ support caches and consequences without creating authority.

![Explicit anonymous, ordinary, privileged and trusted service contexts](graphics/AUTH_05.svg)
*Figure 05. Explicit anonymous, ordinary, privileged and trusted service contexts. Modes change acting relationships, not identity; separate Operator and delegate receipt boundaries remain.*

![Typed sessions and independently scoped authorization](graphics/AUTH_06.svg)
*Figure 06. Typed sessions and independently scoped authorization. MOBILE/CONSOLE sessions reference ordinary Accounts; OPERATOR sessions reference only internally provisioned Operator Accounts and strong credentials.*

## 156. Final authorization doctrine

Adulis never reasons: the user logged in, therefore they can do this. It reasons from credential -> Account -> target relationship -> standing -> role set -> permission -> surface -> Seller/resource scope -> entitlement/state -> Step-Up -> domain invariant.

Multiple roles are permitted inside one Seller team membership; multiple Seller team memberships are intentionally restricted during MVP. That restriction can later be relaxed without changing the underlying Account or permission architecture.

Operator authorization starts at a distinct internally provisioned principal and never traverses ordinary Account-to-grant promotion. Public Scene eligibility and valid Courier request semantics are enforced independently of role union, entitlements, UI visibility or a known resource identifier.

## 157. Canonical Current Architecture and Executable Permission Seed

Ordinary authentication retains phone OTP, opaque MOBILE/CONSOLE sessions, stable Account IDs, Step-Up and relationship-preserving recovery. Operator authentication resolves a separate internally provisioned principal with strong credentials, OPERATOR sessions and independent recovery/revocation.

Seller authorization uses responsibility-derived current Scene/Courier permissions, explicit context, additive roles inside one team membership, strict surfaces and server-owned domain invariants. Current public Search supports Product/Seller/Scene, PRIVATE Scenes remain inaccessible, Courier acceptance governs assignment, provider/backend governs payments, and no Government-ID verification or unapproved standalone Creator principal is added.

APPENDIX A - UPDATED TECHNOLOGY PLACEMENT

| Layer | Canonical technology | Authentication / Authorization placement |
| --- | --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript | Auth modules, guards, policy/application services and REST endpoints. |
| ORM / DB | Drizzle ORM; PostgreSQL | Accounts, OTP challenges, sessions, memberships, role assignments, grants, recovery and audit. |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements | pg_stat_statements for query diagnosis; btree_gist available for constraint designs where useful; pg_trgm is platform-wide, not core Auth authority. |
| Async / cache | Valkey; BullMQ | Rate limits, bounded caches, coordination and asynchronous notifications/reconciliation. PostgreSQL remains canonical. |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript clients | Typed auth/bootstrap/team/role contracts consumed by first-party clients. |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js | Rate limiting, HTTP hardening and phone normalization. Console also uses secure cookies/CSRF. |
| Mobile | React Native; Expo; Expo Router; TanStack Query; SecureStore; Notifications; Updates; small Zustand | MOBILE session, role/capability bootstrap, secure token storage, mode routing. Camera/location belong to Handoff/Courier, not Auth truth. |
| Media | Cloudflare R2; Cloudflare CDN; Sharp | No direct Auth authority; linked TikTok identity can gate embed ownership workflows. |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 | Policy tests, Postgres constraints/RLS, mobile flows, Console flows and load. |
| Observability | Sentry; Pino; pg_stat_statements | Sanitized errors, structured security logs and DB performance. |
| Architecture control | dependency-cruiser | Prevents private domain repository imports and duplicated auth logic. |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS | CI permission-doc comparator, migrations, deploy, mobile release and security smoke tests. |

### Technology rules

• Valkey is the only current cache/coordination datastore name.

• No microservice extraction solely for authentication at MVP.

• No client-side permission source of truth.

• No Seller-team discovery service or talent-index infrastructure.

• No payment provider callback or client redirect can issue Seller payment authority.

### Appendix B - Canonical Seller Permission Catalogue v3.0

| Permission family | Exact canonical code |
| --- | --- |
| Orders & fulfilment | seller.orders:read |
| Orders & fulfilment | seller.orders:prepare |
| Orders & fulfilment | seller.orders:mark_ready |
| Orders & fulfilment | seller.orders:fulfilment_operate |
| Orders & fulfilment | seller.orders:courier_request |
| Orders & fulfilment | seller.orders:pickup_handoff |
| Payments & finance | seller.payments:read |
| Payments & finance | seller.finance:read |
| Payments & finance | seller.finance:settlement_account_update |
| Catalogue | seller.products:read |
| Catalogue | seller.products:write |
| Catalogue | seller.products:publish |
| Catalogue | seller.products:archive |
| Catalogue | seller.variants:read |
| Catalogue | seller.variants:write |
| Catalogue | seller.pricing:write |
| Catalogue | seller.product_media:manage |
| Inventory | seller.inventory:read |
| Inventory | seller.inventory:write |
| Inventory | seller.inventory:confirm |
| Inventory | seller.inventory:history_read |
| Scene content | seller.scene_posts:read |
| Scene content | seller.scene_posts:write |
| Scene content | seller.scene_posts:publish |
| Scene content | seller.scene_posts:archive |
| Scene content | seller.scene_posts:tag_products |
| Scene content | seller.content_media:manage |
| Scene content | seller.content_moderation:respond |
| Buyer communication | seller.inbox:read |
| Buyer communication | seller.inbox:reply |
| Claims | seller.claims:read |
| Claims | seller.claims:respond |
| Claims | seller.claims:evidence_submit |
| Claims | seller.claims:remedy_propose |
| Chatbot | seller.chatbot:read |
| Chatbot | seller.chatbot:configure |
| Chatbot | seller.chatbot:test |
| Chatbot | seller.chatbot:analytics_read |
| Analytics | seller.analytics:business_read |
| Analytics | seller.analytics:product_read |
| Analytics | seller.analytics:content_read |
| Analytics | seller.analytics:fyp_read |
| Analytics | seller.analytics:inventory_read |
| Analytics | seller.analytics:chatbot_read |
| Analytics | seller.analytics:quality_read |
| Store & verification | seller.store:read |
| Store & verification | seller.store:profile_update |
| Store & verification | seller.store:location_update |
| Store & verification | seller.store:fulfilment_update |
| Store & verification | seller.store:availability_update |
| Store & verification | seller.verification:read |
| Store & verification | seller.verification:submit |
| Courier administration | seller.couriers:read |
| Courier administration | seller.couriers:invite |
| Courier administration | seller.couriers:application_review |
| Courier administration | seller.couriers:relationship_manage |
| Courier administration | seller.couriers:compensation_update |
| Team administration | seller.team:read |
| Team administration | seller.team:invite |
| Team administration | seller.team:roles_manage |
| Team administration | seller.team:remove |
| Seller security | seller.sessions:read |
| Seller security | seller.sessions:revoke |
| Trust & safety reads | seller.reviews:read |
| Trust & safety reads | seller.trust:read |
| Trust & safety reads | seller.moderation:read |
| Ultimate control | seller.ownership:transfer |
| Ultimate control | seller.lifecycle:close |

### Appendix C - Executable Role Grants and Derived Counts

The following Python seed is executable after copying the canonical code list below. The explicit specialist sets are responsibility-derived; OWNER derives all codes and ADMIN excludes only ultimate control. A generated permission-definition catalogue also attaches route-specific surfaces/fresh-proof requirements; grants never override those constraints.

```
PERMISSIONS = (
    'seller.orders:read',
    'seller.orders:prepare',
    'seller.orders:mark_ready',
    'seller.orders:fulfilment_operate',
    'seller.orders:courier_request',
    'seller.orders:pickup_handoff',
    'seller.payments:read',
    'seller.finance:read',
    'seller.finance:settlement_account_update',
    'seller.products:read',
    'seller.products:write',
    'seller.products:publish',
    'seller.products:archive',
    'seller.variants:read',
    'seller.variants:write',
    'seller.pricing:write',
    'seller.product_media:manage',
    'seller.inventory:read',
    'seller.inventory:write',
    'seller.inventory:confirm',
    'seller.inventory:history_read',
    'seller.scene_posts:read',
    'seller.scene_posts:write',
    'seller.scene_posts:publish',
    'seller.scene_posts:archive',
    'seller.scene_posts:tag_products',
    'seller.content_media:manage',
```

```
'seller.content_moderation:respond',
    'seller.inbox:read',
    'seller.inbox:reply',
    'seller.claims:read',
    'seller.claims:respond',
    'seller.claims:evidence_submit',
    'seller.claims:remedy_propose',
    'seller.chatbot:read',
    'seller.chatbot:configure',
    'seller.chatbot:test',
    'seller.chatbot:analytics_read',
    'seller.analytics:business_read',
    'seller.analytics:product_read',
    'seller.analytics:content_read',
    'seller.analytics:fyp_read',
    'seller.analytics:inventory_read',
    'seller.analytics:chatbot_read',
    'seller.analytics:quality_read',
    'seller.store:read',
    'seller.store:profile_update',
    'seller.store:location_update',
    'seller.store:fulfilment_update',
    'seller.store:availability_update',
    'seller.verification:read',
    'seller.verification:submit',
    'seller.couriers:read',
    'seller.couriers:invite',
    'seller.couriers:application_review',
```

```
'seller.couriers:relationship_manage',
    'seller.couriers:compensation_update',
    'seller.team:read',
    'seller.team:invite',
    'seller.team:roles_manage',
    'seller.team:remove',
    'seller.sessions:read',
    'seller.sessions:revoke',
    'seller.reviews:read',
    'seller.trust:read',
    'seller.moderation:read',
    'seller.ownership:transfer',
    'seller.lifecycle:close',
)
```

```
ROLE_GRANTS = {}
ROLE_GRANTS['OWNER'] = set(PERMISSIONS)
ROLE_GRANTS['ADMIN'] = set(PERMISSIONS) - {
    'seller.ownership:transfer', 'seller.lifecycle:close'
}
```

```
ROLE_GRANTS['SALES_SUPPORT'] = {
    'seller.chatbot:read',
    'seller.claims:evidence_submit',
    'seller.claims:read',
    'seller.claims:remedy_propose',
    'seller.claims:respond',
    'seller.couriers:read',
    'seller.inbox:read',
    'seller.inbox:reply',
    'seller.moderation:read',
    'seller.orders:read',
    'seller.payments:read',
    'seller.reviews:read',
    'seller.trust:read',
}
```

```
ROLE_GRANTS['INVENTORY'] = {
    'seller.couriers:read',
    'seller.inventory:confirm',
    'seller.inventory:history_read',
    'seller.inventory:read',
    'seller.inventory:write',
    'seller.moderation:read',
    'seller.orders:courier_request',
    'seller.orders:fulfilment_operate',
    'seller.orders:mark_ready',
    'seller.orders:pickup_handoff',
    'seller.orders:prepare',
    'seller.orders:read',
    'seller.payments:read',
    'seller.pricing:write',
    'seller.product_media:manage',
    'seller.products:archive',
    'seller.products:publish',
    'seller.products:read',
    'seller.products:write',
    'seller.store:read',
    'seller.trust:read',
    'seller.variants:read',
    'seller.variants:write',
}
```

```
ROLE_GRANTS['ANALYST'] = {
    'seller.analytics:business_read',
    'seller.analytics:chatbot_read',
    'seller.analytics:content_read',
    'seller.analytics:fyp_read',
    'seller.analytics:inventory_read',
    'seller.analytics:product_read',
    'seller.analytics:quality_read',
}
```

```
ROLE_GRANTS['CAMPAIGN_MANAGER'] = {
    'seller.analytics:chatbot_read',
    'seller.analytics:content_read',
    'seller.analytics:fyp_read',
    'seller.analytics:product_read',
    'seller.analytics:quality_read',
    'seller.chatbot:analytics_read',
    'seller.chatbot:configure',
    'seller.chatbot:read',
    'seller.chatbot:test',
    'seller.content_media:manage',
    'seller.content_moderation:respond',
    'seller.inventory:read',
    'seller.moderation:read',
    'seller.products:read',
    'seller.scene_posts:archive',
    'seller.scene_posts:publish',
    'seller.scene_posts:read',
    'seller.scene_posts:tag_products',
    'seller.scene_posts:write',
    'seller.variants:read',
}
```

```
assert len(PERMISSIONS) == len(set(PERMISSIONS))
assert all(g <= set(PERMISSIONS) for g in ROLE_GRANTS.values())
role_counts = {role: len(grants) for role, grants in ROLE_GRANTS.items()}
permission_count = len(PERMISSIONS)
role_grant_count = sum(role_counts.values())
# CI: extract the versioned documentation code/grant sets, then compare exactly.
# assert documented_codes == set(PERMISSIONS)
# assert documented_role_grants == ROLE_GRANTS
```

Computed result: 68 permissions; OWNER 68; ADMIN 66; SALES_SUPPORT 13; INVENTORY 23; ANALYST 7; CAMPAIGN_MANAGER 20; total grants 197. INVENTORY has no extra Claim/support or Store-setting mutation solely to preserve a previous numeric target.

### Appendix D - Surface and Semantic Enforcement

| Permission group | Console / Mobile rule | Domain constraint |
| --- | --- | --- |
| Product/Variant/pricing/media authoring | Console only for full authoring/configuration. | Current target/Seller/Market, exact permission and domain state. |
| Scene/media/tag/moderation response | Console only. | Minimum valid available tag/full publication gates; no price/stock/Order authority. |
| Order read/prepare/Ready/selected fulfilment/request/Pickup | Console + scoped operational Companion where granted. | PAID/current selected mode; request requires approved pool and Ready; Courier must accept. |
| Inventory read/write/confirm/history | Console; Mobile allows only explicitly scoped urgent operations. | No bulk/unbounded mutation; exact stock canonical. |
| Inbox/Claim support | Console + permitted support Companion where granted. | Resource/case scope; no Claims adjudication/payment truth. |
| Analytics/chatbot configuration | Console; support may read approved escalation context. | Privacy-reduced Analytics; no arbitrary raw-record access. |
| Team/pool/compensation/store/finance/security/ownership | Console administration; fresh proof where required. | Owner-only transfer/closure; no paid repricing or privilege escalation. |
| Operator actions | Separate ops origin and OPERATOR principal only. | Strong auth/capability/case/approval; never ordinary Seller seed. |

The complete unchanged executable Python seed is also supplied as Contract_Registry/auth_permission_seed.py. Contract_Registry/seller_permissions.json and seller_permission_types.ts are generated from it. Validation/validate_contracts.py executes the seed, checks unique codes/grants and scans all current document sources. These are static/executable design-fixture checks; no deployed authorization or step-up integration test is asserted.

## 158. Glossary

| Term | Definition |
| --- | --- |
| Ordinary Account | Immutable public Buyer/Seller/Courier identity. |
| Operator Account | Separate internally provisioned privileged principal; no public promotion. |
| Authentication | Proof of control of the appropriate ordinary or privileged credential. |
| Authorization | Server decision for exact action/resource/scope/state/freshness. |
| Opaque Session | High-entropy credential with hashed canonical server-side state. |
| Audience | Validated session/client security boundary; not request-selected authority. |
| MOBILE | Ordinary Buyer/Seller Companion/Courier session audience. |
| CONSOLE | Ordinary Seller administration audience with route/surface checks. |
| OPERATOR | Privileged audience bound only to operator_account_id/strong credential. |
| Step-Up | Recent purpose-bound ordinary sensitive-action proof; not Operator recovery. |
| Seller Ownership | Relationship deriving OWNER; outside team membership slot. |
| Seller Team Membership | Current maximum one non-terminal team relationship per ordinary Account. |
| Role Assignment | Versioned additive non-OWNER role inside one team membership. |
| Effective Permission | Role union further constrained by surface/scope/state/domain gates. |
| Scene Post | Canonical Seller image content whose PRIVATE state cannot resolve publicly. |
| Product Post | One Product commerce object reached through Search/tags/detail. |
| Courier Profile | Persistent ordinary-user capability with approved private pool relationships. |
| Seller Courier Pool | Seller-specific approved relationship, independent of staff membership. |
| Delivery Request | Semantic approved-pool offer request requiring Courier acceptance. |
| Delegated Recipient | Final Order receipt authority only, with name/phone binding. |
| Public Projection | Safe current eligible Product/Seller/PUBLIC Scene response. |
| Trust Gate | Domain-owned eligibility consequence; Auth never sets Seller Trust. |
| REBUILDING | Public Trust standing after formerly stronger Seller standing deteriorates. |
| Transactional Outbox | Committed security/team consequences relayed after commit. |
| Valkey | Non-canonical caches/rate/queue support; no revocation/permission authority. |
| BullMQ | Async notification/reconciliation jobs without identity authority. |
| Shoppable Post | Superseded former term for Scene Post. |

## 159. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-11 — Buyer account controls and deletion parity | The 13 October Privacy/Auth designs govern account lifecycle and deletion. | Authenticated Buyer account controls include Edit Profile, saved discovery area, Appearance, notification preferences, Privacy & Security, Help & Support, Delete Account and Sign Out. Delete Account uses verification, consequence preview, authoritative blockers and typed confirmation; Mobile and Website must share policy wording/data rather than independently reauthoring deletion consequences. Sign Out changes session state only. | PR-006, 27 Oct 2026 |
| R-12 — Seller roles and team presentation | ADU-AUTH-02 v3.2 already defines Owner-derived ownership, Admin plus four specialist roles and multi-role union. | Canonical Seller roles remain Owner (derived, never assignable), Admin, Analyst, Campaign Manager, Inventory and Sales Support. A member may hold multiple non-Owner roles; effective access is the union subject to surface/resource/domain checks. Active membership cannot be left with zero role. No Seller role confirms payment, sets Trust, decides Claims, creates Handoff evidence or edits Reviews. Ownership transfer and Seller closure remain Owner-only. Prototype role matrices and member-edit UX now reflect this design. | PR-007, 27 Oct 2026 |
| R-15 — Courier offer eligibility and sequence | The 13 October designs already require Courier acceptance and one active accepted delivery. | A direct Delivery Offer may be sent only to a Courier who is in the Seller’s Approved pool relationship, Adulis-verified, AVAILABLE and has no active accepted delivery. BUSY Couriers may remain visible for context but are disabled with reason. UNAVAILABLE, restricted, pending, removed or non-approved Couriers are ineligible. Seller request/offer never equals assignment; Courier acceptance atomically rechecks eligibility/capacity. Mark Ready precedes offer. Offer timing must respect the one-active-delivery rule. | PR-008 correction, 27 Oct 2026 |
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
