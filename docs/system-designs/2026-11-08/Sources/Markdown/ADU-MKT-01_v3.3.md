# Adulis Market Configuration & Localization
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-MKT-01_Adulis_Market_Configuration_Localization_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Mission

A Market answers which commerce policy applies; a locale answers how the experience renders. Market Configuration supplies typed, versioned, effective-dated, auditable policy without hard-coded country branches.

The architecture is global/multi-Market-ready from launch; commerce activates in phases, initially Ethiopia. English is the complete source/default/fallback; founder-reviewed Amharic supports Ethiopia. PostgreSQL/Drizzle remains canonical, Valkey/BullMQ non-authoritative, and providers own verified payment facts.

## 2. Authoritative update baseline

The supplied current update specification supersedes affected September assumptions throughout this complete design. Preserve Market/country/locale/service-area separation, typed effective policy, one Seller operating Market, social-commerce admission, provider-authoritative payments, current merchandise surcharge, UTC/IANA time, localization provenance and central retention. Current corrections add phased Ethiopia-first rollout, canonical Scene naming/visibility, launch Scene Search, neutral future admission seams and separate Operator governance.

## 3. Core doctrine

```
MARKET != COUNTRY
MARKET != LOCALE
LOCALE != CURRENCY
CONFIGURATION != SECRET
CONFIGURATION != OPERATIONAL HEALTH
FEATURE FLAG != AUTHORIZATION
CURRENT POLICY != HISTORICAL TRANSACTION POLICY
TRANSLATION != ORIGINAL USER CONTENT
LOCALIZATION != BUSINESS TRUTH
```

## 4. What a Market means

A Market is Adulis's operational commerce-policy boundary. A Market may map closely to a country in the current release, but the schema must not assume country and Market are permanently identical.

Market context can determine currency, timezone, seller admission policy, payment-provider availability, checkout surcharge policy, fulfilment capabilities, legal/retention policy, SMS routing, supported locales, Search/FYP configuration references, feature availability and client-version policy.

## 5. Global-Ready Architecture and Phased Commerce Rollout

Architecture is global-ready/multi-Market-ready from launch; commerce rollout is phased. Technical app/web rendering, language support, country code or SMS reach never activates commerce. Runtime activation uses Market activation_state and complete current capability/policy packs, not strategy phase numbers.

Current strategy: Phase 1 Ethiopia; Phase 2 selected African Markets; Phase 3 selected South American and Middle Eastern Markets plus broader Africa; Phase 4 broader South America/Middle East plus selected Asia/Oceania; Phase 5 global expansion. This roadmap is planning context, never hard-coded authorization logic.

![Global-ready architecture with phased commerce activation](graphics/MKT_01.svg)
*Figure 01. Global-ready architecture with phased commerce activation. The five phases describe strategy only; runtime authorization uses approved Market activation and capability packs, initially Ethiopia with Addis service coverage.*

## 6. Ethiopia Initial Market Seed and Addis Service Coverage

Ethiopia is the initial active commerce Market under current strategy. Seed ETB, Africa/Addis_Ababa IANA timezone, Afromessage primary/SMS Ethiopia backup, English and founder-reviewed Amharic, approved PSP capability and current policy packs. Addis Ababa may be the initial service coverage region; it is not a separate Market merely because delivery starts there.

Shared code remains configurable for future Markets. An inactive country/Market cannot transact solely through locale/IP/app reach. Future activation is deliberate and requires approved legal, eligibility, payment, currency, fulfilment/service coverage, SMS, localization, support, category/privacy/retention and client/operational readiness.

## 7. Market versus country

Use ISO country/region metadata as descriptive and routing input, not as the Market primary key. A future country could contain several commerce Markets, or one policy Market could cover several territories if legal and product policy eventually permits it.

## 8. Market versus locale

A user in any Market may use a supported language independent of the Market itself. English and Amharic do not create separate commerce Markets. Locale choice must never silently change currency, seller eligibility, payment provider, legal policy or Order ownership.

## 9. Market versus service area

Market is the policy boundary. Service area is operational coverage inside that Market. Courier/collection/store-visit availability can be narrower than the Market without redefining the Market.

Do not encode city-level delivery coverage by creating fake Markets unless there is an actual policy reason to do so.

Example: Ethiopia Market -> Addis Ababa initial service area. Nearby Buyer Home tab is a discovery filter, never a new Market identity.

## 10. Domain ownership

| Concern | Canonical owner / Market role |
| --- | --- |
| Market identity, activation, locale pack | Market Configuration |
| Seller eligibility rules | Onboarding/Eligibility consumes versioned Market policy |
| Payment truth and settlement | Payments/Finance; Market selects allowed provider/config |
| Buyer surcharge calculation | Order/Checkout/Billing consumes active Market commercial policy |
| Inventory/Product truth | Catalogue/Inventory; Market scopes product visibility |
| FYP ranking | Recommendation; Market references active algorithm/policy version |
| Search ranking | Search; Market references active algorithm/policy version |
| Fulfilment execution | Fulfilment; Market exposes allowed capabilities and service scope |
| Handoff proof | Handoff Verification; Market may expose policy toggles only |
| Trust/Claims/Moderation | Their domains; Market supplies policy version where relevant |

| Additional concern | Owner / Market contract |
| --- | --- |
| Scene PUBLIC/PRIVATE | Content Lifecycle owns state and current hard gates; Market supplies current eligibility only. |
| Search Product/Seller/Scene | Search owns retrieval/rank; Market resolves active context and policy version. |
| Operator governance | Separate privileged Operator domain supplies approved workflow results and typed actor identity. |

## 11. Do not centralize every domain rule

Market Configuration is not a miscellaneous-settings database. Domain-owned policy should remain with the domain when it carries domain invariants. Market Configuration provides a typed resolver/registry for the effective Market-specific version or bounded parameters that other domains consume.

## 12. Recommended architecture

One decision_at resolves current Market activation and exactly one effective version per required policy family. Domain services consume the version and persist exact historical snapshots; current locale controls rendering independently.

![Current effective policy with orthogonal locale rendering](graphics/MKT_02.svg)
*Figure 02. Current effective policy with orthogonal locale rendering. One decision time resolves non-overlapping canonical policy; domains retain exact historical snapshots while safe Bootstrap never substitutes for authorization.*

## 13. Stable Market record

Keep a stable Market identity row containing durable identity/metadata such as id, code, display name, country/region metadata, activation_state, display timezone and audit timestamps. Frequently changing policy must live in versioned child configuration, not by mutating one giant Market row.

## 14. Activation state is the only Market activation authority

Use explicit activation states such as DRAFT, ACTIVE and SUSPENDED (or canonical equivalents). Do not reintroduce an overlapping is_live boolean. Every runtime reader must use one activation authority.

## 15. ACTIVE semantics

