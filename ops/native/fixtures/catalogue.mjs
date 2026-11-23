// Catalogue fixture sets for the native flows (BUY-03A): a Seller with four Products, two Scenes, a
// second Market, a second Seller with 32 Products, and one assistant intent. Plain SQL, written as the
// superuser behind guardSql in ONE transaction (see index.mjs). Every id is derived from the run id; every
// phone number is a synthetic +25190000xxxx one (the range the baseline and seed.mjs use, never a live mobile range);
// no image object is written (key columns are plain strings).
//
// Known limits of a row fixture (disclosed, not bugs): Fixture Pottery is a NEW-level Seller with 32 PUBLISHED Products,
// above the API's NEW cap of 10, so a future Seller-API step on it would get LEVEL_LIMIT_REACHED; Market B is inserted
// directly as ACTIVE (fn_guard_market_live fires on UPDATE only) with no timing, eligibility or ladder rows, which is
// enough for the Market-isolation assertions but not for a flow run from a Market B device.
//
// Why rows and not the Seller API: the harness has no session or object-store channel for fixtures, and
// every column below has a SQL form. What a row skips (publication readiness, presigned-URL validation) is
// not what the flows assert. `now()` is constant inside a transaction, so every timestamp that orders a
// list (Products, Scenes) is explicit. Nothing here touches orders, payments, reviews or notifications.
//
// Schema facts relied on (db/migrations, verified by reading them):
//   0030 product.slug is NOT NULL, unique per Seller, write-once (a NULL slug is generated; it is explicit here);
//   0008 stock_count is derived from core.stock_event (a direct write raises), so counts are events;
//   0056 Variant and Product currency must equal the Market display currency (ETB);
//   0062 a Product category needs a label key and an availability row in the Product's Market;
//   0054 a Scene is created as a DRAFT with its working revision in the same transaction (the two foreign
//        keys are deferred), tagged, then published by core.fn_scene_post_publish; scene_post.published_at is
//        then set explicitly (the CHECK allows it once PUBLISHED); a published revision is immutable, so only
//        the Scene row carries the explicit feed time, and the feed and the public view read that column.
import { createHash } from 'node:crypto';

const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const SEED_MARKET = `(SELECT id FROM core.market WHERE code = 'SEED')`;
const CATEGORY = (code) => `(SELECT id FROM core.category WHERE code = ${q(code)})`;

/** A 22-character [A-Za-z0-9_-] Scene public reference, derived and therefore stable for a seed. */
export const publicRef = (seed) =>
  createHash('sha256').update(seed).digest('base64url').slice(0, 22);

// The newest `published_at` already in the SEED Market (the seeded 'Seed Coffee 1kg' is published at seed
// time) or now(), whichever is later: the four Weaves Products are published after both, by explicit seconds.
const base = (seller) =>
  `greatest(now(), coalesce((SELECT max(published_at) FROM core.product WHERE market_id = ${SEED_MARKET} AND seller_id <> '${seller}'), now()))`;

/** Seller 'Fixture Weaves' and its four Products (inventory E2, E3; ordered by created_at and published_at). */
export const WEAVES_PRODUCTS = [
  {
    key: 'basket',
    name: 'Woven basket',
    slug: 'woven-basket',
    description: 'Hand-woven in Addis Ababa from dyed grass.',
    base: 100000,
    category: null,
    variants: [
      { key: 'Small', price: 90000, stock: 3 },
      { key: 'Large', price: 120000, stock: 0 },
    ],
  },
  {
    key: 'scarf',
    name: 'Cotton scarf',
    slug: 'cotton-scarf',
    description: 'Shemma cotton with a woven border.',
    base: 45050,
    category: 'FASHION',
    variants: [{ key: 'One size', price: 45050, stock: 0 }],
  },
  {
    key: 'cup',
    name: 'Clay cup',
    slug: 'clay-cup',
    description: null,
    base: 35000,
    category: null,
    variants: [{ key: 'One size', price: 35000, stock: 4 }],
  },
  {
    key: 'tray',
    name: 'Coffee tray',
    slug: 'coffee-tray',
    description: 'Carved wood, for the coffee ceremony.',
    base: 150000,
    category: null,
    variants: [{ key: 'One size', price: 150000, stock: 2 }],
  },
];
export const WEAVES = {
  storeName: 'Fixture Weaves',
  handle: 'fixture-weaves',
  description: 'Baskets, scarves and cups from our Addis Ababa workshop.',
  handoffNote: 'Collect at the Merkato workshop.',
  phone: '+251900000902',
};

