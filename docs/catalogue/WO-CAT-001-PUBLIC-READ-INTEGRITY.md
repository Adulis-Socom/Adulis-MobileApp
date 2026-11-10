# WO-CAT-001 -- Public Catalogue Read Integrity and Product Data Contract Closure

Status: complete -- see section 27 for the open governance decisions.

## 1. Starting SHA

`d57736cd6ae62ef7159a8a06c7a0ade1d23a800e` (WO-005 accepted HEAD, `mobile/wo-005-scene-explorer`),
verified clean and equal to origin before branching.

## 2. Branch

`catalogue/wo-cat-001-public-read-integrity`, created from the exact starting commit (not from
`origin/main`).

## 3. Documents reviewed

Immutable 8 Nov pack (`docs/system-designs/2026-11-08/Sources/Markdown/`): ADU-CATINV-01 v3.3,
ADU-MOB-02 v4.3, ADU-STOREFRONT-02 v4.2, ADU-SCN-01 v3.2, ADU-AUTH-02 v3.3, ADU-ANL-01 v3.3,
ADU-PRV-01 v3.3, ADU-DPIA-01 v1.1, ADULIS-KB v3.3, plus ADU-MKT-01 v3.3, ADU-MOD-01 v3.3,
ADU-EVT-01 v3.2, ADU-WEB-02 v4.2 and ADU-CONSOLE-02 v4.3 where the audit reached them.
`docs/ADU-DB-01_Database_and_Data_Model_v1_21_ASCII.md`, `docs/ADU-API-01_API_Contract_v1_11_ASCII.md`,
`docs/ADU-PRD-01_Product_Requirements_v8_5.md` (S20 event list). Work-order records:
`docs/mobile/WO-005-SCENE-EXPLORER.md`, `docs/discovery/WO-DISC-002A-FYP-CONTRACT-CLOSURE.md`,
`docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md`, `docs/overnight/OVERNIGHT-ISSUES-2026-11-10.md`.
No governed document was edited.

## 4. Founder approvals

See `docs/catalogue/WO-CAT-001-FOUNDER-RULINGS.md` (OVN-072, OVN-073, OVN-080, OVN-081; hotspot
deferral to the Seller Console phase).

## 5. Existing Product API audit (Phase 1, before any change)

### 5.1 Public Product reads and their price, availability and Market handling

| Read | Price source | Availability | Market / Seller resolution | Consumers |
|---|---|---|---|---|
| `GET /v1/storefronts/{handle}/products/{slug}` | `variants[].price_minor` (WO-005); `base_price_minor` still returned as a labelled seed | Product `available` = `v_scene_product_availability.available` AND Seller ACTIVE; per-Variant: none (mobile derives `product.available && stock_count > 0`) | `sellerByHandle`: `WHERE handle = ?` in VISIBLE_STATES, first row, no Market filter, no `market.activation_state` check | Mobile ProductDetail; c8 e2e |
| `GET /v1/storefronts/{handle}/products` | **`base_price_minor`** (seed shown as price) | none | same `sellerByHandle` | none in apps (public web storefront not in this repo); c8 e2e |
| `GET /v1/storefronts/{handle}/search` | **`base_price_minor`** | none; no `slug` returned | same `sellerByHandle` | c8 e2e |
| `POST /v1/post-links/resolve` | **`base_price_minor`** | none | no Market filter on the Seller | c8 e2e |
| `GET /v1/scene-posts/{publicRef}` tags | ACTIVE-Variant span `price_min/max_minor`; currency `min(price_currency)` (does not prove one currency) | `v_scene_product_availability.available` (Scene view already requires Seller ACTIVE + Market ACTIVE) | Scene's own Market; requester Market never compared (SCN-01 S405 asks for it) | Mobile SceneExplorer; disc-001 e2e |
| `GET /v1/storefronts/{handle}` | n/a | Seller availability state | same `sellerByHandle` | c8 e2e |
| `GET /v1/fyp` | none (MOB-02 S11: price stays with the Product) | n/a | Account, else registered device; ACTIVE Market only | Mobile feed |

Untyped responses (`Promise<unknown>`, no OpenAPI schema): list, search, post-link resolve,
storefront header, reviews, lookup, both Seller analytics reads.

### 5.2 Sources of truth

- **Price**: `core.product_variant.price_minor bigint CHECK >= 0`, `price_currency core.currency_code`
  (0007:173-174). `core.product.base_price_minor` is "A SEED VALUE, NOT A PRICE ... read by nothing
  else" (0007:138-145; DB-01 C1 :556). CATINV-01 :364: price at the Variant, integer minor units,
  ISO currency, "Current Seller Market determines the allowed currency context".
