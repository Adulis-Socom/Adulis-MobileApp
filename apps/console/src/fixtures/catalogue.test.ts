import { describe, expect, it } from 'vitest';
import { TransportError } from '../transport/port';
import { createWorld, DEMO_CODES, PERSONAS, type World } from './world';

/** A world whose clock the test controls, so media processing and stock confidence are deterministic. */
function setup(): { world: World; advance: (ms: number) => void } {
  let clock = Date.UTC(2026, 10, 26, 9, 0, 0);
  return { world: createWorld({ now: () => clock, latencyMs: 0 }), advance: (ms) => void (clock += ms) };
}
async function signIn(world: World, personaId: string): Promise<void> {
  const phone = PERSONAS.find((p) => p.id === personaId)?.phone ?? '';
  const challenge = await world.handle('auth.otp.start', { phone }, {});
  await world.handle('auth.otp.verify', { challenge_id: challenge.challenge_id, code: DEMO_CODES.ok }, {});
}
async function failure(promise: Promise<unknown>): Promise<TransportError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TransportError) return error;
    throw error;
  }
  throw new Error('expected a TransportError, the call succeeded');
}
const ALEM = { sellerId: 'fx_seller_alem' };
const BIRUK = { sellerId: 'fx_seller_biruk' };
const DRESSES = 'fx_cat_fashion_dresses';
const BACKPACKS = 'fx_cat_fashion_backpacks';

describe('SC-FE-04 fixture Catalogue: the taxonomy is data the server returns', () => {
  it('names every non-major category as a demonstration and leaves some categories undefined', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const tree = await world.handle('catalogue.categories.get', {}, ALEM);
    expect(tree.seller_id).toBe('fx_seller_alem');
    const roots = tree.categories.filter((c) => c.parent_id === null).map((c) => c.label);
    expect(roots).toEqual(['Fashion', 'Cosmetics', 'Electronics']);
    for (const c of tree.categories.filter((x) => x.parent_id !== null)) {
      expect(c.label.startsWith('Demonstration category:')).toBe(true);
      expect(c.id.startsWith('fx_')).toBe(true);
    }
    expect(tree.categories.some((c) => c.definition_status === 'NOT_DEFINED')).toBe(true);
    expect(tree.categories.some((c) => c.definition_status === 'ATTRIBUTES_NOT_DEFINED')).toBe(true);
  });

  it('returns typed attributes only for a defined category, and none (with the gap stated) otherwise', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const dresses = await world.handle('catalogue.category.attributes.get', { category_id: DRESSES }, ALEM);
    expect(dresses.definition_status).toBe('DEFINED');
    expect(new Set(dresses.attributes.map((a) => a.scope))).toEqual(new Set(['PRODUCT', 'VARIANT']));
    const backpacks = await world.handle('catalogue.category.attributes.get', { category_id: BACKPACKS }, ALEM);
    expect(backpacks.definition_status).toBe('ATTRIBUTES_NOT_DEFINED');
    expect(backpacks.attributes).toEqual([]);
  });
});

describe('SC-FE-04 fixture Catalogue: list, permission and Seller scope', () => {
  it('paginates by cursor without repeating or dropping a Product, and filters by search and state', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const first = await world.handle('products.list', { query: '', filter: 'ALL', cursor: null }, ALEM);
    expect(first.items).toHaveLength(6);
    expect(first.next_cursor).not.toBeNull();
    const second = await world.handle('products.list', { query: '', filter: 'ALL', cursor: first.next_cursor }, ALEM);
    expect(second.items).toHaveLength(2);
    expect(second.next_cursor).toBeNull();
    const ids = [...first.items, ...second.items].map((p) => p.id);
    expect(new Set(ids).size).toBe(8);
    const drafts = await world.handle('products.list', { query: '', filter: 'DRAFT', cursor: null }, ALEM);
    expect(drafts.items.every((p) => p.publication_state === 'DRAFT')).toBe(true);
    const found = await world.handle('products.list', { query: 'DRESS', filter: 'ALL', cursor: null }, ALEM);
    expect(found.items.map((p) => p.title).sort()).toEqual(['Cotton shirt dress', 'Linen wrap dress', 'Silk slip dress']);
  });

  it('the server says who may create: Owner yes, Inventory yes, Campaign Manager reads only, Sales Support is denied', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    expect((await world.handle('products.list', { query: '', filter: 'ALL', cursor: null }, ALEM)).allowed_actions).toEqual(['CREATE']);
    await signIn(world, 'fx_acct_campaign');
    expect((await world.handle('products.list', { query: '', filter: 'ALL', cursor: null }, ALEM)).allowed_actions).toEqual([]);
    expect((await failure(world.handle('products.create', {}, ALEM))).code).toBe('PERMISSION_DENIED');
    await signIn(world, 'fx_acct_sales');
    expect((await failure(world.handle('products.list', { query: '', filter: 'ALL', cursor: null }, ALEM))).code).toBe('PERMISSION_DENIED');
  });

  it('a Product of another Seller is indistinguishable from one that does not exist', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    expect((await failure(world.handle('products.get', { product_id: 'fx_prod_alem_1' }, BIRUK))).code).toBe('NOT_FOUND');
    expect((await failure(world.handle('products.get', { product_id: 'fx_prod_nope' }, ALEM))).code).toBe('NOT_FOUND');
  });

  it('a restricted Product offers no action at all and refuses writes', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const p = await world.handle('products.get', { product_id: 'fx_prod_alem_8' }, ALEM);
    expect(p.publication.state).toBe('RESTRICTED');
    expect(p.allowed_actions).toEqual([]);
    expect((await failure(world.handle('products.update', { product_id: p.id, version: p.version, title: 'x' }, ALEM))).code).toBe('PERMISSION_DENIED');
  });
});

