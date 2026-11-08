# Adulis Post-October-13 Reconciliation — 8 November 2026

This is the authoritative change register applied to the complete 13 October design pack. Every updated design also contains its own full reconciliation section.

## Authority order

1. Explicit founder decisions and accepted WO-001 / WO-001A decisions made after 13 October.
2. This reconciliation for changed areas.
3. The complete 13 October system-design body for unchanged areas.
4. Current prototype UX/presentation where it does not conflict with 1–3.
5. Older repository/prototype wording last.

## Changes applied

### R-01 — Buyer-facing Product / Scene terminology

**13 October baseline:** The 13 October designs use Product Post and Scene Post as canonical domain names.

**Current rule:** Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly.

**Evidence:** PR-001 / PR-005, 26-27 Oct 2026

**Updated designs:** MOB, SCN, CATINV, SRC, STOREFRONT, CHAT, CHATBOT, ANL, MOD, WEB, KB

### R-02 — Scene publication and all-unavailable lifecycle

**13 October baseline:** The 13 October pack already requires a legitimate same-Seller Product relationship and at least one currently available tagged Product at public publication.

**Current rule:** Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product. Zero-tag or all-unavailable initial publication is rejected. A published Scene stays public while at least one tagged Product remains available. If the last available tagged Product becomes unavailable, the Scene remains PUBLISHED but effective Buyer visibility becomes PRIVATE across FYP, Following, Nearby, Search, Buyer Seller profile, public Storefront and Buyer-facing Collection/direct resolution. Seller/Operator views retain it with Private state. Restoration of at least one eligible Product automatically re-evaluates and may restore PUBLIC without republishing.

**Evidence:** Founder rule + PR-004 reconciliation

**Updated designs:** MOB, SCN, CATINV, SRC, STOREFRONT, REC, NOTIF, CONSOLE, KB

### R-03 — Buyer Home and social-commerce FYP presentation

**13 October baseline:** The 13 October pack already defines For You / Following / Nearby / Discounts / Locally Made and a Scene-only FYP.

**Current rule:** For You is the default Buyer Home channel and contains Scenes only; Products never become top-level FYP units. Home presents the five channels in a compact discovery row with Search and Notifications, with Seller Stories below. Scene cards are structured social-commerce cards, not full-screen video. Following is Seller-follow based; Nearby remains commerce-relevant without continuous/live GPS; Discounts and Locally Made are Product-led channels under their own eligibility rules.

**Evidence:** PR-003, 26 Oct 2026

**Updated designs:** MOB, REC, SRC, ANL, KB

### R-04 — Seller Stories prototype direction

**13 October baseline:** Stories are not a production domain in the 13 October system-design pack.

**Current rule:** The approved prototype includes a lightweight horizontal Seller Stories row. A Story carries Seller identity, short-lived media/text and a link to a Product or Scene; discount presentation is allowed where the linked Product has an active discount. The viewer has no replies, reactions or comments. This is an approved UX/product direction only: production storage, API, event, media-retention, notification and analytics contracts remain OPEN and must be designed before Stories are implemented as a production domain.

**Evidence:** PR-003, 26 Oct 2026

**Updated designs:** MOB, KB

### R-05 — Final Scene engagement model

**13 October baseline:** The 13 October designs define Scene commerce/discovery but do not fully freeze the later action bar and presentation.

**Current rule:** Scene actions are Like, Save, Share, Reviews, Follow, More and Explore the Scene. Like belongs to the Scene only and no public Like count is shown. Save saves the Scene only. Follow is Seller-level. More may include Not Interested where applicable, Hide this Scene and Report. Public comments and reposts are not part of the current MVP. Explore the Scene is the primary commerce-exploration action.

**Evidence:** PR-004, 26-27 Oct 2026

**Updated designs:** MOB, SCN, REC, ANL, MOD, TRUST, KB

### R-06 — Explore the Scene and hotspot placement

**13 October baseline:** The 13 October designs support tagged Products/hotspots but do not fully freeze where hotspot UI appears.

**Current rule:** Normal For You and Following Scene media carries no Product hotspots. Tapping Scene media or Explore the Scene opens the dedicated Explore surface. Explore owns numbered hotspots and the tagged-Product list; hotspot/list selection remains synchronized. Unavailable tagged Products remain visible with current price plus “Currently unavailable” and no purchase action. View Product only navigates to Product detail; it never orders automatically.

