# Adulis Content Security Policy
Version 1.1 | 12 October 2026 | DOCUMENT-CORRECTED

## Document control

Complete amended baseline: 12 October 2026. The supplied correction prompt and owner decisions supersede the conflicting reviewed source wording. Every original numbered body section and unaffected table/graphic is retained; targeted contracts, examples, tests, invariants and dependent definitions are reconciled. The historical audit remains unchanged.

| Document control | Amendment baseline |
| --- | --- |
| Version history | 1.0 reviewed 8 October 2026 -> 1.1 amended 12 October 2026. |
| Source | ADU-CSP-01_Adulis_Content_Security_Policy_Browser_Resource_Security_Complete_System_Design_v1.0.pdf |
| Authority | 19 selected corrections / F01-F18 and owner product decisions. |
| Status | DOCUMENT-CORRECTED; implementation, integration tests and external approvals not established. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |

## 1. Executive Summary

ADU-CSP-01 v1.0 is the first complete browser-resource policy baseline for Company Website, Seller Storefront, Seller Console and separate privileged Operator Console. It specifies deny-by-default resource permissions, strict executable trust, source governance, safe reporting and staged deployment with tested rollback.

CSP reduces the impact of code/resource injection and unwanted framing; server authorization, escaping/sanitization, secure sessions/CSRF, dependencies and provider verification remain independent controls. This document is an implementation-ready design, not evidence that production headers are deployed.

Adulis's photo Scene/Product media, social-account control, provider payment, private Chat/Claims and Operator evidence require surface-specific restrictions. Native React Native is not generally governed by browser CSP; webviews/browser flows need their own policy assessment.

## 2. Mission

Make every production browser resource and executable capability an explicit, reviewed dependency; prevent silent policy weakening and detect deployment regression while preserving Adulis's exact current commerce and privacy boundaries.

## 3. Goals

• Four independent versioned surface policies and a reviewed source registry.

• Nonce/hash executable trust with no wildcard scripts or target script unsafe-inline/eval.

• Narrow API/media/worker/form/frame permissions, active providers only.

• Minimized abuse-resistant reports and operational signals, no business mutation.

• Browser tests, CI gates, edge/application consistency and nonce-safe caching.

• Governed rollout, emergency last-approved enforced baseline and launch evidence.

## 4. Non-Goals

CSP does not authorize a Buyer/Seller/Operator command, validate an OAuth callback or payment webhook, prove a legal transfer basis, or sanitize user content. It does not eliminate a compromised trusted script, all data exfiltration, browser extension risk or all XSS.

No mandatory CSP SaaS, SIEM, new policy database, broad Trusted Types rollout, additional runtime or native Mobile CSP is introduced. Dynamic source discovery never auto-approves a provider.

## 5. Standards Baseline

Standards checked 8 October 2026: W3C CSP Level 3 published Working Draft dated 16 September 2026 [S01], browser-vendor MDN directive/reporting references [S03-S08], strict-CSP engineering guidance [S02], current Fastify Helmet [S09] and Cloudflare guidance [S10]. CSP3 draft status is explicit; supported browser behavior is verified with Playwright/device tests, not inferred from the draft alone.

Adulis chooses stricter application defaults where compatible. Exact browser/version floor, deployment hostnames and approved provider resources are VERIFY PRODUCTION CONFIGURATION. Unsupported draft directives are not launch dependencies.

## 6. Threat Model

| Threat / surface | Control and residual risk |
| --- | --- |
| Product description / Scene caption stored XSS / Storefront/public | React escaping; no arbitrary HTML; strict script roots Residual: Trusted-script gadget still needs code review. |
| Chat body injection / Buyer/Seller web | Text rendering; no raw HTML or injected nonce Residual: Sensitive content remains private; CSP is backup. |
| Claim text / evidence filename / Operator Console | Escape filename/text; separate safe evidence viewer Residual: A compromised trusted viewer can still read authorized evidence. |
| Malicious external script / All web | Registry, approved build artifacts, nonce/hash roots Residual: Approved dependency compromise remains possible. |
| Approved CDN compromise / Public/media | Separate media vs executable host; immutable assets/hash/SRI where applicable Residual: Same-origin trusted bundles remain a supply-chain risk. |
| Browser extension / All web | Document limitation, server capability/freshness protection Residual: User-installed privileged extension may bypass CSP. |
| Operator clickjacking / Operator | frame-ancestors none; X-Frame-Options DENY fallback Residual: Browser/session compromise remains outside framing control. |
| Injected exfiltration form / Authenticated web | Explicit form-action self and server CSRF/session validation Residual: Top-level navigation needs independent validation. |
| Image/network exfiltration / All web | Narrow img/connect; no arbitrary remote Seller URLs Residual: An approved origin can receive permitted requests. |
| Nonce theft / reuse / Nonce HTML | Fresh random trusted-template nonce; no HTML cache reuse Residual: Trusted DOM/script compromise can expose runtime trust. |
| Third-party iframe compromise / Product detail only if enabled | Narrow frame-src, sandbox/referrer/permissions and kill switch Residual: Provider content may track or misbehave within its frame. |
| Policy downgrade / Sensitive consoles | Version review, effective header tests, Audit and rollback Residual: Approved emergency action still requires monitoring. |
| Report flooding / forgery / Report endpoint | Size/rate/schema limits, bounded aggregation; observations only Residual: Reports cannot prove exploitation or authorize a mutation. |

## 7. Adulis Web Surface Inventory

| Surface / policy | Risk / boundaries |
| --- | --- |
| Company Website / CSP-PUBLIC-WEB | Acquisition/info/waitlist; approved resources only, no assumed marketing scripts. |
| Seller Storefront / CSP-STOREFRONT | Adulis Seller profile, Product/Scene media; no Seller executable HTML/JS. |
| Seller Console / CSP-SELLER-CONSOLE | Ordinary Account + current Seller ownership/TEAM; sensitive business administration, no discovery embeds. |
| Operator Console / CSP-OPERATOR-CONSOLE | Independent privileged identity/evidence; strongest resource floor, no social/payment/advertising iframe. |
| Mobile / assessed browser flows | Native RN permissions/security separate. Any webview/temporary Handoff page/Checkout browser document gets an explicit host and policy. |

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one current non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Multiple roles union permissions within that membership; ownership and Courier relationships do not consume the TEAM limit. Different humans use different Accounts.

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

Buyer Product-detail/Checkout web routes inherit a named public policy and separately reviewed route exception. No giant shared allowlist may absorb console or future-Market resources.

## 8. CSP Architecture

![One approved browser policy per actual HTML surface](graphics/CSP_01.svg)
*Figure 01. One approved browser policy per actual HTML surface. Native React Native is outside CSP enforcement; its browser/WebView flows are assessed separately.*