/** The two Scenes (inventory E4). `tags` are Product keys in position order; `hoursAgo` orders the feed. */
export const SCENES = [
  {
    key: 'private',
    caption: 'Coffee tray and scarf, set for the ceremony.',
    tags: ['tray', 'scarf'],
    hoursAgo: 2,
  },
  {
    key: 'explore',
    caption:
      'Morning light on the new baskets, woven this week in Addis Ababa. The scarf sold out on market day; the clay cups are glazed by hand, and every piece here is from our own workshop.',
    tags: ['basket', 'scarf', 'cup'],
    hoursAgo: 1,
  },
];

export const MARKET_B = {
  code: 'FXB',
  displayName: 'Fixture Market B',
  phone: '+251900000903',
  storeName: 'Fixture Weaves B',
  handle: 'fixture-weaves',
  product: {
    name: 'Woven basket',
    slug: 'woven-basket',
    variantKey: 'Market B size',
    price: 500000,
  },
};

export const POTTERY = {
  storeName: 'Fixture Pottery',
  handle: 'fixture-pottery',
  phone: '+251900000904',
  items: 32,
  // Shop item NN: category assignments (inventory E5/E6)
  categories: { 30: 'ELECTRONICS', 31: 'COSMETICS', 32: 'COSMETICS' },
};
export const itemName = (n) => `Shop item ${String(n).padStart(2, '0')}`;
export const itemPrice = (n) => 10000 + n * 100;

export const ASSISTANT = {
  intentCode: 'WO013_FIXTURE_DELIVERY',
  description: 'Fixture intent: delivery times',
  phrase: 'Delivery times?',
  template: 'nlu.answer.wo013_delivery',
};

/** Weaves ids, shared by the sets that need them. */
export const weavesIds = (uuid, m) => ({
  account: uuid(`cat-account:${m.run}`),
  seller: uuid(`cat-seller:${m.run}`),
  product: Object.fromEntries(
    WEAVES_PRODUCTS.map((p) => [p.key, uuid(`cat-product:${p.key}:${m.run}`)]),
  ),
});
export const scenePublicRef = (m, key) => publicRef(`scene-ref:${key}:${m.run}:${m.nonce}`);

const productRows = ({ uuid, m, seller, market, items }) => {
  // items: [{ key, name, slug, description, base, category, variants, created, published }]
  const lines = [];
  for (const p of items) {
    const pid = uuid(`${p.idKey}:${m.run}`);
    lines.push(
      `INSERT INTO core.product (id, seller_id, market_id, name, slug, description, category_id, visibility, base_price_minor, base_price_currency, created_at, published_at)
  VALUES ('${pid}', '${seller}', ${market}, ${q(p.name)}, ${q(p.slug)}, ${p.description === null ? 'NULL' : q(p.description)}, ${p.category ? CATEGORY(p.category) : 'NULL'}, 'PUBLISHED', ${p.base}, 'ETB', ${p.created}, ${p.published});`,
    );
    for (const v of p.variants) {
      const vid = uuid(`${p.idKey}:variant:${v.key}:${m.run}`);
      lines.push(
        `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key, status)
  VALUES ('${vid}', '${pid}', '${seller}', ${v.price}, 'ETB', ${q(v.key)}, 'ACTIVE');`,
      );
      if (v.stock > 0)
        lines.push(
          `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
  VALUES ('${uuid(`${p.idKey}:stock:${v.key}:${m.run}`)}', '${vid}', '${seller}', ${v.stock}, 'SELLER_SET');`,
        );
    }
  }
  return lines.join('\n');
};

const sellerRows = ({ account, seller, market, phone, who, handoff, created }) => `
INSERT INTO core.account (id, phone_e164, market_id, status, age_declared_over_18)
  VALUES ('${account}', '${phone}', ${market}, 'ACTIVE', true);
INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, description, status, created_at)
  VALUES ('${seller}', ${market}, '${account}', 'INDIVIDUAL', ${q(who.storeName)}, ${q(who.handle)}, ${who.description ? q(who.description) : 'NULL'}, 'ACTIVE', ${created});
INSERT INTO core.seller_fulfilment_method (seller_id, method, handoff_note, is_active)
  VALUES ('${seller}', 'BUYER_COLLECTION', ${handoff ? q(handoff) : 'NULL'}, true);
`;

