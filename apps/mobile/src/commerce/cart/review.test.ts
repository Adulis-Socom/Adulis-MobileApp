import {
  cartSet,
  line,
  sellerCart,
  serverItem,
  UNVERIFIED,
  V1,
  V2,
  VERIFIED,
} from '../testing/builders';
import { applyItems, asLineId, differenceRef, type CartLine } from './model';
import type { Scope } from './port';
import {
  createReviewStore,
  isPurchasableReviewed,
  lineReview,
  sellerCartReadiness,
  type Consent,
  type CurrentAnswer,
  type ReviewStore,
} from './review';

/** The line as the server reports a changed price on it (identity included), through the model's own path. */
const priced = (over: Parameters<typeof serverItem>[0] = {}, id = 'line-1'): CartLine => {
  const cart = applyItems(sellerCart([line(id)]), [serverItem(over)]);
  return cart.lines[0]!;
};

describe('the identity of a reported difference', () => {
  it('is the same for the same report, and differs when the previous price, the current price or the currency differs', () => {
    const base = differenceRef(serverItem());
    expect(base).not.toBeNull();
    expect(differenceRef(serverItem())).toBe(base);
    expect(differenceRef(serverItem({ wasMinor: 800 }))).not.toBe(base);
    expect(differenceRef(serverItem({ nowMinor: 1100 }))).not.toBe(base);
    expect(differenceRef(serverItem({ currency: 'USD' }))).not.toBe(base);
  });

  it('differs for a report with no previous price, and is not confused with a previous price of zero', () => {
    const none = differenceRef(serverItem({ wasMinor: null }));
    expect(none).not.toBeNull();
    expect(none).not.toBe(differenceRef(serverItem()));
    expect(none).not.toBe(differenceRef(serverItem({ wasMinor: 0 })));
  });

  it('is null for a report that lacks the current price or the currency, and for any other code', () => {
    expect(differenceRef(serverItem({ nowMinor: null }))).toBeNull();
    expect(differenceRef(serverItem({ currency: null }))).toBeNull();
    expect(differenceRef(serverItem({ code: 'SOLD_OUT' }))).toBeNull();
  });

  it('is set by the model on every line that names the Variant, and on no other line', () => {
    const cart = applyItems(sellerCart([line('a'), line('b'), line('c', { variantId: V2 })]), [
      serverItem(),
    ]);
    const refs = cart.lines.map((l) => l.priceChangeRef ?? null);
    expect(refs[0]).toBe(differenceRef(serverItem()));
    expect(refs[1]).toBe(refs[0]);
    expect(refs[2]).toBeNull();
  });

  it('is null on a line that has no way to tell a report from another: a report that cannot be identified', () => {
    expect(priced({ nowMinor: null }).priceChangeRef).toBeNull();
    expect(priced({ nowMinor: null }).issues).toEqual(['PRICE_CHANGED']);
  });

  it('is null when two different reports name one line (neither can be accepted), and kept for two equal ones', () => {
    const twice = (a: Partial<Parameters<typeof serverItem>[0]>, b: typeof a) =>
      applyItems(sellerCart([line('a')]), [serverItem(a), serverItem(b)]).lines[0]!;
    expect(twice({}, { nowMinor: 1200 }).priceChangeRef).toBeNull();
    expect(twice({}, {}).priceChangeRef).toBe(differenceRef(serverItem()));
    // And a third report does not bring an identity back.
    const three = applyItems(sellerCart([line('a')]), [
      serverItem(),
      serverItem({ nowMinor: 1200 }),
      serverItem(),
    ]).lines[0]!;
    expect(three.priceChangeRef).toBeNull();
  });

  it('is not set by anything but a price change', () => {
    const cart = applyItems(sellerCart([line('a')]), [serverItem({ code: 'SOLD_OUT' })]);
    expect(cart.lines[0]?.priceChangeRef ?? null).toBeNull();
  });
});

