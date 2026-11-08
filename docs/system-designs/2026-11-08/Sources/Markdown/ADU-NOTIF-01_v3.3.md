# Adulis Notifications
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-NOTIF-01_Adulis_Notifications_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Mission

The Adulis Notifications System decides which individual Account needs attention for which already-existing Adulis fact, through which channel, at what time, and for how long that message remains relevant. It never creates payment success, Order state, Handoff verification, Trust level, Claim outcome, moderation decision, Courier assignment or account authority.

```
DOMAIN FACT -> OUTBOX EVENT -> NOTIFICATION POLICY -> LOGICAL NOTIFICATION
            -> DELIVERY PLAN -> IN-APP / PUSH / LIMITED SMS
            -> DEEP LINK -> AUTHORITATIVE DOMAIN READ
```

## 2. Central invariant

Notifications are never business truth. A push saying "New paid order" does not make an Order paid. A Seller begins preparation only because the Payments/Order domains already established provider-verified payment success. A Courier push does not assign the delivery; the Fulfilment domain does. A Trust alert does not change a level; the Trust engine does.

## 3. Current supersessions

• Current commerce is PSP/backend-verified, one Seller Order at a time; Chapa remains an initial Market-configured provider. No Seller payment confirmation or obsolete long pre-payment reminder campaign remains.

• PostgreSQL retains logical Notifications, schedules, Deliveries and Attempts; Valkey/BullMQ is recoverable execution. Notification state mutations require connectivity.

• One ordinary human uses one ordinary Account across Buyer, Seller ownership/team and persistent Courier relationships. Different humans use different credentials. Multiple devices and Modes do not create new identities.

• Operator Account is a separate privileged principal with isolated OPERATOR credentials/session, capability and recovery. It is never an ordinary Account role or grant.

• Current content identities are Product Post and Scene Post. Content-owned SCENE_BECAME_PRIVATE / SCENE_BECAME_PUBLIC differs from Moderation restriction/restoration.

• English is source/default/fallback; current Ethiopia critical Amharic templates are founder-reviewed, and future language release requires human ownership.

## 4. What Notifications owns

• Notification policy evaluation and versioning.

• Recipient resolution from server-owned relationship/permission facts.

• Logical Notification records and account-level read/archive state.

• Delivery plans, per-channel Delivery rows and delivery-attempt history.

• Template selection, locale rendering and safe slot validation.

• Device push-target selection and provider adapters.

• Notification scheduling, dedupe, collapse, TTL, quiet-hours and frequency controls.

• Notification delivery observability, cost controls and reconciliation.

## 5. What Notifications does not own

• Account authentication, session issuance or Seller-team membership.

• Payment verification, Seller settlement, refunds or PSP credentials.

• Order transitions, Inventory, Courier assignment or Handoff verification.

• Review eligibility, Trust promotion/demotion, Claims adjudication or Moderation enforcement.

• OTP credential lifecycle for Auth or Handoff.

• The current truth shown after the user follows a deep link.

## 6. Domain events and transactional outbox

Owning domains write a transactional outbox record in the same PostgreSQL transaction as the business fact. Notification consumers process the event idempotently after commit. Domain code must not call Expo, an SMS provider or another transport inside the business transaction. Provider outages therefore cannot roll back a valid paid Order, Handoff, Claim decision or Trust transition.

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

## 7. Failure doctrine

Notification failure must degrade attention, not correctness. The in-app record is the durable user-facing recovery surface after the logical Notification has been created. Push and SMS are unreliable external transports. A user who misses a transport message must still recover by opening Adulis and reading current canonical state.

## 8. Architecture layers

Use separate durable logical records, target planning and attempt history. Recipient context is a scoped relationship, not a primary account purpose.

| Layer | Purpose | Canonical owner |
| --- | --- | --- |
| Domain event / outbox | Committed source-domain fact | Owning domain |
| Notification policy | Principal/context, class, channels, suppression, TTL, template | Versioned Notification policy |
| Logical Notification | One typed recipient plus one authorized contextual fact | Notification domain / PostgreSQL |
| Delivery | One planned eligible channel/target | Delivery history / PostgreSQL |
| Delivery Attempt | One provider execution/result | Audit/operations / PostgreSQL |
| Push/SMS | External attention only | Transport; no business authority |
| Deep-linked resource | Current authenticated domain state | Source domain |

### PART II - PRINCIPALS, RECIPIENT CONTEXT & DEVICES

One ordinary Account represents one human across ordinary relationships. A separate Operator Account represents privileged internal authority. Multiple people never share credentials; multiple devices do not multiply logical inbox records.

## 20. Ordinary Account relationships and separate Operator principal

One ordinary human uses one stable ordinary Adulis Account across Buyer capability, Seller ownership, Seller-team participation and a persistent Courier profile. Different humans use different Accounts and never share credentials. Ownership, team membership and Courier relationships are independent; a team Account may have multiple active roles whose current permissions compose within the exact Seller scope.

At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the ordinary Account's team slot. Seller ownership and many private Seller-Courier Pool relationships do not consume that slot. Switching Buyer/Seller/Courier Mode changes presentation and current context, never identity or authority.

Use a typed recipient principal ORDINARY_ACCOUNT or OPERATOR_ACCOUNT. Ordinary relationship context is BUYER, SELLER or COURIER; Seller context includes seller_id and source resource references. Operator context includes permitted work/case scope on the separate Operator surface.

Example: the same ordinary Account may receive PAYMENT_SUCCEEDED as Order Buyer, NEW_PAID_ORDER as authorized Seller operator and DELIVERY_OFFER_CREATED as Courier. Each has its own source-event/policy/context key. Correct contextual routing and permission revalidation preserve one identity without merging unrelated business scopes.

![Explicit anonymous, ordinary, privileged and trusted service contexts](graphics/NOTIF_01.svg)
*Figure 01. Explicit anonymous, ordinary, privileged and trusted service contexts. Modes change acting relationships, not identity; separate Operator and delegate receipt boundaries remain.*

## 21. Seller ownership recipient relationship

A Seller Owner receives notifications because their individual Account owns the Seller relationship or because a policy explicitly selects the Owner. Seller security, Trust changes and sensitive provider/settlement configuration alerts should include the Owner unless the owning domain establishes a narrower security rule.

## 22. Individual Seller-team recipients

Each team member authenticates separately. Recipient resolution is permission/action based, not "send to the Seller account". Examples: low-stock alerts go to accounts allowed to operate Inventory; Chat escalation goes to accounts allowed to answer Buyer messages; paid-order operational alerts go to accounts allowed to prepare/operate Orders; sensitive Seller security alerts may target Owner and authorized Admin recipients.

## 23. Multiple Seller roles on one team member

One Seller Team Member may hold several Seller roles inside the same membership. Notification recipient resolution uses the union of effective server-side permissions. It must not choose recipients from a client-supplied role label or stale UI state.

Recipient role union requires current membership standing and exact Seller resource permission. Enforce the one non-terminal ACTIVE/SUSPENDED team slot through Auth; ownership and Courier Pool relationships are separate. No fixed recipient roster or client-selected role list supplies authority.

## 24. Buyer-context recipients

Buyer-context notifications target the ordinary Account that owns the Order/payment/Claim/Review Grant. That same Account can also hold Seller/Courier relationships and receive independently scoped contextual notifications; its Seller/team/Courier role never permits reading another Buyer's resource.

Mode filters are presentation choices over currently authorized contexts. Only server-resolved ownership/relationships and source legality select recipients.

## 25. Separate Operator notification recipients

Operator Account is a separately provisioned privileged internal principal. A person may also hold an ordinary Account, but credentials, sessions, strong authentication, recovery, revocation and audit identity remain independent. Ordinary Account OTP, Seller roles, public registration and Mode switching never create Operator authority.

Privileged workflows require an isolated OPERATOR session, current explicit capability, exact resource/Market/case scope, strong authentication and freshness, plus approval when the existing Founder/Staff governance requires it. Restricted evidence needs its own current capability and case/purpose authorization; ADMIN supplies no universal bypass. Record operator_account_id, capability, policy, case/version, reason, request/time and applicable approval context. No impersonation or direct generic domain-state setter is introduced.

Operator notifications use recipient_operator_account_id and OPERATOR context, separate inbox, session, origin and device-registration boundary. Assignment/urgent-review/security notices are visible only through current Operator work/capability scope. Ordinary Mobile/Seller Console sessions and device registrations cannot retrieve or route these rows.