Version-controlled declarative policy + approved-source registry is the canonical source. A deterministic builder resolves surface/environment and only active approved routes; it generates the response header, diagnostics and deployable edge artifact. Review/sign-off precedes immutable release; browser observations never edit the registry automatically.

Nonce profiles require the layer rendering HTML to generate and bind a per-response trusted nonce. Hash profiles use build-produced exact-byte hashes and immutable asset manifests. Four surface profiles share a security floor but not resource lists. Independently hosted surfaces must deliver their own correct headers.

## 9. Policy Source Registry

| Registry field | Required semantics |
| --- | --- |
| source_id / exact_origin / directive_classes | Normalized HTTPS origin, optional explicit port/path rationale; no broad wildcard or scheme by default. |
| surface / route / environment / active_market_provider | Exact approved capability scope; inactive future providers excluded. |
| purpose / capability / data_access / data_transmitted | Explain script execution vs image/frame/API; visible/transmitted personal data. |
| third_party / processor_role / privacy_ref | Link actual processor/DPIA/legal approval; CSP allowlist is not approval itself. |
| owner / approval_ref / approved_by_operator_account_id | Accountable technical/business role and privileged deployment provenance. |
| approved_at / review_at / expiry / active | Time-bound exception/review; expiration blocks new release until removed or renewed. |
| evidence_ref / build_version / rollback_ref | Vendor documentation and staging resource trace; immutable deploy/last-approved baseline. |

Unknown origins fail build review. Security/Privacy owns third-party assessment; ordinary Seller content or account role cannot change the registry. If a CDN path is shared with user bytes, never treat it as executable-trusted solely because its host is canonical.

## 10. Policy Versioning

```
policy_id, policy_version, surface, environment
mode: REPORT_ONLY | ENFORCED
directives, source_registry_version, build_manifest_ref
effective_from, effective_to?, status
approval_ref, approved_by_operator_account_id?
deployment_version, previous_enforced_version
source/config commit and immutable policy digest
```

CSP configuration may live entirely in reviewed code/config; a policy database is not required. Production changes to sensitive-surface policy are privileged security operations. Record exact before/after version, reason, approval, deployment and typed Operator or approved SYSTEM deployment provenance; no ordinary-user update API exists.

## 11. Strict Script Model

Every parser-inserted executable root must be trusted by the exact runtime nonce or build hash strategy, including module/bootstrap tags. Inline event handlers, javascript: URLs, eval/new Function and user-controlled script loaders are removed. Do not solve a broken integration by enabling unsafe-inline/eval or a wildcard host.

Bundled/self-hosted roots are preferred. Use strict-dynamic only when audited loaders require dynamic dependency loading; otherwise individually authorize nonce/hash roots. Review loader arguments, dependency integrity and trusted DOM sinks; a nonce on a trusted loader does not sanitize its URL input.

## 12. Nonces

For server-generated HTML choose cryptographically random per-response nonce, e.g. Node crypto randomBytes(16).toString("base64") as a 128-bit engineering baseline [S02]. Bind the same response nonce to its header and explicitly trusted server-owned script/style tags. It must differ across responses; never derive from identity/time or copy onto arbitrary user markup.

```
const nonce = randomBytes(16).toString('base64');
// renderTrustedTemplate receives nonce explicitly.
// Header and trusted HTML tags use this same response value.
// Never regex-rewrite all script tags or log nonce.
reply.header('Cache-Control', 'private, no-store');
```

Public nonce-bearing HTML also bypasses shared CDN/service-worker HTML caches unless a reviewed edge-render mechanism regenerates both header and body safely per response. Static JS/CSS/media remain independently cacheable. Test cache MISS/HIT/BYPASS behavior and downstream caches, not only the origin.

SELECTED SCENE PROFILE: Scene-bearing dynamic HTML uses per-response nonce/header/trusted tags and no shared HTML/ISR cache. Run authoritative batched eligibility before HTML or metadata delivery. Genuinely non-sensitive shells/static assets remain separate hash/static profiles.

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

## 13. Hashes

For static/cacheable HTML, build computes SHA-256/384/512 over exact inline bootstrap bytes; its manifest/header/HTML are one immutable release. A changed byte forces a new hash and matching policy deployment. An approved hashed bootstrap can load only fixed build-manifest script URLs; user content never supplies these values.

External script hash authorization requires supported integrity/CSP matching; set corresponding integrity metadata and test actual browsers. A bare hash of an external URL is not executable trust. Prefer a small fixed hashed inline bootstrap where suitable. CI validates every emitted root/hash and tests cacheable HTML against its exact version, avoiding stale header/body mismatch.

## 14. strict-dynamic

With strict-dynamic, nonce/hash-trusted scripts can create non-parser-inserted dependency scripts; supporting browsers disregard host/scheme/self script source allowlists for that execution check [S01, S04]. Therefore the Source Registry remains governance, not a runtime hostname fence under strict-dynamic.

Audit every dynamic insertion path and bundle/import behavior; never accept an attacker-controlled URL. Adulis does not add https: or unsafe-inline compatibility fallback merely for obsolete browsers. Validate supported-browser fallback behavior separately; if a required browser cannot enforce the selected strategy, block rollout or use a reviewed equivalent strict strategy.

## 15. default-src

| Directive decision | Policy |
| --- | --- |
| Target value | 'none' |
| Adulis boundary | Deny fetch classes unless explicitly allowed. It is not a fallback for base-uri, frame-ancestors or form-action; declare those separately. |
| Verification | Test an omitted fetch class and explicitly denied plugin/frame/form destinations. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 16. script-src

| Directive decision | Policy |
| --- | --- |
| Target value | nonce/hash trusted roots; optional audited 'strict-dynamic' |
| Adulis boundary | No production wildcard, unsafe-inline or unsafe-eval in target. Explicit script-src-attr none blocks handlers; do not introduce script-src-elem that accidentally bypasses root policy. |
| Verification | Correct root loads; wrong nonce, injected handler and untrusted script block. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 17. style-src

| Directive decision | Policy |
| --- | --- |
| Target value | 'self' plus nonce/hash for required style elements |
| Adulis boundary | External CSS preferred. style-src-attr none is target; nonce does not authorize a style attribute. A temporary attribute requirement needs surface-specific documented exception, expiry and migration, never unsafe scripts. |
| Verification | Framework/CSS-in-JS compatible behavior and injected style are tested separately. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 18. img-src

| Directive decision | Policy |
| --- | --- |
| Target value | 'self' and exact approved media origin |
| Adulis boundary | Only validated Media/CDN content. Permit blob: for a reviewed preview on that surface only; data: only with documented need. No arbitrary Seller remote URL or blanket https:. |
| Verification | Product/Scene images load; attacker image/exfiltration origin blocks. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 19. connect-src

