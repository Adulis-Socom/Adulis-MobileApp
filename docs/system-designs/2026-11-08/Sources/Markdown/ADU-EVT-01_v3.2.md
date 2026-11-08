# Adulis Eventing & Background Jobs
Version 3.2 | 13 October 2026 | DOCUMENT-CORRECTED

## Document control

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R01, R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026. |
| Source | ADU-EVT-01_Adulis_Eventing_Transactional_Outbox_Background_Jobs_Complete_System_Design_v3.1.pdf |
| Authority | 13 October contract prompt; selected 12 October owner decisions remain binding. |
| Status | DOCUMENT-CORRECTED; implementation, integration tests and external approvals not established. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |

## 1. Document Control

| Field | Value |
| --- | --- |
| Document ID | ADU-EVT-01 |
| Title | Adulis Eventing, Transactional Outbox & Background Jobs Complete System Design |
| Version | 3.2 |
| Date | 13 October 2026 (working baseline: 12 October 2026) |
| Architecture style | Modular monolith; PostgreSQL canonical truth; durable asynchronous execution |
| Canonical job technology | BullMQ |
| Queue datastore | Valkey |
| Event transport | PostgreSQL transactional outbox -> relay -> BullMQ |
| Job-intent transport | PostgreSQL transactional job intent -> relay -> BullMQ |
| Primary database | PostgreSQL + Drizzle ORM |
| Runtime | Node.js / NestJS / Fastify / strict TypeScript |
| Delivery semantics | At-least-once execution; idempotent business effects; typed retries; reconciliation |
| Product scope | Globally extensible; phased active Markets; Ethiopia first; connected-only application |

### Source precedence and reconciliation basis

This v3.0 design uses the original ADU-EVT-01 as the structural baseline, but current Adulis system designs override older product and technology assumptions. The current stack already establishes PostgreSQL + Drizzle as canonical persistence and Valkey + BullMQ as asynchronous infrastructure. Public projections in the updated Storefront architecture are explicitly refreshed through the transactional-outbox/BullMQ path, while Valkey remains non-canonical support state.

• Order/Checkout and Financial designs: provider-integrated payment, server-verified payment truth, one-Seller Orders, short-lived checkout allocations and provider reconciliation.

• Catalogue/Inventory, Content, Search, FYP and Media: Product Posts + Scene Posts, photo-only Adulis media, TikTok supplementary embed path, FYP eligibility driven by canonical current state.

• Handoff/Fulfilment: connected-only QR/OTP/Manual verification, delegated recipient support, courier assignment and delivery evidence.

• Onboarding/Auth/Market: no government-document verification dependency; English is the primary global language; Market context is explicit.

• Notifications/Chat/Chatbot: one ordinary Account across Buyer/Seller/Courier relationships, separate privileged Operator Accounts, multi-device delivery, timeline/system facts separated from human messages, deterministic bot responses and human escalation.

The supplied October 2026 update specification takes precedence over the structural v2 baseline. Current Scene visibility, two-basis Buyer/Order Review Grant, typed principal and phased Market contracts are reconciled throughout.

## 2. Reading guide and current edition

This complete edition uses the clickable Contents immediately after the cover. The original numbered architecture and appendices remain addressable; current Scene, account, Review Grant and Market contracts apply to every integration.

## 3. Executive Summary

Adulis needs one durable platform contract for committed business facts, asynchronous consequences, delayed work, external deliveries, retries, dead letters and recovery. This design keeps canonical business state in PostgreSQL and uses BullMQ on Valkey as the execution plane. The queue is deliberately treated as operational infrastructure, never as an alternate source of Product, Inventory, Order, Payment, Trust, Claim, Review or Handoff truth.

The central correctness problem is that a PostgreSQL transaction cannot atomically commit a Valkey queue write. The current architecture therefore uses a transactional outbox and, where a domain needs a direct asynchronous command or future deadline, a transactional job-intent row. A relay process reads those committed PostgreSQL records and enqueues BullMQ jobs with deterministic identities. Crashes between enqueue and acknowledgement are expected and safe because delivery is at-least-once, consumers are idempotent and reconciliation can repair gaps.

Core doctrine: commit business truth once; record durable async intent in the same PostgreSQL transaction; enqueue after commit; assume duplicate execution; make repeated execution harmless; reconcile critical consequences from canonical state.

## 4. Mission, Goals and Non-Goals

### Mission

Provide the canonical Adulis platform contract for domain events, transactional outbox records, background jobs, delayed jobs, external deliveries, retries, dead letters, replay, reconciliation, context propagation, queue isolation and production recovery.

### Goals

• No critical asynchronous consequence can disappear because a process crashed after committing business state.

• Every CRITICAL and IMPORTANT consumer is safe under duplicate delivery and duplicate execution.

• BullMQ is the one ordinary job engine; Valkey is the one current queue/cache datastore name.

• PostgreSQL remains canonical state; queue state never authorizes money, stock, permissions, Trust, Orders or Handoff.

• Market, actor, correlation, causation and policy-version context survive asynchronous boundaries.

• Critical deadlines remain reconstructable from canonical domain timestamps and are protected by reconciliation sweepers.

• External provider ambiguity is modeled explicitly rather than converted into blind retries.

• Queue capacity, lag, failure and recovery are observable and testable.

### Non-goals

• Full event sourcing

• Kafka/RabbitMQ/Temporal for MVP

• Distributed exactly-once delivery

• Putting every analytics impression into BullMQ

• Putting business invariants inside queue handlers

• Offline client business mutation queues

• Government-document verification workflows

• A second overlapping job engine

## 5. Canonical Architecture Decisions

| Decision | Current canonical ruling |
| --- | --- |
| Execution engine | BullMQ only for ordinary background work. |
| Queue datastore | Valkey. It is execution/cache infrastructure, not business truth. |
| Domain persistence | PostgreSQL via Drizzle ORM. |
| Event durability | Application-owned immutable transactional outbox in PostgreSQL. |
| Direct async intent | Application-owned transactional job intent row in PostgreSQL. |
| Cross-store handoff | Relay claims committed rows, enqueues BullMQ, records delivery outcome, repairs ambiguity by reconciliation. |
| Delivery semantics | At-least-once. No distributed exactly-once claim. |
| Correctness | Database constraints, row locks, idempotency identities, current-state revalidation. |
| Clients | Connected-only; a client-side optimistic state never becomes a durable domain event by itself. |
| Payment | Provider-integrated; server/provider verification owns paid state. |
| Content | Product Posts + Scene Posts. FYP serves Scene Posts only; Search can serve both plus Sellers. |
| Media | Adulis-hosted images only; TikTok embed is supplementary Product Post content, not a native video-processing workload. |

## 6. Current Product Context

The architecture is globally extensible and Market-aware; commerce activation is phased, with Ethiopia as the first active launch Market. Future Markets require explicit approved Market Configuration and operational readiness. Server-derived canonical Market context wins over client country fields, IP, phone prefix, locale or worker region. Global-ready code never activates commerce by itself.

One human uses one ordinary Adulis Account across Buyer capability, Seller ownership relationships, Seller-team participation and Courier profile/relationships. Different humans use different Accounts; Seller credentials are never shared. At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the MVP team slot. Multiple roles within that membership compose by current effective permission union. Ownership and Courier relationships are separate from the team slot.

Switching Buyer, Seller or Courier context changes presentation and scoped authority, never the human's identity. An unrelated Courier or Seller relationship cannot grant access to a Buyer Order, another Seller's records or privileged operations.

Product/Scene discovery -> Seller Cart -> final Checkout review -> provider attempt -> backend/provider verification -> independent PAID Seller Order -> Fulfilment -> accepted final Buyer/delegate Handoff -> completion and typed Review/Trust/Claim consequences. A short CheckoutAllocation remains internal and provider-attempt bound; no Buyer product-hold model exists.

Connected QR is primary, OTP fallback and audited Manual recovery. Pickup is not final Buyer receipt. Qualifying accepted final DELIVERY to the Buyer or active authorized delegate unlocks exactly one Buyer-owned Review Grant; delegate receipt does not transfer Review authorship.

Adulis social-commerce Seller admission uses no government-document requirement. Provider compliance/KYC belongs to the financial provider boundary and never enters general events or queue evidence payloads.

## 7. Domain Ownership

| Domain | Owns canonical truth | Representative events | Representative jobs |
| --- | --- | --- | --- |
| Accounts/Auth | Ordinary Accounts/relationships/credentials/sessions; separate Operator Accounts/credentials/sessions/capabilities | account.created; account.deletion_requested; session.revoked | revoke_sessions; purge_expired_sessions |
| Seller/Onboarding | Seller record, social admission/readiness | seller.created; seller.eligibility_changed; seller.social_verification_changed | recompute_seller_readiness |
| Catalogue/Inventory | Products, Product Posts, Variants, exact stock | product_post.published; product_post.unpublished; inventory.changed | Content-owned recompute_scene_visibility; Search/Storefront refresh and Checkout repair |
| Content | Scene root/revision/tags; publication, PUBLIC/PRIVATE visibility and archive/delete | scene_post.published; scene_post.revised; scene_post.visibility_changed; scene_post.archived; scene_post.deleted | recompute_scene_visibility; refresh_fyp_features; refresh_search_projection |
| Checkout/Orders | Cart validation, checkout allocations, Order lifecycle | checkout.allocation_created; checkout.allocation_released; order.paid; order.completed | expire_checkout_allocation; reconcile_order_payment |
| Payments/Finance | Payment attempts, provider verification, settlement/refunds | payment.attempt_created; payment.verified; payment.failed; refund.status_changed | verify_payment_attempt; reconcile_provider_payment; reconcile_refund |
| Fulfilment/Courier | Courier pools, assignment, delivery lifecycle | delivery.assigned; delivery.started; delivery.completed; delivery.cancelled | expire_delivery_offer; notify_courier_offer |
| Handoff | Pickup/final Handoff evidence | handoff.verified; handoff.verification_failed | post_handoff_followup |
| Reviews | One Buyer-owned grant per paid Seller Order across receipt/failure bases; one Review container | review.published; consumes final handoff.verified and eligible claim.decision_recorded | resolve_order_feedback(order_id); one Grant / received-only aggregates |
| Claims | Claim lifecycle, decisions, evidence references | claim.opened; claim.decision_recorded; claim.resolved | claim_followup |
| Trust/Safety | Trust level, policy evaluation, restrictions | trust.level_changed; moderation.enforcement_changed (Moderation owner) | recompute_trust; apply_claim_trust_consequence |
| Moderation | Enforcement state | moderation.enforcement_changed | refresh_public_eligibility |
| Notifications | Logical notifications and delivery state | notification.created; notification.delivery_recorded | send_notification_delivery |
| Media | Image asset state and derivatives | media.image_uploaded; media.image_ready; media.image_failed | process_image; generate_image_derivatives |
| Search/Collections | Search projections; collection membership | collection.item_added; collection.item_removed | refresh_search_projection |
| Analytics | Event semantics and aggregates | separate batched telemetry + selected domain bridge | aggregate_metrics; bounded backfills |