describe('what a line needs from the Buyer', () => {
  const consentFor = (l: CartLine): Consent => ({
    epoch: 1,
    lineId: l.lineId,
    variantId: l.variantId,
    ref: l.priceChangeRef as string,
  });

  it.each([
    ['an answer that cannot be vouched for', line('x'), UNVERIFIED, null, 'UNVERIFIED'],
    ['nothing reported', line('x'), VERIFIED, null, 'OK'],
    ['a changed price nobody accepted', priced(), VERIFIED, null, 'NEEDS_ACCEPT'],
    [
      'a changed price with another reason beside it',
      { ...priced(), issues: ['SOLD_OUT', 'PRICE_CHANGED'] } as CartLine,
      VERIFIED,
      null,
      'BLOCKED',
    ],
    [
      'a changed price that cannot be identified',
      priced({ nowMinor: null }),
      VERIFIED,
      null,
      'BLOCKED',
    ],
    [
      'a reason the app does not know',
      line('x', { issues: ['UNKNOWN'] }),
      VERIFIED,
      null,
      'BLOCKED',
    ],
    ['a sold out line', line('x', { issues: ['SOLD_OUT'] }), VERIFIED, null, 'BLOCKED'],
  ] as const)('%s is %s', (_name, l, freshness, consent, expected) => {
    expect(lineReview(l, freshness, consent)).toBe(expected);
  });

  it('is ACCEPTED only for a consent to exactly this difference on this line and this option', () => {
    const l = priced();
    expect(lineReview(l, VERIFIED, consentFor(l))).toBe('ACCEPTED');
    expect(lineReview(l, VERIFIED, { ...consentFor(l), ref: 'another' })).toBe('NEEDS_ACCEPT');
    expect(lineReview(l, VERIFIED, { ...consentFor(l), variantId: V2 })).toBe('NEEDS_ACCEPT');
    expect(lineReview(l, VERIFIED, { ...consentFor(l), lineId: asLineId('other') })).toBe(
      'NEEDS_ACCEPT',
    );
  });

  it('stays BLOCKED, not ACCEPTED, once another reason appears beside an accepted difference', () => {
    const l = priced();
    const blocked = { ...l, issues: ['SOLD_OUT', 'PRICE_CHANGED'] } as CartLine;
    expect(lineReview(blocked, VERIFIED, consentFor(l))).toBe('BLOCKED');
  });

  it('treats a price increase and a price decrease alike', () => {
    const up = priced({ wasMinor: 900, nowMinor: 1000 });
    const down = priced({ wasMinor: 1000, nowMinor: 900 });
    expect(lineReview(up, VERIFIED, null)).toBe('NEEDS_ACCEPT');
    expect(lineReview(down, VERIFIED, null)).toBe('NEEDS_ACCEPT');
  });
});

describe('may a line be bought once the Buyer has reviewed it', () => {
  it('counts a clean line, and a changed price only with a consent to that very difference', () => {
    const l = priced();
    const consent: Consent = {
      epoch: 1,
      lineId: l.lineId,
      variantId: l.variantId,
      ref: l.priceChangeRef as string,
    };
    expect(isPurchasableReviewed(line('x'), null)).toBe(true);
    expect(isPurchasableReviewed(l, null)).toBe(false);
    expect(isPurchasableReviewed(l, consent)).toBe(true);
    expect(isPurchasableReviewed(l, { ...consent, ref: 'another' })).toBe(false);
  });

  it('never counts an unknown reason, a combined list or a difference that cannot be identified', () => {
    const l = priced();
    const consent: Consent = {
      epoch: 1,
      lineId: l.lineId,
      variantId: l.variantId,
      ref: l.priceChangeRef as string,
    };
    expect(isPurchasableReviewed(line('x', { issues: ['UNKNOWN'] }), consent)).toBe(false);
    expect(
      isPurchasableReviewed({ ...l, issues: ['SOLD_OUT', 'PRICE_CHANGED'] } as CartLine, consent),
    ).toBe(false);
    const unidentified = priced({ nowMinor: null });
    expect(isPurchasableReviewed(unidentified, { ...consent, ref: 'null' })).toBe(false);
  });
});

