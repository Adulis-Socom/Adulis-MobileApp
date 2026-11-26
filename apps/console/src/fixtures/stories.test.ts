import { describe, expect, it } from 'vitest';
import type { OpInput } from '../contracts/gap-sc';
import { TransportError } from '../transport/port';
import { STORY_LIFETIME_MS } from './content';
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
const stories = (world: World) => world.handle('stories.list', {}, ALEM);
const create = (world: World, input: Partial<OpInput<'stories.create'>> = {}) => world.handle('stories.create', { photo_name: 'a.jpg', content_type: 'image/jpeg', text: null, target: null, ...input }, ALEM);
const HOUR = 3_600_000;

describe('SC-FE-05S fixture Stories: the server authors the lifetime and the effective visibility', () => {
  it('lists every state, with the 24-hour end time authored by the server and public computed, never stored', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const items = (await stories(world)).items;
    const by = (n: number) => items.find((s) => s.id === `fx_story_alem_${n}`);
    expect(items).toHaveLength(6);
    expect(by(1)).toMatchObject({ state: 'PUBLISHED', public: true, not_public_reason: null, target: { kind: 'PRODUCT', label: 'Canvas backpack' } });
    expect(by(2)).toMatchObject({ state: 'PUBLISHED', public: true, target: null, text: null });
    expect(by(3)).toMatchObject({ state: 'EXPIRED', public: false, not_public_reason: 'EXPIRED', allowed_actions: [] });
    expect(by(4)).toMatchObject({ state: 'WITHDRAWN', public: false, not_public_reason: 'WITHDRAWN', allowed_actions: [] });
    expect(by(5)).toMatchObject({ state: 'PUBLISHED', public: false, not_public_reason: 'TARGET_NOT_ELIGIBLE', target: { kind: 'SCENE' } });
    expect(by(6)).toMatchObject({ state: 'RESTRICTED', public: false, moderation: { state: 'RESTRICTED' } });
    for (const s of items) expect(Date.parse(s.expires_at) - Date.parse(s.published_at)).toBe(STORY_LIFETIME_MS);
  });

  it('is public at 23:59:59 and not public at 24:00:00, with no job involved', async () => {
    const { world, advance } = setup();
    await signIn(world, 'fx_acct_owner');
    const made = await create(world, { text: 'Today only' });
    expect(made).toMatchObject({ state: 'PUBLISHED', public: true });
    advance(STORY_LIFETIME_MS - 1000);
    let now = (await stories(world)).items.find((s) => s.id === made.id);
    expect(now).toMatchObject({ state: 'PUBLISHED', public: true });
    advance(1000);
    now = (await stories(world)).items.find((s) => s.id === made.id);
    expect(now).toMatchObject({ state: 'EXPIRED', public: false, not_public_reason: 'EXPIRED', allowed_actions: [] });
    expect((await failure(world.handle('stories.withdraw', { story_id: made.id, version: made.version }, ALEM))).code).toBe('CONFLICT');
  });

  it('an eligibility reversal suppresses a Story and its return restores it, but nothing resurrects an expired one', async () => {
    const { world, advance } = setup();
    await signIn(world, 'fx_acct_owner');
    const story = async () => (await stories(world)).items.find((s) => s.id === 'fx_story_alem_5');
    expect((await story())?.public).toBe(false); // linked Scene is Private
    const v = (await world.handle('products.get', { product_id: 'fx_prod_alem_3' }, ALEM)).variants[0];
    await world.handle('inventory.set', { variant_id: v?.id ?? '', stock_version: v?.stock_version ?? 0, quantity: 5 }, ALEM); // Scene turns Public
    expect(await story()).toMatchObject({ public: true, not_public_reason: null });
    // restored while inside its lifetime, then the lifetime passes (published 1h before the clock started): eligibility cannot bring it back
    advance(STORY_LIFETIME_MS);
    expect(await story()).toMatchObject({ state: 'EXPIRED', public: false, not_public_reason: 'EXPIRED' });
  });

  it('the fixture clock hook moves past the lifetime for tests that cannot wait', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    expect((await stories(world)).items.find((s) => s.id === 'fx_story_alem_1')?.public).toBe(true);
    world.hooks.skewClock(25 * HOUR);
    expect((await stories(world)).items.find((s) => s.id === 'fx_story_alem_1')).toMatchObject({ state: 'EXPIRED', public: false });
  });
});