| Directive decision | Policy |
| --- | --- |
| Target value | 'self' plus exact API/upload/Sentry/realtime origins |
| Adulis boundary | Only actual browser connections; server PSP webhook does not require browser connect permission. WebSockets require explicitly tested scheme/origin; CORS remains separate. |
| Verification | Approved fetch/telemetry/upload works; unknown endpoint blocks. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 20. font-src

| Directive decision | Policy |
| --- | --- |
| Target value | 'self' |
| Adulis boundary | Self-host approved fonts. External font origin is a separate privacy/resource dependency, not inherited from styles. |
| Verification | Fonts render with unknown origin denied. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 21. object-src

| Directive decision | Policy |
| --- | --- |
| Target value | 'none' |
| Adulis boundary | No plugin/Flash architecture. Evidence/PDF viewing needs a safe reviewed viewer/isolation approach, not a general object exception. |
| Verification | Object/embed plugin attempts are denied. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 22. base-uri

| Directive decision | Policy |
| --- | --- |
| Target value | 'none' |
| Adulis boundary | Trusted application templates must not require base injection. If legitimate base behavior exists, review narrow self only. |
| Verification | Injected base cannot change script/navigation resolution. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 23. frame-ancestors

| Directive decision | Policy |
| --- | --- |
| Target value | 'none' |
| Adulis boundary | All four web surfaces default to non-embeddable; sensitive consoles never framed. This is independent of frame-src and requires response header, not meta [S05]. |
| Verification | Cross-origin and nested hostile framing fail. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 24. frame-src

| Directive decision | Policy |
| --- | --- |
| Target value | 'none' |
| Adulis boundary | Only route-scoped reviewed provider frame exceptions; no global TikTok/PSP permission. Sandbox/permissions/referrer govern additional risk. |
| Verification | Unknown frame denied; approved Product-only exception tested. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 25. form-action

| Directive decision | Policy |
| --- | --- |
| Target value | 'self' |
| Adulis boundary | Explicit on every surface; provider destination only if actual browser form POST is required. Top-level navigation/redirect validation is independent. |
| Verification | Injected external form blocks; approved workflow succeeds. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 26. worker-src

| Directive decision | Policy |
| --- | --- |
| Target value | 'none' unless approved worker/PWA then 'self' |
| Adulis boundary | Seller PWA/service worker source must be reviewed, same-origin scope and version/cleanup tested. No blob worker wildcard by default. |
| Verification | Unknown worker denied; approved scope cannot cache nonce HTML. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 27. manifest-src

| Directive decision | Policy |
| --- | --- |
| Target value | 'self' if manifest exists, otherwise 'none' |
| Adulis boundary | Record actual PWA need per surface; manifest cannot expand script/worker authority. |
| Verification | Approved manifest loads and remote manifest fails. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 28. media-src

| Directive decision | Policy |
| --- | --- |
| Target value | 'none' |
| Adulis boundary | Adulis For You is photo-only Scene Posts. Optional external Product embed plays within its reviewed provider frame; it does not authorize native FYP video. |
| Verification | No FYP video/resource regression; exceptions isolated. |

Any relaxation is versioned, surface/environment/purpose scoped and linked to an active registry entry, Security/Privacy assessment and tested removal/rollback. Unknown production origin/capability is a build/launch blocker.

## 29. Company Website Policy

| Policy field | Current baseline |
| --- | --- |
| Identity | CSP-PUBLIC-WEB / Company Website |
| Executable / caching | Static hash profile preferred if actual deployment is static; nonce SSR only with per-response safe cache rules. |
| Necessary resources | Self-host script/CSS/font; actual API for waitlist only; marketing scripts absent unless reviewed. |
| Exceptions / exclusions | No workers/manifest by default; no third-party frames. |
| Shared floor | default-src none; object-src none; base-uri none; frame-ancestors none; explicit script/style/img/connect/font/frame/form/worker/manifest/media. |

Resolved deployment origins and current source evidence are required before a release can be approved. Appendix A provides non-production examples; no sample hostname is treated as live configuration. Test every authentication, error, static, public and post-deployment document path, not only the homepage.

## 30. Storefront Policy

| Policy field | Current baseline |
| --- | --- |
| Identity | CSP-STOREFRONT / Seller Storefront |
| Executable / caching | Static hash or nonce profile matching real rendering. |
| Necessary resources | Validated Product/Scene CDN images and Adulis API; no Seller HTML/JS. |
| Exceptions / exclusions | Default no frames/media; Product detail embed exception only if separately activated. |
| Shared floor | default-src none; object-src none; base-uri none; frame-ancestors none; explicit script/style/img/connect/font/frame/form/worker/manifest/media. |

Resolved deployment origins and current source evidence are required before a release can be approved. Appendix A provides non-production examples; no sample hostname is treated as live configuration. Test every authentication, error, static, public and post-deployment document path, not only the homepage.

Cache genuinely non-sensitive static shells and permitted immutable image/static assets only. Scene-bearing data/HTML/caption/title/card/meta bypasses full-page/data CDN caching, ISR and stale-while-revalidate unless the authoritative decision still runs before every delivery. Dynamic nonce HTML uses the existing fresh per-response CSP nonce profile and no shared HTML cache; static asset policies stay compatible. Already delivered bytes, in-flight responses and external screenshots/copies cannot be recalled. Authorized Seller-private and case-scoped Operator access are separately authenticated.

## 31. Seller Console Policy

| Policy field | Current baseline |
| --- | --- |
| Identity | CSP-SELLER-CONSOLE / Seller Console |
| Executable / caching | Strict roots; strongest compatible style policy and no shared nonce HTML cache. |
| Necessary resources | Current Seller API, canonical Media/upload endpoint and configured scrubbed Sentry if browser enabled. |
| Exceptions / exclusions | No payment/TikTok/social widgets; reviewed same-origin PWA worker/manifest only if present. |
| Shared floor | default-src none; object-src none; base-uri none; frame-ancestors none; explicit script/style/img/connect/font/frame/form/worker/manifest/media. |

Resolved deployment origins and current source evidence are required before a release can be approved. Appendix A provides non-production examples; no sample hostname is treated as live configuration. Test every authentication, error, static, public and post-deployment document path, not only the homepage.

## 32. Operator Console Policy

| Policy field | Current baseline |
| --- | --- |
| Identity | CSP-OPERATOR-CONSOLE / Operator Console |
| Executable / caching | Strict roots; no risky dynamic loaders; no shared sensitive HTML cache. |
| Necessary resources | Privileged API, minimal safe evidence/media viewer and scrubbed Sentry only where approved. |
| Exceptions / exclusions | No frames, third-party widgets/advertising/payment/social; worker/manifest none unless explicit assessment. |
| Shared floor | default-src none; object-src none; base-uri none; frame-ancestors none; explicit script/style/img/connect/font/frame/form/worker/manifest/media. |