Routine Operator work is primarily in-app; incident/on-call alerting remains Observability policy. Operator external push, if explicitly enabled, requires a separately registered typed Operator target and safe content, never reuse of ordinary registration.

## 26. Courier-context recipients

A persistent Courier profile belongs to the same ordinary Account and can participate in many private Seller Pool relationships across the cross-Seller network. Offer/application/assignment notices use COURIER context and the exact Courier/profile/request/offer references.

Fan out only to currently eligible targeted Couriers. A Seller knowing the person or owning another business does not grant Courier assignment authority. Offer push is advisory; opening refetches status and atomic Fulfilment acceptance determines the winner.

## 27. No credential sharing

• Different humans use different ordinary Accounts; Owner and staff never share phone/session/token or an Owner session.

• One human may use Buyer, Seller and Courier relationships on the same ordinary Account.

• Separate Operator Accounts never share master credentials or ordinary recovery/sessions.

• Device registration derives the typed principal from the authenticated session, never a requested recipient ID.

• Moving a push token to another Account/principal atomically deactivates the previous active binding; it cannot simultaneously bridge ordinary and Operator boundaries.

## 28. Multiple devices are intentional

One ordinary Account can use Android, iPhone and permitted web sessions. Create one logical notification per principal/source-event/policy/context; then plan eligible PUSH delivery per active device. The web/mobile inbox shares account-level read state, while each device has its own permission and delivery outcome.

![One logical notice, many eligible device deliveries](graphics/NOTIF_02.svg)
*Figure 02. One logical notice, many eligible device deliveries. Dedupe is principal/source/policy/context scoped. Android/iPhone targets fan out only at Delivery planning; read state is account-level and OS permission is device-level.*

Seller Owner and staff remain different humans/Accounts even when each uses several devices. Operator multi-device targets, if enabled, remain separately authenticated and registered.

## 29. Device permission is per device

OS push permission, push token validity and last-seen state are device-local. If one Seller device denies push but another allows it, only the eligible device receives the push. In-app read state is account-level: reading the Notification on one device makes it read on the server, even though an already-displayed OS notification on another device may remain until the operating system clears it.

OS permission and delivery acceptance do not authenticate a principal or mark the logical Notification read. Ordinary Mode switching does not rebind the token or multiply inbox records.

## 30. Seller recipient resolution

Seller policies resolve recipients from current Seller ownership or eligible team membership plus effective permission union and exact source resource scope. Resolve at creation and revalidate at planning/send/open. Never store a permanent Seller-recipient roster or trust client role/Mode labels.

| Event family | Current recipient rule |
| --- | --- |
| New paid Seller Order | Owner / team ordinary Accounts with Order/preparation permission |
| Low stock | Current Inventory-responsible Accounts |
| Chatbot escalation | Current Inbox/reply permission |
| Claim action | Current scoped Claims response permission |
| Trust watch/level/recovery | Owner + current specifically authorized Trust readers; private reasons |
| Provider settlement/security | Owner + specifically authorized security/finance recipients |
| Product / Scene action | Current content-workflow permission |
| Scene PRIVATE / PUBLIC | Current authorized Seller content/availability recipients; Content cause |
| Moderation restriction/restoration | Current authorized affected Seller/content recipients; separate enforcement cause |

## 31. Recipient revocation and revalidation

If membership, permission, Courier assignment/offer or principal standing is revoked, cancel pending protected delivery when current authorization fails. Inbox and resource opening recheck current scope and hide stale protected rows/data. Personal Account security notices can remain visible to that Account after a Seller relationship ends.

Changing Mode never removes or creates canonical notification ownership. Revoked Operator capability/session is checked separately before internal delivery/read/open. No retained row or token restores lost authority.

### PART III - NOTIFICATION DOMAIN MODEL

Logical records are typed-principal/context scoped. Channel delivery is separate so multi-device fanout, retries and audits remain correct.

## 40. Logical Notification entity

One logical Notification has exactly one typed principal recipient and a closed context. Exactly one recipient FK is populated and agrees with recipient_principal_type. Context and source references are navigation/visibility metadata, never business mutation authority.

```
notification
  id
  recipient_principal_type  # ORDINARY_ACCOUNT | OPERATOR_ACCOUNT
  recipient_account_id? FK core.account
  recipient_operator_account_id? FK operator.account
  context_kind             # BUYER | SELLER | COURIER | OPERATOR
  seller_id? / courier_profile_id? / operator_work_ref?
  notification_type / notification_class
  source_event_id / subject_type / subject_ref
  policy_version / locale
  template_key / template_version
  rendered_title / rendered_body
  dedupe_key / collapse_key? / priority / suppressible
  created_at / read_at? / archived_at? / relevance_expires_at?
CHECK exactly one recipient FK is non-null
CHECK principal type agrees with populated FK
CHECK OPERATOR context requires OPERATOR_ACCOUNT
CHECK ordinary contexts require ORDINARY_ACCOUNT
```

Ordinary logical Notifications retain exactly one ordinary/Operator Account recipient. A no-Account delegate instead uses a narrow HANDOFF-owned external invitation transport intent on the existing SMS adapter. Bind authorization_id, generation, contact-purpose reference, expiry/revocation/suppression and durable dedupe/effect key; recheck current recipient generation immediately before dispatch. Message is minimal install/open/receipt context, no detailed Order or reusable secret. No dummy Account, phone-as-Buyer authority or extra Claim/refund/Review rights. Transport timeout may be ambiguous; reading/exactly-once global SMS delivery is never guaranteed.

## 41. Notification Delivery entity

```
notification_delivery
  id
  notification_id
  channel             # IN_APP | PUSH | SMS
  target_kind          # ACCOUNT_INBOX | DEVICE | PHONE
  target_ref
  state                # QUEUED | SENDING | SENT | DELIVERED | FAILED | CANCELLED | EXPIRED
  provider?
  provider_message_ref?
  next_attempt_at?
  expires_at?
  last_error_code?
  created_at / updated_at
```

Delivery target references are typed and scoped to the logical Notification principal. DEVICE targets must reference a currently active device binding for that exact principal; inbox targets use the corresponding ordinary or Operator surface. PHONE routing uses only the approved minimal security/delegate purpose. A delivery ref cannot supply authority to a domain mutation.

## 42. Delivery Attempt ledger

Every provider execution writes an attempt row with bounded, sanitized result codes. Do not store raw provider response bodies by default. Provider IDs may be retained when useful for reconciliation. Attempts never overwrite history.

## 43. Notification classes

| Class | Examples | Default behavior |
| --- | --- | --- |
| SECURITY_CRITICAL | New device; sensitive settlement configuration; session/security changes | Unsuppressible; bypass quiet hours; strongest routing |
| TRANSACTIONAL_CRITICAL | New paid Order; delivery ready; Claim evidence deadline; consequential Trust change | In-app always; push normally on; no marketing treatment |
| OPERATIONAL_ACTION | Courier offer; Courier pool action; Chat escalation; low-stock action | Push when time-sensitive; user/business preferences where safe |
| INFORMATIONAL | Claim resolved; export ready; Review published | In-app; push optional by policy |
| PROMOTIONAL | Future re-engagement/follow campaign | Not MVP-critical; suppressible; never SMS at launch |

## 44. Suppressibility

Suppressibility is part of policy, not a UI guess. Security-critical notifications cannot be disabled. Optional push preferences may be disabled without deleting the in-app history. A Courier who does not want offer pushes should change Courier availability; an expiring offer should not be silently suppressed while the Courier is marked AVAILABLE.

## 45. Notification preferences

Ordinary preferences belong to the stable Account and policy category/channel, optionally qualified by authorized Seller/Courier context. Mode changes do not create separate identities or preference owners. Seller Owner/Admin cannot silently alter another human's security preferences.

Operator preferences are a separate privileged-principal boundary. Reject disabling non-suppressible policy with a reason code. Quiet hours can delay/suppress optional attention; security-critical and policy-declared transactional-critical delivery overrides them without hiding mandatory in-app facts.

## 46. Dedupe

Dedupe prevents duplicate logical rows for the same fact/context. Use principal_type + recipient principal FK + source_event_id + policy type/versioned fact key + context_kind + stable Seller/Courier/resource context. Enforce the canonical unique key in PostgreSQL, not solely Valkey.

The same ordinary Account receiving Buyer receipt, Seller paid-order and Courier offer facts is legitimate contextual attention, not duplication. Multiple devices only multiply Delivery targets, never the logical row.