**Evidence:** PR-004 follow-up, 27 Oct 2026

**Updated designs:** MOB, SCN, CATINV, SRC, KB

### R-07 — Final Product engagement model

**13 October baseline:** Product Post remains the canonical structured commerce object.

**Current rule:** Buyer-facing Product actions are Save, Share, Reviews, Ask Seller, Order and More/Report. Product has no Like, public comments or repost. Save is Product-only. Ask Seller opens the ongoing Buyer-Seller conversation with Product context. Order enters Cart/Checkout; opening a Product or using Buy Again never creates an Order or payment automatically.

**Evidence:** PR-005, 27 Oct 2026

**Updated designs:** MOB, CATINV, CHAT, MOD, ANL, KB

### R-08 — Review presentation and write eligibility

**13 October baseline:** The 13 October Reviews design separates Product Quality and Seller Service and defines evidence-based eligibility.

**Current rule:** Anyone may read Reviews. Product Reviews expose Product Review and Seller Review. Scene Reviews expose one Product tab per distinct tagged Product plus Seller Review. Write/Edit controls appear only when authoritative Review eligibility exists; ineligible viewers see no composer. Product Quality and Seller Service remain separate. One active Product Review and one active Seller Review are maintained per qualifying entitlement; edit updates instead of duplicating. Sellers cannot edit/delete legitimate Buyer Reviews; Report Review is a moderation utility. The prototype’s completed-order path does not silently remove the 13 October design’s VERIFIED_ORDER_FAILURE Seller-service basis; that failure basis remains valid unless a later founder decision explicitly removes it.

**Evidence:** PR-005, 27 Oct 2026

**Updated designs:** REV, MOB, ORDER, HND, CLAIM, TRUST, STOREFRONT, ANL, KB

### R-09 — Seller profile and Storefront information architecture

**13 October baseline:** The 13 October designs define Seller profile/Storefront content but not the final shared tab order.

**Current rule:** Buyer Seller profile and standalone public Storefront share Scenes / Products / Reviews / About and open on Scenes. Scenes show the Seller’s Buyer-public eligible Scenes. Products show the catalogue with available first. Reviews is Seller Service; Product Quality remains on Product. About includes description, Trust facts, category, neighborhood/operating area, fulfilment, member since and social accounts. Collection point appears only where Buyer Collection is offered. Header actions are Follow and Message; the public Storefront hands these actions into the app. Trust is information, not a button.

**Evidence:** PR-002, 26 Oct 2026

**Updated designs:** STOREFRONT, MOB, REV, TRUST, CATINV, CHAT, KB

### R-10 — Purchased Products and Buy Again

**13 October baseline:** The 13 October pack has Buyer Orders/account history but not the finalized Purchased Products UX.

**Current rule:** Purchased Products derives from completed Buyer Orders and shows one entry per Product using the latest purchase: Seller, purchase date, purchased variant and current Product facts where resolvable. Buy Again opens the current Product with the last variant preselected only if still offered; Buyer must still choose quantity/fulfilment and explicitly order/pay. Unavailable or delisted Products remain in purchase history without an invalid Buy Again action. Review actions reuse canonical Review eligibility.

**Evidence:** PR-006, 27 Oct 2026

**Updated designs:** MOB, ORDER, CATINV, REV, PRV, KB

### R-11 — Buyer account controls and deletion parity

**13 October baseline:** The 13 October Privacy/Auth designs govern account lifecycle and deletion.

**Current rule:** Authenticated Buyer account controls include Edit Profile, saved discovery area, Appearance, notification preferences, Privacy & Security, Help & Support, Delete Account and Sign Out. Delete Account uses verification, consequence preview, authoritative blockers and typed confirmation; Mobile and Website must share policy wording/data rather than independently reauthoring deletion consequences. Sign Out changes session state only.

**Evidence:** PR-006, 27 Oct 2026

**Updated designs:** MOB, PRV, NOTIF, WEB, AUTH, KB

### R-12 — Seller roles and team presentation