Domain workers invoke owning application services and never write unrelated Content/Review tables. Inventory emits facts; Content alone changes Scene visibility; Reviews alone creates the two-basis Buyer/Order grant. Consumer failure is independent across domains.

## 8. Events vs Commands vs Jobs

| Concept | Meaning | Example | Canonical truth? |
| --- | --- | --- | --- |
| Domain event | Past-tense fact already committed | order.completed | Fact is canonical in owning domain; event is durable integration record. |
| Integration event | Versioned contract exposing a domain fact | review.published v1 | No new truth beyond owner. |
| Command | Request that may fail | publish_product_post | No. |
| Job | Durable asynchronous execution request | refresh_search_projection | No. |
| Delayed job | Job whose earliest execution time is future | expire_checkout_allocation | No; domain deadline/timestamp is authoritative. |
| Outbox row | Immutable event transport record | E1: order.completed | Delivery/replay record, not current-state store. |
| Job intent | Durable Postgres record requesting queue execution | J1: reconcile_provider_payment at T | Intent durability bridge, not domain truth. |

Contract_Registry separates domain_events from job_intents and non_domain_classes. Commands, internal audit/timeline rows, analytics intake, BullMQ names and Notification template keys are not inferred to be domain events from punctuation. Protected handoff.delegate_invitation resolves only as a Handoff job intent.

## 9. Canonical Event Model

Every cross-domain fact is an immutable owner outbox row with registered event name/version and frozen event-time meaning. Runtime authorization and closed scope validation precede storage and delivery; a client cannot publish canonical financial/Order facts.

```
// Conceptual TypeScript contract; runtime validation is mandatory.
type ActorContext =
 | { actor_type: 'ANONYMOUS_PUBLIC'; anonymous_ref: string;
     ordinary_account_id?: never; operator_account_id?: never }
 | { actor_type: 'ORDINARY_ACCOUNT'; ordinary_account_id: string;
     operator_account_id?: never; seller_context_id?: string }
 | { actor_type: 'OPERATOR_ACCOUNT'; operator_account_id: string;
     ordinary_account_id?: never; seller_context_id?: string }
 | { actor_type: 'SYSTEM'; trusted_service_ref: string;
     ordinary_account_id?: never; operator_account_id?: never };
type EventScope =
 | { scope: 'GLOBAL'; market_id?: never; originating_market_id?: string }
 | { scope: 'MARKET'; market_id: string; originating_market_id?: never };
type AdulisEventEnvelope<T> = EventScope & {
 event_id: string; event_type: string; event_version: number;
 occurred_at: string; aggregate_type: string; aggregate_id: string;
 aggregate_revision: number; logical_effect_id: string;
 actor: ActorContext; request_id?: string; correlation_id: string;
 causation_id?: string; policy_version?: string; payload: T;
};
```

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

Storage constraints distinguish typed ordinary/Operator FKs, anonymous purpose-bound reference and authenticated SYSTEM provenance. GLOBAL Account lifecycle has no owner Market. MARKET owner facts require validated canonical resource Market. Registry restricts which principal/scope combination can emit each fact; anonymous analytics intake is not authority to emit commerce outcomes. Reject unexpected identifiers/fields at runtime. Payloads exclude private bodies, contacts, credentials and raw case evidence. Historical events retain original names/versions; explicit versioned compatibility never creates a second new fact.

The authoritative event discriminator is (event_type, event_version), matching §47 and the supplied closed registry. Payload schema $id/$ref is a schema document identity, not an alternative envelope schema_version. Registry owner/allowed principal/scope validation requires authenticated execution provenance plus current owner authorization; shape validation alone grants no authority.

## 10. Transactional Outbox

When an owning domain changes canonical state and other domains must react, the canonical state mutation and outbox insert commit in the same PostgreSQL transaction. Unlike the previous job-engine design, the transaction does not attempt to write Valkey. That would create an unsafe dual-write boundary.

```
BEGIN;
  -- canonical domain mutation
  UPDATE orders SET state = 'COMPLETED', completed_at = now() WHERE id = :order_id;
```

```
  -- immutable cross-domain fact
  INSERT INTO platform.event_outbox (...)
  VALUES (..., 'order.completed', 1, ...);
COMMIT;
```

```
-- after commit, Outbox Relay enqueues BullMQ work
```

Forbidden: commit PostgreSQL business state and then directly call BullMQ from the request path without an outbox/job-intent recovery record. A process crash between those two actions would lose the asynchronous consequence.

![One complete registry, independent filtered deliveries](graphics/EVT_01.svg)
*Figure 01. One complete registry, independent filtered deliveries. Analytics, audit/timeline, commands, queue names and notification templates remain separate classes.*

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

Domain mutation plus exact outbox/job intent remains atomic. Finance fact and Order/Inventory readiness are two durable owner stages, never one network/database transaction.

## 11. BullMQ + Valkey Execution Plane

BullMQ is the current ordinary background-job library and Valkey is the queue datastore. BullMQ handles runnable/delayed job state, attempts, locks, priorities, worker coordination and scheduler metadata. Adulis still owns event meaning, job contracts, idempotency, dead-letter policy and domain recovery.

| Concern | Owner |
| --- | --- |
| Business truth | Owning PostgreSQL domain table |
| Event fact | platform.event_outbox |
| Cross-store delivery status | platform.event_delivery / job_intent |
| Runnable/delayed physical job | BullMQ on Valkey |
| Business-effect uniqueness | PostgreSQL constraint / processed_event / natural key |
| Cache/rate limit state | Valkey where explicitly allowed |
| Replay/audit | Application tables and typed tooling |

Launch must pin BullMQ and Valkey versions together and run compatibility/load tests against the exact production topology. Valkey protocol compatibility is an infrastructure assumption to verify, not a reason to let queue state become authoritative.

## 12. Cross-Store Atomicity and Relay

PostgreSQL and Valkey do not share a distributed transaction. Correctness therefore comes from a relay with explicit ambiguous states and reconciliation.

### Outbox relay algorithm

```
1. claim a small batch of un-dispatched events in PostgreSQL
2. write/refresh event_delivery rows for registered consumers
3. commit the lease/claim transaction
4. enqueue each consumer job to BullMQ with deterministic jobId
5. mark delivery QUEUED after enqueue succeeds
6. if process crashes between 4 and 5, reconciliation retries enqueue
7. duplicate physical execution is safe by consumer idempotency
```

### Relay leasing

Use short PostgreSQL leases such as relay_owner + lease_expires_at. Claiming and lease renewal are database operations; no Valkey network call occurs while holding a long business transaction. A stale lease is recoverable by another relay instance.

### Ambiguous enqueue

If Valkey accepted the job but the relay lost its response, the delivery state becomes enqueue-unknown. Re-enqueue with the same deterministic identity where possible; regardless of queue-level dedupe retention, business idempotency remains the final safety boundary.

## 13. Event Delivery Registry

For each outbox event and registered consumer, platform.event_delivery records delivery intent and result independently. Failure of one consumer never blocks creation or execution of another consumer.

| State | Meaning |
| --- | --- |
| PENDING | Delivery row exists; queue enqueue not yet confirmed. |
| ENQUEUE_UNKNOWN | Queue may have accepted; relay must retry/reconcile safely. |
| QUEUED | BullMQ accepted a physical job. |
| PROCESSING | Worker has started logical processing where audit requires it. |
| SUCCEEDED | Consumer consequence applied or proven already applied. |
| SKIPPED | Current state makes consequence unnecessary. |
| DEAD_LETTERED | Automatic handling exhausted; typed operational repair required. |

Materialize independent deliveries only for the selected registered consumers/filters. A handoff.verified PICKUP cannot match REV_FINAL_DELIVERY. Replay uses the same logical_effect_id; current owner re-read rejects stale revisions and correction supersession. PostgreSQL processed effects are per consumer; BullMQ job removal never releases their uniqueness.

## 14. Transactional Job Intents

Some work is a direct asynchronous command rather than a reaction to a public domain event. Examples include policy-driven deletion steps, a future execution deadline, reconciliation requested by an Operator, or a provider-status check. For these cases the owning transaction may insert platform.job_intent.

```
BEGIN;
  UPDATE checkout_allocation SET expires_at = :t WHERE id = :id;
  INSERT INTO platform.job_intent(
    logical_job_id, job_type, run_at, market_id, aggregate_id, payload, state
  ) VALUES (..., 'expire_checkout_allocation', :t, ..., 'PENDING');
COMMIT;
```

```
Job Intent Relay -> BullMQ delayed job -> Worker re-reads canonical state
```

The intent row closes the durability gap created by the Postgres-to-Valkey boundary. A recurring reconciliation scan can rematerialize missing BullMQ jobs from still-pending intents.

## 15. Canonical Job Model

```
interface AdulisJobEnvelope<T> {
  logical_job_id: string;
  job_type: string;
  job_version: number;
  market_id?: string;
  priority_class: "P0"|"P1"|"P2"|"P3"|"P4";
  criticality: "CRITICAL"|"IMPORTANT"|"BEST_EFFORT";
  run_at?: string;
  correlation_id: string;
  causation_id?: string;
  source_event_id?: string;
  aggregate_type?: string;
  aggregate_id?: string;
  actor_context: ActorContext;  // shared typed principal union from Section 9
  payload: T;
}
```

