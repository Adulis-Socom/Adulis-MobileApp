# WO-CAT-001 -- Public Catalogue Read Integrity and Product Data Contract Closure

Status: IN PROGRESS -- Phase 1 audit recorded before any contract change.

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

Sections 6-28 are completed as each phase lands.