Resolved deployment origins and current source evidence are required before a release can be approved. Appendix A provides non-production examples; no sample hostname is treated as live configuration. Test every authentication, error, static, public and post-deployment document path, not only the homepage.

## 33. Payment Provider Integration

Chapa is the first named Ethiopia PSP only where activated and production configuration verifies it. Top-level redirect/navigation normally needs validated destination/return URI, not global script/frame/connect permission. CSP is not a general navigation allowlist and cannot validate provider server callbacks.

For a genuinely required provider iframe/API/form, capture official required origins and staging requests, record data/privacy assessment and permit exactly that directive on Checkout route only. No console payment frame. Match allowed return state server-side; navigation never establishes PAID. Pending origin requirements remain OPEN rather than guessed or wildcarded.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 34. TikTok / Instagram Integration

TikTok/Instagram Seller social control uses reviewed authorization redirect/pop-up and backend callback validation. Minimum scopes/state/PKCE/CSRF/replay and ordinary Account context remain Onboarding/Auth concerns. A top-level authorization flow does not automatically need provider script/frame permission.

Registry distinguishes browser API/script/frame/form resource from navigation and server adapter. No social passwords or general inbox access; DM fallback reviews minimal sender/challenge evidence through a separate Operator. Provider/pop-up COOP and referrer behavior is tested; arbitrary cross-origin isolation headers cannot silently break OAuth.

Official-page DM proves approved selected account-control evidence only; it grants no OAuth scope, video query/ownership capability or provider approval. Keep TikTok videos external and Product-only. Ownership-dependent embeds require actual approved supported account/token/scopes and current wrong-owner/private/deleted/revoked checks; fail closed to safe placeholder/link without breaking an independent valid admission path. No TikTok native FYP/Scene video, password/inbox harvesting or session creation.

## 35. TikTok Embed

Optional TikTok embed is Product Post detail only after product/privacy/security approval. Exact provider frame/script origins and disclosures must come from official integration evidence and staging capture; they are VERIFY PRODUCTION CONFIGURATION, not invented here. Prefer a safe external link/placeholder until activated.

No embed on For You Scene feed, Seller Console or Operator Console by default. Use reviewed sandbox/allow/referrer attributes compatible with the provider; restrict parent navigation and browser permissions. Assess IP/referrer/cookie/storage disclosure and legal notice/consent implications. A feature flag removes the embed/resources; provider failure degrades to link without widening CSP.

## 36. R2 / CDN / Media

Media accepts validated uploads, sanitized Sharp image derivatives and canonical R2/CDN bindings. Separate user-uploaded media host from executable build assets where possible; never allow SVG/HTML/script payload to acquire trusted root privilege. img-src grants loading, not content safety.

Direct browser upload uses the exact signed-upload endpoint only on an approved upload surface; keep URL credentials out of reports/logs/referrers. Private Claim/export/evidence objects remain authorized/no-store and cannot be made public by CSP. Content serving denies PRIVATE Scenes despite historical bytes. Review download disposition, object preview revocation and short signed-URL expiry independently.

## 37. Sentry

Bundle the approved Sentry browser SDK with trusted Adulis assets. If enabled, permit only the actual configured ingestion origin under connect-src; no Sentry script-src expansion merely because events are sent [S11]. Regions/DSNs/project and capture settings are verified, not guessed.

Broad Pino/Sentry telemetry contains no OTP/digest, session/refresh token, raw QR, signing key, provider credential/signature/raw financial body, KYC document, Chat body, Claim evidence, delegate name/phone, push token or precise GPS/address. URL queries/fragments and dynamic private paths are removed before transport. Restricted evidence/audit repositories remain purpose-scoped and separately governed.

Prefer Adulis minimized report ingress before any Sentry forwarding. Raw CSP body, original policy/nonce and full private URL must not reach a third-party security-report receiver by default. Native Sentry and browser CSP are separate concerns; reporting failure does not remove enforcement.

## 38. User-Generated Content

Product descriptions, Scene captions, Seller bios, Chat/Claim text and filenames render as escaped text/safe components. No user-provided script/style attributes, executable HTML, arbitrary href/remote resource or automatically assigned nonce. React escaping is preserved; raw HTML sinks are prohibited unless a dedicated reviewed sanitizer policy is justified.

Approved rich text uses structural allowlists and reviewed URI schemes; validation is not delegated to CSP. Claim file preview uses isolated safe media rendering with purpose authorization, no unrestricted object-src or user HTML on the privileged origin. CI negative fixtures cover all Adulis UGC sources.

## 39. Trusted Types

Trusted Types is an additional DOM-sink control to evaluate on sensitive consoles, not an automatic cross-browser launch blocker. Start with inventory/Report-Only where supported, identify dangerous sinks, define narrow reviewed policies and test framework/library compatibility before enforcement.

No default policy that simply returns unsanitized input. If supported enforcement is chosen, it is versioned and tested with a safe fallback browser policy; CSP and server escaping remain regardless. Broad Trusted Types deployment is deferred until evidence supports it [S12].

## 40. Report-Only

![Candidate rollout preserves the enforced security floor](graphics/CSP_02.svg)
*Figure 02. Candidate rollout preserves the enforced security floor. Report-Only does not block resources and cannot replace the approved enforced baseline.*

Inventory -> local/CI -> staging Report-Only -> limited production Report-Only -> sensitive-console enforcement -> public enforcement -> remove exceptions. Candidate Report-Only emits observations without blocking; it must not be described as protection equivalent to enforcement.

For an already protected surface, keep last-approved enforced policy while evaluating a candidate. Urgent remediation may accelerate with Security approval and tests. Define candidate version, representative-route/browsers, violation triage and pass criteria; no fixed statutory duration is implied.

## 41. Enforcement

Use Content-Security-Policy HTTP header on every production browser document. Ensure static/SSR/error/auth/cache responses receive the correct surface release. The canonical builder/edge artifact is authoritative; HTML meta is not the core production control.

Multiple enforced policies intersect restrictions rather than an arbitrary override; duplicate edge/origin policies can unexpectedly block workflows [S03, S10]. Detect exact deployed policy count/digests and remove accidental duplicates. A candidate can use Report-Only alongside the approved enforced baseline. Enforcement failure is a release blocker; reporter failure is degraded visibility.

## 42. Reporting

Use Reporting-Endpoints to name a same-origin HTTPS minimized ingress and report-to to reference the name; test supported browser delivery [S06, S08]. A reviewed report-uri compatibility path may receive legacy application/csp-report only if needed; do not infer missing reports mean no violations.

