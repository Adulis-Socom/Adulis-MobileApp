# Adulis Observability & Reliability
Version 3.2 | 13 October 2026 | DOCUMENT-CORRECTED

## Document control

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R01. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026. |
| Source | ADU-OBS-01_Adulis_Observability_Reliability_Incident_Operations_Complete_System_Design_v3.1.pdf |
| Authority | 13 October contract prompt; selected 12 October owner decisions remain binding. |
| Status | DOCUMENT-CORRECTED; implementation, integration tests and external approvals not established. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |

## 1. Executive Summary

Adulis observes business correctness alongside latency, availability and infrastructure. A healthy API can still expose a PRIVATE Scene, leave a verified payment without its Order consequence, release paid stock, duplicate a Review Grant or resurrect a deleted subject. Read-only invariant monitors diagnose owner facts; repair uses owner commands.

Pino provides safe structured logs; Sentry provides supported error/performance/release visibility; pg_stat_statements and managed metrics diagnose PostgreSQL; Valkey/BullMQ and Cloudflare/R2 signals cover execution/media. No dedicated OpenTelemetry packages, Collector, Prometheus/Grafana/Loki/Tempo infrastructure or second monitoring platform is a launch dependency.

The small-team model preserves SLIs/SLOs, error budgets, impact-based severity, runbooks, incident command, rollback, kill switches, backup/restore drills and tested corrective actions. Numeric targets are PROVISIONAL - VALIDATE DURING PILOT/BETA. Integrity/security failures have no acceptable error budget.

## 2. Mission

Make it possible to answer, quickly and safely: Is Adulis functioning correctly? Who is affected?

Which change/dependency caused it? What can we safely degrade or disable? How do we recover without damaging data? How do we prove the incident will not recur?

## 3. Goals

• Define one structured logging schema and redaction policy.

• Preserve request/correlation/trace context through synchronous and asynchronous work.

• Monitor user-visible latency/availability and business correctness.

• Establish a small set of MVP SLIs/SLOs with pragmatic error budgets.

• Detect queue lag, stuck states, cross-domain consequence lag and security anomalies.

• Provide high-signal dashboards and actionable alerts with owner/runbook.

• Standardize incident roles, lifecycle, mitigation, rollback and post-incident review.

• Monitor PostgreSQL, Valkey/BullMQ, Cloudflare/R2, OTP and mobile health.

• Verify backups/restores and deployment health continuously.

• Keep observability privacy-minimized and cost-controlled.

## 4. Non-Goals

MVP does not build:

• a dedicated 24/7 NOC/SRE organization;

• hundreds of dashboards or thousands of alerts;

• self-hosted Prometheus/Grafana/Loki/Tempo just because they are common;

• service-mesh telemetry;

• full SIEM replacement;

• raw business analytics in operational telemetry;

• ordinary logs as a substitute for security audit;

• per-user/order/product IDs as metric labels;

• full request/response body capture;

• distributed tracing sampled at 100% indefinitely;

• automatic rollback without safety gates and human authority.

## 5. Product / Operational Context

Ethiopia is the initial active commerce Market, beginning with Addis Ababa. Future countries/providers require explicit legal, currency, commercial and operational activation. Locale, IP address, phone prefix and client country do not activate commerce. Actual provider routing and processing regions must be verified from production configuration.

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one current non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Multiple roles union permissions within that membership; ownership and Courier relationships do not consume the TEAM limit. Different humans use different Accounts.

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

Finance/Payments alone establishes canonical payment, refund and settlement facts from authenticated provider callbacks and/or backend verification matched to the exact attempt/reference, Seller Order, amount and currency. Client return navigation, Seller statements and screenshots never establish PAID. Checkout snapshots merchandise, delivery, the zero launch Adulis Buyer surcharge (0 bps), exact currency rounding, Buyer total and Commercial Policy version before explicit confirmation. Payment, provider settlement and physical receipt are independent.

Content owns Scene Post publication DRAFT/PUBLISHED/ARCHIVED separately from visibility PUBLIC/PRIVATE. A public Scene requires same-Seller eligible Product Post tags with at least one available Product, valid photo media/caption and current Seller, Market and safety gates. Loss of the last available tagged Product changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Eligible restock can restore PUBLIC after every current gate passes; it does not clear independent archive/moderation restrictions or require manual republishing solely for restock.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership. Store evidence basis and exact source/decision/version/correction lineage. Label failure feedback with a truthful verified paid-Order failure description and only authorized minimal remedy status; no phone, address, raw financial reference or private case evidence. Later verified reimbursement updates remedy status, not historical money/opinion. Overturned findings re-evaluate eligibility and repair aggregates/Trust/Search/FYP/notifications with auditable correction; retain prior evidence history. Product-quality aggregates use received-line ratings only.

Current business surfaces are Mobile App, Company Website, Seller Storefront, Seller Console and Operator Console. Intermittent Ethiopian connectivity is distinguished from backend failure, but authoritative payment/Order/Handoff actions remain connected-only. Deployment regions and purchased recovery capability are VERIFY PRODUCTION CONFIGURATION; no unverified Frankfurt or global-active routing assumption is retained.

## 6. Reliability Principles

1. Canonical business truth remains in domain-owned PostgreSQL state.

2. Degrade optional features before compromising commerce correctness.

3. Fail closed for authorization, sensitive evidence, signing keys and required audit writes.

4. Fail open only for explicitly optional experiences such as some analytics or recommendations.

5. Prefer symptom/user-journey alerts over raw resource thresholds.

6. Every page-worthy alert has owner, severity rule and executable runbook.

7. Alert after sustained conditions where flapping is likely; immediately for integrity/security breaches.

8. Every incident preserves a timeline and produces tested corrective actions.

9. Rollback is a first-class production operation.

10. Reliability targets are versioned and revised from evidence.

## 7. Observability vs Analytics vs Audit

| Signal | Question | Example | System of record |
| --- | --- | --- | --- |
| Observability | Is system functioning correctly? | FYP p95, queue lag | OBS tooling |
| Analytics | What users/business outcomes occur? | GMV, conversion | ADU-ANL-01 |
| Audit | Who performed privileged/security action? | Operator viewed evidence | Audit domain |
| Security signal | Is there suspicious behavior? | QR replay spike | Security/OBS derived signal |

Observability may consume counters from domain state, but it never becomes transactional truth.

## 8. System Context

![Operational observations remain separate from business truth](graphics/OBS_01.svg)
*Figure 01. Operational observations remain separate from business truth. Analytics measures product outcomes; Audit records authority; OBS detects and supports safe repair.*

Native/web requests and versioned owner commands propagate safe request, correlation, release and supported trace context. Domain transactions persist state/intent; after-commit workers carry independent consequences. Observability consumes safe signals and bounded read-only facts, never writes money, Trust, Scene visibility or Review Grant truth.

## 9. Structured Logging

Pino is the canonical server logger. Production output is JSON to stdout so Render/log drains can ingest it. Every log is an intentional event, not a dump of arbitrary objects.

Use child loggers scoped by module/operation and attach context through AsyncLocalStorage/RequestContext. Avoid console.log in production code through lint/CI rules.

## 10. Log Schema

| Bounded field | Semantics / privacy rule |
| --- | --- |
| timestamp / level / service / module | UTC occurrence, stable severity and runtime/domain name. |
| environment / deployment_version | Prod/staging separation, Git SHA/server release or compatible app release. |
| request_id / correlation_id | Validated technical request and business workflow linkage; not authorization input. |
| trace_id / span_id / causation_id | Only supported safe Sentry/W3C-compatible linkage; replay gets a fresh execution trace. |
| scope / market_id / originating_market_id | GLOBAL has no fabricated owner Market; optional validated origin. MARKET requires resource-derived canonical Market. |
| principal_type | ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or authenticated trusted SYSTEM; runtime discriminated context. |
| ordinary_account_ref / acting_context | Optional controlled ordinary reference; BUYER, SELLER or COURIER acting relationship. |
| operator_account_ref / system_operation_ref | Distinct typed privileged or automated provenance, never overloaded ordinary account_ref. |
| seller_ref / courier_assignment_ref | Optional exact scope for restricted diagnostics; absent from metric labels. |
| entity_type / entity_ref | Stable type and bounded safe opaque reference only when needed. |
| operation / result / error_code / duration_ms | Controlled names/outcomes and server timing; no raw payload/error body. |

One ordinary Account represents one human and may simultaneously act as Buyer, own Seller businesses, hold at most one current non-terminal ACTIVE or SUSPENDED Seller TEAM membership in MVP, and have Courier relationships. Multiple roles union permissions within that membership; ownership and Courier relationships do not consume the TEAM limit. Different humans use different Accounts.

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

Optional identity/entity references remain personal/pseudonymous operational data with restricted access and retention. Do not emit all fields for every event. SYSTEM never impersonates an ordinary user or Operator.

Anonymous diagnostics use only approved purpose-bound privacy-safe references; never log fingerprint, precise location, raw Message, phone or provider credential. Log shape does not authorize actions.

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

## 11. Sensitive Data / Redaction

Broad Pino/Sentry telemetry contains no OTP/digest, session/refresh token, raw QR, signing key, provider credential/signature/raw financial body, KYC document, Chat body, Claim evidence, delegate name/phone, push token or precise GPS/address. URL queries/fragments and dynamic private paths are removed before transport. Restricted evidence/audit repositories remain purpose-scoped and separately governed.

