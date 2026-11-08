# Adulis Seller Console
Version 4.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v4.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v4.1 dated 12 October 2026. Selected repairs in this document: R01, R02. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 4.0 reviewed 8 October 2026 -> 4.1 amended 12 October 2026. -> 4.2 contract-corrected 13 October 2026 -> 4.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-CONSOLE-02_Adulis_Seller_Console_System_Design_v4.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. System definition

The Seller Console is the authoritative seller administration and business-management surface for Adulis.

Its responsibility is:

```
    Create -> Configure -> Manage -> Administer
```

The Mobile Seller Companion remains deliberately smaller:

```
    Monitor -> Communicate -> Respond -> Urgent Operations
```

The Console is where an approved seller operates the business behind what buyers experience in:

• FYP discovery;

• Product Posts;

• Scene Posts;

• Product detail and Seller Storefront;

• gateway-paid Orders;

• fulfilment and courier delivery;

• two-stage QR handoff evidence;

• buyer-seller Chat;

• Trust, Reviews and Claims.

Adulis launches globally. The Console therefore must be market-aware from the beginning rather than treating Ethiopia-specific assumptions as universal platform rules.

## 2. Primary architecture objective

The Seller Console must let a seller operate Adulis without requiring knowledge of recommendation algorithms, database invariants, payment-provider internals, Trust computation, media infrastructure or authorization internals.

The seller expresses intent. The backend determines whether that intent is currently legal.

The Console displays authoritative state; it does not invent it.

![Shared canonical Platform architecture](graphics/CONSOLE_01.svg)
*Figure 01. Shared canonical Platform architecture. Clients express intent through typed APIs; domains authorize and decide, PostgreSQL persists truth, and workers build projections.*

## 3. Core architectural doctrine

The Console MUST NOT determine:

• whether an Order may transition;

• whether Chapa/provider payment succeeded;

• whether a Product Post can publish;

• whether a Scene Post is recommendation-eligible;

• what a seller's Trust Level is;

• whether a team member may perform a sensitive action;

• whether a tagged Product belongs to the current Seller;

• whether a Courier assignment is valid;

• whether either QR evidence stage is accepted.

The Console may determine presentation-only state such as selected tabs, open dialogs, collapsed panels, search text and formatting.

This separation is fundamental.

## 4. Architecture overview

High-level architecture:

There is no Console database. There is no alternate payment truth inside the browser. No microservice architecture is required for MVP.

![Shared canonical Platform architecture](graphics/CONSOLE_02.svg)
*Figure 02. Shared canonical Platform architecture. Clients express intent through typed APIs; domains authorize and decide, PostgreSQL persists truth, and workers build projections.*

## 5. What the Seller Console owns

The Console owns the seller-facing experience for:

• seller onboarding and publication readiness;

• social-business eligibility and verification;

• store configuration and structured physical-store location;

• catalogue, Product Posts, Variants and Inventory;

• Scene Posts, product tags, media and content lifecycle;

• Order preparation and fulfilment operations after provider-verified payment;

• approved Courier Pool/Network administration, Pickup credential and delivery state/exception visibility;

• Inbox and chatbot configuration;

• seller, FYP and content-to-commerce analytics;

• Trust explanation, Reviews and Claims;

• team/RBAC, sessions, security and Account/Seller lifecycle controls.

Commercial pricing/monetization UI is intentionally excluded until Adulis approves a separate commercial policy.

## 6. What it does NOT own

The Console does not own:

• buyer FYP rendering or recommendation ranking;

• buyer checkout UI;

• Chapa/payment-provider verification;

• canonical Order state;

• buyer QR scanning;

• Courier authentication or checkpoint capture;

• Moderation decisions;

• Trust Level computation;

• Seller-verification/admission decisions;

• Operator actions;

• marketplace Search ranking;

• final commercial pricing or monetization policy.

Those belong to their respective platform domains.

## 7. Seller Console versus Seller Storefront

These must remain completely different systems.

```
     SELLER CONSOLE
     seller.<domain>
```

```
     Authenticated
     Private
     Management
```

Business operations Configuration Sensitive information

versus:

SELLER STOREFRONT public URL

Anonymous/public Buyer-facing Catalogue Trust facts Products Content

A storefront failure should not expose console functionality.

A console route must never render publicly merely because both systems share React components.

## 8. Seller Console versus Mobile Seller Companion

Console: Create / Configure / Manage / Administer.

Seller Companion: Monitor / Communicate / Respond / Urgent Operations.

Capabilities depend on the current responsibility-derived role grants and backend allowed_actions; surface availability alone grants no permission.

- Read paid Order, prepare/Mark Ready, assign an already eligible Courier and display Pickup QR: both surfaces where the role permits.

- Reply to Buyer: both surfaces for OWNER/ADMIN/SALES_SUPPORT, without granting unrestricted Inbox to INVENTORY.

- Read authorized assignment/Pickup/In Delivery/Delivery/exception state: both surfaces; no live GPS view.

- Product creation/full edit, Scene authoring, physical-store configuration, team/security and chatbot configuration: Console.

- Ownership transfer and Seller closure: OWNER only, Console only, Step-Up and domain validation.

ANALYST and CAMPAIGN_MANAGER remain Console-first rather than receiving artificial operational mobile workspaces. Relevant content notifications do not grant mobile editing.

![Seller surfaces by responsibility](graphics/CONSOLE_03.svg)
*Figure 03. Seller surfaces by responsibility. Console administers the business; Companion handles permission-scoped urgent operations and communication.*

## 9. Actor model

One ordinary Adulis Account can be Buyer, Owner of Seller A, INVENTORY team member of Seller B, and Courier for Sellers C/D. These are relationships around one Account.

MVP permits at most ONE non-terminal Seller TEAM membership per ordinary Account. The same membership may contain multiple non-OWNER roles. Simultaneous ADMIN membership in Seller B and INVENTORY membership in Seller C is invalid.

This limit does not prohibit ownership of multiple Sellers where policy permits, ownership plus one team membership, or multiple Courier relationships. Seller switching and explicit seller_id context remain necessary.

Operator Account is a separate internal privileged principal, not an ordinary Account role or Console signup path.

## 10. Authentication

Seller Console ordinary authentication:

Phone

```
     ↓
```

Adulis-generated OTP

```
     ↓
```

SMS transport

```
     ↓
```

Adulis verifies OTP

```
     ↓
```

Opaque Console session

No passwords.

No email/password login.

No social-login dependency.

No JWT authorization model.

## 11. Console session

Use the existing Console credential:

__Host-adulis_session

with:

HttpOnly Secure SameSite=Strict Path=/ No Domain

The current auth specification requires those properties.

The session must be stateful and immediately revocable.

## 12. Same-origin API gateway

Recommended browser topology:

```
     seller.adulis.com
            │
            ├── /
            ├── /s/...
            │
            └── /api/v1/...
                     │
                     ▼
                Core NestJS API
```

The /api layer is a reverse proxy/gateway, not a second business backend.

Benefits:

• Host-only session cookie;

• no broad cross-origin credential sharing;

• simpler CSP;

• simpler CSRF protection;

• easier request tracing;

• API origin hidden from ordinary browser code.

Business logic remains in NestJS.

## 13. CSRF

HttpOnly cookies require CSRF protection.

Every state-changing Console request should require:

```
     Exact Origin check
     +
     CSRF token/header
     +
     valid Console session
     +
     permission check
```

SameSite=Strict is useful but should not be the only CSRF control.

## 14. Seller context

Seller context is never stored as mutable session state.

Routes carry it:

```
     /s/:sellerId/orders
     /s/:sellerId/products
     /s/:sellerId/content
```

Every seller API request carries:

```
     X-Adulis-Seller: <seller-id>
```

The existing API contract requires this model specifically to prevent cross-store mistakes when multiple stores are open in different tabs.

## 15. Why URL-based context matters

Suppose one Owner manages:

Store A Store B

and opens:

Tab 1 → /s/A/orders/123 Tab 2 → /s/B/orders/781

A global:

currentSeller = B

stored in browser/session state could cause Tab 1 to send an action against B.

That is unacceptable for:

Therefore:

URL sellerId

```
          ↓
```

request header

```
          ↓
```

server relationship check

every time.

## 16. Authorization

Every protected action evaluates:

Seller state

```
        ↓
```

Team standing

```
        ↓
```

Role

```
        ↓
```

Surface

```
        ↓
```

Entitlement

```
        ↓
```

Object scope

Authentication only proves control of the account.

It does not grant business capability.

The current auth architecture defines this exact layered authorization sequence.

## 17. Seller roles

Canonical Seller roles: OWNER, ADMIN, SALES_SUPPORT, INVENTORY, ANALYST and CAMPAIGN_MANAGER.

Derive grants from responsibility -> atomic action -> permission -> surface -> role grant. Historical permission/grant totals are not product targets. Multiple non-OWNER roles may be assigned within one Seller Team Membership.

The backend evaluates Account, relationship/standing, role-set, surface, permission, resource scope and allowed_actions. Frontend role-name checks are not security.

### Role responsibility and access

OWNER manages the full business subject to domain rules. Only OWNER can transfer ownership or close the Seller, with Console-only Step-Up and domain validation.

ADMIN performs ordinary delegated business administration across Orders, Catalogue/Variants/price/stock, fulfilment, Courier relationships, Scene content, Inbox, Claims, analytics, chatbot, Store, team and permitted configuration/security. ADMIN cannot become OWNER, transfer ownership, close Seller or bypass OWNER security.

SALES_SUPPORT handles Buyer communication, Order support and permitted Claim responses. Payment is read/support/escalate only. No preparation, Mark Ready, Courier assignment, Inventory/Product/Scene mutations, standing Courier administration, team/security or provider configuration.

INVENTORY handles authorized Catalogue, Variant, price/media/publication, stock adjustments/confirmation/history and physical fulfilment. It may prepare paid Orders, Mark Ready, assign already eligible Couriers and display Pickup credentials. It cannot administer standing Courier Pools/relationships and has no unrestricted Buyer Inbox.

ANALYST receives approved privacy-bounded, read-only aggregate KPIs and trends. Read-only does not mean read-everything: no automatic Inbox/message bodies, raw Buyer contacts, full Claim evidence, verification evidence, sessions, team/security or provider configuration; no business mutations.

CAMPAIGN_MANAGER handles Scene merchandising/media, eligible Product read/tag-source, caption/tags/hotspots/preview/publish/archive, moderation actions when allowed, chatbot configuration/testing and Scene/FYP/content-to-commerce analytics. No Order/stock/Product price/specification/team/provider/ownership/lifecycle mutations or Courier operations.

![Responsibility-derived authorization](graphics/CONSOLE_04.svg)
*Figure 04. Responsibility-derived authorization. Backend grants and allowed_actions decide access; frontend role names only explain responsibilities.*

| Role | Primary Console responsibility | Boundary |
| --- | --- | --- |
| OWNER | Full business administration; role-aware operational Home. | Only role for ownership transfer/closure; Console + Step-Up + domain validation. |
| ADMIN | Ordinary delegated business/team/security administration. | No OWNER elevation, transfer, closure or OWNER-security bypass. |
| SALES_SUPPORT | Inbox, Buyer-safe Order read/support, permitted Claim response. | No preparation, Mark Ready, Courier assignment, Catalogue/stock/Scene/team/provider administration. |
| INVENTORY | Catalogue/stock and preparation/physical fulfilment; eligible Order Courier assignment. | No standing Courier Pool administration or unrestricted Buyer Inbox. |
| ANALYST | Approved read-only KPIs, trends and aggregate performance. | No raw messages/contacts/full Claim evidence, verification/security/provider data or mutations. |
| CAMPAIGN_MANAGER | Scene/media, Product read/tag source, chatbot configuration/testing, discovery analytics. | No Order/stock/price/specification/team/provider/ownership/closure/Courier operations. |

## 18. Permission resolution

Canonical backend concept:

```
     fn_has_permission(
         account_id,
         seller_id,
         permission,
         CONSOLE
     )
```

Object ownership is additionally enforced through:

• foreign keys;

• composite relationships;

• RLS;

• scoped database functions;

• server-side scope validation.

Resolve responsibility-derived permissions on the server and return resource-scoped allowed_actions. Combined role-sets cannot bypass OWNER-only or surface-specific controls. Commercial entitlements remain separate from permissions.

Resolve one actual mutation capability from AUTH §157. Alternative actions in §20 do not form a union prerequisite or a broad administration alias. Shared/generated code types and build-time references derive from that catalogue; unknown codes reject the contract build.

## 19. UI permission rule