ACTIVE means new eligible clients/Sellers/commerce may enter the Market subject to domain-specific policy. ACTIVE does not guarantee every optional capability is enabled; those are resolved separately.

Only ACTIVE initial Ethiopia commerce is enabled under current launch strategy; future registry records remain DRAFT/SUSPENDED until approved complete packs allow activation. Code/global-language availability alone is not authorization.

## 16. SUSPENDED semantics

SUSPENDED prevents new Market entry or new capability activation according to policy, while preserving safe access to existing Orders, Claims, refunds, account recovery and other obligations that cannot be abandoned. SUSPENDED is not a destructive global shutdown.

## 17. Market assignment is server-controlled

A client may propose signals such as country selection, phone country code or device locale, but the backend resolves authoritative Market context. Geo-IP can suggest a Market; it cannot silently reassign an existing Account or Seller.

## 18. Explicit Market selection

Where several Markets are legitimately available, the user may choose among server-provided eligible options. The server validates the choice against supported Market state, account/seller constraints and current capabilities before persisting or using it.

## 19. One Seller operating Market in the current release

Current Seller architecture supports one operating Market/country per Seller. The Seller does not manage simultaneous multi-country operations in the MVP.

A future multi-country Seller capability must add explicit Seller-Market relationships, per-Market catalogue/payment/fulfilment configuration and UX rather than overloading one Market field today.

## 20. Seller Market migration is deferred

Do not offer a self-service Seller Market switch in the current release. A Market move changes currency, payment providers, legal policy, eligibility, fulfilment and product visibility. Future migration requires a controlled workflow and historical snapshots.

## 21. Product Post / Scene Post Market and Visibility Scope

Product Posts and Scene Posts inherit the current Seller operating Market. Every Scene tag is same-Seller/same-Market in MVP. Public Scene URLs cannot bypass Market eligibility; Search/FYP/Storefront/Collections detail resolve current authoritative context.

Content owns Scene visibility. Last available tagged Product loss makes PUBLISHED Scene PRIVATE; restock may automatically restore PUBLIC only if all caption/media/Product/Seller/Market/Moderation gates pass. Market suspension independently blocks public restoration and never rewrites historical paid Orders.

## 22. Market configuration families

• Activation and service-area policy.

• Seller eligibility/social verification policy.

• Payment-provider and checkout commercial policy.

• Currency, money and rounding policy.

• Timezone, fulfilment/store-visit time windows and calendar presentation.

• Locale packs, legal localization and translation governance.

• SMS routing and communication-provider selection.

• Search/FYP configuration references and capability flags.

• Client-version policy and public bootstrap allowlist.

• Retention/prohibited-category/legal policy references.

• Versioned category/prohibited-product references, separate Checkout surcharge and fulfilment capability, service coverage and domain-owned Scene public-eligibility inputs.

• Search and Recommendation policy references remain bounded; no giant ranking-weight/settings JSON editor.

## 23. Canonical configuration pattern

Every mutable Market policy family should have an immutable/versioned record with Market id, effective range, semantic payload/typed columns, provenance, approval/audit metadata and status. Transactions store the exact policy/version needed to reconstruct historical decisions.

## 24. Effective ranges

Resolve policy by Market + decision timestamp within a non-overlapping effective range. Do not select "latest created row". A future-dated policy can exist without becoming active early.

## 25. Database overlap prevention

Use PostgreSQL constraints, including btree_gist range exclusion where appropriate, so two active versions cannot overlap for the same Market/policy family. Application checks are useful but not sufficient for concurrency safety.

## 26. Request-level decision time

A single command/request should resolve one decision_at instant and use it consistently for all relevant Market policies. This avoids one request straddling a scheduled policy boundary and mixing old/new versions.

## 27. Historical snapshot rule

Once a durable Order/payment attempt/eligibility decision/acceptance record is created, later Market configuration must not reinterpret its historical economic or legal facts. Store version references and exact monetary/time snapshots where required.

## 28. PostgreSQL remains canonical

PostgreSQL is the authoritative Market/configuration store. Process-local cache and Valkey can accelerate reads/invalidation but cannot establish Market eligibility, payment policy, locale support or legal state on their own.

## 29. Eligibility policy

Market policy can select which Seller admission paths are available and what evidence the Onboarding domain must evaluate. The current launch policy is the exclusive social-commerce admission gate: established social-business presence is required, and creators also require legitimate selling/business status.

A creator with legitimate selling/business status may qualify as Seller under the same policy. This does not approve a standalone Creator actor, session, catalogue or cross-Seller tagging authorization. Admission consumes verified ordinary Account/phone and social/business control evidence without Government-ID collection.

## 30. Audience Path is current

AUDIENCE_PATH is the current admission route. It consumes verified TikTok/Instagram social-account control and normalized social-business evidence from Seller Onboarding. Market Configuration defines policy; Onboarding owns evidence/evaluation history.

## 31. Neutral Future Admission Methods

Current admission uses versioned social-commerce policy. Remove the dormant government-document-specific admission route and accepted-document/legal-ID/KYC-vendor assumptions from current architecture. A neutral admission_method or ALTERNATIVE_ADMISSION_PATH seam may support a later explicitly approved method without pre-committing to Government ID.

No neutral future method is active merely because the schema is extensible. New formal identity verification requires a separate explicit product/privacy/jurisdictional/provider design and current approved policy version.

## 32. Government-document identity verification removed

Current Seller verification does not collect or use government-issued identity documents. Market Configuration must not contain accepted-document-type lists, document-required flags or active KYC-vendor assumptions for current Seller admission.

Any future formal identity verification is a new privacy/product/regulatory decision and requires its own policy version, provider/data-flow design, legal review and tests.

## 33. Social verification capability configuration

A Market may declare supported social control methods such as TikTok account connection, Instagram account connection and the controlled official-Adulis-page DM fallback. Provider client secrets never live in Market configuration.

The DM fallback uses a dedicated social-control one-time code sent to the already-verified Adulis phone and reviewed through authorized Operator workflow. It is not an ordinary login mechanism.

## 34. Eligibility configuration fields

Eligibility fields describe current social-commerce admission and neutral explicit future versions, with no current document-required flags or KYC-vendor configuration.

| Field | Canonical meaning |
| --- | --- |
| admission_method / enabled_paths | Current AUDIENCE_PATH/social-commerce only; neutral approved methods may be added by later version. |
| permitted_seller_profiles | Legitimate Seller/business profiles, including selling creators where policy permits. |
| social_platforms / social_control_method | Approved TikTok/Instagram/provider-control methods; no provider secrets. |
| audience_business_rule_version | Versioned normalized business/audience evidence; no universal follower constant. |
| creator_selling_status_required | Creator admission as Seller requires legitimate selling/business status. |
| reverification_policy / effective_range | Versioned evidence freshness and activation window. |

