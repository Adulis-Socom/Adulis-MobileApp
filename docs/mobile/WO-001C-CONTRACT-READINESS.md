# WO-001C - Mobile contract readiness and repository conflict audit

Status: complete, pushed, awaiting founder review. Branch `mobile/wo-001c-contract-readiness`,
based on `mobile/wo-001b-foundation-design-sync` at `b4b18e3`. No pull request, no merge,
`main` untouched. WO-002 not started.

This is an audit. No product UI, Courier feature, payment migration or worker migration was
built. The only code change is export plumbing in `@adulis/api-client`, with its test. The
other changes are documentation and agent-instruction corrections (section 15).

**The gap register is [`WO-001C-CONTRACT-GAPS.json`](WO-001C-CONTRACT-GAPS.json).** This
document explains it. Every gap there has an ID, area, November requirement, current
executable behaviour, status, affected files, future correction, migration risk and the
workstreams it blocks.

## 1. Outcome

| | |
|---|---|
| Gaps recorded | **91** |
| By status | 26 LEGACY_SPEC_DRIFT - 13 PARTIALLY_ALIGNED - 12 ALIGNED - 9 MISSING_SCHEMA - 9 IMPLEMENTATION_GAP - 8 FOUNDER_DECISION_REQUIRED - 5 MISSING_ENDPOINT - 5 OPEN_DESIGN_DECISION - 4 CONTRACT_DRIFT |
| Block WO-002 Buyer shell | **0** |
| Block Seller Companion / Courier / Payment-checkout / Infrastructure migration | 21 / 11 / 15 / 5 |
| Must close before any production mobile release (`release_gate`) | 8: SEC-1 (high), SEC-2, SEC-3, SEC-4, PAY-10, DSC-10, WRK-12, MOB-2 |

The built system is a faithful implementation of the **legacy** repository specifications
(PRD v8.5, API-01 v1.11, DB-01 v1.19, AUTH-01 v2.5/v2.8). The November pack describes a
materially different product: provider-authoritative checkout, Scene discovery, Courier on
MOBILE, a 68-code permission catalogue, and BullMQ on Valkey. Most of the distance is
**legacy drift that the founder has already ruled on** (payment, discovery), plus missing
contract surface. Four items are genuine architecture decisions: the background engine, the
persistence toolkit, the HTTP adapter, and how Courier authority is gated.

**WO-002 Buyer development may begin**, within the conditions in section 13.

## 2. Method

- Five parallel read-only investigations: payment and order lifecycle; discovery and content;
  background execution; Courier, session and mode eligibility; Seller Companion permissions.
  Each read the November designs themselves (not summaries) alongside `apps/api`, `db/migrations`,
  `apps/console`, `contracts/openapi.json` and the legacy specs, citing `file:line`.
- Reading `apps/api` and `apps/console` from a mobile session is normally avoided (workspace
  rule). WO-001C S4 explicitly required it, and nothing in either was edited.
- Every load-bearing claim was re-checked by direct reading before it entered the register.
  This included:
  - the single `seller confirms` transition into `PAYMENT_CONFIRMED`;
  - the audience check inside `fn_has_permission`;
  - the step-up CHECK;
  - the API-side raw `UPDATE ... 'PAYMENT_SUBMITTED'`;
  - `validated_at` never being written;
  - the courier routes' `@ActorRole` only;
  - session id = token = listed id;
  - the public device PATCH;
  - the storefront `published_at` filter;
  - the single-seller cart;
  - graphile `add_job` absent outside tests;
  - the worker's fake SMS and null push adapters.
- Mechanical comparisons done directly:
  - the November permission registry against the built seed;
  - contract schema coverage;
  - the client generation check;
  - gate dependencies on legacy documents.
- Overlapping findings were merged; the IDs keep their area prefix.

## 3. K-1 Payment - LEGACY_SPEC_DRIFT (founder direction ruled)

The founder's ruling makes provider/backend-verified payment the target: no Seller
confirmation, no custody, 0% launch surcharge, provider fee separate. Against that, the built
system runs the superseded manual-transfer model **end to end**:

| Legacy behaviour still built | Where | Gap |
|---|---|---|
| Buyer bank-transfer instructions and their reissue | `financial.render_payment_instructions`, `fn_reissue_instructions`, `GET /v1/orders/{id}/payment-instructions`, `POST .../reissue-instructions`, step-up `REISSUE_INSTRUCTIONS` | PAY-2 |
| Payment screenshot upload and viewing | `financial.payment_evidence`, `core.payment_submission`, `POST /v1/orders/{id}/payment-evidence`, `GET /v1/seller/orders/{id}/payment-evidence`; the API sets `PAYMENT_SUBMITTED` with a raw UPDATE | PAY-3 |
| Seller payment confirmation / rejection | `fn_confirm_payment`, `fn_reject_payment`, `POST /v1/seller/orders/{id}/payment/confirm|reject`, permission `seller.payment:confirm` (MOBILE + CONSOLE) | PAY-1, SC-1 |
| Seller-established payment state | the only legal transition into `PAYMENT_CONFIRMED` is "seller confirms" (`0011:272`); the handoff QR is minted there | PAY-1, PAY-12 |
| Reservation / pre-payment hold | stock taken at order creation with a 48h window; `order.expire_sweep` releases on the timer | PAY-6 |
| Seller bank credentials held for buyer transfer | `core.payout_details`, `financial.payout_credential`; order creation refuses without an active payout | PAY-4 |
| Payment-awaiting-confirmation obligation, lapse claim, public confirmation stats | obligations controller, `fn_confirmation_window_lapse`, storefront stats | PAY-7 |
| Seller-reported refunds | `fn_report_refund`, `fn_acknowledge_refund` | PAY-8 |
| Claims built on screenshots and bank trace | claim enums, `fn_claim_attach_evidence` | PAY-11 |
| Single-seller cart | `409 CART_SELLER_CONFLICT` vs MOB-02 S31 multi-cart | PAY-13 |
| Evidence purge that never runs | purge selects `validated_at IS NOT NULL`; nothing writes it | PAY-10 (release gate) |

**Already aligned with the target:** no custody (`ledger.assert_zero`, PAY-14); no surcharge
anywhere (PAY-15, snapshot still owed); actor + endpoint + hash idempotency (PAY-16);
fail-closed transition tables with an append-only log (PAY-17); an isolated financial
boundary with logged reads (PAY-18).

**Missing outright:** the provider model, meaning PaymentAttempt, ExternalCharge,
ProviderEvent, webhooks, settlement and the commercial snapshot (PAY-9). The order state is
one enum mixing payment, fulfilment and cancellation, where November keeps separate
dimensions (PAY-5).

**Future migration scope (WO-PAY-001, roll-forward only):**
- **DB:** replace `order_state`/`reservation_state`; add the provider, allocation, refund-request, settlement and seller-provider-account tables; drop the six legacy payment tables (`payment_submission`, `payment_instruction_reissue`, `order_payout_snapshot`, `payout_details`, `payout_credential`, `refund`) and seven legacy functions (confirm, reject, reissue, render, report-refund, acknowledge-refund, confirmation-lapse); re-seed the claim enums, step-up actions, permission catalogue and readiness gate.
- **API:** remove 11 routes; add checkout, payment-attempt, payment, webhook and settlement routes; rework obligations, buckets, `allowed_actions`, storefront stats, deletion blockers and claims.
- **Console:** retire PaymentDecisions, PaymentEvidence, the reissue block and Payout in favour of provider onboarding.
- **Locale:** about 40 keys, some in the mobile catalogue.
- **Jobs:** remove two, rewrite `order.expire_sweep`, re-base the evidence purge, retire `payout.activate_due`.
- **Tests:** the c3-c7 and job suites, the console e2e, DB check 10.
- **Open input:** the checkout-attempt window duration is not stated in ORDER-01 or FIN-01 (PAY-6).

## 4. K-2 Discovery - LEGACY_SPEC_DRIFT (founder direction ruled)

| Capability | Class | Gap |
|---|---|---|
| For You (Scene-only) and ranking/personalisation | backend contract required | DSC-2 |
| Following | partial (`core.follow` table, no routes) | DSC-3 |
| Nearby | backend contract required; facts not designed | DSC-4 |
| Discounts | backend contract required; offer-price fact not designed | DSC-4 |
| Locally Made | backend contract required; fact not designed | DSC-4 |
| Scene entity, tagging, R-02 publication and PRIVATE lifecycle, Explore/hotspots | missing | DSC-1 |
| Scene engagement (Like, Save, Hide, Not Interested, Report) | backend contract required; partly undesigned | DSC-6 |
| Seller Stories | missing; design open (R-04) | DSC-5 |
| Collections and Saves | missing | DSC-7 |
| Marketplace search | partial (per-storefront only) | DSC-8 |
| Product engagement | partial (Ask Seller, Report exist; Save missing) | DSC-9 |
| Seller profile tabs | partial (header lacks About fields; no Scenes) | DSC-11 |
| Purchased Products / Buy Again | backend contract required (order lines carry no product reference) | DSC-16 |
| Buyer account controls | partial (sessions, deletion exist; no profile, area, preferences) | DSC-17 |
| Buyer navigation structure | UI-only possible; specified and matches the prototype | DSC-19 |

Also found: Reviews (DSC-12) and the Trust ladder (DSC-13) are built to legacy rules. That
means unverified and cancelled-order reviews, no VERIFIED_ORDER_FAILURE, no REBUILDING level,
a 10-Product cap on NEW sellers, and unconditional demotion. Notifications have no context
dimension and Seller-only preferences (DSC-15).

