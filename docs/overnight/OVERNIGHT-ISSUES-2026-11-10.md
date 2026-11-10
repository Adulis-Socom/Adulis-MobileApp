# Adulis Overnight Issues -- 10 November 2026

## Batch baseline

- Starting branch: `discovery/wo-disc-001-scene-foundation`
- Starting SHA: `8706a6fa2353348ba3487234baa1aa2beb153b4b` (verified equal to `origin`, clean tree)
- Started from WO-DISC-001: yes (WO-DISC-001 reported BLOCKED on the ADU-DB-01 Appendix B mismatch, OVN-001)
- Work orders:
  - WO-DISC-001A
  - WO-DISC-002
  - WO-004A
- Follow-up (10 November, day): WO-SEC-001, rate-limit pool hardening, from WO-004A's
  HEAD `ce40823`; record `docs/security/WO-SEC-001-RATE-LIMIT-POOL-HARDENING.md`.
- Follow-up (10 November, day): WO-DISC-002A, For You contract closure, from WO-SEC-001's HEAD
  `f80e64e`; record `docs/discovery/WO-DISC-002A-FYP-CONTRACT-CLOSURE.md`, decisions
  `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`.

## Morning Summary (founder, read this first)

**Batch status: PARTIALLY COMPLETE - MORNING REVIEW REQUIRED.** All three work orders were delivered,
validated and pushed. What keeps the batch from "complete" is not unfinished work: an open
Critical security issue that predates the batch (OVN-045), and three High decisions that are yours
and gate production For You (OVN-027, OVN-030, OVN-032).

### What completed?
- **WO-DISC-001A**: ADU-DB-01 v1.20 installed (Appendix B: 120 tables, `core` 94); `verify:appendix`
  green with the gate unchanged; the c1-onboarding date test fixed (test only); WO-DISC-001 formally
  closed. Branch `discovery/wo-disc-001a-db-governance` @ `1d232ae`.
- **WO-DISC-002**: `GET /v1/fyp`, Scene units only, from the public gate re-read at response time;
  server-derived subject (Account or registered device) and Market; immutable algorithm versions;
  feed sessions; served impressions; opaque, secret-bound, expiring cursor with exact replay;
  migration 0055; ADU-DB-01 v1.21 (123 tables, `core` 97); OpenAPI and client regenerated.
  Only the RECENT source is real; the eight others are logged (OVN-025 to OVN-029), not simulated.
  Branch `discovery/wo-disc-002-for-you-api` @ `967cd2d`.
- **WO-004A**: Buyer Home For You shows the real feed (FlashList, Expo Image, infinite query,
  pull-to-refresh as a new session, every state honest, no engagement controls, other channels
  untouched). Native validation on the Android emulator against the real local API passed (guest
  feed, next page, refresh, sign-in, signed-in feed, Dark, 1.3 text, auth/shell regression).
  Branch `mobile/wo-004a-for-you-feed` (HEAD in the branch register below).

### What did not complete?
- Nothing in scope. Deliberately not built: qualified-impression telemetry, engagement actions,
  Scene Explore, Trust badge, a session retention purge, any personalised source.

### What is blocked?
- **Production For You** serves nothing until you approve an algorithm version (OVN-030) and the
  retention period is set (OVN-032). Personalised sources wait for DPIA R-04/R-05 (OVN-027).
- Nothing blocks development or review.

### What needs founder decisions?
1. **OVN-030** - May the RECENT-only technical baseline serve the pilot? (Approve
   `technical-baseline-recent-v1` for production, or wait for a tuned version.) Recommended:
   approve RECENT-only for the pilot; it is honest, non-personalised and deterministic.
2. **OVN-032** - Retention for feed sessions and served impressions (DPIA PA-06, legal). Guest rows
   already go with the device and Account rows at account deletion.
3. **OVN-027 / OVN-029** - DPIA acceptance before any affinity source; an exploration / new-Seller
   policy.
4. **OVN-035** - Confirm the registered device as the guest recommendation subject (ANL-01 asks
   for a separate anonymous id; a known device id lets anyone start sessions as that guest).
5. **OVN-055** - How long loaded For You cards may stay on screen after the app returns from the
   background (MOB-02 "according to configuration"). Recommended: the server session TTL.
6. Smaller: OVN-031 Seller-run threshold, OVN-033/OVN-051 the card's action list (REC-01 S13 vs
   R-05), OVN-048 the feed photo ratio, OVN-036 who mints a re-exposure impression id.

### Were any High/Critical findings discovered? Were they fixed?
- **OVN-038 CRITICAL - FIXED.** /v1/fyp counted its rate limit on a second pool connection inside
  its transaction; about ten concurrent requests could hang the API. Fixed and regression-tested.
- **OVN-039 HIGH - FIXED.** Guest writes were not bounded (letter-case device ids, unlimited
  continuations).
- **OVN-045 CRITICAL - RESOLVED by WO-SEC-001** (was OPEN at the end of the batch). The same
  pool-starvation pattern existed on the anonymous OTP request, the deletion-OTP request, the
  step-up request and one Courier route (and, the audit found, account recovery).
  Not changed overnight because the fix touches OTP rate-limit semantics that the T8 enumeration
  suite guards; it needed an Auth work order. WO-SEC-001 fixed it with the semantics unchanged,
  plus two more instances of the class (OVN-060 CRITICAL, OVN-061 HIGH) and a pool acquire
  timeout.
- OVN-001 HIGH (Appendix B) - fixed by v1.20. OVN-027, OVN-030, OVN-032 HIGH - your decisions.

### What gates/tests are red?
- None on the final branch: `pnpm test` (API 762/762, mobile 135/135, all packages), typecheck,
  lint, build, every verify gate, `db:check` 16/16, `db:determinism`, Expo Doctor 20/20, the 26-gate
  battery, Maestro flows.

### Which failures are baseline?
- OVN-020 (c1-onboarding date) - fixed in WO-DISC-001A.
- OVN-047 - a pre-existing T8 flake: a second full API run on one database within the hour can
  collide on random phone suffixes (passes alone).

### What branches were pushed?
- `discovery/wo-disc-001a-db-governance` @ `1d232ae`
- `discovery/wo-disc-002-for-you-api` @ `967cd2d`
- `mobile/wo-004a-for-you-feed` (stacked on the two above)
- No PR, no merge; `origin/main` untouched at `01302cf`.

### What should the founder review first?
1. OVN-045 - RESOLVED by WO-SEC-001; review `docs/security/WO-SEC-001-RATE-LIMIT-POOL-HARDENING.md`.
2. The For You production decisions: OVN-030, OVN-032, OVN-035.
3. `docs/discovery/WO-DISC-002-FOR-YOU-API.md` sections 1-4 and 6, then
   `docs/mobile/WO-004A-BUYER-FOR-YOU-FEED.md` sections 3 and 10.

### What should the next work order be?
- **An Auth hardening work order for OVN-045** (count rate limits inside the handler transaction or
  before it, keep T8 green, add a pool acquire timeout), then the For You telemetry work order
  (qualified impressions per ANL-01, once OVN-036 is decided).