## 35. No hard-coded follower threshold

If follower/audience counts are used by a future/current Market policy, their threshold/basis remains versioned configuration rather than hard-coded application logic. A null threshold must mean no threshold concept applies, not numeric zero.

## 36. Legal configuration

Market legal policy references approved Terms, Privacy, Seller Terms, refunds/disputes, prohibited-products and other jurisdiction-specific versions. Store immutable version references and acceptance requirements; do not store secrets in legal configuration.

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 37. Legal content localization

Every legal version offered for acceptance must have an approved representation for each locale in which acceptance is presented. English is the source/primary legal rendering unless a jurisdiction requires otherwise; translated legal text must be approved, version-bound and auditable.

## 38. Retention policy

Retention values remain jurisdiction/Market policy inputs consumed by Privacy/Data Lifecycle. Avoid casual hard-coded purge periods inside unrelated domains. Changes to retention policy are high-risk configuration changes and do not retroactively erase active legal/Claim holds.

Ordinary Account creation requires the selected 18+ declaration and accepted policy version, recorded with proportionate retention. It applies once to the same Account across Buyer/Seller/Courier entry paths; a declared underage applicant cannot bypass it through another mode. Phone OTP proves phone control, not age, unique-human or legal identity. No Government-ID/selfie verification or parental-consent Account workflow is added. Anonymous younger visitors, waitlist contacts and guest recipients can still exist; known-underage handling and exact legal retention remain pending. Denied signup does not create a permanent child profile.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 39. Prohibited category policy

Market-specific prohibited/restricted category policy is versioned. Catalogue/Moderation enforce the policy; Market Configuration only resolves the applicable rule set/version. Existing published items may require reconciliation when rules change.

Initial Ethiopia enabled categories are Fashion/Clothing, Cosmetics and Electronics, represented through Market/Catalogue versioned configuration rather than global hard-coded categories. Future Markets may activate approved different sets.

## 40. Payment provider configuration

The current commerce model uses payment gateways/aggregators. Market Configuration resolves which PaymentProviderAdapter(s) are enabled, provider priority/capabilities, currencies and safe public/provider references. Payment success remains owned by Payments/Finance from server-verified provider facts.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 41. Chapa integration

Chapa is the named initial provider where configured for Ethiopia. Market Configuration may select Chapa as an enabled provider but must not embed Chapa secret keys or implement provider-specific payment business logic.

International Markets may use different aggregators through the same provider abstraction. Provider enablement is a Market policy decision; provider credentials are deployment secrets.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 42. Payment provider secrets

API keys, webhook secrets, private certificates and settlement credentials belong to deployment/secret management. Market configuration stores only non-secret provider identifiers, capability flags, account/reference aliases safe for internal use and policy metadata.

## 43. Buyer-side Adulis Checkout surcharge

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

## 44. Checkout surcharge policy fields

| Field | Launch / version rule |
| --- | --- |
| rate_bps / amount | 0 / zero at launch. |
| basis / delivery_included | Retain proposed merchandise-only future basis; no current Adulis charge. |
| provider_fee_incidence | BUYER preference selected; enabled route needs actual contract permission. |
| fee basis/rate/rounding/refund treatment | Unconfirmed provider evidence; no guessed value or switch. |
| effective_range / policy_version | Immutable accepted snapshot; a future fee needs a new effective version. |
| currency / quote | Exact minor units/rounding/components; accepted history never repriced. |

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 45. Aggregator collection

Provider-managed Seller settlement is the conditional target. Market flags can select only independently confirmed permitted capabilities; they cannot establish merchant privileges. No Adulis surcharge collected at launch; Buyer-paid processing route disabled until evidence matches preference.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

## 46. Historical surcharge snapshots

Existing historical quotes/Orders retain captured rate/basis/currency/fee components and policy even if a later policy activates a Buyer Adulis surcharge. Initial corrected launch policy is zero. No retroactive repricing or altered refund history.

## 47. Fulfilment charge is separate

Seller-defined Courier compensation/delivery price is a Fulfilment/Order concern and appears as a separate Buyer checkout amount when applicable. Market Configuration can constrain currency/capability but does not set each Seller's Courier price.

Current Buyer-facing Courier Delivery charge equals the immutable Courier compensation snapshot, shown separately before payment. Market constrains currency/capability/service area, never sets each Seller compensation or includes it in current surcharge basis.

## 48. Canonical money storage

Use integer minor units plus ISO currency code. Never persist formatted money as transaction truth. Client locale formats presentation; it cannot change canonical amount or currency.

## 49. Single currency per Seller Market in the current release

Each current Seller operates in one Market and uses that Market's allowed transaction currency configuration. Do not expose an arbitrary Seller currency selector in MVP. Multi-currency Seller pricing and FX engines remain future work.

## 50. Currency formatting

Formatting follows resolved locale while currency identity follows the Seller Order/Market. This prevents language choice from changing the amount or currency. Use standards-based locale formatting and deterministic backend rounding.

## 51. UTC storage

Store absolute instants in timezone-aware timestamps/UTC equivalents. API instants use ISO 8601 UTC "Z". Never store only a human local clock string for transaction deadlines or acceptance timestamps.

## 52. Market timezone

Use an IANA timezone such as Africa/Addis_Ababa. Never use a fixed UTC offset as the Market timezone identity because future Markets can observe daylight-saving or historical timezone changes.

## 53. Ordering is available throughout the day

Seller "Active Hours" must not be interpreted as a time window during which Buyers are allowed to place Orders. Buyers can place eligible Orders at any time while commerce/payment/provider conditions allow it.

The Market/clients must therefore avoid labels that imply the Seller Store closes Checkout each night.

## 54. Seller operational time windows

Time limits belong to physical operations: delivery availability, Courier pickup, Buyer Collection and in-person store visits. Sellers configure those operational windows in their Market timezone. They are separate from whether Product Posts can be viewed or Orders can be paid.

## 55. Operational-window model

| Window | Meaning |
| --- | --- |
| delivery_window | When Seller/Courier delivery can be scheduled/performed |
| courier_pickup_window | When Courier may collect from Seller if separately configured |
| buyer_collection_window | When Buyer collection is available |
| store_visit_window | When physical in-person visits are offered |
| order_placement | Not restricted by these windows; available continuously subject to platform state |

## 56. Transaction/payment deadlines

Provider payment attempts use provider/Market bounded timeouts and exact UTC timestamps. Human text renders the deadline in the relevant Market/order local timezone. Do not revive long generic checkout timers from older transaction architecture.

## 57. Notification time semantics

Schedule notifications using absolute UTC instants derived from Market/local policy. Display absolute local times where stale relative wording could mislead. Notification queues never become the authority for Order/payment state.

## 58. Calendar model