Two different kinds of denial must look different.

Missing permission

Example:

Inventory staff cannot edit payment-account details.

Result:

Do not render the action.

The user cannot obtain that capability by paying.

Missing entitlement

Example:

A commercial capability is not included in current seller entitlement.

Result:

Render it disabled and explain what enables it.

This existing distinction is important because permissions are security facts while entitlements are commercial facts.

## 20. Step-up authentication

Sensitive Console mutations require their exact Auth capability plus the owning workflow’s action-bound step-up. The canonical catalogue is AUTH §81–84/157; no broad aliases are added. Sensitivity is determined by the actual operation and current owner policy, not by possession of any other table entry.

| Operation | Canonical authority | Additional boundary |
| --- | --- | --- |
| Invite / remove / change team roles | seller.team:invite / seller.team:remove / seller.team:roles_manage, chosen for the actual mutation | seller.team:read is read only; preserve current role, target and sensitive-action controls. |
| Ordinary Account self-deletion | Authenticated Account ownership + Account Lifecycle purpose; no Seller permission | Use AUTH §52/140 and lifecycle checks; Account/action/target/audience-bound step-up. No administrator may delete another human’s Account. |
| Seller business closure | seller.lifecycle:close | Separate owner-controlled Seller action; active obligations and step-up still apply. |
| Seller-scoped session administration | seller.sessions:revoke | Only sessions in Auth-approved Seller scope; not unrelated personal or Operator sessions. |
| Self-service session revocation | Authenticated Account-owned AUTH §118 session APIs | Relevant ordinary sessions only; bulk revocation retains purpose, scope and required step-up. |
| View / submit Seller verification | seller.verification:read / seller.verification:submit, chosen per operation | Read or submit never approves verification. Preserve sensitive submission/evidence workflow controls. |
| Transfer Seller ownership | seller.ownership:transfer | Existing OWNER-only, standing, obligation, approval and action-bound step-up restrictions remain. |
| Update Store location | seller.store:location_update | Retain the owning action’s current sensitivity/step-up and exact Store/Seller target. |
| Supported settlement-account update | seller.finance:settlement_account_update | Only a Finance-exposed supported action; Finance governance/step-up and G01 evidence required. No arbitrary provider configuration. |

A step-up grant is tied to the authenticated Account, exact action, target and audience; it is bounded and single-use. Permission, membership/standing, resource ownership, entitlement, surface and state checks remain mandatory. Self-service Account lifecycle purposes are separate from Seller permissions and never inserted into the Seller catalogue.

## 21. Step-up UX

Never show:

```
     Enter your verification code.
```

Instead:

or:

```
     Enter the code to transfer ownership of Addis Style.
```

The seller must know exactly what they are authorizing.

## 22. Navigation architecture

Available destinations remain Home, Orders, Products, Content, Inbox, Insights, Store, Automation and Settings. Render only destinations/actions for which the backend supplies capability.

Permission denial normally hides the destination/action. An entitlement denial may show a disabled feature with an explanation where appropriate. Frontend role labels are educational; server permissions/allowed_actions remain authoritative.

OWNER/ADMIN receive ordinary business administration. SALES_SUPPORT primarily uses Inbox, Buyer-safe Orders and Claims; INVENTORY uses Products/Inventory and preparation/fulfilment Orders; ANALYST uses Home/Insights; CAMPAIGN_MANAGER uses Content/Automation/Insights with read/tag-source Product access.

Seller subscription pricing UI remains excluded until separately approved packaging.

## 23. Responsive navigation

Desktop >= 1024px uses a persistent sidebar.

Tablet/mobile may collapse primary destinations to:

```
    Home / Orders / Products / Inbox / More
```

More contains Content, Insights, Store, Automation and Settings. The Console remains responsive, but the Seller Companion is still the intended mobile operational surface.

## 24. Top bar

Every seller route displays:

```
     Seller name
     Seller switcher
     Search where relevant
     Notification bell
     Help
     Account menu
```

Seller switcher appears only when the account has more than one seller relationship.

## 25. Screen-state vocabulary

Every data screen supports the applicable states:

```
     LOADING
     EMPTY
     READY
     STALE
     BLOCKED_READINESS
     NO_PERMISSION
     NO_ENTITLEMENT
     CONFLICT
     VALIDATION
```

```
     TERMINAL
     TRANSPORT_ERROR
     UPGRADE_REQUIRED
```

Business-specific states come from the server.

The frontend does not create additional pseudo-business states.

## 26. Loading

Never use a blank page with a giant spinner. Use structural skeletons matching Order rows, Product Post cards, Scene Post grids, analytics cards and Store settings. Slow-network states must preserve layout and keep the

user oriented.

## 27. Stale data

During background refresh:

```
     existing content remains
     +
     small refreshing indication
```

Do not blank the screen.

Critical action buttons may become temporarily disabled only where the operation requires fresh server state.

## 28. Conflict handling

The Seller has Order X open in Console and Mobile Seller Companion. Mobile marks the paid, prepared Order Ready. The Console tab holds the older resource version and attempts a stale mutation.

The server returns 409 CONFLICT with current version/state and allowed_actions. Console refreshes canonical state and explains the conflict. No Seller payment confirmation is involved.

## 29. Home

Home has two modes on the same seller-scoped route.

Pre-publication:

```
    Publication Readiness Hub
```

Published Seller:

```
    Daily Operations Brief
```

The Home surface is global-market aware. It displays the active market/country context and the market-local timezone used for operational timestamps.

Home is role-aware: OWNER/ADMIN see the Daily Operations Brief; SALES_SUPPORT sees messages, Claims/deadlines and Buyer-facing delivery/Order exceptions; INVENTORY sees preparation, stock and Ready/Pickup work; ANALYST sees KPIs/trends; CAMPAIGN_MANAGER sees Scene actions, Private Scenes, moderation, FYP/content conversion and chatbot issues. Do not give every role OWNER Home.

## 30. Publication readiness

Publication readiness is resolved by the backend and may include:

• Account standing;

• Seller type and current social-commerce admission eligibility;

• social account/business-page verification;

• Seller/business information and permitted provider onboarding status where required;

• Store profile;

• at least one valid fulfilment method;

• at least one publishable Product Post;

• required payment/provider onboarding state when the Payment domain says it is necessary.

The Console receives readiness items and resolving actions. Do not build a brittle linear wizard; setup must survive interruptions across days.

## 31. Product/Scene content is NOT publication readiness

A seller does not need to publish a Scene Post before the Store can operate. Product Posts can participate in Product detail, Seller Storefront, Search, Shop, tagged Scene discovery and Collections and direct external traffic.

Scene Posts improve discovery, education and merchandising but are not a prerequisite for basic commerce.

Similar Finds and Complete the Scene are currently feature-flagged off and must not appear as active Seller Console capabilities until Adulis has enough catalogue coverage and behavioral data to enable them deliberately.

## 32. Published Home dashboard

OWNER/ADMIN Daily Operations Brief prioritizes:

1. Provider-verified paid Orders requiring preparation.

2. Claims/deadlines.

3. Ready Orders awaiting Pickup.

4. Active Courier-delivery status and exceptions.

5. Low/uncertain stock.

6. Buyer messages.

7. Scene Posts requiring action, including automatically Private Scenes and their reason.

8. Moderation issues.

9. Seller performance and security alerts.

Other roles receive the responsibility-specific Home described in section 29. Unpaid/abandoned attempts are not preparation work. Every card/action is permission-scoped and opens fresh canonical state.

## 33. Activity summary

Default:

rolling 7 days vs previous 7 days.

Do not add a date picker to Home.

Detailed time-range analysis belongs in Insights.

## 34. Orders

Route:

```
    /s/:sellerId/orders
```

Server-owned buckets may include:

```
    Needs action
    Preparing
    Ready / Awaiting pickup
    In delivery
    Completed
    Cancelled / Refunded where applicable
```

The Console must not create a separate seller-visible pre-payment transaction queue. A Seller Order becomes actionable only according to the canonical Checkout/Payment/Order contract.

## 35. Order row

Each Order row should display only seller-relevant facts:

• Order reference;

• Buyer-safe identity label;

• provider-verified payment state;

• total/currency;

• fulfilment mode;

• market-local created/paid/deadline times;

• operational status;

• Courier assignment, Pickup/In Delivery/Delivery and exception state where relevant;

• server-provided allowed_actions.

Never infer an action from status text alone.

## 36. Order detail

Order detail composes canonical read models for:

• immutable commerce line snapshot;

• provider-verified payment summary/reference;

• Buyer-safe contact/fulfilment information;

• preparation/ready state;

• Courier assignment, custody/Delivery state and exceptions where applicable;

• Seller-to-Courier pickup QR state;

• Courier-to-Buyer delivery evidence state;

• Chat anchor, Claim status and audit timeline.

The seller never receives payment-provider secrets or Buyer payment credentials.

Fulfilment mode is chosen before payment and snapshotted on the Seller Order. It is normally read-only; a post-payment change appears only through a specific backend-authorized workflow. Display snapshotted Product subtotal, Seller-defined Courier Delivery charge/compensation, versioned zero at launch Checkout surcharge on its configured basis, applicable provider fee and Buyer total. Console calculates none of these canonical values.

## 37. Canonical checkout-to-order flow

Conceptual canonical flow for Seller Console:

```
    Buyer chooses Product(s)
        -> Checkout
        -> Chapa/provider payment attempt
        -> server-side provider verification
        -> paid Order becomes actionable to Seller
        -> Seller prepares and marks Ready
        -> fulfilment
        -> if Courier: Seller->Courier pickup QR
        -> Courier delivery state and exception progress
        -> Courier->Buyer delivery QR
        -> completion / Review / Trust / Claim consequences
```

The Console does not implement or resurrect a separate pre-payment hold/timer lifecycle.

## 38. Gateway payment authority

Payment authority belongs to the backend Payment domain and its Chapa provider adapter.

The Seller Console MUST NOT expose actions named Accept Payment, Verify Payment, Confirm Payment Received, Approve Payment or Payment Valid.

A seller sees the provider-verified result as read-only operational context. Client redirects or success screens never establish payment truth.

## 39. Payment status presentation

Display payment status using server-owned, human-readable states such as Processing, Paid, Failed, Refunded or Action unavailable, without deriving them in the browser.

For a paid Order show:

• amount and currency;

• verified_at;

• safe provider/reference identifier;

• refund state where applicable;

• any server-resolved operational warning.

Do not show full provider payloads or secrets.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

## 40. Payment failure and uncertain states

Gateway outcomes can be delayed or ambiguous. The Console must support a neutral pending/uncertain state.

When the backend has not established payment success:

• do not tell the Seller to prepare goods;

• do not expose handoff controls;

• do not let the Seller manually override provider truth;

• show a retry/reconciliation status if the backend supplies one.

Provider outages degrade payment operations, not seller authorization or historical Order reads.

A Buyer cancellation request or local EXPIRED attempt is not no-charge proof. Show backend cancellation_status, protected RECONCILING and completed allocation release separately; fulfilment remains unavailable before the joint operational PAID/stock commit.

## 41. Payment provider reference and audit

Seller-visible provider information is evidence of platform payment state, not raw provider data.

Recommended safe fields:

```
    provider = CHAPA
    payment_reference_masked
    amount_minor
    currency
    status
    verified_at
    refund_status (if applicable)
```

Access is audited. Provider credentials, webhook signatures, full responses and internal reconciliation data never enter the browser.

## 42. Seller cannot confirm payment

The Seller is not a payment-verification authority in the gateway model.

The Console therefore offers no manual payment confirmation or payment-rejection workflow. If a Seller believes a payment state is wrong, the supported path is an issue/Claim/support workflow, not a state-changing payment button.

## 43. Mark Ready

Mark Ready is a seller operational action allowed only when the backend says the paid Order is eligible for preparation completion.

The endpoint is idempotent. The Console sends intent and renders the authoritative result. It does not derive readiness from local payment text.

## 44. Handoff

Handoff remains a separate evidence boundary after payment.

For Courier delivery, the seller is responsible for the first physical transfer stage: Seller -> assigned Courier. Buyer receipt is a later stage performed through the Courier/Buyer surfaces.

The Console shows evidence status but does not fabricate acceptance from GPS proximity or UI state.

Final receipt may be completed by the Buyer or an Order/Handoff-scoped authorized delegate; delegation does not transfer Order ownership or Claim/refund/Review rights. Bounded Pickup and Delivery checkpoint evidence supports the Handoff but cannot replace connected server acceptance.

## 45. Two-stage courier QR