**13 October baseline:** ADU-AUTH-02 v3.2 already defines Owner-derived ownership, Admin plus four specialist roles and multi-role union.

**Current rule:** Canonical Seller roles remain Owner (derived, never assignable), Admin, Analyst, Campaign Manager, Inventory and Sales Support. A member may hold multiple non-Owner roles; effective access is the union subject to surface/resource/domain checks. Active membership cannot be left with zero role. No Seller role confirms payment, sets Trust, decides Claims, creates Handoff evidence or edits Reviews. Ownership transfer and Seller closure remain Owner-only. Prototype role matrices and member-edit UX now reflect this design.

**Evidence:** PR-007, 27 Oct 2026

**Updated designs:** AUTH, CONSOLE, MOB, KB

### R-13 — Seller engagement analytics grouping

**13 October baseline:** The 13 October Analytics design provides event/attribution architecture but not the final Seller-facing metric grouping.

**Current rule:** Scene Performance prioritizes commerce outcomes (Explore opens, Product-detail visits, Seller inquiries, Orders initiated, verified completed Orders) before engagement counts (views, hotspot taps, Likes, Saves, Shares). Product Performance includes views, Saves, Product rating, inquiries and Order outcomes. Seller Reputation keeps Seller rating, Product ratings, verified completed Orders, service quality and Trust separate. Do not blend popularity and Trust into one score.

**Evidence:** PR-007, 27 Oct 2026

**Updated designs:** ANL, CONSOLE, TRUST, REV, SCN, KB

### R-14 — Courier compensation source and immutable Order snapshot

**13 October baseline:** The 13 October Fulfilment/Order/Finance designs already treat delivery charge as Seller-defined, shown before payment and snapshotted on the Order.

**Current rule:** There is no per-Courier-relationship compensation schedule in the current MVP. One Seller-level Courier Delivery term applies to future Checkout quotes. Once the Buyer accepts/pays, the Order’s Courier Delivery/compensation amount is immutable history. Delivery Offers, Seller selection surfaces and Courier Mode display the Order snapshot. Changing Seller terms affects future quotes only.

**Evidence:** PR-008 correction, 27 Oct 2026

**Updated designs:** FUL, ORDER, FIN, CONSOLE, MOB, KB

### R-15 — Courier offer eligibility and sequence

**13 October baseline:** The 13 October designs already require Courier acceptance and one active accepted delivery.

**Current rule:** A direct Delivery Offer may be sent only to a Courier who is in the Seller’s Approved pool relationship, Adulis-verified, AVAILABLE and has no active accepted delivery. BUSY Couriers may remain visible for context but are disabled with reason. UNAVAILABLE, restricted, pending, removed or non-approved Couriers are ineligible. Seller request/offer never equals assignment; Courier acceptance atomically rechecks eligibility/capacity. Mark Ready precedes offer. Offer timing must respect the one-active-delivery rule.

**Evidence:** PR-008 correction, 27 Oct 2026

**Updated designs:** FUL, AUTH, CONSOLE, MOB, ORDER, NOTIF, KB

### R-16 — Company Website public-copy refinements

**13 October baseline:** The 13 October Website/Finance designs already hold the corrected launch financial model.

**Current rule:** Public Website copy must not promise a 0.5% Adulis transaction fee. It uses Buyer-facing Product/Scene language and shared authoritative report/deletion policy. Removing decorative warning/report icons must not remove role=status/role=alert semantics. Seller public location copy must not imply a mandatory physical storefront when only operating area/collection point is available.

**Evidence:** PR-001 + Oct 15 corrections

**Updated designs:** WEB, FIN, PRV, MOD, STOREFRONT, KB

### R-17 — Theme and appearance architecture

**13 October baseline:** The 13 October pack contains shared design tokens; final brand palette is not contract-closed.

**Current rule:** Production clients use semantic theme roles with Light, Dark and System plumbing so palette changes are centralized. Theme Lab (Baseline plus ten candidates) is prototype evaluation tooling only and must not ship as production theme choices. No candidate palette is canonical until founder approval. Operational status colors remain semantic and independent from brand palette.

**Evidence:** Theme Lab + WO-001, 27 Oct / 8 Nov 2026

**Updated designs:** MOB, CONSOLE, STOREFRONT, WEB, DEPLOY, KB