## 47. Collapse/displacement

Collapse is different from dedupe. A newer legitimate attention message can replace an older stale transport message. Example: a payment-processing push may be displaced by provider-verified payment success. The in-app timeline can retain both when both facts are useful, while the OS push tag/collapse key prevents misleading stale alerts.

Namespace collapse keys by typed principal and exact authorized context/resource so a Buyer receipt cannot replace another Seller/Courier message. Collapse affects transport attention; it does not delete committed logical history, source state or another principal inbox.

## 48. Priority and queue separation

Use separate BullMQ queues or priority lanes for security-critical, transactional/operational and optional promotional work. Critical capacity must not be starved by a campaign. Valkey is execution infrastructure only; PostgreSQL remains canonical for logical notifications, schedules, deliveries and attempts.

### PART IV - CHANNEL & DEVICE DELIVERY

In-app is durable recovery. Push attracts attention. SMS is expensive and limited to cases with clear safety/recovery value.

## 60. In-app Notification Center

The ordinary Account inbox reads server state with cursor pagination and optional BUYER / SELLER / COURIER filters over currently authorized relationships. Account-level read state is shared across devices. Mode/context filtering controls presentation; it does not create identity or bypass authorization.

Seller Console views require the selected Seller and current ownership/team permissions and exclude unrelated Buyer/Courier personal rows. Ordinary Mobile can present authorized contexts of the same Account; separate Operator notifications are served only on the isolated Operator surface/session.

![Typed destinations revalidate current authority](graphics/NOTIF_03.svg)
*Figure 03. Typed destinations revalidate current authority. An opaque notification reference returns to the correct principal and authorized context. Stale membership, offer, capability or private content yields a safe current-state result.*

```
GET  /v1/notifications?context=SELLER&sellerRef=...&cursor=...
POST /v1/notifications/{notificationRef}/read
POST /v1/notifications/read-all
PATCH /v1/notification-preferences
GET  /v1/operator/notifications?workScope=...&cursor=...
POST /v1/operator/notifications/{notificationRef}/read
```

## 61. Read and archive state

read_at is monotonic and shared by the logical principal's eligible devices. read-all updates only currently authorized rows in the requested context/Seller view, or the authorized ordinary unified view when explicitly requested; it cannot touch another ordinary Account or the Operator inbox.

archived_at hides old rows without erasing Delivery/Attempt/security audit retention. An OS push receipt, send acceptance or notification tap alone never becomes user read or business completion; authenticated backend confirmation governs read state.

## 62. Push architecture

Current low-complexity mobile path uses Expo Notifications on the client and an adapter-backed Expo Push Service transport initially, with FCM/APNs credentials underneath. Direct FCM/APNs adapters can be introduced later without changing Notification policy or schema.

```
Notification Delivery
      -> PushTransport interface
          -> Expo Push adapter (MVP)
              -> FCM / APNs
          -> direct FCM/APNs adapters (future if justified)
```

Delivery planning binds every PUSH target to the exact typed recipient and currently registered device. Send-time scope revalidation occurs before the provider call; a token grants attention transport only, never authorization.

## 63. Device registry

Device registry is delivery metadata, never identity authority. Derive principal type and FK from the authenticated MOBILE/CONSOLE ordinary session or separately permitted OPERATOR registration. Keep ordinary and Operator registration/session routes independent.

Exactly one principal FK is populated. A push token has at most one active principal binding across the registry; token/account replacement deactivates prior bindings atomically. Mode switching on the same ordinary Account retains that binding.

```
device
  device_id
  principal_type
  account_id? FK core.account
  operator_account_id? FK operator.account
  platform / push_provider / push_token_cipher_or_ref
  notification_permission / token_status
  app_version / last_seen_at / revoked_at
CHECK exactly one principal FK; type/FK agreement
UNIQUE active provider + protected token fingerprint
```

## 64. Push token rotation

Token refresh updates the Device record idempotently. Invalid/unregistered tokens are marked inactive after definitive provider feedback. Do not repeatedly retry permanent token failures. A token must never remain actively bound to two Accounts.

Token replacement checks typed principal boundaries. Ordinary registration can never activate an Operator delivery target; Operator registration does not reuse an ordinary token binding. Definitive invalid feedback disables the target; unknown provider outcome remains auditable/reconciled.

## 65. Push payload principle

Push payloads contain safe display text and opaque typed references only. They never contain provider secrets, payment evidence, full Claim allegations, OTP values, exact Buyer financial data, private moderation notes or signed evidence-download URLs.

## 66. Typed deep links

Policy maps a closed notification type to a reviewed typed destination, safe opaque resource identifiers and an authorized context-switch intent. Domain events never supply arbitrary URLs or client-executable mutation commands.

On tap: authenticate the correct principal -> resolve current relationship/resource scope -> switch presentation to the permitted Buyer/Seller/Courier context if necessary -> fetch current canonical state. Denied/stale/deleted/private targets show a safe current-state screen. Push possession and context-switch intent provide no authorization.

Operator destinations require the separate OPERATOR session/origin and current work/evidence capability; they never open via ordinary session inheritance.

![Typed destinations revalidate current authority](graphics/NOTIF_04.svg)
*Figure 04. Typed destinations revalidate current authority. An opaque notification reference returns to the correct principal and authorized context. Stale membership, offer, capability or private content yields a safe current-state result.*

## 67. SMS boundary

SMS is not the default Notification channel. It is paid, lock-screen exposed and provider-dependent. Generic Notification SMS is limited to explicitly approved security/recovery scenarios and delegated-recipient invitation when app access is not yet established. Authentication OTP and Handoff OTP are not generic Notifications; their owning domains control code lifecycle and only use the SMS transport/router.

## 68. Market SMS router

| Market routing | Primary | Backup | Notes |
| --- | --- | --- | --- |
| Ethiopia | Afromessage | SMS Ethiopia | Versioned Market route; health/failure classes determine failover |
| Future activated Market default | Twilio | Infobip | Used only where no better approved local route exists |

Notification SMS budget must not starve OTP/security budgets. Provider secrets live in deployment secret management, not Market configuration or Operator UI.

Ethiopia uses Afromessage primary and SMS Ethiopia backup. Twilio/Infobip is a default only for a future explicitly activated Market lacking a better approved local route; SMS reach does not activate a Market. Budget/priority controls isolate Auth/Handoff OTP and mandatory security delivery from optional notification bursts.

## 69. No lock-screen business mutation

Do not expose Confirm payment, Refund, Complete delivery, Change Trust, Accept Claim or similar high-risk business mutations as unauthenticated notification actions. A safe notification action is Open Adulis to the reviewed destination, followed by normal authorization and server state revalidation.

### PART V - SCHEDULING, LOCALIZATION &

### FRESHNESS

All scheduling is server-owned and connected. Every send is revalidated against current domain facts.

## 80. Connected-only behavior

Notification creation, read state, preference changes, device token updates and scheduled-send decisions require backend connectivity. Mobile does not persist a durable local Notification queue for later creation. OS-delivered pushes may remain visible while disconnected, but opening them cannot create or change business state until the device reconnects.

## 81. Scheduling storage

Scheduled notifications are durable PostgreSQL rows with due_at, policy_version, source reference, cancellation condition and relevance expiry. BullMQ/Valkey executes due work; loss of queue state is recoverable by re-claiming due PostgreSQL rows.

## 82. Send-time revalidation

Before any scheduled/delayed external send, revalidate typed principal/session/account standing, current relationship and permission, exact resource/source state, device binding, suppression/quiet-hour policy, TTL and cancellation condition. Stale Seller memberships, Operator capabilities or Courier offers/assignments are cancelled; stale content targets expose no private detail.

Queue execution and template rendering do not cache authority indefinitely. Reconcile current PostgreSQL schedules and attempts after Valkey/provider outage.

## 83. Time semantics

Store absolute instants in UTC. Human-facing schedule copy renders using the relevant Market/order/account locale and IANA timezone. Never hard-code UTC+3 globally. Avoid stale relative phrases such as "in two hours" when the message may be delivered late; include an absolute local deadline when useful.

## 84. Localization

English is the source/default/fallback language for Adulis-owned notification templates. Amharic is founder-reviewed for the Ethiopia implementation. Template keys and slots are versioned. Future languages must have explicit translation ownership; critical notifications cannot ship with unreviewed machine-only copy.

## 85. Whole-sentence templates

