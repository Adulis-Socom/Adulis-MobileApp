# WO-CAT-001 -- Cross-surface handoff: corrected public Catalogue contracts

For: the Seller Storefront and Seller Console workstreams (and any external web client of the
public API). This lists what changed in the shared public Catalogue reads on branch
`catalogue/wo-cat-001-public-read-integrity` and what each surface must adopt. It is information,
not an instruction to start work: each surface's own work order decides when.

Detail and evidence: `docs/catalogue/WO-CAT-001-PUBLIC-READ-INTEGRITY.md`. Founder rulings:
`docs/catalogue/WO-CAT-001-FOUNDER-RULINGS.md`.

## 1. One price and availability rule for every public Product read

Resources: `GET /v1/storefronts/{handle}/products/{slug}`, `GET /v1/storefronts/{handle}/products`,
`GET /v1/storefronts/{handle}/search`, `POST /v1/post-links/resolve`, and the tags of
`GET /v1/scene-posts/{publicRef}`. Every Product summary now carries:

| Field | Meaning | Use |
|---|---|---|
| `price_min_minor`, `price_max_minor` | lowest / highest price of the ACTIVE Variants (in stock or not), integer minor units | show one amount when equal, else "min - max" (founder ruling OVN-072) |
| `price_currency` | the Market's currency of that span | format with the currency's own fraction digits |
| all three `null` | no current price (no ACTIVE Variant, or not all priced in the Market currency) | show no price; never fall back |
| `available` | PUBLISHED, Seller and Market ACTIVE, and an ACTIVE Variant in stock priced in the Market currency, read now | "Currently unavailable" in words when false; no purchase action |
| `base_price_minor`, `base_price_currency` | the creation SEED (DB-01 C1) | **never display as a price**; kept for compatibility only |

The Product detail adds `variants[].available` (the server's per-option answer; never true while the
Product is not) -- render it, do not derive availability from `stock_count`.

Unavailable Products stay in the Storefront list (do not filter them out client-side).

## 2. Market-safe Seller resolution (behaviour change)

A Seller handle is unique per Market only. Public reads now resolve a handle inside the requester's
Market, which the server derives from the signed-in Account, else the registered device (app header
or browser device cookie). With no Market evidence the handle resolves only when one ACTIVE Market
has it. These now answer the same neutral `404 NOT_FOUND` (founder ruling OVN-081 -- show only
"... is no longer available."):

- a handle that exists in two ACTIVE Markets, requested with no Market evidence;
- another Market's Seller, or a Product slug of another Market's Seller;
- a Seller in a Market that is not ACTIVE;
- a Scene of another Market (`/v1/scene-posts/{ref}`).

Seller Storefront (web) must plan its Market carrier before a second Market opens: STOREFRONT-02 has
one `shop.` host and `/s/:handle`, which carries no Market. The options (host/configuration-derived
Market passed as validated server context, or globally unique handles) are a founder decision
recorded with OVN-016 / OVN-077 / OVN-080 (the provisional mobile routes are approved; the final
cross-surface URL scheme is a release dependency).

Market evidence is not authorization: never use it to gate commerce or restricted content.

## 3. Cache policy

The storefront header, list, Product detail, search, reviews and seller lookup answer with
`Cache-Control: no-store` (their answer depends on the requester and on live stock), including
their 404s. A CDN or service worker must not cache them.

## 4. Attributes

Each Product attribute now carries `label_key` (attribute name, a locale catalogue key),
`data_type`, `unit` (a code) and `value_label_key` (ENUM option key), beside the existing codes
`attribute` and `value`. Render an attribute only when your catalogue resolves the keys it needs;
never render a code. No attribute definition, option or catalogue key exists yet (taxonomy seed is
a dependency, OVN-075).

## 5. Seller Console: analytics definitions

- `GET /v1/seller/analytics/overview` `products_published` = Products **published now**
  (`visibility = 'PUBLISHED'`; unpublished ones are no longer counted). The "Published products"
  label fits; do not present it as "ever published".
- `GET /v1/seller/analytics/full` `product_views` = server-recorded Product **openings**: the Buyer
  app's refreshes are no longer counted (founder principle OVN-073). It is **not** de-duplicated and
  **not** unique visitors; do not label it so. `view_to_reservation_rate` inherits that meaning.
- A web client that re-reads a Product already on screen should send `revalidate=true` on that read.

## 6. Release note for external consumers (runtime changes)

- List, search and post-link money fields are JSON integers (they were JSON strings).
- Search results gain `slug`.
- `products_published` changed meaning (now point-in-time).
- New neutral 404 cases (section 2).
- Post-link resolve is documented as 200 (its runtime status all along).

## 7. Not changed

No Seller Console or Operator Console code; no Seller write path; no migration; no Scene publication
or PRIVATE-restoration rule; no Recommendation behaviour; production For You stays disabled; no
hotspot (deferred to the Seller Console phase).