Canonical transaction/legal dates use Gregorian/ISO date semantics internally. Amharic language selection does not automatically switch to the Ethiopian calendar. A future Ethiopian-calendar display is a presentation layer only.

## 59. Locale and Market remain orthogonal

Locale affects strings, number/date formatting and translated presentation. Market affects commerce policy. A user may choose a supported language without changing Seller Market, Order Market, payment provider or currency.

## 60. English is the primary global language

English (en) is Adulis's main, primary and source language from the initial Ethiopia commerce launch and across later enabled Markets. All production-critical functionality must have complete English strings and legal/product wording before launch.

Every current Market Locale Pack must include English. When no supported explicit language choice is available, the system falls back to English.

## 61. Initial and future locale support

Current first-class locales are English and Amharic where applicable. Additional languages are added through the platform locale registry and Market Locale Packs without changing domain APIs or business semantics.

## 62. Platform locale registry

Use a syntactically validated BCP-47-like locale code rather than an enum permanently limited to en/am. A locale registry stores code, display names, direction, formatting metadata, status and translation-governance references.

## 63. Market Locale Pack

| Field | Rule |
| --- | --- |
| market_id | Owning Market |
| default_locale | en under current primary-language policy |
| available_locales[] | Must include en; may include am and approved future locales |
| legal_locales[] | Locales with approved legal acceptance resources |
| translation_release_version | Version of shipping app/server catalogue |
| effective_range | When the pack applies |

## 64. Locale resolution

```
1. explicit supported user/client language choice
2. valid supported Accept-Language preference
3. English (en) primary fallback
```

```
Market identity is never inferred from locale.
Unsupported locale does not fail the commerce request; it resolves to English.
```

## 65. Language preference persistence

Mobile may persist the user's language preference locally and send Accept-Language on every online request. A future Account-level preference can synchronize devices, but it is not required for correctness. Server responses may expose Content-Language/resolved_locale.

## 66. Company Website locale routing

The Company Website canonical international English homepage is "/". "/en" may redirect to "/" for compatibility. Amharic uses "/am/..." where translated content exists. Future locale prefixes can be added without changing Market-page identity.

A locale path never means the associated Market is enabled for commerce.

## 67. Storefront and public-content localization

Public Seller/Product/Scene Post surfaces may render approved UI chrome and domain templates in the requested locale, but original Seller-authored content remains canonical unless an explicit translated rendering exists. Market restrictions still control item visibility/purchase eligibility.

## 68. Static UI translation resources

Application-owned labels/messages ship in version-controlled locale resources with Mobile, Seller Console, Operator Console, Website/Storefront or server templates as appropriate. Do not create a database row for every Save/Search/Checkout label.

## 69. Translation resource taxonomy

```
locales/
  en/
    common.json
    auth.json
    buyer.json
    seller.json
    checkout.json
    fulfilment.json
    claims.json
  am/
    ...same semantic namespaces...
  <future-locale>/
    ...enabled only after approved review...
```

## 70. English source-of-truth for product copy

For Adulis-owned UI and system messages, English is the canonical source string/semantic reference. Other translations must preserve the same domain meaning; they must not introduce different payment, Trust, eligibility or legal promises.

## 71. Whole-sentence localization

Use full sentence templates with named slots rather than concatenating fragments. Word order, grammar and inflection differ across languages. ICU/message-format style plural/number/date handling is recommended where supported.

## 72. Amharic translation ownership now

During the current release phase, the Ethiopian founders own/review Amharic translation quality. Launch-critical Amharic strings must be human reviewed by the founders rather than treated as final machine output.

This is an operational ownership decision, not a special authorization role inside the Market Configuration domain.

## 73. Future language teams

As Adulis expands, each supported language should have a dedicated translation/localization team responsible for terminology, critical UX, legal coordination, regression review and release approval for that locale.

Locale activation should record review/approval provenance and cannot rely on an unowned machine-translated catalogue.

## 74. Translation release gate

A new locale cannot be enabled for production-critical flows until required keys, legal resources, typography/layout tests and designated human review are complete. Optional non-critical gaps may safely fall back to English with telemetry.

## 75. Machine translation

Machine translation may assist drafting or optional user-content rendering when policy allows, but it is not authoritative for launch-critical UI, legal acceptance, financial/Claim evidence or Trust/Moderation decisions. Provenance must remain visible internally.

## 76. Original user content remains canonical

Product/Scene captions, Chat, Claims and other user-generated evidence retain the original text. A translated rendering is a convenience layer linked to source version and provenance; never overwrite the original.

## 77. Translation staleness

A translation is bound to a specific source version/hash. When source content changes, prior translation becomes stale until regenerated/reviewed. Clients must not silently present stale translated product claims as current.

## 78. Amharic and Ge'ez typography

Use fonts/stacks with Latin + Ethiopic coverage and test mixed strings such as Adulis, TikTok, Instagram, ETB values and Amharic text on real target devices. No missing-glyph boxes, clipped controls or Ethiopic-only font that damages Latin names.

## 79. Text expansion and accessibility

Layouts must tolerate substantial translation expansion, Dynamic Type/large text, screen readers and right-to-left future locales. Use logical layout properties and avoid fixed-width controls built only around English labels.

## 80. Notification localization

Notifications use whole-sentence locale templates and Market-local time rendering. Template selection happens from current canonical state at send time so stale queued text cannot claim an outdated payment/delivery status.

## 81. Chatbot localization

Chatbot answers must compose deterministic domain facts into approved language templates. An LLM or translation provider may not invent/alter canonical price, availability, payment success, fulfilment or policy truth during localization.

## 82. Error localization

APIs return stable error codes/structured data; clients translate user-facing explanation. Do not use English error text as the machine contract. Sensitive errors preserve information-disclosure rules across all locales.

## 83. Search configuration

Marketplace Search launches with PRODUCT_POST, SELLER and SCENE_POST. Search owns retrieval/query interpretation/ranking and consumes safe current Content/Product/Seller projections. Only PUBLIC eligible Scenes may appear. PRIVATE transition removes/inactivates the projection; PUBLIC restoration reactivates it idempotently. Stale Search cache never authorizes private content. PostgreSQL + pg_trgm may remain sufficient; dedicated search infrastructure requires measured need.

Market resolves active commerce context, effective Search policy/version and bounded Market parameters. Search enforces current Scene visibility, Product availability, Moderation and Seller eligibility. Inactive Market or stale config/projection never authorizes public Scene commerce.

## 84. FYP configuration

Recommendation owns candidate ranking, exploration, diversity and personalization. Market Configuration supplies active Recommendation policy/reference and bounded Market-level parameters; it does not offer a giant weight editor.

FYP top-level units are SCENE_POST only and photo/image based. Product Posts remain commercial detail/Search/Shop/tag destinations. Content requires PUBLIC eligibility and at least one available valid tagged Product; PRIVATE/Seller/Market/Moderation/media restrictions cannot be bypassed by Market flags or Recommendation.