BullMQ-specific properties such as queue name, attempts, backoff, delay, priority, jobId and remove-on-complete policy are derived from the typed task registry. They do not belong to business truth.

Persist safe durable typed actor provenance, not the original HTTP request, cookie, JWT or session. Worker service authority and current authorization reconstruction are independent of initiating credentials. Use the same principal FK/CHECK constraints on durable job metadata.

For the protected Handoff invitation entry, registry intent_type maps exactly to the existing AdulisJobEnvelope.job_type, and intent_version maps to job_version. The closed payload schema validates payload; logical_job_id is the durable invitation intent/effect identity. These are one name/version pair expressed in the registry and job envelope, not parallel independent versions or new storage columns. It never enters the domain-event parser or ordinary Notification recipient model.

## 16. Context Propagation

A background worker never reuses the original HTTP request object, cookie, access token or session. Durable metadata carries only the identifiers needed to reconstruct safe context.

• market_id or a safely derivable aggregate Market

• actor_type with separate ordinary_account_id or operator_account_id and optional Seller context

• request_id when useful for trace correlation

• mandatory correlation_id

• causation_id identifying immediate cause

• aggregate reference

• policy/config version when event meaning depends on it

Market is never inferred from IP, phone prefix, device locale, worker region or a default country. A cross-Market mutation attempt fails closed and is treated as a security incident.

## 17. Consumer Registry

Finance first commits each authenticated, server-verified external charge and its stable provider identity. The Order application then uses approved Finance/Inventory owner interfaces in ONE shared PostgreSQL transaction to lock current Order/attempt-generation/allocation state, validate the preserved charge, secure/consume stock, transition operational Order PAID, record effect/history and write its outbox. Repositories stay private; provider network calls are outside this transaction. CHARGE_VERIFIED_ORDER_PROCESSING is explicit before commit; Seller preparation/fulfilment is unavailable until joint PAID/stock commit. Notifications/Analytics/projections follow asynchronously, stock consumption does not.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Stock/Order readiness requires the declared joint owner transaction. Grant creation uses current canonical basis and durable Order/Buyer uniqueness; delayed/replayed events cannot create a second opportunity.

## 18. At-Least-Once and Idempotency

The platform explicitly assumes duplicate enqueue, duplicate execution, worker crash after commit, delayed replay and out-of-order delivery. Correctness is therefore expressed as exactly-once business outcome where required, not exactly-once transport.

### Preferred idempotency order

• Natural business unique key when one exists.

• Processed-event marker committed in the same transaction as the effect.

• Deterministic external effect_id for provider calls.

• Queue-level jobId/dedup only as an optimization, never the sole correctness mechanism.

### Examples

• One rating contribution per review_id + rated_entity_id.

• One Trust consequence per claim_id + policy_consequence_type + policy_version.

• One canonical Notification per source_event_id + purpose + recipient account.

• One payment verification result per provider transaction/reference identity.

• One checkout allocation expiry transition per allocation_id + deadline_version.

• One Review Grant per qualifying final_handoff_id, enforced in PostgreSQL regardless of queue dedupe.

• Logical Notifications distinguish typed recipient principal plus source/purpose/context; multi-device delivery does not duplicate the logical notice.

## 19. External Side Effects

Push, SMS, email, object-storage operations, social-provider checks and payment-provider requests cannot be rolled back with PostgreSQL. The worker must use a deterministic logical effect identity and persist attempt state before making the external call where practical.

| Step | Required behavior |
| --- | --- |
| Prepare | Create/find effect record keyed by deterministic effect_id. |
| Idempotency | Send provider idempotency key when supported. |
| Attempt | Record attempt metadata without dumping sensitive payloads. |
| Known success | Persist safe provider reference/status. |
| Known permanent failure | Mark terminal; do not retry forever. |
| Ambiguous timeout | Do not create a new logical effect blindly; reconcile or retry under provider semantics. |
| Crash after success | Retry sees same effect identity and avoids duplicate business outcome. |

## 20. Retry, Backoff and Circuit Breaking

| Failure class | Examples | Default action |
| --- | --- | --- |
| TRANSIENT | network timeout, temporary DB connection issue | bounded exponential retry + jitter |
| RATE_LIMIT | provider 429/quota | honor Retry-After where valid; jittered retry |
| DEPENDENCY_UNAVAILABLE | provider 5xx, storage outage | circuit breaker / reduce concurrency + retry |
| PERMANENT_VALIDATION | invalid phone, deleted image asset, malformed payload | terminal or dead-letter according to criticality |
| STATE_CONFLICT | aggregate moved to incompatible state | re-read; safe no-op or bounded optimistic retry |
| POISON_PAYLOAD | deterministic code/payload failure | bounded attempts -> dead letter + grouped alert |
| SECURITY_FAILURE | cross-Market mutation, unauthorized Operator action | no retry; security alert + audit |
| UNSUPPORTED_VERSION | unknown event/job version | no coercion; dead letter/alert |

BullMQ retry/backoff is useful transport behavior. Provider-facing work may override with application-calculated delay when Retry-After, provider-specific reconciliation or circuit-breaker state requires it.

## 21. Criticality and Priorities

| Class | Meaning | Examples | Exhaustion |
| --- | --- | --- | --- |
| CRITICAL | Required for safety, money, security or lifecycle convergence | payment verification/reconciliation; Claim->Trust consequence; account/session revocation; required retention | dead letter + high-severity alert + reconciliation + owner action |
| IMPORTANT | User-facing or important derived state | transactional notifications; Search/FYP projection; rating aggregates | dead letter + alert/repair; canonical transaction remains committed |
| BEST_EFFORT | Non-essential enrichment | low-value engagement notification; optional analytics bridge | may stop after bounded attempts if loss is explicitly acceptable |

Priority classes are mapped by queue policy, not by arbitrary callers. P0/P1 work gets dedicated worker capacity. A flood of P4 backfill work must not starve payment, security, Claim or Trust convergence.

## 22. Dead Letters and Replay

Adulis keeps an application-owned platform.async_dead_letter record because queue-retained failures are not enough for domain ownership, privacy policy, correlation, operator workflow and controlled replay.

• Store logical_job_id, source_event_id, owner domain, Market, aggregate ref, failure class/fingerprint, sanitized summary, attempt count, effect_may_have_happened, replay count and resolution status.

• Never store large raw payloads, private message bodies, access tokens, OTPs or provider secrets in dead letters.

• CRITICAL dead letters remain unresolved until the effect is applied, proven unnecessary or replaced by an audited corrective action.

### Replay

Job replay repeats one logical execution request. Event replay is consumer-scoped: replaying review.published for rating repair must not resend Buyer notifications. Replay never recreates the originating domain fact.

Operator Account is a separate internally provisioned privileged principal, with independent credentials, strong authentication, OPERATOR sessions, recovery, revocation and audit identity. Ordinary Account roles, phone OTP, public registration and Mode switching do not create Operator authority. The same person may possess both principals, but their authorization and identifiers remain distinct.

Privileged commands require the separate Operator Account, a current narrow capability, exact Market/resource/case scope, purpose/reason and audit, with fresh authentication and approval where existing Operator governance requires it. No generic superuser bypass, arbitrary state setter or impersonation path is introduced.

Consumer-scoped replay/repair requires a typed action, current capability, exact scope, reason and immutable Operator-account audit. No generic arbitrary JSON queue editor or direct domain setter is exposed.

## 23. Reconciliation and Backfills

| Reconciler | Canonical source | Repairs |
| --- | --- | --- |
| reconcile_outbox | event_outbox + event_delivery + consumer registry | missing/stale queue deliveries and stale relay leases |
| reconcile_job_intents | job_intent + BullMQ-aware audit state | pending/ambiguous direct jobs not durably materialized |
| reconcile_payment_attempts | payment attempts + provider API | missed/delayed callback verification |
| reconcile_checkout_allocations | checkout allocation state + deadlines | overdue allocation release/consume decisions |
| reconcile_rating_stats | Reviews + Review Grants | Seller/Product rating projections |
| reconcile_trust_consequences | Claims + Orders + Handoffs + Reviews + Trust policy | mandatory Trust consequences and recomputation drift |
| reconcile_fyp_eligibility | Scene publication/visibility/revision + Product/Inventory + Seller + active Market + Moderation + Media; Trust/public features as appropriate | Stale eligibility/features; fail closed at request time |
| reconcile_search_projection | Current Product Posts + Scene Posts + Sellers | Missing/stale typed Search projections |
| reconcile_notification_state | Notifications + delivery attempts | stuck/inconsistent delivery status |

Backfills are bounded historical rebuilds with checkpointed batches. They use canonical current tables unless exact event-time semantics are required. Large fan-out is rate-limited and resumable.

### Content-owned visibility convergence

inventory.changed and relevant Product facts trigger recompute_scene_visibility through a Content consumer. It identifies affected Scenes in bounded checkpointed batches, re-reads canonical tags/Product/Inventory/Seller/Market/Moderation/Media state and calls the Content application service. Eventing and Recommendation never directly set visibility or archive a Scene for stock loss.

Content commits PUBLISHED + PUBLIC -> PUBLISHED + PRIVATE when eligible_available_product_count becomes zero, with ALL_TAGGED_PRODUCTS_UNAVAILABLE. Restock reevaluates and may restore PUBLIC only when all gates pass. Content emits one deliberate versioned scene_post.visibility_changed contract; do not emit redundant became_private/became_public variants ; no new independent alias is permitted.

Visibility payload contains scene_post_id, revision_id, seller_id, market_id, from_visibility, to_visibility, reason_code, occurred_at and lifecycle/policy version; no whole caption/media body. FYP, Search, Storefront, Collections current-state resolution, Notifications, Analytics and cache invalidation consume independently. Projection refresh is IMPORTANT and safety-sensitive; canonical response-time eligibility, reconciliation and stale-public alerts remain mandatory.

![Canonical Scene and Inventory facts, versioned durable effects](graphics/EVT_02.svg)
*Figure 02. Canonical Scene and Inventory facts, versioned durable effects. Legacy mapping requires actual compatibility evidence and resolves to the same logical business effect.*

## 24. Scheduled and Deadline Jobs

BullMQ delayed jobs and Job Scheduler capability provide execution timing, but the queue timestamp is never the authoritative business deadline. The deadline lives in PostgreSQL on the owning row and normally includes a deadline_version.