Courier delivery uses TWO distinct purpose-bound QR stages per Order:

Stage 1 - Pickup / custody

```
    Seller displays Seller-to-Courier QR
    -> currently assigned Courier scans
    -> server accepts custody evidence
    -> Courier becomes the physical custodian
```

Stage 2 - Buyer delivery

```
    Courier displays Courier-to-Buyer QR
    -> authenticated Buyer or authorized delegate scans
    -> server accepts Buyer receipt evidence
    -> Order may become eligible for completion
```

These are separate tokens/evidence purposes. One QR must never be reused for both stages. The Console may display the Stage-1 QR and the read-only state of Stage 2; it never performs the Buyer scan.

![Current Handoff stage and recipient protocol](graphics/CONSOLE_05.svg)
*Figure 05. Current Handoff stage and recipient protocol. Recipient-directed OTP and Collection delegates; governed lockout recovery; connected final receipt.*

## 46. Offline rule

Business Handoff acceptance is connected and server-authoritative on Console and Seller Companion. Local QR parsing or a read-only cache cannot finalize evidence, payment, Order completion or Courier assignment.

There is no offline acceptance/business-action queue. Show reconnect/retry when the authoritative service is unavailable; retry uses the same logical idempotency identity and never shows success before acceptance.

QR is primary, OTP fallback and Manual Verification emergency recovery; all converge on the same Handoff state machine.

## 47. Product Posts

The seller-facing catalogue object is a Product Post: the canonical commercial representation of exactly one sellable Product.

The underlying Catalogue domain still owns Product, Variant, price, category, attributes and publication state. The Console presents those facts as one Product Post workflow rather than treating Product Posts as generic social content.

## 48. Product model

A Product Post represents one Product and may contain Variants. Price belongs to the applicable Variant structure, not a duplicated Scene Post field.

Product Post information may include name, media, description, category, structured attributes/specifications, brand/condition, Variants, price/currency, current Inventory/availability, Seller/Trust facts, ratings, fulfilment information and checkout action metadata.

Product Post is the canonical commerce source for tagged content.

## 49. Product editor

Product editor workflow:

1. Core product identity and category 2. Structured product attributes 3. Variants and Variant-defining attributes 4. Price/currency 5. Inventory 6. Product media 7. Fulfilment/availability 8. Preview blockers 9. Publish

Return all publication blockers at once. Do not force sellers to discover them one screen at a time.

## 50. Product-level versus variant-level attributes

Product attributes:

```
     Material
     Care
     Origin
     Brand
     Description
```

Variant attributes:

```
     Size
     Colour
     Storage
     Shade
     Model
```

The distinction matters for:

• catalogue accuracy;

• search;

• chatbot;

• recommendation;

• inventory.

## 51. Variants

Price belongs to the actual sellable variant.

Example:

```
     Dress
     │
     ├── Red / S      2,000 ETB
     ├── Red / M      2,000 ETB
     ├── Black / S    2,200 ETB
     └── Black / M    2,200 ETB
```

Unique attribute combinations must be enforced server-side.

## 52. Inventory

Inventory changes use a ledger/event model.

Never:

UPDATE variant SET stock = 7;

as the only evidence.

Instead:

Stock Event

```
        ↓
```

Resolved stock

Reasons could include:

seller adjustment completed order cancellation system correction

according to canonical inventory rules.

## 53. Stock actions

Seller sees two distinct controls:

Update stock

and:

Confirm stock is accurate

They are different operations.

The second refreshes stock confidence without pretending quantity changed.

The previous Console architecture explicitly preserves this distinction.

## 54. Stock confidence

Console shows:

Current confidence Why confidence changed What effect it currently has Last confirmed Confirm stock History

The seller never manually chooses their confidence level.

## 55. Media architecture

Media remains a shared platform capability, not a Seller Console storage subsystem.

The Console obtains an upload grant, sends bytes directly to Cloudflare R2, and binds resulting Media assets through domain APIs. Cloudflare CDN serves public derivatives. Sharp workers generate bounded image derivatives.

Private/sensitive evidence never uses public Product/Scene media storage.

## 56. Media processing

Image processing is asynchronous and idempotent. The Console shows upload/processing/readiness states and retries safely.

Do not trust filename or extension. The backend Media pipeline validates content, normalizes images, strips privacy-sensitive metadata and produces versioned derivatives. The Console never blocks the main thread performing server-grade image processing.

## 57. Media-extensible launch

Launch Product/Scene media uses supported images/photos and image derivatives. Scene Posts and FYP are image-only at launch; native Seller video upload/transcoding is not a launch capability.

Approved third-party social-video embeds are Product Post Detail only. Preserve a version/capability seam for future approved media formats without advertising them as current functionality.

## 58. Content becomes a first-class Console domain

Content is a first-class seller domain because Adulis discovery is not only catalogue browsing.

Formal seller publishing formats are:

• Product Post - one canonical sellable Product;

• Scene Post - merchandising/discovery content that must reference at least one materially relevant Product Post.

The term "normal post" is not used in formal product or engineering language.

The current Scene Post is image-led same-Seller content; publication requires at least one eligible, currently available tagged Product. Product Post remains canonical commerce truth.

## 59. Content inventory

```
/s/:sellerId/content
```

Filters/tabs: All, Draft, Public, Private, Archived, Restricted / Removed.

Scene cards show image preview, caption, Product-tag count, currently available tagged-Product count, visibility, publication state, moderation state and permission-safe performance.

A PRIVATE Scene remains visible to its Seller management roles with a prominent Private badge and the explanation: All tagged Products are currently out of stock. Show the machine-readable reason ALL_TAGGED_PRODUCTS_OUT_OF_STOCK in the management contract, not public Buyer responses.

Product Posts stay under Products/Catalogue. Filters distinguish lifecycle, visibility and moderation rather than merging them into Published.

## 60. Scene Post

A Scene Post explains why a Buyer should care about one or more Products. Examples include outfit styling, tutorials, demonstrations, setups, routines, comparisons and product-quality showcases.

Hard rule:

```
    Every Scene Post must reference >= 1 valid Product Post.
```

A Scene Post never becomes the source of truth for current price, stock, Variants or seller identity.

Scene Post is the canonical content object. Outfit, routine, setup or demonstration are presentation patterns, not separate formal entities.

## 61. Scene Post editor

Route:

```
    /s/:sellerId/content/scenes/:postId
```

Recommended editor:

1. Upload/select media 2. Add caption/content information 3. Search the current Seller's existing Product Posts 4. Select one or more Products 5. Position optional visual product tags/hotspots 6. Preview 7. Publish

The seller must not re-enter canonical price, Inventory or Variant data already owned by Product Posts.

Backend publication rejects zero Product tags, cross-Seller tags, all tagged Products unavailable/out of stock, or failed Seller/Market/Media/Moderation rules. At least one eligible tagged Product must currently be available. Preview never establishes publication legality.

## 62. Product tags and hotspots

Product tags are structured relationships; hotspots are optional visual coordinates.

One tagged Product can have zero or more visual hotspots. Product ordering is independent from hotspot geometry. Coordinates are normalized to the media presentation, not device pixels.

A Buyer must also be able to access tagged Products through an accessible list; visual overlays cannot be the only navigation mechanism.

## 63. Tagging ownership - same Seller only in MVP

CURRENT MVP RULE:

```
    A Seller-authored Scene Post may tag only Product Posts owned by that same Seller.
```

The API rejects cross-Seller product tags even if the Product is public. This prevents attribution, authorization and seller-consent ambiguity in V1.

The data model should still preserve a future authorization seam for creator/affiliate commerce, but that future capability is disabled and must not be exposed in the current Console.

## 64. Tagged-product eligibility

A tag is eligible only if the backend confirms:

• Product belongs to the current Seller under MVP policy;

• Product/Post is in the same allowed Market context;

• Product is published and not moderation-blocked;

• Product has a valid current commerce state;

• the seller is eligible and active.

Partial stock loss keeps a Scene PUBLIC only while at least one eligible tagged Product remains available. Unavailable tags display current availability. Losing the last available tagged Product automatically makes the Scene PRIVATE; the backend decides eligibility.

## 65. Scene Post lifecycle

Publication and visibility are orthogonal:

- publication_state: DRAFT, PUBLISHED, ARCHIVED / REMOVED.

- visibility: PUBLIC or PRIVATE.

At initial publication require at least one valid same-Seller Product tag and at least one eligible tagged Product currently available, plus Seller/Market/Media/Moderation gates.

Last available tagged Product becomes unavailable -> retain publication_state=PUBLISHED, set visibility=PRIVATE and reason ALL_TAGGED_PRODUCTS_OUT_OF_STOCK. Do not archive or delete it.

Seller can still manage it with a prominent Private badge/reason and receives a notification. FYP, Marketplace Search, Storefront, Buyer profile, Collections and direct public resolution stop exposing the media, caption and Product associations. Projection/cache invalidation cannot be used to bypass current visibility.

Restock of at least one eligible tagged Product -> backend re-evaluates all public gates -> automatically restore PRIVATE to PUBLIC if valid -> notify Seller. Archive/removal, moderation block, Seller suspension, wrong Market, deletion or independent restriction prevents restoration.

Published edits retain stable revision/provenance where required without rewriting historical Buyer evidence. Notification is a hint; opening the Scene reloads canonical state.

![Current eligibility runs before every new controlled Scene delivery](graphics/CONSOLE_06.svg)
*Figure 06. Current eligibility runs before every new controlled Scene delivery. New delivery is controlled; already delivered/in-flight bytes, screenshots and external copies cannot be recalled.*

## 66. Scene Post preview

Preview must show the Buyer-facing Scene Post as currently composed:

• media;

• caption;

• tagged Products;

• Product availability states;

• optional hotspots;

• Seller identity/Trust summary;

• opening path into Product Post.

Do not show active Similar Finds or Complete the Scene modules in the current preview. Those features are deferred and feature-flagged off.

Preview shows publication/visibility separately and clearly identifies a Private Scene/reason. A management preview is permission-gated and does not produce public eligibility or a Buyer-accessible link.

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

Cache genuinely non-sensitive static shells and permitted immutable image/static assets only. Scene-bearing data/HTML/caption/title/card/meta bypasses full-page/data CDN caching, ISR and stale-while-revalidate unless the authoritative decision still runs before every delivery. Dynamic nonce HTML uses the existing fresh per-response CSP nonce profile and no shared HTML cache; static asset policies stay compatible. Already delivered bytes, in-flight responses and external screenshots/copies cannot be recalled. Authorized Seller-private and case-scoped Operator access are separately authenticated.

## 67. Media Library

Optional dedicated route:

```
     /s/:sellerId/content/media
```

Useful once seller media volume justifies it.

MVP may initially expose media within Product and Scene Post editors while retaining a shared backend media model.

Do not build an enterprise DAM system prematurely.

## 68. Content moderation

Seller Console displays:

```
     Published
     Under review
     Restricted
     Removed
     Needs change
```

only when those states exist in canonical moderation.

It should show:

• state;

• timestamp;

• policy reason code translated into seller-facing language;

• available appeal/report route where applicable.

Console does not make moderation decisions.

Moderation state is independent from publication and visibility. OWNER/ADMIN and authorized CAMPAIGN_MANAGER may use returned appeal/report actions; a restock never bypasses moderation.

## 69. Removed content

Removing content from public/FYP surfaces must not automatically destroy evidence required

for:

• moderation investigation;

• audit;

• claims;

• abuse analysis.

The current social-commerce manual explicitly requires moderation evidence to survive normal public removal.

## 70. Duplicate/stolen-content defenses

Console may warn when backend detects:

• identical upload;

• near-identical repeated content;

• suspicious posting burst;

• previously removed asset.

It should not accuse the seller of fraud.

Example:

```
      This image appears to match content already uploaded. Review before publishing.
```

not:

```
      You stole this image.
```

## 71. Inbox

Route:

```
     /s/:sellerId/inbox
```

Required query scope:

```
     as=seller
     seller_id=<seller>
```

because one account can simultaneously have buyer conversations.

The existing API explicitly requires seller/buyer conversation scope rather than assuming a default.

Inbox/manual replies are available to OWNER/ADMIN/SALES_SUPPORT as granted. INVENTORY has no unrestricted Inbox; ANALYST has no raw message access; CAMPAIGN_MANAGER chatbot configuration does not grant Buyer conversation access.

WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

## 72. Inbox transport

MVP:

poll while visible.

Example:

```
     visible tab → refresh ~30 sec
     hidden tab → pause
     focus return → immediate refresh
```

Native Seller Companion handles urgent push.