export function catalogueSets(uuid) {
  return {
    'catalogue-core': {
      conflicts: [],
      sql: (m) => {
        const w = weavesIds(uuid, m);
        const items = WEAVES_PRODUCTS.map((p, i) => ({
          ...p,
          idKey: `cat-product:${p.key}`,
          created: `${base(w.seller)} + interval '${i + 1} seconds'`,
          published: `${base(w.seller)} + interval '${i + 1} seconds'`,
        }));
        return `${sellerRows({ uuid, m, account: w.account, seller: w.seller, market: SEED_MARKET, phone: WEAVES.phone, who: WEAVES, handoff: WEAVES.handoffNote, created: `now() - interval '45 days'` })}
INSERT INTO billing.subscription (id, seller_id, state, beta_started_at)
  VALUES ('${uuid(`cat-subscription:${m.run}`)}', '${w.seller}', 'BETA', now());
${productRows({ uuid, m, seller: w.seller, market: SEED_MARKET, items })}
`;
      },
    },

    scenes: {
      conflicts: [],
      requires: ['catalogue-core'],
      sql: (m) => {
        const w = weavesIds(uuid, m);
        const out = [];
        for (const s of SCENES) {
          const scene = uuid(`scene:${s.key}:${m.run}`);
          const rev = uuid(`scene-revision:${s.key}:${m.run}`);
          const ref = scenePublicRef(m, s.key);
          const key = (size) => `scenes/${ref}/img/${size}.webp`;
          out.push(`INSERT INTO core.scene_post (id, public_ref, seller_id, market_id, working_revision_id)
  VALUES ('${scene}', '${ref}', '${w.seller}', ${SEED_MARKET}, '${rev}');
INSERT INTO core.scene_post_revision (id, scene_post_id, seller_id, version, status, caption, image_thumb_key, image_card_key, image_full_key, author_account_id)
  VALUES ('${rev}', '${scene}', '${w.seller}', 1, 'WORKING', ${q(s.caption)}, '${key('thumb')}', '${key('card')}', '${key('full')}', '${w.account}');`);
          s.tags.forEach((t, i) =>
            out.push(`INSERT INTO core.scene_post_product (revision_id, seller_id, product_id, position)
  VALUES ('${rev}', '${w.seller}', '${w.product[t]}', ${i + 1});`),
          );
          out.push(`SELECT core.fn_scene_post_publish('${scene}', '${w.seller}', '${w.account}');
UPDATE core.scene_post SET published_at = now() - interval '${s.hoursAgo} hours' WHERE id = '${scene}';`);
        }
        return `${out.join('\n')}\n`;
      },
    },

    'market-b': {
      conflicts: [],
      sql: (m) => {
        const mk = uuid(`mb-market:${m.run}`);
        const market = `'${mk}'`;
        const seller = uuid(`mb-seller:${m.run}`);
        const b = MARKET_B;
        const items = [
          {
            idKey: 'mb-product',
            name: b.product.name,
            slug: b.product.slug,
            description: null,
            base: b.product.price,
            category: null,
            variants: [{ key: b.product.variantKey, price: b.product.price, stock: 1 }],
            created: 'now()',
            published: 'now()',
          },
        ];
        return `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone, default_locale, activation_state)
  VALUES ('${mk}', '${b.code}', ${q(b.displayName)}, 'PHASE_1', 'ETB', 'Africa/Addis_Ababa', 'en', 'ACTIVE');
${sellerRows({ uuid, m, account: uuid(`mb-account:${m.run}`), seller, market, phone: b.phone, who: { storeName: b.storeName, handle: b.handle, description: null }, handoff: null, created: 'now()' })}
${productRows({ uuid, m, seller, market, items })}
`;
      },
    },

    extras: {
      conflicts: [],
      requires: ['catalogue-core'],
      sql: (m) => {
        const seller = uuid(`po-seller:${m.run}`);
        const items = Array.from({ length: POTTERY.items }, (_, k) => {
          const n = k + 1;
          const days = `now() - interval '${40 - n} days'`;
          return {
            idKey: `po-product:${n}`,
            name: itemName(n),
            slug: `shop-item-${String(n).padStart(2, '0')}`,
            description: null,
            base: itemPrice(n),
            category: POTTERY.categories[n] ?? null,
            variants: [{ key: 'One size', price: itemPrice(n), stock: 1 }],
            created: days,
            published: days,
          };
        });
        return `${sellerRows({ uuid, m, account: uuid(`po-account:${m.run}`), seller, market: SEED_MARKET, phone: POTTERY.phone, who: { storeName: POTTERY.storeName, handle: POTTERY.handle, description: null }, handoff: null, created: `now() - interval '60 days'` })}
${productRows({ uuid, m, seller, market: SEED_MARKET, items })}
`;
      },
    },

    assistant: {
      conflicts: [],
      requires: ['catalogue-core'],
      sql: (m) => {
        const intent = uuid(`nlu-intent:${m.run}`);
        const a = ASSISTANT;
        return `INSERT INTO nlu.intent (id, code, description) VALUES ('${intent}', ${q(a.intentCode)}, ${q(a.description)});
INSERT INTO nlu.intent_phrase (id, intent_id, locale, text, source)
  VALUES ('${uuid(`nlu-phrase:${m.run}`)}', '${intent}', 'en', ${q(a.phrase)}, 'SEED');
INSERT INTO nlu.answer_template (id, intent_id, locale, seller_id, template, slots)
  VALUES ('${uuid(`nlu-template:${m.run}`)}', '${intent}', 'en', '${weavesIds(uuid, m).seller}', ${q(a.template)}, '{}');
`;
      },
    },
  };
}
