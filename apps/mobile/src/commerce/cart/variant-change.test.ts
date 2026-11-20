import { cartSet, line, listed, sellerCart, UNVERIFIED, V1, V2, V3 } from '../testing/builders';
import { product, productVariant } from '../testing/fixture/product';
import type { AddState } from './intent';
import { asLineId } from './model';
import {
  addedLineHoldsOption,
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
  const NEW = asLineId('line-new');
  const adding: ChangeState = { kind: 'ADDING', plan };
  const stalled: ChangeState = { kind: 'STALLED', plan };
  const added: ChangeState = { kind: 'ADDED', plan, lineId: NEW };
  const removing: ChangeState = { kind: 'REMOVING', plan, begun: false };
  const removingBegun: ChangeState = { kind: 'REMOVING', plan, begun: true };
  const partial: ChangeState = { kind: 'PARTIAL', plan };
  const done: ChangeState = { kind: 'DONE', plan };
  const aborted: ChangeState = { kind: 'ABORTED', plan };
  const intent = { variantId: V2, quantity: 2, key: 'k', startedAt: 1, attempts: 1 };
  const ADDED_ADD: AddState = { kind: 'ADDED', intent, lineId: NEW };
  const add = (kind: Exclude<AddState['kind'], 'ADDED' | 'IDLE' | 'UNKNOWN'>): AddState =>
    ({ kind, intent, code: null }) as unknown as AddState;
  const UNKNOWN_ADD: AddState = { kind: 'UNKNOWN', intent, holdUntil: null, offlineNotice: false };
  const UNRESOLVED_ADD: AddState = { kind: 'UNRESOLVED', intent };
  const SENDING_ADD: AddState = { kind: 'SENDING', intent };
  const IDLE_ADD: AddState = { kind: 'IDLE', earlierUnconfirmed: false };

  it('begins by adding: one decision, and a change that is running or waiting is not replaced', () => {
    expect(reduceChange(IDLE_CHANGE, { type: 'BEGIN', plan })).toEqual(adding);
    for (const state of [adding, stalled, added, removing, removingBegun, partial]) {
      expect(reduceChange(state, { type: 'BEGIN', plan })).toBe(state);
    }
    expect(reduceChange(done, { type: 'BEGIN', plan }).kind).toBe('ADDING');
    expect(reduceChange(aborted, { type: 'BEGIN', plan }).kind).toBe('ADDING');
  });

  it('a read cannot start the removal before the add has been accepted: nothing is removed for an add that was never accepted', () => {
    // The data-loss path: a line for the new option was already in the cart, so a read "holds the option".
    const begun = reduceChange(IDLE_CHANGE, { type: 'BEGIN', plan });
    expect(reduceChange(begun, { type: 'READ_AFTER_ADD', holdsAdded: true })).toBe(begun);
    for (const state of [adding, stalled]) {
      expect(reduceChange(state, { type: 'READ_AFTER_ADD', holdsAdded: true })).toBe(state);
    }
    for (const state of [IDLE_CHANGE, removing, partial, done, aborted]) {
      expect(reduceChange(state, { type: 'READ_AFTER_ADD', holdsAdded: true })).toBe(state);
    }
  });

  it.each([['REFUSED'], ['REFUSED_RELOAD'], ['OFFLINE_NOT_SENT']] as const)(
    'an add that ends %s aborts the change and removes nothing',
    (kind) => {
      expect(reduceChange(adding, { type: 'ADD', add: add(kind) })).toEqual(aborted);
      expect(reduceChange(stalled, { type: 'ADD', add: add(kind) })).toEqual(aborted);
    },
  );

  it.each([
    ['unknown', UNKNOWN_ADD],
    ['unresolved', UNRESOLVED_ADD],
  ] as const)(
    'an %s add stalls the change: the old line is not removed and nothing continues on its own',
    (_name, state) => {
      expect(reduceChange(adding, { type: 'ADD', add: state })).toEqual(stalled);
      expect(reduceChange(stalled, { type: 'ADD', add: state })).toBe(stalled);
      // A read that merely lists the new option does not continue it.
      expect(reduceChange(stalled, { type: 'READ_AFTER_ADD', holdsAdded: true })).toBe(stalled);
    },
  );

  it('only an accepted add moves on, carrying its line id, from ADDING and from a stall cleared by trying again', () => {
    expect(reduceChange(adding, { type: 'ADD', add: ADDED_ADD })).toEqual(added);
    expect(reduceChange(stalled, { type: 'ADD', add: ADDED_ADD })).toEqual(added);
  });

  it('an add that is still being sent or has nothing pending leaves the step as it is', () => {
    for (const state of [SENDING_ADD, IDLE_ADD]) {
      expect(reduceChange(adding, { type: 'ADD', add: state })).toBe(adding);
    }
  });

  it('once the add is accepted, later reports of the add change nothing', () => {
    for (const report of [UNKNOWN_ADD, add('REFUSED'), SENDING_ADD]) {
      expect(reduceChange(added, { type: 'ADD', add: report })).toBe(added);
      expect(reduceChange(removing, { type: 'ADD', add: report })).toBe(removing);
    }
  });

  it('the old line is removed only after a read made after the ACCEPTED add shows the added line holding the option', () => {
    expect(reduceChange(added, { type: 'READ_AFTER_ADD', holdsAdded: true })).toEqual(removing);
    expect(reduceChange(added, { type: 'REMOVE', edit: 'CONFIRMED' })).toBe(added);
  });

  it('a read after the accepted add that does not show the added line aborts: nothing was removed', () => {
    expect(reduceChange(added, { type: 'READ_AFTER_ADD', holdsAdded: false })).toEqual(aborted);
  });

  it.each([['CONFIRMED'], ['LINE_GONE']] as const)(
    'a removal that ends %s completes the change',
    (edit) => {
      expect(reduceChange(removing, { type: 'REMOVE', edit })).toEqual(done);
      expect(reduceChange(removingBegun, { type: 'REMOVE', edit })).toEqual(done);
      expect(reduceChange(partial, { type: 'REMOVE', edit })).toEqual(done);
    },
  );

  it.each([['REFUSED'], ['UNKNOWN'], ['UNRESOLVED'], ['OFFLINE_NOT_SENT']] as const)(
    'a removal that ends %s leaves both lines, with nothing automatic',
    (edit) => {
      expect(reduceChange(removing, { type: 'REMOVE', edit })).toEqual(partial);
      expect(reduceChange(removingBegun, { type: 'REMOVE', edit })).toEqual(partial);
      expect(reduceChange(partial, { type: 'REMOVE', edit })).toBe(partial);
    },
  );

  it('a removal that goes back to idle after it began (dismissed offline, or accepted with no claim) is not a stall: both lines stay', () => {
    const begun = reduceChange(removing, { type: 'REMOVE_BEGUN' });
    expect(begun).toEqual(removingBegun);
    expect(reduceChange(begun, { type: 'REMOVE', edit: 'IDLE' })).toEqual(partial);
  });

  it('idle before the removal has begun is only the edit not started yet, and ends nothing', () => {
    expect(reduceChange(removing, { type: 'REMOVE', edit: 'IDLE' })).toBe(removing);
  });

  it('a removal that is still in flight leaves the step as it is', () => {
    for (const edit of ['SENDING', 'APPLIED'] as const) {
      expect(reduceChange(removing, { type: 'REMOVE', edit })).toBe(removing);
      expect(reduceChange(removingBegun, { type: 'REMOVE', edit })).toBe(removingBegun);
    }
  });

  it('starting the removal twice, or outside REMOVING, changes nothing', () => {
    expect(reduceChange(removingBegun, { type: 'REMOVE_BEGUN' })).toBe(removingBegun);
    for (const state of [IDLE_CHANGE, adding, stalled, added, partial, done, aborted]) {
      expect(reduceChange(state, { type: 'REMOVE_BEGUN' })).toBe(state);
    }
  });

  it('events for a step the change is not in change nothing', () => {
    expect(reduceChange(IDLE_CHANGE, { type: 'ADD', add: add('REFUSED') })).toBe(IDLE_CHANGE);
    expect(reduceChange(IDLE_CHANGE, { type: 'READ_AFTER_ADD', holdsAdded: true })).toBe(
      IDLE_CHANGE,
    );
    expect(reduceChange(removing, { type: 'ADD', add: add('REFUSED') })).toBe(removing);
    expect(reduceChange(done, { type: 'REMOVE', edit: 'REFUSED' })).toBe(done);
    expect(reduceChange(adding, { type: 'REMOVE', edit: 'CONFIRMED' })).toBe(adding);
  });

  it('every step can be left: Dismiss ends a change that waits on the Buyer, gives up on ADDED and REMOVING into PARTIAL, and never touches an add in flight', () => {
    for (const state of [stalled, partial, done, aborted]) {
      expect(reduceChange(state, { type: 'DISMISS' })).toBe(IDLE_CHANGE);
    }
    expect(reduceChange(IDLE_CHANGE, { type: 'DISMISS' })).toBe(IDLE_CHANGE);
    expect(reduceChange(added, { type: 'DISMISS' })).toEqual(partial);
    expect(reduceChange(removing, { type: 'DISMISS' })).toEqual(partial);
    expect(reduceChange(removingBegun, { type: 'DISMISS' })).toEqual(partial);
    expect(reduceChange(adding, { type: 'DISMISS' })).toBe(adding);
  });

  it('a removal that was given up on still completes the change if it later confirms, and a new change can then begin', () => {
    const gaveUp = reduceChange(removingBegun, { type: 'DISMISS' });
    const confirmed = reduceChange(gaveUp, { type: 'REMOVE', edit: 'CONFIRMED' });
    expect(confirmed).toEqual(done);
    expect(reduceChange(confirmed, { type: 'BEGIN', plan }).kind).toBe('ADDING');
    // And from PARTIAL by Dismiss, so nothing is stranded either way.
    expect(
      reduceChange(reduceChange(removingBegun, { type: 'DISMISS' }), { type: 'DISMISS' }),
    ).toBe(IDLE_CHANGE);
  });
});

