# Adulis Operator Console - Staff Operations
Version 3.1 | 12 October 2026 | DOCUMENT-CORRECTED

## Document control

Complete amended baseline: 12 October 2026. The supplied correction prompt and owner decisions supersede the conflicting reviewed source wording. Every original numbered body section and unaffected table/graphic is retained; targeted contracts, examples, tests, invariants and dependent definitions are reconciled. The historical audit remains unchanged.

| Document control | Amendment baseline |
| --- | --- |
| Version history | 3.0S reviewed 8 October 2026 -> 3.1 amended 12 October 2026. |
| Source | ADU-OPS-01_Adulis_Operator_Console_System_Design_v3.0_Staff_Operations.pdf |
| Authority | 19 selected corrections / F01-F18 and owner product decisions. |
| Status | DOCUMENT-CORRECTED; implementation, integration tests and external approvals not established. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |

## 1. System definition

The Adulis Operator Console is the privileged human decision, support, moderation, investigation and governance surface for the Adulis platform.

It exists for operations that ordinary Buyers, Sellers and Couriers cannot perform themselves. It is separate from the Seller Console and from the Company Website.

### Core jobs

- review operational cases and evidence;

- moderate Product Posts, Scene Posts, Reviews and seller safety issues;

- resolve Claims, recovery and identity-review work;

- support manual Handoff Verification when QR and OTP cannot complete a physical handoff;

- communicate with Buyers for support/compliance and controlled Review outreach;

- govern operator access, configuration, audit and incident response.

It is not a database editor, SQL console, customer-impersonation tool, payment dashboard, deployment shell or hidden super-admin.

## 2. Authoritative baseline and supersession rules

Newest explicit approved Adulis decisions and this reconciliation supersede affected September assumptions. Preserve the document's dedicated Founder or Staff operating model; do not import the other model's approval path silently.

Current baseline: Product Posts are canonical commerce objects; image-led Scene Posts are the only top-level FYP units; public Marketplace Search includes Products, Sellers and Scenes; Scene tags are same-Seller and require current availability for public publication/visibility. Content derives PRIVATE/restoration independently from moderation.

Operator uses a distinct internal privileged Account with strong isolated authentication/authorization/recovery, never public Account promotion. Seller admission uses account/phone/social/business evidence rather than Adulis Government-ID imagery. Trust has NEW, REBUILDING, ESTABLISHED and TRUSTED, with no listing cap.

Provider/backend payment truth, one-Seller Orders, immutable zero-bps merchandise surcharge and separate paid Courier delivery charge/compensation, approved Pool/Network requests, one active accepted delivery, connected recipient Handoff and best-effort Pickup/Delivery checkpoint evidence define current operational context. Live-route tracking is not part of this baseline.

## 3. Security principle

Operators issue explicitly authorized domain commands. They never directly edit canonical business records.

Operator intent -> Operator authorization -> evidence/policy checks -> specific domain command -> canonical domain -> append-only audit -> derived consequences.

An operator cannot arbitrarily set Order state, payment success, Trust Level, Inventory quantity, Review rating or Courier custody because they have privileged access.

## 4. Why the Operator Console is a separate surface

The Seller Console is Seller-scoped; the Operator Console is platform-scoped. Combining the two would mix incompatible authorization models and increase compromise blast radius.

### Recommended origins

adulis.<tld> Company Website shop.adulis.<tld> Seller Storefront seller.adulis.<tld> Seller Console

```
ops.adulis.<tld>   Operator Console
api.adulis.<tld> Core API media.adulis.<tld> Public media/CDN
```

The Company Website lives in the separate adulis-web repository. Operator Console remains in adulis-platform and shares no authenticated browser cookie with Seller Console or Storefront.

## 5. Platform context and separate Operator Account

Operator Account is a separate privileged internal account class/security principal. It is not an ordinary public Adulis Account and cannot be obtained by upgrading a Buyer/Seller/Courier Account or attaching privileged access to that Account.

A person may independently have a personal ordinary Account and an internal Operator Account. Their authentication, sessions, credentials, suspension, deletion, revocation and recovery are separate. Compromise or recovery of one does not silently establish control of the other.

No public signup, Mobile mode/registration, Company Website application or ordinary-account promotion provisions Operator access. Public Accounts have no prerequisite role in internal provisioning.

![Separate internal Operator principal](graphics/OPS-S_01.svg)
*Figure 01. Separate internal Operator principal. Personal public Accounts and privileged Operator Accounts have independent authentication, sessions, lifecycle and recovery.*

## 6. No impersonation

Hard invariant: an operator never logs in as a Buyer, Seller or Courier and never assumes their session.

Operator support must explain or perform operator-authorized actions under the operator's own identity. Audit must read "Operator X performed Y", never falsely attribute the action to a customer.

## 7. No generic edit-user or edit-order screen

Do not create a form with arbitrary Phone, Trust, Order state, Payment, Seller status and Save controls.

Each mutation is a named command owned by the correct domain. This prevents privileged UI from bypassing Order, Payment, Trust, Review, Handoff, Inventory and authorization invariants.

## 8. Operator authentication strength

Operator access requires phishing-resistant authentication such as WebAuthn/passkey, hardware security key, or managed identity with equivalent phishing-resistant MFA.

Ordinary Account/phone recovery is unrelated to Operator enrollment or privileged recovery. Operator access requires the internal principal and phishing-resistant credential; SMS OTP never creates a privileged session.

## 9. Dedicated OPERATOR session audience

Use a dedicated OPERATOR session audience. Do not reuse Seller CONSOLE or Mobile session semantics.

Seller authorization is Account + Seller relationship + Seller permission. Operator authorization is separate Operator Account + active Operator role/capability assignment + operator permission/capability + object/policy scope.

## 10. Operator session cookie

Use an origin-specific host-only session cookie such as __Host-adulis_ops_session with HttpOnly, Secure, SameSite=Strict, Path=/ and no Domain attribute.

The cookie is never shared with seller.adulis.<tld>, shop.adulis.<tld> or the Company Website.

## 11. Login, enrollment and recovery

Operator identifier -> strong Operator credential/WebAuthn assertion -> active Operator Account -> active role/capability authorization -> dedicated OPERATOR session. Privileged login never resolves through an ordinary Buyer/Seller/Courier Account.

Controlled internal provisioning establishes the Operator principal and restricted strong-credential enrollment. Required approvals, credential enrollment and explicit authorized role/capability assignments precede activation. No SMS-only privileged login, shared master password or impersonation is allowed.

Operator recovery follows privileged internal recovery policy: authorized independent review, strong verification, credential/session revocation, controlled re-enrollment, cooling/notifications where defined and immutable audit. Recovering a personal Account or its phone never restores Operator access.

## 12. Session lifetime and reauthentication

Operator sessions are short-lived, stateful and immediately revocable. Idle and absolute lifetimes are centrally configurable.

Fresh WebAuthn reauthentication is required for permanent seller termination, exceptional recovery, operator-grant changes, production configuration changes, break-glass activation, restricted export, Solo Coverage activation where applicable, and other policy-designated sensitive commands.

## 13. CSRF and request authorization

Every state-changing Operator request requires valid OPERATOR session + exact Origin validation + CSRF token/header + operator capability check + domain authorization + idempotency where the command may be retried.

UI visibility is never the authorization boundary.

## 14. No PWA and no offline operations

Operator Console is online-only. Do not install a service worker that stores operational data and do not build offline mutation queues.

If the secure platform cannot be reached, privileged operations are unavailable. This is intentional.

