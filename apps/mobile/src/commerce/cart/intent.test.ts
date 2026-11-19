import type { components } from '@adulis/api-client';

import { KEY_SAFE_MS } from '../../api/mutation';
import {
  IDLE,
  IDLE_UNCONFIRMED,
  isPending,
  reduceAdd,
  toAddIntent,
  type AddIntent,
  type AddState,
} from './intent';
import { asLineId, asVariantId, type VariantId } from './model';
import type { AddJudgement } from './outcome';

const V1 = asVariantId('de000000-0000-4000-8000-000000000001');
const NOW = 5_000_000;

const begin = (
  state: AddState = IDLE,
  over: Partial<{ quantity: number; key: string; now: number; online: boolean }> = {},
) =>
  reduceAdd(state, {
    type: 'BEGIN',
    variantId: V1,
    quantity: 2,
    key: 'key-1',
    now: NOW,
    online: true,
    ...over,
  });
const intentOf = (state: AddState): AddIntent => {
  if (!('intent' in state)) throw new Error(`no intent in ${state.kind}`);
  return state.intent;
};
const failed = (state: AddState, judgement: AddJudgement, now = NOW + 10) =>
  reduceAdd(state, { type: 'FAILED', judgement, now });
const UNKNOWN_J: AddJudgement = { outcome: 'unknown', replay: true, holdMs: null };

describe('beginning an add', () => {
  it('sends when the device is online: one intent with its key, quantity and start time fixed', () => {
    const state = begin();
    expect(state).toEqual({
      kind: 'SENDING',
      intent: { variantId: V1, quantity: 2, key: 'key-1', startedAt: NOW, attempts: 1 },
    });
  });

  it('sends nothing when the device is known to be offline, and queues nothing', () => {
    const state = begin(IDLE, { online: false });
    expect(state.kind).toBe('OFFLINE_NOT_SENT');
    expect(intentOf(state).attempts).toBe(0);
  });

  it('returns the very same state for a second begin while one is pending (a double tap is one add)', () => {
    const sending = begin();
    expect(begin(sending, { key: 'key-2' })).toBe(sending);
    const unknown = failed(sending, UNKNOWN_J);
    expect(begin(unknown, { key: 'key-2' })).toBe(unknown);
    const offline = begin(IDLE, { online: false });
    expect(begin(offline, { key: 'key-2' })).toBe(offline);
  });

  it('does not begin over an add that could not be resolved: only dismissing it starts over', () => {
    const unresolved = failed(begin(), { outcome: 'unknown', replay: false, holdMs: null });
    expect(unresolved.kind).toBe('UNRESOLVED');
    expect(begin(unresolved, { key: 'key-2' })).toBe(unresolved);
    const dismissed = reduceAdd(unresolved, { type: 'DISMISS' });
    expect(dismissed).toBe(IDLE_UNCONFIRMED);
    expect(intentOf(begin(dismissed, { key: 'key-2' })).key).toBe('key-2');
  });

  it('starts a NEW intent with a new key after an add that ended', () => {
    const added = reduceAdd(begin(), { type: 'ACCEPTED', lineId: asLineId('l1') });
    expect(intentOf(begin(added, { key: 'key-2' })).key).toBe('key-2');
    const refused = failed(begin(), {
      outcome: 'refused',
      reload: false,
      code: 'NOT_FOUND',
      holdMs: null,
    });
    expect(intentOf(begin(refused, { key: 'key-3' })).key).toBe('key-3');
  });
});

