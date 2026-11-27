// Recovered from the archived Search regressions (recovery/legacy-dev-20261125, buyer/search-discovery.test.tsx): the same
// characters and expectations, now against the replacement guard. "Sent" means problem null; the text sent is the typed text.
import { prepareQuery, SEARCH_MAX_CHARS } from './search-query';

const sent = (text: string) => prepareQuery(text).problem === null;

describe('judged as the server judges it, sent as typed', () => {
  it('sends the typed text, not the folded one', () => {
    expect(prepareQuery('  ﬃ  ')).toEqual({ q: 'ﬃ', problem: null });
    expect(prepareQuery('a!')).toEqual({ q: 'a!', problem: null });
  });

  it('after NFKC, a character that folds to letters is sent; one that folds to dots is not', () => {
    expect(sent('ﬃ')).toBe(true); // ffi
    expect(sent('℀')).toBe(true); // a/c
    expect(prepareQuery('…').problem).toBe('no_terms'); // ...
  });

  it.each([
    ['an Ethiopic word', 'በና'],
    ['Ethiopic digits', '፩፪'],
    ['digits only', '12'],
    ['full-width digits (they fold to 12)', '１２'],
  ])('%s is sent: it has a letter or a digit as the server counts them', (_name, text) => {
    expect(sent(text)).toBe(true);
  });

  it.each([
    ['two zero-width spaces (not white space, no term)', '​​', 'no_terms'],
    ['a letter and its combining accent (one character after the fold)', 'é', 'too_short'],
    ['no-break spaces only (white space: nothing typed)', '  ', 'empty'],
    ['punctuation only', '!!', 'no_terms'],
    ['one character', 'a', 'too_short'],
  ] as const)('%s: the reason is said, nothing is sent', (_name, text, problem) => {
    expect(prepareQuery(text).problem).toBe(problem);
  });
});

describe('a query that is too long once normalised', () => {
  // U+FDFA folds to 18 characters under NFKC, so six of them are 6 typed characters and 108 on the server.
  it('is refused at once', () => {
    expect([...'ﷺ'.repeat(6).normalize('NFKC')]).toHaveLength(108);
    expect(prepareQuery('ﷺ'.repeat(6)).problem).toBe('too_long');
  });
  it('exactly the limit after normalisation is sent; one more is not', () => {
    const atLimit = `${'ﷺ'.repeat(5)}${'a'.repeat(10)}`; // 90 + 10
    expect(sent(atLimit)).toBe(true);
    expect(prepareQuery(`${atLimit}a`).problem).toBe('too_long');
    expect(prepareQuery('x'.repeat(SEARCH_MAX_CHARS + 1)).problem).toBe('too_long');
  });
  it('counts characters, not UTF-16 units: 97 characters that are 103 units are sent', () => {
    const text = `${'ﷺ'.repeat(5)}${'\u{1F600}'.repeat(6)}a`;
    expect([...text.normalize('NFKC')]).toHaveLength(97);
    expect(text.normalize('NFKC').length).toBe(103);
    expect(sent(text)).toBe(true);
  });
});

describe('where this runtime cannot normalise the text', () => {
  const original = String.prototype.normalize;
  afterEach(() => {
    Object.defineProperty(String.prototype, 'normalize', { value: original, configurable: true, writable: true });
  });
  it.each([
    ['is missing', undefined],
    [
      'throws',
      () => {
        throw new RangeError('The normalization form should be one of NFC, NFD, NFKC, NFKD.');
      },
    ],
  ])('a normalize that %s: no-terms and too-long step aside (the server decides); too-short still applies', (_name, replacement) => {
    Object.defineProperty(String.prototype, 'normalize', { value: replacement, configurable: true, writable: true });
    expect(sent('!!')).toBe(true);
    expect(sent('x'.repeat(101))).toBe(true);
    expect(prepareQuery('a').problem).toBe('too_short');
  });
});
