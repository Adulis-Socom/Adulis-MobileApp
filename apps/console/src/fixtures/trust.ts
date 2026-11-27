import type { ReviewAggregate, ReviewDimension, ReviewItem, Stars, TrustLevel } from '../contracts/gap-sc-trust';
import type { Catalogue } from './catalogue';
import { DAY_MS, need, needCap, type Handlers, type Kit } from './kit';

/**
 * Fixture Trust standing and Reviews (GAP-SC-16, SC-FE-09). DEVELOPMENT ONLY and READ ONLY: this module has no write and no operation that could
 * become one. The level is whatever the "server" holds; the Console renders it and never derives, advances or guesses it. Reviews are synthetic
 * (`fx_rev_` ids) and carry no purchase proof, transaction reference or evidence badge, because nothing here may imply a real purchase.
 * Aggregates are computed here, by the server's stand-in, per dimension; there is no combined rating and no average.
 */
const PAGE_SIZE = 3; // demonstration value: the real page size is the server's

type TrustOps = 'standing.get' | 'reviews.summary.get' | 'reviews.list';
export interface Trust {
  readonly handlers: Handlers<TrustOps>;
}

/** Demonstration standings. Iman shows a REBUILDING Seller and Dawit a TRUSTED one; a suspended Seller keeps only Home and Settings, so it is not used here. Everyone else starts NEW. */
const LEVELS: Readonly<Record<string, TrustLevel>> = { fx_seller_alem: 'ESTABLISHED', fx_seller_iman: 'REBUILDING', fx_seller_dawit: 'TRUSTED' };

interface ReviewRec {
  id: string;
  dimension: ReviewDimension;
  stars: Stars;
  text: string | null;
  daysAgo: number;
  productId: string | null;
}

/** Only Alem Textiles has reviews, so the other Sellers show the empty state. */
function seedFor(sellerId: string): ReviewRec[] {
  if (sellerId !== 'fx_seller_alem') return [];
  const r = (n: number, dimension: ReviewDimension, stars: Stars, text: string | null, daysAgo: number, productId: string | null): ReviewRec => ({ id: `fx_rev_alem_${n}`, dimension, stars, text, daysAgo, productId });
  return [
    r(1, 'PRODUCT', 5, 'The linen is soft and the cut is lovely.', 2, 'fx_prod_alem_1'),
    r(2, 'PRODUCT', 4, 'Good dress. It runs a little long on me.', 6, 'fx_prod_alem_1'),
    r(3, 'PRODUCT', 2, 'The colour was not the same as in the photo.', 9, 'fx_prod_alem_2'),
    r(4, 'PRODUCT', 5, null, 14, 'fx_prod_alem_4'),
    r(5, 'PRODUCT', 3, 'Fine for the price, nothing special.', 20, 'fx_prod_alem_2'),
    r(6, 'PRODUCT', 5, 'Sturdy bag, I use it every day.', 31, 'fx_prod_alem_4'),
    r(7, 'PRODUCT', 1, 'It arrived with a loose strap.', 40, 'fx_prod_alem_4'),
    r(8, 'SELLER_SERVICE', 5, 'They answered quickly and were very polite.', 3, null),
    r(9, 'SELLER_SERVICE', 4, null, 12, null),
    r(10, 'SELLER_SERVICE', 2, 'It took two days to get a reply.', 25, null),
    r(11, 'SELLER_SERVICE', 5, 'Helpful and clear.', 33, null),
  ];
}

export function createTrust(kit: Kit, catalogue: Catalogue): Trust {
  const data = new Map<string, ReviewRec[]>();
  const reviewsOf = (sellerId: string): ReviewRec[] => {
    let list = data.get(sellerId);
    if (!list) {
      list = seedFor(sellerId);
      data.set(sellerId, list);
    }
    return list;
  };

  function aggregate(sellerId: string, dimension: ReviewDimension): ReviewAggregate {
    const mine = reviewsOf(sellerId).filter((x) => x.dimension === dimension);
    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const x of mine) distribution[String(x.stars) as keyof typeof distribution] += 1;
    return { dimension, count: mine.length, distribution };
  }
  function item(sellerId: string, x: ReviewRec): ReviewItem {
    const product = x.productId ? catalogue.fact(sellerId, x.productId) : undefined;
    return { id: x.id, dimension: x.dimension, stars: x.stars, text: x.text, written_at: kit.iso(kit.now() - x.daysAgo * DAY_MS), product_label: x.dimension === 'PRODUCT' ? (product?.title ?? '') : null };
  }

  const handlers: Trust['handlers'] = {
    // AUTH-02: seller.trust:read is held by Owner, Admin, Sales Support and Inventory; seller.reviews:read by Owner, Admin and Sales Support.
    'standing.get': (_input, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'trust');
      needCap(a, 'trust.read');
      return { seller_id: a.sellerId, level: LEVELS[a.sellerId] ?? 'NEW', evaluated_at: LEVELS[a.sellerId] === undefined ? null : kit.iso(kit.now() - 2 * DAY_MS) };
    },
    'reviews.summary.get': (_input, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'trust');
      needCap(a, 'reviews.read');
      return { seller_id: a.sellerId, product: aggregate(a.sellerId, 'PRODUCT'), seller_service: aggregate(a.sellerId, 'SELLER_SERVICE') };
    },
    'reviews.list': ({ dimension, cursor }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'trust');
      needCap(a, 'reviews.read');
      const mine = reviewsOf(a.sellerId).filter((x) => x.dimension === dimension).sort((x, y) => x.daysAgo - y.daysAgo);
      const start = cursor === null ? 0 : Number(cursor);
      const page = mine.slice(start, start + PAGE_SIZE);
      return { seller_id: a.sellerId, dimension, items: page.map((x) => item(a.sellerId, x)), next_cursor: start + PAGE_SIZE < mine.length ? String(start + PAGE_SIZE) : null };
    },
  };
  return { handlers };
}