Buyer Home tabs are For You (default), Following, Nearby, Discounts and Locally Made. These are discovery surfaces, not separate Markets; Nearby never changes Market identity.

## 85. No retired recommendation modules in launch config

Do not create launch flags or configuration UI for the previously deferred recommendation modules that were removed from current Adulis surfaces. Future reintroduction requires a separate feature decision/version.

## 86. Photo-only media policy reference

Current publishing is photo-only for Adulis-hosted post media. TikTok video may be embedded only through the approved Product Post detail integration after social-account ownership checks. Market Configuration may expose capability availability but Media/Catalogue own implementation and validation.

## 87. Feature flags

Feature flags are rollout/capability controls, not authorization or business truth. They may enable a client surface in a Market, but server authorization/domain invariants still decide whether an action is allowed. Only allowlisted public flags reach Bootstrap.

## 88. Client bootstrap

GET /v1/bootstrap (or canonical equivalent) remains the client entry point for authoritative runtime context: resolved Market, resolved locale, server time, public feature flags, minimum client/runtime policy and safe capability summaries.

## 89. Bootstrap response principle

Bootstrap exposes the minimum public operating context, not entire internal configuration tables. It must never include provider credentials, internal risk thresholds, private moderation rules or unrestricted Operator configuration.

## 90. Online-only application rule

Current Adulis business operations require network connectivity. Cached Bootstrap/local storage may improve startup presentation, but stale local data cannot authorize Checkout/payment, Seller publication, team administration, Courier assignment, Handoff verification, Market entry or policy-sensitive mutations.

No offline Market-policy execution path should be introduced into Mobile.

## 91. Cross-surface Market consistency

Mobile, Seller Console, Storefront, Company Website and Operator Console must use the same Market/locale contracts. They may render different surfaces but cannot invent different currency/timezone/provider/eligibility semantics.

## 92. SMS routing is Market-configured

Auth owns OTP generation/verification. Market Configuration owns the ordered transport-provider routing policy by Market. Messaging providers transport codes; they do not become authentication authority.

## 93. Ethiopia SMS route

Current Ethiopia provider order remains Afromessage primary and SMS Ethiopia backup, subject to healthy/approved deployment configuration. Routing policy is data, not hard-coded Ethiopia branches in Auth.

## 94. International SMS default direction

For later deliberately enabled international Markets without a better approved local route, current default direction is Twilio primary and Infobip backup. A Market can override the provider order through a versioned routing policy.

## 95. Provider health is not configuration

"Provider is currently failing" is operational health, not Market policy. Health checks/circuit breakers live in runtime/provider routing. Configuration says which providers are permitted and priority order.

## 96. Client version policy

Market/platform policy can require minimum native binary/runtime versions. Mobile deep links and cached screens cannot bypass UPGRADE_REQUIRED. Expo OTA/runtime compatibility and native-binary floors are separate dimensions.

## 97. Configuration governance

Production Market policy changes are production changes. Operators use typed forms/workflows, diffs, validation, impact previews, risk classification and audit. There is no generic production SQL editor for arbitrary Market settings.

Operator Account is a separate privileged internal security principal, independent of an ordinary Buyer/Seller/Courier Account. A person may possess both; their credentials, sessions, recovery, revocation and audit attribution remain separate. Ordinary Account registration, OTP, recovery or Seller roles never produce Operator authority.

Privileged internal provisioning creates the Operator Account and explicit least-privilege role/capability assignments. Strong phishing-resistant credentials, isolated OPERATOR sessions, fresh authorization, immediate revocation and audited domain workflows are required. Founder/Staff governance remains Operator-domain policy, and ADMIN does not create a restricted-evidence bypass.

## 98. Risk classes

| Risk | Examples |
| --- | --- |
| LOW | Non-critical presentation metadata |
| MEDIUM | Optional locale availability, non-critical feature rollout |
| HIGH | Provider routing, eligibility thresholds/rules, client-version floor |
| CRITICAL | Market activation, legal/retention, surcharge rate/basis, prohibited category policy |

## 99. Review and approval model

High/critical Market changes consume the approved result of the current Operator Console workflow; Market Configuration does not duplicate the Founder/Staff approval engine. Actor/reviewer/approver are separate privileged Operator Accounts, never ordinary Account grants.

Founder phase preserves dual control and the bounded audited Solo Coverage exception; Staff phase preserves COO/CTO team governance and risk-based second approval without routine CEO dependency. Exact frozen proposal, current capability, fresh auth, required independent approval and execution-time domain validation govern publication.

## 100. Fresh authentication / Step-Up

Sensitive Market changes require fresh privileged authentication/Step-Up according to Auth/Operator policy. A long-lived session alone is not sufficient for critical activation, provider-routing or legal/retention changes.

Fresh proof belongs to the separate Operator principal/strong credential and is not satisfied by ordinary personal phone OTP or recovery.

## 101. Scheduled effective changes

A future-dated policy becomes effective by resolver time semantics, not by a fragile scheduler flipping a boolean. Caches must expire/invalidate before the next policy boundary.

## 102. Rollback

Do not mutate a published historical configuration row. Rollback publishes a new version/effective range that restores prior semantics while preserving audit history.

## 103. Operator Console views

Operator Console should provide Market overview, active/future configuration versions, locale coverage, provider routing, capability gates, validation/preflight, diff and audit history. It must not duplicate domain-specific editors such as FYP weight tuning beyond a safe reference/status view.

## 104. Audit requirements

Every policy publication records actor, reviewer/approver where applicable, Market, domain, previous/new version, effective range, reason/change request, request/session IDs and timestamps. Audit is append-only and must not copy secrets.

Audit identifies operator_account_id and privileged reviewer/approver IDs, exact capability and approval/workflow context. Do not attribute changes to the person's unrelated ordinary Account; retain historical identity/version lineage after revocation.

## 105. Canonical events

Publish typed versioned events such as market.config_published, market.activation_changed, market.locale_pack_changed and market.provider_routing_changed through the transactional outbox. Consumers re-read authoritative configuration rather than trusting an arbitrary event payload as the full policy.

Each exact fact is registered in Contract_Registry with event_version, canonical Market/configuration revision, owner provenance and permitted consumers. A published provider-routing configuration is not G01 permission, and a configuration event never activates unapproved legal/social capabilities.

## 106. Observability

• Sentry for application errors/traces; Pino structured logs with request/Market/config-version context.

• pg_stat_statements for resolver/query performance and missing-index detection.

• Metrics for resolution latency, cache hit/miss, stale-cache prevention, overlap violations, missing critical config, translation fallback and provider-routing failures.

• Never log provider secrets, OTP values, private legal evidence or full sensitive user content.

## 107. Failure behavior

