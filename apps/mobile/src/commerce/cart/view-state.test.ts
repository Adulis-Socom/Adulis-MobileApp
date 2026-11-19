import { asLineId, asSellerKey, asVariantId, type CartLine, type CartSet, type SellerCart } from './model';
import type { Availability, Verified } from './port';
import { deriveViewState, mayDrawFacts, primaryIssue, sellerCartStatus, type QueryFacts } from './view-state';

const AVAILABLE: Availability = { available: true };
const line = (id: string, issues: CartLine['issues'] = []): CartLine => ({
  lineId: asLineId(id),
  variantId: asVariantId('de000000-0000-4000-8000-000000000001'),
  quantity: 1,
  name: null,
  option: null,
  productSlug: null,
  imageKey: null,
  unitPrice: null,
  previousUnitPrice: null,
  availableQuantity: null,
  issues,
});
const cart = (lines: CartLine[]): SellerCart => ({ key: asSellerKey('seller-a'), handle: null, storeName: null, lines, subtotal: null });
const set = (lines: CartLine[] = [line('l1')]): CartSet => ({ carts: lines.length ? [cart(lines)] : [], checkedAt: null });
const answer = (value: CartSet = set(), receivedAt = 10): Verified<CartSet> => ({ value, receivedAt, provenance: 'FIXTURE' });

const facts = (over: Partial<QueryFacts> = {}): QueryFacts => ({
  status: 'pending',
  fetchStatus: 'fetching',
  data: undefined,
  error: null,
  ...over,
});
const derive = (query: QueryFacts, over: { availability?: Availability; scopeCurrent?: boolean; withheld?: boolean } = {}) =>
  deriveViewState({ availability: AVAILABLE, scopeCurrent: true, withheld: false, query, ...over });

describe('the cart view (a pure function of the adapter, the scope and the query)', () => {
  it('is DISABLED for an adapter that says it is unavailable, whatever the query holds', () => {
    const view = derive(facts({ status: 'success', fetchStatus: 'idle', data: answer() }), {
      availability: { available: false, reason: 'ADAPTER_DISABLED' },
    });
    expect(view).toEqual({ kind: 'DISABLED', reason: 'ADAPTER_DISABLED' });
    expect(derive(facts(), { availability: { available: false, reason: 'CONTRACT_MISSING' } })).toEqual({
      kind: 'DISABLED',
      reason: 'CONTRACT_MISSING',
    });
  });

  it('is LOADING while there is no scope yet, and shows nothing of an answer whose scope is gone', () => {
    expect(derive(facts(), { scopeCurrent: false })).toEqual({ kind: 'LOADING', waitingForConnection: false });
    expect(derive(facts({ status: 'success', fetchStatus: 'idle', data: answer() }), { scopeCurrent: false })).toEqual({
      kind: 'LOADING',
      waitingForConnection: false,
    });
  });

  it('is LOADING for a first read, and says it waits for a connection when the read is paused', () => {
    expect(derive(facts())).toEqual({ kind: 'LOADING', waitingForConnection: false });
    expect(derive(facts({ fetchStatus: 'paused' }))).toEqual({ kind: 'LOADING', waitingForConnection: true });
  });

  it('is an ERROR for a first read that failed', () => {
    const error = new Error('x');
    expect(derive(facts({ status: 'error', fetchStatus: 'idle', error }))).toEqual({ kind: 'ERROR', error });
  });

  it('is LISTED and VERIFIED for an answer that is the last word', () => {
    const view = derive(facts({ status: 'success', fetchStatus: 'idle', data: answer() }));
    expect(view).toMatchObject({ kind: 'LISTED', freshness: { kind: 'VERIFIED' }, provenance: 'FIXTURE', receivedAt: 10 });
  });

  it('keeps drawing the answer while a new one is on its way', () => {
    const view = derive(facts({ status: 'success', fetchStatus: 'fetching', data: answer() }));
    expect(view).toMatchObject({ kind: 'LISTED', freshness: { kind: 'REVALIDATING' } });
  });

  it('withholds the answer when the read waits for a connection or failed', () => {
    expect(derive(facts({ status: 'success', fetchStatus: 'paused', data: answer() }))).toMatchObject({
      freshness: { kind: 'UNVERIFIED', why: 'offline' },
    });
    const error = new Error('x');
    expect(derive(facts({ status: 'error', fetchStatus: 'idle', data: answer(), error }))).toMatchObject({
      freshness: { kind: 'UNVERIFIED', why: 'failed', error },
    });
  });

  it('withholds the answer after the foreground interval until a new one lands', () => {
    const view = derive(facts({ status: 'success', fetchStatus: 'fetching', data: answer() }), { withheld: true });
    expect(view).toMatchObject({ freshness: { kind: 'UNVERIFIED', why: 'checking' } });
  });

  it('draws facts only from an answer that is not unverified', () => {
    expect(mayDrawFacts({ kind: 'VERIFIED' })).toBe(true);
    expect(mayDrawFacts({ kind: 'REVALIDATING' })).toBe(true);
    expect(mayDrawFacts({ kind: 'UNVERIFIED', why: 'offline', error: null })).toBe(false);
  });
});

describe('a Seller cart\'s status', () => {
  const verified = { kind: 'VERIFIED' } as const;

  it('is EMPTY with no lines, CLEAN with none reported, HAS_ISSUES with one, and UNVERIFIED when the answer is', () => {
    expect(sellerCartStatus(cart([]), verified)).toBe('EMPTY');
    expect(sellerCartStatus(cart([line('l1'), line('l2')]), verified)).toBe('CLEAN');
    expect(sellerCartStatus(cart([line('l1'), line('l2', ['SOLD_OUT'])]), verified)).toBe('HAS_ISSUES');
    expect(sellerCartStatus(cart([line('l1', ['SOLD_OUT'])]), { kind: 'UNVERIFIED', why: 'offline', error: null })).toBe('UNVERIFIED');
  });

  it('is decided by its own lines only: another Seller cart with issues changes nothing', () => {
    const clean = cart([line('l1')]);
    const other = { ...cart([line('l2', ['SOLD_OUT'])]), key: asSellerKey('seller-b') };
    expect(sellerCartStatus(clean, verified)).toBe('CLEAN');
    expect(sellerCartStatus(other, verified)).toBe('HAS_ISSUES');
  });
});

describe('the reason to show first for a line', () => {
  it('is the highest in display precedence, or null when the server reports nothing', () => {
    expect(primaryIssue(line('l1'))).toBeNull();
    expect(primaryIssue(line('l1', ['PRICE_CHANGED', 'SOLD_OUT']))).toBe('SOLD_OUT');
    expect(primaryIssue(line('l1', ['UNKNOWN', 'INSUFFICIENT_STOCK']))).toBe('INSUFFICIENT_STOCK');
  });

  it('keeps no memory of a price: a changed price is no difference unless the server reported one', () => {
    const before = line('l1');
    const after = { ...line('l1'), unitPrice: { amountMinor: 1500, currency: 'ETB' } };
    expect(primaryIssue(before)).toBeNull();
    expect(primaryIssue(after)).toBeNull();
  });
});
