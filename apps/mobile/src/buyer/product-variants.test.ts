import { storefrontProduct, type StorefrontProduct } from '../testing/fake-api';
import { NO_VARIANT, chosenVariant, isSelectable, transition, type VariantEvent, type VariantState } from './product-variants';

/**
 * The option-choice machine on its own: every transition of its table, and the rule that holds
 * across any sequence of choices and server answers: the state names an option only while the
 * latest answer offers it.
 */
const SMALL = '0b6f1a3e-5555-4555-8555-555555555555';
const LARGE = '0b6f1a3e-6666-4666-8666-666666666666';
type Variant = StorefrontProduct['variants'][number];
const option = (id: string, over: Partial<Variant> = {}): Variant => ({
  id,
  variant_key: id === SMALL ? 'Small' : 'Large',
  price_minor: 85000,
  price_currency: 'ETB',
  stock_count: 3,
  stock_confirmed_at: null,
  status: 'ACTIVE',
  available: true,
  ...over,
});
const product = (variants: Variant[], over: Partial<StorefrontProduct> = {}) => storefrontProduct('basket', 'Basket', { variants, ...over });
const at = (id: string): VariantState => ({ kind: 'SELECTED', id });
const select = (state: VariantState, id: string, p: StorefrontProduct) => transition(state, { type: 'SELECT', id }, p);
const project = (state: VariantState, p: StorefrontProduct) => transition(state, { type: 'PROJECT' }, p);

describe('choosing an option', () => {
  it('chooses an option the answer offers now', () => {
    expect(select(NO_VARIANT, SMALL, product([option(SMALL), option(LARGE)]))).toEqual(at(SMALL));
  });

  it('changes the choice from one offered option to another, and keeps the same state for the same option', () => {
    const p = product([option(SMALL), option(LARGE)]);
    const first = select(NO_VARIANT, SMALL, p);
    expect(select(first, LARGE, p)).toEqual(at(LARGE));
    expect(select(first, SMALL, p)).toBe(first);
  });

  it.each([
    ['an option the server says is not available', product([option(SMALL, { available: false })])],
    ['an option the answer does not list', product([option(LARGE)])],
    ['an available option of a Product that is not available', product([option(SMALL)], { available: false })],
  ])('refuses %s, and leaves the state as it was', (_what, p) => {
    expect(select(NO_VARIANT, SMALL, p)).toBe(NO_VARIANT);
    const held = at(LARGE);
    expect(select(held, SMALL, p)).toBe(held);
  });

  it('decides availability by the server flag, never by the stock count', () => {
    expect(isSelectable({ available: true }, option(SMALL, { stock_count: 0, available: true }))).toBe(true);
    expect(isSelectable({ available: true }, option(SMALL, { stock_count: 100, available: false }))).toBe(false);
    expect(select(NO_VARIANT, SMALL, product([option(SMALL, { stock_count: 100, available: false })]))).toBe(NO_VARIANT);
  });
});

describe('a new answer arrives', () => {
  it('keeps a choice the answer still offers, and the shown option is the new answer’s (its new price)', () => {
    const held = at(SMALL);
    const next = product([option(SMALL, { price_minor: 90000 }), option(LARGE)]);
    expect(project(held, next)).toBe(held);
    expect(chosenVariant(held, next)?.price_minor).toBe(90000);
  });

  it.each([
    ['the option became unavailable', product([option(SMALL, { available: false })])],
    ['the option is no longer listed', product([option(LARGE)])],
    ['the Product became unavailable', product([option(SMALL)], { available: false })],
    ['the Product has no options', product([])],
  ])('drops the choice when %s', (_what, next) => {
    expect(project(at(SMALL), next)).toBe(NO_VARIANT);
  });

  it('does not bring a dropped choice back when a later answer offers the option again', () => {
    const dropped = project(at(SMALL), product([option(SMALL, { available: false })]));
    expect(project(dropped, product([option(SMALL)]))).toBe(NO_VARIANT);
    expect(chosenVariant(dropped, product([option(SMALL)]))).toBeNull();
  });

  it('with no choice, stays with no choice (the same state)', () => {
    expect(project(NO_VARIANT, product([option(SMALL)]))).toBe(NO_VARIANT);
  });
});

describe('the chosen option', () => {
  it('is null for a state that names an option the answer does not offer now, whatever the state says', () => {
    expect(chosenVariant(at(SMALL), product([option(LARGE)]))).toBeNull();
    expect(chosenVariant(at(SMALL), product([option(SMALL, { available: false })]))).toBeNull();
    expect(chosenVariant(NO_VARIANT, product([option(SMALL)]))).toBeNull();
  });
});

describe('any sequence of choices and answers', () => {
  it('never leaves the machine naming an option the latest answer does not offer', () => {
    // A fixed pseudo-random walk (the same on every run): five hundred steps over four answers.
    let seed = 20261118;
    const next = (n: number) => {
      seed = (seed * 1664525 + 1013904223) % 0x100000000;
      return seed % n;
    };
    const answers = [
      product([option(SMALL), option(LARGE)]),
      product([option(SMALL, { available: false }), option(LARGE)]),
      product([option(LARGE, { price_minor: 99000 })]),
      product([option(SMALL), option(LARGE)], { available: false }),
    ];
    let state: VariantState = NO_VARIANT;
    let latest = answers[0]!;
    let offered = 0;
    for (let step = 0; step < 500; step++) {
      const event: VariantEvent = next(3) === 0 ? { type: 'PROJECT' } : { type: 'SELECT', id: next(2) ? SMALL : LARGE };
      if (event.type === 'PROJECT') latest = answers[next(answers.length)]!;
      state = transition(state, event, latest);
      if (state.kind === 'SELECTED') {
        offered++;
        const id = state.id;
        const found = latest.variants.find((v) => v.id === id);
        expect(found).toBeDefined();
        expect(isSelectable(latest, found!)).toBe(true);
        expect(chosenVariant(state, latest)).toBe(found);
      } else {
        expect(chosenVariant(state, latest)).toBeNull();
      }
    }
    // The walk does reach a choice, so the assertions above are not vacuous.
    expect(offered).toBeGreaterThan(50);
  });
});