| Failure | Canonical behavior |
| --- | --- |
| PostgreSQL unavailable | Critical policy-dependent writes fail closed; public/static surfaces may degrade separately |
| Valkey unavailable | Resolve from PostgreSQL; slower but correct |
| Missing critical Market config | Reject affected operation with typed configuration error |
| Missing optional translation | Fallback to English + telemetry |
| Missing critical translation/legal locale | Locale/capability cannot be enabled for that flow |
| Payment provider unhealthy | Payments uses approved failover/reconciliation policy; Market truth unchanged |
| SMS primary unhealthy | Router tries next permitted provider safely |

## 108. Security model

Configuration endpoints are privileged, server-authorized and audited. No Seller/Buyer may mutate Market policy. Validate every typed payload, enforce effective-range constraints in the database, separate secrets, throttle abuse and prevent cross-Market IDOR.

## 109. Privacy model

Market/locale resolution should minimize unnecessary location collection. Geo-IP, country and language signals are routing hints, not excuses to store precise user location. Translation telemetry must not capture sensitive text where a key/error code suffices.

## 110. Core data model

```
core.market
core.market_activation_history
core.market_service_area
core.locale_definition
core.market_locale_pack
core.market_feature_flag
core.client_version_policy
core.sms_routing_config
core.sms_routing_provider
core.market_payment_provider_config
core.market_checkout_surcharge_policy
core.market_eligibility_policy
core.market_legal_policy_ref
core.market_retention_policy_ref
core.market_search_policy_ref
core.market_recommendation_policy_ref
core.configuration_change_request / audit
```

```
Domain-owned tables remain in their own modules; Market stores references/policy versions, not duplicated truth.
```

## 111. Market record fields

| Field | Notes |
| --- | --- |
| id / code | Stable internal + public-safe code as designed |
| name | Display/admin name |
| country_code / region_metadata | Descriptive routing metadata |
| activation_state | Single activation authority |
| display_timezone | IANA timezone |
| created_at / updated_at | Audit timestamps; policy itself is versioned elsewhere |

## 112. Locale definition fields

| Field | Notes |
| --- | --- |
| locale_code | BCP-47-like validated code |
| english_name / native_name | Presentation metadata |
| direction | LTR/RTL |
| status | DRAFT/ACTIVE/RETIRED or canonical equivalent |
| source_locale | en for current Adulis translation workflow |
| review_owner_ref | Operational translation governance reference, not user authorization |

## 113. Public API / internal contract

• GET /v1/bootstrap - safe resolved Market/locale/capabilities/version floor.

• GET /v1/markets/availability - bounded public availability where needed.

• Internal resolveMarketContext(account/request signals).

• Internal resolvePolicy(marketId, policyDomain, decisionAt).

• Operator typed proposal/validate/approve/publish endpoints.

• Domain-specific resolvers for payment provider, eligibility, surcharge, locale, SMS, client version and feature flags.

## 114. Repository placement

```
adulis-platform/
  apps/
    api/
      src/modules/market-config/
      src/modules/auth/
      src/modules/payments/
      src/modules/orders/
      src/modules/onboarding/
      ...
    worker/
    mobile/
    seller-console/
    operator-console/
    storefront/
  packages/
    api-contracts/
    locale/
    money/
    dates/
    schemas/
    analytics-events/
    permission-catalogue/
```

```
adulis-web/
  separate Company Website monorepo; consumes public Platform contracts,
  owns Website CMS/intake only, and uses / as canonical English homepage.
```

## 115. Canonical technology stack

| Layer | Current baseline / Market relevance |
| --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript; Market resolver in modular monolith |
| Database/ORM | PostgreSQL + Drizzle ORM |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements |
| Async/cache | Valkey + BullMQ; non-canonical |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript clients |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js where phone normalization applies |
| Media | Cloudflare R2; Cloudflare CDN; Sharp (wider platform, not Market truth) |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; SecureStore; SQLite technical-only; Camera; Notifications; Updates; small Zustand store |
| Web integration | Company Website uses Next.js/React in separate adulis-web; Storefront consumes platform public APIs |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 |
| Observability | Sentry; Pino structured logs; pg_stat_statements |
| Architecture control | dependency-cruiser |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS |

## 116. Valkey cache policy

Valkey is the only current distributed cache/queue datastore name. Use it for bounded configuration cache/invalidation coordination, rate-limit/abuse counters and BullMQ backing where appropriate. It is never the source of truth.

Cache TTL must not cross the next scheduled effective boundary. Critical policy-sensitive writes may bypass stale caches or verify current policy directly.

## 117. No global configuration microservice yet

Keep Market Configuration inside the NestJS modular monolith until measured scale/ownership pressure justifies extraction. Do not introduce Consul, etcd, Kafka, Kubernetes, a general remote-config SaaS dependency or GraphQL merely for Market config.

## 118. Testing - effective versions

Use Testcontainers/PostgreSQL tests for non-overlap, boundary instants, scheduled changes, rollback, time-zone behavior and concurrency. Exactly one effective config must resolve for a required Market/domain/decision time.

## 119. Testing - Phased Multi-Market Resolution

Ethiopia is ACTIVE initially; unsupported/inactive Market cannot transact merely because locale/IP/phone/app rendering suggests it. Addis service coverage does not create a separate Market. A future non-Ethiopia Market can be configured and deliberately activated through complete policy packs without if-country application branches or phase-number authorization.

## 120. Testing - Seller Market scope

Verify one current Seller has exactly one operating Market; Product Posts/Scene Posts cannot become purchasable in another Market through client tampering. Multi-country Seller UX is absent until a future explicit release.

Launch Search includes Product/Seller/PUBLIC Scene in valid Market context. PRIVATE Scene is absent from Search/FYP/Storefront/Collections regardless of flags; Market suspension prevents automatic restoration.

## 121. Testing - Seller verification policy

Verify social-account control, verified ordinary Account/phone, legitimate Seller/business evidence and applicable selling-creator status admit eligible Sellers without Government-ID/passport/selfie requirements. No government-document-specific route, accepted-document list, legal-ID flag or KYC-vendor model remains current or pre-assumed.

A neutral later admission version stays inactive until explicitly approved; a creator qualifying as Seller does not create standalone Creator authorization.

## 122. Testing - English primary locale

With no valid explicit locale, every current Market resolves English. Every active Market Locale Pack includes en. English critical-key coverage is complete and cannot depend on another translation.

## 123. Testing - Amharic

Accept-Language/user preference am in an enabled Market resolves Amharic. Critical strings are founder-reviewed, whole-sentence templates render correctly, mixed Latin/Ge'ez passes on physical devices, and optional missing keys fall back to English without exposing raw keys.

## 124. Testing - future locale team gate

A future locale cannot become active until its translation owner/team, required key coverage, legal resources and review approval are present. A machine-generated draft alone fails activation.

