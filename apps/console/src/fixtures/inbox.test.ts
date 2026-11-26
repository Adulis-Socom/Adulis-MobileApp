import { describe, expect, it } from 'vitest';
import { TransportError } from '../transport/port';
import { createWorld, DEMO_CODES, PERSONAS, type World } from './world';

function setup(): { world: World } {
  const clock = Date.UTC(2026, 10, 26, 9, 0, 0);
  return { world: createWorld({ now: () => clock, latencyMs: 0 }) };
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

describe('SC-FE-08 fixture Inbox: list, thread, isolation', () => {
  it('lists newest first in cursor pages, with unread counts and the waiting state resolved by the server', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const first = await world.handle('inbox.list', { cursor: null }, ALEM);
    expect(first.items.map((c) => c.id)).toEqual(['fx_conv_alem_2', 'fx_conv_alem_1', 'fx_conv_alem_3', 'fx_conv_alem_4']);
    expect(first.next_cursor).not.toBeNull();
    expect(first.items[0]).toMatchObject({ unread_count: 2, state: 'WAITING_FOR_HUMAN' });
    expect(first.items[1]).toMatchObject({ unread_count: 1, state: 'OPEN' });
    const second = await world.handle('inbox.list', { cursor: first.next_cursor }, ALEM);
    expect(second.items.map((c) => c.id)).toEqual(['fx_conv_alem_5']);
    expect(second.next_cursor).toBeNull();
  });

  it('marks automated replies as automated and provisional, and keeps a system note apart from a human sender', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const t = await world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_2' }, ALEM);
    const auto = t.messages.find((m) => m.sender === 'AUTOMATED');
    expect(auto?.automation).toEqual({ template_label: 'Provisional demonstration template', provisional: true });
    expect(auto?.actor_label).toBeNull();
    expect(t.messages.find((m) => m.sender === 'SYSTEM')?.automation).toBeNull();
    expect(t.messages.filter((m) => m.sender === 'SELLER_TEAM')).toHaveLength(0);
  });

  it('resolves only accessibility on every read: a Scene that is no longer public is an unavailable reference, never newer content', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const t = await world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_3' }, ALEM);
    // Scene 6's only Product is withdrawn, so the Scene is Private now; the message keeps its snapshot label and says it is unavailable.
    expect(t.messages[0]?.subject).toEqual({ kind: 'SCENE', ref: 'fx_scene_alem_6', revision: 1, label: 'The old kaftan, styled two ways', available: false });
    expect(t.messages[0]?.source).toBeNull();
    const live = await world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_1' }, ALEM);
    // ONE subject (the Product); the Scene is provenance, not a second subject (CHAT S4).
    expect(live.messages[0]?.subject).toEqual({ kind: 'PRODUCT', ref: 'fx_prod_alem_1', label: 'Linen wrap dress' });
    expect(live.messages[0]?.source).toMatchObject({ ref: 'fx_scene_alem_1', revision: 1, available: true });
  });

  it('never shows one Seller another Seller\'s conversation, and a foreign id is the same not-found as a missing one', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    expect((await world.handle('inbox.list', { cursor: null }, BIRUK)).items.map((c) => c.id)).toEqual(['fx_conv_biruk_1']);
    const foreign = await failure(world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_1' }, BIRUK));
    const missing = await failure(world.handle('inbox.thread.get', { conversation_id: 'fx_conv_nothing' }, BIRUK));
    expect(foreign).toMatchObject({ code: 'NOT_FOUND', detail: 'CONVERSATION_NOT_FOUND' });
    expect(missing).toMatchObject({ code: foreign.code, detail: foreign.detail });
    const reply = await failure(world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_1', body: 'hello', scene_id: null, scene_revision: null, product_id: null }, BIRUK));
    expect(reply.code).toBe('NOT_FOUND');
  });
});