describe('whether anything in one Seller cart is unresolved', () => {
  const none = () => null;
  const consentOf =
    (l: CartLine) =>
    (lineId: typeof l.lineId): Consent | null =>
      lineId === l.lineId
        ? { epoch: 1, lineId: l.lineId, variantId: l.variantId, ref: l.priceChangeRef as string }
        : null;

  it.each([
    ['has no lines', [], VERIFIED, 'EMPTY'],
    ['cannot be vouched for', [line('a')], UNVERIFIED, 'UNVERIFIED'],
    ['holds a blocked line', [line('a'), line('b', { issues: ['SOLD_OUT'] })], VERIFIED, 'BLOCKED'],
    [
      'holds a changed price nobody accepted',
      [line('a'), priced({}, 'b')],
      VERIFIED,
      'NEEDS_REVIEW',
    ],
    ['holds only clean lines', [line('a'), line('b')], VERIFIED, 'CLEAR'],
  ] as const)('a Seller cart that %s is %s', (_name, lines, freshness, expected) => {
    expect(sellerCartReadiness(sellerCart([...lines]), freshness, none)).toBe(expected);
  });

  it('is CLEAR once the one changed price was accepted, and BLOCKED beats NEEDS_REVIEW', () => {
    const changed = priced({}, 'b');
    const cart = sellerCart([line('a'), changed]);
    expect(sellerCartReadiness(cart, VERIFIED, consentOf(changed))).toBe('CLEAR');
    const both = sellerCart([line('a', { issues: ['SOLD_OUT'] }), changed]);
    expect(sellerCartReadiness(both, VERIFIED, none)).toBe('BLOCKED');
  });

  it('judges each Seller cart alone', () => {
    const a = sellerCart([priced({}, 'a')], {}, 'seller-a');
    const b = sellerCart([line('b')], {}, 'seller-b');
    expect(sellerCartReadiness(a, VERIFIED, none)).toBe('NEEDS_REVIEW');
    expect(sellerCartReadiness(b, VERIFIED, none)).toBe('CLEAR');
  });
});