### Hybrid deadline pattern

```
canonical row stores deadline_at + deadline_version
    |
    +--> job_intent(run_at = deadline_at)
            |
            +--> BullMQ delayed job
```

```
worker executes -> lock/re-read canonical row
    |-- already resolved -> no-op
    |-- deadline version changed -> no-op
    |-- not yet due -> re-schedule/no-op
    |-- due and allowed -> canonical transition + outbox event
```

```
recurring sweeper independently finds overdue canonical deadlines
```

![Canonical deadline and current state win over queue time](graphics/EVT_03.svg)
*Figure 03. Canonical deadline and current state win over queue time. A delayed execution request never proves a deadline transition is legal. PostgreSQL timestamp/version, row locking, payment state and sweepers decide and repair.*

Payment timer jobs trigger owner reconciliation under confirmed finality, never blind allocation release. Delegate-invitation intent generation/expiry is re-read before SMS dispatch; old delayed jobs cannot revive revoked contacts.

## 25. Checkout Allocation and Payment Jobs

The current purchase architecture does not use the old pre-payment hold lifecycle. A short-lived internal CheckoutAllocation can protect scarce stock while a concrete provider attempt is active. It is bound to an Order/Checkout attempt and is invisible as a separate Buyer product.

### Allocation deadline job

```
expire_checkout_allocation(allocation_id, attempt_generation, deadline_version):
  # Pseudocode: network evidence gathering outside PostgreSQL transaction.
  call Order.reconcile_attempt with durable job/effect identity
  Order locks Order + attempt/dispatch + allocation through owner interfaces
  re-read Finance charge/finality and current generation/revision
  if stale generation or consumed/released: return recorded result/no-op
  if verified charge: use existing joint stock + operational PAID transaction
  else if durable uninitiated proof: fence dispatch, then release once
  else if confirmed adapter release/finality evidence passes ORDER 35/46:
    persist release evidence/effect and release once
  else: retain required stock; protected RECONCILING; escalate honestly
  commit canonical history and outbox/job intent with the transition
```

A delayed queue job never releases stock merely because its scheduled time arrived. Current payment/provider state and allocation policy always win.

## 26. Provider Payment Reconciliation

Payment truth belongs to Payments/Finance and the provider adapter. Provider webhooks, verification responses and reconciliation may arrive more than once or out of order.

• Webhook intake validates provider authenticity, parses to a provider event record and uses provider transaction identity for deduplication.

• A client return URL is navigation context only and never creates payment.verified.

• Payment verification may be synchronous where required for immediate UX, with BullMQ used for retries/reconciliation when the provider is delayed or unavailable.

• Missed callbacks are repaired by reconcile_provider_payment with bounded provider concurrency.

• Refund and settlement status use the same idempotent/reconciliation doctrine.

Callbacks, deadline/cancel handlers and repair jobs share ORDER §35/46. Provider not-found, missing callback and network failure are not conclusive no-charge facts. The adapter version/evidence must establish safe release for possibly initiated attempts; job retry cannot infer finality or release another generation.

## 27. Recurring Jobs and Schedulers

Recurring work is limited to bounded global/Market scans: outbox repair, job-intent repair, payment reconciliation, critical deadline sweeps, retention scanning, provider health checks and projection reconciliation.

Do not create one recurring scheduler per Buyer, Product or Order. Per-entity deadlines use delayed jobs; recurring jobs scan due canonical rows in bounded pages. Scheduler definitions use deterministic identities and are registered idempotently across multiple worker replicas.

## 28. Concurrency and Resource Isolation

| Worker pool | Task scope | Initial guidance |
| --- | --- | --- |
| worker-critical | P0/P1 payment, Claims/Trust, security, required deadlines | small concurrency; independent capacity |
| worker-general | notifications, ratings, Search/FYP/Storefront projections, outbox relay support | moderate I/O concurrency |
| worker-media | image validation, Sharp transforms, derivatives | low CPU concurrency; isolated process |
| worker-maintenance | reconciliation, retention, backfills | low priority; bounded concurrency |

Critical state transitions still use PostgreSQL locks, optimistic versions and unique constraints. Queue serialization is not enough to protect business invariants. CPU-heavy Sharp work must not share the same hot event loop as critical transactional workers.

## 29. Backpressure and Queue Separation

One technology can have multiple queues. Recommended logical queues are critical, default, notifications, media and maintenance. Queue count stays small and stable; do not create a queue per Seller or Order.

Backpressure signals include oldest waiting age by criticality, active count, delayed count, retry rate, failure rate, outbox relay lag, job-intent lag, worker utilization, provider throttling and Valkey memory/latency. Mitigation order: pause backfills, reduce low-priority concurrency, trip provider circuit breakers, coalesce current-state projections, scale workers, then scale Valkey/compute based on profiling.

## 30. Graceful Deployment and Versioning

Rolling deploys may run old and new workers simultaneously. New producers do not emit an event/job version until all active consumers support it. Use expand-and-contract schema changes and keep handlers compatible with queued versions until the active retention window drains.

• On SIGTERM, Workers stop accepting new jobs and drain active work within a bounded termination window.

• Abrupt crash is expected to produce retry/stalled recovery; idempotency must make re-execution safe.

• A stale job re-checks feature flags and canonical state at execution time.

• No application code couples to undocumented Valkey key shapes owned by BullMQ.

## 31. Security and Data Minimization

• Validate job_type, job_version and payload schema before any business logic.

• Validate market_id against the canonical aggregate before mutation.

• Operator-created jobs require typed permissions, reason, audit reference and environment guardrails.

• Worker credentials are least-privilege and separated by process class where practical.

• Never place session tokens, OTPs, payment credentials, raw Claim evidence, private Chat bodies or government-document data in queue payloads.

• Logs include opaque IDs, correlation IDs, result codes and sanitized errors rather than raw payload dumps.

• Valkey access is private network/TLS/authenticated according to deployment capability; it is not a public endpoint.

• BullMQ Dashboard/engineering tools, if used, are restricted to engineering/operations and cannot mutate arbitrary business state.

Ordinary Account and Operator Account actor IDs remain distinguishable in jobs, event rows, audit and dead-letter provenance. Operator commands use the separate OPERATOR security boundary; queue inspection never grants business authority.

## 32. Retention and Privacy

The outbox is operational transport/replay staging, not permanent event sourcing. Retention is versioned by Privacy/Data Lifecycle policy. Suggested starting defaults remain conservative and may be shortened or extended by policy.

| Record | Starting default | Constraint |
| --- | --- | --- |
| event_outbox after all critical consumers terminal | 30 days | Do not purge while unresolved critical delivery/dead-letter dependency exists. |
| processed_event | replay window + safety margin; start 45 days | Must outlive the event replay window it protects. |
| async_job_audit: successful CRITICAL | 30 days | Data-minimized. |
| async_job_audit: successful IMPORTANT | 14 days | May reduce if metrics are sufficient. |
| best-effort success detail | 3-7 days | Prefer aggregates. |
| dead letters after resolution | 90 days provisional | Privacy/legal/business audit may change. |
| external delivery attempts | Owning Notifications/Auth/Payment policy | No message bodies, secrets or raw provider payload dumps. |

## 33. Observability and Alerting

| Signal group | Required visibility |
| --- | --- |
| Outbox | created rate, un-dispatched count, oldest age, relay lease age, dispatch latency, reconciliation repairs |
| Job intents | pending/ambiguous count, oldest due age, enqueue lag |
| BullMQ | waiting/active/delayed/completed/failed counts, retry/stalled rate, duration by job type, queue latency |
| Workers | replicas, concurrency, event-loop lag, memory/CPU, restarts, drain time |
| Valkey | latency, memory, evictions policy safety, connection errors, failover/restart signals |
| Consumers | event-to-start, event-to-success, dedup count, unsupported versions |
| Dead letters | open count, oldest age, owner, fingerprint, replay count |
| Providers | attempts, known success, permanent rejection, ambiguous timeout, 429/5xx, circuit state |
| Deadlines | due backlog, oldest overdue canonical deadline, repair count |

Sentry captures errors/releases; Pino emits structured redacted logs; pg_stat_statements diagnoses PostgreSQL load. Queue/job IDs belong in logs/traces, not high-cardinality metrics labels.

Monitor Scene PRIVATE transition/invalidation lag, stale public exposure and all-gate PUBLIC restoration projection lag. Alert on Review Grant trigger mismatch/duplicate identity and typed principal FK violations.

## 34. Failure Matrix

| Failure | Expected behavior |
| --- | --- |
| API process crashes after DB commit | Outbox/job-intent row remains; relay later enqueues. |
| Relay crashes before enqueue | Lease expires; another relay retries. |
| Relay enqueues but crashes before DB acknowledgement | Delivery becomes ambiguous; deterministic enqueue + consumer idempotency makes retry safe. |
| Worker crashes during DB transaction | Transaction rolls back; BullMQ retry/stalled recovery re-executes. |
| Worker crashes after DB commit before acknowledgement | Job may run again; processed marker/natural key prevents duplicate business effect. |
| Valkey unavailable | New queue work cannot run; PostgreSQL business commits can still preserve outbox/job intent where owning API policy allows; critical backlog is visible and repaired after recovery. |
| PostgreSQL unavailable | Canonical business mutations stop; workers that need truth fail/retry; queue cannot invent state. |
| Provider succeeds but network times out | Keep same logical effect identity; reconcile before new logical send. |
| Queue backlog grows | Protect critical queues, pause maintenance/backfills, scale workers/Valkey after profiling. |
| Poison job | Bounded retries -> application dead letter + grouped alert. |
| Unsupported version | No coercion; dead letter/alert. |
| Out-of-order event | Current-state consumer re-reads canonical state; stale event cannot resurrect content. |
| Scheduler/worker outage across deadline | Delayed job executes after recovery; sweeper repairs from canonical timestamp. |

## 35. Event Catalogue

