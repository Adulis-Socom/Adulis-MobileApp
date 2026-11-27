// MOB-FE-03 through the real session boundary and the fixture world: server-confirmed writes by desired state, Account isolation,
// guest refusal, and the product rules as absences (no Product Like, no counts, no comments).
import { OP_SPECS } from '../contracts/ops';
import { createFixtureTransport, PERSONAS } from '../fixtures';
import { makeRuntime, settle, signIn } from '../testing/harness';
import { writeKey } from './hooks';

const phone = (key: string) => PERSONAS.find((p) => p.key === key)?.phone as string;
const SCENE = 'fx_scene_demo_1';

async function signedIn(world: ReturnType<typeof createFixtureTransport>, persona: string) {
  const h = await makeRuntime(world.transport);
  await h.runtime.start();
  await signIn(h.runtime, phone(persona));
  await settle();
  return h.runtime;
}

describe('writes carry the desired state and are idempotent', () => {
  it('Like, Save, Follow and Product Save set exactly what was asked, and asking twice changes nothing more', async () => {
    const runtime = await signedIn(createFixtureTransport(), 'second');
    const state = () => runtime.session.call('engagement.state.get', { sceneRefs: [SCENE], productRefs: ['fx_product_demo_1'], sellerRefs: ['fx_seller_demo_alem'] });
    expect((await state()).scenes[SCENE]).toEqual({ liked: false, saved: false });

    await runtime.session.call('scene.like.set', { sceneRef: SCENE, liked: true });
    await runtime.session.call('scene.like.set', { sceneRef: SCENE, liked: true }); // a replay is safe
    await runtime.session.call('scene.save.set', { sceneRef: SCENE, saved: true });
    await runtime.session.call('product.save.set', { productRef: 'fx_product_demo_1', saved: true });
    await runtime.session.call('seller.follow.set', { sellerRef: 'fx_seller_demo_alem', following: true });
    const after = await state();
    expect(after.scenes[SCENE]).toEqual({ liked: true, saved: true });
    expect(after.products['fx_product_demo_1']).toEqual({ saved: true });
    expect(after.sellers['fx_seller_demo_alem']).toEqual({ following: true });

    await runtime.session.call('scene.like.set', { sceneRef: SCENE, liked: false });
    expect((await state()).scenes[SCENE]).toEqual({ liked: false, saved: true }); // Like and Save are independent
  });

  it('a write to something the server does not show is refused as one neutral NOT_FOUND', async () => {
    const world = createFixtureTransport();
    const runtime = await signedIn(world, 'second');
    world.handle.withdraw(SCENE);
    await expect(runtime.session.call('scene.save.set', { sceneRef: SCENE, saved: true })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(runtime.session.call('seller.follow.set', { sellerRef: 'fx_seller_demo_nobody', following: true })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('guests and Accounts', () => {
  it('every engagement operation needs an Account: a guest is refused locally and nothing is sent', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    const before = world.handle.opLog.length;
    for (const [op, input] of [
      ['scene.like.set', { sceneRef: SCENE, liked: true }],
      ['scene.save.set', { sceneRef: SCENE, saved: true }],
      ['product.save.set', { productRef: 'fx_product_demo_1', saved: true }],
      ['seller.follow.set', { sellerRef: 'fx_seller_demo_alem', following: true }],
      ['saved.list.get', {}],
      ['collections.list.get', {}],
      ['collection.create', { name: 'x' }],
    ] as const) {
      await expect(runtime.session.call(op, input as never)).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    }
    expect(world.handle.opLog).toHaveLength(before);
  });

  it('two Accounts never see each other: state, Saved and Collections are per Account', async () => {
    const world = createFixtureTransport();
    const a = await signedIn(world, 'second');
    const b = await signedIn(world, 'revoked');
    await a.session.call('scene.save.set', { sceneRef: SCENE, saved: true });
    await a.session.call('collection.create', { name: 'Gifts' });
    expect((await a.session.call('saved.list.get', {})).scenes.map((s) => s.sceneRef)).toEqual([SCENE]);
    expect((await b.session.call('saved.list.get', {})).scenes).toEqual([]);
    expect((await b.session.call('collections.list.get', {})).collections).toEqual([]);
    expect((await a.session.call('collections.list.get', {})).collections.map((c) => c.name)).toEqual(['Gifts']);
  });

  it('a new sign-in on the same device starts from the new Account, with nothing of the last one left in memory', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, phone('second'));
    await settle();
    await runtime.session.call('scene.like.set', { sceneRef: SCENE, liked: true });
    await signIn(runtime, phone('revoked'));
    await settle();
    const state = await runtime.session.call('engagement.state.get', { sceneRefs: [SCENE], productRefs: [], sellerRefs: [] });
    expect(state.scenes[SCENE]).toEqual({ liked: false, saved: false });
  });

  it('a Scene withdrawn after it was saved is simply absent from Saved: the server decides what is public', async () => {
    const world = createFixtureTransport();
    const runtime = await signedIn(world, 'second');
    await runtime.session.call('scene.save.set', { sceneRef: SCENE, saved: true });
    world.handle.withdraw(SCENE);
    expect((await runtime.session.call('saved.list.get', {})).scenes).toEqual([]);
  });

  it('Following reflects a Follow just made, and Unfollow removes it', async () => {
    const runtime = await signedIn(createFixtureTransport(), 'second');
    expect((await runtime.session.call('feed.following.page', { cursor: null })).items).toEqual([]);
    await runtime.session.call('seller.follow.set', { sellerRef: 'fx_seller_demo_alem', following: true });
    expect((await runtime.session.call('feed.following.page', { cursor: null })).items.every((s) => s.seller.sellerRef === 'fx_seller_demo_alem')).toBe(true);
    await runtime.session.call('seller.follow.set', { sellerRef: 'fx_seller_demo_alem', following: false });
    expect((await runtime.session.call('feed.following.page', { cursor: null })).items).toEqual([]);
  });
});

describe('Collections', () => {
  it('creates and lists private Collections, and refuses an empty name without inventing a limit', async () => {
    const runtime = await signedIn(createFixtureTransport(), 'second');
    await expect(runtime.session.call('collection.create', { name: '   ' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    const { collection } = await runtime.session.call('collection.create', { name: '  Wishlist ' });
    expect(collection.name).toBe('Wishlist');
    expect((await runtime.session.call('collections.list.get', {})).collections).toEqual([collection]);
  });
});

describe('product rules, as absences', () => {
  it('has no Product Like operation: Likes apply to Scenes only', () => {
    const likeOps = Object.keys(OP_SPECS).filter((op) => /like/i.test(op));
    expect(likeOps).toEqual(['scene.like.set']);
  });

  it('every write is a named, authorised fixture write and is Account-bound', () => {
    for (const op of ['scene.like.set', 'scene.save.set', 'product.save.set', 'seller.follow.set', 'collection.create'] as const) {
      expect(OP_SPECS[op]).toMatchObject({ access: 'AUTHENTICATED', fixture: 'SERVED_WRITE', writeAuthorisedBy: 'MOB-FE-03' });
    }
  });

  it('no engagement payload carries a count, a "liked by" list, a comment or a share target', async () => {
    const runtime = await signedIn(createFixtureTransport(), 'second');
    await runtime.session.call('scene.like.set', { sceneRef: SCENE, liked: true });
    const payloads = [
      await runtime.session.call('engagement.state.get', { sceneRefs: [SCENE], productRefs: ['fx_product_demo_1'], sellerRefs: ['fx_seller_demo_alem'] }),
      await runtime.session.call('saved.list.get', {}),
      await runtime.session.call('collections.list.get', {}),
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
    expect([...keys].filter((k) => /count|total|likedBy|likers|comment|share|followers|views/i.test(k))).toEqual([]);
  });
});

describe('write bookkeeping', () => {
  it('identifies one control by what it changes, not by the state it is asking for', () => {
    const on = writeKey({ op: 'scene.like.set', input: { sceneRef: SCENE, liked: true } });
    const off = writeKey({ op: 'scene.like.set', input: { sceneRef: SCENE, liked: false } });
    expect(on).toBe(off);
    expect(on).not.toBe(writeKey({ op: 'scene.save.set', input: { sceneRef: SCENE, saved: true } }));
  });
});
