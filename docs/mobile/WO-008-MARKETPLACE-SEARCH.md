# WO-008 -- Marketplace Search

Status: COMPLETE (launch thresholds and Search analytics recorded for the founder; filters, signals, Market switching deferred)

## 1. Starting and final SHAs

- Started from WO-007B's pushed HEAD `3a8c2c681e17b98a0a850159cd3daf7de9898829`
  (`mobile/wo-007b-available-first`); branch `mobile/wo-008-marketplace-search`.
- The final pushed HEAD is the commit that adds this record (`git ls-remote origin
  mobile/wo-008-marketplace-search`); the founder handoff names it.

## 2. Documents reviewed

ADU-SRC-01 v3.2 (S1 canonical decisions, S4 surfaces and the empty query, S6 browse Markets, S7 result
types and Top, S8-S9 Product Post and out-of-stock, S10 Sellers, S11 Scene Posts, S12 eligibility before
ranking, S13 entity ranking, S14 normalisation and languages, S15 typo tolerance, S16 PostgreSQL + pg_trgm
and pagination, S22 API, S23 telemetry and raw-query privacy, S26 security, S34 launch gates), ADU-MOB-02
v4.3 (S33 Search), ADU-SCN-01 v3.2 (the public Scene gate), ADU-CATINV-01 v3.3, ADU-STOREFRONT-02 v4.2,
ADU-AUTH-02, ADU-PRV-01, ADU-DPIA-01, the WO-006/007/007A/007B records and the issue register.

## 3. What was built

| SRC-01 element | Built | Notes |
|---|---|---|
| `GET /v1/search`, PRODUCT_POST + SELLER + SCENE_POST | YES | Typed `{type, payload}` items; Buyer tabs Top / Products / Scenes / Sellers |
| Top: families ranked independently, bands normalised, bounded | YES | Merge by band, then Seller, Product, Scene, then rank; caps 6 Products, 3 Sellers, 3 Scenes |
| Eligibility before ranking | YES | Products PUBLISHED, Seller publicly visible, Market ACTIVE (unavailable kept); Sellers visible; Scenes only through `core.v_scene_post_public` |
| Available before relevant out-of-stock Products | YES | Within a relevance band; an irrelevant available Product never displaces an exact unavailable one |
| No empty-query dump; query bounds | YES | 2-100 characters after NFKC + whitespace normalisation; at least one letter or digit |
| Opaque cursors, bounded pages, no offset | YES | Per type, 1-50 (default 20); bound to query, type and Market |
| Rate limits | YES | 60 a minute per Account or registered device, charged only once a Market is resolved |
| English and Amharic | YES | Unicode-aware matching; Amharic words by prefix (2 letters) or substring/fuzzy (3+) |
| Typo tolerance | YES | pg_trgm word similarity >= 0.5, from 3 characters, ranked below lexical matches |
| Country / Market switching (S6, S10) | NO | No server-approved activated-Market selection contract exists; the Market is the server's (S9 below) |
| Structured filters, category/attribute matching, sort whitelist (S8) | NO | No Buyer category taxonomy yet (ON-20261111-049); description not matched (no index) |
| Secondary ranking signals: Trust, popularity, conversion, freshness, Seller diversity (S13) | NO | No approved formula or signal source; equal relevance falls to a stable id |
| Suggestions, recent/popular queries, synonyms (S14) | NO | None approved; none faked |
| Zero-result recovery | PARTIAL | Honest message with real links to Shop and Home; no corrected-query suggestions |
| Search telemetry and attribution (S23) | NO | Deferred: `search_session_id`, `query_id` and `search_*` events need approved processing |

## 4. API

`GET /v1/search?q=&type=&cursor=&limit=` (public; `no-store`; `apps/api/src/modules/search/`).

- **Market:** `requesterMarket` (the signed-in Account's, else the registered device's; ACTIVE only).
  There is no `country` parameter: SRC-01 S6 allows an explicit switch only within a server-approved
  activated set, and no such selection contract exists, so none is invented. No Market evidence: an empty
  answer with `market_resolved: false`, and nothing written.
- **type:** `TOP` (default; one bounded page, `next_cursor` always null, a cursor refused) or
  `PRODUCT_POST` / `SELLER` / `SCENE_POST` (cursor-paginated).
- **Response:** `{ market_resolved, type, algorithm_version, items[], next_cursor }`. Items are a
  discriminated union: `PRODUCT_POST` carries the Shop's `ShopProductDto` (current Catalogue price span and
  availability, Seller handle and name, card image key -- no stored Search price); `SELLER` carries
  `handle, store_name, trust_level` (the public level only); `SCENE_POST` carries `public_ref`, a
  140-grapheme caption excerpt, the image keys and the Seller. No internal or private field.
