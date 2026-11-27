import { describe, expect, it } from 'vitest';
import { TransportError } from '../transport/port';
import { createWorld, DEMO_CODES, PERSONAS, type World } from './world';

/** Batch 02C closure: the Private reason is exact about its cause, and idempotency is scoped like a server's. */
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

async function setStock(world: World, productId: string, variantId: string, quantity: number): Promise<void> {
  const v = (await world.handle('products.get', { product_id: productId }, ALEM)).variants.find((x) => x.id === variantId);
  await world.handle('inventory.set', { variant_id: variantId, stock_version: v?.stock_version ?? 0, quantity }, ALEM);
}
async function withdraw(world: World, productId: string): Promise<void> {
  const p = await world.handle('products.get', { product_id: productId }, ALEM);
  await world.handle('products.withdraw', { product_id: p.id, version: p.version }, ALEM);
}
/** A published Scene tagging the given Products, built through the same commands a Seller uses. */
async function publishedScene(world: World, advance: (ms: number) => void, products: string[]): Promise<string> {
  let s = await world.handle('scenes.create', {}, ALEM);
  s = await world.handle('scenes.media.set', { scene_id: s.id, version: s.version, file_name: 'a.jpg', content_type: 'image/jpeg' }, ALEM);
  advance(2000);
  s = await world.handle('scenes.update', { scene_id: s.id, version: s.version, caption: 'A caption', tags: products.map((product_id) => ({ product_id, hotspots: [] })) }, ALEM);
  const out = await world.handle('scenes.publish', { scene_id: s.id, version: s.version }, ALEM);
  expect(out.result).toBe('PUBLISHED');
  return s.id;
}
const scene = (world: World, id: string) => world.handle('scenes.get', { scene_id: id }, ALEM);
const P2 = 'fx_prod_alem_2';
const P2_VARIANT = 'fx_var_alem_12';
const P4 = 'fx_prod_alem_4';
const P4_VARIANT = 'fx_var_alem_14';

describe('Private reason: the stock reason only when stock depletion is the sole cause', () => {
  it('stock only: every tagged Product depleted and nothing else wrong gives the stock reason, and restock restores it', async () => {
    const { world, advance } = setup();
    await signIn(world, 'fx_acct_owner');
    const id = await publishedScene(world, advance, [P2]);
    await setStock(world, P2, P2_VARIANT, 0);
    expect(await scene(world, id)).toMatchObject({ visibility: 'PRIVATE', private_reason: 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK' });
    await setStock(world, P2, P2_VARIANT, 4);
    expect(await scene(world, id)).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PUBLIC', private_reason: null });
  });

  it('withdrawn only: not the stock reason, whatever the stock is', async () => {
    const { world, advance } = setup();
    await signIn(world, 'fx_acct_owner');
    const id = await publishedScene(world, advance, [P2]);
    await withdraw(world, P2);
    expect(await scene(world, id)).toMatchObject({ visibility: 'PRIVATE', private_reason: 'ALL_TAGGED_PRODUCTS_UNAVAILABLE' });
  });

  it('restricted only: not the stock reason', async () => {
    const { world, advance } = setup();
    await signIn(world, 'fx_acct_owner');
    const id = await publishedScene(world, advance, [P2]);
    expect(world.hooks.restrictProduct('fx_seller_alem', P2)).toBe(true);
    expect(await scene(world, id)).toMatchObject({ visibility: 'PRIVATE', private_reason: 'ALL_TAGGED_PRODUCTS_UNAVAILABLE' });
  });

  it('mixed causes (one withdrawn, one out of stock): the general reason, because it is not stock alone', async () => {
    const { world, advance } = setup();
    await signIn(world, 'fx_acct_owner');
    const id = await publishedScene(world, advance, [P2, P4]);
    await withdraw(world, P2);
    await setStock(world, P4, P4_VARIANT, 0);
    expect(await scene(world, id)).toMatchObject({ visibility: 'PRIVATE', private_reason: 'ALL_TAGGED_PRODUCTS_UNAVAILABLE' });
  });

  it('partial availability: one Product still available keeps the Scene Public with no reason', async () => {
    const { world, advance } = setup();
    await signIn(world, 'fx_acct_owner');
    const id = await publishedScene(world, advance, [P2, P4]);
    await setStock(world, P4, P4_VARIANT, 0);
    expect(await scene(world, id)).toMatchObject({ visibility: 'PUBLIC', private_reason: null });
  });

  it('restoration with moderation still active: restock changes nothing about a restricted Scene', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    await setStock(world, P2, P2_VARIANT, 0);
    expect(await scene(world, 'fx_scene_alem_5')).toMatchObject({ visibility: 'PRIVATE', private_reason: null, moderation: { state: 'RESTRICTED' } });
    await setStock(world, P2, P2_VARIANT, 9);
    expect(await scene(world, 'fx_scene_alem_5')).toMatchObject({ visibility: 'PRIVATE', private_reason: null, moderation: { state: 'RESTRICTED' } });
  });

  it('the zero-tag blocker is PRODUCT_TAG_REQUIRED and the no-available blocker is separate', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const draft = await world.handle('scenes.create', {}, ALEM);
    expect(draft.blockers.map((b) => b.code)).toContain('PRODUCT_TAG_REQUIRED');
    expect(draft.blockers.map((b) => b.code)).not.toContain('SCENE_PRODUCT_TAG_REQUIRED');
    // a tag set whose Products are all unavailable fails with the OTHER code, not the zero-tag one
    const tagged = await world.handle('scenes.update', { scene_id: draft.id, version: draft.version, tags: [{ product_id: 'fx_prod_alem_3', hotspots: [] }] }, ALEM);
    const codes = tagged.blockers.map((b) => b.code);
    expect(codes).toContain('NO_AVAILABLE_TAGGED_PRODUCT');
    expect(codes).not.toContain('PRODUCT_TAG_REQUIRED');
  });
});