describe('whether the added line holds the option', () => {
  const plan: VariantChangePlan = { oldLineId: L1, add: { variantId: V2, quantity: 2 } };
  const carts = (...lines: Array<[string, typeof V1]>) =>
    cartSet(sellerCart(lines.map(([id, variantId]) => line(id, { variantId }))));
  const NEW = asLineId('line-new');

  it('is true for the line the add was accepted with, once it shows the option', () => {
    expect(addedLineHoldsOption(carts(['line-1', V1], ['line-new', V2]), plan, NEW)).toBe(true);
  });

  it('is false when a DIFFERENT line already had the option: that says nothing about this add', () => {
    const lines = carts(['line-1', V1], ['line-3', V2]);
    expect(addedLineHoldsOption(lines, plan, NEW)).toBe(false);
    expect(addedLineHoldsOption(lines, plan, asLineId('line-3'))).toBe(true);
  });

  it('is false when the accepted line is absent, shows another option, or is the old line', () => {
    expect(addedLineHoldsOption(carts(['line-1', V1]), plan, NEW)).toBe(false);
    expect(addedLineHoldsOption(carts(['line-1', V1], ['line-new', V3]), plan, NEW)).toBe(false);
    expect(addedLineHoldsOption(carts(['line-1', V2]), plan, L1)).toBe(false);
  });

  it('the planner allows a target the cart already holds, and the reducer still removes nothing for it', () => {
    const lines = cartSet(
      sellerCart([line('line-1', { variantId: V1 }), line('line-3', { variantId: V2 })]),
    );
    const planned = planVariantChange(listed(lines), offered, L1, V2, 2);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    // Begin, then every read lands while the add is still being sent or is lost.
    let state: ChangeState = reduceChange(IDLE_CHANGE, { type: 'BEGIN', plan: planned.plan });
    state = reduceChange(state, { type: 'READ_AFTER_ADD', holdsAdded: true });
    expect(state.kind).toBe('ADDING');
    // The add is accepted with a new line the next read does not show: the change aborts.
    const accepted: AddState = {
      kind: 'ADDED',
      intent: { variantId: V2, quantity: 2, key: 'k', startedAt: 1, attempts: 1 },
      lineId: asLineId('line-new'),
    };
    state = reduceChange(state, { type: 'ADD', add: accepted });
    const holds = addedLineHoldsOption(lines, planned.plan, asLineId('line-new'));
    state = reduceChange(state, { type: 'READ_AFTER_ADD', holdsAdded: holds });
    expect(state.kind).toBe('ABORTED');
  });
});