describe('SC-FE-04 fixture Catalogue: editing, concurrency and the Variant rules', () => {
  it('returns every publication blocker at once for an empty draft, and changes nothing', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const draft = await world.handle('products.create', {}, BIRUK);
    expect(draft.publication.state).toBe('DRAFT');
    const outcome = await world.handle('products.publish', { product_id: draft.id, version: draft.version }, BIRUK);
    expect(outcome.result).toBe('BLOCKED');
    expect(outcome.product.publication.blockers.map((b) => b.code)).toEqual(['TITLE_REQUIRED', 'CATEGORY_REQUIRED', 'NO_ACTIVE_VARIANT', 'MEDIA_REQUIRED']);
    expect(outcome.product.publication.state).toBe('DRAFT');
    expect(outcome.product.version).toBe(draft.version);
  });

  it('a stale version is a conflict, never a silent overwrite', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const draft = await world.handle('products.create', {}, BIRUK);
    await world.handle('products.update', { product_id: draft.id, version: draft.version, title: 'First' }, BIRUK);
    expect((await failure(world.handle('products.update', { product_id: draft.id, version: draft.version, title: 'Second' }, BIRUK))).code).toBe('CONFLICT');
    expect((await world.handle('products.get', { product_id: draft.id }, BIRUK)).title).toBe('First');
  });

  it('enforces one active Variant per combination, and a deactivated one frees its combination', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    let p = await world.handle('products.create', {}, BIRUK);
    p = await world.handle('products.update', { product_id: p.id, version: p.version, category_id: DRESSES }, BIRUK);
    const options = { fx_attr_colour: 'fx_val_red', fx_attr_size: 'fx_val_xl' };
    p = await world.handle('variants.create', { product_id: p.id, version: p.version, options, price_minor: 150000 }, BIRUK);
    expect(p.variants[0]?.summary).toBe('Red / XL');
    const dup = await failure(world.handle('variants.create', { product_id: p.id, version: p.version, options, price_minor: null }, BIRUK));
    expect(dup.fields['options']).toBe('VARIANT_COMBINATION_EXISTS');
    const missing = await failure(world.handle('variants.create', { product_id: p.id, version: p.version, options: { fx_attr_colour: 'fx_val_red' }, price_minor: null }, BIRUK));
    expect(missing.fields['option-fx_attr_size']).toBe('OPTION_REQUIRED');
    p = await world.handle('variants.update', { product_id: p.id, version: p.version, variant_id: p.variants[0]?.id ?? '', active: false }, BIRUK);
    p = await world.handle('variants.create', { product_id: p.id, version: p.version, options, price_minor: null }, BIRUK);
    expect(p.variants.filter((v) => v.active)).toHaveLength(1);
  });

  it('a category with no Variant options still works: one default Variant, and the category cannot change under Variants that depend on it', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    let p = await world.handle('products.create', {}, BIRUK);
    p = await world.handle('products.update', { product_id: p.id, version: p.version, category_id: BACKPACKS }, BIRUK);
    p = await world.handle('variants.create', { product_id: p.id, version: p.version, options: {}, price_minor: 90000 }, BIRUK);
    expect(p.variants[0]?.summary).toBe('Default');
    expect((await failure(world.handle('variants.create', { product_id: p.id, version: p.version, options: {}, price_minor: null }, BIRUK))).fields['options']).toBe('VARIANT_COMBINATION_EXISTS');
    // default Variant carries no options, so moving to another category is allowed; one WITH options blocks it (below)
    p = await world.handle('products.update', { product_id: p.id, version: p.version, category_id: DRESSES }, BIRUK);
    p = await world.handle('variants.create', { product_id: p.id, version: p.version, options: { fx_attr_colour: 'fx_val_black', fx_attr_size: 'fx_val_s' }, price_minor: null }, BIRUK);
    expect((await failure(world.handle('products.update', { product_id: p.id, version: p.version, category_id: BACKPACKS }, BIRUK))).fields['category']).toBe('CATEGORY_CHANGE_BLOCKED_BY_VARIANTS');
  });

  it('refuses a value that is not one of the category\'s allowed values and a category that cannot hold Products', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    let p = await world.handle('products.create', {}, BIRUK);
    expect((await failure(world.handle('products.update', { product_id: p.id, version: p.version, category_id: 'fx_cat_fashion' }, BIRUK))).fields['category']).toBe('CATEGORY_NOT_SELECTABLE');
    p = await world.handle('products.update', { product_id: p.id, version: p.version, category_id: DRESSES }, BIRUK);
    const bad = await failure(world.handle('products.update', { product_id: p.id, version: p.version, attributes: { fx_attr_material: ['not_a_value'] } }, BIRUK));
    expect(bad.fields['attr-fx_attr_material']).toBe('ATTRIBUTE_VALUE_INVALID');
  });
});