## 125. Testing - Website routing

Verify "/" renders the international English homepage, "/en" redirects/normalizes as designed, and "/am/..." serves approved Amharic content without changing Market identity. Hreflang uses only real approved equivalents.

## 126. Testing - Checkout surcharge

Specification tests: launch returns 0 bps and zero Adulis amount in quote/request/receipt/ledger; provider cost stays separate and unconfirmed route disabled; material new quote changes need confirmation; historical zero/legacy snapshots remain unchanged; no double fee collection. Provider-approved calculation/basis is tested only after evidence exists.

## 127. Testing - payment providers

Specification tests: configured candidate alone cannot enable Chapa; exact merchant/environment/API/verification/capability evidence required; unsupported fee/refund/finality route disabled. Future Market routing retains the same explicit activation framework; secrets never appear in public config.

## 128. Testing - Seller operational windows

A Seller with no current store-visit/delivery window can still receive eligible Orders at any time. Delivery/collection/visit scheduling respects Seller Market-local windows. Client timezone manipulation does not change the canonical window.

## 129. Testing - online-only clients

Disconnect the device and confirm cached Bootstrap cannot authorize Market-sensitive mutations, Checkout/payment, Seller publication, Courier assignment or Handoff. Reconnection forces canonical re-read

before action.

## 130. Testing - Valkey degradation

Stop Valkey and verify configuration resolution falls back to PostgreSQL with degraded performance but identical policy decisions. Restart/invalidate without creating a stale-boundary correctness bug.

## 131. Testing - Operator governance

Critical change proposal/approval follows current founder/staff Operator Console rules. Requester cannot perform prohibited self-approval while both required actors are present. Founder Solo Coverage Mode is explicitly audited and automatically disabled when both founder operators are logged in.

Audit and privileged login identify separate Operator Account; ordinary registration/recovery/roles cannot approve/publish Market config. Required independent approval, fresh strong auth and current execution checks are consumed from the Operator domain.

## 132. Load and performance

Market policy resolution is read-heavy and should be request-memoized plus bounded-cached. k6 should exercise Bootstrap/config resolution and worst-case cache misses. pg_stat_statements must show indexed, bounded version lookups without unbounded scans.

## 133. Production launch gates

• Multi-Market-ready code and complete English baseline; current initial commerce Market is Ethiopia, later activation deliberate.

• activation_state is the sole runtime activation authority; complete packs required; locale/IP/global app reach cannot activate inactive Markets.

• Addis coverage is a service area; current Seller has one Market; Product/Scene tags and public commerce are properly scoped.

• Current social Seller admission uses no Government ID or dormant government-document route; selling creators use Seller rules only.

• Content-owned Scene minimum-tag/availability/PUBLIC-PRIVATE/restoration integrates with Market/Seller/Moderation restrictions.

• Launch Search returns Product/Seller/Scene, FYP is Scene-only, and no public path resolves PRIVATE content.

• English default/fallback complete; Amharic critical strings founder-reviewed; mixed Ethiopic/Latin, expansion and real-device checks pass.

• Future locales require registry, legal resources, designated human ownership/release review; original user content/version provenance retained.

• Current zero-bps merchandise policy excludes Courier delivery; separate Courier charge equals immutable paid compensation; snapshots survive later changes.

• Provider secrets stay outside config; approved PSP/backend owns payment truth; Chapa only where configured.

• Online ordering remains available outside physical-operation windows; UTC/IANA semantics and currency/locale separation pass.

• PostgreSQL effective-version/non-overlap and Valkey fallback are correct; cached Bootstrap/flags cannot authorize mutations.

• Separate Operator Account governance, audit, fresh auth, scheduled versions, rollback, security/E2E/load and production readiness pass.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 134. Recommended implementation sequence

• Phase 0: retire duplicate activation/locale authority and obsolete document-specific admission configuration.

• Phase 1: typed Market context/decision_at/effective resolver with PostgreSQL overlap constraints.

• Phase 2: multi-Market registry and Ethiopia initial activation; Addis service coverage; inactive-Market denial; one Seller Market.

• Phase 3: English-primary registry/locale packs and founder-reviewed Amharic legal/UI/device release gates.

• Phase 4: provider-safe PSP config, zero-bps merchandise surcharge excluding delivery and immutable snapshots.

• Phase 5: social-commerce admission with neutral future-method seams, versioned Ethiopia launch categories and no Creator principal.

• Phase 6: Content Scene visibility/launch Search/Scene-only FYP references and current public hard gates.

• Phase 7: UTC/IANA ordering-versus-physical windows, bootstrap/client-version/feature allowlist and online revalidation.

• Phase 8: configured local/global-enabled SMS routes and independent runtime provider health.

• Phase 9: separate Operator governance results, immutable audit/scheduled versions/rollback, then full failure/security/locale/payment/load certification.

## 135. Migration to Current Canonical Market Baseline

Use additive versioned migrations and preserve historical policy/Order/admission/legal/Claim facts. Remove duplicate activation flags, obsolete government-document-specific admission fields and personal-Account privileged governance assumptions. Canonical Scene naming and public Search projections migrate with bounded deployed-client compatibility where needed.

Replace ambiguous worldwide launch framing with global-ready architecture and deliberately phased Ethiopia-first commerce. Preserve one Seller Market, neutral future seams, English source/Amharic review, social-commerce admission, zero-bps merchandise surcharge excluding Courier delivery, provider authority, UTC/IANA time, all-day ordering and central retention.

Existing historical effective versions/audit references are not rewritten; publish corrected future/current versions through authorized Operator Account workflows and exact non-overlapping resolver semantics.

## 136. Explicitly deferred

• Government-document Seller identity verification / formal KYC path.

• Simultaneous multi-country Seller operations and self-service Seller Market migration.

• Multi-currency Seller pricing / live FX engine.

• Automatic country switching from IP.

• Full translation-management SaaS dependency and automatic legal translation.

• Machine translation as canonical Claim/financial/legal evidence.

• Ethiopian-calendar transaction storage.

• Global multi-region Market-config database replication before measured need.

• General experimentation platform or arbitrary remote-config engine.

• Open-ended generic configuration microservice.

• Standalone Creator actor/catalogue or cross-Seller tagging until separately approved.

• Formal Government-ID Seller verification requires a new explicit design, with no dormant active/pre-designed government-document route retained.

## 137. System invariants

The following invariants define the current production contract.

• MKT-INV-01 Market context is server-authoritative.

• MKT-INV-02 Market is not country.

• MKT-INV-03 Market is not locale.

• MKT-INV-04 Market is not service area.

• MKT-INV-05 Architecture is multi-Market-ready; commerce activation is phased.

• MKT-INV-06 Ethiopia is the initial active commerce Market.

• MKT-INV-07 Each current Seller has one operating Market.