describe('what an answer does', () => {
  it('accepted: SENDING becomes ADDED with the line the server named, and nothing else is drawn from it', () => {
    expect(reduceAdd(begin(), { type: 'ACCEPTED', lineId: asLineId('l1') })).toMatchObject({
      kind: 'ADDED',
      lineId: 'l1',
    });
  });

  it('ignores an answer when no request is in flight', () => {
    expect(reduceAdd(IDLE, { type: 'ACCEPTED', lineId: asLineId('l1') })).toBe(IDLE);
    expect(failed(IDLE, UNKNOWN_J)).toBe(IDLE);
  });

  it('a definite refusal ends the add: REFUSED, or REFUSED_RELOAD when the carts must be read again', () => {
    expect(
      failed(begin(), { outcome: 'refused', reload: false, code: 'NOT_FOUND', holdMs: null }),
    ).toMatchObject({ kind: 'REFUSED', code: 'NOT_FOUND' });
    expect(
      failed(begin(), {
        outcome: 'refused',
        reload: true,
        code: 'CART_SELLER_CONFLICT',
        holdMs: null,
      }),
    ).toMatchObject({ kind: 'REFUSED_RELOAD' });
  });

  it('no proof either way is UNKNOWN, keeping the intent (and its key) and any wait the server asked for', () => {
    const state = failed(begin(), { outcome: 'unknown', replay: true, holdMs: 3_000 });
    expect(state).toMatchObject({
      kind: 'UNKNOWN',
      holdUntil: NOW + 10 + 3_000,
      offlineNotice: false,
    });
    expect(intentOf(state).key).toBe('key-1');
  });

  it('no proof and no key to send again is UNRESOLVED', () => {
    expect(failed(begin(), { outcome: 'unknown', replay: false, holdMs: null }).kind).toBe(
      'UNRESOLVED',
    );
  });
});

describe('trying again', () => {
  const unknown = failed(begin(), UNKNOWN_J);

  it('sends the SAME key and body again, counting the attempt, inside the safe age', () => {
    const state = reduceAdd(unknown, { type: 'RETRY', now: NOW + 1_000, online: true });
    expect(state).toMatchObject({
      kind: 'SENDING',
      intent: { key: 'key-1', quantity: 2, attempts: 2, startedAt: NOW },
    });
  });

  it('sends nothing while the device is known to be offline, and says so once', () => {
    const state = reduceAdd(unknown, { type: 'RETRY', now: NOW + 1_000, online: false });
    expect(state).toMatchObject({ kind: 'UNKNOWN', offlineNotice: true });
    expect(reduceAdd(state, { type: 'RETRY', now: NOW + 1_000, online: false })).toBe(state);
  });

  it('waits out a hold the server asked for', () => {
    const held = failed(begin(), { outcome: 'unknown', replay: true, holdMs: 10_000 });
    expect(reduceAdd(held, { type: 'RETRY', now: NOW + 5_000, online: true })).toBe(held);
    expect(reduceAdd(held, { type: 'RETRY', now: NOW + 10 + 10_000, online: true }).kind).toBe(
      'SENDING',
    );
  });

  it('becomes UNRESOLVED at the safe age, or when the clock stepped back, instead of sending', () => {
    expect(reduceAdd(unknown, { type: 'RETRY', now: NOW + KEY_SAFE_MS, online: true }).kind).toBe(
      'UNRESOLVED',
    );
    expect(reduceAdd(unknown, { type: 'RETRY', now: NOW - 1, online: true }).kind).toBe(
      'UNRESOLVED',
    );
  });

  it("an add that was never sent starts its key's age with its first request", () => {
    const offline = begin(IDLE, { online: false });
    const sending = reduceAdd(offline, { type: 'RETRY', now: NOW + 60_000, online: true });
    expect(sending).toMatchObject({
      kind: 'SENDING',
      intent: { key: 'key-1', startedAt: NOW + 60_000, attempts: 1 },
    });
    expect(reduceAdd(offline, { type: 'RETRY', now: NOW + 60_000, online: false })).toBe(offline);
  });

  it('has no retry from UNRESOLVED, nor from a finished add', () => {
    const unresolved = failed(begin(), { outcome: 'unknown', replay: false, holdMs: null });
    expect(reduceAdd(unresolved, { type: 'RETRY', now: NOW + 1, online: true })).toBe(unresolved);
    const added = reduceAdd(begin(), { type: 'ACCEPTED', lineId: asLineId('l1') });
    expect(reduceAdd(added, { type: 'RETRY', now: NOW + 1, online: true })).toBe(added);
  });
});