**WO-002 verdict:** none of this blocks a Buyer shell. Every channel, Saved, Search, Seller
profile, Purchased Products and the account rows can render as placeholders or empty states.

## 5. K-3 Background execution - FOUNDER_ARCHITECTURE_DECISION_REQUIRED (register status `FOUNDER_DECISION_REQUIRED`)

- **Jobs.** Graphile Worker runs **22 cron tasks** (the 20 DB-01 S24 jobs plus `payout.activate_due` and `worker.heartbeat`). They share one pool of 10. Nothing enqueues from API code, SQL functions or triggers: `add_job` appears only in a test.
- **Outbox.** Graphile is **not** the outbox. Durable intent is written to domain tables inside the business transaction (`core.notification` QUEUED rows, `order.expires_at`), and the jobs poll them. PostgreSQL holds the intent today, which is exactly what the November design requires (WRK-2, ALIGNED).
- **Semantics.** BullMQ/Valkey would not change durability. It changes operations: two Valkey instances (queue with `noeviction`, plus cache), a relay, delayed per-entity jobs and dead letters. The November generic `event_outbox`/`job_intent`/`event_delivery` schema does not exist (WRK-3) and would be needed whichever engine wins.
- **Blast radius.**
  - Code is narrow: graphile appears in three job files plus four ops scripts.
  - Tooling and governed documents are wide:
    - gate `worker-schema` is position 10 of 29, and positions are cited by ADU-RUL-03;
    - the render verifier;
    - the D-52 install machinery;
    - the `jobs` schema and the ten-schema count;
    - `worker-runtime.spec.ts`;
    - DB-01 S24 and CON-02 S3.6.
- **Deployment.** `ops/render.yaml` (never applied) has no Key Value service.
- **Independent of the engine:** per-row retries and dead letters (WRK-6), queue-age metrics (WRK-7), and the notification delivery model. The worker binds `FakeSmsAdapter` and `NullPushAdapter` unconditionally, and the code names FCM/APNs where NOTIF-01 names Expo Push (WRK-12, open design decision, release gate).

**Verdict: FOUNDER_ARCHITECTURE_DECISION_REQUIRED. K-3 does not block Mobile Buyer
development.** The client never sees the job engine, and the PostgreSQL rate limiter the
sign-in path uses is the design's own fail-closed fallback (WRK-8).

