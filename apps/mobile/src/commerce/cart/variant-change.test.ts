import { cartSet, line, listed, sellerCart, UNVERIFIED, V1, V2, V3 } from '../testing/builders';
import { product, productVariant } from '../testing/fixture/product';
import { asLineId } from './model';
import {
  IDLE_CHANGE,
  planVariantChange,
  reduceChange,
  type ChangeState,
  type VariantChangePlan,
} from './variant-change';

const L1 = asLineId('line-1');
const view = (over = {}, handle: string | null = 'demo-seller') =>
  listed(cartSet(sellerCart([line('line-1', { quantity: 2, ...over })], { handle })));
const offered = product([productVariant(V1), productVariant(V2), productVariant(V3, false)]);

describe('what a change of option may name', () => {
  it('names the old line and the new option, for an option the Product answer offers and the server says can be bought now', () => {
    expect(planVariantChange(view(), offered, L1, V2, 2)).toEqual({
      ok: true,
      plan: { oldLineId: L1, add: { variantId: V2, quantity: 2 } },
    });
  });

  it.each([
    [
      'an unverified view',
      () =>
        planVariantChange(
          listed(cartSet(sellerCart([line('line-1')])), UNVERIFIED),
          offered,
          L1,
          V2,
          1,
        ),
      'NOT_VERIFIED',
    ],
    [
      'a view that is not a list',
      () => planVariantChange({ kind: 'LOADING', waitingForConnection: false }, offered, L1, V2, 1),
      'NOT_VERIFIED',
    ],
    [
      'a disabled view',
      () => planVariantChange({ kind: 'DISABLED', reason: 'ADAPTER_DISABLED' }, offered, L1, V2, 1),
      'UNAVAILABLE',
    ],
    [
      'a line the answer does not hold',
      () => planVariantChange(view(), offered, asLineId('absent'), V2, 1),
      'LINE_ABSENT',
    ],
    [
      'a line that carries no Product',
      () => planVariantChange(view({ productSlug: null }), offered, L1, V2, 1),
      'NO_PRODUCT_LINK',
    ],
    [
      'a Seller cart that carries no handle',
      () => planVariantChange(view({}, null), offered, L1, V2, 1),
      'NO_PRODUCT_LINK',
    ],
    [
      'a Product answer for another Product',
      () => planVariantChange(view(), product([productVariant(V2)], { slug: 'other' }), L1, V2, 1),
      'PRODUCT_MISMATCH',
    ],
    [
      'a Product answer for another Seller',
      () =>
        planVariantChange(
          view(),
          product([productVariant(V2)], { handle: 'other-seller' }),
          L1,
          V2,
          1,
        ),
      'PRODUCT_MISMATCH',
    ],
    [
      'the option the line already has',
      () => planVariantChange(view(), offered, L1, V1, 1),
      'SAME_VARIANT',
    ],
    [
      'an option that cannot be bought now',
      () => planVariantChange(view(), offered, L1, V3, 1),
      'NOT_SELECTABLE',
    ],
    [
      'an option the answer does not list',
      () => planVariantChange(view(), offered, L1, 'de000000-0000-4000-8000-0000000000ff', 1),
      'NOT_SELECTABLE',
    ],
    [
      'an unavailable Product',
      () =>
        planVariantChange(view(), product([productVariant(V2)], { available: false }), L1, V2, 1),
      'NOT_SELECTABLE',
    ],
  ] as const)('names nothing for %s', (_name, plan, reason) => {
    expect(plan()).toEqual({ ok: false, reason });
  });

  it('names nothing for a quantity that is not a positive safe whole number, and sets no ceiling of its own', () => {
    for (const quantity of [0, -1, 1.5, Number.NaN, 2 ** 53, 1e21]) {
      expect(planVariantChange(view(), offered, L1, V2, quantity)).toEqual({
        ok: false,
        reason: 'INVALID_QUANTITY',
      });
    }
    expect(planVariantChange(view(), offered, L1, V2, 100_000)).toMatchObject({ ok: true });
  });
});

