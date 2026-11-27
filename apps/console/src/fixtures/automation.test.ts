import { describe, expect, it } from 'vitest';
import { TransportError } from '../transport/port';
import { createWorld, DEMO_CODES, PERSONAS, type World } from './world';

function setup(): World {
  return createWorld({ now: () => Date.UTC(2026, 10, 27, 9, 0, 0), latencyMs: 0 });
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
const baseSave = { returns_acceptance: 'ACCEPTED' as const, returns_window_days: 7, returns_conditions: 'Unworn.', warranty: '', guidance: '' };

describe('SC-FE-08 scripted assistance: permissions follow the AUTH-02 canonical chatbot codes', () => {
  it('Owner, Admin and Campaign Manager configure and test; Sales Support only reads; Inventory and Analyst are denied', async () => {
    const world = setup();
    for (const who of ['fx_acct_owner', 'fx_acct_admin', 'fx_acct_campaign']) {
      await signIn(world, who);
      expect((await world.handle('automation.overview.get', {}, ALEM)).allowed_actions).toEqual(['CONFIGURE', 'TEST']);
    }
    await signIn(world, 'fx_acct_sales');
    const read = await world.handle('automation.overview.get', {}, ALEM);
    expect(read.allowed_actions).toEqual([]);
    expect(read.aggregates).toBeNull(); // no seller.chatbot:analytics_read
    expect((await failure(world.handle('automation.test.run', { question: 'hi', product_id: null }, ALEM))).code).toBe('PERMISSION_DENIED');
    expect((await failure(world.handle('automation.knowledge.save', { version: 1, ...baseSave }, ALEM))).code).toBe('PERMISSION_DENIED');
    for (const who of ['fx_acct_inventory', 'fx_acct_analyst']) {
      await signIn(world, who);
      expect((await failure(world.handle('automation.overview.get', {}, ALEM))).code).toBe('PERMISSION_DENIED');
    }
  });

  it('configuration does not grant the Inbox: the Campaign Manager configures but reads no conversation', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_campaign');
    await world.handle('automation.knowledge.get', {}, ALEM);
    expect((await failure(world.handle('inbox.list', { cursor: null }, ALEM))).code).toBe('PERMISSION_DENIED');
  });

  it('a safety-suspended Seller has no scripted assistance at all', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_states');
    expect((await failure(world.handle('automation.overview.get', {}, { sellerId: 'fx_seller_gelila' }))).code).toBe('PERMISSION_DENIED');
  });
});

describe('SC-FE-08 scripted assistance: explainable readiness, versioned knowledge', () => {
  it('reports what is missing, per group and per intent, and never a score', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const o = await world.handle('automation.overview.get', {}, ALEM);
    expect(o.readiness).toEqual([
      { code: 'SELLER_POLICY', state: 'INCOMPLETE', missing: ['WARRANTY'] },
      { code: 'CATEGORY_KNOWLEDGE', state: 'NOT_DEFINED', missing: [] },
    ]);
    expect(o.intents.map((i) => [i.code, i.coverage])).toEqual([
      ['PRODUCT_AVAILABILITY', 'READY'],
      ['RETURNS_POLICY', 'READY'],
      ['WARRANTY_AFTER_SALES', 'MISSING_INFORMATION'],
    ]);
    expect(o.intents.every((i) => i.template.provisional)).toBe(true);
    // Not live: figures are UNAVAILABLE, never zero.
    expect(o.aggregates).toMatchObject({ handled: { state: 'UNAVAILABLE' }, escalated: { state: 'UNAVAILABLE' }, unmatched: null });
  });

  it('a save creates a new version, keeps history, refuses a stale version and an invalid window', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const v1 = await world.handle('automation.knowledge.get', {}, ALEM);
    expect(v1.owned_elsewhere).toEqual(['PRICE', 'STOCK', 'STORE_PROFILE', 'OPENING_HOURS', 'FULFILMENT']);
    const bad = await failure(world.handle('automation.knowledge.save', { version: 1, ...baseSave, returns_window_days: 0 }, ALEM));
    expect(bad.fields).toEqual({ returns_window_days: 'RETURNS_WINDOW_INVALID' });
    const v2 = await world.handle('automation.knowledge.save', { version: 1, ...baseSave, warranty: 'Six months on stitching.' }, ALEM);
    expect(v2.knowledge.version).toBe(2);
    expect((await failure(world.handle('automation.knowledge.save', { version: 1, ...baseSave }, ALEM))).code).toBe('CONFLICT');
    const o = await world.handle('automation.overview.get', {}, ALEM);
    expect(o.history.map((h) => h.version)).toEqual([2, 1]);
    expect(o.readiness[0]).toEqual({ code: 'SELLER_POLICY', state: 'COMPLETE', missing: [] });
  });
});

