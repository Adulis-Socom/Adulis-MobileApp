# ADU-API-01 -- Proposed amendment A4: the category list and category filters

**Status: PROPOSED -- awaiting founder approval. Not installed; ADU-API-01 v1.11 governs unchanged.**
Prepared by work order WO-010A (11 November 2026) to record behaviour implemented and tested in
WO-010 (ON-20261111-114). On approval it is folded into the next ADU-API-01 revision (its S12
path strings are generated from `contracts/openapi.json`, which already carries these endpoints).

**Executable contract.** `contracts/openapi.json` and `@adulis/api-client` (generated, never edited by
hand) already describe these shapes; this amendment adds the semantics prose cannot be generated
from. Implementation: `apps/api/src/modules/storefront/storefront.controller.ts` (`categories`,
`shopProducts`), `apps/api/src/modules/search/search.controller.ts`,
`apps/api/src/modules/catalogue/category.ts`, migration 0062 (ADU-DB-01 v1.27 S30j). Tests:
`apps/api/test/wo-010-categories.e2e.spec.ts`, `apps/api/test/c2-catalogue.e2e.spec.ts`.

---

## A4.1 `GET /v1/categories` (S12.1, public group; v1.11 lists it with no description)

**Request.** No parameters. Public: a session is optional. The Market is the server's: the
signed-in Account's Market, else the registered device's (`X-Adulis-Device`), resolved by the same
rule as the Shop and Search (`requesterMarket`). A client never sends a Market identifier.

**Response 200** (`CategoryListDto`):

| Field | Type | Meaning |
|---|---|---|
| `market_resolved` | boolean | `false`: no ACTIVE Market could be resolved (no device, an unregistered one, or a Market not ACTIVE); `data` is then empty because no Market was chosen, not because it has no categories |
| `data[].id` | uuid | Stable category identity |
| `data[].code` | string | Stable machine-readable code (`FASHION`, `COSMETICS`, `ELECTRONICS`); the filter value below |
| `data[].parent_id` | uuid or null | The parent category; null for a top-level category (all launch categories) |
| `data[].label_key` | string | Locale catalogue key of the display label (e.g. `catalogue.category.fashion`); never prose |
| `data[].display_order` | integer | Presentation order among siblings |

**Eligibility.** A category appears only if it is presentable (it has a label key) and enabled in
the requester's Market (`core.category_market_availability.is_available`).

**Ordering.** `display_order ASC, code ASC`.

**Security and caching.** Taxonomy fields only: no Seller data, no Product counts, no ranking or
promotion, no write. No category of another Market is returned. `Cache-Control: no-store` (the
answer depends on the requester's Market).

**Compatibility.** Additive: `id`, `code`, `parent_id` are kept; `label_key`, `display_order` and
`market_resolved` are new. Before WO-010 the endpoint returned every category; no category existed
in any deployed database before migration 0062, so no consumer could have depended on the wider
answer. A caller with no Market context now receives `market_resolved: false` and no rows.

## A4.2 `GET /v1/shop/products?category=CODE` (WO-007 endpoint, extended)

- `category` (optional): a code from A4.1. It must match `^[A-Z][A-Z0-9_]{1,63}$` and name a
  presentable category enabled in the requester's Market; otherwise `400 VALIDATION_FAILED` with
  `slots.path = "category"`. An unknown, unlabelled, disabled or other-Market code reads alike.
- The list is filtered on the server to Products assigned that category, with every existing
  visibility rule unchanged (PUBLISHED, publicly visible Seller, ACTIVE Market, the requester's
  Market) and the same order (`published_at DESC, id DESC`). Out-of-stock Products stay listed with
  `available: false`. Without `category` the response is unchanged and includes uncategorised
  Products.
- Cursors: a category page's `next_cursor` is bound to the requester's Market and the category; a
  cursor used with another category, another Market, or without the category (and an unfiltered
  cursor used with a category) is refused with `400 VALIDATION_FAILED`,
  `slots = { path: "cursor", reason: "CURSOR_INVALID" }`. Unfiltered cursors keep their format.
- With no resolvable Market the response is `{ market_resolved: false, data: [], next_cursor: null }`
  (a well-formed `category` is not checked further; a malformed one is still refused).

## A4.3 `GET /v1/search?type=PRODUCT_POST&category=CODE` (WO-008 endpoint, extended)

- `category` (optional) applies only to `type=PRODUCT_POST`. With `type` TOP (or absent), SELLER or
  SCENE_POST it is refused (`400 VALIDATION_FAILED`, `slots.path = "category"`): Seller and Scene
  results are never reinterpreted as Product categories.
- Validation as A4.2. Product results are narrowed on the server inside the unchanged ranking
  (lexical band, available before unavailable, similarity, id); query validation, the rate limit
  and bounded pagination are unchanged.
- The cursor binding includes the category when one is given: a filtered cursor cannot page an
  unfiltered or differently filtered query, and vice versa (`CURSOR_INVALID`). Unfiltered cursors
  keep their value.

## A4.4 Seller Product create and edit (`category_id`)

A Product's `category_id`, when set on create or changed on edit, must be a presentable category
enabled in the Product's own Market. The database enforces it
(`core.fn_guard_product_category_available`); the API answers `400 VALIDATION_FAILED` with
`slots.path = "category_id"` (an unknown id reads the same). A Product keeps a category later
disabled in its Market, and edits of its other fields still succeed. `category_id` remains
optional; uncategorised Products are valid.

## A4.5 Not covered (not approved)

Subcategories, category-specific attributes, classification of existing Products, Locally Made,
Discounts and New Drops, Search facets beyond `category`, and per-Market enablement of the launch
Market (an operator step: `ops/runbooks/activate-market.md` Step 6, ON-20261111-115).

---

**Approval.** Founder: ____________________  Date: __________  (until signed, PROPOSED).
