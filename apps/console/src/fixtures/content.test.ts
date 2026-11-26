import { describe, expect, it } from 'vitest';
import { TransportError } from '../transport/port';
import { createWorld, DEMO_CODES, PERSONAS, type World } from './world';

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
const list = (world: World, tab: 'ALL' | 'DRAFT' | 'PUBLIC' | 'PRIVATE' | 'ARCHIVED' | 'RESTRICTED', cursor: string | null = null) => world.handle('scenes.list', { tab, cursor }, ALEM);

/** Set one Variant's stock the way a Seller would: read its current version, then Set stock. */
async function setStock(world: World, productId: string, variantId: string, quantity: number): Promise<void> {
  const v = (await world.handle('products.get', { product_id: productId }, ALEM)).variants.find((x) => x.id === variantId);
  await world.handle('inventory.set', { variant_id: variantId, stock_version: v?.stock_version ?? 0, quantity }, ALEM);
}

describe('SC-FE-05 fixture Scenes: lifecycle, visibility and moderation are three facts', () => {
  it('lists by the CONSOLE-02 tabs, paginated by cursor', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const first = await list(world, 'ALL');
    expect(first.items).toHaveLength(5);
    const second = await list(world, 'ALL', first.next_cursor);
    expect(second.items).toHaveLength(1);
    expect(second.next_cursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((s) => s.id)).size).toBe(6);
    const ids = async (tab: Parameters<typeof list>[1]) => (await list(world, tab)).items.map((s) => s.id).sort();
    expect(await ids('DRAFT')).toEqual(['fx_scene_alem_3']);
    expect(await ids('PUBLIC')).toEqual(['fx_scene_alem_1']);
    expect(await ids('PRIVATE')).toEqual(['fx_scene_alem_2', 'fx_scene_alem_6']);
    expect(await ids('ARCHIVED')).toEqual(['fx_scene_alem_4']);
    expect(await ids('RESTRICTED')).toEqual(['fx_scene_alem_5']);
  });

  it('keeps publication, visibility and moderation apart, and gives each Private Scene its own typed reason', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const firstPage = await list(world, 'ALL');
    const all = [...firstPage.items, ...(await list(world, 'ALL', firstPage.next_cursor)).items];
    const by = (n: number) => all.find((s) => s.id === `fx_scene_alem_${n}`);
    expect(by(2)).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PRIVATE', private_reason: 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK', moderation: null, available_tag_count: 0, tag_count: 1 });
    expect(by(6)).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PRIVATE', private_reason: 'ALL_TAGGED_PRODUCTS_UNAVAILABLE' });
    expect(by(5)).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PRIVATE', private_reason: null, moderation: { state: 'RESTRICTED' } });
    expect(by(1)).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PUBLIC', private_reason: null, available_tag_count: 2 });
  });

  it('goes Private when the last tagged Product runs out, stays Published, and returns by itself on restock', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const scene = () => world.handle('scenes.get', { scene_id: 'fx_scene_alem_1' }, ALEM);
    expect((await scene()).visibility).toBe('PUBLIC');
    // one tagged Product still available: stays Public
    for (const v of ['fx_var_alem_11', 'fx_var_alem_112']) await setStock(world, 'fx_prod_alem_1', v, 0);
    let s = await scene();
    expect(s.visibility).toBe('PUBLIC');
    expect(s.tags.map((t) => t.availability)).toEqual(['NOT_AVAILABLE', 'AVAILABLE']);
    // the last one runs out
    await setStock(world, 'fx_prod_alem_2', 'fx_var_alem_12', 0);
    s = await scene();
    expect(s).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PRIVATE', private_reason: 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK' });
    // restock: Public again with no republish and no version change
    const before = s.version;
    await setStock(world, 'fx_prod_alem_2', 'fx_var_alem_12', 5);
    s = await scene();
    expect(s).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PUBLIC', private_reason: null, version: before });
  });

  it('a moderation restriction is not lifted by restock', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const s = await world.handle('scenes.get', { scene_id: 'fx_scene_alem_5' }, ALEM);
    expect(s.tags[0]?.availability).toBe('AVAILABLE');
    expect(s.visibility).toBe('PRIVATE');
    expect(s.moderation?.state).toBe('RESTRICTED');
  });
});

