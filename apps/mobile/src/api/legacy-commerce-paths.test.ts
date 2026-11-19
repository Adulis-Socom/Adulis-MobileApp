import { productionSources, repoFile } from '../testing/source-scan';

/**
 * The app places no Order and takes no payment, so none of its code may name the older cart, Order,
 * payment, receipt, refund, billing, payout, claim or checkout routes. The Seller Companion's two reads of
 * its own store's orders are a different path and are not matched. The list is checked against the contract
 * itself (read only): a route that touches those words and is neither denied nor allowed below fails. Comments are ignored, so explaining a rule never trips
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
  ['a refund route', /\/refunds\b/, "'/v1/seller/orders/{id}/refunds'"],
  ['a refund acknowledgement', /\/refunds\b/, "'/refunds/{rid}/acknowledge'"],
  ['reissuing payment instructions', /reissue-instructions/, "'/v1/seller/orders/{id}/reissue-instructions'"],
  ['a billing route', /\/v1\/billing\b/, "'/v1/billing/purchase-intent'"],
  ['a Seller payout route', /\/v1\/seller\/payout\b/, "'/v1/seller/payout/history'"],
  ['a claim or its remedy', /\/v1\/(?:seller\/)?claims\b/, "'/v1/seller/claims/{id}/remedy'"],
  ['syncing handoffs', /handoffs\/sync/, "'/v1/handoffs/sync'"],
  ['a Seller payment decision', /payment\/(confirm|reject)/, "'/payment/confirm'"],
  ['a checkout route', /\/v1\/checkout/, "'/v1/checkout/sessions'"],
  ['a payment attempt route', /payment-attempt/, "'/payment-attempts'"],
];

describe('the app names no cart, Order, payment, receipt, refund, billing, payout, claim or checkout route', () => {
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

describe('every contract route that touches a cart, an Order, money or a claim is decided here', () => {
  const contractPaths = Object.keys((JSON.parse(repoFile('contracts/openapi.json')) as { paths: Record<string, unknown> }).paths);
  const TOUCHES = /cart|order|payment|refund|reissue|billing|payout|claim|checkout|handoff|remedy|reservation|receipt/i;

  /**
   * Routes that name one of those words and are still allowed, each for a reviewed reason: the Seller
   * Companion and Courier operate on their own store's or assigned Orders, and an image position is not an Order.
   */
  const ALLOWED = [
    '/v1/seller/orders',
    '/v1/seller/orders/{id}',
    '/v1/seller/orders/{id}/ready',
    '/v1/seller/orders/{id}/courier-assignment',
    '/v1/seller/orders/{id}/custody-transfer',
    '/v1/seller/orders/{id}/qr',
    '/v1/courier/orders',
    '/v1/courier/orders/{id}',
    '/v1/courier/orders/{id}/custody-accept',
    '/v1/seller/products/{id}/images/order',
  ];
  const denied = (path: string) => DENIED.some(([, pattern]) => pattern.test(`'${path}'`));

  it('reads the contract: it has the cart and Order routes', () => {
    expect(contractPaths).toEqual(expect.arrayContaining(['/v1/cart', '/v1/cart/lines', '/v1/orders']));
  });

  it('leaves no such route undecided: a new one fails here until it is denied or allowed on purpose', () => {
    const undecided = contractPaths.filter((path) => TOUCHES.test(path) && !ALLOWED.includes(path) && !denied(path));
    expect(undecided).toEqual([]);
  });

  it('allows only routes the contract has, and none that a denial pattern also matches', () => {
    expect(ALLOWED.filter((path) => !contractPaths.includes(path))).toEqual([]);
    expect(ALLOWED.filter(denied)).toEqual([]);
  });
});