- **Errors:** 400 `VALIDATION_FAILED` with `path: q` and reason `QUERY_REQUIRED`, `QUERY_TOO_SHORT`,
  `QUERY_TOO_LONG` or `QUERY_NO_TERMS`; `path: type`; `path: cursor` reason `CURSOR_INVALID`; `limit` out of
  range; 429 `RATE_LIMITED` with `retry_after_seconds`.
- Contract regenerated (byte-identical twice); `@adulis/api-client` regenerated; the item union narrows on
  `type` in the generated types without casts.

## 5. Matching and relevance (algorithm `lexical-trgm-v1`)

Normalisation (S14): NFKC, control characters to spaces, whitespace collapsed, trimmed; case folded in SQL
(`lower`); punctuation kept and literal (LIKE metacharacters escaped with `ESCAPE '\'`); Amharic kept.

| Band | Rule | Applies |
|---|---|---|
| 0 exact | the field equals the query (case-insensitive) | always |
| 1 prefix | the field starts with the query, or a word in it does | always |
| 2 substring | the field contains the query | 3+ characters |
| 3 fuzzy | pg_trgm `query <% field` (word similarity >= 0.5) | 3+ characters |

- **Fields:** Product name; Seller handle (the query without one leading "@") and store name; Scene current
  caption, plus a tagged PUBLISHED Product's name as secondary context (admits the Scene at band 3 only).
- **Order within a family:** band, then (Products) available before unavailable, then trigram similarity
  (scaled 0-1000), then a stable key (Product id, Seller id, Scene public_ref).
- **Top:** each family's first rows, merged by band, then Seller, Product, Scene, then rank. An exact Seller
  handle or name leads; a weak fuzzy match never outranks a lexical one.
- **Provisional technical thresholds** (not product decisions; recorded for the founder, ON-20261111-079):
  minimum 2 characters; substring and fuzzy from 3; word similarity 0.5 (pg_trgm's default 0.6 misses a
  one-letter typo in a short word: "baskte" scores 0.57 against "Woven basket"); Top caps 6/3/3; page 20
  (max 50); 60 searches a minute per Account or device. `algorithm_version` changes with any of them.

## 6. Eligibility, privacy and Market isolation

- Products: `market_id` = the requester's, PUBLISHED with `published_at`, Seller in the publicly visible
  states (ACTIVE, CLOSING, BILLING_SUSPENDED -- the shared `VISIBLE_STATES`), Market ACTIVE; unavailable
  Products stay (S9). Moderation unpublishing is visibility UNPUBLISHED: excluded.