describe('SC-FE-08 scripted assistance: the deterministic test simulator', () => {
  it('answers from an approved template filled from the owner of each fact, and shows how it decided', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const stock = await world.handle('automation.test.run', { question: 'Is this still available?', product_id: 'fx_prod_alem_3' }, ALEM);
    expect(stock).toMatchObject({ test_only: true, outcome: 'ANSWERED', intent: { code: 'PRODUCT_AVAILABILITY' }, answer: 'This Product is not available right now.' });
    expect(stock.path.map((s) => s.layer)).toEqual(['LANGUAGE_CHECK', 'STRUCTURED_CONTEXT', 'EXACT_KEYWORD', 'TEMPLATE', 'SLOT']);
    const returns = await world.handle('automation.test.run', { question: 'Can I return it?', product_id: null }, ALEM);
    expect(returns.answer).toBe('Returns and exchanges are accepted within 7 days. Unworn, with the label attached.');
  });

  it('never guesses: a missing Product, missing policy, an unknown question and other languages all go to a person', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    expect(await world.handle('automation.test.run', { question: 'Is it in stock?', product_id: null }, ALEM)).toMatchObject({ outcome: 'MISSING_INFORMATION', missing: ['PRODUCT_CONTEXT'], answer: null });
    expect(await world.handle('automation.test.run', { question: 'Any warranty?', product_id: null }, ALEM)).toMatchObject({ outcome: 'MISSING_INFORMATION', missing: ['WARRANTY'], answer: null });
    expect(await world.handle('automation.test.run', { question: 'Where are you located?', product_id: null }, ALEM)).toMatchObject({ outcome: 'NO_MATCH', answer: null });
    const amharic = String.fromCharCode(0x12ed, 0x1205, 0x20, 0x12a0, 0x1208, 0x3f);
    const other = await world.handle('automation.test.run', { question: amharic, product_id: null }, ALEM);
    expect(other).toMatchObject({ outcome: 'WAITING_FOR_HUMAN', intent: null, answer: null });
    expect(other.path.map((s) => s.layer)).toEqual(['LANGUAGE_CHECK', 'HUMAN_ESCALATION']);
  });

  it('a test leaves no trace: no conversation, no message, no count', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const before = (await world.handle('inbox.list', { cursor: null }, ALEM)).items.map((c) => c.last_at);
    await world.handle('automation.test.run', { question: 'Is this still available?', product_id: 'fx_prod_alem_1' }, ALEM);
    expect((await world.handle('inbox.list', { cursor: null }, ALEM)).items.map((c) => c.last_at)).toEqual(before);
    expect((await world.handle('automation.overview.get', {}, ALEM)).aggregates?.handled).toEqual({ state: 'UNAVAILABLE' });
  });

  it('serves no generated, payment or paid-status wording in any template answer', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    await world.handle('automation.knowledge.save', { version: 1, ...baseSave, warranty: 'Six months on stitching.' }, ALEM);
    const answers: string[] = [];
    for (const q of ['Is this still available?', 'Can I return it?', 'Any warranty?']) {
      answers.push((await world.handle('automation.test.run', { question: q, product_id: 'fx_prod_alem_1' }, ALEM)).answer ?? '');
    }
    expect(answers.join(' ')).not.toMatch(/\b(paid|payment|order|refund|receipt|delivered)\b/i);
  });
});