- **Currency**: `core.market.display_currency` (0002:32). **No constraint ties a Variant's currency
  to its Market or to its sibling Variants** (0007; app inserts the request's `price_currency`,
  catalogue.service.ts:385). `fn_create_order` refuses a cart whose currency differs from the
  Market's display currency ("no fx source", 0028:251-254) and mixed currencies in one cart
  (0028:208-212). So a Variant priced in another currency can never be bought.
- **Variant status**: free text, default `'ACTIVE'`; the app writes `'WITHDRAWN'`
  (catalogue.service.ts:438). Only ACTIVE is purchasable (0028:184-186).
- **Sellable stock**: `stock_count`, derived only from `core.stock_event` (0008:105-126); an order
  writes `-quantity` at creation, so the count is already net of active holds (0028:284-292).
  CATINV-01 :1145 "Sellable Quantity"; :492 zero makes the Variant unavailable; :496 Variant-level
  availability, "not a single optimistic Product flag". No low-stock threshold exists in any
  table; CATINV-01 :488 forbids clients inventing one.
- **Product eligibility**: `visibility` DRAFT/PUBLISHED/UNPUBLISHED; `unpublished_reason` includes
  `MODERATION`. No RESTRICTED/REMOVED projection exists (MOD-01 S336-347 describes one; not built):
  a moderation restriction today is an UNPUBLISHED Product. `fn_publish_product` clears the reason,
  so a Seller can republish a moderation-unpublished Product (0020:108-111) -- pre-existing, not a
  public-read defect, registered.
- **Order gates** (`fn_create_order`, latest 0028:120-297): Seller ACTIVE; Product PUBLISHED; Variant
  ACTIVE; `stock_count >= quantity`; currency = Market display currency; a timing_config in force;
  active payout details; NEW-level cap; buyer cooldown (app call). Market activation is read by
  every Market resolution (DB-01 :3092).
- **Attribute labels**: `core.attribute_definition.label_key text NOT NULL`, `data_type`
  (TEXT/NUMBER/ENUM/BOOLEAN), `unit`; `core.attribute_option.label_key text NOT NULL`
  (0007:69-103) -- locale catalogue keys, "never rendered prose". **No definition, option or
  category is seeded anywhere**, and neither locale catalogue carries an attribute key. The public
  read returns only `ad.code` and `ao.code`.
- **Market**: `UNIQUE (market_id, handle)` (0005:50) -- per Market, case-sensitive. Market
  `activation_state` (0043:71-73). No document defines how an anonymous public request resolves its
  Market (no URL segment, host, header or default; STOREFRONT-02 :126/:157 one `shop.` host with
  `/s/:handle`; :1646 "market/locale context supplied by platform configuration"). MKT-01 :132 "the
  backend resolves authoritative Market context"; SCN-01 :405 "shown only when the resolved
  Buyer/public Market matches the Seller/Post Market". The server already derives a requester
  Market from the database for the For You feed: the Account's Market, else the registered device's
  (`core.device.market_id`, assigned at first bootstrap), ACTIVE Markets only (fyp.service.ts
  subject()). No client-supplied Market header exists (API-01 :453-460).
- **Analytics**: `product_viewed` is a PRD-01 S20 event seeded as version 1 (0016:366-373), SERVER-
  emitted on every Product read (storefront.controller.ts emit) with no deduplication; it is not in
  the 8 Nov ANL-01 registry. The governed deliberate-open event is `product_post_opened` (ANL-01
  :142, CLIENT producer), which is not in `analytics.event_definition` and not in the API-01 :1313
  closed client allow-list of two. ANL-01 :197-205 dedups by `client_event_id` / `server_event_id`;
  `analytics.event` has neither column. DPIA PA-23 (measurement basis) "not approved"; retention
  "LEGAL REVIEW REQUIRED" (PRV-01 :1388; DPIA :448).
- **Seller metrics**: `seller/analytics/full.product_views` = raw `count(*)` of `product_viewed`
  (analytics.controller.ts:161-163), feeding `view_to_reservation_rate`.
  `seller/analytics/overview.products_published` = `published_at IS NOT NULL` (:102-104): ever
  published, while the Console label is "Published products" (en.console.ts:588) and the e2e calls
  it "point-in-time". No governed definition exists.

### 5.3 Defects found (before change)