describe('SC-FE-08 fixture Inbox: the shared Seller read mark is a monotonic high-water (CHAT S10)', () => {
  it('marks up to the highest message shown, idempotently, and never backwards', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const t = await world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_2' }, ALEM);
    const ids = t.messages.map((m) => m.id);
    const last = ids[ids.length - 1] ?? '';
    expect((await world.handle('inbox.read.mark', { conversation_id: 'fx_conv_alem_2', last_read_message_id: ids[0] ?? '' }, ALEM)).unread_count).toBe(1);
    expect((await world.handle('inbox.read.mark', { conversation_id: 'fx_conv_alem_2', last_read_message_id: last }, ALEM)).unread_count).toBe(0);
    expect((await world.handle('inbox.read.mark', { conversation_id: 'fx_conv_alem_2', last_read_message_id: last }, ALEM)).unread_count).toBe(0);
    // A lower mark sent late (an older screen) does not move it back.
    expect((await world.handle('inbox.read.mark', { conversation_id: 'fx_conv_alem_2', last_read_message_id: ids[0] ?? '' }, ALEM)).unread_count).toBe(0);
  });

  it('does not mark a Buyer message that arrived after the screen was loaded', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const t = await world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_4' }, ALEM);
    const shown = t.messages[t.messages.length - 1]?.id ?? '';
    expect(world.hooks.buyerMessage('fx_seller_alem', 'fx_conv_alem_4', 'Are you open on Sunday?')).toBe(true);
    const marked = await world.handle('inbox.read.mark', { conversation_id: 'fx_conv_alem_4', last_read_message_id: shown }, ALEM);
    expect(marked.unread_count).toBe(1);
  });

  it('is one mark for the whole Seller team, and a message id from elsewhere is refused', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_sales');
    const t = await world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_2' }, ALEM);
    await world.handle('inbox.read.mark', { conversation_id: 'fx_conv_alem_2', last_read_message_id: t.messages[t.messages.length - 1]?.id ?? '' }, ALEM);
    await signIn(world, 'fx_acct_owner');
    expect((await world.handle('inbox.list', { cursor: null }, ALEM)).items.find((c) => c.id === 'fx_conv_alem_2')?.unread_count).toBe(0);
    const foreign = await failure(world.handle('inbox.read.mark', { conversation_id: 'fx_conv_alem_2', last_read_message_id: 'fx_msg_biruk_1' }, ALEM));
    expect(foreign.fields).toEqual({ last_read_message_id: 'MESSAGE_NOT_IN_CONVERSATION' });
  });
});