describe('the steps of a change of option', () => {
  const plan: VariantChangePlan = { oldLineId: L1, add: { variantId: V2, quantity: 2 } };
  const adding: ChangeState = { kind: 'ADDING', plan };
  const stalled: ChangeState = { kind: 'STALLED', plan };
  const removing: ChangeState = { kind: 'REMOVING', plan };
  const partial: ChangeState = { kind: 'PARTIAL', plan };
  const done: ChangeState = { kind: 'DONE', plan };
  const aborted: ChangeState = { kind: 'ABORTED', plan };

  it('begins by adding: one decision, and a change that is running or waiting is not replaced', () => {
    expect(reduceChange(IDLE_CHANGE, { type: 'BEGIN', plan })).toEqual(adding);
    for (const state of [adding, stalled, removing, partial]) {
      expect(reduceChange(state, { type: 'BEGIN', plan })).toBe(state);
    }
    expect(reduceChange(done, { type: 'BEGIN', plan }).kind).toBe('ADDING');
    expect(reduceChange(aborted, { type: 'BEGIN', plan }).kind).toBe('ADDING');
  });

  it.each([['REFUSED'], ['REFUSED_RELOAD'], ['OFFLINE_NOT_SENT']] as const)(
    'an add that ends %s aborts the change and removes nothing',
    (add) => {
      expect(reduceChange(adding, { type: 'ADD', add })).toEqual(aborted);
    },
  );

  it.each([['UNKNOWN'], ['UNRESOLVED']] as const)(
    'an add that ends %s stalls the change: the old line is not removed and nothing continues on its own',
    (add) => {
      expect(reduceChange(adding, { type: 'ADD', add })).toEqual(stalled);
      expect(reduceChange(stalled, { type: 'ADD', add })).toBe(stalled);
      // A read that merely lists the new option does not continue it.
      expect(reduceChange(stalled, { type: 'READ_AFTER_ADD', holdsNew: true })).toBe(stalled);
    },
  );

  it('an add that is accepted after a stall (the Buyer tried again) goes on', () => {
    expect(reduceChange(stalled, { type: 'ADD', add: 'ADDED' })).toEqual(adding);
  });

  it('an add that is still being sent, or already accepted, leaves the step as it is', () => {
    for (const add of ['SENDING', 'ADDED', 'IDLE'] as const) {
      expect(reduceChange(adding, { type: 'ADD', add })).toBe(adding);
    }
  });

  it('the old line is removed only after a read made after the add holds the new option', () => {
    expect(reduceChange(adding, { type: 'READ_AFTER_ADD', holdsNew: true })).toEqual(removing);
    // Before such a read, nothing starts the removal.
    expect(reduceChange(adding, { type: 'ADD', add: 'ADDED' })).toBe(adding);
    expect(reduceChange(adding, { type: 'REMOVE', edit: 'CONFIRMED' })).toBe(adding);
  });

  it('a read after the add that does not hold the new option aborts: nothing was removed', () => {
    expect(reduceChange(adding, { type: 'READ_AFTER_ADD', holdsNew: false })).toEqual(aborted);
  });

  it.each([['CONFIRMED'], ['LINE_GONE']] as const)(
    'a removal that ends %s completes the change',
    (edit) => {
      expect(reduceChange(removing, { type: 'REMOVE', edit })).toEqual(done);
      expect(reduceChange(partial, { type: 'REMOVE', edit })).toEqual(done);
    },
  );

  it.each([['REFUSED'], ['UNKNOWN'], ['UNRESOLVED']] as const)(
    'a removal that ends %s leaves both lines, with nothing automatic',
    (edit) => {
      expect(reduceChange(removing, { type: 'REMOVE', edit })).toEqual(partial);
      expect(reduceChange(partial, { type: 'REMOVE', edit })).toBe(partial);
    },
  );

  it('a removal that is still in flight leaves the step as it is', () => {
    for (const edit of ['SENDING', 'APPLIED', 'IDLE', 'OFFLINE_NOT_SENT'] as const) {
      expect(reduceChange(removing, { type: 'REMOVE', edit })).toBe(removing);
    }
  });

  it('events for a step the change is not in change nothing', () => {
    expect(reduceChange(IDLE_CHANGE, { type: 'ADD', add: 'REFUSED' })).toBe(IDLE_CHANGE);
    expect(reduceChange(IDLE_CHANGE, { type: 'READ_AFTER_ADD', holdsNew: true })).toBe(IDLE_CHANGE);
    expect(reduceChange(removing, { type: 'ADD', add: 'REFUSED' })).toBe(removing);
    expect(reduceChange(done, { type: 'REMOVE', edit: 'REFUSED' })).toBe(done);
  });

  it('dismissing ends a change that waits on the Buyer, and never one in flight', () => {
    for (const state of [stalled, partial, done, aborted]) {
      expect(reduceChange(state, { type: 'DISMISS' })).toBe(IDLE_CHANGE);
    }
    for (const state of [adding, removing, IDLE_CHANGE]) {
      expect(reduceChange(state, { type: 'DISMISS' })).toBe(state);
    }
  });
});