## 15. Browser caching and local persistence

Authenticated Operator responses use Cache-Control: private, no-store; sensitive evidence uses no-store.

Do not persist Claims, messages, identity data, payment records, Handoff evidence, audit results or session tokens in localStorage, IndexedDB or Cache API. Keep only bounded in-memory UI state.

## 16. Role model and capability authorization

Current canonical operator roles remain SUPPORT, MODERATOR, CLAIM_REVIEWER, IDENTITY_REVIEWER and ADMIN.

ADMIN means operator access, governance, security/configuration and audit authority. It does not automatically inherit every evidence-reading or case-decision capability.

Backend authorization should use centrally seeded capability codes, for example ops.account:search, ops.moderation:decide, ops.claim:decide, ops.identity:attest, ops.recovery:decide, ops.handoff:manual_verify, ops.audit:read, ops.operator_access:manage and ops.config:approve.

Roles attach only to Operator Accounts. Assignments are least-privilege, versioned, revocable, auditable and historically attributable. Removing access immediately invalidates relevant OPERATOR sessions. Example capability codes are contract illustrations; the implementation may retain its existing approved catalogue without forcing a new database table name.

## 17. Capability isolation

An Operator Account may hold several internal roles/capability assignments, but each audited action identifies the exact acting Operator Account and assignment/capability snapshot used. Multi-role authority never changes the security principal into an ordinary Buyer/Seller/Courier Account.

ADMIN has no automatic restricted-evidence bypass. Backend authorization checks current capability, purpose/case, resource scope and standing for every command/read; frontend visibility is usability only.

## 18. Post-hire operator composition

### POST-HIRE GOVERNANCE RULE

After operations employees are hired, the COO/CTO becomes the executive owner of Operator Console operations and team governance.

The CEO does not work routine queues, does not approve normal cases and should have no active routine Operator Account access. Executive reporting belongs in separate business/analytics reporting, not privileged case access.

COO/CTO holds ADMIN and only the operational roles needed for actual work. Employees receive narrow SUPPORT, MODERATOR, CLAIM_REVIEWER and IDENTITY_REVIEWER grants according to responsibility.

Provision Operator Accounts internally only for hired/authorized personnel. Employee personal Accounts are neither a prerequisite nor deleted by Operator termination.

## 19. COO/CTO governance model

The COO/CTO manages staffing, queue policy, escalations, quality, operator access, sensitive approvals and incident response.

The Console must not depend on CEO availability. Team schedules, delegated qualified approvers and operator access are governed inside the operations organization.

## 20. Employee role separation

Employees work only queues matching their grants. Support cannot become Claim Reviewer by opening another URL; Moderator cannot read verification/recovery evidence simply because a case references a Seller.

The COO/CTO may hold multiple roles, but audit records the capability actually used. ADMIN is not an all-evidence bypass.

## 21. Team workload management

COO/CTO views queue load, unclaimed age, SLA risk, operator availability, assignment/lease state and escalations.

Use queue claiming/assignment rather than permanently routing every case through the COO. The COO intervenes on high-risk, escalated, quality or staffing issues while employees process routine authorized work.

## 22. Employee absence and continuity

If an employee is unavailable, leases expire/reassign without changing business state. COO/CTO may reassign work to another qualified operator or process it directly if they hold the capability.

There is no Founder Solo Coverage toggle in this operating model. Continuity uses team coverage, on-call scheduling, delegated grants and only true emergency break-glass.

## 23. Navigation architecture

### Primary navigation

Overview Work Queues

```
Support
Moderation
Claims
Identity
Recovery
Trust Appeals
Handoff Manual Review
Search Sellers Accounts Governance
```

```
Configuration
Operator Access
Approvals
Audit
System Health
```

Buyer Communication / Review Outreach may appear within Support/Orders rather than as a separate unrestricted messaging app.

## 24. Overview

Overview is an operational briefing, not a vanity dashboard.

Show urgent Claims, oldest unresolved work, moderation backlog, identity/recovery work, Handoff-manual-review requests, Trust appeals, safety restrictions, pending approvals, failed Review-reminder jobs, security warnings, queue health and active payment/provider incidents where relevant.

## 25. Unified work-queue architecture

Use ops.work_item as an operational reference to canonical domain cases. It does not duplicate Claim, Moderation, Identity, Recovery or Handoff truth.

Suggested fields: id, source_domain, source_ref, queue, priority, assigned_to, claimed_at, lease_expires_at, workflow_state, created_at, resolved_at, market_id.

Work-item state describes operator workflow only.

## 26. Work claiming and leases

Claiming a work item creates a short lease. If the operator disappears, the lease expires and the item returns to the queue without changing business state.

Another authorized operator may read where policy allows. Final domain commands still use canonical optimistic/pessimistic concurrency so two decisions cannot silently overwrite each other.

## 27. Staff work lifecycle

Routine work: OPEN -> CLAIMED -> IN_REVIEW -> DECIDED/RESOLVED, with WAITING/ESCALATED where another team/domain response is required.

High-risk actions create an approval request before the domain command. Examples: permanent seller termination, exceptional recovery, internal Operator ADMIN access assignments, restricted export, production configuration and other policy-designated consequential decisions.

Higher-risk approval uses two distinct qualified Operator Accounts, a frozen proposed command and execution-time authorization; self-approval is prohibited. Delegated qualified approvers avoid COO/CTO throughput dependency.

![Staff risk-based approvals](graphics/OPS-S_02.svg)
*Figure 02. Staff risk-based approvals. Routine authorized work can proceed singly; higher-risk frozen commands need an independent qualified approver and quality review.*

## 28. COO/CTO quality governance

Management view should show queue age, escalation rate, reversal/appeal outcomes, restricted-data accesses, Manual Handoff rate, Review-reminder health and quality-sampling results.

Do not optimize employees only for cases/hour. Incorrect fast decisions can damage Buyers, Sellers and Trust more than slower correct decisions.

## 29. Quality sampling

Sample resolved cases for policy adherence and evidence quality using random plus risk-based selection.

Quality review never rewrites history. If an error is found, issue a corrective domain command and linked audit event.

## 30. Escalation ladder

```
Front-line operator -> qualified senior/second reviewer -> COO/CTO -> security/legal/privacy specialist where 
applicable.
```

Escalation is domain/risk based. Evidence access remains capability-scoped at every level.

## 31. Shift handoff

Use append-only case notes, work-item state and explicit assignment so the next operator can continue safely without copying sensitive data into external chat tools.

Shift handoff surfaces P0/P1 items, waiting approvals, deadlines, provider incidents and Manual Handoff cases.

## 32. Priority model

### Suggested internal priorities

P0 - active severe user/platform safety or security incident; P1 - money, locked-account, Handoff or trust urgency; P2 - ordinary Claims, moderation, recovery or identity work; P3 - non-urgent review/administrative work.

Priority is policy/configuration, not personal operator preference.

## 33. Internal response targets

Response targets are internal operational objectives, not public promises. Configure them per market, queue and staffing evidence.

P0 should be handled immediately; P1 within the current working period where practical; ordinary P2/P3 according to staffing capacity and published support commitments.

## 34. Global Search

Controlled lookup may support Account, Seller, seller-specific Order, checkout session, provider payment reference, Claim, Product Post, Scene Post, Review, Report, Courier assignment and Handoff reference.

Search should favor intentional identifiers such as Order reference, Claim reference, Seller handle, Product reference, public post reference and exact phone only where the role permits.