describe('SC-FE-05 fixture Scenes: authoring, blockers and publication', () => {
  it('an empty draft returns every blocker at once, in order, and a refusal changes nothing', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const draft = await world.handle('scenes.create', {}, ALEM);
    expect(draft.blockers.map((b) => b.code)).toEqual(['MEDIA_MISSING', 'CAPTION_REQUIRED', 'PRODUCT_TAG_REQUIRED']);
    const out = await world.handle('scenes.publish', { scene_id: draft.id, version: draft.version }, ALEM);
    expect(out.result).toBe('BLOCKED');
    expect(out.scene.publication_state).toBe('DRAFT');
    expect(out.scene.version).toBe(draft.version);
  });

  it('a Scene with an image, a caption and an available tag publishes and is Public', async () => {
    const { world, advance } = setup();
    await signIn(world, 'fx_acct_owner');
    let s = await world.handle('scenes.create', {}, ALEM);
    s = await world.handle('scenes.media.set', { scene_id: s.id, version: s.version, file_name: 'look.jpg', content_type: 'image/jpeg' }, ALEM);
    expect(s.image?.state).toBe('PROCESSING');
    expect(s.blockers.map((b) => b.code)).toContain('MEDIA_NOT_READY');
    advance(2000);
    s = await world.handle('scenes.update', { scene_id: s.id, version: s.version, caption: 'A new look', tags: [{ product_id: 'fx_prod_alem_1', hotspots: [{ x_norm: 0.3, y_norm: 0.7 }] }] }, ALEM);
    expect(s.image?.state).toBe('READY');
    expect(s.blockers).toEqual([]);
    expect(s.tags[0]?.hotspots).toHaveLength(1);
    const out = await world.handle('scenes.publish', { scene_id: s.id, version: s.version }, ALEM);
    expect(out.result).toBe('PUBLISHED');
    expect(out.scene).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PUBLIC' });
    expect(out.scene.allowed_actions).toEqual(['EDIT', 'ARCHIVE']);
  });

  it('only tags that are the SAME Seller\'s published Products are accepted; hotspots must be on the image; a Product is tagged once', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const s = await world.handle('scenes.create', {}, ALEM);
    const tags = async (t: { product_id: string; hotspots: { x_norm: number; y_norm: number }[] }[]) => failure(world.handle('scenes.update', { scene_id: s.id, version: s.version, tags: t }, ALEM));
    // another Seller's Product, a draft, a withdrawn one and an unknown id are all just "not eligible": existence is never disclosed
    for (const id of ['fx_prod_dawit_1', 'fx_prod_alem_5', 'fx_prod_alem_7', 'fx_prod_nothing']) {
      expect((await tags([{ product_id: id, hotspots: [] }])).fields['tags']).toBe('TAG_PRODUCT_NOT_ELIGIBLE');
    }
    expect((await tags([{ product_id: 'fx_prod_alem_1', hotspots: [] }, { product_id: 'fx_prod_alem_1', hotspots: [] }])).fields['tags']).toBe('TAG_DUPLICATE');
    expect((await tags([{ product_id: 'fx_prod_alem_1', hotspots: [{ x_norm: 1.2, y_norm: 0.5 }] }])).fields['hotspots']).toBe('HOTSPOT_INVALID');
  });

  it('a stale version is a conflict, and an archived Scene offers no action', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const s = await world.handle('scenes.create', {}, ALEM);
    await world.handle('scenes.update', { scene_id: s.id, version: s.version, caption: 'one' }, ALEM);
    expect((await failure(world.handle('scenes.update', { scene_id: s.id, version: s.version, caption: 'two' }, ALEM))).code).toBe('CONFLICT');
    const archived = await world.handle('scenes.get', { scene_id: 'fx_scene_alem_4' }, ALEM);
    expect(archived.allowed_actions).toEqual([]);
    expect((await failure(world.handle('scenes.update', { scene_id: archived.id, version: archived.version, caption: 'x' }, ALEM))).code).toBe('CONFLICT');
  });

  it('tag candidates are this Seller\'s Products only: published are taggable, withdrawn and restricted are shown as not taggable, drafts are absent', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const items = (await world.handle('scenes.tag_candidates.get', { query: '' }, ALEM)).items;
    expect(items.find((i) => i.title === 'Linen wrap dress')?.taggable).toBe(true);
    expect(items.find((i) => i.title === 'Old season kaftan')?.taggable).toBe(false);
    expect(items.find((i) => i.title === 'Restricted import jacket')?.taggable).toBe(false);
    expect(items.some((i) => i.title === 'Wool scarf')).toBe(false);
    expect((await world.handle('scenes.tag_candidates.get', { query: 'silk' }, ALEM)).items.map((i) => i.title)).toEqual(['Silk slip dress']);
  });

  it('idempotency: the same key creates one Scene', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const a = await world.handle('scenes.create', {}, { ...ALEM, idempotencyKey: 'k-scene' });
    const b = await world.handle('scenes.create', {}, { ...ALEM, idempotencyKey: 'k-scene' });
    expect(b.id).toBe(a.id);
    expect((await list(world, 'DRAFT')).items).toHaveLength(2);
  });
});

describe('SC-FE-05 fixture Scenes: who may do what', () => {
  it('Campaign Manager authors Scenes; Inventory and Sales Support have no Content area; the server says who may create', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_campaign');
    expect((await list(world, 'ALL')).allowed_actions).toEqual(['CREATE']);
    expect((await world.handle('scenes.create', {}, ALEM)).publication_state).toBe('DRAFT');
    await signIn(world, 'fx_acct_inventory');
    expect((await failure(list(world, 'ALL'))).code).toBe('PERMISSION_DENIED');
    await signIn(world, 'fx_acct_sales');
    expect((await failure(world.handle('scenes.create', {}, ALEM))).code).toBe('PERMISSION_DENIED');
  });

  it('a Scene of another Seller is indistinguishable from none', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    expect((await failure(world.handle('scenes.get', { scene_id: 'fx_scene_alem_1' }, { sellerId: 'fx_seller_biruk' }))).code).toBe('NOT_FOUND');
  });
});