Apply allowlisted serializers before stdout/transport and scrub Sentry event, breadcrumb, span, attachment and request metadata before sending. Source-map/release upload excludes secrets. Do not enable automatic body/session replay capture by default; every extra capture capability requires privacy review. pg_stat_statements normalized fingerprints are reviewed without exporting sensitive literals; SQL/logger integrations must suppress bound values.

## 12. Log Levels

• DEBUG: development/staging detail; production disabled by default or temporarily scoped.

• INFO: meaningful expected lifecycle such as deployment start, worker ready, provider failover.

• WARN: recoverable abnormal state - retry, slow query threshold, late sync, fallback activated.

• ERROR: operation/workflow failed or user/business state affected.

• FATAL: process cannot safely serve - invalid critical config, missing signing key, schema

incompatibility.

Expected domain outcomes such as OUT_OF_STOCK are not automatically ERROR.

## 13. Request IDs

Every inbound HTTP request gets a server-controlled request_id. A trusted gateway-provided ID

may be accepted after validation; otherwise Fastify/NestJS generates one.

The ID appears in response error bodies/headers, Pino records, Sentry spans/errors and critical

DB/application logs. It is not authorization input.

## 14. Correlation IDs

Server-generated/validated correlation_id follows Checkout Session -> Seller Order -> PaymentAttempt -> provider verified fact -> Handoff -> independent Grant/Order consequences. Every HTTP/job execution has its own request/trace identity; event_id and causation_id retain immutable provenance across replay.

Never trust client correlation or trace headers as principal, Seller scope or financial idempotency. Bound length/grammar, reject control characters, limit propagation and prevent arbitrary high-cardinality dimensions.

## 15. Trace Context

Use request_id, correlation_id and parent/causation linkage now. Where current Sentry libraries support W3C-compatible traceparent safely, validate and propagate it with sampling/baggage minimization. Do not forward arbitrary external baggage or personal data.

Dedicated @opentelemetry/api, @opentelemetry/sdk-node, Collector and independent OTLP infrastructure are OPTIONAL FUTURE EVALUATION only after separate engineering approval. They are not required to implement current context or custom Sentry spans.

## 16. Async Trace Propagation

Outbox/job metadata carries:

• correlation_id;

• causation_id;

• parent trace/span linkage when valid;

• deployment/job version.

BullMQ worker starts a new span linked to producer context. Trace expiry does not erase

correlation/business lineage. Replay gets a new execution trace but retains original event ID and correlation/causation history.

The owning PostgreSQL transaction commits state plus event_outbox and/or job_intent. The shared relay leases intent, records versioned event_delivery consumer work and enqueues deterministic BullMQ jobs on Valkey after commit. BullMQ is the sole ordinary execution engine. Delivery is at-least-once; workers re-read current owner state and suppression/hold policy and use database uniqueness/processed-effect markers. Reconciliation and bounded dead-letter recovery prevent correctness-sensitive PostgreSQL-to-Valkey dual writes.

A queued worker links safely to available producer context; stale/missing trace does not erase durable business lineage. No worker waits for telemetry upload before committing business state. Critical Audit is a separate mandatory transaction/control, not optional tracing.

## 17. Metrics Architecture

Metrics are low-cardinality counters/gauges/histograms produced by application adapters and provider systems.

MVP sinks:

• Sentry performance/monitoring for application errors/traces/releases and supported metric monitors;

• Render process/service metrics;

• PostgreSQL provider metrics + pg_stat_statements;

• Valkey/BullMQ operational metrics;

• Cloudflare/R2/CDN analytics;

• read-only scheduled business-invariant checks that emit structured health status/alerts.

Instrumentation code uses a small MetricSink abstraction so a managed

OTLP/Prometheus-compatible backend can be added later without rewriting domains.

MetricSink is a small internal interface implemented with current approved sinks/provider metrics, not a mandate for a new metric vendor, daemon or exporter. Trace sample budgets and error handling remain versioned; sensitive errors are scrubbed before any sampling decision.

## 18. Metric Cardinality

Forbidden as metric labels: account/order/product/scene/request IDs, phone, raw URL with IDs,

full error strings.

Good bounded labels: Market, endpoint template, status class, provider, job type, stable error code, platform, deployment version, queue class.

CI review checks new metric attributes for bounded cardinality.

## 19. Golden Signals

For critical services/workflows monitor:

• Latency - p50/p95/p99 where meaningful;

• Traffic - requests/jobs/samples;

• Errors - system failures, not expected domain outcomes;

• Saturation - CPU/memory/connections/disk/event-loop/queue backlog;

• Correctness - invariant/convergence failure;

• Freshness - projection/location/config age;

• Dependency health - provider/storage/database;

• Security anomalies - replay/cross-tenant/rate-limit patterns.

## 20. Health Checks

Expose distinct endpoints/contracts:

• /health/live: process event loop/responding; no optional dependency checks.

• /health/ready: required DB/config/critical signing-key readiness.

• dependency health: internal dashboard, not necessarily load-balancer removal.

• business health: scheduled invariant checks.

A degraded SMS provider does not make the whole API unready if other core routes remain safe.

## 21. Synthetic Monitoring

Periodic low-impact checks:

• public Company Website/Storefront load;

• FYP endpoint returns eligible content using controlled test identity;

• Search known query returns valid result;

• object storage put/get/delete in dedicated synthetic prefix;

• worker synthetic job completes;

• staging/test OTP route exercises provider integration without repeatedly sending production

SMS.

Synthetic/test accounts are flagged so Analytics excludes them.

## 22. PostgreSQL Health

Monitor availability, pool utilization/wait, query latency, locks/deadlocks, long transactions, WAL/storage growth, vacuum/autovacuum, bloat trends, disk, checkpoint behavior and migration

state.

pg_stat_statements provides normalized query fingerprints - not SQL with sensitive literal values. Top queries by total time, mean time and calls are reviewed regularly.

## 23. Valkey Health

Valkey availability, latency, connections, memory, evictions and command errors are monitored separately for cache and BullMQ coordination. Configure queue persistence/eviction and capacity according to supported BullMQ requirements; validate purchased settings.

Cache/queue outage may pause execution and increase DB load but cannot corrupt canonical Orders, Inventory, Finance, Handoff or Trust. Verify oldest PostgreSQL intent age, relay/consumer delivery state and safe bounded cache fallbacks; recover from durable intent rather than assuming Valkey contains unique business truth.

## 24. Eventing / Worker Health

The owning PostgreSQL transaction commits state plus event_outbox and/or job_intent. The shared relay leases intent, records versioned event_delivery consumer work and enqueues deterministic BullMQ jobs on Valkey after commit. BullMQ is the sole ordinary execution engine. Delivery is at-least-once; workers re-read current owner state and suppression/hold policy and use database uniqueness/processed-effect markers. Reconciliation and bounded dead-letter recovery prevent correctness-sensitive PostgreSQL-to-Valkey dual writes.

| Execution signal | Alert / interpretation |
| --- | --- |
| event_outbox and job_intent pending age | Per class oldest age/count; committed intents survive Valkey failure. |
| Relay leases / event_delivery | Expired lease, missing delivery identity, consumer registry mismatch and deterministic enqueue conflicts. |
| BullMQ waiting/active/delayed/failed | Queue class, oldest job, duration, worker heartbeat, scheduled lateness and stalled recovery. |
| Retries / quarantine / dead letters | Sustained retry growth, poison version, bounded safe payload and explicit replay owner. |
| Effect / consequence convergence | Current PostgreSQL owner facts, idempotency conflicts and downstream lag; queue job success alone is insufficient. |

No job per ordinary FYP impression. Scheduled monitors/retention/reconciliation use approved Eventing intents and BullMQ execution; a timing trigger is not a second ordinary job engine.

## 25. Auth / OTP Health

Monitor purpose-tagged Auth/login/Step-Up/social-control/Handoff OTP request/send/verify, provider outcome, expiration, canonical attempt exhaustion, throttling and route fallback. Never mix purpose codes or log their secrets.

Ethiopia routing is Afromessage primary + SMS Ethiopia backup only where the actual approved configuration confirms it. Twilio/Infobip remain future/international adapters and are excluded from active-production dependency SLIs while inactive. Display route/config version; fallback rate is not proof of successful recipient delivery. Primary/both-provider failure preserves security limits and surfaces a temporary unavailable result.

## 26. FYP Health

Content owns Scene Post publication DRAFT/PUBLISHED/ARCHIVED separately from visibility PUBLIC/PRIVATE. A public Scene requires same-Seller eligible Product Post tags with at least one available Product, valid photo media/caption and current Seller, Market and safety gates. Loss of the last available tagged Product changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Eligible restock can restore PUBLIC after every current gate passes; it does not clear independent archive/moderation restrictions or require manual republishing solely for restock.

For You top-level units are photo-only Scene Posts. Monitor response/candidate/ranking latency, eligible count, empty feeds, safe fallback, duplicates, algorithm version, Seller exposure concentration and bounded new-Seller exploration. Product Post returned as an independent FYP unit is a correctness defect.

Hard current Content/Seller/Market/safety reads deny PRIVATE, archived, unavailable or removed Scenes despite a stale projection. Observe stock-to-PRIVATE and eligible-restock-to-PUBLIC convergence separately from privacy deletion. Public escape of a safety-suspended Seller or private Scene outranks modest latency regression; safe fallback cannot bypass gates.

## 27. Search Health