Translate complete message semantics rather than concatenating fragments. Slots are typed and bounded. A template declares allowed slot names/types; arbitrary user-provided strings are not interpolated into lock-screen copy without sanitization.

## 86. Review reminder cadence

Reviews v3.1 schedules the existing T+1 day, T+3 days and T+10 days cadence from first AVAILABLE Order Grant issuance, under FINAL_HANDOFF or VERIFIED_ORDER_FAILURE. Failure issuance never invents a receipt time. Preserve one schedule identity per Order Grant; later evidence/Claims do not restart it. Re-read current eligibility/preferences/recipient before dispatch and cancel on consumption, revocation, suppression or loss of eligibility.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 87. No legacy pre-payment expiry campaign

The old morning/two-hour pre-payment expiry reminder policy is not part of current commerce. Payment attempts have provider/Market-defined bounded expiry and CheckoutAllocation cleanup, but Notifications only alerts the Buyer when a current actionable payment state genuinely requires attention. There is no Seller payment-confirmation reminder because Sellers never confirm payment.

### PART VI - DOMAIN INTEGRATIONS

Policies consume canonical events and generate attention without re-implementing source-domain logic.

## 100. Authentication and security

• NEW_DEVICE_SIGN_IN: account-level security alert; push to existing eligible devices; in-app unsuppressible.

• SESSION_REVOKED / SECURITY_RECOVERY_COMPLETED: in-app + push where useful; do not expose secrets.

• Seller-team invite/role change/removal: each target team member receives their own account-scoped notice when policy requires.

• Operator role/capability/account/security changes: separate Operator-principal notice and surface; never ordinary Seller context.

## 101. PSP / Payments / Seller settlement

Payments emits provider-verified facts only. A browser/provider return never directly creates a paid notification. On payment success, Buyer may receive a safe receipt/status notification and the Seller receives New Paid Order according to Order policy. Sensitive provider onboarding or settlement-configuration changes create unsuppressible Seller security notifications when Finance policy requires them.

• PAYMENT_SUCCEEDED / PAYMENT_REQUIRES_ACTION / PAYMENT_FAILED_ASYNC only from normalized backend payment state.

• SELLER_PROVIDER_ONBOARDING_REQUIRES_ACTION where actionable.

• SELLER_SETTLEMENT_CONFIGURATION_CHANGED as security-critical when a sensitive provider-controlled receiving configuration changes.

• REFUND_REQUESTED / REFUND_COMPLETED from provider/Finance facts, not Claim UI optimism.

Receipt display consumes immutable paid Order/Finance snapshots; Notifications does not calculate fees/surcharge, assert settlement or infer payment success from provider browser return. The Adulis Checkout surcharge (current zero at launch) and Courier Delivery charge remain separate canonical snapshot components. Security-critical Seller financial configuration alerts remain unsuppressible for current authorized recipients.

## 102. Orders and Checkout

The Order system creates one Seller Order per Seller. Notification scope always uses that Seller Order. Current important events include Seller paid-order notification, Buyer ready-for-collection/delivery, cancellation/refund consequences and current actionable deadlines. Notifications does not create CheckoutAllocation, payment attempts or allowed_actions.

## 103. Fulfilment and Courier network

Current Courier model uses Private Courier Pools plus the Cross-Seller Courier Network. Routine invitations, applications, delivery offers, assignment changes and operational reminders use in-app/push, not ordinary SMS. Exact Courier compensation may be shown in the Courier offer notification because it is an approved operational fact from the paid Order snapshot.

• COURIER_POOL_INVITATION

• COURIER_APPLICATION_RECEIVED / APPROVED / REJECTED

• COURIER_TERMS_UPDATED

• DELIVERY_OFFER_CREATED / EXPIRED

• DELIVERY_ASSIGNMENT_CONFIRMED / CANCELLED / REASSIGNED

• DELIVERY_STARTED / FAILED / COMPLETED

One persistent Courier profile belongs to the ordinary Account and may have many approved Seller Pool relationships. Offer fanout uses current profile/pool/availability/compensation eligibility; opening/refetching and atomic acceptance remain Fulfilment-owned. No push creates forced assignment or continuous GPS tracking.

## 104. Courier offer freshness

Delivery offers are short-lived. Push is advisory and may arrive late. The Courier must open/refetch the offer; atomic Fulfilment assignment decides whether it is still available. "Accept" from a stale push cannot bypass assignment state. When the Courier is AVAILABLE, time-sensitive offer push is treated as operationally required; setting Courier availability to UNAVAILABLE is the correct way to stop new offers.

## 105. Handoff Verification

QR, OTP and Manual Verification all converge on the Handoff domain. Notifications may tell parties that a Handoff action is available or completed, but never decides credential validity. The presenter/recipient flow remains server-authoritative and connected-only.

Current commerce follows Seller Cart -> Checkout -> PSP/backend-verified payment -> one Seller Order -> Fulfilment -> accepted final Buyer/delegate Handoff. Seller never confirms Buyer payment. Connected QR is primary, OTP fallback and Manual Verification recovery; Pickup is Seller-displays/Courier-scans and final Delivery is Courier-displays/Buyer-or-authorized-delegate-scans. A delegate may receive goods but never inherits Buyer Review, Claim or refund rights. Exactly two best-effort foreground Pickup/Delivery location checkpoints are supporting evidence, not custody proof or continuous GPS.

## 106. Delegated recipient invitation

Ordinary logical Notifications retain exactly one ordinary/Operator Account recipient. A no-Account delegate instead uses a narrow HANDOFF-owned external invitation transport intent on the existing SMS adapter. Bind authorization_id, generation, contact-purpose reference, expiry/revocation/suppression and durable dedupe/effect key; recheck current recipient generation immediately before dispatch. Message is minimal install/open/receipt context, no detailed Order or reusable secret. No dummy Account, phone-as-Buyer authority or extra Claim/refund/Review rights. Transport timeout may be ambiguous; reading/exactly-once global SMS delivery is never guaranteed.

If a delegate later has an authorized Account/device, ordinary in-app/push Notification rules can apply only after explicit receipt-capability binding and current intent validity. OTP itself is a Handoff credential message outside Notification Center; no extra Buyer authority.

## 107. Claims and disputes

• CLAIM_OPENED / CLAIM_EVIDENCE_REQUIRED / CLAIM_STATUS_CHANGED / CLAIM_RESOLVED.

• Push body never exposes the full allegation or restricted evidence.

• Evidence export ready notification points to an authenticated export screen; no signed object URL in push.

• Claim deadlines use absolute Market-local dates when needed and are revalidated before send.

## 108. Reviews and ratings

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Notifications consumes Reviews-owned AVAILABLE Grant facts; it cannot adjudicate Claims, create another grant or assume receipt for failure feedback. Existing T+1/T+3/T+10 cadence begins at first grant issuance and stops after T+10. Suppress consumed/revoked/ineligible grants; multiple Claims/bases retain one schedule/container. Payment alone, PICKUP and unupheld allegation create none.

## 109. Trust Ladder

Trust v2 emits seller-private notices for WATCH/AT_RISK conditions, level changes, promotion/recovery milestones and corrected decisions. Public Buyers must not receive private demotion reasons, numerator/denominator evidence or internal anti-gaming details. The notification points the Seller to current Trust facts; the Trust engine remains authoritative.

Public levels are NEW, REBUILDING, ESTABLISHED and TRUSTED. Exact private level reasons/evidence and anti-gaming details stay with authorized Seller/Operator readers; neither high ratings, paid tier nor Notifications sets Trust or listing limits.

## 110. Catalogue and Inventory

Low-stock alerts are transition-based and deduplicated so quantity changes do not create a storm. Public stock wording remains Catalogue/Inventory-owned. Product Posts and Scene Posts can trigger content/availability notifications only through their owning domains; Notifications never copies mutable stock truth into its own state.

Collection Save is durable intent and creates no restock subscription. Buyer restock alerts remain deferred behind a future explicit opt-in object; do not infer subscription from Product or whole Scene membership.

## 111. Content, Media and Moderation

Content emits one registered scene_post.visibility_changed fact with prior/current state, reason, aggregate revision and logical effect identity. Notifications derives an authorized Seller Private/Public notice from that single fact after a current eligibility/recipient re-read. SCENE_BECAME_PRIVATE and SCENE_BECAME_PUBLIC, if retained as delivery-template names, are presentation classes only, never extra canonical domain events. Durable PostgreSQL effect identity prevents repeated/reordered facts from multiplying the logical notice. Private notice never authorizes Buyer delivery; restock alone cannot override independent restrictions.

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