Operator Global Search can intentionally resolve non-public Scene references for authorized investigations. Buyer Marketplace Search is separate and launches with PRODUCT_POST, SELLER and publicly eligible SCENE_POST results; investigation access cannot authorize Buyer disclosure.

## 35. Search privacy and audit

Results expose the minimum information needed to identify the right record. Sensitive search input is not retained indefinitely by default.

Record operator, search category, target type, timestamp and request ID. High-risk search patterns and repeated enumeration attempts are security signals.

## 36. Restricted-data boundary

### Three data levels

A - operational summary; B - restricted personal information; C - isolated evidence such as provider payment/reconciliation detail, verification/recovery attestation, protected chat excerpts or sensitive Handoff evidence.

Level C never preloads simply because a case page opened.

## 37. Reason-for-access

Restricted reads require a structured reason code and, when applicable, a case/work-item reference. Examples: CLAIM_REVIEW, ACCOUNT_RECOVERY, IDENTITY_REVIEW, HANDOFF_MANUAL_REVIEW, LEGAL_REQUEST, SECURITY_INVESTIGATION.

Free text may supplement but must not replace controlled reason codes.

## 38. Payment and financial evidence access

The gateway model replaces the old buyer-bank-screenshot workflow as the canonical payment path.

Sensitive financial evidence now primarily means provider transaction identity, verified payment state, Chapa/provider reconciliation metadata, refund/remedy records and exceptional Claim evidence. Reads are authorized server-side, logged atomically and never trust a caller-supplied role.

Raw provider secrets, webhook signatures and full provider payloads never enter the browser.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

## 39. Verification/recovery evidence access

Verification/recovery evidence is isolated behind server-authorized read services. The Operator Account must have the specific current capability, case scope and recorded reason-for-access; ADMIN alone grants no sensitive-evidence bypass.

Return only the phone/account-control, social-account-control, Seller/business, admission-exception or recovery evidence necessary for the authorized decision. Do not preload or locally persist it. Adulis Seller verification has no national-ID, passport, government-card, ID-scan, selfie-matching or government-identity-image collection/viewing workflow. Provider-owned PSP KYC stays with the provider.

## 40. Evidence viewer and watermarking

Restricted evidence viewer: memory-only, no public URL, no shared cache, no analytics capture, logged access and time-limited authenticated delivery.

For especially sensitive evidence, overlay operator Account, case reference and access timestamp as deterrent/watermark. This is not DRM and does not alter canonical evidence.

## 41. Controlled evidence export

Do not provide a bulk download browser. Legitimate legal/support exports are generated by an Evidence domain workflow as a bounded time-limited package with reason, scope, actor and audit.

Exports must respect data-residency, retention and jurisdiction policy.

## 42. Support queue

Support handles Account access questions, Order/payment-status explanation, seller setup issues, app problems, notification problems, account-deletion status questions and routine escalation.

Support may explain canonical state; it may not manually convert unpaid to paid, mark a delivery completed, change Trust or edit Inventory.

## 43. Operator-to-Buyer communication

Authorized Operators may message Buyers for support/compliance purposes. Messages are clearly labeled as Adulis/Operator communication, audited and scope-limited.

Operator messaging does not impersonate the Seller and cannot silently mutate commerce state. Message content follows retention/privacy policy and uses canonical conversation anchors where relevant.

## 44. Post-handoff Review outreach

Apply this existing cadence to FINAL_HANDOFF and VERIFIED_ORDER_FAILURE eligibility. One Buyer/Order Grant has one schedule; failure evidence never fabricates a Handoff date. Current Reviews eligibility and this variant’s Operator communication governance remain mandatory.

After a completed Delivery Handoff, Adulis may send a Review call-to-action through Operator-labeled chat plus notification delivery.

### Server schedule

T+1 day from first AVAILABLE Order Grant issuance - first request. T+3 days from first AVAILABLE Order Grant issuance - second request if still eligible and no action/response according to policy. T+10 days from first AVAILABLE Order Grant issuance - final request if still eligible. Then stop.

BullMQ schedules the jobs; Valkey is supporting queue state, not canonical Review eligibility. Cancel future reminders when the Buyer submits the relevant Review, becomes ineligible or policy suppresses outreach. Every send is deduplicated and audited.

## 45. Moderation queue

Moderation receives Product Post reports, Scene Post reports, Review reports, seller-safety reports, relevance/tagging reports and automated risk flags.

Adulis does not have open social-media comments as a product feature; therefore there is no generic social-comment moderation queue. Reviews are verified-purchase content and follow Review moderation policy.

## 46. Moderation case workspace

Display reported target, exact published revision/version, reporter category, reason, content snapshot, relevant Seller/Product, current availability, prior moderation history, current market, policy version and allowed decisions.

Editing content later must not erase the reported version/evidence.

## 47. Product Post and Scene Post moderation

Product Posts are canonical commerce representations; Scene Posts are commerce-linked creative content. Current Scene Posts may tag only Product Posts owned by the same Seller and must remain materially relevant to those Products.

Moderation can act on prohibited products, misleading claims, stolen/abusive content, irrelevant tagging, unsafe media and policy violations while preserving evidence.

Inventory-driven PRIVATE is not a moderation violation. Moderation still addresses prohibited products, misleading claims, unsafe/abusive/stolen media, irrelevant tagging and policy violations using exact revision/evidence. RESTORE cannot override stock-derived eligibility; no generic Scene visibility editor is allowed.

## 48. Moderation decisions

Decision vocabulary comes from the Moderation domain, for example NO_ACTION, RESTRICT, REMOVE, RESTORE, SELLER_SAFETY_SUSPEND and ESCALATE.

No client-only moderation states. Public removal must not delete evidence needed for appeals, Claims, Trust or audit.

## 49. FYP moderation integration

Current Buyer FYP serves Scene Posts only. Therefore restricting a Scene Post must invalidate/exclude it from eligible FYP delivery.

Restricting a Product Post affects Product detail, Shop/Search, Storefront and tagged-product eligibility. A Product Post is not a top-level FYP unit.

Operators never edit ranking scores directly.

FYP candidates contain PUBLIC eligible image-led Scene Posts only, never top-level Product Posts. Privacy/moderation/stock eligibility is checked before ranking; Operators inspect algorithm/rollout/health/experiments/fallback and never edit individual organic rank.

## 50. Deferred recommendation features

Similar Finds and Complete the Scene are not active product features. Operator Console must not expose live moderation/configuration controls that imply these modules are currently available.

Future recommendation extensions require an explicit later product decision and versioned configuration.

## 51. Temporary safety action and permanent termination

A qualified Moderator may apply immediate temporary restriction when necessary to stop an active safety incident. Permanent seller termination remains a separate high-risk domain command with stronger reauthentication and approval according to the active operating model.

Safety action must account for active paid Orders, Claims, Courier delivery and evidence retention rather than erasing transaction state.

## 52. Claim queue

Claims remain human-reviewed for material outcomes. The gateway model changes payment evidence, not the need for dispute resolution.

Examples: provider payment succeeded but Seller does not fulfil, stock failure after paid Order, goods not received, materially not as described, promised refund/remedy not completed, Handoff/Courier dispute.

## 53. Claim evidence set

Attach canonical evidence early: Order snapshots and transitions, provider payment reference/verified status, Inventory events, Product Post snapshot, relevant Scene Post/version if attribution matters, chat excerpts, Seller actions, Courier request/offer/assignment and checkpoint evidence where relevant, Pickup and Delivery Handoff evidence, Review/Trust context, refund/remedy records and audit.