Search returns PRODUCT_POST, SELLER and SCENE_POST from launch. Monitor API latency/availability, zero-result ratio, bounded result-type distribution, current Market, projection/config freshness, pg_trgm query cost and stale/private/removed escape. Queries/full result URLs are not metric labels or indefinite raw logs. Current serving gates beat stale index contents.

Collections supports Product and Scene saves/removals; monitor operation failures, deleted subject remnants and private Scene public-resolution leakage. Private membership is not permission to publish Content.

## 28. Catalogue / Inventory Health

Monitor publish/update success, stock ledger/available quantity, attempt-bound CheckoutAllocation conflicts and age, conversion/release, stale owner confirmations, database non-negative constraints and duplicate allocation effects. Cart intent never protects stock.

Allocation expiry/cancellation/repair invokes ORDER §35/46 under the owner consistency lock. Monitor durable dispatch, finality evidence, attempt generation and allocation revision; uncertain possibly charged stock remains protected. No delayed worker releases stock because its timer fired. A legitimate out-of-stock command rejection is not a system outage; impossible negative/duplicate ledger state is an integrity incident.

## 29. Order Health

Monitor Checkout Session creation, current price/options/availability revalidation, Seller grouping, explicit Buyer confirmation, material-change reconfirmation, attempt initiation latency/idempotency and multi-Seller sequential abandonment. Per-Seller Orders/attempts remain isolated; one success does not pay another.

Monitor exact owning Order enum/version and state age: pending provider, PAID, PREPARING, READY_FOR_COLLECTION, READY_FOR_DELIVERY, OUT_FOR_DELIVERY, COMPLETED and applicable cancel/refund transitions. Illustrative labels must be bound to ADU-ORD contracts during writeback; no PAYMENT_SUBMITTED or Seller-confirmation active state. Age findings trigger safe owner recovery/escalation, never direct state mutation.

## 30. Payments & PSP Health

Finance/Payments alone establishes canonical payment, refund and settlement facts from authenticated provider callbacks and/or backend verification matched to the exact attempt/reference, Seller Order, amount and currency. Client return navigation, Seller statements and screenshots never establish PAID. Checkout snapshots merchandise, delivery, the zero launch Adulis Buyer surcharge (0 bps), exact currency rounding, Buyer total and Commercial Policy version before explicit confirmation. Payment, provider settlement and physical receipt are independent.

| PSP signal | Operational / integrity handling |
| --- | --- |
| Attempt creation / initiation | Latency/failure/idempotency and enabled provider-route health. |
| Webhook authentication / dedup | Invalid signature/source, repeated event/reference, parser version; no raw financial body. |
| Server verification / matching | Exact attempt/reference/amount/currency/Seller Order; mismatch blocks success. |
| PROCESSING / reconciliation | Oldest ambiguous attempt, verification retries/backlog and user-visible unresolved status. |
| Refund / settlement / payout | Separate initiation, provider confirmation and owner reconciliation; no inferred payout from payment. |
| Commercial zero at launch component | Compare merchandise + delivery + provider-permitted fee + zero launch Adulis surcharge = total under exact rounding/policy; no implicit Seller commission. |

Client redirect, Seller action or unauthenticated callback marking paid; duplicate charge; cross-Order application; unexplained amount/surcharge mismatch or lost paid state are R0 integrity/security incidents. Disable affected new attempts, preserve normalized evidence and use Finance recovery commands.

Launch Commercial Policy: Adulis surcharge is disabled, surcharge_rate_bps = 0 and surcharge_minor = 0. Buyer-paid Chapa processing cost is the owner-selected preference, separate from Adulis revenue, but the live route is DISABLED pending confirmed provider permission and exact fee calculation. Do not silently switch payer, invent a tariff or assume a fee-payer API flag. A future Buyer-paid Adulis surcharge, including the inactive proposed 0.5% concept, needs a new effective policy and disclosure; accepted historical quotes/Orders never change.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

For verified late success after an authorized release, preserve the charge and atomically try to secure remaining stock. If unavailable, record PAID_BUT_UNFULFILLABLE, prohibit preparation/fulfilment and create a Seller-funded refund obligation; never oversell or erase money. Every second successful attempt is a separate preserved charge/duplicate-charge exception with its own owed refund, not a second fulfilment. One canonical Order stock effect and one operational PAID transition survive replay.

## 31. Handoff Health

Handoff issuance and verification require backend connectivity; no offline acceptance/sync queue exists. Monitor QR issue/verify, OTP request/send/verify, governed Manual request/decision, expiry/revocation, signature/key version, replay, stage/recipient/assignment/delegate mismatch, canonical lockout and duplicate idempotent return.

Accepted evidence-to-Order consequence and qualifying final DELIVERY-to-Review Grant lag are separate signals. PICKUP does not complete final delivery or create a Grant. Method/stage metadata is safe; raw QR/OTP is forbidden. Signature/replay/cross-Order/brute-force spikes are security signals; current recipient/payment/assignment reads cannot be bypassed to improve availability.

## 32. Chat / Chatbot Health

Chat: message send/delivery success, latency, duplicate-message rate, conversation creation failures. No message body in telemetry.

Chatbot: deterministic intent match rate, unmatched rate, classifier latency/failure, template

resolution error, Seller escalation rate and evaluation-regression suite status.

Monitor immutable NONE/PRODUCT_POST/SCENE_POST/ORDER subject/provenance resolution; Product primary context remains distinct from Scene source. Public/private Content gates never erase lawfully retained exact Chat/Claim context. Classifier resolves deterministic Buyer support only; no Seller AI advice or default training corpus.

## 33. Media Health

Monitor upload grants/completions, validation failures vs system-processing failures, Sharp processing duration/errors, derivative readiness, BullMQ backlog, R2 operations, CDN

origin/errors and orphan reconciliation.

Unsupported user file is not page-worthy system failure; a broad Sharp/R2 processing failure is.

## 34. Notification Health

Per channel track created -> queued -> provider accepted -> delivered (where available) -> failed/retried/dead-lettered.

Provider 200 does not prove end-user receipt. Report both provider health and best available user-delivery evidence.

## 35. Trust Health

Trust owner states are NEW, REBUILDING, ESTABLISHED and TRUSTED. Monitor rule-versioned recomputation/transition latency, Claim correction/refund-related owner consequences, REBUILDING recovery, evidence/projection freshness and public-state consistency.

Successful qualifying QR evidence promotion is separately tested from generic OTP/Manual completion; Analytics cannot assign Trust. Detection reads canonical facts and versioned policy; a Claim allegation or every upheld remedy is not an unconditional direct demotion command.

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

Claim rate = DISTINCT qualifying affected verified-paid Seller Orders / DISTINCT eligible verified-paid Seller Orders in the SAME purchase cohort, including paid non-delivery. Select by canonical verified-payment cohort date and Market timezone; assign one Order once despite line/multiple Claims and retain inspectable membership. An effective metric policy must specify cohort window, maturity, late closure/reopening/correction, exclusions and minimum samples. Zero denominator returns INSUFFICIENT_EVIDENCE, never zero/perfect or division by zero. No numerator Order exists outside its denominator. Missing maturity/calibration is PENDING; do not deploy recalibrated demotion thresholds as validated.

The existing 10 purchased Product units per Buyer-Seller policy week cap applies only to favourable evidence/promotion credit. Keep its existing whole-Order threshold-crossing treatment for favourable QR/Review credit. Confirmed adverse findings remain countable at 9/10/11/20 units and across split Orders; caps cannot hide genuine Seller fault, cancellation or unresolved remedies. Independent abuse/duplicate review can invalidate proven false evidence with correction lineage, not a volume-based adverse blind spot.

## 36. Reviews Health

Monitor one Buyer/Order grant/container across FINAL_HANDOFF and VERIFIED_ORDER_FAILURE, exact valid evidence, missing eligible receipt/failure consequence, invalid PICKUP/unverified allegation, failure-only Product rating and correction lag. A missing Handoff is not a fault when the approved failure basis is valid.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 37. Claims Health

Monitor Claims opened, waiting review, oldest age, evidence-read failures, decision conflict, resolution latency, appeals/reversals and post-decision consequences.

Record queue/review/evidence age, decision conflict, resolution and append-only correction/reversal; provider refund remains pending until Finance confirms. Downstream Trust/Moderation/Reviews convergence follows each owner's policy, not unconditional review suppression. Separate Operator reviewer audit remains canonical.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

## 38. Moderation Health

Monitor report queue age, decision latency, content removal/restore propagation and Safety Suspension convergence across FYP, Search, Storefront, Seller surfaces and active Order policy.

## 39. Privacy Lifecycle Health

Monitor deletion requests pending/blocked/failed, oldest request, domain-task failures, purge

lag, expired evidence still present, CDN/Search removal lag, overdue holds and backup restore suppression health.

Privacy workflow failure is correctness/privacy risk even if APIs are healthy.

Add mandatory processor action lag, verified deletion failure, provider lifecycle tasks, public Scene/CDN removal, DPIA overdue/material-change gates, actual processor/transfer configuration mismatch and restore suppression violations. A stock-driven PRIVATE Scene is not itself a privacy purge task.

## 40. Operator Console / Security Health

A separate, internally provisioned Operator Account has independent credentials, OPERATOR audience/session, recovery and revocation. Current capability, resource/case scope, purpose, authentication freshness and required approval govern privileged actions. Store operator_account_id separately from ordinary_account_id; SYSTEM is neither. No impersonation or ordinary-role conversion is permitted.