```
Reporting-Endpoints: csp="https://web.adulis.example/csp-reports/v1"
Content-Security-Policy: ...; report-to csp
// Example hostname only; resolve actual per-surface origin.
// Optional tested legacy path: report-uri /csp-reports/v1
```

Do not enable report-sample by default. Reports may expose URL/policy/nonces even without explicit samples, so normalize before storage or forwarding. Distinguish enforce vs report-only disposition and registry policy/release version without embedding user IDs in endpoint paths.

## 43. Report Ingestion

![Untrusted reports become minimized bounded security observations](graphics/CSP_03.svg)
*Figure 03. Untrusted reports become minimized bounded security observations. Reporting outages degrade visibility while browser enforcement continues.*

| Report endpoint contract | Proposed implementation baseline |
| --- | --- |
| Route / input | POST /csp-reports/v1; public unauthenticated observation only. Accept bounded application/reports+json and optional legacy application/csp-report. |
| Limits | Engineering starting limits: 64 KiB body, 50 records/batch, nested depth 8; edge and @nestjs/throttler rate budgets by source/surface, global capacity cap. Validate in load tests. |
| Validation | Allowlist supported fields/types; reject malformed/oversized content cheaply; unknown fields discarded. No file upload, HTML reflection, URL fetching or business action. |
| Normalize before transport | Strip query/fragment/full dynamic path, sample/referrer/nonce-bearing original policy, credentials and user/order IDs. Reduce origin to approved-source ID or bounded UNAPPROVED/EXTENSION/INLINE category. |
| Trusted attribution | Surface/policy/release inferred from approved route/config and normalized declaration; body is untrusted. Mismatch bucket never changes policy or authorization. |
| Storage / flow | Bounded normalized security observation; aggregation/dedup/backpressure. Use existing approved telemetry path or coarse BullMQ job only if durable processing is required. |
| Responses | 204 accepted/dropped valid observation; 400 malformed, 413 oversized, 415 unsupported, 429 rate limited, safe 503 capacity. No body reflection; no-store. |
| Abuse / failure | Spoofed reports cannot directly page without corroboration or mutate. Reporting failure never blocks page execution; enforcement continues. |

Disable raw request/body logging on this route, including edge/access logs where configurable. IP/network rate metadata is purpose-bound and short-lived; do not persist a fingerprint. Any mandatory retained observation and intent uses current PostgreSQL/approved Eventing, not a new engine.

## 44. Privacy

CSP report is security/operational personal data where URL/browser/network context can link to a person. ADU-PRV-01 owns policy IDs, trigger CREATED_AT, bounded retention, access/export/deletion and processor inventory. No arbitrary retention day count is invented.

Source registry third-party disclosures feed the DPIA/processor register. Strip all query/fragment, private route identifiers, samples, original policy/nonces and PII before Sentry/Pino/storage. Aggregate reports reduce linkage; pseudonymous diagnostic refs remain restricted. No CSP allowlist is a transfer/legal consent approval.

## 45. Observability

ADU-OBS-01 receives bounded counts by surface, policy version, disposition, directive, release and blocked-origin category. Unique signature uses only normalized approved categories, not attacker-controlled URL strings. Limit active release labels/window and collapse expired values to avoid unbounded cardinality.

Actual response-header synthetic checks are independent of untrusted report volume. Dashboards compare release spikes, reporting rejection/drops, mode and header digest mismatch. Sentry identifies page errors/performance with scrubbed context; Audit proves privileged policy changes; Analytics does neither.

## 46. Alerting

| Signal | Confirm / respond |
| --- | --- |
| Operator/Seller header absent or framing weakened | Actual edge/browser response proof; immediate Security owner and last-approved enforced rollback. |
| Wildcard/unsafe-inline script/unsafe-eval regression | CI/effective policy diff; reject release, or contain deployed route if missed. |
| Unexpected executable origin / XSS-like spike | Corroborate normalized reports with build/config and safe browser reproduction; contain suspicious content/source. |
| New mass enforced violations | Assess user impact by release/surface; rollback compatible enforced candidate, no wildcard repair. |
| Reporter flood / unavailable | Rate/size/backpressure mitigation; preserve enforcement and safe diagnostic health. |

Every page-worthy alert has current primary/backup owner, stable runbook and safe query. Browser observations alone do not prove exploitation; extension/noise categories do not erase a missing-header regression.

## 47. Incident Operations

CSP-RB-01: capture release/policy/surface and minimal safe reproduction; declare severity by exposure/user impact. Disable affected embed/script/route, revoke compromised bundle/source as necessary and restore last-approved enforced policy. Preserve typed deployment Audit and restricted evidence; no raw payload dump.

If candidate enforcement broke a legitimate flow, retain the prior enforced security floor while candidate returns to Report-Only. Never broaden wildcard/eval/inline or remove frame-ancestors as an emergency default. Verify Product images, login, Seller operations, Operator action/audit, Checkout navigation and report ingress before reopen. Suspected personal-data exposure starts Privacy/legal awareness workflow; corrective test/owner/due date closes the incident.

## 48. CSP Deployment

Build one immutable surface/environment artifact containing directives, approved-source version, exact script hashes or nonce profile, policy digest, diagnostic version and rollback reference. Validate configuration at deploy; unknown origins, placeholder hashes, missing approval or incompatible rendering fail closed for release.

Headers are applied by the actual HTML-serving layer, not assumed from REST API Helmet. Cover redirects where relevant, final documents, errors/auth pages, CDN cache variants and service-worker caches. Publish diagnostic policy version/digest without nonce/secrets. Retain previous compatible HTML/assets/header artifact for rollback; assets and headers cannot roll back independently into a mismatch.

## 49. Cloudflare

Cloudflare may deliver approved generated headers for static documents or preserve the origin-rendered nonce header. It must not independently invent a second policy. Disable unexpected automatic executable transformations such as loaders unless explicitly inventoried/tested [S10].

Nonce-bearing HTML bypasses shared cache; do not cache header nonce while rewriting only body or vice versa. Hash/static HTML may cache immutable paired policy/build versions. CI plus production synthetic validates final edge headers and resource behavior after transformations; no new edge runtime is mandated.

## 50. Helmet

@fastify/helmet supplies security headers on NestJS/Fastify-hosted browser responses where applicable [S09]. Configure its CSP from the canonical generated profile and trusted response nonce context, using supported current API rather than duplicate manual defaults.

Independently hosted Company Website/Console/Storefront HTML requires its own deploy/edge header artifact. A CSP on a JSON API response does not secure an HTML document served elsewhere. Test Helmet/global hooks, error routes and reverse proxy; never assume one NestJS stack hosts all web documents.

## 51. CI/CD