![Canonical Scene and Inventory facts, versioned durable effects](graphics/NOTIF_05.svg)
*Figure 05. Canonical Scene and Inventory facts, versioned durable effects. Legacy mapping requires actual compatibility evidence and resolves to the same logical business effect.*

## 112. Chat and Chatbot

Current launch doctrine prioritizes Chatbot escalation notifications to Seller accounts authorized to answer the conversation. Ordinary human-message push remains configurable/future if field data shows messages are missed. Push never contains the entire Buyer message; the Inbox remains authoritative.

## 113. Operator workflows

Operator Account is a separately provisioned privileged internal principal. A person may also hold an ordinary Account, but credentials, sessions, strong authentication, recovery, revocation and audit identity remain independent. Ordinary Account OTP, Seller roles, public registration and Mode switching never create Operator authority.

Privileged workflows require an isolated OPERATOR session, current explicit capability, exact resource/Market/case scope, strong authentication and freshness, plus approval when the existing Founder/Staff governance requires it. Restricted evidence needs its own current capability and case/purpose authorization; ADMIN supplies no universal bypass. Record operator_account_id, capability, policy, case/version, reason, request/time and applicable approval context. No impersonation or direct generic domain-state setter is introduced.

OPERATOR_ROLE_CHANGED, OPERATOR_CAPABILITY_CHANGED, OPERATOR_ACCOUNT_SUSPENDED and OPERATOR_SECURITY_EVENT are internal typed-principal policies. Work assignment/urgent review uses current work scope and capabilities. Ordinary Seller/Buyer/Courier users cannot retrieve, deliver or open these rows through ordinary tokens, sessions or recovery.

### PART VII - API, DATA, QUEUES &

### SECURITY

PostgreSQL is durable truth. Valkey/BullMQ performs bounded asynchronous execution.

## 130. API contracts

REST/OpenAPI contracts and generated TypeScript clients use typed principal/context authorization. IDs are opaque client references; provider credentials and raw private database identifiers are not exposed.

```
GET   /v1/notifications?context=...&sellerRef=...&cursor=...
POST  /v1/notifications/{notificationRef}/read
POST  /v1/notifications/read-all
GET   /v1/notification-preferences
PATCH /v1/notification-preferences
POST  /v1/devices
PATCH /v1/devices/{deviceRef}/push-token
DELETE /v1/devices/{deviceRef}/push-token
GET   /v1/operator/notifications?workScope=...&cursor=...
POST  /v1/operator/notifications/{notificationRef}/read
POST  /v1/operator/notifications/read-all
POST  /v1/operator/devices  # only if Operator push is enabled
```

## 131. Data constraints

• Exactly one recipient_account_id or recipient_operator_account_id FK is populated; principal type/context agree. No unchecked generic recipient string or primary ordinary account purpose exists.

• PostgreSQL enforces logical dedupe per typed principal/source/policy/context and one PUSH delivery per logical notification/active device target.

• Device type/FKs agree and one push token has at most one active principal binding across ordinary and Operator boundaries.

• Seller recipient authorization is current at planning/send/read/open; Courier offer/assignment and Operator capability checks are independently current.

• Template locale/version exists before send; optional fallback is governed, critical copy release is reviewed.

• Non-suppressible security policy cannot be disabled by preferences or quiet hours.

• expires_at never precedes created_at; attempt numbers increase; schedules/attempts remain durable and recoverable.

• Account read state is shared across eligible devices; context filters never change ownership or another principal's rows.

## 132. Valkey and BullMQ

Valkey backs BullMQ queues, bounded rate-limit counters, short-lived dedupe/coordination aids and non-canonical cache entries. It never stores the only copy of a logical Notification, schedule, Delivery or Attempt. Scheduled work is reconstructible from PostgreSQL.

## 133. Queue model

| Queue / lane | Typical work | Failure behavior |
| --- | --- | --- |
| notif-critical | Security and urgent transactional deliveries | Dedicated concurrency; aggressive alerting |
| notif-operational | Paid Orders, Courier offers, Claims, Trust actions | Retry within TTL; stale revalidation |
| notif-optional | Low stock, Review reminders, informational | May shed/backoff before critical work |
| notif-reconcile | Due-row recovery, provider status cleanup, invalid-token maintenance | Idempotent and restartable |

## 134. Security controls

• @nestjs/throttler for device/preference/report-like abuse surfaces and provider call controls.

• @fastify/helmet and reviewed CORS/origin policy for web Notification Center APIs.

• libphonenumber-js for canonical phone normalization before SMS routing.

• Provider credentials only in secret management; never Operator-editable text fields.

• No OTP, raw push token, PSP secret, Claim evidence body or authorization header in Pino/Sentry.

• Typed deep links and server authorization on open.

• CSRF protections for cookie-authenticated Seller/Operator Console mutations.

Test independent ordinary/Operator sessions, CSRF/origin boundaries, typed-FK enforcement, revoked membership/capability and safe Mode/context switching. Current Actor references and device bindings are server-derived, not arbitrary client recipient IDs.

## 135. Privacy

Notification copy applies data minimization because lock screens and SMS are semi-public surfaces. Use safe Order references, not full financial evidence or sensitive Buyer details. Seller team recipients see only what their permission allows. Courier offer pushes omit exact Buyer contact until assignment policy allows it. Deleted/revoked accounts stop receiving new deliveries; retention follows Privacy and legal/Claim holds.

Seller Console filters by Seller relationship/resource permission and hides unrelated Buyer/Courier personal notifications. A PRIVATE Scene notice is Seller management information, not a public disclosure; cached rows cannot leak old Scene captions/media or restricted cause details.

## 136. Online-only mobile behavior

Expo SecureStore protects session credentials and device identity. TanStack Query manages server state in memory. Notification business state is not treated as a disconnected local database. Expo SQLite may exist elsewhere in the app for bounded technical uses, but it is not a Notification truth store or disconnected-send queue.

## 137. Latest technology placement

| Layer | Current Adulis technology | Notification role |
| --- | --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript | Policy, API, recipient resolution, scheduler, provider adapters |
| ORM / DB | Drizzle ORM; PostgreSQL | Logical records, schedules, deliveries, attempts, templates/preferences, outbox |
| DB extensions | pg_trgm; btree_gist; pg_stat_statements | Search/config constraints where needed; query observability |
| Async / cache | Valkey; BullMQ | Queues, bounded cache/counters; never durable truth |
| API | REST; OpenAPI; @nestjs/swagger; generated TS client | Notification/Device/Preference contracts |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js | Abuse controls, headers, phone normalization |
| Mobile | React Native; Expo; Expo Router; TanStack Query; SecureStore; Expo Notifications; Expo Updates | Inbox UX, push permission/token registration, deep links |
| Push | Expo Push Service initially; FCM/APNs underneath | Adapter transport |
| SMS | Market provider router | Afromessage/SMS Ethiopia; Twilio/Infobip defaults |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 | Unit/integration/E2E/load |
| Observability | Sentry; Pino; pg_stat_statements | Errors/traces/logs/query health |
| Architecture | dependency-cruiser | Module boundary enforcement |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS | Build/deploy/release surfaces |
| Media stack | Cloudflare R2/CDN; Sharp | Wider platform only; not Notification transport |
| Payments source | PSP adapter; Chapa where configured | Upstream provider-verified events only |

### PART VIII - FAILURE, OBSERVABILITY &

### TESTING

Notification outages must never corrupt domain truth, leak recipients or starve security delivery.

## 160. Failure - PostgreSQL unavailable

Consumers cannot create durable logical notifications while Notification PostgreSQL access is unavailable. Source-domain outbox records remain retryable. The original business fact remains committed according to its domain rules; Notification recovery resumes after database restoration.

## 161. Failure - Valkey unavailable

Already persisted Notifications, schedules and Deliveries remain in PostgreSQL. BullMQ execution pauses/degrades. Reconciliation re-queues due work after Valkey recovers. No message is declared delivered merely because a job was enqueued.

## 162. Failure - push provider unavailable

In-app remains available. Retry eligible PUSH deliveries with bounded exponential backoff and jitter while TTL remains valid. Security/transactional dashboards alert on sustained provider failure. Optional pushes may be shed before critical work.

## 163. Failure - SMS provider unavailable