### Environment notes
- All testing used the disposable database `adulis_gates`; the developer database `adulis` was
  never touched and does not have migration 0055 (`pnpm db:migrate` before using it, OVN-053).
- Native fixtures (two Sellers, twelve Scenes, MinIO images) were removed after the run.

## Issue Register

Severity is the severity when found; a fixed issue keeps it and changes only its status.
OVN-001 to OVN-019 are carried from `docs/discovery/WO-DISC-001-SCENE-DOMAIN-FOUNDATION.md`
section 22 (G-1 to G-20, related items consolidated); OVN-020 to OVN-022 are other carried items.

| ID | Work Order | Severity | Class | Status | Blocks | Finding | Evidence | Action Taken | Founder Decision Needed | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| OVN-001 | WO-DISC-001 (G-1) | HIGH | GOVERNANCE | RESOLVED | (was: WO-DISC-001 closure, so WO-DISC-002 and WO-004A) | ADU-DB-01 v1.19 Appendix B said `core` 90 / 116 tables; the database holds 94 / 120 after `0054_scene_posts.sql` | `pnpm verify:appendix` red in WO-DISC-001; green after v1.20 (120 tables, 71 enum types), `verify-appendix.mjs` unchanged | WO-DISC-001A installed ADU-DB-01 v1.20 (Appendix B regenerated counts, the four tables named, S30c), v1.19 superseded; WO-DISC-001 formally closed | No | Done |
| OVN-002 | WO-DISC-001 (G-2) | MEDIUM | CONTRACT_GAP | DEFERRED | None today; blocks the canonical Seller Scene RBAC | `seller.scene_posts:*` and `seller.content_media:manage` are not in the executable permission catalogue (42 codes, gate-pinned) | ADU-SCN-01 S13 vs migration 0006; WO-DISC-001 S11 | Temporary mapping: `seller.media:write` AND `seller.broadcasts:send` (exactly OWNER, ADMIN, CAMPAIGN_MANAGER, Console) | Yes, via WO-API-001C | Add the family in WO-API-001C and replace the mapping |
| OVN-003 | WO-DISC-001 (G-3) | MEDIUM | CONTRACT_GAP | FOUNDER_REVIEW_REQUIRED | None | No Scene error code: a blocked Scene publish reuses `PUBLICATION_BLOCKED`, whose English says "This product cannot be published yet"; stale `If-Match` uses `VALIDATION_FAILED` 409 + `slots.reason` because the taxonomy has no version-conflict code | ADU-API-01 S7.1 closed taxonomy; `packages/locale` | Precedent-following reuse, recorded | Yes: add Scene / version-conflict codes to ADU-API-01, or approve neutral wording | Add `SCENE_PUBLICATION_BLOCKED` and a version-conflict code in the next ADU-API-01 revision |
| OVN-004 | WO-DISC-001 (G-4) | MEDIUM | GOVERNANCE | FOUNDER_REVIEW_REQUIRED | None for current work | No transactional outbox (WRK-3) and the worker engine is open (K-3): Scene facts are `core.scene_post_transition` rows, re-evaluation is synchronous in the database, no consumers exist | WO-DISC-001 S9, S15 | Durable transition rows written in the same transaction | Yes: K-3 | Decide K-3, then add an outbox relay that reads the transition rows |
| OVN-005 | WO-DISC-001 (G-5) | LOW | OPEN_DESIGN_DECISION | DEFERRED | Scene carousel only | MEDIA-01 "bounded" carousel frames with no number | MEDIA-01 S186-188 | Primary image only | Yes: the carousel bound | Rule a number |
| OVN-006 | WO-DISC-001 (G-6) | LOW | IMPLEMENTATION_GAP | DEFERRED | Scene Explore hotspots | Hotspots need a versioned MediaPresentation, which does not exist | SCN-01 S22, S24; MEDIA-01 S429 | Not built; additive table later | No | Build with Scene Explore |
| OVN-007 | WO-DISC-001 (G-7) | LOW | OPEN_DESIGN_DECISION | DEFERRED | Scene archive/delete | Archive, restore and deletion not built; the registry has `scene_post.deleted` but the permission family has no delete code | registry vs AUTH-02 | ARCHIVED kept in the vocabulary | Yes: delete permission | Decide with OVN-002 |
| OVN-008 | WO-DISC-001 (G-8) | MEDIUM | IMPLEMENTATION_GAP | DEFERRED | Scene moderation | No Scene moderation enforcement and no SCENE report target (DSC-6); the public view is where the gate joins | `report_target_kind` (0001) | Recorded | No | Moderation work order |
| OVN-009 | WO-DISC-001 (G-9, G-19) | MEDIUM | IMPLEMENTATION_GAP | DEFERRED | None | Media readiness is a landed-object check only; no MediaAsset state; replaced/unattached uploads not purged; no rate limiting or outstanding-upload cap on Scene create/publish/upload signing (the repository has no throttler) | WO-DISC-001 S17, S21 | Recorded | No | Media lifecycle + throttling work order |
| OVN-010 | WO-DISC-001 (G-10) | LOW | CONTRACT_DRIFT | DEFERRED | None | Design-pack inconsistencies: `REMOVED` as a publication state (CATINV/CONSOLE) vs SCN/MOD; two private-reason names; `SCENE_PRODUCT_TAG_REQUIRED` vs `PRODUCT_TAG_REQUIRED`; EVT prose vs registry payload fields; two restoration notice texts; two PublicScenePost shapes | WO-DISC-001 S3 | Owning design + registry followed | Yes, at the next pack reconciliation | Reconcile the pack |
| OVN-011 | WO-DISC-001 (G-11) | MEDIUM | BUG | DEFERRED | None for Scenes | Catalogue: no central availability function; the storefront filters on `published_at`, and `fn_unpublish_product` never clears it, so an unpublished Product still lists on the public storefront | 0020:33-36; storefront.controller.ts | Scenes use `visibility`; reported, not changed | No | Catalogue fix work order |
| OVN-012 | WO-DISC-001 (G-12) | MEDIUM | BUG | NOT_REPRODUCED | None | Catalogue: `fn_delete_seller_effects` sets `unpublished_reason` without changing `visibility`, which the CHECK refuses (inferred from code) | 0023:180-182 vs 0007:130 | Recorded | No | Reproduce in a Catalogue work order |
| OVN-013 | WO-DISC-001 (G-13) | LOW | CONTRACT_GAP | DEFERRED | None | Deleting a Scene-tagged Product answers `409 PRODUCT_HAS_ACTIVE_ORDERS` ("live orders"): right refusal, wrong words | catalogue.service.ts deleteProduct | Recorded | With OVN-003 | Add a code or neutral copy |
| OVN-014 | WO-DISC-001 (G-14) | LOW | IMPLEMENTATION_GAP | DEFERRED | None | `SCENE_BECAME_*` notices have no client copy; only the owner is notified (design: "authorized Seller content recipients") | NOTIF-01 S917 | Recorded | Possibly: recipients | Console/Companion copy work order |
| OVN-015 | WO-DISC-001 (G-15) | INFO | IMPLEMENTATION_GAP | DEFERRED | None | Storefront Scene list, Scene search, slug history and a separate `/products` route are later work (For You is WO-DISC-002) | SCN-01 S45 | Recorded | No | Later work orders |
| OVN-016 | WO-DISC-001 (G-16) | MEDIUM | CONTRACT_GAP | OPEN | Relevant to WO-DISC-002 Market derivation | No Buyer Market resolution for anonymous public reads, so an out-of-Market link is not answered "market unavailable" (S30); `MARKET_NOT_ACTIVE` uses `market.activation_state` (D-183 overlapping Market truths) | SCN-01 S30 | Recorded | No | WO-DISC-002 derives the FYP Market server-side |
| OVN-017 | WO-DISC-001 (G-17) | LOW | IMPLEMENTATION_GAP | DEFERRED | None | No analytics event for Scene transitions (ANL-01 `scene_visibility_changed`) | ANL-01 S144 | Transition rows are the source | No | Analytics work order |
| OVN-018 | WO-DISC-001 (G-18) | INFO | TECH_DEBT | DEFERRED | None | Caption 5000 and 40 tags per request are technical payload bounds, not design rules | WO-DISC-001 S4, S6 | Recorded | Possibly | Confirm or rule numbers |
| OVN-019 | WO-DISC-001 (G-20) | LOW | IMPLEMENTATION_GAP | DEFERRED | None | No Scene visibility reconciliation sweep (EVT-01 `recompute_scene_visibility`); a safety net given the COMMIT-time path; needs K-3 | EVT-01 S793 | Recorded | With OVN-004 | Add after K-3 |
| OVN-020 | repository | MEDIUM | BASELINE_FAILURE | RESOLVED | (was: full-suite green) | `c1-onboarding` "GET lists ascending from today" hard-coded 2026-09-11; the list reads from `CURRENT_DATE`, so after that date the page is empty | Before: `TypeError: Cannot read properties of undefined (reading 'date')` on the current tree; also reproduced at `40a4dce` on a fresh 0001-0053 database. After: 37/37, API suite 698/698 | Test-only fix (WO-DISC-001A, separate commit): the test derives the next 11 September ahead of today; no production change | No | Done |
| OVN-021 | WO-DISC-001 | LOW | ENVIRONMENT | RESOLVED | None | During WO-DISC-001 one test run went to the developer database `adulis` (root package matched a `!@adulis/api` filter, and the disposable-DB variables were not exported in that shell); the Scene suite teardown aborted and left its fixtures | WO-DISC-001 session | Fixtures removed by their UUID prefix under replica mode; orphan sweep on `adulis` passes; procedure changed (per-session env script, packages run by name) | No | Keep running tests only on a disposable database |
| OVN-023 | WO-DISC-001A | LOW | GOVERNANCE | DEFERRED | None | ADU-DB-01 v1.19 recorded a one-line D-301 correction to S4.4b "at the next revision"; v1.20 is mechanical-only and does not carry it | v1.19 S0.1, T24 report item 4 | Recorded in v1.20 S0.1 | No (mechanical scope) | Apply at the next substantive ADU-DB-01 revision |
| OVN-024 | WO-DISC-001A | LOW | ENVIRONMENT | RESOLVED | None | A `git add` listing the already-moved v1.19 path failed as a whole, so the first reissue commit held only the rename | `git log` before push | Unpushed: reset to `8706a6f` (working tree kept) and recommitted with `git add -A` so the deletion is staged; verified both commits' file lists | No | Stage moved files with `git add -A` |
| OVN-025 | WO-DISC-002 | MEDIUM | IMPLEMENTATION_GAP | DEFERRED | Personalised For You (onboarding interests) | Candidate source ONBOARDING_INTEREST unavailable: no interest capture, `core.buyer_profile` holds no interests, no onboarding-interest contract | REC-01 S19; schema audit | Not implemented; logged | Yes: interest capture design | Specify interest capture before this source |
| OVN-026 | WO-DISC-002 | MEDIUM | CONTRACT_GAP | DEFERRED | FOLLOWING source; Following channel | Candidate source FOLLOWING unavailable: `core.follow` has no writer, and no Follow endpoint, event or domain contract exists anywhere in the pack | DSC-3; design gap C9 (research pass) | Not implemented; logged | Yes: Follow contract | A Follow domain work order |
| OVN-027 | WO-DISC-002 | HIGH | PRIVACY | FOUNDER_REVIEW_REQUIRED | Any personalised ranking (CATEGORY_AFFINITY, SELLER_AFFINITY, guest affinity) | Affinity sources unavailable: no engagement events or affinity projection; personalisation is not approved (DPIA-01 R-04/R-05 launch-blocking, acceptance NOT ACCEPTED; MOB-02 S29 guest affinity under the same gate). OPEN_DECISIONS omits this gate | DPIA-01 :227, :1602-1603; MOB-02 :726 | Not implemented; RECENT is non-personalised WO-DISC-002A: decision package `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`, section OVN-027 (PENDING). No personalisation built; R-04/R-05 not claimed accepted. | Yes: DPIA acceptance | Close DPIA R-04/R-05 before any affinity source |
| OVN-028 | WO-DISC-002 | LOW | IMPLEMENTATION_GAP | DEFERRED | TRENDING source | TRENDING unavailable: no qualified-impression or engagement telemetry; R-13 forbids blending popularity with Trust | REC-01 S19; ANL-01; R-13 | Not implemented; logged | No | After qualified-impression telemetry exists |
| OVN-029 | WO-DISC-002 | MEDIUM | OPEN_DESIGN_DECISION | FOUNDER_REVIEW_REQUIRED | NEW_SELLER, NEW_CONTENT, EXPLORATION sources | No approved exploration share, new-Seller policy or budget (DPIA-01 R-05 fair exposure) | REC-01 S19; DPIA-01 :228 | Not implemented; logged WO-DISC-002A: decision package `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`, section OVN-029 (PENDING). Recommended: RECENT plus the Seller cap for the pilot, budget from pilot data. | Yes: exploration policy | Founder sets exploration policy |
| OVN-030 | WO-DISC-002 | HIGH | FOUNDER_DECISION_REQUIRED | FOUNDER_REVIEW_REQUIRED | For You in production | Production serves only an algorithm version with `production_approved = true`; the seeded `technical-baseline-recent-v1` is not approved, so production For You is empty by design | `fyp.service.ts` activeVersion; e2e 'production serves only a founder-approved version' | Gate built and tested WO-DISC-002A: decision package `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`, section OVN-030 (PENDING). Recommended: a pilot version RECENT + Seller cap 2; production_approved still false. | Yes: approve a version (or the baseline) for production | Decide whether RECENT-only may serve the pilot |
| OVN-031 | WO-DISC-002 | LOW | OPEN_DESIGN_DECISION | FOUNDER_REVIEW_REQUIRED | Seller concentration control | Seller-run cap implemented and tested but OFF: no approved threshold (KB names only 'ten consecutive Scenes from one Seller') | ADULIS-KB :377-381; REC-INV-19 | Off in the baseline (`seller_adjacency_max: null`) WO-DISC-002A: decision package `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`, section OVN-031 (PENDING). Mechanism verified (deterministic, cross-page, never withholds); proposal: seller_adjacency_max 2 in a new immutable version. Not activated. | Yes: threshold | Set it in a new version row |
| OVN-032 | WO-DISC-002 | HIGH | PRIVACY | FOUNDER_REVIEW_REQUIRED | Production activation of For You | No retention period for For You sessions and impressions and no purge of live ones (DPIA-01 PA-06 'LEGAL REVIEW REQUIRED'). Mitigated tonight: guest rows are deleted with the device (cascade, tested with the real purge job); Account rows are purged at account deletion (`fn_delete_account`, tested) | PRV-01 :190; DPIA-01 :227 | Lifecycle hooks built; retention period not invented WO-DISC-002A: decision package `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`, section OVN-032 (PENDING). Field-by-field purpose table and candidate periods for LEGAL review; Account deletion and device purge verified by e2e; no purge job built. | Yes: legal retention period | Add a purge job once the period exists |
| OVN-033 | WO-DISC-002 | LOW | CONTRACT_DRIFT | RESOLVED | Engagement actions on the card | No allowed-actions list in the unit: no engagement action has a backend, and REC-01 S13 (Save, Share, Follow Seller, Not Interested, Report, tag) and R-05 (Like, Save, Share, Reviews, Follow, More, Explore) differ | REC-01 S13; MOB-02 R-05 (C1) | Omitted rather than invented WO-DISC-002A: RESOLVED AT DESIGN AUTHORITY (not built): R-05 canonical action model -- Like, Save, Share, Reviews, Follow, More (Not Interested / Hide / Report), Explore the Scene; no public counts/comments/reposts -- supersedes MOB-02 S50 and REC-01 S13; dependency matrix in the WO-DISC-002A record S14. | Yes: reconcile the action list | Reconcile before engagement work |
| OVN-034 | WO-DISC-002 | LOW | IMPLEMENTATION_GAP | DEFERRED | Trust badge on the feed card | The prototype card shows the Seller's public Trust level; no public Trust read exists (WO-DISC-001 public Seller summary is handle + store name) | Prototype ShoppablePostUnit; TRUST-01 :629, :722 | Not shown; not invented | No | Add with a public Trust read |
| OVN-035 | WO-DISC-002 | MEDIUM | PRIVACY | FOUNDER_REVIEW_REQUIRED | None tonight (founder decision applied) | Guest recommendation subject is the registered device (batch decision). ANL-01 asks for a separate first-party `anonymous_id`; AUTH-02 limits device purposes to notification routing, risk and session management; and a known device id lets anyone start sessions as that guest (AUTH-02 S39 'knowing a device id authorises nothing'): it cannot read the guest's sessions, but can burn its limits and write impressions in its name | ANL-01 :171, :277; AUTH-02 :269 (C6) | Followed the batch decision; recorded WO-DISC-002A: decision package `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`, section OVN-035 (PENDING). Proposed server-issued anonymous recommendation identity (WO-DISC-002A record S11); device subject kept for the non-personalised feed only. Conflict REC:122 vs ANL:37/277 recorded. | Yes: confirm device-as-subject or an anonymous id | Confirm with the DPIA owner |
| OVN-036 | WO-DISC-002 | LOW | CONTRACT_GAP | FOUNDER_REVIEW_REQUIRED | Qualified-impression telemetry | REC-01/KB give every served unit an impression_id; ANL-01 says delivery is not an impression and a re-exposure gets a new id. Who mints the re-exposure id is undefined | REC-01 S12/S55; ANL-01 :324, :331 (C4) | Stores served impressions only WO-DISC-002A: the served-unit identity is now `serve_id` (contract + client regenerated); qualified `impression_id` designed (client-minted per observation, server-validated against serve_id), re-exposure table in the record S6; WO-DISC-002A: decision package `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`, section OVN-036 (PENDING). | Yes | Resolve before analytics ingestion |
| OVN-038 | WO-DISC-002 | CRITICAL | SECURITY | RESOLVED | (was: any traffic to /v1/fyp) | Session-start rate limit counted on a second app-pool connection while the request transaction held one: about ten concurrent anonymous first-page requests could exhaust the 10-connection pool and hang every endpoint | Security review (WO-DISC-002); `rate-limit.service.ts`, `fyp.service.ts` | `consume` takes the caller transaction; /v1/fyp counts inside its own. e2e: 14 concurrent starts all 200 | No | Done |
| OVN-039 | WO-DISC-002 | HIGH | SECURITY | RESOLVED | (was: bounded guest writes) | Guest writes were not bounded: each letter-case variant of a device id got its own 120/h bucket, and continuations had no limit (up to 500 impression writes per session start) | Security review | Subject id taken from the database row (canonical); new pages limited to 600/h per subject (replays write nothing and are not limited). e2e for both | No | Done |
| OVN-040 | WO-DISC-002 | MEDIUM | SECURITY | OPEN | Bounding guest device creation | Pre-existing: `POST /v1/devices` is anonymous and not rate-limited, and app bootstrap stamps a Market on any registered id, so a script can mint subjects (each with its own For You limits) | `auth.controller.ts` devices route; bootstrap app branch | Recorded (Auth/Device domain, not changed here) | No | Cap app device registration like bootstrap's web mint cap |
| OVN-041 | WO-DISC-002 | MEDIUM | BUG | RESOLVED | (was: page 2 for uppercase device ids) | A device header in upper case (iOS `UUID().uuidString`) could never continue a session: the stored id is lower case, so every cursor was CURSOR_INVALID (failed closed) | Security review | Canonical id from the database; e2e 'a device is one subject however the client cases its id' | No | Done |
| OVN-042 | WO-DISC-002 | MEDIUM | BUG | OPEN | Guest For You (and guest carts) after media_retention | Pre-existing: app guest devices never refresh `last_seen_at` (only web bootstrap, binding and the authenticated PATCH do), so `device.purge_unbound` deletes an active guest's device media_retention after registration; For You then answers 400 X-Adulis-Device and the app registers only once | Security review; `bootstrap.controller.ts` app branch; `e4-retention.ts` | Recorded (Device domain, not changed here) | No | Refresh last_seen_at on app bootstrap, or re-register on 400 |
| OVN-043 | WO-DISC-002 | LOW | BUG | RESOLVED | (was: deleted-account consistency) | A session could be created for an account whose deletion committed between authentication and the session insert | Security review | Subject read requires `status = 'ACTIVE'` and takes `FOR KEY SHARE`, which serialises with `fn_delete_account`'s `FOR UPDATE` | No | Done |
| OVN-044 | WO-DISC-002 | LOW | SECURITY | RESOLVED | (was: owner page latency) | The session row was locked before the subject and secret checks, so anyone holding a `feed_session_id` could hold the owner's lock with garbage cursors | Security review | Verify on a plain read, then lock and re-read served_count | No | Done |
| OVN-045 | WO-DISC-002 (review follow-up) | CRITICAL | SECURITY | RESOLVED | (was: API availability under a burst) | The rate limiter was counted on a second app-pool connection inside a handler transaction at FIVE routes: the anonymous `POST /v1/auth/otp/request` and `POST /v1/deletion/otp/request`, `POST /v1/auth/step-up/request`, `POST /v1/seller/couriers`, and `POST /v1/auth/recovery` (found by the WO-SEC-001 audit). Ten concurrent requests could hold all ten pooled connections while each waited for another, with no acquire timeout: the API hung | WO-SEC-001 burst suite (`test/wo-sec-001-pool-starvation.e2e.spec.ts`), 14 concurrent requests per route on the real 10-connection pool: old route code 14 x 503 on every route; fixed 14 x 202 (courier 10 x 201 + 4 x 429), `/healthz` served mid-burst. Static guard reports the five sites on the old tree, none now | WO-SEC-001: every count moved to a `beforeTransaction` step of `runIdempotent` (after the replay check, before the transaction, nothing held), so the counting semantics are unchanged (replay burns nothing; a refused or failed request keeps its count; courier authorizes before counting); thresholds unchanged; pool acquire timeout `DB_POOL_ACQUIRE_TIMEOUT_MS` (5000 ms) on the app and financial pools -> 503 + Retry-After; static guard spec | No | Done |
| OVN-037 | WO-DISC-002 | LOW | GOVERNANCE | DEFERRED | First affinity/feature table | REC-01 S45 wants weights/affinity; ADU-DB-01 S19 and check 6 forbid score/rank/weight/affinity columns in feed migrations. Today's configuration is opaque jsonb and check 6 passes on 0055 | check-06; REC-01 S45 | None needed tonight | Yes, when personalisation lands | Governance ruling with the first affinity table |
| OVN-047 | repository | LOW | TEST_FLAKE | OPEN | None | RE-DIAGNOSED by WO-SEC-001: the T8 'a known and an unknown phone are indistinguishable' failure (`202:` vs `429:RATE_LIMITED`) is NOT the `deletion-otp-request` bucket (a 3-digit random phone would need three collisions within the hour). `t13-delivery-layer` 'the GLOBAL ceiling binds...' sets the PLATFORM-WIDE daily OTP hard limit to 1 for a moment; any anonymous OTP request in a parallel worker during that moment is RATE_LIMITED | Reproduced on the disposable DB: T8's test alone 3/3 green; with a t13-style toggle beside it 4/4 red with the recorded signature; `otp_global_daily_hard_limit` restored to 5000. The same moment failed `t8-device-bootstrap` once in WO-SEC-001's final validation (a non-t13 worker logged the global soft limit crossed with market spend 0); alone 14/14 twice | NOT fixed: WO-SEC-001 authorised a test-cleanup fix only for the bucket diagnosis, which is wrong | No | t13 should change the platform row inside the transaction it asserts in and roll back, so no other connection sees it |
| OVN-046 | WO-DISC-002 | LOW | ENVIRONMENT | RESOLVED | None | The staged `git mv` of v1.20 rode into the migration commit (the OVN-024 slip again: a staged rename joins whichever commit comes next) | `git show --stat` of the first, unpushed commit | Reset the four unpushed commits to `1d232ae` and recommitted with the rename in the docs commit; nothing had been pushed | No | Stage renames only with the commit that owns them |
| OVN-048 | WO-004A | LOW | OPEN_DESIGN_DECISION | FOUNDER_REVIEW_REQUIRED | None (presentation) | MEDIA-01 gives the FYP derivative 'a known aspect ratio' but no number; the card uses a fixed 4:5 frame with cover fit | MEDIA-01 :386-388; `SceneCard.tsx` PHOTO_ASPECT | Fixed frame, one constant WO-DISC-002A: decision package `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`, section OVN-048 (PENDING). 4:5 kept; Media derivative spec proposed for the Media owner. | Yes: the FYP derivative ratio | Set it with the Media derivative spec |
| OVN-049 | WO-004A | LOW | TEST_INFRA | RESOLVED | (was: mobile tests) | FlashList 2 ships ESM that jest-expo does not transform, and needs its own Jest viewport; renderRouter runs modern fake timers, so real-timer waits never fire | Route error boundary in the shell tests; a hung test | Added `@shopify/flash-list` to transformIgnorePatterns and its jestSetup; tests advance fake timers | No | Done |
| OVN-050 | WO-004A | LOW | ENVIRONMENT | RESOLVED | None | No WebP encoder on this machine and Scene uploads require image/webp; native fixtures used a minimal solid-colour lossless (VP8L) writer kept in the session scratchpad, so lossy photo decoding was not exercised on device | Native run: fixture photos rendered as solid colours | Recorded | No | Use real photos when a fixture kit exists |
| OVN-051 | WO-004A | MEDIUM | CONTRACT_GAP | RESOLVED | Engagement on the feed card | The prototype card shows Follow, More, Like, Save, Share, Reviews and Explore the Scene; none has a backend, so the production card draws none and does not navigate | Prototype ShoppablePostUnit; WO-004A S3.10/S3.12 | No fake controls; recorded WO-DISC-002A: RESOLVED AT DESIGN AUTHORITY (not built): R-05 canonical action model -- Like, Save, Share, Reviews, Follow, More (Not Interested / Hide / Report), Explore the Scene; no public counts/comments/reposts -- supersedes MOB-02 S50 and REC-01 S13; dependency matrix in the WO-DISC-002A record S14. | Yes (with OVN-033) | Add each control with its endpoint |
| OVN-052 | WO-004A | INFO | ENVIRONMENT | RESOLVED | None | Native validation reused the 9 November debug APK: its native dependencies and app.json are identical to this branch, so Metro served this branch's JavaScript (no 15-minute native rebuild) | Dependency and app.json diff: identical | Recorded | No | Rebuild natively when a native dependency changes |
| OVN-053 | WO-004A | INFO | ENVIRONMENT | OPEN | Running this branch's API on the developer database | The developer database `adulis` does not have migration 0055 (all batch testing used the disposable `adulis_gates`) | `core.fyp_algorithm_version` absent in `adulis` | Untouched by design | No | `pnpm db:migrate` before running the API from these branches |
| OVN-054 | WO-004A | LOW | TEST_INFRA | RESOLVED | (was: Maestro flows) | Six Maestro flows used the For You placeholder sentence as their startup marker | `.maestro/*.yaml` | They accept the feed label or the empty sentence; new `buyer-for-you.yaml`; `foundation-smoke.yaml` (Expo Go) updated, not re-run | No | Done |
| OVN-055 | WO-004A | MEDIUM | SECURITY | FOUNDER_REVIEW_REQUIRED | None tonight (WO-004A S3.16 allows already-rendered content) | Loaded cards never expire on the device: a Scene that turns PRIVATE stays on screen until the Buyer refreshes, and an ended server session used to leave its cards up. PART FIXED: when the server ends the session (CURSOR_EXPIRED/INVALID) the cards are now removed and a full-screen Refresh shown. OPEN: how long loaded content may stay after the app returns from the background (MOB-02 :1919 'according to configuration'; :1915 'do not show restricted content merely because it remains in in-memory FYP state'); no number exists | Mobile security review; e2e 'drops the ended session's cards' | Ended-session cards removed; interval not invented WO-DISC-002A: foreground revalidation BUILT (MOB-02 S185): after FOREGROUND_REVALIDATE_AFTER_MS a new session starts and old cards are withheld; 5 min in development (provisional), 0 in release (fail closed) until decided; WO-DISC-002A: decision package `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`, section OVN-055 (PENDING). | Yes: the foreground refresh interval | Refresh on foreground when older than the server session TTL (3600 s today) |
| OVN-056 | WO-004A | LOW | SECURITY | RESOLVED | (was: refresh integrity) | After a refresh, a remount within 5 minutes (navigator replacement on UPGRADE_REQUIRED, an error-boundary retry) revived the pre-refresh cache entry and could continue the old session's cursor | Mobile security review | `gcTime: 0` on the feed query: an unshown feed is dropped, a remount starts a new session | No | Done |
| OVN-057 | WO-004A | LOW | SECURITY | RESOLVED | (was: image origin) | `mediaUrl` accepted userinfo in the media origin (`https://media.adulis.et@evil.example`), so a misconfigured or compromised bootstrap could point photos at another host | Mobile security review | The authority may not contain `@` or a backslash; two refusal tests added | No | Done |
| OVN-058 | WO-004A | INFO | SECURITY | RESOLVED | None | A guest-keyed feed request in flight when sign-in lands could carry the new bearer (the server refuses the guest cursor for an Account, so no exposure) | Mobile security review | Guest-keyed requests send no bearer | No | Done |
| OVN-059 | WO-004A | INFO | SECURITY | OPEN | Production deployment | The cursor (session, offset, continuation secret) travels in the `/v1/fyp` query string by contract; the API logs only the path, but a proxy or CDN access log would record it | ADU-API contract; `handler-transaction.ts` logs `req.path` | Recorded | No | Strip query strings from edge/proxy logs for /v1/fyp |
| OVN-060 | WO-SEC-001 | CRITICAL | SECURITY | RESOLVED | (was: API availability; OTP brute-force budget under load) | Same class as OVN-045, not a limiter call: `OtpService.burnAttempt` wrote the wrong-guess counter on a second app-pool connection from inside the verify transaction of the ANONYMOUS `POST /v1/auth/otp/verify` and `/v1/deletion/otp/verify`, and of `/v1/auth/step-up/verify`. Ten concurrent wrong guesses could hang the API; with only an acquire timeout, the starved guesses failed with 503 and were never counted (free guesses) | WO-SEC-001 audit + burst suite: old code 14 wrong sign-in guesses -> 14 x 503, none counted; fixed -> 4 x OTP_INVALID + 10 x OTP_ATTEMPTS_EXCEEDED style outcomes with the attempt count at most 5 (it IS the number of compares), right code dead afterwards; step-up exactly 5. With the row lock removed the same burst compared 12 codes (the assertion catches it); a verify against a held challenge answers 429 at once with nothing compared | The challenge is read FOR UPDATE NOWAIT (anonymous sign-in / deletion; step-up waits behind its own lock) and a wrong guess is counted in the comparing transaction, which commits before the refusal is served (`RefuseAfterCommit`): no second connection, never more compares than the budget (ADU-AUTH-02 v3.3 S17), no queueing on the lock. A first draft that counted after the rollback was rejected by both reviews before commit; the replacement was re-reviewed: closed | No | Done |
| OVN-061 | WO-SEC-001 | HIGH | SECURITY | RESOLVED | (was: API availability) | Same class: `HandoffService.processScan` retried a lost nonce race (23505) by recursing INSIDE its own transaction callback, holding one connection while acquiring another; ten or more concurrent duplicate scans from a Buyer with a real order and QR could hang the API (`POST /v1/handoffs/sync`) | Found by the WO-SEC-001 static guard; c5-handoff green after the fix | The retry moved outside the transaction (`processScan` around `processScanOnce`): one retry, only for `handoff_scan_nonce_key`; any other unique violation rethrows | No | Done |
| OVN-062 | WO-SEC-001 | LOW | TEST_FLAKE | OPEN | None | T8 (before each test), t12 and c6 purge `otp-request` (c6 also `deletion-otp-request`, `step-up-request`, `auth-recovery`) BY BUCKET KEY, mid-run, in parallel workers, so any suite asserting a seeded count on those buckets races them | WO-SEC-001: its `otp-request` threshold test failed 2 of 3 combined runs until it ran last and retried only on a purge the bucket itself shows; 5/5 green afterwards | Worked around inside the WO-SEC-001 suite; the other suites not changed | No | Purge only the suite's own subjects (keyed hashes), as the courier bucket already is |
| OVN-063 | WO-SEC-001 | INFO | TECH_DEBT | OPEN | None | The worker process's own pool (`jobs/runtime.ts`, max 12 for concurrency 10) has no acquisition bound; no nested use was found in `src/jobs` | WO-SEC-001 audit | Recorded; out of the app/financial scope | No | Apply `DB_POOL_ACQUIRE_TIMEOUT_MS` there when the worker is next touched |
| OVN-064 | WO-SEC-001 | INFO | SECURITY | OPEN | None | Operational hardening beyond WO-SEC-001: the acquire bound does not cover LOCK waits (courier per-(seller, phone) lock, step-up and OTP challenge FOR UPDATE); `Retry-After: 5` on the 503 is fixed (clients retry together); under pool starvation, transport can fail after commit, spending a user's OTP request budget without an SMS | WO-SEC-001 reviews (INFO) | Recorded; lock holders always make progress, so the waits are bounded in practice | No | Consider `lock_timeout` / `statement_timeout` and a jittered Retry-After in an operations work order |
| OVN-065 | WO-SEC-001 | LOW | SECURITY | OPEN | None | Pre-existing (Auth): after no live challenge is found, or a wrong guess at the live one, the code is also compared against other recent challenges to answer OTP_EXPIRED; those compares are not counted and the query also matches challenges not yet transported, so a minted-but-unsent code can be probed through OTP_EXPIRED vs OTP_INVALID until it goes live | WO-SEC-001 security re-review | Recorded: OTP semantics (4.2), outside a connection-use work order | No | Compare only `transported_at IS NOT NULL AND expires_at <= now()` (codes a person could have held, now dead) |
| OVN-066 | WO-DISC-002A | LOW | SECURITY | OPEN | None | Cards are re-checked only on a return from the background or a new page: a Buyer who keeps the app foregrounded for hours keeps the cards loaded at the start (MOB-02:1915 "not ... indefinitely") | WO-DISC-002A security review (INFO 6) | Recorded; outside WO-DISC-002A scope | Yes: with OVN-055 | A foreground age check on the same interval, or accept |
| OVN-067 | WO-DISC-002A | LOW | DOC_GAP | OPEN | None | ADU-REC-01 v3.2 S132/S436/S454 and ADULIS-KB:297 call the server-assigned served-unit identity `impression_id`; ADU-ANL-01 S331 uses it for a qualified observation. WO-DISC-002A adopted `serve_id` for delivery (founder decision) | WO-DISC-002A record S3 conflict C1 | Contract follows the founder decision; governed docs not edited | No (revision process) | Authorised revision of REC-01 and the KB to the serve_id / impression_id split |
| OVN-068 | WO-DISC-002A | LOW | TECH_DEBT | OPEN | Scene Report action | `POST /v1/reports` target kinds are PRODUCT, REVIEW, MESSAGE, SELLER, STOREFRONT: no SCENE, and a Scene report must bind the exact revision the Buyer saw (SCN-01:231) | WO-DISC-002A dependency matrix; reports.controller zod enum; core.report_target_kind | Recorded | No | Add a SCENE target kind with revision binding through DB governance when More: Report is built |
| OVN-069 | WO-DISC-002A | INFO | TECH_DEBT | OPEN | None | The served-unit table keeps its 0055 name `core.fyp_impression` although it records delivery (its id is the serve_id), never a qualified impression | WO-DISC-002A record S8 | Recorded naming debt; no migration | No | Rename in the work order that next migrates the table (for example the retention purge) |
| OVN-070 | WO-DISC-002A | INFO | SECURITY | OPEN | None | Pre-existing: For You sessions a device made while signed out (guest subject) survive that person's Account deletion until device.purge_unbound runs; the cursor secret travels in the query string (OVN-059) | WO-DISC-002A security review (pre-existing context) | Recorded | Yes: with OVN-032 / OVN-035 | Decide with the retention and guest-identity decisions |
| OVN-071 | WO-DISC-002A | LOW | BUG | OPEN | None | Pre-existing (WO-DISC-002): a REPLAY of the session's last served page returns a continuation cursor although the original delivery returned null (`fyp.service.ts` replay: more = next < servedCount || servedCount < max_items); the client then makes one extra request that answers an empty page and a null cursor -- no duplicate content, one wasted call | WO-DISC-002A native measurement (replayed page 2 of 2 carried a cursor) | Recorded; not changed (outside the served-unit identity, which is preserved) | No | Record whether the session is exhausted when a page is served, and replay that answer |
| OVN-022 | WO-DISC-001 | LOW | TECH_DEBT | RESOLVED | None | The committed Kysely types predated migrations 0040, 0043 and 0046 | WO-DISC-001 S18 | Regenerated in WO-DISC-001 (`fcc56f3`) | No | Regenerate after every migration |

