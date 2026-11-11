import { addItemBody, assertRef, normalizeName, parseFilter, savedStateBody } from './collections.logic';

const P = '0e090000-0000-4000-8000-000000000101';
const REF = 'AbCdEfGhIjKlMnOpQrStU_';

describe('collections.logic', () => {
  it('normalises names: NFC, one space per whitespace run, trimmed, 1-60 code points, no control characters', () => {
    expect(normalizeName('  Outfit \t\n ideas ')).toBe('Outfit ideas');
    expect(normalizeName('Café')).toBe('Café');
    expect(normalizeName('የቡና ዕቃዎች')).toBe('የቡና ዕቃዎች');
    expect(normalizeName('\u{1F9FA}'.repeat(60))).toHaveLength(120); // 60 code points (UTF-16 length 120)
    for (const bad of ['', '   ', 'x'.repeat(61), 'a\u0000b', 'a\u007fb']) {
      expect(() => normalizeName(bad)).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    }
  });

  it('a malformed ref is a 404, never a 400 that distinguishes it', () => {
    expect(() => assertRef(P)).not.toThrow();
    expect(() => assertRef('nope')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('types targets: a Product by uuid, a Scene by public_ref; unknown keys, types and surfaces refused', () => {
    expect(addItemBody.parse({ target: { type: 'PRODUCT_POST', ref: P }, source_surface: 'SEARCH' })).toBeTruthy();
    expect(addItemBody.parse({ target: { type: 'SCENE_POST', ref: REF }, source_surface: 'FOR_YOU', context: { scene_ref: REF } })).toBeTruthy();
    for (const body of [
      { target: { type: 'PRODUCT_POST', ref: REF }, source_surface: 'SEARCH' },
      { target: { type: 'SCENE_POST', ref: P }, source_surface: 'SEARCH' },
      { target: { type: 'SELLER', ref: P }, source_surface: 'SEARCH' },
      { target: { type: 'PRODUCT_POST', ref: P }, source_surface: 'CART' },
      { target: { type: 'PRODUCT_POST', ref: P }, source_surface: 'SEARCH', owner_account_id: P },
    ]) {
      expect(() => addItemBody.parse(body)).toThrow();
    }
    expect(() => savedStateBody.parse({ targets: Array.from({ length: 61 }, () => ({ type: 'PRODUCT_POST', ref: P })) })).toThrow();
    expect(parseFilter(undefined)).toBe('ALL');
    expect(() => parseFilter('SELLER')).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
  });
});