Use the Market-configured fallback only for failures classified as safe for failover. Unknown provider outcomes require careful status handling to avoid duplicate sensitive SMS. OTP systems keep their own send/resend semantics even when they share transport infrastructure.

## 164. Failure - stale or revoked recipient

Send-time revalidation cancels stale Seller memberships/permissions, revoked Operator capabilities/principal sessions and unavailable Courier offers/assignments. Disable revoked tokens. On open, fetch current canonical state under current scope; stale, PRIVATE, removed or deleted resources produce safe unavailable screens without cached protected data.

Ordinary Mode switching preserves the Account and token identity; it does not rescue a revoked Seller scope or acquire Operator authority.

## 165. Observability

• logical notifications created/deduped by type/class

• delivery success/failure/expiry by channel/provider

• push invalid-token and permission-denied rates

• queue age/backlog/retry/dead-letter by priority lane

• scheduled-send lateness and stale-send suppression rate

• recipient fanout cardinality and revoked-recipient cancellation

• SMS primary/fallback rate and cost by Market/purpose

• Review reminder conversion and cancellation

• Courier offer push delivery/open vs canonical acceptance

• Security notification delivery health

• Valkey/BullMQ and PostgreSQL health

• template missing/fallback locale rate

• typed-principal/context fanout and cross-context denial rates

• separate Operator notification authorization/session health

• Scene PRIVATE/PUBLIC notice delay/failure without visibility drift

• quiet-hour overrides and mandatory security budget health

## 166. Zero-tolerance alerts

• Delivery/read to an unauthorized ordinary Account or separate Operator principal.

• Seller Console reveals unrelated Buyer/Courier personal data or another Seller scope.

• Different team humans share ordinary credentials, or ordinary recovery/session produces Operator authority.

• One push token is active under two principals, including ordinary/Operator.

• Provider receipt/tap changes Order/payment/Handoff/Trust/Scene state or marks user read without backend confirmation.

• Security policy becomes suppressible or optional work starves OTP/security budget.

• OTP/secrets/restricted evidence or private Scene historical payload enters inbox, push, SMS, analytics or logs.

• Valkey-only data loss removes durable logical history/schedules/Deliveries/Attempts.

## 167. Testing strategy

| Test layer | Required coverage |
| --- | --- |
| Jest | Policy selection, typed-principal and relationship-context routing, template slots, dedupe/collapse, TTL, preference rules |
| Testcontainers | PostgreSQL constraints, outbox idempotency, concurrent fanout, due-row claiming, token uniqueness |
| Maestro | Buyer/Seller/Courier mobile push-open flows, permission denied, multi-device Seller, Review reminders |
| Playwright | Seller Console and Operator Notification Center, team recipient changes, read-all isolation |
| k6 | High fanout paid-order/Courier offer bursts, schedule sweeps, inbox pagination, provider backpressure |
| Security | IDOR, deep-link injection, stale membership, token reassignment, sensitive payload redaction |

## 168. Critical account/device tests

• One ordinary Account holds Buyer, Seller and Courier relationships and receives correctly scoped notices without identity duplication.

• Different Seller-team humans authenticate separately; role union selects only current authorized recipients.

• Owner on Android/iPhone: one logical notification, eligible per-device PUSH deliveries and shared read state.

• Revoked team membership cancels pending protected push and hides stale scoped inbox rows on the next authorized read.

• Seller Console never shows unrelated Buyer/Courier personal contexts; ordinary context filtering cannot read another Account.

• Token replacement atomically deactivates the prior binding; ordinary/Operator reuse is rejected.

• Operator rows require isolated OPERATOR session/capability and cannot open through ordinary sessions.

• Auth/recovery/Mode change never promotes an ordinary principal or imports Operator history.

## 169. Critical commerce tests

• Provider browser return without backend verification: no Seller paid-order notification.

• Provider-verified payment success: exactly one New Paid Order logical notification per intended Seller recipient.

• Payment failure/ambiguous state: no false paid notification.

• Payment-attempt expiry cleanup does not generate deprecated pre-payment reminder flows.

• Courier pool offer fanout: only targeted eligible Couriers receive; stale loser sees current assignment state.

• Delegated recipient invite uses minimal SMS; Handoff OTP never creates normal Notification row.

• Review Grant produces T+1/T+3/T+10 schedule; Review submission cancels remaining reminders.

• Trust AT_RISK/level change goes only to authorized Seller accounts; Buyer never receives private reason.

• Current regression 01: Ordinary Account is Buyer + Seller Owner: Buyer payment Notification and Seller New Paid Order both correctly target same Account with different contexts.

• Current regression 02: Same Account is Courier: Courier offer targets same ordinary Account without separate Courier Account creation.

• Current regression 03: Seller Owner and employee: different humans use different Accounts.

• Current regression 04: Team member holds multiple roles: recipient resolution uses permission union.

• Current regression 05: Same ordinary Account has iPhone + Android: one logical Notification + two eligible push deliveries.

• Current regression 06: Seller Console displays Seller-scoped notifications but not unrelated Buyer private notification.

• Current regression 07: Buyer Mobile view cannot surface unauthorized Seller context.

• Current regression 08: Operator notification requires separate Operator Account session.

• Current regression 09: Ordinary Account cannot open Operator notification.

• Current regression 10: Push token cannot be active for two Accounts.

• Current regression 11: Revoked team membership cancels stale optional Seller push.

• Current regression 12: Stale Courier offer push cannot override atomic assignment.

• Current regression 13: Provider browser callback alone -> no paid-order notification.

• Current regression 14: Review Grant -> T+1/T+3/T+10.

• Current regression 15: Review submitted -> reminders cancelled.

• Current regression 16: Scene last Product unavailable -> Scene PRIVATE notification to appropriate Seller recipient.

• Current regression 17: Scene restocked -> Scene PUBLIC notification.

• Current regression 18: Scene stock-private event not mislabeled moderation restriction.

• Current regression 19: Ordinary Collection save creates no restock subscription.

• Current regression 20: Valkey loss leaves durable Notification records intact.

## 170. Capacity model

MVP architecture remains a modular-monolith Notification module plus workers. Do not add Kafka, a Notification microservice or a separate event-stream platform solely for scale theater. Partition/archival strategy can be introduced when delivery-attempt volume justifies it. Batch fanout and queue jobs should be bounded so a viral Seller or Courier pool cannot create unbounded per-row work.

### PART IX - FINALIZED MVP POLICY &

### ARCHITECTURE

Sections 301-317 preserve the original numbering for the launch catalogue, corrected channel matrix and final architecture.

## 301. MVP notification catalogue

The versioned MVP catalogue maps to current committed source-domain events; policy aliases may align to the canonical registry without changing ownership or security semantics.

| Area | Current policy types |
| --- | --- |
| Security/Auth | NEW_DEVICE_SIGN_IN; SESSION_REVOKED; SECURITY_RECOVERY_COMPLETED |
| Seller finance | SELLER_PROVIDER_ONBOARDING_REQUIRES_ACTION; SELLER_SETTLEMENT_CONFIGURATION_CHANGED |
| Payments/Orders | PAYMENT_SUCCEEDED; PAYMENT_REQUIRES_ACTION; NEW_PAID_ORDER; ORDER_READY; ORDER_CANCELLED; REFUND_COMPLETED |
| Courier | COURIER_POOL_INVITATION; COURIER_APPLICATION_STATUS; COURIER_TERMS_UPDATED; DELIVERY_OFFER_CREATED; DELIVERY_ASSIGNMENT_CHANGED; DELIVERY_FAILED |
| Handoff | DELEGATED_RECIPIENT_INVITE; HANDOFF_ACTION_REQUIRED; HANDOFF_COMPLETED (credential OTP excluded) |
| Claims | CLAIM_OPENED; CLAIM_EVIDENCE_REQUIRED; CLAIM_STATUS_CHANGED; CLAIM_RESOLVED; EVIDENCE_EXPORT_READY |
| Reviews | REVIEW_REMINDER_T1; REVIEW_REMINDER_T3; REVIEW_REMINDER_T10 |
| Trust | TRUST_WATCH; TRUST_AT_RISK; TRUST_LEVEL_CHANGED; TRUST_RECOVERY_PROGRESS |
| Inventory | LOW_STOCK; STOCK_CONFIRMATION_REQUIRED |
| Content/Moderation | PRODUCT_POST_ACTION; SCENE_POST_ACTION; SCENE_BECAME_PRIVATE; SCENE_BECAME_PUBLIC; CONTENT_RESTRICTED; CONTENT_RESTORED |
| Chat | CHATBOT_ESCALATION |
| Operator internal | OPERATOR_ROLE_CHANGED; OPERATOR_CAPABILITY_CHANGED; OPERATOR_ACCOUNT_SUSPENDED; OPERATOR_SECURITY_EVENT; scoped work assignment/review |