Monitor privileged login/Step-Up, audience/principal mismatch, current capability scope, sensitive evidence-view failure, approval conflict, missing Audit and unusual restricted access. Required Audit unavailability causes high-risk mutation to fail closed; telemetry failure alone does not substitute for that control. Privileged termination/revocation invalidates sessions while required historical provenance remains retained.

Sensitive consoles must carry the approved enforced CSP/security-header floor; absence, unsafe script source/eval, weakened framing or unexpected third-party execution is a security signal. Detection confirms actual deployed headers rather than trusting a browser report alone.

## 41. Mobile Reliability

Sentry React Native records scrubbed crash/ANR/startup/screen-to-content/network/app-release/device-class signals. Expected disconnected state is classified separately from backend incident. Track supported client floor, camera/push and Expo Updates/EAS native compatibility.

SQLite/SecureStore may hold approved technical caches/credentials, but no offline Handoff/business queue, persisted Mobile Analytics replay, local paid fact or offline Order authority is allowed. Failed authoritative actions show pending/failed connectivity, not success. No session replay/body capture is enabled by this design.

## 42. Web Reliability

Company Website/Storefront/Seller/Operator web telemetry covers SSR/page errors, bootstrap/API latency, deep-link/404 anomalies, CDN errors and stale public content.

Playwright synthetic flows run in staging and selected safe production reads.

Synthetic production-like reads verify CSP version/mode and headers on all four web surfaces, static/error/auth routes and edge delivery. ADU-CSP-01 supplies report signature/directive/surface aggregates; never full private URLs. Native React Native is not protected by general browser CSP; webviews/navigation flows are assessed separately.

## 43. Business-Invariant Monitoring

Monitors are bounded read-only public owner queries or explicitly approved reporting views, with version, cursor/watermark, checked_at, counts and restricted sample references. They must not import private repositories or scan OLTP indefinitely. Findings are observations; only owning commands repair state.

| Monitor | Detection / owner-safe action |
| --- | --- |
| OBS-MON-01 Provider success missing Order PAID | Preserved verified charge lacks operational PAID or explicit protected processing/PAID_BUT_UNFULFILLABLE classification beyond target; Finance/Orders owner re-read. No automatic PAID or timer release. |
| OBS-MON-02 Order PAID without provider success | Operational PAID lacks exact verified charge OR matching one stock-consume/history effect; Finance/Orders/Inventory fence new affected actions and owner recovery. |
| OBS-MON-03 Stuck/expired CheckoutAllocation | Allocation/generation/finality mismatch; pending/cancel/expiry is not release proof. Finance/Order locked owner reconciliation. |
| OBS-MON-04 Paid stock released | Provider success plus duplicate or release ledger effect; Inventory/Finance; R0 fence producers |
| OBS-MON-05 Zero-available Scene still PUBLIC | Content PUBLIC with zero current eligible available tags; Content; current serving deny + reevaluate |
| OBS-MON-06 PRIVATE Scene public escape | Production FYP/Search/Storefront/Collections resolves private revision; Content + projection owner; R0 exposure containment |
| OBS-MON-07 Safety suspension escape | Suspended Seller/content current safety gate still served; Moderation/Content; deny before cache repair |
| OBS-MON-08 Upheld/corrected Claim missing Trust interpretation | Versioned mandatory Claim decision consequence absent beyond deadline; Claims/Trust; policy-aware recompute |
| OBS-MON-09 Final DELIVERY missing Order completion | Accepted qualifying final evidence, no legal Order transition by freshness target; Handoff/Orders; safe owner command |
| OBS-MON-10 Eligible receipt/failure missing Order Grant | Current FINAL_HANDOFF or VERIFIED_ORDER_FAILURE resolver eligible but no unique Buyer/Order Grant; Reviews idempotent recovery. |
| OBS-MON-11 PICKUP Grant | Grant anchor stage PICKUP; Reviews; R0 investigate no direct delete |
| OBS-MON-12 Duplicate Grant | Duplicate Buyer/Order grant/container/consumption across Claims or receipt/failure bases; Reviews database/effect guards and auditable correction. |
| OBS-MON-13 Deleted Account authenticates | Completed Auth lifecycle yet accepted current session/login; Auth/Privacy; revoke and fence restore |
| OBS-MON-14 Deleted personalization restored | Suppression subject has fresh Search/FYP/Analytics linkage; Projection owner/Privacy; suppress replay and purge |
| OBS-MON-15 Mandatory processor task overdue | Privacy unresolved mandatory external action past policy target; Privacy/adapter; verify provider outcome |
| OBS-MON-16 zero at launch money mismatch | Exact snapshot policy/rounding fails amount/component reconciliation; Finance/Commercial Policy; R0 fence attempts |
| OBS-MON-17 Operator high-risk action lacks Audit | Privileged owner mutation missing required typed provenance; Owner/Audit/Security; R0 fail closed |
| OBS-MON-18 Outbox/job_intent age | Oldest committed intent/delivery beyond class SLO; Eventing; bounded relay repair |
| OBS-MON-19 Provider refund consequence missing | Finance confirmed refund not reflected in relevant Order/Claim state; Finance/Orders/Claims; owner reconciliation |
| OBS-MON-20 Missing required CSP | Actual deployed production web response violates approved header floor; Web/Security; last approved enforced rollback |
| OBS-MON-21 Late or duplicate charge | Every real charge classified; no-stock late success prohibits fulfilment and records Seller obligation; Finance/Orders. |
| OBS-MON-22 Remedy completion mismatch | REQUESTED/PENDING/REFUSED/OVERDUE owed amount mislabelled paid, or COMPLETED lacks provider-confirmed evidence; Finance/Claims. |
| OBS-MON-23 Failure-only Product rating | Unreceived line rating, wrong tuple or failed basis/correction; Reviews fail closed and owner repair. |
| OBS-MON-24 Claim cohort / adverse cap | Numerator outside same verified-paid cohort, zero denominator rendered perfect or adverse evidence volume-suppressed; Trust/Analytics policy-aware repair. |

Near-zero-tolerance integrity/security conditions alert immediately once confirmed. Eventual consequence checks allow only their versioned freshness window, with delayed/duplicate fact handling; a monitor must not confuse an expected in-progress transaction with corruption.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 44. SLIs

SLI definitions version numerator, denominator, eligible/error taxonomy, measurement source, window, owner and exclusions. Expected out-of-stock, invalid credential, authorization denial and cancelled user navigation are not availability failures; never exclude genuine system failure as business rejection. Track client/provider end-to-end outcomes separately from internal orchestration.

| Capability | SLI definition |
| --- | --- |
| Auth | Eligible challenge/verification API success / valid connected attempts |
| FYP | Eligible correct response / valid feed requests |
| Search | Correct current Market response / valid queries |
| Checkout | Accepted valid current-confirmation commands / valid connected commands |
| Payments / PSP | Initiation and backend verification available / valid attempts; provider and Adulis views separate |
| Orders | Legal owner transition success / valid commands |
| Handoff | Valid online acceptance / eligible attempts; method-class breakdown |
| Review Grant | One Buyer-owned eligibility/consumption per paid Seller Order; FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; delegate never owns it. |
| Critical Async | Effects completed within versioned class deadline / due effects |
| Privacy | Mandatory verified tasks within approved workflow target / due eligible tasks |
| Mobile | Crash-free sessions; high-value time-to-content by safe device/network class |
| Operator high-risk | Authorized mutation with required Audit / valid attempts |

A timer, pending lookup, cancel request or local attempt expiry never proves provider finality. Enter protected RECONCILING, retain the required allocation, fence attempt generation and escalate through current Finance/Order authority. Release requires recorded authoritative finality/release evidence under the confirmed adapter protocol and a locked re-read excluding an in-flight/verified charge. Unknown finality means no timer-only release and no automatic replacement charge. Provider failure can persist; no unconditional eventual resolution is promised.

## 45. SLOs

PROVISIONAL - VALIDATE DURING PILOT/BETA. Availability targets use a 28-day rolling internal window; these are engineering proposals, not legal contracts or demonstrated production performance. Freshness is a separate objective.

| Capability | Provisional objective |
| --- | --- |
| Auth | 99.5%; server p95 <600ms |
| FYP | 99.5%; p95 <700ms |
| Search | 99.5%; p95 <800ms |
| Checkout | 99.9%; p95 <800ms |
| Payments / PSP | 99.5%; internal p95 <1s, provider timing separate |
| Orders | 99.9%; p95 <800ms |
| Handoff | 99.5%; server p95 <1s |
| Review Grant | One Buyer-owned eligibility/consumption per paid Seller Order; FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; delegate never owns it. |
| Critical Async | 99.9% within configured deadline |
| Privacy | 100% eventual verified; timing configured after legal approval |
| Mobile | 99.5% crash-free; pilot device budget required |
| Operator high-risk | 99.9% availability; 100% integrity |

No correctness/security error budget: paid state, non-negative stock, cross-tenant authorization, Handoff evidence, Grant uniqueness, privacy and CSP integrity must remain correct. Provider outage/error is surfaced separately; lack of provider confirmation cannot be converted into a paid fact to meet a target.

## 46. Error Budgets

For availability/latency SLOs, error budget guides release risk: heavy burn pauses risky feature rollout and shifts work to reliability.

Error budgets never permit correctness/security violations. "99.9%" does not mean 0.1% of Orders may corrupt state or cross-tenant access may occur.

