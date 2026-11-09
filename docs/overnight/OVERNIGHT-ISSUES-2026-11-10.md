# Adulis Overnight Issues -- 10 November 2026

## Batch baseline

- Starting branch: `discovery/wo-disc-001-scene-foundation`
- Starting SHA: `8706a6fa2353348ba3487234baa1aa2beb153b4b` (verified equal to `origin`, clean tree)
- Started from WO-DISC-001: yes (WO-DISC-001 reported BLOCKED on the ADU-DB-01 Appendix B mismatch, OVN-001)
- Work orders:
  - WO-DISC-001A
  - WO-DISC-002
  - WO-004A

## Morning Summary

### Work-order status
- WO-DISC-001A: COMPLETE (ADU-DB-01 v1.20 installed, `verify:appendix` green, WO-DISC-001 formally closed, API suite 698/698)
- WO-DISC-002: COMPLETE (`GET /v1/fyp` on the RECENT technical baseline; production gated on founder approval, OVN-030; security review fixed, OVN-038 to OVN-044)
- WO-004A: IN PROGRESS

### Highest-priority findings
- (filled in as the batch runs)

### Founder decisions required
- (filled in as the batch runs)

### Security issues
- (filled in as the batch runs)

### Governance/contract blockers
- OVN-001 ADU-DB-01 Appendix B behind the database after migration 0054: RESOLVED by ADU-DB-01 v1.20

### Existing baseline defects encountered
- OVN-020 `c1-onboarding` hard-coded date (2026-09-11), reproduced at `40a4dce`: RESOLVED by a test-only fix