| # | Defect | Severity |
|---|---|---|
| A1 | List, search and post-link show the creation seed as the price | HIGH (OVN-072 residual) |
| A2 | Scene span takes `min(price_currency)`: mixed currencies would merge into one number range | MEDIUM |
| A3 | No per-Variant availability; Product availability ignores the Market currency gate | MEDIUM (OVN-074) |
| A4 | Seller resolved by handle alone; arbitrary row when two Markets share a handle; no Market activation check | HIGH before a second Market (OVN-077/016) |
| A5 | Scene read ignores the requester Market (SCN-01 S405) | MEDIUM |
| A6 | Every Product read, including revalidations, adds a `product_viewed` | LOW (OVN-073) |
| A7 | `products_published` counts unpublished Products | LOW (OVN-085) |
| A8 | Attribute codes only; label keys exist but are not exposed | LOW (OVN-075) |
| A9 | bigint money converted with `Number()` and no safe-integer check | LOW |
| A10 | List/search/storefront reads carry no cache policy although they will vary by requester | LOW |

## 6. Original pricing defects

- Storefront list, Seller-scoped search and post-link resolution returned `base_price_minor` /
  `base_price_currency` as the Product's price. DB-01 C1: the seed "is copied into a new variant at
  creation and read by nothing else". A Seller who re-priced a Variant kept the old seed on every
  list, search and post-link result (A1, the OVN-072 residual left by WO-005).
- The Scene span (WO-005) took `min(price_currency)` over ACTIVE Variants, so two currencies could
  merge into one numeric range (A2).
- The Product detail had no Product-level span; the Buyer app worked it out from the options.
- All bigint money crossed to JSON through `Number()` with no safe-integer check (A9); list,
  search and post-link returned it as JSON strings.

## 7. Authoritative price projection

One module, `apps/api/src/modules/catalogue/public-projection.ts`, holds the rule; every public
read embeds its SQL fragments (no second price authority, no new table, no migration):

