# WO-010 -- Catalogue Category Taxonomy (database and API)

Status: COMPLETE for the approved scope (three top-level categories and category discovery).
Date: 11 November 2026. Branch: `mobile/wo-010-catalogue-categories`, from
`0f909744d38c696eec7f61d659e03f76d84c7494` (WO-009A HEAD, verified equal to origin, clean tree).
Companion records: `WO-010-BUYER-CATEGORY-DISCOVERY.md` (mobile), `../engineering/WO-010-SSD-ENVIRONMENT.md`
(storage), `WO-010-FOUNDER-HANDOFF.md` (summary). Final SHAs are in the founder handoff.

## 1. Authority and decisions

- Founder decision (WO-007A, confirmed in WO-010 S8): the initial top-level commerce categories for
  the Ethiopia launch are Fashion, Cosmetics and Electronics (ON-20261111-049).
- ADU-CATINV-01 v3.3 S40: "Category identity is stable; localized labels are presentation. Category
  changes require migration/versioning discipline." ADU-MOB-02 v4.3 S399: Shop shows Search, then
  Categories (Fashion, Cosmetics, Electronics); S1801: Market configuration determines enabled
  categories. ADU-SRC-01 v3.2 S8: `category` is a Product Post structured filter.
- Not approved and not built: subcategories, attribute definitions, Product classification of
  existing Products, Locally Made / Discounts / New Drops membership, category popularity, paid
  placement. ON-079 (Search launch settings) stays provisional; ON-080 (Search analytics) deferred.

## 2. Database (migration 0062; ADU-DB-01 v1.27)

`db/migrations/0062_catalogue_category_taxonomy.sql`, forward-only (the down migration refuses):

| Change | Detail |
|---|---|
| `core.category.label_key` | text NULL: a locale catalogue key (never prose); NULL means not presentable (never listed, never assignable, never a filter) |
| `core.category.display_order` | int NOT NULL DEFAULT 0: ascending, then `code` |
| Launch taxonomy | FASHION `ca7e0000-0000-4000-8000-000000000001` (10), COSMETICS `...0002` (20), ELECTRONICS `...0003` (30); top-level; label keys `catalogue.category.{fashion,cosmetics,electronics}`; `INSERT ... ON CONFLICT (code) DO NOTHING` |
| Classification guard | `core.fn_guard_product_category_available` + `trg_product_category_available_insert` / `_update`: a non-NULL `category_id` must be a presentable category available in the Product's `market_id`; checked on INSERT and on UPDATE when `category_id` or `market_id` changes. `check_violation`, constraint `product_category_available` |
| Indexes | `idx_category_market_availability_market` (WHERE `is_available`), `idx_product_market_category_published` (`market_id, category_id, published_at DESC, id DESC` WHERE categorised and PUBLISHED) |

No table or enum changes: 125 tables, `core` 99, 71 enum types (db:check 16/16; `verify:appendix`
PASS). The Kysely types gain the two columns (`database.types.generated.ts`, regenerated).

Existing data: no category rows existed in any environment (the dev database had none; the
disposable database only a test fixture). Products with `category_id = NULL` are untouched and
stay in the unfiltered Shop; no Product was categorised by guessing.

## 3. Category availability

Availability is Market configuration, never migration data (Markets are created by the operator):

- `ops/runbooks/activate-market.md` Step 6 enables the three launch categories for one Market by
  its code (idempotent `INSERT ... ON CONFLICT DO UPDATE SET is_available = true`, then a check
  query). **The Addis Ababa launch Market's code is not recorded in the repository**: the founder
  or operator runs Step 6 for it (ON-20261111-115).
- `ops/scripts/seed.mjs` enables the three in its fixture Market (`SEED`) for development.
- Disabling (`is_available = false`) hides a category from `GET /v1/categories`, refuses it as a
  Shop or Search filter and as a new Product category; Products already assigned keep it.

## 4. API changes (contract regenerated: `contracts/openapi.json`, `@adulis/api-client`)

| Endpoint | Change |
|---|---|
| `GET /v1/categories` (existing; ADU-API-01 S12.1 lists it without semantics) | Additive fields `label_key`, `display_order`, `market_resolved` (id, code, parent_id kept). Rows: categories available in the requester's Market (`requesterMarket`) that have a label key, ordered by `display_order, code`; `market_resolved: false` and no rows without a Market. `Cache-Control: no-store`. No counts, ranking or write |
| `GET /v1/shop/products?category=CODE` | Server-side filter (`p.category_id = <id>` added to the existing visibility terms), same order (`published_at DESC, id DESC`). The code must be available in the requester's Market, else `VALIDATION_FAILED` (path `category`). A category page's cursor is `[binding, published_at, id]`, binding = sha256(shop, Market, code); another category, Market or the unfiltered list refuses it (`CURSOR_INVALID`). The unfiltered cursor keeps its shape |
| `GET /v1/search?type=PRODUCT_POST&category=CODE` | Same validation; Product results narrowed server-side inside the unchanged ranking (bands, availability phase, similarity, id); the cursor binding includes the category (only when present). A category with Top, Sellers or Scenes is refused (`VALIDATION_FAILED`, path `category`): Seller and Scene results are never reinterpreted |
| Seller Product create / edit | A category must be a presentable category available in the Product's Market (the database guard); a refusal is `VALIDATION_FAILED` with slots `{ path: 'category_id' }` (translator mapping for `product_category_available`); unknown ids read the same |