### Recommended first action in the morning
- (filled in at the end)

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
| OVN-027 | WO-DISC-002 | HIGH | PRIVACY | FOUNDER_REVIEW_REQUIRED | Any personalised ranking (CATEGORY_AFFINITY, SELLER_AFFINITY, guest affinity) | Affinity sources unavailable: no engagement events or affinity projection; personalisation is not approved (DPIA-01 R-04/R-05 launch-blocking, acceptance NOT ACCEPTED; MOB-02 S29 guest affinity under the same gate). OPEN_DECISIONS omits this gate | DPIA-01 :227, :1602-1603; MOB-02 :726 | Not implemented; RECENT is non-personalised | Yes: DPIA acceptance | Close DPIA R-04/R-05 before any affinity source |
| OVN-028 | WO-DISC-002 | LOW | IMPLEMENTATION_GAP | DEFERRED | TRENDING source | TRENDING unavailable: no qualified-impression or engagement telemetry; R-13 forbids blending popularity with Trust | REC-01 S19; ANL-01; R-13 | Not implemented; logged | No | After qualified-impression telemetry exists |
| OVN-029 | WO-DISC-002 | MEDIUM | OPEN_DESIGN_DECISION | FOUNDER_REVIEW_REQUIRED | NEW_SELLER, NEW_CONTENT, EXPLORATION sources | No approved exploration share, new-Seller policy or budget (DPIA-01 R-05 fair exposure) | REC-01 S19; DPIA-01 :228 | Not implemented; logged | Yes: exploration policy | Founder sets exploration policy |
| OVN-030 | WO-DISC-002 | HIGH | FOUNDER_DECISION_REQUIRED | FOUNDER_REVIEW_REQUIRED | For You in production | Production serves only an algorithm version with `production_approved = true`; the seeded `technical-baseline-recent-v1` is not approved, so production For You is empty by design | `fyp.service.ts` activeVersion; e2e 'production serves only a founder-approved version' | Gate built and tested | Yes: approve a version (or the baseline) for production | Decide whether RECENT-only may serve the pilot |
| OVN-031 | WO-DISC-002 | LOW | OPEN_DESIGN_DECISION | FOUNDER_REVIEW_REQUIRED | Seller concentration control | Seller-run cap implemented and tested but OFF: no approved threshold (KB names only 'ten consecutive Scenes from one Seller') | ADULIS-KB :377-381; REC-INV-19 | Off in the baseline (`seller_adjacency_max: null`) | Yes: threshold | Set it in a new version row |
| OVN-032 | WO-DISC-002 | HIGH | PRIVACY | FOUNDER_REVIEW_REQUIRED | Production activation of For You | No retention period for For You sessions and impressions and no purge of live ones (DPIA-01 PA-06 'LEGAL REVIEW REQUIRED'). Mitigated tonight: guest rows are deleted with the device (cascade, tested with the real purge job); Account rows are purged at account deletion (`fn_delete_account`, tested) | PRV-01 :190; DPIA-01 :227 | Lifecycle hooks built; retention period not invented | Yes: legal retention period | Add a purge job once the period exists |
| OVN-033 | WO-DISC-002 | LOW | CONTRACT_DRIFT | DEFERRED | Engagement actions on the card | No allowed-actions list in the unit: no engagement action has a backend, and REC-01 S13 (Save, Share, Follow Seller, Not Interested, Report, tag) and R-05 (Like, Save, Share, Reviews, Follow, More, Explore) differ | REC-01 S13; MOB-02 R-05 (C1) | Omitted rather than invented | Yes: reconcile the action list | Reconcile before engagement work |
| OVN-034 | WO-DISC-002 | LOW | IMPLEMENTATION_GAP | DEFERRED | Trust badge on the feed card | The prototype card shows the Seller's public Trust level; no public Trust read exists (WO-DISC-001 public Seller summary is handle + store name) | Prototype ShoppablePostUnit; TRUST-01 :629, :722 | Not shown; not invented | No | Add with a public Trust read |
| OVN-035 | WO-DISC-002 | MEDIUM | PRIVACY | FOUNDER_REVIEW_REQUIRED | None tonight (founder decision applied) | Guest recommendation subject is the registered device (batch decision). ANL-01 asks for a separate first-party `anonymous_id`; AUTH-02 limits device purposes to notification routing, risk and session management; and a known device id lets anyone start sessions as that guest (AUTH-02 S39 'knowing a device id authorises nothing'): it cannot read the guest's sessions, but can burn its limits and write impressions in its name | ANL-01 :171, :277; AUTH-02 :269 (C6) | Followed the batch decision; recorded | Yes: confirm device-as-subject or an anonymous id | Confirm with the DPIA owner |
| OVN-036 | WO-DISC-002 | LOW | CONTRACT_GAP | OPEN | Qualified-impression telemetry | REC-01/KB give every served unit an impression_id; ANL-01 says delivery is not an impression and a re-exposure gets a new id. Who mints the re-exposure id is undefined | REC-01 S12/S55; ANL-01 :324, :331 (C4) | Stores served impressions only | Yes | Resolve before analytics ingestion |
| OVN-038 | WO-DISC-002 | CRITICAL | SECURITY | RESOLVED | (was: any traffic to /v1/fyp) | Session-start rate limit counted on a second app-pool connection while the request transaction held one: about ten concurrent anonymous first-page requests could exhaust the 10-connection pool and hang every endpoint | Security review (WO-DISC-002); `rate-limit.service.ts`, `fyp.service.ts` | `consume` takes the caller transaction; /v1/fyp counts inside its own. e2e: 14 concurrent starts all 200 | No | Done |
| OVN-039 | WO-DISC-002 | HIGH | SECURITY | RESOLVED | (was: bounded guest writes) | Guest writes were not bounded: each letter-case variant of a device id got its own 120/h bucket, and continuations had no limit (up to 500 impression writes per session start) | Security review | Subject id taken from the database row (canonical); new pages limited to 600/h per subject (replays write nothing and are not limited). e2e for both | No | Done |
| OVN-040 | WO-DISC-002 | MEDIUM | SECURITY | OPEN | Bounding guest device creation | Pre-existing: `POST /v1/devices` is anonymous and not rate-limited, and app bootstrap stamps a Market on any registered id, so a script can mint subjects (each with its own For You limits) | `auth.controller.ts` devices route; bootstrap app branch | Recorded (Auth/Device domain, not changed here) | No | Cap app device registration like bootstrap's web mint cap |
| OVN-041 | WO-DISC-002 | MEDIUM | BUG | RESOLVED | (was: page 2 for uppercase device ids) | A device header in upper case (iOS `UUID().uuidString`) could never continue a session: the stored id is lower case, so every cursor was CURSOR_INVALID (failed closed) | Security review | Canonical id from the database; e2e 'a device is one subject however the client cases its id' | No | Done |
| OVN-042 | WO-DISC-002 | MEDIUM | BUG | OPEN | Guest For You (and guest carts) after media_retention | Pre-existing: app guest devices never refresh `last_seen_at` (only web bootstrap, binding and the authenticated PATCH do), so `device.purge_unbound` deletes an active guest's device media_retention after registration; For You then answers 400 X-Adulis-Device and the app registers only once | Security review; `bootstrap.controller.ts` app branch; `e4-retention.ts` | Recorded (Device domain, not changed here) | No | Refresh last_seen_at on app bootstrap, or re-register on 400 |
| OVN-043 | WO-DISC-002 | LOW | BUG | RESOLVED | (was: deleted-account consistency) | A session could be created for an account whose deletion committed between authentication and the session insert | Security review | Subject read requires `status = 'ACTIVE'` and takes `FOR KEY SHARE`, which serialises with `fn_delete_account`'s `FOR UPDATE` | No | Done |
| OVN-044 | WO-DISC-002 | LOW | SECURITY | RESOLVED | (was: owner page latency) | The session row was locked before the subject and secret checks, so anyone holding a `feed_session_id` could hold the owner's lock with garbage cursors | Security review | Verify on a plain read, then lock and re-read served_count | No | Done |
| OVN-045 | WO-DISC-002 (review follow-up) | CRITICAL | SECURITY | OPEN | API availability under a burst; not For You | Pre-existing, the OVN-038 class on routes For You does not own: the rate limiter is counted on a second app-pool connection inside a handler transaction at the ANONYMOUS OTP request and deletion-OTP request, and at the step-up request and one Courier route. About ten concurrent requests can hold every pooled connection while each waits for another (no acquire timeout), hanging the API | `auth.controller.ts` (OTP request, step-up), `deletion.controller.ts` (deletion OTP request), `couriers.controller.ts`; pool `max: 10`, no `connectionTimeoutMillis` | Recorded, NOT changed: moving the count into the transaction makes a request that fails after counting stop counting, which on the OTP paths could create the known/unknown-phone asymmetry the T8 suite guards. `consume` now accepts the transaction, so the change is small once the Auth owner rules on it | No (engineering) | Auth fix work order: count inside the transaction or before it, keep T8 green, and add a pool acquire timeout |
| OVN-037 | WO-DISC-002 | LOW | GOVERNANCE | DEFERRED | First affinity/feature table | REC-01 S45 wants weights/affinity; ADU-DB-01 S19 and check 6 forbid score/rank/weight/affinity columns in feed migrations. Today's configuration is opaque jsonb and check 6 passes on 0055 | check-06; REC-01 S45 | None needed tonight | Yes, when personalisation lands | Governance ruling with the first affinity table |
| OVN-047 | repository | LOW | TEST_FLAKE | OPEN | None | `t8-market-from-device` 'a known and an unknown phone are indistinguishable' draws random 3-digit phone suffixes and never clears the `deletion-otp-request` bucket (3/hour/phone), so a second full API run on the same database within the hour can collide: 429 for one phone only | WO-DISC-002 validation: second API run 761/762; the spec alone right after: 10/10; no deletion or auth code changed on this branch | Recorded | No | Clear `deletion-otp-request` in that suite's cleanup |
| OVN-046 | WO-DISC-002 | LOW | ENVIRONMENT | RESOLVED | None | The staged `git mv` of v1.20 rode into the migration commit (the OVN-024 slip again: a staged rename joins whichever commit comes next) | `git show --stat` of the first, unpushed commit | Reset the four unpushed commits to `1d232ae` and recommitted with the rename in the docs commit; nothing had been pushed | No | Stage renames only with the commit that owns them |
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

## Branch / Commit Register

| Work Order | Branch | Start SHA | End SHA | Commits | Pushed |
|---|---|---|---|---|---|
| WO-DISC-001A | `discovery/wo-disc-001a-db-governance` | `8706a6f` | `1d232ae` (pushed, equal to origin) | `6cfd683` v1.20 reissue; `810b598` c1 date test; docs commit | |

## Deferred Decisions

- OVN-002, OVN-003, OVN-004, OVN-005, OVN-007, OVN-010, OVN-014, OVN-018 (see the register).

## Deferred Defects

- OVN-011, OVN-012 (Catalogue).

## Morning Review Checklist

- (filled in at the end)