describe("recording the Buyer's consent", () => {
  let live = true;
  const scope = (epoch = 1): Scope => ({ kind: 'account', epoch, isCurrent: () => live });
  const answer = (...lines: CartLine[]): CurrentAnswer => ({
    carts: cartSet(sellerCart(lines)),
    verified: true,
  });
  let store: ReviewStore;
  beforeEach(() => {
    live = true;
    store = createReviewStore();
  });
  const ref = (l: CartLine) => l.priceChangeRef as string;

  it('records a consent for exactly the difference the Buyer was shown', () => {
    const l = priced();
    expect(store.accept(scope(), l.lineId, ref(l), answer(l))).toBe('ACCEPTED');
    expect(store.acceptedFor(scope(), l.lineId)).toEqual({
      epoch: 1,
      lineId: l.lineId,
      variantId: V1,
      ref: ref(l),
    });
  });

  it('records nothing and says CHANGED when the difference moved between what was drawn and the tap', () => {
    const shown = priced({ nowMinor: 1000 });
    const now = priced({ nowMinor: 1100 });
    expect(store.accept(scope(), shown.lineId, ref(shown), answer(now))).toBe('CHANGED');
    expect(store.acceptedFor(scope(), shown.lineId)).toBeNull();
    expect(store.snapshot().size).toBe(0);
  });

  it.each([
    ['a difference that cannot be identified', () => priced({ nowMinor: null })],
    [
      'a line with another reason beside the price',
      () => ({ ...priced(), issues: ['SOLD_OUT', 'PRICE_CHANGED'] }) as CartLine,
    ],
    ['a reason the app does not know', () => line('line-1', { issues: ['UNKNOWN'] })],
    ['a line with nothing reported', () => line('line-1')],
  ])('refuses %s', (_name, make) => {
    const l = make();
    expect(store.accept(scope(), l.lineId, 'any', answer(l))).toBe('NOT_ACCEPTABLE');
    expect(store.snapshot().size).toBe(0);
  });

  it('refuses a line that is not in the answer, and an answer that is not verified', () => {
    const l = priced();
    expect(store.accept(scope(), l.lineId, ref(l), answer())).toBe('NOT_ACCEPTABLE');
    expect(store.accept(scope(), l.lineId, ref(l), { ...answer(l), verified: false })).toBe(
      'NOT_ACCEPTABLE',
    );
    expect(store.snapshot().size).toBe(0);
  });

  it('refuses for a scope that is not the current one', () => {
    const l = priced();
    live = false;
    expect(store.accept(scope(), l.lineId, ref(l), answer(l))).toBe('STALE_SCOPE');
    expect(store.snapshot().size).toBe(0);
  });

  it('a second tap on a difference that was accepted records nothing new and tells nobody', () => {
    const l = priced();
    store.accept(scope(), l.lineId, ref(l), answer(l));
    const before = store.snapshot();
    const told = jest.fn();
    store.subscribe(told);
    expect(store.accept(scope(), l.lineId, ref(l), answer(l))).toBe('ACCEPTED');
    expect(store.snapshot()).toBe(before);
    expect(told).not.toHaveBeenCalled();
  });

  it('keeps a consent while the same difference is reported, and drops it when the difference is gone', () => {
    const l = priced();
    store.accept(scope(), l.lineId, ref(l), answer(l));
    store.project(scope(), answer(l));
    expect(store.acceptedFor(scope(), l.lineId)).not.toBeNull();
    store.project(scope(), answer(line('line-1')));
    expect(store.acceptedFor(scope(), l.lineId)).toBeNull();
  });

  it('drops a consent when the reference changed, when the Variant changed and when the line left', () => {
    const l = priced();
    for (const next of [
      answer(priced({ nowMinor: 1200 })),
      answer({ ...l, variantId: V2 }),
      answer(),
    ]) {
      store = createReviewStore();
      store.accept(scope(), l.lineId, ref(l), answer(l));
      store.project(scope(), next);
      expect(store.acceptedFor(scope(), l.lineId)).toBeNull();
    }
  });

  it('a difference that went away and came back is reviewed again, not accepted from before', () => {
    const l = priced();
    store.accept(scope(), l.lineId, ref(l), answer(l));
    store.project(scope(), answer(line('line-1')));
    store.project(scope(), answer(priced()));
    expect(store.acceptedFor(scope(), l.lineId)).toBeNull();
    expect(lineReview(priced(), VERIFIED, store.acceptedFor(scope(), l.lineId))).toBe(
      'NEEDS_ACCEPT',
    );
  });

  it('does not drop anything for an answer that is not verified', () => {
    const l = priced();
    store.accept(scope(), l.lineId, ref(l), answer(l));
    store.project(scope(), { ...answer(), verified: false });
    expect(store.acceptedFor(scope(), l.lineId)).not.toBeNull();
  });

  it('shows no consent to a scope other than the one that recorded it, and is emptied by clear', () => {
    const l = priced();
    store.accept(scope(1), l.lineId, ref(l), answer(l));
    expect(store.acceptedFor(scope(2), l.lineId)).toBeNull();
    store.clear();
    expect(store.acceptedFor(scope(1), l.lineId)).toBeNull();
    expect(store.snapshot().size).toBe(0);
  });

  it('tells watchers once per change, and not for a silent clear', () => {
    const told = jest.fn();
    store.subscribe(told);
    const l = priced();
    store.accept(scope(), l.lineId, ref(l), answer(l));
    expect(told).toHaveBeenCalledTimes(1);
    store.project(scope(), answer(l));
    expect(told).toHaveBeenCalledTimes(1);
    store.clear({ silent: true });
    expect(told).toHaveBeenCalledTimes(1);
    expect(store.snapshot().size).toBe(0);
  });

  it('is independent per line: accepting one line records nothing for another', () => {
    const a = priced({}, 'line-a');
    const b = priced({}, 'line-b');
    store.accept(scope(), a.lineId, ref(a), answer(a, b));
    expect(store.acceptedFor(scope(), a.lineId)).not.toBeNull();
    expect(store.acceptedFor(scope(), b.lineId)).toBeNull();
  });
});