describe('SC-FE-04 fixture Catalogue: publication, media and readiness', () => {
  it('a complete Product publishes, and that is what satisfies the First Product readiness item', async () => {
    const { world, advance } = setup();
    await signIn(world, 'fx_acct_owner');
    const before = await world.handle('seller.readiness.get', {}, BIRUK);
    expect(before.items.find((i) => i.code === 'AT_LEAST_ONE_PRODUCT')?.satisfied).toBe(false);
    let p = await world.handle('products.create', {}, BIRUK);
    p = await world.handle('products.update', { product_id: p.id, version: p.version, title: 'Cotton dress', category_id: DRESSES, attributes: { fx_attr_material: ['fx_val_cotton'] } }, BIRUK);
    p = await world.handle('variants.create', { product_id: p.id, version: p.version, options: { fx_attr_colour: 'fx_val_blue', fx_attr_size: 'fx_val_m' }, price_minor: 210000 }, BIRUK);
    p = await world.handle('products.media.add', { product_id: p.id, version: p.version, file_name: 'dress.jpg', content_type: 'image/jpeg' }, BIRUK);
    expect(p.media[0]?.state).toBe('PROCESSING');
    expect(p.publication.blockers.map((b) => b.code)).toEqual(['MEDIA_NOT_READY']);
    advance(2000);
    p = await world.handle('products.get', { product_id: p.id }, BIRUK);
    expect(p.media[0]?.state).toBe('READY');
    expect(p.publication.blockers).toEqual([]);
    const outcome = await world.handle('products.publish', { product_id: p.id, version: p.version }, BIRUK);
    expect(outcome.result).toBe('PUBLISHED');
    const after = await world.handle('seller.readiness.get', {}, BIRUK);
    expect(after.items.find((i) => i.code === 'AT_LEAST_ONE_PRODUCT')?.satisfied).toBe(true);
  });

  it('a file that is not an image is rejected by the server, not trusted by its name', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    let p = await world.handle('products.create', {}, BIRUK);
    p = await world.handle('products.media.add', { product_id: p.id, version: p.version, file_name: 'photo.jpg', content_type: 'text/plain' }, BIRUK);
    expect(p.media[0]?.state).toBe('REJECTED');
    expect(p.publication.blockers.map((b) => b.code)).toContain('MEDIA_NOT_READY');
  });

  it('withdrawing keeps the Product and allows publishing it again', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    let p = await world.handle('products.get', { product_id: 'fx_prod_alem_2' }, ALEM);
    p = await world.handle('products.withdraw', { product_id: p.id, version: p.version }, ALEM);
    expect(p.publication.state).toBe('WITHDRAWN');
    expect(p.allowed_actions).toContain('PUBLISH');
    expect((await world.handle('products.publish', { product_id: p.id, version: p.version }, ALEM)).result).toBe('PUBLISHED');
  });

  it('idempotency: the same key creates one Product', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const a = await world.handle('products.create', {}, { ...BIRUK, idempotencyKey: 'k-create' });
    const b = await world.handle('products.create', {}, { ...BIRUK, idempotencyKey: 'k-create' });
    expect(b.id).toBe(a.id);
    const list = await world.handle('products.list', { query: '', filter: 'DRAFT', cursor: null }, BIRUK);
    expect(list.items).toHaveLength(1);
  });
});

