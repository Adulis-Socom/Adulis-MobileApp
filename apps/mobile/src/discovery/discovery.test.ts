// MOB-FE-02 discovery: pure logic and the fixture world through the real session boundary. Product rules are asserted as
// absences as well as presences, because completing the model is how a retired rule comes back.
import type { SceneCardUnit } from '../contracts/gap-mob-discovery';
import { containRect, hotspotPosition } from './hotspot';
import { availabilityText, formatMoney, formatPriceRange, trustText } from './format';
import { validRef } from './params';
import { CHANNELS, PAGE_SIZE, PRODUCTS, SCENES } from '../fixtures/discovery';
import { createFixtureTransport, PERSONAS } from '../fixtures';
import { makeRuntime, settle, signIn } from '../testing/harness';
import { TransportError } from '../transport/port';

const phone = (key: string) => PERSONAS.find((p) => p.key === key)?.phone as string;

describe('hotspot geometry', () => {
  it('fills the width and letterboxes top and bottom for a wide photo in a tall container', () => {
    expect(containRect({ width: 400, height: 400 }, 2)).toEqual({ left: 0, top: 100, width: 400, height: 200 });
  });
  it('fills the height and letterboxes the sides for a tall photo', () => {
    expect(containRect({ width: 400, height: 300 }, 0.5)).toEqual({ left: 125, top: 0, width: 150, height: 300 });
  });
  it('is the identity for a matching aspect, on a 360-wide phone and on a tablet', () => {
    for (const width of [360, 820]) expect(containRect({ width, height: width / 1.5 }, 1.5)).toEqual({ left: 0, top: 0, width, height: width / 1.5 });
  });
  it('places a normalised point inside the RENDERED image, not the container', () => {
    // 400x400 container, 2:1 photo: the image is 400x200 starting at y=100. The centre (0.5, 0.5) is the container centre;
    // the top-left corner of the image (0, 0) is NOT the container corner.
    expect(hotspotPosition({ x: 0.5, y: 0.5 }, { width: 400, height: 400 }, 2)).toEqual({ left: 200, top: 200 });
    expect(hotspotPosition({ x: 0, y: 0 }, { width: 400, height: 400 }, 2)).toEqual({ left: 0, top: 100 });
    expect(hotspotPosition({ x: 1, y: 1 }, { width: 400, height: 400 }, 2)).toEqual({ left: 400, top: 300 });
  });
  it('clamps a hostile point and survives a degenerate container or aspect', () => {
    expect(hotspotPosition({ x: -5, y: 9 }, { width: 100, height: 100 }, 1)).toEqual({ left: 0, top: 100 });
    expect(hotspotPosition({ x: Number.NaN, y: 0.5 }, { width: 100, height: 100 }, 1)).toEqual({ left: 0, top: 50 });
    expect(containRect({ width: 0, height: 0 }, 1)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(containRect({ width: 100, height: 100 }, 0)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});

describe('formatting is words and money, never arithmetic', () => {
  it('formats minor units with the currency exponent', () => {
    expect(formatMoney({ minor: 45000, currency: 'ETB' })).toMatch(/450/);
    expect(formatMoney({ minor: 500, currency: 'JPY' })).toMatch(/500/); // zero-exponent currency: not 5.00
  });
  it('shows one price when min equals max and a range otherwise', () => {
    const a = { minor: 100, currency: 'USD' };
    expect(formatPriceRange(a, a)).toBe(formatMoney(a));
    expect(formatPriceRange(a, { minor: 300, currency: 'USD' })).toBe(`${formatMoney(a)} to ${formatMoney({ minor: 300, currency: 'USD' })}`);
  });
  it('says availability in words and never gives a stock number', () => {
    expect(availabilityText(true)).toBe('Available');
    expect(availabilityText(false)).toBe('Currently unavailable');
    expect(availabilityText(false)).not.toMatch(/\d|only|left|low/i);
  });
  it('shows only the server trust level, or nothing', () => {
    expect(trustText(null)).toBeNull();
    expect(trustText('TRUSTED')).toBe('Trusted seller');
  });
});

describe('route parameters', () => {
  it('treats a route parameter as one safe opaque reference or nothing', () => {
    expect(validRef('fx_scene_demo_1')).toBe('fx_scene_demo_1');
    for (const bad of ['../x', 'a b', '', 'a/b', undefined, 7, 'x'.repeat(200)]) expect(validRef(bad)).toBeNull();
  });
});

describe('the fixture discovery world', () => {
  it('has exactly five channels in fixed order, For You first, and the three undecided ones not available', () => {
    expect(CHANNELS.map((c) => c.key)).toEqual(['FOR_YOU', 'FOLLOWING', 'NEARBY', 'DISCOUNTS', 'LOCALLY_MADE']);
    expect(CHANNELS.filter((c) => c.state === 'NOT_AVAILABLE').map((c) => c.key)).toEqual(['NEARBY', 'DISCOUNTS', 'LOCALLY_MADE']);
  });

  it('pages the For You feed in the server order, three at a time, and ends with a null cursor', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: { items: readonly SceneCardUnit[]; nextCursor: string | null } = await runtime.session.call('feed.forYou.page', { cursor });
      expect(page.items.length).toBeLessThanOrEqual(PAGE_SIZE);
      seen.push(...page.items.map((s) => s.sceneRef));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor !== null && pages < 10);
    expect(seen).toEqual(SCENES.map((s) => s.sceneRef)); // the client adds no order of its own
    expect(pages).toBe(Math.ceil(SCENES.length / PAGE_SIZE));
  });

  it('serves Scene Posts only in For You and Following: a Product Post is never a feed unit', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    for (const op of ['feed.forYou.page', 'feed.following.page'] as const) {
      const page = await runtime.session.call(op, { cursor: null });
      expect(page.items.every((item) => item.type === 'SCENE_POST')).toBe(true);
    }
  });

  it('Following needs an Account: a guest is refused locally and nothing is sent', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    const before = world.handle.opLog.length;
    await expect(runtime.session.call('feed.following.page', { cursor: null })).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    expect(world.handle.opLog).toHaveLength(before);
  });

  it('Following shows what the Account follows, and an empty list for an Account that follows nobody', async () => {
    const world = createFixtureTransport();
    const owner = await makeRuntime(world.transport);
    const second = await makeRuntime(world.transport);
    await owner.runtime.start();
    await second.runtime.start();
    await signIn(owner.runtime, phone('owner'));
    await signIn(second.runtime, phone('second'));
    await settle();
    const mine = await owner.runtime.session.call('feed.following.page', { cursor: null });
    const theirs = await second.runtime.session.call('feed.following.page', { cursor: null });
    expect(mine.items.length).toBeGreaterThan(0);
    expect(mine.items.every((s) => s.seller.sellerRef === 'fx_seller_demo_bete')).toBe(true);
    expect(theirs.items).toEqual([]);
  });

  it('answers 404 for a withdrawn Scene on open, drops it from every list, and shows no reason', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    expect((await runtime.session.call('scene.get', { sceneRef: 'fx_scene_demo_1' })).scene.sceneRef).toBe('fx_scene_demo_1');
    world.handle.withdraw('fx_scene_demo_1');
    await expect(runtime.session.call('scene.get', { sceneRef: 'fx_scene_demo_1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const feed = await runtime.session.call('feed.forYou.page', { cursor: null });
    expect(feed.items.map((s) => s.sceneRef)).not.toContain('fx_scene_demo_1');
    const found = await runtime.session.call('search.query', { q: 'basket', type: 'SCENE_POST', cursor: null });
    expect(found.items).toEqual([]);
    // A private, a removed and a missing Scene are indistinguishable.
    const missing = await runtime.session.call('scene.get', { sceneRef: 'fx_scene_demo_404' }).catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(TransportError);
    expect((missing as TransportError).code).toBe('NOT_FOUND');
  });

  it('Search returns only the type asked for, and Top mixes the three kinds and nothing else', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const kinds = async (type: 'TOP' | 'PRODUCT_POST' | 'SCENE_POST' | 'SELLER', q: string) => (await runtime.session.call('search.query', { q, type, cursor: null })).items.map((i) => i.kind);
    expect(new Set(await kinds('PRODUCT_POST', 'woven'))).toEqual(new Set(['PRODUCT_POST']));
    expect(new Set(await kinds('SCENE_POST', 'scene'))).toEqual(new Set(['SCENE_POST']));
    expect(new Set(await kinds('SELLER', 'store'))).toEqual(new Set(['SELLER']));
    const top = new Set(await kinds('TOP', 'demo'));
    for (const kind of top) expect(['PRODUCT_POST', 'SCENE_POST', 'SELLER']).toContain(kind);
  });

  it('Shop keeps the server order, refuses an unknown category, and has no client sort', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const first = await runtime.session.call('shop.products.page', { cursor: null, category: null });
    expect(first.items.map((p) => p.productRef)).toEqual(PRODUCTS.slice(0, PAGE_SIZE).map((p) => p.productRef));
    await expect(runtime.session.call('shop.products.page', { cursor: null, category: 'not-a-category' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    const fashion = await runtime.session.call('shop.products.page', { cursor: null, category: 'fashion' });
    expect(fashion.items.every((p) => p.seller.sellerRef === 'fx_seller_demo_bete')).toBe(true);
  });

  it('carries a Scene with no hotspot data, an unavailable tag and a long caption as the server sent them', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const noHotspots = (await runtime.session.call('scene.get', { sceneRef: 'fx_scene_demo_6' })).scene;
    expect(noHotspots.tags.every((t) => t.hotspot === null)).toBe(true);
    const unavailable = (await runtime.session.call('scene.get', { sceneRef: 'fx_scene_demo_3' })).scene;
    expect(unavailable.tags.some((t) => !t.available)).toBe(true);
    expect((await runtime.session.call('scene.get', { sceneRef: 'fx_scene_demo_5' })).scene.caption.length).toBeGreaterThan(300);
  });

  it('shows related Scenes from the SAME Seller only', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const { scene } = await runtime.session.call('scene.get', { sceneRef: 'fx_scene_demo_1' });
    expect(scene.related.length).toBeGreaterThan(0);
    expect(scene.related.every((r) => r.seller.sellerRef === scene.seller.sellerRef && r.sceneRef !== scene.sceneRef)).toBe(true);
  });

  it('no payload carries a ranking, discount, stock, Like-count, location or review-summary field', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const payloads: unknown[] = [
      await runtime.session.call('home.channels.get', {}),
      await runtime.session.call('feed.forYou.page', { cursor: null }),
      await runtime.session.call('scene.get', { sceneRef: 'fx_scene_demo_1' }),
      await runtime.session.call('product.get', { productRef: 'fx_product_demo_1' }),
      await runtime.session.call('seller.get', { sellerRef: 'fx_seller_demo_alem' }),
      await runtime.session.call('shop.products.page', { cursor: null, category: null }),
      await runtime.session.call('search.query', { q: 'demo', type: 'TOP', cursor: null }),
    ];
    const keys = new Set<string>();
    const walk = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          keys.add(k);
          walk(v);
        }
      }
    };
    payloads.forEach(walk);
    const forbidden = [...keys].filter((k) => /score|weight|rank|algorithm|candidate|discount|percent|stock|likes?\b|likeCount|comment|popular|trending|distance|radius|location|reviewSummary|rating|handoff/i.test(k));
    expect(forbidden).toEqual([]);
    expect(keys.size).toBeGreaterThan(20);
  });
});