For a measured eligible population N, budget = N × (1 - SLO fraction); consume on the defined failed/late events. Proposed burn warnings compare short and long windows, with minimum traffic to avoid low-volume paging noise. Sustained rapid burn pauses risky release changes; owner approval resumes them after evidence. A final Grant freshness miss is recoverable lateness, not permission for a duplicate or invalid Grant.

## 47. Reliability Classes

| Reliability class | Capabilities / required behavior |
| --- | --- |
| R0 - Integrity / Security | Authorization, money truth, non-negative Inventory, accepted Handoff, required Operator Audit, privacy/CSP integrity. No acceptable correctness error budget; fail closed. |
| R1 - Critical Commerce | Auth, Checkout, Payments, Orders, connected Handoff; highest recovery priority. |
| R2 - Important Experience | FYP, Search, Chat, Seller operations, Media; degrade to current-safe fallback. |
| R3 - Best Effort | Seller analytics refresh, non-critical notices/enrichment; pause first, replay safely. |

## 48. Alert Design

Every alert specification includes:

• condition/window;

• severity/page vs work-hours;

• owner;

• user/business impact statement;

• dashboard link;

• runbook link;

• likely dependencies;

• clear/resolve behavior.

Avoid alerting just because a metric exists.

## 49. Alert Severity

| Severity | Impact / routing |
| --- | --- |
| SEV-1 Critical | Confirmed corruption/data exposure, cross-tenant access, compromised provider/Handoff key or Operator identity, broad outage or unsafe/private distribution; immediate IC/primary/backup. |
| SEV-2 Major | Major commerce/provider/auth degradation, delayed critical consequences or broad Media/FYP disruption with safe alternatives; immediate operational response. |
| SEV-3 Moderate | Isolated feature/dependency issue or non-critical backlog with workaround; work-hours tracked owner. |
| SEV-4 Minor | Low-impact defect/cleanup; backlog with owner. |

Privacy suspicion creates a restricted legal/privacy assessment and awareness clock regardless of technical severity. Severity cannot defer legal deadlines or justify wide evidence access.

## 50. Alert Routing

For a two-developer team:

• SEV-1/SEV-2 -> immediate Sentry/on-call notification channel;

• SEV-3 -> work-hours issue/notification;

• SEV-4 -> backlog/dashboard only.

One primary and one backup responder are sufficient initially. Routing config is externalized and tested; do not depend on one individual's device.

## 51. Alert Deduplication

Group alerts by incident key such as database_unavailable:prod or otp_provider:afromessage:ethiopia, not by request ID. Suppress dependent symptom

storms after a root dependency is known while retaining telemetry.

Retry-storm alerts use sustained rate + queue growth thresholds to avoid thousands of child

alerts.

## 52. Dashboards

| Launch dashboard | Operator question / core facts |
| --- | --- |
| Platform Overview | What is failing? API/process/DB/Valkey/deployment saturation and dependencies. |
| Commerce & Payments | Which Checkout/attempt/Order/zero at launch/refund/settlement consequence is stuck or inconsistent? |
| Auth / OTP | Is the currently active route delivering and verifying safely, by purpose? |
| Discovery - FYP / Search / Scene | Are current eligible photo Scenes/results serving fairly with correct visibility/freshness? |
| Workers / Eventing | Which committed intent, lease, queue/version or owner effect is overdue? |
| Privacy / Security / CSP | Which lifecycle/processor/DPIA clock/header/evidence/Audit risk needs containment? |
| SLO / Error Budget | Which defined valid population is burning latency/availability budget? |

Split Handoff/Reviews/Claims dashboards only when traffic and an operational question justify it. No per-Buyer identities or evidence narratives in general dashboards.

## 53. Incident Detection

Incidents may originate from alert, user/support report, security report, provider notice or

invariant monitor. The first responder declares severity, opens an incident record and establishes a correlation/timeline rather than debugging silently in chat.

## 54. Incident Roles

For a small team roles may be held by the same people, but responsibilities remain explicit:

• Incident Commander (IC): owns priorities/decisions/timeline.

• Technical Responder: diagnosis/mitigation.

• Communications Owner: user/internal status if needed.

• Scribe: incident timeline/actions (may be IC for small event).

Only authorized engineers may deploy/rollback/queue-pause; high-risk data corrections require domain/Operator procedure.

## 55. Incident Lifecycle

```
DETECTED -> TRIAGED -> DECLARED -> MITIGATING
         -> MONITORING -> RESOLVED -> REVIEWED
```

Incident record includes severity, start/detect/mitigate/resolve times, affected

capabilities/Markets/releases, decisions, links to traces/logs, user communication and follow-up actions.

## 56. Mitigation

First priority is reducing user/data risk, not proving root cause. Examples:

• disable problematic FYP algorithm version;

• switch OTP provider;

• pause non-critical queue classes;

• make sensitive evidence endpoint read-only;

• rollback release;

• route Search to simpler fallback;

• stop a bad migration/job producer.

Mitigation must preserve canonical correctness and be reversible/audited where high risk.

## 57. Feature Flags / Kill Switches

Kill switches are current server-controlled environment/Market/provider-scoped configuration with typed Operator/approved deployment provenance and reason/version. They cannot override authorization, paid truth, Inventory constraints, safety or hold rules.

• Disable new Checkout/provider route while preserving verification/refund recovery for existing attempts.

• Stop Handoff credential issuance for compromised signing version; controlled online QR/OTP/Manual recovery cannot bypass payment or recipient.

• Disable ranking version/use safe current-eligible fallback; owner safety/content command removes a specific Scene.

• Force configured OTP backup; disable Media uploads or Courier GPS; pause non-critical BullMQ classes.

• Disable Product TikTok embed; block risky Operator mutations.

• Roll back CSP candidate to last approved enforced baseline. Candidate Report-Only may accompany that baseline; never remove the sensitive-surface enforced floor in an emergency.

## 58. Rollback

Every production release links to previous deploy and Git SHA. Rollback checklist verifies schema compatibility, queued payload compatibility and feature-flag state.

Database migration follows expand -> migrate/use -> contract. Destructive contract migrations never accompany a release that may need old code rollback.

Mobile rollback uses Expo Updates only for changes safe under update policy; native

incompatibilities require EAS/store release. Server remains backward-compatible with supported client floor.

## 59. Database Incident Operations

Runbook covers:

• provider health/connection saturation;

• lock/deadlock/long transaction diagnosis;

• pg_stat_statements top query review;

• pause traffic/job classes causing amplification;

• scale connection pool cautiously;

• migration abort/rollback criteria;

• PITR/restore escalation;

• integrity verification before reopening writes.

Never solve DB saturation by indiscriminately increasing connections beyond managed limits.

## 60. Valkey Incident Operations

Valkey/BullMQ incident: verify PostgreSQL/owner facts, expect paused queues and cache misses, preserve committed intents, prevent retry storm and rate-limit safely. Maintain routes that remain correct without the dependency; a security control with no safe fallback fails closed.

Restore supported queue configuration and workers gradually, reconcile lease/delivery/job identity from PostgreSQL, re-read current Market/hold/suppression/payment state and verify owner effects. Monitor fallback DB saturation. Never infer lost payments or delete canonical facts from a missing Valkey key.

## 61. OTP Incident Operations

Primary provider failure -> activate configured backup routing and monitor fallback success/cost.

If both fail, Auth API should return a clear temporary-unavailable state, preserve rate-limit security and communicate incident rather than repeatedly flooding providers.

## 62. FYP Incident Operations

If ranking/candidate generation fails, use deterministic safe fallback over eligible content. If

eligibility correctness is suspect, fail closed on risky content and prefer Search/Storefront over unsafe feed.

Kill-switch algorithm version and annotate Analytics/Observability with rollout/rollback version.

## 63. Order Incident Operations

Fence the faulty Checkout/Order producer, preserve exact provider/purchase snapshots, identify affected Seller Orders with bounded approved query, use owner recovery commands and reconcile Inventory/allocation and downstream intents. Never mass UPDATE an Order state or release allocated paid stock without current Finance re-read. Reopening requires payment/stock/Handoff/Grant integrity checks and compatible schema/job versions.

## 64. Payment Provider & Financial Security Incident Operations

Payment-provider/financial-security incident: stop new affected attempts or compromised route, preserve normalized canonical attempts/provider references and restricted Audit, rotate exposed webhook/provider credentials via approved process, reverify authentic provider facts and deduplicate before owner recovery.

For duplicate charge, callback spoof, amount/currency mismatch, account takeover, settlement/refund discrepancy: establish affected scope, user impact and actual provider outcome; never use screenshot, redirect or Seller confirmation as repair authority. Keep existing paid truth immutable, reconcile refunds only from provider confirmation, and escalate personal-data exposure to Privacy/legal with awareness time.

## 65. Handoff Incident Operations

Handoff signature/key compromise: stop new affected issuance, revoke unaccepted credential/key scope through Handoff owner, preserve accepted immutable evidence, assess current assignments/delegates, rotate approved keys and use policy-governed connected recovery. QR/OTP/Manual still requires exact paid, stage, recipient and scope; no disconnected success or blanket completion.

Replay/wrong-Order/assignment spikes are investigated without logging raw credentials. After recovery verify accepted evidence uniqueness, final Order consequence and exactly one Buyer Grant, with no PICKUP/delegate Grant or inappropriate QR Trust credit.

## 66. Privacy Incident Operations