Do not introduce WebSockets merely because Inbox exists.

## 73. Conversation

Route:

```
     /s/:sellerId/inbox/:conversationId
```

Displays:

• thread;

• order/product context per message;

• chatbot replies;

• escalation markers;

• human messages.

## 74. Message anchor

Product/order context belongs to the message, not permanently to the conversation.

A buyer may ask:

```
     Message 1 → Dress
     Message 2 → Lipstick
     Message 3 → Order #AD...
```

in the same relationship thread.

The current Console specification already corrected the earlier conversation-level anchoring defect.

## 75. Manual seller replies

Seller composer sends human replies.

Do not add an uncontrolled:

AI Write Reply

feature.

Adulis's chatbot architecture deliberately keeps final buyer answers deterministic.

## 76. Chatbot administration

New Console section:

Automation

```
   └── Chatbot
```

Suggested routes:

```
   /s/:id/automation/chatbot
   /s/:id/automation/chatbot/answers
   /s/:id/automation/chatbot/testing
   /s/:id/automation/chatbot/insights
```

OWNER/ADMIN/CAMPAIGN_MANAGER may configure/test chatbot where granted; SALES_SUPPORT uses escalation/reply, and ANALYST sees approved aggregate performance. Configuration permission does not imply unrestricted Inbox or message evidence access.

## 77. Chatbot architecture principle

Pipeline:

Structured product data

```
           ↓
```

Quick rules

```
           ↓
```

Keyword/exact match

```
           ↓
```

Embedding similarity

```
           ↓
```

LLM classifier

```
           ↓
```

Intent ID

```
           ↓
```

Approved template

```
           ↓
```

Authoritative product/store data

```
           ↓
```

Buyer response

The LLM must not write the final seller response.

## 78. Chatbot Overview

Show:

Status Coverage/readiness Conversations handled Escalation rate Top buyer questions

Missing information Recent configuration changes

Avoid vanity metrics such as merely:

```
     AI messages sent.
```

The important question is:

```
     Did it correctly answer repetitive buyer questions without increasing seller risk?
```

## 79. Seller answer configuration

Global intents remain platform-managed.

Seller supplies seller-specific values/templates where appropriate.

Example:

Intent:

```
   DO_YOU_DELIVER_TO_AREA
```

Seller configuration:

"Seller delivery covers Bole, Kazanchis and Gerji."

The seller should not create arbitrary new classifier taxonomy casually.

## 80. Chatbot preview/testing

Provide a simulator:

Buyer question

```
         ↓
```

Resolved intent

```
         ↓
```

Template version

```
         ↓
```

Filled answer

```
         ↓
```

Resolution path

This is extremely useful before enabling automation.

It also lets Seller Support reproduce disputed chatbot answers.

WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

## 81. Chatbot version history

Each rendered bot message must be attributable to:

intent version template version seller configuration version product/order context resolution path

A seller disputing what their bot said should be able to see which configuration produced it.

## 82. Chatbot unmatched insights

Show aggregated/identity-stripped questions such as:

"Do you deliver outside Addis?"  -  17 unanswered "Is this original?"  -  11 escalations

Do not expose another buyer's identity in an NLU improvement dataset.

## 83. Insights architecture

Insights are server-produced projections. The Console must not run expensive cross-domain aggregation in the browser.

Primary groups:

• Seller performance;

• Product Post performance;

• Scene Post performance;

• content-to-commerce contribution;

• FYP exposure and discovery quality;

• Inventory/fulfilment quality;

• Chatbot containment/escalation quality.

Metrics must remain definition/version aware.

Insights enforce privacy per responsibility. ANALYST gets approved aggregates, not raw contacts/messages/Claim evidence/verification/security records. CAMPAIGN_MANAGER gets content/FYP/tag-click/conversion/chatbot metrics; operational views require their own grants.

## 84. Seller performance overview

Seller performance overview should focus on operational and commerce outcomes, not vanity metrics alone.

Examples:

• paid Orders;

• completed Orders;

• GMV where the analytics definition permits it;

• Product Post views/saves;

• Scene Post qualified impressions;

• product-tag click-through;

• Storefront visits;

• cancellation/Claim quality;

• response and fulfilment reliability.

## 85. FYP analytics

FYP qualified impressions belong to Scene Posts only. Keep downstream Product opens and commerce metrics separate and preserve algorithm/version attribution.

Useful seller-facing aggregates include qualified impressions, opens, saves, product-tag clicks, Storefront visits, checkout starts, paid Orders and downstream quality. Do not expose internal ranking weights, candidate-source secrets or anti-gaming thresholds.

## 86. Content-to-commerce performance

Per Scene Post, show both engagement and commerce contribution:

• qualified impressions / views;

• image-led dwell/engagement where defined;

• saves/shares where enabled;

• product-tag clicks;

• Product Post views generated;

• Storefront visits generated;

• checkout starts;

• paid/completed Orders influenced;

• conversion contribution.

The central question is: did this creative content produce useful product discovery and commerce?

## 87. Do not expose ranking internals

Never expose exact ranking formulas, raw internal weights, anti-gaming thresholds or privileged eligibility traces. Give sellers actionable explanations such as content eligibility, Product availability, quality warnings and aggregate performance without enabling ranking manipulation.

## 88. Seller exposure concentration

Seller analytics may show concentration at a coarse level so a seller understands whether discovery depends on one Product or one Scene Post. The Console must not expose marketplace-wide seller allocation rules or competitor-specific ranking information.

## 89. Recommendation performance is not watch-time optimization

Adulis recommendation success is multi-objective. Watch time or dwell alone is not the definition of a good Scene Post.

Seller-facing performance should emphasize the path:

```
    Attention -> Product discovery -> Product interest -> Checkout -> successful Order
```

Similar Finds and Complete the Scene remain deferred and therefore do not have active Seller Console analytics modules in V1.

## 90. Trust screen

Trust is read-only in Seller Console. Show current Level, public factual statistics, qualifying evidence, exclusions where safe, and review/appeal paths.

Purchased features or any future commercial relationship must never increase Trust. The Console never allows a Seller to edit Trust Level directly.

Use NEW, REBUILDING, ESTABLISHED and TRUSTED. REBUILDING distinguishes a formerly promoted Seller working back toward Established from NEW. No Trust level limits Product count. Show factual qualifying requirements/evidence rather than an invented opaque progress percentage; thresholds and health guards belong to Trust.

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

Claim rate = DISTINCT qualifying affected verified-paid Seller Orders / DISTINCT eligible verified-paid Seller Orders in the SAME purchase cohort, including paid non-delivery. Select by canonical verified-payment cohort date and Market timezone; assign one Order once despite line/multiple Claims and retain inspectable membership. An effective metric policy must specify cohort window, maturity, late closure/reopening/correction, exclusions and minimum samples. Zero denominator returns INSUFFICIENT_EVIDENCE, never zero/perfect or division by zero. No numerator Order exists outside its denominator. Missing maturity/calibration is PENDING; do not deploy recalibrated demotion thresholds as validated.

The existing 10 purchased Product units per Buyer-Seller policy week cap applies only to favourable evidence/promotion credit. Keep its existing whole-Order threshold-crossing treatment for favourable QR/Review credit. Confirmed adverse findings remain countable at 9/10/11/20 units and across split Orders; caps cannot hide genuine Seller fault, cancellation or unresolved remedies. Independent abuse/duplicate review can invalidate proven false evidence with correction lineage, not a volume-based adverse blind spot.

## 91. Trust independence

Trust is independent from any future pricing or monetization design. The Seller Console must not visually imply that paying for a feature, plan or promotion can improve reputation.

Trust comes from platform evidence and human/system review according to the Trust domain.

## 92. Reviews

Route:

```
     /s/:sellerId/insights/reviews
```

Show:

• product/item rating;

• seller-service rating;

• written review;

• date;

• transaction reference;

• evidence badge where applicable.

Do not silently combine product and seller-service ratings into one ambiguous number.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

## 93. Seller controls over reviews

Seller cannot:

• hide;

• delay;

• suppress;

• approve;

• reject

a review simply because it is negative.

If content violates moderation policy, it may be reported.

Reporting does not automatically unpublish it.

The existing API makes this distinction explicit.

## 94. Claims

Routes:

```
     /s/:sellerId/claims
     /s/:sellerId/claims/:claimId
```

Claims surface independently from analytics because they are actionable obligations.

Open claims also appear on:

• Home;

• relevant Order.

OWNER/ADMIN and permitted SALES_SUPPORT roles handle Claims. ANALYST receives approved aggregates only; INVENTORY and CAMPAIGN_MANAGER do not inherit full Claim evidence merely from operational/content access.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

## 95. Claim detail

Display:

```
     Claim type
     Order
     Timeline
     Evidence snapshot
     Current status
     Seller response/remedy options
     Deadline
     History
     Resolution
```

Evidence attached automatically by backend remains read-only.

## 96. Claim language

Use facts.

Example:

```
      A payment was submitted and no seller response was recorded before the confirmation
      window ended.
```

Not:

```
      You ignored the buyer.
```

This preserves Adulis's evidence-based trust philosophy.

## 97. Store section

Store contains Seller public identity and fulfilment configuration. Key destinations:

• Store profile;

• public handle;

• physical-store location where applicable;

• fulfilment/availability;

• approved Courier Pools and Cross-Seller Courier relationships;

• verification/social-account status.

Sensitive administration stays in Settings/Administration.

## 98. Store profile and physical-store location

Store profile fields may include public display name, logo, bio, support/contact information allowed by policy, categories and physical-store presence.

If the Seller has a physical shop, location MUST be structured map-provider data, not a seller-authored free-text address.

The location object should retain:

• provider: GOOGLE_MAPS or APPLE_MAPS;

• provider_reference / canonical map URL or provider place reference;

• latitude / longitude;

• provider-formatted display address;

• country/region/locality where resolved;

• IANA timezone where resolved;

• verification/resolution timestamp.

The Console shows a map preview and public visibility toggle subject to policy. Buyers see the public location through Storefront/Product surfaces.

## 99. Store handle

The Store handle is a stable public identifier governed by the Seller/Storefront domain. Handle changes must preserve redirect/history rules defined by Storefront architecture and must not expose internal Seller IDs.

## 100. Fulfilment

Seller fulfilment configuration supports the fulfilment modes approved for each Market, including Buyer Collection, Seller Delivery and Courier Delivery where enabled.

The Console configures supported modes and operational instructions. The chosen fulfilment context for an Order comes from the backend Order/Fulfilment contract.

The Order fulfilment mode is snapshotted before payment. Store configuration changes do not rewrite paid Orders; post-payment changes require an explicit backend-authorized action/workflow.

## 101. Fulfilment charges and display

Fulfilment charges displayed to Buyers are not Adulis monetization policy. If a Market permits seller-defined delivery charges, the Console edits only the fields allowed by the Fulfilment domain and backend validation.

Do not mix delivery charges with platform pricing, seller plans or future monetization.

Courier Delivery charges are Seller-defined, disclosed before provider payment and snapshotted as current MVP Courier compensation. Paid Orders retain their snapshot when Seller rates change. Order totals come from Checkout/Payments: Product subtotal + Courier charge + zero launch surcharge on the versioned configured basis + authorized provider fee = Buyer total. Delivery is excluded from the surcharge basis unless a later approved policy version includes it; Console performs no canonical arithmetic.

## 102. Availability

Seller availability must be market/timezone aware. Opening hours, pickup windows and holiday exceptions are configured in the Seller's active Market timezone rather than a hard-coded Ethiopia offset or browser-local time.

## 103. Holiday closures

Holiday closures are versioned seller/Market availability exceptions. The Console should use local calendar dates in the Market timezone, while the API transmits resolved instants in UTC where an absolute instant is required.

## 104. Verification

Verification is a backend-owned outcome. The Console collects/links permitted evidence and shows status. It must not claim verification merely because a form was submitted.

Launch admission remains intentionally exclusive to businesses with established social-media business presence and creators who also have legitimate seller/business status.

## 105. Social account verification

Social account verification is important to current Seller admission. The Console should support evidence that the applicant controls the declared social business page/account.

A business with no meaningful social-media presence is not eligible under current admission policy. A creator without legitimate business/seller status is also not eligible. Exact thresholds remain configuration, not

hard-coded UI logic.

## 106. Follower count

Follower/audience information may be collected as admission evidence or seller profile context, but follower count is not Trust and must not directly control Trust Level.

Exact admission thresholds are versioned/configured and may change as Adulis broadens eligibility in future years.

## 107. Seller verification and provider onboarding