describe('SC-FE-04 fixture Inventory: a ledger, two distinct controls, no automatic unpublish', () => {
  const VARIANT = 'fx_var_alem_11'; // Linen wrap dress, Black / S, 8 in stock, confirmed a day ago

  it('Set stock writes a ledger event with the computed delta; Confirm stock writes a zero delta and moves no quantity', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    let p = await world.handle('products.get', { product_id: 'fx_prod_alem_1' }, ALEM);
    let v = p.variants.find((x) => x.id === VARIANT);
    expect(v?.quantity).toBe(8);
    p = await world.handle('inventory.set', { variant_id: VARIANT, stock_version: v?.stock_version ?? 0, quantity: 5 }, ALEM);
    v = p.variants.find((x) => x.id === VARIANT);
    expect(v?.quantity).toBe(5);
    p = await world.handle('inventory.confirm', { variant_id: VARIANT, stock_version: v?.stock_version ?? 0 }, ALEM);
    v = p.variants.find((x) => x.id === VARIANT);
    expect(v?.quantity).toBe(5);
    const history = await world.handle('inventory.history.get', { variant_id: VARIANT }, ALEM);
    expect(history.events.slice(0, 3).map((e) => [e.delta, e.reason_code])).toEqual([[0, 'SELLER_CONFIRMATION'], [-3, 'SELLER_ADJUSTMENT'], [8, 'INITIAL_STOCK']]);
  });

  it('confidence is resolved by the server from time and never chosen: it decays, and a confirmation restores it', async () => {
    const { world, advance } = setup();
    await signIn(world, 'fx_acct_owner');
    const read = async () => (await world.handle('products.get', { product_id: 'fx_prod_alem_1' }, ALEM)).variants.find((x) => x.id === VARIANT);
    expect((await read())?.confidence.state).toBe('RECENTLY_CONFIRMED');
    advance(10 * 86_400_000);
    const stale = await read();
    expect(stale?.confidence.state).toBe('NOT_RECENTLY_CONFIRMED');
    expect(stale?.confidence.reason_code).toBe('TIME_ELAPSED');
    await world.handle('inventory.confirm', { variant_id: VARIANT, stock_version: stale?.stock_version ?? 0 }, ALEM);
    expect((await read())?.confidence.state).toBe('RECENTLY_CONFIRMED');
  });

  it('rejects a stale stock version (conflict), a negative or fractional quantity, and a role without the stock capability', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const v = (await world.handle('products.get', { product_id: 'fx_prod_alem_1' }, ALEM)).variants.find((x) => x.id === VARIANT);
    expect((await failure(world.handle('inventory.set', { variant_id: VARIANT, stock_version: (v?.stock_version ?? 0) + 7, quantity: 1 }, ALEM))).code).toBe('CONFLICT');
    for (const quantity of [-1, 1.5]) {
      expect((await failure(world.handle('inventory.set', { variant_id: VARIANT, stock_version: v?.stock_version ?? 0, quantity }, ALEM))).fields['quantity']).toBe('STOCK_INVALID');
    }
    await signIn(world, 'fx_acct_campaign');
    expect((await failure(world.handle('inventory.set', { variant_id: VARIANT, stock_version: v?.stock_version ?? 0, quantity: 1 }, ALEM))).code).toBe('PERMISSION_DENIED');
    await signIn(world, 'fx_acct_inventory');
    expect((await world.handle('inventory.set', { variant_id: VARIANT, stock_version: v?.stock_version ?? 0, quantity: 6 }, ALEM)).id).toBe('fx_prod_alem_1');
  });

  it('zero stock makes a published Product Not Available but does not unpublish it (CATINV S22)', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const p = await world.handle('products.get', { product_id: 'fx_prod_alem_2' }, ALEM); // one Variant, 12 in stock
    const v = p.variants[0];
    const after = await world.handle('inventory.set', { variant_id: v?.id ?? '', stock_version: v?.stock_version ?? 0, quantity: 0 }, ALEM);
    expect(after.availability).toBe('NOT_AVAILABLE');
    expect(after.publication.state).toBe('PUBLISHED');
  });

  it('low stock is labelled by the server (the Console applies no threshold)', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const p = await world.handle('products.get', { product_id: 'fx_prod_alem_1' }, ALEM);
    expect(p.variants.map((v) => [v.summary, v.availability])).toEqual([['Black / S', 'AVAILABLE'], ['Black / M', 'LOW'], ['Red / S', 'NOT_AVAILABLE']]);
  });
});