Scene Private/Public names in this notice catalogue are presentation templates derived from scene_post.visibility_changed and its current re-read, not independent producer facts or alias events. One revision/effect generates only its intended notice.

## 302. Deliberately excluded from MVP catalogue

• Daily recommendation pushes or generic come-back pushes.

• A push for every FYP interaction, Product Post view, Scene Post view or Review.

• Marketing SMS.

• Old Seller payment-confirmation alerts.

• Old long-lived pre-payment expiry morning/two-hour reminders.

• OTP codes as generic Notification Center items.

• Marketplace-wide Courier broadcasts to unrelated Couriers.

• Browser/client callbacks treated as payment notifications before backend provider verification.

## 303. Recommended channel matrix

The original table header was visually merged and ambiguous. The finalized matrix uses explicit columns for Notification Type, In-App, Push, SMS, User Suppressible? and Primary Recipient / Rule. Header cells repeat if the table spans pages.

| Notification Type | In-App | Push | SMS | User Suppressible? | Primary Recipient / Rule |
| --- | --- | --- | --- | --- | --- |
| New device sign-in | Yes | Existing eligible devices | No | No | Affected Account; security-critical |
| Sensitive Seller settlement/config change | Yes | Yes | Conditional security policy | No | Owner + current authorized security-role Accounts |
| Provider onboarding requires action | Yes | Yes | No | No | Seller Owner / authorized finance account |
| Buyer payment succeeded | Yes | Optional | No | Usually no | Buyer Account; only provider-verified success |
| New paid Order | Yes | Yes | No | No | Authorized Seller order/preparation accounts |
| Order ready for Buyer | Yes | Yes | No | No | Buyer Account |

| Notification Type | In-App | Push | SMS | User Suppressible? | Primary Recipient / Rule |
| --- | --- | --- | --- | --- | --- |
| Courier pool invitation/application status | Yes | Yes | No | Configurable | Courier Account or Seller pool operator |
| Delivery offer | Yes | Yes | No | No while AVAILABLE | Target Courier Account only; offer TTL applies |
| Courier terms/compensation updated | Yes | Yes | No | Usually yes | Approved Courier accounts affected by future terms |
| Delegated recipient invitation | If account exists | If eligible device exists | Yes when needed | No | Buyer-designated recipient; minimal safe content |
| Handoff OTP | No | No | Handled by Handoff OTP transport | No | Not a normal Notification |
| Claim evidence required | Yes | Yes | No | No | Buyer/Seller account required to act |
| Claim resolved | Yes | Yes | No | Usually no | Claim parties with permitted visibility |
| Review reminder T+1/T+3/T+10 | Yes | Yes | No | Yes | Order Buyer while Review Grant AVAILABLE |
| Trust watch/at-risk/level change | Yes | Yes | No | No | Seller Owner + authorized Trust readers; private reason |
| Low stock | Yes | Optional | No | Yes | Accounts with Inventory responsibility |
| Content restricted/removed/restored | Yes | Yes | No | No for enforcement | Seller content administrators for affected content |
| Chatbot escalation | Yes | Yes | No | Configurable | Seller accounts authorized to reply |
| Evidence/export ready | Yes | Optional | No | Yes | Requesting Account; authenticated link only |
| Promotional / re-engagement | Future | Future | No | Yes | Not MVP-critical |

| Notification Type | In-App | Push | SMS | User Suppressible? | Primary Recipient / Rule |
| --- | --- | --- | --- | --- | --- |
| Scene stock PRIVATE / PUBLIC | Yes | Policy | No | Policy | Authorized Seller content recipients; Content cause, not enforcement |
| Operator role/capability/security change | Operator only | Separate target only | Approved security only | No for security | Separate Operator Account; isolated current scope |

## 304. Why in-app is nearly universal

In-app is authenticated, persistent, inexpensive and recoverable after external transport failure. It gives the user a durable path back to current Adulis state. For optional policies, suppression may prevent creation or hide a category according to product policy, but external failure must never destroy canonical business facts.

## 305. Why SMS is rare

SMS is expensive, privacy-exposed and provider-dependent. It is kept for security/recovery cases with clear value and delegated-recipient onboarding when no app target exists. Authentication OTP and Handoff OTP use their owning-domain credential flows even when the same provider router transports the message.

## 306. Why push is attention, not truth

Push can arrive late, be dropped, be collapsed, be denied or remain visible after the underlying state changes. Therefore it is never authoritative. On tap, Adulis re-authenticates/re-authorizes and fetches current state.

## 307. Architecture write-back - account model

Canonical identity write-back: Auth, Mobile, Seller Console, Fulfilment, Chat, Analytics and Privacy consume one ordinary Account across Buyer, Seller and Courier relationships. Different humans use individual credentials; the one non-terminal Seller-team slot, role union, ownership and Courier Pool relationships remain explicit.

Operator Account is separately provisioned/authenticated/recovered/revoked, with typed notification/device FKs and isolated inbox/session/origin. No primary ordinary purpose field, role-isolated ordinary identity migration or ordinary Operator role is introduced.

Scene stock-driven visibility notices consume Content facts and remain distinct from Moderation notices; canonical public visibility is enforced regardless of notification delivery.

## 308. Compatibility migration

• Replace obsolete primary-purpose recipient snapshots with typed principal FKs and authorized BUYER/SELLER/COURIER/OPERATOR contexts.

• Use explicit approved Auth mapping for historical identities. Do not guess, merge unrelated humans, convert an ordinary Account into an Operator principal or fabricate a missing actor.

• Preserve logical history, source events, read state, Delivery/Attempt lineage and policy versions; backfill context only from defensible canonical relationships/resources.

• Migrate individual Seller recipients using ownership/team standing/effective permission union; remove permanent recipient lists and shared-credential assumptions.

• Preserve one logical row per recipient/source/policy/context and fan out devices only at Delivery planning.

• Validate token/principal uniqueness and atomic reassignment across ordinary/Operator boundaries; Mode switch retains ordinary binding.

• Add Seller-filtered and ordinary context views plus separate Operator APIs; revalidate protected rows at read/send/open.

• Migrate Scene policy names/types and PRIVATE/PUBLIC cause handling without converting availability into Moderation or restock subscriptions.

## 309. Architecture write-back - device

One typed principal can have many eligible devices. Stable ordinary Account read state is shared, with OS permission/token outcomes per device. Individual Seller-team humans register their own devices.

Device registration/authentication and token reassignment enforce exact typed-principal ownership. Separate Operator targets require independently permitted registration/session; ordinary Mode changes do not rebind the token or expose Operator inbox rows.

## 310. Architecture write-back - commerce

Remove old payment-confirmation-window and pre-payment expiry policies. Use PSP/provider-verified events, Seller paid-order notification, provider settlement/security events, current Fulfilment/Courier events and current Handoff/Review/Trust events.

## 311. Architecture write-back - template/localization

English becomes the source/default template language globally. Amharic is founder-reviewed for Ethiopia. Templates and slot schemas are versioned; missing optional translation falls back to English with telemetry. Security/transactional copy receives human review before release.

## 312. Architecture write-back - Valkey and push provider

All queue/cache language uses Valkey. PostgreSQL remains canonical. Expo Push Service is the initial adapter-backed push route for the Expo mobile application, with FCM/APNs underneath and direct transports available later without schema redesign.

## 313. Core invariants

• NOTIF-INV-01 Notifications are never business truth.

• NOTIF-INV-02 One human ordinary user has one ordinary Account across Buyer/Seller/Courier relationships.

• NOTIF-INV-03 Different Seller team humans never share credentials.

• NOTIF-INV-04 Operator Account is a separate privileged principal.

• NOTIF-INV-05 One logical ordinary Notification belongs to one ordinary Account.

• NOTIF-INV-06 Context/relationship controls surface visibility.

• NOTIF-INV-07 Seller recipients are server-resolved by relationships/permissions.

• NOTIF-INV-08 PSP verification required before paid notification.

• NOTIF-INV-09 Seller never confirms Buyer payment.

• NOTIF-INV-10 Auth/Handoff OTP are not generic Notifications.

• NOTIF-INV-11 Review reminders exist only while Review Grant is available.