describe('dismissing', () => {
  it('ends an unconfirmed add and marks the option, so the next add shows the hedge first', () => {
    expect(reduceAdd(failed(begin(), UNKNOWN_J), { type: 'DISMISS' })).toBe(IDLE_UNCONFIRMED);
    expect(
      reduceAdd(failed(begin(), { outcome: 'unknown', replay: false, holdMs: null }), {
        type: 'DISMISS',
      }),
    ).toBe(IDLE_UNCONFIRMED);
  });

  it('ends any other finished add with no mark, and does not end a request in flight', () => {
    expect(reduceAdd(begin(IDLE, { online: false }), { type: 'DISMISS' })).toBe(IDLE);
    expect(
      reduceAdd(reduceAdd(begin(), { type: 'ACCEPTED', lineId: asLineId('l1') }), {
        type: 'DISMISS',
      }),
    ).toBe(IDLE);
    const sending = begin();
    expect(reduceAdd(sending, { type: 'DISMISS' })).toBe(sending);
    expect(reduceAdd(IDLE, { type: 'DISMISS' })).toBe(IDLE);
  });

  it('an add after a dismissed unconfirmed one is a new intent with a new key', () => {
    const next = begin(IDLE_UNCONFIRMED, { key: 'key-9' });
    expect(intentOf(next).key).toBe('key-9');
  });

  it('knows which states are pending', () => {
    expect(isPending(begin())).toBe(true);
    expect(isPending(IDLE)).toBe(false);
    expect(isPending(failed(begin(), { outcome: 'unknown', replay: false, holdMs: null }))).toBe(
      false,
    );
  });
});

describe('naming an option to add from the public Product answer', () => {
  type Product = components['schemas']['StorefrontProductDto'];
  const variant = (id: string, available: boolean): Product['variants'][number] => ({
    id,
    variant_key: 'size=m',
    price_minor: 1000,
    price_currency: 'ETB',
    stock_count: 5,
    stock_confirmed_at: null,
    status: 'ACTIVE',
    available,
  });
  const product = (available: boolean, variants: Product['variants']): Product => ({
    id: 'de000000-0000-4000-8000-0000000000aa',
    slug: 'demo-item',
    name: 'Demo item',
    base_price_minor: 1000,
    base_price_currency: 'ETB',
    price_min_minor: 1000,
    price_max_minor: 1000,
    price_currency: 'ETB',
    available,
    description: null,
    category_id: null,
    seller: { handle: 'demo-seller', store_name: 'Demo Seller' },
    variants,
    attributes: [],
    images: [],
  });
  const ID = 'de000000-0000-4000-8000-000000000001';

  it('names an option the answer offers and the server says can be bought now', () => {
    expect(toAddIntent(product(true, [variant(ID, true)]), ID, 3)).toEqual({
      variantId: ID as VariantId,
      quantity: 3,
    });
  });

  it('names nothing for an option that is unavailable, one the answer does not list, or an unavailable Product', () => {
    expect(toAddIntent(product(true, [variant(ID, false)]), ID, 1)).toBeNull();
    expect(
      toAddIntent(product(true, [variant(ID, true)]), 'de000000-0000-4000-8000-000000000002', 1),
    ).toBeNull();
    expect(toAddIntent(product(false, [variant(ID, true)]), ID, 1)).toBeNull();
  });

  it('names nothing for a quantity that is not a positive whole number, and sets no ceiling of its own', () => {
    const p = product(true, [variant(ID, true)]);
    for (const quantity of [0, -1, 1.5, Number.NaN, 2 ** 53, 1e21, Number.POSITIVE_INFINITY])
      expect(toAddIntent(p, ID, quantity)).toBeNull();
    expect(toAddIntent(p, ID, 100_000)?.quantity).toBe(100_000);
  });
});
