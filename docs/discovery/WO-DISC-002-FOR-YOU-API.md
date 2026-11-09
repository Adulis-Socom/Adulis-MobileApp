# WO-DISC-002 - For You / Discovery API (`GET /v1/fyp`)

Status: complete, pushed, awaiting founder review. Branch `discovery/wo-disc-002-for-you-api`, from
`1d232aeb9df281fdf2674ed905418bde156bb079` (the WO-DISC-001A head). No pull request, no merge, `main`
untouched. Part of the overnight batch of 10 November 2026; the morning register is
`docs/overnight/OVERNIGHT-ISSUES-2026-11-10.md` (OVN-025 onward are this work order's).

## 1. What exists now

`GET /v1/fyp` serves the Buyer Home **For You** channel: **Scene units only** (`type: SCENE_POST`),
read from the one public gate WO-DISC-001 built (`core.v_scene_post_public`). Nothing else can
appear in the response: no Product Post, Story, advertisement or placeholder unit.

| Concern | Behaviour |
|---|---|
| Subject (REC-01 S11, S86) | Server-derived. A bearer (or Console cookie) is the Account; otherwise the registered device (`X-Adulis-Device` for apps, the httpOnly device cookie for browsers, as `requestingDevice()` already decides). No request field names a subject, a target or a Market. A guest without a registered device is `400 VALIDATION_FAILED` `{path: X-Adulis-Device}` |
| Market (REC-01 S17, MKT-01) | The Account's Market, or the device's bootstrap Market, and only while that Market is ACTIVE. No Market, or an inactive one: `200` with every field null and no session row |
| Eligibility (REC-01 S25-S29, S54) | Candidates come from the public gate filtered by Market; **the gate is re-read for the exact page at response time** and a unit that failed it since candidate selection is dropped before any impression is written. Sessions store no eligibility |
| Feed session (S52, S71) | Created on the first page that has something to serve: subject, Market, algorithm version, seed, cursor-secret hash, expiry, served count. An empty Market writes nothing |
| Cursor (S53) | `next_cursor` is opaque to clients. It carries the session, the count already delivered and a 256-bit secret whose SHA-256 alone is stored (constant-time compare). Every use re-checks subject, Market, expiry and version. Bad, forged, foreign or out-of-range: `400 VALIDATION_FAILED`, `slots.reason CURSOR_INVALID`. Expired, version retired or no longer allowed to serve, Market changed: `slots.reason CURSOR_EXPIRED` (start a new session) |
| No duplicates (S52) | One Scene once per session: the candidate query excludes served Scenes and the database enforces `UNIQUE (session_id, scene_post_id)` |
| Retried pages | A cursor for an already-served offset replays that page's exact impressions (same `impression_id`s), re-checked against the gate; a Scene no longer public, or no longer on the served revision, is dropped |
| Served impressions (S55, S72) | One `core.fyp_impression` per delivered unit: session, exact revision, algorithm version, position, candidate source, time. **Served, not qualified** (S35, ANL-01: delivery is not an impression); qualified-impression telemetry is client work and not built |
| Page size | `limit` clamps to the version's `max_limit` (24, the ADULIS-KB example); default 10. Session `max_items` 500; the RECENT candidate budget 60 per page |
| Concurrency | After the cursor is verified (plain read), the session row is locked `FOR UPDATE`, so two page requests cannot claim one position or one Scene. A signed-in subject's Account row is read `FOR KEY SHARE`, so an account deletion and a page request serialise |
| Abuse bound | Per subject, counted inside the request transaction with the existing limiter (`core.rate_limit_bucket`): 120 session starts and 600 newly served pages per hour; a replayed page writes nothing and is not counted. The guest subject is the device id as the database spells it |
| Caching | `Cache-Control: no-store` (Scene data is decided per delivery, as on the public detail) |
| Production | Serves only an algorithm version with `production_approved = true`. The seeded technical baseline is **not** approved, so production For You answers empty until the founder approves a version (OVN-030) |

### The unit

`type`, `impression_id`, `position`, `candidate_source`, `public_ref`, `revision_version`,
`published_at`, `caption` (whole, or a 300-grapheme excerpt with `caption_truncated`), `image`
(`thumb_key`, `card_key` only: no full-resolution key in a feed card, MEDIA-01), `seller` (`handle`,
`store_name`), `products` (public tag summaries: `position`, `slug`, `name`, `available`).

Deliberately absent: internal Scene, revision and Seller ids (the server resolves them from the
impression); price and stock (MOB-02: "current product price/stock must not be duplicated"; the
prototype keeps prices with the Products); hotspot geometry (R-06); engagement counts; an
allowed-actions list (no engagement action has a backend, and REC-01 S13 and R-05 list different
actions, OVN-033); Trust level (no public Trust read exists yet, OVN-034).

## 2. Candidate-source audit (REC-01 S19)

Only sources backed by real data were implemented. Each other source is logged, not simulated.

| Source | Status | Why |
|---|---|---|
| RECENT | **Implemented** | Public Scenes in the subject's Market, newest publication first |
| ONBOARDING_INTEREST | Unavailable (OVN-025) | No interest capture: `core.buyer_profile` holds no interests and no onboarding-interest contract exists |
| FOLLOWING | Unavailable (OVN-026) | `core.follow` has no writer and no Follow endpoint/event contract (DSC-3; design gap C9) |
| CATEGORY_AFFINITY, SELLER_AFFINITY | Unavailable (OVN-027) | No engagement events or affinity projection; personalisation is not approved (DPIA-01 R-04, launch-blocking) |
| TRENDING | Unavailable (OVN-028) | No qualified-impression or engagement telemetry; R-13 forbids blending popularity with Trust |
| NEW_SELLER, NEW_CONTENT, EXPLORATION | Unavailable (OVN-029) | No approved exploration share or new-Seller policy (DPIA-01 R-05) |

The impression table's source CHECK lists all nine REC-01 names so a later source needs no schema
change; the configuration schema accepts only `RECENT`, so no version can configure an unexecutable
source (it fails closed instead).

## 3. Algorithm versions and determinism (S45-S47, S75)

- `core.fyp_algorithm_version` rows are immutable (trigger: no DELETE, no change to id, schema
  version, configuration or creation time); at most one is ACTIVE; only `status`,
  `activated_at` and `production_approved` can move, and only by a migration-role write.
- The seeded `technical-baseline-recent-v1`: RECENT budget 60, page 10 / 24, session TTL 3600 s and
  500 items, `SEEDED_HASH` tie-break, Seller-run cap **off** (`seller_adjacency_max: null`). Every
  number is a technical bound, not a product rule. `production_approved = false`.
- The API validates the configuration strictly (zod) before serving; a malformed one serves nothing
  and logs `FYP_CONFIG_INVALID` (fail closed, not a guess).
- Ranking is pure and deterministic: published time descending, then SHA-256(session seed, Scene
  id), then id. The Seller-run cap (REC-INV-19, ADULIS-KB "ten consecutive Scenes from one Seller")
  is implemented and tested, carries across pages, reorders without withholding content, and stays
  off until a threshold is approved (OVN-031).
- Retiring a version ends its sessions at their next page (`CURSOR_EXPIRED`): the kill switch
  ADU-OBS-01 names.

## 4. Schema: migration `0055_fyp_sessions_impressions.sql`

Three tables (`core.fyp_algorithm_version`, `core.fyp_session`, `core.fyp_impression`), the
version guard trigger, grants, and one patched function. No affinity, trending, projection or
experiment table.

- `adulis_app`: SELECT on versions; SELECT, INSERT on sessions plus UPDATE of `served_count` and
  `last_served_at` only; SELECT, INSERT on impressions. It cannot rewrite or delete any of them.
- **Lifecycle.** A guest session goes with its device (`ON DELETE CASCADE`), so the existing
  `device.purge_unbound` job is never pinned by a For You row (the 23503 trap e4-retention records)
  and a guest's served history is deleted with the device. An Account's sessions go at account
  deletion: `core.fn_delete_account` gained one statement, by the D-62 method (extracted with
  `pg_get_functiondef`, patched at one site, owner and grants re-asserted). No retention period is
  set for live sessions: DPIA-01 PA-06 leaves it to legal review (OVN-032).
- Check 14 pins the three tables by name. Check 6 scans `0055` (the `FOLLOWING` source name puts it
  in scope) and finds no score, rank, weight or affinity column.
- **ADU-DB-01 v1.21** (pre-authorised by the batch) folds them into Appendix B: **123 tables,
  `core` 97, 71 enum types**, new S30d; v1.20 moved to `docs/superseded/`; current-document
  references re-anchored. `verify:appendix` green, `ops/scripts/verify-appendix.mjs` unchanged.

## 5. Contract

`contracts/openapi.json` and `packages/api-client/src/schema.d.ts` are regenerated (two
consecutive regenerations byte-identical). `operations["FypController_feed"]` types the query
(`cursor`, `limit`), the `X-Adulis-Device` header and the `200` body (`FypPageDto`,
`ScenePostFeedUnitDto`, `FypImageDto`, `FypUnitProductDto`); errors are the shared problem
envelope. No new error code, status or permission: the closed taxonomy is untouched
(`VALIDATION_FAILED` with a typed `slots.reason`, `RATE_LIMITED`).

## 6. Security review

An independent read-only review (separate agent, given the code and the requirements, not this
record) reported nine items. Every defect in this work order's code is fixed and has a test; three
pre-existing issues in other domains are recorded, not changed here.

| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | CRITICAL | The session-start rate limit counted on a second app-pool connection inside the request transaction: about ten concurrent anonymous first pages could exhaust the 10-connection pool and hang the whole API | **Fixed** (OVN-038): `RateLimitService.consume` takes the caller's transaction; /v1/fyp counts inside its own. Test: 14 concurrent starts on one device all answer 200 |
| 2 | HIGH | Guest writes not bounded: letter-case variants of a device id each had a bucket; continuations unlimited; `POST /v1/devices` unthrottled | **Fixed** for /v1/fyp (OVN-039): canonical subject id from the database row; newly served pages limited per subject (600/h), replays exempt because they write nothing. Device registration throttling is pre-existing Auth scope: OVN-040 |
| 3 | MEDIUM | An upper-case device header (iOS default) could never continue (failed closed) | **Fixed** (OVN-041), with a test |
| 4 | MEDIUM | Live sessions and impressions are never purged | **Founder/legal** (OVN-032): no period may be invented; lifecycle hooks (device cascade, account deletion) are built |
| 5 | LOW | App guest devices never refresh `last_seen_at`, so the device purge removes an active guest | **Pre-existing**, Device scope: OVN-042 |
| 6 | LOW | A known device id lets anyone start sessions as that guest (cannot read its sessions) | Inherent to the device-as-subject decision: folded into OVN-035 for the founder |
| 7 | LOW | A session could be written for an account whose deletion committed mid-request | **Fixed** (OVN-043): subject read requires ACTIVE and takes `FOR KEY SHARE`, serialising with `fn_delete_account` |
| 8 | LOW | The session lock was taken before the subject and secret checks | **Fixed** (OVN-044): verify on a plain read, then lock and re-read |
| 9 | INFO | Tag availability is read one statement after the gate; a misleading code comment; the impression-to-revision FK has no ON DELETE | DTO wording corrected ("read at response time"); comment corrected; the FK is harmless while no path hard-deletes revisions and is noted here |

The same review found the step-up OTP limiter has the defect class of item 1 (pre-existing, Auth):
OVN-045, now a one-argument fix.

Checked and found sound by the reviewer: every query parameterised (arrays via
`sql.val(...)::uuid[]`); no client-named subject, target or Market; 256-bit cursor secret, hash-only
storage, constant-time compare, anchored cursor grammar, one answer for unknown/foreign/forged
cursors; offset bound; expiry, version, production approval and Market re-checked on every use;
Scene-only, gate-read units with exact-revision binding; no internal ids, price, stock or full
key; grants and the version trigger as intended; FK cascades run as the table owner, so
`adulis_jobs` needs no new grant.

## 7. Performance evidence

`EXPLAIN (ANALYZE, BUFFERS)` on the disposable database with **22,000 public Scenes** (20,000 in one
Market across 200 Sellers, 2,000 in another) and a session that had already served 480 units,
inside one transaction that was rolled back.

| Query | Plan | Execution |
|---|---|---|
| Candidates, new session (budget 60) | `idx_scene_post_market_public` (market, state, visibility, published_at DESC) scanned in order, stops at 61 rows; served-check via index | 0.77 ms |
| Candidates, 480 already served | same index, 541 rows read to find 60 unserved | 1.27 ms |
| Response-time gate for a 24-unit page | `scene_post` by id (bitmap), revision by PK, tag and availability by index | 3.3 ms (of which ~1.4 ms is the harness drawing random ids) |
| Tag summaries for 24 revisions | `scene_post_product_position` (bitmap on revision_id) | 3.2 ms (same harness cost) |
| Replay window of a served page | `fyp_impression_position_once` (session, position) | 0.02 ms |

Every predicate is index-backed; nothing scans Scenes. One known growth factor: the served-check
cost grows with the session's served count, bounded by `max_items` (500). ADU-OBS-01's provisional
objective is p95 < 700 ms for For You.

## 8. Tests

| Suite | Count | Covers |
|---|---|---|
| `apps/api/src/modules/fyp/fyp.logic.spec.ts` | 31 | strict configuration (unexecutable source, unknown key, bad bounds fail closed); page clamping; deterministic ranking independent of input order, seeds only break ties; Seller-run cap incl. carry-over and never withholding; grapheme-safe excerpt (Ge'ez, ZWJ emoji); cursor round-trip, constant-time secret check, malformed cursors refused |
| `apps/api/test/disc-002-fyp.e2e.spec.ts` | 33 | guest without/with unregistered device; no Market; empty Market writes nothing; Market isolation both ways; signed-in subject is the Account; Scene-only shape with no internal ids, price or full-resolution key; newest-first; caption excerpt; impressions bound to session, exact revision, version, position, source; pagination with no duplicates and a null end cursor; retried page replays exact impressions; a Scene going PRIVATE between pages is neither served nor replayed and returns after restoration; tampered, unknown-session, beyond-offset and foreign-subject cursors (`CURSOR_INVALID`); expiry and Market change (`CURSOR_EXPIRED`); version kill switch; `max_items`; Seller-run cap across pages; malformed config fails closed; production serves only an approved version; version immutability; `adulis_app` cannot rewrite; duplicate Scene refused by the database; `device.purge_unbound` run as `adulis_jobs` removes a stale guest device with its sessions and impressions; account deletion through `fn_delete_account` purges the Account's sessions; session-start and page rate limits (replays exempt); 14 concurrent session starts all complete (pool starvation regression); an upper-case device id is the same subject; a Scene revised since serving is neither replayed on its old revision nor served again, and a new session serves the new revision |

Scenes are created the production way (Seller API: create, image, publish) and availability moves
through `core.stock_event`.

## 9. Validation

On a disposable database (`adulis_gates`) rebuilt from nothing (0001-0055, seed, worker schema):

| Check | Result |
|---|---|
| `pnpm test` (every package) | pass: API **762 of 762** (48 suites: 698 before this work order, plus 31 unit and 33 e2e), mobile 101 of 101, every package |
| `pnpm --filter @adulis/api test`, second run on the same database | 761 of 762: `t8-market-from-device` collided on its random phone suffixes with the first run's uncleared deletion-OTP bucket (OVN-047); that spec alone right after: 10 of 10. No auth or deletion code changed here |
| `pnpm verify:contract`, `api-client generate:check` | pass; regeneration byte-identical twice |
| `pnpm verify:appendix` | pass (v1.21: 123 tables, `core` 97, 71 enum types) |
| `pnpm verify:docs`, `pnpm verify:deps` | pass |
| `pnpm typecheck`, `pnpm lint`, `pnpm build` (includes the mobile `expo export`) | pass |
| `pnpm db:check` | 16 of 16 |
| `pnpm db:determinism` | pass |
| mobile, console, api-client, config, locale, tokens tests; mobile typecheck | pass |
| `pnpm verify:orphan-sweep` (after the full suite) | pass |
| `ops/scripts/gates.mjs --only`, 26 gates one at a time (incl. console-e2e, production-react, mt-keys, surface-markers) | 26 of 26 |

## 10. Decisions taken and conflicts surfaced

No founder decision was invented. Where the documents conflict or are silent, the work took the
narrowest safe reading and logged it:

- **Guest subject = registered device** is the batch's explicit decision. ANL-01 asks for a separate
  first-party `anonymous_id` and AUTH-02 limits device purposes (design gap C6): OVN-035,
  FOUNDER_REVIEW_REQUIRED.
- **Served vs qualified impression**: REC-01/KB say every served unit gets an `impression_id`; ANL-01
  says delivery is not an impression and a re-exposure gets a new id (gap C4). The table records
  served units; who mints a re-exposure id is open: OVN-036.
- **Production activation** of any For You version: OVN-030 (FOUNDER_REVIEW_REQUIRED).
- **Retention** of sessions and impressions: OVN-032 (legal review; DPIA-01 PA-06).
- **Seller-run threshold**: OVN-031. **Allowed actions**: OVN-033. **Trust on the card**: OVN-034.
- **Future affinity storage versus check 6**: REC-01 S45 wants weights; ADU-DB-01 S19 / check 6
  forbid score, rank, weight and affinity columns in feed migrations. Today's configuration is
  opaque jsonb; the first affinity table will need a governance ruling: OVN-037.

## 11. Not built (out of scope)

Qualified-impression and dwell telemetry, `POST /v1/analytics/events` handling for For You, any
engagement action (Like, Save, Share, Follow, Not Interested, Hide, Report), Following, Nearby,
Discounts, Locally Made, Stories, Search, Scene Explore, any worker or projection, any affinity or
trending feature, experiments, a session retention purge.

## 12. Commits

| Commit | Content |
|---|---|
| `741dcc9` feat(db): 0055 For You algorithm versions, feed sessions and served impressions | migration, check 14 pins, Kysely types |
| `035fbd6` feat(api): GET /v1/fyp For You feed on the RECENT technical baseline | module, rate-limiter transaction parameter, unit and e2e tests |
| `ae8569c` chore(contract): regenerate OpenAPI and @adulis/api-client for GET /v1/fyp | generated contract and client |
| `3e846f6` docs(db): install ADU-DB-01 v1.21, Appendix B synchronised with migration 0055 | v1.21, v1.20 superseded, references |
| docs(discovery): record WO-DISC-002 | this record and the overnight register |

**WO-DISC-002 COMPLETE -- READY FOR WO-004A (BUYER FOR YOU FEED INTEGRATION)**, with production
For You gated on the founder's approval of an algorithm version (OVN-030) and retention on legal
review (OVN-032).