| Fitness gate | Required fail/review behavior |
| --- | --- |
| Forbidden production source | Wildcard script, unsafe-eval, target script unsafe-inline, arbitrary third-party origin -> build failure. |
| Sensitive floor weakened | object/base/frame-ancestors/form/core directive removed/loosened -> Security approval plus tests; default rejection. |
| Registry mismatch | New source lacks purpose/surface/data/owner/review/active-provider record -> failure. |
| Root/header build mismatch | Nonce generator/pair/cache or hash manifest/HTML mismatch -> failure. |
| Effective deployment | CSP absent/duplicated or wrong mode/policy at CDN/auth/error routes -> failure. |
| Dev leakage | localhost/HMR/eval/ws/broad schemes in production -> failure. |
| Privilege / privacy | Missing typed approval/Audit or raw report/nonce transport -> failure. |

Jest validates builder/schema/determinism and policy floor; Playwright verifies actual browser execution/blocking. GitHub Actions ties artifact/security tests to immutable release; dependency-cruiser prevents source/policy authority leaking into business/user repositories.

Every NEW controlled Scene-bearing HTML/JSON, list/card, direct link and social-metadata response runs a batched authoritative eligibility decision BEFORE delivery. Read current Product availability and independent Content publication/visibility, Seller, Market, Moderation and Media gates from owner readers; asynchronous projection or cached eligibility bit cannot authorize. Last available tag loss denies new public delivery even while Content projection/purge jobs lag. On owner-read/origin failure, deny/omit Scene payload and return a safe unavailable response; do not serve stale sensitive content.

Cache genuinely non-sensitive static shells and permitted immutable image/static assets only. Scene-bearing data/HTML/caption/title/card/meta bypasses full-page/data CDN caching, ISR and stale-while-revalidate unless the authoritative decision still runs before every delivery. Dynamic nonce HTML uses the existing fresh per-response CSP nonce profile and no shared HTML cache; static asset policies stay compatible. Already delivered bytes, in-flight responses and external screenshots/copies cannot be recalled. Authorized Seller-private and case-scoped Operator access are separately authenticated.

## 52. Testing

| Test ID / case | Expected evidence |
| --- | --- |
| CSP-TEST-001 Expected trusted root | Approved scripts execute in all supported tested browsers. |
| CSP-TEST-002 Injected inline script | Side-effect sentinel remains unchanged. |
| CSP-TEST-003 Wrong/missing nonce | Injected/root without correct current trust blocked. |
| CSP-TEST-004 Correct nonce | Server-owned root executes; nonce never applied to UGC. |
| CSP-TEST-005 Inline handler | onclick/javascript: fixture blocked with no unsafe fallback. |
| CSP-TEST-006 Network exfiltration | Unknown API/WebSocket origin cannot receive browser request. |
| CSP-TEST-007 Framing | Unauthorized child frame blocked; hostile parent cannot frame console. |
| CSP-TEST-008 Form injection | External form cannot submit; approved self flow works. |
| CSP-TEST-009 Product/Scene media | Canonical images load and private Content gate still denies. |
| CSP-TEST-010 Optional embed | Only approved Product route works; disabled and both consoles deny. |
| CSP-TEST-011 Sentry | Configured scrubbed ingest works without extra executable permission. |
| CSP-TEST-012 Checkout/social redirect | Valid navigation works; server callback/state authority independent. |
| CSP-TEST-013 Nonce entropy/uniqueness | Distinct adequate random values across origin and edge responses; no URL/log nonce. |
| CSP-TEST-014 Cache/header binding | Nonce HTML never shared; hash release/header/body match on cache hits. |
| CSP-TEST-015 Static/Error/auth documents | Every relevant final response carries correct enforced floor. |
| CSP-TEST-016 Reporter abuse | Malformed/oversized/spoofed flood cheap; no reflection/mutation/raw logging. |
| CSP-TEST-017 Minimization | Query/fragment/sample/private IDs/original policy discarded before transport. |
| CSP-TEST-018 Reporter outage | Page/enforcement continue; diagnostic alert appears. |
| CSP-TEST-019 Policy downgrade | CI rejects wildcard/eval/inline/framing exception. |
| CSP-TEST-020 Rollback | Prior compatible enforced artifact restored; flows/security tests pass. |

Jest covers deterministic pure policy/build logic; Playwright uses server and receiver sentinels to prove blocked execution/network/form effects, not merely console text. Test Chromium/Firefox/WebKit plus approved device webviews; exact supported-browser matrix is an outstanding release decision. Privacy redaction fixtures include URLs with tokens, Order IDs, delegate contact and malicious report nesting.

## 53. Failure Behavior

| Failure | Safe behavior |
| --- | --- |
| Invalid production policy/source config | Release blocked; existing last-approved enforced policy remains. |
| CSP violation | Browser blocks resource/action according to policy; no server business mutation. |
| Report endpoint down/flooded | Backpressure/drop and alert; page continues, enforcement remains. |
| Provider embed down | Safe link/placeholder; no broader script/frame permissions. |
| Nonce generation/header pairing failed | Do not emit insecure document; controlled safe error response with security floor. |
| Hash/HTML release mismatch | Abort/revert paired artifact; do not permit inline execution to recover. |
| Cloudflare/origin policy duplicate | Detect and fix source-of-truth delivery; policies do not overwrite by intuition. |

## 54. Security Headers

| Complementary header/control | Adulis integration |
| --- | --- |
| Strict-Transport-Security | Approved HTTPS policy; max-age/subdomain/preload rollout requires verified domain ownership and readiness. |
| Referrer-Policy | Target no-referrer on sensitive/provider/external navigation paths; approved public default may be strict-origin-when-cross-origin after privacy review. Never leak private query/path. |
| X-Content-Type-Options | nosniff; correct safe MIME/disposition, especially user uploads. |
| X-Frame-Options | DENY compatibility alongside frame-ancestors none where compatible; not the modern sole policy. |
| Permissions-Policy | Deny microphone/geolocation/camera by default on consoles; exact reviewed web feature only. Native permissions separate. |
| COOP / COEP / CORP | Deploy only with reviewed popup/PSP/social/media compatibility and isolation need. Do not mandate values that break actual browser flows. |
| Navigation / downloads | Validate return destinations/app links; rel=noopener and appropriate noreferrer; signed download access/no-store/expiry. |

These controls complement CSP; CORS, cookies, CSRF and server authorization remain separate. No CSP expression turns a Mobile deep link into business permission.

## 55. Browser Compatibility

Supported browsers must be an explicit product/release matrix, not all historical browsers. Test nonce/hash/module/dynamic scripts, frame/form/connect/worker behavior and report transport in Chromium, Firefox, WebKit and any shipped WebView. Reporting is best effort with compatibility differences [S03-S08]; enforcement is verified independently.