| Event / event_version | Owner / producer | Registered consumers / filter |
| --- | --- | --- |
| account.created / 1 | Accounts / AUTH §123 | Notifications; Analytics |
| account.deletion_requested / 1 | Account Lifecycle / AUTH §52/140 | Auth; Privacy |
| account.deleted / 1 | Account Lifecycle / WEB §39 | Privacy; Auth; Recommendation |
| session.revoked / 1 | Auth / AUTH §38/118/123 | Auth; Security |
| seller.created / 1 | Seller / ONB §141 | Onboarding; Notifications; Analytics |
| seller.eligibility_changed / 1 | Seller Eligibility / EVT §35 | Content; Search; Recommendation; Storefront; Trust |
| seller.social_verification_changed / 1 | Onboarding / EVT §35 | Seller Eligibility; Audit |
| seller.social_connection.verified / 1 | Onboarding / ONB §141 | Seller Eligibility; Audit |
| seller.social_connection.revoked / 1 | Onboarding / ONB §141 | Seller Eligibility; Media; Audit |
| seller.eligibility.evaluated / 1 | Seller Eligibility / ONB §141 | Onboarding; Audit |
| seller.eligibility.satisfied / 1 | Seller Eligibility / ONB §141 | Onboarding; Audit |
| seller.readiness.changed / 1 | Onboarding / ONB §141 | Seller Console; Notifications |
| seller.onboarding.completed / 1 | Onboarding / ONB §141 | Seller Console; Notifications; Analytics |
| product.created / 1 | Catalogue / CATINV §93 | Search; Storefront; Analytics |
| product.updated / 1 | Catalogue / CATINV §93 | Search; Storefront; Analytics |
| product.published / 1 | Catalogue / CATINV §93 | Search; Storefront; Content |
| product.withdrawn / 1 | Catalogue / CATINV §93 | Search; Storefront; Content |
| variant.updated / 1 | Catalogue / CATINV §93 | Checkout; Search; Storefront |
| product_post.updated / 1 | Catalogue / CATINV §93 | Content; Search; Storefront; Recommendation |
| product_post.published / 1 | Catalogue / EVT §35 | Content; Search; Storefront; Analytics |
| product_post.unpublished / 1 | Catalogue / EVT §35 | Content; Search; Storefront; Recommendation |
| inventory.changed / 1 | Inventory / CATINV §94 | Content; Checkout; Search; Storefront; Recommendation |
| inventory.stock_confirmed / 1 | Inventory / CATINV §94 | Content; Search; Storefront; Analytics |
| inventory.public_stock_projection_changed / 1 | Inventory / CATINV §94 | Search; Storefront; Recommendation |
| scene_post.published / 1 | Content / SCN §44 | Search; Recommendation; Storefront; Media; Analytics |
| scene_post.revised / 1 | Content / EVT §35 | Search; Recommendation; Storefront |
| scene_post.visibility_changed / 1 | Content / SCN §44 | Search; Recommendation; Storefront; Collections; Notifications; Analytics |
| scene_post.archived / 1 | Content / EVT §35 | Search; Recommendation; Storefront; Collections |
| scene_post.deleted / 1 | Content / EVT §35 | Search; Recommendation; Storefront; Collections; Media |
| checkout.allocation_created / 1 | Checkout/Orders / EVT §35 | Inventory; Analytics |
| checkout.allocation_released / 1 | Checkout/Orders / EVT §35 | Inventory; Analytics |
| payment.attempt_created / 1 | Finance / FIN §17 | Checkout; Analytics |
| payment.verified / 1 | Finance / FIN §15/16 | Orders; Notifications; Analytics; Reviews; Trust |
| payment.failed / 1 | Finance / EVT §35 | Orders; Notifications |
| refund.status_changed / 1 | Finance / TRUST §66 | Claims; Reviews; Trust; Notifications; Analytics |
| order.paid / 1 | Orders / ORDER §53 | Fulfilment; Notifications; Analytics |
| order.ready / 1 | Orders / ORDER §90 | Fulfilment; Notifications |
| order.completed / 1 | Orders / ORDER §102 | Trust; Notifications; Analytics |
| handoff.created / 1 | Handoff / HND §41 | Orders; Analytics |
| handoff.delegate_created / 1 | Handoff / HND §41 | Handoff; Notifications; Audit |
| handoff.delegate_revoked / 1 | Handoff / HND §41 | Handoff; Notifications; Audit |
| handoff.qr_issued / 1 | Handoff / HND §41 | Audit; Observability |
| handoff.otp_requested / 1 | Handoff / HND §41 | Audit; Observability |
| handoff.otp_sent / 1 | Handoff / HND §41 | Audit; Observability |
| handoff.verification_failed / 1 | Handoff / HND §41 | Claims; Audit; Observability |
| handoff.manual_review_requested / 1 | Handoff / HND §41 | Operations; Audit |
| handoff.verified / 1 | Handoff / HND §41 | FUL_PICKUP [PICKUP]; FUL_DELIVERY [DELIVERY]; ORDER_DELIVERY [DELIVERY]; REV_FINAL_DELIVERY [DELIVERY]; TRUST_FINAL_RECEIPT [DELIVERY]; CLAIMS_EVIDENCE; NOTIF_STAGE; ANL_STAGE |
| handoff.revoked / 1 | Handoff / HND §41 | Fulfilment; Orders; Notifications; Audit |
| courier.relationship.approved / 1 | Fulfilment / FUL §57 | Notifications; Courier UI; Audit |
| courier.terms.updated / 1 | Fulfilment / FUL §57 | Notifications; Seller Console; Courier UI |
| delivery.request.created / 1 | Fulfilment / FUL §57 | Notifications; Analytics |
| delivery.offer.accepted / 1 | Fulfilment / FUL §57 | Seller Console; Notifications; Audit |
| delivery.assigned / 1 | Fulfilment / FUL §57 | Seller Console; Courier UI; Notifications |
| delivery.started / 1 | Fulfilment / FUL §57 | Notifications; Analytics |
| delivery.completed / 1 | Fulfilment / FUL §57 | Notifications; Analytics; Trust |
| delivery.cancelled / 1 | Fulfilment / FUL §57 | Notifications; Claims; Trust |
| location.pickup.captured / 1 | Fulfilment / FUL §57 | Claims; Audit |
| location.delivery.captured / 1 | Fulfilment / FUL §57 | Claims; Audit |
| claim.opened / 1 | Claims / CLAIM §89 | Notifications; Analytics |
| claim.evidence_attached / 1 | Claims / CLAIM §89 | Claims workflow; Notifications; Audit |
| claim.evidence_requested / 1 | Claims / CLAIM §89 | Notifications; Claims workflow |
| claim.state_changed / 1 | Claims / CLAIM §89 | Notifications; Analytics |
| claim.decision_recorded / 1 | Claims / CLAIM §89 | Reviews; Trust; Notifications; Analytics; Finance |
| claim.decision_corrected / 1 | Claims / CLAIM §89 | Reviews; Trust; Notifications; Analytics; Finance |
| claim.remedy_requested / 1 | Claims / CLAIM §89 | Finance; Notifications; Analytics |
| claim.remedy_completed / 1 | Claims / CLAIM §89 | Reviews; Trust; Notifications; Analytics |
| claim.resolved / 1 | Claims / CLAIM §89 | Notifications; Analytics |
| review.eligibility_changed / 1 | Reviews / REV §29 | Notifications; Analytics; Trust |
| review.published / 1 | Reviews / REV §29 | Ratings; Trust; Recommendation; Analytics |
| trust.level_changed / 1 | Trust / TRUST §66 | Search; Recommendation; Storefront; Notifications |
| moderation.enforcement_changed / 1 | Moderation / MOD §49 | Content; Catalogue; Media; Auth; Trust; Search; Recommendation; Storefront; Notifications |
| collection.item_added / 1 | Collections / SRC §17 | Analytics; Recommendation |
| collection.item_removed / 1 | Collections / EVT §7 | Analytics; Recommendation |
| notification.created / 1 | Notifications / NOTIF §6 | Notification delivery |
| notification.delivery_recorded / 1 | Notifications / EVT §7 | Audit; Analytics |
| media.image_uploaded / 1 | Media / EVT §35 | Media processing |
| media.image_ready / 1 | Media / EVT §35 | Catalogue; Content |
| media.image_failed / 1 | Media / EVT §7 | Media workflow; Notifications |
| privacy.lifecycle_requested / 1 | Privacy / PRV §59 | Auth; Privacy tasks |
| privacy.lifecycle_confirmed / 1 | Privacy / PRV §59 | Privacy tasks; Notifications |
| privacy.lifecycle_blocked / 1 | Privacy / PRV §59 | Notifications; Audit |
| privacy.lifecycle_processing_started / 1 | Privacy / PRV §59 | Privacy tasks; Audit |
| privacy.domain_task_completed / 1 | Privacy / PRV §59 | Privacy tasks; Audit |
| privacy.hold_created / 1 | Privacy / PRV §59 | Held domain owners; Audit |
| privacy.hold_released / 1 | Privacy / PRV §59 | Held domain owners; Audit |
| privacy.lifecycle_completed / 1 | Privacy / PRV §59 | Auth; Notifications; Audit |
| privacy.export_ready / 1 | Privacy / PRV §59 | Notifications; Audit |
| privacy.incident_awareness_recorded / 1 | Privacy / PRV §59 | Privacy workflow; Observability |
| privacy.incident_assessment_updated / 1 | Privacy / PRV §59 | Privacy workflow; Observability |
| chatbot.knowledge_version_published / 1 | Chatbot / CHATBOT §73 | Chatbot runtime; Audit |
| chatbot.localization_completeness_changed / 1 | Chatbot / CHATBOT §73 | Chatbot runtime; Seller Console |
| chatbot.feedback_submitted / 1 | Chatbot / CHATBOT §73 | Chatbot workflow; Audit |
| chatbot.feedback_triaged / 1 | Chatbot / CHATBOT §73 | Chatbot workflow; Audit |
| chatbot.intent_version_published / 1 | Chatbot / CHATBOT §73 | Chatbot runtime; Audit |
| chatbot.template_version_published / 1 | Chatbot / CHATBOT §73 | Chatbot runtime; Audit |
| chatbot.kill_switch_changed / 1 | Chatbot / CHATBOT §73 | Chatbot runtime; Seller Console |
| chatbot.escalation_created / 1 | Chatbot / CHATBOT §73 | Chat; Notifications |
| chatbot.bot_turn_completed / 1 | Chatbot / CHATBOT §73 | Chat; Analytics |
| market.config_published / 1 | Market / MKT §105 | Activated domain readers; Audit |
| market.activation_changed / 1 | Market / MKT §105 | Activated domain readers; Audit |
| market.locale_pack_changed / 1 | Market / MKT §105 | Surface localization; Chatbot |
| market.provider_routing_changed / 1 | Market / MKT §105 | Finance; Deployment |