• MKT-INV-08 Product Posts/Scene Posts and tags are Market scoped.

• MKT-INV-09 Scene PUBLIC/PRIVATE and available-tag eligibility remain Content-owned.

• MKT-INV-10 Marketplace Search includes Product/Seller/PUBLIC Scene from launch.

• MKT-INV-11 FYP top-level units are image-led Scene Posts only.

• MKT-INV-12 Current Seller admission requires no Government ID.

• MKT-INV-13 No government-document-specific future route or document/KYC configuration is pre-assumed.

• MKT-INV-14 PSP/backend verification establishes payment success.

• MKT-INV-15 Current Buyer surcharge is 0 bps on eligible merchandise, delivery excluded.

• MKT-INV-16 Courier charge is separate and equals immutable compensation in MVP.

• MKT-INV-17 Physical operating windows do not close eligible online ordering.

• MKT-INV-18 UTC instants/IANA local presentation are canonical.

• MKT-INV-19 Valkey is non-canonical; PostgreSQL owns policy.

• MKT-INV-20 Policy is typed/versioned/effective-dated with exactly one required applicable version.

• MKT-INV-21 Current policy never reinterprets historical commerce/evidence.

• MKT-INV-22 Provider secrets never exist in Market config.

• MKT-INV-23 Feature flags and cached Bootstrap cannot bypass authorization.

• MKT-INV-24 Original user content/version provenance is preserved.

• MKT-INV-25 Current business mutations are online-authoritative.

• MKT-INV-26 High-risk governance attributes separate Operator Accounts and consumes approved workflows.

• MKT-INV-27 English is source/fallback; current Amharic and future locale release approval are human-owned.

## 138. Final System Architecture

Stable registry, explicit phased activation, typed effective policy and orthogonal locale rendering serve current domains. Content/Payments/Trust/Fulfilment retain ownership; Operator supplies approved privileged governance.

![Current effective policy with orthogonal locale rendering](graphics/MKT_03.svg)
*Figure 03. Current effective policy with orthogonal locale rendering. One decision time resolves non-overlapping canonical policy; domains retain exact historical snapshots while safe Bootstrap never substitutes for authorization.*

![Global-ready architecture with phased commerce activation](graphics/MKT_04.svg)
*Figure 04. Global-ready architecture with phased commerce activation. The five phases describe strategy only; runtime authorization uses approved Market activation and capability packs, initially Ethiopia with Addis service coverage.*

## 139. Final engineering doctrine

Adulis should never ask "Are we in Ethiopia?" when the real question is "which currency, provider, eligibility rule, timezone, locale or legal version applies?" The Market Configuration System exists to answer those questions explicitly without forking the platform.

The same discipline applies to localization: English is the primary global source/fallback language, translated experiences must preserve identical business meaning, and locale choice can never alter transaction truth. Ethiopia receives first-class founder-reviewed Amharic support, while future languages gain dedicated translation teams and release gates.

The governing model is stable Market identity + versioned policy + effective time + explicit locale support + strong Operator governance + server-side domain ownership.

Multi-Market readiness is an architecture property; active commerce is a deliberate runtime policy. Ethiopia starts first, Addis may limit service coverage, and later Markets activate only after full approved capability packs. Scene visibility remains Content-owned and privileged governance uses separate Operator Account identity.

## 140. Glossary

| Term | Definition |
| --- | --- |
| Market | Stable commerce-policy boundary, independent of country/locale/service area. |
| Country | Descriptive territorial/routing metadata, not immutable Market identity. |
| Service Area | Operational coverage inside a Market, such as initial Addis Ababa. |
| Market Activation | Deliberate runtime activation after complete approved capability/policy packs. |
| ACTIVE | New eligible commerce allowed subject to current domain capabilities. |
| SUSPENDED | New entry/capabilities blocked by policy while existing obligations remain safe. |
| Market Context | Server-resolved market_id with decision time and independent locale. |
| Decision Time | One canonical instant used consistently to resolve effective versions. |
| Policy Version | Immutable typed effective configuration and provenance. |
| Effective Range | Non-overlapping time interval applying one Market/policy version. |
| Historical Snapshot | Exact version/amount/legal facts retained for durable business decisions. |
| Locale | Language/formatting choice that never changes transaction policy/currency. |
| Locale Pack | Approved language coverage/legal/review version for a Market. |
| English Source Locale | Complete source/default/fallback for current and later enabled Markets. |
| Amharic | Current Ethiopia locale with founder-reviewed critical copy and Ethiopic QA. |
| Scene Post | Image-led Seller content with Content-owned current visibility/eligibility. |
| Product Post | Canonical Product object inheriting Seller Market. |
| Marketplace Search | Launch Product/Seller/PUBLIC Scene retrieval under current Market gates. |
| FYP | Scene-only recommendation feed; Market references policy, never ranks. |
| Seller Admission | Versioned current social-commerce/business eligibility, no Government ID. |
| Social-Commerce Admission | Account/phone/social-control and legitimate business evidence. |
| Courier Delivery Charge | Separate Seller-defined charge equal to paid compensation in MVP. |
| Adulis Checkout Surcharge | Current Buyer zero-bps eligible-merchandise charge, delivery excluded. |
| Payment Provider | Approved Market-selected adapter; backend/provider owns payment facts. |
| IANA Timezone | Named zone for local human rendering; canonical instants remain UTC. |
| Operator Account | Separate privileged actor for approved Market-policy governance/audit. |
| Valkey | Bounded non-canonical policy cache/async infrastructure. |
| PostgreSQL | Canonical Market identity/effective policy/snapshot/audit store. |
| Shoppable Post | Superseded former term for Scene Post. |

## 141. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-19 — Mobile-safe localization and Amharic release gate | The 13 October designs prohibit Mobile software-subscription purchase/billing surfaces and keep commercial subscription management in Console. | Mobile runtime imports only a physically isolated mobile-safe/shared localization catalogue; Console-only subscription, tier, billing and software-purchase copy must not enter the Mobile import graph even if hidden at runtime. English/Amharic key parity is enforced. Current Amharic strings are not approved human translations; Amharic remains disabled for users until a human translation/review pass is complete. | WO-001A, 8 Nov 2026 |
| R-22 — Canonical launch Adulis surcharge remains zero | The October 13 Finance/Order/Market/KB designs set launch Adulis surcharge to 0 bps / amount zero. | Launch Adulis surcharge is disabled: 0 bps and zero amount. Provider processing fee is a separate provider-policy route and may be Buyer-paid only when that route is explicitly permitted and confirmed. The prototype canonical-rules line claiming a current 0.5% Adulis Buyer surcharge is stale and must not be implemented. | October 13 pack reaffirmed against stale prototype rule |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.

### Open / deferred items

• Amharic user release remains blocked on human translation/review even though rendering and key parity are technically validated.