describe('SC-FE-08 fixture Inbox: permissions (AUTH-02 seller.inbox:read and :reply)', () => {
  it('lets Sales Support read and reply, and Admin too', async () => {
    const { world } = setup();
    for (const who of ['fx_acct_sales', 'fx_acct_admin']) {
      await signIn(world, who);
      const t = await world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_4' }, ALEM);
      expect(t.allowed_actions).toEqual(['REPLY']);
    }
  });
  it('refuses Inventory, Analyst and Campaign Manager every Inbox call, with a denial that names nothing', async () => {
    const { world } = setup();
    for (const who of ['fx_acct_inventory', 'fx_acct_analyst', 'fx_acct_campaign']) {
      await signIn(world, who);
      expect((await failure(world.handle('inbox.list', { cursor: null }, ALEM))).code).toBe('PERMISSION_DENIED');
      expect((await failure(world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_1' }, ALEM))).code).toBe('PERMISSION_DENIED');
      expect((await failure(world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_1', body: 'hi', scene_id: null, scene_revision: null, product_id: null }, ALEM))).code).toBe('PERMISSION_DENIED');
    }
  });
});

describe('SC-FE-08 fixture Inbox: context rules (CHAT S4-S5) and sending', () => {
  it('lists the full eligible catalogue with no Scene, and only the Products tagged in the Scene with one', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const all = await world.handle('inbox.context.get', { scene_id: null }, ALEM);
    const inScene = await world.handle('inbox.context.get', { scene_id: 'fx_scene_alem_1' }, ALEM);
    expect(all.products.length).toBeGreaterThan(inScene.products.length);
    expect(inScene.products.map((p) => p.label).sort()).toEqual(['Cotton shirt dress', 'Linen wrap dress']);
    // a private, draft, removed or restricted Scene is not newly selectable
    expect(all.scenes.some((s) => s.id === 'fx_scene_alem_6')).toBe(false);
    expect((await failure(world.handle('inbox.context.get', { scene_id: 'fx_scene_alem_6' }, ALEM))).fields).toEqual({ scene: 'MESSAGE_SCENE_POST_INVALID' });
    expect(all.scenes.find((s) => s.id === 'fx_scene_alem_1')?.revision).toBeGreaterThan(0);
  });

  it('refuses with the CHAT S15 codes: an empty message, a Product not in the Scene revision, a Scene that is not public, a half-given Scene', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const rev = (await world.handle('inbox.context.get', { scene_id: null }, ALEM)).scenes.find((s) => s.id === 'fx_scene_alem_1')?.revision ?? 0;
    const e1 = await failure(world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_4', body: '   ', scene_id: 'fx_scene_alem_1', scene_revision: rev, product_id: 'fx_prod_alem_3' }, ALEM));
    expect(e1.fields).toEqual({ body: 'MESSAGE_EMPTY', product: 'MESSAGE_PRODUCT_NOT_IN_SCENE_POST' });
    const e2 = await failure(world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_4', body: 'hi', scene_id: 'fx_scene_alem_6', scene_revision: 1, product_id: null }, ALEM));
    expect(e2.fields).toEqual({ scene: 'MESSAGE_SCENE_POST_INVALID' });
    const e3 = await failure(world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_4', body: 'hi', scene_id: 'fx_scene_alem_1', scene_revision: null, product_id: null }, ALEM));
    expect(e3.fields).toEqual({ scene: 'MESSAGE_CONTEXT_CONFLICT' });
    const e4 = await failure(world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_4', body: 'hi', scene_id: null, scene_revision: null, product_id: 'fx_prod_alem_6' }, ALEM));
    expect(e4.fields).toEqual({ product: 'MESSAGE_PRODUCT_POST_INVALID' }); // a draft Product
    const e5 = await failure(world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_4', body: 'hi', scene_id: 'fx_scene_alem_1', scene_revision: rev + 50, product_id: null }, ALEM));
    expect(e5.fields).toEqual({ scene: 'MESSAGE_SCENE_POST_INVALID' }); // a revision never offered
    expect((await world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_4' }, ALEM)).messages).toHaveLength(1); // nothing was sent
  });

  it('checks membership against the EXACT revision the composer offered, and the next revision on its own terms', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const offered = (await world.handle('inbox.context.get', { scene_id: 'fx_scene_alem_1' }, ALEM));
    const rev = offered.scenes.find((s) => s.id === 'fx_scene_alem_1')?.revision ?? 0;
    expect(offered.products.map((p) => p.id)).toContain('fx_prod_alem_2');
    // The Seller edits the Scene: Product 2 is untagged in the new revision.
    const scene = await world.handle('scenes.get', { scene_id: 'fx_scene_alem_1' }, ALEM);
    const kept = scene.tags.filter((x) => x.product_id !== 'fx_prod_alem_2').map((x) => ({ product_id: x.product_id, hotspots: x.hotspots.map((h) => ({ x_norm: h.x_norm, y_norm: h.y_norm })) }));
    await world.handle('scenes.update', { scene_id: 'fx_scene_alem_1', version: scene.version, tags: kept }, ALEM);
    // Composed on the old revision, where Product 2 WAS tagged: accepted, and the message records that revision.
    const ok = await world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_4', body: 'This one.', scene_id: 'fx_scene_alem_1', scene_revision: rev, product_id: 'fx_prod_alem_2' }, ALEM);
    expect(ok.messages[ok.messages.length - 1]?.source).toMatchObject({ ref: 'fx_scene_alem_1', revision: rev });
    // On the new revision it is not tagged.
    const now = (await world.handle('inbox.context.get', { scene_id: null }, ALEM)).scenes.find((s) => s.id === 'fx_scene_alem_1')?.revision ?? 0;
    expect(now).toBeGreaterThan(rev);
    const refused = await failure(world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_4', body: 'This one.', scene_id: 'fx_scene_alem_1', scene_revision: now, product_id: 'fx_prod_alem_2' }, ALEM));
    expect(refused.fields).toEqual({ product: 'MESSAGE_PRODUCT_NOT_IN_SCENE_POST' });
  });

  it('keeps the display snapshot of a sent message when the Product is renamed later', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    await world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_4', body: 'Try this.', scene_id: null, scene_revision: null, product_id: 'fx_prod_alem_4' }, ALEM);
    const product = await world.handle('products.get', { product_id: 'fx_prod_alem_4' }, ALEM);
    await world.handle('products.update', { product_id: 'fx_prod_alem_4', version: product.version, title: 'Renamed backpack' }, ALEM);
    const t = await world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_4' }, ALEM);
    expect(t.messages[t.messages.length - 1]?.subject).toEqual({ kind: 'PRODUCT', ref: 'fx_prod_alem_4', label: 'Canvas backpack' });
  });

  it('a human reply continues the SAME thread, takes it back from automation, and carries its own subject', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const next = await world.handle('inbox.reply.send', { conversation_id: 'fx_conv_alem_2', body: ' It comes in black. ', scene_id: null, scene_revision: null, product_id: 'fx_prod_alem_3' }, ALEM);
    expect(next.state).toBe('OPEN');
    const sent = next.messages[next.messages.length - 1];
    expect(sent).toMatchObject({ sender: 'SELLER_TEAM', body: 'It comes in black.', subject: { kind: 'PRODUCT', label: 'Silk slip dress' }, source: null });
    // The reply does not move the read mark; the Console marks the highest message it shows.
    await world.handle('inbox.read.mark', { conversation_id: 'fx_conv_alem_2', last_read_message_id: sent?.id ?? '' }, ALEM);
    expect((await world.handle('inbox.list', { cursor: null }, ALEM)).items.find((c) => c.id === 'fx_conv_alem_2')?.unread_count).toBe(0);
  });

  it('a lost response and a retry with the same key make ONE message; a changed body under the same key is refused', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const input = { conversation_id: 'fx_conv_alem_4', body: 'Yes, come in any day.', scene_id: null, scene_revision: null, product_id: null };
    await world.handle('inbox.reply.send', input, { ...ALEM, idempotencyKey: 'm1' });
    await world.handle('inbox.reply.send', input, { ...ALEM, idempotencyKey: 'm1' });
    expect((await world.handle('inbox.thread.get', { conversation_id: 'fx_conv_alem_4' }, ALEM)).messages).toHaveLength(2);
    const reused = await failure(world.handle('inbox.reply.send', { ...input, body: 'A different message.' }, { ...ALEM, idempotencyKey: 'm1' }));
    expect(reused).toMatchObject({ code: 'CONFLICT', detail: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('serves no Order context, no generated text and no payment wording anywhere in its data', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const bodies: string[] = [];
    for (const id of ['fx_conv_alem_1', 'fx_conv_alem_2', 'fx_conv_alem_3', 'fx_conv_alem_4', 'fx_conv_alem_5']) {
      for (const m of (await world.handle('inbox.thread.get', { conversation_id: id }, ALEM)).messages) bodies.push(m.body, m.automation?.template_label ?? '');
    }
    expect(bodies.join(' ')).not.toMatch(/\b(order|payment|paid|refund|price|birr|ETB|warranty)\b/i);
  });
});