Collection membership is typed PRODUCT_POST or SCENE_POST. Payment events contain provider/backend facts only; no Seller payment-confirmation event exists. Inventory/Content safety re-reads prevent an old publish or visibility event from resurrecting PRIVATE/moderated content.

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

This is the complete current domain catalogue, generated from Contract_Registry/event_contract_registry.json, with resolvable payload schemas in event_payload_schemas.json. Registry v1 describes proposed current contracts, not deployment or provider approval. The separate job_intents section contains handoff.delegate_invitation; local consumer tables elsewhere are subsets. Unknown names/versions, wrong producer/scope and private payload fields fail closed. No compatibility alias is activated without evidence of a released version requiring it.

## 36. Job Catalogue

| Job | Owner | Queue | Criticality | Idempotency |
| --- | --- | --- | --- | --- |
| enqueue_event_delivery | Platform Eventing | critical/default | CRITICAL infra | event_id + consumer |
| send_notification_delivery | Notifications | notifications | IMPORTANT | delivery effect_id |
| process_image | Media | media | IMPORTANT | asset_id + media_version |
| generate_image_derivatives | Media | media | IMPORTANT | asset_id + derivative_profile |
| expire_checkout_allocation | Checkout | critical | CRITICAL | allocation_id + deadline_version |
| verify_payment_attempt | Payments | critical | CRITICAL | provider transaction identity |
| reconcile_provider_payment | Payments | critical | CRITICAL | payment_attempt_id + reconciliation_generation |
| recompute_trust | Trust | critical/default | CRITICAL/IMPORTANT | seller_id + policy version/current state |
| apply_claim_trust_consequence | Trust | critical | CRITICAL | claim_id + consequence + policy |
| update_product_rating_stats | Reviews | default | IMPORTANT | review_id + product_id |
| update_seller_rating_stats | Reviews | default | IMPORTANT | review_id + seller_id |
| refresh_fyp_features | Recommendation | default | IMPORTANT | scene_post_id + current state |
| refresh_search_projection | Search | default | IMPORTANT | entity_type + entity_id current state |
| invalidate_storefront_cache | Storefront | default | IMPORTANT | seller/product/post current state |
| recompute_scene_visibility | Content | default | IMPORTANT / safety-sensitive | scene_post_id + current lifecycle/policy state |
| create_review_grant | Reviews | default | IMPORTANT | qualifying final_handoff_id; never order.completed alone |
| process_account_deletion | Privacy | critical/maintenance | CRITICAL | workflow_id + domain |
| reconcile_outbox | Platform Eventing | maintenance | CRITICAL repair | time slice/checkpoint |
| reconcile_job_intents | Platform Eventing | maintenance | CRITICAL repair | time slice/checkpoint |
| reconcile_fyp_eligibility | Discovery | maintenance | IMPORTANT repair | Market + slice |
| backfill_projection | Owning projection domain | maintenance | BEST_EFFORT/IMPORTANT | type + Market + version + batch |

refresh_search_projection supports PRODUCT_POST, SELLER and SCENE_POST. Media work remains image validation/Sharp derivatives only; TikTok is external supplementary Product detail metadata, without native video transcoding. High-volume Analytics/FYP observations remain batched, not one BullMQ job per click.

## 37. Testing and Failure Injection

| Test | Expected result |
| --- | --- |
| Business write + outbox rollback | Exception before COMMIT leaves neither domain mutation nor event. |
| After-commit API crash | Outbox remains and relay eventually delivers. |
| Relay duplicate enqueue | Consumer business effect remains single. |
| Relay crash after BullMQ acceptance | Retry is safe; event delivery converges. |
| Worker crash after effect commit | Retry leaves projection/business effect correct. |
| Valkey restart/failover | Queue resumes without changing domain truth; relay repairs missing work. |
| External send ambiguity | Same effect identity is reconciled; no blind duplicate. |
| Checkout allocation deadline outage | Recovery/sweeper applies only if canonical allocation/payment state still allows. |
| Provider callback duplicated | Paid state and stock effects occur once. |
| Claim decision / Trust worker outage | Claim remains decided; unresolved Trust consequence is alerted and reconciled. |
| Notification outage | Order/payment/Handoff state remains committed. |
| Image retry | One canonical derivative set. |
| Scene Post stale job | PRIVATE/archived/moderated/ineligible current state wins; old publish event cannot resurrect FYP content. |
| Unsupported event/job version | Fails safely and dead-letters/alerts. |
| Backpressure | Large P4 backlog does not create unbounded P0/P1 lag. |
| Graceful deploy | Active work completes or safely retries. |
| Cross-Market job | Mutation rejected + security alert. |

### Failure injection requirements

• Kill API/relay/worker at each DB/queue boundary.

• Block PostgreSQL, Valkey, R2 and provider connectivity independently.

• Force provider 429/500/timeouts and ambiguous success.

• Inject duplicate and out-of-order events/jobs.

• Keep workers down across canonical deadlines and scheduler windows.

• Create poison payloads and unsupported versions.

• Run a 100k-entity configuration/projection fan-out while critical payment work arrives.

• Run Sharp CPU stress and verify critical queue latency.

### Current canonical regression cases

• 01. Canonical mutation + outbox rollback together.

• 02. Crash after commit -> relay eventually delivers.

• 03. Duplicate BullMQ execution -> one business effect.

• 04. Scene final Product goes unavailable: Inventory event -> Content recompute -> Scene PUBLIC->PRIVATE -> event -> FYP/Search exclusion.

• 05. Eventing does NOT archive Scene merely due zero availability.

• 06. Restock: Content PRIVATE->PUBLIC -> consumers converge.

• 07. Old scene visibility job cannot resurrect a now-moderated Scene.

• 08. Duplicate final handoff.verified -> one Review Grant.

• 09. order.completed alone cannot create second Review Grant.

• 10. QR/OTP/Manual method survives event safely without secret material.

• 11. Ordinary Account actor and Operator Account actor remain distinguishable.

• 12. Operator replay requires separate Operator Account.

• 13. Unsupported/inactive Market cannot be inferred from worker environment.

• 14. Valkey loss does not lose outbox/job intent.

• 15. Payment callback duplicate creates one paid effect.

• 16. Large backfill cannot starve critical money/security work.

• 17. No native-video worker path.

Executed design fixtures: registry/schema/reference uniqueness, closed name/version and principal/scope payload rejection; PICKUP/DELIVERY filters; Claim decision supersession and verified-remedy completion requirements; Review eligibility commit/reversal/replay and per-consumer deduplication. These in-memory/static fixtures are supplied in Validation; actual outbox/BullMQ/PostgreSQL/provider integration, crash/reordering races and security tests remain unexecuted.

## 38. Load and Capacity Planning

Business-job load is modeled separately from high-volume analytics telemetry. Do not enqueue one BullMQ job per FYP impression, photo dwell tick or low-value click. Analytics owns batching/ingestion.

Capacity testing must use the exact Render worker sizes, PostgreSQL plan, Valkey plan, BullMQ/Valkey version pair and realistic task mix. Track p95/p99 queue wait, worker duration, provider latency, relay lag, Valkey latency/memory and PostgreSQL saturation.

| Scale lever order | Action |
| --- | --- |
| 1 | Coalesce current-state projection work and batch fan-out. |
| 2 | Pause/throttle maintenance and backfill queues. |
| 3 | Tune worker concurrency per queue and provider. |
| 4 | Scale worker replicas. |
| 5 | Scale Valkey resources / connection handling after profiling. |
| 6 | Optimize PostgreSQL queries/indexes and outbox relay batches. |
| 7 | Physically split services only when measured topology justifies it. |

## 39. MVP Scope and Deferred Scope

### MVP - required

• BullMQ as sole ordinary background-job engine

• Valkey as queue datastore and current cache datastore name

• PostgreSQL transactional event outbox

• PostgreSQL transactional job_intent bridge for direct/delayed work

• Outbox relay + job-intent relay with stale-lease recovery

• Typed event/job registries and versions

• At-least-once delivery with database-backed idempotency

• Critical/default/notifications/media/maintenance worker pools

• Delayed jobs + recurring reconciliation sweepers

• Application dead-letter records + typed replay

• Provider ambiguity handling and reconciliation

• Current Product Post/Scene Post/Search/FYP event vocabulary

• Provider-payment and CheckoutAllocation async flows

• Structured observability, failure injection and launch gates

### Deferred

• A second overlapping queue/broker

• Kafka/RabbitMQ/Temporal

• Full event sourcing

• Cross-service distributed transactions

• Generic arbitrary JSON job execution in Operator Console

• Per-user recurring schedulers

• One job per FYP impression

• Multi-region active-active worker execution

• Complex workflow DAG engine without proven need

• Ethiopia-first activated Markets; global extensibility does not imply global launch.

• Typed ordinary/Operator/SYSTEM provenance on every durable async boundary.

• Content-owned Scene PUBLIC/PRIVATE visibility convergence and final-two-basis Order-backed Review Grant consumer.

## 40. System Invariants

• EVT-INV-001 Owning domain alone emits canonical event.

• EVT-INV-002 Business mutation + outbox commit atomically.

• EVT-INV-003 Critical direct async intent has PostgreSQL job_intent.

• EVT-INV-004 No unsafe PostgreSQL->Valkey correctness dual write.

• EVT-INV-005 Delivery/execution are at-least-once.

• EVT-INV-006 No distributed exactly-once claim.

• EVT-INV-007 CRITICAL consumers idempotent.

• EVT-INV-008 IMPORTANT consumers idempotent unless explicit exception.

• EVT-INV-009 queue jobId is optimization, not final uniqueness.

• EVT-INV-010 queue state cannot override domain truth.

• EVT-INV-011 canonical deadline wins over queue timer.

• EVT-INV-012 deadline handler re-reads/locks current state.