Do not include any obsolete pre-payment hold lifecycle.

Current delivery evidence includes paid charge/compensation snapshots, the relevant delivery request/offer/assignment, Pickup/Delivery Handoff records, bounded checkpoint evidence, failed-delivery/return facts and authorized final-recipient delegation. The Buyer remains Claim/refund/Review owner. No unrelated Seller pool or Buyer Chat history is exposed to a delegate.

## 54. Claim decision and downstream effects

The reviewer chooses only a valid Claim-domain outcome. Backend determines downstream actions such as Trust recomputation, seller restrictions, remedy/refund workflow, notifications and analytics facts.

Operator never updates Seller Trust Level directly. If a remedy/refund is supported, it must execute through the Payment/Order domain and provider adapter; the reviewer does not fabricate payment state.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 55. Claim appeals

Appeals should normally be reviewed by a qualified operator who did not make the original decision. Evidence and policy version used by the original decision remain immutable references.

The active operating model defines who may approve the appeal and how staffing exceptions are handled.

## 56. Verification and Recovery queue

Verification/Recovery work covers ordinary Account and phone-loss recovery, Seller/social-account verification exceptions, authorized duplicate-account/security investigation and appeals. Seller admission remains social-commerce focused and uses phone/account control, social-account control, legitimate Seller/business information and applicable provider onboarding state.

IDENTITY_REVIEWER remains the role-family name, but current responsibility does not include Government-ID or selfie identity review. PSP KYC is provider-owned onboarding, not Adulis Seller-ID verification. Operator Account recovery is a distinct internal privileged workflow.

## 57. Seller verification and recovery attestations

Retain domain-owned admission/recovery decision evidence and attestations according to Privacy policy, with case/reason-scoped access and immutable decision audit. Current Adulis verification does not collect or store Seller Government-ID scans or selfie identity imagery.

Public Storefront receives only narrow approved verification indicators, never raw control/recovery evidence, provider KYC records or Operator notes. Do not expose sensitive verification evidence through public derivative/CDN pipelines.

## 58. Ordinary Account and Operator Account recovery

Ordinary user Account recovery restores only that Account through its dedicated recovery policy. Operator Account recovery restores only the distinct privileged principal through internal authorized review and strong verification.

Privileged recovery may require another authorized Founder/governance approver, credential/session revocation, controlled re-enrollment, cooling/notification controls and immutable audit. Recovery of a personal Account never grants, reactivates or recovers Operator access.

## 59. Trust appeals

A Trust appeal targets underlying evidence, policy application or stale/incorrect source facts. Operators cannot select a Trust Level from a dropdown.

Valid corrections feed the owning domain, then Trust recomputes from canonical evidence. The public level changes only as a consequence of that recomputation.

Public Trust Ladder labels are NEW, REBUILDING, ESTABLISHED and TRUSTED. REBUILDING identifies a formerly ESTABLISHED/TRUSTED Seller that fell below Established requirements. No Trust level caps Product listings; no paid policy buys Trust. Correct source evidence -> owning domain persists -> Trust recomputes; Operators have no Trust-level selector.

## 60. Seller safety page

Seller safety view composes current Seller status, public eligibility, moderation restrictions, active paid Orders, open Claims, Courier activity, Trust facts and recent operator actions.

Actions are explicit domain commands with allowed_actions from the server. No generic status editor.

## 61. Account page and sessions/devices

Account view provides a privacy-minimized summary of Account standing, seller/courier relationships, security events and sessions/devices where the operator has access.

Session revocation is a security command with audit. Operators do not receive customer credentials or secrets.

## 62. Account deletion support boundary

Account deletion is an orchestrated Account Lifecycle workflow owned by adulis-platform. Company Website, Mobile and other frontends only request the workflow.

Operator Console may inspect deletion status, active blockers, retention/legal-hold reason and failures where authorized, but it never runs DELETE FROM users or directly erases media/domain tables.

The lifecycle coordinates Auth, Orders, Claims, Seller resources, Chat, Notifications, Media, FYP/recommendation data, analytics identities and required retention/anonymization.

## 63. Privacy/data requests

Data-access/export, correction and deletion-support requests use dedicated Privacy/Account Lifecycle workflows with jurisdiction/residency policy. Operator accesses are audited and restricted to the minimum necessary data.

Do not use general evidence-export tools as an informal privacy-export mechanism.

## 64. Handoff Verification System

Pickup: Seller displays the purpose-bound PICKUP QR -> assigned Courier scans -> server verifies custody transfer. Final Courier Delivery: Courier displays DELIVERY QR -> Buyer or authorized delegated recipient scans -> server verifies final receipt. Direct Buyer Collection/Seller Delivery: Seller displays final receipt QR -> Buyer/delegate scans. Presenter/giver displays; recipient scans.

QR is primary, stage-specific OTP is fallback, and Manual Verification is emergency recovery through an authorized Operator/domain workflow. Every method requires server connectivity and uses the same state machine, actor/stage/Order/assignment checks, expiry, single use and replay controls. A disconnected device cannot record local acceptance for later synchronization.

Buyer may authorize one final recipient using name and phone before final credential issuance. Verify the designated phone for app scanning, or send final-delivery OTP to that phone when scanning is unavailable. Delegation transfers no Order ownership, payment/refund rights, Claim ownership, Review eligibility or Buyer Chat history; Review rights remain with the Order Buyer.

![Current Handoff stage and recipient protocol](graphics/OPS-S_03.svg)
*Figure 03. Current Handoff stage and recipient protocol. Recipient-directed OTP and Collection delegates; governed lockout recovery; connected final receipt.*

## 65. Manual Handoff Verification

Manual Verification is an emergency path when QR and OTP cannot complete the handoff. An authorized Operator reviews Order, Seller, Buyer, assigned Courier, current state, previous attempts, timestamps, location evidence where available and support context.

The Operator approves or rejects through the Handoff domain. Record verification_method=MANUAL, operator identity, reason and support/case reference. Manual review never silently bypasses Order-state rules.

Review distinguishes the Order Buyer from one authorized final recipient and checks stage-specific custody/receipt facts. Record actor_operator_account, capability, policy, exact Handoff stage, delegate where applicable, reason, case and method=MANUAL. Delegate identity receives no Buyer history or rights. Checkpoint capture failure is non-blocking and cannot substitute for Handoff proof.

| Mode / stage | Presenter -> intended recipient | QR / OTP / Manual / transition |
| --- | --- | --- |
| Buyer Collection / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Seller displays / recipient scans; OTP to recipient; expressly authorized presenter may submit recipient-supplied code. Governed Manual; accepted final receipt. |
| Seller Delivery / final DELIVERY | Current Seller actor -> Buyer OR active authorized delegate | Same direction; no Courier pickup. Governed Manual; accepted final receipt. |
| Courier / PICKUP | Seller actor -> current assigned Courier | Seller displays / Courier scans; OTP to Courier. Governed Manual; custody only, no Buyer feedback Grant. |
| Courier / final DELIVERY | Current assigned Courier -> Buyer OR active authorized delegate | Courier displays / recipient scans; OTP to Buyer/delegate. Governed Manual; final receipt. |

Manual acceptance from LOCKED is an explicit Handoff owner transition with current reason/evidence/audit and this variant’s approval governance. No ordinary actor unlocks it; expired/revoked credentials remain invalid and replacement is a new governed generation.

## 66. Courier Checkpoint Location Evidence