- `publicPrice` (a LATERAL aggregate over the Product's ACTIVE Variants): `price_min_minor`,
  `price_max_minor`, `price_currency`, `any_sellable`.
- Span = min / max of ACTIVE Variant prices, **in stock or not** (founder ruling OVN-072: price and
  stock are separate; an "available-from" price is a separate future decision, not built).
- Currency: the Market's `display_currency` (MKT-01 :334, CATINV-01 :364). The span is computed only
  when **every** ACTIVE Variant is priced in it; otherwise the Product has no current price (null).
  Two currencies never form one range; nothing falls back to the seed. No ACTIVE Variant: null.
- Money: integer minor units; `minorUnits()` refuses (500, loudly) any value a JSON number cannot
  hold exactly. API writes cannot store such a value (zod 4 `.int()` accepts only safe integers,
  verified); only a direct database write could.
- Mobile renders one amount when min = max, else "min - max" (`formatPriceSpan`, unchanged).

## 8. Variant availability model

`variants[].available` on the Product detail (OVN-074) = `productTrades AND variantSellable`:

- `productTrades`: Product `visibility = 'PUBLISHED'`, Seller `status = 'ACTIVE'`, Market
  `activation_state = 'ACTIVE'`.
- `variantSellable`: Variant `status = 'ACTIVE'`, `stock_count > 0` (derived from StockEvents and
  already net of order holds: fn_create_order writes `-quantity` at creation), `price_currency =`
  the Market's currency (fn_create_order refuses any other: "no fx source").
- Product `available` = `productTrades AND any_sellable` -- the same fragments, so a Variant is never
  available while its Product is not. The Product, its span and its options are read in ONE
  statement (one snapshot), so they cannot disagree under READ COMMITTED.
- Inactive (WITHDRAWN) Variants are not listed and never count, whatever their stored stock.
- No low-stock threshold exists in any table, so none is applied (CATINV-01 :488 forbids clients
  inventing one); "Low" labels remain OVN-082.
- Not reflected (still refused at checkout): the cart-level Seller gates of fn_create_order --
  ACTIVE payout details (readiness accepts PENDING), a timing configuration in force, the NEW-level
  order cap. Registered (OVN-086) rather than added: adding them would make Scenes public (their gate
  is v_scene_product_availability, Scene-domain owned) while every tag reads "unavailable".
- A restriction is today an UNPUBLISHED Product (`unpublished_reason = 'MODERATION'`): no MOD-01
  enforcement projection exists. Such a Product is on no public read (tested).

Tested cases (cat-001 e2e): one available Variant; several; all unavailable; unpublished;
moderation-restricted; Seller CLOSING and BILLING_SUSPENDED; inactive Variant with positive stored
stock; active zero-stock Variant; mixed currency; stock change after a read.

## 9. Attribute-label design

- Database: `attribute_definition.label_key` and `attribute_option.label_key` are locale catalogue
  keys, "never rendered prose" (0007). **No definition, option or category is seeded**, no
  translations table exists, and neither locale catalogue carries an attribute key.
- Contract (additive): each attribute keeps `attribute` (code) and `value`, and gains `label_key`,
  `data_type` (TEXT/NUMBER/ENUM/BOOLEAN), `unit` (code) and `value_label_key` (ENUM option key).
  Ordered by code (it had no order).
- Mobile renders an attribute only when the mobile catalogue holds its `label_key` and: ENUM -- the
  option's `value_label_key` too; TEXT -- the Seller's own words, shown as written. NUMBER and
  BOOLEAN are omitted (no governed copy for units or yes/no). A code is never shown. Rows sit under
  a "Product details" heading (new keys `buyer.product.details`, `buyer.product.attribute` with
  named slots).
- Today nothing renders: no attribute key exists. No label, definition or key was invented. The
  taxonomy seed and its catalogue keys are a dependency (OVN-075 stays OPEN for that part).

## 10. Market-resolution architecture

| Surface | Market evidence | Resolution |
|---|---|---|
| Buyer app (guest) | registered device (`X-Adulis-Device` names the row; the row holds the Market, set at first bootstrap) | handle resolved in that Market |
| Buyer app (signed in) | the Account's Market (the app presents the session on Scene and Product reads, as the feed does) | handle resolved in that Market |
| Public web with a session | the Account's Market | same |
| Public web, browser device cookie | the registered browser device's Market | same |
| Anonymous, no registered device | none | the handle resolves only if exactly ONE ACTIVE Market has it; otherwise the neutral 404 |

- `requesterMarket()` (`storefront/requester-market.ts`) reads only the database; a client never
  names a Market (no Market header exists in API-01). Only an ACTIVE Market counts (a device stamped
  in a deactivated Market has no evidence, as for the feed).
- `sellerByHandle()` requires the Seller's Market to be ACTIVE (DB-01 :3092) and returns a Seller
  only when exactly one row matches (`LIMIT 2`): never "the first row".
- Products are reached only through the resolved Seller (`p.seller_id`), so a slug of another
  Market's Seller is the same 404.
- The public Scene read answers 404 to a requester of another Market (SCN-01 S405), so Scene ->
  Product stays in one Market; with no evidence a Scene still resolves (its public_ref is unique).
- Post-link resolution and seller lookup keep to the requester's Market and never return an inactive
  Market's Sellers.
- NOT access control: all of it is public content. Dropping the device header gives the
  no-evidence view. A future Market-restricted rule must not use this helper as its gate.
- No URL changed (OVN-080). The anonymous-web case is the open policy gap: STOREFRONT-02 has one
  `shop.` host with `/s/:handle` and no Market carrier. Minimal compatible proposal, NOT built: the
  public web resolves its Market from its own host/configuration and passes it as validated
  server-side context; or handles become globally unique. That is a cross-surface decision (OVN-016,
  OVN-077, OVN-080) and a release dependency before a second Market opens.

## 11. Storefront Product list correction

`GET /v1/storefronts/{handle}/products`: prices from the projection; `available` added; typed
(`StorefrontProductListDto`); Seller ownership, `visibility = 'PUBLISHED'`, the Seller's display
order, `LIMIT 100` and `image_key` preserved. Unavailable Products stay listed with
`available: false` (not removed). `base_price_*` kept, described as the seed. Market-safe Seller;
`Cache-Control: no-store`.

## 12. Seller-scoped search correction

`GET /v1/storefronts/{handle}/search`: same projection fields, plus `slug` (additive: without it a
result could not be opened). One Seller, `LIMIT 25`, `q` 1-200 characters, PUBLISHED only -- all
preserved. Not Marketplace Search. Typed (`StorefrontSearchResultListDto`).

## 13. Post-link resolution correction

`POST /v1/post-links/resolve`: same projection fields; idempotency, `LIMIT 25`, PUBLISHED and
visible-Seller filters preserved; ordered by Product id (it had no order with a LIMIT); limited to
the requester's Market when known and never an inactive Market. Typed (`PostLinkProductListDto`,
status 200 -- the runtime status; the contract had said 201). No social integration changed.

## 14. Scene pricing regression