• NOTIF-INV-12 Trust private reasons never leak publicly.

• NOTIF-INV-13 Push/SMS never contain restricted secrets/evidence.

• NOTIF-INV-14 Deep links are typed and reauthorized.

• NOTIF-INV-15 PostgreSQL is durable Notification truth.

• NOTIF-INV-16 Valkey/BullMQ are execution only.

• NOTIF-INV-17 Queue loss is reconstructible.

• NOTIF-INV-18 Security-critical policies are unsuppressible.

• NOTIF-INV-19 English source/fallback; reviewed localization preserves semantics.

• NOTIF-INV-20 Notification state mutation requires backend connectivity.

• NOTIF-INV-21 One push token cannot be actively bound to two Accounts.

• NOTIF-INV-22 Courier push never establishes assignment.

• NOTIF-INV-23 Delegate invitation exposes minimal information.

• NOTIF-INV-24 Product Post and Scene Post are current content identities.

• NOTIF-INV-25 Scene PRIVATE/PUBLIC notification never creates Scene state.

• NOTIF-INV-26 Transport receipt is not business completion/read authority.

• NOTIF-INV-27 One ordinary Account may receive Buyer/Seller/Courier notifications without becoming three identities.

• Exactly one typed recipient FK agrees with principal kind; a device token cannot bridge ordinary and Operator principals. Logical read state is shared across devices and scope-filtered read-all changes authorized rows only.

## 314. Production launch gate

• Typed-principal and ordinary relationship-context model is implemented; historical mappings are explicit and constraints pass.

• Different Seller Owner/team humans use separate ordinary Accounts; the same human may hold Buyer/Seller/Courier relationships. No shared credential path exists.

• Seller multi-device test produces one logical row and correct per-device pushes.

• PSP verified payment is the only source for paid-order notification.

• No legacy pre-payment expiry/confirmation notification remains.

• Courier pool/offer/assignment policies match Fulfilment v2.

• Delegated recipient invitation and Handoff OTP boundary match Handoff v2.

• Review T+1/T+3/T+10 reminders cancel correctly.

• Trust/Claims/Moderation copy passes privacy and authorization tests.

• English templates complete; Amharic critical templates founder-reviewed where enabled.

• Valkey loss recovery test passes; PostgreSQL retains all canonical delivery records.

• Push invalid-token/token-reassignment tests pass.

• Deep-link injection and IDOR tests pass.

• SMS routing/fallback and budget isolation pass.

• Expo push adapter, provider credentials and EAS release configuration pass staging.

• Observability dashboards and zero-tolerance alerts are live.

• Section 303 matrix is implemented with explicit, readable headers in generated documentation.

Scene PRIVATE/PUBLIC and moderation-cause separation, current safe direct-link resolution, context read-all isolation and no Save-to-restock inference must pass. Separate Operator history/device/session and stale capability tests are mandatory.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 315. Recommended implementation sequence

| Phase | Work | Exit criterion |
| --- | --- | --- |
| 0 | Account/recipient contract reconciliation | Typed ordinary/Operator principals, multi-relationship contexts and individual-human credentials approved |
| 1 | Schema: logical notification, delivery, attempts, templates/preferences | Migrations + constraints pass |
| 2 | Transactional outbox consumer + policy registry | Idempotent event -> notification planning |
| 3 | In-app APIs + read/archive/preferences | Authorized ordinary Buyer/Seller/Courier contexts and isolated Operator inbox work |
| 4 | Device registry + Expo push adapter | Multi-device fanout and invalid-token handling pass |
| 5 | Valkey/BullMQ queues + scheduler/reconciliation | Queue loss recoverable from PostgreSQL |
| 6 | PSP/Order/Fulfilment/Handoff/Claims/Reviews/Trust integrations | Current event catalogue works end-to-end |
| 7 | SMS router + delegated invite/security cases | Purpose/budget/failover controls pass |
| 8 | Localization, privacy, security, observability | English/Amharic + redaction + dashboards pass |
| 9 | Load/E2E/release hardening | Production launch gate passes |

## 316. Final System Architecture

Committed source events enter the versioned policy registry. Recipient resolution validates typed principal, current ordinary relationship or separate Operator capability, exact scope and preferences. One logical PostgreSQL row fans out to durable Delivery/Attempt targets; every delayed send and destination open revalidates current authority.

![Durable attention planning and recoverable external delivery](graphics/NOTIF_06.svg)
*Figure 06. Durable attention planning and recoverable external delivery. Committed source events resolve typed recipients and current scope; PostgreSQL persists logical rows, schedules, deliveries and attempts. Expo/SMS and Valkey/BullMQ provide transport/execution only.*

![Explicit anonymous, ordinary, privileged and trusted service contexts](graphics/NOTIF_07.svg)
*Figure 07. Explicit anonymous, ordinary, privileged and trusted service contexts. Modes change acting relationships, not identity; separate Operator and delegate receipt boundaries remain.*

In-app is the durable recovery surface. Expo Push with FCM/APNs and the Market SMS router provide attention only. PostgreSQL due-row reconciliation repairs Valkey/BullMQ loss; provider acceptance never establishes read, assignment, payment, Trust or Scene visibility.

## 317. Final engineering doctrine

Notifications are a distributed attention system. The source domain establishes a fact; policy decides which currently authorized typed principal/context needs attention. One ordinary Account spans Buyer/Seller/Courier relationships, different humans authenticate separately, and a separate Operator principal retains independent privileged security.

The logical row records contextual attention, devices carry delivery attempts, and authenticated deep links fetch current canonical state. Missed pushes never corrupt business truth; stale alerts never authorize actions; every important notice is traceable to its committed source fact and recoverable inbox history.

## 318. Glossary

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
| Typed recipient | Exactly one ordinary or Operator FK consistent with principal type. |
| Context | BUYER, SELLER, COURIER or OPERATOR visibility/resource scope; not identity purpose. |
| Logical Notification | One committed contextual attention fact for one typed recipient. |
| Delivery | One channel/target plan; device fanout does not multiply logical records. |
| Attempt | Durable provider execution/result ledger. |
| Dedupe | Unique same-fact principal/policy/context identity in PostgreSQL. |
| Collapse | Transport replacement of stale attention, distinct from logical history. |
| Device binding | Current authenticated typed-principal target; token never authenticates. |
| Deep link | Reviewed typed route plus safe IDs; authenticate/authorize/refetch on open. |
| Scene transition notice | Advisory Content-owned PRIVATE/PUBLIC consequence, not Moderation or visibility truth. |
| OTP transport | Auth/Handoff-owned credential lifecycle; never generic Notification Center content. |

## 319. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-02 — Scene publication and all-unavailable lifecycle | The 13 October pack already requires a legitimate same-Seller Product relationship and at least one currently available tagged Product at public publication. | Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product. Zero-tag or all-unavailable initial publication is rejected. A published Scene stays public while at least one tagged Product remains available. If the last available tagged Product becomes unavailable, the Scene remains PUBLISHED but effective Buyer visibility becomes PRIVATE across FYP, Following, Nearby, Search, Buyer Seller profile, public Storefront and Buyer-facing Collection/direct resolution. Seller/Operator views retain it with Private state. Restoration of at least one eligible Product automatically re-evaluates and may restore PUBLIC without republishing. | Founder rule + PR-004 reconciliation |
| R-11 — Buyer account controls and deletion parity | The 13 October Privacy/Auth designs govern account lifecycle and deletion. | Authenticated Buyer account controls include Edit Profile, saved discovery area, Appearance, notification preferences, Privacy & Security, Help & Support, Delete Account and Sign Out. Delete Account uses verification, consequence preview, authoritative blockers and typed confirmation; Mobile and Website must share policy wording/data rather than independently reauthoring deletion consequences. Sign Out changes session state only. | PR-006, 27 Oct 2026 |
| R-15 — Courier offer eligibility and sequence | The 13 October designs already require Courier acceptance and one active accepted delivery. | A direct Delivery Offer may be sent only to a Courier who is in the Seller’s Approved pool relationship, Adulis-verified, AVAILABLE and has no active accepted delivery. BUSY Couriers may remain visible for context but are disabled with reason. UNAVAILABLE, restricted, pending, removed or non-approved Couriers are ineligible. Seller request/offer never equals assignment; Courier acceptance atomically rechecks eligibility/capacity. Mark Ready precedes offer. Offer timing must respect the one-active-delivery rule. | PR-008 correction, 27 Oct 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