Courier Checkpoint Location Evidence consists of exactly two best-effort foreground/on-demand capture opportunities: PICKUP and DELIVERY, immediately around the corresponding accepted/eligible Handoff context. No periodic or background samples, live Buyer/Seller maps, movement routes or tracking projections are part of MVP.

Fulfilment validates the Courier, active assignment, Order, checkpoint purpose and Handoff context. Evidence may include coordinates, accuracy, client capture time, server receipt time and capture result/status. Capture failure or denied permission never invalidates an otherwise valid connected QR/OTP/Manual Handoff, proves custody, or completes an Order.

Precise location is sensitive, purpose-limited evidence. General logs/analytics redact coordinates; Operator access requires an authorized case, capability and reason-for-access. No general map of Courier movement or unrelated Seller relationship data is exposed.

![Two bounded evidence checkpoints](graphics/OPS-S_04.svg)
*Figure 04. Two bounded evidence checkpoints. Foreground attempts at Pickup and Delivery support evidence; valid connected Handoff is independent of location availability.*

Courier Delivery uses exactly two best-effort foreground/on-demand location checkpoints: PICKUP and DELIVERY. No background permission, periodic sampling, live map, movement/route history or queued tracking stream. Ordinary Buyer/Seller responses and notices show safe milestones only, never precise coordinates. Coordinates remain restricted to existing approved purpose/case-access policy and minimum retention; no raw logs/Analytics export. Valid connected QR/OTP/Manual Handoff works when location is denied; GPS never proves receipt.

## 67. Gateway payment authority

Payment success is owned by the backend Payment domain after server-side provider verification. Chapa is the initial gateway where configured; global markets may use different approved providers later.

The Operator Console displays canonical provider state. Browser redirects, screenshots or Seller assertions do not establish payment success.

## 68. No seller payment confirmation

The old manual Seller-confirmation model is superseded. Operators therefore must not support a workflow that asks the Seller to "confirm payment received" or lets Support manually flip payment state.

If canonical provider state appears wrong, open Payment reconciliation/support workflow and preserve audit.

## 69. Multi-cart and seller-specific Orders

### POST-HIRE GOVERNANCE RULE

Buyer multi-cart may coordinate Products from several Sellers, but each Seller creates a separate Order, payment attempt, fulfilment path, Claim scope and Handoff chain.

Operator views may link Orders to a shared checkout session for context, but no cross-Seller super-order is created. Decisions remain seller/order scoped.

## 70. Order support and lifecycle

### POST-HIRE GOVERNANCE RULE

Operator Order views are read models over canonical Orders. Key states reflect checkout/payment, paid fulfilment, Courier pickup/delivery and completion.

Provider-paid state must never be reverted because a client disconnected. Duplicate callbacks/commands are idempotent. Operators cannot use a manual Order-state selector.

MVP Fulfilment supports Private Courier Pools and the Cross-Seller Courier Network. One persistent Courier identity may have approved relationships with multiple Sellers; standing pool membership is distinct from an Order request, offer or assignment. Only case-relevant Seller relationships may be exposed.

Maximum ONE active accepted delivery per Courier and at most one active assignment per Seller Order are enforced atomically by canonical domain/database rules. Relationships with several Sellers do not permit simultaneous deliveries, multi-stop batching or route optimization.

After provider-verified payment, Seller prepares and marks READY_FOR_DELIVERY before Fulfilment creates a request/offer workflow. Assignment is not a prerequisite for Mark Ready. DIRECT_REQUEST targets one eligible approved Courier; POOL_REQUEST may offer to multiple eligible approved Couriers, with first valid acceptance winning atomically.

Current closed transaction policy is a launch-disabled zero Buyer-side Adulis Checkout surcharge, equal to 0 basis points, backend-calculated on eligible merchandise value under versioned Commercial Policy. Courier Delivery charge is a separate line item excluded from this basis under current policy.

Buyer sees the Seller-defined Courier Delivery charge before PSP payment. For MVP it equals the immutable Courier compensation snapshot for that Seller Order; the delivery offer uses that same amount/currency and terms version. Seller rate changes or Operator actions cannot rewrite paid compensation or historical surcharge.

Evidence separates Product subtotal, Courier Delivery charge (or approved Seller Delivery charge), Adulis Checkout surcharge, applicable provider-authorized Buyer fee, approved tax/regulatory charges and the server-calculated total. Provider fees/taxes are included only where ratified and supported. Seller subscriptions, plans/pricing, advertising and broader future packages remain separately governed/open; Trust cannot be purchased.

![Paid and Ready before Courier request](graphics/OPS-S_05.svg)
*Figure 05. Paid and Ready before Courier request. Immutable paid compensation flows into approved offers; atomic acceptance enforces one active accepted delivery before directional Handoffs.*

## 71. Reviews

### POST-HIRE GOVERNANCE RULE

Adulis feedback is Review, not social comment. Product Review eligibility requires canonical purchase history for the exact Product/Order line and required completion/Handoff conditions.

Operators may moderate Review policy violations and investigate evidence, but cannot create fake Buyer reviews, change ratings, or remove a negative Review merely because a Seller disputes it.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 72. Product Post, Scene Post and visibility context

Scene Post is Seller-authored image-led merchandising/discovery content with one or more valid same-Seller Product Post tags. Product Post is the canonical structured commerce representation of exactly one sellable Product; Scene revisions never own durable Product price or stock.

Initial public publication requires at least one valid Product Post tag, at least one tagged Product with an eligible purchasable in-stock Variant, and passing Seller, Market, media and moderation checks. Zero tags or no available tagged Product rejects the public publication command.

When the last eligible available tagged Product becomes unavailable, Content keeps publication_state=PUBLISHED and changes visibility PUBLIC -> PRIVATE, with reason ALL_TAGGED_PRODUCTS_OUT_OF_STOCK for stock depletion. This is system-derived commerce visibility, not archival or Moderation removal. If another tag remains eligible and available, the Scene may remain PUBLIC while the unavailable tag resolves current truth.

Content re-evaluates restock or restored Product eligibility against every current public gate. A stock-driven PRIVATE Scene automatically returns to PUBLIC only when at least one tag is available and all gates pass. Independent moderation, Seller suspension, archival/removal or other restrictions still block restoration.

PRIVATE Scenes are excluded from every Buyer/public FYP, Search, Storefront/profile, deep-link and Collection resolution. Seller management retains the Scene with a clear Private badge/reason; notify the Seller on automatic privacy/restoration. A retained Collection membership does not reveal private content. Restricted Operator investigation remains separately authorized and audited.

![Current eligibility runs before every new controlled Scene delivery](graphics/OPS-S_06.svg)
*Figure 06. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 73. Global day-one market model

Adulis is global-ready from Day 1. Operator objects carry market_id and relevant country/region policy context rather than assuming Ethiopia for every workflow.

Market configuration governs seller eligibility, payment providers, fulfilment options, languages, legal policy, location behavior and support rules.

## 74. Time and timezone rules

Canonical API instants are UTC ISO 8601 timestamps. Human Operator UI shows Order/Market local time using configured IANA timezone, with clear timezone labels where ambiguity exists.

Cross-market queues must never silently convert all customer deadlines to the operator workstation timezone. Audit should preserve canonical UTC while UI can show local context.

## 75. Commercial policy boundary

Current closed transaction policy is a launch-disabled zero Buyer-side Adulis Checkout surcharge, equal to 0 basis points, backend-calculated on eligible merchandise value under versioned Commercial Policy. Courier Delivery charge is a separate line item excluded from this basis under current policy.