- Sellers: the same Seller and Market gates; public fields and public Trust level only.
- Scenes: only `core.v_scene_post_public` (current PUBLIC published revision with image and caption, ACTIVE
  Seller and Market, at least one available tagged Product). A Scene that goes PRIVATE leaves fresh results
  at once; opening a result re-reads it (the Scene Explorer's own gate).
- A hidden Seller answers like one that never existed (same envelope, nothing about it).
- **No tracking (S23; WO-008 S18):** no query, session, result or position is stored or logged (the API
  logs no request lines); no analytics event; no search history on the device. The only write is the
  existing rate-limit counter, keyed by Account or registered device, never by query text, and not written
  at all when no Market is resolved. Cursors carry a hash binding, not the query.

## 7. Database

Migration `0060_search_caption_index.sql`: `idx_scene_revision_caption_trgm`, GIN `gin_trgm_ops` on
`core.scene_post_revision.caption`. Product names and Seller handles/names already had trigram indexes.
**ADU-DB-01 v1.25** records it (S0.1, S30h; v1.24 to `docs/superseded/`); no table or enum change.

## 8. Mobile

- `src/app/(buyer)/search.tsx` replaces the placeholder: an input (autofocus, clear control, submit,
  keyboard dismissal, accessible label, 100-character cap), 350 ms settle before a query is sent (submit
  sends at once), the tab bar Top | Products | Scenes | Sellers.
- `src/buyer/SearchResults.tsx`: each tab and query is its own `usePublicList` (keyed, so a late answer to an
  older query lands in a list nobody shows; de-duplicated by type and identity); Products use the shared
  `ProductTile` (image, name, Seller link, price span, availability), Scenes a tile with caption and "Scene
  by {store}", Top and Sellers a compact row. Each opens its existing screen; the Search screen stays mounted
  under it, so Back returns to the same query, tab and place.
- States: hint, too short, loading, results, no results (with Go to Shop / Go to Home), offline, error with
  retry, no Market with a retry that re-places the device, end of list.
- Locale: 17 `buyer.search.*` keys (en + machine-translated am placeholders); `buyer.search.coming` removed.

## 9. Performance evidence

Local machine, disposable database, real API (`node dist/main.js`), WO-CAT-001/006/007 fixtures
(two Sellers, 36 Products, two Scenes in the Market). Measured with curl; not a load test.

| Request | Latency (5 runs) |
|---|---|
| `q=basket` TOP (three family statements + rate-limit counter) | 28, 32, 30, 33, 31 ms |
| `q=shop item&type=PRODUCT_POST` (20 of 32 matches) | 21, 18, 17, 17, 14 ms |

- One statement per family per page; Product images for the page's rows in one more statement; no N+1.
- Product names, Seller handles and store names, Scene captions: trigram GIN indexes serve the ILIKE and
  `<%` candidate predicates (the e2e test proves each predicate as written is index-servable with
  sequential scans off). Scene candidates are a UNION so caption and tagged-Product-name matches each use
  their index (independent review finding 2, fixed).
- A two-character query is prefix-only; a query without a letter or digit is refused (trigram indexes
  cannot narrow on symbols). The `publicPrice` LATERAL runs per candidate before the LIMIT (bounded by the
  query-qualified candidate set of one Market).
- Mobile: 350 ms settle, one request per settled query (tested), virtualised FlashList, card/thumb image
  derivatives, lists keyed by query so a stale answer is discarded.
- Not measured: p95/p99 under load, large corpora (no k6 run in this environment).

## 10. Tests

New tests:

- API `test/wo-008-search.e2e.spec.ts` (22, real PostgreSQL; Scenes published through the Seller API):
  matching -- exact Product, exact Seller with and without "@", "@" + handle prefix at the prefix band,
  exact Scene caption and tagged-Product context, prefix, case, English, Amharic (two-letter prefix,
  three-letter substring, caption), typo, literal punctuation, empty / short / oversized / symbol-only
  queries and an unknown type (cases 1-10); eligibility -- unpublished and moderation-unpublished
  Products, an unavailable Product still found, a Scene going PRIVATE on stock loss and back on restock,
  a suspended Seller, an inactive Market, cross-Market isolation both ways, a hidden Seller identical to a
  nonexistent one, public fields only, bounded Top (cases 11-20); pagination -- first/middle/last pages,
  every match once with available first, invalid cursors, a cursor of another query, type and Market,
  publication changes mid-browse (cases 21-28); no write without a Market; the caption and tag predicates
  index-servable; the per-device rate limit (429 with Retry-After).
- API `src/modules/search/search.logic.spec.ts` (6): normalisation, refusals, LIKE escaping, handle
  patterns, cursor binding, Top merge.
- Mobile `src/buyer/search.test.tsx` (10): open from Home and debounce (one request for settled
  typing), tabs with their own cursors and grids, Product / Seller / Scene and Back to the same query and
  tab without a re-read, too-short and clear, no results with real Shop/Home links and no invented
  suggestion, failure and retry, no Market and retry, a slow earlier query never replacing the current
  one, signed-in session, no commerce or analytics request (cases 29-38, 41, 42, 45). Cases 39-40 (Dark,
  enlarged text) natively; 43-44 (Shop, For You) by their existing suites and flows.
- `buyer-shell.test.tsx` updated for the real Search screen.

Final battery (freshly rebuilt disposable database, code at `9ace2ba`):

| Gate | Result |
|---|---|
| `pnpm --filter @adulis/api test` | Default parallelism: 837/940 and, in `pnpm test`, 927/930 -- Jest workers crashed out of memory ("Fatal process out of memory", "Jest worker ran out of memory") on a machine with 2.4 GB free; crashed suites skipped their cleanup and later suites collided with the leftovers (ON-20261111-085). Rebuilt database, `--maxWorkers=2`: **940/940**, then **940/940** again |
| Search / Catalogue / Storefront / Scene / FYP suites (incl. wo-008, wo-007b, wo-007a, wo-007, wo-006, cat-001a, cat-001, disc-001, disc-002, c8, c2, search unit) | 342/342 |
| `@adulis/api-client` test / `generate:check` | PASS / PASS |
| `@adulis/mobile` typecheck / test / build | PASS / 242/242 / PASS |
| `pnpm typecheck` / `lint` / `build` | PASS / PASS / PASS |
| `verify:contract` / `appendix` / `docs` / `deps` / `mt-keys` / `error-locale` | PASS (all six) |
| `db:check` / `db:determinism` | 16/16 / PASS |
| API-client generation (twice, byte-identical) / orphan sweep / Expo Doctor | PASS / PASS / 20/20 |

## 11. Native validation

Android emulator (API 37), debug build, real local API on the disposable database. **iOS was not
tested.** Amharic typing was not exercised natively (adb text input is ASCII-only); the API tests cover
Amharic queries.

| Check | Result |
|---|---|
| API (curl): `basket` -> Woven basket, the "Morning light" Scene; `fixture` -> both fixture Sellers; `@fixture-w` -> fixture-weaves first; `baskte` -> Woven basket; no device -> `market_resolved:false`, empty; `!!` -> 400 | PASS |
| `search.yaml` (Light, 1.0): open from Home, Top for "basket" (no Market B 5,000.00), Products tab (Sold by Fixture Weaves) -> Product -> Back to the same query; Scenes tab -> Scene Explorer -> Back; Sellers for "fixture" -> Seller Profile -> Back; "zzqx" -> No results -> Go to Shop | PASS |
| `search.yaml` Dark at font scale 1.3 | PASS |
| Sign-in (real OTP), then `search-signed-in.yaml` ("clay" -> Clay cup -> Product -> Back) | PASS |
| Regression: `shop.yaml`, `seller-profile.yaml`, `buyer-scene-explorer.yaml`, `catalogue-product-1.yaml` | PASS |
| Regression: `buyer-for-you.yaml` (needs the 12 WO-004A fixture Scenes, which conflict with the catalogue fixtures' Seller handle: run on its own rebuilt database) | PASS with a 360 s scroll budget (assertions unchanged); the committed 120 s budget ran out twice one or two cards from the end on this emulator (ON-20261111-084); API pages 10 + 2 + end |
| No commerce: 0 carts; 5 reservations and 5 orders are seed rows, 3 orders WO-006 fixtures; no rate-limit row for a request without a Market | PASS |

The first `search.yaml` run failed on its last step: Maestro's first keystroke after the clear tap was
dropped ("zqx"); the flow now focuses the field first (ON-20261111-083).

## 12. Security review

Independent code and security review of `022bbfe..0f5b039` (WO-007B and WO-008): **no Critical or
High; no SQL injection, private/other-Market leakage or harmful cursor forgery.** Findings and outcomes:

| Finding | Severity | Outcome |
|---|---|---|
| Rate-limit write before the Market (anonymous bucket row, random-device inserts) | MEDIUM | FIXED (ON-20261111-073) |
| Scene caption index defeated by OR with a correlated EXISTS | MEDIUM | FIXED, UNION (ON-20261111-074) |
| "@handle" queries matched handles only at the fuzzy band | MEDIUM | FIXED (ON-20261111-075) |
| Symbol-only queries scan the trigram index | LOW | FIXED, QUERY_NO_TERMS (ON-20261111-078) |
| WO-007B prices the whole Seller catalogue per page | LOW | Accepted, measured (ON-20261111-071) |
| set_config outside the audited place | LOW | FIXED, helper in request-context.ts (ON-20261111-077) |
| Hard-coded sizes in result rows | LOW | FIXED, theme tokens |
| packages/* commits on app branches | LOW | Recorded (ON-20261111-068) |

Checked and fine (review): every user value a bound parameter; LIKE metacharacters escaped with ESCAPE;
array-valued query parameters refused; eligibility gates per family; Market only from the server;
cursor shapes strict, binding checked before use, TOP refuses cursors; keyset tuples match ORDER BY with
non-null keys; WO-007B semantics match the founder decision; mobile debounce, stale isolation,
de-duplication, Back state, roles, labels, touch targets, locale-only strings; no cross-app imports.
Personal data: none stored; the rate-limit counter holds an Account or device id (existing table, existing
purge).

## 13. Remaining issues and deferred functionality

- **Founder:** launch thresholds (ON-20261111-079); Search analytics processing and retention
  (ON-20261111-080).
- **Deferred by design:** Market switching (ON-20261111-081, needs the activated-Market selection
  contract); filters, categories, description and attribute matching, secondary ranking signals,
  suggestions, synonyms, corrected-query recovery, transliteration (ON-20261111-082); per-IP limits
  (ON-20261111-076).
- **Test maintenance:** the For You flow's scroll budget (ON-20261111-084).
- **Unchanged and still blocked:** payment architecture (deferred by the founder), public Reviews
  (fail-closed), Review moderation (ON-20261111-029).

## 14. Recommended next work order

Buyer Saved Collections (ADU-SRC-01 S18-S22: private Product and Scene saves for a signed-in Buyer,
no purchase semantics), or the Catalogue category taxonomy work order first if Search filters and Shop
categories are the priority. Not started.