The Scene read's tags use the same `publicPrice` / `productAvailable` fragments (replacing the
WO-005 LATERAL with `min(price_currency)`), so a tag and its Product detail agree on span and
availability, including the mixed-currency and all-unavailable cases (tested). The Scene's public
gate (`v_scene_post_public`) still reads `v_scene_product_availability` (Scene-domain owned, not
changed); the two differ only for a Variant priced outside the Market's currency (registered,
OVN-087). The For You feed's tag `available` also still reads that view (`fyp` module, outside this
work order's permitted areas; same registration). No hotspot, no publication or PRIVATE rule change.

## 15. Product-view analytics decision

Founder principle (OVN-073): a deliberate opening and a technical revalidation are different
events. Audit:

- `product_viewed` (PRD-01 S20, seeded v1, SERVER-emitted on every Product read, payload
  `product_id`, no actor) is the only Product-view event in the database and feeds
  `seller/analytics/full.product_views` and `view_to_reservation_rate`. It is not in the 8 Nov
  ANL-01 registry.
- The governed deliberate-open event is ANL-01 `product_post_opened` (CLIENT producer). It is not
  in `analytics.event_definition`, not in the API-01 closed client allow-list of two, and
  `analytics.event` has no `client_event_id` (ANL-01's de-duplication key).
- DPIA-01 PA-23 (measurement basis) is "not approved"; raw-event retention is "LEGAL REVIEW
  REQUIRED"; notice not provided.

Decision implemented (the independent safe part): the Product read takes an optional
`revalidate=true`; such a read records no `product_viewed`. The Buyer app sets it on every read after
the screen's first answer (pull, background return, any re-read) and never on the opening; a screen
opened again is a new opening. The flag can only withhold an event -- a plain GET loop could already
inflate counts -- so trusting it adds no forgery. Nothing new is stored, identified, retained or
profiled.

Prepared, GATED (needs registry entry, contract change and privacy basis): `product_post_opened`
v1, producer CLIENT (Buyer app), emitted once when the Product detail screen first renders a
successful answer; fields `product_id` (server-resolved from handle+slug, never client-trusted),
`client_event_id` (UUIDv7, new per opening, reused on retry), `app_session_id` (existing session
concept); de-duplicated by `(source, client_event_id)` (ANL-01 :197-205); ingested through the
client events endpoint once API-01 widens its allow-list; owner: Analytics. Retention, notice and
the PA-23 basis must be decided first.

## 16. Analytics implementation status

| Behaviour | Status |
|---|---|
| Opening records one `product_viewed` | implemented, tested |
| Pull / background return / re-read records none | implemented (server flag + app), tested both sides |
| Navigating away and back records a new one | implemented (new mount = new opening), tested |
| A 404 (unpublished, other Market, ambiguous) records none | tested |
| Retry after a timeout | may record twice (the first attempt may have reached the server); documented |
| Concurrent duplicate requests | each records (server not de-duplicated); the app de-duplicates in-flight reads; documented, tested |
| Event replay / idempotency | not applicable to a server GET; needs `client_event_id` (gated) |
| Unique visitors / de-duplicated visits | NOT measurable; not claimed |

`product_views` is documented in the contract as "server-recorded Product openings ... NOT
de-duplicated and NOT unique visitors". The Console label is unchanged (Console UI is out of scope);
the handoff asks Seller Console to adopt the definition.

## 17. Seller analytics correction

`seller/analytics/overview.products_published` counted `published_at IS NOT NULL` (ever published:
`fn_unpublish_product` keeps `published_at`). No governed definition exists; the Console label
"Published products" and the e2e's "point-in-time, window-independent" mean currently published. It
now counts `visibility = 'PUBLISHED'`. "Products ever published" is not offered under that label.
Tested: published, unpublished (SELLER), republished, moderation-unpublished, Seller CLOSING (no
effect). Tenant isolation unchanged (`assertRead`, then `seller_id`).

## 18. API contract changes

All additive except as noted (consumers in this repo: only the Buyer app reads these resources).

| Resource | Change |
|---|---|
| Product detail | `price_min_minor`, `price_max_minor`, `price_currency`; `variants[].available`; attribute `label_key`, `data_type`, `unit`, `value_label_key`; optional query `revalidate=true` |
| Storefront list | typed; projection fields + `available`; money as JSON integers (was strings) |
| Seller search | typed; projection fields + `available` + `slug`; money as JSON integers (was strings) |
| Post-link resolve | typed; projection fields + `available`; money as JSON integers (was strings); documented status 200 |
| Scene read | tag fields unchanged in shape; values now from the projection (currency-safe) |
| Seller analytics | definitions in the operation summaries; `products_published` now point-in-time |
| Behaviour | another Market's Seller, an ambiguous handle, an inactive Market, another Market's Scene: the neutral 404; Market-dependent reads `Cache-Control: no-store` |

## 19. Generated-client results

`pnpm generate:openapi` + `pnpm generate:api-client` twice: byte-identical; `generate:check` PASS;
`@adulis/api-client` test PASS. The review fixes changed no contract (verified by regenerating).

## 20. Mobile changes

- `ProductDetail.tsx`: the server's span (not computed from options); each option's server
  `available` (not `product.available && stock_count > 0`); readable attributes only; the opening vs
  revalidation flag.
- `public-read.ts`: `read(revalidation)`; true after the screen's first answer.
- `client.ts`: `product(handle, slug, revalidate)`; Scene and Product reads present the session when
  one is held (one Market with the feed; a dead session ends through the existing path).
- `i18n.ts`: `hasMessage()` for server-named keys. Routes unchanged; no hotspot, Cart or Checkout.
- Tests: 197/197 (+4): server-decided span and options (mixed currency; verified by mutation),
  readable-attribute rules, no details section, opening vs pull flag; bearer expectations updated.

## 21. Cross-surface compatibility

See `docs/catalogue/WO-CAT-001-CROSS-SURFACE-HANDOFF.md`. In short: Seller Storefront must render
prices from `price_min_minor`/`price_max_minor`/`price_currency` and availability from `available`,
never `base_price_minor`; must expect the neutral 404 for ambiguous or other-Market handles and
plan the anonymous Market carrier; Seller Console should adopt the `products_published` and
`product_views` definitions. No Seller Console or Operator Console code was changed.

## 22. Performance

Local stack (API in development mode, disposable database, the native fixtures), 20 sequential
requests after 3 warm-ups, registered-device header; the Product read with `revalidate=true` so no
event rows were written. Statements per request exclude the transaction's own context set-up.

| Read | Statements before -> after | Body | Latency min / median / max |
|---|---|---|---|
| Storefront list | 2 -> 3 (+ requester Market) | 1,446 B | 8.2 / 10.0 / 34.5 ms |
| Seller search | 3 -> 4 | 243 B | 9.0 / 11.8 / 21.4 ms |
| Product detail | 7 -> 6 (5 on a revalidation: no event insert) | 1,142 B | 9.2 / 11.9 / 23.1 ms |
| Scene read | 2 -> 3 | 1,597 B | 8.0 / 9.7 / 72.5 ms (one outlier) |

- Before: WO-005 recorded the Scene read at 11-18 ms and the Product read at 17-41 ms on the same
  machine and stack (different fixtures); the list and search were not measured before, and the old
  build was not re-measured. No before/after claim beyond that is made.
- No N+1: the price and availability of every listed Product is a LATERAL aggregate inside the one
  list statement, served by `idx_variant_by_product (product_id)`; the Product detail reads its
  options inside its own statement. Bounded: list 100, search 25, post-link 25.
- Seller resolution uses `seller_handle_unique_per_market (market_id, handle)` when the Market is
  known; with no evidence it is the handle-only lookup it always was, now `LIMIT 2`.
- Mobile: one request per screen; no per-tag or per-Variant request; no extra request on re-render
  (unchanged query keys).

## 23. Security review

Independent review of the 16 points (WO S40): no Critical, High or Medium. Lows: L1 requester
Market ignored activation -> FIXED (only ACTIVE counts); L2 availability claimed full fn_create_order
parity -> comment narrowed, gap registered (OVN-086); L3 Market evidence is client-chosen -> helper
contract now says never an authorization or commerce input, cart/Variant Market check registered
(OVN-089); L4 runtime changes for external consumers -> handoff release note. Info: Product Market
not FK-tied to its Seller's (OVN-090); Scene gate vs projection (OVN-087).

Independent code review: H1 (latent) the app's public reads used the device's Market while the feed
used the Account's -> FIXED (the app presents the session on Scene/Product reads); M2 an unsafe
money value fails a whole list -> already prevented at write (zod 4 safe integers), loud failure
kept for direct database writes; M3 a span test that could not catch a regression -> FIXED and
mutation-verified; L4 404s without no-store -> FIXED (header set before anything can throw; tested);
L5 Product and options in two statements -> FIXED (one statement); L6 feed tags and the Scene gate
use the old view -> registered (OVN-087); L7 no-evidence dead end -> founder decision with OVN-016;
L8 compatibility -> handoff; L9 timeout double count -> documented.

No new Critical or High finding remains. Code review passing does not close any privacy or legal
approval (OVN-073's PA-23, retention and notice stay open).

## 24. Automated test results

Final code (`75473cc`), freshly rebuilt disposable database `adulis_gates`, one battery run:

| Gate | Result |
|---|---|
| `pnpm --filter @adulis/api test` (run 1 after the rebuild) | 805/843: 38 "Exceeded timeout of 5000 ms for a hook" in `disc-002-fyp` and `wo-api-001a-auth-security` only (files this work order does not touch; the first-run-after-rebuild pattern recorded at WO-DISC-002A). Both suites alone, twice: 64/64, 64/64 |
| `pnpm test` (all packages, run 2) | API 843/843, mobile 197/197, every package PASS |
| Catalogue / Storefront / Scene / Product / Analytics / FYP suites (cat-001, c8, c2, disc-001, disc-002, t6, t26, fyp and catalogue unit) | 245/245 |
| `@adulis/api-client` test / `generate:check` | PASS / PASS (regenerated twice, byte-identical) |
| `@adulis/mobile` typecheck / test / build | PASS / 197/197 / PASS |
| `pnpm typecheck` / `lint` / `build` | PASS |
| `verify:contract` / `appendix` / `docs` / `deps` / `mt-keys` / `error-locale` | PASS |
| `pnpm db:check` / `db:determinism` | 16/16 / PASS (no migration) |
| `verify:orphan-sweep` | PASS |
| `npx expo-doctor` | 20/20 |

New tests: `test/cat-001-public-catalogue.e2e.spec.ts` (30), `products_published` in c8 (1),
`catalogue/public-projection.spec.ts` (2); mobile +4 and updated expectations. API 810 -> 843.
The same battery before the review fixes: API 842/842 first run, all gates PASS.

## 25. Native validation

Android emulator `Adulis_Pixel_8a_API_37` (API 37, x86_64), the debug build (native dependencies
unchanged, so the 9 November APK stayed installed and Metro served this branch's JS), the real local
API (`NODE_ENV=development`) on the DISPOSABLE `adulis_gates` database, local MinIO for media.
**iOS was not validated.**

**Fixture: Seller readiness through the Seller API (first attempt, as WO S44 asks).** A Seller was
created with `POST /v1/seller` (its eligibility evaluation ran inline: SATISFIED), fulfilment set
with `PUT /v1/seller/fulfilment-methods`, payout details set with `POST /v1/seller/payout` after a
verified `PAYOUT_CHANGE` step-up (its SMS code read from the development-only code file, never
printed; the same call with an unverified challenge was refused `403 STEP_UP_REQUIRED`), and the
store profile set with `PATCH /v1/seller/profile`. Exactly two inputs were rows in the disposable
database, because no API provides them: one `core.category` (none is seeded; and the profile
endpoint accepted a category id that names no category -- OVN-088) and the BETA
`billing.subscription` (no API starts it; without it the Product-count limit fails closed). The
account and its console session were rows (sign-in is validated by the auth flows below). Every
Product, Variant, stock level, image and Scene went through the Seller API, and **all four Products
were PUBLISHED by `POST /v1/seller/products/{id}/publish` (fn_publish_product with its real
readiness and limit checks; no fallback)** -- WO-005's database publish (OVN-083) was not needed.
Market B (rows): another Seller with the same handle `fixture-weaves`, Woven basket at 5,000.00.
Stock, price and publication changes during the run went through the Seller API.

API-level checks (curl, same run): device in Market A -> Woven basket span 90000-120000, Large
unavailable, Small available; device in Market B -> 500000 (the other Seller); no device -> `404` with
`Cache-Control: no-store` (ambiguous handle); the Scene for a Market B device -> `404`.

| S42 step | How | Result |
|---|---|---|
| 1-3 Open a Scene, select a tagged Product, open it | `catalogue-product-1.yaml` (For You -> Explore the Scene -> 1. Woven basket -> View Product); also `buyer-scene-explorer.yaml` | PASS |
| 4 Same price range | Explorer "1. Woven basket, ETB 900.00 - ETB 1,200.00" and Product "ETB 900.00 - ETB 1,200.00"; no 1,000.00 seed, no 5,000.00 from Market B | PASS |
| 5 Each Variant's server availability | "Small, ETB 900.00, Available"; "Large, ETB 1,200.00, Currently unavailable" | PASS |
| 6-8 Change stock, refresh, availability updates | Seller API Small -> 0; pull; "Small, ETB 900.00, Currently unavailable" | PASS |
| 9-10 Change a Variant price, see it | Seller API Large -> 125000; pull; span "ETB 900.00 - ETB 1,250.00" and "Large, ETB 1,250.00, Currently unavailable" | PASS |
| 11-12 Unpublish, neutral state | Seller API unpublish; pull; "This Product is no longer available." only | PASS |
| 13-14 Back to the Explorer; current Scene eligibility | Go back -> the Explorer re-reads: Woven basket no longer listed, Clay cup still listed; the server kept the Scene PUBLIC (cup available) | PASS |
| 15 Guest navigation | every step above as a guest | PASS |
| 16 Authenticated navigation | `buyer-auth-request.yaml` + sign-in (development code) + `catalogue-signed-in.yaml`: same span and options, then sign-out | PASS |
| 17 Malformed links | `catalogue-product-link.yaml` (`Bad.Handle`, unknown slug -> neutral message; valid link cold-opens in the device's Market); `buyer-scene-explorer-link.yaml` | PASS |
| 18 Large text | font scale 1.3: `buyer-scene-explorer-dark.yaml` and `catalogue-product-1.yaml` (text wraps, nothing clipped) | PASS |
| 19 Dark mode | `buyer-scene-explorer-dark.yaml` at 1.0 and 1.3 | PASS |
| 20 No Cart, Order or payment request | no cart row; the 5 order and 5 reservation rows are seed rows that predate the fixture, none for its Seller; the app has no cart/order/payment call; flows assert no Add to cart / Buy now | PASS |

Product views (OVN-073), counted in the database during the run: 2 before `catalogue-product-1`
(the curl opening and the WO-005 flow's opening), **3 after it opened the Product, still 3 after
three pulls and the unpublished pull**.

Regression (S43), same session: `buyer-scene-explorer.yaml` (WO-005 main), `-link`, `-private-1/2`
(the tray to 0: Scene PRIVATE, read 404), `-background-1/2` (away 5 min 30 s, 23:38:29 -> 23:43:59,
the Scene went PRIVATE and was not shown), `buyer-shell.yaml` -- all PASS. On the WO-004A
twelve-Scene fixtures (DB rebuilt): `buyer-for-you.yaml`, `buyer-auth-verify-link.yaml` (no SMS
sent), `buyer-auth-request.yaml` + `buyer-auth-leave-verify.yaml` -- all PASS. Two non-product
failures on the way, both re-run green: `buyer-for-you` first ran without its twelve-Scene fixture
(it asserts "(12)"), and once Maestro's instrumentation failed to start after a session restart.

Flows committed in `apps/mobile/.maestro/`: `catalogue-product-1.yaml`,
`catalogue-product-refresh.yaml`, `catalogue-product-back.yaml`, `catalogue-signed-in.yaml`,
`catalogue-product-link.yaml`.

Cleanup: every fixture media prefix removed from MinIO (0 objects left), the disposable database
rebuilt empty, the API and Metro stopped. The developer database `adulis` was never touched.

## 26. Remaining implementation gaps

- Anonymous public Market carrier (web) -- policy gap; ambiguous handles 404 meanwhile (OVN-016/077).
- Attribute taxonomy seed and catalogue keys (OVN-075 dependency).
- `product_post_opened` and de-duplicated visit measurement -- gated (OVN-073).
- Cart-level Seller gates not reflected in `available` (OVN-086).
- Scene gate and feed tags still on `v_scene_product_availability` (OVN-087).
- Variant currency not constrained to the Market at write or in the schema; `seller.category_id`
  not validated or FK-bound (OVN-088).
- Cart line Market not checked against the cart's (OVN-089); Product Market not FK-tied to the
  Seller's (OVN-090).
- Handle case-insensitivity and handle history (STOREFRONT-02 :241/:291) not implemented (OVN-091).
- Detail media derivative (OVN-078) and hotspots (OVN-006) stay deferred.

## 27. Remaining founder/legal decisions

- OVN-080: the final cross-surface public URL scheme, including the anonymous Market carrier.
- OVN-073: implementation of the governed open event; DPIA PA-23, raw-event retention, user notice.
- OVN-086: whether "available" should also reflect the cart-level Seller gates (and how Scenes treat them).
- An "available-from" price, if ever wanted (separate from the approved min-max span).
- The nine WO-DISC-002A decisions remain PENDING (untouched).

## 28. Recommended next work order

A Mobile Product-to-Cart integration is premature until the cart-level gates (OVN-086) and the cart
Market check (OVN-089) are settled. Recommended next: **Buyer Seller Profile (storefront in the app)**
consuming the corrected list/search contracts, preceded by a short governance decision on the public
Market carrier (OVN-016/077/080) so the Seller Profile and the web storefront share one resolution
rule.