describe('idempotency is scoped to account, Seller, operation, key and payload', () => {
  it('the same scope, key and payload replays the original result, so a lost response cannot apply twice', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const v = (await world.handle('products.get', { product_id: P2 }, ALEM)).variants[0];
    const input = { variant_id: v?.id ?? '', stock_version: v?.stock_version ?? 0, quantity: 5 };
    const first = await world.handle('inventory.set', input, { ...ALEM, idempotencyKey: 'k1' });
    const replay = await world.handle('inventory.set', input, { ...ALEM, idempotencyKey: 'k1' }); // the stock_version is stale now
    expect(replay).toEqual(first);
    const history = await world.handle('inventory.history.get', { variant_id: input.variant_id }, ALEM);
    expect(history.events.filter((e) => e.reason_code === 'SELLER_ADJUSTMENT')).toHaveLength(1);
  });

  it('the same key with a DIFFERENT payload is refused and applies nothing', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const v = (await world.handle('products.get', { product_id: P2 }, ALEM)).variants[0];
    const base = { variant_id: v?.id ?? '', stock_version: v?.stock_version ?? 0 };
    await world.handle('inventory.set', { ...base, quantity: 5 }, { ...ALEM, idempotencyKey: 'k2' });
    const reused = await failure(world.handle('inventory.set', { ...base, quantity: 99 }, { ...ALEM, idempotencyKey: 'k2' }));
    expect(reused).toMatchObject({ code: 'CONFLICT', detail: 'IDEMPOTENCY_KEY_REUSED' });
    expect((await world.handle('products.get', { product_id: P2 }, ALEM)).variants[0]?.quantity).toBe(5);
  });

  it('one Seller cannot retrieve another Seller\'s cached response with the same key', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const a = await world.handle('products.create', {}, { ...ALEM, idempotencyKey: 'shared' });
    const b = await world.handle('products.create', {}, { ...BIRUK, idempotencyKey: 'shared' });
    expect(b.id).not.toBe(a.id);
    expect(b.seller_id).toBe('fx_seller_biruk');
    expect((await world.handle('products.get', { product_id: b.id }, BIRUK)).id).toBe(b.id);
  });

  it('one account cannot retrieve another account\'s cached response on the same Seller with the same key', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const owner = await world.handle('products.create', {}, { ...ALEM, idempotencyKey: 'shared' });
    await signIn(world, 'fx_acct_admin');
    const admin = await world.handle('products.create', {}, { ...ALEM, idempotencyKey: 'shared' });
    expect(admin.id).not.toBe(owner.id);
  });

  it('a cached success cannot bypass authorization that has since been revoked', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    await world.handle('products.create', {}, { ...ALEM, idempotencyKey: 'k3' });
    world.hooks.revokeCapability('fx_seller_alem', 'catalogue.write');
    expect((await failure(world.handle('products.create', {}, { ...ALEM, idempotencyKey: 'k3' }))).code).toBe('PERMISSION_DENIED');
  });

  it('a refused request is not cached: corrected, it can be sent again with the same key', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    let p = await world.handle('products.create', {}, BIRUK);
    p = await world.handle('products.update', { product_id: p.id, version: p.version, category_id: 'fx_cat_fashion_dresses' }, BIRUK);
    const bad = await failure(world.handle('variants.create', { product_id: p.id, version: p.version, options: {}, price_minor: null }, { ...BIRUK, idempotencyKey: 'k4' }));
    expect(bad.code).toBe('VALIDATION_FAILED');
    const options = { fx_attr_colour: 'fx_val_red', fx_attr_size: 'fx_val_m' };
    const ok = await world.handle('variants.create', { product_id: p.id, version: p.version, options, price_minor: 100 }, { ...BIRUK, idempotencyKey: 'k4' });
    expect(ok.variants).toHaveLength(1);
  });

  it('a lost response creates no duplicate Scene, Story or invitation', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    await world.handle('scenes.create', {}, { ...ALEM, idempotencyKey: 's' });
    await world.handle('scenes.create', {}, { ...ALEM, idempotencyKey: 's' });
    expect((await world.handle('scenes.list', { tab: 'DRAFT', cursor: null }, ALEM)).items).toHaveLength(2); // the seeded draft plus ONE new
    const story = { photo_name: 'a.jpg', content_type: 'image/jpeg', text: null, target: null } as const;
    await world.handle('stories.create', story, { ...ALEM, idempotencyKey: 'st' });
    await world.handle('stories.create', story, { ...ALEM, idempotencyKey: 'st' });
    expect((await world.handle('stories.list', {}, ALEM)).items).toHaveLength(7);
    await world.handle('couriers.invite', { phone: '+251911000077' }, { ...ALEM, idempotencyKey: 'c' });
    await world.handle('couriers.invite', { phone: '+251911000077' }, { ...ALEM, idempotencyKey: 'c' });
    expect((await world.handle('couriers.list', {}, ALEM)).items).toHaveLength(4);
  });
});
