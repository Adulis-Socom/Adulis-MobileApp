import { productionSources } from '../testing/source-scan';

/**
 * The app places no Order and takes no payment, so none of its code may name the older cart, Order,
 * payment, receipt, refund or checkout routes. The Seller Companion's two reads of its own store's
 * orders are a different path and are not matched. Comments are ignored, so explaining a rule never trips
 * it, and each pattern is proved on a sample it exists to catch, so one that stops matching cannot pass
 * silently. Adding any of these is a product decision and changes this test on purpose.
 *
 * This file is outside the cart folder on purpose: removing that folder must not remove this check.
 */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '');
  return withoutBlocks
    .split('\n')
    .map((line) => {
      if (/^\s*\/\//.test(line)) return '';
      const at = line.search(/\s\/\/\s/);
      if (at < 0) return line;
      const before = line.slice(0, at);
      const quotes = (before.match(/['"`]/g) ?? []).length;
      return quotes % 2 === 0 ? before : line;
    })
    .join('\n');
}

const DENIED: ReadonlyArray<[what: string, pattern: RegExp, sample: string]> = [
  ['the cart routes', /\/v1\/cart\b/, "'/v1/cart/lines'"],
  ['the Order creation route', /['"`]\/v1\/orders['"`]/, "'/v1/orders'"],
  ['an Order sub-route', /\/v1\/orders\//, "'/v1/orders/{id}/cancel'"],
  ['payment instructions', /payment-instructions/, "'/v1/orders/{id}/payment-instructions'"],
  ['payment evidence', /payment-evidence/, "'payment-evidence'"],
  ['confirming receipt', /confirm-receipt/, "'confirm-receipt'"],
  ['a reservation route', /\/reservations\//, "'/reservations/{rid}/cancel'"],
  ['a refund route', /\/refunds\//, "'/refunds/{rid}/acknowledge'"],
  ['syncing handoffs', /handoffs\/sync/, "'/v1/handoffs/sync'"],
  ['a Seller payment decision', /payment\/(confirm|reject)/, "'/payment/confirm'"],
  ['a checkout route', /\/v1\/checkout/, "'/v1/checkout/sessions'"],
  ['a payment attempt route', /payment-attempt/, "'/payment-attempts'"],
];

describe('the app names no cart, Order, payment, receipt, refund or checkout route', () => {
  // The app's own code: the test helpers (a top-level testing folder, and the cart folder's own) are not shipped.
  const sources = productionSources('.').filter((s) => !s.file.startsWith('testing/') && !s.file.startsWith('commerce/testing/'));

  it('the scan looks at the app: it sees the API client and the Seller Companion reads', () => {
    const files = sources.map((s) => s.file);
    expect(sources.length).toBeGreaterThan(100);
    expect(files).toEqual(expect.arrayContaining(['api/client.ts', 'seller/seller-api.ts']));
    const client = sources.find((s) => s.file === 'api/client.ts')!;
    expect(client.text).toContain('/v1/seller/orders');
  });

  it.each(DENIED)('no source names %s', (_what, pattern) => {
    const offenders = sources.filter((s) => pattern.test(stripComments(s.text))).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it.each(DENIED)('the pattern for %s bites on a sample, and ignores a comment', (_what, pattern, sample) => {
    expect(pattern.test(stripComments(`const path = ${sample};`))).toBe(true);
    expect(pattern.test(stripComments(`// ${sample}\nconst a = 1;`))).toBe(false);
  });

  it('does not match the Seller Companion\'s own store orders', () => {
    for (const [, pattern] of DENIED) {
      expect(pattern.test("'/v1/seller/orders'")).toBe(false);
      expect(pattern.test("'/v1/seller/orders/{id}'")).toBe(false);
    }
  });
});