**K-8** is the same class of decision. The pack names PostgreSQL + **Drizzle** (ADR-03) and
NestJS/**Fastify**. The build runs Kysely with hand-authored node-pg-migrate SQL and
`@nestjs/platform-express` (ARCH-1, ARCH-2). It does not block Mobile.

## 6. K-4 Courier on MOBILE

| Where Courier is still CONSOLE or blocked | Evidence |
|---|---|
| Legacy wire spec | ADU-API-01 v1.11 S4: "Courier \| Cookie, `audience = CONSOLE`"; AUTH-01 v2.5 collapses `COURIER_WEB` into CONSOLE |
| Tests and UI | the c5 e2e Courier session is CONSOLE; the Courier screen lives in `apps/console/src/courier` |
| Enforcement | none by audience: routes carry only `@ActorRole('COURIER')`. A MOBILE bearer reaches them by omission, held only by the RLS policy `courier_assigned_orders` (SELECT, no audience or relationship term) (ID-3, ID-4) |
| Permission surface | no Courier permission code exists, in the DB or in AUTH-02 Appendix B; `verify-surface-markers` skips the Courier rows |
| Relationship model | `core.seller_courier(seller, account, revoked_at)` only: no profile, verification, availability, offer, acceptance or one-active-delivery rule (ID-5) |
| Contract | no schemas; custody-accept declared 201, returns 200; `GET /v1/seller/couriers` returns invites (ID-6) |

**Required future contract (WO-API-001 Courier slice, after a founder decision):**
1. Courier routes require a MOBILE session.
2. The first statement is an authorisation that proves the live Courier relationship for the
   order's seller and the live assignment for this account. Later it also checks profile
   VERIFIED and not suspended.
3. The founder chooses the mechanism: **(a)** a `fn_courier_authorize(account, order,
   audience)` database function, or **(b)** Courier permission codes with surfaces
   `{MOBILE}`, which the design must supply because AUTH-02 names none.
4. RLS stays as defence in depth, with a relationship term added.
5. **Nothing is granted to MOBILE users in general.**
6. The console Courier screen either retires or runs alongside during a stated transition.
7. The full Courier model (profile, relationship status, offers, acceptance, one active
   delivery) is a fulfilment work order (ID-5, SC-4).

## 7. K-5 Mode eligibility and generated types

**Sign-in works today** (ID-1, ALIGNED):
- Sequence: `POST /v1/devices`, then `GET /v1/bootstrap`, then `POST /v1/auth/otp/request` with `audience: "MOBILE"`, then `POST /v1/auth/otp/verify`.
- Verify returns an opaque token in the body, and it is sent as `Authorization: Bearer` from then on.
- The session is 30 days and sliding, with an existing e2e test.
- The app already keeps the token in SecureStore.

**There is no authoritative mode-eligibility source** (ID-7):
- `roles[]` is computed once at verify, frozen in the idempotent replay, never contains BUYER, and counts suspended team members.
- `/v1/bootstrap` and `/v1/auth/sessions` carry no account data.
- `/v1/seller/list` has owners and active team only, with a scalar role and no Courier.
- The app correctly offers Buyer only in release builds.

**Proposed addition** (additive to `GET /v1/bootstrap`, as AUTH-02 S120 asks):
- Filled only for an authenticated MOBILE bearer, sent with `Cache-Control: private, no-store`.
- A rendering hint only: every action is still authorised server-side.

```
account_context: {
  account_id,
  modes: { buyer: {available: true}, seller_companion: {available}, courier: {available} },
  seller_relationships: [{ seller_id, store_name, handle, seller_status,
                           relationship_type: OWNER|TEAM, standing: ACTIVE|SUSPENDED,
                           roles: [] }],
  courier_relationships: [{ seller_id, store_name, standing }],
  courier_active_assignment_count
}
```

**Facts behind each field:**

| Field | Backed by |
|---|---|
| OWNER relationships | `core.seller.owner_account_id` |
| TEAM relationships | `core.seller_team_member` (`revoked_at`, `suspended_at`, `role`) |
| Courier relationships | `core.seller_courier` |
| Active assignment count | `core.order_courier_assignment` (`ended_at IS NULL`) |
| `seller_companion.available` | at least one ACTIVE relationship whose role holds a grant with `MOBILE` in its surfaces. No new permission |

**Founder decisions needed:**
- which `seller_status` values open the Companion;
- whether `courier.available` may use "at least one live `seller_courier`" until the Courier profile exists.

**`@adulis/api-client`:**

| Question | Finding |
|---|---|
| Are OpenAPI types generated? | Yes. `src/schema.d.ts`, 4,532 lines |
| Deterministic and CI-authored? | Yes. `generate:check` passes, and the `contract-current` gate regenerates contract and client and fails on any diff |
| Are `paths`/schema types exported? | **Not before WO-001C.** The entry re-exported nothing, and its comments said the file did not exist |
| May Mobile consume them? | Yes. `apps/mobile` depends on it, and rule 1 allows `apps/*` to import `packages/*` |

**Repaired here** (API-3, allowed by WO-001C S10 because the contract already defines the
truth):
- `export type { components, operations, paths } from './schema'`;
- a type test asserting that bootstrap's 200 body resolves to `BootstrapResponseDto`, that `paths` and `operations` agree, and that an unknown path is a compile error. Mutation-checked: removing the export fails the test;
- the stale comments and README corrected;
- a temporary probe confirmed `apps/mobile` type-imports the entry under its stricter compiler settings.

No schema, DTO, bootstrap field or permission was invented.

**The real limit:** 131 of 135 operations carry no schema at all (API-1, register D-98). Only
`GET /v1/bootstrap` and three catalogue operations do. The auth, devices and sessions
operations that a typed sign-in needs are among the 131. The contract also declares the
bearer as `bearerFormat: "JWT"` for an opaque token, declares no per-operation security, and
omits the required headers (API-2).

## 8. Seller Companion

The Companion does **not** inherit Console powers:
- all 8 step-up permissions are CONSOLE-only by database CHECK (`step_up_is_console_only`);
- payout, team, ownership, subscription, identity, deletion and revoke-all are CONSOLE-only;
- the session audience is passed into `core.fn_has_permission`, which checks grant and surface in one query.

**The twelve MOBILE permissions** (seed `0006`, unchanged since):

| Permission | Gates | Verdict |
|---|---|---|
| `seller.orders:read` | seller order list/detail | partially aligned (November excludes ANALYST, CAMPAIGN_MANAGER) |
| `seller.orders:respond` | Can't Fulfil | open design decision (SC-9) |
| `seller.order_ready:update` | Mark Ready | partially aligned (November excludes SALES_SUPPORT) |
| `seller.payment_evidence:read` | payment screenshot view | **stale** (PAY-3, SC-1) |
| `seller.payment:confirm` | payment confirm and reject | **stale** (PAY-1, SC-1) |
| `seller.messages:read` / `:send` | inbox | aligned (`inbox:read` / `:reply`) |
| `seller.handoff:read` | handoff QR | **stale** credential model (SC-5) |
| `seller.reviews:read` | seller reviews | partially aligned (post-MVP on mobile) |
| `seller.analytics.basic:read` | analytics overview | partially aligned (post-MVP on mobile) |
| `seller.notifications:read` | seller notifications, preferences read | aligned functionally |
| `seller.notifications.preferences:write` | preferences write | partially aligned (post-MVP) |

**Gaps:**
- The built catalogue is the legacy 42 codes and 139 grants. November AUTH-02 v3.0 has 68 codes and 197 grants, with only 10 codes shared (SC-2).
- SALES_SUPPORT holds Mark Ready, QR, custody and courier powers the design denies it (SC-3).
- Missing on MOBILE: Courier offer (SC-4), purpose-bound Pickup credential (SC-5), urgent stock (SC-6), Claim summary (SC-7), Prepare (SC-8).
- Companion endpoints are schema-less (SC-11).

**Status:** every Companion paid-order action today depends on the stale Seller payment
confirmation. The Companion is **blocked on WO-PAY-001 and the permission re-seed**, and
nothing was broadened or removed. The `adulis-seller-companion` skill was corrected to say so
(SC-12).

## 9. K-6 Duplicate document lineages

| Lineage | Current design authority | Executable / gate dependency on the old file | Retire the old file? | Consolidated reissue? |
|---|---|---|---|---|
| AUTH-02 v3.3 vs AUTH-01 v2.8/v2.6/v2.5 | AUTH-02 v3.3 | **Yes.** v2.5 is parsed by `verify:permission-doc`; v2.6 by `verify:transcription`; the v2.4 seed SQL by `verify:permission-doc`, `verify:surface-markers` and `permission-matrix.spec.ts`; all three are ASCII-governed | Not until SC-2 re-points those gates at the AUTH-02 v3.0 catalogue | Yes, or gates that read `Contract_Registry/seller_permissions.json` (DOC-1) |
| CONSOLE-02 v4.3 vs CON-02 v3.2 | CONSOLE-02 v4.3 for console design | ASCII-governed only; cited by about 90 files as the build and operations doctrine | Its console-design content is superseded; its build doctrine has no November equivalent | Founder decides whether CON-02 is reissued against ARCH/DEPLOY or retired (DOC-2) |
| CSP-01 v1.1 vs SEC-01 v1.0 | CSP-01 v1.1 | None (9 comment citations) | Yes, after a citation sweep | No (DOC-3) |
| WEB-02 v4.2 vs WEB-01 v1.0 | WEB-02 v4.2 | None (5 citations) | Yes, after a citation sweep | No (DOC-4) |
| DPIA-01 v1.1 (October lineage) vs v1.0 (August draft) | the pack's v1.1 | None (2 skill citations) | After founder and legal confirm the October lineage covers the August items | Likely (DOC-5) |

The legacy PRD v8.5, API-01 v1.11 and DB-01 v1.19 remain the record of what is built.
API-01 and DB-01 are gate-parsed (`verify:surface-markers`, `verify:appendix`). PRD v8.5's
payment and discovery scope is superseded by the founder rulings (DOC-7). No file used by a
gate was moved or deleted.

## 10. K-7 Encoding

The ASCII rule (A3.5) is stated in:
- root `CLAUDE.md`;
- `docs/amendments/README.md`;
- `ops/scripts/verify-docs-ascii.mjs`, with its title in `gates.mjs`.

The gate **enforces** only its GOVERNED list, which is exactly the legacy executable
specifications. Its recursive walk also lists the 34 pack designs as "pre-A3.5 debt ... they
become GOVERNED as each is reissued", which is no longer true.

**Done here (documentation only):**
- root `CLAUDE.md` now scopes A3.5 to the legacy executable specifications and records the founder ruling: the pack stays UTF-8, with no ASCII duplicates, and its integrity check is `SHA256SUMS.txt`;
- the pack index says the same.

**Recommended tooling follow-up (not done, because it changes a gate):**
- skip `docs/system-designs/**` in the gate's debt walk, with a one-line reason;
- add a gate that runs `sha256sum -c --ignore-missing` over the installed pack.

That strengthens validation. Nothing currently enforced is relaxed (DOC-6).

## 11. Additional conflicts beyond K-1 to K-7

| Area | Finding | Gap |
|---|---|---|
| **Security** | The session id **is** the bearer/cookie credential, stored in plain form, and `GET /v1/auth/sessions` lists every live session id of the account. Any session, or any console XSS, can read the account's other credentials, including a MOBILE session obtaining a CONSOLE session id. A replayed id works from any HTTP client: the cookie attributes only bind browsers, and the Origin header is caller-written. It even counts as a known device for the new-device payout lock. That defeats the httpOnly cookie, the surface boundary and per-session revocation within one account. **High**, bounded by: one account only, and the SMS step-up still holds | SEC-1 (release gate) |
| **Security** | `PATCH /v1/devices/:id` is public and updates the push token by id with no ownership check. Device ids are client-chosen, travel in `X-Adulis-Device` and are listed by the same sessions route. Medium; low until a push provider is bound | SEC-2 (release gate) |
| **Security** | `otp/verify` stores the raw session token and the raw remembered-device token in the idempotency record for the replay window, undoing the device secret's hashing | SEC-3 (release gate) |
| **Security** | Revoke-all needs CONSOLE plus step-up, but `DELETE /v1/auth/sessions/{id}` has neither check, so any session can revoke every other one by looping | SEC-4 (release gate) |
| Storefront correctness | Unpublished Products stay publicly visible (reads filter `published_at`, unpublish sets `visibility`), and list prices read the seed `base_price_minor` | DSC-10 (release gate) |
| Privacy | Payment screenshots are never purged (`validated_at` never written) | PAY-10 (release gate) |
| Notifications | Worker SMS and push adapters are fake/null unconditionally; push provider conflict (FCM/APNs vs Expo Push) | WRK-12 (release gate) |
| Identity | Operator is a grant on an ordinary account, not a separate principal | ID-9 |
| Identity | One scalar role per membership, not a role-set union | ID-11 |
| Identity | Many team memberships per account allowed; MVP allows one | ID-12 |
| Session | No logout command | ID-2 |
| Handoff | QR minted at Seller confirmation; long-lived per-order token cached offline; expired orders can be handed off | PAY-12, SC-5 |
| Reviews / Trust | Built to PRD v8.5 rules, not REV-01 / TRUST-01 | DSC-12, DSC-13 |
| Architecture | Drizzle and Fastify named, Kysely and Express built | ARCH-1, ARCH-2 |
| Contract | Opaque token declared as JWT; no per-operation security; undeclared headers | API-2 |
| Mobile foundation | Legacy payment string shown on the foundation screen; Amharic choice visible in release builds | MOB-1, MOB-2 (release gate) |

Route **names** are not conflicts: AUTH-02 says "exact route names follow generated OpenAPI
contract". Only missing capabilities count.

## 12. Blocking classification

Every gap in the register states its WO-002 verdict explicitly.

| Blocks | Count | What it means |
|---|---|---|
| WO-002 Buyer | **0** | |
| Seller Companion | 21 | Payment confirmation, permission re-seed, role sets, Courier offer, Pickup credential, Prepare, schemas, eligibility |
| Courier | 11 | MOBILE audience, authorisation mechanism, Courier model, schemas, eligibility, handoff |
| Payment/checkout only | 15 | The entire K-1 migration, the outbox for checkout deadlines |
| Infrastructure migration only | 5 | K-3 and K-8 |

Courier and worker gaps were deliberately not allowed to block the Buyer shell.

## 13. WO-002 decision

**WO-002 - Buyer Application Shell & Core Navigation may begin before the corrections**,
on these conditions:

1. **Shell scope only.** It covers:
   - Buyer navigation per MOB-02 S11 (Home | Shop | Saved | Orders | You) and the five Home channels;
   - placeholders and empty states;
   - theme and locale;
   - the existing session plumbing (SecureStore, clear-on-sign-out).

   It builds no feed, Scene, product, cart, checkout or review data.
2. **No call to a schema-less endpoint, and no hand-written DTO** (R-21, API-1). That means
   **no typed OTP sign-in screen** until the auth/session slice of WO-API-001 publishes the
   otp, devices and sessions DTOs. The shell can be built and tested with the existing
   session boundary.
3. **Tab and channel labels arrive through a separate `packages/locale` PR**, with both
   languages (DSC-18). Nearby and Locally Made render statically, because bootstrap has no
   market enablement for them.
4. **Clean-ups WO-002 owns:**
   - replace the legacy payment sample string on the foundation screen (MOB-1);
   - gate the Amharic choice to development builds until human review (MOB-2, R-19);
   - replace the hardcoded English mode labels (DSC-18).
5. **Not a production release.** SEC-1 to SEC-4 must be fixed before any production mobile
   build, whatever WO-002 contains.

## 14. Recommended next work orders (not executed)

| Order | Work order | Contents | Can run alongside WO-002? |
|---|---|---|---|
| 1 | **WO-002 - Buyer Application Shell & Core Navigation** | Section 13 | - |
| 2 | **WO-API-001 - Mobile Session, Mode Eligibility & Courier Contract Correction** | **Slice A (first, small, before any real sign-in or release):**<br>- SEC-1 token hashing and public session id<br>- SEC-2 device update binding<br>- SEC-3 no raw tokens in the idempotency store<br>- SEC-4 single-session revoke rule<br>- auth, devices, sessions and bootstrap DTOs (API-1 subset)<br>- opaque bearer and security declarations (API-2)<br>- logout (ID-2)<br>- bootstrap `account_context` (ID-7)<br>**Slice B, after the founder decides ID-4:** Courier MOBILE audience and authorisation, Courier DTOs, custody-accept 200 (ID-3, ID-4, ID-6)<br>**Slice C:** permission catalogue reconciliation to AUTH-02 v3.0 with re-pointed gates (SC-2, SC-3, SC-6, SC-7, SC-10, DOC-1) | Yes. Slice A unblocks the typed sign-in |
| 3 | **WO-PAY-001 - Payment Architecture Migration to Provider-Authoritative Checkout** | PAY-1 to PAY-13 and PAY-15: provider model, order-state dimensions, allocation, multi-cart, refunds, claims, handoff entry, obligations, locale, jobs. Needs the checkout-window duration (PAY-6) | Yes; it blocks the Companion's paid-order flow and Buyer checkout |
| 4 | **WO-INFRA-001 - Background Worker Architecture Decision** | Founder ruling on K-3 (WRK-1, WRK-10, WRK-11) and K-8 (ARCH-1, ARCH-2); only then any migration. WRK-3, WRK-6, WRK-7 and WRK-12 are engine-independent and can be scheduled either way | Yes; does not block Mobile |
| 5 | Content and discovery (unnamed) | Scene domain, feed, follow, saves, search, Stories, engagement (DSC-1 to DSC-8), after the open designs (DSC-4, DSC-5, DSC-6) | After WO-002 |
| 6 | Reviews, Trust and Notifications reconciliation (unnamed) | DSC-12, DSC-13, DSC-15, WRK-12 | Later |
| 7 | Fulfilment / Courier model (unnamed) | ID-5, SC-4, SC-5, SC-8 | After WO-PAY-001 |
| 8 | Documentation housekeeping (unnamed) | DOC-2 to DOC-7: retire SEC-01, WEB-01 and the August DPIA after sweeps; CON-02 and PRD-01 decisions; the docs-ascii gate scope and the pack checksum gate | Any time |

Small backend defect fixes that could ride with WO-API-001 or stand alone: DSC-10 (storefront
visibility and price), DSC-16's `line_count`, ID-6's 201/200 and PAY-10's purge predicate.

**Founder decisions this audit surfaced:**
- K-3 worker engine;
- K-8 Drizzle and Fastify;
- the Courier authorisation mechanism (ID-4);
- the interim Courier eligibility rule (ID-7);
- which seller statuses open the Companion (ID-7);
- push provider (WRK-12);
- the facts behind Nearby, Discounts and Locally Made (DSC-4);
- Scene engagement design (DSC-6);
- Stories (DSC-5);
- Can't Fulfil on the Companion (SC-9);
- the checkout-attempt window (PAY-6);
- the DPIA lineage (DOC-5);
- the role of CON-02 (DOC-2) and of PRD-01 (DOC-7).

## 15. Changes made in WO-001C

| File | Change |
|---|---|
| `packages/api-client/src/index.ts` | Type-only re-export of `paths`, `components`, `operations`; header comment corrected |
| `packages/api-client/test/exports.test-d.ts`, `tsconfig.test.json`, `package.json` (test script) | Type test of the export, run by `pnpm --filter @adulis/api-client test` |
| `packages/api-client/README.md` | Status section corrected |
| `ops/scripts/verify-contract.mjs` | Stale header comment ("INERT TODAY") corrected; no logic change |
| `CLAUDE.md` | A3.5 scope (K-7 founder ruling) |
| `docs/system-designs/README.md` | Encoding paragraph per the ruling |
| `.claude/reference/DOCUMENT_AUTHORITY.md` | K-register updated with rulings and audit statuses; K-8 added; pointer to the full register |
| `.claude/reference/STACK_BASELINE.md` | K-3 status; K-8 |
| `.claude/skills/adulis-seller-companion/SKILL.md`, `EVALS.md`, `.claude/EVAL_CHECKLIST.md` | Payment ruling applied to description, banner, hard invariant and eval 5; pointer to SC gaps |
| `.claude/skills/adulis-financial-boundary/SKILL.md`, `EVALS.md`; `.claude/skills/adulis-api-engineer/EVALS.md`; `.claude/EVAL_CHECKLIST.md` | Same payment ruling: the "seller confirms receipt" posture, financial-boundary eval 2 and api-engineer eval 1 (found by the review) |
| `.claude/skills/adulis-spec-router/SKILL.md` | K-1 to K-8; step 8 maps register statuses to the router's statuses, so a founder-ruled item is never reopened as `SPEC_CONFLICT` |
| `CLAUDE.md`, `.claude/reference/DOCUMENT_AUTHORITY.md` | A classified disagreement carries its register status; founder-ruled items are not reopened |
| `docs/amendments/README.md` | K-1 to K-8; A3.5 row carries the WO-001C scope |
| `contracts/README.md` | "If a type is missing, the endpoint does not exist yet" corrected to match `index.ts` (the contract does not define it yet; D-98) |
| `docs/mobile/WO-001C-CONTRACT-GAPS.json`, this file | The register and this record |

The `packages/api-client` change is in its own commit, so it can ship as its own packages PR
under the repository's collision rule.

## 16. Validation

Run with Node 22.19.0 and pnpm 10.32.1 on the WO-001C working tree:

| Command | Result |
|---|---|
| `pnpm --filter @adulis/api-client test` | PASS (type test). Mutation-checked: removing the export fails with TS2305 on all three types |
| `pnpm --filter @adulis/api-client generate:check` | PASS: `schema.d.ts` matches the contract |
| `pnpm generate:openapi && pnpm generate:api-client`, then `git diff --exit-code -- contracts/ packages/api-client/src/schema.d.ts` | PASS: regenerating from the API source changes neither generated file (the `contract-current` gate's own steps) |
| `pnpm verify:contract` | PASS (113 path keys, all `/v1`) |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| `pnpm verify:deps` | PASS |
| `pnpm verify:docs` | PASS |
| `pnpm verify:mt-keys`, `pnpm verify:error-locale` | PASS |
| `pnpm verify:surface-markers` | PASS (19 M rows, 12 MOBILE grants) |
| Temporary `apps/mobile` probe type-importing `@adulis/api-client` | PASS; the probe was removed |
| Workspace tests except `@adulis/api` (`pnpm -r --filter '!@adulis/api' --filter '!adulis-platform' test`) | PASS. `api-client` type test; `locale` type tests and mobile boundary; `mobile` 5 suites, 26/26; `console`, `config` and `tokens` echo only (no unit tests by design) |

**`@adulis/api` tests were not run**, for two reasons:
- They need PostgreSQL and MinIO, and Docker was not running on this machine.
- No file they can reach changed: `apps/api` neither depends on nor imports `@adulis/api-client`, and the only other code edit is a comment in `ops/scripts/verify-contract.mjs`.

My first scripted attempt selected the workspace root too. Its `pnpm -r test` re-entered unfiltered and ran the API suites with no database: 580 connection failures, an environment result rather than a regression. It was re-run correctly as shown above. The last real API run (WO-001A, disposable containers) was 632/635, with the pre-existing failures recorded there.

**Reviews, both read-only:**

- **Security review.**
  - The change set introduces no risk: no secrets, the export is type-only, no gate is relaxed, and the instruction edits tighten rules.
  - SEC-1 is independently **confirmed, High**. A listed CONSOLE id replays from any HTTP client, and the replayed session counts as a known device for the new-device payout lock.
  - SEC-2 is **confirmed, Medium** (Low until a push provider is bound).
  - It added SEC-3 (raw tokens in the idempotency store) and SEC-4 (the revoke-all step-up bypass). Both were verified and added.
- **PR-toolkit code review.**
  - The api-client re-export is correct and erased at runtime under Babel, Metro and Vite. The type test bites: without `@ts-expect-error` the only error is TS2339, and with a real path it fails TS2578.
  - About 22 sampled gaps matched the code and the designs.
  - Findings applied:
    - the stale payment posture in the financial-boundary and api-engineer skills;
    - the status-name mismatch (the WO's verdict label versus the register's `FOUNDER_DECISION_REQUIRED`);
    - the general `SPEC_CONFLICT` rule against founder-ruled items, now mapped in spec-router;
    - stale "K-1 to K-7" ranges;
    - `contracts/README.md`;
    - `STACK_BASELINE`'s "one item";
    - five citations (PAY-3, PAY-5, ID-7, the skill pointer, and K-1's surcharge wording).

**Recorded, not changed:**
- **The `verify-contract.mjs` SKIP message.** It still says there is no producer until Tier 3. Changing printed output is outside the safe-change list, and the header now says so.
- **`contracts/README.md`, lines about committing the contract.** They say "Do not commit the result. CI ... commits it", which conflicts with the `contract-current` gate's own "COMMIT the result". The inconsistency predates this branch, concerns contract-authorship governance, and is left for the founder.

## 17. Not checked

- No API, database or migration code was executed for the audit. Findings are from reading
  code, migrations, tests and the contract. The storefront visibility leak, the expired-order
  handoff path and the never-running purge are code-reading results, not reproductions.
- `timing_config` seed values (the 48h figure comes from DDL comments).
- The ANL-01, MOD-01 and CHAT-01 event contracts, PRV/DPIA retention rules line by line, and
  the notification template catalogue.
- Render or Valkey pricing; graphile cron dedupe across replicas; ADU-RUL-03's citation of
  gate positions.
- The prototype beyond the Buyer tab list.
- Whether a team member can hold a role at MVP at all (`0006:89-92` says only OWNER is
  reachable).
