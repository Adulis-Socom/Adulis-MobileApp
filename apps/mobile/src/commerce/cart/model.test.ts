import {
  LINE_ISSUES,
  applyItems,
  asLineId,
  asSellerKey,
  asVariantId,
  findLine,
  isPurchasable,
  issueFromServerCode,
  type CartLine,
  type CartSet,
  type SellerCart,
  type ServerItem,
} from './model';
import * as model from './model';

const V1 = asVariantId('de000000-0000-4000-8000-000000000001');
const V2 = asVariantId('de000000-0000-4000-8000-000000000002');

const line = (id: string, variant = V1, over: Partial<CartLine> = {}): CartLine => ({
  lineId: asLineId(id),
  variantId: variant,
  quantity: 1,
  name: 'Demo item',
  option: null,
  productSlug: null,
  imageKey: null,
  unitPrice: { amountMinor: 1000, currency: 'ETB' },
  previousUnitPrice: null,
  availableQuantity: null,
  issues: [],
  ...over,
});
const cart = (lines: CartLine[]): SellerCart => ({ key: asSellerKey('seller-a'), handle: null, storeName: null, lines, subtotal: null });
const item = (over: Partial<ServerItem>): ServerItem => ({
  code: 'SOLD_OUT',
  variantId: V1,
  requested: null,
  available: null,
  wasMinor: null,
  nowMinor: null,
  currency: null,
  ...over,
});

describe('a line is purchasable only when the server reports nothing against it', () => {
  it('is purchasable with no reason and not with any reason, an unknown one included', () => {
    expect(isPurchasable(line('l1'))).toBe(true);
    for (const issue of LINE_ISSUES) expect(isPurchasable(line('l1', V1, { issues: [issue] }))).toBe(false);
  });

  it('lists the reasons in display precedence, removal-class first and unknown last', () => {
    expect(LINE_ISSUES[0]).toBe('NO_LONGER_PUBLISHED');
    expect(LINE_ISSUES[LINE_ISSUES.length - 1]).toBe('UNKNOWN');
    expect(LINE_ISSUES.indexOf('SOLD_OUT')).toBeLessThan(LINE_ISSUES.indexOf('INSUFFICIENT_STOCK'));
    expect(LINE_ISSUES.indexOf('INSUFFICIENT_STOCK')).toBeLessThan(LINE_ISSUES.indexOf('PRICE_CHANGED'));
  });
});

describe('the server item codes', () => {
  it.each([
    ['NO_LONGER_PUBLISHED'],
    ['VARIANT_WITHDRAWN'],
    ['SELLER_UNAVAILABLE'],
    ['SOLD_OUT'],
    ['INSUFFICIENT_STOCK'],
    ['PRICE_CHANGED'],
  ])('%s is a line reason of its own name', (code) => {
    expect(issueFromServerCode(code)).toBe(code);
  });

  it('keeps sold out distinct from not enough in stock', () => {
    expect(issueFromServerCode('SOLD_OUT')).not.toBe(issueFromServerCode('INSUFFICIENT_STOCK'));
  });

  it('reads a code this build does not know as unknown, never as fine', () => {
    expect(issueFromServerCode('SOMETHING_NEWER')).toBe('UNKNOWN');
    // The two names that are this app's own are not server codes.
    expect(issueFromServerCode('UNAVAILABLE')).toBe('UNKNOWN');
    expect(issueFromServerCode('UNKNOWN')).toBe('UNKNOWN');
  });

  it('marks no line for a code about the whole cart', () => {
    for (const code of ['TRANSACTION_CAP_EXCEEDED', 'CART_EMPTY', 'CART_REVALIDATION_FAILED']) expect(issueFromServerCode(code)).toBeNull();
    const before = cart([line('l1')]);
    expect(applyItems(before, [item({ code: 'TRANSACTION_CAP_EXCEEDED', variantId: null })])).toBe(before);
  });
});

describe('applying the items of an answer that lists every affected line', () => {
  it('reaches every line that names the Variant, so two lines of one option both carry the reason', () => {
    const next = applyItems(cart([line('l1', V1), line('l2', V2), line('l3', V1)]), [item({ code: 'SOLD_OUT' })]);
    expect(next.lines.map((l) => l.issues)).toEqual([['SOLD_OUT'], [], ['SOLD_OUT']]);
  });

  it('puts an item about no Variant on every line of the cart', () => {
    const next = applyItems(cart([line('l1', V1), line('l2', V2)]), [item({ code: 'SELLER_UNAVAILABLE', variantId: null })]);
    expect(next.lines.every((l) => l.issues.includes('SELLER_UNAVAILABLE'))).toBe(true);
  });

  it('keeps a line\'s reasons in precedence order whatever order the items came in', () => {
    const next = applyItems(cart([line('l1')]), [item({ code: 'PRICE_CHANGED', currency: 'ETB', nowMinor: 1200 }), item({ code: 'SOLD_OUT' })]);
    expect(next.lines[0]?.issues).toEqual(['SOLD_OUT', 'PRICE_CHANGED']);
  });

  it('takes the number the server says is available, and zero for sold out', () => {
    const low = applyItems(cart([line('l1')]), [item({ code: 'INSUFFICIENT_STOCK', requested: 5, available: 2 })]);
    expect(low.lines[0]?.availableQuantity).toBe(2);
    const none = applyItems(cart([line('l1')]), [item({ code: 'SOLD_OUT' })]);
    expect(none.lines[0]?.availableQuantity).toBe(0);
  });

  it('takes the server\'s previous and current price for a changed price, and no previous one when it sent none', () => {
    const changed = applyItems(cart([line('l1')]), [item({ code: 'PRICE_CHANGED', wasMinor: 900, nowMinor: 1000, currency: 'ETB' })]);
    expect(changed.lines[0]?.previousUnitPrice).toEqual({ amountMinor: 900, currency: 'ETB' });
    expect(changed.lines[0]?.unitPrice).toEqual({ amountMinor: 1000, currency: 'ETB' });
    const noPrevious = applyItems(cart([line('l1')]), [item({ code: 'PRICE_CHANGED', wasMinor: null, nowMinor: 1000, currency: 'ETB' })]);
    expect(noPrevious.lines[0]?.previousUnitPrice).toBeNull();
  });

  it('marks a line unknown, and so not purchasable, for a code it does not know', () => {
    const next = applyItems(cart([line('l1')]), [item({ code: 'SOMETHING_NEWER' })]);
    expect(next.lines[0]?.issues).toEqual(['UNKNOWN']);
    expect(isPurchasable(next.lines[0]!)).toBe(false);
  });
});

describe('finding a line', () => {
  it('finds it in whichever Seller cart holds it, and returns null for a line that is gone', () => {
    const set: CartSet = { carts: [cart([line('l1')]), { ...cart([line('l2', V2)]), key: asSellerKey('seller-b') }], checkedAt: null };
    expect(findLine(set, asLineId('l2'))?.variantId).toBe(V2);
    expect(findLine(set, asLineId('missing'))).toBeNull();
  });
});

describe('money', () => {
  it('has no arithmetic anywhere in the model', () => {
    const names = Object.keys(model);
    expect(names.filter((name) => /^(add|sum|plus|total|multiply|subtract|minus|times)/i.test(name))).toEqual([]);
  });
});