Contain public/processor exposure or deleted-subject resurrection, preserve minimal suppression/hold ledger and restricted timeline, pause faulty rebuild/purge producer, reapply owner suppression and reconcile physical/index/CDN/processor effects. Do not pretend an incomplete mandatory deletion succeeded.

Record controller_awareness_at and retain the earliest justified time; surface separate Authority/data-subject assessment deadlines anchored to 72h, with internal 24h/48h warning proposals. Legal/privacy determines obligations/exception/submission; technical handoff never restarts the clock. Link ADU-PRV-01 and ADU-DPIA-01, processor contact and minimal affected-class scope.

## 67. Security Incident Operations

Security incidents have restricted records/access. Examples include cross-tenant access,

credential compromise, unusual Operator evidence access and secret leakage. Response covers

containment, secret/session revocation, evidence preservation, scope assessment and notification obligations.

Current examples include ordinary/Operator confusion or compromise, PSP credentials/callbacks, Handoff keys, CSP/XSS/policy downgrade, evidence exposure, unauthorized Scene visibility and deletion resurrection. Privileged containment uses current scoped Operator capability, fresh Step-Up and mandatory Audit; ordinary identity cannot be promoted into incident authority.

## 68. Runbooks

Runbook template:

```
Purpose / trigger
User-business impact
Preconditions / access required
Dashboard and queries
Immediate safe checks
Mitigation steps
Do-not-do warnings
Rollback/recovery
Integrity verification
Escalation / communication
Post-recovery cleanup
Owner / last-tested date
```

No secrets are embedded in runbooks. Each SEV-1/2 alert links directly to one.

The current executable runbook catalogue is Appendix C. Every SEV-1/2 alert resolves to a stable runbook ID, accountable domain/on-call role, required access, last-tested record, safe checks/mitigation, recovery proof and privacy escalation; no secret or arbitrary SQL payload is embedded.

## 69. Incident Communication

Internal updates include current impact, mitigation, next checkpoint and known unknowns. User

communication avoids unsupported claims, provides workarounds and states when service is restored.

A public status page is useful after public launch but can be a simple managed/static surface; do not create a bespoke incident CMS for MVP.

## 70. Post-Incident Review

Within a reasonable period after significant incidents, record timeline, impact, contributing

factors, what worked/failed, root cause(s), detection gaps and corrective actions. Analysis is blameless but accountability for fixes is explicit.

## 71. Action-Item Management

Every action has owner, priority, due date and verification test. High-severity recurrence

prevention becomes an automated test/monitor/runbook change whenever possible.

No review is complete with vague action like "be more careful."

## 72. Backup Monitoring

Monitor successful scheduled backups/PITR status, age of newest restorable point, backup storage errors and encryption/access controls. Backup existence without restore validation is not

sufficient reliability.

## 73. Restore Drills

Proposed internal cadence: quarterly in early production and after major backup/schema/process change, subject to approved operational schedule; this is not a claimed statutory interval. Restore isolated backups and verify schema, exact Orders/payments/surcharge, stock, outbox/job_intent, separate Operator restrictions, Trust/Claims, Scene visibility and Review Grant uniqueness.

Replay authoritative Privacy suppression/deletion records newer than the backup before traffic or personal-data reprocessing; reconcile R2/index/cache/provider copies. Record actual restored time, achieved RPO/RTO, provider plan evidence, verification and sign-off. Backup existence alone proves neither recovery nor deletion compliance.

## 74. RPO / RTO

Provisional targets must match purchased managed plans:

• PostgreSQL commerce RPO: <= 5 minutes where PITR/provider capability supports it;

• PostgreSQL RTO: <= 2 hours for severe regional/database recovery;

• R2/media: rely on object durability/version/lifecycle design and metadata restore procedures;

• Valkey cache RPO: no canonical requirement; queues recover from outbox/reconciliation.

If provider plan cannot meet targets, update either plan or documented SLO before launch.

## 75. Capacity Monitoring

Track trends for CPU/memory, API concurrency/event-loop lag, DB connection/IO/storage/WAL,

top query time, Valkey memory, queue rate/age, R2 storage/bandwidth, CDN egress, SMS volume and mobile crash/latency.

Capacity alerting uses forecast/remaining headroom rather than only "already full" thresholds.

## 76. Cost Observability

Daily/weekly cost signals:

• SMS by provider/Market/fallback rate;

• R2 storage/operations and CDN bandwidth;

• Render compute/database growth;

• Sentry event/trace volume;

• logging volume;

• high-volume GPS/analytics events.

Cost anomaly alerts must not encourage sampling of critical audit/security/commerce facts.

## 77. Tooling Architecture

MVP canonical stack:

• Pino - structured operational logs;

• Sentry - server/mobile/web errors, traces/performance, release health and alerts;

• pg_stat_statements - SQL performance;

• Render/managed PostgreSQL/Valkey metrics - infrastructure;

• Cloudflare/R2 analytics - edge/object delivery;

• BullMQ inspection/metrics - queue health;

• GitHub Actions - pre-deploy health gates;

• k6/Maestro/Playwright/Testcontainers/Jest - reliability verification.

Do not duplicate the same signal into three paid platforms at MVP.

## 78. OpenTelemetry - Optional Future Evaluation

OPTIONAL FUTURE EVALUATION: dedicated OpenTelemetry packages/infrastructure, Collector or alternate metrics/log/tracing vendors need measured portability/scale requirements and separate approval. They are neither current dependencies nor launch gates.

Current Pino, Sentry, managed/provider metrics, pg_stat_statements and safe request/correlation/causation context satisfy this baseline. W3C-compatible context may be used through supported current libraries, without introducing @opentelemetry/api or @opentelemetry/sdk-node automatically.

## 79. Data Retention / Access Security

Operational telemetry has explicit retention by class. Security/audit records are separate and

may have longer justified retention. Sentry/Pino must not become shadow personal-data archives.

Access uses least privilege; production logs/traces are not available to all staff. Export/download

of logs is controlled and audited where sensitive. Staging and production projects/DSNs are separate.

CSP reports are minimized before external transport; no original policy/nonce, sample or private URL. Provider/DPIA narratives and precise location never enter general diagnostics. Retention values derive from ADU-PRV policies, not an arbitrary "keep all errors forever" default.

## 80. Testing

• Jest: logger serializers/redaction, metric naming/cardinality, severity rules, health checks.

• Testcontainers: DB-down/lock/deadlock/outbox/invariant monitors, Valkey/BullMQ failure/recovery.

• Playwright: web synthetic/error surfaces and status/rollback smoke.

• Maestro: mobile offline/network/crash/retry/release flows.

• k6: latency/error/saturation and observability overhead under target load.

• CI snapshot tests verify sensitive fields never enter telemetry fixtures.

## 81. Failure Injection

Execute controlled staging/game-day failures using Jest/Testcontainers and production-like disposable adapters; record expected safe behavior and alert evidence.

| Failure injection | Required observation / safety |
| --- | --- |
| PostgreSQL down / long lock | Readiness, lock/pool alert; no false money/Handoff success. |
| Valkey / BullMQ / relay stopped | Durable intent backlog and class lag; no lost canonical facts or retry amplification. |
| PSP outage / spoof / duplicate callback | Unavailable route or reconciliation; signature/matching/dedup protects paid state. |
| OTP primary and both down | Configured fallback; security limits and temporary failure preserved. |
| R2 / CDN purge failure | Upload/delete/purge remains incomplete; canonical public gate denies exposure. |
| Scene consumer / FYP ranking delayed | PRIVATE/safety gates still enforced; safe current fallback. |
| Handoff key unavailable | Issuance denied; accepted evidence unchanged; governed connected recovery only. |
| Review Grant consumer stopped | Final-Handoff lag/missing monitor and unique idempotent recovery. |
| Privacy worker crash / restore | Partial state/resume; hold/suppression check and pre-traffic replay. |
| CSP weakened / reporter down | Actual-header regression alerts; enforcement remains even if reporting fails. |
| Operator Audit unavailable | High-risk mutation fails closed, no telemetry substitute. |

## 82. Incident Drills

Before public launch execute each scenario; fill observed detect/ack/contain/recover time, participants, safeguards, evidence and corrective owner/due date. A planned drill is not a completed one.

| Drill | Success evidence |
| --- | --- |
| OBS-DRILL-01 Auth/SMS outage | Safe containment, current owner integrity, correct alert/runbook and recovery verification; status OPEN until signed record exists. |
| OBS-DRILL-02 DB saturation/compatible rollback | Safe containment, current owner integrity, correct alert/runbook and recovery verification; status OPEN until signed record exists. |
| OBS-DRILL-03 Worker/outbox backlog and replay | Safe containment, current owner integrity, correct alert/runbook and recovery verification; status OPEN until signed record exists. |
| OBS-DRILL-04 Payment-provider outage/signing/security incident | Safe containment, current owner integrity, correct alert/runbook and recovery verification; status OPEN until signed record exists. |
| OBS-DRILL-05 Handoff key compromise | Safe containment, current owner integrity, correct alert/runbook and recovery verification; status OPEN until signed record exists. |
| OBS-DRILL-06 Review Grant convergence failure | Safe containment, current owner integrity, correct alert/runbook and recovery verification; status OPEN until signed record exists. |
| OBS-DRILL-07 Unsafe/private Scene FYP/Search escape | Safe containment, current owner integrity, correct alert/runbook and recovery verification; status OPEN until signed record exists. |
| OBS-DRILL-08 Privacy breach Authority/data-subject 72h tabletop | Safe containment, current owner integrity, correct alert/runbook and recovery verification; status OPEN until signed record exists. |
| OBS-DRILL-09 CSP/XSS regression tabletop | Safe containment, current owner integrity, correct alert/runbook and recovery verification; status OPEN until signed record exists. |
| OBS-DRILL-10 Backup restore plus deletion-suppression replay | Safe containment, current owner integrity, correct alert/runbook and recovery verification; status OPEN until signed record exists. |