• EVT-INV-013 paid allocation cannot be released by stale expiry.

• EVT-INV-014 paid Order cannot become unpaid from delayed worker.

• EVT-INV-015 provider/backend verifies payment.

• EVT-INV-016 worker crash after commit is retry-safe.

• EVT-INV-017 external effects use deterministic identities.

• EVT-INV-018 ambiguous provider results do not create blind duplicate effects.

• EVT-INV-019 poison jobs bounded.

• EVT-INV-020 CRITICAL exhaustion never silently discarded.

• EVT-INV-021 replay is consumer-scoped.

• EVT-INV-022 Market context survives async boundaries.

• EVT-INV-023 workers never infer Market from ambient metadata.

• EVT-INV-024 ordinary Account, Operator Account and SYSTEM provenance remain distinct.

• EVT-INV-025 Valkey is non-canonical.

• EVT-INV-026 BullMQ is sole ordinary job engine.

• EVT-INV-027 stale events cannot resurrect Product/Scene/Seller public eligibility.

• EVT-INV-028 Scene zero-availability causes Content visibility reevaluation, not Recommendation archive.

• EVT-INV-029 final Buyer-facing Handoff is Review Grant trigger.

• EVT-INV-030 order.completed cannot independently create duplicate Review Grant.

• EVT-INV-031 high-volume FYP telemetry is not one BullMQ job per observation.

• EVT-INV-032 Operator replay is typed/audited.

• EVT-INV-033 canonical truth can rebuild derived state after queue loss.

• EVT-INV-034 Dead letters preserve owner, correlation, sanitized failure, ambiguity and resolution lineage.

• EVT-INV-035 Cross-Market mutation fails closed and alerts security.

• EVT-INV-036 Event/job payload versions are validated before handling.

• EVT-INV-037 Payloads are data-minimized; no secrets, private evidence blobs or identity documents.

• EVT-INV-038 Workers call owning application services; no unrelated repository writes.

• EVT-INV-039 Recurring schedule registration is idempotent across replicas.

• EVT-INV-040 Critical execution capacity is isolated from media/backfill load.

• EVT-INV-041 Relay, job-intent, queue and dead-letter lag remain measurable.

• EVT-INV-042 Analytics and notification failures cannot roll back commerce/Handoff facts.

• EVT-INV-043 Product/Scene publication cannot depend on Recommendation worker health.

• EVT-INV-044 One Review rating contribution cannot be counted twice.

• EVT-INV-045 Mandatory Claim/Trust consequences are rebuildable from canonical evidence/policy.

• EVT-INV-046 Large fan-out is bounded/checkpointed and connection budgets protect API/database load.

• EVT-INV-047 No arbitrary queue payload editor is exposed to routine Operators.

• EVT-INV-048 Historical persisted superseded event names/versions remain immutable; migration mapping is explicit.

• EVT-INV-049 Scene public-eligibility convergence is safety-sensitive; current response gates deny stale public projections.

## 41. Open Decisions and Launch Gates

### Open implementation decisions

| Decision | Launch requirement |
| --- | --- |
| Exact BullMQ version pin | Required before implementation; lock package version and migration behavior in CI. |
| Exact Valkey version/topology | Required before production; test persistence/failover and BullMQ compatibility. |
| Outbox relay cadence/batch | Tune from measured enqueue lag and PostgreSQL load. |
| Critical deadline sweeper cadence | Start approximately every minute; tune from overdue-age SLO and DB cost. |
| Dead-letter retention | Privacy sign-off required. |
| Worker process sizing | Set from measured CPU/memory/provider/DB/Valkey limits. |

### Production launch gate

• [ ] BullMQ + Valkey versions pinned and compatibility tested.

• [ ] No second ordinary background-job engine remains in production dependencies.

• [ ] Critical domain writes use outbox and/or durable job_intent correctly.

• [ ] No unsafe PostgreSQL-to-Valkey request-path dual write remains.

• [ ] Relay stale-lease and ambiguous-enqueue tests pass.

• [ ] Every CRITICAL consumer has duplicate-delivery tests.

• [ ] Provider payment callbacks/reconciliation are idempotent.

• [ ] Checkout allocation deadline/reconciliation tests pass.

• [ ] Dead-letter and typed replay are authorized and audited.

• [ ] Critical queue lag and outbox/job-intent lag are observable.

• [ ] Valkey outage and recovery drills complete without business-state corruption.

• [ ] P0/P1 isolation under heavy P4 backlog is demonstrated.

• [ ] Shopper-facing FYP/Search projections revalidate current availability/moderation/Trust.

• [ ] Media jobs are image-only; no native video processing path is accidentally deployed.

• [ ] All cross-system write-backs are completed or tracked with owner/date.

• [ ] Content-owned PRIVATE/PUBLIC convergence, bounded recomputation and stale-scene denial pass.

• [ ] Final DELIVERY QR/OTP/Manual Review Grant trigger, final_handoff_id uniqueness and order.completed non-trigger pass.

• [ ] Typed ordinary/Operator/SYSTEM identifiers, separate Operator replay and inactive-Market fail-closed behavior pass.

## 42. Canonical Write-Backs

| Target | Required update |
| --- | --- |
| Platform Integration Architecture | Ratify BullMQ/Valkey, outbox relay, job-intent bridge and current Product/Scene/Payment vocabulary. |
| Deployment | Deploy relay, critical/general/notifications/media/maintenance worker process types; Valkey monitoring; graceful drain; connection budgets. |
| Database/Engineering Manual | event_outbox, event_delivery, job_intent, processed_event, async_job_audit, async_dead_letter, external_delivery_attempt; typed principal FKs/CHECKs and Drizzle helpers. |
| Order/Checkout | Use checkout allocation deadlines and provider state, not the legacy pre-payment hold lifecycle. |
| Finance/Payments | Provider webhook/verification/reconciliation events and jobs; no Seller payment confirmation. |
| Catalogue/Inventory | Inventory facts trigger bounded Content visibility recompute; Search/Storefront/FYP and Checkout repair read canonical current state. |
| Content/FYP/Search | Scene names and Content-owned visibility_changed; PRIVATE exclusions/restock; Scene-only FYP and three typed Search entities. |
| Media | Only image processing jobs; TikTok embed metadata/ownership remains integration logic, not native video transcoding. |
| Notifications/Auth | One ordinary Account recipient with device fan-out; separate Operator identity/session; security-domain OTP; creation vs transport separation. |
| Trust/Claims/Reviews | Review Grant unique per Buyer/Order from accepted receipt or upheld eligible failure; order.completed no independent grant; Trust method-specific QR credit; natural effect identities/reconciliation. |
| Privacy/Observability | Retention windows, queue/outbox metrics, dead-letter policy, redaction and runbooks. |

## 43. Implementation Sequence

### PHASE 0 - TECHNOLOGY BASELINE

Pin BullMQ + Valkey + Node/PostgreSQL compatibility; remove the previous job-engine dependency and duplicate worker schemas.

### PHASE 1 - EVENT CONTRACT

Event catalogue, naming/versioning, envelope, correlation/causation, Market/actor provenance.

### PHASE 2 - TRANSACTIONAL OUTBOX

Create outbox/delivery tables and emitEvent helper.

### PHASE 3 - RELAY

Lease/claim logic, consumer registry fan-out, deterministic BullMQ job identities, ambiguous enqueue repair.

### PHASE 4 - JOB INTENT

Create job_intent table and relay for direct/delayed jobs.

### PHASE 5 - JOB MODEL

Typed task registry, queue policies, worker pools, audit wrapper, timeouts.

### PHASE 6 - IDEMPOTENCY

processed_event, natural keys, duplicate/crash tests.

### PHASE 7 - COMMERCE CRITICAL PATH

Provider verification/reconciliation, checkout allocation deadlines, Order consequences.

### PHASE 8 - DOMAIN REACTIONS

Trust/Claims, Reviews, Search/FYP/Storefront, Notifications.

### PHASE 9 - MEDIA

Dedicated image worker, Sharp derivatives, CPU/resource limits.

### PHASE 10 - RECONCILIATION / RETENTION

Outbox, job intents, payment, Trust, ratings, FYP/Search, Privacy workflows.

### PHASE 11 - DEAD LETTER / REPLAY

Application DLQ, typed inspection/replay, audit and poison-loop protection.

### PHASE 12 - HARDENING

Outage drills, backpressure, load, graceful deploy, security tests and capacity run.

Current integration sequence also implements typed principal envelopes before producers emit them, Content visibility reevaluation/consumers, two-basis Buyer/Order Review Grant registry and explicit Market activation. Historical event migration is versioned and expand/contract compatible; no persisted event rows are rewritten.

## 44. Final System Architecture

PostgreSQL owns durable business truth, immutable events and direct/deadline job intent. Relays materialize deterministic BullMQ work on Valkey after commit. Workers reconstruct safe typed actor/Market context, validate versions, re-read current truth, apply owning-service idempotent effects and emit new committed facts.

![One complete registry, independent filtered deliveries](graphics/EVT_04.svg)
*Figure 04. One complete registry, independent filtered deliveries. Analytics, audit/timeline, commands, queue names and notification templates remain separate classes.*

Independent consumer outcomes, application dead letters, consumer-scoped separate-Operator replay and bounded reconciliation repair failures. Queue/job state describes execution requests and cannot redefine payment, stock, Scene visibility, permissions, Review eligibility or deadlines.

## 45. Engineering Doctrine

| Layer | Question it answers |
| --- | --- |
| DOMAIN TABLES | What is true now? |
| DOMAIN EVENTS | What became true? |
| OUTBOX | Which durable facts still require delivery/replay? |
| JOB INTENTS | Which direct asynchronous actions must be materialized? |
| BULLMQ | What physical asynchronous work is waiting/delayed/active? |
| WORKERS | Who executes the typed work? |
| DEAD LETTERS | What could not be completed automatically? |
| RECONCILIATION | Can canonical truth repair derived state? |

A stronger queue does not weaken domain boundaries. BullMQ is an executor, not a business owner. Valkey is infrastructure, not a commerce database. Events are facts, jobs are requests, and reconciliation is the guarantee that critical derived state can converge after outages or bugs.

## 46. Appendix A - Logical Database Model