A code is `^[A-Z][A-Z0-9_]{1,63}$`; anything else is refused before any read. An unknown,
unlabelled, disabled or other-Market category reads alike.

## 5. Security and data integrity (WO-010 S15)

Independent review of the diff: no Critical or High. One Medium (mobile private screens without a
session, fixed) and five Low (all fixed: placeholder across resources, trigger on a Market change,
unlabelled categories accepted, Search not re-reading categories, a hidden selection); see the
register ON-20261111-119.

| Point | Verdict |
|---|---|
| Cross-Market isolation | Listing joins availability on the requester's Market; Shop and Search keep `p.market_id = requester Market` and resolve the category in that Market; assignment checks the Product's own Market (equal to its Seller's by the 0056 composite FK) |
| Disabled categories | Excluded from the list, refused as filters and as new assignments |
| Invalid references | Malformed, unknown, unlabelled, disabled or other-Market: one governed 400 |
| Seller Product validation | Database-enforced (no API path can bypass it; COPY fires triggers; no definer function writes `category_id`) |
| Publication rules, Scene visibility | Unchanged: the filter only adds an AND to the existing projections; Scenes are not touched |
| Saved state | Unchanged (card Saves work on filtered lists; native and unit tests) |
| Cursor integrity | Category cursors bound to Market and category; unfiltered cursors unchanged; malformed cursors refused by the strict shape check |
| Parameterised queries | Every value bound; `sql.ref` only on constants |
| Index usage / N+1 | The filtered Shop query matches the new partial index; Search keeps its trigram index; no per-item query |
| Price and stock authority | Unchanged (the shared Catalogue projection) |
| Private data | `GET /v1/categories` returns taxonomy fields only |
| Session isolation (ON-112) | See the discovery record S5 |

Known limits: the guard reads availability without a lock (a concurrent disable reads as "disabled
after assignment"); a refused category or cursor rolls back the Search rate-limit charge of that
request (as cursor refusals already did); `core.seller.category_id` (a Seller's store category,
migration 0005) is still a bare uuid with no foreign key or Market check (ON-20261111-116).

## 6. Tests

- `apps/api/test/wo-010-categories.e2e.spec.ts` (12): the taxonomy (ids, codes, label keys, order,
  no subcategory), idempotent initialisation (the migration's own INSERT re-run; a duplicate code
  kept once; uniqueness), the database guard (disabled, unknown, unlabelled, NULL, a Market
  change, a later disable keeps it), `GET /v1/categories` (Market A and B, no Market, no-store),
  Shop (All with uncategorised, each category, out of stock listed, unpublished and non-public
  excluded, empty category, refusals, pagination, cross-category / unfiltered / tampered /
  cross-Market cursors), Search (filtered ranking equals the unfiltered ranking restricted,
  fuzzy match inside a category, filtered pagination and cursor binding, refusals for Top, Sellers,
  Scenes, disabled and unknown categories, Market B isolation).
- `apps/api/test/c2-catalogue.e2e.spec.ts` (+1): Seller Product create and edit through the API
  (refused when not enabled or unknown, accepted when enabled, refused on edit to a disabled one,
  kept after a later disable while unrelated edits pass).
- `apps/api/src/common/errors/errors.spec.ts` (+1): the translator mapping.
- Final battery (freshly rebuilt disposable database; temp on the SSD): API 983/983 (`--maxWorkers=2`)
  and again 983/983 inside `pnpm test` at default parallelism (mobile 291/291 there and alone);
  api-client test and `generate:check`; mobile typecheck and build; `pnpm typecheck`, `lint`,
  `build`; `verify:contract`, `appendix`, `docs`, `deps`, `mt-keys`, `error-locale`; `db:check`
  16/16; `db:determinism`; orphan sweep -- all PASS. Expo Doctor 1.21.6: 19/20 (Expo SDK 58 patch
  releases published after WO-009A; no dependency changed here; ON-20261111-117). Bundle scan:
  framework identifiers only. iOS not tested.