Legacy child-src/report-uri fallback is permitted only for a demonstrable supported-client need and cannot dilute the modern target. No blanket https:/unsafe-inline fallback for obsolete browsers. Record browser capability exceptions, expiry and alternate protected flow; Trusted Types is optional where unsupported.

## 56. MVP Scope

MVP includes reviewed Source Registry, four policies, nonce/hash strict trust, header delivery, staged Report-Only/enforcement, minimized reports and abuse limits, Pino/Sentry/OBS integration, Playwright/Jest CI, edge/cache verification, rollback/runbook and actual needed provider/media exceptions. Only approved current runtime facilities are used; policy config can be version-controlled files.

## 57. Deferred Scope

Deferred unless separately justified: broad Trusted Types enforcement, dedicated CSP SaaS/SIEM, complex auto-generation, extension monitoring, arbitrary marketing/ads, global future-provider sources, native FYP video and new runtime packages. Future biometrics/Government-ID/Creator/AI advice processing requires separate product/privacy approval, not a CSP source addition.

## 58. Invariants

CSP-INV-001 Every production browser surface sends an approved CSP header.

CSP-INV-002 Operator Console never permits arbitrary third-party scripts.

CSP-INV-003 Seller Console never permits arbitrary third-party scripts.

CSP-INV-004 Production script policy never uses wildcard source.

CSP-INV-005 unsafe-eval is prohibited absent a separately approved temporary Security exception; launch target excludes it.

CSP-INV-006 Script unsafe-inline is prohibited in the target enforced policy.

CSP-INV-007 Nonce is unique per response and cryptographically unpredictable.

CSP-INV-008 Nonces never enter ordinary logs or Analytics.

CSP-INV-009 object-src is none by default.

CSP-INV-010 Sensitive consoles cannot be framed.

CSP-INV-011 form-action is explicitly restricted.

CSP-INV-012 Third-party origins require purpose, owner and review.

CSP-INV-013 TikTok embed permission is surface/route specific.

CSP-INV-014 PSP permissions match only actual Checkout browser capability.

CSP-INV-015 Report endpoint cannot become XSS/reflection or business-mutation surface.

CSP-INV-016 Reports are minimized before transport/storage.

CSP-INV-017 Report-Only cannot be mistaken for enforcement.

CSP-INV-018 Development exceptions cannot propagate into production.

CSP-INV-019 CSP cannot authorize a business action.

CSP-INV-020 CSP does not replace server authorization or sanitization.

CSP-INV-021 Policy versions are auditable and deployment-linked.

CSP-INV-022 Sensitive-console weakening triggers review/alert.

CSP-INV-023 User content cannot define executable code.

CSP-INV-024 Report retention is bounded and Privacy-governed.

CSP-INV-025 CSP allowlist alone is not privacy/legal approval.

## 59. Implementation Sequence

| Phase | Required output / exit |
| --- | --- |
| 0 Resource inventory | Actual four surfaces, hosting/browser floor and resource request traces. |
| 1 Registry | Owner/purpose/data/privacy/source evidence and active-provider decisions. |
| 2 Builder | Deterministic four profiles, nonce/hash/cache mechanism and immutable artifact. |
| 3 Local / staging | Jest and Playwright negative/positive tests; Report-Only triage. |
| 4 Production candidate | Limited Report-Only observations with prior enforced floor where present; safe privacy ingress. |
| 5 Console enforcement | Strong Operator/Seller enforced profiles and framing/rollback proof. |
| 6 Public enforcement | Company/Storefront and only needed route exceptions; edge validation. |
| 7 Tightening | Remove expired style/provider/dev exceptions; review third-party risk. |
| 8 Hardening | CI fitness, current monitors/runbook and repeat tests on change. |

## 60. Production Launch Gate

Launch is blocked for any production web surface without evidence for its approved enforced profile.

• Actual surfaces/origins/browser floor and third-party processor/permission registry verified.

• No wildcard/eval/target script unsafe-inline; console framing denied; all core directives addressed.

• Nonce entropy/pair/uniqueness and no shared-cache reuse, or exact hash/build/header/HTML consistency proven.

• UGC escape/sanitization and dependency loaders reviewed; TikTok/payment/social exceptions minimal and activated only where needed.

• Sentry and CSP reports scrubbed; size/rate/schema/flood tests and bounded policy retention pass.

• Playwright positive/negative XSS/form/frame/network/media/provider tests pass in supported matrix.

• Final Cloudflare/application/error/auth/static/cache responses carry correct policy/mode/version without accidental duplicates.

• Privileged policy approval/Audit, current OBS signal and last-approved enforced rollback/runbook tested.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 61. Final Architecture Diagram

![One approved browser policy per actual HTML surface](graphics/CSP_04.svg)
*Figure 04. One approved browser policy per actual HTML surface. Native React Native is outside CSP enforcement; its browser/WebView flows are assessed separately.*

![Untrusted reports become minimized bounded security observations](graphics/CSP_05.svg)
*Figure 05. Untrusted reports become minimized bounded security observations. Reporting outages degrade visibility while browser enforcement continues.*

The immutable builder/config controls what the browser may execute/load. Minimized observations return to existing operational visibility; untrusted reports cannot alter policy, principal or commerce. Privacy/DPIA reviews govern transmitted data and processor activation independently.

## 62. Engineering Doctrine

Executable trust is explicit. A registry is governance; strict-dynamic is runtime trust propagation and must be audited. One authoritative policy artifact drives every serving layer. Security floor survives failures and emergency rollback. Keep native/browser, navigation/resource, privacy/allowlist and observation/authority distinctions precise.

## 63. Appendix A - Four Policy Examples & Build Profiles

NON-PRODUCTION EXAMPLES: .example names and nonce/hash tokens are reserved placeholders, never live Adulis origins. The production builder must reject unresolved placeholders. These examples define the security shape; actual approved registry/hosting evidence resolves resources.

### CSP-PUBLIC-WEB / nonce-rendered variant

```
default-src 'none';
script-src 'nonce-{RESPONSE_NONCE}'; script-src-attr 'none';
style-src 'self' 'nonce-{RESPONSE_NONCE}'; style-src-attr 'none';
img-src 'self';
connect-src 'self' https://public-api.adulis.example;
font-src 'self'; object-src 'none'; base-uri 'none';
frame-ancestors 'none'; frame-src 'none'; form-action 'self';
worker-src 'none'; manifest-src 'none'; media-src 'none';
report-to csp
```

### CSP-STOREFRONT / nonce-rendered variant

```
default-src 'none';
script-src 'nonce-{RESPONSE_NONCE}'; script-src-attr 'none';
style-src 'self' 'nonce-{RESPONSE_NONCE}'; style-src-attr 'none';
img-src 'self' https://media.adulis.example;
connect-src 'self' https://api.adulis.example;
font-src 'self'; object-src 'none'; base-uri 'none';
frame-ancestors 'none'; frame-src 'none'; form-action 'self';
worker-src 'none'; manifest-src 'none'; media-src 'none';
report-to csp
```

