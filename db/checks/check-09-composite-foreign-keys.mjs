import { ok, bad } from './_lib.mjs';

/**
 * Appendix C check 9 — cross-seller and cross-buyer errors are structurally
 * impossible.
 *
 * Guards the four composite foreign keys ADU-DB-01 v1.8 names by name. Each turns
 * a rule that would otherwise be a service-layer check into something a second
 * endpoint cannot bypass:
 *
 *   cart_line_variant_seller   a cart holds one seller's items      (section 11.2)
 *   cart_line_single_seller    enforced when the second seller's
 *                              item is ADDED, not at checkout       (section 11.2)
 *   handoff_scanned_by_buyer   a courier can never perform the
 *                              buyer's scan, on any client          (section 14.2)
 *   review_by_order_buyer      only the order's buyer may review it (section 15)
 *
 * ADU-AUTH-01 section 19 is the reasoning: "a check can be forgotten by a new
 * endpoint; a constraint cannot."
 *
 * Live at Tier 2: carts and orders are migration 9, handoff 11, reviews 12.
 */
const REQUIRED = [
  'cart_line_variant_seller',
  'cart_line_single_seller',
  'handoff_scanned_by_buyer',
  'review_by_order_buyer',
];

export default {
  id: 9,
  title: 'Four composite FKs present, by name',
  source: 'ADU-DB-01 v1.8 sections 11.2, 14.2, 15',
  kind: 'database',
  liveAtTier: 2,
  expected: REQUIRED.join(', '),
  async run({ sql }) {
    const rows = await sql(
      `SELECT conname FROM pg_constraint WHERE contype = 'f' AND conname = ANY($1::text[])`,
      [REQUIRED],
    );
    const have = new Set(rows.map((r) => r.conname));
    const missing = REQUIRED.filter((c) => !have.has(c));
    return missing.length === 0
      ? ok('all four present')
      : bad(`missing: ${missing.join(', ')}`);
  },
};