Buyer sees the Seller-defined Courier Delivery charge before PSP payment. For MVP it equals the immutable Courier compensation snapshot for that Seller Order; the delivery offer uses that same amount/currency and terms version. Seller rate changes or Operator actions cannot rewrite paid compensation or historical surcharge.

Evidence separates Product subtotal, Courier Delivery charge (or approved Seller Delivery charge), Adulis Checkout surcharge, applicable provider-authorized Buyer fee, approved tax/regulatory charges and the server-calculated total. Provider fees/taxes are included only where ratified and supported. Seller subscriptions, plans/pricing, advertising and broader future packages remain separately governed/open; Trust cannot be purchased.

Operator Console consumes approved versioned Commercial Policy and immutable Order evidence. It offers no unrestricted rate/plan editor, retroactive paid-compensation editor or payment-success toggle. Future Seller packaging does not make the existing transaction rule undefined.

## 76. Configuration governance

Runtime configuration uses typed schemas, versions, proposals and approvals - never unrestricted JSON/SQL editing.

Examples: market activation, seller eligibility, Trust thresholds, recommendation version activation, feature flags, mobile version floor, OTP operational limits, moderation policy, retention policy, payment-provider enablement and review-reminder policy.

## 77. FYP configuration boundary

Operator Console may display active recommendation algorithm version, rollout, fallback/health and experiment state. It should not expose a giant unreviewed ranking-weight editor.

Current FYP contract is Scene Posts only. Product Posts belong to Search/Shop/Storefront and product-tag flows.

## 78. Payment-provider configuration

Provider configuration is secret-sensitive and market-scoped. Operator UI may expose safe status such as enabled provider, environment, health and last reconciliation time.

Credentials/webhook secrets remain in secret management, not PostgreSQL fields rendered to Operators. Changes require strong reauthentication and approval according to the operating model.

## 79. Feature flags

Feature flags control exposure/rollout; they never grant authorization or establish business truth.

Do not expose active flags for features explicitly absent from the current product as if they were launch-ready. Similar Finds, Complete the Scene and cross-Seller Scene tagging remain out of current scope.

## 80. Operator role/capability assignment model

Internal Operator role/capability assignments attach to a separate Operator Account. They are versioned, least-privilege, historically attributable and auditable. Retain assignment/revocation history rather than erasing past authority.

Authorized provisioning/access administration: authorize person -> provision or select internal Operator Account -> scoped roles/capabilities -> reason -> fresh WebAuthn -> required independent approval -> versioned assignment -> secure notification. Never select a public Adulis Account for promotion.

Revocation or termination disables the privileged principal/access and invalidates relevant OPERATOR sessions immediately. Unrelated personal Buyer/Seller/Courier Accounts remain independently governed. No specific new table name is mandated.

## 81. Audit architecture

Use append-only audit.operator_action (or equivalent) with actor Operator Account, active role/capability snapshot, action, target, work_item_id, reason, policy version, request ID, domain-event reference, approval reference, operating-model metadata and occurred_at.

Audit events are never edited or deleted. Corrections are new linked events.

## 82. Case notes

Case notes are append-only. They should reference canonical evidence instead of copying full bank/provider details, identity numbers, large chat transcripts or precise Courier routes into free text.

Corrections create a new note linked to the prior note.

## 83. Decision proposal and approval record

Use explicit proposal/approval objects rather than hiding review inside UI state.

### Suggested structures

```
ops.decision_proposal(id, work_item_id, proposed_by, command_type, payload_hash, reason, policy_version, 
created_at, status)
ops.approval_request(id, proposal_id, requested_by, approver_id, decision, decided_at, expires_at, reason)
```

The proposed command payload is frozen. Approval cannot silently authorize a different payload.

## 84. Staff approval architecture

Dual control is risk-based rather than required for every routine case.

High-risk commands require two distinct qualified Operator Accounts. A reviewer proposes the exact command; a second qualified operator or COO/CTO approves according to policy. Self-approval is prohibited.

Routine support explanations and low-risk decisions may complete with one properly authorized operator when domain policy permits.

## 85. COO/CTO approval responsibility

COO/CTO is the default governance owner for sensitive escalations and may approve high-risk employee proposals.

The architecture may designate another qualified senior operator for specific approval classes so operations do not become a single-person bottleneck. Delegation is explicit, scoped and auditable.

## 86. No CEO approval dependency

No normal workflow waits for CEO review/approval of Claims, moderation, identity, recovery, Handoff or routine platform operations.

If later corporate governance requires CEO approval for a non-operational corporate matter, it belongs outside the normal Operator case workflow.

## 87. Staff self-approval invariant

For dual-control actions: requested_by != approved_by and reviewer_operator_account_id != approver_operator_account_id.

No routine Solo Coverage exception exists. True continuity emergencies use break-glass with heightened audit/alerts and should be rare.

## 88. Transition from Founder Operations

1. Hire/train and authorize operations employees.

2. Provision separate internal Operator Accounts through an authorized privileged administrator.

3. Enroll phishing-resistant Operator credentials.

4. Assign narrow versioned roles/capabilities and complete required approvals before activation.

5. Confirm COO/CTO Operator Account and governance capabilities.

6. Establish qualified secondary approvers for designated high-risk classes.

7. Switch operating_model to STAFF_TEAM.

8. Disable Founder Solo Coverage; normal staff continuity uses queues, leases, qualified coverage and shifts, with true break-glass only under emergency policy.

9. Disable/revoke CEO routine Operator Account access and sessions when unnecessary; preserve any unrelated CEO personal Account.

10. Activate team assignment, quality sampling and shift governance; retain all Founder-era audit history unchanged.

Do not convert employees' or founders' personal Accounts into privileged principals. CEO is not a normal queue worker/approver and routine Staff Operations never waits for CEO availability.

## 89. Break-glass

Break-glass is a narrowly scoped emergency security mechanism, not a hidden super-admin. Activation requires strong reauthentication, reason, short expiry, prominent alerts and post-incident review.

Break-glass must not bypass audit. It should create more telemetry than ordinary actions.

## 90. System Health

Operator Console shows product-operational health, not infrastructure administration or a deployment shell. Preserve API incident state, provider health, queue lag, Valkey/BullMQ, PostgreSQL, media/CDN, notification/SMS and Review-reminder health.

Courier signals are delivery-request backlog, offer failures/expiry, assignment conflicts, one-active-delivery constraint failures, checkpoint-evidence submission failures and Manual Handoff rate. Location evidence failure is operationally observable but never a completion blocker.

Scene signals include automatic PRIVATE/restoration failure, stale public delivery and eligibility-consumer/invalidation lag. Canonical truth remains PostgreSQL; health widgets do not become domain mutation controls.

## 91. Operator notifications

In-app operator inbox can surface assigned work, approval requests, P0/P1 incidents, access/security alerts, grant changes and review-required events.

External notifications must contain minimal information and deep-link back to authenticated Operator Console rather than include Claim/identity/payment details in email/SMS/push.

## 92. Frontend technology

Operator Console remains a private React + strict TypeScript web application. A conventional SPA is appropriate because it has no SEO/public-rendering requirement.

Recommended Operator-web layer: React, Vite, React Router, TanStack Query and generated TypeScript API client. Form handling can use a focused React form library, but server/domain validation remains authoritative.

Do not copy Mobile-only Expo libraries into Operator Console.

## 93. Canonical repository structure

### Current main platform boundary