## 83. Load Testing

k6 scenarios measure not only endpoint throughput but signal overhead. Observability must remain bounded under load:

• Pino logging avoids per-request huge payloads;

• tracing sample rate reduces under high volume while errors remain captured;

• metrics remain constant-cardinality;

• invariant monitors stay bounded/indexed;

• Sentry/log provider outage does not block core commerce.

A launch load test is failed if telemetry adds material tail-latency or memory pressure beyond

agreed budget (provisional target <5% CPU and <5% p95 overhead for instrumentation).

## 84. MVP Scope

MVP includes safe structured logs, Sentry supported errors/performance/releases, current request/correlation/context, DB/Valkey/BullMQ/provider visibility, seven useful dashboards, versioned SLIs/SLOs/error budgets, all 20 business monitors, scoped alerting/incident command, current runbooks/kill switches/rollback, privacy/DPIA/CSP governance clocks, restore/capacity/cost visibility and failure tests. It includes no persistent offline commerce/Analytics authority and no mandatory dedicated OpenTelemetry infrastructure.

## 85. Maturity Roadmap

Stage 0 - Internal development: IDs, Pino schema, Sentry, basic DB/worker visibility.

Stage 1 - Controlled beta: critical dashboards, invariant monitors, SEV process, runbooks, restore/load tests.

Stage 2 - Public launch: on-call routing, SLO/error budgets, synthetics, provider failover visibility, release gates.

Stage 3 - Scale: managed OTLP metrics/log backend or Collector if justified, more advanced sampling, capacity automation, dedicated reliability ownership.

## 86. System Invariants

OBS-INV-001 Logs never contain OTP/session/private keys.

OBS-INV-002 Raw provider financial/KYC/Claim evidence never enters broad telemetry.

OBS-INV-003 Chat content never enters broad operational logs.

OBS-INV-004 Request ID identifies one request; correlation ID identifies workflow.

OBS-INV-005 Entity IDs are not unbounded metric labels.

OBS-INV-006 Expected domain errors are distinguished from system failures.

OBS-INV-007 Observability does not become Analytics truth.

OBS-INV-008 Operational logs do not replace Audit.

OBS-INV-009 Required audit failure causes high-impact operator mutation to fail closed.

OBS-INV-010 Valkey outage cannot corrupt canonical commerce state.

OBS-INV-011 Business-invariant monitors exist for cross-domain mandatory consequences.

OBS-INV-012 Safety-suspended content escape is high severity.

OBS-INV-013 Required policy-versioned Claim consequence missing from Trust is detected.

OBS-INV-014 Expired/stuck CheckoutAllocation is detected and cannot release already-paid stock.

OBS-INV-015 Critical queue lag has class-specific thresholds.

OBS-INV-016 Every page-worthy alert has owner and runbook.

OBS-INV-017 Alert groups suppress storms without dropping telemetry.

OBS-INV-018 Feature flags cannot bypass authorization/invariants.

OBS-INV-019 Rollback requires schema/job compatibility.

OBS-INV-020 Database remediation avoids uncontrolled direct state edits.

OBS-INV-021 Backups are monitored and restore-drilled.

OBS-INV-022 Restore replays Privacy suppression/deletion state before serving traffic.

OBS-INV-023 Error budget never permits integrity/security violation.

OBS-INV-024 Tracing/logging provider outage does not block normal commerce.

OBS-INV-025 Production telemetry access is least privilege.

OBS-INV-026 Staging/prod telemetry is separated.

OBS-INV-027 Deployments are annotated with Git SHA/release ID.

OBS-INV-028 Mobile telemetry records app/platform version without sensitive payload.

OBS-INV-029 Offline mobile errors are distinguished from backend failures.

OBS-INV-030 Sentry sampling retains errors/security-relevant events.

OBS-INV-031 pg_stat_statements uses normalized fingerprints.

OBS-INV-032 Invariant monitor queries are bounded/indexed.

OBS-INV-033 SLO definitions are versioned.

OBS-INV-034 Incident timelines are preserved.

OBS-INV-035 SEV-1/2 incidents receive post-incident review.

OBS-INV-036 Corrective actions have owners/tests.

OBS-INV-037 Secret rotation is practiced, not theoretical.

OBS-INV-038 Provider failover is observable.

OBS-INV-039 Capacity forecast precedes hard saturation.

OBS-INV-040 Cost observability never justifies sampling canonical audit/business facts.

OBS-INV-041 Buyer/Seller/Courier contexts use one ordinary principal.

OBS-INV-042 Operator telemetry is distinguishable from ordinary Account telemetry.

OBS-INV-043 Provider/backend facts alone establish payment.

OBS-INV-044 Observability never treats Seller/client claims as payment success.

OBS-INV-045 CheckoutAllocation leakage/staleness is monitored; Reservation is not current commerce.

OBS-INV-046 Scene with no available tagged Product cannot remain publicly eligible.

OBS-INV-047 PRIVATE Scene public escape is a correctness incident.

OBS-INV-048 Handoff has no disconnected success or offline-sync monitor.

OBS-INV-049 Qualifying final DELIVERY converges to exactly one Buyer Review Grant.

OBS-INV-050 PICKUP never creates Review Grant.

OBS-INV-051 zero launch surcharge mismatch is detected from canonical snapshots.

OBS-INV-052 Trust monitoring recognizes NEW/REBUILDING/ESTABLISHED/TRUSTED.

OBS-INV-053 CSP removal/weakening on sensitive surfaces is observable.

OBS-INV-054 DPIA/privacy deadlines are surfaced without engineering legal conclusions.

OBS-INV-055 BullMQ is the sole ordinary execution engine.

OBS-INV-056 Dedicated OpenTelemetry infrastructure is not a launch dependency without approval.

## 87. Open Decisions

| Open operational decision | Safe current stance / evidence |
| --- | --- |
| SLO population / provider budget | Provisional pilot targets; retain genuine failures; separate internal/provider views. |
| Dedicated telemetry infrastructure | No current addition; explicit approval after measured need. |
| Trace/error sample budget | Scrub before transport; supported current Sentry capability; bounded cost/volume. |
| Telemetry retention / access | ADU-PRV approved policy; sensitive scope and production/staging separation. |
| Paging / on-call channel | Primary and backup roles; current contact/config verified and exercised. |
| RPO/RTO / regions | Verify purchased provider plan, actual production/backup regions and measured restore. |
| CSP / DPIA thresholds | Security/privacy owners set versioned gating/review and legal escalation; no automatic approval. |

## 88. Canonical Write-Backs

| Writeback | Current change |
| --- | --- |
| Engineering / Platform / API | Typed identity, safe request/correlation/trace context and owner read-only monitoring boundary. |
| Eventing / Deployment | Intent/lease/delivery/job version and consequence metrics; compatibility rollback and restore evidence. |
| Auth / Finance / Checkout / Orders | Activated routes, provider truth, exact zero at launch, allocation fences and command SLIs. |
| Content / FYP / Search / Collections | Scene-only units, current PUBLIC/PRIVATE gates, fairness/freshness and public escape. |
| Handoff / Reviews / Trust / Claims | Connected evidence, two-basis unique Buyer/Order Grant, policy consequences and separate reviewer Audit. |
| Privacy / DPIA / CSP / Operator | Processor/delete/clock/review gates, minimized reports, actual deployed header integrity and high-risk Audit. |
| Mobile / tests | No persisted replay/authority; scrubbed network/release taxonomy, failure/load/UI regression. |

## 89. Implementation Sequence

| Phase | Exit evidence |
| --- | --- |
| 0 Standards | Typed safe log/error schema, identifiers, Sentry environment/release and forbidden-payload fixtures. |
| 1 Platform | DB/Valkey/BullMQ/edge/current-provider metrics and safe health checks. |
| 2 Context | Supported Sentry spans and current safe HTTP->intent->worker linkage, no added OTel runtime. |
| 3 Domain monitors | All current payment/stock/Scene/Handoff/Grant/privacy/CSP/Audit invariants. |
| 4 SLO / alert / dashboard | Versioned measured populations, target approval, tested primary/backup routing and seven dashboards. |
| 5 Incidents | Owner runbooks, approved enforced CSP rollback, domain repair, privacy clock and evidence. |
| 6 Resilience | All 10 drills, restore replay, k6 overhead and Maestro/Playwright release checks. |

## 90. Production Launch Gate

Every gate is OPEN until actual evidence is attached; architecture does not assert live monitoring or completed tests.

• Pino/Sentry allowlist scrubbers prove no secret/evidence/Chat/GPS/private CSP URL; separate typed principal and release context.

• Only approved current stack; no OpenTelemetry infrastructure prerequisite; configured providers/regions match active Market.

• PostgreSQL pool/lock/query and Valkey/BullMQ/intent/delivery/dead-letter alerts; health/synthetic flows tested.

• Provider exact success/Order stock/allocation and zero at launch monitors; refunds/settlement separately visible.

