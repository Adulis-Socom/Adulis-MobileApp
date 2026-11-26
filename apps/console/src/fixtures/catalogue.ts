import type {
  Availability,
  AttributeDef,
  Blocker,
  CategoryAttributes,
  CategoryNode,
  ProductDetail,
  ProductState,
  ProductSummary,
  StockConfidence,
  StockEventView,
  VariantView,
} from '../contracts/gap-sc-catalogue';
import type { CallContext } from '../transport/port';
import { conflict, DAY_MS, demoImage, denied, invalid, need, needCap, notFound, withIdempotency, type Authz, type Handlers, type Kit } from './kit';

/**
 * Fixture Catalogue (GAP-SC-08..10): a demonstration taxonomy, Products, Variants and an Inventory ledger. DEVELOPMENT ONLY.
 *
 * THE TAXONOMY HERE IS A DEMONSTRATION, NOT THE OFFICIAL ONE. Only the three major names (Fashion, Cosmetics, Electronics) are
 * founder-approved. Every other node is labelled "Demonstration category", carries an `fx_` id, and every `required`
 * flag below is arbitrary: the submitted workbooks establish no required, searchable, filterable or Variant-defining rule
 * (docs: reports/16_TAXONOMY_SOURCE_AND_VALIDATION.md). The Console reads all of it from the response; it hard-codes none.
 * Two of the demonstration categories deliberately have NO attributes defined, to exercise the visible-gap states.
 */
export const TAXONOMY_VERSION = 'fx_taxonomy_demo_1';
const PAGE_SIZE = 6; // demonstration value: the real page size is the server's
const LOW_AT_OR_BELOW = 3; // demonstration value: the real threshold is configuration (CATINV S67)
const CONFIDENCE_WINDOW_MS = 7 * DAY_MS; // demonstration value only
const MEDIA_PROCESSING_MS = 1500; // demonstration value only
export const CURRENCY = 'ETB';

const demo = (name: string): string => `Demonstration category: ${name}`;
export const CATEGORIES: readonly CategoryNode[] = [
  { id: 'fx_cat_fashion', parent_id: null, label: 'Fashion', definition_status: 'DEFINED', selectable: false },
  { id: 'fx_cat_fashion_women', parent_id: 'fx_cat_fashion', label: demo("Women's Clothing"), definition_status: 'DEFINED', selectable: false },
  { id: 'fx_cat_fashion_dresses', parent_id: 'fx_cat_fashion_women', label: demo('Dresses'), definition_status: 'DEFINED', selectable: true },
  { id: 'fx_cat_fashion_backpacks', parent_id: 'fx_cat_fashion', label: demo('Backpacks'), definition_status: 'ATTRIBUTES_NOT_DEFINED', selectable: true },
  { id: 'fx_cat_cosmetics', parent_id: null, label: 'Cosmetics', definition_status: 'NOT_DEFINED', selectable: false },
  { id: 'fx_cat_cosmetics_skincare', parent_id: 'fx_cat_cosmetics', label: demo('Skincare'), definition_status: 'NOT_DEFINED', selectable: true },
  { id: 'fx_cat_electronics', parent_id: null, label: 'Electronics', definition_status: 'NOT_DEFINED', selectable: false },
  { id: 'fx_cat_electronics_phones', parent_id: 'fx_cat_electronics', label: demo('Mobile Phones'), definition_status: 'NOT_DEFINED', selectable: true },
];