```
adulis-platform/
apps/
mobile/
seller-console/
operator-console/
src/
auth/ overview/ work-items/ search/ support/
moderation/ claims/ identity/ recovery/ trust-appeals/
handoff-review/ buyer-communication/ accounts/ sellers/
approvals/ configuration/ operator-access/ audit/ system-health/
tests/
storefront/
api/
worker/
packages/
api-contracts/ design-system/ tokens/ schemas/ locale/
analytics-events/ money/ dates/ permission-catalogue/ handoff-contract/
```

```
adulis-web is a separate Company Website monorepo. Frontends never import Drizzle repositories or database 
credentials.
```

## 94. Backend technology and module map

Backend: Node.js, NestJS, Fastify, strict TypeScript, Drizzle ORM and PostgreSQL.

Relevant modules: Auth/Authorization, Operator Access, Ops Workflow, Moderation, Claims, Identity/Verification, Recovery, Trust, Seller, Account Lifecycle/Privacy, Catalogue/Inventory, Content/Media, Checkout/Payments, Orders, Fulfilment/Handoff/Courier, Chat/Notifications, Analytics and Market Configuration.

Operator controllers authorize and delegate to owning application/domain services. They never mutate another domain repository directly.

## 95. PostgreSQL extensions

pg_trgm supports bounded text search where appropriate; btree_gist supports exclusion/range constraints where useful; pg_stat_statements provides query visibility.

PostgreSQL remains canonical business truth. Operator workflow tables do not duplicate domain state.

## 96. Valkey and BullMQ

Valkey is used only for non-canonical cache, rate-limit/supporting ephemeral state and BullMQ backing. BullMQ runs durable asynchronous work such as Review reminders, notifications, cache invalidation, reconciliation support, exports and projection jobs.

If Valkey is unavailable, privileged business truth does not become editable or guessed. Degrade queues/caches safely and preserve PostgreSQL truth.

## 97. API contract

Use REST + OpenAPI + @nestjs/swagger + generated TypeScript client. Avoid parallel handwritten frontend DTO contracts.

Effect-producing POST/PATCH commands use idempotency where required. Responses may include allowed_actions/capabilities so the UI renders what the server currently permits without treating those fields as the security boundary.

API actor contracts distinguish operator_account_id and OPERATOR audience from ordinary account_id. Investigation APIs expose only scoped request/offer/assignment, compensation, Handoff/delegate and checkpoint facts. No public API provisions Operators or serves a movement route; only named domain commands produce consequences.

## 98. Security middleware and phone handling

@nestjs/throttler supports API abuse/rate controls; @fastify/helmet supplies secure HTTP headers; libphonenumber-js normalizes international phone input where operator workflows accept phone lookup/recovery data.

Operator origin uses strict CSP, Referrer-Policy and no third-party marketing scripts. Browser extensions/compromised workstation risk is addressed through no-store, minimal data, short sessions and audit.

## 99. Media and evidence infrastructure

Cloudflare R2 stores approved media/evidence objects according to domain policy; Cloudflare CDN serves public media. Sensitive Operator evidence is not exposed as public CDN URLs and must use authenticated time-limited delivery.

Sharp processes public Product/Scene media derivatives. Sensitive verification/recovery/payment evidence is not routed through public derivative pipelines unless its owning domain explicitly permits it.

## 100. Observability

Sentry captures Operator frontend/backend errors with strict redaction. Pino produces structured server logs. pg_stat_statements protects PostgreSQL performance and helps diagnose slow privileged queries.

Never send complete evidence payloads, OTPs, provider secrets, identity documents or chat bodies to Sentry/Pino by default.

## 101. Architecture control

dependency-cruiser enforces module/package boundaries. Operator frontend cannot import backend persistence code. Operator Access/Ops Workflow cannot bypass owning domain interfaces.

Architecture checks run in CI.

## 102. Testing strategy

Jest: unit/domain/UI logic. Testcontainers: PostgreSQL/Valkey integration, audit/approval constraints, idempotency and real permission behavior. Playwright: Operator authentication, role isolation, evidence access, queue/approval workflows, no impersonation, browser security. k6: queue/search/read/write load under production-like data. Maestro is for Mobile Buyer/Seller/Courier flows, not Operator Console browser E2E.

## 103. Critical E2E scenarios

Preserve strong login, access revocation, no ADMIN evidence bypass, Claim/remedy outcomes, Product/Scene and verified-purchase Review moderation, gateway investigation, Account deletion support, leakage prevention, approval concurrency, audit immutability and compromised-session revocation tests.

Add: public Account/phone recovery cannot grant Operator access; provisioning uses a separate Operator Account; sensitive evidence needs case/reason/capability; no Adulis Seller-ID imagery workflow; four Trust labels and no listing cap.

Scene tests reject zero tags/all-unavailable publication, hide the last-available-tag Scene without archival, distinguish stock-driven PRIVATE from Moderation, and restore only after every current gate passes. PRIVATE content cannot leak through FYP/Search/Storefront/Collections or stale caches.

Courier tests cover approved Pool/Network privacy, atomic competing acceptance, one active accepted delivery, paid compensation snapshot equality, Mark Ready before request, Pickup Seller-display/Courier-scan, Delivery Courier-display/Buyer-or-delegate-scan, OTP/manual stage rules and connected-only verification. Both checkpoint attempts may fail without invalidating Handoff. Delegation never grants Buyer-owned rights.

## 104. Global/localization and accessibility

Operator UI is global-ready. English is baseline; additional locale support is Market-configured. Customer-generated content remains in its source language unless an approved translation workflow exists.

All times follow Market-local display + UTC API/audit rules. Target WCAG AA, keyboard operation, visible focus, semantic tables, screen-reader action announcements and non-color-only state communication.

## 105. Deployment and CI/CD

Delivery stack: Docker, GitHub Actions, Render and Cloudflare. EAS applies to Mobile, not Operator Console.

Suggested pipeline: dependency-cruiser -> typecheck/lint -> Jest -> Testcontainers -> build -> security headers/CSP tests -> Playwright -> staging deploy -> smoke/security checks -> production promotion. k6 runs against production-like staging for capacity/security gates.

## 106. Environment and secret handling

Development, staging and production use separate PostgreSQL, Valkey, R2/media namespaces, provider credentials, Sentry projects and Operator role/capability assignments.

Production data must not be copied into staging. Chapa/provider secrets, WebAuthn server configuration and signing material live in managed secrets, never frontend environment bundles or operator-readable database rows.

## 107. Failure behavior

Evidence unavailable: fail closed for decisions that require it; preserve case and retry. Audit unavailable: block sensitive mutation rather than perform unaudited action. Notification failure: domain decision remains canonical; retry async delivery. Stale case: server returns conflict/current state. Grant revoked: next request/session check fails immediately. Payment-provider outage: historical verified state

remains readable; no manual success override. Valkey/BullMQ outage: canonical state remains safe; queued side effects recover from durable/outbox sources where designed.

## 108. Transactional outbox

Cross-domain side effects such as moderation->FYP invalidation, Claim->Trust recomputation, Handoff->Review eligibility and Account deletion events use transactional outbox/event processing so database commit and async effects cannot silently diverge.

BullMQ jobs are idempotent consumers; queue delivery is not canonical fact.

Commit canonical PostgreSQL changes plus outbox intent in the same transaction. Relay after commit -> BullMQ on Queue Valkey -> idempotent consumer -> reconciliation. Notifications/projections and cache Valkey are supporting infrastructure; no additional overlapping job engine is required.

![Commit first, relay after commit](graphics/OPS-S_07.svg)
*Figure 07. Commit first, relay after commit. PostgreSQL owns truth; BullMQ/Queue Valkey support idempotent consequences with independent reconciliation and separate cache failure semantics.*