### R-18 — Mobile app identifiers and production foundation

**13 October baseline:** ADU-MOB-02 v4.2 already specifies one React Native/Expo app with Buyer, Seller Companion and Courier modes.

**Current rule:** Canonical application identifiers are Android applicationId com.adulis.app and iOS bundleIdentifier com.adulis.app. One Expo/React Native app exposes Buyer, Seller Companion and Courier modes under one ordinary MOBILE session. Mode switching changes active context, not identity/session. Available modes are backend-authoritative; active mode is UI state. Operator is never a Mobile mode.

**Evidence:** WO-001 / WO-001A, 8 Nov 2026

**Updated designs:** MOB, AUTH, ARCH, DEPLOY, KB

### R-19 — Mobile-safe localization and Amharic release gate

**13 October baseline:** The 13 October designs prohibit Mobile software-subscription purchase/billing surfaces and keep commercial subscription management in Console.

**Current rule:** Mobile runtime imports only a physically isolated mobile-safe/shared localization catalogue; Console-only subscription, tier, billing and software-purchase copy must not enter the Mobile import graph even if hidden at runtime. English/Amharic key parity is enforced. Current Amharic strings are not approved human translations; Amharic remains disabled for users until a human translation/review pass is complete.

**Evidence:** WO-001A, 8 Nov 2026

**Updated designs:** MOB, MKT, DEPLOY, KB

### R-20 — Courier MOBILE API/auth contract correction

**13 October baseline:** ADU-AUTH-02 v3.2 and ADU-MOB-02 v4.2 already define Courier as a third ordinary Mobile mode using the ordinary MOBILE session.

**Current rule:** Executable API/auth contracts must be corrected to match the design: Courier uses audience=MOBILE with backend-verified Courier relationship/capability, exact resource scope and permission surface. Do not move Courier back to Console/cookie auth to match stale implementation contracts. Until the corrected contract is published, production Mobile must not fabricate Courier API calls.

**Evidence:** WO-001 discovery + October 13 AUTH/MOB authority

**Updated designs:** AUTH, MOB, ARCH, FUL, DEPLOY, KB

### R-21 — Mode eligibility bootstrap and generated API-client types

**13 October baseline:** The 13 October design assumes server-authoritative relationship/permission evaluation.

**Current rule:** Bootstrap/session contracts must expose sufficient authoritative relationship/capability information to derive Buyer/Seller Companion/Courier mode availability without trusting a client role. The shared generated API-client seam must export generated OpenAPI path/types. Mobile must not hand-write duplicate DTOs to compensate for missing schemas or exports.

**Evidence:** WO-001 / WO-001A discovery, 8 Nov 2026

**Updated designs:** AUTH, MOB, ARCH, DEPLOY, KB

### R-22 — Canonical launch Adulis surcharge remains zero

**13 October baseline:** The October 13 Finance/Order/Market/KB designs set launch Adulis surcharge to 0 bps / amount zero.

**Current rule:** Launch Adulis surcharge is disabled: 0 bps and zero amount. Provider processing fee is a separate provider-policy route and may be Buyer-paid only when that route is explicitly permitted and confirmed. The prototype canonical-rules line claiming a current 0.5% Adulis Buyer surcharge is stale and must not be implemented.

**Evidence:** October 13 pack reaffirmed against stale prototype rule

**Updated designs:** FIN, ORDER, MKT, MOB, WEB, KB

### R-23 — Canonical Account architecture is resolved

**13 October baseline:** The October 13 pack already defines one ordinary Account with Buyer, Seller and Courier relationships plus a distinct Operator identity domain.

**Current rule:** The production Account model is not unresolved for these surfaces: one ordinary Account can act as Buyer, own Sellers, hold authorized Seller team membership/roles, and hold one Courier profile with many Seller relationships. The Mobile app exposes Buyer, authorized Seller Companion and Courier contexts under the same ordinary Account session. Operator Console remains a separate privileged identity/session. Prototype role-switcher scaffolding is not itself authority, but the October 13 production model is.

**Evidence:** October 13 AUTH/MOB/KB reaffirmed against stale prototype rule

**Updated designs:** AUTH, MOB, ARCH, KB