```
platform.event_outbox (conceptual owner schema amendment)
  event_id PK; event_type; event_version; occurred_at
  scope_kind GLOBAL|MARKET
  market_id nullable; originating_market_id nullable
  CHECK ((scope_kind='MARKET' AND market_id IS NOT NULL)
      OR (scope_kind='GLOBAL' AND market_id IS NULL))
  aggregate_type/id/revision; logical_effect_id
  actor_type ANONYMOUS_PUBLIC|ORDINARY_ACCOUNT|OPERATOR_ACCOUNT|SYSTEM
  ordinary_account_id nullable FK; operator_account_id nullable FK
  system_source nullable; anonymous_ref nullable
  CHECK populated typed identity matches actor_type
  seller_context_id nullable; correlation/causation; payload/schema version
platform.event_delivery: PRIMARY KEY(event_id,consumer_name)
  existing lease/state/queue linkage and failure fields preserved
platform.job_intent: existing durable intent/lease/state fields preserved
  use the same scope/principal shape; no session/JWT persisted
platform.processed_effect: UNIQUE(owner, logical_effect_id, effect_kind)
  retention/replay policy preserves needed durable deduplication
Legacy market-required schema requires reviewed migration, not fake Market.
```

Request context is discriminated ANONYMOUS_PUBLIC, ORDINARY_ACCOUNT, OPERATOR_ACCOUNT or trusted SYSTEM. Anonymous input is never labelled SYSTEM. Scope is GLOBAL or MARKET: global Account lifecycle/Operator provisioning needs no fabricated owner Market; originating_market_id is optional validated context only. MARKET events and commerce commands require resource-derived validated market_id. Runtime validation checks principal shape, service/session provenance, current resource permissions and scope before propagation; types alone do not authorize. Public/global context cannot bypass Seller, payment, Order, Handoff or Operator gates; anonymous IDs remain purpose-bound/privacy-safe.

Existing direct job-intent, event-delivery, processed-event, dead-letter and external-attempt architecture remains intact; Drizzle owns app schema, BullMQ owns Valkey keys. Pseudocode CHECK shape above is conceptual; actual declared types/constraints require migration tests.

## 47. Appendix B - TypeScript Contracts

```
consume(event)
  parse closed event_type + event_version from Contract_Registry/event_contract_registry.json
  resolve payload_schema_ref in event_payload_schemas.json; reject unknown fields
  validate registered producer provenance, allowed actor/scope and consumer filter
  validate GLOBAL/MARKET and trusted actor shape at runtime
  if MARKET: owner reader validates event/resource Market
  if GLOBAL: optional origin is context, never Account ownership
  db.transaction(tx => {
    lock current owning aggregate and recheck policy/revision/suppression
    insert durable processed effect; duplicate -> permitted no-op
    owningApplicationService.apply(tx, event)
  })
// Queue job IDs do not survive removal as permanent dedupe.
// Order PAID uses the shared stock unit of work, not this generic
// example as permission to bypass owner interfaces.
```

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

## 48. Appendix C - Retry / Retention Defaults

| Job class | Criticality | Attempts | Backoff | Exhaustion |
| --- | --- | --- | --- | --- |
| outbox / job-intent relay delivery | CRITICAL infra | continuous via lease/reconcile | bounded relay retry + alert | SEV-2 + repair until materialized |
| payment verification/reconciliation | CRITICAL | 8 | provider-aware exponential + jitter | DLQ + SEV-2 + reconciliation |
| checkout allocation expiry | CRITICAL | 6 | exponential + independent sweeper | DLQ + overdue alert + sweeper |
| Claim -> Trust consequence | CRITICAL | 10 | exponential | DLQ + high alert + Trust reconciliation |
| Search/FYP/rating projection | IMPORTANT | 6 | exponential | DLQ + reconciliation/backfill |
| notification external delivery | IMPORTANT | 5 logical attempts | Retry-After / jitter | terminal delivery or DLQ by policy |
| image processing | IMPORTANT | 4 | resource-specific exponential | Media FAILED/QUARANTINED policy + DLQ |
| maintenance/backfill | BEST_EFFORT/IMPORTANT | 3-5 | exponential | pause/resume; alert only if blocking critical convergence |

These are starting defaults, not universal constants. Each TaskPolicy owns its values. Incident/load evidence may change them without changing the architecture.

## 49. Appendix D - Architecture evolution and current reconciliation

| Area | Current result |
| --- | --- |
| Background execution | BullMQ replaces the previous PostgreSQL worker technology as the single ordinary job engine. |
| Queue datastore | Valkey only. |
| Atomicity | Direct same-DB queue insertion removed; PostgreSQL outbox/job-intent + relay is now the required cross-store bridge. |
| Purchase model | Legacy pre-payment hold/deadline jobs removed. Current provider payment + checkout allocation model added. |
| Payment | Provider/server verification and reconciliation replace Seller/manual payment-confirmation workflows. |
| Content vocabulary | Product Posts + canonical Scene Posts; superseded historical event rows retain original names/versions. Scene is the current Content identity. |
| FYP | Scene-only top-level feed; Content-owned PUBLIC/PRIVATE, no stock archive; Eventing refreshes current gates. |
| Media | Image processing only; no native video-processing jobs. TikTok embed path remains supplementary integration metadata. |
| Verification | No government-document verification events/jobs. |
| Client connectivity | No offline business-job/event queue from mobile clients. |
| Stack | Updated Node/NestJS/Fastify/strict TS/Drizzle/PostgreSQL/Valkey/BullMQ/OpenAPI/Expo/R2/Sharp/testing/observability/delivery baseline. |
| Final architecture | Rebuilt around Postgres -> relay -> BullMQ/Valkey -> workers -> canonical domain services -> reconciliation. |

### Complete current technology baseline

| Layer | Technology |
| --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript; Drizzle ORM; PostgreSQL |
| PostgreSQL extensions | pg_trgm; btree_gist; pg_stat_statements |
| Async / cache | Valkey; BullMQ |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript client |
| Security | @nestjs/throttler; @fastify/helmet; libphonenumber-js |
| Media | Cloudflare R2; Cloudflare CDN; Sharp |
| Mobile | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; SecureStore; SQLite; Camera; Notifications; Updates; small Zustand store |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 |
| Observability | Sentry; Pino structured logs; pg_stat_statements; BullMQ/Valkey queue metrics |
| Architecture control | dependency-cruiser |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS |

October 2026 reconciliation adds ordinary/Operator typed principal provenance, Ethiopia-first active Markets, Scene visibility change/recompute and final DELIVERY Review Grant uniqueness while retaining the original BullMQ-only relay, retry, deadline and recovery architecture.

## 50. Appendix - Canonical Registry & Generated Fixtures

| Registry entry | Versioned contract / scope / execution |
| --- | --- |
| scene_post.published v1 / Content | MARKET; Scene/Seller/Market/published_revision, aggregate_revision, logical_effect_id; consumers REC/SRC/Storefront/Media/Analytics; current eligibility re-read. |
| scene_post.visibility_changed v1 / Content | MARKET; same scope plus previous_visibility/current_visibility, reason, revision/effect; public consumers and one Seller advisory notice. |
| inventory.changed v1 / Inventory | MARKET; Product/Variant/Seller/Market/stock_revision/effect; Content and commerce eligibility readers. |
| account.created / account.deletion_requested / Accounts-Privacy | GLOBAL; exact ordinary Account, schema version/effect and optional validated origin; no fabricated Account owner Market. |
| claim.decision_recorded / Claims | MARKET; structured seller_fault/severity/remedy deadline/resolution/decision/correction fact; Trust/Reviews/Finance/Analytics. |
| handoff.verified / Handoff | MARKET; immutable stage/method/recipient/assignment/generation/evidence; receipt-based Reviews plus independent Orders/Trust. |
| review.eligibility_changed / Reviews | MARKET; one Order/Buyer eligibility basis/state/version with restricted evidence references; safe prompts/projections; no client/raw case body. |
| handoff.delegate_invitation / Handoff job intent | MARKET; authorization/generation/contact-purpose/expiry/effect; existing SMS adapter, not an ordinary Notification event. |

This registry is the sole canonical declaration for the amended names. Schema/order/revision/consumer and current-versus-history semantics are versioned together; event_id identifies delivery, logical_effect_id identifies the accepted business effect. CI generates producer/consumer payload fixtures from declarations, rejects undeclared names and wrong GLOBAL/MARKET shapes. Equal revision duplicate -> no second notice; lower revision -> no public resurrection; gap -> current owner reconcile. No independent became_private/became_public facts. Legacy mappings require actual deployed/historical evidence and preserve the same logical effect.

## 51. Glossary

Definitions used in this current complete edition.

| Term | Current meaning |
| --- | --- |
| Ordinary Account | One human identity across Buyer/Seller/Courier relationships; roles/context remain resource scoped. |
| Operator Account | Separate privileged internal principal, credentials, OPERATOR session and typed audit. |
| Scene Post | Canonical captioned image content with exact same-Seller Product/revision relationships. |
| PUBLIC / PRIVATE | Content visibility independent of publication and Moderation; stock-private can restore after all gates pass. |
| Product Post | Structured commerce destination for exactly one Product; current Catalogue/Inventory truth. |
| Market activation | Approved runtime commerce scope; Ethiopia first, globally extensible future routes. |
| PSP | Payment service provider; authenticated backend/provider facts establish money state. |
| Launch surcharge / 0 bps | Current explicit Buyer Checkout surcharge; exact server policy snapshot. |
| Outbox / job_intent | PostgreSQL records atomically preserve facts or direct/deadline async intent. |
| BullMQ / Valkey | Sole ordinary job engine and its execution/cache datastore; non-canonical. |
| event_delivery | Independent per-event/consumer transport state and logical job identity. |
| At-least-once | Duplicate transport/execution expected; database idempotency protects effects. |
| Dead letter | Application-owned exhausted-work record with typed repair/audit lineage. |
| Consumer-scoped replay | Repeat one consequence without recreating the original fact or other consumers. |
| Canonical deadline | PostgreSQL timestamp/version wins over delayed queue execution time. |
| final_handoff_id | Unique qualifying final DELIVERY receipt identity for one Buyer-owned Review Grant. |