Seller verification/admission belongs to Verification and authorized Platform workflows. Console displays current requirements, submission/provider status and allowed next actions.

Current evidence may include Account/phone control, social-account control, social-commerce business eligibility and Seller/business information. Adulis currently collects no Government ID, passport, ID-card scan or selfie for Seller admission. Do not imply an Operator reviews Adulis Government-ID evidence.

Payment-provider KYC is provider-specific onboarding and is displayed through safe provider status, not relabeled Adulis identity verification. Sensitive evidence is shown only where separately authorized.

View uses seller.verification:read; authorized submission uses seller.verification:submit. Neither capability grants approval or bypasses sensitive-evidence/step-up checks.

## 108. Couriers

```
/s/:sellerId/store/couriers
```

Current MVP supports Private Courier Pools plus the Cross-Seller Courier Network. Persistent Courier identity may be approved by multiple Sellers; relationship count does not increase active-delivery capacity.

OWNER/ADMIN may invite/approve permitted relationships, review Courier applications, remove/revoke relationships, manage private pools, configure allowed compensation/terms and assign eligible Couriers. INVENTORY may assign already eligible Couriers to an Order but cannot administer standing relationships. SALES_SUPPORT reads Buyer-safe delivery state; ANALYST reads approved aggregates; CAMPAIGN_MANAGER has no Courier operations.

Fulfilment returns eligible Couriers and allowed_actions. Console computes neither eligibility nor concurrency. MVP permits one active accepted delivery per Courier, with no simultaneous grouped route, batching or optimization.

Show assignment, Awaiting Pickup, Pickup Verified, In Delivery, Delivery Verified, Exception and completion state. Display Seller Pickup credential only when authorized. There is no current/last GPS, sample age, live map or route history.

Bounded Pickup/Delivery checkpoint evidence is private/order-scoped and permission-gated; ordinary Seller UI does not need precise coordinates. Location alone never completes a Handoff.

![Courier relationships / assignment capacity](graphics/CONSOLE_07.svg)
*Figure 07. Courier relationships / assignment capacity. Persistent Courier identity can span Seller relationships while MVP allows one active accepted delivery.*

## 109. Courier revocation

Revoking a Seller-Courier relationship must terminate future authorization according to Fulfilment/Auth rules. Active assignment handling is a backend domain decision; the Console must not silently strand an Order or erase historical custody/Handoff/checkpoint evidence.

## 110. Administration

Administration contains Team, roles/permissions, Sessions & Devices, Ownership, Seller closure, Account deletion entry, security settings and provider/configuration surfaces explicitly allowed by backend policy.

Commercial pricing configuration is not part of this baseline.

## 111. Payment-provider configuration boundary

The old direct-receiving-bank-account workflow is not canonical under gateway checkout.

Any Seller payment-provider/settlement configuration exposed by Chapa or a future payment architecture must live behind a typed Payment domain contract. The Console must not invent account fields, settlement timing or merchant routing before that architecture is approved.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

If Finance exposes a supported settlement-account mutation after the applicable G01 evidence, require seller.finance:settlement_account_update. This capability is not arbitrary provider configuration or evidence that a payment route is approved.

## 112. Settlement configuration status

If the Payment domain exposes seller settlement/onboarding status, the Console may render read-only states and permitted actions such as Complete provider onboarding, Update allowed settlement details or Contact support.

The backend supplies allowed_actions. The Console does not infer settlement eligibility or payment-provider KYC state.

## 113. Payment configuration security

Any future change to seller payment-provider configuration is sensitive. Require Step-Up where the Auth/Payment contract says so, bind the authorization to the exact Seller and action, log the change, and send security notifications when policy requires them.

Provider secrets and full account credentials never appear in browser storage or broad logs.

The actual exposed settlement-account operation requires seller.finance:settlement_account_update plus Finance-owned action/target/audience-bound step-up and governance. Missing provider permission leaves the operation disabled even for OWNER.

## 114. Team

After offline recruitment, invite an EXISTING ordinary Account selected by username. Resolve target_account_id server-side and bind it immutably; username/phone changes cannot retarget the invite. No unregistered-phone team recruitment flow. Authorized Owner/Admin assigns permitted roles; target-bound acceptance, expiry/revocation and current exclusivity apply. PENDING invitations may coexist without membership authority or revealing another Seller relationship. One ACTIVE/SUSPENDED TEAM slot is database-enforced under concurrent acceptance; ownership/Courier relations remain separate.

Team list/actions still use current OWNER/ADMIN and exact allowed_actions, separate OWNER-only operations, unioned non-OWNER roles and current membership standing. No candidate marketplace or shared credentials.

![Explicit anonymous, ordinary, privileged and trusted service contexts](graphics/CONSOLE_08.svg)
*Figure 08. Explicit anonymous, ordinary, privileged and trusted service contexts. Modes change acting relationships, not identity; separate Operator and delegate receipt boundaries remain.*

## 115. RBAC UI

When assigning a role, explain capabilities.

Example:

```
   INVENTORY
```

Can:

✓ manage products

✓ manage variants

✓ update stock

Cannot:

✗ manage team

✗ transfer ownership

Do not make sellers memorize role names.

INVENTORY may also prepare, Mark Ready and assign an already eligible Courier to an Order; it cannot administer Courier Pools, access unrestricted Buyer Inbox, change team/security or transfer ownership. Use the complete responsibility matrix in section 17 for every role, including read-only privacy limits and combinations of non-OWNER roles.

## 116. Role enforcement

The UI role description is educational only.

Actual authorization remains:

permission matrix + relationship + standing + scope + surface

server-side.

## 117. Ownership transfer

Only Owner.

Recipient must be an eligible existing Admin according to current policy.

Flow:

Owner chooses Admin

```
         ↓
```

Step-up

```
         ↓
```

Pending transfer

```
         ↓
```

Unsuppressible notice

```
         ↓
```

24-hour delay

```
         ↓
```

Cancelable

```
         ↓
```

Activation

Blocked where canonical conditions such as open claim/pending payment-account change apply.

## 118. Sessions & Devices

Display:

Current session Other sessions Remembered devices Last used Approximate location where available

Actions:

Revoke session Revoke others Revoke all

Sensitive bulk revocation uses step-up where required.

Separate self-service ordinary Account sessions (AUTH §118, authenticated owner) from Seller-scoped administration (seller.sessions:read / seller.sessions:revoke). Seller bulk authority stays within the approved Seller scope; it cannot revoke unrelated personal or Operator sessions. A UI label "all" means all authorized target-scope sessions, never every session of the human.

## 119. Notifications

Notifications shown in Console are logical platform notifications rendered from the Notifications domain. Seller preferences may control suppressible operational/informational classes; security-critical notices remain non-suppressible.

Relevant current events include paid Order received, Courier assignment/pickup, active delivery exception, buyer message, Claim, moderation action, low stock, content status and security changes.

## 120. Unsuppressible security notifications

Security-critical events remain mandatory:

New suspicious/important device event Payment-account change Ownership transfer Session/security event

The seller cannot disable required account-security notices.

## 121. Content notifications

Content notifications cover Scene processing/publication, moderation/restriction, visibility and relevant availability changes. Avoid storms for every FYP impression or tag click.

Scene made Private: All tagged Products are currently out of stock.

Scene restored to Public: At least one tagged Product is available again and this Scene is public.

Route notices to authorized content roles, including lightweight CAMPAIGN_MANAGER mobile notices. Notifications are hints; opening the Scene reloads canonical publication/visibility/reason and allowed_actions.

## 122. Global day-one operating model

Adulis launches globally from Day One. Seller Console architecture must therefore treat Market, currency, locale, timezone, provider availability, fulfilment rules and policy versions as explicit context.

Do not use Ethiopia-only constants in shared seller code. Ethiopia remains one Market configuration, not the platform default embedded in business logic.

## 123. Market configuration

Every seller-scoped operational request resolves MarketContext explicitly.

Market configuration supplies at least:

• country/region;

• currency and money rules;

• IANA timezone;

• locale/language availability;

• Chapa/payment-provider availability and later provider routing;

• fulfilment capabilities;

• legal/policy/configuration versions.

The Console renders what the server resolves and does not guess Market from IP or browser locale.

## 124. Market-local time semantics

Human-facing order and buyer-seller activity times use the local timezone of the relevant Market/order context.

For countries with multiple timezones, use the configured Market/region IANA timezone, not one hard-coded country offset. Operating hours, holiday dates and local deadlines are calculated using timezone rules including daylight-saving transitions where applicable.

## 125. API UTC timestamp contract

API timestamp contract:

```
    ISO 8601 UTC only, with Z
```

Examples:

```
    2026-09-15T10:20:30Z
```

The API must not require clients to send local timestamps for canonical events. Clients convert UTC instants to the relevant Market timezone for display. Local business-time inputs (for example opening hours) are submitted with explicit Market/timezone context and resolved server-side.

## 126. Physical-store map location model

Physical-store location is a structured provider object, never only free text.

Recommended conceptual model:

```
    provider: GOOGLE_MAPS | APPLE_MAPS
    provider_reference
    latitude
    longitude
    formatted_address
    country_code
    region/locality
    timezone_iana
    resolved_at
```

A human-readable label is display data derived from the provider location. The canonical location must retain map coordinates/provider provenance so Buyers can open a real map location.

## 127. Location authorization and privacy

Only Seller members with the appropriate store-profile permission can change public physical-store location. Changes are seller-scoped and audited.

The Console should make public visibility explicit. Do not expose private pickup coordinates merely because a Seller has a public shop. Public store location and order-specific fulfilment location remain separate data classes.

## 128. Payment-provider outage and recovery

When Chapa/provider services are degraded:

• historical paid Orders remain readable;

• no Seller manual override can create payment truth;

• new payment-dependent buyer flows may be paused/degraded by backend policy;

• reconciliation workers retry idempotently;

• Console shows a neutral operational banner when supplied by platform health/configuration.

Provider outage does not justify weakening seller authorization, QR security or Order invariants.

## 129. Technology placement and impact

Current canonical technology placement and Seller Console impact:

Backend - Node.js / NestJS / Fastify / strict TypeScript: seller commands and queries run in the modular monolith; Fastify is the HTTP adapter. Drizzle ORM + PostgreSQL: canonical seller, catalogue, content, order and configuration state. pg_trgm supports bounded text search; btree_gist supports database constraints where needed; pg_stat_statements provides query visibility. Valkey: non-canonical cache/rate-limit/supporting ephemeral state. BullMQ: durable async execution/reconciliation over Valkey. REST + OpenAPI + @nestjs/swagger + generated TypeScript client: one typed API contract used by the Console; handwritten duplicate DTOs are discouraged. @nestjs/throttler / @fastify/helmet / libphonenumber-js: API abuse controls, secure HTTP headers and normalized international phone handling. Cloudflare R2 + CDN + Sharp: direct media upload/delivery and bounded image processing for Product/Scene content. Jest + Testcontainers + Playwright + k6: unit/domain, database integration, Console E2E and load tests. Maestro remains for the Mobile Seller Companion, not the browser Console. Sentry + Pino + pg_stat_statements: frontend/backend error visibility, redacted structured logs and database-query diagnostics. dependency-cruiser: prevents private cross-domain repository imports in the modular monolith/frontend package boundaries. Docker + GitHub Actions + Render + Cloudflare: reproducible builds, CI/CD, backend hosting and edge/web delivery. EAS applies to Mobile releases, not the Seller Console bundle.

## 130. Commercial policy boundary

Current closed transaction architecture includes a versioned launch-disabled zero Buyer-side Checkout surcharge. Checkout/Payments compute the canonical amount on the configured basis and snapshot it with the Seller Order; Console only displays authoritative values.

Seller plans, subscriptions, pricing/entitlement packaging, advertising and future monetization remain separately open. Historical commercial assumptions cannot create current rates, paywalls, Seller obligations or pricing navigation.

Maintain a future integration seam for approved Seller packaging without coupling payments, Trust or commerce correctness to it. No Seller subscription pricing UI is added until separately approved.

## 131. Seller closure

Seller closure is not the same as deleting a human Account. The Seller domain coordinates closure/visibility while Orders, Claims, Trust, media and audit history follow their own lifecycle rules.

Closure must not erase evidence required for active processes.

## 132. Deletion

Account deletion is an Account Lifecycle workflow owned by the main Adulis platform. Seller Console is only an authenticated frontend entry point.

The Console starts/verifies/confirms the same self-service deletion workflow used by Mobile/Company Web where applicable. It never issues arbitrary DELETE statements or directly deletes domain tables.