• Photo Scene-only FYP, PRIVATE/safety gates across Search/Storefront/Collections, fairness/freshness monitor.

• Connected Handoff key/replay/assignment/delegate checks and independent Order/unique Buyer Grant monitors; no PICKUP/delegate Grant.

• Four-state Trust/Claim correction and separate Operator capability/Audit; high-risk audit failure closed.

• Privacy lifecycle/processor tasks, DPIA changes/consultation blockers and Authority/data-subject breach clocks operationally surfaced.

• All production web surfaces have approved CSP and report minimization; policy weakening/missing header detected.

• Seven dashboards, versioned SLIs/provisional targets, tested budget burn/severity/primary-backup alert routing and runbooks.

• Compatible schema/job/client rollback; scoped kill switches do not bypass owner truth.

• Actual backup/region/plan evidence and pre-traffic suppression restore drill; all failure/load/UI tests and 10 incident drills recorded.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 91. Final Architecture Diagram

![Operational observations remain separate from business truth](graphics/OBS_02.svg)
*Figure 02. Operational observations remain separate from business truth. Analytics measures product outcomes; Audit records authority; OBS detects and supports safe repair.*

Clients and API/workers carry safe technical context; Pino/Sentry and managed/provider signals feed bounded business-invariant monitors. Alerts/SLOs drive incident command, owner-safe mitigation/recovery and tested post-incident actions. Docker/GitHub Actions/Render/Cloudflare/EAS release metadata binds diagnosis and rollback.

## 92. Engineering Doctrine

Observe business correctness, not only machines. Keep Observability, Analytics, Audit and security signals distinct. Current owner facts establish truth; optional telemetry cannot manufacture or block canonical commerce. Strong authorization, money, privacy, Handoff and required Audit controls fail closed; eligible discovery may degrade safely. Use the current small-team stack and expand only after measured need and approval.

## 93. Appendix A - Current Technology Placement

| Layer | Approved current technology and role |
| --- | --- |
| Backend / data | Node.js, NestJS, Fastify, TypeScript strict; Drizzle ORM, PostgreSQL; pg_trgm, btree_gist, pg_stat_statements. |
| Async / API | Valkey + BullMQ; REST, OpenAPI, @nestjs/swagger, generated TypeScript client; PostgreSQL event_outbox/job_intent remains durable authority. |
| Security / media | @nestjs/throttler, @fastify/helmet, libphonenumber-js; Cloudflare R2, Cloudflare CDN, Sharp. |
| Mobile | React Native, Expo, Expo Router, TanStack Query, FlashList, Expo Image, Expo SecureStore, Expo SQLite, Expo Camera, Expo Notifications, Expo Updates; small Zustand store. |
| Quality / visibility | Jest, Testcontainers, Maestro, Playwright, k6; Sentry, Pino structured logs, pg_stat_statements; dependency-cruiser. |
| Delivery | Docker, GitHub Actions, Render, Cloudflare, EAS. No unapproved runtime, governance service or second worker engine is added. |

Pino/Sentry/provider metrics and supported context are sufficient current instrumentation. Dedicated OpenTelemetry packages/infrastructure and alternate telemetry vendors remain separately approved future evaluation.

## 94. Appendix B - Privacy, CSP & Governance References

| Reference | Purpose / authority |
| --- | --- |
| ADU-PRV-01 v3.2 | Data classes/purpose/retention, scoped holds, suppression and breach coordination. |
| ADU-CSP-01 v1.1 | Browser source policy, reporting/privacy, rollout/tests and emergency baseline. |
| ADU-DPIA-01 v1.1 | Screening, people's risks, mitigation evidence, legal/consultation and processing change gates. |
| L01 | https://justice.gov.et/en/law/personal-data-protection-proclamation/ - legal clock/application reviewed by Legal; no compliance certification here. |
| Sentry / Pino / W3C | Use current official SDK/runtime guidance and supported trace conventions; no dependency added by reference. |

## 95. Appendix C - Current Incident Runbooks

These are operational procedures, not evidence of completed drills. All require current authorized access, primary/backup owner contacts, safe diagnostic references and last-tested/due records. High-risk changes use governed owner commands and typed Audit; no mass SQL state setter.

### OBS-RB-01 - DB outage / saturation

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | DB outage / saturation confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Database owner; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Check provider/pool/locks/fingerprints and release. Pause amplification; bounded supported pool/revert migration; restore only with approved plan. |
| Recovery proof | Schema, paid/stock/Grant/hold invariants; suppression replay before traffic. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-02 - Valkey / BullMQ outage

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Valkey / BullMQ outage confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Eventing owner; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Check DB intent/delivery age and cache load. Stop retry amplification; reconnect gradually; deterministic intent re-enqueue. |
| Recovery proof | No duplicate owner effects; no lost paid/accepted/suppression facts. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-03 - PSP outage

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | PSP outage confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Finance owner; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Check active route and provider status; disable new affected attempts, keep existing verification/reconciliation. |
| Recovery proof | Exact current attempts/amounts; pending remains unresolved; no Seller/client-paid fallback. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-04 - Suspicious callbacks

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Suspicious callbacks confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Finance + Security; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Authenticate source/signature and match scope; fence compromised route, rotate approved credentials; never log raw body. |
| Recovery proof | Provider-verified replay dedup, no cross-Order paid or duplicate charge. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-05 - Double charge / money mismatch

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Double charge / money mismatch confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Finance + Orders; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Freeze faulty producer; identify bounded affected attempt refs; provider-confirmed refund/recovery only. |
| Recovery proof | Exact merchandise/delivery/0bps/total/currency and unique payment effect. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-06 - OTP providers failed

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | OTP providers failed confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Auth owner; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Verify approved primary/backup, safe rate limits and recipient delivery; activate configured backup or unavailable. |
| Recovery proof | Fresh purpose-bound challenge, canonical attempts, no bypass. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-07 - Unsafe FYP content

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Unsafe FYP content confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Content / Moderation; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Confirm owner safety gates; stop ranking version and serve only current safe fallback; contain exposure. |
| Recovery proof | No suspended/removed Seller or Product-only top-level unit. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-08 - Scene visibility inconsistency

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Scene visibility inconsistency confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Content + Search/FYP; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Deny current private/unavailable content, owner re-read tags/safety, repair projections/CDN. |
| Recovery proof | PRIVATE inaccessible publicly; exact held history retained; restock respects all gates. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-09 - Handoff signing / replay

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Handoff signing / replay confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Handoff + Security; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Stop compromised issuance, revoke unused scope/version, preserve accepted facts, rotate governed key and online recovery. |
| Recovery proof | Correct purpose/recipient/assignment, one accepted receipt, no offline success. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-10 - Review Grant lag

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Review Grant lag confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Reviews owner; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Inspect eligible final Handoff and consumer intent; bounded owner re-read/idempotent replay. |
| Recovery proof | One Buyer Grant per final_handoff_id; none for PICKUP/delegate. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-11 - Privacy deletion failure

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Privacy deletion failure confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Privacy + source owner; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Pause unsafe purge/rebuild, preserve hold/suppression, inspect failed mandatory proof and reconcile. |
| Recovery proof | No false completion; direct identity/derived/processor actions meet policy. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-12 - Personal-data breach

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Personal-data breach confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Privacy/Legal + IC; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Contain, record immutable awareness/time and affected classes, preserve restricted evidence, notify authorized legal contacts. |
| Recovery proof | Separate Authority/data-subject decisions/deadlines; submission/exception evidence, no clock reset. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-13 - CSP/XSS regression

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | CSP/XSS regression confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Web + Security; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Inspect actual header/release and minimized reports; disable risky embed/route; rollback last approved enforced baseline. |
| Recovery proof | No wildcard/eval/inline/framing downgrade; reporting outage does not remove enforcement. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-14 - Operator compromise

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Operator compromise confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Operator Auth + Security; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Revoke independent sessions/capabilities and affected keys, preserve typed Audit and restricted access timeline. |
| Recovery proof | No ordinary impersonation; least privilege restored, high-risk Audit works. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-15 - R2 / CDN incident

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | R2 / CDN incident confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Media owner; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Remove unsafe public binding; verify object/references/holds and active region; retry purge/delete gradually. |
| Recovery proof | Physical/derivative/CDN requirements verified; held private evidence survives. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-16 - Backup restore

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Backup restore confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | DB / Privacy / domain owners; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Restore isolated, replay authoritative newer suppression, reconcile derived/object state, verify before opening traffic. |
| Recovery proof | Actual RPO/RTO; Orders/Finance/stock/Grant/Scene/Audit/hold checks signed. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

### OBS-RB-17 - Bad release / migration

| Runbook field | Procedure |
| --- | --- |
| Trigger / impact | Bad release / migration confirmed by owner facts/synthetic or safe security observation; declare severity by actual people/commerce impact. |
| Owner / access | Deployment + domain owner; current scoped capability, Step-Up/Audit where required; primary/backup contact VERIFY CONFIGURATION. |
| Safe checks / mitigation | Check compatible schema/job/client versions, kill faulty producer, approved code rollback/expand-contract recovery. |
| Recovery proof | Smoke/current integrity plus no secret logs; record deployment and follow-up tests. |
| Escalation / close | IC timeline + privacy/legal if exposure; user update where appropriate; tested corrective owner/due date. Last-tested evidence OPEN. |

## 96. Glossary

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
