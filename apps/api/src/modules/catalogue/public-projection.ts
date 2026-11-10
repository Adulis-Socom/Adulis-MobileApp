import { sql } from 'kysely';
import { AdulisException } from '../../common/errors/adulis-exception';

/**
 * THE PUBLIC CATALOGUE PROJECTION (WO-CAT-001). The one place a public read takes a Product's
 * current price and sellability from: Product detail, Storefront list, Seller-scoped search,
 * post-link resolution and Scene tags all embed these fragments, so they cannot drift apart.
 * It reads canonical columns and stores nothing; it is not a second price authority.
 *
 * A query embedding them must name the Product `p` (core.product), its Seller `s`
 * (core.seller) and the Product's own Market `m` (core.market).
 *
 * PRICE lives on the Variant (CATINV-01 :364; DB-01 C1: `base_price_minor` is a creation seed,
 * never a price). The span is the lowest and highest price among ACTIVE Variants, in stock or
 * not (founder ruling OVN-072: price and stock are reported separately). Money stays integer
 * minor units in the Market's currency. A Product whose ACTIVE Variants are not ALL priced in
 * the Market's currency has no current price (null): the schema does not stop a Variant being
 * priced in another currency, fn_create_order refuses such a cart ("no fx source"), and two
 * currencies never merge into one number range. No ACTIVE Variant is also null -- never the seed.
 *
 * SELLABLE is fn_create_order's per-line purchasability (the rule the Scene domain's
 * v_scene_product_availability already uses) plus the Seller and Market gates a Buyer can see:
 * the Product PUBLISHED, its Seller ACTIVE, its Market ACTIVE (DB-01 :3092), the Variant
 * ACTIVE, in stock (`stock_count` is derived from StockEvents and already net of orders' holds)
 * and priced in the Market's currency. No low-stock threshold exists, so none is applied
 * (CATINV-01 :488). A restriction is today an UNPUBLISHED Product (no MOD-01 enforcement
 * projection exists). NOT reflected, and still refused at checkout: the Seller-level order
 * gates fn_create_order applies to a whole cart (ACTIVE payout details, a timing configuration
 * in force, the NEW-level order cap) -- registered for a Catalogue/Checkout decision.
 */

/** The Product may trade now: published, its Seller ACTIVE, its Market ACTIVE. */
export const productTrades = sql<boolean>`(p.visibility = 'PUBLISHED' AND s.status = 'ACTIVE' AND m.activation_state = 'ACTIVE')`;

/** A Variant `v` of that Product can be bought now, the Product gate aside. */
export const variantSellable = sql<boolean>`(v.status = 'ACTIVE' AND v.stock_count > 0 AND v.price_currency = m.display_currency)`;

/**
 * `CROSS JOIN ${publicPrice}` adds `pp.price_min_minor`, `pp.price_max_minor` (bigint, as text),
 * `pp.price_currency` and `pp.any_sellable`. One aggregate per Product row, no extra request.
 */
export const publicPrice = sql`LATERAL (
  SELECT CASE WHEN bool_and(v.price_currency = m.display_currency) THEN min(v.price_minor) END AS price_min_minor,
         CASE WHEN bool_and(v.price_currency = m.display_currency) THEN max(v.price_minor) END AS price_max_minor,
         CASE WHEN bool_and(v.price_currency = m.display_currency) THEN m.display_currency::text END AS price_currency,
         coalesce(bool_or(${variantSellable}), false) AS any_sellable
    FROM core.product_variant v
   WHERE v.product_id = p.id AND v.status = 'ACTIVE') pp`;

/** The Product is available: it trades and at least one of its Variants is sellable. */
export const productAvailable = sql<boolean>`(${productTrades} AND pp.any_sellable)`;

/**
 * A bigint money column (pg returns it as text) as a JSON integer. Refuses, loudly, a value a
 * JavaScript number cannot hold exactly rather than publish a silently wrong price.
 */
export function minorUnits(value: string | number | bigint): number;
export function minorUnits(value: string | number | bigint | null): number | null;
export function minorUnits(value: string | number | bigint | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new AdulisException('INTERNAL');
  return n;
}

/** The price fields every public Product summary carries. */
export function priceFields(row: {
  price_min_minor: string | null;
  price_max_minor: string | null;
  price_currency: string | null;
}) {
  return {
    price_min_minor: minorUnits(row.price_min_minor),
    price_max_minor: minorUnits(row.price_max_minor),
    price_currency: row.price_currency,
  };
}