Self-deletion checks the authenticated Account’s own identity and action-bound step-up through AUTH §52/140. Do not attach an invented Seller capability or let a Seller administrator delete another person. Seller-business closure is a separate seller.lifecycle:close action with its own owner/obligation checks.

## 133. Frontend technology

Seller Console frontend remains React + strict TypeScript as a responsive Web/PWA surface.

Use generated TypeScript clients from OpenAPI for backend contracts. TanStack Query may manage server state if used by the existing Console implementation; keep local UI state small and presentation-only. Do not copy Mobile-only Expo libraries into the Web Console.

## 134. PWA posture

PWA posture is progressive enhancement, not offline business authority. The Console may cache shell/static assets and safe read data, but service workers must never make payment, Order, permission, QR acceptance or Trust decisions.

## 135. Frontend feature architecture

Feature architecture should mirror domain boundaries: auth/context, seller/store, catalogue/inventory, content/media, orders/fulfilment, chat/chatbot, trust/reviews/claims, analytics, notifications and administration.

Cross-feature writes route through typed application APIs; one screen must not import another domain's private repository/client internals.

## 136. Shared packages

Monorepo:

packages/

```
   ├── design-system
   ├── tokens
   ├── locale
   ├── api-contracts
   ├── schemas
   ├── permission-catalogue
   ├── analytics-events
   ├── money
   ├── dates
   └── qr-contract
```

Do not share backend database repositories with frontend packages.

## 137. Backend module map

Backend modules relevant to Seller Console include:

```
    Auth / Authorization
    Seller / Onboarding / Verification
    Market Configuration
    Catalogue / Inventory
    Content (Scene Posts) / Media
    Checkout / Payments (Chapa adapter)
    Orders
    Fulfilment / Handoff
    Chat / Chatbot
    Trust / Reviews / Claims / Moderation
    Notifications
    Analytics
    Privacy / Account Lifecycle
```

There is no separate Seller Console backend database.

## 138. Module isolation

Module isolation is enforced by application interfaces and dependency-cruiser. Content may query Catalogue through a documented interface but cannot mutate Product/Inventory private tables. Orders consume payment facts through the owning Payment interface. Analytics observes facts but never creates commerce truth.

## 139. No Console database

Do not create:

```
     seller_console_database
```

The Console is a client.

Canonical data remains in the domain-owned PostgreSQL schemas.

The browser should never connect directly to PostgreSQL.

## 140. Server state

TanStack Query/server-state caching must use seller_id + market_id + resource identity in query keys. Cache invalidation follows server facts/events and must not authorize state changes. Valkey/server caches remain non-canonical and are separate from browser query caches.

## 141. Local browser state

Allowed:

```
     sidebar collapsed
     table density
     last non-sensitive filter
     draft UI values
     dismissed educational tips
```

Do not put into localStorage:

• session token;

• buyer messages;

• financial details;

• entire order responses.

## 142. Optimistic updates

Optimistic updates are appropriate for low-risk UI actions only. Do not optimistically claim payment success, Order transition, QR acceptance, Trust changes, Courier assignment or physical-store location publication before the backend accepts the command.

## 143. Concurrency control

Editable seller aggregates should support optimistic concurrency.

Example:

```
   GET Product
```

version = 18

```
   PATCH Product
```

expected_version = 18

If another Admin changed it:

409 CONFLICT current_version = 19

Seller chooses whether to refresh/reapply changes.

This is preferable to silent last-write-wins.

## 144. Idempotency

All seller mutations that may be retried require idempotency where the backend contract says so. High-value examples include Mark Ready, Courier assignment, content publication, product/inventory writes, location update

and Account Lifecycle requests.

## 145. Actor channel

Every command preserves actor channel/provenance such as SELLER_CONSOLE, SELLER_COMPANION, OPERATOR or SYSTEM. The client cannot use actor-channel metadata to gain permission; authorization is still derived server-side.

## 146. API error contract

Use machine-readable errors.

Example:

```
     {
         "type": "https://errors.adulis/...",
         "code": "ORDER_STATE_CONFLICT",
         "requestId": "req_...",
         "messageKey": "errors.order_state_conflict",
         "slots": {},
         "items": []
     }
```

Never make English prose the API contract.

## 147. Validation errors

Return all useful field errors.

Console shows:

```
     Error summary
      ↓
     linked field 1
     linked field 2
     linked field 3
```

not only the first error.

This is especially important for:

• product editor;

• seller onboarding;

• payment-account settings;

• Scene Post publication.

## 148. Cross-tenant security

If a seller changes:

```
     /product/123
```

to another seller's valid product ID:

return ordinary:

where the authorization contract requires non-enumeration.

Do not say:

```
       Product exists but belongs to another seller.
```

## 149. API authorization contract

Every endpoint review should answer:

Who may call it? Which seller? Which object? What permission? What entitlement? Which surface? What state? Is step-up required? Is idempotency required? What audit event is written?

No endpoint should be merged without those questions being answered.

Executable contract review validates each Seller code against AUTH §157 and separately classifies Account self-service lifecycle/session purposes. The endpoint requires the actual action’s capability and fresh proof, not any broad alternative or client-selected permission.

## 150. allowed_actions

Every mutable resource response should expose server-resolved allowed_actions where useful. The browser uses them for affordances but still expects the server to revalidate permissions and business state on write.

## 151. Security headers

Console requires a stronger CSP than public marketing pages.

Use:

Content-Security-Policy Strict-Transport-Security X-Content-Type-Options Referrer-Policy Permissions-Policy

No unsafe-inline scripts.

The existing architecture already requires nonce-based CSP before authenticated Console use.

## 152. Seller-provided text

Never render raw seller HTML.

Store:

```
     plain text
     or
     strictly structured rich-text AST
```

React escaping alone should not be bypassed with:

```
     dangerouslySetInnerHTML
```

for seller content.

## 153. Sensitive fields

Console must never expose more than necessary.

For ordinary order management:

• do not expose buyer phone by default;

• do not expose unnecessary identity data;

• do not expose complete receiving-account credentials after setup;

• do not expose internal fraud signals.

## 154. Payment and settlement display boundary

The Seller Console may display safe payment-provider/settlement status supplied by the Payment domain. It must not expose old direct-receiving account semantics, provider secrets or invent settlement rules.

If no seller-facing settlement configuration is required by the approved provider architecture, the entire surface should be absent rather than filled with speculative fields.

## 155. Search

Console search is scoped to seller-owned operational data.

Examples:

```
     Orders by reference
     Products by name/SKU
     Content by title/caption
```

Do not introduce Elasticsearch for MVP.

PostgreSQL indexes/search are adequate until measured evidence shows otherwise.

## 156. Pagination

Use cursor pagination for:

• Orders;

• Products at scale;

• Inbox;

• Claims;

• Notifications;

• stock history;

• content;

• analytics detail lists.

Avoid offset pagination on frequently changing operational datasets.

## 157. Exports

Large exports are asynchronous.

```
     Seller requests export
             ↓
     Job created
             ↓
     Worker generates
             ↓
     Private object storage
             ↓
     Short-lived download
             ↓
     Seller notified
```

Do not hold an HTTP connection while generating one year of analytics.

## 158. Notifications architecture

Domain event

```
          ↓
     Notification record
          ↓
     Preference evaluation
          ↓
     Channels
        ├── in-app
        ├── native push
        └── security SMS where required
```

Console reads the same canonical notification records as Seller Companion.

## 159. Console refresh strategy

MVP:

```
     Orders needing action: ~20-30s visible
     Inbox: ~30s visible
     Notifications: ~30-60s
     Analytics: minutes / manual refetch
     Trust: event-driven cache invalidation/manual refetch
     Products: mutation invalidation
```

Pause polling when the browser tab is hidden.

Do not use aggressive polling for everything.

## 160. Observability

Observe Seller Console as both a frontend and a client of business-critical platform domains.

Monitor:

• frontend errors/releases via Sentry;

• API request errors/latency and request IDs;

• Chapa/provider payment/reconciliation health from backend observability;

• Valkey/BullMQ queue lag and retries;

• media upload/processing failures;

• Product/Scene publication failures;

• Courier assignment conflicts, checkpoint-attempt outcomes and QR/OTP acceptance failures;

• cross-tenant/security anomalies.

Operational telemetry never becomes business truth.

## 161. Frontend observability

Capture:

```
     route
     release version
     seller-context hash/reference where safe
     request ID
     error boundary
     browser
     network state
```

Never capture:

• OTP;

• buyer message text;

• full phone;

• payment-account values.

## 162. Request ID

Every unexpected error shown to seller should include:

```
     Request ID: req_...
```

selectable/copyable.

This lets support trace backend logs.

## 163. Audit

Audit is separate from analytics and logs. Durable audit is required for sensitive seller actions such as team/role changes, Seller verification/admission actions, payment-provider configuration where exposed, ownership transfer, physical-store location changes, session revocation, Account/Seller lifecycle actions and privileged evidence access.

## 164. Analytics versus audit

Do not confuse:

analytics

with:

audit.

Analytics can be sampled/aggregated.

Audit cannot silently disappear because a telemetry pipeline was delayed.

## 165. Performance targets

Initial engineering objectives:

Console shell first usable render:

< 2.5s on typical Addis mobile broadband

Normal API p95:

< 500-800ms where practical

Critical write acknowledgement:

< 2s typical

Order list:

< 1s typical

Product list:

```
     < 1s typical
```

These are engineering targets, not public SLAs.

## 166. Bundle control

Route-level code splitting.

A seller opening Orders should not download:

• Scene Post editor;

• analytics chart library;

• payment-account screen;

• chatbot testing tools.

Keep the initial authenticated bundle small.

## 167. Chart library

Use a lightweight charting dependency only where data requires visualization.

Do not build the Home dashboard around decorative charts.

Operational cards and tables are usually more useful for early sellers.

## 168. Accessibility

Target WCAG AA.

Requirements:

• complete keyboard operation;

• visible focus;

• semantic tables;

• proper form labels;

• linked validation summary;

• screen-reader announcements after async actions;

• state not represented by color alone;

• 44×44 targets on touch layouts;

• reduced-motion support.

Payment confirmation and payment rejection outcomes especially need accessible announcements.

## 169. Localization

The Console is global-ready. English is the baseline product language; Amharic remains first-class for Ethiopia. Additional locales are enabled by Market configuration rather than requiring architectural changes.

Seller-authored content keeps its own language. UI translation keys are versioned and never constructed from sentence fragments that break grammar.

## 170. Amharic layout

No fixed-height content containers.

Test:

• long product names;

• long store names;

• payment instructions;

• claim explanations;

• step-up dialogs;

• moderation explanations.

Numbers/money/dates go through locale-aware formatting.

## 171. Money representation

Money is represented in integer minor units plus ISO currency code in API/domain contracts. Never use floating-point arithmetic for prices, totals or analytics-derived monetary values.

The active Market determines allowed currency/presentation rules. The Console formats; backend domains calculate canonical amounts.

## 172. Time and timezone rules

Canonical API instants are UTC only.

Human-facing Seller Console times are rendered in the relevant Market/order IANA timezone. For multi-timezone countries, use the configured regional Market timezone, not a fixed country offset.

Rules:

• API: ISO 8601 UTC Z timestamps.

• Database: timezone-aware instants for canonical events.

• Order/activity display: Order Market local time + clear timezone label where ambiguity exists.

• Seller operating hours/holiday dates: interpreted in Seller/Market local timezone.

• Cross-market views: never silently convert all Orders to the browser machine timezone.

## 173. Testing pyramid

Required:

Unit Component Integration API contract Database invariant E2E Authorization-negative Security Load

The current Adulis engineering manual explicitly requires database/invariant, API-contract and security-sensitive negative testing in addition to happy-path UI tests.

## 174. Critical E2E  -  seller onboarding

Seller onboarding E2E:

```
    authenticate
    -> establish Seller relationship
    -> verify current social-business admission evidence
    -> complete required Store/Seller-business/fulfilment/provider readiness
    -> create first Product Post
    -> publish
```

Negative path verifies that a business without required social presence or a creator without legitimate seller/business status cannot bypass current admission policy.

## 175. Critical E2E  -  order

Order E2E:

```
    Buyer checkout
    -> Chapa/provider payment
    -> server verifies paid state
    -> paid Order appears in Seller Console
    -> Seller marks Ready
    -> selected fulfilment path
    -> handoff evidence
    -> completion
```

Verify the Seller never receives an action to manually establish payment truth.

## 176. Critical E2E - gateway payment failure

Gateway payment failure E2E:

```
    checkout attempt
    -> provider failure / cancellation / delayed verification
    -> no seller preparation action
    -> backend reconciliation/retry according to Payment policy
    -> later verified charge is preserved and shown truthfully
    -> Seller preparation only after joint stock + operational PAID commit
    -> authorized late success with no stock stays PAID_BUT_UNFULFILLABLE; Seller remedy owed
```

Test duplicate callbacks, stale browser success pages and provider timeout behavior.

## 177. Critical E2E  -  cross-device conflict

Console opens order Mobile Companion changes order Console performs stale action → 409 → state refresh → correct UI

Concrete fixture: Mobile Companion marks Order Ready; Console submits a stale mutation; server responds 409/current version; Console reloads canonical state and allowed_actions. No payment confirmation action exists.

## 178. Critical E2E  -  FYP content

FYP content E2E:

```
    create Product Post
    -> upload media
    -> create Scene Post
    -> tag >=1 Product Post owned by same Seller
    -> reject cross-Seller tag
    -> publish
    -> moderation/eligibility
    -> FYP candidate
    -> Buyer opens Scene Post
    -> product-tag click
    -> Product Post
    -> seller analytics aggregate
```

Similar Finds and Complete the Scene remain disabled in this test baseline.

Reject zero tags and all-unavailable publication. With two available tags, lose one and keep PUBLIC; lose the last and assert PUBLISHED/PRIVATE, public FYP/Search/Storefront/direct-link/Collection suppression, Seller Private badge and notice. Restock one and assert automatic PUBLIC restoration plus notice only after all gates pass. Repeat with archive/block/suspension/Market restriction preventing restoration.

## 179. Critical E2E  -  multi-seller account

Account owns Seller A and has one INVENTORY membership in Seller B -> open A and B in separate tabs -> mutate only permitted resources -> assert context isolation.

Existing username invitation -> select multiple non-OWNER roles -> accept -> membership activates if exclusivity passes. A second non-terminal team membership and simultaneous acceptance race are rejected. Owning multiple Sellers and Courier relationships C/D remain valid where policy permits.

## 180. Critical E2E  -  RBAC

For every role:

rendered controls = server-granted controls

Then directly call prohibited endpoints to verify the backend still refuses them.

UI hiding is not security.

Positive/negative fixtures cover OWNER-only transfer/closure, ADMIN ordinary administration, SALES_SUPPORT read/support/Claim/Inbox only, INVENTORY physical fulfilment and order-level Courier assignment without pool/Inbox access, privacy-bounded ANALYST aggregates, and CAMPAIGN_MANAGER Scene/chatbot work without Order/price/stock/team/provider mutations. Test hidden permission denial versus explained entitlement denial and combined role-sets.

## 181. Critical E2E  -  step-up

Test:

wrong action wrong target expired challenge already-consumed challenge concurrent reuse mobile audience correct action

Only the final case succeeds.

Specify denial with a valid step-up but missing capability, wrong Seller, another person’s self-deletion, unrelated personal/Operator session, or an action needing a different capability. Positive inbox read/reply uses the existing SALES_SUPPORT grants; step-up never widens them. Application/API checks remain unexecuted.

## 182. Critical E2E - physical-store map location

Physical-store location E2E:

```
    Seller declares physical shop
    -> selects/pastes supported Google Maps or Apple Maps location
    -> backend resolves/stores structured provider location + coordinates
    -> Console preview
    -> Storefront shows same public location
    -> free-text-only address submission is rejected
```

Verify cross-Seller location mutation is impossible.

## 183. Critical E2E - Courier QR + checkpoint evidence

Paid Order -> authorized Seller role Marks Ready -> Fulfilment assigns an eligible Pool/Network Courier -> Seller displays Pickup QR -> assigned Courier scans -> connected custody accepted -> In Delivery -> Courier displays Delivery QR -> Buyer or authorized delegate scans -> connected receipt accepted -> completion eligibility.

Verify purpose separation, replay/idempotency, role/scope checks, OTP fallback and audited Manual recovery. No offline success and no Seller payment confirmation.

One Courier may have several standing Seller relationships but cannot accept a second active delivery. Location attempts occur only at Pickup and Delivery; denied/unavailable/timeout/low-accuracy/error outcomes do not invalidate an otherwise valid Handoff. Exact coordinates stay sensitive; no live GPS/map/sample-age UI exists.

## 184. Critical E2E  -  deletion

Account self-deletion: authenticated own Account + exact lifecycle step-up -> active obligations assessed -> blockers listed -> owning lifecycle prerequisites satisfied -> deletion request permitted. Seller closure: seller.lifecycle:close + current owner/step-up/obligation checks -> separate Seller workflow. Test that administrator authority cannot delete another human, closure cannot substitute for self-deletion, and personal/Operator sessions are outside Seller revocation scope.

## 185. Load testing

Prioritize:

Orders list Order detail Products list Scene Post list analytics summary Inbox notification list

Do not benchmark media bytes through NestJS when production upload/download bypasses it.

## 186. Security testing

Required classes:

```
     Cross-seller IDOR
     CSRF
     XSS
     session fixation
     session theft behavior
     step-up bypass
     permission bypass
     RLS failure
     file MIME spoofing
     upload abuse
     unsafe URL rendering
     PII logging
     cache leakage
```

## 187. Deployment

Separate development, staging and production environments.

Separate at minimum:

• PostgreSQL databases;

• Valkey instances/namespaces;

• object-storage namespaces;

• credentials/secrets;

• Chapa/payment-provider environment keys;

• OTP/provider configuration;

• analytics/observability environments.

Never use production Seller data in staging.

## 188. Deployment unit

Recommended:

```
     Seller Console frontend
```

is an independently deployable artifact.

It can live in the same monorepo as:

```
     Company Website
     Storefront
     Mobile
     API
```

but should not require deploying all of them when one Console UI bug is fixed.

## 189. CI pipeline

Install

```
      ↓
     Typecheck
      ↓
     Lint
      ↓
     Unit tests
      ↓
     Permission catalogue validation
      ↓
     Translation completeness
      ↓
     API contract compatibility
      ↓
     Component tests
      ↓
     Build
      ↓
     CSP/security validation
      ↓
     Playwright
      ↓
     Preview deploy
```

## 190. Production release

Production release:

```
    reviewed PR
    -> GitHub Actions CI
    -> build/test
    -> staging deployment
    -> migrations if required
    -> smoke + critical Playwright E2E
    -> production deployment
    -> health verification
    -> gradual feature enablement
```

Risky capabilities such as new Scene Post publishing, payment-provider changes, physical-store map publishing and Courier assignment/checkpoint workflows should use feature flags/kill switches where appropriate.

## 191. Feature flags

Every flag must have:

```
     owner
     reason
     default
     target population
```

```
     created date
     removal condition
     telemetry
```

Flags are not permanent architecture.

## 192. Database migrations

Migrations must preserve strong PostgreSQL invariants and safe backward compatibility.

Never rely only on Console validation for unique handles, Variant uniqueness, Product-tag ownership, legal Order transitions, Seller ownership, stock validity, permission boundaries or idempotency.

Use Drizzle migrations plus Testcontainers upgrade-path tests where practical.

## 193. AI coding-agent rule

Before adding:

```
     table
     enum
     permission
     API endpoint
     state
     role
```

the coding agent must search for the canonical existing equivalent.

The current social-commerce manual explicitly requires extending canonical entities instead of creating parallel models.

## 194. No premature infrastructure

Do not introduce for Seller Console MVP:

```
     Kubernetes
     Kafka
     microservices
     GraphQL
     WebSockets everywhere
     Elasticsearch
     dedicated feature store
     Python ML service
     separate seller BFF with business logic
     multiple seller databases
```

The modular monolith is sufficient.

## 195. Updated screen inventory

Preserve already implemented stable SC-* identifiers where possible. Do not renumber existing screens merely for documentation aesthetics.

Current/updated additions should cover:

• Content / Scene Posts

• Scene Post Editor

• Content Performance

• Media Library

• Chatbot Overview / Answers / Testing / Insights

• Physical Store Map Location

• Courier Assignment / Handoff / Delivery Exceptions

• Payment/Provider Status (read-only where applicable)

Do not add seller-facing commercial-policy screens until a commercial policy is approved.

Include role-aware Home/navigation, All/Draft/Public/Private/Archived/Restricted content filters, prominent Seller-only Private badge/reason and visibility notifications, username team invitation and responsibility descriptions. Preserve stable screen IDs and migrate terminology without arbitrary renumbering.

## 196. Updated system areas

Final Seller Console domains:

```
    ENTRY
      Sign in / Home / Seller setup
```

```
    TRADE
      Paid Orders / Preparation / Fulfilment / Handoff / Courier delivery state
```

```
    CATALOGUE
      Product Posts / Variants / Inventory / Product media
```

```
    CONTENT
      Scene Posts / Editor / Media / Content performance
```

```
    CONVERSATION
      Inbox / Conversation
```

```
    AUTOMATION
      Chatbot overview / Answers / Testing / Insights
```

```
    TRUST & SAFETY
      Trust / Reviews / Claims / Moderation status
```

```
    STORE
      Profile / Map location / Fulfilment / Availability / Couriers / Verification
```

```
    ADMINISTRATION
      Team / Roles / Sessions / Ownership / Security / Lifecycle
```

```
    PLATFORM SERVICES
      Notifications / Analytics / Provider status / Market context
```

## 197. Hard Seller Console invariants

CONSOLE-INV-01 The Console computes no canonical business lifecycle state. CONSOLE-INV-02 Every seller-scoped request carries explicit Seller context and, where relevant, Market context. CONSOLE-INV-03 The browser never decides authorization. CONSOLE-INV-04 Missing permission may hide an affordance; the server still rejects independently. CONSOLE-INV-05 Payment success is provider/server verified; the Seller cannot confirm payment manually. CONSOLE-INV-06 Product Post is the canonical commerce object for one sellable Product. CONSOLE-INV-07 Every Scene Post references at least one materially relevant Product Post. CONSOLE-INV-08 Current MVP Scene Post tags are same-Seller only. CONSOLE-INV-09 Similar Finds and Complete the Scene are disabled/deferred. CONSOLE-INV-10 Courier delivery has separate Seller->Courier pickup QR and Courier->Buyer delivery QR. CONSOLE-INV-11 Location is supporting evidence attempted only at Pickup and Delivery; no continuous/live tracking. A valid connected Handoff remains valid without location. CONSOLE-INV-12 Public physical-store address is structured Google Maps/Apple Maps location data, not plain text. CONSOLE-INV-13 API instants are UTC; human operations render in relevant Market-local time. CONSOLE-INV-14 Valkey is the only current cache/async datastore name. CONSOLE-INV-15 The current launch-disabled zero Adulis Buyer Checkout surcharge is Payments/Checkout truth; Seller plans/subscription/advertising packaging remains separately open.

- CONSOLE-INV-16 - Zero-tag/all-unavailable Scenes cannot publish; last available Product loss sets PUBLISHED/PRIVATE, not archived.

- CONSOLE-INV-17 - Restock triggers gated automatic PUBLIC restoration and Seller notification; private content is absent from all Buyer/public resolution.

- CONSOLE-INV-18 - Role grants derive from responsibility and are enforced server-side; read-only does not imply read-everything.

- CONSOLE-INV-19 - Ordinary Account has at most one non-terminal Seller TEAM membership; joining uses an existing username invitation.

- CONSOLE-INV-20 - Pool administration is distinct from INVENTORY order-level assignment; Courier concurrency is one active accepted delivery.

- CONSOLE-INV-21 - Provider payment state and pre-payment fulfilment snapshot are authoritative/read-only except explicit allowed workflows.

- CONSOLE-INV-22 - Trust has four labels and no Product-count cap; Seller admission collects no Adulis Government-ID evidence.

- CONSOLE-INV-23 - Checkout surcharge is current; Seller packaging remains separately open.

## 198. Launch scope

MVP Seller Console priorities:

• Authentication / seller context / RBAC / Step-Up

• Seller setup and social-business eligibility

• Store profile + structured physical-store map location

• Fulfilment + Private Courier Pools / Cross-Seller Courier Network + checkpoint/Handoff state

• Product Posts / Variants / Inventory

• Direct media upload/processing

• Scene Posts with mandatory same-Seller Product tags

• paid Order operations

• Mark Ready

• Seller-to-Courier pickup QR state

• Courier-to-Buyer delivery state

• Inbox / Chat

• basic chatbot administration

• core analytics and content-to-commerce metrics

• Trust / Reviews / Claims / Notifications / Sessions

## 199. Can follow shortly after MVP

Can follow after MVP when evidence justifies it:

• richer content analytics;

• advanced Media Library workflows;

• advanced chatbot testing/unmatched insights;

• bulk inventory tooling;

• advanced team administration;

• richer content scheduling;

• additional global locales/Market-specific administrative tools.

## 200. Explicitly deferred

Explicitly deferred:

• Similar Finds;

• Complete the Scene;

• cross-Seller product tagging in Scene Posts;

• creator/affiliate commerce;

• open Courier bidding, advanced ranking, batching or route optimization beyond current approved Pool/Network workflows;

• complex logistics pricing/insurance;

• AI-generated Seller replies;

• Seller-controlled recommendation boosts;

• TikTok-grade video studio/live commerce;

• advanced CRM/ERP/warehouse-management suites;

• monetization/pricing screens until commercial policy is approved.

## 201. Launch gates

Production launch gates include:

✓ secure authentication/session/CSRF

✓ seller-context and Market-context isolation

✓ RBAC and Step-Up negative tests

✓ seller social-business admission enforcement

✓ first Product Post can publish

✓ Scene Post requires >=1 same-Seller Product tag

✓ cross-Seller tag rejected

✓ Similar Finds / Complete the Scene absent or disabled

✓ media direct-upload + processing works

✓ stock invariants work

✓ Chapa/provider payment truth cannot be set by Seller/browser

✓ paid Order appears exactly once after verification

✓ Mark Ready is correctly gated

✓ eligible Private Pool / Cross-Seller Network assignment works

✓ pickup and delivery QR purposes are distinct and replay-resistant

✓ checkpoint-only location with failure-tolerant connected Handoff and no live map

✓ structured Google/Apple map location works; free-text-only location rejected

✓ UTC API timestamps and Market-local display tests pass

✓ Inbox/chat scoped correctly

✓ Trust remains read-only

✓ Reviews/Claims are operable

✓ Account/Seller lifecycle entry points are backend-orchestrated

✓ Valkey/BullMQ health and failure behavior tested

✓ sensitive information absent from logs/Sentry

✓ current locales accessible and layout-safe

✓ staging/production isolation

✓ database restore tested

✓ critical Playwright E2E and k6 gates green

Role-aware capability/navigation/Home, username invitation/exclusivity, zero-tag/all-OOS publish rejection, last-stock PRIVATE suppression/cache invalidation, Seller badge/notices, gated automatic PUBLIC restoration, one-active-delivery enforcement, four Trust labels, no Product cap and no Adulis Government-ID collection all pass.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 202. Final architecture

Clients express intent. Domain services authorize and decide. PostgreSQL remains canonical truth.

![Shared canonical Platform architecture](graphics/CONSOLE_09.svg)
*Figure 09. Shared canonical Platform architecture. Clients express intent through typed APIs; domains authorize and decide, PostgreSQL persists truth, and workers build projections.*

## 203. Final design principle

The Seller Console should not try to feel like TikTok, Instagram or a generic ecommerce admin clone.

The Buyer side can be highly visual and discovery-oriented. The Seller Console should feel predictable, operational and trustworthy.

A seller opening the Console should immediately know:

```
    What needs me right now?
```

A seller managing catalogue should know:

```
    What am I selling, what is available, and can Buyers see it?
```

A seller creating a Scene Post should know:

```
    Which of my Product Posts are tagged, what will Buyers see, and is the content eligible?
```

A seller fulfilling an Order should know:

```
    Has payment been server-verified, what is the next fulfilment action, and which QR stage is active?
```

A seller watching a Courier should know:

```
    What is the assignment/custody/Delivery state, is there an exception, and has Buyer receipt been verified?
```

A seller checking performance should know:

```
    Did creative discovery turn into meaningful product interest and successful commerce?
```

That is the Seller Console design principle.

Appendix A - Canonical Technology Stack and Console Impact

| Layer | Canonical technology | Seller Console relevance |
| --- | --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript; Drizzle ORM; PostgreSQL | Seller commands/queries and domain rules; Fastify HTTP runtime; Drizzle data access; PostgreSQL truth. |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements | Search assistance, constraint support where required, and query-performance diagnostics. |
| Async / cache | Valkey; BullMQ | Non-canonical cache and async/reconciliation jobs. No other cache datastore name is current. |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client | One typed contract between Console and platform; minimizes handwritten DTO drift. |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js | Rate limits, secure HTTP headers and international phone normalization. |
| Media | Cloudflare R2; Cloudflare CDN; Sharp | Direct media upload/delivery and image derivatives for Product/Scene content. |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; SecureStore; SQLite; Camera; Notifications; Updates; small Zustand store | Seller Companion/courier-related mobile surface. These are not shipped in the Web Console bundle. |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 | Unit/domain, DB integration, Mobile E2E, Console E2E and load/capacity testing. |
| Observability | Sentry; Pino structured logs; pg_stat_statements | Frontend/backend errors, redacted operational logs and DB query visibility. |
| Architecture control | dependency-cruiser | Prevents forbidden package/domain dependencies and private repository coupling. |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS | Build/CI/backend/web delivery; EAS is for Mobile release workflows. |
| Payment | Chapa through internal provider adapter | Gateway payment truth is server-verified and read-only to Seller Console. |

Appendix B - Update Precedence and Superseded Console Assumptions

• Gateway payment using Chapa supersedes the old manual seller-payment-confirmation flow.

• There is no separate pre-payment hold model in the Seller Console architecture.

• Product Posts and Scene Posts supersede generic seller social posting terminology.

• Similar Finds and Complete the Scene remain deferred/feature-flagged off.

• Current MVP Scene Post tags are same-Seller only.

• Courier delivery uses separate pickup and Buyer-delivery QR purposes; location evidence is bounded to Pickup and Delivery checkpoints, with no live route/map. Final QR is Courier-displays and Buyer/delegate-scans.

• Physical Store location must be structured Google Maps/Apple Maps data, not free text.

• Operational display uses Market-local time; APIs exchange UTC timestamps.

• Seller plan/subscription/advertising packaging remains open; the launch-disabled zero Adulis Buyer Checkout surcharge is current versioned transaction policy.

• Valkey is canonical; older cache naming is superseded.

The Console stays a predictable business-management surface with responsibility-specific navigation/Home, published-but-Private Scene management and gated restoration, approved Pool/Network fulfilment, connected Handoff and authoritative versioned Checkout totals. Public marketing, commerce truth and privileged Operator identity remain outside browser ownership.

## 204. Glossary

| Term | Definition |
| --- | --- |
| OWNER | Full Seller business role; alone may transfer ownership/close Seller with Console Step-Up and validation. |
| ADMIN | Delegated ordinary business administrator without OWNER-specific authority. |
| SALES_SUPPORT | Buyer communication, read/support Order work and permitted Claim handling; no physical fulfilment. |
| INVENTORY | Catalogue/stock and physical fulfilment role; may assign already eligible Couriers to Orders. |
| ANALYST | Privacy-bounded read-only aggregate analytics role; read-only is not unrestricted data access. |
| CAMPAIGN_MANAGER | Scene/media, chatbot configuration and discovery analytics role with Product read/tag-source access. |
| Allowed Action | Backend-returned currently legal resource/surface action; UI presentation does not authorize it. |
| Courier Pool | Standing Seller-approved Courier relationships, distinct from an Order-level assignment. |
| Cross-Seller Courier Network | Approved Courier relationships/opportunities across Sellers with one persistent Courier identity. |
| Checkpoint Location | Bounded foreground/on-demand evidence attempt at Pickup and Delivery; never live route tracking. |
| Handoff | Connected custody/receipt verification; giver displays QR and recipient scans, with OTP/Manual fallback. |
| Mark Ready | Authorized idempotent preparation transition for a paid, prepared Seller Order. |
| Private | Seller-only Scene visibility; prominent management badge/reason and no Buyer/public payload. |
| Product Post | Canonical sellable Product representation; Catalogue/Inventory own price, Variants and stock. |
| Public | Scene visibility exposed only after tags, available Product and all other public gates pass. |
| Scene Post | Image-led same-Seller tagged merchandising content, separate from canonical commerce truth. |
| Seller Context | Explicit seller_id and relevant Market scope for every Seller request/cache. |
| Seller Team Membership | Existing Account relationship with one Seller; MVP allows at most one non-terminal team membership. |
| Step-Up Authentication | Additional server-verified authentication for sensitive actions; role/domain checks still apply. |
| Trust Ladder | Evidence-derived NEW, REBUILDING, ESTABLISHED and TRUSTED; no Product-count cap or paid promotion. |
| Visibility | PUBLIC/PRIVATE dimension independent from Scene publication lifecycle and moderation. |
| Publication State | Scene DRAFT, PUBLISHED, ARCHIVED/REMOVED lifecycle; stock-driven PRIVATE remains PUBLISHED. |
| Shoppable Post | Superseded term for Scene Post. |

## 205. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-02 — Scene publication and all-unavailable lifecycle | The 13 October pack already requires a legitimate same-Seller Product relationship and at least one currently available tagged Product at public publication. | Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product. Zero-tag or all-unavailable initial publication is rejected. A published Scene stays public while at least one tagged Product remains available. If the last available tagged Product becomes unavailable, the Scene remains PUBLISHED but effective Buyer visibility becomes PRIVATE across FYP, Following, Nearby, Search, Buyer Seller profile, public Storefront and Buyer-facing Collection/direct resolution. Seller/Operator views retain it with Private state. Restoration of at least one eligible Product automatically re-evaluates and may restore PUBLIC without republishing. | Founder rule + PR-004 reconciliation |
| R-12 — Seller roles and team presentation | ADU-AUTH-02 v3.2 already defines Owner-derived ownership, Admin plus four specialist roles and multi-role union. | Canonical Seller roles remain Owner (derived, never assignable), Admin, Analyst, Campaign Manager, Inventory and Sales Support. A member may hold multiple non-Owner roles; effective access is the union subject to surface/resource/domain checks. Active membership cannot be left with zero role. No Seller role confirms payment, sets Trust, decides Claims, creates Handoff evidence or edits Reviews. Ownership transfer and Seller closure remain Owner-only. Prototype role matrices and member-edit UX now reflect this design. | PR-007, 27 Oct 2026 |
| R-13 — Seller engagement analytics grouping | The 13 October Analytics design provides event/attribution architecture but not the final Seller-facing metric grouping. | Scene Performance prioritizes commerce outcomes (Explore opens, Product-detail visits, Seller inquiries, Orders initiated, verified completed Orders) before engagement counts (views, hotspot taps, Likes, Saves, Shares). Product Performance includes views, Saves, Product rating, inquiries and Order outcomes. Seller Reputation keeps Seller rating, Product ratings, verified completed Orders, service quality and Trust separate. Do not blend popularity and Trust into one score. | PR-007, 27 Oct 2026 |
| R-14 — Courier compensation source and immutable Order snapshot | The 13 October Fulfilment/Order/Finance designs already treat delivery charge as Seller-defined, shown before payment and snapshotted on the Order. | There is no per-Courier-relationship compensation schedule in the current MVP. One Seller-level Courier Delivery term applies to future Checkout quotes. Once the Buyer accepts/pays, the Order’s Courier Delivery/compensation amount is immutable history. Delivery Offers, Seller selection surfaces and Courier Mode display the Order snapshot. Changing Seller terms affects future quotes only. | PR-008 correction, 27 Oct 2026 |
| R-15 — Courier offer eligibility and sequence | The 13 October designs already require Courier acceptance and one active accepted delivery. | A direct Delivery Offer may be sent only to a Courier who is in the Seller’s Approved pool relationship, Adulis-verified, AVAILABLE and has no active accepted delivery. BUSY Couriers may remain visible for context but are disabled with reason. UNAVAILABLE, restricted, pending, removed or non-approved Couriers are ineligible. Seller request/offer never equals assignment; Courier acceptance atomically rechecks eligibility/capacity. Mark Ready precedes offer. Offer timing must respect the one-active-delivery rule. | PR-008 correction, 27 Oct 2026 |
| R-17 — Theme and appearance architecture | The 13 October pack contains shared design tokens; final brand palette is not contract-closed. | Production clients use semantic theme roles with Light, Dark and System plumbing so palette changes are centralized. Theme Lab (Baseline plus ten candidates) is prototype evaluation tooling only and must not ship as production theme choices. No candidate palette is canonical until founder approval. Operational status colors remain semantic and independent from brand palette. | Theme Lab + WO-001, 27 Oct / 8 Nov 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.

### Open / deferred items

• Final production brand palette remains open; semantic theme architecture is required, Theme Lab candidates are not canonical.