## Test / Gate Register

| Work Order | Command / Gate | Result | Baseline comparison | Notes |
|---|---|---|---|---|
| WO-DISC-001A | `pnpm verify:appendix` | PASS (v1.20: 120 tables, `core` 94, 71 enum types) | RED at WO-DISC-001 (`8706a6f`) | gate script unchanged |
| WO-DISC-001A | `pnpm verify:docs` | PASS | PASS | v1.20 is GOVERNED and ASCII |
| WO-DISC-001A | `pnpm typecheck` / `lint` / `build` | PASS | PASS | |
| WO-DISC-001A | `pnpm db:check` | 16/16 | 16/16 | disposable DB `adulis_gates` |
| WO-DISC-001A | `pnpm db:determinism` | PASS | PASS | |
| WO-DISC-001A | `pnpm --filter @adulis/api test` | 698/698 | 697/698 (OVN-020) | first fully green API run |
| WO-DISC-001A | console, mobile, api-client, config, locale, tokens tests | PASS | PASS | run by package name on the disposable DB |
| WO-DISC-001A | `pnpm verify:orphan-sweep` | PASS | PASS | after the full suite |
| WO-DISC-002 | `pnpm test` (all packages) | PASS: API 762/762 (48 suites), mobile 101/101, every package | API 698/698 at WO-DISC-001A | +31 unit, +33 e2e |
| WO-DISC-002 | `pnpm --filter @adulis/api test` (second run) | 761/762: one T8 flake, OVN-047; that spec alone 10/10 | 698/698 | second run on the same database within the hour |
| WO-DISC-002 | `pnpm verify:contract` / `api-client generate:check` | PASS / PASS | PASS | regeneration byte-identical twice |
| WO-DISC-002 | `pnpm verify:appendix` | PASS (v1.21: 123 tables, `core` 97, 71 enum types) | PASS (v1.20) | gate script unchanged |
| WO-DISC-002 | `pnpm verify:docs` / `verify:deps` | PASS / PASS | PASS |  |
| WO-DISC-002 | `pnpm typecheck` / `lint` / `build` | PASS | PASS | build includes the mobile `expo export` |
| WO-DISC-002 | `pnpm db:check` / `db:determinism` | 16/16 / PASS | 16/16 / PASS | disposable DB `adulis_gates`, rebuilt from 0001-0055 |
| WO-DISC-002 | mobile, console, api-client, config, locale, tokens tests; mobile typecheck | PASS | PASS |  |
| WO-DISC-002 | `pnpm verify:orphan-sweep` | PASS | PASS | after the full suite |
| WO-DISC-002 | `gates.mjs --only` battery (26 gates) | 26/26 exit 0 | PASS | one at a time |
| WO-004A | `pnpm test` (final stacked branch) | PASS: API 762/762, mobile 135/135, every package | API 762, mobile 101 | fresh disposable DB |
| WO-004A | mobile typecheck / test / build / lint | PASS (135/135) | PASS (101/101) | +34 tests; re-run after the review fixes |
| WO-004A | api-client / locale tests; `verify:mt-keys`; `verify:error-locale` | PASS | PASS | MT-KEYS.md regenerated (840 + 3 HUMAN-REQUIRED) |
| WO-004A | `pnpm typecheck` / `lint` / `build`; `verify:deps` / `contract` / `appendix` / `docs` | PASS | PASS |  |
| WO-004A | `pnpm db:check` / `db:determinism` | 16/16 / PASS | 16/16 / PASS |  |
| WO-004A | API Scene + FYP suites (disc-001, disc-002, fyp unit) | 100/100 | n/a | the backend this branch carries |
| WO-004A | `pnpm verify:orphan-sweep` | PASS | PASS | after the full suite |
| WO-004A | `npx expo-doctor` | 20/20 | n/a |  |
| WO-004A | Maestro on Android emulator + real local API | PASS: buyer-for-you, buyer-auth-request + verify, verify-link, request + leave-verify, buyer-shell | n/a | before the review fixes; those are covered by jest |
| WO-004A | mobile bundle scan for subscription copy | clean (only library identifiers such as `subscribeToStore`) | clean |  |
| WO-SEC-001 | `pnpm --filter @adulis/api test`, run 1 / run 2 | 802/802 / 801/802 (t8-device-bootstrap: OVN-047's t13 ceiling moment, attributed; alone 14/14 x2) | 762/762 at WO-004A | fresh disposable DB; +40 tests |
| WO-SEC-001 | critical auth / T8 / courier / handoff / FYP / `src/common` suites, twice | 213/213, 213/213 | n/a | includes t13, c6, wo-api-001a |
| WO-SEC-001 | `test/wo-sec-001-pool-starvation` (real pool, 14-request bursts) | 19/19; old route code: 14 x 503 on every burst | n/a | before/after recorded in the WO record S14 |
| WO-SEC-001 | T8 `t8-market-from-device` alone, twice | 10/10, 10/10 | 10/10 | known/unknown indistinguishable green throughout |
| WO-SEC-001 | `pnpm test` (all packages) | PASS: API 802/802, mobile 135/135 | API 762, mobile 135 | |
| WO-SEC-001 | `pnpm typecheck` / `lint` / `build`; `verify:contract` / `appendix` / `deps` / `docs` / `render-yaml` / `mt-keys` / `error-locale` | PASS | PASS | no OpenAPI change, no migration |
| WO-SEC-001 | `pnpm db:check` / `db:determinism`; `verify:orphan-sweep` (twice) | 16/16 / PASS; PASS | 16/16 / PASS | |
| WO-SEC-001 | mobile typecheck / test / build; api-client tests | PASS (135/135) | PASS | stacked branch carries WO-004A |
| WO-DISC-002A | `pnpm --filter @adulis/api test` | 806/806 (twice); one earlier slow run after the rebuild 767/806 (5 s hook timeouts in disc-002, e2-e6, t14; all passed in both later runs) | 802/802 at WO-SEC-001 | +4 served-unit contract e2e tests |
| WO-DISC-002A | Scene + For You suites (disc-001, disc-002, fyp unit) | 104/104 | 100/100 at WO-004A | |
| WO-DISC-002A | `@adulis/api-client` test / `generate:check` | PASS / PASS (byte-identical) | PASS | contract: impression_id -> serve_id only |
| WO-DISC-002A | mobile typecheck / test / build / lint | PASS (156/156) | PASS (135/135) | +21: background revalidation, guest -> Account, revalidation rule |
| WO-DISC-002A | `pnpm typecheck` / `lint` / `build`; `verify:contract` / `appendix` / `docs` / `deps` / `mt-keys` / `error-locale` | PASS | PASS | no migration |
| WO-DISC-002A | `pnpm db:check` / `db:determinism`; `verify:orphan-sweep` | 16/16 / PASS; PASS | 16/16 / PASS | |
| WO-DISC-002A | `pnpm test` (all packages); `npx expo-doctor` | PASS: API 806/806, mobile 156/156; 20/20 | | |
| WO-DISC-002A | Maestro, Android emulator, real local API | PASS: buyer-for-you, background return 1/2 (Scene goes PRIVATE, 5 min 30 s away, not reintroduced), auth request + verify (sign-in, restore, sign-out), large text | n/a | final JS cf9ee82 |

## Branch / Commit Register

| Work Order | Branch | Start SHA | End SHA | Commits | Pushed |
|---|---|---|---|---|---|
| WO-DISC-001A | `discovery/wo-disc-001a-db-governance` | `8706a6f` | `1d232ae` (pushed, equal to origin) | `6cfd683` v1.20 reissue; `810b598` c1 date test; docs commit | |
| WO-DISC-002 | `discovery/wo-disc-002-for-you-api` | `1d232ae` | `967cd2d` (pushed, equal to origin) | `741dcc9` migration 0055; `035fbd6` /v1/fyp; `ae8569c` contract; `3e846f6` ADU-DB-01 v1.21; `967cd2d` record + register | yes |
| WO-004A | `mobile/wo-004a-for-you-feed` | `967cd2d` | `ce40823` (pushed) | `330c39b` locale; `24c21bb` mobile feed; docs commit (record + register) | yes |
| WO-SEC-001 | `security/wo-sec-001-rate-limit-pool-hardening` | `ce40823` | see `git log` (the docs commit holding this line) | `6dfaf29` pool acquire bound; `e827980` nested-acquisition fix; `cac3f7a` regression tests and static guard; docs commit (record + register) | yes |
| WO-DISC-002A | `discovery/wo-disc-002a-fyp-contract-closure` | `f80e64e` | see `git log` (the docs commit holding this line) | `4734b52` serve_id; `a4883df` contract; `6cb9601` mobile revalidation; `78aae08` + `cf9ee82` review fixes; docs commit (record, decisions, register, Maestro flows) | yes |

## Deferred Decisions

- Carried: OVN-002, OVN-003, OVN-004, OVN-005, OVN-007, OVN-010, OVN-014, OVN-018.
- This batch, FOUNDER_REVIEW_REQUIRED: OVN-027, OVN-029, OVN-030, OVN-031, OVN-032, OVN-035,
  OVN-048, OVN-055. Deferred with a work order: OVN-025, OVN-026, OVN-028, OVN-033, OVN-034,
  OVN-036, OVN-037, OVN-051.

## Deferred Defects

- OVN-011, OVN-012 (Catalogue).
- OVN-040 (device registration unthrottled), OVN-042 (app guest devices purged while active),
  OVN-047 (T8 flake, re-diagnosed: t13 lowers the platform OTP ceiling), OVN-062 (shared-bucket
  purges in tests), OVN-063 (worker pool bound), OVN-064 (lock waits, Retry-After, transport under
  starvation), OVN-065 (uncounted recent-code compares, Auth). OVN-045 resolved by WO-SEC-001.
- OVN-059 (strip the /v1/fyp query string from edge logs).

## Morning Review Checklist

- [x] Schedule the Auth fix for OVN-045 -- done: WO-SEC-001 (`security/wo-sec-001-rate-limit-pool-hardening`).
- [ ] Decide OVN-030 (production algorithm version) and OVN-032 (retention); confirm OVN-035.
- [ ] Decide OVN-055 (foreground refresh interval for loaded cards) -- the mechanism is built (WO-DISC-002A).
- [ ] Work through `docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md` (nine PENDING decisions).
- [ ] Review `docs/discovery/WO-DISC-001A-DB-GOVERNANCE-SYNC.md`,
      `docs/discovery/WO-DISC-002-FOR-YOU-API.md`, `docs/mobile/WO-004A-BUYER-FOR-YOU-FEED.md`.
- [ ] Run `pnpm db:migrate` on the developer database before using these branches (OVN-053).
- [ ] Decide merge order: the three branches are stacked (001A, then 002, then 004A).