describe('SC-FE-05S fixture Stories: exactly one photo, optional text, zero or one eligible same-Seller link', () => {
  it('creates a Story with no link, and blank text is no text', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const made = await create(world, { text: '   ' });
    expect(made).toMatchObject({ target: null, text: null, state: 'PUBLISHED', public: true, version: 1 });
    expect(made.allowed_actions).toEqual(['WITHDRAW']);
    expect(made.id.startsWith('fx_')).toBe(true);
  });

  it('accepts exactly one photo: a file that is not an image, or no file, is refused by the server', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    expect((await failure(create(world, { content_type: 'video/mp4' }))).fields['photo']).toBe('MEDIA_REJECTED');
    expect((await failure(create(world, { photo_name: ' ' }))).fields['photo']).toBe('MEDIA_FILE_REQUIRED');
  });

  it('links only to an eligible Product or Scene of the same Seller; anything else is just "not eligible"', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    expect((await create(world, { target: { kind: 'PRODUCT', id: 'fx_prod_alem_1' } })).target).toMatchObject({ kind: 'PRODUCT', label: 'Linen wrap dress' });
    expect((await create(world, { target: { kind: 'SCENE', id: 'fx_scene_alem_1' } })).target).toMatchObject({ kind: 'SCENE' });
    const rejected = [
      { kind: 'PRODUCT', id: 'fx_prod_alem_3' }, // published but out of stock: fail closed
      { kind: 'PRODUCT', id: 'fx_prod_alem_7' }, // withdrawn
      { kind: 'PRODUCT', id: 'fx_prod_dawit_1' }, // another Seller
      { kind: 'SCENE', id: 'fx_scene_alem_2' }, // Private
      { kind: 'SCENE', id: 'fx_scene_alem_3' }, // draft
    ] as const;
    for (const target of rejected) expect((await failure(create(world, { target }))).fields['target']).toBe('TARGET_NOT_ELIGIBLE');
  });

  it('offers as targets only what it would accept', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const t = await world.handle('stories.targets.get', {}, ALEM);
    expect(t.products.map((p) => p.label).sort()).toEqual(['Canvas backpack', 'Cotton shirt dress', 'Linen wrap dress']);
    expect(t.scenes.map((s) => s.id)).toEqual(['fx_scene_alem_1']);
  });

  it('idempotency: the same key publishes one Story', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const input = { photo_name: 'a.jpg', content_type: 'image/jpeg', text: null, target: null } as const;
    const a = await world.handle('stories.create', input, { ...ALEM, idempotencyKey: 'k-story' });
    const b = await world.handle('stories.create', input, { ...ALEM, idempotencyKey: 'k-story' });
    expect(b.id).toBe(a.id);
    expect((await stories(world)).items).toHaveLength(7);
  });
});

describe('SC-FE-05S fixture Stories: withdrawal and who may act', () => {
  it('withdraws once, finally; a stale version and a second withdrawal are conflicts', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const s = (await stories(world)).items.find((x) => x.id === 'fx_story_alem_2');
    expect((await failure(world.handle('stories.withdraw', { story_id: 'fx_story_alem_2', version: 9 }, ALEM))).code).toBe('CONFLICT');
    const done = await world.handle('stories.withdraw', { story_id: 'fx_story_alem_2', version: s?.version ?? 0 }, ALEM);
    expect(done).toMatchObject({ state: 'WITHDRAWN', public: false, not_public_reason: 'WITHDRAWN', allowed_actions: [] });
    expect((await failure(world.handle('stories.withdraw', { story_id: 'fx_story_alem_2', version: done.version }, ALEM))).code).toBe('CONFLICT');
  });

  it('Campaign Manager may post and withdraw; Inventory and Sales Support have no Content area; no Story of another Seller is reachable', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_campaign');
    expect((await stories(world)).allowed_actions).toEqual(['CREATE']);
    expect((await create(world)).state).toBe('PUBLISHED');
    await signIn(world, 'fx_acct_inventory');
    expect((await failure(stories(world))).code).toBe('PERMISSION_DENIED');
    await signIn(world, 'fx_acct_sales');
    expect((await failure(create(world))).code).toBe('PERMISSION_DENIED');
    await signIn(world, 'fx_acct_owner');
    expect((await failure(world.handle('stories.withdraw', { story_id: 'fx_story_alem_1', version: 1 }, { sellerId: 'fx_seller_biruk' }))).code).toBe('NOT_FOUND');
  });
});
