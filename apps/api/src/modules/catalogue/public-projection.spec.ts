import { minorUnits, priceFields } from './public-projection';

describe('public projection money (WO-CAT-001)', () => {
  it('passes integer minor units through exactly, null as null', () => {
    expect(minorUnits('90000')).toBe(90000);
    expect(minorUnits(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(minorUnits(null)).toBeNull();
    expect(priceFields({ price_min_minor: '1', price_max_minor: null, price_currency: null })).toEqual({
      price_min_minor: 1,
      price_max_minor: null,
      price_currency: null,
    });
  });

  it('refuses a value a JSON number cannot hold exactly rather than publish a wrong price', () => {
    expect(() => minorUnits('9007199254740993')).toThrow();
    expect(() => minorUnits('-1')).toThrow();
    expect(() => minorUnits('12.5')).toThrow();
  });
});