### CSP-SELLER-CONSOLE / approved PWA variant

```
default-src 'none';
script-src 'nonce-{RESPONSE_NONCE}'; script-src-attr 'none';
style-src 'self' 'nonce-{RESPONSE_NONCE}'; style-src-attr 'none';
img-src 'self' https://media.adulis.example;
connect-src 'self' https://api.adulis.example;
font-src 'self'; object-src 'none'; base-uri 'none';
frame-ancestors 'none'; frame-src 'none'; form-action 'self';
worker-src 'self'; manifest-src 'self'; media-src 'none';
report-to csp
```

### CSP-OPERATOR-CONSOLE / nonce-rendered variant

```
default-src 'none';
script-src 'nonce-{RESPONSE_NONCE}'; script-src-attr 'none';
style-src 'self' 'nonce-{RESPONSE_NONCE}'; style-src-attr 'none';
img-src 'self' https://media.adulis.example;
connect-src 'self' https://ops-api.adulis.example;
font-src 'self'; object-src 'none'; base-uri 'none';
frame-ancestors 'none'; frame-src 'none'; form-action 'self';
worker-src 'none'; manifest-src 'none'; media-src 'none';
report-to csp
```

Default examples omit Sentry/upload/provider origins. Add only exact active approved registry sources under the required directive; no frame/script permission follows automatically from an OAuth/payment redirect. Seller worker/manifest self variant is used only if that PWA capability is approved; otherwise none.

### Static/hash-rendered build variant

```
script-src 'sha256-{EXACT_BUILD_BOOTSTRAP_HASH}' 'strict-dynamic';
script-src-attr 'none';
style-src 'self'; style-src-attr 'none';
```

Replace the nonce script/style expressions with this reviewed static strategy and a fixed trusted hashed bootstrap whose script URLs are immutable build-manifest values. Keep every other explicit floor directive. strict-dynamic is optional and only for audited dynamic roots; hash-only individual authorization is acceptable if browser/framework tests pass. External roots require corresponding supported integrity treatment. Never combine stale HTML with a different policy version.

## 64. Appendix B - Approved-Source Schema & Builder Contract

```
type Surface = 'PUBLIC_WEB' | 'STOREFRONT'
 | 'SELLER_CONSOLE' | 'OPERATOR_CONSOLE';
type PolicyMode = 'REPORT_ONLY' | 'ENFORCED';
interface ApprovedSource {
 sourceId: string; origin: string; directives: string[];
 surfaces: Surface[]; routeTemplates: string[];
 environment: 'staging' | 'production';
 purpose: string; dataAccessClass: string; dataTransmitted: string[];
 thirdParty: boolean; processorReviewRef?: string;
 ownerRole: string; approvalRef: string; reviewAt: string;
 activeProviderRouteRef?: string; active: boolean;
}
buildPolicy(surface, environment, deployment, trustedRenderContext):
 -> validate floor and immutable registry/build references
 -> resolve only exact active approved resources
 -> inject current nonce OR build-produced hash expressions
 -> serialize deterministic directive order, no duplicate directive
 -> return header + public policy digest/version (never nonce log)
```

No policy source/update endpoint is exposed to ordinary Accounts. Builder tests reject CR/LF/header injection, non-HTTPS unreviewed origins, wildcard scripts, unknown tokens, expired approvals, missing browser evidence and mismatched nonce/hash rendering. Exception record includes exact surface/directive, risk, Security/Privacy approver, expiry/migration test and previous enforced baseline.

## 65. Appendix C - Test Catalogue & Release Evidence

CSP-TEST-001 through 020 in Section 52 are the required executable cases. Each release attaches test run/ref, artifact digest, browser/build versions, registry approval and effective edge-header proof. Cases test effects with inert sentinels/disposable receivers; never send real private data to an attacker URL.

Additional acceptance fixtures: cross-tenant UI content remains escaped; unsafe evidence filenames; module/chunk loader without user-controlled URL; expired PWA cache/header; OAuth popup under reviewed isolation headers; signed upload query scrub; unknown directive/report depth; duplicate enforced policy; obsolete HMR origin; approved exception expiry. A failed supported-browser case blocks affected surface release.

## 66. Appendix D - Stable Policy Errors & Report Codes

| Code | Meaning / outcome |
| --- | --- |
| CSP_POLICY_INVALID | Configuration/parser/floor failed; no deploy. |
| CSP_SOURCE_UNAPPROVED | Resource absent/inactive/expired in registry. |
| CSP_RENDER_TRUST_MISMATCH | Nonce/hash does not match trusted header/HTML release. |
| CSP_HEADER_MISSING | Actual document lacks required enforced header. |
| CSP_POLICY_DIGEST_MISMATCH | Edge/origin/version/duplicate profile mismatch. |
| CSP_REPORT_MALFORMED | Cheap schema reject; no reflection. |
| CSP_REPORT_TOO_LARGE | Body/batch/depth limit exceeded. |
| CSP_REPORT_RATE_LIMITED | Abuse/capacity controls triggered. |
| CSP_REPORT_PRIVACY_DROPPED | Sensitive fields discarded before transport. |
| CSP_REPORT_UNTRUSTED_OBSERVATION | Observation classification only; no automatic mutation. |

Codes remain bounded categories; arbitrary blocked URL/error text never becomes a label. External endpoint responses reveal no privileged data/config beyond safe status.

## 67. Appendix E - Primary Standards & Implementation References

| Reference | URL / verified scope |
| --- | --- |
| S01 W3C CSP3 | https://www.w3.org/TR/CSP/ |
| S02 Strict CSP / browser engineering | https://web.dev/articles/strict-csp |
| S03 CSP reference | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy |
| S04 Script trust | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src |
| S05 Framing | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors |
| S06 Reporting endpoint | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Reporting-Endpoints |
| S07 Style policy | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src |
| S08 report-to | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-to |
| S09 Fastify Helmet | https://github.com/fastify/fastify-helmet |
| S10 Cloudflare headers | https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/ |
| S11 Sentry CSP integration | https://www.sentry.help/en/articles/13965155-how-do-i-configure-my-content-security-policy-csp-to-allow-sentry |
| S12 Trusted Types | https://web.dev/articles/trusted-types |

Checked 8 October 2026. Official standards/browser/framework/provider sources inform the design; actual deployment and provider resources still require configuration/browser tests. Reference does not add a library or assert implementation. ADU-PRV-01, ADU-OBS-01 and ADU-DPIA-01 are governance/operational counterparts, not runtime origin permissions.

## 68. Glossary

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