const val = (...labels: string[]) => labels.map((label) => ({ id: `fx_val_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, label }));
const DRESS_ATTRIBUTES: readonly AttributeDef[] = [
  { id: 'fx_attr_colour', label: 'Colour', scope: 'VARIANT', value_type: 'SINGLE', required: true, values: val('Black', 'White', 'Red', 'Blue') },
  { id: 'fx_attr_size', label: 'Size', scope: 'VARIANT', value_type: 'SINGLE', required: true, values: val('XS', 'S', 'M', 'L', 'XL') },
  { id: 'fx_attr_material', label: 'Material', scope: 'PRODUCT', value_type: 'SINGLE', required: true, values: val('Cotton', 'Linen', 'Polyester', 'Silk') },
  { id: 'fx_attr_care', label: 'Care', scope: 'PRODUCT', value_type: 'MULTI', required: false, values: val('Machine wash', 'Hand wash', 'Dry clean only', 'Do not bleach') },
  { id: 'fx_attr_fabric_note', label: 'Fabric note', scope: 'PRODUCT', value_type: 'TEXT', required: false, values: [] },
];

function categoryAttributes(categoryId: string): CategoryAttributes['attributes'] {
  return categoryId === 'fx_cat_fashion_dresses' ? DRESS_ATTRIBUTES : [];
}
const categoryOf = (id: string | null): CategoryNode | undefined => (id === null ? undefined : CATEGORIES.find((c) => c.id === id));

interface VariantRec {
  id: string;
  options: Record<string, string>;
  price_minor: number | null;
  active: boolean;
  quantity: number;
  stock_version: number;
  confirmedAt: number | null;
  confirmedReason: string;
  events: StockEventView[];
}
interface MediaRec {
  id: string;
  file_name: string;
  content_type: string;
  addedAt: number;
  /** A seeded image has a bundled demonstration derivative; one the Seller added has none (the fixture server holds no bytes). */
  seeded: boolean;
}
interface ProductRec {
  id: string;
  version: number;
  title: string;
  description: string;
  category_id: string | null;
  attributes: Record<string, string[]>;
  mode: ProductDetail['stock_visibility_mode'];
  state: ProductState;
  publishedAt: number | null;
  media: MediaRec[];
  variants: VariantRec[];
  tiktokUrl: string | null;
}

export interface ProductFact {
  readonly id: string;
  readonly title: string;
  readonly state: ProductState;
  readonly availability: Availability;
  /**
   * True only when the Product is published, has at least one active Variant, and EVERY active Variant is at zero stock. A Product that is
   * unavailable for any other reason (withdrawn, restricted, no active Variant) is not "out of stock", and a Scene must not say it is.
   */
  readonly stockDepleted: boolean;
}

export interface Catalogue {
  readonly handlers: Handlers<
    | 'catalogue.categories.get'
    | 'catalogue.category.attributes.get'
    | 'products.list'
    | 'products.create'
    | 'products.get'
    | 'products.update'
    | 'products.publish'
    | 'products.withdraw'
    | 'products.media.add'
    | 'products.media.remove'
    | 'products.media.arrange'
    | 'products.tiktok.attach'
    | 'products.tiktok.detach'
    | 'variants.create'
    | 'variants.update'
    | 'inventory.set'
    | 'inventory.confirm'
    | 'inventory.history.get'
  >;
  /** Readiness fact (AT_LEAST_ONE_PRODUCT): a published Product exists. Resolved from the data, never a stored flag. */
  hasPublishedProduct(sellerId: string): boolean;
  /** Current commerce truth of one Product, for Scenes and Stories to resolve (they never copy it). */
  fact(sellerId: string, productId: string): ProductFact | undefined;
  facts(sellerId: string): readonly ProductFact[];
  /** Fixture moderation: put a Product under restriction, as an Operator decision would. Development only. */
  restrict(sellerId: string, productId: string): boolean;
}

export function createCatalogue(kit: Kit): Catalogue {
  const data = new Map<string, ProductRec[]>();

  const variant = (id: string, options: Record<string, string>, qty: number, price: number | null, confirmedAgoDays: number | null): VariantRec => ({
    id,
    options,
    price_minor: price,
    active: true,
    quantity: qty,
    stock_version: 1,
    confirmedAt: confirmedAgoDays === null ? null : kit.now() - confirmedAgoDays * DAY_MS,
    confirmedReason: confirmedAgoDays === null ? 'NEVER_CONFIRMED' : 'SELLER_CONFIRMED',
    events: [{ id: `${id}_e1`, delta: qty, reason_code: 'INITIAL_STOCK', occurred_at: kit.iso(kit.now() - 20 * DAY_MS) }],
  });
  const product = (
    sellerId: string,
    n: number,
    title: string,
    state: ProductState,
    category: string | null,
    variants: VariantRec[],
    extra: Partial<Pick<ProductRec, 'attributes' | 'media'>> = {},
  ): ProductRec => ({
    id: `fx_prod_${sellerId.replace('fx_seller_', '')}_${n}`,
    version: 1,
    title,
    description: state === 'DRAFT' ? '' : `${title}: a demonstration description.`,
    category_id: category,
    attributes: extra.attributes ?? {},
    mode: 'EXACT',
    state,
    publishedAt: state === 'DRAFT' ? null : kit.now() - 10 * DAY_MS,
    media: extra.media ?? (state === 'DRAFT' ? [] : [{ id: `fx_media_${sellerId.replace('fx_seller_', '')}_${n}`, file_name: `${title.toLowerCase().replace(/\W+/g, '-')}.jpg`, content_type: 'image/jpeg', addedAt: kit.now() - 11 * DAY_MS, seeded: true }]),
    variants,
    tiktokUrl: null,
  });
  const dressAttrs = { fx_attr_material: ['fx_val_linen'], fx_attr_care: ['fx_val_machine_wash'] };

  function seedFor(sellerId: string): ProductRec[] {
    const f = kit.flags(sellerId);
    const s = (n: number) => `fx_var_${sellerId.replace('fx_seller_', '')}_${n}`;
    if (sellerId === 'fx_seller_alem') {
      // Newest first. Eight Products so the list needs a second page.
      return [
        product(sellerId, 8, 'Restricted import jacket', 'RESTRICTED', 'fx_cat_fashion_backpacks', [variant(s(18), {}, 4, 150000, 2)]),
        product(sellerId, 7, 'Old season kaftan', 'WITHDRAWN', 'fx_cat_fashion_dresses', [variant(s(17), { fx_attr_colour: 'fx_val_blue', fx_attr_size: 'fx_val_m' }, 2, 180000, 30)], { attributes: dressAttrs }),
        product(sellerId, 6, 'Linen shirt', 'DRAFT', 'fx_cat_fashion_dresses', []),
        product(sellerId, 5, 'Wool scarf', 'DRAFT', null, []),
        product(sellerId, 4, 'Canvas backpack', 'PUBLISHED', 'fx_cat_fashion_backpacks', [variant(s(14), {}, 20, 120000, 1)]),
        product(sellerId, 3, 'Silk slip dress', 'PUBLISHED', 'fx_cat_fashion_dresses', [variant(s(13), { fx_attr_colour: 'fx_val_white', fx_attr_size: 'fx_val_s' }, 0, 250000, 40)], { attributes: { fx_attr_material: ['fx_val_silk'] } }),
        product(sellerId, 2, 'Cotton shirt dress', 'PUBLISHED', 'fx_cat_fashion_dresses', [variant(s(12), { fx_attr_colour: 'fx_val_blue', fx_attr_size: 'fx_val_m' }, 12, 200000, 2)], { attributes: { fx_attr_material: ['fx_val_cotton'] } }),
        product(sellerId, 1, 'Linen wrap dress', 'PUBLISHED', 'fx_cat_fashion_dresses', [
          variant(s(11), { fx_attr_colour: 'fx_val_black', fx_attr_size: 'fx_val_s' }, 8, 200000, 1),
          variant(s(12 + 100), { fx_attr_colour: 'fx_val_black', fx_attr_size: 'fx_val_m' }, 3, 200000, 12),
          variant(s(13 + 100), { fx_attr_colour: 'fx_val_red', fx_attr_size: 'fx_val_s' }, 0, 220000, null),
        ], { attributes: dressAttrs }),
      ];
    }
    if (f.product) return [product(sellerId, 1, 'Demonstration product', 'PUBLISHED', 'fx_cat_fashion_backpacks', [variant(s(1), {}, 5, 100000, 1)])];
    return [];
  }
  const productsOf = (sellerId: string): ProductRec[] => {
    let list = data.get(sellerId);
    if (!list) {
      list = seedFor(sellerId);
      data.set(sellerId, list);
    }
    return list;
  };
  const find = (sellerId: string, productId: string): ProductRec => {
    const p = productsOf(sellerId).find((x) => x.id === productId);
    if (!p) throw notFound(); // a Product of another Seller is indistinguishable from none
    return p;
  };

  // ---- resolvers: availability, confidence, blockers, allowed actions ------------------------------------------------
  const availOf = (v: VariantRec): Availability => (!v.active || v.quantity <= 0 ? 'NOT_AVAILABLE' : v.quantity <= LOW_AT_OR_BELOW ? 'LOW' : 'AVAILABLE');
  const productAvail = (p: ProductRec): Availability => {
    const all = p.variants.map(availOf);
    return all.includes('AVAILABLE') ? 'AVAILABLE' : all.includes('LOW') ? 'LOW' : 'NOT_AVAILABLE';
  };
  const confidenceOf = (v: VariantRec): StockConfidence => {
    const recent = v.confirmedAt !== null && kit.now() - v.confirmedAt <= CONFIDENCE_WINDOW_MS;
    return {
      state: recent ? 'RECENTLY_CONFIRMED' : v.confirmedAt === null ? 'NEVER_CONFIRMED' : 'NOT_RECENTLY_CONFIRMED',
      reason_code: v.confirmedAt === null ? 'NEVER_CONFIRMED' : recent ? v.confirmedReason : 'TIME_ELAPSED',
      effect_code: 'NONE_DEFINED',
      last_confirmed_at: v.confirmedAt === null ? null : kit.iso(v.confirmedAt),
    };
  };
  const summaryOf = (p: ProductRec, v: VariantRec): string => {
    const attrs = categoryAttributes(p.category_id ?? '').filter((a) => a.scope === 'VARIANT');
    const parts = attrs.flatMap((a) => {
      const id = v.options[a.id];
      const found = a.values.find((x) => x.id === id);
      return found ? [found.label] : [];
    });
    return parts.length > 0 ? parts.join(' / ') : 'Default';
  };
  const mediaState = (m: MediaRec): 'PROCESSING' | 'READY' | 'REJECTED' =>
    !m.content_type.startsWith('image/') ? 'REJECTED' : kit.now() - m.addedAt < MEDIA_PROCESSING_MS ? 'PROCESSING' : 'READY';

  function blockersOf(p: ProductRec): Blocker[] {
    if (p.state === 'PUBLISHED' || p.state === 'RESTRICTED') return [];
    const out: Blocker[] = [];
    if (p.title.trim() === '') out.push({ code: 'TITLE_REQUIRED', field: 'title' });
    if (p.category_id === null) out.push({ code: 'CATEGORY_REQUIRED', field: 'category' });
    for (const a of categoryAttributes(p.category_id ?? '').filter((x) => x.scope === 'PRODUCT' && x.required)) {
      if ((p.attributes[a.id] ?? []).length === 0) out.push({ code: 'REQUIRED_ATTRIBUTE_MISSING', field: `attr-${a.id}` });
    }
    const active = p.variants.filter((v) => v.active);
    if (active.length === 0) out.push({ code: 'NO_ACTIVE_VARIANT', field: 'variants' });
    for (const v of active) if (v.price_minor === null) out.push({ code: 'VARIANT_PRICE_REQUIRED', field: `variant-${v.id}-price` });
    if (p.media.length === 0) out.push({ code: 'MEDIA_REQUIRED', field: 'media' });
    else if (p.media.some((m) => mediaState(m) !== 'READY')) out.push({ code: 'MEDIA_NOT_READY', field: 'media' });
    return out;
  }
  /** Fixture: only Alem Textiles has a connected, ownership-verified TikTok account (handle @alem.textiles). */
  const tiktokConnected = (sellerId: string): boolean => sellerId === 'fx_seller_alem';
  function actionsOf(p: ProductRec, a: Authz): string[] {
    if (p.state === 'RESTRICTED') return [];
    const out: string[] = [];
    if (a.caps.has('content.write')) out.push('EDIT_TIKTOK');
    if (a.caps.has('catalogue.write')) {
      out.push('EDIT', 'ADD_VARIANT', 'EDIT_VARIANT', 'ADD_MEDIA');
      if (p.state === 'PUBLISHED') out.push('WITHDRAW');
      else out.push('PUBLISH');
    }
    if (a.caps.has('inventory.write')) out.push('ADJUST_STOCK', 'CONFIRM_STOCK');
    return out;
  }
  function detail(sellerId: string, p: ProductRec, a: Authz): ProductDetail {
    const variants: VariantView[] = p.variants.map((v) => ({
      id: v.id,
      summary: summaryOf(p, v),
      options: v.options,
      price_minor: v.price_minor,
      active: v.active,
      quantity: v.quantity,
      stock_version: v.stock_version,
      availability: availOf(v),
      confidence: confidenceOf(v),
    }));
    return {
      seller_id: sellerId,
      id: p.id,
      version: p.version,
      title: p.title,
      description: p.description,
      category_id: p.category_id,
      category_label: categoryOf(p.category_id)?.label ?? null,
      attributes: p.attributes,
      stock_visibility_mode: p.mode,
      currency: CURRENCY,
      publication: { state: p.state, published_at: p.publishedAt === null ? null : kit.iso(p.publishedAt), blockers: blockersOf(p) },
      availability: productAvail(p),
      media: p.media.map((m) => ({ id: m.id, file_name: m.file_name, state: mediaState(m), preview_url: m.seeded && mediaState(m) === 'READY' ? demoImage(m.file_name, 1) : null })),
      variants,
      tiktok: { connection: tiktokConnected(sellerId) ? 'CONNECTED' : 'NOT_CONNECTED', embed: p.tiktokUrl === null ? null : { video_url: p.tiktokUrl } },
      allowed_actions: actionsOf(p, a),
    };
  }

  /** Common entry for a Product write: Seller scope, destination, capability, existence, state, optimistic concurrency. */
  function open(ctx: CallContext, cap: string, productId: string, version: number | null): { a: Authz; p: ProductRec } {
    const a = kit.authz(ctx);
    need(a, 'products');
    needCap(a, cap);
    const p = find(a.sellerId, productId);
    if (p.state === 'RESTRICTED') throw denied();
    if (version !== null && p.version !== version) throw conflict();
    return { a, p };
  }

  const handlers: Catalogue['handlers'] = {
    'catalogue.categories.get': (_i, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'products');
      return { seller_id: a.sellerId, taxonomy_version: TAXONOMY_VERSION, categories: CATEGORIES };
    },
    'catalogue.category.attributes.get': ({ category_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'products');
      const c = categoryOf(category_id);
      if (!c) throw notFound();
      return { seller_id: a.sellerId, category_id, definition_status: c.definition_status, attributes: categoryAttributes(category_id) };
    },
    'products.list': ({ query, filter, cursor }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'products');
      const q = query.trim().toLowerCase();
      const all = productsOf(a.sellerId).filter((p) => (filter === 'ALL' || p.state === filter) && (q === '' || p.title.toLowerCase().includes(q)));
      const start = cursor === null ? 0 : all.findIndex((p) => p.id === cursor) + 1;
      const page = all.slice(start, start + PAGE_SIZE);
      const items: ProductSummary[] = page.map((p) => ({
        id: p.id,
        title: p.title,
        publication_state: p.state,
        category_label: categoryOf(p.category_id)?.label ?? null,
        availability: productAvail(p),
        variant_count: p.variants.filter((v) => v.active).length,
      }));
      const last = page[page.length - 1];
      return {
        seller_id: a.sellerId,
        items,
        next_cursor: start + PAGE_SIZE < all.length && last ? last.id : null,
        allowed_actions: a.caps.has('catalogue.write') ? ['CREATE'] : [],
      };
    },
    'products.create': (_i, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'products');
      needCap(a, 'catalogue.write');
      {
        const p: ProductRec = { id: kit.next('fx_prod'), version: 1, title: '', description: '', category_id: null, attributes: {}, mode: 'EXACT', state: 'DRAFT', publishedAt: null, media: [], variants: [], tiktokUrl: null };
        productsOf(a.sellerId).unshift(p);
        return detail(a.sellerId, p, a);
      }
    },
    'products.get': ({ product_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'products');
      return detail(a.sellerId, find(a.sellerId, product_id), a);
    },
    'products.update': (input, ctx) => {
      const { a, p } = open(ctx, 'catalogue.write', input.product_id, input.version);
      const errors: Record<string, string> = {};
      let category = p.category_id;
      if (input.category_id !== undefined) {
        const c = categoryOf(input.category_id);
        if (input.category_id !== null && (!c || !c.selectable)) errors['category'] = 'CATEGORY_NOT_SELECTABLE';
        else if (input.category_id !== p.category_id && p.variants.some((v) => Object.keys(v.options).length > 0)) errors['category'] = 'CATEGORY_CHANGE_BLOCKED_BY_VARIANTS';
        else category = input.category_id;
      }
      let attributes = p.attributes;
      if (input.attributes !== undefined || category !== p.category_id) {
        const defs = categoryAttributes(category ?? '').filter((d) => d.scope === 'PRODUCT');
        const next: Record<string, string[]> = {};
        for (const [attrId, values] of Object.entries(input.attributes ?? p.attributes)) {
          const def = defs.find((d) => d.id === attrId);
          if (!def) {
            if (input.attributes !== undefined) errors[`attr-${attrId}`] = 'ATTRIBUTE_NOT_IN_CATEGORY';
            continue; // a category change drops values that no longer apply
          }
          const clean = values.filter((x) => x.trim() !== '');
          const bad = def.value_type === 'TEXT' ? clean.length > 1 : clean.some((x) => !def.values.some((v) => v.id === x)) || (def.value_type === 'SINGLE' && clean.length > 1);
          if (bad) errors[`attr-${attrId}`] = 'ATTRIBUTE_VALUE_INVALID';
          else if (clean.length > 0) next[attrId] = clean;
        }
        attributes = next;
      }
      if (Object.keys(errors).length > 0) throw invalid(errors);
      p.title = input.title ?? p.title;
      p.description = input.description ?? p.description;
      p.category_id = category;
      p.attributes = attributes;
      p.mode = input.stock_visibility_mode ?? p.mode;
      p.version += 1;
      return detail(a.sellerId, p, a);
    },
    'products.publish': ({ product_id, version }, ctx) => {
      const { a, p } = open(ctx, 'catalogue.write', product_id, version);
      if (p.state === 'PUBLISHED') throw conflict();
      // All blockers at once (CON S49); nothing changes when any exists.
      if (blockersOf(p).length > 0) return { seller_id: a.sellerId, result: 'BLOCKED', product: detail(a.sellerId, p, a) };
      p.state = 'PUBLISHED';
      p.publishedAt = kit.now();
      p.version += 1;
      return { seller_id: a.sellerId, result: 'PUBLISHED', product: detail(a.sellerId, p, a) };
    },
    'products.withdraw': ({ product_id, version }, ctx) => {
      const { a, p } = open(ctx, 'catalogue.write', product_id, version);
      if (p.state !== 'PUBLISHED') throw conflict();
      p.state = 'WITHDRAWN';
      p.version += 1;
      return detail(a.sellerId, p, a);
    },
    'products.media.add': ({ product_id, version, file_name, content_type }, ctx) => {
      const { a, p } = open(ctx, 'catalogue.write', product_id, version);
      if (file_name.trim() === '') throw invalid({ media: 'MEDIA_FILE_REQUIRED' });
      p.media.push({ id: kit.next('fx_media'), file_name, content_type, addedAt: kit.now(), seeded: false });
      p.version += 1;
      return detail(a.sellerId, p, a);
    },
    'products.media.arrange': ({ product_id, version, order }, ctx) => {
      const { a, p } = open(ctx, 'catalogue.write', product_id, version);
      const same = order.length === p.media.length && new Set(order).size === order.length && p.media.every((m) => order.includes(m.id));
      if (!same) throw invalid({ media: 'MEDIA_ORDER_INVALID' });
      p.media = order.flatMap((id) => p.media.filter((m) => m.id === id));
      p.version += 1;
      return detail(a.sellerId, p, a);
    },
    'products.tiktok.attach': ({ product_id, version, video_url }, ctx) => {
      const { a, p } = open(ctx, 'content.write', product_id, version);
      // Never arbitrary embed HTML: a video reference the server verifies. The failures are the canonical Media-domain codes (founder ruling).
      const match = /^https:\/\/(?:www\.)?tiktok\.com\/(@[A-Za-z0-9._]+)\/video\/(\d+)/.exec(video_url.trim());
      if (!match) throw invalid({ tiktok: 'TIKTOK_URL_INVALID' });
      if (!tiktokConnected(a.sellerId)) throw invalid({ tiktok: 'TIKTOK_NOT_CONNECTED' });
      if (match[1] !== '@alem.textiles') throw invalid({ tiktok: 'TIKTOK_OWNERSHIP_NOT_VERIFIED' });
      if (video_url.includes('unavailable')) throw invalid({ tiktok: 'TIKTOK_EMBED_UNAVAILABLE' });
      p.tiktokUrl = video_url.trim();
      p.version += 1;
      return detail(a.sellerId, p, a);
    },
    'products.tiktok.detach': ({ product_id, version }, ctx) => {
      const { a, p } = open(ctx, 'content.write', product_id, version);
      p.tiktokUrl = null;
      p.version += 1;
      return detail(a.sellerId, p, a);
    },
    'products.media.remove': ({ product_id, version, media_id }, ctx) => {
      const { a, p } = open(ctx, 'catalogue.write', product_id, version);
      if (!p.media.some((m) => m.id === media_id)) throw notFound();
      p.media = p.media.filter((m) => m.id !== media_id);
      p.version += 1;
      return detail(a.sellerId, p, a);
    },
    'variants.create': ({ product_id, version, options, price_minor }, ctx) => {
      const { a, p } = open(ctx, 'catalogue.write', product_id, version);
      const variantDefs = categoryAttributes(p.category_id ?? '').filter((d) => d.scope === 'VARIANT');
      const errors: Record<string, string> = {};
      for (const d of variantDefs) if (!d.values.some((v) => v.id === options[d.id])) errors[`option-${d.id}`] = 'OPTION_REQUIRED';
      if (Object.keys(options).some((k) => !variantDefs.some((d) => d.id === k))) errors['options'] = 'OPTION_NOT_IN_CATEGORY';
      if (price_minor !== null && (!Number.isSafeInteger(price_minor) || price_minor < 0)) errors['price'] = 'PRICE_INVALID';
      if (Object.keys(errors).length === 0) {
        const norm = (o: Record<string, string>) => JSON.stringify(Object.entries(o).sort(([x], [y]) => x.localeCompare(y)));
        // Unique active combination per Product (CATINV S43, enforced server-side)
        if (p.variants.some((v) => v.active && norm(v.options) === norm(options))) errors['options'] = 'VARIANT_COMBINATION_EXISTS';
      }
      if (Object.keys(errors).length > 0) throw invalid(errors);
      p.variants.push({
        id: kit.next('fx_var'),
        options: { ...options },
        price_minor,
        active: true,
        quantity: 0,
        stock_version: 1,
        confirmedAt: null,
        confirmedReason: 'NEVER_CONFIRMED',
        events: [],
      });
      p.version += 1;
      return detail(a.sellerId, p, a);
    },
    'variants.update': ({ product_id, version, variant_id, price_minor, active }, ctx) => {
      const { a, p } = open(ctx, 'catalogue.write', product_id, version);
      const v = p.variants.find((x) => x.id === variant_id);
      if (!v) throw notFound();
      if (price_minor !== undefined) {
        if (price_minor !== null && (!Number.isSafeInteger(price_minor) || price_minor < 0)) throw invalid({ [`variant-${v.id}-price`]: 'PRICE_INVALID' });
        v.price_minor = price_minor; // a price edit never rewrites history (CATINV S45)
      }
      if (active !== undefined) v.active = active;
      p.version += 1;
      return detail(a.sellerId, p, a);
    },
    'inventory.set': ({ variant_id, stock_version, quantity }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'products');
      needCap(a, 'inventory.write');
      const { p, v } = findVariant(a.sellerId, variant_id);
      if (p.state === 'RESTRICTED') throw denied();
      if (v.stock_version !== stock_version) throw conflict(); // STOCK_VERSION_CONFLICT
      if (!Number.isSafeInteger(quantity) || quantity < 0) throw invalid({ quantity: 'STOCK_INVALID' });
      const delta = quantity - v.quantity;
      v.events.unshift({ id: kit.next('fx_stock'), delta, reason_code: 'SELLER_ADJUSTMENT', occurred_at: kit.iso(kit.now()) });
      v.quantity = quantity;
      v.stock_version += 1;
      v.confirmedAt = kit.now();
      v.confirmedReason = 'SELLER_SET_QUANTITY';
      return detail(a.sellerId, p, a);
    },
    'inventory.confirm': ({ variant_id, stock_version }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'products');
      needCap(a, 'inventory.write');
      const { p, v } = findVariant(a.sellerId, variant_id);
      if (p.state === 'RESTRICTED') throw denied();
      if (v.stock_version !== stock_version) throw conflict();
      // A confirmation moves no quantity (CATINV S62): the ledger records a zero-delta event, quantity is untouched.
      v.events.unshift({ id: kit.next('fx_stock'), delta: 0, reason_code: 'SELLER_CONFIRMATION', occurred_at: kit.iso(kit.now()) });
      v.stock_version += 1;
      v.confirmedAt = kit.now();
      v.confirmedReason = 'SELLER_CONFIRMED';
      return detail(a.sellerId, p, a);
    },
    'inventory.history.get': ({ variant_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'products');
      const { v } = findVariant(a.sellerId, variant_id);
      return { seller_id: a.sellerId, variant_id, events: v.events };
    },
  };

  function findVariant(sellerId: string, variantId: string): { p: ProductRec; v: VariantRec } {
    for (const p of productsOf(sellerId)) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) return { p, v };
    }
    throw notFound();
  }

  const factOf = (p: ProductRec): ProductFact => {
    const active = p.variants.filter((v) => v.active);
    return { id: p.id, title: p.title, state: p.state, availability: productAvail(p), stockDepleted: p.state === 'PUBLISHED' && active.length > 0 && active.every((v) => v.quantity <= 0) };
  };
  return {
    handlers: withIdempotency(kit, handlers, {
      'products.create': { dest: 'products', cap: 'catalogue.write' },
      'products.media.add': { dest: 'products', cap: 'catalogue.write' },
      'variants.create': { dest: 'products', cap: 'catalogue.write' },
      'inventory.set': { dest: 'products', cap: 'inventory.write' },
      'inventory.confirm': { dest: 'products', cap: 'inventory.write' },
    }),
    hasPublishedProduct: (sellerId) => productsOf(sellerId).some((p) => p.state === 'PUBLISHED'),
    fact: (sellerId, productId) => {
      const p = productsOf(sellerId).find((x) => x.id === productId);
      return p ? factOf(p) : undefined;
    },
    facts: (sellerId) => productsOf(sellerId).map(factOf),
    restrict: (sellerId, productId) => {
      const p = productsOf(sellerId).find((x) => x.id === productId);
      if (!p) return false;
      p.state = 'RESTRICTED';
      p.version += 1;
      return true;
    },
  };
}