## 109. Runbooks

Maintain reviewed runbooks for suspected Operator compromise, passkey loss, provider outage, Valkey/BullMQ outage, audit pipeline issue, verification/recovery evidence leak, incorrect moderation, Handoff Manual Verification abuse, payment reconciliation discrepancy and Account deletion failure.

Runbooks identify who may act under the current operating model.

## 110. What not to build

Do not build: generic database editor; SQL console; customer impersonation; shared admin password; root bypass; offline Operator Console; Operator mobile app; WebSocket-everything; unnecessary separate physical Operator database/service; bulk financial/verification/recovery evidence browser; one-click permanent account deletion; manual Trust selector; manual Order-state selector; fixed commission editor; deployment shell; secret viewer; payment-success override; generic social-comment moderation.

## 111. MVP / current launch scope

Current Operator scope: strong auth, Operator Accounts and role/capability assignments, Overview, queues, search, Seller/Account/Order summaries, Product/Scene moderation, Reviews, Claims, gateway payment evidence, Verification/Recovery, Trust appeals, Seller safety, Manual Handoff Verification, Buyer support messaging, Review-reminder oversight, Audit, approvals, basic configuration visibility and System Health.

## 112. Can follow after initial operations

Later, based on real staffing/volume: advanced assignment, quality sampling, operator performance review, privacy automation, richer policy authoring, sophisticated risk investigation, controlled bulk operations, dedicated privacy/risk roles and advanced analytics.

Do not prematurely add microservices or a data warehouse solely because Operator Console exists.

## 113. Build sequence

Tier 0 Security: ops origin, OPERATOR audience, WebAuthn, stateful session, CSRF, strict CSP/no-store. Tier 1 Operator Access: separate principals, internal provisioning, permission catalogue, bootstrap, assignments and revocation. Tier 2 Work Infrastructure: Overview, work_item, assignment, notes, search, proposal/approval. Tier 3 Moderation + Reviews + content versioning. Tier 4 Claims + provider payment evidence + Trust consequences. Tier 5 Seller Verification + ordinary/Operator Recovery + Account Lifecycle support. Tier 6 Handoff Manual Review + Courier evidence. Tier 7 Buyer communication + Review reminder workflow. Tier 8 Governance, configuration, audit, system health and hardening.

Each tier has security/E2E gates before the next privileged capability ships.

## 114. Staff-model launch gates

### Before employee operations are enabled

- CEO routine Operator role/capability assignments are revoked/absent;

- COO/CTO governance role is active;

- employees have strong credentials and narrow grants;

- ADMIN does not imply all evidence access;

- high-risk dual-control has at least two qualified Operator Accounts;

- no self-approval on dual-control actions;

- team assignment/lease and escalation are tested;

- restricted evidence reads/exports are logged;

- payment/provider, Product/Scene, Review, Courier/Handoff and Account-deletion workflows match current platform designs;

- Review outreach scheduler is deduplicated/auditable;

- Valkey-only stack and current CI/security controls are verified.

- Separate internal Operator provisioning, credential/recovery isolation and immediate revocation are proven.

- STAFF_TEAM disables Founder Solo Coverage and has qualified secondary approvers, lease/shift continuity and random/risk-based quality review.

- Scene visibility/moderation distinctions, four Trust labels, narrow verification, paid Courier charge/compensation, one active assignment, delegate receipt and checkpoint-only evidence meet current platform rules.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 115. Final architecture - Staff Operations

Operations employees and COO/CTO use separate internal Operator Accounts with phishing-resistant authentication and isolated OPERATOR sessions on ops.adulis.<tld>. The React/strict-TypeScript Console presents role-scoped queues, reason-scoped evidence, shifts, escalation and risk-based approval.

NestJS/Fastify modular monolith delegates named commands through Operator Access/Ops Workflow to the owning Moderation/Reviews/Claims, Verification/Recovery/Account Lifecycle, Payments/Orders/Fulfilment/Handoff, Chat/Notifications/Trust and configuration services. PostgreSQL/Drizzle owns truth/audit/outbox; Valkey/BullMQ supports idempotent jobs; R2/CDN/Sharp and provider adapters keep evidence/media/payment boundaries explicit; Sentry/Pino/pg_stat_statements provide health signals.

Routine authorized low-risk work may complete with one Operator when policy permits. High-risk frozen proposals require an independent qualified approver, never self-approval. COO/CTO governs staffing/access/quality/escalation; delegated qualified approvers prevent bottlenecks. CEO has no normal approval dependency and Founder Solo Coverage is disabled.

![Shared canonical Platform architecture](graphics/OPS-S_08.svg)
*Figure 08. Shared canonical Platform architecture. Clients express intent through typed APIs; domains authorize and decide, PostgreSQL persists truth, and workers build projections.*

## 116. Final design philosophy - Staff Operations

The post-hire Operator Console scales through narrow roles, clear queues, risk-based dual control, measurable quality and COO/CTO governance - not a broad admin panel.

CEO leaves routine operations. COO/CTO leads the team. Sensitive actions remain attributable/evidence-driven, while routine work moves without turning the COO into a mandatory click for every low-risk case.

## 117. Glossary

| Term | Definition |
| --- | --- |
| Operator Account | Separate internally provisioned privileged security principal; independent of public Accounts and recovery. |
| Staff Operator | Hired/authorized employee with separate internal Operator Account and narrow access. |
| COO/CTO Governance | Operational ownership of staffing, access, escalation, quality and sensitive approval. |
| Operator Role | Named work responsibility assigned to an internal Operator Account. |
| Operator Capability | Explicit backend authorization for a scoped operation; ADMIN does not imply all evidence access. |
| Work Item | Claimable case/queue record with assignment, lease, evidence and auditable lifecycle. |
| Escalation | Risk/domain-scoped transfer to a qualified senior, COO/CTO or specialist. |
| Quality Review | Random and risk-based sampling with outcome/reversal learning. |
| Shift Handoff | Auditable case/queue continuity through notes, leases, assignment and pending approvals. |
| Break-Glass | Explicit bounded emergency access/action under policy, reason, audit and later review. |
| Scene Post | Seller-authored image-led discovery content with same-Seller Product Post tags and current eligibility. |
| Product Post | Canonical structured commerce representation of exactly one Product; current price/stock are domain-owned. |
| Private | Seller-only Scene visibility; excludes Buyer/public resolution. Authorized investigation is separate. |
| Courier Pool | Standing Seller-approved Courier relationships, separate from active delivery assignment. |
| Cross-Seller Courier Network | Approved opportunities/relationships across Sellers using one persistent Courier identity. |
| Courier Delivery Charge | Seller-defined Buyer checkout charge; equals immutable Courier compensation in MVP. |
| Checkpoint Location Evidence | Two best-effort foreground Pickup/Delivery captures; supporting evidence, never receipt authority. |
| Delegated Recipient | One Buyer-authorized final recipient by name/phone; no transfer of Order/Claim/refund/Review rights. |
| Handoff | Connected server-verified physical custody/receipt; giver displays QR and designated recipient scans. |
| REBUILDING | Formerly ESTABLISHED/TRUSTED Seller that fell below Established; distinct from NEW. |
| Trust Ladder | Evidence-derived NEW, REBUILDING, ESTABLISHED and TRUSTED; no Product-count cap. |
| Transactional Outbox | Durable event/intent recorded with canonical transaction, relayed after commit and reconciled. |
| Shoppable Post | Superseded former term for Scene Post. |
